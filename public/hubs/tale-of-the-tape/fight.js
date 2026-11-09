/* Tale of the Tape — the fight itself.
   A Punch-Out-style front view drawn entirely in canvas: no images. The opponent telegraphs every
   attack; reading the tell and slipping the right way opens a counter window. Career stats tilt the
   numbers, but the player's hands decide the fight.
   TOT.fight.start(host, config) -> controller. config.onEnd(result) fires once. */
(function (T) {
  'use strict';
  const D = T.data;
  const W = 960, H = 600;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const ease = (k) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);

  // ---------- move book ----------
  // tell: wind-up time (ms) at an average rating. dmg: base damage. avoid: which defenses work.
  const MOVES = {
    jab: { name: 'Jab', tell: 360, strike: 110, dmg: 5, avoid: { L: 1, R: 1, duck: 1 }, block: 0, icon: '•', tip: 'His shoulder twitches before the jab. Slip either way.' },
    hookL: { name: 'Left hook', tell: 640, strike: 150, dmg: 10, avoid: { R: 1, duck: 1 }, block: 0.35, icon: '→', tip: 'When his left glove swings out wide, slip RIGHT or duck.' },
    hookR: { name: 'Right hook', tell: 640, strike: 150, dmg: 10, avoid: { L: 1, duck: 1 }, block: 0.35, icon: '←', tip: 'When his right glove swings out wide, slip LEFT or duck.' },
    upper: { name: 'Uppercut', tell: 700, strike: 140, dmg: 13, avoid: { L: 1, R: 1 }, block: 0.5, duckPenalty: 1.5, icon: '↔', tip: 'When he dips low, it is an uppercut. Slip sideways. Never duck into it.' },
    body: { name: 'Body shot', tell: 520, strike: 130, dmg: 7, avoid: { L: 1, R: 1 }, block: 0, icon: '▣', tip: 'When he crouches, he is going to the body. Slip or put your guard up.' },
    haymaker: { name: 'Haymaker', tell: 1050, strike: 170, dmg: 22, avoid: { L: 1, R: 1, duck: 1 }, block: 0.75, guardBreak: true, icon: '★', tip: 'The haymaker: big wind-up over his head. Get out of the way. Do NOT try to block it.' },
    feint: { name: 'Feint', tell: 520, strike: 0, dmg: 0, avoid: {}, block: 0, feint: true, icon: '?', tip: 'Some fighters fake the hook. Wait for the glove to actually come.' },
    taunt: { name: 'Taunt', tell: 950, strike: 0, dmg: 0, avoid: {}, block: 0, taunt: true, icon: '!', tip: 'When he showboats, he is wide open. Make him pay.' },
    bolo: { name: 'Bolo punch', tell: 980, strike: 170, dmg: 15, avoid: { L: 1 }, block: 0.55, duckPenalty: 1.3, sig: true, icon: '↺', tip: 'His bolo punch swings up from his right side in a big circle. Slip LEFT. Ducking will not save you.' },
    lowblow: { name: 'Low blow', tell: 300, strike: 110, dmg: 9, avoid: { L: 1, R: 1 }, block: 1, sig: true, icon: '⚠', tip: 'He fights dirty: a quick punch below the belt with almost no wind-up. Slip it.' },
  };
  // Style books: which moves each style throws, and how often.
  const BOOK = {
    slugger: { jab: 2, hookL: 3, hookR: 3, upper: 2, body: 1, haymaker: 2.5 },
    boxer: { jab: 6, hookL: 1.5, hookR: 1.5, upper: 1, body: 1.5, feint: 1 },
    swarmer: { jab: 3, hookL: 2.5, hookR: 2.5, upper: 1.5, body: 4, haymaker: 0.5 },
    counter: { jab: 2, hookL: 1.5, hookR: 1.5, upper: 2, body: 1, feint: 1.5 },
    dirty: { jab: 2, hookL: 2, hookR: 2, upper: 1.5, body: 3, feint: 2, haymaker: 1 },
    showman: { jab: 3, hookL: 2, hookR: 2, upper: 1.5, body: 1, taunt: 2.5, haymaker: 1 },
  };
  const MOVES_SIG_NAMES = { bolo: 'The Bolo', triple: 'The Triple', rush: 'The Rush', lowblow: 'The Low Blow' };
  const MOVES_SIG_TIPS = { bolo: 'It swings up from his right side in a big circle. Slip LEFT. Ducking will not save you.', triple: 'Jab, jab, then a hook. Slip the jabs and wait for the hook.', rush: 'He charges in with three quick body shots. Slip side to side or keep your guard up.', lowblow: 'A fast punch below the belt with almost no wind-up. Slip it. The referee may take a point.' };
  // Player punches.
  const PUNCH = {
    jab: { wind: 60, reach: 100, back: 150, dmg: 3.2, sta: 4, target: 'head' },
    cross: { wind: 110, reach: 110, back: 230, dmg: 5.8, sta: 7, target: 'head' },
    body: { wind: 90, reach: 110, back: 200, dmg: 4.6, sta: 6, target: 'body' },
    hay: { wind: 320, reach: 130, back: 320, dmg: 9, sta: 0, target: 'head' },
  };

  function weightedMove(book) {
    const entries = Object.entries(book);
    let r = Math.random() * entries.reduce((n, e) => n + e[1], 0);
    for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
    return entries[0][0];
  }

  // ---------- drawing helpers ----------
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = clamp(Math.round(r * (1 + amt)), 0, 255); g = clamp(Math.round(g * (1 + amt)), 0, 255); b = clamp(Math.round(b * (1 + amt)), 0, 255);
    return `rgb(${r},${g},${b})`;
  }
  function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
  const INK = '#17130f';

  function makeHalftone(color, size = 6, r = 1.6) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d'); x.fillStyle = color; x.beginPath(); x.arc(size / 2, size / 2, r, 0, Math.PI * 2); x.fill();
    return c;
  }

  // ---------- the controller ----------
  T.fight = {
    MOVES,
    start(host, cfg) {
      const ctl = new Fight(host, cfg);
      return ctl;
    },
  };

  class Fight {
    constructor(host, cfg) {
      this.host = host; this.cfg = cfg;
      this.era = cfg.era || 'poster';
      this.reduced = !!cfg.reducedMotion;
      this.assist = cfg.assist || 'normal'; // 'rookie' | 'normal' | 'champ'
      this.demo = !!cfg.demo;
      this.perks = new Set(cfg.perks || []);
      this.gear = cfg.gear || {};
      this.sound = this.demo ? null : T.audio;
      this.buildDom();
      this.setup();
      this.keys = {};
      this.bind();
      this.last = performance.now();
      this.acc = 0;
      this.running = true;
      this.raf = requestAnimationFrame((t) => this.frame(t));
    }

    // ----- DOM -----
    buildDom() {
      const c = this.cfg, you = c.you, opp = c.opp;
      const h = this.host;
      h.innerHTML = '';
      h.classList.add('fight-host');
      h.classList.toggle('demo', !!c.demo);
      h.dataset.era = this.era;
      h.innerHTML = `
        <div class="fight-hud" aria-hidden="true">
          <div class="hud-side you"><span class="hud-name">${esc(you.last)}</span><div class="hud-bar hp"><i></i><b></b></div><div class="hud-bar sta"><i></i></div></div>
          <div class="hud-mid"><span class="hud-round">ROUND 1</span><span class="hud-clock">3:00</span><span class="hud-stars" title="Crowd meter"><i></i><i></i><i></i></span></div>
          <div class="hud-side opp"><span class="hud-name">${esc(opp.last)}</span><div class="hud-bar hp"><i></i><b></b></div><div class="hud-bar sta"><i></i></div></div>
        </div>
        <div class="fight-stage"><canvas class="fight-canvas" width="${W}" height="${H}" role="img" aria-label="Boxing match: ${esc(you.last)} versus ${esc(opp.last)}"></canvas><div class="era-overlay"></div>
          <div class="tv-bug" aria-hidden="true">LIVE</div><div class="lower-third" aria-hidden="true"></div>
          <div class="fight-callout" aria-hidden="true"></div>
          <div class="fight-overlay" hidden></div>
        </div>
        <p class="fight-ticker" aria-live="polite"></p><p class="rotate-hint">Turn your phone sideways for a bigger ring.</p>
        <div class="touch-pad" aria-label="Fight controls">
          <div class="pad-left">
            <button class="pad-btn" data-k="left" aria-label="Slip left">◀<small>slip</small></button>
            <button class="pad-btn" data-k="duck" aria-label="Duck">▼<small>duck</small></button>
            <button class="pad-btn" data-k="block" aria-label="Guard up">▲<small>guard</small></button>
            <button class="pad-btn" data-k="right" aria-label="Slip right">▶<small>slip</small></button>
          </div>
          <div class="pad-right">
            <button class="pad-btn hit" data-k="jab" aria-label="Jab">JAB</button>
            <button class="pad-btn hit" data-k="cross" aria-label="Cross">CROSS</button>
            <button class="pad-btn hit" data-k="body" aria-label="Body shot">BODY</button>
            <button class="pad-btn hay" data-k="hay" aria-label="Haymaker">★<small>haymaker</small></button>
            ${(c.perks || []).includes('clinch') ? '<button class="pad-btn" data-k="clinch" aria-label="Clinch">⊂⊃<small>clinch</small></button>' : ''}
          </div>
        </div>
        <div class="fight-keys"><span><kbd>←</kbd><kbd>→</kbd> slip</span><span><kbd>↓</kbd> duck</span><span><kbd>↑</kbd> hold guard</span><span><kbd>J</kbd> jab</span><span><kbd>K</kbd> cross</span><span><kbd>L</kbd> body</span><span><kbd>Space</kbd> haymaker</span>${(c.perks || []).includes('clinch') ? '<span><kbd>E</kbd> clinch</span>' : ''}<span><kbd>P</kbd> pause</span></div>`;
      if ((navigator.maxTouchPoints || 0) > 0 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)) h.classList.add('touch');
      this.canvas = h.querySelector('canvas');
      this.ctx = this.canvas.getContext('2d');
      this.hud = {
        youHp: h.querySelector('.you .hp i'), youHpGhost: h.querySelector('.you .hp b'), youSta: h.querySelector('.you .sta i'),
        oppHp: h.querySelector('.opp .hp i'), oppHpGhost: h.querySelector('.opp .hp b'), oppSta: h.querySelector('.opp .sta i'),
        round: h.querySelector('.hud-round'), clock: h.querySelector('.hud-clock'), stars: [...h.querySelectorAll('.hud-stars i')],
      };
      this.ticker = h.querySelector('.fight-ticker');
      this.callout = h.querySelector('.fight-callout');
      this.overlay = h.querySelector('.fight-overlay');
      this.lower = h.querySelector('.lower-third');
      if (this.era === 'tv') this.lower.textContent = `${(D.SPONSORS_1950S[Math.floor(Math.random() * D.SPONSORS_1950S.length)])} presents · ${c.title ? 'CHAMPIONSHIP' : 'MAIN EVENT'}`;
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = W * this.dpr; this.canvas.height = H * this.dpr;
      this.halftone = { skin: null };
    }

    setup() {
      const c = this.cfg, ys = c.you.stats, opp = c.opp;
      this.rounds = c.rounds || 3;
      this.roundLen = c.roundSeconds || 60;
      const healthMul = 0.75 + 0.25 * ((c.you.health == null ? 100 : c.you.health) / 100);
      this.P = {
        hpMax: (80 + ys.chn * 0.7) * healthMul, staMax: 55 + ys.sta * 0.6, state: 'idle', t: 0, x: 0, y: 0, lean: 0,
        gL: { x: 360, y: 470, s: 1 }, gR: { x: 600, y: 470, s: 1 }, punch: null, stars: c.startStars || 0, kd: 0, kdRound: 0,
        landed: 0, thrown: 0, dmgDealt: 0, dmgTaken: 0, combo: 0, mash: 0, hitFlash: 0, lastDodge: -1000, block: false, stun: 0, clinches: 2,
      };
      this.P.hp = this.P.hpMax; this.P.sta = this.P.staMax;
      const r = opp.rating;
      const os = opp.stats;
      this.O = {
        hpMax: 90 + os.chn * 1.0 + r * 1.5, staMax: 60 + os.sta * 0.5, state: 'idle', t: 0, wait: 1300, guard: 'high', guardT: 0,
        move: null, x: 0, sway: 0, lean: 0, crouch: 0, headX: 0, headY: 0, tilt: 0, fall: 0,
        gL: { x: 425, y: 185, s: 1 }, gR: { x: 535, y: 185, s: 1 }, blocked: 0, kd: 0, kdRound: 0, combo: [], hitFlash: 0, dmgTaken: 0, landed: 0,
        bruise: 0, mouth: 0, stats: os, rating: r, style: opp.style, used: {}, getUp: null, tauntLine: '',
      };
      this.O.hp = this.O.hpMax; this.O.sta = this.O.staMax;
      this.skill = clamp((r - 30) / 60, 0, 1.1);
      this.round = 1; this.clock = this.roundLen; this.phase = 'intro'; this.phaseT = 0;
      this.cards = [[0, 0], [0, 0], [0, 0]]; this.roundPts = [0, 0];
      this.fx = []; this.parts = []; this.shake = 0; this.flash = 0; this.hitstop = 0; this.slowmo = 0; this.bulbs = [];
      this.timeScale = 1; this.camZoom = 1;
      this.crowd = this.makeCrowd();
      this.photogs = [{ x: 168, dir: 1 }, { x: 232, dir: 1 }, { x: 728, dir: -1 }, { x: 792, dir: -1 }];
      this.makeAmbience();
      this.buildLayers();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (this.running) this.buildLayers(); });
      this.count = null;
      this.result = null;
      this.lastTip = '';
      this.say(pick(D.CALLS[this.era].open));
      if (this.demo) { this.bot = demoBot; this.renderHud(true); setTimeout(() => this.running && this.beginRound(), 600); return; }
      this.showOverlay(`<div class="ov-card intro"><p class="ov-kicker">${esc(c.venue || '')}</p><h2>${esc(c.you.last)} <span>vs</span> ${esc(opp.last)}</h2><p class="ov-sub">${this.rounds} rounds${c.title ? ' · for the championship' : ''}</p><p class="ov-hint">${c.firstFight ? 'Watch his wind-up. Slip the punch. Hit him while he is open.' : 'Read the tell. Slip. Counter.'}</p>${opp.signature && MOVES_SIG_TIPS[opp.signature] ? `<p class="ov-sig"><b>Signature move: ${esc(MOVES_SIG_NAMES[opp.signature])}.</b> ${esc(MOVES_SIG_TIPS[opp.signature])}</p>` : ''}<button class="button" data-fx="go">Ring the bell</button></div>`);
      this.renderHud(true);
    }

    makeCrowd() {
      const people = [];
      const hats = this.era === 'tv' ? ['none', 'none', 'fedora', 'cap', 'cloche'] : ['fedora', 'fedora', 'fedora', 'cap', 'none', 'cloche'];
      for (let row = 0; row < 5; row++) {
        const y = 112 + row * 26, n = 20 + row * 2;
        for (let i = 0; i < n; i++) {
          const x = (i + (row % 2) * 0.5) * (W / n) + rand(-6, 6);
          if (row === 4 && (Math.abs(x - 200) < 50 || Math.abs(x - 760) < 50)) continue; // photographers sit there
          people.push({ x, y: y + rand(-4, 4), row, s: 0.62 + row * 0.12, hat: pick(hats), bob: Math.random() * 6.28, shade: rand(-0.18, 0.1), arms: Math.random() < 0.45, hatWave: Math.random() < 0.3, cigar: Math.random() < 0.07, collar: Math.random() < 0.5 });
        }
      }
      return people;
    }

    // ----- input -----
    bind() {
      if (this.demo) return;
      this.onKey = (e) => {
        const down = e.type === 'keydown';
        const k = e.key;
        const map = { e: 'clinch', E: 'clinch', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowDown: 'duck', s: 'duck', S: 'duck', ArrowUp: 'block', w: 'block', W: 'block', j: 'jab', J: 'jab', z: 'jab', Z: 'jab', k: 'cross', K: 'cross', x: 'cross', X: 'cross', l: 'body', L: 'body', c: 'body', C: 'body', ' ': 'hay', p: 'pause', P: 'pause', Escape: 'pause' };
        const a = map[k];
        if (!a) return;
        if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
        e.preventDefault();
        if (down && e.repeat && a !== 'block') return;
        this.input(a, down);
      };
      window.addEventListener('keydown', this.onKey);
      window.addEventListener('keyup', this.onKey);
      this.onPad = (e) => {
        const b = e.target.closest('[data-k]');
        if (!b) return;
        e.preventDefault();
        const down = e.type === 'pointerdown';
        if (down) b.setPointerCapture && b.setPointerCapture(e.pointerId);
        b.classList.toggle('on', down);
        this.input(b.dataset.k, down);
      };
      const pad = this.host.querySelector('.touch-pad');
      pad.addEventListener('pointerdown', this.onPad);
      pad.addEventListener('pointerup', this.onPad);
      pad.addEventListener('pointercancel', this.onPad);
      this.onClick = (e) => {
        const b = e.target.closest('[data-fx]');
        if (!b) return;
        const act = b.dataset.fx;
        if (act === 'go') { this.hideOverlay(); this.beginRound(); }
        else if (act === 'resume') { this.hideOverlay(); this.paused = false; }
        else if (act === 'towel') { this.hideOverlay(); this.paused = false; this.endFight('L', 'TKO', 'towel'); }
        else if (act === 'radio') { this.hideOverlay(); this.paused = false; this.finishOnRadio(); }
        else if (act && act.startsWith('corner-')) this.cornerChoice(act.slice(7));
        else if (act === 'done') this.finish();
      };
      this.host.addEventListener('click', this.onClick);
      this.onVis = () => { if (document.hidden && this.phase === 'fight' && !this.paused) this.pause(); };
      document.addEventListener('visibilitychange', this.onVis);
    }

    input(a, down) {
      if (a === 'pause') { if (down && (this.phase === 'fight')) this.paused ? (this.hideOverlay(), (this.paused = false)) : this.pause(); return; }
      if (a === 'block') { this.P.block = down; return; }
      if (!down) return;
      if (this.phase === 'intro' && (a === 'jab' || a === 'cross' || a === 'hay')) { this.hideOverlay(); this.beginRound(); return; }
      if (this.phase === 'corner' && ['jab', 'cross', 'body'].includes(a)) { this.cornerChoice({ jab: 'breathe', cross: 'ice', body: 'fire' }[a]); return; }
      if (this.phase === 'down-you') { if (['jab', 'cross', 'body', 'hay', 'left', 'right', 'duck'].includes(a)) this.mash(); return; }
      if (this.phase !== 'fight' || this.paused) return;
      const P = this.P;
      if (a === 'clinch') { this.tryClinch(); return; }
      if (P.state === 'clinch') return;
      if (P.state === 'hurt' || P.state === 'down' || P.stun > 0) return;
      if (a === 'left' || a === 'right' || a === 'duck') {
        if (P.state === 'punch' && P.punch && P.punch.phase !== 'back') return;
        if (this.now - P.lastDodge < 120 && P.state !== 'idle') return;
        P.state = a === 'duck' ? 'duck' : a === 'left' ? 'dodgeL' : 'dodgeR';
        P.t = 0; P.lastDodge = this.now; P.punch = null;
        this.sound && this.sound.play('whoosh', 0.4);
        return;
      }
      if (a === 'hay' && P.stars <= 0) { this.flashCallout('NO STARS YET', 'dim'); return; }
      if (P.state === 'punch' && P.punch && P.punch.phase !== 'back') { P.queued = a; return; }
      if (P.state === 'dodgeL' || P.state === 'dodgeR' || P.state === 'duck') { if (P.t < 160) { P.queued = a; return; } }
      this.throwPunch(a);
    }

    tryClinch() {
      const P = this.P, O = this.O;
      if (!this.perks.has('clinch') || P.state === 'down' || P.state === 'clinch') return;
      if ((P.clinches || 0) <= 0) { this.flashCallout('NO CLINCHES LEFT THIS ROUND', 'dim'); return; }
      if (!['tell', 'strike', 'idle', 'hurt', 'cover', 'recover'].includes(O.state)) return;
      P.clinches--; P.state = 'clinch'; P.t = 0; P.punch = null; P.queued = null; P.stun = 0;
      O.state = 'clinch'; O.t = 0; O.move = null; O.combo = [];
      P.sta = Math.min(P.staMax, P.sta + P.staMax * 0.3); P.hp = Math.min(P.hpMax, P.hp + P.hpMax * 0.03);
      this.ref.tx = 650;
      this.flashCallout('CLINCH!', 'dim');
      this.sound && this.sound.play('block', 0.7);
    }

    throwPunch(a) {
      const P = this.P, def = PUNCH[a];
      const tired = P.sta < 12;
      P.state = 'punch'; P.t = 0;
      const spd = this.cfg.you.stats.spd;
      const speedMul = (1.15 - spd / 300) * (tired ? 1.5 : 1) * (this.perks.has('fasthands') ? 0.84 : 1);
      P.punch = { kind: a, phase: 'wind', t: 0, wind: def.wind * speedMul, reach: def.reach * speedMul, back: def.back * speedMul, hand: a === 'jab' ? 'L' : a === 'body' ? (Math.random() < 0.5 ? 'L' : 'R') : 'R', checked: false, tired };
      if (a === 'hay') { P.punch.stars = P.stars; P.stars = 0; this.sound && this.sound.play('windup', 0.6); this.say('Here comes the haymaker!'); }
      else P.sta = Math.max(0, P.sta - def.sta);
      P.thrown++;
    }

    mash() {
      const P = this.P;
      if (!this.count || this.count.who !== 'you') return;
      P.mash++;
      this.sound && this.sound.play('tap', 0.3);
    }

    pause() {
      this.paused = true;
      this.showOverlay(`<div class="ov-card"><h2>Paused</h2><p class="ov-sub">Round ${this.round} of ${this.rounds}</p><div class="ov-buttons"><button class="button" data-fx="resume">Back to the fight</button><button class="button secondary" data-fx="radio">Let the radio call the rest</button><button class="button danger" data-fx="towel">Throw in the towel</button></div></div>`);
    }

    // ----- flow -----
    beginRound() {
      this.phase = 'fight'; this.phaseT = 0;
      this.P.kdRound = 0; this.O.kdRound = 0; this.roundPts = [0, 0];
      this.O.state = 'idle'; this.O.wait = 900; this.O.t = 0;
      this.sound && this.sound.play('bell', 1);
      this.sound && this.sound.crowd(true);
      this.card = { text: this.round === this.rounds && this.rounds > 1 ? 'FINAL' : `ROUND ${this.round}`, sub: this.round === this.rounds && this.rounds > 1 ? `ROUND ${this.round} OF ${this.rounds}` : `OF ${this.rounds}`, t: 0, dur: this.reduced ? 700 : 1500 };
    }

    endRound() {
      this.phase = 'corner'; this.phaseT = 0;
      this.sound && this.sound.play('bell', 1);
      this.say(pick(D.CALLS[this.era].bell));
      // judges
      const [p, o] = this.roundPts;
      for (let j = 0; j < 3; j++) {
        const noise = rand(-6, 6);
        const pWins = p + noise > o;
        const a = this.O.kdRound > this.P.kdRound ? 8 : 9, b = this.P.kdRound > this.O.kdRound ? 8 : 9;
        if (Math.abs(p - o) < 1 && this.P.kdRound === this.O.kdRound) { this.cards[j][0] += 10; this.cards[j][1] += 10; }
        else if (pWins) { this.cards[j][0] += 10; this.cards[j][1] += b === 8 ? 8 : 9; }
        else { this.cards[j][1] += 10; this.cards[j][0] += a; }
      }
      if (this.round >= this.rounds) { this.decision(); return; }
      const tip = this.bestTip();
      const trainer = this.cfg.trainer || 'Your trainer';
      const won = p > o;
      this.showOverlay(`<div class="ov-card corner"><p class="ov-kicker">Between rounds · ${this.round} of ${this.rounds} done</p><h2>${won ? 'Good round.' : p === o ? 'Even round.' : 'You lost that one.'}</h2><blockquote>“${esc(tip)}”<cite>${esc(trainer)}</cite></blockquote><p class="ov-sub">Pick one:</p><div class="ov-buttons three"><button class="button" data-fx="corner-breathe"><b>Breathe</b><small>Refill your stamina</small><kbd>J</kbd></button><button class="button" data-fx="corner-ice"><b>Ice and water</b><small>Recover some health</small><kbd>K</kbd></button><button class="button" data-fx="corner-fire"><b>Fire me up</b><small>Start with a star</small><kbd>L</kbd></button></div></div>`);
    }

    cornerChoice(k) {
      if (this.phase !== 'corner') return;
      const P = this.P;
      P.sta = P.staMax;
      if (k === 'breathe') { P.sta = P.staMax; P.staMax += 4; }
      if (k === 'ice') P.hp = Math.min(P.hpMax, P.hp + P.hpMax * (this.gear.cutman ? 0.27 : 0.18));
      else P.hp = Math.min(P.hpMax, P.hp + P.hpMax * 0.06);
      if (this.perks.has('secondwind')) P.hp = Math.min(P.hpMax, P.hp + P.hpMax * 0.08);
      P.clinches = 2;
      if (k === 'fire') P.stars = Math.min(3, P.stars + 1);
      // the opponent recovers too
      const O = this.O;
      O.hp = Math.min(O.hpMax, O.hp + O.hpMax * (0.08 + O.stats.sta / 1000));
      O.sta = Math.min(O.staMax, O.sta + O.staMax * 0.6);
      this.hideOverlay();
      this.round++; this.clock = this.roundLen;
      this.beginRound();
    }

    bestTip() {
      const used = Object.entries(this.O.used).sort((a, b) => b[1] - a[1]);
      const opts = used.map(([k]) => MOVES[k].tip).filter((t) => t !== this.lastTip);
      let tip = opts[0] || 'Stay busy. Make him think about your jab.';
      if (this.P.sta < this.P.staMax * 0.3) tip = 'You are punching yourself out. Pick your shots. Counter when he misses.';
      if (this.O.guard === 'high' && Math.random() < 0.3) tip = 'His hands are high. Go to the body with L.';
      if (this.P.stars > 0 && Math.random() < 0.4) tip = 'You have a star. Space bar. Throw the haymaker when he is open after a miss.';
      this.lastTip = tip;
      return tip;
    }

    decision() {
      const v = this.cards.map((c) => Math.sign(c[0] - c[1]));
      const yes = v.filter((x) => x > 0).length, no = v.filter((x) => x < 0).length;
      let res, m;
      if (yes >= 2) { res = 'W'; m = yes === 3 ? 'UD' : no === 1 ? 'SD' : 'MD'; }
      else if (no >= 2) { res = 'L'; m = no === 3 ? 'UD' : yes === 1 ? 'SD' : 'MD'; }
      else { res = 'D'; m = 'DRAW'; }
      this.endFight(res, m, 'cards');
    }

    finishOnRadio() {
      // Score what happened so far, then let the engine call the rest.
      const lead = (this.P.dmgDealt - this.P.dmgTaken) / 10 + (this.O.kd - this.P.kd) * 3;
      this.endFight(null, null, 'radio', lead);
    }

    endFight(res, method, how, lead) {
      if (this.result) return;
      this.phase = 'over';
      this.sound && this.sound.crowd(false);
      const P = this.P, O = this.O;
      const out = {
        result: res, method, round: this.round, kdFor: O.kd, kdAgainst: P.kd,
        dmgTaken: clamp(P.dmgTaken / P.hpMax / 1.6, 0, 1), cards: this.cards.map((c) => [c[0], c[1]]), played: true, how, radioLead: lead,
        stats: { thrown: P.thrown, landed: P.landed },
      };
      this.result = out;
      if (how === 'radio') { this.finish(); return; }
      if (this.demo) { if (res === 'W') this.throwTape(90); setTimeout(() => this.finish(), 2800); return; }
      const title = res === 'W' ? (method === 'KO' || method === 'TKO' ? 'K.O.!' : 'YOU WIN') : res === 'L' ? (method === 'KO' || method === 'TKO' ? (how === 'towel' ? 'TOWEL' : 'K.O.') : 'DECISION LOST') : 'DRAW';
      const cardLine = method && /D/.test(method) ? `<p class="ov-cards">${this.cards.map((c) => `${c[0]}–${c[1]}`).join(' · ')}</p>` : '';
      const methodLine = { KO: `Knockout, round ${this.round}`, TKO: `Technical knockout, round ${this.round}`, UD: 'Unanimous decision', SD: 'Split decision', MD: 'Majority decision', DRAW: 'The judges call it even' }[method] || '';
      setTimeout(() => {
        if (!this.running) return;
        this.showOverlay(`<div class="ov-card result ${res === 'W' ? 'win' : res === 'L' ? 'loss' : ''}"><h2 class="ov-big">${title}</h2><p class="ov-sub">${methodLine}</p>${cardLine}<p class="ov-stats">Punches landed: ${P.landed} of ${P.thrown} · Knockdowns: ${O.kd} for, ${P.kd} against</p><button class="button" data-fx="done">Continue</button></div>`);
        const b = this.overlay.querySelector('button'); b && b.focus();
      }, this.reduced ? 200 : 1500);
      if (res === 'W') { this.sound && this.sound.play('roar', 1); if (how !== 'stoppage') { this.throwTape(110); this.popBulbs(10); } }
    }

    finish() {
      if (this.finished) return;
      this.finished = true;
      this.destroy();
      this.cfg.onEnd && this.cfg.onEnd(this.result);
    }

    destroy() {
      this.running = false;
      cancelAnimationFrame(this.raf);
      window.removeEventListener('keydown', this.onKey);
      window.removeEventListener('keyup', this.onKey);
      document.removeEventListener('visibilitychange', this.onVis);
      this.host.removeEventListener('click', this.onClick);
      this.sound && this.sound.crowd(false);
    }

    showOverlay(html) { this.overlay.innerHTML = html; this.overlay.hidden = false; const b = this.overlay.querySelector('button'); if (b) setTimeout(() => b.focus(), 30); }
    hideOverlay() { this.overlay.hidden = true; this.overlay.innerHTML = ''; }
    say(text) { this.ticker.textContent = text; }
    flashCallout(text, cls = '') {
      this.callout.textContent = text; this.callout.className = 'fight-callout show ' + cls;
      clearTimeout(this.calloutT); this.calloutT = setTimeout(() => { this.callout.className = 'fight-callout'; }, cls === 'big' ? 1100 : 650);
    }

    // ----- main loop -----
    frame(t) {
      if (!this.running) return;
      let dt = Math.min(50, t - this.last) * (this.speed || 1); this.last = t;
      if (!this.paused) {
        if (this.hitstop > 0) { this.hitstop -= dt; dt = 0; }
        if (this.slowmo > 0) { this.slowmo -= dt; dt *= 0.3; }
        this.acc += dt;
        while (this.acc >= 1000 / 60) { this.update(1000 / 60); this.acc -= 1000 / 60; }
      }
      this.draw();
      this.renderHud();
      this.raf = requestAnimationFrame((tt) => this.frame(tt));
    }

    update(dt) {
      this.now = (this.now || 0) + dt;
      if (this.bot) this.bot(this, dt);
      this.phaseT += dt;
      const P = this.P, O = this.O;
      this.updateFx(dt);
      if (this.phase === 'fight') {
        this.clock -= dt / 1000;
        if (this.clock <= 0) { this.clock = 0; if (O.state !== 'down' && P.state !== 'down') { this.endRound(); return; } }
        this.updatePlayer(dt);
        this.updateOpp(dt);
      } else if (this.phase === 'down-opp' || this.phase === 'down-you') {
        this.updateCount(dt);
        this.updatePlayerPose(dt);
        this.updateOppPose(dt);
      } else {
        this.updatePlayerPose(dt);
        this.updateOppPose(dt);
      }
      this.crowdT = (this.crowdT || 0) + dt;
      if (Math.random() < (this.excite || 0.02) * dt / 16) this.bulbs.push({ x: rand(30, W - 30), y: rand(70, 230), life: 160, max: 160, size: rand(0.5, 1) });
      this.excite = Math.max(0.01, (this.excite || 0.02) * 0.995);
    }

    updatePlayer(dt) {
      const P = this.P, ys = this.cfg.you.stats;
      P.t += dt;
      if (P.stun > 0) P.stun -= dt;
      const dodgeLen = this.dodgeLen();
      if (P.state === 'dodgeL' || P.state === 'dodgeR' || P.state === 'duck') {
        if (P.t > dodgeLen + 120) { P.state = 'idle'; P.t = 0; if (P.queued) { const q = P.queued; P.queued = null; this.input(q, true); } }
      } else if (P.state === 'hurt') {
        if (P.t > (P.hurtLen || 380)) { P.state = 'idle'; P.t = 0; }
      } else if (P.state === 'clinch') {
        if (P.t > 950) { P.state = 'idle'; P.t = 0; this.flashCallout('BREAK!', 'dim'); this.ref.tx = 800; }
      } else if (P.state === 'punch') {
        const pu = P.punch;
        pu.t += dt;
        if (pu.phase === 'wind' && pu.t >= pu.wind) { pu.phase = 'reach'; pu.t = 0; }
        else if (pu.phase === 'reach' && pu.t >= pu.reach) { pu.phase = 'back'; pu.t = 0; if (!pu.checked) { pu.checked = true; this.resolvePunch(pu); } }
        else if (pu.phase === 'back' && pu.t >= pu.back) { P.state = 'idle'; P.t = 0; P.punch = null; if (P.queued) { const q = P.queued; P.queued = null; this.input(q, true); } }
      }
      if (P.recentPunches && this.now - (P.recentT || 0) > 700) P.recentPunches = 0;
      // stamina
      const regen = P.state === 'idle' || P.state === 'block' ? 11 : 4;
      P.sta = Math.min(P.staMax, P.sta + (regen * dt) / 1000 * (0.7 + ys.sta / 200) * (this.perks.has('secondwind') ? 1.3 : 1));
      this.updatePlayerPose(dt);
    }

    resolvePunch(pu) {
      const P = this.P, O = this.O, def = PUNCH[pu.kind];
      const pow = this.cfg.you.stats.pow;
      let dmg = def.dmg * (0.25 + pow / 75) * (pu.tired ? 0.5 : 1) * rand(0.85, 1.15);
      if (pu.kind === 'hay') dmg *= 1 + pu.stars * 0.9;
      const target = def.target;
      if (O.state === 'down' || O.state === 'out') return;
      let landed = false, counter = false, blocked = false;
      const st = O.state;
      if (st === 'clinch') return;
      if (st === 'cover') blocked = pu.kind !== 'hay' || Math.random() < 0.5;
      else if (st === 'recover' || st === 'taunt' || st === 'stagger') { landed = true; counter = st !== 'stagger'; }
      else if (st === 'hurt') {
        landed = true; dmg *= 0.75;
        O.chain = (O.chain || 0) + 1;
        if (O.chain >= (this.skill < 0.35 ? 3 : 2)) { landed = false; blocked = true; }
      } else if (st === 'tell') {
        landed = true; dmg *= 0.9;
        const interrupt = pu.kind === 'hay' ? 1 : pu.kind === 'cross' ? 0.4 : pu.kind === 'body' ? 0.32 : 0.2;
        if (Math.random() < interrupt * (1.15 - this.skill * 0.6)) { counter = true; O.state = 'stagger'; O.t = 0; this.flashCallout('INTERRUPTED!', 'good'); }
      } else if (st === 'strike') landed = Math.random() < 0.4;
      else {
        // Guarded and waiting. He blocks where his gloves are and slips what he can read.
        const slip = ({ counter: 0.36, boxer: 0.28, showman: 0.18 }[O.style] || 0.14) * (0.6 + this.skill) * (P.recentPunches > 2 ? 1.6 : 1);
        const guardBlocks = (O.guard === 'high' && target === 'head') || (O.guard === 'low' && target === 'body');
        if (pu.kind !== 'hay' && Math.random() < slip) {
          this.flashCallout('HE SLIPPED IT', 'dim'); this.sound && this.sound.play('whiff', 0.5);
          pu.back *= 1.5; O.blocked = 0;
          this.startAttack(pick(['jab', 'hookL', 'hookR']), 0.5);
          return;
        }
        if (guardBlocks && pu.kind !== 'hay') blocked = true;
        else landed = true;
        if (pu.kind === 'hay' && guardBlocks) dmg *= 0.6;
      }
      P.recentPunches = (P.recentPunches || 0) + 1; P.recentT = this.now;
      if (blocked) {
        O.blocked++; O.hp -= dmg * 0.06; P.combo = 0;
        this.sound && this.sound.play('block', 0.5);
        this.addFx('block', target === 'body' ? 480 : 260);
        if (O.state === 'hurt') { O.state = 'cover'; O.t = 0; }
        if (O.blocked >= 3 || Math.random() < 0.2 + this.skill * 0.25) { O.blocked = 0; O.chain = 0; this.startAttack(pick(['jab', 'jab', 'hookL', 'hookR', 'body']), 0.55); }
        return;
      }
      if (!landed) { this.sound && this.sound.play('whiff', 0.4); return; }
      O.blocked = 0;
      if (counter) { dmg *= O.countered ? 1.1 : (this.perks.has('counter') ? 2.05 : 1.6); O.countered = true; }
      if (pu.kind === 'body' && this.perks.has('body')) dmg *= 1.3;
      if (this.perks.has('killer') && (st === 'hurt' || st === 'stagger')) dmg *= 1.3;
      O.hp -= dmg; O.dmgTaken += dmg; P.dmgDealt += dmg; P.landed++; this.roundPts[0] += dmg;
      P.combo++;
      O.hitFlash = 1; O.squash = Math.min(1.4, 0.5 + dmg / 12); O.bruise = Math.min(1, O.bruise + dmg / 140);
      O.headX = (pu.hand === 'L' ? 1 : -1) * (6 + dmg * 1.6); O.headY = target === 'head' ? -8 - dmg : 4; O.tilt = (pu.hand === 'L' ? 1 : -1) * 0.04 * dmg;
      O.sta = Math.max(0, O.sta - dmg * (target === 'body' ? (this.perks.has('body') ? 2.4 : 1.6) : 0.7));
      if (counter && (st === 'recover' || st === 'taunt') && !O.starGiven) { O.starGiven = true; P.stars = Math.min(3, P.stars + 1); this.fx.push({ kind: 'starfly', x: 480 + O.x, y: 170, life: 650, max: 650 }); this.flashCallout(P.stars === 3 ? '★★★ CROWD ON ITS FEET' : '★ COUNTER!', 'star'); this.sound && this.sound.play('star', 0.6); }
      else if (P.combo >= (this.perks.has('crowd') ? 4 : 5) && P.combo % (this.perks.has('crowd') ? 4 : 5) === 0) { P.stars = Math.min(3, P.stars + 1); this.fx.push({ kind: 'starfly', x: 480 + O.x, y: 200, life: 650, max: 650 }); this.flashCallout('★ COMBO', 'star'); }
      const big = dmg > 9 || pu.kind === 'hay';
      this.impact(target === 'head' ? 480 + O.x + O.headX : 480 + O.x, target === 'head' ? 170 : 300, dmg, big, pu.kind === 'hay');
      if (big) this.say(pick(D.CALLS[this.era].big).replace('{N}', this.cfg.you.last));
      if (O.hp <= 0) { this.knockdown('opp', pu.kind === 'hay' || dmg > 12); return; }
      // How he reacts: counter windows stay open until they close on their own.
      if (st === 'idle' || st === 'hurt') {
        if (st === 'idle') O.chain = 0;
        O.state = 'hurt'; O.t = 0; O.hurtLen = 150 + dmg * 14;
        if (Math.random() < 0.45 + this.skill * 0.4) O.guard = target === 'head' ? 'high' : 'low';
      }
    }

    impact(x, y, dmg, big, hay) {
      this.hitstop = this.reduced ? 0 : big ? 90 : 45;
      if (!this.reduced) this.shake = Math.min(18, this.shake + dmg * (big ? 1.4 : 0.8));
      this.fx.push({ kind: 'pow', x: x + rand(-20, 20), y: y + rand(-20, 10), word: big ? pick(D.ONOMATOPOEIA) : pick(['POP', 'SNAP', 'THUD', 'SMACK']), life: big ? 650 : 380, max: big ? 650 : 380, size: big ? 1.4 : 0.85, rot: rand(-0.25, 0.25), hay });
      for (let i = 0; i < (big ? 14 : 6); i++) this.parts.push({ x, y, vx: rand(-4, 4), vy: rand(-5, 1), life: rand(300, 700), r: rand(2, 5) });
      if (big) { this.excite = 0.3; this.flash = this.reduced ? 0 : 0.16; this.fx.push({ kind: 'speed', x, y, life: 240, max: 240 }); this.popBulbs(3); }
      if (!this.reduced) this.cam.kick = Math.min(0.06, this.cam.kick + (big ? 0.035 : 0.012));
      this.fx.push({ kind: 'ring', x, y, life: 260, max: 260 });
      this.sound && this.sound.play('punch', clamp(dmg / 12, 0.3, 1.2));
      if (big) this.sound && this.sound.play('roar', 0.6);
    }

    popBulbs(n) {
      for (let i = 0; i < n; i++) {
        const ph = this.photogs[Math.floor(Math.random() * this.photogs.length)];
        const crowd = Math.random() < 0.5;
        this.bulbs.push({ x: crowd ? rand(40, W - 40) : ph.x + ph.dir * 6, y: crowd ? rand(80, 230) : 220, life: 140 + i * 25, max: 160 + i * 25, size: crowd ? rand(0.5, 0.9) : 1.3 });
      }
    }

    throwTape(n) {
      if (this.reduced) n = Math.round(n / 3);
      const cols = ['#f1e6cc', '#fff', '#e0a526', '#f4ecd6', '#b8231b'];
      for (let i = 0; i < n; i++) this.tape.push({ x: rand(-40, W + 40), y: rand(-200, -10), vx: rand(-0.4, 0.4), vy: rand(1, 2.6), rot: rand(0, 6.28), vr: rand(-0.08, 0.08), flip: rand(0, 6.28), vf: rand(0.05, 0.15), w: rand(5, 9), h: rand(10, 22), col: pick(cols), life: 6000 });
    }

    addFx(kind, y) { this.fx.push({ kind, x: 480 + this.O.x, y, life: 260, max: 260 }); }

    // ----- opponent AI -----
    updateOpp(dt) {
      const O = this.O, P = this.P;
      O.t += dt;
      const fatigue = 1 + (1 - O.sta / O.staMax) * 0.3;
      const assistSlow = this.assist === 'rookie' ? 1.3 : this.assist === 'champ' ? 0.88 : 1;
      O.sta = Math.min(O.staMax, O.sta + dt / 1000 * (O.state === 'idle' ? 6 : 2));
      if (O.state === 'idle') {
        O.guardT += dt;
        if (O.guardT > 1400 + Math.random() * 1800) { O.guardT = 0; O.guard = O.guard === 'high' ? 'low' : 'high'; }
        const aggression = { slugger: 1, boxer: 0.85, swarmer: 1.35, counter: 0.6, dirty: 1.1, showman: 0.9 }[O.style] || 1;
        if (O.t > O.wait) {
          if (O.combo.length) this.startAttack(O.combo.shift(), 0.75);
          else {
            const sig = this.cfg.opp.signature;
            if (sig && Math.random() < 0.2 && this.phaseT > 4000) { this.signature(sig); O.wait = rand(900, 1500); return; }
            const mv = weightedMove(BOOK[O.style] || BOOK.slugger);
            if (O.style === 'swarmer' && Math.random() < 0.45) O.combo = [pick(['jab', 'body', 'hookL', 'hookR'])];
            if (O.style === 'boxer' && mv === 'jab' && Math.random() < 0.5) O.combo = ['jab'];
            if (this.skill > 0.7 && Math.random() < 0.2) O.combo.push(pick(['hookL', 'hookR', 'upper']));
            this.startAttack(mv, 1);
          }
          O.wait = (rand(550, 1350) / aggression) * (1.2 - this.skill * 0.35) * (this.assist === 'rookie' ? 1.25 : 1);
        }
      } else if (O.state === 'tell') {
        const len = O.move.tellLen * fatigue * assistSlow;
        if (O.t >= len) {
          const mv = MOVES[O.move.kind];
          if (mv.feint) { O.state = 'idle'; O.t = 0; O.wait = 120; O.combo = ['jab']; return; }
          if (mv.taunt) { O.state = 'taunt'; O.t = 0; O.starGiven = false; this.flashCallout(pick(['C\'MON!', 'HIT ME!', 'TOO SLOW!']), 'taunt'); return; }
          O.state = 'strike'; O.t = 0; O.countered = false;
          const P = this.P, dl = this.dodgeLen();
          O.move.dodgedAtStart = P.t <= dl ? ({ dodgeL: 'L', dodgeR: 'R', duck: 'duck' })[P.state] || null : null;
          this.sound && this.sound.play('swing', 0.6);
        }
      } else if (O.state === 'strike') {
        const mv = MOVES[O.move.kind];
        if (O.t >= mv.strike && !O.move.checked) { O.move.checked = true; this.resolveAttack(O.move); }
        if (O.t >= mv.strike + 60) { O.state = 'recover'; O.t = 0; O.starGiven = false; }
      } else if (O.state === 'recover') {
        if (O.t >= O.recoverLen) { O.state = 'idle'; O.t = 0; O.wait = rand(250, 700); }
      } else if (O.state === 'hurt') {
        if (O.t >= (O.hurtLen || 300)) {
          O.state = 'idle'; O.t = 0; O.wait = rand(150, 500) * (1.2 - this.skill * 0.4);
          if ((O.chain || 0) >= 2 && Math.random() < 0.5 + this.skill * 0.4) { O.chain = 0; this.startAttack(pick(['jab', 'hookL', 'hookR', 'upper']), 0.6); }
        }
      } else if (O.state === 'cover') {
        if (O.t >= 650) { O.state = 'idle'; O.t = 0; O.chain = 0; if (Math.random() < 0.6 + this.skill * 0.3) this.startAttack(pick(['jab', 'hookL', 'hookR', 'body']), 0.55); }
      } else if (O.state === 'clinch') {
        if (O.t >= 950) { O.state = 'idle'; O.t = 0; O.wait = 700; }
      } else if (O.state === 'stagger') {
        if (O.t >= 650) { O.state = 'idle'; O.t = 0; O.wait = 400; }
      } else if (O.state === 'taunt') {
        if (O.t >= 900) { O.state = 'idle'; O.t = 0; O.wait = 300; }
      }
      this.updateOppPose(dt);
    }

    signature(sig) {
      const O = this.O;
      const name = { bolo: 'THE BOLO!', triple: 'THE TRIPLE!', rush: 'THE RUSH!', lowblow: '' }[sig];
      if (name) this.flashCallout(name, 'taunt');
      if (sig === 'bolo') this.startAttack('bolo', 1);
      else if (sig === 'lowblow') this.startAttack('lowblow', 1);
      else if (sig === 'triple') { this.startAttack('jab', 0.7); O.combo = ['jab', pick(['hookL', 'hookR'])]; }
      else if (sig === 'rush') { this.startAttack('body', 0.6); O.combo = ['body', 'body']; }
    }

    startAttack(kind, speed) {
      const O = this.O, mv = MOVES[kind];
      const skillMul = 1.25 - this.skill * 0.55;
      O.state = 'tell'; O.t = 0;
      const speedEdge = clamp(1 + (this.cfg.you.stats.spd - O.stats.spd) / 250, 0.8, 1.2) * (this.perks.has('general') ? 1.12 : 1);
      O.move = { kind, tellLen: mv.tell * skillMul * speedEdge * (speed || 1) * rand(0.92, 1.08), checked: false };
      O.used[kind] = (O.used[kind] || 0) + 1;
      if (kind !== 'jab') O.glint = 1;
      if (kind !== 'jab') this.sound && this.sound.play('tell', 0.4, kind);
    }

    resolveAttack(move) {
      const P = this.P, O = this.O, mv = MOVES[move.kind];
      const ys = this.cfg.you.stats;
      const dodgeLen = this.dodgeLen();
      let side = null;
      if (P.state === 'dodgeL' && P.t <= dodgeLen) side = 'L';
      if (P.state === 'dodgeR' && P.t <= dodgeLen) side = 'R';
      if (P.state === 'duck' && P.t <= dodgeLen) side = 'duck';
      // Forgiveness: a dodge that was live when the punch started counts too.
      if (!side && move.dodgedAtStart) side = move.dodgedAtStart;
      const whiffWindow = (720 - this.skill * 300) * (this.assist === 'rookie' ? 1.25 : 1);
      if (move.kind === 'lowblow') this.lowBlowCall();
      if (side && mv.avoid[side]) {
        O.recoverLen = whiffWindow * (mv.dmg > 9 ? 1.15 : 0.85);
        this.flashCallout(side === 'duck' ? 'DUCKED!' : 'SLIPPED!', 'good');
        this.sound && this.sound.play('whiff', 0.7);
        this.excite = 0.08;
        O.sta = Math.max(0, O.sta - mv.dmg * 0.6);
        return;
      }
      let dmg = mv.dmg * 1.25 * (0.5 + O.rating / 90) * (1.15 - ys.def / 260) * (1 + (O.stats.pow - ys.chn) / 200) * rand(0.85, 1.15);
      if (side === 'duck' && mv.duckPenalty) { dmg *= mv.duckPenalty; this.flashCallout('DUCKED INTO IT!', 'bad'); }
      const blocking = P.block && (P.state === 'idle' || P.state === 'block');
      if (blocking) {
        dmg *= mv.block;
        if (mv.guardBreak) { P.stun = 500; this.flashCallout('GUARD BROKEN!', 'bad'); }
        else if (dmg < 0.1) { this.flashCallout('BLOCKED', 'dim'); this.sound && this.sound.play('block', 0.6); P.sta = Math.max(0, P.sta - mv.dmg * 0.6); O.recoverLen = 260; return; }
        P.sta = Math.max(0, P.sta - mv.dmg);
      }
      O.recoverLen = 300;
      P.hp -= dmg; P.dmgTaken += dmg; this.roundPts[1] += dmg; O.landed++;
      P.combo = 0;
      P.state = 'hurt'; P.t = 0; P.hurtLen = 260 + dmg * 22; P.punch = null; P.queued = null;
      P.hitFlash = 1;
      if (!this.reduced) { this.shake = Math.min(22, this.shake + dmg * 1.3); this.flash = dmg > 12 ? 0.3 : 0; }
      this.hitstop = this.reduced ? 0 : dmg > 12 ? 80 : 40;
      this.fx.push({ kind: 'hurt', life: 300, max: 300 });
      this.sound && this.sound.play('punch', clamp(dmg / 12, 0.4, 1.3));
      if (P.stars > 0 && dmg > 9 && Math.random() < 0.5) { P.stars--; this.flashCallout('LOST A STAR', 'bad'); }
      if (P.hp <= 0) this.knockdown('you', dmg > 14);
    }

    lowBlowCall() {
      this.ref.tx = 720; setTimeout(() => { if (this.ref && !this.ref.counting) this.ref.tx = 800; }, 900);
      if (Math.random() < 0.4) { this.roundPts[1] -= 12; this.flashCallout('LOW BLOW! POINT DEDUCTED', 'good'); this.say('The referee takes a point for the low blow!'); }
      else { this.flashCallout('LOW BLOW! WARNING', 'bad'); this.say('The referee warns him about that low one.'); }
    }

    dodgeLen() {
      const ys = this.cfg.you.stats;
      return 470 + ys.spd * 1.6 + ys.def * 0.8 + (this.assist === 'rookie' ? 150 : 0) + (this.perks.has('shoulder') ? 90 : 0);
    }

    // ----- knockdowns -----
    knockdown(who, big) {
      const P = this.P, O = this.O;
      this.sound && this.sound.play('down', 1);
      this.sound && this.sound.play('roar', 1);
      this.excite = 0.6;
      if (!this.reduced && big) this.slowmo = 900;
      if (who === 'opp') {
        O.kd++; O.kdRound++; O.state = 'down'; O.t = 0; O.hp = 0; O.fallDir = O.tilt >= 0 ? 1 : -1; O.dusted = false;
        P.state = 'idle'; P.punch = null; P.queued = null;
        this.ref.tx = 690; this.ref.counting = true; this.ref.arm = 1; this.popBulbs(8);
        this.roundPts[0] += 15;
        this.say(pick(D.CALLS[this.era].down).replace('{N}', this.cfg.opp.last));
        this.flashCallout('DOWN!', 'big');
        const tko = O.kdRound >= 3;
        const getUpChance = clamp(0.92 - O.kd * 0.24 + (O.stats.chn - 50) / 200 - (big ? 0.12 : 0), 0.05, 0.95);
        const getsUp = !tko && Math.random() < getUpChance;
        this.count = { who: 'opp', n: 0, t: -700, upAt: getsUp ? Math.floor(rand(3, 9)) : 99, tko };
        this.phase = 'down-opp';
      } else {
        P.kd++; P.kdRound++; P.state = 'down'; P.t = 0; P.hp = 0; P.mash = 0; P.punch = null;
        this.ref.tx = 640; this.ref.counting = true; this.ref.arm = 1; this.popBulbs(4);
        this.roundPts[1] += 15;
        this.say(pick(D.CALLS[this.era].down).replace('{N}', this.cfg.you.last));
        this.flashCallout('YOU\'RE DOWN! MASH TO GET UP', 'bad');
        const need = Math.round((10 + P.kd * 8 - this.cfg.you.stats.chn / 9 - (this.cfg.you.heart || 50) / 25 + (big ? 3 : 0)) * (this.perks.has('ironjaw') ? 0.65 : 1));
        this.count = { who: 'you', n: 0, t: -600, need: Math.max(6, need), tko: P.kdRound >= 3 };
        this.phase = 'down-you';
      }
      this.fx.push({ kind: 'count', life: 1e9, max: 1e9 });
    }

    updateCount(dt) {
      const c = this.count; if (!c) return;
      c.t += dt;
      const step = 720;
      if (c.t >= step) {
        c.t -= step; c.n++; this.ref.arm = 0;
        this.sound && this.sound.play('count', 0.5 + c.n * 0.03);
        if (c.who === 'opp') {
          if (c.tko && c.n >= 2) return this.stoppage('W', 'TKO');
          if (c.n >= c.upAt) { this.getUp('opp'); return; }
          if (c.n >= 10) return this.stoppage('W', 'KO');
        } else {
          if (c.tko && c.n >= 2) return this.stoppage('L', 'TKO');
          if (this.P.mash >= c.need) { this.getUp('you'); return; }
          if (c.n >= 10) return this.stoppage('L', 'KO');
        }
      }
    }

    getUp(who) {
      const P = this.P, O = this.O;
      this.ref.counting = false; this.ref.tx = 800;
      this.fx = this.fx.filter((f) => f.kind !== 'count');
      if (who === 'opp') {
        O.hp = O.hpMax * clamp(0.75 - O.kd * 0.12, 0.25, 0.7); O.state = 'idle'; O.t = 0; O.wait = 900; O.fall = 0;
        this.flashCallout(`UP AT ${this.count.n}!`, 'dim');
      } else {
        P.hp = P.hpMax * clamp(0.55 - P.kd * 0.12 + (this.perks.has('ironjaw') ? 0.12 : 0), 0.15, 0.62); P.state = 'idle'; P.t = 0; P.stun = 600; P.sta = Math.max(P.sta, P.staMax * 0.4);
        this.flashCallout('YOU BEAT THE COUNT!', 'good');
        this.O.state = 'idle'; this.O.wait = 1200; this.O.t = 0;
      }
      this.count = null; this.phase = 'fight';
    }

    stoppage(res, method) {
      this.fx = this.fx.filter((f) => f.kind !== 'count');
      this.count = null;
      this.ref.counting = false; this.ref.wave = 1;
      this.koText = { t: 0, text: method === 'KO' ? 'K.O.!' : 'T.K.O.!', lost: res !== 'W' };
      if (!this.reduced) { this.cam.focus = 0.001; this.cam.fx = 480 + this.O.x; this.cam.fy = res === 'W' ? 420 : 300; }
      if (res === 'W') { this.throwTape(160); this.popBulbs(14); }
      if (res === 'W') { this.O.state = 'out'; this.say(`It's all over! ${this.cfg.you.last} wins by ${method === 'KO' ? 'knockout' : 'stoppage'}!`); }
      else { this.say(`It's all over. ${this.cfg.opp.last} wins by ${method === 'KO' ? 'knockout' : 'stoppage'}.`); }
      this.endFight(res, method, 'stoppage');
    }

    // ----- poses -----
    updatePlayerPose(dt) {
      const P = this.P, k = 1 - Math.pow(0.0001, dt / 1000 * 3.2), kFast = 1 - Math.pow(0.000001, dt / 1000 * 4);
      let tx = 0, ty = 0, lean = 0;
      let L = { x: 372, y: 478, s: 0.95 }, R = { x: 588, y: 478, s: 0.95 };
      if (P.state === 'dodgeL') { tx = -175; lean = -0.16; L = { x: 300, y: 450, s: 1 }; R = { x: 470, y: 450, s: 1 }; }
      else if (P.state === 'dodgeR') { tx = 175; lean = 0.16; L = { x: 490, y: 450, s: 1 }; R = { x: 660, y: 450, s: 1 }; }
      else if (P.state === 'duck') { ty = 95; L = { x: 395, y: 510, s: 1 }; R = { x: 565, y: 510, s: 1 }; }
      else if (P.state === 'hurt') { ty = 20; lean = Math.sin(P.t / 40) * 0.05; L = { x: 330, y: 500, s: 1 }; R = { x: 630, y: 500, s: 1 }; }
      else if (P.state === 'down') { ty = 260; L = { x: 300, y: 620, s: 1 }; R = { x: 660, y: 620, s: 1 }; }
      else if (P.block) { L = { x: 430, y: 400, s: 1.18 }; R = { x: 530, y: 400, s: 1.18 }; }
      if (P.state === 'clinch') { ty = -30; L = { x: 420, y: 350, s: 0.7 }; R = { x: 540, y: 350, s: 0.7 }; }
      if (this.phase === 'down-opp' || (this.phase === 'over' && this.result && this.result.result === 'W')) { tx = -250; lean = -0.05; L = { x: 160, y: 470, s: 0.95 }; R = { x: 330, y: 470, s: 0.95 }; if (this.phase === 'over') { L = { x: 170, y: 300, s: 0.85 }; R = { x: 330, y: 290, s: 0.85 }; } }
      if (P.state === 'punch' && P.punch) {
        const pu = P.punch, O = this.O;
        const head = PUNCH[pu.kind].target === 'head';
        const target = { x: 480 + O.x + (pu.hand === 'L' ? -14 : 14), y: head ? 175 : 300, s: 0.42 };
        const rest = pu.hand === 'L' ? { x: 372, y: 478, s: 0.95 } : { x: 588, y: 478, s: 0.95 };
        const wound = pu.kind === 'hay' ? { x: rest.x + 70, y: rest.y + 60, s: 1.1 } : { x: rest.x + (pu.hand === 'L' ? -20 : 20), y: rest.y + 25, s: 1.05 };
        let g;
        if (pu.phase === 'wind') g = mix(rest, wound, ease(pu.t / pu.wind));
        else if (pu.phase === 'reach') g = mix(wound, target, ease(pu.t / pu.reach));
        else g = mix(target, rest, ease(pu.t / pu.back));
        if (pu.hand === 'L') L = g; else R = g;
        lean = pu.hand === 'L' ? -0.05 : 0.07;
        if (pu.kind === 'body') ty = 40;
        P.gL = pu.hand === 'L' ? g : lerpG(P.gL, L, k);
        P.gR = pu.hand === 'R' ? g : lerpG(P.gR, R, k);
        if (pu.phase === 'reach') this.trails.push({ who: 'P', x: g.x, y: g.y, s: g.s, life: 110 });
      } else {
        P.gL = lerpG(P.gL, L, kFast); P.gR = lerpG(P.gR, R, kFast);
      }
      P.x = lerp(P.x, tx, kFast); P.y = lerp(P.y, ty, kFast); P.lean = lerp(P.lean, lean, kFast);
      P.hitFlash = Math.max(0, P.hitFlash - dt / 250);
    }

    updateOppPose(dt) {
      const O = this.O;
      const k = 1 - Math.pow(0.0005, dt / 1000 * 3), kF = 1 - Math.pow(0.000001, dt / 1000 * 6);
      const hx = 480, headY = 170, chest = 260;
      let L = { x: hx - 58, y: headY + 30, s: 1 }, R = { x: hx + 58, y: headY + 30, s: 1 };
      let lean = 0, crouch = 0, sway = Math.sin(this.now / 380) * 10, fast = false;
      if (O.guard === 'low') { L = { x: hx - 78, y: chest + 70, s: 1 }; R = { x: hx + 78, y: chest + 70, s: 1 }; }
      const st = O.state, t = O.t;
      if (this.phase === 'intro') { L = { x: hx - 130, y: headY - 40 + Math.sin(this.now / 300) * 10, s: 0.95 }; R = { x: hx + 130, y: headY - 40 - Math.sin(this.now / 300) * 10, s: 0.95 }; crouch = -8; }
      else if (st === 'tell' && O.move) {
        const kind = O.move.kind, p = ease(t / O.move.tellLen);
        const shiver = Math.sin(this.now / 30) * 3 * p;
        if (kind === 'jab') { L = { x: hx - 40, y: headY + 45, s: 0.9 }; lean = -0.03 * p; }
        else if (kind === 'hookL' || (kind === 'feint' && (O.move.side || (O.move.side = pick(['L', 'R']))) === 'L')) { L = { x: hx - 205 + shiver, y: headY - 5, s: 0.82 }; lean = -0.14 * p; sway = -30 * p; }
        else if (kind === 'hookR' || kind === 'feint') { R = { x: hx + 205 + shiver, y: headY - 5, s: 0.82 }; lean = 0.14 * p; sway = 30 * p; }
        else if (kind === 'upper') { R = { x: hx + 70 + shiver, y: chest + 150, s: 0.85 }; crouch = 40 * p; lean = 0.05; }
        else if (kind === 'body') { L = { x: hx - 95, y: chest + 120 + shiver, s: 0.85 }; crouch = 55 * p; }
        else if (kind === 'haymaker') { R = { x: hx + 150 + shiver, y: headY - 105, s: 0.78 }; lean = 0.2 * p; crouch = -18 * p; }
        else if (kind === 'taunt') { L = { x: hx - 150, y: chest + 120, s: 0.9 }; R = { x: hx + 150, y: chest + 120, s: 0.9 }; crouch = -10; }
        else if (kind === 'bolo') { const a = t / 85; R = { x: hx + 150 + Math.cos(a) * 70, y: chest + 70 + Math.sin(a) * 70, s: 0.85 }; lean = 0.08; sway = 20 * p; }
        else if (kind === 'lowblow') { L = { x: hx - 60, y: chest + 175, s: 0.85 }; crouch = 30 * p; }
        fast = true;
      } else if (st === 'strike' && O.move) {
        const kind = O.move.kind, p = ease(t / MOVES[kind].strike);
        const hit = { x: 480 + this.P.x * 0.3, y: 430, s: 2.3 };
        if (kind === 'jab') L = mix({ x: hx - 40, y: headY + 45, s: 0.9 }, { x: hx - 10, y: 400, s: 2 }, p);
        else if (kind === 'hookL') L = arc({ x: hx - 205, y: headY - 5, s: 0.82 }, hit, p, -1);
        else if (kind === 'hookR') R = arc({ x: hx + 205, y: headY - 5, s: 0.82 }, hit, p, 1);
        else if (kind === 'upper') { R = mix({ x: hx + 70, y: chest + 150, s: 0.85 }, { x: hx + 15, y: 380, s: 2.1 }, p); crouch = 40 * (1 - p); }
        else if (kind === 'body') { L = mix({ x: hx - 95, y: chest + 120, s: 0.85 }, { x: hx - 10, y: 540, s: 2.1 }, p); crouch = 50; }
        else if (kind === 'haymaker') R = arc({ x: hx + 150, y: headY - 105, s: 0.78 }, { x: hx - 10, y: 440, s: 2.6 }, p, 1);
        else if (kind === 'bolo') R = arc({ x: hx + 160, y: chest + 140, s: 0.85 }, { x: hx + 20, y: 410, s: 2.4 }, p, 1);
        else if (kind === 'lowblow') L = mix({ x: hx - 60, y: chest + 175, s: 0.85 }, { x: hx - 5, y: 575, s: 2.0 }, p);
        lean = (kind === 'hookL' ? 0.12 : kind === 'hookR' || kind === 'haymaker' ? -0.12 : 0) * p;
        fast = true;
      } else if (st === 'recover' && O.move) {
        // overextended: the glove that just threw hangs out there
        const kind = O.move.kind;
        if (kind === 'hookL' || kind === 'jab' || kind === 'body') L = { x: hx + 60, y: chest + 90, s: 1.25 };
        else R = { x: hx - 60, y: chest + 90, s: 1.25 };
        lean = kind === 'hookL' ? 0.18 : -0.18; crouch = 10;
      } else if (st === 'hurt' || st === 'stagger') {
        L = { x: hx - 120, y: chest + 60, s: 0.95 }; R = { x: hx + 120, y: chest + 60, s: 0.95 };
        sway = Math.sin(t / 60) * 14;
      } else if (st === 'clinch') {
        L = { x: hx - 70, y: chest + 150, s: 0.9 }; R = { x: hx + 70, y: chest + 150, s: 0.9 }; crouch = 26; lean = Math.sin(t / 120) * 0.04;
      } else if (st === 'cover') {
        L = { x: hx - 30, y: headY + 20, s: 1.15 }; R = { x: hx + 30, y: headY + 24, s: 1.15 }; crouch = 14;
      } else if (st === 'taunt') {
        L = { x: hx - 150, y: chest + 140, s: 0.9 }; R = { x: hx + 150, y: chest + 140, s: 0.9 }; crouch = -12; sway = Math.sin(t / 90) * 18;
      } else if (st === 'down' || st === 'out') {
        L = { x: hx - 170, y: chest + 240, s: 0.9 }; R = { x: hx + 170, y: chest + 240, s: 0.9 };
      }
      O.gL = fast ? lerpG(O.gL, L, kF) : lerpG(O.gL, L, k);
      O.gR = fast ? lerpG(O.gR, R, kF) : lerpG(O.gR, R, k);
      if (st === 'strike') { O.gL = L.x !== undefined && (O.move && ['jab', 'hookL', 'body', 'lowblow'].includes(O.move.kind)) ? L : O.gL; O.gR = (O.move && ['hookR', 'upper', 'haymaker', 'bolo'].includes(O.move.kind)) ? R : O.gR; }
      O.lean = lerp(O.lean, lean, k); O.crouch = lerp(O.crouch, crouch, k);
      O.sway = lerp(O.sway, sway, k);
      O.x = O.sway;
      O.headX = lerp(O.headX, 0, k * 0.8); O.headY = lerp(O.headY, 0, k * 0.8); O.tilt = lerp(O.tilt, 0, k * 0.8);
      O.hitFlash = Math.max(0, O.hitFlash - dt / 200);
      const bouncing = st === 'idle' || st === 'tell' || st === 'cover' || this.phase === 'intro';
      O.bob = lerp(O.bob || 0, bouncing ? Math.sin((this.now || 0) / 165) * 5 : 0, k);
      if (st === 'strike' && O.move) { const g = ['jab', 'hookL', 'body', 'lowblow'].includes(O.move.kind) ? O.gL : O.gR; this.trails.push({ who: 'O', x: g.x, y: g.y, s: g.s, life: 120 }); }
      if (st === 'down' || st === 'out') O.fall = Math.min(1, O.fall + dt / 600); else O.fall = Math.max(0, O.fall - dt / 300);
    }

    updateFx(dt) {
      this.fx = this.fx.filter((f) => (f.life -= dt) > 0);
      for (const p of this.parts) { p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.life -= dt; }
      this.parts = this.parts.filter((p) => p.life > 0);
      this.bulbs = this.bulbs.filter((b) => (b.life -= dt) > 0);
      this.shake *= Math.pow(0.002, dt / 1000);
      this.flash = Math.max(0, this.flash - dt / 400);
      const f = dt / 16.67;
      for (const sm of this.smoke) { sm.x += sm.vx * f; if (sm.x < -200) sm.x = W + 200; if (sm.x > W + 200) sm.x = -200; }
      for (const m of this.motes) { m.x += m.vx * f; m.y += m.vy * f + Math.sin((this.now || 0) / 900 + m.ph) * 0.05; if (m.y < 40) m.y = 420; if (m.y > 420) m.y = 40; if (m.x < 200) m.x = 760; if (m.x > 760) m.x = 200; }
      for (const p of this.puffs) { p.x += p.vx * f; p.y += p.vy * f; p.r += 0.05 * f * (p.crowd ? 1 : 3); p.life -= dt; }
      this.puffs = this.puffs.filter((p) => p.life > 0);
      for (const tp of this.tape) { tp.x += (tp.vx + Math.sin(tp.flip) * 0.4) * f; tp.y += tp.vy * f; tp.rot += tp.vr * f; tp.flip += tp.vf * f; tp.life -= dt; }
      this.tape = this.tape.filter((tp) => tp.life > 0 && tp.y < H + 30);
      for (const tr of this.trails) tr.life -= dt;
      this.trails = this.trails.filter((tr) => tr.life > 0);
      const cam = this.cam;
      cam.kick *= Math.pow(0.0005, dt / 1000);
      if (cam.focus > 0) cam.focus = Math.min(1, cam.focus + dt / 700);
      const R = this.ref;
      R.x = lerp(R.x, R.tx, 1 - Math.pow(0.02, dt / 1000));
      if (R.counting) R.arm = Math.min(1, R.arm + dt / 260);
      if (this.card) { this.card.t += dt; if (this.card.t >= this.card.dur) this.card = null; }
      if (this.koText) this.koText.t += dt;
      // heartbeat when hurt
      const P = this.P;
      if (this.phase === 'fight' && P.hp < P.hpMax * 0.3) {
        this.beatT += dt;
        const gap = 600 + (P.hp / (P.hpMax * 0.3)) * 450;
        if (this.beatT > gap) { this.beatT = 0; this.beat = 1; this.sound && this.sound.play('heart', 0.7); }
      }
      this.beat = Math.max(0, (this.beat || 0) - dt / 380);
      // out of breath
      if (this.phase === 'fight' && P.sta < P.staMax * 0.25 && Math.random() < dt / 520) this.puffs.push({ x: 480 + P.x + rand(-10, 10), y: 430 + P.y, r: 6, vy: -0.7, vx: rand(-0.3, 0.3), life: 700, max: 700, a: 0.35 });
      // the fallen fighter kicks up resin dust
      const O = this.O;
      if ((O.state === 'down' || O.state === 'out') && O.fall > 0.75 && !O.dusted) { O.dusted = true; for (let i = 0; i < 16; i++) this.puffs.push({ x: 480 + O.x + rand(-140, 140), y: 590 + rand(-8, 8), r: rand(6, 14), vy: rand(-0.6, -0.2), vx: rand(-1, 1), life: 900, max: 900, a: 0.4 }); if (!this.reduced) this.shake = Math.max(this.shake, 10); this.sound && this.sound.play('down', 0.6); }
      O.glint = Math.max(0, (O.glint || 0) - dt / 260);
      O.squash = Math.max(0, (O.squash || 0) - dt / 220);
    }

    // ----- HUD -----
    renderHud(force) {
      const P = this.P, O = this.O, h = this.hud;
      const pct = (v, m) => `${clamp((v / m) * 100, 0, 100).toFixed(1)}%`;
      h.youHp.style.width = pct(P.hp, P.hpMax); h.oppHp.style.width = pct(O.hp, O.hpMax);
      this.ghostP = force ? P.hp : lerp(this.ghostP == null ? P.hp : this.ghostP, P.hp, 0.04);
      this.ghostO = force ? O.hp : lerp(this.ghostO == null ? O.hp : this.ghostO, O.hp, 0.04);
      h.youHpGhost.style.width = pct(Math.max(P.hp, this.ghostP), P.hpMax); h.oppHpGhost.style.width = pct(Math.max(O.hp, this.ghostO), O.hpMax);
      h.youSta.style.width = pct(P.sta, P.staMax); h.oppSta.style.width = pct(O.sta, O.staMax);
      h.youSta.parentElement.classList.toggle('low', P.sta < 12);
      const secs = Math.ceil((this.clock / this.roundLen) * 180);
      const label = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      if (h.clock.textContent !== label) h.clock.textContent = label;
      const rl = `ROUND ${this.round}`;
      if (h.round.textContent !== rl) h.round.textContent = rl;
      h.stars.forEach((s, i) => s.classList.toggle('on', i < P.stars));
    }

    // ----- drawing -----
    // Static parts of the arena are painted once into offscreen layers; only the living parts redraw.
    buildLayers() {
      const mk = () => { const cv = document.createElement('canvas'); cv.width = W * this.dpr; cv.height = H * this.dpr; const x = cv.getContext('2d'); x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); return [cv, x]; };
      const [back, b] = mk(); this.drawBackdrop(b); this.layerBack = back;
      const [ring, r] = mk(); this.drawRing(r); this.layerRing = ring;
    }

    drawBackdrop(c) {
      const era = this.era;
      const bg = c.createLinearGradient(0, 0, 0, H);
      if (era === 'tv') { bg.addColorStop(0, '#08080a'); bg.addColorStop(0.55, '#1c1c20'); bg.addColorStop(1, '#2e2e33'); }
      else if (era === 'newsreel') { bg.addColorStop(0, '#120f0a'); bg.addColorStop(0.55, '#2a2218'); bg.addColorStop(1, '#3d3122'); }
      else { bg.addColorStop(0, '#1a0604'); bg.addColorStop(0.55, '#4a140b'); bg.addColorStop(1, '#6e2213'); }
      c.fillStyle = bg; c.fillRect(0, 0, W, H);
      // roof trusses
      c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 6;
      for (let x = -40; x < W + 40; x += 120) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 60, 48); c.lineTo(x + 120, 0); c.stroke(); }
      c.beginPath(); c.moveTo(0, 48); c.lineTo(W, 48); c.stroke();
      // the far balcony: a sea of tiny heads
      for (let row = 0; row < 4; row++) {
        const y = 58 + row * 11;
        for (let x = 4 + (row % 2) * 6; x < W; x += 12) {
          const v = Math.sin(x * 12.9898 + row * 78.233) * 43758.5453; const r = v - Math.floor(v);
          c.fillStyle = era === 'poster' ? `rgba(${40 + r * 30},${12 + r * 10},${8 + r * 6},1)` : `rgba(${34 + r * 26},${30 + r * 22},${26 + r * 18},1)`;
          c.beginPath(); c.arc(x + r * 4, y + r * 3, 4.2, 0, Math.PI * 2); c.fill();
        }
      }
      c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, 100, W, 5);
      c.fillStyle = era === 'poster' ? 'rgba(224,165,38,.35)' : 'rgba(210,210,210,.25)'; c.fillRect(0, 100, W, 1.5);
      // hanging banners
      const venue = String(this.cfg.venue || 'Fight Night').split(',')[0].replace(/^the /i, '').toUpperCase();
      const words = this.era === 'tv' ? [venue, 'LIVE', 'FRIDAY FIGHTS'] : this.era === 'newsreel' ? [venue, 'BUY WAR BONDS', 'BOXING'] : [venue, 'BOXING', 'TONIGHT'];
      [[150, 0], [480, 1], [810, 2]].forEach(([x, i]) => {
        const w = i === 1 ? 300 : 150, h = 34;
        c.fillStyle = i === 1 ? (era === 'tv' ? '#e8664a' : '#b8231b') : era === 'tv' ? '#2f8f87' : '#1f3f8f';
        c.strokeStyle = '#0b0806'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(x - w / 2, 8); c.lineTo(x + w / 2, 8); c.lineTo(x + w / 2, 8 + h); c.lineTo(x, 8 + h + 10); c.lineTo(x - w / 2, 8 + h); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#f1e6cc'; c.font = `400 ${i === 1 ? 20 : 15}px "Alfa Slab One", Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        let txt = words[i]; while (c.measureText(txt).width > w - 16 && txt.length > 4) txt = txt.slice(0, -1);
        c.fillText(txt, x, 8 + h / 2 + 1);
      });
      // warm glow from the ring lights
      const g = c.createRadialGradient(480, 160, 20, 480, 160, 520);
      g.addColorStop(0, era === 'poster' ? 'rgba(255,214,150,.30)' : 'rgba(255,240,215,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }

    drawRing(c) {
      const era = this.era, poster = era === 'poster';
      // apron band behind the far ropes with the venue painted on it
      c.fillStyle = poster ? '#1f3f8f' : era === 'tv' ? '#2f8f87' : '#3b3a30';
      c.fillRect(96, 322, 768, 24);
      c.fillStyle = '#f1e6cc'; c.font = '400 15px "Alfa Slab One", Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const venue = String(this.cfg.venue || '').split(',')[0].replace(/^the /i, '').toUpperCase();
      c.fillText(venue ? `★ ${venue} ★` : '★ FIGHT NIGHT ★', 480, 335);
      // the canvas floor
      const fg = c.createLinearGradient(0, 345, 0, 610);
      fg.addColorStop(0, poster ? '#d9c79c' : '#cfc8b8'); fg.addColorStop(0.5, poster ? '#efe1bd' : '#e3ddcf'); fg.addColorStop(1, poster ? '#e6d4a8' : '#d6d0c2');
      c.fillStyle = fg;
      c.beginPath(); c.moveTo(110, 345); c.lineTo(850, 345); c.lineTo(990, 610); c.lineTo(-30, 610); c.closePath(); c.fill();
      // pool of light in the middle of the ring
      const lg = c.createRadialGradient(480, 470, 30, 480, 470, 380);
      lg.addColorStop(0, 'rgba(255,248,225,.55)'); lg.addColorStop(1, 'rgba(255,248,225,0)');
      c.fillStyle = lg; c.fillRect(0, 345, W, 265);
      // scuffs, resin and old stains
      const seed = (n) => { const v = Math.sin(n * 91.7) * 9999; return v - Math.floor(v); };
      for (let i = 0; i < 26; i++) {
        const x = 120 + seed(i) * 720, y = 360 + seed(i + 50) * 230, r = 6 + seed(i + 99) * 30;
        const sg = c.createRadialGradient(x, y, 0, x, y, r);
        sg.addColorStop(0, `rgba(90,60,30,${0.05 + seed(i + 7) * 0.08})`); sg.addColorStop(1, 'rgba(90,60,30,0)');
        c.fillStyle = sg; c.beginPath(); c.ellipse(x, y, r * 1.6, r * 0.6, 0, 0, Math.PI * 2); c.fill();
      }
      c.strokeStyle = 'rgba(23,19,15,.14)'; c.lineWidth = 2;
      for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(110 - i * 28, 345 + i * 53); c.lineTo(850 + i * 28, 345 + i * 53); c.stroke(); }
      for (let i = -4; i <= 4; i++) { c.beginPath(); c.moveTo(480 + i * 92, 345); c.lineTo(480 + i * 150, 610); c.stroke(); }
      // posts and turnbuckles
      const pad = poster ? ['#b8231b', '#f1e6cc', '#1f3f8f'] : era === 'tv' ? ['#e8664a', '#f5efdd', '#2f8f87'] : ['#8a2a1c', '#e9e2cc', '#2b3a5c'];
      for (const x of [100, 860]) {
        c.fillStyle = '#17130f'; c.fillRect(x - 11, 196, 22, 152);
        c.fillStyle = poster ? '#c9971f' : '#9a9a9a'; c.fillRect(x - 8, 199, 16, 146);
        c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x - 5, 201, 4, 142);
        [232, 270, 308].forEach((y, i) => { c.fillStyle = pad[i]; c.strokeStyle = '#17130f'; c.lineWidth = 3; c.beginPath(); c.roundRect ? c.roundRect(x - 15, y - 13, 30, 26, 6) : c.rect(x - 15, y - 13, 30, 26); c.fill(); c.stroke(); });
      }
      // ropes with a little sag, sleeves, and a highlight on top
      const ropeCols = poster ? ['#b8231b', '#f1e6cc', '#1f3f8f'] : era === 'tv' ? ['#f2f2f2', '#e8664a', '#f2f2f2'] : ['#e5e0d3', '#c9c3b5', '#e5e0d3'];
      [232, 270, 308].forEach((y, i) => {
        const path = () => { c.beginPath(); c.moveTo(108, y); c.quadraticCurveTo(480, y + 9, 852, y); };
        c.strokeStyle = '#17130f'; c.lineWidth = 9; path(); c.stroke();
        c.strokeStyle = ropeCols[i]; c.lineWidth = 5.5; path(); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(108, y - 1.5); c.quadraticCurveTo(480, y + 7.5, 852, y - 1.5); c.stroke();
        for (const sx of [300, 480, 660]) { c.fillStyle = '#f1e6cc'; c.strokeStyle = '#17130f'; c.lineWidth = 2; c.fillRect(sx - 5, y - 4 + 6 * (1 - Math.pow((sx - 480) / 372, 2)) * 1.0, 10, 9); }
      });
      // ring lamps hanging over the ring
      for (const x of [300, 660]) {
        c.strokeStyle = '#0b0806'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 22); c.stroke();
        c.fillStyle = '#22201c'; c.beginPath(); c.moveTo(x - 46, 52); c.lineTo(x - 16, 20); c.lineTo(x + 16, 20); c.lineTo(x + 46, 52); c.closePath(); c.fill();
        c.fillStyle = '#fff6dc'; c.beginPath(); c.ellipse(x, 52, 46, 7, 0, 0, Math.PI * 2); c.fill();
      }
    }

    makeAmbience() {
      this.smoke = Array.from({ length: 7 }, () => ({ x: rand(0, W), y: rand(60, 360), r: rand(90, 190), vx: rand(-0.12, 0.12), a: rand(0.035, 0.08) }));
      this.motes = Array.from({ length: 34 }, () => ({ x: rand(220, 740), y: rand(40, 420), vy: rand(-0.06, 0.06), vx: rand(-0.05, 0.05), ph: rand(0, 6.28) }));
      this.embers = this.crowd.filter((p) => p.cigar);
      this.ref = { x: 800, tx: 800, arm: 0, wave: 0, look: { skin: 1, hair: 5, cut: 'crop' } };
      this.tape = []; this.trails = []; this.puffs = []; this.cam = { z: 1, kick: 0, fx: 480, fy: 300, focus: 0 };
      this.beat = 0; this.beatT = 0; this.card = null; this.koText = null;
    }

    draw() {
      const c = this.ctx, dpr = this.dpr;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sx = this.shake ? rand(-this.shake, this.shake) : 0, sy = this.shake ? rand(-this.shake, this.shake) * 0.6 : 0;
      const cam = this.cam, z = 1 + cam.kick + cam.focus * 0.16;
      c.save();
      c.translate(480 + sx, 300 + sy); c.scale(z, z);
      c.translate(-(480 + (cam.fx - 480) * cam.focus * 0.6), -(300 + (cam.fy - 300) * cam.focus * 0.6));
      this.drawArena(c);
      this.drawReferee(c);
      this.drawOpponent(c);
      this.drawTellAssist(c);
      this.drawPlayer(c);
      this.drawFx(c);
      this.drawAtmosphere(c);
      c.restore();
      if (this.flash > 0) { c.fillStyle = `rgba(255,250,235,${this.flash})`; c.fillRect(0, 0, W, H); }
      this.drawVignette(c);
      if (this.count) this.drawCount(c);
      if (this.phase === 'down-you') this.drawMash(c);
      if (this.card) this.drawCard(c);
      if (this.koText) this.drawKO(c);
    }

    drawArena(c) {
      c.drawImage(this.layerBack, 0, 0, W, H);
      const era = this.era, t = this.now || 0, ex = this.excite || 0;
      for (const p of this.crowd) {
        const bob = Math.sin(t / 300 + p.bob) * (1.5 + ex * 26) * (p.row === 4 ? 1.2 : 1);
        const s = p.s, x = p.x, y = p.y + bob;
        const base = era === 'poster' ? shade('#2c0e09', p.shade) : shade('#26221d', p.shade);
        // body
        c.fillStyle = base;
        c.beginPath(); c.moveTo(x - 24 * s, y + 52 * s); c.quadraticCurveTo(x - 22 * s, y + 14 * s, x, y + 12 * s); c.quadraticCurveTo(x + 22 * s, y + 14 * s, x + 24 * s, y + 52 * s); c.fill();
        if (p.collar) { c.fillStyle = 'rgba(241,230,204,.25)'; c.beginPath(); c.moveTo(x - 5 * s, y + 13 * s); c.lineTo(x, y + 24 * s); c.lineTo(x + 5 * s, y + 13 * s); c.fill(); }
        // arms up when the place goes wild
        if (p.arms && ex > 0.18) {
          c.strokeStyle = base; c.lineWidth = 6 * s; c.lineCap = 'round';
          const up = Math.min(1, (ex - 0.18) * 4);
          c.beginPath(); c.moveTo(x - 15 * s, y + 20 * s); c.lineTo(x - 22 * s, y + (20 - 38 * up) * s); c.moveTo(x + 15 * s, y + 20 * s); c.lineTo(x + 22 * s, y + (20 - 38 * up) * s); c.stroke();
          if (p.hatWave && up > 0.6) { c.fillStyle = base; c.fillRect(x + 12 * s, y - 26 * s, 22 * s, 6 * s); }
        }
        // head
        const head = era === 'poster' ? shade('#4a1d12', p.shade) : shade('#3d3830', p.shade);
        c.fillStyle = head; c.beginPath(); c.ellipse(x, y, 10.5 * s, 12.5 * s, 0, 0, Math.PI * 2); c.fill();
        if (p.row >= 3) { c.fillStyle = era === 'poster' ? 'rgba(255,190,130,.22)' : 'rgba(235,230,220,.18)'; c.beginPath(); c.ellipse(x + 2 * s, y + 3 * s, 7 * s, 8 * s, 0, 0, Math.PI * 2); c.fill(); }
        // hats
        c.fillStyle = shade(base, -0.25);
        if (p.hat === 'fedora') { c.beginPath(); c.ellipse(x, y - 8 * s, 17 * s, 4 * s, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.moveTo(x - 10 * s, y - 8 * s); c.lineTo(x - 9 * s, y - 20 * s); c.quadraticCurveTo(x, y - 16 * s, x + 9 * s, y - 20 * s); c.lineTo(x + 10 * s, y - 8 * s); c.fill(); c.fillStyle = 'rgba(241,230,204,.2)'; c.fillRect(x - 10 * s, y - 11 * s, 20 * s, 2.5 * s); }
        else if (p.hat === 'cap') { c.beginPath(); c.ellipse(x, y - 7 * s, 12 * s, 8 * s, 0, Math.PI, 0); c.fill(); c.fillRect(x - 2 * s, y - 8 * s, 15 * s, 3 * s); }
        else if (p.hat === 'cloche') { c.beginPath(); c.ellipse(x, y - 5 * s, 13 * s, 11 * s, 0, Math.PI, 0); c.fill(); }
        // rim light from the ring
        c.strokeStyle = era === 'poster' ? 'rgba(255,190,120,.35)' : 'rgba(255,255,255,.18)'; c.lineWidth = 1.5;
        c.beginPath(); c.ellipse(x, y, 10.5 * s, 12.5 * s, 0, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      }
      // cigar embers and their smoke
      for (const p of this.embers) {
        const glow = 0.5 + 0.5 * Math.sin(t / 400 + p.bob * 3);
        const ex2 = p.x + 7 * p.s, ey2 = p.y + 6 * p.s + Math.sin(t / 300 + p.bob) * (1.5 + ex * 26);
        c.fillStyle = `rgba(255,${120 + glow * 80},40,${0.5 + glow * 0.5})`; c.beginPath(); c.arc(ex2, ey2, 1.8 * p.s, 0, Math.PI * 2); c.fill();
        if (Math.random() < 0.02) this.puffs.push({ x: ex2, y: ey2, r: 3, vy: -0.25, vx: rand(-0.08, 0.08), life: 2400, max: 2400, a: 0.12, crowd: true });
      }
      // flashbulbs: ringside photographers and the crowd
      for (const b of this.bulbs) {
        const a = b.life / b.max;
        const gg = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, 60 * b.size);
        gg.addColorStop(0, `rgba(255,255,255,${a})`); gg.addColorStop(0.25, `rgba(255,250,235,${a * 0.5})`); gg.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = gg; c.fillRect(b.x - 60 * b.size, b.y - 60 * b.size, 120 * b.size, 120 * b.size);
        if (a > 0.6) { c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = 2; c.beginPath(); c.moveTo(b.x - 18 * b.size, b.y); c.lineTo(b.x + 18 * b.size, b.y); c.moveTo(b.x, b.y - 18 * b.size); c.lineTo(b.x, b.y + 18 * b.size); c.stroke(); }
      }
      // ringside photographers with their big flash reflectors
      for (const ph of this.photogs) {
        const x = ph.x, y = 226;
        c.fillStyle = era === 'poster' ? '#1a0806' : '#151310';
        c.beginPath(); c.ellipse(x, y, 13, 15, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.moveTo(x - 26, y + 50); c.quadraticCurveTo(x, y + 10, x + 26, y + 50); c.fill();
        c.fillRect(x - 12, y - 18, 24, 6); c.fillRect(x - 8, y - 26, 16, 10);
        c.fillStyle = '#2a2622'; c.fillRect(x + ph.dir * 6 - 11, y + 2, 22, 16);
        c.fillStyle = '#c9c2b5'; c.beginPath(); c.arc(x + ph.dir * 6, y - 6, 9, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#7d766a'; c.beginPath(); c.arc(x + ph.dir * 6, y - 6, 5, 0, Math.PI * 2); c.fill();
      }
      c.drawImage(this.layerRing, 0, 0, W, H);
    }

    drawReferee(c) {
      const R = this.ref, x = R.x, base = 478, k = 0.72;
      const t = this.now || 0;
      c.save();
      c.translate(x, base); c.scale(k, k);
      c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 5;
      // legs
      c.fillStyle = '#1d1b22';
      c.beginPath(); c.moveTo(-34, 0); c.lineTo(-6, 0); c.lineTo(-10, 150); c.lineTo(-36, 150); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(6, 0); c.lineTo(34, 0); c.lineTo(36, 150); c.lineTo(10, 150); c.closePath(); c.fill(); c.stroke();
      // shirt
      c.fillStyle = this.era === 'poster' ? '#f4ecd6' : '#f2f2f2';
      c.beginPath(); c.moveTo(-50, -150); c.lineTo(50, -150); c.lineTo(40, 6); c.lineTo(-40, 6); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(23,19,15,.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -140); c.lineTo(0, 4); c.stroke();
      // arms: counting, waving it off, or hands on hips
      const sk = D.SKINS[R.look.skin];
      c.strokeStyle = INK; c.lineWidth = 22; const arm = (x1, y1, x2, y2, x3, y3) => { c.strokeStyle = INK; c.lineWidth = 24; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.stroke(); c.strokeStyle = this.era === 'poster' ? '#f4ecd6' : '#f2f2f2'; c.lineWidth = 16; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.strokeStyle = sk; c.beginPath(); c.moveTo(x2, y2); c.lineTo(x3, y3); c.stroke(); };
      if (R.wave > 0) { const w = Math.sin(t / 90) * 40; arm(-42, -135, -80 + w * 0.4, -170, -40 + w, -215); arm(42, -135, 80 - w * 0.4, -170, 40 - w, -215); }
      else if (R.counting) { const down = ease(R.arm); arm(42, -135, 70, -200 + down * 110, 60 + down * 40, -260 + down * 210); arm(-42, -135, -64, -80, -40, -30); }
      else { arm(-42, -135, -76, -80, -40, -40); arm(42, -135, 76, -80, 40, -40); }
      // bow tie and head
      c.fillStyle = INK; c.beginPath(); c.moveTo(-14, -152); c.lineTo(0, -146); c.lineTo(14, -152); c.lineTo(14, -138); c.lineTo(0, -144); c.lineTo(-14, -138); c.closePath(); c.fill();
      c.fillStyle = sk; c.strokeStyle = INK; c.lineWidth = 5;
      c.beginPath(); c.ellipse(0, -194, 32, 38, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = D.HAIRS[R.look.hair]; c.beginPath(); c.ellipse(-26, -206, 9, 16, 0.2, 0, Math.PI * 2); c.ellipse(26, -206, 9, 16, -0.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = INK; c.beginPath(); c.arc(-11, -196, 3.5, 0, Math.PI * 2); c.arc(11, -196, 3.5, 0, Math.PI * 2); c.fill();
      c.lineWidth = 4; c.beginPath(); c.moveTo(-10, -172); c.quadraticCurveTo(0, R.counting ? -164 : -174, 10, -172); c.stroke();
      c.restore();
    }

    drawAtmosphere(c) {
      const t = this.now || 0;
      c.save();
      c.globalCompositeOperation = 'lighter';
      // light cones from the ring lamps
      for (const x of [300, 660]) {
        const g = c.createLinearGradient(0, 52, 0, 600);
        g.addColorStop(0, 'rgba(255,240,205,.16)'); g.addColorStop(1, 'rgba(255,240,205,0)');
        c.fillStyle = g; c.beginPath(); c.moveTo(x - 44, 52); c.lineTo(x + 44, 52); c.lineTo(x + 230, 600); c.lineTo(x - 230, 600); c.closePath(); c.fill();
      }
      // dust drifting in the light
      for (const m of this.motes) {
        const a = 0.25 + 0.25 * Math.sin(t / 500 + m.ph);
        c.fillStyle = `rgba(255,245,220,${a})`; c.fillRect(m.x, m.y, 2, 2);
      }
      c.restore();
      // cigar smoke hanging under the roof
      for (const sm of this.smoke) {
        const g = c.createRadialGradient(sm.x, sm.y, 0, sm.x, sm.y, sm.r);
        g.addColorStop(0, `rgba(235,225,210,${sm.a})`); g.addColorStop(1, 'rgba(235,225,210,0)');
        c.fillStyle = g; c.fillRect(sm.x - sm.r, sm.y - sm.r, sm.r * 2, sm.r * 2);
      }
      for (const p of this.puffs) {
        const a = (p.life / p.max) * p.a;
        c.fillStyle = `rgba(245,240,230,${a})`; c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
      }
      // ticker tape
      for (const tp of this.tape) {
        c.save(); c.translate(tp.x, tp.y); c.rotate(tp.rot); c.scale(1, Math.cos(tp.flip));
        c.fillStyle = tp.col; c.fillRect(-tp.w / 2, -tp.h / 2, tp.w, tp.h); c.restore();
      }
    }

    drawVignette(c) {
      const P = this.P;
      const v = c.createRadialGradient(480, 300, 260, 480, 300, 620);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)');
      c.fillStyle = v; c.fillRect(0, 0, W, H);
      const hurt = P.hitFlash * 0.3 + (this.beat || 0) * 0.45;
      if (hurt > 0.01) {
        const r = c.createRadialGradient(480, 300, 180, 480, 300, 600);
        r.addColorStop(0, 'rgba(160,10,0,0)'); r.addColorStop(1, `rgba(160,10,0,${Math.min(0.7, hurt)})`);
        c.fillStyle = r; c.fillRect(0, 0, W, H);
      }
    }

    drawCard(c) {
      const k = this.card.t / this.card.dur;
      const inK = ease(Math.min(1, k / 0.22)), outK = k > 0.8 ? ease((k - 0.8) / 0.2) : 0;
      const x = 480 + (1 - inK) * -700 + outK * 800, y = 250;
      c.save(); c.translate(x, y); c.rotate(-0.04 + outK * 0.1);
      c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(-196, -64, 400, 140);
      c.fillStyle = '#f1e6cc'; c.strokeStyle = INK; c.lineWidth = 6; c.fillRect(-206, -76, 400, 140); c.strokeRect(-206, -76, 400, 140);
      c.lineWidth = 2; c.strokeRect(-196, -66, 380, 120);
      c.fillStyle = this.era === 'tv' ? '#b23a1f' : '#b8231b'; c.font = '400 64px "Alfa Slab One", Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 4; c.strokeStyle = INK; c.strokeText(this.card.text, -6, -14); c.fillText(this.card.text, -6, -14);
      c.fillStyle = INK; c.font = '600 20px Oswald, "Arial Narrow", sans-serif'; c.fillText(this.card.sub, -6, 40);
      c.restore();
    }

    drawKO(c) {
      const k = Math.min(1, this.koText.t / 380);
      const s = k < 1 ? 2.4 - ease(k) * 1.4 : 1 + Math.sin(this.koText.t / 120) * 0.02;
      c.save(); c.translate(480, 230); c.rotate(-0.08); c.scale(s, s);
      c.fillStyle = this.koText.lost ? '#3a0d09' : '#ffe27a'; c.strokeStyle = INK; c.lineWidth = 8;
      c.beginPath();
      for (let i = 0; i < 24; i++) { const a = (i * Math.PI) / 12, r = i % 2 ? 90 : 150; c.lineTo(Math.cos(a) * r * 1.6, Math.sin(a) * r * 0.85); }
      c.closePath(); c.fill(); c.stroke();
      c.font = '400 120px Bangers, "Alfa Slab One", Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 14; c.strokeText(this.koText.text, 0, 8); c.fillStyle = this.koText.lost ? '#f1e6cc' : '#b8231b'; c.fillText(this.koText.text, 0, 8);
      c.restore();
    }

    drawOpponent(c) {
      const O = this.O, look = this.cfg.opp.look || {};
      const skin = D.SKINS[look.skin || 0], hair = D.HAIRS[look.hair || 0], trunks = D.TRUNKS[look.trunks == null ? 1 : look.trunks];
      const build = look.build || 1;
      const cx = 480 + O.x, crouch = O.crouch, fall = O.fall;
      // shadow on the canvas
      c.fillStyle = 'rgba(40,20,10,.28)'; c.beginPath(); c.ellipse(cx, 598, 150 * (1 - fall * 0.2), 22, 0, 0, Math.PI * 2); c.fill();
      c.save();
      if (fall > 0) {
        // Knocked down: he falls away from us, so he squashes toward the floor around his feet.
        const k = fall < 0.8 ? ease(fall / 0.8) * 1.06 : 1.06 - 0.06 * ((fall - 0.8) / 0.2);
        c.translate(cx, 600); c.rotate((O.fallDir || 1) * 0.1 * k); c.scale(1 + 0.06 * k, 1 - 0.66 * k); c.translate(-cx, -600);
      }
      c.translate(0, O.bob || 0);
      c.translate(cx, 0); c.rotate(O.lean * 0.6); c.translate(-cx, 0);
      const breathe = 1 + Math.sin((this.now || 0) / (O.sta < O.staMax * 0.4 ? 260 : 520)) * 0.012;
      const headY = 170 + crouch * 0.8 + O.headY, shY = 245 + crouch, waistY = 395 + crouch * 0.4, trunkY = 455;
      const shW = 128 * build * breathe, waW = 82 * build;
      // legs
      c.fillStyle = skin; c.strokeStyle = INK; c.lineWidth = 5; c.lineJoin = 'round';
      for (const s of [-1, 1]) {
        const lg = c.createLinearGradient(cx + s * 20, 0, cx + s * 80, 0); lg.addColorStop(0, skin); lg.addColorStop(1, shade(skin, -0.25));
        c.fillStyle = lg;
        c.beginPath(); c.moveTo(cx + s * 20, trunkY); c.lineTo(cx + s * 72, trunkY); c.lineTo(cx + s * 80, 600); c.lineTo(cx + s * 26, 600); c.closePath(); c.fill(); c.stroke();
      }
      // trunks with a stripe and a fold
      c.fillStyle = trunks; c.beginPath(); c.moveTo(cx - waW - 6, waistY); c.lineTo(cx + waW + 6, waistY); c.lineTo(cx + waW + 22, trunkY + 30); c.lineTo(cx + 6, trunkY + 22); c.lineTo(cx - 6, trunkY + 22); c.lineTo(cx - waW - 22, trunkY + 30); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.moveTo(cx - waW - 10, waistY + 18); c.lineTo(cx - waW + 2, waistY + 18); c.lineTo(cx - waW - 6, trunkY + 26); c.lineTo(cx - waW - 18, trunkY + 26); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(cx + waW + 10, waistY + 18); c.lineTo(cx + waW - 2, waistY + 18); c.lineTo(cx + waW + 6, trunkY + 26); c.lineTo(cx + waW + 18, trunkY + 26); c.closePath(); c.fill();
      c.fillStyle = shade(trunks, -0.3); c.fillRect(cx - waW - 6, waistY, (waW + 6) * 2, 16); c.strokeRect(cx - waW - 6, waistY, (waW + 6) * 2, 16);
      // torso, lit from above
      const tg = c.createLinearGradient(cx - shW, 0, cx + shW, 0);
      tg.addColorStop(0, shade(skin, -0.3)); tg.addColorStop(0.3, skin); tg.addColorStop(0.55, shade(skin, 0.06)); tg.addColorStop(0.8, skin); tg.addColorStop(1, shade(skin, -0.34));
      c.fillStyle = tg;
      const torso = () => { c.beginPath(); c.moveTo(cx - shW, shY + 10); c.quadraticCurveTo(cx - shW - 6, shY - 18, cx - shW * 0.55, shY - 22); c.lineTo(cx + shW * 0.55, shY - 22); c.quadraticCurveTo(cx + shW + 6, shY - 18, cx + shW, shY + 10);
        c.quadraticCurveTo(cx + waW + 18, shY + 90, cx + waW, waistY + 2); c.lineTo(cx - waW, waistY + 2); c.quadraticCurveTo(cx - waW - 18, shY + 90, cx - shW, shY + 10); c.closePath(); };
      torso(); c.fill(); c.stroke();
      // muscle lines and shadows
      c.strokeStyle = rgba('#17130f', 0.42); c.lineWidth = 3;
      c.beginPath(); c.moveTo(cx - 70 * build, shY + 48); c.quadraticCurveTo(cx - 30, shY + 72, cx - 4, shY + 50); c.moveTo(cx + 70 * build, shY + 48); c.quadraticCurveTo(cx + 30, shY + 72, cx + 4, shY + 50); c.stroke();
      c.beginPath(); c.moveTo(cx, shY + 60); c.lineTo(cx, waistY - 10);
      for (const yy of [shY + 95, shY + 125]) { c.moveTo(cx - 26, yy); c.quadraticCurveTo(cx, yy + 6, cx + 26, yy); }
      c.moveTo(cx - 40, waistY - 30); c.quadraticCurveTo(cx - 52, waistY - 60, cx - 48, waistY - 90); c.moveTo(cx + 40, waistY - 30); c.quadraticCurveTo(cx + 52, waistY - 60, cx + 48, waistY - 90);
      c.stroke();
      // shine across the shoulders: sweat under the lights
      const sweat = 0.18 + (1 - O.sta / O.staMax) * 0.3 + (this.round - 1) * 0.05;
      c.fillStyle = `rgba(255,255,255,${Math.min(0.45, sweat)})`;
      c.beginPath(); c.ellipse(cx - shW * 0.62, shY - 8, 26, 7, -0.25, 0, Math.PI * 2); c.ellipse(cx + shW * 0.62, shY - 8, 26, 7, 0.25, 0, Math.PI * 2); c.ellipse(cx - 30, shY + 52, 14, 5, -0.3, 0, Math.PI * 2); c.fill();
      if (O.hitFlash > 0) { c.fillStyle = `rgba(255,255,255,${O.hitFlash * 0.35})`; torso(); c.fill(); }
      // arms (behind gloves)
      this.drawArm(c, cx - shW + 14, shY + 4, O.gL, skin, -1);
      this.drawArm(c, cx + shW - 14, shY + 4, O.gR, skin, 1);
      // neck + head
      const hx = cx + O.headX;
      c.fillStyle = shade(skin, -0.14); c.strokeStyle = INK; c.lineWidth = 5;
      c.beginPath(); c.moveTo(hx - 30, headY + 40); c.lineTo(hx + 30, headY + 40); c.lineTo(hx + 40, shY - 16); c.lineTo(hx - 40, shY - 16); c.closePath(); c.fill(); c.stroke();
      this.drawHead(c, hx, headY, skin, hair, look, O);
      // trails behind a punch on its way
      for (const tr of this.trails) if (tr.who === 'O') { c.fillStyle = `rgba(150,40,20,${(tr.life / 120) * 0.25})`; c.beginPath(); c.arc(tr.x + O.x, tr.y, 44 * tr.s, 0, Math.PI * 2); c.fill(); }
      // gloves on top, the far one first
      const gcol = this.era === 'poster' ? '#7a3b1c' : '#a3221a';
      const order = O.gL.s > O.gR.s ? [O.gR, O.gL] : [O.gL, O.gR];
      for (const gl of order) this.drawGlove(c, gl.x + O.x, gl.y, 44 * gl.s, gcol, gl === O.gL ? -1 : 1);
      // tell glint around the loaded glove
      if (O.state === 'tell' && O.move && O.move.kind !== 'jab') {
        const gl = ['hookL', 'body', 'feint', 'lowblow'].includes(O.move.kind) && (O.move.kind !== 'feint' || O.move.side === 'L') ? O.gL : O.gR;
        const p = clamp(O.t / O.move.tellLen, 0, 1);
        c.save(); c.globalAlpha = 0.35 + 0.6 * Math.abs(Math.sin(O.t / 70));
        c.strokeStyle = '#fff6d8'; c.lineWidth = 4;
        c.beginPath(); c.arc(gl.x + O.x, gl.y, 44 * gl.s + 10 + p * 8, 0, Math.PI * 2); c.stroke();
        if (O.move.kind === 'haymaker') this.star(c, gl.x + O.x + 30, gl.y - 40, 18 + p * 10, '#fff6d8');
        c.restore();
      }
      c.restore();
      if (fall > 0.6 && (O.state === 'down' || O.state === 'out')) { // birdies over the fallen fighter
        const k = Math.min(1, fall);
        const sy = 600 - (600 - headY) * (1 - 0.66 * k);
        for (let i = 0; i < 4; i++) { const a = (this.now / 300) + i * 1.57; this.star(c, hx + Math.cos(a) * 70, sy - 40 + Math.sin(a) * 14, 10, '#ffe27a'); }
      }
    }

    drawArm(c, sx, sy, g, skin, side) {
      const gx = g.x + this.O.x, gy = g.y;
      const L1 = 92, L2 = 92;
      const dx = gx - sx, dy = gy - sy, d = Math.min(Math.hypot(dx, dy), L1 + L2 - 1);
      const a = Math.atan2(dy, dx), b = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
      const ea = a - side * b;
      const ex = sx + Math.cos(ea) * L1, ey = sy + Math.sin(ea) * L1;
      const thick = 34 * (0.7 + g.s * 0.3);
      c.lineCap = 'round';
      c.strokeStyle = INK; c.lineWidth = thick + 10; c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.lineTo(gx, gy); c.stroke();
      c.strokeStyle = skin; c.lineWidth = thick; c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.lineTo(gx, gy); c.stroke();
      c.strokeStyle = shade(skin, -0.2); c.lineWidth = thick * 0.35; c.beginPath(); c.moveTo(sx + side * 6, sy + 8); c.lineTo(ex + side * 4, ey + 6); c.stroke();
    }

    drawGlove(c, x, y, r, col, side) {
      c.save();
      c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = 5;
      // cuff
      c.fillStyle = '#f1e6cc';
      c.beginPath(); c.ellipse(x, y + r * 0.85, r * 0.62, r * 0.38, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = col;
      c.beginPath(); c.ellipse(x, y, r, r * 1.02, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      // thumb
      c.beginPath(); c.ellipse(x - side * r * 0.72, y + r * 0.15, r * 0.34, r * 0.5, side * 0.5, 0, Math.PI * 2); c.fill(); c.stroke();
      // shine
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(x + side * r * 0.25, y - r * 0.4, r * 0.32, r * 0.18, -0.5 * side, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    drawHead(c, x, y, skin, hair, look, O) {
      const jaw = look.jaw || 1;
      c.save();
      c.translate(x, y); c.rotate(O.tilt); c.scale(1.18, 1.18);
      const sq = O.squash || 0; if (sq) c.scale(1 + 0.1 * sq, 1 - 0.09 * sq);
      // ears
      c.fillStyle = skin; c.strokeStyle = INK; c.lineWidth = 5;
      for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 50, 4, 11, 17, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
      // face
      const fg = c.createLinearGradient(-50, 0, 50, 0); fg.addColorStop(0, shade(skin, -0.15)); fg.addColorStop(0.5, skin); fg.addColorStop(1, shade(skin, -0.2));
      c.fillStyle = fg;
      c.beginPath(); c.moveTo(-48, -20); c.quadraticCurveTo(-50, -66, 0, -68); c.quadraticCurveTo(50, -66, 48, -20); c.quadraticCurveTo(50, 40 * jaw, 22, 58 * jaw); c.lineTo(-22, 58 * jaw); c.quadraticCurveTo(-50, 40 * jaw, -48, -20); c.closePath(); c.fill(); c.stroke();
      // bruises
      if (O.bruise > 0.15) { c.fillStyle = `rgba(90,30,70,${O.bruise * 0.45})`; c.beginPath(); c.ellipse(-20, -2, 15 * O.bruise + 6, 10 * O.bruise + 5, 0, 0, Math.PI * 2); c.fill(); }
      if (O.bruise > 0.55) { c.fillStyle = 'rgba(160,30,25,.6)'; c.fillRect(14, -26, 18, 4); }
      // hair
      c.fillStyle = hair;
      const cut = look.cut || 'slick';
      c.beginPath();
      if (cut === 'bald') { /* shine */ c.fillStyle = 'rgba(255,255,255,.25)'; c.ellipse(-12, -54, 16, 6, -0.3, 0, Math.PI * 2); c.fill(); }
      else {
        if (cut === 'curly') { for (let i = -4; i <= 4; i++) { c.moveTo(i * 11 + 12, -58); c.arc(i * 11, -58 + Math.abs(i) * 3, 12, 0, Math.PI * 2); } }
        else if (cut === 'flat') { c.rect(-46, -86, 92, 30); }
        else if (cut === 'crop') { c.moveTo(-48, -30); c.quadraticCurveTo(-50, -74, 0, -74); c.quadraticCurveTo(50, -74, 48, -30); c.quadraticCurveTo(30, -56, 0, -56); c.quadraticCurveTo(-30, -56, -48, -30); }
        else if (cut === 'wave') { c.moveTo(-50, -26); c.quadraticCurveTo(-56, -84, 6, -80); c.quadraticCurveTo(58, -78, 50, -26); c.quadraticCurveTo(40, -60, 18, -54); c.quadraticCurveTo(-4, -70, -20, -52); c.quadraticCurveTo(-36, -58, -50, -26); }
        else { c.moveTo(-50, -24); c.quadraticCurveTo(-54, -82, 0, -80); c.quadraticCurveTo(54, -82, 50, -24); c.quadraticCurveTo(44, -60, 0, -60); c.quadraticCurveTo(-44, -60, -50, -24); }
        c.fill(); c.stroke();
      }
      // brows
      const hurt = O.state === 'hurt' || O.state === 'stagger';
      const angry = O.state === 'tell' || O.state === 'strike';
      c.strokeStyle = INK; c.lineWidth = 7; c.lineCap = 'round';
      const bA = angry ? 0.35 : hurt ? -0.3 : 0.12 + (look.brow || 0) * 0.08;
      for (const s of [-1, 1]) { c.save(); c.translate(s * 20, -24); c.rotate(-s * bA); c.beginPath(); c.moveTo(-13, 0); c.lineTo(13, 0); c.stroke(); c.restore(); }
      // eyes
      const out = O.state === 'down' || O.state === 'out';
      c.lineWidth = 4;
      for (const s of [-1, 1]) {
        const ex = s * 20, ey = -8;
        if (out) { c.beginPath(); c.moveTo(ex - 7, ey - 7); c.lineTo(ex + 7, ey + 7); c.moveTo(ex + 7, ey - 7); c.lineTo(ex - 7, ey + 7); c.stroke(); continue; }
        if (hurt) { c.beginPath(); c.moveTo(ex - 9, ey); c.lineTo(ex + 9, ey + (s * 3)); c.stroke(); continue; }
        if (s === 1 && O.bruise > 0.7) { c.fillStyle = 'rgba(110,40,80,.75)'; c.beginPath(); c.ellipse(ex + 2, ey - 2, 15, 12, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.moveTo(ex - 8, ey + 1); c.quadraticCurveTo(ex, ey - 2, ex + 9, ey + 1); c.stroke(); continue; }
        c.fillStyle = '#fbf6e8'; c.beginPath(); c.ellipse(ex, ey, 10, angry ? 6 : 8, 0, 0, Math.PI * 2); c.fill(); c.stroke();
        const px = clamp((this.P.x / 175) * 4, -4, 4);
        c.fillStyle = INK; c.beginPath(); c.arc(ex + px, ey + 1, 3.6, 0, Math.PI * 2); c.fill();
      }
      // the glint in his eye when he loads up
      if (O.glint > 0 && !out) {
        const g = O.glint, gx = -20, gy = -10, r = 26 * g;
        c.save(); c.globalCompositeOperation = 'lighter';
        const gg = c.createRadialGradient(gx, gy, 0, gx, gy, r); gg.addColorStop(0, `rgba(255,255,240,${g})`); gg.addColorStop(1, 'rgba(255,255,240,0)');
        c.fillStyle = gg; c.fillRect(gx - r, gy - r, r * 2, r * 2);
        c.fillStyle = `rgba(255,255,255,${g})`; c.beginPath(); c.moveTo(gx, gy - r); c.lineTo(gx + 3, gy - 3); c.lineTo(gx + r, gy); c.lineTo(gx + 3, gy + 3); c.lineTo(gx, gy + r); c.lineTo(gx - 3, gy + 3); c.lineTo(gx - r, gy); c.lineTo(gx - 3, gy - 3); c.closePath(); c.fill();
        c.restore();
      }
      // forehead sweat when he is tired
      if (O.sta < O.staMax * 0.5 && !out) { c.fillStyle = 'rgba(220,240,255,.8)'; for (const [dx, dy] of [[-30, -40], [26, -46], [36, -20]]) { c.beginPath(); c.moveTo(dx, dy - 6); c.quadraticCurveTo(dx + 4, dy + 2, dx, dy + 4); c.quadraticCurveTo(dx - 4, dy + 2, dx, dy - 6); c.fill(); } }
      // nose
      c.strokeStyle = INK; c.lineWidth = 4; c.fillStyle = shade(skin, -0.12);
      c.beginPath();
      if (look.nose === 1) { c.moveTo(-3, -2); c.lineTo(-10, 20); c.quadraticCurveTo(0, 26, 10, 20); }
      else if (look.nose === 2) { c.moveTo(2, -2); c.quadraticCurveTo(14, 18, 4, 22); c.lineTo(-8, 20); }
      else { c.moveTo(0, -2); c.lineTo(-8, 18); c.lineTo(8, 18); }
      c.fill(); c.stroke();
      // stache
      if (look.stache) { c.fillStyle = hair; c.beginPath(); c.moveTo(-22, 32); c.quadraticCurveTo(0, 22, 22, 32); c.quadraticCurveTo(0, 30, -22, 32); c.fill(); c.lineWidth = 3; c.stroke(); }
      // mouth
      c.lineWidth = 4;
      if (O.state === 'taunt') { c.fillStyle = '#4a1a14'; c.beginPath(); c.ellipse(0, 38, 14, 10, 0, 0, Math.PI); c.fill(); c.stroke(); }
      else if (hurt || out) { c.fillStyle = '#3a1410'; c.beginPath(); c.ellipse(0, 40, 10, 12, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
      else if (angry) { c.fillStyle = '#fbf6e8'; c.fillRect(-14, 34, 28, 9); c.strokeRect(-14, 34, 28, 9); c.beginPath(); c.moveTo(-14, 38.5); c.lineTo(14, 38.5); c.stroke(); }
      else { c.beginPath(); c.moveTo(-14, 38); c.quadraticCurveTo(0, 42, 14, 37); c.stroke(); }
      // mouthpiece-ish chin line
      c.restore();
    }

    star(c, x, y, r, col) {
      c.save(); c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      c.closePath(); c.fill(); c.stroke(); c.restore();
    }

    drawTellAssist(c) {
      const O = this.O;
      if (O.state !== 'tell' || !O.move) return;
      const mv = MOVES[O.move.kind];
      if (this.assist === 'normal' && (this.round > 1 || O.move.kind === 'jab') && !(this.cfg.filmStudy && this.round === 1 && O.move.kind !== 'jab')) return;
      if (this.assist === 'champ' && !(this.cfg.filmStudy && this.round === 1 && O.move.kind !== 'jab')) return;
      const x = 480 + O.x, y = 64;
      c.save();
      const label = { jab: 'JAB · slip', hookL: 'HOOK → slip right', hookR: '← HOOK slip left', upper: 'UPPERCUT · slip ←→', body: 'BODY · slip or guard', haymaker: 'HAYMAKER · MOVE!', feint: 'FAKE? wait…', taunt: 'TAUNT · hit him!', bolo: '← BOLO · slip LEFT', lowblow: 'LOW BLOW · slip!' }[O.move.kind] || mv.name;
      c.font = '700 20px Oswald, "Arial Narrow", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const bw = Math.max(180, c.measureText(label).width + 32);
      c.fillStyle = 'rgba(241,230,204,.92)'; c.strokeStyle = INK; c.lineWidth = 3;
      c.beginPath(); c.roundRect ? c.roundRect(x - bw / 2, y - 22, bw, 44, 8) : c.rect(x - bw / 2, y - 22, bw, 44); c.fill(); c.stroke();
      c.fillStyle = INK;
      c.fillText(label, x, y + 1);
      c.restore();
    }

    drawPlayer(c) {
      // Seen from behind, like the hero in Punch-Out: a solid silhouette with a rim of ring light.
      const P = this.P, look = this.cfg.you.look || {};
      const skin = D.SKINS[look.skin || 0], hair = D.HAIRS[look.hair || 0], trunks = D.TRUNKS[look.trunks || 0];
      const back = shade(skin, -0.38), rim = '#fff3d0';
      const cx = 480 + P.x, by = 612 + P.y;
      c.save();
      c.translate(cx, by); c.rotate(P.lean); c.translate(-cx, -by);
      c.lineJoin = 'round'; c.lineCap = 'round';
      // arms first, behind the head
      for (const [g, s] of [[P.gL, -1], [P.gR, 1]]) {
        // Arms taper as the glove travels away from us, so a long punch reads as reach, not a pole.
        const sx = cx + s * 112, sy = by - 64, ex = g.x, ey = g.y + 26 * g.s;
        const w0 = 26, w1 = 10 + 14 * Math.min(1, g.s);
        const ang = Math.atan2(ey - sy, ex - sx), nx = -Math.sin(ang), ny = Math.cos(ang);
        const poly = (pad) => { c.beginPath(); c.moveTo(sx + nx * (w0 + pad), sy + ny * (w0 + pad)); c.lineTo(ex + nx * (w1 + pad), ey + ny * (w1 + pad)); c.lineTo(ex - nx * (w1 + pad), ey - ny * (w1 + pad)); c.lineTo(sx - nx * (w0 + pad), sy - ny * (w0 + pad)); c.closePath(); };
        c.fillStyle = rim; poly(4); c.fill();
        c.fillStyle = back; poly(0); c.fill();
      }
      // back and shoulders
      c.fillStyle = back; c.strokeStyle = rim; c.lineWidth = 5;
      c.beginPath(); c.moveTo(cx - 170, by + 30); c.quadraticCurveTo(cx - 168, by - 70, cx - 70, by - 86); c.lineTo(cx + 70, by - 86); c.quadraticCurveTo(cx + 168, by - 70, cx + 170, by + 30); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(cx, by - 70); c.lineTo(cx, by + 30); c.moveTo(cx - 60, by - 50); c.quadraticCurveTo(cx - 30, by - 20, cx - 70, by + 10); c.moveTo(cx + 60, by - 50); c.quadraticCurveTo(cx + 30, by - 20, cx + 70, by + 10); c.stroke();
      // neck and head
      c.fillStyle = back; c.strokeStyle = rim; c.lineWidth = 5;
      c.beginPath(); c.moveTo(cx - 30, by - 84); c.lineTo(cx - 26, by - 120); c.lineTo(cx + 26, by - 120); c.lineTo(cx + 30, by - 84); c.closePath(); c.fill(); c.stroke();
      for (const s of [-1, 1]) { c.beginPath(); c.ellipse(cx + s * 44, by - 146, 10, 15, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
      c.beginPath(); c.ellipse(cx, by - 152, 44, 50, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = shade(hair, -0.1);
      c.beginPath(); c.ellipse(cx, by - 162, 44, 42, 0, Math.PI * 0.95, Math.PI * 2.05); c.quadraticCurveTo(cx, by - 120, cx - 44, by - 158); c.fill();
      c.strokeStyle = rim; c.lineWidth = 5; c.beginPath(); c.ellipse(cx, by - 152, 44, 50, 0, Math.PI, Math.PI * 2); c.stroke();
      // waistband
      c.fillStyle = trunks; c.strokeStyle = rim; c.lineWidth = 4; c.fillRect(cx - 120, by + 12, 240, 22); c.strokeRect(cx - 120, by + 12, 240, 22);
      // gloves, with a blur trail when a punch is on its way
      const gcol = trunks === '#b8231b' ? '#1f3f8f' : '#b8231b';
      for (const tr of this.trails) if (tr.who === 'P') { c.fillStyle = rgba(gcol, (tr.life / 110) * 0.3); c.beginPath(); c.arc(tr.x, tr.y, 48 * tr.s, 0, Math.PI * 2); c.fill(); }
      const order = P.gL.s < P.gR.s ? [[P.gL, -1], [P.gR, 1]] : [[P.gR, 1], [P.gL, -1]];
      for (const [g, s] of order) {
        c.save(); c.strokeStyle = rim; c.lineWidth = 9; c.beginPath(); c.ellipse(g.x, g.y, 48 * g.s, 49 * g.s, 0, 0, Math.PI * 2); c.stroke(); c.restore();
        this.drawGlove(c, g.x, g.y, 48 * g.s, gcol, -s);
      }
      if (P.stun > 0) { for (let i = 0; i < 3; i++) { const a = this.now / 200 + i * 2.1; this.star(c, cx + Math.cos(a) * 60, by - 210 + Math.sin(a) * 12, 9, '#ffe27a'); } }
      c.restore();
    }

    drawFx(c) {
      for (const p of this.parts) { c.fillStyle = `rgba(230,240,255,${clamp(p.life / 500, 0, 0.9)})`; c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill(); }
      for (const f of this.fx) {
        if (f.kind === 'pow') {
          const k = 1 - f.life / f.max, a = clamp(f.life / (f.max * 0.4), 0, 1);
          const s = f.size * (0.7 + ease(Math.min(1, k * 4)) * 0.5);
          c.save(); c.translate(f.x, f.y); c.rotate(f.rot); c.scale(s, s); c.globalAlpha = a;
          c.fillStyle = f.hay ? '#ffe27a' : '#fff6d8'; c.strokeStyle = INK; c.lineWidth = 4;
          c.beginPath();
          for (let i = 0; i < 16; i++) { const ang = (i * Math.PI) / 8, rr = i % 2 ? 46 : 80; c.lineTo(Math.cos(ang) * rr * 1.25, Math.sin(ang) * rr * 0.8); }
          c.closePath(); c.fill(); c.stroke();
          c.fillStyle = '#b8231b'; c.font = '400 44px Bangers, "Alfa Slab One", Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.lineWidth = 6; c.strokeStyle = INK; c.strokeText(f.word, 0, 2); c.fillText(f.word, 0, 2);
          c.restore();
        } else if (f.kind === 'speed') {
          const a = f.life / f.max;
          c.save(); c.strokeStyle = `rgba(23,19,15,${a * 0.55})`; c.lineCap = 'round';
          for (let i = 0; i < 22; i++) { const ang = (i / 22) * Math.PI * 2 + i * 0.37; const r0 = 110 + (i % 3) * 20, r1 = 420; c.lineWidth = 2 + (i % 4); c.beginPath(); c.moveTo(f.x + Math.cos(ang) * r0, f.y + Math.sin(ang) * r0); c.lineTo(f.x + Math.cos(ang) * r1, f.y + Math.sin(ang) * r1); c.stroke(); }
          c.restore();
        } else if (f.kind === 'ring') {
          const k = 1 - f.life / f.max;
          c.save(); c.strokeStyle = `rgba(255,250,230,${(1 - k) * 0.8})`; c.lineWidth = 6 * (1 - k) + 1; c.beginPath(); c.arc(f.x, f.y, 20 + k * 80, 0, Math.PI * 2); c.stroke(); c.restore();
        } else if (f.kind === 'starfly') {
          const k = ease(1 - f.life / f.max);
          const x = lerp(f.x, 480, k), y = lerp(f.y, -30, k) - Math.sin(k * Math.PI) * 80;
          this.star(c, x, y, 18 * (1 - k * 0.4), '#ffe27a');
        } else if (f.kind === 'block') {
          const a = f.life / f.max;
          c.save(); c.globalAlpha = a; c.strokeStyle = '#fff6d8'; c.lineWidth = 5; c.beginPath(); c.arc(f.x, f.y, 70 * (1.4 - a), -2.4, -0.7); c.stroke(); c.restore();
        }
      }
    }

    drawCount(c) {
      const n = this.count.n;
      if (n <= 0) return;
      c.save();
      c.font = '400 150px Bangers, "Alfa Slab One", Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 12; c.strokeStyle = INK; c.fillStyle = '#fff6d8';
      const k = (this.count.t / 720);
      c.globalAlpha = 1 - k * 0.5;
      c.translate(480, 300); c.scale(1.2 - k * 0.2, 1.2 - k * 0.2);
      c.strokeText(String(n), 0, 0); c.fillText(String(n), 0, 0);
      c.restore();
    }

    drawMash(c) {
      const P = this.P, need = this.count ? this.count.need : 1;
      const p = clamp(P.mash / need, 0, 1);
      c.save();
      c.fillStyle = 'rgba(23,19,15,.75)'; c.fillRect(280, 470, 400, 46);
      c.fillStyle = '#e0a526'; c.fillRect(286, 476, 388 * p, 34);
      c.font = '700 22px Oswald, "Arial Narrow", sans-serif'; c.fillStyle = '#fff6d8'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('MASH ANY PUNCH KEY TO GET UP', 480, 493);
      c.restore();
    }
  }

  // The title-screen fighter: reads most tells, misses some, counters when it can.
  function demoBot(f) {
    if (f.phase === 'down-you') { if (Math.random() < 0.3) f.mash(); return; }
    if (f.phase !== 'fight') return;
    const O = f.O, P = f.P;
    if (O.state === 'tell' && O.move) {
      if (!f.demoPlan || f.demoPlan.m !== O.move) {
        const dir = { jab: 'left', hookL: 'right', hookR: 'left', upper: 'right', body: 'left', haymaker: 'left', bolo: 'left', lowblow: 'left' }[O.move.kind];
        f.demoPlan = { m: O.move, at: Math.max(260, O.move.tellLen - 300), dir: Math.random() < 0.72 ? dir : pick(['left', 'right', 'duck']), done: false };
      }
      if (!f.demoPlan.done && O.t > f.demoPlan.at && dir0(O.move.kind)) { f.demoPlan.done = true; f.input(f.demoPlan.dir, true); }
      return;
    }
    if (['recover', 'taunt', 'stagger'].includes(O.state) && P.state !== 'punch') { f.input(P.stars > 0 && Math.random() < 0.5 ? 'hay' : pick(['cross', 'jab', 'cross']), true); return; }
    if (O.state === 'idle' && P.state === 'idle' && Math.random() < 0.012) f.input(O.guard === 'high' ? 'body' : 'jab', true);
  }
  function dir0(kind) { return kind !== 'feint' && kind !== 'taunt'; }

  function mix(a, b, k) { return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), s: lerp(a.s, b.s, k) }; }
  function lerpG(a, b, k) { return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), s: lerp(a.s, b.s, k) }; }
  function arc(a, b, k, dir) { const m = mix(a, b, k); m.x += Math.sin(k * Math.PI) * 60 * dir * -1; m.y -= Math.sin(k * Math.PI) * 30; return m; }
  function esc(s) { return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]); }
  void makeHalftone;
})(globalThis.TOT = globalThis.TOT || {});
