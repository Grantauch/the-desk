import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { resolve, extname } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
const require = createRequire(import.meta.url);
const { classroom, PEOPLE, TEACHER } = require('./lib/hall-pass-fixtures.cjs');
const origin = 'http://127.0.0.1:4396';
const root = new URL('../', import.meta.url);
const out = new URL('../browser-results/companions/', import.meta.url);
await mkdir(out, { recursive:true });
const html = (await readFile(new URL('apps-script/hall-pass/Index.html', root), 'utf8'))
  .replace('<?!= JSON.stringify(appMode) ?>', '"checkin"').replace('<?= siteBrand ?>', 'grantdesk');
// These companions ship as static assets and five-file Apps Script source.
// Serve only the published Pond directory; no full-site build or news fetch.
const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, origin).pathname);
    const path = resolve(publicRoot, '.' + pathname, pathname.endsWith('/') ? 'index.html' : '');
    if (!path.startsWith(resolve(publicRoot, 'hubs/pond') + '/')) { response.writeHead(404).end(); return; }
    const types = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.json':'application/json'};
    const body = await readFile(path);
    response.writeHead(200, {'content-type':types[extname(path)] || 'application/octet-stream','cache-control':'no-store'}).end(body);
  } catch { response.writeHead(404).end(); }
});
await new Promise((resolve, reject) => { server.once('error',reject); server.listen(4396,'127.0.0.1',resolve); });
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
    // Even the widest allowed uninterrupted name must remain visible at 320px.
    const wideName='W'.repeat(18);
    for(const name of [wideName,'Tiny Dragon']) {
      await page.getByText('make it yours',{exact:true}).click();
      await page.getByLabel('Their name',{exact:true}).fill(name);
      await page.getByRole('button',{name:'save friend',exact:true}).click();
      const heading=page.getByRole('heading',{name,exact:true});
      await heading.waitFor();
      assert.ok(await heading.evaluate(element=>element.scrollWidth<=element.clientWidth+1),'The complete pet name wraps without clipping');
      assert.equal(c.checkIns().length,1,'Renaming cannot record extra attendance');
    }

    await page.getByRole('button',{name:'star pairs',exact:true}).click();
    const cards = page.locator('.ck-card-grid button');
    const remembered = new Map();
    for(let i=0;i<8;i+=2) {
      for(const index of [i,i+1]) {
        await cards.nth(index).click();
        const name=(await cards.nth(index).getAttribute('aria-label')).split(', ')[1];
        const positions=remembered.get(name)||[]; positions.push(index); remembered.set(name,positions);
      }
      const flip=page.getByRole('button',{name:'turn these over',exact:true});
      if(await flip.isVisible()) await flip.click();
    }
    for(const positions of remembered.values()) {
      if(await cards.nth(positions[0]).isEnabled()) {
        await cards.nth(positions[0]).click(); await cards.nth(positions[1]).click();
      }
    }
    await page.getByRole('status').filter({hasText:'Constellation complete'}).waitFor();
    await audit(page,`checkling-pairs-${width}`);
    await page.getByRole('button',{name:'echo grove',exact:true}).click();
    const trail=(await page.locator('.ck-echo-trail li').allTextContents()).map(text=>text.replace(/[^a-z]/g,''));
    await page.getByRole('button',{name:'ready — hide the trail',exact:true}).click();
    assert.equal(await page.locator('.ck-echo-trail').isVisible(),false);
    for(const note of trail) await page.locator('.ck-echo-notes').getByRole('button',{name:note,exact:true}).click();
    await page.getByRole('status').filter({hasText:'Trail remembered!'}).waitFor();
    assert.equal(c.checkIns().length,1,'Games never record attendance');
    assert.equal(c.checkIns()[0].Point,1,'Games never award classroom points');
    await audit(page,`checkling-${width}`);
    await page.getByRole('button',{name:'refresh confirmation'}).click();
    await page.getByRole('heading',{name:'Tiny Dragon',exact:true}).waitFor();
    assert.equal(c.checkIns().length,1);
    const src = await page.locator('.ck-screen img').evaluate(e => e.currentSrc);
    assert.ok(src.endsWith('/idle-1.png'),'Reduced motion uses a still sprite');
    // Earn the next habitat through three real synthetic school-day check-ins.
    for(const day of ['11','14']) {
      c.harness.clock.set(new Date(`2026-09-${day}T11:30:00Z`));
      c.checkIn(PEOPLE.ada,'Period 1');
    }
    await page.reload();
    await page.locator('input[type="password"]').fill(c.pin(PEOPLE.ada));
    await page.locator('input[type="password"]').press('Enter');
    await page.getByText('make it yours',{exact:true}).click();
    await page.getByLabel('Their little home',{exact:true}).selectOption('grove');
    await page.getByRole('button',{name:'save friend',exact:true}).click();
    await page.locator('.ck-home-grove').waitFor();
    assert.equal(c.checkIns().length,3,'Choosing a home adds no extra attendance');
    await page.getByText('your little journey',{exact:false}).click();
    assert.equal(await page.locator('.ck-journey .is-earned').count(),2);
    await audit(page,`checkling-grove-${width}`);
    if(width===1440) await page.locator('.ck-pocket').screenshot({path:fileURLToPath(new URL('checkling-habitat-preview.png',out))});
    await page.reload();
    await page.locator('input[type="password"]').fill(c.pin(PEOPLE.ada));
    await page.locator('input[type="password"]').press('Enter');
    await page.locator('.ck-home-grove').waitFor();
    // A new login in the same browser must not inherit the previous student's pet.
    c.harness.signInAs(PEOPLE.alan.email);
    await page.reload();
    await page.locator('input[type="password"]').fill(c.pin(PEOPLE.alan));
    await page.locator('input[type="password"]').press('Enter');
    await page.locator('#ck-form').waitFor();
    assert.equal(await page.getByRole('heading',{name:'Tiny Dragon',exact:true}).count(),0);
    assert.deepEqual(errors,[]);
    results.push({name:`checkling-${width}`,status:'passed'}); cases++;
    console.log(`PASS Checkling ${width}: PIN, adoption, all three games, earned habitat save/reload, journey, student isolation, still art, accessibility`);
    await context.close();
  }
  // A shared PIN screen still hands off when idle, while an intentional pet
  // visit keeps its short transaction timer from interrupting play.
  {
    const context=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'});
    await offline(context);
    const page=await context.newPage();
    await page.clock.install();
    const c=classroom({now:new Date('2026-09-10T11:30:00Z')});
    c.harness.signInAs(TEACHER);
    const identified=c.harness.call('identifyCheckInWithPin',c.pin(PEOPLE.ada),'shared-pet-setup');
    c.harness.call('saveCheckling',identified.pinToken,'bolt','Shared friend');
    await gasBridge(page,c);
    await page.goto(`${origin}/checkling-fixture/`);
    const enter=async()=>{
      await page.locator('input[type=password]').fill(c.pin(PEOPLE.ada));
      await page.locator('input[type=password]').press('Enter');
      await page.getByRole('heading',{name:'Shared friend',exact:true}).waitFor();
    };
    await enter();
    await page.clock.fastForward(11000);
    await page.locator('input[type=password]').waitFor();
    assert.equal(await page.locator('.ck-pocket').count(),0,'An unattended shared confirmation still clears');
    await enter();
    await page.getByRole('button',{name:'star pairs',exact:true}).click();
    await page.clock.fastForward(11000);
    await page.getByRole('heading',{name:'Shared friend',exact:true}).waitFor();
    assert.equal(await page.locator('.handoff').count(),0,'The superseded short handoff message is removed');
    await page.clock.fastForward(120001);
    await page.locator('input[type=password]').waitFor();
    assert.equal(await page.locator('.ck-pocket').count(),0,'An inactive visit still clears at the existing privacy limit');
    assert.equal(c.checkIns().length,1);
    assert.equal(c.checkIns()[0].Point,1);
    results.push({name:'checkling-shared-screen',status:'passed'}); cases++;
    console.log('PASS shared Checkling: unattended handoff, active visit, idle privacy reset, no duplicate points');
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
  console.log(`Companion browser acceptance: ${cases}/7 passed. All student data synthetic; external services offline.`);
} finally {
  await writeFile(new URL('results.json',out),JSON.stringify(results,null,2));
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
