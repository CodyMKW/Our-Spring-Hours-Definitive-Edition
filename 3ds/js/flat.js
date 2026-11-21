/* flat.js — string-only facade over Rt so the C host never has to walk JS objects.
   Records are separated by \x1e, fields by \x1f, list items inside a field by \x1d, sub-fields of an item by \x1c. */
(function () {
  "use strict";
  var RS = "\x1e", FS = "\x1f", LS = "\x1d", SS = "\x1c";
  var L = function (a) { return (a || []).join(LS); };
  var B = function (b) { return b ? "1" : "0"; };
  var S = function (s) { return s == null ? "" : String(s); };
  var ENC = {
    scene: function (e) { return [e.bg, L(e.stage), e.music, e.weather, e.part]; },
    bg: function (e) { return [e.name, B(e.fast)]; },
    stage: function (e) { return [L(e.stage), e.speaker]; },
    music: function (e) { return [e.mood]; }, weather: function (e) { return [e.type]; }, sfx: function (e) { return [e.name]; },
    banner: function (e) { return [e.title, e.sub]; },
    line: function (e) { return [e.who, e.name, e.color, e.text, B(e.say)]; },
    menu: function (e) { return [L(e.options)]; },
    card: function (e) { return [e.part, e.eyebrow, e.title, e.sub, L(e.lines)]; },
    wait: function (e) { return [e.ms]; }, shake: function (e) { return [e.strength]; },
    flash: function (e) { return [e.color]; }, pulse: function (e) { return [e.color]; },
    toast: function (e) { return [e.msg]; }, error: function (e) { return [e.msg]; },
    ending: function (e) {
      return [e.id, e.title, e.kind, e.part, e.partName, e.hint, B(e.fresh), e.got, e.total, L(e.lines),
        (e.cast || []).map(function (c) { return [c.name, B(c.ok), c.text].join(SS); }).join(LS), e.bg, e.music, e.weather, e.next];
    },
  };
  function rec(e) { var f = ENC[e.t]; return [e.t].concat(f ? f(e).map(S) : []).join(FS); }
  window.Flat = {
    events: function () { return Rt.poll().map(rec).join(RS); },
    title: function () {
      var t = Rt.titleInfo(), la = t.latest;
      var head = [la ? la.slot : "", la ? la.part : "", la ? la.chapter : "", la ? la.snippet : "", B(t.bonus), t.endings.got, t.endings.total].map(S).join(FS);
      var parts = t.parts.map(function (p) { return [p.n, p.name, B(p.unlocked), B(p.carry), p.presets.map(function (x) { return x.id + SS + x.title; }).join(LS)].map(S).join(FS); }).join(RS);
      return head + "\x1b" + parts;
    },
    slots: function () { return Rt.slots().map(function (s) { return [s.slot, B(s.empty), s.part, s.chapter, s.snippet].map(S).join(FS); }).join(RS); },
    log: function () { return Rt.log().map(function (l) { return [l.who, l.color, l.text].map(S).join(FS); }).join(RS); },
    endings: function () { return Rt.endings().map(function (e) { return [e.id, e.title, e.part, e.kind, e.hint, B(e.got)].map(S).join(FS); }).join(RS); },
    progress: function () { var p = Rt.progress(); return p.endings.join(",") + "|" + (p.sparedShigaraki ? "1" : "0"); },
    mode: function () { var m = Rt.state(); return (m.playing ? "p" : "") + (m.ending ? "e" : "") + (m.choosing ? "c" : "") + (m.card ? "k" : "") + (m.waiting ? "w" : ""); },
  };
})();
