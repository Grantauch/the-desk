import { createServer } from 'node:http';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep, basename } from 'node:path';
import { chromium } from 'playwright';

// Read-only viewport/network discovery. It does not grant classroom login,
// complete assignments, press game controls, or request third-party resources.
const publicRoot = resolve('public');
const outDir = resolve('reports/visual-assets');
await mkdir(outDir, { recursive:true });
const mime = {
  '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'application/javascript; charset=utf-8','.mjs':'application/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8','.svg':'image/svg+xml',
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp',
  '.avif':'image/avif','.gif':'image/gif','.glb':'model/gltf-binary',
  '.mp4':'video/mp4','.webm':'video/webm','.woff2':'font/woff2',
};
const server = createServer(async(req,res)=>{
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://local.test').pathname);
    const path = resolve(publicRoot,'.'+pathname);
    if (!path.startsWith(publicRoot + sep)) throw new Error('not in public');
    const file = await readFile(path);
    res.writeHead(200, {'Content-Type':mime[extname(path).toLowerCase()]||'application/octet-stream'});
    res.end(file);
  } catch {res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const allPaths=(await readdir(resolve(publicRoot,'hubs'))).filter(x=>x.endsWith('.html')).sort();
const priorityNames=['ush9-the-arsenal.html','ush9-over-the-top.html','ush9-over-the-somme.html','ush9-over-there.html','hh-down-the-rabbit-hole.html','robber-barons.html','blacktop-kings.html'];
const audioVisual=/\.(?:glb|gltf|png|jpe?g|webp|avif|gif|svg|mp4|webm|ogg|wav|mp3)$/i;
const findings=[], loaded=new Set();
let browser;
async function inspect(file,viewport){
  const context=await browser.newContext({viewport,reducedMotion:'reduce',serviceWorkers:'block'});
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.origin===origin?route.continue():route.fulfill({status:503,body:'Offline visual audit'});
  });
  const page=await context.newPage();
  page.setDefaultNavigationTimeout(12000);
  page.setDefaultTimeout(3500);
  const result={file,viewport:viewport.width,status:null,rendered:false,localAssets:[],assetErrors:[],pageErrors:[],brokenImages:[],altMissing:[],overflow:false};
  const assets=new Set();
  page.on('response',response=>{
    const url=new URL(response.url());
    if(url.origin!==origin)return;
    if(audioVisual.test(url.pathname)){assets.add(url.pathname);if(response.status()>=400)result.assetErrors.push(url.pathname+' HTTP '+response.status());}
  });
  page.on('requestfailed',request=>{
    const url=new URL(request.url());
    if(url.origin===origin&&audioVisual.test(url.pathname))result.assetErrors.push(url.pathname+': '+request.failure()?.errorText);
  });
  page.on('pageerror',e=>{
    if(result.pageErrors.length<8)result.pageErrors.push(String(e.message).slice(0,260));
  });
  try{
    const response=await page.goto(origin+'/hubs/'+encodeURIComponent(file),{waitUntil:'domcontentloaded',timeout:12000});
    result.status=response?.status()??0;
    await page.waitForTimeout(500);
    for(const fraction of [0,0.5,1]){
      await page.evaluate(f=>window.scrollTo(0,Math.max(0,document.documentElement.scrollHeight-innerHeight)*f),fraction).catch(()=>{});
      await page.waitForTimeout(160);
    }
    const dom=await page.evaluate(()=>{
      const imgs=[...document.images];
      const boxes=imgs.filter(x=>x.complete&&x.naturalWidth===0&&x.currentSrc).map(x=>x.currentSrc).slice(0,12);
      const alts=imgs.filter(x=>!x.hasAttribute('alt')).map(x=>x.currentSrc||x.src).slice(0,12);
      return {title:document.title,broken:boxes,alts,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2,bodyLength:document.body?.innerText?.length||0};
    });
    result.title=dom.title;result.rendered=dom.bodyLength>20;result.brokenImages=dom.broken.filter(src => new URL(src).origin === origin);
    result.externalImagesUnavailable=dom.broken.filter(src => new URL(src).origin !== origin);
    result.altMissing=dom.alts;result.overflow=dom.overflow;
  }catch(e){result.navigationError=String(e.message).slice(0,300);}
  finally{
    result.localAssets=[...assets].sort();
    result.localAssets.forEach(x=>loaded.add(x));
    await context.close();
    findings.push(result);
    console.log('RENDER_AUDIT',file,viewport.width,'HTTP',result.status,'media',assets.size,'errors',result.assetErrors.length,'pageErrors',result.pageErrors.length);
  }
}
try{
  browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const file of allPaths) await inspect(file,{width:1366,height:768});
  for(const file of allPaths) await inspect(file,{width:390,height:844});
  for(const file of priorityNames.filter(x=>allPaths.includes(x))) await inspect(file,{width:320,height:740});
}finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
const publicMedia=[];
async function findMedia(dir,prefix=''){
  for(const ent of await readdir(dir,{withFileTypes:true})){
    const rel=prefix+'/'+ent.name;
    if(ent.isDirectory()) await findMedia(resolve(dir,ent.name),rel);
    else if(audioVisual.test(ent.name))publicMedia.push(rel);
  }
}
await findMedia(publicRoot);
const neverRequested=publicMedia.filter(x=>!loaded.has(x));
const problems=findings.filter(x=>x.status!==200||x.assetErrors.length||x.pageErrors.length||x.brokenImages.length||x.overflow);
const report={generatedAt:new Date().toISOString(),routesTested:allPaths.length,viewportRuns:findings.length,loadedPublicMedia:loaded.size,publicMediaFiles:publicMedia.length,neverRequestedDuringAudit:neverRequested,problems,findings};
await writeFile(resolve(outDir,'visual-runtime.json'),JSON.stringify(report,null,2)+'\n');
const lines=[
  '# Visual network and viewport audit',
  '',
  'This is **first-load/scroll coverage**, not proof of never-used assets. Deferred story scenes, choices, animations and computed files can load later. External origins were blocked; no student logins or game interactions occurred.',
  '',
  '| Metric | Count |','| --- | ---: |',
  '| Root-level HTML experiences | '+allPaths.length+' |',
  '| Browser viewport visits | '+findings.length+' |',
  '| Media paths actually requested | '+loaded.size+' |',
  '| Public media files not requested in this pass | '+neverRequested.length+' |',
  '| Page visits with possible problems | '+problems.length+' |',
  '',
  '## Potential visible problems',
  '| Page | Viewport | HTTP | Broken local assets | Page errors | Horizontal overflow |',
  '| --- | ---: | ---: | ---: | ---: | --- |',
  ...problems.slice(0,100).map(x=>'| '+x.file+' | '+x.viewport+' | '+x.status+' | '+x.assetErrors.length+' | '+x.pageErrors.length+' | '+(x.overflow?'yes':'no')+' |'),
  '',
  '## Media not requested on initial load or scroll (not proven orphaned)',
  ...neverRequested.slice(0,150).map(x=>'- '+x),
  '',
  'See visual-runtime.json for URLs, error messages, and complete per-page network evidence.'
];
await writeFile(resolve(outDir,'visual-runtime.md'),lines.join('\n')+'\n');
console.log('RENDER_AUDIT_SUMMARY routes='+allPaths.length+' visits='+findings.length+' loaded='+loaded.size+' notRequested='+neverRequested.length+' possibleProblems='+problems.length);
for(const issue of problems.slice(0,22))console.log('POSSIBLE_PROBLEM',issue.file,issue.viewport,issue.status,issue.assetErrors.slice(0,2).join(';'),issue.pageErrors.slice(0,1).join(';'));
