import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { preview } from 'astro';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const route = '/storyhubs/pearl-harbor/';
const artifact = 'browser-results/pearl-harbor';
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const viewport = (width, height = 900) => ({ width, height });
const server = process.env.PEARL_TEST_ORIGIN ? undefined : await preview({ server: { host: '127.0.0.1', port: 4458 } });
const origin = process.env.PEARL_TEST_ORIGIN || 'http://127.0.0.1:' + server.port;
const browser = await chromium.launch();
mkdirSync(artifact, { recursive: true });

const close = async (page) => {
  await page.keyboard.press('Escape');
  await page.locator('dialog[data-companion]').waitFor({ state: 'hidden' });
};
const dock = (page, tool) => page.locator('[data-companion-dock] [data-open-tool="' + tool + '"]');
const panel = (page) => page.locator('[data-companion]');
const tab = (page, tool) => panel(page).locator('[data-open-tool="' + tool + '"]');
const card = (node, selector) => node.locator(selector + ':visible');
const chapter = async (page, id) => {
  await page.evaluate((hash) => { location.hash = hash; }, id);
  await page.waitForFunction((hash) => location.hash === '#' + hash
    && document.querySelector('[data-chapter-link="' + hash + '"]')?.getAttribute('aria-current') === 'location', id);
};

async function isolated(options = {}, block = () => false) {
  const ctx = await browser.newContext({ ...options, serviceWorkers: 'block' });
  const remote = [];
  await ctx.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin || url.pathname.startsWith('/.netlify/')) {
      remote.push(url.pathname);
      return route.abort('blockedbyclient');
    }
    return block(url.pathname) ? route.abort('failed') : route.continue();
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(9_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return { ctx, page, errors, remote };
}

async function load(page, hash = '', query = '') {
  assert.equal((await page.goto(origin + route + query + hash, { waitUntil: 'domcontentloaded' }))?.status(), 200);
  await page.locator('[data-setting="text"]').waitFor();
}

async function fit(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page fits viewport');
}
async function accessibility(page, label) {
  const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
  assert.deepEqual(violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) })), [], label);
}

async function desktop() {
  const { ctx, page, errors, remote } = await isolated({ viewport: viewport(1440), reducedMotion: 'reduce' });
  try {
    const catalog = await page.goto(origin + '/storyhubs/');
    assert.equal(catalog?.status(), 200);
    await page.getByRole('link', { name: 'Pearl Harbor: The Morning That Changed the World', exact: true }).click();
    await page.locator('[data-setting="text"]').waitFor();
    assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), 'https://grant-desk.com' + route);
    assert.equal(await page.locator('[data-story-chapter]').count(), 12);
    assert.equal(await page.locator('textarea, input[name=pin], script[src*="desk-save"]').count(), 0);
    // Catalog loads the shared site shell. Only requests from the documentary matter here.
    remote.length = 0;
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.pearl-opening img').evaluate((img) => img.decode());
    await page.screenshot({ path: artifact + '/opening-desktop.png' });
    await page.getByRole('link', { name: 'Begin the briefing' }).click();
    assert.equal(new URL(page.url()).hash, '#briefing');
    for (const topic of ['who', 'what', 'when', 'where', 'why']) assert.ok(await page.locator('#' + topic + ' h3').isVisible());
    await page.locator('#who [data-cast-picker]').selectOption('nagumo');
    const intro = page.locator('#when');
    for (const scale of ['years', 'months', 'days', 'hours']) {
      await intro.locator('[data-scale="' + scale + '"]').click();
      assert.equal(await intro.locator('[data-scale="' + scale + '"]').getAttribute('aria-pressed'), 'true');
    }
    await intro.locator('[data-time-picker]').selectOption('opana-return');
    const scrub = intro.locator('[data-time-scrub]');
    await scrub.focus();
    const time = await scrub.inputValue();
    await scrub.press('ArrowRight');
    assert.equal(Number(await scrub.inputValue()), Number(time) + 1);
    await intro.locator('[data-time-step="1"]').click();
    assert.equal(await intro.locator('[data-time-picker]').inputValue(), 'opana-call');

    await chapter(page, 'admirals-gamble');
    const inline = page.locator('#admirals-gamble .sh-reference--inline[data-reference-id="yamamoto"]');
    await inline.evaluate((link) => link.scrollIntoView({ block: 'center' }));
    await inline.focus();
    const oldTop = await inline.evaluate((link) => link.getBoundingClientRect().top);
    await inline.press('Enter');
    assert.equal(await card(panel(page), '[data-person-card]').getAttribute('data-person-card'), 'yamamoto');
    await panel(page).getByText('More about Isoroku Yamamoto', { exact: true }).click();
    assert.ok(await panel(page).getByText('Yamamoto grew up', { exact: false }).isVisible());
    await page.screenshot({ path: artifact + '/yamamoto-desktop.png' });
    await close(page);
    assert.equal(await inline.evaluate((link) => document.activeElement === link), true);
    const newTop = await inline.evaluate((link) => link.getBoundingClientRect().top);
    assert.ok(Math.abs(oldTop - newTop) <= 2, 'close keeps the line at the same viewport position');

    await chapter(page, 'first-wave');
    await page.locator('#first-wave [data-time-picker]').selectOption('second-wave');
    await page.getByRole('link', { name: 'Open the synchronized map' }).click();
    assert.equal(await panel(page).locator('[data-map-layer]').inputValue(), 'second-wave');
    assert.equal(await card(panel(page), '[data-place-card]').getAttribute('data-place-card'), 'hickam');
    await panel(page).getByRole('button', { name: 'Zoom map in' }).click();
    assert.equal(await panel(page).locator('[data-map]').evaluate((map) => map.style.getPropertyValue('--sh-zoom')), '1.5');
    const mapWindow = card(panel(page), '[data-map-sheet]').locator('[data-map-window]');
    const left = await mapWindow.evaluate((node) => node.scrollLeft);
    await mapWindow.press('ArrowRight');
    await page.waitForFunction((start) => document.querySelector('dialog [data-map-sheet]:not([hidden]) [data-map-window]').scrollLeft > start, left);
    await tab(page, 'timeline').click();
    const timeline = panel(page).locator('[data-timeline]');
    assert.equal(await timeline.locator('[data-time-picker]').inputValue(), 'second-wave');
    await timeline.locator('[data-time-step="1"]').click();
    await tab(page, 'map').click();
    assert.equal(await card(panel(page), '[data-map-sheet]').getAttribute('data-map-sheet'), 'harbor');
    assert.equal(await card(panel(page), '[data-place-card]').getAttribute('data-place-card'), 'nevada');
    await close(page);

    await chapter(page, 'battleship-row');
    const row = page.locator('#battleship-row [data-map]');
    assert.ok(await row.locator('[data-map-window]').evaluate((map) => map.scrollHeight <= map.clientHeight + 1), 'Fit includes the entire original station chart');
    await row.locator('[data-place-picker]').selectOption('oklahoma');
    assert.match(await card(row, '[data-place-card]').innerText(), /429 aboard died/);
    await row.locator('[data-place-picker]').selectOption('maryland');
    assert.match(await card(row, '[data-place-card]').innerText(), /remained afloat/);
    await page.locator('#chart-title').evaluate((heading) => heading.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: artifact + '/moorings-desktop.png' });
    await chapter(page, 'warnings');
    await page.locator('#warning-chain summary').nth(1).click();
    assert.ok(await page.locator('#warning-chain details').nth(1).getAttribute('open') !== null);
    await page.locator('#warnings').getByRole('button', { name: 'Zoom record in' }).click();
    assert.ok(await page.locator('#warnings [data-media-window]').evaluate((node) => node.scrollWidth > node.clientWidth));
    await chapter(page, 'december-eight');
    await page.locator('[data-audio-seek="169"]').click();
    await page.waitForFunction(() => {
      const audio = document.querySelector('audio[data-audio-player]');
      return audio && audio.duration > 410 && audio.currentTime >= 169 && !audio.paused;
    });
    assert.match(await page.locator('[data-audio-cue][aria-current]').innerText(), /Malaya/);
    await page.locator('audio').evaluate((audio) => audio.pause());

    await chapter(page, 'world-after');
    await page.locator('#then-now').getByRole('button', { name: 'The memorial' }).click();
    assert.equal(await page.locator('#then-now').count(), 1);
    assert.equal(await page.locator('[data-comparison-grid][data-view="b"] [data-comparison-side="a"]').isVisible(), false);
    await page.locator('#world-after details.sh-scenario summary').last().click();
    assert.match(await page.locator('#world-after details.sh-scenario[open]:not(.sh-scenario--actual)').innerText(), /American entry is delayed/);
    await fit(page);
    await accessibility(page, 'desktop documentary');
    assert.deepEqual(errors, []);
    assert.deepEqual(remote, []);
  } finally { await ctx.close(); }
}

async function mobile(width) {
  const { ctx, page, errors } = await isolated({ viewport: viewport(width, 840), isMobile: true, hasTouch: true });
  try {
    await load(page, '#admirals-gamble');
    await page.locator('#admirals-gamble [data-reference-id="yamamoto"]').first().tap();
    assert.equal(await panel(page).evaluate((node) => node.matches(':modal')), true);
    await fit(page);
    await accessibility(page, 'mobile cast at ' + width);
    if (width === 390) {
      await page.screenshot({ path: artifact + '/yamamoto-phone.png' });
      await page.setViewportSize(viewport(940, 550));
      await page.waitForFunction(() => document.querySelector('dialog[open]') && !document.querySelector('dialog').matches(':modal'));
      assert.equal(await card(panel(page), '[data-person-card]').getAttribute('data-person-card'), 'yamamoto');
      await page.setViewportSize(viewport(width, 840));
      await page.waitForFunction(() => Boolean(document.querySelector('dialog:modal')));
    }
    await panel(page).getByRole('button', { name: 'Close reference panel' }).tap();
    for (const [id, tool] of [['battleship-row', 'map'], ['second-wave', 'timeline'], ['what-survived', 'context']]) {
      await chapter(page, id);
      await dock(page, tool).tap();
      assert.equal(await panel(page).getAttribute('open'), '');
      assert.notEqual(await panel(page).locator('[data-panel-chapter]').innerText(), 'Historical briefing');
      await close(page);
    }
    await dock(page, 'context').tap();
    await panel(page).getByRole('button', { name: 'Glossary' }).tap();
    assert.ok(await panel(page).getByText('Belligerent', { exact: true }).isVisible());
    await close(page);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
}

async function navigation() {
  const { ctx, page, errors } = await isolated({ viewport: viewport(1280), reducedMotion: 'reduce' });
  try {
    await load(page, '#event-opana-return');
    assert.equal(await page.locator('#when [data-time-picker]').inputValue(), 'opana-return');
    await chapter(page, 'warnings');
    await page.goBack();
    assert.ok(await page.locator('#event-opana-return').isVisible());
    await page.goForward();
    assert.equal(new URL(page.url()).hash, '#warnings');
    await page.reload();
    await page.getByRole('button', { name: 'Text view', exact: true }).click();
    await page.getByRole('button', { name: 'Larger type', exact: true }).click();
    await page.reload();
    assert.equal(await page.getByRole('button', { name: 'Text view', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('button', { name: 'Larger type', exact: true }).getAttribute('aria-pressed'), 'true');
    await load(page, '#warnings', '?mode=chapter&present=1');
    assert.equal(await page.locator('[data-story-chapter]:visible').count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Projector view' }).getAttribute('aria-pressed'), 'true');
    await page.locator('#warnings [data-chapter-travel] a').last().click();
    assert.equal(await page.locator('[data-story-chapter]:visible').getAttribute('id'), 'first-wave');
    await page.goBack();
    assert.equal(await page.locator('[data-story-chapter]:visible').getAttribute('id'), 'warnings');
    await fit(page);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
}

async function fallbacks() {
  const outage = await isolated({ viewport: viewport(390, 840), reducedMotion: 'reduce' }, (path) =>
    /\/(prewar(?:-small)?\.webp|roosevelt-address\.mp3)$/.test(path));
  try {
    await load(outage.page);
    assert.ok(await outage.page.locator('.pearl-opening [data-image-fallback]:visible').count());
    await chapter(outage.page, 'december-eight');
    await outage.page.locator('[data-audio-seek="10"]').click();
    await outage.page.locator('[data-audio-fallback]').waitFor();
    assert.ok(await outage.page.locator('[data-audio-cue="10"]').isVisible());
    assert.deepEqual(outage.errors, []);
  } finally { await outage.ctx.close(); }
  const unenhanced = await isolated({ javaScriptEnabled: false, viewport: viewport(360, 700) });
  try {
    const page = unenhanced.page;
    assert.equal((await page.goto(origin + route))?.status(), 200);
    await page.locator('#admirals-gamble [data-reference-id="yamamoto"]').first().click();
    assert.equal(new URL(page.url()).hash, '#person-yamamoto');
    assert.ok(await page.locator('#person-yamamoto').isVisible());
    assert.equal(await page.locator('[data-story-chapter]:visible').count(), 12);
    assert.ok(await page.locator('[data-audio-cue="382"]').isVisible());
    await fit(page);
  } finally { await unenhanced.ctx.close(); }
}

try {
  await desktop();
  for (const width of [320, 390]) await mobile(width);
  await navigation();
  await fallbacks();
  console.log('PASS Pearl Harbor: catalog, briefing, 12 chapters, cross-tool references, archival controls, 320/390/1440 layout and WCAG, touch, orientation, focus, reading modes and fallbacks.');
} finally {
  await browser.close();
  await server?.stop();
}
