import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

// The production option only plays this browser-local simulation. No identity,
// classroom API, saved student work or external service is used.
const html = await readFile('public/hubs/market_shock_arena.html');
const server = process.env.MARKET_SHOCK_ORIGIN ? null : createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});
if (server) await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const origin = process.env.MARKET_SHOCK_ORIGIN || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const output = resolve('browser-results/market-shock');
await mkdir(output, { recursive: true });
try {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { Math.random = () => 0.5; });
    try {
      const response = await page.goto(origin + '/hubs/market_shock_arena.html');
      assert.equal(response.status(), 200);
      await page.locator('summary').click();
      assert.match(await page.locator('details').innerText(), /invented prices and rules/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => v.id), []);
      const stocks = [25, 25, 15, 15, 15, 25, 15, 40];
      for (let i = 0; i < 8; i++) {
        const cost = i === 2 ? 6 : 4;
        assert.equal(await page.locator('#rnd').innerText(), `${i + 1}/8`);
        assert.equal(await page.locator('#inventoryLabel').innerText(), `INVENTORY (COST $${cost}/MEAL)`);
        for (const stock of [15, 25, 40]) assert.equal(await page.locator(`[data-g=stock][data-v="${stock}"]`).innerText(), `Prep ${stock} meals — $${stock * cost}`);
        await page.locator('[data-g=price][data-v="9"]').focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('[data-g=price][data-v="9"]').getAttribute('aria-pressed'), 'true');
        await page.locator(`[data-g=stock][data-v="${stocks[i]}"]`).click();
        const beforeCash = Number((await page.locator('#cash').innerText()).slice(1));
        await page.locator('#openBtn').click();
        assert.equal(await page.locator('#rnd').innerText(), `${i + 1}/8`, 'Round news stays with its result');
        assert.match(await page.locator('#result').innerText(), new RegExp(`\\$${stocks[i] * cost} costs`));
        assert.equal(await page.evaluate(() => document.activeElement.id), 'result');
        const profit = Number((await page.locator('#last').innerText()).replace('−', '-').replace('$', ''));
        assert.equal(await page.locator('#cash').innerText(), '$' + (beforeCash + profit), 'Cash updates alongside the current result');
        if (i === 3) assert.match(await page.locator('#result').innerText(), /^9 customers/, '$9 receives the $7 rival penalty with the current two-star reputation');
        if (i === 2) await page.screenshot({ path: resolve(output, `shortage-${width}.png`), fullPage: true });
        const cash = await page.locator('#cash').innerText();
        await page.evaluate(() => openShop());
        assert.equal(await page.locator('#cash').innerText(), cash, 'Repeated activation cannot resolve a round twice');
        await page.locator('#nextBtn').click();
      }
      assert.match(await page.locator('#endText').innerText(), /Final cash:/);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'endTitle');

      // An unaffordable quote does not spend cash or advance the round.
      await page.reload();
      await page.locator('[data-g=price][data-v="9"]').click();
      await page.locator('[data-g=stock][data-v="40"]').click();
      await page.locator('#openBtn').click();
      assert.match(await page.locator('#result').innerText(), /costs \$160, but you have \$100/);
      assert.equal(await page.locator('#cash').innerText(), '$100');
      assert.equal(await page.locator('#rnd').innerText(), '1/8');
      assert.equal(await page.locator('#nextBtn').isVisible(), false);

      // Undercutting the $7 rival avoids its extra price penalty.
      await page.evaluate(() => { round = 3; cash = 1000; rep = 3; paint(); });
      await page.locator('[data-g=price][data-v="6"]').click();
      await page.locator('[data-g=stock][data-v="15"]').click();
      await page.locator('#openBtn').click();
      assert.match(await page.locator('#result').innerText(), /^24 customers/);

      // Positive cash below the next minimum prep must yield a usable ending.
      // The normal round progression never offers borrowing; use a bounded
      // synthetic balance to exercise the exit rather than waiting for luck.
      await page.evaluate(() => { cash = 30; });
      await page.locator('#nextBtn').click();
      assert.match(await page.locator('#endText').innerText(), /cannot afford the next round/);
      assert.deepEqual(errors, []);
      console.log(`PASS Market Shock eight rounds, quotes, rival, keyboard, WCAG, cash-flow ending at ${width}px (${origin})`);
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  if (server) await new Promise(ok => server.close(ok));
}
