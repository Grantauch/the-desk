// The gym in a real browser: open it at the arena, play every kind of mini game the way a student would (reading
// the screen and pressing keys or tapping), earn points, and turn down a level up offer on the learn card.
// Runs only against a throwaway local server and an invented bus ticket.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { signTicket } from './accounts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.env.CHECKAVERSE_BROWSER_OUTPUT || path.join(HERE, '../../browser-results/checkaverse-gym'));
fs.mkdirSync(out, { recursive: true });
const port = 26000 + Math.floor(Math.random() * 1000), origin = `http://127.0.0.1:${port}`;
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'checkaverse-gym-browser-'));
// No Kettle Creek map, so the saved trainer arrives in town beside the arena.
const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(HERE, 'server.mjs')], { cwd: HERE,
  env: { ...process.env, CHECKAVERSE_PORT: String(port), CHECKAVERSE_DATA: data, CHECKAVERSE_ORIGINS: origin, CHECKAVERSE_KETTLE: path.join(data, 'no-kettle.json'),
    CHECKAVERSE_TEST_SPAWN: '9,7;9,7;9,7', CHECKAVERSE_WILD_RATE: '0.000001', CHECKAVERSE_SPARS: path.join(data, 'spars.json') }, stdio: 'pipe' });
const SP = JSON.parse(fs.readFileSync(path.join(HERE, 'content', 'npc-battles.json'), 'utf8'));
fs.writeFileSync(path.join(data, 'spars.json'), JSON.stringify({ ...SP, gapSeconds: [3000, 3000] }));
let log = ''; child.stdout.on('data', (d) => { log += d; }); child.stderr.on('data', (d) => { log += d; });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
let browser, failed = false;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${origin}/health`)).ok) break; } catch { /* starting */ } await delay(100); }
  const key = fs.readFileSync(path.join(data, 'ticket-key.txt'), 'utf8').trim();
  const ticket = (n) => { const now = Date.now(); return signTicket(key, { v: 1, p: 'syntheticGym00000000001', h: 'Synthetic test', d: '2026-11-02', c: true, n, s: 4, b: 9, k: { s: 'mochi', n: '' }, iat: now, exp: now + 7200000, j: `g${n}` }); };
  browser = await chromium.launch({ headless: true });
  const open = async (n) => {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    if (process.env.DEBUG_GYM) page.on('websocket', (ws) => { ws.on('framesent', (f) => { if (!/move|turn|resident_visibility/.test(f.payload)) console.log('>>', String(f.payload).slice(0, 120)); }); ws.on('framereceived', (f) => { if (/"t":"(gym|pos|notice|room)"/.test(f.payload)) console.log('<<', String(f.payload).slice(0, 140)); }); });
    await page.goto(`${origin}/#t=${encodeURIComponent(ticket(n))}`);
    await page.waitForFunction(() => /Town/.test(document.querySelector('#place')?.textContent || ''), null, { timeout: 8000 });
    return { page, context };
  };
  const first = await open(1); await first.context.close(); await delay(300);
  // Forty check-ins later the partner is well past level 10 and has moves on offer.
  const { page } = await open(41);
  await page.click('#tipOk').catch(() => {});
  await page.waitForSelector('#learnPop:not([hidden])', { timeout: 5000 });
  assert.match(await page.textContent('#learnTitle'), /wants to learn Vine lash/);
  await page.screenshot({ path: path.join(out, 'learn-offer.png') });
  while (await page.$('#learnPop:not([hidden])')) { await page.click('#learnSkip'); await delay(700); }
  console.log('  ok a level up offer appears on the learn card and can be turned down');

  // Step up next to the arena wall, face it and press Space.
  await page.keyboard.down('ArrowUp'); await delay(420); await page.keyboard.up('ArrowUp'); await delay(500);
  await page.keyboard.down('ArrowLeft'); await delay(250); await page.keyboard.up('ArrowLeft'); await delay(300);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Space');
  await page.waitForSelector('#gymPop:not([hidden])', { timeout: 5000 }).catch(async (e) => { await page.screenshot({ path: path.join(out, 'gym-miss.png') }); throw e; });
  await page.screenshot({ path: path.join(out, 'gym.png') });
  console.log('  ok facing the arena opens the gym');

  // Plays one round of the named move's game like a student would, and returns the score the town gave.
  async function playRound(moveName, shot) {
    const row = page.locator('.gym-move', { hasText: moveName });
    await row.locator('button', { hasText: 'Train' }).click();
    await page.waitForSelector('#gameOverlay:not([hidden])');
    await page.click('#gameGo');
    const game = await page.evaluate(() => (document.querySelector('.gm-track') ? 'timing' : document.querySelector('.gm-gauge') ? 'hold' : document.querySelector('.gm-arrow') ? 'rhythm' : 'aim'));
    const end = Date.now() + 40000;
    let shotTaken = false;
    while (Date.now() < end && !/points|too quick/.test(await page.textContent('#gameScore'))) {
      if (game === 'timing') {
        const inCore = await page.evaluate(() => { const m = document.querySelector('.gm-marker'), c = document.querySelector('.gm-zone.core'); if (!m || !c) return false; const a = parseFloat(m.style.left), l = parseFloat(c.style.left), w = parseFloat(c.style.width); return a >= l && a <= l + w; });
        if (inCore) { await page.keyboard.press('Space'); await delay(700); } else await delay(8);
      } else if (game === 'hold') {
        await page.keyboard.down('Space');
        for (let i = 0; i < 400; i++) {
          const ready = await page.evaluate(() => { const f = document.querySelector('.gm-gauge i'), b = document.querySelector('.gm-band'); if (!f || !b) return true; const lv = parseFloat(f.style.height), lo = parseFloat(b.style.bottom), h = parseFloat(b.style.height); return lv >= lo + h * 0.45; });
          if (ready) break;
          await delay(5);
        }
        await page.keyboard.up('Space'); await delay(800);
      } else if (game === 'rhythm') {
        const want = await page.evaluate(() => { const a = document.querySelector('.gm-arrow')?.textContent, r = document.querySelector('.gm-ring'); return a && r && parseFloat(r.style.width) <= 96 ? a : ''; });
        if (want) { await page.keyboard.press({ '▲': 'ArrowUp', '▶': 'ArrowRight', '▼': 'ArrowDown', '◀': 'ArrowLeft' }[want]); await delay(320); } else await delay(10);
      } else {
        const t = await page.$('.gm-target');
        if (t) await t.click({ force: true }).catch(() => {}); else await delay(30);
      }
      if (!shotTaken && Date.now() > end - 37000) { await page.screenshot({ path: path.join(out, `game-${shot}.png`) }); shotTaken = true; }
    }
    const text = await page.textContent('#gameScore');
    const score = Number(/Score (\d+)/.exec(text)?.[1]);
    await page.screenshot({ path: path.join(out, `game-${shot}-result.png`) });
    await page.click('#gameQuit');
    await page.waitForSelector('#gymPop:not([hidden])');
    return { game, score, text };
  }
  for (const [move, shot] of [['Vine lash', 'timing'], ['Deep breath', 'hold'], ['Petal storm', 'rhythm'], ['Quick jab', 'aim']]) {
    const r = await playRound(move, shot);
    assert.equal(r.game, shot);
    assert.ok(r.score >= 60, `${shot} played well scores well (${r.score})`);
    assert.match(r.text, /\+\d+ points/);
    console.log(`  ok ${shot}: a good round scores ${r.score} and earns points toward ${move}`);
  }
  const pts = await page.locator('.gym-move', { hasText: 'Quick jab' }).locator('.gm-pts').textContent();
  assert.match(pts, /^\d+ of 30 points/);
  await page.screenshot({ path: path.join(out, 'gym-after.png') });
  assert.deepEqual(errors, []);
  console.log('PASS gym browser');
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
