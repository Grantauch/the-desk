'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {createRaidService}=require('./rooms.cjs');
function fixture(){
 let now=1000000,enabled=true;
 const db=new Map(), roster=new Map([['a',{key:'a',classKey:'period1'}],['b',{key:'b',classKey:'period1'}],['c',{key:'c',classKey:'period2'}],['d',{key:'d',classKey:'period1'}]]);
 const store={async create(k,v){if(db.has(k))return false;db.set(k,structuredClone(v));return true;},async load(k){return structuredClone(db.get(k)||null);},async transact(k,fn){const old=structuredClone(db.get(k)||null);const r=fn(old);db.set(k,structuredClone(r.room));return r.result;}};
 const service=createRaidService({authorize:async id=>roster.get(id),isEnabled:async()=>enabled,store,now:()=>now,random:()=>Buffer.alloc(10,0x3b)});
 return {service,storedRoom(){return structuredClone([...db.values()][0]||null);},expire(){now+=31*60*1000;},disable(){enabled=false;}};
}
test('room is private to a class and cannot be viewed by strangers',async()=>{const f=fixture(),a=await f.service.create('a','ember');await assert.rejects(f.service.join('c',a.invite,'mochi'),/not found/);await assert.rejects(f.service.view('b',a.invite),/participant/);});
test('join creates a real distinct seat and cannot duplicate a seat',async()=>{const f=fixture(),a=await f.service.create('a','ember');const b=await f.service.join('b',a.invite,'bolt');assert.equal(b.room.seats.length,2);const c=await f.service.join('b',a.invite,'mochi');assert.equal(c.room.seats.length,2);});
test('invite is strong and not an unhashed public membership identifier',async()=>{const f=fixture(),a=await f.service.create('a','ember');assert.match(a.invite,/^CHK-[A-F0-9]{20}$/);assert.equal(JSON.stringify(a.room).includes('period1'),false);assert.equal(JSON.stringify(a.room).includes('CHK-'),false);});
test('cannot launch with one user and stale revisions are rejected',async()=>{const f=fixture(),a=await f.service.create('a','ember');const r=await f.service.ready('a',a.invite,0);assert.equal(r.room.status,'lobby');await assert.rejects(f.service.ready('a',a.invite,0),/Stale/);});
test('two students take authentic alternating turns',async()=>{const f=fixture(),a=await f.service.create('a','ember');await f.service.join('b',a.invite,'mochi');await f.service.ready('a',a.invite,1);const ready=await f.service.ready('b',a.invite,2);assert.equal(ready.room.status,'battle');await assert.rejects(f.service.move('b',a.invite,3,'strike'),/turn/);const first=await f.service.move('a',a.invite,3,'strike');assert.equal(first.room.boss.hp,218);assert.equal(first.room.activeSeat,1);});
test('expired room cannot be used and teacher can disable the feature',async()=>{const f=fixture(),a=await f.service.create('a','zee');f.expire();await assert.rejects(f.service.view('a',a.invite),/expired/);f.disable();await assert.rejects(f.service.create('b','bolt'),/not enabled/);});


test('a fainted lead seat is skipped; a surviving teammate can finish the raid',async()=>{
 const f=fixture(),created=await f.service.create('a','ember'),code=created.invite;
 let state=(await f.service.join('b',code,'bolt')).room;
 state=(await f.service.ready('a',code,state.revision)).room;
 state=(await f.service.ready('b',code,state.revision)).room;
 for(let round=0;round<10;round++){
   state=(await f.service.move('a',code,state.revision,'strike')).room;
   state=(await f.service.move('b',code,state.revision,'guard')).room;
 }
 assert.equal(state.seats[0].hp,0);
 assert.ok(state.seats[1].hp>0);
 assert.equal(state.boss.hp,20);
 assert.equal(state.status,'battle');
 assert.equal(state.activeSeat,1);
 await assert.rejects(f.service.move('a',code,state.revision,'strike'),/Not your turn/);
 const finish=(await f.service.move('b',code,state.revision,'strike')).room;
 assert.equal(finish.boss.hp,0);
 assert.equal(finish.status,'victory');
});

test('encouragement heals living allies but does not secretly revive a fainted seat',async()=>{
 const f=fixture(),created=await f.service.create('a','ember'),code=created.invite;
 let state=(await f.service.join('b',code,'bolt')).room;
 state=(await f.service.ready('a',code,state.revision)).room;
 state=(await f.service.ready('b',code,state.revision)).room;
 for(let round=0;round<10;round++){
   state=(await f.service.move('a',code,state.revision,'strike')).room;
   state=(await f.service.move('b',code,state.revision,'guard')).room;
 }
 state=(await f.service.move('b',code,state.revision,'encourage')).room;
 assert.equal(state.seats[0].hp,0,'the KO must not be undone by a regular support move');
 assert.equal(state.seats[1].hp,68,'the living ally gained 8 before one boss attack');
 assert.equal(state.activeSeat,1);
 assert.equal(state.status,'battle');
});

test('three-seat raid skips a KO and gives the boss one turn per survivor rotation',async()=>{
 const f=fixture(),created=await f.service.create('a','ember'),code=created.invite;
 let state=(await f.service.join('b',code,'bolt')).room;
 state=(await f.service.join('d',code,'mochi')).room;
 for(const actor of ['a','b','d']) state=(await f.service.ready(actor,code,state.revision)).room;
 for(let round=0;round<10;round++){
   state=(await f.service.move('a',code,state.revision,'strike')).room;
   state=(await f.service.move('b',code,state.revision,'guard')).room;
   state=(await f.service.move('d',code,state.revision,'guard')).room;
 }
 assert.equal(state.seats[0].hp,0);
 assert.equal(state.activeSeat,1);
 const before=state.seats[1].hp;
 state=(await f.service.move('b',code,state.revision,'guard')).room;
 assert.equal(state.activeSeat,2,'third seat acts before the boss');
 assert.equal(state.seats[1].hp,before,'boss has not moved yet');
 state=(await f.service.move('d',code,state.revision,'guard')).room;
 assert.equal(state.activeSeat,1);
 assert.equal(state.seats[1].hp,before-3);
 assert.equal(state.seats[2].hp,before-3);
 assert.equal(state.seats[0].hp,0);
});

test('total party knockout produces defeat without giving dead seats extra turns',async()=>{
 const f=fixture(),created=await f.service.create('a','ember'),code=created.invite;
 let state=(await f.service.join('b',code,'bolt')).room;
 state=(await f.service.ready('a',code,state.revision)).room;
 state=(await f.service.ready('b',code,state.revision)).room;
 for(let round=0;round<34;round++){
   state=(await f.service.move('a',code,state.revision,'guard')).room;
   state=(await f.service.move('b',code,state.revision,'guard')).room;
 }
 assert.equal(state.status,'defeat');
 assert.deepEqual(state.seats.map(s=>s.hp),[0,0]);
 await assert.rejects(f.service.move('a',code,state.revision,'strike'),/Not in battle/);
});


test('long-running support-only battle retains bounded UI journal, not unbounded room state',async()=>{
 const f=fixture(),created=await f.service.create('a','ember'),code=created.invite;
 let state=(await f.service.join('b',code,'bolt')).room;
 state=(await f.service.ready('a',code,state.revision)).room;
 state=(await f.service.ready('b',code,state.revision)).room;
 for(let i=0;i<120;i++){
  state=(await f.service.move('a',code,state.revision,'encourage')).room;
  state=(await f.service.move('b',code,state.revision,'encourage')).room;
 }
 const raw=f.storedRoom();
 assert.equal(raw.status,'battle');
 assert.equal(raw.boss.hp,240,'no boss HP is removed by encouragement');
 assert.equal(raw.journal.length,32,'ephemeral stored journal is bounded');
 assert.equal(raw.revision,243,'revision advances for every committed move');
 assert.equal(state.journal.length,8,'private player view has only last eight events');
 assert.equal(raw.journal.at(-1).seat,2);
 assert.equal(raw.journal.at(-1).move,'encourage');
 assert.equal(raw.journal.at(0).seat,1);
});
