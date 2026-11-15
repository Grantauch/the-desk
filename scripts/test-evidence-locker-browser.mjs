import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

// Production mode exercises only this browser-local activity, without accounts.
const html = await readFile('public/hubs/evidence_locker.html');
const server = process.env.EVIDENCE_LOCKER_ORIGIN ? null : createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html);
});
if (server) await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const origin = process.env.EVIDENCE_LOCKER_ORIGIN || `http://127.0.0.1:${server.address().port}`;
const output = resolve('browser-results/evidence-locker');
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [], external = [];
    page.on('pageerror', e => errors.push(e.message));
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === new URL(origin).origin) return route.continue();
      external.push(route.request().url()); return route.abort();
    });
    async function tabTo(selector) {
      for (let i = 0; i < 100; i++) {
        if (await page.locator(selector).evaluate(el => el === document.activeElement)) return;
        await page.keyboard.press('Tab');
      }
      assert.fail(`Tab could not reach ${selector}`);
    }
    async function audit() {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => v.id), []);
    }
    try {
      assert.equal((await page.goto(origin + '/hubs/evidence_locker.html')).status(), 200);
      assert.equal(await page.locator('#locker .select-card').count(), 8);
      assert.equal(await page.locator('#locker a').count(), 4);
      for (const link of await page.locator('#locker a').all()) {
        assert.match(await link.getAttribute('href'), /^https:\/\/(www\.)?(intelligence\.senate\.gov|senate\.gov|fbi\.gov)\//);
      }
      await audit();
      await tabTo('#card0'); await page.keyboard.press('Enter');
      assert.equal(await page.locator('#card0').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'card0');
      await page.keyboard.press('Space');
      assert.equal(await page.locator('#assignA').isDisabled(), true, 'Selection can be cleared');
      await page.keyboard.press('Enter'); await tabTo('#assignB'); await page.keyboard.press('Space');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'card1');
      await tabTo('#filedB button'); await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'card0');
      assert.equal(await page.locator('#filedB article').count(), 0, 'Wrong filing can be revised');
      for (let id = 0; id < 8; id++) {
        await tabTo('#card' + id); await page.keyboard.press(id % 2 ? 'Space' : 'Enter');
        await tabTo(id < 4 ? '#assignA' : '#assignB'); await page.keyboard.press('Enter');
        assert.match(await page.locator('#status').innerText(), new RegExp(`${id + 1} of 8`));
        assert.equal(await page.locator('#fileBtn').isDisabled(), id < 7);
      }
      assert.equal(await page.evaluate(() => document.activeElement.id), 'fileBtn');
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'reportTitle');
      assert.match(await page.locator('#verdictText').innerText(), /8 of 8/);
      assert.match(await page.locator('#report').innerText(), /not a probability meter/);
      await audit();
      await page.screenshot({ path: resolve(output, `report-${width}.png`), fullPage: true });
      await tabTo('#resetBtn'); await page.keyboard.press('Enter');
      assert.equal(await page.locator('#report').isVisible(), false);
      assert.equal(await page.locator('#locker .select-card').count(), 8);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'card0');

      // A deliberately inverted filing yields accurate feedback, then reset works.
      for (let id = 0; id < 8; id++) {
        await tabTo('#card' + id); await page.keyboard.press('Enter');
        await tabTo(id < 4 ? '#assignB' : '#assignA'); await page.keyboard.press('Enter');
      }
      await page.keyboard.press('Enter');
      assert.match(await page.locator('#verdictText').innerText(), /0 of 8/);
      await page.reload();
      assert.equal(await page.locator('#locker .select-card').count(), 8, 'A new visit starts blank');
      assert.deepEqual(errors, []); assert.deepEqual(external, [], 'Activity sends no external requests');
      console.log(`PASS Evidence Locker keyboard, correction, both reports, reset, WCAG and fit at ${width}px (${origin})`);
    } finally { await context.close(); }
  }
} finally {
  await browser.close(); if (server) await new Promise(ok => server.close(ok));
}
