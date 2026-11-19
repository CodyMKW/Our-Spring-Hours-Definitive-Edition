/* ============================================================================
   audio.js — a tiny procedural score + sound effects, built on WebAudio.
   No audio files are needed: every "track" is generated live from a mood
   definition (scale, chord loop, tempo, texture). Moods are crossfaded.

   API (window.VN_AUDIO):
     init()                 create the AudioContext (call from a user gesture)
     play(mood)             crossfade to a mood ("spring", "tense", ... or null)
     sfx(name)              "click" | "choice" | "chapter" | "hit" | "alert" | "chime" | "gong"
     applySettings()        re-read volume / mute from Settings
   ========================================================================== */
(function () {
  "use strict";
  const { Settings } = window.VN_CORE;

  /* chord notes are semitone offsets from `root` (MIDI note number) */
  const MOODS = {
    spring:   { bpm: 80,  root: 60, scale: [0, 2, 4, 7, 9, 12, 14, 16],
                chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 7]],
                pad: "triangle", padVol: 0.07, pluck: 0.55, pluckVol: 0.10, bass: false, pulse: false },
    night:    { bpm: 64,  root: 57, scale: [0, 3, 5, 7, 10, 12, 15],
                chords: [[0, 7, 10, 15], [-4, 3, 7, 12], [-2, 5, 9, 12], [-5, 2, 7, 10]],
                pad: "sine", padVol: 0.085, pluck: 0.28, pluckVol: 0.09, bass: false, pulse: false },
    festival: { bpm: 104, root: 62, scale: [0, 2, 4, 7, 9, 12, 14, 16, 19],
                chords: [[0, 4, 7, 12], [5, 9, 12, 16], [7, 11, 14, 19], [-3, 0, 4, 9]],
                pad: "triangle", padVol: 0.05, pluck: 0.8, pluckVol: 0.11, bass: true, pulse: false },
    tense:    { bpm: 70,  root: 50, scale: [0, 1, 3, 5, 7, 8, 12],
                chords: [[0, 7, 12, 13], [0, 6, 10, 15], [-2, 5, 10, 12], [-5, 0, 7, 10]],
                pad: "sawtooth", padVol: 0.035, pluck: 0.2, pluckVol: 0.09, bass: true, pulse: false, noise: "wind", noiseVol: 0.025 },
    ruin:     { bpm: 58,  root: 52, scale: [0, 3, 5, 7, 10, 12, 15],
                chords: [[0, 7, 12, 15], [-4, 3, 7, 12], [-5, 2, 7, 10], [-7, 0, 5, 9]],
                pad: "triangle", padVol: 0.06, pluck: 0.16, pluckVol: 0.08, bass: false, pulse: false, noise: "wind", noiseVol: 0.03 },
    sorrow:   { bpm: 54,  root: 57, scale: [0, 2, 3, 7, 8, 12, 14, 15],
                chords: [[0, 7, 12, 15], [-4, 3, 8, 12], [-2, 5, 9, 14], [-7, 0, 7, 10]],
                pad: "sine", padVol: 0.09, pluck: 0.32, pluckVol: 0.1, bass: false, pulse: false },
    hope:     { bpm: 76,  root: 62, scale: [0, 2, 4, 7, 9, 12, 14, 16, 19],
                chords: [[0, 4, 7, 14], [-3, 4, 9, 12], [-5, 2, 7, 11], [-7, 0, 4, 9]],
                pad: "triangle", padVol: 0.075, pluck: 0.6, pluckVol: 0.11, bass: false, pulse: false },
    battle:   { bpm: 132, root: 48, scale: [0, 3, 5, 7, 10, 12, 15],
                chords: [[0, 7, 12, 15], [0, 7, 12, 15], [-4, 3, 8, 12], [-2, 5, 10, 14]],
                pad: "sawtooth", padVol: 0.035, pluck: 0.3, pluckVol: 0.08, bass: true, pulse: true, noise: "wind", noiseVol: 0.02 },
    quiet:    { bpm: 50,  root: 55, scale: [0, 2, 7, 9, 12],
                chords: [[0, 7, 12]], pad: "sine", padVol: 0.05, pluck: 0.08, pluckVol: 0.07, bass: false, pulse: false, noise: "wind", noiseVol: 0.02 },
  };

  let ctx = null, master = null, musicBus = null, sfxBus = null, reverbSend = null, noiseBuf = null;
  let track = null; // { mood, gain, timer, step, nextTime, noiseNodes }
  let pendingMood = null;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus.connect(master);
    sfxBus.connect(master);
    master.connect(ctx.destination);

    // cheap synthetic reverb
    const len = ctx.sampleRate * 2.6;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.55;
    const wet = ctx.createGain();
    wet.gain.value = 0.7;
    reverbSend.connect(conv);
    conv.connect(wet);
    wet.connect(musicBus);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    applySettings();
    if (pendingMood) { const m = pendingMood; pendingMood = null; play(m); }
  }

  function applySettings() {
    if (!ctx) return;
    const muted = Settings.get("muted");
    master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05);
    musicBus.gain.setTargetAtTime(Settings.get("music"), ctx.currentTime, 0.05);
    sfxBus.gain.setTargetAtTime(Settings.get("sfx"), ctx.currentTime, 0.05);
  }

  /* ----------------------------------------------------------- note builders */
  function envNote(dest, type, freq, t, dur, vol, attack, release, filterHz) {
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    o.type = type; o2.type = type;
    o.frequency.value = freq; o2.frequency.value = freq * 1.004;
    f.type = "lowpass"; f.frequency.value = filterHz || 1800; f.Q.value = 0.4;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(dest);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  function pluck(dest, freq, t, vol) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    o.type = "triangle";
    o.frequency.value = freq;
    f.type = "lowpass"; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(500, t + 1.1);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(f); f.connect(g); g.connect(dest);
    const send = ctx.createGain(); send.gain.value = 0.9; g.connect(send); send.connect(reverbSend);
    o.start(t); o.stop(t + 1.7);
  }

  function kick(dest, t, vol) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + 0.3);
  }

  function noiseLayer(dest, kind, vol) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    g.gain.value = vol;
    if (kind === "wind") {
      f.type = "bandpass"; f.frequency.value = 520; f.Q.value = 0.7;
      const lfo = ctx.createOscillator(); const lg = ctx.createGain();
      lfo.frequency.value = 0.09; lg.gain.value = 260;
      lfo.connect(lg); lg.connect(f.frequency); lfo.start();
      const lfo2 = ctx.createOscillator(); const lg2 = ctx.createGain();
      lfo2.frequency.value = 0.13; lg2.gain.value = vol * 0.6;
      lfo2.connect(lg2); lg2.connect(g.gain); lfo2.start();
      src.connect(f); f.connect(g); g.connect(dest); src.start();
      return [src, lfo, lfo2];
    }
    f.type = "highpass"; f.frequency.value = 1600;
    src.connect(f); f.connect(g); g.connect(dest); src.start();
    return [src];
  }

  /* ------------------------------------------------------------- the scheduler */
  function startTrack(name) {
    const m = MOODS[name];
    if (!m) return null;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(musicBus);
    gain.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
    const t = {
      mood: name, m, gain, step: 0, melIdx: 3,
      nextTime: ctx.currentTime + 0.15, spb: 60 / m.bpm / 2, noiseNodes: [],
    };
    const sendPad = ctx.createGain(); sendPad.gain.value = 0.6; gain.connect(sendPad); sendPad.connect(reverbSend);
    if (m.noise) t.noiseNodes = noiseLayer(gain, m.noise, m.noiseVol || 0.02);
    t.timer = setInterval(() => schedule(t), 60);
    return t;
  }

  function schedule(t) {
    while (t.nextTime < ctx.currentTime + 0.3) {
      const m = t.m;
      const k = t.step;
      const barStep = k % 8;
      const chord = m.chords[Math.floor(k / 8) % m.chords.length];
      const T = t.nextTime;
      if (barStep === 0) {
        const dur = t.spb * 8 + 1.6;
        chord.forEach((semi, i) => {
          envNote(t.gain, m.pad, mtof(m.root + semi - (i === 0 ? 12 : 0)), T, dur, m.padVol / (1 + i * 0.25), 1.4, 1.8, 1100);
        });
        if (m.bass) envNote(t.gain, "sine", mtof(m.root + chord[0] - 12), T, t.spb * 7.5, m.padVol * 1.7, 0.08, 0.6, 400);
      }
      if (m.pulse && barStep % 2 === 0) kick(t.gain, T, 0.16);
      if (m.pulse && barStep % 2 === 1) envNote(t.gain, "sawtooth", mtof(m.root + chord[0] - 12), T, t.spb * 0.9, 0.028, 0.01, 0.2, 380);
      // melodic plucks: random walk through the scale, biased to chord tones
      if (Math.random() < m.pluck * (barStep % 2 === 0 ? 1 : 0.55)) {
        const step = [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)];
        t.melIdx = Math.max(0, Math.min(m.scale.length - 1, t.melIdx + step));
        let semi = m.scale[t.melIdx];
        if (Math.random() < 0.35) semi = chord[Math.floor(Math.random() * chord.length)] + 12;
        pluck(t.gain, mtof(m.root + 12 + semi), T, m.pluckVol * (0.6 + Math.random() * 0.5));
      }
      t.step++;
      t.nextTime += t.spb;
    }
  }

  function stopTrack(t) {
    if (!t) return;
    clearInterval(t.timer);
    t.gain.gain.cancelScheduledValues(ctx.currentTime);
    t.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.6);
    setTimeout(() => {
      t.noiseNodes.forEach(n => { try { n.stop(); } catch (e) { /* ignore */ } });
      try { t.gain.disconnect(); } catch (e) { /* ignore */ }
    }, 3500);
  }

  function play(mood) {
    if (!ctx) { pendingMood = mood; return; }
    if (track && track.mood === mood) return;
    stopTrack(track);
    track = mood && MOODS[mood] ? startTrack(mood) : null;
  }

  /* ---------------------------------------------------------------------- sfx */
  function tone(freq, dur, vol, type, when, slideTo) {
    const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function sfx(name) {
    if (!ctx || Settings.get("muted")) return;
    switch (name) {
      case "click":  tone(880, 0.06, 0.05, "triangle"); break;
      case "choice": tone(660, 0.12, 0.07, "triangle"); tone(990, 0.18, 0.06, "triangle", 0.07); break;
      case "chime":  tone(784, 0.5, 0.06, "sine"); tone(1175, 0.7, 0.05, "sine", 0.09); tone(1568, 0.9, 0.04, "sine", 0.18); break;
      case "chapter": tone(523, 0.6, 0.06, "sine"); tone(659, 0.7, 0.05, "sine", 0.12); tone(784, 1.0, 0.05, "sine", 0.24); break;
      case "hit": {
        tone(120, 0.35, 0.22, "sine", 0, 38);
        const src = ctx.createBufferSource(); src.buffer = noiseBuf;
        const g = ctx.createGain(); const f = ctx.createBiquadFilter();
        f.type = "lowpass"; f.frequency.value = 1400;
        g.gain.setValueAtTime(0.18, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
        src.connect(f); f.connect(g); g.connect(sfxBus); src.start(); src.stop(ctx.currentTime + 0.35);
        break;
      }
      case "alert": for (let i = 0; i < 3; i++) tone(740, 0.14, 0.07, "square", i * 0.22, 700); break;
      case "gong":  tone(110, 2.2, 0.12, "sine"); tone(165, 2.0, 0.07, "sine", 0.02); tone(221, 1.6, 0.04, "triangle", 0.02); break;
      case "page":  tone(520, 0.05, 0.04, "triangle"); break;
      default: break;
    }
  }

  Settings.onChange((k) => { if (k === "music" || k === "sfx" || k === "muted") applySettings(); });
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  window.VN_AUDIO = { init, play, sfx, applySettings, MOODS: Object.keys(MOODS) };
})();
