// Renders the web version's orb art (blossom/js/art.js, BD.art.orb) for the 3DS at 32/64/128 px: orbS_T.png (S = size, T = tier 1..10).
// The results are committed in 3ds/assets/orbs/ (build_assets.py copies them), so CI doesn't need a browser.
// usage: node 3ds/tools/render_orbs.js [OUT_DIR]     (needs playwright + its chromium)
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "..");
const out = process.argv[2] || path.join(root, "3ds", "assets", "orbs");
fs.mkdirSync(out, { recursive: true });
let chromium; try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require("/usr/lib/node_modules/playwright")); }
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.setContent("<html><body></body></html>");
  await p.addScriptTag({ content: "window.BD={};window.localStorage.clear();" });
  for (const f of ["blossom/js/data.js", "blossom/js/art.js"]) await p.addScriptTag({ content: fs.readFileSync(path.join(root, f), "utf8") });
  for (let t = 1; t <= 10; t++) {
    for (const px of [32, 64, 128]) {
      const data = await p.evaluate(([t, px]) => BD.art.orb(t, px).toDataURL("image/png"), [t, px]);
      fs.writeFileSync(path.join(out, `orb${px}_${t}.png`), Buffer.from(data.split(",")[1], "base64"));
    }
  }
  await b.close(); console.log("wrote 30 orb sprites to", out);
})();
