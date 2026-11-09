'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../public/hubs/dry-county'),sandbox={window:{}};
for(const src of ['flight.js','air-audio.js'])vm.runInNewContext(fs.readFileSync(path.join(root,src),'utf8'),sandbox);
const F=sandbox.window.DryFlight,A=sandbox.window.DryAirAudio,dt=1/60;
const env={width:6800,height:3300,windX:12,windY:-7,turbulence:.85};
let checks=0;
function check(title,fn){fn();console.log('  OK '+title);checks++}
const advance=(c,e,n=600)=>{for(let i=0;i<n;i++)F.step(c,{forward:.9,lift:.7,turn:.22},dt,e)};
const drawCount=(type,detail,options={})=>{
 const counts={all:0,arc:0},ctx=new Proxy({},{get:(_,key)=>()=>{counts.all++;if(key==='arc')counts.arc++}});
 F.render(ctx,F.create(type,800,620,{z:28,rotor:2}),2,{lowDetail:!detail,...options,beamTarget:{x:900,y:620}});
 return counts;
};
check('airframe footprints stay proportional to the 50-unit sedan baseline',()=>{
 const base=36;
 assert.equal(F.TYPES.rotorcraft.span,72);
 assert.equal(F.TYPES.biplane.span,80);
 assert.equal(F.TYPES.balloon.span,76);
 for(const c of Object.values(F.TYPES))assert(c.span/base>1.9&&c.span/base<2.4);
});
check('low detail halves primitive calls for every aircraft type',()=>{
 for(const type of Object.keys(F.TYPES)){
  const full=drawCount(type,true).all,low=drawCount(type,false).all;
  assert(low<full*.5,type+': full '+full+' low '+low);
 }
});
check('reduced motion keeps flight silhouettes but skips animated rotor downwash',()=>{
 const regular=drawCount('rotorcraft',true,{reducedMotion:false});
 const reduced=drawCount('rotorcraft',true,{reducedMotion:true});
 assert(reduced.all<regular.all);
 assert(drawCount('rotorcraft',false,{reducedMotion:true}).all>0);
});
check('maximum rain and searchlight strength render without throwing',()=>{
 for(const type of Object.keys(F.TYPES))drawCount(type,true,{rain:1,beamStrength:1});
});
check('deterministic gusts have a finite speed-bound solution',()=>{
 const a=F.create('biplane',1700,900,{z:82}),b=F.create('biplane',1700,900,{z:82});
 advance(a,env,1200);advance(b,env,1200);
 assert.equal(a.x,b.x);assert.equal(a.y,b.y);assert.equal(a.z,b.z);
 assert(Number.isFinite(a.x)&&Number.isFinite(a.y));assert(a.x>=54&&a.x<=6746);
});
check('turbulence changes motion without exceeding cruise limits',()=>{
 const a=F.create('rotorcraft',1700,900,{z:85}),b=F.create('rotorcraft',1700,900,{z:85});
 advance(a,env);advance(b,{...env,turbulence:0});
 assert(Math.hypot(a.x-b.x,a.y-b.y)>.01);
 assert(Math.hypot(a.vx,a.vy)<=F.TYPES.rotorcraft.cruise+1e-6);
});
function mockAudio(){
 const events={created:0,started:0,stopped:0,disconnected:0};
 const params=()=>({value:0,latest:0,setTargetAtTime(v){this.latest=v}});
 const node=()=>({frequency:params(),gain:params(),type:'',
  connect(){return this},disconnect(){events.disconnected++},start(){events.started++},stop(){events.stopped++}});
 const ac={currentTime:20,createOscillator(){events.created++;return node()},createBiquadFilter:node,createGain:node};
 return {ac,events,bus:node()};
}
check('flight audio no-ops safely when AudioContext is unavailable',()=>{
 const player=A.create(null,null);assert.equal(player.stats().voices,0);
 player.update({enabled:true});player.dispose();
});
check('audio creates two reusable voices, not thousands of per-frame oscillators',()=>{
 const m=mockAudio(),sounds=A.create(m.ac,m.bus),craft=F.create('rotorcraft',300,400,{z:80,throttle:.8});
 assert.equal(sounds.stats().voices,2);assert.equal(m.events.created,4);assert.equal(m.events.started,4);
 for(let i=0;i<2000;i++)sounds.update({pilot:craft,listener:{x:300,y:400},enabled:true});
 assert.equal(m.events.created,4);assert(sounds.stats().levels.own>0);
 sounds.update({pilot:craft,listener:craft,enabled:false});
 assert.equal(sounds.stats().levels.own,0);
 sounds.dispose();assert.equal(m.events.stopped,4);
});
check('law rotor attenuates at distance',()=>{
 const m=mockAudio(),sounds=A.create(m.ac,m.bus),law=F.create('rotorcraft',0,0,{z:100,throttle:1,vx:140});
 const near=sounds.update({police:law,listener:{x:100,y:0,vx:0},enabled:true}).law;
 const far=sounds.update({police:law,listener:{x:3000,y:0,vx:0},enabled:true}).law;
 assert(near>far&&far===0);sounds.dispose();
});
console.log('Dry County Flight B4 visuals, weather and audio: '+checks+' checks passed.');
