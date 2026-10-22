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
  const hooks = { endpoint: options.endpoint === false ? '' : ENDPOINT, debounceMs: 300, snapshotMs: 300, ...(options.hooks || {}) };
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
  await resume.locator('input').fill(s.pin(PEOPLE.ada));
  await resume.getByRole('button', { name: 'Sign in / recover my work' }).click();
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
  await home.locator('#desk-save-resume').locator('input').fill(s.pin(PEOPLE.ada));
  await home.locator('#desk-save-resume').getByRole('button', { name: 'Sign in / recover my work' }).click();
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
    await resume.locator('input').fill(s.pin(PEOPLE.ada));
    await resume.getByRole('button', { name: 'Sign in / recover my work' }).click();
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
  await resume.locator('input').fill(s.pin(PEOPLE.ada));
  await resume.getByRole('button', { name: 'Sign in / recover my work' }).click();
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
    await resume.locator('input').fill(s.pin(PEOPLE.ada));
    await resume.getByRole('button', { name: 'Sign in / recover my work' }).click();
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
  if ((await readFile(join(ROOT, 'hubs', name), 'utf8')).includes('/hubs/desk-save.js')) wired.push(name);
}

await test('PIN sign in captures progress after closing without declaring finished', async () => {
  const s = world();
  const cb = await chromebook(s);
  const page = await cb.open('bts-the-bargain.html');
  await typeInto(page, 'textarea', 'Forgot to press Turn In');
  await chip(page).locator('.chip').click();
  await chip(page).locator('input').fill(s.pin(PEOPLE.ada));
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
  await chip(page).locator('input').fill(s.pin(PEOPLE.ada));
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

await browser.close();
server.close();
console.log(`${failures ? 'FAIL' : 'PASS'}  desk-save browser  (${passed}/${passed + failures})`);
if (failures) process.exit(1);
