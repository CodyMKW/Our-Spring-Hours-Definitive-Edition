/* ============================================================================
   sfx.js — tiny synthesized sound effects (no audio files) + music hookup.
   Music reuses the visual novel's procedural score (../js/audio.js).
   Volumes follow the visual novel's saved settings (osh-de:settings).
     BD.sfx.init()            create the AudioContext on first user gesture
     BD.sfx.pop(tier, combo)  merge sound, pitched up the merge chain
     BD.sfx.drop() / thud(v) / ability(kind) / over() / unlock() / click() / warn()
     BD.sfx.music(mood|null)  "spring" | "festival" | "tense" ... or null to stop
   ========================================================================== */
(function (BD) {
  "use strict";
  let ctx = null, master = null;
  const S = () => { try { return window.VN_CORE.Settings; } catch (e) { return null; } };
  const vol = () => { const s = S(); if (!s) return 0.7; return s.get("muted") ? 0 : s.get("sfx"); };
  const PENT = [0, 2, 4, 7, 9];                    // pentatonic steps so merges always sound pleasant
  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  function init() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.connect(ctx.destination); } catch (e) { return; }
    }
    if (ctx.state === "suspended") ctx.resume();
    try { window.VN_AUDIO && window.VN_AUDIO.init(); } catch (e) { /* music is optional */ }
  }
  function env(g, t, a, d, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(freq, dur, type, peak, when, slideTo) {
    if (!ctx) return; const v = vol(); if (v <= 0) return;
    const t = ctx.currentTime + (when || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    env(g, t, 0.006, dur, peak * v); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, peak, f0, f1, when) {
    if (!ctx) return; const v = vol(); if (v <= 0) return;
    const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const t = ctx.currentTime + (when || 0), src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; f.type = "bandpass"; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = 0.9;
    env(g, t, 0.004, dur, peak * v); src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }

  BD.sfx = {
    init,
    pop(tier, combo) {
      const step = (tier - 1) + Math.min(6, (combo || 1) - 1) * 2;
      const midi = 60 + PENT[step % 5] + 12 * Math.floor(step / 5);
      tone(hz(midi), 0.32, "sine", 0.32);
      tone(hz(midi + 12), 0.2, "triangle", 0.11, 0.015);
      noise(0.07, 0.12, 2600, 900);
      if (tier >= 7) tone(hz(midi - 12), 0.5, "sine", 0.18, 0.02);
    },
    drop() { tone(520, 0.08, "triangle", 0.12, 0, 330); },
    thud(v) { if (v < 1.8) return; const p = Math.min(1, v / 9); tone(150 - p * 50, 0.12, "sine", 0.1 + p * 0.14, 0, 70); noise(0.05, 0.04 + p * 0.06, 700, 300); },
    ability(kind) {
      if (kind === "fire") { noise(0.5, 0.3, 400, 3200); tone(180, 0.5, "sawtooth", 0.12, 0, 60); }
      else if (kind === "float") { [0, 4, 7, 12, 16].forEach((s, i) => tone(hz(64 + s), 0.7, "sine", 0.14, i * 0.07)); }
      else if (kind === "stone") { noise(0.3, 0.3, 300, 120); tone(90, 0.3, "square", 0.1, 0, 50); }
      else if (kind === "void") { tone(110, 1.2, "sawtooth", 0.12, 0, 440); tone(165, 1.2, "sine", 0.1, 0, 660); }
      else if (kind === "decay") { noise(0.4, 0.2, 2000, 200); tone(300, 0.4, "sawtooth", 0.08, 0, 70); }
      else if (kind === "ledger") { [0, 7, 12].forEach((s, i) => tone(hz(72 + s), 0.45, "triangle", 0.13, i * 0.09)); }
      else if (kind === "shake") { for (let i = 0; i < 5; i++) { noise(0.08, 0.2, 500 + i * 60, 200, i * 0.07); tone(120 + i * 20, 0.1, "square", 0.05, i * 0.07); } }
      else { [0, 4, 7, 11, 14].forEach((s, i) => tone(hz(67 + s), 0.5, "sine", 0.16, i * 0.06)); }   // rally
    },
    over() { [7, 3, 0, -5].forEach((s, i) => tone(hz(62 + s), 0.7, "triangle", 0.18, i * 0.18)); },
    unlock() { [0, 4, 7, 12, 16, 19].forEach((s, i) => tone(hz(72 + s), 0.6, "sine", 0.15, i * 0.08)); },
    click() { tone(880, 0.05, "triangle", 0.09); },
    warn() { tone(330, 0.12, "square", 0.05); },
    bloom() { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(hz(60 + s), 0.9, "sine", 0.15, i * 0.07)); noise(0.6, 0.15, 3000, 800); },
    music(m) { try { window.VN_AUDIO && window.VN_AUDIO.play(m); } catch (e) { /* ignore */ } },
  };
})(window.BD);
