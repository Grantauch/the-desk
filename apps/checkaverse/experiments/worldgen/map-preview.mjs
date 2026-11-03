// Standalone read-only map inspector for the Checklings 12-biome preproduction
// experiment. It writes an OFFLINE HTML preview only when run directly.
// It never imports or modifies the live game, student files, or game saves.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHUNK_SIZE, GENERATOR_VERSION, REGION_THEMES, createRegionSpec } from "./prototype.mjs";
import { makeLandmarkBlueprint, generateLandmarkChunk } from "./landmark-network.mjs";

const regionNames=Object.freeze({
  bramblefen_basin:"Bramblefen Basin",cindergear_expanse:"Cindergear Expanse",
  tempest_crown:"Tempest Crown",starfall_gloam:"Starfall Gloam",
  verdant_crown:"Verdant Crown",frostglass_reach:"Frostglass Reach",
  emberfall_caldera:"Emberfall Caldera",saltwind_coast:"Saltwind Coast",
  glassdune_wastes:"Glassdune Wastes",hollowdeep:"Hollowdeep",
  sungrass_steppe:"Sungrass Steppe",whisperwood:"Whisperwood"
});

export function buildPreviewData({ seed="checklings-preview-v1", size=256, regions=Object.keys(REGION_THEMES) }={}){
  if(typeof seed!=="string"||seed.length===0||seed.length>128)throw new TypeError("Seed is required");
  if(![256,512].includes(size))throw new RangeError("Preview map size must be 256 or 512");
  if(!Array.isArray(regions)||regions.length===0||new Set(regions).size!==regions.length){
    throw new TypeError("Expected unique region IDs");
  }
  const records=[];
  for(const id of regions){
    const spec=createRegionSpec(id,seed,size);
    const blueprint=makeLandmarkBlueprint(spec);
    const side=size/CHUNK_SIZE,rows=[];
    for(let cy=0;cy<side;cy++){
      const chunks=Array.from({length:side},(_,cx)=>generateLandmarkChunk(spec,blueprint,cx,cy));
      for(let dy=0;dy<CHUNK_SIZE;dy++){
        rows.push(chunks.map(c=>c.rows[dy]).join(""));
      }
    }
    records.push({id,name:regionNames[id],theme:spec.theme,types:spec.types,
      landmarks:blueprint.landmarks.map(({id,name,x,y})=>({id,name,x,y})),rows});
  }
  return {title:"Checklings world planning preview",generatorVersion:GENERATOR_VERSION,
    seed,size,regions:records,note:"OFFLINE PREPRODUCTION MAPS — not the live world or production art."};
}

export function buildPreviewHtml(options={}){
  const serialized=JSON.stringify(buildPreviewData(options))
    .replace(/</g,"\\u003c").replace(/>/g,"\\u003e").replace(/&/g,"\\u0026");
  const style=[
    "body{margin:0;background:#101821;color:#e8eff7;font:15px system-ui,-apple-system,Segoe UI,Arial,sans-serif}",
    "header{display:flex;align-items:center;gap:18px;flex-wrap:wrap;background:#192635;padding:16px 24px;border-bottom:1px solid #3b4a59}",
    "h1{margin:0;font-size:20px;letter-spacing:.02em}",
    "select,input{accent-color:#85bfaa;color:#f0f7fc;background:#273746;border:1px solid #526371;border-radius:6px;padding:8px}",
    "label{display:flex;align-items:center;gap:8px;font-size:13px}",
    "main{display:grid;grid-template-columns:minmax(0,1fr) 275px;min-height:calc(100vh - 110px)}",
    "canvas{width:100%;height:calc(100vh - 118px);display:block;touch-action:none;cursor:grab;image-rendering:pixelated}",
    "canvas:active{cursor:grabbing}",
    "aside{padding:20px;border-left:1px solid #374a58;background:#15212d;overflow:auto}",
    "h2{font-size:17px;margin:0 0 10px}h3{font-size:13px;margin:22px 0 7px;color:#b1c4cf}",
    "p,li{line-height:1.5;font-size:13px;color:#b7c7d1}",
    ".warn{color:#f2d391;font-size:12px;margin:8px 0}",
    ".note{font-size:12px;color:#8fa4b1}",
    ".legend{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px}",
    ".swatch{display:inline-block;width:11px;height:11px;border:1px solid #ffffff55;margin-right:6px;vertical-align:middle}",
    "#meta{font-size:13px;color:#d8e5ef;line-height:1.6}",
    "#landmarks{padding-left:18px}",
    "@media(max-width:820px){main{display:block}canvas{height:60vh}aside{border-left:0;border-top:1px solid #374a58}}"
  ].join("");
  const script=[
    "'use strict';",
    "const data=JSON.parse(document.getElementById('payload').textContent);",
    "const $=id=>document.getElementById(id);",
    "const palette={'.':'#86946b','P':'#c6ad80','L':'#f8d47e','B':'#b48c68',",
    " 'G':'#70aa65','W':'#427ca6','I':'#95d2e7','T':'#275c44',",
    " 'R':'#696d72','A':'#d5623f','C':'#786ca6','D':'#c4a870',",
    " 'F':'#bd944c','S':'#dbe7f0','H':'#a67a66'};",
    "const meanings={P:'Authored path',L:'Landmark',B:'Bridge',G:'Grassland',",
    " W:'Water',I:'Ice',T:'Forest',R:'Rock',A:'Ash or lava',C:'Crystal',",
    " D:'Sand',F:'Field',S:'Snow',H:'Industrial'};",
    "const picker=$('region');",
    "data.regions.forEach((r,i)=>{const o=document.createElement('option');",
    " o.value=String(i);o.textContent=r.name;picker.append(o)});",
    "const preview=$('map'),ctx=preview.getContext('2d',{alpha:false});",
    "const off=document.createElement('canvas');const offctx=off.getContext('2d');",
    "let active=0,zoom=3,ox=0,oy=0,drag=null;",
    "function buildMap(){const r=data.regions[active],n=data.size;",
    " off.width=n;off.height=n;const pixels=offctx.createImageData(n,n);",
    " const paletteRGB={};for(const [key,value] of Object.entries(palette)){",
    " paletteRGB[key]=[parseInt(value.slice(1,3),16),parseInt(value.slice(3,5),16),parseInt(value.slice(5,7),16)];}",
    " for(let y=0;y<n;y++)for(let x=0;x<n;x++){const rgb=paletteRGB[r.rows[y][x]]||[255,0,255];",
    " const i=(y*n+x)*4;pixels.data[i]=rgb[0];pixels.data[i+1]=rgb[1];",
    " pixels.data[i+2]=rgb[2];pixels.data[i+3]=255;}",
    " offctx.putImageData(pixels,0,0);",
    " $('meta').textContent=r.theme+' · '+r.types.join(' + ')+' · '+n+' × '+n+' tiles';",
    " $('landmarks').replaceChildren();",
    " r.landmarks.forEach(p=>{const li=document.createElement('li');",
    " li.textContent=p.name+' ('+p.x+', '+p.y+')';$('landmarks').append(li)});}",
    "function frame(){const w=preview.clientWidth,h=preview.clientHeight;",
    " const pixelRatio=Math.min(window.devicePixelRatio||1,2);",
    " const newW=Math.round(w*pixelRatio),newH=Math.round(h*pixelRatio);",
    " if(preview.width!==newW||preview.height!==newH){preview.width=newW;preview.height=newH;}",
    " ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);ctx.imageSmoothingEnabled=false;",
    " ctx.fillStyle='#0a1016';ctx.fillRect(0,0,w,h);",
    " ctx.drawImage(off,ox,oy,off.width*zoom,off.height*zoom);",
    " if($('labels').checked){ctx.textBaseline='bottom';ctx.font='12px system-ui';",
    " for(const p of data.regions[active].landmarks){const x=ox+p.x*zoom,y=oy+p.y*zoom;",
    " if(x< -150||x>w+150||y< -100||y>h+100)continue;",
    " ctx.fillStyle='#f8d47e';ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();",
    " const width=ctx.measureText(p.name).width+10;ctx.fillStyle='#10202edb';",
    " ctx.fillRect(x+6,y-16,width,18);ctx.fillStyle='#fff6cb';ctx.fillText(p.name,x+11,y-1);}}}",
    "function center(){zoom=Number($('zoom').value);ox=(preview.clientWidth-data.size*zoom)/2;",
    " oy=(preview.clientHeight-data.size*zoom)/2;frame();}",
    "function selectRegion(){active=Number(picker.value);buildMap();center();}",
    "picker.addEventListener('change',selectRegion);",
    "$('zoom').addEventListener('input',()=>{zoom=Number($('zoom').value);center();});",
    "$('labels').addEventListener('change',frame);",
    "$('center').addEventListener('click',center);",
    "preview.addEventListener('pointerdown',e=>{preview.setPointerCapture(e.pointerId);",
    " drag={x:e.clientX,y:e.clientY,ox,oy};});",
    "preview.addEventListener('pointermove',e=>{if(drag){ox=drag.ox+e.clientX-drag.x;",
    " oy=drag.oy+e.clientY-drag.y;frame();}",
    " const rect=preview.getBoundingClientRect(),x=Math.floor((e.clientX-rect.left-ox)/zoom),",
    " y=Math.floor((e.clientY-rect.top-oy)/zoom);",
    " const code=data.regions[active].rows[y]?.[x];",
    " $('coords').textContent=code===undefined?'Outside map':",
    " 'Tile '+x+', '+y+' · '+(meanings[code]||'Terrain '+code);});",
    "preview.addEventListener('pointerup',()=>{drag=null});",
    "preview.addEventListener('pointercancel',()=>{drag=null});",
    "preview.addEventListener('wheel',e=>{e.preventDefault();",
    " $('zoom').value=String(Math.max(1,Math.min(12,Number($('zoom').value)+(e.deltaY<0?1:-1))));",
    " zoom=Number($('zoom').value);frame();},{passive:false});",
    "const legend=$('legend');for(const [symbol,name] of Object.entries(meanings)){",
    " const d=document.createElement('div');const swatch=document.createElement('span');",
    " swatch.className='swatch';swatch.style.backgroundColor=palette[symbol];",
    " d.append(swatch,document.createTextNode(name));legend.append(d)}",
    "window.addEventListener('resize',frame);selectRegion();"
  ].join("\n");
  return [
    "<!doctype html><html lang='en'><head><meta charset='utf-8'>",
    "<meta name='viewport' content='width=device-width,initial-scale=1'>",
    "<title>Checklings · procedural biome inspector</title>",
    "<style>"+style+"</style></head><body>",
    "<header><h1>Checklings · World Inspector</h1>",
    "<label>Biome <select id='region'></select></label>",
    "<label>Zoom <input id='zoom' type='range' min='1' max='12' value='3'></label>",
    "<label><input id='labels' type='checkbox' checked> Landmark labels</label>",
    "<button id='center' type='button'>Center map</button></header>",
    "<main><canvas id='map' width='900' height='650' aria-label='Read-only generated terrain preview'></canvas>",
    "<aside><h2>Biome blueprint</h2><div id='meta'></div>",
    "<p class='warn'>OFFLINE PREPRODUCTION VIEWER. These are symbolic tile colors, not final pixel art.</p>",
    "<p>Drag to pan, scroll or adjust the slider to zoom. No student accounts, saves or server connection.</p>",
    "<h3>Landmarks</h3><ol id='landmarks'></ol>",
    "<h3>Terrain legend</h3><div id='legend' class='legend'></div>",
    "<h3>Pointer</h3><div class='note' id='coords'>Move over the map</div>",
    "<p class='note'>Permanent seed and generator revision: "+
      String(options.seed??"checklings-preview-v1").replace(/[<>&]/g,"")+" / "+GENERATOR_VERSION+"</p>",
    "</aside></main>",
    "<script id='payload' type='application/json'>"+serialized+"</script>",
    "<script>"+script+"</script>",
    "</body></html>"
  ].join("\n");
}

const isMain=process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
  const filename=path.resolve(process.argv[2]??"checklings-world-preview.html");
  const size=process.argv.includes("--512")?512:256;
  const html=buildPreviewHtml({size});
  fs.writeFileSync(filename,html,{encoding:"utf8",flag:"w"});
  process.stdout.write("Wrote OFFLINE preview: "+filename+" ("+html.length+" characters)\n");
}
