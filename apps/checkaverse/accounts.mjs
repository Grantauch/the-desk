// Bus tickets and saved trainers.
// Check-In signs a short ticket when a student rides the bus. The ticket carries an anonymous player ID, the class
// hour, today's check-in, how many official check-ins the student has, and the Checkling they hatched. It never
// carries a name, PIN or email. The town checks the signature with the same key, then keeps that player's trainer
// name, outfit, record, party, Den and catches in SQLite. Growth numbers are content in content/growth.json.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as Care from './care.mjs';

// ---------- growth ----------
export function loadGrowth(file) {
  const g = JSON.parse(fs.readFileSync(file, 'utf8'));
  const bad = (msg) => { throw new Error(`growth.json: ${msg}`); };
  if (!(g.dayXp > 0)) bad('dayXp must be above zero');
  let last = 1;
  for (const step of g.levelCost || []) {
    if (!(Number.isInteger(step.upTo) && step.upTo > last && step.xp > 0)) bad('levelCost steps must climb and cost XP');
    last = step.upTo;
  }
  if (last !== 50) bad('levelCost must end at level 50');
  for (const k of ['win', 'loss', 'draw', 'wildWin', 'caught']) if (!(g.battleXp?.[k] >= 0)) bad(`battleXp.${k} missing`);
  for (const k of ['dailyBattleXpCap', 'partyMax', 'denMax', 'charmsPerDay', 'renamesPerDay']) if (!(Number.isInteger(g[k]) && g[k] >= 0)) bad(`${k} missing`);
  if (g.partyMax < 1) bad('partyMax must be at least 1');
  for (const k of ['winPoints', 'tiePoints', 'pairLimit', 'show']) if (!(Number.isInteger(g.ranks?.[k]) && g.ranks[k] >= 0)) bad(`ranks.${k} missing`);
  return g;
}

// The general store. Amounts live in content/shop.json. Care actions the goods point at must exist.
export function loadShop(file, care) {
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  const bad = (msg) => { throw new Error(`shop.json: ${msg}`); };
  for (const k of ['dayCoins', 'visitPurse', 'freeCharmsPerDay', 'visitCharms']) {
    if (!(Number.isInteger(s[k]) && s[k] >= 0 && s[k] <= 500)) bad(`${k} must be a whole number from 0 to 500`);
  }
  if (s.dayCoins < 1) bad('dayCoins must be at least 1');
  if (typeof s.freeCare !== 'boolean') bad('freeCare must be true or false');
  if (!s.carry || typeof s.carry !== 'object') bad('carry is missing');
  if (!Array.isArray(s.goods) || !s.goods.length) bad('goods is empty');
  const ids = new Set();
  for (const good of s.goods) {
    if (!/^[a-z]{2,16}$/.test(good.id || '')) bad(`bad id ${good.id}`);
    if (ids.has(good.id)) bad(`duplicate ${good.id}`);
    ids.add(good.id);
    if (!(Number.isInteger(good.price) && good.price >= 1 && good.price <= s.dayCoins)) bad(`${good.id} price must be a whole number from 1 to dayCoins, so one check-in can buy it`);
    if (!(Number.isInteger(s.carry[good.id]) && s.carry[good.id] >= 1 && s.carry[good.id] <= 30)) bad(`${good.id} carry limit`);
    if (typeof good.name !== 'string' || !good.name.trim()) bad(`${good.id} needs a name`);
    if (good.uses === 'catch') continue;
    if (!care.actions[good.uses]) bad(`${good.id} uses unknown care action ${good.uses}`);
  }
  return s;
}

// Forage spots and potion ingredients. Grave moss is listed here and still gathered from headstones.
export function loadForage(file) {
  const f = JSON.parse(fs.readFileSync(file, 'utf8'));
  const bad = (msg) => { throw new Error(`forage.json: ${msg}`); };
  if (f.perSpot !== 1) bad('perSpot must be 1');
  if (typeof f.already !== 'string' || !f.already) bad('already is missing');
  if (typeof f.full !== 'string' || !f.full.includes('{name}')) bad('full must name the ingredient');
  if (!f.ingredients || !f.spots) bad('ingredients and spots are required');
  for (const [id, ing] of Object.entries(f.ingredients)) {
    if (!/^[a-zA-Z]{2,20}$/.test(id)) bad(`bad id ${id}`);
    if (typeof ing.name !== 'string' || !ing.name) bad(`${id} needs a name`);
    if (!(Number.isInteger(ing.carry) && ing.carry >= 1 && ing.carry <= 30)) bad(`${id} carry`);
    if (typeof ing.found !== 'string' || !ing.found) bad(`${id} found line`);
  }
  const spotIds = ['berry-patch', 'creek-bank', 'herb-garden', 'old-stump'];
  if (Object.keys(f.spots).length !== spotIds.length || spotIds.some((id) => !f.spots[id])) bad('the four Kettle Creek spots must be berry-patch, creek-bank, herb-garden, and old-stump');
  for (const [id, spot] of Object.entries(f.spots)) {
    if (!Array.isArray(spot.finds) || spot.finds.length < 1) bad(`${id} needs finds`);
    for (const find of spot.finds) {
      const ing = f.ingredients[find];
      if (!ing) bad(`${id} lists unknown ingredient ${find}`);
      if (ing.source === 'headstone') bad(`${find} only grows on headstones`);
    }
  }
  if (f.ingredients.graveMoss?.source !== 'headstone') bad('graveMoss must be a headstone ingredient');
  return f;
}

// XP needed to stand at a level. Level 1 is free.
export function xpFor(g, level) {
  let xp = 0, lv = 1;
  for (const step of g.levelCost) {
    while (lv < step.upTo && lv < level) { xp += step.xp; lv++; }
  }
  return xp;
}
export function levelFor(g, xp) {
  let lv = 1, need = 0;
  for (const step of g.levelCost) {
    while (lv < step.upTo) {
      if (need + step.xp > xp) return lv;
      need += step.xp; lv++;
    }
  }
  return 50;
}

// ---------- tickets ----------
// The key is made on first start and kept beside the teacher key, never in the repo. The same key goes into
// Check-In once, through its private Settings tab, where Check-In moves it into private storage.
export function ticketKey(dataDir, env = process.env) {
  if (env.CHECKAVERSE_TICKET_KEY) return env.CHECKAVERSE_TICKET_KEY.trim();
  const file = path.join(dataDir, 'ticket-key.txt');
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString('base64url') + '\n', { mode: 0o600 });
  return fs.readFileSync(file, 'utf8').trim();
}

const b64 = (buf) => buf.toString('base64url');
const hmac = (key, body) => crypto.createHmac('sha256', key).update(body, 'utf8').digest();

// Check-In builds tickets in Apps Script. This copy exists for tests and must match it byte for byte.
export function signTicket(key, payload) {
  const body = b64(Buffer.from(JSON.stringify(payload), 'utf8'));
  return `${body}.${b64(hmac(key, body))}`;
}

const MAX_LIFE_MS = 3 * 60 * 60 * 1000;
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

export function verifyTicket(key, token, { now = Date.now(), species = [] } = {}) {
  if (!key) return { ok: false, why: 'no key' };
  if (typeof token !== 'string' || token.length > 2000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return { ok: false, why: 'shape' };
  const [body, sig] = token.split('.');
  const want = hmac(key, body);
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return { ok: false, why: 'signature' };
  let t;
  try { t = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return { ok: false, why: 'body' }; }
  if (!t || t.v !== 1) return { ok: false, why: 'version' };
  if (typeof t.p !== 'string' || !/^[A-Za-z0-9_-]{16,44}$/.test(t.p)) return { ok: false, why: 'player' };
  if (!Number.isFinite(t.iat) || !Number.isFinite(t.exp) || t.exp - t.iat > MAX_LIFE_MS || t.iat > now + 5 * 60_000) return { ok: false, why: 'times' };
  if (t.exp <= now) return { ok: false, why: 'expired' };
  if (!Number.isInteger(t.n) || t.n < 0 || t.n > 400) return { ok: false, why: 'days' };
  if (!t.k || !species.includes(t.k.s)) return { ok: false, why: 'partner' };
  return {
    ok: true,
    t: {
      pid: t.p, hour: clean(t.h, 40), day: /^\d{4}-\d{2}-\d{2}$/.test(t.d) ? t.d : '', checkedIn: Boolean(t.c),
      days: t.n, streak: Math.max(0, Number(t.s) || 0), best: Math.max(0, Number(t.b) || 0),
      partner: { species: t.k.s, nick: clean(t.k.n, 18) },
    },
  };
}

// ---------- saved trainers ----------
// School days follow the PC's clock in Michigan, so the daily limits turn over at midnight there.
const DAY_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit' });
export const todayKey = (d = new Date()) => DAY_FMT.format(d);
// The Monday that starts the week a day belongs to. Weekly rankings reset there.
export function weekOf(dayKey) {
  const [y, m, d] = dayKey.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}

// Weekly rank points for one class hour, from the battles table. Only battles between two saved trainers count.
// A win is worth winPoints and a tie tiePoints. Against the same classmate only the first pairLimit results each
// day count, so two friends cannot farm points off each other. Ties break on wins, then fewer losses, then name.
export function weeklyRanks(db, rules, hour, now = new Date()) {
  const week = weekOf(todayKey(now));
  const since = new Date(now.getTime() - 8 * 86_400_000).toISOString();
  const rows = db.prepare(`SELECT ended, a_pid, b_pid, a_trainer, b_trainer, winner, reason FROM battles
    WHERE ended >= ? AND a_pid IS NOT NULL AND b_pid IS NOT NULL ORDER BY ended`).all(since);
  const hours = new Map(db.prepare('SELECT pid, name, hour FROM trainers').all().map((t) => [t.pid, t]));
  const score = new Map();
  const seen = new Map();
  const add = (pid, r, opp, day) => {
    const k = `${pid}|${opp}|${day}`;
    const n = (seen.get(k) || 0) + 1;
    seen.set(k, n);
    if (n > rules.pairLimit) return;
    const s = score.get(pid) || { pid, points: 0, w: 0, l: 0, d: 0 };
    s[r]++;
    s.points += r === 'w' ? rules.winPoints : r === 'd' ? rules.tiePoints : 0;
    score.set(pid, s);
  };
  for (const b of rows) {
    if (b.reason === 'restart' || b.a_pid === b.b_pid) continue;
    const day = todayKey(new Date(b.ended));
    if (weekOf(day) !== week) continue;
    const ra = b.winner === 'draw' ? 'd' : b.winner === b.a_trainer ? 'w' : 'l';
    const rb = ra === 'd' ? 'd' : ra === 'w' ? 'l' : 'w';
    if (ra === 'd' && b.reason === 'timeout') continue; // both walked away
    add(b.a_pid, ra, b.b_pid, day);
    add(b.b_pid, rb, b.a_pid, day);
  }
  const list = [...score.values()]
    .filter((s) => hours.get(s.pid)?.hour === hour)
    .map((s) => ({ ...s, name: hours.get(s.pid).name }))
    .sort((x, y) => y.points - x.points || y.w - x.w || x.l - y.l || x.name.localeCompare(y.name));
  let rank = 0, last = null;
  list.forEach((s, i) => {
    const key = `${s.points}|${s.w}|${s.l}`;
    if (key !== last) { rank = i + 1; last = key; }
    s.rank = rank;
  });
  return { week, list };
}

// A repeatable random stream for one body event, so any death a student reports can be replayed.
export function seeded(...parts) {
  let t = crypto.createHash('sha256').update(parts.join('|')).digest().readUInt32LE(0);
  return () => {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export const isGhost = (row) => Boolean(row && String(row.origin || '').startsWith('ghost:'));

// care: the rules from care.mjs. clock.wasUp(day) says the server ran that day, clock.noSchool(day) adds snow days.
// clock.ghostKeep and clock.ghostParty come from content/ghosts.json.
export function openStore(db, g, care, clock = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS trainers (
      pid TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      look INTEGER NOT NULL DEFAULT 0,
      hour TEXT NOT NULL DEFAULT '',
      attendance INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      draws INTEGER NOT NULL DEFAULT 0,
      partner INTEGER NOT NULL DEFAULT 0,
      day TEXT NOT NULL DEFAULT '',
      day_xp INTEGER NOT NULL DEFAULT 0,
      day_charms INTEGER NOT NULL DEFAULT 0,
      day_renames INTEGER NOT NULL DEFAULT 0,
      created TEXT NOT NULL,
      seen TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS checklings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pid TEXT NOT NULL,
      species TEXT NOT NULL,
      nick TEXT NOT NULL DEFAULT '',
      xp INTEGER NOT NULL DEFAULT 0,
      party INTEGER NOT NULL DEFAULT 1,
      hatched INTEGER NOT NULL DEFAULT 0,
      origin TEXT NOT NULL,
      born TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS checklings_pid ON checklings(pid);
    CREATE TABLE IF NOT EXISTS graves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hour TEXT NOT NULL,
      trainer TEXT NOT NULL,
      species TEXT NOT NULL,
      level INTEGER NOT NULL,
      days INTEGER NOT NULL,
      cause TEXT NOT NULL,
      epitaph TEXT NOT NULL,
      died TEXT NOT NULL,
      pid TEXT NOT NULL,
      cid INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS graves_hour ON graves(hour);
    CREATE TABLE IF NOT EXISTS ghosts (
      grave_id INTEGER PRIMARY KEY,
      pid TEXT NOT NULL,
      cid INTEGER NOT NULL,
      caught TEXT NOT NULL
    );
  `);
  // Columns added after the first saves. Old rows get a fresh body the first time they are seen.
  const cols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
  if (!cols('checklings').includes('body')) db.exec("ALTER TABLE checklings ADD COLUMN body TEXT NOT NULL DEFAULT ''");
  if (!cols('checklings').includes('died')) db.exec("ALTER TABLE checklings ADD COLUMN died TEXT NOT NULL DEFAULT ''");
  if (!cols('trainers').includes('egg')) db.exec('ALTER TABLE trainers ADD COLUMN egg INTEGER NOT NULL DEFAULT 0');
  if (!cols('trainers').includes('items')) db.exec("ALTER TABLE trainers ADD COLUMN items TEXT NOT NULL DEFAULT '{}'");
  // A caught ghost keeps its own small record: the school days it has spent out of the party, and its temperament.
  if (!cols('checklings').includes('ghost')) db.exec("ALTER TABLE checklings ADD COLUMN ghost TEXT NOT NULL DEFAULT ''");
  // Moves a Checkling has learned or forgotten, and moves it has been offered on level up. Empty means its species' moves.
  if (!cols('checklings').includes('moves')) db.exec("ALTER TABLE checklings ADD COLUMN moves TEXT NOT NULL DEFAULT ''");
  const q = {
    trainer: db.prepare('SELECT * FROM trainers WHERE pid = ?'),
    nameTaken: db.prepare('SELECT 1 FROM trainers WHERE name = ?'),
    addTrainer: db.prepare('INSERT INTO trainers (pid, name, look, hour, created, seen) VALUES (?, ?, ?, ?, ?, ?)'),
    seen: db.prepare('UPDATE trainers SET hour = ?, seen = ? WHERE pid = ?'),
    team: db.prepare("SELECT * FROM checklings WHERE pid = ? AND died = '' ORDER BY party DESC, hatched DESC, id"),
    one: db.prepare("SELECT * FROM checklings WHERE pid = ? AND id = ? AND died = ''"),
    setBody: db.prepare('UPDATE checklings SET body = ? WHERE id = ?'),
    bury: db.prepare('UPDATE checklings SET died = ?, party = 0 WHERE id = ?'),
    grave: db.prepare('INSERT INTO graves (hour, trainer, species, level, days, cause, epitaph, died, pid, cid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    graves: db.prepare('SELECT id, trainer, species, level, days, cause, epitaph, died, pid FROM graves WHERE hour = ? ORDER BY id DESC LIMIT ?'),
    graveById: db.prepare("SELECT g.*, COALESCE(c.nick, '') AS nick FROM graves g LEFT JOIN checklings c ON c.id = g.cid WHERE g.id = ?"),
    heldGhosts: db.prepare("SELECT g.grave_id FROM ghosts g JOIN checklings c ON c.id = g.cid WHERE c.died = ''"),
    addGhostRow: db.prepare('INSERT INTO ghosts (grave_id, pid, cid, caught) VALUES (?, ?, ?, ?) ON CONFLICT(grave_id) DO UPDATE SET pid = excluded.pid, cid = excluded.cid, caught = excluded.caught'),
    dropGhost: db.prepare('DELETE FROM ghosts WHERE cid = ?'),
    setGhost: db.prepare('UPDATE checklings SET ghost = ? WHERE id = ?'),
    setMoves: db.prepare('UPDATE checklings SET moves = ? WHERE id = ?'),
    addGhostChk: db.prepare('INSERT INTO checklings (pid, species, nick, xp, party, hatched, origin, born, ghost) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)'),
    egg: db.prepare('UPDATE trainers SET egg = ? WHERE pid = ?'),
    items: db.prepare('UPDATE trainers SET items = ? WHERE pid = ?'),
    hatched: db.prepare('SELECT * FROM checklings WHERE pid = ? AND hatched = 1'),
    addChk: db.prepare('INSERT INTO checklings (pid, species, nick, xp, party, hatched, origin, born) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
    syncHatched: db.prepare('UPDATE checklings SET species = ?, nick = ? WHERE id = ?'),
    setSpecies: db.prepare('UPDATE checklings SET species = ? WHERE id = ?'),
    setNick: db.prepare('UPDATE checklings SET nick = ? WHERE id = ?'),
    addXp: db.prepare('UPDATE checklings SET xp = xp + ? WHERE id = ?'),
    setParty: db.prepare('UPDATE checklings SET party = ? WHERE id = ?'),
    setPartner: db.prepare('UPDATE trainers SET partner = ? WHERE pid = ?'),
    attendance: db.prepare('UPDATE trainers SET attendance = ? WHERE pid = ?'),
    day: db.prepare('UPDATE trainers SET day = ?, day_xp = 0, day_charms = 0, day_renames = 0 WHERE pid = ?'),
    dayXp: db.prepare('UPDATE trainers SET day_xp = day_xp + ? WHERE pid = ?'),
    charm: db.prepare('UPDATE trainers SET day_charms = day_charms + 1 WHERE pid = ?'),
    rename: db.prepare('UPDATE trainers SET name = ?, day_renames = day_renames + 1 WHERE pid = ?'),
    look: db.prepare('UPDATE trainers SET look = ? WHERE pid = ?'),
    win: db.prepare('UPDATE trainers SET wins = wins + 1 WHERE pid = ?'),
    loss: db.prepare('UPDATE trainers SET losses = losses + 1 WHERE pid = ?'),
    draw: db.prepare('UPDATE trainers SET draws = draws + 1 WHERE pid = ?'),
  };
  const now = () => new Date().toISOString();
  const tx = (fn) => {
    db.exec('BEGIN IMMEDIATE');
    try { const out = fn(); db.exec('COMMIT'); return out; } catch (err) { db.exec('ROLLBACK'); throw err; }
  };
  // Daily limits start over on a new day.
  function fresh(pid) {
    const tr = q.trainer.get(pid);
    if (tr && tr.day !== todayKey()) { q.day.run(todayKey(), pid); return q.trainer.get(pid); }
    return tr;
  }
  const level = (row) => levelFor(g, row.xp);
  const view = (row) => ({ ...row, level: level(row) });

  // ---------- the body ----------
  const spName = (id) => (clock.speciesName ? clock.speciesName(id) : id);
  const body = (row) => Care.readBody(care, row.body, todayKey());
  const saveBody = (id, b) => q.setBody.run(JSON.stringify(b), id);
  // A Checkling that reached its change level takes its next form. Levels can jump past two changes at once.
  const lineOf = (id) => (clock.root ? clock.root(id) : id);
  function grow(id, pid) {
    let row = q.one.get(pid, id);
    if (isGhost(row)) return null; // ghosts never evolve
    const from = row?.species;
    for (let n = 0; row && n < 3; n++) {
      const into = clock.evolve ? clock.evolve(row.species, level(row), body(row)) : null;
      if (!into) break;
      q.setSpecies.run(into, id);
      row = q.one.get(pid, id);
    }
    return row && row.species !== from ? { from, to: row.species } : null;
  }
  const itemsOf = (tr) => { try { return JSON.parse(tr?.items || '{}') || {}; } catch { return {}; } };
  const saveItems = (pid, items) => q.items.run(JSON.stringify(items), pid);
  const ghostOf = (row) => { try { return JSON.parse(row?.ghost || '{}') || {}; } catch { return {}; } };
  const partyGhosts = (pid) => q.team.all(pid).filter((x) => x.party && isGhost(x)).length;
  // ---------- moves ----------
  const movesState = (row) => {
    let m; try { m = JSON.parse(row?.moves || '{}') || {}; } catch { m = {}; }
    const custom = Array.isArray(m.known) && m.known.length > 0;
    return { known: custom ? m.known : (clock.speciesMoves ? clock.speciesMoves(row.species) : []), offers: Array.isArray(m.offers) ? m.offers : [], custom };
  };
  const saveMoves = (id, st) => q.setMoves.run(JSON.stringify({ known: st.known, offers: st.offers }), id);
  // New levels can bring new moves. With a free slot the move is learned on the spot; otherwise it waits as an offer.
  function offerMoves(pid, id, before, after) {
    const out = { learned: [], offered: [] };
    const row = q.one.get(pid, id);
    if (!row || !clock.levelOffers || after <= before) return out;
    const st = movesState(row);
    for (const mv of clock.levelOffers(row.species, before, after)) {
      if (st.known.includes(mv) || st.offers.includes(mv)) continue;
      if (st.known.length < (clock.slots || 4)) { st.known = [...st.known, mv]; out.learned.push(mv); }
      else { st.offers.push(mv); out.offered.push(mv); }
    }
    if (out.learned.length || out.offered.length) saveMoves(id, st);
    return out;
  }
  const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
  // The partner is always a living Checkling in the party, or nobody when every Checkling is gone.
  function repartner(pid) {
    const tr = q.trainer.get(pid);
    if (tr.partner && q.one.get(pid, tr.partner)?.party) return;
    const team = q.team.all(pid);
    let next = team.find((x) => x.party);
    if (!next && team.length) { next = team[0]; q.setParty.run(1, next.id); }
    q.setPartner.run(next ? next.id : 0, pid);
  }
  // A Checkling dies for good: a headstone for its class, the party carries on, and an egg is owed at the next check-in.
  function kill(pid, row, cause, day) {
    const tr = q.trainer.get(pid);
    const sp = spName(row.species);
    const line = Care.epitaph(care, cause, sp, seeded(pid, row.id, 'epitaph', day));
    q.bury.run(cause, row.id);
    q.grave.run(tr.hour, tr.name, row.species, level(row), Math.max(1, dayDiff(row.born.slice(0, 10), day)), cause, line, new Date().toISOString(), pid, row.id);
    if (!tr.egg) q.egg.run(-1, pid);
    repartner(pid);
    return { id: row.id, species: row.species, nick: row.nick, cause: Care.causeName(care, cause), epitaph: line };
  }
  // Run every night still owed on the body clock for the party. presentCount is how many of those school days the
  // student checked in; which ones is drawn from a seed, since the ticket only carries the count.
  function catchUp(pid, presentCount) {
    const day = todayKey();
    const reports = [], deaths = [];
    const rows = q.team.all(pid);
    const owed = new Map();
    const faded = [];
    for (const row of rows) {
      // A ghost has no body clock. It only counts the school days it spends out of the party, and fades back to the
      // cemetery once that reaches keepCloseSchoolDays.
      if (isGhost(row)) {
        const gs = ghostOf(row);
        const days = Care.owedDays(care, gs.clock || day, day, clock.wasUp, clock.noSchool).length;
        gs.away = row.party ? 0 : (gs.away || 0) + days;
        gs.clock = day;
        if (clock.ghostKeep && gs.away >= clock.ghostKeep) {
          q.bury.run('faded', row.id);
          q.dropGhost.run(row.id);
          faded.push({ id: row.id, species: row.species, nick: row.nick });
          repartner(pid);
        } else q.setGhost.run(JSON.stringify(gs), row.id);
        continue;
      }
      const b = body(row);
      // A body seen for the first time starts its clock today. The Den is paused, so its clock just keeps up, except
      // for a day it was out and active: a Checkling cared for or battled with faces that night even if it was sent to
      // the Den before the trainer logged off, so the Den is never a way to dodge the ladder.
      if (!row.body) { saveBody(row.id, b); continue; }
      if (!row.party) {
        const active = b.today.day < day && Object.values(b.today.n).some((v) => v > 0) ? b.today.day : '';
        const owe = active && Care.isSchoolDay(care, active, clock.noSchool) && (!clock.wasUp || clock.wasUp(active)) && b.clock <= active ? [active] : [];
        if (!owe.length) { b.clock = day; saveBody(row.id, b); continue; }
        owed.set(row.id, { row, b, days: owe, den: true });
        continue;
      }
      owed.set(row.id, { row, b, days: Care.owedDays(care, b.clock, day, clock.wasUp, clock.noSchool) });
    }
    const all = [...new Set([...owed.values()].flatMap((x) => x.days))].sort();
    const pick = seeded(pid, 'present', day);
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(pick() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    const present = new Set(all.slice(0, Math.max(0, presentCount)));
    for (const { row, b, days, den } of owed.values()) {
      const lines = [];
      const start = structuredClone(b);
      for (const d of days) {
        lines.push(...Care.tick(care, b, d, present.has(d), seeded(pid, row.id, 'night', d)));
        if (b.dead) break;
      }
      if (!days.length) continue;
      b.clock = den ? day : days.at(-1) > b.clock ? days.at(-1) : b.clock;
      saveBody(row.id, b);
      if (b.dead) deaths.push(kill(pid, row, b.dead, day));
      else {
        const seen = new Set();
        const all = [...lines, ...Care.summary(care, start, b, day)];
        const uniq = all.filter((l) => !seen.has(l.text) && seen.add(l.text));
        reports.push({ id: row.id, species: row.species, nick: row.nick, nights: days.length, lines: uniq.slice(0, 6) });
      }
    }
    return { reports, deaths, faded };
  }

  return {
    nameTaken: (name) => Boolean(q.nameTaken.get(name)),
    trainer: fresh,
    team: (pid) => q.team.all(pid).map(view),
    get: (pid, id) => { const r = q.one.get(pid, id); return r ? view(r) : null; },
    level,

    // A ticket arrives. Make the trainer on their first ride, keep the hatched Checkling in step with Check-In,
    // and pay XP for every official check-in since the last ride to whoever is the battle partner now.
    link(t, makeName, look) {
      return tx(() => {
        let tr = fresh(t.pid);
        const created = !tr;
        if (created) {
          q.addTrainer.run(t.pid, makeName(), look, t.hour, now(), now());
          q.day.run(todayKey(), t.pid);
        } else q.seen.run(t.hour, now(), t.pid);
        let hatched = q.hatched.get(t.pid);
        if (!hatched) {
          const id = Number(q.addChk.run(t.pid, t.partner.species, t.partner.nick, 0, 1, 1, 'hatched', now()).lastInsertRowid);
          saveBody(id, Care.newBody(care, todayKey()));
          q.setPartner.run(id, t.pid);
          hatched = q.one.get(t.pid, id);
        } else if (!hatched.died && (lineOf(hatched.species) !== t.partner.species || hatched.nick !== t.partner.nick)) {
          // A hatched Checkling that has grown into a later form of the same line keeps that form.
          q.syncHatched.run(lineOf(hatched.species) === t.partner.species ? hatched.species : t.partner.species, t.partner.nick, hatched.id);
        }
        tr = fresh(t.pid);
        const gained = Math.max(0, t.days - tr.attendance);
        // The body clock runs first, so XP goes to whoever is still standing this morning.
        const body = created ? { reports: [], deaths: [], faded: [] } : catchUp(t.pid, gained - (t.checkedIn ? 1 : 0));
        repartner(t.pid);
        tr = fresh(t.pid);
        if (tr.egg === -1 && (gained > 0 || t.checkedIn)) { q.egg.run(t.days + care.egg.hatchAfter, t.pid); tr = fresh(t.pid); }
        const partner = tr.partner ? q.one.get(t.pid, tr.partner) : null;
        let credit = null;
        if (gained && partner) {
          const before = level(partner);
          q.addXp.run(gained * g.dayXp, partner.id);
          const after = level(q.one.get(t.pid, partner.id));
          const evolved = grow(partner.id, t.pid);
          const moves = offerMoves(t.pid, partner.id, before, after);
          credit = { days: gained, xp: gained * g.dayXp, id: partner.id, species: partner.species, nick: partner.nick, before, after, evolved, ...moves };
        }
        if (gained && clock.shop) {
          const items = itemsOf(fresh(t.pid));
          const coins = gained * clock.shop.dayCoins;
          items.coins = (items.coins || 0) + coins;
          saveItems(t.pid, items);
          if (credit) credit.coins = coins;
          else credit = { days: gained, xp: 0, coins };
        }
        if (t.days !== tr.attendance) q.attendance.run(t.days, t.pid);
        return { created, credit, trainer: fresh(t.pid), reports: body.reports, deaths: body.deaths, faded: body.faded };
      });
    },

    // ---------- care ----------
    egg(pid, attendance) {
      const tr = q.trainer.get(pid);
      if (!tr || !tr.egg) return null;
      if (tr.egg === -1) return { owed: true };
      return { left: Math.max(0, tr.egg - attendance), ready: attendance >= tr.egg };
    },
    hatchEgg(pid, species, attendance) {
      return tx(() => {
        const tr = q.trainer.get(pid);
        if (!tr || !(tr.egg > 0) || attendance < tr.egg) return null;
        const team = q.team.all(pid);
        const party = team.filter((x) => x.party).length < g.partyMax ? 1 : 0;
        const id = Number(q.addChk.run(pid, species, '', 0, party, 0, 'egg', now()).lastInsertRowid);
        saveBody(id, Care.newBody(care, todayKey()));
        q.egg.run(0, pid);
        repartner(pid);
        if (!party) return { id, den: true };
        return { id };
      });
    },
    body(pid, id) {
      const row = q.one.get(pid, id);
      if (!row) return null;
      if (isGhost(row)) { const gs = ghostOf(row); return { ghost: true, temper: gs.temper || 'restless', away: gs.away || 0, keep: clock.ghostKeep || 0 }; }
      const v = Care.view(care, body(row), todayKey());
      const items = itemsOf(q.trainer.get(pid));
      v.rare = Object.entries(care.rare).filter(([k]) => items[k] > 0).map(([k, x]) => ({ id: k, label: x.label, count: items[k] }));
      v.coins = items.coins || 0;
      v.bag = Object.fromEntries((clock.shop?.goods || []).map((g) => [g.id, items[g.id] || 0]));
      v.foraged = {};
      for (const [id, ing] of Object.entries(clock.forage?.ingredients || {})) {
        if (ing.source === 'headstone' || !(items[id] > 0)) continue;
        v.foraged[ing.name] = items[id];
      }
      return v;
    },
    mods(pid, id) {
      const row = q.one.get(pid, id);
      if (isGhost(row)) return null;
      return row ? Care.battleMods(care, body(row), todayKey()) : null;
    },
    care(pid, id, action, name) {
      return tx(() => {
        const row = q.one.get(pid, id);
        if (!row) return { ok: false, msg: 'That Checkling is not here.' };
        if (isGhost(row)) return { ok: false, msg: 'Ghosts do not eat, nap or get sick. Keep it in your party so it stays close.' };
        if (!row.party) return { ok: false, msg: 'Bring it out of the Den first.' };
        const day = todayKey();
        const b = body(row);
        const tr = q.trainer.get(pid);
        const items = itemsOf(tr);
        if (care.rare[action]) {
          if (!(items[action] > 0)) return { ok: false, msg: 'You do not have one of those.' };
          items[action] -= 1;
          q.items.run(JSON.stringify(items), pid);
        }
        const stock = clock.shop?.goods?.find((g) => g.uses === action);
        const have = stock ? (items[stock.id] || 0) : 0;
        if (stock && !have && clock.shop.freeCare === false) return { ok: false, msg: `Buy a ${stock.name.toLowerCase()} at the general store first.` };
        if (stock && have > 0 && !stock.keeps) { items[stock.id] = have - 1; saveItems(pid, items); }
        const done = Object.values(b.today.day === day ? b.today.n : {}).reduce((x, y) => x + y, 0);
        const r = Care.act(care, b, action, day, seeded(pid, id, 'care', day, action, done), name);
        if (!r.ok && stock && have > 0 && !stock.keeps) { items[stock.id] = have; saveItems(pid, items); }
        saveBody(id, b);
        if (b.dead) r.death = kill(pid, row, b.dead, day);
        return r;
      });
    },
    noteBattle(pid, id) {
      const row = q.one.get(pid, id);
      if (!row || isGhost(row)) return;
      const b = body(row);
      Care.noteBattle(b, todayKey());
      saveBody(id, b);
    },
    // After a won wild battle a rare find can turn up. Returns its name, or null.
    find(pid, rand = Math.random) {
      const tr = q.trainer.get(pid);
      if (!tr) return null;
      const items = itemsOf(tr);
      for (const [k, x] of Object.entries(care.rare)) {
        if ((items[k] || 0) < x.max && rand() < x.foundAfterWildWin) {
          items[k] = (items[k] || 0) + 1;
          q.items.run(JSON.stringify(items), pid);
          return x.name;
        }
      }
      return null;
    },
    cemetery: (hour, n = 40) => q.graves.all(hour, n),

    setPartner(pid, id) {
      const r = q.one.get(pid, id);
      if (!r || !r.party) return false;
      q.setPartner.run(id, pid);
      return true;
    },

    // Party and Den. The party holds partyMax Checklings and always keeps at least one.
    // Resting the current partner hands the job to the next one in the party.
    moveDen(pid, id, toParty) {
      return tx(() => {
        const r = q.one.get(pid, id);
        if (!r) return { ok: false };
        const team = q.team.all(pid);
        const inParty = team.filter((x) => x.party);
        if (toParty) {
          if (r.party) return { ok: false };
          if (inParty.length >= g.partyMax) return { ok: false, msg: `Your party is full. Send one to the Den first.` };
          if (isGhost(r) && clock.ghostParty && inParty.filter(isGhost).length >= clock.ghostParty) return { ok: false, msg: 'Only one ghost can travel with you at a time.' };
          q.setParty.run(1, id);
          return { ok: true };
        }
        if (!r.party) return { ok: false };
        if (inParty.length <= 1) return { ok: false, msg: 'Keep at least one Checkling with you.' };
        q.setParty.run(0, id);
        const tr = q.trainer.get(pid);
        if (tr.partner === id) q.setPartner.run(inParty.find((x) => x.id !== id).id, pid);
        return { ok: true };
      });
    },

    denFull: (pid) => q.team.all(pid).length >= g.partyMax + g.denMax,
    addCatch(pid, species, lv, zone) {
      return tx(() => {
        const team = q.team.all(pid);
        if (team.length >= g.partyMax + g.denMax) return null;
        const party = team.filter((x) => x.party).length < g.partyMax ? 1 : 0;
        const id = Number(q.addChk.run(pid, species, '', xpFor(g, lv), party, 0, `caught:${zone}`, now()).lastInsertRowid);
        saveBody(id, Care.newBody(care, todayKey()));
        return { id, party: Boolean(party) };
      });
    },

    // ---------- moves (content/learnsets.json) ----------
    moves(pid, id) { const row = q.one.get(pid, id); return row ? movesState(row) : null; },
    // Learn a move from a level up offer or the gym, forgetting one if needed. forget 'skip' turns an offer down.
    learnMove(pid, id, move, forget, source = 'offer') {
      return tx(() => {
        const row = q.one.get(pid, id);
        if (!row) return { ok: false, msg: 'That Checkling is not here.' };
        const st = movesState(row);
        if (source === 'offer' && !st.offers.includes(move)) return { ok: false, msg: 'That move is not on offer.' };
        if (forget === 'skip') { st.offers = st.offers.filter((m) => m !== move); saveMoves(id, st); return { ok: true, skipped: true, known: st.known }; }
        const r = clock.learnMove ? clock.learnMove(st.known, move, forget || null) : { ok: false, msg: 'Moves cannot be learned right now.' };
        if (!r.ok) return r;
        st.known = r.known;
        st.offers = st.offers.filter((m) => m !== move);
        saveMoves(id, st);
        return { ok: true, known: st.known };
      });
    },
    offersWaiting(pid) { return q.team.all(pid).map((r) => ({ id: r.id, offers: movesState(r).offers })).filter((x) => x.offers.length); },
    // Gym points toward each move, and the day's round count.
    gym(pid, daily) {
      const items = itemsOf(fresh(pid));
      const rounds = items.gymDay === todayKey() ? items.gymRounds || 0 : 0;
      return { points: items.gym || {}, roundsLeft: Math.max(0, daily - rounds) };
    },
    gymRound(pid, move, points, cost, daily) {
      return tx(() => {
        const items = itemsOf(fresh(pid));
        if (items.gymDay !== todayKey()) { items.gymDay = todayKey(); items.gymRounds = 0; }
        if (items.gymRounds >= daily) return { ok: false, msg: 'That is all the gym training for today. Come back tomorrow.' };
        items.gym = items.gym || {};
        items.gym[move] = Math.min(cost, (items.gym[move] || 0) + points);
        items.gymRounds += 1;
        saveItems(pid, items);
        return { ok: true, points: items.gym[move], roundsLeft: daily - items.gymRounds };
      });
    },
    gymSpend(pid, move, cost) {
      return tx(() => {
        const items = itemsOf(fresh(pid));
        if (!items.gym || (items.gym[move] || 0) < cost) return false;
        delete items.gym[move];
        saveItems(pid, items);
        return true;
      });
    },

    // ---------- ghosts (content/ghosts.json) ----------
    grave: (id) => q.graveById.get(id) || null,
    heldGhosts: () => new Set(q.heldGhosts.all().map((r) => r.grave_id)),
    // A caught ghost joins the party when there is room and no other ghost in it, otherwise it waits in the Den.
    addGhost(pid, { graveId = 0, species, level, nick = '', temper }) {
      return tx(() => {
        const team = q.team.all(pid);
        if (team.length >= g.partyMax + g.denMax) return null;
        const inParty = team.filter((x) => x.party);
        const party = inParty.length < g.partyMax && (!clock.ghostParty || inParty.filter(isGhost).length < clock.ghostParty) ? 1 : 0;
        const gs = JSON.stringify({ temper, away: 0, clock: todayKey(), grave: graveId });
        const id = Number(q.addGhostChk.run(pid, species, nick, xpFor(g, level), party, `ghost:${graveId || 'wander'}`, now(), gs).lastInsertRowid);
        if (graveId) q.addGhostRow.run(graveId, pid, id, now());
        return { id, party: Boolean(party) };
      });
    },
    items(pid) { return itemsOf(fresh(pid)); },
    setItem(pid, k, v) { return tx(() => { const items = itemsOf(fresh(pid)); items[k] = v; saveItems(pid, items); }); },
    // Grave moss comes off a headstone once a day per stone, a few times a day, and pockets only hold so much.
    scrapeMoss(pid, stone, rules) {
      return tx(() => {
        const items = itemsOf(fresh(pid));
        const day = todayKey();
        if (items.mossDay !== day) { items.mossDay = day; items.mossStones = []; }
        if ((items.graveMoss || 0) >= rules.moss.carry) return { ok: false, msg: rules.mossFull, moss: items.graveMoss };
        if (items.mossStones.length >= rules.moss.perDay) return { ok: false, msg: rules.mossDone, moss: items.graveMoss || 0 };
        if (items.mossStones.includes(stone)) return { ok: false, msg: '', moss: items.graveMoss || 0 };
        items.mossStones.push(stone);
        items.graveMoss = (items.graveMoss || 0) + 1;
        saveItems(pid, items);
        return { ok: true, msg: rules.mossLine, moss: items.graveMoss };
      });
    },
    // The apothecary brews Spirit Sight and the partner drinks it on the spot.
    brewSight(pid, rules, nowMs = Date.now()) {
      return tx(() => {
        const items = itemsOf(fresh(pid));
        if ((items.sightUntil || 0) > nowMs) return { ok: false, msg: 'Your partner can already see ghosts.', until: items.sightUntil, moss: items.graveMoss || 0 };
        if ((items.graveMoss || 0) < rules.sight.moss) return { ok: false, msg: `Spirit Sight needs ${rules.sight.moss} grave moss. Scrape it off the headstones on the cemetery hill.`, moss: items.graveMoss || 0 };
        items.graveMoss -= rules.sight.moss;
        items.sightUntil = nowMs + rules.sight.minutes * 60_000;
        saveItems(pid, items);
        return { ok: true, until: items.sightUntil, moss: items.graveMoss };
      });
    },
    // A ghost a trainer knocked out, caught or chased off is gone for that trainer until tomorrow.
    ghostDone(pid, key) {
      const items = itemsOf(fresh(pid));
      const day = todayKey();
      if (items.ghostDay !== day) { items.ghostDay = day; items.ghostDone = []; }
      if (!items.ghostDone.includes(key)) items.ghostDone.push(key);
      saveItems(pid, items);
    },
    ghostsDone(pid) { const items = itemsOf(fresh(pid)); return new Set(items.ghostDay === todayKey() ? items.ghostDone || [] : []); },

    // A student names a Checkling they caught or hatched from an egg. The Check-In partner takes its name from Check-In.
    nickname(pid, id, nick) {
      const r = q.one.get(pid, id);
      if (!r) return { ok: false };
      if (r.hatched) return { ok: false, msg: 'Your first Checkling keeps the name it has in Check-In.' };
      q.setNick.run(nick, id);
      return { ok: true };
    },

    charmsLeft(pid) {
      const bought = itemsOf(fresh(pid)).charm || 0;
      const free = Math.max(0, (clock.shop?.freeCharmsPerDay ?? g.charmsPerDay) - fresh(pid).day_charms);
      return free + bought;
    },
    useCharm(pid) {
      const items = itemsOf(fresh(pid));
      if ((items.charm || 0) > 0) { items.charm -= 1; saveItems(pid, items); return true; }
      const free = clock.shop?.freeCharmsPerDay ?? g.charmsPerDay;
      if (free - fresh(pid).day_charms <= 0) return false;
      q.charm.run(pid);
      return true;
    },
    coins: (pid) => itemsOf(fresh(pid)).coins || 0,
    bag: (pid) => itemsOf(fresh(pid)),
    // Buy one thing from the general store. The price and the carry limit come from shop.json.
    // One find per forage spot per school day. The pick is seeded by the day and the spot, so every trainer gets the same ingredient.
    gather(pid, spotId, forage) {
      const spot = forage?.spots?.[spotId];
      if (!spot) return { ok: false, msg: 'Nothing to gather here.' };
      return tx(() => {
        const items = itemsOf(fresh(pid));
        const day = todayKey();
        if (items.forageDay !== day) { items.forageDay = day; items.forageSpots = []; }
        if ((items.forageSpots || []).includes(spotId)) return { ok: false, already: true, msg: forage.already };
        const pick = spot.finds[Math.floor(seeded(day, spotId)() * spot.finds.length)];
        const ing = forage.ingredients[pick];
        const have = items[pick] || 0;
        if (have >= ing.carry) return { ok: false, msg: forage.full.replaceAll('{name}', ing.name) };
        items.forageSpots = [...(items.forageSpots || []), spotId];
        items[pick] = have + 1;
        saveItems(pid, items);
        return { ok: true, id: pick, name: ing.name, count: items[pick], msg: ing.found.replaceAll('{count}', String(items[pick])).replaceAll('{name}', ing.name) };
      });
    },
    buy(pid, id) {
      const shop = clock.shop;
      const good = shop?.goods?.find((g) => g.id === id);
      if (!good) return { ok: false, msg: 'The store does not carry that.' };
      return tx(() => {
        const items = itemsOf(fresh(pid));
        const have = items[good.id] || 0;
        const coins = items.coins || 0;
        if (have >= shop.carry[good.id]) return { ok: false, msg: `You cannot carry another ${good.name.toLowerCase()}.`, coins, have };
        if (coins < good.price) return { ok: false, msg: `A ${good.name.toLowerCase()} costs ${good.price} coins, and you have ${coins}.`, coins, have };
        items.coins = coins - good.price;
        items[good.id] = have + 1;
        saveItems(pid, items);
        return { ok: true, msg: `Bought a ${good.name.toLowerCase()}.`, coins: items.coins, have: items[good.id] };
      });
    },
    renamesLeft: (pid) => Math.max(0, g.renamesPerDay - fresh(pid).day_renames),
    rename(pid, name) {
      if (g.renamesPerDay - fresh(pid).day_renames <= 0) return false;
      q.rename.run(name, pid);
      return true;
    },
    setLook: (pid, v) => q.look.run(v, pid),
    result(pid, r) { (r === 'w' ? q.win : r === 'l' ? q.loss : q.draw).run(pid); },

    // Battle XP goes to the Checkling that fought, up to the daily cap.
    battleXp(pid, id, amount, capMult = 1) {
      return tx(() => {
        const tr = fresh(pid);
        const r = q.one.get(pid, id);
        if (!tr || !r) return null;
        const xp = Math.max(0, Math.min(amount, g.dailyBattleXpCap * capMult - tr.day_xp));
        const before = level(r);
        if (xp) { q.addXp.run(xp, id); q.dayXp.run(xp, pid); }
        const after = level(q.one.get(pid, id));
        const evolved = xp ? grow(id, pid) : null;
        const moves = offerMoves(pid, id, before, after);
        return { xp, capped: xp < amount, before, after, species: r.species, nick: r.nick, evolved, ...moves };
      });
    },
  };
}
