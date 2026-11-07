import assert from 'node:assert/strict';
import { preview } from 'astro';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';
import { learningHubs } from '../src/data/learningHubs.ts';

const origin = 'http://127.0.0.1:4395';
const representatives = [...new Set(learningHubs.map(hub => hub.courseSlug))]
  .map(course => learningHubs.find(hub => hub.courseSlug === course));
const server = await preview({ server: { host: '127.0.0.1', port: 4395 } });
let browser;
let checked = 0;
try {
  browser = await chromium.launch();
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 840 }, reducedMotion: 'reduce' });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const stateChecks = width !== 390;
    if (stateChecks) {
      await context.addInitScript(() => {
        const [, , course, unit] = location.pathname.split('/');
        localStorage.setItem('grantdesk-learning-v1', JSON.stringify({
          profile: {},
          hubs: { [`${course}:${unit}`]: { completed: ['briefing', 'timeline', 'vocab', 'decision', 'quiz', 'exit'] } },
        }));
      });
    }
    const page = await context.newPage();
    for (const hub of stateChecks ? representatives : learningHubs) {
      const route = `/learn/${hub.courseSlug}/${hub.slug}/`;
      assert.equal((await page.goto(origin + route, { waitUntil: 'load' }))?.status(), 200);
      if (stateChecks) {
        await page.locator('[data-completion-card]').waitFor();
        await page.locator('[data-term-card]').first().press('Enter');
        assert.equal(await page.locator('[data-term-card]').first().getAttribute('aria-expanded'), 'true');
        await page.locator('[data-decision]').first().click();
        assert.equal(await page.locator('[data-decision]').first().getAttribute('aria-pressed'), 'true');
      }
      const axe = await new AxeBuilder({ page }).withRules('color-contrast').analyze();
      const findings = axe.violations.flatMap(violation => violation.nodes.map(node => node.target.join(' ')));
      assert.deepEqual(findings, [], `${width}px ${route} has readable contrast`);
      checked++;
    }
    await context.close();
  }
  console.log(`Learning Hub contrast: ${checked} browser cases passed across three course themes.`);
} finally {
  await browser?.close();
  await server.stop();
}
