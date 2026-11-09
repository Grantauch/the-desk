/* Blacktop Kings — your career: the player you built, your crew, what you've unlocked.
   It lives in this browser (localStorage) and in save files you keep yourself. A save file is plain
   JSON. In Chrome and on Chromebooks, "Save file" opens the system save window, where Google Drive is
   one of the places you can pick. Nothing is uploaded by this page.
   Loaded files are checked field by field; anything unexpected is dropped or clamped. */
(function (BK) {
  'use strict';
  const D = BK.data;
  const KEY = 'bk-career';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const HEX = /^#[0-9a-f]{6}$/i;

  // ---------- small helpers ----------
  function cleanName(s, max) {
    return String(s == null ? '' : s).replace(/[^A-Za-z0-9 .'\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, max || 14);
  }
  function int(v, a, b, dflt) { const n = Math.round(Number(v)); return Number.isFinite(n) ? clamp(n, a, b) : dflt; }
  function num(v, a, b, dflt) { const n = Number(v); return Number.isFinite(n) ? clamp(n, a, b) : dflt; }
  function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
  const SALT = 'blacktop-kings/chain-nets';
  function sign(save) { const copy = Object.assign({}, save); delete copy.sig; return hash(SALT + JSON.stringify(copy)); }

  const LOOK_COLOR_KEYS = ['skin', 'hairColor', 'headbandColor', 'sleeveColor', 'sockColor', 'shoeColor', 'shoeAccent'];
  const ALL_COLORS = () => D.COLORS.concat(D.PREMIUM_COLORS.map((c) => c.id));

  // ---------- a new career ----------
  function newCareer(spec) {
    const arch = D.ARCHETYPES[spec.arch] ? spec.arch : 'slasher';
    const hgt = int(spec.hgt, 66, 88, 76);
    const r = Object.assign({}, D.ARCHETYPES[arch].base);
    if (hgt >= 81) { r.blk += 1; r.reb += 1; r.spd -= 1; r.hnd -= 1; }
    if (hgt <= 71) { r.spd += 1; r.hnd += 1; r.reb -= 1; r.blk -= 1; }
    D.STAT_KEYS.forEach((k) => { r[k] = clamp(r[k], 1, 7); });
    const save = {
      game: 'blacktop-kings', v: D.SAVE_VERSION, created: new Date().toISOString(), updated: new Date().toISOString(),
      me: {
        id: 'me', first: cleanName(spec.first) || 'Rookie', last: cleanName(spec.last) || 'Doe', nick: cleanName(spec.nick, 16) || 'Rookie',
        num: int(spec.num, 0, 99, 1), arch, hgt, build: ['lean', 'athletic', 'strong', 'heavy'].includes(spec.build) ? spec.build : 'athletic',
        look: sanitizeLook(spec.look || {}), r, celebration: 'flex', dunk: 'tomahawk',
      },
      level: 1, rep: 0, repTotal: 0, points: 3, cred: 150,
      crew: { name: cleanName(spec.crewName, 18) || 'Corner Kings', colors: [HEX.test(spec.crewPri) ? spec.crewPri : '#e8352b', HEX.test(spec.crewSec) ? spec.crewSec : '#ffffff'], logo: D.LOGOS.includes(spec.crewLogo) ? spec.crewLogo : 'crown' },
      roster: D.STARTERS.map((p) => p.id), lineup: D.STARTERS.map((p) => p.id),
      owned: [], beaten: [], wins: {},
      stats: { games: 0, wins: 0, losses: 0, pts: 0, dunks: 0, blocks: 0, steals: 0, ankles: 0, crowns: 0, bestStyle: 0, versusWins: 0, versusLosses: 0 },
    };
    return save;
  }

  function sanitizeLook(look) {
    const out = {};
    Object.keys(D.LOOK).forEach((k) => {
      const ids = D.LOOK[k].map((o) => o.id);
      if (ids.includes(look[k])) out[k] = look[k];
    });
    LOOK_COLOR_KEYS.forEach((k) => {
      const v = String(look[k] || '');
      if (k === 'skin' ? D.SKIN.includes(v) : k === 'hairColor' ? D.HAIR_COLORS.includes(v) : ALL_COLORS().includes(v)) out[k] = v;
    });
    return Object.assign({}, BK.art.DEFAULT_LOOK, out);
  }

  // ---------- roster ids ----------
  // 'pogo' (legend), 'starter-a' (starter), 'loc:lot-a1:1:general' (a local you recruited).
  function memberById(id) {
    if (D.LEGEND_BY_ID[id]) return D.LEGEND_BY_ID[id];
    const st = D.STARTERS.find((p) => p.id === id); if (st) return st;
    const m = /^loc:([a-z0-9-]{1,20}):([1-8]):(slasher|sniper|general|trickster|big)$/.exec(id || '');
    if (m) return Object.assign(D.genLocal(m[1], +m[2], m[3]), { id });
    return null;
  }
  function idForSpec(spec, tier) { return spec[0] === 'l' ? spec[1] : `loc:${spec[1]}:${tier}:${spec[2]}`; }

  // ---------- validation for anything loaded ----------
  function validate(raw) {
    if (!raw || typeof raw !== 'object' || raw.game !== 'blacktop-kings') throw new Error('That file is not a Blacktop Kings save.');
    if (typeof raw.v !== 'number' || raw.v > D.SAVE_VERSION) throw new Error('That save comes from a newer version of the game.');
    if (raw.sig !== sign(raw)) throw new Error('That save file was changed outside the game, so it can\'t be used.');
    const me = raw.me || {};
    const r = {};
    D.STAT_KEYS.forEach((k) => { r[k] = int(me.r && me.r[k], 1, D.MAX_STAT, 3); });
    const save = {
      game: 'blacktop-kings', v: D.SAVE_VERSION,
      created: typeof raw.created === 'string' ? raw.created.slice(0, 30) : new Date().toISOString(),
      updated: typeof raw.updated === 'string' ? raw.updated.slice(0, 30) : new Date().toISOString(),
      me: {
        id: 'me', first: cleanName(me.first) || 'Rookie', last: cleanName(me.last) || 'Doe', nick: cleanName(me.nick, 16) || 'Rookie',
        num: int(me.num, 0, 99, 1), arch: D.ARCHETYPES[me.arch] ? me.arch : 'slasher', hgt: int(me.hgt, 66, 88, 76),
        build: ['lean', 'athletic', 'strong', 'heavy'].includes(me.build) ? me.build : 'athletic',
        look: sanitizeLook(me.look || {}), r,
        celebration: D.CELEBRATIONS.some((c) => c.id === me.celebration) ? me.celebration : 'flex',
        dunk: D.DUNKS[me.dunk] ? me.dunk : 'tomahawk',
      },
      level: int(raw.level, 1, D.MAX_LEVEL, 1), rep: num(raw.rep, 0, 1e6, 0), repTotal: num(raw.repTotal, 0, 1e8, 0),
      points: int(raw.points, 0, 999, 0), cred: int(raw.cred, 0, 9999999, 0),
      crew: {
        name: cleanName(raw.crew && raw.crew.name, 18) || 'Corner Kings',
        colors: [0, 1].map((i) => { const c = raw.crew && Array.isArray(raw.crew.colors) ? raw.crew.colors[i] : null; return HEX.test(c || '') ? c : (i ? '#ffffff' : '#e8352b'); }),
        logo: D.LOGOS.includes(raw.crew && raw.crew.logo) ? raw.crew.logo : 'crown',
      },
      roster: [], lineup: [], owned: [], beaten: [], wins: {},
      stats: {},
    };
    const roster = Array.isArray(raw.roster) ? raw.roster.slice(0, 80) : [];
    roster.forEach((id) => { if (typeof id === 'string' && memberById(id) && !save.roster.includes(id)) save.roster.push(id); });
    D.STARTERS.forEach((p) => { if (!save.roster.includes(p.id)) save.roster.push(p.id); });
    const lineup = Array.isArray(raw.lineup) ? raw.lineup : [];
    lineup.forEach((id) => { if (save.roster.includes(id) && !save.lineup.includes(id) && save.lineup.length < 2) save.lineup.push(id); });
    save.roster.forEach((id) => { if (save.lineup.length < 2 && !save.lineup.includes(id)) save.lineup.push(id); });
    const known = new Set(ownableIds());
    (Array.isArray(raw.owned) ? raw.owned : []).forEach((id) => { if (typeof id === 'string' && known.has(id) && !save.owned.includes(id)) save.owned.push(id); });
    const events = new Set(D.allEvents().map((e) => e.ev.id));
    (Array.isArray(raw.beaten) ? raw.beaten : []).forEach((id) => { if (events.has(id) && !save.beaten.includes(id)) save.beaten.push(id); });
    if (raw.wins && typeof raw.wins === 'object') Object.keys(raw.wins).forEach((k) => { if (events.has(k)) save.wins[k] = int(raw.wins[k], 0, 9999, 0); });
    const st = raw.stats || {};
    ['games', 'wins', 'losses', 'pts', 'dunks', 'blocks', 'steals', 'ankles', 'crowns', 'bestStyle', 'versusWins', 'versusLosses'].forEach((k) => { save.stats[k] = int(st[k], 0, 1e9, 0); });
    // ratings can't outrun the level cap
    D.STAT_KEYS.forEach((k) => { save.me.r[k] = Math.min(save.me.r[k], statCap(save.level)); });
    return save;
  }
  function ownableIds() {
    const out = [];
    Object.keys(D.LOOK).forEach((k) => D.LOOK[k].forEach((o) => { if (o.cost) out.push(k + ':' + o.id); }));
    D.PREMIUM_COLORS.forEach((c) => out.push('color:' + c.id));
    D.CELEBRATIONS.forEach((c) => { if (c.cost) out.push('celebration:' + c.id); });
    return out;
  }

  // ---------- progression ----------
  function statCap(level) { return Math.min(D.MAX_STAT, 6 + Math.floor(level / 4)); }
  function canUpgrade(save, k) {
    const v = save.me.r[k];
    if (v >= statCap(save.level)) return { ok: false, why: v >= D.MAX_STAT ? 'Maxed out' : `Cap is ${statCap(save.level)} until level ${(statCap(save.level) - 5) * 4}` };
    const cost = D.upgradeCost(v);
    if (save.points < cost) return { ok: false, why: `Needs ${cost} point${cost > 1 ? 's' : ''}`, cost };
    return { ok: true, cost };
  }
  function upgrade(save, k) { const c = canUpgrade(save, k); if (!c.ok) return false; save.points -= c.cost; save.me.r[k]++; return true; }

  function addRep(save, amount) {
    const ups = [];
    save.repTotal += amount;
    if (save.level >= D.MAX_LEVEL) return ups;
    save.rep += amount;
    while (save.level < D.MAX_LEVEL && save.rep >= D.repForLevel(save.level)) {
      save.rep -= D.repForLevel(save.level); save.level++; save.points += D.POINTS_PER_LEVEL; ups.push(save.level);
    }
    if (save.level >= D.MAX_LEVEL) save.rep = 0;
    return ups;
  }

  function isUnlocked(save, kind, o) {
    if (!o) return false;
    if (o.lvl && save.level < o.lvl) return false;
    if (o.cost && !save.owned.includes(kind + ':' + o.id)) return false;
    return true;
  }
  function colorOwned(save, c) { if (D.COLORS.includes(c)) return true; return save.owned.includes('color:' + c); }
  function buy(save, id, cost) { if (save.owned.includes(id) || save.cred < cost) return false; save.cred -= cost; save.owned.push(id); return true; }

  function unlockedDunks(save) { return D.DUNK_ORDER.filter((k) => !D.DUNKS[k].lvl || save.level >= D.DUNKS[k].lvl); }

  // Which courts can you play? The first, plus every court after one whose king you beat.
  function courtOpen(save, ci) {
    if (ci === 0) return true;
    const prev = D.CIRCUIT[ci - 1];
    const king = prev.events[prev.events.length - 1];
    return save.beaten.includes(king.id);
  }
  function eventOpen(save, ci, ei) {
    if (!courtOpen(save, ci)) return false;
    const stop = D.CIRCUIT[ci];
    if (ei === stop.events.length - 1) return stop.events.slice(0, -1).every((e) => save.beaten.includes(e.id));
    return true;
  }
  function openCourts(save) { return D.CIRCUIT.map((s, i) => i).filter((i) => !save || courtOpen(save, i)).map((i) => D.COURT_BY_ID[D.CIRCUIT[i].court]); }

  // ---------- turning a career into a playable crew ----------
  function mePlayer(save) {
    const me = save.me;
    return { id: 'me', first: me.first, last: me.last, nick: me.nick, num: me.num, arch: me.arch, hgt: me.hgt, build: me.build, r: Object.assign({}, me.r), look: Object.assign({}, me.look), dunk: me.dunk, celebration: me.celebration, unlockedDunks: unlockedDunks(save), you: true };
  }
  function crewFromSave(save) {
    const mates = save.lineup.map(memberById).filter(Boolean).slice(0, 2);
    while (mates.length < 2) mates.push(D.STARTERS[mates.length]);
    return { name: save.crew.name, colors: save.crew.colors.slice(), logo: save.crew.logo, players: [mePlayer(save)].concat(mates), fromSave: true };
  }

  // ---------- rewards after a game ----------
  function reward(save, o) {
    // o: { win, tier, first, king, me: stats of your player, teamStyle, mode }
    const tier = o.tier || 1; const s = o.me || {};
    let rep = o.win ? 240 + tier * 45 : 80 + tier * 15;
    rep += Math.min(320, Math.round((o.teamStyle || 0) / 45));
    rep += (s.pts || 0) * 8 + (s.blk || 0) * 12 + (s.stl || 0) * 12 + (s.ankles || 0) * 20 + (s.dnk || 0) * 6 + (s.ast || 0) * 6;
    let cred = o.win ? 110 + tier * 30 : 35 + tier * 5;
    if (o.first) { rep += 180; cred += 120; }
    if (o.king && o.first) { rep += 300; cred += 250; }
    if (o.mode === 'versus') { rep = Math.round(rep * 0.6); cred = Math.round(cred * 0.6); }
    const before = save.level;
    const ups = addRep(save, rep);
    save.cred += cred;
    save.stats.games++; if (o.win) save.stats.wins++; else save.stats.losses++;
    save.stats.pts += s.pts || 0; save.stats.dunks += s.dnk || 0; save.stats.blocks += s.blk || 0; save.stats.steals += s.stl || 0; save.stats.ankles += s.ankles || 0;
    save.stats.crowns += o.crowns || 0; save.stats.bestStyle = Math.max(save.stats.bestStyle, o.teamStyle || 0);
    if (o.mode === 'versus') { if (o.win) save.stats.versusWins++; else save.stats.versusLosses++; }
    // what opened up with the new levels
    const unlocked = [];
    ups.forEach((lvl) => {
      Object.keys(D.LOOK).forEach((k) => D.LOOK[k].forEach((it) => { if (it.lvl === lvl) unlocked.push(`${D.LOOK_LABELS[k]}: ${it.name}`); }));
      D.CELEBRATIONS.forEach((c) => { if (c.lvl === lvl) unlocked.push(`Celebration: ${c.name}`); });
      D.DUNK_ORDER.forEach((k) => { if (D.DUNKS[k].lvl === lvl) unlocked.push(`Dunk: ${D.DUNKS[k].name}`); });
      if (statCap(lvl) > statCap(lvl - 1)) unlocked.push(`Rating cap raised to ${statCap(lvl)}`);
    });
    return { rep, cred, ups, unlocked, levelBefore: before };
  }

  // ---------- storage ----------
  function load() {
    try {
      const raw = localStorage.getItem(KEY); if (!raw) return null;
      return validate(JSON.parse(raw));
    } catch (e) { return null; }
  }
  function store(save) {
    if (!save) return false;
    save.updated = new Date().toISOString();
    save.sig = sign(save);
    try { localStorage.setItem(KEY, JSON.stringify(save)); return true; } catch (e) { return false; }
  }
  function wipe() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

  function fileName(save) {
    const slug = (save.me.nick || save.me.last || 'player').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'player';
    return `blacktop-kings-${slug}.json`;
  }
  // Save to a file the player keeps. Uses the system save window when the browser has one
  // (Chrome, Edge, ChromeOS), so Google Drive shows up as a place to put it. Otherwise a download.
  async function saveToFile(save) {
    save.updated = new Date().toISOString();
    save.sig = sign(save);
    const json = JSON.stringify(save, null, 2);
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({ suggestedName: fileName(save), types: [{ description: 'Blacktop Kings save', accept: { 'application/json': ['.json'] } }] });
        const w = await handle.createWritable(); await w.write(json); await w.close();
        return 'picker';
      } catch (e) {
        if (e && e.name === 'AbortError') return 'cancel';
      }
    }
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName(save);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return 'download';
  }
  function readFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) { reject(new Error('No file picked.')); return; }
      if (file.size > 400000) { reject(new Error('That file is too big to be a save.')); return; }
      const fr = new FileReader();
      fr.onload = () => { try { resolve(validate(JSON.parse(String(fr.result)))); } catch (e) { reject(e instanceof SyntaxError ? new Error('That file is not a Blacktop Kings save.') : e); } };
      fr.onerror = () => reject(new Error('The file could not be read.'));
      fr.readAsText(file);
    });
  }

  BK.career = {
    KEY, newCareer, validate, sanitizeLook, memberById, idForSpec, statCap, canUpgrade, upgrade, addRep, isUnlocked, colorOwned, buy,
    unlockedDunks, courtOpen, eventOpen, openCourts, mePlayer, crewFromSave, reward, load, store, wipe, saveToFile, readFile, cleanName, sign,
  };
})(window.BK = window.BK || {});
