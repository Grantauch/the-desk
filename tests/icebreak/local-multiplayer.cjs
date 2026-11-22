const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');

// These tests simulate distinct local input devices. No claim of real
// controllers, real phones, online play, or two physical human testers.
function match(){
 const result=fixture(),{f,api}=result;
 api.setSeat(0,0,'kb1');
 api.setSeat(1,0,'kb2');
 api.start();
 f.clear();
 const home=f.players.find(p=>p.device==='kb1');
 const away=f.players.find(p=>p.device==='kb2');
 Object.assign(home,{x:-14,z:-5,vx:0,vz:0,facing:0,stun:0,energy:1,check:0,checkWindow:0});
 Object.assign(away,{x:14,z:5,vx:0,vz:0,facing:Math.PI,stun:0,energy:1,check:0,checkWindow:0});
 return {...result,home,away};
}
const pad=(x=0,y=0,buttons=[])=>({
 axes:[x,y],buttons:Array.from({length:8},(_,i)=>({pressed:buttons.includes(i)}))
});
test('two keyboard humans steer independently through opposite teams on shared north-south ice',()=>{
 const {f,api,home,away}=match();
 const start={hx:home.x,hz:home.z,ax:away.x,az:away.z};
 api.input('w',true);api.input('arrowright',true);
 api.step(.42);
 api.input('w',false);api.input('arrowright',false);
 assert.ok(home.x>start.hx+.65,'W must accelerate the first human toward north');
 assert.ok(away.z>start.az+.20,'ArrowRight must accelerate the second human toward screen right');
 assert.ok(Math.abs(home.z-start.hz)<.15,'ArrowRight must not steer keyboard 1');
 assert.ok(Math.abs(away.x-start.ax)<.5,'W must not accelerate keyboard 2');
 const h=f.inputFor('kb1'),a=f.inputFor('kb2');
 assert.equal(h.up,false);assert.equal(a.right,false);
 assert.equal(f.players.filter(p=>p.device!=='ai').length,2);
});
test('keyboard 1 and keyboard 2 use independent shoot and check buttons',()=>{
 const {f,api,home,away}=match();
 f.give(home);
 api.input('k',true);
 assert.equal(f.inputFor('kb1').shoot,true);
 assert.equal(f.inputFor('kb2').shoot,false);
 api.step(.15);
 api.input('m',true);
 assert.equal(f.inputFor('kb2').shoot,true);
 assert.equal(f.inputFor('kb1').shoot,true);
 api.input('m',false);
 assert.equal(home.has,true,'non-carrier shoot cannot fire the other team puck');
 api.input('k',false);
 assert.equal(home.has,false,'only the owner can release the puck');
 assert.ok(Math.hypot(f.puck.vx,f.puck.vz)>5);
 api.input(',',true);
 assert.ok(away.checkWindow>0,'keyboard 2 checks independently');
 assert.equal(home.checkWindow,0);
 api.input(',',false);
});
test('reassigning a keyboard to another seat never duplicates that input',()=>{
 const {f,api}=match();
 assert.equal(api.setSeat(1,1,'kb1'),true);
 api.reset();
 const state=api.getState(),humans=state.players.filter(p=>p.device==='kb1');
 assert.equal(humans.length,1);
 assert.equal(humans[0].team,1);
 assert.equal(humans[0].role,'WING');
 assert.equal(state.config.seats[0],'ai');
 assert.equal(state.config.seats[5],'kb1');
 assert.equal(f.players.filter(p=>p.device==='kb2').length,1);
});
test('all eight local gamepad seats can be uniquely assigned and polled',()=>{
 const {f,api,pads}=match();
 for(let team=0;team<2;team++)for(let role=0;role<4;role++)
  assert.equal(api.setSeat(team,role,'pad'+(team*4+role)),true);
 api.reset();f.clear();
 assert.equal(new Set(f.players.map(p=>p.device)).size,8);
 for(let i=0;i<8;i++)pads[i]=pad((i%2?-.70:.70),i%3===0?.45:0);
 f.pollGamepads();
 for(let i=0;i<8;i++){
  const input=f.inputFor('pad'+i);
  assert.ok(Math.abs(input.axisX)>.2,'seat '+i+' has its own analog direction');
  assert.ok(Math.hypot(input.axisX,input.axisY)<=1+1e-9,'analog magnitude is clamped');
 }
 assert.equal(f.players.filter(p=>p.device==='ai').length,0);
});
test('realistic analog dead zone, diagonals, trigger and unplugging cannot stick an input',()=>{
 const {f,api,pads}=match();
 api.setSeat(0,1,'pad0');api.reset();f.clear();
 const wing=f.players.find(p=>p.device==='pad0');
 Object.assign(wing,{x:-8,z:-6,stun:0,energy:1,shotCharge:.5});
 pads[0]=pad(.10,.08);
 f.pollGamepads();
 assert.equal(f.inputFor('pad0').axisX,0);
 assert.equal(f.inputFor('pad0').axisY,0);
 pads[0]=pad(.9,.9,[7]);
 f.pollGamepads();
 assert.ok(Math.hypot(f.inputFor('pad0').axisX,f.inputFor('pad0').axisY)<=1);
 assert.equal(f.inputFor('pad0').burst,true);
 const original={x:wing.x,z:wing.z};
 api.step(.24);
 assert.ok(Math.hypot(wing.x-original.x,wing.z-original.z)>.1);
 pads[0]=null;
 f.pollGamepads();
 assert.equal(f.inputFor('pad0').axisX,0);
 assert.equal(f.inputFor('pad0').axisY,0);
 assert.equal(f.inputFor('pad0').burst,false);
 assert.equal(f.inputFor('pad0').shoot,false);
 assert.equal(wing.shotCharge,0);
});
test('goalie gamepad pass clears a nearby loose puck, never changes the other human assignment',()=>{
 const {f,api,pads,home}=match();
 api.setSeat(1,3,'pad0');api.reset();f.clear();
 const keeper=f.players.find(p=>p.team===1&&p.goalie);
 Object.assign(keeper,{stun:0,x:25.4,z:0});
 Object.assign(f.puck,{x:25,z:0,vx:0,vz:0,owner:null,lock:0,passTarget:null,passFrom:null});
 pads[0]=pad(0,0,[0]);
 f.pollGamepads();
 assert.ok(f.puck.vx<0,'away goalie clears to the opposing end');
 assert.equal(f.puck.owner,null);
 assert.equal(f.players.filter(p=>p.device==='kb1').length,1);
 assert.equal(api.getState().players.length,8);
});
test('injury freezes the game clock for both human players, skips on Enter, and keeps assignments',()=>{
 const {f,api,events,home,away}=match();
 Object.assign(home,{x:0,z:0,vx:13,vz:0,facing:0,check:0,checkWindow:0,stun:0,energy:1});
 Object.assign(away,{x:1.06,z:0,vx:0,vz:0,facing:Math.PI,stun:0,balance:1,energy:1,brace:0});
 f.give(away);
 api.input('l',true);
 assert.ok(home.checkWindow>0);
 f.collideSkaters(home,away);
 assert.equal(f.phase,'injury');
 const stopped=api.getState().timeLeft;
 api.step(2);
 assert.equal(api.getState().timeLeft,stopped);
 events.keydown({key:'Enter',repeat:false,preventDefault(){}});
 assert.equal(f.phase,'playing');
 assert.equal(away.fallTime,0);
 assert.equal(f.players.find(p=>p.device==='kb1'),home);
 assert.equal(f.players.find(p=>p.device==='kb2'),away);
 api.input('l',false);
});
test('a second local human disables solo-follow camera while preserving eight players',()=>{
 const {api,elements}=match();
 assert.equal(api.getState().players.length,8);
 assert.equal(elements.get('viewBtn').disabled,true);
 assert.match(elements.get('viewBtn').getAttribute?.('aria-label')||'',/./);
});
