(() => {
  'use strict';
  const TILE = 32;
  const canvas = document.getElementById('town');
  const ctx = canvas.getContext('2d');
  const { createWorld, trainerFrame, paintPaths, paintMeadow, paintFlower } = window.CheckaverseWorld;
  let world = null;
  const residentDialog = document.getElementById('residentDialog'), worldJournal = document.getElementById('worldJournal');
  const conversing = () => residentDialog.open || worldJournal.open;
  // The map is always 16 tiles (512 map pixels) tall. The canvas matches the screen's real pixels, so the art is
  // drawn once at the size it is seen: crisp on a big screen, smoothly reduced on a small Chromebook, never
  // stretched a second time by the browser. GROUND is the cached ground's own resolution, two pixels a map pixel.
  const GROUND = 2, MAX_PIXELS = 1440;
  let SCALE = 2;
  let VIEW_W = canvas.width / SCALE, VIEW_H = canvas.height / SCALE;
  function fitCanvas() {
    const aspect = Math.max(0.35, Math.min(2.6, window.innerWidth / Math.max(1, window.innerHeight)));
    const dpr = window.devicePixelRatio || 1;
    canvas.height = Math.max(256, Math.min(MAX_PIXELS, Math.round(window.innerHeight * dpr)));
    canvas.width = Math.round(canvas.height * aspect);
    SCALE = canvas.height / 512;
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
  let town = null, house = null, wilds = null, kettle = null, stones = [], phrases = [], myPlot = 0, signs = {}, rerolls = 0;
  // The outdoor map you are on right now: the town, the wilds or your own Kettle Creek. Houses use the house map.
  const mapNow = () => (roomKind === 'house' ? house : roomKind === 'wilds' ? wilds : roomKind === 'kettle' ? kettle : town);
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
    // Kettle Creek is every student's own private copy, so a live head count would always read 1.
    if (roomKind === 'kettle' || (roomKind === 'house' && roomOwner?.map === 'kettle')) return setStatus('Your home town · only you are here');
    const where = roomKind === 'house' ? 'in this house' : 'here';
    setStatus(`Live · ${n} trainer${n === 1 ? '' : 's'} ${where}`);
  }
  let zoneName = '';
  function placeLine() {
    // The title names the world you are in: your own Kettle Creek, or the shared Checkaverse the bus goes to.
    const home = roomKind === 'kettle' || (roomKind === 'house' && roomOwner?.map === 'kettle');
    $('placeTitle').textContent = home ? 'Kettle Creek' : 'Checkaverse';
    placeEl.hidden = roomKind === 'kettle';
    if (roomKind === 'town') placeEl.textContent = 'Town';
    else if (roomKind === 'kettle') placeEl.textContent = '';
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
      closeConversation(); worldJournal.close();
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
        me = m.you; town = m.town; house = m.house; wilds = m.wilds; kettle = m.kettle || null; stones = m.stones || []; phrases = m.phrases; myPlot = m.myPlot;
        if (m.world && !world) world = createWorld(m.world);
        team = m.team || []; saved = Boolean(m.saved); egg = m.egg || null; partyMax = m.partyMax || 3; charms = m.charms ?? 0; charmLine(); recordLine(m.record);
        signs = m.signs || {}; rerolls = m.rerolls || 0; renameLine(); stopWalk(); setPaused(m.paused);
        partner = m.partner; closeBattle(true); lastNear = null; watchLine();
        // A ticket the town turned down is dropped, so a reload does not try it again.
        if (!saved && ticket) { ticket = null; try { sessionStorage.removeItem('checkaverse-ticket'); } catch { /* fine */ } }
        // A visitor's starter choice is remembered on this Chromebook. A saved trainer's partner is kept by the town.
        if (!saved) { const pick = savedPartner(); if (pick && pick !== partner && team.some((x) => x.v === pick && !x.caught)) send({ t: 'partner', v: pick }); }
        buildPartners();
        if (!saved) tipSoon('visitor', 2500); else tipSoon('care', 9000);
        room = m.room || 'town'; roomKind = m.kind || 'town'; roomOwner = null;
        world?.reset(roomKind);world?.sync(m.life,true);world?.syncStories(m.stories);
        busLine();
        if (roomKind === 'kettle') tipSoon('kettle', 2000);
        setPlayers(m.players);
        meEl.textContent = players.get(me)?.name || 'Trainer';
        buildPhrases();
        busyEl.checked = false;
        countLine(); placeLine(); homeLine();
        snapCamera();
        tipSoon('walk', 1200);
        break;
      case 'room':
        closeConversation(); worldJournal.close();
        room = m.room; roomKind = m.kind; roomOwner = m.owner;
        world?.reset(roomKind,roomOwner?.resident);world?.sync(m.life,true);
        if (roomKind === 'kettle') stones = m.stones || [];
        busLine();
        stopWalk();
        setPlayers(m.players);
        hideAsk();
        countLine(); placeLine(); homeLine();
        snapCamera();
        if(residentNav)setTimeout(()=>requestResidentPath(),260);
        zoneName = ''; placeLine(); charmLine();
        if (roomKind === 'house') toast(roomOwner?.resident?`${roomOwner.name}'s home. ${roomOwner.description}`:roomOwner && roomOwner.owner === me ? 'Welcome home.' : `You stepped into ${roomOwner?.name || 'a trainer'}'s house. Look, but do not touch.`);
        if (roomKind === 'wilds') { toast('You walked out into the wilds.'); tipSoon('wilds', 900); }
        break;
      case 'residents':world?.sync(m,document.hidden||Boolean(bt));if(worldJournal.open)renderResidentDirectory();break;
      case 'resident_stories':world?.syncStories(m.stories);break;
      case 'resident_story_result':if(!m.ok)toast(m.msg);break;
      case 'resident_path':
        if(!residentNav||m.id!==residentNav.id)break;
        if(m.arrived){const nav=residentNav;residentNav=null;if(!nav.home)talkTo(m.id);else releaseResident(m.id);break;}
        walkTo([m.goal],m.then||'',m.last?`visit:${m.id}`:'');break;
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
        closeConversation(); worldJournal.close(); held.length = 0; stopWalk();
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
      case 'team': { const more = (m.team || []).length > team.length; team = m.team || []; saved = Boolean(m.saved); partner = m.partner ?? partner; egg = m.egg || null; charms = m.charms ?? charms; buildPartners(); charmLine(); if (more) tipSoon(saved ? 'caught' : 'caught-visit', 4000); break; }
      case 'elsewhere': elsewhere = true; break;
      case 'ranks': showRanks(m); break;
      case 'body': showBody(m); break;
      case 'cared': $('careMsg').textContent = m.msg; if (m.body && careView) { careView.body = m.body; renderCare(); } break;
      case 'report': showReport(m); break;
      case 'death': showDeath(m); break;
      case 'cemetery': showCemetery(m); break;
      case 'pt': { const p = players.get(m.id); if (p) p.pt = m.v; break; }
      case 'notice': toast(m.msg); break;
      case 'home': myPlot = m.myPlot; homeLine(); break;
      case 'teacher': toastTimer && clearTimeout(toastTimer); toastEl.textContent = `Teacher: ${m.msg}`; toastEl.hidden = false; teacherUntil = performance.now() + 8000; toastTimer = setTimeout(() => { toastEl.hidden = true; }, 8000); break;
      case 'paused': closeConversation(); worldJournal.close(); setPaused(m.v); if (!m.v) toast('The Checkaverse is running again.'); break;
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
    if (conversing()) return;
    // The Busy checkbox is an input too, but clicking it must not leave the arrow keys dead until the student clicks the map.
    if (e.target instanceof HTMLInputElement && e.target.type !== 'checkbox' || (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) && e.code === 'Space') return;
    if (!askEl.hidden) { if (e.code === 'Escape') { e.preventDefault(); answer(false); } return; }
    if (bt) { battleKey(e); return; }
    if (e.code === 'Escape') { closePops(); closeRanks(); closeCards(); $('busPop').hidden = true; if (tipNow) { clearTimeout(tipTimer); hideTip(); } return; }
    const d = KEYS[e.code];
    if (d) { e.preventDefault(); cancelResidentNav(); stopWalk(); if (!e.repeat) { const s0 = players.get(me); if (s0) s0.bumped = ''; } press(d); return; }
    if (e.code === 'KeyC' && !e.repeat) challenge();
    if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) { e.preventDefault(); lookAhead(true); }
  });
  window.addEventListener('keyup', (e) => { const i = held.indexOf(KEYS[e.code]); if (i >= 0) held.splice(i, 1); });
  window.addEventListener('blur', () => { held.length = 0; });
  // Closing a Chromebook lid mid walk can swallow the keyup, so a hidden tab lets go of every key.
  document.addEventListener('visibilitychange', () => { send({t:'resident_visibility',v:!document.hidden});if (document.hidden) { held.length = 0; cancelResidentNav();stopWalk(); } });
  document.querySelectorAll('.pad button').forEach((b) => {
    const d = b.dataset.d;
    const down = (e) => { e.preventDefault(); cancelResidentNav();stopWalk(); const s0 = players.get(me); if (s0) s0.bumped = ''; press(d); };
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
  function stopWalk() { walk = null; world?.hold(residentDialog.open ? activeResident : ''); }
  function open(x, y) {
    const r = rows();
    if (y < 0 || y >= r.length || x < 0 || x >= r[0].length) return false;
    if (roomKind === 'house') return !HOUSE_SOLID.has(r[y][x]);
    if (TOWN_SOLID.has(r[y][x])) return false;
    if (roomKind === 'kettle') return !stones.some((st) => st.x === x && st.y === y);
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
    if (!askEl.hidden || paused || bt || conversing()) return;
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
    if(key.startsWith('visit:'))return requestResidentPath();
    if(key.startsWith('resident-home:')){const h=mapNow()?.residentHomes?.find(h=>h.id===key.slice(14));if(h)return walkTo([h.approach],'u');return;}
    if (key.startsWith('resident:')) return talkTo(key.slice(9));
    if (key === 'notice-board') return askRanks();
    if (key.startsWith('place:')) return openPlace(key.slice(6));
    if (key.startsWith('stone:')) { const [x, y] = key.slice(6).split(',').map(Number); const st = stones.find((q) => q.x === x && q.y === y); if (st) toast(`${st.trainer}'s ${st.speciesName}. ${st.epitaph}`); return; }
    if (key === 'bus-stop-kc' && saved) return askBus('town');
    if (key === 'bus-stop' && saved && kettle) return askBus('kettle');
    if (signs[key]) toast(signs[key]);
  }
  // ---------- residents and small stories ----------
  let activeResident = '', conversationFocus = null, cueTimer = 0,residentNav=null;
  function releaseResident(id){if(id)send({t:'resident_release',id});}
  function cancelResidentNav(){if(residentNav)releaseResident(residentNav.id);residentNav=null;}
  function requestResidentPath(){if(residentNav)send({t:'resident_find',id:residentNav.id,home:residentNav.home});}
  function visitResident(id,home=false){if(paused||bt)return;closeConversation();worldJournal.close();held.length=0;cancelResidentNav();stopWalk();residentNav={id,home};requestResidentPath();}
  const residentDistance = n => { const p = players.get(me); return p ? Math.abs(n.dx - p.dx) + Math.abs(n.dy - p.dy) : Infinity; };
  const residentGreeting=n=>n.activity&&['walk','idle','rest','visit'].includes(n.activity.action)?n.activity.speech:n.dialogue.start.text;
  function nearestResident() { return world?.active().filter(n => residentDistance(n) <= 2.2).sort((a,b) => residentDistance(a) - residentDistance(b))[0]; }
  function closeConversation() { releaseResident(activeResident);residentDialog.close(); activeResident = ''; world?.hold(''); }
  function conversationNode(n, key) {
    const node = n.dialogue[key];
    $('residentText').textContent = key==='start'?residentGreeting(n):node.text; $('residentChoices').replaceChildren();
    if(key==='start'&&n.activity){
      const context=(label,text,home=false)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>{
        $('residentText').textContent=typeof text==='function'?text():text;$('residentChoices').replaceChildren();
        const back=document.createElement('button');back.type='button';back.textContent='One more thing.';back.addEventListener('click',()=>{conversationNode(n,'start');$('residentChoices').querySelector('button')?.focus();});$('residentChoices').append(back);
        if(home){const go=document.createElement('button');go.type='button';go.textContent='Walk to your home';go.addEventListener('click',()=>visitResident(n.id,true));$('residentChoices').append(go);}back.focus();
      });$('residentChoices').append(b);};
      context('What are you doing?',()=>`${n.activity.speech}${n.carry?` I am carrying ${n.carry==='parcel'?'the clinic parcel':n.carry==='crate'?'a market crate':'my equipment'}.`:''}`);
      context('How has your round gone?',()=>`${n.lastCompleted||'I am just getting started.'} I have finished ${n.completed} stops so far.${n.deliveries?` Clinic parcels delivered: ${n.deliveries}.`:''}${n.received?` Clinic parcels received: ${n.received}.`:''}${n.visits?` Chats with neighbors: ${n.visits}.`:''}${n.helped?` Help from travelers: ${n.helped}.`:''}`);
      context('Tell me about your home.',()=>`My home is on the south lane in ${n.home.map==='kettle'?'Kettle Creek':'the Checkaverse'}. ${n.home.description}`,true);
    }
    for (const choice of node.choices) {
      if (choice.next === 'errand' && world.status(n.id) === 'done') continue;
      const b = document.createElement('button'); b.type = 'button'; b.textContent = choice.label;
      b.addEventListener('click', () => {
        if (paused || bt) return closeConversation();
        if (choice.action === 'errand') { world.start(n.id);send({t:'resident_story',id:n.id,action:'accept'}); closeConversation(); toast(`${n.errand.title} added to Around town in the menu.`); }
        else if (choice.action === 'journal') { closeConversation(); showJournal(); }
        else if (choice.next) { conversationNode(n, choice.next); $('residentChoices').querySelector('button')?.focus(); }
        else closeConversation();
      });
      $('residentChoices').append(b);
    }
  }
  function talkTo(id) {
    const n = world?.find(id);
    if (!n || paused || bt || !askEl.hidden) return;
    if (residentDistance(n) > 2.5) return toast(`Walk a little closer to ${n.name}, then press Space or tap Talk.`);
    conversationFocus = document.activeElement; held.length = 0; stopWalk(); closePops();
    activeResident = id; world.hold(id);
    residentNav=null;send({t:'resident_talk',id});
    if (performance.now() >= teacherUntil) { clearTimeout(toastTimer); toastEl.hidden = true; }
    $('residentName').textContent = n.name; $('residentRole').textContent = n.role;
    $('residentPortrait').src = `/art/trainer-${'abcd'[n.look]}.png`;
    conversationNode(n, 'start');
    if (world.finish(id)) {
      send({t:'resident_story',id,action:'return'});
      $('worldCue').hidden = true; clearTimeout(cueTimer);
      for (let i = world.discoveries.length - 1; i >= 0; i--) if (world.discoveries[i].id === id) world.discoveries.splice(i, 1);
      $('residentText').textContent = n.errand.complete;
      $('residentChoices').replaceChildren();
      const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Glad I could help.'; b.addEventListener('click', closeConversation); $('residentChoices').append(b);
    } else if (world.status(id) === 'looking') $('residentText').textContent = `${residentGreeting(n)} ${n.errand.request}`;
    else if (world.status(id) === 'done') $('residentText').textContent = `Thanks again for helping with ${n.errand.title.toLowerCase()}. ${residentGreeting(n)}`;
    if (!residentDialog.open) residentDialog.showModal();
    $('residentChoices').querySelector('button')?.focus();
  }
  residentDialog.addEventListener('close', () => {
    releaseResident(activeResident);
    activeResident = ''; world?.hold(''); held.length = 0;
    if (conversationFocus?.isConnected && !conversationFocus.hidden) conversationFocus.focus({preventScroll:true});
  });
  $('residentClose').addEventListener('click', closeConversation);
  $('talkBtn').addEventListener('click', () => { const n = nearestResident(); if (n) talkTo(n.id); });
  function showJournal() {
    if (paused || bt) return;
    held.length = 0; stopWalk(); closePops(); $('journalEntries').replaceChildren();
    const entries = world?.journal() || [];
    for (const e of entries) {
      const item = document.createElement('article'), title = document.createElement('h3'), line = document.createElement('p');
      title.textContent = `${e.status === 'done' ? 'Complete' : e.status === 'found' ? 'Ready to return' : 'Exploring'} · ${e.title}`;
      line.textContent = e.status === 'done' ? e.complete : e.status === 'found' ? `Bring your find back to ${e.name}.` : e.request;
      item.append(title, line); $('journalEntries').append(item);
    }
    if (!entries.length) { const p = document.createElement('p'); p.textContent = 'Talk to residents with the little speech bubble above their heads. Some have a small story you can help with.'; $('journalEntries').append(p); }
    renderResidentDirectory();
    worldJournal.showModal(); $('journalClose').focus();
  }
  function renderResidentDirectory(){
    const list=$('residentDirectory');
    const ids=new Set((world?.all()||[]).map(n=>n.id));for(const row of [...list.children])if(!ids.has(row.dataset.resident))row.remove();
    for(const n of world?.all()||[]){
      if(!n.activity)continue;let row=[...list.children].find(el=>el.dataset.resident===n.id);
      if(!row){row=document.createElement('article');row.dataset.resident=n.id;const title=document.createElement('h4'),line=document.createElement('p'),memory=document.createElement('p'),actions=document.createElement('div');
        title.textContent=`${n.name} · ${n.role}`;line.className='resident-where';memory.className='resident-memory';
        for(const [text,home]of[['Find and talk',false],['Visit home',true]]){const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',()=>visitResident(n.id,home));actions.append(b);}row.append(title,line,memory,actions);list.append(row);
      }
      const place=n.room.startsWith('home:')?`${(world.all().find(p=>p.id===n.room.slice(5))||n).name}'s home`:n.room==='kettle'?'Kettle Creek':n.room==='wilds'?'The wilds':'Town';
      row.querySelector('.resident-where').textContent=`${place} · ${n.activity.label}`;row.querySelector('.resident-memory').textContent=n.lastCompleted||'Starting a new round.';
    }
  }
  $('journalBtn').addEventListener('click', showJournal);
  $('journalClose').addEventListener('click', () => worldJournal.close());
  worldJournal.addEventListener('close', () => { held.length = 0; canvas.focus({preventScroll:true}); });
  // ---------- Kettle Creek and the bus ----------
  function openPlace(place) {
    const line = kettle?.places?.[place];
    if (place === 'home' || place === 'clinic') {
      askBody(partner || (team.find((x) => !x.den) || {}).v);
      if (line) toast(line);
      return;
    }
    if (line) toast(line);
  }
  let busTo = '';
  function askBus(to) {
    busTo = to;
    $('busTitle').textContent = to === 'town' ? 'Ride the bus to the Checkaverse?' : 'Ride the bus home to Kettle Creek?';
    $('busNote').textContent = to === 'town' ? 'Classmates are there to battle, plus the wilds and your house in the Neighborhood.' : 'Your Care panel, the clinic and Route 1 are at home.';
    closePops();
    $('busPop').hidden = false;
    $('busYes').focus();
  }
  $('busYes').addEventListener('click', () => { $('busPop').hidden = true; send({ t: 'bus', to: busTo }); });
  $('busNo').addEventListener('click', () => { $('busPop').hidden = true; });
  $('busPop').addEventListener('pointerdown', (e) => e.stopPropagation());
  function busLine() {
    const b = $('busBtn');
    b.hidden = !saved || !kettle;
    $('busLink').hidden = Boolean(saved && kettle);
    b.textContent = roomKind === 'kettle'||roomOwner?.map==='kettle' ? 'Ride the bus to the Checkaverse' : 'Ride the bus home to Kettle Creek';
  }
  $('busBtn').addEventListener('click', () => askBus(roomKind === 'kettle'||roomOwner?.map==='kettle' ? 'town' : 'kettle'));
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
    if (!self) return false;
    if (paused || bt || conversing()) return false;
    const [ax, ay] = STEP[self.f] || STEP.d;
    const resident = world?.active().find(n => Math.abs(n.dx - self.dx) + Math.abs(n.dy - self.dy) <= 2 && (n.x === self.x + ax && n.y === self.y + ay));
    if (resident) { talkTo(resident.id); return true; }
    if(roomKind==='house'){const near=nearestResident();if(near){talkTo(near.id);return true;}return false;}
    if (roomKind === 'kettle') {
      const door = (kettle.doors || []).find((d) => d.x === self.x && d.y === self.y);
      if (door && self.f === 'u') { showSign(`place:${door.place}`); return true; }
      const st = stones.find((q) => q.x === self.x + ax && q.y === self.y + ay);
      if (st) { toast(`${st.trainer}'s ${st.speciesName}. ${st.epitaph}`); return true; }
    }
    const p = propAt(self.x + ax, self.y + ay);
    if (p) { showSign(p.sign); return true; }
    const near = nearestResident();
    if (near) { talkTo(near.id); return true; }
    if (fromKey) toast('Walk up to a landmark and face it, then press Space to look.');
    return false;
  }
  canvas.addEventListener('click', (e) => {
    if (paused || bt || conversing()) return;
    cancelResidentNav();
    const r = canvas.getBoundingClientRect();
    const wx = (((e.clientX - r.left) / r.width) * VIEW_W) / zoom() + cam.x;
    const wy = (((e.clientY - r.top) / r.height) * VIEW_H) / zoom() + cam.y;
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    // When two residents stand close, the tap goes to the one whose body is nearest the finger.
    const tapX = wx / TILE - 0.5, tapY = wy / TILE - 0.2;
    const resident = world?.active().filter(n => Math.abs(n.dx - tx) < .85 && (Math.abs(n.dy - ty) < .85 || Math.abs(n.dy - ty - 1) < .85))
      .sort((a, b) => Math.hypot(a.dx - tapX, a.dy - tapY) - Math.hypot(b.dx - tapX, b.dy - tapY))[0];
    if (resident) {
      if (residentDistance(resident) <= 2.2) return talkTo(resident.id);
      return visitResident(resident.id);
    }
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
    const residentHome=mapNow()?.props?.find(p=>p.residentHome&&tx>=p.x&&tx<p.x+p.w&&ty>=p.b-5&&ty<p.b);
    if(residentHome){const h=mapNow().residentHomes.find(h=>h.id===residentHome.residentHome);return walkTo([h.approach],'u');}
    for (const geo of roomKind === 'town' ? town.plots : []) {
      const st = live(geo.id);
      if (st.owner && tx >= geo.x && tx < geo.x + geo.w && ty >= geo.y - 1 && ty < geo.y + geo.h - 1) {
        return walkTo([[geo.door.x, geo.door.y + 1]], 'u');
      }
    }
    if (roomKind === 'kettle') {
      const st = stones.find((q) => q.x === tx && (q.y === ty || q.y === ty + 1));
      if (st) {
        const spots = around(st.x, st.y, 1, 1);
        return walkTo(spots.map(([x, y]) => [x, y]), (self) => (spots.find(([x, y]) => x === self.x && y === self.y) || [])[2], `stone:${st.x},${st.y}`);
      }
    }
    const p = propAt(tx, ty);
    const door = p && roomKind === 'kettle' && (kettle.doors || []).find((d) => d.y === p.f[1] + p.f[3] && d.x >= p.f[0] && d.x < p.f[0] + p.f[2]);
    if (door) return walkTo([[door.x, door.y]], 'u', `place:${door.place}`);
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
    'kc-store', 'kc-apothecary', 'kc-clinic', 'kc-daycare', 'kc-cemetery-gate', 'kc-town-sign',
    'kc-headstone-1', 'kc-headstone-2', 'kc-headstone-3', 'kc-headstone-4',
    'fence-post', 'fence-post-short', 'fence-rails', 'fence-rail-v', 'gate-leaf', 'prop-stump',
    'front-mochi', 'front-bolt', 'front-zee', 'front-ember', 'back-mochi', 'back-bolt', 'back-zee', 'back-ember',
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
  const OUTLINE = '#2b1a12';
  // Name tags and bubbles on the map use the same type as the chips around it.
  const UI_FONT = (px) => `${px}px ui-monospace, "Cascadia Mono", Consolas, monospace`;

  // Draws a sprite scaled to a width in tiles, its bottom edge at b. Returns the top edge in pixels.
  function sprite(name, x, b, w, flip) {
    const im = ART[name];
    const dw = w * TILE, dh = dw * im.naturalHeight / im.naturalWidth;
    const px = x * TILE, py = b * TILE - dh;
    const sway = !reduceMotion && world && (name === 'prop-tree' || name === 'prop-bush') ? Math.sin(world.clock() / 1300 + x * 2) * .009 : 0;
    if (sway) { ctx.save(); ctx.translate(px + dw / 2, b * TILE); ctx.rotate(sway); ctx.translate(-px - dw / 2, -b * TILE); }
    if (flip) {
      ctx.save(); ctx.translate(px + dw, py); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, dw, dh); ctx.restore();
    } else ctx.drawImage(im, px, py, dw, dh);
    if (sway) ctx.restore();
    return py;
  }
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; };

  // ---------- ground, drawn once per map into its own canvas ----------
  function buildGround() {
    const r = rows();
    const c = document.createElement('canvas');
    c.width = r[0].length * TILE * GROUND;
    c.height = r.length * TILE * GROUND;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const T = TILE * GROUND;
    if (roomKind === 'house') {
      g.fillStyle = '#3b2414';
      g.fillRect(0, 0, c.width, c.height);
      if (has('house-interior')) {
        const a = house.art || { x: 0, y: 0, w: 10, h: 8 };
        g.drawImage(ART['house-interior'], a.x * T, a.y * T, a.w * T, a.h * T);
      } else {
        g.setTransform(GROUND, 0, 0, GROUND, 0, 0);
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
    const grass = texture('tile-grass', '#829267', 0.66);
    const path = texture('tile-path', '#b5aa8c', 0.52, 2 / 3);
    const water = texture('tile-water');
    if (!grass || !path || !water) {
      g.setTransform(GROUND, 0, 0, GROUND, 0, 0);
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
      const fill = ch === 'W' ? water : ch === 'G' ? tall : ch === 'C' ? flowers : ch === 'R' ? rocky : ch === 'A' ? heath : null;
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
    // Benches and the bus stop sit on a packed dirt pad instead of bare grass.
    const pads = r.map((row) => [...row]);
    for (const p of mapNow()?.props || []) {
      if (!['prop-bench', 'prop-bus-stop'].includes(p.s) || !p.f) continue;
      for (let y = p.f[1]; y < p.f[1] + p.f[3]; y++) for (let x = p.f[0]; x < p.f[0] + p.f[2]; x++) if (pads[y]) pads[y][x] = 'P';
    }
    paintPaths(g, pads.map((row) => row.join('')), T);
    paintMeadow(g, mapNow(), T);
    // A mossy water bank, kept below the residents and the animated ripples.
    r.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== 'W') return;
      g.fillStyle = '#617c59';
      if (at(x, y - 1) !== 'W') g.fillRect(x * T, y * T, T, 6);
      if (at(x, y + 1) !== 'W') g.fillRect(x * T, y * T + T - 4, T, 4);
      if (at(x - 1, y) !== 'W') g.fillRect(x * T, y * T, 5, T);
      if (at(x + 1, y) !== 'W') g.fillRect(x * T + T - 5, y * T, 5, T);
    }));
    // Flower patches: small clusters of real flowers, walkable like grass. A flower tile that bridges a lane
    // is painted as lane.
    const lane = (x, y) => 'PE'.includes(at(x, y));
    r.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== 'F' || (lane(x - 1, y) && lane(x + 1, y)) || (lane(x, y - 1) && lane(x, y + 1))) return;
      const kind = hash(x, y) % 5;
      for (let i = 0; i < 4; i++) {
        const h = hash(x * 4 + i, y);
        paintFlower(g, x * T + 10 + (h % 40), y * T + 8 + ((h >>> 8) % 38), kind + (i === 3 ? 1 : 0), 4);
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
    const m = new DOMMatrix().scale(1 / GROUND).translate(off, off * 0.4);
    waterPattern.setTransform(m);
    ctx.fillStyle = waterPattern;
    const at = (x, y) => (r[y] && r[y][x]) || 'T';
    for (let y = Math.max(0, y0); y <= Math.min(r.length - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(r[0].length - 1, x1); x++) {
        if (r[y][x] !== 'W') continue;
        // Keep the drawn bank: inset the redraw on any side that touches land.
        const l = at(x - 1, y) !== 'W' ? 5 / GROUND : 0, t = at(x, y - 1) !== 'W' ? 6 / GROUND : 0;
        const rr = at(x + 1, y) !== 'W' ? 5 / GROUND : 0, b = at(x, y + 1) !== 'W' ? 4 / GROUND : 0;
        ctx.fillRect(x * TILE + l, y * TILE + t, TILE - l - rr, TILE - t - b);
      }
    }
  }
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let sceneryOff = false, reduceMotion = motionQuery.matches;
  function motionLine() { reduceMotion = motionQuery.matches || sceneryOff; $('motionBtn').textContent = `Scenery motion: ${reduceMotion ? 'off' : 'on'}`; $('motionBtn').setAttribute('aria-pressed', String(reduceMotion)); }
  motionQuery.addEventListener('change', motionLine);
  $('motionBtn').addEventListener('click', () => { sceneryOff = !sceneryOff; motionLine(); }); motionLine();

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

  // ---------- fences and gates ----------
  // A fence is a list of tiles. Each tile gets a post, with rails to every fence neighbour, so a run turns its
  // corners and a north south side reads as a fence seen from above instead of a stack of sideways sections.
  // Art pixels are half a map pixel (the kit is cut at 64 pixels a tile).
  function fenceSet(map) {
    if (!map._fences) map._fences = new Set((map.fences || []).map(([x, y]) => `${x},${y}`));
    return map._fences;
  }
  function fenceThings(map, x0, y0, x1, y1, list) {
    const F = fenceSet(map);
    if (!F.size || !has('fence-post')) return;
    const at = (x, y) => F.has(`${x},${y}`);
    for (const [x, y] of map.fences) {
      if (x < x0 - 1 || x > x1 + 1 || y < y0 - 1 || y > y1 + 2) continue;
      const cx = (x + 0.5) * TILE, foot = (y + 1) * TILE - 1;
      const east = at(x + 1, y), west = at(x - 1, y), north = at(x, y - 1), south = at(x, y + 1);
      const side = !east && !west && (north || south); // a plain north south run gets the short post
      const top = (yy) => (yy + 1) * TILE - 1 - (!at(x + 1, yy) && !at(x - 1, yy) && (at(x, yy - 1) || at(x, yy + 1)) ? 18 : 31.5);
      list.push({ b: y + 1 - 0.002, draw: () => {
        // The rail from the post to the north arrives end on, in front of that post and behind this one.
        if (north && has('fence-rail-v')) { const t0 = top(y - 1) + 4, t1 = top(y) + 6; ctx.drawImage(ART['fence-rail-v'], cx - 3, t0, 6, t1 - t0); }
        if (side && has('fence-post-short')) ctx.drawImage(ART['fence-post-short'], cx - 5, foot - 18, 10, 18);
        else ctx.drawImage(ART['fence-post'], cx - 5, foot - 31.5, 10, 31.5);
      } });
      // Rails cross in front of the posts, the way the original fence art is painted.
      if (east && has('fence-rails')) list.push({ b: y + 1 - 0.001, draw: () => ctx.drawImage(ART['fence-rails'], cx + 3, foot - 31.5 + 5, TILE - 6, 23) });
    }
    for (const gt of map.gates || []) {
      if (gt.x > x1 + 2 || gt.x + gt.w < x0 - 2 || gt.y < y0 - 1 || gt.y > y1 + 2) continue;
      list.push({ b: gt.y + 1 - 0.0005, draw: () => drawGate(gt) });
    }
  }
  // Gate leaves hang from the posts either side of the opening and swing in, away from the lane, whenever
  // a trainer or a resident walks up. They are scenery: the gate tiles are always walkable.
  function gateTick(dt) {
    const map = roomKind === 'house' ? null : mapNow();
    for (const gt of map?.gates || []) {
      const mid = gt.x + gt.w / 2, near = (q) => Math.abs(q.dx + 0.5 - mid) <= gt.w / 2 + 1.1 && Math.abs(q.dy - gt.y) <= 1.6;
      const want = [...players.values()].some(near) || (world?.active() || []).some(near) ? 1 : 0;
      gt.open = gt.open ?? want;
      const step = dt / (reduceMotion ? 1 : 260);
      gt.open = want > gt.open ? Math.min(want, gt.open + step) : Math.max(want, gt.open - step * 0.7);
    }
  }
  function drawGate(gt) {
    if (!has('gate-leaf')) return;
    const ease = (t) => t * t * (3 - 2 * t), a = ease(gt.open || 0) * 1.38;
    const left = gt.x * TILE - TILE / 2, right = (gt.x + gt.w) * TILE + TILE / 2, foot = (gt.y + 1) * TILE - 4;
    const leafW = (right - left) / 2 - 3, leafH = 25;
    for (const [hinge, dir] of [[left + 2, 1], [right - 2, -1]]) {
      ctx.save();
      ctx.translate(hinge, foot);
      ctx.transform(dir * Math.cos(a), -Math.sin(a) * 0.5, 0, 1, 0, 0);
      ctx.drawImage(ART['gate-leaf'], 0, -leafH, leafW, leafH);
      ctx.restore();
    }
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
    fenceThings(map, x0, y0, x1, y1, list);
    for (const p of map.props || []) {
      if (p.x > x1 + 1 || p.x + p.w < x0 - 1 || p.b < y0 || p.b - 6 > y1) continue;
      list.push({ b: p.flat ? -0.5 : p.b, draw: () => (has(p.s) ? sprite(p.s, p.x, p.b, p.w) : boxShape(p.x, p.b, p.w, Math.min(2, p.w), '#b5523b')) });
    }
    // Kettle Creek's cemetery hill: one headstone per Checkling lost in your class hour.
    if (roomKind === 'kettle') {
      for (const st of stones) {
        const art = `kc-headstone-${1 + ((st.trainer || '').length + (st.days || 0)) % 4}`;
        list.push({ b: st.y + 1, draw: () => (has(art) ? sprite(art, st.x + 0.1, st.y + 1, 0.8) : boxShape(st.x + 0.2, st.y + 1, 0.6, 0.8, '#9a9a9a')) });
      }
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
      const cell = trainerFrame(p.f, p.stride, moving && !(p.npc&&reduceMotion));
      ctx.save();
      if (cell.flip) { ctx.translate(px + 32, 0); ctx.scale(-1, 1); } else ctx.translate(px, 0);
      ctx.drawImage(ART[look], cell.col * 64, cell.row * 96, 64, 96, 0, py + TILE - 48, 32, 48);
      ctx.restore();
    } else {
      ctx.fillStyle = p.c; ctx.fillRect(px + 8, py + 10, 16, 16);
      ctx.fillStyle = '#f2c9a0'; ctx.fillRect(px + 10, py + 2, 12, 10);
    }
    if(p.npc)world?.drawResident(ctx,p,reduceMotion);
    // Standing in tall grass hides your feet, the Red and Blue way.
    if ((roomKind === 'wilds' || roomKind === 'kettle') && has('tile-tall-grass') && rows()[Math.round(p.dy)]?.[Math.round(p.dx)] === 'G') {
      ctx.drawImage(ART['tile-tall-grass'], 0, 30, 64, 34, px, py + 15, 32, 17);
    }
    const top = py + TILE - 50;
    // In a crowd, name tags show only for you, trainers within a few steps, and anyone talking.
    const self = players.get(me);
    const talking = p.bubble && p.bubbleUntil > now;
    const near = self && Math.abs(p.dx - self.dx) + Math.abs(p.dy - self.dy) <= 4;
    if (p.npc) {
      ctx.fillStyle = '#fff0bd'; ctx.strokeStyle = '#50452e'; ctx.lineWidth = .75;
      ctx.beginPath(); ctx.roundRect(px+11,py-27,10,7,2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff0bd'; ctx.fillRect(px+13,py-21,2,3);
      ctx.fillStyle = '#725c36'; for (let i=0;i<3;i++) ctx.fillRect(px+13+i*2.5,py-24,1,1);
      // Residents always wear a name tag so nobody mistakes them for a classmate; the job shows up close.
      const seen = self && Math.abs(p.dx - self.dx) + Math.abs(p.dy - self.dy) <= 9;
      if (near || p.id === activeResident) labels.push([`${p.name} · ${p.role}`, px + 16, top, '#fff0bd', 2]);
      else if (seen) labels.push([p.name, px + 16, top, '#fff0bd', 3]);
    } else if (p.id === me || near || talking || players.size <= 8) {
      labels.push([p.inb ? `${p.name} (Battling)` : p.busy ? `${p.name} (Busy)` : p.name, px + 16, top, p.id === me ? '#ffd166' : p.busy ? '#9fb59a' : '#f4f1e6', p.id === me ? 0 : 1]);
    }
    if (talking) bubbles.push([p.bubble, px + 16, top - 16]);
  }

  function label(text, cx, y, color) {
    ctx.font = UI_FONT(12);
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
    ctx.font = UI_FONT(13);
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
    world?.tick(dt, mapNow(), players.get(me), reduceMotion, (x,y) => !open(x,y) || [...players.values()].some(p => p.x === x && p.y === y) || world.active().some(n => n.x === x && n.y === y), paused || Boolean(bt) || document.hidden);
    for (const p of players.values()) if (p.id !== me) remoteTick(p, dt);
    gateTick(dt);
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    // The art is stored at two pixels a map pixel. Reducing it needs smoothing to stay even; at full size or
    // larger, nearest pixels keep every edge sharp.
    ctx.imageSmoothingEnabled = SCALE < 1.99;
    ctx.imageSmoothingQuality = 'high';
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
      const gw = Math.min(ground.width / GROUND - gx, vw - (gx - cx)), gh = Math.min(ground.height / GROUND - gy, vh - (gy - cy));
      if (gw > 0 && gh > 0) ctx.drawImage(ground, gx * GROUND, gy * GROUND, gw * GROUND, gh * GROUND, gx, gy, gw, gh);
      if (roomKind !== 'house') shimmer(world?.clock() ?? now, Math.floor(cx / TILE), Math.floor(cy / TILE), Math.ceil((cx + vw) / TILE), Math.ceil((cy + vh) / TILE));
      const x0 = Math.floor(cx / TILE), y0 = Math.floor(cy / TILE);
      const x1 = Math.ceil((cx + vw) / TILE), y1 = Math.ceil((cy + vh) / TILE);
      const things = [];
      if (roomKind !== 'house') townThings(x0, y0, x1, y1, things);
      {
        world?.draw(ctx, mapNow(), [x0,y0,x1,y1], reduceMotion);
        for (const n of world?.active() || []) {
          if (n.dx < x0 - 1 || n.dx > x1 + 1 || n.dy < y0 - 1 || n.dy > y1 + 2) continue;
          things.push({b: n.dy + 1, draw: () => {
            const phase = Math.floor(world.clock() / 6500) + n.look * 3;
            const nearby = residentDistance(n) < 5;
            const chatting = !reduceMotion && !paused && !bt && !conversing() && nearby && Math.floor(world.clock() / 1000) % 13 < 3;
            trainer({...n, bubble: chatting ? (n.activity?(n.activity.action==='walk'?'On my way.':n.activity.label.slice(0,36)):n.chatter[phase % n.chatter.length]) : '', bubbleUntil: now + 1}, now);
          }});
        }
      }
      for (const p of players.values()) things.push({ b: p.dy + 1, draw: () => trainer(p, now) });
      things.sort((a, b) => a.b - b.b);
      labels.length = 0; bubbles.length = 0;
      for (const t of things) t.draw();
      // Name tags never sit on top of each other: a tag that would overlap one already placed moves up a row.
      ctx.font = UI_FONT(12);
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
      ctx.font = UI_FONT(13);
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
    const nr = !paused && !bt && !conversing() && nearestResident();
    $('talkBtn').hidden = !nr; if (nr) $('talkBtn').textContent = `Talk to ${nr.name} (Space)`;
    if (world?.discoveries.length && !paused && !bt && !conversing() && askEl.hidden) {
      const discovery = world.discoveries.shift(); $('worldCue').textContent = discovery.text; $('worldCue').hidden = false;
      clearTimeout(cueTimer); cueTimer = setTimeout(() => { $('worldCue').hidden = true; }, 7000);
    }
    if (lastNear && performance.now() > lastNear.until) { lastNear = null; watchLine(); }
    if (bt) clockTick();
    requestAnimationFrame(frame);
  }



  // ---------- floating buttons and their pop-ups ----------
  const pops = { partnerBtn: 'partnerPop', careBtn: 'carePop', sayBtn: 'phrases', menuBtn: 'menu' };
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
      if (btn === 'careBtn' && opening) askBody(partner || (team.find((x) => !x.den) || {}).v);
    });
    $(pop).addEventListener('click', (e) => e.stopPropagation());
  }
  // A tap on the map or anywhere else closes whatever is open.
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.pop, .hud')) { closePops(); closeRanks(); closeCards(true); } });
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
    kettle: 'This is Kettle Creek, your home town. Your house, the clinic and Route 1 are here. The bus stop takes you to the Checkaverse to battle classmates.',
    care: 'Tap Care to feed, groom, play with and nap your Checkling. Too much or too little of anything has a cost.',
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
  // ---------- care ----------
  // The Care panel shows one Checkling's body. The town decides every number; this only draws it and sends taps.
  let egg = null, careView = null;
  const careBtn = $('careBtn');
  function careLine() {
    careBtn.hidden = !saved || !team.some((x) => !x.den);
    const worst = ['sick', 'needs care', 'hungry'].find((f) => team.some((x) => !x.den && x.flag === f));
    $('careFlag').hidden = !worst;
    $('careFlag').textContent = worst || '';
  }
  function askBody(v) { if (v) send({ t: 'body', id: v }); }
  const BARS = [['fullness', 'Full'], ['hygiene', 'Clean'], ['mood', 'Mood'], ['health', 'Health']];
  const weightWord = (w) => (w >= 80 ? 'Obese' : w >= 68 ? 'Chubby' : w <= 20 ? 'Scrawny' : w <= 32 ? 'Thin' : 'Healthy');
  function showBody(m) {
    if (!m.saved || m.gone) { closePops(); return; }
    careView = m;
    $('careMsg').textContent = '';
    renderCare();
    if ($('carePop').hidden) { closePops('careBtn'); $('carePop').hidden = false; careBtn.setAttribute('aria-expanded', 'true'); }
  }
  function renderCare() {
    const m = careView, b = m.body;
    $('careImg').src = `/art/front-${m.species}.png`;
    $('careName').textContent = m.name;
    $('careSub').textContent = `Level ${m.level}${m.den ? ' · resting in the Den, so its body clock is paused' : ''}`;
    const sw = $('careSwitch');
    sw.textContent = '';
    for (const c of team) {
      const t = document.createElement('button');
      t.type = 'button'; t.setAttribute('role', 'tab'); t.setAttribute('aria-selected', String(c.v === m.id));
      t.textContent = shortName(c) + (c.den ? ' (Den)' : '');
      t.addEventListener('click', () => askBody(c.v));
      sw.appendChild(t);
    }
    sw.hidden = team.length < 2;
    const bars = $('careBars');
    bars.textContent = '';
    for (const [k, label] of BARS) {
      const v = b.stats[k];
      const name = document.createElement('span'); name.textContent = label;
      const bar = document.createElement('span'); bar.className = `care-bar${v <= 25 ? ' low' : v <= 45 ? ' mid' : ''}`;
      const fill = document.createElement('i'); fill.style.width = `${v}%`; bar.appendChild(fill);
      bar.setAttribute('role', 'meter'); bar.setAttribute('aria-label', label); bar.setAttribute('aria-valuenow', String(v)); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '100');
      const num = document.createElement('span'); num.textContent = String(v);
      bars.append(name, bar, num);
    }
    const wn = document.createElement('span'); wn.textContent = 'Build';
    const wb = document.createElement('span'); wb.className = 'care-weight';
    const mark = document.createElement('i'); mark.style.left = `${b.stats.weight}%`; wb.appendChild(mark);
    wb.setAttribute('role', 'meter'); wb.setAttribute('aria-label', `Build: ${weightWord(b.stats.weight)}`); wb.setAttribute('aria-valuenow', String(b.stats.weight));
    const ww = document.createElement('span'); ww.textContent = weightWord(b.stats.weight);
    ww.style.fontSize = '12px';
    bars.append(wn, wb, ww);
    const tags = $('careTags');
    tags.textContent = '';
    if (b.disease) {
      const d = document.createElement('div'); d.className = 'care-tag sick';
      const h = document.createElement('b'); h.textContent = `Sick: ${b.disease.name}`;
      d.append(h, `Give medicine once a day. ${b.disease.dosesLeft} more ${b.disease.dosesLeft === 1 ? 'dose' : 'doses'} to cure it.${b.disease.dosedToday ? ' Today\'s dose is done.' : ''} ${b.disease.warn || 'Left untreated it gets worse every school day and can kill.'}`);
      tags.appendChild(d);
    }
    for (const c of b.conditions) {
      const d = document.createElement('div'); d.className = 'care-tag';
      const h = document.createElement('b'); h.textContent = c.name;
      d.append(h, c.tip);
      tags.appendChild(d);
    }
    const nap = document.createElement('div'); nap.className = 'care-tag';
    nap.textContent = b.sinceNap === 0 ? 'Napped today.' : b.sinceNap === 1 ? 'Last nap: 1 school day ago.' : `Last nap: ${b.sinceNap} school days ago.${b.sinceNap >= 3 ? ' A nap soon keeps it from getting exhausted.' : ''}`;
    if (b.sinceNap >= 3) tags.appendChild(nap);
    const acts = $('careActions');
    acts.textContent = '';
    for (const a of b.actions) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'ghost'; btn.disabled = a.left <= 0 || m.den;
      btn.append(a.label);
      const small = document.createElement('small'); small.textContent = a.left > 0 ? `${a.left} left today` : 'done for today';
      btn.appendChild(small);
      btn.addEventListener('click', () => send({ t: 'care', id: m.id, a: a.id }));
      acts.appendChild(btn);
    }
    for (const x of b.rare || []) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'ghost risky'; btn.disabled = m.den;
      btn.append(`${x.label} (${x.count})`);
      const small = document.createElement('small'); small.textContent = 'Some things in the wilds should never be eaten.';
      btn.appendChild(small);
      btn.addEventListener('click', () => send({ t: 'care', id: m.id, a: x.id }));
      acts.appendChild(btn);
    }
  }
  const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  function stoneEl(st) {
    const el = document.createElement('div'); el.className = `stone${st.mine ? ' mine' : ''}`;
    const im = document.createElement('img'); im.alt = 'Headstone';
    im.src = `/art/kc-headstone-${1 + ((st.trainer || '').length + (st.days || 0)) % 4}.png`;
    const txt = document.createElement('div');
    const who = document.createElement('div'); who.className = 'who'; who.textContent = st.title;
    const line = document.createElement('div'); line.className = 'line'; line.textContent = st.epitaph;
    const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = st.meta;
    txt.append(who, line, meta);
    el.append(im, txt);
    return el;
  }
  function eggNote(e) {
    if (!e) return '';
    if (e.owed) return 'A new egg comes at your next check-in.';
    if (e.ready) return 'Your egg is ready to hatch!';
    return `A new egg is waiting. It hatches after ${e.left} more check-in${e.left === 1 ? '' : 's'}.`;
  }
  function showReport(m) {
    const box = $('reportBody');
    box.textContent = '';
    for (const d of m.deaths || []) {
      box.appendChild(stoneEl({ title: `${d.name} died of ${d.cause.toLowerCase()}.`, epitaph: d.epitaph, meta: 'Its headstone is in your class cemetery.', days: 1, trainer: d.name }));
    }
    for (const r of m.reports || []) {
      const it = document.createElement('div'); it.className = 'report-item';
      const im = document.createElement('img'); im.alt = ''; im.src = `/art/front-${r.species}.png`;
      const txt = document.createElement('div');
      const h = document.createElement('b'); h.textContent = r.name;
      const ul = document.createElement('ul');
      for (const l of r.lines) { const li = document.createElement('li'); li.className = l.k; li.textContent = capital(l.text) + '.'; ul.appendChild(li); }
      txt.append(h, ul);
      it.append(im, txt);
      box.appendChild(it);
    }
    if ((m.deaths || []).length) { const p = document.createElement('p'); p.className = 'pop-note'; p.textContent = eggNote(m.egg); box.appendChild(p); }
    $('reportTitle').textContent = (m.deaths || []).length ? 'Bad news' : 'While you were gone';
    closePops();
    $('reportPop').hidden = false;
    $('reportClose').focus();
  }
  function showDeath(m) {
    showReport({ deaths: [{ name: m.name, cause: m.cause, epitaph: m.epitaph }], reports: [], egg: m.egg });
    $('reportTitle').textContent = m.msg || 'Bad news';
  }
  function showCemetery(m) {
    const box = $('stones');
    box.textContent = '';
    $('cemeteryTitle').textContent = m.saved ? `Class cemetery · ${m.hour}` : 'Class cemetery';
    for (const st of m.stones) {
      box.appendChild(stoneEl({ ...st, title: `${st.trainer}'s ${st.speciesName}${st.mine ? ' (yours)' : ''}`,
        meta: `Level ${st.level} · lived ${st.days} day${st.days === 1 ? '' : 's'} · ${st.cause} · ${st.died}` }));
    }
    $('cemeteryNote').textContent = !m.saved ? 'Visitors do not have a class. Ride the bus from Check-In to see your class cemetery.'
      : m.stones.length ? 'Every Checkling lost in your class hour rests here.' : 'Nobody in your class has lost a Checkling yet. Keep it that way.';
    closePops();
    $('cemeteryPop').hidden = false;
    $('cemeteryClose').focus();
  }
  function openHatch() {
    if (!$('hatchPop').hidden || !$('reportPop').hidden) return;
    const box = $('hatchPick');
    box.textContent = '';
    for (const sp of ['mochi', 'bolt', 'zee', 'ember']) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost';
      const im = document.createElement('img'); im.alt = ''; im.src = `/art/front-${sp}.png`;
      b.append(im, capital(sp));
      b.addEventListener('click', () => { send({ t: 'hatch', species: sp }); $('hatchPop').hidden = true; });
      box.appendChild(b);
    }
    closePops();
    $('hatchPop').hidden = false;
  }
  function closeCards(soft) {
    $('reportPop').hidden = true; $('cemeteryPop').hidden = true;
    if (!soft) $('hatchPop').hidden = true;
    if (saved && egg && egg.ready && !soft) setTimeout(openHatch, 300);
  }
  $('reportClose').addEventListener('click', () => { closeCards(); if (saved && egg && egg.ready) openHatch(); });
  $('cemeteryClose').addEventListener('click', () => closeCards());
  $('cemeteryBtn').addEventListener('click', () => { closePops(); send({ t: 'cemetery' }); });
  for (const id of ['reportPop', 'cemeteryPop', 'hatchPop']) $(id).addEventListener('pointerdown', (e) => e.stopPropagation());

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
    if (now) { $('partnerImg').hidden = false; $('partnerImg').src = `/art/front-${now.species}.png`; $('partnerName').textContent = shortName(now); }
    else if (saved) { $('partnerImg').hidden = true; $('partnerName').textContent = egg && egg.left ? `Egg: ${egg.left} more check-in${egg.left === 1 ? '' : 's'}` : egg ? 'Egg' : 'No partner'; }
    careLine();
    if (saved && egg && egg.ready) openHatch();
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
    closeConversation(); worldJournal.close();
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
  const wait = (ms) => new Promise((r) => setTimeout(r, motionQuery.matches ? Math.min(ms, 350) : ms));
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
  if (/[?&]debug\b/.test(location.search)) window.__checkaverse = { players, me: () => me, battle: () => bt, room: () => room, walk: (x, y) => walkTo([[x, y]]), world: () => world, camera: () => ({...cam, width:VIEW_W,height:VIEW_H}), talk: talkTo,visit:visitResident,navigating:()=>residentNav };
  connect();
  requestAnimationFrame(frame);
})();
