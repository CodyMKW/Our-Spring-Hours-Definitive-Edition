/* ============================================================================
   main.js — boot, keyboard / mouse / touch input, HUD wiring.
   Keyboard:
     Space / Enter / → / ↓   advance          ← / Backspace / PageUp  go back a line
     A   auto                S (or hold Ctrl)  skip read text
     L   backlog             H   hide interface     F  fullscreen
     M   mute                1-9  pick a choice     Esc  menu / close
   Mouse: click advances, wheel up goes back, wheel down advances.
   URL flags: ?debug  validates the story and logs problems to the console
              ?test=1 instant text + no waits (used by the automated tests)
   ========================================================================== */
(function () {
  "use strict";
  const { Settings, Global } = window.VN_CORE;
  const D = window.VN_DATA;
  const V = window.VN;
  const Game = window.Game;
  const UI = window.VN_UI;
  const A = window.VN_AUDIO;
  const FX = window.VN_FX;
  const $ = (id) => document.getElementById(id);

  function boot() {
    Settings.load();
    Global.load();
    V.compile();
    if (/[?&]debug/.test(location.search)) {
      const errs = V.validate({ bgs: D.BACKGROUNDS, chars: D.CHARACTERS, moods: A.MOODS, fx: FX.KINDS });
      console.log(`[VN] ${Object.keys(V.code).length} labels compiled, ${errs.length} problem(s)`);
      errs.forEach(e => console.warn("[VN]", e));
    }
    if (/[?&]test=1/.test(location.search)) {
      Settings.data.textSpeed = 3; Settings.data.effects = false; Settings.data.toasts = false; Settings.data.kenBurns = false; Settings.data.muted = true;
    }
    Game.grab();
    FX.boot();
    UI.apply();
    $("hud").addEventListener("click", onHud);
    $("clickzone").addEventListener("click", () => Game.advance());
    $("dialog").addEventListener("click", () => Game.advance());
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", (e) => { if (e.key === "Control" && ctrlSkip) { ctrlSkip = false; Game.stopSkip(); } });
    window.addEventListener("wheel", onWheel, { passive: true });
    document.getElementById("titleVer").textContent = "v" + D.VERSION;
    UI.showTitle();
    $("app").classList.add("on-title");
    // first user gesture anywhere unlocks audio
    const unlock = () => { A.init(); window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
  }

  function onHud(e) {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    b.blur();
    const act = b.dataset.act;
    if (act === "back") Game.rollback();
    else if (act === "auto") Game.toggleAuto();
    else if (act === "skip") Game.toggleSkip();
    else if (act === "log") UI.openLog();
    else if (act === "hide") Game.setHidden(true);
    else if (act === "save") UI.openSaves("save", { from: null });
    else if (act === "menu") UI.openPause();
  }

  let ctrlSkip = false;
  function inGame() { return $("app").classList.contains("in-game") && !Game.mode.ending; }

  function onKey(e) {
    if (e.altKey || e.metaKey) return;
    const k = e.key;
    if (k === "Escape") {
      if (UI.isModalOpen()) { const back = document.querySelector("#modalCard .m-head .btn.ghost:not(.m-x)"); if (back) back.click(); else UI.closeAll(); }
      else if (Game.mode.hidden) Game.setHidden(false);
      else if (inGame()) UI.openPause();
      e.preventDefault();
      return;
    }
    if (UI.isModalOpen()) return;
    if (!$("app").classList.contains("in-game")) return;
    if (k === "f" || k === "F") { toggleFullscreen(); return; }
    if (k === "m" || k === "M") { Settings.set("muted", !Settings.get("muted")); return; }
    if (!inGame()) return;
    if (e.target && e.target.tagName === "BUTTON" && (k === " " || k === "Enter")) return; // let the focused button handle it
    if (k === " " || k === "Enter" || k === "ArrowRight" || k === "ArrowDown") { Game.advance(); e.preventDefault(); }
    else if (k === "ArrowLeft" || k === "Backspace" || k === "PageUp") { Game.rollback(); e.preventDefault(); }
    else if (k === "a" || k === "A") Game.toggleAuto();
    else if (k === "s" || k === "S") Game.toggleSkip();
    else if (k === "l" || k === "L") UI.openLog();
    else if (k === "h" || k === "H") Game.setHidden(!Game.mode.hidden);
    else if (k === "Control" && !e.repeat && !Game.mode.skip) { ctrlSkip = true; Game.toggleSkip(); }
    else if (/^[1-9]$/.test(k) && Game.mode.choosing) Game.choose(parseInt(k, 10) - 1);
  }

  let wheelLock = 0;
  function onWheel(e) {
    if (!inGame() || UI.isModalOpen()) return;
    const now = performance.now();
    if (now - wheelLock < 280) return;
    wheelLock = now;
    if (e.deltaY < 0) Game.rollback(); else if (e.deltaY > 0) Game.advance();
  }

  function toggleFullscreen() {
    const d = document;
    if (!d.fullscreenElement) (d.documentElement.requestFullscreen || (() => {})).call(d.documentElement);
    else d.exitFullscreen && d.exitFullscreen();
  }

  window.addEventListener("error", (ev) => console.error("[VN] uncaught:", ev.message));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
