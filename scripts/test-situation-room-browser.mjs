import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const path = '/hubs/situation-room.html';
const html = await readFile('public' + path);
const server = process.env.SITUATION_ROOM_ORIGIN ? null : createServer((request, response) => {
  if (request.url !== path) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
});
if (server) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = process.env.SITUATION_ROOM_ORIGIN || 'http://127.0.0.1:' + server.address().port;
let browser;
try {
  browser = await chromium.launch();
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    const external = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = route.request().url();
      if (new URL(url).origin === origin) return route.continue();
      external.push(url);
      return route.abort();
    });

    async function expectFocus(selector) {
      assert.equal(await page.locator(selector).evaluate(el => document.activeElement === el), true, selector);
    }
    async function tabTo(selector) {
      const target = page.locator(selector);
      for (let i = 0; i < 20; i++) {
        if (await target.evaluate(el => document.activeElement === el)) return;
        await page.keyboard.press('Tab');
      }
      assert.fail('Could not reach ' + selector + ' from the keyboard');
    }
    async function audit() {
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      assert.deepEqual(result.violations.map(violation => violation.id), []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }

    assert.equal((await page.goto(origin + path)).status(), 200);
    await audit();
    const explanations = new Set();
    const timeline = page.locator('details');
    assert.equal(await timeline.count(), 6);
    for (let option = 1; option <= 3; option++) {
      for (let round = 0; round < 6; round++) {
        assert.equal(await page.locator('#progress').innerText(), 'Decision ' + (round + 1) + ' of 6');
        const choice = '#choices button:nth-child(' + option + ')';
        await tabTo(choice);
        await page.keyboard.press(round % 2 ? 'Space' : 'Enter');
        await expectFocus('#feedback-title');
        assert.equal(await page.locator(choice).getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('#choices button:disabled').count(), 3);
        explanations.add(await page.locator('#tradeoff').innerText());
        assert.equal(
          await page.locator('#record .history').innerText(),
          'Historical record · ' + await timeline.nth(round).locator('.history').textContent(),
        );
        const recordLinks = await page.locator('#record a').evaluateAll(links => links.map(link => link.href));
        assert.deepEqual(recordLinks, await timeline.nth(round).locator('a').evaluateAll(links => links.map(link => link.href)));
        if (option === 1 && round === 4) await audit();
        await tabTo('#advance');
        await page.keyboard.press('Enter');
        await expectFocus(round === 5 ? '#debrief-title' : '#decision');
        assert.equal(await page.locator('#feedback').isVisible(), false);
      }
      if (option === 1) await audit();
      await tabTo('#restart');
      await page.keyboard.press('Enter');
      await expectFocus('#decision');
      assert.equal(await page.locator('#debrief').isVisible(), false);
    }
    assert.equal(explanations.size, 18);
    await page.reload();
    assert.equal(await page.locator('#progress').innerText(), 'Decision 1 of 6');
    assert.deepEqual(await page.evaluate(() => [localStorage.length, sessionStorage.length]), [0, 0]);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log('PASS Situation Room at ' + width + 'px: 18 keyboard choices, sourced feedback, restart, WCAG A/AA and viewport fit');
    await context.close();
  }

  const fallback = await browser.newPage({ javaScriptEnabled: false });
  assert.equal((await fallback.goto(origin + path)).status(), 200);
  assert.equal(await fallback.locator('#activity').isVisible(), false);
  for (const summary of await fallback.locator('details summary').all()) await summary.click();
  assert.equal(await fallback.locator('details[open]').count(), 6);
  assert.equal(await fallback.locator('details a:visible').count(), 8);
  console.log('PASS Situation Room without JavaScript: all six historical notes and eight source links');
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
