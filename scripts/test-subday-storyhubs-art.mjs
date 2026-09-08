import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { preview } from 'astro';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:4392';
const artifacts = path.resolve('browser-results', 'subday-storyhubs-art');
const lessons = [
  { route: '/hubs/ush9-s01-the-margin.html', figures: 13 },
  { route: '/hubs/hh-s01-the-desk-it-stopped-at.html', figures: 12 },
  { route: '/hubs/bts-s01-the-death-harvest.html', figures: 13 },
];
const viewports = [
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 1000 },
];

await mkdir(artifacts, { recursive: true });
const server = await preview({ server: { host: '127.0.0.1', port: 4392 } });
const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: viewport.name === 'phone-390' ? 'reduce' : 'no-preference',
    });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.origin === origin ? route.continue() : route.fulfill({ status: 503, body: 'Offline fixture' });
    });

    for (const lesson of lessons) {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
      });
      const response = await page.goto(`${origin}${lesson.route}`, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200, `${lesson.route} responds`);
      assert.equal(await page.locator('.story-art').count(), lesson.figures, `${lesson.route} figure count`);

      for (const image of await page.locator('.story-art img').all()) {
        await image.scrollIntoViewIfNeeded();
        await image.evaluate(img => img.decode());
      }
      assert.ok(
        await page.locator('.story-art img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth === 1279)),
        `${lesson.route} artwork loaded`,
      );
      assert.ok(
        await page.locator('.story-art figcaption').evaluateAll(captions => captions.every(caption => caption.textContent.includes('not archival evidence'))),
        `${lesson.route} reconstruction labels`,
      );
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
        `${lesson.route} no horizontal overflow`,
      );

      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      if (axe.violations.length) console.error(JSON.stringify(axe.violations, null, 2));
      assert.deepEqual(axe.violations.map(({ id }) => id), [], `${lesson.route} WCAG A/AA`);
      assert.deepEqual(errors, [], `${lesson.route} no browser errors`);

      await page.screenshot({
        path: path.join(artifacts, `${viewport.name}-${lesson.route.split('/').at(-1).replace('.html', '')}.png`),
        fullPage: true,
      });
      await page.close();
      console.log(`PASS ${viewport.name} ${lesson.route}`);
    }

    const launcher = await context.newPage();
    const response = await launcher.goto(`${origin}/hubs/substitute-day-2026-09-08.html`, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200, 'launcher responds');
    assert.equal(await launcher.locator('.card').count(), 3, 'launcher keeps three linked courses');
    assert.ok(
      await launcher.locator('.card').evaluateAll(cards => cards.every(card => getComputedStyle(card).backgroundImage.includes('.webp'))),
      'launcher covers installed',
    );
    assert.ok(
      await launcher.locator('.card').evaluateAll(cards => cards.every(card => {
        const summary = card.querySelector('span')?.getBoundingClientRect();
        const action = card.querySelector('em')?.getBoundingClientRect();
        return summary && action && action.top >= summary.bottom + 8;
      })),
      'launcher action labels do not overlap summaries',
    );
    assert.ok(
      await launcher.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
      'launcher no horizontal overflow',
    );
    const launcherAxe = await new AxeBuilder({ page: launcher })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    assert.deepEqual(launcherAxe.violations.map(({ id }) => id), [], 'launcher WCAG A/AA');
    await launcher.screenshot({ path: path.join(artifacts, `${viewport.name}-launcher.png`), fullPage: true });
    await launcher.close();
    await context.close();
    console.log(`PASS ${viewport.name} launcher`);
  }

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${origin}${lessons[0].route}`);
  await page.locator('#notesHead').click();
  const note = `Art release persistence ${Date.now()}`;
  await page.locator('#noteText').fill(note);
  await page.reload();
  assert.equal(await page.locator('#noteText').inputValue(), note, 'notes persist across reload');
  await context.close();
  console.log('PASS notes persistence');
} finally {
  await browser.close();
  await server.stop();
}

console.log('Substitute-day StoryHub artwork browser gate: PASS');
