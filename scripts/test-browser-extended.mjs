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
const reflowRoutes = [
  'bts-robinson-review',
  'constitution-day-2026-09-18',
  'hh-dont-worry-about-it',
  'hh-follow-the-money',
  'hh-mkultra-review',
  'reconstruction-case-file',
  'ush9-muckrakers-review',
  'ush9-square-deal',
  'ush9-the-jungle',
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
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all(
            document.getAnimations()
              .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
              .map((animation) => animation.finished.catch(() => {})),
          );
        });
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
        await page.screenshot({ path: artifact(`extended-${viewport.name}-${slug}.png`) });
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
    for (const slug of reflowRoutes) {
      const route = `/hubs/${slug}.html`;
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        const response = await page.goto(`${origin}${route}`, { waitUntil: 'load' });
        assert.equal(response?.status(), 200);
        await page.evaluate(() => document.fonts.ready);
        if (slug === 'hh-dont-worry-about-it' && viewport.width === 320) {
          // Reproduce wider input font metrics while the browser fixture blocks external fonts.
          await page.addStyleTag({ content: '.idbar input { font-size: 1.25rem; }' });
          const formFits = await page.locator('.idbar').evaluate(form => {
            const right = form.getBoundingClientRect().right;
            return [...form.querySelectorAll('label, input')].every(field => field.getBoundingClientRect().right <= right);
          });
          assert.ok(formFits, 'All three labeled fields fit inside the student header');
          const mapScroll = await page.locator('.mapscroll').evaluate(map => {
            map.scrollLeft = 60;
            return map.scrollLeft;
          });
          assert.ok(mapScroll > 0, 'The Pacific map still scrolls within its own region');
        }
        const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
        assert.ok(fits, `${route} fits the viewport without horizontal page scrolling`);
        assert.deepEqual(errors, [], `${route} has no uncaught browser errors`);
        results.push({ route, viewport: viewport.name, status: 'passed' });
        console.log(`PASS ${viewport.name}: ${route} reflow`);
      } catch (error) {
        results.push({ route, viewport: viewport.name, status: 'failed', error: error.stack });
        console.error(`FAIL ${viewport.name}: ${route}\n${error.message}`);
      } finally {
        await page.close();
      }
    }
    const videoPage = await context.newPage();
    const videoRoute = '/hubs/ush9-bytesize-thirty-seven-days.html';
    try {
      // Exercise only the public lesson UI, with every external service kept offline.
      await videoPage.goto(`${origin}${videoRoute}?deskteacher=on`, { waitUntil: 'load' });
      const players = videoPage.locator('[data-yt]');
      assert.equal(await players.count(), 3, 'The lesson retains its three videos');
      for (const [index, player] of (await players.all()).entries()) {
        const id = await player.getAttribute('data-yt');
        const title = await player.getAttribute('data-title');
        const trigger = player.getByRole('button', { name: title, exact: true });
        const source = videoPage.locator(`a[href="https://www.youtube.com/watch?v=${id}"]`);
        assert.ok(await source.isVisible(), 'The original video link remains usable offline');
        await trigger.focus();
        await videoPage.keyboard.press(index === 1 ? 'Space' : 'Enter');
        const frame = player.locator('iframe');
        assert.equal(await frame.getAttribute('title'), title);
        assert.equal(await frame.evaluate(el => document.activeElement === el), true,
          'Keyboard activation transfers focus to the replacement player');
        assert.equal(await player.evaluate(el => getComputedStyle(el).outlineStyle), 'solid',
          'The focused player has a visible outline');
        assert.ok(await source.isVisible(), 'Replacing the player does not remove the original link');
      }
      assert.ok(await videoPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        'The loaded players fit without horizontal scrolling');
      results.push({ route: videoRoute + ' keyboard video', viewport: viewport.name, status: 'passed' });
      console.log(`PASS ${viewport.name}: ${videoRoute} video activation retains keyboard focus`);
    } catch (error) {
      results.push({ route: videoRoute + ' keyboard video', viewport: viewport.name, status: 'failed', error: error.stack });
      console.error(`FAIL ${viewport.name}: ${videoRoute} keyboard video\n${error.message}`);
    } finally {
      await videoPage.close();
    }
    const navPage = await context.newPage();
    try {
      await navPage.goto(origin, { waitUntil: 'load' });
      const summary = navPage.locator('nav details summary:visible');
      await summary.focus();
      await navPage.keyboard.press('Enter');
      const menu = navPage.locator('nav details[open] .nav-menu:visible');
      await menu.evaluate(element => { element.scrollTop = element.scrollHeight; });
      const about = menu.getByRole('link', { name: 'about', exact: true });
      assert.ok(await about.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        return bounds.top >= 0 && bounds.bottom <= innerHeight;
      }), 'The last Explore link fits entirely in the viewport');
      await about.click();
      await navPage.waitForURL('**/about/');
      results.push({ route: 'Explore menu', viewport: viewport.name, status: 'passed' });
      console.log(`PASS ${viewport.name}: Explore menu reaches its last link`);
    } catch (error) {
      results.push({ route: 'Explore menu', viewport: viewport.name, status: 'failed', error: error.stack });
      console.error(`FAIL ${viewport.name}: Explore menu\n${error.message}`);
    } finally {
      await navPage.close();
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
