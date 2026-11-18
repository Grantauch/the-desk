import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { handler } from '../netlify/functions/curiosity.mjs';
import archive from '../src/data/curiosity-archive.json' with { type: 'json' };

const remote = process.env.CURIOSITY_ORIGIN?.replace(/\/$/, '');
const output = resolve(process.env.CURIOSITY_RESULTS || 'browser-results/curiosity');
await mkdir(output, { recursive: true });
const originalFetch = globalThis.fetch;
let upstream = 'offline';
const fixture = { results: [{ title: 'Catalog fixture artifact', url: 'https://www.loc.gov/item/fixture/',
  image_url: ['https://tile.loc.gov/fixture.jpg'], description: ['Catalog fixture context.'] }] };
let server;
let origin = remote;
if (!remote) {
  globalThis.fetch = async () => {
    if (upstream === 'offline') throw new Error('Synthetic catalog outage');
    return { ok: true, json: async () => fixture };
  };
  const root = resolve('dist');
  server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/.netlify/functions/curiosity') {
        const result = await handler({ queryStringParameters: Object.fromEntries(url.searchParams) });
        res.writeHead(result.statusCode, result.headers).end(result.body);
        return;
      }
      let path = resolve(root, `.${decodeURIComponent(url.pathname)}`);
      if (!path.startsWith(`${root}\\`) && !path.startsWith(`${root}/`)) throw new Error('Invalid path');
      if (!extname(path)) path = resolve(path, 'index.html');
      const type = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.svg': 'image/svg+xml' }[extname(path)] || 'application/octet-stream';
      const bytes = await readFile(path);
      res.writeHead(200, { 'Content-Type': type }).end(bytes);
    } catch { res.writeHead(404).end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
}
const results = [];
const browser = await chromium.launch();
try {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let directRequests = 0;
    if (!remote) await page.route('https://www.loc.gov/photos/**', route => {
      directRequests++;
      return route.fulfill({ status: 503, body: 'Synthetic catalog outage' });
    });
    await page.goto(`${origin}/curiosity-desk/`, { waitUntil: 'domcontentloaded' });
    const desk = page.locator('[data-curiosity-desk]');
    const status = desk.locator('[data-curiosity-live-status]');
    await status.filter({ hasText: /live catalog (unavailable|records available)/ }).waitFor({ timeout: 30_000 });
    for (const [collection, record] of Object.entries(archive)) {
      await desk.locator(`[data-filter="${collection}"]`).click();
      await status.filter({ hasText: /live catalog (unavailable|records available)/ }).waitFor({ timeout: 30_000 });
      assert.equal(await desk.locator(`[data-filter="${collection}"]`).getAttribute('aria-pressed'), 'true');
      const mode = (await desk.locator('[data-field="mode"]').textContent()).trim();
      assert.ok(['selected archive record', 'live catalog record'].includes(mode), `explicit record mode: ${mode}`);
      if (mode === 'selected archive record') {
        assert.equal(await desk.locator('[data-field="question"]').innerText(), record.question);
        assert.equal(await desk.locator('[data-link="record"]').last().getAttribute('href'), record.record);
        await page.waitForFunction(() => {
          const img = document.querySelector('[data-curiosity-desk] [data-field="image"]');
          return img.complete && img.naturalWidth > 0;
        });
        assert.equal(await desk.locator('[data-action="next"]').isDisabled(), true);
      }
      await desk.locator('[data-action="reveal"]').focus();
      await page.keyboard.press('Enter');
      assert.equal(await desk.locator('[data-action="reveal"]').getAttribute('aria-expanded'), 'true');
      assert.ok(await desk.locator('[data-field="context-panel"]').isVisible());
      if (mode === 'selected archive record') assert.equal(await desk.locator('[data-field="context"]').innerText(), record.context);
      await page.keyboard.press('Enter');
      assert.equal(await desk.locator('[data-field="context-panel"]').isVisible(), false);
    }
    assert.equal(directRequests, 0, 'explicit server archive response avoids repeating the failed catalog request');
    await desk.locator('[data-filter="all"]').click();
    const previousArtifact = await desk.locator('[data-field="question"]').innerText();
    await desk.locator('[data-action="next"]').click();
    assert.notEqual(await desk.locator('[data-field="question"]').innerText(), previousArtifact);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'page fits viewport');
    const accessibility = await new AxeBuilder({ page }).include('[data-curiosity-desk]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    assert.deepEqual(accessibility.violations.map(v => ({ id: v.id, nodes: v.nodes.length })), []);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: resolve(output, `curiosity-${width}.png`), fullPage: true });
    results.push({ width, collections: 5, revealKeyboard: true, fit: true, axe: true, directRequests });
    await context.close();
  }
  if (!remote) {
    upstream = 'live';
    const page = await browser.newPage();
    await page.route('https://tile.loc.gov/fixture.jpg', async route => route.fulfill({ contentType: 'image/webp', body: await readFile('public/images/curiosity/detroit.webp') }));
    await page.goto(`${origin}/curiosity-desk/`);
    await page.locator('[data-field="mode"]').filter({ hasText: 'live catalog record' }).waitFor();
    assert.equal(await page.locator('[data-field="image"]').getAttribute('alt'), 'Catalog fixture artifact');
    assert.equal(await page.locator('[data-action="next"]').isEnabled(), true);
    await page.locator('[data-action="next"]').click();
    assert.equal((await page.locator('[data-field="mode"]').textContent()).trim(), 'selected archive record');
    await page.close();

    const direct = await browser.newPage();
    await direct.route('**/.netlify/functions/curiosity?**', route => route.fulfill({ status: 404 }));
    await direct.route('https://www.loc.gov/photos/**', route => route.fulfill({ json: fixture }));
    await direct.route('https://tile.loc.gov/fixture.jpg', async route => route.fulfill({ contentType: 'image/webp', body: await readFile('public/images/curiosity/detroit.webp') }));
    await direct.goto(`${origin}/curiosity-desk/`);
    await direct.locator('[data-field="mode"]').filter({ hasText: 'live catalog record' }).waitFor();
    await direct.close();
    results.push({ livePreference: true, archiveCycling: true, localDirectFallback: true });
  }
  const nojs = await browser.newPage({ javaScriptEnabled: false });
  await nojs.goto(`${origin}/curiosity-desk/`);
  assert.equal(await nojs.locator('[data-link="record"]').last().getAttribute('href'), archive.power.record);
  assert.equal(await nojs.locator('[data-field="image"]').evaluate(img => img.complete && img.naturalWidth > 0), true);
  await nojs.close();
  await writeFile(resolve(output, 'result.json'), JSON.stringify({ origin, results, noJsSource: true }, null, 2));
  console.log(`PASS Curiosity Chromium: ${JSON.stringify(results)}; no-JS primary source`);
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  globalThis.fetch = originalFetch;
}
