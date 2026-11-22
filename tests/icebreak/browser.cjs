const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const {instrument,file}=require('./fixture.cjs');
const out=path.resolve(process.env.ICEBREAK_EVIDENCE||'browser-results/icebreak');
fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(file,'utf8');
const report={browser:'Chromium',scenarios:[],limitations:['Emulated mobile viewport/touch; no physical phone or controller tested.','No network multiplayer implemented or tested.']};
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url.startsWith('/fixture')?instrument(html):html)});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 try{
  for(const renderer of ['webgl','canvas-2d'])for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const mobile=viewport.width<500,context=await browser.newContext({viewport,hasTouch:mobile,isMobile:mobile,deviceScaleFactor:1});
   if(renderer==='canvas-2d')await context.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:get.call(this,type,...args)}});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url);await page.waitForFunction(()=>window.__ICEBREAK_TEST__);
   const detected=await page.evaluate(()=>window.__ICEBREAK_TEST__.getState().renderer);
   if(renderer==='webgl'&&detected!=='webgl'){report.scenarios.push({renderer,viewport,status:'unavailable'});await context.close();continue}
   assert.equal(detected,renderer);
   await page.screenshot({path:path.join(out,`${renderer}-${viewport.width}-lobby.png`)});
   if(mobile){
    const solo=await context.newPage();await solo.goto(url);await solo.waitForFunction(()=>window.__ICEBREAK_TEST__);
    await solo.locator('#playBtn').click();await solo.locator('#soundBtn').click();
    assert.equal(await solo.locator('#soundBtn').getAttribute('aria-pressed'),'true');
    await solo.reload();assert.equal(await solo.locator('#soundBtn').getAttribute('aria-pressed'),'true','mute setting survives reload');
    await solo.locator('#playBtn').click();await solo.locator('#soundBtn').click();
    assert.equal(await solo.locator('#soundBtn').getAttribute('aria-pressed'),'false');await solo.waitForTimeout(300);
    assert.equal(await solo.evaluate(()=>window.__ICEBREAK_TEST__.getState().followCamera),true,'solo mobile follows action');
    await solo.screenshot({path:path.join(out,`${renderer}-${viewport.width}-solo-follow.png`)});
    await solo.evaluate(()=>window.__ICEBREAK_TEST__.setPuck(25,0));
    await solo.waitForFunction(()=>!document.getElementById('puckGuide').hidden);
    assert.match(await solo.locator('#puckGuide').innerText(),/PUCK ↑/);
    await solo.locator('#viewBtn').click();assert.equal(await solo.evaluate(()=>window.__ICEBREAK_TEST__.getState().followCamera),false,'full rink camera available');
    await solo.screenshot({path:path.join(out,`${renderer}-${viewport.width}-solo-full-rink.png`)});
    await solo.locator('#pauseBtn').click();assert.equal(await solo.locator('#pauseBtn').getAttribute('aria-label'),'Resume game');
    await solo.locator('#playBtn').click();assert.equal(await solo.locator('#pauseBtn').getAttribute('aria-label'),'Pause game');
    await solo.close();
   }
   // Exercise the real lobby and real DOM keyboard/pointer controls.
   await page.locator('[data-rink="park"]').click();await page.locator('[data-mode="powerups"]').click();await page.locator('.seats summary').click();
   await page.locator('#seatGrid select').nth(4).selectOption('kb2');await page.locator('#playBtn').click();
   await page.waitForTimeout(1500);
   const before=await page.evaluate(()=>window.__ICEBREAK_TEST__.getState().players.find(p=>p.device==='kb1'));
   const touch=mobile?await context.newCDPSession(page):null;
   if(mobile){const rect=await page.locator('[data-key="w"]').boundingBox();await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width/2,y:rect.y+rect.height/2}]})}else await page.keyboard.down('w');
   await page.waitForTimeout(320);
   if(mobile)await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.keyboard.up('w');
   const after=await page.evaluate(()=>window.__ICEBREAK_TEST__.getState().players.find(p=>p.device==='kb1'));
   assert.ok(after.x>before.x+.2,'up moves world +x / screen north');
   await page.keyboard.down('ArrowRight');await page.waitForTimeout(300);await page.keyboard.up('ArrowRight');
   assert.ok((await page.evaluate(()=>window.__ICEBREAK_TEST__.getState().players.find(p=>p.device==='kb2').z))>0);
   await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__ICEBREAK_TEST__.getState().paused),true);await page.locator('#playBtn').click();
   await page.screenshot({path:path.join(out,`${renderer}-${viewport.width}-live.png`)});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   // Deterministic controlled scene: scenario hook is present only in this test URL.
   await page.goto(url+'/fixture');await page.locator('#playBtn').click();
   await page.evaluate(()=>{const f=window.fixture;f.clear();const p=f.players[0];p.x=0;p.z=0;p.facing=0;p.stun=999;f.give(p);f.setPaused(true);f.possessionHUD()});
   await page.waitForTimeout(1400);
   assert.ok(await page.locator('.player-marker.carrier').isVisible());assert.match(await page.locator('#possessionReadout').innerText(),/Glaciers center has puck/);
   await page.screenshot({path:path.join(out,`${renderer}-${viewport.width}-possession.png`)});
   // Hold/release through keyboard events and pointer cancellation.
   await page.evaluate(()=>{window.fixture.setPaused(false);window.fixture.players[0].stun=0});
   await page.keyboard.down('k');await page.waitForTimeout(250);await page.keyboard.up('k');
   assert.equal(await page.evaluate(()=>window.fixture.players[0].has),false);
   if(mobile){const r=await page.locator('[data-key="w"]').boundingBox();await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2}]});await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal(await page.evaluate(()=>window.fixture.inputFor('kb1').up),false)}
   // Start a contact scenario, then trigger the check through the real control.
   await page.evaluate(mobile=>{
    // Stage just before dispatch so browser scheduling can't move either
    // player into passive contact before the actual button event.
    window.addEventListener(mobile?'pointerdown':'keydown',()=>{
     const f=window.fixture,a=f.players[0],b=f.players[3];
     f.clear();Object.assign(a,{x:-2.25,z:0,vx:13,facing:0,stun:0,energy:1,check:0});
     Object.assign(b,{x:0,z:0,stun:999,facing:Math.PI});f.give(b);
    },{once:true,capture:true});
   },mobile);
   if(mobile)await page.locator('[data-key="l"]').tap();
   else await page.keyboard.press('l');
   await page.waitForFunction(()=>window.fixture.phase==='injury',null,{timeout:5000}).catch(async error=>{
    console.error(renderer,viewport,await page.evaluate(()=>({phase:window.fixture.phase,a:window.fixture.players[0],b:window.fixture.players[3]})));
    throw error;
   });
   const stoppage=await page.evaluate(()=>({clock:window.__ICEBREAK_TEST__.getState().timeLeft,energy:window.fixture.players[0].energy}));
   await page.waitForFunction(()=>getComputedStyle(document.getElementById('overlay')).opacity==='1');
   await page.screenshot({path:path.join(out,renderer+'-'+viewport.width+'-injury-timeout.png')});
   assert.match(await page.locator('#overlayTitle').innerText(),/INJURY TIMEOUT/);
   assert.equal(await page.locator('#setup').isVisible(),false);
   assert.equal(await page.evaluate(()=>window.__ICEBREAK_TEST__.getState().timeLeft),stoppage.clock);
   if(mobile)await page.locator('#playBtn').tap();else await page.keyboard.press('Enter');
   assert.equal(await page.evaluate(()=>window.fixture.phase),'playing');
   assert.equal(await page.evaluate(()=>window.fixture.players[0].energy),stoppage.energy);
   const glInfo=await page.evaluate(()=>{const g=document.getElementById('game').getContext('webgl2')||document.getElementById('game').getContext('webgl');if(!g)return null;const e=g.getExtension('WEBGL_debug_renderer_info');return {version:g.getParameter(g.VERSION),renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),error:g.getError()}});
   if(glInfo)assert.equal(glInfo.error,0);
   assert.deepEqual(errors,[]);
   report.scenarios.push({renderer,viewport,status:'pass',glInfo,pageErrors:errors,northwardDistance:after.x-before.x});await context.close();
  }
  // Complete mode/rink/seat matrix and shot-driven north/south scoring in browser.
  const page=await browser.newPage();await page.goto(url+'/fixture');
  for(const rink of ['school','park','mars'])for(const mode of ['regular','powerups']){
   const result=await page.evaluate(({rink,mode})=>{const a=window.__ICEBREAK_TEST__,f=window.fixture;a.setRink(rink);a.setMode(mode);a.reset();f.clear();a.step(8);return {state:a.getState(),finite:f.players.every(p=>[p.x,p.z,p.vx,p.vz,p.facing].every(Number.isFinite))}},{rink,mode});
   assert.equal(result.state.players.length,8);assert.equal(result.finite,true);assert.equal(result.state.powerItems.length>0,mode==='powerups');
  }
  const assignments=await page.evaluate(()=>{const a=window.__ICEBREAK_TEST__;for(let team=0;team<2;team++)for(let role=0;role<4;role++)a.setSeat(team,role,'pad'+(team*4+role));a.reset();return a.getState().players.map(p=>p.device)});assert.equal(new Set(assignments).size,8);
  for(const team of [0,1]){const result=await page.evaluate(team=>{const a=window.__ICEBREAK_TEST__,f=window.fixture;a.reset();f.clear();f.players.filter(p=>p.goalie).forEach(p=>p.z=4.2);const p=f.players.find(p=>p.team===team&&!p.goalie);p.x=team?-22:22;p.z=0;p.facing=team?Math.PI:0;f.give(p);f.shot(p,1);a.step(.3);return a.getState().score},team);assert.equal(result[team],1)}
  report.matrix='Both modes × all three rinks; eight unique gamepad seat assignments; shot-driven top/bottom goal credit; injury triggered and skipped through keyboard and emulated touch.';
  await page.close();
 }finally{await browser.close();server.close();fs.writeFileSync(path.join(out,'browser-evidence.json'),JSON.stringify(report,null,2))}
 console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
