// Two browsers play a Blitzkrieg 1 v 1 through a private copy of the play server.
// Run `npm ci --prefix services/play` once first. Set PAGE to test a live page instead of the local files.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const playDir = join(root, "services/play");
if (!existsSync(join(playDir, "node_modules/ws"))) throw new Error("Run npm ci --prefix services/play first.");

const PLAY_PORT = 4298, WEB_PORT = 4481;
const play = spawn(process.execPath, ["server.mjs"], { cwd: playDir, env: { ...process.env, PORT: String(PLAY_PORT), ALLOW_LOCAL: "1", GRACE_MS: "3000" }, stdio: ["ignore", "pipe", "inherit"] });
await new Promise((ok) => play.stdout.once("data", ok));

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".json": "application/json" };
const web = createServer((req, res) => {
  let p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  let file = join(root, "public", p);
  if (!file.startsWith(join(root, "public"))) { res.writeHead(403); return res.end(); }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => web.listen(WEB_PORT, "127.0.0.1", ok));

const page = process.env.PAGE || `http://127.0.0.1:${WEB_PORT}/hubs/blitzkrieg/?play=ws://127.0.0.1:${PLAY_PORT}/ws`;
const browser = await chromium.launch();
const errors = [];
async function player(name) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  await p.goto(page);
  await p.waitForFunction(() => window.BK && BK.Versus && document.getElementById("b-versus"));
  return p;
}

try {
  const A = await player("A"), B = await player("B");
  await A.click("#b-versus");
  await B.click("#b-versus");

  // Room code
  await A.click("#vs-create");
  await A.waitForSelector(".vs-code");
  const code = await A.textContent(".vs-code");
  assert.match(code, /^[A-Z]{4}$/);
  await B.fill("#vs-code", code.toLowerCase());
  await B.click("#vs-join");
  await Promise.all([A.waitForSelector("#vs-bar"), B.waitForSelector("#vs-bar")]);
  const field = (p) => p.evaluate(() => [BK.app.g.map.id, JSON.stringify(BK.app.g.props.slice(0, 6).map((q) => [q.kind, Math.round(q.x), Math.round(q.y)])), BK.app.g.diff, BK.app.g.weatherId, BK.app.g.endless]);
  assert.deepEqual(await field(A), await field(B), "both players get the same battlefield");

  // No pause and no fast forward
  await A.keyboard.press("p");
  await A.keyboard.press("f");
  assert.deepEqual(await A.evaluate(() => [BK.app.paused, BK.app.speed]), [false, 1]);

  // Sending in the build phase waits for the next wave
  await A.evaluate(() => { BK.app.g.money = 500; });
  await A.click('#vs-sends [data-send="squad"]');
  await A.waitForTimeout(1000);
  await A.click('#vs-sends [data-send="moto"]');
  await B.waitForFunction(() => BK.app.g.vsIncoming.length === 9);
  assert.deepEqual(await A.evaluate(() => [BK.Versus.state().eco, BK.app.g.money]), [3, 425]);
  await A.click('#vs-sends [data-send="ltank"]');
  assert.equal(await A.evaluate(() => BK.app.g.money), 425, "a locked send costs nothing");
  await B.evaluate(() => BK.app.g.startWave());
  assert.equal(await B.evaluate(() => [BK.app.g.vsIncoming.length, BK.app.g.queue.filter((q) => q.squad >= 900000).length].join()), "0,6");

  // Sending in combat joins the column
  await A.evaluate(() => { BK.app.g.money = 500; });
  await A.click('#vs-sends [data-send="squad"]');
  await B.waitForFunction(() => BK.app.g.queue.filter((q) => q.squad >= 900000).length + BK.app.g.enemies.filter((e) => e.squad >= 900000).length >= 12);

  // The opponent panel and income clock
  await B.waitForFunction(() => document.getElementById("vs-o-gar").textContent === "20");
  const before = await A.evaluate(() => BK.app.g.money);
  await A.waitForTimeout(6300);
  assert.equal(await A.evaluate(() => BK.app.g.money) - before, 10, "income is 6 plus 4 from sends");

  // Overrun ends it for both
  await B.evaluate(() => { BK.app.g.garrison = 0; BK.app.g.endRun(false); });
  await Promise.all([A.waitForSelector("#vs-result:not(.hidden)"), B.waitForSelector("#vs-result:not(.hidden)")]);
  assert.equal(await A.textContent("#vs-result h2"), "Victory");
  assert.equal(await B.textContent("#vs-result h2"), "Defeat");

  // The menu returns to the normal game, where pause works
  await A.click("#vs-menu");
  assert.equal(await A.evaluate(() => !!document.getElementById("vs-bar")), false);
  await A.evaluate(() => BK.app.startRun(0, false, {}));
  await A.evaluate(() => BK.app.togglePause(true));
  assert.equal(await A.evaluate(() => BK.app.paused), true);
  await A.evaluate(() => { BK.app.toTitle(); document.getElementById("brief").classList.add("hidden"); });

  // Quick match, a dropped connection that comes back, then a surrender
  await B.click("#vs-again");
  await A.click("#b-versus");
  await A.click("#vs-quick");
  await B.click("#vs-quick");
  await Promise.all([A.waitForSelector("#vs-bar"), B.waitForSelector("#vs-bar")]);
  await B.evaluate(() => BK.Versus.state().net.ws.close());
  await A.waitForFunction(() => !document.getElementById("vs-o-away").classList.contains("hidden"));
  await B.waitForFunction(() => BK.Versus.state() && !BK.Versus.state().reconnecting, null, { timeout: 15000 });
  await B.click("#vs-quit");
  await B.click("#vs-quit");
  await A.waitForSelector("#vs-result:not(.hidden)");
  assert.equal(await A.textContent(".vs-why"), "Your opponent surrendered.");

  assert.deepEqual(errors, []);
  console.log("PASS Blitzkrieg 1 v 1: room code, same battlefield, no pause, sends in build and combat, locked send, income, overrun, return to single player, quick match, reconnect, surrender");
} finally {
  await browser.close();
  web.close();
  play.kill();
}
