// Browser acceptance of the actual page, including Canvas fallback and touch-sized viewports.
const {chromium}=require('playwright');
const {instrument,file}=require('./fixture.cjs');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const assert=require('node:assert/strict');

const html=instrument(fs.readFileSync(file,'utf8'));
const output=path.resolve(process.env.ICEBREAK_EVIDENCE||'browser-results/icebreak');
fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html)});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true});
 const evidence=[];
 try{
  for(const renderer of ['webgl','canvas-2d'])for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const context=await browser.newContext({viewport,hasTouch:viewport.width<500,deviceScaleFactor:1});
   if(renderer==='canvas-2d')await context.addInitScript(()=>{
    const get=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:get.call(this,type,...args)};
   });
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);
   await page.waitForFunction(()=>window.fixture&&window.__ICEBREAK_TEST__);
   const state=await page.evaluate(()=>{
    const {fixture:f,__ICEBREAK_TEST__:api}=window;
    api.setSeat(0,1,'kb2');api.start();f.clear();
    const p=f.players[0],receiver=f.players[1],unused=f.players[2];
    Object.assign(p,{x:0,z:0,vx:0,vz:0,facing:0,stun:0});
    Object.assign(receiver,{x:3,z:.38,vx:0,vz:0,facing:0,stun:0});
    Object.assign(unused,{x:-14,z:7});
    f.give(p);f.pass(p);api.input('m',true);
    for(let i=0;i<35&&!api.touch().lastShot?.oneTimer;i++)f.puckPhysics(1/90);
    f.updateHUD();
    f.render(0);
    return {renderer:api.getState().renderer,oneTimer:api.touch().lastShot?.oneTimer,shooter:api.touch().lastShot?.number,velocity:Math.hypot(f.puck.vx,f.puck.vz),prompt:document.getElementById('prompt').textContent,
      overflow:document.documentElement.scrollWidth>innerWidth,glError:fallbackError()};
    function fallbackError(){return null}
   });
   assert.equal(state.renderer,renderer);
   assert.equal(state.oneTimer,true);
   assert.equal(state.shooter,16);
   assert.ok(state.velocity>31);
   assert.match(state.prompt,/ONE-TIMER/);
   assert.equal(state.overflow,false);
   await page.screenshot({path:path.join(output,'first-touch-'+renderer+'-'+viewport.width+'.png')});
   await page.evaluate(()=>window.__ICEBREAK_TEST__.goal(0));
   const goalText=await page.locator('#momentLabel').innerText();
   assert.match(goalText,/GLACIERS GOAL/);
   await page.screenshot({path:path.join(output,'first-touch-goal-'+renderer+'-'+viewport.width+'.png')});
   assert.deepEqual(errors,[]);
   evidence.push({renderer,viewport,status:'pass',shotVelocity:state.velocity,goalCaption:goalText,pageErrors:errors.length});
   await context.close();
  }
  console.log(JSON.stringify({batch:'ICEBREAK first-touch',scenarios:evidence},null,2));
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
