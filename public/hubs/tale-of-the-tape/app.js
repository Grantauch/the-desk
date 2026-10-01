/* Tale of the Tape — screens and wiring. The engine owns the rules; this file draws them and saves
   the career in this browser only (localStorage). Nothing is sent anywhere. */
(function (T) {
  'use strict';
  const D = T.data, E = T.engine;
  const app = document.getElementById('app');
  const dialog = document.getElementById('dialog');
  const dialogBody = document.getElementById('dialog-body');
  const live = document.getElementById('live');
  const toastEl = document.getElementById('toast');
  const KEY = 'tott-career-v1', HALL = 'tott-hall-v1', ACH = 'tott-ach-v1', SETTINGS = 'tott-settings-v1', BOOK = 'tott-discoveries-v1';
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let S = null;
  let ui = { screen: 'title' };
  let fightCtl = null;
  let settings = Object.assign({ assist: 'normal' }, readJSON(SETTINGS) || {});

  // ---------- storage ----------
  function readJSON(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function save() { if (S) writeJSON(KEY, { state: S, ui: { screen: ui.screen === 'fight' ? 'game' : ui.screen, prefight: ui.prefight || false } }); }
  function loadSaved() { const x = readJSON(KEY); return x && E.validate(x.state) ? x : null; }
  function saveSettings() { writeJSON(SETTINGS, settings); }

  // ---------- small helpers ----------
  const esc = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const money = (n) => E.money(n);
  const rec = (r) => `${r.w}–${r.l}${r.d ? '–' + r.d : ''}`;
  const oppRec = (o) => `${o.w}–${o.l}${o.d ? '–' + o.d : ''}`;
  const announce = (t) => { live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30); };
  const eraLook = () => (S ? E.era(S.t).look : 'poster');
  const statKeys = ['pow', 'spd', 'sta', 'chn', 'def'];
  function toast(html, ms = 3200) {
    toastEl.innerHTML = html; toastEl.hidden = false; toastEl.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => { toastEl.classList.remove('show'); toastEl.hidden = true; }, ms);
  }
  function sfx(n, v) { T.audio && T.audio.play(n, v); }
  function focusMain() { const h = app.querySelector('h1, h2, [data-focus]'); (h || app).focus && (h || app).focus({ preventScroll: false }); }
  function setEra() {
    const id = S ? E.era(S.t).id : 'depression';
    document.body.dataset.era = id;
  }
  function portraitCanvas(look, opts = {}, cls = 'portrait', w = 200, h = 240) {
    const id = 'p' + Math.random().toString(36).slice(2, 9);
    queuePortraits.push({ id, look, opts });
    return `<canvas class="${cls}" id="${id}" width="${w * 2}" height="${h * 2}" aria-hidden="true"></canvas>`;
  }
  let queuePortraits = [];
  function flushPortraits() {
    for (const p of queuePortraits) { const c = document.getElementById(p.id); if (c) T.portrait(c, p.look, p.opts); }
    queuePortraits = [];
  }
  const pctOf = (v, max) => Math.max(0, Math.min(100, (v / max) * 100)).toFixed(1);
  // Bars start where they were last time and slide to the new value, so every change is visible.
  function bar(v, max = 100, cls = '', from) {
    const start = from == null ? v : from;
    return `<span class="bar ${cls}"><i style="width:${pctOf(start, max)}%" data-w="${pctOf(v, max)}"></i></span>`;
  }
  function delta(v, from, digits = 1) {
    if (from == null) return '';
    const d = v - from;
    if (Math.abs(d) < 0.1) return '';
    return `<em class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(digits)}</em>`;
  }
  function statRow(k, v) { const p = ui.prev && ui.prev.st ? ui.prev.st[k] : null; return `<div class="stat"><span>${E.statLabel[k]}</span>${bar(v, 100, '', p)}<b>${Math.round(v)}${delta(v, p)}</b></div>`; }
  function snap() { if (!S) return null; return { st: Object.assign({}, S.st), money: S.money, fame: S.fame, health: S.health, heart: S.heart, sharp: S.sharp }; }
  function animateBars() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      app.querySelectorAll('.bar i[data-w]').forEach((i) => { i.style.width = i.dataset.w + '%'; });
      app.querySelectorAll('[data-count]').forEach((el) => {
        const from = Number(el.dataset.from), to = Number(el.dataset.count);
        if (reducedMotion || from === to) { el.textContent = money(to); return; }
        const t0 = performance.now();
        const step = (t) => { const k = Math.min(1, (t - t0) / 700); el.textContent = money(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      });
    }));
  }
  const ICON = {
    roadwork: '<path d="M4 17h11l4-3 1-3-5-1-3-4-3 2 1 3-4 1z"/><path d="M4 20h16"/>',
    bag: '<path d="M12 2v3"/><rect x="7" y="5" width="10" height="15" rx="5"/><path d="M7 10h10"/>',
    speed: '<path d="M4 4h16"/><path d="M12 4v3"/><path d="M12 7c-3 0-4 3-4 5s2 5 4 5 4-3 4-5-1-5-4-5z"/>',
    spar: '<path d="M5 9a4 4 0 0 1 7 0v5H5z"/><path d="M5 14h7v3H5z"/><path d="M19 9a4 4 0 0 0-7 0"/><path d="M19 9v5h-4"/>',
    chin: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>',
    work: '<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M8 9V6h8v3"/><path d="M4 13h16"/>',
    rest: '<path d="M20 15a8 8 0 1 1-9-11 6 6 0 0 0 9 11z"/>',
    press: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M8 21h8"/>',
    tv: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M8 2l4 4 4-4"/>',
    circuit: '<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="17" cy="17" r="2"/><path d="M7 18h8M18 8l-1 7M6 16l11-9"/>',
    fight: '<path d="M6 10a5 5 0 0 1 10 0v6H6z"/><path d="M6 16h10v4H6z"/><path d="M16 11h2a2 2 0 0 1 0 4h-2"/>',
    scout: '<circle cx="10" cy="10" r="6"/><path d="M15 15l5 5"/>',
    hype: '<path d="M3 10v4h4l6 4V6L7 10z"/><path d="M16 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>',
  };
  const icon = (k) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[k] || ICON.fight}</svg>`;

  function show(html) {
    stopDemo();
    app.innerHTML = html;
    flushPortraits();
    animateBars();
    window.scrollTo(0, 0);
    setTimeout(focusMain, 20);
    renderTopbar();
  }

  function renderTopbar() {
    const s = document.querySelector('[data-ui="sound"]');
    if (s) { s.textContent = T.audio.enabled ? 'Sound on' : 'Sound off'; s.setAttribute('aria-pressed', String(T.audio.enabled)); }
  }

  // ---------- routing ----------
  function render() {
    setEra();
    if (ui.screen === 'title' || !S && !['create', 'quick'].includes(ui.screen)) return renderTitle();
    if (ui.screen === 'create') return renderCreate();
    if (ui.screen === 'quick') return renderQuick();
    if (ui.screen === 'fight') return;
    if (ui.screen === 'radio') return renderRadio();
    if (ui.screen === 'clipping') return renderClipping();
    const cs = pendingCutscene();
    if (cs) { S.flags['cs_' + cs] = true; save(); playScene(cs).then(render); return; }
    if (S.inbox.length) return renderEvent();
    if (S.newAch && S.newAch.length) { const a = S.newAch.splice(0); a.forEach((id, i) => setTimeout(() => achToast(id), i * 1400)); remember(a); }
    if (ui.circuit) return renderCircuit();
    if (S.phase === 'done') return renderFinal();
    if (S.phase === 'retired') return renderPaths();
    if (S.phase === 'after') return renderAfter();
    if (S.phase === 'service') return renderService();
    if (S.phase === 'camp') return ui.prefight ? renderPrefight() : renderCamp();
    if (S.offers && S.offers.length) return renderOffers();
    return renderLedger();
  }
  function pendingCutscene() {
    if (!S || ui.screen !== 'game') return null;
    const y = E.year(S.t);
    if (S.hist.h_pearl && !S.flags.cs_war && y <= 1943) return 'war';
    if (y >= 1946 && y <= 1948 && !S.flags.cs_postwar) return 'postwar';
    if (y >= 1949 && y <= 1952 && !S.flags.cs_tv) return 'tv';
    if (S.phase === 'retired' && !S.flags.cs_lastbell) return 'lastbell';
    return null;
  }
  function playScene(kind, extra) {
    if (!T.cutscene) return Promise.resolve();
    const opts = Object.assign({ reduced: reducedMotion, city: D.CITIES[S.f.home].name, money: money(S.money), look: S.f.look, name: E.fullName(S.f), division: D.DIVISIONS[S.f.division].name, year: E.year(S.t), record: `${rec(S.rec)} · ${S.rec.ko} knockouts` }, extra || {});
    return T.cutscene.play(kind, opts);
  }
  function remember(ids) { const all = readJSON(ACH) || []; for (const id of ids) if (!all.includes(id)) all.push(id); writeJSON(ACH, all); }
  function achToast(id) { const a = D.ACHIEVEMENTS.find((x) => x.id === id); if (!a) return; sfx('star', 0.8); toast(`<span class="toast-kicker">Achievement</span><b>${esc(a.name)}</b><small>${esc(a.text)}</small>`); }

  // ---------- title ----------
  function renderTitle() {
    document.body.dataset.era = 'depression';
    const saved = loadSaved();
    const hall = (readJSON(HALL) || []).slice(0, 8);
    const ach = readJSON(ACH) || [];
    const heads = T.history.map((h) => `<span><b>${h.y}</b> ${esc(h.title.toUpperCase())}</span>`).join('');
    const tab = ui.titleTab || 'how';
    show(`
      <section class="title-screen">
        <div class="title-poster">
          <p class="poster-top">A Beyond the Scoreboard game · 1934–1966</p>
          <h1 class="logo"><span class="logo-a" data-text="Tale">Tale</span><span class="logo-of">of the</span><span class="logo-b" data-text="Tape">Tape</span></h1>
          <div class="title-actions">
            ${saved ? `<button class="button big" data-act="continue">Continue: ${esc(E.fullName(saved.state.f))} <small>${esc(E.dateLabel(saved.state.t))} · ${esc(rec(saved.state.rec))}</small></button>` : ''}
            <button class="button big ${saved ? 'secondary' : ''}" data-act="new">Start a new career</button>
            <button class="button secondary" data-act="quick">Quick fight</button>
            <button class="button secondary" data-act="code">Same-start code</button>
          </div>
          <div class="poster-art"><div class="burst-wrap">${portraitCanvas({ skin: 3, hair: 0, cut: 'slick', trunks: 0, stache: false, brow: 1, jaw: 1.1 }, { mood: 'tough', bg: '#b8231b' }, 'poster-portrait', 260, 300)}</div>
            <div class="poster-bill"><span>Live a whole life in the ring</span><strong>One fighter.<br>Thirty years.<br>No two lives alike.</strong></div></div>
          <p class="poster-pitch">Start in 1934 with $20 and a pair of borrowed gloves. Train, take fights, dodge the mob, survive the war, step in front of the TV cameras, and find out what kind of story your life becomes.</p>
          <p class="poster-foot">Every fight is yours to box. Every year is real history. Saves stay on this computer.</p>
        </div>
        <aside class="title-side">
          <div class="now-showing">
            <div class="ns-marquee"><span>Now showing</span><b>Fight Night</b><span>Live</span></div>
            <div class="ns-frame">${reducedMotion ? `<div class="ns-still">${portraitCanvas({ skin: 5, hair: 0, cut: 'crop', trunks: 1, brow: 2, jaw: 1.15 }, { mood: 'tough', bg: '#1f3f8f' }, 'ns-portrait', 220, 200)}</div>` : '<div class="demo-host"></div>'}</div>
          </div>
          <div class="paper-card record-book">
            <div class="tabs" role="tablist" aria-label="Record book">
              ${[['how', 'How it plays'], ['disc', `Discoveries ${Object.keys(readBook()).length}/${T.discoveries.length}`], ['ach', `Achievements ${ach.length}/${D.ACHIEVEMENTS.length}`], ['hall', 'Hall of fame']].map(([k, n]) => `<button role="tab" class="tab ${tab === k ? 'on' : ''}" aria-selected="${tab === k}" data-act="ttab" data-arg="${k}">${n}</button>`).join('')}
            </div>
            <div class="tab-body">
              ${tab === 'how' ? `<ol class="how">
                <li><b>Live.</b> Each turn is a month: train, work, rest, or chase publicity.</li>
                <li><b>Fight.</b> Box it yourself, Punch-Out style, or listen on the radio.</li>
                <li><b>Survive history.</b> The Depression, Pearl Harbor, the color line, the mob, television.</li>
                <li><b>Discover.</b> Parts of a life combine into rare discoveries. Collect them all.</li>
                <li><b>Tell the story.</b> Retire, start a second act, and get the tale of your life.</li></ol>` : ''}
              ${tab === 'disc' ? discoveryBookCard(true) : ''}
              ${tab === 'ach' ? `<ul class="ach-list">${D.ACHIEVEMENTS.map((a) => `<li class="${ach.includes(a.id) ? 'got' : ''}">${ach.includes(a.id) ? '★' : '☆'} <b>${ach.includes(a.id) ? esc(a.name) : '???'}</b><small>${esc(a.text)}</small></li>`).join('')}</ul>` : ''}
              ${tab === 'hall' ? (hall.length ? `<ol class="hall">${hall.map((h) => `<li><b>${esc(h.name)}</b><span>${esc(h.record)} · ${esc(h.tier)}</span><small>${esc(h.years)}${h.belts ? ' · champion' : ''}</small></li>`).join('')}</ol>` : '<p class="empty">Nobody yet. Finish a career and your fighter hangs here.</p>') : ''}
            </div>
          </div>
        </aside>
      </section>
      <div class="ticker" aria-hidden="true"><div class="ticker-track">${heads}${heads}</div></div>`);
    startDemo();
  }

  // The title screen runs a real fight on its own, cycling through the decades.
  let demoCtl = null, demoN = 0;
  function startDemo() {
    const host = app.querySelector('.demo-host');
    if (!host || ui.screen !== 'title' || reducedMotion) return;
    const R = (a) => a[Math.floor(Math.random() * a.length)], N = (n) => Math.floor(Math.random() * n);
    const era = ['poster', 'newsreel', 'tv'][demoN++ % 3];
    const look = () => ({ skin: N(7), hair: N(7), cut: R(D.HAIRCUTS), trunks: N(8), stache: Math.random() < 0.3, brow: N(3), jaw: 1 + Math.random() * 0.15, build: 0.95 + Math.random() * 0.15, nose: N(3) });
    const style = R(['slugger', 'boxer', 'swarmer', 'counter', 'showman']);
    const rating = 52 + N(14);
    demoCtl = T.fight.start(host, {
      demo: true, era, rounds: 1, roundSeconds: 45, venue: R(['Madison Square Garden', 'Olympia Stadium', 'Chicago Stadium', 'Duquesne Gardens', 'the Olympic Auditorium']),
      you: { first: 'You', last: R(D.LAST), stats: { pow: 62, spd: 62, sta: 62, chn: 62, def: 62 }, look: look(), health: 100, heart: 60 },
      opp: { first: R(D.FIRST), last: R(D.LAST), style, rating, stats: E.opponentStats(rating, style), look: look() },
      onEnd: () => { demoCtl = null; setTimeout(() => { if (ui.screen === 'title') startDemo(); }, 400); },
    });
  }
  function stopDemo() { if (demoCtl) { const d = demoCtl; demoCtl = null; d.destroy(); } }

  function discoveryBookCard(bare) {
    const book = readBook(), n = Object.keys(book).length;
    return `<div class="${bare ? '' : 'paper-card '}book">${bare ? '' : `<h2 class="card-head">Discoveries <small>this computer</small></h2>`}
      <p class="ach-count"><b>${n}</b> of ${T.discoveries.length} found. Two parts of a life combine into something new.</p>
      <ul class="book-list">${T.discoveries.map((d) => book[d.id] ? `<li class="got"><b>${esc(d.name)}</b><small>${esc(d.mix[0])} + ${esc(d.mix[1])}</small></li>` : `<li><b>? + ?</b><small>${esc(d.hint)}</small></li>`).join('')}</ul></div>`;
  }

  // ---------- create ----------
  let draft = null;
  function newDraft(code) {
    const R = (a) => a[Math.floor(Math.random() * a.length)];
    return {
      first: R(D.FIRST), last: R(D.LAST), nick: '', home: R(Object.keys(D.CITIES)), division: R(['light', 'welter', 'middle']), style: R(Object.keys(D.STYLES)), bg: R(Object.keys(D.BACKGROUNDS)),
      look: { skin: Math.floor(Math.random() * D.SKINS.length), hair: Math.floor(Math.random() * D.HAIRS.length), cut: R(D.HAIRCUTS), trunks: Math.floor(Math.random() * D.TRUNKS.length), stache: Math.random() < 0.2, brow: Math.floor(Math.random() * 3), build: 1, jaw: 1, nose: Math.floor(Math.random() * 3) },
      code: code || '',
    };
  }
  function renderCreate() {
    if (!draft) draft = newDraft();
    const d = draft;
    const opt = (obj, cur) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
    const swatches = (arr, key) => arr.map((c, i) => `<button type="button" class="swatch ${d.look[key] === i ? 'on' : ''}" style="--c:${c}" data-look="${key}" data-v="${i}" aria-label="${key} color ${i + 1}" aria-pressed="${d.look[key] === i}"></button>`).join('');
    show(`
      <section class="create">
        <div class="create-head"><p class="kicker">Signing papers · ${D.START_YEAR}</p><h1>Who are you?</h1>${d.code ? `<p class="code-note">Same-start code <b>${esc(d.code)}</b>: everyone with this code starts in the same world.</p>` : ''}</div>
        <form class="create-grid" id="create-form" autocomplete="off">
          <div class="create-preview paper-card">
            ${portraitCanvas(d.look, { mood: 'tough' }, 'create-portrait', 220, 260)}
            <p class="preview-name">${esc(d.first)} ${d.nick ? `“${esc(d.nick)}” ` : ''}${esc(d.last)}</p>
            <p class="preview-sub">${esc(D.STYLES[d.style].name)} · ${esc(D.DIVISIONS[d.division].name)} · ${esc(D.CITIES[d.home].name)}</p>
            <button type="button" class="button secondary" data-act="randomize">Shuffle everything</button>
          </div>
          <div class="create-fields paper-card">
            <div class="row3">
              <label>First name<input name="first" maxlength="18" value="${esc(d.first)}" required></label>
              <label>Nickname <small>(optional)</small><input name="nick" maxlength="20" value="${esc(d.nick)}" placeholder="the papers will pick one"></label>
              <label>Last name<input name="last" maxlength="22" value="${esc(d.last)}" required></label>
            </div>
            <div class="row3">
              <label>Hometown<select name="home">${opt(D.CITIES, d.home)}</select></label>
              <label>Weight class<select name="division">${opt(D.DIVISIONS, d.division)}</select></label>
              <label>Where you came from<select name="bg">${opt(D.BACKGROUNDS, d.bg)}</select></label>
            </div>
            <p class="field-note">${esc(D.BACKGROUNDS[d.bg].blurb)} <span class="muted">No heavyweights: from 1937 to 1949 that title belongs to Joe Louis, and you'll hear about him.</span></p>
            <fieldset class="styles"><legend>Fighting style</legend>
              ${Object.entries(D.STYLES).map(([k, v]) => `<label class="style-card ${k === d.style ? 'on' : ''}"><input type="radio" name="style" value="${k}" ${k === d.style ? 'checked' : ''}><b>${esc(v.name)}</b><small>${esc(v.blurb)}</small></label>`).join('')}
            </fieldset>
            <fieldset class="looks"><legend>Look</legend>
              <div class="look-row"><span>Skin</span>${swatches(D.SKINS, 'skin')}</div>
              <div class="look-row"><span>Hair</span>${swatches(D.HAIRS, 'hair')}</div>
              <div class="look-row"><span>Trunks</span>${swatches(D.TRUNKS, 'trunks')}</div>
              <div class="look-row"><span>Haircut</span>${D.HAIRCUTS.map((c) => `<button type="button" class="chip ${d.look.cut === c ? 'on' : ''}" data-look="cut" data-v="${c}" aria-pressed="${d.look.cut === c}">${c}</button>`).join('')}<button type="button" class="chip ${d.look.stache ? 'on' : ''}" data-look="stache" data-v="toggle" aria-pressed="${!!d.look.stache}">mustache</button></div>
            </fieldset>
            <div class="create-actions"><button class="button big" type="submit">Sign the papers</button><button type="button" class="button secondary" data-act="title">Back</button></div>
          </div>
        </form>
      </section>`);
    const form = document.getElementById('create-form');
    form.addEventListener('input', (e) => {
      const f = e.target;
      if (!f.name) return;
      if (['first', 'last', 'nick'].includes(f.name)) { draft[f.name] = f.value; const n = app.querySelector('.preview-name'); if (n) n.textContent = `${draft.first} ${draft.nick ? `“${draft.nick}” ` : ''}${draft.last}`; return; }
      draft[f.name] = f.value; renderCreate();
      const again = app.querySelector(`[name="${f.name}"]`); again && again.focus();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const first = String(fd.get('first') || '').trim() || 'Johnny', last = String(fd.get('last') || '').trim() || 'Doyle';
      T.audio.unlock();
      S = E.create({ first, last, nick: String(fd.get('nick') || '').trim(), home: draft.home, division: draft.division, style: draft.style, bg: draft.bg, look: draft.look, code: draft.code || '' });
      draft = null; ui = { screen: 'game' };
      sfx('bell'); save();
      playScene('intro').then(render);
      announce(`Career started: ${E.fullName(S.f)}, ${D.START_YEAR}.`);
    });
  }

  // ---------- the ledger (between fights) ----------
  function fighterCard() {
    const age = E.age(S), injury = S.injury;
    return `<div class="fighter-card paper-card">
      <div class="fc-top">${portraitCanvas(S.f.look, { mood: S.rec.streak < -1 ? 'sad' : S.rec.streak > 2 ? 'happy' : 'tough', era: eraLook(), bruised: S.health < 50 }, 'fc-portrait', 200, 240)}
        <div class="fc-id"><p class="kicker">${esc(E.rankLabel(S))}</p><h2>${esc(S.f.first)} ${S.f.nick ? `<span class="nick">“${esc(S.f.nick)}”</span> ` : ''}${esc(S.f.last)}</h2>
        <p class="fc-rec"><b>${rec(S.rec)}</b> <span>${S.rec.ko} KO</span></p>
        <p class="fc-meta">Age ${age} · ${esc(D.DIVISIONS[S.f.division].name)} · ${esc(D.STYLES[S.f.style].name)}</p></div></div>
      <div class="stats">${statKeys.map((k) => statRow(k, S.st[k])).join('')}</div>
      <div class="life">
        <div class="lifebox"><span>Health ${delta(S.health, ui.prev && ui.prev.health, 0)}</span>${bar(S.health, 100, S.health < 40 ? 'warn' : '', ui.prev && ui.prev.health)}</div>
        <div class="lifebox"><span>Heart ${delta(S.heart, ui.prev && ui.prev.heart, 0)}</span>${bar(S.heart, 100, 'heart', ui.prev && ui.prev.heart)}</div>
        <div class="lifebox"><span>Ring sharp ${delta(S.sharp, ui.prev && ui.prev.sharp, 0)}</span>${bar(S.sharp, 100, 'sharp', ui.prev && ui.prev.sharp)}</div>
        <div class="lifebox"><span>Fame ${delta(S.fame, ui.prev && ui.prev.fame, 0)}</span>${bar(S.fame, 100, 'fame', ui.prev && ui.prev.fame)}<small>${esc(E.fameLabel(S.fame))}</small></div>
      </div>
      <div class="purse-line"><span>Bank</span><b class="${S.money < 0 ? 'neg' : ''}" data-count="${Math.round(S.money)}" data-from="${Math.round(ui.prev ? ui.prev.money : S.money)}">${money(ui.prev ? ui.prev.money : S.money)}</b><small>costs ${money(E.monthlyCost(S))}/mo</small></div>
      ${injury ? `<p class="injury">Injured: ${esc(injury.name)} · ${Math.ceil(injury.weeks)} weeks</p>` : ''}
      ${S.champ ? `<p class="belt">★ World ${esc(D.DIVISIONS[S.f.division].name)} Champion${S.titleDefenses ? ` · ${S.titleDefenses} defense${S.titleDefenses > 1 ? 's' : ''}` : ''}</p>` : ''}
    </div>`;
  }
  function rankingsCard() {
    const champ = E.champion(S), list = E.rankings(S).slice(0, 10), pr = E.playerRank(S);
    const rival = E.rival(S);
    const row = (r, i) => {
      if (r.id === 0) return `<li class="you"><span class="rk">${i + 1}</span><b>${esc(S.f.last)} (you)</b><small>${rec(S.rec)}</small></li>`;
      const f = r.f; return `<li class="${f.id === S.people.rival ? 'rival' : ''}"><span class="rk">${i + 1}</span><b>${esc(f.first)} ${esc(f.last)}</b><small>${f.w}–${f.l}${f.id === S.people.rival ? ' · rival' : ''}</small></li>`;
    };
    return `<div class="paper-card rankings">
      <h2 class="card-head">${esc(D.DIVISIONS[S.f.division].name)} ratings <small>${esc(E.shortDate(S.t))}</small></h2>
      <p class="champ-line">${S.champ ? `<b>Champion: YOU</b>` : champ ? `<b>Champion:</b> ${esc(E.fullName(champ))} <small>${champ.w}–${champ.l}</small>` : '<b>Title vacant</b>'}</p>
      <ol>${list.map(row).join('')}</ol>
      ${!pr || pr > 10 ? `<p class="unranked">You: unranked${pr ? ` (#${pr})` : ''}. Beat ranked fighters to climb.</p>` : ''}
      ${rival && rival.active && S.flags.rival_met ? `<p class="rival-line">Rival: ${esc(E.fullName(rival))}, ${rival.w}–${rival.l}${S.flags.rival_fights ? ` · you are ${S.flags.rival_wins || 0}–${(S.flags.rival_fights || 0) - (S.flags.rival_wins || 0)} against him` : ''}</p>` : ''}
    </div>`;
  }
  function peopleCard() {
    const p = S.people;
    return `<div class="paper-card people"><h2 class="card-head">Your corner</h2>
      <ul>
        <li><span>Trainer</span><b>${esc(p.trainer.name)}</b><small>${esc(p.trainer.trait)}</small></li>
        <li><span>Manager</span><b>${S.flags.self_managed ? 'You' : esc(p.manager.name)}</b><small>${S.flags.self_managed ? 'no cut' : '33% of every purse'}</small></li>
        ${S.flags.tate_met ? `<li><span>Gym</span><b>Deacon Tate</b><small>${S.flags.tate_friend ? 'friend' : 'the best in the building'}</small></li>` : ''}
        ${p.sweetheart ? `<li><span>${S.flags.married ? 'Married' : 'Sweetheart'}</span><b>${esc(p.sweetheart.name)}</b></li>` : ''}
        <li><span>Home</span><b>${esc(p.family.name)}</b><small>${p.family.allowance ? 'you send money monthly' : 'writes every week'}</small></li>
      </ul></div>`;
  }
  function wire(n = 7) {
    const items = S.journal.slice(-n).reverse();
    return `<div class="wire paper-card"><h2 class="card-head">The wire</h2><ul>${items.map((j) => `<li class="k-${j.kind}"><span>${esc(E.shortDate(j.t))}</span>${esc(j.text)}</li>`).join('')}</ul><button class="linkish" data-act="journal">Whole journal</button></div>`;
  }
  function dateBanner() {
    const era = E.era(S.t);
    return `<div class="date-banner"><div class="db-date"><span class="db-month">${esc(E.dateLabel(S.t).split(' ')[0])}</span><span class="db-year">${E.year(S.t)}</span></div><div class="db-era"><b>${esc(era.name)}</b><small>${esc(era.blurb)}</small></div></div>${trail()}`;
  }
  // The trail: where this life is between 1934 and 1966, with history's landmarks along the way.
  const LANDMARKS = [[1935.3, 'Dust Bowl'], [1937.5, 'Louis is champ'], [1941.95, 'Pearl Harbor'], [1945.6, 'War ends'], [1947.3, 'Robinson'], [1949.5, 'TV fights'], [1954.4, 'Brown v. Board'], [1960.7, 'Clay wins gold']];
  function trail() {
    const span = D.END_YEAR - D.START_YEAR;
    const now = S.t / 52;
    const pct = (y) => Math.max(0, Math.min(100, ((y - D.START_YEAR) / span) * 100));
    const marks = S.fights.map((f) => `<i class="tf r-${f.result}${f.title ? ' t' : ''}" style="left:${pct(D.START_YEAR + f.t / 52).toFixed(2)}%"></i>`).join('');
    return `<div class="trail" aria-label="Your life so far: ${esc(E.dateLabel(S.t))}, on a timeline from ${D.START_YEAR} to ${D.END_YEAR}">
      <div class="trail-line"><span class="trail-done" style="width:${pct(D.START_YEAR + now).toFixed(2)}%"></span>${marks}
      ${LANDMARKS.map(([y, n], i) => `<span class="lm ${i % 2 ? 'low' : ''} ${D.START_YEAR + now >= y ? 'past' : ''}" style="left:${pct(y).toFixed(2)}%"><b>${esc(n)}</b></span>`).join('')}
      <span class="trail-you" style="left:${pct(D.START_YEAR + now).toFixed(2)}%;--c:${D.TRUNKS[S.f.look.trunks] || '#b8231b'}" title="You are here"></span></div>
      <div class="trail-ends"><span>${D.START_YEAR}</span><span>${D.END_YEAR}</span></div></div>`;
  }
  function renderLedger() {
    const early = S.fights.length < 12;
    queueMicrotask(() => { ui.prev = null; });
    const tv = E.tvEra(S.t);
    const act = (a, arg, title, sub, cls = '', ic) => `<button class="action ${cls}" data-act="${a}" ${arg ? `data-arg="${arg}"` : ''}>${icon(ic || arg || a)}<b>${title}</b><small>${sub}</small></button>`;
    const last = ui.lastLines && ui.lastLines.length ? `<div class="last-month" role="status"><span class="kicker">Last month</span>${ui.lastLines.map((l) => `<p>${esc(l)}</p>`).join('')}</div>` : '';
    show(`
      <section class="ledger">
        ${dateBanner()}
        <div class="ledger-grid">
          <div class="col-left">${fighterCard()}</div>
          <div class="col-mid">
            <div class="paper-card actions-card">
              <h1 class="card-head big" data-focus tabindex="-1">What do you do this month?</h1>
              ${last}
              <button class="action primary" data-act="offers">${icon('fight')}<b>${S.champ ? 'Defend the title' : 'Look for a fight'}</b><small>See who wants you and for how much</small></button>
              <p class="group-label">Train <small>one month</small></p>
              <div class="action-grid">
                ${act('train', 'roadwork', 'Roadwork', 'Stamina')}
                ${act('train', 'bag', 'Heavy bag', 'Power')}
                ${act('train', 'speed', 'Speed bag & rope', 'Speed')}
                ${act('train', 'spar', 'Sparring', 'Defense, sharpness · some risk')}
                ${act('train', 'chin', 'Neck & body work', 'Chin')}
              </div>
              <p class="group-label">Live <small>one month</small></p>
              <div class="action-grid">
                ${act('work', '', 'Work a job', 'Money')}
                ${act('rest', '', 'Rest', 'Health, heart')}
                ${act('press', '', tv ? 'TV & publicity' : 'Publicity', 'Fame', '', tv ? 'tv' : 'press')}
                ${early ? act('circuit', '', 'Club circuit', 'Three quick fights on the radio') : ''}
              </div>
              <div class="ledger-foot"><button class="linkish" data-act="retire-ask">Retire</button></div>
            </div>
            ${wire()}
          </div>
          <div class="col-right">${rankingsCard()}${peopleCard()}</div>
        </div>
      </section>`);
  }

  // ---------- events ----------
  function renderEvent() {
    const item = S.inbox[0];
    const v = E.render(S, item);
    if (!v) { S.inbox.shift(); return render(); }
    if (v.kind === 'discovery') return renderDiscovery(v);
    const isHist = v.kind === 'history';
    const LETTERS = ['ma_letter', 'svc_letter', 'loan_back', 'buddy_diner', 'wedding', 'aft_tate', 'rival_retires', 'baby', 'aft_memoir'];
    const WIRES = ['draft_notice', 'broke', 'shark_due', 'strip_warning', 'ibc_offer', 'too_old', 'doctor_final', 'contract', 'spar_job', 'tv_friday', 'mob_fix', 'mob_revenge', 'young_lion', 'move_ny', 'trainer_poached', 'aft_comeback', 'homecoming', 'svc_orders'];
    const look = isHist ? 'newspaper' : LETTERS.includes(v.id) ? 'letter' : WIRES.includes(v.id) ? 'telegram' : 'note';
    const yr = E.year(S.t);
    const paper = isHist ? (yr < 1941 ? 'The Evening Telegram' : yr < 1950 ? 'The Daily Clarion' : 'The Morning Ledger') : '';
    if (isHist) sfx('page');
    show(`
      <section class="event ${isHist ? 'history' : 'personal'}">
        ${dateBanner()}
        <article class="event-card ${look}">
          ${isHist ? `<header class="masthead"><span>${esc(E.dateLabel(S.t))}</span><b>${esc(paper)}</b><span>${esc(v.kicker || 'Extra')} · 3¢</span></header>` : look === 'telegram' ? `<header class="wire-head"><b>TELEGRAM</b><span>${esc(E.dateLabel(S.t).toUpperCase())} · ${esc((D.CITIES[S.city] || D.CITIES[S.f.home]).name.toUpperCase())}</span></header>` : look === 'letter' ? `<p class="letter-date">${esc(E.dateLabel(S.t))}</p>` : `<p class="kicker">${esc(v.kicker || E.dateLabel(S.t))}</p>`}
          <h1 class="event-title" tabindex="-1">${esc(v.title)}</h1>
          <div class="event-body">${isHist && v.art ? `<div class="event-art art-${esc(v.art)}" aria-hidden="true"></div>` : ''}<p>${esc(v.text)}</p></div>
          ${v.archive ? `<aside class="archive"><b>From the archive</b><p>${esc(v.archive)}</p></aside>` : ''}
          ${v.link ? `<p class="event-link"><a href="${esc(v.link.href)}" target="_blank" rel="noopener">${esc(v.link.label)} ↗</a></p>` : ''}
          <div class="choices" role="group" aria-label="Your choice">
            ${v.choices.length ? v.choices.map((c, i) => `<button class="choice" data-choice="${i}" ${c.ok ? '' : 'disabled'}><kbd class="ck" aria-hidden="true">${i + 1}</kbd><b>${esc(c.label)}</b>${c.hint ? `<small>${esc(c.hint)}</small>` : ''}${c.ok ? '' : '<small class="locked">not available</small>'}</button>`).join('') : `<button class="choice" data-choice="0"><b>Turn the page</b></button>`}
          </div>
          <div class="outcome" hidden></div>
        </article>
      </section>`);
  }
  function readBook() { return readJSON(BOOK) || {}; }
  function renderDiscovery(v) {
    const book = readBook();
    const first = !book[v.id];
    if (first) { book[v.id] = { by: E.fullName(S.f), year: E.year(S.t) }; writeJSON(BOOK, book); }
    const count = Object.keys(book).length, total = T.discoveries.length;
    sfx('star', 1);
    show(`
      <section class="event discovery">
        ${dateBanner()}
        <article class="event-card disc-card">
          <p class="kicker">New discovery</p>
          <div class="recipe" aria-label="${esc(v.mix[0])} plus ${esc(v.mix[1])} makes ${esc(v.title)}"><span class="ing">${esc(v.mix[0])}</span><b aria-hidden="true">+</b><span class="ing">${esc(v.mix[1])}</span><b aria-hidden="true">=</b></div>
          <h1 class="event-title disc-name" tabindex="-1">${esc(v.title)}</h1>
          <p class="disc-first">${first ? '★ First time anyone on this computer has found this one.' : `Already in the book: first found by ${esc(book[v.id].by)} in ${book[v.id].year}.`} <b>${count} of ${total}</b> discoveries found here.</p>
          <div class="event-body"><p>${esc(v.text)}</p></div>
          <div class="choices"><button class="choice" data-choice="0"><b>Add it to the book</b></button></div>
          <div class="outcome" hidden></div>
        </article>
      </section>`);
  }
  function chooseEvent(i) {
    if (!ui.prev) ui.prev = snap();
    const card = app.querySelector('.event-card');
    const res = E.resolveInbox(S, i);
    save();
    const out = card.querySelector('.outcome');
    card.querySelectorAll('.choice').forEach((b) => { b.disabled = true; if (b.dataset.choice === String(i)) b.classList.add('picked'); });
    if (res && res.text) {
      out.innerHTML = `<p>${esc(res.text)}</p><button class="button" data-act="next">Continue</button>`;
      out.hidden = false; out.querySelector('button').focus();
      announce(res.text);
    } else render();
  }

  // ---------- offers ----------
  function poster(o, i) {
    const opp = o.opp, lvl = { smoker: 'Smoker', club: 'Club fight', prelim: 'Prelim', main: 'Main event', ranked: 'Ranked bout', eliminator: 'Title eliminator', title: 'World title' }[o.level];
    const rank = opp.id > 0 ? E.rankOf(S, opp.id) : null;
    const look = { smoker: 'paper', club: 'paper', prelim: 'paper', main: 'red', ranked: 'red', eliminator: 'gold', title: 'gold' }[o.level];
    return `<article class="fight-poster p-${look} ${o.crooked ? 'crooked' : ''}">
      <p class="fp-venue">${esc(o.venue)}<span>${esc(o.city)}</span></p>
      <p class="fp-level">${lvl}${o.rounds ? ` · ${o.rounds} rounds` : ''}</p>
      <div class="fp-face">${portraitCanvas(opp.look, { mood: 'tough', bg: look === 'gold' ? '#e0a526' : look === 'red' ? '#1a1612' : '#b8231b' }, 'fp-portrait', 150, 170)}</div>
      <h3>${esc(opp.first)} ${opp.nick ? `<span>“${esc(opp.nick)}”</span> ` : ''}${esc(opp.last)}</h3>
      <p class="fp-rec">${oppRec(opp)}${opp.ko ? ` · ${opp.ko} KO` : ''}${rank === 0 ? ' · CHAMPION' : rank && rank <= 10 ? ` · ranked #${rank}` : ''}</p>
      <p class="fp-style">${esc((D.STYLES[opp.style] || { name: opp.style === 'dirty' ? 'Dirty fighter' : 'Showman' }).name)} · from ${esc(opp.city)}</p>
      ${o.tags.length ? `<p class="fp-tags">${o.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</p>` : ''}
      ${o.note ? `<p class="fp-note">${esc(o.note)}</p>` : ''}
      <dl class="fp-terms"><div><dt>Purse</dt><dd>${money(o.purse)}</dd></div><div><dt>Fight in</dt><dd>${o.weeks} wk</dd></div><div><dt>Danger</dt><dd>${danger(opp)}</dd></div></dl>
      <button class="button" data-act="accept" data-arg="${o.id}">Sign for this fight</button>
    </article>`;
  }
  function danger(opp) {
    const d = opp.rating - E.overall(S);
    return d > 10 ? '☠☠☠' : d > 4 ? '☠☠' : d > -4 ? '☠' : 'low';
  }
  function renderOffers() {
    const offers = E.offers(S);
    show(`
      <section class="offers">
        ${dateBanner()}
        <h1 class="screen-title" tabindex="-1">${S.champ ? 'Challengers for your title' : 'Fight offers'}</h1>
        <p class="screen-sub">Your manager spreads the posters on the table. ${S.fights.length === 0 ? 'Your first fight. Take something you can win.' : 'Danger is how he stacks up against you right now.'}</p>
        <div class="posters">${offers.map(poster).join('')}</div>
        <div class="center-row"><button class="button secondary" data-act="decline">Not now. Back to the gym</button></div>
      </section>`);
  }

  // ---------- training camp ----------
  function renderCamp() {
    const c = S.camp, o = c.offer, left = c.blocks - c.done.length;
    queueMicrotask(() => { ui.prev = null; });
    const opt = (k, title, sub) => `<button class="action" data-act="camp" data-arg="${k}"><b>${title}</b><small>${sub}</small></button>`;
    show(`
      <section class="camp">
        ${dateBanner()}
        <div class="camp-grid">
          <div class="paper-card camp-main">
            <p class="kicker">Training camp · ${left} ${left === 1 ? 'block' : 'blocks'} until fight night</p>
            <h1 class="card-head big" tabindex="-1">Getting ready for ${esc(o.opp.last)}</h1>
            <p>${esc(o.venue)}, ${esc(o.city)} · ${o.rounds} rounds · purse ${money(o.purse)}</p>
            <ol class="camp-track">${Array.from({ length: c.blocks }, (_, i) => `<li class="${i < c.done.length ? 'done' : i === c.done.length ? 'now' : ''}">${i < c.done.length ? esc(E.CAMP[c.done[i]].name) : i === c.done.length ? 'this block' : '…'}</li>`).join('')}<li class="fight-night">fight night</li></ol>
            ${ui.lastLines && ui.lastLines.length ? `<div class="last-month" role="status">${ui.lastLines.map((l) => `<p>${esc(l)}</p>`).join('')}</div>` : ''}
            <div class="action-grid">
              ${opt('roadwork', 'Roadwork', 'Stamina')}
              ${opt('bag', 'Heavy bag', 'Power')}
              ${opt('speed', 'Speed bag', 'Speed')}
              ${opt('spar', 'Sparring', 'Defense · sharpness')}
              ${opt('scout', 'Study the opponent', c.scout ? 'Learn more of his habits' : 'Learn his tells')}
              ${opt('rest', 'Rest', 'Health · heart')}
              ${opt('press', 'Hype the fight', 'Fame · bigger purse')}
            </div>
          </div>
          <div class="col-right">${fighterCard()}</div>
        </div>
      </section>`);
  }

  // ---------- tale of the tape ----------
  function renderPrefight() {
    const o = S.camp.offer, opp = o.opp, os = E.opponentStats(opp.rating, opp.style);
    const scout = S.camp.scout > 0 || S.fights.some((f) => f.oppId && f.oppId === opp.id);
    const div = D.DIVISIONS[S.f.division];
    const row = (label, a, b) => `<tr><td>${a}</td><th>${label}</th><td>${b}</td></tr>`;
    const statCompare = (k) => `<tr class="cmp"><td>${bar(S.st[k])}<b>${Math.round(S.st[k])}</b></td><th>${E.statLabel[k]}</th><td>${scout ? `${bar(os[k], 100, 'opp')}<b>${os[k]}</b>` : '<span class="unknown">? study him in camp</span>'}</td></tr>`;
    const dive = o.crooked && S.flags.dive_pending;
    const media = E.year(S.t) < 1946 ? 'Listen on the radio' : E.tvEra(S.t) ? 'Watch it on TV' : 'Watch the newsreel';
    show(`
      <section class="tape">
        <h1 class="tape-title" tabindex="-1"><span>Tale of the</span> Tape</h1>
        <p class="tape-sub">${esc(o.venue)} · ${esc(o.city)} · ${esc(E.dateLabel(S.t))}${o.title ? ' · for the world championship' : ''}${o.tv ? ' · live on television' : ''}</p>
        <div class="tape-grid">
          <div class="tape-side you">${portraitCanvas(S.f.look, { mood: 'tough', era: eraLook() }, 'tape-portrait', 200, 240)}<h2>${esc(S.f.first)} ${esc(S.f.last)}</h2><p>${S.f.nick ? `“${esc(S.f.nick)}”` : '&nbsp;'}</p></div>
          <table class="tape-table"><tbody>
            ${row('Record', rec(S.rec), oppRec(opp))}
            ${row('Knockouts', S.rec.ko, opp.ko || 0)}
            ${row('Age', E.age(S), opp.age)}
            ${row('Height', `${Math.floor(S.f.height / 12)}′${S.f.height % 12}″`, `${Math.floor((opp.height || 68) / 12)}′${(opp.height || 68) % 12}″`)}
            ${row('Reach', `${S.f.reach}″`, `${opp.reach || 70}″`)}
            ${row('Weight', `${div.limit - Math.floor(Math.random() * 3)} lb`, `${div.limit - Math.floor(Math.random() * 3)} lb`)}
            ${row('Style', esc(D.STYLES[S.f.style].name), esc((D.STYLES[opp.style] || { name: opp.style === 'dirty' ? 'Dirty fighter' : 'Showman' }).name))}
            ${statKeys.map(statCompare).join('')}
          </tbody></table>
          <div class="tape-side opp">${portraitCanvas(opp.look, { mood: 'tough', era: eraLook() }, 'tape-portrait', 200, 240)}<h2>${esc(opp.first)} ${esc(opp.last)}</h2><p>${opp.nick ? `“${esc(opp.nick)}”` : '&nbsp;'}</p></div>
        </div>
        <p class="tape-quirk">${esc(opp.last)} ${esc(opp.quirk)}. At the weigh-in he says: <q>${esc(opp.trash)}</q></p>
        ${scout ? `<p class="tape-scout"><b>Scouting report:</b> ${esc(E.scoutLine(opp))}</p>` : ''}
        ${dive ? `<div class="dive-box"><p><b>The fix is in.</b> You agreed to go down in the sixth.</p><div class="center-row"><button class="button danger" data-act="dive">Take the dive</button><button class="button" data-act="doublecross">Fight for real</button></div></div>` : `
        <div class="tape-actions">
          <button class="button big" data-act="play">Box it yourself</button>
          <button class="button secondary big" data-act="sim">${media}</button>
        </div>
        <p class="assist-row">Fight help: ${['rookie', 'normal', 'champ'].map((a) => `<button class="chip ${settings.assist === a ? 'on' : ''}" data-act="assist" data-arg="${a}" aria-pressed="${settings.assist === a}">${{ rookie: 'Rookie (tells labeled, slower)', normal: 'Contender', champ: 'Champion (no help)' }[a]}</button>`).join('')}</p>`}
      </section>`);
  }

  function playedRounds(o) { return { smoker: 2, club: 2, prelim: 3, main: 3, ranked: 3, eliminator: 4, title: 5 }[o.level] || 3; }
  function startFight(practice) {
    const o = practice ? practice.offer : S.camp.offer;
    const youSrc = practice ? practice.you : { first: S.f.first, last: S.f.last, nick: S.f.nick, stats: roundStats(S.st), look: S.f.look, health: S.health, heart: S.heart };
    const opp = o.opp;
    ui.screen = 'fight';
    const era = practice ? practice.era : eraLook();
    document.body.classList.add('fighting');
    app.innerHTML = `<section class="fight-screen"><h1 class="sr">Fight: ${esc(youSrc.last)} versus ${esc(opp.last)}</h1><div class="fight-wrap"></div></section>`;
    const host = app.querySelector('.fight-wrap');
    T.audio.unlock();
    fightCtl = T.fight.start(host, {
      you: youSrc, opp: { first: opp.first, last: opp.last, nick: opp.nick, style: opp.style, rating: opp.rating, stats: E.opponentStats(opp.rating, opp.style), look: opp.look },
      rounds: practice ? practice.rounds : playedRounds(o), era, title: o.title, venue: `${o.venue}, ${o.city}`,
      trainer: practice ? 'Your trainer' : S.people.trainer.name, assist: settings.assist, reducedMotion,
      firstFight: practice ? true : S.c.played === 0,
      onEnd: (out) => { fightCtl = null; document.body.classList.remove('fighting'); practice ? endPractice(out, practice) : afterLiveFight(out); },
    });
  }
  function roundStats(st) { const r = {}; for (const k of statKeys) r[k] = Math.round(st[k]); return r; }

  function afterLiveFight(out) {
    const o = S.camp.offer;
    S.c.played++;
    let final = out;
    if (out.how === 'radio') {
      final = E.simFight(S, o, { bonus: out.radioLead || 0 });
      final.kdFor += out.kdFor; final.kdAgainst += out.kdAgainst; final.played = true;
      ui.radioLines = final.lines; ui.radioOut = final;
    }
    const played = playedRounds(o);
    if (out.how !== 'radio') final.round = (final.method === 'KO' || final.method === 'TKO') ? Math.max(1, Math.min(o.rounds, Math.round((out.round / played) * o.rounds - Math.random() * 1.5))) : o.rounds;
    const clip = E.resolveFight(S, o, final);
    ui.clip = clip; ui.prefight = false;
    ui.screen = out.how === 'radio' ? 'radio' : 'clipping';
    save();
    if (clip.titleWon && out.how !== 'radio') { ui.champShown = true; playScene('champion', { venue: `${o.venue}, ${o.city}` }).then(render); return; }
    render();
  }
  function simAndShow(dive) {
    const o = S.camp.offer;
    const out = dive ? E.takeDive(S, o) : E.simFight(S, o);
    ui.radioLines = out.lines; ui.radioOut = out;
    ui.clip = E.resolveFight(S, o, out);
    ui.prefight = false; ui.screen = 'radio';
    save(); render();
  }

  // ---------- the radio call ----------
  function renderRadio() {
    const out = ui.radioOut, lines = ui.radioLines || [];
    const look = eraLook();
    const medium = look === 'tv' ? 'Live on television' : look === 'newsreel' ? 'The newsreel' : 'On the radio';
    show(`
      <section class="radio ${look}">
        <div class="radio-set">
          <p class="kicker">${medium}</p>
          <h1 class="screen-title" tabindex="-1">${esc(ui.clip ? ui.clip.sub : '')}</h1>
          <ol class="call">${lines.map((l, i) => `<li style="--d:${reducedMotion ? 0 : i * 0.9}s"><span>Rd ${l.r}</span>${esc(l.text)}</li>`).join('')}</ol>
          <p class="call-result" style="--d:${reducedMotion ? 0 : lines.length * 0.9}s">${out.result === 'W' ? 'You win' : out.result === 'L' ? 'You lose' : 'Draw'} · ${esc(E.methodText(out))}</p>
          <div class="center-row"><button class="button" data-act="to-clip">See the morning paper</button></div>
        </div>
      </section>`);
    if (out.result === 'W') setTimeout(() => sfx('roar', 0.6), reducedMotion ? 0 : lines.length * 900);
  }

  // ---------- the morning paper ----------
  function renderClipping() {
    const c = ui.clip;
    if (!c) { ui.screen = 'game'; return render(); }
    sfx('page');
    const p = c.purse;
    show(`
      <section class="clipping-screen">
        <article class="clipping">
          <header class="masthead"><span>${esc(E.dateLabel(S.t))}</span><b>${esc(S.people.reporter.paper.replace(/^the /i, 'The '))}</b><span>Sports · 3¢</span></header>
          <h1 tabindex="-1" class="${c.result === 'W' ? 'win' : c.result === 'L' ? 'loss' : ''}">${esc(c.headline)}</h1>
          <p class="clip-sub">${esc(c.sub)}</p>
          <div class="clip-body">
            ${portraitCanvas(S.f.look, { mood: c.result === 'W' ? 'happy' : c.result === 'L' ? 'sad' : 'tough', era: eraLook(), bruised: c.result === 'L', bg: '#d9cba6' }, 'clip-portrait', 160, 190)}
            <div><p class="byline">${esc(c.byline)}</p><p>${esc(c.body)}</p>
            ${c.titleWon ? '<p class="stamp">NEW CHAMPION</p>' : c.titleLost ? '<p class="stamp loss">TITLE LOST</p>' : ''}</div>
          </div>
          <table class="purse-table"><caption>Where the purse went</caption><tbody>
            <tr><th>Purse</th><td>${money(p.gross)}</td></tr>
            ${p.manager ? `<tr><th>Manager (${esc(p.managerName)}), one third</th><td>−${money(p.manager)}</td></tr>` : ''}
            <tr><th>Trainer (${esc(p.trainerName)}), 10%</th><td>−${money(p.trainer)}</td></tr>
            <tr><th>Camp, travel, cutman</th><td>−${money(p.expenses)}</td></tr>
            <tr class="net"><th>You keep</th><td>${money(p.net)}</td></tr>
          </tbody></table>
          ${c.changes.length ? `<p class="changes">${c.changes.map((x) => `<span>${esc(x)}</span>`).join('')}</p>` : ''}
          <div class="center-row"><button class="button" data-act="from-clip">Back to the gym</button></div>
        </article>
      </section>`);
    if (c.result === 'W' && p.net > 0) setTimeout(() => sfx('cash', 0.6), 400);
  }

  // ---------- circuit results ----------
  function renderCircuit() {
    const rs = ui.circuit;
    show(`
      <section class="radio poster">
        <div class="radio-set">
          <p class="kicker">The club circuit</p>
          <h1 class="screen-title" tabindex="-1">Three towns, three fights</h1>
          <ol class="call circuit">${rs.map((x) => `<li><span>${esc(x.offer.city)}</span><b>${x.out.result === 'W' ? 'Won' : x.out.result === 'L' ? 'Lost' : 'Drew'}</b> vs ${esc(x.offer.opp.first)} ${esc(x.offer.opp.last)} (${esc(E.methodText(x.out))}) · kept ${money(x.r.purse.net)}<br><small>${esc(x.out.lines[x.out.lines.length - 1].text)}</small></li>`).join('')}</ol>
          <div class="center-row"><button class="button" data-act="circuit-done">Back to the gym</button></div>
        </div>
      </section>`);
  }

  // ---------- war ----------
  function renderService() {
    const sv = S.service || {};
    const months = Math.round((S.t - sv.start) / 4.33);
    show(`
      <section class="service">
        ${dateBanner()}
        <div class="paper-card service-card">
          <p class="kicker">In uniform · ${esc(sv.branch || 'Army')}${sv.theater ? ` · ${esc(sv.theater)}` : ''}</p>
          <h1 class="card-head big" tabindex="-1">${months < 2 ? 'You report for duty' : `${months} months in`}</h1>
          <p>Your boxing career is on hold. Your body is getting harder and your timing is getting rusty. ${sv.how === 'exhibition' ? 'You box exhibitions for soldiers on bases and in hospitals.' : ''}</p>
          <div class="action-grid one"><button class="action primary" data-act="service"><b>The next three months</b><small>Time passes. Letters, orders, history.</small></button></div>
        </div>
        ${wire(6)}
      </section>`);
  }

  // ---------- retirement & second act ----------
  function renderPaths() {
    show(`
      <section class="paths">
        ${dateBanner()}
        <h1 class="screen-title" tabindex="-1">The last bell</h1>
        <p class="screen-sub">${esc(E.fullName(S.f))} retires at ${E.age(S)} with a record of ${rec(S.rec)} and ${money(S.money)} in the bank. What comes next?</p>
        <div class="path-grid">${Object.entries(E.PATHS).map(([k, p]) => { const ok = p.ok(S); return `<button class="action path ${ok ? '' : 'locked'}" data-act="path" data-arg="${k}" ${ok ? '' : 'disabled'}><b>${esc(p.name)}</b><small>${esc(p.blurb)}</small>${ok ? '' : `<em>${esc(pathNeed(k))}</em>`}</button>`; }).join('')}</div>
      </section>`);
  }
  function pathNeed(k) { return { gym: 'Needs money or the GI Bill', referee: 'Needs a good reputation and 15+ fights', broadcaster: 'Needs fame', promoter: 'Needs fame and money', business: 'Needs money', politics: 'Needs fame and a clean reputation' }[k] || ''; }
  function renderAfter() {
    const a = S.after;
    show(`
      <section class="after">
        ${dateBanner()}
        <div class="after-grid">
          <div class="paper-card">
            <p class="kicker">Life after boxing · ${esc(E.PATHS[a.path].name)}</p>
            <h1 class="card-head big" tabindex="-1">${a.years === 0 ? 'A new life' : `${a.years} year${a.years === 1 ? '' : 's'} out of the ring`}</h1>
            <p>Age ${E.age(S)} · ${money(S.money)} in the bank · record ${rec(S.rec)}</p>
            <div class="action-grid one"><button class="action primary" data-act="after"><b>Live the next stretch</b><small>A year or more passes</small></button>
            <button class="action" data-act="finish"><b>Close the book</b><small>See the tale of your life now</small></button></div>
          </div>
          ${wire(8)}
        </div>
      </section>`);
  }

  // ---------- the end ----------
  function renderFinal() {
    const L = E.legacy(S), story = E.tellStory(S), qs = E.discussion(S);
    const hall = readJSON(HALL) || [];
    if (!S.flags.hall_saved) {
      S.flags.hall_saved = true;
      hall.unshift({ name: E.fullName(S.f), record: rec(S.rec), tier: L.tier, years: `${D.START_YEAR}–${E.year(S.retireT || S.t)}`, belts: S.belts, legacy: L.total });
      writeJSON(HALL, hall.slice(0, 20)); save();
    }
    const years = {};
    for (const f of S.fights) { const y = E.year(f.t); (years[y] = years[y] || []).push(f); }
    const allYears = []; for (let y = D.START_YEAR; y <= E.year(S.retireT || S.t); y++) allYears.push(y);
    show(`
      <section class="final">
        <article class="final-paper">
          <header class="masthead"><span>${esc(E.dateLabel(S.t))}</span><b>The Tale of the Tape</b><span>Final edition</span></header>
          <h1 tabindex="-1">${esc(S.f.first.toUpperCase())} ${S.f.nick ? `“${esc(S.f.nick.toUpperCase())}” ` : ''}${esc(S.f.last.toUpperCase())}</h1>
          <p class="final-dek">${esc(D.DIVISIONS[S.f.division].name)} · ${rec(S.rec)} · ${S.rec.ko} KOs${S.belts ? ` · ${S.belts > 1 ? S.belts + '-time ' : ''}world champion` : ''} · ${esc(L.tier)}</p>
          <div class="final-top">
            ${portraitCanvas(S.f.look, { mood: L.total > 120 ? 'happy' : 'tough', era: 'poster' }, 'final-portrait', 220, 260)}
            <div class="story"><h2>In my own words</h2><p>${esc(story)}</p></div>
          </div>
          <div class="final-cols">
            <div class="legacy"><h2>Legacy <b>${L.total}</b></h2><table>${L.parts.map((p) => `<tr><th>${esc(p.label)}</th><td>${p.n > 0 ? '+' : ''}${p.n}</td></tr>`).join('')}</table></div>
            <div class="timeline"><h2>Fight by fight</h2><ol>${allYears.map((y) => `<li><span>${y}</span>${(years[y] || []).map((f) => `<i class="r-${f.result}${f.title ? ' t' : ''}" title="${esc(`${f.result} vs ${f.opp}, ${E.methodText(f)}`)}"></i>`).join('') || (S.flags.veteran && y >= 1942 && y <= 1945 ? '<em>in uniform</em>' : '')}</li>`).join('')}</ol><p class="legend"><i class="r-W"></i> win <i class="r-L"></i> loss <i class="r-D"></i> draw <i class="r-W t"></i> title fight</p></div>
          </div>
          <div class="final-cols">
            <div class="ach"><h2>Discoveries this career</h2>${(S.disc || []).length ? `<ul>${S.disc.map((id) => { const d = T.discoveryById(id); return d ? `<li>◆ <b>${esc(d.name)}</b> <small>${esc(d.mix[0])} + ${esc(d.mix[1])}</small></li>` : ''; }).join('')}</ul>` : '<p>None this time.</p>'}
            <h2>Achievements this career</h2>${S.ach.length ? `<ul>${S.ach.map((id) => { const a = D.ACHIEVEMENTS.find((x) => x.id === id); return a ? `<li>★ <b>${esc(a.name)}</b> <small>${esc(a.text)}</small></li>` : ''; }).join('')}</ul>` : '<p>None this time. There is always next life.</p>'}</div>
            <div class="discuss"><h2>Talk about it</h2><ol>${qs.map((q) => `<li>${esc(q)}</li>`).join('')}</ol></div>
          </div>
          <div class="share-row">
            <button class="button big" data-act="share">Download my poster</button>
            <button class="button secondary" data-act="copy-story">Copy my story</button>
            <button class="button secondary" data-act="new">New career</button>
            <button class="button secondary" data-act="title">Title screen</button>
          </div>
          <p class="same-start">Want a classmate to start from the exact same world? Give them this code: <b>${esc(S.code)}</b></p>
        </article>
        ${(S.belts || L.total >= 115) && !reducedMotion ? `<div class="confetti" aria-hidden="true">${Array.from({ length: 46 }, (_, i) => `<i style="left:${(i * 2.17 + Math.random() * 2).toFixed(1)}%;--c:${['#f1e6cc', '#fff', '#e0a526', '#b8231b'][i % 4]};--t:${(4 + Math.random() * 4).toFixed(1)}s;--d:${(-Math.random() * 6).toFixed(1)}s"></i>`).join('')}</div>` : ''}
      </section>`);
    sfx('win');
  }

  // A 1200x630 poster of the career, made in the browser and saved as a PNG.
  function sharePoster() {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 630;
    const x = c.getContext('2d');
    const L = E.legacy(S);
    x.fillStyle = '#f1e6cc'; x.fillRect(0, 0, 1200, 630);
    x.fillStyle = '#b8231b'; x.fillRect(0, 0, 1200, 92); x.fillRect(0, 590, 1200, 40);
    x.fillStyle = '#f1e6cc'; x.font = '400 64px "Alfa Slab One", Georgia, serif'; x.textAlign = 'center'; x.fillText('TALE OF THE TAPE', 600, 70);
    const pc = document.createElement('canvas'); pc.width = 420; pc.height = 500; T.portrait(pc, S.f.look, { mood: 'tough', bg: '#1a1612' });
    x.drawImage(pc, 60, 120, 336, 400); x.lineWidth = 8; x.strokeStyle = '#17130f'; x.strokeRect(60, 120, 336, 400);
    x.textAlign = 'left'; x.fillStyle = '#17130f';
    x.font = '400 30px Oswald, "Arial Narrow", sans-serif'; x.fillText(`${D.DIVISIONS[S.f.division].name.toUpperCase()} · ${D.START_YEAR}–${E.year(S.retireT || S.t)}`, 440, 160);
    let name = `${S.f.first} ${S.f.last}`.toUpperCase(); let size = 78; x.font = `400 ${size}px "Alfa Slab One", Georgia, serif`;
    while (x.measureText(name).width > 700 && size > 40) { size -= 4; x.font = `400 ${size}px "Alfa Slab One", Georgia, serif`; }
    x.fillText(name, 440, 245);
    if (S.f.nick) { x.font = 'italic 400 38px "Old Standard TT", Georgia, serif'; x.fillText(`“${S.f.nick}”`, 440, 295); }
    x.fillStyle = '#b8231b'; x.font = '400 92px "Alfa Slab One", Georgia, serif'; x.fillText(rec(S.rec), 440, 400);
    x.fillStyle = '#17130f'; x.font = '400 34px Oswald, "Arial Narrow", sans-serif';
    x.fillText(`${S.rec.ko} KNOCKOUTS${S.belts ? ' · WORLD CHAMPION' : ''}`, 440, 450);
    x.fillText(`LEGACY ${L.total} · ${L.tier.toUpperCase()}`, 440, 500);
    x.font = '400 22px "Special Elite", "Courier New", monospace'; x.fillStyle = '#f1e6cc'; x.textAlign = 'center';
    x.fillText('grant-desk.com/hubs/tale-of-the-tape · live a whole life in the ring', 600, 618);
    c.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `tale-of-the-tape-${S.f.last.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });
  }

  // ---------- quick fight ----------
  let quick = { style: 'slugger', era: 'poster', rating: 50, useMine: true, code: '' };
  function renderQuick() {
    const saved = loadSaved();
    show(`
      <section class="quick">
        <h1 class="screen-title" tabindex="-1">Quick fight</h1>
        <p class="screen-sub">Learn the controls, settle a bet, or fight a classmate's fighter with their challenge code. Nothing here counts on a career.</p>
        <div class="paper-card quick-card">
          <fieldset><legend>Opponent style</legend>${['slugger', 'boxer', 'swarmer', 'counter', 'dirty', 'showman'].map((k) => `<button class="chip ${quick.style === k ? 'on' : ''}" data-act="q-style" data-arg="${k}" aria-pressed="${quick.style === k}">${esc((D.STYLES[k] || { name: k === 'dirty' ? 'Dirty fighter' : 'Showman' }).name)}</button>`).join('')}</fieldset>
          <fieldset><legend>Opponent level</legend>${[[35, 'Tomato can'], [50, 'Club fighter'], [65, 'Contender'], [80, 'Champion']].map(([r, n]) => `<button class="chip ${quick.rating === r ? 'on' : ''}" data-act="q-rating" data-arg="${r}" aria-pressed="${quick.rating === r}">${n}</button>`).join('')}</fieldset>
          <fieldset><legend>Era</legend>${[['poster', '1930s poster'], ['newsreel', '1940s newsreel'], ['tv', '1950s TV']].map(([k, n]) => `<button class="chip ${quick.era === k ? 'on' : ''}" data-act="q-era" data-arg="${k}" aria-pressed="${quick.era === k}">${n}</button>`).join('')}</fieldset>
          <fieldset><legend>Fight help</legend>${['rookie', 'normal', 'champ'].map((a) => `<button class="chip ${settings.assist === a ? 'on' : ''}" data-act="assist" data-arg="${a}" aria-pressed="${settings.assist === a}">${{ rookie: 'Rookie', normal: 'Contender', champ: 'Champion' }[a]}</button>`).join('')}</fieldset>
          ${saved ? `<label class="check"><input type="checkbox" id="q-mine" ${quick.useMine ? 'checked' : ''}> Use my career fighter (${esc(E.fullName(saved.state.f))})</label>` : ''}
          <label>Challenge code from a classmate <small>(optional: fight their fighter)</small><input id="q-code" value="${esc(quick.code)}" placeholder="paste a TT- code" autocomplete="off"></label>
          <div class="center-row"><button class="button big" data-act="q-go">Fight</button><button class="button secondary" data-act="title">Back</button></div>
        </div>
      </section>`);
  }
  function challengeCode(st) {
    const f = st.f;
    const data = [f.first, f.last, f.nick || '', Object.keys(D.STYLES).indexOf(f.style), statKeys.map((k) => Math.round(st.st[k])).join('.'), [f.look.skin, f.look.hair, D.HAIRCUTS.indexOf(f.look.cut), f.look.trunks, f.look.stache ? 1 : 0, f.look.nose || 0].join('.'), st.rec.w, st.rec.l, st.rec.ko].join('|');
    const b = btoa(unescape(encodeURIComponent(data))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    let sum = 0; for (const ch of b) sum = (sum * 31 + ch.charCodeAt(0)) % 1296;
    return 'TT-' + b + '-' + sum.toString(36).padStart(2, '0');
  }
  function readChallenge(code) {
    try {
      const m = String(code).trim().match(/^TT-([A-Za-z0-9_-]+)-([a-z0-9]{2})$/);
      if (!m) return null;
      let sum = 0; for (const ch of m[1]) sum = (sum * 31 + ch.charCodeAt(0)) % 1296;
      if (sum.toString(36).padStart(2, '0') !== m[2]) return null;
      const raw = decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))));
      const p = raw.split('|');
      const stats = p[4].split('.').map(Number), lk = p[5].split('.').map(Number);
      if (stats.length !== 5 || stats.some((v) => !(v >= 1 && v <= 99))) return null;
      const st = {}; statKeys.forEach((k, i) => { st[k] = stats[i]; });
      const style = Object.keys(D.STYLES)[Number(p[3])] || 'slugger';
      return { first: p[0].slice(0, 18), last: p[1].slice(0, 22), nick: p[2].slice(0, 20), style, stats: st, look: { skin: lk[0] % D.SKINS.length, hair: lk[1] % D.HAIRS.length, cut: D.HAIRCUTS[lk[2]] || 'slick', trunks: lk[3] % D.TRUNKS.length, stache: !!lk[4], nose: lk[5] % 3 }, w: Number(p[6]) || 0, l: Number(p[7]) || 0, ko: Number(p[8]) || 0 };
    } catch (e) { return null; }
  }
  function goQuick() {
    const codeIn = (document.getElementById('q-code') || {}).value || '';
    quick.code = codeIn.trim();
    const mine = document.getElementById('q-mine');
    quick.useMine = mine ? mine.checked : false;
    const saved = loadSaved();
    let you;
    if (quick.useMine && saved) { const st = saved.state; you = { first: st.f.first, last: st.f.last, stats: roundStats(st.st), look: st.f.look, health: st.health, heart: st.heart }; }
    else you = { first: 'You', last: 'The Kid', stats: { pow: 55, spd: 55, sta: 55, chn: 55, def: 55 }, look: { skin: 2, hair: 0, cut: 'slick', trunks: 0 }, health: 100, heart: 60 };
    let opp;
    if (quick.code) {
      const ch = readChallenge(quick.code);
      if (!ch) { toast('<b>That code did not work.</b><small>Check for a typo and try again.</small>'); return; }
      const rating = Math.round((ch.stats.pow + ch.stats.spd * 1.05 + ch.stats.sta * 0.85 + ch.stats.chn * 0.85 + ch.stats.def) / 4.75);
      opp = { first: ch.first, last: ch.last, nick: ch.nick, style: ch.style, rating, look: ch.look, w: ch.w, l: ch.l, ko: ch.ko };
    } else {
      const R = (a) => a[Math.floor(Math.random() * a.length)];
      opp = { first: R(D.FIRST), last: R(D.LAST), nick: R(D.NICKS), style: quick.style, rating: quick.rating, look: { skin: Math.floor(Math.random() * 7), hair: Math.floor(Math.random() * 7), cut: R(D.HAIRCUTS), trunks: Math.floor(Math.random() * 8), stache: Math.random() < 0.3, nose: Math.floor(Math.random() * 3), brow: 1, jaw: 1 + Math.random() * 0.15, build: 0.95 + Math.random() * 0.15 }, w: 20, l: 5, ko: 12 };
    }
    startFight({ you, offer: { opp, title: false, venue: 'the gym', city: 'exhibition', level: 'main' }, rounds: 3, era: quick.era });
  }
  function endPractice(out, p) {
    ui.screen = 'quick';
    const res = out.how === 'radio' ? 'stopped early' : out.result === 'W' ? 'You won' : out.result === 'L' ? 'You lost' : 'A draw';
    render();
    toast(`<b>${esc(res)}</b><small>${esc(E.methodText(out.how === 'radio' ? { method: 'DEC' } : out))} vs ${esc(p.offer.opp.last)} · landed ${out.stats.landed} of ${out.stats.thrown}</small>`, 5000);
  }

  // ---------- dialogs ----------
  function openDialog(html) { dialogBody.innerHTML = html; if (!dialog.open) dialog.showModal(); }
  function helpHtml() {
    return `<h2>How to play</h2>
      <h3>The career</h3>
      <p>Each turn is about a month of your fighter's life. Train to raise a stat, work for money, rest to heal, or chase publicity. When you are ready, look for a fight. Signing a fight starts a training camp; spend it on whatever you need most, then fight.</p>
      <p>History happens on its real dates. Some events are just news. Some change your life. Every choice has a cost.</p>
      <h3>In the ring</h3>
      <ul class="keys"><li><kbd>←</kbd> <kbd>→</kbd> or <kbd>A</kbd> <kbd>D</kbd> slip left or right</li><li><kbd>↓</kbd> or <kbd>S</kbd> duck</li><li><kbd>↑</kbd> or <kbd>W</kbd> hold your guard up</li><li><kbd>J</kbd> jab · <kbd>K</kbd> cross · <kbd>L</kbd> body shot</li><li><kbd>Space</kbd> haymaker (uses your stars)</li><li><kbd>P</kbd> pause</li></ul>
      <p><b>Read the wind-up.</b> Every punch has a tell. A glove swinging wide is a hook: slip away from it or duck. A dip low is an uppercut: slip sideways, never duck. A big wind-up over the head is a haymaker: get out of the way.</p>
      <p><b>Make him miss, then make him pay.</b> After he misses, he is open. Hits land harder and the first one earns a star. Stars power the haymaker.</p>
      <p><b>Guards.</b> If his gloves are up by his face, go to the body (L). If they are down by his chest, go upstairs (J, K).</p>
      <p>On a phone or tablet, use the buttons under the ring.</p>
      <h3>Saving</h3>
      <p>Your career saves itself in this browser after every move. Nothing is sent anywhere. Use the menu to download a save file if you want to move to another computer.</p>`;
  }
  function menuHtml() {
    return `<h2>Menu</h2><div class="menu-grid">
      ${S ? '<button class="button secondary" data-act="journal">Career journal</button>' : ''}
      ${S ? '<button class="button secondary" data-act="challenge">My challenge code</button>' : ''}
      ${S ? '<button class="button secondary" data-act="export">Download save file</button>' : ''}
      <button class="button secondary" data-act="import">Load a save file</button>
      <button class="button secondary" data-act="title">Title screen</button>
      ${S ? '<button class="button danger" data-act="abandon">Abandon this career</button>' : ''}
    </div>`;
  }

  // ---------- actions ----------
  function doAction(a, arg, el) {
    T.audio.unlock();
    if (['train', 'work', 'rest', 'press', 'circuit', 'camp', 'from-clip', 'service', 'after', 'accept'].includes(a)) ui.prev = snap();
    if (a !== 'close') sfx('click', 0.5);
    switch (a) {
      case 'continue': { const x = loadSaved(); if (!x) return; S = x.state; ui = { screen: 'game', prefight: x.ui && x.ui.prefight }; return render(); }
      case 'new': draft = newDraft(); ui = { screen: 'create' }; return render();
      case 'code': {
        const v = prompt('Type the same-start code your teacher gave you (like DET-4817):');
        if (!v) return;
        draft = newDraft(v.trim().toUpperCase()); ui = { screen: 'create' }; return render();
      }
      case 'quick': ui = { screen: 'quick' }; return render();
      case 'ttab': ui.titleTab = arg; return renderTitle();
      case 'title': if (dialog.open) dialog.close(); if (fightCtl) { fightCtl.destroy(); fightCtl = null; } ui = { screen: 'title' }; return render();
      case 'randomize': draft = Object.assign(newDraft(draft && draft.code), { code: draft && draft.code }); return renderCreate();
      case 'offers': E.offers(S); save(); return render();
      case 'decline': E.declineOffers(S); save(); ui.lastLines = []; return render();
      case 'accept': { E.acceptOffer(S, Number(arg)); ui.lastLines = []; sfx('stamp'); save(); return render(); }
      case 'train': case 'work': case 'rest': case 'press': case 'circuit': {
        const r = E.act(S, a, arg);
        if (!r) return render();
        ui.lastLines = r.lines;
        if (r.circuit) ui.circuit = r.circuit;
        save(); return render();
      }
      case 'circuit-done': ui.circuit = null; ui.lastLines = []; save(); return render();
      case 'camp': {
        const r = E.campStep(S, arg);
        if (!r) return render();
        ui.lastLines = r.lines;
        if (r.ready && S.phase === 'camp') ui.prefight = true;
        save(); return render();
      }
      case 'assist': settings.assist = arg; saveSettings(); return render();
      case 'play': return startFight();
      case 'sim': return simAndShow(false);
      case 'dive': return simAndShow(true);
      case 'doublecross': E.doubleCross(S); save(); return render();
      case 'to-clip': ui.screen = 'clipping'; if (ui.clip && ui.clip.titleWon && !ui.champShown) { ui.champShown = true; const off = S.fights[S.fights.length - 1]; playScene('champion', { venue: `${off.venue}, ${off.city}` }).then(render); return; } return render();
      case 'from-clip': ui.screen = 'game'; ui.clip = null; ui.champShown = false; ui.lastLines = []; save(); return render();
      case 'next': return render();
      case 'service': E.serviceStep(S); save(); return render();
      case 'path': E.choosePath(S, arg); save(); return render();
      case 'after': E.afterStep(S); save(); return render();
      case 'finish': E.finish(S); save(); return render();
      case 'retire-ask': return openDialog(`<h2>Retire?</h2><p>${esc(E.fullName(S.f))}, ${E.age(S)} years old, ${rec(S.rec)}, ${money(S.money)} in the bank. Once you retire, your fighting career is over, though old fighters do get comeback offers.</p><div class="menu-grid"><button class="button danger" data-act="retire-yes">Hang up the gloves</button><button class="button secondary" data-act="close">Not yet</button></div>`);
      case 'retire-yes': dialog.close(); E.retire(S, 'chose'); save(); return render();
      case 'close': return dialog.close();
      case 'journal': return openDialog(`<h2>Career journal</h2><ol class="journal">${S.journal.slice().reverse().map((j) => `<li class="k-${j.kind}"><span>${esc(E.shortDate(j.t))}</span> ${esc(j.text)}</li>`).join('')}</ol>`);
      case 'challenge': {
        const code = challengeCode(S);
        openDialog(`<h2>Your challenge code</h2><p>Give this code to a classmate. In <b>Quick fight</b>, they can paste it to box against your fighter as you are right now. It does not change either career.</p><p class="codebox"><code>${esc(code)}</code></p><div class="menu-grid"><button class="button" data-act="copy-code" data-arg="${esc(code)}">Copy code</button></div>`);
        return;
      }
      case 'copy-code': copy(arg, 'Code copied'); return;
      case 'copy-story': copy(`${E.fullName(S.f)} (${rec(S.rec)}, ${E.legacy(S).tier}): ${E.tellStory(S)} — Tale of the Tape, grant-desk.com/hubs/tale-of-the-tape.html`, 'Story copied'); return;
      case 'share': sharePoster(); return;
      case 'export': {
        const blob = new Blob([JSON.stringify({ game: 'tale-of-the-tape', v: E.VERSION, state: S }, null, 1)], { type: 'application/json' });
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `tale-of-the-tape-${S.f.last.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${E.year(S.t)}.json`;
        document.body.appendChild(link); link.click(); setTimeout(() => { URL.revokeObjectURL(link.href); link.remove(); }, 500);
        return;
      }
      case 'import': document.getElementById('load-file').click(); return;
      case 'abandon': if (confirm('Abandon this career for good? It cannot be undone.')) { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } S = null; dialog.close(); ui = { screen: 'title' }; render(); } return;
      case 'q-style': quick.style = arg; return renderQuick();
      case 'q-rating': quick.rating = Number(arg); return renderQuick();
      case 'q-era': quick.era = arg; return renderQuick();
      case 'q-go': return goQuick();
      default: return undefined;
    }
  }
  function copy(text, msg) {
    const done = () => toast(`<b>${esc(msg)}</b>`);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallback());
    else fallback();
    function fallback() { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { prompt('Copy this:', text); } t.remove(); }
  }

  // ---------- global wiring ----------
  document.addEventListener('click', (e) => {
    const ch = e.target.closest('[data-choice]');
    if (ch && !ch.disabled && app.contains(ch)) { chooseEvent(Number(ch.dataset.choice)); return; }
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) {
      if (b.closest('dialog') && !['copy-code', 'export', 'import', 'close'].includes(b.dataset.act)) { if (dialog.open) dialog.close(); }
      doAction(b.dataset.act, b.dataset.arg, b);
      return;
    }
    const u = e.target.closest('[data-look]');
    if (u && draft) {
      const k = u.dataset.look;
      if (k === 'stache') draft.look.stache = !draft.look.stache;
      else if (k === 'cut') draft.look.cut = u.dataset.v;
      else draft.look[k] = Number(u.dataset.v);
      renderCreate();
      const again = app.querySelector(`[data-look="${k}"][data-v="${u.dataset.v}"]`); again && again.focus();
      return;
    }
    const t = e.target.closest('[data-ui]');
    if (t) {
      const k = t.dataset.ui;
      if (k === 'help') openDialog(helpHtml());
      if (k === 'menu') openDialog(menuHtml());
      if (k === 'sound') { T.audio.set(!T.audio.enabled); renderTopbar(); if (T.audio.enabled) sfx('bell', 0.5); }
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target.name === 'style' && draft) { draft.style = e.target.value; renderCreate(); const r = app.querySelector(`input[name="style"][value="${e.target.value}"]`); r && r.focus(); }
  });
  document.getElementById('load-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const x = JSON.parse(await file.text());
      if (!x || x.game !== 'tale-of-the-tape' || !E.validate(x.state)) throw new Error('bad');
      S = x.state; ui = { screen: 'game' }; save(); if (dialog.open) dialog.close(); render(); toast('<b>Career loaded</b>');
    } catch (err) { toast('<b>That file is not a Tale of the Tape save.</b>'); }
  });
  document.addEventListener('keydown', (e) => {
    if (ui.screen === 'fight' || dialog.open) return;
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    // number keys pick event choices
    if (/^[1-9]$/.test(e.key) && S && S.inbox.length && ui.screen === 'game') {
      const b = app.querySelector(`[data-choice="${Number(e.key) - 1}"]`);
      if (b && !b.disabled) { e.preventDefault(); b.click(); }
    }
  });
  window.addEventListener('beforeunload', () => { if (S && ui.screen !== 'fight') save(); });

  // Expose a tiny hook for automated tests. It reads state; it cannot reach anything outside this page.
  T.app = { get state() { return S; }, get ui() { return ui; }, get fight() { return fightCtl; }, render: () => render(), challengeCode: () => (S ? challengeCode(S) : null), readChallenge };

  // ---------- boot ----------
  const saved = loadSaved();
  if (saved) { S = null; }
  render();
})(globalThis.TOT = globalThis.TOT || {});
