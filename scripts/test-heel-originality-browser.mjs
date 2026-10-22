/**
 * BTS heel project originality / accessibility browser acceptance.
 * Tests only synthetic work. No private roster, Google endpoint or real student PIN.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

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
const origin = 'http://127.0.0.1:' + server.address().port;
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

  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__deskSave && window.__deskSave.ready);
  assert.match(await page.locator('#lab-process-report').inputValue(), /rejected \(>12 words\): 2/);
  assert.match(await page.locator('#lab-originality-status').textContent(), /draft stamps: 1\/5/);
  assert.ok(!errors.length, 'No JavaScript errors: ' + errors.join('; '));
  console.log('PASS: original-work counters, limited analysis paste, bibliography exception, documented import, draft stamp and tab-refresh recovery.');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
