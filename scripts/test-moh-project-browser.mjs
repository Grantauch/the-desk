/**
 * the desk · Medal of Honor project browser suite.
 *
 * Opens the real project pages from public/ in Chromium. Network calls to
 * Turn In are answered by the real apps-script/turn-in/Code.gs running in the
 * fake Apps Script runtime with invented students. Nothing contacts Google.
 *
 *   node scripts/test-moh-project-browser.mjs
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

const ROOT = fileURLToPath(new URL('../public/', import.meta.url));
const ENDPOINT = 'https://turnin.test/exec';
const HUB = 'ush9-medal-of-honor-project';
const OUT = 'browser-results/medal-of-honor';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };

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
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let failures = 0;
let passed = 0;

async function test(name, fn) {
  if (process.env.MOH_TEST_FILTER && !name.includes(process.env.MOH_TEST_FILTER)) return;
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`  ✗ ${name}`);
    String(error && error.stack || error).split('\n').slice(0, 10).forEach((line) => console.log(`      ${line}`));
  }
}

function cors() {
  return { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' };
}

/** One Chromebook: a browser context whose Turn In calls go to the shared fake server. */
async function chromebook(s, { gate = true, width = 1280 } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 860 } });
  await context.addInitScript((h) => { window.__deskSaveTest = h; }, { endpoint: ENDPOINT, debounceMs: 300, snapshotMs: 300, gate });
  const net = { calls: [], down: false };
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === BASE) return route.continue();
    if (url.hostname === 'turnin.test') {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors() });
      const body = route.request().postData() || '{}';
      const parsed = JSON.parse(body);
      net.calls.push(parsed.action + (parsed.op ? ':' + parsed.op : ''));
      if (net.down) return route.abort('internetdisconnected');
      return route.fulfill({ status: 200, headers: { ...cors(), 'content-type': 'application/json' }, body: JSON.stringify(s.post(body)) });
    }
    return route.abort('blockedbyclient');
  });
  return { context, net };
}

async function open(cb, path) {
  const page = await cb.context.newPage();
  page.errors = [];
  page.on('pageerror', (error) => page.errors.push(error));
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__deskSave && window.__deskSave.ready, null, { timeout: 10000 });
  return page;
}

const gate = (page) => page.locator('#desk-save-gate');
async function passGate(page, pin) {
  await gate(page).locator('input[type="password"]').fill(pin);
  await gate(page).getByRole('button', { name: 'Start', exact: true }).click();
  await gate(page).getByRole('button', { name: 'Yes, that is me' }).click({ timeout: 10000 });
}

async function waitFor(fn, timeout = 8000) {
  const start = Date.now();
  for (;;) {
    if (await fn()) return;
    if (Date.now() - start > timeout) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 100));
  }
}

const words = (n, seed) => Array.from({ length: n }, (_, i) => `${seed}${i}`).join(' ');

/* ------------------------------------------------------------- reading -- */

await test('annotated exemplar is complete, accessible, printable and never becomes student work', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(String(error)));
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === BASE) return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
  await page.goto(`${BASE}/hubs/ush9-medal-of-honor-exemplar.html`);
  await page.addScriptTag({ url: `${BASE}/hubs/moh/spec.js` });
  await page.addScriptTag({ url: `${BASE}/hubs/moh/veterans.js` });
  const contentCheck = await page.evaluate(() => {
    const fields = window.MOH.FIELDS.filter(f => f.kind !== 'gen');
    return fields.flatMap(field => {
      const element = document.querySelector(`[data-model-field="${field.id}"]`);
      if (!element) return [`Missing ${field.id}`];
      if (element.textContent.trim().length < field.min) return [`Too short: ${field.id}`];
      if (field.kind === 'word' && !window.MOH_VETERANS[0].citation.toLowerCase().includes(element.textContent.trim().toLowerCase())) return [`Word absent from citation: ${field.id}`];
      if (/poster-head|screen-title/.test(field.id) && element.textContent.trim().split(/\s+/).length > 5) return [`Long title: ${field.id}`];
      if (/poster-quote|screen-quote/.test(field.id)) {
        const text = element.textContent.trim();
        if (text.split(/\s+/).length > 12 || !window.MOH_VETERANS[0].citation.includes(text)) return [`Invalid quote: ${field.id}`];
      }
      return [];
    });
  });
  assert.deepEqual(contentCheck, [], 'all student-authored fields meet the current assignment requirements');
  assert.equal(await page.locator('input,textarea,canvas,script[src*="desk-save"]').count(), 0, 'reading page has no account or answer controls');
  assert.match(await page.locator('.model-label').first().textContent(), /Teacher-created model/);
  const notes = await page.locator('.explanation').count();
  assert.equal(notes, 11);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => Promise.all([...document.images].map(img => { img.loading = 'eager'; return img.decode(); })));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `viewport fit at ${width}`);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    assert.deepEqual(axe.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target).join(' ')}`), [], `exemplar accessibility at ${width}`);
    await page.screenshot({ path: `${OUT}/exemplar-${width}.png`, fullPage: true });
    const toggle = page.locator('#toggle-notes');
    await toggle.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.explanation:visible').count(), 0);
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('[data-model-field]').count(), 44, 'reading view retains every answer');
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('.explanation:visible').count(), 0, 'clean print hides explanations');
    if (width === 1440) await page.pdf({ path: `${OUT}/exemplar-clean.pdf`, format: 'Letter' });
    await page.emulateMedia({ media: 'screen' });
    await toggle.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.explanation:visible').count(), notes);
  }
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('.explanation:visible').count(), notes, 'annotated print retains notes');
  await page.pdf({ path: `${OUT}/exemplar-annotated.pdf`, format: 'Letter' });
  await page.emulateMedia({ media: 'screen' });
  assert.deepEqual(external, [], 'exemplar needs no remote services');
  assert.deepEqual(errors, []);
  const noJS = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 900 } });
  const staticPage = await noJS.newPage();
  await staticPage.goto(`${BASE}/hubs/ush9-medal-of-honor-exemplar.html`);
  assert.equal(await staticPage.locator('.explanation:visible').count(), notes);
  assert.equal(await staticPage.locator('[data-example-controls]:visible').count(), 0);
  assert.ok(await staticPage.locator('#screen img').evaluate(async img => { img.loading = 'eager'; await img.decode(); return img.naturalWidth === 1600; }));
  await noJS.close();
  await context.close();
  const synthetic = world();
  const cb = await chromebook(synthetic);
  const work = await open(cb, '/hubs/ush9-medal-of-honor-project.html');
  await passGate(work, synthetic.pin(PEOPLE.katherine));
  assert.equal(await work.locator('.ws-step a[href*="exemplar.html"]').count(), 7, 'each project step links to its matching model section');
  assert.equal(await work.locator('.ws-step a[href*="exemplar.html"][target="_blank"][rel="noopener"]').count(), 7, 'model opens alongside the assignment');
  await work.locator('[data-mode="solo"]').click();
  await work.locator('#pick-grid .vcard[data-slug="freddie-stowers"]').click();
  await work.locator('[data-action="confirm-pick"]').click();
  await work.locator('#moh-work').waitFor({ state: 'visible' });
  await work.locator('#moh-a-fact-born').fill('My own draft about Stowers stays in my project.');
  const [model] = await Promise.all([
    cb.context.waitForEvent('page'),
    work.locator('#step-facts a[href*="exemplar.html"]').click(),
  ]);
  await model.waitForLoadState();
  assert.match(model.url(), /exemplar\.html#fact-file$/);
  assert.equal(await work.locator('#moh-a-fact-born').inputValue(), 'My own draft about Stowers stays in my project.');
  assert.equal(await model.locator('input,textarea,#desk-save-gate').count(), 0);
  await cb.context.close();
});

await test('home and veteran pages read cleanly at phone and desktop widths', async () => {
  const s = world();
  const cb = await chromebook(s, { gate: false });
  const page = await open(cb, '/hubs/ush9-medal-of-honor.html');
  const cards = await page.locator('#wall .exhibit-card').count();
  assert.equal(cards, 21, 'all 21 veterans on the wall');
  await page.locator('#wall img').evaluateAll(async (images) => {
    await Promise.all(images.map((image) => {
      image.loading = 'eager';
      return image.decode();
    }));
  });
  assert.equal(await page.locator('#wall img').count(), cards, 'every card has a local image');
  assert.ok(await page.locator('.gallery-backdrop img').evaluate((image) => image.naturalWidth > 0), 'archival cover loaded');
  const medal = page.locator('.hero-medal img');
  await medal.evaluate((image) => image.decode());
  assert.match(await medal.getAttribute('alt'), /Frank Luke/);
  assert.match(await page.locator('.hero-medal .medal-credit').getAttribute('href'), /180917-F-IO108-006/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.medal-glint').first().evaluate((glint) => getComputedStyle(glint).animationName), 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('#filters [data-tag="navy"]').click();
  const navyCount = await page.evaluate(() => window.MOH_VETERANS.filter((veteran) => veteran.tags.includes('navy')).length);
  assert.equal(await page.locator('#wall .exhibit-card:visible').count(), navyCount, 'service filter updates the gallery');
  await page.locator('#filters [data-tag="all"]').click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `home has no sideways scroll at ${width}`);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).exclude('#desk-save-reader').analyze();
    assert.deepEqual(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`), [], `home accessibility at ${width}`);
    await page.screenshot({ path: `${OUT}/home-${width}.png`, fullPage: width !== 1440 ? false : true });
  }
  const vet = await open(cb, '/hubs/ush9-medal-of-honor-veteran.html?v=freddie-stowers');
  await vet.waitForSelector('h1');
  assert.match(await vet.locator('h1').textContent(), /Stowers/);
  for (const width of [320, 390, 1440]) {
    await vet.setViewportSize({ width, height: 900 });
    assert.ok(await vet.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `veteran page has no sideways scroll at ${width}`);
    const axe = await new AxeBuilder({ page: vet }).withTags(['wcag2a', 'wcag2aa']).exclude('#desk-save-reader').analyze();
    assert.deepEqual(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`), [], `veteran accessibility at ${width}`);
    await vet.screenshot({ path: `${OUT}/veteran-${width}.png`, fullPage: true });
  }
  assert.deepEqual([...page.errors, ...vet.errors].map(String), []);
  await cb.context.close();
});

await test('every veteran page builds with a citation, a map pin and working next links', async () => {
  const s = world();
  const cb = await chromebook(s, { gate: false });
  const page = await open(cb, '/hubs/ush9-medal-of-honor.html');
  const slugs = await page.evaluate(() => window.MOH_VETERANS.map((v) => v.slug));
  await page.setViewportSize({ width: 320, height: 780 });
  for (const slug of slugs) {
    await page.goto(`${BASE}/hubs/ush9-medal-of-honor-veteran.html?v=${slug}`);
    await page.waitForSelector('h1');
    const portrait = page.locator('.profile-portrait img');
    await portrait.evaluate((image) => image.decode());
    assert.ok(await portrait.getAttribute('alt'), `${slug} describes its image`);
    assert.ok(await page.locator('.profile-portrait figcaption a').getAttribute('href'), `${slug} credits its archival source`);
    assert.match(await page.locator('.project-next a').getAttribute('href'), new RegExp('pick=' + slug + '$'));
    assert.ok(await page.locator('.pager .next').getAttribute('href'), `${slug} links to the next profile`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${slug} fits the viewport`);
    const cite = await page.evaluate((s) => {
      const v = window.MOH_VETERANS.find((x) => x.slug === s);
      const q = document.querySelector('.citation blockquote');
      return Boolean(q && q.textContent.replace(/\s+/g, ' ').trim() === v.citation.replace(/\s+/g, ' ').trim());
    }, slug);
    assert.ok(cite, `${slug} shows its citation word for word`);
    assert.ok(await page.locator('svg circle, svg .pin').count() > 0, `${slug} has a map pin`);
    assert.equal(await page.locator('#more .reading-card').count(), 2, `${slug} includes historical context and an individual explanation`);
    assert.ok((await page.locator('#more .reading-columns').innerText()).length > 350, `${slug} expands the reading beyond the short biography`);
    assert.ok(await page.locator('#vocabulary .vocab-card').count() >= 15, `${slug} includes a substantial plain-language glossary`);
    assert.equal(await page.locator('#more .reading-ask li').count(), 4, `${slug} contains a four-step evidence guide`);
    const project = await page.context().newPage();
    await project.goto(`${BASE}/hubs/${HUB}.html?deskteacher=on`);
    await project.waitForFunction(() => Boolean(window.MOH_EXTRA && window.MOH_EXTRA.terms));
    const bank = await project.evaluate((key) => {
      const v = window.MOH_VETERANS.find((x) => x.slug === key), terms = window.MOH_EXTRA.terms;
      return v.words.length + Object.keys(terms).filter((term) => v.citation.toLowerCase().includes(term.toLowerCase()) && !v.words.some((w) => w[0].toLowerCase() === term.toLowerCase())).length;
    }, slug);
    assert.ok(bank >= 6, `${slug} has at least six citation terms for two partners`);
    await project.close();
  }
  assert.deepEqual(page.errors.map(String), []);
  await cb.context.close();
});

/* ------------------------------------------------------------- the team -- */

await test('a pair splits the work: each partner edits only their own boxes and sees the other read only', async () => {
  const s = world();
  const school = await chromebook(s);
  const ada = await open(school, `/hubs/${HUB}.html?pick=alvin-york`);
  await passGate(ada, s.pin(PEOPLE.ada));
  await ada.locator('#moh-setup').waitFor({ state: 'visible' });
  assert.match(await ada.locator('#stage-mode .setup-guide').textContent(), /own PIN/i, 'partner setup explicitly says to use separate PINs');
  await ada.screenshot({ path: `${OUT}/setup-mode.png` });
  await ada.locator('[data-mode="start"]').click();
  await ada.locator('#stage-pick').waitFor({ state: 'visible' });
  assert.equal(await ada.locator('#pick-grid .vcard.picked').getAttribute('data-slug'), 'alvin-york', 'the ?pick= veteran is preselected');
  await ada.screenshot({ path: `${OUT}/setup-pick.png` });
  await ada.locator('[data-action="confirm-pick"]').click();
  await ada.locator('#moh-work').waitFor({ state: 'visible' });
  const code = (await ada.locator('#ws-team strong').nth(2).textContent()).trim();
  assert.match(code, /^[A-Z0-9]{4}$/, 'Partner A sees a four character team code');
  assert.match(await ada.locator('#ws-coach').textContent(), /partner has not joined yet/i, 'waiting for Partner B is explained');
  assert.equal(await ada.locator('#step-facts .step-guide li').count(), 3, 'each step offers a three-action guide');
  assert.equal(await ada.locator('#moh-a-fact-born').getAttribute('aria-describedby'), 'guide-moh-a-fact-born', 'each field has accessible plain-language help');
  assert.match(await ada.locator('#ws-vet').textContent(), /York/);

  // Ada owns Partner A boxes and not Partner B boxes.
  assert.equal(await ada.locator('#moh-a-fact-born').evaluate((el) => el.readOnly), false);
  assert.equal(await ada.locator('#moh-b-fact-unit').evaluate((el) => el.readOnly), true);
  assert.equal(await ada.locator('#moh-b-fact-unit').evaluate((el) => el.hasAttribute('data-desk-uncounted')), true);
  assert.equal(await ada.locator('#moh-b-fact-unit').evaluate((el) => el.disabled), false, 'partner fields stay enabled so drafts keep them');
  await ada.locator('#moh-a-fact-born').fill('December 13, 1887, in a log cabin near Pall Mall, Tennessee');
  await ada.screenshot({ path: `${OUT}/work-facts-a.png`, fullPage: true });

  // Grace joins from another Chromebook.
  const home = await chromebook(s);
  const grace = await open(home, `/hubs/${HUB}.html`);
  await passGate(grace, s.pin(PEOPLE.grace));
  await grace.locator('[data-mode="join"]').click();
  await grace.locator('#join-code').fill('ZZZZ');
  await grace.locator('[data-action="join"]').click();
  await waitFor(async () => /did not match/.test(await grace.locator('#setup-msg').textContent()));
  await grace.locator('#join-code').fill(code.toLowerCase());
  await grace.locator('[data-action="join"]').click();
  await grace.locator('#moh-work').waitFor({ state: 'visible' });
  assert.match(await grace.locator('#ws-vet').textContent(), /York/);
  assert.equal(await grace.locator('#moh-b-fact-unit').evaluate((el) => el.readOnly), false);
  assert.equal(await grace.locator('#moh-a-fact-born').evaluate((el) => el.readOnly), true);
  await grace.locator('#moh-b-fact-unit').fill('Company G, 328th Infantry, 82nd Division');
  assert.match(await grace.locator('#ws-coach').textContent(), /Partner B/i, 'the student always sees their actual role');
  const forged = s.post({ action: 'save', hub: HUB, token: await grace.evaluate(() => window.__deskSave.account().token),
    classPeriod: 'Period 1', course: 'ush9', writeProtocol: 1, baseRevision: '', answers: [
      { k: 'id:moh-a-fact-born', q: 'Where born?', a: 'Forged answer to another student field' },
    ] });
  assert.equal(forged.ok, false, 'server rejects a forged partner-field save');
  assert.equal(forged.code, 'partner_field', 'server reports ownership violation');

  // Ada's typing reaches her account, and Grace sees it after the next status.
  await ada.evaluate(() => window.__deskSave.saveCloud && window.__deskSave.saveCloud());
  await waitFor(() => s.rows('Progress').some((r) => /Pall Mall/.test(r.Answers || r.Data || '')), 15000);
  await grace.reload();
  await grace.locator('#moh-work').waitFor({ state: 'visible', timeout: 10000 });
  await waitFor(async () => /Pall Mall/.test(await grace.locator('.box[data-field="moh-a-fact-born"] .partner-view').textContent()));
  await grace.screenshot({ path: `${OUT}/work-facts-b.png`, fullPage: true });

  // The partner's text never lands in Grace's own saved answer for that box.
  await grace.evaluate(() => window.__deskSave.saveCloud && window.__deskSave.saveCloud());
  await waitFor(() => s.rows('Progress').some((r) => /Company G/.test(r.Answers || r.Data || '')), 15000);
  const graceRow = s.rows('Progress').find((r) => /Company G/.test(r.Answers || r.Data || ''));
  assert.ok(!/Pall Mall/.test(graceRow.Answers || graceRow.Data), 'Grace\'s account holds only her own writing');

  // A Period 1 classmate cannot take York, but Period 2 can.
  const other = await chromebook(s);
  const kat = await open(other, `/hubs/${HUB}.html`);
  await passGate(kat, s.pin(PEOPLE.katherine));
  await kat.locator('[data-mode="solo"]').click();
  assert.equal(await kat.locator('#pick-grid .vcard[data-slug="alvin-york"]').isDisabled(), false, 'another class period can pick the same veteran');

  assert.deepEqual([...ada.errors, ...grace.errors, ...kat.errors].map(String), []);
  await Promise.all([school.context.close(), home.context.close(), other.context.close()]);
});

await test('a classmate in the same hour finds a taken veteran locked', async () => {
  const s = world();
  const one = await chromebook(s);
  const ada = await open(one, `/hubs/${HUB}.html`);
  await passGate(ada, s.pin(PEOPLE.ada));
  await ada.locator('[data-mode="solo"]').click();
  await ada.locator('#pick-grid .vcard[data-slug="henry-johnson"]').click();
  await ada.locator('[data-action="confirm-pick"]').click();
  await ada.locator('#moh-work').waitFor({ state: 'visible' });
  const two = await chromebook(s);
  const grace = await open(two, `/hubs/${HUB}.html`);
  await passGate(grace, s.pin(PEOPLE.grace));
  await grace.locator('[data-mode="start"]').click();
  assert.equal(await grace.locator('#pick-grid .vcard[data-slug="henry-johnson"]').isDisabled(), true);
  await grace.screenshot({ path: `${OUT}/setup-taken.png` });
  await Promise.all([one.context.close(), two.context.close()]);
});

/* ---------------------------------------------------------------- solo -- */

await test('a student working alone does every job, the next job button walks the steps, and the paper prints whole', async () => {
  const s = world();
  const cb = await chromebook(s);
  const page = await open(cb, `/hubs/${HUB}.html`);
  await passGate(page, s.pin(PEOPLE.katherine));
  await page.locator('[data-mode="solo"]').click();
  await page.locator('#pick-grid .vcard[data-slug="freddie-stowers"]').click();
  await page.locator('[data-action="confirm-pick"]').click();
  await page.locator('#moh-work').waitFor({ state: 'visible' });
  assert.equal(await page.locator('body').evaluate((b) => b.classList.contains('role-solo')), true);
  assert.match(await page.locator('#ws-coach').textContent(), /Working alone/i, 'solo requirements are identified');
  assert.equal(await page.locator('#step-facts .step-guide li').count(), 3);
  await page.locator('[data-goto="story1"]').click();
  const longPasteBlocked = await page.locator('#moh-a-before-1').evaluate((field) => {
    const clipboard = new DataTransfer();
    clipboard.setData('text/plain', Array.from({ length: 20 }, (_, i) => 'word' + i).join(' '));
    return field.dispatchEvent(new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true, cancelable: true })) === false;
  });
  assert.equal(longPasteBlocked, true, 'a paste longer than 12 words is blocked by default');
  await page.locator('#moh-a-before-1').fill('Handwritten thought to see the counting helper');
  assert.match(await page.locator('.box[data-field="moh-a-before-1"] .moh-wordcount').textContent(), /words?$/);
  await page.locator('.box[data-field="moh-a-before-1"] .moh-expand').click();
  assert.equal(await page.locator('.box[data-field="moh-a-before-1"]').evaluate((el) => el.classList.contains('big-writing')), true, 'writing boxes expand on demand');
  await page.locator('#moh-a-before-1').fill('');
  await page.locator('[data-goto="facts"]').click();
  for (const width of [390, 1366]) {
    await page.setViewportSize({ width, height: 768 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `workspace has no sideways scroll at ${width}`);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).exclude('#desk-save-panel').exclude('#desk-save-chip').exclude('#desk-read-aloud').analyze();
    assert.deepEqual(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`), [], `workspace accessibility at ${width}`);
    await page.screenshot({ path: `${OUT}/work-${width}.png` });
  }
  await page.setViewportSize({ width: 1280, height: 860 });

  const fields = await page.evaluate(() => window.MOH.FIELDS.map((f) => ({ id: f.id, kind: f.kind, min: f.min || 0, owner: f.owner, done: f.done || '' })));
  const editable = fields.filter((f) => f.kind !== 'gen' && !(f.owner === 'b' && f.kind === 'why'));
  for (const f of fields.filter((x) => x.owner === 'b' && x.kind === 'why')) {
    assert.equal(await page.locator(`.box[data-field="${f.id}"]`).isHidden(), true, `${f.id} is hidden for a solo student`);
  }
  // Follow the next job button until it reaches the finish step.
  let drew = false;
  for (let i = 0; i < 80; i++) {
    await page.locator('[data-action="next-job"]').click();
    if (!(await page.locator('#step-finish').isHidden())) break;
    const id = await page.evaluate(() => document.activeElement && document.activeElement.id);
    const f = editable.find((x) => x.id === id);
    if (f) {
      await page.locator('#' + id).fill(words(Math.max(4, Math.ceil(f.min / 4)), id.replace(/\W/g, '').slice(4, 9)));
      if (i === 3) await page.screenshot({ path: `${OUT}/work-next-job.png` });
      continue;
    }
    const layout = await page.locator('#moh-a-poster-layout').inputValue();
    const status = await page.locator('#moh-a-poster-status').inputValue();
    if (!layout) { await page.locator('.choice[data-target="moh-a-poster-layout"] button').first().click(); continue; }
    if (status !== 'Done') { await page.locator('.choice[data-target="moh-a-poster-status"] button', { hasText: 'Done' }).click(); continue; }
    assert.equal(drew, false, 'the next job button keeps asking for the drawing after it was drawn');
    drew = true;
    const canvas = page.locator('.designer canvas').first();
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
    await page.mouse.down();
    for (let k = 0; k < 20; k++) await page.mouse.move(box.x + box.width * (0.3 + k * 0.015), box.y + box.height * (0.4 + Math.sin(k / 3) * 0.1));
    await page.mouse.up();
    await page.locator('.designer button', { hasText: /medal/i }).first().click().catch(() => {});
  }
  const left = await page.evaluate(() => window.MOH.FIELDS.filter((f) => window.MOH.owns('solo', f) && !window.MOH.done(f, document.getElementById(f.id).value)).map((f) => f.id));
  assert.deepEqual(left, [], 'the next job button reached every job');
  assert.ok(drew, 'the student drew the memorial screen');
  await page.locator('[data-goto="art"]').click();
  await page.screenshot({ path: `${OUT}/work-art.png`, fullPage: true });
  const data = await page.locator('#moh-b-screen-data').inputValue();
  assert.ok(data.length >= 30, 'the drawing is stored as design data');

  await page.locator('[data-action="next-job"]').click();
  await waitFor(async () => !(await page.locator('#step-finish').isHidden()));
  assert.equal(await page.locator('#ws-progress').evaluate((el) => el.style.width), '100%');
  assert.equal(await page.locator('#ws-progress').evaluate((el) => el.parentNode.getAttribute('aria-valuenow')), '100', 'progress is accessible');
  await page.screenshot({ path: `${OUT}/work-finish.png`, fullPage: true });

  await page.locator('#step-finish [data-action="preview"]').click();
  await page.locator('#moh-preview').waitFor({ state: 'visible' });
  const paper = await page.locator('#preview-body').innerText();
  for (const heading of ['Before the War', 'Citation', 'After the War', 'Words to Know', 'Sources']) assert.match(paper, new RegExp(heading, 'i'));
  assert.ok(!/Not written yet/.test(paper), 'nothing is missing from a finished paper');
  await page.locator('#preview-body').screenshot({ path: `${OUT}/paper-preview.png` });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: `${OUT}/paper.pdf`, format: 'Letter' });
  await page.emulateMedia({ media: 'screen' });
  await page.locator('[data-action="close-preview"]').click();

  // Refresh keeps everything and returns to the same team.
  await page.reload();
  await page.locator('#moh-work').waitFor({ state: 'visible', timeout: 10000 });
  assert.equal(await page.locator('#ws-progress').evaluate((el) => el.style.width), '100%');
  assert.deepEqual(page.errors.map(String), []);
  await cb.context.close();
});

/* --------------------------------------------------------- the teacher -- */

await test('the teacher page lists teams by hour, prints a merged paper and shows the gallery', async () => {
  const s = world();
  // Build a pair through the server directly, the way the pages do, then add their writing.
  const sign = (person) => s.post({ action: 'signin', pin: s.pin(person), hub: HUB, course: 'ush9', device: 'dev-' + person.email.slice(0, 3) });
  const ada = sign(PEOPLE.ada); const grace = sign(PEOPLE.grace);
  assert.ok(ada.ok && grace.ok, JSON.stringify([ada, grace]));
  const team = s.post({ action: 'team', op: 'create', token: ada.token, hub: HUB, course: 'ush9', mode: 'pair', choice: 'samuel-woodfill', device: 'dev-ada' });
  assert.ok(team.ok, JSON.stringify(team));
  const join = s.post({ action: 'team', op: 'join', token: grace.token, hub: HUB, course: 'ush9', code: team.team.code, device: 'dev-gra' });
  assert.ok(join.ok, JSON.stringify(join));

  // Ada writes on her Chromebook through the real page, Grace draws on hers.
  const cbA = await chromebook(s);
  const pa = await open(cbA, `/hubs/${HUB}.html`);
  await passGate(pa, s.pin(PEOPLE.ada));
  await pa.locator('#moh-work').waitFor({ state: 'visible' });
  await pa.locator('#moh-a-fact-born').fill('He was born in 1883 in Jefferson County, Kentucky.');
  await pa.locator('[data-goto="story1"]').click();
  await pa.locator('#moh-a-before-1').fill(words(40, 'early'));
  await pa.evaluate(() => window.__deskSave.saveCloud());
  const cbB = await chromebook(s);
  const pb = await open(cbB, `/hubs/${HUB}.html`);
  await passGate(pb, s.pin(PEOPLE.grace));
  await pb.locator('#moh-work').waitFor({ state: 'visible' });
  await pb.locator('[data-goto="art"]').click();
  await pb.locator('#moh-b-screen-title').fill('The Rifleman of Cunel');
  await pb.locator('.designer button', { hasText: /^Medal$/ }).first().click();
  await pb.evaluate(() => window.__deskSave.saveCloud());
  await waitFor(() => s.rows('Progress').filter((r) => /moh-/.test(r.Data || '')).length >= 2, 15000);

  const cb = await chromebook(s, { gate: false });
  const page = await cb.context.newPage();
  page.errors = []; page.on('pageerror', (e) => page.errors.push(e));
  await page.goto(`${BASE}/teacher/medal-of-honor.html`);
  // First press with no key makes the key in the workbook.
  await page.locator('[data-action="load"]').first().click();
  await waitFor(async () => /Teacher Key tab/.test(await page.locator('#msg').textContent()));
  await page.locator('#key').fill('wrong-key');
  await page.locator('[data-action="load"]').first().click();
  await waitFor(async () => /did not match/.test(await page.locator('#msg').textContent()));
  const real = s.book().getSheetByName('Teacher Key').getRange(2, 1).getValue();
  await page.locator('#key').fill(real);
  await page.locator('[data-action="load"]').first().click();
  await page.locator('.team').first().waitFor({ state: 'visible' });
  const text = await page.locator('.team').first().innerText();
  assert.match(text, /Woodfill/i);
  assert.match(text, /Ada/); assert.match(text, /Grace/);
  await page.screenshot({ path: `${OUT}/teacher.png`, fullPage: true });

  // The key is remembered on this computer.
  await page.reload();
  await page.locator('.team').first().waitFor({ state: 'visible' });

  await page.locator('.team').first().getByRole('button', { name: 'Paper' }).click();
  await page.locator('#preview').waitFor({ state: 'visible' });
  const paper = await page.locator('#preview-body').innerText();
  assert.match(paper, /Jefferson County/, 'Partner A writing is in the paper');
  assert.match(paper, /Grace/, 'Partner B is named in the paper');
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: `${OUT}/teacher-paper.pdf`, format: 'Letter' });
  await page.emulateMedia({ media: 'screen' });
  await page.locator('[data-action="close"]').click();

  await page.locator('.team').first().getByRole('button', { name: 'Screen' }).click();
  await page.locator('#gallery').waitFor({ state: 'visible' });
  assert.match(await page.locator('#gallery-who').textContent(), /Woodfill/);
  await page.screenshot({ path: `${OUT}/teacher-gallery.png` });
  await page.keyboard.press('Escape');
  await waitFor(async () => await page.locator('#gallery').isHidden());
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  assert.deepEqual(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`), [], 'teacher page accessibility');
  assert.deepEqual([...page.errors, ...pa.errors, ...pb.errors].map(String), []);
  await Promise.all([cb.context.close(), cbA.context.close(), cbB.context.close()]);
});

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
