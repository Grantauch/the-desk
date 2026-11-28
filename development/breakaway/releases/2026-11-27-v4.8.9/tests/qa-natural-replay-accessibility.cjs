const A=require('node:assert/strict'), crypto=require('node:crypto'), fs=require('node:fs'), path=require('node:path');
const {chromium}=require(process.env.BREAKAWAY_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
const candidate=fs.readFileSync(path.join(root,'index.html'));
A.equal(crypto.createHash('sha256').update(candidate).digest('hex'),JSON.parse(fs.readFileSync(path.join(root,'BUILD_MANIFEST.json'),'utf8')).sha256);
const browser=await chromium.launch(process.env.BREAKAWAY_CHROMIUM ? {executablePath:path.resolve(process.env.BREAKAWAY_CHROMIUM)} : {});
try{
for(const [width,height] of [[1280,800],[844,390],[390,844]]){
 const context=await browser.newContext({viewport:{width,height},hasTouch:width===390});
 await context.route('**/*',r=>r.request().url()==='https://breakaway.test/'?r.fulfill({body:candidate,contentType:'text/html'}):r.abort());
 const page=await context.newPage(), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://breakaway.test/');
 await page.keyboard.press('Enter');
 const stage=page.locator('#replayStage'), hud=page.locator('#time');
 const snapshot=()=>page.evaluate(()=>{const t=window.__BREAKAWAY_TEST__,g=t.game;return {clock:g.clock,score:g.score,x:g.player.x,y:g.player.y,replay:t.replay.active,span:t.replay.span,frames:t.replay.frames.length,focus:document.activeElement?.id};});
 const start=await snapshot();
 await page.keyboard.down('ArrowUp');
 await page.keyboard.down('Shift');
 await stage.waitFor({state:'visible',timeout:25000});
 await page.keyboard.up('Shift');
 await page.keyboard.up('ArrowUp');
 const first=await snapshot();
 A(first.replay && first.frames>=2 && first.span>0 && first.clock<start.clock);
 A.equal((await snapshot()).focus,'replaySkipBtn');
 const active=()=>page.evaluate(()=>document.activeElement?.id??'');
 const steps=[];
 for(const key of ['Tab','Shift+Tab','Shift+Tab']){
  await page.keyboard.press(key);steps.push(await active());
  console.log(JSON.stringify({width,key,focus:steps.at(-1),replayVisible:await stage.isVisible()}));
  A.equal(steps.at(-1),'replaySkipBtn'); A(await stage.isVisible());
 }
 A(await page.locator('#hud').evaluate(e=>e.inert));
 const rect=await page.locator('.replay-controls').boundingBox();
 const button=await page.locator('#replaySkipBtn').boundingBox();
 A(button.height>=44);
 if(width>height&&height<=480) A(rect.x>width/2+25);
 else A(Math.abs(rect.x+rect.width/2-width/2)<1);
 if(width===1280) await page.keyboard.press('Escape');
 if(width===390) await page.locator('#replaySkipBtn').tap();
 await stage.waitFor({state:'hidden'});
 const post=await snapshot(); A(['nextPlayBtn','field'].includes(post.focus)); A(!await page.locator('#hud').evaluate(e=>e.inert)); A.equal(post.frames,0); A.deepEqual(errors,[]);
 console.log(JSON.stringify({width,height,start:first.focus,steps,after:post.focus}));
 await page.locator('#pauseBtn').click();
 const buttons=page.locator('#paused button:visible');
 const last=buttons.last(), firstButton=buttons.first();
 await firstButton.focus(); await page.keyboard.press('Shift+Tab');
 A.equal(await active(),await last.getAttribute('id'));
 await page.keyboard.press('Tab'); A.equal(await active(),await firstButton.getAttribute('id'));
 await page.keyboard.press('Escape'); A(!await page.locator('#paused').isVisible());
 A.deepEqual(errors,[]);
 await context.close();
}
} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
