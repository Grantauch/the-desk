import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = 4391;
const origin = `http://127.0.0.1:${port}`;
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const server = spawn(npm, ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port)], {
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk; });
server.stderr.on('data', (chunk) => { serverOutput += chunk; });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitForServer = async () => {
  const until = Date.now() + 20_000;
  while (Date.now() < until) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // Preview is still starting.
    }
    await sleep(200);
  }
  throw new Error(`Astro preview did not start.\n${serverOutput}`);
};

let checks = 0;
const pass = (condition, label) => {
  if (!condition) throw new Error(`Browser check failed: ${label}`);
  checks += 1;
  console.log(`PASS  ${label}`);
};

const routes = ['/', '/us-history/', '/tools/', '/calendar/'];
const viewports = [
  { name: 'phone 360', width: 360, height: 800 },
  { name: 'phone 390', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    for (const route of routes) {
      pageErrors.length = 0;
      await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(900);
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      pass(overflow <= 1, `${viewport.name}: ${route} has no horizontal overflow`);
      pass(pageErrors.length === 0, `${viewport.name}: ${route} has no JavaScript page error`);
    }

    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    const dailyActions = (await page.locator('.class-entry strong').allTextContents()).join(' ').toLowerCase();
    pass(
      dailyActions.includes('daily check-in') && dailyActions.includes('hall pass'),
      `${viewport.name}: everyday Check-In and Hall Pass remain prominent`,
    );

    await page.goto(`${origin}/us-history/`, { waitUntil: 'domcontentloaded' });
    const current = (await page.locator('#right-now-title').textContent())?.trim().toLowerCase() ?? '';
    pass(current === 'the gilded age', `${viewport.name}: U.S. History current unit is the Gilded Age`);

    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.keyboard.press('Control+k');
  pass(await page.locator('#desk-search-dialog').evaluate((dialog) => dialog.open), 'page finder opens from Ctrl+K');
  await page.locator('#desk-search-input').fill('timer');
  pass(await page.locator('.desk-search-results a[href="/tools/"]:visible').count() === 1, 'page finder filters timer to classroom tools');
  await page.keyboard.press('Escape');
  pass(!(await page.locator('#desk-search-dialog').evaluate((dialog) => dialog.open)), 'page finder closes with Escape');

  await page.goto(`${origin}/calendar/`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-calendar-filter="history"]').click();
  const visibleHistoryTitles = await page.locator('[data-calendar-event]:visible h3').allTextContents();
  pass(visibleHistoryTitles.some((title) => title.trim().toLowerCase() === 'the gilded age'), 'calendar history filter shows the Gilded Age');
  const wrongCourseVisible = await page.locator('[data-calendar-event]:visible').evaluateAll((events) =>
    events.some((event) => !['history', 'all'].includes(event.dataset.course || ''))
  );
  pass(!wrongCourseVisible, 'calendar history filter hides unrelated course milestones');

  await page.goto(`${origin}/tools/`, { waitUntil: 'domcontentloaded' });
  await page.locator('.t-preset[data-min="1"]').click();
  await page.locator('#timer-start').click();
  await page.waitForTimeout(1150);
  pass((await page.locator('#timer-display').textContent()) !== '01:00', 'classroom timer advances using wall-clock time');
  const focusButton = page.locator('#timer-focus');
  const focusOkay = await focusButton.count() === 1 && (
    !(await focusButton.isVisible()) ||
    ((await focusButton.textContent()) ?? '').toLowerCase().includes('classroom screen')
  );
  pass(focusOkay, 'timer fullscreen control is available when the browser supports it');

  await page.goto(`${origin}/us-history/`, { waitUntil: 'domcontentloaded' });
  const featuredMedia = page.locator('.featured-media');
  const mediaOkay = await featuredMedia.count() === 1 && (await featuredMedia.locator('h2').textContent())?.trim().length > 0;
  pass(mediaOkay, 'featured U.S. History media renders with a labelled heading');

  await context.close();

  if (checks !== 38) throw new Error(`Expected 38 browser checks, ran ${checks}.`);
  console.log(`Browser UI: PASS — ${checks} checks across two phone sizes and desktop.`);
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
