import {test} from 'node:test';
import A from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const html=readFileSync(new URL('../../public/hubs/icebreak.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">\n([\s\S]*?)<\/script>/)?.[1];
A.ok(script);
const boundary=script.indexOf('const endpoint=');
A.ok(boundary>0);
const createSession=new Function(script.slice(0,boundary)+'\nreturn createSession;')();
const original=html.match(/<script>\n([\s\S]*?)<\/script>/)?.[1];
const localHash=createHash('sha256').update(original).digest('hex');
test('draft is hidden and endpoint-disabled, original gameplay script is unchanged',()=>{
 A.match(html,/<button id="online-open" type="button" hidden>/);
 A.match(script,/const endpoint=\/\*@@ICEBREAK_ENDPOINT@@\*\/ null;/);
 A.equal(localHash,'499fd865add2e6cce2a26e35a53565bbff1ccf92182414974bf7afaa1c0df4d0');
});
const code='A2B3C4', token='k'.repeat(32);
class Socket{
 readyState=1;bufferedAmount=0;out=[];handlers={};
 addEventListener(t,f){this.handlers[t]=f}
 send(s){this.out.push(JSON.parse(s))}
 close(){this.readyState=3;this.handlers.close?.()}
 incoming(msg){this.handlers.message({data:JSON.stringify(msg)})}
}
function setup(){
 const sockets=[],events=[],timers=new Map();let id=0;
 const api=createSession({openSocket:()=>{const s=new Socket();sockets.push(s);return s},onEvent:x=>events.push(x),
 setTimer:(fn,ms)=>{timers.set(++id,{fn,ms});return id},clearTimer:k=>timers.delete(k)});
 const step=(ms)=>{const k=[...timers].find(([,t])=>t.ms===ms);A.ok(k);timers.delete(k[0]);k[1].fn();};
 return {api,sockets,events,timers,step};
}
const hello=s=>s.incoming({type:'hello',version:1,maximumPlayers:8});
const seated=(s,resumed=false)=>s.incoming({type:'seated',version:1,code,seat:1,token,resumed});
const snap=(s,tick,ids,room=code)=>s.incoming({type:'snapshot',version:1,tick,code:room,players:Array(8).fill({ready:true}),events:ids.map(id=>({id}))});
test('waits for the hello, limits create data, never exposes reconnect credential to view',()=>{
 const h=setup();A.equal(h.api.begin({type:'create',seat:1,rink:'school',analytics:'invalid'}),true);
 const s=h.sockets[0];A.equal(h.api.start(),false);A.deepEqual(s.out,[]);hello(s);
 A.deepEqual(s.out,[{type:'create',seat:1,rink:'school'}]);seated(s);
 A.equal(h.api.ready(true),true);A.equal(h.api.start(),true);A.equal(h.api.input([2,-3],{check:true}),true);
 A.deepEqual(s.out.at(-1),{type:'input',seq:0,axes:[1,-1],shoot:false,pass:false,check:true,burst:false});
 A.ok(!JSON.stringify(h.events).includes(token));A.equal(h.timers.size,0);
});
test('repeated room ticks update roster, rewind/wrong room ignored, events not replayed',()=>{
 const h=setup();h.api.begin({type:'join',code,seat:1});const s=h.sockets[0];hello(s);seated(s);
 snap(s,0,[1]);snap(s,0,[1,2]);snap(s,5,[2]);snap(s,4,[3]);snap(s,9,[4],'Q2FCCC');
 const snapshots=h.events.filter(e=>e.type==='snapshot').map(x=>x.value);
 A.deepEqual(snapshots.map(x=>[x.frame.tick,x.advancesWorld,x.frame.events.map(e=>e.id)]),[[0,true,[1]],[0,false,[2]],[5,true,[]]]);
});
test('disconnect retains seat, resumes with backoff, stale socket ignored and input resets',()=>{
 const h=setup();h.api.begin({type:'create',seat:1});const s=h.sockets[0];hello(s);seated(s);h.api.input([0,0]);snap(s,2,[1]);s.close();
 A.equal(h.api.ready(true),false);h.step(350);
 const n=h.sockets[1];s.incoming({type:'expired',code});hello(n);
 A.deepEqual(n.out.at(-1),{type:'resume',code,token});
 n.incoming({type:'error',code:'SEAT_STILL_CONNECTED'});h.step(700);
 A.equal(n.out.length,2);seated(n,true);snap(n,3,[1,2]);A.equal(h.api.input([0,0]),true);
 A.equal(n.out.at(-1).seq,0);A.deepEqual(h.events.at(-1).value.frame.events,[{id:2}]);
 h.api.stop();A.equal(h.timers.size,0);A.equal(h.api.ready(true),false);
});
test('incompatible and silent endpoints fail closed; no create to wrong service',()=>{
 const h=setup();A.equal(h.api.begin({type:'join',seat:1,code:'??????'}),false);
 h.api.begin({type:'create',seat:1});h.sockets[0].incoming({type:'hello',version:2,maximumPlayers:8});
 A.equal(h.events.at(-1).type,'incompatible');A.deepEqual(h.sockets[0].out,[]);
 h.api.begin({type:'create',seat:1});h.step(10000);A.equal(h.events.at(-1).type,'unavailable');A.equal(h.timers.size,0);
});
