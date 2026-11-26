#!/usr/bin/env python3
"""Check V4.8.6 continuous footfalls at 120Hz in four Chromium viewports.
Requires: python -m pip install playwright; python -m playwright install chromium
Run from any directory: python3 tests/qa_weighted_footfalls.py
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parent.parent
new=(root/'index.html').read_text()
old=(root/'source'/'baseline-v4.8.5.html').read_text()
engine=lambda s:s.split('const CONFIG=Object.freeze(',1)[1].split('class FieldRenderer{',1)[0]
assert engine(new)==engine(old),'Football engine must remain byte-identical'
res=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-gpu'])
 for width,height in [(1440,900),(390,844),(320,568),(844,390)]:
  page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(new,wait_until='load')
  page.locator('#playBtn').click()
  page.wait_for_timeout(55)
  result=page.evaluate('''() => {
   const t=window.__BREAKAWAY_TEST__,g=t.game,r=t.renderer;
   g.start();g.step=()=>{};r.gaitTracks.clear();r.frame=0;r.motionClock=0;r.lastPossession=-1;
   let prior=null,maxJump=0,maxIdle=0;
   const samples=[];
   for(let i=0;i<240;i++){
    const dt=1/120;
    const velocity=i<120?12:(i<180?18:0);
    g.player.vx=0;g.player.vy=velocity;
    g.player.y+=velocity*dt;
    r.draw(g,dt);
    const track=r.gaitTracks.get('runner');
    if(!track)throw new Error('runner has no foot track');
    if(prior!==null){const jump=track.phase-prior;maxJump=Math.max(maxJump,Math.abs(jump));if(i>=180)maxIdle=Math.max(maxIdle,Math.abs(jump));}
    prior=track.phase;samples.push(track.phase);
   }
   const phase=samples[239]-samples[0];
   const freeze=prior,score=g.score,clock=g.clock,pos=g.player.y;
   for(let i=0;i<30;i++)r.draw(g,0);
   const pausedDelta=r.gaitTracks.get('runner').phase-freeze;
   const beforeSpeedJump=r.gaitTracks.get('runner').phase;
   g.player.vy=5;r.draw(g,1/120);
   const speedJump=r.gaitTracks.get('runner').phase-beforeSpeedJump;
   return {maxJump,maxIdle,phase,pausedDelta,speedJump,clockSame:clock===g.clock,scoreSame:score===g.score,positionSame:pos===g.player.y,tracks:r.gaitTracks.size};
  }''')
  assert not errors, errors
  assert result['maxJump']<.16, result
  assert result['maxIdle']<1e-8, result
  assert abs(result['pausedDelta'])<1e-8, result
  assert abs(result['speedJump'])<1e-8, result
  assert result['clockSame'] and result['scoreSame'] and result['positionSame'], result
  assert result['tracks']>=1, result
  assert 11.8<result['phase']<12.5, result
  res.append({'viewport':f'{width}x{height}',**result,'errors':errors})
  print(f'{width}x{height}: max advance {result["maxJump"]:.3f} rad; idle {result["maxIdle"]:.3f}',flush=True)
  page.close()
 browser.close()
print('PASS: continuous stride phase, no speed-change snap, idle and replay freeze, four viewports')
