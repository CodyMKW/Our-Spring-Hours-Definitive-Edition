/* ============================================================================
   rt.js — headless runtime for the 3DS port.

   The web version's engine.js drives the DOM. This file is the same interpreter
   (same ops, same snapshots/rollback, same saves) with every DOM call replaced
   by an *event queue* the C host drains:

       Rt.poll() -> [ {t:"bg",...}, {t:"line",...}, ... ]   (and clears the queue)

   The story itself (js/story/*.js, dsl.js, core.js, data.js) runs unmodified.

   Host → runtime calls
       Rt.init()                      load progress from the store
       Rt.titleInfo()                 {latest, bonus, endings:{got,total}, parts:[...]}
       Rt.newGame(part, preset)       preset: undefined | "carry" | a preset id (see core.js PRESETS)
       Rt.loadSlot(slot)  Rt.saveSlot(slot)  Rt.slots()      slot: "auto" | 1..12
       Rt.advance()                   dismiss a line / card / wait
       Rt.choose(i)                   pick menu option i
       Rt.rollback()                  step back one line
       Rt.nextUnread()                true if the next line was never read (for Skip)
       Rt.log()                       backlog [{who,color,text}]
       Rt.ending(kind)                "next" | "bonus" | "undo" | "title"
       Rt.endings()                   gallery rows
       Rt.toTitle()                   leave the story (flushes progress)
       Rt.progress()                  what Blossom Drop needs: {endings:{id:1}, sparedShigaraki}

   Events (all have .t)
       scene   {bg, stage, music, weather, part}       full redraw (after load/rollback/start)
       bg      {name, fast}                            change background (stage is cleared separately)
       stage   {stage:[who...], speaker}               who is on screen (+ who is talking)
       music   {mood}   weather {type}   sfx {name}
       banner  {title, sub}                            chapter title banner
       line    {who, name, color, text, say}           a dialogue / narration line (blocks until advance)
       menu    {options:[text...]}                     choices (blocks until choose)
       card    {part, eyebrow, title, sub, lines[]}    full-screen text card (blocks until advance)
       wait    {ms}                                    pause (blocks until advance)
       shake {strength}  flash {color}  pulse {color}
       toast   {msg}
       ending  {id, title, kind, part, lines[], cast[], fresh, got, total, bg, music, weather, next}
       error   {msg}
   ========================================================================== */
(function () {
  "use strict";
  const { Global, Saves, newState, clone, carryOver, presetState, PRESETS } = window.VN_CORE;
  const D = window.VN_DATA, V = window.VN;
  const PART_NAMES = { 1: "Our Spring Hours", 2: "Ashfall", 3: "Last Light", 4: "The Hundredth Petal" };

  let S = null, hist = [], log = [], curSnap = null, ev = [], curOpts = null, linesSinceSave = 0, linesSinceFlush = 0;
  const mode = { playing: false, ending: false, choosing: false, waiting: false, card: false };
  const emit = (e) => { ev.push(e); };

  /* ------------------------------------------------------------ text helpers */
  function plain(str) {                          // strip *italic* / **bold** markup (the 3DS font has no italics)
    let out = "";
    for (let k = 0; k < str.length; k++) {
      const ch = str[k];
      if (ch === "\\" && str[k + 1] === "*") { out += "*"; k++; continue; }
      if (ch === "*") { if (str[k + 1] === "*") k++; continue; }
      out += ch;
    }
    return out;
  }
  const resolveText = (t) => (typeof t === "function" ? t(S) : t);
  const charName = (who) => (D.CHARACTERS[who] ? D.CHARACTERS[who].name : "");

  /* ------------------------------------------------------------ stage helpers */
  function enter(who) {
    if (!D.CHARACTERS[who]) return;
    const st = S.scene.stage;
    if (st.includes(who)) return;
    if (st.length >= 4) st.shift();
    st.push(who);
  }
  const stageEv = (speaker) => emit({ t: "stage", stage: S.scene.stage.slice(), speaker: speaker || null });
  function sceneEv() {
    const sc = S.scene;
    emit({ t: "scene", bg: sc.bg, stage: sc.stage.slice(), music: sc.music, weather: sc.weather, part: S.part });
  }

  /* ------------------------------------------------------------ snapshots */
  function snapshot() { curSnap = { snap: clone(S), logLen: log.length }; hist.push(curSnap); if (hist.length > 120) hist.shift(); }

  /* ------------------------------------------------------------ saving */
  const resolveText0 = (t, st) => (typeof t === "function" ? t(st) : t);
  function makeSave(snap) {
    const code = V.code[snap.label]; let snippet = "";
    const ins = code && code[snap.idx];
    if (ins && (ins.op === "say" || ins.op === "n")) { try { snippet = plain(resolveText0(ins.text, snap)).slice(0, 60); } catch (e) { snippet = ""; } }
    return { v: 1, savedAt: Date.now(), part: snap.part, chapter: snap.scene.chapter || "", bg: snap.scene.bg, snippet, S: snap, ver: D.VERSION };
  }
  function autosave() { if (!curSnap || mode.ending) return; Saves.write("auto", makeSave(curSnap.snap)); linesSinceSave = 0; }

  /* ------------------------------------------------------------ showing things */
  function showLine(ins, key) {
    const text = plain(resolveText(ins.text));
    const isSay = ins.op === "say" && ins.who && D.CHARACTERS[ins.who];
    if (isSay) { enter(ins.who); S.scene.stage = S.scene.stage.slice(); stageEv(ins.who); } else stageEv(null);
    const def = isSay ? D.CHARACTERS[ins.who] : null;
    log.push({ who: isSay ? def.name : "", color: isSay ? def.color : "", text });
    if (log.length > 200) log.shift();
    S.lines++; linesSinceSave++; linesSinceFlush++;
    Global.markSeen(key);
    emit({ t: "line", who: isSay ? ins.who : "", name: isSay ? def.name : "", color: isSay ? def.color : "", text, say: !!isSay });
    mode.playing = true;
  }

  const TOAST = { ura: "Uraraka will remember that.", fal: "Falcon will remember that.", fri: "Your friends will remember that.", maki: "Maki will remember that.", light: "Light took note of that." };

  function showMenu(ins) {
    curOpts = ins.options.filter(o => !o.props.req || o.props.req(S));
    mode.choosing = true;
    emit({ t: "menu", options: curOpts.map(o => plain(typeof o.label === "function" ? o.label(S) : o.label)) });
    autosave(); Global.flush();
  }

  function choose(i) {
    if (!mode.choosing || !curOpts || !curOpts[i]) return;
    const o = curOpts[i], p = o.props || {};
    emit({ t: "sfx", name: "choice" });
    const fx = Object.assign({}, p.fx || {});
    if (p.aloof) fx.aloof = (fx.aloof || 0) + p.aloof;
    Object.keys(fx).forEach(k => {
      const amt = fx[k];
      if (k === "aloof") S.aloof += amt; else S.stats[k] = (S.stats[k] || 0) + amt;
      if (k !== "aloof" && amt > 0 && TOAST[k]) emit({ t: "toast", msg: TOAST[k] });
    });
    if (p.set) Object.keys(p.set).forEach(k => { S.flags[k] = p.set[k]; });
    log.push({ who: "", color: "", text: "> " + plain(typeof o.label === "function" ? o.label(S) : o.label), choice: true });
    mode.choosing = false; curOpts = null;
    S.label = o.goto; S.idx = 0;
    run();
  }

  /* ------------------------------------------------------------ interpreter */
  function run() {
    mode.playing = true; mode.waiting = false; mode.card = false;
    for (let guard = 0; guard < 5000; guard++) {
      const code = V.code[S.label];
      if (!code) return fatal(`Missing label "${S.label}"`);
      if (S.idx >= code.length) return fatal(`Label "${S.label}" ran off its end`);
      const ins = code[S.idx], key = S.label + ":" + S.idx;
      switch (ins.op) {
        case "say": case "n": snapshot(); S.idx++; showLine(ins, key); if (linesSinceSave >= 14) autosave(); if (linesSinceFlush >= 30) { Global.flush(); linesSinceFlush = 0; } return;
        case "menu": snapshot(); showMenu(ins); return;
        case "jump": S.label = ins.to; S.idx = 0; continue;
        case "branch": S.label = ins.cond(S) ? ins.then : ins.else; S.idx = 0; continue;
        case "route": S.label = ins.f(S); S.idx = 0; continue;
        case "bg": S.idx++; if (!ins.keep) { S.scene.stage = []; stageEv(null); } S.scene.bg = ins.name; Global.unlockBg(ins.name); emit({ t: "bg", name: ins.name, fast: !!ins.fast }); continue;
        case "music": S.idx++; S.scene.music = ins.mood; emit({ t: "music", mood: ins.mood }); continue;
        case "weather": S.idx++; S.scene.weather = ins.type; emit({ t: "weather", type: ins.type }); continue;
        case "enter": S.idx++; enter(ins.who); stageEv(null); continue;
        case "exit": S.idx++; S.scene.stage = S.scene.stage.filter(w => w !== ins.who); stageEv(null); continue;
        case "stage": S.idx++; S.scene.stage = ins.who.slice(); stageEv(null); continue;
        case "chapter": {
          S.scene.chapter = ins.title + (ins.sub ? " — " + ins.sub : "");
          const chSnap = clone(S);                 // idx still points at this op, so a reload re-shows the banner
          S.idx++;
          emit({ t: "banner", title: ins.title, sub: ins.sub || "" }); emit({ t: "sfx", name: "chapter" });
          if (!mode.ending) { Saves.write("auto", makeSave(chSnap)); Global.flush(); }
          continue;
        }
        case "card": {
          S.idx++;
          if (ins.bg) { S.scene.bg = ins.bg; Global.unlockBg(ins.bg); emit({ t: "bg", name: ins.bg, fast: false }); }
          const c = { t: "card", part: ins.part || 0, eyebrow: ins.part ? (ins.eyebrow || ("Part " + ["", "I", "II", "III", "IV"][ins.part])) : "", title: ins.title || "", sub: ins.sub || "", hold: ins.hold || 0, lines: (ins.lines || []).map(l => plain(resolveText(l))) };
          mode.card = true; emit(c); return;
        }
        case "shake": S.idx++; emit({ t: "shake", strength: ins.strength || 1 }); emit({ t: "sfx", name: "hit" }); continue;
        case "flash": S.idx++; emit({ t: "flash", color: ins.color }); continue;
        case "pulse": S.idx++; emit({ t: "pulse", color: ins.color }); emit({ t: "sfx", name: "alert" }); continue;
        case "wait": S.idx++; mode.waiting = true; emit({ t: "wait", ms: ins.ms }); return;
        case "sfx": S.idx++; emit({ t: "sfx", name: ins.name }); continue;
        case "add": S.idx++; if (ins.stat === "aloof") S.aloof += ins.amt; else S.stats[ins.stat] = (S.stats[ins.stat] || 0) + ins.amt; continue;
        case "set": S.idx++; S.flags[ins.flag] = ins.val; continue;
        case "kill": S.idx++; S.dead[ins.who] = true; continue;
        case "fn": S.idx++; ins.f(S, api); continue;
        case "end": S.idx++; showEnding(ins.id); return;
        default: return fatal("Unknown op " + ins.op);
      }
    }
    fatal("Story loop did not stop (possible infinite loop)");
  }
  function fatal(msg) { emit({ t: "error", msg }); mode.playing = false; }
  const api = { S: () => S };

  /* ------------------------------------------------------------ endings */
  const bonusUnlocked = () => [1, 2, 3].every(p => Object.keys(Global.d.endings).some(id => V.endingsDef[id] && V.endingsDef[id].part === p));
  const totals = () => { const all = Object.keys(V.endingsDef); return { got: all.filter(id => Global.d.endings[id]).length, total: all.length }; };

  function showEnding(id) {
    const def = V.endingsDef[id];
    mode.ending = true; mode.playing = false;
    S.hist["p" + def.part] = id;
    const fresh = Global.unlockEnding(id);
    Global.d.carry[def.part] = clone(S);
    Global.save();
    const cast = [];
    if (def.part === 3) {
      ["joseph", "cementoss", "falcon", "maki", "uraraka"].forEach(k => cast.push({ name: D.CHARACTERS[k].name, ok: !S.dead[k], text: S.dead[k] ? "Lost at the battlegrounds" : "Alive" }));
      cast.push({ name: "Light Yagami", ok: true, text: ({ renounced: "Gave up the notebook for good", weaponized: "Still keeping his ledger", sidelined: "Walking his own path now" })[S.flags.lightPath] || "Unresolved, watching from the Hideout" });
    }
    const t = totals();
    emit({
      t: "ending", id, title: def.title, kind: def.kind, part: def.part, partName: PART_NAMES[def.part], hint: def.hint || "", fresh, got: t.got, total: t.total,
      lines: def.lines.map(l => (typeof l === "function" ? l(S) : l)).filter(Boolean).map(plain), cast,
      bg: def.bg, music: def.music, weather: def.weather || null,
      next: def.part < 3 ? "part" : (def.part === 3 && bonusUnlocked() ? "bonus" : "credits"),
    });
    Saves.clear("auto");
  }

  /* ------------------------------------------------------------ game start / load */
  function startFromState(state) {
    S = state; hist = []; log = []; curSnap = null; curOpts = null;
    mode.ending = false; mode.card = false; mode.choosing = false; mode.waiting = false;
    Global.d.plays++;
    sceneEv();
    run();
  }

  /* ------------------------------------------------------------ public API */
  const Rt = {
    init() { Global.load(); return true; },
    poll() { const out = ev; ev = []; return out; },
    pending: () => ev.length,
    state: () => mode,

    titleInfo() {
      const latest = Saves.latest();
      const parts = [1, 2, 3].map(p => ({
        n: p, name: PART_NAMES[p],
        unlocked: p === 1 || !!Global.d.carry[p - 1] || Object.keys(Global.d.endings).some(id => V.endingsDef[id] && V.endingsDef[id].part === p - 1),
        carry: !!Global.d.carry[p - 1],
        presets: (PRESETS[p] || []).map(x => ({ id: x.id, title: x.title })),
      }));
      return {
        latest: latest ? { slot: String(latest.slot), part: latest.data.part, chapter: latest.data.chapter || "", snippet: latest.data.snippet || "" } : null,
        bonus: bonusUnlocked(), endings: totals(), parts,
      };
    },
    newGame(part, preset) {
      let st;
      if (preset === "carry") { const c = Global.d.carry[part - 1]; st = c ? carryOver(clone(c), part) : newState(part); }
      else if (preset) st = presetState(part, preset);
      else st = newState(part);
      st.label = "p" + part + "_start";
      startFromState(st);
    },
    loadSlot(slot) {
      const sv = Saves.read(slot === "auto" ? "auto" : +slot);
      if (!sv || !sv.S) return false;
      startFromState(clone(sv.S)); return true;
    },
    saveSlot(slot) {
      if (!curSnap || mode.ending || !mode.playing) return false;
      return !!Saves.write(slot === "auto" ? "auto" : +slot, makeSave(curSnap.snap));
    },
    slots() {
      const out = [];
      ["auto", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].forEach(k => {
        const s = Saves.read(k);
        out.push(s ? { slot: String(k), part: s.part, chapter: s.chapter || "", snippet: s.snippet || "", savedAt: s.savedAt || 0 } : { slot: String(k), empty: true });
      });
      return out;
    },
    advance() {
      if (mode.ending || mode.choosing || !mode.playing) return;
      run();
    },
    choose,
    rollback() {
      if (mode.ending || mode.card || hist.length < 2) return false;
      hist.pop(); const prev = hist.pop();
      S = clone(prev.snap); log.length = Math.max(0, prev.logLen); curOpts = null; mode.choosing = false;
      sceneEv(); run(); return true;
    },
    nextUnread() {
      let lbl = S.label, j = S.idx, guard = 0;
      while (guard++ < 80) {
        const c = V.code[lbl], ins = c && c[j];
        if (!ins) return false;
        if (ins.op === "say" || ins.op === "n") return !Global.isSeen(lbl + ":" + j);
        if (ins.op === "menu" || ins.op === "end") return true;
        if (ins.op === "jump") { lbl = ins.to; j = 0; continue; }
        if (ins.op === "branch") { lbl = ins.cond(S) ? ins.then : ins.else; j = 0; continue; }
        if (ins.op === "route") { lbl = ins.f(S); j = 0; continue; }
        j++;
      }
      return false;
    },
    log: () => log.slice(-60),
    canSave: () => !!curSnap && !mode.ending && mode.playing,
    ending(kind) {
      if (!mode.ending) return false;
      const part = S.part;
      if (kind === "next") { startFromState(carryOver(clone(S), part + 1)); S.label = "p" + (part + 1) + "_start"; return true; }
      if (kind === "bonus") { Rt.newGame(4, "carry"); return true; }
      if (kind === "undo") {
        const prev = hist.pop(); if (!prev) return false;
        mode.ending = false; S = clone(prev.snap); log.length = Math.max(0, prev.logLen); curOpts = null; sceneEv(); run(); return true;
      }
      return false;
    },
    endings() {
      return Object.keys(V.endingsDef).map(id => { const d = V.endingsDef[id]; return { id, title: d.title, part: d.part, kind: d.kind, hint: d.hint || "", got: !!Global.d.endings[id] }; });
    },
    toTitle() { Global.flush(); mode.playing = false; mode.ending = false; mode.choosing = false; mode.card = false; mode.waiting = false; return true; },
    /* what Blossom Drop (the minigame) reads — same rules as blossom/js/data.js */
    progress() {
      const f = (Global.d.carry[2] && Global.d.carry[2].flags) || {};
      return { endings: Object.keys(Global.d.endings), sparedShigaraki: !!f.sparedShigaraki };
    },
    partName: (p) => PART_NAMES[p] || "",
  };
  window.Rt = Rt;
})();
