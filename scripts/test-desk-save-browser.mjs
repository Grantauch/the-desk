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
import { readFile, readdir, stat, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

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
  if (process.env.DESK_SAVE_TEST_FILTER && !name.includes(process.env.DESK_SAVE_TEST_FILTER)) return;
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
  // The PIN gate is off unless a test turns it on, so the older tests can keep
  // driving the tab-only and optional sign in paths that still exist behind it.
  const hooks = { endpoint: options.endpoint === false ? '' : ENDPOINT, debounceMs: 300, snapshotMs: 300, gate: false, ...(options.hooks || {}) };
  await context.addInitScript((h) => { window.__deskSaveTest = h; }, hooks);
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
  try {
    await page.waitForFunction(() => window.__deskSave && window.__deskSave.ready, null, { timeout: 10000 });
  } catch (error) { throw new Error(`${hub}: shared work runtime did not start (${errors.map(e => e.message).join('; ')})`, { cause: error }); }
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
  await panel(page).locator('input[type="password"]').fill(pin);
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

await test('golf is readable at 320, 390 and desktop widths with decoded historical images and accessible controls', async () => {
  const cb = await chromebook(world());
  const page = await cb.open('bts-golf-special-edition.html');
  await page.evaluate(async () => {
    const images = [...document.images];
    images.forEach(img => { img.loading = 'eager'; });
    await Promise.all(images.map(img => img.decode()));
  });
  await mkdir('browser-results/golf', { recursive: true });
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No horizontal overflow at ${width}`);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    assert.deepEqual(result.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), [], `Golf accessibility at ${width}`);
    await page.screenshot({ path: `browser-results/golf/cover-${width}.png` });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto');
  await page.locator('#hole-9').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'browser-results/golf/ouimet-desktop.png' });
  await cb.context.close();
});

await test('golf resumes notes, card, settings, run records and draft on a different Chromebook', async () => {
  const s = world();
  const first = await chromebook(s);
  const page = await first.open('bts-golf-special-edition.html');
  const resume = page.locator('#desk-save-resume');
  await resume.locator('input[type="password"]').fill(s.pin(PEOPLE.ada));
  await resume.getByRole('button', { name: 'Load My Work' }).click();
  await page.waitForFunction(() => document.querySelector('#desk-save-resume').getAttribute('data-signed-in') === 'true');
  await page.locator('#make-card').click();
  await page.locator('#note-01').fill('The ban proves people knew the game, not that the government invented it.');
  await page.locator('#first-claim').fill('My starting claim concerns rules and access.');
  await page.locator('#eq-ball').selectOption('guttie');
  await page.locator('[data-run="equipment"]').click();
  await page.locator('#eq-ball').selectOption('wound');
  await page.locator('[data-run="equipment"]').click();
  const before = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('textarea')].map(el => [el.id, el.value])));
  assert.match(before['log-equipment'], /Run 2/);
  await resume.getByRole('button', { name: 'Save now', exact: true }).click();
  await waitFor(() => s.rows('Progress').some(r => /Run 2/.test(r.Answers)));
  assert.equal(s.rows('Turn Ins').length, 0, 'saving progress does not declare completion');
  await first.context.close();
  const second = await chromebook(s);
  const home = await second.open('bts-golf-special-edition.html');
  assert.equal(await home.locator('#assignment-card').inputValue(), '', 'fresh device has no assigned card before recovery');
  await home.locator('#desk-save-resume').locator('input[type="password"]').fill(s.pin(PEOPLE.ada));
  await home.locator('#desk-save-resume').getByRole('button', { name: 'Load My Work' }).click();
  await home.waitForFunction(() => document.querySelector('#log-equipment').value.includes('Run 2'));
  const after = await home.evaluate(() => Object.fromEntries([...document.querySelectorAll('textarea')].map(el => [el.id, el.value])));
  assert.deepEqual(after, before, 'all work fields return, including readonly activity evidence');
  await waitFor(async () => (await home.locator('#eq-ball').inputValue()) === 'wound');
  await home.locator('[data-run="equipment"]').click();
  assert.match(await home.locator('#log-equipment').inputValue(), /Run 3/, 'record numbering continues after recovery');
  assert.match(await turnIn(home, s.pin(PEOPLE.ada)), /Turned in/);
  assert.match(s.rows('Turn Ins')[0].Answers, /Run 3/);
  await second.context.close();
});

await test('golf access requires participation, caps travel help, and clears lab controls between students', async () => {
  const s = world();
  const cb = await chromebook(s);
  const page = await cb.open('bts-golf-special-edition.html');
  const resume = page.locator('#desk-save-resume');
  const signIn = async () => {
    await resume.locator('input[type="password"]').fill(s.pin(PEOPLE.ada));
    await resume.getByRole('button', { name: 'Load My Work' }).click();
    await page.waitForFunction(() => document.querySelector('#desk-save-resume').getAttribute('data-signed-in') === 'true');
  };
  await signIn();
  await page.locator('#make-card').click();
  const card = (await page.locator('#assignment-card').inputValue()).match(/^Card ([ABCD])/)[1];
  const budget = { A: [45, 8], B: [60, 7], C: [50, 10], D: [70, 9] }[card];
  const setRange = (id, value) => page.locator('#' + id).evaluate((el, val) => {
    el.value = String(val); el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  for (const id of ['ac-rounds', 'ac-lessons', 'ac-practice']) await setRange(id, 0);
  await page.locator('#ac-grant').selectOption('10');
  await page.locator('[data-run="access"]').click();
  assert.match(await page.locator('#log-access').inputValue(), /grant used 0;.*no participation/);
  await setRange('ac-rounds', 1);
  await page.locator('[data-run="access"]').click();
  assert.match(await page.locator('#log-access').inputValue(), new RegExp(`grant used 4;.*money remaining ${budget[0] - 18}; hours remaining ${budget[1] - 5}; feasible`));
  await page.locator('#eq-ball').selectOption('guttie');
  await setRange('wa-turf', 50);
  await page.locator('#wa-grass').selectOption('1');
  await page.locator('[data-run="water"]').click();
  assert.match(await page.locator('#log-water').inputValue(), /water 45.*cost 100.*playability 85; within both limits/);
  await resume.getByRole('button', { name: 'Save now', exact: true }).click();
  await waitFor(() => s.rows('Progress').some(r => /no participation/.test(r.Answers)));
  await waitFor(async () => /Account save confirmed/.test(await resume.locator('.sub').textContent()));
  await chip(page).locator('.chip').click();
  await chip(page).getByRole('button', { name: 'Not you? Sign out' }).click();
  try {
    await page.waitForFunction(() => !document.querySelector('#assignment-card').value && document.querySelector('#eq-ball').value === 'featherie' && document.querySelector('#wa-turf').value === '10');
  } catch (error) {
    // Report what the page shows so a CI-only failure can be diagnosed.
    const seen = await page.evaluate(() => ({
      card: document.querySelector('#assignment-card').value.slice(0, 40),
      ball: document.querySelector('#eq-ball').value,
      turf: document.querySelector('#wa-turf').value,
      signedIn: document.querySelector('#desk-save-resume')?.getAttribute('data-signed-in'),
      chip: (document.querySelector('#desk-save-chip')?.shadowRoot || document.querySelector('#desk-save-chip'))?.textContent?.replace(/\s+/g, ' ').slice(0, 300),
      resume: (document.querySelector('#desk-save-resume')?.shadowRoot || document.querySelector('#desk-save-resume'))?.textContent?.replace(/\s+/g, ' ').slice(0, 300),
    }));
    console.log('    golf sign-out diagnostic:', JSON.stringify(seen), 'calls:', cb.net.calls.slice(-8).join(','));
    throw error;
  }
  assert.equal(await page.locator('#log-access').inputValue(), '');
  await signIn();
  await page.waitForFunction(() => document.querySelector('#eq-ball').value === 'guttie' && document.querySelector('#wa-turf').value === '50');
  assert.match(await page.locator('#log-access').inputValue(), /no participation/);
  await cb.context.close();
});

await test('golf cloud cadence saves continuous edits within thirty seconds and never acknowledges offline work', async () => {
  const s = world();
  const cb = await chromebook(s, { hooks: { debounceMs: 15000 } });
  const page = await cb.context.newPage();
  await page.clock.install();
  await openHub(cb.context, 'bts-golf-special-edition.html', page);
  const resume = page.locator('#desk-save-resume');
  await resume.locator('input[type="password"]').fill(s.pin(PEOPLE.ada));
  await resume.getByRole('button', { name: 'Load My Work' }).click();
  await page.waitForFunction(() => document.querySelector('#desk-save-resume').getAttribute('data-signed-in') === 'true');
  for (let i = 0; i < 7; i++) {
    await page.locator('#note-01').fill('Still typing ' + i);
    await page.clock.fastForward(5000);
  }
  await waitFor(() => s.rows('Progress').some(r => /Still typing/.test(r.Answers)));
  cb.net.down = true;
  await page.locator('#note-01').fill('Newest offline edit');
  await resume.getByRole('button', { name: 'Save now', exact: true }).click();
  await page.clock.fastForward(20000);
  await page.waitForTimeout(100);
  assert.doesNotMatch(s.rows('Progress')[0].Answers, /Newest offline edit/);
  assert.equal(await page.locator('#note-01').inputValue(), 'Newest offline edit');
  assert.doesNotMatch(await resume.locator('.sub').textContent(), /Account save confirmed/);
  cb.net.down = false;
  await page.clock.fastForward(65000);
  await waitFor(() => /Newest offline edit/.test(s.rows('Progress')[0].Answers));
  assert.equal(s.rows('Turn Ins').length, 0);
  await cb.context.close();
});

await test('returning to an older golf tab can recover the latest home copy with an explicit conflict choice', async () => {
  const s = world();
  const school = await chromebook(s);
  const old = await school.open('bts-golf-special-edition.html');
  const sign = async page => {
    const resume = page.locator('#desk-save-resume');
    await resume.locator('input[type="password"]').fill(s.pin(PEOPLE.ada));
    await resume.getByRole('button', { name: 'Load My Work' }).click();
  };
  await sign(old);
  await old.waitForFunction(() => document.querySelector('#desk-save-resume').getAttribute('data-signed-in') === 'true');
  await old.locator('#note-01').fill('Earlier school version');
  await old.locator('#desk-save-resume').getByRole('button', { name: 'Save now', exact: true }).click();
  await waitFor(() => s.rows('Progress').some(r => /Earlier school/.test(r.Answers)));
  const home = await chromebook(s);
  const newer = await home.open('bts-golf-special-edition.html');
  await sign(newer);
  await newer.waitForFunction(() => document.querySelector('#note-01').value === 'Earlier school version');
  await newer.locator('#note-01').fill('Later home version');
  await newer.locator('#desk-save-resume').getByRole('button', { name: 'Save now', exact: true }).click();
  await waitFor(() => /Later home/.test(s.rows('Progress')[0].Answers));
  old.once('dialog', dialog => dialog.dismiss());
  await sign(old);
  await waitFor(async () => /cancelled/.test(await old.locator('#desk-save-resume').locator('.status').textContent()));
  assert.equal(await old.locator('#note-01').inputValue(), 'Earlier school version');
  assert.match(s.rows('Progress')[0].Answers, /Later home version/, 'cancelling recovery does not overwrite the account copy');
  old.once('dialog', dialog => dialog.accept());
  await sign(old);
  await old.waitForFunction(() => document.querySelector('#note-01').value === 'Later home version');
  await school.context.close();
  await home.context.close();
});

const hubs = (await readdir(join(ROOT, 'hubs')))
  .filter((name) => name.endsWith('.html'))
  .filter(async () => true);
const wired = [];
for (const name of hubs) {
  if ((await readFile(join(ROOT, 'hubs', name), 'utf8')).includes('/hubs/desk-save.js') && /<textarea\b/i.test(await readFile(join(ROOT, 'hubs', name), 'utf8'))) wired.push(name);
}

await test('PIN sign in captures progress after closing without declaring finished', async () => {
  const s = world();
  const cb = await chromebook(s);
  const page = await cb.open('bts-the-bargain.html');
  await typeInto(page, 'textarea', 'Forgot to press Turn In');
  await chip(page).locator('.chip').click();
  await chip(page).locator('input[type="password"]').fill(s.pin(PEOPLE.ada));
  await chip(page).getByRole('button', { name: 'Save to my account' }).click();
  await waitFor(() => s.rows('Drafts').length > 0);
  assert.equal(s.rows('Turn Ins').length, 0);
  const saved = s.rows('Drafts').at(-1);
  const data = JSON.parse(saved.Data);
  assert.equal(data.autoEligible, true);
  assert.equal(data.page, '/hubs/bts-the-bargain.html');
  assert.ok(data.title.length > 0);
  await page.close({ runBeforeUnload: false });
  s.clock.advanceMinutes(31);
  assert.equal(s.sandbox.autoTurnIn(), 0);
  assert.equal(s.rows('Turn Ins').length, 0);
  const row = s.rows('Progress')[0];
  assert.equal(row.Status, 'In progress');
  assert.match(row.Answers, /Forgot to press Turn In/);
  assert.equal(s.sandbox.autoTurnIn(), 0);
  await cb.context.close();
});

await test('changed progress saves on the minute without interrupting typing or finishing', async () => {
  const s = world();
  const cb = await chromebook(s, { hooks: { debounceMs: 60000 } });
  const page = await cb.context.newPage();
  await page.clock.install();
  await openHub(cb.context, 'bts-the-bargain.html', page);
  await page.locator('#q1').fill('First answer');
  await chip(page).locator('.chip').click();
  await chip(page).locator('input[type="password"]').fill(s.pin(PEOPLE.ada));
  await chip(page).getByRole('button', { name: 'Save to my account' }).click();
  await waitFor(() => s.rows('Progress').length === 1);
  const saves = cb.net.calls.filter(action => action === 'save').length;
  await page.locator('#q1').fill('Still writing');
  await page.clock.fastForward(59000);
  assert.equal(cb.net.calls.filter(action => action === 'save').length, saves);
  s.clock.advanceMinutes(1);
  await page.clock.fastForward(2000);
  await waitFor(() => /Still writing/.test(s.rows('Progress')[0].Answers));
  assert.equal(s.rows('Progress').length, 1);
  assert.equal(s.rows('Turn Ins').length, 0);
  assert.equal(await page.locator('#q1').inputValue(), 'Still writing');
  assert.match(await turnIn(page, s.pin(PEOPLE.ada)), /Turned in/);
  assert.equal(s.rows('Progress')[0].Status, 'Finished');
  await page.locator('#q1').fill('After finishing');
  s.clock.advanceMinutes(1);
  await page.clock.fastForward(61000);
  await waitFor(() => s.rows('Progress')[0].Status === 'In progress');
  assert.match(s.rows('Turn Ins')[0].Answers, /Still writing/);
  assert.equal(s.rows('Turn Ins').length, 1);
  await cb.context.close();
});

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
  const hubOwnCopy = await first.evaluate(() => Object.keys(sessionStorage).map((k) => sessionStorage.getItem(k)).join(' '));
  assert.match(hubOwnCopy, /must not leak/, 'this hub keeps its own copy in this tab');
  await first.close();

  const second = await cb.open('hh-who-took-the-files.html');
  assert.equal(await second.locator('textarea[data-q="A1"]').inputValue(), '');
  await second.waitForTimeout(1200);
  const after = await second.evaluate(() => Object.keys(sessionStorage).map((k) => sessionStorage.getItem(k)).join(' '));
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
  assert.match(status, /^Turned in, Ada\. Period 1, .+\d{1,2}:\d{2}/);
  const [row] = s.rows('Turn Ins');
  assert.equal(row['Student Name'], 'Byron, Ada');
  assert.equal(row.Hub, 'bts-the-bargain');
  assert.match(row.Answers, /What did Robinson promise Rickey, and for how long\?\nThree years\./);
  assert.match(row.Answers, /What happened in 1949 once the promise ended\?\nHe fought back openly\./);
  assert.equal(await panel(page).locator('input[type="password"]').inputValue(), '', 'the PIN box is cleared');
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
  await chip(page).locator('input[type="password"]').fill(pin);
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

/* ------------------------------------------------------------ PIN gate -- */

const gate = (page) => page.locator('#desk-save-gate');
const gateOpen = (page) => page.evaluate(() => window.__deskSave.gate());

async function passGate(page, pin, { confirm = true } = {}) {
  await gate(page).locator('input[type="password"]').fill(pin);
  await gate(page).getByRole('button', { name: 'Start', exact: true }).click();
  await waitFor(async () => !(await gate(page).locator('.step').nth(1).isHidden()) || (/\S/.test(await gate(page).locator('.status').textContent()) && await gate(page).getByRole('button', { name: 'Start', exact: true }).isEnabled()), 10000);
  if (confirm && await gate(page).getByRole('button', { name: 'Yes, that is me' }).isVisible()) {
    await gate(page).getByRole('button', { name: 'Yes, that is me' }).click();
  }
}

await test('the gate covers an answer page until a PIN is entered, confirms the name, then saves from the first answer', async () => {
  const s = world();
  const cb = await chromebook(s, { hooks: { gate: true } });
  const page = await cb.open('bts-the-bargain.html');
  assert.equal(await gateOpen(page), true, 'gate is up on load');
  assert.equal(await page.evaluate(() => Boolean(document.querySelector('#q1').closest('[inert]'))), true, 'answer boxes cannot be reached behind the gate');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), 'hidden');
  assert.deepEqual(cb.net.calls, [], 'nothing is sent before a PIN');

  const wrong = s.pin(PEOPLE.ada) === '123456' ? '654321' : '123456';
  await passGate(page, wrong);
  assert.match(await gate(page).locator('.status').textContent(), /did not match/);
  assert.equal(await gateOpen(page), true, 'a wrong PIN never unlocks');
  assert.equal(await gate(page).getByRole('button', { name: 'Start without saving to my account' }).isHidden(), true);

  await passGate(page, s.pin(PEOPLE.ada), { confirm: false });
  assert.equal(await gate(page).locator('.who').textContent(), 'Ada');
  assert.match(await gate(page).locator('.step').nth(1).innerText(), /Period 1/);
  await gate(page).getByRole('button', { name: 'Yes, that is me' }).click();
  assert.equal(await gateOpen(page), false);
  assert.equal(await page.evaluate(() => Boolean(document.querySelector('#q1').closest('[inert]'))), false);

  await typeInto(page, '#q1', 'Three years, no fighting back.');
  await waitFor(() => s.rows('Progress').some((r) => /Three years, no fighting back/.test(r.Answers)));
  assert.equal(s.rows('Progress')[0].Status, 'In progress');
  await waitFor(async () => /Ada/.test(await chip(page).locator('.chip').textContent()));

  assert.equal(await panel(page).locator('input[type="password"]').isHidden(), true, 'Turn In does not ask for the PIN again');
  await panel(page).getByRole('button', { name: 'Turn In' }).click();
  await waitFor(async () => /Turned in/.test(await panel(page).locator('.status').textContent()), 30000);
  assert.match(await panel(page).locator('.status').textContent(), /^Turned in, Ada\. Period 1/);
  assert.equal(s.rows('Progress')[0].Status, 'Finished');
  assert.equal(s.rows('Turn Ins').length, 1);
  assert.equal(await page.evaluate(() => Object.keys(sessionStorage).concat(Object.keys(localStorage)).map((k) => sessionStorage.getItem(k) || localStorage.getItem(k)).join(' ')).then((all) => all.includes(s.pin(PEOPLE.ada))), false, 'the PIN is never written to storage');
  assert.deepEqual(page.deskErrors, []);
  await cb.context.close();
});

await test('Not me signs the account out and the gate asks again', async () => {
  const s = world();
  const cb = await chromebook(s, { hooks: { gate: true } });
  const page = await cb.open('bts-the-bargain.html');
  await passGate(page, s.pin(PEOPLE.ada), { confirm: false });
  await gate(page).getByRole('button', { name: 'Not me' }).click();
  assert.equal(await gateOpen(page), true);
  assert.equal(await gate(page).locator('.step').first().isVisible(), true);
  assert.match(await gate(page).locator('.status').textContent(), /Enter your own PIN/);
  assert.equal(await page.evaluate(() => window.__deskSave.state().token), '');
  await passGate(page, s.pin(PEOPLE.grace));
  assert.equal(await gateOpen(page), false);
  assert.equal(await page.evaluate(() => window.__deskSave.state().firstName), 'Grace');
  await cb.context.close();
});

await test('a student in two classes picks the class at the gate and turns in without the PIN again', async () => {
  const s = world();
  const cb = await chromebook(s, { hooks: { gate: true } });
  const page = await cb.open('hh-room-1018a.html');
  await passGate(page, s.pin(PEOPLE.alan), { confirm: false });
  assert.match(await gate(page).locator('#ds-gate-who-title').textContent(), /Which class/);
  assert.equal(await gate(page).getByRole('button', { name: 'Yes, that is me' }).isHidden(), true);
  await gate(page).getByRole('button', { name: 'Period 5' }).click();
  assert.equal(await gateOpen(page), false);
  await typeInto(page, 'textarea', 'Room 1018A answer from the gate');
  await waitFor(() => s.rows('Progress').some((r) => r['Class / Hour'] === 'Period 5' || /Period 5/.test(JSON.stringify(r))));
  await panel(page).getByRole('button', { name: 'Turn In' }).click();
  await waitFor(async () => /Turned in/.test(await panel(page).locator('.status').textContent()), 30000);
  assert.match(await panel(page).locator('.status').textContent(), /Turned in, Alan\. Period 5/);
  await cb.context.close();
});

await test('a refresh keeps the student signed in, and signing out leaves a covered, blank page for the next student', async () => {
  const s = world();
  const cb = await chromebook(s, { hooks: { gate: true } });
  const page = await cb.open('bts-the-bargain.html');
  await passGate(page, s.pin(PEOPLE.ada));
  await typeInto(page, '#q1', 'Survives a refresh');
  await waitFor(() => s.rows('Progress').some((r) => /Survives a refresh/.test(r.Answers)));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__deskSave && window.__deskSave.ready);
  assert.equal(await gateOpen(page), false, 'same tab, same student');
  assert.equal(await page.locator('#q1').inputValue(), 'Survives a refresh');
  assert.equal(await panel(page).locator('input[type="password"]').isHidden(), true, 'a verified session can finish after refresh without storing or retyping the PIN');
  await panel(page).getByRole('button', { name: 'Turn In', exact: true }).click();
  await waitFor(async () => /Turned in/.test(await panel(page).locator('.status').textContent()));
  assert.equal(s.rows('Turn Ins').length, 1);

  await page.locator('#desk-save-resume').getByRole('button', { name: 'Not you? Sign out' }).click();
  await waitFor(() => gateOpen(page));
  assert.equal(await page.locator('#q1').inputValue(), '');
  assert.match(await gate(page).locator('.status').textContent(), /blank for the next person/);
  await cb.context.close();
});

await test('a student who starts at school gets the work and exact cursor back at the gate on another Chromebook', async () => {
  const s = world();
  const school = await chromebook(s, { hooks: { gate: true } });
  const first = await school.open('ush9-the-jungle.html');
  await passGate(first, s.pin(PEOPLE.ada));
  await typeInto(first, 'textarea', 'Packing house work started at school');
  await waitFor(() => s.rows('Drafts').some((r) => /started at school/.test(r.Data)));
  await first.locator('textarea').first().evaluate(el => { el.focus(); el.setSelectionRange(9, 14, 'backward'); el.dispatchEvent(new Event('select', { bubbles: true })); });
  await waitFor(() => s.rows('Drafts').some(r => JSON.parse(r.Data).position?.start === 9));
  await school.context.close();

  const home = await chromebook(s, { hooks: { gate: true } });
  const again = await home.open('ush9-the-jungle.html');
  assert.equal(await again.locator('textarea').first().inputValue(), '');
  await passGate(again, s.pin(PEOPLE.ada));
  assert.equal(await again.locator('textarea').first().inputValue(), 'Packing house work started at school');
  assert.deepEqual(await again.locator('textarea').first().evaluate(el => ({ focused: document.activeElement === el, start: el.selectionStart, end: el.selectionEnd, direction: el.selectionDirection })), { focused: true, start: 9, end: 14, direction: 'backward' });
  assert.equal(await again.locator('#desk-save-resume details').evaluate(el => el.open), false);
  assert.equal(await again.locator('#desk-save-resume').getByRole('button', { name: 'Load My Work', exact: true }).isVisible(), false);
  assert.equal(await panel(again).getByRole('button', { name: 'Download backup', exact: true }).count(), 0);
  await home.context.close();
});

await test('PIN resume reopens the saved research round and focuses the exact saved cursor', async () => {
  const s = world(), school = await chromebook(s, { hooks: { gate: true } });
  const p = await school.open('bts-americas-most-hated-research.html');
  await passGate(p, s.pin(PEOPLE.ada));
  await p.locator('[data-lab-tab="4"]').click();
  await typeInto(p, '#lab-source-one', 'Evidence started in round four.');
  await p.locator('#lab-source-one').evaluate(el => { el.setSelectionRange(8, 8); el.dispatchEvent(new Event('select', { bubbles: true })); });
  await waitFor(() => s.rows('Drafts').some(r => JSON.parse(r.Data).position?.start === 8));
  await school.context.close();
  const home = await chromebook(s, { hooks: { gate: true } }), again = await home.open('bts-americas-most-hated-research.html');
  await passGate(again, s.pin(PEOPLE.ada));
  assert.equal(await again.locator('#lab-round-4').isVisible(), true);
  assert.equal(await again.locator('#lab-source-one').evaluate(el => document.activeElement === el && el.selectionStart === 8), true);
  assert.equal(await again.locator('#lab-source-one').inputValue(), 'Evidence started in round four.');
  await home.context.close();
});

await test('PIN assignments keep recovery tucked away and show one large Turn In at all three widths', async () => {
  const s = world();
  const active = await chromebook(s, { hooks: { gate: true } });
  const page = await active.open('bts-the-bargain.html');
  await passGate(page, s.pin(PEOPLE.ada));
  await mkdir('browser-results/pin-flow', { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const options = page.locator('#desk-save-resume details');
    assert.equal(await options.evaluate(el => el.open), false);
    assert.equal(await page.locator('#desk-save-resume input[type="password"]').isVisible(), false);
    const button = panel(page).getByRole('button', { name: 'Turn In', exact: true });
    const box = await button.boundingBox();
    assert.ok(box.height >= 64 && box.width >= Math.min(250, width - 60));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const axe = await new AxeBuilder({ page }).include('#desk-save-resume').include('#desk-save-panel').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    assert.deepEqual(axe.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), []);
    await button.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `browser-results/pin-flow/finish-${width}.png` });
  }
  await page.locator('#desk-save-resume summary').click();
  assert.equal(await page.locator('#desk-save-resume').getByRole('button', { name: 'Download backup', exact: true }).isVisible(), true);
  await active.context.close();
});

await test('an unreachable save service keeps the PIN gate closed until verification succeeds', async () => {
  const s = world();
  const cb = await chromebook(s, { hooks: { gate: true } });
  const page = await cb.open('bts-the-bargain.html');
  cb.net.down = true;
  await passGate(page, s.pin(PEOPLE.ada));
  assert.match(await gate(page).locator('.status').textContent(), /Could not reach/);
  assert.equal(await gateOpen(page), true);
  assert.equal(await gate(page).getByRole('button', { name: 'Start without saving to my account' }).count(), 0);
  assert.equal(await page.evaluate(() => Boolean(document.querySelector('#q1').closest('[inert]'))), true);
  cb.net.down = false;
  await passGate(page, s.pin(PEOPLE.ada));
  assert.equal(await gateOpen(page), false);
  await cb.context.close();
});

await test('PIN session renewal keeps unsaved edits and deletions while requiring verification again', async () => {
  const s = world(), cb = await chromebook(s, { hooks: { gate: true } });
  const p = await cb.open('bts-the-bargain.html');
  await passGate(p, s.pin(PEOPLE.ada));
  await typeInto(p, '#q1', 'Account version before expiry.');
  await waitFor(() => s.rows('Progress').some(r => /before expiry/.test(r.Answers)));
  s.clock.advanceMinutes(241);
  await p.locator('#q1').fill('');
  await waitFor(() => gateOpen(p));
  assert.equal(await p.evaluate(() => Boolean(document.querySelector('#q1').closest('[inert]'))), true);
  await passGate(p, s.pin(PEOPLE.ada));
  assert.equal(await p.locator('#q1').inputValue(), '', 'renewing the session never replaces a deliberate deletion with the older account answer');
  await waitFor(() => s.rows('Progress')[0].Answers.includes('(blank)') && !/before expiry/.test(s.rows('Progress')[0].Answers));
  assert.equal(await gateOpen(p), false);
  await cb.context.close();
});

await test('a quiet signed in tab saves, signs out and puts the gate back up', async () => {
  const s = world();
  const cb = await chromebook(s, { hooks: { gate: true, idleMs: 2500 } });
  const page = await cb.open('hh-burn-the-files.html');
  await passGate(page, s.pin(PEOPLE.ada));
  await typeInto(page, 'textarea', 'Burned files answer behind the gate');
  await waitFor(() => gateOpen(page), 12000);
  assert.ok(s.rows('Drafts').some((r) => /behind the gate/.test(r.Data)), 'saved before signing out');
  assert.equal(await page.locator('textarea').first().inputValue(), '');
  assert.match(await gate(page).locator('.status').textContent(), /Signed out after 20 quiet minutes/);
  await cb.context.close();
});

await test('a teacher device skips the gate after one visit with deskteacher=on, and off turns it back on', async () => {
  const s = world();
  const cb = await chromebook(s, { hooks: { gate: true } });
  const on = await cb.open('bts-the-bargain.html?deskteacher=on');
  assert.equal(await gateOpen(on), false);
  const other = await cb.open('ush9-the-jungle.html');
  assert.equal(await gateOpen(other), false, 'the setting carries to every hub on that browser');
  const off = await cb.open('ush9-the-jungle.html?deskteacher=off');
  assert.equal(await gateOpen(off), true);
  assert.deepEqual(cb.net.calls, []);
  await cb.context.close();
});

await test('reading pages and pages with no save address never show the gate', async () => {
  const catalog = JSON.parse(await readFile(new URL('../docs/storyhub/work-panel-catalog.json', import.meta.url), 'utf8'));
  const reader = catalog.hubs.find((h) => h.mode === 'reading');
  const cb = await chromebook(world(), { hooks: { gate: true } });
  const p = await cb.open(reader.hub);
  assert.equal(await p.locator('#desk-save-gate').count(), 0);
  await cb.context.close();
  const offline = await chromebook(world(), { endpoint: false, hooks: { gate: true } });
  const q = await offline.open('bts-the-bargain.html');
  assert.equal(await gateOpen(q), false);
  await offline.context.close();
});

await test('the gate fits 320, 390 and desktop widths and passes accessibility with reduced motion', async () => {
  const s = world();
  const cb = await chromebook(s, { hooks: { gate: true } });
  const p = await cb.open('bts-americas-most-hated-research.html');
  await mkdir('browser-results/pin-gate', { recursive: true });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 390, 1440]) {
    await p.setViewportSize({ width, height: 800 });
    const box = await gate(p).locator('.panel').boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width + 1, `gate card fits at ${width}`);
    const axe = await new AxeBuilder({ page: p }).include('#desk-save-gate').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    assert.deepEqual(axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })), []);
    await p.screenshot({ path: `browser-results/pin-gate/gate-${width}.png` });
  }
  await passGate(p, s.pin(PEOPLE.ada), { confirm: false });
  await p.screenshot({ path: 'browser-results/pin-gate/confirm-1440.png' });
  const axe = await new AxeBuilder({ page: p }).include('#desk-save-gate').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  assert.deepEqual(axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })), []);
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
  await chip(page).locator('input[type="password"]').fill(s.pin(PEOPLE.grace));
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
  await chip(again).locator('input[type="password"]').fill(s.pin(PEOPLE.grace));
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
  await chip(page).locator('input[type="password"]').fill(s.pin(PEOPLE.ada));
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
  assert.equal(await panel(page).locator('input[type="password"]').count(), 0);
  assert.equal(await chip(page).locator('.chip').textContent(), 'Saved in this tab');
  await cb.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await typeInto(page, '#q1', 'Copy me');
  await panel(page).getByRole('button', { name: 'Copy my answers' }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(copied, /What did Robinson promise Rickey, and for how long\?\r?\nCopy me/);
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

await test('Classroom handoff appears only after confirmed finishing and hides after edits', async () => {
  const s = world();
  s.book().getSheetByName('Classroom Links').appendRow(['Period 1', 'bts-the-bargain', 'https://classroom.google.com/c/CLASS1/a/LESSON1/details']);
  const cb = await chromebook(s);
  const page = await cb.open('bts-the-bargain.html');
  assert.equal(await panel(page).getByRole('link', { name: 'Open Classroom assignment' }).count(), 0);
  await typeInto(page, 'textarea', 'Completed on the desk.');
  await turnIn(page, s.pin(PEOPLE.ada));
  const link = panel(page).getByRole('link', { name: 'Open Classroom assignment' });
  await link.waitFor({ state: 'visible' });
  assert.equal(await link.getAttribute('href'), 'https://classroom.google.com/c/CLASS1/a/LESSON1/details');
  assert.match(await link.getAttribute('rel'), /noopener/);
  assert.match(await panel(page).locator('.handoff').textContent(), /choose Turn In or Mark as done there/);
  await typeInto(page, 'textarea', 'Changed after finishing.');
  assert.equal(await link.isVisible(), false, 'new unfinished edits cannot imply Classroom completion');
  assert.equal(s.rows('Turn Ins').length, 1, 'finished copy is preserved');
  await cb.context.close();
});

await test('unconfigured or unsafe Classroom links fall back to home without losing work', async () => {
  const s = world();
  s.book().getSheetByName('Classroom Links').appendRow(['Period 1', 'bts-the-bargain', 'javascript:alert(1)']);
  const cb = await chromebook(s);
  const page = await cb.open('bts-the-bargain.html');
  await typeInto(page, 'textarea', 'My complete answer.');
  await turnIn(page, s.pin(PEOPLE.ada));
  const link = panel(page).getByRole('link', { name: 'Open Google Classroom', exact: true });
  await link.waitFor({ state: 'visible' });
  assert.equal(await link.getAttribute('href'), 'https://classroom.google.com/');
  assert.equal(s.rows('Turn Ins').length, 1);
  await cb.context.close();
});

await test('switching class removes the previous receipt and Classroom link', async () => {
  const s = world();
  s.book().getSheetByName('Classroom Links').appendRow(['Period 1', 'bts-the-bargain', 'https://classroom.google.com/c/CLASS1/a/LESSON1/details']);
  const cb = await chromebook(s);
  const page = await cb.open('bts-the-bargain.html');
  await typeInto(page, 'textarea', 'Work for one class.');
  await turnIn(page, s.pin(PEOPLE.alan));
  await panel(page).getByRole('button', { name: 'Period 1', exact: true }).click();
  await turnIn(page, s.pin(PEOPLE.alan));
  await panel(page).getByRole('link', { name: 'Open Classroom assignment' }).waitFor({ state: 'visible' });
  await panel(page).getByRole('button', { name: 'Period 5', exact: true }).click();
  assert.equal(await panel(page).locator('.handoff').isVisible(), false);
  await cb.context.close();
});


await test('every catalogue reader gets honest controls without creating an assignment or contacting the save service', async () => {
  const catalog = JSON.parse(await readFile(new URL('../docs/storyhub/work-panel-catalog.json', import.meta.url), 'utf8'));
  const cb = await chromebook(world());
  for (const item of catalog.hubs.filter(h => h.mode === 'reading')) {
    const p = await cb.open(item.hub);
    assert.equal(await p.evaluate(() => window.__deskSave.mode), 'reading');
    assert.match(await p.locator('#desk-save-reader').locator('.panel').innerText(), /no written answer boxes/);
    assert.equal(await p.getByRole('button', {name:'Turn In',exact:true}).count(),0);
    await p.close();
  }
  assert.deepEqual(cb.net.calls,[]);
  await cb.context.close();
});

await test('blocked tab storage is visible and failed copy never suppresses the exit warning', async () => {
  const cb = await chromebook(world(), {endpoint:false});
  await cb.context.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k,v) { if (this === sessionStorage) throw Error('Quota exceeded'); return original.call(this,k,v); };
    Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(Error('blocked'))}});
    document.execCommand=()=>false;
  });
  const p = await cb.open('bts-the-bargain.html');
  await p.locator('#q1').fill('A draft with no durable tab storage.');
  assert.match(await chip(p).locator('.chip').textContent(),/Storage blocked/);
  await panel(p).getByRole('button',{name:'Copy my answers',exact:true}).click();
  await waitFor(async()=>/blocked/.test(await panel(p).locator('.status').textContent()));
  assert.equal(await p.evaluate(()=>window.__deskSave.state().copiedHash),'');
  assert.equal(await p.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;}),true);
  await cb.context.close();
});

await test('all hidden research rounds are included as blanks in Turn In', async () => {
  const s=world(),cb=await chromebook(s),p=await cb.open('bts-americas-most-hated-research.html');
  await p.locator('#lab-identity').fill('My first written answer.');
  assert.equal(await p.locator('#lab-round-5').isVisible(),false);
  assert.match(await turnIn(p,s.pin(PEOPLE.ada)),/Turned in/);
  const record=JSON.parse(s.rows('Turn Ins')[0].Data);
  assert.ok(record.answers.some(a=>a.k==='id:lab-talk'&&a.a===''),'hidden final response is recorded as blank');
  assert.ok(record.answers.length>=20);
  await cb.context.close();
});

await test('portable backup imports only into the matching hub and supports undo', async () => {
  const cb=await chromebook(world(),{endpoint:false}),p=await cb.open('bts-the-bargain.html');
  await p.locator('#q1').fill('Original on-screen answer.');
  const backup={format:'desk-work-backup',version:1,hub:'bts-the-bargain',values:{'id:q1':'Imported answer.'}};
  const file=p.locator('input[type="file"]').first();
  const upload=async data=>file.setInputFiles({name:'work.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await upload({...backup,hub:'wrong-assignment'});
  await waitFor(async()=>/another assignment/.test(await panel(p).locator('.status').textContent()));
  assert.equal(await p.locator('#q1').inputValue(),'Original on-screen answer.');
  p.once('dialog',d=>d.accept());await upload(backup);
  await waitFor(async()=>await p.locator('#q1').inputValue()==='Imported answer.');
  await panel(p).getByRole('button',{name:'Undo load',exact:true}).click();
  assert.equal(await p.locator('#q1').inputValue(),'Original on-screen answer.');
  assert.equal(await p.evaluate(()=>window.__deskSave.state().token),'');
  assert.equal(await p.evaluate(()=>window.__deskSave.state().turnedInAt),'');
  await cb.context.close();
});

await test('an older signed-in tab cannot autosave over a newer device and can explicitly recover', async () => {
  const s=world(),a=await chromebook(s),b=await chromebook(s);
  const p=await a.open('bts-the-bargain.html');
  const sign=async page=>{
    const r=page.locator('#desk-save-resume');await r.locator('input[type="password"]').fill(s.pin(PEOPLE.ada));
    await r.getByRole('button',{name:'Load My Work',exact:true}).click();
    await page.waitForFunction(()=>Boolean(window.__deskSave.state().token));
  };
  await sign(p);await p.locator('#q1').fill('Initial version.');
  await p.evaluate(()=>window.__deskSave.saveCloud());
  const q=await b.open('bts-the-bargain.html');await sign(q);
  await q.locator('#q1').fill('Newer device version.');await q.evaluate(()=>window.__deskSave.saveCloud());
  await p.locator('#q1').fill('Older tab attempted overwrite.');await p.evaluate(()=>window.__deskSave.saveCloud());
  assert.equal(await p.evaluate(()=>window.__deskSave.state().conflict),true);
  assert.match(s.rows('Progress')[0].Answers,/Newer device version/);
  p.once('dialog',d=>d.accept());await sign(p);
  await waitFor(async()=>await p.locator('#q1').inputValue()==='Newer device version.');
  await a.context.close();await b.context.close();
});

await test('blank Save now cannot display an account confirmation without a server write', async () => {
  const s=world(),cb=await chromebook(s),p=await cb.open('bts-the-bargain.html'),r=p.locator('#desk-save-resume');
  await r.locator('input[type="password"]').fill(s.pin(PEOPLE.ada));await r.getByRole('button',{name:'Load My Work',exact:true}).click();
  await p.waitForFunction(()=>Boolean(window.__deskSave.state().token));
  await r.getByRole('button',{name:'Save now',exact:true}).click();
  assert.doesNotMatch(await r.locator('.status').textContent(),/^Account save confirmed/);
  assert.equal(s.rows('Drafts').length,0);await cb.context.close();
});

await test('student controls fit 320, 390 and desktop widths and pass accessibility with reduced motion', async () => {
  const cb=await chromebook(world()),p=await cb.open('bts-americas-most-hated-research.html');
  await mkdir('browser-results/work-panel',{recursive:true});
  await p.emulateMedia({reducedMotion:'reduce'});
  for(const width of [320,390,1440]) {
    await p.setViewportSize({width,height:900});
    const r=p.locator('#desk-save-resume');await r.scrollIntoViewIfNeeded();
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    const axe=await new AxeBuilder({page:p}).include('#desk-save-resume').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    assert.deepEqual(axe.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
    await p.screenshot({path:`browser-results/work-panel/panel-${width}.png`});
  }
  await cb.context.close();
});


await test('shared paste support has a 12-word boundary, URL exception and transparent override', async () => {
  const cb=await chromebook(world(),{endpoint:false}),p=await cb.open('bts-the-bargain.html');
  const paste=async text=>p.locator('#q1').evaluate((el,text)=>{const transfer=new DataTransfer();transfer.setData('text/plain',text);const event=new ClipboardEvent('paste',{clipboardData:transfer,bubbles:true,cancelable:true});el.dispatchEvent(event);return event.defaultPrevented;},text);
  const twelve='one two three four five six seven eight nine ten eleven twelve';
  assert.equal(await paste(twelve),false);assert.equal(await paste(twelve+' thirteen'),true);
  assert.equal(await paste('https://example.invalid/source'),false);
  await panel(p).getByRole('checkbox',{name:'Allow full paste for my own draft or a writing tool'}).check();
  assert.equal(await paste(twelve+' thirteen'),false);
  assert.equal(await p.evaluate(()=>Object.keys(window.__deskSave.state()).some(k=>/keystroke|pasteCount|activityScore/i.test(k))),false);
  await cb.context.close();
});

await test('changing students preserves the prior account and clears answers, undo and writing override', async () => {
  const s=world(),cb=await chromebook(s),p=await cb.open('bts-the-bargain.html'),r=p.locator('#desk-save-resume');
  await r.locator('input[type="password"]').fill(s.pin(PEOPLE.ada));await r.getByRole('button',{name:'Load My Work',exact:true}).click();
  await p.waitForFunction(()=>window.__deskSave.state().firstName==='Ada');
  await p.locator('#q1').fill('Private Ada draft.');
  await r.getByRole('checkbox',{name:'Allow full paste for my own draft or a writing tool'}).check();
  await p.evaluate(()=>window.__deskSave.saveCloud());
  await panel(p).locator('input[type="password"]').fill('123456');
  p.once('dialog',d=>d.accept());await r.locator('input[type="password"]').fill(s.pin(PEOPLE.grace));await r.getByRole('button',{name:'Load My Work',exact:true}).click();
  await p.waitForFunction(()=>window.__deskSave.state().firstName==='Grace');
  assert.equal(await p.locator('#q1').inputValue(),'');
  assert.equal(await p.evaluate(()=>window.__deskSave.state().undoValues),null);
  assert.equal(await panel(p).locator('input[type="password"]').inputValue(),'');
  assert.equal(await r.getByRole('checkbox',{name:'Allow full paste for my own draft or a writing tool'}).isChecked(),false);
  assert.match(s.rows('Progress').find(row=>row['Student Email']===PEOPLE.ada.email).Answers,/Private Ada draft/);
  assert.ok(!s.rows('Progress').some(row=>row['Student Email']===PEOPLE.grace.email));
  await cb.context.close();
});

await test('downloaded backups exclude credentials and receipts match the private submission reference', async () => {
  const s=world(),cb=await chromebook(s),p=await cb.open('bts-the-bargain.html');
  await p.locator('#q1').fill('My answer is in the exported backup.');
  assert.match(await turnIn(p,s.pin(PEOPLE.ada)),/Turned in/);
  const download=p.waitForEvent('download');await panel(p).getByRole('button',{name:'Download backup',exact:true}).click();
  const backup=JSON.parse(await readFile(await (await download).path(),'utf8'));
  assert.equal(backup.values['id:q1'],'My answer is in the exported backup.');
  assert.ok(!JSON.stringify(backup).includes(await p.evaluate(()=>window.__deskSave.state().token)));
  assert.ok(!('token' in backup));assert.ok(!('pin' in backup));
  const receiptDownload=p.waitForEvent('download');await panel(p).getByRole('button',{name:'Download Turn In receipt',exact:true}).click();
  const receipt=JSON.parse(await readFile(await (await receiptDownload).path(),'utf8'));
  assert.equal(receipt.submissionId,s.rows('Turn Ins')[0]['Submission ID']);
  assert.equal(receipt.turnedInAt,JSON.parse(s.rows('Turn Ins')[0].Data).savedAt);
  assert.match(receipt.source,/verify against the private teacher record/);
  await cb.context.close();
});

/* ------------------------------------------------------- writing timeline -- */

function replayText(ops) {
  let text = '';
  for (const [, pos, del, ins] of ops) text = text.slice(0, pos) + ins + text.slice(pos + del);
  return text;
}

async function goAway(page, ms) {
  await page.evaluate(async (ms) => {
    const set = (v) => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
    set('hidden'); document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, ms));
    set('visible'); document.dispatchEvent(new Event('visibilitychange'));
  }, ms);
}

await test('the writing timeline records typing, real pastes, sudden inserts and time away, and replays to the exact answer', async () => {
  const s = world();
  const cb = await chromebook(s, { hooks: { timelineFlushMs: 200 } });
  await cb.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const page = await cb.open('bts-the-bargain.html');
  assert.match(await page.evaluate(() => document.querySelector('#desk-save-panel').shadowRoot.textContent), /keeps a timeline of how your answers were written/);
  await typeInto(page, '#q1', 'He promised three years. ');
  await page.waitForTimeout(300);
  await page.keyboard.type('Then he answered back.', { delay: 2 });
  await goAway(page, 2300);
  await page.keyboard.insertText(' In 1949 the silence ended and Robinson argued with umpires and opponents in public.');
  await panel(page).getByRole('checkbox', { name: 'Allow full paste for my own draft or a writing tool' }).check();
  const pasted = ' The press noticed right away, and some writers who had praised his restraint now called him a problem.';
  await page.evaluate((t) => navigator.clipboard.writeText(t), pasted);
  await page.locator('#q1').focus();
  await page.keyboard.press('End');
  await page.keyboard.press('ControlOrMeta+V');
  await page.keyboard.press('Backspace');
  const finalText = await page.locator('#q1').inputValue();
  assert.ok(finalText.endsWith(pasted.slice(0, -1)), 'the real paste landed in the box');
  const local = await page.evaluate(() => window.__deskSave.timeline());
  const kinds = local.fields['id:q1'].ops.map((op) => op[4]);
  assert.ok(kinds.includes('t') && kinds.includes('b') && kinds.includes('p'), `kinds were ${kinds.join(',')}`);
  assert.equal(local.away.length, 1);
  assert.ok(local.marks.some((m) => m[1] === 'paste-on'));
  assert.equal(replayText(local.fields['id:q1'].ops), finalText);
  assert.match(await turnIn(page, s.pin(PEOPLE.ada)), /^Turned in, Ada/);
  const [row] = s.rows('Writing Timeline');
  assert.equal(row['Submission ID'], s.rows('Turn Ins')[0]['Submission ID']);
  assert.equal(row['Pasted'], pasted.length);
  assert.ok(row['Typed'] >= 40, 'typed characters are counted');
  assert.equal(row['Times Away'], 0, 'a two second step away is listed in the replay but not counted as an absence');
  assert.match(row['Flags'], /Pasted \d+ characters into/);
  assert.match(row['Flags'], /appeared at once/);
  assert.match(row['Flags'], /Allow full paste was turned on/);
  const data = JSON.parse(row['Replay Data']);
  assert.equal(replayText(data.fields['id:q1'].ops), finalText, 'the stored replay rebuilds the turned in answer');
  assert.equal(JSON.stringify(data).includes(s.pin(PEOPLE.ada)), false, 'no PIN in the replay');
  const replay = await cb.context.newPage();
  await replay.goto(`${BASE}/teacher/writing-replay.html`);
  await replay.locator('#input').fill('"' + row['Replay Data'].replace(/"/g, '""') + '"');
  await replay.getByRole('button', { name: 'Show replay' }).click();
  assert.equal(await replay.locator('#msg').textContent(), 'Replay ready.');
  const card = replay.locator('section.card').first();
  assert.equal(await card.locator('.text').textContent(), finalText, 'the replay page ends on the turned in answer');
  await card.locator('input[type=range]').fill('0');
  assert.match(await card.locator('[role=status]').textContent(), /^Step 1 of \d+/);
  assert.ok(await replay.locator('mark.k-p').count() + await replay.locator('.strip .k-p').count() > 0, 'pastes are colored');
  const axe = await new AxeBuilder({ page: replay }).withTags(['wcag2a', 'wcag2aa']).analyze();
  assert.deepEqual(axe.violations.map((v) => v.id), []);
  assert.equal(cb.net.calls.filter((c) => c !== 'turnin' && c !== 'save' && c !== 'signin').length, 0);
  await cb.context.close();
});

await test('a refresh keeps the timeline, an account load is marked as a load, and signing out starts a fresh one', async () => {
  const s = world();
  const first = await chromebook(s, { hooks: { timelineFlushMs: 200 } });
  const a = await first.open('bts-the-bargain.html');
  await typeInto(a, '#q1', 'Three years of silence.');
  await turnIn(a, s.pin(PEOPLE.ada));
  await first.context.close();
  const second = await chromebook(s, { hooks: { timelineFlushMs: 200 } });
  const p = await second.open('bts-the-bargain.html');
  const resume = p.locator('#desk-save-resume');
  await resume.locator('input[type="password"]').fill(s.pin(PEOPLE.ada));
  await resume.getByRole('button', { name: 'Load My Work' }).click();
  await p.waitForFunction(() => document.querySelector('#q1').value === 'Three years of silence.');
  let t = await p.evaluate(() => window.__deskSave.timeline());
  assert.deepEqual(t.fields['id:q1'].ops.map((op) => op[4]), ['l'], 'loaded work is marked as a load, never a paste');
  await typeInto(p, '#q3', 'He fought back.');
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => window.__deskSave && window.__deskSave.ready);
  t = await p.evaluate(() => window.__deskSave.timeline());
  assert.equal(replayText(t.fields['id:q3'].ops), 'He fought back.', 'refresh keeps the timeline');
  assert.deepEqual(t.fields['id:q1'].ops.map((op) => op[4]), ['l'], 'refresh adds nothing to unchanged answers');
  await p.evaluate(() => {
    const roots = [...document.querySelectorAll('[id^="desk-save"]')].map((h) => h.shadowRoot).filter(Boolean);
    const btn = roots.flatMap((r) => [...r.querySelectorAll('button')]).find((b) => b.textContent.trim() === 'Not you? Sign out');
    btn.click();
  });
  await p.waitForFunction(() => document.querySelector('#q3').value === '' && document.querySelector('#q1').value === '');
  t = await p.evaluate(() => window.__deskSave.timeline());
  assert.deepEqual(t.fields, {}, 'the next student starts with an empty timeline');
  await second.context.close();
});

/* ------------------------------------------------------------ read aloud -- */

async function stubSpeech(context) {
  await context.addInitScript(() => {
    const spoken = [];
    window.__spoken = spoken;
    window.SpeechSynthesisUtterance = function (text) { this.text = text; };
    const synth = {
      speaking: false, paused: false,
      getVoices: () => [{ name: 'Google US English', lang: 'en-US' }],
      speak(u) { spoken.push({ text: u.text, rate: u.rate }); setTimeout(() => u.onend && u.onend(), 5); },
      cancel() { spoken.push({ cancel: true }); }, pause() { spoken.push({ pause: true }); }, resume() { spoken.push({ resume: true }); },
      addEventListener() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: () => synth });
  });
}
const readBar = (page) => page.locator('#desk-read-aloud');

await test('read aloud reads selected text and student writing at the chosen speed and sends nothing', async () => {
  const s = world();
  const cb = await chromebook(s);
  await stubSpeech(cb.context);
  const page = await cb.open('bts-the-bargain.html');
  const before = cb.net.calls.length;
  const para = page.locator('main p').filter({ hasText: /\w{4,}.*\w{4,}/ }).first();
  await para.scrollIntoViewIfNeeded();
  const chosen = await para.evaluate((el) => { const r = document.createRange(); r.selectNodeContents(el); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); return String(sel).replace(/\s+/g, ' ').trim(); });
  await page.waitForTimeout(250);
  await readBar(page).getByRole('button', { name: 'Reading speed 1 times. Change speed' }).click();
  await readBar(page).getByRole('button', { name: 'Read the selected text aloud' }).click();
  await page.waitForFunction(() => window.__spoken.some((u) => u.text));
  await page.waitForTimeout(100);
  const spoken = await page.evaluate(() => window.__spoken.filter((u) => u.text));
  assert.equal(spoken.map((u) => u.text).join(' ').replace(/\s+/g, ' ').trim(), chosen);
  assert.ok(spoken.every((u) => u.rate === 1.25 && u.text.length <= 241), 'chunks are short and use the chosen speed');
  await page.evaluate(() => getSelection().removeAllRanges());
  await typeInto(page, '#q1', 'He promised three years. Then he answered back.');
  await page.locator('#q1').evaluate((el) => { el.focus(); el.setSelectionRange(0, 24); });
  await page.waitForTimeout(250);
  await page.evaluate(() => { window.__spoken.length = 0; });
  await readBar(page).getByRole('button', { name: 'Read the selected text aloud' }).click();
  await page.waitForFunction(() => window.__spoken.some((u) => u.text));
  assert.equal(await page.evaluate(() => window.__spoken.find((u) => u.text).text), 'He promised three years.');
  assert.equal(cb.net.calls.length, before, 'read aloud contacts nothing');
  await cb.context.close();
});

await test('with nothing selected read aloud reads the passage on screen, highlights it, and stop clears it', async () => {
  const cb = await chromebook(world());
  await stubSpeech(cb.context);
  const page = await cb.open('bts-the-bargain.html');
  await page.evaluate(() => { const s = window.speechSynthesis; s.speak = (u) => { window.__spoken.push({ text: u.text }); }; });
  const para = page.locator('main p').filter({ hasText: /\w{4,}.*\w{4,}/ }).nth(1);
  await para.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await readBar(page).getByRole('button', { name: 'Read this part of the page aloud' }).click();
  await page.waitForFunction(() => window.__spoken.some((u) => u.text));
  assert.equal(await page.locator('.desk-reading').count(), 1, 'the passage being read is outlined');
  await readBar(page).getByRole('button', { name: 'Pause' }).click();
  assert.ok(await page.evaluate(() => window.__spoken.some((u) => u.pause)));
  await readBar(page).getByRole('button', { name: 'Stop' }).click();
  assert.equal(await page.locator('.desk-reading').count(), 0);
  assert.equal(await readBar(page).getByRole('button', { name: 'Stop' }).isVisible(), false);
  await cb.context.close();
});

await test('read aloud is on reading pages too and fits beside the status control at 320 pixels', async () => {
  const cb = await chromebook(world());
  await stubSpeech(cb.context);
  const page = await cb.open('bts-americas-most-hated-research.html');
  await page.setViewportSize({ width: 320, height: 700 });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__deskSave && window.__deskSave.ready);
  const a = await readBar(page).locator('.bar').boundingBox();
  const b = await chip(page).locator('.chip').boundingBox().catch(() => null);
  if (b) assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y, 'read aloud and the status chip do not overlap');
  const over = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, wide: [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed').slice(0, 5).map((e) => e.tagName + '#' + e.id + '.' + e.className) }));
  assert.ok(over.sw <= 321, JSON.stringify(over));
  const result = await new AxeBuilder({ page }).include('#desk-read-aloud').withTags(['wcag2a', 'wcag2aa']).analyze();
  assert.deepEqual(result.violations.map((v) => v.id), []);
  const reader = await cb.open('hh-l06-two-sources.html').catch(() => null);
  if (reader && await reader.evaluate(() => window.__deskSave.mode) === 'reading') assert.equal(await readBar(reader).count(), 1);
  await cb.context.close();
});

await browser.close();
server.close();
console.log(`${failures ? 'FAIL' : 'PASS'}  desk-save browser  (${passed}/${passed + failures})`);
if (failures || !passed) process.exit(1);
