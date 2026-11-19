// Usage: node tools/cardtest.js <ending_id> <out.png>  — renders a keepsake card with sample stats (via http server needed for export; here we screenshot the canvas)
const { chromium } = require("playwright"); const path = require("path");
(async () => {
  const [id, out] = process.argv.slice(2);
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 700, height: 900 } });
  pg.on("pageerror", e => console.log("ERR", e.message)); pg.on("console", m => m.type()==="error" && !/ERR_TUNNEL|ERR_NAME/.test(m.text()) && console.log(m.text()));
  await pg.goto("file://" + path.join(__dirname, "..", "index.html") + "?test=1");
  await pg.evaluate(async (id) => { const def = VN.endingsDef[id]; const S = VN_CORE.newState(def.part); S.stats = { ura: 9, fri: 7, fal: 5, maki: 4, light: 3 }; S.aloof = 1; S.dead = def.part === 3 ? { falcon: true } : {};
    const cv = await VN_CARD.render(def, S); cv.style.cssText = "position:fixed;inset:0;margin:auto;height:880px;z-index:99999"; document.body.append(cv); }, id);
  await pg.waitForTimeout(300); await pg.screenshot({ path: out }); await b.close();
})();
