// Run from the repository checkout with Playwright Chromium installed.
// Kettle Creek is every saved trainer's private town, so the test signs a ticket with the
// server's own key, the same way kettle.test.mjs does, and loads the real map.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { signTicket } from './accounts.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const probe = createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const { port } = probe.address();
await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const data = await mkdtemp(path.join(os.tmpdir(), 'checkaverse-housing-art-'));
const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.mjs'], {
  cwd: here,
  env: { ...process.env, CHECKAVERSE_DATA: data, CHECKAVERSE_PORT: String(port), CHECKAVERSE_ORIGINS: origin },
  stdio: 'ignore',
});
const stopped = new Promise(resolve => server.once('exit', resolve));
// Drawn in Kettle Creek: the cottage and all four buildings. The other two houses only
// appear on claimed Neighborhood plots, so their files are checked for delivery and fallback.
const drawn = ['house-cottage', 'kc-store', 'kc-apothecary', 'kc-clinic', 'kc-daycare'];
const names = [...drawn, 'house-stump', 'house-creek'];
let browser;
try {
  for (let attempt = 0; ; attempt++) {
    if (await fetch(`${origin}/health`).then(r => r.ok, () => false)) break;
    assert.ok(attempt < 100 && server.exitCode === null, 'local server started');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const key = (await readFile(path.join(data, 'ticket-key.txt'), 'utf8')).trim();
  browser = await chromium.launch({ headless: true });
  for (const mode of ['new art', 'original art', 'shapes']) {
    const now = Date.now();
    const ticket = signTicket(key, { v: 1, p: 'Kk7xK2mN9vR4tY8wZ3aB1c', h: '2nd Hour', d: '2026-11-02', c: true, n: 12, s: 4, b: 9,
      k: { s: 'mochi', n: '' }, iat: now, exp: now + 7_200_000, j: 'k' });
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    const errors = [];
    const responses = new Map();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => responses.set(new URL(response.url()).pathname, response.status()));
    await page.addInitScript(() => {
      sessionStorage.setItem('checkaverse-tips', JSON.stringify(['walk', 'partner', 'say', 'visitor', 'sign', 'kettle']));
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
    await page.goto(`${origin}/?debug#t=${ticket}`);
    await page.waitForFunction(() => window.__checkaverse?.players.size > 0);
    await page.waitForFunction(() => document.getElementById('placeTitle')?.textContent === 'Kettle Creek');
    for (const name of names) {
      assert.equal(responses.get(`/art/${name}-v2.png`), mode === 'new art' ? 200 : 404);
      if (mode !== 'new art') assert.equal(responses.get(`/art/${name}.png`), mode === 'original art' ? 200 : 404);
    }
    if (mode !== 'shapes') {
      const suffix = mode === 'new art' ? '-v2.png' : '.png';
      await page.waitForFunction(files => files.every(file => window.drawnArt.has(file)), drawn.map(name => `/art/${name}${suffix}`));
    } else {
      await page.waitForTimeout(500);
      assert.deepEqual(await page.evaluate(names => [...window.drawnArt].filter(file => names.some(name => file.startsWith(`/art/${name}`))), drawn), []);
    }
    assert.deepEqual(errors, []);
    if (mode === 'new art' && process.env.CHECKAVERSE_HOUSING_SCREENSHOT) {
      await page.screenshot({ path: process.env.CHECKAVERSE_HOUSING_SCREENSHOT });
    }
    await context.close();
    console.log(`PASS Kettle Creek buildings and houses: ${mode}`);
  }
} finally {
  await browser?.close();
  server.kill();
  await stopped;
  await rm(data, { recursive: true, force: true });
}
