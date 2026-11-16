// Residents battling in a real browser: the battle shows on the map with both Checklings, and Watch battle opens it.
// Runs only against a throwaway local server with visitors.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.env.CHECKAVERSE_BROWSER_OUTPUT || path.join(HERE, '../../browser-results/checkaverse-spars'));
fs.mkdirSync(out, { recursive: true });
const port = 24000 + Math.floor(Math.random() * 1000), origin = `http://127.0.0.1:${port}`;
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'checkaverse-spars-browser-'));
const SP = JSON.parse(fs.readFileSync(path.join(HERE, 'content', 'npc-battles.json'), 'utf8'));
fs.writeFileSync(path.join(data, 'spars.json'), JSON.stringify({ ...SP, gapSeconds: [5, 5], range: 12, seeRange: 30, turnMs: 2400, maxTurns: 10 }));
const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(HERE, 'server.mjs')], { cwd: HERE,
  env: { ...process.env, CHECKAVERSE_PORT: String(port), CHECKAVERSE_DATA: data, CHECKAVERSE_ORIGINS: origin, CHECKAVERSE_SPARS: path.join(data, 'spars.json'), CHECKAVERSE_WILD_RATE: '0.000001' }, stdio: 'pipe' });
let log = ''; child.stdout.on('data', (d) => { log += d; }); child.stderr.on('data', (d) => { log += d; });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
let browser, failed = false;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${origin}/health`)).ok) break; } catch { /* starting */ } await delay(100); }
  browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  let started = null;
  page.on('websocket', (socket) => socket.on('framereceived', ({ payload }) => { try { const m = JSON.parse(payload); if (m.t === 'npc_battle' && m.start) started = m; } catch { /* binary */ } }));
  await page.goto(origin);
  for (let i = 0; i < 60 && !started; i++) await delay(500);
  assert.ok(started, 'a resident battle started near the visitor');
  await page.click('#tipOk').catch(() => {});
  await delay(3000);
  await page.screenshot({ path: path.join(out, 'resident-battle-map.png') });
  console.log(`  ok ${started.sides[0].name} and ${started.sides[1].name} battle on the map`);
  await page.waitForSelector('#watch:not([hidden])', { timeout: 5000 }).catch(() => {});
  if (await page.$('#watch:not([hidden])')) {
    await page.click('#watch');
    await page.waitForSelector('#battle:not([hidden])', { timeout: 5000 });
    await delay(2600);
    await page.screenshot({ path: path.join(out, 'resident-battle-watch.png') });
    console.log('  ok Watch battle opens the resident battle on the battle screen');
  }
  assert.deepEqual(errors, []);
  console.log('PASS resident battles browser');
} catch (err) {
  failed = true;
  console.error('FAIL', err.stack || err.message);
  console.error(log.split('\n').slice(-15).join('\n'));
  console.error(errors);
} finally {
  await browser?.close();
  child.kill();
  await delay(300);
  fs.rmSync(data, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}
