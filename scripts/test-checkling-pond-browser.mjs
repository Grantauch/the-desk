import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { preview } from 'astro';
import AxeBuilder from '@axe-core/playwright';
const require = createRequire(import.meta.url);
const { classroom, PEOPLE } = require('./lib/hall-pass-fixtures.cjs');
const origin = 'http://127.0.0.1:4396';
const root = new URL('../', import.meta.url);
const out = new URL('../browser-results/companions/', import.meta.url);
await mkdir(out, { recursive:true });
const html = (await readFile(new URL('apps-script/hall-pass/Index.html', root), 'utf8'))
  .replace('<?!= JSON.stringify(appMode) ?>', '"checkin"').replace('<?= siteBrand ?>', 'grantdesk');
const server = await preview({server:{host:'127.0.0.1',port:4396}});
const browser = await chromium.launch({headless:true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {})});
let cases = 0;
const results = [];
async function audit(page, name) {
  assert.ok(await page.locator('h1').first().isVisible());
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'No horizontal overflow');
  const axe = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  await writeFile(new URL(`${name}-axe.json`, out), JSON.stringify(axe.violations, null, 2));
  assert.deepEqual(axe.violations.map(v => ({id:v.id,nodes:v.nodes.map(n => n.target)})), [], `${name}: accessibility`);
  await page.screenshot({path:fileURLToPath(new URL(`${name}.png`,out)),fullPage:true});
}
async function offline(context) {
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === 'grant-desk.com' && url.pathname.startsWith('/hubs/checkling/pets/')) {
      return route.fulfill({status:200,body:await readFile(new URL(`public${url.pathname}`,root)),contentType:url.pathname.endsWith('.gif')?'image/gif':'image/png'});
    }
    return route.fulfill({status:200,body:'',contentType:'text/css'});
  });
}
async function gasBridge(page, c) {
  await page.exposeFunction('__gas', ({name,args}) => {
    c.harness.newRequest();
    return JSON.parse(JSON.stringify(c.harness.call(name,...args)));
  });
  await page.addInitScript(() => {
    function runner(success, failure) {
      return new Proxy({}, {get(_, name) {
        if (name === 'withSuccessHandler') return cb => runner(cb,failure);
        if (name === 'withFailureHandler') return cb => runner(success,cb);
        return (...args) => window.__gas({name,args}).then(success).catch(e => failure?.({message:e.message}));
      }});
    }
    window.google = {script:{get run(){return runner();}}};
  });
  await page.route(`${origin}/checkling-fixture/`, route => route.fulfill({body:html,contentType:'text/html'}));
}
try {
  for (const width of [320,390,1440]) {
    const context = await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    await offline(context);
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const c = classroom({now:new Date('2026-09-10T11:30:00Z')});
    c.harness.signInAs(PEOPLE.ada.email);
    await gasBridge(page,c);
    await page.goto(`${origin}/checkling-fixture/`);
    await page.locator('input[type="password"]').fill(c.pin(PEOPLE.ada));
    await page.locator('input[type="password"]').press('Enter');
    await page.locator('#ck-form').waitFor().catch(async (error) => {
      console.error(await page.locator('body').innerText());
      console.error(errors);
      await page.screenshot({path:fileURLToPath(new URL('checkling-failed.png',out)),fullPage:true});
      throw error;
    });
    assert.equal(c.checkIns().length,1,'The real PIN flow recorded attendance before pet adoption');
    if (width === 320) await audit(page,'checkling-adoption-320');
    await page.locator('input[value="ember"]').check();
    await page.locator('input[name="ck-name"]').fill('Tiny Dragon');
    await page.getByRole('button',{name:'hatch my Checkling'}).click();
    await page.getByRole('heading',{name:'Tiny Dragon',exact:true}).waitFor();
    assert.equal(c.checkIns().length,1);
    await page.getByRole('button',{name:'nuzzle',exact:true}).click();
    assert.match(await page.locator('#ck-message').textContent(), /nuzzle/);
    await page.getByRole('button',{name:'snacks',exact:true}).click();
    for (let i=1;i<=6;i++) await page.getByRole('button',{name:`Berry ${i}`,exact:true}).click();
    assert.match(await page.locator('#ck-play').textContent(), /Berry legend/);
    assert.equal(c.checkIns()[0].Point,1,'Pet play adds no points');
    await audit(page,`checkling-${width}`);
    await page.getByRole('button',{name:'refresh confirmation'}).click();
    await page.getByRole('heading',{name:'Tiny Dragon',exact:true}).waitFor();
    assert.equal(c.checkIns().length,1);
    const src = await page.locator('.ck-screen img').evaluate(e => e.currentSrc);
    assert.ok(src.endsWith('/idle-1.png'),'Reduced motion uses a still sprite');
    // A new login in the same browser must not inherit the previous student's pet.
    c.harness.signInAs(PEOPLE.alan.email);
    await page.reload();
    await page.locator('input[type="password"]').fill(c.pin(PEOPLE.alan));
    await page.locator('input[type="password"]').press('Enter');
    await page.locator('#ck-form').waitFor();
    assert.equal(await page.getByRole('heading',{name:'Tiny Dragon',exact:true}).count(),0);
    assert.deepEqual(errors,[]);
    results.push({name:`checkling-${width}`,status:'passed'}); cases++;
    console.log(`PASS Checkling ${width}: PIN, adoption, play, refresh, student isolation, still art, accessibility`);
    await context.close();
  }
  for (const width of [320,390,1440]) {
    const context = await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',acceptDownloads:true,hasTouch:width < 600});
    await offline(context);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${origin}/hubs/pond/`);
    await page.getByRole('button',{name:'Make a mess',exact:true}).click();
    await page.getByRole('button',{name:'Pause',exact:true}).click();
    const canvas = page.locator('canvas');
    await page.getByRole('button',{name:'Stone',exact:true}).click();
    await canvas.focus();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    assert.ok(await page.getByRole('button',{name:'Undo',exact:true}).isEnabled());
    await page.getByRole('button',{name:'Undo',exact:true}).click();
    const box = await canvas.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    if (width < 600) await page.touchscreen.tap(x,y);
    else {
      await page.mouse.move(x,y);
      await page.mouse.down();
      await page.mouse.move(x+35,y-20,{steps:5});
      await page.mouse.up();
    }
    assert.ok(await page.getByRole('button',{name:'Undo',exact:true}).isEnabled(),'Touch/mouse drawing is undoable');
    await page.getByRole('button',{name:'Undo',exact:true}).click();
    await page.getByRole('button',{name:'Clear dish',exact:true}).click();
    await page.getByRole('button',{name:'Undo',exact:true}).click();
    await page.getByRole('button',{name:'Open mixes'}).click();
    await page.getByRole('dialog',{name:'Mixes'}).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(),0);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button',{name:'Export world'}).click();
    const download = await downloadPromise;
    const path = fileURLToPath(new URL(`pond-${width}.json`,out));
    await download.saveAs(path);
    const saved = JSON.parse(await readFile(path,'utf8'));
    assert.equal(saved.app,'pond');
    await page.locator('input[type=file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{}')});
    await page.getByRole('status').filter({hasText:"isn't a valid Pond world"}).waitFor();
    await page.locator('input[type=file]').setInputFiles(path);
    await page.getByRole('status').filter({hasText:'World imported and paused'}).waitFor();
    await audit(page,`pond-${width}`);
    // Pagehide flush is deterministic; reloading must restore the exported bytes.
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('grantdesk-pond-world-v1'))).data,saved.data);
    await page.reload();
    await page.getByRole('button',{name:'Make a mess',exact:true}).click();
    await page.getByRole('button',{name:'Play',exact:true}).waitFor();
    assert.deepEqual(errors,[]);
    results.push({name:`pond-${width}`,status:'passed'}); cases++;
    console.log(`PASS Pond ${width}: keyboard paint, undo, guide, export, invalid import, restore, saved reload, accessibility`);
    await context.close();
  }
  console.log(`Companion browser acceptance: ${cases}/6 passed. All student data synthetic; external services offline.`);
} finally {
  await writeFile(new URL('results.json',out),JSON.stringify(results,null,2));
  await browser.close();
  await server.stop();
}
