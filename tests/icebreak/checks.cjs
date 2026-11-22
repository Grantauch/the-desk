const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
const dt=1/90;
function match(rink='school'){
 const result=fixture(),{f,api}=result;
 api.setRink(rink);api.setSeat(1,0,'kb2');api.start();f.clear();
 const a=f.players.find(p=>p.device==='kb1'),b=f.players.find(p=>p.device==='kb2');
 Object.assign(a,{x:0,z:0,facing:0,stun:0});
 Object.assign(b,{x:1.06,z:0,facing:Math.PI,stun:0});
 f.give(b);
 return {...result,a,b};
}
function contact({f,api,a,b},speed,options={}){
 Object.assign(a,{vx:speed,energy:options.energy??1,facing:options.angle??0});
 Object.assign(b,{vx:options.targetSpeed??0,brace:options.brace??0});
 api.input('l',true);api.input('l',false);
 f.collideSkaters(a,b);
 return {phase:f.phase,loose:!f.puck.owner,stun:b.stun,wobble:b.puckWobble,energy:a.energy};
}
test('light contact wobbles the puck, solid contact dislodges it, heavy contact staggers',()=>{
 let m=match(),r=contact(m,4);
 assert.equal(r.loose,false);assert.notEqual(r.wobble,0);assert.equal(r.stun,0);
 m=match();r=contact(m,8);assert.equal(r.loose,true);assert.equal(r.stun,0);
 m=match();r=contact(m,11);assert.equal(r.loose,true);assert.ok(r.stun>.25);assert.equal(r.phase,'playing');
 m=match();r=contact(m,13);assert.equal(r.phase,'injury');assert.equal(m.f.injured,m.b);
});
test('angle, closing speed, bracing and exhaustion change the result of the same approach',()=>{
 assert.equal(contact(match(),13,{targetSpeed:10}).loose,false);
 assert.equal(contact(match(),13,{angle:1.15}).loose,false);
 assert.equal(contact(match(),13,{brace:1}).phase,'playing');
 assert.equal(contact(match(),13,{energy:.4}).phase,'playing');
 assert.equal(contact(match(),13,{energy:.1}).loose,false);
 assert.equal(contact(match(),1,{targetSpeed:-12}).phase,'playing','standing in the way cannot create a full check');
});
test('whiffs use energy, a held button cannot spend again, and repeated attempts exhaust',()=>{
 const {f,api,a,b}=match();
 a.x=-20;b.x=20;a.vx=10;
 api.input('l',true);const initial=a.energy;
 assert.ok(initial<.7);assert.equal(a.vx,10,'arming does not create a dash');
 assert.equal(b.stun,0);
 api.step(.9);api.input('l',true);assert.ok(a.energy>=initial);
 api.input('l',false);
 for(let i=0;i<6&&a.energy>=f.CHECK.minEnergy;i++){
  a.x=-20;a.vx=10;
  api.input('l',true);api.input('l',false);api.step(.78);
 }
 assert.ok(a.energy<f.CHECK.minEnergy);assert.equal(f.beginCheck(a),false);
 const exhausted=f.makePlayer(0,0,0,0),fresh=f.makePlayer(0,0,0,0);
 exhausted.energy=a.energy;
 for(let i=0;i<90;i++){f.skate(exhausted,1,0,dt);f.skate(fresh,1,0,dt)}
 assert.ok(exhausted.vx<fresh.vx*.8);
 api.step(5);assert.ok(a.energy>.7);assert.equal(f.beginCheck(a),true);
});
test('checks obey mass, preserve normal momentum and shed collision energy',()=>{
 const m=match(),{f,a,b}=m;b.id=2;a.vz=3;b.vz=-2;
 contact(m,10);
 assert.ok(Math.abs(a.vx*f.ROLE_MASS[a.id]+b.vx*f.ROLE_MASS[b.id]-10)<1e-9);
 assert.equal(a.vz,3);assert.equal(b.vz,-2);
 assert.ok(a.vx**2+b.vx**2*f.ROLE_MASS[b.id]<100);
 assert.ok(b.vx<10*.56,'heavier skater moves less');
});
test('mass contact alone or a whiff cannot take possession or injure',()=>{
 const {f,a,b}=match();a.vx=13;f.collideSkaters(a,b);
 assert.equal(f.puck.owner,b);assert.equal(f.phase,'playing');
 a.x=-1;b.x=0;a.team=b.team;assert.equal(a.checkWindow,0);
 assert.equal(f.beginCheck(a),true);a.vx=13;f.collideSkaters(a,b);assert.equal(f.puck.owner,b);
});
test('heavy hits topple a skater, transfer momentum into a sliding fall, then permit recovery',()=>{
 const m=match(),{f,api,a,b}=m;
 const originalEnergy=b.energy;
 const impact=contact(m,11);
 assert.equal(impact.phase,'playing');assert.ok(b.fallTime>.5);
 assert.equal(b.fallSpan,b.fallTime);assert.ok(b.energy<originalEnergy);
 assert.ok(Math.hypot(b.vx,b.vz)>0,'collision delivers a physical slide rather than teleporting the player');
 const upright=f.makePlayer(1,0,0,0);
 upright.vx=b.vx;upright.vz=b.vz;
 f.skate(b,0,0,dt);f.skate(upright,0,0,dt);
 assert.ok(Math.hypot(b.vx,b.vz)<Math.hypot(upright.vx,upright.vz),'pads have greater ice drag than skates');
 api.step(.9);
 assert.equal(b.fallTime,0);assert.equal(b.stun,0);
 assert.equal(f.phase,'playing');
 f.resetFaceoff();
 assert.equal(b.fallSpan,0,'faceoffs clear knockdown animations');
});
test('injury freezes match physics for five seconds or skips through keyboard, mouse and gamepad',()=>{
 for(const method of ['automatic','keyboard','button','gamepad']){
  const m=match(),{f,api,a,b,events,elements,pads}=m;
  if(method==='gamepad'){a.device='pad0';pads[0]={axes:[0,0],buttons:[{pressed:false}]};f.beginCheck(a)}
  const before=api.getState();
  if(method==='gamepad'){a.vx=13;a.checkWindow=.2;a.checkEffort=1;f.collideSkaters(a,b)}else contact(m,13);
  const spent=a.energy,x=a.x,loose={...f.puck};
  assert.equal(f.injuryTime,5);assert.equal(f.phase,'injury');assert.equal(f.puck.owner,null);
  api.step(method==='automatic'?4.99:1);
  assert.equal(f.phase,'injury');assert.equal(a.x,x);assert.equal(f.puck.x,loose.x);
  assert.equal(api.getState().timeLeft,before.timeLeft);
  if(method==='automatic')api.step(dt);
  if(method==='keyboard')events.keydown({key:'Enter',preventDefault(){}});
  if(method==='button')elements.get('playBtn').events.click();
  if(method==='gamepad'){pads[0].buttons[0].pressed=true;api.step(dt)}
  assert.equal(f.phase,'playing');assert.equal(f.injured,null);assert.equal(f.puck.x,0);
  assert.equal(f.players.length,8);assert.equal(a.energy,spent);assert.equal(b.device,'kb2');
  assert.equal(api.getState().timeLeft,before.timeLeft);assert.equal(b.stun,0);
 }
});
test('ordinary input reaches the hardest check in Regular, identically across rinks',()=>{
 const results=[];
 for(const rink of ['school','park','mars']){
  const {f,api,a,b}=match(rink);
  a.x=-7;b.x=0;api.input('w',true);api.input('shift',true);
  for(let i=0;i<150&&b.x-a.x>2.2;i++)api.step(dt);
  assert.ok(a.vx>12);api.input('l',true);api.input('l',false);
  api.step(.18);
  assert.equal(f.phase,'injury',rink);assert.equal(f.injured,b);
  results.push([a.x,b.x,a.energy,b.stun]);
 }
 assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);
});
