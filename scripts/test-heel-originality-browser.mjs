/**
 * BTS heel project originality / accessibility browser acceptance.
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
  assert.equal((await page.locator('#lab-process-report').inputValue()).trim(), '', 'Opening an empty assignment should not create a fake answer');

  await page.locator('#lab-heel-choices button').filter({ hasText: 'The Iron Sheik' }).click();
  assert.equal(await page.locator('#lab-heel').inputValue(), 'The Iron Sheik');
  await page.locator('#lab-identity').fill('This is my first attempt to distinguish the advertised villain from the actual wrestler who played the character.');
  await page.waitForFunction(() => document.getElementById('lab-process-report').value.includes('WRITING PROCESS RECEIPT'));
  assert.match(await page.locator('#lab-process-report').inputValue(), /WRITING PROCESS RECEIPT/);
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
  assert.match(await page.locator('#lab-process-report').inputValue(), /rejected \(>12 words\): 1/);
  assert.match(await page.locator('#lab-originality-feedback').textContent(), /was not inserted/);

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
  await page.locator('#lab-paste-reason').fill('Work drafted offline in a school-approved editor.');
  await page.locator('[data-lab-tab="3"]').click();
  await paste('#lab-wrestling', largePaste);
  assert.ok((await page.locator('#lab-wrestling').inputValue()).includes(largePaste), 'Transparent accessibility/prior-work override permits an import');
  assert.match(await page.locator('#lab-process-report').inputValue(), /exception imports: 1/);

  await page.locator('[data-lab-tab="1"]').click();
  await page.locator('#lab-initial-hypothesis').fill('I think the boos were shaped by the conflict and uncertainty surrounding the public perception of this character.');
  await page.locator('[data-lab-stamp="1"]').click();
  assert.match(await page.locator('#lab-process-report').inputValue(), /round 1 /);

  page.once('dialog', dialog => dialog.accept());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__deskSave && window.__deskSave.ready);
  await page.waitForFunction(() => document.getElementById('lab-process-report').value.includes('rejected (>12 words): 3'));
  assert.match(await page.locator('#lab-process-report').inputValue(), /rejected \(>12 words\): 3/);
  assert.match(await page.locator('#lab-originality-status').textContent(), /draft stamps: 1\/5/);
  assert.ok(!errors.length, 'No JavaScript errors: ' + errors.join('; '));
  console.log('PASS: original-work counters, limited analysis paste, bibliography exception, documented import, draft stamp and tab-refresh recovery.');
  await context.close();

  // Drive the served student page against the real Turn In code in an isolated
  // Apps Script runtime. Synthetic PINs and work never contact the live service.
  const service = world();
  let offline = false, holdSubmission = false, releaseSubmission;
  const submitted = [];
  const makeDevice = async () => {
    const device = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await device.addInitScript(() => {
      window.__deskSaveTest = { endpoint: 'https://turnin.test/exec', debounceMs: 300, snapshotMs: 300 };
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
    p.on('dialog', dialog => dialog.accept());
    await p.goto(origin + '/hubs/bts-americas-most-hated-research.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.__deskSave?.ready);
    return p;
  };
  const login = async p => {
    const chip = p.locator('#desk-save-chip');
    await chip.locator('.chip').click();
    await chip.locator('input').fill(service.pin(PEOPLE.ada));
    await chip.getByRole('button', { name: 'Save to my account' }).click();
    await p.waitForFunction(() => Boolean(window.__deskSave.state().token));
  };
  const device = await makeDevice();
  const research = await open(device);
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
    await research.locator(`[data-lab-stamp="${round}"]`).click();
  }
  await research.locator('#lab-talk').press('End');
  await research.keyboard.type(' Revised after checking a source.');
  await research.keyboard.press('Backspace');
  await research.waitForTimeout(550);
  assert.equal(await research.locator('#lab-progress').textContent(), '5 / 5');
  const receipt = await research.locator('#lab-process-report').inputValue();
  for (let round = 1; round <= 5; round++) assert.match(receipt, new RegExp('round ' + round + ' '));
  assert.match(receipt, /Printable keyboard presses: [1-9]/);
  assert.match(receipt, /deletion operations: [1-9]/);
  assert.ok(receipt.length < 6000);
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
  assert.match(await research.locator('#lab-originality-status').textContent(), /5\/5/);
  offline = false;
  await research.evaluate(() => window.__deskSave.saveCloud());

  // A fresh device starts blank and recovers only after authentication.
  const secondDevice = await makeDevice();
  const recovered = await open(secondDevice);
  assert.equal(await recovered.locator('#lab-identity').inputValue(), '');
  await login(recovered);
  await recovered.waitForFunction(() => document.getElementById('lab-process-report').value.includes('Previous device/session receipt'));
  assert.equal(await recovered.locator('#lab-identity').inputValue(), prose);
  const recoveredReceipt = await recovered.locator('#lab-process-report').inputValue();
  assert.match(recoveredReceipt, /unusually large non-paste changes: 0/);
  assert.match(recoveredReceipt, /round 5 /);
  assert.match(await recovered.locator('#lab-defense-answer').getAttribute('data-q'), /For The Iron Sheik/);
  await secondDevice.close();

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
  assert.ok(submitted[0].answers.some(a => /WRITING PROCESS RECEIPT/.test(a.a)));
  assert.ok(submitted[0].answers.some(a => /Source defense: For The Iron Sheik/.test(a.q)));
  console.log('PASS: five rounds/checkpoints, hypotheses, dates, keyboard edits, rubric, timer, offline reload, PIN recovery, and server-acknowledged submission (isolated synthetic service).');

  await research.locator('#lab-paste-override').check();
  const chip = research.locator('#desk-save-chip');
  await chip.locator('.chip').click();
  await chip.getByRole('button', { name: 'Not you? Sign out' }).click();
  await research.waitForFunction(() => !window.__deskSave.state().token);
  await research.waitForTimeout(600);
  assert.equal(await research.locator('#lab-process-report').inputValue(), '');
  assert.equal(await research.locator('#lab-paste-override').isChecked(), false);
  assert.match(await research.locator('#lab-originality-status').textContent(), /Pastes tried: 0.*keyboard edits: 0.*draft stamps: 0\/5/);
  assert.equal(await research.locator('#lab-progress').textContent(), '0 / 5');
  await research.reload({ waitUntil: 'load' });
  await research.waitForFunction(() => window.__deskSave?.ready);
  assert.equal(await research.locator('#lab-process-report').inputValue(), '');
  console.log('PASS: shared-device sign-out clears answers, receipt, counters, exception switch, rubric and timer across reload.');

  await mkdir(new URL('../browser-results/heel-research/', import.meta.url), { recursive: true });
  for (const width of [320, 390, 1366]) {
    await research.setViewportSize({ width, height: 768 });
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
