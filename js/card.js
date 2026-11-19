/* ============================================================================
   card.js — VN_CARD: draws a collectible "keepsake" trading card (PNG) for an
   ending: the ending's art, your cast, your bond stats, rarity by ending type.
     VN_CARD.render(def, state) -> Promise<HTMLCanvasElement>   (600 x 860)
     VN_CARD.open(def, state)    -> shows it in a modal with a Download button
   Note: browsers block canvas export for images loaded from file://, so
   Download only works when hosted (GitHub Pages etc.); locally the card still
   displays and can be screenshotted.
   ========================================================================== */
(function () {
  "use strict";
  const D = window.VN_DATA;
  const W = 600, H = 860;
  const RARITY = {
    true:    { name: "HOLOGRAPHIC", a: "#ffe8a3", b: "#e0a93b", c: "#7a4a12", holo: true },
    good:    { name: "SILVER",      a: "#f1f4f8", b: "#a9b4c2", c: "#3d4654" },
    neutral: { name: "BRONZE",      a: "#f0c9a0", b: "#b97a45", c: "#53301a" },
    bad:     { name: "ASHEN",       a: "#bdb7b5", b: "#6b6462", c: "#262222" },
  };
  const PART = { 1: ["PART I", "Our Spring Hours"], 2: ["PART II", "Ashfall"], 3: ["PART III", "Last Light"] };
  const STATS = [["ura", "Uraraka", "#ff6f8f", 1], ["fri", "Friendship", "#5b93c7", 1], ["fal", "Falcon", "#7fa25c", 1],
                 ["maki", "Maki", "#d0642f", 2], ["light", "Light", "#c9a56a", 2]];
  const imgCache = {};
  const load = (src) => imgCache[src] || (imgCache[src] = new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }));

  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function cover(c, img, x, y, w, h) { const s = Math.max(w / img.width, h / img.height), iw = w / s, ih = h / s; c.drawImage(img, (img.width - iw) / 2, (img.height - ih) / 2, iw, ih, x, y, w, h); }
  function wrap(c, text, x, y, maxW, lh, maxLines) {
    const words = text.split(" "); let line = "", n = 0;
    for (const w of words) { const t = line ? line + " " + w : w; if (c.measureText(t).width > maxW && line) { c.fillText(line, x, y); y += lh; line = w; if (++n >= maxLines) return y; } else line = t; }
    c.fillText(line, x, y); return y + lh;
  }

  async function render(def, S) {
    const R = RARITY[def.kind] || RARITY.good, part = def.part;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const c = cv.getContext("2d");
    const bgFile = (D.BACKGROUNDS[def.bg] || {}).file;
    const [bgImg, ...faces] = await Promise.all([bgFile ? load(D.BG_DIR + bgFile) : null,
      ...["cody", "uraraka", "falcon", "joseph", "cementoss", "maki", "light"].map(k => load(D.CHARACTERS[k].img))]);
    const face = { cody: faces[0], uraraka: faces[1], falcon: faces[2], joseph: faces[3], cementoss: faces[4], maki: faces[5], light: faces[6] };

    // outer frame
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, R.a); g.addColorStop(.5, R.b); g.addColorStop(1, R.c);
    rr(c, 0, 0, W, H, 34); c.fillStyle = g; c.fill();
    c.save(); rr(c, 14, 14, W - 28, H - 28, 26); c.clip();
    c.fillStyle = "#17141f"; c.fillRect(0, 0, W, H);

    // header
    c.fillStyle = R.a; c.font = "700 15px Nunito, system-ui, sans-serif"; c.textBaseline = "alphabetic";
    c.fillText(`${PART[part][0]} · ${PART[part][1].toUpperCase()}`, 38, 54);
    c.textAlign = "right"; c.fillStyle = R.b; c.fillText(R.name, W - 38, 54); c.textAlign = "left";
    c.fillStyle = "#fff"; c.font = "800 38px Baloo 2, Nunito, system-ui, sans-serif";
    let size = 38; while (c.measureText(def.title).width > W - 76 && size > 20) { size -= 2; c.font = `800 ${size}px Baloo 2, Nunito, system-ui, sans-serif`; }
    c.fillText(def.title, 38, 98);

    // art window
    const ax = 36, ay = 116, aw = W - 72, ah = 340;
    c.save(); rr(c, ax, ay, aw, ah, 16); c.clip();
    if (bgImg) cover(c, bgImg, ax, ay, aw, ah); else { c.fillStyle = "#2a2540"; c.fillRect(ax, ay, aw, ah); }
    const vg = c.createLinearGradient(0, ay, 0, ay + ah); vg.addColorStop(0, "rgba(0,0,0,.05)"); vg.addColorStop(1, "rgba(0,0,0,.6)");
    c.fillStyle = vg; c.fillRect(ax, ay, aw, ah);
    // cast: Cody in front, the three closest bonds beside him
    const st = S.stats;
    const mates = [["uraraka", st.ura], ["falcon", st.fal], ["maki", part >= 2 ? st.maki : -1], ["light", part >= 2 ? st.light : -1], ["joseph", 4], ["cementoss", 4]]
      .filter(m => m[1] >= 0).sort((a, b) => b[1] - a[1]).slice(0, 4).map(m => m[0]);
    const spots = [[.2, .62, 120], [.8, .62, 120], [.07, .78, 92], [.93, .78, 92]];
    mates.forEach((k, i) => {
      const im = face[k]; if (!im) return; const [fx, fy, hh] = spots[i], ww = hh * im.width / im.height;
      const gone = part === 3 && S.dead && S.dead[k];
      c.save(); if (gone) c.filter = "grayscale(1) brightness(.5)"; c.globalAlpha = gone ? .75 : 1;
      c.drawImage(im, ax + aw * fx - ww / 2, ay + ah * fy - hh / 2 + 34, ww, hh); c.restore();
    });
    if (face.cody) { const hh = 190, ww = hh * face.cody.width / face.cody.height; c.drawImage(face.cody, ax + aw / 2 - ww / 2, ay + ah - hh + 8, ww, hh); }
    if (R.holo) { // holographic sheen
      const hg = c.createLinearGradient(ax, ay, ax + aw, ay + ah);
      ["rgba(255,120,180,.0)", "rgba(255,230,120,.22)", "rgba(120,255,220,.18)", "rgba(140,160,255,.22)", "rgba(255,120,180,.0)"].forEach((col, i) => hg.addColorStop(i / 4, col));
      c.globalCompositeOperation = "screen"; c.fillStyle = hg; c.fillRect(ax, ay, aw, ah); c.globalCompositeOperation = "source-over";
    }
    c.restore();
    c.strokeStyle = R.b; c.lineWidth = 2.5; rr(c, ax, ay, aw, ah, 16); c.stroke();

    // summary
    c.fillStyle = R.a; c.font = "italic 600 17px Nunito, system-ui, sans-serif";
    let y = wrap(c, "“" + (def.summary || "") + "”", 38, 490, W - 76, 22, 1);

    // stats
    const rows = STATS.filter(s => s[3] <= (part >= 2 ? 2 : 1));
    const cap = part === 1 ? 14 : part === 2 ? 16 : 18;
    y = 520;
    c.font = "700 14px Nunito, system-ui, sans-serif";
    rows.forEach(([k, label, col]) => {
      const v = Math.max(0, S.stats[k] || 0), pct = Math.min(1, v / cap);
      c.fillStyle = "#d9d4e6"; c.fillText(label, 38, y + 12);
      c.fillStyle = "rgba(255,255,255,.10)"; rr(c, 150, y, 330, 15, 7.5); c.fill();
      if (pct > 0) { c.fillStyle = col; rr(c, 150, y, Math.max(15, 330 * pct), 15, 7.5); c.fill(); }
      c.fillStyle = "#fff"; c.textAlign = "right"; c.fillText(String(Math.round(v * 10) / 10), W - 38, y + 12); c.textAlign = "left";
      y += 26;
    });
    // distance (aloof) as a plain line
    c.fillStyle = "#d9d4e6"; c.fillText("Distance kept", 38, y + 12);
    c.fillStyle = "rgba(255,255,255,.10)"; rr(c, 150, y, 330, 15, 7.5); c.fill();
    const ap = Math.min(1, (S.aloof || 0) / 8); if (ap > 0) { c.fillStyle = "#8a84a3"; rr(c, 150, y, Math.max(15, 330 * ap), 15, 7.5); c.fill(); }
    c.fillStyle = "#fff"; c.textAlign = "right"; c.fillText(String(S.aloof || 0), W - 38, y + 12); c.textAlign = "left";

    // closest bond + collection
    const best = rows.slice().sort((a, b) => (S.stats[b[0]] || 0) - (S.stats[a[0]] || 0))[0];
    y += 62;
    c.strokeStyle = "rgba(255,255,255,.14)"; c.lineWidth = 1; c.beginPath(); c.moveTo(38, y - 18); c.lineTo(W - 38, y - 18); c.stroke();
    c.fillStyle = "#9a94b3"; c.font = "700 12px Nunito, system-ui, sans-serif"; c.fillText("CLOSEST BOND", 38, y);
    c.fillStyle = best ? best[2] : "#fff"; c.font = "800 22px Baloo 2, Nunito, system-ui, sans-serif"; c.fillText(best && (S.stats[best[0]] || 0) > 0 ? best[1] : "Nobody, yet", 38, y + 26);
    try {
      const G = window.VN_CORE.Global.d, tot = Object.keys(window.VN.endingsDef).length, got = Object.keys(G.endings || {}).length;
      c.textAlign = "right"; c.fillStyle = "#9a94b3"; c.font = "700 12px Nunito, system-ui, sans-serif"; c.fillText("ENDINGS FOUND", W - 38, y);
      c.fillStyle = R.a; c.font = "800 22px Baloo 2, Nunito, system-ui, sans-serif"; c.fillText(`${got} / ${tot}`, W - 38, y + 26); c.textAlign = "left";
    } catch (e) {}

    // footer
    const lost = part === 3 ? Object.keys(S.dead || {}).filter(k => S.dead[k]).length : 0;
    c.fillStyle = R.b; c.font = "600 13px Nunito, system-ui, sans-serif";
    const foot = part === 3 ? (lost ? `${lost} lost on the battlegrounds` : "Everyone came home") : (def.kind === "true" ? "True ending" : "Ending");
    c.fillText(foot, 38, H - 44);
    c.textAlign = "right"; c.fillText("OUR SPRING HOURS · DEFINITIVE EDITION", W - 38, H - 44); c.textAlign = "left";
    c.restore();
    c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 1.5; rr(c, 14, 14, W - 28, H - 28, 26); c.stroke();
    return cv;
  }

  async function open(def, S) {
    const UI = window.VN_UI;
    const cv = await render(def, S);
    cv.style.cssText = "max-width:100%;max-height:70vh;border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,.5)";
    const wrap = document.createElement("div"); wrap.style.cssText = "text-align:center";
    const msg = document.createElement("p"); msg.className = "muted small";
    const b = document.createElement("button"); b.type = "button"; b.className = "btn primary"; b.textContent = "Download PNG"; b.style.marginTop = "12px";
    b.onclick = () => {
      try { cv.toBlob((blob) => { if (!blob) { msg.textContent = "Download is blocked when the game is opened from a file. Host it, or take a screenshot."; return; }
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `our-spring-hours-${def.id}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, "image/png"); }
      catch (e) { msg.textContent = "Download is blocked when the game is opened from a file (browser security). Host it, or take a screenshot."; }
    };
    wrap.append(cv, document.createElement("br"), b, msg);
    UI.openModal("Keepsake card", wrap, { back: null });
  }
  window.VN_CARD = { render, open };
})();
