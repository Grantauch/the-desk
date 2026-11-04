// WebGL acceptance for real exported exhibit assets and original-object fallback.
// This test serves only public files. It never contacts classroom services.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';

const root=resolve('public'), output=resolve('browser-results/wwi-museums');
await mkdir(output,{recursive:true});
const server=createServer(async(req,res)=>{
  try {
    const p=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    assert(p.startsWith(root+sep));
    const data=await readFile(p);
    res.writeHead(200,{'Content-Type':extname(p)==='.glb'?'model/gltf-binary':extname(p)==='.html'?'text/html':'application/octet-stream'});res.end(data);
  }catch {res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=process.env.WWI_BASE_URL||`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
  for(const viewport of [{width:1440,height:900},{width:1366,height:768}]){
    for(const fallback of [false,true]){
      const page=await browser.newPage({viewport});const errors=[],warnings=[],models=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('console',m=>{if(m.type()==='warning'&&m.text().includes('WWI Blender'))warnings.push(m.text());});
      page.on('response',r=>{if(r.url().endsWith('.glb'))models.push({file:r.url().split('/').pop(),status:r.status()});});
      if(fallback)await page.route('**/*.glb',r=>r.fulfill({status:404,body:'Synthetic unavailable asset'}));
      await page.goto(base+'/hubs/ush9-the-arsenal.html');
      await page.getByRole('button',{name:'I',exact:true}).waitFor();
      await page.getByRole('button',{name:'Enter the gallery',exact:true}).click();
      for(const [label,title] of [['II','The Machine Gun'],['III','Artillery'],['VIII','The Aeroplane'],['IV','Gas'],['V','Wire'],['VI','Flamethrower'],['IX','Zeppelin'],['X','U-Boat']]){
        await page.getByRole('button',{name:label,exact:true}).click();
        await page.waitForTimeout(1800); // Camera animation, also exercises the render loop.
        await page.screenshot({path:resolve(output,`${viewport.width}-${label}-${fallback?'fallback':'blender'}.png`)});
        const text=await page.locator('#pbody').innerText();assert(text.length>200);
      }
      await page.getByRole('button',{name:'II',exact:true}).click();
      await page.waitForTimeout(250);
      const fire=page.getByRole('button',{name:/^fire/i});
      if(await fire.count()){await fire.first().click();await page.waitForTimeout(200);}
      assert.equal(errors.length,0,errors.join('\n'));
      assert.equal(models.length,10,'Each configured model must be requested');
      if(fallback)assert.equal(warnings.length,10,'Every missing GLB keeps its fallback');
      else {assert.equal(warnings.length,0,warnings.join('\n'));assert(models.every(m=>m.status===200));}
      const metrics=await page.evaluate(async()=>{
        const samples=[];let last=performance.now();
        for(let i=0;i<30;i++)await new Promise(r=>requestAnimationFrame(t=>{samples.push(t-last);last=t;r();}));
        return {meanFrameMs:samples.slice(1).reduce((a,b)=>a+b,0)/29,heapBytes:performance.memory?.usedJSHeapSize??null};
      });
      results.push({viewport,fallback,models,errors,warnings:warnings.length,metrics});
      await page.close();
    }
  }
  console.log(JSON.stringify(results,null,2));
}finally{await browser.close();server.close();}
