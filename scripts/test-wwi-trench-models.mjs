import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('public'),out=resolve('browser-results/wwi-trench');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{
  try{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);assert(p.startsWith(root+sep));const data=await readFile(p);res.writeHead(200,{'Content-Type':extname(p)==='.html'?'text/html':'model/gltf-binary'});res.end(data);}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=process.env.WWI_BASE_URL||`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
  for(const width of [1440,1366])for(const fallback of [false,true]){
    const page=await browser.newPage({viewport:{width,height:768}}),errors=[],warnings=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning'&&m.text().includes('WWI Blender'))warnings.push(m.text());});
    if(fallback)await page.route('**/trench_sandbag_1916_web.glb',r=>r.fulfill({status:404,body:'Synthetic asset failure'}));
    await page.goto(base+'/hubs/ush9-over-the-top.html');
    await page.getByRole('button',{name:'Move up to the line',exact:true}).click();
    await page.waitForFunction(expected=>document.getElementById('c').dataset.sandbags===expected,fallback?'fallback':'blender');
    await page.getByRole('button',{name:'Show trench parts',exact:true}).click();
    await page.waitForTimeout(500);await page.screenshot({path:resolve(out,`${width}-${fallback?'fallback':'blender'}.png`)});
    for(let stop=2;stop<=7;stop++){
      await page.getByRole('button',{name:String(stop),exact:true}).click();await page.waitForTimeout(600);
      assert((await page.locator('#card').innerText()).length>150);
    }
    const metrics=await page.evaluate(async()=>{const times=[];let last=performance.now();for(let i=0;i<30;i++)await new Promise(r=>requestAnimationFrame(t=>{times.push(t-last);last=t;r();}));return {meanFrameMs:times.slice(1).reduce((a,b)=>a+b,0)/29,heapBytes:performance.memory?.usedJSHeapSize??null};});
    assert.equal(errors.length,0,errors.join('\n'));assert.equal(warnings.length,fallback?1:0,warnings.join('\n'));
    results.push({width,fallback,errors,warnings:warnings.length,metrics});await page.close();
  }
  console.log(JSON.stringify(results,null,2));
}finally{await browser.close();server.close();}
