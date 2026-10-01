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
      this.sound = T.audio;
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
        <p class="fight-ticker" aria-live="polite"></p>
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
          </div>
        </div>
        <div class="fight-keys"><span><kbd>←</kbd><kbd>→</kbd> slip</span><span><kbd>↓</kbd> duck</span><span><kbd>↑</kbd> hold guard</span><span><kbd>J</kbd> jab</span><span><kbd>K</kbd> cross</span><span><kbd>L</kbd> body</span><span><kbd>Space</kbd> haymaker</span><span><kbd>P</kbd> pause</span></div>`;
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
        hpMax: (85 + ys.chn * 0.45) * healthMul, staMax: 55 + ys.sta * 0.6, state: 'idle', t: 0, x: 0, y: 0, lean: 0,
        gL: { x: 360, y: 470, s: 1 }, gR: { x: 600, y: 470, s: 1 }, punch: null, stars: c.startStars || 0, kd: 0, kdRound: 0,
        landed: 0, thrown: 0, dmgDealt: 0, dmgTaken: 0, combo: 0, mash: 0, hitFlash: 0, lastDodge: -1000, block: false, stun: 0,
      };
      this.P.hp = this.P.hpMax; this.P.sta = this.P.staMax;
      const r = opp.rating;
      const os = opp.stats;
      this.O = {
        hpMax: 95 + os.chn * 0.9 + r * 1.25, staMax: 60 + os.sta * 0.5, state: 'idle', t: 0, wait: 1300, guard: 'high', guardT: 0,
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
      this.count = null;
      this.result = null;
      this.lastTip = '';
      this.say(pick(D.CALLS[this.era].open));
      this.showOverlay(`<div class="ov-card intro"><p class="ov-kicker">${esc(c.venue || '')}</p><h2>${esc(c.you.last)} <span>vs</span> ${esc(opp.last)}</h2><p class="ov-sub">${this.rounds} rounds${c.title ? ' · for the championship' : ''}</p><p class="ov-hint">${c.firstFight ? 'Watch his wind-up. Slip the punch. Hit him while he is open.' : 'Read the tell. Slip. Counter.'}</p><button class="button" data-fx="go">Ring the bell</button></div>`);
      this.renderHud(true);
    }

    makeCrowd() {
      const people = [];
      for (let row = 0; row < 5; row++) {
        const y = 80 + row * 38, n = 22 + row * 2;
        for (let i = 0; i < n; i++) people.push({ x: (i + (row % 2) * 0.5) * (W / n) + rand(-6, 6), y: y + rand(-5, 5), s: 0.7 + row * 0.12, hat: Math.random() < 0.55, bob: Math.random() * 6.28, shade: rand(-0.15, 0.1) });
      }
      return people;
    }

    // ----- input -----
    bind() {
      this.onKey = (e) => {
        const down = e.type === 'keydown';
        const k = e.key;
        const map = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowDown: 'duck', s: 'duck', S: 'duck', ArrowUp: 'block', w: 'block', W: 'block', j: 'jab', J: 'jab', z: 'jab', Z: 'jab', k: 'cross', K: 'cross', x: 'cross', X: 'cross', l: 'body', L: 'body', c: 'body', C: 'body', ' ': 'hay', p: 'pause', P: 'pause', Escape: 'pause' };
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

    throwPunch(a) {
      const P = this.P, def = PUNCH[a];
      const tired = P.sta < 12;
      P.state = 'punch'; P.t = 0;
      const spd = this.cfg.you.stats.spd;
      const speedMul = (1.15 - spd / 300) * (tired ? 1.5 : 1);
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
      this.flashCallout(this.round === this.rounds && this.rounds > 2 ? 'FINAL ROUND' : `ROUND ${this.round}`, 'big');
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
      if (k === 'ice') P.hp = Math.min(P.hpMax, P.hp + P.hpMax * 0.18);
      else P.hp = Math.min(P.hpMax, P.hp + P.hpMax * 0.06);
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
      const title = res === 'W' ? (method === 'KO' || method === 'TKO' ? 'K.O.!' : 'YOU WIN') : res === 'L' ? (method === 'KO' || method === 'TKO' ? (how === 'towel' ? 'TOWEL' : 'K.O.') : 'DECISION LOST') : 'DRAW';
      const cardLine = method && /D/.test(method) ? `<p class="ov-cards">${this.cards.map((c) => `${c[0]}–${c[1]}`).join(' · ')}</p>` : '';
      const methodLine = { KO: `Knockout, round ${this.round}`, TKO: `Technical knockout, round ${this.round}`, UD: 'Unanimous decision', SD: 'Split decision', MD: 'Majority decision', DRAW: 'The judges call it even' }[method] || '';
      setTimeout(() => {
        if (!this.running) return;
        this.showOverlay(`<div class="ov-card result ${res === 'W' ? 'win' : res === 'L' ? 'loss' : ''}"><h2 class="ov-big">${title}</h2><p class="ov-sub">${methodLine}</p>${cardLine}<p class="ov-stats">Punches landed: ${P.landed} of ${P.thrown} · Knockdowns: ${O.kd} for, ${P.kd} against</p><button class="button" data-fx="done">Continue</button></div>`);
        const b = this.overlay.querySelector('button'); b && b.focus();
      }, this.reduced ? 200 : 1500);
      if (res === 'W') this.sound && this.sound.play('roar', 1);
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
      if (Math.random() < (this.excite || 0.02) * dt / 16) this.bulbs.push({ x: rand(30, W - 30), y: rand(80, 230), life: 140 });
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
      P.sta = Math.min(P.staMax, P.sta + (regen * dt) / 1000 * (0.7 + ys.sta / 200));
      this.updatePlayerPose(dt);
    }

    resolvePunch(pu) {
      const P = this.P, O = this.O, def = PUNCH[pu.kind];
      const pow = this.cfg.you.stats.pow;
      let dmg = def.dmg * (0.45 + pow / 120) * (pu.tired ? 0.5 : 1) * rand(0.85, 1.15);
      if (pu.kind === 'hay') dmg *= 1 + pu.stars * 0.9;
      const target = def.target;
      if (O.state === 'down' || O.state === 'out') return;
      let landed = false, counter = false, blocked = false;
      const st = O.state;
      if (st === 'cover') blocked = pu.kind !== 'hay' || Math.random() < 0.5;
      else if (st === 'recover' || st === 'taunt' || st === 'stagger') { landed = true; counter = st !== 'stagger'; }
      else if (st === 'hurt') {
        landed = true; dmg *= 0.75;
        O.chain = (O.chain || 0) + 1;
        if (O.chain >= (this.skill < 0.35 ? 3 : 2)) { blocked = !landed; }
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
      if (counter) { dmg *= O.countered ? 1.1 : 1.6; O.countered = true; }
      O.hp -= dmg; O.dmgTaken += dmg; P.dmgDealt += dmg; P.landed++; this.roundPts[0] += dmg;
      P.combo++;
      O.hitFlash = 1; O.bruise = Math.min(1, O.bruise + dmg / 140);
      O.headX = (pu.hand === 'L' ? 1 : -1) * (6 + dmg * 1.6); O.headY = target === 'head' ? -8 - dmg : 4; O.tilt = (pu.hand === 'L' ? 1 : -1) * 0.04 * dmg;
      O.sta = Math.max(0, O.sta - dmg * (target === 'body' ? 1.6 : 0.7));
      if (counter && (st === 'recover' || st === 'taunt') && !O.starGiven) { O.starGiven = true; P.stars = Math.min(3, P.stars + 1); this.flashCallout(P.stars === 3 ? '★★★ CROWD ON ITS FEET' : '★ COUNTER!', 'star'); this.sound && this.sound.play('star', 0.6); }
      else if (P.combo >= 5 && P.combo % 5 === 0) { P.stars = Math.min(3, P.stars + 1); this.flashCallout('★ COMBO', 'star'); }
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
      if (big) { this.excite = 0.25; this.flash = this.reduced ? 0 : 0.35; }
      this.sound && this.sound.play('punch', clamp(dmg / 12, 0.3, 1.2));
      if (big) this.sound && this.sound.play('roar', 0.6);
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
      } else if (O.state === 'stagger') {
        if (O.t >= 650) { O.state = 'idle'; O.t = 0; O.wait = 400; }
      } else if (O.state === 'taunt') {
        if (O.t >= 900) { O.state = 'idle'; O.t = 0; O.wait = 300; }
      }
      this.updateOppPose(dt);
    }

    startAttack(kind, speed) {
      const O = this.O, mv = MOVES[kind];
      const skillMul = 1.25 - this.skill * 0.55;
      O.state = 'tell'; O.t = 0;
      O.move = { kind, tellLen: mv.tell * skillMul * (speed || 1) * rand(0.92, 1.08), checked: false };
      O.used[kind] = (O.used[kind] || 0) + 1;
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
      if (side && mv.avoid[side]) {
        O.recoverLen = whiffWindow * (mv.dmg > 9 ? 1.15 : 0.85);
        this.flashCallout(side === 'duck' ? 'DUCKED!' : 'SLIPPED!', 'good');
        this.sound && this.sound.play('whiff', 0.7);
        this.excite = 0.08;
        O.sta = Math.max(0, O.sta - mv.dmg * 0.6);
        return;
      }
      let dmg = mv.dmg * 1.25 * (0.5 + O.rating / 90) * (1.15 - ys.def / 260) * rand(0.85, 1.15);
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

    dodgeLen() {
      const ys = this.cfg.you.stats;
      return 470 + ys.spd * 1.6 + ys.def * 0.8 + (this.assist === 'rookie' ? 150 : 0);
    }

    // ----- knockdowns -----
    knockdown(who, big) {
      const P = this.P, O = this.O;
      this.sound && this.sound.play('down', 1);
      this.sound && this.sound.play('roar', 1);
      this.excite = 0.6;
      if (!this.reduced && big) this.slowmo = 900;
      if (who === 'opp') {
        O.kd++; O.kdRound++; O.state = 'down'; O.t = 0; O.hp = 0;
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
        this.roundPts[1] += 15;
        this.say(pick(D.CALLS[this.era].down).replace('{N}', this.cfg.you.last));
        this.flashCallout('YOU\'RE DOWN! MASH TO GET UP', 'bad');
        const need = Math.round(10 + P.kd * 8 - this.cfg.you.stats.chn / 9 - (this.cfg.you.heart || 50) / 25 + (big ? 3 : 0));
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
        c.t -= step; c.n++;
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
      this.fx = this.fx.filter((f) => f.kind !== 'count');
      if (who === 'opp') {
        O.hp = O.hpMax * clamp(0.62 - O.kd * 0.14, 0.18, 0.6); O.state = 'idle'; O.t = 0; O.wait = 900; O.fall = 0;
        this.flashCallout(`UP AT ${this.count.n}!`, 'dim');
      } else {
        P.hp = P.hpMax * clamp(0.55 - P.kd * 0.12, 0.15, 0.5); P.state = 'idle'; P.t = 0; P.stun = 600; P.sta = Math.max(P.sta, P.staMax * 0.4);
        this.flashCallout('YOU BEAT THE COUNT!', 'good');
        this.O.state = 'idle'; this.O.wait = 1200; this.O.t = 0;
      }
      this.count = null; this.phase = 'fight';
    }

    stoppage(res, method) {
      this.fx = this.fx.filter((f) => f.kind !== 'count');
      this.count = null;
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
      if (st === 'tell' && O.move) {
        const kind = O.move.kind, p = ease(t / O.move.tellLen);
        const shiver = Math.sin(this.now / 30) * 3 * p;
        if (kind === 'jab') { L = { x: hx - 40, y: headY + 45, s: 0.9 }; lean = -0.03 * p; }
        else if (kind === 'hookL' || (kind === 'feint' && (O.move.side || (O.move.side = pick(['L', 'R']))) === 'L')) { L = { x: hx - 205 + shiver, y: headY - 5, s: 0.82 }; lean = -0.14 * p; sway = -30 * p; }
        else if (kind === 'hookR' || kind === 'feint') { R = { x: hx + 205 + shiver, y: headY - 5, s: 0.82 }; lean = 0.14 * p; sway = 30 * p; }
        else if (kind === 'upper') { R = { x: hx + 70 + shiver, y: chest + 150, s: 0.85 }; crouch = 40 * p; lean = 0.05; }
        else if (kind === 'body') { L = { x: hx - 95, y: chest + 120 + shiver, s: 0.85 }; crouch = 55 * p; }
        else if (kind === 'haymaker') { R = { x: hx + 150 + shiver, y: headY - 105, s: 0.78 }; lean = 0.2 * p; crouch = -18 * p; }
        else if (kind === 'taunt') { L = { x: hx - 150, y: chest + 120, s: 0.9 }; R = { x: hx + 150, y: chest + 120, s: 0.9 }; crouch = -10; }
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
      } else if (st === 'cover') {
        L = { x: hx - 30, y: headY + 20, s: 1.15 }; R = { x: hx + 30, y: headY + 24, s: 1.15 }; crouch = 14;
      } else if (st === 'taunt') {
        L = { x: hx - 150, y: chest + 140, s: 0.9 }; R = { x: hx + 150, y: chest + 140, s: 0.9 }; crouch = -12; sway = Math.sin(t / 90) * 18;
      } else if (st === 'down' || st === 'out') {
        L = { x: hx - 170, y: chest + 240, s: 0.9 }; R = { x: hx + 170, y: chest + 240, s: 0.9 };
      }
      O.gL = fast ? lerpG(O.gL, L, kF) : lerpG(O.gL, L, k);
      O.gR = fast ? lerpG(O.gR, R, kF) : lerpG(O.gR, R, k);
      if (st === 'strike') { O.gL = L.x !== undefined && (O.move && ['jab', 'hookL', 'body'].includes(O.move.kind)) ? L : O.gL; O.gR = (O.move && ['hookR', 'upper', 'haymaker'].includes(O.move.kind)) ? R : O.gR; }
      O.lean = lerp(O.lean, lean, k); O.crouch = lerp(O.crouch, crouch, k);
      O.sway = lerp(O.sway, sway, k);
      O.x = O.sway;
      O.headX = lerp(O.headX, 0, k * 0.8); O.headY = lerp(O.headY, 0, k * 0.8); O.tilt = lerp(O.tilt, 0, k * 0.8);
      O.hitFlash = Math.max(0, O.hitFlash - dt / 200);
      if (st === 'down' || st === 'out') O.fall = Math.min(1, O.fall + dt / 600); else O.fall = Math.max(0, O.fall - dt / 300);
    }

    updateFx(dt) {
      this.fx = this.fx.filter((f) => (f.life -= dt) > 0);
      for (const p of this.parts) { p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.life -= dt; }
      this.parts = this.parts.filter((p) => p.life > 0);
      this.bulbs = this.bulbs.filter((b) => (b.life -= dt) > 0);
      this.shake *= Math.pow(0.002, dt / 1000);
      this.flash = Math.max(0, this.flash - dt / 400);
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
    draw() {
      const c = this.ctx, dpr = this.dpr;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sx = this.shake ? rand(-this.shake, this.shake) : 0, sy = this.shake ? rand(-this.shake, this.shake) * 0.6 : 0;
      c.save();
      c.translate(sx, sy);
      this.drawArena(c);
      this.drawOpponent(c);
      this.drawTellAssist(c);
      this.drawPlayer(c);
      this.drawFx(c);
      c.restore();
      if (this.flash > 0) { c.fillStyle = `rgba(255,250,235,${this.flash})`; c.fillRect(0, 0, W, H); }
      if (this.P.hitFlash > 0) { c.fillStyle = `rgba(180,20,10,${this.P.hitFlash * 0.25})`; c.fillRect(0, 0, W, H); }
      if (this.count) this.drawCount(c);
      if (this.phase === 'down-you') this.drawMash(c);
    }

    drawArena(c) {
      const era = this.era;
      const bg = c.createLinearGradient(0, 0, 0, H);
      if (era === 'tv') { bg.addColorStop(0, '#0d0d0f'); bg.addColorStop(1, '#2a2a2e'); }
      else if (era === 'newsreel') { bg.addColorStop(0, '#1b1610'); bg.addColorStop(1, '#3d3122'); }
      else { bg.addColorStop(0, '#2b0c08'); bg.addColorStop(0.6, '#5a1a10'); bg.addColorStop(1, '#7a2615'); }
      c.fillStyle = bg; c.fillRect(-30, -30, W + 60, H + 60);
      // smoke and the hanging lights
      const g = c.createRadialGradient(480, -40, 20, 480, -40, 560);
      g.addColorStop(0, 'rgba(255,236,190,.55)'); g.addColorStop(0.5, 'rgba(255,220,160,.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      // crowd
      const t = this.now || 0;
      for (const p of this.crowd) {
        const bob = Math.sin(t / 300 + p.bob) * (2 + (this.excite || 0) * 30);
        const col = era === 'poster' ? shade('#3a120c', p.shade) : shade('#2a2621', p.shade);
        c.fillStyle = col;
        const x = p.x, y = p.y + bob, s = p.s;
        c.beginPath(); c.ellipse(x, y, 11 * s, 13 * s, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.moveTo(x - 20 * s, y + 40 * s); c.quadraticCurveTo(x, y + 6 * s, x + 20 * s, y + 40 * s); c.fill();
        if (p.hat) { c.fillRect(x - 15 * s, y - 9 * s, 30 * s, 4 * s); c.fillRect(x - 9 * s, y - 19 * s, 18 * s, 11 * s); }
      }
      for (const b of this.bulbs) {
        const a = b.life / 140;
        const gg = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, 40);
        gg.addColorStop(0, `rgba(255,255,255,${a})`); gg.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = gg; c.fillRect(b.x - 40, b.y - 40, 80, 80);
      }
      // ring posts and ropes (back)
      c.fillStyle = era === 'poster' ? '#e8d9b5' : '#d8d2c4';
      c.beginPath(); c.moveTo(120, 330); c.lineTo(840, 330); c.lineTo(980, 610); c.lineTo(-20, 610); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(23,19,15,.25)'; c.lineWidth = 2;
      for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(120 - i * 28, 330 + i * 56); c.lineTo(840 + i * 28, 330 + i * 56); c.stroke(); }
      const ropeCols = era === 'poster' ? ['#b8231b', '#f1e6cc', '#1f3f8f'] : ['#ddd', '#bbb', '#ddd'];
      for (const [i, y] of [240, 278, 316].entries()) {
        c.strokeStyle = INK; c.lineWidth = 8; c.beginPath(); c.moveTo(110, y); c.lineTo(850, y); c.stroke();
        c.strokeStyle = ropeCols[i]; c.lineWidth = 5; c.beginPath(); c.moveTo(110, y); c.lineTo(850, y); c.stroke();
      }
      for (const x of [104, 856]) { c.fillStyle = INK; c.fillRect(x - 10, 215, 20, 125); c.fillStyle = era === 'poster' ? '#e0a526' : '#999'; c.fillRect(x - 7, 218, 14, 119); }
    }

    drawOpponent(c) {
      const O = this.O, look = this.cfg.opp.look || {};
      const skin = D.SKINS[look.skin || 0], hair = D.HAIRS[look.hair || 0], trunks = D.TRUNKS[look.trunks == null ? 1 : look.trunks];
      const build = look.build || 1;
      const cx = 480 + O.x, crouch = O.crouch, fall = O.fall;
      c.save();
      if (fall > 0) {
        c.translate(cx, 560);
        c.rotate(fall * 0.28 * (O.tilt >= 0 ? 1 : -1));
        c.translate(-cx, -560 + fall * 120);
        c.globalAlpha = 1;
      }
      c.translate(cx, 0); c.rotate(O.lean * 0.6); c.translate(-cx, 0);
      const headY = 170 + crouch * 0.8 + O.headY, shY = 245 + crouch, waistY = 395 + crouch * 0.4, trunkY = 455;
      const shW = 128 * build, waW = 82 * build;
      // legs
      c.fillStyle = skin; c.strokeStyle = INK; c.lineWidth = 5; c.lineJoin = 'round';
      for (const s of [-1, 1]) {
        c.beginPath(); c.moveTo(cx + s * 20, trunkY); c.lineTo(cx + s * 72, trunkY); c.lineTo(cx + s * 80, 600); c.lineTo(cx + s * 26, 600); c.closePath(); c.fill(); c.stroke();
      }
      // trunks
      c.fillStyle = trunks; c.beginPath(); c.moveTo(cx - waW - 6, waistY); c.lineTo(cx + waW + 6, waistY); c.lineTo(cx + waW + 22, trunkY + 30); c.lineTo(cx + 6, trunkY + 22); c.lineTo(cx - 6, trunkY + 22); c.lineTo(cx - waW - 22, trunkY + 30); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = shade(trunks, -0.3); c.fillRect(cx - waW - 6, waistY, (waW + 6) * 2, 16); c.strokeRect(cx - waW - 6, waistY, (waW + 6) * 2, 16);
      // torso
      const tg = c.createLinearGradient(cx - shW, 0, cx + shW, 0);
      tg.addColorStop(0, shade(skin, -0.22)); tg.addColorStop(0.35, skin); tg.addColorStop(0.7, skin); tg.addColorStop(1, shade(skin, -0.28));
      c.fillStyle = tg;
      c.beginPath(); c.moveTo(cx - shW, shY + 10); c.quadraticCurveTo(cx - shW - 6, shY - 18, cx - shW * 0.55, shY - 22); c.lineTo(cx + shW * 0.55, shY - 22); c.quadraticCurveTo(cx + shW + 6, shY - 18, cx + shW, shY + 10);
      c.quadraticCurveTo(cx + waW + 18, shY + 90, cx + waW, waistY + 2); c.lineTo(cx - waW, waistY + 2); c.quadraticCurveTo(cx - waW - 18, shY + 90, cx - shW, shY + 10); c.closePath(); c.fill(); c.stroke();
      // muscle lines
      c.strokeStyle = rgba('#17130f', 0.45); c.lineWidth = 3;
      c.beginPath(); c.moveTo(cx - 70 * build, shY + 48); c.quadraticCurveTo(cx - 30, shY + 70, cx - 4, shY + 50); c.moveTo(cx + 70 * build, shY + 48); c.quadraticCurveTo(cx + 30, shY + 70, cx + 4, shY + 50); c.stroke();
      c.beginPath(); c.moveTo(cx, shY + 60); c.lineTo(cx, waistY - 10);
      for (const yy of [shY + 95, shY + 125]) { c.moveTo(cx - 26, yy); c.quadraticCurveTo(cx, yy + 6, cx + 26, yy); }
      c.stroke();
      if (O.hitFlash > 0) { c.fillStyle = `rgba(255,255,255,${O.hitFlash * 0.35})`; c.fill(); }
      // arms (behind gloves)
      this.drawArm(c, cx - shW + 14, shY + 4, O.gL, skin, -1);
      this.drawArm(c, cx + shW - 14, shY + 4, O.gR, skin, 1);
      // neck + head
      const hx = cx + O.headX;
      c.fillStyle = shade(skin, -0.12); c.strokeStyle = INK; c.lineWidth = 5;
      c.beginPath(); c.moveTo(hx - 28, headY + 40); c.lineTo(hx + 28, headY + 40); c.lineTo(hx + 36, shY - 16); c.lineTo(hx - 36, shY - 16); c.closePath(); c.fill(); c.stroke();
      this.drawHead(c, hx, headY, skin, hair, look, O);
      // gloves on top, the far one first
      const order = O.gL.s > O.gR.s ? [O.gR, O.gL] : [O.gL, O.gR];
      for (const gl of order) this.drawGlove(c, gl.x + O.x, gl.y, 44 * gl.s, this.era === 'poster' ? '#7a3b1c' : '#a3221a', gl === O.gL ? -1 : 1);
      // tell glint
      if (O.state === 'tell' && O.move && O.move.kind !== 'jab') {
        const gl = ['hookL', 'body', 'feint'].includes(O.move.kind) && (O.move.kind !== 'feint' || O.move.side === 'L') ? O.gL : O.gR;
        const p = clamp(O.t / O.move.tellLen, 0, 1);
        c.save(); c.globalAlpha = 0.35 + 0.6 * Math.abs(Math.sin(O.t / 70));
        c.strokeStyle = '#fff6d8'; c.lineWidth = 4;
        c.beginPath(); c.arc(gl.x + O.x, gl.y, 44 * gl.s + 10 + p * 8, 0, Math.PI * 2); c.stroke();
        if (O.move.kind === 'haymaker') this.star(c, gl.x + O.x + 30, gl.y - 40, 18 + p * 10, '#fff6d8');
        c.restore();
      }
      if (fall > 0.6 && (O.state === 'down' || O.state === 'out')) { // stars around the head
        for (let i = 0; i < 4; i++) { const a = (this.now / 300) + i * 1.57; this.star(c, hx + Math.cos(a) * 60, headY - 30 + Math.sin(a) * 16, 10, '#ffe27a'); }
      }
      c.restore();
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
        c.fillStyle = '#fbf6e8'; c.beginPath(); c.ellipse(ex, ey, 10, angry ? 6 : 8, 0, 0, Math.PI * 2); c.fill(); c.stroke();
        const px = clamp((this.P.x / 175) * 4, -4, 4);
        c.fillStyle = INK; c.beginPath(); c.arc(ex + px, ey + 1, 3.6, 0, Math.PI * 2); c.fill();
      }
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
      if (this.assist === 'champ' || O.state !== 'tell' || !O.move) return;
      const mv = MOVES[O.move.kind];
      if (this.assist === 'normal' && (this.round > 1 || O.move.kind === 'jab')) return;
      const x = 480 + O.x, y = 64;
      c.save();
      c.fillStyle = 'rgba(241,230,204,.92)'; c.strokeStyle = INK; c.lineWidth = 3;
      c.beginPath(); c.roundRect ? c.roundRect(x - 90, y - 22, 180, 44, 8) : c.rect(x - 90, y - 22, 180, 44); c.fill(); c.stroke();
      c.fillStyle = INK; c.font = '700 20px Oswald, "Arial Narrow", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const label = { jab: 'JAB · slip', hookL: 'HOOK → slip right', hookR: '← HOOK slip left', upper: 'UPPERCUT · slip ←→', body: 'BODY · slip or guard', haymaker: 'HAYMAKER · MOVE!', feint: 'FAKE? wait…', taunt: 'TAUNT · hit him!' }[O.move.kind] || mv.name;
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
        const sx = cx + s * 112, sy = by - 64;
        const thick = 30 + 16 * g.s;
        c.strokeStyle = rim; c.lineWidth = thick + 8; c.beginPath(); c.moveTo(sx, sy); c.lineTo(g.x, g.y + 26 * g.s); c.stroke();
        c.strokeStyle = back; c.lineWidth = thick; c.beginPath(); c.moveTo(sx, sy); c.lineTo(g.x, g.y + 26 * g.s); c.stroke();
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
      // gloves
      const gcol = trunks === '#b8231b' ? '#1f3f8f' : '#b8231b';
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

  function mix(a, b, k) { return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), s: lerp(a.s, b.s, k) }; }
  function lerpG(a, b, k) { return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), s: lerp(a.s, b.s, k) }; }
  function arc(a, b, k, dir) { const m = mix(a, b, k); m.x += Math.sin(k * Math.PI) * 60 * dir * -1; m.y -= Math.sin(k * Math.PI) * 30; return m; }
  function esc(s) { return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]); }
  void makeHalftone;
})(globalThis.TOT = globalThis.TOT || {});
