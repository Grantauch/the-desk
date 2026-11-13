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
const data = await mkdtemp(path.join(os.tmpdir(), 'checkaverse-landmarks-'));
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: here,
  env: { ...process.env, CHECKAVERSE_DATA: data, CHECKAVERSE_PORT: String(port), CHECKAVERSE_ORIGINS: origin },
  stdio: 'ignore',
});
const stopped = new Promise(resolve => server.once('exit', resolve));
const names = ['arena', 'market-stall', 'prop-bus', 'prop-notice-board'];
let browser;
try {
  for (let attempt = 0; ; attempt++) {
    if (await fetch(`${origin}/health`).then(r => r.ok, () => false)) break;
    assert.ok(attempt < 100 && server.exitCode === null, 'local server started');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true });
  for (const mode of ['new art', 'original art', 'shapes']) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    const errors = [];
    const responses = new Map();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => responses.set(new URL(response.url()).pathname, response.status()));
    await page.addInitScript(() => {
      sessionStorage.setItem('checkaverse-tips', JSON.stringify(['walk', 'partner', 'say', 'visitor', 'sign']));
      window.drawnArt = new Set();
      const drawImage = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (image, ...args) {
        if (this.canvas.id === 'town' && image instanceof HTMLImageElement) {
          window.drawnArt.add(new URL(image.src).pathname);
        }
        return drawImage.call(this, image, ...args);
      };
    });
    if (mode !== 'new art') {
      await page.route('**/art/*.png', route => {
        const file = new URL(route.request().url()).pathname.split('/').at(-1);
        if (names.some(name => file === `${name}-v2.png` || (mode === 'shapes' && file === `${name}.png`))) {
          return route.fulfill({ status: 404 });
        }
        return route.continue();
      });
    }
    await page.goto(`${origin}/?debug`);
    await page.waitForFunction(() => window.__checkaverse?.players.size > 0);
    await page.evaluate(() => window.__checkaverse.walk(12, 8));
    await page.waitForFunction(() => {
      const debug = window.__checkaverse;
      const player = debug.players.get(debug.me());
      return player?.dx === 12 && player.dy === 8 && !player.seg;
    });
    for (const name of names) {
      assert.equal(responses.get(`/art/${name}-v2.png`), mode === 'new art' ? 200 : 404);
      if (mode !== 'new art') assert.equal(responses.get(`/art/${name}.png`), mode === 'original art' ? 200 : 404);
    }
    if (mode !== 'shapes') {
      const suffix = mode === 'new art' ? '-v2.png' : '.png';
      await page.waitForFunction(files => files.every(file => window.drawnArt.has(file)), names.map(name => `/art/${name}${suffix}`));
    }
    assert.deepEqual(errors, []);
    if (mode === 'new art' && process.env.CHECKAVERSE_LANDMARK_SCREENSHOT) {
      await page.screenshot({ path: process.env.CHECKAVERSE_LANDMARK_SCREENSHOT });
    }
    await context.close();
    console.log(`PASS plaza movement and ${mode}`);
  }
} finally {
  await browser?.close();
  server.kill();
  await stopped;
  await rm(data, { recursive: true, force: true });
}
