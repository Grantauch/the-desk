// Verify a real browser can show and complete give-and-go on WebGL/Canvas.
const {chromium}=require('playwright');
const {instrument,file}=require('./fixture.cjs');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const assert=require('node:assert/strict');
const html=instrument(fs.readFileSync(file,'utf8'));
const out=path.resolve(process.env.ICEBREAK_EVIDENCE||'browser-results/icebreak');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html)});
(async()=>{
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const browser=await chromium.launch({headless:true}),results=[];
 try {
  for(const renderer of ['webgl','canvas-2d'])for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const context=await browser.newContext({viewport,hasTouch:viewport.width<500,deviceScaleFactor:1});
   if(renderer==='canvas-2d')await context.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:get.call(this,type,...args)}});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);
   await page.waitForFunction(()=>window.fixture&&window.__ICEBREAK_TEST__);
   const state=await page.evaluate(()=>{
    const f=window.fixture,api=window.__ICEBREAK_TEST__;
    api.setSeat(0,0,'ai');api.setSeat(0,1,'kb1');api.start();f.clear();f.setPaused(true);
    const p=f.players[0],receiver=f.players[1],third=f.players[2];
    Object.assign(p,{x:0,z:0,vx:0,vz:0,facing:0,stun:0});
    Object.assign(receiver,{x:3,z:.38,vx:0,vz:0,facing:0,stun:0});
    Object.assign(third,{x:-14,z:7});
    f.give(p);f.pass(p);
    for(let i=0;i<42&&!f.puck.owner;i++)f.puckPhysics(1/90);
    p.x=8;p.z=5; // A runner has had time to move up an open lane.
    f.updateHUD();f.render(0);
    const marker=[...document.querySelectorAll('.player-marker')].find(el=>!el.hidden&&el.textContent.includes('GIVE & GO'));
    return {renderer:api.getState().renderer,received:f.puck.owner===receiver,runner:p.cutReceiver===receiver,
      hud:document.getElementById('statusText').textContent,marker:marker?.textContent||null,
      overflow:document.documentElement.scrollWidth>innerWidth};
   });
   assert.equal(state.renderer,renderer);
   assert.equal(state.received,true);assert.equal(state.runner,true);
   assert.match(state.hud,/GIVE & GO/);assert.match(state.marker||'',/GIVE & GO/);
   assert.equal(state.overflow,false);
   await page.screenshot({path:path.join(out,'give-go-'+renderer+'-'+viewport.width+'.png')});
   const completion=await page.evaluate(()=>{
    const f=window.fixture,p=f.players[0],receiver=f.players[1];
    f.pass(receiver);f.updateHUD();f.render(.3);
    return {target:f.puck.passTarget?.number,combos:receiver.combos,runnerActive:p.cutTime>0,prompt:document.getElementById('prompt').textContent};
   });
   assert.equal(completion.target,9);
   assert.equal(completion.combos,1);assert.equal(completion.runnerActive,false);
   assert.match(completion.prompt,/GIVE & GO/);
   assert.deepEqual(errors,[]);
   results.push({renderer,viewport,status:'pass',runner:state.marker,returnedTo:completion.target,pageErrors:errors.length});
   await context.close();
  }
  console.log(JSON.stringify({batch:'ICEBREAK offensive combinations',scenarios:results},null,2));
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
