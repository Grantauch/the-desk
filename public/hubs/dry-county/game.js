'use strict';
(() => {
const $=id=>document.getElementById(id), canvas=$('game'), ctx=canvas.getContext('2d',{alpha:false});
const mini=$('minimap'), mc=mini.getContext('2d');
const SHOP=window.DryShops;
let interior=null,parkedVehicle=null;
const WLD=window.DryWorld, WORLD=WLD.width, WORLD_H=WLD.height, TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)), lerp=(a,b,t)=>a+(b-a)*t;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y), rand=(a,b)=>a+Math.random()*(b-a), pick=a=>a[Math.floor(Math.random()*a.length)];
const money=n=>'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const norm=a=>Math.atan2(Math.sin(a),Math.cos(a));
let seed=1926;function seeded(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
const sr=(a,b)=>a+seeded()*(b-a);
const places=WLD.places;
const district=WLD.district;
const weapons=[
 {name:'M1911',short:'M1911',price:0,mag:8,reserve:64,damage:30,rate:.27,reload:1.15,spread:.035,bullets:1},
 {name:'Coach Gun',short:'COACH GUN',price:35,mag:2,reserve:40,damage:22,rate:.72,reload:1.5,spread:.18,bullets:7},
 {name:'Thompson M1921',short:'THOMPSON',price:200,mag:30,reserve:180,damage:21,rate:.085,reload:1.8,spread:.065,bullets:1}
];
const carTypes={
 sedan:{name:'1926 Standard Six',color:'#3e6763',max:230,accel:180,turn:2.35,hp:160,price:0},
 coupe:{name:'Veloce Sport Coupe',color:'#9a4e3b',max:315,accel:235,turn:2.65,hp:150,price:620},
 truck:{name:'Ironclad Delivery',color:'#65705e',max:206,accel:145,turn:1.85,hp:310,price:450},
 custom:{name:'Blackbird Special',color:'#252d32',max:355,accel:270,turn:2.65,hp:230,price:1200},
 police:{name:'Police Pursuit',color:'#283438',max:275,accel:210,turn:2.4,hp:160,price:0},
 agent:{name:'Dry Agent Sedan',color:'#121719',max:320,accel:250,turn:2.55,hp:210,price:0}
};
const MASS={sedan:1,coupe:.9,truck:1.9,custom:1.15,police:1.25,agent:1.35};
const initial=()=>({v:1,cash:25,xp:0,jobs:0,weapon:0,ownedWeapons:[0],ownedCars:['sedan'],car:'sedan',engine:0,armor:0,grip:0,businesses:[],income:0,story:{},feedback:[],jugs:[],trials:{},settings:{sound:true,music:true},stats:{kills:0,distance:0,escapes:0,earnings:0,bestStreak:0,lives:0,busts:0,jumps:0,smashed:0},daily:{date:'',done:0,claimed:false}});
let save=initial(), storageOK=true,airBridge=null,airOps=null;
try{const raw=JSON.parse(localStorage.getItem('drycounty-save-v1'));if(raw&&raw.v===1){save={...initial(),...raw,stats:{...initial().stats,...raw.stats},daily:{...initial().daily,...raw.daily},settings:{...initial().settings,...raw.settings},trials:{...raw.trials},jugs:Array.isArray(raw.jugs)?raw.jugs:[]}}}catch(e){storageOK=false}
function dailyDate(){return new Date().toLocaleDateString('en-CA')}
function refreshDaily(){if(save.daily.date!==dailyDate())save.daily={date:dailyDate(),done:0,claimed:false}}
refreshDaily();
function persist(){if(airBridge)save.aircraft=airBridge.snapshot();try{localStorage.setItem('drycounty-save-v1',JSON.stringify(save))}catch(e){if(storageOK)toast('Browser storage is unavailable. Progress will last for this session.');storageOK=false}}
let w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio||1,1.5),zoom=1;
let baseZoom=1,zoomDyn=1;function resize(){w=innerWidth;h=innerHeight;dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=w*dpr;canvas.height=h*dpr;baseZoom=clamp(Math.min(w/1180,h/740),.72,1.16);zoom=baseZoom*zoomDyn;ctx.setTransform(dpr,0,0,dpr,0,0)}
addEventListener('resize',resize);resize();
let mode='title',started=false,modal='',tabName='equipment',elapsed=0,last=0,frame=0,shake=0,flash=0,toastTimer=0,saveTimer=0,empireTimer=0,heat=0,spawnTimer=0,escapeGrace=0,combo=0,comboTimer=0,policeSeen=false;
let cars=[],enemies=[],peds=[],bullets=[],particles=[],skids=[],pickups=[],jobs=[],job=null,interaction=null;
let activeElapsed=0;
let smoke=[],debris=[],blastRings=[],flames=[],flashes=[],scorches=[],npcs=[],conversation=null,lead=null,encounterTimer=28,lifeStart=0,lifeJobs=0,lifeMoney=0,deathReport=null,deathPending=false;
const player={x:places[0].x,y:places[0].y, vx:0,vy:0,a:-Math.PI/2,hp:100,car:null,air:null,ammo:weapons[save.weapon].mag,reserve:weapons[save.weapon].reserve,reload:0,shot:0,invincible:0,step:0};
const camera={x:places[0].x,y:places[0].y,lookX:0,lookY:0};
const mouse={x:w/2,y:h/2,down:false,active:false},keys={},touch={x:0,y:0,fire:false,brake:false,airUp:false,airDown:false};
const isTouch=matchMedia('(pointer:coarse)').matches || new URLSearchParams(location.search).has('touch');
const ammoPacks=weapons.map(a=>({ammo:a.mag,reserve:a.reserve}));
let audioCtx=null,soundOn=save.settings.sound!==false,musicOn=save.settings.music!==false,master=null,sfxBus=null,musicBus=null,engineOsc=null,engineGain=null,engineFilter=null,sirenOsc=null,sirenGain=null,noiseBuf=null,musicNext=0,musicStep=0;
function initAudio(){if(audioCtx)return true;try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;audioCtx=new AC();master=audioCtx.createGain();master.gain.value=.85;master.connect(audioCtx.destination);sfxBus=audioCtx.createGain();sfxBus.connect(master);musicBus=audioCtx.createGain();musicBus.gain.value=musicOn?.5:0;musicBus.connect(master);
 engineOsc=audioCtx.createOscillator();engineOsc.type='sawtooth';engineOsc.frequency.value=40;engineFilter=audioCtx.createBiquadFilter();engineFilter.type='lowpass';engineFilter.frequency.value=420;engineGain=audioCtx.createGain();engineGain.gain.value=0;engineOsc.connect(engineFilter);engineFilter.connect(engineGain);engineGain.connect(sfxBus);engineOsc.start();
 sirenOsc=audioCtx.createOscillator();sirenOsc.type='square';sirenOsc.frequency.value=620;const sf=audioCtx.createBiquadFilter();sf.type='lowpass';sf.frequency.value=1500;sirenGain=audioCtx.createGain();sirenGain.gain.value=0;sirenOsc.connect(sf);sf.connect(sirenGain);sirenGain.connect(sfxBus);sirenOsc.start();
 noiseBuf=audioCtx.createBuffer(1,audioCtx.sampleRate,audioCtx.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;musicNext=audioCtx.currentTime+.1;initBeds();return true}catch(e){audioCtx=null;return false}}
function soundLabel(){return soundOn?'SOUND ON ●':'SOUND OFF ◯'}
function setSound(on){soundOn=on;save.settings.sound=on;if(on&&initAudio())audioCtx.resume();if(!on&&engineGain){engineGain.gain.value=0;sirenGain.gain.value=0}$('soundTitle').textContent=soundLabel();persist()}
function setMusic(on){musicOn=on;save.settings.music=on;if(on&&initAudio())audioCtx.resume();if(musicBus)musicBus.gain.value=on?.5:0;persist()}
function enableAudio(){setSound(!soundOn)}
function noise(t,dur,type,freq,vol,freqEnd){const ac=audioCtx,src=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();src.buffer=noiseBuf;f.type=type;f.frequency.setValueAtTime(freq,t);if(freqEnd)f.frequency.exponentialRampToValueAtTime(freqEnd,t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);src.connect(f);f.connect(g);g.connect(sfxBus);src.start(t,Math.random()*.5);src.stop(t+dur+.05)}
function tone(t,dur,type,freq,vol,freqEnd,bus){const ac=audioCtx,o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(freqEnd)o.frequency.exponentialRampToValueAtTime(freqEnd,t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(bus||sfxBus);o.start(t);o.stop(t+dur+.05)}
function sound(type,vol=1){if(!soundOn||!audioCtx||audioCtx.state!=='running')return;try{const t=audioCtx.currentTime;switch(type){
 case'shot':noise(t,.14,'bandpass',1400,.32*vol,300);tone(t,.12,'sine',140,.25*vol,40);break;
 case'tommy':noise(t,.07,'bandpass',1800,.22*vol,500);tone(t,.06,'square',110,.07*vol,50);break;
 case'shotgun':noise(t,.32,'lowpass',2600,.45*vol,200);tone(t,.2,'sine',90,.35*vol,30);break;
 case'enemyshot':noise(t,.1,'bandpass',900,.12*vol,250);break;
 case'cash':tone(t,.09,'sine',880,.12);tone(t+.08,.18,'sine',1320,.12);break;
 case'coin':tone(t,.07,'square',1170,.05);tone(t+.06,.12,'square',1560,.05);break;
 case'crash':noise(t,.35*vol+.08,'lowpass',1200,.4*Math.min(1,vol),120);tone(t,.2,'triangle',90,.25*Math.min(1,vol),30);break;
 case'smash':noise(t,.18,'highpass',900,.22,3000);noise(t,.1,'lowpass',500,.2);break;
 case'glass':noise(t,.25,'highpass',3000,.15,7000);break;
 case'explode':noise(t,1.3,'lowpass',1800,.75,60);tone(t,.6,'sine',70,.5,25);break;
 case'ramp':noise(t,.12,'lowpass',400,.25);tone(t,.25,'triangle',220,.08,520);break;
 case'land':noise(t,.22,'lowpass',300,.45,80);tone(t,.18,'sine',80,.3,35);break;
 case'horn':tone(t,.45,'square',392,.07);tone(t,.45,'square',494,.06);break;
 case'check':tone(t,.08,'square',784,.08);tone(t+.08,.16,'square',1046,.08);break;
 case'go':tone(t,.4,'square',1046,.1);break;
 case'beep':tone(t,.18,'square',523,.08);break;
 case'alert':tone(t,.12,'sawtooth',300,.09,620);tone(t+.13,.12,'sawtooth',300,.09,620);break;
 case'busted':tone(t,.25,'sawtooth',392,.1);tone(t+.25,.25,'sawtooth',330,.1);tone(t+.5,.6,'sawtooth',262,.1,180);break;
 case'spray':noise(t,1.1,'highpass',2500,.12);break;
 case'thud':noise(t,.18,'lowpass',260,.4*vol,90);tone(t,.12,'sine',95,.25*vol,40);break;
 case'step':noise(t,.05,'bandpass',raining()?1600:900,.035,null);break;
 case'shift':tone(t,.06,'sawtooth',160,.03,90);break;
 case'ricochet':tone(t,.18,'sine',2400,.03,900);break;
 case'thunder':noise(t,2.6,'lowpass',260,.55,60);noise(t+.1,1.2,'lowpass',900,.18,120);break;
 case'trainhorn':for(const f of [277,349,415])tone(t,1.3,'sawtooth',f,.035,null);for(const f of [277,349,415])tone(t+1.5,.8,'sawtooth',f,.03,null);break;
 case'bell':tone(t,.35,'sine',1480,.06*vol,null);tone(t,.35,'sine',2210,.03*vol,null);break;
 case'scrape':noise(t,.12,'highpass',2600,.07,5000);break;
 case'jug':tone(t,.1,'triangle',523,.12);tone(t+.1,.1,'triangle',659,.12);tone(t+.2,.3,'triangle',784,.12);break;
 default:tone(t,.05,'square',600,.04)}}catch(e){}}
// A quiet swing loop: walking bass, ride cymbal, brushes and a few piano stabs over a 12-bar blues in B flat.
const BLUES=[0,5,0,0,5,5,0,0,7,5,0,7],midi=n=>440*Math.pow(2,(n-69)/12);
function musicTick(){if(!audioCtx||!musicOn||audioCtx.state!=='running')return;const beat=60/138;if(musicNext<audioCtx.currentTime-.3)musicNext=audioCtx.currentTime+.05;while(musicNext<audioCtx.currentTime+.2){const step=musicStep%8,bar=Math.floor(musicStep/8)%12,root=46+BLUES[bar],next=46+BLUES[(bar+1)%12],t=musicNext;
 if(step%2===0){const q=step/2,note=[root,root+4,root+7,next+(next>root?-1:1)][q];tone(t,beat*.9,'triangle',midi(note),.2,null,musicBus);tone(t,beat*.5,'sine',midi(note-12),.12,null,musicBus)}
 const hat=step%2===0||step%4===3;if(hat){const s=audioCtx.createBufferSource(),f=audioCtx.createBiquadFilter(),g=audioCtx.createGain();s.buffer=noiseBuf;f.type='highpass';f.frequency.value=7000;g.gain.setValueAtTime(step%4===0?.05:.035,t);g.gain.exponentialRampToValueAtTime(.001,t+.12);s.connect(f);f.connect(g);g.connect(musicBus);s.start(t,Math.random()*.5);s.stop(t+.15)}
 if(step===2||step===6){const s=audioCtx.createBufferSource(),f=audioCtx.createBiquadFilter(),g=audioCtx.createGain();s.buffer=noiseBuf;f.type='bandpass';f.frequency.value=2200;g.gain.setValueAtTime(.06,t);g.gain.exponentialRampToValueAtTime(.001,t+.18);s.connect(f);f.connect(g);g.connect(musicBus);s.start(t,Math.random()*.5);s.stop(t+.2)}
 if((step===3||step===7)&&(bar+step)%3!==1){for(const n of [root+16,root+22,root+26])tone(t,.16,'triangle',midi(n),.045,null,musicBus)}
 musicNext+=step%2===0?beat*2/3:beat/3;musicStep++}}
const map=document.createElement('canvas');map.width=WORLD;map.height=WORLD_H;const g=map.getContext('2d');
const buildings=[],lamps=[],trees=[],decor=[],buildingHash=new Map(),props=[],propHash=new Map(),ramps=[],jugs=[];
const CELL=128,cellKey=(x,y)=>Math.floor(x/CELL)+','+Math.floor(y/CELL);
function nearbyBuildings(x,y,r=40){const out=new Set();for(let ix=Math.floor((x-r)/CELL);ix<=Math.floor((x+r)/CELL);ix++)for(let iy=Math.floor((y-r)/CELL);iy<=Math.floor((y+r)/CELL);iy++)for(const b of buildingHash.get(ix+','+iy)||[])out.add(b);return out}
function addBuilding(b){buildings.push(b);for(let ix=Math.floor(b.x/CELL);ix<=Math.floor((b.x+b.w)/CELL);ix++)for(let iy=Math.floor(b.y/CELL);iy<=Math.floor((b.y+b.h)/CELL);iy++){const key=ix+','+iy;if(!buildingHash.has(key))buildingHash.set(key,[]);buildingHash.get(key).push(b)}}
function rect(x,y,bw,bh,c){g.fillStyle=c;g.fillRect(x,y,bw,bh)}
function trace(points){g.beginPath();g.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))g.lineTo(p.x,p.y)}
// Road frontages, land-use polygons and landmark footprints share the trace frame.
function landAt(x,y){return WLD.land.find(a=>pointInPolygon({x,y},a.points))}
function pointInPolygon(p,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside}return inside}
function clearLot(b,margin=8){
 if(b.x<50||b.y<50||b.x+b.w>WORLD-50||b.y+b.h>WORLD_H-50)return false;
 for(const p of places){if(!p.building||!p.door)continue;const dx=p.x-p.door.x,dy=p.y-p.door.y,steps=Math.ceil(Math.hypot(dx,dy)/8);for(let i=0;i<=steps;i++){const x=p.door.x+dx*i/Math.max(1,steps),y=p.door.y+dy*i/Math.max(1,steps);if(x>b.x-13&&x<b.x+b.w+13&&y>b.y-13&&y<b.y+b.h+13)return false}}
 if([...nearbyBuildings(b.x+b.w/2,b.y+b.h/2,Math.max(b.w,b.h)+12)].some(a=>b.x<a.x+a.w+5&&b.x+b.w>a.x-5&&b.y<a.y+a.h+5&&b.y+b.h>a.y-5))return false;
 for(let ix=0;ix<=4;ix++)for(let iy=0;iy<=4;iy++){const p={x:b.x+b.w*ix/4,y:b.y+b.h*iy/4},n=WLD.nearest(p);if(n.d<n.edge.road.width/2+margin)return false;if(WLD.railway.some((q,i,a)=>i&&projectOnSegment(p,a[i-1],q).d<22))return false}
 return true;
}
function plantTree(p,r){trees.push({...p,r,z:r*1.5,tone:Math.floor(seeded()*5)})}

// Material studies: baked once, projected onto the existing collision geometry.
function artRandom(seed){let n=seed>>>0;return()=>((n=(n*1664525+1013904223)>>>0)/4294967296)}
function roofMaterial(b){
 if(b.roofArt)return b.roofArt;
 const c=document.createElement('canvas');c.width=Math.ceil(b.w*2);c.height=Math.ceil(b.h*2);const q=c.getContext('2d');q.scale(2,2);
 const rnd=artRandom(Math.round(b.x*13+b.y*7)),base=b.gable?'#66594d':b.style==='workshop'?'#556c6b':b.style==='civic'?'#657f78':'#414e51';
 q.fillStyle=base;q.fillRect(0,0,b.w,b.h);
 if(b.gable){for(let y=0;y<b.h;y+=4)for(let x=-5;x<b.w;x+=7){const xx=x+(Math.floor(y/4)%2)*3.5;q.fillStyle=tint(base,.75+rnd()*.55);q.fillRect(xx,y,6.5,3.5);q.fillStyle='#e1c49a22';q.fillRect(xx,y,6, .5)}}
 else{for(let i=0;i<b.w*b.h*.8;i++){q.fillStyle=rnd()<.5?'#cdd1ba17':'#08131825';q.fillRect(rnd()*b.w,rnd()*b.h,.4+rnd()*1.2,.5)}
  q.strokeStyle='#14232980';q.lineWidth=.7;for(let x=8;x<b.w;x+=12){q.beginPath();q.moveTo(x,0);q.lineTo(x,b.h);q.stroke()}q.strokeStyle='#afbcac25';for(let y=10;y<b.h;y+=18){q.beginPath();q.moveTo(0,y);q.lineTo(b.w,y);q.stroke()}
  for(let i=0;i<3;i++){q.fillStyle='#8a9d8040';q.beginPath();q.ellipse(rnd()*b.w,rnd()*b.h,3+rnd()*7,2+rnd()*4,0,0,TAU);q.fill()}
 }
 b.roofArt=c;return c;
}
function texturePlane(image,points,alpha=1){const [a,b,,d]=points;ctx.save();ctx.globalAlpha=alpha;ctx.transform((b.x-a.x)/image.width,(b.y-a.y)/image.width,(d.x-a.x)/image.height,(d.y-a.y)/image.height,a.x,a.y);ctx.drawImage(image,0,0);ctx.restore()}
function streetPatina(){
 const rnd=artRandom(19261020);
 g.save();g.lineCap='butt';
 for(const road of WLD.roads)for(let i=1;i<road.points.length;i++){
  const a=road.points[i-1],b=road.points[i],len=dist(a,b),angle=Math.atan2(b.y-a.y,b.x-a.x);g.save();g.translate(a.x,a.y);g.rotate(angle);
  // Stone joints, gutter channels, iron drains and restrained puddle shapes.
  if(road.surface!=='gravel'){
   for(const side of [-1,1]){const edge=side*road.width/2;g.fillStyle='#13262a45';g.fillRect(0,edge-1,len,2);g.fillStyle='#e3d6b660';g.fillRect(0,edge+side*2,len,1);
    g.strokeStyle='#414c4550';g.lineWidth=.6;for(let x=10;x<len;x+=16){g.beginPath();g.moveTo(x,edge+side*3);g.lineTo(x,edge+side*10);g.stroke()}
    for(let x=45;x<len;x+=175){g.fillStyle='#233035';g.fillRect(x,edge-side*5,9,4);g.fillStyle='#849086';for(let k=1;k<8;k+=2)g.fillRect(x+k,edge-side*5,.7,4)}
   }
   for(let x=15;x<len;x+=22){const y=(rnd()-.5)*(road.width-12);g.fillStyle=rnd()<.45?'#a9c6bd15':'#101d2430';g.beginPath();g.ellipse(x,y,3+rnd()*10,1+rnd()*3,rnd(),0,TAU);g.fill()}
  }
  g.restore();
 }
 // Shadows belong to the ground, so roofs and traffic remain crisp above them.
 for(const b of buildings){g.fillStyle='#07151d48';g.beginPath();g.moveTo(b.x,b.y+b.h);g.lineTo(b.x+b.w,b.y+b.h);g.lineTo(b.x+b.w+b.z*.65,b.y+b.h+b.z*.48);g.lineTo(b.x+b.z*.65,b.y+b.h+b.z*.48);g.closePath();g.fill();g.fillStyle='#101b2045';g.fillRect(b.x-2,b.y-2,b.w+4,b.h+4)}
 g.restore();
}

function makeCity(){
 WLD.land=window.DryScenery.land.map(a=>({...a,points:a.points.map(p=>WLD.P(...p))}));
 rect(0,0,WORLD,WORLD_H,'#435644');
 // Fields and forest edges are authored shapes, not random blobs in city blocks.
 for(const a of WLD.land){g.fillStyle=a.color;trace(a.points);g.closePath();g.fill();g.save();trace(a.points);g.closePath();g.clip();
  const xs=a.points.map(p=>p.x),ys=a.points.map(p=>p.y),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
  if(a.kind==='field'){for(let x=left;x<right;x+=14){rect(x,top,3,bottom-top,'#d0b57930');rect(x+5,top,1,bottom-top,'#3f422c35')}}
  else if(a.kind==='wood'){for(let i=0;i<(right-left)*(bottom-top)/2400;i++){const x=sr(left,right),y=sr(top,bottom);g.fillStyle=pickSeed(['#294335','#3d5239','#4d5d3e','#5f6541']);g.beginPath();g.arc(x,y,sr(18,46),0,TAU);g.fill()}}
  g.restore();
 }
 // Small paper-like earth grain is cached once, with no per-frame effects cost.
 for(let i=0;i<14000;i++)rect(sr(0,WORLD),sr(0,WORLD_H),sr(1,3),1,'#e0c89312');
 for(const detail of window.DryScenery.details){if(detail.kind==='path'){g.strokeStyle='#b0a17d';g.lineWidth=detail.width;trace(detail.points.map(p=>WLD.P(...p)));g.stroke()}else{const [x,y,bw,bh]=detail.bounds,p=WLD.P(x,y);if(detail.kind==='orchard'){for(let xx=0;xx<bw;xx+=14)for(let yy=0;yy<bh;yy+=14)plantTree(WLD.P(x+xx,y+yy),11)}else rect(p.x,p.y,bw*4,bh*4,detail.kind==='yard'?'#8d8061':'#6f7d51')}}
 g.lineCap='round';g.lineJoin='round';
 // The ballast goes below the crossing surfaces; rails go above them.
 g.strokeStyle='#625f4b';g.lineWidth=36;trace(WLD.railway);g.stroke();
 for(const r of WLD.roads){g.strokeStyle=r.surface==='gravel'?'#9c8b68':'#938d75';g.lineWidth=r.width+22;trace(r.points);g.stroke()}
 for(const r of WLD.roads){g.strokeStyle=r.surface==='gravel'?'#766f56':'#b0a790';g.lineWidth=r.width+12;trace(r.points);g.stroke()}
 for(const r of WLD.roads){g.strokeStyle=r.surface==='gravel'?'#8a7d5e':r.surface==='paved'?'#37484d':'#505c55';g.lineWidth=r.width;trace(r.points);g.stroke()}
 // No modern highway striping: a weathered crown and wheel-worn gravel instead.
 for(const r of WLD.roads){g.strokeStyle=r.surface==='gravel'?'#b5a27a35':'#c2c3a31a';g.lineWidth=r.surface==='gravel'?r.width*.45:2;trace(r.points);g.stroke();
  for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],d=dist(a,b),ang=Math.atan2(b.y-a.y,b.x-a.x);for(let k=65;k<d;k+=r.major?190:330){const x=lerp(a.x,b.x,k/d),y=lerp(a.y,b.y,k/d),off=r.width/2+8;if(r.surface!=='gravel')lamps.push({x:x-Math.sin(ang)*off,y:y+Math.cos(ang)*off})}}
 }
 for(let i=1;i<WLD.railway.length;i++){const a=WLD.railway[i-1],b=WLD.railway[i],len=dist(a,b),ang=Math.atan2(b.y-a.y,b.x-a.x);for(let k=0;k<len;k+=13){const p={x:lerp(a.x,b.x,k/len),y:lerp(a.y,b.y,k/len)},n=WLD.nearest(p);g.save();g.translate(p.x,p.y);g.rotate(ang);rect(-2,-15,4,30,n.d<n.edge.road.width/2?'#a08c62':'#6c6045');g.restore()}}
 for(const off of [-7,7]){g.strokeStyle='#c1c0a5';g.lineWidth=2;const pts=WLD.railway.map((p,i,a)=>{const q=a[Math.min(i+1,a.length-1)],prev=a[Math.max(i-1,0)],ang=Math.atan2(q.y-prev.y,q.x-prev.x);return{x:p.x-Math.sin(ang)*off,y:p.y+Math.cos(ang)*off}});trace(pts);g.stroke()}
 const makeLot=l=>{const p=WLD.P(l.x,l.y);return{...l,x:p.x-l.w/2,y:p.y-l.h/2,color:l.roof,z:l.z*1.25,gable:['house','barn','chapel'].includes(l.style),landmark:l.sign,authored:true}};
 for(const l of window.DryScenery.lots){const b=makeLot(l);if(!clearLot(b))throw Error('Map footprint needs clearance: '+l.id);const p=places.find(p=>!p.hidden&&p.id===l.id);
  if(p){b.placeId=p.id;p.building=b;const n=WLD.nearest({x:b.x+b.w/2,y:b.y+b.h/2});p.x=n.x;p.y=n.y;const dx=p.x-(b.x+b.w/2),dy=p.y-(b.y+b.h/2),t=Math.min(b.w/2/(Math.abs(dx)||.001),b.h/2/(Math.abs(dy)||.001));p.door={x:b.x+b.w/2+dx*t,y:b.y+b.h/2+dy*t}}
  addBuilding(b);
 }
 // Houses follow street frontages and lot rhythm. Forests, fields, commons and
 // the carefully authored downtown blocks stay free of procedural infill.
 let serial=0;
 for(const e of WLD.edges){const angle=Math.atan2(e.b.y-e.a.y,e.b.x-e.a.x),vertical=Math.abs(Math.sin(angle))>.7;
  for(let k=36;k<e.d-26;k+=62){for(const side of [-1,1]){serial++;const broad=serial%4===0,bw=vertical?(broad?32:26):(broad?38:30),bh=vertical?(broad?38:30):(broad?30:24),off=e.road.width/2+(vertical?bw:bh)/2+12,cx=lerp(e.a.x,e.b.x,k/e.d)-Math.sin(angle)*off*side,cy=lerp(e.a.y,e.b.y,k/e.d)+Math.cos(angle)*off*side;
   const ref={x:(cx-900)/4,y:(cy-100)/4},area=landAt(cx,cy);if(area||ref.x<30||ref.x>1400||(ref.x>452&&ref.x<620&&ref.y>284&&ref.y<435))continue;
   const b={x:cx-bw/2,y:cy-bh/2,w:bw,h:bh,z:serial%5===0?38:29,color:pickSeed(['#797261','#707564','#826d57','#7b7a66']),wall:pickSeed(['#a99f7c','#9d9170','#b1a07e','#948b72']),gable:true,style:'house',front:angle+side*Math.PI/2};
   if(clearLot(b,8))addBuilding(b);
  }}
 }
 // Parcel lawns, gravel walks, loading aprons, and the real building footprint
 // also appear in the county map. Only the footprint is solid collision.
 for(const b of buildings){const center={x:b.x+b.w/2,y:b.y+b.h/2},n=WLD.nearest(center),door=b.placeId?places.find(p=>p.id===b.placeId).door:null;
  rect(b.x-4,b.y-4,b.w+8,b.h+8,b.gable?'#71805a':'#9a8e70');g.strokeStyle=b.gable?'#b2a483':'#a3997d';g.lineWidth=b.gable?6:13;trace([door||center,{x:n.x,y:n.y}]);g.stroke();rect(b.x+9,b.y+11,b.w,b.h,'#162c2955');rect(b.x,b.y,b.w,b.h,b.color);
  if(b.gable){g.strokeStyle='#d0ba8d40';g.lineWidth=1;g.strokeRect(b.x-5,b.y-5,b.w+10,b.h+10)}
 }
 for(const p of places.filter(p=>p.hidden)){const front=places.find(f=>f.id===p.front);p.x=front.x;p.y=front.y}
 for(let i=0;i<4000;i++){const p={x:sr(45,WORLD-45),y:sr(45,WORLD_H-45)},n=WLD.nearest(p),area=landAt(p.x,p.y);if(n.d<n.edge.road.width/2+25||(!area&&seeded()>.27)||area?.kind==='field'||area?.kind==='meadow'||area?.kind==='park')continue;if([...nearbyBuildings(p.x,p.y,28)].some(b=>p.x>b.x-20&&p.x<b.x+b.w+20&&p.y>b.y-20&&p.y<b.y+b.h+20))continue;plantTree(p,area?.kind==='wood'?sr(13,24):sr(9,15))}
 // Wooden loading ramps on long straight roads. Hit one fast and the car leaves the ground.
 const mainComp=WLD.nearest(places[0]).edge.a.component;for(const e of WLD.driveEdges.filter(e=>e.d>430&&e.road.width>=42).sort(()=>seeded()-.5)){if(ramps.length>=10)break;const t=sr(.4,.6),x=lerp(e.a.x,e.b.x,t),y=lerp(e.a.y,e.b.y,t);if(places.some(p=>!p.hidden&&Math.hypot(p.x-x,p.y-y)<300)||ramps.some(r=>Math.hypot(r.x-x,r.y-y)<750))continue;if(WLD.nodes.some(n=>Math.hypot(n.x-x,n.y-y)<130))continue;const a=Math.atan2(e.b.y-e.a.y,e.b.x-e.a.x)+(seeded()>.5?Math.PI:0),off=e.road.width/4,rx=x-Math.sin(a)*off,ry=y+Math.cos(a)*off;ramps.push({x:rx,y:ry,a,len:46,wid:Math.min(34,e.road.width*.5)})}
 for(const r of ramps){g.save();g.translate(r.x,r.y);g.rotate(r.a);g.fillStyle='#07121488';g.fillRect(-r.len/2+4,-r.wid/2+5,r.len,r.wid);g.fillStyle='#6d5638';g.fillRect(-r.len/2,-r.wid/2,r.len,r.wid);g.fillStyle='#8c7149';for(let i=-r.len/2+2;i<r.len/2;i+=7)g.fillRect(i,-r.wid/2,4,r.wid);g.fillStyle='#e0c37a';for(const k of [-8,4]){g.beginPath();g.moveTo(k,-7);g.lineTo(k+8,0);g.lineTo(k,7);g.lineTo(k+3,0);g.closePath();g.fill()}g.fillStyle='#2b241b';g.fillRect(r.len/2-3,-r.wid/2,3,r.wid);g.restore()}
 // Breakable roadside clutter: crates, barrels and the gas lamps themselves.
 for(const e of WLD.edges){if(e.d<120)continue;for(let k=60;k<e.d-50;k+=sr(150,320)){if(seeded()>.45)continue;const ang=Math.atan2(e.b.y-e.a.y,e.b.x-e.a.x),side=seeded()>.5?1:-1,off=(e.road.width/2+16)*side,x=lerp(e.a.x,e.b.x,k/e.d)-Math.sin(ang)*off,y=lerp(e.a.y,e.b.y,k/e.d)+Math.cos(ang)*off;if(places.some(p=>Math.hypot(p.x-x,p.y-y)<110)||ramps.some(r=>Math.hypot(r.x-x,r.y-y)<90))continue;if([...nearbyBuildings(x,y,30)].some(b=>x>b.x-14&&x<b.x+b.w+14&&y>b.y-14&&y<b.y+b.h+14))continue;const type=seeded()<.55?'crate':'barrel',n=type==='crate'&&seeded()>.6?2:1;for(let j=0;j<n;j++)addProp({type,x:x+j*14*Math.cos(ang),y:y+j*14*Math.sin(ang),a:sr(-.4,.4),r:type==='crate'?9:7})}}
 for(const l of lamps){l.type='lamp';l.r=4;addProp(l)}
 // Sixteen hidden jugs of moonshine, tucked off the road. Each one carries a newspaper clipping.
 for(let tries=0;jugs.length<16&&tries<6000;tries++){const x=sr(150,WORLD-150),y=sr(150,WORLD_H-150),n=WLD.nearest({x,y});if(n.d<50||n.d>150||n.edge.a.component!==mainComp)continue;if([...nearbyBuildings(x,y,30)].some(b=>x>b.x-12&&x<b.x+b.w+12&&y>b.y-12&&y<b.y+b.h+12))continue;if(jugs.some(j=>Math.hypot(j.x-x,j.y-y)<620)||places.some(p=>Math.hypot(p.x-x,p.y-y)<160))continue;jugs.push({id:jugs.length,x,y})}
 g.font='bold 12px Arial';g.textAlign='center';for(const r of WLD.roads.filter(r=>r.major)){const a=r.points[0],b=r.points[r.points.length-1],ang=Math.atan2(b.y-a.y,b.x-a.x);for(const t of [.25,.67]){g.save();g.translate(lerp(a.x,b.x,t),lerp(a.y,b.y,t));g.rotate(ang);g.fillStyle='#dfd3ad70';g.fillText(r.name,0,-r.width/2+17);g.restore()}}
 g.textAlign='left';
}
function projectOnSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy),0,1);return{x:a.x+dx*t,y:a.y+dy*t,d:Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t)}}
function pickSeed(a){return a[Math.floor(seeded()*a.length)]}
function addProp(p){p.broken=false;p.hp=p.hp||1;props.push(p);const key=cellKey(p.x,p.y);if(!propHash.has(key))propHash.set(key,[]);propHash.get(key).push(p)}
function removeTempProps(){for(let i=props.length-1;i>=0;i--)if(props[i].temp)props.splice(i,1);for(const [k,list] of propHash){const keep=list.filter(p=>!p.temp);if(keep.length)propHash.set(k,keep);else propHash.delete(k)}}
function nearbyProps(x,y,r=40){const out=[];for(let ix=Math.floor((x-r)/CELL);ix<=Math.floor((x+r)/CELL);ix++)for(let iy=Math.floor((y-r)/CELL);iy<=Math.floor((y+r)/CELL);iy++)for(const p of propHash.get(ix+','+iy)||[])if(!p.broken)out.push(p);return out}
makeCity();streetPatina();
// Isolated aircraft adapter, with collisions delegated to the existing world.
airBridge=window.DryAirBridge.create({flight:window.DryFlight,world:WLD,blocked:(x,y,r,z)=>blocked(x,y,r,z),save:save.aircraft,onChange:()=>persist()});
airOps=window.DryAirOps.create({flight:window.DryFlight,world:WLD,blocked:(x,y,r,z)=>blocked(x,y,r,z),onCourier:(kind,data)=>{
 if(kind==='start')toast('AIR COURIER · Fly through both gold circles at 60–220 ft, then land at an airfield.');
 else if(kind==='drop'){toast('AIR DROP '+data.stage+'/2 · '+data.name);sound('cash');}
 else if(kind==='fail')toast('AIR COURIER FAILED · '+data.message);
 else if(kind==='complete'){save.cash=SHOP.round(save.cash+data.reward);save.stats.earnings=SHOP.round(save.stats.earnings+data.reward);save.stats.airDrops=(save.stats.airDrops||0)+1;save.xp+=data.xp;toast('AIR COURIER COMPLETE · '+money(data.reward)+' · '+data.xp+' reputation');sound('cash');persist();}
}});
// One soft gaslight pool, drawn once and stamped under every lamp instead of building a gradient per lamp per frame.
const glow=document.createElement('canvas');glow.width=glow.height=210;{const q=glow.getContext('2d');if(q.createRadialGradient){const gr=q.createRadialGradient(105,105,0,105,105,105);gr.addColorStop(0,'#efc4751e');gr.addColorStop(.45,'#d9b6750c');gr.addColorStop(1,'#dfbb6b00');q.fillStyle=gr;q.fillRect(0,0,210,210)}}
function blocked(x,y,r=10,z=0){if(interior)return roomBlocked(x,y,r);if(x<45+r||y<45+r||x>WORLD-45-r||y>WORLD_H-45-r)return true;for(const b of nearbyBuildings(x,y,r+5)){if(z>b.z+2)continue;if(x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h)return true}return false}
function lineClear(a,b){const d=dist(a,b),n=Math.ceil(d/20);for(let i=1;i<n;i++)if(blocked(lerp(a.x,b.x,i/n),lerp(a.y,b.y,i/n),2))return false;return true}
function moveBody(o,dx,dy,r){let ok=true;const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/7));for(let i=0;i<steps;i++){if(!blocked(o.x+dx/steps,o.y,r))o.x+=dx/steps;else ok=false;if(!blocked(o.x,o.y+dy/steps,r))o.y+=dy/steps;else ok=false}return ok}
function intersection(o){return WLD.nodes.reduce((a,b)=>dist(o,a)<dist(o,b)?a:b)}
function roadRoute(a,b){return WLD.route(a,b)}
function roadside(p,off=0){const n=WLD.nearest(p);return{x:n.x-Math.sin(n.angle)*off,y:n.y+Math.cos(n.angle)*off,a:n.angle}}

function newCar(type,x,y,a=-Math.PI/2,opts={}){const t=carTypes[type];return{type,x,y,a,v:0,hp:t.hp,maxHp:t.hp,color:t.color,ai:'parked',route:[],routeTime:0,fire:rand(1,3),turn:0,vx:0,vy:0,steering:0,throttle:0,yaw:0,burning:false,burnTime:0,impact:0,dead:false,hit:0,z:0,vz:0,air:0,spin:0,nearCd:0,...opts}}
function spawnOwned(){parkedVehicle=null;const p=places[0],old=player.car;if(old){old.owned=false;old.ai='parked';old.v=old.vx=old.vy=0}const at=offRail(roadside({x:p.x-70,y:p.y},-19)),c=newCar(save.car,at.x,at.y,at.a,{owned:true});c.maxHp=carTypes[c.type].hp*(1+save.armor*.25);c.hp=c.maxHp;cars.push(c);player.car=c;player.x=c.x;player.y=c.y;player.vx=player.vy=0;return c}
function populate(){airOps.reset();cars=[];peds=[];enemies=[];bullets=[];particles=[];pickups=[];skids=[];smoke=[];debris=[];blastRings=[];throws=[];LAW.search=null;LAW.known=null;LAW.genAt=null;LAW.seenAt=-99;flames=[];flashes=[];scorches=[];
 for(let i=0;i<31;i++){const edge=pick(WLD.driveEdges.filter(e=>e.d>90)),t=rand(.12,.88),dir=Math.random()>.5?1:-1,a=Math.atan2(edge.b.y-edge.a.y,edge.b.x-edge.a.x)+(dir<0?Math.PI:0),c=newCar(pick(['sedan','sedan','coupe','truck']),lerp(edge.a.x,edge.b.x,t)-Math.sin(a)*15,lerp(edge.a.y,edge.b.y,t)+Math.cos(a)*15,a,{ai:'traffic',speed:rand(50,88),color:pick(['#73674b','#56666a','#835f4c','#374e50','#777963','#485361','#695555'])});c.route=[];cars.push(c)}
 for(let i=0;i<12;i++){const edge=pick(WLD.edges.filter(e=>e.d>150)),at=roadside({x:lerp(edge.a.x,edge.b.x,.45),y:lerp(edge.a.y,edge.b.y,.45)},edge.road.width/2-12);if(!blocked(at.x,at.y,18))cars.push(newCar(pick(['sedan','coupe']),at.x,at.y,at.a,{color:pick(['#61694e','#84674e','#596368'])}))}
 for(let i=0;i<48;i++){const edge=pick(WLD.edges.filter(e=>e.d>75)),t=rand(.1,.9),a=Math.atan2(edge.b.y-edge.a.y,edge.b.x-edge.a.x),off=(edge.road.width/2+9)*pick([-1,1]);const p={x:lerp(edge.a.x,edge.b.x,t)-Math.sin(a)*off,y:lerp(edge.a.y,edge.b.y,t)+Math.cos(a)*off,a,edge,t,dir:pick([-1,1]),off,speed:rand(13,23),color:pick(['#6f7260','#7b6b59','#40565a','#7f8070']),panic:0};if(!blocked(p.x,p.y,8))peds.push(p)}
 spawnOwned();setupNPCs();
}

function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');toastTimer=4.5}
function particle(x,y,color,count=8,speed=60){for(let i=0;i<count;i++){const a=rand(0,TAU),v=rand(speed*.3,speed);particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rand(.25,.65),max:.65,color,size:rand(1,3)})}}
function addHeat(amount){const before=heat;heat=clamp(heat+amount,0,100);escapeGrace=10;if(amount>0&&!interior)lawSaw(player.car||player,true);if(heat>=20&&before<20)toast('The police are looking for you. Get out of sight and out of the red circle on the map.');}
function rank(){return ['SMALL TIMER','RUNNER','ENFORCER','CAPOREGIME','UNDERBOSS','THE DON'][Math.min(5,Math.floor(save.xp/350))]}
function startGame(){if(interior)leaveBusiness(true);if((soundOn||musicOn)&&initAudio())audioCtx.resume();$('crosshair').style.left=w/2+'px';$('crosshair').style.top=h/2+'px';started=true;lifeStart=activeElapsed;lifeJobs=save.jobs;lifeMoney=save.stats.earnings;mode='play';modal='';$('overlay').classList.add('hidden');$('titleScreen').classList.add('hidden');$('panel').classList.add('hidden');for(const id of ['hud','mission','area','bottomhud','minimapWrap'])$(id).classList.remove('hidden');if(isTouch)$('mobile').classList.remove('hidden');else $('crosshair').classList.remove('hidden');populate();camera.x=player.x;camera.y=player.y;generateJobs();if(!save.jobs)acceptJob(jobs[0]);else toast('Welcome back. Enter opens contracts. Tab opens your empire.');updateHUD(true);persist()}
function showPanel(kind){if(deathReport)return;hidePaper();if(!started&&kind!=='help')return;modal=kind;mode='pause';mouse.down=false;touch.fire=false;for(const k in keys)keys[k]=false;$('overlay').classList.remove('hidden');$('titleScreen').classList.add('hidden');$('panel').classList.remove('hidden');$('crosshair').classList.add('hidden');renderPanel()}
function closePanel(){if(deathReport)return;if(!started){modal='';mode='title';$('panel').classList.add('hidden');$('titleScreen').classList.remove('hidden');return}modal='';mode='play';$('overlay').classList.add('hidden');$('panel').classList.add('hidden');if(!isTouch&&!interior)$('crosshair').classList.remove('hidden')}
function panelHead(eyebrow,title){return `<div class="panel-top"><span class="eyebrow">${eyebrow}</span><button class="close" data-do="close" aria-label="Close panel">×</button></div><h2>${title}</h2>`}
function generateJobs(){const level=Math.floor(save.jobs/3);jobs=[
 {type:'bootleg',title:pick(['A Thirsty City','The Midnight Shipment','Last Call','Dry Law, Wet Streets']),desc:'Collect liquor at the woodland still. Deliver it to two speakeasies before the clock runs out.',pay:18+level*2,xp:100,difficulty:'BOOTLEGGING',duration:200},
 {type:'rival',title:pick(['Unfinished Business','A Message for Moretti','The Other Family']),desc:'A rival crew has occupied a corner. Clear the crew, take their ledger, and bring it home.',pay:24+level*3,xp:140,difficulty:'CREW WAR',duration:240},
 {type:'wheelman',title:pick(['Borrowed Luxury','A Car for the Boss','The Long Way Home']),desc:'Lift a marked luxury coupe and return it to Bell & Sons. The police will have questions.',pay:21+level*2,xp:120,difficulty:'GETAWAY DRIVER',duration:180}
];const discovered=SHOP.secrets.filter(s=>save.secrets[s.club]==='found');jobs.splice(3,0,makeJob(pick(Object.keys(JOB_TYPES)),level));if(discovered.length<2)jobs[0]=localJob(SHOP.errands[0]);for(const e of SHOP.errands){if(e.reveal){const s=SHOP.secrets.find(s=>s.club===e.reveal);if(save.secrets[e.reveal]==='found'||save.jobs<s.jobs-1)continue}jobs.push(localJob(e))}
}
const JOB_TYPES={
 hijack:{label:'HIJACK',titles:['Highway Robbery','Somebody Else’s Truck','Special Delivery'],desc:'A rival whiskey truck is crossing town. Wreck it before it reaches its drop, grab the crates and bring them to the back room.',pay:22,step:2.5,xp:130},
 raid:{label:'STILL RAID',titles:['Still Life','Smash the Competition','Up in Smoke'],desc:'A rival crew is cooking liquor beside the road. Blow up their barrels, then lose the police who come running.',pay:26,step:3,xp:150},
 getaway:{label:'GETAWAY',titles:['Leave the Motor Running','The Payroll Job','Engine Running'],desc:'Your crew is cleaning out a rival’s cash room. Park outside, wait for them, then outrun every patrol in town to the back room.',pay:22,step:2,xp:125}
};
const ACTION_JOBS=['rival','wheelman','hijack','raid','getaway'];
function makeJob(type,level){const d=JOB_TYPES[type];return{type,title:pick(d.titles),desc:d.desc,pay:SHOP.round(d.pay+level*d.step),xp:d.xp,difficulty:d.label,duration:180}}
function routeLen(a,b){let L=0,p=a;for(const q of roadRoute(a,b)){L+=dist(p,q);p=q}return L}
function localJob(e){return{type:'errand',errandId:e.id,title:e.title,desc:e.description,pay:e.pay,xp:e.xp,difficulty:e.reveal?'SPEAKEASY CLUE':'LOCAL DELIVERY',duration:420}}
function acceptJob(j){if(!j)return;if(j.type==='bootleg'&&SHOP.secrets.filter(s=>save.secrets[s.club]==='found').length<2){toast('Discover two speakeasies before taking this supply run.');return}if(job){toast('Finish or abandon your current job first.');return}if(trial||frenzy)endActivity();closePanel();const clubs=places.filter(p=>p.type==='club'&&(!p.hidden||save.secrets[p.id]==='found')).sort(()=>Math.random()-.5);job={...j,stage:0,time:j.duration,targets:[],kills:0,delivery:0};
 if(j.type==='errand'){const e=errandDefinition(j.errandId);job.stops=e.stops.map(id=>places.find(p=>p.id===id));job.target=job.stops[0];job.info='Go inside '+job.target.name+' and speak to the person at the counter to collect '+e.cargo+'.';toast('LOCAL JOB · Speak at each counter. Your sealed cargo is supplied free.');}
 if(j.type==='bootleg'){const buyers=clubs.filter(p=>p.hidden);job.stops=[places[1],buyers[0],buyers[1]];job.target=job.stops[0];job.info='Go inside the woodland still and speak to Mabel to collect two sealed moonshine crates.';toast('First, pick up the liquor. Follow the gold route.');}
 if(j.type==='rival'){let site=pick(places.filter(p=>p.type==='club'));job.target=site;job.info='Clear the rival crew. A dashed line means someone is aiming at you, so get behind a wall.';const count=4+Math.min(3,Math.floor(save.jobs/4));job.targets.push(...spawnCrew(site,crewMix(count),{job:true,near:55,far:110}));toast('A rival crew is guarding the place. They have not seen you yet. Their boss carries dynamite.');}
 if(j.type==='wheelman'){const p=pick(places.filter(p=>p.type==='club'));const at=roadside(p,25),c=newCar('coupe',at.x,at.y,at.a,{mission:true,color:'#b8985b'});cars.push(c);job.car=c;job.target=c;job.info='Reach the marked coupe. Press E beside it to get in.';toast('Find the gold coupe. Bring it back in one piece.');}
 if(j.type==='hijack'){const starts=WLD.driveNodes.filter(n=>dist(n,player)>650&&dist(n,player)<1100),n=pick(starts.length?starts:WLD.driveNodes),ends=WLD.driveNodes.filter(q=>dist(q,n)>2300);const c=newCar('truck',n.x,n.y,rand(0,TAU),{ai:'flee',mission:true,missionTruck:true,color:'#7c4a34',hp:180,maxHp:180,speed:135,destination:pick(ends.length?ends:WLD.driveNodes)});cars.push(c);job.truck=c;job.target=c;job.info='Chase down the rival whiskey truck. Ram it or shoot it until it burns.';job.time=job.duration=Math.round(routeLen(n,c.destination)/135+30);toast('The rival truck is on the move. Catch it before it makes its drop!')}
 if(j.type==='raid'){const sites=WLD.driveNodes.filter(n=>dist(n,player)>900&&dist(n,player)<2100&&dist(n,places[6])>500),site=pick(sites.length?sites:WLD.driveNodes),spot=openSpot(site,80);job.site=spot;job.target=spot;job.barrels=[];for(let i=0;i<6;i++){const a=i*TAU/6,x=spot.x+Math.cos(a)*rand(28,52),y=spot.y+Math.sin(a)*rand(28,52);if(blocked(x,y,8))continue;const b={type:'xbarrel',x,y,a:0,r:8,temp:true};addProp(b);job.barrels.push(b)}if(job.barrels.length<3){for(let i=0;i<4;i++){const b={type:'xbarrel',x:site.x+rand(-30,30),y:site.y+rand(-30,30),a:0,r:8,temp:true};addProp(b);job.barrels.push(b)}}job.targets.push(...spawnCrew(spot,save.jobs>=6?['gunman','rusher','gunman','gunman']:['gunman','rusher','gunman'],{job:true,near:60,far:100}));job.info='Blow up the red barrels at the rival still. Shoot them or ram them, then get clear.';job.time=job.duration=Math.round(routeLen(player,site)/112+130);toast('Red barrels explode. Shoot them from a safe distance.')}
 if(j.type==='getaway'){const club=clubs[0]||places[5];job.target=club;job.club=club;job.wait=6;job.info='Drive to '+club.name+' and stop inside the gold circle. Keep the motor running.';job.time=job.duration=Math.round((routeLen(player,club)+routeLen(club,places[6]))/112+50);toast('Get to '+club.name+'. The crew goes in when you arrive.')}
 if(j.type==='rival'||j.type==='wheelman')job.duration=job.time;
 updateObjective();sound('cash')
}
function updateObjective(){if(!job&&trial){$('jobtag').textContent='HOT RUN';$('jobtitle').textContent=trial.def.name;$('jobdesc').textContent='Drive through every numbered checkpoint as fast as you can. Any route counts.';return}if(!job&&frenzy){$('jobtag').textContent='RIVAL RAMPAGE';$('jobtitle').textContent='Wreck six trucks';$('jobdesc').textContent='Rival delivery trucks are loose in the neighborhood. Ram them or shoot them until they burn.';return}if(!job){$('jobtag').textContent='THE NIGHT IS YOURS';$('jobtitle').textContent='Build your reputation';$('jobdesc').textContent='Enter: local jobs and clues. Visit businesses, find concealed doors, deliver moonshine, buy a car and build your home.';$('jobprogress').textContent='JUGS '+save.jugs.length+'/16 · CHECKERED FLAGS ARE HOT RUNS';return}
 $('jobtag').textContent=job.difficulty+' · '+money(job.pay);$('jobtitle').textContent=job.title;$('jobdesc').textContent=job.info;
}
const HEADLINES={errand:['LOCAL SHOPS REPORT A BUSY NIGHT','DELIVERIES ARRIVE ON TIME, FOR ONCE'],bootleg:['MYSTERY CARGO KEEPS DRY COUNTY WET','SPEAKEASIES RESTOCKED OVERNIGHT','WHO IS BEHIND THE MIDNIGHT DELIVERIES?'],rival:['GANG FEUD ERUPTS DOWNTOWN','RIVAL CREW ROUTED, LEDGER MISSING','SHOTS FIRED NEAR LOCAL CLUB'],wheelman:['LUXURY COUPE VANISHES FROM CLUB CURB','STOLEN CAR OUTRUNS ENTIRE SQUAD'],hijack:['WHISKEY TRUCK WRECKED ON COUNTY ROAD','HIJACKERS STRIKE AGAIN'],raid:['ILLEGAL STILL GOES UP IN FLAMES','EXPLOSIONS ROCK THE OUTSKIRTS'],getaway:['DARING GETAWAY STUNS POLICE','CASH ROOM CLEANED OUT IN MINUTES']};
const DECKS={errand:'Shopkeepers say the parcels arrived on time and nobody asked any questions.',bootleg:'Police say the cars are fast, the drivers are faster, and nobody saw anything.',rival:'Witnesses describe a well dressed newcomer who left before the patrol arrived.',wheelman:'Owner says he only stepped inside for a minute.',hijack:'Twelve cases of Canadian whiskey are missing from the wreck.',raid:'Firemen found melted copper pipe and a great many broken barrels.',getaway:'The getaway car was last seen heading toward the back streets at high speed.'};
function completeJob(){if(!job)return;const completed=job;combo++;comboTimer=180;save.stats.bestStreak=Math.max(save.stats.bestStreak,combo);const bonus=Math.min(5,combo-1)*.1;const timeBonus=ACTION_JOBS.includes(completed.type)&&completed.duration?SHOP.round(Math.min(completed.pay*.35,Math.max(0,completed.time||0)/completed.duration*completed.pay*.5)):0;const pay=SHOP.round(completed.pay*(1+bonus)+timeBonus);save.cash=SHOP.round(save.cash+pay);save.stats.earnings=SHOP.round(save.stats.earnings+pay);save.xp+=completed.xp;save.jobs++;refreshDaily();save.daily.done++;job=null;removeTempProps();enemies=enemies.filter(e=>!e.job);for(const c of cars){c.mission=false;if(c.missionTruck){c.missionTruck=false;if(!c.dead&&!c.burning)c.ai='traffic'}}player.reserve=Math.max(player.reserve,weapons[save.weapon].reserve);player.hp=Math.min(100,player.hp+25);sound('cash');toast('JOB COMPLETE · '+money(pay)+(bonus>0?' · '+Math.round(bonus*100)+'% streak bonus':'')+(timeBonus>0?' · '+money(timeBonus)+' time bonus':''));showPaper({kicker:'EXTRA · THE MT. MORRIS MESSENGER',headline:pick(HEADLINES[completed.type]||HEADLINES.bootleg),deck:DECKS[completed.type]||DECKS.bootleg,fact:nextFact()});generateJobs();updateObjective();persist();}
function failJob(reason){if(!job)return;job=null;removeTempProps();enemies=enemies.filter(e=>!e.job);for(const c of cars){c.mission=false;if(c.missionTruck){c.missionTruck=false;if(!c.dead&&!c.burning)c.ai='traffic'}}combo=0;toast(reason+' · New contracts are available.');updateObjective();generateJobs()}
function renderPanel(){if(modal==='shop'){renderShop();return}if(modal==='home'){renderHome();return}if(modal==='dealership'){renderDealership();return}const p=$('panel');let html='';
 if(modal==='help'){
 html=panelHead('WELCOME TO MT. MORRIS','Your first night in the city');html+='<p>Prohibition banned making and selling alcoholic drinks and gave criminal gangs a lucrative market. This map follows modern Mt. Morris roads; the 1926 people, businesses and events are fictional. Here, you start with a borrowed sedan and '+money(initial().cash)+'. Take local jobs, trade at shop counters and earn trust to find concealed speakeasies. Deliver moonshine to discovered buyers. Buy vehicles at Cole Motor Company, construction supplies at the hardware store, and furnishings for your home at Abbott.</p><div class="help-grid"><div><kbd>WASD / ARROWS</kbd>Move. In a car: W accelerates, S brakes / reverses, A / D steer.</div><div><kbd>E</kbd>Enter / exit the nearest car. Walk into businesses on foot. Inside: F talks at counters, E uses exits and concealed doors. F talks to people with a speech bubble.</div><div><kbd>MOUSE</kbd>Aim and hold click to shoot. You can fire from a car.</div><div><kbd>SPACE</kbd>Handbrake. Slide around corners. Long drifts pay a little cash.</div><div><kbd>R</kbd>Reload. <kbd>Q</kbd>or <kbd>1 2 3</kbd>switch guns you own. <kbd>H</kbd>horn.</div><div><kbd>ENTER / TAB</kbd>Contracts / empire, upgrades and businesses.</div><div><kbd>M</kbd>City map. Gold is your objective; red is the law.</div><div><kbd>ESC / P</kbd>Pause. Your purchases and progress save automatically.</div></div><p>Lose the police by getting out of sight and out of the red search circle on the map. The green back room helps you recover. For local jobs and moonshine runs, go inside the marked business and speak at the counter. Explore shop backs for concealed speakeasy doors. Cars can be stolen, damaged and destroyed. A wrecked car is not the end: get out and find another.</p><p><b>The law.</b> Stars mean the police want you. They only know where they last saw you or where a crime was reported, and the map shows that as a red circle. Squad cars comb it, and it widens while they look. Get out of sight and outside the circle and the stars fade fast. Some cars race ahead to cut you off, and a car on your tail will try to spin you out. On foot, officers jump out and give chase. Walk and they tackle you. Sprint with Shift and you can outrun them. At three stars they set up roadblocks and start shooting. At four the federal dry agents show up. If they box you in and you stop moving, you get pinched. Roll slowly up to Bell & Sons in a hot car and Sal will respray it for a small fee.</p><p><b>Rival crews.</b> A crew does not know you are there until someone spots you. Gunmen duck behind buildings and lean out to shoot. Shotgun men charge straight at you. The boss carries a Thompson and throws dynamite when you hide too long, so move when you see the red ring on the ground. A dashed line means someone is taking aim. RELOADING over a head means now is the time to push.</p><p><b>Extra cash.</b> Near misses, drifts, jumps off the wooden ramps and smashed lamps all pay a little, more if you chain them. Checkered flags start hot runs. The red flag starts the rival rampage. Sixteen moonshine jugs are hidden around town, and each one has a real history clipping inside.</p><p>On a phone, use the left stick to move or steer; FIRE aims at the closest visible rival or officer. Rotate to landscape for a wider view.</p><button class="primary" data-do="close">'+(started?'BACK TO THE CITY':'GOT IT')+' <b>↗</b></button>';
 }else if(modal==='jobs'){
 html=panelHead('THE PAYPHONE NETWORK','Work after dark');html+='<p>Word gets around. Take a contract and follow the gold marker. Complete consecutive jobs for up to a 50% payout bonus.</p>';
 if(job)html+=`<div class="card"><small>ACTIVE CONTRACT · ${Math.ceil(job.time)} SECONDS LEFT</small><h3>${job.title}</h3><p>${job.info}</p><footer><button data-do="close">CONTINUE JOB →</button><button data-do="abandon">ABANDON JOB</button></footer></div>`;
 else html+='<div class="cards">'+jobs.map((j,i)=>`<article class="card"><small>${j.difficulty}</small><h3>${j.title}</h3><p>${j.desc}</p><footer><span class="money">${money(j.pay)}</span><button data-do="job" data-i="${i}">TAKE JOB →</button></footer></article>`).join('')+'</div>';
 html+=progressionHTML();html+=`<div class="panel-footer"><span>STREAK ${combo} · ${rank()} · ${save.xp} REPUTATION</span><span>YOUR CUT: ${money(save.cash)}</span></div>`;
 }else if(modal==='empire'){
 refreshDaily();html=panelHead('MONEY TALKS · '+money(save.cash),'A bigger piece of the city');html+=`<div class="tabs"><button data-do="tab" data-tab="equipment" class="${tabName==='equipment'?'active':''}">ARSENAL</button><button data-do="tab" data-tab="garage" class="${tabName==='garage'?'active':''}">GARAGE</button><button data-do="tab" data-tab="business" class="${tabName==='business'?'active':''}">EMPIRE</button><button data-do="tab" data-tab="clips" class="${tabName==='clips'?'active':''}">CLIPPINGS ${save.jugs.length}/16</button><button data-do="tab" data-tab="records" class="${tabName==='records'?'active':''}">RECORDS</button></div><div class="cards">`;
 if(tabName==='equipment'){
  html+=weapons.map((a,i)=>`<article class="card"><small>${i===0?'TRUSTY SIDEARM':i===1?'CLOSE QUARTERS':'THE CHICAGO TYPEWRITER'}</small><h3>${a.name}</h3><p>${i===0?'An eight-round .45. Reliable, accurate, and yours from the start.':i===1?'Two barrels. Seven pellets per shot. Devastating at close range.':'Thirty rounds. Fully automatic. The preferred punctuation of organized crime.'}</p><footer><span class="money">${save.ownedWeapons.includes(i)?'OWNED':money(a.price)}</span><button data-do="weapon" data-i="${i}" ${save.weapon===i?'disabled':''}>${save.weapon===i?'EQUIPPED':save.ownedWeapons.includes(i)?'EQUIP':'BUY & EQUIP'}</button></footer></article>`).join('');
  html+=`<article class="card"><small>BACK-ROOM SUPPLIES</small><h3>Fresh start</h3><p>Refill your ammunition, patch up your injuries, and repair your current vehicle.</p><footer><span class="money">$4.50</span><button data-do="resupply">RESUPPLY</button></footer></article>`;
 }
 if(tabName==='garage'){
  html+='<p>Buy or recall vehicles in person at Cole Motor Company (A on your map).</p>';
  html+=['sedan','coupe','truck','custom'].map((id,i)=>{const a=carTypes[id];return `<article class="card"><small>${['YOUR FIRST SET OF WHEELS','SPEED & HANDLING','HEAVY ARMOR','THE BOSS\'S GETAWAY'][i]}</small><h3>${a.name}</h3><p>${Math.round(a.max*.21)} mph · ${a.hp} armor. ${['A dependable sedan. Enough room for liquor and a little ambition.','A lighter, faster chassis for precision getaways.','Tough delivery truck. Trades speed for serious durability.','Supercharged straight-eight. Fast, strong, and built to disappear.'][i]}</p><footer><span class="money">${save.ownedCars.includes(id)?'OWNED':money(a.price)}</span><span class="dealer-note">VISIT COLE MOTOR COMPANY · A ON MAP</span></footer></article>`}).join('');
  for(const [id,title,desc] of [['engine','Engine tuning','15% more top speed and acceleration per level.'],['armor','Reinforced body','25% more vehicle durability per level.'],['grip','Performance tires','Better steering and faster recovery from a drift.']])html+=`<article class="card"><small>ALL OWNED CARS · LEVEL ${save[id]} / 3</small><h3>${title}</h3><p>${desc}</p><footer><span class="money">${save[id]>=3?'MAX':money(30+save[id]*30)}</span><button data-do="upgrade" data-up="${id}" ${save[id]>=3?'disabled':''}>UPGRADE</button></footer></article>`;
 }
 if(tabName==='business'){
 const biz=[['velvet','The Velvet Room',90,6,'A discreet cocktail room in downtown Mt. Morris.'],['blue','Blue Lantern',160,11,'A jazz club with a healthy thirst in the south.'],['lucky','Lucky Seven',260,18.50,'The high rollers pay handsomely for a drink.']];
 html+='<p>Discover speakeasies through concealed doors before buying a share in them. Ask at shop counters or take a clue job.</p>';
 html+=biz.filter(([id])=>save.secrets[id]==='found').map(([id,title,price,income,desc])=>`<article class="card"><small>${save.businesses.includes(id)?'PART OF YOUR EMPIRE':'ACQUIRE A SPEAKEASY'}</small><h3>${title}</h3><p>${desc} Generates ${money(income)} every two minutes of active play.</p><footer><span class="money">${save.businesses.includes(id)?'OWNED':money(price)}</span><button data-do="business" data-biz="${id}" ${save.businesses.includes(id)?'disabled':''}>${save.businesses.includes(id)?'IN BUSINESS':'ACQUIRE'}</button></footer></article>`).join('');
 html+=`<article class="card"><small>YOUR BUSINESS PROCEEDS</small><h3>The evening take</h3><p>Collect income from your speakeasies. Earnings accumulate while you play and survive between sessions.</p><footer><span class="money">${money(save.income)}</span><button data-do="collect" ${save.income<1?'disabled':''}>COLLECT</button></footer></article><article class="card"><small>DAILY CONTRACT BONUS · ${Math.min(save.daily.done,3)} / 3</small><h3>Three before sunrise</h3><p>Complete three contracts today. Claim a $25 bonus, once per day, on this browser.</p><footer><span class="money">$25.00</span><button data-do="daily" ${save.daily.done<3||save.daily.claimed?'disabled':''}>${save.daily.claimed?'CLAIMED':'CLAIM BONUS'}</button></footer></article>`;
 }
 if(tabName==='clips'){html+=jugs.map(j=>{const got=save.jugs.includes(j.id),f=FACTS[j.id%FACTS.length];return `<article class="card clip ${got?'':'locked'}"><small>JUG ${j.id+1} · ${got?'FOUND':'STILL HIDDEN'}</small><h3>${got?f.head:'???'}</h3><p>${got?f.text:'Somewhere off the road, '+district(j.x,j.y).toLowerCase()+'. Look for the glint.'}</p></article>`}).join('')}
 if(tabName==='records'){const st=save.stats;html+=TRIALS.map(t=>`<article class="card"><small>HOT RUN</small><h3>${t.name}</h3><p>${t.cps.length} checkpoints. Start at the checkered flag and press E.</p><footer><span class="money">${save.trials[t.id]?fmtTime(save.trials[t.id]):'NO TIME'}</span></footer></article>`).join('')+`<article class="card"><small>ON THE STREET</small><h3>Your record</h3><p>${st.jumps||0} jumps · ${st.smashed||0} things smashed · ${st.escapes||0} escapes · ${st.busts||0} times pinched · ${Math.round((st.distance||0)/1760)} miles driven</p></article>`}
 html+=`</div><div class="panel-footer"><span>${save.jobs} JOBS COMPLETE · ${save.xp} REPUTATION · ${rank()}</span><span>${storageOK?'PROGRESS SAVED ON THIS BROWSER':'SESSION PROGRESS ONLY'}</span></div>`;
 }else if(modal==='map'){
 html=panelHead('KNOW YOUR STREETS','Mt. Morris');html+='<canvas id="fullmap" class="mapcanvas" width="620" height="'+Math.round(620*WORLD_H/WORLD)+'"></canvas><div class="legend"><span style="color:#d5ae62">◆ Current objective</span><span style="color:#85b79f">G Garage · S Back room</span><span style="color:#cc6a58">● Police / rival</span><span>▲ You · N ↑</span></div><div class="legend">'+places.filter(p=>!p.hidden&&p.type!=='phone').map(p=>'<span>'+p.icon+' · '+p.name+'</span>').join('')+'</div>';
 }else{
 html=panelHead('A MOMENT IN THE BACK ROOM','The city can wait.');html+=`<div class="statsgrid"><div><strong>${money(save.cash)}</strong><small>CASH ON HAND</small></div><div><strong>${save.jobs}</strong><small>JOBS COMPLETE</small></div><div><strong>${save.stats.bestStreak}</strong><small>BEST STREAK</small></div></div><p>${rank()} · ${save.xp} reputation. ${save.businesses.length} speakeasies. ${storageOK?'Your cash, upgrades and empire are saved on this browser. Active jobs and police heat reset when you reopen the game.':'Browser storage is unavailable; keep this tab open to preserve this session.'}</p><div class="titleactions"><button class="primary" data-do="close">BACK TO THE CITY <b>↗</b></button><button class="secondary" data-do="help">CONTROLS & HOW TO PLAY</button><button class="textbtn" data-do="sound">${soundLabel()} · TOGGLE</button><button class="textbtn" data-do="music">${musicOn?'MUSIC ON ●':'MUSIC OFF ◯'} · TOGGLE</button><button class="textbtn" data-do="lights">${save.settings.lights===false?'NIGHT LIGHTING OFF ◯':'NIGHT LIGHTING ON ●'} · TOGGLE</button><button class="secondary" data-do="end-run">END THIS RUN & GIVE FEEDBACK</button><button class="textbtn" data-do="reset">START A NEW EMPIRE</button></div>`;
 }
 p.innerHTML=html;
 if(modal==='map')drawMap($('fullmap').getContext('2d'),620,true);
}
function spend(amount){if(!Number.isFinite(amount)||amount<0)return false;if(save.cash<amount){toast('You need '+money(amount-save.cash)+' more. Take another job.');return false}save.cash=SHOP.round(save.cash-amount);sound('cash');return true}
$('panel').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!b.dataset.do)return;const a=b.dataset.do,i=Number(b.dataset.i);
 switch(a){
 case'shop-buy':tradeItem(b.dataset.item,'buy');renderShop();return;
 case'shop-sell':tradeItem(b.dataset.item,'sell');renderShop();return;
 case'shop-service':shopService();renderShop();return;
 case'shop-use':useInventory(b.dataset.item);renderShop();return;
 case'dealer-car':buyDealerCar(b.dataset.car);renderDealership();return;
 case'home-build':buildHome(b.dataset.recipe);renderHome();return;
 case'home-place':placeFurniture(b.dataset.item);renderHome();return;
 case'home-remove':removeFurniture(Number(b.dataset.index));renderHome();return;
 case'home-rest':if(interior?.place.id==='home'&&save.home.furniture.some(p=>p.item==='bed')){player.hp=100;toast('Rested at home.');updateHUD(true)}return;
 case'close':closePanel();return;case'help':showPanel('help');return;case'sound':enableAudio();renderPanel();return;case'music':setMusic(!musicOn);renderPanel();return;case'lights':save.settings.lights=save.settings.lights===false;persist();renderPanel();return;case'job':acceptJob(jobs[i]);return;case'abandon':failJob('Contract abandoned');renderPanel();return;case'tab':tabName=b.dataset.tab;renderPanel();return;
 case'weapon':if(save.ownedWeapons.includes(i)||spend(weapons[i].price)){if(!save.ownedWeapons.includes(i))save.ownedWeapons.push(i);equipWeapon(i);toast(weapons[i].name+' equipped.')}break;
 case'resupply':if(spend(4.50)){player.hp=100;player.ammo=weapons[save.weapon].mag;player.reserve=weapons[save.weapon].reserve;player.reload=0;if(player.car)player.car.hp=player.car.maxHp;toast('Patched up. Ammunition stocked. Car repaired.')}break;

 case'upgrade':{const id=b.dataset.up;if(save[id]<3&&spend(30+save[id]*30)){save[id]++;if(id==='armor'&&player.car&&player.car.owned){const c=player.car;c.maxHp=carTypes[c.type].hp*(1+save.armor*.25);c.hp=c.maxHp}toast('Upgrade installed across your garage.')}}break;
 case'business':{const data={velvet:[90,6],blue:[160,11],lucky:[260,18.50]},id=b.dataset.biz;if(data[id]&&save.secrets[id]==='found'&&!save.businesses.includes(id)&&spend(data[id][0])){save.businesses.push(id);toast('Speakeasy acquired. Your empire is growing.')}}break;
 case'collect':if(save.income>0){save.cash+=save.income;save.stats.earnings+=save.income;toast(money(save.income)+' collected.');save.income=0;sound('cash')}break;
 case'daily':if(save.daily.done>=3&&!save.daily.claimed){save.cash=SHOP.round(save.cash+25);save.daily.claimed=true;toast('Daily bonus collected · $25.00');sound('cash')}break;
 case'end-run':closePanel();player.invincible=0;damagePlayer(9999,'Run ended by player');return;case'reset':pConfirm();return;
 case'reset-confirm':if(interior)leaveBusiness(true);airOps.reset();airBridge.abandon(player);save=initial();airBridge.restore(null);ensureMarket();refreshDaily();persist();heat=0;job=null;combo=0;player.hp=100;player.ammo=8;player.reserve=64;player.reload=0;for(let i=0;i<weapons.length;i++)ammoPacks[i]={ammo:weapons[i].mag,reserve:weapons[i].reserve};populate();generateJobs();closePanel();acceptJob(jobs[0]);return;
 }persist();renderPanel()
});
function pConfirm(){$('panel').innerHTML=panelHead('START OVER','Leave your empire behind?')+'<p>This erases your money, upgrades, records and businesses in this browser. This cannot be undone.</p><div class="titleactions"><button class="secondary" data-do="reset-confirm">ERASE PROGRESS & START OVER</button><button class="primary" data-do="close">KEEP MY EMPIRE</button></div>'}
function equipWeapon(i){if(!save.ownedWeapons.includes(i)||i===save.weapon)return;ammoPacks[save.weapon]={ammo:player.ammo,reserve:player.reserve};save.weapon=i;player.ammo=ammoPacks[i].ammo;player.reserve=ammoPacks[i].reserve;player.reload=0;persist()}
function reload(){if(player.reload||player.ammo===weapons[save.weapon].mag||player.reserve<=0)return;player.reload=weapons[save.weapon].reload;sound('tick')}
function nearestCar(){if(interior)return null;let c=null,best=68;for(const x of cars)if(!x.dead&&!x.burning&&x!==player.car&&Math.abs(x.v)<85){let d=dist(player,x);if(d<best){best=d;c=x}}return c}
function nearestPlace(){if(interior)return null;const d=p=>Math.min(dist(player,p),p.door?dist(player,p.door):Infinity);return places.filter(p=>!p.hidden).sort((a,b)=>d(a)-d(b)).find(p=>d(p)<85)}
function interact(){if(mode!=='play')return;
 if(interior){if(trySecretDoor())return;if(dist(player,{x:360,y:437})<65){leaveBusiness();return}if(nearestNPC()){talkNearby();return}toast('F talks at the counter. E leaves at the bottom exit.');return}
 if(player.air||!player.car){const result=airBridge.interaction(player);if(result.handled){toast(result.message);if(result.kind==='board'||result.kind==='exit')sound('tick');persist();return}}
 if(player.car&&!player.car.burning){const act=activityAt();if(act){if(act.kind==='trial')startTrial(act.t);else startRampage();return}}
 const near=player.car?.burning?null:nearestPlace();if(!player.car&&near&&shopById(near.id)&&(near.door&&dist(player,near.door)<30&&(!nearestCar()?.mission||dist(player,near.door)<8)||!nearestCar()||dist(player,nearestCar())>38)){enterBusiness(near);return}if(near?.type==='phone'){showPanel('jobs');return}
 if(player.car){const c=player.car;if(Math.abs(c.v)>125&&!c.burning){toast('Slow down before getting out.');return}const sides=[c.a+Math.PI/2,c.a-Math.PI/2,c.a+Math.PI,c.a];let pos=null;for(const a of sides){const x=c.x+Math.cos(a)*43,y=c.y+Math.sin(a)*43;if(!blocked(x,y,10)){pos={x,y};break}}if(!pos){toast('The door is blocked. Move the car.');return}parkedVehicle=c;player.car=null;player.x=pos.x;player.y=pos.y;player.a=c.a;c.v*=.3;c.ai='parked';toast('On foot. Aim with the mouse. Hold click to shoot.');return}
 const c=nearestCar();if(c){if(c.type==='police')addHeat(25);else if(c.ai==='traffic')addHeat(9);parkedVehicle=null;player.car=c;c.ai='player';player.x=c.x;player.y=c.y;sound('tick');if(job&&job.type==='wheelman'&&c===job.car&&job.stage===0){job.stage=1;job.target=places[0];job.info='Return the coupe to Bell & Sons garage. Shake the police on the way.';addHeat(38);updateObjective();toast('The coupe is yours. Take it to the garage.')}}}
function fire(){if(interior||player.air)return;const weap=weapons[save.weapon];if(player.shot>0||player.reload>0)return;if(player.ammo<1){reload();return}player.ammo--;player.shot=weap.rate;let a=player.a;if(!isTouch&&mouse.active){a=Math.atan2((mouse.y-h/2)/zoom+camera.y-player.y,(mouse.x-w/2)/zoom+camera.x-player.x)}else{const targets=enemies.filter(e=>e.hp>0).concat(cars.filter(c=>c.ai==='police'&&!c.dead));const t=targets.filter(e=>dist(player,e)<650&&lineClear(player,e)).sort((a,b)=>dist(player,a)-dist(player,b))[0];if(t)a=Math.atan2(t.y-player.y,t.x-player.x)}
 player.a=a;for(let i=0;i<weap.bullets;i++){const ang=a+rand(-weap.spread,weap.spread);bullets.push({x:player.x+Math.cos(a)*26,y:player.y+Math.sin(a)*26,vx:Math.cos(ang)*850,vy:Math.sin(ang)*850,life:.8,damage:weap.damage,from:'player',lastX:player.x,lastY:player.y})}particle(player.x+Math.cos(a)*28,player.y+Math.sin(a)*28,'#efca77',5,55);muzzle=.06;flashes.push({x:player.x+Math.cos(a)*25,y:player.y+Math.sin(a)*25,a,life:.07,s:save.weapon===1?1.5:1});camera.lookX-=Math.cos(a)*(save.weapon===1?9:4);camera.lookY-=Math.sin(a)*(save.weapon===1?9:4);if(save.weapon!==1||Math.random()<.5){const ea=a+Math.PI/2+rand(-.3,.3);debris.push({x:player.x+Math.cos(a)*8,y:player.y+Math.sin(a)*8,z:8,vx:Math.cos(ea)*rand(60,110),vy:Math.sin(ea)*rand(60,110),vz:rand(60,110),a:rand(0,TAU),spin:rand(-20,20),life:1.6,size:2.2,color:save.weapon===1?'#b8452f':'#d8b45c'})}shake=Math.max(shake,save.weapon===1?3:1.4);sound(['shot','shotgun','tommy'][save.weapon]);addHeat(.8);for(const p of peds)if(dist(p,player)<220)p.panic=5}
function enemyFire(e,from='enemy'){const a=Math.atan2(player.y-e.y,player.x-e.x)+rand(-.12,.12)*(from==='agent'?1.4:1);if(visible(e,60))flashes.push({x:e.x+Math.cos(a)*20,y:e.y+Math.sin(a)*20,a,life:.06,s:from==='agent'?1.2:.9});bullets.push({x:e.x+Math.cos(a)*22,y:e.y+Math.sin(a)*22,vx:Math.cos(a)*500,vy:Math.sin(a)*500,life:1,damage:from==='police'?7:from==='agent'?6:10,from,lastX:e.x,lastY:e.y});if(visible(e,60))sound('enemyshot');particle(e.x+Math.cos(a)*24,e.y+Math.sin(a)*24,'#e6c47a',3,35)}
function damagePlayer(amount,reason='Gunfire'){if(deathPending||deathReport||player.invincible>0)return;player.hp-=amount;flash=.2;shake=Math.max(shake,2);if(player.hp<=0){deathPending=true;endLife(reason)}}
function recover(kind='dead'){if(interior)leaveBusiness(true);airOps.reset();airBridge.abandon(player);const pinched=kind==='busted',loss=Math.min(save.cash,Math.max(pinched?5:3.5,SHOP.round(save.cash*(pinched?.15:.12))));save.cash=SHOP.round(save.cash-loss);bustMeter=0;respray=0;styleMult=1;driftTime=0;lastStars=0;player.hp=100;player.invincible=5;heat=0;combo=0;deathPending=false;if(job)failJob('The job went sideways');for(const c of cars.filter(c=>c.ai==='police'))c.remove=true;spawnOwned();camera.x=player.x;camera.y=player.y;camera.lookX=camera.lookY=0;lifeStart=activeElapsed;lifeJobs=save.jobs;lifeMoney=save.stats.earnings;toast(pinched?'RELEASED · '+money(loss)+' to the judge. Try not to get caught again.':'PATCHED UP · '+money(loss)+' hospital bill. Your empire is still yours.');persist()}
function wreck(c){if(c.dead||c.burning)return;c.hp=0;c.burning=true;c.burnTime=3.2;c.throttle=0;particle(c.x,c.y,'#d1b18a',12,80);if(c===player.car)toast('ENGINE FIRE · Three seconds. Get out with E!');if(job&&job.car===c)failJob('The marked coupe was wrecked')}
function explodeCar(c){if(c.dead)return;const wasPlayer=c===player.car;c.dead=true;c.burning=false;c.v=0;c.vx*=.3;c.vy*=.3;c.vz=160;c.z=.5;c.spin=rand(-5,5);if(wasPlayer){player.car=null;player.x=c.x;player.y=c.y}blast(c.x,c.y,.8,wasPlayer?'':'');if(wasPlayer){player.invincible=0;damagePlayer(140,'Vehicle explosion')}
 if(c.ai==='police'){addHeat(12);save.xp+=8;pickups.push({x:c.x+15,y:c.y,type:'cash',amount:2,life:60})}
}
function emitSmoke(c,heavy=false){smoke.push({x:c.x+Math.cos(c.a)*16+rand(-5,5),y:c.y+Math.sin(c.a)*16+rand(-5,5),z:heavy?15:5,vx:rand(-10,10),vy:rand(-5,5),vz:rand(18,36),r:heavy?rand(15,24):rand(7,12),life:heavy?3.5:2.5,max:heavy?3.5:2.5,dark:c.burning||heavy})}
// Car physics: a single-track tire model. Each axle has a slip angle and a grip limit, load shifts between
// the axles when the car brakes or accelerates, the handbrake strips grip from the rear, and grass, dirt and rain
// change how much grip there is. Velocity is no longer snapped to the nose, so cars slide, drift and spin for real.
const GRAV=340,PHYS={sedan:{mu:1,stiff:9},coupe:{mu:1.06,stiff:10},truck:{mu:.86,stiff:8},custom:{mu:1.1,stiff:10.5},police:{mu:1.03,stiff:9.5},agent:{mu:1.07,stiff:10}};
const GEARS=[0,.24,.46,.7,1.01];
function surfaceAt(c){if(c!==player.car)return 0;c.surfT=(c.surfT||0)-1;if(c.surfT<=0||c.surf===undefined){c.surfT=3;const n=WLD.nearest(c),hw=n.edge.road.width/2;c.surf=n.d<hw?0:n.d<hw+11?1:2}return c.surf}
function drive(c,dt,acc,steer,brake){if(c.dead)return;const t=carTypes[c.type],P=PHYS[c.type]||PHYS.sedan,eng=c.owned?save.engine:0,gripLv=c.owned?save.grip:0,top=t.max*(1+eng*.15)*(c.boost||1),power=t.accel*(1+eng*.15),air=c.z>0||c.vz>0,isAI=c!==player.car;
 c.impact=Math.max(0,(c.impact||0)-dt);c.nearCd=Math.max(0,(c.nearCd||0)-dt);c.railCd=Math.max(0,(c.railCd||0)-dt);c.shift=Math.max(0,(c.shift||0)-dt);
 c.steering=lerp(c.steering||0,steer,1-Math.exp(-dt*(Math.abs(steer)>Math.abs(c.steering||0)?7:11)));c.throttle=lerp(c.throttle||0,c.burning?0:acc,1-Math.exp(-dt*6));c.braking=!!brake;
 let ca=Math.cos(c.a),sa=Math.sin(c.a),vl=(c.vx||0)*ca+(c.vy||0)*sa,vt=-(c.vx||0)*sa+(c.vy||0)*ca,w=(c.yawRate||0)+(c.spin||0);c.spin=0;
 if(Math.abs((c.v||0)-vl)>40&&!c.knock){vl=c.v;vt=0}c.knock=false;
 const len=c.type==='truck'?61:50,L=len*.62,half=L/2,Iz=(len*len+(c.type==='truck'?841:625))/12;let slip=0;
 if(air){c.vz-=700*dt;c.z+=c.vz*dt;c.air+=dt;vl*=Math.exp(-dt*.08);w*=Math.exp(-dt*.5);if(c.z<=0){c.z=0;const hard=-c.vz;c.vz=0;if(hard>230){c.hp-=(hard-230)*.05;if(c===player.car)shake=Math.max(shake,5)}vt*=.6;particle(c.x,c.y,'#9a9373',10,70);if(visible(c,50))sound('land',Math.min(1,hard/400));if(c===player.car&&c.air>.35){save.stats.jumps++;styleBonus(c.air>1.1?'HUGE AIR':'AIRTIME',c.air*3,c.air.toFixed(1)+'s')}c.air=0}c.a=norm(c.a+w*dt)}
 else{const surf=surfaceAt(c),mu=P.mu*(1+gripLv*.07)*(surf===2?.6:surf===1?.84:1)*.93*(isAI?1.18:1),thr=c.throttle;c.surface=surf;
  // Engine, brakes and resistance along the car.
  const drag=v=>v*(surf===2?1.05:.12)+v*Math.abs(v)*.0007;let Fx=0;if(thr>.05){if(vl<-6)Fx=Math.min(mu*GRAV,400)*thr;else{const r=clamp(vl/top,0,1.25);Fx=(power*.95*Math.max(-.25,1-r*r*r)*(c.shift>0?.4:1)+(surf===2?0:drag(Math.max(0,vl))))*thr}}else if(thr<-.05){if(vl>6)Fx=-Math.min(mu*GRAV*1.05,420)*-thr;else{const r=clamp(-vl/(top*.32),0,1.25);Fx=-power*.75*-thr*Math.max(-.2,1-r*r)}}
  Fx-=drag(vl);if(Math.abs(thr)<.05&&Math.abs(vl)>2)Fx-=Math.sign(vl)*45;
  // Gears are felt as a short torque dip and heard in the engine note.
  const ratio=Math.abs(vl)/top;let gear=1;while(gear<4&&ratio>GEARS[gear])gear++;if(gear>(c.gear||1)&&thr>.4){c.shift=.08;if(c===player.car)sound('shift')}c.gear=gear;c.rpm=clamp((ratio-GEARS[gear-1])/(GEARS[gear]-GEARS[gear-1]),0,1);
  const n=4,h=dt/n;for(let k=0;k<n;k++){const spd=Math.abs(vl),maxSteer=.6/(1+spd/200),delta=c.steering*maxSteer;
   let fx=Fx;if(brake){const lock=Math.min(Math.abs(vl)/h,mu*GRAV*.26);fx-=Math.sign(vl)*lock}
   if(spd<22){const wk=vl*Math.tan(delta)/L;w=lerp(w,wk,1-Math.exp(-h*14));vt*=Math.exp(-h*12);vl+=fx*h;if(Math.abs(vl)<.4&&Math.abs(thr)<.05)vl=0}
   else{const sg=Math.sign(vl),af=Math.atan2(vt+w*half,spd)-delta*sg,ar=Math.atan2(vt-w*half,spd),Wf=clamp(.5-(c.aLong||0)/GRAV*.2,.3,.7),Wr=1-Wf;
    const capF=mu*GRAV*Wf,driveShare=fx>0?fx/(mu*GRAV):-fx/(mu*GRAV)*.45;let capR=mu*GRAV*Wr*(brake?.3:1)*Math.sqrt(Math.max(.3,1-driveShare*driveShare*.55));
    const fF=clamp(-P.stiff*GRAV*Wf*af,-capF,capF),fR=clamp(-P.stiff*GRAV*Wr*ar,-capR,capR);
    const aL=fx-fF*Math.sin(delta),aT=fF*Math.cos(delta)+fR,yawAcc=(half*fF*Math.cos(delta)-half*fR)/Iz;
    vl+=(aL+w*vt)*h;vt+=(aT-w*vl)*h;w+=yawAcc*h;c.aLong=aL;slip=Math.max(slip,Math.abs(ar),Math.abs(af)*.8)}
   if(isAI)w*=Math.exp(-h*1.2);c.a=norm(c.a+w*h)}
  if(vl>top*1.3)vl=top*1.3;
  // Ramps launch any car that hits them square and fast.
  if(vl>110)for(const r of ramps){const dx=c.x-r.x,dy=c.y-r.y,lx=dx*Math.cos(r.a)+dy*Math.sin(r.a),ly=-dx*Math.sin(r.a)+dy*Math.cos(r.a);if(Math.abs(lx)<r.len/2&&Math.abs(ly)<r.wid/2+6&&Math.cos(c.a-r.a)>.5){c.vz=Math.min(360,vl*.8);c.z=.5;c.air=0;if(visible(c,40))sound('ramp');break}}
  // Rail crossings give a fast car a little hop.
  if(c===player.car&&vl>180&&c.railCd<=0)for(let i=1;i<WLD.railway.length;i++){if(projectOnSegment(c,WLD.railway[i-1],WLD.railway[i]).d<9){c.vz=70+vl*.1;c.z=.5;c.railCd=.7;break}}
  if(surf===2&&Math.abs(vl)>45&&frame%3===0)particle(c.x-Math.cos(c.a)*20,c.y-Math.sin(c.a)*20,'#6b5d42',2,30)}
 c.slip=slip;c.yawRate=w;ca=Math.cos(c.a);sa=Math.sin(c.a);c.vx=ca*vl-sa*vt;c.vy=sa*vl+ca*vt;
 // Movement with real wall contact: bounce off the surface you hit, keep sliding along it, and spin from where you hit it.
 const z=c.z,probe=(x,y)=>{for(const off of [18,0,-17])if(blocked(x+Math.cos(c.a)*off,y+Math.sin(c.a)*off,12,z))return off;return null};
 const steps=Math.max(1,Math.ceil(Math.hypot(c.vx,c.vy)*dt/6));let hitN=0,hitOff=0;for(let i=0;i<steps;i++){const dx=c.vx*dt/steps,dy=c.vy*dt/steps;if(probe(c.x+dx,c.y+dy)===null){c.x+=dx;c.y+=dy;continue}
  let nx=0,ny=0;const ox=probe(c.x+dx,c.y),oy=probe(c.x,c.y+dy);if(ox===null){c.x+=dx;ny=dy>0?-1:1;hitOff=probe(c.x,c.y+dy)??0}else if(oy===null){c.y+=dy;nx=dx>0?-1:1;hitOff=ox}else{const sp=Math.hypot(c.vx,c.vy)||1;nx=-c.vx/sp;ny=-c.vy/sp;hitOff=ox}
  const vn=c.vx*nx+c.vy*ny;if(vn<0){const rx=Math.cos(c.a)*hitOff,ry=Math.sin(c.a)*hitOff,rn=rx*ny-ry*nx,J=-(1.22)*vn/(1+rn*rn/Iz);c.vx+=J*nx;c.vy+=J*ny;const tx=-ny,ty=nx,vtan=c.vx*tx+c.vy*ty;c.vx-=vtan*.07*tx;c.vy-=vtan*.07*ty;if(Math.abs(vtan)>90&&visible(c,40)){const px=c.x+rx-nx*12,py=c.y+ry-ny*12;for(let k=0;k<3;k++)particles.push({x:px,y:py,vx:tx*vtan*rand(.3,.7)+rand(-30,30),vy:ty*vtan*rand(.3,.7)+rand(-30,30),life:rand(.15,.35),max:.35,color:pick(['#ffd27a','#ffb347','#fff0b8']),size:rand(1.5,2.5)});if(c===player.car&&frame%6===0)sound('scrape')}c.yawRate+=clamp(rn*J/Iz*.45,-6,6);const tang=Math.atan2(ty,tx),da1=norm(tang-c.a),da2=norm(tang+Math.PI-c.a),da=Math.abs(da1)<Math.abs(da2)?da1:da2;if(Math.abs(da)<1.1&&-vn<260){c.a=norm(c.a+da*.4);c.yawRate*=.5}hitN=Math.max(hitN,-vn)}break}
 if(hitN>38&&c.impact<=0){c.hp-=(hitN-30)*.075;c.impact=.3;particle(c.x+Math.cos(c.a)*22,c.y+Math.sin(c.a)*22,'#d6b982',Math.min(16,4+hitN/20),70);if(c===player.car){shake=Math.max(shake,Math.min(6,hitN*.022));sound('crash',hitN/250);playerImpact(hitN);if(hitN>200)hitStop=Math.max(hitStop,.07)}}
 c.v=c.vx*Math.cos(c.a)+c.vy*Math.sin(c.a);if(c===player.car)save.stats.distance+=Math.hypot(c.vx,c.vy)*dt;
 if(!air&&Math.abs(c.v)>50&&(slip>.16||(brake&&Math.abs(c.v)>70))&&frame%2===0){skids.push({x:c.x,y:c.y,a:c.a,life:24});if(skids.length>320)skids.shift();if(slip>.3&&visible(c,40)&&frame%4===0)smoke.push({x:c.x-Math.cos(c.a)*18,y:c.y-Math.sin(c.a)*18,z:3,vx:rand(-8,8),vy:rand(-8,8),vz:rand(6,14),r:rand(7,11),life:1.2,max:1.2,dark:false})}
 if(c.hp<=0&&!c.burning)wreck(c);
}
function followRoad(c,dt,target,speed){if(!c.route.length)c.route=roadRoute(c,target);while(c.route.length>1&&dist(c,c.route[0])<35)c.route.shift();const p=c.route[0]||target,diff=norm(Math.atan2(p.y-c.y,p.x-c.x)-c.a);let corner=0;if(c.route.length>1){const next=c.route[1],angle=Math.atan2(next.y-p.y,next.x-p.x);corner=Math.abs(norm(angle-c.a));}const d=dist(c,p),desired=Math.min(speed,Math.abs(diff)>1.3?35:Math.abs(diff)>.55?65:speed,corner>.6&&d<150?Math.max(40,d*.7):speed);drive(c,dt,c.v<desired-3?1:c.v>desired+9?-.7:0,clamp(diff*2.3,-1,1),false);if(c.route.length===1&&d<45)c.route=[]}
function stars(){return heat<15?0:Math.min(5,Math.ceil(heat/20))}
const TIER=['','PATROLMAN','SQUAD CARS','ROADBLOCKS','DRY AGENTS','THE WHOLE BUREAU'];
function policeUpdate(c,dt){c.routeTime-=dt;c.fire-=dt;c.burstT=(c.burstT||0)-dt;const target=player.car||player,d=dist(c,target),st=stars();
 if(c.ai==='roadblock'){c.v=c.vx=c.vy=0;if(d<230||c.hp<c.maxHp*.98){c.ai='police';c.routeTime=0}return}
 const see=d<540&&(!player.air||player.air.z<110)&&lineClear(c,target);if(see){policeSeen=true;lawSaw(target)}
 if(c.parked){drive(c,dt,0,0,true);if(!(c.out>0)){c.parked=false;c.routeTime=0}}
 else if(c.reverse>0){c.reverse-=dt;drive(c,dt,-1,c.revSteer,false)}
 else if(see&&d<380){if(!player.car){const diff=norm(Math.atan2(target.y-c.y,target.x-c.x)-c.a);if(d>130)drive(c,dt,Math.abs(diff)>2.3?-.6:.75,clamp(diff*2.6,-1,1),false);else{drive(c,dt,0,clamp(diff*2,-1,1),true);if(Math.abs(c.v)<45&&st>=1&&(!player.air||player.air.z<18))deployCops(c)}}
  else{const pc=player.car,pa=pc.a,rx=c.x-pc.x,ry=c.y-pc.y,lx=rx*Math.cos(pa)+ry*Math.sin(pa),ly=-rx*Math.sin(pa)+ry*Math.cos(pa);let tx,ty;
   // PIT: from behind and beside, drive the nose into the rear corner to spin the car out.
   if(d<150&&Math.abs(pc.v)>80&&lx<-6&&Math.abs(ly)<46){const sd=Math.sign(ly)||1;tx=pc.x-Math.cos(pa)*18-Math.sin(pa)*sd*6;ty=pc.y-Math.sin(pa)*18+Math.cos(pa)*sd*6;c.pit=true;if(d<48&&!(c.pitT>elapsed)){c.pitT=elapsed+5;popup('PIT MANEUVER',pc.x,pc.y-36,'#a9c2ea')}}
   else{const lead=clamp(d/320,0,.55);tx=target.x+(pc.vx||0)*lead;ty=target.y+(pc.vy||0)*lead;c.pit=false}
   const diff=norm(Math.atan2(ty-c.y,tx-c.x)-c.a);drive(c,dt,Math.abs(diff)>2.3?-.7:1,clamp(diff*2.8,-1,1),Math.abs(diff)>1.1&&c.v>140)}}
 else{if(c.routeTime<0||!c.goal){c.goal=lawGoal(c);c.route=roadRoute(c,c.goal);c.routeTime=c.goal.fast?1.2:2}followRoad(c,dt,c.goal,carTypes[c.type].max*(c.goal.fast?.97:.7))}
 if(!c.parked&&Math.abs(c.v)<14&&Math.abs(c.throttle||0)>.4&&!c.reverse){c.stuck=(c.stuck||0)+dt;if(c.stuck>1){c.reverse=.75;c.revSteer=Math.random()>.5?1:-1;c.stuck=0}}else c.stuck=Math.max(0,(c.stuck||0)-dt);c.reverse=Math.max(0,(c.reverse||0));
 const manned=!(c.parked&&!(c.crew>0));if(!manned)c.burst=0;
 if(manned&&see&&d<470&&c.fire<0&&(c.type==='agent'||st>=3)){if(c.type==='agent')c.burst=4;else{enemyFire(c,'police');c.fire=rand(1.5,2.6)}}
 if(manned&&c.burst>0&&c.burstT<=0){enemyFire(c,'agent');c.burst--;c.burstT=.1;if(!c.burst)c.fire=rand(1.3,2.1)}
 if(d>2300&&st===0)c.remove=true}
function spawnPolice(){const st=stars(),cap=[0,1,2,3,4,6][st],live=cars.filter(c=>c.ai==='police'&&!c.dead&&!c.burning).length;if(live>=cap)return;const ref=LAW.search||player,candidates=WLD.driveNodes.filter(n=>{const dr=dist(n,ref),dp=dist(n,player);return dr<1150&&dr>(ref===player?560:250)&&dp>480&&n.links.length>1});if(!candidates.length)return;const p=pick(candidates),a=Math.atan2(ref.y-p.y,ref.x-p.x),agent=st>=4&&Math.random()<.55;if(blocked(p.x,p.y,16))return;cars.push(newCar(agent?'agent':'police',p.x,p.y,a,{ai:'police',routeTime:0,fire:rand(1.5,3),role:live%3===1?'cut':'chase',crew:2,out:0}))}
let roadblockTimer=10,lastStars=0;
function spawnRoadblock(){if(!player.car)return;const c=player.car,head=Math.atan2(c.vy,c.vx),cands=WLD.driveNodes.filter(n=>{const d=dist(n,c);if(d<480||d>900||n.links.length<2)return false;return Math.abs(norm(Math.atan2(n.y-c.y,n.x-c.x)-head))<.45});if(!cands.length)return;const n=pick(cands),a=Math.atan2(n.y-c.y,n.x-c.x)+Math.PI/2;const roadWidth=WLD.nearest(n).edge.road.width;let made=0;for(const off of roadWidth>=96?[-26,26]:[0]){const x=n.x+Math.cos(a)*off,y=n.y+Math.sin(a)*off;if(blocked(x,y,14))continue;cars.push(newCar('police',x,y,a+(off<0?0:Math.PI),{ai:'roadblock',routeTime:0,fire:rand(1,2)}));made++}if(made){toast('ROADBLOCK AHEAD · Smash through or find another street.');sound('alert')}}
function trafficUpdate(c,dt){c.hit=Math.max(0,c.hit-dt);if(c.reverse>0){c.reverse-=dt;drive(c,dt,-.8,c.revSteer||0,false);return}c.compT=(c.compT||0)-dt;if(c.compT<=0||c.comp===undefined){c.comp=WLD.nearest(c).edge.a.component;c.compT=1+Math.random()}const component=c.comp;if(!c.destination||c.destination.component!==component||dist(c,c.destination)<65){const connected=WLD.components[component],nearby=connected.filter(n=>dist(n,c)>400&&dist(n,c)<1700);c.destination=pick(nearby.length?nearby:connected.filter(n=>dist(n,c)>55));c.route=[]}if(!c.destination)return;const ahead={x:c.x+Math.cos(c.a)*60,y:c.y+Math.sin(c.a)*60},near=cars.some(o=>o!==c&&!o.dead&&Math.abs(o.x-ahead.x)<40&&Math.abs(o.y-ahead.y)<40&&dist(o,ahead)<38&&dist(o,c)>20);const gate=train&&CROSSINGS.some(cr=>crossingActive(cr)&&Math.hypot(cr.x-ahead.x,cr.y-ahead.y)<cr.w/2+30);followRoad(c,dt,c.destination,gate?0:near?10:c.speed);if(gate)c.jam=0;if(Math.abs(c.v)<8&&!gate){c.stuck=(c.stuck||0)+dt;c.jam=(c.jam||0)+dt;if(c.stuck>3.2){c.reverse=rand(.6,1.1);c.revSteer=Math.random()>.5?1:-1;c.stuck=0;c.route=[]}if(c.jam>14&&!visible(c,150))c.remove=true}else{c.stuck=Math.max(0,(c.stuck||0)-dt);if(Math.abs(c.v)>40)c.jam=0}}
function keepTraffic(){if(frame%90)return;const n=cars.filter(c=>c.ai==='traffic').length;if(n>=30)return;for(let k=0;k<2;k++){const edge=pick(WLD.driveEdges.filter(e=>e.d>110)),t=rand(.2,.8),dir=Math.random()>.5?1:-1,a=Math.atan2(edge.b.y-edge.a.y,edge.b.x-edge.a.x)+(dir<0?Math.PI:0),x=lerp(edge.a.x,edge.b.x,t)-Math.sin(a)*15,y=lerp(edge.a.y,edge.b.y,t)+Math.cos(a)*15,d=Math.hypot(x-player.x,y-player.y);if(d<700||d>1700||visible({x,y},120)||blocked(x,y,14)||cars.some(o=>Math.abs(o.x-x)<50&&Math.abs(o.y-y)<50))continue;cars.push(newCar(pick(['sedan','sedan','coupe','truck']),x,y,a,{ai:'traffic',speed:rand(50,88),color:pick(['#73674b','#56666a','#835f4c','#374e50','#777963','#485361','#695555'])}))}}

// ---------- Real history, a little at a time ----------
const FACTS=[
 {head:'Michigan Went Dry First',text:'Michigan banned alcohol statewide on May 1, 1918. That was almost two years before the national ban began.'},
 {head:'The 18th Amendment',text:'The states ratified the 18th Amendment in January 1919. National Prohibition began on January 17, 1920.'},
 {head:'Half a Percent',text:'The Volstead Act enforced Prohibition. It counted any drink stronger than 0.5 percent alcohol as illegal liquor.'},
 {head:'Over the President’s Veto',text:'President Woodrow Wilson vetoed the Volstead Act in October 1919. Congress passed it anyway.'},
 {head:'The Detroit Funnel',text:'The Detroit River is less than a mile wide in places. By some estimates, about three quarters of the liquor smuggled into the country crossed near Detroit.'},
 {head:'Made for Export',text:'Ontario banned selling liquor, but its distilleries could still make it legally for export. A lot of that export only went as far as the other side of the Detroit River.'},
 {head:'Driving on the River',text:'In winter, smugglers drove loaded cars straight across the frozen Detroit River. Some of those cars broke through the ice.'},
 {head:'The Purple Gang',text:'Detroit’s Purple Gang controlled much of the city’s bootlegging in the late 1920s.'},
 {head:'The Anti-Saloon League',text:'The Anti-Saloon League was one of the strongest pressure groups of the Progressive Era. It won Prohibition state by state before pushing for a national amendment.'},
 {head:'The Temperance Women',text:'The Woman’s Christian Temperance Union was founded in 1874. Its members blamed alcohol for poverty and for violence at home.'},
 {head:'Speak Easy',text:'Customers were warned to speak quietly about illegal bars. That advice is the usual explanation for the name speakeasy.'},
 {head:'Built for Speed',text:'Bootleggers put bigger engines and stiffer springs in ordinary cars so the cargo would not show. Moonshine runners later helped start stock car racing.'},
 {head:'Caught on Taxes',text:'Al Capone was never convicted for bootlegging. In 1931 a federal jury convicted him of income tax evasion.'},
 {head:'Not Enough Agents',text:'Federal Prohibition agents were nicknamed dry agents. There were only a few thousand of them for the entire country.'},
 {head:'Repeal',text:'Prohibition ended when the 21st Amendment was ratified on December 5, 1933. It is the only amendment that cancels another one.'},
 {head:'Michigan Went Wet First Too',text:'Michigan was the first state to ratify the 21st Amendment, on April 10, 1933.'},
 {head:'Doctor’s Orders',text:'Doctors could still legally prescribe whiskey as medicine during Prohibition, and many patients suddenly needed it.'},
 {head:'Poison Liquor',text:'Cheap homemade liquor was sometimes made with industrial alcohol. Bad batches blinded or killed drinkers.'},
 {head:'The Wickersham Report',text:'In 1931 a commission appointed by President Hoover reported that Prohibition enforcement was failing.'},
 {head:'Sacramental Wine',text:'The Volstead Act still allowed wine for religious services, so some congregations grew very quickly.'}];
function nextFact(){const i=(save.factIndex||0)%FACTS.length;save.factIndex=i+1;return FACTS[i]}
let paperTimer=0;
function showPaper(o){const el=$('paper');el.innerHTML=`<div class="paper-inner"><div class="masthead">${o.kicker}</div><h3>${o.headline}</h3>${o.deck?`<p class="deck">${o.deck}</p>`:''}${o.fact?`<div class="fact"><b>THE REAL STORY · ${o.fact.head}</b>${o.fact.text}</div>`:''}<small>CLICK TO CLOSE</small></div>`;el.classList.remove('hidden');el.classList.remove('show');void el.offsetWidth;el.classList.add('show');paperTimer=o.fact&&!o.deck?11:9}
function hidePaper(){paperTimer=0;$('paper').classList.remove('show');$('paper').classList.add('hidden')}
// ---------- Floating text and style cash ----------
const popups=[];let styleMult=1,styleTimer=0,driftTime=0,driftCalm=0,bigTimer=0;
function popup(text,x,y,color='#f3d38a'){popups.push({text,x,y,life:1.6,max:1.6,color});if(popups.length>20)popups.shift()}
function bigText(text,dur=1,color='#f1e3b8'){const el=$('bigtext');el.textContent=text;el.style.color=color;el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop');bigTimer=dur}
function styleBonus(label,base,extra=''){const cash=Math.max(.05,SHOP.round(base*styleMult)),at=player.car||player;save.cash=SHOP.round(save.cash+cash);save.stats.earnings=SHOP.round(save.stats.earnings+cash);popup(label+(extra?' '+extra:'')+'  +'+money(cash)+(styleMult>1?'  ×'+styleMult:''),at.x,at.y-36);styleMult=Math.min(5,styleMult+1);styleTimer=4.5;sound('coin')}
function playerImpact(speed){if(speed>115){if(driftTime>.5)popup('DRIFT BUSTED',player.x,player.y-36,'#df866d');driftTime=0;if(styleMult>1)popup('STYLE LOST',player.x,player.y-52,'#df866d');styleMult=1;styleTimer=0}}
function styleTick(dt){if(styleTimer>0){styleTimer-=dt;if(styleTimer<=0)styleMult=1}const c=player.car;if(!c||c.z>0||c.burning)return;const fwd=c.vx*Math.cos(c.a)+c.vy*Math.sin(c.a),lat=-c.vx*Math.sin(c.a)+c.vy*Math.cos(c.a);if(Math.abs(lat)>55&&fwd>95){driftTime+=dt;driftCalm=0}else if(driftTime>0){driftCalm+=dt;if(driftCalm>.3){if(driftTime>.7)styleBonus('DRIFT',driftTime*1.1,driftTime.toFixed(1)+'s');driftTime=0}}
 if(fwd>170)for(const o of cars){if(o===c||o.dead||o.nearCd>0||o.ai==='parked'||o.ai==='roadblock')continue;const d=dist(o,c);if(d<54&&d>34){o.nearCd=5;styleBonus(o.ai==='police'?'TOO CLOSE FOR COMFORT':'NEAR MISS',o.ai==='police'?1:.5)}}}
// ---------- Car on car contact ----------
function carCircles(c){const tr=c.type==='truck',off=tr?17:13,r=tr?15:12.5,ca=Math.cos(c.a),sa=Math.sin(c.a);return[{x:c.x+ca*off,y:c.y+sa*off,r},{x:c.x-ca*off,y:c.y-sa*off,r}]}
function nudge(c,dx,dy){if(!blocked(c.x+dx,c.y+dy,12,c.z||0)){c.x+=dx;c.y+=dy}}
function collideCars(){const act=cars.filter(c=>!c.remove&&(c.z||0)<12&&dist(c,player)<1400);for(let i=0;i<act.length;i++){const A=act[i],ca=carCircles(A);for(let j=i+1;j<act.length;j++){const B=act[j];if(Math.abs(A.x-B.x)>72||Math.abs(A.y-B.y)>72)continue;let best=null;for(const a of ca)for(const b of carCircles(B)){const dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy),o=a.r+b.r-d;if(o>0&&(!best||o>best.o))best={o,nx:d?dx/d:1,ny:d?dy/d:0,px:(a.x+b.x)/2,py:(a.y+b.y)/2}}if(best)carHit(A,B,best)}}
 if(!player.car&&!deathPending)for(const c of act){const sp=Math.hypot(c.vx||0,c.vy||0);if(c.dead||(c.z||0)>10)continue;const hit=carContact(c,player,9);if(!hit)continue;if(sp>70&&player.invincible<=0){const a=Math.atan2(player.y-c.y,player.x-c.x);player.knock=.7;player.kx=c.vx*.75+Math.cos(a)*120;player.ky=c.vy*.75+Math.sin(a)*120;damagePlayer(sp*.12,'Hit by a car');player.invincible=.8;sound('thud');shake=Math.max(shake,4)}else{moveBody(player,hit.nx*hit.depth,hit.ny*hit.depth,9);if(sp<20){player.vx*=.5;player.vy*=.5}}}}
function carHit(A,B,h){const mA=A.dead?3:MASS[A.type]||1,mB=B.dead?3:MASS[B.type]||1,tot=mA+mB;nudge(A,h.nx*h.o*mB/tot,h.ny*h.o*mB/tot);nudge(B,-h.nx*h.o*mA/tot,-h.ny*h.o*mA/tot);const rv=((A.vx||0)-(B.vx||0))*h.nx+((A.vy||0)-(B.vy||0))*h.ny;if(rv>=0)return;const imp=-1.3*rv/(1/mA+1/mB);A.vx+=imp/mA*h.nx;A.vy+=imp/mA*h.ny;B.vx-=imp/mB*h.nx;B.vy-=imp/mB*h.ny;
 const tq=(c,s)=>clamp(((h.px-c.x)*h.ny-(h.py-c.y)*h.nx)*s*imp*.0011/(c.dead?3:MASS[c.type]||1),-4.5,4.5);A.spin=(A.spin||0)+tq(A,1);B.spin=(B.spin||0)-tq(B,1);for(const c of [A,B]){c.v=c.vx*Math.cos(c.a)+c.vy*Math.sin(c.a);c.knock=true}
 const sp=-rv;if(sp<35)return;const pc=player.car,mine=A===pc||B===pc,other=A===pc?B:A;for(const [c,m,o,hitter] of [[A,mA,mB,B],[B,mB,mA,A]])if(!c.dead){const rammed=hitter===pc&&(c.rival||c.missionTruck||c.ai==='police'||c.ai==='roadblock')?2.6:1;c.hp-=(sp*sp/2500+sp*.02)*Math.sqrt(o/m)*rammed;c.hit=.1;if(c.hp<=0)wreck(c)}particle(h.px,h.py,'#efcf8a',Math.min(16,4+sp/25),60+sp*.3);if(mine||visible(A,40))sound('crash',sp/260);if(mine){shake=Math.max(shake,Math.min(6,sp*.022));playerImpact(sp);if(sp>220)hitStop=Math.max(hitStop,.07);if(other.ai==='traffic')addHeat(sp>130?4:1);if(other.ai==='police'||other.ai==='roadblock'){if(other.ai==='roadblock'){other.ai='police';styleBonus('ROADBLOCK SMASHED',2)}addHeat(1.5)}}}
function slideWreck(c,dt){const sp=Math.hypot(c.vx||0,c.vy||0);if(sp<2&&!(c.z>0))return;if(c.z>0||c.vz>0){c.vz-=700*dt;c.z+=c.vz*dt;if(c.z<=0){c.z=0;c.vz=0}}const k=Math.exp(-dt*2.6);c.vx*=k;c.vy*=k;c.a+=(c.spin||0)*dt;c.spin=(c.spin||0)*Math.exp(-dt*2);const dx=c.vx*dt,dy=c.vy*dt;if(!blocked(c.x+dx,c.y,13,c.z))c.x+=dx;else c.vx*=-.3;if(!blocked(c.x,c.y+dy,13,c.z))c.y+=dy;else c.vy*=-.3}
// ---------- Things that break ----------
function propHits(){for(const c of cars){if(c.dead||(c.z||0)>8)continue;const sp=Math.hypot(c.vx||0,c.vy||0);if(sp<35)continue;if(c!==player.car&&!visible(c,250))continue;for(const p of nearbyProps(c.x,c.y,40))if(Math.hypot(c.x-p.x,c.y-p.y)<p.r+17)smashProp(p,c)}}
function smashProp(p,c,byBullet=false){if(p.broken)return;p.broken=true;p.respawn=100;p.fallA=c?Math.atan2(c.vy||0,c.vx||0):rand(0,TAU);const col={crate:'#a07c4c',lamp:'#d9c58e',xbarrel:'#b0503a',barrel:'#6f5a3c'}[p.type];particle(p.x,p.y,col,p.type==='lamp'?6:12,90);if(c){const k=p.type==='lamp'?.82:.9;c.vx*=k;c.vy*=k;c.v=c.vx*Math.cos(c.a)+c.vy*Math.sin(c.a);c.knock=true}
 if(p.type==='xbarrel'){blast(p.x,p.y,1,(c===player.car||byBullet)?'player':'');return}
 if(p.type==='crate'){const va=c?Math.atan2(c.vy||0,c.vx||0):rand(0,TAU),vs=c?Math.hypot(c.vx||0,c.vy||0)*.5:60;for(let i=0;i<5;i++){const a=va+rand(-.9,.9),v=rand(.4,1)*vs+rand(20,60);debris.push({x:p.x,y:p.y,z:6,vx:Math.cos(a)*v,vy:Math.sin(a)*v,vz:rand(70,170),a:rand(0,TAU),spin:rand(-12,12),life:3.2,size:rand(6,10),color:pick(['#8a6a3f','#9b7a4b','#6f5433'])})}}
 if(p.type==='barrel')for(let i=0;i<9;i++)particles.push({x:p.x,y:p.y,vx:rand(-55,55),vy:rand(-55,55),life:rand(.5,1.1),max:1.1,color:'#7a5428',size:rand(2,4)});
 if(visible(p,80))sound(p.type==='lamp'?'glass':'smash');if(c===player.car||byBullet){save.stats.smashed=(save.stats.smashed||0)+1;if(p.type==='lamp')styleBonus('LIGHTS OUT',.25);else{const v=SHOP.round(.1*styleMult);popup('+'+money(v),p.x,p.y-14,'#d8c08a');save.cash=SHOP.round(save.cash+v)}}}
function propTick(dt){if(frame%30)return;for(const p of props){if(p.fuse!==undefined){continue}if(p.broken&&!p.temp){p.respawn-=.5;if(p.respawn<=0&&!visible(p,120))p.broken=false}}}
function blast(x,y,power=1,src=''){const at={x,y},dP=dist(at,player);shake=Math.max(shake,clamp(13-dP/55,1.5,13));sound('explode');particle(x,y,'#e9b55c',40,210);particle(x,y,'#f6e2a4',16,120);blastRings.push({x,y,life:.65});scorches.push({x,y,r:rand(40,52)*power,life:45});if(scorches.length>24)scorches.shift();for(let i=0;i<(quality>=1?18:9);i++){const a=rand(0,TAU),v=rand(20,150);flames.push({x,y,z:rand(4,14),vx:Math.cos(a)*v,vy:Math.sin(a)*v,vz:rand(20,90),r:rand(13,28)*power,life:rand(.45,.9),max:.9,ball:1})}for(let i=0;i<14;i++){const a=rand(0,TAU),v=rand(50,190);debris.push({x,y,z:10,vx:Math.cos(a)*v,vy:Math.sin(a)*v,vz:rand(95,230),a:rand(0,TAU),spin:rand(-8,8),life:3.8,size:rand(3,9),color:pick(['#879083','#403d32','#b08b56','#242f30','#6d3a2c'])})}for(let i=0;i<14;i++)emitSmoke({x,y,a:0},true);
 for(const c of cars){if(c.dead)continue;const d=dist(c,at);if(d<125){const f=(125-d)/125;c.hp-=f*150*power;const a=Math.atan2(c.y-y,c.x-x);c.vx+=Math.cos(a)*f*340;c.vy+=Math.sin(a)*f*340;c.vz=Math.max(c.vz||0,f*240);c.z=Math.max(c.z||0,.5);c.spin=(c.spin||0)+rand(-4,4)*f;c.knock=true;c.v=c.vx*Math.cos(c.a)+c.vy*Math.sin(c.a);if(c.hp<=0&&!c.burning)wreck(c)}}
 for(const e of enemies)if(e.hp>0&&dist(e,at)<115){e.hp=0;killEnemy(e)}
 for(const p of nearbyProps(x,y,110)){const d=dist(p,at);if(p.type==='xbarrel'){if(d<90&&p.fuse===undefined){p.fuse=rand(.12,.28)}}else if(d<85)smashProp(p,null)}
 if(!player.car&&!player.air&&dP<105)damagePlayer((105-dP)*.95,'Caught in an explosion');if(src==='player')addHeat(5)}
function fuseTick(dt){for(const p of props)if(p.fuse!==undefined&&!p.broken){p.fuse-=dt;if(p.fuse<=0){delete p.fuse;smashProp(p,null,true)}}}
// ---------- The law: busted meter and the respray ----------
let bustMeter=0,respray=0,resprayWarn=0;
function lawTick(dt){const st=stars();resprayWarn-=dt;
 if(respray>0){respray-=dt;const c=player.car;if(c){c.v=c.vx=c.vy=0}bustMeter=0;if(frame%3===0)particle(player.x+rand(-26,26),player.y+rand(-26,26),pick(['#c9d0c0','#9fb7c9','#d8c9a8','#b5947a']),2,25);if(respray<=0){heat=0;if(c){c.hp=c.maxHp;if(!c.owned)c.color=pick(['#5a3d4d','#3b5a4a','#6a5a3a','#30424f','#7a3e32'])}for(const k of cars)if(k.ai==='police'||k.ai==='roadblock'){k.ai='parked';k.retire=6}save.stats.escapes++;toast('FRESH PAINT · The police lost your description.');sound('cash')}return}
 if(st&&!player.air){const spd=player.car?Math.abs(player.car.v):Math.hypot(player.vx||0,player.vy||0),near=cars.some(c=>c.ai==='police'&&!c.dead&&!c.burning&&dist(c,player)<(player.car?84:98))||enemies.some(e=>e.cop&&e.hp>0&&!e.remove&&dist(e,player)<62);if(near&&spd<(player.car?32:70))bustMeter+=dt*(player.knock>0?1.8:1);else bustMeter=Math.max(0,bustMeter-dt*1.4);if(bustMeter>(player.car?2.3:1.6)){bustMeter=0;getPinched();return}}else bustMeter=0;
 if(st&&player.car&&!player.car.burning&&!interior&&dist(player,places[0])<74&&Math.abs(player.car.v)<60){const cost=SHOP.round(2+st*1.5);if(save.cash>=cost){save.cash=SHOP.round(save.cash-cost);respray=1.5;sound('spray');toast('BELL & SONS RESPRAY · '+money(cost)+' · Hold still.')}else if(resprayWarn<=0){toast('Sal will not respray on credit. You need '+money(cost)+'.');resprayWarn=6}}}
function getPinched(){if(deathPending||deathReport)return;deathPending=true;save.stats.busts=(save.stats.busts||0)+1;sound('busted');endLife('Pinched by the police','busted')}
// ---------- Law and crew AI ----------
// The police know only what they saw or were told. A sighting or a reported crime sets a search circle on the
// minimap. Squad cars drive to it and comb its streets, and it widens while nobody has eyes on you. Out of sight
// and outside the circle, the heat drains fast. Officers step out to run down a suspect on foot.
const LAW={search:null,seenAt:-99,gen:0,known:null,genAt:null};
let throws=[],crewBarkT=0,crewId=0;
function lawSaw(o,report=false){const vx=o.vx||0,vy=o.vy||0;LAW.known={x:o.x,y:o.y,vx,vy,v:Math.hypot(vx,vy)};if(!report)LAW.seenAt=elapsed;const r=report?190:110;if(!LAW.search)LAW.search={x:o.x,y:o.y,r};else{LAW.search.x=o.x;LAW.search.y=o.y;LAW.search.r=Math.min(LAW.search.r,r)}if(!LAW.genAt||dist(LAW.genAt,o)>60){LAW.gen++;LAW.genAt={x:o.x,y:o.y}}}
function lawHidden(){return elapsed-LAW.seenAt>1.5}
function outsideSearch(){const sr=LAW.search;return !sr||dist(player,sr)>sr.r}
function lawBrainTick(dt){const st=stars();if(!st){LAW.search=null;LAW.known=null;LAW.genAt=null}else{if(!LAW.search)lawSaw(player.car||player,true);if(!policeSeen)LAW.search.r=Math.min(520,LAW.search.r+dt*24)}if(frame%10===0)$('heat').classList.toggle('searching',!!st&&lawHidden())}
function lawGoal(c){const sr=LAW.search,k=LAW.known;
 if(c.role==='cut'&&k&&k.v>110&&elapsed-LAW.seenAt<5){const n=WLD.nearest({x:clamp(k.x+k.vx*1.9,60,WORLD-60),y:clamp(k.y+k.vy*1.9,60,WORLD_H-60)});return{x:n.x,y:n.y,fast:true}}
 if(!sr)return{x:player.x,y:player.y,fast:true};
 if(elapsed-LAW.seenAt<2.5||dist(c,sr)>sr.r)return{x:sr.x,y:sr.y,fast:true};
 if(!c.searchPt||c.searchGen!==LAW.gen||dist(c,c.searchPt)<80){const ns=WLD.driveNodes.filter(n=>dist(n,sr)<sr.r&&n.links.length>1);c.searchPt=ns.length?pick(ns):{x:sr.x,y:sr.y};c.searchGen=LAW.gen}
 return{x:c.searchPt.x,y:c.searchPt.y,fast:false}}
function deployCops(c){if(c.parked||!c.crew)return;const n=Math.min(c.crew,stars()>=3?2:1);let made=0,last=null;for(let i=0;i<n;i++){const side=i?-1:1,x=c.x-Math.sin(c.a)*24*side,y=c.y+Math.cos(c.a)*24*side;if(blocked(x,y,9))continue;last=makeCrew(c.type==='agent'?'agent':'cop',x,y,{car:c});last.aware=true;last.a=Math.atan2(player.y-y,player.x-x);enemies.push(last);made++}if(made){c.crew-=made;c.out=(c.out||0)+made;c.parked=true;bark(last,c.type==='agent'?'FEDERAL AGENTS! FREEZE!':'POLICE! HOLD IT RIGHT THERE!',true)}}
// Rival crews and officers on foot share one brain with different temperaments.
const CREW={
 gunman:{hp:70,speed:72,see:480,prefer:220,mag:6,reload:1.7,aim:.45,gap:.5,volley:2,dmg:7,spread:.11,pellets:1,snd:'enemyshot',look:['fedora','#2b2e30','#141617','#7c3127']},
 rusher:{hp:90,speed:116,see:420,prefer:55,mag:2,reload:1.5,aim:.38,gap:.45,volley:1,dmg:5,spread:.24,pellets:5,snd:'shotgun',look:['cap','#4a3b2c','#3a3026','#00000066']},
 tommy:{hp:120,speed:48,see:520,prefer:280,mag:24,reload:2.4,aim:.7,gap:.09,volley:5,dmg:4,spread:.16,pellets:1,snd:'tommy',look:['fedora','#45474c','#0e0f10','#c9a961']},
 cop:{hp:60,speed:120,see:460,prefer:0,mag:6,reload:1.8,aim:.5,gap:.6,volley:2,dmg:7,spread:.1,pellets:1,snd:'enemyshot',look:['cap','#25324a','#1b2333','#c9a961'],law:true},
 agent:{hp:80,speed:112,see:500,prefer:160,mag:20,reload:2,aim:.5,gap:.1,volley:4,dmg:6,spread:.12,pellets:1,snd:'tommy',look:['fedora','#3a3a36','#1a1a18','#00000066'],law:true}};
function makeCrew(kind,x,y,extra={}){const D=CREW[kind],[hat,coat,hatC,band]=D.look;crewId++;return{x,y,a:rand(0,TAU),hp:D.hp,maxHp:D.hp,fire:rand(.3,.8),hit:0,kind,def:D,cop:!!D.law,state:'engage',t:0,ammo:D.mag,reloadT:0,aimT:0,volley:0,gapT:0,supp:0,aware:false,sees:false,seeT:rand(0,.2),hiddenT:0,lastX:x,lastY:y,stuck:0,strafe:Math.random()<.5?-1:1,dyn:0,dynT:3,flankPt:null,flankT:0,look:{hat,coat,hatC,band,skin:SKINS[crewId%SKINS.length],gun:true},...extra}}
function spawnCrew(center,kinds,o={}){const out=[];kinds.forEach((kind,i)=>{const a=i*TAU/kinds.length+rand(-.3,.3);let x=center.x+Math.cos(a)*rand(o.near||50,o.far||105),y=center.y+Math.sin(a)*rand(o.near||50,o.far||105);for(let k=0;k<8&&blocked(x,y,10);k++){x=center.x+rand(-60,60);y=center.y+rand(-60,60)}const e=makeCrew(kind,x,y,{job:!!o.job});if(kind==='tommy')e.dyn=2;enemies.push(e);out.push(e)});return out}
function crewMix(n){const out=['tommy'];for(let i=1;i<n;i++)out.push(i%3===2?'rusher':'gunman');return out}
function bark(e,text,force=false){if(!e||(!force&&crewBarkT>0)||!visible(e,80))return;crewBarkT=1.3;popup(text,e.x,e.y-30,e.cop?'#a9c2ea':'#eab58e')}
function wakeCrew(e){if(e.aware)return;e.aware=true;e.t=0;e.fire=rand(.25,.6);bark(e,e.cop?'POLICE! HOLD IT!':pick(['THERE HE IS!','GET HIM!','WE GOT COMPANY!','IT\'S A RAT!']));for(const o of enemies)if(o!==e&&!o.aware&&o.hp>0&&o.cop===e.cop&&dist(o,e)<340){o.aware=true;o.fire=rand(.4,1)}}
function crewHurt(e){e.aimT=0;e.supp=Math.min(2.2,e.supp+.5);if(!e.aware)wakeCrew(e)}
function startReload(e){if(e.reloadT>0)return;e.reloadT=e.def.reload;e.volley=0;e.aimT=0;if(e.def.mag>2)bark(e,'RELOADING!')}
function peekFrom(p){const a=Math.atan2(player.y-p.y,player.x-p.x);for(const [f,sd] of [[0,22],[0,-22],[10,30],[10,-30],[18,0]]){const x=p.x+Math.cos(a)*f-Math.sin(a)*sd,y=p.y+Math.sin(a)*f+Math.cos(a)*sd;if(!blocked(x,y,9)&&lineClear({x,y},player))return{x,y}}return null}
function pathClear(a,b,r=8){const d=dist(a,b),n=Math.ceil(d/8);for(let i=1;i<=n;i++)if(blocked(lerp(a.x,b.x,i/n),lerp(a.y,b.y,i/n),r))return false;return true}
function findCover(e){if(e.cover&&dist(e,e.cover)<130&&!lineClear(e.cover,player)&&pathClear(e,e.cover)){const pk=peekFrom(e.cover);if(pk){e.peek=pk;e.coverT=elapsed+4;return true}}let best=null,bs=1e9;for(let i=0;i<32;i++){const ring=i>>3,a=(i&7)/8*TAU+ring*.4+rand(-.12,.12),r=[34,56,80,106][ring],x=e.x+Math.cos(a)*r,y=e.y+Math.sin(a)*r;if(blocked(x,y,10))continue;const p={x,y};if(lineClear(p,player)||!pathClear(e,p))continue;const dp=dist(p,player);if(dp<80)continue;const pk=peekFrom(p);if(!pk)continue;const sc=r+Math.abs(dp-e.def.prefer)*.3;if(sc<bs){bs=sc;best={p,pk}}}if(!best)return false;e.cover=best.p;e.peek=best.pk;e.coverT=elapsed+4;return true}
function detour(e){for(let k=0;k<4;k++){const a=Math.atan2(e.lastY-e.y,e.lastX-e.x)+e.strafe*rand(.9,1.7),r=rand(60,110),p={x:e.x+Math.cos(a)*r,y:e.y+Math.sin(a)*r};if(!blocked(p.x,p.y,10)){e.flankPt=p;e.flankT=elapsed+2.5;return true}e.strafe*=-1}return false}
function pickFlank(e){const a0=Math.atan2(e.y-player.y,e.x-player.x),r=Math.max(120,e.def.prefer);for(const off of [1.1,-1.1,1.7,-1.7]){const p={x:player.x+Math.cos(a0+off)*r,y:player.y+Math.sin(a0+off)*r};if(!blocked(p.x,p.y,10)&&lineClear(p,player)){e.flankPt=p;e.flankT=elapsed+4;e.t=3;bark(e,'GO AROUND!');return}}e.t=2}
function crewShot(e){const D=e.def,tv=player.car||player,lead=dist(e,player)/520*.5,tx=player.x+(tv.vx||0)*lead,ty=player.y+(tv.vy||0)*lead,a=Math.atan2(ty-e.y,tx-e.x),sp=D.spread*(1+e.supp*.5+(e.hit>0?.6:0));e.ammo--;for(let i=0;i<D.pellets;i++){const ang=a+rand(-sp,sp),v=D.pellets>1?rand(430,520):520;bullets.push({x:e.x+Math.cos(a)*20,y:e.y+Math.sin(a)*20,vx:Math.cos(ang)*v,vy:Math.sin(ang)*v,life:D.pellets>1?.45:1,damage:D.dmg,from:e.cop?'police':'enemy',lastX:e.x,lastY:e.y})}if(visible(e,60)){flashes.push({x:e.x+Math.cos(a)*20,y:e.y+Math.sin(a)*20,a,life:.06,s:D.pellets>1?1.4:1});sound(D.snd,.5)}particle(e.x+Math.cos(a)*24,e.y+Math.sin(a)*24,'#e6c47a',3,35)}
// Every volley starts with a short, visible aim so the player can read it and react.
function crewTrigger(e,dt,d){const D=e.def;if(e.reloadT>0||e.ammo<=0){e.aimT=0;e.volley=0;return}
 const can=e.sees&&d<D.see*.92&&(e.state==='engage'||e.state==='peek')&&(!e.cop||e.kind==='agent'||stars()>=3);
 if(e.volley>0){e.gapT-=dt;if(e.gapT<=0){if(!e.sees){e.volley=0;return}crewShot(e);e.volley--;e.gapT=D.gap;if(e.ammo<=0)e.volley=0;if(!e.volley)e.fire=rand(1,1.8)*(e.cop?1.3:1)}return}
 e.fire-=dt;
 if(e.aimT>0){if(!can){e.aimT=0;return}e.aimT-=dt;if(e.aimT<=0){e.volley=Math.min(D.volley,e.ammo);e.gapT=0}return}
 if(can&&e.fire<=0)e.aimT=D.aim*(1+e.supp*.4)}
function moveCrew(e,tx,ty,spd,dt){const dd=Math.hypot(tx-e.x,ty-e.y);if(dd<2)return;const bx=e.x,by=e.y;moveBody(e,(tx-e.x)/dd*Math.min(spd*dt,dd),(ty-e.y)/dd*Math.min(spd*dt,dd),9);if(Math.hypot(e.x-bx,e.y-by)<Math.min(spd*dt,dd)*.25){e.stuck+=dt;if(e.stuck>.6){e.stuck=0;e.strafe*=-1;detour(e)}}else e.stuck=Math.max(0,e.stuck-dt)}
function crewTick(e,dt){const D=e.def;e.hit=Math.max(0,e.hit-dt);e.supp=Math.max(0,e.supp-dt*.7);e.t-=dt;e.dynT-=dt;
 if(e.reloadT>0){e.reloadT-=dt;if(e.reloadT<=0)e.ammo=D.mag}
 const d=dist(e,player);if((e.seeT-=dt)<=0){e.seeT=.15+Math.random()*.1;e.sees=d<D.see&&lineClear(e,player)}
 for(const b of bullets)if(b.from==='player'&&b.nearE!==e&&Math.abs(b.x-e.x)<46&&Math.abs(b.y-e.y)<46){b.nearE=e;e.supp=Math.min(2.2,e.supp+.8);if(!e.aware)wakeCrew(e)}
 if(!e.aware){if((e.sees&&d<D.see*.75)||e.hit>0)wakeCrew(e);else{if(Math.random()<dt*.4)e.a+=rand(-1,1);return}}
 if(e.sees){e.hiddenT=0;e.lastX=player.x;e.lastY=player.y;if(e.cop&&stars()&&!player.car){policeSeen=true;lawSaw(player)}}else e.hiddenT+=dt;
 if(e.cop){copTick(e,dt,d);return}
 if(e.state==='engage'&&e.t<=0){if((e.supp>1||e.ammo<=0||(e.hit>0&&e.hp<e.maxHp*.5))&&e.kind!=='rusher'){if(findCover(e)){e.state='cover';e.flankPt=null;e.t=rand(.9,1.7);if(e.ammo<=0)startReload(e);else if(e.supp>1)bark(e,pick(['KEEP YOUR HEAD DOWN!','COVER ME!','HE\'S SHOOTING!']))}else e.t=1.2}else if(e.kind==='gunman'&&e.hiddenT>2.5&&!e.flankPt)pickFlank(e)}
 if(e.ammo<=0&&e.reloadT<=0)startReload(e);
 if(e.kind==='gunman'&&e.hp<e.maxHp*.25&&!e.fled){e.fled=true;e.state='flee';e.t=2.2;bark(e,pick(['I\'M HIT!','FALL BACK!']),true)}
 let tx=e.x,ty=e.y,spd=D.speed;
 if(e.state==='cover'){const c=e.cover;if(!c||(dist(e,c)<10&&lineClear(c,player))||(dist(e,c)>10&&elapsed>e.coverT)){e.state='engage';e.t=.8}else if(dist(e,c)>6){tx=c.x;ty=c.y;spd*=1.25}else if(e.t<=0&&e.reloadT<=0){e.state='peek';e.t=2.2}}
 else if(e.state==='peek'){const p=e.peek||e.cover;tx=p.x;ty=p.y;if(e.t<=0||e.ammo<=0||e.supp>1.4){const back=e.supp>1.4||e.ammo<=0;e.state=back?'cover':'engage';e.t=rand(.8,1.6);if(e.ammo<=0)startReload(e)}}
 else if(e.state==='flee'){const a=Math.atan2(e.y-player.y,e.x-player.x);tx=e.x+Math.cos(a)*60;ty=e.y+Math.sin(a)*60;spd*=1.2;if(e.t<=0){e.state=findCover(e)?'cover':'engage';e.t=1.5}}
 else{if(e.flankPt&&(dist(e,e.flankPt)<14||elapsed>e.flankT||(e.sees&&e.kind!=='gunman')))e.flankPt=null;
  if(e.flankPt){tx=e.flankPt.x;ty=e.flankPt.y;spd*=1.15}
  else if(e.sees){const a=Math.atan2(player.y-e.y,player.x-e.x),fwd=d>D.prefer*1.2?1:d<D.prefer*.6&&e.kind!=='rusher'?-.8:0;tx=e.x+(Math.cos(a)*fwd-Math.sin(a)*e.strafe*.55)*40;ty=e.y+(Math.sin(a)*fwd+Math.cos(a)*e.strafe*.55)*40;if(Math.random()<dt*.5)e.strafe*=-1}
  else{tx=e.lastX;ty=e.lastY}}
 if(e.aimT>0||e.volley>0)spd*=e.kind==='rusher'?.6:.15;
 moveCrew(e,tx,ty,spd,dt);
 e.a=e.sees||e.aimT>0?Math.atan2(player.y-e.y,player.x-e.x):Math.hypot(tx-e.x,ty-e.y)>2?Math.atan2(ty-e.y,tx-e.x):e.a;
 crewTrigger(e,dt,d);
 if(e.dyn>0&&e.hiddenT>2.2&&d<330&&d>110&&e.dynT<=0&&(!player.car||Math.abs(player.car.v)<60))throwDynamite(e,e.lastX,e.lastY)}
// Officers on foot run the suspect down. A walking suspect gets tackled. A sprint stays ahead of them.
function copTick(e,dt,d){const D=e.def,c=e.car,goHome=!!player.car||!stars();let tx=player.x,ty=player.y,spd=D.speed;e.tackleT=(e.tackleT||0)-dt;
 if(goHome){e.aimT=0;e.volley=0;if(c&&!c.dead&&!c.burning){tx=c.x;ty=c.y;if(dist(e,c)<28){e.remove=true;c.out=Math.max(0,(c.out||0)-1);c.crew++;return}}else{if(!visible(e,120))e.remove=true;tx=e.x+Math.cos(e.a)*50;ty=e.y+Math.sin(e.a)*50}}
 else if(!e.sees){const k=LAW.known&&e.hiddenT>1?LAW.known:null;tx=k?k.x:e.lastX;ty=k?k.y:e.lastY}
 if(e.flankPt){if(dist(e,e.flankPt)<12||elapsed>e.flankT)e.flankPt=null;else{tx=e.flankPt.x;ty=e.flankPt.y}}
 if(e.aimT>0||e.volley>0)spd*=.15;
 if(Math.hypot(tx-e.x,ty-e.y)>(goHome?4:16))moveCrew(e,tx,ty,spd,dt);
 e.a=Math.atan2(ty-e.y,tx-e.x);if(!goHome&&e.sees)e.a=Math.atan2(player.y-e.y,player.x-e.x);
 if(goHome||interior)return;
 if(!player.car&&d<24&&e.tackleT<=0&&!(player.knock>0)&&player.invincible<=0){const run=keys.ShiftLeft||keys.ShiftRight,sp=Math.hypot(player.vx||0,player.vy||0);if(!run||sp<120){e.tackleT=3;const a=Math.atan2(player.y-e.y,player.x-e.x);player.knock=.7;player.kx=Math.cos(a)*110;player.ky=Math.sin(a)*110;player.vx=player.vy=0;sound('thud');shake=Math.max(shake,4);bark(e,pick(['GOT YOU!','STAY DOWN!']),true)}}
 crewTrigger(e,dt,d)}
function throwDynamite(e,tx,ty){e.dyn--;e.dynT=rand(6,9);const T=2*250/440;throws.push({x:e.x,y:e.y,z:12,vx:(tx-e.x)/T,vy:(ty-e.y)/T,vz:250,fuse:2.3,spin:rand(-9,9),a:0});bark(e,'DYNAMITE!',true);sound('tick')}
function throwsTick(dt){for(const d of throws){d.fuse-=dt;d.vz-=440*dt;d.z+=d.vz*dt;if(d.z<=0){d.z=0;d.vz=Math.abs(d.vz)*.25;d.vx*=.45;d.vy*=.45}const nx=d.x+d.vx*dt,ny=d.y+d.vy*dt;if(d.z<16&&blocked(nx,ny,4)){d.vx*=-.4;d.vy*=-.4}else{d.x=nx;d.y=ny}d.a+=d.spin*dt;d.spin*=.98;if(frame%2===0&&visible(d,60))particles.push({x:d.x+rand(-2,2),y:d.y-d.z*.34-4,vx:rand(-30,30),vy:rand(-40,-10),life:.25,max:.3,color:'#ffcf6a',size:rand(1,2)});if(d.fuse<=0){d.done=true;blast(d.x,d.y,.85,'')}}throws=throws.filter(d=>!d.done)}
function crewsTick(dt){crewBarkT-=dt;for(const e of enemies){if(e.hp<=0){e.deadT=(e.deadT||0)+dt;continue}if(e.def)crewTick(e,dt);if(player.car&&dist(e,player)<25&&Math.abs(player.car.v)>85){e.hp=0;killEnemy(e);player.car.v*=.84}}enemies=enemies.filter(e=>!e.remove&&!(e.hp<=0&&e.deadT>40&&!visible(e,120)));throwsTick(dt)}
function drawThreats(){ctx.save();ctx.textAlign='center';for(const e of enemies){if(e.hp<=0||!visible(e,60))continue;if(e.aimT>0&&e.sees){const k=clamp(1-e.aimT/(e.def.aim*1.4),0,1);ctx.strokeStyle=e.cop?`rgba(170,200,255,${.12+k*.35})`:`rgba(255,130,90,${.12+k*.35})`;ctx.lineWidth=1+k;ctx.setLineDash([6,6]);ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(player.x,player.y);ctx.stroke();ctx.setLineDash([])}ctx.font='bold 9px Arial';if(e.reloadT>0){ctx.fillStyle='#e9dfc7bb';ctx.fillText('RELOADING',e.x,e.y-26)}else if(!e.aware){ctx.fillStyle='#e9dfc788';ctx.fillText('· · ·',e.x,e.y-24)}}
 for(const d of throws){const pulse=.5+.5*Math.sin(elapsed*(10+(2.3-d.fuse)*10));ctx.fillStyle=`rgba(230,80,50,${.07+pulse*.08})`;ctx.beginPath();ctx.arc(d.x,d.y,100,0,TAU);ctx.fill();ctx.strokeStyle=`rgba(240,100,70,${.5+pulse*.45})`;ctx.lineWidth=2.5;ctx.setLineDash([8,6]);ctx.beginPath();ctx.arc(d.x,d.y,100,0,TAU);ctx.stroke();ctx.setLineDash([]);const p=project3(d.x,d.y,d.z);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(d.a);ctx.fillStyle='#a8322a';ctx.fillRect(-6,-2.2,12,4.4);ctx.fillStyle='#e9dfc7';ctx.fillRect(-6,-2.2,2,4.4);ctx.restore()}ctx.restore()}
// ---------- Side activities: hot runs and the rival rampage ----------
const snapRoad=p=>{const n=WLD.nearest(p);return{x:n.x,y:n.y}};
const TRIALS=[{id:'saginaw',name:'Saginaw Sprint',start:[518,95],cps:[[518,211],[518,358],[690,354],[972,345],[974,510],[974,700]]},{id:'west',name:'West Woods Run',start:[700,354],cps:[[518,358],[266,360],[23,362],[23,555],[23,720]]}].map(t=>({...t,start:snapRoad(WLD.P(...t.start)),cps:t.cps.map(c=>snapRoad(WLD.P(...c)))}));
const RAMPAGE=snapRoad(WLD.P(620,560));
let trial=null,frenzy=null,frenzyCd=0;
const fmtTime=t=>Math.floor(t/60)+':'+(t%60).toFixed(2).padStart(5,'0');
function activityAt(){if(interior||job||trial||frenzy||!player.car)return null;for(const t of TRIALS)if(dist(player,t.start)<72)return{kind:'trial',t};if(dist(player,RAMPAGE)<72)return{kind:'rampage'};return null}
function startTrial(t){trial={def:t,i:0,t:0,count:3};const c=player.car;c.v=c.vx=c.vy=0;toast(t.name.toUpperCase()+' · Hit every checkpoint. '+(save.trials[t.id]?'Record: '+fmtTime(save.trials[t.id]):'Set the first record.'));sound('beep');bigText('3',1);updateObjective()}
function startRampage(){if(frenzyCd>0){toast('The rivals are lying low. Try again in '+Math.ceil(frenzyCd)+' seconds.');return}frenzy={t:60,trucks:[]};const nodes=WLD.driveNodes.filter(n=>dist(n,player)>280&&dist(n,player)<900&&!blocked(n.x,n.y,16));for(let i=0;i<6&&nodes.length;i++){const n=nodes.splice(Math.floor(Math.random()*nodes.length),1)[0],c=newCar('truck',n.x,n.y,rand(0,TAU),{ai:'flee',rival:true,color:'#8c3b2e',hp:110,maxHp:110,speed:125});cars.push(c);frenzy.trucks.push(c)}toast('RIVAL RAMPAGE · Wreck all six rival trucks in 60 seconds!');sound('alert');bigText('RAMPAGE!',1.2,'#e88a6c');updateObjective()}
function endActivity(){if(frenzy)for(const c of frenzy.trucks){c.rival=false;if(!c.dead&&!c.burning)c.ai='traffic'}trial=null;frenzy=null;updateObjective()}
function activityTick(dt){frenzyCd=Math.max(0,frenzyCd-dt);
 if(trial){const c=player.car;if(!c||c.burning){toast('Hot run abandoned.');endActivity();return}if(trial.count>0){const before=Math.ceil(trial.count);trial.count-=dt;c.v=c.vx=c.vy=0;const after=Math.ceil(trial.count);if(after!==before){if(after>0){sound('beep');bigText(String(after),1)}else{sound('go');bigText('GO!',.8,'#9fd3a8')}}}else{trial.t+=dt;const cp=trial.def.cps[trial.i];if(dist(player,cp)<82){trial.i++;sound('check');if(trial.i>=trial.def.cps.length){finishTrial();return}popup('CHECKPOINT '+trial.i+'/'+trial.def.cps.length+' · '+fmtTime(trial.t),player.x,player.y-40,'#bfe0c4')}if(trial.t>240){toast('Hot run timed out.');endActivity()}}}
 if(frenzy){frenzy.t-=dt;const wrecked=frenzy.trucks.filter(c=>c.dead||c.burning).length;if(wrecked!==frenzy.wrecked){if(frenzy.wrecked!==undefined&&wrecked>frenzy.wrecked)popup('RIVAL TRUCK '+wrecked+'/6',player.x,player.y-40,'#e88a6c');frenzy.wrecked=wrecked}if(wrecked>=frenzy.trucks.length){const pay=SHOP.round(20+frenzy.t*.5);gift(pay);save.xp+=60;bigText('RAMPAGE COMPLETE',1.6,'#e8c36e');toast('RAMPAGE COMPLETE · '+money(pay));frenzyCd=150;endActivity()}else if(frenzy.t<=0){const pay=SHOP.round(wrecked*2.5);if(pay)gift(pay);toast('Time! '+wrecked+' of 6 trucks wrecked'+(pay?' · '+money(pay):''));frenzyCd=90;endActivity()}}}
function finishTrial(){const d=trial.def,time=trial.t,best=save.trials[d.id];let msg,pay=0;if(!best){pay=10;msg='FIRST RECORD'}else if(time<best){pay=5;msg='NEW RECORD · '+fmtTime(best)+' beaten'}else msg='Record is '+fmtTime(best);if(!best||time<best)save.trials[d.id]=time;if(pay)gift(pay);bigText(fmtTime(time),1.8,pay?'#e8c36e':'#f1e3b8');toast(d.name.toUpperCase()+' · '+fmtTime(time)+' · '+msg+(pay?' · +'+money(pay):''));trial=null;updateObjective();persist()}
function fleeUpdate(c,dt){if(!c.destination||dist(c,c.destination)<80){if(c.missionTruck)return followRoad(c,dt,c.destination,30);const far=WLD.driveNodes.filter(n=>dist(n,c)>1200);c.destination=pick(far.length?far:WLD.driveNodes);c.route=[]}const scared=dist(c,player)<520;c.boost=scared?1.12:1;followRoad(c,dt,c.destination,scared?carTypes[c.type].max*1.1:(c.speed||125))}
// ---------- Hidden jugs ----------
function jugTick(){for(const j of jugs){if(save.jugs.includes(j.id))continue;if(Math.abs(j.x-player.x)<40&&Math.abs(j.y-player.y)<40&&dist(j,player)<34){save.jugs.push(j.id);gift(JUG_PAY);sound('jug');popup('MOONSHINE JUG '+save.jugs.length+'/16  +'+money(JUG_PAY),j.x,j.y-30,'#e8c36e');showPaper({kicker:'JUG '+save.jugs.length+' OF 16 · A CLIPPING WAS TUCKED INSIDE',headline:FACTS[j.id%FACTS.length].head,fact:{head:'FROM THE HISTORY BOOKS',text:FACTS[j.id%FACTS.length].text}});updateObjective();if(save.jugs.length>=16&&!save.ownedCars.includes('custom')){save.ownedCars.push('custom');toast('ALL 16 JUGS · The Blackbird Special is yours. Dispatch it from the garage.')}persist()}}}
const JUG_PAY=3;
function horn(){if(mode!=='play'||!player.car)return;sound('horn');for(const p of peds)if(dist(p,player)<240)p.panic=4;for(const c of cars)if(c.ai==='traffic'&&dist(c,player)<200)c.speed=Math.min(110,(c.speed||70)+10)}
// ---------- Bodies on foot ----------
// Contact between a round body and a car's rectangle, in the car's own frame.
function carContact(c,o,r){const hl=c.type==='truck'?30:25,hw=c.type==='truck'?15:13,dx=o.x-c.x,dy=o.y-c.y,ca=Math.cos(c.a),sa=Math.sin(c.a),lx=dx*ca+dy*sa,ly=-dx*sa+dy*ca;if(Math.abs(lx)>hl+r||Math.abs(ly)>hw+r)return null;const qx=clamp(lx,-hl,hl),qy=clamp(ly,-hw,hw);let ex=lx-qx,ey=ly-qy,d=Math.hypot(ex,ey);if(d>=r)return null;if(d<.001){if(hl-Math.abs(lx)<hw-Math.abs(ly)){ex=Math.sign(lx)||1;ey=0}else{ex=0;ey=Math.sign(ly)||1}d=0}else{ex/=d;ey/=d}return{nx:ex*ca-ey*sa,ny:ex*sa+ey*ca,depth:r-d+(d===0?Math.min(hl-Math.abs(lx),hw-Math.abs(ly)):0)}}
let footT=0;
function walk(dt,dx,dy){if(player.knock>0){player.knock-=dt;moveBody(player,player.kx*dt,player.ky*dt,9);const k=Math.exp(-dt*4.5);player.kx*=k;player.ky*=k;player.spinA=(player.spinA||player.a)+dt*6*Math.max(0,player.knock);return}
 const len=Math.hypot(dx,dy)||1,run=keys.ShiftLeft||keys.ShiftRight,top=run?158:108,tx=dx/len*top,ty=dy/len*top,moving=dx||dy,acc=moving?(run?900:1000):1300;
 const ddx=tx-(player.vx||0),ddy=ty-(player.vy||0),dd=Math.hypot(ddx,ddy),stepV=Math.min(dd,acc*dt);if(dd>0){player.vx=(player.vx||0)+ddx/dd*stepV;player.vy=(player.vy||0)+ddy/dd*stepV}
 const bx=player.x,by=player.y;moveBody(player,player.vx*dt,player.vy*dt,9);if(Math.abs(player.x-bx)<Math.abs(player.vx*dt)*.3)player.vx*=.4;if(Math.abs(player.y-by)<Math.abs(player.vy*dt)*.3)player.vy*=.4;
 const sp=Math.hypot(player.vx,player.vy);player.spinA=0;if(moving){player.a=Math.atan2(dy,dx)}player.step+=dt*sp*.1;footT-=dt*sp/108;if(sp>30&&footT<=0){footT=run?.62:.7;sound('step')}
 if(mouse.active&&!isTouch)player.a=Math.atan2((mouse.y-h/2)/zoom+camera.y-player.y,(mouse.x-w/2)/zoom+camera.x-player.x)}
// Pedestrians walk the sidewalks, dive away from cars aimed at them, and get knocked flat and get back up.
function pedTick(p,dt){p.panic=Math.max(0,p.panic-dt);
 if(p.down>0){p.down-=dt;moveBody(p,p.kx*dt,p.ky*dt,8);const k=Math.exp(-dt*4);p.kx*=k;p.ky*=k;p.spinA=(p.spinA||p.a)+(p.kspin||0)*dt;p.kspin=(p.kspin||0)*k;if(p.down<=0){p.panic=7;p.dir=Math.random()<.5?1:-1;p.spinA=0}return}
 if(p.dive>0){p.dive-=dt;moveBody(p,p.kx*dt,p.ky*dt,8);const k=Math.exp(-dt*5);p.kx*=k;p.ky*=k;return}
 for(const c of cars){if(c.dead||Math.abs(c.x-p.x)>110||Math.abs(c.y-p.y)>110)continue;const sp=Math.hypot(c.vx||0,c.vy||0);if(sp<45)continue;const hit=carContact(c,p,8);if(hit){const a=Math.atan2(c.vy,c.vx);p.down=2.4;p.kx=c.vx*.8+hit.nx*90;p.ky=c.vy*.8+hit.ny*90;p.kspin=rand(-9,9);p.spinA=a;if(visible(p,40))sound('thud');particle(p.x,p.y,'#c8c0a0',6,50);if(c===player.car){addHeat(4);if(sp>60)popup('WATCH IT!',p.x,p.y-24,'#df866d')}return}
  if(sp>85){const rx=p.x-c.x,ry=p.y-c.y,along=(rx*c.vx+ry*c.vy)/sp,side=(rx*c.vy-ry*c.vx)/sp;if(along>0&&along<sp*.55&&Math.abs(side)<26&&Math.random()<dt*9){const s=side>=0?1:-1;p.dive=.32;p.kx=c.vy/sp*s*210;p.ky=-c.vx/sp*s*210;p.panic=6;p.a=Math.atan2(p.ky,p.kx);return}}}
 const e=p.edge;p.t+=p.dir*p.speed*(p.panic?2.4:1)*dt/e.d;if(p.t<.05||p.t>.95){p.dir*=-1;p.t=clamp(p.t,.05,.95)}const a=Math.atan2(e.b.y-e.a.y,e.b.x-e.a.x),tx=lerp(e.a.x,e.b.x,p.t)-Math.sin(a)*p.off,ty=lerp(e.a.y,e.b.y,p.t)+Math.cos(a)*p.off,mx=tx-p.x,my=ty-p.y,md=Math.hypot(mx,my);p.a=md>3?Math.atan2(my,mx):a+(p.dir<0?Math.PI:0);if(md>0){const mv=Math.min(md,(p.speed*(p.panic?2.4:1)+70)*dt);moveBody(p,mx/md*mv,my/md*mv,8)}
 if(player.car&&dist(p,player)<40&&!p.panic){p.dir*=-1;p.panic=4}}
// ---------- Atmosphere: time of night, weather, light, the train ----------
// Respawn points slide along the road until the car is clear of the tracks.
function railDist(p){let d=1e9;for(let i=1;i<WLD.railway.length;i++)d=Math.min(d,projectOnSegment(p,WLD.railway[i-1],WLD.railway[i]).d);return d}
function offRail(at){if(railDist(at)>=60)return at;let best=at;for(const dir of [1,-1])for(let k=1;k<=12;k++){const q={x:at.x+Math.cos(at.a)*dir*k*14,y:at.y+Math.sin(at.a)*dir*k*14,a:at.a};if(blocked(q.x,q.y,16))break;if(railDist(q)>=60){if(best===at||dist(q,at)<dist(best,at))best=q;break}}return best}
let muzzle=0;
const weather={rain:.65,target:.65,timer:50,flash:0,thunder:-1,wind:.3};
function raining(){return weather.rain>.15}
function gameHour(){return((Math.floor(elapsed/5)+23*60+42)/60)%24}
// Night is darkest before 4 a.m. Dawn comes up between 5 and 7, dusk falls between 19 and 21.
function darkness(){const hr=gameHour();let d=hr>=21||hr<5?1:hr<7?1-(hr-5)/2:hr<19?0:(hr-19)/2;return d}
function weatherTick(dt){weather.timer-=dt;if(weather.timer<=0){weather.target=Math.random()<.25?rand(0,.15):rand(.35,1);weather.wind=rand(.1,.6);weather.timer=rand(45,100)}weather.rain=lerp(weather.rain,weather.target,1-Math.exp(-dt*.08));weather.flash=Math.max(0,weather.flash-dt*2.6);muzzle=Math.max(0,muzzle-dt);
 if(weather.rain>.7&&Math.random()<dt/38){weather.flash=1;weather.thunder=rand(.7,2.6)}if(weather.thunder>0){weather.thunder-=dt;if(weather.thunder<=0){weather.thunder=-1;sound('thunder')}}
 const n=Math.round(weather.rain*6);for(let i=0;i<n;i++)if(ripples.length<140)ripples.push({x:camera.x+rand(-w/zoom/2,w/zoom/2),y:camera.y+rand(-h/zoom/2,h/zoom/2),life:.45});for(const r of ripples)r.life-=dt;ripples=ripples.filter(r=>r.life>0);
 if(raining())for(const c of cars){if(c.dead||(c.z||0)>0||frame%3)continue;const sp=Math.hypot(c.vx||0,c.vy||0);if(sp<110||!visible(c,40))continue;for(const side of [-1,1])particles.push({x:c.x-Math.cos(c.a)*20-Math.sin(c.a)*10*side,y:c.y-Math.sin(c.a)*20+Math.cos(c.a)*10*side,vx:-c.vx*.15+rand(-20,20),vy:-c.vy*.15+rand(-20,20),life:.35,max:.5,color:'#bcd0cc66',size:rand(2,4)})}
 const pc=player.car;if(pc&&!pc.dead&&(pc.throttle||0)>.5&&Math.abs(pc.v)<140&&frame%7===0)smoke.push({x:pc.x-Math.cos(pc.a)*27,y:pc.y-Math.sin(pc.a)*27,z:2,vx:-Math.cos(pc.a)*20+rand(-5,5),vy:-Math.sin(pc.a)*20+rand(-5,5),vz:rand(4,9),r:rand(4,6),life:.9,max:.9,dark:false})}
let ripples=[];
function drawRipples(){if(!raining())return;ctx.strokeStyle='#c9dcd622';ctx.lineWidth=1;for(const r of ripples){const k=1-r.life/.45;ctx.globalAlpha=1-k;ctx.beginPath();ctx.ellipse(r.x,r.y,2+k*7,1+k*3.5,0,0,TAU);ctx.stroke()}ctx.globalAlpha=1}
function drawRain(){const n=Math.round((30+weather.rain*150)*(quality>=1?1:.5)),slant=6+weather.wind*14,fall=380+weather.rain*160;ctx.strokeStyle=`rgba(190,214,205,${.06+weather.rain*.08})`;ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<n;i++){const rx=((i*137.3+elapsed*(40+weather.wind*120))%(w+80))-40,ry=((i*97.1+elapsed*fall)%(h+80))-40;ctx.moveTo(rx,ry);ctx.lineTo(rx-slant,ry+16+weather.rain*8)}ctx.stroke();if(weather.flash>0){ctx.fillStyle=`rgba(220,230,255,${weather.flash*.28})`;ctx.fillRect(0,0,w,h)}}
// Quality steps down by itself on slow machines: 2 is full lighting, 1 is cheaper lighting, 0 turns lighting off.
let quality=2,slowFor=0,fastFor=0,frameAvg=1/60;
function perfWatch(dt){if(mode!=='play'||document.hidden)return;frameAvg=lerp(frameAvg,dt,.04);if(frameAvg>1/40){slowFor+=dt;fastFor=0;if(slowFor>4&&quality>0){quality--;slowFor=0;frameAvg=1/50}}else if(frameAvg<1/57){fastFor+=dt;slowFor=0;if(fastFor>20&&quality<2){quality++;fastFor=0}}else{slowFor=Math.max(0,slowFor-dt);fastFor=0}}
// Light: a darkness layer at half resolution with lamp pools, headlight cones, fire and gunfire cut out of it.
const lightCv=document.createElement('canvas'),lc=lightCv.getContext('2d');
function sprite(size,stops){const c=document.createElement('canvas');c.width=c.height=size;const q=c.getContext('2d');if(q.createRadialGradient){const g2=q.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);for(const [o,col] of stops)g2.addColorStop(o,col);q.fillStyle=g2;q.fillRect(0,0,size,size)}return c}
const lampSpr=sprite(128,[[0,'rgba(0,0,0,1)'],[.45,'rgba(0,0,0,.55)'],[1,'rgba(0,0,0,0)']]);
const coneSpr=(()=>{const c=document.createElement('canvas');c.width=256;c.height=128;const q=c.getContext('2d');if(q.createLinearGradient){const g2=q.createLinearGradient(0,0,256,0);g2.addColorStop(0,'rgba(0,0,0,.95)');g2.addColorStop(.6,'rgba(0,0,0,.45)');g2.addColorStop(1,'rgba(0,0,0,0)');q.fillStyle=g2;q.beginPath();q.moveTo(0,52);q.lineTo(256,0);q.lineTo(256,128);q.lineTo(0,76);q.closePath();q.fill()}return c})();
const paleSpr=sprite(64,[[0,'rgba(255,236,190,.5)'],[1,'rgba(255,220,170,0)']]),warmSpr=sprite(128,[[0,'rgba(255,170,90,.55)'],[1,'rgba(255,120,40,0)']]),redSpr=sprite(64,[[0,'rgba(255,60,40,.7)'],[1,'rgba(255,40,30,0)']]),blueSpr=sprite(64,[[0,'rgba(80,140,255,.7)'],[1,'rgba(60,110,255,0)']]);
function drawLighting(sX,sY){if(save.settings.lights===false||quality<1)return;const dk=darkness()*(1-weather.flash*.7);if(dk<.02)return;const sc=quality>=2?.5:.33,lw=Math.ceil(w*sc),lh=Math.ceil(h*sc);if(lightCv.width!==lw||lightCv.height!==lh){lightCv.width=lw;lightCv.height=lh}
 lc.setTransform(1,0,0,1,0,0);lc.globalCompositeOperation='source-over';lc.globalAlpha=1;lc.clearRect(0,0,lw,lh);lc.fillStyle=`rgba(3,12,24,${.44*dk})`;lc.fillRect(0,0,lw,lh);lc.globalCompositeOperation='destination-out';lc.setTransform(sc*zoom,0,0,sc*zoom,sc*(w/2+sX-camera.x*zoom),sc*(h/2+sY-camera.y*zoom));
 for(const l of lamps)if(!l.broken&&visible(l,120))lc.drawImage(lampSpr,l.x-95,l.y-95,190,190);
 for(const b of buildings){if(!b.placeId||!visible(b,120))continue;const p=places.find(p=>p.id===b.placeId)?.door;if(p)lc.drawImage(lampSpr,p.x-44,p.y-44,88,88)}
 for(const c of cars){if(c.dead||!visible(c,250))continue;const len=c.type==='truck'?61:50;lc.save();lc.translate(c.x,c.y-(c.z||0)*.4);lc.rotate(c.a);lc.drawImage(coneSpr,len/2-4,-60,240,120);lc.restore();if(c.burning)lc.drawImage(lampSpr,c.x-80,c.y-80,160,160)}
 if(train)for(const b of train.bodies||[])if(b.i===0){lc.save();lc.translate(b.x,b.y);lc.rotate(b.a+(train.dir<0?Math.PI:0));lc.drawImage(coneSpr,28,-80,320,160);lc.restore()}
 lc.drawImage(lampSpr,player.x-60,player.y-60,120,120);if(muzzle>0)lc.drawImage(lampSpr,player.x-130,player.y-130,260,260);
 for(const r of blastRings)lc.drawImage(lampSpr,r.x-220,r.y-220,440,440);for(const m of flashes)lc.drawImage(lampSpr,m.x-90,m.y-90,180,180);for(const c of cars)if(c.dead&&(c.wreckAge||0)<9&&visible(c,120))lc.drawImage(lampSpr,c.x-60,c.y-60,120,120);
 lc.globalCompositeOperation='source-over';ctx.drawImage(lightCv,0,0,w,h);if(quality<2)return;
 // Colored light added on top: fire, police lamps and brake lights.
 ctx.save();ctx.globalCompositeOperation='lighter';ctx.translate(w/2+sX,h/2+sY);ctx.scale(zoom,zoom);ctx.translate(-camera.x,-camera.y);ctx.globalAlpha=Math.min(1,dk*1.2);
 for(const b of buildings){if(!b.placeId||!visible(b,120))continue;const p=places.find(p=>p.id===b.placeId)?.door;if(p)ctx.drawImage(warmSpr,p.x-25,p.y-25,50,50)}
 for(const c of cars){if(c.dead||!visible(c,120))continue;if(c.burning)ctx.drawImage(warmSpr,c.x-70+rand(-4,4),c.y-70+rand(-4,4),140,140);if((c.ai==='police'||c.ai==='roadblock')&&c.type!=='agent'){const ph=Math.sin(elapsed*13+(c.x%7))>0;ctx.drawImage(ph?redSpr:blueSpr,c.x-55,c.y-55,110,110)}if(c===player.car&&(c.braking||((c.throttle||0)<-.1&&c.v>5))){ctx.drawImage(redSpr,c.x-Math.cos(c.a)*28-16,c.y-Math.sin(c.a)*28-16,32,32)}}
 for(const c of cars)if(c.dead&&(c.wreckAge||0)<9&&visible(c,120)){const f=1-(c.wreckAge||0)/9;ctx.drawImage(warmSpr,c.x-50*f-10+rand(-3,3),c.y-50*f-10+rand(-3,3),(50*f+10)*2,(50*f+10)*2)}
 for(const r of blastRings)ctx.drawImage(warmSpr,r.x-160,r.y-160,320,320);if(muzzle>0)ctx.drawImage(warmSpr,player.x-50,player.y-50,100,100);for(const m of flashes)if(m.s<1.3)ctx.drawImage(warmSpr,m.x-30,m.y-30,60,60);
 // Wet streets mirror the lamps and headlights.
 if(raining()){ctx.globalAlpha=Math.min(1,dk*1.2)*Math.min(1,weather.rain*1.3)*.75;for(const l of lamps){if(l.broken||!visible(l,140))continue;const sh=Math.sin(elapsed*3+l.x)*1.5;ctx.drawImage(paleSpr,l.x-7+sh,l.y+2,14,74)}for(const c of cars){if(c.dead||(c.z||0)>4||!visible(c,220))continue;ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.a);ctx.globalAlpha*=.55;for(const sy of [-8,8])ctx.drawImage(paleSpr,24,sy-5,110,10);ctx.globalAlpha/=.55;ctx.restore()}}
 ctx.restore()}
// The train runs the diagonal tracks. It does not stop, and it wins every argument.
const RAIL=(()=>{const pts=WLD.railway,cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+dist(pts[i-1],pts[i]));return{pts,cum,total:cum[cum.length-1]}})();
function railAt(sv){const {pts,cum}=RAIL;let i=1;while(i<pts.length-1&&cum[i]<sv)i++;const a=pts[i-1],b=pts[i],seg=cum[i]-cum[i-1]||1,t2=(sv-cum[i-1])/seg;return{x:a.x+(b.x-a.x)*t2,y:a.y+(b.y-a.y)*t2,a:Math.atan2(b.y-a.y,b.x-a.x)}}
const CROSSINGS=(()=>{const out=[],cross=(p,q,r,s2)=>{const d=(q.x-p.x)*(s2.y-r.y)-(q.y-p.y)*(s2.x-r.x);if(Math.abs(d)<1e-6)return null;const u=((r.x-p.x)*(s2.y-r.y)-(r.y-p.y)*(s2.x-r.x))/d,v=((r.x-p.x)*(q.y-p.y)-(r.y-p.y)*(q.x-p.x))/d;return u>=0&&u<=1&&v>=0&&v<=1?{x:p.x+(q.x-p.x)*u,y:p.y+(q.y-p.y)*u}:null};for(let i=1;i<RAIL.pts.length;i++)for(const road of WLD.roads)for(let j=1;j<road.points.length;j++){const c=cross(RAIL.pts[i-1],RAIL.pts[i],road.points[j-1],road.points[j]);if(c&&!out.some(o=>dist(o,c)<60))out.push({...c,s:RAIL.cum[i-1]+dist(RAIL.pts[i-1],c),w:road.width,ra:Math.atan2(road.points[j].y-road.points[j-1].y,road.points[j].x-road.points[j-1].x)})}return out})();
let train=null,trainTimer=25,bellT=0;
function crossingActive(cr){if(!train)return false;const front=train.s,back=train.s-train.dir*train.cars*62;const lo=Math.min(front,back)-520,hi=Math.max(front,back)+520;return cr.s>lo&&cr.s<hi}
function trainTick(dt){if(!train){trainTimer-=dt;if(trainTimer<=0){const dir=Math.random()<.5?1:-1;train={dir,s:dir>0?-500:RAIL.total+500,speed:rand(230,280),cars:Math.floor(rand(6,11)),horned:false,smokeT:0,bodies:[]}}return}
 train.s+=train.dir*train.speed*dt;const len=train.cars*62;if(train.dir>0?train.s-len>RAIL.total+400:train.s+len<-400){train=null;trainTimer=rand(60,110);return}
 train.bodies=[];for(let i=0;i<train.cars;i++){const sv=train.s-train.dir*i*62;if(sv<-40||sv>RAIL.total+40)continue;train.bodies.push({...railAt(sv),i})}
 const loco=train.bodies.find(b=>b.i===0);if(loco){const d=dist(loco,interior?interior.outside:player);if(!train.horned&&d<1100){train.horned=true;sound('trainhorn')}train.smokeT-=dt;if(train.smokeT<=0&&visible(loco,200)){train.smokeT=.09;smoke.push({x:loco.x,y:loco.y,z:20,vx:rand(-12,12)-Math.cos(loco.a)*train.dir*40,vy:rand(-12,12)-Math.sin(loco.a)*train.dir*40,vz:rand(25,45),r:rand(9,15),life:2.6,max:2.6,dark:true})}}
 // Anything on the tracks gets hit.
 const tvx=train.dir*train.speed;for(const b of train.bodies){const ca=Math.cos(b.a),sa=Math.sin(b.a),inside=(o,r)=>{const dx=o.x-b.x,dy=o.y-b.y,lx=dx*ca+dy*sa,ly=-dx*sa+dy*ca;return Math.abs(lx)<30+r&&Math.abs(ly)<15+r?Math.sign(ly)||1:0};
  for(const c of cars){if(c.dead||(c.z||0)>20||Math.abs(c.x-b.x)>70||Math.abs(c.y-b.y)>70)continue;const side=inside(c,14);if(!side)continue;const nx=-sa*side,ny=ca*side;c.vx=ca*tvx*1.1+nx*260;c.vy=sa*tvx*1.1+ny*260;c.x+=nx*14;c.y+=ny*14;c.spin=(c.spin||0)+rand(-7,7);c.vz=Math.max(c.vz||0,120);c.z=Math.max(c.z||0,.5);c.knock=true;c.v=c.vx*Math.cos(c.a)+c.vy*Math.sin(c.a);if(c.hit<=0||!c.trainHit){c.hp-=140;c.trainHit=true;sound('crash',1.2);particle(c.x,c.y,'#efcf8a',18,160);if(c===player.car){shake=10;popup('HIT BY THE 11:50 FREIGHT',c.x,c.y-40,'#e5866b')}if(c.hp<=0)wreck(c)}}
  if(!player.car&&!interior&&inside(player,8)&&player.invincible<=0){const side=inside(player,8);player.knock=.8;player.kx=ca*tvx+(-sa*side)*220;player.ky=sa*tvx+ca*side*220;damagePlayer(70,'Hit by a train');player.invincible=1;sound('thud');shake=8}
  for(const p of peds)if(!p.down&&inside(p,7)){const side=inside(p,7);p.down=2.6;p.kx=ca*tvx*.6+(-sa*side)*200;p.ky=sa*tvx*.6+ca*side*200;p.kspin=8}}
 bellT-=dt;const near=CROSSINGS.filter(crossingActive).reduce((m,cr)=>Math.min(m,dist(cr,interior?interior.outside:player)),9999);if(near<700&&bellT<=0){bellT=.5;sound('bell',1-near/700)}}
function drawCrossings(){for(const cr of CROSSINGS){if(!visible(cr,80))continue;const on=crossingActive(cr),blink=Math.floor(elapsed*3)%2;for(const side of [-1,1]){const ox=cr.x-Math.sin(cr.ra)*(cr.w/2+12)*side,oy=cr.y+Math.cos(cr.ra)*(cr.w/2+12)*side;ctx.save();ctx.translate(ox,oy);ctx.fillStyle='#0a1213aa';ctx.fillRect(-2,-2,6,6);ctx.strokeStyle='#e8e2cc';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-7,-7);ctx.lineTo(7,7);ctx.moveTo(7,-7);ctx.lineTo(-7,7);ctx.stroke();ctx.fillStyle=on&&blink?'#ff4a32':'#3a1d18';ctx.beginPath();ctx.arc(-5,9,2.6,0,TAU);ctx.fill();ctx.fillStyle=on&&!blink?'#ff4a32':'#3a1d18';ctx.beginPath();ctx.arc(5,9,2.6,0,TAU);ctx.fill();if(on){ctx.strokeStyle='#e9e1c4';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(cr.ra)*(cr.w*.45)*-side*0+(-Math.sin(cr.ra)*-side)*cr.w*.42,Math.sin(cr.ra)*0+Math.cos(cr.ra)*-side*cr.w*.42);ctx.stroke()}ctx.restore()}}}
function drawTrain(){if(!train)return;for(const b of train.bodies){if(!visible(b,80))continue;ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.a+(train.dir<0?Math.PI:0));ctx.fillStyle='#02090acc';ctx.fillRect(-28,-12,60,30);if(b.i===0){ctx.fillStyle='#1d2224';ctx.fillRect(-29,-14,58,28);ctx.fillStyle='#2e3537';ctx.beginPath();ctx.roundRect(-12,-10,40,20,9);ctx.fill();ctx.fillStyle='#121617';ctx.fillRect(-29,-14,16,28);ctx.fillStyle='#0b0d0d';ctx.beginPath();ctx.arc(20,0,5,0,TAU);ctx.fill();ctx.fillStyle='#f3e2a6';ctx.fillRect(27,-3,3,6);ctx.fillStyle='#a33a2a';ctx.fillRect(28,-14,3,28)}else{const col=['#5d3a2c','#4d5048','#6b4a33','#3f3a33'][b.i%4];ctx.fillStyle=col;ctx.fillRect(-29,-14,58,28);ctx.fillStyle='#00000033';for(let k=-25;k<29;k+=8)ctx.fillRect(k,-14,2,28);ctx.fillStyle='#ffffff14';ctx.fillRect(-29,-14,58,3);ctx.fillStyle='#1c1a17';ctx.fillRect(-31,-3,3,6)}ctx.restore()}}
// Continuous sound beds: rain, tire squeal and the train's rumble.
let rainGain=null,screechGain=null,rumbleGain=null;
function initBeds(){const loop=(type,freq,q)=>{const src=audioCtx.createBufferSource(),f=audioCtx.createBiquadFilter(),g=audioCtx.createGain();src.buffer=noiseBuf;src.loop=true;f.type=type;f.frequency.value=freq;if(q)f.Q.value=q;g.gain.value=0;src.connect(f);f.connect(g);g.connect(sfxBus);src.start();return g};rainGain=loop('lowpass',1100);screechGain=loop('bandpass',1900,6);rumbleGain=loop('lowpass',110)}
function bedsTick(ac){if(!rainGain)return;const on=soundOn&&mode==='play'&&!interior;rainGain.gain.setTargetAtTime(on?.025+weather.rain*.05:0,ac,.3);const pc=player.car,sq=pc&&!pc.dead&&(pc.z||0)===0?clamp(((pc.slip||0)-.14)*3,0,1)*clamp(Math.abs(pc.v)/120,0,1):0;screechGain.gain.setTargetAtTime(on?sq*.12:0,ac,.04);let rd=9999;if(train)for(const b of train.bodies)rd=Math.min(rd,dist(b,player));rumbleGain.gain.setTargetAtTime(on&&rd<1400?.22*(1-rd/1400):0,ac,.2)}
function update(dt){elapsed+=dt;frame++;if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show')}if(paperTimer>0){paperTimer-=dt;if(paperTimer<=0)hidePaper()}if(bigTimer>0){bigTimer-=dt;if(bigTimer<=0)$('bigtext').classList.remove('pop')}shake*=Math.pow(.018,dt);flash=Math.max(0,flash-dt);musicTick();if(mode!=='play'||interior){if(engineGain){engineGain.gain.value=0;sirenGain.gain.value=0}if(rainGain){const ac=audioCtx.currentTime;for(const g2 of [rainGain,screechGain,rumbleGain]){g2.gain.cancelScheduledValues(ac);g2.gain.setTargetAtTime(0,ac,.05)}}}if(mode!=='play'){return}
 if(interior){updateInterior(dt);return}activeElapsed+=dt;tickMarket(dt);
 player.shot=Math.max(0,player.shot-dt);player.invincible=Math.max(0,player.invincible-dt);
 if(player.reload>0){player.reload-=dt;if(player.reload<=0){const we=weapons[save.weapon],take=Math.min(we.mag-player.ammo,player.reserve);player.ammo+=take;player.reserve-=take;sound('tick')}}
 let dx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0),dy=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0);if(isTouch&&(touch.x||touch.y)){dx=touch.x;dy=touch.y}
 if(player.air){airBridge.tick(player,{forward:-dy,turn:dx,lift:(keys.ShiftLeft||keys.ShiftRight||touch.airUp?1:0)-(keys.KeyC||touch.airDown?1:0)},dt,{x:weather.wind*14,y:weather.wind*4});
 }else if(player.car){const c=player.car;if(isTouch&&(touch.x||touch.y)){const aim=Math.atan2(touch.y,touch.x);let diff=norm(aim-c.a);drive(c,dt,Math.abs(diff)>2.1?-.65:1,Math.abs(diff)>2.1?-clamp(diff,-1,1):clamp(diff*2,-1,1),touch.brake)}else drive(c,dt,-dy,dx,keys.Space||touch.brake);if(player.car===c){player.x=c.x;player.y=c.y;}if(!mouse.down&&!touch.fire)player.a=c.a;
 }else{walk(dt,dx,dy)}
 if((mouse.down||touch.fire)&&!(player.knock>0))fire();
 if(engineGain){const ac=audioCtx.currentTime,v=player.car?Math.abs(player.car.v):0;const pc=player.car,rpm=pc?(pc.z>0?1:(pc.rpm||0)):0,gear=pc?(pc.gear||1):1,load=pc?Math.max(0,pc.throttle||0):0;engineGain.gain.setTargetAtTime(soundOn&&pc&&pc.hp>0?.03+load*.03+rpm*.015:0,ac,.05);engineOsc.frequency.setTargetAtTime(pc?26+gear*5+rpm*48+(pc.z>0?18:0):30,ac,pc&&pc.shift>0?.01:.05);engineFilter.frequency.setTargetAtTime(260+rpm*700+load*500,ac,.05);bedsTick(ac);const cop=cars.reduce((m,c)=>c.ai==='police'&&!c.dead?Math.min(m,dist(c,player)):m,9999);sirenGain.gain.setTargetAtTime(soundOn&&stars()&&cop<1100?.045*(1-cop/1100):0,ac,.1);sirenOsc.frequency.setTargetAtTime(Math.sin(elapsed*Math.PI*1.7)>0?720:560,ac,.03)}
 policeSeen=false;
 for(const c of cars){if(c.hp<c.maxHp*.35&&!c.dead&&frame%8===0)emitSmoke(c);if(c.burning){c.burnTime-=dt;if(frame%3===0)emitSmoke(c);if(visible(c,80))emitFlame(c,1-c.burnTime/3.2);if(c.burnTime<=0)explodeCar(c);else if(c!==player.car)drive(c,dt,0,0,true);}if(c.retire!==undefined){c.retire-=dt;if(c.retire<0&&!visible(c,100))c.remove=true;}if(c.dead){slideWreck(c,dt);c.wreckAge=(c.wreckAge||0)+dt;if(c.wreckAge<9&&visible(c,80)){if(frame%2===0)emitFlame(c,(9-c.wreckAge)/15);if(frame%9===0)emitSmoke({x:c.x,y:c.y,a:c.a,burning:true})}if(c.wreckAge>30&&!visible(c,100))c.remove=true;continue}if(c===player.car||c.burning)continue;if(c.ai==='traffic')trafficUpdate(c,dt);else if(c.ai==='police'||c.ai==='roadblock')policeUpdate(c,dt);else if(c.ai==='flee')fleeUpdate(c,dt);else if(Math.hypot(c.vx||0,c.vy||0)>1||c.z>0||c.vz>0){drive(c,dt,0,0,true)}
 }
 collideCars();propHits();fuseTick(dt);propTick(dt);keepTraffic();
 cars=cars.filter(c=>!c.remove);
 crewsTick(dt);
 for(const p of peds)if(dist(p,player)<1000)pedTick(p,dt);
 tickWorldLife(dt);
 const airSight=airOps.tickLaw(dt,{heat,player,search:LAW.search,wind:{x:weather.wind*14,y:weather.wind*4},rain:weather.rain,night:darkness()});
 if(airSight.visible){policeSeen=true;lawSaw(player.air||player);if(airSight.justSpotted)toast('AIR PATROL SPOTTED YOU · Break line of sight under the rooftops!');}
 airOps.tickCourier(dt,{player,pads:airBridge.pads});
 for(const b of bullets){b.life-=dt;const steps=Math.ceil(Math.hypot(b.vx,b.vy)*dt/9);b.lastX=b.x;b.lastY=b.y;for(let i=0;i<steps&&b.life>0;i++){b.x+=b.vx*dt/steps;b.y+=b.vy*dt/steps;if(blocked(b.x,b.y,2)){b.life=0;particle(b.x,b.y,'#a7a58a',3,40);break}if(b.from==='player'){
  let hit=false;for(const e of enemies)if(e.hp>0&&Math.hypot(b.x-e.x,b.y-e.y)<14){e.hp-=b.damage;e.hit=.15;crewHurt(e);b.life=0;particle(e.x,e.y,'#aa755c',4,40);hit=true;if(e.hp<=0)killEnemy(e);break}if(hit)break;
  for(const pr of nearbyProps(b.x,b.y,14))if(pr.type!=='lamp'&&Math.hypot(b.x-pr.x,b.y-pr.y)<pr.r+3){smashProp(pr,null,true);b.life=0;hit=true;break}if(hit)break;
  for(const c of cars){if(c.dead||c.burning||c===player.car)continue;if(Math.hypot(b.x-c.x,b.y-c.y)<24){c.hp-=b.damage*.75;c.hit=.1;b.life=0;particle(b.x,b.y,'#d5b56b',5,60);if(c.ai==='traffic')addHeat(4);if(c.hp<=0)wreck(c);break}}
 }else if((!player.air||player.air.z<16)&&Math.hypot(b.x-player.x,b.y-player.y)<(player.car?24:12)){b.life=0;if(player.car){player.car.hp-=b.damage*.85;if(player.car.hp<=0)wreck(player.car)}else damagePlayer(b.damage)}
 }}
 bullets=bullets.filter(b=>b.life>0);
 for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.95;p.vy*=.95}particles=particles.filter(p=>p.life>0);if(particles.length>500)particles.splice(0,particles.length-500);
 for(const s of skids)s.life-=dt;skids=skids.filter(s=>s.life>0);
 for(const p of pickups){p.life-=dt;if(dist(p,player)<45){if(p.type==='crate'){if(job&&job.type==='hijack'&&job.crate===p){job.stage=2;job.target=places[6];job.info='Crates loaded. Bring them to the back room.';updateObjective();toast('Got the crates! Take them to the back room.');sound('cash')}}else if(p.type==='cash'){save.cash=SHOP.round(save.cash+p.amount);save.stats.earnings=SHOP.round(save.stats.earnings+p.amount);sound('cash');popup('+'+money(p.amount),p.x,p.y-20)}else{player.reserve+=24;popup('+24 AMMO',p.x,p.y-20,'#bcd7bd')}p.life=0}}pickups=pickups.filter(p=>p.life>0);
 escapeGrace=Math.max(0,escapeGrace-dt);const safe=dist(player,places[6])<90;
 if(heat>0){const st=stars();if(!policeSeen&&escapeGrace<=0){const old=heat;heat=Math.max(0,heat-dt*(safe?14:outsideSearch()?5:1.1));if(old>=15&&heat<15){save.stats.escapes++;toast('LOST THE TAIL · Keep your head down.');bigText('LOST THEM',1.2,'#9fd3a8')}}if(policeSeen)heat=Math.min(100,heat+dt*.5);spawnTimer-=dt;if(st&&spawnTimer<0){spawnPolice();spawnTimer=[9,6,5,4.2,3.4,2.8][st]}roadblockTimer-=dt;if(st>=3&&roadblockTimer<0){spawnRoadblock();roadblockTimer=rand(14,20)}if(heat<=0)for(const c of cars)if(c.ai==='police'||c.ai==='roadblock'){c.ai='parked';c.v=0;c.retire=8;}}
 if(stars()!==lastStars){if(stars()>lastStars){sound('alert');if(stars()>=2)bigText(TIER[stars()],1.1,'#e3826b')}lastStars=stars()}
 lawTick(dt);lawBrainTick(dt);styleTick(dt);activityTick(dt);jugTick();weatherTick(dt);trainTick(dt);
 for(const p of popups){p.life-=dt;p.y-=dt*26}for(let i=popups.length-1;i>=0;i--)if(popups[i].life<=0)popups.splice(i,1);
 if(safe){player.hp=Math.min(100,player.hp+dt*7);if(player.car)player.car.hp=Math.min(player.car.maxHp,player.car.hp+dt*12)}
 if(job){job.time-=dt;if(job.time<=0)failJob('Time ran out');else tickJob(dt)}
 if(comboTimer>0){comboTimer-=dt;if(comboTimer<=0)combo=0}
 tickEmpire(dt);
 saveTimer+=dt;if(saveTimer>12){saveTimer=0;persist()}
 const cvx=player.air?.vx||player.car?.vx||player.vx||0,cvy=player.air?.vy||player.car?.vy||player.vy||0,csp=Math.hypot(cvx,cvy);zoomDyn=lerp(zoomDyn,1-.2*clamp((csp-90)/230,0,1),1-Math.exp(-dt*1.2));zoom=baseZoom*zoomDyn;camera.lookX=lerp(camera.lookX,clamp(cvx*.34,-130,130),1-Math.exp(-dt*2.4));camera.lookY=lerp(camera.lookY,clamp(cvy*.34,-110,110),1-Math.exp(-dt*2.4));camera.x=lerp(camera.x,player.x+camera.lookX,1-Math.exp(-dt*5));camera.y=lerp(camera.y,player.y+camera.lookY,1-Math.exp(-dt*5));
 updateHUD();
}
function killEnemy(e){if(e.killed)return;e.killed=true;e.deadT=0;e.aimT=0;e.volley=0;particle(e.x,e.y,'#c9a977',12,80);if(e.cop){if(e.car)e.car.out=Math.max(0,(e.car.out||0)-1);popup('OFFICER DOWN',e.x,e.y-26,'#e3826b');addHeat(16);return}save.stats.kills++;save.xp+=12;const boss=e.kind==='tommy';pickups.push({x:e.x,y:e.y,type:boss||Math.random()>.5?'cash':'ammo',amount:SHOP.round(boss?rand(3,5):rand(1,2.50)),life:90});if(boss)pickups.push({x:e.x+16,y:e.y,type:'ammo',life:90});addHeat(3)}
function tickJob(dt){if(!job)return;const j=job;
 if(j.type==='errand'||j.type==='bootleg')return;
 if(j.type==='legacy-bootleg'){const target=j.stops[j.stage];if(dist(player,target)<56&&player.car&&Math.abs(player.car.v)<38){j.delivery+=dt;if(j.delivery>1.6){j.stage++;j.delivery=0;sound('cash');if(j.stage>=3){completeJob();return}j.target=j.stops[j.stage];j.info='Deliver to '+j.target.name+'. Slow down inside the gold circle.';addHeat(j.stage===1?19:12);updateObjective();toast(j.stage===1?'Liquor loaded. Two clubs are waiting.':'Delivery made. One more stop.')}}else j.delivery=0;
 }else if(j.type==='rival'){if(j.stage===0&&j.targets.every(e=>e.hp<=0)){j.stage=1;j.target=places[6];j.info='Ledger secured. Return to the back room to collect your cut.';updateObjective();toast('Ledger secured. Bring it back to the green back room.')}else if(j.stage===1&&dist(player,j.target)<70){completeJob();return}
 }else if(j.type==='wheelman'&&j.stage===1&&player.car===j.car&&dist(player,places[0])<65&&Math.abs(player.car.v)<40){completeJob();return}
 const safe=places[6],slow=lim=>player.car&&Math.abs(player.car.v)<lim;if(false){}
 else if(j.type==='hijack'){const c=j.truck;if(j.stage===0){if(c.dead||c.burning){j.stage=1;const at=openSpot(c,30),cr={x:at.x,y:at.y,type:'crate',life:9999};pickups.push(cr);j.crate=cr;j.target=cr;j.info='The truck is finished. Grab the whiskey crates before the police do.';addHeat(16);updateObjective();toast('Truck down! Drive over the crates to grab them.')}else if(c.destination&&dist(c,c.destination)<90){failJob('The rival truck made its drop');return}}else if(j.stage===2&&dist(player,safe)<70){completeJob();return}}
 else if(j.type==='raid'){if(j.stage===0&&j.barrels.every(b=>b.broken)){j.stage=1;heat=Math.max(heat,61);addHeat(0);j.target=safe;j.info='The whole county heard that. Lose the police. The back room cools you off faster.';sound('alert');updateObjective();toast('STILL DESTROYED · Now lose the police!')}else if(j.stage===1&&stars()===0){completeJob();return}}
 else if(j.type==='getaway'){if(j.stage===0&&dist(player,j.club)<62&&slow(45)){j.stage=1;j.info='The crew is inside. Stay in the circle with the motor running.';updateObjective();sound('horn')}else if(j.stage===1){if(dist(player,j.club)<75&&player.car){j.wait-=dt;if(j.wait<=0){j.stage=2;heat=Math.max(heat,62);addHeat(0);j.target=safe;j.info='The crew is in the car and the alarm is ringing. Get to the back room!';sound('alert');updateObjective();toast('GO GO GO! Get to the back room!')}}else{j.stage=0;j.wait=6;j.info='You left the crew behind! Get back to '+j.club.name+'.';updateObjective()}}else if(j.stage===2&&dist(player,safe)<70){completeJob();return}}
}
function updateHUD(force=false){if(!force&&frame%4!==0)return;$('cash').textContent=money(save.cash);$('rank').textContent=rank();const n=stars();$('heat').textContent=Array.from({length:5},(_,i)=>i<n?'★':'☆').join('');$('heat').style.color=n?(policeSeen?'#ec8a6f':(Math.floor(elapsed*4)%2?'#d5ae62':'#857a5c')):'#5f6a62';$('heatlabel').textContent=n===0?'KEEP A LOW PROFILE':policeSeen?'WANTED · '+TIER[n]:'LOSING THEM · HIDE';const sc=$('stylechip'),showStyle=styleMult>1||driftTime>.35;sc.classList.toggle('hidden',!showStyle);if(showStyle)sc.innerHTML=(driftTime>.35?'<b>DRIFT '+driftTime.toFixed(1)+'s</b>':'')+(styleMult>1?'<span>STYLE ×'+styleMult+'</span>':'');$('hpbar').style.width=clamp(player.hp,0,100)+'%';$('carbar').style.width=player.air?clamp(player.air.health,0,100)+'%':player.car?clamp(player.car.hp/player.car.maxHp*100,0,100)+'%':'0%';$('vehicleLabel').textContent=player.air?window.DryFlight.TYPES[player.air.type].name:player.car?carTypes[player.car.type].name:'ON FOOT';$('weapon').textContent=weapons[save.weapon].short;$('ammo').textContent=player.reload>0?'RELOADING':player.ammo+' / '+player.reserve;{const sp=$('speed'),mph=Math.round(player.air?Math.hypot(player.air.vx,player.air.vy)*.21:Math.abs(player.car?.v||0)*.21);sp.querySelector('strong').textContent=String(mph).padStart(2,'0');const nd=sp.querySelector('.needle');if(nd)nd.style.transform='rotate('+(-90+Math.min(1,mph/90)*180).toFixed(1)+'deg)';const gr=sp.querySelector('.gear');if(gr)gr.textContent=player.car?((player.car.v||0)<-5?'R':String(player.car.gear||1)):'·';sp.classList.toggle('onfoot',!player.car&&!player.air)}$('district').textContent=(interior?interior.place.name:district(player.x,player.y));const fl=$('flightReadout');fl.classList.toggle('hidden',!player.air);if(player.air){fl.textContent='ALT '+Math.round(player.air.z)+' FT · FUEL '+Math.round(player.air.fuel/window.DryFlight.TYPES[player.air.type].fuel*100)+'%'+(airBridge.warning?' · '+airBridge.warning:'')+(airOps.courierText()?' · '+airOps.courierText():'')+(airOps.visible?' · AIR PATROL SPOTTED':'');}for(const b of $('mobile').querySelectorAll('button[data-action="air-up"],button[data-action="air-down"],button[data-action="air-job"]'))b.classList.toggle('hidden',!player.air);const min=Math.floor(elapsed/5)+23*60+42;$('clock').textContent=String(Math.floor(min/60)%24).padStart(2,'0')+':'+String(min%60).padStart(2,'0');
 if(job){const mm=Math.floor(job.time/60),ss=Math.floor(job.time%60),j=job;let extra='';if(j.delivery>0)extra=' · '+(j.stage===0?'LOADING':'UNLOADING')+'…';else if(j.type==='rival'&&j.stage===0)extra=' · '+j.targets.filter(e=>e.hp<=0).length+'/'+j.targets.length+' CREW';else if(j.type==='raid'&&j.stage===0)extra=' · '+j.barrels.filter(b=>b.broken).length+'/'+j.barrels.length+' BARRELS';else if(j.type==='raid')extra=' · LOSE THE STARS';else if(j.type==='getaway'&&j.stage===1)extra=' · CREW OUT IN '+Math.ceil(j.wait);else if(j.type==='hijack'&&j.stage===0)extra=' · TRUCK '+Math.max(0,Math.round(j.truck.hp/j.truck.maxHp*100))+'%';$('jobprogress').textContent=`${mm}:${String(ss).padStart(2,'0')} LEFT · ${Math.floor(dist(interior?interior.outside:player,j.target))} YD`+extra}
 else if(trial)$('jobprogress').textContent=trial.count>0?'GET READY…':fmtTime(trial.t)+' · CHECKPOINT '+(trial.i+1)+'/'+trial.def.cps.length+(save.trials[trial.def.id]?' · RECORD '+fmtTime(save.trials[trial.def.id]):'');else if(frenzy)$('jobprogress').textContent=Math.ceil(frenzy.t)+' SECONDS · '+(frenzy.wrecked||0)+'/6 WRECKED';
 if(interior){const near=nearestNPC();interaction=dist(player,{x:360,y:437})<65?'Leave '+interior.place.name:near?'Speak to '+near.name:null;const hidden=SHOP.secrets.find(s=>s.front===interior.place.id);if(hidden&&dist(player,{x:642,y:255})<64)interaction='Inspect the concealed door';$('interaction').classList.toggle('hidden',!interaction);if(interaction)$('interaction').querySelector('span').textContent=interaction;$('talkBtn').classList.toggle('hidden',!near);$('talkBtn').textContent=near?'F · Talk to '+near.name:'';return}
 interaction=null;const near=nearestPlace(),act=player.air?null:activityAt(),nearAir=!player.car&&!player.air?airBridge.nearest(player):null;if(player.air)interaction='E · Exit aircraft only when safely landed';else if(nearAir)interaction='Board '+window.DryFlight.TYPES[nearAir.type].name;else if(act)interaction=act.kind==='trial'?'Start the '+act.t.name+(save.trials[act.t.id]?' · record '+fmtTime(save.trials[act.t.id]):' · no record yet'):'Start the Rival Rampage · wreck six trucks';else if(player.car&&near?.id==='garage'&&stars())interaction='Bell & Sons · Roll in slowly for a respray';else if(!player.car&&!player.air&&near&&shopById(near.id))interaction='Enter '+near.name;else if(near?.type==='phone')interaction='Take a contract';else if(player.car)interaction=Math.abs(player.car.v)<65?'Exit vehicle':null;else{const c=nearestCar();if(c)interaction='Drive '+carTypes[c.type].name}
 $('interaction').classList.toggle('hidden',!interaction);if(interaction)$('interaction').querySelector('span').textContent=interaction;
 drawMap(mc,180,false)
}
function visible(o,margin=100){return Math.abs(o.x-camera.x)<w/zoom/2+margin&&Math.abs(o.y-camera.y)<h/zoom/2+margin}
// 1920s vehicle art, drawn once into cached sprites. Car faces +x. Units are game pixels; sprites are rendered at S times.
const CAR_ART=(()=>{
 const S=2.5;
 const shade=(hex,f)=>{let n=parseInt(hex.slice(1,7),16),r=n>>16,g=n>>8&255,b=n&255;const m=v=>Math.max(0,Math.min(255,Math.round(f>0?v+(255-v)*f:v*(1+f))));return'#'+[m(r),m(g),m(b)].map(v=>v.toString(16).padStart(2,'0')).join('')};
 const DIM={sedan:{len:50,wid:25,roof:[-15,5],hood:[7,23]},coupe:{len:48,wid:24,roof:[-9,5],hood:[7,22]},truck:{len:61,wid:29,roof:[12,26],hood:[26,29]},custom:{len:55,wid:25,roof:[-12,3],hood:[5,26]},police:{len:50,wid:25,roof:[-15,5],hood:[7,23]},agent:{len:52,wid:25,roof:[-16,5],hood:[7,24]}};
 function rr(q,x,y,w,h,r){q.beginPath();q.roundRect(x,y,w,h,r)}
 function body(type,color,variant){const d=DIM[type]||DIM.sedan,L=d.len,W=d.wid,pad=8,c=document.createElement('canvas');c.width=Math.ceil((L+pad*2)*S);c.height=Math.ceil((W+pad*2)*S);const q=c.getContext('2d');q.scale(S,S);q.translate(L/2+pad,W/2+pad);
  const dead=variant==='wreck',base=dead?'#2a2e2b':color,dark=shade(base,-.45),light=shade(base,.28),chrome=dead?'#4a4a44':'#d9d6c4',fend=dead?'#1d201e':type==='police'?'#14191b':shade(base,-.18);
  const hw=W/2,cab=hw*.74;
  // Running boards and fenders sit outside the narrower body.
  q.fillStyle=dead?'#161817':'#1b1f1f';rr(q,-L/2+9,-hw+1,L-20,W-2,3);q.fill();
  q.fillStyle=fend;for(const [fx,len] of [[L/2-13,13],[-L/2+4,12]])for(const sy of [-1,1]){q.beginPath();q.ellipse(fx+len/2-2,sy*(hw-3.2),len/2+1,4.2,0,0,Math.PI*2);q.fill()}
  q.fillStyle=shade(fend,.25);for(const [fx,len] of [[L/2-13,13],[-L/2+4,12]])for(const sy of [-1,1]){q.beginPath();q.ellipse(fx+len/2-2,sy*(hw-3.6)-sy*.8,len/2-1,1.6,0,0,Math.PI*2);q.fill()}
  q.save();q.strokeStyle='#0a0f10cc';q.lineWidth=1.2;rr(q,-L/2+2.2,-cab-.6,L-5.4,cab*2+1.2,6);q.stroke();for(const [fx,len] of [[L/2-13,13],[-L/2+4,12]])for(const sy of [-1,1]){q.beginPath();q.ellipse(fx+len/2-2,sy*(hw-3.2),len/2+1.6,4.8,0,0,Math.PI*2);q.stroke()}q.restore();
  q.fillStyle=fend;for(const [fx,len] of [[L/2-13,13],[-L/2+4,12]])for(const sy of [-1,1]){q.beginPath();q.ellipse(fx+len/2-2,sy*(hw-3.2),len/2+1,4.2,0,0,Math.PI*2);q.fill()}
  // Main body with a soft top light and darker flanks.
  const gr=q.createLinearGradient(0,-cab,0,cab);gr.addColorStop(0,light);gr.addColorStop(.45,base);gr.addColorStop(1,dark);q.fillStyle=gr;
  if(type==='truck'){rr(q,6,-cab,L/2-8,cab*2,4);q.fill();q.fillStyle=dead?'#2b2620':'#6d5a3c';rr(q,-L/2+1,-hw+1.5,L/2+5,W-3,2);q.fill();q.fillStyle='#00000030';for(let x=-L/2+4;x<6;x+=4.5)q.fillRect(x,-hw+1.5,1,W-3);
   if(!dead){q.fillStyle=variant==='rival'?'#7c3a2c':'#5f6a4c';rr(q,-L/2+4,-hw+4,L/2-2,W-8,3);q.fill();q.strokeStyle='#00000040';q.lineWidth=.8;for(let k=0;k<3;k++){q.beginPath();q.moveTo(-L/2+5+k*9,-hw+4);q.lineTo(-L/2+9+k*9,hw-4);q.stroke()}}}
  else{rr(q,-L/2+3,-cab,L-7,cab*2,6);q.fill()}
  // Hood with a center crease and louvers.
  const [h0,h1]=d.hood;q.fillStyle=shade(base,.08);rr(q,h0,-cab*.78,h1-h0,cab*1.56,4);q.fill();q.strokeStyle=shade(base,-.35);q.lineWidth=.7;q.beginPath();q.moveTo(h0+1,0);q.lineTo(h1-1,0);q.stroke();q.strokeStyle=shade(base,-.3);for(let x=h0+3;x<h1-6;x+=2.4)for(const sy of [-1,1]){q.beginPath();q.moveTo(x,sy*cab*.32);q.lineTo(x,sy*cab*.62);q.stroke()}
  // Radiator shell, bumper bars and headlamps.
  q.fillStyle=chrome;rr(q,L/2-4.5,-cab*.6,3.4,cab*1.2,1.4);q.fill();q.fillStyle='#4b4a42';for(let y=-cab*.5;y<cab*.5;y+=1.6)q.fillRect(L/2-3.9,y,2.2,.7);
  q.fillStyle=chrome;q.fillRect(L/2-.6,-hw+2,1.4,W-4);q.fillRect(-L/2-.4,-hw+3,1.4,W-6);
  for(const sy of [-1,1]){q.fillStyle=chrome;q.beginPath();q.arc(L/2-6,sy*(hw-5.2),2.6,0,Math.PI*2);q.fill();q.fillStyle=dead?'#333':'#fff3c8';q.beginPath();q.arc(L/2-5.6,sy*(hw-5.2),1.6,0,Math.PI*2);q.fill()}
  q.fillStyle=dead?'#2a1a16':'#b8392a';for(const sy of [-1,1])q.fillRect(-L/2+.6,sy*(cab-1.6)-1,1.6,2);
  // Spare wheel on the tail for sedans; sidemount on the special.
  if(type==='sedan'||type==='police'||type==='agent'){q.fillStyle='#151515';q.beginPath();q.ellipse(-L/2-1.2,0,2.4,5.6,0,0,Math.PI*2);q.fill();q.fillStyle='#5b5b52';q.beginPath();q.ellipse(-L/2-1.2,0,1,2.4,0,0,Math.PI*2);q.fill()}
  if(type==='custom'){for(const sy of [-1,1]){q.fillStyle='#111';q.beginPath();q.ellipse(9,sy*(hw-1),5.5,2.6,0,0,Math.PI*2);q.fill();q.fillStyle=chrome;q.beginPath();q.ellipse(9,sy*(hw-1),2.2,1,0,0,Math.PI*2);q.fill()}q.strokeStyle='#c9a961';q.lineWidth=.7;q.beginPath();q.moveTo(-L/2+5,-cab+1.6);q.lineTo(L/2-6,-cab+1.6);q.moveTo(-L/2+5,cab-1.6);q.lineTo(L/2-6,cab-1.6);q.stroke()}
  if(type==='coupe'){q.fillStyle=shade(base,-.12);rr(q,-L/2+4,-cab*.8,13,cab*1.6,3);q.fill();q.strokeStyle=shade(base,-.4);q.strokeRect(-L/2+5,-cab*.6,10,cab*1.2)}
  // The cabin well: dark glass where the roof sits, visible as the roof shifts with height.
  const [r0,r1]=d.roof;q.fillStyle='#0d1a1d';rr(q,r0-1.5,-cab+1.2,r1-r0+3.2,cab*2-2.4,3.5);q.fill();q.fillStyle='#7fa3a033';q.fillRect(r1-.2,-cab+2,2.4,cab*2-4);
  if(type==='police'){q.fillStyle='#e9e6d6';rr(q,r0+2,-cab-.2,r1-r0-4,2.3,1);q.fill();rr(q,r0+2,cab-2.1,r1-r0-4,2.3,1);q.fill()}
  if(type==='agent'){q.strokeStyle='#c9a961';q.lineWidth=.6;q.beginPath();q.moveTo(-L/2+4,-cab+1.2);q.lineTo(L/2-5,-cab+1.2);q.moveTo(-L/2+4,cab-1.2);q.lineTo(L/2-5,cab-1.2);q.stroke()}
  if(dead){q.fillStyle='#000000';for(const [x,y,r] of [[4,-3,6],[-8,4,5],[12,5,4],[-14,-4,4]]){q.globalAlpha=.4;q.beginPath();q.arc(x,y,r,0,Math.PI*2);q.fill()}q.globalAlpha=1}
  return{c,w:L+pad*2,h:W+pad*2}}
 function roof(type,color,variant){const d=DIM[type]||DIM.sedan,[r0,r1]=d.roof,W=d.wid,cab=W/2*.74,pad=3,w=r1-r0+pad*2,h=cab*2+pad*2,c=document.createElement('canvas');c.width=Math.ceil(w*S);c.height=Math.ceil(h*S);const q=c.getContext('2d');q.scale(S,S);q.translate(pad-r0,h/2);
  const dead=variant==='wreck',base=dead?'#222624':type==='police'?'#15191b':type==='agent'?'#0f1213':(type==='sedan'&&color.length?shade(color,-.55):shade(color,-.2));
  const gr=q.createLinearGradient(0,-cab,0,cab);gr.addColorStop(0,shade(base,.35));gr.addColorStop(.5,base);gr.addColorStop(1,shade(base,-.3));q.fillStyle=gr;rr(q,r0,-cab+2.2,r1-r0,cab*2-4.4,3);q.fill();
  q.strokeStyle='#ffffff22';q.lineWidth=.6;q.beginPath();q.moveTo(r0+2,-cab+3.2);q.lineTo(r1-2,-cab+3.2);q.stroke();
  if(type==='police'&&!dead){q.fillStyle='#a8352a';q.beginPath();q.arc((r0+r1)/2,0,1.8,0,Math.PI*2);q.fill()}
  return{c,w,h,off:(r0+r1)/2}}
 const cache=new Map();
 function get(type,color,variant=''){const k=type+'|'+color+'|'+variant;let v=cache.get(k);if(!v){v={body:body(type,color,variant),roof:roof(type,color,variant)};cache.set(k,v);if(cache.size>160)cache.delete(cache.keys().next().value)}return v}
 // Tires sit under the fenders and stick out enough to show steering.
 function wheels(q,type,steer,spin){const d=DIM[type]||DIM.sedan,hw=d.wid/2;for(const [x,front] of [[d.len/2-11,1],[-d.len/2+9,0]])for(const sy of [-1,1]){q.save();q.translate(x,sy*(hw-1.6));if(front)q.rotate(steer);q.fillStyle='#0b0c0c';q.beginPath();q.roundRect(-4.4,-2.3,8.8,4.6,1.8);q.fill();q.fillStyle='#2c2d2a';const o=((spin||0)%2.2+2.2)%2.2;for(let k=-4.4+o;k<4.4;k+=2.2)q.fillRect(k,-2.3,.7,4.6);q.restore()}}
 return{get,DIM,S,wheels}})();
function drawCar(c){const lift=c.z||0,type=CAR_ART.DIM[c.type]?c.type:'sedan',variant=c.dead?'wreck':(c.rival||c.missionTruck)&&c.type==='truck'?'rival':'',art=CAR_ART.get(type,c.color||'#56666a',variant),b=art.body,len=c.type==='truck'?61:50,width=c.type==='truck'?29:25;
 ctx.save();if(lift>0){ctx.fillStyle='#000a';ctx.beginPath();ctx.ellipse(c.x+lift*.22,c.y+lift*.32,27,15,c.a,0,TAU);ctx.fill();const q=project3(c.x,c.y,lift),k=1+lift/140;ctx.translate(q.x,q.y);ctx.scale(k,k)}else ctx.translate(c.x,c.y);ctx.rotate(c.a);
 // Soft contact shadow under the body.
 if(!lift){ctx.fillStyle='#02090a66';ctx.beginPath();ctx.roundRect(-len/2+3,-width/2+4,len+2,width+1,8);ctx.fill()}
 if(!c.dead){const light=ctx.createLinearGradient(len/2,0,len/2+150,0);light.addColorStop(0,'#ead28a20');light.addColorStop(1,'#ead28a00');ctx.fillStyle=light;ctx.beginPath();ctx.moveTo(len/2,-width/2+3);ctx.lineTo(len/2+150,-62);ctx.lineTo(len/2+150,62);ctx.lineTo(len/2,width/2-3);ctx.closePath();ctx.fill()}
 c.wspin=(c.wspin||0)+(c.v||0)*.016*.45;const steerVis=(c.steering||0)*.6/(1+Math.abs(c.v||0)/200);CAR_ART.wheels(ctx,type,c.dead?0:steerVis,c.wspin);
 ctx.drawImage(b.c,-b.w/2,-b.h/2,b.w,b.h);
 // Wear shows as scorch and grime once a car is badly hurt.
 const hurt=c.dead?0:1-c.hp/(c.maxHp||1);if(hurt>.3){ctx.fillStyle=`rgba(12,10,8,${Math.min(.55,(hurt-.3)*.9)})`;const sd=(c.x*7+c.y*3)%1;for(const [x,y,r] of [[len*.18,-width*.15,6],[-len*.22,width*.2,5],[len*.05,width*.25,4],[-len*.05,-width*.25,4.5]]){ctx.beginPath();ctx.ellipse(x+sd*3,y,r,r*.7,sd*3,0,TAU);ctx.fill()}}
 const braking=c.braking||((c.throttle||0)<-.1&&c.v>5);if(braking&&!c.dead){ctx.fillStyle='#ff5a3a';ctx.shadowBlur=8;ctx.shadowColor='#ff3a2a';for(const sy of [-1,1])ctx.fillRect(-len/2-1,sy*7-1.5,2.4,3);ctx.shadowBlur=0}
 if(c.type==='agent'&&!c.dead&&c.ai==='police'){ctx.fillStyle=Math.sin(elapsed*16)>0?'#ff5a40':'#401010';ctx.shadowBlur=10;ctx.shadowColor='#e0573f';ctx.fillRect(6,-2.5,3,5);ctx.shadowBlur=0}
 if(c.rival&&!c.dead){ctx.strokeStyle='#e0705acc';ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.strokeRect(-len/2-5,-width/2-5,len+10,width+10);ctx.setLineDash([])}
 if(c.mission&&!c.dead){ctx.strokeStyle='#e8c070cc';ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.lineDashOffset=-elapsed*10;ctx.strokeRect(-len/2-5,-width/2-5,len+10,width+10);ctx.setLineDash([])}
 if(c.hit>0){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.5;ctx.drawImage(b.c,-b.w/2,-b.h/2,b.w,b.h);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'}
 ctx.restore()}
// The roof floats a little with height so the cabin reads as raised.
function drawRoof(c){const type=CAR_ART.DIM[c.type]?c.type:'sedan',variant=c.dead?'wreck':(c.rival||c.missionTruck)&&c.type==='truck'?'rival':'',r=CAR_ART.get(type,c.color||'#56666a',variant).roof,p=project3(c.x,c.y,9+(c.z||0)+Math.sin(elapsed*5+c.x)*Math.min(1,Math.abs(c.v||0)/160)*.6);ctx.save();ctx.translate(p.x,p.y);if(c.z>0){const k=1+c.z/140;ctx.scale(k,k)}ctx.rotate(c.a);ctx.drawImage(r.c,r.off-r.w/2,-r.h/2,r.w,r.h);
 if(c.type==='police'&&(c.ai==='police'||c.ai==='roadblock')&&!c.dead){const ph=Math.sin(elapsed*13+(c.x%7))>0;ctx.fillStyle=ph?'#ff5a40':'#8fb4ff';ctx.shadowBlur=14;ctx.shadowColor=ctx.fillStyle;ctx.beginPath();ctx.arc(r.off,0,2.6,0,TAU);ctx.fill();ctx.shadowBlur=0}
 ctx.restore()}
// Effects art drawn once into sprites: soft smoke, flame, embers, a muzzle star, scorch marks.
const FX=(()=>{const mk=(wd,ht,f)=>{const c=document.createElement('canvas');c.width=wd;c.height=ht;const q=c.getContext('2d');if(q&&q.createRadialGradient)f(q);return c},
 rad=(q,x,y,r,stops)=>{const g2=q.createRadialGradient(x,y,0,x,y,r);for(const [o,col] of stops)g2.addColorStop(o,col);q.fillStyle=g2;q.beginPath();q.arc(x,y,r,0,TAU);q.fill()},
 puff=(r,g,b)=>mk(72,72,q=>{for(let i=0;i<8;i++){const a=i*2.4,d=i?13:0,rr=i?17:24;rad(q,36+Math.cos(a)*d,36+Math.sin(a)*d,rr,[[0,`rgba(${r},${g},${b},.42)`],[.6,`rgba(${r},${g},${b},.18)`],[1,`rgba(${r},${g},${b},0)`]])}});
 return{smokeDark:puff(34,38,35),smokeLight:puff(178,180,164),
  flame:mk(64,64,q=>rad(q,32,32,32,[[0,'rgba(255,250,222,1)'],[.22,'rgba(255,214,120,.95)'],[.5,'rgba(240,120,42,.55)'],[1,'rgba(150,40,12,0)']])),
  ember:mk(64,64,q=>rad(q,32,32,32,[[0,'rgba(255,150,70,.85)'],[.45,'rgba(200,70,30,.4)'],[1,'rgba(90,20,10,0)']])),
  glow:mk(64,64,q=>rad(q,32,32,32,[[0,'rgba(255,240,200,.9)'],[.35,'rgba(255,190,110,.45)'],[1,'rgba(255,140,60,0)']])),
  scorch:mk(96,96,q=>{rad(q,48,48,48,[[0,'rgba(8,10,9,.85)'],[.55,'rgba(14,16,14,.5)'],[1,'rgba(20,22,20,0)']]);q.strokeStyle='rgba(6,8,7,.5)';q.lineWidth=2;for(let i=0;i<9;i++){const a=i*.7+.3;q.beginPath();q.moveTo(48+Math.cos(a)*14,48+Math.sin(a)*14);q.lineTo(48+Math.cos(a)*(30+i%3*6),48+Math.sin(a)*(30+i%3*6));q.stroke()}}),
  flash:mk(96,64,q=>{rad(q,16,32,18,[[0,'rgba(255,255,236,1)'],[.4,'rgba(255,220,140,.8)'],[1,'rgba(255,160,60,0)']]);const g2=q.createLinearGradient(12,0,92,0);g2.addColorStop(0,'rgba(255,250,220,1)');g2.addColorStop(.5,'rgba(255,190,90,.75)');g2.addColorStop(1,'rgba(255,120,40,0)');q.fillStyle=g2;q.beginPath();q.moveTo(12,26);q.lineTo(92,32);q.lineTo(12,38);q.closePath();q.fill();for(const sy of [-1,1]){q.beginPath();q.moveTo(16,32);q.lineTo(46,32+sy*22);q.lineTo(22,32+sy*3);q.closePath();q.fill()}})}})();
const GLOWC=new Set(['#ffd27a','#ffb347','#fff0b8','#efca77','#e9b55c','#f6e2a4','#efcf8a','#ffcf6a']);
function emitFlame(c,k){const n=quality>=1?2:1;for(let i=0;i<n;i++){const o=rand(2,18);flames.push({x:c.x+Math.cos(c.a)*o+rand(-7,7),y:c.y+Math.sin(c.a)*o+rand(-7,7),z:(c.z||0)+8,vx:(c.vx||0)*.5+rand(-9,9),vy:(c.vy||0)*.5+rand(-9,9),vz:rand(30,64),r:rand(5,9)*(.7+k*.6),life:rand(.35,.62),max:.62})}if(flames.length>280)flames.splice(0,flames.length-280)}
function fxTick(dt){for(const f of flames){f.life-=dt;f.x+=f.vx*dt;f.y+=f.vy*dt;f.z+=f.vz*dt;const d=1-Math.min(1,dt*3);f.vx*=d;f.vy*=d;f.r*=1+(f.ball?dt*.9:-dt*.7)}flames=flames.filter(f=>f.life>0);for(const m of flashes)m.life-=dt;flashes=flashes.filter(m=>m.life>0);for(const sc of scorches)sc.life-=dt;scorches=scorches.filter(sc=>sc.life>0)}
function drawFlames(){if(!flames.length)return;ctx.save();ctx.globalCompositeOperation='lighter';for(const f of flames){if(!visible(f,120))continue;const p=project3(f.x,f.y,f.z),k=clamp(f.life/f.max,0,1),r=f.r*(f.ball?1.7:1.35);ctx.globalAlpha=k*(f.ball?.95:.85);ctx.drawImage(k>.42?FX.flame:FX.ember,p.x-r,p.y-r,r*2,r*2)}ctx.restore()}
function drawFlashes(){if(!flashes.length)return;ctx.save();ctx.globalCompositeOperation='lighter';for(const m of flashes){if(!visible(m,40))continue;ctx.save();ctx.translate(m.x,m.y);ctx.rotate(m.a);ctx.globalAlpha=clamp(m.life/.07,0,1);const k=m.s*(.85+Math.random()*.3);ctx.drawImage(FX.flash,-6*k,-12*k,36*k,24*k);ctx.restore()}ctx.restore()}
// Trees: clustered canopies drawn once per tone and size, then swayed by the wind in two layers.
const TREE_ART=(()=>{const cache=new Map(),TONES=['#526247','#6d7046','#8c7d48','#5f704d','#a08a50'];
 function make(tone,r,v){const col=TONES[tone]||TONES[0],S=1.5,half=Math.ceil(r*1.35+4),sz=half*2,base=document.createElement('canvas'),top=document.createElement('canvas');base.width=base.height=top.width=top.height=Math.ceil(sz*S);const qb=base.getContext('2d'),qt=top.getContext('2d');if(!qb||!qb.createRadialGradient)return{base,top,sz};let seed=tone*7919+r*131+v*104729+17;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  qb.scale(S,S);qb.translate(half,half);qt.scale(S,S);qt.translate(half,half);const blobs=[];for(let i=0;i<9;i++){const a=rnd()*TAU,d=r*(.18+rnd()*.42);blobs.push([Math.cos(a)*d,Math.sin(a)*d,r*(.42+rnd()*.2)])}
  qb.fillStyle=tint(col,.58);for(const [x,y,br] of blobs){qb.beginPath();qb.arc(x+1,y+1.5,br,0,TAU);qb.fill()}
  for(const [x,y,br] of blobs){const g2=qb.createRadialGradient(x-br*.4,y-br*.5,br*.1,x,y,br);g2.addColorStop(0,tint(col,1.12));g2.addColorStop(1,tint(col,.78));qb.fillStyle=g2;qb.beginPath();qb.arc(x-.6,y-.8,br*.9,0,TAU);qb.fill()}
  for(let i=0;i<6;i++){const a=-2.4+rnd()*1.6,d=r*(.12+rnd()*.38),x=Math.cos(a)*d-r*.1,y=Math.sin(a)*d-r*.15,br=r*(.18+rnd()*.14),g2=qt.createRadialGradient(x-br*.3,y-br*.3,0,x,y,br);g2.addColorStop(0,tint(col,1.42)+'d0');g2.addColorStop(1,tint(col,1.08)+'00');qt.fillStyle=g2;qt.beginPath();qt.arc(x,y,br,0,TAU);qt.fill()}
  qt.fillStyle=tint(col,1.5)+'88';for(let i=0;i<Math.round(r*1.4);i++){const a=rnd()*TAU,d=rnd()*r*.85;qt.fillRect(Math.cos(a)*d-r*.08,Math.sin(a)*d-r*.1,1.1,1.1)}
  return{base,top,sz}}
 return{get(t){if(!t.art){const rb=Math.max(6,Math.round(t.r/2)*2),v=Math.abs(Math.round(t.x)*7+Math.round(t.y)*3)%3,k=(t.tone||0)+'|'+rb+'|'+v;let a=cache.get(k);if(!a){a=make(t.tone||0,rb,v);cache.set(k,a)}t.art=a}return t.art}}})();
// People seen from above: hat brim, shoulders, swinging arms and legs. Figures face +x.
const HATS=['fedora','cloche','cap','fedora','bare','cap'],SKINS=['#d2ad86','#b98c64','#8e6043','#6e4a33','#e0bf98'];
function personLook(p,enemy){if(p===player)return{hat:'fedora',coat:'#9a8457',hatC:'#2a2724',band:'#7a6440',skin:'#cfa982',gun:true};if(p.look&&enemy)return p.look;if(enemy)return{hat:'fedora',coat:'#2b2e30',hatC:'#141617',band:'#7c3127',skin:p.skin||(p.skin=SKINS[Math.floor(Math.random()*SKINS.length)]),gun:true};
 if(!p.look){const hsh=Math.abs(Math.round(p.x*3.1+p.y*1.7)),hat=HATS[hsh%HATS.length],coat=p.color||'#5d6450';p.look={hat,coat,hatC:hat==='cloche'?pick(['#7a4848','#4c5a6a','#8a7350','#5a3f52']):hat==='cap'?tint(coat,.7):pick(['#2d2b27','#3e3529','#4a4a44','#23272a']),band:hat==='cloche'?'#d9c59a':'#00000066',skin:SKINS[hsh%SKINS.length],gun:false}}return p.look}
function drawHat(L){if(L.hat==='fedora'){ctx.fillStyle=L.hatC;ctx.beginPath();ctx.ellipse(.6,0,7.2,7.6,0,0,TAU);ctx.fill();ctx.strokeStyle=L.band;ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(0,0,4.9,4.6,0,0,TAU);ctx.stroke();ctx.fillStyle=tint(L.hatC,1.35);ctx.beginPath();ctx.ellipse(-.2,0,4.3,3.9,0,0,TAU);ctx.fill();ctx.strokeStyle=tint(L.hatC,.6);ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(-2.4,0);ctx.lineTo(2.4,0);ctx.stroke()}
 else if(L.hat==='cloche'){ctx.fillStyle=L.hatC;ctx.beginPath();ctx.ellipse(.4,0,5.8,6,0,0,TAU);ctx.fill();ctx.strokeStyle=L.band;ctx.lineWidth=1.1;ctx.beginPath();ctx.arc(.4,0,4.6,-1.2,1.2);ctx.stroke();ctx.fillStyle=tint(L.hatC,1.25);ctx.beginPath();ctx.arc(-.6,-.6,3,0,TAU);ctx.fill()}
 else if(L.hat==='cap'){ctx.fillStyle=tint(L.hatC,.75);ctx.beginPath();ctx.ellipse(4.6,0,2.6,3.6,0,0,TAU);ctx.fill();ctx.fillStyle=L.hatC;ctx.beginPath();ctx.arc(-.2,0,5,0,TAU);ctx.fill();ctx.fillStyle=tint(L.hatC,1.25);ctx.beginPath();ctx.arc(-1,-.8,2.6,0,TAU);ctx.fill();ctx.fillStyle=tint(L.hatC,.6);ctx.fillRect(-.6,-.6,1.2,1.2)}
 else{ctx.fillStyle='#2a1f18';ctx.beginPath();ctx.arc(-.3,0,4.4,0,TAU);ctx.fill();ctx.fillStyle=L.skin;ctx.beginPath();ctx.ellipse(2.4,0,2,3,0,0,TAU);ctx.fill()}}
function drawPerson(p,enemy=false,body=false){const L=personLook(p,enemy),coat=p.hit>0?'#d8c08c':L.coat;
 if((p.down>0||p.knock>0)||body){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.spinA||p.a);ctx.fillStyle='#00000055';ctx.beginPath();ctx.ellipse(1,4,15,7,0,0,TAU);ctx.fill();ctx.fillStyle='#1d2222';ctx.fillRect(-17,-5,11,3.6);ctx.fillRect(-16,1.6,10,3.6);ctx.fillStyle=body?tint(coat,.75):coat;ctx.beginPath();ctx.ellipse(0,0,10.5,6.4,0,0,TAU);ctx.fill();ctx.fillStyle=tint(coat,.85);ctx.beginPath();ctx.ellipse(4,-8,3.6,2.2,.5,0,TAU);ctx.fill();ctx.beginPath();ctx.ellipse(5,8,3.6,2.2,-.4,0,TAU);ctx.fill();ctx.fillStyle=L.skin;ctx.beginPath();ctx.arc(11.5,0,4,0,TAU);ctx.fill();if(L.hat!=='bare'){ctx.save();ctx.translate(20,7);ctx.rotate(.8);drawHat(L);ctx.restore()}ctx.restore();return}
 ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);ctx.fillStyle='#00000055';ctx.beginPath();ctx.ellipse(3,5,9,6.5,0,0,TAU);ctx.fill();
 const sw=p===player?Math.sin(player.step||0):Math.sin(elapsed*8+p.x*.37);
 ctx.fillStyle='#1c2121';ctx.fillRect(sw*4-3.4,-4.9,6.8,3.3);ctx.fillRect(-sw*4-3.4,1.6,6.8,3.3);ctx.fillStyle='#0c0e0e';ctx.fillRect(sw*4+2.2,-4.9,2,3.3);ctx.fillRect(-sw*4+2.2,1.6,2,3.3);
 ctx.fillStyle=tint(coat,.8);ctx.beginPath();ctx.ellipse(-2.2,0,6.6,8.4,0,0,TAU);ctx.fill();
 const armC=tint(coat,.9);if(L.gun){ctx.fillStyle=armC;ctx.beginPath();ctx.moveTo(-1,-9.4);ctx.lineTo(9,-8.6);ctx.lineTo(9,-6.2);ctx.lineTo(0,-5.6);ctx.closePath();ctx.fill();ctx.fillStyle='#1a1e1f';ctx.fillRect(9,-8.8,10.5,2.6);ctx.fillStyle='#4a4f4c';ctx.fillRect(12,-8.8,7,.8);ctx.fillStyle=L.skin;ctx.beginPath();ctx.arc(9.6,-7.4,2,0,TAU);ctx.fill();ctx.fillStyle=armC;ctx.beginPath();ctx.ellipse(-sw*3,8.3,3.4,2.4,0,0,TAU);ctx.fill()}
 else{ctx.fillStyle=armC;ctx.beginPath();ctx.ellipse(-sw*3,-8.3,3.4,2.4,0,0,TAU);ctx.fill();ctx.beginPath();ctx.ellipse(sw*3,8.3,3.4,2.4,0,0,TAU);ctx.fill();ctx.fillStyle=L.skin;ctx.beginPath();ctx.arc(-sw*3+3,-8.3,1.5,0,TAU);ctx.arc(sw*3+3,8.3,1.5,0,TAU);ctx.fill()}
 ctx.fillStyle=coat;ctx.beginPath();ctx.ellipse(0,0,5.6,9.2,0,0,TAU);ctx.fill();ctx.fillStyle=tint(coat,1.16);ctx.beginPath();ctx.ellipse(-.6,-1.4,3.6,6.4,0,0,TAU);ctx.fill();ctx.fillStyle=tint(coat,1.3);ctx.beginPath();ctx.moveTo(2.6,-4);ctx.lineTo(5,0);ctx.lineTo(2.6,4);ctx.lineTo(3.6,0);ctx.closePath();ctx.fill();
 ctx.fillStyle=L.skin;ctx.beginPath();ctx.arc(1.2,0,4.2,0,TAU);ctx.fill();drawHat(L);ctx.restore();
 if(enemy&&p.hp<p.maxHp&&p.hp>0){ctx.fillStyle='#152222';ctx.fillRect(p.x-15,p.y-22,30,3);ctx.fillStyle='#c47e5f';ctx.fillRect(p.x-15,p.y-22,30*p.hp/p.maxHp,3)}
}
function drawTree(t){const art=TREE_ART.get(t),sw=(Math.sin(elapsed*1.4+t.x*.013+t.y*.007)+Math.sin(elapsed*2.3+t.x*.021)*.4)*(.35+weather.wind*2.2)*Math.min(1.4,t.r/18),h=art.sz/2;ctx.fillStyle='#172e2b55';ctx.beginPath();ctx.ellipse(t.x+7+sw*.3,t.y+9,t.r*1.1,t.r*.75,0,0,TAU);ctx.fill();ctx.strokeStyle='#4d4330';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(t.x,t.y+4);ctx.lineTo(t.x-1+sw*.3,t.y-8);ctx.stroke();ctx.drawImage(art.base,t.x-h+sw*.6,t.y-5-h,art.sz,art.sz);ctx.drawImage(art.top,t.x-h+sw*1.4,t.y-6-h,art.sz,art.sz)}
let cachedRoute=[],routeFrame=0;
function goal(){return job?job.target:trial?trial.def.cps[trial.i]:null}
function getRoute(){const g=goal();if(!g)return[];if(frame-routeFrame>25||!cachedRoute.length){cachedRoute=roadRoute(player,g);routeFrame=frame}return cachedRoute}
function drawRoute(){if(!goal())return;const route=getRoute();ctx.save();ctx.strokeStyle='#c7a55e4f';ctx.lineWidth=5;ctx.lineCap='round';ctx.setLineDash([7,15]);ctx.lineDashOffset=-elapsed*12;ctx.beginPath();ctx.moveTo(player.x,player.y);for(const p of route)ctx.lineTo(p.x,p.y);ctx.stroke();ctx.restore()}
function drawMarker(p,active=false){if(!visible(p,160))return;const s=active?51:29;ctx.save();ctx.translate(p.x,p.y);if(active){const glow=ctx.createRadialGradient(0,0,5,0,0,85);glow.addColorStop(0,'#d5ae6220');glow.addColorStop(1,'#d5ae6200');ctx.fillStyle=glow;ctx.fillRect(-85,-85,170,170)}ctx.strokeStyle=active?'#e6c37b':p.color+'88';ctx.lineWidth=active?2:1;ctx.setLineDash([active?12:4,active?6:5]);ctx.lineDashOffset=-elapsed*12;ctx.beginPath();ctx.arc(0,0,s+(active?Math.sin(elapsed*3)*3:0),0,TAU);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle='#0c1a1bd9';ctx.beginPath();ctx.arc(0,0,14,0,TAU);ctx.fill();ctx.fillStyle=active?'#e6c37b':p.color;ctx.font='bold 11px Georgia';ctx.textAlign='center';ctx.fillText(active?'◆':p.icon,0,4);if(active){ctx.font='9px Arial';ctx.fillStyle='#ebd7ad';ctx.fillText(p.name||'MARKED COUPE',0,-69)}ctx.restore()}
function drawMap(c,size,full){const mapHeight=full?Math.round(size*WORLD_H/WORLD):size;c.clearRect(0,0,size,mapHeight);c.fillStyle='#132527';c.fillRect(0,0,size,mapHeight);let range=full?WORLD:1350,sx=full?0:clamp((interior?interior.outside.x:player.x)-range/2,0,WORLD-range),sy=full?0:clamp((interior?interior.outside.y:player.y)-range/2,0,WORLD_H-range),scale=size/range;
 if(full)c.drawImage(map,0,0,WORLD,WORLD_H,0,0,size,mapHeight);else c.drawImage(map,sx,sy,range,range,0,0,size,size);c.fillStyle=full?'#0a20252b':'#0a202547';c.fillRect(0,0,size,mapHeight);const point=o=>({x:(o.x-sx)*scale,y:(o.y-sy)*scale});
 const gl=goal();if(gl){const from=interior?interior.outside:player;c.strokeStyle=trial?'#bfe0c4':'#d7b365';c.lineWidth=full?2.5:1.5;c.beginPath();let pp=point(from);c.moveTo(pp.x,pp.y);for(const p of (full||interior?roadRoute(from,gl):getRoute())){const q=point(p);c.lineTo(q.x,q.y)}c.stroke();const t=point(gl);c.fillStyle='#f1c878';c.beginPath();c.arc(clamp(t.x,5,size-5),clamp(t.y,5,size-5),full?7:4,0,TAU);c.fill()}
 airBridge.map(c,point,full);airOps.map(c,point,full);
 for(const p of places){if(p.hidden&&save.secrets[p.id]!=='found')continue;const q=point(p);if(q.x<0||q.y<0||q.x>size||q.y>size)continue;c.fillStyle=p.color;c.font=`bold ${full?11:8}px Arial`;c.textAlign='center';c.fillText(p.icon,q.x,q.y+3);}
 if(!job&&!trial&&!frenzy){for(const t of TRIALS){const q=point(t.start);c.fillStyle='#e9dfc7';c.fillRect(q.x-3,q.y-3,6,6);c.fillStyle='#132527';c.fillRect(q.x-3,q.y-3,3,3);c.fillRect(q.x,q.y,3,3)}const q=point(RAMPAGE);c.fillStyle='#e0705a';c.fillRect(q.x-3,q.y-3,6,6)}
 for(const k of cars)if((k.rival||k.missionTruck)&&!k.dead){const q=point(k);c.fillStyle=k.missionTruck?'#f1c878':'#e0705a';c.fillRect(q.x-2.5,q.y-2.5,5,5)}
 if(LAW.search&&stars()){const q=point(LAW.search),rr=LAW.search.r*scale,blink=lawHidden()?.75+.25*Math.sin(elapsed*5):1;c.fillStyle=`rgba(232,98,72,${.3*blink})`;c.strokeStyle=`rgba(244,120,92,${blink})`;c.lineWidth=full?2:1.6;c.beginPath();c.arc(q.x,q.y,rr,0,TAU);c.fill();c.stroke()}
 for(const e of enemies.filter(e=>e.hp>0).concat(cars.filter(c=>(c.ai==='police'||c.ai==='roadblock')&&!c.dead))){const p=point(e);c.fillStyle=e.cop||e.ai?'#8fb0e6':'#df7962';c.beginPath();c.arc(p.x,p.y,full?3.5:2.5,0,TAU);c.fill()}
 if(full){c.fillStyle='#e1d5ac';c.font='8px Georgia';c.textAlign='center';for(const zone of WLD.zones){const q=point(zone);c.fillText(zone.name,q.x,q.y-23)}for(const area of WLD.land.filter(a=>a.label)){const center=area.points.reduce((p,q)=>({x:p.x+q.x/area.points.length,y:p.y+q.y/area.points.length}),{x:0,y:0}),q=point(center);c.fillText(area.label,q.x,q.y)}}
 const p=point(interior?interior.outside:player);c.save();c.translate(p.x,p.y);c.rotate(player.air?player.air.a:player.car?player.car.a:player.a);c.fillStyle='#f5e7ba';c.strokeStyle='#111f20';c.lineWidth=1;c.beginPath();c.moveTo(8,0);c.lineTo(-5,-4);c.lineTo(-2,0);c.lineTo(-5,4);c.closePath();c.fill();c.stroke();c.restore();
}
function draw(){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#111e21';ctx.fillRect(0,0,w,h);
 if(interior){drawInterior();return}
 if(mode==='title'){camera.x=places[0].x+Math.sin(elapsed*.035)*340;camera.y=places[0].y+Math.cos(elapsed*.024)*220}
 const sX=shake>0?rand(-shake,shake):0,sY=shake>0?rand(-shake,shake):0;
 ctx.save();ctx.translate(w/2+sX,h/2+sY);ctx.scale(zoom,zoom);ctx.translate(-camera.x,-camera.y);
 const vx=camera.x-w/zoom/2-10,vy=camera.y-h/zoom/2-10,vw=w/zoom+20,vh=h/zoom+20;
 {const sx=clamp(Math.floor(vx),0,WORLD-1),sy=clamp(Math.floor(vy),0,WORLD_H-1),sw=Math.min(WORLD-sx,Math.ceil(vw)+2),sh=Math.min(WORLD_H-sy,Math.ceil(vh)+2);if(sw>0&&sh>0)ctx.drawImage(map,sx,sy,sw,sh,sx,sy,sw,sh)}
 // Reflections and warm gaslight on cold, wet pavement.
 for(const l of lamps){if(!visible(l,130))continue;if(l.broken){ctx.save();ctx.translate(l.x,l.y);ctx.rotate(l.fallA||0);ctx.fillStyle='#172a27';ctx.fillRect(0,-1.5,22,3);ctx.fillStyle='#6d6650';ctx.fillRect(20,-3,5,6);ctx.restore();continue}ctx.drawImage(glow,l.x-105,l.y-105);ctx.fillStyle='#172a27';ctx.fillRect(l.x-1,l.y-7,3,13);ctx.fillStyle='#d9c58e';ctx.fillRect(l.x-3,l.y-7,6,3);ctx.fillStyle='#d4bf7c16';ctx.fillRect(l.x-12,l.y+12,6,40)}
 drawRipples();
 for(const s of skids)if(visible(s)){ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.a);ctx.globalAlpha=Math.min(.45,s.life/20);ctx.fillStyle='#0c1518';ctx.fillRect(-11,-13,22,3);ctx.fillRect(-11,10,22,3);ctx.restore()}
 for(const sc of scorches)if(visible(sc,60)){ctx.globalAlpha=Math.min(.8,sc.life/12);ctx.drawImage(FX.scorch,sc.x-sc.r,sc.y-sc.r,sc.r*2,sc.r*2)}ctx.globalAlpha=1;
 if(started)drawRoute();
 drawProps();airBridge.drawPads(ctx,elapsed,o=>visible(o,130));airBridge.drawCraft(ctx,elapsed,quality,o=>visible(o,130),'ground');if(started)drawActivities();
 for(const p of places)if(!p.hidden||save.secrets[p.id]==='found')drawMarker(p,job&&job.target===p);if(job?.type==='wheelman'&&job.stage===0)drawMarker({...job.car,name:'MARKED COUPE'},true);if(job?.type==='hijack'&&job.stage===0&&!job.truck.dead)drawMarker({x:job.truck.x,y:job.truck.y,name:'RIVAL WHISKEY TRUCK'},true);if(job?.type==='hijack'&&job.stage===1)drawMarker({x:job.crate.x,y:job.crate.y,name:'WHISKEY CRATES'},true);if(job?.type==='raid'&&job.stage===0)drawMarker({...job.site,name:'RIVAL STILL'},true);
 for(const p of peds)if(visible(p,30))drawPerson(p);
 for(const e of enemies)if(visible(e,30))drawPerson(e,true,e.hp<=0);
 const renderCars=cars.filter(c=>visible(c,150)).sort((a,b)=>a.y-b.y);for(const c of renderCars)if(!(c.z>14))drawCar(c);
 drawCrossings();drawTrain();
 for(const p of pickups){if(!visible(p))continue;if(p.type==='crate'){ctx.save();ctx.translate(p.x,p.y);for(const [ox,oy] of [[-8,-6],[7,-5],[0,7]]){ctx.fillStyle='#8a6a3f';ctx.fillRect(ox-7,oy-7,14,14);ctx.strokeStyle='#4c3a22';ctx.strokeRect(ox-7,oy-7,14,14)}ctx.strokeStyle='#e6c37b';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,24+Math.sin(elapsed*5)*3,0,TAU);ctx.stroke();ctx.restore();continue}ctx.fillStyle=p.type==='cash'?'#d8b46c':'#9cb59c';ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.PI/4);ctx.fillRect(-4,-4,8,8);ctx.restore();ctx.strokeStyle='#d8b46c55';ctx.beginPath();ctx.arc(p.x,p.y,10+Math.sin(elapsed*4)*2,0,TAU);ctx.stroke()}
 if(started&&!player.car&&!player.air){if(player.invincible<=0||Math.floor(elapsed*12)%2)drawPerson(player)}
 for(const t of trees)if(visible(t,60))drawTree(t);
 for(const b of buildings)if(visible({x:b.x+b.w/2,y:b.y+b.h/2},140))drawBuilding3D(b);
 drawWorldLife();airBridge.drawCraft(ctx,elapsed,quality,o=>visible(o,150),'air');airOps.draw(ctx,elapsed,quality,o=>visible(o,180));
 for(const c of renderCars)if(c.z>14){drawCar(c);drawRoof(c)}
 for(const p of particles){if(GLOWC.has(p.color)||!visible(p))continue;ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size)}ctx.globalAlpha=1;
 ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';for(const b of bullets){const pl=b.from==='player';ctx.strokeStyle=pl?'rgba(255,214,130,.32)':'rgba(255,150,100,.32)';ctx.lineWidth=3.6;ctx.beginPath();ctx.moveTo(b.x-b.vx*.032,b.y-b.vy*.032);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.strokeStyle=pl?'#fff2c8':'#ffc9a0';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(b.lastX,b.lastY);ctx.lineTo(b.x,b.y);ctx.stroke()}
 for(const p of particles){if(!GLOWC.has(p.color)||!visible(p))continue;ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.strokeStyle=p.color;ctx.lineWidth=Math.max(1,p.size*.8);ctx.beginPath();ctx.moveTo(p.x-p.vx*.035,p.y-p.vy*.035);ctx.lineTo(p.x,p.y);ctx.stroke()}ctx.restore();drawFlashes();
 if(started){drawOverlays();drawThreats()}
 ctx.restore();
 drawLighting(sX,sY);drawRain();
 if(flash>0){ctx.fillStyle=`rgba(171,70,48,${flash*.4})`;ctx.fillRect(0,0,w,h)}
 drawPursuitEdges();if(started&&goal()&&mode==='play')drawCompass();
}
function drawProps(){for(const p of props){if(p.type==='lamp'||!visible(p,30))continue;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a||0);if(p.broken){if(p.type==='crate'){ctx.fillStyle='#5d4a2e';for(let i=0;i<4;i++)ctx.fillRect(-9+i*5,(i%2?3:-4),7,2)}else if(p.type!=='xbarrel'){ctx.fillStyle='#3a2a1a88';ctx.beginPath();ctx.ellipse(0,0,10,6,0,0,TAU);ctx.fill()}else{ctx.fillStyle='#16110d';ctx.beginPath();ctx.arc(0,0,11,0,TAU);ctx.fill()}ctx.restore();continue}
 ctx.fillStyle='#04101266';ctx.fillRect(-p.r+3,-p.r+4,p.r*2,p.r*2);if(p.type==='crate'){ctx.fillStyle='#8a6a3f';ctx.fillRect(-9,-9,18,18);ctx.strokeStyle='#4c3a22';ctx.lineWidth=1.5;ctx.strokeRect(-9,-9,18,18);ctx.beginPath();ctx.moveTo(-9,-9);ctx.lineTo(9,9);ctx.moveTo(9,-9);ctx.lineTo(-9,9);ctx.stroke()}else{ctx.fillStyle=p.type==='xbarrel'?'#a8432f':'#6b5136';ctx.beginPath();ctx.arc(0,0,p.r,0,TAU);ctx.fill();ctx.strokeStyle=p.type==='xbarrel'?'#e9c27a':'#3a2b1c';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,p.r-2.5,0,TAU);ctx.stroke();if(p.type==='xbarrel'){ctx.fillStyle='#f3d28a';ctx.font='bold 8px Arial';ctx.textAlign='center';ctx.fillText('!',0,3)}}ctx.restore()}}
function drawFlag(p,label,color){if(!visible(p,120))return;ctx.save();ctx.translate(p.x,p.y);ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash([10,6]);ctx.lineDashOffset=-elapsed*14;ctx.beginPath();ctx.arc(0,0,44+Math.sin(elapsed*3)*2,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#0c1a1be0';ctx.beginPath();ctx.arc(0,0,16,0,TAU);ctx.fill();for(let i=0;i<3;i++)for(let j=0;j<3;j++){ctx.fillStyle=(i+j)%2?color:'#0c1a1b';ctx.fillRect(-7.5+i*5,-7.5+j*5,5,5)}ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(label,0,-56);ctx.restore()}
function drawActivities(){if(!job&&!trial&&!frenzy){for(const t of TRIALS)drawFlag(t.start,'HOT RUN · '+t.name.toUpperCase(),'#e9dfc7');drawFlag(RAMPAGE,frenzyCd>0?'RAMPAGE · '+Math.ceil(frenzyCd)+'s':'RIVAL RAMPAGE','#e0705a')}
 if(trial){trial.def.cps.forEach((cp,i)=>{if(i<trial.i||i>trial.i+1||!visible(cp,120))return;const now=i===trial.i;ctx.save();ctx.translate(cp.x,cp.y);ctx.globalAlpha=now?1:.35;ctx.strokeStyle='#bfe0c4';ctx.lineWidth=now?4:2;ctx.beginPath();ctx.arc(0,0,now?60+Math.sin(elapsed*5)*4:50,0,TAU);ctx.stroke();ctx.fillStyle='#bfe0c4';ctx.font='bold 22px Impact,Arial';ctx.textAlign='center';ctx.fillText(i===trial.def.cps.length-1?'FINISH':String(i+1),0,8);ctx.restore()})}
 for(const j of jugs){if(save.jugs.includes(j.id)||Math.abs(j.x-player.x)>650||Math.abs(j.y-player.y)>420)continue;const tw=.5+.5*Math.sin(elapsed*4+j.id);ctx.save();ctx.translate(j.x,j.y);ctx.fillStyle='#04101277';ctx.beginPath();ctx.ellipse(3,6,8,4,0,0,TAU);ctx.fill();ctx.fillStyle='#9b7a52';ctx.beginPath();ctx.ellipse(0,1,7,8,0,0,TAU);ctx.fill();ctx.fillStyle='#d9cfb4';ctx.fillRect(-4,-1,8,4);ctx.fillStyle='#5a4126';ctx.fillRect(-2,-10,4,5);ctx.globalAlpha=tw;ctx.fillStyle='#fff6d0';ctx.beginPath();ctx.moveTo(-9,-12);ctx.lineTo(-8,-9);ctx.lineTo(-5,-8);ctx.lineTo(-8,-7);ctx.lineTo(-9,-4);ctx.lineTo(-10,-7);ctx.lineTo(-13,-8);ctx.lineTo(-10,-9);ctx.closePath();ctx.fill();ctx.restore()}}
function drawOverlays(){if(bustMeter>0&&mode==='play'){const lim=player.car?2.3:1.6,f=clamp(bustMeter/lim,0,1);ctx.save();ctx.translate(player.x,player.y);ctx.strokeStyle='#1a0c0a99';ctx.lineWidth=6;ctx.beginPath();ctx.arc(0,0,40,0,TAU);ctx.stroke();ctx.strokeStyle=f>.6?'#ff6b4f':'#e3a06b';ctx.beginPath();ctx.arc(0,0,40,-Math.PI/2,-Math.PI/2+f*TAU);ctx.stroke();ctx.fillStyle='#ffd2c0';ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.fillText('GETTING PINCHED · MOVE!',0,-50);ctx.restore()}
 ctx.textAlign='center';for(const p of popups){const a=clamp(p.life/p.max*1.6,0,1);ctx.globalAlpha=a;ctx.font='bold 13px Arial';ctx.lineWidth=4;ctx.strokeStyle='#0b1416';ctx.strokeText(p.text,p.x,p.y);ctx.fillStyle=p.color;ctx.fillText(p.text,p.x,p.y)}ctx.globalAlpha=1}
function drawCompass(){const gt=goal(),x=(gt.x-camera.x)*zoom+w/2,y=(gt.y-camera.y)*zoom+h/2;const mx=70,my=110;if(x>mx&&x<w-mx&&y>my&&y<h-150)return;const dx=x-w/2,dy=y-h/2,a=Math.atan2(dy,dx),tx=clamp(x,45,w-45),ty=clamp(y,120,h-150);ctx.save();ctx.translate(tx,ty);ctx.fillStyle='#152527ed';ctx.strokeStyle='#d7b26c99';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,22,0,TAU);ctx.fill();ctx.stroke();ctx.rotate(a);ctx.fillStyle='#dfba70';ctx.beginPath();ctx.moveTo(11,0);ctx.lineTo(-5,-5);ctx.lineTo(-2,0);ctx.lineTo(-5,5);ctx.closePath();ctx.fill();ctx.restore();ctx.fillStyle='#e3c48a';ctx.textAlign='center';ctx.font='9px Arial';ctx.fillText(Math.round(dist(player,gt))+' YD',tx,ty+37)}
// Stop continuous driving and weather sounds immediately when the game is hidden.
function silenceOutdoorAudio(){if(!audioCtx)return;const at=audioCtx.currentTime;for(const node of [engineGain,sirenGain,rainGain,screechGain,rumbleGain])if(node){node.gain.cancelScheduledValues(at);node.gain.setValueAtTime(0,at)}}
let accumulator=0,hitStop=0;function loop(t){if(document.hidden||mode==='title'){silenceOutdoorAudio();last=t;accumulator=0;requestAnimationFrame(loop);return}const dt=Math.min((t-last)/1000||.016,.1);perfWatch(dt);last=t;if(hitStop>0){hitStop-=dt;draw();requestAnimationFrame(loop);return}accumulator+=dt;while(accumulator>=1/60){update(1/60);accumulator-=1/60}draw();requestAnimationFrame(loop)}
$('startBtn').addEventListener('click',startGame);$('howBtn').addEventListener('click',()=>{modal='help';mode='pause';$('titleScreen').classList.add('hidden');$('panel').classList.remove('hidden');renderPanel()});$('pauseBtn').addEventListener('click',()=>showPanel('pause'));$('soundTitle').addEventListener('click',enableAudio);
addEventListener('keydown',e=>{if(mode==='play'&&['Tab','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter'].includes(e.code))e.preventDefault();if(e.repeat)return;if(mode==='feedback'&&(e.code==='Enter'||e.code==='Space')&&!/TEXTAREA|INPUT|BUTTON|SUMMARY/.test(e.target.tagName||'')){e.preventDefault();continueLife();return}if(e.code==='Escape'&&mode==='dialogue'){endConversation();return}if(e.code==='Escape'||e.code==='KeyP'){if(mode==='play')showPanel('pause');else if(mode==='pause')closePanel();return}if(mode==='dialogue'){if(e.code==='Escape'){endConversation();return}if(/^Digit[1-9]$/.test(e.code))chooseDialogue(Number(e.code.slice(-1))-1);return;}if(mode!=='play')return;keys[e.code]=true;switch(e.code){case'KeyE':interact();break;case'KeyF':talkNearby();break;case'KeyR':if(!player.air)reload();break;case'Enter':showPanel('jobs');break;case'Tab':showPanel('empire');break;case'KeyM':showPanel('map');break;case'KeyG':if(player.air){const res=airOps.startCourier(player);toast(res.message);}break;case'Digit1':equipWeapon(0);break;case'Digit2':equipWeapon(1);break;case'Digit3':equipWeapon(2);break;case'KeyH':horn();break;case'KeyQ':{const own=save.ownedWeapons.slice().sort();const next=own[(own.indexOf(save.weapon)+1)%own.length];if(next!==save.weapon){equipWeapon(next);toast(weapons[next].name+' ready.')}}break}});
addEventListener('keyup',e=>{keys[e.code]=false});
canvas.addEventListener('pointermove',e=>{mouse.x=e.clientX;mouse.y=e.clientY;mouse.active=true;$('crosshair').style.left=mouse.x+'px';$('crosshair').style.top=mouse.y+'px'});
canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button===0){mouse.down=true;mouse.active=true;mouse.x=e.clientX;mouse.y=e.clientY}});addEventListener('pointerup',()=>mouse.down=false);canvas.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;mouse.down=false;touch.fire=false;touch.x=touch.y=0;touch.airUp=touch.airDown=false;silenceOutdoorAudio();if(mode==='play')showPanel('pause')});
if(typeof document.addEventListener==='function')document.addEventListener('visibilitychange',()=>{if(document.hidden)silenceOutdoorAudio()});
addEventListener('pagehide',persist);
let stickPointer=null;const stick=$('stick');function stickMove(e){const r=stick.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/38,dy=(e.clientY-r.top-r.height/2)/38,mag=Math.max(1,Math.hypot(dx,dy));touch.x=dx/mag;touch.y=dy/mag;stick.querySelector('i').style.transform=`translate(${touch.x*30}px,${touch.y*30}px)`}
stick.addEventListener('pointerdown',e=>{stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);stickMove(e)});stick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)stickMove(e)});function stickEnd(){stickPointer=null;touch.x=touch.y=0;stick.querySelector('i').style.transform=''}stick.addEventListener('pointerup',stickEnd);stick.addEventListener('pointercancel',stickEnd);
for(const b of $('mobile').querySelectorAll('button')){const a=b.dataset.action;b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);if(a==='talk')talkNearby();else if(a==='air-job'){if(player.air){const res=airOps.startCourier(player);toast(res.message);}}else if(a==='air-up')touch.airUp=true;else if(a==='air-down')touch.airDown=true;else if(a==='fire')touch.fire=true;else if(a==='brake')touch.brake=true;else if(a==='interact')interact();else if(a==='jobs')showPanel('jobs');else if(a==='empire')showPanel('empire');else if(a==='reload')reload()});for(const event of ['pointerup','pointercancel'])b.addEventListener(event,()=>{if(a==='fire')touch.fire=false;if(a==='brake')touch.brake=false;if(a==='air-up')touch.airUp=false;if(a==='air-down')touch.airDown=false})}
function openSpot(p,offset=65){const n=WLD.nearest(p);for(const off of [offset,-offset,offset+30,-offset-30]){const q={x:n.x-Math.sin(n.angle)*off,y:n.y+Math.cos(n.angle)*off};if(!blocked(q.x,q.y,12))return q}return{x:n.x,y:n.y}}
function setupNPCs(){npcs=[['sal','Sal Bell','MECHANIC',0,places[0],'#9d9877'],['nora','Nora Vale','JAZZ SINGER',1,places[2],'#9c6a5c'],['ruth','Ruth Mercer','BOOTLEGGER',2,places[3],'#9b7255'],['eddie','Eddie Pike','NEWSPAPER HAWKER',3,places[7],'#8a9c82']].map(([id,name,role,portrait,p,color])=>({id,name,role,portrait,...openSpot({x:p.x+(id==='sal'?-40:34),y:p.y}),a:Math.PI/2,color,featured:true}));save.story=save.story||{};save.feedback=save.feedback||[];}
function nearestNPC(radius=105){if(interior)return interior.people.filter(n=>dist(n,player)<radius).sort((a,b)=>dist(a,player)-dist(b,player))[0]||null;if(player.car&&Math.abs(player.car.v)>32)return null;return npcs.filter(n=>!n.consumed&&dist(n,player)<radius).sort((a,b)=>dist(a,player)-dist(b,player))[0]||null}
const say=(text,choices)=>({text,choices}),option=(label,action)=>({label,action});
function gift(amount){save.cash+=amount;save.stats.earnings+=amount;sound('cash');persist()}
function mark(key,val=true){save.story[key]=val;persist()}
function setLead(id,target,title,pay,twist=''){if(lead)return false;lead={id,target,title,pay,time:240,twist};toast('NEW LEAD · '+title+' · Follow the violet marker.');return true}
function offerLead(id,target,title,pay,twist=''){return()=>{if(lead)return say('You already have an errand on your hands. Finish that one first.',[option('I will be back.',endConversation)]);if(save.story[id])return say('You already took care of that. People here remember a favor.',[option('Good to know.',endConversation)]);setLead(id,target,title,pay,twist);mark(id);endConversation()}}
function storyFor(n){if(n.shopId)return shopStory(n);const st=save.story;
 if(n.id==='sal'){
  if(st.salDelivered)return say('That ledger you carried? The numbers were badge numbers. Someone is selling the town a protection racket and charging both sides. I made a copy. I am getting too old to be the only person who knows a thing.',[option('Who else has seen it?',()=>say('Nora. She remembers faces. You should ask her about the man at table six.',[option('I will talk to Nora.',()=>{mark('tableSix');endConversation()})])),option('Can you check the car?',()=>repairConversation(n)),option('Keep the copy safe.',endConversation)]);
  return say(st.salVisits>1?'I keep finding the same man outside the shop. Clean shoes. Muddy car. He asks whether you came back. I told him I charge extra for questions.':'Somebody left a car outside my shop with a full tank and a bullet hole in the passenger door. Then they left a note with your description. That is not regular garage business.',[
   option('Whose car was it?',()=>say('The name on the title belongs to a dead man. Here is the interesting part: the title was signed yesterday.',[
    option('Let me see the paperwork.',()=>say('Two sets of handwriting. One address: the freight depot. Take this envelope there, and I will pay $7.00. Keep it out of the rain. And if a man asks for the blue copy, you have the wrong man.',[option('I will take the envelope. [+ $7.00 on delivery]',offerLead('salEnvelope',places[5],'The dead man’s title',7,'ledger')),option('Who is the wrong man?',()=>say('That is what bothers me. There should only be one man expecting it. Take it if you want answers. I will not ask twice.',[option('Take the envelope.',offerLead('salEnvelope',places[5],'The dead man’s title',7,'ledger')),option('Not tonight.',endConversation)])),option('I am not carrying that.',endConversation)])),option('Sounds like a problem for someone else.',endConversation)])),
   option('I need the car running properly.',()=>repairConversation(n)),
   option('What is the trick to driving these things?',()=>say('Ease off before the corner. Brake first, turn second, and get back on the gas when the nose is pointing where you want it. The handbrake will rotate the rear, but it will not negotiate with a brick wall.',[option('I will try it your way.',endConversation)]))]);
 }
 if(n.id==='nora'){
  const line=st.tableSix?'Sal sent you? The man at table six is not a federal agent. His badge is real. His name is not.':'A man has bought the same empty table three nights in a row. Tonight he paid for two drinks. The other glass is for you. Do not look over yet.';
  return say(line,[option('What does he want?',()=>say('He wants my piano player to identify a man in a photograph. The photograph is of the piano player. Either he is very bad at his job, or he wants us frightened.',[option('Get your piano player out of here.',()=>say('There is a delivery car going south. Carry his suitcase to the Blue Lantern and I will pay $9.00. If a patrol stops you, the case holds shoes. That is even true.',[option('I can do that.',offerLead('noraCase',places[4],'Two left shoes',9,'nora')),option('Why tell me any of this?',()=>say(st.ruthTrap?'Because Ruth’s trap was not meant for you. Someone changed the name on the crate. You may want to remember that.':'Because he watched the door until you arrived. Then he stopped. Whatever this is, you are already in it.',[option('Take the suitcase.',offerLead('noraCase',places[4],'Two left shoes',9,'nora')),option('I need time to think.',endConversation)]))])),option('I will ask him myself.',()=>{mark('noraConfronted');addHeat(16);return say('You cross the room. He leaves a badge on the table and walks out through the kitchen. It is a stage prop. Outside, a real patrol car starts its engine.',[option('That was deliberate.',endConversation)])})])),option('Buy the table a round. [$2.00]',()=>{if(!spend(2))return say('Nora puts your money back. “You need that more than he does.”',[option('Fair enough.',endConversation)]);mark('noraTrust');heat=Math.max(0,heat-25);return say('Nora sends over water in two whiskey glasses. The man laughs, leaves, and takes the patrol outside with him. “Sometimes,” she says, “they just want to know who will blink.”',[option('I owe you one.',endConversation)])}),option('Leave before the second glass is filled.',endConversation)]);
 }
 if(n.id==='ruth'){
  if(st.ruthTrap&&!st.ruthCompensated){gift(3);mark('ruthCompensated')}
  if(st.ruthCrate)return say(st.ruthTrap?'You found the patrol, then. I checked the warehouse. Somebody switched the destination after I signed the manifest. I am paying you $3.00 for the trouble. That is an apology. I do not have many of those.':'The crate arrived. The buyer wanted to know whether you looked inside. I said you charged too much to be curious. He seemed reassured.',[option('What happens to the people who do look?',()=>say('Depends on what they find. And who finds out they found it.',[option('I will keep that in mind.',endConversation)])),option('I am looking for paid work.',()=>{endConversation();showPanel('jobs')})]);
  return say('A crate. A short drive. $10.50. Before you answer: that gold car has passed us three times. The driver changed his hat on the second lap. I would respect the effort if the car were less conspicuous.',[
   option('What is inside the crate?',()=>say('Empty bottles. The bottles are not the cargo. The labels are. Someone is forging a federal evidence seal. I would rather not be the last person holding them.',[option('I will carry it. [$10.50, possible trouble]',offerLead('ruthCrate',places[5],'The wrong crate',10.50,'crate')),option('Take it to the authorities.',()=>say('Which ones? That is the part of the question I cannot answer.',[option('Then I will pass.',endConversation)]))])),
   option('I will take the job without asking.',offerLead('ruthCrate',places[5],'The wrong crate',10.50,'crate')),
   option('Tell me about that car instead.',()=>{mark('goldCar');return say('The front plate is from Michigan. The rear plate is from Ohio. Nobody makes that mistake by accident. If you see it at the depot, leave yourself an exit.',[option('That sounds like a useful detail.',endConversation)])}),option('Too much attention. I am out.',endConversation)]);
 }
 if(n.id==='eddie')return say(st.eddieTip?'You were right about yesterday’s paper. The editor says I cannot sell tomorrow’s news until he knows who paid for it. He still took a copy home.':'Want tomorrow’s paper? I know how that sounds. But there is a photograph on the front page of a warehouse fire, and the warehouse is still standing.',[
 option('How did you get it?',()=>say('A man paid me to deliver a bundle to the depot. The press date was wrong. The fire date was tonight. He told me a clever boy does not read what he carries. That was a poor choice of words.',[option('Give me a copy. [$1.00]',()=>{if(!spend(1))return say('“Keep your dollar,” Eddie says. “You look like you have already had a long evening.”',[option('Thanks.',endConversation)]);mark('eddieTip');return say('On the back of the photograph is a route around Dort Highway. The patrols are stopping cars on the main road. Eddie circles the side streets. “The fire story is fake. The roadblocks are not.” Your police heat drops.',[option('Use the route. [-30 heat]',()=>{heat=Math.max(0,heat-30);endConversation()})])}),option('Can you get this to Nora?',()=>{mark('tableSix');gift(1.25);return say('Eddie is gone before you finish the sentence. A minute later he is back with a dollar bill and a quarter. “She says she owes you a drink. She also says do not order it tonight.”',[option('That is unsettling.',endConversation)])})])),option('Any ordinary work going?',()=>{endConversation();showPanel('jobs')}),option('I would rather read yesterday’s news.',endConversation)]);
 return ambientStory(n);
}
function repairConversation(n){if(!save.story.salRepair){mark('salRepair');player.hp=Math.min(100,player.hp+20);if(player.car&&!player.car.burning)player.car.hp=player.car.maxHp;return say('Sal lifts the hood, adjusts one cable, and closes it. “The first one is free. The second one costs money. The third one means you should let somebody else drive.”',[option('Thanks, Sal.',endConversation)])}return say('“I can fix it. But I am running a garage, not a charity.” Full repairs, medical supplies and ammunition are $4.50 in the shop.',[option('Open the garage.',()=>{endConversation();showPanel('empire');tabName='garage';renderPanel()}),option('Maybe later.',endConversation)])}
function ambientStory(n){if(n.kind==='motorist')return say('“My car stopped. That gentleman over there offered to buy it before I even pulled over. Is that normal around here?”',[
 option('Help with the engine.',()=>{n.consumed=true;const outcome=Math.random();if(outcome<.7){gift(45);return say('One loose cable. The driver presses $45 into your hand. Across the road, the interested buyer suddenly remembers an appointment.',[option('Keep driving.',endConversation)])}addHeat(12);return say('Under the hood, the engine is fine. A whistle sounds from the other side of the road. The driver says, “I am sorry. They said they would take my car.”',[option('Leave before the trap closes.',endConversation)])}),option('Ask who the buyer is.',()=>say('“Said his name was Smith. Then called himself Jones when he answered his telephone.”',[option('I would find another mechanic.',endConversation)])),option('Keep walking.',endConversation)]);
 if(n.kind==='courier')return say('“Which way is the freight depot? And if you happen to know, is there more than one person there named Mr. Blue?”',[option('Two Mr. Blues? Let me see the address.',()=>{n.consumed=true;gift(1.50);mark('blueWarning');return say('The envelope is addressed to Bell & Sons, not the depot. The courier turns it over. “Oh. That explains the last three hours.” You get $1.50 for saving the delivery.',[option('Some nights are like that.',endConversation)])}),option('I cannot help you.',endConversation)]);
 return say(pick(['“The patrol on Dort is stopping empty trucks and waving loaded ones through. I am not saying there is a system. I am saying it is a very specific coincidence.”','“Somebody bought six hundred empty bottles at the depot. I sell milk. I would know if this town started drinking that much milk.”','“The lights at the Blue Lantern went out twice. Once for the police. Once for the band. The band was worse.”']),[option('Any paid work around?',()=>{endConversation();showPanel('jobs')}),option('Thanks for the warning.',endConversation)]);
}
function talkNearby(){if(mode!=='play')return;const n=nearestNPC();if(!n){toast('Get closer to someone with a speech bubble. F starts a conversation.');return}if(player.car){player.car.v=player.car.vx=player.car.vy=0;player.car.throttle=0}for(const k in keys)keys[k]=false;mouse.down=false;touch.fire=false;touch.x=touch.y=0;mode='dialogue';$('pursuitFx').classList.remove('active');conversation={npc:n,node:null};if(n.featured){mark(n.id+'Visits',(save.story[n.id+'Visits']||0)+1)}setDialogue(storyFor(n));$('crosshair').classList.add('hidden')}
function setDialogue(node){if(!conversation||!node)return;conversation.node=node;const n=conversation.npc;$('dialogue').classList.remove('hidden');$('dialogue').classList.toggle('no-portrait',!n.featured);$('portrait').style.backgroundPosition=['0% 0%','100% 0%','0% 100%','100% 100%'][n.portrait||0];$('speakerName').textContent=n.name;$('speakerRole').textContent=n.role;$('dialogueText').textContent=node.text;$('dialogueChoices').innerHTML=node.choices.map((c,i)=>`<button data-choice="${i}"><kbd>${i+1}</kbd>${c.label}</button>`).join('')}
function chooseDialogue(i){const choice=conversation?.node?.choices[i];if(!choice)return;const next=choice.action();if(next&&conversation)setDialogue(next)}
function endConversation(){conversation=null;$('dialogue').classList.add('hidden');mode='play';if(!isTouch&&!interior)$('crosshair').classList.remove('hidden');persist()}
function spawnEncounter(){if(npcs.filter(n=>!n.featured&&!n.consumed).length>=3)return;const points=WLD.nodes.filter(n=>dist(n,player)>260&&dist(n,player)<600);if(!points.length)return;const at=openSpot(pick(points),64),kind=pick(['motorist','courier','neighbor']);npcs.push({id:'event-'+Math.floor(elapsed*1000),name:kind==='motorist'?'A stranded motorist':kind==='courier'?'A confused courier':'A local',role:'STREET ENCOUNTER',kind,...at,a:rand(0,TAU),color:'#a29572',expires:elapsed+110,featured:false,bark:kind==='motorist'?'A little help here?':kind==='courier'?'Excuse me. The depot?':'You hear what happened?'});toast('Someone nearby is trying to get your attention. Look for the speech bubble.')}
function tickWorldLife(dt){encounterTimer-=dt;if(encounterTimer<=0){spawnEncounter();encounterTimer=rand(40,70)}npcs=npcs.filter(n=>n.featured||(!n.consumed&&n.expires>elapsed));
 if(lead){lead.time-=dt;if(lead.time<0){toast('The lead went cold. Other people still have stories.');lead=null}else if(dist(player,lead.target)<63&&(!player.car||Math.abs(player.car.v)<30)){const done=lead;lead=null;gift(done.pay);save.xp+=55;if(done.twist==='ledger'){mark('salDelivered');toast('ENVELOPE DELIVERED · '+money(done.pay)+' · The recipient knew your name. Sal may know why.')}else if(done.twist==='crate'&&Math.random()<.45){mark('ruthTrap');addHeat(38);toast('A patrol was waiting at the depot. Ruth owes you an explanation.')}else if(done.twist==='nora'){mark('noraSaved');toast('SUITCASE DELIVERED · '+money(done.pay)+' · Two shoes. Two different sizes.')}else toast('LEAD COMPLETE · '+money(done.pay));persist()}}
 fxTick(dt);for(const s of smoke){s.life-=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;s.r+=dt*6}smoke=smoke.filter(s=>s.life>0);if(smoke.length>200)smoke.splice(0,smoke.length-200);
 for(const d of debris){d.life-=dt;d.vz-=210*dt;d.z+=d.vz*dt;if(d.z<0){d.z=0;d.vz=Math.abs(d.vz)*.25;d.vx*=.6;d.vy*=.6}d.x+=d.vx*dt;d.y+=d.vy*dt;d.a+=d.spin*dt}debris=debris.filter(d=>d.life>0);for(const r of blastRings)r.life-=dt;blastRings=blastRings.filter(r=>r.life>0);
 const near=nearestNPC();$('talkBtn').classList.toggle('hidden',!near);$('talkBtn').textContent=near?'F · Talk to '+near.name:'';$('rumor').textContent=lead?'◆ '+lead.title+' · '+Math.round(dist(player,lead.target))+' yd':'';$('rumor').classList.toggle('hidden',!lead);
 const chasing=heat>=20&&cars.some(c=>c.ai==='police'&&!c.dead&&!c.burning&&dist(c,player)<1400);$('pursuitFx').classList.toggle('active',chasing&&mode==='play');
}
function project3(x,y,z){return{x:x+(x-camera.x)*z/1300,y:y+(y-camera.y)*z/1300-z*.48}}
function polygon(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill()}
function tint(hex,f){const n=parseInt(hex.slice(1),16);return '#'+[n>>16,(n>>8)&255,n&255].map(v=>Math.min(255,Math.round(v*f)).toString(16).padStart(2,'0')).join('')}
function drawBuilding3D(b){
 if(b.placeId==='home'&&!save.home.built.includes('roof')){
  ctx.fillStyle=save.home.built.includes('foundation')?'#a29476':'#78805b';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.strokeStyle='#d5c08a';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.strokeRect(b.x,b.y,b.w,b.h);ctx.setLineDash([]);
  if(save.home.built.includes('frame'))for(const [x,y] of [[b.x,b.y],[b.x+b.w,b.y],[b.x,b.y+b.h],[b.x+b.w,b.y+b.h]]){const top=project3(x,y,28);ctx.strokeStyle='#c8ac7d';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(top.x,top.y);ctx.stroke()}
  const p=project3(b.x+b.w/2,b.y+b.h/2,5);ctx.fillStyle='#efe2bf';ctx.font='7px Arial';ctx.textAlign='center';ctx.fillText(save.home.built.includes('frame')?'HOME FRAME':save.home.built.includes('foundation')?'FOUNDATION':'HOME LOT',p.x,p.y);return;
 }
 const floor=[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}],roof=floor.map(p=>project3(p.x,p.y,b.z)),wall=b.wall||'#9c8969';
 const facing=[0,1,2,3].sort((i,j)=>Math.hypot((floor[j].x+floor[(j+1)%4].x)/2-camera.x,(floor[j].y+floor[(j+1)%4].y)/2-camera.y)-Math.hypot((floor[i].x+floor[(i+1)%4].x)/2-camera.x,(floor[i].y+floor[(i+1)%4].y)/2-camera.y));
 for(const i of facing){const j=(i+1)%4;polygon([floor[i],floor[j],roof[j],roof[i]],tint(wall,[1,.8,.72,.9][i]));
  // Siding and brick courses follow projected wall planes.
  ctx.strokeStyle=b.gable?'#ece0b333':'#402f242d';ctx.lineWidth=.7;
  for(let z=7;z<b.z-5;z+=b.gable?8:6){const a=project3(floor[i].x,floor[i].y,z),c=project3(floor[j].x,floor[j].y,z);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(c.x,c.y);ctx.stroke()}
  const length=dist(floor[i],floor[j]),count=Math.max(1,Math.floor(length/19));
  for(let k=0;k<count;k++){const t=(k+.5)/count,half=Math.min(.14,4.5/length),pt=(u,z)=>project3(lerp(floor[i].x,floor[j].x,u),lerp(floor[i].y,floor[j].y,u),z),lo=b.z*.28,hi=b.z*.74;
   const pane=[pt(t-half,lo),pt(t+half,lo),pt(t+half,hi),pt(t-half,hi)],lit=(Math.round(b.x+b.y)+k+i)%4!==0;
   polygon(pane,lit?'#e5b572':'#24383f');ctx.strokeStyle='#332e27';ctx.lineWidth=1.3;ctx.beginPath();pane.forEach((p,n)=>n?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();
   const m=pt(t,lo),n=pt(t,hi);ctx.strokeStyle=lit?'#6c5339':'#91a99b';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(m.x,m.y);ctx.lineTo(n.x,n.y);const l=pt(t-half,(lo+hi)/2),r=pt(t+half,(lo+hi)/2);ctx.moveTo(l.x,l.y);ctx.lineTo(r.x,r.y);ctx.stroke();
   const a=pt(t-half-.025,lo-1),c=pt(t+half+.025,lo-1);ctx.strokeStyle='#cfb38b';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(c.x,c.y);ctx.stroke();
  }
 }
 polygon(roof,b.color);texturePlane(roofMaterial(b),roof);ctx.strokeStyle=tint(b.color,1.3);ctx.lineWidth=1.2;ctx.beginPath();roof.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();
 if(b.gable){
  const ridgeZ=b.z+Math.min(15,b.w*.32),a=project3(b.x+b.w/2,b.y,ridgeZ),c=project3(b.x+b.w/2,b.y+b.h,ridgeZ);
  texturePlane(roofMaterial(b),[roof[0],a,c,roof[3]]);texturePlane(roofMaterial(b),[a,roof[1],roof[2],c]);polygon([roof[0],a,c,roof[3]],'#e5bd7226');polygon([a,roof[1],roof[2],c],'#07162444');
  ctx.strokeStyle='#c8b99566';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(c.x,c.y);ctx.stroke();
  for(let t=.2;t<1;t+=.2){const l={x:lerp(roof[0].x,a.x,t),y:lerp(roof[0].y,a.y,t)},r={x:lerp(roof[3].x,c.x,t),y:lerp(roof[3].y,c.y,t)};ctx.strokeStyle='#c5b99525';ctx.beginPath();ctx.moveTo(l.x,l.y);ctx.lineTo(r.x,r.y);ctx.stroke()}
 }else{
  // Tar roofs, parapets and a small skylight replace modern rooftop machinery.
  ctx.strokeStyle='#d1bb8b77';ctx.lineWidth=3;ctx.beginPath();roof.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();
  const p=project3(b.x+b.w*.33,b.y+b.h*.35,b.z+2);ctx.fillStyle='#18292e';ctx.fillRect(p.x-8,p.y-3,16,11);ctx.fillStyle='#6b9490';ctx.fillRect(p.x-6,p.y-4,12,8);ctx.fillStyle='#c1dfca66';ctx.fillRect(p.x-5,p.y-3,4,5);ctx.strokeStyle='#b8b699';ctx.lineWidth=1;ctx.strokeRect(p.x-6,p.y-4,12,8);ctx.beginPath();ctx.moveTo(p.x,p.y-4);ctx.lineTo(p.x,p.y+4);ctx.stroke();
 }
 const chimney=project3(b.x+b.w*.77,b.y+b.h*.3,b.z+6);ctx.fillStyle='#5e4735';ctx.fillRect(chimney.x-3,chimney.y-5,6,8);ctx.fillStyle='#b3956b';ctx.fillRect(chimney.x-4,chimney.y-6,8,3);
 if(b.style==='chapel'){const p=project3(b.x+b.w/2,b.y+b.h*.35,b.z+20);ctx.strokeStyle='#d6c59b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y-14);ctx.lineTo(p.x,p.y+2);ctx.moveTo(p.x-5,p.y-9);ctx.lineTo(p.x+5,p.y-9);ctx.stroke()}
 if(b.placeId){
  const place=places.find(p=>p.id===b.placeId),door=place?.door;
  if(door){const p=project3(door.x,door.y,b.z*.25);ctx.fillStyle='#30453e';ctx.fillRect(p.x-4,p.y-5,8,11);ctx.fillStyle='#dec18a';ctx.fillRect(p.x+2,p.y,1.5,1.5);ctx.fillStyle='#bca57b';ctx.fillRect(door.x-7,door.y-3,14,6);
   if(b.style==='store'){const a=project3(door.x,door.y,b.z*.63);ctx.save();ctx.translate(a.x,a.y);const wide=Math.min(42,b.w*.7);ctx.fillStyle=b.placeId==='pharmacy'?'#758a70':'#a2704c';ctx.fillRect(-wide/2,-3,wide,8);ctx.fillStyle='#d4c29a';for(let x=-wide/2+3;x<wide/2;x+=8)ctx.fillRect(x,-3,3,8);ctx.restore()}
  }
 }
 if(b.landmark){const p=project3(b.x+b.w/2,b.y+b.h*.65,b.z+2),bw=Math.max(38,Math.min(b.w*1.2,132));ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='#293c32';ctx.fillRect(-bw/2,-6,bw,12);ctx.strokeStyle='#d1b882';ctx.lineWidth=.7;ctx.strokeRect(-bw/2,-6,bw,12);ctx.font='bold '+Math.min(8,bw/(b.landmark.length*.57))+'px Georgia';ctx.textAlign='center';ctx.fillStyle='#f1dcaa';ctx.fillText(b.landmark,0,2.5);ctx.restore()}
}
function drawWorldLife(){
 if(lead)drawMarker({...lead.target,color:'#b397d4',icon:'◆',name:lead.title},false);
 for(const n of npcs){if(!visible(n,80)||n.consumed)continue;drawPerson(n);const d=dist(n,player);if(d<330){ctx.fillStyle='#101f21e8';ctx.strokeStyle=n.featured?'#e4c589':'#b4c6ab';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(n.x-12,n.y-40,24,18,4);ctx.fill();ctx.stroke();ctx.fillStyle=n.featured?'#e4c589':'#b4c6ab';ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.fillText('···',n.x,n.y-29);if(d<105){ctx.font='9px Arial';ctx.fillText('F · '+n.name,n.x,n.y-51)}else if(n.bark&&n.expires-elapsed>95){ctx.font='9px Georgia';ctx.fillText(n.bark,n.x,n.y-49)}}}
 for(const c of cars){if(!visible(c,60)||c.z>14)continue;drawRoof(c)}
 for(const r of blastRings){const age=1-r.life/.65;ctx.strokeStyle=`rgba(255,226,170,${(1-age)*.45})`;ctx.lineWidth=2+8*(1-age);ctx.beginPath();ctx.arc(r.x,r.y,age*135+15,0,TAU);ctx.stroke();if(age<.35){ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=1-age/.35;ctx.drawImage(FX.glow,r.x-130,r.y-130,260,260);ctx.restore()}}
 for(const d of debris){if(!visible(d,150))continue;ctx.fillStyle='#08131570';ctx.beginPath();ctx.ellipse(d.x+3,d.y+4,d.size*.7,d.size*.35,0,0,TAU);ctx.fill();const p=project3(d.x,d.y,d.z);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(d.a);ctx.fillStyle=d.color;ctx.fillRect(-d.size/2,-d.size/2,d.size,d.size*.6);ctx.restore()}
 for(const s of smoke){if(!visible(s,180))continue;const p=project3(s.x,s.y,s.z),k=clamp(s.life/s.max,0,1),r=s.r*1.7;ctx.globalAlpha=k*(s.dark?.95:.7);ctx.drawImage(s.dark?FX.smokeDark:FX.smokeLight,p.x-r,p.y-r,r*2,r*2)}ctx.globalAlpha=1;
 drawFlames();
}
function drawPursuitEdges(){if(mode!=='play')$('pursuitFx').classList.remove('active')}
function endLife(reason,kind='dead'){if(deathReport)return;if(trial||frenzy)endActivity();hidePaper();respray=0;bustMeter=0;toastTimer=0;$('toast').classList.remove('show');player.hp=0;save.stats.lives=(save.stats.lives||0)+1;deathReport={id:Date.now().toString(36)+'-'+Math.floor(Math.random()*1e6),build:'0.5-noir',reason,duration:Math.round(activeElapsed-lifeStart),jobs:save.jobs-lifeJobs,earned:Math.max(0,save.stats.earnings-lifeMoney),district:district(player.x,player.y),rating:0,handling:0,kind};for(const k in keys)keys[k]=false;mouse.down=false;touch.fire=false;touch.x=touch.y=0;mode='feedback';$('pursuitFx').classList.remove('active');$('overlay').classList.remove('hidden');$('titleScreen').classList.add('hidden');$('panel').classList.remove('hidden');$('crosshair').classList.add('hidden');renderDeath();persist()}
function renderDeath(){const r=deathReport,pinched=r.kind==='busted',fee=Math.min(save.cash,Math.max(pinched?5:3.5,SHOP.round(save.cash*(pinched?.15:.12))));$('panel').innerHTML=`<div class="stamp ${pinched?'blue':''}">${pinched?'PINCHED':'LIGHTS OUT'}</div><p class="death-line">${pinched?'The police boxed you in':r.reason} in ${r.district.toLowerCase()}. ${pinched?'A friendly judge will make it go away for':'The doctor will patch you up for'} <b>${money(fee)}</b>. Your empire and upgrades are safe.</p><div class="statsgrid"><div><strong>${Math.floor(r.duration/60)}:${String(r.duration%60).padStart(2,'0')}</strong><small>TIME ON THE STREET</small></div><div><strong>${r.jobs}</strong><small>JOBS COMPLETE</small></div><div><strong>${money(r.earned)}</strong><small>EARNED THIS LIFE</small></div></div><div class="titleactions"><button class="primary" id="continueBtn">BACK ON THE STREET <b>↵</b></button></div><details class="feedback-wrap"><summary>Tell the game's maker what you think (optional)</summary><form id="lifeFeedback" data-desk-skip><fieldset><legend>How was this life?</legend><div class="rating-row">${[1,2,3,4,5].map(i=>`<label><input data-desk-skip type="radio" name="rating" value="${i}"><span>${i}</span></label>`).join('')}<small>1 · frustrating &nbsp; 5 · one more run</small></div></fieldset><fieldset><legend>How did driving feel?</legend><div class="rating-row">${[1,2,3,4,5].map(i=>`<label><input data-desk-skip type="radio" name="handling" value="${i}"><span>${i}</span></label>`).join('')}<small>1 · awkward &nbsp; 5 · smooth</small></div></fieldset><label class="feedback-label" for="feedbackNote">What felt good, broke, or should happen next?</label><textarea data-desk-skip id="feedbackNote" name="note" rows="3" maxlength="1000" placeholder="Optional. Please leave out names and personal information."></textarea><p class="feedback-privacy">Only your ratings, note and the run summary above are sent to the game's creator. No name or account is requested.</p><div class="feedback-actions"><button class="secondary" type="submit">SEND FEEDBACK & CONTINUE ↗</button><button type="button" class="secondary" id="skipFeedback">SKIP & CONTINUE</button></div><p id="feedbackStatus" role="status"></p></form></details>`;$('lifeFeedback').addEventListener('submit',submitLifeFeedback);$('skipFeedback').addEventListener('click',continueLife);$('continueBtn').addEventListener('click',continueLife);setTimeout(()=>{try{$('continueBtn').focus()}catch(e){}},50)}
async function submitLifeFeedback(e){e.preventDefault();if(!deathReport)return;const f=$('lifeFeedback'),data=new FormData(f),report={...deathReport,rating:Number(data.get('rating'))||0,handling:Number(data.get('handling'))||0,note:String(data.get('note')||'').slice(0,1000),date:new Date().toISOString(),sent:false};save.feedback=save.feedback||[];const existing=save.feedback.findIndex(v=>v.id===report.id);if(existing>=0)save.feedback[existing]=report;else save.feedback.push(report);save.feedback=save.feedback.slice(-60);persist();const status=$('feedbackStatus'),btn=f.querySelector('button[type="submit"]');btn.disabled=true;status.textContent='Sending your feedback…';
 try{const body=new URLSearchParams({'form-name':'dry-county-feedback','bot-field':'',run:report.id,build:report.build,rating:String(report.rating),handling:String(report.handling),note:report.note,summary:JSON.stringify({reason:report.reason,duration:report.duration,jobs:report.jobs,earned:report.earned,district:report.district}),date:report.date});const res=await fetch(new URL('feedback.html',location.href),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString(),signal:AbortSignal.timeout(8000)});if(!res.ok)throw new Error('Feedback endpoint not available');report.sent=true;const local=save.feedback.find(v=>v.id===report.id);if(local)local.sent=true;persist();status.textContent='Thank you. Feedback sent.';if(deathReport?.id===report.id){continueLife();toast('Thanks. Your feedback was sent.');}}
 catch{if(deathReport?.id!==report.id)return;status.textContent='Feedback is saved on this browser, but the server did not confirm receipt. You can retry, download a copy, or keep playing.';btn.disabled=false;btn.textContent='RETRY SENDING';let b=$('downloadFeedback');if(!b){b=document.createElement('button');b.id='downloadFeedback';b.type='button';b.className='secondary';b.textContent='DOWNLOAD FEEDBACK';f.querySelector('.feedback-actions').appendChild(b)}b.onclick=()=>downloadFeedback(save.feedback.find(v=>v.id===report.id)||report);}
}
function downloadFeedback(report){const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='dry-county-feedback-'+report.id+'.json';a.click();URL.revokeObjectURL(url)}
function continueLife(){if(!deathReport)return;const kind=deathReport.kind;deathReport=null;deathPending=false;$('panel').classList.add('hidden');$('overlay').classList.add('hidden');mode='play';recover(kind);if(!isTouch)$('crosshair').classList.remove('hidden')}
$('dialogueChoices').addEventListener('click',e=>{const b=e.target.closest('button');if(b)chooseDialogue(Number(b.dataset.choice))});$('dialogueClose').addEventListener('click',endConversation);$('talkBtn').addEventListener('click',talkNearby);


/* Businesses share the city save, but use their own walkable rooms. */
function shopById(id){return SHOP.shops.find(s=>s.id===id)}
function ensureMarket(){
 if(!save.secrets||typeof save.secrets!=='object')save.secrets={};
 if(!save.home||typeof save.home!=='object')save.home={built:[],furniture:[]};
 if(!Array.isArray(save.home.built))save.home.built=[];
 if(!Array.isArray(save.home.furniture))save.home.furniture=[];
 if(!Number.isFinite(save.moonshineDelivered))save.moonshineDelivered=0;
 for(const id of save.businesses)if(SHOP.secrets.some(s=>s.club===id))save.secrets[id]='found';
 if(!save.inventory||typeof save.inventory!=='object'||Array.isArray(save.inventory))save.inventory={};
 if(!save.market||typeof save.market!=='object')save.market={seconds:0,stock:{}};
 if(!save.market.demand||typeof save.market.demand!=='object')save.market.demand={};
 for(const secret of SHOP.secrets)if(!Number.isInteger(save.market.demand[secret.club]))save.market.demand[secret.club]=3;
 if(!save.market.stock||typeof save.market.stock!=='object')save.market.stock={};
 for(const s of SHOP.shops){if(!save.market.stock[s.id])save.market.stock[s.id]={};for(const id of s.goods){
  if(!Number.isInteger(save.market.stock[s.id][id])||save.market.stock[s.id][id]<0)save.market.stock[s.id][id]=SHOP.items[id].stock;
 }}
 for(const id of Object.keys(save.inventory))if(!SHOP.items[id]||!Number.isInteger(save.inventory[id])||save.inventory[id]<0)delete save.inventory[id];
}
function tickEmpire(dt){
 empireTimer+=dt;while(empireTimer>=120){empireTimer-=120;const income=save.businesses.reduce((n,id)=>n+({velvet:6,blue:11,lucky:18.50}[id]||0),0);if(income){save.income=SHOP.round(save.income+income);toast('Your clubs earned '+money(income)+'. Collect it in Empire.');persist()}}
}
function tickMarket(dt){ensureMarket();save.market.seconds=(Number(save.market.seconds)||0)+dt;if(save.market.seconds>=180){save.market.seconds%=180;for(const s of SHOP.shops)for(const id of s.goods)save.market.stock[s.id][id]=SHOP.items[id].stock;for(const s of SHOP.secrets)save.market.demand[s.club]=3;persist()}}
function makeRoom(s){
 if(s.id==='home'){
  const fixtures=[{x:280,y:156,w:160,h:28,label:'CONSTRUCTION BOOK',color:'#6e5940'}];
  const sizes={bed:[75,90],table:[70,45],chair:[28,28],radio:[40,25],lamp:[24,24]};
  for(const p of save.home.furniture){const [w,h]=sizes[p.item]||[35,35];fixtures.push({x:p.x,y:p.y,w,h,label:SHOP.items[p.item].name.toUpperCase(),color:'#80694e'})}
  return fixtures;
 }
 const f=(x,y,w,h,label,color='#655344')=>({x,y,w,h,label,color});
 const common=[f(280,156,160,28,'COUNTER','#6e5940')];
 const layouts={
 dealer:[f(60,80,150,95,'SHOWROOM'),f(500,240,130,120,'DISPLAY CAR','#54716e')],
 hardware:[f(55,85,150,90,'LUMBER'),f(530,85,100,140,'HARDWARE')],
 furniture:[f(55,90,150,80,'BEDS'),f(515,95,110,100,'TABLES'),f(70,330,130,45,'RADIOS')],
 garage:[f(70,100,140,65,'WORK BENCH'),f(490,205,100,140,'SERVICE BAY','#4e6662'),f(65,340,130,45,'TIRES','#343d36')],
 still:[f(70,100,125,95,'COPPER STILL','#a06d3c'),f(510,90,100,55,'BOTTLES'),f(80,330,150,48,'SACKS OF SUGAR')],
 club:[f(55,78,150,90,'BANDSTAND','#66506b'),f(510,250,80,55,'TABLE'),f(115,300,80,55,'TABLE'),f(490,85,125,55,'BAR','#6f543e')],
 depot:[f(55,85,155,70,'FREIGHT'),f(510,80,120,95,'CRATES'),f(70,330,150,60,'DISPATCH')],
 boarding:[f(65,110,145,80,'SOFA','#6b6853'),f(510,85,120,90,'BED','#897b63'),f(500,320,100,45,'SUPPER')],
 grocer:[f(55,80,145,55,'COFFEE / SUGAR'),f(525,80,110,140,'GROCERIES','#72805b'),f(60,330,150,55,'BREAD / MILK')],
 diner:[f(50,85,150,65,'KITCHEN','#84918a'),f(525,95,110,60,'BOOTH','#87624f'),f(525,310,110,60,'BOOTH','#87624f'),f(60,325,140,45,'STOOLS')],
 pharmacy:[f(50,75,145,80,'DRESSINGS','#799588'),f(525,75,115,110,'MEDICINES','#799588'),f(70,340,130,40,'SODA FOUNTAIN')],
 tailor:[f(55,80,150,65,'SEWING TABLE'),f(525,85,110,155,'CLOTH RACK','#987960'),f(80,335,130,55,'FITTING SCREEN')],
 pawn:[f(50,80,150,90,'WATCHES'),f(520,85,110,125,'RECORDS'),f(70,335,130,50,'USED GOODS')],
 barber:[f(55,85,145,50,'MIRROR','#81918c'),f(85,250,75,80,'CHAIR','#8a6257'),f(530,250,75,80,'CHAIR','#8a6257')]
 };
 return common.concat(layouts[s.layout]||layouts.grocer);
}
function roomBlocked(x,y,r=9){if(x<38+r||x>682-r||y<62+r||y>455-r)return true;return interior.fixtures.some(b=>x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h)}
function clearInputs(){for(const k in keys)keys[k]=false;mouse.down=false;touch.fire=false;touch.x=touch.y=0;touch.airUp=touch.airDown=false}
function enterBusiness(p,viaSecret=false){
 if(player.air)return false;
 if(mode!=='play'||(interior&&!viaSecret)||!shopById(p.id))return false;
 if(p.hidden&&!viaSecret){toast('Find the concealed entrance through '+places.find(f=>f.id===p.front).name+'.');return false}
 if(player.car){toast('Park, press E to get out, then walk to the entrance.');return false}
 if(heat>=20&&!viaSecret){toast('Patrols are watching. Lose your wanted level before going inside.');return false}
 const s=shopById(p.id);ensureMarket();const outside=interior?interior.outside:{x:player.x,y:player.y,a:player.a};interior={place:p,shop:s,outside,fixtures:makeRoom(s)};
 player.x=360;player.y=405;player.vx=player.vy=0;player.a=-Math.PI/2;clearInputs();
 camera.x=360;camera.y=250;camera.lookX=camera.lookY=0;
 interior.people=[{id:'shop-'+s.id,name:s.keeper,role:s.role,x:360,y:122,a:Math.PI/2,color:s.color,featured:s.portrait!==undefined,portrait:s.portrait,shopId:s.id},
 {id:'patron-'+s.id,name:s.layout==='club'?'A musician':'A local customer',role:'LOCAL',x:230,y:270,a:0,color:'#a69e80',shopId:s.id,patron:true}];
 if(s.id==='home')interior.people=interior.people.slice(0,1);
 $('insideLabel').textContent=p.name+' · F: talk · E: leave at the door';$('insideLabel').classList.remove('hidden');$('minimapWrap').classList.add('hidden');$('crosshair').classList.add('hidden');
 toast('Inside '+p.name+'. Walk to the counter and press F.');updateHUD(true);return true;
}
function leaveBusiness(force=false){
 if(!interior)return false;
 if(!force&&dist(player,{x:360,y:437})>65){toast('Walk to the EXIT at the bottom of the room, then press E.');return false}
 if(conversation)endConversation();if(interior.place.hidden&&!force){const front=places.find(p=>p.id===interior.place.front);return enterBusiness(front,true)}const outside=interior.outside;interior=null;
 Object.assign(player,outside,{vx:0,vy:0});clearInputs();camera.x=player.x;camera.y=player.y;camera.lookX=camera.lookY=0;
 $('insideLabel').classList.add('hidden');$('minimapWrap').classList.remove('hidden');if(!isTouch)$('crosshair').classList.remove('hidden');updateHUD(true);persist();return true;
}
function updateInterior(dt){
 activeElapsed+=dt;tickMarket(dt);tickEmpire(dt);player.shot=Math.max(0,player.shot-dt);player.invincible=Math.max(0,player.invincible-dt);
 let dx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0),dy=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0);
 if(isTouch&&(touch.x||touch.y)){dx=touch.x;dy=touch.y}const n=Math.max(1,Math.hypot(dx,dy)),v=130;
 const tx=player.x+dx/n*v*dt,ty=player.y+dy/n*v*dt;
 if(!roomBlocked(tx,player.y))player.x=tx;if(!roomBlocked(player.x,ty))player.y=ty;
 if(dx||dy){player.a=Math.atan2(dy,dx);player.step+=dt*11}
 if(job){job.time-=dt;if(job.time<=0)failJob('Time ran out')}
 saveTimer+=dt;if(saveTimer>12){saveTimer=0;persist()}updateHUD();
}
function errandDefinition(id){return SHOP.errands.find(e=>e.id===id)}
function offerShopJob(id){let e=errandDefinition(id);if(!e)return;if(job){toast('Finish or abandon your current job first.');return}if(conversation)endConversation();acceptJob({type:'errand',errandId:e.id,title:e.title,desc:e.description,pay:e.pay,xp:e.xp,difficulty:'LOCAL DELIVERY',duration:420})}
function advanceSupplyJob(){
 if(!interior||!conversation||conversation.npc.patron||job?.type!=='bootleg'||job.target.id!==interior.place.id)return;
 job.stage++;
 if(job.stage>=3){save.moonshineDelivered+=2;completeJob();checkEndgame();return say('Both crates accounted for. Your cut is paid.',[option('Good doing business.',endConversation)])}
 job.target=job.stops[job.stage];job.info='Take one sealed crate inside '+job.target.name+' through its concealed shop entrance. Speak to the proprietor.';addHeat(job.stage===1?8:6);updateObjective();
 return say(job.stage===1?'Two crates loaded. Both buyers expect a handover inside.':'One crate delivered. Take the other to your next buyer.',[option('On my way.',endConversation)]);
}
function advanceShopJob(){
 if(!interior||!conversation||conversation.npc.patron||job?.type!=='errand'||job.target.id!==interior.place.id)return;
 const e=errandDefinition(job.errandId);job.stage++;
 if(job.stage>=e.stops.length){if(e.reveal){save.secrets[e.reveal]=save.secrets[e.reveal]||'known';toast(SHOP.secrets.find(s=>s.club===e.reveal).hint)}completeJob();checkEndgame();return say('That is the right parcel. Here is your pay. '+(e.reveal?SHOP.secrets.find(s=>s.club===e.reveal).hint:'Thanks for seeing it through.'),[option('Glad to help.',endConversation)])}
 job.target=places.find(p=>p.id===e.stops[job.stage]);job.cargo=e.cargo;job.info='Carry '+e.cargo+' to '+job.target.name+'. Go inside and speak to the person at the counter.';
 updateObjective();return say('Here is your sealed order. Take it to '+job.target.name+'. It has already been paid for.',[option('I have it. I will speak to them inside.',endConversation)]);
}
function shopStory(n){
 const s=shopById(n.shopId);
 if(n.patron)return say(s.rumor,[option('Who runs this place?',()=>say(s.keeper+' is at the counter. Ask about goods, services or local jobs.',[option('Thanks.',endConversation)])),option('Back to it.',endConversation)]);
 const choices=[];
 if(s.id==='home')return say(s.greeting,[option('Open the construction book.',()=>{endConversation();showPanel('home')}),option('Back to the lot.',endConversation)]);
 if(s.id==='dealer')return say(s.greeting,[option('Show me the cars.',()=>{endConversation();showPanel('dealership')}),option('About buying a car...',()=>say('You keep the cars you buy. The car is parked outside the dealership; leave the showroom and press E beside it. Recalling an owned car costs nothing.',[option('Understood.',endConversation)])),option('Goodbye.',endConversation)]);
 const hidden=SHOP.secrets.find(secret=>secret.front===s.id);
 if(hidden)choices.push(option('Ask about the room in the back.',()=>{if(save.jobs<hidden.jobs)return say('I do not know you well enough yet. Complete '+hidden.jobs+' jobs around town, then ask again.',[option('Fair enough.',endConversation)]);save.secrets[hidden.club]=save.secrets[hidden.club]||'known';persist();return say(hidden.hint+' Look for the door on the right side of this shop, then press E beside it.',[option('I will take a look.',endConversation)])}));
 if(job?.type==='bootleg'&&job.target.id===s.id)choices.push(option(job.stage===0?'Collect the two job crates.':'Deliver the job crate.',advanceSupplyJob));
 if(job?.type==='errand'&&job.target.id===s.id)choices.push(option(job.stage===0?'Collect the job parcel.':'Hand over the job parcel.',advanceShopJob));
 choices.push(option('Show me what you buy and sell.',()=>{endConversation();showPanel('shop')}));
 choices.push(option('Any local jobs?',()=>job?say('You already have a job. Finish it, or abandon it from the Jobs panel.',[option('Understood.',endConversation)]):say(errandDefinition(s.job).description+' Pay: '+money(errandDefinition(s.job).pay)+'. The goods are supplied; no purchase is required.',[option('Take the job.',()=>{offerShopJob(s.job)}),option('Maybe later.',endConversation)])));
 choices.push(option('What is happening around town?',()=>say(s.rumor,[option('Good to know.',endConversation)])));
 if(['garage','velvet','lucky'].includes(s.id))choices.push(option('About that other business...',()=>storyFor({...n,id:({garage:'sal',velvet:'nora',lucky:'ruth'})[s.id],shopId:null})));
 choices.push(option('Just looking. Goodbye.',endConversation));return say(s.greeting,choices);
}
function tradeItem(id,side){
 if(modal!=='shop'||!interior||mode!=='pause')return false;ensureMarket();
 const s=interior.shop,item=SHOP.items[id];if(!item||!s.goods.includes(id)||!['buy','sell'].includes(side))return false;
 const stock=save.market.stock[s.id],owned=save.inventory[id]||0;
 if(id==='moonshine'){
  const secret=SHOP.secrets.find(p=>p.club===s.id);
  if(side==='buy'&&s.id!=='still')return false;
  if(side==='sell'&&(!secret||save.secrets[s.id]!=='found'))return false;
  if(side==='sell'){
   if(owned<1||save.market.demand[s.id]<1){toast('This club has enough stock tonight. Buyers return after three minutes of active play.');return false}
   save.inventory[id]--;save.market.demand[s.id]--;save.cash=SHOP.round(save.cash+secret.price);save.stats.earnings=SHOP.round(save.stats.earnings+secret.price);save.moonshineDelivered++;addHeat(8);sound('cash');persist();checkEndgame();updateHUD(true);toast('MOONSHINE DELIVERED · '+money(secret.price)+' · '+save.market.demand[s.id]+' more crates wanted');return true;
  }
 }
 if(side==='buy'){
  if(stock[id]<1){toast('Sold out. Deliveries restock shops after three minutes of active play.');return false}
  if(Object.values(save.inventory).reduce((a,b)=>a+b,0)>=30){toast('Your bag is full: 30 items. Use or sell something first.');return false}
  if(!spend(item.price))return false;save.cash=SHOP.round(save.cash);stock[id]--;save.inventory[id]=owned+1;toast(item.name+' bought · '+money(item.price));
 }else{
  if(owned<1){toast('You do not have that item to sell.');return false}
  const price=SHOP.round(item.price*.55);save.inventory[id]--;stock[id]++;save.cash=SHOP.round(save.cash+price);sound('cash');toast(item.name+' sold · '+money(price));
 }persist();updateHUD(true);return true;
}
function useInventory(id){
 const item=SHOP.items[id];if(!item?.heal||!(save.inventory[id]>0)||player.hp>=100)return false;
 save.inventory[id]--;player.hp=Math.min(100,player.hp+item.heal);persist();toast(item.name+' used.');updateHUD(true);return true;
}
function shopService(){
 if(modal!=='shop'||!interior?.shop.service)return false;
 const [type,price]=interior.shop.service;let car=null;if(type==='repair'){
 car=parkedVehicle;
 if(!car||!cars.includes(car)||car.dead||car.burning||dist(car,interior.outside)>=170){toast('Park your car outside, get out, then walk in for repairs.');return false}
 if(car.hp>=car.maxHp){toast('Your parked car does not need repairs.');return false}
 }
 else if(player.hp>=100){toast('You are already in good health.');return false}
 if(!spend(price))return false;save.cash=SHOP.round(save.cash);
 if(type==='repair')car.hp=car.maxHp;else player.hp=Math.min(100,player.hp+({meal:25,shave:10}[type]||100));
 persist();updateHUD(true);toast(type==='repair'?'Your parked car is repaired.':'You feel better.');return true;
}
function renderShop(){
 if(!interior){closePanel();return}ensureMarket();const s=interior.shop;
 let html=panelHead(s.keeper+' · '+money(save.cash),interior.place.name)+'<p>Buy one item at a time. Selling pays 55% of the shelf price, rounded to the nearest cent. Bag: '+Object.values(save.inventory).reduce((a,b)=>a+b,0)+'/30. Stock returns every three minutes of active play.</p><div class="shop-ledger">';
 html+='<div class="shop-row shop-heading"><span>GOODS / IN YOUR BAG</span><span>COUNTER</span></div>';
 for(const id of s.goods){const a=SHOP.items[id],owned=save.inventory[id]||0,stock=save.market.stock[s.id][id];
 if(id==='moonshine'){const secret=SHOP.secrets.find(p=>p.club===s.id);html+='<article class="shop-row"><div><h3>'+a.name+'</h3><p>'+a.description+'</p><small>IN BAG '+owned+(secret?' · BUYER WANTS '+save.market.demand[s.id]:' · IN STOCK '+stock)+'</small></div><div class="shop-actions">'+(s.id==='still'?'<button data-do="shop-buy" data-item="moonshine" '+(stock<1||save.cash<4?'disabled':'')+'>BUY $4.00</button>':'<button data-do="shop-sell" data-item="moonshine" '+(owned<1||!save.market.demand[s.id]?'disabled':'')+'>DELIVER '+money(secret.price)+'</button>')+'</div></article>';continue}
 html+='<article class="shop-row"><div><h3>'+a.name+'</h3><p>'+a.description+'</p><small>IN BAG '+owned+' · IN STOCK '+stock+'</small></div><div class="shop-actions"><button data-do="shop-buy" data-item="'+id+'" '+(stock<1||save.cash<a.price?'disabled':'')+'>BUY '+money(a.price)+'</button><button data-do="shop-sell" data-item="'+id+'" '+(owned<1?'disabled':'')+'>SELL '+money(SHOP.round(a.price*.55))+'</button></div></article>'}
 html+='</div>';
 if(s.service)html+='<div class="card"><h3>'+s.service[2]+'</h3><footer><span>'+money(s.service[1])+'</span><button data-do="shop-service">ASK FOR SERVICE</button></footer></div>';
 html+='<h3>Your bag</h3><div class="bag-items">';
 const held=Object.entries(save.inventory).filter(([id,n])=>n>0);
 html+=held.length?held.map(([id,n])=>'<span>'+SHOP.items[id].name+' × '+n+(SHOP.items[id].heal?' <button data-do="shop-use" data-item="'+id+'" '+(player.hp>=100?'disabled':'')+'>USE</button>':'')+'</span>').join(''):'<p>Your bag is empty.</p>';
 html+='</div><p class="shop-footnote">Fictional shops and game prices inspired by the 1920s. A job parcel is separate from your bag and cannot be sold.</p><button data-do="close" class="primary">BACK TO THE ROOM →</button>';$('panel').innerHTML=html;
}
function trySecretDoor(){
 if(!interior)return false;const secret=SHOP.secrets.find(s=>s.front===interior.place.id);if(!secret||dist(player,{x:642,y:255})>64)return false;
 if(save.jobs<secret.jobs){toast('A locked panel. Earn trust by completing '+secret.jobs+' jobs.');return true}
 if(save.secrets[secret.club]!=='found'){save.secrets[secret.club]='found';save.xp+=100;generateJobs();persist();toast('SPEAKEASY DISCOVERED · '+places.find(p=>p.id===secret.club).name)}
 enterBusiness(places.find(p=>p.id===secret.club),true);checkEndgame();return true;
}
function checkEndgame(){
 if(save.endgameClaimed||!SHOP.secrets.every(s=>save.secrets[s.club]==='found')||save.moonshineDelivered<12||!save.home.built.includes('roof'))return;
 save.endgameClaimed=true;gift(100);save.xp+=250;persist();toast('COUNTY SUPPLIER · All three hidden clubs found, 12 crates delivered and your home built. Bonus: $100.');
}
function progressionHTML(){
 return '<div class="card"><small>THE COUNTY SUPPLIER · LONG-TERM GOAL</small><h3>Find your buyers. Build a home.</h3><p>'+SHOP.secrets.filter(s=>save.secrets[s.club]==='found').length+'/3 speakeasies discovered · '+save.moonshineDelivered+'/12 moonshine crates delivered · '+save.home.built.length+'/3 home stages. '+(save.endgameClaimed?'COMPLETED · $100 bonus paid.':'Complete all three goals for a $100 bonus.')+'</p><p>'+SHOP.secrets.map(s=>save.secrets[s.club]==='found'?places.find(p=>p.id===s.club).name+' discovered':save.secrets[s.club]==='known'?s.hint:'Hidden buyer: earn trust through '+s.jobs+' completed jobs or investigate a clue job.').join('<br>')+'</p></div>';
}
function buyDealerCar(id){
 if(modal!=='dealership'||interior?.place.id!=='dealer'||!['sedan','coupe','truck','custom'].includes(id))return false;
 if(!save.ownedCars.includes(id)&&!spend(carTypes[id].price))return false;
 if(!save.ownedCars.includes(id))save.ownedCars.push(id);save.car=id;
 const p=interior.outside,at=roadside(p,-20);
 // Recall an existing copy instead of duplicating a vehicle on every click.
 const c=cars.find(c=>c.owned&&c.type===id&&!c.dead&&!c.burning);
 if(c){c.x=at.x;c.y=at.y;c.a=at.a;c.v=c.vx=c.vy=0;c.ai='parked'}
 else {const car=newCar(id,at.x,at.y,at.a,{owned:true});car.maxHp=carTypes[id].hp*(1+save.armor*.25);car.hp=car.maxHp;cars.push(car)}
 persist();toast(carTypes[id].name+' is parked outside. Leave the showroom and press E beside it.');return true;
}
function renderDealership(){
 if(interior?.place.id!=='dealer'){closePanel();return}
 $('panel').innerHTML=panelHead('COLE MOTOR COMPANY · '+money(save.cash),'Your next set of wheels')+'<p>Buy a car here, then leave the showroom to collect it. Owned cars can be recalled here free of charge.</p><div class="cards">'+['sedan','coupe','truck','custom'].map(id=>'<article class="card"><small>'+Math.round(carTypes[id].max*.21)+' MPH · '+carTypes[id].hp+' DURABILITY</small><h3>'+carTypes[id].name+'</h3><footer><span class="money">'+(save.ownedCars.includes(id)?'OWNED':money(carTypes[id].price))+'</span><button data-do="dealer-car" data-car="'+id+'" '+(!save.ownedCars.includes(id)&&save.cash<carTypes[id].price?'disabled':'')+'>'+(save.ownedCars.includes(id)?'RECALL OUTSIDE':'BUY CAR')+'</button></footer></article>').join('')+'</div>';
}
const homeSlots=[{x:70,y:85},{x:180,y:85},{x:510,y:85},{x:590,y:85},{x:70,y:315},{x:180,y:315},{x:510,y:315},{x:590,y:315}];
function buildHome(id){
 if(modal!=='home'||interior?.place.id!=='home')return false;const r=SHOP.recipes.find(r=>r.id===id);
 if(!r||save.home.built.includes(id)||!r.requires.every(id=>save.home.built.includes(id))||!Object.entries(r.needs).every(([id,n])=>(save.inventory[id]||0)>=n))return false;
 for(const [id,n] of Object.entries(r.needs))save.inventory[id]-=n;save.home.built.push(id);interior.fixtures=makeRoom(interior.shop);persist();checkEndgame();toast(r.name+' complete.');return true;
}
function placeFurniture(id){
 if(modal!=='home'||interior?.place.id!=='home'||!['bed','table','chair','radio','lamp'].includes(id)||!save.home.built.includes('roof')||!(save.inventory[id]>0)||save.home.furniture.length>=homeSlots.length)return false;
 const slot=homeSlots.find(p=>!save.home.furniture.some(f=>f.x===p.x&&f.y===p.y));save.inventory[id]--;save.home.furniture.push({item:id,...slot});interior.fixtures=makeRoom(interior.shop);persist();return true;
}
function removeFurniture(index){
 if(modal!=='home'||interior?.place.id!=='home'||!Number.isInteger(index)||!save.home.furniture[index]||Object.values(save.inventory).reduce((a,b)=>a+b,0)>=30)return false;
 const p=save.home.furniture.splice(index,1)[0];save.inventory[p.item]=(save.inventory[p.item]||0)+1;interior.fixtures=makeRoom(interior.shop);persist();return true;
}
function renderHome(){
 if(interior?.place.id!=='home'){closePanel();return}
 let html=panelHead('YOUR HOME · '+money(save.cash),'Make a place of your own')+'<p>Buy supplies at Bell\'s Hardware and bring them here. Each stage uses the materials listed. Furnishings come from Abbott Home Furnishings.</p><div class="cards">';
 for(const r of SHOP.recipes){const done=save.home.built.includes(r.id),can=!done&&r.requires.every(id=>save.home.built.includes(id))&&Object.entries(r.needs).every(([id,n])=>(save.inventory[id]||0)>=n);
 html+='<article class="card"><small>'+ (done?'BUILT':'CONSTRUCTION')+'</small><h3>'+r.name+'</h3><p>'+r.description+'</p><p>'+Object.entries(r.needs).map(([id,n])=>SHOP.items[id].name+': '+(save.inventory[id]||0)+' / '+n).join('<br>')+'</p><button data-do="home-build" data-recipe="'+r.id+'" '+(!can?'disabled':'')+'>'+(done?'COMPLETE':'BUILD')+'</button></article>'}
 html+='</div><h3>Furnish your finished home</h3><div class="bag-items">';
 for(const id of ['bed','table','chair','radio','lamp'])html+='<span>'+SHOP.items[id].name+' × '+(save.inventory[id]||0)+' <button data-do="home-place" data-item="'+id+'" '+(!(save.inventory[id]>0)||!save.home.built.includes('roof')||save.home.furniture.length>=8?'disabled':'')+'>PLACE</button></span>';
 html+='</div><p>Placed: '+save.home.furniture.length+' / 8. Each piece appears in the room.</p>';
 html+=save.home.furniture.map((p,i)=>'<p>'+SHOP.items[p.item].name+' <button data-do="home-remove" data-index="'+i+'">PACK INTO BAG</button></p>').join('');
 if(save.home.furniture.some(p=>p.item==='bed'))html+='<button data-do="home-rest" class="secondary">REST IN YOUR BED · FREE</button>';
 html+=progressionHTML();$('panel').innerHTML=html;
}

function roomMaterial(s){
 if(s.floorArt)return s.floorArt;const c=document.createElement('canvas');c.width=720;c.height=500;const q=c.getContext('2d'),rnd=artRandom(s.id.length*727+1926),tiled=['diner','pharmacy','barber','dealer'].includes(s.layout);
 q.fillStyle='#081217';q.fillRect(0,0,720,500);q.fillStyle=s.floor;q.fillRect(38,62,644,393);q.save();q.beginPath();q.rect(38,62,644,393);q.clip();
 if(tiled){for(let y=62;y<455;y+=24)for(let x=38;x<682;x+=24){q.fillStyle=((x-38)/24+(y-62)/24)%2?'#40534e':'#a7ae96';q.fillRect(x,y,23,23);q.fillStyle='#e6e2bf0c';q.fillRect(x+2,y+2,19,1)}}
 else{for(let y=62;y<455;y+=13)for(let x=38-(Math.floor(y/13)%3)*38;x<682;x+=114){q.fillStyle=tint(s.floor,.82+rnd()*.36);q.fillRect(x,y,113,12);q.fillStyle='#d9ac7522';q.fillRect(x+2,y+1,109,1);q.strokeStyle='#170e0b28';q.lineWidth=.5;for(let k=0;k<3;k++){q.beginPath();q.moveTo(x+3,y+3+k*3);q.bezierCurveTo(x+30,y+k*3,x+65,y+7+k*2,x+110,y+3+k*3);q.stroke()}}}
 if(['club','boarding','furniture','home'].includes(s.layout)){q.fillStyle=s.layout==='club'?'#672f36':'#4b5a4d';q.fillRect(240,240,240,140);q.strokeStyle='#c39e6377';q.lineWidth=2;q.strokeRect(247,247,226,126);q.strokeRect(253,253,214,114);for(let x=265;x<470;x+=22){q.fillStyle='#c5a67150';q.beginPath();q.moveTo(x,300);q.lineTo(x+7,309);q.lineTo(x,318);q.lineTo(x-7,309);q.closePath();q.fill()}}
 // Window light and wall occlusion are baked into each room, never reallocated per frame.
 for(const x of [145,570]){const glow=q.createRadialGradient(x,90,5,x,90,230);glow.addColorStop(0,'#f4c47b2b');glow.addColorStop(1,'#edb76a00');q.fillStyle=glow;q.fillRect(38,62,644,393);q.fillStyle='#dccba515';q.beginPath();q.moveTo(x-32,62);q.lineTo(x+32,62);q.lineTo(x+100,245);q.lineTo(x-12,245);q.closePath();q.fill()}
 const edge=q.createLinearGradient(0,62,0,120);edge.addColorStop(0,'#071217aa');edge.addColorStop(1,'#07121700');q.fillStyle=edge;q.fillRect(38,62,644,58);q.restore();
 q.fillStyle='#182b2d';q.fillRect(25,45,670,17);q.fillRect(25,45,13,423);q.fillRect(682,45,13,423);q.strokeStyle='#b6a477';q.lineWidth=2;q.strokeRect(27,47,666,417);q.fillStyle='#b99b653f';q.fillRect(38,62,644,2);
 for(const x of [145,570]){q.fillStyle='#0c1b24';q.fillRect(x-33,45,66,15);q.fillStyle='#a3bdad';q.fillRect(x-30,47,60,9);q.fillStyle='#344c47';for(let k=-20;k<=20;k+=20)q.fillRect(x+k,46,2,13)}
 s.floorArt=c;return c;
}
function drawFixture(b,s){
 const {x,y,w:fw,h:fh,label}=b;ctx.save();ctx.fillStyle='#050d1366';ctx.fillRect(x+7,y+10,fw,fh);ctx.fillStyle='#251d19';ctx.fillRect(x,y+5,fw,fh);ctx.fillStyle=b.color;ctx.fillRect(x,y,fw,fh);ctx.strokeStyle='#c7ab7770';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,fw-1,fh-1);ctx.fillStyle='#e5c98b33';ctx.fillRect(x+2,y+2,fw-4,2);
 const bottle=(bx,by,col)=>{ctx.fillStyle='#0b141733';ctx.fillRect(bx+1,by+2,5,10);ctx.fillStyle=col;ctx.fillRect(bx,by,4,8);ctx.fillRect(bx+1,by-3,2,3);ctx.fillStyle='#e2d6ad';ctx.fillRect(bx,by+3,4,2)};
 const circle=(cx,cy,r,col)=>{ctx.fillStyle=col;ctx.beginPath();ctx.arc(cx,cy,r,0,TAU);ctx.fill()};
 if(/DISPLAY CAR|SHOWROOM|SERVICE BAY/.test(label)){
  ctx.fillStyle='#bcad7444';ctx.fillRect(x+6,y+6,fw-12,fh-12);ctx.strokeStyle='#d4cba277';ctx.strokeRect(x+8,y+8,fw-16,fh-16);const art=CAR_ART.get('coupe',s.layout==='garage'?'#49615c':'#813d37','');ctx.save();ctx.translate(x+fw/2,y+fh/2);ctx.rotate(-Math.PI/2);ctx.scale(1.6,1.6);ctx.drawImage(art.body.c,-art.body.w/2,-art.body.h/2,art.body.w,art.body.h);ctx.drawImage(art.roof.c,art.roof.off-art.roof.w/2,-art.roof.h/2,art.roof.w,art.roof.h);ctx.restore();
 }else if(/BED|SOFA|BOOTH|CHAIR/.test(label)){
  ctx.fillStyle='#251c1b';ctx.fillRect(x+7,y+8,fw-14,fh-14);ctx.fillStyle=/BED/.test(label)?'#c9bf9d':'#744638';ctx.fillRect(x+9,y+10,fw-18,fh-19);ctx.fillStyle=/BED/.test(label)?'#e3d9ba':'#986955';ctx.fillRect(x+11,y+11,fw-22,Math.min(18,fh*.3));ctx.strokeStyle='#34292766';for(let xx=x+fw/3;xx<x+fw-10;xx+=fw/3){ctx.beginPath();ctx.moveTo(xx,y+12);ctx.lineTo(xx,y+fh-10);ctx.stroke()}
 }else if(/TABLE|SUPPER/.test(label)){
  ctx.fillStyle='#a17e50';ctx.fillRect(x+4,y+4,fw-8,fh-8);for(const k of [.25,.75]){circle(x+fw*k,y+fh*.5,9,'#e0d6b9');circle(x+fw*k,y+fh*.5,6,'#b4b79b');bottle(x+fw*k+12,y+fh*.3,'#627a4c')}
 }else if(/BANDSTAND/.test(label)){
  ctx.fillStyle='#8c5d52';for(let yy=y+5;yy<y+fh-4;yy+=8)ctx.fillRect(x+4,yy,fw-8,1);ctx.fillStyle='#151f24';ctx.fillRect(x+15,y+16,60,35);ctx.fillStyle='#e5dabb';ctx.fillRect(x+15,y+44,60,7);ctx.fillStyle='#11191c';for(let k=0;k<14;k++)ctx.fillRect(x+17+k*4,y+44,1,4);circle(x+111,y+38,16,'#b5a17a');circle(x+111,y+38,12,'#ddd0aa');circle(x+92,y+61,9,'#b5a17a');
 }else if(/STILL/.test(label)){
  circle(x+fw*.43,y+fh*.53,27,'#392f28');circle(x+fw*.43-3,y+fh*.53-4,25,'#b37b45');circle(x+fw*.43-8,y+fh*.53-10,16,'#d8a56b');ctx.strokeStyle='#bc8a50';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(x+fw*.43,y+fh*.3);ctx.lineTo(x+fw*.43,y+12);ctx.lineTo(x+fw*.85,y+12);ctx.lineTo(x+fw*.85,y+fh*.8);ctx.stroke();
 }else if(/TIRES/.test(label)){
  for(let xx=x+18;xx<x+fw-8;xx+=29){circle(xx,y+fh/2,13,'#121e21');circle(xx,y+fh/2,6,'#69736a');circle(xx,y+fh/2,3,'#263537')}
 }else if(/COUNTER|DISPATCH|CONSTRUCTION/.test(label)){
  ctx.fillStyle='#2e433d';ctx.fillRect(x+fw-30,y+5,21,15);ctx.fillStyle='#d9d4af';ctx.fillRect(x+fw-27,y+7,15,4);ctx.fillStyle='#e0cc9e';ctx.fillRect(x+17,y+5,24,17);ctx.fillStyle='#90764f';ctx.fillRect(x+28,y+5,1,17);ctx.fillRect(x+20,y+9,6,1);ctx.fillRect(x+32,y+9,6,1);
 }else if(/MIRROR/.test(label)){
  ctx.fillStyle='#a79c74';ctx.fillRect(x+5,y+5,fw-10,fh-10);ctx.fillStyle='#7d9e99';ctx.fillRect(x+8,y+8,fw-16,fh-16);ctx.fillStyle='#d2e6c755';ctx.beginPath();ctx.moveTo(x+10,y+8);ctx.lineTo(x+50,y+8);ctx.lineTo(x+30,y+fh-8);ctx.lineTo(x+10,y+fh-8);ctx.fill();
 }else{
  const goods=['#897741','#a96340','#6a855a','#d0ba86','#7b9b91'];for(let yy=y+8;yy<y+fh-10;yy+=23){ctx.fillStyle='#1c292b88';ctx.fillRect(x+5,yy+13,fw-10,4);for(let xx=x+9;xx<x+fw-10;xx+=13){const k=Math.floor((xx+yy)/13)%5;if(/BOTTLE|BAR|MEDICINE|MILK|SODA/.test(label))bottle(xx,yy+1,goods[k]);else{ctx.fillStyle=goods[k];ctx.fillRect(xx,yy,9,12);ctx.fillStyle='#e6d6b866';ctx.fillRect(xx+2,yy+4,5,3)}}}
 }
 // Furniture stays identifiable; small plaques sit on its lower edge.
 ctx.font='bold 8px Arial';ctx.textAlign='center';const tw=Math.min(fw-4,ctx.measureText(label).width+10);ctx.fillStyle='#112024e8';ctx.fillRect(x+(fw-tw)/2,y+fh-11,tw,11);ctx.fillStyle='#ecdbb4';ctx.fillText(label,x+fw/2,y+fh-3,fw-6);ctx.restore();
}

function drawInterior(){
 const s=interior.shop,scale=Math.min(w/790,h/610),ox=w/2-360*scale,oy=h/2-250*scale;
 ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);
 ctx.drawImage(roomMaterial(s),0,0);
 ctx.fillStyle=s.color;ctx.fillRect(322,453,76,10);ctx.fillStyle='#f4e4b8';ctx.font='bold 12px Arial';ctx.textAlign='center';ctx.fillText('E · EXIT',360,481);
 for(const b of interior.fixtures)drawFixture(b,s);
 const hidden=SHOP.secrets.find(secret=>secret.front===interior.shop.id);
 if(hidden){ctx.fillStyle=save.secrets[hidden.club]?'#b29b68':'#4c4c40';ctx.fillRect(658,220,21,68);ctx.fillStyle='#e4d1a0';ctx.font='9px Arial';ctx.textAlign='right';ctx.fillText(save.secrets[hidden.club]?'E · CONCEALED DOOR':'UNMARKED PANEL',650,250)}
 if(s.id==='home'&&!save.home.built.includes('roof')){ctx.fillStyle='#d9c38e';ctx.font='12px Arial';ctx.textAlign='center';ctx.fillText(save.home.built.includes('frame')?'FRAME RAISED · ROOF NEEDED':save.home.built.includes('foundation')?'FOUNDATION LAID':'EMPTY HOME LOT',360,340)}
 for(const n of interior.people){drawPerson(n);ctx.fillStyle=s.color;ctx.font='bold 11px Arial';ctx.fillText(n.patron?'···':n.name,n.x,n.y-22);if(dist(n,player)<110){ctx.fillStyle='#f6e8c9';ctx.fillText('F · TALK',n.x,n.y-40)}}
 drawPerson(player);ctx.restore();
}
ensureMarket();

$('soundTitle').textContent=soundLabel();$('paper').addEventListener('click',hidePaper);
if(save.jobs>0||save.xp>0){$('startBtn').innerHTML='CONTINUE YOUR EMPIRE <b>↗</b>';$('saveNote').textContent=rank()+' · '+money(save.cash)+' · '+save.jobs+' JOBS COMPLETE'}
populate();updateObjective();requestAnimationFrame(loop);
// A read-only diagnostic snapshot makes game state inspectable during verification.
window.dryCounty={snapshot:()=>({build:'0.5-flight-b3',flight:{airPatrol:airOps.phase,airSpotted:airOps.visible,courierStage:airOps.courier?.stage??null,mounted:airBridge.mounted?.id||null,altitude:Math.round(player.air?.z||0),craft:airBridge.craft.map(c=>({id:c.id,x:Math.round(c.x),y:Math.round(c.y),z:Math.round(c.z),fuel:Math.round(c.fuel)}))},interior:interior?.place.id||null,inventory:{...save.inventory},secrets:{...save.secrets},moonshineDelivered:save.moonshineDelivered,home:JSON.parse(JSON.stringify(save.home)),mode,player:{x:Math.round(player.x),y:Math.round(player.y),hp:player.hp,vehicle:player.car?.type,ammo:player.ammo},cash:save.cash,xp:save.xp,jobs:save.jobs,heat,map:{width:WORLD,height:WORLD_H,roads:WLD.roads.length,nodes:WLD.nodes.length,buildings:buildings.length,authoredLots:buildings.filter(b=>b.authored).length},npcs:npcs.length,conversation:conversation?.npc?.name||null,lead:lead?.title||null,burning:cars.filter(c=>c.burning).length,contract:job?{type:job.type,stage:job.stage,time:Math.round(job.time),target:{x:job.target.x,y:job.target.y}}:null,cars:cars.length,enemies:enemies.filter(e=>e.hp>0).length,businesses:save.businesses,upgrades:{engine:save.engine,armor:save.armor,grip:save.grip},storageOK})};
})();
