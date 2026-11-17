// The gym's mini games. Each one is tied to a kind of move: Strike the mark (timing) for quick typed hits, Charge up
// (hold and release) for shields and stamina moves, Combo (arrow rhythm) for the big hits, and Target practice (aim)
// for Quick jab. Each round scores 0 to 100. Keyboard and touch both work. Nothing here talks to the server; the page
// sends the final score.
(() => {
  'use strict';
  const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const el = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; if (parent) parent.appendChild(e); return e; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // Shared plumbing: listeners that come off when the round ends, a stop switch, and pop up words.
  function harness(stage, onScore) {
    const offs = [];
    let stopped = false, total = 0;
    return {
      on(target, type, fn, opts) { target.addEventListener(type, fn, opts); offs.push(() => target.removeEventListener(type, fn, opts)); },
      add(points, word, x, y) {
        total += points; onScore?.(Math.round(total));
        if (word) { const p = el('span', 'gm-pop', stage, word); p.style.left = `${x}%`; p.style.top = `${y}%`; p.animate?.([{ opacity: 1, transform: 'translate(-50%,-50%)' }, { opacity: 0, transform: 'translate(-50%,-120%)' }], { duration: 700 }).finished.then(() => p.remove(), () => p.remove()); }
      },
      get stopped() { return stopped; },
      stop() { stopped = true; offs.forEach((f) => f()); },
      get total() { return Math.max(0, Math.min(100, Math.round(total))); },
    };
  }
  const press = (h, stage, fn, keys = ['Space', 'Enter']) => {
    h.on(window, 'keydown', (e) => { if (keys.includes(e.code) && !e.repeat) { e.preventDefault(); fn(e.code); } });
    h.on(stage, 'pointerdown', (e) => { e.preventDefault(); fn('pointer', e); });
  };

  // Strike the mark: stop the sweeping marker inside the bright zone. Five tries, each faster with a smaller zone.
  async function timing(stage, r, h) {
    const track = el('div', 'gm-track', stage), zone = el('div', 'gm-zone', track), core = el('div', 'gm-zone core', track), marker = el('div', 'gm-marker', track);
    const left = el('div', 'gm-left', stage);
    for (let i = 0; i < 5 && !h.stopped; i++) {
      left.textContent = `Try ${i + 1} of 5`;
      const center = 0.2 + r() * 0.6, half = 0.13 - i * 0.015, coreHalf = 0.035, period = 2300 - i * 260;
      Object.assign(zone.style, { left: `${(center - half) * 100}%`, width: `${half * 200}%` });
      Object.assign(core.style, { left: `${(center - coreHalf) * 100}%`, width: `${coreHalf * 200}%` });
      const start = performance.now(), phase = r();
      let pos = 0, done = false;
      const hit = new Promise((res) => press(h, stage, () => { if (!done) { done = true; res(); } }));
      const timeout = wait(period * 3).then(() => { done = true; });
      const loop = () => { if (done || h.stopped) return; const t = ((performance.now() - start) / period + phase) % 1; pos = t < 0.5 ? t * 2 : 2 - t * 2; marker.style.left = `${pos * 100}%`; requestAnimationFrame(loop); };
      loop();
      await Promise.race([hit, timeout]);
      done = true;
      const d = Math.abs(pos - center);
      if (d <= coreHalf) h.add(20, 'Perfect!', pos * 88 + 6, 30);
      else if (d <= half) h.add(10 + 10 * (1 - d / half), 'Good', pos * 88 + 6, 30);
      else h.add(Math.max(0, 6 * (1 - (d - half) / 0.15)), 'Miss', pos * 88 + 6, 30);
      await wait(650);
    }
  }

  // Charge up: hold to fill the gauge, let go inside the band. Five tries, the gauge fills faster each time.
  async function hold(stage, r, h) {
    const gauge = el('div', 'gm-gauge', stage), band = el('div', 'gm-band', gauge), fill = el('i', '', gauge);
    const btn = el('button', 'gm-hold', stage, 'Hold to charge');
    btn.type = 'button';
    const left = el('div', 'gm-left', stage);
    for (let i = 0; i < 5 && !h.stopped; i++) {
      left.textContent = `Try ${i + 1} of 5`;
      const mid = 0.4 + r() * 0.45, half = 0.08 - i * 0.008, rate = 1 / (1700 - i * 180);
      Object.assign(band.style, { bottom: `${(mid - half) * 100}%`, height: `${half * 200}%` });
      let level = 0, holding = false, last = performance.now(), done = false;
      fill.style.height = '0%';
      const result = new Promise((res) => {
        const down = (e) => { if (done) return; if (e?.preventDefault) e.preventDefault(); holding = true; };
        const up = () => { if (done || !holding) return; done = true; res(); };
        h.on(window, 'keydown', (e) => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); down(); } });
        h.on(window, 'keyup', (e) => { if (e.code === 'Space') up(); });
        h.on(btn, 'pointerdown', down); h.on(stage, 'pointerdown', down);
        h.on(window, 'pointerup', up); h.on(window, 'pointercancel', up);
      });
      const loop = () => {
        if (done || h.stopped) return;
        const now = performance.now(), dt = now - last; last = now;
        if (holding) level = Math.min(1.02, level + dt * rate);
        fill.style.height = `${Math.min(100, level * 100)}%`;
        if (level >= 1.02) { done = true; }
        requestAnimationFrame(loop);
      };
      loop();
      await Promise.race([result, wait(9000), new Promise((res) => { const chk = () => (done ? res() : setTimeout(chk, 50)); chk(); })]);
      done = true;
      const d = Math.abs(level - mid);
      if (level >= 1) h.add(0, 'Too much!', 50, 20);
      else if (d <= half * 0.35) h.add(20, 'Perfect!', 50, 20);
      else if (d <= half) h.add(12 + 8 * (1 - d / half), 'Good', 50, 20);
      else h.add(Math.max(0, 8 - (d - half) * 60), level === 0 ? 'Hold it!' : 'Miss', 50, 20);
      await wait(700);
    }
  }

  // Combo: press the arrow that lights up before its ring closes. Ten prompts, each a little quicker.
  async function rhythm(stage, r, h) {
    const ARROWS = [['ArrowUp', '▲'], ['ArrowRight', '▶'], ['ArrowDown', '▼'], ['ArrowLeft', '◀']];
    const arrow = el('div', 'gm-arrow', stage), ring = el('div', 'gm-ring', stage);
    const pads = el('div', 'gm-pads', stage);
    let pressed = null;
    for (const [code, sym] of ARROWS) { const b = el('button', 'ghost', pads, sym); b.type = 'button'; b.setAttribute('aria-label', code.replace('Arrow', '')); h.on(b, 'pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); pressed = code; }); }
    h.on(window, 'keydown', (e) => { if (ARROWS.some(([c]) => c === e.code) && !e.repeat) { e.preventDefault(); pressed = e.code; } });
    const left = el('div', 'gm-left', stage);
    for (let i = 0; i < 10 && !h.stopped; i++) {
      left.textContent = `${i + 1} of 10`;
      const [code, sym] = ARROWS[Math.floor(r() * 4)];
      arrow.textContent = sym;
      const dur = 1700 - i * 80, start = performance.now();
      pressed = null;
      let size = 240;
      await new Promise((res) => {
        const loop = () => {
          if (h.stopped) return res();
          const t = (performance.now() - start) / dur;
          size = 240 - 180 * Math.min(1, t);
          Object.assign(ring.style, { width: `${size}px`, height: `${size}px` });
          if (pressed || t >= 1.08) return res();
          requestAnimationFrame(loop);
        };
        loop();
      });
      if (pressed === code) { if (size <= 100) h.add(10, 'Perfect!', 50, 22); else h.add(6, 'Good', 50, 22); }
      else h.add(0, pressed ? 'Wrong arrow' : 'Too slow', 50, 22);
      arrow.textContent = '';
      await wait(260);
    }
  }

  // Target practice: tap each target before it vanishes. Twelve targets; a fast tap is worth more.
  async function aim(stage, r, h) {
    const left = el('div', 'gm-left', stage);
    const live = [];
    for (let i = 0; i < 12 && !h.stopped; i++) {
      left.textContent = `${i + 1} of 12`;
      const life = 1500 - i * 55, x = 10 + r() * 80, y = 14 + r() * 72;
      const t = el('button', 'gm-target', stage); t.type = 'button'; t.setAttribute('aria-label', 'Target');
      Object.assign(t.style, { left: `${x}%`, top: `${y}%` });
      const born = performance.now();
      live.push(t);
      h.on(t, 'pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!t.isConnected) return;
        const quick = 1 - Math.min(1, (performance.now() - born) / life);
        h.add(5 + 3.33 * quick, quick > 0.5 ? 'Bullseye!' : 'Hit', x, y);
        t.remove();
      });
      setTimeout(() => t.remove(), life);
      await wait(Math.max(450, 820 - i * 25));
    }
    await wait(1500);
    live.forEach((t) => t.remove());
  }

  const GAMES = { timing, hold, rhythm, aim };
  // Plays one round in stage. Returns { done: Promise<score 0 to 100>, stop() }.
  function play(stage, game, seed, onScore) {
    stage.textContent = '';
    const h = harness(stage, onScore);
    const run = GAMES[game] || timing;
    const done = run(stage, rng(seed || 1), h).then(() => { const s = h.total; h.stop(); return s; }, () => { h.stop(); return 0; });
    return { done, stop: () => h.stop() };
  }
  window.CheckaverseGym = { play, games: Object.keys(GAMES) };
})();
