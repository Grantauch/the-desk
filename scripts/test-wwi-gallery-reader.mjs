import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';

const publicRoot = resolve('public');

// The reader is the same content as the 3D galleries. Fail if a gallery
// placard is added or renamed without the reader following it.
const readerHtml = await readFile(resolve(publicRoot, 'hubs/wwi-gallery-reader.html'), 'utf8');
for (const gallery of ['ush9-the-arsenal.html', 'ush9-over-the-top.html']) {
  const source = await readFile(resolve(publicRoot, 'hubs', gallery), 'utf8');
  const titles = [...source.matchAll(/\{id:"[a-z]+",(?:no:"[IVX]+",)?(?:when:"[^"]*",)?title:"([^"]+)"/g)].map(m => m[1]);
  assert.ok(titles.length >= 7, gallery + ' placards found');
  for (const title of titles) assert.ok(readerHtml.includes('<h3>' + title + '</h3>'), 'reader is missing ' + title);
}
console.log('PASS reader carries every gallery placard');
const output = resolve('browser-results/wwi-readable-fallback');
await mkdir(output, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://local.test').pathname;
    const candidate = resolve(publicRoot, '.' + pathname);
    assert.ok(candidate.startsWith(publicRoot + sep));
    res.writeHead(200, { 'Content-Type': extname(candidate) === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(await readFile(candidate));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const origin = 'http://127.0.0.1:' + server.address().port;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const viewport of [{width:320,height:740},{width:390,height:844},{width:1366,height:768}]) {
    const context = await browser.newContext({ viewport, reducedMotion:'reduce' });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin
      ? route.continue() : route.fulfill({ status: 503, body:'Offline test' }));
    const page = await context.newPage();
    try {
      const response = await page.goto(origin + '/hubs/wwi-gallery-reader.html');
      assert.equal(response?.status(), 200, 'reader returns 200');
      assert.equal(await page.locator('#arsenal article').count(), 10, 'ten Arsenal exhibits');
      assert.equal(await page.locator('#over-the-top article').count(), 7, 'seven trench questions');
      assert.ok(await page.getByRole('heading', { name:'The battlefield changed.' }).isVisible());
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true,
        viewport.width + 'px reader must not overflow');
      await page.getByRole('link', {name:'The Arsenal',exact:true}).click();
      assert.ok(page.url().endsWith('#arsenal'));
      await page.screenshot({ path: resolve(output, 'reader-'+viewport.width+'.png'), fullPage:false });
      console.log('PASS accessible WWI reader', viewport.width);
    } finally { await context.close(); }
  }

  for (const scenario of [
    {name:'arsenal',path:'/hubs/ush9-the-arsenal.html',hash:'#arsenal'},
    {name:'trench',path:'/hubs/ush9-over-the-top.html',hash:'#over-the-top'}
  ]) {
    const context = await browser.newContext({ viewport:{width:390,height:844}, reducedMotion:'reduce' });
    await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...options) {
        return type === 'webgl2' ? null : original.call(this, type, ...options);
      };
    });
    const page = await context.newPage();
    try {
      await page.goto(origin + scenario.path, {waitUntil:'domcontentloaded'}).catch(() => {});
      await page.waitForURL(new RegExp('wwi-gallery-reader\\.html' + scenario.hash.replace('#', '#') + '$'), {timeout:15000});
      assert.ok(await page.locator(scenario.hash).isVisible());
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      console.log('PASS no WebGL2 redirects to', scenario.name);
    } finally { await context.close(); }
  }

  const noScript = await browser.newContext({viewport:{width:390,height:844},javaScriptEnabled:false});
  const page = await noScript.newPage();
  try {
    const response = await page.goto(origin + '/hubs/wwi-gallery-reader.html');
    assert.equal(response?.status(), 200);
    assert.equal(await page.locator('#arsenal article').count(),10);
    console.log('PASS no-JavaScript standalone WWI field guide');
  } finally { await noScript.close(); }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
