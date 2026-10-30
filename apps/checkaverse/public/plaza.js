(() => {
  'use strict';
  const TILE = 32;
  const canvas = document.getElementById('town');
  const ctx = canvas.getContext('2d');
  const VIEW_W = canvas.width, VIEW_H = canvas.height;
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
    const tx = Math.floor((((e.clientX - r.left) / r.width) * VIEW_W + cam.x) / TILE);
    const ty = Math.floor((((e.clientY - r.top) / r.height) * VIEW_H + cam.y) / TILE);
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
    return { x: clamp(cx, mapW, VIEW_W), y: clamp(cy, mapH, VIEW_H) };
  }
  function snapCamera() { cam = cameraTarget(); }

  // ---------- drawing ----------
  // Placeholder shapes until the sprite book art arrives.
  function townTile(ch, x, y) {
    const px = x * TILE, py = y * TILE;
    ctx.fillStyle = (x + y) % 2 ? '#5c9e4a' : '#61a54e';
    ctx.fillRect(px, py, TILE, TILE);
    if (ch === 'P') { ctx.fillStyle = '#d9c08c'; ctx.fillRect(px, py, TILE, TILE); ctx.fillStyle = '#c9ad74'; ctx.fillRect(px + 6, py + 20, 4, 4); }
    else if (ch === 'L') { ctx.fillStyle = '#a07a4f'; ctx.fillRect(px, py, TILE, TILE); ctx.fillStyle = '#8c6a43'; ctx.fillRect(px + 4, py + 8, 24, 2); ctx.fillRect(px + 4, py + 20, 24, 2); }
    else if (ch === 'W') { ctx.fillStyle = '#3d7fc0'; ctx.fillRect(px, py, TILE, TILE); ctx.fillStyle = '#7fb6e6'; ctx.fillRect(px + 6, py + 10, 10, 2); ctx.fillRect(px + 16, py + 22, 8, 2); }
    else if (ch === 'T') { ctx.fillStyle = '#6b4a2b'; ctx.fillRect(px + 13, py + 20, 6, 10); ctx.fillStyle = '#2f6b32'; ctx.beginPath(); ctx.arc(px + 16, py + 14, 12, 0, Math.PI * 2); ctx.fill(); }
    else if (ch === 'F') { ctx.fillStyle = '#ff9ec7'; ctx.fillRect(px + 7, py + 8, 4, 4); ctx.fillStyle = '#fff3a0'; ctx.fillRect(px + 20, py + 18, 4, 4); }
    else if (ch === 'H') { ctx.fillStyle = '#b5523b'; ctx.fillRect(px, py, TILE, TILE); ctx.fillStyle = '#8f3d2c'; ctx.fillRect(px, py + TILE - 4, TILE, 4); ctx.fillStyle = '#f2d98d'; ctx.fillRect(px + 10, py + 10, 12, 10); }
    else if (ch === 'S') { ctx.fillStyle = '#d9c08c'; ctx.fillRect(px, py, TILE, TILE); ctx.fillStyle = '#555'; ctx.fillRect(px + 14, py + 8, 4, 24); ctx.fillStyle = '#ffd166'; ctx.fillRect(px + 6, py + 2, 20, 12); ctx.fillStyle = '#14211a'; ctx.font = '9px monospace'; ctx.fillText('BUS', px + 8, py + 11); }
  }

  function houseTile(ch, x, y) {
    const px = x * TILE, py = y * TILE;
    ctx.fillStyle = (x % 2) ? '#c9935a' : '#c08b53';
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = '#a8763f'; ctx.fillRect(px, py + TILE - 2, TILE, 2);
    if (ch === 'X') { ctx.fillStyle = '#6b4a2b'; ctx.fillRect(px, py, TILE, TILE); ctx.fillStyle = '#5a3d22'; ctx.fillRect(px, py + 10, TILE, 3); ctx.fillRect(px, py + 22, TILE, 3); }
    else if (ch === 'R') { ctx.fillStyle = '#b8574a'; ctx.fillRect(px, py, TILE, TILE); ctx.fillStyle = '#e0a458'; ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8); }
    else if (ch === 'B') { ctx.fillStyle = '#e8e2d0'; ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4); ctx.fillStyle = '#4f7cac'; ctx.fillRect(px + 2, py + 12, TILE - 4, TILE - 14); }
    else if (ch === 'K') { ctx.fillStyle = '#7a5230'; ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4); ctx.fillStyle = '#d35400'; ctx.fillRect(px + 6, py + 6, 5, 9); ctx.fillStyle = '#16a085'; ctx.fillRect(px + 13, py + 6, 5, 9); }
    else if (ch === 'N') { ctx.fillStyle = '#8e44ad'; ctx.beginPath(); ctx.ellipse(px + 16, py + 18, 13, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#c39bd3'; ctx.beginPath(); ctx.ellipse(px + 16, py + 18, 8, 5, 0, 0, Math.PI * 2); ctx.fill(); }
    else if (ch === 'D') { ctx.fillStyle = '#4a3220'; ctx.fillRect(px, py, TILE, TILE); ctx.fillStyle = '#a8c686'; ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 10); }
  }

  function plotHouse(geo) {
    const state = live(geo.id);
    const px = geo.x * TILE, py = geo.y * TILE, w = geo.w * TILE;
    if (!state.owner) {
      ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 3;
      ctx.strokeRect(px + 2, py + 2, w - 4, geo.h * TILE - 4);
      return;
    }
    const mine = state.owner === me;
    ctx.fillStyle = '#d9b48a'; ctx.fillRect(px + 4, py + 18, w - 8, TILE * 3 - 18);
    ctx.fillStyle = mine ? '#c98b2b' : '#5e8c4a';
    ctx.beginPath(); ctx.moveTo(px - 2, py + 22); ctx.lineTo(px + w / 2, py - 6); ctx.lineTo(px + w + 2, py + 22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f2d98d'; ctx.fillRect(px + 14, py + 36, 18, 16); ctx.fillRect(px + w - 32, py + 36, 18, 16);
    const dx = geo.door.x * TILE, dy = geo.door.y * TILE;
    ctx.fillStyle = '#5a3d22'; ctx.fillRect(dx + 6, dy + 4, TILE - 12, TILE - 4);
    if (state.locked) {
      ctx.fillStyle = '#fffbea'; ctx.fillRect(dx + 7, dy + 8, TILE - 14, 14);
      ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(dx + 10, dy + 11); ctx.lineTo(dx + TILE - 10, dy + 19); ctx.moveTo(dx + TILE - 10, dy + 11); ctx.lineTo(dx + 10, dy + 19); ctx.stroke();
    }
    label(mine ? 'Your house' : state.name, px + w / 2, py - 10, mine ? '#ffd166' : '#f4f1e6');
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

  function trainer(p, now) {
    // Ease toward the server position so steps look smooth.
    p.dx += (p.x - p.dx) * 0.35;
    p.dy += (p.y - p.dy) * 0.35;
    const px = p.dx * TILE, py = p.dy * TILE;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(px + 7, py + 26, 18, 4);
    ctx.fillStyle = p.c;
    ctx.fillRect(px + 8, py + 10, 16, 16);
    ctx.fillStyle = '#f2c9a0';
    ctx.fillRect(px + 10, py + 2, 12, 10);
    ctx.fillStyle = '#14211a';
    if (p.f === 'd') { ctx.fillRect(px + 12, py + 6, 2, 2); ctx.fillRect(px + 18, py + 6, 2, 2); }
    else if (p.f === 'l') ctx.fillRect(px + 11, py + 6, 2, 2);
    else if (p.f === 'r') ctx.fillRect(px + 19, py + 6, 2, 2);
    if (p.id === me) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; ctx.strokeRect(px + 3, py, 26, 31); }
    label(p.busy ? `${p.name} (Busy)` : p.name, px + 16, py - 5, p.busy ? '#9fb59a' : '#f4f1e6');
    if (p.bubble && p.bubbleUntil > now) {
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      const bw = ctx.measureText(p.bubble).width + 14;
      ctx.fillStyle = '#fffbea';
      ctx.fillRect(px + 16 - bw / 2, py - 40, bw, 20);
      ctx.fillStyle = '#14211a';
      ctx.fillText(p.bubble, px + 16, py - 25);
      ctx.textAlign = 'start';
    }
  }

  function frame(now) {
    if (held.length && now - lastStep > 120) { send({ t: 'move', d: held[held.length - 1] }); lastStep = now; }
    ctx.fillStyle = '#0b1410';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const r = rows();
    if (r.length) {
      const target = cameraTarget();
      cam.x += (target.x - cam.x) * 0.2;
      cam.y += (target.y - cam.y) * 0.2;
      ctx.save();
      ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
      const x0 = Math.max(0, Math.floor(cam.x / TILE)), y0 = Math.max(0, Math.floor(cam.y / TILE));
      const x1 = Math.min(r[0].length - 1, Math.ceil((cam.x + VIEW_W) / TILE)), y1 = Math.min(r.length - 1, Math.ceil((cam.y + VIEW_H) / TILE));
      const draw = roomKind === 'town' ? townTile : houseTile;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) draw(r[y][x], x, y);
      if (roomKind === 'town') for (const geo of town.plots) plotHouse(geo);
      const list = [...players.values()].sort((a, b) => a.dy - b.dy);
      for (const p of list) trainer(p, now);
      ctx.restore();
    }
    challengeBtn.disabled = !neighbor() || busyEl.checked;
    requestAnimationFrame(frame);
  }

  connect();
  requestAnimationFrame(frame);
})();
