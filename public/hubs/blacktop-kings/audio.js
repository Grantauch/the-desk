/* Blacktop Kings — a two-song soundtrack plus synthesized basketball effects.
   Playback follows the browser's autoplay rules and retries after a player gesture. */
(function (BK) {
  'use strict';
  let ctx = null, sfxBus = null, comp = null, noiseBuf = null;
  let crowdSrc = null, crowdGain = null, crowdFilter = null;
  const settings = { sfx: 0.8, music: 0.5, on: true };
  try {
    const saved = JSON.parse(localStorage.getItem('bk-audio') || 'null');
    if (saved && typeof saved === 'object') {
      if (typeof saved.sfx === 'number') settings.sfx = Math.max(0, Math.min(1, saved.sfx));
      if (typeof saved.music === 'number') settings.music = Math.max(0, Math.min(1, saved.music));
      if (typeof saved.on === 'boolean') settings.on = saved.on;
    }
  } catch (e) { /* storage blocked */ }

  function persist() { try { localStorage.setItem('bk-audio', JSON.stringify(settings)); } catch (e) { /* ignore */ } }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(comp);
    applyVolumes();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  function applyVolumes() {
    player.volume = settings.music;
    player.muted = !settings.on;
    if (!ctx) return;
    const on = settings.on ? 1 : 0;
    sfxBus.gain.setTargetAtTime(settings.sfx * on * 0.9, ctx.currentTime, 0.05);
  }

  // ---------- building blocks ----------
  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
  }
  function tone(type, f0, f1, dur, vol, t, bus, attack) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g, t, attack || 0.004, vol, dur);
    o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function noise(type, freq, q, dur, vol, t, bus, attack, freqEnd) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain(); env(g, t, attack || 0.002, vol, dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    return f;
  }
  function metal(freqs, dur, vol, t) {
    freqs.forEach((f, i) => tone(i % 2 ? 'square' : 'triangle', f, f * 0.995, dur * (1 - i * 0.12), vol / (i + 1.4), t, sfxBus, 0.001));
  }

  // ---------- effects ----------
  const FX = {
    dribble(v, t) { tone('sine', 140, 55, 0.09, 0.5 * v, t); noise('lowpass', 900, 0.7, 0.04, 0.18 * v, t); },
    swish(v, t) { noise('highpass', 3500, 0.6, 0.32, 0.32 * v, t, sfxBus, 0.02, 7000); noise('bandpass', 1800, 1.2, 0.18, 0.12 * v, t + 0.04); },
    rim(v, t) { metal([523, 811, 1187, 1653], 0.45, 0.32 * v, t); noise('bandpass', 2400, 3, 0.06, 0.2 * v, t); },
    board(v, t) { tone('sine', 160, 90, 0.14, 0.45 * v, t); noise('lowpass', 1200, 0.8, 0.09, 0.3 * v, t); },
    dunk(v, t) {
      tone('sine', 110, 32, 0.55, 0.9 * v, t); metal([392, 587, 911, 1301], 0.7, 0.45 * v, t);
      noise('lowpass', 2400, 0.7, 0.35, 0.55 * v, t, sfxBus, 0.003, 300);
    },
    block(v, t) { noise('bandpass', 900, 1.5, 0.12, 0.7 * v, t); tone('sine', 300, 70, 0.18, 0.6 * v, t); tone('square', 120, 60, 0.1, 0.15 * v, t); },
    steal(v, t) { noise('bandpass', 1500, 2, 0.08, 0.35 * v, t, sfxBus, 0.002, 3500); tone('triangle', 700, 1200, 0.08, 0.2 * v, t); },
    squeak(v, t) { const o = tone('sine', 2300, 3100, 0.07, 0.11 * v, t); o.frequency.setValueAtTime(2700, t + 0.035); },
    whistle(v, t) {
      const o = ctx.createOscillator(); const g = ctx.createGain(); const lfo = ctx.createOscillator(); const lg = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 2850; lfo.frequency.value = 34; lg.gain.value = 90;
      lfo.connect(lg); lg.connect(o.frequency); env(g, t, 0.01, 0.22 * v, 0.42);
      o.connect(g); g.connect(sfxBus); o.start(t); lfo.start(t); o.stop(t + 0.5); lfo.stop(t + 0.5);
    },
    whoosh(v, t) { noise('bandpass', 400, 1.2, 0.35, 0.4 * v, t, sfxBus, 0.08, 2600); },
    bump(v, t) { tone('sine', 120, 55, 0.11, 0.45 * v, t); noise('lowpass', 700, 0.7, 0.07, 0.3 * v, t); },
    catch(v, t) { tone('sine', 220, 120, 0.06, 0.4 * v, t); noise('lowpass', 1400, 0.6, 0.04, 0.2 * v, t); },
    pass(v, t) { noise('bandpass', 1100, 1, 0.12, 0.2 * v, t, sfxBus, 0.01, 2200); },
    scratch(v, t) {
      noise('bandpass', 700, 4, 0.14, 0.55 * v, t, sfxBus, 0.005, 2600);
      noise('bandpass', 2600, 4, 0.16, 0.5 * v, t + 0.14, sfxBus, 0.005, 500);
      tone('sawtooth', 180, 520, 0.13, 0.12 * v, t); tone('sawtooth', 520, 140, 0.15, 0.12 * v, t + 0.14);
    },
    airhorn(v, t) {
      [0, 0.22, 0.44].forEach((d, i) => {
        const len = i === 2 ? 0.55 : 0.16;
        [349.2, 440, 523.3, 698.5].forEach((f) => {
          const o = ctx.createOscillator(); const g = ctx.createGain(); const lp = ctx.createBiquadFilter();
          o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.97, t + d); o.frequency.linearRampToValueAtTime(f, t + d + 0.04);
          lp.type = 'lowpass'; lp.frequency.value = 2600;
          g.gain.setValueAtTime(0.0001, t + d); g.gain.linearRampToValueAtTime(0.09 * v, t + d + 0.02);
          g.gain.setValueAtTime(0.09 * v, t + d + len); g.gain.exponentialRampToValueAtTime(0.0001, t + d + len + 0.08);
          o.connect(lp); lp.connect(g); g.connect(sfxBus); o.start(t + d); o.stop(t + d + len + 0.1);
        });
      });
    },
    boom(v, t) { tone('sine', 140, 28, 1.1, 0.95 * v, t); noise('lowpass', 500, 0.7, 0.8, 0.35 * v, t, sfxBus, 0.01, 60); },
    riser(v, t) { noise('bandpass', 300, 2, 0.9, 0.35 * v, t, sfxBus, 0.8, 5000); tone('sawtooth', 110, 880, 0.9, 0.05 * v, t, sfxBus, 0.85); },
    glass(v, t) {
      noise('highpass', 2500, 0.5, 0.5, 0.7 * v, t, sfxBus, 0.001, 6000);
      for (let i = 0; i < 14; i++) { const f = 2500 + Math.random() * 4500; tone('sine', f, f * 0.98, 0.12 + Math.random() * 0.3, 0.07 * v, t + Math.random() * 0.5, sfxBus, 0.001); }
      tone('sine', 90, 30, 0.6, 0.7 * v, t);
    },
    crowdOoh(v, t) { noise('bandpass', 420, 6, 0.9, 0.5 * v, t, sfxBus, 0.12, 680); noise('bandpass', 1100, 7, 0.8, 0.25 * v, t, sfxBus, 0.12, 1500); },
    crowdRoar(v, t) { noise('bandpass', 800, 0.8, 1.6, 0.6 * v, t, sfxBus, 0.06, 600); noise('highpass', 2500, 0.5, 1.0, 0.18 * v, t, sfxBus, 0.05); },
    buzzer(v, t) { tone('square', 196, 190, 0.9, 0.22 * v, t); tone('square', 233, 228, 0.9, 0.18 * v, t); },
    click(v, t) { tone('square', 880, 660, 0.04, 0.1 * v, t); },
    select(v, t) { tone('triangle', 660, 990, 0.08, 0.2 * v, t); tone('triangle', 990, 1320, 0.1, 0.16 * v, t + 0.06); },
    back(v, t) { tone('triangle', 660, 440, 0.1, 0.18 * v, t); },
    levelup(v, t) { [523, 659, 784, 1047, 1319].forEach((f, i) => tone('square', f, f, 0.16, 0.12 * v, t + i * 0.07)); },
    coin(v, t) { tone('square', 988, 988, 0.06, 0.12 * v, t); tone('square', 1319, 1319, 0.2, 0.12 * v, t + 0.06); },
    trick(v, t) { noise('bandpass', 2000, 2, 0.06, 0.18 * v, t, sfxBus, 0.002, 4200); },
    fire(v, t) { noise('lowpass', 900, 0.5, 0.8, 0.35 * v, t, sfxBus, 0.1, 3000); tone('sawtooth', 70, 140, 0.8, 0.08 * v, t, sfxBus, 0.2); },
    charge(v, t) { tone('sine', 300, 1200, 0.5, 0.15 * v, t, sfxBus, 0.4); noise('highpass', 4000, 0.6, 0.5, 0.15 * v, t, sfxBus, 0.4); },
  };

  // ---------- crowd bed ----------
  function startCrowd(level) {
    if (!ctx || crowdSrc) return;
    crowdSrc = ctx.createBufferSource(); crowdSrc.buffer = noiseBuf; crowdSrc.loop = true;
    crowdFilter = ctx.createBiquadFilter(); crowdFilter.type = 'bandpass'; crowdFilter.frequency.value = 700; crowdFilter.Q.value = 0.6;
    crowdGain = ctx.createGain(); crowdGain.gain.value = 0;
    crowdSrc.connect(crowdFilter); crowdFilter.connect(crowdGain); crowdGain.connect(sfxBus); crowdSrc.start();
    setCrowd(level || 0.05);
  }
  function setCrowd(level) { if (crowdGain) crowdGain.gain.setTargetAtTime(Math.max(0, level) * 0.6, ctx.currentTime, 0.4); }
  function stopCrowd() { if (crowdSrc) { try { crowdSrc.stop(); } catch (e) { /* already stopped */ } crowdSrc = null; crowdGain = null; } }

  // One player keeps the soundtrack in order across menus, games and Crown shots.
  const playlist = [
    './blacktop-kings/music/the-asphalt-throne.mp3',
    './blacktop-kings/music/canvas-on-the-concrete.mp3',
  ];
  const player = document.getElementById('soundtrack');
  let trackIndex = 0, musicRequested = false, failedTracks = 0;
  player.src = playlist[trackIndex];
  player.loop = false;
  player.preload = 'none';

  function playMusic() {
    if (!musicRequested || !settings.on || !player.paused) return;
    try {
      const pending = player.play();
      if (pending && pending.catch) pending.catch(() => { /* retry on the next gesture */ });
    } catch (e) { /* browser playback unavailable */ }
  }
  function startMusic() { musicRequested = true; applyVolumes(); playMusic(); }
  function stopMusic() { musicRequested = false; player.pause(); }
  function nextTrack() {
    trackIndex = (trackIndex + 1) % playlist.length;
    player.src = playlist[trackIndex];
    playMusic();
  }
  player.addEventListener('ended', () => { failedTracks = 0; nextTrack(); });
  player.addEventListener('error', () => {
    if (!musicRequested || ++failedTracks >= playlist.length) { player.pause(); return; }
    nextTrack();
  });

  BK.audio = {
    unlock() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); playMusic(); },
    sfx(name, vol, delay) {
      if (!settings.on || !init() || ctx.state !== 'running' || !FX[name]) return;
      try { FX[name](vol == null ? 1 : vol, ctx.currentTime + (delay || 0)); } catch (e) { /* audio hiccup */ }
    },
    music(name) { if (!name) { stopMusic(); return; } startMusic(); },
    intensity() { /* the recorded soundtrack keeps its own dynamics */ },
    crowd(level) { if (!settings.on || !init()) return; startCrowd(level); setCrowd(level); },
    stopCrowd,
    settings,
    set(key, value) {
      settings[key] = value; persist(); applyVolumes();
      if (key === 'on') { if (!value) { player.pause(); stopCrowd(); } else playMusic(); }
    },
  };
})(window.BK = window.BK || {});
