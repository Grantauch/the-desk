// Batch 11 browser acceptance: real keyboard and touch controls, completed-pass
// follow, UI visibility and multiplayer seat ownership on WebGL and Canvas.
const {chromium}=require('playwright');
const {instrument,file}=require('./fixture.cjs');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const html=instrument(fs.readFileSync(file,'utf8')),out=path.resolve(process.env.ICEBREAK_EVIDENCE||'browser-results/icebreak');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html)});
(async()=>{
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const browser=await chromium.launch({headless:true}),results=[];
 try{
  for(const renderer of ['webgl','canvas-2d'])for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:viewport.width<500});
   if(renderer==='canvas-2d')await context.addInitScript(()=>{
    const get=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:get.call(this,type,...args)};
   });
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);
   await page.waitForFunction(()=>window.fixture&&window.__ICEBREAK_TEST__);
   const drop=await page.locator('#playBtn').boundingBox();
   assert.ok(drop&&drop.y>=0&&drop.y+drop.height<=viewport.height,'Start button must stay visible before scrolling');
   await page.locator('.guide summary').click();
   const toggle=page.locator('#autoFollowToggle');
   assert.equal(await toggle.isChecked(),true);
   await toggle.uncheck();
   assert.equal(await page.evaluate(()=>window.fixture.config.autoFollow),false);
   await toggle.check();
   assert.equal(await page.evaluate(()=>window.fixture.config.autoFollow),true);
   await page.locator('.guide summary').click();
   await page.locator('#playBtn').click();
   await page.evaluate(()=>{
    const f=window.fixture;
    f.clear();
    for(const p of f.players)p.stun=0;
    const p=f.humanFor('kb1'),wing=f.players[1],defender=f.players[2];
    p.x=-5;p.z=1;wing.x=10;wing.z=4;defender.x=2;defender.z=0;
    Object.assign(f.puck,{owner:null,x:2,z:0,vx:0,vz:0});
   });
   if(viewport.width<500){
    assert.equal(await page.locator('#touchSwitch').isVisible(),true);
    await page.locator('#touchSwitch').tap();
   }else{
    await page.keyboard.press('q');
   }
   const switched=await page.evaluate(()=>{
    const f=window.fixture;
    f.updateHUD();f.render(0);
    return {renderer:window.__ICEBREAK_TEST__.getState().renderer,role:f.control.id,device:f.control.device,
      humans:f.players.filter(p=>p.device!=='ai').length,player:document.getElementById('playerName').textContent,
      prompt:document.getElementById('prompt').textContent,overflow:document.documentElement.scrollWidth>innerWidth};
   });
   assert.equal(switched.renderer,renderer);
   assert.equal(switched.role,2);assert.equal(switched.device,'kb1');assert.equal(switched.humans,1);
   assert.match(switched.player,/DEFENDER/);assert.match(switched.prompt,/SKATER SWITCH/);
   assert.equal(switched.overflow,false);
   await page.screenshot({path:path.join(out,'switch-'+renderer+'-'+viewport.width+'.png')});
   const completion=await page.evaluate(()=>{
    const f=window.fixture,p=f.humanFor('kb1'),receiver=f.players[1],other=f.players[0];
    Object.assign(p,{x:0,z:0,vx:0,vz:0,facing:0,stun:0,receiveWait:0});
    Object.assign(receiver,{x:3,z:.38,vx:0,vz:0,stun:0,receiveWait:0});
    Object.assign(other,{x:-14,z:7,vx:0,vz:0,stun:0});
    for(const e of f.players.filter(p=>p.team===1&&!p.goalie)){e.x=24;e.z=10}
    f.give(p);f.pass(p);
    const target=f.puck.passTarget?.id;
    for(let i=0;i<50&&!f.puck.owner;i++)f.puckPhysics(1/90);
    f.updateHUD();f.render(0);
    return {target,received:f.puck.owner===receiver,control:f.control.id,oldAI:p.device==='ai',
      passes:f.matchStats.human.passes,prompt:document.getElementById('prompt').textContent,
      player:document.getElementById('playerName').textContent,
      overflow:document.documentElement.scrollWidth>innerWidth};
   });
   assert.equal(completion.target,1);assert.equal(completion.received,true);
   assert.equal(completion.control,1);assert.equal(completion.oldAI,true);
   assert.equal(completion.passes,1);assert.match(completion.player,/WING/);
   assert.match(completion.prompt,/PASS COMPLETE/);
   assert.equal(completion.overflow,false);
   await page.screenshot({path:path.join(out,'pass-follow-'+renderer+'-'+viewport.width+'.png')});
   await page.reload();
   await page.waitForFunction(()=>window.fixture&&window.__ICEBREAK_TEST__);
   await page.locator('.seats summary').click();
   await page.locator('#seatGrid select').nth(4).selectOption('kb2');
   const visibility=await page.evaluate(()=>({
    buttonHidden:document.getElementById('touchSwitch').hidden,
    humans:window.fixture.config.seats.filter(v=>v!=='ai').length
   }));
   assert.equal(visibility.buttonHidden,true);assert.equal(visibility.humans,2);
   await page.locator('#playBtn').click();
   const before=await page.evaluate(()=>window.fixture.players.map(p=>p.device));
   await page.keyboard.press('q');await page.keyboard.press('.');
   const after=await page.evaluate(()=>({
    devices:window.fixture.players.map(p=>p.device),
    solo:window.fixture.matchStats.solo
   }));
   assert.deepEqual(after.devices,before);
   assert.equal(after.solo,false);
   assert.deepEqual(errors,[]);
   results.push({renderer,viewport,soloSwitch:'pass',touch:viewport.width<500,followCompletePass:'pass',multiplayerLocked:'pass',pageErrors:0});
   await context.close();
  }
  console.log(JSON.stringify({batch:'ICEBREAK solo switch and completed pass follow',scenarios:results},null,2));
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
