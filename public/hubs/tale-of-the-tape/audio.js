/* Tale of the Tape — sound. Everything is synthesized with the Web Audio API; there are no audio files.
   TOT.audio.play(name, volume, variant). Off until the player turns it on or clicks something. */
(function (T) {
  'use strict';
  let ctx = null, master = null, crowdNode = null, crowdGain = null, enabled = true, noiseBuf = null;
  try { const v = localStorage.getItem('tott-sound'); if (v === 'off') enabled = false; } catch (e) { /* storage blocked */ }

  function init() {
    if (ctx || !enabled) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  function noise(dur, type, freq, q, vol, attack = 0.002) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random()); src.stop(t + dur + 0.05);
    return f;
  }
  function noiseAt(delay, dur, type, freq, q, vol) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); const t = ctx.currentTime + delay;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  function tone(freq, dur, type, vol, slide, delay = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function bell() {
    // A boxing bell, rung twice: inharmonic partials with a long ring.
    for (const d of [0, 0.3]) [1, 2.76, 5.4, 8.93].forEach((m, i) => tone(820 * m, 1.6 - i * 0.3, 'sine', 0.22 / (i + 1), null, d));
  }

  const SOUNDS = {
    punch(v) { tone(95, 0.16, 'sine', 0.7 * v, 45); noise(0.09 + v * 0.06, 'lowpass', 900 + v * 900, 0.8, 0.6 * v); noise(0.04, 'highpass', 2500, 0.7, 0.25 * v); },
    block(v) { noise(0.06, 'bandpass', 600, 1.5, 0.5 * v); tone(160, 0.06, 'triangle', 0.25 * v, 110); },
    whiff(v) { const f = noise(0.22, 'bandpass', 900, 2, 0.35 * v, 0.03); f.frequency.exponentialRampToValueAtTime(2600, ctx.currentTime + 0.2); },
    whoosh(v) { const f = noise(0.18, 'bandpass', 500, 1.2, 0.25 * v, 0.02); f.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.16); },
    swing(v) { const f = noise(0.2, 'bandpass', 400, 1.8, 0.4 * v, 0.03); f.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.18); },
    windup(v) { tone(220, 0.3, 'sawtooth', 0.08 * v, 440); },
    tell(v, kind) { const f = { hookL: 520, hookR: 620, upper: 380, body: 300, haymaker: 240, feint: 560, taunt: 700 }[kind] || 500; tone(f, 0.09, 'square', 0.06 * v); },
    star(v) { [880, 1175, 1568].forEach((f, i) => tone(f, 0.18, 'triangle', 0.18 * v, null, i * 0.07)); },
    bell() { bell(); },
    count(v) { tone(1200, 0.12, 'square', 0.08 * v); },
    tap(v) { tone(660, 0.04, 'square', 0.05 * v); },
    down() { tone(140, 0.6, 'sine', 0.6, 50); noise(0.5, 'lowpass', 400, 0.7, 0.5, 0.01); },
    roar(v) { noise(1.6, 'bandpass', 700, 0.5, 0.35 * v, 0.25); noise(1.4, 'bandpass', 1500, 0.6, 0.18 * v, 0.3); },
    reel(v) { for (let i = 0; i < 24; i++) noiseAt(i * 0.06, 0.03, 'bandpass', 1800, 2, 0.12 * v); tone(60, 2.5, 'sawtooth', 0.02 * v); },
    tvon(v) { tone(15750, 1.4, 'sine', 0.015 * v); noise(0.35, 'bandpass', 3000, 0.8, 0.12 * v, 0.01); tone(120, 0.25, 'square', 0.04 * v, 60); },
    click(v) { tone(1400, 0.025, 'square', 0.03 * v); noise(0.02, 'highpass', 4000, 0.7, 0.05 * v); },
    heart(v) { tone(55, 0.12, 'sine', 0.6 * v, 40); tone(52, 0.14, 'sine', 0.5 * v, 38, 0.16); },
    win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, 'sawtooth', 0.07, null, i * 0.14)); },
    page() { noise(0.12, 'highpass', 3000, 0.6, 0.12, 0.01); },
    type() { noise(0.03, 'bandpass', 2400, 2, 0.15); },
    stamp() { tone(80, 0.15, 'sine', 0.5, 40); noise(0.08, 'lowpass', 1200, 0.8, 0.4); },
    cash() { tone(1800, 0.09, 'triangle', 0.15); tone(2400, 0.2, 'triangle', 0.12, null, 0.08); },
  };

  T.audio = {
    get enabled() { return enabled; },
    set(on) {
      enabled = !!on;
      try { localStorage.setItem('tott-sound', on ? 'on' : 'off'); } catch (e) { /* ignore */ }
      if (!on) this.crowd(false);
      if (on) { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
    },
    unlock() { if (!enabled) return; init(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    play(name, v = 1, variant) {
      if (!enabled) return;
      if (!init()) return;
      if (ctx.state === 'suspended') ctx.resume();
      const fn = SOUNDS[name];
      try { fn && fn(v, variant); } catch (e) { /* never let sound break the game */ }
    },
    crowd(on) {
      if (!ctx) { if (!on || !enabled) return; init(); if (!ctx) return; }
      if (on && enabled) {
        if (crowdNode) return;
        const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 650; f.Q.value = 0.4;
        crowdGain = ctx.createGain(); crowdGain.gain.value = 0; crowdGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 1.5);
        src.connect(f); f.connect(crowdGain); crowdGain.connect(master); src.start();
        crowdNode = src;
      } else if (crowdNode) {
        const n = crowdNode, g = crowdGain; crowdNode = null;
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
        setTimeout(() => { try { n.stop(); } catch (e) { /* already stopped */ } }, 700);
      }
    },
  };
})(globalThis.TOT = globalThis.TOT || {});
