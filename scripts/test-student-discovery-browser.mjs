import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { preview } from 'astro';

// Synthetic work only. External classroom services never receive requests.
const server = await preview({ server: { host: '127.0.0.1', port: 4402 } });
const origin = `http://127.0.0.1:${server.port}`;
const browser = await chromium.launch({ headless: true,
  ...(process.env.DISCOVERY_CHROMIUM ? { executablePath: process.env.DISCOVERY_CHROMIUM } : {}),
});
const artifacts = 'browser-results/student-discovery';
await mkdir(artifacts, { recursive: true });
const results = [];
const route = '/hubs/constitution-day-2026-09-18.html';
try {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await context.route('**/*', request => new URL(request.request().url()).origin === origin
      ? request.continue() : request.fulfill({ status: 503, body: 'Offline classroom fixture' }));
    await context.addInitScript(() => { window.__deskSaveTest = { gate: false, endpoint: '' }; });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(origin + route);
      // Existing browser-wide answers must never become the next student's work.
      await page.evaluate(() => {
        localStorage.setItem('constitution-2026-09-18-studentName', 'Previous synthetic student');
        localStorage.setItem('constitution-2026-09-18-us1', 'Previous synthetic answer');
      });
      await page.reload();
      await page.locator('#desk-save-panel').waitFor();
      assert.equal(await page.locator('#studentName').inputValue(), '');
      assert.equal(await page.locator('[data-q="us1"]').inputValue(), '');
      await page.getByLabel('Student name', { exact: true }).fill('Synthetic reviewer');
      await page.getByLabel('Class period', { exact: true }).selectOption({ label: '1st' });
      const answer = page.locator('[data-q="us1"]');
      await answer.fill('Synthetic interstate commerce reasoning.');
      assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('desk-save:v1:constitution-day-2026-09-18')).values['q:us1']), 'Synthetic interstate commerce reasoning.', 'Existing q: answer keys remain compatible');
      await page.reload();
      await page.locator('#desk-save-panel').waitFor();
      assert.equal(await answer.inputValue(), 'Synthetic interstate commerce reasoning.', 'Tab refresh recovers work');
      const nextStudent = await context.newPage();
      await nextStudent.goto(origin + route);
      await nextStudent.locator('#desk-save-panel').waitFor();
      assert.equal(await nextStudent.locator('#studentName').inputValue(), '', 'New student tab has no previous identity');
      assert.equal(await nextStudent.locator('[data-q="us1"]').inputValue(), '', 'New student tab has no previous work');
      await nextStudent.close();
      for (const course of ['us', 'hh', 'bs']) {
        await page.locator(`[data-course="${course}"]`).click();
        assert.equal(await page.locator(`#panel-${course}`).isVisible(), true);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        assert.deepEqual(axe.violations.map(x => ({ id: x.id, nodes: x.nodes.map(n => n.target) })), []);
      }
      await page.locator('[data-course="hh"]').click();
      await page.locator('[data-q="hh1"]').fill('Synthetic Hidden History response.');
      await page.getByLabel('Class period', { exact: true }).selectOption({ label: '1st' });
      const downloaded = page.waitForEvent('download');
      await page.locator('#downloadBtn').click();
      const file = await downloaded;
      const text = await readFile(await file.path(), 'utf8');
      assert.match(text, /Synthetic Hidden History response/);
      assert.doesNotMatch(text, /Synthetic interstate commerce reasoning/);
      await page.locator('[data-course="us"]').click();
      await page.screenshot({ path: `${artifacts}/${width}-constitution.png` });
      page.once('dialog', dialog => dialog.accept());
      await page.locator('#clearBtn').click();
      await page.reload();
      await page.locator('#desk-save-panel').waitFor();
      assert.equal(await answer.inputValue(), '', 'Clearing a course survives refresh');
      await page.goto(origin + '/games/');
      assert.equal(await page.getByRole('link', { name: /constitution day · case files/ }).count(), 0,
        'Source investigations are separate from Games');
      assert.equal(await page.getByRole('link', { name: /jeopardy live · student buzzer/ }).getAttribute('href'), '/hubs/jeopardy-buzz.html');
      assert.equal(await page.locator('a[href*="lessonhub-lab"]').count(), 0);
      assert.equal(await page.locator('a[href="/hubs/ush9-muckrakers-review.html"]').count(), 0,
        'Practice drills are not mixed into the Games cabinet');
      await page.getByRole('link', { name: /Practice & review/i }).first().click();
      await page.waitForURL(origin + '/practice/');
      assert.ok(await page.getByRole('heading', { name: /practice & review/i }).count());
      assert.ok(await page.locator('a[href="/hubs/ush9-muckrakers-review.html"]').count(),
        'The practice activity retains its original student URL');
      await page.goto(origin + '/games/');
      await page.getByRole('link', { name: 'Explore simulations and investigations' }).click();
      await page.waitForURL(origin + '/simulations/');
      const namedActivityLinks = new Set();
      for (const [headingId, action] of [
        ['interactive-simulations-heading', 'open simulation'],
        ['investigation-heading', 'open investigation'],
        ['story-simulations-heading', 'try the model inside this Story Hub'],
      ]) {
        const cards = page.locator(`section[aria-labelledby="${headingId}"] article`);
        assert.ok((await cards.count()) > 0, `The ${headingId} section still has activities`);
        for (const card of await cards.all()) {
          const heading = card.getByRole('heading', { level: 3 });
          assert.equal(await heading.count(), 1);
          const title = (await heading.textContent()).trim().replace(/\s+/g, ' ');
          assert.ok(title, 'Each activity has a visible title');
          assert.equal(await card.getByRole('heading', { level: 3, name: title, exact: true }).isVisible(), true);
          const name = `${action}: ${title}`;
          assert.equal(await card.getByRole('link').count(), 1);
          assert.equal(await card.getByRole('link', { name, exact: true }).isVisible(), true,
            `The link names this activity without announcing its decorative arrow: ${name}`);
          assert.ok(!namedActivityLinks.has(name), `Activity link name is unique: ${name}`);
          namedActivityLinks.add(name);
        }
      }
      const modelSection = page.locator('section[aria-labelledby="story-simulations-heading"]');
      assert.equal(await modelSection.locator('article').count(), 8,
        'All eight substantive Story Hub models must be discoverable in Simulations');
      assert.equal(await modelSection.locator('img, svg').count(), 0,
        'Cross-discovery must not reuse synthetic narrative covers as simulation previews');
      for (const href of [
        '/hubs/hh-they-couldnt-stop.html',
        '/hubs/ush9-bytesize-marne.html',
        '/hubs/ush9-bytesize-why-they-fought.html',
        '/hubs/bts-l03-not-in-the-room.html',
        '/hubs/ush9-l015-who-showed-up.html',
        '/hubs/ush9-l018-the-debt-didnt-move.html',
        '/hubs/ush9-s01-the-margin.html',
        '/hubs/bts-s01-the-death-harvest.html',
      ]) {
        assert.equal(await modelSection.locator(`a[href="${href}"]`).count(), 1,
          `One canonical student link must remain for ${href}`);
      }
      assert.equal(await modelSection.getByText('Change wheat prices while farm debt stays fixed.').count(), 1,
        'Students can see what variable they will actually test');
      const investigation = page.locator('section[aria-labelledby="investigation-heading"] article')
        .filter({ has: page.getByRole('heading', { name: /constitution day · case files/ }) });
      const investigationLink = investigation.getByRole('link', { name: 'open investigation: constitution day · case files', exact: true });
      assert.equal(await investigationLink.getAttribute('href'), route, 'The assignment keeps its original URL');
      const assignmentOpened = page.waitForEvent('popup');
      await investigationLink.click();
      const assignment = await assignmentOpened;
      await assignment.waitForLoadState('domcontentloaded');
      assert.equal(new URL(assignment.url()).pathname, route);
      await assignment.locator('[data-q="us1"]').waitFor();
      await assignment.close();
      await page.goto(origin + '/us-history/');
      assert.equal(await page.locator('a[href*="jeopardy-v2"]').count(), 0);
      assert.ok(await page.locator('a[href*="jeopardy-v3"]').count());
      assert.equal(await page.locator('a[href*="situation_room"]').count(), 0);
      await page.goto(origin + '/hubs/jeopardy-buzz.html');
      await page.getByLabel('Game code').fill('ABC');
      await page.getByLabel('First name').fill('Synthetic');
      await page.locator('#joinf button').click();
      assert.match(await page.locator('body').innerText(), /four letters/);
      await page.getByLabel('Game code').fill('ABCD');
      await page.getByLabel('First name').fill('Synthetic');
      await page.locator('#joinf button').click();
      await page.getByText(/Could not reach the game|Live games are not switched on/).waitFor();
      assert.ok(await page.locator('#joinf').isVisible(), 'A failed join stays on the join form');
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `${artifacts}/${width}-buzzer-offline.png` });
      results.push({ width, status: 'passed' });
      console.log(`PASS discovery ${width}px: shared-device isolation, refresh, course labels, navigation, buzzer failure`);
    } catch (error) {
      results.push({ width, status: 'failed', error: error.stack });
      console.error(`FAIL discovery ${width}px: ${error.stack}`);
      await page.screenshot({ path: `${artifacts}/${width}-failure.png` }).catch(() => {});
    } finally { await context.close(); }
  }
} finally {
  await writeFile(`${artifacts}/report.json`, JSON.stringify(results, null, 2));
  await browser.close();
  await server.stop();
}
if (results.some(x => x.status === 'failed')) process.exitCode = 1;
