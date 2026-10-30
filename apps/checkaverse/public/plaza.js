(() => {
  'use strict';
  const TILE = 32;
  const canvas = document.getElementById('town');
  const ctx = canvas.getContext('2d');
  const statusEl = document.getElementById('status');
  const meEl = document.getElementById('me');
  const toastEl = document.getElementById('toast');
  const askEl = document.getElementById('ask');
  const askText = document.getElementById('askText');
  const busyEl = document.getElementById('busy');
  const challengeBtn = document.getElementById('challenge');
  const phrasesEl = document.getElementById('phrases');

  let ws = null;
  let me = 0;
  let map = [];
  let phrases = [];
  let retry = 0;
  let pendingFrom = 0;
  let toastTimer = 0;
  const players = new Map(); // id -> {id,name,x,y,f,c,busy, dx,dy, bubble, bubbleUntil}

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3500);
  }
  function setStatus(text, down) {
    statusEl.textContent = text;
    statusEl.classList.toggle('down', Boolean(down));
  }
  function send(msg) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }
  function countLine() {
    const n = players.size;
    setStatus(`Live · ${n} trainer${n === 1 ? '' : 's'} here`);
  }

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    setStatus(retry ? 'Reconnecting...' : 'Connecting...');
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      handle(m);
    };
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
        me = m.you; map = m.map; phrases = m.phrases;
        players.clear();
        for (const p of m.players) players.set(p.id, { ...p, dx: p.x, dy: p.y });
        meEl.textContent = players.get(me)?.name || 'Trainer';
        buildPhrases();
        busyEl.checked = false;
        countLine();
        break;
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
        document.getElementById('askYes').focus();
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
  function answer(ok) {
    if (pendingFrom) send({ t: 'answer', from: pendingFrom, ok });
    hideAsk();
    canvas.focus?.();
  }
  document.getElementById('askYes').addEventListener('click', () => answer(true));
  document.getElementById('askNo').addEventListener('click', () => answer(false));
  busyEl.addEventListener('change', () => send({ t: 'busy', v: busyEl.checked }));

  // The trainer to challenge: the one straight ahead first, then anyone next to you.
  const AHEAD = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
  function neighbor() {
    const self = players.get(me);
    if (!self) return null;
    const a = AHEAD[self.f] || [0, 1];
    let best = null;
    for (const p of players.values()) {
      if (p.id === me) continue;
      const dist = Math.abs(p.x - self.x) + Math.abs(p.y - self.y);
      if (dist > 1) continue;
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
    if (e.target instanceof HTMLInputElement) return;
    if (!askEl.hidden) return;
    const d = KEYS[e.code];
    if (d) { e.preventDefault(); if (!held.includes(d)) held.push(d); return; }
    if (e.code === 'KeyC' && !e.repeat) challenge();
  });
  window.addEventListener('keyup', (e) => {
    const d = KEYS[e.code];
    const i = held.indexOf(d);
    if (i >= 0) held.splice(i, 1);
  });
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
    const tx = Math.floor(((e.clientX - r.left) / r.width) * canvas.width / TILE);
    const ty = Math.floor(((e.clientY - r.top) / r.height) * canvas.height / TILE);
    for (const p of players.values()) if (p.id !== me && p.x === tx && p.y === ty) return send({ t: 'challenge', to: p.id });
  });

  // ---------- drawing ----------
  function tile(ch, x, y) {
    const px = x * TILE, py = y * TILE;
    const grass = (x + y) % 2 ? '#5c9e4a' : '#61a54e';
    ctx.fillStyle = grass;
    ctx.fillRect(px, py, TILE, TILE);
    if (ch === 'P') { ctx.fillStyle = '#d9c08c'; ctx.fillRect(px, py, TILE, TILE); ctx.fillStyle = '#c9ad74'; ctx.fillRect(px + 6, py + 20, 4, 4); }
    else if (ch === 'W') { ctx.fillStyle = '#3d7fc0'; ctx.fillRect(px, py, TILE, TILE); ctx.fillStyle = '#7fb6e6'; ctx.fillRect(px + 6, py + 10, 10, 2); ctx.fillRect(px + 16, py + 22, 8, 2); }
    else if (ch === 'T') { ctx.fillStyle = '#6b4a2b'; ctx.fillRect(px + 13, py + 20, 6, 10); ctx.fillStyle = '#2f6b32'; ctx.beginPath(); ctx.arc(px + 16, py + 14, 12, 0, Math.PI * 2); ctx.fill(); }
    else if (ch === 'F') { ctx.fillStyle = '#ff9ec7'; ctx.fillRect(px + 7, py + 8, 4, 4); ctx.fillStyle = '#fff3a0'; ctx.fillRect(px + 20, py + 18, 4, 4); }
    else if (ch === 'H') { ctx.fillStyle = '#b5523b'; ctx.fillRect(px, py, TILE, TILE); ctx.fillStyle = '#8f3d2c'; ctx.fillRect(px, py + TILE - 4, TILE, 4); ctx.fillStyle = '#f2d98d'; ctx.fillRect(px + 10, py + 10, 12, 10); }
    else if (ch === 'S') { ctx.fillStyle = '#d9c08c'; ctx.fillRect(px, py, TILE, TILE); ctx.fillStyle = '#555'; ctx.fillRect(px + 14, py + 8, 4, 24); ctx.fillStyle = '#ffd166'; ctx.fillRect(px + 6, py + 2, 20, 12); ctx.fillStyle = '#14211a'; ctx.font = '9px monospace'; ctx.fillText('BUS', px + 8, py + 11); }
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
    const eye = { u: null, d: [12, 6, 18, 6], l: [11, 6, null, null], r: [null, null, 19, 6] }[p.f] || [12, 6, 18, 6];
    if (eye) { if (eye[0] !== null) ctx.fillRect(px + eye[0], py + eye[1], 2, 2); if (eye[2] !== null) ctx.fillRect(px + eye[2], py + eye[3], 2, 2); }
    if (p.id === me) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; ctx.strokeRect(px + 3, py, 26, 31); }
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    const label = p.busy ? `${p.name} (Busy)` : p.name;
    const w = ctx.measureText(label).width + 8;
    ctx.fillStyle = 'rgba(11,20,16,0.75)';
    ctx.fillRect(px + 16 - w / 2, py - 16, w, 14);
    ctx.fillStyle = p.busy ? '#9fb59a' : '#f4f1e6';
    ctx.fillText(label, px + 16, py - 5);
    if (p.bubble && p.bubbleUntil > now) {
      ctx.font = '14px monospace';
      const bw = ctx.measureText(p.bubble).width + 14;
      ctx.fillStyle = '#fffbea';
      ctx.fillRect(px + 16 - bw / 2, py - 40, bw, 20);
      ctx.fillStyle = '#14211a';
      ctx.fillText(p.bubble, px + 16, py - 25);
    }
    ctx.textAlign = 'start';
  }

  function frame(now) {
    if (held.length && now - lastStep > 120) { send({ t: 'move', d: held[held.length - 1] }); lastStep = now; }
    if (map.length) {
      for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) tile(map[y][x], x, y);
      const list = [...players.values()].sort((a, b) => a.dy - b.dy);
      for (const p of list) trainer(p, now);
    } else {
      ctx.fillStyle = '#0b1410'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    challengeBtn.disabled = !neighbor() || busyEl.checked;
    requestAnimationFrame(frame);
  }

  connect();
  requestAnimationFrame(frame);
})();
