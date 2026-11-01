(() => {
  'use strict';
  const TILE = 32;
  const canvas = document.getElementById('town');
  const ctx = canvas.getContext('2d');
  const SCALE = 2; // the canvas has two pixels for every map pixel so the 2x art stays sharp
  // The map fills the screen: always 16 tiles tall, as wide as the screen allows.
  let VIEW_W = canvas.width / SCALE, VIEW_H = canvas.height / SCALE;
  function fitCanvas() {
    const aspect = Math.max(0.35, Math.min(2.6, window.innerWidth / Math.max(1, window.innerHeight)));
    canvas.height = 1024;
    canvas.width = Math.round(1024 * aspect);
    VIEW_W = canvas.width / SCALE; VIEW_H = canvas.height / SCALE;
  }
  fitCanvas();
  window.addEventListener('resize', fitCanvas);
  // Rooms are small, so the camera moves in closer inside a house.
  const zoom = () => (roomKind === 'house' ? 1.6 : 1);
  const $ = (id) => document.getElementById(id);
  const statusEl = $('status'), meEl = $('me'), toastEl = $('toast'), askEl = $('ask'), askText = $('askText');
  const busyEl = $('busy'), challengeBtn = $('challenge'), phrasesEl = $('phrases');
  const placeEl = $('place'), lockBtn = $('lock'), homeEl = $('home');

  let ws = null, me = 0, retry = 0, pendingFrom = 0, toastTimer = 0, removed = false, paused = false, elsewhere = false;
  // A bus ticket from Check-In arrives in the address after #t=. It is kept for this tab only, so a reload keeps the
  // trainer, and it is taken out of the address bar so it cannot be copied off the screen.
  let ticket = null;
  {
    const m = /[#&]t=([A-Za-z0-9_.-]{20,2000})/.exec(location.hash);
    if (m) { ticket = m[1]; try { history.replaceState(null, '', location.pathname + location.search); } catch { /* fine */ } }
    try { if (ticket) sessionStorage.setItem('checkaverse-ticket', ticket); else ticket = sessionStorage.getItem('checkaverse-ticket'); } catch { /* storage can be off on school machines */ }
  }
  const pausedEl = document.getElementById('paused');
  function setPaused(v) { paused = Boolean(v); pausedEl.hidden = !paused; if (paused) { held.length = 0; stopWalk(); } if (typeof movesLine === 'function') movesLine(); phrasesEl.querySelectorAll('button').forEach((x) => { x.disabled = paused; }); renameLine(); }
  let town = null, house = null, wilds = null, phrases = [], myPlot = 0, signs = {}, rerolls = 0;
  // The outdoor map you are on right now: the town or the wilds. Houses use the house map.
  const mapNow = () => (roomKind === 'wilds' ? wilds : town);
  let room = 'town', roomKind = 'town', roomOwner = null;
  let plots = []; // live state: {id, owner, name, locked}
  const players = new Map(); // id -> {id,name,x,y,f,c,busy, dx,dy, bubble, bubbleUntil}
  let cam = { x: 0, y: 0 };

  // A teacher message stays on screen its full 8 seconds. A bump into a sign must not wipe "Two minutes left."
  let teacherUntil = 0;
  function toast(msg) {
    if (performance.now() < teacherUntil) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, Math.max(3500, msg.length * 70)); // longer signs stay up long enough to read
  }
  // The wait line counts down, so a student can see the page is still trying instead of frozen on "15s".
  let countdown = 0;
  function waitStatus(text, wait) {
    const until = Date.now() + wait;
    const show = () => { const s = Math.max(0, Math.ceil((until - Date.now()) / 1000)); setStatus(`${text} Trying again in ${s}s.`, true); if (!s) clearInterval(countdown); };
    clearInterval(countdown); show(); countdown = setInterval(show, 1000);
  }
  function setStatus(text, down) { if (!down) clearInterval(countdown); statusEl.textContent = text; statusEl.classList.toggle('down', Boolean(down)); }
  function send(msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }
  const live = (id) => plots.find((p) => p.id === id) || { owner: 0, name: '', locked: false };
  function countLine() {
    const n = players.size;
    const where = roomKind === 'house' ? 'in this house' : 'here';
    setStatus(`Live · ${n} trainer${n === 1 ? '' : 's'} ${where}`);
  }
  let zoneName = '';
  function placeLine() {
    if (roomKind === 'town') placeEl.textContent = 'Town';
    else if (roomKind === 'wilds') placeEl.textContent = zoneName ? `The wilds · ${zoneName}` : 'The wilds';
    else if (roomOwner && roomOwner.owner === me) placeEl.textContent = 'Your house';
    else placeEl.textContent = `${roomOwner?.name || 'A trainer'}'s house`;
  }
  function homeLine() {
    const goHome = document.getElementById('goHome');
    goHome.hidden = !myPlot || roomKind !== 'town';
    if (!myPlot) { homeEl.textContent = 'No free plot right now'; lockBtn.hidden = true; return; }
    const mine = live(myPlot);
    homeEl.textContent = `Your house is on plot ${myPlot} in the Neighborhood`;
    lockBtn.hidden = false;
    lockBtn.textContent = mine.locked ? 'Unlock my door' : 'Lock my door';
    lockBtn.setAttribute('aria-pressed', String(mine.locked));
  }

  // dx, dy: where the trainer is drawn. q: tiles a remote trainer still has to walk through.
  // seg: the step your own trainer is walking right now. stride: distance walked, for the leg animation.
  const fresh = (p) => ({ ...p, dx: p.x, dy: p.y, q: [], seg: null, stride: 0, unacked: 0, bumped: '' });
  function setPlayers(list) {
    players.clear();
    for (const p of list) players.set(p.id, fresh(p));
  }

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    clearInterval(countdown);
    setStatus(retry ? 'Reconnecting...' : 'Connecting...');
    ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } handle(m); };
    ws.onopen = () => { retry = 0; send({ t: 'hello', ticket }); };
    ws.onclose = (ev) => {
      players.clear();
      hideAsk();
      if (bt && !bt.done) toast('The connection dropped, so that battle ended.');
      closeBattle(true);
      // Nothing can be said or renamed while the bus is down. The welcome on reconnect turns these back on.
      phrasesEl.querySelectorAll('button').forEach((x) => { x.disabled = true; });
      renameBtn.disabled = true;
      if (removed || ev.code === 4001) return setStatus('The teacher removed you from the Checkaverse. Reload the page to come back.', true);
      if (elsewhere || ev.code === 4002) return setStatus('You opened the Checkaverse in another tab, so this one closed.', true);
      const wait = Math.min(15000, 1000 * 2 ** retry++);
      waitStatus(ev.code === 4003 ? 'The Checkaverse is full right now.' : 'The Checkaverse bus is not running right now.', wait);
      if (ev.code === 4003) { reconnectTimer = setTimeout(connect, wait); return; }
      reconnectTimer = setTimeout(connect, wait);
    };
  }
  // A student coming back to the tab or back onto Wi-Fi should not sit out the rest of a 15 second wait.
  let reconnectTimer = 0;
  function reconnectNow() {
    if (removed || !ws || ws.readyState !== WebSocket.CLOSED || document.hidden) return;
    clearTimeout(reconnectTimer); retry = 0; connect();
  }
  window.addEventListener('online', reconnectNow);
  document.addEventListener('visibilitychange', reconnectNow);

  let serverVersion = '';
  function handle(m) {
    switch (m.t) {
      case 'welcome':
        // A tab left open across a server update reconnects to new rules with old code. Load the new code instead.
        if (serverVersion && m.version && m.version !== serverVersion) { location.reload(); return; }
        serverVersion = m.version;
        me = m.you; town = m.town; house = m.house; wilds = m.wilds; phrases = m.phrases; myPlot = m.myPlot;
        team = m.team || []; saved = Boolean(m.saved); partyMax = m.partyMax || 3; charms = m.charms ?? 0; charmLine(); recordLine(m.record);
        signs = m.signs || {}; rerolls = m.rerolls || 0; renameLine(); stopWalk(); setPaused(m.paused);
        partner = m.partner; closeBattle(true); lastNear = null; watchLine();
        // A ticket the town turned down is dropped, so a reload does not try it again.
        if (!saved && ticket) { ticket = null; try { sessionStorage.removeItem('checkaverse-ticket'); } catch { /* fine */ } }
        // A visitor's starter choice is remembered on this Chromebook. A saved trainer's partner is kept by the town.
        if (!saved) { const pick = savedPartner(); if (pick && pick !== partner && team.some((x) => x.v === pick && !x.caught)) send({ t: 'partner', v: pick }); }
        buildPartners();
        if (!saved) tipSoon('visitor', 2500);
        room = 'town'; roomKind = 'town'; roomOwner = null;
        setPlayers(m.players);
        meEl.textContent = players.get(me)?.name || 'Trainer';
        buildPhrases();
        busyEl.checked = false;
        countLine(); placeLine(); homeLine();
        snapCamera();
        tipSoon('walk', 1200);
        break;
      case 'room':
        room = m.room; roomKind = m.kind; roomOwner = m.owner;
        stopWalk();
        setPlayers(m.players);
        hideAsk();
        countLine(); placeLine(); homeLine();
        snapCamera();
        zoneName = ''; placeLine(); charmLine();
        if (roomKind === 'house') toast(roomOwner && roomOwner.owner === me ? 'Welcome home.' : `You stepped into ${roomOwner?.name || 'a trainer'}'s house. Look, but do not touch.`);
        if (roomKind === 'wilds') { toast('You walked out into the wilds.'); tipSoon('wilds', 900); }
        break;
      case 'plots': plots = m.plots; homeLine(); break;
      case 'home': myPlot = m.plot; homeLine(); break;
      case 'join': players.set(m.p.id, fresh(m.p)); countLine(); break;
      case 'leave': players.delete(m.id); if (pendingFrom === m.id) hideAsk(); countLine(); break;
      case 'pos': {
        const p = players.get(m.id);
        if (!p) break;
        if (m.id === me) { selfConfirmed(p, m); break; }
        if (m.x === p.x && m.y === p.y) { if (p.q.length) p.q.push([m.x, m.y, m.f]); else p.f = m.f; }
        else p.q.push([m.x, m.y, m.f]);
        p.x = m.x; p.y = m.y;
        break;
      }
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
        askShownAt = performance.now();
        clearTimeout(askTimer);
        askTimer = setTimeout(() => { if (pendingFrom === m.from) hideAsk(); }, m.ttl || 20000);
        break;
      case 'challenge_result': toast(m.msg); break;
      case 'battle': openBattle(m); break;
      case 'battle_wait': battleWait(m.side); break;
      case 'battle_turn': if (bt && m.id === bt.id) queueTurn(m); break;
      case 'battle_end': if (bt && m.id === bt.id) queueEnd(m); break;
      case 'battle_near': lastNear = { id: m.id, names: m.names, until: performance.now() + 90000 }; watchLine(); toast(`${m.names[0]} and ${m.names[1]} are battling nearby. Press Watch battle to see it.`); break;
      case 'battling': { const p = players.get(m.id); if (p) p.inb = m.v; break; }
      case 'record': recordLine(m.record); break;
      case 'partner': partner = m.v; buildPartners(); break;
      case 'team': { const more = (m.team || []).length > team.length; team = m.team || []; saved = Boolean(m.saved); partner = m.partner || partner; charms = m.charms ?? charms; buildPartners(); charmLine(); if (more) tipSoon(saved ? 'caught' : 'caught-visit', 4000); break; }
      case 'elsewhere': elsewhere = true; break;
      case 'ranks': showRanks(m); break;
      case 'pt': { const p = players.get(m.id); if (p) p.pt = m.v; break; }
      case 'notice': toast(m.msg); break;
      case 'teacher': toastTimer && clearTimeout(toastTimer); toastEl.textContent = `Teacher: ${m.msg}`; toastEl.hidden = false; teacherUntil = performance.now() + 8000; toastTimer = setTimeout(() => { toastEl.hidden = true; }, 8000); break;
      case 'paused': setPaused(m.v); if (!m.v) toast('The Checkaverse is running again.'); break;
      case 'removed': removed = true; break;
      case 'look': { const p = players.get(m.id); if (p) p.look = m.v; break; }
      case 'name': {
        const p = players.get(m.id);
        if (p) p.name = m.name;
        if (m.id === me) { meEl.textContent = m.name; rerolls = m.left ?? rerolls; renameLine(); toast(`You are now ${m.name}.`); }
        break;
      }
      default: break;
    }
  }

  function buildPhrases() {
    phrasesEl.textContent = '';
    phrases.forEach((text, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.disabled = paused; // joining a paused town must not hand out live phrase buttons
      b.addEventListener('click', (e) => {
        // Hand the keyboard back to the map. A focused button would turn the next Space press into another "Hi!"
        if (e.detail) b.blur();
        send({ t: 'say', p: i });
        // The server takes one phrase every two seconds; the buttons rest for the same time.
        const all = [...phrasesEl.querySelectorAll('button')];
        all.forEach((x) => { x.disabled = true; });
        setTimeout(() => all.forEach((x) => { x.disabled = paused; }), 2000);
      });
      phrasesEl.appendChild(b);
    });
  }

  function hideAsk() { askEl.hidden = true; pendingFrom = 0; }
  let askTimer = 0, askShownAt = 0;
  // A Space press meant for a sign can land on Yes the instant a challenge pops up, so the first moment is ignored.
  function answer(ok) { if (performance.now() - askShownAt < 400) return; if (pendingFrom) send({ t: 'answer', from: pendingFrom, ok }); hideAsk(); }
  $('askYes').addEventListener('click', () => answer(true));
  $('askNo').addEventListener('click', () => answer(false));
  busyEl.addEventListener('change', () => send({ t: 'busy', v: busyEl.checked }));
  lockBtn.addEventListener('click', () => send({ t: 'lock', v: !live(myPlot).locked }));
  const renameBtn = $('rename');
  // After a mouse click, these controls hand the keyboard back to the map. Otherwise the next Space meant for a sign
  // would flip Busy, turn the house key, or spend one of the three new names.
  for (const el of [busyEl, lockBtn, renameBtn]) el.addEventListener('click', (e) => { if (e.detail) el.blur(); });
  function renameLine() {
    renameBtn.textContent = rerolls ? `New name (${rerolls} left)` : 'No new names left';
    renameBtn.disabled = !rerolls || paused;
  }
  // One request at a time, so a double click cannot spend two names. The server's answer turns it back on.
  renameBtn.addEventListener('click', () => { if (rerolls && !paused) { renameBtn.disabled = true; send({ t: 'reroll' }); setTimeout(renameLine, 3000); } });
  // Four trainer outfits from the Sprite Book. The button steps through them.
  document.getElementById('outfit').addEventListener('click', () => {
    const p = players.get(me);
    if (p) send({ t: 'look', v: ((p.look ?? 0) + 1) % TRAINERS.length });
  });
  // Walks you to your own front door and in. The town is wide, so this saves a long hunt.
  document.getElementById('goHome').addEventListener('click', () => {
    const geo = town?.plots.find((g) => g.id === myPlot);
    if (geo && roomKind === 'town') walkTo([[geo.door.x, geo.door.y + 1]], 'u');
  });
  // After a mouse or tap click, hand the keyboard back to the game so Space does not press the same button again.
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && e.detail) b.blur();
  });

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
  let challengeRest = 0;
  function challenge() {
    const n = neighbor();
    if (!n) return toast('Walk up next to a trainer to challenge them.');
    if (performance.now() < challengeRest) return;
    challengeRest = performance.now() + 1500; // a double click would send a second challenge and a confusing notice
    send({ t: 'challenge', to: n.id });
  }
  challengeBtn.addEventListener('click', (e) => { if (e.detail) challengeBtn.blur(); challenge(); });

  // Held keys repeat at the server's walking speed.
  const KEYS = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
  const held = [];
  let lastFrame = 0;
  // A tap shorter than TURN_MS on a new direction only turns the trainer. Holding it walks.
  const TURN_MS = 90;
  let pressAt = 0, pressTurn = false;
  function press(d) {
    if (!held.length) { const s0 = players.get(me); pressAt = performance.now(); pressTurn = Boolean(s0 && !s0.seg && s0.f !== d); }
    if (!held.includes(d)) held.push(d);
  }
  window.addEventListener('keydown', (e) => {
    // The Busy checkbox is an input too, but clicking it must not leave the arrow keys dead until the student clicks the map.
    if (e.target instanceof HTMLInputElement && e.target.type !== 'checkbox' || (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) && e.code === 'Space') return;
    if (!askEl.hidden) { if (e.code === 'Escape') { e.preventDefault(); answer(false); } return; }
    if (bt) { battleKey(e); return; }
    if (e.code === 'Escape') { closePops(); closeRanks(); if (tipNow) { clearTimeout(tipTimer); hideTip(); } return; }
    const d = KEYS[e.code];
    if (d) { e.preventDefault(); stopWalk(); if (!e.repeat) { const s0 = players.get(me); if (s0) s0.bumped = ''; } press(d); return; }
    if (e.code === 'KeyC' && !e.repeat) challenge();
    if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) { e.preventDefault(); lookAhead(true); }
  });
  window.addEventListener('keyup', (e) => { const i = held.indexOf(KEYS[e.code]); if (i >= 0) held.splice(i, 1); });
  window.addEventListener('blur', () => { held.length = 0; });
  // Closing a Chromebook lid mid walk can swallow the keyup, so a hidden tab lets go of every key.
  document.addEventListener('visibilitychange', () => { if (document.hidden) { held.length = 0; stopWalk(); } });
  document.querySelectorAll('.pad button').forEach((b) => {
    const d = b.dataset.d;
    const down = (e) => { e.preventDefault(); stopWalk(); const s0 = players.get(me); if (s0) s0.bumped = ''; press(d); };
    const up = () => { const i = held.indexOf(d); if (i >= 0) held.splice(i, 1); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    b.addEventListener('pointerup', up);
    b.addEventListener('pointerleave', up);
    b.addEventListener('pointercancel', up);
  });
  // ---------- tap to walk and look ----------
  // Tapping the map walks there one step at a time. The server still checks every step.
  // Tapping a trainer challenges them, tapping a landmark walks up to it and reads its sign,
  // and tapping a house walks in its front door.
  const STEP = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
  const TOWN_SOLID = new Set(['T', 'W', 'H', 'S']);
  const HOUSE_SOLID = new Set(['X', 'B', 'K', 'N', 'D']);
  let walk = null; // { goals: Set of 'x,y', then: 'u'|'d'|..., sign, sentAt, from }
  function stopWalk() { walk = null; }
  function open(x, y) {
    const r = rows();
    if (y < 0 || y >= r.length || x < 0 || x >= r[0].length) return false;
    if (roomKind === 'house') return !HOUSE_SOLID.has(r[y][x]);
    if (TOWN_SOLID.has(r[y][x])) return false;
    return roomKind !== 'town' || !plots.some((pl) => pl.owner && (() => { const g = town.plots.find((q) => q.id === pl.id); return g && x >= g.x && x < g.x + g.w && y >= g.y && y < g.y + g.h - 1; })());
  }
  // Breadth first search from where the server says we are. Returns the first direction to step, or '' if already there.
  function firstStep(sx, sy, goals) {
    if (goals.has(`${sx},${sy}`)) return '';
    const seen = new Map([[`${sx},${sy}`, null]]);
    const queue = [[sx, sy]];
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const [d, [ax, ay]] of Object.entries(STEP)) {
        const nx = x + ax, ny = y + ay, k = `${nx},${ny}`;
        if (seen.has(k) || !open(nx, ny)) continue;
        seen.set(k, [x, y, d]);
        if (goals.has(k)) {
          let cur = k, dir = d;
          while (true) { const [px, py, pd] = seen.get(cur); if (px === sx && py === sy) return pd; cur = `${px},${py}`; dir = pd; }
        }
        queue.push([nx, ny]);
      }
      if (seen.size > 4000) break;
    }
    return null;
  }
  function walkTo(goalList, then, sign) {
    const goals = new Set(goalList.filter(([x, y]) => open(x, y)).map(([x, y]) => `${x},${y}`));
    if (!goals.size) return toast('You cannot get there from here.');
    walk = { goals, then, sign, sentAt: 0, from: '' };
  }
  function around(fx, fy, fw, fh) {
    const out = [];
    for (let x = fx; x < fx + fw; x++) { out.push([x, fy - 1, 'd'], [x, fy + fh, 'u']); }
    for (let y = fy; y < fy + fh; y++) { out.push([fx - 1, y, 'r'], [fx + fw, y, 'l']); }
    return out;
  }
  // Tap to walk: the next step from where your trainer is going to be, or '' once there.
  function walkDir(self) {
    if (!walk) return '';
    const dir = firstStep(self.x, self.y, walk.goals);
    if (dir === null) { stopWalk(); toast('You cannot get there from here.'); return ''; }
    if (dir) return dir;
    const w = walk; stopWalk();
    const face = typeof w.then === 'function' ? w.then(self) : w.then;
    if (w.sign) setTimeout(() => showSign(w.sign), 150);
    return face || '';
  }

  // ---------- your own trainer ----------
  // Your trainer moves the moment you press, at a steady pace, and the server checks each step behind it.
  // If the server ever disagrees (a door locked a moment ago), the trainer glides to where the server says.
  const STEP_MS = 180;
  function selfConfirmed(p, m) {
    p.unacked = Math.max(0, p.unacked - 1);
    if (p.unacked || (m.x === p.x && m.y === p.y)) return;
    p.seg = { fx: p.dx, fy: p.dy, tx: m.x, ty: m.y, start: performance.now(), dur: STEP_MS };
    p.x = m.x; p.y = m.y; p.f = m.f;
  }
  function selfTick(now) {
    const p = players.get(me);
    if (!p) return;
    let start = now;
    const wasIdle = !p.seg;
    if (p.seg) {
      const k = Math.min(1, (now - p.seg.start) / p.seg.dur);
      const nx = p.seg.fx + (p.seg.tx - p.seg.fx) * k, ny = p.seg.fy + (p.seg.ty - p.seg.fy) * k;
      p.stride += Math.abs(nx - p.dx) + Math.abs(ny - p.dy);
      p.dx = nx; p.dy = ny;
      if (k < 1) return;
      start = p.seg.start + p.seg.dur; // chain the next step with no gap
      p.seg = null;
      if (now - start > STEP_MS) start = now;
    }
    if (!askEl.hidden || paused || bt) return;
    const dir = held.length ? held[held.length - 1] : walkDir(p);
    if (!dir) return;
    if (held.length && wasIdle && pressTurn && now - pressAt < TURN_MS) {
      if (p.f !== dir) { p.f = dir; send({ t: 'turn', d: dir }); }
      return;
    }
    const [ax, ay] = STEP[dir];
    const nx = p.x + ax, ny = p.y + ay;
    if (open(nx, ny)) {
      p.f = dir; p.bumped = '';
      send({ t: 'move', d: dir }); p.unacked++;
      p.seg = { fx: p.x, fy: p.y, tx: nx, ty: ny, start, dur: STEP_MS };
      p.x = nx; p.y = ny;
      selfTick(now);
      return;
    }
    // Blocked: turn to face it and tell the server once, which is also how doors open.
    const bump = `${p.x},${p.y},${dir}`;
    if (p.bumped === bump) return;
    p.bumped = bump; p.f = dir;
    send({ t: 'move', d: dir }); p.unacked++;
  }

  // ---------- everyone else ----------
  // Remote trainers walk through the tiles the server reported at the same steady pace. A little slower when
  // only one tile is waiting, so the next report usually arrives before they stop, and faster when they fall behind.
  function remoteTick(p, dt) {
    while (p.q.length) {
      const [tx, ty, f] = p.q[0];
      const ex = tx - p.dx, ey = ty - p.dy, d = Math.abs(ex) + Math.abs(ey);
      if (d > 3) { p.dx = tx; p.dy = ty; p.f = f; p.q.shift(); continue; }
      if (d > 0.001) p.f = f;
      const pace = p.q.length === 1 ? 0.88 : p.q.length === 2 ? 1 : 1.5;
      const go = (dt / STEP_MS) * pace;
      if (go >= d) { p.dx = tx; p.dy = ty; p.stride += d; p.f = f; p.q.shift(); dt -= d > 0 ? (d * STEP_MS) / pace : 0; if (dt <= 0) break; continue; }
      p.dx += (ex / d) * go; p.dy += (ey / d) * go; p.stride += go;
      break;
    }
  }

  function showSign(key) {
    if (key === 'notice-board') return askRanks();
    if (signs[key]) toast(signs[key]);
  }
  // ---------- weekly rankings ----------
  // The notice board (or the menu) asks the town for this week's battle ranking in your class hour.
  const ranksPop = $('ranksPop');
  function askRanks() { send({ t: 'ranks' }); }
  function closeRanks() { ranksPop.hidden = true; }
  $('ranksClose').addEventListener('click', closeRanks);
  $('ranksBtn').addEventListener('click', () => { closePops(); askRanks(); });
  function weekLabel(day) {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
  }
  function showRanks(m) {
    const list = $('ranksList'), note = $('ranksNote');
    list.textContent = '';
    if (!m.saved) {
      $('ranksTitle').textContent = "This week's rankings";
      note.textContent = 'Visitors are not ranked. Ride the bus from your Check-In page to battle for rank points.';
    } else {
      $('ranksTitle').textContent = `${m.hour} · week of ${weekLabel(m.week)}`;
      const row = (x) => {
        const li = document.createElement('li');
        if (x.me) li.className = 'me';
        const rank = document.createElement('span'); rank.textContent = `${x.rank}.`;
        const name = document.createElement('span'); name.textContent = x.me ? `${x.name} (you)` : x.name;
        const rec = document.createElement('span'); rec.className = 'rec'; rec.textContent = `${x.w}W ${x.l}L${x.d ? ` ${x.d}T` : ''}`;
        name.appendChild(rec);
        const pts = document.createElement('span'); pts.className = 'pts'; pts.textContent = `${x.points} pts`;
        li.append(rank, name, pts);
        return li;
      };
      for (const x of m.top) list.appendChild(row(x));
      if (m.mine && !m.top.some((x) => x.me)) {
        const gap = document.createElement('li'); gap.className = 'gap'; gap.textContent = '...';
        list.append(gap, row(m.mine));
      }
      note.textContent = m.top.length
        ? `A win is 3 points and a tie is 1. Only your first 3 battles with the same classmate each day count. Resets Monday.${m.mine ? '' : ' Win a battle to get on the board.'}`
        : 'No ranked battles in your class hour yet this week. Walk up to a classmate and challenge them to be first on the board.';
    }
    closePops();
    ranksPop.hidden = false;
    $('ranksClose').focus();
  }
  function propAt(x, y) {
    return (mapNow()?.props || []).find((p) => p.sign && p.f && x >= p.f[0] && x < p.f[0] + p.f[2] && y >= p.f[1] && y < p.f[1] + p.f[3]);
  }
  // Space or Enter reads whatever is straight ahead.
  function lookAhead(fromKey) {
    const self = players.get(me);
    if (!self || roomKind === 'house') return false;
    const [ax, ay] = STEP[self.f] || STEP.d;
    const p = propAt(self.x + ax, self.y + ay);
    if (p) { showSign(p.sign); return true; }
    if (fromKey) toast('Walk up to a landmark and face it, then press Space to look.');
    return false;
  }
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const wx = (((e.clientX - r.left) / r.width) * VIEW_W) / zoom() + cam.x;
    const wy = (((e.clientY - r.top) / r.height) * VIEW_H) / zoom() + cam.y;
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    // Trainers stand a tile and a half tall, so a tap on the head counts too.
    for (const p of players.values()) {
      if (p.id !== me && p.x === tx && (p.y === ty || p.y === ty + 1)) {
        stopWalk();
        if (p.inb && lastNear) return send({ t: 'watch', id: lastNear.id });
        return send({ t: 'challenge', to: p.id });
      }
    }
    if (roomKind === 'house') {
      const ex = house.exit;
      if (tx === ex.x && ty === ex.y) return walkTo([[ex.x, ex.y - 1]], 'd');
      return walkTo([[tx, ty]]);
    }
    for (const geo of roomKind === 'town' ? town.plots : []) {
      const st = live(geo.id);
      if (st.owner && tx >= geo.x && tx < geo.x + geo.w && ty >= geo.y - 1 && ty < geo.y + geo.h - 1) {
        return walkTo([[geo.door.x, geo.door.y + 1]], 'u');
      }
    }
    const p = propAt(tx, ty);
    if (p) {
      const spots = around(...p.f);
      return walkTo(spots.map(([x, y]) => [x, y]), (self) => (spots.find(([x, y]) => x === self.x && y === self.y) || [])[2], p.sign);
    }
    walkTo([[tx, ty]]);
  });

  // ---------- camera ----------
  const rows = () => (roomKind === 'house' ? house?.rows : mapNow()?.rows) || [];
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
    'trainer-a', 'trainer-b', 'trainer-c', 'trainer-d', 'tile-tall-grass', 'tile-flowers', 'prop-route-sign', 'prop-bridge', 'prop-fence',
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
    // Calm the ground without changing the original art or tinting buildings and trainers.
    // These small textures are prepared only when the cached map ground is rebuilt.
    const texture = (name, wash, opacity = 0, size = 1) => {
      if (!has(name)) return null;
      if (!wash) return g.createPattern(ART[name], 'repeat');
      const im = ART[name], tile = document.createElement('canvas');
      tile.width = Math.max(1, Math.round(im.naturalWidth * size));
      tile.height = Math.max(1, Math.round(im.naturalHeight * size));
      const paint = tile.getContext('2d');
      paint.imageSmoothingEnabled = false;
      paint.drawImage(im, 0, 0, tile.width, tile.height);
      paint.globalAlpha = opacity;
      paint.fillStyle = wash;
      paint.fillRect(0, 0, tile.width, tile.height);
      return g.createPattern(tile, 'repeat');
    };
    const grass = texture('tile-grass', '#77875c', 0.34);
    const path = texture('tile-path', '#b5aa8c', 0.52, 2 / 3);
    const water = texture('tile-water');
    if (!grass || !path || !water) {
      g.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      r.forEach((row, y) => [...row].forEach((ch, x) => townTile(g, ch, x, y)));
      return c;
    }
    g.fillStyle = grass;
    g.fillRect(0, 0, c.width, c.height);
    const at = (x, y) => (r[y] && r[y][x]) || 'T';
    // Wilds terrain. Tall grass and starflowers use their Sprite Book tiles. Rocky ground and scorched heath tint
    // the path and grass art, so every zone reads as its own place without new pictures.
    const tall = texture('tile-tall-grass', '#9ccf55', 0.2);
    const flowers = texture('tile-flowers', '#d8c75a', 0.12);
    const rocky = texture('tile-path', '#77736b', 0.62, 2 / 3);
    const heath = texture('tile-grass', '#5a3a22', 0.62);
    r.forEach((row, y) => [...row].forEach((ch, x) => {
      const fill = ch === 'P' || ch === 'E' ? path : ch === 'W' ? water : ch === 'G' ? tall : ch === 'C' ? flowers : ch === 'R' ? rocky : ch === 'A' ? heath : null;
      if (fill) { g.fillStyle = fill; g.fillRect(x * T, y * T, T, T); }
      const h = hash(x, y);
      if (ch === 'R') {
        // Loose stones.
        for (let i = 0; i < 3; i++) { const k = hash(x * 3 + i, y * 7); g.fillStyle = OUTLINE; g.fillRect(x * T + 6 + (k % 46), y * T + 6 + ((k >>> 8) % 46), 10, 8); g.fillStyle = (k >>> 16) & 1 ? '#a39d90' : '#8c877c'; g.fillRect(x * T + 8 + (k % 46), y * T + 8 + ((k >>> 8) % 46), 6, 4); }
      } else if (ch === 'A') {
        // Glowing embers in the ash.
        for (let i = 0; i < 2; i++) { const k = hash(x * 5 + i, y * 3 + 1); g.fillStyle = (k >>> 16) % 3 ? '#ff9a3c' : '#ffd166'; g.fillRect(x * T + 6 + (k % 50), y * T + 6 + ((k >>> 8) % 50), 4, 4); }
      } else if (ch === 'C' && h % 4 === 0) {
        // A starflower or two: tiny pale gold stars.
        const sx = x * T + 10 + (h % 40), sy = y * T + 10 + ((h >>> 8) % 40);
        g.fillStyle = '#fff6c2'; g.fillRect(sx, sy + 3, 10, 3); g.fillRect(sx + 3, sy, 3, 10);
      }
    }));
    // A low mossy curb belongs to the outside of a path, never between two path tiles.
    // Drawing it in the ground cache keeps movement/camera work independent and costs
    // no extra work per animation frame. It is visual only: walkable tiles stay the same.
    const curb = () => {
      g.fillStyle = '#829060'; g.fillRect(0, 0, T, 2);
      g.fillStyle = '#aaa17d'; g.fillRect(0, 2, T, 4);
      g.fillStyle = '#c1b38e'; g.fillRect(0, 2, T, 1);
      g.fillStyle = '#8d896c'; g.fillRect(0, 6, T, 1);
      g.fillStyle = '#96916f';
      for (let joint = 16; joint < T; joint += 32) g.fillRect(joint, 3, 1, 3);
    };
    const land = (x, y) => !'PWE'.includes(at(x, y));
    r.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== 'P' && ch !== 'E') return;
      const px = x * T, py = y * T;
      if (land(x, y - 1)) { g.save(); g.translate(px, py); curb(); g.restore(); }
      if (land(x + 1, y)) { g.save(); g.transform(0, 1, -1, 0, px + T, py); curb(); g.restore(); }
      if (land(x, y + 1)) { g.save(); g.transform(-1, 0, 0, -1, px + T, py + T); curb(); g.restore(); }
      if (land(x - 1, y)) { g.save(); g.transform(0, -1, 1, 0, px, py + T); curb(); g.restore(); }
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

  // The pond drifts slowly: the water texture is redrawn over the water tiles a few pixels further along each frame.
  // The bank outline from the ground canvas is drawn back on top so the edge stays crisp.
  let waterPattern = null;
  function shimmer(now, x0, y0, x1, y1) {
    if (!has('tile-water') || reduceMotion) return;
    if (!waterPattern) waterPattern = ctx.createPattern(ART['tile-water'], 'repeat');
    const r = rows();
    const off = (now / 90) % 192;
    const m = new DOMMatrix().scale(1 / SCALE).translate(off, off * 0.4);
    waterPattern.setTransform(m);
    ctx.fillStyle = waterPattern;
    const at = (x, y) => (r[y] && r[y][x]) || 'T';
    for (let y = Math.max(0, y0); y <= Math.min(r.length - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(r[0].length - 1, x1); x++) {
        if (r[y][x] !== 'W') continue;
        // Keep the drawn bank: inset the redraw on any side that touches land.
        const l = at(x - 1, y) !== 'W' ? 5 / SCALE : 0, t = at(x, y - 1) !== 'W' ? 6 / SCALE : 0;
        const rr = at(x + 1, y) !== 'W' ? 5 / SCALE : 0, b = at(x, y + 1) !== 'W' ? 4 / SCALE : 0;
        ctx.fillRect(x * TILE + l, y * TILE + t, TILE - l - rr, TILE - t - b);
      }
    }
  }
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    const map = mapNow();
    const r = map.rows;
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
    for (const p of map.props || []) {
      if (p.x > x1 + 1 || p.x + p.w < x0 - 1 || p.b < y0 || p.b - 6 > y1) continue;
      list.push({ b: p.flat ? -0.5 : p.b, draw: () => (has(p.s) ? sprite(p.s, p.x, p.b, p.w) : boxShape(p.x, p.b, p.w, Math.min(2, p.w), '#b5523b')) });
    }
    for (const geo of roomKind === 'town' ? town.plots : []) {
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
    const moving = Boolean(p.seg || p.q.length);
    const px = p.dx * TILE, py = p.dy * TILE;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(px + 16, py + 29, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (p.id === me) {
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(px + 16, py + 29, 13, 5.5, 0, 0, Math.PI * 2); ctx.stroke();
    }
    const look = TRAINERS[(p.look ?? p.id) % TRAINERS.length];
    if (has(look)) {
      // Left foot, stand, right foot, stand: one foot forward per tile, like Red and Blue.
      const step = moving ? [0, 1, 2, 1][Math.floor(p.stride * 2) % 4] : 1;
      ctx.drawImage(ART[look], step * 64, (FACE_ROW[p.f] ?? 0) * 96, 64, 96, px, py + TILE - 48, 32, 48);
    } else {
      ctx.fillStyle = p.c; ctx.fillRect(px + 8, py + 10, 16, 16);
      ctx.fillStyle = '#f2c9a0'; ctx.fillRect(px + 10, py + 2, 12, 10);
    }
    // Standing in tall grass hides your feet, the Red and Blue way.
    if (roomKind === 'wilds' && has('tile-tall-grass') && rows()[Math.round(p.dy)]?.[Math.round(p.dx)] === 'G') {
      ctx.drawImage(ART['tile-tall-grass'], 0, 30, 64, 34, px, py + 15, 32, 17);
    }
    const top = py + TILE - 50;
    // In a crowd, name tags show only for you, trainers within a few steps, and anyone talking.
    const self = players.get(me);
    const talking = p.bubble && p.bubbleUntil > now;
    const near = self && Math.abs(p.dx - self.dx) + Math.abs(p.dy - self.dy) <= 4;
    if (p.id === me || near || talking || players.size <= 8) {
      labels.push([p.inb ? `${p.name} (Battling)` : p.busy ? `${p.name} (Busy)` : p.name, px + 16, top, p.id === me ? '#ffd166' : p.busy ? '#9fb59a' : '#f4f1e6', p.id === me ? 0 : 1]);
    }
    if (talking) bubbles.push([p.bubble, px + 16, top - 16]);
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
    const dt = Math.min(100, now - (lastFrame || now));
    lastFrame = now;
    selfTick(now);
    for (const p of players.values()) if (p.id !== me) remoteTick(p, dt);
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0b1410';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const r = rows();
    if (r.length) {
      const key = `${room}:${artWaiting}`;
      if (!ground || groundKey !== key) { ground = buildGround(); groundKey = key; }
      const target = cameraTarget();
      cam = target; // locked to your trainer, so the walk never wobbles
      const z = zoom(), vw = VIEW_W / z, vh = VIEW_H / z;
      const cx = Math.round(cam.x * SCALE * z) / (SCALE * z), cy = Math.round(cam.y * SCALE * z) / (SCALE * z);
      ctx.save();
      ctx.scale(z, z);
      ctx.translate(-cx, -cy);
      // Copy only the part of the ground that is on screen; the whole town is far bigger than the view.
      const gx = Math.max(0, cx), gy = Math.max(0, cy);
      const gw = Math.min(ground.width / SCALE - gx, vw - (gx - cx)), gh = Math.min(ground.height / SCALE - gy, vh - (gy - cy));
      if (gw > 0 && gh > 0) ctx.drawImage(ground, gx * SCALE, gy * SCALE, gw * SCALE, gh * SCALE, gx, gy, gw, gh);
      if (roomKind !== 'house') shimmer(now, Math.floor(cx / TILE), Math.floor(cy / TILE), Math.ceil((cx + vw) / TILE), Math.ceil((cy + vh) / TILE));
      const x0 = Math.floor(cx / TILE), y0 = Math.floor(cy / TILE);
      const x1 = Math.ceil((cx + vw) / TILE), y1 = Math.ceil((cy + vh) / TILE);
      const things = [];
      if (roomKind !== 'house') townThings(x0, y0, x1, y1, things);
      for (const p of players.values()) things.push({ b: p.dy + 1, draw: () => trainer(p, now) });
      things.sort((a, b) => a.b - b.b);
      labels.length = 0; bubbles.length = 0;
      for (const t of things) t.draw();
      // Name tags never sit on top of each other: a tag that would overlap one already placed moves up a row.
      ctx.font = '12px monospace';
      const placed = [];
      labels.sort((a, b) => (a[4] ?? 1) - (b[4] ?? 1)); // your own tag claims its spot first
      for (const [text, x, y, color] of labels) {
        const w = ctx.measureText(text).width + 8;
        let ty = y;
        for (let i = 0; i < 4 && placed.some((q) => Math.abs(q.x - x) < (q.w + w) / 2 && Math.abs(q.y - ty) < 14); i++) ty -= 15;
        placed.push({ x, y: ty, w });
        label(text, x, ty, color);
      }
      // Bubbles step up out of each other's way too.
      ctx.font = '13px monospace';
      const stacked = [];
      for (const [text, x, y] of bubbles) {
        const w = ctx.measureText(text).width + 24;
        let ty = y;
        for (let i = 0; i < 4 && stacked.some((q) => Math.abs(q.x - x) < (q.w + w) / 2 && Math.abs(q.y - ty) < 30); i++) ty -= 31;
        stacked.push({ x, y: ty, w });
        bubble(text, x, ty);
      }
      ctx.restore();
    }
    const nb = roomKind !== 'house' && neighbor();
    challengeBtn.hidden = !nb || busyEl.checked || paused || Boolean(bt);
    challengeBtn.disabled = performance.now() < challengeRest;
    if (nb && !bt) tipSoon('challenge', 0);
    zoneTick();
    if (lastNear && performance.now() > lastNear.until) { lastNear = null; watchLine(); }
    if (bt) clockTick();
    requestAnimationFrame(frame);
  }



  // ---------- floating buttons and their pop-ups ----------
  const pops = { partnerBtn: 'partnerPop', sayBtn: 'phrases', menuBtn: 'menu' };
  function closePops(except) {
    for (const [btn, pop] of Object.entries(pops)) {
      if (btn === except) continue;
      $(pop).hidden = true; $(btn).setAttribute('aria-expanded', 'false');
    }
  }
  for (const [btn, pop] of Object.entries(pops)) {
    $(btn).addEventListener('click', (e) => {
      e.stopPropagation();
      const opening = $(pop).hidden;
      closePops(btn);
      $(pop).hidden = !opening;
      $(btn).setAttribute('aria-expanded', String(opening));
      if (btn === 'partnerBtn') buildPartners();
    });
    $(pop).addEventListener('click', (e) => e.stopPropagation());
  }
  // A tap on the map or anywhere else closes whatever is open.
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.pop, .hud')) { closePops(); closeRanks(); } });
  // Saying a phrase closes the phrase list so the map is clear again.
  phrasesEl.addEventListener('click', (e) => { if (e.target.closest('button')) setTimeout(() => closePops(), 0); });

  // ---------- tutorial tips ----------
  // Short tips pop up in the world the first time they matter, one at a time, instead of a wall of instructions.
  // Each shows once per visit (per tab, so the next student on a shared Chromebook sees them too).
  const TIPS = {
    walk: 'Walk with the arrow keys or WASD, or tap where you want to go.',
    partner: 'This is your battle partner. Tap it, bottom left, to switch Checklings.',
    say: 'Tap Say to talk to other trainers with phrases.',
    challenge: 'A trainer is right next to you! Press C or tap Challenge to battle them.',
    sign: 'Face a sign or landmark and press Space (or tap it) to read it.',
    gate: 'The trail north leads out of town into the wilds, where wild Checklings live.',
    wilds: 'Wild Checklings hide in tall grass, starflowers, rocky ground and scorched heath. Walk through to find one.',
    battle: 'Press 1 to 4 or tap a move. Both trainers pick, then the turn plays out.',
    'wild-battle': 'Wear it down first, then press 5 to throw a charm. Weaker Checklings are easier to catch. Press 6 to run.',
    caught: 'Your catch is yours to keep. Tap your partner button to battle with it, or to move Checklings between your party and your Den.',
    'caught-visit': 'Your catch is in your partner list for this visit. Tap your partner button to battle with it.',
    visitor: 'You are visiting, so catches and wins are not saved. To keep them, ride the bus from your Check-In page.',
  };
  const FOLLOW = { walk: ['partner', 'say'] };
  const tipEl = $('tip'), tipText = $('tipText');
  let tipNow = '', tipTimer = 0;
  const tipQueue = [];
  const seenTips = (() => { try { return new Set(JSON.parse(sessionStorage.getItem('checkaverse-tips') || '[]')); } catch { return new Set(); } })();
  function markSeen(k) { seenTips.add(k); try { sessionStorage.setItem('checkaverse-tips', JSON.stringify([...seenTips])); } catch { /* fine */ } }
  function tipSoon(key, delay) {
    if (!TIPS[key] || seenTips.has(key) || tipNow === key || tipQueue.includes(key)) return;
    tipQueue.push(key);
    setTimeout(showNextTip, delay || 0);
  }
  function showNextTip() {
    if (tipNow || !tipQueue.length) return;
    tipNow = tipQueue.shift();
    markSeen(tipNow);
    tipText.textContent = TIPS[tipNow];
    tipEl.hidden = false;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(hideTip, 12000);
  }
  function hideTip() {
    const was = tipNow;
    tipEl.hidden = true; tipNow = '';
    for (const k of FOLLOW[was] || []) tipSoon(k, 4000 + 9000 * (FOLLOW[was].indexOf(k)));
    setTimeout(showNextTip, 700);
  }
  $('tipOk').addEventListener('click', (e) => { if (e.detail) e.currentTarget.blur(); clearTimeout(tipTimer); hideTip(); });
  $('tipsAgain').addEventListener('click', () => {
    seenTips.clear(); try { sessionStorage.removeItem('checkaverse-tips'); } catch { /* fine */ }
    closePops(); tipSoon('walk', 200);
  });

  // Where you are standing: the wilds zone name, the gate out of town, a sign close by.
  let lastSpot = '';
  function zoneTick() {
    const self = players.get(me);
    if (!self || roomKind === 'house') return;
    const spot = `${room}:${self.x},${self.y}`;
    if (spot === lastSpot) return;
    lastSpot = spot;
    if (roomKind === 'wilds') {
      const z = wilds.zones?.[rows()[self.y]?.[self.x]] || '';
      if (z !== zoneName) { zoneName = z; placeLine(); }
    } else {
      const gate = (town.exits || [])[0];
      if (gate && Math.abs(gate.x - self.x) + Math.abs(gate.y - self.y) <= 4) tipSoon('gate', 0);
    }
    for (const [ax, ay] of Object.values(STEP)) if (propAt(self.x + ax, self.y + ay)) { tipSoon('sign', 300); break; }
  }

  // ---------- battles ----------
  // The server runs the battle. This screen plays each turn's events in order, one line at a time, then hands
  // the move buttons back. Watchers see the same screen without the buttons.
  let team = [], saved = false, partyMax = 3, partner = '', lastNear = null, bt = null, charms = 0;
  const bWild = $('bWild'), bCharm = $('bCharm'), bRun = $('bRun');
  const bEl = $('battle'), bMsg = $('bMsg'), bMoves = $('bMoves'), bDone = $('bDone'), bGiveUp = $('bGiveUp');
  const bClock = $('bClock'), bClockText = $('bClockText'), watchBtn = $('watch');
  const TYPE_NAMES = { meadow: 'Meadow', gear: 'Gear', cosmic: 'Cosmic', ember: 'Ember', tide: 'Tide', stone: 'Stone', storm: 'Storm', shade: 'Shade' };
  const typeImg = (t) => { const im = document.createElement('img'); im.src = `/art/type-${t}.png`; im.alt = TYPE_NAMES[t] || ''; return im; };
  function savedPartner() { try { return localStorage.getItem('checkaverse-partner'); } catch { return null; } }
  // The partner list comes from the town. A saved trainer sees their party (up to three) and their Den.
  // A visitor sees the four starters at level 10 and anything caught this visit.
  const shortName = (c) => `${c.nick || c.name} Lv ${c.level}`;
  function partnerButton(c) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(c.v === partner));
    const im = document.createElement('img'); im.src = `/art/front-${c.species}.png`; im.alt = '';
    b.append(im, c.caught ? `${shortName(c)} ★` : shortName(c));
    const toNext = c.need ? `, ${c.xp} of ${c.need} XP to level ${c.level + 1}` : '';
    b.title = `${c.nick ? `${c.nick}, a ` : ''}${c.name}, ${TYPE_NAMES[c.type] || ''} type, level ${c.level}${toNext}`;
    b.disabled = Boolean(bt);
    b.addEventListener('click', (e) => {
      if (e.detail) b.blur();
      if (bt || c.v === partner) return;
      if (!saved && !c.caught) { try { localStorage.setItem('checkaverse-partner', c.v); } catch { /* storage can be off on school machines */ } }
      send({ t: 'partner', v: c.v });
    });
    return b;
  }
  function denButton(c, toParty, can) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'den-btn';
    b.textContent = toParty ? 'Join' : 'Rest';
    b.title = toParty ? `Bring ${c.nick || c.name} into your party` : `Send ${c.nick || c.name} to rest in your Den`;
    b.disabled = Boolean(bt) || !can;
    b.addEventListener('click', (e) => { if (e.detail) b.blur(); send({ t: 'den', v: c.v, party: toParty }); });
    return b;
  }
  function buildPartners() {
    const box = $('partners');
    box.textContent = '';
    const party = team.filter((c) => !c.den), den = team.filter((c) => c.den);
    for (const c of party) {
      if (!saved) { box.appendChild(partnerButton(c)); continue; }
      const row = document.createElement('div'); row.className = 'team-row';
      row.append(partnerButton(c), denButton(c, false, party.length > 1));
      box.appendChild(row);
    }
    const denBox = $('den');
    denBox.textContent = '';
    denBox.hidden = !saved || !den.length;
    if (saved && den.length) {
      const h = document.createElement('p'); h.className = 'pop-title'; h.textContent = `Your Den (${den.length})`;
      denBox.appendChild(h);
      for (const c of den) {
        const row = document.createElement('div'); row.className = 'team-row den-row';
        const im = document.createElement('img'); im.src = `/art/front-${c.species}.png`; im.alt = '';
        const name = document.createElement('span'); name.textContent = shortName(c);
        row.append(im, name, denButton(c, true, party.length < partyMax));
        denBox.appendChild(row);
      }
    }
    $('partnerNote').textContent = saved
      ? `Up to ${partyMax} Checklings travel with you. The others wait in your Den. Every check-in grows your partner.`
      : 'You are visiting, so nothing here is saved. Ride the bus from your Check-In page to bring your own Checkling.';
    const now = team.find((x) => x.v === partner);
    if (now) { $('partnerImg').src = `/art/front-${now.species}.png`; $('partnerName').textContent = shortName(now); }
  }
  function charmLine() {
    const chip = $('charmChip');
    const visitCatches = saved ? 0 : team.filter((c) => c.caught).length;
    chip.hidden = roomKind !== 'wilds' && !visitCatches;
    chip.textContent = `Charms ${charms}${visitCatches ? ` · Caught ${visitCatches}` : ''}`;
  }
  function recordLine(r) { $('record').textContent = r && (r.w || r.l || r.d) ? `${r.w}W ${r.l}L${r.d ? ` ${r.d}T` : ''}` : ''; }
  function watchLine() { watchBtn.hidden = !lastNear || Boolean(bt); }
  watchBtn.addEventListener('click', () => { if (lastNear) send({ t: 'watch', id: lastNear.id }); });

  // Which side is drawn near (back sprite) and which far. Watchers see side 0 near.
  const nearSide = () => (bt && bt.you === 1 ? 1 : 0);
  function openBattle(m) {
    held.length = 0; stopWalk(); hideAsk();
    bt = { id: m.id, you: m.you, view: m.view, queue: [], playing: false, picked: '', foePicked: false, done: false,
      turnMs: m.turnMs, until: performance.now() + (m.left ?? m.turnMs), watching: m.you === null, wild: Boolean(m.wild), zone: m.zone || '' };
    closePops();
    lastNear = null; watchLine();
    bEl.hidden = false;
    bDone.hidden = true; bMoves.hidden = bt.watching;
    bGiveUp.hidden = bt.wild; bGiveUp.textContent = bt.watching ? 'Stop watching' : 'Give up'; bGiveUp.dataset.sure = '';
    bWild.hidden = !bt.wild;
    for (const id of ['bFoeKo', 'bMeKo']) $(id).hidden = true;
    for (const id of ['bFoeMon', 'bMeMon']) $(id).classList.remove('down', 'hit', 'shake', 'caught');
    drawSides(m.view, true);
    const n = nearSide(), foe = m.view.sides[1 - n], mine = m.view.sides[n];
    if (bt.watching) say(`You are watching ${m.view.sides[0].name} and ${m.view.sides[1].name}.`);
    else if (bt.wild) { say(`A wild ${foe.speciesName} jumped out of the ${(bt.zone || 'grass').toLowerCase()}! Go, ${mine.speciesName}!`); tipSoon('wild-battle', 1600); }
    else { say(`${foe.name} sent out ${foe.speciesName}! ${m.intro || ''} Go, ${mine.speciesName}!`); tipSoon('battle', 1600); }
    buildMoves(); buildPartners();
    if (!bt.watching) setTimeout(() => bMoves.querySelector('button:not(:disabled)')?.focus({ preventScroll: true }), 50);
  }
  function closeBattle(quiet) {
    if (bt && bt.watching && !bt.done && !quiet) send({ t: 'unwatch' });
    bt = null;
    bEl.hidden = true;
    buildPartners(); watchLine();
  }
  function bar(el, value, max, hp) {
    const pct = Math.max(0, Math.min(100, (100 * value) / Math.max(1, max)));
    el.style.width = `${pct}%`;
    if (hp) { el.classList.toggle('mid', pct <= 50 && pct > 20); el.classList.toggle('low', pct <= 20); }
  }
  function drawSides(view, sprites) {
    const n = nearSide(), mine = view.sides[n], foe = view.sides[1 - n];
    const nameWith = (el, f) => { el.textContent = f.speciesName; el.prepend(typeImg(f.type)); };
    nameWith($('bFoeName'), foe); nameWith($('bMeName'), mine);
    $('bFoeLv').textContent = `Lv ${foe.level}`; $('bMeLv').textContent = `Lv ${mine.level}`;
    $('bFoeTrainer').textContent = bt && bt.wild ? `Wild · ${bt.zone}` : foe.name;
    if (bt && bt.wild) $('bFoeName').childNodes[1].textContent = `Wild ${foe.speciesName}`;
    bar($('bFoeHp'), foe.hp, foe.maxHp, true); bar($('bFoeSt'), foe.stamina, foe.maxStamina);
    bar($('bMeHp'), mine.hp, mine.maxHp, true); bar($('bMeSt'), mine.stamina, mine.maxStamina);
    $('bMeHpNum').textContent = `${bt && bt.watching ? `${mine.name} · ` : ''}HP ${mine.hp} / ${mine.maxHp}`;
    $('bMeStNum').textContent = `Stamina ${mine.stamina} / ${mine.maxStamina}`;
    if (sprites) {
      $('bFoeMon').src = `/art/front-${foe.species}.png`; $('bFoeMon').alt = `${foe.name}'s ${foe.speciesName}`;
      $('bMeMon').src = `/art/back-${mine.species}.png`; $('bMeMon').alt = `${mine.name}'s ${mine.speciesName}, from behind`;
    }
  }
  function say(text) { bMsg.textContent = text; }
  function buildMoves() {
    bMoves.textContent = '';
    if (!bt || bt.watching) return;
    const mine = bt.view.sides[bt.you];
    mine.moves.forEach((mv, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.move = mv.id;
      const icon = mv.type ? typeImg(mv.type) : document.createElement('span');
      icon.classList.add('ic');
      const name = document.createElement('span'); name.className = 'k'; name.textContent = `${i + 1}. ${mv.name}`;
      const small = document.createElement('small');
      small.textContent = (mv.cost ? `${mv.cost} stamina. ` : 'Free. ') + (mv.next ? `Next: ${mv.next} damage. ` : '') + mv.detail;
      b.append(icon, name, small);
      b.addEventListener('click', (e) => { if (e.detail) b.blur(); pick(mv.id); });
      bMoves.appendChild(b);
    });
    movesLine();
  }
  function movesLine() {
    if (!bt || bt.watching) return;
    const mine = bt.view.sides[bt.you];
    [...bMoves.querySelectorAll('button')].forEach((b) => {
      const mv = mine.moves.find((x) => x.id === b.dataset.move);
      b.disabled = paused || bt.playing || bt.done || Boolean(bt.picked) || !mv || !mv.ok;
      b.classList.toggle('picked', bt.picked === b.dataset.move);
    });
    if (bt.wild) {
      const busy = paused || bt.playing || bt.done || Boolean(bt.picked);
      bCharm.textContent = `5. Throw charm (${charms} left)`;
      bCharm.disabled = busy || charms <= 0;
      bRun.disabled = busy;
    }
  }
  function throwCharm() {
    if (!bt || !bt.wild || bt.playing || bt.picked || bt.done || paused || charms <= 0) return;
    bt.picked = 'charm';
    send({ t: 'charm' });
    say('You threw a catching charm!');
    movesLine();
  }
  function runAway() {
    if (!bt || !bt.wild || bt.playing || bt.done || paused) return;
    send({ t: 'run' });
    bt.picked = 'run'; movesLine();
  }
  bCharm.addEventListener('click', (e) => { if (e.detail) bCharm.blur(); throwCharm(); });
  bRun.addEventListener('click', (e) => { if (e.detail) bRun.blur(); runAway(); });
  function pick(id) {
    if (!bt || bt.watching || bt.playing || bt.picked || bt.done || paused) return;
    const mv = bt.view.sides[bt.you].moves.find((x) => x.id === id);
    if (!mv || !mv.ok) return toast('Not enough stamina for that. Guard or Recover.');
    bt.picked = id;
    send({ t: 'pick', m: id });
    const foe = bt.view.sides[1 - bt.you];
    say(bt.foePicked ? 'Both picked. Here it comes...' : `You picked ${mv.name}. Waiting for ${foe.name}...`);
    movesLine();
  }
  function battleWait(side) {
    if (!bt) return;
    if (bt.watching) { say(`${bt.view.sides[side].name} has picked a move.`); return; }
    if (side === bt.you) return;
    bt.foePicked = true;
    if (!bt.picked && !bt.playing) say(`${bt.view.sides[side].name} has picked a move. Your turn!`);
  }
  function battleKey(e) {
    const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[e.code];
    if (n !== undefined && !e.repeat) { e.preventDefault(); const mv = bt.view.sides[bt.you ?? 0]?.moves[n]; if (mv && !bt.watching) pick(mv.id); return; }
    if ((e.code === 'Digit5' || e.code === 'Numpad5') && !e.repeat) { e.preventDefault(); throwCharm(); return; }
    if ((e.code === 'Digit6' || e.code === 'Numpad6') && !e.repeat) { e.preventDefault(); runAway(); return; }
    if (KEYS[e.code] || e.code === 'Space') { if (!(e.target instanceof HTMLButtonElement)) e.preventDefault(); }
    if (e.code === 'Escape' && bt.done) closeBattle();
  }
  function clockTick() {
    if (!bt || bt.done) { bClock.style.width = '0%'; bClockText.textContent = ''; return; }
    if (bt.playing) { bClockText.textContent = ''; return; }
    const left = Math.max(0, bt.until - performance.now());
    bClock.style.width = `${(100 * left) / bt.turnMs}%`;
    const secs = Math.ceil(left / 1000);
    bClockText.textContent = paused ? 'Paused by the teacher.' : bt.watching ? `${secs}s left this turn` : bt.picked ? `${secs}s left this turn` : `${secs}s to pick. If time runs out, your Checkling Guards.`;
  }

  // Each event gets its own beat on screen, Red and Blue style.
  const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? Math.min(ms, 350) : ms));
  function queueTurn(m) { bt.queue.push({ turn: m }); if (!bt.playing) playQueue(); }
  function queueEnd(m) { bt.queue.push({ end: m }); if (!bt.playing) playQueue(); }
  async function playQueue() {
    const b = bt;
    b.playing = true; movesLine();
    while (bt === b && b.queue.length) {
      const item = b.queue.shift();
      if (item.turn) await playTurn(b, item.turn);
      else await showEnd(b, item.end);
    }
    if (bt !== b) return;
    b.playing = false;
    movesLine();
    if (!b.done && !b.watching) { say(`What will ${b.view.sides[b.you].speciesName} do?`); bMoves.querySelector('button:not(:disabled)')?.focus({ preventScroll: true }); }
  }
  async function playTurn(b, m) {
    const n = nearSide();
    const who = (side) => { const f = b.view.sides[side]; return side === n && !b.watching ? f.speciesName : b.wild ? `The wild ${f.speciesName}` : `${f.name}'s ${f.speciesName}`; };
    const monEl = (side) => (side === n ? $('bMeMon') : $('bFoeMon'));
    // Health and stamina move with each event, from a working copy of the view.
    const live = JSON.parse(JSON.stringify(b.view));
    for (const e of m.events) {
      if (bt !== b) return;
      if (e.k === 'use') {
        say(`${who(e.side)} used ${e.name}!`);
        if (e.stamina !== undefined) live.sides[e.side].stamina = e.stamina;
        const el = monEl(e.side);
        el.classList.add(e.side === n ? 'lunge-me' : 'lunge-foe');
        drawSides(live);
        await wait(650);
        el.classList.remove('lunge-me', 'lunge-foe');
      } else if (e.k === 'stamina') {
        live.sides[e.side].stamina = e.value; drawSides(live);
        if (e.delta) { say(`${who(e.side)} got ${e.delta} stamina back.`); await wait(600); }
      } else if (e.k === 'hit') {
        live.sides[e.side].hp = e.hp;
        const el = monEl(e.side);
        el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
        const pop = e.side === n ? $('bMePop') : $('bFoePop');
        pop.hidden = true; void pop.offsetWidth;
        pop.textContent = e.blocked ? `-${e.dmg} blocked` : `-${e.dmg}`;
        pop.classList.toggle('strong', e.eff === 'strong');
        pop.hidden = false;
        drawSides(live);
        await wait(700);
      } else if (e.k === 'ko') {
        monEl(e.side).classList.add('down');
        (e.side === n ? $('bMeKo') : $('bFoeKo')).hidden = false;
        await wait(500);
      } else if (e.k === 'say') {
        say(e.text);
        await wait(900);
      } else if (e.k === 'charm') {
        // The charm lands, the wild one wobbles once per shake, then it is caught or breaks free.
        charms = e.left ?? charms; charmLine();
        const el = $('bFoeMon');
        say('You threw a catching charm!');
        await wait(600);
        for (let i = 0; i < e.shakes; i++) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); say(['Shake...', 'Shake... shake...', 'Shake... shake... shake...'][i]); await wait(650); }
        if (e.ok) { el.classList.add('caught'); say(`Caught! The wild ${b.view.sides[1].speciesName} is yours.`); await wait(1100); }
        else { el.classList.remove('shake'); say(['It broke free right away!', 'Argh! It wriggled loose.', 'So close! It broke free.'][e.shakes] || 'It broke free!'); await wait(900); }
      }
    }
    b.view = m.view;
    b.picked = ''; b.foePicked = false;
    b.until = performance.now() + (m.left ?? b.turnMs);
    drawSides(m.view);
    buildMoves();
  }
  async function showEnd(b, m) {
    b.done = true;
    b.view = m.view;
    drawSides(m.view);
    const n = nearSide();
    const why = { 'gave up': 'gave up', left: 'left the Checkaverse', timeout: 'ran out the clock' };
    let line;
    if (b.wild) {
      const wildOne = m.view.sides[1], mine = m.view.sides[0];
      if (m.reason === 'caught') line = m.kept === 'party' ? `Caught! ${wildOne.speciesName} (Lv ${wildOne.level}) joins your party. Pick it under the partner button any time.`
        : m.kept === 'den' ? `Caught! Your party is full, so ${wildOne.speciesName} (Lv ${wildOne.level}) went to rest in your Den.`
        : `Caught! ${wildOne.speciesName} (Lv ${wildOne.level}) joins your partners for this visit. Pick it under the partner button any time.`;
      else if (m.reason === 'ran') line = 'Got away safely.';
      else if (m.winner === 0) line = `The wild ${wildOne.speciesName} is knocked out and scurries back home. ${mine.speciesName} looks proud.`;
      else line = `${mine.speciesName} is knocked out, but it recovers fully after the match. The wild ${wildOne.speciesName} wanders off.`;
    } else if (m.winner === 'draw') line = m.reason === 'time' ? 'The match hit its turn limit with health even. It is a tie!' : m.reason === 'restart' ? 'The Checkaverse restarted, so the match ended without a winner.' : 'Both trainers stepped away. No winner this time.';
    else {
      const w = m.view.sides[m.winner], l = m.view.sides[1 - m.winner];
      const how = why[m.reason] ? `${l.name} ${why[m.reason]}. ` : '';
      if (b.watching) line = `${how}${w.name} and ${w.speciesName} win!`;
      else if (m.winner === n) line = `${how}You won! ${w.speciesName} looks very pleased with itself.`;
      else line = `${how}${w.name} won this one. ${l.speciesName} is knocked out, but it recovers fully after the match.`;
    }
    say(line);
    bMoves.hidden = true;
    bWild.hidden = true;
    bGiveUp.hidden = true;
    bDone.hidden = false;
    $('bGg').hidden = b.watching || b.wild;
    $('bClose').textContent = b.watching ? 'Stop watching' : b.wild ? 'Keep exploring' : 'Back to town';
    (b.watching || b.wild ? $('bClose') : $('bGg')).focus({ preventScroll: true });
    await wait(10);
  }
  $('bGg').addEventListener('click', (e) => { if (e.detail) e.currentTarget.blur(); const i = phrases.indexOf('Good game'); if (i >= 0) send({ t: 'say', p: i }); closeBattle(); });
  $('bClose').addEventListener('click', () => closeBattle());
  // Giving up takes two presses, so a stray click cannot throw a match.
  bGiveUp.addEventListener('click', (e) => {
    if (e.detail) bGiveUp.blur();
    if (!bt) return;
    if (bt.watching) return closeBattle();
    if (bGiveUp.dataset.sure) { send({ t: 'forfeit' }); bGiveUp.hidden = true; return; }
    bGiveUp.dataset.sure = '1'; bGiveUp.textContent = 'Press again to give up';
    setTimeout(() => { if (bt && !bt.done) { bGiveUp.dataset.sure = ''; bGiveUp.textContent = 'Give up'; } }, 3000);
  });

  // ?debug lets the movement test read where trainers are drawn. It changes nothing.
  if (/[?&]debug\b/.test(location.search)) window.__checkaverse = { players, me: () => me, battle: () => bt, room: () => room, walk: (x, y) => walkTo([[x, y]]) };
  connect();
  requestAnimationFrame(frame);
})();
