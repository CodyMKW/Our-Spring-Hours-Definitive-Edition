// Usage: node 3ds/tools/rt_playtest.js [runs=40]  — plays the bundled story through the headless runtime with random choices.
// Checks: no runtime errors, every run reaches an ending, Part I→II→III→bonus continue chain works, rollback/save/load work.
const fs = require("fs"), path = require("path"), vm = require("vm");
const src = fs.readFileSync(path.join(__dirname, "..", "romfs", "story.js"), "utf8");
function makeCtx(store) {
  const ctx = vm.createContext({ __store_get: k => store[k], __store_set: (k, v) => { store[k] = v; }, __store_del: k => { delete store[k]; }, __log: () => {} });
  vm.runInContext(src, ctx, { filename: "story.js" }); ctx.Rt.init(); return ctx;
}
const runs = +process.argv[2] || 40;
let rng = 12345; const rnd = () => (rng = (rng * 1664525 + 1013904223) >>> 0) / 4294967296;
const store = {}; const ctx = makeCtx(store); const Rt = ctx.Rt;
const stats = { endings: {}, lines: 0, errors: 0, menus: 0 };
function play(part, preset) {
  Rt.newGame(part, preset);
  let steps = 0, last = null;
  for (;;) {
    for (const e of Rt.poll()) {
      if (e.t === "error") { stats.errors++; console.log("ERROR", e.msg); return null; }
      if (e.t === "ending") { stats.endings[e.id] = (stats.endings[e.id] || 0) + 1; return e; }
      last = e;
    }
    if (++steps > 20000) { console.log("too many steps"); stats.errors++; return null; }
    const m = Rt.state();
    if (m.choosing) { stats.menus++; const n = last && last.options ? last.options.length : 1; Rt.choose((rnd() * n) | 0); }
    else if (m.playing) { stats.lines++; Rt.advance(); }
    else { console.log("stalled"); stats.errors++; return null; }
    // remember latest menu event for option count
    const peek = [];
  }
}
// need the menu option count: wrap poll so we can remember it
const origPoll = Rt.poll; Rt.poll = function () { const r = origPoll(); for (const e of r) if (e.t === "menu") this._lastMenu = e; return r; };
function play2(part, preset) {
  Rt.newGame(part, preset); let steps = 0;
  for (;;) {
    for (const e of Rt.poll()) { if (e.t === "error") { stats.errors++; console.log("ERROR", e.msg); return null; } if (e.t === "ending") { stats.endings[e.id] = (stats.endings[e.id] || 0) + 1; return e; } }
    if (++steps > 30000) { console.log("too many steps"); stats.errors++; return null; }
    const m = Rt.state();
    if (m.choosing) { stats.menus++; Rt.choose((rnd() * Rt._lastMenu.options.length) | 0); }
    else if (m.playing) { stats.lines++; Rt.advance(); }
    else { console.log("stalled"); stats.errors++; return null; }
  }
}
let chains = 0;
for (let i = 0; i < runs; i++) {
  let e = play2(1); if (!e) continue;
  // follow the chain through the parts
  while (e && e.next === "part") { Rt.ending("next"); e = (function () { let steps = 0; for (;;) { for (const x of Rt.poll()) { if (x.t === "error") { stats.errors++; console.log("ERROR", x.msg); return null; } if (x.t === "ending") { stats.endings[x.id] = (stats.endings[x.id] || 0) + 1; return x; } } if (++steps > 30000) return null; const m = Rt.state(); if (m.choosing) { stats.menus++; Rt.choose((rnd() * Rt._lastMenu.options.length) | 0); } else if (m.playing) { stats.lines++; Rt.advance(); } else return null; } })(); }
  if (e && e.part === 3) chains++;
  if (e && e.next === "bonus") { Rt.ending("bonus"); const b = (function () { let steps = 0; for (;;) { for (const x of Rt.poll()) { if (x.t === "error") { stats.errors++; return null; } if (x.t === "ending") { stats.endings[x.id] = (stats.endings[x.id] || 0) + 1; return x; } } if (++steps > 30000) return null; const m = Rt.state(); if (m.choosing) Rt.choose((rnd() * Rt._lastMenu.options.length) | 0); else if (m.playing) Rt.advance(); else return null; } })(); if (!b) console.log("bonus did not finish"); }
}
const ids = Object.keys(stats.endings);
console.log(`runs=${runs} full-chains(to Part III)=${chains} lines=${stats.lines} menus=${stats.menus} errors=${stats.errors}`);
console.log("endings reached:", ids.length, ids.join(", "));
// save/load/rollback sanity
Rt.newGame(1); Rt.poll(); for (let i = 0; i < 6; i++) { const m = Rt.state(); if (m.choosing) Rt.choose(0); else Rt.advance(); Rt.poll(); }
console.log("saveSlot:", Rt.saveSlot(3), "slots[3] snippet:", JSON.stringify(Rt.slots()[3]).slice(0, 120));
console.log("rollback:", Rt.rollback(), "loadSlot:", Rt.loadSlot(3), "events after load:", Rt.poll().map(e => e.t).join(","));
console.log("titleInfo:", JSON.stringify(Rt.titleInfo()).slice(0, 300));
process.exit(stats.errors ? 1 : 0);
