// Usage: node tools/bltest3.js — natural game-over (jar fills with non-matching orbs), unlock flow, mobile screenshot
const { chromium } = require("playwright"); const path = require("path");
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
  pg.on("pageerror", e => console.log("ERR", e.message));
  await pg.goto("file://" + path.join(__dirname, "..", "blossom", "index.html")); await pg.waitForTimeout(500);
  await pg.evaluate(() => { BD.ui.startGame(); });
  await pg.evaluate(async () => { const g = BD.ui.game; g.score = 5400; g.maxTier = 6; g.merges = 30; g.bestCombo = 4;
    for (let i = 0; i < 60; i++) { g.makeOrb([2,4,6,8][i % 4], 60 + (i * 97) % 320, -10 - i * 4, 0, 0); } });
  for (let i = 0; i < 20 && (await pg.evaluate(() => BD.ui.game.state)) !== "over"; i++) await pg.waitForTimeout(700);
  console.log("state:", await pg.evaluate(() => BD.ui.game.state)); await pg.waitForTimeout(1600);
  await pg.screenshot({ path: "/tmp/bl_over.png" });
  console.log("stats:", await pg.evaluate(() => JSON.stringify(BD.loadStats())));
  const m = await b.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  m.on("pageerror", e => console.log("MERR", e.message));
  await m.goto("file://" + path.join(__dirname, "..", "blossom", "index.html")); await m.waitForTimeout(500); await m.screenshot({ path: "/tmp/bl_m_menu.png" });
  await m.evaluate(() => BD.ui.startGame()); await m.waitForTimeout(400);
  await m.evaluate(() => { const g = BD.ui.game; for (let i = 0; i < 14; i++) g.makeOrb(1 + (i % 4), 40 + Math.random() * 360, 300 + Math.random() * 200, 0, 0); g.meter = 100; });
  await m.waitForTimeout(1500); await m.screenshot({ path: "/tmp/bl_m_play.png" });
  await b.close();
})();
