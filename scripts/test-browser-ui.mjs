import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { preview } from 'astro';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:4391';
const artifacts = new URL('../browser-results/', import.meta.url);
const artifact = name => fileURLToPath(new URL(name, artifacts));
const routes = ['/', '/us-history/', '/hidden-history/', '/beyond-the-scoreboard/', '/calendar/', '/resources/', '/tools/', '/check-in/', '/pass/', '/hubs/ush9-l015-who-showed-up.html', '/hubs/bts-l03-not-in-the-room.html', '/hubs/hh-l06-two-sources.html'];
const viewports = [
  { name: 'phone-320', width: 320, height: 740 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 1000 },
];
const results = [];
let sourceChecks = 0;
const pass = (condition, label) => { assert.ok(condition, label); sourceChecks++; };
const visit = async (page, route) => {
  const response = await page.goto(`${origin}${route}`, { waitUntil: 'load' });
  assert.equal(response.status(), 200);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished.catch(() => {})));
  });
};
let browser;
let server;
await mkdir(artifacts, { recursive: true });
const runCase = async (name, viewport, check, reducedMotion = 'no-preference') => {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion });
  // Never contact student services or external feeds from automated acceptance tests.
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin !== origin || url.pathname.startsWith('/.netlify/')
      ? route.fulfill({ status: 503, body: 'Offline browser fixture' }) : route.continue();
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const slug = `${viewport.name}-${name.replace(/[^a-z0-9]+/gi, '-')}`;
  try {
    await check(page);
    assert.deepEqual(errors, [], 'No uncaught browser errors');
    await page.screenshot({ path: artifact(`${slug}.png`), fullPage: name.startsWith('page ') });
    results.push({ name, viewport: viewport.name, status: 'passed' });
    console.log(`PASS ${viewport.name}: ${name}`);
    await context.tracing.stop();
  } catch (error) {
    results.push({ name, viewport: viewport.name, status: 'failed', error: error.stack });
    console.error(`FAIL ${viewport.name}: ${name}\n${error.message}`);
    await page.screenshot({ path: artifact(`${slug}-failed.png`), fullPage: true }).catch(() => {});
    await context.tracing.stop({ path: artifact(`${slug}-trace.zip`) });
  } finally { await context.close(); }
};
try {
  // API keeps preview in this process on Windows and Linux, with reliable cleanup.
  server = await preview({ server: { host: '127.0.0.1', port: 4391 } });
  browser = await chromium.launch({ headless: true });
  for (const viewport of viewports) {
    for (const route of routes) await runCase(`page ${route}`, viewport, async page => {
      await visit(page, route);
      assert.ok(await page.locator('h1').first().isVisible(), 'Visible page heading');
      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        const offenders = [...document.querySelectorAll('body *')]
          .map(element => {
            const box = element.getBoundingClientRect();
            return { element: element.tagName.toLowerCase(), id: element.id, className: String(element.className || ''), left: Math.round(box.left), right: Math.round(box.right), width: Math.round(box.width) };
          })
          .filter(box => box.left < -1 || box.right > root.clientWidth + 1)
          .slice(0, 8);
        const textOffenders = [...document.querySelectorAll('body *')]
          .flatMap(element => [...element.childNodes]
            .filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
            .map(node => {
              const range = document.createRange();
              range.selectNodeContents(node);
              const box = range.getBoundingClientRect();
              return { parent: element.tagName.toLowerCase(), text: node.textContent.trim().slice(0, 80), left: Math.round(box.left), right: Math.round(box.right), width: Math.round(box.width) };
            }))
          .filter(box => box.left < -1 || box.right > root.clientWidth + 1)
          .slice(0, 8);
        return { clientWidth: root.clientWidth, scrollWidth: root.scrollWidth, offenders, textOffenders };
      });
      assert.ok(overflow.scrollWidth <= overflow.clientWidth + 1, `No horizontal overflow: ${JSON.stringify(overflow)}`);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      await writeFile(artifact(`${viewport.name}-${route.replace(/\//g, '') || 'home'}-axe.json`), JSON.stringify(axe, null, 2));
      assert.deepEqual(axe.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })), [], 'Full-page WCAG A/AA including contrast');
    });
    await runCase('tomorrow storyhubs teach', viewport, async page => {
      await visit(page, '/hubs/ush9-l015-who-showed-up.html');
      assert.equal(await page.locator('.plain-talk').count(), 6, 'USH9 has six visible teaching bridges');
      assert.equal(await page.locator('summary').filter({ hasText: /CORE IDEA|FULL STORY/ }).count(), 0, 'USH9 removes generic AI-style summary labels');
      await page.locator('#dateRange').fill('10');
      assert.equal(await page.locator('#cCities').textContent(), '11', 'USH9 rail network reaches the final evidence state');

      await visit(page, '/hubs/bts-l03-not-in-the-room.html');
      assert.equal(await page.locator('.plain-talk').count(), 5, 'BTS has five visible teaching bridges');
      assert.equal(await page.locator('#wageOut').textContent(), '$1,500', 'BTS open market follows the strongest offer');
      await page.locator('#reserveSwitch').click();
      assert.equal(await page.locator('#reserveSwitch').getAttribute('aria-pressed'), 'true', 'BTS reserve rule enters the reserved state');
      assert.ok(await page.locator('#bid2').isDisabled(), 'BTS reserve rule disables rival bids');
      assert.equal(await page.locator('#wageOut').textContent(), '$1,200', 'BTS reserved market leaves one offer');

      await visit(page, '/hubs/hh-l06-two-sources.html');
      assert.equal(await page.locator('.plain-talk').count(), 7, 'Hidden History has seven visible teaching bridges');
      await page.locator('#traceBack').click();
      await page.locator('#traceBack').click();
      await page.locator('#traceBack').click();
      assert.equal(await page.locator('#originCount').textContent(), '1', 'Hidden History trace collapses repetition to one origin');
    });
    await runCase('course and calendar agree', viewport, async page => {
      for (const [route, course] of [['/us-history/', 'history'], ['/hidden-history/', 'hidden'], ['/beyond-the-scoreboard/', 'scoreboard']]) {
        await visit(page, route);
        const current = (await page.locator('#right-now-title').textContent()).trim().toLowerCase();
        await visit(page, '/calendar/');
        await page.locator(`[data-calendar-filter="${course}"]`).click();
        const titles = await page.locator('[data-calendar-event]:visible h3').allTextContents();
        assert.ok(titles.some(title => title.trim().toLowerCase() === current), `${course} calendar matches course`);
        assert.ok(await page.locator('[data-calendar-event]:visible').evaluateAll((events, course) => events.every(event => ['all', course].includes(event.dataset.course)), course), 'Unrelated milestones hidden');
      }
    });
    await runCase('keyboard page finder', viewport, async page => {
      await visit(page, '/');
      await page.keyboard.press('Control+k');
      assert.ok(await page.locator('#desk-search-input').evaluate(input => input === document.activeElement));
      await page.locator('#desk-search-input').fill('zzzznoresults');
      assert.equal(await page.locator('.desk-search-results a:visible').count(), 0);
      assert.match(await page.locator('#desk-search-count').textContent(), /No matching pages/);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.activeElement === document.querySelector('.desk-search-trigger')); // dialog close restores focus asynchronously
      assert.equal(await page.locator('#desk-search-dialog').evaluate(dialog => dialog.open), false);
      await page.keyboard.press('Control+k');
      await page.locator('#desk-search-input').fill('timer');
      assert.equal(await page.locator('.desk-search-results a:visible').count(), 1);
      await page.keyboard.press('Enter');
      await page.waitForURL(`${origin}/tools/`);
    });
    await runCase('timer pause reset and fullscreen', viewport, async page => {
      await visit(page, '/tools/');
      await page.locator('.t-preset[data-min="1"]').click();
      await page.locator('#timer-start').click();
      await page.waitForFunction(() => document.querySelector('#timer-display').textContent !== '01:00');
      await page.locator('#timer-pause').click();
      const paused = await page.locator('#timer-display').textContent();
      await page.waitForTimeout(1200); // Longer than a timer tick proves pause holds.
      assert.equal(await page.locator('#timer-display').textContent(), paused);
      await page.locator('#timer-reset').click();
      assert.equal(await page.locator('#timer-display').textContent(), '01:00');
      await page.locator('#timer-focus').click();
      await page.waitForFunction(() => document.fullscreenElement?.id === 'timer-card');
      await page.locator('#timer-focus').click();
      await page.waitForFunction(() => document.fullscreenElement === null);
    });
    for (const motion of ['no-preference', 'reduce']) await runCase(`first screen actions motion ${motion}`, viewport, async page => {
      await visit(page, '/');
      for (const href of ['/check-in/', '/pass/']) {
        const action = page.locator(`.class-entry a[href="${href}"]`);
        assert.ok(await action.isVisible());
        const r = await action.boundingBox();
        assert.ok(r.x >= 0 && r.y >= 0 && r.width > 0 && r.height > 0 && r.x + r.width <= viewport.width && r.y + r.height <= viewport.height, `${href} entirely in first viewport`);
      }
      if (motion === 'reduce') assert.ok(await page.evaluate(() => document.getAnimations().every(a => a.playState !== 'running')), 'Reduced motion disables page animations');
    }, motion);
  }
  // Source regressions supplement and are counted separately from browser cases.
  const hiddenHistorySource = (await readFile(new URL('../src/pages/hidden-history.astro', import.meta.url), 'utf8')).toLowerCase();
  pass(
    hiddenHistorySource.includes('the four verdicts — confirmed, debunked, misleading, unproven')
      && !hiddenHistorySource.includes('verdict: it’s complicated'),
    'Hidden History uses one Four Verdicts vocabulary',
  );

  const curiositySource = await readFile(new URL('../src/components/CuriosityDesk.astro', import.meta.url), 'utf8');
  pass(
    !curiositySource.includes('Promise.all(Object.keys(curiosityCollections).map(loadCollection))'),
    'Curiosity Desk does not preload all five collections',
  );
  pass(
    curiositySource.includes('loadCollection(initialCollection)')
      && curiositySource.includes('await loadCollection(nextItem.collection)'),
    'Curiosity Desk loads the first and next collections on demand',
  );

  const deskObjectSource = await readFile(new URL('../src/components/DeskObject.astro', import.meta.url), 'utf8');
  pass(
    deskObjectSource.includes('/face-stamp-no-words.svg')
      && !deskObjectSource.includes('/mr-grant-approved-transparent.png')
      && !deskObjectSource.includes('width: 440%'),
    'desk seal uses the dedicated face-only asset without crop hacks',
  );

  const brandingSources = await Promise.all([
    '../src/data/site-content.json',
    '../src/pages/us-history/syllabus.astro',
    '../src/pages/hidden-history/syllabus.astro',
    '../src/pages/beyond-the-scoreboard/syllabus.astro',
  ].map((path) => readFile(new URL(path, import.meta.url), 'utf8')));
  pass(
    brandingSources.every((source) => !/mr\.?\s+auch/i.test(source))
      && brandingSources.every((source) => /mr\.?\s+grant/i.test(source)),
    'student-facing teacher branding is consistently Mr. Grant',
  );


  const failed = results.filter(result => result.status === 'failed').length;
  console.log(`Browser UI: ${results.length - failed}/${results.length} cases passed; ${sourceChecks} separate source checks. External services stubbed offline. Artifacts: browser-results/`);
  if (failed) process.exitCode = 1;
} finally {
  await writeFile(artifact('report.json'), JSON.stringify({ results, sourceChecks, externalServices: 'offline fixtures' }, null, 2));
  await browser?.close();
  await server?.stop();
}
