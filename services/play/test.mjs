// Protocol test for the play server. Starts its own copy on a spare port, or tests PLAY_URL if set.
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import WebSocket from "ws";

const ORIGIN = process.env.PLAY_ORIGIN || "http://127.0.0.1:9";
let url = process.env.PLAY_URL;
let child;
if (!url) {
  const port = 4299;
  child = spawn(process.execPath, ["server.mjs"], { env: { ...process.env, PORT: String(port), ALLOW_LOCAL: "1", GRACE_MS: "1500" }, stdio: ["ignore", "pipe", "inherit"] });
  await new Promise((ok) => child.stdout.once("data", ok));
  url = `ws://127.0.0.1:${port}/ws`;
}

function client() {
  const ws = new WebSocket(url, { origin: ORIGIN });
  const inbox = [];
  const waiters = [];
  ws.on("message", (d) => {
    const m = JSON.parse(d.toString());
    const i = waiters.findIndex((w) => w.t === m.t);
    if (i >= 0) waiters.splice(i, 1)[0].ok(m); else inbox.push(m);
  });
  const c = {
    ws,
    open: () => new Promise((ok, no) => { ws.once("open", ok); ws.once("error", no); }),
    send: (m) => ws.send(JSON.stringify(m)),
    next: (t, ms = 4000) => {
      const i = inbox.findIndex((m) => m.t === t);
      if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
      return new Promise((ok, no) => {
        const w = { t, ok };
        waiters.push(w);
        setTimeout(() => { const k = waiters.indexOf(w); if (k >= 0) { waiters.splice(k, 1); no(new Error("timed out waiting for " + t)); } }, ms);
      });
    },
    close: () => ws.close(),
  };
  return c;
}

try {
  // Room code flow.
  const a = client(), b = client();
  await Promise.all([a.open(), b.open()]);
  a.send({ t: "create", game: "blitzkrieg" });
  const w = await a.next("waiting");
  assert.match(w.code, /^[BCDFGHJKMNPQRSTVWXZ]{4}$/);
  b.send({ t: "join", game: "blitzkrieg", code: w.code.toLowerCase() });
  const [sa, sb] = await Promise.all([a.next("start"), b.next("start")]);
  assert.equal(sa.seed, sb.seed);
  assert.equal(sa.map, sb.map);
  assert.notEqual(sa.side, sb.side);
  a.send({ t: "relay", d: { k: "send", unit: "squad" } });
  assert.deepEqual((await b.next("relay")).d, { k: "send", unit: "squad" });

  // A third player cannot take the seat.
  const c = client();
  await c.open();
  c.send({ t: "join", game: "blitzkrieg", code: w.code });
  assert.match((await c.next("error")).msg, /already has two/);
  c.send({ t: "join", game: "blitzkrieg", code: "QQQQ" });
  assert.match((await c.next("error")).msg, /No room/);

  // A dropped player can come back inside the grace period.
  a.close();
  await b.next("away");
  const a2 = client();
  await a2.open();
  a2.send({ t: "rejoin", code: sa.code, token: sa.token });
  await a2.next("rejoined");
  await b.next("back");
  b.send({ t: "relay", d: { k: "state", gar: 12 } });
  assert.equal((await a2.next("relay")).d.gar, 12);

  // Losing ends the match for both.
  b.send({ t: "lost" });
  const [ea, eb] = await Promise.all([a2.next("end"), b.next("end")]);
  assert.equal(ea.win, true);
  assert.equal(eb.win, false);

  // Quick match pairs the next two players.
  const q1 = client(), q2 = client();
  await Promise.all([q1.open(), q2.open()]);
  q1.send({ t: "quick", game: "blitzkrieg" });
  await q1.next("waiting");
  q2.send({ t: "quick", game: "blitzkrieg" });
  const [s1, s2] = await Promise.all([q1.next("start"), q2.next("start")]);
  assert.equal(s1.seed, s2.seed);

  // Not coming back inside the grace period hands the win to the other player.
  q1.close();
  await q2.next("away");
  const end = await q2.next("end", 6000);
  assert.equal(end.win, true);
  assert.equal(end.why, "disconnected");

  // Unknown origins are refused.
  if (!process.env.PLAY_URL) {
    const bad = new WebSocket(url, { origin: "https://example.com" });
    await new Promise((ok) => { bad.once("error", ok); bad.once("unexpected-response", ok); });
  }

  for (const x of [a2, b, c, q2]) x.close();
  console.log("PASS play server: codes, join, relay, full room, bad code, reconnect, loss, quick match, disconnect forfeit, origin check");
} finally {
  if (child) child.kill();
}
