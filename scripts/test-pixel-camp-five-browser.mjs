// Pixel Camp 5 in a real browser: the open sample page, the school camp, and a school that still stores version 1.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const require=createRequire(import.meta.url);
const {classroom,PEOPLE}=require('./lib/hall-pass-fixtures.cjs');
const root=new URL('../',import.meta.url), out=new URL('../browser-results/pixel-camp-five/',import.meta.url);
await mkdir(out,{recursive:true});
const shot=name=>fileURLToPath(new URL(name+'.png',out));
const types={js:'application/javascript',css:'text/css',png:'image/png',gif:'image/gif',ttf:'font/ttf',html:'text/html'};
async function serveCamp(route) {
  const url=new URL(route.request().url());
  let path=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
  const body=await readFile(new URL('public'+path,root));
  return route.fulfill({body,contentType:types[path.split('.').pop()]||'text/plain',headers:{'Access-Control-Allow-Origin':'*'}});
}
const schoolHtml=(await readFile(new URL('apps-script/hall-pass/Index.html',root),'utf8'))
  .replace('<?!= JSON.stringify(appMode) ?>','"checkin"').replace('<?= siteBrand ?>','desk')
  .replace(/<script>([\s\S]*?)<\/script>/g,(_,script)=>`<script>${script.replace(/https:\/\/[^\r\n]*/g,'https:')}</script>`);
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox']});

// Reads NEXT on the stump HUD and answers it, the way the practice welcome teaches.
async function spar(ui) {
  for(let turn=0;turn<80;turn++) {
    if(await ui.locator('#practice-result').isVisible()) return (await ui.locator('#result-title').textContent()).trim();
    const next=(await ui.locator('#enemy-intent').textContent()).trim();
    const sp=+(await ui.locator('#friend-sp-text').textContent()).split('/')[0];
    let move='signature';
    if(/BIG HIT|CRUSH|ROOT|2 ×/.test(next)) move='guard';
    else if(/BARK/.test(next)||(/WIND|REST/.test(next)&&sp<8)) move='recover';
    else if(sp<5) move=sp>=3?'strike':'recover';
    const button=ui.locator(`[data-move=${move}]`);
    if(await button.isDisabled()) {
      const free=ui.locator('#party-list .party-button:not([disabled])').first();
      await free.click(); continue;
    }
    await button.click();
  }
  throw Error('Spar did not finish');
}
async function fits(ui,label) {
  const wide=await ui.locator('html').evaluate(el=>el.scrollWidth>el.clientWidth+1?[...document.querySelectorAll('*')].filter(n=>n.getBoundingClientRect().right>el.clientWidth+1).slice(0,4).map(n=>n.id||n.className).join(', '):'');
  assert.equal(wide,'',label+' fits without sideways scrolling');
}
let checks=0;
try {
  // 1. The open sample camp at phone, small Chromebook and desktop widths.
  for(const width of [320,390,1366]) {
    const context=await browser.newContext({viewport:{width,height:width<500?860:900}});
    const page=await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await context.route('https://grant-desk.com/**',serveCamp);
    await page.goto('https://grant-desk.com/hubs/checkling/camp/');
    await page.locator('#bond-level').waitFor();
    assert.match(await page.locator('#bond-level').innerText(),/New friend/);
    assert.equal(await page.locator('.about-playtest p').first().textContent(),'Pixel Camp 6.1');
    await fits(page,'camp '+width);
    if(width===1366) await page.screenshot({path:shot('camp-home-'+width)});
    // Forage at all three stops.
    await page.locator('[data-view=trail]').click();
    assert.equal(await page.locator('#forage').isVisible(),true);
    assert.equal(await page.locator('.forage-tag[data-ready=true]').count(),3);
    for(const stop of [0,1,2]) {
      await page.locator(`#route-stops [data-stop="${stop}"]`).click();
      await page.locator('#forage').click();
      assert.match(await page.locator('#message').textContent(),/found/);
      await page.locator('#trail-actions [data-care=rest]').click();
    }
    assert.equal(await page.locator('.forage-tag[data-ready=true]').count(),0);
    assert.equal(await page.locator('#forage-label').textContent(),'Foraged');
    await page.locator('#forage').click({force:true});
    assert.match(await page.locator('#message').textContent(),/tomorrow/);
    await fits(page,'trail '+width);
    await page.screenshot({path:shot('trail-foraged-'+width)});
    // The shelf shows what was found and keeps the rest a mystery.
    await page.locator('[data-view=journal]').click();
    await page.locator('[data-journal-page=curios]').click();
    const owned=await page.locator('.curio-card[data-owned=true]').count();
    assert.ok(owned>=1&&owned<=3,'one to three curios after a first day: '+owned);
    assert.equal(await page.locator('.curio-card').count(),16);
    assert.match(await page.locator('#curio-summary').textContent(),new RegExp('^'+owned+' / 16'));
    await fits(page,'shelf '+width);
    await page.screenshot({path:shot('curio-shelf-'+width),fullPage:true});
    // Practice ladder: the old oak is locked until the sapling falls.
    await page.locator('[data-view=practice]').click();
    assert.equal(await page.locator('[data-tier="2"]').getAttribute('aria-disabled'),'true');
    await page.locator('[data-tier="2"]').click({force:true});
    assert.match(await page.locator('#message').textContent(),/Clear the sapling stump/);
    await page.screenshot({path:shot('practice-ladder-'+width)});
    await page.locator('#start-practice').click();
    assert.equal(await page.locator('.enemy-hud > strong').textContent(),'SAPLING STUMP');
    assert.equal(await spar(page),'PRACTICE CLEAR!');
    assert.match(await page.locator('#result-copy').textContent(),/sapling stump badge/);
    await page.locator('#practice-result [data-go=home]').click();
    await page.locator('[data-view=practice]').click();
    assert.equal(await page.locator('[data-tier="2"]').getAttribute('aria-pressed'),'true','next stump is picked automatically');
    assert.equal(await page.locator('[data-tier="2"]').getAttribute('aria-disabled'),null);
    assert.equal(await page.locator('#practice-welcome h2').textContent(),'OLD OAK STUMP');
    if(width===1366) {
      await page.locator('#start-practice').click();
      assert.equal(await page.locator('.enemy-hud > strong').textContent(),'OLD OAK STUMP');
      assert.equal(await page.locator('#enemy-hp-text').textContent(),'165/165');
      assert.equal(await page.locator('#stump-sprite').getAttribute('data-tier'),'2');
      await page.screenshot({path:shot('old-oak-'+width)});
      assert.equal(await spar(page),'PRACTICE CLEAR!');
      await page.locator('#practice-result [data-go=home]').click();
    }
    // Six decorations, saved progress survives a reload.
    await page.locator('#open-decor').click();
    assert.equal(await page.locator('.decor-item').count(),6);
    await page.screenshot({path:shot('decor-'+width)});
    await page.locator('#decor-dialog .close-form button').click();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('checklings.first-trail.v1')));
    assert.equal(saved.version,3); assert.equal(saved.curios.length,owned); assert.ok(saved.pets.mochi.battles>=1);
    await page.reload(); await page.locator('#bond-level').waitFor();
    await page.locator('[data-view=journal]').click(); await page.locator('[data-journal-page=curios]').click();
    assert.equal(await page.locator('.curio-card[data-owned=true]').count(),owned);
    await page.locator('[data-journal-page=goals]').click();
    assert.equal(await page.locator('.camp-goal-row').count(),7);
    assert.match(await page.locator('[data-goal-row=curator]').innerText(),/Curio shelf/);
    assert.deepEqual(errors,[],'no page errors at '+width);
    await context.close(); checks++;
  }
  // 2. School camp: a version 2 save goes to the school and comes back.
  for(const oldSchool of [false,true]) {
    const c=classroom({now:new Date('2026-09-10T11:30:00Z')});c.harness.signInAs(PEOPLE.ada.email);
    const identity=c.harness.call('identifyChecklingWithPin',c.pin(PEOPLE.ada),'seed');
    c.harness.call('saveCheckling',identity.pinToken,'bolt','Sprocket');
    const context=await browser.newContext({viewport:{width:1366,height:950}});
    const page=await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.exposeFunction('__gas',({name,args})=>{
      c.harness.newRequest();
      if(oldSchool&&name==='savePixelCamp'&&args[3]&&args[3].version!==1) throw Error('Choose a valid Pixel Camp version 1 save.');
      const answer=JSON.parse(JSON.stringify(c.harness.call(name,...args)));
      if(oldSchool&&answer&&answer.formats) delete answer.formats;
      return answer;
    });
    await page.addInitScript(()=>{
      function runner(success,failure){return new Proxy({},{get(_,name){
        if(name==='withSuccessHandler')return cb=>runner(cb,failure);
        if(name==='withFailureHandler')return cb=>runner(success,cb);
        return (...args)=>window.__gas({name,args}).then(success).catch(error=>failure?.({message:error.message}));
      }});}
      window.google={script:{get run(){return runner();}}};
    });
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.hostname==='school-fixture.test')return route.fulfill({body:schoolHtml,contentType:'text/html'});
      if(url.hostname==='grant-desk.com'&&url.pathname.startsWith('/hubs/checkling/'))return serveCamp(route);
      return route.fulfill({body:'',contentType:'text/css'});
    });
    async function open() {
      await page.goto('https://school-fixture.test/');
      await page.locator('input[type=password]').fill(c.pin(PEOPLE.ada));
      await page.locator('#visit-checkling').click();
      await page.locator('#ck-open-camp').click();
      const frame=page.frameLocator('iframe[title="Your school Pixel Camp"]');
      await frame.getByText('Saved to school',{exact:true}).waitFor();
      return frame;
    }
    let frame=await open();
    await frame.locator('[data-view=trail]').click();
    if(oldSchool) {
      assert.equal(await frame.locator('#forage').isVisible(),false,'forage waits for the school update');
      assert.equal(await frame.locator('.forage-tag').count(),0);
      await frame.locator('#discover').click();
      await frame.getByText('Saved to school',{exact:true}).waitFor();
      await frame.locator('[data-view=practice]').click();
      assert.equal(await frame.locator('#tier-picker').isVisible(),false);
      await frame.locator('[data-view=journal]').click();
      assert.equal(await frame.locator('[data-journal-page=curios]').isVisible(),false);
      assert.equal(await frame.locator('.camp-goal-row').count(),0);
      await frame.locator('[data-journal-page=goals]').click();
      assert.equal(await frame.locator('.camp-goal-row').count(),4);
      const stored=JSON.parse(c.harness.sheet('Checkling Camps').records()[0]['Camp JSON']);
      assert.equal(stored.version,1,'an old school keeps receiving version 1'); assert.equal(stored.pets.bolt.discoveries.length,1);
    } else {
      await frame.locator('#forage').click();
      await frame.getByText('Saved to school',{exact:true}).waitFor();
      const stored=JSON.parse(c.harness.sheet('Checkling Camps').records()[0]['Camp JSON']);
      assert.equal(stored.version,3); assert.equal(stored.curios.length,1);
      assert.equal(c.checkIns().length,0,'foraging records no attendance');
      await page.screenshot({path:shot('school-forage-1366'),fullPage:true});
      frame=await open();
      await frame.locator('[data-view=journal]').click(); await frame.locator('[data-journal-page=curios]').click();
      assert.equal(await frame.locator('.curio-card[data-owned=true]').count(),1,'the curio came back from school');
      await frame.locator('[data-view=trail]').click();
      assert.equal(await frame.locator('#forage-label').textContent(),'Foraged','today’s forage at that stop is remembered by the school');
    }
    assert.deepEqual(errors,[]);
    await context.close(); checks++;
  }
} finally { await browser.close(); }
console.log(`Pixel Camp 5 browser journeys passed (${checks} journeys): foraging, curio shelf, stump ladder, six decorations, school version 2 saves and the version 1 fallback.`);
