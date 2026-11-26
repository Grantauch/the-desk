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
let browser, childB, dataB, failed = false;

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

  async function idlePage(pid, nick, manualClock = false) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await context.addInitScript((tips) => {
      window.__checkaverseIdleTest = { idleMs: 800 };
      sessionStorage.setItem('checkaverse-tips', JSON.stringify(tips));
    }, TIPS);
    const idle = await context.newPage();
    idle.on('pageerror', (e) => errors.push(e.message));
    if (manualClock) {
      const boot = Date.now();
      await idle.clock.setFixedTime(boot);
    }
    await idle.goto(`${origin}/#t=${encodeURIComponent(ticket(key, pid, nick))}`);
    return idle;
  }
  const isSaved = (idle) => idle.waitForFunction(() => {
    const care = document.getElementById('careBtn');
    const note = document.getElementById('partnerNote');
    return care && note && !care.hidden && /travel with you/.test(note.textContent);
  });
  const isVisiting = (idle) => idle.waitForFunction(() => {
    const care = document.getElementById('careBtn');
    const note = document.getElementById('partnerNote');
    return care && note && care.hidden && /You are visiting/.test(note.textContent);
  }, null, { timeout: 4000 });

  const quiet = await idlePage('LeaveIdleQuiet00000001', 'Pip');
  await isSaved(quiet);
  await isVisiting(quiet);
  assert.equal(await quiet.evaluate(() => sessionStorage.getItem('checkaverse-ticket')), null);
  console.log('  ok 20 quiet minutes, on the test clock, leaves the Chromebook');

  const menuPage = await idlePage('LeaveIdleMenu000000001', 'Moss', true);
  await menuPage.locator('#careBtn:not([hidden])').waitFor();
  // The server sends the daily paper on its own 2.5-second clock. Clear it before testing the menu.
  await menuPage.locator('#paperPop:not([hidden])').waitFor();
  await menuPage.locator('#paperClose').press('Enter');
  await menuPage.locator('#paperPop').waitFor({ state: 'hidden' });
  await menuPage.locator('#menuBtn').click();
  await menuPage.locator('#menu:not([hidden])').waitFor();
  await menuPage.clock.setFixedTime((await menuPage.evaluate(() => Date.now())) + 1200);
  await delay(200); // Allow multiple native 50 ms idle checks, with the test date more than 800 ms ahead.
  assert.equal(await menuPage.locator('#menu').isHidden(), false);
  assert.equal(await menuPage.locator('#careBtn').isHidden(), false, 'an open menu keeps the ride');
  await menuPage.locator('#town').click();
  await menuPage.clock.setFixedTime((await menuPage.evaluate(() => Date.now())) + 1200);
  await isVisiting(menuPage);
  console.log('  ok closing the menu lets the quiet time run out');

  const portB = port + 7;
  const originB = `http://127.0.0.1:${portB}`;
  dataB = fs.mkdtempSync(path.join(os.tmpdir(), 'checkaverse-idle-battle-'));
  childB = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(HERE, 'server.mjs')], { cwd: HERE,
    env: { ...process.env, CHECKAVERSE_PORT: String(portB), CHECKAVERSE_DATA: dataB, CHECKAVERSE_ORIGINS: originB, CHECKAVERSE_WILD_RATE: '0', CHECKAVERSE_WEATHER: 'off', CHECKAVERSE_TURN_MS: '20000', CHECKAVERSE_KETTLE: path.join(dataB, 'no-kettle.json'), CHECKAVERSE_TEST_SPAWN: '14,13;15,13' }, stdio: 'pipe' });
  childB.stdout.on('data', (d) => { log += d; });
  childB.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${originB}/health`)).ok) break; } catch { /* starting */ } await delay(100); }
  const keyB = fs.readFileSync(path.join(dataB, 'ticket-key.txt'), 'utf8').trim();
  async function battlePage(pid, nick) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await context.addInitScript((tips) => {
      window.__checkaverseIdleTest = { idleMs: 800 };
      sessionStorage.setItem('checkaverse-tips', JSON.stringify(tips));
    }, TIPS);
    const p = await context.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.clock.setFixedTime(Date.now());
    await p.goto(`${originB}/?debug#t=${encodeURIComponent(ticket(keyB, pid, nick))}`);
    return p;
  }
  const fighter = await battlePage('LeaveIdleBattleA00001', 'Pip');
  const foe = await battlePage('LeaveIdleBattleB00001', 'Moss');
  await isSaved(fighter);
  await isSaved(foe);
  await Promise.all([fighter, foe].map(async (p) => {
    await p.locator('#paperPop:not([hidden])').waitFor();
    await p.locator('#paperClose').click();
    await p.locator('#paperPop').waitFor({ state: 'hidden' });
  }));
  await fighter.waitForFunction(() => {
    const api = window.__checkaverse;
    const me = api && api.players.get(api.me());
    if (!me) return false;
    return [...api.players.values()].some((p) => p.id !== api.me() && Math.abs(p.x - me.x) + Math.abs(p.y - me.y) <= 1);
  });
  await fighter.keyboard.press('c');
  await foe.waitForSelector('#ask:not([hidden])');
  await delay(500); // Honor the UI's 400 ms confirmation guard.
  await foe.click('#askYes');
  await fighter.waitForSelector('#battle:not([hidden])');
  await fighter.waitForSelector('#bMoves button');
  // Cross the shortened idle threshold during the real server turn, not before it.
  await fighter.clock.setFixedTime((await fighter.evaluate(() => Date.now())) + 1200);
  await delay(200); // Allow multiple native 50 ms idle checks.
  assert.equal(await fighter.locator('#careBtn').isHidden(), false, 'a battle still being picked does not sign out');
  assert.equal(await fighter.locator('#battle').isHidden(), false);
  assert.ok(await fighter.evaluate(() => sessionStorage.getItem('checkaverse-ticket')));
  console.log('  ok a battle that is still being picked does not sign out');

  const teacher = await (await browser.newContext()).newPage();
  await teacher.goto(`${origin}/teacher`);
  const help = await teacher.locator('#removeHelp').textContent();
  assert.match(help, /Removing a trainer disconnects them\./);
  assert.match(help, /A saved trainer keeps their name and their Checklings/);
  assert.doesNotMatch(help, /new name/);
  console.log('  ok the teacher page says Remove keeps a saved trainer');

  assert.deepEqual(errors, []);
  console.log('PASS leave, idle, and teacher copy');
} catch (err) {
  failed = true;
  console.error('FAIL', err.stack || err.message);
  console.error(log.split('\n').slice(-30).join('\n'));
  console.error(errors);
} finally {
  await browser?.close();
  child.kill();
  childB?.kill();
  await delay(300);
  fs.rmSync(data, { recursive: true, force: true });
  if (dataB) fs.rmSync(dataB, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}
