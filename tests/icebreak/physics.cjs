const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
const dt=1/90,speed=p=>Math.hypot(p.vx,p.vz),angle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const tick=(n,fn)=>{for(let i=0;i<Math.round(n/dt);i++)fn(dt)};
test('acceleration, coast, brake, reverse and carving have measured bounds',()=>{
 const {f}=fixture(),p=f.makePlayer(0,0,0,0);
 tick(.25,d=>f.skate(p,1,0,d));assert.ok(speed(p)>7&&speed(p)<9);
 tick(.75,d=>f.skate(p,1,0,d));assert.ok(speed(p)>10&&speed(p)<=f.SKATE.topSpeed);
 const top=speed(p);tick(.5,d=>f.skate(p,0,0,d));assert.ok(speed(p)>top*.74&&speed(p)<top*.78);
 let stopTime=0;while(p.vx>0&&stopTime<1){f.skate(p,-1,0,dt);stopTime+=dt}assert.ok(stopTime<.3);
 tick(.6,d=>f.skate(p,-1,0,d));assert.ok(p.vx<-8);
 const q=f.makePlayer(0,0,0,0);q.vx=10;f.skate(q,0,1,dt);
 assert.ok(q.facing>0&&q.facing<.05);assert.ok(q.vx>9,'momentum survives first turn tick');
 tick(.5,d=>f.skate(q,0,1,d));assert.ok(q.vz>6&&Math.abs(q.vx)<3);
 console.log(JSON.stringify({speedAt1s:top,coastSpeedAtHalfSecond:top*Math.exp(-.55*.5),brakeSeconds:stopTime,carveAtHalfSecond:{vx:q.vx,vz:q.vz,facing:q.facing}}));
});
test('burst release is gradual, diagonal and analog inputs are bounded',()=>{
 const {f}=fixture(),p=f.makePlayer(0,0,0,0);p.vx=13;f.skate(p,1,0,dt);assert.ok(p.vx>12&&p.vx<13);
 const a=f.makePlayer(0,0,0,0),b=f.makePlayer(0,0,0,0);b.facing=Math.PI/4;
 tick(1,d=>{f.skate(a,1,0,d);f.skate(b,1,1,d)});assert.ok(Math.abs(speed(a)-speed(b))<1e-8);
 const slow=f.makePlayer(0,0,0,0);tick(1,d=>f.skate(slow,.25,0,d));assert.ok(speed(slow)>2&&speed(slow)<2.56);
});
test('humans and AI share coasting, boost and goalie role profiles',()=>{
 const {f}=fixture(),a=f.makePlayer(0,0,0,0),b=f.makePlayer(0,0,0,0);a.device='kb1';b.device='ai';a.vx=b.vx=9;
 tick(.6,d=>{f.skate(a,0,0,d);f.skate(b,0,0,d)});assert.equal(a.vx,b.vx);
 a.power=b.power='boost';a.powerTime=b.powerTime=9;tick(.6,d=>{f.skate(a,1,0,d);f.skate(b,1,0,d)});assert.equal(a.vx,b.vx);assert.ok(a.vx>12);
 const g=f.makePlayer(0,3,0,0,true);tick(1,d=>f.skate(g,1,0,d,true));assert.ok(speed(g)<=5);
});
test('AI arrival settles and goalie tracks without oscillation',()=>{
 const {f}=fixture(),p=f.makePlayer(0,0,-10,0);tick(8,d=>{f.steer(p,-p.x,-p.z,d);p.x+=p.vx*d;p.z+=p.vz*d});
 assert.ok(Math.hypot(p.x,p.z)<.3,`arrival distance ${Math.hypot(p.x,p.z)}`);assert.ok(speed(p)<.3);
 const g=f.makePlayer(0,3,-25.3,0,true);f.puck.z=2;tick(5,d=>{f.ai(g,d);g.x+=g.vx*d;g.z+=g.vz*d;f.limitPlayer(g)});assert.ok(Math.abs(g.z-1.48)<.3);assert.ok(speed(g)<.3);
});
test('north/south and east/west controls, opposing keys and gamepad deadzone',()=>{
 const {f,api,pads}=fixture();api.start();f.clear();const p=f.players[0];p.stun=0;
 for(const [key,x,z] of [['w',1,0],['s',-1,0],['a',0,-1],['d',0,1]]){
  p.x=p.z=p.vx=p.vz=0;p.facing=Math.atan2(z,x);api.input(key,true);tick(.25,d=>f.updatePlayers(d));api.input(key,false);assert.ok(p.x*x+p.z*z>.5,key);
 }
 p.vx=p.vz=0;api.input('w',true);api.input('s',true);tick(.1,d=>f.updatePlayers(d));assert.equal(speed(p),0);api.input('w',false);api.input('s',false);
 api.setSeat(0,0,'pad0');api.reset();pads[0]={axes:[.1,.1],buttons:[]};f.pollGamepads();assert.equal(f.inputFor('pad0').axisX,0);
 pads[0].axes=[1,-1];f.pollGamepads();assert.ok(Math.abs(Math.hypot(f.inputFor('pad0').axisX,f.inputFor('pad0').axisY)-1)<1e-9);
 pads[0]=null;f.pollGamepads();assert.equal(f.inputFor('pad0').axisX,0);
});
test('stick attachment is continuous on turns, release starts at blade, shooter cannot recatch',()=>{
 const {f,api}=fixture();api.start();f.clear();const p=f.players[0];p.stun=0;p.x=p.z=0;f.give(p);let last={...f.puck};
 tick(.6,d=>{f.skate(p,0,1,d);p.x+=p.vx*d;p.z+=p.vz*d;f.puckPhysics(d);const blade=f.stickPoint(p);assert.equal(f.puck.x,blade.x);assert.equal(f.puck.z,blade.z);assert.ok(Math.hypot(f.puck.x-last.x,f.puck.z-last.z)<.2);last={...f.puck}});
 const blade=f.stickPoint(p);f.releasePuck(p,1,0,25);assert.ok(Math.abs(f.puck.x-blade.x-.1)<1e-9);assert.equal(f.puck.z,blade.z);assert.equal(p.has,false);assert.equal(f.puck.owner,null);
 f.puck.x=p.x;f.puck.z=p.z;f.puck.vx=f.puck.vz=0;tick(.1,d=>{f.updatePlayers(d);f.puckPhysics(d)});assert.equal(f.puck.owner,null);
});
test('pass can be received nearby after short release lock and shots release on key up',()=>{
 const {f,api}=fixture();api.start();f.clear();f.config.autoFollow=false; // Isolate shot-charge physics while the passer stays user-controlled.
 const p=f.players[0],mate=f.players[1];p.x=0;p.z=0;p.stun=0;mate.x=3;mate.z=.38;mate.stun=0;p.facing=0;f.give(p);f.pass(p);
 tick(.1,d=>f.puckPhysics(d));assert.equal(f.puck.owner,mate);
 f.give(p);api.input('k',true);tick(.4,d=>f.updatePlayers(d));assert.ok(p.shotCharge>.3);api.input('k',false);assert.equal(f.puck.owner,null);assert.ok(speed(f.puck)>25);
});
test('contacts separate bodies, retain momentum and never add collision energy',()=>{
 const {f,api}=fixture();api.start();f.clear();const [a,b]=f.players;a.x=0;a.z=0;b.x=.5;b.z=0;a.vx=8;b.vx=-8;
 const energy=a.vx*a.vx+b.vx*b.vx;f.updatePlayers(dt);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>=1.079);assert.ok(speed(a)**2+speed(b)**2<energy);
 a.x=30;a.z=11;a.vx=10;a.vz=2;f.limitPlayer(a);assert.ok(a.x<=26.7&&a.z<=11.7);assert.ok(a.vx<=1.5);
});
test('School, Park and Mars produce identical seeded trajectories; both modes retain eight seats',()=>{
 const runs=[];for(const rink of ['school','park','mars']){
  const {f,api}=fixture();api.setRink(rink);api.setMode('regular');api.start();api.input('w',true);api.step(4);runs.push(f.players.map(p=>[p.x,p.z,p.vx,p.vz,p.facing]));assert.equal(api.getState().powerItems.length,0);
 }assert.equal(JSON.stringify(runs[0]),JSON.stringify(runs[1]));assert.equal(JSON.stringify(runs[1]),JSON.stringify(runs[2]));
 for(const mode of ['regular','powerups']){const {f,api}=fixture();api.setMode(mode);api.start();assert.equal(f.players.length,8);for(const team of [0,1])assert.equal(new Set(f.players.filter(p=>p.team===team).map(p=>p.id)).size,4);f.clear();api.step(8);assert.equal(api.getState().powerItems.length>0,mode==='powerups')}
});
test('top/bottom goal credit, goalie saves, pause/blur, and seat uniqueness',()=>{
 for(const [side,team] of [[1,0],[-1,1]]){const {f,api}=fixture();api.start();f.clear();api.setPuck(side*26.2,0,side*35,0);api.step(.03);assert.equal(f.score[team],1);api.step(.2);assert.equal(f.score[team],1)}
 const {f,api,events}=fixture();api.start();f.clear();const g=f.players.find(p=>p.goalie);f.puck.x=g.x+.8;f.puck.z=0;f.puck.vx=-20;f.puckPhysics(dt);assert.ok(f.puck.vx>0);
 events.blur();assert.equal(api.getState().paused,true);const time=api.getState().timeLeft;api.step(.5);assert.equal(api.getState().timeLeft,time);
 api.setSeat(1,3,'kb1');api.reset();assert.equal(f.players.filter(p=>p.device==='kb1').length,1);assert.equal(f.players.find(p=>p.device==='kb1').goalie,true);
});
