"""Replay timing at representative display cadences, on the actual offline HTML."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import shutil

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or None)
    page=browser.new_page(viewport={'width':390,'height':844})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content((Path(__file__).resolve().parents[1]/'index.html').read_text(encoding='utf-8'))
    cases=page.evaluate("""() => {
      const t=window.__BREAKAWAY_TEST__,g=t.game,r=t.replay;
      t.gameStart();
      const results=[];
      for(const pattern of [[1/30],[1/60],[1/90],[1/120],[.012,.047,.022,.066,.016,.029]]){
        for(const kind of ['TACKLED','TOUCHDOWN']){
          g.driveState='';g.escape=null;g.possession++;
          let elapsed=0;
          for(let i=0;elapsed<6;i++){
            const dt=pattern[i%pattern.length];elapsed+=dt;
            g.player.x=elapsed;t.captureReplay(dt);
          }
          const count=r.history.length,spacing=r.history.at(-1).replayAt-r.history[0].replayAt;
          g.player.x=elapsed+.018;g.driveState=kind;
          const {clock,score}=g;
          if(!t.showReplay(.018))throw Error('replay did not start');
          const start=r.frames[0].replayAt, end=r.frames.at(-1).replayAt;
          const size=r.frames.length,duration=r.duration, span=end-start;
          const original=t.replayRenderer.draw;
          let drawX;
          try {
            t.replayRenderer.draw=g=>{drawX=g.player.x};
            r.time=duration*.90*.35;
            t.renderReplay(0);
          } finally { t.replayRenderer.draw=original }
          results.push({pattern,kind,span,duration,size,historyCount:count,recoveredRate:(count-1)/spacing,
            sampleError:Math.abs(drawX-(start+span*.35)),frozen:g.clock===clock&&g.score===score});
          t.finishReplay();
        }
      }
      g.possession++;g.driveState='TACKLED';t.showReplay();
      const still=r.still&&r.duration===1.15&&r.frames.length===1;
      t.finishReplay();
      return {results,still};
    }""")
    for row in cases['results']:
        assert row['historyCount']==92 and 1 < row['size'] <=60,row
        minimum=27 if len(row['pattern'])==1 else 20
        assert minimum<=row['recoveredRate']<=29,row
        assert row['span']>=1.70 and row['duration']<=2.80,row
        assert row['duration']*.90/row['span']>=(1.34 if row['kind']=='TOUCHDOWN' else 1.20)-1e-9,row
        assert row['sampleError']<1e-8 and row['frozen'],row
        print(row)
    assert cases['still'] and not errors,(cases['still'],errors)
    browser.close()
