// Regression screenshots and runtime checks for goalie saves across both renderers.
const {chromium}=require('playwright');
const {instrument,file}=require('./fixture.cjs');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const assert=require('node:assert/strict');
const html=instrument(fs.readFileSync(file,'utf8'));
const output=path.resolve(process.env.ICEBREAK_EVIDENCE||'browser-results/icebreak');
fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html)});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true}),results=[];
 try {
  for(const renderer of ['webgl','canvas-2d'])for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const context=await browser.newContext({viewport,hasTouch:viewport.width<500,deviceScaleFactor:1});
   if(renderer==='canvas-2d')await context.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:get.call(this,type,...args)}});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);
   await page.waitForFunction(()=>window.fixture&&window.__ICEBREAK_TEST__);
   const state=await page.evaluate(()=>{
    const f=window.fixture,api=window.__ICEBREAK_TEST__;api.start();f.clear();f.setPaused(true);
    const goalie=f.players.find(p=>p.goalie&&p.team===1);
    Object.assign(goalie,{x:25.3,z:0,vx:0,vz:0,stun:0,saveFlash:0,saves:0});
    Object.assign(f.puck,{owner:null,x:goalie.x-1.25,z:.67,vx:35,vz:0,lock:1,passTarget:null,passFrom:null});
    for(let i=0;i<12&&goalie.saves===0;i++)f.puckPhysics(1/90);
    f.render(0);return {renderer:api.getState().renderer,saves:goalie.saves,saveKind:goalie.saveKind,saveFlash:goalie.saveFlash,rebound:[f.puck.vx,f.puck.vz],overflow:document.documentElement.scrollWidth>innerWidth};
   });
   assert.equal(state.renderer,renderer);assert.equal(state.saves,1);
   assert.equal(state.saveKind,'GLOVE');assert.ok(state.saveFlash>0);
   assert.ok(state.rebound[0]<0&&state.rebound[1]>0);
   assert.equal(state.overflow,false);
   await page.screenshot({path:path.join(output,'goalie-save-'+renderer+'-'+viewport.width+'.png')});
   assert.deepEqual(errors,[]);
   results.push({renderer,viewport,status:'pass',saveKind:state.saveKind,pageErrors:errors.length});
   await context.close();
  }
  console.log(JSON.stringify({batch:'ICEBREAK goalie',scenarios:results},null,2));
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
