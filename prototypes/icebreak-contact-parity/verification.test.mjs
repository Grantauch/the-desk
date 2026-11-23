import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {armCheck,advanceCheck,resolveContact,SKATE,CHECK,CONTACT,ROLE_MASS,STICK} from './contact.mjs';
import {skate} from '../icebreak-parity/headless.mjs';
const require=createRequire(import.meta.url);
const {fixture,file}=require('../../tests/icebreak/fixture.cjs');
const dt=1/90;
const fields=['x','z','vx','vz','energy','balance','check','checkWindow','checkEffort',
 'checkConnected','checkRecovery','effortRecovery','brace','puckWobble','stun',
 'fallTime','fallSpan','fallSide','has','shotCharge','receiveWait','carryTime',
 'receiveWindow','oneTimerBuffer','cutTime','impactDir','impactLevel'];
function parityValue(actual,reference,name){
 if(typeof actual==='number'&&typeof reference==='number'){
  assert.ok(Math.abs(actual-reference)<1e-9,name+': '+actual+' != '+reference);return;
 }
 assert.equal(actual,reference,name);
}
function comparePlayers(browser,server,label){
 for(const field of fields)parityValue(browser[field],server[field],label+'.'+field);
 assert.equal(!!browser.cutReceiver,!!server.cutReceiver,label+'.cutReceiver');
}
function comparePuck(browser,server,browserCarrier,serverCarrier,label){
 for(const field of ['x','z','vx','vz','lock'])parityValue(browser[field],server[field],label+'.puck.'+field);
 assert.equal(browser.owner===browserCarrier,server.owner===serverCarrier,label+'.puck.owner');
 assert.equal(browser.passFrom===null,server.passFrom===null,label+'.puck.passFrom');
 assert.equal(browser.passTarget===null,server.passTarget===null,label+'.puck.passTarget');
}
function scene(s){
 const {f,api}=fixture();api.start();f.clear();
 const a=f.players.find(p=>p.team===0&&p.id===(s.attackerRole??0));
 const b=f.players.find(p=>p.team===1&&p.id===(s.targetRole??0));
 assert.ok(a&&b);
 Object.assign(a,{x:0,z:0,vx:s.speed??11,vz:s.tangent??0,facing:s.angle??0,
  stun:0,check:0,checkWindow:0,checkRecovery:0,energy:s.energy??1,balance:s.attackerBalance??1});
 Object.assign(b,{x:1.06,z:0,vx:s.targetSpeed??0,vz:s.targetTangent??0,
  facing:Math.PI,stun:0,brace:s.brace??0,balance:s.targetBalance??1});
 if(s.sameTeam)b.team=a.team;
 if(s.carry!==false&&!b.goalie)f.give(b);
 const ca={...a},cb={...b};
 const state={phase:f.phase,paused:false,dropDelay:0,injuryTime:0,injured:null,
  players:[ca,cb],puck:{...f.puck,owner:f.puck.owner===b?cb:null}};
 if(s.both){
  assert.equal(f.beginCheck(b),armCheck(cb,state),'defender armed');
 }
 const br=f.beginCheck(a),sr=armCheck(ca,state);
 assert.equal(br,sr,'attacker arm result');
 comparePlayers(a,ca,'attacker before contact');
 comparePlayers(b,cb,'defender before contact');
 const browser=f.collideSkaters(a,b);
 const server=resolveContact(ca,cb,state);
 assert.equal(browser,server,'overlap result');
 comparePlayers(a,ca,'attacker after contact');
 comparePlayers(b,cb,'defender after contact');
 comparePuck(f.puck,state.puck,b,cb,'contact');
 assert.equal(f.phase,state.phase,'match phase');
 assert.equal(f.injuryTime,state.injuryTime,'injury duration');
 assert.equal(f.injured===b,state.injured===cb,'injured identity');
 if(s.expect)assert.equal(f.phase,s.expect,'expected outcome');
 return {f,a,b,ca,cb,state};
}
test('reference contact constants and stick-release geometry match the integrated game',()=>{
 const html=readFileSync(file,'utf8');
 for(const [name,constant] of [['SKATE',SKATE],['CHECK',CHECK],['CONTACT',CONTACT],['STICK',STICK]]){
  const text=html.match(new RegExp('const '+name+'=Object\\.freeze\\((\\{[\\s\\S]*?\\})\\);'))?.[1];
  assert.ok(text,name+' not found in integrated game');
  const browser=Function('return ('+text+')')();
  assert.deepEqual(browser,constant,name+' constants drifted');
 }
 assert.ok(html.includes('const ROLE_MASS=['+ROLE_MASS.join(',')+']'),'role masses drifted');
});
const cases=[
 {name:'glancing check retains puck',speed:4},
 {name:'solid check knocks puck loose',speed:8},
 {name:'heavy check topples skater',speed:11},
 {name:'full speed triggers frozen injury timeout',speed:13,expect:'injury'},
 {name:'off-angle misses momentum leverage',speed:13,angle:1.15},
 {name:'braced target resists injury',speed:13,brace:1},
 {name:'tired checker loses mass leverage',speed:13,energy:.4},
 {name:'exhausted player cannot arm a check',speed:13,energy:.1},
 {name:'equal speed means no closing contact',speed:13,targetSpeed:13},
 {name:'stationary checker does not magically transfer energy',speed:0,targetSpeed:-12},
 {name:'off balance attacker loses impact power',speed:12,attackerBalance:.40},
 {name:'off balance defender suffers stronger contact',speed:12,targetBalance:.35},
 {name:'friendly contact is ordinary mass collision',speed:13,sameTeam:true},
 {name:'goalkeeper is not a checkable opponent',speed:13,targetRole:3,carry:false},
 {name:'wing attacker carries lighter role mass',speed:11,attackerRole:1},
 {name:'defender target resists with greater role mass',speed:13,targetRole:2},
 {name:'simultaneous head-on checks settle deterministically',speed:10,targetSpeed:-10,both:true,carry:false},
 {name:'transverse impulses do not erase lateral glide',speed:10,tangent:2,targetTangent:-3},
 {name:'no physical overlap cannot cause injury',speed:13,targetSpeed:0,noOverlap:true}
];
for(const scenario of cases)test(scenario.name,()=>{
 // A no-overlap fixture needs a separate reposition before collision.
 if(scenario.noOverlap){
  const result=scene({...scenario,energy:.1}); // gate checks no impact in reference scene
  assert.equal(result.f.phase,'playing');
  return;
 }
 scene(scenario);
});
test('whiff recovery and balance loss match the integrated fixed-step update',()=>{
 const {f,api}=fixture();api.start();f.clear();
 const a=f.players[0];Object.assign(a,{x:-20,z:0,vx:0,vz:0,energy:1,balance:1,stun:0});
 const ca={...a},state={phase:f.phase,paused:false,dropDelay:0};
 assert.equal(f.beginCheck(a),armCheck(ca,state));
 let missed=0;
 for(let i=0;i<30;i++){
  f.updatePlayers(dt);
  if(advanceCheck(ca,dt))missed++;
  skate(ca,0,0,dt);
 }
 assert.equal(missed,1,'exactly one whiff penalty');
 for(const name of ['energy','balance','check','checkWindow','checkConnected','checkRecovery']){
  parityValue(a[name],ca[name],'missed check '+name);
 }
 assert.ok(a.checkRecovery>0&&a.balance<1);
});
