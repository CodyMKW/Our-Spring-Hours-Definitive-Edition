/* ============================================================================
   dsl.js — the story scripting language.

   Stories (js/story/*.js) are written as *labels*: named lists of instructions,
   a bit like Ren'Py. Menus and conditionals can nest inline; at load time the
   compiler flattens them into plain labels so a save is just {label, idx}.

     const { L, say, n, bg, menu, opt, iff, jump, add, set } = VN;
     L("p1_start",
       bg("hallway"), music("spring"),
       n("The hallway smells like floor wax."),
       say("joseph", "There you are!"),
       menu(
         opt("\"Not my business.\"",  { aloof: 1 }, say("joseph", "Wow. Cool.")),
         opt("\"You have my attention.\"", { fx: { ura: 1 } }, say("joseph", "There he is."))
       ),
       jump("p1_next")
     );

   Instruction reference — see README.md ("Writing story") for the full table.
   ========================================================================== */
(function () {
  "use strict";

  const V = { labels: {}, code: {}, endingsDef: {}, order: [] };

  const flat = (a) => (Array.isArray(a) ? a.flat(Infinity) : [a]).filter(x => x !== null && x !== undefined && x !== false);

  /* ---------------------------------------------------------- instruction ctors */
  const textsOf = (arr) => arr.map(t => (typeof t === "string" || typeof t === "function") ? t : String(t));

  V.say = (who, ...texts) => textsOf(texts).map(t => ({ op: "say", who, text: t }));
  V.n   = (...texts)      => textsOf(texts).map(t => ({ op: "n", text: t }));
  V.bg      = (name, o) => ({ op: "bg", name, keep: !!(o && o.keep), fast: !!(o && o.fast) });
  V.music   = (mood)    => ({ op: "music", mood: mood || null });
  V.weather = (type)    => ({ op: "weather", type: type || null });
  V.enter   = (...who)  => who.map(w => ({ op: "enter", who: w }));
  V.exit    = (...who)  => who.map(w => ({ op: "exit", who: w }));
  V.stage   = (...who)  => ({ op: "stage", who });
  V.clear   = ()        => ({ op: "stage", who: [] });
  V.chapter = (title, sub) => ({ op: "chapter", title, sub: sub || "" });
  /* card: full-screen text card. card("line", "line") or card({part:1,title,sub}) */
  V.card    = (...lines) => (typeof lines[0] === "object" && !Array.isArray(lines[0]))
    ? Object.assign({ op: "card" }, lines[0])
    : { op: "card", lines };
  V.shake   = (strength) => ({ op: "shake", strength: strength || 1 });
  V.flash   = (color)    => ({ op: "flash", color: color || "#fff" });
  V.pulse   = (color)    => ({ op: "pulse", color: color || "#a52a2f" });
  V.wait    = (ms)       => ({ op: "wait", ms: ms || 600 });
  V.sfx     = (name)     => ({ op: "sfx", name });

  /* state changes */
  V.add    = (stat, amt) => ({ op: "add", stat, amt: amt === undefined ? 1 : amt });
  V.aloof  = (amt)       => ({ op: "add", stat: "aloof", amt: amt === undefined ? 1 : amt });
  V.set    = (flag, val) => ({ op: "set", flag, val: val === undefined ? true : val });
  V.kill   = (who)       => ({ op: "kill", who });
  V.fn     = (f)         => ({ op: "fn", f });

  /* control flow */
  V.jump   = (label)     => ({ op: "jump", to: label });
  V.route  = (f)         => ({ op: "route", f });            // f(state) -> label name
  V.end    = (id)        => ({ op: "end", id });
  V.iff    = (cond, then, els) => ({ op: "iff", cond, then: flat(then), else: flat(els || []) });

  /* menu: V.menu(opt(...), opt(...)); opt(label, props, ...body)
     props: { fx:{ura:1,...}, set:{flag:val}, aloof:n, req:(s)=>bool, tag:"text" } */
  V.opt  = (label, props, ...body) => ({ label, props: props || {}, body: flat(body) });
  V.menu = (...options) => ({ op: "menu", options: flat(options) });

  /* ------------------------------------------------------------- label registry */
  V.L = (name, ...body) => {
    if (V.labels[name]) console.warn("[VN] label defined twice:", name);
    V.labels[name] = flat(body);
    V.order.push(name);
  };

  /* Ending definitions (title card + prose). `label` is generated automatically:
     routing to label `<id>` shows the ending. */
  V.ending = (id, def) => {
    V.endingsDef[id] = Object.assign({ id, part: 1, kind: "good", bg: "night_sky", music: "hope", lines: [] }, def);
    V.L(id, V.end(id));
  };

  /* ------------------------------------------------------------------ compiler */
  V.compile = () => {
    const out = {};
    let uid = 0;

    function comp(name, body) {
      const code = [];
      body = flat(body);
      for (let i = 0; i < body.length; i++) {
        const ins = body[i];
        if (ins.op === "menu") {
          const cont = `${name}~c${uid++}`;
          const opts = ins.options.map(o => {
            const ln = `${name}~o${uid++}`;
            comp(ln, [...flat(o.body), V.jump(cont)]);
            return { label: o.label, props: o.props, goto: ln };
          });
          code.push({ op: "menu", options: opts });
          comp(cont, body.slice(i + 1));
          out[name] = code;
          return;
        }
        if (ins.op === "iff") {
          const cont = `${name}~c${uid++}`;
          const t = `${name}~t${uid++}`;
          const e = `${name}~e${uid++}`;
          comp(t, [...flat(ins.then), V.jump(cont)]);
          comp(e, [...flat(ins.else), V.jump(cont)]);
          code.push({ op: "branch", cond: ins.cond, then: t, else: e });
          comp(cont, body.slice(i + 1));
          out[name] = code;
          return;
        }
        code.push(ins);
      }
      out[name] = code;
    }

    Object.keys(V.labels).forEach(name => comp(name, V.labels[name]));
    V.code = out;
    return out;
  };

  /* ----------------------------------------------------------------- validator
     Used by tools/validate.js (node) and the in-browser ?debug mode. */
  V.validate = (known) => {
    const errs = [];
    const TERMINAL = new Set(["jump", "route", "end", "menu", "branch"]);
    Object.keys(V.code).forEach(name => {
      const code = V.code[name];
      if (!code.length) { errs.push(`label "${name}" is empty (falls off the end)`); return; }
      const lastOp = code[code.length - 1].op;
      if (!TERMINAL.has(lastOp)) errs.push(`label "${name}" can fall off its end (last op: ${lastOp})`);
      code.forEach((ins, i) => {
        const at = `${name}[${i}]`;
        if (ins.op === "jump" && !V.code[ins.to]) errs.push(`${at}: jump to missing label "${ins.to}"`);
        if (ins.op === "branch") {
          if (!V.code[ins.then]) errs.push(`${at}: bad branch`);
        }
        if (ins.op === "bg" && known && !known.bgs[ins.name]) errs.push(`${at}: unknown background "${ins.name}"`);
        if ((ins.op === "say" || ins.op === "enter" || ins.op === "exit" || ins.op === "kill") && ins.who && ins.who !== "cody-thought" && known && !known.chars[ins.who]) errs.push(`${at}: unknown character "${ins.who}"`);
        if (ins.op === "stage" && known) ins.who.forEach(w => { if (!known.chars[w]) errs.push(`${at}: unknown character "${w}"`); });
        if (ins.op === "music" && ins.mood && known && !known.moods.includes(ins.mood)) errs.push(`${at}: unknown mood "${ins.mood}"`);
        if (ins.op === "weather" && ins.type && known && !known.fx.includes(ins.type)) errs.push(`${at}: unknown weather "${ins.type}"`);
        if (ins.op === "end" && !V.endingsDef[ins.id]) errs.push(`${at}: end("${ins.id}") has no ending definition`);
        if (ins.op === "add" && !["ura", "fri", "fal", "maki", "light", "aloof"].includes(ins.stat)) errs.push(`${at}: unknown stat "${ins.stat}"`);
        if (ins.op === "menu") ins.options.forEach(o => { if (!V.code[o.goto]) errs.push(`${at}: option goes to missing label`); });
      });
    });
    return errs;
  };

  window.VN = V;
})();
