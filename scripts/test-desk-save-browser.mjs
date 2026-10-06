/**
 * the desk · desk-save.js browser suite.
 *
 * Opens the real hub pages from public/ in Chromium and drives them the way a
 * class would: typing, refreshing, sharing a Chromebook, losing WiFi, turning
 * in at the bell. Network calls to Turn In are answered by the real
 * apps-script/turn-in/Code.gs running in the fake Apps Script runtime, with
 * a roster of invented students. Nothing contacts Google.
 *
 *   node scripts/test-desk-save-browser.mjs            full run
 *   node scripts/test-desk-save-browser.mjs --labels   also print every question label
 */

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const { world, crowd, PEOPLE } = require('./lib/turn-in-harness.cjs');

const ROOT = fileURLToPath(new URL('../public/', import.meta.url));
const ENDPOINT = 'https://turnin.test/exec';
const SHOW_LABELS = process.argv.includes('--labels');

/* ---------------------------------------------------------- static server -- */

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const file = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (!file.startsWith(ROOT)) throw new Error('outside');
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const BASE = `http://127.0.0.1:${server.address().port}`;

/* ------------------------------------------------------------- the rig -- */

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let failures = 0;
let passed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`  ✗ ${name}`);
    String(error && error.stack || error).split('\n').slice(0, 8).forEach((line) => console.log(`      ${line}`));
  }
}

/**
 * A Chromebook: one browser context. `server` is the fake Turn In web app,
 * shared between Chromebooks in a test the way the real one is.
 */
async function chromebook(server, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const hooks = options.endpoint === false ? null : { endpoint: ENDPOINT, debounceMs: 300, snapshotMs: 300, ...(options.hooks || {}) };
  if (hooks) await context.addInitScript((h) => { window.__deskSaveTest = h; }, hooks);
  const net = { down: false, flaky: 0, calls: [], delayMs: options.delayMs || 0 };
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.hostname === 'turnin.test') {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors() });
      const body = route.request().postData() || '{}';
      net.calls.push(JSON.parse(body).action);
      if (net.delayMs) await new Promise((r) => setTimeout(r, Math.random() * net.delayMs));
      if (net.down) return route.abort('internetdisconnected');
      if (net.flaky && Math.random() < net.flaky) {
        // Half the flaky failures happen after the server already wrote the row.
        if (Math.random() < 0.5) server.post(body);
        return route.abort('connectionreset');
      }
      const out = server.post(body);
      return route.fulfill({ status: 200, headers: { ...cors(), 'content-type': 'application/json' }, body: JSON.stringify(out) });
    }
    return route.abort('blockedbyclient');
  });
  return { context, net, open: (hub) => openHub(context, hub) };
}

function cors() {
  return { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' };
}

async function openHub(context, hub, page) {
  page = page || await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => { if (String(error.stack || '').includes('desk-save')) errors.push(error); });
  await page.goto(`${BASE}/hubs/${hub}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__deskSave && window.__deskSave.ready, null, { timeout: 10000 });
  page.deskErrors = errors;
  return page;
}

const panel = (page) => page.locator('#desk-save-panel');
const chip = (page) => page.locator('#desk-save-chip');

async function typeInto(page, selector, text) {
  const box = page.locator(selector).first();
  await box.scrollIntoViewIfNeeded();
  await box.click();
  await box.fill('');
  await page.keyboard.type(text, { delay: 2 });
}

async function turnIn(page, pin) {
  await panel(page).locator('input').fill(pin);
  await panel(page).getByRole('button', { name: 'Turn In' }).click();
  await page.waitForFunction(() => {
    const status = document.querySelector('#desk-save-panel').shadowRoot.querySelector('.status');
    return status && status.textContent.trim().length > 0;
  }, null, { timeout: 30000 });
  return (await panel(page).locator('.status').textContent()).trim();
}

async function waitFor(fn, timeout = 8000) {
  const start = Date.now();
  for (;;) {
    if (await fn()) return;
    if (Date.now() - start > timeout) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 100));
  }
}

/* ----------------------------------------------------- every wired hub -- */

const hubs = (await readdir(join(ROOT, 'hubs')))
  .filter((name) => name.endsWith('.html'))
  .filter(async () => true);
const wired = [];
for (const name of hubs) {
  if ((await readFile(join(ROOT, 'hubs', name), 'utf8')).includes('/hubs/desk-save.js')) wired.push(name);
}

await test(`all ${wired.length} wired hubs boot, find their answer boxes and label every question`, async () => {
  const s = world();
  const cb = await chromebook(s);
  const problems = [];
  for (const hub of wired) {
    const page = await cb.open(hub);
    const list = await page.evaluate(() => window.__deskSave.answers());
    const visibleChip = await chip(page).locator('.chip').isVisible();
    if (!list.length) problems.push(`${hub}: no answer boxes found`);
    if (!visibleChip) problems.push(`${hub}: status chip hidden`);
    if (page.deskErrors.length) problems.push(`${hub}: ${page.deskErrors[0].message}`);
    const weak = list.filter((e) => e.q.length < 3 || e.q === e.k);
    if (weak.length) problems.push(`${hub}: weak labels ${weak.map((e) => JSON.stringify(e.q)).join(', ')}`);
    if (SHOW_LABELS) {
      console.log(`\n    ${hub} (${list.length})`);
      list.forEach((e) => console.log(`      ${e.k.padEnd(18)} ${e.q.slice(0, 110)}`));
    }
    await page.close();
  }
  await cb.context.close();
  assert.deepEqual(problems, []);
});

/* ------------------------------------------------------------ behavior -- */

await test('answers survive a refresh in the same tab', async () => {
  const cb = await chromebook(world());
  const page = await cb.open('bts-the-bargain.html');
  await typeInto(page, '#q1', 'He promised three years without fighting back.');
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__deskSave && window.__deskSave.ready);
  assert.equal(await page.locator('#q1').inputValue(), 'He promised three years without fighting back.');
  await cb.context.close();
});

await test('the next student on a shared Chromebook gets a blank page, even on hubs that keep their own copy', async () => {
  const cb = await chromebook(world());
  const first = await cb.open('hh-who-took-the-files.html');
  await typeInto(first, 'textarea[data-q="A1"]', 'Second hour answer that must not leak');
  await first.waitForTimeout(1200);
  const hubOwnCopy = await first.evaluate(() => Object.keys(localStorage).map((k) => localStorage.getItem(k)).join(' '));
  assert.match(hubOwnCopy, /must not leak/, 'this hub keeps its own copy in the browser');
  await first.close();

  const second = await cb.open('hh-who-took-the-files.html');
  assert.equal(await second.locator('textarea[data-q="A1"]').inputValue(), '');
  await second.waitForTimeout(1200);
  const after = await second.evaluate(() => Object.keys(localStorage).map((k) => localStorage.getItem(k)).join(' '));
  assert.doesNotMatch(after, /must not leak/, 'the old copy is overwritten');
  await cb.context.close();
});

await test('Turn In sends every answer with its question and confirms by name', async () => {
  const s = world();
  const cb = await chromebook(s);
  const page = await cb.open('bts-the-bargain.html');
  await typeInto(page, '#q1', 'Three years.');
  await typeInto(page, '#q3', 'He fought back openly.');
  const status = await turnIn(page, s.pin(PEOPLE.ada));
  assert.match(status, /^Turned in, Ada\. Period 1, \d{1,2}:\d{2}/);
  const [row] = s.rows('Turn Ins');
  assert.equal(row['Student Name'], 'Byron, Ada');
  assert.equal(row.Hub, 'bts-the-bargain');
  assert.match(row.Answers, /What did Robinson promise Rickey, and for how long\?\nThree years\./);
  assert.match(row.Answers, /What happened in 1949 once the promise ended\?\nHe fought back openly\./);
  assert.equal(await panel(page).locator('input').inputValue(), '', 'the PIN box is cleared');
  await cb.context.close();
});

await test('the essay prompt a student picked travels with the essay', async () => {
  const s = world();
  const cb = await chromebook(s);
  const page = await cb.open('hh-who-took-the-files.html');
  const prompt2 = page.locator('input[name="prompt"][value="Prompt 2"]');
  await prompt2.evaluate((r) => r.closest('label').scrollIntoView({ block: 'center' }));
  await prompt2.evaluate((r) => r.closest('label').click());
  await typeInto(page, '#essay', 'The Post was right to publish.');
  await turnIn(page, s.pin(PEOPLE.ada));
  const [row] = s.rows('Turn Ins');
  assert.match(row.Answers, /Essay prompt\nPrompt 2 It is 10 PM on March 23, 1971/);
  assert.match(row.Answers, /The Post was right to publish\./);
  await page.close();
  const next = await cb.open('hh-who-took-the-files.html');
  assert.equal(await next.locator('input[name="prompt"]:checked').count(), 0, 'the next student starts with no prompt picked');
  await cb.context.close();
});

await test('signing in on a blank page never wipes saved work', async () => {
  const s = world();
  const pin = s.pin(PEOPLE.ada);
  const saved = s.post({ action: 'signin', pin, hub: 'ush9-the-jungle', device: 'x' });
  s.post({ action: 'save', token: saved.token, hub: 'ush9-the-jungle', answers: [{ k: 'id:renamed', q: 'Old question', a: 'Keep me' }] });
  const cb = await chromebook(s);
  const page = await cb.open('ush9-the-jungle.html');
  await chip(page).locator('.chip').click();
  await chip(page).locator('input').fill(pin);
  await chip(page).getByRole('button', { name: 'Save to my account' }).click();
  await waitFor(async () => /account/.test(await chip(page).locator('.pop .status').textContent()));
  await page.waitForTimeout(800);
  const back = s.post({ action: 'signin', pin, hub: 'ush9-the-jungle', device: 'y' });
  assert.equal(back.draft.answers[0].a, 'Keep me');
  await cb.context.close();
});

await test('a wrong PIN says so and sends nothing', async () => {
  const s = world();
  const cb = await chromebook(s);
  const page = await cb.open('ush9-the-jungle.html');
  await typeInto(page, 'textarea', 'Packing house conditions');
  const wrong = s.pin(PEOPLE.ada) === '123456' ? '654321' : '123456';
  const status = await turnIn(page, wrong);
  assert.match(status, /did not match/);
  assert.equal(s.rows('Turn Ins').length, 0);
  assert.equal(await page.locator('textarea').first().inputValue(), 'Packing house conditions');
  await cb.context.close();
});

await test('a student in two classes picks one, then turns in', async () => {
  const s = world();
  const cb = await chromebook(s);
  const page = await cb.open('hh-room-1018a.html');
  await typeInto(page, 'textarea', 'Room 1018A answer');
  const status = await turnIn(page, s.pin(PEOPLE.alan));
  assert.match(status, /Which class/);
  await panel(page).getByRole('button', { name: 'Period 5' }).click();
  const done = await turnIn(page, s.pin(PEOPLE.alan));
  assert.match(done, /Turned in, Alan\. Period 5/);
  assert.equal(s.rows('Turn Ins').length, 1);
  await cb.context.close();
});

await test('lost WiFi keeps the answers on screen, and the retry lands exactly once', async () => {
  const s = world();
  const cb = await chromebook(s);
  const page = await cb.open('hh-follow-the-money.html');
  await typeInto(page, 'textarea', 'Follow the money answer');
  cb.net.down = true;
  const failed = await turnIn(page, s.pin(PEOPLE.grace));
  assert.match(failed, /go through/);
  assert.equal(await page.locator('textarea').first().inputValue(), 'Follow the money answer');
  cb.net.down = false;
  const ok = await turnIn(page, s.pin(PEOPLE.grace));
  assert.match(ok, /Turned in, Grace/);
  assert.equal(s.rows('Turn Ins').length, 1);
  await cb.context.close();
});

await test('work saved with a PIN comes back on a different Chromebook', async () => {
  const s = world();
  const first = await chromebook(s);
  const page = await first.open('ush9-the-other-half.html');
  await chip(page).locator('.chip').click();
  await chip(page).locator('input').fill(s.pin(PEOPLE.grace));
  await chip(page).getByRole('button', { name: 'Save to my account' }).click();
  await waitFor(async () => /account/.test(await chip(page).locator('.pop .status').textContent()));
  await typeInto(page, 'textarea', 'Riis photographed tenements in 1890.');
  await waitFor(async () => s.rows('Drafts').some((r) => /tenements in 1890/.test(r.Data))).catch(async (e) => {
    console.log('      calls', first.net.calls, 'drafts', s.rows('Drafts').length, await page.evaluate(() => JSON.stringify(window.__deskSave.state()).slice(0, 400)));
    throw e;
  });
  await first.context.close();

  const second = await chromebook(s);
  const again = await second.open('ush9-the-other-half.html');
  assert.equal(await again.locator('textarea').first().inputValue(), '');
  await chip(again).locator('.chip').click();
  await chip(again).locator('input').fill(s.pin(PEOPLE.grace));
  await chip(again).getByRole('button', { name: 'Save to my account' }).click();
  await waitFor(async () => /brought back/.test(await chip(again).locator('.pop .status').textContent())).catch(async (e) => {
    console.log('      status:', await chip(again).locator('.pop .status').textContent(), second.net.calls);
    throw e;
  });
  assert.equal(await again.locator('textarea').first().inputValue(), 'Riis photographed tenements in 1890.');
  await second.context.close();
});

await test('a signed in tab left alone signs out and blanks itself after its work is saved', async () => {
  const s = world();
  const cb = await chromebook(s, { hooks: { idleMs: 2500 } });
  const page = await cb.open('hh-burn-the-files.html');
  await chip(page).locator('.chip').click();
  await chip(page).locator('input').fill(s.pin(PEOPLE.ada));
  await chip(page).getByRole('button', { name: 'Save to my account' }).click();
  await waitFor(async () => /account/.test(await chip(page).locator('.pop .status').textContent()));
  await typeInto(page, 'textarea', 'Burned files answer');
  await waitFor(async () => (await page.locator('textarea').first().inputValue()) === '', 12000);
  assert.ok(s.rows('Drafts').some((r) => /Burned files answer/.test(r.Data)), 'saved before blanking');
  assert.match(await chip(page).locator('.pop .status').textContent(), /Signed out after 20 quiet minutes/);
  await cb.context.close();
});

await test('leaving with answers that were never turned in or copied asks first', async () => {
  const s = world();
  const cb = await chromebook(s);
  const page = await cb.open('bts-the-scouting-report.html');
  await typeInto(page, 'textarea', 'Scouting answer');
  let asked = false;
  page.once('dialog', async (dialog) => { asked = dialog.type() === 'beforeunload'; await dialog.dismiss(); });
  await page.close({ runBeforeUnload: true });
  await waitFor(async () => asked, 4000);

  const page2 = await cb.open('bts-the-scouting-report.html');
  await typeInto(page2, 'textarea', 'Scouting answer');
  await turnIn(page2, s.pin(PEOPLE.ada));
  let askedAgain = false;
  page2.on('dialog', async (dialog) => { askedAgain = true; await dialog.accept(); });
  await page2.close({ runBeforeUnload: true });
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(askedAgain, false, 'no warning once turned in');
  await cb.context.close();
});

await test('with no Turn In address set, the page still saves in the tab and offers Copy', async () => {
  const cb = await chromebook(world(), { endpoint: false });
  const page = await cb.open('bts-the-bargain.html');
  assert.equal(await panel(page).locator('h2').textContent(), 'Before you leave');
  assert.equal(await panel(page).locator('input').count(), 0);
  assert.equal(await chip(page).locator('.chip').textContent(), 'Saved in this tab');
  await cb.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await typeInto(page, '#q1', 'Copy me');
  await panel(page).getByRole('button', { name: 'Copy my answers' }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(copied, /What did Robinson promise Rickey, and for how long\?\nCopy me/);
  await cb.context.close();
});

await test('35 students turning in at the bell on a flaky network: every one lands exactly once', async () => {
  const people = crowd(35);
  const s = world({ memberships: people });
  const pages = [];
  for (let i = 0; i < people.length; i += 1) {
    const cb = await chromebook(s, { delayMs: 900 });
    cb.net.flaky = 0.2;
    const page = await cb.open('ush9-the-paper-trail.html');
    await page.locator('textarea').first().fill(`Answer from student ${i + 1}`);
    await page.locator('textarea').first().dispatchEvent('input');
    pages.push({ cb, page, pin: s.school.pin(people[i][0]) });
  }
  const results = await Promise.all(pages.map(async ({ page, pin }) => {
    let status = await turnIn(page, pin);
    for (let tries = 0; tries < 4 && !/^Turned in/.test(status); tries += 1) status = await turnIn(page, pin);
    return status;
  }));
  results.forEach((status, i) => assert.match(status, /^Turned in, Number\d\d/, `student ${i + 1}: ${status}`));
  const rows = s.rows('Turn Ins');
  assert.equal(rows.length, 35, `${rows.length} rows`);
  assert.equal(new Set(rows.map((r) => r['Student Email'])).size, 35);
  for (const { cb } of pages) await cb.context.close();
});

await browser.close();
server.close();
console.log(`${failures ? 'FAIL' : 'PASS'}  desk-save browser  (${passed}/${passed + failures})`);
if (failures) process.exit(1);
