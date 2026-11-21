// play.grant-desk.com: a small room server for two player browser games.
// It pairs players, relays their messages and decides who won when someone leaves.
// It keeps no student data. Rooms live in memory and disappear when the match ends.
import { createServer } from "node:http";
import { randomBytes, randomInt } from "node:crypto";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 4200);
const HOST = process.env.HOST || "127.0.0.1";
const GRACE_MS = Number(process.env.GRACE_MS || 30000); // time to reconnect after a dropped connection
const ROOM_IDLE_MS = 2 * 60 * 60 * 1000;
const WAIT_MS = 15 * 60 * 1000; // an open room with one player closes after this
const MAX_ROOMS = 600;
const MAX_MSG = 2048;
const RATE = 40; // messages per second per connection
const GAMES = {
  blitzkrieg: { maps: [0, 1, 2] },
};
const ORIGINS = (process.env.ORIGINS || "https://grant-desk.com,https://www.grant-desk.com").split(",").map((s) => s.trim()).filter(Boolean);
const ALLOW_LOCAL = process.env.ALLOW_LOCAL === "1";
const CODE_LETTERS = "BCDFGHJKMNPQRSTVWXZ"; // no vowels, so codes never spell words

const rooms = new Map(); // code -> room
const quick = new Map(); // game -> room waiting for a quick match
let served = 0;

function log(...a) { console.log(new Date().toISOString(), ...a); }

function newCode() {
  for (let i = 0; i < 50; i++) {
    let c = "";
    for (let k = 0; k < 4; k++) c += CODE_LETTERS[randomInt(CODE_LETTERS.length)];
    if (!rooms.has(c)) return c;
  }
  return null;
}

function send(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function makeRoom(game, isQuick) {
  if (rooms.size >= MAX_ROOMS) return null;
  const code = newCode();
  if (!code) return null;
  const room = { code, game, quick: isQuick, seats: [null, null], made: Date.now(), touched: Date.now(), started: false, over: false };
  rooms.set(code, room);
  return room;
}

function seat(room, ws) {
  const i = room.seats[0] ? 1 : 0;
  room.seats[i] = { ws, token: randomBytes(12).toString("hex"), awayTimer: null, lost: false };
  ws.room = room;
  ws.seat = i;
  room.touched = Date.now();
  return i;
}

function start(room) {
  const g = GAMES[room.game];
  room.started = true;
  room.seed = randomInt(1, 2 ** 30);
  room.map = g.maps[randomInt(g.maps.length)];
  served++;
  room.seats.forEach((s, i) => send(s.ws, { t: "start", code: room.code, seed: room.seed, map: room.map, side: i, token: s.token }));
  log("start", room.game, room.code, "map", room.map);
}

function close(room, why) {
  if (!rooms.has(room.code)) return;
  rooms.delete(room.code);
  if (quick.get(room.game) === room) quick.delete(room.game);
  for (const s of room.seats) if (s && s.awayTimer) clearTimeout(s.awayTimer);
  log("close", room.code, why);
}

function finish(room, winner, why) {
  if (room.over) return;
  room.over = true;
  room.seats.forEach((s, i) => s && send(s.ws, { t: "end", win: i === winner, why }));
  setTimeout(() => close(room, "ended " + why), 5000);
}

function other(room, i) { return room.seats[1 - i]; }

function leave(ws, why) {
  const room = ws.room;
  if (!room) return;
  ws.room = null;
  const i = ws.seat;
  if (!room.started) { close(room, "host left"); return; }
  if (room.over) return;
  finish(room, 1 - i, why);
}

function onMessage(ws, raw) {
  if (raw.length > MAX_MSG) return ws.close(1009, "too big");
  const now = Date.now();
  if (now - ws.windowStart > 1000) { ws.windowStart = now; ws.count = 0; }
  if (++ws.count > RATE) return;
  let m;
  try { m = JSON.parse(raw); } catch { return; }
  if (!m || typeof m.t !== "string") return;
  const game = typeof m.game === "string" && GAMES[m.game] ? m.game : null;

  switch (m.t) {
    case "quick": {
      if (ws.room || !game) return;
      const waiting = quick.get(game);
      if (waiting && !waiting.started && waiting.seats[0] && waiting.seats[0].ws.readyState === 1) {
        quick.delete(game);
        seat(waiting, ws);
        start(waiting);
      } else {
        const room = makeRoom(game, true);
        if (!room) return send(ws, { t: "error", msg: "The server is full. Try again in a minute." });
        seat(room, ws);
        quick.set(game, room);
        send(ws, { t: "waiting", quick: true });
      }
      return;
    }
    case "create": {
      if (ws.room || !game) return;
      const room = makeRoom(game, false);
      if (!room) return send(ws, { t: "error", msg: "The server is full. Try again in a minute." });
      seat(room, ws);
      send(ws, { t: "waiting", code: room.code });
      return;
    }
    case "join": {
      if (ws.room) return;
      const code = String(m.code || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
      const room = rooms.get(code);
      if (!room || room.quick) return send(ws, { t: "error", msg: "No room with that code. Check the letters with your opponent." });
      if (room.started) return send(ws, { t: "error", msg: "That room already has two players." });
      if (game && room.game !== game) return send(ws, { t: "error", msg: "That code is for a different game." });
      seat(room, ws);
      start(room);
      return;
    }
    case "rejoin": {
      if (ws.room) return;
      const room = rooms.get(String(m.code || ""));
      if (!room || room.over) return send(ws, { t: "gone" });
      const i = room.seats.findIndex((s) => s && s.token === m.token);
      if (i < 0) return send(ws, { t: "gone" });
      const s = room.seats[i];
      if (s.awayTimer) { clearTimeout(s.awayTimer); s.awayTimer = null; }
      const old = s.ws;
      s.ws = ws;
      ws.room = room;
      ws.seat = i;
      if (old && old !== ws) { old.room = null; try { old.close(4000, "replaced"); } catch { /* already closed */ } }
      send(ws, { t: "rejoined" });
      send(other(room, i) && other(room, i).ws, { t: "back" });
      return;
    }
    case "relay": {
      const room = ws.room;
      if (!room || !room.started || room.over) return;
      room.touched = now;
      const o = other(room, ws.seat);
      if (o) send(o.ws, { t: "relay", d: m.d });
      return;
    }
    case "lost": {
      const room = ws.room;
      if (!room || !room.started) return;
      finish(room, 1 - ws.seat, "overrun");
      return;
    }
    case "leave": {
      leave(ws, "left");
      return;
    }
    case "ping": {
      send(ws, { t: "pong", at: m.at });
      return;
    }
  }
}

function onClose(ws) {
  const room = ws.room;
  if (!room) return;
  const i = ws.seat;
  const s = room.seats[i];
  if (!s || s.ws !== ws) return;
  if (!room.started) { close(room, "waiting player left"); return; }
  if (room.over) return;
  // Give a dropped Chromebook time to come back before calling the match.
  send(other(room, i) && other(room, i).ws, { t: "away", seconds: Math.round(GRACE_MS / 1000) });
  s.awayTimer = setTimeout(() => {
    s.awayTimer = null;
    if (s.ws === ws) finish(room, 1 - i, "disconnected");
  }, GRACE_MS);
}

const http = createServer((req, res) => {
  if (req.url === "/health") {
    let players = 0;
    for (const r of rooms.values()) players += r.seats.filter(Boolean).length;
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store", "access-control-allow-origin": "*" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, players, matches: served, up: Math.round(process.uptime()) }));
    return;
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("Not found");
});

function originOk(origin) {
  if (!origin) return false;
  if (ORIGINS.includes(origin)) return true;
  return ALLOW_LOCAL && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
}

const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MSG });
http.on("upgrade", (req, socket, head) => {
  if (!req.url.startsWith("/ws") || !originOk(req.headers.origin)) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

wss.on("connection", (ws) => {
  ws.alive = true;
  ws.windowStart = Date.now();
  ws.count = 0;
  ws.on("pong", () => { ws.alive = true; });
  ws.on("message", (data) => onMessage(ws, data.toString()));
  ws.on("close", () => onClose(ws));
  ws.on("error", () => {});
  send(ws, { t: "hello", v: 1 });
});

// Drop dead sockets and stale rooms.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false;
    try { ws.ping(); } catch { /* closing */ }
  }
  const now = Date.now();
  for (const r of rooms.values()) {
    if (!r.started && now - r.made > WAIT_MS) close(r, "nobody joined");
    else if (now - r.touched > ROOM_IDLE_MS) close(r, "idle");
  }
}, 15000);

http.listen(PORT, HOST, () => log(`play server on ${HOST}:${PORT}`));
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { log("stopping"); http.close(); process.exit(0); });
