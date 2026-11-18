// Recorded sound effects. Weapons, explosions and aircraft engines come from Spring: 1944
// (CC BY-NC 3.0), foley, voices and ambience from Oculus Audio Pack 01 (CC BY 4.0). Every call
// falls back to the synthesized sound in audio.js until its sample has loaded. Sounds are placed
// by where they happen: far from the camera they are quieter and pan left or right.
(function (root) {
  const BK = root.BK;
  const Au = BK.Audio;
  const synth = Object.assign({}, Au);
  const FILES = ["mg", "atr", "at37", "at37b", "mortar", "aa", "aa2", "f75", "emg", "rifle", "e20", "e75", "e75b", "e50",
    "ex1", "ex2", "ex3", "ex4", "ex5", "ex6", "ex7", "ex8", "gren", "flak1", "flak2", "veh1", "veh2", "veh3", "bomb", "art105", "art155", "flame",
    "siren", "eng109", "engp11", "eng190", "horse1", "horse2", "case1", "case2", "clink", "metal1", "metal2", "metal3",
    "die1", "die2", "die3", "die4", "hurt1", "scream", "ui", "uiback", "deny", "uimetal", "lever1", "lever2", "drop", "anvil"];
  const LOOPS = ["amb_farm", "amb_wind", "amb_rain"];
  const buf = {};
  let I = null, loading = false, voices = 0;
  const lastAt = {};

  function load() {
    if (loading) return;
    I = Au._int();
    if (!I.ctx) return;
    loading = true;
    const get = (name) => fetch(`assets/sfx/${name}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((a) => new Promise((res, rej) => I.ctx.decodeAudioData(a, res, rej))).then((b) => { buf[name] = b; }).catch(() => {});
    // Weapons first, ambience after.
    Promise.all(FILES.map(get)).then(() => Promise.all(LOOPS.map(get))).then(() => ambience());
  }
  const baseUnlock = Au.unlock;
  Au.unlock = function () { baseUnlock(); load(); };

  // Where the next sound happens, set by the renderer from the event that caused it.
  Au.pos = null;
  Au.listener = null;
  function place() {
    const p = Au.pos, L = Au.listener;
    if (!p || !L) return { g: 1, pan: 0 };
    const dx = p[0] - L.x, dy = p[1] - L.y;
    const d = Math.hypot(dx, dy);
    const near = L.r, far = L.r * 3.2;
    const g = d < near ? 1 : Math.max(0.12, 1 - (d - near) / (far - near));
    return { g, pan: Math.max(-0.8, Math.min(0.8, dx / (L.r * 1.6))) };
  }
  function ready(key, gap) {
    if (!I || !I.ctx || Au.muted || I.ctx.state !== "running") return false;
    const t = I.ctx.currentTime;
    if (key && lastAt[key] && t - lastAt[key] < gap) return false;
    if (key) lastAt[key] = t;
    return true;
  }
  // Play one sample. o: vol, rate, jit (rate jitter), off (start offset), dur (cut length), pos (bool, use placement).
  function play(name, o) {
    const b = buf[name];
    if (!b || voices > 28) return null;
    o = o || {};
    const ctx = I.ctx, t = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = (o.rate || 1) * (1 + ((Math.random() * 2 - 1) * (o.jit == null ? 0.06 : o.jit)));
    const pl = o.pos === false ? { g: 1, pan: 0 } : place();
    const gn = ctx.createGain();
    const v = (o.vol == null ? 0.7 : o.vol) * pl.g;
    const off = Math.min(b.duration - 0.05, o.off || 0);
    const dur = o.dur ? Math.min(o.dur, b.duration - off) : b.duration - off;
    gn.gain.setValueAtTime(v, t);
    if (o.dur) { gn.gain.setValueAtTime(v, t + Math.max(0.01, dur - 0.06)); gn.gain.linearRampToValueAtTime(0.0001, t + dur); }
    let node = src;
    node.connect(gn);
    node = gn;
    if (ctx.createStereoPanner && pl.pan) { const p = ctx.createStereoPanner(); p.pan.value = pl.pan; node.connect(p); node = p; }
    node.connect(o.bus || I.sfx);
    src.start(t, off, dur + 0.02);
    voices++;
    src.onended = () => { voices--; };
    return src;
  }
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const has = (n) => !!buf[n];

  // ------------------------------------------------------------------ weapons
  // Automatic weapons play a slice of a recorded burst, so a long stream of shots reads as fire, not clicks.
  Au.shot = function (gun, manned, vol) {
    const v = vol || 1;
    const k = { mg: "mg", atr: "atr", at37: "at37", f75: "f75", mortar: "mortar", aa: "aa", enemy: "e20", etank: "e75", emortar: "mortar", flame: "flame", train: "f75" }[gun];
    if (!k || !has(k)) return synth.shot(gun === "etank" || gun === "train" ? "f75" : gun === "emortar" ? "mortar" : gun === "flame" ? "aa" : gun, manned, vol);
    switch (gun) {
      case "mg":
        if (!ready("mg", 0.24)) return;
        play("mg", { vol: 0.42 * v, off: Math.random() * 0.45, dur: 0.32, jit: 0.05 });
        if (Math.random() < 0.25) play("case" + (1 + (Math.random() < 0.5 ? 1 : 0)), { vol: 0.12, delay: 0.3, jit: 0.15 });
        break;
      case "atr":
        if (!ready("atr", 0.06)) return;
        play("atr", { vol: 0.6 * v });
        break;
      case "at37":
        if (!ready("at37", 0.06)) return;
        play(Math.random() < 0.5 ? "at37" : "at37b", { vol: 0.62 * v });
        break;
      case "f75":
      case "train":
        if (!ready(gun, 0.1)) return;
        play("f75", { vol: 0.8 * v, jit: 0.04 });
        break;
      case "mortar":
      case "emortar":
        if (!ready(gun, 0.08)) return;
        play("mortar", { vol: (gun === "emortar" ? 0.4 : 0.55) * v, rate: gun === "emortar" ? 0.85 : 1 });
        break;
      case "aa":
        if (!ready("aa", 0.09)) return;
        play(Math.random() < 0.7 ? "aa" : "aa2", { vol: 0.5 * v });
        break;
      case "enemy":
        if (!ready("enemy", 0.1)) return;
        play(Math.random() < 0.6 ? "e20" : "rifle", { vol: 0.42 * v });
        break;
      case "etank":
        if (!ready("etank", 0.12)) return;
        play(pick(["e75", "e75b", "e50"]), { vol: 0.6 * v, jit: 0.05 });
        break;
      case "flame":
        if (!ready("flame", 0.3)) return;
        play("flame", { vol: 0.4 * v, off: Math.random() * 0.6, dur: 0.5 });
        break;
    }
    if (manned && gun !== "mg" && has("lever1") && Math.random() < 0.5) play(pick(["lever1", "lever2"]), { vol: 0.18, delay: 0.25, pos: false });
  };
  Au.enemyMg = function () {
    if (!has("emg")) return synth.enemyMg();
    if (!ready("emg", 0.3)) return;
    play(Math.random() < 0.8 ? "emg" : "rifle", { vol: 0.3, off: Math.random() * 1.2, dur: 0.38 });
  };

  // ------------------------------------------------------------------ explosions and hits
  Au.boom = function (size) {
    const s = size || 1;
    const set = s < 0.6 ? ["gren", "ex1", "ex2", "ex6"] : s < 1.25 ? ["ex3", "ex4", "ex6", "ex7", "ex1"] : ["ex5", "ex8", "bomb", "ex7"];
    if (!set.every(has)) return synth.boom(size);
    if (!ready("boom" + (s < 0.6 ? "s" : s < 1.25 ? "m" : "l"), s < 0.6 ? 0.05 : 0.07)) return;
    play(pick(set), { vol: Math.min(1, 0.5 + s * 0.25), rate: s > 1.6 ? 0.9 : 1, jit: 0.08 });
  };
  Au.vehicleBoom = function () {
    if (!has("veh1")) return Au.boom(1.4);
    if (!ready("veh", 0.25)) return;
    play(pick(["veh1", "veh2", "veh3"]), { vol: 0.8, jit: 0.06 });
  };
  Au.flak = function () {
    if (!has("flak1")) return;
    if (!ready("flak", 0.12)) return;
    play(pick(["flak1", "flak2"]), { vol: 0.35, jit: 0.1 });
  };
  Au.crit = function () {
    if (!has("metal1")) return synth.crit();
    if (!ready("crit", 0.06)) return;
    play(pick(["metal1", "metal2", "metal3"]), { vol: 0.42, rate: 1.35, jit: 0.08 });
  };
  Au.clang = function () {
    if (!has("metal1")) return synth.clang();
    if (!ready("clang", 0.08)) return;
    play(pick(["metal1", "metal2", "metal3"]), { vol: 0.28, rate: 1.05, jit: 0.15 });
  };
  Au.thud = function () {
    if (!has("die1")) return synth.thud();
    if (BK.gore) {
      if (!ready("die", 0.55)) return;
      play(Math.random() < 0.08 ? "scream" : pick(["die1", "die2", "die3", "die4", "hurt1"]), { vol: 0.24, jit: 0.1 });
    } else if (ready("thud", 0.1)) play(pick(["case1", "case2"]), { vol: 0.15, rate: 0.6 });
  };
  Au.coin = function (n) {
    if (!has("clink")) return synth.coin(n);
    if (!ready("coin", 0.06)) return;
    play("clink", { vol: 0.12 + Math.min(0.12, (Au.combo || 0) * 0.004), rate: 1.1 + Math.min(0.5, (Au.combo || 0) * 0.02), jit: 0.08, pos: false });
  };
  Au.whistle = function () {
    if (!has("art105")) return synth.whistle();
    if (!ready("whistle", 0.5)) return;
    // The distant thump of the gun that fired it, then the round arrives.
    play(Math.random() < 0.5 ? "art105" : "art155", { vol: 0.2, rate: 0.85, pos: false });
  };
  Au.pop = function () {
    if (!has("gren")) return synth.pop();
    if (!ready("pop", 0.15)) return;
    play("gren", { vol: 0.18, rate: 1.5 });
  };

  // ------------------------------------------------------------------ aircraft
  function engine(name, vol, life, rate0, rate1) {
    const b = buf[name];
    if (!b) return;
    const ctx = I.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.loop = true;
    src.playbackRate.setValueAtTime(rate0, t);
    src.playbackRate.linearRampToValueAtTime(rate1, t + life);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 2600;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol, t + life * 0.45);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + life);
    src.connect(f); f.connect(gn); gn.connect(I.sfx);
    src.start(t);
    src.stop(t + life + 0.1);
  }
  Au.plane = function (fast) {
    if (!has("eng109")) return synth.plane(fast);
    if (!ready("plane", 1.5)) return;
    if (fast) engine("engp11", 0.22, 3, 1.15, 0.9);
    else { engine("eng109", 0.16, 6, 1.05, 0.88); engine("eng190", 0.1, 6.5, 0.95, 0.82); }
  };
  Au.siren = function () {
    synth.siren();
    if (has("eng109") && ready("dive", 1.5)) engine("eng109", 0.2, 2.2, 0.9, 1.35);
  };

  // ------------------------------------------------------------------ building and interface
  Au.build = function () {
    if (!has("drop")) return synth.build();
    if (!ready("build", 0.08)) return;
    play("drop", { vol: 0.32, rate: 0.8 });
    play(pick(["lever1", "lever2"]), { vol: 0.2, delay: 0.12 });
  };
  Au.upgrade = function () {
    if (!has("anvil")) return synth.upgrade();
    if (!ready("upgrade", 0.15)) return;
    play("anvil", { vol: 0.32, pos: false });
    play(pick(["lever1", "lever2"]), { vol: 0.25, delay: 0.15, pos: false });
  };
  Au.ui = function (kind) {
    if (!has("ui")) return synth.ui(kind);
    if (!ready("ui", 0.04)) return;
    if (kind === "deny") play("deny", { vol: 0.35, pos: false, jit: 0 });
    else if (kind === "man") play(pick(["lever1", "lever2"]), { vol: 0.4, pos: false });
    else play("ui", { vol: 0.32, pos: false, jit: 0.04 });
  };
  Au.card = function (rarity) {
    if (!has("uimetal")) return synth.card(rarity);
    play(rarity === "legendary" || rarity === "epic" ? "uimetal" : "ui", { vol: 0.3, pos: false });
  };
  Au.reel = function () {
    if (!has("lever1")) return synth.reel();
    play("lever1", { vol: 0.35, pos: false });
  };
  Au.prize = function () {
    if (!has("clink")) return synth.prize();
    for (let i = 0; i < 3; i++) play("clink", { vol: 0.2, rate: 1.2 + i * 0.12, delay: i * 0.07, pos: false });
  };
  Au.jackpot = function () {
    if (!has("clink")) return synth.jackpot();
    play("anvil", { vol: 0.4, pos: false });
    for (let i = 0; i < 10; i++) play("clink", { vol: 0.18, rate: 1 + Math.random() * 0.6, delay: 0.1 + i * 0.06, pos: false });
  };
  Au.streak = function (n) {
    if (!has("anvil")) return synth.streak(n);
    play("anvil", { vol: 0.3, rate: 1 + Math.min(0.3, (n || 0) / 400), pos: false });
  };
  Au.bossDown = function () {
    if (!has("veh1")) return synth.bossDown();
    Au.pos = null;
    play("veh2", { vol: 0.9, rate: 0.85, pos: false });
    play("bomb", { vol: 0.6, delay: 0.25, pos: false });
  };
  Au.leak = function () {
    if (!has("emg")) return synth.leak();
    if (!ready("leak", 0.6)) return;
    play("emg", { vol: 0.35, off: 0.2, dur: 0.7, pos: false });
  };
  Au.bugle = function () {
    if (!has("siren")) return synth.bugle();
    play("siren", { vol: 0.22, dur: 3.2, pos: false, jit: 0 });
  };
  Au.charge = function () {
    if (!has("horse1")) return;
    play("horse1", { vol: 0.45, pos: false });
    play("horse2", { vol: 0.35, delay: 0.5, pos: false, rate: 1.1 });
    play("horse1", { vol: 0.3, delay: 1.0, pos: false, rate: 0.9 });
  };
  Au.horse = function () {
    if (!has("horse2") || !ready("horse", 4)) return;
    play(Math.random() < 0.5 ? "horse1" : "horse2", { vol: 0.25 });
  };

  // ------------------------------------------------------------------ ambience
  // Farm and wind beds under the quiet between waves; rain when it rains. They duck in combat.
  const amb = {};
  function bed(name) {
    if (amb[name] || !buf[name]) return amb[name];
    const ctx = I.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf[name];
    src.loop = true;
    const gn = ctx.createGain();
    gn.gain.value = 0;
    src.connect(gn); gn.connect(I.sfx);
    src.start(ctx.currentTime, Math.random() * 20);
    amb[name] = gn;
    return gn;
  }
  function ambience() {
    if (!I || !I.ctx) return;
    setInterval(() => {
      const app = BK.app, g = app && app.g;
      if (!g || I.ctx.state !== "running") return;
      const live = app.inRun && !app.paused;
      const combat = g.phase === "combat";
      const want = {
        amb_farm: live && !combat && g.weatherId !== "rain" ? 0.16 : 0,
        amb_wind: live ? (combat ? 0.05 : 0.1) : 0.04,
        amb_rain: live && g.weatherId === "rain" ? 0.22 : 0,
      };
      for (const k in want) {
        const gn = want[k] > 0 ? bed(k) : amb[k];
        if (gn) gn.gain.setTargetAtTime(Au.muted ? 0 : want[k], I.ctx.currentTime, 1.2);
      }
    }, 500);
  }
})(typeof window !== "undefined" ? window : globalThis);
