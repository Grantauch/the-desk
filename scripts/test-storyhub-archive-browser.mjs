import assert from 'node:assert/strict';
import { preview } from 'astro';
import { chromium } from 'playwright';

const pages = [
  ['bts-s01-the-death-harvest', 1],
  ['hh-s01-the-desk-it-stopped-at', 2],
  ['ush9-s01-the-margin', 2],
];
const archiveHosts = new Set(['upload.wikimedia.org', 'thumb.wikimedia.org', 'www.nps.gov']);
// A valid one-pixel GIF makes the browser decode and fire load without contacting archives.
const photo = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
let server;
let browser;

try {
  server = await preview({ server: { host: '127.0.0.1', port: 4436 } });
  const origin = `http://127.0.0.1:${server.port}`;
  browser = await chromium.launch({ headless: true });
  for (const mode of ['available', 'blocked', 'no-js']) {
    const context = await browser.newContext({
      javaScriptEnabled: mode !== 'no-js',
      serviceWorkers: 'block',
      viewport: { width: mode === 'no-js' ? 1280 : 390, height: 844 },
      reducedMotion: 'reduce',
    });
    try {
      await context.route('**/*', route => {
        const request = route.request();
        const url = new URL(request.url());
        if (request.resourceType() === 'image' && archiveHosts.has(url.hostname)) {
          return mode === 'blocked' ? route.abort('failed')
            : route.fulfill({ contentType: 'image/gif', body: photo });
        }
        // Archive links stay on the page, but classroom and all other external
        // services are isolated. No account, answer, or submission is used.
        return url.origin === origin && !url.pathname.startsWith('/.netlify/')
          ? route.continue() : route.fulfill({ status: 503, body: 'Offline browser fixture' });
      });
      await context.addInitScript(() => { window.__deskSaveTest = { gate: false, endpoint: '' }; });
      const page = await context.newPage();
      page.setDefaultTimeout(6_000);
      page.setDefaultNavigationTimeout(12_000);
      for (const [story, count] of pages) {
        const label = `${mode} ${story}`;
        const errors = [];
        const recordError = error => errors.push(error.message);
        page.on('pageerror', recordError);
        try {
          const response = await page.goto(`${origin}/hubs/${story}.html`, { waitUntil: 'domcontentloaded' });
          assert.equal(response?.status(), 200, label);
          const anchors = page.locator('[data-archive-media]');
          assert.equal(await anchors.count(), count, label);
          assert.equal(await page.locator('[data-archive-media][data-preserve-story-art]').count(), count, label);
          if (story === 'bts-s01-the-death-harvest') {
            const diagram = page.locator('.plate.rules-measure[data-preserve-story-art]');
            assert.equal(await diagram.count(), 1, label);
            assert.match(await diagram.getAttribute('aria-label'), /1905.*1906/, label);
          }
          if (mode !== 'no-js') {
            assert.ok(await page.locator('section.story .story-art').count(), `${label}: unmarked reconstructions still render`);
          }
          for (const [index, scope] of (await anchors.all()).entries()) {
            if (mode !== 'no-js') {
              await scope.evaluate(el => el.scrollIntoView({ block: 'center' }));
              const state = mode === 'available' ? 'archival' : 'unavailable';
              await anchors.nth(index).and(page.locator(`[data-archive-state="${state}"]`)).waitFor({ state: 'attached' });
            }
            const v = await scope.evaluate(el => {
              const image = el.querySelector('[data-archive-image]');
              const caption = el.querySelector('[data-archive-label]');
              const area = el.closest('.heroGrid, section.story');
              return {
                state: el.dataset.archiveState,
                alt: image.alt,
                archiveAlt: image.dataset.archiveAlt,
                caption: caption.textContent,
                archiveCaption: caption.dataset.archiveLoadedLabel,
                visibility: getComputedStyle(image).visibility,
                width: image.naturalWidth,
                source: el.querySelector('a[href^="https://"]')?.href,
                duplicate: !!area?.querySelector('.story-art'),
              };
            });
            assert.match(v.source ?? '', /^https:\/\/.+/, `${label}: source is still linked`);
            assert.equal(v.duplicate, false, `${label}: no duplicate generated artwork`);
            if (mode === 'available') {
              assert.equal(v.state, 'archival', label);
              assert.equal(v.alt, v.archiveAlt, label);
              assert.equal(v.caption, v.archiveCaption, label);
              assert.equal(v.visibility, 'visible', label);
              assert.ok(v.width > 0, label);
            } else {
              assert.equal(v.state, mode === 'blocked' ? 'unavailable' : undefined, label);
              assert.equal(v.alt, '', label);
              assert.equal(v.visibility, 'hidden', label);
              assert.notEqual(v.caption, v.archiveCaption, label);
              assert.match(v.caption, /NOT SHOWN/, label);
              if (story === 'hh-s01-the-desk-it-stopped-at' && index === 0) {
                assert.match(v.caption, /EDITORIAL TEXT SUMMARY, NOT A FACSIMILE/, label);
              }
            }
          }
          assert.deepEqual(errors, [], label);
          console.log(`PASS ${label} (${count} archival figure${count === 1 ? '' : 's'})`);
        } finally {
          page.off('pageerror', recordError);
        }
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await server?.stop();
}
