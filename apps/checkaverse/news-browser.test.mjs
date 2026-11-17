// The Gazette and the mailbox in a real browser: the paper opens by itself on the first ride of the day, and the
// letters are in the menu. Runs only against a throwaway local server, an invented bus ticket and invented news.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'playwright';
import { signTicket, todayKey } from './accounts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.env.CHECKAVERSE_BROWSER_OUTPUT || path.join(HERE, '../../browser-results/checkaverse-news'));
fs.mkdirSync(out, { recursive: true });
const port = 28000 + Math.floor(Math.random() * 1000), origin = `http://127.0.0.1:${port}`;
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'checkaverse-news-browser-'));
const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(HERE, 'server.mjs')], { cwd: HERE,
  env: { ...process.env, CHECKAVERSE_PORT: String(port), CHECKAVERSE_DATA: data, CHECKAVERSE_ORIGINS: origin, CHECKAVERSE_WILD_RATE: '0.000001' }, stdio: 'pipe' });
let log = ''; child.stdout.on('data', (d) => { log += d; }); child.stderr.on('data', (d) => { log += d; });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
let browser, failed = false;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${origin}/health`)).ok) break; } catch { /* starting */ } await delay(100); }
  const db = new DatabaseSync(path.join(data, 'checkaverse.db'));
  db.exec('PRAGMA busy_timeout = 3000');
  const ins = db.prepare('INSERT INTO world_events (at, day, kind, data) VALUES (?, ?, ?, ?)');
  const ev = (kind, d) => ins.run(new Date().toISOString(), '2020-01-01', kind, JSON.stringify(d));
  ev('catch', { trainer: 'Brave Otter', species: 'zee', level: 6 }); ev('catch', { trainer: 'Quiet Comet', species: 'reedling', level: 9 });
  ev('evolve', { trainer: 'Swift Fox', from: 'mochi', to: 'thicket' }); ev('death', { species: 'bolt', hour: 'Synthetic test' });
  ev('spar', { a: 'Bram', b: 'Tess', winner: 'Bram' }); ev('spar', { a: 'Orin', b: 'Bram', winner: 'Bram' });
  db.prepare('INSERT INTO director_lines (day, who, text, status, made) VALUES (?, ?, ?, ?, ?)').run(todayKey(), 'tess', 'The market was buzzing with talk of that big Reedling catch!', 'live', new Date().toISOString());
  db.close();
  const now = Date.now();
  const ticket = signTicket(fs.readFileSync(path.join(data, 'ticket-key.txt'), 'utf8').trim(), { v: 1, p: 'syntheticNews000000001', h: 'Synthetic test', d: '2026-11-02', c: true, n: 3, s: 4, b: 9, k: { s: 'mochi', n: 'Pip' }, iat: now, exp: now + 7200000, j: 'news' });
  browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${origin}/#t=${encodeURIComponent(ticket)}`);
  await page.waitForSelector('#paperPop:not([hidden])', { timeout: 10000 });
  await delay(300);
  assert.match(await page.textContent('#paperStories'), /Quiet Comet's level 9 Reedling/);
  assert.match(await page.textContent('#paperQuotes'), /Tess/);
  await page.screenshot({ path: path.join(out, 'gazette.png') });
  console.log('  ok the Gazette opens by itself on the first ride of the day');
  await page.click('#paperClose');
  await page.click('#menuBtn');
  await page.waitForSelector('#mailBtn:not([hidden])');
  assert.match(await page.textContent('#mailBtn'), /new/);
  await page.click('#mailBtn');
  await page.waitForSelector('#mailPop:not([hidden])');
  assert.match(await page.textContent('#mailList'), /From Orin/);
  await page.screenshot({ path: path.join(out, 'mail.png') });
  console.log('  ok letters are in the menu');
  assert.deepEqual(errors, []);
  console.log('PASS news browser');
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
