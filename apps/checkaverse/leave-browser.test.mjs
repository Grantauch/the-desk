// Leave this Chromebook, then the teacher Remove sentence. A throwaway server and invented tickets only.
// Leave clears the tab's bus ticket and comes back as a visitor. A reload before Leave keeps the same trainer.
// A reload after Leave stays a visitor until a new ticket arrives in that same tab.
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
const out = path.resolve(process.env.CHECKAVERSE_BROWSER_OUTPUT || path.join(HERE, '../../browser-results/checkaverse-leave'));
fs.mkdirSync(out, { recursive: true });
const port = 29000 + Math.floor(Math.random() * 1000), origin = `http://127.0.0.1:${port}`;
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'checkaverse-leave-browser-'));
const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(HERE, 'server.mjs')], { cwd: HERE,
  env: { ...process.env, CHECKAVERSE_PORT: String(port), CHECKAVERSE_DATA: data, CHECKAVERSE_ORIGINS: origin, CHECKAVERSE_WILD_RATE: '0.000001', CHECKAVERSE_WEATHER: 'off' }, stdio: 'pipe' });
let log = ''; child.stdout.on('data', (d) => { log += d; }); child.stderr.on('data', (d) => { log += d; });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
let browser, failed = false;

const TIPS = ['walk', 'partner', 'say', 'visitor', 'care', 'kettle', 'sign', 'gate', 'challenge', 'wilds', 'fen', 'battle', 'wild-battle', 'caught', 'caught-visit', 'frost', 'moss', 'ghost-seen', 'ghost-battle'];

function ticket(key, pid, nick) {
  const now = Date.now();
  return signTicket(key, { v: 1, p: pid, h: 'Synthetic test', d: '2026-11-02', c: true, n: 4, s: 3, b: 3, k: { s: 'mochi', n: nick }, iat: now, exp: now + 7200000, j: pid.slice(0, 8) });
}

function savedRows() {
  const db = new DatabaseSync(path.join(data, 'checkaverse.db'));
  const trainers = db.prepare('SELECT pid, name FROM trainers ORDER BY pid').all();
  const checklings = db.prepare('SELECT pid, species, nick, xp, party FROM checklings ORDER BY pid, id').all();
  db.close();
  return { trainers, checklings };
}

try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${origin}/health`)).ok) break; } catch { /* starting */ } await delay(100); }
  const key = fs.readFileSync(path.join(data, 'ticket-key.txt'), 'utf8').trim();
  const first = ticket(key, 'LeaveTrainerA000000001', 'Pip');
  const second = ticket(key, 'LeaveTrainerB000000002', 'Moss');
  browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((tips) => {
    sessionStorage.setItem('checkaverse-tips', JSON.stringify(tips));
  }, TIPS);

  const saved = () => page.waitForFunction(() => {
    const care = document.getElementById('careBtn');
    const note = document.getElementById('partnerNote');
    return care && note && !care.hidden && /travel with you/.test(note.textContent);
  });
  const visiting = () => page.waitForFunction(() => {
    const care = document.getElementById('careBtn');
    const note = document.getElementById('partnerNote');
    return care && note && care.hidden && /You are visiting/.test(note.textContent);
  });
  const dismiss = async () => {
    await page.waitForSelector('#paperPop:not([hidden]), #reportPop:not([hidden])', { timeout: 4000 }).catch(() => {});
    for (const id of ['paperClose', 'reportClose', 'tipOk']) {
      const el = page.locator(`#${id}`);
      if (await el.isVisible().catch(() => false)) await el.click();
    }
  };

  await page.goto(`${origin}/#t=${encodeURIComponent(first)}`);
  await saved();
  await dismiss();
  const name = (await page.textContent('#me')).trim();
  assert.ok(name && name !== '...', 'the saved trainer has a name');
  const before = savedRows();
  assert.equal(before.trainers.length, 1);
  assert.equal(before.trainers[0].name, name);
  assert.ok(before.checklings.length >= 1, 'the bus ticket wrote a Checkling');
  console.log('  ok a bus ticket arrives as a saved trainer');

  await page.reload();
  await saved();
  await dismiss();
  assert.equal((await page.textContent('#me')).trim(), name, 'a reload before Leave keeps the same trainer');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('checkaverse-ticket')), first);
  console.log('  ok a reload before Leave resumes the same trainer');

  await page.click('#menuBtn');
  await page.waitForSelector('#leaveBtn:not([hidden])');
  page.once('dialog', (dialog) => dialog.accept());
  await page.click('#leaveBtn');
  await visiting();
  assert.equal(await page.evaluate(() => sessionStorage.getItem('checkaverse-ticket')), null);
  assert.match(await page.textContent('#partnerNote'), /nothing here is saved/);
  console.log('  ok Leave drops the ticket and shows a visitor');

  await page.reload();
  await visiting();
  assert.equal(await page.evaluate(() => sessionStorage.getItem('checkaverse-ticket')), null, 'a reload after Leave stays a visitor');
  assert.deepEqual(savedRows(), before, 'a visitor cannot write a save');
  console.log('  ok a reload after Leave stays a visitor and writes nothing');

  await page.evaluate((t) => { location.hash = `t=${t}`; }, second);
  await saved();
  await dismiss();
  const nextName = (await page.textContent('#me')).trim();
  const after = savedRows();
  assert.equal(after.trainers.length, 2);
  assert.equal(after.trainers.find((t) => t.pid === 'LeaveTrainerB000000002').name, nextName);
  assert.deepEqual(after.checklings.filter((c) => c.pid === 'LeaveTrainerA000000001'), before.checklings, 'the first trainer is unchanged');
  assert.ok(after.checklings.some((c) => c.pid === 'LeaveTrainerB000000002'), 'the second ticket in the same tab saves its own Checkling');
  console.log('  ok a second ticket in the same tab rides as that trainer');

  const teacher = await (await browser.newContext()).newPage();
  await teacher.goto(`${origin}/teacher`);
  const help = await teacher.locator('#removeHelp').textContent();
  assert.match(help, /Removing a trainer disconnects them\./);
  assert.match(help, /A saved trainer keeps their name and their Checklings/);
  assert.doesNotMatch(help, /new name/);
  console.log('  ok the teacher page says Remove keeps a saved trainer');

  assert.deepEqual(errors, []);
  console.log('PASS leave and teacher copy');
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
