// Usage: node tools/bltest.js  — smoke test + screenshots for Blossom Drop (writes /tmp/bl_*.png)
const { chromium } = require("playwright"); const path = require("path");
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; pg.on("pageerror", e => { errs.push(e.message); console.log("ERR", e.message); });
  pg.on("console", m => { if (m.type() === "error" && !/ERR_TUNNEL|ERR_NAME|ERR_INTERNET|fonts\./.test(m.text())) console.log("console:", m.text()); });
  const url = "file://" + path.join(__dirname, "..", "blossom", "index.html") + (process.argv[2] || "");
  await pg.goto(url); await pg.waitForTimeout(900);
  await pg.screenshot({ path: "/tmp/bl_menu.png" });
  await pg.click("#playBtn"); await pg.waitForTimeout(500);
  for (let i = 0; i < 28; i++) { await pg.mouse.move(380 + (i * 53) % 520, 400); await pg.mouse.down(); await pg.mouse.up(); await pg.waitForTimeout(620); }
  await pg.screenshot({ path: "/tmp/bl_play.png" });
  console.log(await pg.evaluate(() => { const g = BD.ui.game; return JSON.stringify({ state: g.state, score: g.score, orbs: g.orbs.length, max: g.maxTier }); }));
  await b.close(); console.log("errors:", errs.length);
})();
