const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const cases=[
  {
    "slug": "acoustic-kitty",
    "route": "/hubs/hh-bytesize-acoustic-kitty.html",
    "lab": "cat"
  },
  {
    "slug": "bat-bombs",
    "route": "/hubs/hh-bytesize-bat-bombs.html",
    "lab": "chain"
  },
  {
    "slug": "stargate",
    "route": "/hubs/hh-bytesize-stargate.html",
    "lab": "targets"
  },
  {
    "slug": "ghost-army",
    "route": "/hubs/hh-bytesize-ghost-army.html",
    "lab": "ghost"
  },
  {
    "slug": "mincemeat",
    "route": "/hubs/hh-bytesize-mincemeat.html",
    "lab": "pockets"
  },
  {
    "slug": "the-thing",
    "route": "/hubs/hh-bytesize-the-thing.html",
    "lab": "beam"
  },
  {
    "slug": "sea-spray",
    "route": "/hubs/hh-bytesize-sea-spray.html",
    "lab": "ladder"
  },
  {
    "slug": "moon-hoax",
    "route": "/hubs/hh-bytesize-moon-hoax.html",
    "lab": "press"
  },
  {
    "slug": "project-pigeon",
    "route": "/hubs/hh-bytesize-project-pigeon.html",
    "lab": "pigeon"
  },
  {
    "slug": "iceworm",
    "route": "/hubs/hh-bytesize-iceworm.html",
    "lab": "ice"
  },
{
  "slug": "habbakuk",
  "route": "/hubs/hh-bytesize-habbakuk.html",
  "lab": "carrier"
},
{
  "slug": "philadelphia-experiment",
  "route": "/hubs/hh-bytesize-philadelphia-experiment.html",
  "lab": "detector"
}
];

const requested = (process.env.BYTE_SIZE_CASES || '').split(',').filter(Boolean);
const selected = requested.length ? cases.filter(story => requested.includes(story.slug)) : cases;
if (!selected.length) throw new Error('No matching ByteSize cases');

const origin = 'http://127.0.0.1:4399';
const output = path.resolve('browser-results/hidden-history-bytesize');
const dist = path.resolve('dist');
const results = [];
fs.mkdirSync(output, { recursive: true });

// Each test owns its server and blocks school/third-party services.
const server = http.createServer((req, res) => {
  const local = path.resolve(dist, '.' + decodeURIComponent(new URL(req.url, origin).pathname));
  if (!local.startsWith(dist + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const file = fs.statSync(local).isDirectory() ? path.join(local, 'index.html') : local;
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp', '.mp4': 'video/mp4', '.vtt': 'text/vtt', '.css': 'text/css' };
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

async function blockServices(context) {
  await context.route('**/*', route => new URL(route.request().url()).origin === origin
    ? route.continue()
    : route.fulfill({ status: 503, body: 'Offline acceptance fixture' }));
}

(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(4399, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true });
    for (const width of [320, 390, 1440]) {
      for (const story of selected) {
        const context = await browser.newContext({ viewport: { width, height: 950 } });
        await blockServices(context);
        const page = await context.newPage();
        page.setDefaultTimeout(20_000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          assert.equal((await page.goto(origin + story.route)).status(), 200);
          await page.waitForFunction(() => window.__deskSave?.ready);
          assert.equal(await page.locator('h1').count(), 1);
          assert.equal(await page.locator('textarea').count(), 3);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
          const choices = page.locator('[data-choice]');
          for (let index = 0; index < await choices.count(); index++) {
            await choices.nth(index).click();
            assert.ok(!(await page.locator('#lab-feedback').innerText()).includes('Choose a control'));
          }
          await choices.first().focus();
          await page.keyboard.press('Enter');
          assert.equal(await choices.first().getAttribute('aria-pressed'), 'true');
          if (story.lab === 'beam') {
            await choices.nth(0).click();
            await choices.nth(2).click();
            assert.ok((await page.locator('#lab-feedback').innerText()).includes('detectable'));
            await choices.nth(1).click();
            await choices.nth(2).click();
            assert.ok((await page.locator('#lab-feedback').innerText()).includes('does not prove'));
          }
          if (story.lab === 'press') {
            await choices.nth(2).click();
            assert.ok((await page.locator('#copy-count').innerText()).includes('11 copies / 1 claim'));
          }
          if (story.lab === 'ice') {
            await choices.nth(1).click();
            assert.ok((await page.locator('.ice-model').getAttribute('class')).includes('deformed'));
            await choices.nth(0).click();
            assert.equal(await page.locator('.ice-model').getAttribute('class'), 'ice-model');
          }
          if (story.lab === 'carrier' || story.lab === 'detector') {
            const cards = page.locator(story.lab === 'carrier' ? '.requirement' : '.detector');
            for (let index = 0; index < 3; index++) {
              await choices.nth(index).click();
              assert.equal(await cards.nth(index).getAttribute('class'), (story.lab === 'carrier' ? 'requirement' : 'detector') + ' active');
              if (story.lab === 'detector') assert.ok(await page.locator('.model-ship').isVisible(), 'Ship remains visible for every detector');
            }
          }
          await page.locator('#answer-1').fill('Synthetic test answer: a real record can contain an unverified claim.');
          await page.reload();
          await page.waitForFunction(() => window.__deskSave?.ready);
          assert.ok((await page.locator('#answer-1').inputValue()).includes('Synthetic test answer'));
          if (width === 320) {
            const otherTab = await context.newPage();
            await otherTab.goto(origin + story.route);
            await otherTab.waitForFunction(() => window.__deskSave?.ready);
            assert.equal(await otherTab.locator('#answer-1').inputValue(), '', 'A fresh student tab is blank');
            await otherTab.close();
          }
          await page.locator('video').evaluate(video => video.load());
          await page.waitForFunction(() => document.querySelector('video').readyState >= 1);
          assert.equal(await page.locator('video').evaluate(video => video.duration), 28);
          await page.locator('video').evaluate(video => video.play());
          await page.waitForFunction(() => document.querySelector('video').currentTime > 0.3);
          await page.locator('video').evaluate(video => video.pause());
          assert.equal(await page.locator('track[kind=captions]').count(), 1);
          const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
          assert.deepEqual(audit.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })), []);
          assert.deepEqual(errors, [], 'No uncaught page errors');
          await page.screenshot({ path: path.join(output, `${story.slug}-${width}.png`), fullPage: true, timeout: 30_000 });
          results.push({ case: story.slug, width, status: 'passed' });
          console.log('PASS', width, story.slug);
        } catch (error) {
          console.error('FAIL', width, story.slug, error.message);
          results.push({ case: story.slug, width, status: 'failed', error: error.message });
          await page.screenshot({ path: path.join(output, `${story.slug}-${width}-failed.png`), fullPage: true, timeout: 30_000 }).catch(() => {});
        } finally {
          await context.close();
        }
      }
    }
    for (const story of selected) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      try {
        await blockServices(context);
        const page = await context.newPage();
        await page.goto(origin + story.route);
        assert.equal(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length), 0);
      } finally {
        await context.close();
      }
    }
    console.log(`Hidden History ByteSize: ${results.filter(result => result.status === 'passed').length}/${results.length} browser cases; ${selected.length} reduced-motion cases.`);
    if (results.some(result => result.status === 'failed')) process.exitCode = 1;
  } finally {
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(results, null, 2));
    await browser?.close();
    server.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
