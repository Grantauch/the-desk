/**
 * the desk · Michigan Athlete Report browser suite.
 *
 * Opens the real project pages from public/ in Chromium. Network calls to
 * Turn In are answered by the real apps-script/turn-in/Code.gs running in the
 * fake Apps Script runtime with invented students. Nothing contacts Google.
 *
 *   node scripts/test-michigan-athletes-browser.mjs
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
const HUB = 'bts-michigan-athletes-project';
const OUT = 'browser-results/michigan-athletes';
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
  if (process.env.MIA_TEST_FILTER && !name.includes(process.env.MIA_TEST_FILTER)) return;
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


/* A filled in athlete, the shape the bio writer will use, to prove a written profile renders. */
async function withSampleBio(context) {
  const real = await readFile(join(ROOT, 'hubs/mia/athletes.js'), 'utf8');
  const sample = `;(function(){var a=window.MI_ATHLETES.find(function(x){return x.slug==='jim-abbott'});Object.assign(a,{
    known:'Pitcher',teams:'California Angels, New York Yankees',michiganTie:'Grew up in Flint and pitched for Flint Central High School',
    born:'1967-09-19',bornPlace:'Flint, Michigan',hook:'Born without a right hand, he threw a no hitter at Yankee Stadium.',
    numbers:[['1993','No hitter for the Yankees'],['1988','Olympic gold medal'],['87','Big league wins']],bigMomentLabel:'September 4, 1993',
    growingUp:['Sample growing up paragraph one.','Sample growing up paragraph two.'],bigMoment:['Sample big moment paragraph.'],
    beyond:['Sample beyond paragraph.'],legacy:['Sample legacy paragraph.'],quote:{text:'Sample quote text.',who:'Jim Abbott',when:'2012'},
    links:[['Sample source','https://example.com/source']]});})();`;
  await context.route(`${BASE}/hubs/mia/athletes.js`, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: real + sample }));
}

await test('the athlete wall, map and profiles read cleanly at phone and desktop widths', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const errors = [], external = [];
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === BASE) return route.continue();
    external.push(route.request().url()); return route.abort();
  });
  await withSampleBio(context);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/hubs/bts-michigan-athletes.html`);
  assert.equal(await page.locator('#wall .exhibit-card').count(), 24, 'all 24 athletes are on the wall');
  assert.equal(await page.locator('#hero-map svg path').count() >= 2, true, 'the Michigan map draws');
  const dots = await page.locator('#hero-map svg circle').evaluateAll((cs) => cs.map((c) => [Number(c.getAttribute('cx')), Number(c.getAttribute('cy'))]));
  assert.ok(dots.length >= 24 && dots.every(([x, y]) => x > 20 && x < 600 && y > 20 && y < 640), 'every hometown dot lands on the map: ' + JSON.stringify(dots.slice(0, 3)));
  await page.locator('#filters button[data-tag="women"]').click();
  assert.match(await page.locator('#count').textContent(), /Showing 6 of 24/);
  await page.locator('#filters button[data-tag="all"]').click();
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'wall fits at ' + width);
    await page.screenshot({ path: `${OUT}/wall-${width}.png`, fullPage: true });
  }
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  assert.deepEqual(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`), [], 'wall accessibility');

  // A profile with no bio yet shows a clean pending note, never blank chapters.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}/hubs/bts-michigan-athletes-profile.html?a=joe-louis`);
  assert.match(await page.locator('h1').textContent(), /Joe Louis/);
  assert.equal(await page.locator('.mia-pending').count(), 1, 'unwritten profile says it is being written');
  assert.equal(await page.locator('#record svg circle').count(), 2, 'hometown marker drawn');
  assert.equal(await page.locator('a.btn', { hasText: 'Choose this athlete' }).first().getAttribute('href'), '/hubs/bts-michigan-athletes-project.html?pick=joe-louis');
  await page.screenshot({ path: `${OUT}/profile-pending.png`, fullPage: true });

  // A written profile shows every chapter, the quote, the numbers and the sources.
  await page.goto(`${BASE}/hubs/bts-michigan-athletes-profile.html?a=jim-abbott`);
  assert.equal(await page.locator('.mia-pending').count(), 0);
  assert.deepEqual(await page.locator('.chapter h3').allTextContents(), ['Growing Up', 'The Big Moment', 'Beyond the Scoreboard', 'Legacy']);
  assert.equal(await page.locator('.profile-number').count(), 3);
  assert.match(await page.locator('.mia-quote').textContent(), /Sample quote text/);
  assert.match(await page.locator('#sources').textContent(), /Sample source/);
  assert.match(await page.locator('.record-list').textContent(), /September 19, 1967/);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'profile fits at ' + width);
    await page.screenshot({ path: `${OUT}/profile-written-${width}.png`, fullPage: true });
  }
  const axe2 = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  assert.deepEqual(axe2.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`), [], 'profile accessibility');
  await page.locator('.pager .next').click();
  assert.match(page.url(), /a=derek-jeter/);
  assert.deepEqual(external, [], 'pages use only local assets');
  assert.deepEqual(errors, []);
  await context.close();
});

await test('a pair splits the work and each partner sees the other read only', async () => {
  const s = world({ memberships: [[PEOPLE.ada, 'Period 1'], [PEOPLE.grace, 'Period 1'], [PEOPLE.katherine, 'Period 1']] });
  const school = await chromebook(s);
  const ada = await open(school, `/hubs/${HUB}.html?pick=claressa-shields`);
  await passGate(ada, s.pin(PEOPLE.ada));
  await ada.locator('#moh-setup').waitFor({ state: 'visible' });
  await ada.locator('[data-mode="start"]').click();
  await ada.locator('#stage-pick').waitFor({ state: 'visible' });
  assert.equal(await ada.locator('#pick-grid .vcard').count(), 24);
  assert.equal(await ada.locator('#pick-grid .vcard.picked').getAttribute('data-slug'), 'claressa-shields', 'the ?pick= athlete is preselected');
  await ada.screenshot({ path: `${OUT}/setup-pick.png`, fullPage: true });
  await ada.locator('[data-action="confirm-pick"]').click();
  await ada.locator('#moh-work').waitFor({ state: 'visible' });
  const code = (await ada.locator('#ws-team strong').nth(2).textContent()).trim();
  assert.match(code, /^[A-Z0-9]{4}$/);
  assert.match(await ada.locator('#ws-vet').textContent(), /Claressa Shields/);
  assert.match(await ada.locator('#ws-coach').textContent(), /Step 1 of 5/);
  assert.equal(await ada.locator('.ws-steps [data-goto]').count(), 5);
  assert.equal(await ada.locator('#moh-a-fact-born').evaluate((el) => el.readOnly), false);
  assert.equal(await ada.locator('#moh-b-fact-unit').evaluate((el) => el.readOnly), true);
  await ada.locator('#moh-a-fact-born').fill('She was born in Flint, Michigan, in 1995.');
  await ada.screenshot({ path: `${OUT}/work-facts-a.png`, fullPage: true });

  const home = await chromebook(s);
  const grace = await open(home, `/hubs/${HUB}.html`);
  await passGate(grace, s.pin(PEOPLE.grace));
  await grace.locator('[data-mode="join"]').click();
  await grace.locator('#join-code').fill(code.toLowerCase());
  await grace.locator('[data-action="join"]').click();
  await grace.locator('#moh-work').waitFor({ state: 'visible' });
  assert.match(await grace.locator('#ws-team').textContent(), /Partner B, The Career/);
  assert.equal(await grace.locator('#moh-b-fact-unit').evaluate((el) => el.readOnly), false);
  assert.equal(await grace.locator('#moh-a-fact-born').evaluate((el) => el.readOnly), true);
  await grace.locator('#moh-b-fact-unit').fill('She boxes as a middleweight and won Olympic gold.');

  await ada.evaluate(() => window.__deskSave.saveCloud && window.__deskSave.saveCloud());
  await waitFor(() => s.rows('Progress').some((r) => /born in Flint/.test(r.Answers || r.Data || '')), 15000);
  await grace.reload();
  await grace.locator('#moh-work').waitFor({ state: 'visible', timeout: 10000 });
  await waitFor(async () => /born in Flint/.test(await grace.locator('.box[data-field="moh-a-fact-born"] .partner-view').textContent()));
  await grace.screenshot({ path: `${OUT}/work-facts-b.png`, fullPage: true });
  await grace.evaluate(() => window.__deskSave.saveCloud && window.__deskSave.saveCloud());
  await waitFor(() => s.rows('Progress').some((r) => /middleweight/.test(r.Answers || r.Data || '')), 15000);
  const graceRow = s.rows('Progress').find((r) => /middleweight/.test(r.Answers || r.Data || ''));
  assert.ok(!/born in Flint/.test(graceRow.Answers || graceRow.Data), 'Grace\'s account holds only her own writing');
  const teamRow = s.rows('Project Teams').find((r) => r.Hub === HUB);
  assert.equal(teamRow.Choice, 'claressa-shields');

  // Ada sees Grace's fact after her next status check, and the preview merges both.
  await ada.reload();
  await ada.locator('#moh-work').waitFor({ state: 'visible', timeout: 10000 });
  await ada.locator('[data-goto="finish"]').click();
  await ada.locator('[data-action="preview"]').click();
  await ada.locator('#moh-preview').waitFor({ state: 'visible' });
  const paper = await ada.locator('#preview-body').innerText();
  assert.match(paper, /born in Flint/); assert.match(paper, /middleweight/);
  assert.match(paper, /Growing Up in Michigan/i); assert.match(paper, /Beyond the Scoreboard/i);

  // A classmate in the same hour finds Shields taken.
  const other = await chromebook(s);
  const alan = await open(other, `/hubs/${HUB}.html`);
  await passGate(alan, s.pin(PEOPLE.katherine));
  await alan.locator('[data-mode="solo"]').click();
  assert.equal(await alan.locator('#pick-grid .vcard[data-slug="claressa-shields"]').isDisabled(), true, 'taken athlete is locked in the same hour');
  assert.deepEqual([...ada.errors, ...grace.errors, ...alan.errors].map(String), []);
  await Promise.all([school.context.close(), home.context.close(), other.context.close()]);
});

await test('a student working alone fills every box with the next job button and turns in', async () => {
  const s = world();
  const cb = await chromebook(s);
  const kat = await open(cb, `/hubs/${HUB}.html`);
  await passGate(kat, s.pin(PEOPLE.katherine));
  await kat.locator('[data-mode="solo"]').click();
  await kat.locator('#pick-grid .vcard[data-slug="magic-johnson"]').click();
  await kat.locator('[data-action="confirm-pick"]').click();
  await kat.locator('#moh-work').waitFor({ state: 'visible' });
  assert.match(await kat.locator('#ws-team').textContent(), /Working alone/);
  let filled = 0;
  for (let i = 0; i < 40; i++) {
    await kat.locator('[data-action="next-job"]').first().click();
    const id = await kat.evaluate(() => document.activeElement && document.activeElement.id);
    if (!id || !/^moh-/.test(id)) break;
    await kat.locator('#' + id).fill(words(30, id.replace(/\W/g, '')) + ' done.');
    filled++;
  }
  assert.equal(filled, 20, 'a solo student owns 20 boxes: six facts, twelve chapter boxes, one reflection pair');
  assert.equal(await kat.locator('#step-finish').isVisible(), true, 'next job lands on Finish when everything is done');
  await waitFor(async () => (await kat.locator('#moh-checklist li.ok').count()) === 4);
  await kat.locator('[data-action="preview"]').click();
  const paper = await kat.locator('#preview-body').innerText();
  assert.doesNotMatch(paper, /not written yet/i, 'the solo paper is complete');
  assert.match(paper, /A report by/);
  await kat.screenshot({ path: `${OUT}/solo-paper.png`, fullPage: true });
  await kat.locator('[data-action="close-preview"]').click();
  await kat.screenshot({ path: `${OUT}/solo-finish.png`, fullPage: true });
  const axe = await new AxeBuilder({ page: kat }).withTags(['wcag2a', 'wcag2aa']).analyze();
  assert.deepEqual(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`), [], 'workspace accessibility');
  assert.deepEqual(kat.errors.map(String), []);
  await cb.context.close();
});

await test('the teacher page lists teams by hour and prints a merged report', async () => {
  const s = world();
  const sign = (person) => s.post({ action: 'signin', pin: s.pin(person), hub: HUB, course: 'bts', device: 'dev-' + person.email.slice(0, 3) });
  const ada = sign(PEOPLE.ada); const grace = sign(PEOPLE.grace);
  assert.ok(ada.ok && grace.ok, JSON.stringify([ada, grace]));
  const team = s.post({ action: 'team', op: 'create', token: ada.token, hub: HUB, course: 'bts', mode: 'pair', choice: 'jim-abbott', device: 'dev-ada' });
  assert.ok(team.ok, JSON.stringify(team));
  const join = s.post({ action: 'team', op: 'join', token: grace.token, hub: HUB, course: 'bts', code: team.team.code, device: 'dev-gra' });
  assert.ok(join.ok, JSON.stringify(join));
  const cbA = await chromebook(s);
  const pa = await open(cbA, `/hubs/${HUB}.html`);
  await passGate(pa, s.pin(PEOPLE.ada));
  await pa.locator('#moh-work').waitFor({ state: 'visible' });
  await pa.locator('#moh-a-fact-born').fill('He was born in Flint on September 19, 1967.');
  await pa.evaluate(() => window.__deskSave.saveCloud());
  const cbB = await chromebook(s);
  const pb = await open(cbB, `/hubs/${HUB}.html`);
  await passGate(pb, s.pin(PEOPLE.grace));
  await pb.locator('#moh-work').waitFor({ state: 'visible' });
  await pb.locator('[data-goto="story1"]').click();
  await pb.locator('#moh-b-day-1').fill(words(20, 'yankee') + ' no hitter at Yankee Stadium.');
  await pb.evaluate(() => window.__deskSave.saveCloud());
  await waitFor(() => s.rows('Progress').filter((r) => /moh-/.test(r.Data || '')).length >= 2, 15000);

  const cb = await chromebook(s, { gate: false });
  const page = await cb.context.newPage();
  page.errors = []; page.on('pageerror', (e) => page.errors.push(e));
  await page.goto(`${BASE}/teacher/michigan-athletes.html`);
  await page.locator('[data-action="load"]').first().click();
  await waitFor(async () => /Teacher Key tab/.test(await page.locator('#msg').textContent()));
  const real = s.book().getSheetByName('Teacher Key').getRange(2, 1).getValue();
  await page.locator('#key').fill(real);
  await page.locator('[data-action="load"]').first().click();
  await page.locator('.team').first().waitFor({ state: 'visible' });
  const text = await page.locator('.team').first().innerText();
  assert.match(text, /Jim Abbott/); assert.match(text, /Ada/); assert.match(text, /Grace/); assert.match(text, /The Career/);
  assert.equal(await page.locator('.team').first().locator('.bars').first().locator('i').count(), 4, 'four progress bars');
  await page.screenshot({ path: `${OUT}/teacher.png`, fullPage: true });
  await page.locator('.team').first().getByRole('button', { name: 'Report' }).click();
  await page.locator('#preview').waitFor({ state: 'visible' });
  const paper = await page.locator('#preview-body').innerText();
  assert.match(paper, /September 19, 1967/, 'Partner A writing is in the report');
  assert.match(paper, /Yankee Stadium/, 'Partner B writing is in the report');
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: `${OUT}/teacher-report.pdf`, format: 'Letter' });
  await page.emulateMedia({ media: 'screen' });
  await page.locator('[data-action="close"]').click();
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  assert.deepEqual(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`), [], 'teacher page accessibility');
  assert.deepEqual([...page.errors, ...pa.errors, ...pb.errors].map(String), []);
  await Promise.all([cb.context.close(), cbA.context.close(), cbB.context.close()]);
});

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
