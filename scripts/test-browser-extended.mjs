import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { preview } from 'astro';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';
import { learningCourses } from '../src/data/learningHubs.ts';
import { storyHubs } from '../src/data/storyhubs.ts';

const origin = 'http://127.0.0.1:4392';
const artifacts = new URL('../browser-results/', import.meta.url);
const artifact = (name) => fileURLToPath(new URL(name, artifacts));
const catalogOnly = process.env.DESK_BROWSER_STORY_LIBRARY_ONLY === '1';
const storyRoute = '/storyhubs/';
const courseRoutes = ['/us-history/', '/hidden-history/', '/beyond-the-scoreboard/'];
const protectedStoryLinks = [...storyHubs.map(({ href }) => href), '/hubs/ush9-over-the-somme.html'];
const archiveSources = '.archive-sources a';
const storyAnchors = `a:not(${archiveSources})`;
const l015ArchiveLinks = [
  'https://www.loc.gov/item/99614203/',
  'https://commons.wikimedia.org/wiki/File:Harpers_8_11_1877_Steeple_View_of_Pittsburgh_Conflagaration_(cropped).jpg',
];
const hrefsOf = (links) => links.evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')));
const firstLook = ['The Other Half', 'They Couldn’t Stop', 'The Route Tree', 'Over the Somme'];
const routes = catalogOnly ? [storyRoute] : [
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
  storyRoute,
  ...courseRoutes,
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

async function testUnitActions(page, route) {
  const courseSlug = route.slice(1, -1);
  const course = learningCourses.find(({ slug }) => slug === courseSlug);
  const units = page.locator('.units-section .unit-row');
  const learningLinks = units.locator('a.learning-hub-trigger');
  const materialButtons = units.locator('button.materials-trigger');

  assert.deepEqual((await hrefsOf(learningLinks)).toSorted(),
    course.units.map(({ slug }) => `/learn/${courseSlug}/${slug}/`).toSorted(),
    'The course still offers every canonical learning unit');
  const drawerCount = await materialButtons.count();
  assert.ok(drawerCount > 0, 'The course offers unit materials');
  assert.equal(await units.locator('dialog.materials-dialog').count(), drawerCount);

  let firstDrawer;
  const dialogIds = new Set();
  for (const unit of await units.all()) {
    const title = await unit.locator('.unit-row__title h3').innerText();
    if (await unit.locator('a.learning-hub-trigger').count()) {
      const launchName = `learning hub: ${title}`;
      const launch = unit.getByRole('link', { name: launchName, exact: true });
      assert.equal(await launch.count(), 1, `A student can find the ${title} learning hub by name`);
      assert.equal(await page.getByRole('link', { name: launchName, exact: true }).count(), 1);
    }

    const control = unit.locator('button.materials-trigger');
    if (!(await control.count())) continue;
    const visibleCount = await control.locator('.materials-trigger__count').innerText();
    const drawerName = `unit materials ${visibleCount}: ${title}`;
    const button = unit.getByRole('button', { name: drawerName, exact: true });
    const dialogId = await control.getAttribute('data-materials-open');
    assert.ok(dialogId && !dialogIds.has(dialogId), 'Every materials button opens its own dialog');
    dialogIds.add(dialogId);
    assert.equal(await button.count(), 1, `A student can find the ${title} materials by name`);
    assert.equal(await page.getByRole('button', { name: drawerName, exact: true }).count(), 1);
    assert.equal(await button.getAttribute('aria-controls'), dialogId);
    assert.equal(await unit.locator(`dialog[id="${dialogId}"]`).count(), 1);
    firstDrawer ??= { button, title };
  }

  const { button, title } = firstDrawer;
  await button.press('Enter');
  const dialog = page.getByRole('dialog', { name: title, exact: true });
  await dialog.waitFor({ state: 'visible' });
  assert.ok(await dialog.evaluate((element) => element.contains(document.activeElement)));
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.ok(await button.evaluate((element) => document.activeElement === element),
    'Escape returns keyboard focus to the materials button');
}

async function testLibraryArchiveCredit(library) {
  assert.deepEqual(await hrefsOf(library.locator(`[data-entry] ${archiveSources}`)), l015ArchiveLinks,
    'Only the two exact archive source links are separate from the lesson route set');
  const card = library.locator('[data-entry]:has(a[href="/hubs/ush9-l015-who-showed-up.html"])');
  const credit = card.locator('figcaption.archive-credit');
  const label = credit.getByText('Wood engraving by M. B. Leiser · Harper’s Weekly, Aug. 11, 1877, pp. 624–625', { exact: true });
  assert.ok(await label.isVisible(), 'The L015 artwork credit is visible');
  assert.equal(await label.evaluate((element) => element.closest('a') !== null), false,
    'The source credit text is separate from links');
  assert.deepEqual(await hrefsOf(credit.locator(`${archiveSources}:visible`)), l015ArchiveLinks,
    'Both archive sources are visible inside the L015 artwork credit');
}

async function testLibrary(page, viewport) {
  const library = page.locator('[data-story-library]');
  const visibleTitles = () => library.locator('[data-entry]:visible h4').allTextContents();
  const pageSize = viewport.width <= 740 ? 2 : 3;
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://grant-desk.com/storyhubs/');
  const hrefs = await hrefsOf(library.locator(`[data-entry] ${storyAnchors}`));
  assert.deepEqual(hrefs.toSorted(), protectedStoryLinks.toSorted(), 'All current catalog URLs and only the Somme cross-list');
  assert.equal(new Set(hrefs).size, hrefs.length, 'Every lesson URL has exactly one catalog card');
  assert.deepEqual(await visibleTitles(), firstLook.slice(0, pageSize), 'Approved top cards, paged for the viewport');
  const feature = library.getByRole('link', { name: 'Open the story: Thirty-seven Days' });
  assert.equal(await feature.getAttribute('href'), '/hubs/ush9-bytesize-thirty-seven-days.html');
  assert.ok(await library.locator('.feature img').evaluate(async (img) => {
    await img.decode();
    return img.naturalWidth > 0;
  }), 'The credited existing Sarajevo plate actually loads');

  const next = library.getByRole('button', { name: 'Next' });
  await next.focus();
  assert.equal(await next.evaluate((button) => getComputedStyle(button).outlineStyle), 'solid');
  await next.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'story-library-results');
  assert.equal((await visibleTitles())[0], firstLook[pageSize]);

  const search = library.getByRole('searchbox', { name: 'Search stories' });
  const activity = library.getByRole('combobox', { name: 'What do you want to do?' });
  const us = library.getByRole('button', { name: 'U.S. History', exact: true });
  await us.press('Space');
  assert.equal(await us.getAttribute('aria-pressed'), 'true');
  await activity.selectOption('map');
  await search.fill('WWI Somme Lochnagar');
  assert.deepEqual(await visibleTitles(), ['Over the Somme']);
  const somme = library.getByRole('link', { name: 'Open map: Over the Somme' });
  assert.equal(await somme.getAttribute('href'), '/hubs/ush9-over-the-somme.html');

  await search.fill('not-a-real-story-xyzzy');
  assert.deepEqual(await visibleTitles(), []);
  assert.equal(await library.getByRole('status').textContent(), '0 stories');
  await library.locator('[data-empty]').getByRole('button', { name: 'Clear filters' }).press('Enter');
  assert.equal(await search.evaluate((element) => document.activeElement === element), true);
  assert.equal(await activity.inputValue(), 'all');
  assert.deepEqual(await visibleTitles(), firstLook.slice(0, pageSize));

  const pearlHarbor = library.locator('[data-entry]:visible a[href="/hubs/hh-dont-worry-about-it.html"]');
  for (const alias of ['WWI', 'WW1', 'World War I', 'World War One', 'Great War']) {
    await search.fill(`${alias} Pearl Harbor`);
    assert.equal(await pearlHarbor.count(), 0, `Pearl Harbor does not match ${alias}`);
    await search.fill(`${alias} Somme Lochnagar`);
    assert.deepEqual(await visibleTitles(), ['Over the Somme']);
  }
  for (const alias of ['WWII', 'WW2', 'World War II', 'World War Two']) {
    await search.fill(`${alias} Pearl Harbor`);
    assert.equal(await pearlHarbor.count(), 1, `Pearl Harbor matches ${alias}`);
    await search.fill(`${alias} Somme Lochnagar`);
    assert.deepEqual(await visibleTitles(), []);
  }

  await search.fill('Who Showed Up');
  await testLibraryArchiveCredit(library);

  await library.getByRole('button', { name: 'Beyond the Scoreboard' }).click();
  await search.fill('boxing Schmeling');
  assert.ok((await visibleTitles()).includes('Two Minutes, Four Seconds'));
  assert.equal(await library.locator('[data-entry]:visible:not([data-class="bts"])').count(), 0);
}

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
        if (route === storyRoute) await testLibrary(page, viewport);
        if (courseRoutes.includes(route)) await testUnitActions(page, route);
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
    if (catalogOnly) {
      await context.close();
      continue;
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

  const noJS = await browser.newContext({ javaScriptEnabled: false, viewport: viewports[0] });
  try {
    await noJS.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await noJS.newPage();
    await page.goto(origin + storyRoute);
    const library = page.locator('[data-story-library]');
    assert.equal(await library.getByRole('searchbox', { name: 'Search stories' }).count(), 0);
    const links = await hrefsOf(library.locator(`[data-entry]:visible ${storyAnchors}`));
    assert.deepEqual(links.toSorted(), protectedStoryLinks.toSorted(), 'Every story remains usable without scripts');
    await testLibraryArchiveCredit(library);
    results.push({ route: storyRoute, viewport: 'phone-320 no JavaScript', status: 'passed' });
    console.log('PASS phone-320 no JavaScript: all Story Hubs links remain visible');
  } catch (error) {
    results.push({ route: storyRoute, viewport: 'phone-320 no JavaScript', status: 'failed', error: error.stack });
    console.error(`FAIL phone-320 no JavaScript: ${error.message}`);
  } finally {
    await noJS.close();
  }

  const failed = results.filter((result) => result.status === 'failed');
  console.log(`Extended browser UI: ${results.length - failed.length}/${results.length} cases passed. External services stubbed offline.`);
  if (failed.length) process.exitCode = 1;
} finally {
  await writeFile(artifact('extended-report.json'), JSON.stringify({ results, externalServices: 'offline fixtures' }, null, 2));
  await browser?.close();
  await server?.stop();
}
