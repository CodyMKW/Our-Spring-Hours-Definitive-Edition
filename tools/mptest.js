// Usage: node tools/mptest.js — two pages play each other over the LOCAL (BroadcastChannel) link on a throw-away http server.
// Covers: names exchanged, host/join, countdown, same seed, snapshots mirrored, attack/cancel, game over → result, rematch, screenshots.
const { chromium } = require("playwright"); const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".json": "application/json" };
const srv = http.createServer((q, r) => { let f = path.join(root, decodeURIComponent(q.url.split("?")[0])); if (f.endsWith("/")) f += "index.html"; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { "Content-Type": mime[path.extname(f)] || "application/octet-stream" }); r.end(d); } }); });
const ok = (c, m) => console.log((c ? "PASS " : "FAIL ") + m);
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = "http://localhost:" + srv.address().port + "/blossom/multiplayer.html?net=local&unlock=all";
  const b = await chromium.launch({ args: ["--disable-renderer-backgrounding", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows"] }); const ctx = await b.newContext({ viewport: { width: 1366, height: 700 } });
  const A = await ctx.newPage(), B = await ctx.newPage(); const errs = [];
  for (const [n, p] of [["A", A], ["B", B]]) p.on("pageerror", e => errs.push(n + ": " + e.message));
  if (process.env.MOBILE) await A.setViewportSize({ width: 390, height: 780 });
  await A.goto(base); await B.goto(base); await A.waitForTimeout(500);
  await A.fill("#nameIn", "Sakura"); await B.fill("#nameIn", "Kenji");
  await A.evaluate(() => BD.vs.select("falcon")); await B.evaluate(() => BD.vs.select("uraraka"));
  await A.click("#hostBtn"); await A.waitForSelector("#stepRoom:not([hidden])"); const code = await A.textContent("#roomCode"); ok(/^[A-Z]{5}$/.test(code), "room code " + code);
  await B.click("#tabJoin"); await B.fill("#codeIn", code.toLowerCase()); await B.click("#joinBtn"); await B.waitForSelector("#stepRoom:not([hidden])");
  await A.waitForTimeout(500);
  ok((await A.textContent("#ppOpp .pp-name")) === "Kenji", "host sees guest name"); ok((await B.textContent("#ppOpp .pp-name")) === "Sakura", "guest sees host name");
  ok((await A.textContent("#ppOpp .pp-char")).startsWith("Uraraka"), "host sees guest character");
  ok(await B.isHidden("#startBtn"), "guest has no Start button"); ok(await A.isEnabled("#startBtn"), "host Start enabled");
  await A.screenshot({ path: "/tmp/mp_lobby_host.png" }); await B.screenshot({ path: "/tmp/mp_lobby_guest.png" });
  await A.click("#startBtn"); await A.waitForTimeout(600); await B.waitForTimeout(100);
  await A.screenshot({ path: "/tmp/mp_count.png" });
  await A.waitForTimeout(3500); console.log("errs", errs, await A.evaluate(() => JSON.stringify({l: BD.vs.match.goAt - performance.now(), s: BD.vs.game.state, cd: document.getElementById("countdown").textContent}))); console.log("phases", await A.evaluate(() => BD.vs.phase), await B.evaluate(() => BD.vs.phase), await A.evaluate(() => document.visibilityState), await B.evaluate(() => document.visibilityState)); await A.waitForFunction(() => BD.vs.phase === "play", null, { timeout: 8000 }); await B.waitForFunction(() => BD.vs.phase === "play", null, { timeout: 8000 });
  const qa = await A.evaluate(() => BD.vs.game.queue.slice(0, 5).join()), qb = await B.evaluate(() => BD.vs.game.queue.slice(0, 5).join()); ok(qa === qb, "same piece queue " + qa);
  ok((await A.textContent("#oName")) === "Kenji" && (await B.textContent("#oName")) === "Sakura", "names shown in match HUD");
  // both drop some pieces
  for (let i = 0; i < 14; i++) { for (const P of [A, B]) await P.evaluate(i => { const g = BD.vs.game; g.setPointer(60 + (i * 53) % 320); g.t = Math.max(g.t, g.dropReady); g.drop(); }, i); await A.waitForTimeout(260); }
  await A.waitForTimeout(500);
  const mo = await A.evaluate(() => BD.vs.mirror.orbs.length), ro = await B.evaluate(() => BD.vs.game.orbs.length); ok(mo > 0 && Math.abs(mo - ro) <= 3, `A's mirror shows B's orbs (${mo} vs ${ro})`);
  // attack: A makes a big combo → B receives stones
  await A.evaluate(() => BD.vs.game.hooks.merged({ nt: 8, combo: 3, full: false }));
  await B.waitForFunction(() => BD.vs.match.incoming.length > 0, null, { timeout: 3000 }); ok(true, "B received incoming stones (A attack 8/x3 = " + await A.evaluate(() => BD.vs.attackFor({ nt: 8, combo: 3 })) + ")");
  // B counter-attacks: cancels
  const before = await B.evaluate(() => BD.vs.match.incoming.reduce((a, x) => a + x.n, 0));
  await B.evaluate(() => BD.vs.game.hooks.merged({ nt: 7, combo: 2, full: false }));
  const after = await B.evaluate(() => BD.vs.match.incoming.reduce((a, x) => a + x.n, 0)); ok(after < before, `counter cancels incoming (${before} -> ${after})`);
  await B.evaluate(() => { BD.vs.game.hooks.merged = () => {}; });   // stop organic merges cancelling the rest
  await B.screenshot({ path: "/tmp/mp_incoming.png" });
  await B.waitForFunction(() => BD.vs.game.orbs.some(o => o.orb.junk), null, { timeout: 6000 }).then(() => ok(true, "stones landed in B's jar"), () => ok(false, "stones landed in B's jar"));
  await A.waitForTimeout(800); await A.screenshot({ path: "/tmp/mp_play_A.png" }); await B.screenshot({ path: "/tmp/mp_play_B.png" });
  // overflow B
  await B.evaluate(() => { const g = BD.vs.game; g.hooks.merged = () => {}; for (let i = 0; i < 40; i++) g.makeOrb([2, 4, 6, 8][i % 4], 60 + (i * 97) % 320, -10 - i * 4, 0, 0); });
  await B.waitForFunction(() => BD.vs.phase === "result", null, { timeout: 25000 }); await A.waitForFunction(() => BD.vs.phase === "result", null, { timeout: 8000 });
  console.log("B:", await B.textContent("#rTitle"), await B.textContent("#rWhy"), "A:", await A.textContent("#rTitle"), await A.textContent("#rWhy"), await A.evaluate(() => JSON.stringify({o: BD.vs.game.orbs.length, st: BD.vs.game.state, sc: BD.vs.game.score, junk: BD.vs.game.orbs.filter(o=>o.orb.junk).length}))); ok((await B.textContent("#rTitle")) === "You lose", "B sees 'You lose'"); ok((await A.textContent("#rTitle")) === "You win!", "A sees 'You win!'");
  ok((await A.textContent("#rWhy")).includes("Kenji"), "result reason names the rival: " + await A.textContent("#rWhy"));
  await A.screenshot({ path: "/tmp/mp_result.png" });
  // rematch
  await A.click("#rematchBtn"); await B.click("#rematchBtn"); await A.waitForFunction(() => BD.vs.phase === "count" || BD.vs.phase === "play", null, { timeout: 5000 }); await B.waitForFunction(() => BD.vs.phase === "count" || BD.vs.phase === "play", null, { timeout: 5000 }); ok(true, "rematch starts a new match");
  // forfeit: A leaves mid-match
  await A.waitForFunction(() => BD.vs.phase === "play", null, { timeout: 8000 }); A.on("dialog", d => d.accept()); await A.click("#leaveBtn");
  await B.waitForFunction(() => BD.vs.phase === "result", null, { timeout: 5000 }); ok((await B.textContent("#rWhy")).includes("left"), "B wins by forfeit: " + await B.textContent("#rWhy"));
  // mobile screenshot of an in-match client
  const M = await ctx.newPage(); await M.setViewportSize({ width: 390, height: 780 }); await M.goto(base); await M.waitForTimeout(400); await M.screenshot({ path: "/tmp/mp_m_lobby.png" });
  ok(errs.length === 0, "no page errors" + (errs.length ? ": " + errs.join(" | ") : ""));
  await b.close(); srv.close();
})();
