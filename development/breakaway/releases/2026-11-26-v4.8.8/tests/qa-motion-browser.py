from pathlib import Path
from playwright.sync_api import sync_playwright
import shutil
r=Path(__file__).resolve().parent.parent
html=(r/'index.html').read_text()
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or None,args=['--no-sandbox','--disable-gpu'])
 for w,h in [(1440,900),(390,844),(320,568),(844,390)]:
  pg=b.new_page(viewport={'width':w,'height':h})
  errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
  pg.set_content(html,wait_until='load')
  result=pg.evaluate('''() => {
   const a=window.__BREAKAWAY_TEST__,g=a.game,r=a.renderer;
   g.start();g.step=()=>{};g.defenders=[];g.blockers=[];
   const p=g.player;p.vx=0;p.vy=12;p.y=50;p.air=0;r.lastPossession=-1;r.draw(g,0);
   for(let i=0;i<40;i++){p.y+=.1;r.draw(g,1/120)}
   const first=r.gaitTracks.get('runner').phase;p.air=.4;
   for(let i=0;i<30;i++){p.y+=.1;r.draw(g,1/120)}
   const freeze=r.gaitTracks.get('runner').phase-first;
   p.air=0;r.draw(g,1/120);
   const jump=r.gaitTracks.get('runner').phase-first;
   const size=Math.max(7,r.scale*.93);
   const cached=r.kitGradient('runner',size,'jersey')===r.kitGradient('runner',size,'jersey');
   const count=r._kitMaterials.size;r.resize();
   return {freeze,jump,cached,count,cleared:r._kitMaterials.size===0};
  }''')
  assert not errors,errors
  assert abs(result['freeze'])<1e-8 and abs(result['jump'])<1e-8,result
  assert result['cached'] and result['cleared'] and result['count']<25,result
  print(f'PASS {w}x{h} air/stance/cache',flush=True)
  pg.close()
 b.close()
