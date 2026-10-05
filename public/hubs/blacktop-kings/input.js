/* Blacktop Kings — controls. Keyboard, gamepads, and on-screen touch buttons all feed the same
   controller shape: { x, y, shoot, pass, trick, turbo, oop, crown, pause } plus `hit` for buttons
   pressed this frame. x/y are screen directions (right and down are positive). */
(function (BK) {
  'use strict';
  const down = new Set();
  const BUTTONS = ['shoot', 'pass', 'trick', 'turbo', 'oop', 'crown', 'pause'];

  const LAYOUTS = {
    solo: {
      up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
      shoot: ['KeyJ', 'KeyZ'], pass: ['KeyK', 'KeyX'], trick: ['KeyL', 'KeyC'], oop: ['KeyI', 'KeyV'], crown: ['KeyO', 'KeyB'],
      turbo: ['ShiftLeft', 'ShiftRight', 'Space'], pause: ['Escape', 'KeyP'],
    },
    p1: {
      up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
      shoot: ['KeyF'], pass: ['KeyG'], trick: ['KeyH'], oop: ['KeyR'], crown: ['KeyT'], turbo: ['ShiftLeft', 'Space'], pause: ['Escape'],
    },
    p2: {
      up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
      shoot: ['Comma'], pass: ['Period'], trick: ['Slash'], oop: ['KeyL'], crown: ['Semicolon'], turbo: ['KeyM', 'ShiftRight'], pause: ['Backspace'],
    },
  };
  // Human-readable labels for the help screens.
  BK.KEYS = {
    solo: { move: 'WASD / Arrows', shoot: 'J or Z', pass: 'K or X', trick: 'L or C', oop: 'I or V', crown: 'O or B', turbo: 'Shift or Space', pause: 'Esc or P' },
    p1: { move: 'WASD', shoot: 'F', pass: 'G', trick: 'H', oop: 'R', crown: 'T', turbo: 'Left Shift or Space', pause: 'Esc' },
    p2: { move: 'Arrows', shoot: ', (comma)', pass: '. (period)', trick: '/', oop: 'L', crown: ';', turbo: 'M or Right Shift', pause: 'Backspace' },
    pad: { move: 'Left stick / D-pad', shoot: 'X (left button)', pass: 'A (bottom)', trick: 'B (right)', oop: 'Y (top)', crown: 'LB or LT', turbo: 'RB or RT', pause: 'Start' },
  };

  const GAME_CODES = new Set();
  Object.values(LAYOUTS).forEach((l) => Object.values(l).forEach((codes) => codes.forEach((c) => GAME_CODES.add(c))));
  let capturing = false; // true while a match runs, so arrow keys and space do not scroll the page

  // Every keydown gets a sequence number, so a tap that starts and ends between two frames still counts.
  // Press and release times are kept too, so a held shot is timed to the millisecond, not the frame.
  const pressedAt = new Map(); let seq = 0;
  const downTime = new Map(), upTime = new Map();
  window.addEventListener('keydown', (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    down.add(e.code);
    if (!e.repeat) { pressedAt.set(e.code, ++seq); downTime.set(e.code, e.timeStamp); }
    if (capturing && GAME_CODES.has(e.code)) e.preventDefault();
  }, { passive: false });
  window.addEventListener('keyup', (e) => { down.delete(e.code); upTime.set(e.code, e.timeStamp); });
  window.addEventListener('blur', () => down.clear());

  // ---------- touch ----------
  const touch = { x: 0, y: 0, shoot: false, pass: false, trick: false, turbo: false, oop: false, crown: false, pause: false, active: false, downT: {}, upT: {} };
  let touchHost = null; let touchOn = false;
  function buildTouch(host) {
    if (touchHost) return touchHost;
    const wrap = document.createElement('div');
    wrap.className = 'touchpad';
    wrap.innerHTML = `
      <div class="stick" data-stick><div class="stick-knob"></div></div>
      <div class="pad-buttons">
        <button type="button" data-b="crown" class="pb pb-crown">Crown</button>
        <button type="button" data-b="oop" class="pb pb-oop">Oop</button>
        <button type="button" data-b="trick" class="pb pb-trick">Trick</button>
        <button type="button" data-b="pass" class="pb pb-pass">Pass</button>
        <button type="button" data-b="turbo" class="pb pb-turbo">Turbo</button>
        <button type="button" data-b="shoot" class="pb pb-shoot">Shoot</button>
      </div>`;
    host.appendChild(wrap);
    const stick = wrap.querySelector('[data-stick]'); const knob = wrap.querySelector('.stick-knob');
    let stickId = null, cx = 0, cy = 0;
    stick.addEventListener('pointerdown', (e) => {
      stickId = e.pointerId; stick.setPointerCapture(e.pointerId);
      const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; move(e); e.preventDefault();
    });
    const move = (e) => {
      if (e.pointerId !== stickId) return;
      const r = stick.getBoundingClientRect(); const max = r.width * 0.38;
      let dx = e.clientX - cx, dy = e.clientY - cy; const m = Math.hypot(dx, dy);
      if (m > max) { dx = dx / m * max; dy = dy / m * max; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      touch.x = dx / max; touch.y = dy / max; touch.active = true;
    };
    stick.addEventListener('pointermove', move);
    const end = (e) => { if (e.pointerId !== stickId) return; stickId = null; touch.x = 0; touch.y = 0; knob.style.transform = ''; };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    wrap.querySelectorAll('[data-b]').forEach((b) => {
      const k = b.dataset.b;
      b.addEventListener('pointerdown', (e) => { touch[k] = true; touch.downT[k] = e.timeStamp; touch.active = true; b.classList.add('on'); b.setPointerCapture(e.pointerId); e.preventDefault(); });
      const up = (e) => { if (touch[k]) touch.upT[k] = e && e.timeStamp ? e.timeStamp : performance.now(); touch[k] = false; b.classList.remove('on'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    });
    touchHost = wrap;
    return wrap;
  }

  // ---------- gamepads ----------
  function pads() {
    try { return Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean); } catch (e) { return []; }
  }
  function readPad(gp) {
    const b = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.4));
    let x = gp.axes[0] || 0, y = gp.axes[1] || 0;
    if (Math.hypot(x, y) < 0.22) { x = 0; y = 0; }
    if (b(14)) x = -1; if (b(15)) x = 1; if (b(12)) y = -1; if (b(13)) y = 1;
    return { x, y, shoot: b(2), pass: b(0), trick: b(1), oop: b(3), crown: b(4) || b(6), turbo: b(5) || b(7), pause: b(9) };
  }

  // A controller reads one keyboard layout plus (optionally) one gamepad and touch.
  function Controller(opts) {
    this.layout = LAYOUTS[opts.layout] || null;
    this.padIndex = opts.pad == null ? null : opts.pad; // 'any', a number, or null
    this.useTouch = !!opts.touch;
    this.state = { x: 0, y: 0 }; this.prev = {}; this.hit = {}; this.released = {};
    this.pressT = {}; this.releaseT = {}; // when each button last went down and up (ms, performance.now clock)
    BUTTONS.forEach((k) => { this.state[k] = false; this.prev[k] = false; });
    this.lastSource = 'keys';
    this.seq = seq; // taps from before this controller existed don't count
  }
  Controller.prototype.poll = function () {
    const s = { x: 0, y: 0 };
    BUTTONS.forEach((k) => { s[k] = false; });
    const L = this.layout;
    if (L) {
      const since = this.seq || 0;
      const any = (codes) => codes.some((c) => down.has(c) || (pressedAt.get(c) || 0) > since);
      if (any(L.left)) s.x -= 1; if (any(L.right)) s.x += 1; if (any(L.up)) s.y -= 1; if (any(L.down)) s.y += 1;
      BUTTONS.forEach((k) => { if (L[k] && any(L[k])) s[k] = true; });
      if (s.x || s.y || BUTTONS.some((k) => s[k])) this.lastSource = 'keys';
    }
    if (this.padIndex != null) {
      const list = pads();
      const gps = this.padIndex === 'any' ? list : list.filter((g) => g.index === this.padIndex);
      gps.forEach((gp) => {
        const p = readPad(gp);
        if (p.x || p.y) { s.x = p.x; s.y = p.y; this.lastSource = 'pad'; }
        BUTTONS.forEach((k) => { if (p[k]) { s[k] = true; this.lastSource = 'pad'; } });
      });
    }
    if (this.useTouch && touch.active) {
      if (touch.x || touch.y) { s.x = touch.x; s.y = touch.y; }
      BUTTONS.forEach((k) => { if (touch[k]) s[k] = true; });
    }
    this.seq = seq;
    const m = Math.hypot(s.x, s.y); if (m > 1) { s.x /= m; s.y /= m; }
    const now = performance.now();
    // the real moment a button moved: the newest key or touch event for it, or now for a gamepad
    const stamp = (k, keyTimes, touchTimes) => {
      let t = -1;
      if (L && L[k]) L[k].forEach((c) => { const v = keyTimes.get(c); if (v != null && v > t && v <= now) t = v; });
      if (this.useTouch && touchTimes[k] != null && touchTimes[k] > t && touchTimes[k] <= now) t = touchTimes[k];
      return t > now - 250 ? t : now;
    };
    BUTTONS.forEach((k) => {
      // edges stay set until a game step consumes them (clearEdges), so fast frames can't eat a press
      const went = s[k] && !this.prev[k], lifted = !s[k] && this.prev[k];
      if (went) this.pressT[k] = stamp(k, downTime, touch.downT);
      if (lifted) this.releaseT[k] = stamp(k, upTime, touch.upT);
      this.hit[k] = this.hit[k] || went;
      this.released[k] = this.released[k] || lifted;
      this.prev[k] = s[k];
    });
    this.state = s;
    return s;
  };
  Controller.prototype.clearEdges = function () { BUTTONS.forEach((k) => { this.hit[k] = false; this.released[k] = false; }); };

  BK.input = {
    Controller,
    capture(on) { capturing = !!on; },
    buildTouch,
    showTouch(on) { touchOn = !!on; if (touchHost) touchHost.hidden = !on; },
    touchVisible: () => touchOn,
    // Phones and tablets: a touchscreen and no mouse or trackpad. Touchscreen laptops keep the keyboard.
    isTouchDevice: () => (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && !(window.matchMedia && window.matchMedia('(any-pointer: fine)').matches),
    padCount: () => pads().length,
    padIndices: () => pads().map((g) => g.index),
    anyPadButton() { return pads().some((gp) => gp.buttons.some((b) => b.pressed)); },
  };
})(window.BK = window.BK || {});
