/* ============================================================================
   game.js — Blossom Drop core: physics (Matter.js), merging, abilities,
   danger detection and canvas rendering.  No DOM other than the one canvas.

   Coordinates: "jar units". x 0..JAR_W left→right, y 0..JAR_H top→bottom, the
   jar's top edge is y=0 and the danger line is BD.LINE_Y. The renderer shifts
   by (PAD_X, TOP) so the dropper rail has room above the jar.

   Public API (BD.Game):
     new BD.Game(canvas, hooks)   hooks: {quip(kind), over(summary), toast(msg), sound?}
     g.start(charId)  g.pause(on)  g.drop()  g.setPointer(logicalX)
     g.useAbility()   g.decree(tier)  g.pointerDown(x,y)  g.resize()
     g.state          "idle" | "play" | "decay" | "decree" | "paused" | "over"
     g.score g.meter g.held g.queue g.maxTier g.bestCombo g.abilityTime
   ========================================================================== */
(function (BD) {
  "use strict";
  const M = window.Matter, TAU = Math.PI * 2;
  const { Engine, Bodies, Body, Composite, Events, Query } = M;
  const T = BD.TIERS, W = BD.JAR_W, H = BD.JAR_H, LINE = BD.LINE_Y;
  const FLOOR = H - 16;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  class Game {
    constructor(canvas, hooks) {
      this.cv = canvas; this.ctx = canvas.getContext("2d"); this.hooks = hooks || {};
      this.state = "idle"; this.t = 0; this.pointerX = W / 2;
      this.frameCache = null; this.scale = 1;
      this.buildWorld();
      this.reset("cody");
      this.resize();
    }

    /* ------------------------------------------------------------ world */
    buildWorld() {
      this.engine = Engine.create({ positionIterations: 10, velocityIterations: 8, constraintIterations: 3 });
      this.engine.gravity.y = 1; this.engine.gravity.scale = 0.0017;
      const opt = { isStatic: true, friction: 0.35, restitution: 0.05, label: "wall" };
      this.walls = [
        Bodies.rectangle(-50, H / 2 - 400, 100, H + 1200, opt),
        Bodies.rectangle(W + 50, H / 2 - 400, 100, H + 1200, opt),
        Bodies.rectangle(W / 2, FLOOR + 50, W + 300, 100, opt),
      ];
      Composite.add(this.engine.world, this.walls);
      this.pairs = [];
      const push = (e) => { for (const p of e.pairs) { const a = p.bodyA, b = p.bodyB; if (a.orb && b.orb && a.orb.tier > 0 && a.orb.tier === b.orb.tier) this.pairs.push([a, b]); } };
      Events.on(this.engine, "collisionStart", push);
      Events.on(this.engine, "collisionActive", push);
      Events.on(this.engine, "collisionStart", (e) => {
        for (const p of e.pairs) {
          const a = p.bodyA, b = p.bodyB; if (!a.orb && !b.orb) continue;
          const v = Math.abs(a.speed - b.speed) + Math.abs((a.isStatic ? 0 : a.velocity.y) - (b.isStatic ? 0 : b.velocity.y)) * 0.3;
          if (this.t - (this.lastThud || 0) > 0.05) { this.lastThud = this.t; BD.sfx.thud(v); }
        }
      });
    }

    reset(charId, seed) {
      this.rng = seed == null ? Math.random : mulberry(seed); this.uid = 0; this.junkQ = [];
      this.char = BD.CHAR[charId] || BD.CHAR.cody;
      this.engine.gravity.y = 1;
      Composite.clear(this.engine.world, false, true);
      Composite.add(this.engine.world, this.walls);
      this.orbs = []; this.pairs = [];
      this.parts = []; this.popups = []; this.rings = [];
      this.score = 0; this.combo = 0; this.lastMerge = -99; this.merges = 0;
      this.maxTier = 0; this.bestCombo = 0; this.chainMax = 0;
      this.meter = 40; this.shake = 0; this.warn = 0; this.overTimer = 0;
      this.abilityTime = 0; this.abilityKind = null; this.shelf = null; this.punch = null; this.vortex = 0; this.zero = 0;
      this.t = 0; this.dropReady = 0; this.pending = null; this.decreeFrom = null;
      this.queue = []; for (let i = 0; i < 6; i++) this.queue.push(this.randTier());
      this.held = this.queue.shift(); this.queue.push(this.randTier());
      this.heldAnim = 0; this.accum = 0; this.pointerX = W / 2;
    }

    start(charId, seed) { this.reset(charId, seed); this.state = "play"; this.say("start"); }
    pause(on) { if (this.state === "play" || this.state === "decay") { if (on) { this.prevState = this.state; this.state = "paused"; } } else if (this.state === "paused" && !on) this.state = this.prevState || "play"; }
    say(kind) { if (this.hooks.quip) this.hooks.quip(kind); }

    randTier() {
      const w = BD.SPAWN_WEIGHTS; let r = this.rng() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i + 1; }
      return 1;
    }
    get previewCount() { return this.char.id === "light" ? 4 : 1; }

    /* ------------------------------------------------------------ orbs */
    makeOrb(tier, x, y, vx, vy, pop) {
      const r = tier === 0 ? BD.JUNK_R : T[tier - 1].r;
      const b = Bodies.circle(x, y, r, { restitution: 0.1, friction: 0.12, frictionStatic: 0.5, frictionAir: 0.006, density: 0.0014, slop: 0.04, label: "orb" });
      b.orb = { id: ++this.uid, tier, r, born: this.t, pop: pop || 0, overT: 0, dead: false, spin: 0, junk: tier === 0 };
      Body.setVelocity(b, { x: vx || 0, y: vy || 0 });
      Composite.add(this.engine.world, b); this.orbs.push(b);
      return b;
    }
    killOrb(b) { if (b.orb.dead) return; b.orb.dead = true; Composite.remove(this.engine.world, b); const i = this.orbs.indexOf(b); if (i >= 0) this.orbs.splice(i, 1); }

    drop() {
      if (this.state !== "play" && this.state !== "decay") return;
      if (this.state === "decay" || this.t < this.dropReady || this.held == null) return;
      const tier = this.held, r = T[tier - 1].r;
      const x = clamp(this.pointerX, r + 3, W - r - 3);
      this.makeOrb(tier, x, -46, 0, 1.5, 0.35);
      BD.sfx.drop();
      this.held = this.queue.shift(); this.queue.push(this.randTier());
      this.dropReady = this.t + 0.5; this.heldAnim = 0;
      this.combo = 0;
    }
    setPointer(lx) { this.pointerX = lx; }

    /* ------------------------------------------------------------ multiplayer helpers */
    addJunk(n) { for (let i = 0; i < n; i++) this.junkQ.push(this.t + i * 0.22); }
    spawnJunk() { const x = rand(BD.JUNK_R + 8, W - BD.JUNK_R - 8); this.makeOrb(0, x, -40, rand(-1.2, 1.2), 2, 0.3); BD.sfx.thud(5); this.shake = Math.max(this.shake, 4); }
    /** compact picture of the jar for the opponent: [[id, tier, x, y, angle], ...] */
    snapshot() { return this.orbs.map(o => [o.orb.id, o.orb.tier, Math.round(o.position.x * 10) / 10, Math.round(o.position.y * 10) / 10, Math.round(o.angle * 100) / 100]); }

    /* ------------------------------------------------------------ merging */
    process() {
      if (!this.pairs.length) return;
      const used = new Set();
      for (const [a, b] of this.pairs) {
        if (!a.orb || !b.orb || a.orb.dead || b.orb.dead || used.has(a) || used.has(b) || a.orb.tier !== b.orb.tier) continue;
        used.add(a); used.add(b); this.merge(a, b);
      }
      this.pairs.length = 0;
    }
    merge(a, b, silent) {
      const tier = a.orb.tier, mx = (a.position.x + b.position.x) / 2, my = (a.position.y + b.position.y) / 2;
      const vx = (a.velocity.x + b.velocity.x) / 2, vy = (a.velocity.y + b.velocity.y) / 2;
      this.killOrb(a); this.killOrb(b);
      this.combo = (this.t - this.lastMerge < 1.15) ? this.combo + 1 : 1;
      this.lastMerge = this.t; this.bestCombo = Math.max(this.bestCombo, this.combo); this.merges++;
      const mult = 1 + 0.25 * (this.combo - 1);
      if (tier >= T.length) {
        const gain = Math.round(BD.FULL_BLOOM * mult); this.addScore(gain, mx, my, "#ffd1e3", 30);
        this.burst(mx, my, ["#ffe6ef", "#ff9fc0", "#ffd25a", "#fff"], 70, 360); this.ring(mx, my, 260, "#ffd1e3"); this.shake = 14; this.meter = Math.min(100, this.meter + 35);
        BD.sfx.bloom(); this.say("big"); if (this.hooks.toast) this.hooks.toast("✿ Full Bloom! ✿");
        if (this.hooks.merged) this.hooks.merged({ nt: tier + 1, combo: this.combo, full: true });
        return;
      }
      const nt = tier + 1, r = T[nt - 1].r;
      const x = clamp(mx, r + 2, W - r - 2);
      this.makeOrb(nt, x, Math.min(my, FLOOR - r - 1), vx * 0.4, vy * 0.4, 0.45);
      this.maxTier = Math.max(this.maxTier, nt);
      this.addScore(Math.round(T[nt - 1].pts * mult), mx, my, T[nt - 1].c[1], 14 + nt * 1.6);
      this.burst(mx, my, [T[nt - 1].c[0], T[nt - 1].c[1], "#fff"], 8 + nt * 3, 120 + nt * 22);
      this.ring(mx, my, T[tier - 1].r * 2.2, T[nt - 1].c[1]);
      if (!silent) { BD.sfx.pop(nt, this.combo); this.shake = Math.max(this.shake, nt >= 7 ? 5 + nt * 0.5 : 0); }
      this.meter = Math.min(100, this.meter + 2 + nt * 0.9 + (this.combo - 1) * 3);
      if (this.combo >= 2 && this.hooks.toast) this.hooks.toast(`Combo x${this.combo}!`, "combo");
      if (this.hooks.merged) this.hooks.merged({ nt, combo: this.combo, full: false });
      if (this.combo === 3) this.say("combo"); else if (nt >= 7 && nt === this.maxTier) this.say("big"); else if (this.merges % 9 === 0) this.say("merge");
    }
    addScore(n, x, y, color, size) {
      this.score += n; this.popups.push({ x, y: y - 10, text: "+" + n, life: 1.1, max: 1.1, color: color || "#fff", size: size || 18 });
    }

    /* ------------------------------------------------------------ effects */
    burst(x, y, colors, n, speed) {
      for (let i = 0; i < n; i++) {
        const a = rand(0, TAU), s = rand(0.25, 1) * speed;
        this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.25, life: rand(0.5, 1.2), max: 1.2, size: rand(3, 7), color: colors[(Math.random() * colors.length) | 0], rot: rand(0, TAU), vr: rand(-6, 6), kind: Math.random() < 0.55 ? "petal" : "dot", g: 520 });
      }
    }
    ring(x, y, r, color) { this.rings.push({ x, y, r0: r * 0.2, r1: r, life: 0.5, max: 0.5, color }); }

    /* ------------------------------------------------------------ abilities */
    get abilityReady() { return this.meter >= 100 && (this.state === "play"); }
    useAbility() {
      if (!this.abilityReady) return false;
      const id = this.char.id;
      const ok = ({ cody: () => this.abRally(), uraraka: () => this.abZero(), joseph: () => this.abShake(), falcon: () => this.abPunch(), cementoss: () => this.abShelf(), maki: () => this.abFire(), light: () => this.abDecree(), shigaraki: () => this.abDecay(), allforone: () => this.abAbsorb() })[id]();
      if (ok === false) { if (this.hooks.toast) this.hooks.toast("Nothing to use that on yet!"); return false; }
      if (id !== "light" && id !== "shigaraki") this.meter = 0;
      this.say("ability"); return true;
    }
    abRally() {
      let best = null;
      for (let i = 0; i < this.orbs.length; i++) for (let j = i + 1; j < this.orbs.length; j++) {
        const a = this.orbs[i], b = this.orbs[j]; if (!a.orb.tier || a.orb.tier !== b.orb.tier) continue;
        const d = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
        const sc = a.orb.tier * 1000 - d; if (!best || sc > best.sc) best = { a, b, sc };
      }
      if (!best) return false;
      BD.sfx.ability("rally"); this.ring(best.a.position.x, best.a.position.y, 120, "#c9bdf5"); this.ring(best.b.position.x, best.b.position.y, 120, "#c9bdf5");
      this.combo = 0; this.merge(best.a, best.b); return true;
    }
    abZero() { this.zero = 3.4; this.engine.gravity.y = 0; BD.sfx.ability("float"); this.abilityKind = "zero"; this.abilityTime = 3.4; this.orbs.forEach(o => { Body.setVelocity(o, { x: o.velocity.x * 0.3 + rand(-1.4, 1.4), y: -rand(0.6, 2.2) }); o.frictionAir = 0.05; }); this.ring(W / 2, H / 2, 420, "#ffb3cb"); }
    abShake() { BD.sfx.ability("shake"); this.shake = 16; this.orbs.forEach(o => Body.setVelocity(o, { x: rand(-5, 5), y: -rand(4, 11) })); this.ring(W / 2, H - 40, 360, "#9cc4e8"); }
    abShelf() {
      BD.sfx.ability("stone"); const y = H * 0.46;
      const body = Bodies.rectangle(W / 2, y, W * 0.62, 24, { isStatic: true, friction: 0.5, restitution: 0.02, label: "shelf" });
      Composite.add(this.engine.world, body); this.shelf = { body, life: 7.5, max: 7.5, y }; this.shake = 8; this.abilityKind = "shelf"; this.abilityTime = 7.5;
      this.burst(W / 2, y, ["#c9b39a", "#a8957f", "#7d6c5b"], 26, 220);
    }
    abFire() {
      if (!this.orbs.length) return false; let low = 99; this.orbs.forEach(o => { if (o.orb.tier > 0) low = Math.min(low, o.orb.tier); }); if (low === 99) return false;
      BD.sfx.ability("fire"); this.shake = 10; this.ring(W / 2, H / 2, 480, "#ff8a3d");
      this.orbs.filter(o => o.orb.tier === low).forEach(o => { this.flameOrb(o, 0.5); });
      return true;
    }
    flameOrb(o, ptsMult) {
      const t = o.orb.tier, p = o.position; this.addScore(Math.max(1, Math.round((t ? T[t - 1].pts : 6) * (ptsMult || 0.5))), p.x, p.y, "#ffb067", 15);
      this.burst(p.x, p.y, ["#ffd25a", "#ff8a3d", "#e8402f", "#fff1b8"], 14 + t * 2, 260); this.killOrb(o);
    }
    abPunch() { this.punch = { x: clamp(this.pointerX, 40, W - 40), y: -60, r: 36, vy: 1150, hits: 0 }; BD.sfx.ability("fire"); this.abilityKind = "punch"; this.abilityTime = 1.4; }
    abDecree() { this.decreeFrom = this.state; this.state = "decree"; BD.sfx.ability("ledger"); if (this.hooks.decree) this.hooks.decree(true); return true; }
    decree(tier) { if (this.state !== "decree") return; this.held = clamp(tier, 1, 5); this.heldAnim = 0; this.meter = 0; this.state = "play"; BD.sfx.ability("ledger"); this.ring(this.pointerX, -46, 120, "#e3c98c"); if (this.hooks.decree) this.hooks.decree(false); }
    cancelDecree() { if (this.state === "decree") { this.state = "play"; if (this.hooks.decree) this.hooks.decree(false); } }
    abDecay() { if (!this.orbs.length) return false; this.state = "decay"; BD.sfx.ability("decay"); if (this.hooks.toast) this.hooks.toast("Tap an orb to crumble it", "info"); return true; }
    abAbsorb() { this.vortex = 1.5; this.abilityKind = "vortex"; this.abilityTime = 1.5; BD.sfx.ability("void"); this.orbs.forEach(o => { o.frictionAir = 0.04; }); }

    pointerDown(lx, ly) { // jar units
      if (this.state !== "decay") return false;
      const hit = Query.point(this.orbs, { x: lx, y: ly })[0]; if (!hit) return false;
      const p = hit.position, t = hit.orb.tier;
      this.burst(p.x, p.y, ["#b9d4e6", "#8fb7cf", "#566b78", "#fff"], 20 + t * 2, 240); this.ring(p.x, p.y, hit.orb.r * 2.6, "#8fb7cf"); BD.sfx.ability("decay");
      const nb = this.orbs.filter(o => o !== hit && Math.hypot(o.position.x - p.x, o.position.y - p.y) < hit.orb.r + o.orb.r + 14);
      this.killOrb(hit);
      nb.forEach(o => { if (o.orb.tier > 1) { const q = o.position, v = o.velocity, nt = o.orb.tier - 1; this.killOrb(o); this.makeOrb(nt, q.x, q.y, v.x, v.y - 1, 0.5); this.burst(q.x, q.y, ["#9bb1bd"], 6, 100); } });
      this.shake = 6; this.meter = 0; this.state = "play"; return true;
    }

    /* ------------------------------------------------------------ main step */
    update(dt) {
      if (this.state === "paused" || this.state === "idle" || this.state === "done" || this.state === "decree") { this.tickFx(dt * (this.state === "decree" ? 0.4 : 0)); return; }
      dt = Math.min(dt, 0.05); this.accum += dt;
      while (this.accum >= 1 / 60) {
        this.accum -= 1 / 60; this.t += 1 / 60;
        if (this.junkQ.length && this.state !== "over" && this.junkQ[0] <= this.t) { this.junkQ.shift(); this.spawnJunk(); }
        if (this.state !== "over") this.stepAbilities(1 / 60);
        Engine.update(this.engine, 1000 / 60);
        if (this.state !== "over") { this.process(); this.checkDanger(1 / 60); }
        if (this.state === "over") this.pairs.length = 0;
      }
      this.heldAnim = Math.min(1, this.heldAnim + dt * 4);
      for (const o of this.orbs.slice()) { if (o.orb.junk && this.t - o.orb.born > BD.JUNK_LIFE) { this.burst(o.position.x, o.position.y, ["#d8ccd6", "#b8aab6", "#fff"], 9, 150); this.killOrb(o); } }
      for (const o of this.orbs) { if (o.orb.pop > 0) o.orb.pop = Math.max(0, o.orb.pop - dt * 3.2); }
      this.tickFx(dt);
    }
    stepAbilities(dt) {
      if (this.abilityTime > 0) { this.abilityTime -= dt; if (this.abilityTime <= 0) { this.abilityKind = null; } }
      if (this.zero > 0) {
        this.zero -= dt;
        if (Math.random() < 0.25) this.parts.push({ x: rand(0, W), y: rand(0, H), vx: 0, vy: -20, life: 0.8, max: 0.8, size: 3, color: "#ffd1e3", kind: "dot", g: -10, rot: 0, vr: 0 });
        if (this.zero <= 0) { this.engine.gravity.y = 0.15; this.engine.gravity.y = 1; this.orbs.forEach(o => o.frictionAir = 0.006); this.ring(W / 2, H / 2, 300, "#ffd1e3"); }
      }
      if (this.vortex > 0) {
        this.vortex -= dt;
        const cx = W / 2, cy = H * 0.68;
        for (const o of this.orbs) { const dx = cx - o.position.x, dy = cy - o.position.y, d = Math.max(30, Math.hypot(dx, dy)); const f = 0.00055 * o.mass; Body.applyForce(o, o.position, { x: dx / d * f * 38, y: dy / d * f * 38 - o.mass * 0.0006 }); }
        if (this.vortex <= 0) this.orbs.forEach(o => o.frictionAir = 0.006);
      }
      if (this.shelf) {
        this.shelf.life -= dt;
        if (this.shelf.life <= 0) { Composite.remove(this.engine.world, this.shelf.body); this.burst(W / 2, this.shelf.y, ["#c9b39a", "#a8957f"], 36, 260); this.shelf = null; BD.sfx.thud(6); }
      }
      if (this.punch) {
        const p = this.punch; p.y += p.vy * dt; let end = p.y > FLOOR - 20;
        for (const o of this.orbs.slice()) {
          const d = Math.hypot(o.position.x - p.x, o.position.y - p.y);
          if (d < o.orb.r + p.r) {
            if (o.orb.tier <= 6) { this.flameOrb(o, 0.5); p.hits++; this.shake = 9; BD.sfx.thud(8); } else { end = true; }
          }
        }
        if (Math.random() < 0.9) this.parts.push({ x: p.x + rand(-14, 14), y: p.y - 10, vx: rand(-40, 40), vy: -rand(40, 160), life: 0.45, max: 0.45, size: rand(4, 9), color: Math.random() < 0.5 ? "#ffb347" : "#ff5a2a", kind: "dot", g: -80, rot: 0, vr: 0 });
        if (end) { this.burst(p.x, Math.min(p.y, FLOOR - 20), ["#ffd25a", "#ff8a3d", "#fff1b8"], 30, 340); this.ring(p.x, p.y, 200, "#ff8a3d"); this.shake = 12; this.punch = null; }
      }
    }
    checkDanger(dt) {
      let worst = 0;
      for (const o of this.orbs) {
        const age = this.t - o.orb.born;
        if (age > 1.5 && o.position.y - o.orb.r < LINE && o.speed < 3.2) { o.orb.overT += dt; } else o.orb.overT = Math.max(0, o.orb.overT - dt * 2);
        worst = Math.max(worst, o.orb.overT);
      }
      this.overTimer = worst; this.warn = clamp(worst / 2.4, 0, 1);
      if (worst > 0.2 && Math.floor(this.t * 4) !== Math.floor((this.t - dt) * 4)) BD.sfx.warn();
      if (worst >= 2.4) this.gameOver();
    }
    gameOver() {
      if (this.state === "over") return;
      this.state = "over"; this.engine.gravity.y = 1; BD.sfx.over(); this.shake = 10;
      this.orbs.forEach(o => this.burst(o.position.x, o.position.y, [o.orb.tier ? T[o.orb.tier - 1].c[1] : "#b8aab6"], 3, 120));
      this.say("over");
      this.overAt = this.t;
      if (this.hooks.over) this.hooks.over({ score: this.score, maxTier: this.maxTier, bestCombo: this.bestCombo, merges: this.merges });
    }
    tickFx(dt) {
      for (const p of this.parts) { p.life -= dt; p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += (p.vr || 0) * dt; }
      this.parts = this.parts.filter(p => p.life > 0);
      for (const p of this.popups) { p.life -= dt; p.y -= 38 * dt; }
      this.popups = this.popups.filter(p => p.life > 0);
      for (const r of this.rings) r.life -= dt; this.rings = this.rings.filter(r => r.life > 0);
      this.shake = Math.max(0, this.shake - dt * 30);
    }

    /* ------------------------------------------------------------ rendering */
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const rect = this.cv.getBoundingClientRect();
      const w = Math.max(200, rect.width || BD.CW);
      this.scale = (w * dpr) / BD.CW;
      this.cv.width = Math.round(BD.CW * this.scale); this.cv.height = Math.round(BD.CH * this.scale);
      this.frameCache = BD.art.paintFrame(this.scale);
      this.rect = rect;
    }
    toJar(clientX, clientY) { const r = this.cv.getBoundingClientRect(); return { x: (clientX - r.left) / r.width * BD.CW - BD.PAD_X, y: (clientY - r.top) / r.height * BD.CH - BD.TOP }; }

    landingY(x, tier) {
      const r = T[tier - 1].r; let y = FLOOR - r;
      for (const o of this.orbs) { const dx = Math.abs(o.position.x - x), rr = r + o.orb.r; if (dx < rr) y = Math.min(y, o.position.y - Math.sqrt(rr * rr - dx * dx)); }
      if (this.shelf) { const b = this.shelf.body; if (Math.abs(b.position.x - x) < W * 0.31 + r * 0.3) y = Math.min(y, this.shelf.y - 12 - r); }
      return y;
    }

    render(time) {
      const c = this.ctx, s = this.scale;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.cv.width, this.cv.height);
      c.setTransform(s, 0, 0, s, 0, 0);
      let sx = 0, sy = 0; if (this.shake > 0.2 && window.VN_CORE && window.VN_CORE.Settings.get("effects") !== false) { sx = rand(-1, 1) * this.shake * 0.5; sy = rand(-1, 1) * this.shake * 0.5; }
      c.translate(BD.PAD_X + sx, BD.TOP + sy);
      this.drawJarBack(c, time);
      this.drawFx(c, "under");
      this.drawOrbs(c);
      this.drawShelf(c);
      this.drawFx(c, "over");
      c.setTransform(s, 0, 0, s, 0, 0); c.translate(sx, sy);
      c.drawImage(this.frameCache, 0, 0, BD.CW, BD.CH);
      c.translate(BD.PAD_X, BD.TOP);
      this.drawGlass(c, time);
      c.setTransform(s, 0, 0, s, 0, 0); c.translate(BD.PAD_X + sx, BD.TOP + sy);
      this.drawDropper(c, time);
      this.drawPopups(c);
    }

    drawJarBack(c, time) {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgba(255,255,255,.07)"); g.addColorStop(1, "rgba(255,230,240,.20)");
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      // soft vertical stripes of light
      c.fillStyle = "rgba(255,255,255,.035)"; for (let i = 0; i < 4; i++) c.fillRect(60 + i * 110, 0, 38, H);
      // danger line
      const warn = this.warn, pulse = 0.5 + 0.5 * Math.sin(time * 0.012);
      c.save(); c.setLineDash([14, 10]); c.lineWidth = 3;
      c.strokeStyle = warn > 0.05 ? `rgba(255,${Math.round(110 - warn * 60)},${Math.round(110 - warn * 60)},${0.55 + 0.45 * pulse})` : "rgba(255,255,255,.38)";
      c.beginPath(); c.moveTo(0, LINE); c.lineTo(W, LINE); c.stroke(); c.restore();
      if (warn > 0.05) { const rg = c.createLinearGradient(0, 0, 0, LINE + 40); rg.addColorStop(0, `rgba(255,70,90,${0.25 * warn * (0.6 + 0.4 * pulse)})`); rg.addColorStop(1, "rgba(255,70,90,0)"); c.fillStyle = rg; c.fillRect(0, 0, W, LINE + 40); }
    }

    drawOrbs(c) {
      const px = this.scale;
      for (const o of this.orbs) {
        const r = o.orb.r, p = o.position;
        let sc = 1; if (o.orb.pop > 0) { const k = o.orb.pop; sc = 1 + Math.sin(k * Math.PI) * 0.16 - (k > 0.7 ? (k - 0.7) * 0.6 : 0); }
        // soft contact shadow
        c.fillStyle = "rgba(60,25,40,.16)"; c.beginPath(); c.arc(p.x + 2, p.y + 4, r * sc, 0, TAU); c.fill();
        const spr = o.orb.tier ? BD.art.orb(o.orb.tier, r * 2 * px * 1.0) : BD.art.stone(r * 2 * px);
        const left = o.orb.junk ? BD.JUNK_LIFE - (this.t - o.orb.born) : 99;
        c.save(); c.translate(p.x, p.y); c.rotate(o.angle); if (left < 2) c.globalAlpha = 0.45 + 0.4 * Math.sin(left * 14); c.drawImage(spr, -r * sc, -r * sc, r * 2 * sc, r * 2 * sc);
        if (o.orb.overT > 0.25) { c.globalAlpha = Math.min(0.5, o.orb.overT * 0.3); c.fillStyle = "#ff3b4f"; c.beginPath(); c.arc(0, 0, r * sc, 0, TAU); c.fill(); }
        c.restore();
      }
    }
    drawShelf(c) {
      if (!this.shelf) return; const s = this.shelf, b = s.body, w = W * 0.62, h = 24, fade = s.life < 1.2 ? (0.55 + 0.45 * Math.sin(s.life * 30)) : 1;
      c.save(); c.globalAlpha = fade; c.translate(b.position.x, b.position.y);
      const g = c.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, "#d9cbb8"); g.addColorStop(1, "#8f7e6c");
      c.fillStyle = g; c.beginPath(); c.roundRect ? c.roundRect(-w / 2, -h / 2, w, h, 8) : c.rect(-w / 2, -h / 2, w, h); c.fill();
      c.strokeStyle = "rgba(70,55,42,.6)"; c.lineWidth = 2; c.stroke();
      c.strokeStyle = "rgba(70,55,42,.35)"; c.lineWidth = 1.5; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 46, -h / 2 + 3); c.lineTo(i * 46 + 10, h / 2 - 3); c.stroke(); }
      c.fillStyle = "rgba(255,255,255,.25)"; c.fillRect(-w / 2 + 8, -h / 2 + 3, w - 16, 3);
      c.restore();
    }

    drawFx(c, layer) {
      if (layer === "under") {
        if (this.vortex > 0 || this.abilityKind === "vortex") {
          const t = this.t * 5, cx = W / 2, cy = H * 0.68, a = Math.min(1, this.vortex);
          c.save(); c.translate(cx, cy); c.globalAlpha = 0.65 * a;
          for (let i = 0; i < 4; i++) { c.rotate(t * 0.3 + i * 1.57); c.strokeStyle = i % 2 ? "#7d2bd0" : "#b3363b"; c.lineWidth = 7 - i; c.beginPath(); c.arc(0, 0, 40 + i * 34, 0, 1.9); c.stroke(); }
          c.restore();
        }
        if (this.zero > 0) { const a = Math.min(1, this.zero); c.fillStyle = `rgba(255,190,220,${0.1 * a})`; c.fillRect(0, 0, W, H); }
        return;
      }
      for (const r of this.rings) { const k = 1 - r.life / r.max; c.strokeStyle = r.color; c.globalAlpha = (1 - k) * 0.85; c.lineWidth = 6 * (1 - k) + 1; c.beginPath(); c.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - k, 3)), 0, TAU); c.stroke(); }
      c.globalAlpha = 1;
      for (const p of this.parts) {
        const a = clamp(p.life / p.max * 1.6, 0, 1); c.globalAlpha = a; c.fillStyle = p.color;
        if (p.kind === "petal") { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.scale(p.size * 0.8, p.size * 0.8); c.beginPath(); c.moveTo(0, 1); c.bezierCurveTo(-1, 0.3, -0.8, -0.8, 0, -1); c.bezierCurveTo(0.8, -0.8, 1, 0.3, 0, 1); c.fill(); c.restore(); }
        else { c.beginPath(); c.arc(p.x, p.y, p.size * 0.5 * (0.5 + a * 0.5), 0, TAU); c.fill(); }
      }
      c.globalAlpha = 1;
      if (this.punch) { const p = this.punch; c.save(); c.translate(p.x, p.y); const g = c.createRadialGradient(0, 0, 4, 0, 0, p.r * 1.6); g.addColorStop(0, "rgba(255,240,180,1)"); g.addColorStop(0.45, "rgba(255,140,50,.9)"); g.addColorStop(1, "rgba(255,60,20,0)"); c.fillStyle = g; c.beginPath(); c.arc(0, 0, p.r * 1.6, 0, TAU); c.fill();
        c.fillStyle = "#ffd9a0"; c.strokeStyle = "#a8441a"; c.lineWidth = 3; c.beginPath(); c.roundRect ? c.roundRect(-p.r * 0.62, -p.r * 0.5, p.r * 1.24, p.r * 1.1, 10) : c.rect(-p.r * 0.62, -p.r * 0.5, p.r * 1.24, p.r * 1.1); c.fill(); c.stroke();
        for (let i = -1.5; i <= 1.5; i++) { c.beginPath(); c.moveTo(i * p.r * 0.3, -p.r * 0.5); c.lineTo(i * p.r * 0.3, -p.r * 0.1); c.stroke(); }
        c.restore(); }
    }
    drawGlass(c, time) {
      c.save(); c.beginPath(); c.rect(0, 0, W, H); c.clip();
      const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, "rgba(255,255,255,.14)"); g.addColorStop(0.22, "rgba(255,255,255,0)"); g.addColorStop(0.7, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(255,255,255,.06)");
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = "rgba(255,255,255,.12)"; c.beginPath(); c.moveTo(24, 20); c.lineTo(58, 20); c.lineTo(8, 330); c.lineTo(0, 330); c.lineTo(0, 120); c.closePath(); c.fill();
      const iv = c.createLinearGradient(0, 0, 14, 0); iv.addColorStop(0, "rgba(40,20,30,.22)"); iv.addColorStop(1, "rgba(40,20,30,0)"); c.fillStyle = iv; c.fillRect(0, 0, 14, H);
      const iv2 = c.createLinearGradient(W, 0, W - 14, 0); iv2.addColorStop(0, "rgba(40,20,30,.22)"); iv2.addColorStop(1, "rgba(40,20,30,0)"); c.fillStyle = iv2; c.fillRect(W - 14, 0, 14, H);
      c.restore();
    }
    drawDropper(c, time) {
      const play = this.state === "play" || this.state === "decay" || this.state === "decree" || this.state === "paused";
      const railY = -92;
      // rail
      c.fillStyle = "rgba(90,52,28,.9)"; c.fillRect(-26, railY - 4, W + 52, 8);
      c.fillStyle = "rgba(255,225,190,.5)"; c.fillRect(-26, railY - 4, W + 52, 2);
      if (!play || this.state === "over") return;
      const tier = this.held; if (tier == null) return;
      const r = T[tier - 1].r, x = clamp(this.pointerX, r + 3, W - r - 3), ready = this.t >= this.dropReady && this.state !== "decay";
      const y = -46, k = ready ? Math.min(1, this.heldAnim + 0.05) : this.heldAnim, sc = 0.55 + 0.45 * (1 - Math.pow(1 - k, 3)) + (ready ? Math.sin(time * 0.006) * 0.012 : 0);
      // cart + rope
      c.fillStyle = "#6e4426"; c.beginPath(); c.roundRect ? c.roundRect(x - 20, railY - 8, 40, 16, 5) : c.rect(x - 20, railY - 8, 40, 16); c.fill();
      c.strokeStyle = "#5a361d"; c.lineWidth = 2; c.stroke();
      c.strokeStyle = "rgba(255,240,220,.9)"; c.lineWidth = 2; c.beginPath(); c.moveTo(x, railY + 8); c.lineTo(x, y - r * sc + 4); c.stroke();
      // guide
      if (ready) {
        const ly = this.landingY(x, tier); c.save(); c.setLineDash([3, 9]); c.lineCap = "round"; c.strokeStyle = "rgba(255,255,255,.5)"; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y + r); c.lineTo(x, ly - r); c.stroke(); c.restore();
        c.globalAlpha = 0.28; c.drawImage(BD.art.orb(tier, r * 2 * this.scale), x - r, ly - r, r * 2, r * 2); c.globalAlpha = 1;
      }
      // glow + piece
      const gl = c.createRadialGradient(x, y, r * 0.5, x, y, r * 1.9); gl.addColorStop(0, "rgba(255,255,255,.42)"); gl.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = gl; c.beginPath(); c.arc(x, y, r * 1.9, 0, TAU); c.fill();
      c.globalAlpha = ready ? 1 : 0.7; c.drawImage(BD.art.orb(tier, r * 2 * this.scale), x - r * sc, y - r * sc, r * 2 * sc, r * 2 * sc); c.globalAlpha = 1;
      if (this.state === "decay") { c.strokeStyle = "rgba(143,183,207,.9)"; c.lineWidth = 2; c.setLineDash([6, 6]); c.beginPath(); c.arc(this.decayX || W / 2, this.decayY || H / 2, 26, 0, TAU); c.stroke(); c.setLineDash([]); }
    }
    drawPopups(c) {
      c.textAlign = "center"; c.textBaseline = "middle";
      for (const p of this.popups) {
        const a = clamp(p.life / p.max * 1.8, 0, 1), sc = 1 + (1 - clamp(p.life / p.max * 3, 0, 1)) * 0.3;
        c.globalAlpha = a; c.font = `800 ${Math.round(p.size * sc)}px "Baloo 2","Nunito","Trebuchet MS",system-ui,sans-serif`;
        c.lineWidth = 5; c.strokeStyle = "rgba(60,20,45,.75)"; c.strokeText(p.text, p.x, p.y); c.fillStyle = p.color; c.fillText(p.text, p.x, p.y);
      }
      c.globalAlpha = 1;
    }
  }
  BD.Game = Game;
})(window.BD);
