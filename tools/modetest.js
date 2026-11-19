const { chromium } = require("playwright"); const path = require("path");
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  pg.on("pageerror", e => console.log("ERR", e.message));
  await pg.goto("file://" + path.join(__dirname, "..", "index.html"));   // NOT test mode: real timing
  await pg.evaluate(() => Game.newGame(1));
  await pg.waitForTimeout(6000);
  for (const mode of ["auto", "skip"]) {
    await pg.evaluate(() => { for (let i=0;i<3;i++) Game.advance(); });
    await pg.waitForTimeout(800);
    const before = await pg.evaluate(() => Game.S.lines);
    await pg.click(`[data-act=${mode}]`);
    for (let k=0;k<8;k++){ await pg.waitForTimeout(2500); console.log(mode, k, await pg.evaluate(()=>Game.S.lines+" "+Game.mode.typing+" "+Game.mode.card)); }
    const after = await pg.evaluate(() => ({ l: Game.S.lines, m: JSON.stringify(Game.mode) }));
    console.log(mode, "lines", before, "->", after.l, after.m);
    await pg.evaluate(() => { Game.stopAuto(); Game.stopSkip(); });
  }
  await b.close();
})();
