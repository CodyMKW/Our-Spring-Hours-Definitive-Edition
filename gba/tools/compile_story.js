// Usage: node gba/tools/compile_story.js OUTDIR
// Runs the web story files unmodified in a vm, then writes:
//   OUTDIR/story_data.c   bytecode, string pool, tables (const, lives in ROM)
//   OUTDIR/story_ids.h    #defines for flags / flag values / characters / backgrounds / moods / weather
//   OUTDIR/story_ids.json names in id order (consumed by the asset builder)
//   OUTDIR/story_fn.txt   source of every JS function in the story, indexed (to hand-port in gba/source/story_fn.c)
// The JS functions (conditions, routes, dynamic text) can't run on the GBA, so they are listed by index;
// a hash of all sources is checked against gba/tools/fn_hash.txt so a story edit that changes them fails the build loudly.
const fs = require("fs"), vm = require("vm"), path = require("path"), crypto = require("crypto");
const root = path.join(__dirname, "..", "..");
const out = process.argv[2] || path.join(__dirname, "..", "build");
fs.mkdirSync(out, { recursive: true });

const files = ["3ds/js/shim.js", "js/data.js", "js/core.js", "js/dsl.js", "js/story/part1.js", "js/story/part2.js", "js/story/part3.js", "js/story/bonus.js", "js/story/endings.js"];
const src = files.map(f => fs.readFileSync(path.join(root, f), "utf8")).join("\n;\n") + "\nVN.compile();";
const ctx = { console }; vm.createContext(ctx);
vm.runInContext("var window=this;" + src + ";this.VN=window.VN;this.D=window.VN_DATA;", ctx);
const VN = ctx.VN, D = ctx.D;

/* ---------- id registries */
const reg = () => { const m = new Map(); return { m, id(k) { if (!m.has(k)) m.set(k, m.size); return m.get(k); }, list: () => [...m.keys()] }; };
const CH = Object.keys(D.CHARACTERS), BGS = Object.keys(D.BACKGROUNDS), MOODS = D.MOODS.slice();
const WEATHER = reg(), FLAGS = reg(), VALS = reg(); VALS.id("<undef>"); VALS.id("<true>");
const STR = reg(), FN = reg(), LABELS = reg();
const ENDS = Object.keys(VN.endingsDef);
const STATS = ["ura", "fri", "fal", "maki", "light", "aloof"];
const NONE = 0xFFFF;
const fnSrc = []; const fnObj = []; const textFns = new Set();
const norm = (f) => f.toString().replace(/\s+/g, " ");
const fnId = (f) => { const s = norm(f); const k = FN.m.has(s); const id = FN.id(s); if (!k) { fnSrc.push(f.toString()); fnObj.push(f); } return id; };
const strId = (t) => STR.id(String(t));
const chId = (w) => { if (!w) return NONE; const i = CH.indexOf(w); if (i < 0) { if (w === "cody-thought") return CH.indexOf("cody"); throw new Error("unknown char " + w); } return i; };
const valId = (v) => { if (v === true) return 1; if (v === false || v == null) return 0; if (typeof v === "string") return VALS.id(v); throw new Error("bad flag value " + v); };
const hex555 = (c) => { c = c.replace("#", ""); if (c.length === 3) c = c.split("").map(x => x + x).join(""); const r = parseInt(c.slice(0, 2), 16) >> 3, g = parseInt(c.slice(2, 4), 16) >> 3, b = parseInt(c.slice(4, 6), 16) >> 3; return r | (g << 5) | (b << 10); };

/* ---------- pre-register all labels so ids are stable */
const names = Object.keys(VN.code);
names.forEach(n => LABELS.id(n));
ENDS.forEach(e => { if (!LABELS.m.has(e)) throw new Error("ending label missing " + e); });

/* ---------- code */
const code = []; const labelOff = [];
const OP = { SAY: 1, SAYF: 2, N: 3, NF: 4, BG: 5, MUSIC: 6, WEATHER: 7, CHAPTER: 8, CARD: 9, SHAKE: 10, FLASH: 11, PULSE: 12, WAIT: 13, ADD: 15, SET: 16, KILL: 17, FN: 18, JUMP: 19, BRANCH: 20, ROUTE: 21, END: 22, MENU: 23, ADDF: 24 };
const lab = (n) => { if (!LABELS.m.has(n)) throw new Error("missing label " + n); return LABELS.id(n); };
names.forEach(name => {
  labelOff[LABELS.id(name)] = code.length;
  for (const ins of VN.code[name]) {
    const p = (...w) => w.forEach(x => { if (x < 0 || x > 0xFFFF) throw new Error("operand overflow in " + name); code.push(x & 0xFFFF); });
    switch (ins.op) {
      case "say": typeof ins.text === "function" ? (textFns.add(fnId(ins.text)), p(OP.SAYF, chId(ins.who), fnId(ins.text))) : p(OP.SAY, chId(ins.who), strId(ins.text)); break;
      case "n": typeof ins.text === "function" ? (textFns.add(fnId(ins.text)), p(OP.NF, fnId(ins.text))) : p(OP.N, strId(ins.text)); break;
      case "bg": p(OP.BG, BGS.indexOf(ins.name), (ins.keep ? 1 : 0) | (ins.fast ? 2 : 0)); if (BGS.indexOf(ins.name) < 0) throw new Error("bg " + ins.name); break;
      case "music": p(OP.MUSIC, ins.mood ? MOODS.indexOf(ins.mood) : NONE); break;
      case "weather": p(OP.WEATHER, ins.type ? WEATHER.id(ins.type) : NONE); break;
      case "chapter": p(OP.CHAPTER, strId(ins.title), strId(ins.sub || "")); break;
      case "card": p(OP.CARD, ins.part || 0, strId(ins.title || ""), strId(ins.sub || ""), strId(ins.part ? (ins.eyebrow || ("Part " + ["", "I", "II", "III", "IV"][ins.part])) : "")); break;
      case "shake": p(OP.SHAKE, ins.strength || 1); break;
      case "flash": p(OP.FLASH, hex555(ins.color || "#fff")); break;
      case "pulse": p(OP.PULSE, hex555(ins.color || "#a52a2f")); break;
      case "wait": p(OP.WAIT, Math.min(ins.ms || 600, 60000)); break;
      case "sfx": break;
      case "add": p(OP.ADD, STATS.indexOf(ins.stat), ins.amt & 0xFFFF); break;
      case "set": p(OP.SET, FLAGS.id(ins.flag), valId(ins.val)); break;
      case "kill": p(OP.KILL, CH.indexOf(ins.who)); break;
      case "fn": {   // the only fn() uses are petal counters: probe the closure to see what it does to flags.petals
        const probe = { flags: { petals: 100 }, stats: {}, dead: {}, hist: {} }; ins.f(probe, {});
        const after = probe.flags.petals;
        if (Object.keys(probe.flags).length !== 1 || typeof after !== "number") throw new Error("unsupported fn() in " + name);
        if (after === 0) p(OP.SET, FLAGS.id("petals"), 0); else p(OP.ADDF, FLAGS.id("petals"), (after - 100) & 0xFFFF);
        break;
      }
      case "jump": p(OP.JUMP, lab(ins.to)); break;
      case "branch": p(OP.BRANCH, fnId(ins.cond), lab(ins.then), lab(ins.else)); break;
      case "route": p(OP.ROUTE, fnId(ins.f)); break;
      case "end": p(OP.END, ENDS.indexOf(ins.id)); break;
      case "menu": {
        p(OP.MENU, ins.options.length);
        for (const o of ins.options) {
          if (typeof o.label === "function") throw new Error("dynamic menu label unsupported");
          const pr = o.props || {};
          const fx = {}; Object.assign(fx, pr.fx || {}); if (pr.aloof) fx.aloof = (fx.aloof || 0) + pr.aloof;
          const v = STATS.map(k => (fx[k] || 0));
          Object.keys(fx).forEach(k => { if (!STATS.includes(k)) throw new Error("bad fx " + k); });
          const sets = Object.entries(pr.set || {});
          p(strId(o.label), lab(o.goto), pr.req ? fnId(pr.req) : NONE,
            (v[0] & 255) | ((v[1] & 255) << 8), (v[2] & 255) | ((v[3] & 255) << 8), (v[4] & 255) | ((v[5] & 255) << 8), sets.length);
          sets.forEach(([k, val]) => p(FLAGS.id(k), valId(val)));
        }
        break;
      }
      default: throw new Error("unhandled op " + ins.op);
    }
  }
});

/* ---------- endings */
const endRows = ENDS.map(id => {
  const d = VN.endingsDef[id];
  const lines = d.lines.map(l => typeof l === "function" ? (textFns.add(fnId(l)), 0x8000 | fnId(l)) : strId(l));
  return { id, d, lines, title: strId(d.title), hint: strId(d.hint || "") };
});

/* ---------- ensure every flag the C code may read has an id */
const srcAll = files.map(f => fs.readFileSync(path.join(root, f), "utf8")).join("\n");
(srcAll.match(/\bf(?:lags)?\.(\w+)/g) || []).forEach(m => { const n = m.replace(/^f(lags)?\./, ""); if (/^[a-z]\w*$/i.test(n) && !["length", "map", "filter"].includes(n)) { /* only add real flags */ } });
["confessed", "partner", "helpedPapers", "askedCementoss", "wishWho", "reunited", "lightStance", "lightPath", "sparedShigaraki", "foundNote", "petals", "nightWatch", "bonusBring", "petalTotal", "p1route", "p2path", "optedOut", "falconSincere", "pact"].forEach(f => FLAGS.id(f));
["ura", "falcon", "friends", "alone", "fal", "fri", "light", "quiet", "unity", "allied", "defied", "pending_renounce", "renounced", "weaponized", "sidelined", "switch", "uraraka"].forEach(v => VALS.id(v));
// every string literal used as a flag value anywhere in set()/opt props was interned above while compiling

/* ---------- string pool + tables → C */
const strs = STR.list();
let pool = "", offs = [];
strs.forEach(s => { offs.push(pool.length); pool += Buffer.from(s, "utf8").toString("latin1") + "\0"; });
const esc = (s) => { let o = ""; for (const b of Buffer.from(s, "latin1")) o += b >= 32 && b < 127 && b !== 34 && b !== 92 && b !== 63 ? String.fromCharCode(b) : "\\" + b.toString(8).padStart(3, "0"); return o; };
const wrapArr = (name, type, arr, per = 16) => `const ${type} ${name}[${arr.length}] = {\n` + arr.reduce((a, x, i) => a + (i % per === 0 ? "  " : "") + x + "," + ((i % per === per - 1) ? "\n" : " "), "") + "\n};\n";

let c = "/* GENERATED by gba/tools/compile_story.js — do not edit. */\n#include \"story.h\"\n";
c += wrapArr("story_code", "u16", code, 16);
c += wrapArr("story_label_off", "u32", labelOff, 12);
c += wrapArr("story_str_off", "u32", offs, 12);
// the pool as several literals to keep line lengths sane
c += "const char story_pool[] =\n" + pool.split("\0").slice(0, -1).map(s => `  "${esc(s)}\\0"`).join("\n") + ";\n";
const cx = (n) => n; // placeholder
c += `const u16 story_nlabels = ${labelOff.length};\nconst u16 story_nstr = ${strs.length};\nconst u32 story_ncode = ${code.length};\n`;
c += "const EndDef story_ends[] = {\n" + endRows.map(r => `  { ${LABELS.id(r.id)}, ${r.title}, ${r.d.kind === "true" ? 2 : r.d.kind === "good" ? 1 : r.d.kind === "bad" ? 0 : 3}, ${r.d.part}, ${BGS.indexOf(r.d.bg)}, ${MOODS.indexOf(r.d.music)}, ${r.d.weather ? WEATHER.id(r.d.weather) : NONE}, ${r.hint}, ${r.lines.length}, ${r.lines.length > 0 ? "end_lines_" + r.id : "0"} },`).join("\n") + "\n};\n";
c = c.replace("const EndDef story_ends", endRows.map(r => `static const u16 end_lines_${r.id}[] = { ${r.lines.join(", ")} };`).join("\n") + "\nconst EndDef story_ends");
c += `const u8 story_nends = ${ENDS.length};\n`;
c += "const u16 story_end_kinds_unused = 0;\n";
fs.writeFileSync(path.join(out, "story_data.c"), c);

// strings referenced after endings were built (strId may have grown): rebuild if so
if (STR.m.size !== strs.length) { console.error("string pool grew after emit; rerun"); process.exit(2); }

let h = "/* GENERATED by gba/tools/compile_story.js — do not edit. */\n#pragma once\n";
const def = (pre, arr) => arr.forEach((n, i) => { h += `#define ${pre}${n.replace(/[^A-Za-z0-9_]/g, "_")} ${i}\n`; });
def("CH_", CH); h += `#define N_CH ${CH.length}\n`;
def("BG_", BGS); h += `#define N_BG ${BGS.length}\n`;
def("MOOD_", MOODS); h += `#define N_MOOD ${MOODS.length}\n`;
def("WX_", WEATHER.list()); h += `#define N_WX ${WEATHER.m.size}\n`;
def("F_", FLAGS.list()); h += `#define N_FLAGS ${FLAGS.m.size}\n`;
def("V_", VALS.list().map(v => v.replace(/[<>]/g, ""))); h += `#define N_VALS ${VALS.m.size}\n`;
def("L_", ENDS.map(e => e)); h += `#define N_ENDS ${ENDS.length}\n`;
h += `#define N_LABELS ${LABELS.m.size}\n`;
LABELS.list().filter(n => !n.includes("~")).forEach(n => { h += `#define LBL_${n} ${LABELS.id(n)}\n`; });
const ENDLABEL = ENDS.map(e => LABELS.id(e));
h += "#define END_LABELS " + ENDLABEL.join(",") + "\n";
fs.writeFileSync(path.join(out, "story_ids.h"), h);

fs.writeFileSync(path.join(out, "story_ids.json"), JSON.stringify({
  chars: CH.map(k => ({ id: k, name: D.CHARACTERS[k].name, color: hex555(D.CHARACTERS[k].color), file: D.CHARACTERS[k].img })),
  bgs: BGS.map(k => ({ id: k, file: D.BG_DIR + D.BACKGROUNDS[k].file, name: D.BACKGROUNDS[k].name })),
  moods: MOODS, weather: WEATHER.list(), flags: FLAGS.list(), vals: VALS.list(), ends: ENDS,
  endMeta: ENDS.map(e => ({ id: e, title: VN.endingsDef[e].title, part: VN.endingsDef[e].part })),
}, null, 1));

const charSet = new Set(); strs.forEach(t => { for (const ch of t) charSet.add(ch); });
// string literals of dynamic-text functions → C constants T<fn>_<k> (so story_fn.c never retypes story text)
{
  let lit = "/* GENERATED by gba/tools/compile_story.js — do not edit. */\n#pragma once\n";
  const csr = (str) => { let o = ""; for (const b of Buffer.from(str, "utf8")) o += b >= 32 && b < 127 && b !== 34 && b !== 92 && b !== 63 ? String.fromCharCode(b) : "\\" + b.toString(8).padStart(3, "0"); return o; };
  fnSrc.forEach((src, i) => { if (!textFns.has(i)) return; const re = /"((?:[^"\\]|\\.)*)"/g; let m, k = 0; while ((m = re.exec(src))) { { const v = JSON.parse('"' + m[1] + '"'); for (const ch of v) charSet.add(ch); lit += `#define T${i}_${k++} "${csr(v)}"\n`; } } });
  // recapOpen / urarakaReturn live in helper closures: probe them for each Part I ending
  const cases = ["ending_romance", "ending_falcon", "ending_friends", "ending_lonely", null];
  [["RECAP", /recapOpen\(s\)\[0\]/], ["URARETURN", /urarakaReturn\(s\)\[0\]/]].forEach(([nm, re]) => {
    const i0 = fnSrc.findIndex(x => re.test(x)); if (i0 < 0) throw new Error("no " + nm);
    const i1 = fnSrc.findIndex(x => re.test(x.replace("[1]", "[0]")) && x.includes("[1]"));
    lit += `static const char *const ${nm}[5][2] = {\n` + cases.map(c => { const st = { hist: { p1: c }, flags: {}, stats: {}, dead: {} }; const a = fnObj[i0](st), b = fnObj[i1](st); for (const ch of a + b) charSet.add(ch); return `  { "${csr(a)}", "${csr(b)}" },`; }).join("\n") + "\n};\n";
  });
  fs.writeFileSync(path.join(out, "story_fn_lits.h"), lit);
  "Nobody is missing from the line. You carry with now, all of them.Light Yagami".split("").forEach(ch => charSet.add(ch));
  fs.writeFileSync(path.join(out, "story_chars.txt"), [...charSet].sort().join(""));
}
fs.writeFileSync(path.join(out, "story_fn.txt"), fnSrc.map((s, i) => `/* fn ${i} */\n${s}\n`).join("\n"));
const hash = crypto.createHash("sha1").update(FN.list().join("\n")).digest("hex").slice(0, 12);
const want = (() => { try { return fs.readFileSync(path.join(__dirname, "fn_hash.txt"), "utf8").trim(); } catch (e) { return ""; } })();
console.log(`labels ${LABELS.m.size}, code ${code.length} words, strings ${strs.length} (${pool.length} B), fns ${FN.m.size}, flags ${FLAGS.m.size}, vals ${VALS.m.size}, hash ${hash}`);
if (want !== hash) { console.error(`FN HASH MISMATCH: expected "${want}" got "${hash}" — port the changed functions in gba/source/story_fn.c, then write the new hash to gba/tools/fn_hash.txt`); if (process.env.ALLOW_FN_MISMATCH !== "1") process.exit(3); }
