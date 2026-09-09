import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { preview } from 'astro';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:4392';
const artifacts = new URL('../browser-results/storyhub-release/', import.meta.url);
const artifact = name => fileURLToPath(new URL(name, artifacts));
const supplied = (process.env.STORYHUB_TEST_ROUTES || '')
  .split(',')
  .map(route => route.trim())
  .filter(Boolean);
const routes = [...new Set(supplied.length ? supplied : ['/storyhubs/'])];
const viewports = [
  { name: 'phone-320', width: 320, height: 740 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 1000 },
];
const results = [];
let browser;
let server;
await mkdir(artifacts, { recursive: true });

const visit = async (page, route) => {
  const response = await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
  assert.equal(response?.status(), 200, `${route} returns 200`);
  await page.evaluate(async () => document.fonts?.ready);
};

const testPage = async (viewport, route, reducedMotion = 'no-preference') => {
  const context = await browser.newContext({ viewport, reducedMotion });
  await context.route('**/*', request => {
    const url = new URL(request.request().url());
    return url.origin !== origin || url.pathname.startsWith('/.netlify/')
      ? request.fulfill({ status: 503, body: 'Offline StoryHub release fixture' })
      : request.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const errors = [];
  const failedRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => {
    const url = new URL(request.url());
    if (url.origin === origin) failedRequests.push(`${url.pathname}: ${request.failure()?.errorText || 'failed'}`);
  });
  const slug = `${viewport.width}-${reducedMotion}-${route.replace(/[^a-z0-9]+/gi, '-') || 'home'}`;
  try {
    await visit(page, route);
    assert.ok(await page.locator('h1').first().isVisible(), 'Visible page heading');
    assert.deepEqual(errors, [], 'No uncaught browser errors');
    assert.deepEqual(failedRequests, [], 'No failed local asset requests');

    const overflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      offenders: [...document.querySelectorAll('body *')]
        .map(element => {
          const box = element.getBoundingClientRect();
          return { tag: element.tagName.toLowerCase(), id: element.id, left: Math.round(box.left), right: Math.round(box.right) };
        })
        .filter(box => box.left < -1 || box.right > document.documentElement.clientWidth + 1)
        .slice(0, 8),
    }));
    assert.ok(overflow.scrollWidth <= overflow.clientWidth + 1, `No horizontal overflow: ${JSON.stringify(overflow)}`);

    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    await writeFile(artifact(`${slug}-axe.json`), JSON.stringify(axe, null, 2));
    assert.deepEqual(
      axe.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) })),
      [],
      'Full-page WCAG A/AA including contrast',
    );

    const focusable = page.locator('a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])').filter({ visible: true });
    if (await focusable.count()) {
      await page.keyboard.press('Tab');
      const active = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase());
      assert.notEqual(active, 'body', 'Keyboard focus enters the page');
    }

    if (reducedMotion === 'reduce') {
      const running = await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length);
      assert.equal(running, 0, 'Reduced motion leaves no running page animations');
    }

    await page.screenshot({ path: artifact(`${slug}.png`), fullPage: true });
    results.push({ route, viewport: viewport.width, reducedMotion, status: 'passed' });
    console.log(`PASS ${viewport.width}px ${reducedMotion}: ${route}`);
  } catch (error) {
    results.push({ route, viewport: viewport.width, reducedMotion, status: 'failed', error: error.stack });
    console.error(`FAIL ${viewport.width}px ${reducedMotion}: ${route}\n${error.message}`);
    await page.screenshot({ path: artifact(`${slug}-failed.png`), fullPage: true }).catch(() => {});
  } finally {
    await context.close();
  }
};

try {
  server = await preview({ server: { host: '127.0.0.1', port: 4392 } });
  browser = await chromium.launch({ headless: true });
  for (const viewport of viewports) {
    for (const route of routes) await testPage(viewport, route);
  }
  for (const route of routes.filter(route => route.startsWith('/hubs/'))) {
    await testPage(viewports[1], route, 'reduce');
  }
  const failures = results.filter(result => result.status === 'failed');
  console.log(`StoryHub release browser: ${results.length - failures.length}/${results.length} cases passed across ${routes.length} route(s).`);
  if (failures.length) process.exitCode = 1;
} finally {
  await writeFile(artifact('report.json'), JSON.stringify({ routes, results, externalServices: 'offline fixtures' }, null, 2));
  await browser?.close();
  await server?.stop();
}
