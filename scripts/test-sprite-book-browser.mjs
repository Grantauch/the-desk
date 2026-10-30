// Real local browser play; synthetic town sessions and browser-local camp only.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd(), port = 18889, campPort = 18890;
const out = path.join(root, 'browser-results/sprite-book');
await mkdir(out, { recursive: true });
const data = await mkdtemp(path.join(os.tmpdir(), 'sprite-book-'));
const town = spawn(process.execPath, ['apps/checkaverse/server.mjs'], {
  env: { ...process.env, CHECKAVERSE_PORT: String(port), CHECKAVERSE_DATA: data,
    CHECKAVERSE_ORIGINS: `http://127.0.0.1:${port}`, CHECKAVERSE_TEST_SPAWN: '14,13' }, stdio: 'ignore',
});
const staticServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  const p = path.resolve(root, 'public', '.'+url.pathname+(url.pathname.endsWith('/') ? 'index.html' : ''));
  if (!p.startsWith(path.join(root, 'public')+path.sep)) { res.writeHead(404); return res.end(); }
  try {
    const bytes = await readFile(p);
    const type = { '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.html':'text/html', '.png':'image/png', '.gif':'image/gif', '.ttf':'font/ttf' }[path.extname(p)];
    res.writeHead(200, { 'Content-Type':type || 'application/octet-stream' }); res.end(bytes);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => staticServer.listen(campPort, '127.0.0.1', resolve));
let browser;
try {
  for (let i=0;i<50;i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break; } catch {}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  browser = await chromium.launch({ headless:true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
    args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport:{ width:1366,height:768 } });
  const page = await context.newPage(), errors = [], failedArt = [];
  page.on('pageerror', error=>errors.push(error.message));
  page.on('response', response=>{ if (/\/art\/|\/assets\//.test(response.url()) && !response.ok()) failedArt.push(response.url()); });
  await page.goto(`http://127.0.0.1:${port}/?debug`);
  const registry = JSON.parse(await readFile(path.join(root, 'apps/checkaverse/content/sprites.json'), 'utf8'));
  assert.deepEqual(await page.locator('#sprite-content').evaluate(t=>JSON.parse(t.content.textContent)), registry,
    'served generated presentation data matches the authoritative registry');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Live'));
  await page.waitForFunction(()=>performance.getEntriesByType('resource').some(e=>e.name.endsWith('/art/prop-bus-v2.png')));
  await page.screenshot({ path:path.join(out,'plaza.png') });
  await page.evaluate(()=>{
    window.walkSamples=[];
    const sample=()=>{const g=window.__checkaverse,p=g.players.get(g.me());window.walkSamples.push({x:p.dx,y:p.dy,t:performance.now()});if(window.walkSamples.length<75)requestAnimationFrame(sample);};
    requestAnimationFrame(sample);
  });
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(600); await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(800);
  const samples = await page.evaluate(()=>window.walkSamples);
  assert.ok(samples.some(p=>Math.abs(p.x-Math.round(p.x))>.05), 'walking paints intermediate positions');
  assert.ok(samples.at(-1).x>samples[0].x, 'trainer walked through plaza');
  for (let i=1;i<samples.length;i++) assert.ok(samples[i].x>=samples[i-1].x-.01, 'walking does not snap backward');
  assert.equal(await page.locator('#town').evaluate(c=>c.getContext('2d').imageSmoothingEnabled), false);
  await page.locator('#goHome').click();
  await page.waitForFunction(()=>document.querySelector('#place').textContent==='Your house', { timeout:20000 });
  await page.screenshot({ path:path.join(out,'interior.png') });
  assert.deepEqual(failedArt, []);
  console.log('PASS 1366x768 plaza walk: interpolated motion, v2 assets, nearest rendering, house entrance');

  await page.goto(`http://127.0.0.1:${campPort}/hubs/checkling/camp/`);
  await page.waitForFunction(()=>document.querySelector('.actor[data-pet="mochi"] img')?.src.endsWith('mochi-front-idle.png'));
  await page.locator('[data-care="feed"]').first().click();
  assert.match(await page.locator('#save-status').textContent(), /Saved/);
  await page.screenshot({ path:path.join(out,'care.png') });
  await page.locator('[data-view="practice"]').click();
  await page.locator('#start-practice').click();
  await page.waitForFunction(()=>document.querySelector('#battle-friend-art').src.endsWith('mochi-back-idle.png'));
  await page.locator('[data-move="guard"]').click();
  await page.screenshot({ path:path.join(out,'battle.png') });
  assert.equal(await page.locator('#battle-friend-art').evaluate(i=>getComputedStyle(i).imageRendering), 'pixelated');
  assert.equal(await page.locator('#battle-friend-art').evaluate(i=>i.naturalWidth), 32);
  await page.locator('#open-menu').click(); await page.locator('#quiet-toggle').click();
  await page.waitForFunction(()=>document.querySelector('#battle-friend-art').src.endsWith('mochi-back.png'));
  console.log('PASS 1366x768 camp: care, saved progress, practice turn, back pose, quiet still');
  assert.deepEqual(errors, []);

  const legacy = await context.newPage();
  const legacyErrors = [];
  legacy.on('pageerror', error=>legacyErrors.push(error.message));
  await legacy.route(`http://127.0.0.1:${port}/plaza.js*`, async route=>{
    const code = await readFile(path.join(root, 'apps/checkaverse/public/plaza.js'), 'utf8');
    await route.fulfill({ body:"document.getElementById('sprite-content')?.remove();\n"+code,contentType:'text/javascript' });
  });
  await legacy.goto(`http://127.0.0.1:${port}/?legacy`);
  try { await legacy.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Live'), null, { timeout:10000 }); }
  catch { throw new Error('Legacy plaza: '+await legacy.locator('#status').textContent()+'; '+legacyErrors.join('; ')); }
  await legacy.waitForFunction(()=>performance.getEntriesByType('resource').some(e=>e.name.endsWith('/art/house-cottage.png')));
  assert.equal((await legacy.request.get(`http://127.0.0.1:${port}/art/house-cottage.png`)).status(), 200);
  await legacy.close();
  console.log('PASS cached plaza HTML uses preserved original art URLs');

  // Failed registry keeps the original game usable; rejected Zee is never registered.
  const fallback = await context.newPage();
  await fallback.route('**/assets/sprite-book.json', route=>route.abort());
  await fallback.goto(`http://127.0.0.1:${campPort}/hubs/checkling/camp/`);
  await fallback.waitForFunction(()=>document.querySelector('.actor[data-pet="mochi"] img')?.src.includes('/assets/mochi.'));
  console.log('PASS missing art registry falls back to preserved founder files');
  console.log('NOT TESTABLE: this source has no tile-walkable Kettle Creek; Waves 3/4 sources unavailable.');
} finally {
  await browser?.close();
  staticServer.close(); town.kill();
  await rm(data, { recursive:true,force:true });
}
