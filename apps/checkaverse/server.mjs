// Checkaverse live server.
// One process: serves the plaza page, runs the shared town over WebSockets, records sessions in SQLite.
// The server is the authority. Browsers send intentions (move, say, challenge) and only draw what the server says.
// Settings come from environment variables so the same folder runs on the home PC or a rented server.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { WebSocketServer } from 'ws';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VERSION = '0.1.0';
const PORT = Number(process.env.CHECKAVERSE_PORT || 8787);
const HOST = process.env.CHECKAVERSE_HOST || '127.0.0.1';
const DATA_DIR = process.env.CHECKAVERSE_DATA || path.resolve(HERE, '..', 'storage');
const MAX_PLAYERS = Number(process.env.CHECKAVERSE_MAX_PLAYERS || 200);
const ALLOWED_ORIGINS = new Set(
  (process.env.CHECKAVERSE_ORIGINS ||
    'https://game.grant-desk.com,https://grant-desk.com,https://www.grant-desk.com,http://localhost:8787,http://127.0.0.1:8787')
    .split(',').map((s) => s.trim()).filter(Boolean)
);

fs.mkdirSync(path.join(DATA_DIR, 'logs'), { recursive: true });

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
`);
// Any session left open by a crash or power loss gets closed at the time the server comes back.
db.prepare(`UPDATE sessions SET ended = ? WHERE ended IS NULL`).run(new Date().toISOString());
const insertSession = db.prepare(`INSERT INTO sessions (trainer, started) VALUES (?, ?)`);
const closeSession = db.prepare(`UPDATE sessions SET ended = ?, moves = ?, phrases = ?, challenges = ? WHERE id = ?`);
const setMeta = db.prepare(`INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
setMeta.run('last_start', new Date().toISOString());
setMeta.run('version', VERSION);

// ---------- the town ----------
// Test plaza for the first live phase. T tree, W water, H building, S bus stop sign are solid.
// P path and F flowers are walkable. The real Checkaverse map replaces this from the content folders later.
const MAP = [
  'TTTTTTTTTTTTTTTTTTTTTTTT',
  'T......FF......HHHH....T',
  'T..HHHH........HHHH....T',
  'T..HHHH...F....HHHH..F.T',
  'T..HHHH.......PPPPP....T',
  'T....P........P........T',
  'T....PPPPPPPPPPPPPPPP..T',
  'T....P....F...P.....P..T',
  'T..F.P...WWWW.P.....P..T',
  'T....P..WWWWWWP..F..P..T',
  'T....P...WWWW.P.....PS.T',
  'T....PPPPPPPPPP.....P..T',
  'T..........F..P..TT.P..T',
  'T.FF..........P..TT.PP.T',
  'T.............PPPPPPP..T',
  'TTTTTTTTTTTTTTTTTTTTTTTT',
];
const MAP_W = MAP[0].length;
const MAP_H = MAP.length;
const SOLID = new Set(['T', 'W', 'H', 'S']);
const walkable = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && !SOLID.has(MAP[y][x]);

const PHRASES = [
  'Hi!',
  'Nice Checkling!',
  'Want to battle?',
  'Good game!',
  'Watch this!',
  'Not today.',
  'See you tomorrow!',
  'Wow!',
];

const NAME_A = ['Mossy', 'Rapid', 'Quiet', 'Lucky', 'Brave', 'Sunny', 'Misty', 'Copper', 'Velvet', 'Thunder', 'Pebble', 'Maple',
  'Crimson', 'Frosty', 'Dusty', 'Clever', 'Wild', 'Golden', 'Shadow', 'Breezy', 'Tiny', 'Mighty', 'Cosmic', 'Rusty'];
const NAME_B = ['Comet', 'Badger', 'Lantern', 'Otter', 'Falcon', 'Pickle', 'Biscuit', 'Rocket', 'Acorn', 'Moose', 'Sprout', 'Raven',
  'Cobble', 'Waffle', 'Hornet', 'Turnip', 'Pretzel', 'Beacon', 'Thistle', 'Gopher', 'Nugget', 'Walrus', 'Cricket', 'Ember'];
const COLORS = ['#e4572e', '#29335c', '#f3a712', '#669bbc', '#a8c686', '#8e44ad', '#d35400', '#16a085', '#c0392b', '#2c3e50'];

const players = new Map(); // id -> player
let nextId = 1;

function trainerName() {
  for (let i = 0; i < 20; i++) {
    const name = `${NAME_A[Math.floor(Math.random() * NAME_A.length)]} ${NAME_B[Math.floor(Math.random() * NAME_B.length)]}`;
    if (![...players.values()].some((p) => p.name === name)) return name;
  }
  return `Trainer ${nextId}`;
}

// Tests pin spawn points with CHECKAVERSE_TEST_SPAWN="5,6;6,6" so two players start side by side.
const testSpawns = (process.env.CHECKAVERSE_TEST_SPAWN || '').split(';').filter(Boolean).map((s) => s.split(',').map(Number));
function spawnPoint() {
  if (testSpawns.length) { const [x, y] = testSpawns.shift(); return { x, y }; }
  for (let i = 0; i < 200; i++) {
    const x = 1 + Math.floor(Math.random() * (MAP_W - 2));
    const y = 1 + Math.floor(Math.random() * (MAP_H - 2));
    if (walkable(x, y) && MAP[y][x] === 'P') return { x, y };
  }
  return { x: 14, y: 6 };
}

const publicView = (p) => ({ id: p.id, name: p.name, x: p.x, y: p.y, f: p.facing, c: p.color, busy: p.busy });

function send(p, msg) {
  if (p.ws.readyState === 1) p.ws.send(JSON.stringify(msg));
}
function broadcast(msg, exceptId = 0) {
  const raw = JSON.stringify(msg);
  for (const p of players.values()) if (p.id !== exceptId && p.ws.readyState === 1) p.ws.send(raw);
}

// ---------- challenges ----------
// A challenge needs the two trainers standing next to each other. Saying no costs nothing.
const CHALLENGE_TTL_MS = 20_000;
const pending = new Map(); // targetId -> { fromId, expires }

function nextTo(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 1;
}

function handleChallenge(p, toId) {
  const target = players.get(toId);
  if (!target || target.id === p.id) return send(p, { t: 'notice', msg: 'That trainer left the plaza.' });
  if (!nextTo(p, target)) return send(p, { t: 'notice', msg: 'Walk up next to a trainer to challenge them.' });
  if (p.busy) return send(p, { t: 'notice', msg: 'Turn off Busy to send challenges.' });
  if (target.busy) return send(p, { t: 'notice', msg: `${target.name} is Busy right now.` });
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
  if (!challenger) return send(p, { t: 'notice', msg: 'That trainer left the plaza.' });
  if (!ok) {
    send(challenger, { t: 'challenge_result', with: p.id, ok: false, msg: `${p.name} said no thanks.` });
    return send(p, { t: 'notice', msg: 'Challenge declined.' });
  }
  // Battles themselves arrive with Phase 3. Today the handshake proves two Chromebooks can find each other live.
  const msg = 'Challenge accepted! Live battles open when Phase 3 ships.';
  send(challenger, { t: 'challenge_result', with: p.id, ok: true, msg });
  send(p, { t: 'challenge_result', with: challenger.id, ok: true, msg });
  log('challenge accepted', challenger.name, 'vs', p.name);
}

setInterval(() => {
  const now = Date.now();
  for (const [targetId, req] of pending) {
    if (req.expires < now) {
      pending.delete(targetId);
      const from = players.get(req.fromId);
      if (from) send(from, { t: 'notice', msg: 'No answer. The challenge timed out.' });
    }
  }
}, 2_000).unref();

// ---------- http ----------
const STARTED = new Date();
const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/plaza.js': ['plaza.js', 'text/javascript; charset=utf-8'],
  '/plaza.css': ['plaza.css', 'text/css; charset=utf-8'],
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
      startedAt: STARTED.toISOString(), uptimeSec: Math.round(process.uptime()),
    }));
  }
  const file = STATIC[url.pathname];
  if (!file || (req.method !== 'GET' && req.method !== 'HEAD')) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }
  fs.readFile(path.join(HERE, 'public', file[0]), (err, body) => {
    if (err) { res.writeHead(500); return res.end('Missing file'); }
    res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-cache', ...SECURITY_HEADERS });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
});

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
    socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
    return socket.destroy();
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
});

wss.on('connection', (ws) => {
  const spot = spawnPoint();
  const p = {
    id: nextId++, ws, name: trainerName(), x: spot.x, y: spot.y, facing: 'd',
    color: COLORS[Math.floor(Math.random() * COLORS.length)], busy: false,
    alive: true, lastMove: 0, budget: 20, lastRefill: Date.now(), strikes: 0,
    stats: { moves: 0, phrases: 0, challenges: 0 },
  };
  p.sessionId = Number(insertSession.run(p.name, new Date().toISOString()).lastInsertRowid);
  players.set(p.id, p);
  log('join', p.id, p.name, `(${players.size} here)`);

  send(p, {
    t: 'welcome', you: p.id, version: VERSION, map: MAP, phrases: PHRASES,
    players: [...players.values()].map(publicView),
  });
  broadcast({ t: 'join', p: publicView(p) }, p.id);

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
    players.delete(p.id);
    pending.delete(p.id);
    closeSession.run(new Date().toISOString(), p.stats.moves, p.stats.phrases, p.stats.challenges, p.sessionId);
    broadcast({ t: 'leave', id: p.id });
    log('leave', p.id, p.name, `(${players.size} here)`);
  });
  ws.on('error', () => {});
});

function handleMessage(p, msg, now) {
  switch (msg.t) {
    case 'move': {
      const dir = DIRS[msg.d];
      if (!dir || now - p.lastMove < MOVE_GAP_MS) return;
      p.lastMove = now;
      p.facing = msg.d;
      const nx = p.x + dir[0];
      const ny = p.y + dir[1];
      if (walkable(nx, ny)) { p.x = nx; p.y = ny; p.stats.moves++; }
      // Facing changes even when the step is blocked, so everyone sees the turn.
      broadcast({ t: 'pos', id: p.id, x: p.x, y: p.y, f: p.facing });
      return;
    }
    case 'say': {
      const i = Number(msg.p);
      if (!Number.isInteger(i) || i < 0 || i >= PHRASES.length) return;
      p.stats.phrases++;
      broadcast({ t: 'say', id: p.id, p: i });
      return;
    }
    case 'busy': {
      p.busy = Boolean(msg.v);
      if (p.busy) pending.delete(p.id);
      broadcast({ t: 'busy', id: p.id, v: p.busy });
      return;
    }
    case 'challenge': return handleChallenge(p, Number(msg.to));
    case 'answer': return handleAnswer(p, Number(msg.from), Boolean(msg.ok));
    default: return;
  }
}

// Drop connections that stopped answering (closed lids, lost Wi-Fi) so ghosts do not stand in the plaza.
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
  broadcast({ t: 'notice', msg: 'The Checkaverse is restarting. You will reconnect in a moment.' });
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
