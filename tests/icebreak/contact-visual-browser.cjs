// Browser verification for impact, prone slide and planted rise in both render paths.
// Uses real collision setup; there is no production scenario editor or debug control.
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
 try{
  for(const renderer of ['webgl','canvas-2d'])for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const context=await browser.newContext({viewport,hasTouch:viewport.width<500,deviceScaleFactor:1});
   if(renderer==='canvas-2d')await context.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:get.call(this,type,...args)}});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);
   await page.waitForFunction(()=>window.fixture&&window.__ICEBREAK_TEST__);
   const down=await page.evaluate(()=>{
    const f=window.fixture,api=window.__ICEBREAK_TEST__;
    api.setSeat(1,0,'kb2');api.start();f.clear();
    const attacker=f.players.find(p=>p.device==='kb1'),target=f.players.find(p=>p.device==='kb2');
    Object.assign(attacker,{x:0,z:0,vx:11,vz:0,facing:0,stun:0});
    Object.assign(target,{x:1.06,z:.11,vx:0,vz:0,facing:Math.PI,stun:0});
    const contact=f.beginCheck(attacker);f.collideSkaters(attacker,target);
    f.setPaused(true); // freeze the autonomous frame while documenting exact poses
    for(let i=0;i<16;i++)f.updatePlayers(1/90);
    f.updateHUD();f.render(.18);
    const canvas=document.getElementById('game'),gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
    const pixel=(x,y)=>{const bytes=new Uint8Array(4);gl.readPixels(Math.floor(canvas.width*x),Math.floor(canvas.height*y),1,1,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return [...bytes]};
    // Use the median of separate ice interior points. A full-rink camera
    // can put the blue/red painted lines under any single fixed pixel.
    const iceSamples=gl?[pixel(.50,.45),pixel(.50,.51),pixel(.50,.57)]:[];
    const ink=gl?{ice:iceSamples.sort((a,b)=>a[0]-b[0])[1],boards:pixel(.07,.60),lost:gl.isContextLost(),error:gl.getError()}:null;
    const marker=[...document.querySelectorAll('.player-marker')].find(x=>!x.hidden&&x.textContent.includes('DOWN'));
    const pose=f.bodyPose(target);
    return {renderer:api.getState().renderer,contact,down:target.fallTime>0,pose,marker:marker?.textContent||null,
      overflow:document.documentElement.scrollWidth>innerWidth,ink};
   });
   assert.equal(down.renderer,renderer);assert.equal(down.contact,true);assert.equal(down.down,true);
   assert.ok(down.pose.fall>.1,'body must be visibly horizontal/leaning after a real impact');
   assert.ok(down.pose.hit>0,'contact flash must come from collision');
   assert.match(down.marker,/DOWN/);assert.equal(down.overflow,false);
   if(renderer==='webgl'){
    assert.equal(down.ink.lost,false);
    assert.equal(down.ink.error,0);
    assert.ok(down.ink.ice[0]>down.ink.boards[0]+40,'painted WebGL ice must contrast with the dark boards');
   }
   await page.waitForTimeout(90); // allow the browser compositor to present the finished frame
   await page.screenshot({path:path.join(out,'body-check-down-'+renderer+'-'+viewport.width+'.png')});
   const rise=await page.evaluate(()=>{
    const f=window.fixture,target=f.players.find(p=>p.device==='kb2');
    for(let i=0;i<90&&target.fallTime>0;i++)f.updatePlayers(1/90);
    f.updateHUD();f.render(.95);
    const marker=[...document.querySelectorAll('.player-marker')].find(x=>!x.hidden&&x.textContent.includes('GETTING UP'));
    const pose=f.bodyPose(target);
    return {fall:target.fallTime,stand:pose.stand,marker:marker?.textContent||null,stun:target.stun};
   });
   assert.equal(rise.fall,0);assert.ok(rise.stand>0);
   assert.match(rise.marker,/GETTING UP/);assert.equal(rise.stun,0);
   await page.screenshot({path:path.join(out,'body-check-rise-'+renderer+'-'+viewport.width+'.png')});
   assert.deepEqual(errors,[]);
   results.push({renderer,viewport,status:'pass',down:down.marker,rise:rise.marker,pageErrors:errors.length});
   await context.close();
  }
  console.log(JSON.stringify({batch:'ICEBREAK contact body language',scenarios:results},null,2));
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
