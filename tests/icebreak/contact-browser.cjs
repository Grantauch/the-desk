// Native Chromium acceptance: live collision presentation + combination interruption.
// Screenshots are evidence only; physics is asserted independently of the renderer.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {instrument,file}=require('./fixture.cjs');

const out=path.resolve(process.env.ICEBREAK_EVIDENCE||'browser-results/icebreak');
fs.mkdirSync(out,{recursive:true});
const html=instrument(fs.readFileSync(file,'utf8'));
const server=http.createServer((req,res)=>{
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
 res.end(html);
});
const results=[];
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({
  headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']
 });
 try{
  const url='http://127.0.0.1:'+server.address().port;
  for(const renderer of ['webgl','canvas-2d']){
   for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    for(const reduced of [false,true]){
     const context=await browser.newContext({
      viewport,hasTouch:viewport.width<500,isMobile:viewport.width<500,
      reducedMotion:reduced?'reduce':'no-preference',deviceScaleFactor:1
     });
     if(renderer==='canvas-2d')await context.addInitScript(()=>{
      const native=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(kind,...args){
       return typeof kind==='string'&&kind.startsWith('webgl')?null:native.call(this,kind,...args);
      };
     });
     const page=await context.newPage(),errors=[];
     page.on('pageerror',error=>errors.push(error.message));
     try{
      await page.goto(url);
      await page.waitForFunction(()=>window.fixture&&window.__ICEBREAK_TEST__);
      await page.locator('#playBtn').click(); // Hide the lobby before capturing game-state evidence.
      const actual=await page.evaluate(()=>window.__ICEBREAK_TEST__.getState().renderer);
      if(actual!==renderer&&renderer==='webgl'){
       results.push({renderer,viewport,reduced,status:'unavailable',actual});
       continue;
      }
      assert.equal(actual,renderer);
      const prefix='contact-'+renderer+'-'+viewport.width+(reduced?'-reduced':'');
      for(const [speed,tier] of [[4,0],[8,1],[11,2],[13,3]]){
       const state=await page.evaluate(speed=>{
        const f=window.fixture,api=window.__ICEBREAK_TEST__;
        api.setSeat(1,0,'kb2');api.reset();f.clear();
        const a=f.players.find(p=>p.device==='kb1');
        const b=f.players.find(p=>p.device==='kb2');
        Object.assign(a,{x:0,z:0,vx:speed,vz:0,facing:0,stun:0,energy:1,balance:1,check:0,checkWindow:0});
        Object.assign(b,{x:1.06,z:0,vx:0,vz:0,facing:Math.PI,stun:0,energy:1,balance:1,brace:0});
        f.give(b);
        const mass=f.ROLE_MASS;
        const momentumBefore=a.vx*mass[a.id]+b.vx*mass[b.id];
        const armed=f.beginCheck(a);f.collideSkaters(a,b);
        const momentumAfter=a.vx*mass[a.id]+b.vx*mass[b.id];
        // Allow the same 90 Hz simulation to start the fall before screenshot.
        api.step(.08);
        if(f.phase!=='injury')f.setPaused(true); // Freeze the pose for reproducible screenshots.
        // Render the middle of the physical response; no new impulse is introduced.
        a.impactTime=a.impactSpan*.52;b.impactTime=b.impactSpan*.52;
        const before=JSON.stringify([a.x,a.z,a.vx,a.vz,b.x,b.z,b.vx,b.vz,f.puck.owner?.id]);
        f.render(.14);
        const after=JSON.stringify([a.x,a.z,a.vx,a.vz,b.x,b.z,b.vx,b.vz,f.puck.owner?.id]);
        return {
         armed,tier:b.impactTier,phase:f.phase,fall:f.fallAmount(b),
         puckLoose:f.puck.owner===null,recoil:f.impactPose(b),
         power:b.impactPower,span:b.impactSpan,
         counter:a.impactX===-b.impactX&&a.impactZ===-b.impactZ,
         momentumError:Math.abs(momentumAfter-momentumBefore),
         renderPure:before===after,
         reduced:window.matchMedia('(prefers-reduced-motion: reduce)').matches,
         overflow:document.documentElement.scrollWidth>innerWidth
        };
       },speed);
       assert.equal(state.armed,true);
       assert.equal(state.tier,tier);
       assert.equal(state.reduced,reduced);
       assert.equal(state.renderPure,true,'visual feedback must not rewrite match physics');
       assert.ok(state.momentumError<1e-9,'collision must conserve momentum');
       assert.ok(state.counter,'checker and receiver must recoil in opposite directions');
       assert.ok(state.recoil>0&&state.span>.15);
       assert.equal(state.puckLoose,tier>=1);
       assert.equal(state.overflow,false);
       if(tier===2)assert.ok(state.fall>0);
       if(tier===3){
        // The overlay fades in; ensure screenshots show the stopped-play UI.
        await page.waitForFunction(()=>getComputedStyle(document.getElementById('overlay')).opacity==='1',null,{timeout:3000});
       }
       await page.screenshot({path:path.join(out,prefix+'-tier-'+tier+'.png')});
       if(tier===3){
        assert.equal(state.phase,'injury');
        assert.match(await page.locator('#overlayTitle').textContent(),/INJURY TIMEOUT/);
        assert.equal(state.fall,1,'injured player must remain down while play stops');
        const pause=await page.evaluate(()=>{
         const f=window.fixture,api=window.__ICEBREAK_TEST__,clock=api.getState().timeLeft;
         api.step(2);f.render(.2);
         const held=f.fallAmount(f.injured),frozen=api.getState().timeLeft===clock;
         f.endInjury();
         return {held,frozen,restarted:f.phase==='playing'};
        });
        assert.equal(pause.held,1);
        assert.equal(pause.frozen,true);
        assert.equal(pause.restarted,true);
       }
       if(reduced)assert.ok(state.recoil<=state.power*.251,'reduced motion must limit recoil amplitude');
       else assert.ok(state.recoil>state.power*.9,'normal motion should show full recoil');
      }
      // A passing combination must stop on a real puck-strip, even in the browser.
      const combo=await page.evaluate(()=>{
       const f=window.fixture,api=window.__ICEBREAK_TEST__,dt=1/90;
       api.setSeat(1,0,'kb2');api.reset();f.clear();
       const passer=f.players[0],receiver=f.players[1],third=f.players[2],hitter=f.players[3];
       Object.assign(passer,{x:0,z:0,vx:0,vz:0,facing:0,stun:0});
       Object.assign(receiver,{x:3,z:.38,vx:0,vz:0,facing:0,stun:0});
       Object.assign(third,{x:-14,z:7});
       f.give(passer);f.pass(passer);
       for(let i=0;i<42&&!f.puck.owner;i++)f.puckPhysics(dt);
       const activated=passer.cutTime>0&&passer.cutReceiver===receiver&&f.puck.owner===receiver;
       Object.assign(hitter,{x:receiver.x-1.06,z:receiver.z,vx:8,vz:0,facing:0,stun:0,energy:1,check:0,checkWindow:0});
       Object.assign(receiver,{vx:0,vz:0,stun:0,balance:1,brace:0});
       f.beginCheck(hitter);f.collideSkaters(hitter,receiver);f.setPaused(true);f.render(.2);
       return {activated,loose:f.puck.owner===null,canceled:passer.cutTime===0&&passer.cutReceiver===null,impact:receiver.impactPower>0};
      });
      assert.deepEqual(combo,{activated:true,loose:true,canceled:true,impact:true});
      await page.screenshot({path:path.join(out,prefix+'-interrupted-combination.png')});
      assert.deepEqual(errors,[],'no uncaught browser errors');
      const glError=await page.evaluate(()=>{
       const canvas=document.getElementById('game');
       const g=canvas.getContext('webgl2')||canvas.getContext('webgl');
       return g?g.getError():null;
      });
      if(renderer==='webgl')assert.equal(glError,0);
      results.push({renderer,viewport,reduced,status:'pass',hitTiers:[0,1,2,3],interruptedCombination:true,pageErrors:errors.length});
     }finally{await context.close()}
    }
   }
  }
  assert.ok(results.filter(r=>r.status==='pass'&&r.renderer==='canvas-2d').length===4,
   'all four Canvas/reduced-motion configurations must pass');
  assert.ok(results.some(r=>r.status==='pass'&&r.renderer==='webgl'),
   'WebGL must actually be exercised; an unavailable renderer cannot be reported as verified');
  console.log(JSON.stringify({suite:'ICEBREAK contact and passing browser QA',results},null,2));
 }finally{
  await browser.close();server.close();
  fs.writeFileSync(path.join(out,'contact-browser-evidence.json'),JSON.stringify({results},null,2));
 }
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
