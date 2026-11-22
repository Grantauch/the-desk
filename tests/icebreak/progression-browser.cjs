const {chromium}=require('playwright');
const {instrument,file}=require('./fixture.cjs');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const assert=require('node:assert/strict');
const html=instrument(fs.readFileSync(file,'utf8'));
const out=path.resolve(process.env.ICEBREAK_EVIDENCE||'browser-results/icebreak');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html)});
(async()=>{
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const browser=await chromium.launch({headless:true}),results=[];
 try{
  for(const renderer of ['webgl','canvas-2d'])for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:viewport.width<500});
   if(renderer==='canvas-2d')await context.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:get.call(this,type,...args)}});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);
   await page.waitForFunction(()=>window.fixture&&window.__ICEBREAK_TEST__);
   const menu=await page.evaluate(()=>({
    challenge:document.getElementById('dailyChallengeName').textContent,
    detail:document.getElementById('dailyChallengeDetail').textContent,
    bookVisible:!document.getElementById('shiftBook').hidden,
    record:document.getElementById('dailyChallengeRecord').textContent,
    finalHidden:document.getElementById('matchReport').hidden
   }));
   assert.match(menu.challenge,/TODAY/);assert.equal(menu.finalHidden,true);
   assert.match(menu.detail,/Solo vs AI/);
   await page.locator('#playBtn').click();
   const running=await page.evaluate(()=>{
    const f=window.fixture,api=window.__ICEBREAK_TEST__;
    f.clear();f.setPaused(true);
    const ticker=document.getElementById('dailyTicker'),day=f.matchStats.day;
    return {renderer:api.getState().renderer,solo:f.matchStats.solo,day,ticker:ticker.textContent,hidden:ticker.hidden};
   });
   assert.equal(running.renderer,renderer);assert.equal(running.solo,true);
   assert.equal(running.hidden,false); // HUD refreshed at start
   assert.match(running.ticker,/DAILY/);
   const completion=await page.evaluate(()=>{
    const f=window.fixture,api=window.__ICEBREAK_TEST__,m=f.matchStats;
    const p=f.players.find(q=>q.device==='kb1'),challenge=f.challengeForDay(m.day),dt=1/90;
    if(challenge.metric==='shots'){
     for(let i=0;i<challenge.target;i++){p.stun=0;f.give(p);f.shot(p,.3)}
    }else if(challenge.metric==='passes'){
     const r=f.players.find(q=>q.team===p.team&&q.id===1),third=f.players.find(q=>q.team===p.team&&q.id===2);
     for(let i=0;i<challenge.target;i++){
      f.clear();Object.assign(p,{x:0,z:0,vx:0,vz:0,facing:0,stun:0,receiveWait:0});
      Object.assign(r,{x:3,z:.38,vx:0,vz:0,stun:0,receiveWait:0});
      Object.assign(third,{x:-14,z:7});
      f.give(p);f.pass(p);for(let t=0;t<42&&!f.puck.owner;t++)f.puckPhysics(dt);
     }
    }else if(challenge.metric==='checks'){
     f.setPaused(false); // direct QA impact requires an active physics state
     const rival=f.players.find(q=>q.team!==p.team&&!q.goalie);
     for(let i=0;i<challenge.target;i++){
      f.clear();Object.assign(p,{x:0,z:0,vx:8,vz:0,energy:1,stun:0,facing:0,check:0});
      Object.assign(rival,{x:1.06,z:0,vx:0,vz:0,stun:0,brace:0});
      f.beginCheck(p);f.collideSkaters(p,rival);
     }
     f.setPaused(true);
    }else if(challenge.metric==='win'){
     api.goal(p.team);
    }
    const valueBefore=f.challengeValue(m,challenge);
    const writesBefore=localStorage.getItem('icebreak:shift-book:v1');
    f.finish();
    const saved=JSON.parse(localStorage.getItem('icebreak:shift-book:v1'));
    const report=document.getElementById('matchReport');
    return {metric:challenge.metric,target:challenge.target,value:f.challengeValue(m,challenge),valueBefore,solo:m.solo,final:m.final,
     reportVisible:!report.hidden,report:document.getElementById('finalSoloStats').textContent,
     daily:document.getElementById('finalDaily').textContent,stats:document.getElementById('finalTeamStats').textContent,
     saved:saved.modes.regular.games,streak:saved.daily.streak,badges:saved.badges,
     firstWrite:writesBefore===null,day:m.day,awarded:m.dailyEarned,
     overflow:document.documentElement.scrollWidth>innerWidth};
   });
   assert.ok(completion.value>=completion.target,JSON.stringify(completion));
   assert.equal(completion.reportVisible,true);assert.equal(completion.saved,1);
   assert.equal(completion.firstWrite,true);assert.equal(completion.awarded,true);
   assert.equal(completion.streak,1);assert.equal(completion.overflow,false);
   assert.match(completion.report,/YOUR SHIFT:/);
   assert.match(completion.daily,/COMPLETE!/);
   assert.match(completion.stats,/GLACIERS:.*EMBERS:/);
   await page.screenshot({path:path.join(out,'shift-book-final-'+renderer+'-'+viewport.width+'.png')});
   await page.reload();await page.waitForFunction(()=>window.fixture&&window.__ICEBREAK_TEST__);
   const persisted=await page.evaluate(()=>{
    const f=window.fixture,name=document.getElementById('dailyChallengeName').textContent,
     record=document.getElementById('dailyChallengeRecord').textContent;
    return {games:f.shiftProgress.modes.regular.games,day:f.shiftProgress.daily.day,completed:f.shiftProgress.daily.completed,name,record};
   });
   assert.equal(persisted.games,1);assert.equal(persisted.day,completion.day);assert.equal(persisted.completed,1);
   assert.match(persisted.name,/COMPLETE/);assert.match(persisted.record,/1\s+games|1\/1|0\/1|wins/);
   const multiplayer=await page.evaluate(()=>{
    const f=window.fixture,api=window.__ICEBREAK_TEST__;
    api.setSeat(1,0,'kb2');api.start();f.clear();f.finish();
    return {solo:f.matchStats.solo,records:f.shiftProgress.modes.regular.games,
     final:document.getElementById('finalSoloStats').textContent,stored:JSON.parse(localStorage.getItem('icebreak:shift-book:v1')).modes.regular.games};
   });
   assert.equal(multiplayer.solo,false);assert.equal(multiplayer.records,1);assert.equal(multiplayer.stored,1);
   assert.match(multiplayer.final,/multiplayer/i);
   assert.deepEqual(errors,[]);
   results.push({renderer,viewport,status:'pass',metric:completion.metric,localGames:persisted.games,
    privateMultiplayer:true,errors:errors.length});
   await context.close();
  }
  // A blocked browser-storage environment still plays and shows accurate unsaved status.
  const locked=await browser.newContext({viewport:{width:1280,height:800}});
  await locked.addInitScript(()=>{Object.defineProperty(window,'localStorage',{configurable:true,get(){throw Error('blocked storage')}})});
  const page=await locked.newPage(),lockedErrors=[];page.on('pageerror',e=>lockedErrors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForFunction(()=>window.fixture&&window.__ICEBREAK_TEST__);
  const off=await page.evaluate(()=>{const f=window.fixture,api=window.__ICEBREAK_TEST__;api.start();f.clear();f.finish();return {available:f.shiftStorageAvailable,saved:f.matchStats.recordSaved,report:document.getElementById('finalDaily').textContent}});
  assert.equal(off.available,false);assert.equal(off.saved,false);assert.match(off.report,/Not saved/);
  assert.deepEqual(lockedErrors,[]);
  results.push({case:'storage blocked',status:'pass',errors:lockedErrors.length});
  await locked.close();
  console.log(JSON.stringify({batch:'ICEBREAK Shift Book',scenarios:results},null,2));
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
