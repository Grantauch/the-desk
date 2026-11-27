#!/usr/bin/env python3
"""V4.8.9 headless browser regression, not real-device certification."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import shutil
root = Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf-8')
layouts = [(1440,900),(390,844),(320,568),(844,390)]

def start_replay(page):
    return page.evaluate("""() => {
      const t=window.__BREAKAWAY_TEST__,g=t.game;
      if(g.phase!=='playing')t.gameStart();
      g.driveState='';g.escape=null;
      g.possession++;
      const d=g.defenders[0];
      for(let i=0;i<84;i++){
        g.player.x=Math.sin(i/12)*2;
        g.player.y=26+i*.48;
        g.player.vx=Math.cos(i/12)*1.1;g.player.vy=7.6;
        if(d){d.x=g.player.x+2;d.y=g.player.y+3;}
        t.captureReplay(1/28);
      }
      const count=t.replay.history.length;
      const sample=t.replay.history[0].player.x;
      g.driveState='TACKLED';
      const frozen=JSON.stringify({
        clock:g.clock,score:g.score,x:g.player.x,y:g.player.y,
        defenders:g.defenders.map(d=>[d.id,d.x,d.y,d.outForDrive])
      });
      const shown=t.showReplay();
      for(let i=0;i<8;i++)t.renderReplay(.03);
      const same=JSON.stringify({
        clock:g.clock,score:g.score,x:g.player.x,y:g.player.y,
        defenders:g.defenders.map(d=>[d.id,d.x,d.y,d.outForDrive])
      })===frozen;
      const bufferValid=count<=92&&t.replay.frames.length<=60;
      const isolated=t.replay.frames[0].player.x===sample;
      return {shown,same,bufferValid,isolated,count,playing:t.replay.active};
    }""")

with sync_playwright() as p:
    browser=p.chromium.launch(
        headless=True,executable_path=shutil.which('chromium') or None,
        args=['--no-sandbox','--disable-gpu'])
    for width,height in layouts:
        page=browser.new_page(viewport={'width':width,'height':height})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(html,wait_until='load')
        result=start_replay(page)
        assert all(result[k] for k in ('shown','same','bufferValid','isolated','playing')),result
        # Keyboard skip at mid-replay. Memory and focus return are explicit.
        page.keyboard.press('Space')
        assert page.evaluate("() => !window.__BREAKAWAY_TEST__.replay.active"),'keyboard skip'
        assert page.evaluate("() => window.__BREAKAWAY_TEST__.replay.frames.length===0"),'clear frames'
        # Touch/click skip at replay start.
        result=start_replay(page)
        assert result['shown'],result
        page.locator('#replaySkipBtn').click()
        assert page.evaluate("() => !window.__BREAKAWAY_TEST__.replay.active"),'touch skip'
        # Still frame when Reduced Effects is enabled, no read of live state.
        page.evaluate("""() => {
          const t=window.__BREAKAWAY_TEST__;
          if(!t.reducedEffects)document.getElementById('motionBtn').click();
        }""")
        result=start_replay(page)
        assert result['shown'],result
        still=page.evaluate("""() => {
          const t=window.__BREAKAWAY_TEST__;
          t.renderReplay(.02);
          return {shake:t.replayRenderer.shakeX,kind:document.getElementById('replayDetail').textContent};
        }""")
        assert still['shake']==0 and 'STILL FRAME' in still['kind'],still
        page.evaluate("() => window.__BREAKAWAY_TEST__.finishReplay()")
        # Contact anchoring on the field with the smallest viewport too.
        placement=page.evaluate("""() => {
          const t=window.__BREAKAWAY_TEST__,g=t.game,r=t.renderer;
          g.driveState='';g.escape=null;r.lastPossession=-1;
          const d=g.defenders[0];
          if(!d)return {valid:false};
          d.x=g.player.x+1;d.y=g.player.y+1;d.outForDrive=false;
          g.escape={defenderId:d.id};
          r.draw(g,0);t.positionEscapePrompt();
          const el=document.getElementById('escapeAnchor');
          const x=parseFloat(el.style.left),y=parseFloat(el.style.top);
          const hit=r.project((g.player.x+d.x)/2,(g.player.y+d.y)/2);
          g.escape=null;
          return {valid:Number.isFinite(x)&&Number.isFinite(y)&&
            x>=0&&x<=r.w&&y>=0&&y<=r.h&&Math.abs(x-hit.x)<=60};
        }""")
        assert placement['valid'],placement
        # 500 draws per layout = 2,000 across four layouts.
        draw=page.evaluate("""() => {
          const t=window.__BREAKAWAY_TEST__,g=t.game;
          for(let i=0;i<500;i++)t.renderer.draw(g,1/60);
          return t.renderer.frame;
        }""")
        assert draw>=500,draw
        assert not errors,(width,height,errors)
        print(f'PASS {width}x{height}: replay freeze, skip, bound, still, prompt, 500 draws')
        page.close()
    browser.close()
print('PASS 4 viewports and 2,000 renderer draws (Chromium emulation only)')
