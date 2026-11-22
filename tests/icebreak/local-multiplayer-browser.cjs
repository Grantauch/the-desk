// ICEBREAK local multiplayer browser acceptance. All gamepads below are
// VIRTUAL Gamepad API samples: this does not verify real hardware or human feel.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {instrument,file}=require('./fixture.cjs');

const out=path.resolve(process.env.ICEBREAK_EVIDENCE||'browser-results/icebreak');
fs.mkdirSync(out,{recursive:true});
const html=instrument(fs.readFileSync(file,'utf8'));
const server=http.createServer((req,res)=>{
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);
});
const results=[];

(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
 try{
  const url='http://127.0.0.1:'+server.address().port;
  for(const renderer of ['webgl','canvas-2d']){
   for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    const mobile=viewport.width<500;
    const context=await browser.newContext({viewport,hasTouch:mobile,isMobile:mobile,deviceScaleFactor:1});
    if(renderer==='canvas-2d')await context.addInitScript(()=>{
     const native=HTMLCanvasElement.prototype.getContext;
     HTMLCanvasElement.prototype.getContext=function(type,...args){
      return typeof type==='string'&&type.startsWith('webgl')?null:native.call(this,type,...args);
     };
    });
    await context.addInitScript(()=>{
     window.__icebreakVirtualPads=[];
     Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>window.__icebreakVirtualPads});
    });
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    try{
     await page.goto(url);
     await page.waitForFunction(()=>window.fixture&&window.__ICEBREAK_TEST__);
     const actual=await page.evaluate(()=>window.__ICEBREAK_TEST__.getState().renderer);
     if(renderer==='webgl'&&actual!=='webgl'){
      results.push({renderer,viewport,status:'unavailable',actual});
      continue;
     }
     assert.equal(actual,renderer);
     await page.locator('.seats summary').click();
     await page.locator('select').nth(4).selectOption('kb2');
     await page.locator('#playBtn').click();
     const started=await page.evaluate(()=>{
      const f=window.fixture,a=window.__ICEBREAK_TEST__;
      f.clear();f.setDrop(0);
      const h=f.players.find(p=>p.device==='kb1'),v=f.players.find(p=>p.device==='kb2');
      Object.assign(h,{x:-14,z:-5,vx:0,vz:0,facing:0,stun:0,energy:1});
      Object.assign(v,{x:14,z:5,vx:0,vz:0,facing:Math.PI,stun:0,energy:1});
      return {players:a.getState().players.length,h:{x:h.x,z:h.z},v:{x:v.x,z:v.z},
       seatCount:document.getElementById('seatCount').textContent,
       noFollow:!a.getState().followCamera,
       viewDisabled:document.getElementById('viewBtn').disabled};
     });
     assert.equal(started.players,8);
     assert.match(started.seatCount,/2 HUMANS/);
     if(mobile){assert.equal(started.noFollow,true);assert.equal(started.viewDisabled,true)}
     // Native browser keyboard events: keys overlap in time but control
     // separate teams and never interfere with the other player's direction.
     await page.keyboard.down('w');
     await page.keyboard.down('ArrowRight');
     await page.evaluate(()=>window.__ICEBREAK_TEST__.step(.40));
     await page.keyboard.up('w');
     await page.keyboard.up('ArrowRight');
     const moved=await page.evaluate(()=>{
      const f=window.fixture,h=f.players.find(p=>p.device==='kb1'),v=f.players.find(p=>p.device==='kb2');
      return {hx:h.x,hz:h.z,vx:v.x,vz:v.z,hUp:f.inputFor('kb1').up,vRight:f.inputFor('kb2').right};
     });
     assert.ok(moved.hx>started.h.x+.5,'W must advance first center north');
     assert.ok(moved.vz>started.v.z+.15,'ArrowRight must advance second center screen-right');
     assert.ok(Math.abs(moved.hz-started.h.z)<.15,'keyboard 2 cannot steer keyboard 1');
     assert.equal(moved.hUp,false);
     assert.equal(moved.vRight,false);
     // Shared rink, two separate shooters. A press on keyboard 2 cannot
     // fire or steal the first keyboard's owned puck.
     await page.evaluate(()=>{
      const f=window.fixture,h=f.players.find(p=>p.device==='kb1');
      f.clear();f.setDrop(0);h.stun=0;f.give(h);
     });
     await page.keyboard.down('k');
     await page.keyboard.down('m');
     const charge=await page.evaluate(()=>{
      const f=window.fixture,a=window.__ICEBREAK_TEST__;
      a.step(.12);
      return {k:f.inputFor('kb1').shoot,m:f.inputFor('kb2').shoot,carrier:f.puck.owner?.device};
     });
     assert.equal(charge.k,true);
     assert.equal(charge.m,true);
     assert.equal(charge.carrier,'kb1');
     await page.keyboard.up('m');
     await page.keyboard.up('k');
     assert.equal(await page.evaluate(()=>window.fixture.puck.owner===null),true,'only first shooter releases its puck');
     // Real emulated touch gestures still work for keyboard 1 when two people
     // are assigned. Touch is not incorrectly mapped to keyboard 2.
     if(mobile){
      await page.evaluate(()=>{
       const f=window.fixture,h=f.players.find(p=>p.device==='kb1');
       f.clear();f.setDrop(0);Object.assign(h,{x:-12,z:-4,vx:0,vz:0,stun:0});
      });
      const touch=await context.newCDPSession(page),rect=await page.locator('[data-key="w"]').boundingBox();
      assert.ok(rect&&rect.width>0,'mobile movement controls must be visible');
      const initialX=await page.evaluate(()=>window.fixture.players.find(p=>p.device==='kb1').x);
      await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width/2,y:rect.y+rect.height/2}]});
      await page.evaluate(()=>window.__ICEBREAK_TEST__.step(.26));
      await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      const state=await page.evaluate(()=>{
       const f=window.fixture;return {x:f.players.find(p=>p.device==='kb1').x,up:f.inputFor('kb1').up};
      });
      assert.ok(state.x>initialX+.2);
      assert.equal(state.up,false);
      await touch.detach();
     }
     // Virtual controllers use the actual navigator.getGamepads polling path.
     const pads=await page.evaluate(()=>{
      const f=window.fixture,api=window.__ICEBREAK_TEST__;
      const mk=(x,y,buttons=[])=>({axes:[x,y],buttons:Array.from({length:8},(_,i)=>({pressed:buttons.includes(i)})),connected:true});
      for(let team=0;team<2;team++)for(let role=0;role<4;role++)
       api.setSeat(team,role,'pad'+(team*4+role));
      api.reset();f.clear();f.setDrop(0);
      for(const p of f.players){p.stun=0;p.vx=p.vz=0;p.energy=1}
      window.__icebreakVirtualPads=Array.from({length:8},(_,i)=>mk(i%2?-.8:.8,0));
      f.pollGamepads();
      const devices=f.players.map(p=>p.device),inputs=devices.map(d=>f.inputFor(d).axisX);
      const before=f.players.map(p=>({x:p.x,z:p.z}));
      api.step(.25);
      const finite=f.players.every(p=>[p.x,p.z,p.vx,p.vz].every(Number.isFinite));
      const moved=f.players.filter((p,i)=>Math.hypot(p.x-before[i].x,p.z-before[i].z)>.02).length;
      window.__icebreakVirtualPads[0]=null;
      f.pollGamepads();
      const disconnected=f.inputFor('pad0'),unaffected=f.inputFor('pad1');
      // Force a frame at the actual multiplayer zoom. Render-only markers
      // must expose all eight players, not just the six outfield skaters.
      f.render(.28);f.updateHUD();f.possessionHUD();
      document.getElementById('prompt').classList.remove('show');
      const nodes=[...document.querySelectorAll('.player-marker')].filter(n=>!n.hidden);
      const markerSeats=nodes.map(n=>Number(n.textContent.match(/P([1-8])(?:\\b|$)/)?.[1])).sort((a,b)=>a-b);
      const occluders=[document.querySelector('.topbar'),document.getElementById('possessionReadout')];
      if(innerWidth<=760)occluders.push(document.querySelector('.dpad'),document.querySelector('.actions'));
      const boxes=occluders.filter(Boolean).filter(n=>!n.hidden&&getComputedStyle(n).display!=='none').map(n=>n.getBoundingClientRect());
      const crosses=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
      const goalieMarkers=nodes.filter(n=>/P(?:4|8)(?:\\b|$)/.test(n.textContent));
      const goalieSafe=goalieMarkers.length===2&&goalieMarkers.every(n=>{
       const rect=n.getBoundingClientRect();
       return rect.left>=0&&rect.right<=innerWidth&&rect.top>=0&&rect.bottom<=innerHeight
        &&boxes.every(box=>!crosses(rect,box));
      });
      return {devices,inputs,finite,moved,pad0:{axisX:disconnected.axisX,axisY:disconnected.axisY,burst:disconnected.burst},
       pad1:unaffected.axisX,seatCount:document.getElementById('seatCount').textContent,
       markerSeats,goalieSafe,touchControlsHidden:getComputedStyle(document.querySelector('.mobilecontrols')).display==='none',goalieMarkers:goalieMarkers.map(n=>({label:n.textContent,top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom}))};
     });
     assert.equal(new Set(pads.devices).size,8);
     assert.equal(pads.devices.length,8);
     assert.ok(pads.inputs.every(v=>Math.abs(v)>.2),'eight distinct virtual controllers must be polled');
     assert.equal(pads.finite,true);
     assert.ok(pads.moved>=6,'most skaters should respond to their own assigned stick');
     assert.equal(pads.pad0.axisX,0,'disconnect must release steering');
     assert.equal(pads.pad0.burst,false);
     assert.ok(Math.abs(pads.pad1)>.2,'disconnect must not erase another controller input');
     assert.match(pads.seatCount,/8 HUMANS/);
     assert.deepEqual(pads.markerSeats,[1,2,3,4,5,6,7,8],
      'multiplayer camera must keep all eight human position markers visible');
     assert.equal(pads.goalieSafe,true,'both goalie markers must clear the HUD, touch controls, and screen edges: '+JSON.stringify(pads.goalieMarkers));
     assert.equal(pads.touchControlsHidden,true,'touch overlays must hide when no keyboard-1 touch seat is assigned');
     // Goalies share the same Gamepad API but A is a puck clear, not a
     // regular outfield pass. The position stays inside the goal crease.
     const goalie=await page.evaluate(()=>{
      const f=window.fixture,api=window.__ICEBREAK_TEST__,g=f.players.find(p=>p.team===1&&p.goalie);
      Object.assign(g,{x:25.4,z:0,vx:0,vz:0,stun:0});
      Object.assign(f.puck,{x:25,z:0,vx:0,vz:0,lock:0,owner:null,passFrom:null,passTarget:null});
      const p=window.__icebreakVirtualPads[7];p.axes=[0,0];p.buttons[0].pressed=true;
      f.pollGamepads();
      return {puckVX:f.puck.vx,owner:f.puck.owner?.id??null,keeper:g.device};
     });
     assert.ok(goalie.puckVX<0);
     assert.equal(goalie.owner,null);
     assert.equal(goalie.keeper,'pad7');
     await page.screenshot({path:path.join(out,'local-multiplayer-'+renderer+'-'+viewport.width+'-eight-pads.png')});
     // Physically simulated injury with two keyboard seats, followed by a
     // real keyboard Enter event to skip while the clock remains unchanged.
     // Stage on the exact keydown event; the live requestAnimationFrame loop
     // must not collide the pair a frame before the check is armed.
     await page.evaluate(()=>{
      window.addEventListener('keydown',e=>{
       if(e.key.toLowerCase()!=='l')return;
       const f=window.fixture,api=window.__ICEBREAK_TEST__;
       api.setSeat(0,0,'kb1');api.setSeat(1,0,'kb2');api.reset();f.clear();f.setDrop(0);
       const h=f.players.find(p=>p.device==='kb1'),v=f.players.find(p=>p.device==='kb2');
       Object.assign(h,{x:0,z:0,vx:13,vz:0,facing:0,stun:0,check:0,checkWindow:0,energy:1});
       Object.assign(v,{x:1.06,z:0,vx:0,vz:0,facing:Math.PI,stun:0,energy:1,balance:1,brace:0});
       f.give(v);
      },{capture:true,once:true});
     });
     await page.keyboard.down('l');
     const contact=await page.evaluate(()=>{
      const f=window.fixture,api=window.__ICEBREAK_TEST__,h=f.players.find(p=>p.device==='kb1'),v=f.players.find(p=>p.device==='kb2');
      // A browser paint may have advanced the hit before this read.
      const armed=h.checkWindow>0||f.phase==='injury';
      if(f.phase==='playing')f.collideSkaters(h,v);
      const clock=api.getState().timeLeft;
      api.step(2);
      return {armed,phase:f.phase,down:f.fallAmount(v),frozen:api.getState().timeLeft===clock};
     });
     await page.keyboard.up('l');
     assert.equal(contact.armed,true);
     assert.equal(contact.phase,'injury');
     assert.equal(contact.down,1);
     assert.equal(contact.frozen,true);
     await page.keyboard.press('Enter');
     assert.equal(await page.evaluate(()=>window.fixture.phase),'playing');
     if(mobile)assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.mobilecontrols')).display),'block',
      'touch controls must return when the keyboard-1 seat is reassigned');
     assert.equal(await page.evaluate(()=>window.fixture.players.filter(p=>['kb1','kb2'].includes(p.device)).length),2);
     await page.screenshot({path:path.join(out,'local-multiplayer-'+renderer+'-'+viewport.width+'-restarted.png')});
     assert.deepEqual(errors,[],'no browser page errors');
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
     results.push({renderer,viewport,status:'pass',twoKeyboard:true,virtualGamepads:8,disconnect:true,goalieClear:true,
      injuryStopAndSkip:true,mobileTouch:mobile,pageErrors:errors.length});
    }finally{await context.close()}
   }
  }
  assert.equal(results.filter(r=>r.status==='pass').length,4,
   'both renderers must pass both desktop and emulated mobile');
  console.log(JSON.stringify({suite:'ICEBREAK local multiplayer acceptance',results,
   limitations:['Virtual gamepads only; physical devices and simultaneous human testers remain unverified.']},null,2));
 }finally{
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(out,'local-multiplayer-evidence.json'),JSON.stringify({results},null,2));
 }
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
