const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
const dt=1/90;
const KEY='icebreak:shift-book:v1';
function memoryStorage(entries=[]){
 const data=new Map(entries);let writes=0;
 return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>{writes++;data.set(k,String(v))},get writes(){return writes}};
}
function run(storage,opts={}){
 const result=fixture(undefined,{localStorage:storage}),{api,f}=result;
 if(opts.multiplayer)api.setSeat(1,0,'kb2');
 if(opts.goalie){api.setSeat(0,0,'ai');api.setSeat(0,3,'kb1')}
 if(opts.mode)api.setMode(opts.mode);
 api.start();f.clear();
 return {...result,skater:f.players.find(p=>p.device==='kb1')};
}
function shootAndScore(m,team=0){
 const {f,api,skater}=m;skater.stun=0;f.give(skater);f.shot(skater,1);
 assert.ok(f.matchStats.human.shots>0);api.goal(team);
}
function deliverPass(m){
 const {f}=m,p=f.players[0],recipient=f.players[1],third=f.players[2];
 Object.assign(p,{x:0,z:0,vx:0,vz:0,facing:0,stun:0});
 Object.assign(recipient,{x:3,z:.38,vx:0,vz:0,facing:0,stun:0,receiveWait:0});
 Object.assign(third,{x:-14,z:7,vx:0,vz:0});
 f.give(p);f.pass(p);
 for(let i=0;i<42&&!f.puck.owner;i++)f.puckPhysics(dt);
 return {p,recipient};
}
function dayFor(f,metric){
 for(let n=1;n<=45;n++){
  const day=new Date(Date.UTC(2026,10,n)).toISOString().slice(0,10);
  if(f.challengeForDay(day).metric===metric)return day;
 }
 throw Error('no day for '+metric);
}
test('Shift Book starts with no history and deterministic rotating daily objectives',()=>{
 const {f,elements}=fixture(undefined,{localStorage:memoryStorage()});
 assert.equal(f.shiftProgress.modes.regular.games,0);
 assert.equal(f.shiftProgress.badges.length,0);
 const day=f.localDay(),ch=f.challengeForDay(day);
 assert.ok(['shots','passes','checks','win'].includes(ch.metric));
 assert.equal(f.challengeForDay(day).id,ch.id);
 assert.match(elements.get('dailyChallengeName').textContent,/TODAY/);
});
test('ISO calendar day comparisons ignore daylight-saving clock length',()=>{
 const {f}=fixture(undefined,{localStorage:memoryStorage()});
 const p=f.newProgress();
 assert.equal(f.awardDaily(p,'2026-11-01'),true);
 assert.equal(f.awardDaily(p,'2026-11-02'),true);
 assert.equal(p.daily.streak,2);
 assert.equal(f.awardDaily(p,'2026-11-02'),false);
 assert.equal(p.daily.completed,2);
 assert.equal(f.awardDaily(p,'2026-11-05'),true);
 assert.equal(p.daily.streak,1);
 assert.equal(p.daily.bestStreak,2);
 assert.equal(f.awardDaily(p,'2026-02-30'),false);
});
test('malformed storage and unknown versions recover without importing invented records',()=>{
 const wrong=memoryStorage([[KEY,'{broken']]),a=fixture(undefined,{localStorage:wrong});
 assert.equal(a.f.shiftProgress.version,1);
 assert.equal(a.f.shiftStorageAvailable,true,'bad JSON is different from inaccessible storage');
 const version=memoryStorage([[KEY,JSON.stringify({version:99,modes:{regular:{wins:999}}})]]);
 assert.equal(fixture(undefined,{localStorage:version}).f.shiftProgress.modes.regular.wins,0);
 const unsafe={version:1,modes:{regular:{games:-4,wins:5.4,bestGoals:100000000000,bestPasses:3}},badges:['bad','first-win','first-win'],daily:{day:'2026-02-30',streak:12}};
 const sanitized=a.f.sanitizedProgress(unsafe);
 assert.equal(sanitized.modes.regular.games,0);
 assert.equal(sanitized.modes.regular.wins,0);
 assert.equal(sanitized.modes.regular.bestGoals,100000);
 assert.equal(sanitized.badges.length,1);
 assert.equal(sanitized.daily.streak,0);
});
test('abandoned attempts and new faceoffs never write personal records',()=>{
 const store=memoryStorage(),m=run(store);
 m.f.matchStats.human.shots=12;
 m.f.resetFaceoff();m.api.reset();
 assert.equal(store.writes,0);
 assert.equal(m.f.matchStats.human.shots,0);
 assert.equal(m.f.shiftProgress.modes.regular.games,0);
});
test('attempted shot and attributed goal count only for the actual human shooter',()=>{
 const m=run(memoryStorage()),{f,api,skater}=m;
 f.give(skater);f.shot(skater,1);
 assert.equal(f.matchStats.teamShots[0],1);
 assert.equal(f.matchStats.human.shots,1);
 api.goal(0);
 assert.equal(f.matchStats.human.goals,1);
 // Another side's goal cannot be credited to this shooter.
 api.step(3.4);f.clear();api.goal(1);
 assert.equal(f.matchStats.human.goals,1);
 assert.equal(f.matchStats.trailed,false,'equalized score is not a comeback');
});
test('a team goal with no eligible human shot never becomes an individual goal',()=>{
 const m=run(memoryStorage()),{api,f}=m;
 api.goal(0);assert.equal(f.matchStats.human.goals,0);
 assert.equal(f.score[0],1);
});
test('only completed intended passes count; enemy interceptions do not',()=>{
 const m=run(memoryStorage()),{f}=m;
 let first=deliverPass(m);
 assert.equal(f.puck.owner,first.recipient);
 assert.equal(f.matchStats.human.passes,1);
 f.clear();Object.assign(first.p,{x:0,z:0,stun:0});Object.assign(first.recipient,{x:9,z:0,stun:0});
 let enemy=f.players[3];Object.assign(enemy,{x:4.5,z:.13,stun:0,receiveWait:0});
 f.give(first.p);f.pass(first.p);
 for(let i=0;i<42&&!f.puck.owner;i++)f.puckPhysics(dt);
 assert.equal(f.puck.owner,enemy);
 assert.equal(f.matchStats.human.passes,1);
});
test('solid checks earn a clean-hit stat, but ordinary collisions do not',()=>{
 const m=run(memoryStorage()),{f,skater}=m,b=f.players[3];
 Object.assign(skater,{x:0,z:0,vx:12,facing:0,stun:0,energy:1});
 Object.assign(b,{x:1.06,z:0,vx:0,stun:0});
 f.collideSkaters(skater,b);
 assert.equal(f.matchStats.human.checks,0);
 Object.assign(skater,{x:0,z:0,vx:8,facing:0,stun:0,energy:1,check:0});
 Object.assign(b,{x:1.06,z:0,vx:0,stun:0});
 assert.equal(f.beginCheck(skater),true);
 f.collideSkaters(skater,b);
 assert.equal(f.matchStats.human.checks,1);
});
test('swept goalie saves count against the correct team and solo goalie',()=>{
 const m=run(memoryStorage(),{goalie:true}),{f,skater}=m;
 Object.assign(skater,{x:-25.3,z:0,stun:0});
 Object.assign(f.puck,{owner:null,x:skater.x+1.21,z:0,vx:-4,vz:0,lock:1});
 for(let i=0;i<8&&f.matchStats.teamSaves[0]===0;i++)f.puckPhysics(dt);
 assert.equal(f.matchStats.teamSaves[0],1);
 assert.equal(f.matchStats.human.saves,1);
 assert.equal(f.matchStats.teamSaves[1],0);
});
test('completing a solo shift saves one match once, with earned badges and local records',()=>{
 const store=memoryStorage(),m=run(store);
 shootAndScore(m);
 m.f.finish();m.f.finish();
 assert.equal(store.writes,1,'the final horn is an idempotent commit');
 assert.equal(m.f.shiftProgress.modes.regular.games,1);
 assert.equal(m.f.shiftProgress.modes.regular.wins,1);
 assert.equal(m.f.shiftProgress.modes.regular.bestGoals,1);
 assert.ok(m.f.shiftProgress.badges.includes('first-win'));
 assert.ok(m.f.shiftProgress.badges.includes('opening-goal'));
 assert.ok(m.f.matchStats.unlocked.includes('First Victory'));
 assert.match(m.elements.get('finalSoloStats').textContent,/1 goal/);
 const reloaded=fixture(undefined,{localStorage:store});
 assert.equal(reloaded.f.shiftProgress.modes.regular.games,1);
 assert.equal(reloaded.f.shiftProgress.modes.regular.bestGoals,1);
});
test('Regular and Powerups personal bests remain separate',()=>{
 const store=memoryStorage(),a=run(store,{mode:'regular'});a.f.finish();
 const b=run(store,{mode:'powerups'});b.f.finish();
 const reread=fixture(undefined,{localStorage:store});
 assert.equal(reread.f.shiftProgress.modes.regular.games,1);
 assert.equal(reread.f.shiftProgress.modes.powerups.games,1);
});
test('daily reward is only awarded at finish, once each day even after repeat wins',()=>{
 const store=memoryStorage(),a=run(store);
 const day=dayFor(a.f,'shots');a.f.matchStats.day=day;
 for(let i=0;i<3;i++){a.f.give(a.skater);a.f.shot(a.skater,0)}
 assert.equal(a.f.matchStats.human.shots,3);
 assert.equal(store.writes,0);
 a.f.finish();
 assert.equal(a.f.matchStats.dailyEarned,true);
 assert.equal(a.f.shiftProgress.daily.day,day);
 assert.equal(a.f.shiftProgress.daily.streak,1);
 const b=run(store);b.f.matchStats.day=day;
 for(let i=0;i<3;i++){b.f.give(b.skater);b.f.shot(b.skater,0)}
 b.f.finish();
 assert.equal(b.f.matchStats.dailyEarned,false);
 assert.equal(b.f.shiftProgress.daily.completed,1);
});
test('human-versus-human games display match stats but do not update solo achievements or storage',()=>{
 const store=memoryStorage(),m=run(store,{multiplayer:true});
 const a=m.f.players.find(p=>p.device==='kb1');
 m.f.give(a);m.f.shot(a,0);
 assert.equal(m.f.matchStats.teamShots[0],1);
 assert.equal(m.f.matchStats.solo,false);
 m.f.finish();
 assert.equal(store.writes,0);
 assert.equal(m.f.shiftProgress.modes.regular.games,0);
 assert.match(m.elements.get('finalSoloStats').textContent,/multiplayer/i);
});
test('blocked localStorage never prevents play or falsely claims persisted records',()=>{
 const broken={getItem(){throw Error('private browser blocked')},setItem(){throw Error('no permission')}};
 const m=run(broken);
 m.f.finish();
 assert.equal(m.f.matchStats.final,true);
 assert.equal(m.f.matchStats.recordSaved,false);
 assert.match(m.elements.get('finalDaily').textContent,/Not saved/i);
});
