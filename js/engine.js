/* ============================================================================
   engine.js — the runtime. Interprets the compiled story (VN.code), drives the
   stage (background, sprites, weather, dialogue box, choices), and owns saving,
   rollback, auto/skip, and the ending screens.

   Public surface (window.Game) is used by ui.js / main.js and by the tests.
   ========================================================================== */
(function () {
  "use strict";
  const { Settings, Global, Saves, newState, clone, carryOver, presetState } = window.VN_CORE;
  const D = window.VN_DATA;
  const V = window.VN;
  const A = window.VN_AUDIO;
  const FX = window.VN_FX;

  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const TEST = /[?&]test=1/.test(location.search);

  /* ----------------------------------------------------------------- runtime vars */
  let S = null;                 // current game state (see core.js newState)
  let runId = 0;                // invalidates stale async loops (rollback / load)
  let hist = [];                // rollback snapshots {snap, logLen}
  let log = [];                 // backlog entries {who, text}
  let curSnap = null;           // snapshot of the line/menu currently on screen
  const mode = { playing: false, typing: false, choosing: false, auto: false, skip: false, hidden: false, card: false, ending: false, locked: false, modal: false };
  let typeRaf = 0, autoTimer = 0, skipTimer = 0, cardResolve = null, bannerTimer = 0, linesSinceSave = 0;
  let fullText = "";
  let curBgIdx = 0;

  const els = {};
  function grab() {
    ["app", "stage", "bgA", "bgB", "sprites", "tint", "dialog", "nameplate", "text", "more", "choices", "banner", "toasts",
     "card", "cardInner", "ending", "clickzone", "hud"].forEach(id => els[id] = $(id));
  }

  /* ------------------------------------------------------------------ small helpers */
  const eff = () => Settings.get("effects");
  const speeds = [26, 52, 105, 1e9];
  const charName = (who) => (D.CHARACTERS[who] ? D.CHARACTERS[who].name : "");

  function parseMarkup(str) {
    // *italic*  **bold**  — returns [{c, i, b}]
    const out = [];
    let i = false, b = false;
    for (let k = 0; k < str.length; k++) {
      const ch = str[k];
      if (ch === "\\" && str[k + 1] === "*") { out.push({ c: "*", i, b }); k++; continue; }
      if (ch === "*") {
        if (str[k + 1] === "*") { b = !b; k++; } else { i = !i; }
        continue;
      }
      out.push({ c: ch, i, b });
    }
    return out;
  }
  const plain = (str) => parseMarkup(str).map(x => x.c).join("");

  /* readable nameplate text colour for a given background hex */
  function textOn(hex) {
    const n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? "#1a1520" : "#ffffff";
  }

  function resolveText(t) { return typeof t === "function" ? t(S) : t; }

  /* ------------------------------------------------------------------ background */
  function preload(url) {
    return new Promise(res => { const im = new Image(); im.onload = im.onerror = () => res(); im.src = url; setTimeout(res, 1800); });
  }

  async function setBg(name, opts) {
    opts = opts || {};
    const def = D.BACKGROUNDS[name];
    if (!def) { console.warn("unknown bg", name); return; }
    const url = D.BG_DIR + def.file;
    if (S) S.scene.bg = name;
    Global.unlockBg(name);
    await preload(url);
    const front = curBgIdx === 0 ? els.bgA : els.bgB;
    const back = curBgIdx === 0 ? els.bgB : els.bgA;
    if (front.dataset.name === name) return;
    back.style.backgroundImage = `url("${url}")`;
    back.dataset.name = name;
    back.style.transition = (opts.fast || TEST) ? "none" : "opacity 900ms ease";
    front.style.transition = (opts.fast || TEST) ? "none" : "opacity 900ms ease";
    back.classList.remove("kb"); void back.offsetWidth;
    if (Settings.get("kenBurns")) back.classList.add("kb");
    back.style.opacity = 1;
    front.style.opacity = 0;
    curBgIdx = curBgIdx === 0 ? 1 : 0;
  }

  /* ------------------------------------------------------------------ stage / sprites */
  const POS = { 1: [50], 2: [31, 69], 3: [19, 50, 81], 4: [13, 38, 62, 87] };

  function layoutStage(speaker, instant) {
    const stage = S.scene.stage;
    const pos = POS[Math.min(stage.length, 4)] || [];
    const have = {};
    [...els.sprites.children].forEach(n => { have[n.dataset.who] = n; });
    // remove sprites no longer on stage
    Object.keys(have).forEach(w => {
      if (!stage.includes(w)) {
        const n = have[w];
        n.classList.remove("in");
        n.classList.add("out");
        setTimeout(() => n.remove(), instant ? 0 : 380);
        delete have[w];
      }
    });
    stage.forEach((w, i) => {
      let n = have[w];
      const def = D.CHARACTERS[w];
      if (!def) return;
      if (!n) {
        n = document.createElement("div");
        n.className = "spr";
        n.dataset.who = w;
        const img = document.createElement("img");
        img.src = def.img; img.alt = def.name; img.draggable = false;
        n.appendChild(img);
        n.style.setProperty("--h", def.h + "vh");
        n.style.left = pos[i] + "%";
        els.sprites.appendChild(n);
        void n.offsetWidth;
        n.classList.add("in");
      }
      n.style.left = pos[i] + "%";
      n.classList.toggle("speaking", w === speaker);
      n.classList.toggle("dim", !!speaker && w !== speaker);
    });
  }

  function enter(who) {
    if (!D.CHARACTERS[who]) return;
    const st = S.scene.stage;
    if (st.includes(who)) return;
    if (st.length >= 4) st.shift();
    st.push(who);
  }

  /* ------------------------------------------------------------------ scene restore */
  async function restoreScene() {
    const sc = S.scene;
    els.sprites.innerHTML = "";
    els.bgA.dataset.name = els.bgB.dataset.name = "";
    els.bgA.style.opacity = els.bgB.style.opacity = 0;
    curBgIdx = 0;
    if (sc.bg) await setBg(sc.bg, { fast: true });
    layoutStage(null, true);
    A.play(sc.music);
    FX.set(sc.weather);
    els.app.dataset.part = S.part;
  }

  /* ------------------------------------------------------------------ typewriter */
  function buildText(str) {
    els.text.innerHTML = "";
    const chars = parseMarkup(str);
    const frag = document.createDocumentFragment();
    const spans = chars.map(ch => {
      const s = document.createElement("span");
      s.className = "c" + (ch.i ? " i" : "") + (ch.b ? " b" : "");
      s.textContent = ch.c;
      frag.appendChild(s);
      return s;
    });
    els.text.appendChild(frag);
    return { spans, chars };
  }

  function typeLine(str, done) {
    cancelAnimationFrame(typeRaf);
    const { spans, chars } = buildText(str);
    fullText = str;
    mode.typing = true;
    els.more.classList.remove("on");
    let shown = 0, acc = 0, last = performance.now(), pause = 0;
    const cps = speeds[Settings.get("textSpeed")];
    const finish = () => {
      spans.forEach(s => s.classList.add("on"));
      mode.typing = false;
      els.more.classList.add("on");
      typeRaf = 0;
      done && done();
    };
    if (cps > 1e8 || mode.skip) { finish(); typeLine._finish = null; return; }
    typeLine._finish = () => { cancelAnimationFrame(typeRaf); finish(); typeLine._finish = null; };
    const tick = (now) => {
      const dt = now - last; last = now;
      if (pause > 0) { pause -= dt; }
      else {
        acc += dt / 1000 * cps;
        while (acc >= 1 && shown < spans.length) {
          const ch = chars[shown].c;
          spans[shown].classList.add("on");
          shown++; acc -= 1;
          if (".!?…".includes(ch)) { pause = 190; acc = 0; break; }
          if (",;—:".includes(ch)) { pause = 85; acc = 0; break; }
        }
      }
      if (shown >= spans.length) { typeLine._finish = null; finish(); return; }
      typeRaf = requestAnimationFrame(tick);
    };
    typeRaf = requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------------ showing a line */
  function showLine(ins, key) {
    const text = resolveText(ins.text);
    const isSay = ins.op === "say" && ins.who && D.CHARACTERS[ins.who];
    // dialogue box
    els.dialog.classList.remove("hide-box");
    els.dialog.classList.toggle("narration", !isSay);
    if (isSay) {
      const def = D.CHARACTERS[ins.who];
      els.nameplate.textContent = def.name;
      els.nameplate.style.setProperty("--c", def.color);
      els.nameplate.style.setProperty("--ct", textOn(def.color));
      els.nameplate.classList.add("on");
      enter(ins.who);
      layoutStage(ins.who);
      S.scene.stage = S.scene.stage.slice();
    } else {
      els.nameplate.classList.remove("on");
      layoutStage(null);
    }
    log.push({ who: isSay ? charName(ins.who) : "", color: isSay ? D.CHARACTERS[ins.who].color : "", text: plain(text) });
    if (log.length > 400) log.shift();
    S.lines++;
    linesSinceSave++;
    Global.markSeen(key);
    typeLine(text, onLineDone);
    mode.playing = true;
    els.app.classList.add("playing");
  }

  function onLineDone() {
    clearTimeout(autoTimer);
    if (mode.skip) {
      clearTimeout(skipTimer);
      skipTimer = setTimeout(() => { if (mode.skip && !mode.choosing && !mode.modal) advance(true); }, 55);
      return;
    }
    if (mode.auto) {
      const base = [1100, 1900, 3000][Settings.get("autoDelay")];
      const ms = base + fullText.length * 34;
      autoTimer = setTimeout(() => { if (mode.auto && !mode.choosing && !mode.modal) advance(true); }, TEST ? 30 : ms);
    }
  }

  /* ------------------------------------------------------------------ snapshots / rollback */
  function snapshot(extra) {
    curSnap = { snap: clone(S), logLen: log.length, extra: extra || null };
    hist.push(curSnap);
    if (hist.length > 120) hist.shift();
  }

  function rollback() {
    if (mode.ending || mode.modal || mode.card || hist.length < 2) return;
    // 1) drop the snapshot for what's currently on screen; 2) restore the one before
    hist.pop();
    const prev = hist.pop();
    stopSkipAuto();
    S = clone(prev.snap);
    log.length = Math.max(0, prev.logLen);
    clearChoices();
    runId++;
    restoreScene().then(() => run());
  }

  /* ------------------------------------------------------------------ choices */
  const TOAST = {
    ura: () => "Uraraka will remember that.",
    fal: () => "Falcon will remember that.",
    fri: () => "Your friends will remember that.",
    maki: () => "Maki will remember that.",
    light: () => "Light took note of that.",
  };

  function toast(msg) {
    if (!Settings.get("toasts") || TEST) return;
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    els.toasts.appendChild(t);
    setTimeout(() => t.classList.add("on"), 20);
    setTimeout(() => { t.classList.remove("on"); setTimeout(() => t.remove(), 500); }, 2600);
  }

  function clearChoices() {
    els.choices.classList.remove("on");
    els.choices.innerHTML = "";
    els.app.classList.remove("choosing");
    mode.choosing = false;
  }

  function showMenu(ins) {
    const opts = ins.options.filter(o => !o.props.req || o.props.req(S));
    mode.choosing = true;
    stopSkipAuto();
    els.app.classList.add("choosing");
    els.choices.innerHTML = "";
    opts.forEach((o, i) => {
      const b = document.createElement("button");
      b.className = "choice";
      b.type = "button";
      const num = document.createElement("span");
      num.className = "num"; num.textContent = String(i + 1);
      const txt = document.createElement("span");
      txt.className = "ctext"; txt.textContent = plain(typeof o.label === "function" ? o.label(S) : o.label);
      b.append(num, txt);
      b.onclick = () => choose(i);
      els.choices.appendChild(b);
    });
    els.choices._opts = opts;
    requestAnimationFrame(() => els.choices.classList.add("on"));
    autosave();
  }

  function choose(i) {
    const opts = els.choices._opts;
    if (!opts || !opts[i] || !mode.choosing) return;
    const o = opts[i];
    A.sfx("choice");
    const p = o.props || {};
    const fx = Object.assign({}, p.fx || {});
    if (p.aloof) fx.aloof = (fx.aloof || 0) + p.aloof;
    Object.keys(fx).forEach(k => {
      const amt = fx[k];
      if (k === "aloof") S.aloof += amt; else S.stats[k] = (S.stats[k] || 0) + amt;
      if (k !== "aloof" && amt > 0 && TOAST[k]) toast(TOAST[k]());
    });
    if (p.set) Object.keys(p.set).forEach(k => { S.flags[k] = p.set[k]; });
    log.push({ who: "", color: "", text: "▸ " + plain(typeof o.label === "function" ? o.label(S) : o.label), choice: true });
    clearChoices();
    S.label = o.goto; S.idx = 0;
    run();
  }

  /* ------------------------------------------------------------------ cards / banner */
  function showBanner(title, sub) {
    clearTimeout(bannerTimer);
    els.banner.innerHTML = "";
    const a = document.createElement("div"); a.className = "bt"; a.textContent = title;
    els.banner.appendChild(a);
    if (sub) { const b = document.createElement("div"); b.className = "bs"; b.textContent = sub; els.banner.appendChild(b); }
    els.banner.classList.add("on");
    A.sfx("chapter");
    bannerTimer = setTimeout(() => els.banner.classList.remove("on"), 3600);
  }

  async function showCard(ins) {
    mode.card = true;
    stopSkipAuto();
    els.dialog.classList.add("hide-box");
    els.sprites.classList.add("faded");
    els.cardInner.innerHTML = "";
    els.card.className = "on" + (ins.part ? " part" : "");
    if (ins.part) {
      const e = document.createElement("div"); e.className = "cp-eyebrow"; e.textContent = ins.eyebrow || ("Part " + ["", "I", "II", "III"][ins.part]);
      const t = document.createElement("h1"); t.className = "cp-title"; t.textContent = ins.title || "";
      const s = document.createElement("div"); s.className = "cp-sub"; s.textContent = ins.sub || "";
      els.cardInner.append(e, t, s);
      await waitCard(ins.hold || 4200);
    } else {
      for (const line of ins.lines) {
        els.cardInner.innerHTML = "";
        const p = document.createElement("p"); p.className = "cl"; p.textContent = resolveText(line);
        els.cardInner.appendChild(p);
        requestAnimationFrame(() => p.classList.add("on"));
        await waitCard(2800 + resolveText(line).length * 28);
        p.classList.remove("on");
        await sleep(TEST ? 0 : 450);
      }
    }
    els.card.className = "";
    els.sprites.classList.remove("faded");
    mode.card = false;
    await sleep(TEST ? 0 : 500);
  }

  function waitCard(ms) {
    return new Promise(res => {
      let done = false;
      const fin = () => { if (done) return; done = true; cardResolve = null; clearTimeout(t); res(); };
      const t = setTimeout(fin, TEST ? 10 : (mode.skip ? 200 : ms));
      cardResolve = fin;
    });
  }

  /* ------------------------------------------------------------------ interpreter */
  async function run() {
    const my = ++runId;
    mode.playing = true;
    while (my === runId) {
      const code = V.code[S.label];
      if (!code) { fatal(`Missing label "${S.label}"`); return; }
      if (S.idx >= code.length) { fatal(`Label "${S.label}" ran off its end`); return; }
      const ins = code[S.idx];
      const key = S.label + ":" + S.idx;
      switch (ins.op) {
        case "say":
        case "n":
          snapshot();
          S.idx++;
          showLine(ins, key);
          maybeAutosave();
          return;
        case "menu":
          snapshot();
          showMenu(ins);
          return;
        case "jump": S.label = ins.to; S.idx = 0; continue;
        case "branch": S.label = ins.cond(S) ? ins.then : ins.else; S.idx = 0; continue;
        case "route": S.label = ins.f(S); S.idx = 0; continue;
        case "bg":
          S.idx++;
          if (!ins.keep) { S.scene.stage = []; layoutStage(null); }
          await setBg(ins.name, { fast: ins.fast });
          continue;
        case "music": S.idx++; S.scene.music = ins.mood; A.play(ins.mood); continue;
        case "weather": S.idx++; S.scene.weather = ins.type; FX.set(ins.type); continue;
        case "enter": S.idx++; enter(ins.who); layoutStage(null); continue;
        case "exit": S.idx++; S.scene.stage = S.scene.stage.filter(w => w !== ins.who); layoutStage(null); continue;
        case "stage": S.idx++; S.scene.stage = ins.who.slice(); layoutStage(null); continue;
        case "chapter": {
          S.scene.chapter = ins.title + (ins.sub ? " — " + ins.sub : "");
          const chSnap = clone(S);                 // idx still points at this op, so a reload re-shows the banner
          S.idx++;
          showBanner(ins.title, ins.sub);
          if (!mode.ending) Saves.write("auto", makeSave(chSnap));
          continue;
        }
        case "card":
          S.idx++;
          if (ins.bg) await setBg(ins.bg, { fast: false });
          await showCard(ins);
          if (my !== runId) return;
          continue;
        case "shake": S.idx++; if (eff() && Settings.get("effects")) doShake(ins.strength); continue;
        case "flash": S.idx++; if (eff()) doFlash(ins.color); continue;
        case "pulse": S.idx++; if (eff()) doPulse(ins.color); continue;
        case "wait": S.idx++; await sleep(TEST || mode.skip ? 10 : ins.ms); continue;
        case "sfx": S.idx++; A.sfx(ins.name); continue;
        case "add":
          S.idx++;
          if (ins.stat === "aloof") S.aloof += ins.amt; else S.stats[ins.stat] = (S.stats[ins.stat] || 0) + ins.amt;
          continue;
        case "set": S.idx++; S.flags[ins.flag] = ins.val; continue;
        case "kill": S.idx++; S.dead[ins.who] = true; continue;
        case "fn": S.idx++; ins.f(S, api); continue;
        case "end": S.idx++; await showEnding(ins.id); return;
        default: fatal("Unknown op " + ins.op); return;
      }
    }
  }

  function fatal(msg) {
    console.error("[VN]", msg);
    els.nameplate.classList.remove("on");
    typeLine("⚠ Story error: " + msg + " — press Esc and choose Title to recover.", null);
  }

  /* ------------------------------------------------------------------ visual FX */
  function doShake(s) {
    if (!Settings.get("effects")) return;
    els.stage.classList.remove("shake"); void els.stage.offsetWidth;
    els.stage.style.setProperty("--shake", (s || 1) * 9 + "px");
    els.stage.classList.add("shake");
    A.sfx("hit");
    setTimeout(() => els.stage.classList.remove("shake"), 650);
  }
  function doFlash(color) {
    els.tint.style.background = color;
    els.tint.classList.remove("flash"); void els.tint.offsetWidth;
    els.tint.classList.add("flash");
  }
  function doPulse(color) {
    els.tint.style.background = `radial-gradient(ellipse at center, transparent 35%, ${color} 130%)`;
    els.tint.classList.remove("pulse"); void els.tint.offsetWidth;
    els.tint.classList.add("pulse");
    A.sfx("alert");
  }

  /* ------------------------------------------------------------------ advance / auto / skip */
  /* Skip mode only runs over text that has been read before (unless the
     "skip unread" setting is on). Looks ahead to the next blocking line. */
  function nextLineUnread() {
    let lbl = S.label, j = S.idx, guard = 0;
    while (guard++ < 80) {
      const c = V.code[lbl];
      const ins = c && c[j];
      if (!ins) return false;
      if (ins.op === "say" || ins.op === "n") return !Global.isSeen(lbl + ":" + j);
      if (ins.op === "menu" || ins.op === "end") return true;
      if (ins.op === "jump") { lbl = ins.to; j = 0; continue; }
      if (ins.op === "branch") { lbl = ins.cond(S) ? ins.then : ins.else; j = 0; continue; }
      if (ins.op === "route") { lbl = ins.f(S); j = 0; continue; }
      j++;
    }
    return false;
  }

  function advance(fromTimer) {
    if (mode.modal || mode.ending) return;
    if (mode.card) { cardResolve && cardResolve(); return; }
    if (mode.hidden) { setHidden(false); return; }
    if (mode.choosing) return;
    if (!mode.playing) return;
    if (mode.typing) {
      if (typeLine._finish) typeLine._finish();
      return;
    }
    if (mode.skip && fromTimer && !Settings.get("skipUnread") && nextLineUnread()) { stopSkip(); return; }
    if (!fromTimer) { stopAuto(); A.sfx("click"); }
    run();
  }

  function stopAuto() { mode.auto = false; clearTimeout(autoTimer); syncHud(); }
  function stopSkip() { mode.skip = false; clearTimeout(skipTimer); syncHud(); }
  function stopSkipAuto() { mode.auto = false; mode.skip = false; clearTimeout(autoTimer); clearTimeout(skipTimer); syncHud(); }

  function toggleAuto() {
    if (!mode.playing || mode.ending) return;
    mode.auto = !mode.auto;
    if (mode.auto) mode.skip = false;
    syncHud();
    if (mode.auto && !mode.typing && !mode.choosing) onLineDone();
  }
  function toggleSkip() {
    if (!mode.playing || mode.ending) return;
    mode.skip = !mode.skip;
    if (mode.skip) mode.auto = false;
    syncHud();
    if (mode.skip) { if (mode.typing && typeLine._finish) typeLine._finish(); else if (!mode.choosing) onLineDone(); }
  }

  function setHidden(h) {
    mode.hidden = h;
    els.app.classList.toggle("ui-hidden", h);
  }

  function syncHud() {
    const a = document.querySelector('[data-act="auto"]'), s = document.querySelector('[data-act="skip"]');
    a && a.classList.toggle("active", mode.auto);
    s && s.classList.toggle("active", mode.skip);
  }

  /* ------------------------------------------------------------------ saving */
  function autosave() {
    if (!curSnap || mode.ending) return;
    Saves.write("auto", makeSave(curSnap.snap));
    linesSinceSave = 0;
  }
  function maybeAutosave() { if (linesSinceSave >= 14) autosave(); }

  function makeSave(snap) {
    const code = V.code[snap.label];
    let snippet = "";
    const ins = code && code[snap.idx];
    if (ins && (ins.op === "say" || ins.op === "n")) { try { snippet = plain(resolveText0(ins.text, snap)).slice(0, 90); } catch (e) { snippet = ""; } }
    return { v: 1, savedAt: Date.now(), part: snap.part, chapter: snap.scene.chapter || "", bg: snap.scene.bg, snippet, S: snap, ver: D.VERSION };
  }
  const resolveText0 = (t, st) => typeof t === "function" ? t(st) : t;

  function saveTo(slot) {
    if (!curSnap || mode.ending) return false;
    const ok = Saves.write(slot, makeSave(curSnap.snap));
    return ok;
  }

  async function loadFrom(slot) {
    const sv = Saves.read(slot);
    if (!sv || !sv.S) return false;
    startFromState(clone(sv.S), true);
    return true;
  }

  /* ------------------------------------------------------------------ game start */
  async function startFromState(state, fromLoad) {
    stopSkipAuto();
    runId++;
    S = state;
    hist = []; log = []; curSnap = null;
    mode.ending = false; mode.card = false; mode.hidden = false; mode.modal = false;
    els.ending.className = "";
    els.card.className = "";
    els.app.classList.remove("ui-hidden", "choosing");
    els.app.classList.add("in-game");
    els.app.classList.remove("on-title");
    window.VN_UI && window.VN_UI.closeAll();
    clearChoices();
    Global.d.plays++;
    await restoreScene();
    els.dialog.classList.remove("hide-box");
    run();
  }

  function newGame(part, preset) {
    let st;
    if (preset === "carry") {
      const prevPart = part - 1;
      const c = Global.d.carry[prevPart];
      st = c ? carryOver(clone(c), part) : newState(part);
    } else if (preset) st = presetState(part, preset);
    else st = newState(part);
    st.label = "p" + part + "_start";
    startFromState(st, false);
  }

  /* ------------------------------------------------------------------ endings */
  async function showEnding(id) {
    const def = V.endingsDef[id];
    mode.ending = true; mode.playing = false;
    stopSkipAuto();
    clearChoices();
    S.hist["p" + def.part] = id;
    const fresh = Global.unlockEnding(id);
    Global.d.carry[def.part] = clone(S);
    Global.save();
    els.dialog.classList.add("hide-box");
    els.sprites.classList.add("faded");
    A.play(def.music);
    FX.set(def.weather || null);
    await setBg(def.bg);
    window.VN_UI.renderEnding(def, S, fresh);
    els.ending.className = "on";
    Saves.clear("auto");
  }

  /* ------------------------------------------------------------------ misc API */
  function toTitle() {
    stopSkipAuto();
    runId++;
    mode.playing = false; mode.ending = false; mode.card = false; mode.modal = false;
    els.ending.className = "";
    els.card.className = "";
    els.sprites.classList.remove("faded");
    clearChoices();
    els.app.classList.remove("in-game", "playing", "ui-hidden");
    els.app.classList.add("on-title");
    els.app.dataset.part = 1;
    window.VN_UI.showTitle();
  }

  /* "Try a different choice" on the ending screen: step back to the last line/menu. */
  function undoEnding() {
    if (!mode.ending) return;
    const prev = hist.pop();
    if (!prev) return;
    mode.ending = false;
    els.ending.className = "";
    els.sprites.classList.remove("faded");
    S = clone(prev.snap);
    log.length = Math.max(0, prev.logLen);
    clearChoices();
    runId++;
    restoreScene().then(() => { els.dialog.classList.remove("hide-box"); run(); });
  }

  function pauseState(on) { mode.modal = on; if (on) stopSkipAuto(); }

  const api = {
    get S() { return S; },
    get log() { return log; },
    mode,
    newGame, startFromState, loadFrom, saveTo, autosave, toTitle, advance: (...a) => advance(...a), rollback, choose,
    toggleAuto, toggleSkip, setHidden, pauseState, undoEnding, showBanner, setBg, restoreScene, grab,
    canSave: () => !!curSnap && !mode.ending && mode.playing,
    stopAuto, stopSkip,
    TEST,
  };
  window.Game = api;
})();
