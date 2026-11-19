const { chromium } = require("playwright"); const path = require("path"); const fs = require("fs");
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1100, height: 800 } });
  pg.on("pageerror", e => console.log("ERR", e.message)); pg.on("console", m => m.type()==="error" && !/ERR_TUNNEL|ERR_NAME/.test(m.text()) && console.log(m.text()));
  await pg.goto("file://" + path.join(__dirname, "..", "index.html") + "?test=1");
  await pg.screenshot({ path: "/tmp/t1.png" });
  // fake carry file
  const S = await pg.evaluate(() => { const s = VN_CORE.newState(1); s.stats = { ura: 9, fri: 7, fal: 5, maki: 0, light: 0 }; s.hist.p1 = "ending_true";
    return { osh: "definitive", nextPart: 2, state: VN_CORE.carryOver(JSON.parse(JSON.stringify(s)), 2), final: { stats: s.stats, aloof: 0, flags: {}, dead: {} }, ending: { id: "ending_true", title: "x", part: 1 } }; });
  fs.writeFileSync("/tmp/carry.json", JSON.stringify(S));
  await pg.click("text=✦ Cards");
  await pg.setInputFiles("input[type=file]", "/tmp/carry.json");
  await pg.waitForTimeout(800);
  await pg.screenshot({ path: "/tmp/t2.png" }); await b.close();
})();
