/* ============================================================================
   versus.js — Blossom Drop Versus (beta): lobby, room handling, the match
   controller and the rival's mirrored jar.

   How a match works
     • Each player simulates ONLY their own jar (Matter.js, same as single player).
     • Both jars use the same random seed, so both players get the same pieces.
     • ~10×/s each side sends a compact snapshot of its orbs; the other side draws
       it in a small "mirror" jar (positions are smoothed between snapshots).
     • Combos and big merges become "stones" for the rival (see attackFor()).
       Stones arrive after a short warning; making your own attack first cancels them.
     • You lose when your jar overflows. If the clock runs out, higher score wins.

   Messages (JSON over the link)
     hello   {name, char}              who I am (sent on connect and on any change)
     start   {seed, dur}               host → guest: begin a match
     snap    {o, sc, mt, h, px, w}     my jar picture + score/meter/held piece/aim/danger
     atk     {n}                       send n stones to the rival
     over    {score}                   my jar overflowed (I lost)
     fin     {score}                   time is up, here's my final score
     rematch {}                        I'd like to play again
     leave   {}                        I'm leaving the room
   ========================================================================== */
(function (BD) {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const rand = (a, b) => a + Math.random() * (b - a);
  const T = BD.TIERS;
  const Settings = () => { try { return window.VN_CORE.Settings; } catch (e) { return null; } };
  const FACE = { cody: 1, joseph: 1, falcon: 1 };
  const MUSIC = { cody: "spring", uraraka: "spring", joseph: "festival", falcon: "festival", cementoss: "hope", maki: "festival", light: "night", shigaraki: "tense", allforone: "tense" };

  const MATCH_SECONDS = 150, COUNTDOWN_MS = 3300, SNAP_MS = 100, STONE_DELAY_MS = 2600, DEAD_AIR_MS = 9000, MAX_PENDING = 12;

  /* ------------------------------------------------------------ profile (name + record) */
  const PKEY = "osh-de:blossom-vs";
  const cleanName = (s) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 14);
  let prof = { name: "", wins: 0, losses: 0, draws: 0 };
  try { const p = JSON.parse(localStorage.getItem(PKEY) || "null"); if (p && typeof p === "object") prof = Object.assign(prof, p); } catch (e) { /* fresh profile */ }
  prof.name = cleanName(prof.name);
  const saveProf = () => { try { localStorage.setItem(PKEY, JSON.stringify(prof)); } catch (e) { /* storage may be blocked */ } };
  const myName = () => cleanName($("nameIn").value) || "Player";

  let stats = BD.loadStats();
  let selected = BD.CHAR[stats.lastChar] && BD.isUnlocked(BD.CHAR[stats.lastChar], stats) ? stats.lastChar : "cody";

  /* ------------------------------------------------------------ backdrop + petals (same as single player) */
  let bdFlip = false, bdCurrent = "";
  function backdrop(name) {
    if (name === bdCurrent) return; bdCurrent = name;
    const a = $("bdA"), b = $("bdB"), on = bdFlip ? a : b, off = bdFlip ? b : a; bdFlip = !bdFlip;
    on.style.backgroundImage = `url('../assets/backgrounds/${name}.jpg')`; on.classList.add("on"); off.classList.remove("on");
  }
  const petalCv = $("petals"), pc = petalCv.getContext("2d"); let petals = [];
  const petalSize = () => { petalCv.width = innerWidth; petalCv.height = innerHeight; };
  const newPetal = (any) => ({ x: rand(-20, innerWidth), y: any ? rand(0, innerHeight) : -20, s: rand(5, 11), vy: rand(18, 46), vx: rand(8, 28), r: rand(0, 6.28), vr: rand(-1.4, 1.4), sw: rand(0, 6.28), a: rand(0.35, 0.8), c: Math.random() < 0.5 ? "#ffc6d8" : "#ffa8c4" });
  function drawPetals(dt) {
    pc.clearRect(0, 0, petalCv.width, petalCv.height);
    if (Settings() && Settings().get("effects") === false) return;
    for (const p of petals) {
      p.sw += dt * 1.6; p.x += (p.vx + Math.sin(p.sw) * 22) * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      if (p.y > innerHeight + 20 || p.x > innerWidth + 30) Object.assign(p, newPetal(false), { x: rand(-60, innerWidth * 0.8) });
      pc.save(); pc.translate(p.x, p.y); pc.rotate(p.r); pc.scale(p.s, p.s * (0.55 + 0.45 * Math.abs(Math.cos(p.sw)))); pc.globalAlpha = p.a; pc.fillStyle = p.c;
      pc.beginPath(); pc.moveTo(0, 1); pc.bezierCurveTo(-1, 0.3, -0.8, -0.8, 0, -1); pc.bezierCurveTo(0.8, -0.8, 1, 0.3, 0, 1); pc.fill(); pc.restore();
    }
  }

  /* ------------------------------------------------------------ mirror (rival's jar) */
  class Mirror {
    constructor(cv) {
      this.cv = cv; this.ctx = cv.getContext("2d"); this.scale = 1; this.frameCache = null;
      this.clear();
    }
    clear() {
      this.map = new Map(); this.orbs = []; this.parts = []; this.popups = []; this.rings = [];
      this.shelf = null; this.punch = null; this.vortex = 0; this.zero = 0; this.shake = 0; this.warn = 0; this.t = 0;
      this.state = "idle"; this.held = null; this.pointerX = BD.JAR_W / 2; this.dropReady = 0; this.heldAnim = 1; this.abilityKind = null;
    }
    apply(m) {
      if (!Array.isArray(m.o)) return;
      const seen = new Set();
      for (const row of m.o) {
        if (!Array.isArray(row) || row.length < 5) continue;
        const id = row[0], tier = row[1] | 0, x = +row[2], y = +row[3], a = +row[4];
        if (!isFinite(x) || !isFinite(y) || tier < 0 || tier > T.length) continue;
        seen.add(id); let o = this.map.get(id);
        const r = tier ? T[tier - 1].r : BD.JUNK_R;
        if (!o) { o = { position: { x, y }, angle: a, tx: x, ty: y, ta: a, orb: { id, tier, r, pop: 0.35, overT: 0, born: this.t, junk: !tier } }; this.map.set(id, o); this.orbs.push(o); }
        else { o.tx = x; o.ty = y; o.ta = a; if (o.orb.tier !== tier) { o.orb.tier = tier; o.orb.r = r; o.orb.pop = 0.4; } }
      }
      for (const [id, o] of this.map) {
        if (seen.has(id)) continue;
        this.map.delete(id); const i = this.orbs.indexOf(o); if (i >= 0) this.orbs.splice(i, 1);
        this.burst(o.position.x, o.position.y, [o.orb.tier ? T[o.orb.tier - 1].c[1] : "#b8aab6", "#fff"], 6, 110);
      }
      this.warn = Math.max(0, Math.min(1, +m.w || 0));
      this.held = m.h > 0 && m.h <= T.length ? m.h | 0 : null;
      if (isFinite(m.px)) this.pointerX = m.px;
    }
    update(dt) {
      this.t += dt; const k = 1 - Math.exp(-dt * 18);
      for (const o of this.orbs) {
        o.position.x += (o.tx - o.position.x) * k; o.position.y += (o.ty - o.position.y) * k; o.angle += (o.ta - o.angle) * k;
        if (o.orb.pop > 0) o.orb.pop = Math.max(0, o.orb.pop - dt * 3.2);
      }
      this.tickFx(dt);
    }
  }
  ["resize", "burst", "ring", "tickFx", "render", "drawJarBack", "drawOrbs", "drawShelf", "drawFx", "drawGlass", "drawDropper", "drawPopups", "landingY"].forEach(k => { Mirror.prototype[k] = BD.Game.prototype[k]; });

  /* ------------------------------------------------------------ state */
  let link = null, role = "", phase = "lobby";           // phase: lobby | count | play | result
  let opp = { name: "", char: "", ready: false };
  let game = null, mirror = null, lastT = 0;
  let M = null;   // current match: {seed, dur, goAt, endAt, myOver, oppOver, myFin, oppFin, oppScore, incoming[], settleTimer, rematchMe, rematchOpp}
  let shownScore = 0, shownOpp = 0, lastSnap = 0, lastRx = 0, lastQuip = 0, bubbleTimer = 0, toastCool = 0, lastToast = "", queueKey = "", sentFlash = 0;
  const keys = new Set();

  /* ------------------------------------------------------------ lobby: character picker */
  const unlocked = (ch) => BD.isUnlocked(ch, stats);
  const portraitHTML = (ch) => `<img src="${ch.img}" alt="${ch.name}"${FACE[ch.id] ? ` class="face" data-ch="${ch.id}"` : ""}>`;
  function renderPicker() {
    const box = $("picker"); box.innerHTML = "";
    BD.CHARS.forEach(ch => {
      const locked = !unlocked(ch);
      const b = el("button", "pick" + (locked ? " locked" : "") + (ch.id === selected ? " sel" : ""));
      b.type = "button"; b.style.setProperty("--c", ch.color); b.setAttribute("role", "option"); b.setAttribute("aria-selected", ch.id === selected);
      b.innerHTML = `<div class="pp">${portraitHTML(ch)}</div><b>${ch.name}</b><small>${locked ? "Locked" : ch.ability.name}</small>${locked ? '<span class="lock">\u{1F512}</span>' : ""}`;
      b.addEventListener("click", () => { BD.sfx.init(); BD.sfx.click(); if (locked) { $("pickInfo").innerHTML = `<b>${ch.name}</b> is locked — unlock them in single player (<a style="color:var(--gold)" href="${location.protocol === "file:" ? "index.html" : "./"}">Blossom Drop</a>).`; return; } select(ch.id); });
      box.appendChild(b);
    });
  }
  function select(id) {
    selected = id; stats.lastChar = id; BD.saveStats(stats);
    renderPicker(); backdrop(BD.CHAR[id].bg); renderInfo(); renderRoom(); sendHello();
  }
  function renderInfo() { const ch = BD.CHAR[selected]; $("pickInfo").innerHTML = `<b>${ch.ability.name}</b> — ${ch.ability.desc}`; }

  function fillAvatar(node, ch) { node.style.setProperty("--c", ch ? ch.color : "#8b7fc0"); node.classList.toggle("empty", !ch); node.innerHTML = ch ? portraitHTML(ch) : ""; }

  /* ------------------------------------------------------------ lobby: connection */
  function setMsg(text, cls, id) { const n = $(id || "netMsg"); n.textContent = text || ""; n.className = "net-msg" + (cls ? " " + cls : ""); }
  function showStep(room) { $("stepStart").hidden = room; $("stepRoom").hidden = !room; }
  function tab(which) {
    $("tabHost").classList.toggle("on", which === "host"); $("tabJoin").classList.toggle("on", which === "join");
    $("paneHost").hidden = which !== "host"; $("paneJoin").hidden = which !== "join"; setMsg("");
    if (which === "join") $("codeIn").focus();
  }
  function resetLink() { if (link) { const l = link; link = null; try { l.close(); } catch (e) { /* ignore */ } } role = ""; opp = { name: "", char: "", ready: false }; }

  function attachLink(l) {
    link = l;
    l.on("msg", (m) => { if (l === link) onMsg(m); });
    l.on("open", () => { if (l !== link) return; lastRx = performance.now(); opp = { name: "", char: "", ready: false }; setMsg("", "", "roomMsg"); renderRoom(); sendHello(); });
    l.on("close", () => { if (l === link) onPeerGone("Your rival left the room."); });
    l.on("error", (t) => { if (l !== link) return; if (phase === "lobby" && $("stepRoom").hidden) { setMsg(t, "err"); resetLink(); setBusy(false); } else setMsg(t, "err", "roomMsg"); });
  }
  function setBusy(b) { $("hostBtn").disabled = b; $("joinBtn").disabled = b; }
  function hostRoom() {
    if (!BD.Net.available()) { setMsg("Peer-to-peer isn't available (the PeerJS library didn't load).", "err"); return; }
    BD.sfx.init(); BD.sfx.click(); resetLink(); setBusy(true); setMsg("Creating a room…");
    const l = BD.Net.host(); role = "host"; attachLink(l);
    l.on("ready", (code) => { if (l !== link) return; setBusy(false); showStep(true); $("roomCode").textContent = code; $("roomActions").hidden = false; renderRoom(); setMsg("Room ready — send your friend the code.", "ok", "roomMsg"); });
  }
  function joinRoom() {
    const code = BD.Net.clean($("codeIn").value);
    if (code.length !== 5) { setMsg("Codes are 5 letters.", "err"); return; }
    if (!BD.Net.available()) { setMsg("Peer-to-peer isn't available (the PeerJS library didn't load).", "err"); return; }
    BD.sfx.init(); BD.sfx.click(); resetLink(); setBusy(true); setMsg("Connecting…");
    const l = BD.Net.join(code); role = "guest"; attachLink(l);
    l.on("open", () => { if (l !== link) return; setBusy(false); showStep(true); $("roomCode").textContent = code; $("roomActions").hidden = true; renderRoom(); setMsg("Connected! Waiting for the host to start.", "ok", "roomMsg"); });
  }
  function leaveRoom(silent) {
    if (link && link.isOpen && !silent) link.send({ t: "leave" });
    resetLink(); showStep(false); setBusy(false); setMsg(""); renderRoom();
  }
  function onPeerGone(why) {
    if (phase === "count" || phase === "play") { opp.left = true; M.oppLeft = true; settle("win", "Your rival left the match", true); return; }
    if (phase === "result") { M && (M.oppLeft = true); $("rematchBtn").disabled = true; $("rNote").textContent = "Your rival left the room."; resetLink(); return; }
    resetLink(); showStep(false); setBusy(false); setMsg(why, "err");
  }
  function renderRoom() {
    const me = BD.CHAR[selected], oc = BD.CHAR[opp.char];
    const pm = $("ppMe"); fillAvatar(pm.querySelector(".pp-av"), me); pm.querySelector(".pp-name").textContent = myName(); pm.querySelector(".pp-char").textContent = me.name + " · " + me.ability.name;
    const po = $("ppOpp"); fillAvatar(po.querySelector(".pp-av"), oc || null);
    po.querySelector(".pp-name").textContent = opp.name || (link && link.isOpen ? "…" : "Waiting…");
    po.querySelector(".pp-char").textContent = oc ? oc.name + " · " + oc.ability.name : (link && link.isOpen ? "Choosing a character" : "Nobody here yet");
    const connected = !!(link && link.isOpen && opp.ready);
    $("startBtn").hidden = role !== "host"; $("startBtn").disabled = !connected;
    if (role === "host") setMsg(connected ? `${opp.name} joined — ready when you are.` : "Room ready — send your friend the code.", connected ? "ok" : "", "roomMsg");
    else if (role === "guest") setMsg(connected ? `Connected to ${opp.name}. Waiting for the host to start…` : "Connected! Waiting for the host to start.", "ok", "roomMsg");
    $("record").innerHTML = `Your record: <b>${prof.wins}</b>W · <b>${prof.losses}</b>L · <b>${prof.draws}</b>D`;
  }
  function sendHello() { if (link && link.isOpen) link.send({ t: "hello", name: myName(), char: selected }); }
  const inviteLink = () => { const u = new URL(location.href); u.search = ""; u.hash = ""; const q = new URLSearchParams(); q.set("join", $("roomCode").textContent); if (BD.Net.isLocal()) q.set("net", "local"); return u.toString() + "?" + q.toString(); };
  function copy(text, ok) {
    const done = () => setMsg(ok, "ok", "roomMsg");
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => window.prompt("Copy this:", text));
    else window.prompt("Copy this:", text);
  }

  /* ------------------------------------------------------------ messages */
  function onMsg(m) {
    if (!m || typeof m !== "object") return; lastRx = performance.now();
    switch (m.t) {
      case "hello": {
        const nm = cleanName(m.name) || "Player", ch = BD.CHAR[m.char] ? m.char : "cody";
        opp.name = nm; opp.char = ch; opp.ready = true;
        if (phase === "lobby" || phase === "result") renderRoom();
        if (phase === "count" || phase === "play") setOppHud();
        break;
      }
      case "start": if (role === "guest" && phase !== "count" && phase !== "play") beginMatch(m.seed >>> 0, Math.max(30, Math.min(600, +m.dur || MATCH_SECONDS))); break;
      case "snap": if (M && mirror) { mirror.apply(m); if (isFinite(m.sc)) M.oppScore = m.sc | 0; M.oppMeter = +m.mt || 0; } break;
      case "atk": if (M && (phase === "play" || phase === "count") && !M.myOver) { const pending = M.incoming.reduce((a, b) => a + b.n, 0), n = Math.min(Math.max(1, Math.min(12, m.n | 0)), MAX_PENDING - pending); if (n > 0) { M.incoming.push({ n, at: performance.now() + STONE_DELAY_MS }); sentFlash = performance.now(); $("oSent").textContent = `${opp.name} sent ${n} stone${n > 1 ? "s" : ""}!`; BD.sfx.warn(); } } break;
      case "over": if (M && phase === "play") { M.oppOver = true; if (isFinite(m.score)) M.oppScore = m.score | 0; mirror.state = "idle"; if (!M.myOver && game.state !== "over") game.state = "done"; settleSoon(M.myOver ? 0 : 900); } break;
      case "fin": if (M && (phase === "play" || phase === "count")) { M.oppFin = true; if (isFinite(m.score)) M.oppScore = m.score | 0; if (M.myFin) settleSoon(0); } break;
      case "rematch": if (M) { M.rematchOpp = true; if (phase === "result") { $("rNote").textContent = `${opp.name} wants a rematch!`; maybeRematch(); } } break;
      case "leave": onPeerGone("Your rival left the room."); break;
    }
  }

  /* ------------------------------------------------------------ match lifecycle */
  function startMatch() {
    if (role !== "host" || !link || !link.isOpen || !opp.ready) return;
    const seed = (Math.random() * 4294967296) >>> 0;
    link.send({ t: "start", seed, dur: MATCH_SECONDS });
    beginMatch(seed, MATCH_SECONDS);
  }
  function beginMatch(seed, dur) {
    BD.sfx.init(); BD.sfx.click();
    const ch = BD.CHAR[selected];
    M = { seed, dur, goAt: performance.now() + COUNTDOWN_MS, endAt: 0, myOver: false, oppOver: false, myFin: false, oppFin: false, oppScore: 0, oppMeter: 0, incoming: [], settleTimer: 0, rematchMe: false, rematchOpp: false, over: null, sentTotal: 0, cdShown: -1 };
    M.endAt = M.goAt + dur * 1000; phase = "count";
    $("app").dataset.screen = "vs"; $("lobby").hidden = true; $("vs").hidden = false; ["result", "decree", "how"].forEach(i => $(i).hidden = true);
    $("vs").style.setProperty("--c", ch.color);
    $("pImg").src = ch.img; $("pImg").alt = ch.name; $("pImg").classList.toggle("face", !!FACE[ch.id]); $("pImg").dataset.ch = ch.id;
    $("pName").textContent = myName(); $("pChar").textContent = ch.name; $("tMe").textContent = myName();
    $("abName").textContent = $("abNameM").textContent = ch.ability.name; ["abGlyph", "abGlyphM"].forEach(i => $(i).textContent = ch.ability.icon);
    $("bubble").classList.remove("on"); $("toasts").innerHTML = ""; $("incoming").hidden = true; $("oSent").textContent = ""; $("timer").classList.remove("low");
    if (!game) game = new BD.Game($("jar"), { quip, toast, over: onMyOver, decree: onDecree, merged: onMerged }); else game.resize();
    if (!mirror) mirror = new Mirror($("mirror")); mirror.clear();
    game.resize(); mirror.resize(); requestAnimationFrame(() => { game.resize(); mirror.resize(); });
    game.start(selected, seed); game.state = "idle";           // frozen until the countdown ends
    mirror.state = "play"; setOppHud(); backdrop(ch.bg); queueKey = ""; shownScore = 0; shownOpp = 0; lastSnap = 0;
    BD.sfx.music(MUSIC[selected] || "festival"); renderRoom();
  }
  function setOppHud() {
    const oc = BD.CHAR[opp.char] || BD.CHAR.cody, av = $("oAv");
    av.style.setProperty("--c", oc.color); av.innerHTML = portraitHTML(oc);
    $("oName").textContent = opp.name || "Rival"; $("oChar").textContent = oc.name; $("tOpp").textContent = opp.name || "Rival";
  }
  function goLive() { phase = "play"; game.state = "play"; $("countdown").hidden = true; lastRx = performance.now(); }

  /* attacks ------------------------------------------------------------- */
  function attackFor(info) {
    let n = 0;
    if (info.combo >= 2) n += Math.min(info.combo - 1, 4);     // x2 → 1 stone, x3 → 2 … (capped at 4 so long chains can't bury anyone)
    if (info.full) n += 6; else if (info.nt >= 6) n += info.nt - 5;   // Tomato(6)+ → 1 … Cherry Tree(10) → 5
    return Math.min(n, 8);
  }
  function onMerged(info) {
    if (phase !== "play" || !M || M.myOver) return;
    let n = attackFor(info), blocked = 0;
    while (n > 0 && M.incoming.length) { const it = M.incoming[0], c = Math.min(n, it.n); it.n -= c; n -= c; blocked += c; if (!it.n) M.incoming.shift(); }
    if (blocked) toast(`Blocked ${blocked} stone${blocked > 1 ? "s" : ""}!`, "info");
    if (n > 0 && link) { link.send({ t: "atk", n }); M.sentTotal += n; toast(`Sent ${n} stone${n > 1 ? "s" : ""} →`, "send"); }
  }

  /* endings ------------------------------------------------------------- */
  function onMyOver() {
    if (!M || phase !== "play" || M.myOver) return;
    M.myOver = true; link && link.send({ t: "over", score: game.score }); settleSoon(1200);
  }
  function settleSoon(ms) { if (!M || phase === "result") return; clearTimeout(M.settleTimer); M.settleTimer = setTimeout(() => settle(), ms); }
  function settle(forced, why, forfeit) {
    if (!M || phase === "result") return; clearTimeout(M.settleTimer);
    const my = game ? game.score : 0, their = M.oppScore;
    let res = forced, reason = why;
    if (!res) {
      if (M.myOver && M.oppOver) { res = my > their ? "win" : my < their ? "lose" : "draw"; reason = "Both jars overflowed"; }
      else if (M.myOver) { res = "lose"; reason = "Your jar overflowed"; }
      else if (M.oppOver) { res = "win"; reason = `${opp.name}'s jar overflowed`; }
      else { res = my > their ? "win" : my < their ? "lose" : "draw"; reason = "Time's up"; }
    }
    phase = "result"; M.result = res;
    if (game && game.state !== "over") game.state = "done";
    if (res === "win") prof.wins++; else if (res === "lose") prof.losses++; else prof.draws++; saveProf();
    $("rWhy").textContent = reason; const t = $("rTitle"); t.textContent = res === "win" ? "You win!" : res === "lose" ? "You lose" : "It's a draw"; t.className = res === "win" ? "win" : "";
    $("rMe").querySelector("b").textContent = my.toLocaleString(); $("rMe").querySelector("span").textContent = myName();
    $("rOpp").querySelector("b").textContent = forfeit ? "—" : their.toLocaleString(); $("rOpp").querySelector("span").textContent = opp.name || "Rival";
    $("rMe").classList.toggle("win", res === "win"); $("rOpp").classList.toggle("win", res === "lose");
    $("rNote").textContent = forfeit ? "They disconnected, so the match is yours." : `Stones sent: you ${M.sentTotal}`;
    $("rematchBtn").disabled = !!forfeit || !link; $("rematchBtn").firstElementChild.textContent = "Rematch";
    $("result").hidden = false; if (res === "win") BD.sfx.unlock(); else if (res === "lose" && !M.myOver) BD.sfx.over();
    if (forfeit) { /* link is gone */ }
  }
  function maybeRematch() { if (M && M.rematchMe && M.rematchOpp && role === "host") startMatch(); }
  function requestRematch() {
    if (!M || !link || M.oppLeft) return; M.rematchMe = true; link.send({ t: "rematch" });
    $("rematchBtn").disabled = true; $("rematchBtn").firstElementChild.textContent = "Waiting…"; $("rNote").textContent = M.rematchOpp ? "Starting…" : `Waiting for ${opp.name}…`;
    maybeRematch();
  }
  function toLobby() {
    $("result").hidden = true; phase = "lobby"; $("app").dataset.screen = "lobby"; $("vs").hidden = true; $("lobby").hidden = false;
    if (link && !link.isOpen) resetLink();
    if (!link) showStep(false);
    stats = BD.loadStats(); renderPicker(); renderRoom(); backdrop(BD.CHAR[selected].bg); BD.sfx.music("spring");
  }
  function leaveMatch() {
    if (phase === "play" || phase === "count") { if (!window.confirm("Leave the match? You'll forfeit.")) return; }
    if (link && link.isOpen) link.send({ t: "leave" });
    resetLink(); showStep(false); toLobby(); setMsg("");
  }

  /* ------------------------------------------------------------ HUD */
  function quip(kind) {
    const now = performance.now(); if (kind !== "over" && kind !== "start" && now - lastQuip < 3200) return; lastQuip = now;
    const list = BD.CHAR[selected].quips[kind]; if (!list) return;
    const b = $("bubble"); b.textContent = list[(Math.random() * list.length) | 0]; b.classList.add("on");
    const img = $("pImg"); img.classList.remove("hop"); void img.offsetWidth; img.classList.add("hop");
    clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => b.classList.remove("on"), 2400);
  }
  function toast(msg, kind) {
    const now = performance.now(); if (msg === lastToast && now - toastCool < 900) return; lastToast = msg; toastCool = now;
    if (kind === "combo") document.querySelectorAll(".toast.combo").forEach(x => x.remove());
    const t = el("div", "toast" + (kind ? " " + kind : ""), msg); $("toasts").appendChild(t); setTimeout(() => t.remove(), 1600);
    while ($("toasts").children.length > 3) $("toasts").firstChild.remove();
  }
  function renderQueue() {
    const n = game.previewCount, list = [game.held, ...game.queue.slice(0, n)].filter(x => x != null);
    const key = list.join(",") + "|" + n; if (key === queueKey) return; queueKey = key;
    const q = $("queue"); q.innerHTML = ""; list.forEach(t => { const cv = el("canvas"); cv.width = cv.height = 96; cv.getContext("2d").drawImage(BD.art.orb(t, 96), 0, 0); q.appendChild(cv); });
  }
  const fmtTime = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  function updateHud(dt, now) {
    if (!game || !M) return;
    shownScore += (game.score - shownScore) * Math.min(1, dt * 10); if (Math.abs(game.score - shownScore) < 1) shownScore = game.score;
    const s = Math.round(shownScore).toLocaleString(); if ($("score").textContent !== s) $("score").textContent = s;
    shownOpp += (M.oppScore - shownOpp) * Math.min(1, dt * 10); if (Math.abs(M.oppScore - shownOpp) < 1) shownOpp = M.oppScore;
    const os = Math.round(shownOpp).toLocaleString(); if ($("oScore").textContent !== os) $("oScore").textContent = os;
    $("oMeter").style.width = Math.max(0, Math.min(100, M.oppMeter)) + "%";
    if (sentFlash && now - sentFlash > 2600) { sentFlash = 0; $("oSent").textContent = ""; }
    const pct = Math.min(100, game.meter), ready = game.abilityReady;
    ["abRing", "abRingM"].forEach(i => $(i).style.setProperty("--p", pct));
    ["abBtn", "abBtnM"].forEach(i => { $(i).classList.toggle("ready", ready); $(i).classList.toggle("active", game.state === "decay" || game.abilityTime > 0); });
    $("abHint").textContent = $("abHintM").textContent = game.state === "decay" ? "Tap an orb!" : ready ? "Ready! Press Q" : game.abilityTime > 0 ? "Active…" : `Charging ${Math.floor(pct)}%`;
    const chip = $("comboChip"), inCombo = game.combo >= 2 && game.t - game.lastMerge < 1.6; chip.classList.toggle("on", inCombo); if (inCombo) chip.textContent = `Combo x${game.combo}`;
    renderQueue();
    const mv = (keys.has("ArrowRight") || keys.has("d") || keys.has("D") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("a") || keys.has("A") ? 1 : 0);
    if (mv && game.state === "play") game.setPointer(Math.max(0, Math.min(BD.JAR_W, game.pointerX + mv * 430 * dt)));
    // incoming stones: show the warning, release when due
    if (phase === "play") {
      const total = M.incoming.reduce((a, b) => a + b.n, 0), box = $("incoming");
      box.hidden = total === 0 || M.myOver;
      if (total) { $("incN").textContent = total; $("incT").textContent = Math.max(0, (M.incoming[0].at - now) / 1000).toFixed(1) + "s"; }
      while (M.incoming.length && M.incoming[0].at <= now && game.state !== "over") { const it = M.incoming.shift(); game.addJunk(it.n); }
    } else $("incoming").hidden = true;
  }
  function onDecree(open) {
    $("decree").hidden = !open; if (!open) return;
    const row = $("decreeRow"); row.innerHTML = "";
    for (let t = 1; t <= 5; t++) { const b = el("button"); b.type = "button"; b.title = T[t - 1].name; const cv = el("canvas"); cv.width = cv.height = 120; cv.getContext("2d").drawImage(BD.art.orb(t, 120), 0, 0); b.appendChild(cv); b.addEventListener("click", () => game.decree(t)); row.appendChild(b); }
  }

  /* ------------------------------------------------------------ clock / network tick */
  function tickMatch(now) {
    if (!M) return;
    if (phase === "count") {
      const left = M.goAt - now, n = Math.ceil(left / 1000), cd = $("countdown");
      if (left <= 0) { goLive(); cd.hidden = false; cd.textContent = "Go!"; cd.className = "countdown pop"; BD.sfx.unlock(); setTimeout(() => { if (phase === "play") cd.hidden = true; }, 700); }
      else { cd.hidden = false; if (M.cdShown !== n) { M.cdShown = n; cd.textContent = n; cd.className = "countdown"; void cd.offsetWidth; cd.className = "countdown pop"; BD.sfx.click(); } }
      $("timer").textContent = fmtTime(M.dur * 1000);
    } else if (phase === "play") {
      const left = M.endAt - now; $("timer").textContent = fmtTime(left); $("timer").classList.toggle("low", left < 15000);
      if (left <= 0 && !M.myFin && !M.myOver && !M.oppOver) { M.myFin = true; if (game.state !== "over") game.state = "done"; link && link.send({ t: "fin", score: game.score }); if (M.oppFin) settleSoon(0); else settleSoon(3500); }
      if (link && now - lastRx > DEAD_AIR_MS) onPeerGone("Connection lost.");
    }
    if ((phase === "play" || phase === "count") && link && link.isOpen && now - lastSnap >= SNAP_MS) {
      lastSnap = now;
      link.send({ t: "snap", o: game.snapshot(), sc: game.score, mt: Math.round(game.meter), h: game.held || 0, px: Math.round(game.pointerX), w: Math.round(game.warn * 10) / 10 });
    }
  }

  /* ------------------------------------------------------------ input */
  const muteSync = () => { const m = Settings() && Settings().get("muted"); $("muteBtn").textContent = "Sound: " + (m ? "off" : "on"); };
  function wire() {
    $("nameIn").value = prof.name;
    $("nameIn").addEventListener("input", () => { prof.name = cleanName($("nameIn").value); saveProf(); renderRoom(); });
    $("nameIn").addEventListener("change", sendHello);
    $("nameIn").addEventListener("blur", sendHello);
    $("tabHost").addEventListener("click", () => tab("host")); $("tabJoin").addEventListener("click", () => tab("join"));
    $("hostBtn").addEventListener("click", hostRoom); $("joinBtn").addEventListener("click", joinRoom);
    $("codeIn").addEventListener("input", () => { const c = $("codeIn"); c.value = BD.Net.clean(c.value); });
    $("codeIn").addEventListener("keydown", (e) => { if (e.key === "Enter") joinRoom(); });
    $("copyCode").addEventListener("click", () => copy($("roomCode").textContent, "Code copied!"));
    $("copyLink").addEventListener("click", () => copy(inviteLink(), "Invite link copied!"));
    $("startBtn").addEventListener("click", startMatch);
    $("leaveRoom").addEventListener("click", () => leaveRoom());
    $("howBtn").addEventListener("click", () => { $("how").hidden = false; }); $("howClose").addEventListener("click", () => { $("how").hidden = true; });
    $("muteBtn").addEventListener("click", () => { const s = Settings(); if (!s) return; s.set("muted", !s.get("muted")); try { window.VN_AUDIO.applySettings(); } catch (e) { /* ignore */ } muteSync(); });
    $("leaveBtn").addEventListener("click", leaveMatch);
    $("rematchBtn").addEventListener("click", requestRematch); $("lobbyBtn").addEventListener("click", toLobby);
    $("decreeCancel").addEventListener("click", () => game && game.cancelDecree());
    ["abBtn", "abBtnM"].forEach(i => $(i).addEventListener("click", () => game && phase === "play" && game.useAbility()));

    const jar = $("jar");
    const move = (e) => { if (!game) return null; const p = game.toJar(e.clientX, e.clientY); game.setPointer(p.x); game.decayX = p.x; game.decayY = p.y; return p; };
    const act = (p) => { if (phase !== "play") return; if (game.state === "decay") game.pointerDown(p.x, p.y); else game.drop(); };
    jar.addEventListener("pointermove", move);
    jar.addEventListener("pointerdown", (e) => { BD.sfx.init(); if (!game) return; e.preventDefault(); const p = move(e); try { jar.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } if (e.pointerType === "mouse") act(p); });
    jar.addEventListener("pointerup", (e) => { if (!game || e.pointerType === "mouse") return; act(move(e)); });
    window.addEventListener("keydown", (e) => {
      BD.sfx.init(); if (e.target && e.target.tagName === "INPUT") { if (e.key === "Escape") e.target.blur(); return; }
      keys.add(e.key); if (phase !== "play" || !game) return;
      if (e.key === " " || e.key === "ArrowDown" || e.key === "Enter") { if (!e.repeat) game.drop(); e.preventDefault(); }
      else if ("qQeEwW".includes(e.key) || e.key === "ArrowUp") game.useAbility();
      else if (["1", "2", "3", "4", "5"].includes(e.key) && game.state === "decree") game.decree(+e.key);
    });
    window.addEventListener("keyup", (e) => keys.delete(e.key));
    window.addEventListener("blur", () => keys.clear());          // no pausing in a live match
    window.addEventListener("resize", () => { petalSize(); if (game && phase !== "lobby") { game.resize(); mirror && mirror.resize(); } });
    window.addEventListener("pointerdown", () => { BD.sfx.init(); if (phase === "lobby") BD.sfx.music("spring"); }, { once: true });
    window.addEventListener("beforeunload", () => { if (link && link.isOpen) link.send({ t: "leave" }); });
  }

  function frame(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t; const now = performance.now();
    try {
      drawPetals(dt);
      if (!$("vs").hidden && game) {
        tickMatch(now);
        game.update(dt); game.render(t);
        if (mirror && mirror.frameCache) { mirror.update(dt); mirror.render(t); }
        updateHud(dt, now);
      }
    } catch (e) { console.error(e); }
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------ boot */
  petalSize(); petals = Array.from({ length: Math.min(46, Math.round(innerWidth / 30)) }, () => newPetal(true));
  wire(); muteSync(); renderPicker(); renderInfo(); renderRoom(); backdrop(BD.CHAR[selected].bg);
  if (!BD.Net.available()) setMsg("The PeerJS library didn't load, so online play isn't available right now.", "err");
  const joinParam = (new URLSearchParams(location.search).get("join") || "");
  if (joinParam) { tab("join"); $("codeIn").value = BD.Net.clean(joinParam); setMsg("Invite code filled in — add your name and press Join.", "ok"); }
  requestAnimationFrame(frame);
  BD.vs = { get game() { return game; }, get mirror() { return mirror; }, get link() { return link; }, get phase() { return phase; }, get match() { return M; }, select, hostRoom, joinRoom, startMatch, prof, attackFor };
})(window.BD);
