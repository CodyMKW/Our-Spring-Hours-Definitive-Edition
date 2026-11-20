/* ============================================================================
   ui.js — Blossom Drop front end: character select, HUD, overlays, input,
   backdrop + ambient petals, unlock tracking and the main animation loop.
   ========================================================================== */
(function (BD) {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const rand = (a, b) => a + Math.random() * (b - a);
  const Settings = () => { try { return window.VN_CORE.Settings; } catch (e) { return null; } };

  let stats = BD.loadStats();
  let selected = BD.CHAR[stats.lastChar] ? stats.lastChar : "cody";
  let game = null, screen = "menu", lastT = 0, shownScore = 0, lastQuip = 0, bubbleTimer = 0, toastCool = 0, lastToast = "";
  const keys = new Set();

  const MUSIC = { cody: "spring", uraraka: "spring", joseph: "festival", falcon: "festival", cementoss: "hope", maki: "festival", light: "night", shigaraki: "tense", allforone: "tense" };

  /* ------------------------------------------------------------ backdrop + ambient petals */
  let bdFlip = false, bdCurrent = "";
  function backdrop(name) {
    if (name === bdCurrent) return; bdCurrent = name;
    const a = $("bdA"), b = $("bdB"), on = bdFlip ? a : b, off = bdFlip ? b : a; bdFlip = !bdFlip;
    on.style.backgroundImage = `url('../assets/backgrounds/${name}.jpg')`; on.classList.add("on"); off.classList.remove("on");
  }
  const petalCv = $("petals"), pc = petalCv.getContext("2d"); let petals = [];
  function petalSize() { petalCv.width = innerWidth; petalCv.height = innerHeight; }
  function initPetals() { petalSize(); petals = Array.from({ length: Math.min(46, Math.round(innerWidth / 30)) }, () => newPetal(true)); }
  function newPetal(any) { return { x: rand(-20, innerWidth), y: any ? rand(0, innerHeight) : -20, s: rand(5, 11), vy: rand(18, 46), vx: rand(8, 28), r: rand(0, 6.28), vr: rand(-1.4, 1.4), sw: rand(0, 6.28), a: rand(0.35, 0.8), c: Math.random() < 0.5 ? "#ffc6d8" : "#ffa8c4" }; }
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

  /* ------------------------------------------------------------ menu */
  const unlockedIds = (st) => BD.CHARS.filter(c => BD.isUnlocked(c, st)).map(c => c.id);
  const FACE = { cody: 1, joseph: 1, falcon: 1 };
  function portraitHTML(ch) { return `<img src="${ch.img}" alt="${ch.name}"${FACE[ch.id] ? ` class="face" data-ch="${ch.id}"` : ""}>`; }

  function renderPicker() {
    const box = $("picker"); box.innerHTML = "";
    const open = new Set(unlockedIds(stats));
    BD.CHARS.forEach(ch => {
      const locked = !open.has(ch.id), isNew = !locked && !stats.seenUnlocked.includes(ch.id);
      const b = el("button", "pick" + (locked ? " locked" : "") + (ch.id === selected ? " sel" : ""));
      b.type = "button"; b.style.setProperty("--c", ch.color); b.setAttribute("role", "option"); b.setAttribute("aria-selected", ch.id === selected);
      b.innerHTML = `<div class="pp">${portraitHTML(ch)}</div><b>${ch.name}</b><small>${locked ? "Locked" : ch.ability.name}</small>${locked ? '<span class="lock">\u{1F512}</span>' : ""}${isNew ? '<span class="new">NEW</span>' : ""}`;
      b.addEventListener("click", () => { BD.sfx.init(); BD.sfx.click(); select(ch.id); });
      box.appendChild(b);
    });
  }
  function select(id) {
    selected = id; const ch = BD.CHAR[id];
    if (!stats.seenUnlocked.includes(id) && BD.isUnlocked(ch, stats)) { stats.seenUnlocked.push(id); BD.saveStats(stats); }
    renderPicker(); renderDetail(); backdrop(ch.bg);
  }
  function renderDetail() {
    const ch = BD.CHAR[selected], open = BD.isUnlocked(ch, stats);
    const d = $("detail"); d.style.setProperty("--c", ch.color);
    $("dPortrait").className = "detail-portrait" + (open ? "" : " locked"); $("dPortrait").innerHTML = portraitHTML(ch);
    $("dName").textContent = ch.name; $("dTag").textContent = "“" + ch.tag + "”";
    $("dIcon").textContent = ch.ability.icon; $("dAbName").textContent = ch.ability.name; $("dAbDesc").textContent = ch.ability.desc;
    const ul = $("dConds"); ul.innerHTML = "";
    if (!ch.unlocks.length) ul.innerHTML = '<li class="ok"><span class="tick">✓</span>Available from the start</li>';
    ch.unlocks.forEach(u => { const ok = u.check(stats); ul.insertAdjacentHTML("beforeend", `<li class="${ok ? "ok" : ""}"><span class="tick">${ok ? "✓" : ""}</span><span>${u.text}</span><span class="kind">${u.kind === "vn" ? "Story" : "Game"}</span></li>`); });
    const pc2 = stats.perChar[ch.id];
    $("dBest").innerHTML = open ? (pc2 ? `Best with ${ch.name.split(" ")[0]}: <b>${pc2.best.toLocaleString()}</b> · ${pc2.games} game${pc2.games === 1 ? "" : "s"}` : "No games yet — you got this.") : "Meet every condition to unlock.";
    const btn = $("playBtn"); btn.disabled = !open; btn.firstElementChild.textContent = open ? "Play" : "Locked";
  }
  function showMenu() {
    screen = "menu"; $("app").dataset.screen = "menu"; $("menu").hidden = false; $("play").hidden = true;
    ["pause", "over", "decree", "how"].forEach(i => $(i).hidden = true);
    stats = BD.loadStats(); if (!BD.isUnlocked(BD.CHAR[selected], stats)) selected = "cody";
    renderPicker(); renderDetail(); backdrop(BD.CHAR[selected].bg); BD.sfx.music("spring");
  }

  /* ------------------------------------------------------------ chart + queue */
  function buildChart(box) {
    box.innerHTML = "";
    const svg = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="34" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1.2" stroke-dasharray="2 3"/></svg>`;
    box.insertAdjacentHTML("beforeend", svg);
    for (let i = 0; i < BD.MAX_TIER; i++) {
      const a = -Math.PI / 2 + i / BD.MAX_TIER * Math.PI * 2, d = el("div", "ci"); d.dataset.t = i + 1;
      d.style.left = (50 + Math.cos(a) * 36) + "%"; d.style.top = (50 + Math.sin(a) * 36) + "%"; d.title = BD.TIERS[i].name;
      const cv = el("canvas"); cv.width = cv.height = 72; cv.getContext("2d").drawImage(BD.art.orb(i + 1, 72), 0, 0); d.appendChild(cv); box.appendChild(d);
    }
  }
  function markChart(max) { document.querySelectorAll(".chart .ci").forEach(d => { const t = +d.dataset.t; d.classList.toggle("got", t <= Math.max(max, 3)); d.classList.toggle("top", t === max && max > 0); }); }
  let queueKey = "";
  function renderQueue() {
    const n = game.previewCount, list = [game.held, ...game.queue.slice(0, n)].filter(x => x != null);
    const key = list.join(",") + "|" + n; if (key === queueKey) return; queueKey = key;
    ["queue", "mQueue"].forEach(id => { const q = $(id); q.innerHTML = ""; list.forEach(t => { const cv = el("canvas"); cv.width = cv.height = 96; cv.getContext("2d").drawImage(BD.art.orb(t, 96), 0, 0); q.appendChild(cv); }); });
  }

  /* ------------------------------------------------------------ game start / hud */
  function startGame() {
    const ch = BD.CHAR[selected]; if (!BD.isUnlocked(ch, stats)) return;
    BD.sfx.init(); BD.sfx.click(); stats.lastChar = selected; BD.saveStats(stats);
    screen = "play"; $("app").dataset.screen = "play"; $("menu").hidden = true; $("play").hidden = false;
    ["pause", "over", "decree", "how"].forEach(i => $(i).hidden = true);
    $("play").style.setProperty("--c", ch.color);
    $("pImg").src = ch.img; $("pImg").alt = ch.name; $("pImg").classList.toggle("face", !!FACE[ch.id]); $("pImg").dataset.ch = ch.id; $("pName").textContent = ch.name;
    $("abName").textContent = $("abNameM").textContent = ch.ability.name; ["abGlyph", "abGlyphM"].forEach(i => $(i).textContent = ch.ability.icon);
    $("best").textContent = $("mBest").textContent = (stats.perChar[ch.id] ? stats.perChar[ch.id].best : 0).toLocaleString();
    $("bubble").classList.remove("on");
    buildChart($("chart"));
    if (!game) { game = new BD.Game($("jar"), { quip, toast, over: onOver, decree: onDecree }); } else game.resize();
    requestAnimationFrame(() => { game.resize(); });
    backdrop(ch.bg); queueKey = ""; shownScore = 0;
    game.start(selected); BD.sfx.music(MUSIC[selected] || "festival");
  }
  function quip(kind) {
    const now = performance.now(); if (kind !== "over" && kind !== "start" && now - lastQuip < 3200) return; lastQuip = now;
    const ch = BD.CHAR[selected], list = ch.quips[kind]; if (!list) return;
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
  function updateHud(dt) {
    if (!game) return;
    shownScore += (game.score - shownScore) * Math.min(1, dt * 10); if (Math.abs(game.score - shownScore) < 1) shownScore = game.score;
    const s = Math.round(shownScore).toLocaleString(); if ($("score").textContent !== s) { $("score").textContent = s; $("mScore").textContent = s; }
    const best = Math.max(game.score, stats.perChar[selected] ? stats.perChar[selected].best : 0); $("best").textContent = $("mBest").textContent = best.toLocaleString();
    const pct = Math.min(100, game.meter), ready = game.abilityReady;
    ["abRing", "abRingM"].forEach(i => $(i).style.setProperty("--p", pct));
    ["abBtn", "abBtnM"].forEach(i => { $(i).classList.toggle("ready", ready); $(i).classList.toggle("active", game.state === "decay" || game.abilityTime > 0); });
    $("abHint").textContent = $("abHintM").textContent = game.state === "decay" ? "Tap an orb!" : ready ? "Ready! Press Q" : game.abilityTime > 0 ? "Active…" : `Charging ${Math.floor(pct)}%`;
    const chip = $("comboChip"); const inCombo = game.combo >= 2 && game.t - game.lastMerge < 1.6; chip.classList.toggle("on", inCombo); if (inCombo) chip.textContent = `Combo x${game.combo}`;
    renderQueue(); markChart(game.maxTier);
    // keyboard aiming
    const mv = (keys.has("ArrowRight") || keys.has("d") || keys.has("D") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("a") || keys.has("A") ? 1 : 0);
    if (mv && (game.state === "play")) { game.setPointer(Math.max(0, Math.min(BD.JAR_W, game.pointerX + mv * 430 * dt))); }
  }

  /* ------------------------------------------------------------ overlays */
  function onDecree(open) {
    $("decree").hidden = !open; if (!open) return;
    const row = $("decreeRow"); row.innerHTML = "";
    for (let t = 1; t <= 5; t++) { const b = el("button"); b.type = "button"; b.title = BD.TIERS[t - 1].name; const cv = el("canvas"); cv.width = cv.height = 120; cv.getContext("2d").drawImage(BD.art.orb(t, 120), 0, 0); b.appendChild(cv); b.addEventListener("click", () => { game.decree(t); }); row.appendChild(b); }
  }
  function onOver(sum) {
    const ch = BD.CHAR[selected], before = new Set(unlockedIds(stats));
    stats.games++; const pcs = stats.perChar[ch.id] || { best: 0, games: 0 }; const wasBest = sum.score > pcs.best;
    pcs.games++; pcs.best = Math.max(pcs.best, sum.score); stats.perChar[ch.id] = pcs;
    stats.best = Math.max(stats.best, sum.score); stats.maxTier = Math.max(stats.maxTier, sum.maxTier); stats.bestCombo = Math.max(stats.bestCombo, sum.bestCombo); stats.merges += sum.merges;
    const after = unlockedIds(stats), fresh = after.filter(id => !before.has(id) && !stats.seenUnlocked.includes(id));
    fresh.forEach(id => stats.seenUnlocked.push(id)); BD.saveStats(stats);
    setTimeout(() => {
      $("oTitle").textContent = sum.score >= 5000 ? "Beautiful bloom!" : sum.score >= 1500 ? "Nice work!" : "Jar overflowed";
      $("oScore").textContent = sum.score.toLocaleString();
      const ob = $("oBest"); ob.className = wasBest && sum.score > 0 ? "new" : ""; ob.textContent = wasBest && sum.score > 0 ? "★ New best for " + ch.name.split(" ")[0] + "!" : "Best: " + pcs.best.toLocaleString();
      $("oStats").innerHTML = `<div><b>${BD.TIERS[Math.max(1, sum.maxTier) - 1].name}</b><small>Biggest orb</small></div><div><b>x${Math.max(1, sum.bestCombo)}</b><small>Best combo</small></div><div><b>${sum.merges}</b><small>Merges</small></div>`;
      const u = $("oUnlocks"); u.innerHTML = "";
      fresh.forEach((id, i) => { const c = BD.CHAR[id]; const d = el("div", "unlock-card", `<img src="${c.img}" alt=""><div><b>${c.name} unlocked!</b><small>${c.ability.name} — ${c.ability.desc}</small></div>`); d.style.animationDelay = (0.2 + i * 0.25) + "s"; u.appendChild(d); });
      if (fresh.length) BD.sfx.unlock();
      $("over").hidden = false;
    }, 1100);
  }

  /* ------------------------------------------------------------ pause / restart / quit */
  function pause(on) { if (screen !== "play" || !game) return; if (on) { if (game.state === "play" || game.state === "decay") { game.pause(true); $("pause").hidden = false; syncMute(); } } else { game.pause(false); $("pause").hidden = true; } }
  function restart() { $("pause").hidden = true; $("over").hidden = true; startGame(); }
  function quitToMenu() { if (game) { game.state = "idle"; } showMenu(); }
  function syncMute() { const m = Settings() && Settings().get("muted"); ["muteBtn", "muteBtn2"].forEach(i => $(i).textContent = "Sound: " + (m ? "off" : "on")); }
  function toggleMute() { const s = Settings(); if (!s) return; s.set("muted", !s.get("muted")); try { window.VN_AUDIO.applySettings(); } catch (e) { /* ignore */ } syncMute(); }

  /* ------------------------------------------------------------ input */
  function wire() {
    $("playBtn").addEventListener("click", startGame);
    $("howBtn").addEventListener("click", () => { buildChart($("chartHow")); $("how").hidden = false; });
    $("howClose").addEventListener("click", () => { $("how").hidden = true; });
    $("muteBtn").addEventListener("click", toggleMute); $("muteBtn2").addEventListener("click", toggleMute);
    $("pauseBtn").addEventListener("click", () => pause(true));
    $("resumeBtn").addEventListener("click", () => pause(false));
    $("restartBtn").addEventListener("click", restart); $("againBtn").addEventListener("click", restart);
    $("quitBtn").addEventListener("click", quitToMenu); $("changeBtn").addEventListener("click", quitToMenu);
    $("decreeCancel").addEventListener("click", () => game && game.cancelDecree());
    ["abBtn", "abBtnM"].forEach(i => $(i).addEventListener("click", () => game && game.useAbility()));

    const jar = $("jar");
    const move = (e) => { if (!game) return; const p = game.toJar(e.clientX, e.clientY); game.setPointer(p.x); game.decayX = p.x; game.decayY = p.y; return p; };
    jar.addEventListener("pointermove", move);
    jar.addEventListener("pointerdown", (e) => {
      BD.sfx.init(); if (!game) return; e.preventDefault(); const p = move(e); try { jar.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
      if (e.pointerType === "mouse") { if (game.state === "decay") game.pointerDown(p.x, p.y); else game.drop(); }
    });
    jar.addEventListener("pointerup", (e) => { if (!game || e.pointerType === "mouse") return; const p = move(e); if (game.state === "decay") game.pointerDown(p.x, p.y); else game.drop(); });

    window.addEventListener("keydown", (e) => {
      BD.sfx.init(); keys.add(e.key);
      if (screen !== "play" || !game) { if (screen === "menu" && (e.key === "Enter") && !$("how").hidden === false) startGame(); return; }
      if (e.key === "Escape" || e.key === "p" || e.key === "P") { if (!$("pause").hidden) pause(false); else pause(true); e.preventDefault(); return; }
      if (e.key === " " || e.key === "ArrowDown" || e.key === "Enter") { if (!e.repeat && $("pause").hidden && $("over").hidden) game.drop(); e.preventDefault(); }
      else if (e.key === "q" || e.key === "Q" || e.key === "e" || e.key === "E" || e.key === "ArrowUp" || e.key === "w" || e.key === "W") game.useAbility();
      else if (e.key === "r" || e.key === "R") { if (!$("pause").hidden || !$("over").hidden) restart(); }
      else if (["1", "2", "3", "4", "5"].includes(e.key) && game.state === "decree") game.decree(+e.key);
    });
    window.addEventListener("keyup", (e) => keys.delete(e.key));
    window.addEventListener("blur", () => { keys.clear(); pause(true); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) pause(true); });
    window.addEventListener("resize", () => { petalSize(); if (game && screen === "play") game.resize(); });
    window.addEventListener("pointerdown", () => { BD.sfx.init(); if (screen === "menu") BD.sfx.music("spring"); }, { once: true });
  }

  /* ------------------------------------------------------------ main loop */
  function frame(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t;
    drawPetals(dt);
    if (screen === "play" && game) { game.update(dt); game.render(t); updateHud(dt); }
    requestAnimationFrame(frame);
  }

  initPetals(); wire(); syncMute(); showMenu(); requestAnimationFrame(frame);
  BD.ui = { startGame, showMenu, get game() { return game; }, select, get stats() { return stats; } };   // handy for tests
})(window.BD);
