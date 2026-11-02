import fs from 'node:fs';
import assert from 'node:assert/strict';
import {augmentResidentMap,combineResidentLayouts,validateLives,createResidentSimulation}from'./resident-lives.mjs';
const read=f=>JSON.parse(fs.readFileSync(new URL(`content/${f}`,import.meta.url)));
const data=read('resident-lives.json'),world=read('world.json'),house=read('house.json'),tile=combineResidentLayouts([read('resident-homes.tmj'),read('resident-homes-kettle.tmj')]);
const bases=Object.fromEntries(['town','kettle','wilds'].map(k=>[k,read(k+'.json')]));
const maps=Object.fromEntries(Object.entries(bases).map(([k,m])=>[k,augmentResidentMap(m,tile,k)]));
const planner=validateLives(data,world,maps,house);
assert.equal(planner.homes.size,12);assert.equal(maps.town.plots.length,24);
for(const k of ['town','kettle']){
  assert.deepEqual(bases[k].props,maps[k].props.slice(0,bases[k].props.length));
  assert.deepEqual(augmentResidentMap(maps[k],tile,k),maps[k],'layout import is idempotent');
  assert.deepEqual(maps[k].rows.slice(0,bases[k].rows.length-1),bases[k].rows.slice(0,-1),'all existing map rows stay intact except the connecting border');
  for(const h of maps[k].residentHomes)assert.ok(planner.route({room:k,x:bases[k].arrive[0][0],y:bases[k].arrive[0][1]},{room:`home:${h.id}`,x:4,y:4}),`${h.id} home is reachable`);
}
console.log('  ok Tiled home lanes preserve all existing buildings, graves, doors and 24 player plots; all 12 interiors are reachable');
for(const mutate of [d=>d.residents[0].stages[0].at=[0,0],d=>d.residents[0].stages[0].action='grant-xp',d=>d.residents[0].stages[0].seconds=0,d=>d.residents[0].stages.find(s=>s.action==='visit').friend='orin']){const bad=structuredClone(data);mutate(bad);assert.throws(()=>validateLives(bad,world,maps,house));}
console.log('  ok invalid actions, blocked destinations, durations and cross-scope social links are rejected');
for(const privateTown of [false,true]){
  const sim=createResidentSimulation(data,world,planner,{privateTown});const visited=new Set(),carrying=new Set();
  for(let i=0;i<1500;i++){
    sim.tick(400);for(const n of sim.states){if(n.room.startsWith('home:'))visited.add(n.id);if(n.carry)carrying.add(n.id);}
    if(privateTown)assert.equal(sim.byId.get('pax').deliveries,sim.byId.get('nell').received+sim.marks.get('pax:work').value,'every delivered parcel is either waiting at the clinic or received by Nell');
  }
  assert.ok(sim.states.every(n=>n.completed>=4),'every resident completes real activities');
  assert.ok(sim.states.every(n=>visited.has(n.id)),'every resident physically enters a home');
  assert.ok([...sim.marks.values()].some(m=>m.count>0&&m.kind!=='visit'),'work leaves visible results');
  assert.ok(sim.states.some(n=>n.visits>0)||[...sim.marks.values()].some(m=>m.kind==='visit'&&m.count>0),'social encounters or physical notes actually happen');
  if(privateTown){assert.ok(carrying.has('pax'));assert.ok(sim.byId.get('pax').deliveries>0);assert.ok(sim.byId.get('nell').received>0);}
  else assert.ok(carrying.has('tess'));
  const saved=sim.serialize(),restored=createResidentSimulation(data,world,planner,{privateTown,saved});
  for(const n of sim.states){const r=restored.byId.get(n.id);for(const field of ['room','x','y','stage','elapsed','carry','completed','deliveries','received','visits'])assert.deepEqual(r[field],n[field],field);assert.deepEqual(r.memory,n.memory);}
  restored.tick(1000);assert.ok(restored.clock()>saved.clock,'restored residents resume');
  const again=createResidentSimulation(data,world,planner,{privateTown});again.tick(600000);assert.deepEqual(again.serialize(),sim.serialize(),'activity circuits replay deterministically');
}
console.log('  ok all 12 residents travel home, work and socialize; Pax physically carries deliveries and Nell receives them; state survives reload and replays exactly');
const a=createResidentSimulation(data,world,planner,{privateTown:true}),b=createResidentSimulation(data,world,planner,{privateTown:true});
a.tick(120000);assert.equal(b.byId.get('pax').deliveries,0,'private copies are isolated');
const n=a.byId.get('rowan');assert.equal(a.reserve(n.id,'one'),true);assert.equal(a.reserve(n.id,'two'),false);const before=[n.room,n.x,n.y,n.elapsed];a.tick(5000);assert.deepEqual([n.room,n.x,n.y,n.elapsed],before);a.release('one',n.id);a.tick(5000);assert.notDeepEqual([n.room,n.x,n.y,n.elapsed],before);
const stopped=createResidentSimulation(data,world,planner,{privateTown:true});stopped.tick(30000,{blocked:()=>true});assert.equal(stopped.byId.get('pax').deliveries,0,'blocked travel cannot invent a delivery');
const helped=createResidentSimulation(data,world,planner,{privateTown:true});assert.equal(helped.help('rowan'),true);assert.equal(helped.marks.get('rowan:work').artifact,undefined,'the ribbon does not teleport onto the post');helped.tick(20000);assert.equal(helped.marks.get('rowan:work').artifact,'ribbon','Rowan actually uses the returned ribbon during the trail task');
console.log('  ok private-scope isolation, bounded interaction holds, release and blocked-route honesty');
console.log('PASS resident lives');
