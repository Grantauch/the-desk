import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';

// Diagnostic only: do not publish or enable the old 9 MB model based on these renders.
const root = resolve('public');
const out = resolve('browser-results/robber-barons-trust-framing');
await mkdir(out, { recursive:true });
const html = String.raw`<!doctype html><html lang="en"><meta charset="utf-8"><title>Trust Formation 3D Framing Audit</title>
<style>
html,body{margin:0;background:#100f12;color:#efdfba;font:16px/1.5 system-ui,sans-serif}
main{padding:20px} .pairs{display:grid;grid-template-columns:1fr 1fr;gap:16px}
figure{margin:0}canvas{display:block;width:100%;height:auto;aspect-ratio:16/9;border:1px solid #6d5a3c;background:#151a19}
figcaption{padding:10px}#fallback{max-width:380px;display:block}
</style>
<script type="importmap">{"imports":{"three":"/hubs/robber-barons-vfx/vendor/three/build/three.module.js","three/addons/":"/hubs/robber-barons-vfx/vendor/three/examples/jsm/"}}</script>
<main><h1>Trust Formation — isolated model framing</h1><div class="pairs">
<figure><canvas id="current" width="768" height="432"></canvas><figcaption>Original full-ground framing</figcaption></figure>
<figure><canvas id="subject" width="768" height="432"></canvas><figcaption>Candidate subject framing (diagnostic only)</figcaption></figure>
</div><img id="fallback" src="/hubs/robber-barons-vfx/trust-formation-fast-classroom.webp" alt="Existing animated fallback" />
<div id="status" role="status">Loading asset…</div>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
function frameBox(o){const b=new THREE.Box3().setFromObject(o);return {min:b.min.toArray(),max:b.max.toArray(),center:b.getCenter(new THREE.Vector3()).toArray(),size:b.getSize(new THREE.Vector3()).toArray()};}
try{
const gltf=await new GLTFLoader().loadAsync('/hubs/robber-barons-vfx/trust-formation-animation-v1.glb');
const model=gltf.scene;
const full=new THREE.Box3().setFromObject(model);
const fullSize=full.getSize(new THREE.Vector3()),fullCenter=full.getCenter(new THREE.Vector3());
const fullSpan=Math.max(fullSize.x,fullSize.y,fullSize.z);
let bodyBox=new THREE.Box3(), bodies=0;
const meshes=[];
model.updateMatrixWorld(true);
model.traverse(o=>{
 if(!o.isMesh)return;
 const b=new THREE.Box3().setFromObject(o),size=b.getSize(new THREE.Vector3());
 const plane=size.y<fullSpan*0.015&&size.x>fullSpan*.45&&size.z>fullSpan*.45;
 meshes.push({name:o.name,triangles:o.geometry?.index?o.geometry.index.count/3:o.geometry?.attributes?.position?.count/3,
  size:size.toArray(),center:b.getCenter(new THREE.Vector3()).toArray(),excludeAsGround:plane});
 if(!plane && Math.max(size.x,size.y,size.z)>fullSpan*.007){bodyBox.union(b);bodies++;}
});
if(!bodies)bodyBox.copy(full);
const subCenter=bodyBox.getCenter(new THREE.Vector3()),subSize=bodyBox.getSize(new THREE.Vector3());
const subSpan=Math.max(subSize.x,subSize.y,subSize.z);
const scene=new THREE.Scene();
scene.background=new THREE.Color('#131a1a');
scene.add(model);
scene.add(new THREE.HemisphereLight(0xffddb0,0x07100c,1.55));
const key=new THREE.DirectionalLight(0xffb45c,3.4);key.position.set(6,8,8);scene.add(key);
const fill=new THREE.DirectionalLight(0x58738a,1.25);fill.position.set(-7,3,4);scene.add(fill);
const rim=new THREE.PointLight(0xe65318,2.2,40);rim.position.set(0,7,-5);scene.add(rim);
function camera(target,span){
 const c=new THREE.PerspectiveCamera(38,768/432,Math.max(.01,span*.001),span*30);
 c.position.copy(target).add(new THREE.Vector3(span*.72,span*.52,span*1.12));c.lookAt(target);
 return c;
}
const ca=camera(fullCenter,fullSpan),cb=camera(subCenter,subSpan);
function renderer(id){const c=document.getElementById(id);return new THREE.WebGLRenderer({canvas:c,antialias:true,alpha:false,preserveDrawingBuffer:true});}
const ra=renderer('current'),rb=renderer('subject');
ra.setSize(768,432,false);rb.setSize(768,432,false);
const mixer=gltf.animations?.length?new THREE.AnimationMixer(model):null;
if(mixer)gltf.animations.forEach(clip=>{const a=mixer.clipAction(clip);a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;a.play()});
function render(t){if(mixer)mixer.setTime(t);ra.render(scene,ca);rb.render(scene,cb);}
render(0.2);
window.__trustRenderAt=t=>{render(t)};
window.__trustAudit={ready:true,full:frameBox(model),body:{center:subCenter.toArray(),size:subSize.toArray()},fullSpan,subSpan,meshes,animations:(gltf.animations||[]).map(a=>({name:a.name,duration:a.duration}))};
document.getElementById('status').textContent='Model loaded. '+meshes.length+' meshes. Target dimensions '+subSize.toArray().map(v=>v.toFixed(2)).join(' × ')+'.';
}catch(error){window.__trustAudit={ready:false,error:String(error.stack||error)};document.getElementById('status').textContent=String(error);}
</script></main></html>`;
const server=createServer(async(req,res)=>{
 try {
  const pathname=new URL(req.url,'http://local').pathname;
  if(pathname==='/preview'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);return}
  const path=resolve(root,'.'+decodeURIComponent(pathname));
  if(!path.startsWith(root+sep))throw Error('invalid path');
  const bytes=await readFile(path);
  const ext=extname(path);
  const ct=ext==='.js'?'application/javascript':ext==='.glb'?'model/gltf-binary':ext==='.webp'?'image/webp':'application/octet-stream';
  res.writeHead(200,{'Content-Type':ct});res.end(bytes);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1580,height:1060}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url='http://127.0.0.1:'+server.address().port+'/preview';
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__trustAudit!==undefined,null,{timeout:45000});
 const info=await page.evaluate(()=>window.__trustAudit);
 await writeFile(resolve(out,'model-bounds.json'),JSON.stringify({...info,browserErrors:errors},null,2));
 if(!info.ready)throw new Error('GLB failed: '+info.error);
 for(const t of [0.2,1.5,3.5]){
  await page.evaluate(time=>window.__trustRenderAt(time),t);
  await page.waitForTimeout(180);
  const tag=String(t).replace('.','-');
  await page.locator('#current').screenshot({path:resolve(out,'original-'+tag+'.png')});
  await page.locator('#subject').screenshot({path:resolve(out,'candidate-'+tag+'.png')});
 }
 await page.screenshot({path:resolve(out,'comparison.png'),fullPage:true});
 console.log('TRUST_GLTF_AUDIT ready meshes='+info.meshes.length+' spans='+info.fullSpan.toFixed(3)+','+info.subSpan.toFixed(3)+' animations='+info.animations.length);
 console.log('MESHES',JSON.stringify(info.meshes.slice(0,50)));
 if(errors.length)throw new Error('Browser errors: '+errors.join('; '));
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
