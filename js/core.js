/* ============================================================================
   core.js — persistent storage, settings, global progress, game-state helpers.

   localStorage keys (all prefixed "osh-de:"):
     osh-de:settings   user settings (see Settings.defaults)
     osh-de:global     progress shared by every playthrough: unlocked endings,
                       seen backgrounds, seen-line markers (for skip), per-part
                       "carry" snapshots used by Chapter Select
     osh-de:auto       autosave (same shape as a manual slot)
     osh-de:slot:N     manual save slots 1..12
   ========================================================================== */
(function () {
  "use strict";
  const PREFIX = "osh-de:";

  const Store = {
    get(key, def) {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw == null ? def : JSON.parse(raw);
      } catch (e) { return def; }
    },
    set(key, val) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); return true; }
      catch (e) { return false; }
    },
    del(key) { try { localStorage.removeItem(PREFIX + key); } catch (e) { /* ignore */ } },
  };

  /* ------------------------------------------------------------------ settings */
  const reduced = (() => {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
  })();

  const Settings = {
    defaults: {
      textSpeed: 2,        // 0 slow, 1 normal, 2 fast, 3 instant
      autoDelay: 1,        // 0 short, 1 normal, 2 long
      music: 0.55,
      sfx: 0.7,
      muted: false,
      effects: !reduced,   // weather particles, screen shake, flashes
      fontScale: 1,        // 0.9 / 1 / 1.15 / 1.3
      boxOpacity: 0.93,
      toasts: true,        // "Uraraka will remember that."
      skipUnread: false,   // let Skip run through text you've never read
      kenBurns: !reduced,  // slow background drift
    },
    data: null,
    listeners: [],
    load() {
      this.data = Object.assign({}, this.defaults, Store.get("settings", {}));
      return this.data;
    },
    get(k) { return (this.data || this.load())[k]; },
    set(k, v) {
      (this.data || this.load())[k] = v;
      Store.set("settings", this.data);
      this.listeners.forEach(fn => fn(k, v));
    },
    onChange(fn) { this.listeners.push(fn); },
  };

  /* ------------------------------------------------------------------- globals */
  const Global = {
    data: null,
    load() {
      this.data = Object.assign(
        { seen: {}, endings: {}, bgs: {}, carry: {}, plays: 0, lastSlot: null },
        Store.get("global", {})
      );
      return this.data;
    },
    save() { Store.set("global", this.data); },
    get d() { return this.data || this.load(); },
    markSeen(key) {
      const d = this.d;
      if (!d.seen[key]) { d.seen[key] = 1; this._dirty = true; }
    },
    isSeen(key) { return !!this.d.seen[key]; },
    unlockEnding(id) {
      const d = this.d;
      const fresh = !d.endings[id];
      if (fresh) d.endings[id] = Date.now();
      this.save();
      return fresh;
    },
    unlockBg(id) {
      const d = this.d;
      if (!d.bgs[id]) { d.bgs[id] = 1; this._dirty = true; }
    },
    flush() { if (this._dirty) { this._dirty = false; this.save(); } },
  };
  setInterval(() => Global.flush(), 4000);
  window.addEventListener("pagehide", () => Global.flush());
  window.addEventListener("beforeunload", () => Global.flush());

  /* ----------------------------------------------------------------- game state */
  const STAT_KEYS = ["ura", "fri", "fal", "maki", "light"];

  function newState(part) {
    return {
      v: 1,
      part: part || 1,
      label: "p" + (part || 1) + "_start",
      idx: 0,
      stats: { ura: 0, fri: 0, fal: 0, maki: 0, light: 0 },
      aloof: 0,
      flags: {},
      dead: {},
      hist: { p1: null, p2: null, p3: null, p4: null }, // ending id reached in each part
      scene: { bg: null, music: null, weather: null, stage: [] },
      lines: 0,
    };
  }

  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* Carry a finished state into the next part (see README "Stat carry-over"). */
  function carryOver(prev, nextPart) {
    const s = newState(nextPart);
    const k = nextPart === 2 ? 0.5 : nextPart === 3 ? 0.6 : 1;   // the bonus story keeps your full Part III stats
    ["ura", "fri", "fal", "maki", "light"].forEach(key => {
      s.stats[key] = Math.round((prev.stats[key] || 0) * k);
    });
    s.hist = clone(prev.hist);
    s.flags = clone(prev.flags || {});   // every flag is a story callback; keep them all
    if (nextPart === 4) { s.dead = clone(prev.dead || {}); s.aloof = prev.aloof || 0; }
    return s;
  }

  /* Presets for starting Part II / III directly from Chapter Select. */
  const PRESETS = {
    1: [],
    2: [
      { id: "ending_true",    title: "True Ending — everyone, and Uraraka too",
        state: { stats: { ura: 9, fri: 7, fal: 3 }, flags: { confessed: true, partner: "uraraka" }, hist: { p1: "ending_true" } } },
      { id: "ending_romance", title: "Falling Petals — you and Uraraka",
        state: { stats: { ura: 8, fri: 3, fal: 2 }, flags: { confessed: true, partner: "uraraka" }, hist: { p1: "ending_romance" } } },
      { id: "ending_friends", title: "Golden Hour — the friend group",
        state: { stats: { ura: 3, fri: 8, fal: 3 }, flags: { partner: "friends" }, hist: { p1: "ending_friends" } } },
      { id: "ending_falcon",  title: "Tailwind — you and Falcon, best friends",
        state: { stats: { ura: 2, fri: 4, fal: 9 }, flags: { partner: "falcon" }, hist: { p1: "ending_falcon" } } },
      { id: "ending_lonely",  title: "Static — you drifted apart",
        state: { stats: { ura: 1, fri: 1, fal: 1 }, aloof: 5, flags: {}, hist: { p1: "ending_lonely" } } },
    ],
    3: [
      { id: "end_inheritance", title: "Inheritance — the courtyard held, together",
        state: { stats: { ura: 9, fri: 10, fal: 5, maki: 5, light: 1 }, flags: { confessed: true, partner: "uraraka" }, hist: { p1: "ending_true", p2: "end_inheritance" } } },
      { id: "end_ashfalldawn", title: "Ashfall Dawn — nobody lost, nothing won",
        state: { stats: { ura: 5, fri: 6, fal: 4, maki: 3, light: 2 }, flags: { confessed: true }, hist: { p1: "ending_friends", p2: "end_ashfalldawn" } } },
      { id: "end_staticledger", title: "Static Ledger — you used Light's leverage",
        state: { stats: { ura: 4, fri: 4, fal: 3, maki: 2, light: 6 }, flags: {}, hist: { p1: "ending_friends", p2: "end_staticledger" } } },
      { id: "end_embers", title: "Embers — you walked away, with Falcon",
        state: { stats: { ura: 2, fri: 4, fal: 7, maki: 2, light: 1 }, flags: { partner: "falcon" }, hist: { p1: "ending_falcon", p2: "end_embers" } } },
      { id: "end_longdark", title: "The Long Dark — you kept your distance",
        state: { stats: { ura: 1, fri: 1, fal: 1, maki: 0, light: 0 }, aloof: 3, flags: {}, hist: { p1: "ending_lonely", p2: "end_longdark" } } },
    ],
  };

  function presetState(part, presetId) {
    const s = newState(part);
    const p = (PRESETS[part] || []).find(x => x.id === presetId);
    if (!p) return s;
    const src = p.state;
    Object.assign(s.stats, src.stats || {});
    s.aloof = src.aloof || 0;
    s.flags = clone(src.flags || {});
    Object.assign(s.hist, src.hist || {});
    return s;
  }

  /* ---------------------------------------------------------------- save slots */
  const SLOTS = 12;
  const Saves = {
    SLOTS,
    read(slot) { return Store.get(slot === "auto" ? "auto" : "slot:" + slot, null); },
    write(slot, payload) { return Store.set(slot === "auto" ? "auto" : "slot:" + slot, payload); },
    clear(slot) { Store.del(slot === "auto" ? "auto" : "slot:" + slot); },
    latest() {
      let best = null;
      const keys = ["auto"];
      for (let i = 1; i <= SLOTS; i++) keys.push(i);
      keys.forEach(k => {
        const s = this.read(k);
        if (s && (!best || s.savedAt > best.data.savedAt)) best = { slot: k, data: s };
      });
      return best;
    },
  };

  /* ----------------------------------------------------- legacy (Gemini) saves */
  /* The original three games exported small JSON "carry" files. Importing one
     lets you jump straight into Part II / III with the same history. */
  const LEGACY_P1 = {
    ending_romance: "ending_romance", ending_friends: "ending_friends", ending_falcon: "ending_falcon",
    ending_true: "ending_true", ending_lonely: "ending_lonely",
  };
  function importLegacy(json) {
    if (!json || typeof json !== "object") return null;
    const game = String(json.game || "");
    const st = json.stats || {};
    const fl = json.flags || {};
    const endId = json.ending && json.ending.id;

    // Definitive-edition export
    if (json.osh === "definitive" && json.state) return { part: json.nextPart || 2, state: json.state };

    if (/Last Light/i.test(game)) return null; // nothing follows the finale
    if (/Ashfall/i.test(game) || json.saveVersion === 2) {
      const s = newState(3);
      s.stats.ura = Math.round((st.affection_uraraka || 0) * 0.6);
      s.stats.fri = Math.round((st.friendship_group || 0) * 0.6);
      s.stats.fal = Math.round((st.bond_falcon || 0) * 0.6);
      s.stats.light = Math.round((st.trust_light || 0) * 0.6);
      s.stats.maki = Math.round((st.bond_maki || 0) * 0.6);
      s.flags.confessed = !!fl.confessed;
      if (fl.festivalPartner) s.flags.partner = fl.festivalPartner;
      s.hist.p2 = endId || "end_ashfalldawn";
      s.hist.p1 = (json.carriedFrom && json.carriedFrom.endingId) || null;
      return { part: 3, state: s };
    }
    const s = newState(2);
    s.stats.ura = Math.round((st.affection_uraraka || 0) / 2);
    s.stats.fri = Math.round((st.friendship_group || 0) / 2);
    s.stats.fal = Math.round((st.bond_falcon || 0) / 2);
    s.flags.confessed = !!fl.confessed;
    if (fl.festivalPartner) s.flags.partner = fl.festivalPartner;
    s.hist.p1 = LEGACY_P1[endId] || "ending_friends";
    return { part: 2, state: s };
  }

  window.VN_CORE = { Store, Settings, Global, Saves, newState, clone, carryOver, presetState, PRESETS, importLegacy, STAT_KEYS };
})();
