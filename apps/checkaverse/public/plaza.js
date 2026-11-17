(() => {
  'use strict';
  const TILE = 32;
  const canvas = document.getElementById('town');
  const ctx = canvas.getContext('2d');
  const { createWorld, trainerFrame, paintPaths, paintMeadow, paintFlower } = window.CheckaverseWorld;
  const { generateFen, FEN_SOLID } = window.CheckaverseFen;
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
  // Ghosts on Kettle Creek's cemetery hill: frost on stones with a hidden ghost, and the ghosts while Spirit Sight lasts.
  let ghostView = { frost: [], ghosts: [], sightUntil: 0 }, graveMoss = 0, sightShown = -1;
  // Residents battling each other nearby, drawn on the map. id -> { room, sides, shots, flashes, ended, winner, until }.
  const spars = new Map();
  // The sky follows Mt. Morris (weather), and the teacher's reward events show in the status chip.
  let sky = { kind: 'clear', label: '', tempF: null }, skyShown = '', events = [], eventsAt = 0;
  const drops = [];
  const sparHere = (s) => s.room === room || (s.room === 'kettle' && roomKind === 'kettle');
  const sightMs = () => Math.max(0, ghostView.sightUntil - performance.now());
  // The outdoor map you are on right now: the town, the wilds or your own Kettle Creek. Houses use the house map.
  const mapNow = () => (roomKind === 'house' ? house : roomKind === 'wilds' ? wilds : roomKind === 'kettle' ? kettle : roomKind === 'fen' ? fenMap() : town);
  // Bramblefen Basin is built here from the town's settings, the same way the town builds it, then checked against
  // the town's hash. It is built once, a little after a trainer reaches the wilds, so walking in never stalls.
  let fen = null, fenCfg = null, fenWant = '', fenMs = 0;
  function fenMap() {
    if (!fen && fenCfg) {
      const t0 = performance.now();
      fen = generateFen(fenCfg);
      fenMs = Math.round(performance.now() - t0);
      if (fen.hash !== fenWant) console.warn(`Bramblefen Basin did not match the town (${fen.hash} here, ${fenWant} there).`);
    }
    return fen;
  }
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
    const sk = sky.label ? ` · ${sky.label}${sky.tempF !== null ? ` ${sky.tempF}°F` : ''}` : '';
    const ev = events.filter((e) => e.left - (performance.now() - eventsAt) > 0).map((e) => ` · ${e.label}!`).join('');
    setStatus(`Live · ${n} trainer${n === 1 ? '' : 's'} ${where}${sk}${ev}`);
  }
  let zoneName = '';
  function placeLine() {
    // The title names the world you are in: your own Kettle Creek, or the shared Checkaverse the bus goes to.
    const home = roomKind === 'kettle' || (roomKind === 'house' && roomOwner?.map === 'kettle');
    $('placeTitle').textContent = home ? 'Kettle Creek' : 'Checkaverse';
    placeEl.hidden = roomKind === 'kettle' && !sightMs();
    if (roomKind === 'town') placeEl.textContent = 'Town';
    else if (roomKind === 'kettle') placeEl.textContent = sightMs() ? `Spirit Sight · ${Math.ceil(sightMs() / 60000)} min` : '';
    else if (roomKind === 'wilds') placeEl.textContent = zoneName ? `The wilds · ${zoneName}` : 'The wilds';
    else if (roomKind === 'fen') placeEl.textContent = zoneName ? `${fenCfg?.name || 'Bramblefen Basin'} · ${zoneName}` : fenCfg?.name || 'Bramblefen Basin';
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
        me = m.you; town = m.town; house = m.house; wilds = m.wilds; kettle = m.kettle || null;
        if (m.fen && m.fen.hash !== fenWant) { fen = null; fenPicture = null; fenCfg = m.fen.config; fenWant = m.fen.hash; chunks.clear(); } stones = m.stones || []; phrases = m.phrases; myPlot = m.myPlot;
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
        leaveLine();
        leavingRide = false;
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
        else ghostView = { frost: [], ghosts: [], sightUntil: 0 };
        spars.clear();
        busLine();
        stopWalk();
        setPlayers(m.players);
        hideAsk();
        countLine(); placeLine(); homeLine();
        snapCamera();
        if(residentNav)setTimeout(()=>requestResidentPath(),260);
        zoneName = ''; placeLine(); charmLine();
        if (roomKind === 'house') toast(roomOwner?.resident?`${roomOwner.name}'s home. ${roomOwner.description}`:roomOwner && roomOwner.owner === me ? 'Welcome home.' : `You stepped into ${roomOwner?.name || 'a trainer'}'s house. Look, but do not touch.`);
        if (roomKind === 'wilds') { toast('You walked out into the wilds.'); tipSoon('wilds', 900); if (!fen) setTimeout(fenMap, 700); }
        if (roomKind === 'fen') { toast(`You stepped into ${fenCfg?.name || 'Bramblefen Basin'}.`); tipSoon('fen', 900); }
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
      case 'team': { const more = (m.team || []).length > team.length; team = m.team || []; saved = Boolean(m.saved); partner = m.partner ?? partner; egg = m.egg || null; charms = m.charms ?? charms; buildPartners(); charmLine(); leaveLine(); if (more) tipSoon(saved ? 'caught' : 'caught-visit', 4000); break; }
      case 'elsewhere': elsewhere = true; break;
      case 'ranks': showRanks(m); break;
      case 'body': showBody(m); break;
      case 'cared': $('careMsg').textContent = m.msg; if (m.body && careView) { careView.body = m.body; renderCare(); } break;
      case 'report': showReport(m); break;
      case 'death': showDeath(m); break;
      case 'cemetery': showCemetery(m); break;
      case 'ghosts':
        ghostView = { frost: m.frost || [], ghosts: m.ghosts || [], sightUntil: performance.now() + (m.sight || 0) };
        graveMoss = m.moss ?? graveMoss; placeLine();
        if (ghostView.ghosts.length) tipSoon('ghost-seen', 600);
        else if (ghostView.frost.length) tipSoon('frost', 4000);
        break;
      case 'moss': graveMoss = m.moss; tipSoon('moss', 1500); break;
      case 'apothecary': showApothecary(m); break;
      case 'learn_offer': showLearn(m); break;
      case 'gazette': showPaper(m); break;
      case 'mail': showMailLine(m); break;
      case 'gym': showGym(m); break;
      case 'gym_round': startGame(m); break;
      case 'gym_result': gameResult(m); break;
      case 'weather': {
        sky = { kind: m.kind, label: m.label, tempF: m.tempF };
        if (skyShown !== m.kind && m.kind !== 'clear' && m.kind !== 'cloudy') toast(m.line);
        skyShown = m.kind; countLine();
        break;
      }
      case 'events': events = m.events || []; eventsAt = performance.now(); countLine(); break;
      case 'npc_battle': {
        const now = performance.now(), old = spars.get(m.id) || { shots: [], flashes: [] };
        const shots = old.shots.concat((m.moves || []).map((mv) => ({ from: mv.side, type: mv.type, t: now }))).filter((x) => now - x.t < 1200);
        const flashes = old.flashes.concat((m.hits || []).map((side) => ({ side, t: now + 380 }))).filter((x) => now - x.t < 1200);
        spars.set(m.id, { room: m.room, sides: m.sides, shots, flashes, fades: m.fades || [], ended: false, winner: null, until: 0 });
        break;
      }
      case 'npc_battle_end': {
        const sp = spars.get(m.id);
        if (sp) Object.assign(sp, { sides: m.sides, ended: true, winner: m.winner, until: performance.now() + 2600 });
        if (lastNear && lastNear.id === m.id) { lastNear = null; watchLine(); }
        break;
      }
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
  // A shared Chromebook keeps the bus ticket in this tab. Leave drops it, closes this ride, and comes back as a visitor.
  // A reload before Leave still has the ticket, so a refresh in class does not kick anyone out.
  const leaveBtn = $('leaveBtn');
  function leaveLine() { leaveBtn.hidden = !saved; }
  leaveBtn.addEventListener('click', () => {
    if (!saved) return;
    if (!confirm('Leave this Chromebook? The next person on this screen will not be you. Your Checklings stay saved under your trainer name.')) return;
    leaveRide('You left this Chromebook. This screen is a visitor until someone rides the bus from Check-In.');
  });
  // 20 quiet minutes, the same as the lesson hubs. Walking, tapping, and battle input reset it.
  // An open menu or a battle turn that is still on the clock counts as activity, so a pick in progress is not cut off.
  const IDLE_MS = (() => {
    const hook = window.__checkaverseIdleTest;
    const n = hook && Number(hook.idleMs);
    return n > 0 ? n : 20 * 60 * 1000;
  })();
  let lastActivity = Date.now();
  let leavingRide = false;
  function noteActivity() { lastActivity = Date.now(); }
  function turnClockRunning() { return Boolean(bt && !bt.done); }
  function idleCheck() {
    if (!saved || leavingRide) return;
    const menuOpen = $('menu') && !$('menu').hidden;
    if (menuOpen || turnClockRunning()) { noteActivity(); return; }
    if (Date.now() - lastActivity < IDLE_MS) return;
    leaveRide('You were signed out after 20 quiet minutes. Your Checklings are saved. Ride the bus from Check-In to come back.');
  }
  function leaveRide(message) {
    if (leavingRide || !saved) return;
    leavingRide = true;
    ticket = null;
    try { sessionStorage.removeItem('checkaverse-ticket'); } catch { /* storage can be off on school machines */ }
    try { history.replaceState(null, '', location.pathname + location.search); } catch { /* fine */ }
    toast(message);
    reconnectFresh();
  }
  window.addEventListener('pointerdown', noteActivity);
  window.addEventListener('keydown', noteActivity);
  // Check-In opens this same tab with a new #t= when the next student rides the bus. A hash change does not
  // reload the page, so the new ticket has to be picked up here or that student would stay a visitor.
  function ticketInHash() {
    const m = /[#&]t=([A-Za-z0-9_.-]{20,2000})/.exec(location.hash);
    return m ? m[1] : '';
  }
  function reconnectFresh() {
    clearTimeout(reconnectTimer);
    const old = ws;
    ws = null;
    if (old) {
      old.onclose = null;
      old.onmessage = null;
      old.onerror = null;
      try { old.close(1000); } catch { /* already gone */ }
    }
    connect();
  }
  window.addEventListener('hashchange', () => {
    const next = ticketInHash();
    if (!next || next === ticket) return;
    ticket = next;
    try { sessionStorage.setItem('checkaverse-ticket', ticket); } catch { /* storage can be off on school machines */ }
    try { history.replaceState(null, '', location.pathname + location.search); } catch { /* fine */ }
    reconnectFresh();
  });
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
    // The gym's mini games take the keyboard while they are open; only Escape leaves.
    if (!$('gameOverlay').hidden) { if (e.code === 'Escape') quitGame(); return; }
    if (!$('fenMapPop').hidden && (e.code === 'Escape' || e.code === 'KeyM')) { $('fenMapPop').hidden = true; return; }
    if (!$('learnPop').hidden || !$('gymPop').hidden || !$('paperPop').hidden || !$('mailPop').hidden) { if (e.code === 'Escape') { for (const id of ['learnPop', 'gymPop', 'paperPop', 'mailPop']) $(id).hidden = true; } return; }
    // The Busy checkbox is an input too, but clicking it must not leave the arrow keys dead until the student clicks the map.
    if (e.target instanceof HTMLInputElement && e.target.type !== 'checkbox' || (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) && e.code === 'Space') return;
    if (!askEl.hidden) { if (e.code === 'Escape') { e.preventDefault(); answer(false); } return; }
    if (bt) { battleKey(e); return; }
    if (e.code === 'Escape') { closePops(); closeRanks(); closeCards(); $('busPop').hidden = true; if (tipNow) { clearTimeout(tipTimer); hideTip(); } return; }
    const d = KEYS[e.code];
    if (d) { e.preventDefault(); cancelResidentNav(); stopWalk(); if (!e.repeat) { const s0 = players.get(me); if (s0) s0.bumped = ''; } press(d); return; }
    if (e.code === 'KeyC' && !e.repeat) challenge();
    if (e.code === 'KeyM' && !e.repeat && roomKind === 'fen') showFenMap();
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
    if ((roomKind === 'fen' ? FEN_SOLID : TOWN_SOLID).has(r[y][x])) return false;
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
    if (key === 'arena') { if (saved) return send({ t: 'gym' }); }
    if (key.startsWith('place:')) return openPlace(key.slice(6));
    if (key.startsWith('stone:')) { const [x, y] = key.slice(6).split(',').map(Number); const st = stones.find((q) => q.x === x && q.y === y); if (st) lookStone(st); return; }
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
    if (place === 'apothecary' && saved) return send({ t: 'apothecary' });
    if (line) toast(line);
  }
  // A headstone: the town answers with its epitaph, a clue when a ghost is hiding nearby, and any grave moss.
  function lookStone(st) {
    if (!saved) return toast(`${st.trainer}'s ${st.speciesName}. ${st.epitaph}`);
    send({ t: 'stone', x: st.x, y: st.y });
  }
  function showApothecary(m) {
    if (m.sight > 0) return toast(`Your partner can already see ghosts for ${Math.ceil(m.sight / 60000)} more minutes. Head up the cemetery hill.`);
    if (m.moss < m.need) return toast(`The apothecary can brew Spirit Sight from ${m.need} grave moss, and you have ${m.moss}. Look at the headstones on the cemetery hill to scrape some off.`);
    confirmPop('Brew Spirit Sight?', `It takes ${m.need} grave moss, and you have ${m.moss}. Your partner drinks it here and can see ghosts on the cemetery hill for ${m.minutes} minutes.`,
      'Brew it', 'Not now', () => send({ t: 'apothecary', brew: true }));
  }
  let busTo = '', confirmYes = null;
  function confirmPop(title, note, yes, no, onYes) {
    confirmYes = onYes;
    $('busTitle').textContent = title;
    $('busNote').textContent = note;
    $('busYes').textContent = yes; $('busNo').textContent = no;
    closePops();
    $('busPop').hidden = false;
    $('busYes').focus();
  }
  function askBus(to) {
    busTo = to;
    confirmYes = () => send({ t: 'bus', to: busTo });
    $('busTitle').textContent = to === 'town' ? 'Ride the bus to the Checkaverse?' : 'Ride the bus home to Kettle Creek?';
    $('busNote').textContent = to === 'town' ? 'Classmates are there to battle, plus the wilds and your house in the Neighborhood.' : 'Your Care panel, the clinic and Route 1 are at home.';
    $('busYes').textContent = "Yes, let's go"; $('busNo').textContent = 'Not yet';
    closePops();
    $('busPop').hidden = false;
    $('busYes').focus();
  }
  $('busYes').addEventListener('click', () => { $('busPop').hidden = true; const go = confirmYes; confirmYes = null; if (go) go(); });
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
      if (st) { lookStone(st); return true; }
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
  // Most art uses the original 64px-per-tile files. These Wave 2 landmarks, houses
  // and Kettle Creek buildings use versioned 32px exports. Keep the original URLs
  // for cached pages and fallback.
  const LANDMARK_ART = {
    arena: 'arena-v2',
    'market-stall': 'market-stall-v2',
    'prop-bus': 'prop-bus-v2',
    'prop-notice-board': 'prop-notice-board-v2',
    'house-cottage': 'house-cottage-v2',
    'house-stump': 'house-stump-v2',
    'house-creek': 'house-creek-v2',
    'kc-store': 'kc-store-v2',
    'kc-apothecary': 'kc-apothecary-v2',
    'kc-clinic': 'kc-clinic-v2',
    'kc-daycare': 'kc-daycare-v2',
  };
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
    const loaded = () => { artWaiting--; ground = null; };
    const original = `/art/${name}.png`;
    im.onload = loaded;
    im.onerror = LANDMARK_ART[name] ? () => {
      im.onerror = loaded;
      im.src = original;
    } : loaded;
    im.src = LANDMARK_ART[name] ? `/art/${LANDMARK_ART[name]}.png` : original;
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
    const sway = !reduceMotion && world && (name === 'prop-tree' || name === 'prop-bush' || name === 'fen-tree' || name === 'fen-tree-rust') ? Math.sin(world.clock() / 1300 + x * 2) * .009 : 0;
    if (sway) { ctx.save(); ctx.translate(px + dw / 2, b * TILE); ctx.rotate(sway); ctx.translate(-px - dw / 2, -b * TILE); }
    if (flip) {
      ctx.save(); ctx.translate(px + dw, py); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, dw, dh); ctx.restore();
    } else ctx.drawImage(im, px, py, dw, dh);
    if (sway) ctx.restore();
    return py;
  }
  // ---------- the Gazette and the mailbox ----------
  let mailBox = { letters: [], unread: 0 }, paperLater = null;
  function showPaper(m) {
    if (bt || !$('gameOverlay').hidden) { paperLater = m; return; }
    paperLater = null;
    const p = m.paper;
    $('paperTitle').textContent = p.masthead;
    const [y, mo, d] = p.day.split('-').map(Number);
    $('paperDate').textContent = new Date(Date.UTC(y, mo - 1, d, 12)).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
      + (p.weather ? ` · ${p.weather.label}${p.weather.tempF !== null ? `, ${p.weather.tempF}°F` : ''} in Mt. Morris` : '');
    const box = $('paperStories'); box.textContent = '';
    for (const st of p.stories) {
      const a = document.createElement('article');
      const h = document.createElement('h3'); h.textContent = st.title;
      const t = document.createElement('p'); t.textContent = st.body;
      a.append(h, t); box.appendChild(a);
    }
    const q = $('paperQuotes'); q.textContent = '';
    q.hidden = !p.quotes.length;
    if (p.quotes.length) {
      const h = document.createElement('h4'); h.textContent = p.aroundTown; q.appendChild(h);
      for (const x of p.quotes) { const line = document.createElement('p'); const who = document.createElement('b'); who.textContent = `${x.who}: `; line.append(who, `"${x.text}"`); q.appendChild(line); }
    }
    closePops();
    $('paperPop').hidden = false;
    $('paperClose').focus();
  }
  function showMailLine(m) {
    const more = m.unread > mailBox.unread;
    mailBox = m;
    $('mailBtn').hidden = !m.letters.length;
    $('mailBtn').textContent = m.unread ? `Mail (${m.unread} new)` : 'Mail';
    if (more && m.unread) toast(m.unread === 1 ? 'You have a letter in your mailbox. Open it from the menu.' : `You have ${m.unread} letters in your mailbox. Open them from the menu.`);
    if (!$('mailPop').hidden) renderMail();
  }
  function renderMail() {
    const list = $('mailList'); list.textContent = '';
    for (const l of mailBox.letters) {
      const el = document.createElement('div'); el.className = `letter${l.unread ? ' new' : ''}`;
      const from = document.createElement('b'); from.textContent = `From ${l.sender}`;
      const t = document.createElement('p'); t.textContent = l.text;
      el.append(from, t); list.appendChild(el);
    }
  }
  $('paperBtn').addEventListener('click', () => { closePops(); send({ t: 'gazette' }); });
  $('paperClose').addEventListener('click', () => { $('paperPop').hidden = true; });
  // ---------- Bramblefen Basin's map ----------
  // The whole basin at two pixels a tile, drawn once, with the landmarks named and a dot for every trainer in it.
  let fenPicture = null;
  const FEN_COLORS = { T: '#22462a', '.': '#7aa05a', m: '#5e9648', M: '#6e5538', w: '#7d9a86', W: '#24525a', G: '#bfae5c', Q: '#58d6c2', P: '#e2c48c', B: '#a8784c', K: '#7a3b30', O: '#9a9a90', U: '#8c6a44', H: '#2b1a12', E: '#e2c48c' };
  function showFenMap() {
    const map = fenMap();
    if (!map) return;
    closePops();
    const S = map.rows.length, k = 512 / S;
    if (!fenPicture) {
      fenPicture = document.createElement('canvas'); fenPicture.width = fenPicture.height = 512;
      const g = fenPicture.getContext('2d');
      map.rows.forEach((row, y) => { for (let x = 0; x < S; x++) { g.fillStyle = FEN_COLORS[row[x]] || '#000'; g.fillRect(x * k, y * k, k, k); } });
    }
    const g = $('fenMapCanvas').getContext('2d');
    g.drawImage(fenPicture, 0, 0);
    g.font = 'bold 13px ui-monospace, Consolas, monospace'; g.textAlign = 'center'; g.lineWidth = 3;
    for (const m of map.marks) {
      const name = fenCfg.landmarks[m.id]?.name || '', label = name ? name[0].toUpperCase() + name.slice(1) : '';
      g.fillStyle = '#ffd166'; g.strokeStyle = '#2b1a12';
      g.beginPath(); g.arc((m.x + 0.5) * k, (m.y + 0.5) * k, 5, 0, Math.PI * 2); g.fill(); g.stroke();
      const ty = m.id === 'gate' || m.y * k <= 30 ? (m.y + 6) * k : (m.y - 3) * k;
      g.strokeText(label, (m.x + 0.5) * k, ty); g.fillStyle = '#fff6dc'; g.fillText(label, (m.x + 0.5) * k, ty);
    }
    for (const p of players.values()) {
      const mine = p.id === me;
      g.fillStyle = mine ? '#ffd166' : '#ffffff'; g.strokeStyle = '#2b1a12'; g.lineWidth = 2;
      g.beginPath(); g.arc((p.x + 0.5) * k, (p.y + 0.5) * k, mine ? 6 : 4, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    $('fenMapTitle').textContent = fenCfg.name;
    $('fenMapPop').hidden = false;
  }
  $('fenMapBtn').addEventListener('click', showFenMap);
  $('fenMapClose').addEventListener('click', () => { $('fenMapPop').hidden = true; });
  $('fenMapPop').addEventListener('pointerdown', (e) => e.stopPropagation());
  $('mailBtn').addEventListener('click', () => { closePops(); renderMail(); $('mailPop').hidden = false; $('mailClose').focus(); if (mailBox.unread) send({ t: 'mail_read' }); });
  $('mailClose').addEventListener('click', () => { $('mailPop').hidden = true; });
  for (const id of ['paperPop', 'mailPop']) $(id).addEventListener('pointerdown', (e) => e.stopPropagation());

  // ---------- learning moves ----------
  const moveRow = (mv, tag = 'div', cls = 'learn-move') => {
    const row = document.createElement(tag); row.className = cls;
    const icon = mv.type ? typeImg(mv.type) : document.createElement('span');
    const name = document.createElement('b'); name.textContent = mv.name;
    const small = document.createElement('small'); small.textContent = `${mv.cost ? `${mv.cost} stamina.` : 'Free.'} ${mv.detail}`;
    row.append(icon, name, small);
    return row;
  };
  // A Checkling wants a new move. With every slot full, the student picks one to forget or keeps what it has.
  // onPick(forget) is called with the move to forget, or 'skip'.
  function openLearn(title, note, move, known, onPick, skipLabel) {
    closePops(); $('gymPop').hidden = true;
    $('learnTitle').textContent = title;
    $('learnNote').textContent = note;
    const nw = $('learnNew'); nw.textContent = ''; nw.append(...moveRow(move).childNodes);
    const box = $('learnForget'); box.textContent = '';
    const free = known.filter((k) => k.free);
    for (const k of known) {
      const b = moveRow(k, 'button', 'ghost');
      b.type = 'button';
      b.firstChild.nextSibling.textContent = `Forget ${k.name}`;
      // The last free move stays, so the Checkling can never get stuck with no stamina.
      if (!move.free && k.free && free.length === 1) { b.disabled = true; b.title = 'It has to keep one free move.'; }
      b.addEventListener('click', () => { $('learnPop').hidden = true; onPick(k.id); });
      box.appendChild(b);
    }
    $('learnSkip').textContent = skipLabel;
    $('learnSkip').onclick = () => { $('learnPop').hidden = true; onPick('skip'); };
    $('learnPop').hidden = false;
    (box.querySelector('button:not(:disabled)') || $('learnSkip')).focus();
  }
  let learnLater = null;
  function showLearn(m) {
    if (bt) { learnLater = m; return; }
    learnLater = null;
    openLearn(`${m.name} wants to learn ${m.move.name}!`, `It already knows ${m.known.length} moves. Forget one to make room, or keep the moves it has.`,
      m.move, m.known, (forget) => send({ t: 'learn', id: m.id, move: m.move.id, forget }), `Do not learn ${m.move.name}`);
  }
  $('learnPop').addEventListener('pointerdown', (e) => e.stopPropagation());

  // ---------- the gym ----------
  let gymView = null, gameNow = null;
  function showGym(m) {
    if (bt) return;
    gymView = m;
    closePops();
    if (m.none) { toast('You need a Checkling to train at the gym.'); return; }
    $('gymImg').src = `/art/front-${m.species}.png`;
    $('gymTitle').textContent = `The Gym · ${m.name}`;
    $('gymSub').textContent = `Level ${m.level} · ${m.roundsLeft} training ${m.roundsLeft === 1 ? 'round' : 'rounds'} left today`;
    const known = $('gymKnown'); known.textContent = '';
    for (const k of m.known) known.appendChild(moveRow(k));
    const list = $('gymMoves'); list.textContent = '';
    for (const mv of m.moves) {
      const row = document.createElement('div'); row.className = `gym-move${mv.known ? ' done' : ''}`;
      const name = document.createElement('div'); name.className = 'gm-name'; if (mv.type) name.appendChild(typeImg(mv.type)); name.append(mv.name);
      const detail = document.createElement('div'); detail.className = 'gm-detail'; detail.textContent = `${mv.cost ? `${mv.cost} stamina.` : 'Free.'} ${mv.detail}`;
      const bar = document.createElement('div'); bar.className = 'gm-bar'; const fill = document.createElement('i'); fill.style.width = `${Math.min(100, (100 * mv.points) / mv.price)}%`; bar.appendChild(fill);
      bar.setAttribute('role', 'meter'); bar.setAttribute('aria-label', `${mv.name} training`); bar.setAttribute('aria-valuenow', String(mv.points)); bar.setAttribute('aria-valuemax', String(mv.price));
      const pts = document.createElement('div'); pts.className = 'gm-pts';
      pts.textContent = mv.known ? 'Already knows it.' : !mv.ready ? `Reach level ${mv.minLevel} to train for it.` : `${mv.points} of ${mv.price} points · mini game: ${mv.gameName}`;
      const btns = document.createElement('div'); btns.className = 'gm-btns';
      if (!mv.known && mv.ready) {
        if (mv.points >= mv.price) {
          const teach = document.createElement('button'); teach.type = 'button'; teach.textContent = 'Learn it';
          teach.addEventListener('click', () => teachMove(mv));
          btns.appendChild(teach);
        } else {
          const train = document.createElement('button'); train.type = 'button'; train.className = 'ghost'; train.textContent = 'Train';
          train.disabled = m.roundsLeft <= 0;
          train.addEventListener('click', () => send({ t: 'gym_start', move: mv.id }));
          btns.appendChild(train);
        }
      }
      row.append(name, btns, detail, bar, pts);
      list.appendChild(row);
    }
    $('gymNote').textContent = m.roundsLeft > 0 ? 'Each mini game round earns points toward its move. The better you play, the more you earn.' : 'That is all the training for today. Come back tomorrow.';
    $('gymPop').hidden = false;
  }
  function teachMove(mv) {
    const m = gymView;
    if (m.known.length < m.slots) return send({ t: 'gym_teach', move: mv.id });
    openLearn(`Teach ${m.name} ${mv.name}?`, 'Every move slot is full. Pick a move to forget.', mv, m.known,
      (forget) => (forget === 'skip' ? send({ t: 'gym' }) : send({ t: 'gym_teach', move: mv.id, forget })), 'Not now');
  }
  $('gymClose').addEventListener('click', () => { $('gymPop').hidden = true; });
  $('gymPop').addEventListener('pointerdown', (e) => e.stopPropagation());
  // A mini game round: instructions first, then the game, then the score and points.
  function startGame(m) {
    $('gymPop').hidden = true;
    gameNow = { round: m.round, game: m.game, seed: m.seed, move: m.move, playing: null, sent: false };
    $('gameTitle').textContent = `${m.name} · ${m.move.name}`;
    $('gameHow').textContent = m.how;
    $('gameStage').textContent = '';
    $('gameScore').textContent = '';
    $('gameGo').hidden = false; $('gameGo').textContent = 'Start';
    $('gameQuit').textContent = 'Back to the gym';
    $('gameOverlay').hidden = false;
    $('gameGo').focus();
  }
  $('gameGo').addEventListener('click', () => {
    const g = gameNow;
    if (!g || g.playing) return;
    $('gameGo').hidden = true;
    $('gameGo').blur();
    g.playing = window.CheckaverseGym.play($('gameStage'), g.game, g.seed, (sc) => { $('gameScore').textContent = `Score ${sc}`; });
    g.playing.done.then((score) => {
      if (gameNow !== g || g.sent) return;
      g.sent = true;
      $('gameScore').textContent = `Score ${score}. Checking in with the coach...`;
      send({ t: 'gym_finish', round: g.round, score });
    });
  });
  function gameResult(m) {
    if (!gameNow) return;
    $('gameScore').textContent = m.quick ? 'That round was too quick to count.' : `Score ${m.score}: +${m.earned} points. ${m.points} of ${m.price} toward ${gameNow.move.name}.${m.points >= m.price ? ' Ready to learn it!' : ''}`;
    $('gameQuit').textContent = 'Back to the gym';
    gameNow.playing = null;
  }
  function quitGame() {
    const g = gameNow;
    if (g?.playing) g.playing.stop();
    gameNow = null;
    $('gameOverlay').hidden = true;
    send({ t: 'gym' });
  }
  $('gameQuit').addEventListener('click', quitGame);
  $('gameOverlay').addEventListener('pointerdown', (e) => e.stopPropagation());

  // ---------- the sky ----------
  // Rain streaks, snowflakes, fog and storm flashes over the outdoor maps, in screen space. A handful of particles,
  // so a Chromebook keeps up. Reduced motion keeps only the still tint.
  function drawSky(now) {
    const k = sky.kind;
    if (k === 'clear') return;
    ctx.save();
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    const tint = { cloudy: 'rgba(40,50,70,0.10)', fog: 'rgba(210,220,225,0.30)', rain: 'rgba(30,45,80,0.16)', snow: 'rgba(220,235,255,0.12)', storm: 'rgba(20,25,50,0.28)' }[k];
    if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (!reduceMotion && (k === 'rain' || k === 'storm' || k === 'snow')) {
      const want = k === 'snow' ? 90 : 130;
      while (drops.length < want) drops.push({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H, v: 0.6 + Math.random() * 0.6, r: 1 + Math.random() * 2, ph: Math.random() * 6 });
      drops.length = want;
      if (k === 'snow') {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (const d of drops) {
          d.y += d.v * 0.9; d.x += Math.sin(now / 900 + d.ph) * 0.4;
          if (d.y > VIEW_H) { d.y = -4; d.x = Math.random() * VIEW_W; }
          ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        ctx.strokeStyle = 'rgba(200,222,255,0.7)'; ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (const d of drops) {
          d.y += d.v * 9; d.x -= d.v * 2.5;
          if (d.y > VIEW_H) { d.y = -10; d.x = Math.random() * (VIEW_W + 100); }
          ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 3, d.y + 11);
        }
        ctx.stroke();
      }
    }
    if (k === 'fog' && !reduceMotion) {
      for (let i = 0; i < 3; i++) {
        const x = ((now / (60 + i * 25)) % (VIEW_W + 600)) - 300, y = VIEW_H * (0.2 + i * 0.28);
        const g = ctx.createRadialGradient(x, y, 10, x, y, 260);
        g.addColorStop(0, 'rgba(235,240,242,0.35)'); g.addColorStop(1, 'rgba(235,240,242,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 260, y - 260, 520, 520);
      }
    }
    // A storm flashes now and then.
    if (k === 'storm' && !reduceMotion && Math.floor(now / 7000) % 3 === 0 && now % 7000 < 140) { ctx.fillStyle = 'rgba(255,255,240,0.55)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    ctx.restore();
  }

  // ---------- residents battling each other ----------
  // Each resident's Checkling stands a step toward the other, with a small health bar. Moves fly across as a colored
  // shot, hits flash, and when it ends the winner gets a star for a moment.
  const SHOT = { ember: '#ff7a2a', tide: '#4aa8ff', meadow: '#7ccf4a', gear: '#e2bd3a', cosmic: '#b48cff', stone: '#a68f74', storm: '#bfe8ff', shade: '#7a4ab5' };
  const SPAR_ART = {};
  function sparArt(species) {
    if (!SPAR_ART[species]) { const im = new Image(); im.src = `/art/front-${species}.png`; SPAR_ART[species] = im; }
    const im = SPAR_ART[species];
    return im.complete && im.naturalWidth > 0 ? im : null;
  }
  function sparSpots(sp) {
    const at = sp.sides.map((sd) => { const n = world?.active().find((r) => r.id === sd.resident); return n ? { x: n.dx, y: n.dy } : { x: sd.x, y: sd.y }; });
    return at.map((me, i) => {
      const other = at[1 - i], dx = other.x - me.x, dy = other.y - me.y, d = Math.hypot(dx, dy) || 1;
      const step = d > 1.6 ? 0.9 : 0;
      return { x: me.x + (dx / d) * step + (step ? 0 : (i ? 0.6 : -0.6)), y: me.y + (dy / d) * step + (step ? 0 : 0.5) };
    });
  }
  function sparThings(list, now) {
    for (const [id, sp] of spars) {
      if (sp.ended && now > sp.until) { spars.delete(id); continue; }
      if (!sparHere(sp)) continue;
      const spots = sparSpots(sp);
      sp.sides.forEach((sd, i) => {
        const at = spots[i];
        list.push({ b: at.y + 1.02, draw: () => {
          const im = sparArt(sd.species);
          const flash = sp.flashes.find((f) => f.side === i && now > f.t && now - f.t < 260);
          const shake = flash && !reduceMotion ? Math.sin(now / 25) * 2 : 0;
          const lost = sp.ended && sp.winner !== i && sp.winner !== 'draw';
          const w = 0.8 * TILE, h = im ? w * im.naturalHeight / im.naturalWidth : w;
          const px = at.x * TILE + (TILE - w) / 2 + shake, base = (at.y + 0.95) * TILE;
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.beginPath(); ctx.ellipse(at.x * TILE + TILE / 2, base - 2, w * 0.38, TILE * 0.1, 0, 0, Math.PI * 2); ctx.fill();
          if (lost) ctx.globalAlpha = 0.45;
          if (flash) ctx.filter = 'brightness(2.4)';
          if (im) ctx.drawImage(im, px, base - h, w, h);
          ctx.restore();
          // Health bar.
          const bw = TILE * 0.8, bx = at.x * TILE + (TILE - bw) / 2, by = base - h - 7, share = Math.max(0, sd.hp / sd.maxHp);
          ctx.fillStyle = 'rgba(20,20,20,0.75)'; ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
          ctx.fillStyle = share > 0.5 ? '#5bd36b' : share > 0.2 ? '#f3c623' : '#e5533d'; ctx.fillRect(bx, by, bw * share, 4);
          if (sp.ended && sp.winner === i) bubbles.push(['Winner!', at.x * TILE + TILE / 2, by - 6]);
        } });
      });
      // Shots in flight, drawn above everything on the field.
      for (const sh of sp.shots) {
        const t = (now - sh.t) / 420;
        if (t < 0 || t > 1 || reduceMotion) continue;
        const a = spots[sh.from], c = spots[1 - sh.from];
        list.push({ b: 9999, draw: () => {
          const x = (a.x + (c.x - a.x) * t + 0.5) * TILE, y = (a.y + (c.y - a.y) * t + 0.4) * TILE - Math.sin(t * Math.PI) * TILE * 0.5;
          ctx.save();
          ctx.fillStyle = SHOT[sh.type] || '#ffffff';
          ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12;
          ctx.beginPath(); ctx.arc(x, y, TILE * 0.16, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        } });
      }
    }
  }
  // Frost creeping over a headstone whose ghost is out today.
  function frost(x, y) {
    const t = reduceMotion ? 0 : performance.now() / 900;
    ctx.save();
    ctx.globalAlpha = 0.5 + (reduceMotion ? 0 : Math.sin(t) * 0.12);
    ctx.fillStyle = '#d8f1ff';
    ctx.beginPath(); ctx.ellipse((x + 0.5) * TILE, (y + 0.93) * TILE, TILE * 0.42, TILE * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 3; i++) {
      const sx = (x + 0.25 + ((hash(x, y + i) % 50) / 100)) * TILE, sy = (y + 0.35 + ((hash(y, x + i) % 40) / 100)) * TILE;
      const tw = reduceMotion ? 1 : 0.6 + 0.4 * Math.sin(t * 2 + i * 2);
      ctx.fillRect(sx - 1, sy - 3 * tw, 2, 6 * tw); ctx.fillRect(sx - 3 * tw, sy - 1, 6 * tw, 2);
    }
    ctx.restore();
  }
  // A ghost: its old self, pale and see through with a cold glow, bobbing over the grass with a faint trail.
  const GHOST_ART = {};
  function ghostArt(species) {
    if (!GHOST_ART[species]) { const im = new Image(); im.src = `/art/front-${species}.png`; GHOST_ART[species] = im; }
    const im = GHOST_ART[species];
    return im.complete && im.naturalWidth > 0 ? im : null;
  }
  function ghostSprite(g) {
    const im = ghostArt(g.species);
    const t = reduceMotion ? 0 : performance.now() / 600;
    const bob = reduceMotion ? 0 : Math.sin(t + g.x) * 0.08;
    const w = 0.95 * TILE, h = im ? w * im.naturalHeight / im.naturalWidth : w;
    const px = (g.x + 0.025) * TILE, base = (g.y + 0.85 - bob) * TILE;
    ctx.save();
    ctx.fillStyle = 'rgba(150, 210, 255, 0.25)';
    ctx.beginPath(); ctx.ellipse((g.x + 0.5) * TILE, (g.y + 0.95) * TILE, TILE * 0.32, TILE * 0.09, 0, 0, Math.PI * 2); ctx.fill();
    if (im) {
      ctx.filter = 'grayscale(0.6) brightness(1.35) drop-shadow(0 0 6px rgba(140, 205, 255, 0.95))';
      if (!reduceMotion) { ctx.globalAlpha = 0.14; ctx.drawImage(im, px, base - h + TILE * 0.18, w, h); }
      ctx.globalAlpha = 0.62 + (reduceMotion ? 0 : Math.sin(t * 1.7) * 0.08);
      ctx.drawImage(im, px, base - h, w, h);
    } else {
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#e6f6ff';
      ctx.beginPath(); ctx.ellipse((g.x + 0.5) * TILE, base - TILE * 0.4, TILE * 0.35, TILE * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    labels.push([g.mine ? 'Your ghost' : g.wander ? 'Wandering ghost' : 'Ghost', (g.x + 0.5) * TILE, base - h - 4, '#bfe6ff', 2]);
  }
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; };

  // ---------- ground, drawn once per map into its own canvas ----------
  // Small maps are painted whole. Bramblefen Basin is far too big for one canvas, so it is painted in 16 tile chunks
  // (win), each with a one tile margin so smoothing never shows a seam where two chunks meet.
  // Tinted copies of the textures are kept until more art finishes loading.
  const washes = new Map();
  function washed(name, wash, opacity = 0, size = 1) {
    if (!has(name)) return null;
    const key = `${name}|${wash}|${opacity}|${size}`;
    if (washes.has(key)) return washes.get(key);
    const im = ART[name], tile = document.createElement('canvas');
    tile.width = Math.max(1, Math.round(im.naturalWidth * size));
    tile.height = Math.max(1, Math.round(im.naturalHeight * size));
    const paint = tile.getContext('2d');
    paint.imageSmoothingEnabled = false;
    paint.drawImage(im, 0, 0, tile.width, tile.height);
    if (wash) { paint.globalAlpha = opacity; paint.fillStyle = wash; paint.fillRect(0, 0, tile.width, tile.height); }
    washes.set(key, tile);
    return tile;
  }
  // Stand in art for the basin until the Wave 8 sheets arrive: the town's own pictures, recolored once.
  function tinted(name, base, filter) {
    if (ART[name]) return ART[name];
    if (!has(base)) return null;
    const im = ART[base], c = document.createElement('canvas');
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext('2d');
    g.filter = filter;
    g.drawImage(im, 0, 0);
    Object.assign(c, { naturalWidth: c.width, naturalHeight: c.height, complete: true });
    ART[name] = c;
    return c;
  }
  const FEN_DEEP = ['#1f3b37', 0.7], FEN_SHALLOW = ['#6f7d45', 0.52];
  function buildGround(win) {
    const r = rows();
    const W = r[0].length, H = r.length;
    const x0 = win ? Math.max(0, win.x0 - 1) : 0, y0 = win ? Math.max(0, win.y0 - 1) : 0;
    const x1 = win ? Math.min(W, win.x1 + 1) : W, y1 = win ? Math.min(H, win.y1 + 1) : H;
    const c = document.createElement('canvas');
    c.width = (x1 - x0) * TILE * GROUND;
    c.height = (y1 - y0) * TILE * GROUND;
    Object.assign(c, { x0, y0 });
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
    // Every texture below is laid in map coordinates, so chunks line up.
    g.translate(-x0 * T, -y0 * T);
    const each = (fn) => { for (let y = y0; y < y1; y++) { const row = r[y]; for (let x = x0; x < x1; x++) fn(row[x], x, y); } };
    // Calm the ground without changing the original art or tinting buildings and trainers.
    const texture = (name, wash, opacity = 0, size = 1) => { const t = washed(name, wash, opacity, size); return t && g.createPattern(t, 'repeat'); };
    const fenRoom = roomKind === 'fen';
    const grass = fenRoom ? texture('tile-grass', '#5f8250', 0.58) : texture('tile-grass', '#829267', 0.66);
    const path = texture('tile-path', '#b5aa8c', 0.52, 2 / 3);
    const water = fenRoom ? texture('tile-water', ...FEN_DEEP) : texture('tile-water');
    if (!grass || !path || !water) {
      g.setTransform(GROUND, 0, 0, GROUND, -x0 * TILE * GROUND, -y0 * TILE * GROUND);
      each((ch, x, y) => townTile(g, ch, x, y));
      return c;
    }
    g.fillStyle = grass;
    g.fillRect(x0 * T, y0 * T, (x1 - x0) * T, (y1 - y0) * T);
    const at = (x, y) => (r[y] && r[y][x]) || 'T';
    if (fenRoom) {
      paintFen(g, r, at, T, each, texture, grass);
    } else {
      // Wilds terrain. Tall grass and starflowers use their Sprite Book tiles. Rocky ground and scorched heath tint
      // the path and grass art, so every zone reads as its own place without new pictures.
      const tall = texture('tile-tall-grass', '#9ccf55', 0.2);
      const flowers = texture('tile-flowers', '#d8c75a', 0.12);
      const rocky = texture('tile-path', '#77736b', 0.62, 2 / 3);
      const heath = texture('tile-grass', '#5a3a22', 0.62);
      each((ch, x, y) => {
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
      });
    }
    // Benches and the bus stop sit on a packed dirt pad instead of bare grass.
    const padProps = (mapNow()?.props || []).filter((p) => ['prop-bench', 'prop-bus-stop'].includes(p.s) && p.f);
    let laneRows = r;
    if (padProps.length) {
      const pads = r.map((row) => [...row]);
      for (const p of padProps) for (let y = p.f[1]; y < p.f[1] + p.f[3]; y++) for (let x = p.f[0]; x < p.f[0] + p.f[2]; x++) if (pads[y]) pads[y][x] = 'P';
      laneRows = pads.map((row) => row.join(''));
    }
    const box = { x0, y0, x1, y1 };
    paintPaths(g, laneRows, T, win ? box : undefined);
    paintMeadow(g, mapNow(), T, win ? box : undefined);
    if (fenRoom) return c;
    // A mossy water bank, kept below the residents and the animated ripples.
    each((ch, x, y) => {
      if (ch !== 'W') return;
      g.fillStyle = '#617c59';
      if (at(x, y - 1) !== 'W') g.fillRect(x * T, y * T, T, 6);
      if (at(x, y + 1) !== 'W') g.fillRect(x * T, y * T + T - 4, T, 4);
      if (at(x - 1, y) !== 'W') g.fillRect(x * T, y * T, 5, T);
      if (at(x + 1, y) !== 'W') g.fillRect(x * T + T - 5, y * T, 5, T);
    });
    // Flower patches: small clusters of real flowers, walkable like grass. A flower tile that bridges a lane
    // is painted as lane.
    const lane = (x, y) => 'PE'.includes(at(x, y));
    each((ch, x, y) => {
      if (ch !== 'F' || (lane(x - 1, y) && lane(x + 1, y)) || (lane(x, y - 1) && lane(x, y + 1))) return;
      const kind = hash(x, y) % 5;
      for (let i = 0; i < 4; i++) {
        const h = hash(x * 4 + i, y);
        paintFlower(g, x * T + 10 + (h % 40), y * T + 8 + ((h >>> 8) % 38), kind + (i === 3 ? 1 : 0), 4);
      }
    });
    return c;
  }

  // Bramblefen's own ground: wet mud, two depths of water, moss, reeds, glowcaps and boardwalks. Every detail is
  // placed by a hash of its tile, so it is the same on every visit and every Chromebook.
  function paintFen(g, r, at, T, each, texture, grass) {
    const mud = texture('tile-path', '#4a3726', 0.66, 2 / 3);
    const shallow = texture('tile-water', ...FEN_SHALLOW);
    const deep = texture('tile-water', ...FEN_DEEP);
    const moss = texture('tile-grass', '#79b04e', 0.42);
    const reeds = texture('tile-tall-grass', '#c2a94e', 0.28);
    const wet = (ch) => ch === 'W' || ch === 'w';
    const dry = (ch) => !wet(ch) && ch !== 'B';
    // Bushes, rocks and stumps stand on ordinary ground, so their tiles take part in the ragged edges as grass.
    each((ch, x, y) => {
      const fill = ch === 'W' ? deep : ch === 'w' ? shallow : ch === 'M' || ch === 'U' ? mud : ch === 'm' || ch === 'Q' ? moss : ch === 'G' ? reeds : null;
      if (fill) { g.fillStyle = fill; g.fillRect(x * T, y * T, T, T); }
    });
    softEdges(g, at, T, each, { '.': grass, K: grass, O: grass, m: moss, Q: moss, M: mud, U: mud, G: reeds });
    each((ch, x, y) => {
      const px = x * T, py = y * T, h = hash(x, y);
      if (ch === 'M' && h % 3 === 0) {
        // A puddle catching the sky.
        const sx = px + 14 + (h % 26), sy = py + 18 + ((h >>> 8) % 26);
        g.fillStyle = '#2b1a12'; g.fillRect(sx - 2, sy - 2, 20, 10);
        g.fillStyle = '#5f7c78'; g.fillRect(sx, sy, 16, 6);
        g.fillStyle = '#b9d3c9'; g.fillRect(sx + 2, sy, 6, 2);
      }
      if (ch === 'm' || ch === 'Q') {
        // Moss flowers like tiny stars, and the odd fallen leaf.
        for (let i = 0; i < 3; i++) { const k = hash(x * 3 + i, y * 5 + 2); g.fillStyle = '#e4f5a8'; g.fillRect(px + 6 + (k % 50), py + 6 + ((k >>> 8) % 50), 4, 4); }
        if (h % 13 === 0) {
          const lx = px + 14 + (h % 30), ly = py + 18 + ((h >>> 8) % 30);
          g.fillStyle = '#2b1a12'; g.fillRect(lx, ly, 12, 6); g.fillRect(lx + 2, ly - 2, 8, 10);
          g.fillStyle = h & 8 ? '#d9822b' : '#b8642a'; g.fillRect(lx + 2, ly + 2, 8, 2); g.fillRect(lx + 4, ly, 4, 6);
          g.fillStyle = '#f2b45a'; g.fillRect(lx + 4, ly, 2, 2);
        }
      }
      if (ch === 'Q') {
        // Glowcaps: soft teal mushrooms that light the moss around them.
        for (let i = 0; i < 3; i++) {
          const k = hash(x * 7 + i, y * 3 + 1), mx = px + 10 + (k % 40), my = py + 16 + ((k >>> 8) % 36);
          const glow = g.createRadialGradient(mx + 5, my, 1, mx + 5, my, 18); glow.addColorStop(0, '#8ffff066'); glow.addColorStop(1, '#8ffff000');
          g.fillStyle = glow; g.fillRect(mx - 14, my - 18, 38, 36);
          g.fillStyle = '#2b1a12'; g.fillRect(mx + 2, my, 6, 10); g.fillRect(mx - 2, my - 6, 14, 8);
          g.fillStyle = '#f2ead2'; g.fillRect(mx + 4, my + 2, 2, 6);
          g.fillStyle = '#4fd8c0'; g.fillRect(mx, my - 4, 10, 4);
          g.fillStyle = '#b6fff2'; g.fillRect(mx + 2, my - 4, 4, 2);
        }
      }
      if (ch === 'G' && h % 3 === 0) {
        // Cattails standing up out of the reeds.
        for (let i = 0; i < 2; i++) {
          const k = hash(x * 5 + i, y * 9), sx = px + 10 + (k % 40), sy = py + 10 + ((k >>> 8) % 20);
          g.fillStyle = '#4a6a30'; g.fillRect(sx + 2, sy + 10, 2, 26);
          g.fillStyle = '#2b1a12'; g.fillRect(sx, sy - 2, 6, 14);
          g.fillStyle = '#7a4a26'; g.fillRect(sx + 1, sy, 4, 10);
          g.fillStyle = '#a06a3a'; g.fillRect(sx + 1, sy, 2, 4);
        }
      }
      if (wet(ch)) {
        // Banks: mossy where deep water meets land, muddy where the shallows do.
        const bank = (ox, oy) => { const n = at(x + ox, y + oy); return ch === 'W' ? n !== 'W' && n !== 'B' : dry(n); };
        g.fillStyle = ch === 'W' ? (at(x, y - 1) === 'w' ? '#4f6a4a' : '#4d6b44') : '#5d5236';
        if (bank(0, -1)) g.fillRect(px, py, T, 6);
        if (bank(0, 1)) g.fillRect(px, py + T - 4, T, 4);
        if (bank(-1, 0)) g.fillRect(px, py, 5, T);
        if (bank(1, 0)) g.fillRect(px + T - 5, py, 5, T);
        // Lily pads in the shallows (deep water gets its own, drawn over the drifting water), and duckweed.
        if (ch === 'w' && h % 9 === 0) lilyPad(g, px + 12 + (h % 24), py + 16 + ((h >>> 8) % 24), 1, h, '#5e6e3a');
        if (ch === 'w') for (let i = 0; i < 4; i++) { const k = hash(x * 11 + i, y * 7); g.fillStyle = '#9cbc52'; g.fillRect(px + 4 + (k % 56), py + 4 + ((k >>> 8) % 56), 4, 2); }
      }
      if (ch === 'B') {
        // Boardwalk planks laid across the way it runs, with a dark edge where it meets the water.
        const lane2 = (n) => n === 'B' || n === 'P' || n === 'E';
        const ns = lane2(at(x, y - 1)) || lane2(at(x, y + 1)), ew = lane2(at(x - 1, y)) || lane2(at(x + 1, y));
        const across = ns && !ew; // a north south walk has boards lying east to west
        g.fillStyle = '#3b2716'; g.fillRect(px, py, T, T);
        for (let i = 0; i < 8; i++) {
          const k = hash(x * 8 + i, y), tone = k % 3 === 0 ? '#9a7048' : k % 3 === 1 ? '#8b6440' : '#a57a50';
          g.fillStyle = tone;
          if (across) g.fillRect(px + 2, py + i * 8 + 1, T - 4, 6); else g.fillRect(px + i * 8 + 1, py + 2, 6, T - 4);
          g.fillStyle = '#c9a27066';
          if (across) g.fillRect(px + 2, py + i * 8 + 1, T - 4, 1); else g.fillRect(px + i * 8 + 1, py + 2, 1, T - 4);
          g.fillStyle = '#2b1a12';
          if (across) { g.fillRect(px + 6, py + i * 8 + 3, 2, 2); g.fillRect(px + T - 8, py + i * 8 + 3, 2, 2); }
          else { g.fillRect(px + i * 8 + 3, py + 6, 2, 2); g.fillRect(px + i * 8 + 3, py + T - 8, 2, 2); }
        }
        if (h % 4 === 0) { g.fillStyle = '#6f9a4a'; g.fillRect(px + 8 + (h % 40), py + 10 + ((h >>> 8) % 40), 6, 4); }
        g.fillStyle = '#2b1a12';
        if (across) { g.fillRect(px, py, 3, T); g.fillRect(px + T - 3, py, 3, T); }
        else { g.fillRect(px, py, T, 3); g.fillRect(px, py + T - 3, T, 3); }
      }
    });
  }

  // Where two kinds of ground meet, each pushes a few ragged tongues into the other, so the basin never shows the grid.
  function softEdges(g, at, T, each, fills) {
    each((ch, x, y) => {
      const mine = fills[ch];
      if (!mine) return;
      for (const [dx, dy, side] of [[0, -1, 0], [1, 0, 1], [0, 1, 2], [-1, 0, 3]]) {
        const n = at(x + dx, y + dy);
        if (n === ch || !fills[n]) continue;
        g.fillStyle = mine;
        for (let i = 0; i < 3; i++) {
          const k = hash(x * 13 + side * 5 + i, y * 7 + side), along = 4 + (k % (T - 20)), len = 10 + ((k >>> 8) % 10), deep = 4 + ((k >>> 16) % 8);
          const px = x * T, py = y * T;
          if (side === 0) g.fillRect(px + along, py - deep, len, deep);
          else if (side === 2) g.fillRect(px + along, py + T, len, deep);
          else if (side === 1) g.fillRect(px + T, py + along, deep, len);
          else g.fillRect(px - deep, py + along, deep, len);
        }
      }
    });
  }
  // A lily pad: a notched green disc, one in three with a white flower. u is pixels per art pixel pair.
  function lilyPad(g, lx, ly, u, h, notch) {
    g.fillStyle = '#2b1a12'; g.beginPath(); g.ellipse(lx, ly, 13 * u, 8 * u, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4f8a3a'; g.beginPath(); g.ellipse(lx, ly, 11 * u, 6 * u, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#76b04e'; g.fillRect(lx - 6 * u, ly - 4 * u, 6 * u, 2 * u);
    g.fillStyle = notch; g.fillRect(lx + 2 * u, ly - 1 * u, 10 * u, 2 * u);
    if (h % 3 === 0) { g.fillStyle = '#fffaf0'; g.fillRect(lx - 4 * u, ly - 6 * u, 8 * u, 6 * u); g.fillStyle = '#ffd95a'; g.fillRect(lx - 2 * u, ly - 4 * u, 4 * u, 2 * u); }
  }
  // Pads on the basin's deep water ride on top of the drift and bob a little.
  function fenPads(now, x0, y0, x1, y1) {
    const r = rows();
    for (let y = Math.max(0, y0); y <= Math.min(r.length - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(r[0].length - 1, x1); x++) {
      if (r[y][x] !== 'W') continue;
      const h = hash(x, y);
      if (h % 17) continue;
      const bob = reduceMotion ? 0 : Math.sin(now / 1400 + (h % 50)) * 0.8;
      lilyPad(ctx, x * TILE + 6 + (h % 12), y * TILE + 8 + ((h >>> 8) % 12) + bob, 0.5, h, '#1c4a46');
    }
  }

  // Bramblefen chunks: built two at a time as they come into view, kept until a dozen newer ones push them out.
  const CHUNK = 16, chunks = new Map();
  let chunkBuilds = 0;
  function chunkAt(cx, cy, build) {
    const key = `${room}:${artWaiting}:${cx},${cy}`;
    let c = chunks.get(key);
    if (c) { chunks.delete(key); chunks.set(key, c); return c; }
    if (!build) return null;
    const r = rows();
    c = buildGround({ x0: cx * CHUNK, y0: cy * CHUNK, x1: Math.min(r[0].length, (cx + 1) * CHUNK), y1: Math.min(r.length, (cy + 1) * CHUNK) });
    chunks.set(key, c);
    chunkBuilds++;
    while (chunks.size > 12) chunks.delete(chunks.keys().next().value);
    return c;
  }
  function drawChunks(cx, cy, vw, vh) {
    const r = rows(), span = CHUNK * TILE;
    const ax = Math.max(0, Math.floor(cx / span)), ay = Math.max(0, Math.floor(cy / span));
    const bx = Math.min(Math.ceil(r[0].length / CHUNK) - 1, Math.floor((cx + vw) / span)), by = Math.min(Math.ceil(r.length / CHUNK) - 1, Math.floor((cy + vh) / span));
    let budget = 2;
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) {
      let c = chunkAt(x, y, false);
      if (!c && budget > 0) { c = chunkAt(x, y, true); budget--; }
      const dx = x * span, dy = y * span, w = Math.min(span, r[0].length * TILE - dx), h = Math.min(span, r.length * TILE - dy);
      if (!c) { ctx.fillStyle = '#3f5a3a'; ctx.fillRect(dx, dy, w, h); continue; }
      // Copy the chunk without its margin. The margin pixels keep smoothing honest at the seam.
      const sx = (dx / TILE - c.x0) * TILE * GROUND, sy = (dy / TILE - c.y0) * TILE * GROUND;
      ctx.drawImage(c, sx, sy, w * GROUND, h * GROUND, dx, dy, w, h);
    }
    // Spare time goes to the chunks just outside the view, so walking on never waits. It only fills free room in the
    // cache, so it never pushes out a chunk that is still on screen.
    if (budget === 2 && chunks.size < 12) {
      for (let y = Math.max(0, ay - 1); y <= Math.min(Math.ceil(r.length / CHUNK) - 1, by + 1) && budget === 2; y++) {
        for (let x = Math.max(0, ax - 1); x <= Math.min(Math.ceil(r[0].length / CHUNK) - 1, bx + 1); x++) {
          if (!chunkAt(x, y, false)) { chunkAt(x, y, true); budget--; break; }
        }
      }
    }
  }

  // The pond drifts slowly: the water texture is redrawn over the water tiles a few pixels further along each frame.
  // The bank outline from the ground canvas is drawn back on top so the edge stays crisp.
  // The basin's deep water drifts too, in its own darker teal.
  let waterPattern = null, fenWaterPattern = null;
  function shimmer(now, x0, y0, x1, y1) {
    if (!has('tile-water') || reduceMotion) return;
    if (!waterPattern) waterPattern = ctx.createPattern(ART['tile-water'], 'repeat');
    if (roomKind === 'fen' && !fenWaterPattern) fenWaterPattern = ctx.createPattern(washed('tile-water', ...FEN_DEEP), 'repeat');
    const pattern = roomKind === 'fen' ? fenWaterPattern : waterPattern;
    const r = rows();
    const off = (now / 90) % 192;
    const m = new DOMMatrix().scale(1 / GROUND).translate(off, off * 0.4);
    pattern.setTransform(m);
    ctx.fillStyle = pattern;
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
    const fenRoom = roomKind === 'fen';
    if (fenRoom) {
      // Willows, rusty cypress, brambles, mossy rocks and stumps, recolored from the town's art until Wave 8 lands.
      tinted('fen-tree', 'prop-tree', 'hue-rotate(16deg) saturate(0.82) brightness(0.86)');
      tinted('fen-tree-rust', 'prop-tree', 'hue-rotate(-42deg) saturate(1.05) brightness(0.9)');
      tinted('fen-bramble', 'prop-bush', 'hue-rotate(28deg) saturate(1.15) brightness(0.78)');
    }
    for (let y = Math.max(0, y0 - 1); y <= Math.min(r.length - 1, y1 + 3); y++) {
      for (let x = Math.max(0, x0 - 2); x <= Math.min(r[0].length - 1, x1 + 2); x++) {
        const ch = r[y][x];
        if (fenRoom && 'TKOU'.includes(ch)) {
          const h = hash(x, y);
          if (ch === 'T') {
            const art = h % 7 === 0 && has('fen-tree-rust') ? 'fen-tree-rust' : has('fen-tree') ? 'fen-tree' : 'prop-tree', k = 0.95 + (h % 17) / 100;
            list.push({ b: y + 1, draw: () => (has(art) ? sprite(art, x + 0.5 - 1.05 * k, y + 1.05, 2.1 * k, h & 1) : boxShape(x + 0.1, y + 1, 0.8, 1, '#2f5b3a')) });
          } else if (ch === 'K') list.push({ b: y + 1, draw: () => (has('fen-bramble') ? sprite('fen-bramble', x - 0.08, y + 1.04, 1.16, h & 1) : boxShape(x + 0.1, y + 1, 0.8, 0.7, '#5b3a2a')) });
          else if (ch === 'O') list.push({ b: y + 1, draw: () => (has('prop-rock') ? sprite('prop-rock', x + 0.02, y + 1.02, 0.96, h & 1) : boxShape(x + 0.1, y + 1, 0.8, 0.6, '#8a8a80')) });
          else list.push({ b: y + 1, draw: () => (has('prop-stump') ? sprite('prop-stump', x + 0.12, y + 1.02, 0.78, h & 1) : boxShape(x + 0.2, y + 1, 0.6, 0.6, '#7a5230')) });
          continue;
        }
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
        const frosty = ghostView.frost.some(([fx, fy]) => fx === st.x && fy === st.y);
        list.push({ b: st.y + 1, draw: () => { (has(art) ? sprite(art, st.x + 0.1, st.y + 1, 0.8) : boxShape(st.x + 0.2, st.y + 1, 0.6, 0.8, '#9a9a9a')); if (frosty) frost(st.x, st.y); } });
      }
      if (sightMs()) for (const g of ghostView.ghosts) list.push({ b: g.y + 1.01, draw: () => ghostSprite(g) });
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
    if ((roomKind === 'wilds' || roomKind === 'kettle' || roomKind === 'fen') && has('tile-tall-grass') && rows()[Math.round(p.dy)]?.[Math.round(p.dx)] === 'G') {
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
      const chunked = roomKind === 'fen';
      if (!chunked && (!ground || groundKey !== key)) { ground = buildGround(); groundKey = key; }
      const target = cameraTarget();
      cam = target; // locked to your trainer, so the walk never wobbles
      const z = zoom(), vw = VIEW_W / z, vh = VIEW_H / z;
      const cx = Math.round(cam.x * SCALE * z) / (SCALE * z), cy = Math.round(cam.y * SCALE * z) / (SCALE * z);
      ctx.save();
      ctx.scale(z, z);
      ctx.translate(-cx, -cy);
      // Copy only the part of the ground that is on screen; the whole town is far bigger than the view.
      if (chunked) drawChunks(cx, cy, vw, vh);
      else {
        const gx = Math.max(0, cx), gy = Math.max(0, cy);
        const gw = Math.min(ground.width / GROUND - gx, vw - (gx - cx)), gh = Math.min(ground.height / GROUND - gy, vh - (gy - cy));
        if (gw > 0 && gh > 0) ctx.drawImage(ground, gx * GROUND, gy * GROUND, gw * GROUND, gh * GROUND, gx, gy, gw, gh);
      }
      if (roomKind !== 'house') shimmer(world?.clock() ?? now, Math.floor(cx / TILE), Math.floor(cy / TILE), Math.ceil((cx + vw) / TILE), Math.ceil((cy + vh) / TILE));
      if (chunked) fenPads(world?.clock() ?? now, Math.floor(cx / TILE), Math.floor(cy / TILE), Math.ceil((cx + vw) / TILE), Math.ceil((cy + vh) / TILE));
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
      sparThings(things, now);
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
      if (roomKind !== 'house') drawSky(now);
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
    if (roomKind === 'kettle') { const mins = Math.ceil(sightMs() / 60000); if (mins !== sightShown) { sightShown = mins; placeLine(); } }
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
    fen: 'Bramblefen Basin is huge. Follow the trails and read the signposts. Wild Checklings hide in the reeds and the shallows, and the strongest live somewhere under the willows.',
    battle: 'Press 1 to 4 or tap a move. Both trainers pick, then the turn plays out.',
    'wild-battle': 'Wear it down first, then press 5 to throw a charm. Weaker Checklings are easier to catch. Press 6 to run.',
    caught: 'Your catch is yours to keep. Tap your partner button to battle with it, or to move Checklings between your party and your Den.',
    'caught-visit': 'Your catch is in your partner list for this visit. Tap your partner button to battle with it.',
    kettle: 'This is Kettle Creek, your home town. Your house, the clinic and Route 1 are here. The bus stop takes you to the Checkaverse to battle classmates.',
    care: 'Tap Care to feed, groom, play with and nap your Checkling. Too much or too little of anything has a cost.',
    visitor: 'You are visiting, so catches and wins are not saved. To keep them, ride the bus from your Check-In page.',
    frost: 'Frost on a headstone means a ghost is out today. Face a headstone and press Space to look closer.',
    moss: 'Grave moss! Take two to the apothecary to brew Spirit Sight, so your partner can see ghosts.',
    'ghost-seen': 'Your partner can see ghosts now. Walk into one to battle it. You can only catch your own Checkling\'s ghost or a wandering one.',
    'ghost-battle': 'Watch for the warning: on a fading turn your attacks pass right through the ghost. Guard on those turns.',
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
    } else if (roomKind === 'fen') {
      // Close to a landmark its name shows; anywhere else, the kind of ground underfoot.
      const near = (fen?.marks || []).find((k) => Math.abs(k.x - self.x) + Math.abs(k.y - self.y) <= 7);
      const name = near ? fenCfg.landmarks[near.id]?.name || '' : fenCfg?.zones?.[rows()[self.y]?.[self.x]]?.name || '';
      const z = name ? name[0].toUpperCase() + name.slice(1) : '';
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
    if (c.ghost) im.classList.add('ghostly');
    b.append(im, c.caught ? `${shortName(c)} ★` : c.ghost ? `${shortName(c)} · Returned` : shortName(c));
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
  // Caught and egg Checklings can be named. The first Checkling keeps its Check-In name.
  function nameButton(c, row) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'den-btn';
    b.textContent = 'Name';
    b.title = `Give ${c.nick || `your ${c.name}`} a name`;
    b.disabled = Boolean(bt);
    b.addEventListener('click', (e) => {
      if (e.detail) b.blur();
      const form = document.createElement('form'); form.className = 'name-form';
      const input = document.createElement('input');
      Object.assign(input, { type: 'text', maxLength: 14, value: c.nick || '', placeholder: c.name, autocomplete: 'off', spellcheck: false });
      input.setAttribute('aria-label', `Name for your ${c.name}`);
      input.setAttribute('data-desk-skip', '');
      const ok = document.createElement('button'); ok.type = 'submit'; ok.className = 'den-btn'; ok.textContent = 'Save';
      form.append(input, ok);
      form.addEventListener('submit', (ev) => { ev.preventDefault(); send({ t: 'nick', v: c.v, name: input.value }); });
      input.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Escape') buildPartners(); });
      row.replaceChildren(form);
      input.focus();
      input.select();
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
    $('careImg').classList.toggle('ghostly', Boolean(b.ghost));
    $('careName').textContent = m.name;
    if (b.ghost) return renderGhostCare(m, b);
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
  // A caught ghost has no body to care for. It only needs to stay in the party.
  function renderGhostCare(m, b) {
    $('careSub').textContent = `Level ${m.level} · Returned · ${b.temper}`;
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
    $('careBars').textContent = '';
    const tags = $('careTags');
    tags.textContent = '';
    const d = document.createElement('div'); d.className = 'care-tag';
    const h = document.createElement('b'); h.textContent = 'A ghost';
    const left = Math.max(0, b.keep - b.away);
    d.append(h, m.den
      ? `It never eats, naps or gets sick, but it is drifting in the Den. It fades back to the cemetery after ${left} more school ${left === 1 ? 'day' : 'days'} out of your party.`
      : 'It never eats, naps or gets sick, and it can never die again. It stays close as long as it travels in your party. It cannot evolve.');
    tags.appendChild(d);
    $('careActions').textContent = '';
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
      row.append(partnerButton(c));
      if (!c.hatched) row.append(nameButton(c, row));
      row.append(denButton(c, false, party.length > 1));
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
        const name = document.createElement('span'); name.textContent = c.ghost ? `${shortName(c)} · Returned` : shortName(c);
        if (c.ghost) im.classList.add('ghostly');
        row.append(im, name);
        if (!c.hatched) row.append(nameButton(c, row));
        row.append(denButton(c, true, party.length < partyMax));
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
    chip.hidden = roomKind !== 'wilds' && roomKind !== 'fen' && !visitCatches;
    $('fenMapBtn').hidden = roomKind !== 'fen';
    if (roomKind !== 'fen') $('fenMapPop').hidden = true;
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
      turnMs: m.turnMs, until: performance.now() + (m.left ?? m.turnMs), watching: m.you === null, wild: Boolean(m.wild), zone: m.zone || '', ghost: m.ghost || null };
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
    else if (bt.ghost) {
      const who = bt.ghost.mine ? (bt.ghost.name ? ` It is ${bt.ghost.name}, back from the cemetery.` : ' It is a Checkling you once raised.') : bt.ghost.wander ? ' Nobody knows whose it was.' : ' It belonged to someone in your class.';
      say(`${bt.ghost.rise}${who} Go, ${mine.speciesName}!`); tipSoon('ghost-battle', 1600);
    }
    else if (bt.wild) { say(`A wild ${foe.speciesName} jumped out of ${/^route/i.test(bt.zone || '') ? bt.zone : `the ${(bt.zone || 'grass').toLowerCase()}`}! Go, ${mine.speciesName}!`); tipSoon('wild-battle', 1600); }
    else { say(`${foe.name} sent out ${foe.speciesName}! ${m.intro || ''} Go, ${mine.speciesName}!`); tipSoon('battle', 1600); }
    buildMoves(); buildPartners();
    if (!bt.watching) setTimeout(() => bMoves.querySelector('button:not(:disabled)')?.focus({ preventScroll: true }), 50);
  }
  function closeBattle(quiet) {
    if (bt && bt.watching && !bt.done && !quiet) send({ t: 'unwatch' });
    bt = null;
    bEl.hidden = true;
    buildPartners(); watchLine();
    if (learnLater) setTimeout(() => learnLater && showLearn(learnLater), 300);
    else if (paperLater) setTimeout(() => paperLater && showPaper(paperLater), 300);
  }
  function bar(el, value, max, hp) {
    const pct = Math.max(0, Math.min(100, (100 * value) / Math.max(1, max)));
    el.style.width = `${pct}%`;
    if (hp) { el.classList.toggle('mid', pct <= 50 && pct > 20); el.classList.toggle('low', pct <= 20); }
  }
  // Battle-only Sprite Book poses, for every species. The original front and back URLs still serve
  // the map, partner screens, older clients, and the last image fallback.
  function battlePose(image, species, face) {
    const original = `/art/${face}-${species}.png`;
    image.onerror = null;
    image.classList.add('sprite-book-pose');
    const still = `/art/${face}-${species}-v2.png`;
    image.onerror = () => {
      if (image.getAttribute('src') !== still) image.src = still;
      else {
        image.onerror = null;
        image.classList.remove('sprite-book-pose');
        image.src = original;
      }
    };
    image.src = motionQuery.matches ? still : `/art/${face}-${species}-v2-idle.png`;
  }
  function drawBattlePoses(view) {
    const n = nearSide(), mine = view.sides[n], foe = view.sides[1 - n];
    battlePose($('bFoeMon'), foe.species, 'front');
    $('bFoeMon').alt = `${foe.name}'s ${foe.speciesName}`;
    battlePose($('bMeMon'), mine.species, 'back');
    $('bMeMon').alt = `${mine.name}'s ${mine.speciesName}, from behind`;
  }
  motionQuery.addEventListener('change', () => { if (bt) drawBattlePoses(bt.view); });
  function drawSides(view, sprites) {
    const n = nearSide(), mine = view.sides[n], foe = view.sides[1 - n];
    const nameWith = (el, f) => { el.textContent = f.speciesName; el.prepend(typeImg(f.type)); };
    nameWith($('bFoeName'), foe); nameWith($('bMeName'), mine);
    $('bFoeLv').textContent = `Lv ${foe.level}`; $('bMeLv').textContent = `Lv ${mine.level}`;
    $('bFoeTrainer').textContent = bt && bt.ghost ? `Ghost · ${bt.ghost.temper}${foe.fadeNext ? ' · fading next turn' : ''}` : bt && bt.wild ? `Wild · ${bt.zone}` : `${foe.name}${foe.fadeNext ? ' · fading next turn' : ''}`;
    if (bt && bt.ghost) $('bFoeName').childNodes[1].textContent = bt.ghost.name ? `${bt.ghost.name}'s ghost` : `Ghost ${foe.speciesName}`;
    else if (bt && bt.wild) $('bFoeName').childNodes[1].textContent = `Wild ${foe.speciesName}`;
    $('bFoeMon').classList.toggle('ghostly', Boolean(foe.ghost));
    $('bMeMon').classList.toggle('ghostly', Boolean(mine.ghost));
    bar($('bFoeHp'), foe.hp, foe.maxHp, true); bar($('bFoeSt'), foe.stamina, foe.maxStamina);
    bar($('bMeHp'), mine.hp, mine.maxHp, true); bar($('bMeSt'), mine.stamina, mine.maxStamina);
    $('bMeHpNum').textContent = `${bt && bt.watching ? `${mine.name} · ` : ''}HP ${mine.hp} / ${mine.maxHp}`;
    $('bMeStNum').textContent = `Stamina ${mine.stamina} / ${mine.maxStamina}`;
    if (sprites) drawBattlePoses(view);
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
      const notMine = bt.ghost && !bt.ghost.canCatch;
      bCharm.textContent = notMine ? '5. Not yours to catch' : `5. Throw charm (${charms} left)`;
      bCharm.disabled = busy || charms <= 0 || notMine;
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
        const mv = b.view.sides[e.side].moves.find((x) => x.id === e.move) || { type: e.type, hit: true };
        await Promise.all([wait(650), window.CheckaverseBattleFx?.play(document.querySelector('.b-scene'), el, monEl(1 - e.side),
          { type: mv.type, damage: mv.hit, guard: mv.guard, shield: mv.shield }, motionQuery.matches)]);
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
      } else if (e.k === 'fade') {
        const el = monEl(e.side);
        el.classList.remove('fading'); void el.offsetWidth; el.classList.add('fading');
        await wait(850);
        el.classList.remove('fading');
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
    if (b.ghost) {
      const g = b.ghost, mine = m.view.sides[0], who = g.name || `the ${m.view.sides[1].speciesName} ghost`;
      if (m.reason === 'caught') line = m.kept === 'party' ? `${who[0].toUpperCase()}${who.slice(1)} is back with you as a ghost. It never eats or gets sick, but keep it in your party or it will fade away again.`
        : `Caught! ${who[0].toUpperCase()}${who.slice(1)} went to your Den, since only one ghost can travel with you. Bring it into your party soon or it will fade away again.`;
      else if (m.reason === 'slipped') line = 'The Spirit Sight wore off, and the ghost slipped away. Try again another day.';
      else if (m.reason === 'ran') line = 'You backed away from the ghost.';
      else if (m.winner === 0) line = `The ghost sinks back into the ground. It will not rise again until tomorrow. ${mine.speciesName} looks spooked but proud.`;
      else line = `${mine.speciesName} is knocked out, but it recovers fully after the match. The ghost drifts back to its stone.`;
    } else if (b.wild) {
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

  setInterval(idleCheck, IDLE_MS < 5000 ? 50 : 15000);

  // ?debug lets the movement test read where trainers are drawn. It changes nothing.
  if (/[?&]debug\b/.test(location.search)) window.__checkaverse = { players, me: () => me, battle: () => bt, room: () => room, walk: (x, y) => walkTo([[x, y]]), world: () => world, camera: () => ({...cam, width:VIEW_W,height:VIEW_H}), fen: () => ({ map: fen, ms: fenMs, want: fenWant, chunks: chunks.size, built: chunkBuilds }), talk: talkTo,visit:visitResident,navigating:()=>residentNav };
  connect();
  requestAnimationFrame(frame);
})();
