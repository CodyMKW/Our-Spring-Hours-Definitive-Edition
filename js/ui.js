/* ============================================================================
   ui.js — everything that isn't the stage itself: title screen, pause menu,
   save/load, options, backlog, bonds, gallery, chapter select, credits and the
   ending screens. Plain DOM, no framework.
   ========================================================================== */
(function () {
  "use strict";
  const { Settings, Global, Saves, Store, carryOver, clone, newState, PRESETS, importLegacy } = window.VN_CORE;
  const D = window.VN_DATA;
  const V = window.VN;
  const A = window.VN_AUDIO;
  const FX = window.VN_FX;
  const G = () => window.Game;

  const $ = (id) => document.getElementById(id);

  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    Object.keys(props || {}).forEach(k => {
      const v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    });
    kids.flat(Infinity).forEach(c => {
      if (c === null || c === undefined || c === false) return;
      e.append(c.nodeType ? c : document.createTextNode(String(c)));
    });
    return e;
  }
  const btn = (label, onclick, cls, extra) => h("button", Object.assign({ type: "button", class: cls || "btn", onclick }, extra || {}), label);

  const PART_NAMES = { 1: "Our Spring Hours", 2: "Ashfall", 3: "Last Light", 4: "The Hundredth Petal" };
  const ROMAN = ["", "I", "II", "III", "IV"];
  const partTag = (p) => p === 4 ? "Bonus" : "Part " + ROMAN[p];
  const bonusUnlocked = () => [1, 2, 3].every(p => Object.keys(Global.d.endings).some(id => V.endingsDef[id] && V.endingsDef[id].part === p));
  const fmtDate = (t) => { const d = new Date(t); return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); };

  /* ================================================================== MODAL */
  let modalStack = [];
  let modalFrom = null;

  function modalEl() { return $("modalCard"); }

  function openModal(title, body, opts) {
    opts = opts || {};
    const card = modalEl();
    card.innerHTML = "";
    card.dataset.wide = opts.wide ? "1" : "";
    const closeFn = opts.onClose || (() => closeAll());
    const head = h("div", { class: "m-head" },
      opts.back ? btn("← Back", opts.back, "btn ghost") : null,
      h("h2", { class: "m-title" }, title),
      btn("✕", closeFn, "btn ghost m-x", { "aria-label": "Close" }));
    card.append(head, h("div", { class: "m-body" }, body));
    $("modal").classList.add("on");
    $("modal").setAttribute("aria-hidden", "false");
    G().pauseState(true);
    const first = card.querySelector(".m-body button, .m-body input");
    first && first.focus && setTimeout(() => first.focus({ preventScroll: true }), 30);
  }

  function closeAll() {
    $("modal").classList.remove("on");
    $("modal").setAttribute("aria-hidden", "true");
    modalFrom = null;
    G() && G().pauseState(false);
  }
  const isModalOpen = () => $("modal").classList.contains("on");

  /* ================================================================== TITLE */
  function endingTotals() {
    const all = Object.keys(V.endingsDef);
    const got = all.filter(id => Global.d.endings[id]);
    return { got: got.length, total: all.length };
  }

  function showTitle() {
    const g = G();
    g.setBg("courtyard_sunset", { fast: false });
    FX.set("petals");
    A.play("spring");
    $("app").dataset.part = 1;
    const menu = $("titleMenu");
    menu.innerHTML = "";
    const latest = Saves.latest();
    if (latest) {
      const sv = latest.data;
      menu.append(h("button", { type: "button", class: "btn big primary", onclick: () => { A.init(); g.loadFrom(latest.slot); } },
        h("span", {}, "Continue"),
        h("small", {}, `${partTag(sv.part)} · ${(sv.chapter || "").split(" — ")[0] || "in progress"}`)));
    }
    menu.append(
      btn("New Game", () => { A.init(); confirmNew(); }, "btn big" + (latest ? "" : " primary")),
      btn("Chapter Select", () => openPartSelect(), "btn big"),
      btn("Load Game", () => openSaves("load", { from: "title" }), "btn big"),
      bonusUnlocked()
        ? h("button", { type: "button", class: "btn big bonus", onclick: () => { A.init(); confirmBonus(); } }, h("span", {}, "\u2605 Bonus Story"), h("small", {}, "The Hundredth Petal"))
        : h("button", { type: "button", class: "btn big bonus locked", disabled: true, title: "Finish all three parts to unlock" }, h("span", {}, "\u2605 Bonus Story"), h("small", {}, "Finish all three parts to unlock")),
      h("button", { type: "button", class: "btn big blossom", onclick: () => { location.href = "blossom/index.html"; } }, h("span", {}, "\u273F Blossom Drop"), h("small", {}, "A merge-and-drop minigame")),
      h("div", { class: "menu-row" },
        btn("Memories", () => openGallery({ from: "title" }), "btn"),
        btn("\u2726 Cards", () => openCards({ from: "title" }), "btn"),
        btn("Options", () => openSettings({ from: "title" }), "btn"),
        btn("Credits", () => openCredits({ from: "title" }), "btn")));
    const t = endingTotals();
    $("titleVer").textContent = `v${D.VERSION} · endings ${t.got}/${t.total}`;
  }

  function confirmBonus() {
    if (!Global.d.carry[3]) { openModal("Bonus Story", h("p", {}, "Finish Part III on this device to play the Bonus Story with your own history."), { back: null }); return; }
    G().newGame(4, "carry");
  }

  function confirmNew() {
    const latest = Saves.latest();
    if (!latest) { G().newGame(1); return; }
    openModal("Start a new game?", h("div", { class: "stack" },
      h("p", {}, "Your saves are kept in their slots. Starting a new game only replaces the autosave."),
      h("div", { class: "row" }, btn("Start Part I", () => { closeAll(); G().newGame(1); }, "btn primary"), btn("Cancel", closeAll, "btn ghost"))));
  }

  /* ================================================================== CHAPTER SELECT */
  function openPartSelect() {
    const wrap = h("div", { class: "parts" });
    [1, 2, 3].forEach(p => {
      const carry = Global.d.carry[p - 1];
      const done = Global.d.carry[p];
      const card = h("div", { class: "part-card p" + p },
        h("div", { class: "pc-roman" }, ROMAN[p]),
        h("div", { class: "pc-name" }, PART_NAMES[p]),
        h("div", { class: "pc-sub" }, ["", "Senior year. A new transfer student. A cherry tree.", "Two years later. The world ended quietly.", "Everything has led here. This is where it ends."][p]),
        done ? h("div", { class: "pc-done" }, "✓ completed") : null);
      if (p === 1) {
        card.append(btn("Play Part I", () => { A.init(); closeAll(); G().newGame(1); }, "btn primary"));
      } else {
        if (carry) {
          const prevEnd = V.endingsDef[carry.hist["p" + (p - 1)]];
          card.append(btn("Continue from your ending", () => { A.init(); closeAll(); G().newGame(p, "carry"); }, "btn primary"),
            h("div", { class: "pc-note" }, prevEnd ? "Part " + ROMAN[p - 1] + ": " + prevEnd.title : ""));
        }
        card.append(btn(carry ? "Pick a different history…" : "Choose your history…", () => openPresets(p), "btn"));
      }
      wrap.append(card);
    });
    openModal("Chapter Select", h("div", { class: "stack" },
      h("p", { class: "muted" }, "Each part picks up from how the last one ended. Haven't played the earlier parts? Choose a history and jump straight in."), wrap), { wide: true });
  }

  function openPresets(part) {
    const list = h("div", { class: "stack" });
    PRESETS[part].forEach(pr => {
      list.append(h("button", { type: "button", class: "preset", onclick: () => { A.init(); closeAll(); G().newGame(part, pr.id); } },
        h("strong", {}, pr.title)));
    });
    openModal(`${partTag(part)} — choose your history`, h("div", { class: "stack" },
      h("p", { class: "muted" }, part === 2 ? "How did Part I end for you?" : "How did Ashfall end for you?"), list),
      { back: () => openPartSelect() });
  }

  /* ================================================================== PAUSE */
  function openPause() {
    const g = G();
    openModal("Paused", h("div", { class: "menu-col" },
      btn("Resume", closeAll, "btn big primary"),
      btn("Save", () => openSaves("save", { from: "pause" }), "btn big"),
      btn("Load", () => openSaves("load", { from: "pause" }), "btn big"),
      h("div", { class: "menu-row" },
        btn("Backlog", () => openLog({ from: "pause" }), "btn"),
        btn("Bonds", () => openBonds({ from: "pause" }), "btn"),
        btn("Options", () => openSettings({ from: "pause" }), "btn"),
        btn("Memories", () => openGallery({ from: "pause" }), "btn")),
      btn("Return to Title", () => openModal("Return to title?", h("div", { class: "stack" },
        h("p", {}, "Unsaved progress since your last autosave will be lost."),
        h("div", { class: "row" }, btn("Return to Title", () => { closeAll(); g.toTitle(); }, "btn primary"), btn("Cancel", openPause, "btn ghost")))), "btn")));
  }

  const backTo = (from) => from === "pause" ? () => openPause() : null;

  /* ================================================================== SAVE / LOAD */
  function slotCard(slot, mode, from) {
    const sv = Saves.read(slot);
    const isAuto = slot === "auto";
    const label = isAuto ? "Autosave" : "Slot " + slot;
    const bgFile = sv && sv.bg && D.BACKGROUNDS[sv.bg] ? D.BG_DIR + D.BACKGROUNDS[sv.bg].file : null;
    const inner = [
      h("div", { class: "slot-thumb", style: bgFile ? `background-image:url('${bgFile}')` : "" }, sv ? h("span", { class: "badge" }, partTag(sv.part)) : null),
      h("div", { class: "slot-meta" },
        h("div", { class: "slot-name" }, label),
        sv ? h("div", { class: "slot-ch" }, sv.chapter || "—") : h("div", { class: "slot-ch muted" }, "Empty"),
        sv ? h("div", { class: "slot-snip" }, sv.snippet ? "“" + sv.snippet + "”" : "") : null,
        sv ? h("div", { class: "slot-date" }, fmtDate(sv.savedAt)) : null),
    ];
    const canSave = mode === "save" && !isAuto && G().canSave();
    const canLoad = mode === "load" && !!sv;
    const b = h("button", { type: "button", class: "slot" + (sv ? "" : " empty") + (mode === "save" && !canSave ? " disabled" : ""), disabled: (mode === "save" && !canSave) || (mode === "load" && !sv) },
      inner);
    b.addEventListener("click", () => {
      if (canSave) { G().saveTo(slot); A.sfx("chime"); openSaves("save", { from }); }
      else if (canLoad) { A.init(); closeAll(); G().loadFrom(slot); }
    });
    const wrap = h("div", { class: "slot-wrap" }, b);
    if (sv && !isAuto) wrap.append(h("button", { type: "button", class: "slot-del", title: "Delete this save", "aria-label": "Delete save", onclick: (e) => { e.stopPropagation(); Saves.clear(slot); openSaves(mode, { from }); } }, "✕"));
    return wrap;
  }

  function openSaves(mode, o) {
    o = o || {};
    const grid = h("div", { class: "slots" });
    grid.append(slotCard("auto", mode, o.from));
    for (let i = 1; i <= Saves.SLOTS; i++) grid.append(slotCard(i, mode, o.from));
    const note = mode === "save" && !G().canSave()
      ? h("p", { class: "muted" }, "You can save any time while a line of dialogue is on screen.") : null;
    const tools = h("div", { class: "row wrap" },
      btn("Export saves…", exportAll, "btn small"),
      btn("Import save file…", () => openImport(o), "btn small"));
    openModal(mode === "save" ? "Save Game" : "Load Game", h("div", { class: "stack" }, note, grid, tools), { wide: true, back: backTo(o.from) });
  }

  function exportAll() {
    const bundle = { osh: "definitive-bundle", version: D.VERSION, exportedAt: Date.now(), slots: {}, global: Global.d };
    ["auto"].concat(Array.from({ length: Saves.SLOTS }, (_, i) => i + 1)).forEach(k => { const s = Saves.read(k); if (s) bundle.slots[k] = s; });
    download("our-spring-hours-saves.json", bundle);
  }

  function download(name, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function openImport(o) {
    o = o || {};
    const msg = h("p", { class: "muted", id: "importMsg" }, "Choose a .json file. This accepts: a bundle exported from this game, a carry file exported from an ending screen, and the save files from the original Gemini versions of Our Spring Hours and Ashfall.");
    const input = h("input", { type: "file", accept: "application/json,.json", class: "file" });
    input.addEventListener("change", () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        let json;
        try { json = JSON.parse(rd.result); } catch (e) { msg.textContent = "That file isn't valid JSON."; return; }
        if (json.osh === "definitive-bundle") {
          Object.keys(json.slots || {}).forEach(k => Saves.write(k === "auto" ? "auto" : Number(k), json.slots[k]));
          if (json.global) { const g = Global.d; Object.assign(g.endings, json.global.endings || {}); Object.assign(g.bgs, json.global.bgs || {}); Object.assign(g.seen, json.global.seen || {}); Object.assign(g.carry, json.global.carry || {}); Global.save(); }
          msg.textContent = "Imported " + Object.keys(json.slots || {}).length + " save(s). Open Load Game to play them.";
          return;
        }
        const imp = importLegacy(json);
        if (!imp) { msg.textContent = "That file doesn't contain anything I can continue from (the finale has no sequel)."; return; }
        msg.textContent = "Recognised an older save — starting Part " + ROMAN[imp.part] + " with your history…";
        setTimeout(() => { A.init(); closeAll(); const st = imp.state; st.label = "p" + imp.part + "_start"; G().startFromState(st); }, 700);
      };
      rd.readAsText(f);
    });
    openModal("Import save file", h("div", { class: "stack" }, msg, input), { back: () => openSaves("load", o) });
  }

  /* ================================================================== KEEPSAKE CARDS */
  const PN = PART_NAMES;
  function cardFromFile(json) {
    // 1) definitive carry file with raw final stats
    if (json && json.final && json.ending && V.endingsDef[json.ending.id]) {
      const def = V.endingsDef[json.ending.id], S = newState(def.part);
      Object.assign(S, { stats: Object.assign(S.stats, json.final.stats), aloof: json.final.aloof || 0, flags: json.final.flags || {}, dead: json.final.dead || {} });
      return { def, S };
    }
    // 2) a bundle: use its stored per-part finished states
    if (json && json.osh === "definitive-bundle" && json.global && json.global.carry) {
      const out = Object.keys(json.global.carry).map(k => json.global.carry[k]).filter(c => c && c.hist);
      return { many: out.map(c => { const id = c.hist["p" + c.part]; return V.endingsDef[id] ? { def: V.endingsDef[id], S: c } : null; }).filter(Boolean) };
    }
    // 3) older carry files / original Gemini saves: stats are already scaled for the next part, so undo the scaling
    const src = (json && json.state && json.state.hist) ? { part: json.state.part, state: json.state } : importLegacy(json);
    if (!src || !src.state) return null;
    const prev = src.part - 1, id = src.state.hist && src.state.hist["p" + prev];
    if (!V.endingsDef[id]) return null;
    const k = src.part === 2 ? 0.5 : 0.6, S = clone(src.state);
    Object.keys(S.stats).forEach(key => { S.stats[key] = Math.round(S.stats[key] / k * 10) / 10; });
    if (prev === 1) { S.stats.maki = 0; S.stats.light = 0; }
    return { def: V.endingsDef[id], S };
  }

  function openCards(o) {
    o = o || {};
    const msg = h("p", { class: "muted small" }, "");
    const rows = [1, 2, 3, 4].map(p => {
      const c = Global.d.carry[p], id = c && c.hist && c.hist["p" + p], def = id && V.endingsDef[id];
      return h("div", { class: "slot-row", style: "display:flex;align-items:center;gap:12px;justify-content:space-between;padding:8px 0" },
        h("div", {}, h("div", {}, h("strong", {}, `${partTag(p)} — ${PN[p]}`)), h("div", { class: "muted small" }, def ? `Last finished: ${def.title}` : "Not finished on this device yet")),
        def ? btn("View card", () => window.VN_CARD.open(def, clone(c), { back: () => openCards(o) }), "btn small") : h("span", { class: "muted small" }, "—"));
    });
    const input = h("input", { type: "file", accept: "application/json,.json", class: "file" });
    input.addEventListener("change", () => {
      const f = input.files && input.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        let json; try { json = JSON.parse(rd.result); } catch (e) { msg.textContent = "That file isn't valid JSON."; return; }
        const r = cardFromFile(json);
        if (!r) { msg.textContent = "I couldn't find a finished chapter in that file."; return; }
        if (r.many) { if (!r.many.length) { msg.textContent = "That bundle has no finished chapters."; return; } window.VN_CARD.open(r.many[r.many.length - 1].def, r.many[r.many.length - 1].S, { back: () => openCards(o) }); return; }
        window.VN_CARD.open(r.def, r.S, { back: () => openCards(o) });
      };
      rd.readAsText(f);
    });
    openModal("Keepsake cards", h("div", { class: "stack" },
      h("p", { class: "muted" }, "Finished a chapter? Get its collectible card any time — no need to replay."),
      ...rows, h("hr", {}),
      h("p", { class: "muted small" }, "Played on another device? Choose a carry file (from an ending screen), an exported bundle, or an original Gemini save:"),
      input, msg), { back: backTo(o.from) });
  }

  /* ================================================================== SETTINGS */
  function seg(key, labels, values) {
    const wrap = h("div", { class: "seg" });
    labels.forEach((l, i) => {
      const v = values ? values[i] : i;
      const b = h("button", { type: "button", class: "seg-b" + (Settings.get(key) === v ? " on" : ""), onclick: () => { Settings.set(key, v); apply(); [...wrap.children].forEach((c, j) => c.classList.toggle("on", j === i)); } }, l);
      wrap.append(b);
    });
    return wrap;
  }
  function range(key, min, max, step) {
    const out = h("span", { class: "range-val" }, Math.round(Settings.get(key) * 100) + "%");
    const inp = h("input", { type: "range", min, max, step, value: Settings.get(key) });
    inp.addEventListener("input", () => { Settings.set(key, parseFloat(inp.value)); out.textContent = Math.round(parseFloat(inp.value) * 100) + "%"; apply(); });
    inp.addEventListener("change", () => A.sfx("click"));
    return h("div", { class: "range" }, inp, out);
  }
  function toggle(key) {
    const b = h("button", { type: "button", class: "tog" + (Settings.get(key) ? " on" : ""), role: "switch", "aria-checked": String(!!Settings.get(key)) }, h("span", { class: "knob" }));
    b.addEventListener("click", () => { const v = !Settings.get(key); Settings.set(key, v); b.classList.toggle("on", v); b.setAttribute("aria-checked", String(v)); apply(); });
    return b;
  }
  const row = (label, ctl, hint) => h("div", { class: "opt" }, h("div", { class: "opt-l" }, h("div", {}, label), hint ? h("small", {}, hint) : null), ctl);

  function openSettings(o) {
    o = o || {};
    openModal("Options", h("div", { class: "opts" },
      h("h3", {}, "Text"),
      row("Text speed", seg("textSpeed", ["Slow", "Normal", "Fast", "Instant"])),
      row("Auto-advance delay", seg("autoDelay", ["Short", "Normal", "Long"])),
      row("Text size", seg("fontScale", ["S", "M", "L", "XL"], [0.9, 1, 1.15, 1.3])),
      row("Textbox opacity", range("boxOpacity", 0.55, 1, 0.01)),
      h("h3", {}, "Audio"),
      row("Music volume", range("music", 0, 1, 0.01), "The score is generated live — no audio files."),
      row("Sound effects", range("sfx", 0, 1, 0.01)),
      row("Mute everything", toggle("muted")),
      h("h3", {}, "Display & gameplay"),
      row("Weather & screen effects", toggle("effects"), "Petals, rain, ash, screen shake and flashes."),
      row("Slow background drift", toggle("kenBurns")),
      row("“Will remember that” hints", toggle("toasts"), "Shows when a choice affected a relationship."),
      row("Skip unread text", toggle("skipUnread"), "Skip normally stops at text you haven't read yet."),
      h("h3", {}, "Data"),
      h("div", { class: "row wrap" },
        btn("Erase all game data…", () => openModal("Erase all data?", h("div", { class: "stack" },
          h("p", {}, "This deletes every save, unlocked ending and memory, and resets options. It can't be undone."),
          h("div", { class: "row" }, btn("Erase everything", () => { Object.keys(localStorage).filter(k => k.startsWith("osh-de:")).forEach(k => localStorage.removeItem(k)); location.reload(); }, "btn danger"), btn("Cancel", () => openSettings(o), "btn ghost")))), "btn small danger"))
    ), { wide: true, back: backTo(o.from) });
  }

  function apply() {
    const root = document.documentElement.style;
    root.setProperty("--fs", Settings.get("fontScale"));
    root.setProperty("--box-a", Settings.get("boxOpacity"));
    document.body.classList.toggle("no-fx", !Settings.get("effects"));
    document.body.classList.toggle("no-kb", !Settings.get("kenBurns"));
  }

  /* ================================================================== LOG */
  function openLog(o) {
    o = o || {};
    const list = h("div", { class: "log" });
    const entries = G().log;
    if (!entries.length) list.append(h("p", { class: "muted" }, "Nothing yet."));
    entries.forEach(e => {
      list.append(h("div", { class: "log-e" + (e.choice ? " choice" : "") },
        e.who ? h("div", { class: "log-who", style: `color:${e.color}` }, e.who) : null,
        h("div", { class: "log-t" }, e.text)));
    });
    openModal("Backlog", list, { wide: true, back: backTo(o.from) });
    const body = document.querySelector(".m-body");
    body && (body.scrollTop = body.scrollHeight);
  }

  /* ================================================================== BONDS */
  const RANKS = ["Barely met", "Acquaintance", "Friend", "Close", "Inseparable"];
  const LRANKS = ["Wary", "Guarded", "Working trust", "Allied", "Confidant"];
  function openBonds(o) {
    o = o || {};
    const S = G().S;
    const items = [];
    const add = (name, key, max, color, ranks) => {
      const v = Math.max(0, S.stats[key] || 0);
      const r = Math.min(ranks.length - 1, Math.floor((v / max) * ranks.length));
      items.push(h("div", { class: "bond" },
        h("div", { class: "bond-h" }, h("span", { style: `color:${color}` }, name), h("span", { class: "bond-r" }, ranks[r])),
        h("div", { class: "bar" }, h("i", { style: `width:${Math.min(100, (v / max) * 100)}%;background:${color}` }))));
    };
    add("Uraraka", "ura", 14, "#ff6f8f", RANKS);
    add("Falcon", "fal", 12, "#7fa25c", RANKS);
    add("Joseph & Cementoss", "fri", 14, "#5b93c7", RANKS);
    if (S.part >= 2) { add("Maki Oze", "maki", 9, "#d0642f", RANKS); add("Light Yagami (trust)", "light", 9, "#c9a56a", LRANKS); }
    const cast = S.part === 3 ? h("div", { class: "muted" }, ["joseph", "cementoss", "falcon", "maki", "uraraka"].filter(k => S.dead[k]).map(k => D.CHARACTERS[k].name).join(", ") ? "Lost: " + ["joseph", "cementoss", "falcon", "maki", "uraraka"].filter(k => S.dead[k]).map(k => D.CHARACTERS[k].name).join(", ") : "") : null;
    openModal("Bonds", h("div", { class: "stack" }, h("p", { class: "muted" }, "How the people around you feel about the choices you've made so far."), items, cast), { back: backTo(o.from) });
  }

  /* ================================================================== GALLERY */
  const BIOS = {
    cody: "You. Senior year, running on the last granola bar in the locker.",
    joseph: "Loud, loyal, and allergic to silence. Cementoss's closest friend.",
    falcon: "Class schemer and professional commentator. Hides sincerity inside jokes.",
    cementoss: "A wall of calm in a maroon hoodie. Every word is checked for load-bearing capacity.",
    uraraka: "The new transfer student. Cheerful, stubborn, aiming for top of the class.",
    light: "Keeps a ledger of everyone alive within a hundred miles. Efficient.",
    maki: "Former Company 8 Fire Soldier, running generators alone.",
    shigaraki: "Loud enough to notice. Not the one to worry about. Allegedly.",
    allforone: "The name behind the name. Power finds the cracks in everything.",
  };

  function openGallery(o) {
    o = o || {};
    const body = h("div", { class: "stack" });
    const tabs = h("div", { class: "seg" });
    const pane = h("div", { class: "pane" });
    const render = (which) => {
      [...tabs.children].forEach((t, i) => t.classList.toggle("on", ["endings", "memories", "cast"][i] === which));
      pane.innerHTML = "";
      if (which === "endings") {
        const t = endingTotals();
        pane.append(h("p", { class: "muted" }, `${t.got} of ${t.total} endings found.`));
        [1, 2, 3, 4].forEach(p => {
          pane.append(h("h3", {}, `${partTag(p)} — ${PART_NAMES[p]}`));
          Object.values(V.endingsDef).filter(e => e.part === p).forEach(e => {
            const got = !!Global.d.endings[e.id];
            pane.append(h("div", { class: "end-row" + (got ? " got" : "") },
              h("div", { class: "end-thumb", style: got ? `background-image:url('${D.BG_DIR + D.BACKGROUNDS[e.bg].file}')` : "" }, got ? "" : "?"),
              h("div", {}, h("div", { class: "end-t" }, got ? e.title : "???"), h("div", { class: "muted small" }, got ? (e.summary || "") : (e.hint || "Not found yet.")))));
          });
        });
      } else if (which === "memories") {
        const keys = Object.keys(D.BACKGROUNDS);
        const got = keys.filter(k => Global.d.bgs[k]).length;
        pane.append(h("p", { class: "muted" }, `${got} of ${keys.length} places seen.`));
        const grid = h("div", { class: "memgrid" });
        keys.forEach(k => {
          const seen = !!Global.d.bgs[k];
          grid.append(h("figure", { class: "mem" + (seen ? "" : " locked") },
            h("div", { class: "mem-img", style: seen ? `background-image:url('${D.BG_DIR + D.BACKGROUNDS[k].file}')` : "" }),
            h("figcaption", {}, seen ? D.BACKGROUNDS[k].name : "???")));
        });
        pane.append(grid);
      } else {
        const grid = h("div", { class: "castgrid" });
        Object.keys(D.CHARACTERS).forEach(k => {
          const c = D.CHARACTERS[k];
          grid.append(h("div", { class: "cast" },
            h("img", { src: c.img, alt: c.name, loading: "lazy" }),
            h("div", {}, h("div", { class: "cast-n", style: `color:${c.color}` }, c.name), h("div", { class: "muted small" }, BIOS[k] || ""))));
        });
        pane.append(grid);
      }
    };
    ["Endings", "Memories", "Cast"].forEach((l, i) => tabs.append(h("button", { type: "button", class: "seg-b", onclick: () => render(["endings", "memories", "cast"][i]) }, l)));
    body.append(tabs, pane);
    openModal("Memories", body, { wide: true, back: backTo(o.from) });
    render("endings");
  }

  /* ================================================================== CREDITS */
  function openCredits(o) {
    o = o || {};
    openModal("Credits", h("div", { class: "credits" },
      h("h3", {}, "Our Spring Hours — Definitive Edition"),
      h("p", {}, "A three-part visual novel: Our Spring Hours, Ashfall, and Last Light."),
      h("h4", {}, "Created by"), h("p", {}, "CodyMKW — concept, characters, and the friends who inspired them."),
      h("h4", {}, "Story & engine"), h("p", {}, "The original trilogy was drafted with Google Gemini. This Definitive Edition — rewritten script, expanded chapters, new engine, new backgrounds, procedural score — was built with Claude (Anthropic)."),
      h("h4", {}, "Art"), h("p", {}, "Original backgrounds and character art are the ones used in the original files. Extra backgrounds (night, ruined, dawn and alert variants) were generated from them with tools/make_backgrounds.py."),
      h("h4", {}, "Fan project"), h("p", { class: "muted" }, "Mii-style characters belong to Nintendo; Uraraka, Shigaraki, All For One (My Hero Academia), Light Yagami (Death Note) and Maki Oze (Fire Force) belong to their respective creators and publishers. This is a free, non-commercial fan work."),
      h("p", { class: "muted" }, "Thanks for playing.")),
      { back: backTo(o.from) });
  }

  /* ================================================================== ENDING SCREEN */
  function renderEnding(def, S, fresh) {
    const el = $("ending");
    el.innerHTML = "";
    const t = endingTotals();
    const lines = def.lines.map(l => typeof l === "function" ? l(S) : l).filter(Boolean);
    const card = h("div", { class: "end-card kind-" + def.kind },
      h("p", { class: "eyebrow" }, `${partTag(def.part)} · ${PART_NAMES[def.part]} — ${def.kind === "true" ? "True Ending" : "Ending"}`),
      h("h2", { class: "end-title" }, def.title),
      h("div", { class: "end-body" }, lines.map((l, i) => h("p", { style: `animation-delay:${0.8 + i * 1.4}s` }, l))));
    if (def.part === 3) {
      const castKeys = ["joseph", "cementoss", "falcon", "maki", "uraraka"];
      const rows = castKeys.map(k => h("div", { class: "castRow " + (S.dead[k] ? "fallen" : "alive") },
        h("span", { class: "castName", style: `color:${D.CHARACTERS[k].color}` }, D.CHARACTERS[k].name),
        h("span", { class: "castStatusText" }, S.dead[k] ? "Lost at the battlegrounds" : "Alive")));
      rows.push(h("div", { class: "castRow alive" }, h("span", { class: "castName", style: `color:${D.CHARACTERS.light.color}` }, "Light Yagami"),
        h("span", { class: "castStatusText" }, ({ renounced: "Gave up the notebook for good", weaponized: "Still keeping his ledger", sidelined: "Walking his own path now" })[S.flags.lightPath] || "Unresolved, watching from the Hideout")));
      card.append(h("div", { class: "castPanel", style: `animation-delay:${1.4 + lines.length * 1.4}s` }, h("p", { class: "castPanelTitle" }, "Where they ended up"), rows));
    }
    const actions = h("div", { class: "end-actions", style: `animation-delay:${1.6 + lines.length * 1.4}s` });
    if (def.part < 3) {
      actions.append(btn(`Continue to ${partTag(def.part + 1)}: ${PART_NAMES[def.part + 1]} →`, () => { G().startFromState(carryOver(clone(S), def.part + 1)); }, "btn big primary"));
      actions.append(btn("Save carry file", () => download(`our-spring-hours-part${def.part}-${def.id}.json`, { osh: "definitive", nextPart: def.part + 1, state: carryOver(clone(S), def.part + 1), final: { stats: clone(S.stats), aloof: S.aloof, flags: clone(S.flags), dead: clone(S.dead || {}) }, ending: { id: def.id, title: def.title, part: def.part } }), "btn small"));
    } else {
      if (def.part === 3 && bonusUnlocked()) actions.append(btn("\u2605 Play the Bonus Story \u2192", () => { G().newGame(4, "carry"); }, "btn big primary"));
      actions.append(btn("Credits", () => openCredits({ onClose: null }), "btn big" + (def.part === 3 && bonusUnlocked() ? "" : " primary")));
    }
    actions.append(btn("\u2726 Keepsake card", () => window.VN_CARD.open(def, clone(S)), "btn small"));
    actions.append(btn("Try a different choice", () => G().undoEnding(), "btn small"),
      btn("Return to Title", () => G().toTitle(), "btn small"));
    card.append(fresh ? h("p", { class: "unlock", style: `animation-delay:${1 + lines.length * 1.4}s` }, `✦ New ending — ${t.got} / ${t.total} found`) : null, actions);
    el.append(card);
    el.scrollTop = 0;
  }

  window.VN_UI = { showTitle, openPause, closeAll, isModalOpen, renderEnding, openLog, openSettings, openSaves, openBonds, apply, openGallery, openModal, openCards };
})();
