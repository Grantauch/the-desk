/* Blacktop Kings — screens and flow: title, the player creator, the career hub, the circuit, the locker,
   upgrades, crew, quick games, head-to-head versus, challenges, results, pause, settings.
   Every name a player types is escaped before it goes into the page. Saves live in this browser and in
   files the player keeps; nothing here talks to a server. */
(function (BK) {
  'use strict';
  const D = BK.data, A = BK.art, CR = BK.career;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ft = (inches) => `${Math.floor(inches / 12)}'${inches % 12}"`;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- settings ----------
  const SETTINGS_KEY = 'bk-settings';
  const settings = { difficulty: 'street', effects: reduceMotion ? 'reduced' : 'full', touch: 'auto', camera: 'close' };
  try { const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); if (s && typeof s === 'object') { if (['chill', 'street', 'legend'].includes(s.difficulty)) settings.difficulty = s.difficulty; if (['full', 'reduced'].includes(s.effects)) settings.effects = s.effects; if (['auto', 'on', 'off'].includes(s.touch)) settings.touch = s.touch; if (['close', 'wide'].includes(s.camera)) settings.camera = s.camera; } } catch (e) { /* ignore */ }
  const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ } };
  const DIFF = { chill: { skill: 0.32, boost: -1, name: 'Chill' }, street: { skill: 0.58, boost: 0, name: 'Street' }, legend: { skill: 0.86, boost: 1, name: 'Legend' } };

  // ---------- state ----------
  const S = { save: CR.load(), screen: 'title', arg: null, match: null, attract: null, draft: null, tab: 'hair', preview: 'idle', quick: null, vs: null, ch: null, last: null, raf: 0 };
  let app, canvas, toastEl, fileInput, stage, touchHost;
  let audioReady = false;

  // ---------- boot ----------
  function boot() {
    app = $('#app'); canvas = $('#court'); toastEl = $('#toast'); fileInput = $('#load-file'); stage = $('#stage'); touchHost = $('#touch-host');
    app.addEventListener('click', onClick);
    app.addEventListener('input', onInput);
    app.addEventListener('change', onChange);
    if (BK.assets) { BK.assets.load('impact'); BK.assets.load('trophy'); BK.assets.load('ball'); BK.assets.load('jersey-weave'); }
    window.addEventListener('bk-art-ready', ({ detail }) => {
      const scenery = detail && /^(court-|surface-)/.test(detail.key);
      for (const m of [S.match, S.attract]) if (m) { if (scenery) m.paintBackground(); if (m.paused || reduceMotion) m.render(); }
      paintCanvases();
    });
    fileInput.addEventListener('change', onFilePicked);
    const firstGesture = () => { if (audioReady) return; audioReady = true; BK.audio.unlock(); if (BK.audio.settings.on && S.screen !== 'match') BK.audio.music('menu'); };
    document.addEventListener('keydown', firstGesture, { once: true });
    document.addEventListener('pointerdown', firstGesture, { once: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden && S.match && !S.match.paused && !S.match.over) showPause(); });
    window.addEventListener('blur', () => { if (S.match && !S.match.paused && !S.match.over && S.screen === 'match') showPause(); });
    // Esc backs out of a menu, the same way the legend along the bottom says it does.
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || S.screen === 'match' || $('#pause') || e.target.tagName === 'SELECT') return;
      const b = $('.back', app); if (b) { e.preventDefault(); b.click(); }
    });
    BK.audio.music('menu');
    const fontsReady = document.fonts && document.fonts.load ? Promise.all(['italic 900 20px "Barlow Condensed"', 'italic 800 20px "Barlow Condensed"', '400 20px Anton', '600 16px Barlow'].map((f) => document.fonts.load(f).catch(() => null))) : Promise.resolve();
    Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1500))]).then(() => { go('title'); });
    window.BK_APP = { S, go, startMatch };
  }

  // ---------- navigation ----------
  function go(screen, arg) {
    cancelAnimationFrame(S.raf);
    if (['career', 'circuit', 'event', 'upgrade', 'locker', 'crew'].includes(screen) && !S.save) { screen = 'create'; if (!S.draft) S.draft = newDraft(); }
    S.screen = screen; S.arg = arg == null ? null : arg;
    if (screen === 'title') startAttract(); else if (S.attract) { S.attract.stop(); }
    document.body.dataset.screen = screen;
    const html = (SCREENS[screen] || SCREENS.title)();
    app.innerHTML = html + legend(/class="back"/.test(html));
    app.hidden = false;
    paintCanvases();
    if (screen === 'create' || screen === 'locker') startPreview();
    const h = $('h1, h2', app); if (h && screen !== 'title') { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    app.scrollTop = 0; window.scrollTo(0, 0);
    if (audioReady && BK.audio.settings.on && screen !== 'match') BK.audio.music('menu');
  }

  function toast(msg, ms) {
    toastEl.textContent = msg; toastEl.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { toastEl.hidden = true; }, ms || 3200);
  }

  // ---------- attract mode behind the title ----------
  function startAttract() {
    if (S.match) return;
    if (S.attract) { S.attract.stop(); S.attract = null; }
    const crews = D.QUICK_CREWS.slice().sort(() => Math.random() - 0.5);
    const courts = CR.openCourts(S.save);
    const court = pick(courts);
    S.attract = new BK.Match(canvas, { attract: true, court, target: 11, teams: [crewSpec(crews[0]), crewSpec(crews[1])], humans: [], skill: 0.75, reducedMotion: settings.effects === 'reduced', camera: settings.camera });
    if (reduceMotion) { S.attract.simulate(6); S.attract.render(); } else S.attract.start();
  }
  function crewSpec(c) { return { name: c.name, colors: c.colors.slice(), logo: c.logo, players: c.members.map((id) => CR.memberById(id)) }; }

  // ---------- canvases inside screens ----------
  const drawables = new Map(); let drawId = 0;
  function figure(player, colors, opts) {
    const id = 'd' + (++drawId); drawables.set(id, { player, colors, opts: opts || {} });
    const w = (opts && opts.w) || 96, h = (opts && opts.h) || 128;
    return `<canvas class="fig${opts && opts.portrait ? ' portrait' : ''}" width="${w * 2}" height="${h * 2}" style="width:${w}px;height:${h}px" data-draw="${id}" aria-hidden="true"></canvas>`;
  }
  function logoCanvas(logo, c1, c2, size) {
    const id = 'd' + (++drawId); drawables.set(id, { logo, c1, c2 });
    size = size || 44;
    return `<canvas class="logo" width="${size * 2}" height="${size * 2}" style="width:${size}px;height:${size}px" data-draw="${id}" aria-hidden="true"></canvas>`;
  }
  function sceneCanvas(court) {
    const id = 'd' + (++drawId); drawables.set(id, { court });
    return `<canvas class="scene" width="480" height="270" data-draw="${id}" aria-hidden="true"></canvas>`;
  }
  // Artwork for menu tiles: sized by CSS, painted by `paint(ctx, w, h)`.
  function art(w, h, paint) {
    const id = 'd' + (++drawId); drawables.set(id, { paint });
    return `<canvas class="art" width="${w}" height="${h}" data-draw="${id}" aria-hidden="true"></canvas>`;
  }
  const paintCourt = (court) => (ctx, w, h) => { const cam = A.defaultCamera(w, h); A.paintScene(ctx, cam, court); A.drawHoop(ctx, cam, {}, 'back', court, 0); A.drawHoop(ctx, cam, {}, 'front', court, 0); };
  const paintPortrait = (p, cols, px, backgroundKey) => (ctx, w, h) => {
    if (backgroundKey && BK.assets) BK.assets.load(backgroundKey);
    A.drawPortrait(ctx, p, teamColors(cols), { x: 0, y: 0, w, h }, { px, backgroundKey });
  };
  function imageArt(key, fallback) {
    return `<span class="raster-frame" data-image-art="${key}"><span class="raster-fallback">${fallback || ''}</span><img class="raster-image" alt="" decoding="async" hidden></span>`;
  }
  function refreshIllustrations() {
    if (!BK.assets) return;
    $$('[data-image-art]', app).forEach((frame) => {
      const key = frame.dataset.imageArt; BK.assets.load(key);
      const loaded = BK.assets.get(key); if (!loaded) return;
      const img = $('.raster-image', frame);
      if (img.src !== loaded.src) img.src = loaded.src;
      img.hidden = false; frame.classList.add('has-raster');
    });
  }
  // Two crews squaring up: one portrait each side of a slanted seam.
  const paintSplit = (a, ca, b, cb) => (ctx, w, h) => {
    const seam = (top) => (top ? w * 0.56 : w * 0.44);
    ctx.save(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(seam(true), 0); ctx.lineTo(seam(false), h); ctx.lineTo(0, h); ctx.closePath(); ctx.clip();
    A.drawPortrait(ctx, a, teamColors(ca), { x: 0, y: 0, w: w * 0.62, h }, { px: 0.42 }); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.moveTo(seam(true), 0); ctx.lineTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(seam(false), h); ctx.closePath(); ctx.clip();
    A.drawPortrait(ctx, b, teamColors(cb), { x: w * 0.38, y: 0, w: w * 0.62, h }, { px: 0.42, facing: -1 }); ctx.restore();
    ctx.lineWidth = w * 0.022; ctx.strokeStyle = '#07080c'; ctx.beginPath(); ctx.moveTo(seam(true), -4); ctx.lineTo(seam(false), h + 4); ctx.stroke();
    ctx.lineWidth = w * 0.006; ctx.strokeStyle = '#ffc629'; ctx.stroke();
  };
  // A rival you haven't met yet: an ink silhouette with a gold rim light.
  const paintMystery = (p) => (ctx, w, h) => {
    ctx.fillStyle = '#10131c'; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#1b2030';
    ctx.beginPath(); ctx.moveTo(w * 0.42, 0); ctx.lineTo(w * 0.78, 0); ctx.lineTo(w * 0.5, h); ctx.lineTo(w * 0.14, h); ctx.closePath(); ctx.fill(); ctx.restore();
    const off = document.createElement('canvas'); off.width = w; off.height = h; const o = off.getContext('2d');
    const box = { x: w * 0.3, y: h * 0.06, w: w * 0.6, h: h * 1.1 };
    A.drawCard(o, p, { pri: '#333', sec: '#555', num: '#777' }, box, { pose: 'idle', time: 1.4 });
    o.globalCompositeOperation = 'source-in';
    o.fillStyle = '#ffc629'; o.fillRect(0, 0, w, h);
    ctx.drawImage(off, w * 0.012, -h * 0.004);
    o.fillStyle = '#05060a'; o.fillRect(0, 0, w, h);
    ctx.drawImage(off, 0, 0);
    ctx.font = `400 ${Math.round(h * 0.42)}px Anton, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = h * 0.02; ctx.strokeStyle = '#05060a'; ctx.fillStyle = '#ffc629';
    ctx.save(); ctx.translate(w * 0.62, h * 0.36); ctx.transform(1, 0, -0.2, 1, 0, 0); ctx.strokeText('?', 0, 0); ctx.fillText('?', 0, 0); ctx.restore();
  };
  function paintCanvases() {
    refreshIllustrations();
    $$('canvas[data-draw]', app).forEach((c) => {
      const d = drawables.get(c.dataset.draw); if (!d) return;
      const ctx = c.getContext('2d');
      if (d.paint) { d.paint(ctx, c.width, c.height); return; }
      if (d.logo) { A.drawLogo(ctx, d.logo, c.width / 2, c.height / 2, c.width * 0.46, d.c1, d.c2); return; }
      if (d.court) { const cam = A.defaultCamera(c.width, c.height); A.paintScene(ctx, cam, d.court); A.drawHoop(ctx, cam, {}, 'back', d.court, 0); A.drawHoop(ctx, cam, {}, 'front', d.court, 0); return; }
      const colors = teamColors(d.colors);
      if (d.opts.portrait) A.drawPortrait(ctx, d.player, colors, { x: 0, y: 0, w: c.width, h: c.height }, d.opts);
      else A.drawCard(ctx, d.player, colors, { x: 0, y: 0, w: c.width, h: c.height }, Object.assign({ time: 1.2 }, d.opts));
    });
    if (drawables.size > 400) drawables.clear();
  }
  function teamColors(cols) {
    const pri = cols[0], sec = cols[1];
    return { pri, sec, num: A.luminance(pri) > 0.62 ? (A.luminance(sec) > 0.62 ? '#111111' : sec) : (A.luminance(sec) < 0.35 ? '#ffffff' : sec) };
  }

  // ---------- animated preview for the creator and locker ----------
  function startPreview() {
    const c = $('#preview', app); if (!c) return;
    if (BK.assets) BK.assets.load('locker-room');
    const ctx = c.getContext('2d'); const t0 = performance.now();
    const loop = (now) => {
      const p = S.screen === 'create' ? draftPlayer() : CR.mePlayer(S.save);
      const cols = S.screen === 'create' ? [S.draft.crewPri, S.draft.crewSec] : S.save.crew.colors;
      const time = (now - t0) / 1000;
      ctx.clearRect(0, 0, c.width, c.height);
      const room = BK.assets && BK.assets.get('locker-room');
      if (room) A.drawImageCover(ctx, room, { x: 0, y: 0, w: c.width, h: c.height });
      // A stage: hard-edged spotlight, the jersey number in outline, a floor disc in the crew color.
      const cw = c.width, chh = c.height, fy = chh * 0.95;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, chh * 0.8, cw, chh * 0.2);
      ctx.fillStyle = 'rgba(255,255,255,0.045)';
      ctx.beginPath(); ctx.moveTo(cw * 0.36, 0); ctx.lineTo(cw * 0.64, 0); ctx.lineTo(cw * 0.9, fy); ctx.lineTo(cw * 0.1, fy); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cw * 0.44, 0); ctx.lineTo(cw * 0.56, 0); ctx.lineTo(cw * 0.72, fy); ctx.lineTo(cw * 0.28, fy); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.font = '400 330px Anton, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.translate(cw / 2, chh * 0.4); ctx.transform(1, 0, -0.16, 1, 0, 0);
      const numTxt = String(p.num).padStart(2, '0');
      ctx.globalAlpha = 0.08; ctx.fillStyle = cols[0]; ctx.fillText(numTxt, 0, 0);
      ctx.globalAlpha = 0.16; ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.strokeText(numTxt, 0, 0); ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(cw / 2, fy, cw * 0.34, chh * 0.032, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = cols[0]; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(cw / 2, fy, cw * 0.3, chh * 0.026, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(cw / 2, fy, cw * 0.3 + 3, chh * 0.026 + 3, 0, 0, Math.PI * 2); ctx.stroke();
      const sh = ctx.createRadialGradient(c.width / 2, fy, 2, c.width / 2, fy, c.width * 0.22);
      sh.addColorStop(0, 'rgba(0,0,0,0.5)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.translate(0, fy); ctx.scale(1, 0.14); ctx.translate(0, -fy); ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(c.width / 2, fy, c.width * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      const mode = S.preview; const cyc = (time % 1.6) / 1.6;
      const opts = { time, scale: c.height * 0.9 / Math.max(7.1, p.hgt / 12 + 0.7) };
      if (mode === 'dunk') { opts.pose = 'dunk'; opts.style = p.dunk; opts.t = cyc; }
      else if (mode === 'trick') { opts.pose = 'trick'; opts.style = ['cross', 'behind', 'spin', 'legs'][Math.floor(time / 1.6) % 4]; opts.t = cyc; }
      else if (mode === 'celebrate') { opts.pose = 'celebrate'; opts.style = p.celebration; }
      else if (mode === 'run') { opts.pose = 'run'; }
      else opts.pose = 'idle';
      const d = A.dims(p.hgt, p.build);
      const pose = A.pose(opts.pose, { dims: d, time, t: opts.t || 0, style: opts.style, phase: time * 9, speed: 1 });
      const scale = opts.scale;
      const lift = mode === 'dunk' ? Math.sin(Math.min(1, cyc / 0.78) * Math.PI) * 1.2 * scale : 0;
      const spin = mode === 'trick' && opts.style === 'spin' ? cyc * Math.PI * 2 : mode === 'dunk' && p.dunk === 'spin360' ? Math.min(1, cyc / 0.78) * Math.PI * 2 : 0;
      A.drawBaller(ctx, { x: c.width / 2 - scale * 0.2, y: c.height * 0.95 - lift, scale, hgt: p.hgt, build: p.build, look: p.look, num: p.num, colors: teamColors(cols), facing: 1, spin, pose, dims: d, time });
      // aura sparkle in the preview
      const aura = p.look.aura;
      if (aura && aura !== 'none' && !reduceMotion) {
        const col = { embers: '#ff6a13', static: '#7df9ff', frost: '#bfe8ff', royal: '#ffd23f' }[aura];
        for (let i = 0; i < 10; i++) { const a = time * 1.5 + i * 0.63; const x = c.width / 2 + Math.sin(a * 1.3 + i) * c.width * 0.22; const y = c.height * 0.9 - ((time * 60 + i * 37) % (c.height * 0.8)); ctx.fillStyle = col; ctx.globalAlpha = 0.7; ctx.fillRect(x, y, 4, 4); }
        ctx.globalAlpha = 1;
      }
      S.raf = requestAnimationFrame(loop);
    };
    S.raf = requestAnimationFrame(loop);
  }

  // ---------- shared bits of markup ----------
  const btn = (act, label, cls, extra) => `<button type="button" class="btn ${cls || ''}" data-act="${act}" ${extra || ''}>${label}</button>`;
  const back = (to, label) => `<button type="button" class="back" data-go="${to}"><kbd aria-hidden="true">Esc</kbd><span class="back-arrow" aria-hidden="true">‹</span>${esc(label || 'Back')}</button>`;
  const LOCK = '<i class="lk" aria-hidden="true"></i><span class="sr">Locked: </span>';
  // Where each screen sits, for the rail across the top and the kicker over the title.
  const CRUMBS = { create: 'Career / New player', career: 'Career', circuit: 'Career / The Circuit', event: 'Career / Matchup', upgrade: 'Career / Upgrade', locker: 'Career / Locker', crew: 'Career / Crew', quick: 'Quick Game', versus: 'Versus', challenge: 'Challenge', howto: 'How to Play', settings: 'Settings', results: 'Final' };
  const KICKERS = { create: 'New player', career: 'Career mode', circuit: 'Career', event: 'Matchup', upgrade: 'Player development', locker: 'Locker room', crew: 'Roster', quick: 'Play now', versus: 'Head to head', challenge: 'Their crew, your court', howto: 'The rules of the lot', settings: 'Options', results: 'Final' };
  function header(title, sub, backTo, backLabel, kicker) {
    const s = S.save;
    const crumb = (CRUMBS[S.screen] || '').split(' / ').map((c, i, a) => (i === a.length - 1 ? `<b>${esc(c)}</b>` : esc(c))).join('<i>/</i>');
    const profile = s && S.screen !== 'create' ? `<span class="profile" aria-label="${esc(s.me.nick)}, level ${s.level}, ${s.cred} cred"><b>${esc(s.me.nick)}</b><span class="p-lv">LV ${s.level}</span><span class="p-cred">${s.cred.toLocaleString()} cred</span></span>` : '';
    return `<header class="screen-head">
      <div class="rail">${backTo ? back(backTo, backLabel) : ''}<span class="crumb">Blacktop Kings<i>/</i>${crumb}</span>
        <span class="rail-right">${profile}<a class="desk" href="/games/">the desk <span>/ games</span></a></span></div>
      <div class="title-block"><span class="kicker">${esc(kicker || KICKERS[S.screen] || '')}</span>
        <h2 class="screen-title">${title}</h2>${sub ? `<p class="screen-sub">${sub}</p>` : ''}</div>
    </header>`;
  }
  function legend(canBack) {
    return `<div class="legend" aria-hidden="true"><span><kbd>Tab</kbd>Move</span><span><kbd>Enter</kbd>Select</span>${canBack ? '<span><kbd>Esc</kbd>Back</span>' : ''}<span class="legend-brand">Blacktop <b>Kings</b></span></div>`;
  }
  // A big menu tile: artwork behind, an index number, a label and a line under it.
  function tile(act, label, sub, o) {
    o = o || {};
    return `<button type="button" class="tile ${o.cls || ''}" data-act="${act}">
      <span class="tile-art ${o.artCls || ''}" aria-hidden="true">${o.art || ''}</span>
      ${o.idx ? `<span class="tile-idx" aria-hidden="true">${o.idx}</span>` : ''}${o.badge ? `<span class="tile-badge">${o.badge}</span>` : ''}
      <span class="tile-text">${o.kicker ? `<span class="tile-kicker">${o.kicker}</span>` : ''}<b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span>
    </button>`;
  }
  // Crew colors as CSS variables, with an ink color that reads on top of the primary.
  function teamVars(cols) {
    const ink = A.luminance(cols[0]) > 0.6 ? '#0b0b0d' : '#ffffff';
    return `--team:${esc(cols[0])};--trim:${esc(cols[1])};--team-ink:${ink}`;
  }
  function statBars(r, opts) {
    opts = opts || {};
    return `<div class="stats ${opts.compact ? 'compact' : ''}">${D.STATS.map((s) => { const v = r[s.key]; return `<div class="stat"><span class="stat-name">${opts.compact ? s.short : s.name}</span><span class="bar" aria-hidden="true"><i class="${v >= 8 ? 'hi' : v >= 5 ? 'mid' : 'lo'}" style="width:${v * 10}%"></i></span><b>${v}</b></div>`; }).join('')}</div>`;
  }
  function overall(r) { return Math.round(D.STAT_KEYS.reduce((n, k) => n + r[k], 0) / D.STAT_KEYS.length * 10); }
  const ovrBadge = (r) => `<span class="ovr"><b>${overall(r)}</b><i>OVR</i></span>`;
  function playerCard(p, cols, opts) {
    opts = opts || {};
    return `<div class="pcard ${opts.cls || ''}" style="${teamVars(cols)}">
      ${figure(p, cols, { w: opts.w || 92, h: opts.h || 116, portrait: true })}
      <div class="pcard-body">
        <span class="pnick">${esc(p.nick || p.first)}</span>
        <span class="pname">${esc(p.first)} ${esc(p.last)} · #${esc(p.num)} · ${ft(p.hgt)}</span>
        <span class="parch">${esc(D.ARCHETYPES[p.arch] ? D.ARCHETYPES[p.arch].name : '')}${p.legend ? ' · <em>legend</em>' : ''}</span>
        ${opts.bio && p.bio ? `<span class="pbio">${esc(p.bio)}</span>` : ''}
        ${opts.stats ? statBars(p.r, { compact: true }) : ''}
      </div>${ovrBadge(p.r)}
    </div>`;
  }
  // "J or Z" becomes two key caps.
  const kbdify = (s) => esc(s).split(/( or | \/ )/).map((part, i) => (i % 2 ? `<span class="hint">${part}</span>` : `<kbd>${part}</kbd>`)).join('');

  // ---------- screens ----------
  const SCREENS = {};

  // The wordmark: BLACKTOP in white, KINGS in cel-shaded gold with a red misprint and an ink extrusion.
  const LOGO = `<svg viewBox="0 0 690 300" role="img" aria-label="Blacktop Kings"><defs>
      <linearGradient id="bk-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b0"/><stop offset=".4" stop-color="#ffe27a"/><stop offset=".4" stop-color="#ffc629"/><stop offset=".78" stop-color="#ffc629"/><stop offset=".78" stop-color="#e59400"/><stop offset="1" stop-color="#e59400"/></linearGradient>
      <pattern id="bk-dots" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(20)"><circle cx="3.5" cy="3.5" r="1.7" fill="#7a3d00" fill-opacity=".38"/></pattern>
      <clipPath id="bk-shade"><rect x="-60" y="226" width="800" height="80"/></clipPath>
      <clipPath id="bk-crown-shade"><rect x="0" y="54" width="110" height="40"/></clipPath>
    </defs>
    <g font-family="'Barlow Condensed', 'Arial Narrow', sans-serif" font-style="italic" font-weight="900" font-size="108">
      <text x="14" y="98" textLength="440" lengthAdjust="spacingAndGlyphs" fill="#000">BLACKTOP</text>
      <text x="8" y="92" textLength="440" lengthAdjust="spacingAndGlyphs" fill="#fff" stroke="#07080c" stroke-width="9" stroke-linejoin="round" paint-order="stroke">BLACKTOP</text>
    </g>
    <g transform="translate(62 0) skewX(-12)" font-family="Anton, Impact, sans-serif" font-size="212">
      <text x="14" y="290" textLength="600" lengthAdjust="spacingAndGlyphs" fill="#000" stroke="#000" stroke-width="12" stroke-linejoin="round">KINGS</text>
      <text x="7" y="284" textLength="600" lengthAdjust="spacingAndGlyphs" fill="#ff4a2b" stroke="#07080c" stroke-width="10" stroke-linejoin="round" paint-order="stroke">KINGS</text>
      <text x="0" y="278" textLength="600" lengthAdjust="spacingAndGlyphs" fill="url(#bk-gold)" stroke="#07080c" stroke-width="10" stroke-linejoin="round" paint-order="stroke">KINGS</text>
      <text x="0" y="278" textLength="600" lengthAdjust="spacingAndGlyphs" fill="url(#bk-dots)" clip-path="url(#bk-shade)">KINGS</text>
    </g>
    <g transform="translate(540 6) rotate(13) scale(1.12)" stroke-linejoin="round">
      <path d="M12 76 6 22l26 22L54 6l22 38 26-22-6 54z" transform="translate(5 5)" fill="#000"/>
      <path d="M12 76 6 22l26 22L54 6l22 38 26-22-6 54z" fill="#ffc629" stroke="#07080c" stroke-width="6"/>
      <path d="M12 76 6 22l26 22L54 6l22 38 26-22-6 54z" fill="#e59400" clip-path="url(#bk-crown-shade)"/>
      <path d="M12 76 6 22l26 22L54 6l22 38 26-22-6 54z" fill="none" stroke="#07080c" stroke-width="6"/>
      <rect x="10" y="80" width="88" height="14" fill="#ff4a2b" stroke="#07080c" stroke-width="5"/>
      <circle cx="6" cy="20" r="6" fill="#fff" stroke="#07080c" stroke-width="4"/><circle cx="54" cy="5" r="6" fill="#fff" stroke="#07080c" stroke-width="4"/><circle cx="102" cy="20" r="6" fill="#fff" stroke="#07080c" stroke-width="4"/>
    </g></svg>`;
  SCREENS.title = () => {
    const s = S.save;
    const me = s ? CR.mePlayer(s) : (() => { const d = newDraft(); return { num: d.num, hgt: d.hgt, build: d.build, look: d.look }; })();
    const meCols = s ? s.crew.colors : ['#e8352b', '#ffffff'];
    const next = s && nextEvent(s);
    const kings = D.QUICK_CREWS[0], show = D.QUICK_CREWS[1];
    const rival = CR.memberById(D.QUICK_CREWS[2].members[0]);
    return `<section class="title-screen">
      <div class="topbar"><a class="desk" href="/games/">the desk <span>/ games</span></a>
        ${s ? `<span class="profile" aria-label="${esc(s.me.nick)}, level ${s.level}, ${s.cred} cred"><b>${esc(s.me.nick)}</b><span class="p-lv">LV ${s.level}</span><span class="p-cred">${s.cred.toLocaleString()} cred</span></span>` : ''}</div>
      <div class="title-hero">
        <h1 class="logo">${LOGO}</h1>
        <p class="tagline"><span>3-on-3 streetball</span><span>First to 21</span><span>No refs. No mercy.</span></p>
      </div>
      <nav class="tiles" aria-label="Main menu">
        ${tile('nav-career', 'Career', s ? `${esc(s.me.nick)} · Level ${s.level} · ${esc(s.crew.name)}` : 'Build your baller. Run the circuit. Take the crown.', { cls: 'hero', idx: '01', kicker: s ? 'Continue' : 'New career', art: imageArt('mode-career', art(760, 560, paintPortrait(me, meCols, 0.68))) })}
        ${tile('nav-quick', 'Quick Game', 'Pick two crews and go.', { idx: '02', art: imageArt('mode-quick', art(640, 360, paintCourt(next ? next.court : D.COURTS[0]))) })}
        ${tile('nav-versus', 'Versus', 'Two players, one screen.', { idx: '03', art: imageArt('mode-versus', art(560, 560, paintSplit(CR.memberById(kings.members[0]), kings.colors, CR.memberById(show.members[0]), show.colors))) })}
        ${tile('nav-challenge', 'Challenge', 'Load a friend\'s save. Beat their crew.', { idx: '04', art: imageArt('mode-challenge', art(560, 560, paintMystery(rival))) })}
      </nav>
      <div class="title-foot">
        <div class="title-small">
          ${btn('nav-howto', 'How to Play', 'small')}
          ${btn('nav-settings', 'Settings', 'small')}
          ${btn('toggle-sound', BK.audio.settings.on ? 'Sound: On' : 'Sound: Off', 'small', `aria-pressed="${BK.audio.settings.on}"`)}
        </div>
        <p class="fineprint">Every player, crew, and court here is made up. Saves stay in this browser, or in a file you keep (Google Drive works).</p>
      </div>
    </section>`;
  };

  // ----- creator -----
  function newDraft() {
    return { step: 0, first: '', last: '', nick: '', num: 7, arch: 'slasher', hgt: 76, build: 'athletic', look: Object.assign({}, A.DEFAULT_LOOK, { hair: 'fade', skin: '#8d5524' }), crewName: '', crewPri: '#e8352b', crewSec: '#ffffff', crewLogo: 'crown' };
  }
  function draftPlayer() {
    const d = S.draft;
    return { id: 'me', first: d.first || 'Rookie', last: d.last || '', nick: d.nick || 'Rookie', num: d.num, arch: d.arch, hgt: d.hgt, build: d.build, r: D.ARCHETYPES[d.arch].base, look: d.look, dunk: 'tomahawk', celebration: 'flex' };
  }
  const CREATE_STEPS = ['Who are you', 'Body', 'Hair & face', 'Gear', 'Your crew'];
  SCREENS.create = () => {
    const d = S.draft || (S.draft = newDraft());
    const step = d.step;
    const pseudo = { level: 1, owned: [], cred: 0 };
    let body = '';
    if (step === 0) {
      body = `<div class="fields">
        <label class="field">First name<input data-field="first" maxlength="14" value="${esc(d.first)}" autocomplete="off" placeholder="Andre"></label>
        <label class="field">Last name<input data-field="last" maxlength="14" value="${esc(d.last)}" autocomplete="off" placeholder="Rivers"></label>
        <label class="field">Nickname<input data-field="nick" maxlength="16" value="${esc(d.nick)}" autocomplete="off" placeholder="Showtime"></label>
        <label class="field small">Number<input data-field="num" type="number" min="0" max="99" value="${esc(d.num)}"></label>
      </div>
      <p class="hint">Letters, numbers, spaces, periods, apostrophes, and hyphens only. Your nickname is what the crowd yells.</p>
      <h3 class="group-title">How you play</h3>
      <div class="arch-grid">${Object.keys(D.ARCHETYPES).map((k) => { const a = D.ARCHETYPES[k]; const top = D.STATS.slice().sort((x, y) => a.base[y.key] - a.base[x.key]).slice(0, 3); return `<button type="button" class="arch ${d.arch === k ? 'on' : ''}" data-arch="${k}" aria-pressed="${d.arch === k}"><span class="arch-art" aria-hidden="true">${imageArt('arch-' + k)}</span><b>${esc(a.name)}</b><span>${esc(a.blurb)}</span><span class="arch-top">${top.map((st) => `<i>${st.name} <em>${a.base[st.key]}</em></i>`).join('')}</span></button>`; }).join('')}</div>`;
    } else if (step === 1) {
      body = `<label class="field wide">Height: <b id="hgt-label">${ft(d.hgt)}</b>
          <input type="range" min="66" max="88" step="1" value="${d.hgt}" data-field="hgt" aria-valuetext="${ft(d.hgt)}"></label>
        <p class="hint">Taller: more blocks and boards, a step slower. Shorter: quicker, better handles.</p>
        ${chipGroup('Build', 'build', ['lean', 'athletic', 'strong', 'heavy'].map((b) => ({ id: b, name: b[0].toUpperCase() + b.slice(1) })), d.build, pseudo, true)}
        ${swatchGroup('Skin tone', 'skin', D.SKIN, d.look.skin, pseudo)}`;
    } else if (step === 2) {
      body = lookSection('hair', d.look, pseudo);
    } else if (step === 3) {
      body = lookSection('gear', d.look, pseudo);
    } else {
      body = crewEditor({ name: d.crewName, colors: [d.crewPri, d.crewSec], logo: d.crewLogo }, true);
    }
    return `${header('Build your baller', '', step === 0 ? 'title' : null, 'Title')}
      <ol class="stepper" aria-label="Step ${step + 1} of 5: ${CREATE_STEPS[step]}">${CREATE_STEPS.map((n, i) => `<li class="${i < step ? 'done' : i === step ? 'on' : ''}"${i === step ? ' aria-current="step"' : ''}><b>${String(i + 1).padStart(2, '0')}</b>${esc(n)}</li>`).join('')}</ol>
      <div class="editor">
        <div class="preview-col">${previewBox()}</div>
        <div class="edit-col">${body}
          <div class="step-nav">
            ${step > 0 ? btn('cr-back', '← Back', 'ghost') : ''}
            ${step < 4 ? btn('cr-next', 'Next →', 'primary') : btn('cr-finish', 'Hit the blacktop', 'primary big')}
          </div>
          <p class="hint">More hair, ink, auras, ball trails, and dunks unlock as you level up or spend cred in the Locker.</p>
        </div>
      </div>`;
  };
  function previewBox() {
    return `<div class="preview-box"><canvas id="preview" width="440" height="600" aria-label="Preview of your player"></canvas>
      <div class="preview-modes" role="group" aria-label="Preview pose">${['idle', 'run', 'trick', 'dunk', 'celebrate'].map((m) => `<button type="button" class="chip ${S.preview === m ? 'on' : ''}" data-preview="${m}" aria-pressed="${S.preview === m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}</div></div>`;
  }
  function lockText(o, save, kind) {
    if (!o.lvl && !o.cost) return '';
    if (save && CR.isUnlocked(save, kind, o)) return '';
    if (o.lvl && (!save || save.level < o.lvl)) return `<small>Lv ${o.lvl}</small>`;
    if (o.cost) return `<small>${o.cost} cred</small>`;
    return '';
  }
  function chipGroup(title, key, opts, current, save, plain) {
    return `<div class="group"><h3 class="group-title">${esc(title)}</h3><div class="chips" role="group" aria-label="${esc(title)}">${opts.map((o) => {
      const locked = !plain && !CR.isUnlocked(save, key, o);
      const canBuy = locked && o.cost && (!o.lvl || save.level >= o.lvl) && save.cred != null && S.screen === 'locker';
      const on = current === o.id;
      return `<button type="button" class="chip ${on ? 'on' : ''} ${locked ? 'locked' : ''}" ${canBuy ? `data-buy="${key}:${o.id}" data-cost="${o.cost}"` : locked ? 'disabled' : `data-look="${key}" data-val="${o.id}"`} aria-pressed="${on}">${locked ? LOCK : ''}${esc(o.name)}${lockText(o, save, key)}</button>`;
    }).join('')}</div></div>`;
  }
  function swatchGroup(title, key, colors, current, save, premium) {
    const prem = premium ? D.PREMIUM_COLORS : [];
    return `<div class="group"><h3 class="group-title">${esc(title)}</h3><div class="swatches" role="group" aria-label="${esc(title)}">${colors.map((c) => `<button type="button" class="sw ${current === c ? 'on' : ''}" style="--c:${c}" data-color="${key}" data-val="${c}" aria-pressed="${current === c}" aria-label="${esc(title)} ${c}"></button>`).join('')}${prem.map((pc) => {
      const owned = save && CR.colorOwned(save, pc.id);
      const canBuy = !owned && S.screen === 'locker';
      return `<button type="button" class="sw premium ${current === pc.id ? 'on' : ''} ${owned ? '' : 'locked'}" style="--c:${pc.id}" ${owned ? `data-color="${key}" data-val="${pc.id}"` : canBuy ? `data-buy="color:${pc.id}" data-cost="${pc.cost}"` : 'disabled'} aria-pressed="${current === pc.id}" aria-label="${esc(pc.name)}${owned ? '' : `, ${pc.cost} cred`}" title="${esc(pc.name)}${owned ? '' : ` · ${pc.cost} cred`}"></button>`;
    }).join('')}</div></div>`;
  }
  function lookSection(sec, look, save) {
    const L = D.LOOK;
    if (sec === 'hair') {
      return chipGroup('Hair', 'hair', L.hair, look.hair, save) + swatchGroup('Hair color', 'hairColor', D.HAIR_COLORS, look.hairColor, save)
        + chipGroup('Facial hair', 'facial', L.facial, look.facial, save) + chipGroup('Brows', 'brows', L.brows, look.brows, save)
        + chipGroup('Eyes', 'eyes', L.eyes, look.eyes, save) + chipGroup('Mouth', 'mouth', L.mouth, look.mouth, save);
    }
    if (sec === 'gear') {
      return chipGroup('Jersey cut', 'jersey', L.jersey, look.jersey, save) + chipGroup('Shorts', 'shorts', L.shorts, look.shorts, save)
        + chipGroup('Headwear', 'headband', L.headband, look.headband, save) + swatchGroup('Headwear and wristband color', 'headbandColor', D.COLORS, look.headbandColor, save, true)
        + chipGroup('Eyewear', 'eyewear', L.eyewear, look.eyewear, save)
        + chipGroup('Arm sleeve', 'armSleeve', L.armSleeve, look.armSleeve, save) + chipGroup('Knee sleeve', 'kneeSleeve', L.kneeSleeve, look.kneeSleeve, save)
        + swatchGroup('Sleeve color', 'sleeveColor', D.COLORS, look.sleeveColor, save, true) + chipGroup('Wristbands', 'wristbands', L.wristbands, look.wristbands, save)
        + chipGroup('Socks', 'socks', L.socks, look.socks, save) + swatchGroup('Sock color', 'sockColor', D.COLORS, look.sockColor, save, true)
        + chipGroup('Shoes', 'shoes', L.shoes, look.shoes, save) + swatchGroup('Shoe color', 'shoeColor', D.COLORS, look.shoeColor, save, true) + swatchGroup('Shoe accent', 'shoeAccent', D.COLORS, look.shoeAccent, save, true)
        + chipGroup('Chain', 'chain', L.chain, look.chain, save) + chipGroup('Ink', 'tattoo', L.tattoo, look.tattoo, save);
    }
    if (sec === 'body') {
      return chipGroup('Build', 'build', ['lean', 'athletic', 'strong', 'heavy'].map((b) => ({ id: b, name: b[0].toUpperCase() + b.slice(1) })), S.save.me.build, save, true)
        + swatchGroup('Skin tone', 'skin', D.SKIN, look.skin, save) + `<p class="hint">Height (${ft(S.save.me.hgt)}) and position are set when you create your player.</p>`;
    }
    if (sec === 'flair') {
      const me = S.save.me;
      return chipGroup('Aura', 'aura', L.aura, look.aura, save) + chipGroup('Ball trail', 'trail', L.trail, look.trail, save)
        + `<div class="group"><h3 class="group-title">Celebration</h3><div class="chips">${D.CELEBRATIONS.map((c) => {
          const locked = !CR.isUnlocked(save, 'celebration', c); const canBuy = locked && c.cost && !c.lvl;
          return `<button type="button" class="chip ${me.celebration === c.id ? 'on' : ''} ${locked ? 'locked' : ''}" ${canBuy ? `data-buy="celebration:${c.id}" data-cost="${c.cost}"` : locked ? 'disabled' : `data-celebrate="${c.id}"`} aria-pressed="${me.celebration === c.id}">${locked ? LOCK : ''}${esc(c.name)}${lockText(c, save, 'celebration')}</button>`;
        }).join('')}</div></div>`
        + `<div class="group"><h3 class="group-title">Signature dunk</h3><div class="chips">${D.DUNK_ORDER.map((k) => {
          const dk = D.DUNKS[k]; const locked = dk.lvl && save.level < dk.lvl;
          return `<button type="button" class="chip ${me.dunk === k ? 'on' : ''} ${locked ? 'locked' : ''}" ${locked ? 'disabled' : `data-dunk="${k}"`} aria-pressed="${me.dunk === k}">${locked ? LOCK : ''}${esc(dk.name)}${locked ? `<small>Lv ${dk.lvl}</small>` : ''}</button>`;
        }).join('')}</div><p class="hint">The more dunks you know, the more you mix in. Turbo dunks lean on your signature.</p></div>`;
    }
    return '';
  }
  function crewEditor(crew, creating) {
    return `<label class="field wide">Crew name<input data-field="crewName" maxlength="18" value="${esc(crew.name)}" autocomplete="off" placeholder="Corner Kings"></label>
      ${swatchGroup('Crew color', 'crew0', D.COLORS, crew.colors[0], creating ? null : S.save)}
      ${swatchGroup('Trim color', 'crew1', D.COLORS, crew.colors[1], creating ? null : S.save)}
      <div class="group"><h3 class="group-title">Crew logo</h3><div class="logo-grid">${D.LOGOS.map((l) => `<button type="button" class="logo-btn ${crew.logo === l ? 'on' : ''}" data-logo="${l}" aria-pressed="${crew.logo === l}" aria-label="${l} logo">${logoCanvas(l, crew.colors[1], crew.colors[0], 40)}</button>`).join('')}</div></div>
      <p class="hint">Your whole crew wears these colors. In versus games, this is what your friend sees across the court.</p>`;
  }

  // ----- career hub -----
  SCREENS.career = () => {
    const s = S.save; if (!s) { S.draft = newDraft(); return SCREENS.create(); }
    const me = CR.mePlayer(s);
    const need = D.repForLevel(s.level);
    const next = nextEvent(s);
    const mates = s.lineup.map((id) => CR.memberById(id)).filter(Boolean);
    const nextCourt = next ? next.court : D.COURT_BY_ID[D.CIRCUIT[D.CIRCUIT.length - 1].court];
    return `${header(esc(s.me.nick), `${esc(s.me.first)} ${esc(s.me.last)} · ${esc(D.ARCHETYPES[s.me.arch].name)} · ${ft(s.me.hgt)} · ${esc(s.crew.name)}`, 'title', 'Title')}
      <div class="hub">
        <div class="hub-card" style="${teamVars(s.crew.colors)}">
          <div class="hc-art">${figure(me, s.crew.colors, { w: 320, h: 400, portrait: true })}${ovrBadge(s.me.r)}<span class="hc-tag">${esc(D.ARCHETYPES[s.me.arch].name)} · #${esc(s.me.num)}</span></div>
          <div class="level"><span class="lvl-badge"><small>LV</small>${s.level}</span>
            <div class="rep"><span class="bar" aria-hidden="true"><i style="width:${s.level >= D.MAX_LEVEL ? 100 : Math.round(s.rep / need * 100)}%"></i></span><small>${s.level >= D.MAX_LEVEL ? 'Max level' : `${Math.round(s.rep)} / ${need} REP to level ${s.level + 1}`}</small></div></div>
          <div class="wallet"><span><b>${s.points}</b> skill points</span><span><b>${s.cred.toLocaleString()}</b> cred</span></div>
          ${statBars(s.me.r)}
        </div>
        <div class="hub-menu">
          ${next ? `<div class="next-up"><span class="nu-art" aria-hidden="true">${sceneCanvas(next.court)}</span><span class="kicker">Next up · Stop ${next.ci + 1}</span><b>${esc(next.ev.name)}</b><span>${esc(next.court.name)} · vs ${esc(next.ev.crew.name)} · first to ${next.ev.target}</span>${btn('play-next', 'Play it', 'primary big')}</div>` : `<div class="next-up"><span class="nu-art" aria-hidden="true">${sceneCanvas(nextCourt)}</span><span class="kicker">Long live the king</span><b>You beat the whole circuit.</b><span>Replay any court for REP and cred, or take your crew to a friend.</span></div>`}
          <div class="hub-tiles">
            ${tile('nav-circuit', 'The Circuit', 'Eight courts, one crown.', { idx: '01', art: art(640, 360, paintCourt(nextCourt)) })}
            ${tile('nav-upgrade', 'Upgrade', `${s.points} point${s.points === 1 ? '' : 's'} to spend.`, { idx: '02', cls: s.points ? 'glow' : '', badge: s.points ? `${s.points} ready` : '', artCls: 'icon-art', art: ICON_UPGRADE })}
            ${tile('nav-locker', 'Locker', 'Looks, gear, auras, dunks.', { idx: '03', artCls: 'icon-art', art: jerseyIcon(s.crew.colors, s.me.num) })}
            ${tile('nav-crew', 'Crew', `${s.roster.length} players · pick your two.`, { idx: '04', art: mates.length === 2 ? art(640, 360, paintSplit(mates[0], s.crew.colors, mates[1], s.crew.colors)) : '' })}
          </div>
          <div class="save-box">
            <h3 class="group-title">Your save</h3>
            <p>Saved in this browser after every game. To keep it safe or play on another computer, save a file. On a Chromebook, pick <b>Google Drive</b> in the save window.</p>
            <div class="row">${btn('save-file', 'Save file (Drive)', 'primary')}${btn('load-career', 'Load save file', '')}</div>
            <p class="hint">Last saved here: ${esc(new Date(s.updated).toLocaleString())}</p>
          </div>
          <details class="career-stats"><summary>Career numbers</summary>
            <dl>${[['Games', s.stats.games], ['Record', `${s.stats.wins}–${s.stats.losses}`], ['Points', s.stats.pts], ['Dunks', s.stats.dunks], ['Blocks', s.stats.blocks], ['Steals', s.stats.steals], ['Ankles broken', s.stats.ankles], ['Crowns', s.stats.crowns], ['Best style game', s.stats.bestStyle.toLocaleString()], ['Versus', `${s.stats.versusWins}–${s.stats.versusLosses}`]].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
            ${btn('wipe', 'Start a new career', 'danger small')}
          </details>
        </div>
      </div>`;
  };
  const ICON_UPGRADE = `<svg viewBox="0 0 120 110" aria-hidden="true"><g transform="translate(18 0) skewX(-12)" stroke="#07080c" stroke-width="4" stroke-linejoin="round">
      <rect x="6" y="64" width="24" height="40" fill="#2a3044"/><rect x="40" y="42" width="24" height="62" fill="#a9afc0"/><rect x="74" y="22" width="24" height="82" fill="#ffc629"/>
      <rect x="74" y="22" width="24" height="30" fill="#ffe27a"/></g>
      <path d="M60 4 78 22H67v12H53V22H42z" fill="#fff" stroke="#07080c" stroke-width="4" stroke-linejoin="round" transform="translate(-26 8)"/></svg>`;
  function jerseyIcon(cols, num) {
    const shape = 'M40 8h12q8 16 16 0h12l3 14q6 18 19 22v66H18V44q13-4 19-22z';
    return `<svg viewBox="0 0 120 120" aria-hidden="true"><path d="${shape}" transform="translate(5 5)" fill="#000"/>
      <path d="${shape}" fill="${esc(cols[0])}" stroke="#07080c" stroke-width="4" stroke-linejoin="round"/>
      <path d="M70 8h10l3 14q6 18 19 22v66H70z" fill="#000" fill-opacity=".22"/>
      <path d="M44 9q16 34 32 0" fill="none" stroke="${esc(cols[1])}" stroke-width="5"/>
      <text x="60" y="94" text-anchor="middle" font-family="Anton, Impact, sans-serif" font-size="44" fill="${esc(cols[1])}" stroke="#07080c" stroke-width="5" paint-order="stroke">${esc(num)}</text>
      <path d="${shape}" fill="none" stroke="#07080c" stroke-width="4" stroke-linejoin="round"/></svg>`;
  }
  function nextEvent(s) {
    for (const e of D.allEvents()) { if (!s.beaten.includes(e.ev.id) && CR.eventOpen(s, e.ci, e.ei)) return e; }
    return null;
  }

  // ----- circuit -----
  SCREENS.circuit = () => {
    const s = S.save;
    return `${header(`<span class="circuit-title">The Circuit${BK.assets && BK.assets.get('trophy') ? `<img class="circuit-trophy" src="${BK.assets.url('trophy')}" width="80" height="80" alt="">` : ''}</span>`, 'Beat three crews to call out the king. Beat the king to open the next court.', 'career', 'Career')}
      <div class="circuit">${D.CIRCUIT.map((stop, ci) => {
        const court = D.COURT_BY_ID[stop.court]; const open = CR.courtOpen(s, ci);
        const done = stop.events.filter((e) => s.beaten.includes(e.id)).length;
        return `<article class="court-card ${open ? '' : 'locked'}">
          <div class="court-art">${sceneCanvas(court)}${open ? '' : '<span class="court-lock"><i class="lk" aria-hidden="true"></i>Locked</span>'}${done === stop.events.length ? '<span class="stamp">Conquered</span>' : ''}</div>
          <div class="court-info"><span class="stop-no" aria-hidden="true">${String(ci + 1).padStart(2, '0')}</span><span class="kicker">Stop ${ci + 1}</span><h3>${esc(court.name)}</h3><p>${esc(court.where)}</p>
          <div class="progress"><span aria-hidden="true">${stop.events.map((e) => `<i class="${s.beaten.includes(e.id) ? 'on' : ''}"></i>`).join('')}</span>${done}/${stop.events.length} beaten</div>
          <ul class="events">${stop.events.map((ev, ei) => {
            const beat = s.beaten.includes(ev.id); const eo = CR.eventOpen(s, ci, ei);
            return `<li><button type="button" class="event ${beat ? 'beat' : ''} ${ev.king ? 'king' : ''}" ${eo ? `data-event="${ci}:${ei}"` : 'disabled'}>
              <span class="ev-status ${beat ? 'is-beat' : eo ? (ev.king ? 'is-king' : 'is-open') : 'is-locked'}" aria-hidden="true"></span>
              <span class="ev-name">${esc(ev.name)}<small>vs ${esc(ev.crew.name)} · to ${ev.target}${ev.rule !== 'standard' ? ' · ' + esc(D.RULES[ev.rule].name) : ''}</small></span>${beat ? '<span class="ev-tag won">Won</span>' : ev.king ? '<span class="ev-tag king">King</span>' : ''}${eo ? '' : '<span class="sr">Locked</span>'}</button></li>`;
          }).join('')}</ul>${open ? '' : '<p class="hint">Beat the king of the last court to open this one.</p>'}</div></article>`;
      }).join('')}</div>`;
  };

  SCREENS.event = () => {
    const s = S.save; const [ci, ei] = S.arg; const stop = D.CIRCUIT[ci]; const ev = stop.events[ei]; const court = D.COURT_BY_ID[stop.court];
    const opp = ev.crew.members.map((m) => D.memberFor(m, court.tier));
    const mine = CR.crewFromSave(s);
    const first = !s.beaten.includes(ev.id);
    return `${header(esc(ev.name), `${esc(court.name)} · first to ${ev.target} · ${esc(D.RULES[ev.rule].name)}: ${esc(D.RULES[ev.rule].blurb)}`, 'circuit', 'Circuit', `Stop ${ci + 1} · ${ev.king ? 'King of the court' : 'Matchup'}`)}
      <div class="matchup">
        <div class="side"><div class="side-head" style="${teamVars(s.crew.colors)}">${logoCanvas(s.crew.logo, s.crew.colors[1], s.crew.colors[0])}<h3>${esc(s.crew.name)}</h3></div>${mine.players.map((p) => playerCard(p, s.crew.colors, { stats: true })).join('')}
          ${btn('nav-crew', 'Change your two', 'small ghost')}</div>
        <div class="vs-mark" aria-hidden="true">VS</div>
        <div class="side"><div class="side-head" style="${teamVars(ev.crew.colors)}">${logoCanvas(ev.crew.logo, ev.crew.colors[1], ev.crew.colors[0])}<h3>${esc(ev.crew.name)}</h3></div>${opp.map((p) => playerCard(p, ev.crew.colors, { stats: true, bio: true })).join('')}</div>
      </div>
      <div class="event-foot">
        <p>${first ? `Win and you take <b>bonus REP and cred</b>, plus you get to <b>recruit one of them</b> to your crew.` : 'Already beaten. Run it back for REP and cred.'}${ev.king ? ' This is the king of the court. Beat them to open the next stop.' : ''}</p>
        <p class="hint">Difficulty: ${DIFF[settings.difficulty].name} (change it in Settings).</p>
        ${btn('play-event', 'Lace up', 'primary big')}
      </div>`;
  };

  // ----- upgrade -----
  SCREENS.upgrade = () => {
    const s = S.save; const cap = CR.statCap(s.level);
    return `${header('Upgrade', `${s.points} skill point${s.points === 1 ? '' : 's'} to spend · ratings cap at ${cap} right now (it rises every 4 levels)`, 'career', 'Career')}
      <div class="upgrade">${D.STATS.map((st) => {
        const v = s.me.r[st.key]; const c = CR.canUpgrade(s, st.key);
        return `<div class="up-row ${c.ok ? 'can' : ''}"><div class="up-info"><b>${st.name}</b><span>${st.blurb}</span></div>
          <div class="up-bar"><span class="pips" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i class="${i < v ? 'on' : i < cap ? '' : 'capped'}"></i>`).join('')}</span><b class="up-val">${v}</b></div>
          <button type="button" class="btn small ${c.ok ? 'primary' : ''}" data-up="${st.key}" ${c.ok ? '' : 'disabled'} aria-label="Upgrade ${st.name}">${c.ok ? `+1 · ${c.cost} pt${c.cost > 1 ? 's' : ''}` : esc(c.why)}</button></div>`;
      }).join('')}</div>
      <p class="hint">Upgrades cost more as a rating climbs: 1 point up to 6, 2 points up to 8, 3 to 9, 4 to hit 10. Every level gives you ${D.POINTS_PER_LEVEL}.</p>`;
  };

  // ----- locker -----
  SCREENS.locker = () => {
    const s = S.save; const tab = S.tab;
    const tabs = [['hair', 'Hair & face'], ['gear', 'Gear'], ['body', 'Body'], ['flair', 'Flair & moves'], ['crew', 'Crew colors']];
    const look = s.me.look;
    let body;
    if (tab === 'crew') body = crewEditor(s.crew, false);
    else body = lookSection(tab, look, s);
    return `${header('Locker', `${s.cred.toLocaleString()} cred · Level ${s.level}. Locked items open up with levels; the rest you buy with cred.`, 'career', 'Career')}
      <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" class="tab ${tab === k ? 'on' : ''}" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}</div>
      <div class="editor"><div class="preview-col">${previewBox()}</div><div class="edit-col">${body}</div></div>`;
  };

  // ----- crew -----
  SCREENS.crew = () => {
    const s = S.save;
    const roster = s.roster.map((id) => ({ id, p: CR.memberById(id) })).filter((x) => x.p);
    return `${header('Your crew', 'You always play. Pick the two who run with you. Beat a crew for the first time to recruit one of them.', 'career', 'Career')}
      <div class="roster">${roster.map(({ id, p }) => {
        const on = s.lineup.includes(id);
        return `<button type="button" class="roster-pick ${on ? 'on' : ''}" data-lineup="${esc(id)}" aria-pressed="${on}">${playerCard(p, s.crew.colors, { stats: true, w: 80, h: 108 })}<span class="pick-tag">${on ? 'Starting' : 'Bench'}</span></button>`;
      }).join('')}</div>`;
  };

  // ----- quick game -----
  SCREENS.quick = () => {
    const q = S.quick || (S.quick = { team: S.save ? 'mine' : 'q-kings', opp: 'q-show', court: 'lot', target: 21, rule: 'standard' });
    const crews = (S.save ? [{ id: 'mine', name: `${S.save.crew.name} (your crew)` }] : []).concat(D.QUICK_CREWS);
    const courts = CR.openCourts(S.save);
    if (!courts.some((c) => c.id === q.court)) q.court = courts[0].id;
    const opt = (list, cur) => list.map((c) => `<option value="${esc(c.id)}" ${c.id === cur ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    const teamA = q.team === 'mine' && S.save ? CR.crewFromSave(S.save) : crewSpec(D.QUICK_CREWS.find((c) => c.id === q.team) || D.QUICK_CREWS[0]);
    const teamB = crewSpec(D.QUICK_CREWS.find((c) => c.id === q.opp) || D.QUICK_CREWS[1]);
    return `${header('Quick Game', 'You run the first crew. The computer runs the other.', 'title', 'Title')}
      <div class="setup">
        <label class="field">Your crew<select data-q="team">${opt(crews, q.team)}</select></label>
        <label class="field">Opponent<select data-q="opp">${opt(D.QUICK_CREWS, q.opp)}</select></label>
        <label class="field">Court<select data-q="court">${opt(courts, q.court)}</select></label>
        <label class="field">First to<select data-q="target">${[7, 11, 15, 21].map((n) => `<option value="${n}" ${q.target === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field">Rules<select data-q="rule">${Object.keys(D.RULES).map((k) => `<option value="${k}" ${q.rule === k ? 'selected' : ''}>${esc(D.RULES[k].name)}</option>`).join('')}</select></label>
        <label class="field">Difficulty<select data-set="difficulty">${Object.keys(DIFF).map((k) => `<option value="${k}" ${settings.difficulty === k ? 'selected' : ''}>${DIFF[k].name}</option>`).join('')}</select></label>
      </div>
      ${courts.length < D.COURTS.length ? `<p class="hint">More courts open up as you win the circuit in Career.</p>` : ''}
      <div class="matchup compact">
        <div class="side"><div class="side-head" style="${teamVars(teamA.colors)}">${logoCanvas(teamA.logo, teamA.colors[1], teamA.colors[0])}<h3>${esc(teamA.name)}</h3></div>${teamA.players.map((p) => playerCard(p, teamA.colors, {})).join('')}</div><div class="vs-mark" aria-hidden="true">VS</div>
        <div class="side"><div class="side-head" style="${teamVars(teamB.colors)}">${logoCanvas(teamB.logo, teamB.colors[1], teamB.colors[0])}<h3>${esc(teamB.name)}</h3></div>${teamB.players.map((p) => playerCard(p, teamB.colors, {})).join('')}</div>
      </div>
      <div class="event-foot">${btn('play-quick', 'Ball', 'primary big')}</div>`;
  };

  // ----- versus -----
  SCREENS.versus = () => {
    const v = S.vs || (S.vs = { src: [S.save ? 'career' : 'crew', 'crew'], crew: ['q-kings', 'q-show'], file: [null, null], court: 'lot', target: 15, rule: 'standard' });
    const courts = D.COURTS;
    const sideHtml = (i) => {
      const src = v.src[i];
      const team = versusTeam(i);
      return `<div class="side vs-side"><h3>Player ${i + 1}</h3>
        <div class="seg" role="group" aria-label="Player ${i + 1} crew">
          ${S.save ? `<button type="button" class="chip ${src === 'career' ? 'on' : ''}" data-vsrc="${i}:career" aria-pressed="${src === 'career'}">This browser's career</button>` : ''}
          <button type="button" class="chip ${src === 'file' ? 'on' : ''}" data-vsrc="${i}:file" aria-pressed="${src === 'file'}">Load a save file</button>
          <button type="button" class="chip ${src === 'crew' ? 'on' : ''}" data-vsrc="${i}:crew" aria-pressed="${src === 'crew'}">Legend crew</button>
        </div>
        ${src === 'crew' ? `<label class="field">Crew<select data-vcrew="${i}">${D.QUICK_CREWS.map((c) => `<option value="${c.id}" ${v.crew[i] === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>` : ''}
        ${src === 'file' ? `${btn('vs-load', v.file[i] ? 'Load a different file' : 'Pick their save file', v.file[i] ? 'small' : 'primary', `data-side="${i}"`)}` : ''}
        ${team ? `<div class="side-head" style="${teamVars(team.colors)}">${logoCanvas(team.logo, team.colors[1], team.colors[0], 36)}<h3>${esc(team.name)}</h3>${team.level ? `<small>LV ${team.level}</small>` : ''}</div><div class="mini-roster">${team.players.map((p) => playerCard(p, team.colors, { w: 70, h: 94 })).join('')}</div>` : '<p class="hint">No crew loaded yet.</p>'}
        <p class="keys">${i === 0 ? 'Keyboard: WASD move · F shoot · G pass · H trick · R oop · T crown · Shift turbo' : 'Keyboard: arrows move · , shoot · . pass · / trick · L oop · ; crown · M turbo'}<br>Or plug in a gamepad.</p>
      </div>`;
    };
    return `${header('Versus', 'Two players, one screen. Bring the crews you built: load each save file, or play this browser\'s career against a friend\'s file.', 'title', 'Title')}
      <div class="matchup versus">${sideHtml(0)}<div class="vs-mark" aria-hidden="true">VS</div>${sideHtml(1)}</div>
      <div class="setup">
        <label class="field">Court<select data-v="court">${courts.map((c) => `<option value="${c.id}" ${v.court === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
        <label class="field">First to<select data-v="target">${[7, 11, 15, 21].map((n) => `<option value="${n}" ${v.target === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field">Rules<select data-v="rule">${Object.keys(D.RULES).map((k) => `<option value="${k}" ${v.rule === k ? 'selected' : ''}>${esc(D.RULES[k].name)}</option>`).join('')}</select></label>
      </div>
      <p class="hint">Two gamepads? Each player gets one. One gamepad? It goes to Player 1 and Player 2 uses the keyboard. Every court is open in Versus. If this browser's career plays, it earns REP and cred.</p>
      <div class="event-foot">${btn('play-vs', 'Run it', 'primary big')}</div>`;
  };
  function versusTeam(i) {
    const v = S.vs; const src = v.src[i];
    if (src === 'career' && S.save) return Object.assign(CR.crewFromSave(S.save), { level: S.save.level });
    if (src === 'file' && v.file[i]) return Object.assign(CR.crewFromSave(v.file[i]), { level: v.file[i].level });
    if (src === 'crew') return crewSpec(D.QUICK_CREWS.find((c) => c.id === v.crew[i]) || D.QUICK_CREWS[i]);
    return null;
  }

  // ----- challenge -----
  SCREENS.challenge = () => {
    const c = S.ch || (S.ch = { file: null, court: 'lot', target: 15 });
    if (!S.save) {
      return `${header('Challenge a Friend', 'Load a friend\'s save file and play against the crew they built. The computer runs their side.', 'title', 'Title')}
        <div class="empty"><p>You need a career first, so there's a crew to bring.</p>${btn('nav-career', 'Build your baller', 'primary big')}</div>`;
    }
    const mine = CR.crewFromSave(S.save);
    const theirs = c.file ? CR.crewFromSave(c.file) : null;
    return `${header('Challenge a Friend', 'Load a friend\'s save file and play against the crew they built. The computer runs their side, at their ratings, on Legend smarts.', 'title', 'Title')}
      <div class="matchup">
        <div class="side"><div class="side-head" style="${teamVars(mine.colors)}">${logoCanvas(mine.logo, mine.colors[1], mine.colors[0])}<h3>${esc(mine.name)}</h3></div>${mine.players.map((p) => playerCard(p, mine.colors, { stats: true })).join('')}</div>
        <div class="vs-mark" aria-hidden="true">VS</div>
        <div class="side">${theirs ? `<div class="side-head" style="${teamVars(theirs.colors)}">${logoCanvas(theirs.logo, theirs.colors[1], theirs.colors[0])}<h3>${esc(theirs.name)}</h3><small>LV ${c.file.level}</small></div>${theirs.players.map((p) => playerCard(p, theirs.colors, { stats: true })).join('')}${btn('ch-load', 'Load a different file', 'small ghost')}` : `<div class="empty"><p>Ask your friend for their save file (in Career, they hit <b>Save file</b>). If it's in Google Drive, it shows up in the file picker.</p>${btn('ch-load', 'Load their save', 'primary big')}</div>`}</div>
      </div>
      ${theirs ? `<div class="setup"><label class="field">Court<select data-c="court">${D.COURTS.map((ct) => `<option value="${ct.id}" ${c.court === ct.id ? 'selected' : ''}>${esc(ct.name)}</option>`).join('')}</select></label>
        <label class="field">First to<select data-c="target">${[11, 15, 21].map((n) => `<option value="${n}" ${c.target === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
        <div class="event-foot">${btn('play-ch', 'Take them on', 'primary big')}</div>` : ''}`;
  };

  // ----- how to play -----
  SCREENS.howto = () => {
    const K = BK.KEYS;
    const row = (label, k) => `<tr><th scope="row">${label}</th><td>${kbdify(K.solo[k])}</td><td>${esc(K.pad[k])}</td></tr>`;
    return `${header('How to Play', 'Three on three on half a court. First crew to the target wins.', S.match ? null : 'title', 'Title')}
      <div class="howto">
        <section><h3>Controls</h3>
          <table class="keys-table"><thead><tr><th scope="col">Action</th><th scope="col">Keyboard</th><th scope="col">Gamepad</th></tr></thead><tbody>
            ${row('Move', 'move')}${row('Shoot (hold, let go at the top) · Block on defense', 'shoot')}${row('Pass · Switch player on defense', 'pass')}${row('Trick (aim with the stick) · Steal on defense', 'trick')}
            ${row('Alley-oop (hold turbo to throw it off the glass to yourself)', 'oop')}${row('Crown shot (when the meter is full)', 'crown')}${row('Turbo (hold)', 'turbo')}${row('Pause', 'pause')}
          </tbody></table>
          <p>On a touchscreen, a stick and buttons appear on the court. In Versus, Player 1 uses WASD with F, G, H, R, T and Left Shift. Player 2 uses the arrows with comma, period, slash, L, semicolon and M.</p></section>
        <section><h3>Scoring</h3><p>Inside the arc is <b>1</b>. Outside the arc is <b>2</b>. Dunks count as inside. No fouls, no clearing, and the fence keeps the ball in play. After a basket, the other crew checks it up top.</p>
          <p><b>Jump shots:</b> hold shoot to rise, let go at the top of your jump. A meter shows the green window. Hit it for a <b>Perfect</b> release. A quick tap is a safe, average release.</p>
          <p><b>Dunks:</b> press shoot near the rim. Hold turbo to take off from farther out, with your flashiest dunks. Big dunkers can fly from the free throw line.</p></section>
        <section><h3>Tricks and the Crown meter</h3><p>Tap trick with a direction: toward the rim spins, across the court crosses over, away goes behind the back, no direction hesitates. Hold turbo for the flashy version: Tornado, Around the World, Head Bounce, or Off the Dome, which bounces the ball off your defender's head.</p>
          <p>Tricks near a defender can make them stumble or break their ankles. Every trick earns <b>style points</b>, and chaining different ones multiplies them. You only bank style when you score, so a turnover wipes it.</p>
          <p>Banked style fills the <b>Crown meter</b>. When it's full, press crown on offense. Your next bucket is a <b>Crown shot</b>: it adds extra points to you and takes the same amount from them. Fill it twice for a Double Crown. A Crown dunk shatters the backboard.</p></section>
        <section><h3>Defense</h3><p>Stay between your man and the rim. Jump to block as they rise; good timing and height win. Reach for steals when they're dribbling, not when they're doing a trick. Make three in a row and you're <b>on fire</b> until they score.</p></section>
        <section><h3>Career and saving</h3><p>Build your baller, run the circuit, recruit the crews you beat, and level up. Each level gives skill points and opens new looks and dunks. Cred buys the rest in the Locker.</p>
          <p>Your career saves itself in this browser. To keep it in <b>Google Drive</b>, open Career and press <b>Save file</b>. On a Chromebook or in Chrome, the save window lists Google Drive on the left. Pick a folder and save. To load it on another computer, press <b>Load save file</b> and pick it from Drive. Bring that same file to a friend's computer for Versus, or send it so they can Challenge your crew.</p></section>
      </div>`;
  };

  SCREENS.settings = () => `${header('Settings', '', 'title', 'Title')}
    <div class="settings">
      <div class="group"><h3 class="group-title">Sound</h3><div class="chips">${btn('toggle-sound', BK.audio.settings.on ? 'Sound on' : 'Sound off', 'chip' + (BK.audio.settings.on ? ' on' : ''), `aria-pressed="${BK.audio.settings.on}"`)}</div>
        <label class="field wide">Music<input type="range" min="0" max="100" value="${Math.round(BK.audio.settings.music * 100)}" data-vol="music"></label>
        <label class="field wide">Effects and crowd<input type="range" min="0" max="100" value="${Math.round(BK.audio.settings.sfx * 100)}" data-vol="sfx"></label></div>
      <div class="group"><h3 class="group-title">Difficulty</h3><div class="chips">${Object.keys(DIFF).map((k) => `<button type="button" class="chip ${settings.difficulty === k ? 'on' : ''}" data-setting="difficulty" data-val="${k}" aria-pressed="${settings.difficulty === k}">${DIFF[k].name}</button>`).join('')}</div>
        <p class="hint">Chill: slower reads, softer defense. Street: the real thing. Legend: they block your shots and talk about it.</p></div>
      <div class="group"><h3 class="group-title">Visual effects</h3><div class="chips">${[['full', 'Full (shake, slow motion, flashes)'], ['reduced', 'Reduced (no shake or flashes)']].map(([k, l]) => `<button type="button" class="chip ${settings.effects === k ? 'on' : ''}" data-setting="effects" data-val="${k}" aria-pressed="${settings.effects === k}">${l}</button>`).join('')}</div></div>
      <div class="group"><h3 class="group-title">Camera</h3><div class="chips">${[['close', 'Close (follows the ball)'], ['wide', 'Wide (whole half court)']].map(([k, l]) => `<button type="button" class="chip ${settings.camera === k ? 'on' : ''}" data-setting="camera" data-val="${k}" aria-pressed="${settings.camera === k}">${l}</button>`).join('')}</div></div>
      <div class="group"><h3 class="group-title">Touch controls</h3><div class="chips">${[['auto', 'Automatic'], ['on', 'Always show'], ['off', 'Never show']].map(([k, l]) => `<button type="button" class="chip ${settings.touch === k ? 'on' : ''}" data-setting="touch" data-val="${k}" aria-pressed="${settings.touch === k}">${l}</button>`).join('')}</div></div>
    </div>`;

  // ----- results -----
  SCREENS.results = () => {
    const R = S.last; if (!R) return SCREENS.title();
    const { res, cfg, rw } = R;
    const you = cfg.youTeam == null ? 0 : cfg.youTeam;
    const win = res.winner === you;
    const versus = cfg.mode === 'versus';
    const head = versus ? `${esc(cfg.teams[res.winner].name)} win` : win ? 'Victory' : 'Defeat';
    const table = (ti) => {
      const t = cfg.teams[ti];
      return `<div class="box-wrap"><table class="box" style="${teamVars(t.colors)}"><caption>${esc(t.name)} · ${res.score[ti]}</caption><thead><tr><th scope="col">Player</th><th scope="col">PTS</th><th scope="col">DNK</th><th scope="col">AST</th><th scope="col">REB</th><th scope="col">BLK</th><th scope="col">STL</th><th scope="col">ANK</th><th scope="col">STYLE</th></tr></thead><tbody>
        ${res.players.filter((p) => p.team === ti).map((p) => `<tr${res.mvp && res.mvp.id === p.id && res.mvp.team === ti ? ' class="mvp"' : ''}><th scope="row">${esc(p.name)}${res.mvp && res.mvp.id === p.id && res.mvp.team === ti ? ' <span class="mvp-tag">MVP</span>' : ''}</th><td>${p.stats.pts}</td><td>${p.stats.dnk}</td><td>${p.stats.ast}</td><td>${p.stats.reb}</td><td>${p.stats.blk}</td><td>${p.stats.stl}</td><td>${p.stats.ankles}</td><td>${p.stats.style.toLocaleString()}</td></tr>`).join('')}
      </tbody></table></div>`;
    };
    const side = (ti) => {
      const t = cfg.teams[ti];
      return `<div class="final-team ${ti ? 'right' : ''} ${res.winner === ti ? 'win' : 'lose'}" style="${teamVars(t.colors)}">${logoCanvas(t.logo, t.colors[1], t.colors[0], 40)}<b>${esc(t.name)}</b><span class="final-score">${res.score[ti]}</span></div>`;
    };
    // Player of the game: the MVP's card with their line.
    let mvp = '';
    const mv = res.mvp && cfg.teams[res.mvp.team] && cfg.teams[res.mvp.team].players.find((p) => p.id === res.mvp.id);
    const mvStats = res.mvp && (res.players.find((p) => p.id === res.mvp.id && p.team === res.mvp.team) || {}).stats;
    if (mv && mvStats) {
      const cols = cfg.teams[res.mvp.team].colors;
      mvp = `<div class="mvp-card">${figure(mv, cols, { w: 96, h: 120, portrait: true })}<div><span class="kicker">Player of the game</span><b>${esc(res.mvp.name)}</b>
        <div class="mvp-line">${[['PTS', mvStats.pts], ['AST', mvStats.ast], ['BLK', mvStats.blk], ['STYLE', mvStats.style.toLocaleString()]].map(([k, v]) => `<span><em>${v}</em>${k}</span>`).join('')}</div></div></div>`;
    }
    let rewards = '';
    if (rw) {
      rewards = `<div class="rewards"><h3>Rewards</h3><p class="reward-line"><span><b>+${rw.rep}</b> REP</span><span><b>+${rw.cred}</b> cred</span>${rw.ups.length ? `<span class="lvlup">Level up <b>${S.save.level}</b> +${rw.ups.length * D.POINTS_PER_LEVEL} skill points</span>` : ''}</p>
        ${rw.unlocked.length ? `<ul class="unlocks">${rw.unlocked.map((u) => `<li><span class="sr">Unlocked: </span>${esc(u)}</li>`).join('')}</ul>` : ''}
        ${R.firstWin ? `<p class="first-win">First win over ${esc(cfg.teams[1 - you].name)}${R.king ? ' and the crown of this court. The next stop is open.' : '.'}</p>` : ''}</div>`;
    }
    let recruit = '';
    if (R.recruits && R.recruits.length && !R.recruited) {
      recruit = `<div class="recruit"><h3>Recruit one</h3><p>Pick a player to join your crew. You can swap who starts any time.</p>
        <div class="roster">${R.recruits.map(({ id, p }) => `<button type="button" class="roster-pick" data-recruit="${esc(id)}">${playerCard(p, cfg.teams[1 - you].colors, { stats: true, bio: true, w: 80, h: 108 })}<span class="pick-tag">Recruit</span></button>`).join('')}</div>
        <button type="button" class="link" data-act="skip-recruit">Skip</button></div>`;
    } else if (R.recruited) {
      recruit = `<div class="recruit"><p><b>${esc(R.recruited)}</b> joined your crew. Put them in the lineup from <b>Crew</b>.</p></div>`;
    }
    return `<section class="results ${win ? 'won' : 'lost'}">
      ${header(`${win && BK.assets && BK.assets.get('trophy') ? `<img class="result-trophy" src="${BK.assets.url('trophy')}" width="72" height="72" alt="">` : ''}<span class="result-mark">${versus ? '★' : win ? 'W' : 'L'}</span>${head}`, `${esc(cfg.teams[0].name)} vs ${esc(cfg.teams[1].name)} · ${esc(cfg.court.name)} · first to ${cfg.target}`, null, null, `Final · ${esc(cfg.court.name)}`)}
      <div class="final" role="group" aria-label="Final score">${side(0)}<div class="final-mid">Final<small>to ${cfg.target}</small></div>${side(1)}</div>
      ${mvp || rewards || recruit ? `<div class="results-top ${mvp && (rewards || recruit) ? '' : 'solo'}">${mvp ? `<div>${mvp}</div>` : ''}${rewards || recruit ? `<div>${rewards}${recruit}</div>` : ''}</div>` : ''}
      <div class="boxes">${table(0)}${table(1)}</div>
      <div class="event-foot">${btn('again', 'Run it back', 'primary')}${cfg.mode === 'career' ? btn('nav-circuit', 'Circuit', '') + btn('nav-career', 'Career', '') : btn('nav-title', 'Main menu', '')}${S.save && cfg.mode !== 'quick' ? btn('save-file', 'Save file (Drive)', 'ghost') : ''}</div>
    </section>`;
  };

  SCREENS.match = () => '';

  // ---------- starting and ending games ----------
  function startMatch(cfg) {
    if (S.attract) { S.attract.stop(); S.attract = null; }
    if (S.match) { S.match.destroy(); S.match = null; }
    cancelAnimationFrame(S.raf);
    S.screen = 'match'; document.body.dataset.screen = 'match';
    app.innerHTML = ''; app.hidden = true;
    const humans = [];
    const pads = BK.input.padIndices();
    if (cfg.mode === 'versus') {
      humans.push({ team: 0, ctrl: new BK.input.Controller({ layout: 'p1', pad: pads.length >= 1 ? pads[0] : null, touch: false }), label: 'P1', keyLayout: 'p1' });
      humans.push({ team: 1, ctrl: new BK.input.Controller({ layout: 'p2', pad: pads.length >= 2 ? pads[1] : null, touch: false }), label: 'P2', keyLayout: 'p2' });
    } else {
      humans.push({ team: 0, ctrl: new BK.input.Controller({ layout: 'solo', pad: 'any', touch: true }), label: 'YOU', keyLayout: 'solo' });
    }
    let hintSeen = false; try { hintSeen = localStorage.getItem('bk-hint') === '1'; localStorage.setItem('bk-hint', '1'); } catch (e) { /* ignore */ }
    cfg.crownsOn = [0, 0];
    const m = new BK.Match(canvas, {
      court: cfg.court, target: cfg.target, rule: cfg.rule, teams: cfg.teams, skill: cfg.skill, firstOffense: cfg.firstOffense,
      humans, reducedMotion: settings.effects === 'reduced', camera: settings.camera, showHint: !hintSeen || cfg.mode === 'versus',
      onEnd: (res) => endMatch(res, cfg), onPause: () => showPause(),
      onEvent: (type, data) => { if (type === 'crownOn') cfg.crownsOn[data.team]++; },
    });
    humans.forEach((h, i) => { m.humans[i].keyLayout = h.keyLayout; });
    S.match = m; S.matchCfg = cfg;
    const showTouch = settings.touch === 'on' || (settings.touch === 'auto' && BK.input.isTouchDevice());
    if (cfg.mode !== 'versus' && showTouch) { BK.input.buildTouch(touchHost); BK.input.showTouch(true); } else BK.input.showTouch(false);
    m.start();
    BK.audio.music('game');
    canvas.focus({ preventScroll: true });
  }
  function endMatch(res, cfg) {
    const m = S.match; if (m) { m.destroy(); }
    S.match = null; BK.input.showTouch(false); hidePause();
    BK.audio.music('menu');
    const you = cfg.youTeam == null ? 0 : cfg.youTeam;
    const R = { res, cfg, rw: null, recruits: null, recruited: null };
    const s = S.save;
    const careerSide = cfg.careerSide; // which team index is this browser's career, if any
    if (s && careerSide != null) {
      const win = res.winner === careerSide;
      const meStats = (res.players.find((p) => p.id === 'me' && p.team === careerSide) || {}).stats || {};
      const teamStyle = res.players.filter((p) => p.team === careerSide).reduce((n, p) => n + p.stats.style, 0);
      if (cfg.mode === 'career') {
        const ev = cfg.event; const first = win && !s.beaten.includes(ev.id);
        if (win) { s.wins[ev.id] = (s.wins[ev.id] || 0) + 1; if (first) s.beaten.push(ev.id); }
        R.rw = CR.reward(s, { win, tier: cfg.court.tier, first, king: !!ev.king, me: meStats, teamStyle, crowns: cfg.crownsOn[careerSide], mode: 'career' });
        R.firstWin = first; R.king = !!ev.king;
        if (first) {
          R.recruits = ev.crew.members.map((m2) => ({ id: CR.idForSpec(m2, cfg.court.tier), p: D.memberFor(m2, cfg.court.tier) })).filter((x) => !s.roster.includes(x.id));
        }
      } else {
        R.rw = CR.reward(s, { win, tier: cfg.court.tier, first: false, me: meStats, teamStyle, crowns: cfg.crownsOn[careerSide], mode: cfg.mode === 'quick' ? 'versus' : 'versus' });
      }
      CR.store(s);
    }
    S.last = R;
    go('results');
    void you;
  }

  function showPause() {
    if (!S.match || S.match.paused) return;
    S.match.pause();
    BK.input.capture(false);
    let el = $('#pause'); if (el) el.remove();
    el = document.createElement('div'); el.id = 'pause'; el.className = 'pause'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Paused');
    const K = S.matchCfg.mode === 'versus' ? null : BK.KEYS.solo;
    const [t0, t1] = S.match.teams;
    el.innerHTML = `<div class="pause-card"><span class="kicker">${esc(S.matchCfg.court.name)} · first to ${S.matchCfg.target}</span><h2>Paused</h2>
      <p class="pause-score">${esc(t0.name)} <b>${t0.score}</b> – <b>${t1.score}</b> ${esc(t1.name)}</p>
      <button type="button" class="btn primary big" data-p="resume">Resume</button>
      <button type="button" class="btn" data-p="sound">${BK.audio.settings.on ? 'Sound: On' : 'Sound: Off'}</button>
      <button type="button" class="btn" data-p="effects">Effects: ${settings.effects === 'full' ? 'Full' : 'Reduced'}</button>
      <button type="button" class="btn danger" data-p="quit">Quit game</button>
      ${K ? `<p class="keys">Move ${esc(K.move)} · Shoot ${esc(K.shoot)} · Pass ${esc(K.pass)} · Trick ${esc(K.trick)} · Oop ${esc(K.oop)} · Crown ${esc(K.crown)} · Turbo ${esc(K.turbo)}</p>` : '<p class="keys">P1: WASD, F shoot, G pass, H trick, R oop, T crown, Shift turbo. P2: arrows, comma shoot, period pass, slash trick, L oop, semicolon crown, M turbo.</p>'}
      <p class="hint">Quitting a career game doesn't count as a loss, and you don't get rewards.</p></div>`;
    stage.appendChild(el);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-p]'); if (!b) return;
      const a = b.dataset.p;
      if (a === 'resume') { hidePause(); S.match.resume(); BK.input.capture(true); canvas.focus({ preventScroll: true }); }
      else if (a === 'sound') { BK.audio.set('on', !BK.audio.settings.on); b.textContent = BK.audio.settings.on ? 'Sound: On' : 'Sound: Off'; if (BK.audio.settings.on) BK.audio.music('game'); }
      else if (a === 'effects') { settings.effects = settings.effects === 'full' ? 'reduced' : 'full'; saveSettings(); S.match.fx.reduced = settings.effects === 'reduced'; b.textContent = `Effects: ${settings.effects === 'full' ? 'Full' : 'Reduced'}`; }
      else if (a === 'quit') { hidePause(); S.match.destroy(); S.match = null; BK.input.showTouch(false); go(S.matchCfg.mode === 'career' ? 'circuit' : 'title'); }
    });
    // stopPropagation keeps the game's own key listener from reading this same Esc as a new pause
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hidePause(); S.match.resume(); BK.input.capture(true); } });
    $('[data-p="resume"]', el).focus();
  }
  function hidePause() { const el = $('#pause'); if (el) el.remove(); }

  function careerEventCfg(ci, ei) {
    const s = S.save; const stop = D.CIRCUIT[ci]; const ev = stop.events[ei]; const court = D.COURT_BY_ID[stop.court];
    const df = DIFF[settings.difficulty];
    const opp = { name: ev.crew.name, colors: ev.crew.colors.slice(), logo: ev.crew.logo, players: ev.crew.members.map((m) => D.memberFor(m, court.tier)), skill: Math.min(0.95, df.skill + court.tier * 0.015), boost: df.boost };
    return { mode: 'career', event: ev, court, target: ev.target, rule: ev.rule, teams: [CR.crewFromSave(s), opp], skill: df.skill, youTeam: 0, careerSide: 0, again: () => careerEventCfg(ci, ei), firstOffense: 0 };
  }
  function quickCfg() {
    const q = S.quick; const df = DIFF[settings.difficulty];
    const mine = q.team === 'mine' && S.save;
    const a = mine ? CR.crewFromSave(S.save) : crewSpec(D.QUICK_CREWS.find((c) => c.id === q.team) || D.QUICK_CREWS[0]);
    const b = Object.assign(crewSpec(D.QUICK_CREWS.find((c) => c.id === q.opp) || D.QUICK_CREWS[1]), { skill: df.skill, boost: df.boost });
    return { mode: 'quick', court: D.COURT_BY_ID[q.court], target: q.target, rule: q.rule, teams: [a, b], skill: df.skill, youTeam: 0, careerSide: mine ? 0 : null, again: quickCfg };
  }
  function versusCfg() {
    const v = S.vs; const a = versusTeam(0), b = versusTeam(1);
    if (!a || !b) return null;
    const careerSide = v.src[0] === 'career' ? 0 : v.src[1] === 'career' ? 1 : null;
    return { mode: 'versus', court: D.COURT_BY_ID[v.court], target: v.target, rule: v.rule, teams: [a, b], skill: 0.6, youTeam: careerSide == null ? 0 : careerSide, careerSide, again: versusCfg };
  }
  function challengeCfg() {
    const c = S.ch; if (!c.file || !S.save) return null;
    const theirs = Object.assign(CR.crewFromSave(c.file), { skill: 0.82, boost: 0 });
    return { mode: 'challenge', court: D.COURT_BY_ID[c.court], target: c.target, rule: 'standard', teams: [CR.crewFromSave(S.save), theirs], skill: 0.82, youTeam: 0, careerSide: 0, again: challengeCfg };
  }

  // ---------- input handling ----------
  function rerender() { const y = window.scrollY; const ay = app.scrollTop; go(S.screen, S.arg); window.scrollTo(0, y); app.scrollTop = ay; }
  function onClick(e) {
    const t = e.target.closest('button, [data-go]');
    if (!t || t.disabled) return;
    BK.audio.unlock();
    const d = t.dataset;
    if (d.go) { BK.audio.sfx('back', 0.6); go(d.go); return; }
    if (d.preview) { S.preview = d.preview; $$('[data-preview]', app).forEach((b) => { b.classList.toggle('on', b === t); b.setAttribute('aria-pressed', String(b === t)); }); return; }
    if (d.tab) { S.tab = d.tab; BK.audio.sfx('click', 0.6); rerender(); return; }
    if (d.arch) { S.draft.arch = d.arch; BK.audio.sfx('click', 0.6); rerender(); return; }
    if (d.look) { setLook(d.look, d.val); BK.audio.sfx('click', 0.5); rerender(); return; }
    if (d.color) { setColor(d.color, d.val); BK.audio.sfx('click', 0.5); rerender(); return; }
    if (d.logo) { if (S.screen === 'create') S.draft.crewLogo = d.logo; else { S.save.crew.logo = d.logo; CR.store(S.save); } BK.audio.sfx('click', 0.5); rerender(); return; }
    if (d.buy) { buyItem(d.buy, +d.cost); return; }
    if (d.celebrate) { S.save.me.celebration = d.celebrate; CR.store(S.save); S.preview = 'celebrate'; BK.audio.sfx('click', 0.5); rerender(); return; }
    if (d.dunk) { S.save.me.dunk = d.dunk; CR.store(S.save); S.preview = 'dunk'; BK.audio.sfx('click', 0.5); rerender(); return; }
    if (d.up) { if (CR.upgrade(S.save, d.up)) { CR.store(S.save); BK.audio.sfx('levelup', 0.5); rerender(); } return; }
    if (d.lineup) { toggleLineup(d.lineup); return; }
    if (d.event) { const [ci, ei] = d.event.split(':').map(Number); BK.audio.sfx('select', 0.6); go('event', [ci, ei]); return; }
    if (d.recruit) { doRecruit(d.recruit); return; }
    if (d.vsrc) { const [i, src] = d.vsrc.split(':'); S.vs.src[+i] = src; if (src === 'file' && !S.vs.file[+i]) { pickFile((save) => { S.vs.file[+i] = save; rerender(); }); } rerender(); return; }
    if (d.setting) { settings[d.setting] = d.val; saveSettings(); BK.audio.sfx('click', 0.5); rerender(); return; }
    const act = d.act; if (!act) return;
    BK.audio.sfx('select', 0.5);
    switch (act) {
      case 'nav-career': S.save ? go('career') : (S.draft = newDraft(), go('create')); break;
      case 'nav-quick': go('quick'); break;
      case 'nav-versus': go('versus'); break;
      case 'nav-challenge': go('challenge'); break;
      case 'nav-howto': go('howto'); break;
      case 'nav-settings': go('settings'); break;
      case 'nav-title': go('title'); break;
      case 'nav-circuit': go('circuit'); break;
      case 'nav-upgrade': go('upgrade'); break;
      case 'nav-locker': S.tab = 'hair'; go('locker'); break;
      case 'nav-crew': go('crew'); break;
      case 'toggle-sound': BK.audio.set('on', !BK.audio.settings.on); if (BK.audio.settings.on) BK.audio.music('menu'); rerender(); break;
      case 'cr-next': if (S.draft.step === 0 && !validDraftNames()) return; S.draft.step = Math.min(4, S.draft.step + 1); go('create'); break;
      case 'cr-back': S.draft.step = Math.max(0, S.draft.step - 1); go('create'); break;
      case 'cr-finish': finishCreate(); break;
      case 'play-next': { const n = nextEvent(S.save); if (n) go('event', [n.ci, n.ei]); break; }
      case 'play-event': startMatch(careerEventCfg(S.arg[0], S.arg[1])); break;
      case 'play-quick': startMatch(quickCfg()); break;
      case 'play-vs': { const cfg = versusCfg(); if (!cfg) { toast('Both players need a crew first.'); return; } startMatch(cfg); break; }
      case 'vs-load': { const i = +d.side; pickFile((save) => { S.vs.file[i] = save; S.vs.src[i] = 'file'; rerender(); toast(`Loaded ${save.crew.name}.`); }); break; }
      case 'ch-load': pickFile((save) => { S.ch.file = save; rerender(); toast(`Loaded ${save.crew.name}. Good luck.`); }); break;
      case 'play-ch': { const cfg = challengeCfg(); if (cfg) startMatch(cfg); break; }
      case 'again': { const cfg = S.last && S.last.cfg && S.last.cfg.again ? S.last.cfg.again() : null; if (cfg) startMatch(cfg); else go('title'); break; }
      case 'skip-recruit': S.last.recruits = null; rerender(); break;
      case 'save-file': saveFile(); break;
      case 'load-career': pickFile((save) => {
        if (S.save && !window.confirm(`Replace the career in this browser (${S.save.me.nick}, level ${S.save.level}) with ${save.me.nick}, level ${save.level}?`)) return;
        S.save = save; CR.store(save); toast(`Welcome back, ${save.me.nick}.`); go('career');
      }); break;
      case 'wipe': if (window.confirm('Delete the career saved in this browser? Any save files you kept are not touched.')) { CR.wipe(); S.save = null; S.draft = newDraft(); toast('Career cleared.'); go('title'); } break;
      default: break;
    }
  }
  function onInput(e) {
    const t = e.target; const d = t.dataset;
    if (d.field && S.screen === 'create') {
      if (d.field === 'hgt') { S.draft.hgt = +t.value; const l = $('#hgt-label'); if (l) l.textContent = ft(S.draft.hgt); t.setAttribute('aria-valuetext', ft(S.draft.hgt)); return; }
      if (d.field === 'num') { S.draft.num = Math.max(0, Math.min(99, Math.round(+t.value) || 0)); return; }
      if (d.field === 'crewName') { S.draft.crewName = CR.cleanName(t.value, 18); return; }
      S.draft[d.field] = CR.cleanName(t.value, d.field === 'nick' ? 16 : 14);
      return;
    }
    if (d.field === 'crewName' && S.save) { const v = CR.cleanName(t.value, 18); if (v) { S.save.crew.name = v; CR.store(S.save); } return; }
    if (d.vol) { BK.audio.set(d.vol, (+t.value) / 100); }
  }
  function onChange(e) {
    const t = e.target; const d = t.dataset;
    if (d.q) { S.quick[d.q] = d.q === 'target' ? +t.value : t.value; rerender(); return; }
    if (d.set) { settings[d.set] = t.value; saveSettings(); return; }
    if (d.v) { S.vs[d.v] = d.v === 'target' ? +t.value : t.value; return; }
    if (d.vcrew != null) { S.vs.crew[+d.vcrew] = t.value; rerender(); return; }
    if (d.c) { S.ch[d.c] = d.c === 'target' ? +t.value : t.value; return; }
    if (d.build && S.screen === 'create') { S.draft.build = t.value; }
  }

  function validDraftNames() {
    const d = S.draft;
    if (!d.first || !d.last) { toast('Give your player a first and last name.'); const el = $(`[data-field="${d.first ? 'last' : 'first'}"]`, app); if (el) el.focus(); return false; }
    if (!d.nick) d.nick = d.first;
    return true;
  }
  function setLook(key, val) {
    if (key === 'build') { if (S.screen === 'create') S.draft.build = val; else { S.save.me.build = val; CR.store(S.save); } return; }
    if (S.screen === 'create') { S.draft.look[key] = val; return; }
    const opt = (D.LOOK[key] || []).find((o) => o.id === val);
    if (!opt || !CR.isUnlocked(S.save, key, opt)) return;
    S.save.me.look[key] = val; CR.store(S.save);
  }
  function setColor(key, val) {
    if (key === 'crew0' || key === 'crew1') {
      const i = key === 'crew0' ? 0 : 1;
      if (S.screen === 'create') { if (i) S.draft.crewSec = val; else S.draft.crewPri = val; } else { S.save.crew.colors[i] = val; CR.store(S.save); }
      return;
    }
    if (S.screen === 'create') { S.draft.look[key] = val; return; }
    if (!CR.colorOwned(S.save, val) && key !== 'skin' && key !== 'hairColor') return;
    S.save.me.look[key] = val; CR.store(S.save);
  }
  function buyItem(id, cost) {
    const s = S.save; if (!s) return;
    const name = id.startsWith('color:') ? (D.PREMIUM_COLORS.find((c) => 'color:' + c.id === id) || {}).name : id.split(':')[1];
    if (s.cred < cost) { toast(`That costs ${cost} cred. You have ${s.cred}. Win some games.`); BK.audio.sfx('back', 0.6); return; }
    if (!window.confirm(`Buy ${name} for ${cost} cred? You have ${s.cred}.`)) return;
    if (CR.buy(s, id, cost)) {
      const [kind, val] = id.split(':');
      if (kind === 'celebration') s.me.celebration = val;
      else if (D.LOOK[kind]) s.me.look[kind] = val;
      CR.store(s); BK.audio.sfx('coin', 0.8); toast(`Unlocked ${name}.`); rerender();
    }
  }
  function toggleLineup(id) {
    const s = S.save; const i = s.lineup.indexOf(id);
    if (i >= 0) { toast('Pick someone to start in their place: tap a bench player.'); S.swapOut = id; return; }
    if (S.swapOut && s.lineup.includes(S.swapOut)) { s.lineup[s.lineup.indexOf(S.swapOut)] = id; S.swapOut = null; }
    else { s.lineup.shift(); s.lineup.push(id); }
    CR.store(s); BK.audio.sfx('select', 0.6); rerender();
  }
  function doRecruit(id) {
    const s = S.save; const R = S.last; const rec = R.recruits.find((x) => x.id === id); if (!rec) return;
    if (!s.roster.includes(id)) s.roster.push(id);
    CR.store(s); R.recruited = `${rec.p.first} "${rec.p.nick}" ${rec.p.last}`; R.recruits = null;
    BK.audio.sfx('levelup', 0.7); rerender();
  }
  function finishCreate() {
    const d = S.draft;
    const save = CR.newCareer({ first: d.first, last: d.last, nick: d.nick || d.first, num: d.num, arch: d.arch, hgt: d.hgt, build: d.build, look: d.look, crewName: d.crewName || `${d.last || 'Corner'} Crew`, crewPri: d.crewPri, crewSec: d.crewSec, crewLogo: d.crewLogo });
    S.save = save; CR.store(save); S.draft = null;
    BK.audio.sfx('airhorn', 0.6);
    toast(`${save.me.nick} has entered the chat. Your first game is at ${D.COURTS[0].name}.`, 4500);
    go('career');
  }
  async function saveFile() {
    if (!S.save) return;
    try {
      const how = await CR.saveToFile(S.save);
      CR.store(S.save);
      if (how === 'picker') toast('Saved. If you picked Google Drive, it\'s in your Drive now.');
      else if (how === 'download') toast('Downloaded. To keep it in Google Drive, move it from Downloads into Drive (or set your browser to ask where to save).', 6000);
    } catch (e) { toast('Could not save the file.'); }
  }
  let fileCb = null;
  function pickFile(cb) { fileCb = cb; fileInput.value = ''; fileInput.click(); }
  function onFilePicked() {
    const f = fileInput.files && fileInput.files[0]; if (!f || !fileCb) return;
    const cb = fileCb; fileCb = null;
    CR.readFile(f).then((save) => { BK.audio.sfx('coin', 0.6); cb(save); }).catch((err) => { toast(err.message || 'That file could not be loaded.', 5000); BK.audio.sfx('back', 0.6); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.BK = window.BK || {});
