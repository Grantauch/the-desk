import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { preview } from 'astro';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:4392';
const artifacts = new URL('../browser-results/', import.meta.url);
const artifact = (name) => fileURLToPath(new URL(name, artifacts));
const routes = [
  '/about/',
  '/announcements/',
  '/curiosity-desk/',
  '/detour-shelf/',
  '/fact-check-friday/',
  '/games/',
  '/glossary/',
  '/learning-hubs/',
  '/news/',
  '/showcase/',
  '/simulations/',
  '/storyhubs/',
  '/us-history/syllabus/',
  '/hidden-history/syllabus/',
  '/beyond-the-scoreboard/syllabus/',
  '/first-day-materials/',
];
const viewports = [
  { name: 'phone-320', width: 320, height: 740 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 1000 },
];

await mkdir(artifacts, { recursive: true });
const results = [];
let browser;
let server;

try {
  server = await preview({ server: { host: '127.0.0.1', port: 4392 } });
  browser = await chromium.launch({ headless: true });

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      return url.origin !== origin || url.pathname.startsWith('/.netlify/')
        ? route.fulfill({ status: 503, body: 'Offline browser fixture' })
        : route.continue();
    });

    for (const route of routes) {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const slug = route.replace(/\//g, '-') || 'home';
      try {
        const response = await page.goto(`${origin}${route}`, { waitUntil: 'load' });
        assert.equal(response?.status(), 200, `${route} returns 200`);
        await page.evaluate(() => document.fonts.ready);
        assert.ok(await page.locator('h1').first().isVisible(), `${route} has a visible h1`);

        const overflow = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        assert.ok(
          overflow.scrollWidth <= overflow.clientWidth + 1,
          `${route} has no horizontal overflow: ${JSON.stringify(overflow)}`,
        );

        const axe = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        await writeFile(
          artifact(`extended-${viewport.name}-${slug}-axe.json`),
          JSON.stringify(axe, null, 2),
        );
        assert.deepEqual(
          axe.violations.map(({ id, nodes }) => ({
            id,
            nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
          })),
          [],
          `${route} passes WCAG A/AA including contrast`,
        );
        assert.deepEqual(errors, [], `${route} has no uncaught browser errors`);
        await page.screenshot({ path: artifact(`extended-${viewport.name}-${slug}.png`), fullPage: true });
        results.push({ route, viewport: viewport.name, status: 'passed' });
        console.log(`PASS ${viewport.name}: ${route}`);
      } catch (error) {
        results.push({ route, viewport: viewport.name, status: 'failed', error: error.stack });
        await page.screenshot({ path: artifact(`extended-${viewport.name}-${slug}-failed.png`), fullPage: true }).catch(() => {});
        console.error(`FAIL ${viewport.name}: ${route}\n${error.message}`);
      } finally {
        await page.close();
      }
    }
    await context.close();
  }

  const failed = results.filter((result) => result.status === 'failed');
  console.log(`Extended browser UI: ${results.length - failed.length}/${results.length} cases passed. External services stubbed offline.`);
  if (failed.length) process.exitCode = 1;
} finally {
  await writeFile(artifact('extended-report.json'), JSON.stringify({ results, externalServices: 'offline fixtures' }, null, 2));
  await browser?.close();
  await server?.stop();
}
