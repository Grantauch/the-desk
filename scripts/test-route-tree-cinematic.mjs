import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, resolve } from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const output = resolve('browser-results/route-tree');
await mkdir(output, { recursive: true });
const baseline = execFileSync('git', ['show', '5a580d1a5939eee6d6f0b78f4d41edcdad43cde5:public/hubs/bts-the-route-tree.html']);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.webp':'image/webp', '.woff2':'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://test').pathname;
    const file = resolve('public', '.' + path);
    assert.ok(file.startsWith(resolve('public') + '/'));
    const data = path === '/__baseline.html' ? baseline : await readFile(file);
    res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream'); res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const results = [];
try {
  for (const width of [320, 390, 1440]) {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion });
      await context.addInitScript(() => { window.__deskSaveTest = { gate: false, endpoint: '' }; });
      await context.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
      const page = await context.newPage();
      const errors = [], missing = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.url().startsWith(origin) && r.status() >= 400) missing.push(r.url()); });
      const name = `${width}-${reducedMotion}`;
      try {
        assert.equal((await page.goto(origin + '/hubs/bts-the-route-tree.html')).status(), 200);
        await page.locator('.cover h1').waitFor();
        await page.evaluate(async () => {
          await document.fonts.ready;
          const images = [...document.querySelectorAll('img[src]')].filter(img => img.getAttribute('src'));
          images.forEach(img => { img.loading = 'eager'; });
          await Promise.all(images.map(img => img.decode()));
        });
        assert.equal(await page.locator('.cinema-scene').count(), 4);
        assert.equal(await page.locator('.art-kind').filter({ hasText: 'Artistic reconstruction' }).count(), 2);
        assert.equal(await page.locator('#cast li:not([hidden])').count(), 10);
        // Photo/ink comparison works from keyboard at both endpoints, with meaningful values.
        for (const range of await page.locator('.ink-controls input').all()) {
          await range.focus(); await page.keyboard.press('Home');
          assert.match(await range.getAttribute('aria-valuetext'), /^0% ink interpretation, 100% source photograph$/);
          await page.keyboard.press('End');
          assert.match(await range.getAttribute('aria-valuetext'), /^100% ink interpretation, 0% source photograph$/);
        }
        for (const summary of await page.locator('.source-note summary').all()) {
          await summary.focus(); await page.keyboard.press('Enter');
          assert.equal(await summary.evaluate(el => el.parentElement.open), true);
          await page.keyboard.press('Enter');
        }
        // Existing classroom interactions retain their behavior.
        await page.locator('#claims .claim').first().getByRole('button', { name:'History', exact:true }).click();
        assert.match(await page.locator('#hoh-score').innerText(), /^1 of 10 called/i);
        await page.locator('#oddsctl button[data-step="2"]').click();
        assert.equal(await page.locator('#oddsctl button[data-step="2"]').getAttribute('aria-pressed'), 'true');
        await page.locator('#doors button').first().click();
        assert.equal(await page.locator('#routes .dim').count() > 0, true);
        await page.locator('#dctl button[data-view="undrafted"]').click();
        assert.equal(await page.locator('#dctl button[data-view="undrafted"]').getAttribute('aria-pressed'), 'true');
        await page.locator('#card-name').fill('The Test Route');
        assert.equal(await page.locator('#cc-name').textContent(), 'The Test Route');
        assert.equal(await page.locator('textarea').count(), 5);
        for (const scene of await page.locator('.cinema-scene').all()) {
          await scene.scrollIntoViewIfNeeded();
          await scene.locator('img').first().evaluate(img => img.decode());
        }
        const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(overflow.scroll <= overflow.width + 1, `Page width: ${JSON.stringify(overflow)}`);
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
        await writeFile(resolve(output, `axe-${name}.json`), JSON.stringify(axe, null, 2));
        assert.deepEqual(axe.violations.map(v => ({ id:v.id, nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary})) })), []);
        assert.deepEqual(errors, []); assert.deepEqual(missing, []);
        await page.locator('.cover').screenshot({ path: resolve(output, `after-cover-${name}.jpg`), quality:90 });
        for (const id of ['reel', 'u-bleier', 'u-warner', 'tree']) {
          await page.locator('#' + id).screenshot({ path: resolve(output, `after-${id}-${name}.jpg`), quality:90 });
        }
        // Native source disclosures and full photographic anchors still exist without JS.
        const staticPage = await context.newPage();
        await staticPage.goto(origin + '/__baseline.html');
        await staticPage.locator('.cover').screenshot({ path: resolve(output, `before-cover-${name}.jpg`), quality:90 });
        await staticPage.close();
        results.push({ width, reducedMotion, status:'passed', errors, missing });
        console.log(`PASS Route Tree: keyboard comparison, existing interactions, source labels, WCAG and fit at ${name}`);
      } catch (error) {
        results.push({ width, reducedMotion, status:'failed', message:error.message });
        console.error(`FAIL ${name}: ${error.message}`);
        await page.screenshot({ path: resolve(output, `failed-${name}.jpg`), fullPage:true, quality:85 }).catch(()=>{});
      } finally { await context.close(); }
    }
  }
  const context = await browser.newContext({ javaScriptEnabled:false, viewport:{width:390,height:844} });
  const page = await context.newPage();
  await context.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
  await page.goto(origin + '/hubs/bts-the-route-tree.html');
  assert.equal(await page.locator('.source-note summary').count(), 2);
  assert.equal(await page.locator('#cast li:not([hidden])').count(), 10);
  await page.locator('.source-note summary').first().click();
  assert.equal(await page.locator('.source-note').first().evaluate(el=>el.open), true);
  await context.close();
} finally {
  await writeFile(resolve(output, 'results.json'), JSON.stringify(results, null, 2));
  await browser.close(); await new Promise(ok => server.close(ok));
}
assert.equal(results.filter(r=>r.status==='failed').length, 0, 'All Route Tree viewports and motion modes pass');
