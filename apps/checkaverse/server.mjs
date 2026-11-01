// Checkaverse live server.
// One process: serves the town page, runs the shared town over WebSockets, records sessions in SQLite.
// The server is the authority. Browsers send intentions (move, say, challenge, lock) and only draw what the server says.
// Maps, phrases and names are content files in ./content. Settings come from environment variables
// so the same folder runs on the home PC or a rented server.

import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { WebSocketServer } from 'ws';
import { versionHtmlAssets } from './asset-versions.mjs';
import * as Battle from './battle.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VERSION = '0.9.0';
const PORT = Number(process.env.CHECKAVERSE_PORT || 8787);
const HOST = process.env.CHECKAVERSE_HOST || '127.0.0.1';
const DATA_DIR = process.env.CHECKAVERSE_DATA || path.resolve(HERE, '..', 'storage');
const MAX_PLAYERS = Number(process.env.CHECKAVERSE_MAX_PLAYERS || 200);
const ALLOWED_ORIGINS = new Set(
  (process.env.CHECKAVERSE_ORIGINS ||
    'https://game.grant-desk.com,https://grant-desk.com,https://www.grant-desk.com,http://localhost:8787,http://127.0.0.1:8787')
    .split(',').map((s) => s.trim()).filter(Boolean)
);

const readContent = (name) => JSON.parse(fs.readFileSync(path.join(HERE, 'content', name), 'utf8'));
const TOWN = readContent('town.json');
const HOUSE = readContent('house.json');
const WILDS = readContent('wilds.json');
const WILD = readContent('wild.json');
const PHRASES = readContent('phrases.json').starter;
const NAMES = readContent('names.json');
const SIGNS = readContent('signs.json');
const SAY_GAP_MS = 2000;
const REROLLS = 3; // trainer name rerolls per visit, as the bible allows a few
// Battle rules are content. A mistake in them stops the server here, before any student connects.
const RULES = Battle.loadRules(path.join(HERE, 'content', 'battle'));
const STARTERS = Object.keys(RULES.species.species);
const TURN_MS = Number(process.env.CHECKAVERSE_TURN_MS || RULES.settings.turnSeconds * 1000);
// Wild encounter content is checked the same way: every zone is a real tile in the wilds and every species can battle.
for (const [tile, z] of Object.entries(WILD.zones)) {
  if (!WILDS.rows.some((r) => r.includes(tile))) throw new Error(`wild.json: zone ${tile} has no tiles in wilds.json`);
  if (!(z.rate > 0 && z.rate < 0.5) || !(z.levels[0] >= 1 && z.levels[0] <= z.levels[1] && z.levels[1] <= 50)) throw new Error(`wild.json: zone ${tile} rate or levels out of range`);
  for (const sp of Object.keys(z.table)) if (!RULES.species.species[sp]) throw new Error(`wild.json: zone ${tile} lists unknown species ${sp}`);
}
// Tests can make every step in the wilds start a battle.
const WILD_RATE = process.env.CHECKAVERSE_WILD_RATE ? Number(process.env.CHECKAVERSE_WILD_RATE) : null;

fs.mkdirSync(path.join(DATA_DIR, 'logs'), { recursive: true });

// ---------- teacher key ----------
// The teacher page needs this key. It lives only in the data folder (never in the repo) and is made on first start.
const KEY_FILE = path.join(DATA_DIR, 'teacher-key.txt');
if (!fs.existsSync(KEY_FILE)) fs.writeFileSync(KEY_FILE, crypto.randomBytes(9).toString('base64url') + '\n', { mode: 0o600 });
const TEACHER_KEY = (process.env.CHECKAVERSE_TEACHER_KEY || fs.readFileSync(KEY_FILE, 'utf8')).trim();
const keyOk = (k) => {
  const a = Buffer.from(String(k || '')), b = Buffer.from(TEACHER_KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
let paused = false;

// ---------- logging ----------
function log(...parts) {
  const now = new Date();
  const line = `${now.toISOString()} ${parts.join(' ')}\n`;
  process.stdout.write(line);
  try {
    fs.appendFileSync(path.join(DATA_DIR, 'logs', `server-${now.toISOString().slice(0, 10)}.log`), line);
  } catch { /* logging must never crash the town */ }
}

// ---------- database ----------
const db = new DatabaseSync(path.join(DATA_DIR, 'checkaverse.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 3000;
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trainer TEXT NOT NULL,
    started TEXT NOT NULL,
    ended TEXT,
    moves INTEGER NOT NULL DEFAULT 0,
    phrases INTEGER NOT NULL DEFAULT 0,
    challenges INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS battles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started TEXT NOT NULL,
    ended TEXT NOT NULL,
    seed INTEGER NOT NULL,
    a_trainer TEXT NOT NULL, a_species TEXT NOT NULL,
    b_trainer TEXT NOT NULL, b_species TEXT NOT NULL,
    winner TEXT NOT NULL,
    reason TEXT NOT NULL,
    turns INTEGER NOT NULL,
    picks TEXT NOT NULL
  );
`);
// Any session left open by a crash or power loss is closed at the time the server comes back.
db.prepare(`UPDATE sessions SET ended = ? WHERE ended IS NULL`).run(new Date().toISOString());
const insertSession = db.prepare(`INSERT INTO sessions (trainer, started) VALUES (?, ?)`);
const closeSession = db.prepare(`UPDATE sessions SET ended = ?, moves = ?, phrases = ?, challenges = ? WHERE id = ?`);
const renameSession = db.prepare(`UPDATE sessions SET trainer = ? WHERE id = ?`);
const insertBattle = db.prepare(`INSERT INTO battles (started, ended, seed, a_trainer, a_species, b_trainer, b_species, winner, reason, turns, picks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const setMeta = db.prepare(`INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
setMeta.run('last_start', new Date().toISOString());
setMeta.run('version', VERSION);

// ---------- the town and the houses ----------
// Rooms: 'town' is the shared Checkaverse. 'h<plotId>' is the inside of the house on that plot.
const TOWN_SOLID = new Set(['T', 'W', 'H', 'S']);
// Outdoor maps share one tile set. 'town' is the Checkaverse, 'wilds' is the country north of the gate.
const MAPS = { town: TOWN, wilds: WILDS };
const roomKind = (room) => (MAPS[room] ? room : 'house');
const HOUSE_SOLID = new Set(['X', 'B', 'K', 'N']);
const plots = TOWN.plots.map((p) => ({ ...p, owner: 0, locked: false }));
const players = new Map(); // id -> player
let nextId = 1;

const tileAt = (rows, x, y) => (y >= 0 && y < rows.length && x >= 0 && x < rows[y].length ? rows[y][x] : null);
const inHouse = (plot, x, y) => x >= plot.x && x < plot.x + plot.w && y >= plot.y && y < plot.y + plot.h - 1;
const plotDoorAt = (x, y) => plots.find((pl) => pl.owner && pl.door.x === x && pl.door.y === y);
const plotOfRoom = (room) => plots.find((pl) => `h${pl.id}` === room);

function walkable(room, x, y) {
  if (MAPS[room]) {
    const t = tileAt(MAPS[room].rows, x, y);
    if (t === null || TOWN_SOLID.has(t)) return false;
    return room !== 'town' || !plots.some((pl) => pl.owner && inHouse(pl, x, y));
  }
  const t = tileAt(HOUSE.rows, x, y);
  return t !== null && !HOUSE_SOLID.has(t) && t !== 'D';
}

function trainerName() {
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  for (let i = 0; i < 20; i++) {
    const name = `${pick(NAMES.first)} ${pick(NAMES.second)}`;
    if (![...players.values()].some((p) => p.name === name)) return name;
  }
  // A crowded town can miss on random picks, so check every pair before falling back to a numbered name.
  const taken = new Set([...players.values()].map((p) => p.name));
  const open = NAMES.first.flatMap((a) => NAMES.second.map((b) => `${a} ${b}`)).filter((n) => !taken.has(n));
  if (open.length) return pick(open);
  return `Trainer ${nextId}`;
}

// Tests pin spawn points with CHECKAVERSE_TEST_SPAWN="14,13;15,13" so two players start side by side.
const testSpawns = (process.env.CHECKAVERSE_TEST_SPAWN || '').split(';').filter(Boolean).map((s) => s.split(',').map(Number));
function arrivalPoint() {
  if (testSpawns.length) { const [x, y] = testSpawns.shift(); return { x, y }; }
  // A free arrival spot by the bus stop, so a class arriving at once does not pile onto a few tiles.
  const taken = new Set(inRoom('town').map((o) => `${o.x},${o.y}`));
  const spots = TOWN.arrive.filter(([x, y]) => walkable('town', x, y) && !taken.has(`${x},${y}`));
  if (spots.length) { const [x, y] = spots[Math.floor(Math.random() * spots.length)]; return { x, y }; }
  // All taken: the nearest open tile to the bus stop.
  const [sx, sy] = TOWN.arrive[0];
  const seen = new Set([`${sx},${sy}`]);
  const queue = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.shift();
    if (walkable('town', x, y) && !taken.has(`${x},${y}`)) return { x, y };
    for (const [dx, dy] of Object.values(DIRS)) {
      const k = `${x + dx},${y + dy}`;
      if (!seen.has(k) && walkable('town', x + dx, y + dy)) { seen.add(k); queue.push([x + dx, y + dy]); }
    }
  }
  return { x: sx, y: sy };
}

const COLORS = ['#e4572e', '#29335c', '#f3a712', '#669bbc', '#a8c686', '#8e44ad', '#d35400', '#16a085', '#c0392b', '#2c3e50'];
const LOOKS = 4; // trainer-a to trainer-d in public/art
const publicView = (p) => ({ id: p.id, name: p.name, x: p.x, y: p.y, f: p.facing, c: p.color, busy: p.busy, look: p.look, pt: p.partner, inb: Boolean(p.battle) });
const plotView = (pl) => ({ id: pl.id, owner: pl.owner, name: pl.owner ? players.get(pl.owner)?.name || '' : '', locked: pl.locked });
const inRoom = (room) => [...players.values()].filter((p) => p.room === room);

function send(p, msg) {
  if (p.ws.readyState === 1) p.ws.send(JSON.stringify(msg));
}
function toRoom(room, msg, exceptId = 0) {
  const raw = JSON.stringify(msg);
  for (const p of players.values()) if (p.room === room && p.id !== exceptId && p.ws.readyState === 1) p.ws.send(raw);
}
function toAll(msg) {
  const raw = JSON.stringify(msg);
  for (const p of players.values()) if (p.ws.readyState === 1) p.ws.send(raw);
}
const sendPlots = () => toAll({ t: 'plots', plots: plots.map(plotView) });

function changeRoom(p, room, x, y, facing) {
  pending.delete(p.id);
  stopWatching(p);
  toRoom(p.room, { t: 'leave', id: p.id }, p.id);
  p.room = room; p.x = x; p.y = y; p.facing = facing;
  const plot = plotOfRoom(room);
  send(p, {
    t: 'room', room, kind: roomKind(room),
    owner: plot ? plotView(plot) : null,
    players: inRoom(room).map(publicView),
  });
  toRoom(room, { t: 'join', p: publicView(p) }, p.id);
  if (room === 'wilds') p.grace = WILD.graceSteps;
}

// A house drops into the first free plot when its owner arrives.
function giveHouse(p) {
  const plot = plots.find((pl) => !pl.owner);
  if (!plot) return null;
  plot.owner = p.id;
  plot.locked = false;
  // Anyone standing where the walls go steps out into the front yard.
  for (const other of inRoom('town')) {
    if (inHouse(plot, other.x, other.y)) {
      other.y = plot.y + plot.h - 1;
      toRoom('town', { t: 'pos', id: other.id, x: other.x, y: other.y, f: other.facing });
    }
  }
  return plot;
}

// When the owner leaves, visitors are walked out the front door and the plot empties.
function removeHouse(p) {
  const plot = plots.find((pl) => pl.owner === p.id);
  if (!plot) return;
  const room = `h${plot.id}`;
  plot.owner = 0;
  plot.locked = false;
  for (const visitor of inRoom(room)) {
    if (visitor.id === p.id) continue;
    changeRoom(visitor, 'town', plot.door.x, plot.door.y + 1, 'd');
    send(visitor, { t: 'notice', msg: 'The owner headed home, so their house closed up.' });
  }
  // A trainer who arrived when every plot was taken has been waiting. The longest waiting one moves in now.
  const waiting = [...players.values()].filter((q) => q.id !== p.id && !plots.some((pl) => pl.owner === q.id)).sort((a, b) => a.joined - b.joined)[0];
  const got = waiting && giveHouse(waiting);
  if (got) {
    send(waiting, { t: 'home', plot: got.id });
    send(waiting, { t: 'notice', msg: 'A plot opened up in the Neighborhood. You have a house now.' });
  }
}

// ---------- challenges ----------
// A challenge needs the two trainers standing next to each other in the same place. Saying no is free.
// A turned down challenger waits a few minutes before challenging that same trainer again.
const CHALLENGE_TTL_MS = 20_000;
const DECLINE_WAIT_MS = Number(process.env.CHECKAVERSE_DECLINE_WAIT_MS || 180_000);
const pending = new Map(); // targetId -> { fromId, expires }
const declined = new Map(); // "fromId>toId" -> time the wait ends

const nextTo = (a, b) => a.room === b.room && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 1;

function handleChallenge(p, toId) {
  const target = players.get(toId);
  if (!target || target.id === p.id) return send(p, { t: 'notice', msg: 'That trainer left.' });
  if (!nextTo(p, target)) return send(p, { t: 'notice', msg: 'Walk up next to a trainer to challenge them.' });
  if (p.busy) return send(p, { t: 'notice', msg: 'Turn off Busy to send challenges.' });
  if (p.battle) return send(p, { t: 'notice', msg: 'Finish this battle first.' });
  if (target.battle) return send(p, { t: 'notice', msg: `${target.name} is already in a battle.` });
  if (target.busy) return send(p, { t: 'notice', msg: `${target.name} is Busy right now.` });
  const waitUntil = declined.get(`${p.id}>${target.id}`) || 0;
  if (waitUntil > Date.now()) {
    const mins = Math.ceil((waitUntil - Date.now()) / 60_000);
    return send(p, { t: 'notice', msg: `${target.name} said no. Try them again in ${mins} minute${mins === 1 ? '' : 's'}.` });
  }
  const existing = pending.get(target.id);
  if (existing && existing.expires > Date.now()) return send(p, { t: 'notice', msg: `${target.name} is answering another challenge.` });
  pending.set(target.id, { fromId: p.id, expires: Date.now() + CHALLENGE_TTL_MS });
  p.stats.challenges++;
  send(target, { t: 'challenged', from: p.id, name: p.name, ttl: CHALLENGE_TTL_MS });
  send(p, { t: 'notice', msg: `Challenge sent to ${target.name}.` });
}

function handleAnswer(p, fromId, ok) {
  const req = pending.get(p.id);
  if (!req || req.fromId !== fromId || req.expires < Date.now()) {
    pending.delete(p.id);
    return send(p, { t: 'notice', msg: 'That challenge already expired.' });
  }
  pending.delete(p.id);
  const challenger = players.get(fromId);
  if (!challenger) return send(p, { t: 'notice', msg: 'That trainer left.' });
  if (ok && !nextTo(p, challenger)) return send(p, { t: 'notice', msg: `${challenger.name} walked away before you answered.` });
  if (!ok) {
    declined.set(`${challenger.id}>${p.id}`, Date.now() + DECLINE_WAIT_MS);
    send(challenger, { t: 'challenge_result', with: p.id, ok: false, msg: `${p.name} said no thanks.` });
    return send(p, { t: 'notice', msg: 'Challenge declined.' });
  }
  if (p.battle || challenger.battle) return send(p, { t: 'notice', msg: 'One of you is already in a battle.' });
  send(challenger, { t: 'challenge_result', with: p.id, ok: true, msg: `${p.name} accepted!` });
  send(p, { t: 'challenge_result', with: challenger.id, ok: true, msg: 'Battle on!' });
  startBattle(challenger, p);
}

// ---------- live battles ----------
// The server holds every battle. Each turn both trainers pick a move, then the engine plays it out and both
// screens get the same events. A trainer who lets the clock run out Guards. Running out the clock three turns
// in a row, leaving, or giving up forfeits. Knockouts never hurt a Checkling: everyone recovers after the match.
// Trainers nearby can watch. The only thing at stake is the record, which becomes rank points once Check-In
// sends the town a ticket with the student's real partner.
const battles = new Map(); // id -> battle
let nextBattle = 1;

function battleView(b) { return Battle.view(RULES, b.state); }
const sideOf = (b, p) => (b.ids[0] === p.id ? 0 : b.ids[1] === p.id ? 1 : -1);
function battleSend(b, msg) {
  for (const id of [...b.ids, ...b.watchers]) { const q = players.get(id); if (q) send(q, msg); }
}
function setBattling(p, v) {
  toRoom(p.room, { t: 'battling', id: p.id, v });
}

// A trainer's battle partner: a starter at the visit level, or a Checkling they caught this visit at its own level.
function partnerSide(p) {
  const c = /^c(\d)$/.exec(p.partner);
  const caught = c && p.caught[Number(c[1])];
  return caught ? { name: p.name, species: caught.species, level: caught.level } : { name: p.name, species: p.partner };
}
const partnerOk = (p, v) => STARTERS.includes(v) || (/^c\d$/.test(v) && Boolean(p.caught[Number(v.slice(1))]));

function startBattle(a, b) {
  const id = nextBattle++;
  const seed = crypto.randomInt(0, 2 ** 31);
  const state = Battle.createBattle(RULES, [partnerSide(a), partnerSide(b)], seed);
  const bt = { id, ids: [a.id, b.id], names: [a.name, b.name], state, picks: [null, null], log: [], timeouts: [0, 0],
    deadline: Date.now() + TURN_MS, watchers: new Set(), started: new Date().toISOString(), room: a.room };
  battles.set(id, bt);
  for (const q of [a, b]) { stopWatching(q); q.battle = id; pending.delete(q.id); }
  [a, b].forEach((q, i) => send(q, { t: 'battle', id, you: i, view: battleView(bt), turnMs: TURN_MS, left: TURN_MS, intro: RULES.species.species[state.sides[1 - i].species].line }));
  setBattling(a, true); setBattling(b, true);
  // Trainers standing close by hear about it and can watch.
  const near = inRoom(a.room).filter((q) => !q.battle && Math.min(dist(q, a), dist(q, b)) <= RULES.settings.watchDistance);
  for (const q of near) send(q, { t: 'battle_near', id, names: [a.name, b.name] });
  log('battle start', id, a.name, a.partner, 'vs', b.name, b.partner, 'seed', seed);
}
const dist = (p, q) => Math.abs(p.x - q.x) + Math.abs(p.y - q.y);

function handlePick(p, move) {
  const b = battles.get(p.battle);
  if (!b || b.state.over) return;
  const side = sideOf(b, p);
  if (b.picks[side]) return; // one pick per turn, no take backs
  if (typeof move !== 'string' || !Battle.canUse(RULES, b.state, side, move)) return send(p, { t: 'notice', msg: 'Not enough stamina for that. Guard or Recover.' });
  b.picks[side] = move;
  b.timeouts[side] = 0;
  const other = players.get(b.ids[1 - side]);
  if (other) send(other, { t: 'battle_wait', side });
  for (const w of b.watchers) { const q = players.get(w); if (q) send(q, { t: 'battle_wait', side }); }
  if (b.picks[0] && b.picks[1]) playTurn(b);
}

function playTurn(b) {
  const choices = b.picks.map((m, i) => m || Battle.fallbackMove(RULES, b.state, i));
  const { picks, events } = Battle.resolveTurn(RULES, b.state, choices);
  b.log.push(picks);
  b.picks = [null, null];
  if (b.wild && !b.state.over) b.picks[1] = wildPick(b);
  b.deadline = Date.now() + TURN_MS;
  battleSend(b, { t: 'battle_turn', id: b.id, events, view: battleView(b), left: TURN_MS });
  if (b.state.over) finishBattle(b);
}

function finishBattle(b) {
  const st = b.state;
  battles.delete(b.id);
  const winner = st.winner === 'draw' ? 'draw' : b.names[st.winner];
  battleSend(b, { t: 'battle_end', id: b.id, winner: st.winner, reason: st.reason, view: battleView(b) });
  b.ids.forEach((id, i) => {
    const q = players.get(id);
    if (!q) return;
    q.battle = 0;
    if (b.wild) { q.grace = WILD.graceSteps; setBattling(q, false); return; }
    if (st.winner === i) q.record.w++; else if (st.winner === 'draw') q.record.d++; else q.record.l++;
    send(q, { t: 'record', record: q.record });
    setBattling(q, false);
  });
  for (const w of b.watchers) { const q = players.get(w); if (q) q.watching = 0; }
  try {
    insertBattle.run(b.started, new Date().toISOString(), st.seed, b.names[0], st.sides[0].species, b.names[1], st.sides[1].species,
      winner, st.reason, st.turn, JSON.stringify(b.log));
  } catch (err) { log('battle save failed', err.message); }
  log('battle end', b.id, b.names[0], 'vs', b.names[1], 'winner', winner, st.reason, `${st.turn} turns`);
}

// ---------- wild Checklings ----------
// Every step into a terrain zone in the wilds has a small chance to start a battle with a wild Checkling from that
// zone's table. The wild one picks its move the moment the turn starts. Trainers can weaken it and throw a catching
// charm, or run. Caught Checklings stay with the trainer for this visit and can be picked as a battle partner. They are
// kept for good once Check-In sends the town a ticket for each student.
function wildPick(b) {
  const st = b.state, f = st.sides[1];
  const moves = RULES.species.species[f.species].moves.filter((m) => Battle.canUse(RULES, st, 1, m));
  const sig = moves.find((m) => !['strike', 'guard', 'recover'].includes(m));
  const r = Math.random();
  if (sig && r < 0.35) return sig;
  if (moves.includes('strike') && r < 0.75) return 'strike';
  if (f.stamina < 4 && moves.includes('recover')) return 'recover';
  return moves.includes('guard') ? 'guard' : moves[0];
}
function rollSpecies(table) {
  const total = Object.values(table).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [sp, w] of Object.entries(table)) { r -= w; if (r < 0) return sp; }
  return Object.keys(table)[0];
}
function startWild(p, tile) {
  const zone = WILD.zones[tile];
  const species = rollSpecies(zone.table);
  const level = zone.levels[0] + Math.floor(Math.random() * (zone.levels[1] - zone.levels[0] + 1));
  const id = nextBattle++;
  const seed = crypto.randomInt(0, 2 ** 31);
  const state = Battle.createBattle(RULES, [partnerSide(p), { name: 'Wild', species, level }], seed);
  const bt = { id, wild: true, zone: zone.name, ids: [p.id, 0], names: [p.name, 'Wild'], state, picks: [null, null], log: [], timeouts: [0, 0],
    deadline: Date.now() + TURN_MS, watchers: new Set(), started: new Date().toISOString(), room: p.room };
  bt.picks[1] = wildPick(bt);
  battles.set(id, bt);
  p.battle = id; pending.delete(p.id); held(p);
  send(p, { t: 'battle', id, you: 0, wild: true, zone: zone.name, charms: p.charms, view: battleView(bt), turnMs: TURN_MS, left: TURN_MS });
  setBattling(p, true);
  log('wild battle', id, p.name, p.partner, 'vs', species, `lv${level}`, zone.name);
}
const held = (p) => { p.stats.wild = (p.stats.wild || 0) + 1; };

const CATCH_OVERRIDE = process.env.CHECKAVERSE_CATCH_CHANCE ? Number(process.env.CHECKAVERSE_CATCH_CHANCE) : null; // tests only
function catchChance(f) {
  if (CATCH_OVERRIDE !== null) return CATCH_OVERRIDE;
  const c = WILD.catch;
  const hurt = 1 - f.hp / f.maxHp;
  return Math.max(0.05, Math.min(0.95, c.base + c.weak * hurt ** c.curve - 0.02 * (f.level - 8)));
}
function handleCharm(p) {
  const b = battles.get(p.battle);
  if (!b || !b.wild || b.state.over) return;
  if (p.charms <= 0) return send(p, { t: 'notice', msg: 'Out of catching charms for this visit.' });
  if (b.picks[0]) return; // already used this turn
  p.charms--;
  const wildOne = b.state.sides[1];
  const ok = Math.random() < catchChance(wildOne);
  const shakes = ok ? 3 : Math.floor(Math.random() * 3);
  const events = [{ k: 'charm', ok, shakes, left: p.charms }];
  if (ok) {
    Object.assign(b.state, { over: true, winner: 0, reason: 'caught' });
    if (p.caught.length < 6) p.caught.push({ species: wildOne.species, level: wildOne.level });
    send(p, { t: 'party', caught: p.caught, charms: p.charms });
    b.log.push(['charm', 'caught']);
    b.deadline = Date.now() + TURN_MS;
    battleSend(b, { t: 'battle_turn', id: b.id, events, view: battleView(b), left: TURN_MS });
    log('caught', p.name, wildOne.species, `lv${wildOne.level}`);
    return finishBattle(b);
  }
  // The charm missed, so the wild one gets its move against a trainer who spent the turn throwing.
  const turn = Battle.resolveTurn(RULES, b.state, [Battle.PASS, b.picks[1]]);
  b.log.push(['charm', turn.picks[1]]);
  b.picks = [null, null];
  if (!b.state.over) b.picks[1] = wildPick(b);
  b.deadline = Date.now() + TURN_MS;
  send(p, { t: 'party', caught: p.caught, charms: p.charms });
  battleSend(b, { t: 'battle_turn', id: b.id, events: events.concat(turn.events), view: battleView(b), left: TURN_MS });
  if (b.state.over) finishBattle(b);
}
function runFromWild(p) {
  const b = battles.get(p.battle);
  if (!b || !b.wild || b.state.over) return;
  Object.assign(b.state, { over: true, winner: 'draw', reason: 'ran' });
  finishBattle(b);
}

function forfeitBattle(p, reason) {
  const b = battles.get(p.battle);
  if (!b) { p.battle = 0; return; }
  Battle.forfeit(b.state, sideOf(b, p), reason);
  finishBattle(b);
}

function handleWatch(p, battleId) {
  const b = battles.get(battleId);
  if (!b) return send(p, { t: 'notice', msg: 'That battle already ended.' });
  if (p.battle) return;
  const fighters = b.ids.map((id) => players.get(id)).filter(Boolean);
  if (!fighters.some((f) => f.room === p.room && dist(f, p) <= RULES.settings.watchDistance + 2)) return send(p, { t: 'notice', msg: 'Walk closer to watch that battle.' });
  if (p.watching) battles.get(p.watching)?.watchers.delete(p.id);
  b.watchers.add(p.id);
  p.watching = b.id;
  send(p, { t: 'battle', id: b.id, you: null, view: battleView(b), turnMs: TURN_MS, left: Math.max(0, b.deadline - Date.now()) });
}
function stopWatching(p) {
  if (!p.watching) return;
  battles.get(p.watching)?.watchers.delete(p.id);
  p.watching = 0;
}

// The turn clock. While the teacher has the town paused, every clock stands still.
let lastTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const gap = now - lastTick;
  lastTick = now;
  for (const b of [...battles.values()]) {
    if (paused) { b.deadline += gap; continue; }
    if (now < b.deadline) continue;
    const gone = [];
    b.picks.forEach((m, i) => { if (!m) { b.timeouts[i]++; if (b.timeouts[i] >= RULES.settings.timeoutsToForfeit) gone.push(i); } });
    if (gone.length) {
      // Both trainers wandered off: nobody wins. One wandered off: the one still playing wins.
      if (b.wild) Object.assign(b.state, { over: true, winner: 'draw', reason: 'ran' });
      else if (gone.length === 2) Object.assign(b.state, { over: true, winner: 'draw', reason: 'timeout' });
      else Battle.forfeit(b.state, gone[0], 'timeout');
      finishBattle(b);
      continue;
    }
    playTurn(b);
  }
}, 250).unref();

setInterval(() => {
  const now = Date.now();
  for (const [targetId, req] of pending) {
    if (req.expires < now) {
      pending.delete(targetId);
      const from = players.get(req.fromId);
      if (from) send(from, { t: 'notice', msg: 'No answer. The challenge timed out.' });
      // Ignoring counts as no, so nobody can be challenged again every 20 seconds.
      declined.set(`${req.fromId}>${targetId}`, now + DECLINE_WAIT_MS);
    }
  }
  for (const [key, until] of declined) if (until < now) declined.delete(key);
}, 2_000).unref();

// ---------- http ----------
const STARTED = new Date();
const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/plaza.js': ['plaza.js', 'text/javascript; charset=utf-8'],
  '/plaza.css': ['plaza.css', 'text/css; charset=utf-8'],
  '/teacher': ['teacher.html', 'text/html; charset=utf-8'],
  '/teacher.js': ['teacher.js', 'text/javascript; charset=utf-8'],
};
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; connect-src 'self' wss: ws:; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors https://grant-desk.com https://www.grant-desk.com",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://local');
  if (url.pathname === '/health') {
    let dbOk = true;
    try { db.prepare('SELECT 1').get(); } catch { dbOk = false; }
    res.writeHead(dbOk ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      ok: dbOk, service: 'checkaverse', version: VERSION, players: players.size,
      houses: plots.filter((pl) => pl.owner).length, battles: battles.size, startedAt: STARTED.toISOString(), uptimeSec: Math.round(process.uptime()),
    }));
  }
  if (url.pathname.startsWith('/api/teacher/')) return teacherApi(req, res, url.pathname.slice(13));
  // Sprite Book art: /art/<name>.png, plain lowercase names only, nothing outside public/art.
  const art = /^\/art\/([a-z0-9-]+\.png)$/.exec(url.pathname);
  const file = STATIC[url.pathname] || (art && [`art/${art[1]}`, 'image/png', 'public, max-age=3600']);
  if (!file || (req.method !== 'GET' && req.method !== 'HEAD')) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }
  fs.readFile(path.join(HERE, 'public', file[0]), async (err, body) => {
    if (err) { res.writeHead(art ? 404 : 500); return res.end(art ? 'Not found' : 'Missing file'); }
    if (file[1].startsWith('text/html')) {
      try {
        body = Buffer.from(await versionHtmlAssets(body.toString('utf8'), (assetUrl) => {
          const asset = STATIC[assetUrl];
          return asset ? fs.promises.readFile(path.join(HERE, 'public', asset[0])) : null;
        }));
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store', ...SECURITY_HEADERS });
        return res.end('Missing file');
      }
    }
    res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': file[2] || 'no-cache', ...SECURITY_HEADERS });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
});

// ---------- teacher controls ----------
// Pause the town, remove a trainer, and send a message to everyone. Every call needs the teacher key.
let lastRefusalLog = 0; // a page hammering wrong keys gets one log line a minute, not a full disk
function teacherApi(req, res, action) {
  const reply = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...SECURITY_HEADERS }); res.end(JSON.stringify(body)); };
  if (!keyOk(req.headers['x-teacher-key'])) { if (Date.now() - lastRefusalLog > 60_000) { lastRefusalLog = Date.now(); log('teacher key refused', action, '(further refusals this minute not logged)'); } return reply(403, { ok: false, msg: 'Wrong teacher key.' }); }
  if (action === 'state' && req.method === 'GET') {
    return reply(200, { ok: true, paused, version: VERSION, players: [...players.values()].map((p) => ({
      id: p.id, name: p.name, room: p.room === 'town' ? 'Town' : p.room === 'wilds' ? 'The wilds' : `${players.get(plotOfRoom(p.room)?.owner)?.name || 'a'}'s house`,
      busy: p.busy, battling: Boolean(p.battle), record: p.record, minutes: Math.round((Date.now() - p.joined) / 60000), phrases: p.stats.phrases, challenges: p.stats.challenges,
    })) });
  }
  if (req.method !== 'POST') return reply(405, { ok: false });
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 2000) req.destroy(); });
  req.on('end', () => {
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { return reply(400, { ok: false }); }
    if (action === 'pause') {
      paused = Boolean(body.v);
      toAll({ t: 'paused', v: paused });
      log('teacher', paused ? 'paused' : 'resumed');
      return reply(200, { ok: true, paused });
    }
    if (action === 'remove') {
      const p = players.get(Number(body.id));
      if (!p) return reply(404, { ok: false, msg: 'That trainer already left.' });
      log('teacher removed', p.id, p.name);
      send(p, { t: 'removed' });
      setTimeout(() => p.ws.close(4001, 'Removed by teacher'), 100);
      return reply(200, { ok: true });
    }
    if (action === 'say') {
      const msg = String(body.msg || '').replace(/\s+/g, ' ').trim().slice(0, 140);
      if (!msg) return reply(400, { ok: false });
      toAll({ t: 'teacher', msg });
      log('teacher said', msg);
      return reply(200, { ok: true });
    }
    return reply(404, { ok: false });
  });
}

// ---------- websockets ----------
const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
const DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
const MOVE_GAP_MS = 110; // about nine steps a second, faster input is ignored

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://local');
  const origin = req.headers.origin || '';
  if (url.pathname !== '/ws' || (origin && !ALLOWED_ORIGINS.has(origin))) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    return socket.destroy();
  }
  if (players.size >= MAX_PLAYERS) {
    // Finish the handshake so the page can say the town is full instead of saying the bus is broken.
    return wss.handleUpgrade(req, socket, head, (ws) => ws.close(4003, 'Town full'));
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
});

wss.on('connection', (ws) => {
  const spot = arrivalPoint();
  const p = {
    id: nextId++, ws, name: trainerName(), room: 'town', x: spot.x, y: spot.y, facing: 'd',
    color: COLORS[Math.floor(Math.random() * COLORS.length)], busy: false,
    rerolls: REROLLS, look: Math.floor(Math.random() * LOOKS), joined: Date.now(), alive: true, lastMove: 0, moveTokens: 3, budget: 20, lastRefill: Date.now(), strikes: 0,
    stats: { moves: 0, phrases: 0, challenges: 0 },
    partner: STARTERS[Math.floor(Math.random() * STARTERS.length)], battle: 0, watching: 0, record: { w: 0, l: 0, d: 0 },
    caught: [], charms: WILD.charms, grace: 0,
  };
  p.sessionId = Number(insertSession.run(p.name, new Date().toISOString()).lastInsertRowid);
  players.set(p.id, p);
  const plot = giveHouse(p);
  log('join', p.id, p.name, plot ? `plot ${plot.id}` : 'no free plot', `(${players.size} here)`);

  send(p, {
    t: 'welcome', you: p.id, version: VERSION, paused, phrases: PHRASES, signs: SIGNS, rerolls: p.rerolls,
    town: { rows: TOWN.rows, plots: TOWN.plots, props: TOWN.props || [], exits: TOWN.exits || [] }, house: HOUSE,
    wilds: { rows: WILDS.rows, props: WILDS.props, exits: WILDS.exits, name: WILDS.name, zones: Object.fromEntries(Object.entries(WILD.zones).map(([k, z]) => [k, z.name])) },
    charms: WILD.charms,
    room: 'town', myPlot: plot ? plot.id : 0, partner: p.partner, starters: STARTERS.map((id) => ({ id, name: RULES.species.species[id].name, type: RULES.species.species[id].type })),
    players: inRoom('town').map(publicView),
  });
  toRoom('town', { t: 'join', p: publicView(p) }, p.id);
  sendPlots();
  if (!plot) send(p, { t: 'notice', msg: 'Every plot in the Neighborhood is taken right now.' });

  ws.on('pong', () => { p.alive = true; });
  ws.on('message', (raw) => {
    // Simple message budget: 20 messages, refilled at 12 a second. Repeated flooding closes the connection.
    const now = Date.now();
    p.budget = Math.min(20, p.budget + ((now - p.lastRefill) / 1000) * 12);
    p.lastRefill = now;
    if (p.budget < 1) { if (++p.strikes > 50) ws.close(1008, 'Too many messages'); return; }
    p.budget -= 1;
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    handleMessage(p, msg, now);
  });
  ws.on('close', () => {
    if (p.battle) forfeitBattle(p, 'left');
    stopWatching(p);
    players.delete(p.id);
    pending.delete(p.id);
    removeHouse(p);
    closeSession.run(new Date().toISOString(), p.stats.moves, p.stats.phrases, p.stats.challenges, p.sessionId);
    toRoom(p.room, { t: 'leave', id: p.id });
    sendPlots();
    log('leave', p.id, p.name, `(${players.size} here)`);
  });
  ws.on('error', () => {});
});

function handleMove(p, d) {
  const dir = DIRS[d];
  p.facing = d;
  const nx = p.x + dir[0];
  const ny = p.y + dir[1];
  const exit = MAPS[p.room]?.exits?.find((e) => e.x === nx && e.y === ny);
  if (exit) return changeRoom(p, exit.to, exit.at[0], exit.at[1], exit.f);
  if (p.room === 'town') {
    const door = plotDoorAt(nx, ny);
    if (door && d === 'u') {
      if (door.locked && door.owner !== p.id) {
        toRoom('town', { t: 'pos', id: p.id, x: p.x, y: p.y, f: p.facing });
        return send(p, { t: 'notice', msg: `${players.get(door.owner)?.name || 'The owner'} locked the door.` });
      }
      return changeRoom(p, `h${door.id}`, HOUSE.enter[0], HOUSE.enter[1], 'u');
    }
  } else if (nx === HOUSE.exit.x && ny === HOUSE.exit.y) {
    const plot = plotOfRoom(p.room);
    return changeRoom(p, 'town', plot.door.x, plot.door.y + 1, 'd');
  }
  const stepped = walkable(p.room, nx, ny);
  if (stepped) { p.x = nx; p.y = ny; p.stats.moves++; }
  // Facing changes even when the step is blocked, so everyone sees the turn.
  toRoom(p.room, { t: 'pos', id: p.id, x: p.x, y: p.y, f: p.facing });
  // A step into terrain in the wilds can rouse a wild Checkling. Right after a battle there are a few free steps.
  if (stepped && p.room === 'wilds' && !p.battle) {
    const tile = tileAt(WILDS.rows, p.x, p.y);
    const zone = WILD.zones[tile];
    if (!zone) return;
    if (p.grace > 0) { p.grace--; return; }
    if (Math.random() < (WILD_RATE ?? zone.rate)) startWild(p, tile);
  }
}

const PAUSED_OK = new Set(['busy', 'lock', 'answer']);
function handleMessage(p, msg, now) {
  if (paused && !PAUSED_OK.has(msg.t)) {
    if (msg.t === 'move') send(p, { t: 'pos', id: p.id, x: p.x, y: p.y, f: p.facing });
    return;
  }
  switch (msg.t) {
    case 'move': {
      if (!DIRS[msg.d]) return;
      // Nobody walks off in the middle of a battle. Watchers who walk away stop watching.
      if (p.battle) return send(p, { t: 'pos', id: p.id, x: p.x, y: p.y, f: p.facing });
      if (p.watching) stopWatching(p);
      // Walking speed limit with a little slack: up to three steps can arrive bunched together after a
      // Wi-Fi hiccup, but the average can never beat one step per MOVE_GAP_MS. Every move gets an answer,
      // even a refused one, so the walker's screen always knows where the server has them.
      p.moveTokens = Math.min(3, p.moveTokens + (now - p.lastMove) / MOVE_GAP_MS);
      p.lastMove = now;
      if (p.moveTokens < 1) return send(p, { t: 'pos', id: p.id, x: p.x, y: p.y, f: p.facing });
      p.moveTokens -= 1;
      return handleMove(p, msg.d);
    }
    case 'turn': {
      // A quick tap faces a direction without stepping, so a trainer can face someone to talk or challenge.
      if (!DIRS[msg.d] || p.facing === msg.d) return;
      if (now - (p.lastTurn || 0) < 120) return; // spinning in place cannot flood the room
      p.lastTurn = now;
      p.facing = msg.d;
      return toRoom(p.room, { t: 'pos', id: p.id, x: p.x, y: p.y, f: p.facing });
    }
    case 'say': {
      const i = Number(msg.p);
      if (!Number.isInteger(i) || i < 0 || i >= PHRASES.length) return;
      if (now - (p.lastSay || 0) < SAY_GAP_MS) return; // one phrase every two seconds, so nobody can flood the plaza
      p.lastSay = now;
      p.stats.phrases++;
      return toRoom(p.room, { t: 'say', id: p.id, p: i });
    }
    case 'busy':
      if (p.busy === Boolean(msg.v)) return; // nothing changed, so nothing to tell the room
      p.busy = Boolean(msg.v);
      if (p.busy) pending.delete(p.id);
      return toRoom(p.room, { t: 'busy', id: p.id, v: p.busy });
    case 'lock': {
      const plot = plots.find((pl) => pl.owner === p.id);
      if (!plot) return;
      plot.locked = Boolean(msg.v);
      send(p, { t: 'notice', msg: plot.locked ? 'Your door is locked. Visitors inside can still leave.' : 'Your door is open for visitors.' });
      return sendPlots();
    }
    case 'reroll': {
      if (p.rerolls <= 0) return send(p, { t: 'notice', msg: 'That was your last new name for this visit.' });
      p.rerolls--;
      const old = p.name;
      p.name = trainerName();
      renameSession.run(p.name, p.sessionId);
      log('rename', p.id, old, '->', p.name);
      toRoom(p.room, { t: 'name', id: p.id, name: p.name, left: p.rerolls });
      if (p.room !== 'town') toRoom('town', { t: 'name', id: p.id, name: p.name });
      return sendPlots();
    }
    case 'look': {
      const v = Number(msg.v);
      if (!Number.isInteger(v) || v < 0 || v >= LOOKS || v === p.look) return;
      p.look = v;
      return toRoom(p.room, { t: 'look', id: p.id, v });
    }
    case 'challenge': return handleChallenge(p, Number(msg.to));
    case 'pick': return handlePick(p, msg.m);
    case 'charm': return handleCharm(p);
    case 'run': return runFromWild(p);
    case 'forfeit': if (p.battle) { if (battles.get(p.battle)?.wild) return runFromWild(p); forfeitBattle(p, 'gave up'); } return;
    case 'watch': return handleWatch(p, Number(msg.id));
    case 'unwatch': return stopWatching(p);
    case 'partner': {
      if (typeof msg.v !== 'string' || !partnerOk(p, msg.v) || p.battle || p.partner === msg.v) return;
      p.partner = msg.v;
      send(p, { t: 'partner', v: p.partner });
      return toRoom(p.room, { t: 'pt', id: p.id, v: p.partner }, p.id);
    }
    case 'answer': return handleAnswer(p, Number(msg.from), Boolean(msg.ok));
    default: return;
  }
}

// Drop connections that stopped answering (closed lids, lost Wi-Fi) so ghosts do not stand in the town.
setInterval(() => {
  for (const p of players.values()) {
    if (!p.alive) { p.ws.terminate(); continue; }
    p.alive = false;
    try { p.ws.ping(); } catch { /* ignore */ }
  }
}, 25_000).unref();

// ---------- start and stop ----------
server.listen(PORT, HOST, () => log(`Checkaverse ${VERSION} listening on http://${HOST}:${PORT} data=${DATA_DIR}`));

function shutdown(signal) {
  log('shutting down on', signal);
  toAll({ t: 'notice', msg: 'The Checkaverse is restarting. You will reconnect in a moment.' });
  for (const b of [...battles.values()]) { b.state.over = true; b.state.winner = 'draw'; b.state.reason = 'restart'; finishBattle(b); }
  for (const p of players.values()) {
    closeSession.run(new Date().toISOString(), p.stats.moves, p.stats.phrases, p.stats.challenges, p.sessionId);
    p.ws.close(1012, 'Restarting');
  }
  server.close();
  try { db.close(); } catch { /* ignore */ }
  setTimeout(() => process.exit(0), 300).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => { log('uncaught', err.stack || err); process.exit(1); });
