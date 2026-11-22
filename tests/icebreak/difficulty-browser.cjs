// End-to-end keyboard/touch-size browser checks of fair opponent AI, progression
// partitioning and accessible difficulty selection across both rendering paths.
const {chromium}=require('playwright');
const {instrument,file}=require('./fixture.cjs');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const source=instrument(fs.readFileSync(file,'utf8')),out=path.resolve(process.env.ICEBREAK_EVIDENCE||'browser-results/icebreak');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(source)});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true}),results=[];
 try{
  for(const renderer of ['webgl','canvas-2d'])for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:viewport.width<500});
   if(renderer==='canvas-2d')await context.addInitScript(()=>{
    const native=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:native.call(this,type,...args)};
   });
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);
   await page.waitForFunction(()=>window.fixture&&window.__ICEBREAK_TEST__);
   const chooser=page.locator('#difficultySelect');
   assert.equal(await chooser.inputValue(),'standard');
   assert.match(await chooser.getAttribute('aria-label'),/Opponent AI difficulty/);
   const start=await page.locator('#playBtn').boundingBox();
   assert.ok(start&&start.y>=0&&start.y+start.height<=viewport.height,'Drop Puck must fit before scrolling on '+viewport.width+'px');
   for(const level of ['rookie','standard','veteran']){
    await chooser.selectOption(level);
    const intro=await page.evaluate(()=>{
     const f=window.fixture,ai=f.players.find(p=>p.team===1&&!p.goalie),mate=f.players.find(p=>p.team===0&&p.device==='ai');
     return {level:f.config.difficulty,enemy:f.aiLevelFor(ai).label,own:f.aiLevelFor(mate).label,
       book:document.getElementById('dailyChallengeRecord').textContent};
    });
    assert.equal(intro.level,level);assert.equal(intro.enemy,level.toUpperCase());assert.equal(intro.own,'STANDARD');
    assert.match(intro.book,new RegExp('No completed solo matches in '+level));
   }
   await chooser.selectOption('rookie');
   await page.locator('#playBtn').click();
   const done=await page.evaluate(()=>{
    const f=window.fixture,api=window.__ICEBREAK_TEST__,skater=f.players.find(p=>p.device==='kb1');
    const opponent=f.players.find(p=>p.team!==skater.team&&!p.goalie);
    const ownMate=f.players.find(p=>p.team===skater.team&&p.device==='ai');
    const active={level:f.matchStats.difficulty,enemy:f.aiLevelFor(opponent).label,own:f.aiLevelFor(ownMate).label};
    f.clear();skater.stun=0;f.give(skater);f.shot(skater,.4);api.goal(skater.team);f.finish();
    const saved=JSON.parse(localStorage.getItem('icebreak:shift-book:v1'));
    return {...active,finished:f.matchStats.final,mode:f.matchStats.mode,won:f.matchStats.won,
      total:saved.modes.regular.games,rookie:saved.byDifficulty.rookie.regular.games,
      standard:saved.byDifficulty.standard.regular.games,veteran:saved.byDifficulty.veteran.regular.games,
      report:document.getElementById('finalSoloStats').textContent,
      play:(()=>{const b=document.getElementById('playBtn').getBoundingClientRect();return [b.top,b.bottom]})(),
      overflow:document.documentElement.scrollWidth>innerWidth};
   });
   assert.deepEqual([done.level,done.enemy,done.own],['rookie','ROOKIE','STANDARD']);
   assert.equal(done.finished,true);assert.equal(done.won,true);
   assert.deepEqual([done.total,done.rookie,done.standard,done.veteran],[1,1,0,0]);
   assert.match(done.report,/ROOKIE AI/);assert.equal(done.overflow,false);
   assert.ok(done.play[0]>=0&&done.play[1]<=viewport.height,'Play Again must be visible');
   await page.screenshot({path:path.join(out,'ai-difficulty-final-'+renderer+'-'+viewport.width+'.png')});
   await page.locator('#changeSetupBtn').click();await chooser.selectOption('veteran');
   const next=await page.evaluate(()=>({
    level:window.fixture.config.difficulty,record:document.getElementById('dailyChallengeRecord').textContent,
    games:window.fixture.shiftProgress.byDifficulty.veteran.regular.games
   }));
   assert.equal(next.level,'veteran');assert.equal(next.games,0);assert.match(next.record,/No completed solo matches in veteran/);
   await page.locator('#playBtn').click();
   const second=await page.evaluate(()=>{
    const f=window.fixture,api=window.__ICEBREAK_TEST__;
    const level=f.matchStats.difficulty,opponent=f.players.find(p=>p.team===1&&!p.goalie);
    f.clear();f.finish();
    return {level,enemy:f.aiLevelFor(opponent).label,record:f.shiftProgress.byDifficulty.veteran.regular.games};
   });
   assert.deepEqual(second,{level:'veteran',enemy:'VETERAN',record:1});
   await page.reload();await page.waitForFunction(()=>window.fixture&&window.__ICEBREAK_TEST__);
   const persisted=await page.evaluate(()=>({
    defaultDifficulty:window.fixture.config.difficulty,
    rookie:window.fixture.shiftProgress.byDifficulty.rookie.regular.games,
    veteran:window.fixture.shiftProgress.byDifficulty.veteran.regular.games,
    aggregate:window.fixture.shiftProgress.modes.regular.games
   }));
   assert.deepEqual(persisted,{defaultDifficulty:'standard',rookie:1,veteran:1,aggregate:2});
   await page.locator('.seats summary').click();
   await chooser.selectOption('veteran');
   const seat=page.locator('#seatGrid select').nth(4);
   await seat.selectOption('kb2');
   assert.equal(await chooser.isDisabled(),true,'AI selector is neutralized when two humans play');
   assert.equal(await chooser.inputValue(),'standard');
   assert.match(await chooser.getAttribute('title'),/Standard AI/);
   await seat.selectOption('ai');
   assert.equal(await chooser.isDisabled(),false);
   assert.equal(await chooser.inputValue(),'veteran','previous solo preference returns');
   assert.deepEqual(errors,[]);
   results.push({renderer,viewport,levelSwitch:'pass',separateRecords:'pass',visibleButtons:'pass',pageErrors:0});
   await context.close();
  }
  console.log(JSON.stringify({batch:'ICEBREAK fair AI difficulty',scenarios:results},null,2));
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
