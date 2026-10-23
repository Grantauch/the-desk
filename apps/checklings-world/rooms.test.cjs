'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {createRaidService}=require('./rooms.cjs');
function fixture(){
 let now=1000000,enabled=true;
 const db=new Map(), roster=new Map([['a',{key:'a',classKey:'period1'}],['b',{key:'b',classKey:'period1'}],['c',{key:'c',classKey:'period2'}],['d',{key:'d',classKey:'period1'}]]);
 const store={async create(k,v){if(db.has(k))return false;db.set(k,structuredClone(v));return true;},async load(k){return structuredClone(db.get(k)||null);},async transact(k,fn){const old=structuredClone(db.get(k)||null);const r=fn(old);db.set(k,structuredClone(r.room));return r.result;}};
 const service=createRaidService({authorize:async id=>roster.get(id),isEnabled:async()=>enabled,store,now:()=>now,random:()=>Buffer.alloc(10,0x3b)});
 return {service,expire(){now+=31*60*1000;},disable(){enabled=false;}};
}
test('room is private to a class and cannot be viewed by strangers',async()=>{const f=fixture(),a=await f.service.create('a','ember');await assert.rejects(f.service.join('c',a.invite,'mochi'),/not found/);await assert.rejects(f.service.view('b',a.invite),/participant/);});
test('join creates a real distinct seat and cannot duplicate a seat',async()=>{const f=fixture(),a=await f.service.create('a','ember');const b=await f.service.join('b',a.invite,'bolt');assert.equal(b.room.seats.length,2);const c=await f.service.join('b',a.invite,'mochi');assert.equal(c.room.seats.length,2);});
test('invite is strong and not an unhashed public membership identifier',async()=>{const f=fixture(),a=await f.service.create('a','ember');assert.match(a.invite,/^CHK-[A-F0-9]{20}$/);assert.equal(JSON.stringify(a.room).includes('period1'),false);assert.equal(JSON.stringify(a.room).includes('CHK-'),false);});
test('cannot launch with one user and stale revisions are rejected',async()=>{const f=fixture(),a=await f.service.create('a','ember');const r=await f.service.ready('a',a.invite,0);assert.equal(r.room.status,'lobby');await assert.rejects(f.service.ready('a',a.invite,0),/Stale/);});
test('two students take authentic alternating turns',async()=>{const f=fixture(),a=await f.service.create('a','ember');await f.service.join('b',a.invite,'mochi');await f.service.ready('a',a.invite,1);const ready=await f.service.ready('b',a.invite,2);assert.equal(ready.room.status,'battle');await assert.rejects(f.service.move('b',a.invite,3,'strike'),/turn/);const first=await f.service.move('a',a.invite,3,'strike');assert.equal(first.room.boss.hp,218);assert.equal(first.room.activeSeat,1);});
test('expired room cannot be used and teacher can disable the feature',async()=>{const f=fixture(),a=await f.service.create('a','zee');f.expire();await assert.rejects(f.service.view('a',a.invite),/expired/);f.disable();await assert.rejects(f.service.create('b','bolt'),/not enabled/);});
