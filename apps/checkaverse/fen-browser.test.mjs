// Bramblefen Basin in a real browser: the walk from town through the wilds into the basin, the chunked ground, the
// hash check between the browser's map and the town's, and the frame rate while walking a trail.
// Runs only against a throwaway local server.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { generateFen, FEN_SOLID } from './public/fen.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.env.CHECKAVERSE_BROWSER_OUTPUT || path.join(HERE, '../../browser-results/checkaverse-fen'));
fs.mkdirSync(out, { recursive: true });
const port = 23000 + Math.floor(Math.random() * 2000), origin = `http://127.0.0.1:${port}`;
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'checkaverse-fen-browser-'));
const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(HERE, 'server.mjs')], { cwd: HERE,
  env: { ...process.env, CHECKAVERSE_PORT: String(port), CHECKAVERSE_DATA: data, CHECKAVERSE_ORIGINS: origin, CHECKAVERSE_WILD_RATE: '0.000001', CHECKAVERSE_TEST_SPAWN: '12,1' }, stdio: 'pipe' });
let log = ''; child.stdout.on('data', (d) => { log += d; }); child.stderr.on('data', (d) => { log += d; });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [], warnings = [];
const FEN = generateFen(JSON.parse(fs.readFileSync(path.join(HERE, 'content', 'fen.json'), 'utf8')));

// The shortest walk between two tiles in the basin, found here so the browser can be sent along it a leg at a time.
function trail(from, to) {
  const S = FEN.rows.length, prev = new Map([[`${from[0]},${from[1]}`, null]]), q = [from];
  for (let k = 0; k < q.length; k++) {
    const [x, y] = q[k];
    if (x === to[0] && y === to[1]) break;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx, ny = y + dy, key = `${nx},${ny}`, c = FEN.rows[ny]?.[nx];
      if (!c || FEN_SOLID.has(c) || c === 'E' || prev.has(key) || nx < 0 || ny < 0 || nx >= S) continue;
      prev.set(key, [x, y]); q.push([nx, ny]);
    }
  }
  const path = [];
  for (let p = to; p; p = prev.get(`${p[0]},${p[1]}`)) path.unshift(p);
  return path;
}

let browser, failed = false;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${origin}/health`)).ok) break; } catch { /* starting */ } await delay(100); }
  browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warnings.push(m.text()); });
  await page.addInitScript(() => sessionStorage.setItem('checkaverse-tips', JSON.stringify(['walk', 'partner', 'say', 'visitor', 'care', 'kettle', 'sign', 'gate', 'challenge', 'wilds', 'fen'])));
  await page.goto(`${origin}/?debug`);
  await page.waitForFunction(() => window.__checkaverse?.players.size > 0);
  const D = 'window.__checkaverse';
  const where = () => page.evaluate(() => { const d = window.__checkaverse, p = d.players.get(d.me()); return { room: d.room(), x: p.x, y: p.y }; });
  async function walk(x, y, room) {
    await page.evaluate(([x, y]) => window.__checkaverse.walk(x, y), [x, y]);
    await page.waitForFunction(([x, y, room]) => { const d = window.__checkaverse, p = d.players.get(d.me()); return d.room() === room && p && p.x === x && p.y === y; }, [x, y, room], { timeout: 30000 });
  }
  // Town gate, the wilds, the trail north and the way into the basin.
  await walk(12, 0, 'wilds').catch(() => {});
  await page.waitForFunction(() => window.__checkaverse.room() === 'wilds', null, { timeout: 10000 });
  for (const y of [30, 18, 6, 1]) await walk(28, y, 'wilds');
  // The basin map is built in the background soon after reaching the wilds.
  await page.waitForFunction(() => window.__checkaverse.fen().map, null, { timeout: 10000 });
  const built = await page.evaluate(() => { const f = window.__checkaverse.fen(); return { ms: f.ms, hash: f.map.hash, want: f.want }; });
  assert.equal(built.hash, built.want, 'the browser built the same basin as the town');
  assert.equal(built.hash, FEN.hash, 'and the same as this test');
  console.log(`  ok the browser built Bramblefen Basin in ${built.ms} ms and its hash matches the town (${built.hash})`);
  await page.evaluate(() => window.__checkaverse.walk(28, 0));
  await page.waitForFunction(() => window.__checkaverse.room() === 'fen', null, { timeout: 10000 });
  await delay(900);
  let at = await where();
  assert.deepEqual([at.x, at.y], FEN.arrive, 'arrives at the basin gate');
  assert.match(await page.textContent('#place'), /Bramblefen Basin/);
  await page.screenshot({ path: path.join(out, 'fen-gate.png') });
  console.log('  ok walked from town through the wilds into the basin gate');

  // Follow the trail to the Sunken Arch, watching the frame rate and how many chunks get built on the way.
  const arch = FEN.marks.find((m) => m.id === 'arch'), goal = [arch.x, arch.y + 1];
  const steps = trail(FEN.arrive, goal);
  assert.ok(steps.length > 100, 'the arch is a long walk from the gate');
  await page.evaluate(() => { window.__frames = []; const tick = (t) => { window.__frames.push(t); requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  let shots = 0;
  for (let i = 18; i < steps.length + 18; i += 18) {
    const [x, y] = steps[Math.min(i, steps.length - 1)];
    await walk(x, y, 'fen');
    if (++shots === 3) await page.screenshot({ path: path.join(out, 'fen-trail.png') });
  }
  const perf = await page.evaluate(() => {
    const f = window.__frames, gaps = f.slice(1).map((t, i) => t - f[i]).sort((a, b) => a - b);
    return { fps: Math.round((f.length - 1) / ((f.at(-1) - f[0]) / 1000)), p95: Math.round(gaps[Math.floor(gaps.length * 0.95)]), worst: Math.round(gaps.at(-1)), chunks: window.__checkaverse.fen().chunks, built: window.__checkaverse.fen().built };
  });
  console.log(`  ok walked ${steps.length} steps to the Sunken Arch: ${perf.fps} fps, 95th percentile frame ${perf.p95} ms, worst ${perf.worst} ms, ${perf.built} chunks painted, ${perf.chunks} kept`);
  assert.ok(perf.chunks <= 12, 'chunk cache stays bounded');
  assert.match(await page.textContent('#place'), /Sunken Arch/);
  await page.screenshot({ path: path.join(out, 'fen-arch.png') });
  console.log('  ok the place chip names the Sunken Arch when you reach it');

  // Reading the signpost by the arch: walk up beside it, face it and press Space.
  const post = FEN.props.find((p) => p.sign === 'fen-post-pool');
  assert.ok(post, 'a signpost stands by the Big Pool');
  const [sx, sy] = post.f;
  const spot = [[sx, sy + 1, 'ArrowUp'], [sx - 1, sy, 'ArrowRight'], [sx + 1, sy, 'ArrowLeft'], [sx, sy - 1, 'ArrowDown']]
    .map(([x, y, key]) => ({ x, y, key, t: trail(goal, [x, y]) })).find((o) => o.t.length > 1 && o.t[0][0] === goal[0] && o.t[0][1] === goal[1]);
  assert.ok(spot, 'the signpost can be reached');
  for (let i = 18; i < spot.t.length + 18; i += 18) await walk(...spot.t[Math.min(i, spot.t.length - 1)], 'fen');
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.down(spot.key); await delay(200); await page.keyboard.up(spot.key);
  await delay(250);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => /steps/.test(document.getElementById('toast')?.textContent || ''), null, { timeout: 5000 });
  const said = await page.textContent('#toast');
  assert.match(said, /Lantern Ring, north/);
  await page.screenshot({ path: path.join(out, 'fen-signpost.png') });
  console.log(`  ok the signpost by the Big Pool reads: ${said.trim()}`);

  // The basin map opens with M, shows the landmarks and closes with M.
  await page.keyboard.press('KeyM');
  await page.waitForSelector('#fenMapPop:not([hidden])', { timeout: 3000 });
  assert.ok(await page.isVisible('#fenMapBtn'), 'the Map button shows in the basin');
  await page.screenshot({ path: path.join(out, 'fen-map.png') });
  await page.keyboard.press('KeyM');
  await page.waitForSelector('#fenMapPop', { state: 'hidden', timeout: 3000 });
  console.log('  ok the basin map opens and closes with M');

  assert.deepEqual(errors, []);
  assert.deepEqual(warnings.filter((w) => /Bramblefen|fen/i.test(w)), []);
  console.log('PASS bramblefen browser');
} catch (err) {
  failed = true;
  console.error('FAIL', err.stack || err.message);
  console.error(log.split('\n').slice(-15).join('\n'));
  console.error(errors, warnings);
} finally {
  await browser?.close();
  child.kill();
  await delay(300);
  fs.rmSync(data, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}
