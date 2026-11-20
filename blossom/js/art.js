/* ============================================================================
   art.js — every picture in Blossom Drop is drawn here with canvas paths, so
   there are no extra image files. Orb sprites are rendered once per tier at the
   current pixel ratio and cached.

     BD.art.orb(tier, px)   -> canvas (px x px) with the finished orb
     BD.art.icon(tier, px)  -> same, used for the evolution chart / queue
   ========================================================================== */
(function (BD) {
  "use strict";
  const TAU = Math.PI * 2;

  /* ------------------------------------------------------------ small helpers */
  function lg(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
  function rg(ctx, x0, y0, r0, x1, y1, r1, stops) { const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
  function ell(ctx, x, y, rx, ry, rot) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU); }
  function shade(hex, amt) { // amt -1..1 (dark..light)
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }

  /* ------------------------------------------------------------ icon painters
     Sticker style: bold warm outline, gradient fill, glossy highlight, and a
     tiny kawaii face on the food/moon orbs. Unit space: origin at the orb
     centre, the orb radius is 1, icons fill roughly ±0.72.                    */
  function petalPath(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.bezierCurveTo(-w * 1.1, h * 0.35, -w * 0.95, -h * 0.75, -w * 0.12, -h);
    ctx.lineTo(0, -h * 0.82);
    ctx.lineTo(w * 0.12, -h);
    ctx.bezierCurveTo(w * 0.95, -h * 0.75, w * 1.1, h * 0.35, 0, h);
    ctx.closePath();
  }
  function drawPetal(ctx, w, h, c1, c2, vein) {
    petalPath(ctx, w, h);
    ctx.fillStyle = lg(ctx, 0, -h, 0, h, [[0, c1], [1, c2]]); ctx.fill();
    ctx.lineWidth = 0.02; ctx.strokeStyle = "rgba(170,45,95,.55)"; ctx.stroke();
    if (vein) { ctx.beginPath(); ctx.moveTo(0, h * 0.85); ctx.quadraticCurveTo(0, 0, 0, -h * 0.6); ctx.strokeStyle = "rgba(190,70,110,.35)"; ctx.lineWidth = 0.014; ctx.stroke(); }
  }

  function stroke(ctx, color, w) { ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); }
  function gloss(ctx, x, y, rx, ry, rot, a) { ctx.fillStyle = `rgba(255,255,255,${a == null ? 0.6 : a})`; ell(ctx, x, y, rx, ry, rot || 0); ctx.fill(); }
  function face(ctx, x, y, s, ink, blush) {      // two dot eyes, smile, blush
    ctx.fillStyle = ink; ell(ctx, x - 0.2 * s, y, 0.052 * s, 0.07 * s); ctx.fill(); ell(ctx, x + 0.2 * s, y, 0.052 * s, 0.07 * s); ctx.fill();
    ctx.fillStyle = "#fff"; ell(ctx, x - 0.21 * s, y - 0.025 * s, 0.018 * s, 0.022 * s); ctx.fill(); ell(ctx, x + 0.19 * s, y - 0.025 * s, 0.018 * s, 0.022 * s); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y + 0.035 * s, 0.07 * s, 0.15 * Math.PI, 0.85 * Math.PI); stroke(ctx, ink, 0.03 * s);
    ctx.fillStyle = blush; ell(ctx, x - 0.34 * s, y + 0.1 * s, 0.07 * s, 0.045 * s); ctx.fill(); ell(ctx, x + 0.34 * s, y + 0.1 * s, 0.07 * s, 0.045 * s); ctx.fill();
  }
  function sleepFace(ctx, x, y, s, ink, blush) {
    ctx.beginPath(); ctx.arc(x - 0.2 * s, y, 0.07 * s, 0.1 * Math.PI, 0.9 * Math.PI); stroke(ctx, ink, 0.03 * s);
    ctx.beginPath(); ctx.arc(x + 0.2 * s, y, 0.07 * s, 0.1 * Math.PI, 0.9 * Math.PI); stroke(ctx, ink, 0.03 * s);
    ctx.beginPath(); ctx.arc(x, y + 0.08 * s, 0.045 * s, 0.1 * Math.PI, 0.9 * Math.PI); stroke(ctx, ink, 0.026 * s);
    ctx.fillStyle = blush; ell(ctx, x - 0.34 * s, y + 0.08 * s, 0.07 * s, 0.045 * s); ctx.fill(); ell(ctx, x + 0.34 * s, y + 0.08 * s, 0.07 * s, 0.045 * s); ctx.fill();
  }
  // a cherry petal with the little heart-shaped notch at the tip
  function petalShape(ctx, w, h) {
    ctx.beginPath(); ctx.moveTo(0, h);
    ctx.bezierCurveTo(-w * 1.15, h * 0.45, -w * 1.05, -h * 0.7, -w * 0.2, -h * 0.98);
    ctx.quadraticCurveTo(-w * 0.05, -h * 0.8, 0, -h * 0.74);
    ctx.quadraticCurveTo(w * 0.05, -h * 0.8, w * 0.2, -h * 0.98);
    ctx.bezierCurveTo(w * 1.05, -h * 0.7, w * 1.15, h * 0.45, 0, h); ctx.closePath();
  }
  function fillPetal(ctx, w, h, c1, c2, line, olw) {
    petalShape(ctx, w, h); ctx.fillStyle = lg(ctx, 0, -h, 0, h, [[0, c1], [1, c2]]); ctx.fill(); stroke(ctx, line, olw);
  }
  // draw several circles as ONE silhouette (outline only around the union)
  function blobCluster(ctx, list, outline, olw, fillFn) {
    ctx.fillStyle = outline; list.forEach(([x, y, r]) => { ell(ctx, x, y, r + olw / 2, (r + olw / 2) * 0.94); ctx.fill(); });
    list.forEach((b, i) => { fillFn(b, i); ell(ctx, b[0], b[1], b[2], b[2] * 0.94); ctx.fill(); });
  }

  const ICONS = {
    /* 1 — a drifting cherry petal (with a smaller one behind it) */
    1(ctx) {
      ctx.save(); ctx.rotate(0.55); ctx.translate(0.3, -0.34); ctx.scale(0.5, 0.5); fillPetal(ctx, 0.3, 0.5, "#ffe6ef", "#ffa6c4", "#c44d7b", 0.07); ctx.restore();
      ctx.save(); ctx.rotate(-0.42); ctx.translate(-0.02, 0.02);
      fillPetal(ctx, 0.43, 0.78, "#ffffff", "#ff86ad", "#b8386a", 0.045);
      ctx.beginPath(); ctx.moveTo(0, 0.7); ctx.quadraticCurveTo(0.03, 0.05, 0, -0.5); stroke(ctx, "rgba(200,70,115,.5)", 0.024);
      ctx.beginPath(); ctx.moveTo(0.01, 0.35); ctx.quadraticCurveTo(0.15, 0.2, 0.22, -0.05); ctx.moveTo(-0.01, 0.4); ctx.quadraticCurveTo(-0.14, 0.2, -0.22, 0); stroke(ctx, "rgba(200,70,115,.3)", 0.016);
      gloss(ctx, -0.17, -0.3, 0.06, 0.18, 0.25, 0.7);
      ctx.restore();
    },
    /* 2 — a plump bud */
    2(ctx) {
      ctx.translate(0, -0.02);
      ctx.strokeStyle = "#3f8a47"; ctx.lineWidth = 0.07; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, 0.45); ctx.quadraticCurveTo(0.02, 0.62, 0.1, 0.74); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -0.68); ctx.bezierCurveTo(0.68, -0.4, 0.66, 0.3, 0, 0.46); ctx.bezierCurveTo(-0.66, 0.3, -0.68, -0.4, 0, -0.68); ctx.closePath();
      ctx.fillStyle = lg(ctx, -0.4, -0.6, 0.4, 0.5, [[0, "#ffe3ec"], [0.55, "#ff86ad"], [1, "#e0457f"]]); ctx.fill(); stroke(ctx, "#a82e60", 0.05);
      ctx.beginPath(); ctx.moveTo(0, -0.62); ctx.bezierCurveTo(-0.34, -0.22, -0.32, 0.2, 0, 0.4); stroke(ctx, "rgba(150,35,85,.45)", 0.026);
      ctx.beginPath(); ctx.moveTo(0, -0.62); ctx.bezierCurveTo(0.34, -0.22, 0.32, 0.2, 0, 0.4); stroke(ctx, "rgba(150,35,85,.3)", 0.02);
      gloss(ctx, -0.3, -0.18, 0.07, 0.2, 0.28, 0.65);
      [[-1], [1]].forEach(([d]) => { ctx.beginPath(); ctx.moveTo(0, 0.48); ctx.quadraticCurveTo(d * 0.42, 0.44, d * 0.5, 0.12); ctx.quadraticCurveTo(d * 0.2, 0.2, 0, 0.48); ctx.closePath(); ctx.fillStyle = lg(ctx, 0, 0.1, 0, 0.5, [[0, "#7fd07a"], [1, "#43a24c"]]); ctx.fill(); stroke(ctx, "#2f7a3a", 0.04); });
    },
    /* 3 — a full five-petal blossom */
    3(ctx) {
      for (let i = 0; i < 5; i++) { ctx.save(); ctx.rotate(i * TAU / 5); ctx.translate(0, -0.37); fillPetal(ctx, 0.27, 0.38, "#ffffff", "#ffb0cb", "#c4507d", 0.04); ctx.restore(); }
      ctx.fillStyle = rg(ctx, 0, 0, 0.02, 0, 0, 0.24, [[0, "#ff6f9c"], [1, "#ffc4d8"]]); ell(ctx, 0, 0, 0.2, 0.2); ctx.fill();
      for (let i = 0; i < 5; i++) { const a = i * TAU / 5 - Math.PI / 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 0.04, Math.sin(a) * 0.04); ctx.lineTo(Math.cos(a) * 0.3, Math.sin(a) * 0.3); stroke(ctx, "#c4507d", 0.026); ctx.fillStyle = "#ffcf4a"; ell(ctx, Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0.055, 0.055); ctx.fill(); stroke(ctx, "#c98a14", 0.016); }
      ctx.fillStyle = "#ffe27a"; ell(ctx, 0, 0, 0.07, 0.07); ctx.fill();
    },
    /* 4 — dango skewer, each dumpling has a face */
    4(ctx) {
      ctx.rotate(-0.55);
      ctx.beginPath(); ctx.moveTo(0, -0.86); ctx.lineTo(0, 0.86); stroke(ctx, "#8a5f33", 0.12); ctx.beginPath(); ctx.moveTo(0, -0.86); ctx.lineTo(0, 0.86); stroke(ctx, "#d9a869", 0.07);
      [[-0.5, "#ffd6e2", "#f4789f", "#b8386a"], [0, "#ffffff", "#e9e2d6", "#9a8f80"], [0.5, "#d6f0b0", "#85bd52", "#4f8a2f"]].forEach(([y, a, b, line], i) => {
        ctx.fillStyle = rg(ctx, -0.1, y - 0.12, 0.03, 0, y, 0.32, [[0, a], [1, b]]); ell(ctx, 0, y, 0.31, 0.29); ctx.fill(); stroke(ctx, line, 0.045);
        gloss(ctx, -0.12, y - 0.15, 0.08, 0.045, -0.55, 0.65);
        ctx.save(); ctx.translate(0, y + 0.02); ctx.rotate(0.55); face(ctx, 0, 0.0, 0.62, line, "rgba(255,120,150,.45)"); ctx.restore();
      });
    },
    /* 5 — onigiri with a happy face */
    5(ctx) {
      ctx.translate(0, 0.04);
      const body = () => { ctx.beginPath(); ctx.moveTo(0, -0.66); ctx.bezierCurveTo(0.14, -0.66, 0.74, 0.2, 0.72, 0.42); ctx.bezierCurveTo(0.7, 0.66, 0.48, 0.66, 0, 0.66); ctx.bezierCurveTo(-0.48, 0.66, -0.7, 0.66, -0.72, 0.42); ctx.bezierCurveTo(-0.74, 0.2, -0.14, -0.66, 0, -0.66); ctx.closePath(); };
      body(); ctx.fillStyle = lg(ctx, 0, -0.66, 0, 0.66, [[0, "#ffffff"], [1, "#d9e2ee"]]); ctx.fill();
      ctx.save(); body(); ctx.clip();
      ctx.fillStyle = lg(ctx, 0, 0.2, 0, 0.7, [[0, "#33494a"], [1, "#16201f"]]); ctx.fillRect(-0.9, 0.22, 1.8, 0.6);
      ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(-0.9, 0.25, 1.8, 0.035);
      ctx.restore();
      body(); stroke(ctx, "#4a5a78", 0.05);
      face(ctx, 0, -0.02, 0.9, "#3a2c3c", "rgba(255,120,150,.5)");
      gloss(ctx, -0.2, -0.32, 0.06, 0.12, 0.5, 0.7);
      ctx.fillStyle = "#f06a8e"; ell(ctx, 0.3, -0.18, 0.05, 0.035, 0.4); ctx.fill();   // tiny umeboshi
    },
    /* 6 — a round, smiling tomato */
    6(ctx) {
      ctx.translate(0, 0.1);
      const body = () => { ctx.beginPath(); ctx.moveTo(0, -0.46); ctx.bezierCurveTo(0.26, -0.7, 0.8, -0.5, 0.76, 0.06); ctx.bezierCurveTo(0.74, 0.56, 0.4, 0.7, 0, 0.68); ctx.bezierCurveTo(-0.4, 0.7, -0.74, 0.56, -0.76, 0.06); ctx.bezierCurveTo(-0.8, -0.5, -0.26, -0.7, 0, -0.46); ctx.closePath(); };
      body(); ctx.fillStyle = rg(ctx, -0.2, -0.16, 0.05, 0, 0.05, 0.8, [[0, "#ff9482"], [0.55, "#ee4533"], [1, "#a61f19"]]); ctx.fill(); stroke(ctx, "#8a1a14", 0.04);
      gloss(ctx, -0.38, -0.12, 0.08, 0.18, 0.55, 0.65);
      face(ctx, 0.04, 0.17, 0.9, "#4a0f0c", "rgba(255,200,190,.5)");
      ctx.fillStyle = "#58b857";
      for (let i = 0; i < 6; i++) { ctx.save(); ctx.translate(0, -0.46); ctx.rotate(i * TAU / 6 + 0.2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(0.14, 0.14, 0, 0.34); ctx.quadraticCurveTo(-0.14, 0.14, 0, 0); ctx.fillStyle = i % 2 ? "#4aa84d" : "#66c765"; ctx.fill(); stroke(ctx, "#2a7233", 0.03); ctx.restore(); }
      ctx.beginPath(); ctx.moveTo(0, -0.46); ctx.quadraticCurveTo(0.03, -0.62, 0.12, -0.7); stroke(ctx, "#2f7a3a", 0.07);
    },
    /* 7 — a glowing paper lantern */
    7(ctx) {
      ctx.scale(0.9, 0.9); ctx.translate(0, 0.02);
      ctx.beginPath(); ctx.moveTo(0, -0.84); ctx.lineTo(0, -0.62); stroke(ctx, "#5a3a22", 0.04);
      const body = () => { ctx.beginPath(); ctx.moveTo(-0.28, -0.6); ctx.bezierCurveTo(-0.86, -0.42, -0.86, 0.42, -0.28, 0.6); ctx.lineTo(0.28, 0.6); ctx.bezierCurveTo(0.86, 0.42, 0.86, -0.42, 0.28, -0.6); ctx.closePath(); };
      body(); ctx.fillStyle = rg(ctx, 0, -0.02, 0.04, 0, 0, 0.78, [[0, "#fff6c9"], [0.4, "#ffc24f"], [1, "#e4631a"]]); ctx.fill();
      ctx.save(); body(); ctx.clip();
      ctx.strokeStyle = "rgba(150,50,10,.5)"; ctx.lineWidth = 0.022; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 0.09, -0.6); ctx.bezierCurveTo(i * 0.4, -0.3, i * 0.4, 0.3, i * 0.09, 0.6); ctx.stroke(); }
      ctx.restore(); body(); stroke(ctx, "#8e3a0e", 0.05);
      ctx.fillStyle = "rgba(190,40,30,.85)"; for (let i = 0; i < 5; i++) { ctx.save(); ctx.rotate(i * TAU / 5); ctx.translate(0, -0.1); ell(ctx, 0, 0, 0.045, 0.075); ctx.fill(); ctx.restore(); } ell(ctx, 0, 0, 0.04, 0.04); ctx.fillStyle = "#ffe27a"; ctx.fill();
      [-1, 1].forEach(d => { ctx.fillStyle = "#3a2733"; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-0.3, d < 0 ? -0.72 : 0.58, 0.6, 0.14, 0.04) : ctx.rect(-0.3, d < 0 ? -0.72 : 0.58, 0.6, 0.14); ctx.fill(); stroke(ctx, "#1c1219", 0.025); });
      ctx.beginPath(); ctx.moveTo(0, 0.72); ctx.lineTo(0, 0.88); stroke(ctx, "#ffd25a", 0.04); ctx.fillStyle = "#ffcf4a"; ell(ctx, 0, 0.9, 0.05, 0.07); ctx.fill(); stroke(ctx, "#c98a14", 0.02);
      gloss(ctx, -0.42, -0.12, 0.06, 0.22, 0.12, 0.45);
    },
    /* 8 — an omamori wish charm */
    8(ctx) {
      ctx.scale(0.9, 0.9); ctx.translate(0, 0.04);
      const body = () => { ctx.beginPath(); ctx.moveTo(-0.46, -0.5); ctx.quadraticCurveTo(0, -0.64, 0.46, -0.5); ctx.lineTo(0.52, 0.56); ctx.quadraticCurveTo(0, 0.72, -0.52, 0.56); ctx.closePath(); };
      body(); ctx.fillStyle = lg(ctx, -0.5, -0.6, 0.5, 0.7, [[0, "#c4aaf7"], [1, "#6b47c4"]]); ctx.fill(); stroke(ctx, "#33206e", 0.05);
      ctx.save(); body(); ctx.clip(); ctx.fillStyle = "#ffd25a"; ctx.fillRect(-0.6, -0.52, 1.2, 0.1); ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(-0.6, -0.42, 1.2, 0.03); ctx.restore();
      ctx.setLineDash([0.05, 0.05]); ctx.beginPath(); ctx.moveTo(-0.4, -0.34); ctx.lineTo(-0.44, 0.52); ctx.moveTo(0.4, -0.34); ctx.lineTo(0.44, 0.52); stroke(ctx, "rgba(255,244,207,.7)", 0.02); ctx.setLineDash([]);
      ctx.fillStyle = "#fff4cf"; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-0.3, -0.12, 0.6, 0.5, 0.06) : ctx.rect(-0.3, -0.12, 0.6, 0.5); ctx.fill(); stroke(ctx, "#c9a24a", 0.03);
      for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(0, 0.13); ctx.rotate(i * TAU / 5); ctx.translate(0, -0.1); fillPetal(ctx, 0.06, 0.09, "#fff", "#ff93b8", "#c4507d", 0.016); ctx.restore(); }
      ctx.fillStyle = "#ffcf4a"; ell(ctx, 0, 0.13, 0.045, 0.045); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -0.56); ctx.bezierCurveTo(-0.3, -0.92, 0.3, -0.92, 0, -0.56); stroke(ctx, "#a8741a", 0.075); ctx.beginPath(); ctx.moveTo(0, -0.56); ctx.bezierCurveTo(-0.3, -0.92, 0.3, -0.92, 0, -0.56); stroke(ctx, "#ffd25a", 0.04);
      ctx.beginPath(); ctx.moveTo(0, 0.62); ctx.lineTo(-0.12, 0.86); ctx.moveTo(0, 0.62); ctx.lineTo(0.12, 0.86); stroke(ctx, "#a8302f", 0.08); ctx.beginPath(); ctx.moveTo(0, 0.62); ctx.lineTo(-0.12, 0.86); ctx.moveTo(0, 0.62); ctx.lineTo(0.12, 0.86); stroke(ctx, "#ff6f8e", 0.04);
      gloss(ctx, -0.32, -0.32, 0.05, 0.12, 0.3, 0.5);
    },
    /* 9 — a sleepy full moon */
    9(ctx) {
      ctx.fillStyle = "rgba(255,246,190,.35)"; ell(ctx, 0, 0, 0.84, 0.84); ctx.fill();
      ctx.fillStyle = rg(ctx, -0.2, -0.2, 0.05, 0, 0, 0.68, [[0, "#fffef2"], [0.7, "#fbe596"], [1, "#e6b94c"]]); ell(ctx, 0, 0, 0.68, 0.68); ctx.fill(); stroke(ctx, "#a97a1c", 0.05);
      ctx.fillStyle = "rgba(190,145,55,.3)"; [[-0.36, -0.34, 0.12], [0.4, 0.3, 0.14], [0.34, -0.38, 0.07], [-0.42, 0.36, 0.08]].forEach(([x, y, r]) => { ell(ctx, x, y, r, r * 0.9); ctx.fill(); });
      sleepFace(ctx, 0, 0.02, 1.15, "#7a5516", "rgba(255,150,120,.5)");
      gloss(ctx, -0.28, -0.4, 0.09, 0.05, -0.6, 0.7);
      [[0.74, -0.5, 0.1], [-0.76, 0.42, 0.075], [0.6, 0.62, 0.06], [-0.62, -0.62, 0.06]].forEach(([x, y, r]) => star(ctx, x, y, r));
    },
    /* 10 — the cherry tree in full bloom */
    10(ctx) {
      ctx.translate(0, 0.06);
      ctx.fillStyle = "rgba(255,255,255,.18)"; ell(ctx, 0, 0.62, 0.55, 0.1); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-0.14, 0.64); ctx.quadraticCurveTo(-0.08, 0.2, -0.2, -0.1); ctx.lineTo(0.2, -0.1); ctx.quadraticCurveTo(0.1, 0.2, 0.16, 0.64); ctx.closePath();
      ctx.fillStyle = lg(ctx, -0.15, 0, 0.15, 0, [[0, "#8b563c"], [1, "#573422"]]); ctx.fill(); stroke(ctx, "#35190d", 0.045);
      ctx.beginPath(); ctx.moveTo(-0.06, 0.2); ctx.lineTo(-0.34, -0.06); ctx.moveTo(0.06, 0.2); ctx.lineTo(0.34, -0.04); stroke(ctx, "#35190d", 0.11); ctx.beginPath(); ctx.moveTo(-0.06, 0.2); ctx.lineTo(-0.34, -0.06); ctx.moveTo(0.06, 0.2); ctx.lineTo(0.34, -0.04); stroke(ctx, "#6e4630", 0.06);
      const blobs = [[0, -0.36, 0.38], [-0.4, -0.2, 0.3], [0.4, -0.2, 0.3], [-0.22, -0.58, 0.28], [0.24, -0.58, 0.28], [0, -0.12, 0.3]];
      blobCluster(ctx, blobs, "#b8386a", 0.07, ([x, y, r], i) => { ctx.fillStyle = rg(ctx, x - r * .35, y - r * .4, r * .1, x, y, r * 1.05, [[0, i % 2 ? "#ffe4ee" : "#fff4f8"], [1, i % 2 ? "#ff8fb8" : "#ffaecb"]]); });
      ctx.fillStyle = "#ff6f9c"; [[-0.2, -0.3], [0.22, -0.38], [0.04, -0.6], [-0.42, -0.18], [0.44, -0.16], [-0.08, -0.08], [0.26, -0.05]].forEach(([x, y]) => { for (let i = 0; i < 5; i++) { ell(ctx, x + Math.cos(i * 1.256) * 0.035, y + Math.sin(i * 1.256) * 0.035, 0.026, 0.026); ctx.fill(); } });
      ctx.fillStyle = "rgba(255,255,255,.8)"; [[-0.14, -0.5], [0.3, -0.52], [-0.34, -0.3]].forEach(([x, y]) => { ell(ctx, x, y, 0.06, 0.035, 0.5); ctx.fill(); });
      [[0.5, 0.5, 0.4], [-0.5, 0.34, -0.5], [0.66, 0.1, 0.8]].forEach(([x, y, r]) => { ctx.save(); ctx.translate(x, y); ctx.rotate(r); fillPetal(ctx, 0.07, 0.1, "#fff", "#ff93b8", "#c4507d", 0.02); ctx.restore(); });
    },
  };
  function star(ctx, x, y, r) {
    ctx.save(); ctx.translate(x, y); ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8, rr = i % 2 ? r * 0.35 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fillStyle = "#fff"; ctx.globalAlpha = 0.9; ctx.fill(); ctx.restore();
  }

  /* ------------------------------------------------------------ the orb body */
  function paintOrb(tier, px) {
    const cv = document.createElement("canvas"); cv.width = cv.height = px;
    const ctx = cv.getContext("2d");
    const [c1, c2, c3] = BD.TIERS[tier - 1].c;
    const R = px / 2 - 1.5, cx = px / 2, cy = px / 2;
    // body
    ctx.fillStyle = rg(ctx, cx - R * 0.35, cy - R * 0.4, R * 0.08, cx, cy, R, [[0, c1], [0.62, c2], [1, c3]]);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    // inner rim light (bottom) for volume
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    ctx.fillStyle = rg(ctx, cx, cy + R * 0.95, R * 0.1, cx, cy + R * 0.95, R * 0.9, [[0, "rgba(255,255,255,.28)"], [1, "rgba(255,255,255,0)"]]);
    ctx.fillRect(0, 0, px, px);
    ctx.restore();
    // icon
    ctx.save(); ctx.translate(cx, cy + R * 0.02); ctx.scale(R * 0.98, R * 0.98);
    ICONS[tier](ctx);
    ctx.restore();
    // glass highlight
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    ctx.fillStyle = lg(ctx, cx, cy - R, cx, cy, [[0, "rgba(255,255,255,.5)"], [1, "rgba(255,255,255,0)"]]);
    ctx.beginPath(); ctx.ellipse(cx - R * 0.12, cy - R * 0.55, R * 0.62, R * 0.36, -0.28, 0, TAU); ctx.fill();
    ctx.restore();
    // crisp outline
    ctx.lineWidth = Math.max(1.5, R * 0.035); ctx.strokeStyle = shade(c3, -0.25);
    ctx.beginPath(); ctx.arc(cx, cy, R - ctx.lineWidth / 2, 0, TAU); ctx.stroke();
    ctx.lineWidth = Math.max(1, R * 0.02); ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.beginPath(); ctx.arc(cx, cy, R - ctx.lineWidth * 2.4, Math.PI * 1.05, Math.PI * 1.7); ctx.stroke();
    return cv;
  }

  const cache = new Map();
  function orb(tier, px) {
    px = Math.max(8, Math.round(px));
    const key = tier + ":" + px;
    if (!cache.has(key)) cache.set(key, paintOrb(tier, px));
    return cache.get(key);
  }

  /* ------------------------------------------------------------ jar pieces */
  // Wooden planter frame + soil; drawn once into a layer and reused.
  function paintFrame(scale) {
    const W = BD.CW, H = BD.CH, cv = document.createElement("canvas");
    cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
    const c = cv.getContext("2d"); c.scale(scale, scale);
    const L = BD.PAD_X, R = BD.PAD_X + BD.JAR_W, T = BD.TOP, B = BD.TOP + BD.JAR_H;
    const wood = (x, y, w, h, vertical) => {
      c.fillStyle = vertical ? lg(c, x, 0, x + w, 0, [[0, "#c68a55"], [0.5, "#e3ad78"], [1, "#a96d3f"]]) : lg(c, 0, y, 0, y + h, [[0, "#e8b585"], [0.5, "#c88a55"], [1, "#9a6038"]]);
      c.fillRect(x, y, w, h);
      c.strokeStyle = "rgba(90,50,25,.22)"; c.lineWidth = 1;
      for (let i = 0; i < (vertical ? 5 : 9); i++) { c.beginPath(); if (vertical) { const gx = x + 4 + i * (w - 8) / 4; c.moveTo(gx, y); c.bezierCurveTo(gx + 2, y + h * .3, gx - 2, y + h * .6, gx, y + h); } else { const gy = y + 3 + i * (h - 6) / 8; c.moveTo(x, gy); c.bezierCurveTo(x + w * .3, gy + 1.5, x + w * .6, gy - 1.5, x + w, gy); } c.stroke(); }
      c.strokeStyle = "rgba(60,30,10,.45)"; c.lineWidth = 1.5; c.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
    };
    // soil floor
    c.fillStyle = lg(c, 0, B - 26, 0, B + 12, [[0, "#6b4a33"], [1, "#4a3022"]]);
    c.fillRect(L - 6, B - 18, BD.JAR_W + 12, 40);
    // grass tufts along the soil line
    for (let x = L; x < R; x += 7) { const h = 6 + ((x * 13) % 7); c.fillStyle = (x / 7) % 2 ? "#6fb85f" : "#59a14d"; c.beginPath(); c.moveTo(x - 3, B - 14); c.quadraticCurveTo(x - 1, B - 14 - h, x + 1, B - 14 - h - 3); c.quadraticCurveTo(x + 2, B - 14 - h / 2, x + 4, B - 14); c.fill(); }
    // side posts + bottom plank
    wood(L - 30, T - 24, 30, BD.JAR_H + 24 + 44, true);
    wood(R, T - 24, 30, BD.JAR_H + 24 + 44, true);
    wood(L - 30, B + 4, BD.JAR_W + 60, 40, false);
    // top caps
    [[L - 36, 28], [R - 4, 28]].forEach(([x, w]) => { c.fillStyle = lg(c, 0, T - 40, 0, T - 20, [[0, "#f3c897"], [1, "#c88a55"]]); c.beginPath(); c.roundRect ? c.roundRect(x, T - 40, w + 12, 20, 6) : c.rect(x, T - 40, w + 12, 20); c.fill(); c.strokeStyle = "rgba(60,30,10,.45)"; c.lineWidth = 1.5; c.stroke(); });
    // nails
    c.fillStyle = "#4a3022"; [[L - 15, T + 20], [L - 15, T + 300], [R + 15, T + 20], [R + 15, T + 300]].forEach(([x, y]) => { ell(c, x, y, 2.6, 2.6); c.fill(); });
    // little cherry petals stuck on the frame
    c.fillStyle = "rgba(255,170,200,.95)"; [[L - 20, B - 40, 0.4], [R + 22, T + 120, -0.8], [L + 60, B + 26, 0.1], [R - 90, B + 24, 1.1]].forEach(([x, y, r]) => { c.save(); c.translate(x, y); c.rotate(r); c.scale(7, 7); petalPath(c, 0.5, 0.8); c.fill(); c.restore(); });
    return cv;
  }


  /* ------------------------------------------------------------ stone (multiplayer garbage) */
  const stoneCache = {};
  function stone(px) {
    px = Math.max(8, Math.round(px)); if (stoneCache[px]) return stoneCache[px];
    const cv = document.createElement("canvas"); cv.width = cv.height = px; const c = cv.getContext("2d"), R = px / 2;
    c.translate(R, R); const r = R * 0.94;
    c.fillStyle = rg(c, -r * 0.3, -r * 0.35, r * 0.1, 0, 0, r, [[0, "#d9ced8"], [0.55, "#9d909c"], [1, "#6d6170"]]);
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.lineWidth = Math.max(1.5, px * 0.03); c.strokeStyle = "rgba(55,40,60,.75)"; c.stroke();
    c.strokeStyle = "rgba(60,45,66,.45)"; c.lineWidth = Math.max(1, px * 0.022); c.lineCap = "round";
    c.beginPath(); c.moveTo(r * 0.2, -r * 0.88); c.lineTo(r * 0.05, -r * 0.45); c.lineTo(r * 0.3, -r * 0.2); c.stroke();
    c.beginPath(); c.moveTo(-r * 0.75, r * 0.35); c.lineTo(-r * 0.45, r * 0.38); c.lineTo(-r * 0.38, r * 0.62); c.stroke();
    // sleepy face
    c.strokeStyle = "rgba(45,30,52,.85)"; c.lineWidth = Math.max(1.6, px * 0.04);
    c.beginPath(); c.arc(-r * 0.3, -r * 0.02, r * 0.13, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    c.beginPath(); c.arc(r * 0.3, -r * 0.02, r * 0.13, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    c.beginPath(); c.arc(0, r * 0.28, r * 0.09, 0, TAU); c.stroke();
    c.fillStyle = "rgba(255,255,255,.5)"; ell(c, -r * 0.42, -r * 0.5, r * 0.28, r * 0.14, -0.6); c.fill();
    return (stoneCache[px] = cv);
  }
  BD.art = { orb, icon: orb, paintFrame, shade, stone };
})(window.BD);
