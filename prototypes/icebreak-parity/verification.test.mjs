import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {
 SKATE,CHECK,CONTACT,ROLE_MASS,GOALX,GOALZ,
 skate,steer,limitPlayer,integrateSkater,resolvePassiveContact,
 segmentCircleTime,goalCrossing
} from './headless.mjs';

const require=createRequire(import.meta.url);
const {fixture}=require('../../tests/icebreak/fixture.cjs');
const integrated=fixture().f;
const fields=['x','z','vx','vz','facing','energy','balance','skid','brace',
 'stun','checkRecovery','fallTime'];
const here=path.dirname(fileURLToPath(import.meta.url));
const reference=fs.readFileSync(path.resolve(here,'../../public/hubs/icebreak.html'),'utf8');
const moduleSource=fs.readFileSync(path.resolve(here,'headless.mjs'),'utf8');

const clone=value=>JSON.parse(JSON.stringify(value));
const near=(a,b,label='value',tol=1e-9)=>{
 assert.ok(Number.isFinite(a)&&Number.isFinite(b),'nonfinite '+label+': '+a+'/'+b);
 assert.ok(Math.abs(a-b)<=tol,label+' '+a+' != '+b);
};
function equalPlayer(a,b,label){
 for(const key of fields){
  if(typeof a[key]==='number'&&typeof b[key]==='number')near(a[key],b[key],label+'.'+key);
  else assert.equal(a[key],b[key],label+'.'+key);
 }
}
function player(team,id,x,z){
 const p=integrated.makePlayer(team,id,x,z,id===3);
 Object.assign(p,{balance:1,fallTime:0,checkRecovery:0,energy:1,
  power:null,powerTime:0,skid:0,brace:0});
 return p;
}
function extractFn(source,name){
 const i=source.indexOf('function '+name+'(');
 assert.ok(i>=0,'reference does not contain '+name);
 const begin=source.indexOf('{',i);
 let depth=0;
 for(let cursor=begin;cursor<source.length;cursor++){
  if(source[cursor]==='{')depth++;
  else if(source[cursor]==='}'&&--depth===0)return source.slice(i,cursor+1);
 }
 throw Error('Unbalanced '+name);
}
test('reference module contains verbatim skating and puck event functions from integrated ICEBREAK',()=>{
 for(const name of ['skate','steer','limitPlayer','goalCrossing','segmentCircleTime'])
  assert.equal(extractFn(moduleSource,name),extractFn(reference,name),
   name+' must remain identical to integrated ICEBREAK');
 for(const expression of ['SKATE','CHECK','CONTACT']){
  const regex=new RegExp('const '+expression+'=Object\\.freeze\\(\\{[\\s\\S]*?\\}\\);');
  assert.equal(moduleSource.match(regex)?.[0],reference.match(regex)?.[0]);
 }
 assert.match(reference,/GOALX=26\.35, GOALZ=2\.9/);
 assert.equal(GOALX,26.35);assert.equal(GOALZ,2.9);
});
test('all eight on-ice roles retain the same mass, rink limits and top speeds',()=>{
 assert.deepEqual([...ROLE_MASS],[1,.90,1.16,1.35]);
 assert.equal(SKATE.topSpeed,integrated.SKATE.topSpeed);
 assert.equal(SKATE.goalieSpeed,integrated.SKATE.goalieSpeed);
 assert.equal(CHECK.injury,integrated.CHECK.injury);
 assert.equal(CONTACT.restitution,integrated.CONTACT.restitution);
 for(let team=0;team<2;team++)for(let role=0;role<4;role++){
  const orig=player(team,role,team===0?-9:9,role===1?6:role===2?-6:0);
  const local=clone(orig);
  orig.x=local.x=team===0?-31:31;orig.z=local.z=14;
  orig.vx=local.vx=team===0?-8:8;orig.vz=local.vz=5;
  integrated.limitPlayer(orig);limitPlayer(local);
  equalPlayer(orig,local,'team '+team+' role '+role+' bounds');
 }
});
test('skating traces agree at 90 Hz for eight simultaneous roles through burst, coast, carve, brake and boost',()=>{
 const scenarios=[
  [1,0,false],[1,0,true],[0,0,false],[0.8,0.6,false],
  [-1,0,false],[-.4,-.9,true],[0,0,false],[0.3,0.25,false]
 ];
 for(let team=0;team<2;team++)for(let role=0;role<4;role++){
  const start=player(team,role,team===0?-10:10,role===1?5:role===2?-5:0),a=start,b=clone(start);
  if(role===1){a.power=b.power='boost';a.powerTime=b.powerTime=8}
  if(role===2){a.checkRecovery=b.checkRecovery=.4}
  for(let tick=0;tick<720;tick++){
   const phase=scenarios[Math.floor(tick/90)%scenarios.length],dt=1/90;
   const x=phase[0],z=phase[1],burst=phase[2]&&role!==3;
   // Both simulations receive the same stamina and status updates.
   a.energy=b.energy=Math.max(.24,1-tick/2500);
   a.checkRecovery=b.checkRecovery=role===2&&tick<30?.4-tick*dt:0;
   integrated.skate(a,x,z,dt,burst);skate(b,x,z,dt,burst);
   a.x+=a.vx*dt;a.z+=a.vz*dt;b.x+=b.vx*dt;b.z+=b.vz*dt;
   integrated.limitPlayer(a);limitPlayer(b);
   equalPlayer(a,b,'role '+role+' tick '+tick);
  }
 }
});
test('goalie and skater AI arrival steering produces the same curved and braking paths',()=>{
 const targets=[[10,4],[0,0],[-3,-4],[2,8],[-10,-2],[0,0]];
 for(let goalie of [false,true]){
  const a=player(goalie?1:0,goalie?3:2,goalie?25.3:-18,goalie?0:6),b=clone(a);
  for(let tick=0;tick<600;tick++){
   const target=targets[Math.floor(tick/100)],dt=1/90;
   const dx=target[0]-a.x,dz=target[1]-a.z;
   integrated.steer(a,dx,dz,dt);steer(b,dx,dz,dt);
   a.x+=a.vx*dt;a.z+=a.vz*dt;b.x+=b.vx*dt;b.z+=b.vz*dt;
   integrated.limitPlayer(a);limitPlayer(b);
   equalPlayer(a,b,'steering goalie '+goalie+' tick '+tick);
  }
 }
});
test('integrateSkater preserves browser skating -> position -> boundary order',()=>{
 for(const [team,id,dx,dz,burst] of [
  [0,0,1,0,false],[0,1,1,1,true],[0,3,0,1,false],
  [1,2,-1,0,false],[1,3,-1,0,false]
 ]){
  const a=player(team,id,team===0?-15:15,3),b=clone(a);
  for(let n=0;n<90;n++){
   integrated.skate(a,dx,dz,1/90,burst);
   a.x+=a.vx/90;a.z+=a.vz/90;integrated.limitPlayer(a);
   integrateSkater(b,dx,dz,1/90,burst);
   equalPlayer(a,b,'integrated skater');
  }
 }
});
test('non-checking mass-weighted collisions match the original browser impulses and separation',()=>{
 const setups=[
  [0,0,1,0, 0.0,0, 8,0, -4,0],
  [0,2,1,1, 0.0,.2, 9,1, -8,0],
  [0,3,1,0,-.3,0, 3,0, -8,0],
  [1,1,0,2, 0.2,.9, -4,-2, 6,2],
  [0,3,1,3,-.2,0, 3,0, -3,0]
 ];
 for(const [ta,ra,tb,rb,x,z,avx,avz,bvx,bvz] of setups){
  const a=player(ta,ra,x,z),b=player(tb,rb,x+.9,z+.1);
  Object.assign(a,{vx:avx,vz:avz,checkWindow:0});
  Object.assign(b,{vx:bvx,vz:bvz,checkWindow:0});
  const c=clone(a),d=clone(b);
  const original=integrated.collideSkaters(a,b);
  const derived=resolvePassiveContact(c,d);
  assert.equal(derived,original);
  equalPlayer(a,c,'mass contact first');
  equalPlayer(b,d,'mass contact second');
 }
});
test('swept puck collision matches original even at very high shot speed',()=>{
 const scenarios=[
  [-5,0,5,0,0,0,1.05],
  [-20,2,20,2,0,2,1.05],
  [-20,2,20,2,0,0,1.05],
  [0,0,0,0,0,0,.9],
  [0,0,1,0,0,0,.9],
  [0,0,-1,0,0,0,.9],
  [5,5,5,-5,5,0,1.2],
  [-40,0,40,0,-25.4,0,1.05],
  [40,0,-40,0,25.4,0,1.05],
  [0,12,0,-12,0,0,.9]
 ];
 for(const [x0,z0,x1,z1,cx,cz,r] of scenarios){
  const actual=integrated.segmentCircleTime(x0,z0,x1,z1,cx,cz,r);
  const headless=segmentCircleTime(x0,z0,x1,z1,cx,cz,r);
  if(actual===null)assert.equal(headless,null);
  else near(actual,headless,'swept collision',1e-12);
 }
});
test('goal-line crossing is continuous, team-correct and rejects outside-the-post shots',()=>{
 const scenarios=[
  [26,0,27,0],[27,0,26,0],[-26,0,-27,0],[-27,0,-26,0],
  [26,3.5,28,3.5],[-26,-3.5,-28,-3.5],
  [-40,0,40,0],[40,0,-40,0],[26,2.7,27,2.7],
  [26,2.68,27,2.68]
 ];
 for(const positions of scenarios){
  const a=integrated.goalCrossing(...positions),b=goalCrossing(...positions);
  assert.deepEqual(clone(b),clone(a));
 }
 assert.equal(goalCrossing(26,4,28,4),null);
 assert.deepEqual(goalCrossing(26,0,27,0)?.team,0);
 assert.deepEqual(goalCrossing(-26,0,-27,0)?.team,1);
});
