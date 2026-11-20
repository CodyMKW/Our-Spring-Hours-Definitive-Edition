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
     Each draws in a unit space: origin at the orb centre, ~±0.6 fits inside.   */
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

  const ICONS = {
    /* 1 — a single petal, tilted */
    1(ctx) {
      ctx.rotate(-0.5);
      drawPetal(ctx, 0.34, 0.58, "#ffffff", "#ff7fa6", true);
    },
    /* 2 — a closed bud with a sepal */
    2(ctx) {
      ctx.translate(0, -0.02);
      ctx.fillStyle = "#6fbf6a"; ctx.beginPath(); ctx.moveTo(-0.04, 0.55); ctx.quadraticCurveTo(0, 0.2, 0.04, 0.55); ctx.fill();
      ctx.fillStyle = lg(ctx, 0, -0.5, 0, 0.35, [[0, "#ffd4e2"], [1, "#ff5f93"]]);
      ctx.beginPath(); ctx.moveTo(0, -0.52); ctx.bezierCurveTo(0.42, -0.28, 0.44, 0.22, 0, 0.36); ctx.bezierCurveTo(-0.44, 0.22, -0.42, -0.28, 0, -0.52); ctx.fill();
      ctx.strokeStyle = "rgba(170,40,90,.4)"; ctx.lineWidth = 0.014; ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.beginPath(); ctx.moveTo(0, -0.46); ctx.bezierCurveTo(-0.3, -0.2, -0.25, 0.2, 0, 0.3); ctx.bezierCurveTo(-0.12, 0.05, -0.12, -0.2, 0, -0.46); ctx.fill();
      ctx.fillStyle = "#58ad5b";
      ctx.beginPath(); ctx.moveTo(0, 0.38); ctx.quadraticCurveTo(-0.3, 0.3, -0.34, 0.1); ctx.quadraticCurveTo(-0.12, 0.2, 0, 0.38); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 0.38); ctx.quadraticCurveTo(0.3, 0.3, 0.34, 0.1); ctx.quadraticCurveTo(0.12, 0.2, 0, 0.38); ctx.fill();
    },
    /* 3 — five-petal cherry blossom */
    3(ctx) {
      for (let i = 0; i < 5; i++) { ctx.save(); ctx.rotate(i * TAU / 5); ctx.translate(0, -0.27); drawPetal(ctx, 0.22, 0.3, "#fff", "#ffb3cb", false); ctx.restore(); }
      ctx.fillStyle = rg(ctx, 0, 0, 0, 0, 0, 0.16, [[0, "#ffd36b"], [1, "#e0709c"]]); ell(ctx, 0, 0, 0.14, 0.14); ctx.fill();
      ctx.strokeStyle = "#c04a78"; ctx.lineWidth = 0.018;
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + 0.2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 0.1, Math.sin(a) * 0.1); ctx.lineTo(Math.cos(a) * 0.27, Math.sin(a) * 0.27); ctx.stroke(); ctx.fillStyle = "#ffd25a"; ell(ctx, Math.cos(a) * 0.28, Math.sin(a) * 0.28, 0.035, 0.035); ctx.fill(); }
    },
    /* 4 — dango skewer (pink, white, green) */
    4(ctx) {
      ctx.rotate(-0.6);
      ctx.strokeStyle = "#b98a54"; ctx.lineWidth = 0.05; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, -0.62); ctx.lineTo(0, 0.62); ctx.stroke();
      [[-0.37, "#ffc9d8", "#f07ea0"], [0, "#ffffff", "#e8e1d5"], [0.37, "#cdeaa8", "#8fc25e"]].forEach(([y, a, b]) => {
        ctx.fillStyle = rg(ctx, -0.08, y - 0.08, 0.02, 0, y, 0.22, [[0, a], [1, b]]); ell(ctx, 0, y, 0.21, 0.21); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,.14)"; ctx.lineWidth = 0.014; ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,.5)"; ell(ctx, -0.07, y - 0.08, 0.06, 0.035, -0.5); ctx.fill();
      });
    },
    /* 5 — onigiri */
    5(ctx) {
      ctx.translate(0, 0.02);
      ctx.beginPath(); ctx.moveTo(0, -0.5); ctx.bezierCurveTo(0.12, -0.5, 0.52, 0.18, 0.5, 0.32); ctx.bezierCurveTo(0.48, 0.5, 0.36, 0.5, 0, 0.5); ctx.bezierCurveTo(-0.36, 0.5, -0.48, 0.5, -0.5, 0.32); ctx.bezierCurveTo(-0.52, 0.18, -0.12, -0.5, 0, -0.5); ctx.closePath();
      ctx.fillStyle = lg(ctx, 0, -0.5, 0, 0.5, [[0, "#ffffff"], [1, "#dfe6ee"]]); ctx.fill();
      ctx.strokeStyle = "rgba(60,80,110,.3)"; ctx.lineWidth = 0.016; ctx.stroke();
      ctx.save(); ctx.clip();
      ctx.fillStyle = lg(ctx, 0, 0.12, 0, 0.5, [[0, "#2b3a3a"], [1, "#16201f"]]); ctx.fillRect(-0.6, 0.14, 1.2, 0.5);
      ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(-0.6, 0.16, 1.2, 0.03);
      ctx.restore();
      ctx.fillStyle = "#e86a8a"; ell(ctx, 0, -0.1, 0.07, 0.05); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.55)"; ell(ctx, -0.12, -0.22, 0.05, 0.08, 0.5); ctx.fill();
    },
    /* 6 — tomato with calyx */
    6(ctx) {
      ctx.translate(0, 0.06);
      ctx.fillStyle = rg(ctx, -0.14, -0.12, 0.04, 0, 0, 0.56, [[0, "#ff8a76"], [0.6, "#e8402f"], [1, "#a82019"]]);
      ctx.beginPath(); ctx.moveTo(0, -0.34); ctx.bezierCurveTo(0.22, -0.52, 0.6, -0.36, 0.56, 0.04); ctx.bezierCurveTo(0.54, 0.4, 0.3, 0.52, 0, 0.5); ctx.bezierCurveTo(-0.3, 0.52, -0.54, 0.4, -0.56, 0.04); ctx.bezierCurveTo(-0.6, -0.36, -0.22, -0.52, 0, -0.34); ctx.fill();
      ctx.strokeStyle = "rgba(110,15,10,.35)"; ctx.lineWidth = 0.02; ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.55)"; ell(ctx, -0.26, -0.12, 0.07, 0.14, 0.6); ctx.fill();
      ctx.fillStyle = "#4eae52";
      for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(0, -0.36); ctx.rotate(i * TAU / 5 + 0.3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(0.1, 0.12, 0, 0.26); ctx.quadraticCurveTo(-0.1, 0.12, 0, 0); ctx.fill(); ctx.restore(); }
      ctx.strokeStyle = "#3b8f43"; ctx.lineWidth = 0.05; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, -0.36); ctx.quadraticCurveTo(0.03, -0.5, 0.1, -0.56); ctx.stroke();
    },
    /* 7 — paper lantern */
    7(ctx) {
      ctx.fillStyle = "#2f2330"; ctx.fillRect(-0.2, -0.56, 0.4, 0.08); ctx.fillRect(-0.2, 0.46, 0.4, 0.08);
      ctx.fillStyle = rg(ctx, -0.1, -0.1, 0.05, 0, 0, 0.55, [[0, "#fff0bf"], [0.55, "#ffb347"], [1, "#e0661a"]]);
      ctx.beginPath(); ctx.moveTo(-0.2, -0.48); ctx.bezierCurveTo(-0.62, -0.3, -0.62, 0.3, -0.2, 0.48); ctx.lineTo(0.2, 0.48); ctx.bezierCurveTo(0.62, 0.3, 0.62, -0.3, 0.2, -0.48); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(140,50,10,.45)"; ctx.lineWidth = 0.016;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 0.05, -0.48); ctx.bezierCurveTo(i * 0.28, -0.25, i * 0.28, 0.25, i * 0.05, 0.48); ctx.stroke(); }
      ctx.strokeStyle = "#ffe08a"; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(0, 0.54); ctx.lineTo(0, 0.7); ctx.stroke();
      ctx.fillStyle = "#ffd25a"; ell(ctx, 0, 0.7, 0.03, 0.05); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.3)"; ell(ctx, -0.22, -0.08, 0.06, 0.2, 0.1); ctx.fill();
    },
    /* 8 — omamori wish charm */
    8(ctx) {
      ctx.translate(0, 0.02);
      ctx.fillStyle = lg(ctx, -0.3, -0.5, 0.3, 0.5, [[0, "#b69bf2"], [1, "#6d4bc0"]]);
      ctx.beginPath(); ctx.moveTo(-0.3, -0.36); ctx.quadraticCurveTo(0, -0.46, 0.3, -0.36); ctx.lineTo(0.34, 0.4); ctx.quadraticCurveTo(0, 0.5, -0.34, 0.4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(40,20,90,.45)"; ctx.lineWidth = 0.018; ctx.stroke();
      ctx.fillStyle = "#ffe08a"; ctx.fillRect(-0.3, -0.34, 0.6, 0.05);
      ctx.fillStyle = "#fff4cf"; ctx.fillRect(-0.28, -0.06, 0.56, 0.3);
      ctx.fillStyle = "#e0709c"; for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(0, 0.09); ctx.rotate(i * TAU / 5); ctx.translate(0, -0.07); ell(ctx, 0, 0, 0.04, 0.06); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = "#ffd25a"; ell(ctx, 0, 0.09, 0.03, 0.03); ctx.fill();
      ctx.strokeStyle = "#ffd25a"; ctx.lineWidth = 0.035; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, -0.4); ctx.bezierCurveTo(-0.2, -0.62, 0.2, -0.62, 0, -0.4); ctx.stroke();
      ctx.strokeStyle = "#e0709c"; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(0, 0.46); ctx.lineTo(-0.08, 0.62); ctx.moveTo(0, 0.46); ctx.lineTo(0.08, 0.62); ctx.stroke();
    },
    /* 9 — moon */
    9(ctx) {
      ctx.fillStyle = rg(ctx, -0.14, -0.14, 0.04, 0, 0, 0.5, [[0, "#fffdf0"], [1, "#f1d176"]]); ell(ctx, 0, 0, 0.5, 0.5); ctx.fill();
      ctx.fillStyle = "rgba(180,140,50,.32)"; [[-0.18, -0.12, 0.1], [0.2, 0.05, 0.13], [-0.05, 0.25, 0.07], [0.12, -0.28, 0.06]].forEach(([x, y, r]) => { ell(ctx, x, y, r, r); ctx.fill(); });
      ctx.fillStyle = "#fff"; [[0.52, -0.38, 0.06], [-0.55, 0.3, 0.045], [0.42, 0.46, 0.04]].forEach(([x, y, r]) => { star(ctx, x, y, r); });
    },
    /* 10 — cherry tree in bloom */
    10(ctx) {
      ctx.translate(0, 0.06);
      ctx.fillStyle = lg(ctx, -0.1, 0, 0.1, 0, [[0, "#7a4b34"], [1, "#4f2e1f"]]);
      ctx.beginPath(); ctx.moveTo(-0.1, 0.52); ctx.quadraticCurveTo(-0.06, 0.15, -0.14, -0.08); ctx.lineTo(0.14, -0.08); ctx.quadraticCurveTo(0.06, 0.15, 0.1, 0.52); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#5e3826"; ctx.lineWidth = 0.05; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-0.04, 0.1); ctx.lineTo(-0.28, -0.14); ctx.moveTo(0.04, 0.1); ctx.lineTo(0.28, -0.12); ctx.stroke();
      const blobs = [[0, -0.34, 0.3], [-0.3, -0.18, 0.24], [0.3, -0.18, 0.24], [-0.16, -0.46, 0.2], [0.18, -0.46, 0.2], [0, -0.14, 0.24]];
      blobs.forEach(([x, y, r], i) => { ctx.fillStyle = rg(ctx, x - r * .3, y - r * .3, r * .1, x, y, r, [[0, i % 2 ? "#ffdbe8" : "#fff0f5"], [1, i % 2 ? "#ff8db4" : "#ffa9c7"]]); ell(ctx, x, y, r, r * 0.92); ctx.fill(); });
      ctx.fillStyle = "rgba(255,255,255,.75)"; [[-0.12, -0.4], [0.14, -0.3], [0.02, -0.52], [-0.28, -0.14], [0.3, -0.1]].forEach(([x, y]) => { ell(ctx, x, y, 0.035, 0.035); ctx.fill(); });
      ctx.fillStyle = "#ff8db4"; [[0.1, 0.5], [-0.2, 0.52], [0.26, 0.48]].forEach(([x, y]) => { ell(ctx, x, y, 0.05, 0.028, 0.4); ctx.fill(); });
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
    ctx.save(); ctx.translate(cx, cy + R * 0.02); ctx.scale(R * 1.02, R * 1.02);
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
