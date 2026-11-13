// Run from the repository checkout with Playwright Chromium installed.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const probe = createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const { port } = probe.address();
await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const data = await mkdtemp(path.join(os.tmpdir(), 'checkaverse-battle-art-'));
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: here,
  env: { ...process.env, CHECKAVERSE_DATA: data, CHECKAVERSE_PORT: String(port), CHECKAVERSE_ORIGINS: origin },
  stdio: 'ignore',
});
const stopped = new Promise(resolve => server.once('exit', resolve));
let browser;
try {
  for (let attempt = 0; ; attempt++) {
    if (await fetch(`${origin}/health`).then(r => r.ok, () => false)) break;
    assert.ok(attempt < 100 && server.exitCode === null, 'local server started');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true });
  async function visitor(species) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    await page.addInitScript(species => {
      localStorage.setItem('checkaverse-partner', species);
      sessionStorage.setItem('checkaverse-tips', JSON.stringify(['walk', 'partner', 'say', 'visitor', 'sign', 'challenge', 'battle']));
    }, species);
    await page.goto(`${origin}/?debug`);
    await page.waitForFunction(() => window.__checkaverse?.players.size > 0);
    await pose(page, '#partnerImg', `front-${species}.png`);
    return page;
  }
  async function walk(page, x, y) {
    await page.evaluate(([x, y]) => window.__checkaverse.walk(x, y), [x, y]);
    await page.waitForFunction(([x, y]) => {
      const debug = window.__checkaverse;
      const player = debug.players.get(debug.me());
      return player?.dx === x && player.dy === y && !player.seg;
    }, [x, y]);
  }
  async function pose(page, selector, file) {
    await page.waitForFunction(([selector, file]) => {
      const image = document.querySelector(selector);
      return image?.complete && image.naturalWidth > 0 && new URL(image.src).pathname === `/art/${file}`;
    }, [selector, file], { timeout: 8000 }).catch(async error => {
      const observed = await page.locator(selector).evaluate(image => ({ src: image.src, width: image.naturalWidth }));
      throw new Error(`Expected ${file} in ${selector}; observed ${JSON.stringify(observed)}`, { cause: error });
    });
  }
  for (const opponent of ['bolt', 'ember', 'zee']) {
    const player = await visitor('mochi');
    const other = await visitor(opponent);
    const errors = [];
    for (const page of [player, other]) page.on('pageerror', error => errors.push(error.message));
    await walk(player, 12, 10);
    await walk(other, 12, 11);
    await player.locator('#challenge').waitFor({ state: 'visible' });
    await player.keyboard.press('c');
    await other.locator('#askYes').waitFor({ state: 'visible' });
    // The dialog ignores input for 400 ms so a sign tap cannot accept a battle.
    await new Promise(resolve => setTimeout(resolve, 450));
    await other.locator('#askYes').click();
    const updated = opponent !== 'zee';
    await pose(player, '#bMeMon', 'back-mochi-v2-idle.png');
    await pose(player, '#bFoeMon', updated ? `front-${opponent}-v2-idle.png` : 'front-zee.png');
    await pose(other, '#bFoeMon', 'front-mochi-v2-idle.png');
    await pose(other, '#bMeMon', updated ? `back-${opponent}-v2-idle.png` : 'back-zee.png');
    if (opponent === 'bolt') {
      if (process.env.CHECKAVERSE_BATTLE_SCREENSHOT) await player.screenshot({ path: process.env.CHECKAVERSE_BATTLE_SCREENSHOT });
      await player.route('**/art/back-mochi-v2.png', route => route.fulfill({ status: 404 }));
      await other.route('**/art/front-mochi-v2-idle.png', route => route.fulfill({ status: 404 }));
      await player.emulateMedia({ reducedMotion: 'reduce' });
      await pose(player, '#bMeMon', 'back-mochi.png');
      await pose(player, '#bFoeMon', 'front-bolt-v2.png');
      await other.emulateMedia({ reducedMotion: 'reduce' });
      await pose(other, '#bFoeMon', 'front-mochi-v2.png');
      await other.emulateMedia({ reducedMotion: 'no-preference' });
      await pose(other, '#bFoeMon', 'front-mochi-v2.png');
      await player.locator('#bMoves button').first().click();
      await other.locator('#bMoves button').first().click();
      await player.waitForFunction(() => {
        const battle = window.__checkaverse.battle();
        return battle?.view.turn >= 1 && !battle.playing;
      });
    }
    assert.deepEqual(errors, []);
    await player.context().close();
    await other.context().close();
    console.log(`PASS battle artwork and moves with ${opponent}`);
  }
} finally {
  await browser?.close();
  server.kill();
  await stopped;
  await rm(data, { recursive: true, force: true });
}
