// Usage: node tools/playtest.js [runs]  — random playthroughs of all 3 parts in headless Chromium.
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const runs = +process.argv[2] || 6;
  const b = await chromium.launch();
  const url = "file://" + path.join(__dirname, "..", "index.html") + "?test=1&debug";
  const seen = {}; let errors = 0;
  for (let r = 0; r < runs; r++) {
    const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
    pg.on("console", m => { if (["error","warning"].includes(m.type()) && !/ERR_TUNNEL|ERR_NAME|ERR_INTERNET/.test(m.text())) { errors++; console.log("[console]", m.text()); } });
    pg.on("pageerror", e => { errors++; console.log("[pageerror]", e.message); });
    await pg.goto(url);
    await pg.waitForTimeout(300);
    if (r === 0) await pg.screenshot({ path: "/tmp/title.png" });
    await pg.evaluate(() => Game.newGame(1));
    let steps = 0, shot = 0;
    while (steps++ < 4000) {
      const st = await pg.evaluate(() => ({ end: !!Game.mode.ending, ch: !!Game.mode.choosing, part: Game.S && Game.S.part, n: Game.S && Game.S.choiceCount }));
      if (st.end) {
        const id = await pg.evaluate(() => Game.S.hist["p" + Game.S.part]);
        seen[id] = (seen[id] || 0) + 1;
        if (r < 3) await pg.screenshot({ path: `/tmp/end_${r}_${id}.png` });
        if (st.part >= 3) break;
        await pg.evaluate(() => { const S = Game.S; const next = VN_CORE.carryOver(S, S.part + 1); Game.startFromState(next); });
        continue;
      }
      if (st.ch) {
        const k = await pg.evaluate(() => document.querySelectorAll("#choices button").length);
        if (r === 0 && shot++ < 1) await pg.screenshot({ path: "/tmp/choice.png" });
        await pg.evaluate((i) => Game.choose(i), Math.floor(Math.random() * k));
      } else {
        if (r === 0 && steps === 60) await pg.screenshot({ path: "/tmp/dialog.png" });
        await pg.evaluate(() => Game.advance());
      }
      await pg.waitForTimeout(8);
    }
    await pg.close();
  }
  console.log("endings seen:", seen, "errors:", errors);
  await b.close();
})();
