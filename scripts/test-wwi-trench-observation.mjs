import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
const out=resolve('browser-results/wwi-observation');await mkdir(out,{recursive:true});
const root=resolve('public'),html=await readFile(resolve(root,'hubs/ush9-over-the-top.html'),'utf8');
const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);assert(p.startsWith(root+sep));res.writeHead(200,{'Content-Type':extname(p)==='.html'?'text/html':'model/gltf-binary'});res.end(await readFile(p));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const local=!process.env.WWI_BASE_URL,base=process.env.WWI_BASE_URL||'http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const keys=['m1917','adrian','periscope'],stems=['m1917_helmet_1917','adrian_helmet_1915','wooden_trench_periscope_1917'],results=[];
try{
for(const width of [1366,390]){
const page=await browser.newPage({viewport:{width,height:768}}),errors=[],warnings=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning'&&m.text().includes('WWI Blender'))warnings.push(m.text());});
if(local&&width===1366)await page.route('**/ush9-over-the-top.html',r=>r.fulfill({contentType:'text/html',body:html.replace('__upgradeWWISandbags();','window.__observationQA={scene:Dt,camera:ve,renderer:dn,helmets:__wwiHelmetTargets,periscope:gi,Vector:T};\n__upgradeWWISandbags();')}));
await page.goto(base+'/hubs/ush9-over-the-top.html',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>['m1917','adrian','periscope','sandbags'].every(k=>document.getElementById('c').dataset[k]==='blender'),null,{timeout:30000});
await page.getByRole('button',{name:'Move up to the line',exact:true}).click();
await page.waitForTimeout(1500);
await page.screenshot({path:resolve(out,width+'-entry.png')});
for(let stop=2;stop<=7;stop++){await page.getByRole('button',{name:String(stop),exact:true}).click();assert((await page.locator('#card').innerText()).toLowerCase().includes('stop '+stop+' of 7'));}
await page.getByRole('button',{name:'4',exact:true}).click();await page.getByRole('button',{name:'Look through the periscope',exact:true}).click();assert(await page.locator('body').evaluate(e=>e.classList.contains('scoping')));await page.keyboard.press('Escape');assert(!await page.locator('body').evaluate(e=>e.classList.contains('scoping')));
await page.getByRole('button',{name:'7',exact:true}).click();await page.getByRole('button',{name:'Climb the ladder',exact:true}).click();await page.getByRole('button',{name:'Back to the trench',exact:true}).waitFor({timeout:10000});await page.getByRole('button',{name:'Back to the trench',exact:true}).click();
await page.waitForFunction(()=>getComputedStyle(document.getElementById('fade')).opacity==='0',null,{timeout:2000});
if(local&&width===1366){
for(const [name,key] of [['m1917','m1917'],['adrian','adrian'],['periscope','periscope']]){
await page.evaluate(({name,key})=>{let q=window.__observationQA,t=name==='periscope'?q.periscope:q.helmets[key][0],c=q.camera.clone();const p=t.position.clone();p.y+=name==='periscope'?.78:.04;c.clearViewOffset();c.aspect=1366/768;c.updateProjectionMatrix();c.position.copy(p).add(new q.Vector(name==='periscope'?.6:.32,name==='periscope'?.12:.26,name==='periscope'?1.8:.48));c.lookAt(p);q.renderer.render=q.renderer.render.__original||q.renderer.render;let original=q.renderer.render.bind(q.renderer);let fn=(s)=>original(s,c);fn.__original=q.renderer.render;q.renderer.render=fn;},{name,key});
await page.waitForTimeout(250);await page.screenshot({path:resolve(out,name+'-closeup.png')});
}}
assert.equal(errors.length,0,errors.join('\n'));assert.equal(warnings.length,0,warnings.join('\n'));results.push({width,status:'all models and 7 stops, periscope and ladder passed',errors,warnings});await page.close();
}
if(local)for(let index=0;index<3;index++){
const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[],warnings=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning'&&m.text().includes('WWI Blender'))warnings.push(m.text());});
await page.route('**/'+stems[index]+'_web.glb',r=>r.fulfill({status:404,body:'Synthetic unavailable model'}));
await page.goto(base+'/hubs/ush9-over-the-top.html',{waitUntil:'domcontentloaded'});
await page.waitForFunction(({keys,index})=>keys.every((k,i)=>document.getElementById('c').dataset[k]===(i===index?'fallback':'blender')),{keys,index},{timeout:30000});
await page.getByRole('button',{name:'Move up to the line',exact:true}).click();await page.getByRole('button',{name:'7',exact:true}).click();assert((await page.locator('#card').innerText()).toLowerCase().includes('stop 7 of 7'));assert.equal(errors.length,0,errors.join('\n'));assert.equal(warnings.length,1);results.push({missing:keys[index],status:'isolated fallback passed',warnings});await page.close();
}
console.log(JSON.stringify(results,null,2));
}finally{await browser.close();server.close();}
