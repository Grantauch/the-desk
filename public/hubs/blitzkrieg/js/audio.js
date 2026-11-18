// Sound effects are synthesized with Web Audio. The soundtrack is three recorded marches.
(function (root) {
  const BK = root.BK;
  const Au = (BK.Audio = {});
  let ctx = null, master = null, sfx = null, musicBus = null, noise = null;
  const last = {};
  Au.muted = false;
  Au.musicOn = true;
  Au.combo = 0;

  function init() {
    if (ctx) return true;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
    } catch (e) { return false; }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    master = ctx.createGain();
    master.gain.value = Au.muted ? 0 : 0.8;
    master.connect(comp);
    comp.connect(ctx.destination);
    sfx = ctx.createGain();
    sfx.gain.value = 0.9;
    sfx.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.35;
    musicBus.connect(master);
    const len = ctx.sampleRate * 1.5;
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  Au.unlock = function () {
    if (!init()) return;
    if (ctx.state === "suspended") ctx.resume();
  };
  Au.setMuted = function (m) {
    Au.muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
  };
  Au.setMusic = function (on) {
    Au.musicOn = on;
    if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.35 : 0, ctx.currentTime, 0.2);
  };

  function ok(key, gap) {
    if (!ctx || Au.muted || ctx.state !== "running") return false;
    const t = ctx.currentTime;
    if (key && last[key] && t - last[key] < gap) return false;
    if (key) last[key] = t;
    return true;
  }

  function noiseHit(o) {
    const t = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = o.type || "lowpass";
    f.frequency.setValueAtTime(o.f0 || 1200, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
    f.Q.value = o.q || 0.8;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(o.vol || 0.5, t + (o.att || 0.004));
    gn.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f);
    f.connect(gn);
    gn.connect(o.bus || sfx);
    src.start(t, Math.random() * 1.2);
    src.stop(t + o.dur + 0.05);
  }

  function tone(o) {
    const t = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    osc.type = o.wave || "sine";
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + (o.slide || o.dur));
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(o.vol || 0.3, t + (o.att || 0.005));
    gn.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(gn);
    gn.connect(o.bus || sfx);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
    return osc;
  }

  Au.shot = function (gun, manned, vol) {
    const v = vol || 1;
    switch (gun) {
      case "mg":
        if (!ok("mg", 0.045)) return;
        noiseHit({ f0: 2400, f1: 500, dur: 0.07, vol: 0.32 * v, type: "bandpass", q: 1.2 });
        tone({ f0: 160, f1: 60, dur: 0.05, vol: 0.18 * v, wave: "square" });
        break;
      case "atr":
        if (!ok("atr", 0.05)) return;
        noiseHit({ f0: 3000, f1: 300, dur: 0.22, vol: 0.55, type: "bandpass", q: 0.7 });
        tone({ f0: 900, f1: 120, dur: 0.12, vol: 0.2, wave: "triangle" });
        break;
      case "at37":
        if (!ok("at37", 0.05)) return;
        noiseHit({ f0: 1800, f1: 200, dur: 0.35, vol: 0.6 });
        tone({ f0: 180, f1: 45, dur: 0.3, vol: 0.5 });
        break;
      case "f75":
        if (!ok("f75", 0.08)) return;
        noiseHit({ f0: 1400, f1: 80, dur: 0.9, vol: 0.85 });
        tone({ f0: 110, f1: 30, dur: 0.7, vol: 0.7 });
        break;
      case "mortar":
        if (!ok("mortar", 0.06)) return;
        tone({ f0: 320, f1: 140, dur: 0.18, vol: 0.4, wave: "triangle" });
        noiseHit({ f0: 900, f1: 200, dur: 0.2, vol: 0.3 });
        break;
      case "aa":
        if (!ok("aa", 0.06)) return;
        noiseHit({ f0: 1600, f1: 250, dur: 0.18, vol: 0.45 });
        tone({ f0: 140, f1: 60, dur: 0.14, vol: 0.4 });
        break;
      case "enemy":
        if (!ok("enemy", 0.08)) return;
        noiseHit({ f0: 1200, f1: 120, dur: 0.5, vol: 0.45 });
        tone({ f0: 120, f1: 40, dur: 0.35, vol: 0.4 });
        break;
    }
    if (manned && gun !== "mg") tone({ f0: 70, f1: 40, dur: 0.2, vol: 0.35 });
  };
  Au.enemyMg = function () {
    if (!ok("emg", 0.07)) return;
    noiseHit({ f0: 1800, f1: 600, dur: 0.06, vol: 0.18, type: "bandpass", q: 1.5 });
  };
  Au.boom = function (size) {
    if (!ok("boom", 0.04)) return;
    const s = Math.min(2.4, size || 1);
    noiseHit({ f0: 900 + s * 200, f1: 60, dur: 0.5 + s * 0.35, vol: 0.45 + s * 0.2 });
    tone({ f0: 90, f1: 28, dur: 0.4 + s * 0.3, vol: 0.4 + s * 0.15 });
  };
  Au.crit = function () {
    if (!ok("crit", 0.05)) return;
    tone({ f0: 1900, f1: 1500, dur: 0.18, vol: 0.18, wave: "square" });
    tone({ f0: 2850, dur: 0.12, vol: 0.1, wave: "triangle", delay: 0.01 });
  };
  Au.clang = function () {
    if (!ok("clang", 0.05)) return;
    tone({ f0: 620, f1: 480, dur: 0.12, vol: 0.12, wave: "square" });
    noiseHit({ f0: 4000, dur: 0.05, vol: 0.12, type: "highpass" });
  };
  Au.thud = function () {
    if (!ok("thud", 0.04)) return;
    noiseHit({ f0: 500, f1: 150, dur: 0.12, vol: 0.18 });
  };
  // Each coin rings a little higher as the combo climbs.
  Au.coin = function (n) {
    if (!ok("coin", 0.03)) return;
    const step = Math.min(14, Au.combo);
    const f = 880 * Math.pow(2, step / 24);
    tone({ f0: f, dur: 0.09, vol: 0.12, wave: "square" });
    tone({ f0: f * 1.5, dur: 0.16, vol: 0.1, wave: "square", delay: 0.05 });
  };
  Au.siren = function () {
    if (!ok("siren", 0.8)) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.exponentialRampToValueAtTime(980, t + 1.6);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 7;
    const lg = ctx.createGain();
    lg.gain.value = 18;
    lfo.connect(lg);
    lg.connect(osc.frequency);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 900;
    f.Q.value = 1.4;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(0.22, t + 0.5);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 2);
    osc.connect(f);
    f.connect(gn);
    gn.connect(sfx);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 2.1);
    lfo.stop(t + 2.1);
  };
  Au.whistle = function () {
    if (!ok("whistle", 0.3)) return;
    tone({ f0: 1600, f1: 500, dur: 0.85, vol: 0.12, wave: "sine", slide: 0.85 });
  };
  Au.plane = function (fast) {
    if (!ok("plane", 0.5)) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(fast ? 150 : 90, t);
    osc.frequency.linearRampToValueAtTime(fast ? 110 : 70, t + 2);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 500;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(fast ? 0.16 : 0.08, t + 0.6);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    osc.connect(f);
    f.connect(gn);
    gn.connect(sfx);
    osc.start(t);
    osc.stop(t + 2.3);
  };
  Au.pop = function () {
    if (!ok("pop", 0.1)) return;
    noiseHit({ f0: 3000, f1: 800, dur: 0.6, vol: 0.3, type: "bandpass", q: 0.5 });
  };
  Au.leak = function () {
    if (!ok("leak", 0.3)) return;
    tone({ f0: 196, dur: 0.5, vol: 0.2, wave: "sawtooth" });
    tone({ f0: 185, dur: 0.5, vol: 0.2, wave: "sawtooth", delay: 0.02 });
    tone({ f0: 98, dur: 0.6, vol: 0.25, wave: "square", delay: 0.18 });
  };
  Au.build = function () {
    if (!ok("build", 0.05)) return;
    noiseHit({ f0: 700, f1: 200, dur: 0.15, vol: 0.3 });
    tone({ f0: 220, f1: 140, dur: 0.12, vol: 0.2, wave: "triangle", delay: 0.06 });
  };
  Au.upgrade = function () {
    if (!ok("upg", 0.05)) return;
    [523, 659, 784, 1047].forEach((f, i) => tone({ f0: f, dur: 0.16, vol: 0.12, wave: "square", delay: i * 0.05 }));
  };
  Au.ui = function (kind) {
    if (!ok("ui", 0.03)) return;
    if (kind === "man") { tone({ f0: 300, f1: 600, dur: 0.12, vol: 0.15, wave: "square" }); return; }
    if (kind === "deny") { tone({ f0: 180, dur: 0.12, vol: 0.15, wave: "square" }); return; }
    tone({ f0: 660, dur: 0.05, vol: 0.08, wave: "square" });
  };
  Au.radio = function () {
    if (!ok("radio", 0.2)) return;
    noiseHit({ f0: 2500, dur: 0.25, vol: 0.12, type: "bandpass", q: 3 });
    tone({ f0: 1200, dur: 0.06, vol: 0.08, wave: "square", delay: 0.25 });
    tone({ f0: 1200, dur: 0.06, vol: 0.08, wave: "square", delay: 0.36 });
  };
  Au.reel = function () {
    if (!ctx || Au.muted) return;
    for (let i = 0; i < 12; i++) tone({ f0: 1400 + (i % 3) * 200, dur: 0.03, vol: 0.07, wave: "square", delay: i * 0.09 + i * i * 0.002 });
  };
  Au.prize = function () {
    if (!ok("prize", 0.1)) return;
    [784, 988, 1175].forEach((f, i) => tone({ f0: f, dur: 0.2, vol: 0.13, wave: "square", delay: i * 0.07 }));
  };
  Au.jackpot = function () {
    if (!ok("jack", 0.2)) return;
    const seq = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
    seq.forEach((f, i) => tone({ f0: f, dur: 0.18, vol: 0.14, wave: "square", delay: i * 0.08 }));
    for (let i = 0; i < 16; i++) tone({ f0: 2000 + Math.random() * 1500, dur: 0.05, vol: 0.05, wave: "triangle", delay: 0.7 + i * 0.04 });
  };
  Au.card = function (rarity) {
    if (!ok("card", 0.05)) return;
    noiseHit({ f0: 4000, f1: 800, dur: 0.18, vol: 0.12, type: "bandpass" });
    const base = { common: 660, rare: 784, epic: 988, legendary: 1175 }[rarity] || 660;
    tone({ f0: base, dur: 0.25, vol: 0.12, wave: "triangle", delay: 0.05 });
    if (rarity === "epic" || rarity === "legendary") tone({ f0: base * 1.5, dur: 0.35, vol: 0.1, wave: "triangle", delay: 0.12 });
    if (rarity === "legendary") tone({ f0: base * 2, dur: 0.5, vol: 0.1, wave: "triangle", delay: 0.22 });
  };
  Au.streak = function (n) {
    if (!ok("streak", 0.2)) return;
    const f = 440 * Math.pow(2, Math.min(12, n / 10) / 12);
    [1, 1.25, 1.5, 2].forEach((m, i) => tone({ f0: f * m, dur: 0.18, vol: 0.13, wave: "sawtooth", delay: i * 0.06 }));
  };
  Au.bugle = function () {
    if (!ok("bugle", 0.5)) return;
    [392, 523, 659, 784, 659, 784].forEach((f, i) => tone({ f0: f, dur: i === 5 ? 0.5 : 0.16, vol: 0.12, wave: "sawtooth", delay: i * 0.13, bus: sfx }));
  };
  Au.bossDown = function () {
    if (!ok("bossdown", 0.5)) return;
    tone({ f0: 60, f1: 25, dur: 1.6, vol: 0.6 });
    [392, 494, 587, 784].forEach((f, i) => tone({ f0: f, dur: 0.35, vol: 0.12, wave: "square", delay: 0.5 + i * 0.1 }));
  };
  Au.victory = function () {
    if (!ok("vic", 1)) return;
    [523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone({ f0: f, dur: 0.3, vol: 0.14, wave: "square", delay: i * 0.16 }));
  };
  Au.defeat = function () {
    if (!ok("def", 1)) return;
    [392, 370, 349, 262].forEach((f, i) => tone({ f0: f, dur: 0.5, vol: 0.14, wave: "sawtooth", delay: i * 0.3 }));
  };

  // Internals for sfx.js, which layers recorded sounds over these synth fallbacks.
  Au._int = function () { init(); return { ctx, sfx, master, musicBus, ok, noiseHit, tone }; };

  // A stand-in with every sound call as a no-op, for the silent title battle.
  Au.silent = new Proxy({}, { get: () => () => {} });

  // The soundtrack: Grant's three recorded marches in shuffled rotation, played through the music
  // bus so the music button and mute both work. The synthesized drums below are the fallback.
  Au.TRACKS = [
    { src: "assets/music/march-of-the-iron-engines.mp3", name: "March of the Iron Engines" },
    { src: "assets/music/iron-line-advance.mp3", name: "Iron Line Advance" },
    { src: "assets/music/the-long-advance.mp3", name: "The Long Advance" },
  ];
  let player = null, trackGain = null, order = [], trackI = -1, trackFailed = false;
  Au.onTrack = null;
  function nextTrack() {
    if (!order.length || trackI >= order.length - 1) {
      const last = order[trackI];
      order = Au.TRACKS.map((_, i) => i).sort(() => Math.random() - 0.5);
      if (order[0] === last && order.length > 1) order.push(order.shift());
      trackI = -1;
    }
    trackI++;
    const t = Au.TRACKS[order[trackI]];
    player.src = t.src;
    const p = player.play();
    if (p && p.catch) p.catch(() => {});
    if (Au.onTrack) Au.onTrack(t);
  }
  function startTracks() {
    if (player || trackFailed || !root.Audio || !ctx.createMediaElementSource) return !!player;
    try {
      player = new root.Audio();
      player.preload = "auto";
      trackGain = ctx.createGain();
      trackGain.gain.value = 0.85;
      ctx.createMediaElementSource(player).connect(trackGain);
      trackGain.connect(musicBus);
      player.addEventListener("ended", nextTrack);
      player.addEventListener("error", () => { trackFailed = true; player = null; Au.startDrums(); });
      nextTrack();
      return true;
    } catch (e) { trackFailed = true; player = null; return false; }
  }
  Au.trackName = function () { return player && trackI >= 0 ? Au.TRACKS[order[trackI]].name : null; };

  // A low snare and timpani march under the battle. It thickens as the wave goes on.
  let musicTimer = null, beat = 0;
  Au.intensity = 0;
  Au.startMusic = function () {
    if (!init()) return;
    if (player) { if (player.paused && ctx.state === "running") player.play().catch(() => {}); return; }
    if (startTracks()) return;
    Au.startDrums();
  };
  Au.startDrums = function () {
    if (!init() || musicTimer) return;
    const tempo = 0.25;
    musicTimer = setInterval(() => {
      if (!ctx || ctx.state !== "running" || Au.muted || !Au.musicOn) { beat++; return; }
      const i = Au.intensity;
      const b = beat % 16;
      const snare = (o) => noiseHit(Object.assign({ f0: 2600, f1: 900, dur: 0.09, vol: 0.06, type: "bandpass", q: 0.9, bus: musicBus }, o));
      if (b % 4 === 0) tone({ f0: b === 0 ? 73 : 65, f1: 45, dur: 0.35, vol: 0.32, bus: musicBus });
      if (b === 4 || b === 12) snare({ vol: 0.12 });
      if (i > 0.3 && (b === 6 || b === 7 || b === 14)) snare({ vol: 0.06 });
      if (i > 0.6 && b % 2 === 1) snare({ vol: 0.04 });
      if (i > 0.2 && b % 8 === 0) {
        const notes = [110, 110, 98, 131];
        tone({ f0: notes[Math.floor(beat / 16) % 4], dur: 1.6, vol: 0.03 + i * 0.03, wave: "triangle", bus: musicBus, att: 0.2 });
      }
      beat++;
    }, tempo * 1000);
  };
})(typeof window !== "undefined" ? window : globalThis);
