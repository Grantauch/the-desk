// Ghosts in a real browser: frost and glowing ghosts on the real Kettle Creek cemetery hill, then a ghost battle.
// Runs only against a throwaway local server, invented bus tickets and invented graves.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'playwright';
import { signTicket } from './accounts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.env.CHECKAVERSE_BROWSER_OUTPUT || path.join(HERE, '../../browser-results/checkaverse-ghosts'));
fs.mkdirSync(out, { recursive: true });
const port = 22000 + Math.floor(Math.random() * 2000), origin = `http://127.0.0.1:${port}`;
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'checkaverse-ghosts-browser-'));
// The real Kettle Creek, with the trainer waking up on the cemetery hill.
const kettle = JSON.parse(fs.readFileSync(path.join(HERE, 'content', 'kettle.json'), 'utf8'));
kettle.arrive = [[30, 4]];
fs.writeFileSync(path.join(data, 'kettle.json'), JSON.stringify(kettle));
const G = JSON.parse(fs.readFileSync(path.join(HERE, 'content', 'ghosts.json'), 'utf8'));
fs.writeFileSync(path.join(data, 'ghosts.json'), JSON.stringify({ ...G, schoolDaysOnly: false, waitSchoolDays: 0, dailyChance: 1, wanderer: { ...G.wanderer, chance: 1 } }));
const env = { ...process.env, CHECKAVERSE_PORT: String(port), CHECKAVERSE_DATA: data, CHECKAVERSE_ORIGINS: origin,
  CHECKAVERSE_KETTLE: path.join(data, 'kettle.json'), CHECKAVERSE_GHOSTS: path.join(data, 'ghosts.json'), CHECKAVERSE_WILD_RATE: '0.000001' };
let child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(HERE, 'server.mjs')], { cwd: HERE, env, stdio: 'pipe' });
let log = ''; child.stdout.on('data', (d) => { log += d; }); child.stderr.on('data', (d) => { log += d; });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
let browser, failed = false;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${origin}/health`)).ok) break; } catch { /* starting */ } await delay(100); }
  const pid = 'syntheticGhost0000000001';
  const now = Date.now();
  const ticket = signTicket(fs.readFileSync(path.join(data, 'ticket-key.txt'), 'utf8').trim(),
    { v: 1, p: pid, h: 'Synthetic test', d: '2026-11-02', c: true, n: 12, s: 4, b: 9, k: { s: 'mochi', n: '' }, iat: now, exp: now + 7200000, j: 'test' });
  browser = await chromium.launch({ headless: true });
  const open = async () => {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${origin}/#t=${encodeURIComponent(ticket)}`);
    await page.waitForFunction(() => document.querySelector('#placeTitle')?.textContent === 'Kettle Creek', null, { timeout: 8000 });
    return { page, context };
  };
  // First ride makes the trainer. Then two graves go in, and the partner already has Spirit Sight.
  const first = await open(); await first.context.close(); await delay(400);
  const db = new DatabaseSync(path.join(data, 'checkaverse.db'));
  const cid = Number(db.prepare("INSERT INTO checklings (pid, species, nick, xp, party, hatched, origin, born, died) VALUES (?, 'zee', 'Pip', 900, 0, 0, 'egg', '2026-09-01T12:00:00Z', 'malnutrition')").run(pid).lastInsertRowid);
  const grave = db.prepare('INSERT INTO graves (hour, trainer, species, level, days, cause, epitaph, died, pid, cid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  grave.run('Synthetic test', 'Quiet Comet', 'bolt', 7, 12, 'cold', 'It sneezed its last.', '2026-10-01T12:00:00Z', 'someoneElse', 0);
  grave.run('Synthetic test', 'Brave Otter', 'zee', 6, 20, 'malnutrition', 'Should have eaten.', '2026-10-02T12:00:00Z', pid, cid);
  db.prepare('UPDATE trainers SET items = ? WHERE pid = ?').run(JSON.stringify({ graveMoss: 1, sightUntil: Date.now() + 9 * 60_000 }), pid);
  db.close();

  const { page } = await open();
  await page.waitForFunction(() => /Spirit Sight/.test(document.querySelector('#place')?.textContent || ''), null, { timeout: 5000 });
  // The Gazette opens by itself on the first ride of the day; fold it like a student would.
  await page.waitForSelector('#paperPop:not([hidden])', { timeout: 4000 }).then(() => page.click('#paperClose')).catch(() => {});
  await delay(1200);
  await page.screenshot({ path: path.join(out, 'cemetery-ghosts.png') });
  console.log('  ok the cemetery hill shows glowing ghosts and the Spirit Sight chip');

  // The trainer stands at (30,4). This trainer's own ghost floats at (29,4), next to its stone at (29,3).
  await page.click('#tipOk').catch(() => {});
  const walkLeft = async () => { await page.keyboard.down('ArrowLeft'); await delay(260); await page.keyboard.up('ArrowLeft'); };
  // The trainer stands at (30,4). Ghosts float at (29,4) and (28,4), one of them this trainer's own. Which is which
  // depends on the day's seed, so the test handles both orders.
  let sawTheirs = false, sawMine = false;
  for (let tries = 0; tries < 2 && !sawMine; tries++) {
    await walkLeft();
    await page.waitForSelector('#battle:not([hidden])', { timeout: 5000 });
    await delay(1500);
    const foe = await page.textContent('#bFoeName');
    assert.ok(await page.$eval('#bFoeMon', (el) => el.classList.contains('ghostly')));
    if (/Pip's ghost/.test(foe)) {
      assert.match(await page.textContent('#bFoeTrainer'), /Ghost · angry/);
      assert.ok(await page.$eval('#bCharm', (el) => !el.disabled && /Throw charm/.test(el.textContent)));
      await page.screenshot({ path: path.join(out, 'ghost-battle-mine.png') });
      sawMine = true;
    } else {
      assert.match(await page.textContent('#bFoeTrainer'), /Ghost · restless/);
      assert.ok(await page.$eval('#bCharm', (el) => el.disabled && /Not yours to catch/.test(el.textContent)));
      await page.screenshot({ path: path.join(out, 'ghost-battle-classmate.png') });
      sawTheirs = true;
      await page.keyboard.press('Digit6');
      await page.waitForSelector('#bDone:not([hidden])', { timeout: 5000 });
      await page.click('#bClose');
      await page.waitForSelector('#battle', { state: 'hidden', timeout: 5000 });
    }
  }
  assert.ok(sawMine, 'reached this trainer\'s own ghost');
  console.log(`  ok walking into a ghost starts a ghost battle${sawTheirs ? ', a classmate\'s cannot be caught' : ''}, and your own can`);
  assert.deepEqual(errors, []);
  console.log('PASS ghosts browser');
} catch (err) {
  failed = true;
  console.error('FAIL', err.stack || err.message);
  console.error(log.split('\n').slice(-20).join('\n'));
  console.error(errors);
} finally {
  await browser?.close();
  child.kill();
  await delay(300);
  fs.rmSync(data, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}
