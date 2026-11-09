/**
 * BTS heel project writing accessibility and save/submit browser acceptance.
 * Tests only synthetic work. No private roster, Google endpoint or real student PIN.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const require = createRequire(import.meta.url);
const { world, PEOPLE } = require('./lib/turn-in-harness.cjs');

const root = fileURLToPath(new URL('../public/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const full = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!full.startsWith(root)) throw Error('Outside root');
    const f = await stat(full);
    if (!f.isFile()) throw Error('Not a file');
    res.writeHead(200, { 'content-type': types[extname(full)] || 'application/octet-stream' });
    res.end(await readFile(full));
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});

let browser;
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = process.env.HEEL_TEST_ORIGIN || 'http://127.0.0.1:' + server.address().port;
try {
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    window.__deskSaveTest = { endpoint: '', debounceMs: 300, snapshotMs: 300 };
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  await context.route('**/*', route => {
    if (route.request().url().startsWith(origin + '/')) return route.continue();
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(origin + '/hubs/bts-americas-most-hated-research.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__deskSave && window.__deskSave.ready);
  assert.equal(await page.locator('#lab-round-1').isVisible(), true);
  assert.equal(await page.locator('#lab-round-2').isVisible(), false);
  assert.equal(await page.locator('#lab-heel-choices button').count(), 15);
  assert.equal(await page.locator('#lab-process-report').count(), 0, 'Process receipts must not exist');
  assert.equal(await page.locator('[data-lab-stamp]').count(), 0, 'Confusing draft stamps were removed');

  await page.locator('#lab-heel-choices button').filter({ hasText: 'The Iron Sheik' }).click();
  assert.equal(await page.locator('#lab-heel').inputValue(), 'The Iron Sheik');
  await page.locator('#lab-identity').fill('This is my first attempt to distinguish the advertised villain from the actual wrestler who played the character.');
  assert.equal(await page.locator('#lab-identity').getAttribute('spellcheck'), 'true');
  assert.equal(await page.locator('#lab-identity').getAttribute('autocapitalize'), 'sentences');
  assert.ok(!errors.length, 'No JavaScript errors when entering an original answer: ' + errors.join('; '));

  async function paste(selector, text) {
    await page.evaluate(async content => { await navigator.clipboard.writeText(content); }, text);
    await page.locator(selector).focus();
    await page.keyboard.press('Control+V');
  }
  const largePaste = 'This copied paragraph contains more than twelve words and should not enter the student original reasoning field without an allowed exception in this research lab.';
  const before = await page.locator('#lab-identity').inputValue();
  await paste('#lab-identity', largePaste);
  assert.equal(await page.locator('#lab-identity').inputValue(), before, 'Large prose paste must be prevented by default');
  assert.match(await page.locator('#lab-paste-feedback').textContent(), /not pasted/);

  const shortPaste = 'A short quoted phrase';
  await paste('#lab-identity', shortPaste);
  assert.ok((await page.locator('#lab-identity').inputValue()).includes(shortPaste), 'Short prose paste permitted');
  const twelveWords = 'one two three four five six seven eight nine ten eleven twelve';
  await paste('#lab-identity', twelveWords);
  assert.ok((await page.locator('#lab-identity').inputValue()).includes(twelveWords), 'Exactly 12 words permitted');
  const afterTwelve = await page.locator('#lab-identity').inputValue();
  await paste('#lab-identity', twelveWords + ' thirteen');
  assert.equal(await page.locator('#lab-identity').inputValue(), afterTwelve, '13 words prevented');

  await page.locator('[data-lab-tab="4"]').click();
  await paste('#lab-source-one', largePaste);
  assert.ok((await page.locator('#lab-source-one').inputValue()).includes(largePaste), 'Citation entry can be pasted accurately');
  const claimBefore = await page.locator('#lab-source-one-claim').inputValue();
  await paste('#lab-source-one-claim', largePaste);
  assert.equal(await page.locator('#lab-source-one-claim').inputValue(), claimBefore, 'Original source analysis obeys the paste rule');

  await page.locator('#lab-paste-override').check();
  await page.locator('[data-lab-tab="3"]').click();
  await paste('#lab-wrestling', largePaste);
  assert.ok((await page.locator('#lab-wrestling').inputValue()).includes(largePaste), 'Transparent accessibility/prior-work override permits an import');
  assert.equal(await page.locator('#lab-process-report').count(), 0, 'No hidden writing history is generated');

  await page.locator('[data-lab-tab="1"]').click();
  await page.locator('#lab-initial-hypothesis').fill('I think the boos were shaped by the conflict and uncertainty surrounding the public perception of this character.');
  await page.locator('#lab-character-clue').fill('');
  await page.locator('#lab-character-clue').focus();
  await page.keyboard.type('hello. world');
  assert.equal(await page.locator('#lab-character-clue').inputValue(), 'Hello. World', 'Capitalize typed sentence beginnings on Chromebook keyboard');
  const toolbox = page.locator('#lab-character-clue').locator('..');
  assert.match(await toolbox.locator('.lab-word-count').textContent(), /2 words/);
  await toolbox.locator('.lab-editor-expand').click();
  assert.equal(await toolbox.evaluate(el => el.classList.contains('lab-editor-expanded')), true);
  await page.keyboard.press('Escape');
  assert.equal(await toolbox.evaluate(el => el.classList.contains('lab-editor-expanded')), false);
  await toolbox.locator('.lab-editor-button[aria-pressed]').click();
  assert.equal(await toolbox.locator('.lab-editor-button[aria-pressed]').getAttribute('aria-pressed'), 'false');
  await page.locator('#lab-character-clue').fill('');
  await page.locator('#lab-character-clue').focus();
  await page.keyboard.type('lowercase');
  assert.equal(await page.locator('#lab-character-clue').inputValue(), 'lowercase', 'Auto-caps can be turned off');
  page.once('dialog', dialog => dialog.accept());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__deskSave && window.__deskSave.ready);
  assert.equal(await page.locator('#lab-process-report').count(), 0);
  assert.ok(!errors.length, 'No JavaScript errors: ' + errors.join('; '));
  console.log('PASS: native spellcheck, sentence caps, toggle, word count, expanded writing, paste guard and accessibility override.');
  await context.close();

  // Drive the served student page against the real Turn In code in an isolated
  // Apps Script runtime. Synthetic PINs and work never contact the live service.
  const service = world();
  let offline = false, holdSubmission = false, releaseSubmission, acceptRecovery = true;
  const submitted = [];
  const makeDevice = async () => {
    const device = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await device.addInitScript(() => {
      window.__deskSaveTest = { endpoint: 'https://turnin.test/exec', debounceMs: 300, snapshotMs: 300, gate: false };
    });
    await device.route('**/*', async route => {
      const request = route.request();
      if (request.url().startsWith(origin + '/')) return route.continue();
      if (request.url().startsWith('https://turnin.test/')) {
        if (offline) return route.abort('internetdisconnected');
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
        const body = JSON.parse(request.postData());
        if (body.action === 'turnin') {
          submitted.push(body);
          if (holdSubmission) await new Promise(resolve => { releaseSubmission = resolve; });
        }
        return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify(service.post(body)) });
      }
      return route.abort('blockedbyclient');
    });
    return device;
  };
  const open = async device => {
    const p = await device.newPage();
    p.on('pageerror', error => errors.push(String(error)));
    p.on('dialog', dialog => dialog.type() === 'confirm' && !acceptRecovery ? dialog.dismiss() : dialog.accept());
    await p.goto(origin + '/hubs/bts-americas-most-hated-research.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.__deskSave?.ready);
    return p;
  };
  const login = async p => {
    const resume = p.locator('#desk-save-resume');
    await resume.locator('input').fill(service.pin(PEOPLE.ada));
    await resume.getByRole('button', { name: 'Load My Work', exact: true }).click();
    await p.waitForFunction(() => Boolean(window.__deskSave.state().token));
  };
  const device = await makeDevice();
  const research = await open(device);
  const resume = research.locator('#desk-save-resume');
  assert.equal(await research.getByRole('link', { name: 'Load My Work', exact: true }).first().getAttribute('href'), '#load-work');
  await resume.locator('input').fill('12');
  await resume.getByRole('button', { name: 'Load My Work', exact: true }).click();
  assert.match(await resume.locator('.status').textContent(), /six digit/);
  assert.equal(await research.evaluate(() => Boolean(window.__deskSave.state().token)), false);
  await login(research);
  await research.locator('#lab-heel-choices button').filter({ hasText: 'The Iron Sheik' }).click();
  const prose = 'Synthetic research draft for browser verification only. The interpretation separates a character from a person and checks the historical record before making a claim about audiences, promotion, chronology, prejudice, and evidence.';
  for (let round = 1; round <= 5; round++) {
    await research.locator(`[data-lab-tab="${round}"]`).click();
    for (const box of await research.locator(`#lab-round-${round} textarea`).all()) await box.fill(prose);
    if (round === 2) {
      await research.locator('#lab-event-date').fill('1979-11-04');
      await research.locator('#lab-character-date').fill('1972');
      await research.locator('#lab-match-date').fill('1984-01-23');
      await research.locator('#lab-compare').click();
      assert.match(await research.locator('#lab-date-feedback').textContent(), /before the historical event/);
      await research.locator('#lab-event-date').fill('1979-02-30');
      await research.locator('#lab-compare').click();
      assert.match(await research.locator('#lab-date-feedback').textContent(), /supported year/);
      await research.locator('#lab-event-date').fill('1979-11-04');
    }
  }
  await research.locator('#lab-talk').press('End');
  await research.keyboard.type(' Revised after checking a source.');
  await research.keyboard.press('Backspace');
  await research.waitForTimeout(550);
  assert.equal(await research.locator('#lab-progress').textContent(), '5 / 5');
  assert.equal(await research.locator('#lab-process-report').count(), 0);
  assert.equal(await research.locator('[data-lab-stamp]').count(), 0);
  assert.equal(await research.locator('#lab-identity').getAttribute('spellcheck'), 'true');
  await research.locator('#lab-timer-start').click();
  await research.waitForTimeout(1100);
  await research.locator('#lab-timer-stop').click();
  assert.notEqual(await research.locator('#lab-clock').textContent(), '0:00');
  await research.locator('#lab-timer-reset').click();
  assert.equal(await research.locator('#lab-clock').textContent(), '0:00');
  for (let n = 1; n <= 9; n++) await research.locator(`input[name="lab_check_${n}"][value="Yes"]`).check();
  assert.match(await research.locator('#lab-score-count').textContent(), /100 of 100/);
  await research.waitForFunction(() => Boolean(window.__deskSave.state().cloudHash));

  offline = true;
  await research.locator('#lab-talk').fill(prose + ' Offline revision preserved.');
  await research.reload({ waitUntil: 'load' });
  await research.waitForFunction(() => window.__deskSave?.ready);
  await research.locator('[data-lab-tab="5"]').click();
  assert.match(await research.locator('#lab-talk').inputValue(), /Offline revision preserved/);
  assert.equal(await research.locator('#lab-paste-override').isChecked(), false);
  offline = false;
  await research.evaluate(() => window.__deskSave.saveCloud());
  await research.waitForFunction(() => window.__deskSave.state().cloudHash.includes('Offline revision preserved.'));
  await resume.getByRole('button', { name: 'Save now', exact: true }).click();
  await research.waitForFunction(() => /Account save confirmed/.test(document.querySelector('#desk-save-resume').shadowRoot.querySelector('.status').textContent));

  // A fresh device starts blank and recovers only after authentication.
  const secondDevice = await makeDevice();
  const recovered = await open(secondDevice);
  assert.equal(await recovered.locator('#lab-identity').inputValue(), '');
  const homeResume = recovered.locator('#desk-save-resume');
  const load = homeResume.getByRole('button', { name: 'Load My Work', exact: true });
  await recovered.locator('#lab-identity').fill('Keep this unsaved answer unless I approve loading the account copy.');
  await recovered.locator('[data-lab-tab="5"]').click();
  await recovered.locator('input[name="lab_check_1"][value="Not yet"]').check();
  offline = true;
  await homeResume.locator('input').fill(service.pin(PEOPLE.ada));
  await load.click();
  await recovered.waitForFunction(() => /Could not reach/.test(document.querySelector('#desk-save-resume').shadowRoot.querySelector('.status').textContent));
  assert.equal(await recovered.locator('#lab-identity').inputValue(), 'Keep this unsaved answer unless I approve loading the account copy.');
  assert.equal(await load.isEnabled(), true);
  offline = false;
  acceptRecovery = false;
  await homeResume.locator('input').fill(service.pin(PEOPLE.ada));
  await load.click();
  await recovered.waitForFunction(() => /cancelled/.test(document.querySelector('#desk-save-resume').shadowRoot.querySelector('.status').textContent));
  assert.equal(await recovered.evaluate(() => Boolean(window.__deskSave.state().token)), false);
  assert.equal(await recovered.locator('#lab-identity').inputValue(), 'Keep this unsaved answer unless I approve loading the account copy.');
  acceptRecovery = true;
  await login(recovered);
  await recovered.waitForFunction(expected => document.getElementById('lab-identity').value === expected, prose);
  assert.equal(await recovered.locator('#lab-identity').inputValue(), prose);
  assert.equal(await recovered.locator('#lab-process-report').count(), 0);
  assert.match(await recovered.locator('#lab-talk').inputValue(), /Offline revision preserved/);
  assert.equal(await recovered.locator('#lab-heel').inputValue(), 'The Iron Sheik');
  assert.equal(await recovered.locator('#lab-event-date').inputValue(), '1979-11-04');
  assert.equal(await recovered.locator('#lab-progress').textContent(), '5 / 5');
  assert.match(await recovered.locator('#lab-score-count').textContent(), /100 of 100/);
  assert.equal(await homeResume.locator('input').inputValue(), '', 'PIN cleared after loading');
  assert.match(await recovered.locator('#lab-defense-answer').getAttribute('data-q'), /For The Iron Sheik/);
  await secondDevice.close();
  console.log('PASS: visible Load My Work, PIN validation, confirmed Save now, offline failure preserves work, cancelled/accepted replacement, and all five rounds plus rubric recover on a fresh device.');

  // A submission stays unconfirmed until the server acknowledges its write.
  holdSubmission = true;
  const panel = research.locator('#desk-save-panel');
  await panel.locator('input').fill(service.pin(PEOPLE.ada));
  await panel.getByRole('button', { name: 'Turn In', exact: true }).click();
  await research.waitForFunction(() => document.querySelector('#desk-save-panel').shadowRoot.querySelector('.primary').disabled);
  assert.equal(service.rows('Turn Ins').length, 0);
  assert.doesNotMatch(await panel.locator('.status').textContent(), /Turned in/);
  while (!releaseSubmission) await research.waitForTimeout(30);
  releaseSubmission();
  await research.waitForFunction(() => Boolean(window.__deskSave.state().turnedInAt));
  assert.equal(service.rows('Turn Ins').length, 1);
  assert.ok(!submitted[0].answers.some(a => /WRITING PROCESS RECEIPT/.test(a.a)), 'No typing history is sent to the teacher');
  assert.ok(submitted[0].answers.some(a => /Source defense: For The Iron Sheik/.test(a.q)));
  console.log('PASS: five rounds, hypotheses, dates, rubric, timer, offline reload, PIN recovery and server-acknowledged submission (isolated synthetic service).');

  await research.locator('#lab-paste-override').check();
  const chip = research.locator('#desk-save-chip');
  await chip.locator('.chip').click();
  await chip.getByRole('button', { name: 'Not you? Sign out' }).click();
  await research.waitForFunction(() => !window.__deskSave.state().token);
  await research.waitForTimeout(600);
  assert.equal(await research.locator('#lab-process-report').count(), 0);
  assert.equal(await research.locator('#lab-paste-override').isChecked(), false);
  assert.equal(await research.locator('#lab-character-clue').getAttribute('autocapitalize'), 'sentences');
  assert.equal(await research.locator('#lab-progress').textContent(), '0 / 5');
  await research.reload({ waitUntil: 'load' });
  await research.waitForFunction(() => window.__deskSave?.ready);
  assert.equal(await research.locator('#lab-process-report').count(), 0);
  console.log('PASS: shared-device sign-out clears answers, paste option, editor settings, rubric and timer across reload.');

  await mkdir(new URL('../browser-results/heel-research/', import.meta.url), { recursive: true });
  for (const width of [320, 390, 1366]) {
    await research.setViewportSize({ width, height: 768 });
    await research.locator('#load-work').scrollIntoViewIfNeeded();
    const resumeAudit = await new AxeBuilder({ page: research }).include('#load-work').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    assert.deepEqual(resumeAudit.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), [], `Accessible recovery at ${width}px`);
    assert.ok(await research.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Recovery fits ${width}px`);
    await research.screenshot({ path: fileURLToPath(new URL(`../browser-results/heel-research/load-${width}.png`, import.meta.url)) });
    for (let round = 1; round <= 5; round++) {
      await research.locator(`[data-lab-tab="${round}"]`).click();
      assert.ok(await research.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No overflow at ${width}px round ${round}`);
      if (round === 1) await research.locator('a.lab-action--light[href="#card"]').hover();
      const audit = await new AxeBuilder({ page: research }).include('#lab').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      assert.deepEqual(audit.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), [], `Accessible lab at ${width}px round ${round}`);
    }
    await research.locator('[data-lab-tab="1"]').click();
    await research.locator('#lab').scrollIntoViewIfNeeded();
    await research.screenshot({ path: fileURLToPath(new URL(`../browser-results/heel-research/${width}.png`, import.meta.url)) });
  }
  await research.emulateMedia({ reducedMotion: 'reduce' });
  await research.locator('[data-lab-tab="2"]').focus();
  await research.keyboard.press('Enter');
  assert.equal(await research.locator('#lab-round-2').isVisible(), true);
  assert.deepEqual(errors, []);
  console.log('PASS: all five lab rounds at 320, 390 and Chromebook 1366px; WCAG A/AA, keyboard navigation and reduced motion. Origin: ' + origin);
  await device.close();
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
