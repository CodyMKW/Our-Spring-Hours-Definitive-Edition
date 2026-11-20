// Usage: node tools/bltest2.js — exercises every character's ability + game over + mobile layout
const { chromium } = require("playwright"); const path = require("path");
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; pg.on("pageerror", e => { errs.push(e.message); console.log("ERR", e.message); });
  await pg.goto("file://" + path.join(__dirname, "..", "blossom", "index.html") + "?unlock=all"); await pg.waitForTimeout(600);
  await pg.screenshot({ path: "/tmp/bl_menu2.png" });
  const ids = ["cody","uraraka","joseph","falcon","cementoss","maki","light","shigaraki","allforone"];
  for (const id of ids) {
    await pg.evaluate((id) => { BD.ui.select(id); BD.ui.startGame(); }, id); await pg.waitForTimeout(300);
    // fill the jar with a mess of random orbs
    await pg.evaluate(() => { const g = BD.ui.game; for (let i = 0; i < 26; i++) { g.makeOrb(1 + (i % 4), 40 + Math.random() * 360, 100 + Math.random() * 380, 0, 0); } g.meter = 100; });
    await pg.waitForTimeout(900);
    const ok = await pg.evaluate(() => BD.ui.game.useAbility());
    if (id === "light") { await pg.waitForTimeout(250); await pg.screenshot({ path: "/tmp/bl_decree.png" }); await pg.evaluate(() => BD.ui.game.decree(4)); }
    if (id === "shigaraki") { const st = await pg.evaluate(() => BD.ui.game.state); const pt = await pg.evaluate(() => { const o = BD.ui.game.orbs[0]; return o ? { x: o.position.x, y: o.position.y } : null; }); if (pt) await pg.evaluate((p) => BD.ui.game.pointerDown(p.x, p.y), pt); }
    await pg.waitForTimeout(id === "falcon" || id === "allforone" || id === "cementoss" || id === "uraraka" ? 500 : 250);
    await pg.screenshot({ path: `/tmp/bl_ab_${id}.png` });
    const info = await pg.evaluate(() => { const g = BD.ui.game; return JSON.stringify({ state: g.state, orbs: g.orbs.length, score: g.score }); });
    console.log(id, "used:", ok, info);
    await pg.waitForTimeout(3600);
  }
  // game over
  await pg.evaluate(() => { BD.ui.select("cody"); BD.ui.startGame(); }); await pg.waitForTimeout(300);
  await pg.evaluate(() => { const g = BD.ui.game; g.score = 3200; g.maxTier = 6; for (let i = 0; i < 40; i++) g.makeOrb(5, 60 + (i % 5) * 80, 30 + Math.floor(i / 5) * 5, 0, 0); });
  await pg.waitForTimeout(6000); await pg.screenshot({ path: "/tmp/bl_over.png" });
  console.log("state", await pg.evaluate(() => BD.ui.game.state), "errors", errs.length);
  // mobile
  const m = await b.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  m.on("pageerror", e => console.log("MERR", e.message));
  await m.goto("file://" + path.join(__dirname, "..", "blossom", "index.html")); await m.waitForTimeout(600); await m.screenshot({ path: "/tmp/bl_m_menu.png" });
  await m.evaluate(() => BD.ui.startGame()); await m.waitForTimeout(400);
  await m.evaluate(() => { const g = BD.ui.game; for (let i = 0; i < 14; i++) g.makeOrb(1 + (i % 4), 40 + Math.random() * 360, 300 + Math.random() * 200, 0, 0); });
  await m.waitForTimeout(1500); await m.screenshot({ path: "/tmp/bl_m_play.png" });
  await b.close();
})();
