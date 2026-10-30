(() => {
  'use strict';
  const TILE = 32;
  const canvas = document.getElementById('town');
  const ctx = canvas.getContext('2d');
  const SCALE = 2; // the canvas has two pixels for every map pixel so the 2x art stays sharp
  const VIEW_W = canvas.width / SCALE, VIEW_H = canvas.height / SCALE;
  // Rooms are small, so the camera moves in closer inside a house.
  const zoom = () => (roomKind === 'house' ? 1.6 : 1);
  const $ = (id) => document.getElementById(id);
  const statusEl = $('status'), meEl = $('me'), toastEl = $('toast'), askEl = $('ask'), askText = $('askText');
  const busyEl = $('busy'), challengeBtn = $('challenge'), phrasesEl = $('phrases');
  const placeEl = $('place'), lockBtn = $('lock'), homeEl = $('home');

  let ws = null, me = 0, retry = 0, pendingFrom = 0, toastTimer = 0;
  let town = null, house = null, phrases = [], myPlot = 0;
  let room = 'town', roomKind = 'town', roomOwner = null;
  let plots = []; // live state: {id, owner, name, locked}
  const players = new Map(); // id -> {id,name,x,y,f,c,busy, dx,dy, bubble, bubbleUntil}
  let cam = { x: 0, y: 0 };

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3500);
  }
  function setStatus(text, down) { statusEl.textContent = text; statusEl.classList.toggle('down', Boolean(down)); }
  function send(msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }
  const live = (id) => plots.find((p) => p.id === id) || { owner: 0, name: '', locked: false };
  function countLine() {
    const n = players.size;
    const where = roomKind === 'town' ? 'here' : 'in this house';
    setStatus(`Live · ${n} trainer${n === 1 ? '' : 's'} ${where}`);
  }
  function placeLine() {
    if (roomKind === 'town') placeEl.textContent = 'Town';
    else if (roomOwner && roomOwner.owner === me) placeEl.textContent = 'Your house';
    else placeEl.textContent = `${roomOwner?.name || 'A trainer'}'s house`;
  }
  function homeLine() {
    if (!myPlot) { homeEl.textContent = 'No free plot right now'; lockBtn.hidden = true; return; }
    const mine = live(myPlot);
    homeEl.textContent = `Your house is on plot ${myPlot} in the Neighborhood`;
    lockBtn.hidden = false;
    lockBtn.textContent = mine.locked ? 'Unlock my door' : 'Lock my door';
    lockBtn.setAttribute('aria-pressed', String(mine.locked));
  }

  function setPlayers(list) {
    players.clear();
    for (const p of list) players.set(p.id, { ...p, dx: p.x, dy: p.y });
  }

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    setStatus(retry ? 'Reconnecting...' : 'Connecting...');
    ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } handle(m); };
    ws.onopen = () => { retry = 0; };
    ws.onclose = () => {
      players.clear();
      hideAsk();
      const wait = Math.min(15000, 1000 * 2 ** retry++);
      setStatus(`The Checkaverse bus is not running right now. Trying again in ${Math.round(wait / 1000)}s.`, true);
      setTimeout(connect, wait);
    };
  }

  function handle(m) {
    switch (m.t) {
      case 'welcome':
        me = m.you; town = m.town; house = m.house; phrases = m.phrases; myPlot = m.myPlot;
        room = 'town'; roomKind = 'town'; roomOwner = null;
        setPlayers(m.players);
        meEl.textContent = players.get(me)?.name || 'Trainer';
        buildPhrases();
        busyEl.checked = false;
        countLine(); placeLine(); homeLine();
        snapCamera();
        break;
      case 'room':
        room = m.room; roomKind = m.kind; roomOwner = m.owner;
        setPlayers(m.players);
        hideAsk();
        countLine(); placeLine();
        snapCamera();
        if (roomKind === 'house') toast(roomOwner && roomOwner.owner === me ? 'Welcome home.' : `You stepped into ${roomOwner?.name || 'a trainer'}'s house. Look, but do not touch.`);
        break;
      case 'plots': plots = m.plots; homeLine(); break;
      case 'join': players.set(m.p.id, { ...m.p, dx: m.p.x, dy: m.p.y }); countLine(); break;
      case 'leave': players.delete(m.id); if (pendingFrom === m.id) hideAsk(); countLine(); break;
      case 'pos': { const p = players.get(m.id); if (p) { p.x = m.x; p.y = m.y; p.f = m.f; } break; }
      case 'busy': { const p = players.get(m.id); if (p) p.busy = m.v; break; }
      case 'say': {
        const p = players.get(m.id);
        if (p) { p.bubble = phrases[m.p]; p.bubbleUntil = performance.now() + 3500; }
        break;
      }
      case 'challenged':
        pendingFrom = m.from;
        askText.textContent = `${m.name} wants to battle!`;
        askEl.hidden = false;
        $('askYes').focus();
        setTimeout(() => { if (pendingFrom === m.from) hideAsk(); }, m.ttl || 20000);
        break;
      case 'challenge_result': toast(m.msg); break;
      case 'notice': toast(m.msg); break;
      default: break;
    }
  }

  function buildPhrases() {
    phrasesEl.textContent = '';
    phrases.forEach((text, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.addEventListener('click', () => send({ t: 'say', p: i }));
      phrasesEl.appendChild(b);
    });
  }

  function hideAsk() { askEl.hidden = true; pendingFrom = 0; }
  function answer(ok) { if (pendingFrom) send({ t: 'answer', from: pendingFrom, ok }); hideAsk(); }
  $('askYes').addEventListener('click', () => answer(true));
  $('askNo').addEventListener('click', () => answer(false));
  busyEl.addEventListener('change', () => send({ t: 'busy', v: busyEl.checked }));
  lockBtn.addEventListener('click', () => send({ t: 'lock', v: !live(myPlot).locked }));

  // The trainer to challenge: the one straight ahead first, then anyone next to you.
  const AHEAD = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
  function neighbor() {
    const self = players.get(me);
    if (!self) return null;
    const a = AHEAD[self.f] || [0, 1];
    let best = null;
    for (const p of players.values()) {
      if (p.id === me) continue;
      if (Math.abs(p.x - self.x) + Math.abs(p.y - self.y) > 1) continue;
      if (p.x === self.x + a[0] && p.y === self.y + a[1]) return p;
      if (!best) best = p;
    }
    return best;
  }
  function challenge() {
    const n = neighbor();
    if (!n) return toast('Walk up next to a trainer to challenge them.');
    send({ t: 'challenge', to: n.id });
  }
  challengeBtn.addEventListener('click', challenge);

  // Held keys repeat at the server's walking speed.
  const KEYS = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
  const held = [];
  let lastStep = 0;
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement && e.code === 'Space') return;
    if (!askEl.hidden) return;
    const d = KEYS[e.code];
    if (d) { e.preventDefault(); if (!held.includes(d)) held.push(d); return; }
    if (e.code === 'KeyC' && !e.repeat) challenge();
  });
  window.addEventListener('keyup', (e) => { const i = held.indexOf(KEYS[e.code]); if (i >= 0) held.splice(i, 1); });
  window.addEventListener('blur', () => { held.length = 0; });
  document.querySelectorAll('.pad button').forEach((b) => {
    const d = b.dataset.d;
    const down = (e) => { e.preventDefault(); if (!held.includes(d)) held.push(d); };
    const up = () => { const i = held.indexOf(d); if (i >= 0) held.splice(i, 1); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointerleave', up);
    b.addEventListener('pointercancel', up);
  });
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const tx = Math.floor((((e.clientX - r.left) / r.width) * VIEW_W / zoom() + cam.x) / TILE);
    const ty = Math.floor((((e.clientY - r.top) / r.height) * VIEW_H / zoom() + cam.y) / TILE);
    for (const p of players.values()) if (p.id !== me && p.x === tx && p.y === ty) return send({ t: 'challenge', to: p.id });
  });

  // ---------- camera ----------
  const rows = () => (roomKind === 'town' ? town?.rows : house?.rows) || [];
  function cameraTarget() {
    const r = rows();
    const mapW = (r[0]?.length || 0) * TILE, mapH = r.length * TILE;
    const self = players.get(me);
    const cx = self ? self.dx * TILE + TILE / 2 : mapW / 2;
    const cy = self ? self.dy * TILE + TILE / 2 : mapH / 2;
    const clamp = (v, size, view) => (size <= view ? (size - view) / 2 : Math.max(0, Math.min(size - view, v - view / 2)));
    return { x: clamp(cx, mapW, VIEW_W / zoom()), y: clamp(cy, mapH, VIEW_H / zoom()) };
  }
  function snapCamera() { cam = cameraTarget(); }

  // ---------- art ----------
  // Sprite Book art is stored at 2x (64 pixels a tile). If a picture fails to load, the old shapes stand in for it.
  const ART_NAMES = [
    'tile-grass', 'tile-path', 'tile-water', 'prop-tree', 'prop-bush', 'prop-rock', 'prop-lantern', 'prop-bench',
    'prop-bus-stop', 'prop-bus', 'prop-notice-board', 'ui-bubble', 'hood-plot', 'house-cottage', 'house-stump',
    'house-creek', 'hood-locked', 'hood-mailbox', 'house-interior', 'market-stall', 'merge-stone', 'arena',
    'trainer-a', 'trainer-b', 'trainer-c', 'trainer-d',
  ];
  const ART = {};
  let artWaiting = ART_NAMES.length;
  let ground = null, groundKey = '';
  for (const name of ART_NAMES) {
    const im = new Image();
    im.onload = im.onerror = () => { artWaiting--; ground = null; };
    im.src = `/art/${name}.png`;
    ART[name] = im;
  }
  const has = (name) => ART[name] && ART[name].complete && ART[name].naturalWidth > 0;
  const TRAINERS = ['trainer-a', 'trainer-b', 'trainer-c', 'trainer-d'];
  const HOUSES = ['house-cottage', 'house-stump', 'house-creek'];
  const FACE_ROW = { d: 0, u: 1, l: 2, r: 3 };
  const OUTLINE = '#2b1a12';

  // Draws a sprite scaled to a width in tiles, its bottom edge at b. Returns the top edge in pixels.
  function sprite(name, x, b, w, flip) {
    const im = ART[name];
    const dw = w * TILE, dh = dw * im.naturalHeight / im.naturalWidth;
    const px = x * TILE, py = b * TILE - dh;
    if (flip) {
      ctx.save(); ctx.translate(px + dw, py); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, dw, dh); ctx.restore();
    } else ctx.drawImage(im, px, py, dw, dh);
    return py;
  }
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; };

  // ---------- ground, drawn once per map into its own canvas ----------
  function buildGround() {
    const r = rows();
    const c = document.createElement('canvas');
    c.width = r[0].length * TILE * SCALE;
    c.height = r.length * TILE * SCALE;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const T = TILE * SCALE;
    if (roomKind === 'house') {
      g.fillStyle = '#3b2414';
      g.fillRect(0, 0, c.width, c.height);
      if (has('house-interior')) {
        const a = house.art || { x: 0, y: 0, w: 10, h: 8 };
        g.drawImage(ART['house-interior'], a.x * T, a.y * T, a.w * T, a.h * T);
      } else {
        g.setTransform(SCALE, 0, 0, SCALE, 0, 0);
        r.forEach((row, y) => [...row].forEach((ch, x) => houseTile(g, ch, x, y)));
      }
      return c;
    }
    const texture = (name) => (has(name) ? g.createPattern(ART[name], 'repeat') : null);
    const grass = texture('tile-grass'), path = texture('tile-path'), water = texture('tile-water');
    if (!grass || !path || !water) {
      g.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      r.forEach((row, y) => [...row].forEach((ch, x) => townTile(g, ch, x, y)));
      return c;
    }
    g.fillStyle = grass;
    g.fillRect(0, 0, c.width, c.height);
    const at = (x, y) => (r[y] && r[y][x]) || 'T';
    r.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === 'P') { g.fillStyle = path; g.fillRect(x * T, y * T, T, T); }
      if (ch === 'W') { g.fillStyle = water; g.fillRect(x * T, y * T, T, T); }
    }));
    // A thick dark bank where water meets land, the house outline style.
    r.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== 'W') return;
      g.fillStyle = OUTLINE;
      if (at(x, y - 1) !== 'W') g.fillRect(x * T, y * T, T, 6);
      if (at(x, y + 1) !== 'W') g.fillRect(x * T, y * T + T - 4, T, 4);
      if (at(x - 1, y) !== 'W') g.fillRect(x * T, y * T, 5, T);
      if (at(x + 1, y) !== 'W') g.fillRect(x * T + T - 5, y * T, 5, T);
    }));
    // Flower patches: tiny clusters in the house accent colors, walkable like grass.
    const petals = ['#ff9ec7', '#fff6e0', '#ffb347', '#ff6b6b'];
    r.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== 'F') return;
      for (let i = 0; i < 4; i++) {
        const h = hash(x * 4 + i, y);
        const fx = x * T + 8 + (h % 44), fy = y * T + 8 + ((h >>> 8) % 44);
        g.fillStyle = OUTLINE; g.fillRect(fx - 2, fy - 2, 12, 12);
        g.fillStyle = petals[(h >>> 16) % petals.length]; g.fillRect(fx, fy, 8, 8);
        g.fillStyle = '#ffe066'; g.fillRect(fx + 3, fy + 3, 2, 2);
      }
    }));
    return c;
  }

  // Placeholder shapes, used only when the art cannot load.
  function townTile(g, ch, x, y) {
    const px = x * TILE, py = y * TILE;
    g.fillStyle = (x + y) % 2 ? '#5c9e4a' : '#61a54e';
    g.fillRect(px, py, TILE, TILE);
    if (ch === 'P') { g.fillStyle = '#d9c08c'; g.fillRect(px, py, TILE, TILE); }
    else if (ch === 'W') { g.fillStyle = '#3d7fc0'; g.fillRect(px, py, TILE, TILE); }
    else if (ch === 'F') { g.fillStyle = '#ff9ec7'; g.fillRect(px + 7, py + 8, 4, 4); g.fillStyle = '#fff3a0'; g.fillRect(px + 20, py + 18, 4, 4); }
    else if (ch === 'L') { g.fillStyle = '#a07a4f'; g.fillRect(px, py, TILE, TILE); }
  }
  function houseTile(g, ch, x, y) {
    const px = x * TILE, py = y * TILE;
    g.fillStyle = (x % 2) ? '#c9935a' : '#c08b53';
    g.fillRect(px, py, TILE, TILE);
    const fill = { X: '#6b4a2b', R: '#b8574a', B: '#4f7cac', K: '#7a5230', N: '#8e44ad', D: '#4a3220' }[ch];
    if (fill) { g.fillStyle = fill; g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4); }
  }
  function boxShape(x, b, w, h, color) {
    ctx.fillStyle = OUTLINE; ctx.fillRect(x * TILE, (b - h) * TILE, w * TILE, h * TILE);
    ctx.fillStyle = color; ctx.fillRect(x * TILE + 3, (b - h) * TILE + 3, w * TILE - 6, h * TILE - 6);
  }

  // ---------- things that stand up, sorted by where they touch the ground ----------
  function townThings(x0, y0, x1, y1, list) {
    const r = town.rows;
    for (let y = Math.max(0, y0 - 1); y <= Math.min(r.length - 1, y1 + 3); y++) {
      for (let x = Math.max(0, x0 - 2); x <= Math.min(r[0].length - 1, x1 + 2); x++) {
        const ch = r[y][x];
        if (ch === 'T') {
          const h = hash(x, y);
          list.push({ b: y + 1, draw: () => (has('prop-tree')
            ? sprite('prop-tree', x + 0.5 - 0.95 * (0.92 + (h % 13) / 100), y + 1.05, 1.9 * (0.92 + (h % 13) / 100), h & 1)
            : boxShape(x + 0.1, y + 1, 0.8, 1, '#2f6b32')) });
        } else if (ch === 'S' && !has('prop-bus-stop')) {
          list.push({ b: y + 1, draw: () => boxShape(x + 0.3, y + 1, 0.4, 1.4, '#ffd166') });
        }
      }
    }
    for (const p of town.props || []) {
      if (p.x > x1 + 1 || p.x + p.w < x0 - 1 || p.b < y0 || p.b - 6 > y1) continue;
      list.push({ b: p.b, draw: () => (has(p.s) ? sprite(p.s, p.x, p.b, p.w) : boxShape(p.x, p.b, p.w, Math.min(2, p.w), '#b5523b')) });
    }
    for (const geo of town.plots) {
      const state = live(geo.id);
      if (!state.owner) {
        // An empty plot lies flat, so it goes under everything.
        list.push({ b: -1, draw: () => (has('hood-plot') ? sprite('hood-plot', geo.x, geo.y + geo.h, geo.w)
          : (ctx.strokeStyle = '#7a5230', ctx.lineWidth = 3, ctx.strokeRect(geo.x * TILE + 2, geo.y * TILE + 2, geo.w * TILE - 4, geo.h * TILE - 4))) });
        continue;
      }
      const mine = state.owner === me;
      const look = HOUSES[state.owner % HOUSES.length];
      const d = geo.door;
      // A doormat on the step in front of the door shows where to walk in.
      list.push({ b: -1, draw: () => {
        ctx.fillStyle = OUTLINE; ctx.fillRect(d.x * TILE + 5, (d.y + 1) * TILE + 1, TILE - 10, 12);
        ctx.fillStyle = mine ? '#e9b949' : '#c46b3c'; ctx.fillRect(d.x * TILE + 7, (d.y + 1) * TILE + 3, TILE - 14, 8);
      } });
      list.push({ b: geo.y + geo.h - 1, draw: () => {
        const top = has(look) ? sprite(look, geo.x, geo.y + geo.h - 1, geo.w)
          : (boxShape(geo.x, geo.y + geo.h - 1, geo.w, 3, mine ? '#c98b2b' : '#5e8c4a'), (geo.y + geo.h - 4) * TILE);
        if (state.locked) {
          if (has('hood-locked')) sprite('hood-locked', d.x + 0.15, d.y + 0.95, 0.7);
          else boxShape(d.x + 0.2, d.y + 0.9, 0.6, 0.5, '#c0392b');
        }
        labels.push([mine ? 'Your house' : state.name, (geo.x + geo.w / 2) * TILE, top + 4, mine ? '#ffd166' : '#f4f1e6']);
      } });
      if (has('hood-mailbox')) list.push({ b: geo.y + geo.h - 0.05, draw: () => sprite('hood-mailbox', geo.x + geo.w - 0.85, geo.y + geo.h - 0.05, 0.72) });
    }
  }

  function trainer(p, now) {
    // Ease toward the server position so steps look smooth.
    p.dx += (p.x - p.dx) * 0.35;
    p.dy += (p.y - p.dy) * 0.35;
    const moving = Math.abs(p.x - p.dx) + Math.abs(p.y - p.dy) > 0.04;
    if (moving) p.walkUntil = now + 120;
    const px = p.dx * TILE, py = p.dy * TILE;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(px + 16, py + 29, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (p.id === me) {
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(px + 16, py + 29, 13, 5.5, 0, 0, Math.PI * 2); ctx.stroke();
    }
    const look = TRAINERS[p.id % TRAINERS.length];
    if (has(look)) {
      const step = (p.walkUntil || 0) > now ? [1, 0, 1, 2][Math.floor(now / 140) % 4] : 1;
      ctx.drawImage(ART[look], step * 64, (FACE_ROW[p.f] ?? 0) * 96, 64, 96, px, py + TILE - 48, 32, 48);
    } else {
      ctx.fillStyle = p.c; ctx.fillRect(px + 8, py + 10, 16, 16);
      ctx.fillStyle = '#f2c9a0'; ctx.fillRect(px + 10, py + 2, 12, 10);
    }
    const top = py + TILE - 50;
    labels.push([p.busy ? `${p.name} (Busy)` : p.name, px + 16, top, p.busy ? '#9fb59a' : '#f4f1e6']);
    if (p.bubble && p.bubbleUntil > now) bubbles.push([p.bubble, px + 16, top - 16]);
  }

  function label(text, cx, y, color) {
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + 8;
    ctx.fillStyle = 'rgba(11,20,16,0.78)';
    ctx.fillRect(cx - w / 2, y - 11, w, 14);
    ctx.fillStyle = color;
    ctx.fillText(text, cx, y);
    ctx.textAlign = 'start';
  }

  // Speech bubble from the Sprite Book art: the rounded ends and the tail keep their shape, the plain parts stretch.
  function bubble(text, cx, tipY) {
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(text).width;
    if (!has('ui-bubble')) {
      ctx.fillStyle = '#fffbea'; ctx.fillRect(cx - tw / 2 - 7, tipY - 22, tw + 14, 20);
      ctx.fillStyle = '#14211a'; ctx.fillText(text, cx, tipY - 8);
      ctx.textAlign = 'start';
      return;
    }
    const im = ART['ui-bubble'];
    const s = 30 / im.naturalHeight;            // 30 pixels tall on screen
    const cap = 36, tail0 = 92, tail1 = 128, W = im.naturalWidth, H = im.naturalHeight;
    const capW = cap * s, tailW = (tail1 - tail0) * s;
    const w = Math.max(tw + 20, capW * 2 + tailW + 8);
    const left = cx - w / 2, top = tipY - H * s;
    const fill = (w - capW * 2 - tailW) / 2;
    const parts = [[0, cap, capW], [cap, tail0 - cap, fill], [tail0, tail1 - tail0, tailW], [tail1, W - cap - tail1, fill], [W - cap, cap, capW]];
    let x = left;
    for (const [sx, sw, dw] of parts) { ctx.drawImage(im, sx, 0, sw, H, x, top, dw, H * s); x += dw; }
    ctx.fillStyle = '#2b1a12';
    ctx.fillText(text, cx, top + 111 * s / 2 + 5);
    ctx.textAlign = 'start';
  }

  const labels = [], bubbles = [];
  function frame(now) {
    if (held.length && now - lastStep > 120) { send({ t: 'move', d: held[held.length - 1] }); lastStep = now; }
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0b1410';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const r = rows();
    if (r.length) {
      const key = `${room}:${artWaiting}`;
      if (!ground || groundKey !== key) { ground = buildGround(); groundKey = key; }
      const target = cameraTarget();
      cam.x += (target.x - cam.x) * 0.2;
      cam.y += (target.y - cam.y) * 0.2;
      const z = zoom(), vw = VIEW_W / z, vh = VIEW_H / z;
      const cx = Math.round(cam.x * SCALE * z) / (SCALE * z), cy = Math.round(cam.y * SCALE * z) / (SCALE * z);
      ctx.save();
      ctx.scale(z, z);
      ctx.translate(-cx, -cy);
      ctx.drawImage(ground, 0, 0, ground.width / SCALE, ground.height / SCALE);
      const x0 = Math.floor(cx / TILE), y0 = Math.floor(cy / TILE);
      const x1 = Math.ceil((cx + vw) / TILE), y1 = Math.ceil((cy + vh) / TILE);
      const things = [];
      if (roomKind === 'town') townThings(x0, y0, x1, y1, things);
      for (const p of players.values()) things.push({ b: p.dy + 1, draw: () => trainer(p, now) });
      things.sort((a, b) => a.b - b.b);
      labels.length = 0; bubbles.length = 0;
      for (const t of things) t.draw();
      // Name tags never sit on top of each other: a tag that would overlap one already placed moves up a row.
      ctx.font = '12px monospace';
      const placed = [];
      for (const [text, x, y, color] of labels) {
        const w = ctx.measureText(text).width + 8;
        let ty = y;
        for (let i = 0; i < 4 && placed.some((q) => Math.abs(q.x - x) < (q.w + w) / 2 && Math.abs(q.y - ty) < 14); i++) ty -= 15;
        placed.push({ x, y: ty, w });
        label(text, x, ty, color);
      }
      for (const b of bubbles) bubble(...b);
      ctx.restore();
    }
    challengeBtn.disabled = !neighbor() || busyEl.checked;
    requestAnimationFrame(frame);
  }

  connect();
  requestAnimationFrame(frame);
})();
