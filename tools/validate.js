// Usage: node tools/validate.js   — compiles story, checks references, explores reachable endings.
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const win = { addEventListener(){}, document: { readyState: "complete", addEventListener(){}, getElementById(){return null;} }, localStorage: { getItem(){return null;}, setItem(){}, removeItem(){} } };
win.window = win; win.self = win;
const ctx = vm.createContext(Object.assign(win, { console, setInterval(){}, setTimeout, clearTimeout, localStorage: win.localStorage }));
for (const f of ["js/data.js","js/core.js","js/dsl.js","js/story/part1.js","js/story/part2.js","js/story/part3.js","js/story/bonus.js","js/story/endings.js"])
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
const V = win.VN, D = win.VN_DATA, C = win.VN_CORE;
V.compile();
const moods = Object.keys(D.MOODS || {});
const errs = V.validate({ bgs: D.BACKGROUNDS, chars: D.CHARACTERS, moods: D.MOODS, fx: ["petals","rain","ash","snow","embers","fireflies","dust"] });
console.log(Object.keys(V.code).length, "labels;", errs.length, "problems");
errs.forEach(e => console.log(" -", e));
// bg files exist
for (const [k, b] of Object.entries(D.BACKGROUNDS)) if (!fs.existsSync(path.join(root, D.BG_DIR || "assets/backgrounds", b.file))) console.log("missing bg", k, b.file);
for (const [k, c] of Object.entries(D.CHARACTERS)) if (c.img && !fs.existsSync(path.join(root, c.img))) console.log("missing char", k, c.img);
console.log("endings defined:", Object.keys(V.endingsDef).join(", "));
