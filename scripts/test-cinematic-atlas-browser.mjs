import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { preview } from 'astro';

const results=[];
const artifacts=new URL('../browser-results/atlas/',import.meta.url);
await mkdir(artifacts,{recursive:true});
const server=await preview({server:{host:'127.0.0.1',port:4396}});
const origin=`http://127.0.0.1:${server.port}`;
const browser=await chromium.launch({
  ...(process.env.ATLAS_CHROMIUM?{executablePath:process.env.ATLAS_CHROMIUM}:{}),
  headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
});
const now=new Date().toISOString();
const fixture={updatedAt:now,groups:[
  {name:'NPR',stories:[{title:'Berlin opens an exhibition',href:'https://www.npr.org/atlas-fixture',published:now,image:'https://copyright-photo.example/unused.jpg'}]},
  {name:'CNN',stories:[{title:'Detroit opens an exhibition',href:'https://www.cnn.com/atlas-fixture',published:now}]},
]};

async function run(name,viewport,check,{motion='reduce',fallback=false,textureFailure=false,javascript=true,newsFailure=false,touch=false}={}){
  const context=await browser.newContext({viewport,reducedMotion:motion,javaScriptEnabled:javascript,hasTouch:touch});
  const requests=[];let newsRequests=0;
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());requests.push(url.href);
    if(url.origin!==origin)return route.fulfill({status:503,body:'Offline fixture'});
    if(url.pathname==='/.netlify/functions/headlines'){
      newsRequests++;
      return newsFailure?route.fulfill({status:503,body:'No news'}):route.fulfill({json:fixture});
    }
    if(fallback&&url.pathname.endsWith('/three.min.js'))return route.fulfill({status:404,body:'Optional renderer unavailable'});
    if(textureFailure&&url.pathname==='/atlas/cloud-mask.jpg')return route.fulfill({status:404,body:'Optional texture unavailable'});
    return route.continue();
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&/shader|THREE\.WebGLProgram|GL_INVALID/i.test(message.text()))errors.push(message.text());});
  try{
    assert.equal((await page.goto(origin+'/')).status(),200);
    if(javascript)await page.locator(`[data-atlas][data-graphics='${fallback||textureFailure?'fallback':'ready'}']`).waitFor();
    await check(page,{get newsRequests(){return newsRequests;},requests});
    assert.deepEqual(errors,[],'No uncaught or shader errors');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow');
    if(javascript){
      const report=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
      await writeFile(new URL(name+'-axe.json',artifacts),JSON.stringify(report,null,2));
      assert.deepEqual(report.violations.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)})),[],'WCAG A/AA');
    }
    await page.screenshot({path:fileURLToPath(new URL(name+'.png',artifacts)),fullPage:false,timeout:30000});
    results.push({name,status:'passed'});console.log('PASS',name);
  }catch(error){
    results.push({name,status:'failed',error:error.stack});console.error('FAIL',name,error.message);
    await page.screenshot({path:fileURLToPath(new URL(name+'-failed.png',artifacts)),fullPage:false,timeout:30000}).catch(()=>{});
  }finally{await context.close();}
}

try{
  for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['chromebook',{width:1366,height:768}],['phone',{width:390,height:844}],['narrow',{width:320,height:740}]]){
    await run(name+'-home',viewport,async(page,network)=>{
      assert.equal(network.newsRequests,0,'News loads only after it is selected');
      for(const href of ['/check-in/','/pass/']){
        const box=await page.locator(`.class-entry a[href="${href}"]`).boundingBox();
        assert.ok(box&&box.y>=0&&box.y+box.height<=viewport.height,'Daily action entirely in first viewport');
      }
      assert.equal(await page.locator('.course-card__art').count(),3);
      assert.ok(await page.locator('.atlas-pin:visible').count()>0);
      assert.equal(await page.locator('[data-atlas-motion]').textContent(),'animate clouds');
    });
    await run(name+'-explore',viewport,async(page,network)=>{
      const trigger=page.locator('[data-atlas-explore]');await trigger.focus();await page.keyboard.press('Enter');
      const dialog=page.locator('[data-atlas-dialog]');assert.equal(await dialog.evaluate(d=>d.open),true);
      assert.ok(await page.locator('.atlas-copy').isHidden());
      for(let i=0;i<12;i++){
        await page.keyboard.press('Tab');
        assert.ok(await page.evaluate(()=>document.querySelector('[data-atlas-dialog]').contains(document.activeElement)),'Modal keeps keyboard focus inside');
      }
      await page.locator('[data-atlas-year]').focus();await page.keyboard.press('Home');
      assert.equal(await page.locator('[data-atlas-year-output]').textContent(),'1865');
      assert.equal(await page.locator('.atlas-choice').count(),0);
      await page.keyboard.press('End');assert.equal(await page.locator('.atlas-choice').count(),6);
      await page.locator('[data-atlas-index] summary').click();
      await page.locator('.atlas-choice').filter({hasText:'thirty seven days'}).click();
      assert.equal(await page.locator('[data-story-title]').textContent(),'thirty seven days');
      assert.match(await page.locator('[data-story-place]').textContent(),/Sarajevo/);
      await page.locator('[data-atlas-dismiss]').click();
      await page.locator('[data-atlas-filter=news]').click();
      await page.locator('[data-atlas-status]').filter({hasText:'2 recent news stories'}).waitFor();
      assert.equal(network.newsRequests,1);
      assert.equal(await page.locator('.atlas-choice').count(),2);
      await page.locator('.atlas-choice').filter({hasText:'Berlin'}).click();
      assert.match(await page.locator('[data-story-kind]').textContent(),/NPR/);
      assert.equal(await page.locator('[data-story-link]').getAttribute('href'),'https://www.npr.org/atlas-fixture');
      assert.ok(!network.requests.some(url=>url.includes('copyright-photo.example')),'No publisher photo requests');
      await page.locator('[data-atlas-filter=both]').click();assert.equal(await page.locator('.atlas-choice').count(),8);
      await page.locator('[data-atlas-filter=history]').click();
      await page.keyboard.press('Escape');assert.equal(await dialog.evaluate(d=>d.open),false);
      assert.ok(await trigger.evaluate(el=>el===document.activeElement),'Focus returns to the Explore trigger');
      await trigger.click();await page.locator('[data-atlas-return]').click();
      assert.equal(await dialog.evaluate(d=>d.open),false);
    });
  }
  await run('page-finder',{width:390,height:844},async(page)=>{
    await page.locator('.desk-search-trigger').click();
    assert.equal(await page.locator('#desk-search-dialog').evaluate(d=>d.open),true);
    await page.locator('#desk-search-input').fill('hall pass');
    assert.equal(await page.locator('.desk-search-results a:visible').count(),1);
    assert.equal(await page.locator('.desk-search-results a:visible').getAttribute('href'),'/pass/');
  });
  await run('globe-interactions',{width:1440,height:1000},async(page)=>{
    const canvas=page.locator('[data-atlas-canvas]');
    const marker=page.locator('[data-story-id=new-york]');
    const initial=await marker.getAttribute('style');
    const box=await canvas.boundingBox();
    await page.mouse.move(box.x+box.width*.7,box.y+box.height*.6);
    await page.mouse.down();
    assert.equal(await page.locator('[data-atlas-dialog]').evaluate(d=>d.open),true,'Pressing the globe opens focus view');
    await page.waitForFunction(previous=>document.querySelector('[data-story-id=new-york]').getAttribute('style')!==previous,initial);
    const expanded=await marker.getAttribute('style');
    await page.mouse.move(box.x+box.width*.7+70,box.y+box.height*.6+20,{steps:6});
    await page.mouse.up();
    await page.waitForFunction(previous=>document.querySelector('[data-story-id=new-york]').getAttribute('style')!==previous,expanded);
    await page.locator('[data-atlas-reset]').click();
    const cluster=page.locator('.atlas-pin:visible').filter({hasText:'4'}).first();
    await cluster.click();
    assert.equal(await page.locator('[data-story-cluster] button').count(),4,'Overlapping pins offer the individual stories');
    await page.locator('[data-atlas-year]').focus();await page.keyboard.press('Home');
    assert.equal(await page.locator('[data-atlas-story]').isHidden(),true,'Filtering closes an obsolete cluster preview');
    await page.keyboard.press('End');
    const beforeTurn=await marker.getAttribute('style');
    await page.locator('[data-atlas-turn="1"]').click();
    await page.waitForFunction(previous=>document.querySelector('[data-story-id=new-york]').getAttribute('style')!==previous,beforeTurn);
    const beforeZoom=await marker.getAttribute('style');
    await page.locator('[data-atlas-zoom="-1"]').click();
    await page.waitForFunction(previous=>document.querySelector('[data-story-id=new-york]').getAttribute('style')!==previous,beforeZoom);
    const beforeKey=await marker.getAttribute('style');
    await canvas.focus();await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(previous=>document.querySelector('[data-story-id=new-york]').getAttribute('style')!==previous,beforeKey);
    assert.equal(await page.locator('[data-atlas-motion]').textContent(),'pause clouds');
    await page.locator('[data-atlas-motion]').click();
    assert.equal(await page.locator('[data-atlas-motion]').textContent(),'animate clouds');
    await page.locator('[data-atlas-motion]').click();
    assert.equal(await page.locator('[data-atlas-motion]').textContent(),'pause clouds');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('[data-atlas-motion]').filter({hasText:'animate clouds'}).waitFor();
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.activeElement.matches('[data-atlas-canvas]'));
  },{motion:'no-preference'});
  await run('touch-scroll-and-drag',{width:390,height:844},async(page)=>{
    const canvas=page.locator('[data-atlas-canvas]');
    const dialog=page.locator('[data-atlas-dialog]');
    const marker=page.locator('[data-story-id=new-york]');
    const touch=await page.context().newCDPSession(page);
    const send=(type,x,y)=>touch.send('Input.dispatchTouchEvent',{
      type,touchPoints:type==='touchEnd'?[]:[{x,y,id:0}],
    });
    const box=await canvas.boundingBox();
    const x=Math.round(box.x+box.width*.47), y=Math.round(box.y+box.height*.63);
    await send('touchStart',x,y);
    for(const step of [20,55,105,155]) await send('touchMove',x,y-step);
    await send('touchEnd');
    await page.waitForFunction(()=>scrollY>25);
    assert.equal(await dialog.evaluate(el=>el.open),false,'A vertical swipe still scrolls the desk');
    await page.evaluate(()=>scrollTo({top:85,behavior:'instant'}));
    const gestureY=y-85;
    await send('touchStart',x,gestureY);
    assert.equal(await dialog.evaluate(el=>el.open),false,'Touch can become a scroll before opening');
    await send('touchMove',x+25,gestureY);
    await dialog.waitFor({state:'visible'});
    const before=await marker.getAttribute('style');
    await send('touchMove',x+65,gestureY);
    await send('touchEnd');
    await page.waitForFunction(previous=>document.querySelector('[data-story-id=new-york]').getAttribute('style')!==previous,before);
    await page.locator('[data-atlas-return]').click();
    await page.waitForFunction(()=>scrollY===85);
  },{touch:true});
  await run('graphics-recovery',{width:1366,height:768},async(page)=>{
    await page.locator('[data-atlas-explore]').click();
    const available=await page.locator('[data-atlas-canvas]').evaluate(canvas=>{
      const gl=canvas.getContext('webgl2')??canvas.getContext('webgl');
      const extension=gl.getExtension('WEBGL_lose_context');
      window.atlasTestContext=extension;
      extension?.loseContext();return Boolean(extension);
    });
    assert.equal(available,true,'The local renderer exposes a real loss/recovery extension');
    await page.locator('[data-atlas][data-graphics=fallback]').waitFor();
    assert.equal(await page.locator('[data-atlas-turn="1"]').isDisabled(),true);
    await page.locator('.atlas-choice').filter({hasText:'thirty seven days'}).click();
    assert.equal(await page.locator('[data-story-title]').textContent(),'thirty seven days');
    await page.evaluate(()=>window.atlasTestContext.restoreContext());
    await page.locator('[data-atlas][data-graphics=ready]').waitFor();
    assert.equal(await page.locator('[data-atlas-turn="1"]').isEnabled(),true);
    await page.locator('[data-atlas-dismiss]').click();
  });
  await run('renderer-failure',{width:390,height:844},async(page)=>{
    assert.ok(await page.locator('[data-atlas-fallback]').isVisible());
    await page.locator('.atlas-choice').filter({hasText:'thirty seven days'}).click();
    assert.match(await page.locator('[data-story-link]').getAttribute('href'),/thirty-seven-days/);
    await page.locator('[data-atlas-explore]').click();
    await page.locator('[data-atlas-filter=news]').click();
    await page.locator('[data-atlas-status]').filter({hasText:'2 recent news stories'}).waitFor();
  },{fallback:true});
  await run('texture-failure',{width:1440,height:1000},async(page)=>{
    assert.ok(await page.locator('[data-atlas-fallback]').isVisible());
    assert.equal(await page.locator('.atlas-choice').count(),6);
  },{textureFailure:true});
  await run('news-outage',{width:1440,height:1000},async(page,network)=>{
    await page.locator('[data-atlas-explore]').click();
    await page.locator('[data-atlas-filter=news]').click();
    await page.locator('[data-atlas-status]').filter({hasText:'News is unavailable'}).waitFor();
    assert.equal(await page.locator('.atlas-choice').count(),0);
    await page.locator('[data-atlas-filter=history]').click();assert.equal(await page.locator('.atlas-choice').count(),6);
    await page.locator('[data-atlas-filter=news]').click();
    await page.locator('[data-atlas-status]').filter({hasText:'News is unavailable'}).waitFor();
    assert.equal(network.newsRequests,2,'An unavailable feed can be retried');
  },{newsFailure:true});
  await run('no-javascript',{width:390,height:844},async(page)=>{
    await page.locator('[data-atlas-index] summary').click();
    assert.equal(await page.locator('[data-atlas-choice]').count(),6);
    assert.ok(await page.locator('.atlas-copy h1').isVisible());
    assert.ok(await page.locator('[data-atlas-explore]').isHidden());
  },{javascript:false});
}finally{
  await writeFile(new URL('report.json',artifacts),JSON.stringify({results,externalServices:'offline fixtures',schoolDeviceAcceptance:'not measured'},null,2));
  await browser.close();await server.stop();
}
if(results.some(result=>result.status==='failed'))process.exitCode=1;
console.log(`Atlas browser acceptance: ${results.filter(x=>x.status==='passed').length}/${results.length} passed.`);
