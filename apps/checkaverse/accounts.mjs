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

// care: the rules from care.mjs. clock.wasUp(day) says the server ran that day, clock.noSchool(day) adds snow days.
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
  `);
  // Columns added after the first saves. Old rows get a fresh body the first time they are seen.
  const cols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
  if (!cols('checklings').includes('body')) db.exec("ALTER TABLE checklings ADD COLUMN body TEXT NOT NULL DEFAULT ''");
  if (!cols('checklings').includes('died')) db.exec("ALTER TABLE checklings ADD COLUMN died TEXT NOT NULL DEFAULT ''");
  if (!cols('trainers').includes('egg')) db.exec('ALTER TABLE trainers ADD COLUMN egg INTEGER NOT NULL DEFAULT 0');
  if (!cols('trainers').includes('items')) db.exec("ALTER TABLE trainers ADD COLUMN items TEXT NOT NULL DEFAULT '{}'");
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
    egg: db.prepare('UPDATE trainers SET egg = ? WHERE pid = ?'),
    items: db.prepare('UPDATE trainers SET items = ? WHERE pid = ?'),
    hatched: db.prepare('SELECT * FROM checklings WHERE pid = ? AND hatched = 1'),
    addChk: db.prepare('INSERT INTO checklings (pid, species, nick, xp, party, hatched, origin, born) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
    syncHatched: db.prepare('UPDATE checklings SET species = ?, nick = ? WHERE id = ?'),
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
  const itemsOf = (tr) => { try { return JSON.parse(tr?.items || '{}') || {}; } catch { return {}; } };
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
    for (const row of rows) {
      const b = body(row);
      // A body seen for the first time starts its clock today. The Den is paused, so its clock just keeps up.
      if (!row.body || !row.party) { if (!row.party) b.clock = day; saveBody(row.id, b); continue; }
      owed.set(row.id, { row, b, days: Care.owedDays(care, b.clock, day, clock.wasUp, clock.noSchool) });
    }
    const all = [...new Set([...owed.values()].flatMap((x) => x.days))].sort();
    const pick = seeded(pid, 'present', day);
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(pick() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    const present = new Set(all.slice(0, Math.max(0, presentCount)));
    for (const { row, b, days } of owed.values()) {
      const lines = [];
      const start = structuredClone(b);
      for (const d of days) {
        lines.push(...Care.tick(care, b, d, present.has(d), seeded(pid, row.id, 'night', d)));
        if (b.dead) break;
      }
      if (!days.length) continue;
      b.clock = days.at(-1) > b.clock ? days.at(-1) : b.clock;
      saveBody(row.id, b);
      if (b.dead) deaths.push(kill(pid, row, b.dead, day));
      else {
        const seen = new Set();
        const all = [...lines, ...Care.summary(care, start, b, day)];
        const uniq = all.filter((l) => !seen.has(l.text) && seen.add(l.text));
        reports.push({ id: row.id, species: row.species, nick: row.nick, nights: days.length, lines: uniq.slice(0, 6) });
      }
    }
    return { reports, deaths };
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
        } else if (!hatched.died && (hatched.species !== t.partner.species || hatched.nick !== t.partner.nick)) {
          q.syncHatched.run(t.partner.species, t.partner.nick, hatched.id);
        }
        tr = fresh(t.pid);
        const gained = Math.max(0, t.days - tr.attendance);
        // The body clock runs first, so XP goes to whoever is still standing this morning.
        const body = created ? { reports: [], deaths: [] } : catchUp(t.pid, gained - (t.checkedIn ? 1 : 0));
        repartner(t.pid);
        tr = fresh(t.pid);
        if (tr.egg === -1 && (gained > 0 || t.checkedIn)) { q.egg.run(t.days + care.egg.hatchAfter, t.pid); tr = fresh(t.pid); }
        const partner = tr.partner ? q.one.get(t.pid, tr.partner) : null;
        let credit = null;
        if (gained && partner) {
          const before = level(partner);
          q.addXp.run(gained * g.dayXp, partner.id);
          const after = level(q.one.get(t.pid, partner.id));
          credit = { days: gained, xp: gained * g.dayXp, id: partner.id, species: partner.species, nick: partner.nick, before, after };
        }
        if (t.days !== tr.attendance) q.attendance.run(t.days, t.pid);
        return { created, credit, trainer: fresh(t.pid), reports: body.reports, deaths: body.deaths };
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
      const v = Care.view(care, body(row), todayKey());
      const items = itemsOf(q.trainer.get(pid));
      v.rare = Object.entries(care.rare).filter(([k]) => items[k] > 0).map(([k, x]) => ({ id: k, label: x.label, count: items[k] }));
      return v;
    },
    mods(pid, id) {
      const row = q.one.get(pid, id);
      return row ? Care.battleMods(care, body(row), todayKey()) : null;
    },
    care(pid, id, action, name) {
      return tx(() => {
        const row = q.one.get(pid, id);
        if (!row) return { ok: false, msg: 'That Checkling is not here.' };
        const day = todayKey();
        const b = body(row);
        const tr = q.trainer.get(pid);
        const items = itemsOf(tr);
        if (care.rare[action]) {
          if (!(items[action] > 0)) return { ok: false, msg: 'You do not have one of those.' };
          items[action] -= 1;
          q.items.run(JSON.stringify(items), pid);
        }
        const done = Object.values(b.today.day === day ? b.today.n : {}).reduce((x, y) => x + y, 0);
        const r = Care.act(care, b, action, day, seeded(pid, id, 'care', day, action, done), name);
        saveBody(id, b);
        if (b.dead) r.death = kill(pid, row, b.dead, day);
        return r;
      });
    },
    noteBattle(pid, id) {
      const row = q.one.get(pid, id);
      if (!row) return;
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

    charmsLeft: (pid) => Math.max(0, g.charmsPerDay - fresh(pid).day_charms),
    useCharm(pid) {
      if (g.charmsPerDay - fresh(pid).day_charms <= 0) return false;
      q.charm.run(pid);
      return true;
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
    battleXp(pid, id, amount) {
      return tx(() => {
        const tr = fresh(pid);
        const r = q.one.get(pid, id);
        if (!tr || !r) return null;
        const xp = Math.max(0, Math.min(amount, g.dailyBattleXpCap - tr.day_xp));
        const before = level(r);
        if (xp) { q.addXp.run(xp, id); q.dayXp.run(xp, pid); }
        return { xp, capped: xp < amount, before, after: level(q.one.get(pid, id)), species: r.species, nick: r.nick };
      });
    },
  };
}
