// Usage: node tools/shot.js <label> <lineSteps> <out.png> [w h]
const { chromium } = require("playwright"); const path = require("path");
(async () => {
  const [label, steps, out, w, h] = process.argv.slice(2);
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: +w || 1280, height: +h || 720 } });
  await pg.goto("file://" + path.join(__dirname, "..", "index.html") + "?test=1");
  await pg.evaluate((l) => { Game.startFromState(Object.assign(VN_CORE.newState(1), { label: l, idx: 0 })); }, label);
  for (let i = 0; i < +steps; i++) { await pg.evaluate(() => { if (Game.mode.choosing) Game.choose(0); else Game.advance(); }); await pg.waitForTimeout(40); }
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: out }); await b.close();
})();
