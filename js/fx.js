/* ============================================================================
   fx.js — canvas weather / particle layer drawn over the background.

   API (window.VN_FX):
     set(type)   "petals" | "rain" | "ash" | "embers" | "fireflies" | "dust" | "snow" | null
     resize()    called automatically on window resize
   Particles honour Settings.effects (off => nothing is drawn).
   ========================================================================== */
(function () {
  "use strict";
  const { Settings } = window.VN_CORE;
  let canvas, c, W = 0, H = 0, dpr = 1, type = null, parts = [], raf = 0, last = 0;

  const rnd = (a, b) => a + Math.random() * (b - a);

  const KINDS = {
    petals: {
      count: 46,
      make: (p, init) => Object.assign(p, {
        x: rnd(-50, W + 50), y: init ? rnd(0, H) : rnd(-60, -10), vy: rnd(24, 52), vx: rnd(10, 34),
        s: rnd(4, 9), r: rnd(0, 6.28), vr: rnd(-2, 2), ph: rnd(0, 6.28), a: rnd(0.55, 0.95),
        hue: rnd(335, 352)
      }),
      step: (p, dt, t) => { p.x += (p.vx + Math.sin(t * 1.2 + p.ph) * 22) * dt; p.y += p.vy * dt; p.r += p.vr * dt; return p.y < H + 30 && p.x < W + 80; },
      draw: (p) => {
        c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.scale(1, 0.62 + 0.38 * Math.sin(p.r * 1.6));
        c.fillStyle = `hsla(${p.hue},85%,${82 - p.s}%,${p.a})`;
        c.beginPath(); c.ellipse(0, 0, p.s, p.s * 0.6, 0, 0, 6.283); c.fill(); c.restore();
      },
    },
    rain: {
      count: 180,
      make: (p, init) => Object.assign(p, { x: rnd(-100, W + 100), y: init ? rnd(0, H) : rnd(-100, -10), vy: rnd(900, 1300), vx: -rnd(120, 220), l: rnd(12, 26), a: rnd(0.15, 0.4) }),
      step: (p, dt) => { p.x += p.vx * dt; p.y += p.vy * dt; return p.y < H + 30; },
      draw: (p) => {
        c.strokeStyle = `rgba(190,210,235,${p.a})`; c.lineWidth = 1.1;
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + p.vx * 0.018, p.y - p.l); c.stroke();
      },
    },
    ash: {
      count: 90,
      make: (p, init) => Object.assign(p, { x: rnd(0, W), y: init ? rnd(0, H) : rnd(-20, -5), vy: rnd(14, 38), vx: rnd(-8, 14), s: rnd(1, 3.2), ph: rnd(0, 6.28), a: rnd(0.25, 0.7) }),
      step: (p, dt, t) => { p.x += (p.vx + Math.sin(t * 0.8 + p.ph) * 12) * dt; p.y += p.vy * dt; return p.y < H + 10; },
      draw: (p) => { c.fillStyle = `rgba(205,205,210,${p.a})`; c.beginPath(); c.arc(p.x, p.y, p.s, 0, 6.283); c.fill(); },
    },
    snow: {
      count: 80,
      make: (p, init) => Object.assign(p, { x: rnd(0, W), y: init ? rnd(0, H) : rnd(-20, -5), vy: rnd(20, 50), vx: rnd(-10, 10), s: rnd(1.4, 3.6), ph: rnd(0, 6.28), a: rnd(0.4, 0.9) }),
      step: (p, dt, t) => { p.x += (p.vx + Math.sin(t + p.ph) * 14) * dt; p.y += p.vy * dt; return p.y < H + 10; },
      draw: (p) => { c.fillStyle = `rgba(255,255,255,${p.a})`; c.beginPath(); c.arc(p.x, p.y, p.s, 0, 6.283); c.fill(); },
    },
    embers: {
      count: 60,
      make: (p, init) => Object.assign(p, { x: rnd(0, W), y: init ? rnd(0, H) : H + rnd(5, 30), vy: -rnd(26, 70), vx: rnd(-12, 18), s: rnd(1.1, 3), ph: rnd(0, 6.28), a: rnd(0.5, 1) }),
      step: (p, dt, t) => { p.x += (p.vx + Math.sin(t * 1.5 + p.ph) * 16) * dt; p.y += p.vy * dt; return p.y > -20; },
      draw: (p, t) => {
        const fl = 0.6 + 0.4 * Math.sin(t * 7 + p.ph);
        c.fillStyle = `rgba(255,${Math.floor(130 + 70 * fl)},60,${p.a * fl})`;
        c.shadowColor = "rgba(255,140,50,0.9)"; c.shadowBlur = 8;
        c.beginPath(); c.arc(p.x, p.y, p.s, 0, 6.283); c.fill(); c.shadowBlur = 0;
      },
    },
    fireflies: {
      count: 34,
      make: (p, init) => Object.assign(p, { x: rnd(0, W), y: rnd(H * 0.25, H * 0.95), ang: rnd(0, 6.28), sp: rnd(6, 20), s: rnd(1.4, 2.8), ph: rnd(0, 6.28) }),
      step: (p, dt, t) => { p.ang += rnd(-1.2, 1.2) * dt * 2; p.x += Math.cos(p.ang) * p.sp * dt; p.y += Math.sin(p.ang) * p.sp * dt; if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10; if (p.y < H * 0.15) p.y = H * 0.95; if (p.y > H) p.y = H * 0.2; return true; },
      draw: (p, t) => {
        const a = Math.max(0, Math.sin(t * 1.6 + p.ph)) ** 2;
        c.fillStyle = `rgba(255,240,150,${a})`; c.shadowColor = "rgba(255,240,140,0.95)"; c.shadowBlur = 12;
        c.beginPath(); c.arc(p.x, p.y, p.s, 0, 6.283); c.fill(); c.shadowBlur = 0;
      },
    },
    dust: {
      count: 52,
      make: (p, init) => Object.assign(p, { x: rnd(0, W), y: rnd(0, H), vx: rnd(-6, 8), vy: rnd(-4, 6), s: rnd(0.8, 2.2), ph: rnd(0, 6.28), a: rnd(0.15, 0.5) }),
      step: (p, dt, t) => { p.x += (p.vx + Math.sin(t * 0.5 + p.ph) * 5) * dt; p.y += (p.vy + Math.cos(t * 0.4 + p.ph) * 4) * dt; if (p.x < -5) p.x = W + 5; if (p.x > W + 5) p.x = -5; if (p.y < -5) p.y = H + 5; if (p.y > H + 5) p.y = -5; return true; },
      draw: (p, t) => { c.fillStyle = `rgba(255,240,215,${p.a * (0.6 + 0.4 * Math.sin(t + p.ph))})`; c.beginPath(); c.arc(p.x, p.y, p.s, 0, 6.283); c.fill(); },
    },
  };

  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    const t = now / 1000;
    c.clearRect(0, 0, W, H);
    const k = KINDS[type];
    if (!k || !Settings.get("effects")) return;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!k.step(p, dt, t)) k.make(p, false);
      k.draw(p, t);
    }
  }

  function set(t) {
    if (t === type) return;
    type = t && KINDS[t] ? t : null;
    parts = [];
    if (type) {
      const k = KINDS[type];
      for (let i = 0; i < k.count; i++) { const p = {}; k.make(p, true); parts.push(p); }
    }
    c && c.clearRect(0, 0, W, H);
  }

  function boot() {
    canvas = document.getElementById("fx");
    if (!canvas) return;
    c = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  window.VN_FX = { set, resize, boot, KINDS: Object.keys(KINDS) };
})();
