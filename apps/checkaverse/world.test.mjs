import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createWorld, validateWorld, trainerFrame } from './public/world.js';
const read = k => JSON.parse(fs.readFileSync(new URL(`content/${k}.json`, import.meta.url)));
const data = read('world'), maps = Object.fromEntries(['kettle','town','wilds'].map(k => [k,read(k)]));
validateWorld(data,maps);
const reachable = map => {
  const queue = [map.arrive?.[0] || [map.exits[0].x, map.exits[0].y]], seen = new Set(queue.map(p => p.join(',')));
  for (let i = 0; i < queue.length; i++) for (const [ax,ay] of [[0,1],[1,0],[0,-1],[-1,0]]) {
    const [x,y] = queue[i], key = `${x+ax},${y+ay}`, tile = map.rows[y+ay]?.[x+ax];
    if (tile && !'TWHSL'.includes(tile) && !seen.has(key)) {seen.add(key);queue.push([x+ax,y+ay]);}
  }
  return seen;
};
for (const map of Object.keys(maps)) {
  const seen = reachable(maps[map]);
  for (const n of data.residents.filter(n => n.map === map)) {
    assert.ok(n.route.every(p => seen.has(p.join(','))), `${n.name}'s complete routine is reachable`);
    if (n.errand) assert.ok(seen.has(n.errand.target.join(',')), `${n.name}'s story is reachable`);
  }
}
console.log('  ok all 12 residents, complete routes, dialogue links and three encounters load and are reachable');
for (const change of [d=>d.residents.push(d.residents[0]),d=>d.residents[0].route[0]=[0,0],d=>d.residents[0].route[0]=[30,20],d=>d.residents[0].dialogue.start.choices[0].next='missing',d=>d.residents[0].errand.target=[0,0]]) {
  const broken = structuredClone(data);change(broken);assert.throws(()=>validateWorld(broken,maps));
}
console.log('  ok duplicate residents, blocked routes, teleports, broken dialogue and unsafe story targets are refused');
for (const f of ['l','r','u','d']) for (let stride = 0; stride < 2; stride += .125) {
  const cell = trainerFrame(f,stride,true);
  assert.ok(cell.col >= 0 && cell.col <= 2);
  if (f === 'l' || f === 'r') {
    assert.equal(cell.row,2);
    assert.equal(cell.flip !== (cell.col === 2),f === 'r','each side-facing frame preserves the intended direction');
  } else {assert.equal(cell.row,f === 'u' ? 1 : 0);assert.equal(cell.flip,false);}
}
console.log('  ok every animation phase keeps its direction, with a corrected third side frame for all four outfits');
const world = createWorld(data); world.reset('kettle');
const n = world.find('rowan'); const p = {dx:35,dy:20,seg:null};
for (let i = 0; i < 50; i++) world.tick(100,maps.kettle,p,false,()=>false,false);
assert.ok(n.index > 0,'residents follow routines');
const before = JSON.stringify(world.active()); const clock = world.clock();
for (let i=0;i<50;i++)world.tick(100,maps.kettle,p,false,()=>false,true);
assert.equal(JSON.stringify(world.active()),before);assert.equal(world.clock(),clock);
world.tick(16,maps.kettle,p,true,()=>false,false);const quiet = JSON.stringify(world.active());
for(let i=0;i<50;i++)world.tick(100,maps.kettle,p,true,()=>false,false);
assert.equal(JSON.stringify(world.active()),quiet);
console.log('  ok teacher pause, hidden tabs, battles and conversations stop the world clock; quiet scenery stops resident movement');
world.start('rowan');assert.equal(world.status('rowan'),'looking');assert.equal(world.finish('rowan'),false);
const [x,y] = n.errand.target;
world.tick(16,maps.kettle,{dx:x,dy:y,seg:true},true,()=>false,false);
assert.equal(world.status('rowan'),'found');assert.equal(world.discoveries.length,1);
assert.equal(world.finish('rowan'),true);assert.equal(world.finish('rowan'),false);
world.start('rowan');assert.equal(world.status('rowan'),'done');
world.reset('town');assert.equal(world.journal()[0].status,'done');assert.equal(world.find('rowan'),undefined);
assert.equal(createWorld(data).journal().length,0,'new visits do not inherit someone else\'s journal');
console.log('  ok story discovery, return, one-time completion, room travel and fresh-visit isolation');
console.log('PASS living world');
