/* Blacktop Kings — the match: rules, movement, the ball, and every basketball action.
   Half court, 3 on 3, first to the target. Inside the arc is 1, outside is 2. No clearing,
   no fouls, no out of bounds (the fence plays the ball back). Style points from tricks fill the
   Crown meter; a made Crown shot adds points to you and takes them from the other side.
   BK.Match(canvas, opts) runs one game. AI lives in game-ai.js, drawing in game-render.js. */
(function (BK) {
  'use strict';
  const D = BK.data, A = BK.art, C = A.COURT;
  const W = 1280, H = 720, STEP = 1 / 60;
  const G_BALL = 32, G_JUMP = 30, TAU = Math.PI * 2;
  const CROWN_PTS = 5000;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const hyp = Math.hypot;
  const RIM = { x: C.rimX, y: C.rimY };
  const distRim = (o) => hyp(o.x - RIM.x, o.y - RIM.y);

  // ---------- setup ----------
  function Match(canvas, opts) {
    this.canvas = canvas; this.opts = opts;
    this.ctx = canvas.getContext('2d');
    this.cam = A.defaultCamera(W, H);
    this.fx = new BK.FX(this.cam);
    this.fx.reduced = !!opts.reducedMotion;
    this.fx.quiet = !!opts.attract;
    this.court = opts.court;
    this.rule = opts.rule || 'standard';
    this.target = opts.target || 21;
    this.skill = opts.skill == null ? 0.55 : opts.skill;
    this.attract = !!opts.attract;
    this.time = 0; this.excite = 0.2; this.phase = 'intro'; this.phaseT = 0; this.offense = 0;
    this.hoop = { shake: 0, swish: 0, shattered: false };
    this.events = [];
    this.teams = opts.teams.map((t, i) => makeTeam(t, i));
    fixColors(this.teams);
    this.players = [];
    this.teams.forEach((t) => t.players.forEach((p) => this.players.push(p)));
    this.players.forEach((p) => { p.mates = this.teams[p.team].players.filter((q) => q !== p); p.opps = this.teams[1 - p.team].players; });
    this.teams.forEach((t) => t.players.forEach((p, i) => { p.mark = this.teams[1 - t.i].players[i]; }));
    this.ball = { x: 20, y: 0, z: 4, vx: 0, vy: 0, vz: 0, state: 'held', holder: null, rot: 0, trail: [], flight: null, lastTeam: 0, touched: new Set() };
    this.humans = (opts.humans || []).map((h) => ({ team: h.team, ctrl: h.ctrl, player: null, label: h.label || ('P' + (h.team + 1)) }));
    this.humans.forEach((h) => { this.teams[h.team].human = h; });
    this.crowd = A.makeCrowd(this.court);
    this.camBase = opts.camera === 'wide' ? 1 : 1.3;
    this.camZ = this.camBase; this.camFocus = { x: W / 2, y: H / 2 };
    this.bg = document.createElement('canvas');
    this.paintBackground();
    this.offense = opts.firstOffense == null ? (Math.random() < 0.5 ? 0 : 1) : opts.firstOffense;
    this.placeForCheck(this.offense, true);
    this.players.forEach((p) => this.updatePose(p, 0));
    this.positionHeldBall();
    this.updateCamera(0, true);
    this.running = false; this.paused = false; this.over = false;
    this.acc = 0; this.last = 0;
    this.stats = { plays: [] };
    this.hint = opts.showHint ? 9 : 0;
  }
  BK.Match = Match;
  const M = Match.prototype;
  M.W = W; M.H = H;

  function colorDist(a, b) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    return hyp(((pa >> 16) & 255) - ((pb >> 16) & 255), ((pa >> 8) & 255) - ((pb >> 8) & 255), (pa & 255) - (pb & 255));
  }
  function fixColors(teams) {
    const [a, b] = teams;
    if (colorDist(a.colors.pri, b.colors.pri) < 110) {
      // away team switches to its secondary color, or white if that clashes too
      const alt = colorDist(a.colors.pri, b.colors.sec) > 140 ? b.colors.sec : (colorDist(a.colors.pri, '#f2f2f2') > 140 ? '#f2f2f2' : '#1e2128');
      b.colors = { pri: alt, sec: b.colors.pri, num: A.luminance(alt) > 0.6 ? b.colors.pri : '#ffffff' };
    }
  }

  function makeTeam(spec, i) {
    const pri = spec.colors[0], sec = spec.colors[1];
    const t = {
      i, name: spec.name, logo: spec.logo || 'star', colors: { pri, sec, num: A.luminance(pri) > 0.62 ? (A.luminance(sec) > 0.62 ? '#111111' : sec) : (A.luminance(sec) < 0.35 ? '#ffffff' : sec) },
      score: 0, crown: 0, crownActive: 0, pot: 0, combo: 0, lastTrick: null, human: null, skill: spec.skill,
      players: [],
    };
    t.players = spec.players.map((pd, k) => makePlayer(pd, t, k, spec.boost || 0));
    return t;
  }
  function makePlayer(pd, team, slot, boost) {
    const r = {};
    D.STAT_KEYS.forEach((k) => { r[k] = clamp((pd.r && pd.r[k] != null ? pd.r[k] : 5) + boost, 1, 11); });
    const dims = A.dims(pd.hgt, pd.build);
    const hgtFt = pd.hgt / 12;
    return {
      data: pd, team: team.i, slot, r, dims, hgtFt,
      reach: hgtFt * 1.33, jumpV: 11.5 + r.dnk * 0.35 + r.blk * 0.2 + (pd.build === 'heavy' ? -1 : 0),
      speed: 15.5 + r.spd * 0.95 - Math.max(0, pd.hgt - 78) * 0.18 + (pd.build === 'heavy' ? -1 : pd.build === 'lean' ? 0.4 : 0),
      x: 20, y: 0, z: 0, vx: 0, vy: 0, vz: 0, facing: team.i === 0 ? 1 : 1, spin: 0, face: 0,
      state: 'move', st: 0, phase: Math.random() * 6, dribT: Math.random(), turbo: 1, turboOn: false,
      cool: { steal: 0, trick: 0, pass: 0, shoot: 0, jump: 0 }, stunT: 0, streak: 0, fire: false,
      ai: { react: 0, spot: null, spotT: 0, holdT: 0, intent: null, cutT: 0, jumpAt: -1 },
      stats: { pts: 0, fgm: 0, fga: 0, dnk: 0, blk: 0, stl: 0, ast: 0, reb: 0, tricks: 0, ankles: 0, style: 0, oops: 0 },
      pose: null, anim: 'idle', fly: null, shot: null, trick: null, human: null, catchTarget: null,
    };
  }

  M.paintBackground = function () {
    // painted once per game, a bit sharper than the screen so the camera can zoom in without blur
    const dpr = this.pixelRatio();
    const s = Math.min(dpr * Math.max(1, this.camBase * 1.12), Math.sqrt(7e6 / (W * H)));
    this.bg.width = Math.round(W * s); this.bg.height = Math.round(H * s);
    const g = this.bg.getContext('2d'); g.setTransform(s, 0, 0, s, 0, 0);
    A.paintScene(g, this.cam, this.court);
  };

  // ---------- the broadcast camera ----------
  // A 2D zoom and pan over the painted court that eases toward the ball, leaning toward the rim.
  M.updateCamera = function (dt, snap) {
    const b = this.ball; const cam = this.cam;
    let gx = b.x, gy = b.y;
    if (this.phase === 'intro' || this.phase === 'check') { const h = this.ball.holder; if (h) { gx = h.x; gy = h.y; } }
    const bp = cam.project(gx, gy, 0); const rim = cam.project(C.rimX, 0, 0);
    const tx = lerp(bp.x, rim.x, 0.28), ty = lerp(bp.y, H * 0.66, 0.5) - 24;
    const k = snap ? 1 : 1 - Math.exp(-dt * 2.4);
    this.camFocus.x += (tx - this.camFocus.x) * k; this.camFocus.y += (ty - this.camFocus.y) * k;
    const zt = this.over && this.phase === 'over' ? this.camBase * 1.05 : this.camBase;
    this.camZ += (zt - this.camZ) * (snap ? 1 : 1 - Math.exp(-dt * 1.5));
  };
  M.cameraBase = function () {
    const z = this.camZ;
    let ox = W / 2 - this.camFocus.x * z, oy = H / 2 - this.camFocus.y * z;
    ox = Math.min(0, Math.max(W - W * z, ox)); oy = Math.min(0, Math.max(H - H * z, oy));
    return { z, ox, oy };
  };
  M.pixelRatio = function () { return Math.min(2, Math.max(1, (window.devicePixelRatio || 1) * (this.canvas.clientWidth || W) / W)); };

  // ---------- running ----------
  M.start = function () {
    this.running = true; this.last = performance.now();
    if (BK.input) BK.input.capture(!this.attract);
    const loop = (now) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      let dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
      if (this.paused) { this.render(); return; }
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(loop);
  };
  M.stop = function () { this.running = false; cancelAnimationFrame(this.raf); if (BK.input) BK.input.capture(false); };
  M.pause = function () { this.paused = true; };
  M.resume = function () { this.paused = false; this.last = performance.now(); this.humans.forEach((h) => { h.ctrl.poll(); h.ctrl.clearEdges(); }); };
  M.frame = function (dt) {
    this.humans.forEach((h) => h.ctrl.poll());
    const pauseHit = this.humans.some((h) => h.ctrl.hit.pause);
    if (pauseHit && !this.over && this.opts.onPause) { this.opts.onPause(); return; }
    const scale = this.fx.timeScale();
    this.acc += dt * scale;
    let steps = 0;
    while (this.acc >= STEP && steps < 6) { this.update(STEP); this.acc -= STEP; steps++; this.humans.forEach((h) => h.ctrl.clearEdges()); }
    if (steps === 0) this.humans.forEach((h) => { /* keep edges for the next step */ void h; });
    this.fx.update(dt * scale, dt);
    this.updateCamera(dt);
    this.time += dt;
    this.render();
  };
  // Headless fast-forward for tests: runs the sim without drawing.
  M.simulate = function (seconds) {
    const n = Math.round(seconds / STEP);
    for (let i = 0; i < n && !this.over; i++) { this.update(STEP); this.fx.update(STEP, STEP); this.time += STEP; }
  };

  M.emit = function (type, data) { if (this.opts.onEvent) this.opts.onEvent(type, data); };
  M.sfx = function (name, vol) { if (!this.attract && BK.audio) BK.audio.sfx(name, vol); };
  M.call = function (kind, opts) { if (this.attract && kind !== 'force') return; const list = D.CALLS[kind]; const text = list ? pick(list) : kind; this.fx.call(opts && opts.text ? opts.text : text, opts); };
  M.hype = function (v) { this.excite = Math.max(this.excite, v); };

  // ---------- possession setup ----------
  M.placeForCheck = function (off, instant) {
    this.offense = off;
    const offT = this.teams[off], defT = this.teams[1 - off];
    const spots = [[19, 0], [27, -15], [29, 15]];
    let handler = offT.players[0];
    if (!offT.human) handler = offT.players.slice().sort((a, b) => (b.r.hnd + b.r.pas) - (a.r.hnd + a.r.pas))[0];
    const order = [handler].concat(offT.players.filter((p) => p !== handler));
    order.forEach((p, i) => {
      const s = spots[i];
      if (instant) { p.x = s[0]; p.y = s[1]; } else { p.ai.spot = { x: s[0], y: s[1] }; }
      p.checkSpot = { x: s[0], y: s[1] };
    });
    defT.players.forEach((p) => {
      const m = p.mark; const s = m.checkSpot || { x: m.x, y: m.y };
      const dx = RIM.x - s.x, dy = RIM.y - s.y, d = hyp(dx, dy) || 1;
      const gx = s.x + dx / d * 4, gy = s.y + dy / d * 4;
      if (instant) { p.x = gx; p.y = gy; }
      p.checkSpot = { x: gx, y: gy };
    });
    this.players.forEach((p) => {
      p.state = 'move'; p.st = 0; p.z = 0; p.vz = 0; p.fly = null; p.shot = null; p.trick = null; p.spin = 0; p.catchTarget = null; p.stunT = 0;
      if (instant) { p.vx = 0; p.vy = 0; }
      p.ai.holdT = 0; p.ai.intent = null;
    });
    this.giveBall(handler, true);
    this.ball.state = 'held';
    offT.pot = 0; offT.combo = 0; offT.lastTrick = null; this.teams[1 - off].pot = 0;
    this.hoop.shattered = false;
    // human control
    this.humans.forEach((h) => { h.player = h.team === off ? handler : this.teams[h.team].players.find((p) => p.mark === handler) || this.teams[h.team].players[0]; });
    this.syncHumans();
  };
  M.syncHumans = function () { this.players.forEach((p) => { p.human = null; }); this.humans.forEach((h) => { if (h.player) h.player.human = h; }); };

  M.giveBall = function (p, quiet) {
    const b = this.ball;
    b.state = 'held'; b.holder = p; b.flight = null; b.lastTeam = p.team; b.touched = new Set([p]);
    if (this.offense !== p.team) {
      // change of possession
      const old = this.teams[this.offense];
      if (old.crownActive) { old.crownActive = 0; this.emit('crownLost', { team: old.i }); }
      old.pot = 0; old.combo = 0; old.lastTrick = null;
      this.offense = p.team;
    }
    p.ai.holdT = 0;
    const h = this.teams[p.team].human;
    if (h) { h.player = p; this.syncHumans(); }
    // the other human takes the defender on the ball
    const oh = this.teams[1 - p.team].human;
    if (oh && !quiet) { const near = this.closestTo(this.teams[1 - p.team].players, p); if (near && oh.player && oh.player.state === 'move') { oh.player = near; this.syncHumans(); } }
    if (!quiet) this.sfx('catch', 0.6);
  };
  M.closestTo = function (list, o, exclude) {
    let best = null, bd = 1e9;
    list.forEach((p) => { if (p === exclude) return; const d = hyp(p.x - o.x, p.y - o.y); if (d < bd) { bd = d; best = p; } });
    return best;
  };

  // ---------- the main update ----------
  M.update = function (dt) {
    this.phaseT += dt;
    this.excite = Math.max(0.15, this.excite - dt * 0.25);
    if (this.hoop.shake > 0) this.hoop.shake = Math.max(0, this.hoop.shake - dt * 1.8);
    if (this.hoop.swish > 0) this.hoop.swish = Math.max(0, this.hoop.swish - dt * 1.5);
    if (this.hint > 0) this.hint -= dt;
    switch (this.phase) {
      case 'intro':
        if (this.phaseT > (this.attract ? 0.4 : 2.4)) { this.phase = 'check'; this.phaseT = 0; if (!this.attract) { this.call('force', { text: 'CHECK BALL', size: 64, color: '#ffffff', color2: this.teams[this.offense].colors.pri, life: 1.0 }); this.sfx('whistle', 0.7); } }
        this.animateIdle(dt); break;
      case 'check':
        this.walkToSpots(dt);
        if (this.phaseT > (this.attract ? 0.5 : 1.0)) { this.phase = 'live'; this.phaseT = 0; this.emit('live'); }
        break;
      case 'scored':
        this.updatePlayers(dt, true); this.updateBall(dt);
        if (this.phaseT > 2.0) {
          if (this.over) { this.phase = 'over'; this.phaseT = 0; this.finish(); }
          else { this.placeForCheck(this.nextOffense, false); this.phase = 'check'; this.phaseT = 0; }
        }
        break;
      case 'over':
        this.updatePlayers(dt, true); this.updateBall(dt);
        if (this.attract && this.phaseT > 2) { this.teams.forEach((t) => { t.score = 0; t.crown = 0; }); this.over = false; this.placeForCheck(Math.random() < 0.5 ? 0 : 1, true); this.phase = 'check'; this.phaseT = 0; }
        if (!this.attract && this.phaseT > 0.5 && Math.random() < 0.05) this.fx.preset('fireworks', 20, -40, 0);
        break;
      default:
        this.updateLive(dt);
    }
    this.updateAudio();
  };

  M.updateAudio = function () {
    if (this.attract || !BK.audio) return;
    BK.audio.crowd(0.06 + this.excite * 0.22);
    BK.audio.intensity(clamp(Math.max(this.teams[0].score, this.teams[1].score) / this.target, 0.3, 1));
  };

  M.animateIdle = function (dt) { this.players.forEach((p) => { p.st += dt; this.updatePose(p, dt); }); this.positionHeldBall(); };
  M.walkToSpots = function (dt) {
    this.players.forEach((p) => {
      const s = p.checkSpot; if (!s) return;
      const dx = s.x - p.x, dy = s.y - p.y, d = hyp(dx, dy);
      const sp = Math.min(d / dt, 22);
      if (d > 0.05) { p.vx = dx / d * sp; p.vy = dy / d * sp; } else { p.vx = 0; p.vy = 0; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.st += dt;
      if (p.team === this.offense) this.faceToward(p, RIM.x, RIM.y); else this.faceToward(p, p.mark.x, p.mark.y);
      p.state = 'move'; p.z = 0;
      this.updatePose(p, dt);
    });
    this.positionHeldBall();
  };

  M.updateLive = function (dt) {
    // humans first, then AI, then physics
    this.humans.forEach((h) => this.humanInput(h, dt));
    if (BK.AI) BK.AI.update(this, dt);
    this.updatePlayers(dt, false);
    this.separate();
    this.updateBall(dt);
    const holder = this.ball.state === 'held' ? this.ball.holder : null;
    if (holder) holder.ai.holdT += dt;
  };

  // ---------- human control ----------
  M.humanInput = function (h, dt) {
    const c = h.ctrl.state, hit = h.ctrl.hit, rel = h.ctrl.released;
    let p = h.player; if (!p) return;
    const b = this.ball;
    const team = this.teams[h.team];
    // stick -> world direction
    const w = this.cam.stickToWorld(c.x, c.y);
    const mag = hyp(c.x, c.y);
    p.wantTurbo = c.turbo;
    p.want = mag > 0.15 ? { x: w[0] / Math.max(0.0001, hyp(w[0], w[1])) * Math.min(1, mag), y: w[1] / Math.max(0.0001, hyp(w[0], w[1])) * Math.min(1, mag) } : { x: 0, y: 0 };
    const hasBall = b.state === 'held' && b.holder === p;
    const onOffense = this.offense === h.team && (b.state === 'held' || b.state === 'pass' || b.state === 'shot');
    if (hasBall) {
      if (p.state === 'move' || p.state === 'catch') {
        if (hit.crown) this.activateCrown(team, p);
        else if (hit.shoot) this.shootAction(p, { human: true, turbo: c.turbo });
        else if (hit.pass) { const t = this.pickPassTarget(p, w, mag); if (t) this.passTo(p, t); }
        else if (hit.oop) { this.oopAction(p, c.turbo, w, mag); }
        else if (hit.trick) this.startTrick(p, this.trickDir(p, w, mag), c.turbo);
      }
    } else if (onOffense) {
      // ball is in the air on our side: nothing to do but move (and jump for a miss)
      if (hit.shoot && p.state === 'move' && p.z === 0) this.jump(p, 'rebound');
    } else {
      // defense or loose ball
      if (hit.shoot && p.state === 'move' && p.z === 0 && p.cool.jump <= 0) this.jump(p, b.state === 'loose' ? 'rebound' : 'block');
      if (hit.trick && p.state === 'move') this.tryStealAction(p);
      if (hit.pass) {
        const target = b.state === 'held' && b.holder ? b.holder : b;
        const next = this.closestTo(team.players.filter((q) => q.state !== 'fallen'), target, p);
        if (next) { h.player = next; this.syncHumans(); this.sfx('click', 0.5); }
      }
    }
    // release a held jump shot
    if (p.state === 'shoot' && p.shot && !p.shot.released && p.shot.human) {
      if (rel.shoot || !c.shoot) this.releaseShot(p, false);
    }
    void dt;
  };

  M.trickDir = function (p, w, mag) {
    if (mag < 0.3) return 'none';
    const dx = RIM.x - p.x, dy = RIM.y - p.y, d = hyp(dx, dy) || 1;
    const nx = w[0] / (hyp(w[0], w[1]) || 1), ny = w[1] / (hyp(w[0], w[1]) || 1);
    const dot = (nx * dx + ny * dy) / d;
    return dot > 0.55 ? 'fwd' : dot < -0.55 ? 'back' : 'side';
  };

  M.pickPassTarget = function (p, w, mag) {
    const mates = p.mates.filter((q) => q.state !== 'fallen' && q.state !== 'stumble');
    if (!mates.length) return null;
    if (mag > 0.3) {
      let best = null, bs = -2;
      mates.forEach((q) => { const dx = q.x - p.x, dy = q.y - p.y, d = hyp(dx, dy) || 1; const s = (dx * w[0] + dy * w[1]) / d / (hyp(w[0], w[1]) || 1); if (s > bs) { bs = s; best = q; } });
      return best;
    }
    return mates.slice().sort((a, b) => this.openness(b) - this.openness(a))[0];
  };
  M.openness = function (q) { let m = 99; q.opps.forEach((o) => { m = Math.min(m, hyp(o.x - q.x, o.y - q.y)); }); return m; };

  // ---------- actions ----------
  M.dunkRange = function (p, turbo) {
    if (p.r.dnk < 2) return 0;
    let r = (3.4 + p.r.dnk * 0.78) * (turbo ? 1.35 : 1);
    if (p.fire) r *= 1.15;
    if (this.teams[p.team].crownActive) r *= 1.25;
    return r;
  };
  M.shootAction = function (p, o) {
    o = o || {};
    const d = distRim(p);
    const turbo = !!o.turbo && p.turbo > 0.08;
    const moving = hyp(p.vx, p.vy) > 4;
    const towards = ((RIM.x - p.x) * p.vx + (RIM.y - p.y) * p.vy) > 0;
    if (d < this.dunkRange(p, turbo) && (d < 6 || towards || !moving) && (p.r.dnk >= 3 || d < 4)) return this.startDunk(p, { turbo });
    if (d < 9.5) return this.startLayup(p);
    return this.startJumpShot(p, o);
  };

  M.jump = function (p, kind) {
    if (p.z > 0 || p.state !== 'move') return;
    p.state = kind === 'block' ? 'block' : 'jump'; p.st = 0;
    p.vz = p.jumpV * (kind === 'block' ? 1 : 0.95); p.z = 0.01;
    p.vx *= 0.6; p.vy *= 0.6; p.cool.jump = 0.35;
    p.blockChecked = new Set();
    this.sfx('squeak', 0.4);
  };

  M.startJumpShot = function (p, o) {
    p.state = 'shoot'; p.st = 0;
    p.vz = p.jumpV * 0.82; p.z = 0.01; p.vx *= 0.25; p.vy *= 0.25;
    const apex = p.vz / G_JUMP;
    p.shot = { released: false, human: !!o.human, apex, autoAt: null };
    if (!o.human) {
      const sk = this.teams[p.team].skill == null ? this.skill : this.teams[p.team].skill;
      const sigma = lerp(0.16, 0.05, clamp(sk * 0.6 + p.r.out * 0.04, 0, 1));
      p.shot.autoAt = clamp(apex + (Math.random() + Math.random() + Math.random() - 1.5) * sigma, apex * 0.55, apex + 0.22);
    }
    this.faceToward(p, RIM.x, RIM.y, true);
    this.emit('shotStart', { p });
    BK.AI && BK.AI.onShotStart(this, p);
  };

  M.releaseShot = function (p, forcedLate) {
    if (!p.shot || p.shot.released) return;
    const s = p.shot; s.released = true;
    let off = p.st - s.apex;
    let quality;
    if (s.human && p.st < 0.13 && !forcedLate) { quality = 'good'; off = 0; }
    else {
      const a = Math.abs(off);
      quality = a < 0.055 ? 'perfect' : a < 0.13 ? 'good' : off < 0 ? 'early' : 'late';
    }
    if (forcedLate) quality = 'late';
    s.quality = quality;
    if (s.human) {
      const txt = { perfect: 'PERFECT!', good: 'GOOD', early: 'EARLY', late: 'LATE' }[quality];
      const col = { perfect: '#3fd13f', good: '#ffffff', early: '#ffb300', late: '#ffb300' }[quality];
      this.fx.float(txt, p.x, p.y, p.z + p.hgtFt + 1.8, col);
    }
    // a defender already in the air in front of the ball gets a shot at it
    const bp = this.ball;
    const blocker = this.findBlocker(p, bp.x, bp.y, bp.z, 3.6);
    if (blocker && this.rollBlock(blocker, p, 'jumper')) return;
    const pct = this.shotChance(p, p.x, p.y, quality);
    this.launchShot(p, Math.random() < pct, 'jumper');
  };

  M.shotChance = function (p, x, y, quality) {
    const d = hyp(x - RIM.x, y - RIM.y); const deep = C.isDeep(x, y);
    let pct;
    if (d < 6) pct = 0.62 + p.r.ins * 0.032;
    else if (!deep) { const r = lerp(p.r.ins, p.r.out, clamp((d - 6) / 16, 0, 1)); pct = 0.33 + r * 0.036 - (d - 6) * 0.006; }
    else pct = 0.2 + p.r.out * 0.041 - (d - C.arcR) * 0.028;
    // contest
    let cd = 99, tall = 0;
    p.opps.forEach((o) => { const dd = hyp(o.x - x, o.y - y); if (dd < cd && o.state !== 'fallen' && o.state !== 'stumble') { cd = dd; tall = o.hgtFt - p.hgtFt; } });
    if (cd < 6) pct *= clamp(0.48 + cd * 0.085 - tall * 0.04, 0.35, 1);
    if (p.fire) pct += 0.12;
    if (this.teams[p.team].crownActive) pct += 0.1;
    pct += { perfect: 0.24, good: 0.05, early: -0.15, late: -0.2 }[quality] || 0;
    return clamp(pct, 0.03, 0.97);
  };

  M.launchShot = function (p, made, kind, o) {
    o = o || {};
    const b = this.ball;
    b.state = 'shot'; b.holder = null; b.lastTeam = p.team;
    const sx = b.x, sy = b.y, sz = b.z;
    const deep = C.isDeep(p.x, p.y) && kind === 'jumper';
    const quality = p.shot ? p.shot.quality : null;
    // Real rim and glass: find a release whose actual bounce ends the way the roll decided.
    const bankLook = kind === 'layup' ? Math.abs(p.y - RIM.y) > 1.5 && Math.random() < 0.6 : !deep && Math.abs(p.y) > 6 && Math.random() < 0.2;
    const plan = BK.ballPhysics && !o.slow ? BK.ballPhysics.planShot({ x: sx, y: sy, z: sz, sx: p.x, sy: p.y, made, kind, quality, bank: bankLook, out: p.r.out, hoop: this.hoop }) : null;
    if (plan) {
      b.flight = { plan, i: 0, t: 0, made, kind, deep, shooter: p, crown: this.teams[p.team].crownActive, quality, blockChecked: new Set(), blocked: false, bank: plan.bank, rims: 0 };
      p.stats.fga++;
      this.sfx('whoosh', 0.25);
      return;
    }
    let tx = RIM.x, ty = RIM.y, tz = C.rimZ + 0.25;
    let bank = false;
    if (!made) {
      const a = Math.atan2(sy - RIM.y, sx - RIM.x) + rand(-1.2, 1.2) + (Math.random() < 0.5 ? Math.PI : 0) * 0.7;
      tx = RIM.x + Math.cos(a) * C.rimR * 0.95; ty = RIM.y + Math.sin(a) * C.rimR * 0.95; tz = C.rimZ + 0.15;
    } else if (kind === 'layup' || (Math.abs(p.y) > 6 && Math.random() < 0.25 && !deep)) {
      bank = true;
    }
    const d = hyp(tx - sx, ty - sy);
    const T = kind === 'layup' ? 0.42 : 0.62 + d * 0.022 + (o.slow ? 0.25 : 0);
    const segs = [];
    if (bank && made) {
      const bx = C.boardX - 0.45, by = RIM.y + (sy - RIM.y) * 0.05, bz = C.rimZ + 1.6;
      const T1 = T * 0.78;
      segs.push(ballistic(sx, sy, sz, bx, by, bz, T1));
      segs.push(ballistic(bx, by, bz, RIM.x, RIM.y, C.rimZ + 0.2, 0.22));
    } else segs.push(ballistic(sx, sy, sz, tx, ty, tz, T));
    b.flight = { segs, i: 0, t: 0, made, kind, deep, shooter: p, crown: this.teams[p.team].crownActive, quality: p.shot ? p.shot.quality : null, blockChecked: new Set(), blocked: false, bank };
    p.stats.fga++;
    this.sfx('whoosh', 0.25);
  };
  function ballistic(sx, sy, sz, tx, ty, tz, T) {
    return { sx, sy, sz, vx: (tx - sx) / T, vy: (ty - sy) / T, vz: (tz - sz) / T + 0.5 * G_BALL * T, T, tx, ty, tz };
  }

  M.startLayup = function (p) {
    const dx = RIM.x - p.x, dy = RIM.y - p.y, d = hyp(dx, dy) || 1;
    const ex = RIM.x - dx / d * 2.6, ey = RIM.y - dy / d * 2.6;
    p.state = 'layup'; p.st = 0;
    p.fly = { sx: p.x, sy: p.y, ex, ey, ez: 2.4 + p.r.ins * 0.08, T: 0.62, t: 0, kind: 'layup', released: false };
    this.faceToward(p, RIM.x, RIM.y, true);
    this.emit('shotStart', { p });
    BK.AI && BK.AI.onShotStart(this, p);
  };

  M.pickDunk = function (p, turbo, crown) {
    const pd = p.data;
    let known;
    if (pd.unlockedDunks) known = pd.unlockedDunks.filter((k) => D.DUNKS[k]);
    else known = D.DUNK_ORDER.slice(0, clamp(Math.floor(p.r.dnk * 0.8), 2, 8));
    if (!known.length) known = ['twohand'];
    if (crown) return known.includes('eclipse') ? 'eclipse' : known[known.length - 1];
    const sig = pd.dunk && known.includes(pd.dunk) ? pd.dunk : null;
    if (turbo) { if (sig && Math.random() < 0.55) return sig; return pick(known.slice(-3)); }
    return pick(known.slice(0, Math.min(3, known.length)));
  };

  M.startDunk = function (p, o) {
    o = o || {};
    const team = this.teams[p.team];
    const style = o.style || this.pickDunk(p, o.turbo, team.crownActive);
    const dx = RIM.x - p.x, dy = RIM.y - p.y, d = hyp(dx, dy) || 1;
    const ex = RIM.x - dx / d * 1.25, ey = RIM.y - dy / d * 1.25;
    // high enough that the drawn hand meets the rim at the slam
    const ez = Math.max(0.8, C.rimZ + 0.35 - A.handReach(p.dims));
    const hang = D.DUNKS[style].hang;
    const T = 0.42 + d * 0.032 + hang * 0.42 + (team.crownActive ? 0.25 : 0);
    p.state = 'dunk'; p.st = 0; p.stats.fga++;
    p.fly = { sx: p.x, sy: p.y, ex, ey, ez, T, t: 0, kind: 'dunk', style, peak: 0.9 + hang * 1.3 + d * 0.06, slammed: false, dist: d, oop: !!o.oop, selfOop: !!o.selfOop };
    if (o.turbo) p.turbo = Math.max(0, p.turbo - 0.1);
    this.faceToward(p, RIM.x, RIM.y, true);
    this.sfx('whoosh', 0.6);
    if (d > 11 || style === 'eclipse' || style === 'legs' || style === 'spin360') { this.hype(0.7); this.sfx('crowdOoh', 0.4); }
    this.emit('shotStart', { p });
    BK.AI && BK.AI.onShotStart(this, p);
  };

  M.passTo = function (p, q, o) {
    o = o || {};
    const b = this.ball;
    const dist = hyp(q.x - p.x, q.y - p.y);
    const speed = 36 + p.r.pas * 2.6;
    const T = Math.max(0.16, dist / speed);
    const lead = Math.min(1, 0.8);
    let tx = q.x + q.vx * T * lead, ty = q.y + q.vy * T * lead;
    tx = clamp(tx, 1, 46); ty = clamp(ty, -24, 24);
    const tz = 4.3;
    b.state = 'pass'; b.holder = null;
    b.flight = { segs: [ballistic(b.x, b.y, b.z, tx, ty, tz + dist * 0.004, T)], i: 0, t: 0, passer: p, recv: q, kind: 'pass', checked: new Set(), afterTrick: this.teams[p.team].combo > 0 };
    q.catchTarget = { x: tx, y: ty, T };
    p.state = 'pass'; p.st = 0;
    this.faceToward(p, q.x, q.y, true);
    this.lastPasser = { p, t: this.time };
    p.cool.pass = 0.25;
    // control follows the ball
    const h = this.teams[p.team].human; if (h) { h.player = q; this.syncHumans(); }
    this.sfx('pass', 0.6);
    if (b.flight.afterTrick) this.addStyle(p, 60, null);
  };

  M.oopAction = function (p, turbo, w, mag) {
    const d = distRim(p);
    let best = null, bs = 0;
    p.mates.forEach((q) => {
      if (q.state !== 'move' || q.r.dnk < 3) return;
      const dq = distRim(q); if (dq > 26) return;
      let s = 30 - dq + this.openness(q) * 0.8;
      if (mag > 0.3) { const dx = q.x - p.x, dy = q.y - p.y, dd = hyp(dx, dy) || 1; s += ((dx * w[0] + dy * w[1]) / dd) * 6; }
      if (s > bs) { bs = s; best = q; }
    });
    if (turbo || !best) { if (d < 30 && p.r.dnk >= 2) return this.startSelfOop(p); if (best) return this.startOop(p, best); return this.passTo(p, this.pickPassTarget(p, w, mag)); }
    return this.startOop(p, best);
  };

  M.startOop = function (passer, q) {
    const b = this.ball;
    const dx = q.x - RIM.x, dy = q.y - RIM.y, d = hyp(dx, dy) || 1;
    const cx = RIM.x + dx / d * 1.35, cy = RIM.y + dy / d * 1.35, cz = C.rimZ + 1.5;
    const T = clamp(hyp(cx - passer.x, cy - passer.y) / 32 + 0.6, 0.85, 1.45);
    if (hyp(cx - q.x, cy - q.y) / T > 34) return this.passTo(passer, q);
    b.state = 'pass'; b.holder = null;
    b.flight = { segs: [ballistic(b.x, b.y, b.z, cx, cy, cz, T)], i: 0, t: 0, passer, recv: q, kind: 'oop', checked: new Set() };
    passer.state = 'pass'; passer.st = 0; this.faceToward(passer, cx, cy, true);
    this.beginOopFlight(q, cx, cy, T, false);
    this.lastPasser = { p: passer, t: this.time };
    const h = this.teams[passer.team].human; if (h) { h.player = q; this.syncHumans(); }
    this.sfx('pass', 0.7); this.hype(0.5);
    BK.AI && BK.AI.onShotStart(this, q);
  };
  M.startSelfOop = function (p) {
    const b = this.ball;
    const bx = C.boardX - 0.25, by = clamp(p.y * 0.08, -1.5, 1.5), bz = 12.1;
    const dx = p.x - RIM.x, dy = p.y - RIM.y, d = hyp(dx, dy) || 1;
    const cx = RIM.x + dx / d * 1.35, cy = RIM.y + dy / d * 1.35, cz = C.rimZ + 1.5;
    const T1 = clamp(hyp(bx - b.x, by - b.y) / 36 + 0.25, 0.35, 0.95), T2 = 0.42;
    b.state = 'pass'; b.holder = null;
    b.flight = { segs: [ballistic(b.x, b.y, b.z, bx, by, bz, T1), ballistic(bx, by, bz, cx, cy, cz, T2)], i: 0, t: 0, passer: p, recv: p, kind: 'oop', self: true, checked: new Set() };
    this.beginOopFlight(p, cx, cy, T1 + T2, true);
    this.sfx('pass', 0.7); this.hype(0.6);
    BK.AI && BK.AI.onShotStart(this, p);
  };
  M.beginOopFlight = function (q, cx, cy, T, self) {
    const style = this.pickDunk(q, true, this.teams[q.team].crownActive);
    q.state = 'oop'; q.st = 0; q.stats.fga++;
    const ez = Math.max(1.2, C.rimZ + 1.1 - A.handReach(q.dims));
    q.fly = { sx: q.x, sy: q.y, ex: cx, ey: cy, ez, T, t: 0, kind: 'oop', style, self, caught: false };
    this.faceToward(q, RIM.x, RIM.y, true);
  };

  M.startTrick = function (p, dir, turbo) {
    if (p.cool.trick > 0) return;
    const opts = D.TRICK_BY_DIR[dir] || D.TRICK_BY_DIR.none;
    let flashy = turbo && p.turbo > 0.12;
    let key = flashy ? opts[1] : opts[0];
    let target = null;
    if (key === 'dome') {
      target = this.nearestDefender(p, 5);
      if (!target || target.state !== 'move') key = 'juggle';
    }
    const tr = D.TRICKS[key];
    if (flashy) p.turbo = Math.max(0, p.turbo - 0.14);
    p.state = 'trick'; p.st = 0;
    const sp = tr.move ? tr.move : 2.5;
    let mx = p.vx, my = p.vy; const m = hyp(mx, my);
    if (m > 0.5) { mx = mx / m * sp; my = my / m * sp; } else { mx = 0; my = 0; }
    if (tr.move && dir === 'fwd') { const dx = RIM.x - p.x, dy = RIM.y - p.y, d = hyp(dx, dy) || 1; mx = dx / d * sp; my = dy / d * sp; }
    p.trick = { key, tr, flashy, beatDone: false, target, mx, my, spinDir: this.cam.screenDX(mx, my) >= 0 ? 1 : -1 };
    p.cool.trick = tr.dur + 0.08;
    p.stats.tricks++;
    this.sfx('trick', 0.7);
    if (flashy) this.sfx('crowdOoh', 0.18);
  };

  M.nearestDefender = function (p, within) {
    let best = null, bd = within;
    p.opps.forEach((o) => { const d = hyp(o.x - p.x, o.y - p.y); if (d < bd && o.state !== 'fallen') { bd = d; best = o; } });
    return best;
  };

  M.resolveTrick = function (p) {
    const tr = p.trick; tr.beatDone = true;
    const team = this.teams[p.team];
    const repeat = team.lastTrick === tr.key;
    team.lastTrick = tr.key;
    if (!repeat) team.combo++;
    const mult = repeat ? 0.3 : 1 + Math.min(team.combo - 1, 5) * 0.15;
    let pts = Math.round(tr.tr.pts * mult);
    let label = tr.tr.name;
    // who is close enough to get shaken?
    const def = tr.target || this.nearestDefender(p, tr.flashy ? 6.5 : 5);
    if (def && def.state === 'move' && def.z === 0 && !repeat) {
      const chance = clamp(tr.tr.beat * 0.8 + (p.r.hnd - def.r.stl * 0.75) * 0.03 + (tr.flashy ? 0.06 : 0) - this.defSkill(def) * 0.12, 0.04, 0.8);
      if (Math.random() < chance) {
        const broke = Math.random() < chance * (tr.flashy ? 0.4 : 0.18);
        if (broke) {
          def.state = 'fallen'; def.st = 0; def.stunT = 1.7 + (p.r.hnd - def.r.spd) * 0.05; def.vx = 0; def.vy = 0;
          pts += 450; p.stats.ankles++; label = 'ANKLES';
          this.call('ankles', { color: '#ffe14d', color2: team.colors.pri, size: 78 });
          this.fx.preset('ankles', def.x, def.y, 0); this.sfx('scratch', 0.8); this.sfx('crowdRoar', 0.6); this.hype(1);
          this.emit('ankles', { p, def });
        } else {
          def.state = 'stumble'; def.st = 0; def.stunT = 0.75 + p.r.hnd * 0.03;
          pts += 180;
          this.sfx('crowdOoh', 0.35); this.hype(0.55);
          this.fx.burst(def.x, def.y, 0.3, 8, { kind: 'dust', color: '#cfc7b8', speed: 5, upMax: 0.4, life: 0.8, size: 0.6, g: 1 });
        }
      }
    }
    this.addStyle(p, pts, label);
  };
  M.defSkill = function (p) { const t = this.teams[p.team]; return t.human ? 0.5 : (t.skill == null ? this.skill : t.skill); };

  M.addStyle = function (p, pts, label) {
    const team = this.teams[p.team];
    team.pot += pts; p.stats.style += pts;
    if (label) this.fx.float('+' + pts + ' ' + label, p.x, p.y, p.z + p.hgtFt + 1.2, team.combo > 2 ? '#ffd23f' : '#ffffff');
    this.emit('style', { team: team.i, pts });
  };
  M.bankStyle = function (team, extra) {
    const before = team.crown;
    const total = team.pot + (extra || 0);
    team.crown = Math.min(2, team.crown + total / CROWN_PTS);
    team.pot = 0; team.combo = 0; team.lastTrick = null;
    if (Math.floor(team.crown) > Math.floor(before)) {
      this.emit('crownReady', { team: team.i, level: Math.floor(team.crown) });
      if (!this.attract) { this.fx.call(Math.floor(team.crown) === 2 ? 'DOUBLE CROWN READY' : 'CROWN READY', { size: 46, color: '#ffd23f', color2: team.colors.pri, y: H * 0.22, life: 1.6 }); this.sfx('charge', 0.7); }
    }
  };

  M.activateCrown = function (team, p) {
    if (team.crown < 1 || team.crownActive || this.offense !== team.i) return false;
    team.crownActive = Math.floor(team.crown);
    team.crown = 0;
    this.fx.preset('crownOn', p.x, p.y, 0, { color: team.colors.pri });
    this.call('force', { text: team.crownActive === 2 ? 'DOUBLE CROWN!' : 'CROWN TIME!', size: 84, color: '#ffd23f', color2: team.colors.pri, life: 1.5 });
    this.sfx('boom', 0.9); this.sfx('airhorn', 0.55); this.hype(1);
    if (BK.audio && !this.attract) BK.audio.music('crown');
    this.emit('crownOn', { team: team.i });
    return true;
  };

  M.tryStealAction = function (p) {
    if (p.cool.steal > 0 || p.state !== 'move') return;
    p.state = 'steal'; p.st = 0; p.cool.steal = 0.75;
    const b = this.ball;
    if (b.state !== 'held' || !b.holder || b.holder.team === p.team) return;
    const h = b.holder;
    const d = hyp(h.x - p.x, h.y - p.y);
    this.faceToward(p, h.x, h.y, true);
    if (d > 4.2 || ['shoot', 'dunk', 'layup', 'oop'].includes(h.state)) return;
    let chance = 0.1 + p.r.stl * 0.032 - h.r.hnd * 0.019 + (4.2 - d) * 0.03;
    if (h.state === 'trick') chance *= 0.45;
    if (h.state === 'catch') chance += 0.08;
    if (Math.random() < clamp(chance, 0.02, 0.6)) this.doSteal(p, h);
    else this.sfx('steal', 0.25);
  };
  M.doSteal = function (p, h) {
    const lostPot = this.teams[h.team].pot;
    p.stats.stl++;
    const team = this.teams[p.team];
    this.fx.preset('steal', h.x, h.y, 3);
    this.call('steal', { color: '#3fd13f', color2: team.colors.pri, size: 70 });
    this.sfx('steal', 1); this.sfx('crowdOoh', 0.5); this.hype(0.8);
    team.crown = Math.min(2, team.crown + (200 + lostPot * 0.25) / CROWN_PTS);
    if (h.state === 'trick') { h.state = 'move'; h.trick = null; }
    if (Math.random() < 0.6) this.giveBall(p);
    else { const b = this.ball; b.state = 'loose'; b.holder = null; b.vx = (p.x - h.x) * 2 + rand(-3, 3); b.vy = (p.y - h.y) * 2 + rand(-3, 3); b.vz = 6; b.lastTeam = p.team; this.offense = p.team; this.teams[h.team].pot = 0; this.teams[h.team].combo = 0; if (this.teams[h.team].crownActive) this.teams[h.team].crownActive = 0; this.resumeMusic(); }
    this.emit('steal', { p, h });
  };

  M.findBlocker = function (shooter, x, y, z, radius) {
    let best = null, bd = radius;
    shooter.opps.forEach((o) => {
      if (o.state !== 'block' && o.state !== 'jump') return;
      if (o.z < 0.6) return;
      const hand = o.z + o.reach + 0.4;
      if (hand < z - 0.9) return;
      const d = hyp(o.x - x, o.y - y);
      if (d < bd) { bd = d; best = o; }
    });
    return best;
  };
  M.rollBlock = function (o, shooter, kind) {
    if (o.blockChecked && o.blockChecked.has(shooter)) return false;
    if (o.blockChecked) o.blockChecked.add(shooter);
    let chance = 0.04 + o.r.blk * 0.03 + (o.hgtFt - shooter.hgtFt) * 0.22;
    if (kind === 'dunk') chance = 0.06 + o.r.blk * 0.042 + (o.hgtFt - shooter.hgtFt) * 0.35 - shooter.r.dnk * 0.018;
    if (kind === 'layup') chance -= 0.05;
    if (this.teams[shooter.team].crownActive) chance *= 0.5;
    if (shooter.fire) chance *= 0.7;
    if (Math.random() >= clamp(chance, 0.03, 0.75)) return false;
    this.doBlock(o, shooter, kind);
    return true;
  };
  M.doBlock = function (o, shooter, kind) {
    const b = this.ball;
    b.state = 'loose'; b.holder = null; b.flight = null;
    const ax = b.x - RIM.x, ay = b.y - RIM.y, ad = hyp(ax, ay) || 1;
    b.vx = ax / ad * rand(16, 26); b.vy = ay / ad * rand(10, 18) + rand(-6, 6); b.vz = rand(4, 11);
    b.lastTeam = o.team; b.blockedBy = o;
    o.stats.blk++; o.swat = 1;
    const team = this.teams[o.team];
    team.crown = Math.min(2, team.crown + 300 / CROWN_PTS);
    const st = this.teams[shooter.team];
    st.pot = 0; st.combo = 0; if (st.crownActive) { st.crownActive = 0; this.resumeMusic(); }
    if (shooter.state === 'dunk' || shooter.state === 'oop' || shooter.state === 'layup') {
      shooter.state = 'stumble'; shooter.st = 0; shooter.stunT = 0.6; shooter.fly = null;
    }
    shooter.streak = 0;
    this.fx.preset('block', b.x, b.y, b.z);
    this.call('block', { color: '#2ec5ff', color2: team.colors.pri, size: 84, style: 'slam' });
    this.sfx('block', 1); this.sfx('crowdRoar', 0.7); this.hype(1);
    this.emit('block', { o, shooter, kind });
  };

  // ---------- scoring ----------
  M.pointsFor = function (kind, deep) {
    const base = deep ? 2 : 1;
    switch (this.rule) {
      case 'deep': return deep ? 2 : kind === 'dunk' ? 1 : 0;
      case 'dunks': return kind === 'dunk' || kind === 'layup' ? 2 : 0;
      default: return base;
    }
  };
  M.scoreBasket = function (shooter, kind, deep, extra) {
    extra = extra || {};
    const team = this.teams[shooter.team], opp = this.teams[1 - shooter.team];
    let pts = this.pointsFor(kind, deep);
    let stolen = 0;
    const crown = team.crownActive;
    if (crown) {
      const mult = this.rule === 'crowns' ? 2 : 1;
      pts = (pts + crown) * mult; stolen = Math.min(opp.score, crown * mult);
      opp.score -= stolen;
    }
    team.score += pts;
    shooter.stats.pts += pts; shooter.stats.fgm++;
    if (kind === 'dunk') shooter.stats.dnk++;
    if (extra.oop) shooter.stats.oops++;
    if (this.lastPasser && this.lastPasser.p !== shooter && this.lastPasser.p.team === shooter.team && this.time - this.lastPasser.t < 4) this.lastPasser.p.stats.ast++;
    this.lastPasser = null;
    // style bank: the shot itself adds a little
    let shotStyle = kind === 'dunk' ? (D.DUNKS[extra.style] ? D.DUNKS[extra.style].style : 120) + Math.round((extra.dist || 0) * 12) : deep ? 150 : 60;
    if (extra.oop) shotStyle += extra.self ? 500 : 350;
    if (extra.quality === 'perfect') shotStyle += 100;
    if (!crown) this.bankStyle(team, shotStyle); else { team.pot = 0; team.combo = 0; }
    // streaks
    shooter.streak++;
    opp.players.forEach((q) => { q.streak = 0; if (q.fire) { q.fire = false; } });
    const wasFire = shooter.fire;
    if (shooter.streak >= 3 && !shooter.fire) { shooter.fire = true; }
    // effects
    const rimx = RIM.x, rimy = RIM.y, rimz = C.rimZ;
    this.hoop.swish = 1;
    if (crown) {
      this.fx.preset('crownMade', rimx, rimy, rimz);
      this.fx.call(crown === 2 ? 'DOUBLE CROWN!' : pick(D.CALLS.crown), { size: 92, color: '#ffd23f', color2: team.colors.pri, style: 'slam', life: 2.0, sub: stolen ? `+${pts}  ·  ${opp.name.toUpperCase()} −${stolen}` : null });
      this.sfx('airhorn', 0.9); this.sfx('crowdRoar', 1); this.sfx('boom', 0.8);
      if (kind === 'dunk') { this.hoop.shattered = true; this.fx.preset('shatter', C.boardX, 0, 11); this.sfx('glass', 1); }
      team.crownActive = 0; this.resumeMusic();
    } else if (kind === 'dunk') {
      const big = (D.DUNKS[extra.style] && D.DUNKS[extra.style].style >= 300) || extra.dist > 11 || extra.oop;
      this.fx.preset(big ? 'bigdunk' : 'dunk', shooter.x, shooter.y, rimz, { color: team.colors.pri });
      if (extra.oop) this.call(extra.self ? 'selfoop' : 'oop', { color: '#ff3ea5', color2: team.colors.pri, size: 86, style: 'slam' });
      else this.call(big ? 'bigdunk' : 'dunk', { color: '#ffd23f', color2: team.colors.pri, size: big ? 92 : 80, style: 'slam' });
      this.sfx('dunk', 1); this.sfx('crowdRoar', big ? 1 : 0.7);
      this.hoop.shake = 1;
    } else if (deep) {
      this.fx.preset('deep', rimx, rimy, rimz, { color: team.colors.pri });
      this.call('deep', { color: '#2ec5ff', color2: team.colors.pri, size: 78 });
      this.sfx('swish', 1); this.sfx('crowdRoar', 0.6);
    } else {
      this.fx.preset('swish', rimx, rimy, rimz);
      if (kind === 'layup' && Math.random() < 0.5) this.call('layup', { color: '#ffffff', color2: team.colors.pri, size: 56 });
      this.sfx('swish', 0.9); this.sfx('crowdOoh', 0.25);
    }
    if (extra.bank) this.sfx('board', 0.6);
    if (shooter.fire && !wasFire) {
      this.fx.call(pick(D.CALLS.fire), { size: 62, color: '#ff6a13', color2: '#ffd23f', y: H * 0.5, life: 1.4 });
      this.fx.preset('fire', shooter.x, shooter.y, shooter.hgtFt * 0.6); this.sfx('fire', 0.8);
    }
    this.fx.float(pts > 0 ? '+' + pts : 'NO COUNT', rimx, rimy, rimz + 2.5, pts > 0 ? team.colors.pri === '#ffffff' ? '#ffd23f' : '#ffffff' : '#ff6a13');
    this.hype(kind === 'dunk' || deep || crown ? 1 : 0.6);
    shooter.celebrate = kind === 'dunk' || deep || crown || shooter.fire || Math.random() < 0.3;
    this.emit('score', { team: team.i, pts, kind, deep, crown, stolen, shooter });
    // possession
    this.nextOffense = 1 - team.i;
    this.phase = 'scored'; this.phaseT = 0;
    if (team.score >= this.target) {
      this.over = true;
      this.fx.call('GAME!', { size: 120, color: '#ffffff', color2: team.colors.pri, style: 'slam', life: 2.4, y: H * 0.64 });
      this.fx.slowmo(0.3, 1.2); this.sfx('buzzer', 0.8);
    } else if (team.score >= this.target - (this.target >= 15 ? 2 : 1) && !this.attract) {
      this.fx.call('GAME POINT', { size: 40, color: '#ffffff', color2: team.colors.pri, y: H * 0.18, life: 1.6 });
    }
  };
  M.resumeMusic = function () { if (BK.audio && !this.attract) BK.audio.music('game'); };

  M.missed = function (shooter) {
    const team = this.teams[shooter.team];
    team.pot = 0; team.combo = 0; team.lastTrick = null;
    shooter.streak = 0;
    if (team.crownActive) { team.crownActive = 0; this.resumeMusic(); this.emit('crownLost', { team: team.i }); }
  };

  M.finish = function () {
    const w = this.teams[0].score > this.teams[1].score ? 0 : 1;
    this.teams[w].players.forEach((p) => { p.celebrate = true; p.state = 'celebrate'; });
    const result = {
      winner: w, score: [this.teams[0].score, this.teams[1].score],
      players: this.players.map((p) => ({ id: p.data.id, team: p.team, name: p.data.nick || p.data.first, stats: Object.assign({}, p.stats) })),
    };
    let mvp = null, best = -1;
    this.players.forEach((p) => { const v = p.stats.pts * 3 + p.stats.blk * 2 + p.stats.stl * 2 + p.stats.ast * 2 + p.stats.ankles * 2 + p.stats.style / 300 + (p.team === w ? 4 : 0); if (v > best) { best = v; mvp = p; } });
    result.mvp = mvp ? { id: mvp.data.id, team: mvp.team, name: mvp.data.nick || mvp.data.first } : null;
    this.result = result;
    if (!this.attract && this.opts.onEnd) setTimeout(() => { if (this.running) this.opts.onEnd(result); }, 2600);
  };

  // ---------- per-player physics and state ----------
  // Facing only flips after a short pause, so a defender shadowing the ball doesn't flicker side to
  // side. Deliberate actions (shots, passes, catches) turn right away. The body's visible turn is
  // eased separately in updatePose.
  M.setFacing = function (p, dir, force) {
    if (dir === p.facing) return;
    if (!force && this.time - (p.faceAt == null ? -9 : p.faceAt) < 0.22) return;
    p.facing = dir; p.faceAt = this.time;
  };
  M.faceToward = function (p, x, y, force) { const sd = this.cam.screenDX(x - p.x, y - p.y); if (Math.abs(sd) > (force ? 0.3 : 0.9)) this.setFacing(p, sd > 0 ? 1 : -1, force); };

  M.updatePlayers = function (dt, deadBall) {
    for (const p of this.players) {
      p.st += dt;
      for (const k in p.cool) if (p.cool[k] > 0) p.cool[k] -= dt;
      if (p.swat) p.swat = Math.max(0, p.swat - dt * 4);
      // turbo
      const moving = hyp(p.vx, p.vy) > 3;
      const useTurbo = p.wantTurbo && p.turbo > 0.03 && moving;
      p.turboOn = useTurbo;
      if (useTurbo) p.turbo = Math.max(0, p.turbo - dt * (0.42 - p.r.spd * 0.015));
      else p.turbo = Math.min(1, p.turbo + dt * (0.17 + p.r.spd * 0.012));
      switch (p.state) {
        case 'move': case 'catch': case 'pass': case 'steal': case 'celebrate': this.moveOnGround(p, dt, deadBall); break;
        case 'trick': this.updateTrick(p, dt); break;
        case 'shoot': this.updateJumpShot(p, dt); break;
        case 'layup': case 'dunk': case 'oop': this.updateFly(p, dt); break;
        case 'hang': this.updateHang(p, dt); break;
        case 'block': case 'jump': case 'fall': this.updateAir(p, dt); break;
        case 'stumble': case 'fallen': {
          p.vx *= Math.pow(0.02, dt); p.vy *= Math.pow(0.02, dt); p.x += p.vx * dt; p.y += p.vy * dt;
          p.stunT -= dt; if (p.stunT <= 0) { p.state = 'move'; p.st = 0; }
          break;
        }
        default: this.moveOnGround(p, dt, deadBall);
      }
      if (p.state === 'catch' && p.st > 0.14) { p.state = 'move'; p.st = 0; }
      if (p.state === 'pass' && p.st > 0.28) { p.state = 'move'; p.st = 0; }
      if (p.state === 'steal' && p.st > 0.34) { p.state = 'move'; p.st = 0; }
      if (p.state === 'celebrate' && this.phase !== 'over' && p.st > 1.6) { p.state = 'move'; p.st = 0; }
      // keep in bounds
      p.x = clamp(p.x, 0.8, 46.4); p.y = clamp(p.y, -24.3, 24.3);
      // fire / aura particles
      this.playerParticles(p, dt);
      this.updatePose(p, dt);
    }
    this.positionHeldBall();
  };

  M.moveOnGround = function (p, dt, deadBall) {
    let want = p.want || { x: 0, y: 0 };
    if (deadBall) {
      // after a basket everybody drifts toward their next spot
      want = { x: 0, y: 0 };
      if (p.celebrate && p.state !== 'celebrate' && this.phaseT < 0.3 && p.z === 0) { p.state = 'celebrate'; p.st = 0; p.celebrate = false; }
      if (p.state !== 'celebrate') {
        const s = this.phase === 'over' ? null : this.restSpot(p);
        if (s) { const dx = s.x - p.x, dy = s.y - p.y, d = hyp(dx, dy); if (d > 1) want = { x: dx / d * 0.5, y: dy / d * 0.5 }; }
      }
    }
    if (p.catchTarget && this.ball.state === 'pass' && this.ball.flight && this.ball.flight.recv === p) {
      const dx = p.catchTarget.x - p.x, dy = p.catchTarget.y - p.y, d = hyp(dx, dy);
      want = d > 0.4 ? { x: dx / d, y: dy / d } : { x: 0, y: 0 };
    }
    let top = p.speed * (p.turboOn ? 1.32 : 1) * (this.ball.holder === p ? 0.94 : 1) * (p.fire ? 1.05 : 1);
    if (p.state === 'steal') top *= 0.4;
    if (p.state === 'celebrate') top = 0;
    const tx = want.x * top, ty = want.y * top;
    const acc = (p.turboOn ? 95 : 70) * dt;
    const dvx = tx - p.vx, dvy = ty - p.vy, dv = hyp(dvx, dvy);
    if (dv > acc) { p.vx += dvx / dv * acc; p.vy += dvy / dv * acc; } else { p.vx = tx; p.vy = ty; }
    // sharp cut squeak
    if (dv > 20 && hyp(p.vx, p.vy) > 10 && Math.random() < 0.04) this.sfx('squeak', 0.25);
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.z > 0) { p.vz -= G_JUMP * dt; p.z += p.vz * dt; if (p.z <= 0) { p.z = 0; p.vz = 0; } }
    const sp = hyp(p.vx, p.vy);
    if (sp > 2.5) {
      const sd = this.cam.screenDX(p.vx, p.vy);
      const defending = this.offense !== p.team && this.ball.state === 'held' && this.phase === 'live';
      // a defender keeps his eyes on the ball while shuffling, but turns and runs to cover real ground
      if (defending && sp < p.speed * 0.74) this.faceToward(p, this.ball.x, this.ball.y);
      else if (Math.abs(sd) > 1.5) this.setFacing(p, sd > 0 ? 1 : -1);
    } else if (this.phase === 'live') {
      if (this.ball.holder === p) this.faceToward(p, RIM.x, RIM.y); else this.faceToward(p, this.ball.x, this.ball.y);
    }
  };
  M.restSpot = function (p) {
    const next = this.nextOffense;
    if (next == null) return null;
    if (p.team === next) { const i = this.teams[p.team].players.indexOf(p); return [{ x: 19, y: 0 }, { x: 27, y: -15 }, { x: 29, y: 15 }][i]; }
    const m = p.mark; const i = this.teams[m.team].players.indexOf(m); const s = [{ x: 19, y: 0 }, { x: 27, y: -15 }, { x: 29, y: 15 }][i];
    return { x: s.x + 3.5, y: s.y * 0.85 };
  };

  M.updateTrick = function (p, dt) {
    const tr = p.trick; if (!tr) { p.state = 'move'; return; }
    const k = p.st / tr.tr.dur;
    p.x += tr.mx * dt; p.y += tr.my * dt; p.vx = tr.mx; p.vy = tr.my;
    if (tr.key === 'spin') p.spin = k * Math.PI * 2 * tr.spinDir;
    else if (tr.key === 'tornado') p.spin = k * Math.PI * 4 * tr.spinDir;
    else p.spin = 0;
    if (!tr.beatDone && k > 0.45) this.resolveTrick(p);
    if (tr.key === 'head' && Math.abs(k - 0.5) < dt / tr.tr.dur) this.sfx('dribble', 0.6);
    if (tr.key === 'dome' && Math.abs(k - 0.45) < dt / tr.tr.dur && tr.target) { this.sfx('dribble', 0.8); this.fx.burst(tr.target.x, tr.target.y, tr.target.hgtFt + 0.5, 10, { kind: 'star', color: '#ffe14d', speed: 5, life: 0.8, size: 0.4, g: 3 }); }
    if (k >= 1) { p.state = 'move'; p.st = 0; p.spin = 0; p.trick = null; }
  };

  M.updateJumpShot = function (p, dt) {
    p.vz -= G_JUMP * dt; p.z += p.vz * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    const s = p.shot;
    if (s && !s.released) {
      if (s.autoAt != null && p.st >= s.autoAt) this.releaseShot(p, false);
      else if (s.human && p.st > s.apex + 0.24) this.releaseShot(p, true);
    }
    if (p.z <= 0) { p.z = 0; p.vz = 0; p.state = 'move'; p.st = 0; p.shot = null; }
  };

  M.updateFly = function (p, dt) {
    const f = p.fly; if (!f) { p.state = 'move'; return; }
    f.t += dt;
    const u = f.t / f.T;
    if (f.kind === 'layup') {
      const k = clamp(u, 0, 1);
      p.x = lerp(f.sx, f.ex, 1 - Math.pow(1 - k, 2)); p.y = lerp(f.sy, f.ey, 1 - Math.pow(1 - k, 2));
      p.z = Math.sin(Math.PI * k) * f.ez;
      if (!f.released && k > 0.48) {
        f.released = true;
        const b = this.ball;
        const blocker = this.findBlocker(p, b.x, b.y, b.z, 3.6);
        if (blocker && this.rollBlock(blocker, p, 'layup')) { p.fly = null; return; }
        const pct = this.shotChance(p, p.x, p.y, 'good') - 0.04;
        p.shot = { quality: 'good' };
        this.launchShot(p, Math.random() < pct, 'layup');
        p.shot = null;
      }
      if (k >= 1) { p.z = 0; p.state = 'move'; p.st = 0; p.fly = null; }
      return;
    }
    // dunks and alley-oops
    const slamAt = f.kind === 'oop' ? 1 : 0.78;
    const k = clamp(u / slamAt, 0, 1);
    if (f.kind === 'oop') {
      // run in, then take off for the last 0.55 s
      const tLeft = f.T - f.t;
      const runK = clamp(f.t / f.T, 0, 1);
      p.x = lerp(f.sx, f.ex, Math.pow(runK, 0.85)); p.y = lerp(f.sy, f.ey, Math.pow(runK, 0.85));
      p.z = tLeft < 0.55 ? f.ez * Math.sin((1 - tLeft / 0.55) * Math.PI / 2) + Math.sin((1 - tLeft / 0.55) * Math.PI) * 0.8 : 0;
      p.vx = (f.ex - f.sx) / f.T; p.vy = (f.ey - f.sy) / f.T;
      if (f.t >= f.T && !f.caught) {
        f.caught = true;
        // convert into a short slam
        const b = this.ball;
        b.state = 'held'; b.holder = p; b.flight = null; b.lastTeam = p.team;
        p.state = 'dunk'; p.st = 0;
        p.fly = { sx: p.x, sy: p.y, ex: f.ex, ey: f.ey, ez: p.z, T: 0.32, t: 0.32 * 0.6, kind: 'dunk', style: f.style, peak: 0, slammed: false, dist: 8, oop: true, selfOop: f.self };
        if (f.self) { this.sfx('board', 0.8); }
      }
      return;
    }
    p.x = lerp(f.sx, f.ex, 1 - Math.pow(1 - k, 2)); p.y = lerp(f.sy, f.ey, 1 - Math.pow(1 - k, 2));
    p.z = f.oop ? f.ez : u <= slamAt ? f.ez * Math.pow(k, 0.65) + f.peak * Math.sin(Math.PI * k) : f.ez;
    if (f.style === 'spin360') p.spin = k * Math.PI * 2;
    else if (f.style === 'eclipse') p.spin = k * Math.PI * 4;
    else if (f.style === 'reverse') p.spin = k > 0.5 ? Math.PI : 0;
    // let defenders near the rim try to meet it
    if (!f.slammed && u > slamAt - 0.26 && u < slamAt) {
      const b = this.ball;
      const blocker = this.findBlocker(p, b.x, b.y, b.z, 4.0);
      if (blocker && this.rollBlock(blocker, p, 'dunk')) { p.fly = null; return; }
    }
    if (!f.slammed && u >= slamAt) {
      f.slammed = true; p.spin = 0;
      // a big standing at the rim can make it rattle out, even without leaving the floor
      let guard = null, gd = 4.2;
      p.opps.forEach((o) => { if (o.state === 'fallen' || o.state === 'stumble') return; const dd = hyp(o.x - p.x, o.y - p.y); if (dd < gd) { gd = dd; guard = o; } });
      if (guard) {
        let miss = clamp(0.1 + guard.r.blk * 0.03 + (guard.hgtFt - p.hgtFt) * 0.12 - p.r.dnk * 0.024 + (f.oop ? 0.04 : 0) - (4.2 - gd) * -0.02, 0.03, 0.38);
        if (this.teams[p.team].crownActive) miss *= 0.4;
        if (p.fire) miss *= 0.6;
        if (Math.random() < miss) { this.rimOut(p, guard); return; }
      }
      this.scoreBasket(p, 'dunk', false, { style: f.style, dist: f.dist, oop: f.oop, self: f.selfOop });
      const b = this.ball; b.state = 'dead'; b.holder = null; b.x = RIM.x; b.y = RIM.y; b.z = C.rimZ - 0.3; b.vx = 0; b.vy = 0; b.vz = -14;
      p.state = 'hang'; p.st = 0; p.hangX = p.x; p.hangY = p.y; p.hangZ = p.z;
    }
  };
  M.rimOut = function (p, guard) {
    const b = this.ball;
    b.state = 'loose'; b.holder = null; b.flight = null; b.x = RIM.x; b.y = RIM.y; b.z = C.rimZ + 0.3; b.lastTeam = p.team;
    const ax = p.x - RIM.x, ay = p.y - RIM.y, ad = hyp(ax, ay) || 1;
    b.vx = ax / ad * rand(7, 12); b.vy = ay / ad * rand(5, 9) + rand(-3, 3); b.vz = rand(10, 14);
    this.hoop.shake = 1;
    this.sfx('rim', 1); this.sfx('crowdOoh', 0.6); this.hype(0.7);
    this.fx.call('RIMMED OUT!', { size: 66, color: '#ff6a13', color2: this.teams[guard.team].colors.pri });
    this.fx.burst(RIM.x, RIM.y, C.rimZ, 18, { color: ['#ffb300', '#ffffff'], speed: 10, life: 0.5, size: 0.2 });
    this.fx.shake(8, 0.3);
    this.missed(p);
    p.state = 'fall'; p.st = 0; p.vz = 2; p.fly = null; p.vx = ax / ad * 4; p.vy = 0;
    this.emit('miss', { p, rimOut: true });
  };
  M.updateHang = function (p, dt) {
    p.x = p.hangX; p.y = p.hangY; p.z = p.hangZ - Math.min(0.3, p.st * 0.6);
    if (p.st > 0.45) { p.state = 'fall'; p.st = 0; p.vz = 0; p.vx = (RIM.x > p.x ? -1 : 1) * 3; p.vy = 0; }
    void dt;
  };
  M.updateAir = function (p, dt) {
    p.vz -= G_JUMP * dt; p.z += p.vz * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.z <= 0) { p.z = 0; p.vz = 0; p.state = 'move'; p.st = 0; if (p.blockChecked) p.blockChecked = null; }
  };

  M.separate = function () {
    const ps = this.players;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j];
      if (a.state === 'dunk' || b.state === 'dunk' || a.state === 'oop' || b.state === 'oop' || a.state === 'hang' || b.state === 'hang') continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy); const min = 1.7;
      if (d < min && d > 0.0001) {
        const push = (min - d) / 2; const nx = dx / d, ny = dy / d;
        const wa = a.state === 'fallen' ? 0 : 1, wb = b.state === 'fallen' ? 0 : 1;
        const tot = wa + wb || 1;
        a.x -= nx * push * 2 * wa / tot; a.y -= ny * push * 2 * wa / tot; b.x += nx * push * 2 * wb / tot; b.y += ny * push * 2 * wb / tot;
      }
    }
  };

  M.playerParticles = function (p, dt) {
    if (this.fx.reduced) return;
    const L = p.data.look || {};
    const team = this.teams[p.team];
    const crown = team.crownActive && this.offense === p.team;
    if (p.fire && Math.random() < dt * 40) this.fx.add({ kind: 'fire', x: p.x + rand(-0.6, 0.6), y: p.y + rand(-0.3, 0.3), z: p.z + rand(0.5, p.hgtFt), vx: rand(-1, 1), vy: 0, vz: rand(3, 7), life: rand(0.3, 0.6), age: 0, size: rand(0.3, 0.6), color: pick(['#ffb300', '#ff6a13', '#e8352b']), g: -4, rot: 0, vr: 0, drag: 0.5 });
    if (crown && Math.random() < dt * 30) this.fx.add({ kind: 'spark', x: p.x + rand(-1, 1), y: p.y + rand(-0.5, 0.5), z: p.z + rand(0, p.hgtFt + 0.5), vx: 0, vy: 0, vz: rand(2, 5), life: rand(0.4, 0.8), age: 0, size: rand(0.08, 0.16), color: pick(['#ffd23f', '#fff1a8']), g: -2, rot: 0, vr: 0, drag: 0.5 });
    const aura = L.aura;
    if (aura && aura !== 'none' && Math.random() < dt * 14) {
      const cfg = { embers: ['ember', ['#ff6a13', '#ffb300']], static: ['spark', ['#7df9ff', '#ffffff']], frost: ['frost', ['#bfe8ff', '#ffffff']], royal: ['spark', ['#ffd23f', '#b98bff']] }[aura];
      if (cfg) this.fx.add({ kind: cfg[0], x: p.x + rand(-0.8, 0.8), y: p.y + rand(-0.4, 0.4), z: p.z + rand(0, p.hgtFt * 0.8), vx: rand(-0.5, 0.5), vy: 0, vz: rand(0.8, 2.5), life: rand(0.5, 0.9), age: 0, size: rand(0.08, 0.2), color: pick(cfg[1]), g: -1, rot: rand(0, 6), vr: rand(-3, 3), drag: 0.4 });
    }
  };

  // ---------- pose + held ball ----------
  // Changes between animations cross-fade instead of snapping. Seconds, by the animation coming in.
  const BLEND = { pass: 0.05, steal: 0.05, catch: 0.07, jumpshot: 0.07, block: 0.07, layup: 0.08, dunk: 0.08, hang: 0.06, stumble: 0.09, run: 0.15, slide: 0.14, fallen: 0.16, celebrate: 0.22 };
  const LANDS = ['idle', 'run', 'defend', 'slide', 'hold', 'dribble', 'catch', 'pass'];
  M.camRight = function () { return this.cam.r; };
  M.updatePose = function (p, dt) {
    const d = p.dims; const o = { dims: d, time: this.time + p.slot * 0.7 };
    let kind = 'idle';
    const sp = hyp(p.vx, p.vy);
    const ball = this.ball;
    const hasBall = ball.state === 'held' && ball.holder === p;
    const live = this.phase === 'live';
    // turning around takes about a tenth of a second instead of flipping in one frame
    if (p.faceVis == null || !dt) p.faceVis = p.facing || 1;
    else p.faceVis += clamp((p.facing || 1) - p.faceVis, -dt * 14, dt * 14);
    // how hard the player is speeding up or slowing down, for leaning into a burst
    if (dt) { p.accS = lerp(p.accS || 0, (sp - (p.lastSp || 0)) / dt, 1 - Math.exp(-dt * 10)); }
    p.lastSp = sp;
    switch (p.state) {
      case 'move': {
        const guarding = this.offense !== p.team && live && ball.state === 'held';
        if (p.z > 0) kind = 'rebound';
        else if (sp > 2) {
          const sx = this.cam.screenDX(p.vx, p.vy);
          // a defender moving any way but straight ahead shuffles instead of running (with a little
          // hysteresis so he doesn't flicker between the two)
          const along = sx * (p.facing || 1) / sp;
          const shuffle = guarding && sp < p.speed * 0.78 && along < (p.anim === 'slide' ? 0.85 : 0.6);
          if (shuffle) { kind = 'slide'; p.phase += dt * TAU * (1.6 + sp * 0.05); o.phase = p.phase; o.speed = clamp(sp / 16, 0, 1.3); }
          else { kind = 'run'; this.runGait(p, dt, sp, Math.abs(sx), o); }
        }
        else if (guarding) kind = 'defend';
        else if (hasBall) kind = live ? 'dribble' : 'hold';
        else kind = 'idle';
        break;
      }
      case 'catch': kind = 'catch'; break;
      case 'pass': kind = 'pass'; o.t = p.st / 0.28; break;
      case 'steal': kind = 'steal'; o.t = p.st / 0.34; break;
      case 'trick': kind = 'trick'; o.style = p.trick ? p.trick.tr.path : 'cross'; o.t = p.trick ? p.st / p.trick.tr.dur : 0; break;
      case 'shoot': kind = 'jumpshot'; o.t = clamp(0.18 + p.st / ((p.shot ? p.shot.apex : 0.4) * 2) * 0.74, 0, 1); o.released = p.shot ? p.shot.released : true; break;
      case 'layup': kind = 'layup'; o.t = p.fly ? p.fly.t / p.fly.T : 1; break;
      case 'dunk': kind = 'dunk'; o.t = p.fly ? clamp(p.fly.t / p.fly.T, 0, 1) : 0.9; o.style = p.fly ? p.fly.style : 'twohand'; break;
      case 'oop': {
        if (p.fly && p.fly.T - p.fly.t < 0.55) { kind = 'dunk'; o.t = clamp(0.1 + (1 - (p.fly.T - p.fly.t) / 0.55) * 0.55, 0, 0.7); o.style = p.fly.style; }
        else { kind = 'run'; this.runGait(p, dt, sp, Math.abs(this.cam.screenDX(p.vx, p.vy)), o); }
        break;
      }
      case 'hang': kind = 'hang'; break;
      case 'block': kind = 'block'; o.swat = p.swat || 0; break;
      case 'jump': case 'fall': kind = 'rebound'; break;
      case 'stumble': kind = 'stumble'; break;
      case 'fallen': kind = 'fallen'; break;
      case 'celebrate': kind = 'celebrate'; o.style = p.data.celebration || ['flex', 'chest', 'roof', 'point', 'shoulders'][p.slot % 5]; break;
      default: break;
    }
    // dribbling and tricks: the ball leads, and the hand rides on top of it. When the ball crosses
    // behind the body (a crossover, between the legs, behind the back) the far hand takes it.
    if (hasBall && (p.state === 'move' || p.state === 'trick') && live) {
      const bpos = this.ballPath(p, dt);
      p.ballWorld = bpos;
      const b = this.toBody(p, bpos.x, bpos.y, bpos.z);
      const tossed = p.state === 'trick' && p.trick && ['head', 'juggle', 'dome'].includes(p.trick.key);
      const hand = tossed ? [b[0], b[1] - 0.45 * d.u] : [b[0], Math.max(b[1] + 0.5 * d.u, d.leg * 0.8)];
      if (b[2] >= -0.15) o.ballHand = hand; else o.ballHandB = hand;
    } else p.ballWorld = null;
    // dunks finish with the hand on the rim, wherever the rim is from this angle
    if (kind === 'dunk' || kind === 'hang') { const r = this.toBody(p, RIM.x, RIM.y, C.rimZ + 0.2); o.rim = [r[0], r[1]]; }
    // landing: the knees give for a moment after coming down
    if (p.z > 0.05) p.air = true;
    else if (p.air) { p.air = false; p.landT = 0.22; }
    if (p.landT > 0) { p.landT -= dt; if (LANDS.includes(kind)) o.land = Math.sin(clamp(1 - p.landT / 0.22, 0, 1) * Math.PI); }
    let pose = A.pose(kind, o);
    const key = kind + (o.style || '');
    if (key !== p.animKey) {
      if (p.pose && dt) { p.blendFrom = p.pose; p.blendT = 0; p.blendDur = BLEND[kind] || (p.anim === 'run' || p.anim === 'slide' ? 0.14 : 0.12); }
      p.animKey = key;
    }
    if (p.blendFrom) {
      p.blendT += dt;
      const k = p.blendT / p.blendDur;
      if (k >= 1) p.blendFrom = null; else pose = A.mixPose(p.blendFrom, pose, k * k * (3 - 2 * k));
    }
    p.anim = kind;
    p.pose = pose;
  };
  // Feet stay planted: stride length comes from how fast the player crosses the screen and the cadence.
  M.runGait = function (p, dt, sp, screenSp, o) {
    const cadence = clamp(0.85 + sp * 0.05, 1.1, 2.4); // full strides per second
    p.phase += TAU * cadence * dt;
    const ground = screenSp + Math.sqrt(Math.max(0, sp * sp - screenSp * screenSp)) * 0.35; // running into the screen reads shorter
    o.phase = p.phase; o.speed = sp / 18; o.accel = p.accS;
    o.stride = ground * A.runDuty(o.speed) / cadence / 2;
  };
  // Body space: x the way the player visibly faces, y up, depth toward the camera.
  M.bodyK = function (p) { return (p.faceVis == null ? (p.facing || 1) : p.faceVis) * Math.cos(p.spin || 0); };
  M.toBody = function (p, x, y, z) {
    const r = this.cam.r; let k = this.bodyK(p);
    if (Math.abs(k) < 0.12) k = k < 0 ? -0.12 : 0.12; // the same narrowest width the drawing uses
    return [((x - p.x) * r[0] + (y - p.y) * r[1]) / k, z - p.z, (x - p.x) * -r[1] + (y - p.y) * r[0]];
  };
  M.fromBody = function (p, bx, by, depth) {
    const r = this.cam.r; const k = this.bodyK(p);
    return { x: p.x + r[0] * bx * k + (depth || 0) * -r[1], y: p.y + r[1] * bx * k + (depth || 0) * r[0], z: p.z + by };
  };
  // Where the ball is while dribbling or doing a trick (world coordinates).
  M.ballPath = function (p, dt) {
    const d = p.dims; const handZ = d.leg * 0.9;
    const sp = hyp(p.vx, p.vy);
    if (p.state === 'trick' && p.trick) {
      const tr = p.trick; const k = clamp(p.st / tr.tr.dur, 0, 1);
      const bounce = (u) => 0.4 + (handZ - 0.4) * Math.abs(Math.cos(Math.PI * u));
      // remember where the move leaves the ball so the regular dribble picks it up from there
      const at = (bx, bz, depth) => { p.drib = { x: bx, depth }; return this.fromBody(p, bx, bz, depth); };
      switch (tr.key) {
        case 'hesi': return at(0.7, bounce(k * 1.5), 0.6);
        case 'cross': return at(0.75 - Math.sin(k * Math.PI) * 0.15, bounce(k), lerp(0.7, -0.7, k));
        case 'legs': return at(0.25, bounce(k) * 0.75, lerp(0.7, -0.7, k));
        case 'behind': return at(lerp(0.7, -0.75, Math.sin(k * Math.PI / 2)), handZ * 0.85, lerp(0.7, -0.6, k));
        case 'spin': case 'tornado': { const a = (p.spin || 0); return at(0.7, handZ * (tr.key === 'tornado' ? 1.25 : 0.95), Math.sin(a) * 0.4); }
        case 'world': { const a = k * Math.PI * 2; return at(Math.cos(a) * 1.0, handZ * 1.05 + Math.sin(a) * 0.15, Math.sin(a) * 1.0); }
        case 'head': { const up = Math.sin(k * Math.PI); return at(0.3 - up * 0.15, lerp(handZ, p.hgtFt + 0.45, up), 0.3); }
        case 'juggle': { const up = Math.sin(k * Math.PI); return at(0.5, lerp(handZ, p.hgtFt + 3.5, up), 0.4); }
        case 'dome': {
          const t = tr.target; const up = Math.sin(Math.min(1, k / 0.9) * Math.PI);
          if (t) { const h0 = this.fromBody(p, 0.7, handZ, 0.5); const tx = t.x, ty = t.y, tz = t.z + t.hgtFt + 0.5; return { x: lerp(h0.x, tx, up), y: lerp(h0.y, ty, up), z: lerp(h0.z, tz, up) + up * 1.2 }; }
          return at(0.5, lerp(handZ, p.hgtFt + 2, up), 0.4);
        }
        default: return at(0.7, handZ, 0.5);
      }
    }
    // regular dribble: about hip high, pushed out further ahead at speed
    const per = sp > 6 ? 0.36 : 0.46;
    const prev = p.dribT;
    p.dribT = (p.dribT + dt / per) % 1;
    if (prev < 0.5 && p.dribT >= 0.5 && !this.attract) this.sfx('dribble', clamp(0.35 + sp / 40, 0.3, 0.7));
    const top = d.leg * (sp > 6 ? 0.8 : 0.74);
    const z = 0.42 + (top - 0.42) * Math.abs(Math.cos(Math.PI * p.dribT));
    const tx = (sp > 6 ? 1.2 : 0.95) * d.u, tdep = 0.55;
    const dr = p.drib || (p.drib = { x: tx, depth: tdep });
    const ease = 1 - Math.exp(-dt * 9);
    dr.x += (tx - dr.x) * ease; dr.depth += (tdep - dr.depth) * ease;
    return this.fromBody(p, dr.x, z, dr.depth);
  };
  // A held ball sits in the palm, just past the drawn hand along the forearm.
  M.positionHeldBall = function () {
    const b = this.ball;
    if (b.state !== 'held' || !b.holder) return;
    const p = b.holder;
    if (p.ballWorld) { b.x = p.ballWorld.x; b.y = p.ballWorld.y; b.z = p.ballWorld.z; }
    else if (p.pose) {
      const e = A.armEnd(p.pose, p.dims, true); const r = 0.42 * p.dims.u;
      const w = this.fromBody(p, e.x + e.dx * r, e.y + e.dy * r, 0.35);
      b.x = w.x; b.y = w.y; b.z = w.z;
    }
    b.rot += 0.12;
  };

  // ---------- the ball ----------
  M.updateBall = function (dt) {
    const b = this.ball;
    b.trail.push({ x: b.x, y: b.y, z: b.z });
    if (b.trail.length > 14) b.trail.shift();
    switch (b.state) {
      case 'held': break;
      case 'shot': case 'pass': this.updateFlight(dt); break;
      case 'loose': case 'dead': this.updateLoose(dt); break;
      default: break;
    }
  };
  M.flightPos = function (seg, t) { return { x: seg.sx + seg.vx * t, y: seg.sy + seg.vy * t, z: seg.sz + seg.vz * t - 0.5 * G_BALL * t * t }; };
  M.updateFlight = function (dt) {
    const b = this.ball; const f = b.flight; if (!f) { b.state = 'loose'; return; }
    if (f.plan) { this.playShot(dt); return; }
    f.t += dt;
    let seg = f.segs[f.i];
    while (f.t >= seg.T && f.i < f.segs.length - 1) {
      f.t -= seg.T; f.i++; seg = f.segs[f.i];
      if (f.kind === 'oop' || f.bank) { this.sfx('board', 0.7); this.hoop.shake = Math.max(this.hoop.shake, 0.2); }
    }
    const t = Math.min(f.t, seg.T);
    const pos = this.flightPos(seg, t);
    b.vx = seg.vx; b.vy = seg.vy; b.vz = seg.vz - G_BALL * t;
    b.x = pos.x; b.y = pos.y; b.z = pos.z; b.rot += dt * 14;
    if (f.kind === 'pass') {
      // passing lanes
      const total = f.segs.reduce((s, x) => s + x.T, 0);
      const done = (f.i ? f.segs[0].T : 0) + f.t;
      if (done > 0.08 && done < total - 0.05) {
        f.recv.opps.forEach((o) => {
          if (b.state !== 'pass' || f.checked.has(o) || o.state === 'fallen' || o.state === 'stumble') return;
          const dd = hyp(o.x - b.x, o.y - b.y);
          if (dd < 2.4 && b.z < o.z + o.reach + 0.8) {
            f.checked.add(o);
            const chance = clamp(0.1 + o.r.stl * 0.045 - f.passer.r.pas * 0.025, 0.04, 0.55);
            if (Math.random() < chance) { this.interceptPass(o); }
          }
        });
        if (b.state !== 'pass') return;
      }
      if (f.t >= seg.T && f.i === f.segs.length - 1) {
        const q = f.recv;
        if (hyp(q.x - b.x, q.y - b.y) < 4.5 && q.state !== 'fallen') { this.giveBall(q); q.state = 'catch'; q.st = 0; q.catchTarget = null; this.faceToward(q, RIM.x, RIM.y, true); }
        else { b.state = 'loose'; b.flight = null; q.catchTarget = null; }
      }
      return;
    }
    if (f.kind === 'oop') {
      // the receiver's scripted flight catches it; a defender near the catch point can swat it
      const q = f.recv;
      if (f.i === f.segs.length - 1 && f.t > seg.T * 0.7 && !f.contested) {
        f.contested = true;
        const blocker = this.findBlocker(q, seg.tx, seg.ty, seg.tz, 3.2);
        if (blocker && this.rollBlock(blocker, q, 'dunk')) { q.state = 'fall'; q.st = 0; q.vz = 0; q.fly = null; return; }
      }
      if (f.t >= seg.T && f.i === f.segs.length - 1 && b.state === 'pass') {
        if (q.state !== 'oop' && q.state !== 'dunk') { b.state = 'loose'; b.flight = null; }
      }
      return;
    }
    // shot in flight: early-flight blocks
    if (f.kind === 'jumper' && f.i === 0 && f.t < seg.T * 0.38) {
      const blocker = this.findBlocker(f.shooter, b.x, b.y, b.z, 2.3);
      if (blocker && !f.blockChecked.has(blocker)) { f.blockChecked.add(blocker); if (this.rollBlock(blocker, f.shooter, 'jumper')) return; }
    }
    if (f.t >= seg.T && f.i === f.segs.length - 1) {
      if (f.made) {
        this.scoreBasket(f.shooter, f.kind, f.deep, { quality: f.quality, bank: f.bank });
        b.state = 'dead'; b.flight = null; b.x = RIM.x; b.y = RIM.y; b.z = C.rimZ - 0.2; b.vx = 0; b.vy = 0; b.vz = -9;
      } else {
        // off the rim
        const ax = b.x - RIM.x, ay = b.y - RIM.y, ad = hyp(ax, ay) || 1;
        const out = rand(5, 11);
        b.vx = ax / ad * out + rand(-3, 3) - (Math.random() < 0.4 ? 6 : 0); b.vy = ay / ad * out + rand(-3, 3); b.vz = rand(6, 13);
        b.state = 'loose'; b.flight = null; b.lastTeam = f.shooter.team;
        this.hoop.shake = Math.max(this.hoop.shake, 0.35);
        this.sfx('rim', 0.8); this.sfx('crowdOoh', 0.2);
        this.missed(f.shooter);
        this.emit('miss', { p: f.shooter });
      }
    }
  };
  // A planned shot: replay the simulated flight step for step, with the sound of every rim and glass
  // contact, then hand the ball to the live physics: through the net, or off as a rebound.
  M.playShot = function (dt) {
    const b = this.ball, f = b.flight, pl = f.plan;
    const prev = f.i;
    f.t += dt;
    const i = Math.min(pl.end, Math.max(1, Math.round(f.t / pl.step)));
    for (const e of pl.events) if (e.i > prev && e.i <= i) this.shotContact(f, e);
    f.i = i;
    const k = (i - 1) * 6, P = pl.path;
    b.x = P[k]; b.y = P[k + 1]; b.z = P[k + 2]; b.vx = P[k + 3]; b.vy = P[k + 4]; b.vz = P[k + 5];
    // backspin: the top of the ball rolls back toward the shooter
    b.rot += dt * 14 * (this.cam.screenDX(b.vx, b.vy) > 0 ? -1 : 1);
    // early in the flight a defender already in the air can still get a hand on it
    if (f.kind === 'jumper' && f.t < pl.reachT * 0.38) {
      const blocker = this.findBlocker(f.shooter, b.x, b.y, b.z, 2.3);
      if (blocker && !f.blockChecked.has(blocker)) { f.blockChecked.add(blocker); if (this.rollBlock(blocker, f.shooter, 'jumper')) return; }
    }
    if (i < pl.end) return;
    if (pl.made) {
      this.scoreBasket(f.shooter, f.kind, f.deep, { quality: f.quality, bank: f.bank });
      b.state = 'dead'; b.flight = null; // it keeps its real speed down through the net
    } else {
      b.state = 'loose'; b.flight = null; b.lastTeam = f.shooter.team;
      this.missed(f.shooter);
      this.emit('miss', { p: f.shooter });
    }
  };
  M.shotContact = function (f, e) {
    if (e.kind === 'rim') {
      this.sfx('rim', clamp(e.speed / 14, 0.25, 1));
      this.hoop.shake = Math.max(this.hoop.shake, clamp(e.speed / 22, 0.12, 0.6));
      f.rims++;
      // a second bounce on the rim: everybody leans in
      if (f.rims === 2) { this.sfx('crowdOoh', 0.35); this.hype(0.5); }
    } else if (e.kind === 'board') {
      this.sfx('board', clamp(e.speed / 18, 0.3, 0.8));
      this.hoop.shake = Math.max(this.hoop.shake, 0.18);
    }
  };

  M.interceptPass = function (o) {
    const b = this.ball; const f = b.flight;
    const passer = f.passer;
    b.flight = null;
    if (f.recv) f.recv.catchTarget = null;
    this.teams[passer.team].pot = 0; this.teams[passer.team].combo = 0;
    if (this.teams[passer.team].crownActive) { this.teams[passer.team].crownActive = 0; this.resumeMusic(); }
    o.stats.stl++;
    this.giveBall(o);
    o.state = 'catch'; o.st = 0;
    const team = this.teams[o.team];
    team.crown = Math.min(2, team.crown + 200 / CROWN_PTS);
    this.fx.preset('steal', o.x, o.y, 4);
    this.fx.call('PICKED OFF!', { size: 70, color: '#3fd13f', color2: team.colors.pri });
    this.sfx('steal', 1); this.sfx('crowdOoh', 0.5); this.hype(0.8);
    this.emit('steal', { p: o, h: passer });
  };
  M.updateLoose = function (dt) {
    const b = this.ball;
    // the same rim, glass, net and court the shots use, four small steps a frame
    const ev = [];
    const n = 4; for (let i = 0; i < n; i++) BK.ballPhysics.step(b, dt / n, this.hoop, ev);
    b.rot += (hyp(b.vx, b.vy) * 0.3 + 2) * dt * (this.cam.screenDX(b.vx, b.vy) < 0 ? -1 : 1);
    for (const e of ev) {
      if (e.kind === 'rim') { this.sfx('rim', clamp(e.speed / 14, 0.2, 0.9)); this.hoop.shake = Math.max(this.hoop.shake, clamp(e.speed / 22, 0.1, 0.5)); }
      else if (e.kind === 'board') this.sfx('board', clamp(e.speed / 18, 0.25, 0.7));
      else if (b.state === 'loose' || Math.random() < 0.7) this.sfx('dribble', clamp(e.speed / 22, 0.2, 0.9));
    }
    if (b.state === 'dead') return;
    // pick it up
    let best = null, bs = -1e9;
    for (const p of this.players) {
      if (p.state === 'fallen' || p.state === 'stumble' || p.state === 'dunk' || p.state === 'hang' || p.state === 'oop') continue;
      if (b.blockedBy === p && b.vz > 0) continue;
      const dd = hyp(p.x - b.x, p.y - b.y);
      const reachTop = p.z + p.reach + (p.state === 'jump' || p.state === 'block' ? 0.7 : 0.2);
      const grab = 1.7 + p.r.reb * 0.07;
      if (dd < grab && b.z <= reachTop && b.z >= p.z - 0.3) {
        const s = p.r.reb * 0.12 + Math.random() * 0.5 - dd * 0.25 + (p.z > 0 ? 0.3 : 0);
        if (s > bs) { bs = s; best = p; }
      }
    }
    if (best) {
      const off = best.team === b.lastTeam;
      best.stats.reb++;
      b.blockedBy = null;
      this.giveBall(best);
      if (best.state === 'move' && best.z === 0) { best.state = 'catch'; best.st = 0; }
      if (best.z > 3 && !this.attract) this.fx.float(off ? 'OFFENSIVE BOARD' : 'BOARD', best.x, best.y, best.z + best.hgtFt + 1, '#ffffff');
      this.emit('rebound', { p: best, off });
    }
  };

  M.destroy = function () { this.stop(); if (BK.audio) BK.audio.stopCrowd(); };
  M.helpers = { clamp, lerp, rand, pick, hyp, RIM, distRim, CROWN_PTS };
})(window.BK = window.BK || {});
