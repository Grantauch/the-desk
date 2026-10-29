import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const require=createRequire(import.meta.url);
const {classroom,PEOPLE,TEACHER_CONTRACT}=require('./lib/hall-pass-fixtures.cjs');
const axeSource=await readFile(require.resolve('axe-core/axe.min.js'),'utf8');
const root=new URL('../',import.meta.url), out=new URL('../browser-results/pixel-camp/',import.meta.url);
await mkdir(out,{recursive:true});
const html=(await readFile(new URL('apps-script/hall-pass/Index.html',root),'utf8'))
  .replace('<?!= JSON.stringify(appMode) ?>','"checkin"').replace('<?= siteBrand ?>','desk')
  .replace(/<script>([\s\S]*?)<\/script>/g,(_,script)=>`<script>${script.replace(/https:\/\/[^\r\n]*/g,'https:')}</script>`);
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox']});
let checks=0;
try {
  for(const width of [320,390,1440]) {
    const c=classroom({now:new Date('2026-09-10T11:30:00Z')});c.harness.signInAs(PEOPLE.ada.email);
    const identity=c.harness.call('identifyChecklingWithPin',c.pin(PEOPLE.ada),'seed');
    c.harness.call('saveCheckling',identity.pinToken,'bolt','Sprocket');
    const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'});
    let failSave=false, loseResponse=false, holdNextSave=false, heldSaveResolve=null, heldSaveCaptured=null;
    const page=await context.newPage(), errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    if(width===390) await page.clock.install();
    await page.exposeFunction('__gas',async ({name,args})=>{
      c.harness.newRequest();
      if(name==='savePixelCamp'&&failSave) throw Error('Synthetic offline save. Retry or export.');
      const answer=JSON.parse(JSON.stringify(c.harness.call(name,...args)));
      if(name==='savePixelCamp'&&loseResponse) {loseResponse=false;throw Error('Synthetic response lost after commit.');}
      if(name==='savePixelCamp'&&holdNextSave) {holdNextSave=false;await new Promise(resolve=>{heldSaveResolve=resolve;heldSaveCaptured();});}
      return answer;
    });
    await page.addInitScript(()=>{
      function runner(success,failure) {return new Proxy({},{get(_,name){
        if(name==='withSuccessHandler') return cb=>runner(cb,failure);
        if(name==='withFailureHandler') return cb=>runner(success,cb);
        return (...args)=>window.__gas({name,args}).then(success).catch(error=>failure?.({message:error.message}));
      }});}
      window.google={script:{get run(){return runner();}}};
    });
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.hostname==='school-fixture.test') return route.fulfill({body:url.searchParams.has('teacher') ? html.replace('const APP_MODE = "checkin"','const APP_MODE = "teacher"') : html,contentType:'text/html'});
      if(url.hostname==='grant-desk.com' && url.pathname.startsWith('/hubs/checkling/')) {
        const body=await readFile(new URL('public'+url.pathname,root));
        const ext=url.pathname.split('.').pop();
        return route.fulfill({body,contentType:({js:'application/javascript',css:'text/css',png:'image/png',gif:'image/gif',ttf:'font/ttf'})[ext]||'text/plain',headers:{'Access-Control-Allow-Origin':'*'}});
      }
      return route.fulfill({body:'',contentType:'text/css'});
    });
    async function login(person=PEOPLE.ada) {
      c.harness.signInAs(person.email);
      await page.goto('https://school-fixture.test/');
      await page.locator('input[type=password]').fill(c.pin(person));
      await page.locator('#visit-checkling').click();
      await page.locator('#ck-open-camp').waitFor();
    }
    async function open() {
      await page.locator('#ck-open-camp').click();
      const frame=page.frameLocator('iframe[title="Your school Pixel Camp"]');
      await frame.getByText('Saved to school',{exact:true}).waitFor();
      return frame;
    }
    await login();let frame=await open();
    assert.match(await frame.locator('.school-banner').innerText(),/Sprocket/);
    assert.equal(await frame.locator('#pet-name').textContent(),'Sprocket');
    await frame.locator('.skip').focus();await frame.locator('.skip').press('Enter');
    assert.equal(await frame.locator('#actions').evaluate(el=>el===document.activeElement),true,'skip link stays inside school camp');
    assert.ok(await frame.locator('html').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'camp fits phone: '+ await frame.locator('body').evaluate(()=>JSON.stringify([...document.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(el=>[el.id,el.className,el.getBoundingClientRect().width,innerWidth]))));
    assert.ok(await page.locator('html').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'school host fits phone');
    await frame.locator('[data-view=trail]').click();await frame.locator('#discover').click();
    await frame.getByText('Saved to school',{exact:true}).waitFor();
    assert.equal(c.checkIns().length,0);assert.equal(c.passLog().length,0);
    assert.equal(JSON.parse(c.harness.sheet('Checkling Camps').records()[0]['Camp JSON']).pets.bolt.discoveries.length,1);
    await page.screenshot({path:fileURLToPath(new URL(`school-camp-${width}.png`,out)),fullPage:true});
    await page.reload();await page.locator('input[type=password]').fill(c.pin(PEOPLE.ada));await page.locator('#visit-checkling').click();
    frame=await open();
    assert.equal(await frame.locator('#discovery-count').textContent(),'1 / 12');
    function toggle(open) {
      c.harness.newRequest();c.harness.signInAs(c.teacher);
      const answer=c.harness.call('teacherSetPixelCampOpen',open,TEACHER_CONTRACT);
      c.harness.newRequest();c.harness.signInAs(PEOPLE.ada.email);return answer;
    }
    toggle(false);
    await frame.locator('[data-care=feed]').first().click();
    await frame.locator('#school-pause-dialog').waitFor();
    const child=page.frames().find(candidate=>candidate.url()==='about:srcdoc');
    await child.addScriptTag({content:axeSource});
    const pausedAxe=await child.evaluate(async()=>await axe.run(document.querySelector('#school-pause-dialog'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
    assert.deepEqual(pausedAxe.violations.map(v=>v.id),[],'paused camp accessibility');
    await frame.locator('#school-pause-export').press('Escape');
    assert.equal(await frame.locator('#school-pause-dialog').isVisible(),true,'Escape cannot resume paused play');
    const downloadPromise=page.waitForEvent('download');await frame.locator('#school-pause-export').click();
    const download=await downloadPromise,backup=JSON.parse(await readFile(await download.path(),'utf8'));
    assert.equal(backup.pets.bolt.discoveries.length,1,'paused backup retains current game');
    const previous=JSON.parse(c.harness.sheet('Checkling Camps').records()[0]['Camp JSON']);
    assert.notEqual(backup.pets.bolt.food,previous.pets.bolt.food,'unsaved care action is kept in backup');
    await frame.locator('#school-pause-leave').click();
    assert.equal(await page.locator('iframe').count(),1,'unconfirmed progress requires an explicit second leave');
    assert.match(await frame.locator('#school-pause-status').textContent(),/Some progress is not confirmed/);
    await frame.locator('#school-pause-check').click();
    await frame.getByText('School play is still paused. Your camp has been kept here.',{exact:true}).waitFor();
    await page.screenshot({path:fileURLToPath(new URL(`school-paused-${width}.png`,out)),fullPage:true});
    toggle(true);await frame.locator('#school-pause-check').click();
    await frame.getByText('Saved to school',{exact:true}).waitFor();
    assert.equal(await frame.locator('#school-pause-dialog').isVisible(),false);
    const resumed=JSON.parse(c.harness.sheet('Checkling Camps').records()[0]['Camp JSON']);
    assert.deepEqual(resumed,backup,'resume retries exactly the unsaved camp');
    assert.equal(c.checkIns().length,0);assert.equal(c.passLog().length,0);
    if(width===390) {
      let capturedTimer;
      const captured=new Promise((resolve,reject)=>{heldSaveCaptured=resolve;capturedTimer=setTimeout(()=>reject(Error('Expected school save did not reach the fixture')),10000);});
      holdNextSave=true;await frame.locator('[data-care=play]').first().click();
      try { await captured; } finally { clearTimeout(capturedTimer); }
      await frame.getByText('Saving to school…',{exact:true}).waitFor();
      toggle(false);await page.clock.fastForward(39000);
      await frame.locator('#school-pause-dialog').waitFor();
      assert.ok(heldSaveResolve,'save committed before the newer pause but its response is held');
      heldSaveResolve();await frame.getByText('Saved to school',{exact:true}).waitFor();
      assert.equal(await frame.locator('#school-pause-dialog').isVisible(),true,'older save acknowledgement cannot resume a newer pause');
      toggle(true);await frame.locator('#school-pause-check').click();
      await frame.locator('#school-pause-dialog').waitFor({state:'hidden'});
    }
    if(width===320) {
      failSave=true;
      await frame.locator('[data-care=play]').first().click();
      await frame.getByText('Not saved to school',{exact:true}).waitFor();
      assert.ok(await frame.locator('#school-save-retry').isVisible());
      failSave=false;await frame.locator('#school-save-retry').click();await frame.getByText('Saved to school',{exact:true}).waitFor();
      loseResponse=true;
      await frame.locator('[data-care=rest]').first().click();await frame.getByText('Not saved to school',{exact:true}).waitFor();
      const before=c.harness.sheet('Checkling Camps').records()[0].Revision;
      await frame.locator('#school-save-retry').click();await frame.getByText('Saved to school',{exact:true}).waitFor();
      assert.equal(c.harness.sheet('Checkling Camps').records()[0].Revision,before,'lost response retry deduplicates');
      const imported=JSON.parse(JSON.stringify(c.harness.call('initialPixelCamp_')));
      for(const pet of Object.values(imported.pets)) {pet.discoveries=[0,1,2];pet.battles=1;}
      imported.pets.bolt.nickname='Another camp name';
      await frame.locator('#open-menu').click();
      await frame.locator('#import-file').setInputFiles({name:'old-browser-camp.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
      await frame.locator('#confirm-import').click();await frame.getByText('Saved to school',{exact:true}).waitFor();
      assert.equal(JSON.parse(c.harness.sheet('Checkling Camps').records()[0]['Camp JSON']).pets.bolt.nickname,'Sprocket');
      await frame.locator('#undo-import').click();await frame.getByText('Saved to school',{exact:true}).waitFor();
      assert.equal(JSON.parse(c.harness.sheet('Checkling Camps').records()[0]['Camp JSON']).pets.bolt.discoveries.length,1);
      await frame.locator('#menu-dialog .close-form button').click();
      const concurrent=c.harness.call('getPixelCamp',identity.pinToken);
      concurrent.camp.weather='rain';
      c.harness.call('savePixelCamp',identity.pinToken,concurrent.revision,'d'.repeat(32),concurrent.camp);
      await frame.locator('[data-care=feed]').first().click();await frame.getByText('Not saved to school',{exact:true}).waitFor();
      assert.match(await frame.locator('#message').textContent(),/another screen/);
      assert.equal(JSON.parse(c.harness.sheet('Checkling Camps').records()[0]['Camp JSON']).weather,'rain');
      // The explicit next-student action removes the iframe and closes its channel.
      await page.locator('#checkin-next').click();assert.equal(await page.locator('iframe').count(),0);
      const other=c.harness.call('identifyChecklingWithPin',c.pin(PEOPLE.alan),'other');
      c.harness.call('saveCheckling',other.pinToken,'zee','Other friend');
      await login(PEOPLE.alan);frame=await open();
      assert.equal(await frame.locator('#pet-name').textContent(),'Other friend');
      assert.equal(await frame.locator('#discovery-count').textContent(),'0 / 12');
      assert.equal(await frame.locator('body').innerText().then(text=>text.includes('Sprocket')),false);
    }
    if(width===1440) {
      await frame.locator('#party-list [data-pet=mochi]').click();
      await frame.locator('#open-menu').click();await frame.locator('[data-menu-action=name]').click();await frame.locator('#nickname').fill('Cloud buddy');
      await frame.locator('#nickname').press('Enter');
      await frame.getByText('Saved to school',{exact:true}).waitFor();
      assert.equal(await frame.locator('#pet-name').textContent(),'Cloud buddy','nickname Enter works in sandbox');
      await frame.locator('#open-menu').click();await frame.locator('[data-menu-action=name]').click();await frame.locator('#nickname').fill('Moon buddy');
      await frame.getByRole('button',{name:'Keep it!',exact:true}).click();
      await frame.getByText('Saved to school',{exact:true}).waitFor();
      assert.equal(await frame.locator('#pet-name').textContent(),'Moon buddy','nickname button works in sandbox');
    }
    if(width===390) {
      await page.clock.fastForward(121000);
      await page.locator('input[type=password]').waitFor();
      assert.equal(await page.locator('iframe').count(),0,'idle privacy removes camp');
    }
    c.harness.newRequest();c.harness.signInAs(c.teacher);
    await page.goto('https://school-fixture.test/?teacher');
    await page.locator('#toggle-pixel-camp').waitFor();
    await page.locator('#toggle-pixel-camp').press('Enter');
    await page.getByText('School play is paused.',{exact:true}).waitFor();
    assert.equal(c.harness.call('pixelCampAccess_').open,false);
    const teacherAxe=await new AxeBuilder({page}).include('[aria-labelledby="pixel-camp-control-title"]').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.deepEqual(teacherAxe.violations.map(v=>v.id),[],'teacher pause control accessibility');
    await page.screenshot({path:fileURLToPath(new URL(`teacher-camp-control-${width}.png`,out)),fullPage:true});
    await page.locator('#toggle-pixel-camp').press('Enter');
    await page.getByText('School play is open.',{exact:true}).waitFor();
    assert.equal(c.harness.call('pixelCampAccess_').open,true);
    assert.deepEqual(errors,[]);checks++;await context.close();
  }
  const demoContext=await browser.newContext({viewport:{width:390,height:950},acceptDownloads:true});
  await demoContext.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Synthetic blocked storage','SecurityError');}}));
  await demoContext.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname!=='grant-desk.com'||!url.pathname.startsWith('/hubs/checkling/camp/')) return route.fulfill({body:''});
    const body=await readFile(new URL('public'+url.pathname,root));
    const ext=url.pathname.split('.').pop();
    return route.fulfill({body,contentType:({html:'text/html',js:'application/javascript',css:'text/css',png:'image/png',gif:'image/gif',ttf:'font/ttf'})[ext]||'text/plain'});
  });
  const demo=await demoContext.newPage(), demoErrors=[];demo.on('pageerror',error=>demoErrors.push(error.message));
  await demo.goto('https://grant-desk.com/hubs/checkling/camp/index.html');
  await demo.getByText('Save to file',{exact:true}).first().waitFor();
  assert.equal(await demo.locator('#party-list button').count(),4,'blocked storage keeps demo playable');
  await demo.locator('[data-care=feed]').click();await demo.locator('#open-menu').click();
  const downloadPromise=demo.waitForEvent('download');await demo.locator('#export-save').click();
  const download=await downloadPromise;assert.match(download.suggestedFilename(),/^Checklings-Camp-.*\.json$/);
  assert.deepEqual(demoErrors,[]);await demoContext.close();
  await writeFile(new URL('result.json',out),JSON.stringify({checks,status:'passed'},null,2));
  console.log(`Pixel Camp school browser journeys passed at ${checks} viewports, including teacher pause/resume, periodic access, exact unsaved backup/retry, accessibility, cross-session recovery and shared-device isolation.`);
} finally {await browser.close();}
