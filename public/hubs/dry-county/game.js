'use strict';
(() => {
const $=id=>document.getElementById(id), canvas=$('game'), ctx=canvas.getContext('2d',{alpha:false});
const mini=$('minimap'), mc=mini.getContext('2d');
const SHOP=window.DryShops;
let interior=null;
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
 police:{name:'Police Pursuit',color:'#283438',max:275,accel:210,turn:2.4,hp:160,price:0}
};
const initial=()=>({v:1,cash:25,xp:0,jobs:0,weapon:0,ownedWeapons:[0],ownedCars:['sedan'],car:'sedan',engine:0,armor:0,grip:0,businesses:[],income:0,story:{},feedback:[],stats:{kills:0,distance:0,escapes:0,earnings:0,bestStreak:0,lives:0},daily:{date:'',done:0,claimed:false}});
let save=initial(), storageOK=true;
try{const raw=JSON.parse(localStorage.getItem('drycounty-save-v1'));if(raw&&raw.v===1){save={...initial(),...raw,stats:{...initial().stats,...raw.stats},daily:{...initial().daily,...raw.daily}}}}catch(e){storageOK=false}
function dailyDate(){return new Date().toLocaleDateString('en-CA')}
function refreshDaily(){if(save.daily.date!==dailyDate())save.daily={date:dailyDate(),done:0,claimed:false}}
refreshDaily();
function persist(){try{localStorage.setItem('drycounty-save-v1',JSON.stringify(save))}catch(e){if(storageOK)toast('Browser storage is unavailable. Progress will last for this session.');storageOK=false}}
let w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio||1,2),zoom=1;
function resize(){w=innerWidth;h=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;zoom=clamp(Math.min(w/1300,h/820),.62,1.05);ctx.setTransform(dpr,0,0,dpr,0,0)}
addEventListener('resize',resize);resize();
let mode='title',started=false,modal='',tabName='equipment',elapsed=0,last=0,frame=0,shake=0,flash=0,toastTimer=0,saveTimer=0,empireTimer=0,heat=0,spawnTimer=0,escapeGrace=0,combo=0,comboTimer=0,policeSeen=false;
let cars=[],enemies=[],peds=[],bullets=[],particles=[],skids=[],pickups=[],jobs=[],job=null,interaction=null;
let activeElapsed=0;
let smoke=[],debris=[],blastRings=[],npcs=[],conversation=null,lead=null,encounterTimer=28,lifeStart=0,lifeJobs=0,lifeMoney=0,deathReport=null,deathPending=false;
const player={x:places[0].x,y:places[0].y, vx:0,vy:0,a:-Math.PI/2,hp:100,car:null,ammo:weapons[save.weapon].mag,reserve:weapons[save.weapon].reserve,reload:0,shot:0,invincible:0,step:0};
const camera={x:places[0].x,y:places[0].y,lookX:0,lookY:0};
const mouse={x:w/2,y:h/2,down:false,active:false},keys={},touch={x:0,y:0,fire:false,brake:false};
const isTouch=matchMedia('(pointer:coarse)').matches || new URLSearchParams(location.search).has('touch');
const ammoPacks=weapons.map(a=>({ammo:a.mag,reserve:a.reserve}));
let audioCtx=null,soundOn=false,engineOsc=null,engineGain=null;
function enableAudio(){try{if(!audioCtx){audioCtx=new (window.AudioContext||window.webkitAudioContext)();engineOsc=audioCtx.createOscillator();engineGain=audioCtx.createGain();engineOsc.type='sawtooth';engineOsc.frequency.value=40;engineGain.gain.value=0;engineOsc.connect(engineGain);engineGain.connect(audioCtx.destination);engineOsc.start()}audioCtx.resume();soundOn=!soundOn;$('soundTitle').textContent=soundOn?'SOUND ON ●':'SOUND OFF ◯'}catch(e){soundOn=false}}
function sound(type){if(!soundOn||!audioCtx)return;try{const ac=audioCtx,t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();o.connect(g);g.connect(ac.destination);let dur=.12;switch(type){case'shot':o.type='sawtooth';o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(38,t+.1);g.gain.setValueAtTime(.07,t);break;case'cash':o.type='sine';o.frequency.setValueAtTime(520,t);o.frequency.setValueAtTime(780,t+.09);dur=.25;g.gain.setValueAtTime(.09,t);break;case'crash':o.type='triangle';o.frequency.setValueAtTime(80,t);o.frequency.exponentialRampToValueAtTime(20,t+.2);g.gain.setValueAtTime(.13,t);dur=.25;break;default:o.type='sine';o.frequency.value=380;g.gain.setValueAtTime(.04,t)}g.gain.exponentialRampToValueAtTime(.001,t+dur);o.start(t);o.stop(t+dur)}catch(e){}}
const map=document.createElement('canvas');map.width=WORLD;map.height=WORLD_H;const g=map.getContext('2d');
const buildings=[],lamps=[],trees=[],decor=[],buildingHash=new Map();
const CELL=128,cellKey=(x,y)=>Math.floor(x/CELL)+','+Math.floor(y/CELL);
function nearbyBuildings(x,y,r=40){const out=new Set();for(let ix=Math.floor((x-r)/CELL);ix<=Math.floor((x+r)/CELL);ix++)for(let iy=Math.floor((y-r)/CELL);iy<=Math.floor((y+r)/CELL);iy++)for(const b of buildingHash.get(ix+','+iy)||[])out.add(b);return out}
function addBuilding(b){buildings.push(b);for(let ix=Math.floor(b.x/CELL);ix<=Math.floor((b.x+b.w)/CELL);ix++)for(let iy=Math.floor(b.y/CELL);iy<=Math.floor((b.y+b.h)/CELL);iy++){const key=ix+','+iy;if(!buildingHash.has(key))buildingHash.set(key,[]);buildingHash.get(key).push(b)}}
function rect(x,y,bw,bh,c){g.fillStyle=c;g.fillRect(x,y,bw,bh)}
function trace(points){g.beginPath();g.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))g.lineTo(p.x,p.y)}
function makeCity(){
 rect(0,0,WORLD,WORLD_H,'#273b30');
 // Woodland and fields follow the broad land use visible in the supplied map.
 for(let i=0;i<110;i++){const x=sr(0,WORLD),y=sr(0,WORLD_H),r=sr(40,220);g.fillStyle=pickSeed(['#22382e','#304336','#344734','#2d4032']);g.beginPath();g.ellipse(x,y,r,r*sr(.5,1.4),sr(0,3),0,TAU);g.fill()}
 for(const f of [[30,30,470,680],[20,2180,680,1090],[5100,40,850,620],[4100,2370,1800,880]]){rect(...f,'#6c664827');for(let x=f[0]+5;x<f[0]+f[2];x+=11)rect(x,f[1],1,f[3],'#a08d5620')}
 g.lineCap='round';g.lineJoin='round';
 for(const r of WLD.roads){g.strokeStyle='#596152';g.lineWidth=r.width+20;trace(r.points);g.stroke()}
 for(const r of WLD.roads){g.strokeStyle=r.width>75?'#2e3838':'#333e3c';g.lineWidth=r.width;trace(r.points);g.stroke()}
 for(const r of WLD.roads){if(r.width>75){g.strokeStyle='#d4c18a66';g.lineWidth=1.7;g.setLineDash([14,23]);trace(r.points);g.stroke();g.setLineDash([])}for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],d=dist(a,b),ang=Math.atan2(b.y-a.y,b.x-a.x);for(let k=65;k<d;k+=r.width>75?170:260){const x=lerp(a.x,b.x,k/d),y=lerp(a.y,b.y,k/d),off=r.width/2+8;lamps.push({x:x-Math.sin(ang)*off,y:y+Math.cos(ang)*off})}}}
 // Rail ties, two continuous rails, and small crossing boards.
 g.strokeStyle='#171e1d';g.lineWidth=28;trace(WLD.railway);g.stroke();for(let i=1;i<WLD.railway.length;i++){const a=WLD.railway[i-1],b=WLD.railway[i],len=dist(a,b),ang=Math.atan2(b.y-a.y,b.x-a.x);for(let k=0;k<len;k+=15){const x=lerp(a.x,b.x,k/len),y=lerp(a.y,b.y,k/len);g.save();g.translate(x,y);g.rotate(ang);rect(-2,-17,4,34,'#766b50');g.restore()}}
 for(const off of [-7,7]){g.strokeStyle='#89918a';g.lineWidth=2;const pts=WLD.railway.map((p,i,a)=>{const q=a[Math.min(i+1,a.length-1)],prev=a[Math.max(i-1,0)],ang=Math.atan2(q.y-prev.y,q.x-prev.x);return{x:p.x-Math.sin(ang)*off,y:p.y+Math.cos(ang)*off}});trace(pts);g.stroke()}
 const palettes=['#626356','#5c6054','#555e57','#6a6153','#4e5b59','#695b4b'];
 for(let y=150;y<WORLD_H-100;y+=49)for(let x=120;x<WORLD-100;x+=50){const bx=x+sr(-8,8),by=y+sr(-8,8),n=WLD.nearest({x:bx,y:by});if(n.d>135||n.d<n.edge.road.width/2+20)continue;if(seeded()>.83)continue;
  const commercial=Math.abs(by-(100+358*4))<150||Math.abs(bx-(100+974*4))<100,bw=commercial?sr(40,72):sr(22,35),bh=commercial?sr(29,52):sr(22,36),b={x:bx-bw/2,y:by-bh/2,w:bw,h:bh,z:commercial?sr(22,67):sr(13,25),color:pickSeed(palettes),gable:!commercial};
  if([...nearbyBuildings(bx,by,85)].some(a=>b.x<a.x+a.w+8&&b.x+b.w>a.x-8&&b.y<a.y+a.h+8&&b.y+b.h>a.y-8))continue;
  if([[b.x,b.y],[b.x+b.w,b.y],[b.x,b.y+b.h],[b.x+b.w,b.y+b.h]].some(([cx,cy])=>{const z=WLD.nearest({x:cx,y:cy});return z.d<z.edge.road.width/2+7}))continue;
  if(places.some(p=>!p.hidden&&Math.hypot(bx-p.x,by-p.y)<220))continue;
  const railNear=WLD.railway.some((p,i,arr)=>i&&projectOnSegment({x:bx,y:by},arr[i-1],p).d<30);if(railNear)continue;
  addBuilding(b);rect(b.x+12,b.y+18,b.w+6,b.h+3,'#0a171c66');rect(b.x-3,b.y-3,b.w+6,b.h+6,'#27372f');rect(b.x,b.y,b.w,b.h,b.color);
 }
 // Every fictional establishment is attached to a reachable real road.
 for(const p of places){if(p.type==='phone'||p.hidden)continue;const n=WLD.nearest(p);let chosen=null;
  for(const [bw,bh] of [[92,60],[66,44],[36,26],[26,20]]){for(const shift of [0,80,-80,130,-130,45,-45,200,-200]){for(const side of [1,-1]){
   const off=(n.edge.road.width/2+Math.abs(Math.sin(n.angle))*bw/2+Math.abs(Math.cos(n.angle))*bh/2+9)*side,x=n.x+Math.cos(n.angle)*shift-Math.sin(n.angle)*off,y=n.y+Math.sin(n.angle)*shift+Math.cos(n.angle)*off;
   const b={x:x-bw/2,y:y-bh/2,w:bw,h:bh,z:p.type==='club'?58:34,color:p.type==='garage'?'#56685b':'#5b5d54',landmark:p.name,placeId:p.id};
   if([...nearbyBuildings(x,y,110)].some(a=>b.x<a.x+a.w+5&&b.x+b.w>a.x-5&&b.y<a.y+a.h+5&&b.y+b.h>a.y-5))continue;
   let clear=true;for(let tx=0;tx<=bw;tx+=bw/4)for(let ty=0;ty<=bh;ty+=bh/4){const q=WLD.nearest({x:b.x+tx,y:b.y+ty});if(q.d<q.edge.road.width/2+8)clear=false}
   if(!clear)continue;chosen={b,x,y};break
  }if(chosen)break}if(chosen)break}
  if(chosen){const {b,x,y}=chosen;addBuilding(b);p.building=b;const nearest=WLD.nearest({x,y});p.x=nearest.x;p.y=nearest.y;
   const dx=p.x-x,dy=p.y-y,t=Math.min(b.w/2/(Math.abs(dx)||.001),b.h/2/(Math.abs(dy)||.001));p.door={x:x+dx*t,y:y+dy*t};
   rect(b.x+15,b.y+22,b.w,b.h,'#07131977');rect(b.x,b.y,b.w,b.h,b.color)}
 }
 for(const p of places.filter(p=>p.hidden)){const front=places.find(f=>f.id===p.front);p.x=front.x;p.y=front.y}

 for(let i=0;i<2100;i++){const p={x:sr(40,WORLD-40),y:sr(40,WORLD_H-40)},n=WLD.nearest(p);if(n.d>80&&![...nearbyBuildings(p.x,p.y,18)].some(b=>p.x>b.x-13&&p.x<b.x+b.w+13&&p.y>b.y-13&&p.y<b.y+b.h+13)){trees.push({...p,r:sr(7,18),z:sr(12,28)})}}
 g.font='bold 12px Arial';g.textAlign='center';for(const r of WLD.roads.filter(r=>r.width>75)){const a=r.points[0],b=r.points[r.points.length-1],ang=Math.atan2(b.y-a.y,b.x-a.x);for(const t of [.25,.67]){g.save();g.translate(lerp(a.x,b.x,t),lerp(a.y,b.y,t));g.rotate(ang);g.fillStyle='#dfd3ad70';g.fillText(r.name,0,-r.width/2+17);g.restore()}}
 g.textAlign='left';
}
function projectOnSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy),0,1);return{x:a.x+dx*t,y:a.y+dy*t,d:Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t)}}
function pickSeed(a){return a[Math.floor(seeded()*a.length)]}makeCity();
function blocked(x,y,r=10){if(interior)return roomBlocked(x,y,r);if(x<45+r||y<45+r||x>WORLD-45-r||y>WORLD_H-45-r)return true;for(const b of nearbyBuildings(x,y,r+5)){if(x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h)return true}return false}
function lineClear(a,b){const d=dist(a,b),n=Math.ceil(d/20);for(let i=1;i<n;i++)if(blocked(lerp(a.x,b.x,i/n),lerp(a.y,b.y,i/n),2))return false;return true}
function moveBody(o,dx,dy,r){let ok=true;const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/7));for(let i=0;i<steps;i++){if(!blocked(o.x+dx/steps,o.y,r))o.x+=dx/steps;else ok=false;if(!blocked(o.x,o.y+dy/steps,r))o.y+=dy/steps;else ok=false}return ok}
function intersection(o){return WLD.nodes.reduce((a,b)=>dist(o,a)<dist(o,b)?a:b)}
function roadRoute(a,b){return WLD.route(a,b)}
function roadside(p,off=0){const n=WLD.nearest(p);return{x:n.x-Math.sin(n.angle)*off,y:n.y+Math.cos(n.angle)*off,a:n.angle}}

function newCar(type,x,y,a=-Math.PI/2,opts={}){const t=carTypes[type];return{type,x,y,a,v:0,hp:t.hp,maxHp:t.hp,color:t.color,ai:'parked',route:[],routeTime:0,fire:rand(1,3),turn:0,vx:0,vy:0,steering:0,throttle:0,yaw:0,burning:false,burnTime:0,impact:0,dead:false,hit:0,...opts}}
function spawnOwned(){const p=places[0],old=player.car;if(old){old.owned=false;old.ai='parked';old.v=old.vx=old.vy=0}const at=roadside({x:p.x-70,y:p.y},-19),c=newCar(save.car,at.x,at.y,at.a,{owned:true});c.maxHp=carTypes[c.type].hp*(1+save.armor*.25);c.hp=c.maxHp;cars.push(c);player.car=c;player.x=c.x;player.y=c.y;player.vx=player.vy=0;return c}
function populate(){cars=[];peds=[];enemies=[];bullets=[];particles=[];pickups=[];skids=[];smoke=[];debris=[];blastRings=[];
 for(let i=0;i<31;i++){const edge=pick(WLD.driveEdges.filter(e=>e.d>90)),t=rand(.12,.88),dir=Math.random()>.5?1:-1,a=Math.atan2(edge.b.y-edge.a.y,edge.b.x-edge.a.x)+(dir<0?Math.PI:0),c=newCar(pick(['sedan','sedan','coupe','truck']),lerp(edge.a.x,edge.b.x,t)-Math.sin(a)*15,lerp(edge.a.y,edge.b.y,t)+Math.cos(a)*15,a,{ai:'traffic',speed:rand(50,88),color:pick(['#73674b','#56666a','#835f4c','#374e50','#777963','#485361','#695555'])});c.route=[];cars.push(c)}
 for(let i=0;i<12;i++){const edge=pick(WLD.edges.filter(e=>e.d>150)),at=roadside({x:lerp(edge.a.x,edge.b.x,.45),y:lerp(edge.a.y,edge.b.y,.45)},edge.road.width/2-12);if(!blocked(at.x,at.y,18))cars.push(newCar(pick(['sedan','coupe']),at.x,at.y,at.a,{color:pick(['#61694e','#84674e','#596368'])}))}
 for(let i=0;i<48;i++){const edge=pick(WLD.edges.filter(e=>e.d>75)),t=rand(.1,.9),a=Math.atan2(edge.b.y-edge.a.y,edge.b.x-edge.a.x),off=(edge.road.width/2+9)*pick([-1,1]);const p={x:lerp(edge.a.x,edge.b.x,t)-Math.sin(a)*off,y:lerp(edge.a.y,edge.b.y,t)+Math.cos(a)*off,a,edge,t,dir:pick([-1,1]),off,speed:rand(13,23),color:pick(['#6f7260','#7b6b59','#40565a','#7f8070']),panic:0};if(!blocked(p.x,p.y,8))peds.push(p)}
 spawnOwned();setupNPCs();
}

function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');toastTimer=4.5}
function particle(x,y,color,count=8,speed=60){for(let i=0;i<count;i++){const a=rand(0,TAU),v=rand(speed*.3,speed);particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rand(.25,.65),max:.65,color,size:rand(1,3)})}}
function addHeat(amount){const before=heat;heat=clamp(heat+amount,0,100);escapeGrace=10;if(heat>=20&&before<20)toast('The police are looking for you. Break their line of sight.');}
function rank(){return ['SMALL TIMER','RUNNER','ENFORCER','CAPOREGIME','UNDERBOSS','THE DON'][Math.min(5,Math.floor(save.xp/350))]}
function startGame(){if(interior)leaveBusiness(true);$('crosshair').style.left=w/2+'px';$('crosshair').style.top=h/2+'px';started=true;lifeStart=activeElapsed;lifeJobs=save.jobs;lifeMoney=save.stats.earnings;mode='play';modal='';$('overlay').classList.add('hidden');$('titleScreen').classList.add('hidden');$('panel').classList.add('hidden');for(const id of ['hud','mission','area','bottomhud','minimapWrap'])$(id).classList.remove('hidden');if(isTouch)$('mobile').classList.remove('hidden');else $('crosshair').classList.remove('hidden');populate();camera.x=player.x;camera.y=player.y;generateJobs();if(!save.jobs)acceptJob(jobs[0]);else toast('Welcome back. Enter opens contracts. Tab opens your empire.');updateHUD(true);persist()}
function showPanel(kind){if(deathReport)return;if(!started&&kind!=='help')return;modal=kind;mode='pause';mouse.down=false;touch.fire=false;for(const k in keys)keys[k]=false;$('overlay').classList.remove('hidden');$('titleScreen').classList.add('hidden');$('panel').classList.remove('hidden');$('crosshair').classList.add('hidden');renderPanel()}
function closePanel(){if(deathReport)return;if(!started){modal='';mode='title';$('panel').classList.add('hidden');$('titleScreen').classList.remove('hidden');return}modal='';mode='play';$('overlay').classList.add('hidden');$('panel').classList.add('hidden');if(!isTouch&&!interior)$('crosshair').classList.remove('hidden')}
function panelHead(eyebrow,title){return `<div class="panel-top"><span class="eyebrow">${eyebrow}</span><button class="close" data-do="close" aria-label="Close panel">×</button></div><h2>${title}</h2>`}
function generateJobs(){const level=Math.floor(save.jobs/3);jobs=[
 {type:'bootleg',title:pick(['A Thirsty City','The Midnight Shipment','Last Call','Dry Law, Wet Streets']),desc:'Collect liquor at the woodland still. Deliver it to two speakeasies before the clock runs out.',pay:18+level*2,xp:100,difficulty:'BOOTLEGGING',duration:200},
 {type:'rival',title:pick(['Unfinished Business','A Message for Moretti','The Other Family']),desc:'A rival crew has occupied a corner. Clear the crew, take their ledger, and bring it home.',pay:24+level*3,xp:140,difficulty:'CREW WAR',duration:240},
 {type:'wheelman',title:pick(['Borrowed Luxury','A Car for the Boss','The Long Way Home']),desc:'Lift a marked luxury coupe and return it to Bell & Sons. The police will have questions.',pay:21+level*2,xp:120,difficulty:'GETAWAY DRIVER',duration:180}
];const discovered=SHOP.secrets.filter(s=>save.secrets[s.club]==='found');if(discovered.length<2)jobs[0]=localJob(SHOP.errands[0]);for(const e of SHOP.errands){if(e.reveal){const s=SHOP.secrets.find(s=>s.club===e.reveal);if(save.secrets[e.reveal]==='found'||save.jobs<s.jobs-1)continue}jobs.push(localJob(e))}
}
function localJob(e){return{type:'errand',errandId:e.id,title:e.title,desc:e.description,pay:e.pay,xp:e.xp,difficulty:e.reveal?'SPEAKEASY CLUE':'LOCAL DELIVERY',duration:420}}
function acceptJob(j){if(!j)return;if(j.type==='bootleg'&&SHOP.secrets.filter(s=>save.secrets[s.club]==='found').length<2){toast('Discover two speakeasies before taking this supply run.');return}if(job){toast('Finish or abandon your current job first.');return}closePanel();const clubs=places.filter(p=>p.type==='club'&&(!p.hidden||save.secrets[p.id]==='found')).sort(()=>Math.random()-.5);job={...j,stage:0,time:j.duration,targets:[],kills:0,delivery:0};
 if(j.type==='errand'){const e=errandDefinition(j.errandId);job.stops=e.stops.map(id=>places.find(p=>p.id===id));job.target=job.stops[0];job.info='Go inside '+job.target.name+' and speak to the person at the counter to collect '+e.cargo+'.';toast('LOCAL JOB · Speak at each counter. Your sealed cargo is supplied free.');}
 if(j.type==='bootleg'){const buyers=clubs.filter(p=>p.hidden);job.stops=[places[1],buyers[0],buyers[1]];job.target=job.stops[0];job.info='Go inside the woodland still and speak to Mabel to collect two sealed moonshine crates.';toast('First, pick up the liquor. Follow the gold route.');}
 if(j.type==='rival'){let site=pick(places.filter(p=>p.type==='club'));job.target=site;job.info='Clear the rival crew. Fire with the mouse; use cover and keep moving.';const count=4+Math.min(3,Math.floor(save.jobs/4));for(let i=0;i<count;i++){const a=i*TAU/count;let e={x:site.x+Math.cos(a)*rand(55,105),y:site.y+Math.sin(a)*rand(55,105),a:0,hp:75,maxHp:75,fire:rand(1,3),hit:0,job:true};if(blocked(e.x,e.y,9)){e.x=site.x+rand(-42,42);e.y=site.y+rand(-42,42)}enemies.push(e);job.targets.push(e)}toast('A rival crew is waiting. Take cover behind buildings.');}
 if(j.type==='wheelman'){const p=pick(places.filter(p=>p.type==='club'));const at=roadside(p,25),c=newCar('coupe',at.x,at.y,at.a,{mission:true,color:'#b8985b'});cars.push(c);job.car=c;job.target=c;job.info='Reach the marked coupe. Press E beside it to get in.';toast('Find the gold coupe. Bring it back in one piece.');}
 updateObjective();sound('cash')
}
function updateObjective(){if(!job){$('jobtag').textContent='THE NIGHT IS YOURS';$('jobtitle').textContent='Build your reputation';$('jobdesc').textContent='Enter: local jobs and clues. Visit businesses, find concealed doors, deliver moonshine, buy a car and build your home.';$('jobprogress').textContent='CONTRACTS · UPGRADES · OWN THE CITY';return}
 $('jobtag').textContent=job.difficulty+' · '+money(job.pay);$('jobtitle').textContent=job.title;$('jobdesc').textContent=job.info;
}
function completeJob(){if(!job)return;const completed=job;combo++;comboTimer=180;save.stats.bestStreak=Math.max(save.stats.bestStreak,combo);const bonus=Math.min(5,combo-1)*.1;const pay=SHOP.round(completed.pay*(1+bonus));save.cash=SHOP.round(save.cash+pay);save.stats.earnings=SHOP.round(save.stats.earnings+pay);save.xp+=completed.xp;save.jobs++;refreshDaily();save.daily.done++;job=null;enemies=enemies.filter(e=>!e.job);for(const c of cars)c.mission=false;player.reserve=Math.max(player.reserve,weapons[save.weapon].reserve);player.hp=Math.min(100,player.hp+25);sound('cash');toast('JOB COMPLETE · '+money(pay)+(bonus>0?' · '+Math.round(bonus*100)+'% streak bonus':''));generateJobs();updateObjective();persist();}
function failJob(reason){if(!job)return;job=null;enemies=enemies.filter(e=>!e.job);for(const c of cars)c.mission=false;combo=0;toast(reason+' · New contracts are available.');updateObjective();generateJobs()}
function renderPanel(){if(modal==='shop'){renderShop();return}if(modal==='home'){renderHome();return}if(modal==='dealership'){renderDealership();return}const p=$('panel');let html='';
 if(modal==='help'){
 html=panelHead('WELCOME TO MT. MORRIS','Your first night in the city');html+='<p>Prohibition banned making and selling alcoholic drinks and gave criminal gangs a lucrative market. This map follows modern Mt. Morris roads; the 1926 people, businesses and events are fictional. Here, you start with a borrowed sedan and $1.25. Run liquor, steal cars, and take on rival crews. Jobs earn cash and reputation. Buy better equipment and acquire speakeasies to fund your rise.</p><div class="help-grid"><div><kbd>WASD / ARROWS</kbd>Move. In a car: W accelerates, S brakes / reverses, A / D steer.</div><div><kbd>E</kbd>Enter / exit the nearest car. Walk into businesses on foot. Inside: F talks at counters, E uses exits and concealed doors. F talks to people with a speech bubble.</div><div><kbd>MOUSE</kbd>Aim and hold click to shoot. You can fire from a car.</div><div><kbd>SPACE</kbd>Handbrake. Make sharp turns and leave skid marks.</div><div><kbd>R</kbd>Reload. 1 / 2 / 3 switches owned weapons.</div><div><kbd>ENTER / TAB</kbd>Contracts / empire, upgrades and businesses.</div><div><kbd>M</kbd>City map. Gold is your objective; red is the law.</div><div><kbd>ESC / P</kbd>Pause. Your purchases and progress save automatically.</div></div><p>Lose the police by breaking line of sight behind city blocks. The green back room helps you recover. For local jobs and moonshine runs, go inside the marked business and speak at the counter. Explore shop backs for concealed speakeasy doors. Cars can be stolen, damaged and destroyed. A wrecked car is not the end: get out and find another.</p><p>On a phone, use the left stick to move or steer; FIRE aims at the closest visible rival or officer. Rotate to landscape for a wider view.</p><button class="primary" data-do="close">'+(started?'BACK TO THE CITY':'GOT IT')+' <b>↗</b></button>';
 }else if(modal==='jobs'){
 html=panelHead('THE PAYPHONE NETWORK','Work after dark');html+='<p>Word gets around. Take a contract and follow the gold marker. Complete consecutive jobs for up to a 50% payout bonus.</p>';
 if(job)html+=`<div class="card"><small>ACTIVE CONTRACT · ${Math.ceil(job.time)} SECONDS LEFT</small><h3>${job.title}</h3><p>${job.info}</p><footer><button data-do="close">CONTINUE JOB →</button><button data-do="abandon">ABANDON JOB</button></footer></div>`;
 else html+='<div class="cards">'+jobs.map((j,i)=>`<article class="card"><small>${j.difficulty}</small><h3>${j.title}</h3><p>${j.desc}</p><footer><span class="money">${money(j.pay)}</span><button data-do="job" data-i="${i}">TAKE JOB →</button></footer></article>`).join('')+'</div>';
 html+=progressionHTML();html+=`<div class="panel-footer"><span>STREAK ${combo} · ${rank()} · ${save.xp} REPUTATION</span><span>YOUR CUT: ${money(save.cash)}</span></div>`;
 }else if(modal==='empire'){
 refreshDaily();html=panelHead('MONEY TALKS · '+money(save.cash),'A bigger piece of the city');html+=`<div class="tabs"><button data-do="tab" data-tab="equipment" class="${tabName==='equipment'?'active':''}">ARSENAL</button><button data-do="tab" data-tab="garage" class="${tabName==='garage'?'active':''}">GARAGE</button><button data-do="tab" data-tab="business" class="${tabName==='business'?'active':''}">EMPIRE</button></div><div class="cards">`;
 if(tabName==='equipment'){
  html+=weapons.map((a,i)=>`<article class="card"><small>${i===0?'TRUSTY SIDEARM':i===1?'CLOSE QUARTERS':'THE CHICAGO TYPEWRITER'}</small><h3>${a.name}</h3><p>${i===0?'An eight-round .45. Reliable, accurate, and yours from the start.':i===1?'Two barrels. Seven pellets per shot. Devastating at close range.':'Thirty rounds. Fully automatic. The preferred punctuation of organized crime.'}</p><footer><span class="money">${save.ownedWeapons.includes(i)?'OWNED':money(a.price)}</span><button data-do="weapon" data-i="${i}" ${save.weapon===i?'disabled':''}>${save.weapon===i?'EQUIPPED':save.ownedWeapons.includes(i)?'EQUIP':'BUY & EQUIP'}</button></footer></article>`).join('');
  html+=`<article class="card"><small>BACK-ROOM SUPPLIES</small><h3>Fresh start</h3><p>Refill your ammunition, patch up your injuries, and repair your current vehicle.</p><footer><span class="money">$4.50</span><button data-do="resupply">RESUPPLY</button></footer></article>`;
 }
 if(tabName==='garage'){
  html+='<p>Buy or recall vehicles in person at Cole Motor Company (A on your map).</p>';
  html+=['sedan','coupe','truck','custom'].map((id,i)=>{const a=carTypes[id];return `<article class="card"><small>${['YOUR FIRST SET OF WHEELS','SPEED & HANDLING','HEAVY ARMOR','THE BOSS\'S GETAWAY'][i]}</small><h3>${a.name}</h3><p>${Math.round(a.max*.21)} mph · ${a.hp} armor. ${['A dependable sedan. Enough room for liquor and a little ambition.','A lighter, faster chassis for precision getaways.','Tough delivery truck. Trades speed for serious durability.','Supercharged straight-eight. Fast, strong, and built to disappear.'][i]}</p><footer><span class="money">${save.ownedCars.includes(id)?'OWNED':money(a.price)}</span><button data-do="car" data-car="${id}">${save.ownedCars.includes(id)?'DISPATCH':'BUY & DISPATCH'}</button></footer></article>`}).join('');
  for(const [id,title,desc] of [['engine','Engine tuning','15% more top speed and acceleration per level.'],['armor','Reinforced body','25% more vehicle durability per level.'],['grip','Performance tires','Better steering and faster recovery from a drift.']])html+=`<article class="card"><small>ALL OWNED CARS · LEVEL ${save[id]} / 3</small><h3>${title}</h3><p>${desc}</p><footer><span class="money">${save[id]>=3?'MAX':money(30+save[id]*30)}</span><button data-do="upgrade" data-up="${id}" ${save[id]>=3?'disabled':''}>UPGRADE</button></footer></article>`;
 }
 if(tabName==='business'){
 const biz=[['velvet','The Velvet Room',90,6,'A discreet cocktail room in downtown Mt. Morris.'],['blue','Blue Lantern',160,11,'A jazz club with a healthy thirst in the south.'],['lucky','Lucky Seven',260,18.50,'The high rollers pay handsomely for a drink.']];
 html+='<p>Discover speakeasies through concealed doors before buying a share in them. Ask at shop counters or take a clue job.</p>';
 html+=biz.filter(([id])=>save.secrets[id]==='found').map(([id,title,price,income,desc])=>`<article class="card"><small>${save.businesses.includes(id)?'PART OF YOUR EMPIRE':'ACQUIRE A SPEAKEASY'}</small><h3>${title}</h3><p>${desc} Generates ${money(income)} every two minutes of active play.</p><footer><span class="money">${save.businesses.includes(id)?'OWNED':money(price)}</span><button data-do="business" data-biz="${id}" ${save.businesses.includes(id)?'disabled':''}>${save.businesses.includes(id)?'IN BUSINESS':'ACQUIRE'}</button></footer></article>`).join('');
 html+=`<article class="card"><small>YOUR BUSINESS PROCEEDS</small><h3>The evening take</h3><p>Collect income from your speakeasies. Earnings accumulate while you play and survive between sessions.</p><footer><span class="money">${money(save.income)}</span><button data-do="collect" ${save.income<1?'disabled':''}>COLLECT</button></footer></article><article class="card"><small>DAILY CONTRACT BONUS · ${Math.min(save.daily.done,3)} / 3</small><h3>Three before sunrise</h3><p>Complete three contracts today. Claim a $25 bonus, once per day, on this browser.</p><footer><span class="money">$25.00</span><button data-do="daily" ${save.daily.done<3||save.daily.claimed?'disabled':''}>${save.daily.claimed?'CLAIMED':'CLAIM BONUS'}</button></footer></article>`;
 }
 html+=`</div><div class="panel-footer"><span>${save.jobs} JOBS COMPLETE · ${save.xp} REPUTATION · ${rank()}</span><span>${storageOK?'PROGRESS SAVED ON THIS BROWSER':'SESSION PROGRESS ONLY'}</span></div>`;
 }else if(modal==='map'){
 html=panelHead('KNOW YOUR STREETS','Mt. Morris');html+='<canvas id="fullmap" class="mapcanvas" width="620" height="341"></canvas><div class="legend"><span style="color:#d5ae62">◆ Current objective</span><span style="color:#85b79f">G Garage · S Back room</span><span style="color:#cc6a58">● Police / rival</span><span>▲ You</span></div>';
 }else{
 html=panelHead('A MOMENT IN THE BACK ROOM','The city can wait.');html+=`<div class="statsgrid"><div><strong>${money(save.cash)}</strong><small>CASH ON HAND</small></div><div><strong>${save.jobs}</strong><small>JOBS COMPLETE</small></div><div><strong>${save.stats.bestStreak}</strong><small>BEST STREAK</small></div></div><p>${rank()} · ${save.xp} reputation. ${save.businesses.length} speakeasies. ${storageOK?'Your cash, upgrades and empire are saved on this browser. Active jobs and police heat reset when you reopen the game.':'Browser storage is unavailable; keep this tab open to preserve this session.'}</p><div class="titleactions"><button class="primary" data-do="close">BACK TO THE CITY <b>↗</b></button><button class="secondary" data-do="help">CONTROLS & HOW TO PLAY</button><button class="textbtn" data-do="sound">${soundOn?'SOUND ON ●':'SOUND OFF ◯'} — TOGGLE</button><button class="secondary" data-do="end-run">END THIS RUN & GIVE FEEDBACK</button><button class="textbtn" data-do="reset">START A NEW EMPIRE</button></div>`;
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
 case'close':closePanel();return;case'help':showPanel('help');return;case'sound':enableAudio();renderPanel();return;case'job':acceptJob(jobs[i]);return;case'abandon':failJob('Contract abandoned');renderPanel();return;case'tab':tabName=b.dataset.tab;renderPanel();return;
 case'weapon':if(save.ownedWeapons.includes(i)||spend(weapons[i].price)){if(!save.ownedWeapons.includes(i))save.ownedWeapons.push(i);equipWeapon(i);toast(weapons[i].name+' equipped.')}break;
 case'resupply':if(spend(4.50)){player.hp=100;player.ammo=weapons[save.weapon].mag;player.reserve=weapons[save.weapon].reserve;player.reload=0;if(player.car)player.car.hp=player.car.maxHp;toast('Patched up. Ammunition stocked. Car repaired.')}break;
 case'car':toast('Visit Cole Motor Company to buy or recall a car. Find A on the map.');return;
 case'upgrade':{const id=b.dataset.up;if(save[id]<3&&spend(30+save[id]*30)){save[id]++;if(id==='armor'&&player.car&&player.car.owned){const c=player.car;c.maxHp=carTypes[c.type].hp*(1+save.armor*.25);c.hp=c.maxHp}toast('Upgrade installed across your garage.')}}break;
 case'business':{const data={velvet:[90,6],blue:[160,11],lucky:[260,18.50]},id=b.dataset.biz;if(data[id]&&save.secrets[id]==='found'&&!save.businesses.includes(id)&&spend(data[id][0])){save.businesses.push(id);toast('Speakeasy acquired. Your empire is growing.')}}break;
 case'collect':if(save.income>0){save.cash+=save.income;save.stats.earnings+=save.income;toast(money(save.income)+' collected.');save.income=0;sound('cash')}break;
 case'daily':if(save.daily.done>=3&&!save.daily.claimed){save.cash=SHOP.round(save.cash+25);save.daily.claimed=true;toast('Daily bonus collected · $25.00');sound('cash')}break;
 case'end-run':closePanel();player.invincible=0;damagePlayer(9999,'Run ended by player');return;case'reset':pConfirm();return;
 case'reset-confirm':if(interior)leaveBusiness(true);save=initial();ensureMarket();refreshDaily();persist();heat=0;job=null;combo=0;player.hp=100;player.ammo=8;player.reserve=64;player.reload=0;for(let i=0;i<weapons.length;i++)ammoPacks[i]={ammo:weapons[i].mag,reserve:weapons[i].reserve};populate();generateJobs();closePanel();acceptJob(jobs[0]);return;
 }persist();renderPanel()
});
function pConfirm(){$('panel').innerHTML=panelHead('START OVER','Leave your empire behind?')+'<p>This erases your money, upgrades, records and businesses in this browser. This cannot be undone.</p><div class="titleactions"><button class="secondary" data-do="reset-confirm">ERASE PROGRESS & START OVER</button><button class="primary" data-do="close">KEEP MY EMPIRE</button></div>'}
function equipWeapon(i){if(!save.ownedWeapons.includes(i)||i===save.weapon)return;ammoPacks[save.weapon]={ammo:player.ammo,reserve:player.reserve};save.weapon=i;player.ammo=ammoPacks[i].ammo;player.reserve=ammoPacks[i].reserve;player.reload=0;persist()}
function reload(){if(player.reload||player.ammo===weapons[save.weapon].mag||player.reserve<=0)return;player.reload=weapons[save.weapon].reload;sound('tick')}
function nearestCar(){if(interior)return null;let c=null,best=68;for(const x of cars)if(!x.dead&&!x.burning&&x!==player.car&&Math.abs(x.v)<85){let d=dist(player,x);if(d<best){best=d;c=x}}return c}
function nearestPlace(){if(interior)return null;const d=p=>Math.min(dist(player,p),p.door?dist(player,p.door):Infinity);return places.filter(p=>!p.hidden).sort((a,b)=>d(a)-d(b)).find(p=>d(p)<85)}
function interact(){if(mode!=='play')return;
 if(interior){if(trySecretDoor())return;if(dist(player,{x:360,y:437})<65){leaveBusiness();return}if(nearestNPC()){talkNearby();return}toast('F talks at the counter. E leaves at the bottom exit.');return}
 const near=player.car?.burning?null:nearestPlace();if(!player.car&&near&&shopById(near.id)&&(!nearestCar()||dist(player,nearestCar())>38)){enterBusiness(near);return}if(near?.type==='phone'){showPanel('jobs');return}
 if(player.car){const c=player.car;if(Math.abs(c.v)>125&&!c.burning){toast('Slow down before getting out.');return}const sides=[c.a+Math.PI/2,c.a-Math.PI/2,c.a+Math.PI,c.a];let pos=null;for(const a of sides){const x=c.x+Math.cos(a)*43,y=c.y+Math.sin(a)*43;if(!blocked(x,y,10)){pos={x,y};break}}if(!pos){toast('The door is blocked. Move the car.');return}player.car=null;player.x=pos.x;player.y=pos.y;player.a=c.a;c.v*=.3;c.ai='parked';toast('On foot. Aim with the mouse. Hold click to shoot.');return}
 const c=nearestCar();if(c){if(c.type==='police')addHeat(25);else if(c.ai==='traffic')addHeat(9);player.car=c;c.ai='player';player.x=c.x;player.y=c.y;sound('tick');if(job&&job.type==='wheelman'&&c===job.car&&job.stage===0){job.stage=1;job.target=places[0];job.info='Return the coupe to Bell & Sons garage. Shake the police on the way.';addHeat(38);updateObjective();toast('The coupe is yours. Take it to the garage.')}}}
function fire(){if(interior)return;const weap=weapons[save.weapon];if(player.shot>0||player.reload>0)return;if(player.ammo<1){reload();return}player.ammo--;player.shot=weap.rate;let a=player.a;if(!isTouch&&mouse.active){a=Math.atan2((mouse.y-h/2)/zoom+camera.y-player.y,(mouse.x-w/2)/zoom+camera.x-player.x)}else{const targets=enemies.filter(e=>e.hp>0).concat(cars.filter(c=>c.ai==='police'&&!c.dead));const t=targets.filter(e=>dist(player,e)<650&&lineClear(player,e)).sort((a,b)=>dist(player,a)-dist(player,b))[0];if(t)a=Math.atan2(t.y-player.y,t.x-player.x)}
 player.a=a;for(let i=0;i<weap.bullets;i++){const ang=a+rand(-weap.spread,weap.spread);bullets.push({x:player.x+Math.cos(a)*26,y:player.y+Math.sin(a)*26,vx:Math.cos(ang)*850,vy:Math.sin(ang)*850,life:.8,damage:weap.damage,from:'player',lastX:player.x,lastY:player.y})}particle(player.x+Math.cos(a)*28,player.y+Math.sin(a)*28,'#efca77',5,55);shake=Math.max(shake,1.4);sound('shot');addHeat(.8);for(const p of peds)if(dist(p,player)<220)p.panic=5}
function enemyFire(e,from='enemy'){const a=Math.atan2(player.y-e.y,player.x-e.x)+rand(-.12,.12);bullets.push({x:e.x+Math.cos(a)*22,y:e.y+Math.sin(a)*22,vx:Math.cos(a)*480,vy:Math.sin(a)*480,life:1,damage:from==='police'?7:10,from,lastX:e.x,lastY:e.y});particle(e.x+Math.cos(a)*24,e.y+Math.sin(a)*24,'#e6c47a',3,35)}
function damagePlayer(amount,reason='Gunfire'){if(deathPending||deathReport||player.invincible>0)return;player.hp-=amount;flash=.2;shake=Math.max(shake,2);if(player.hp<=0){deathPending=true;endLife(reason)}}
function recover(){if(interior)leaveBusiness(true);const loss=Math.min(save.cash,Math.max(3.50,SHOP.round(save.cash*.12)));save.cash=SHOP.round(save.cash-loss);player.hp=100;player.invincible=5;heat=0;combo=0;deathPending=false;if(job)failJob('The job went sideways');for(const c of cars.filter(c=>c.ai==='police'))c.remove=true;spawnOwned();camera.x=player.x;camera.y=player.y;camera.lookX=camera.lookY=0;lifeStart=activeElapsed;lifeJobs=save.jobs;lifeMoney=save.stats.earnings;toast('PATCHED UP · '+money(loss)+' hospital bill. Your empire is still yours.');persist()}
function wreck(c){if(c.dead||c.burning)return;c.hp=0;c.burning=true;c.burnTime=3.2;c.throttle=0;particle(c.x,c.y,'#d1b18a',12,80);if(c===player.car)toast('ENGINE FIRE · Three seconds. Get out with E!');if(job&&job.car===c)failJob('The marked coupe was wrecked')}
function explodeCar(c){if(c.dead)return;const wasPlayer=c===player.car;c.dead=true;c.burning=false;c.v=c.vx=c.vy=0;shake=Math.max(shake,wasPlayer?10:5);sound('crash');particle(c.x,c.y,'#e9b55c',42,200);blastRings.push({x:c.x,y:c.y,life:.65});for(let i=0;i<17;i++){const a=rand(0,TAU),v=rand(50,180);debris.push({x:c.x,y:c.y,z:12,vx:Math.cos(a)*v,vy:Math.sin(a)*v,vz:rand(95,210),a:rand(0,TAU),spin:rand(-8,8),life:3.8,size:rand(3,9),color:pick(['#879083','#403d32','#b08b56','#242f30'])})}for(let i=0;i<18;i++)emitSmoke(c,true);
 if(wasPlayer){player.car=null;player.invincible=0;damagePlayer(140,'Vehicle explosion')}else if(dist(c,player)<105){damagePlayer(Math.max(0,95-dist(c,player))*.8,'Caught in an explosion')}
 if(c.ai==='police'){addHeat(12);save.xp+=8;pickups.push({x:c.x+15,y:c.y,type:'cash',amount:40,life:60})}
}
function emitSmoke(c,heavy=false){smoke.push({x:c.x+Math.cos(c.a)*16+rand(-5,5),y:c.y+Math.sin(c.a)*16+rand(-5,5),z:heavy?15:5,vx:rand(-10,10),vy:rand(-5,5),vz:rand(18,36),r:heavy?rand(15,24):rand(7,12),life:heavy?3.5:2.5,max:heavy?3.5:2.5,dark:c.burning||heavy})}
function drive(c,dt,acc,steer,brake){if(c.dead)return;const t=carTypes[c.type],eng=c.owned?save.engine:0,grip=c.owned?save.grip:0,top=t.max*(1+eng*.15);c.impact=Math.max(0,(c.impact||0)-dt);c.steering=lerp(c.steering||0,steer,1-Math.exp(-dt*9));c.throttle=lerp(c.throttle||0,c.burning?0:acc,1-Math.exp(-dt*7));let forward=(c.vx||0)*Math.cos(c.a)+(c.vy||0)*Math.sin(c.a),lateral=-(c.vx||0)*Math.sin(c.a)+(c.vy||0)*Math.cos(c.a);if(Math.abs(c.v-forward)>40){forward=c.v;lateral=0}
 const throttle=c.throttle;if(throttle<-.1&&forward>8)forward-=330*Math.abs(throttle)*dt;else if(throttle>.1&&forward<-8)forward+=290*throttle*dt;else forward+=throttle*t.accel*(1+eng*.15)*dt;forward*=Math.exp(-dt*(Math.abs(throttle)<.1?.7:.12));if(brake)forward*=Math.exp(-dt*3.3);forward=clamp(forward,-top*.32,top);if(Math.abs(forward)<.35&&Math.abs(throttle)<.1)forward=0;
 const desiredYaw=c.steering*t.turn*clamp(Math.abs(forward)/75,0,1)/(1+Math.abs(forward)/380)*(forward>=0?1:-1)*(brake?1.35:1);c.yaw=lerp(c.yaw||0,desiredYaw,1-Math.exp(-dt*8));c.a=norm(c.a+c.yaw*dt);lateral*=Math.exp(-dt*(brake?2.2:10+grip*3));c.vx=Math.cos(c.a)*forward-Math.sin(c.a)*lateral;c.vy=Math.sin(c.a)*forward+Math.cos(c.a)*lateral;
 const hull=(x,y)=>{for(const off of [-17,0,18])if(blocked(x+Math.cos(c.a)*off,y+Math.sin(c.a)*off,12))return true;return false};const n=Math.max(1,Math.ceil(Math.hypot(c.vx,c.vy)*dt/6));let impact=false;for(let i=0;i<n;i++){const dx=c.vx*dt/n,dy=c.vy*dt/n;if(!hull(c.x+dx,c.y+dy)){c.x+=dx;c.y+=dy}else{impact=true;if(!hull(c.x+dx,c.y)){c.x+=dx;c.vy*=.15;c.vx*=.78}else if(!hull(c.x,c.y+dy)){c.y+=dy;c.vx*=.15;c.vy*=.78}else{c.vx*= -.08;c.vy*= -.08}break}}
 if(impact&&Math.abs(forward)>38&&c.impact<=0){c.hp-=Math.abs(forward)*.055;c.impact=.35;particle(c.x+Math.cos(c.a)*22,c.y+Math.sin(c.a)*22,'#d6b982',8,70);if(c===player.car){shake=Math.min(4,Math.abs(forward)*.012);sound('crash')}}c.v=c.vx*Math.cos(c.a)+c.vy*Math.sin(c.a);if(c===player.car)save.stats.distance+=Math.hypot(c.vx,c.vy)*dt;
 if(brake&&Math.abs(c.v)>70&&frame%3===0){skids.push({x:c.x,y:c.y,a:c.a,life:22});if(skids.length>220)skids.shift()}if(c.hp<=0&&!c.burning)wreck(c);
}
function followRoad(c,dt,target,speed){if(!c.route.length)c.route=roadRoute(c,target);while(c.route.length>1&&dist(c,c.route[0])<35)c.route.shift();const p=c.route[0]||target,diff=norm(Math.atan2(p.y-c.y,p.x-c.x)-c.a);let corner=0;if(c.route.length>1){const next=c.route[1],angle=Math.atan2(next.y-p.y,next.x-p.x);corner=Math.abs(norm(angle-c.a));}const d=dist(c,p),desired=Math.min(speed,Math.abs(diff)>1.3?35:Math.abs(diff)>.55?65:speed,corner>.6&&d<150?Math.max(40,d*.7):speed);drive(c,dt,c.v<desired-3?1:c.v>desired+9?-.7:0,clamp(diff*2.3,-1,1),false);if(c.route.length===1&&d<45)c.route=[]}
function policeUpdate(c,dt){c.routeTime-=dt;c.fire-=dt;const d=dist(c,player);if(c.routeTime<0){c.route=roadRoute(c,player);c.routeTime=2.5}followRoad(c,dt,player,carTypes.police.max*.9);if(d<480&&lineClear(c,player)){policeSeen=true;if(c.fire<0){enemyFire(c,'police');c.fire=rand(1.7,2.8)}}if(d>2000&&heat<20)c.remove=true}
function spawnPolice(){if(cars.filter(c=>c.ai==='police'&&!c.dead&&!c.burning).length>=Math.min(5,Math.ceil(heat/20)))return;const candidates=WLD.nodes.filter(n=>dist(n,player)>550&&dist(n,player)<1150&&n.links.length>1);if(!candidates.length)return;const p=pick(candidates),a=Math.atan2(player.y-p.y,player.x-p.x);cars.push(newCar('police',p.x,p.y,a,{ai:'police',routeTime:0}))}
function trafficUpdate(c,dt){c.hit=Math.max(0,c.hit-dt);const component=WLD.nearest(c).edge.a.component;if(!c.destination||c.destination.component!==component||dist(c,c.destination)<65){const connected=WLD.components[component],nearby=connected.filter(n=>dist(n,c)>400&&dist(n,c)<1700);c.destination=pick(nearby.length?nearby:connected.filter(n=>dist(n,c)>55));c.route=[]}if(!c.destination)return;const ahead={x:c.x+Math.cos(c.a)*60,y:c.y+Math.sin(c.a)*60},near=cars.some(o=>o!==c&&!o.dead&&dist(o,ahead)<38&&dist(o,c)>20);followRoad(c,dt,c.destination,near?10:c.speed)}

function update(dt){elapsed+=dt;frame++;if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show')}shake*=Math.pow(.018,dt);flash=Math.max(0,flash-dt);if(mode!=='play'){if(engineGain)engineGain.gain.value=0;return}
 if(interior){updateInterior(dt);return}activeElapsed+=dt;tickMarket(dt);
 player.shot=Math.max(0,player.shot-dt);player.invincible=Math.max(0,player.invincible-dt);
 if(player.reload>0){player.reload-=dt;if(player.reload<=0){const we=weapons[save.weapon],take=Math.min(we.mag-player.ammo,player.reserve);player.ammo+=take;player.reserve-=take;sound('tick')}}
 let dx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0),dy=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0);if(isTouch&&(touch.x||touch.y)){dx=touch.x;dy=touch.y}
 if(player.car){const c=player.car;if(isTouch&&(touch.x||touch.y)){const aim=Math.atan2(touch.y,touch.x);let diff=norm(aim-c.a);drive(c,dt,Math.abs(diff)>2.1?-.65:1,Math.abs(diff)>2.1?-clamp(diff,-1,1):clamp(diff*2,-1,1),touch.brake)}else drive(c,dt,-dy,dx,keys.Space||touch.brake);if(player.car===c){player.x=c.x;player.y=c.y;}if(!mouse.down&&!touch.fire)player.a=c.a;
 }else{const len=Math.max(1,Math.hypot(dx,dy)),speed=(keys.ShiftLeft?145:112),rate=1-Math.exp(-dt*(dx||dy?11:15));player.vx=lerp(player.vx||0,dx/len*speed,rate);player.vy=lerp(player.vy||0,dy/len*speed,rate);moveBody(player,player.vx*dt,player.vy*dt,9);if(dx||dy){player.a=Math.atan2(dy,dx);player.step+=dt*11}if(mouse.active&&!isTouch)player.a=Math.atan2((mouse.y-h/2)/zoom+camera.y-player.y,(mouse.x-w/2)/zoom+camera.x-player.x)}
 if(mouse.down||touch.fire)fire();
 if(engineGain){engineGain.gain.value=soundOn && player.car && player.car.hp>0 ? .012 : 0;engineOsc.frequency.value=player.car?35+Math.abs(player.car.v)*.25:35}
 policeSeen=false;
 for(const c of cars){if(c.hp<c.maxHp*.35&&!c.dead&&frame%8===0)emitSmoke(c);if(c.burning){c.burnTime-=dt;if(frame%3===0)emitSmoke(c);if(c.burnTime<=0)explodeCar(c);else if(c!==player.car)drive(c,dt,0,0,false);}if(c.retire!==undefined){c.retire-=dt;if(c.retire<0&&!visible(c,100))c.remove=true;}if(c.dead){c.wreckAge=(c.wreckAge||0)+dt;if(c.wreckAge>30&&!visible(c,100))c.remove=true;continue}if(c===player.car||c.burning)continue;if(c.ai==='traffic')trafficUpdate(c,dt);else if(c.ai==='police')policeUpdate(c,dt);else if(c.v&&Math.abs(c.v)>1){drive(c,dt,0,0,false)}
  if(player.car&&!c.dead&&dist(c,player.car)<37){const a=Math.atan2(c.y-player.y,c.x-player.x),v=Math.abs(player.car.v);if(v>40){const push=10;c.x+=Math.cos(a)*push;c.y+=Math.sin(a)*push;c.hp-=v*.08;player.car.hp-=v*.025;player.car.v*=.6;player.car.vx*=.6;player.car.vy*=.6;particle(c.x,c.y,'#debf7d',8,70);shake=4;sound('crash');if(c.ai==='traffic')addHeat(5);if(c.hp<=0)wreck(c)}else{player.car.x-=Math.cos(a)*dt*20;player.car.y-=Math.sin(a)*dt*20}}
 }
 cars=cars.filter(c=>!c.remove);
 for(const e of enemies){if(e.hp<=0)continue;e.hit=Math.max(0,e.hit-dt);e.fire-=dt;const d=dist(e,player);e.a=Math.atan2(player.y-e.y,player.x-e.x);if(d<550){const s=d>170?38:d<100?-25:0;moveBody(e,Math.cos(e.a)*s*dt,Math.sin(e.a)*s*dt,9);if(e.fire<0&&lineClear(e,player)){enemyFire(e);e.fire=rand(1.1,2.3)}}if(player.car&&d<25&&Math.abs(player.car.v)>85){e.hp=0;killEnemy(e);player.car.v*=.84}}
 for(const p of peds){if(dist(p,player)>1000)continue;p.panic=Math.max(0,p.panic-dt);const e=p.edge;p.t+=p.dir*p.speed*(p.panic?2.4:1)*dt/e.d;if(p.t<.05||p.t>.95){p.dir*=-1;p.t=clamp(p.t,.05,.95)}p.a=Math.atan2(e.b.y-e.a.y,e.b.x-e.a.x)+(p.dir<0?Math.PI:0);const a=Math.atan2(e.b.y-e.a.y,e.b.x-e.a.x),tx=lerp(e.a.x,e.b.x,p.t)-Math.sin(a)*p.off,ty=lerp(e.a.y,e.b.y,p.t)+Math.cos(a)*p.off;moveBody(p,tx-p.x,ty-p.y,8);if(player.car&&dist(p,player)<40){p.dir*=-1;p.panic=4}}
 tickWorldLife(dt);
 for(const b of bullets){b.life-=dt;const steps=Math.ceil(Math.hypot(b.vx,b.vy)*dt/9);b.lastX=b.x;b.lastY=b.y;for(let i=0;i<steps&&b.life>0;i++){b.x+=b.vx*dt/steps;b.y+=b.vy*dt/steps;if(blocked(b.x,b.y,2)){b.life=0;particle(b.x,b.y,'#a7a58a',3,40);break}if(b.from==='player'){
  let hit=false;for(const e of enemies)if(e.hp>0&&Math.hypot(b.x-e.x,b.y-e.y)<14){e.hp-=b.damage;e.hit=.15;b.life=0;particle(e.x,e.y,'#aa755c',4,40);hit=true;if(e.hp<=0)killEnemy(e);break}if(hit)break;
  for(const c of cars){if(c.dead||c.burning||c===player.car)continue;if(Math.hypot(b.x-c.x,b.y-c.y)<24){c.hp-=b.damage*.75;c.hit=.1;b.life=0;particle(b.x,b.y,'#d5b56b',5,60);if(c.ai==='traffic')addHeat(4);if(c.hp<=0)wreck(c);break}}
 }else if(Math.hypot(b.x-player.x,b.y-player.y)<(player.car?24:12)){b.life=0;if(player.car){player.car.hp-=b.damage*.85;if(player.car.hp<=0)wreck(player.car)}else damagePlayer(b.damage)}
 }}
 bullets=bullets.filter(b=>b.life>0);
 for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.95;p.vy*=.95}particles=particles.filter(p=>p.life>0);if(particles.length>500)particles.splice(0,particles.length-500);
 for(const s of skids)s.life-=dt;skids=skids.filter(s=>s.life>0);
 for(const p of pickups){p.life-=dt;if(dist(p,player)<45){if(p.type==='cash'){save.cash+=p.amount;sound('cash');toast('Crew earnings · +'+money(p.amount))}else player.reserve+=24;p.life=0}}pickups=pickups.filter(p=>p.life>0);
 escapeGrace=Math.max(0,escapeGrace-dt);const safe=dist(player,places[6])<90;
 if(heat>0){if(!policeSeen&&escapeGrace<=0){const old=heat;heat=Math.max(0,heat-dt*(safe?12:2.6));if(old>=20&&heat<20){save.stats.escapes++;toast('LOST THE TAIL · Keep your head down.')}}if(policeSeen)heat=Math.min(100,heat+dt*.5);spawnTimer-=dt;if(heat>=20&&spawnTimer<0){spawnPolice();spawnTimer=heat>65?3.5:6}if(heat<=0)for(const c of cars)if(c.ai==='police'){c.ai='parked';c.v=0;c.retire=8;}}
 if(safe){player.hp=Math.min(100,player.hp+dt*7);if(player.car)player.car.hp=Math.min(player.car.maxHp,player.car.hp+dt*12)}
 if(job){job.time-=dt;if(job.time<=0)failJob('Time ran out');else tickJob(dt)}
 if(comboTimer>0){comboTimer-=dt;if(comboTimer<=0)combo=0}
 empireTimer+=dt;if(empireTimer>=120){empireTimer-=120;const income=save.businesses.reduce((n,id)=>n+({velvet:6,blue:11,lucky:18.50}[id]||0),0);if(income){save.income+=income;toast('Your clubs earned '+money(income)+'. Collect it in Empire.');persist()}}
 saveTimer+=dt;if(saveTimer>12){saveTimer=0;persist()}
 const cvx=player.car?.vx||player.vx||0,cvy=player.car?.vy||player.vy||0;camera.lookX=lerp(camera.lookX,clamp(cvx*.24,-75,75),1-Math.exp(-dt*3));camera.lookY=lerp(camera.lookY,clamp(cvy*.24,-75,75),1-Math.exp(-dt*3));camera.x=lerp(camera.x,player.x+camera.lookX,1-Math.exp(-dt*5));camera.y=lerp(camera.y,player.y+camera.lookY,1-Math.exp(-dt*5));
 updateHUD();
}
function killEnemy(e){if(e.killed)return;e.killed=true;save.stats.kills++;save.xp+=12;particle(e.x,e.y,'#c9a977',12,80);pickups.push({x:e.x,y:e.y,type:Math.random()>.5?'cash':'ammo',amount:SHOP.round(rand(1,2.50)),life:90});addHeat(3)}
function tickJob(dt){if(!job)return;const j=job;
 if(j.type==='errand'||j.type==='bootleg')return;
 if(j.type==='legacy-bootleg'){const target=j.stops[j.stage];if(dist(player,target)<56&&player.car&&Math.abs(player.car.v)<38){j.delivery+=dt;if(j.delivery>1.6){j.stage++;j.delivery=0;sound('cash');if(j.stage>=3){completeJob();return}j.target=j.stops[j.stage];j.info='Deliver to '+j.target.name+'. Slow down inside the gold circle.';addHeat(j.stage===1?19:12);updateObjective();toast(j.stage===1?'Liquor loaded. Two clubs are waiting.':'Delivery made. One more stop.')}}else j.delivery=0;
 }else if(j.type==='rival'){if(j.stage===0&&j.targets.every(e=>e.hp<=0)){j.stage=1;j.target=places[6];j.info='Ledger secured. Return to the back room to collect your cut.';updateObjective();toast('Ledger secured. Bring it back to the green back room.')}else if(j.stage===1&&dist(player,j.target)<70){completeJob();return}
 }else if(j.type==='wheelman'&&j.stage===1&&player.car===j.car&&dist(player,places[0])<65&&Math.abs(player.car.v)<40){completeJob();return}
}
function updateHUD(force=false){if(!force&&frame%4!==0)return;$('cash').textContent=money(save.cash);$('rank').textContent=rank();const n=heat<15?0:Math.min(5,Math.ceil(heat/20));$('heat').textContent=Array.from({length:5},(_,i)=>i<n?'◆':'◇').join(' ');$('heat').style.color=policeSeen?'#db7960':'#d5ae62';$('heatlabel').textContent=n===0?'KEEP A LOW PROFILE':policeSeen?'POLICE HAVE EYES ON YOU':'WANTED · BREAK LINE OF SIGHT';$('hpbar').style.width=clamp(player.hp,0,100)+'%';$('carbar').style.width=player.car?clamp(player.car.hp/player.car.maxHp*100,0,100)+'%':'0%';$('vehicleLabel').textContent=player.car?carTypes[player.car.type].name:'ON FOOT';$('weapon').textContent=weapons[save.weapon].short;$('ammo').textContent=player.reload>0?'RELOADING':player.ammo+' / '+player.reserve;$('speed').querySelector('strong').textContent=String(Math.round(Math.abs(player.car?.v||0)*.21)).padStart(2,'0');$('district').textContent=(interior?interior.place.name:district(player.x,player.y));const min=Math.floor(elapsed/5)+23*60+42;$('clock').textContent=String(Math.floor(min/60)%24).padStart(2,'0')+':'+String(min%60).padStart(2,'0');
 if(job){const mm=Math.floor(job.time/60),ss=Math.floor(job.time%60);$('jobprogress').textContent=`${mm}:${String(ss).padStart(2,'0')} LEFT · ${Math.floor(dist(interior?interior.outside:player,job.target))} YD`+(job.delivery>0?' · '+(job.stage===0?'LOADING':'UNLOADING')+'…':job.type==='rival'&&job.stage===0?' · '+job.targets.filter(e=>e.hp<=0).length+'/'+job.targets.length+' CREW':'')}
 if(interior){const near=nearestNPC();interaction=dist(player,{x:360,y:437})<65?'Leave '+interior.place.name:near?'Speak to '+near.name:null;const hidden=SHOP.secrets.find(s=>s.front===interior.place.id);if(hidden&&dist(player,{x:642,y:255})<64)interaction='Inspect the concealed door';$('interaction').classList.toggle('hidden',!interaction);if(interaction)$('interaction').querySelector('span').textContent=interaction;$('talkBtn').classList.toggle('hidden',!near);$('talkBtn').textContent=near?'F · Talk to '+near.name:'';return}
 interaction=null;const near=nearestPlace();if(!player.car&&near&&shopById(near.id))interaction='Enter '+near.name;else if(near?.type==='phone')interaction='Take a contract';else if(player.car)interaction=Math.abs(player.car.v)<65?'Exit vehicle':null;else{const c=nearestCar();if(c)interaction='Drive '+carTypes[c.type].name}
 $('interaction').classList.toggle('hidden',!interaction);if(interaction)$('interaction').querySelector('span').textContent=interaction;
 drawMap(mc,180,false)
}
function visible(o,margin=100){return Math.abs(o.x-camera.x)<w/zoom/2+margin&&Math.abs(o.y-camera.y)<h/zoom/2+margin}
function drawCar(c){ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.a);
 const t=c.type==='truck',len=t?61:50,width=t?29:25;
 ctx.fillStyle='#020c0db0';ctx.fillRect(-len/2+4,-width/2+6,len+3,width+3);
 // Lamp beams follow the chassis.
 if(!c.dead){const light=ctx.createLinearGradient(len/2,0,len/2+155,0);light.addColorStop(0,'#ead28a25');light.addColorStop(1,'#ead28a00');ctx.fillStyle=light;ctx.beginPath();ctx.moveTo(len/2,-width/2+3);ctx.lineTo(len/2+155,-65);ctx.lineTo(len/2+155,65);ctx.lineTo(len/2,width/2-3);ctx.closePath();ctx.fill()}
 ctx.fillStyle='#0a1414';for(const xx of [-17,16])for(const yy of [-width/2-3,width/2-2]){ctx.fillRect(xx-5,yy,10,6);ctx.fillStyle='#565f55';ctx.fillRect(xx-3,yy+2,6,1);ctx.fillStyle='#0a1414'}
 ctx.fillStyle=c.dead?'#2b3531':c.color;ctx.beginPath();ctx.roundRect(-len/2,-width/2,len,width,6);ctx.fill();
 ctx.fillStyle='#d3d7b231';ctx.fillRect(-len/2+7,-width/2+2,len-15,2);ctx.fillStyle='#00000035';ctx.fillRect(-len/2+4,width/2-4,len-8,3);
 if(t){ctx.fillStyle=c.dead?'#2b302c':'#7c7c5a';ctx.fillRect(-27,-10,30,20);ctx.strokeStyle='#313f36';ctx.lineWidth=1;for(let a=-24;a<0;a+=7){ctx.beginPath();ctx.moveTo(a,-10);ctx.lineTo(a,10);ctx.stroke()}ctx.fillStyle='#183238';ctx.fillRect(10,-9,6,18);ctx.fillStyle='#607367';ctx.fillRect(2,-10,7,20)}else{
 ctx.fillStyle='#142d32';ctx.beginPath();ctx.moveTo(7,-10);ctx.lineTo(14,-8);ctx.lineTo(14,8);ctx.lineTo(7,10);ctx.closePath();ctx.fill();ctx.fillStyle='#8aa49a70';ctx.fillRect(9,-8,2,15);
 ctx.fillStyle='#142d32';ctx.fillRect(-17,-8,5,16);ctx.fillStyle=c.dead?'#232d2a':c.type==='police'?'#c3c5ad':c.color;ctx.fillRect(-11,-10,17,20);ctx.fillStyle='#d3d7b219';ctx.fillRect(-9,-8,13,2);
 ctx.strokeStyle='#253c37';ctx.lineWidth=1;ctx.strokeRect(-11,-10,17,20);ctx.fillStyle='#e1ca7040';ctx.fillRect(-2,-12,3,1);ctx.fillRect(-2,11,3,1)
 }
 ctx.fillStyle='#b4b69c';ctx.fillRect(len/2-3,-9,2,18);ctx.fillRect(-len/2,-9,2,18);ctx.fillStyle='#c6c5ae55';ctx.fillRect(len/2-7,-6,3,12);
 ctx.fillStyle=c.dead?'#5d5941':'#ebd88f';ctx.fillRect(len/2-1,-10,3,5);ctx.fillRect(len/2-1,5,3,5);ctx.fillStyle=Math.abs(c.v)<20?'#8e5341':'#d06c4f';ctx.fillRect(-len/2-1,-10,2,4);ctx.fillRect(-len/2-1,6,2,4);
 if(c.ai==='police'&&!c.dead){ctx.fillStyle=Math.sin(elapsed*13)>0?'#d87459':'#e6d9ae';ctx.shadowBlur=13;ctx.shadowColor=ctx.fillStyle;ctx.beginPath();ctx.arc(0,0,4,0,TAU);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#223b3d';ctx.font='bold 8px Georgia';ctx.textAlign='center';ctx.fillText('★',0,3)}
 if(c.mission&&!c.dead){ctx.strokeStyle='#d6af64aa';ctx.lineWidth=2;ctx.strokeRect(-len/2-4,-width/2-4,len+8,width+8)}
 if(c.hit>0){ctx.fillStyle='#e8d49b88';ctx.fillRect(-len/2,-width/2,len,width)}
 if(c.dead){ctx.fillStyle='#111b19aa';ctx.fillRect(-15,-8,24,16);ctx.fillStyle='#ca8e4455';ctx.fillRect(14,-7,5,6)}
 ctx.restore();if(false)particles.push({x:c.x+Math.cos(c.a)*18,y:c.y+Math.sin(c.a)*18,vx:rand(-8,8),vy:rand(-25,-10),life:.9,max:1,color:'#65716870',size:5});
}
function drawPerson(p,enemy=false,body=false){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);ctx.fillStyle='#00000066';ctx.beginPath();ctx.ellipse(3,5,9,6,0,0,TAU);ctx.fill();if(body){ctx.fillStyle='#3f4540';ctx.fillRect(-10,-4,20,9);ctx.restore();return}
 const step=p===player?Math.sin(player.step)*3:Math.sin(elapsed*9+p.x)*2;
 ctx.fillStyle='#172725';ctx.fillRect(-5,-5,6,3+step);ctx.fillRect(-5,3,6,3-step);ctx.fillStyle=p.hit>0?'#cfb581':enemy?'#725f4f':p===player?'#b8ad86':p.color;ctx.beginPath();ctx.ellipse(0,0,6,10,0,0,TAU);ctx.fill();
 ctx.fillStyle=enemy?'#d4ac80':'#b7a483';ctx.fillRect(4,-10,5,4);ctx.fillStyle='#182728';ctx.fillRect(7,-9,11,3);
 ctx.fillStyle=p===player?'#82734f':enemy?'#493e34':'#52584a';ctx.beginPath();ctx.ellipse(-1,0,7,6,0,0,TAU);ctx.fill();ctx.fillStyle=p===player?'#c9b17a':enemy?'#8a7860':'#87917b';ctx.beginPath();ctx.ellipse(0,0,4.5,4.5,0,0,TAU);ctx.fill();ctx.fillStyle='#252c26';ctx.fillRect(-2,-4,2,8);ctx.restore();
 if(enemy&&p.hp<p.maxHp&&p.hp>0){ctx.fillStyle='#152222';ctx.fillRect(p.x-15,p.y-22,30,3);ctx.fillStyle='#c47e5f';ctx.fillRect(p.x-15,p.y-22,30*p.hp/p.maxHp,3)}
}
function drawTree(t){ctx.fillStyle='#071a1877';ctx.beginPath();ctx.arc(t.x+5,t.y+8,t.r+2,0,TAU);ctx.fill();ctx.fillStyle='#243d30';ctx.beginPath();ctx.arc(t.x,t.y,t.r,0,TAU);ctx.fill();ctx.fillStyle='#36513d';ctx.beginPath();ctx.arc(t.x-3,t.y-3,t.r*.7,0,TAU);ctx.fill();ctx.fillStyle='#52634855';ctx.beginPath();ctx.arc(t.x-4,t.y-4,t.r*.4,0,TAU);ctx.fill()}
let cachedRoute=[],routeFrame=0;
function getRoute(){if(!job)return[];if(frame-routeFrame>25||!cachedRoute.length){cachedRoute=roadRoute(player,job.target);routeFrame=frame}return cachedRoute}
function drawRoute(){if(!job)return;const route=getRoute();ctx.save();ctx.strokeStyle='#c7a55e4f';ctx.lineWidth=5;ctx.lineCap='round';ctx.setLineDash([7,15]);ctx.lineDashOffset=-elapsed*12;ctx.beginPath();ctx.moveTo(player.x,player.y);for(const p of route)ctx.lineTo(p.x,p.y);ctx.stroke();ctx.restore()}
function drawMarker(p,active=false){if(!visible(p,160))return;const s=active?51:29;ctx.save();ctx.translate(p.x,p.y);if(active){const glow=ctx.createRadialGradient(0,0,5,0,0,85);glow.addColorStop(0,'#d5ae6220');glow.addColorStop(1,'#d5ae6200');ctx.fillStyle=glow;ctx.fillRect(-85,-85,170,170)}ctx.strokeStyle=active?'#e6c37b':p.color+'88';ctx.lineWidth=active?2:1;ctx.setLineDash([active?12:4,active?6:5]);ctx.lineDashOffset=-elapsed*12;ctx.beginPath();ctx.arc(0,0,s+(active?Math.sin(elapsed*3)*3:0),0,TAU);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle='#0c1a1bd9';ctx.beginPath();ctx.arc(0,0,14,0,TAU);ctx.fill();ctx.fillStyle=active?'#e6c37b':p.color;ctx.font='bold 11px Georgia';ctx.textAlign='center';ctx.fillText(active?'◆':p.icon,0,4);if(active){ctx.font='9px Arial';ctx.fillStyle='#ebd7ad';ctx.fillText(p.name||'MARKED COUPE',0,-69)}ctx.restore()}
function drawMap(c,size,full){const mapHeight=full?Math.round(size*WORLD_H/WORLD):size;c.clearRect(0,0,size,mapHeight);c.fillStyle='#132527';c.fillRect(0,0,size,mapHeight);let range=full?WORLD:1350,sx=full?0:clamp((interior?interior.outside.x:player.x)-range/2,0,WORLD-range),sy=full?0:clamp((interior?interior.outside.y:player.y)-range/2,0,WORLD_H-range),scale=size/range;
 if(full)c.drawImage(map,0,0,WORLD,WORLD_H,0,0,size,mapHeight);else c.drawImage(map,sx,sy,range,range,0,0,size,size);c.fillStyle='#0a202567';c.fillRect(0,0,size,mapHeight);const point=o=>({x:(o.x-sx)*scale,y:(o.y-sy)*scale});
 if(job){c.strokeStyle='#d7b365';c.lineWidth=full?2.5:1.5;c.beginPath();let pp=point(interior?interior.outside:player);c.moveTo(pp.x,pp.y);for(const p of roadRoute(interior?interior.outside:player,job.target)){const q=point(p);c.lineTo(q.x,q.y)}c.stroke();const t=point(job.target);c.fillStyle='#f1c878';c.beginPath();c.arc(clamp(t.x,5,size-5),clamp(t.y,5,size-5),full?7:4,0,TAU);c.fill()}
 for(const p of places){if(p.hidden&&save.secrets[p.id]!=='found')continue;const q=point(p);if(q.x<0||q.y<0||q.x>size||q.y>size)continue;c.fillStyle=p.color;c.font=`bold ${full?11:8}px Arial`;c.textAlign='center';c.fillText(p.icon,q.x,q.y+3);if(full){c.font='7px Arial';c.fillStyle='#d8d8b5';c.fillText(p.name,q.x,q.y+16)}}
 for(const e of enemies.filter(e=>e.hp>0).concat(cars.filter(c=>c.ai==='police'&&!c.dead))){const p=point(e);c.fillStyle='#df7962';c.beginPath();c.arc(p.x,p.y,full?3.5:2.5,0,TAU);c.fill()}
 if(full){c.fillStyle='#d4d2b090';c.font='10px Georgia';c.textAlign='center';for(const zone of WLD.zones){const q=point(zone);c.fillText(zone.name,q.x,q.y)}}
 const p=point(interior?interior.outside:player);c.save();c.translate(p.x,p.y);c.rotate(player.car?player.car.a:player.a);c.fillStyle='#f5e7ba';c.strokeStyle='#111f20';c.lineWidth=1;c.beginPath();c.moveTo(8,0);c.lineTo(-5,-4);c.lineTo(-2,0);c.lineTo(-5,4);c.closePath();c.fill();c.stroke();c.restore();
}
function draw(){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#111e21';ctx.fillRect(0,0,w,h);
 if(interior){drawInterior();return}
 if(mode==='title'){camera.x=places[0].x+Math.sin(elapsed*.035)*340;camera.y=places[0].y+Math.cos(elapsed*.024)*220}
 const sX=shake>0?rand(-shake,shake):0,sY=shake>0?rand(-shake,shake):0;
 ctx.save();ctx.translate(w/2+sX,h/2+sY);ctx.scale(zoom,zoom);ctx.translate(-camera.x,-camera.y);
 const vx=camera.x-w/zoom/2-10,vy=camera.y-h/zoom/2-10,vw=w/zoom+20,vh=h/zoom+20;
 ctx.drawImage(map,0,0);
 // Reflections and warm gaslight on cold, wet pavement.
 for(const l of lamps){if(!visible(l,130))continue;const grad=ctx.createRadialGradient(l.x,l.y,0,l.x,l.y,105);grad.addColorStop(0,'#efc4751e');grad.addColorStop(.45,'#d9b6750c');grad.addColorStop(1,'#dfbb6b00');ctx.fillStyle=grad;ctx.fillRect(l.x-105,l.y-105,210,210);ctx.fillStyle='#172a27';ctx.fillRect(l.x-1,l.y-7,3,13);ctx.fillStyle='#d9c58e';ctx.fillRect(l.x-3,l.y-7,6,3);ctx.fillStyle='#d4bf7c16';ctx.fillRect(l.x-12,l.y+12,6,40)}
 for(const s of skids)if(visible(s)){ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.a);ctx.globalAlpha=Math.min(.45,s.life/20);ctx.fillStyle='#0c1518';ctx.fillRect(-11,-13,22,3);ctx.fillRect(-11,10,22,3);ctx.restore()}
 if(started)drawRoute();
 for(const p of places)if(!p.hidden||save.secrets[p.id]==='found')drawMarker(p,job&&job.target===p);if(job?.type==='wheelman'&&job.stage===0)drawMarker({...job.car,name:'MARKED COUPE'},true);
 for(const p of peds)if(visible(p,30))drawPerson(p);
 for(const e of enemies)if(visible(e,30))drawPerson(e,true,e.hp<=0);
 const renderCars=cars.filter(c=>visible(c,150)).sort((a,b)=>a.y-b.y);for(const c of renderCars)drawCar(c);
 for(const p of pickups){if(!visible(p))continue;ctx.fillStyle=p.type==='cash'?'#d8b46c':'#9cb59c';ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.PI/4);ctx.fillRect(-4,-4,8,8);ctx.restore();ctx.strokeStyle='#d8b46c55';ctx.beginPath();ctx.arc(p.x,p.y,10+Math.sin(elapsed*4)*2,0,TAU);ctx.stroke()}
 if(started&&!player.car){if(player.invincible<=0||Math.floor(elapsed*12)%2)drawPerson(player)}
 for(const t of trees)if(visible(t,60))drawTree(t);
 for(const b of buildings)if(visible({x:b.x+b.w/2,y:b.y+b.h/2},140))drawBuilding3D(b);
 drawWorldLife();
 ctx.lineWidth=1.5;for(const b of bullets){ctx.strokeStyle=b.from==='player'?'#f3d795':'#c99269';ctx.beginPath();ctx.moveTo(b.lastX,b.lastY);ctx.lineTo(b.x,b.y);ctx.stroke()}
 for(const p of particles){if(!visible(p))continue;ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size)}ctx.globalAlpha=1;
 ctx.restore();
 // Rain is sparse enough to keep roads, cars and combat readable.
 ctx.strokeStyle='#b4d3c513';ctx.lineWidth=1;for(let i=0;i<75;i++){let rx=((i*137.3+elapsed*65)%(w+80))-40,ry=((i*97.1+elapsed*430)%(h+80))-40;ctx.beginPath();ctx.moveTo(rx,ry);ctx.lineTo(rx-5,ry+17);ctx.stroke()}
 if(flash>0){ctx.fillStyle=`rgba(171,70,48,${flash*.4})`;ctx.fillRect(0,0,w,h)}
 drawPursuitEdges();if(started&&job&&mode==='play')drawCompass();
}
function drawCompass(){const x=(job.target.x-camera.x)*zoom+w/2,y=(job.target.y-camera.y)*zoom+h/2;const mx=70,my=110;if(x>mx&&x<w-mx&&y>my&&y<h-150)return;const dx=x-w/2,dy=y-h/2,a=Math.atan2(dy,dx),tx=clamp(x,45,w-45),ty=clamp(y,120,h-150);ctx.save();ctx.translate(tx,ty);ctx.fillStyle='#152527ed';ctx.strokeStyle='#d7b26c99';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,22,0,TAU);ctx.fill();ctx.stroke();ctx.rotate(a);ctx.fillStyle='#dfba70';ctx.beginPath();ctx.moveTo(11,0);ctx.lineTo(-5,-5);ctx.lineTo(-2,0);ctx.lineTo(-5,5);ctx.closePath();ctx.fill();ctx.restore();ctx.fillStyle='#e3c48a';ctx.textAlign='center';ctx.font='9px Arial';ctx.fillText(Math.round(dist(player,job.target))+' YD',tx,ty+37)}
let accumulator=0;function loop(t){const dt=Math.min((t-last)/1000||.016,.1);last=t;accumulator+=dt;while(accumulator>=1/60){update(1/60);accumulator-=1/60}draw();requestAnimationFrame(loop)}
$('startBtn').addEventListener('click',startGame);$('howBtn').addEventListener('click',()=>{modal='help';mode='pause';$('titleScreen').classList.add('hidden');$('panel').classList.remove('hidden');renderPanel()});$('pauseBtn').addEventListener('click',()=>showPanel('pause'));$('soundTitle').addEventListener('click',enableAudio);
addEventListener('keydown',e=>{if(mode==='play'&&['Tab','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter'].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='Escape'&&mode==='dialogue'){endConversation();return}if(e.code==='Escape'||e.code==='KeyP'){if(mode==='play')showPanel('pause');else if(mode==='pause')closePanel();return}if(mode==='dialogue'){if(e.code==='Escape'){endConversation();return}if(/^Digit[1-9]$/.test(e.code))chooseDialogue(Number(e.code.slice(-1))-1);return;}if(mode!=='play')return;keys[e.code]=true;switch(e.code){case'KeyE':interact();break;case'KeyF':talkNearby();break;case'KeyR':reload();break;case'Enter':showPanel('jobs');break;case'Tab':showPanel('empire');break;case'KeyM':showPanel('map');break;case'Digit1':equipWeapon(0);break;case'Digit2':equipWeapon(1);break;case'Digit3':equipWeapon(2);break}});
addEventListener('keyup',e=>{keys[e.code]=false});
canvas.addEventListener('pointermove',e=>{mouse.x=e.clientX;mouse.y=e.clientY;mouse.active=true;$('crosshair').style.left=mouse.x+'px';$('crosshair').style.top=mouse.y+'px'});
canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button===0){mouse.down=true;mouse.active=true;mouse.x=e.clientX;mouse.y=e.clientY}});addEventListener('pointerup',()=>mouse.down=false);canvas.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;mouse.down=false;touch.fire=false;touch.x=touch.y=0;if(mode==='play')showPanel('pause')});
addEventListener('pagehide',persist);
let stickPointer=null;const stick=$('stick');function stickMove(e){const r=stick.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/38,dy=(e.clientY-r.top-r.height/2)/38,mag=Math.max(1,Math.hypot(dx,dy));touch.x=dx/mag;touch.y=dy/mag;stick.querySelector('i').style.transform=`translate(${touch.x*30}px,${touch.y*30}px)`}
stick.addEventListener('pointerdown',e=>{stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);stickMove(e)});stick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)stickMove(e)});function stickEnd(){stickPointer=null;touch.x=touch.y=0;stick.querySelector('i').style.transform=''}stick.addEventListener('pointerup',stickEnd);stick.addEventListener('pointercancel',stickEnd);
for(const b of $('mobile').querySelectorAll('button')){const a=b.dataset.action;b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);if(a==='talk')talkNearby();else if(a==='fire')touch.fire=true;else if(a==='brake')touch.brake=true;else if(a==='interact')interact();else if(a==='jobs')showPanel('jobs');else if(a==='empire')showPanel('empire');else if(a==='reload')reload()});for(const event of ['pointerup','pointercancel'])b.addEventListener(event,()=>{if(a==='fire')touch.fire=false;if(a==='brake')touch.brake=false})}
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
 option('How did you get it?',()=>say('A man paid me to deliver a bundle to the depot. The press date was wrong. The fire date was tonight. He told me a clever boy does not read what he carries. That was a poor choice of words.',[option('Give me a copy. [$1.00]',()=>{if(!spend(1))return say('“Keep your twenty,” Eddie says. “You look like you have already had a long evening.”',[option('Thanks.',endConversation)]);mark('eddieTip');return say('On the back of the photograph is a route around Dort Highway. The patrols are stopping cars on the main road. Eddie circles the side streets. “The fire story is fake. The roadblocks are not.” Your police heat drops.',[option('Use the route. [-30 heat]',()=>{heat=Math.max(0,heat-30);endConversation()})])}),option('Can you get this to Nora?',()=>{mark('tableSix');gift(1.25);return say('Eddie is gone before you finish the sentence. A minute later he is back with a folded $1.25. “She says she owes you a drink. She also says do not order it tonight.”',[option('That is unsettling.',endConversation)])})])),option('Any ordinary work going?',()=>{endConversation();showPanel('jobs')}),option('I would rather read yesterday’s news.',endConversation)]);
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
 for(const s of smoke){s.life-=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;s.r+=dt*6}smoke=smoke.filter(s=>s.life>0);if(smoke.length>200)smoke.splice(0,smoke.length-200);
 for(const d of debris){d.life-=dt;d.vz-=210*dt;d.z+=d.vz*dt;if(d.z<0){d.z=0;d.vz=Math.abs(d.vz)*.25;d.vx*=.6;d.vy*=.6}d.x+=d.vx*dt;d.y+=d.vy*dt;d.a+=d.spin*dt}debris=debris.filter(d=>d.life>0);for(const r of blastRings)r.life-=dt;blastRings=blastRings.filter(r=>r.life>0);
 const near=nearestNPC();$('talkBtn').classList.toggle('hidden',!near);$('talkBtn').textContent=near?'F · Talk to '+near.name:'';$('rumor').textContent=lead?'◆ '+lead.title+' · '+Math.round(dist(player,lead.target))+' yd':'';$('rumor').classList.toggle('hidden',!lead);
 const chasing=heat>=20&&cars.some(c=>c.ai==='police'&&!c.dead&&!c.burning&&dist(c,player)<1400);$('pursuitFx').classList.toggle('active',chasing&&mode==='play');
}
function project3(x,y,z){return{x:x+(x-camera.x)*z/1900,y:y+(y-camera.y)*z/1900-z*.34}}
function polygon(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill()}
function drawBuilding3D(b){
 if(b.placeId==='home'&&!save.home.built.includes('roof')){
  ctx.fillStyle=save.home.built.includes('foundation')?'#8d8068':'#3b513b';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.strokeStyle='#d5c08a';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.strokeRect(b.x,b.y,b.w,b.h);ctx.setLineDash([]);
  if(save.home.built.includes('frame'))for(const [x,y] of [[b.x,b.y],[b.x+b.w,b.y],[b.x,b.y+b.h],[b.x+b.w,b.y+b.h]]){const top=project3(x,y,28);ctx.strokeStyle='#b99b70';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(top.x,top.y);ctx.stroke()}
  const p=project3(b.x+b.w/2,b.y+b.h/2,5);ctx.fillStyle='#efe2bf';ctx.font='7px Arial';ctx.textAlign='center';ctx.fillText(save.home.built.includes('frame')?'HOME FRAME':save.home.built.includes('foundation')?'FOUNDATION':'HOME LOT',p.x,p.y);return
 }
 const floor=[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}],roof=floor.map(p=>project3(p.x,p.y,b.z));const facing=[0,1,2,3].sort((i,j)=>Math.hypot((floor[j].x+floor[(j+1)%4].x)/2-camera.x,(floor[j].y+floor[(j+1)%4].y)/2-camera.y)-Math.hypot((floor[i].x+floor[(i+1)%4].x)/2-camera.x,(floor[i].y+floor[(i+1)%4].y)/2-camera.y));
 for(const i of facing){const j=(i+1)%4;polygon([floor[i],floor[j],roof[j],roof[i]],['#39423a','#293936','#283a37','#4b5040'][i]);if(b.z>25){for(let t=.18;t<.9;t+=.22){const a={x:lerp(floor[i].x,floor[j].x,t),y:lerp(floor[i].y,floor[j].y,t)},p=project3(a.x,a.y,b.z*.55);ctx.fillStyle=(Math.floor(b.x+t*10)%3)?'#d5b67599':'#243c39';ctx.fillRect(p.x-2,p.y-2,4,4)}}}
 polygon(roof,b.color);ctx.strokeStyle='#b6b19355';ctx.lineWidth=1;ctx.beginPath();roof.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();
 if(b.gable){const a=project3(b.x+b.w/2,b.y,b.z+7),z=project3(b.x+b.w/2,b.y+b.h,b.z+7);polygon([roof[0],a,z,roof[3]],'#424d42');ctx.strokeStyle='#a3a18b66';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(z.x,z.y);ctx.stroke()}else{const p=project3(b.x+10,b.y+12,b.z+3);ctx.fillStyle='#31474a';ctx.fillRect(p.x,p.y,12,8);ctx.fillStyle='#86a39a';ctx.fillRect(p.x+1,p.y+1,10,2);const q=project3(b.x+b.w-15,b.y+b.h-12,b.z+5);ctx.fillStyle='#86846c';ctx.fillRect(q.x,q.y,8,6)}
 if(b.placeId){const door=places.find(p=>p.id===b.placeId)?.door;if(door){ctx.fillStyle='#e6c382';ctx.fillRect(door.x-5,door.y-5,10,10);ctx.strokeStyle='#ead5a366';ctx.beginPath();ctx.arc(door.x,door.y,13,0,TAU);ctx.stroke()}}
 if(b.landmark){const p=project3(b.x+b.w/2,b.y+b.h/2,b.z+1);ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='#101f20d9';ctx.fillRect(-b.w*.55,-7,b.w*1.1,14);ctx.font='6px Arial';ctx.textAlign='center';ctx.fillStyle='#d7c594';ctx.fillText(b.landmark,0,2);ctx.restore()}
}
function drawWorldLife(){
 if(lead)drawMarker({...lead.target,color:'#b397d4',icon:'◆',name:lead.title},false);
 for(const n of npcs){if(!visible(n,80)||n.consumed)continue;drawPerson(n);const d=dist(n,player);if(d<330){ctx.fillStyle='#101f21e8';ctx.strokeStyle=n.featured?'#e4c589':'#b4c6ab';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(n.x-12,n.y-40,24,18,4);ctx.fill();ctx.stroke();ctx.fillStyle=n.featured?'#e4c589':'#b4c6ab';ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.fillText('···',n.x,n.y-29);if(d<105){ctx.font='9px Arial';ctx.fillText('F · '+n.name,n.x,n.y-51)}else if(n.bark&&n.expires-elapsed>95){ctx.font='9px Georgia';ctx.fillText(n.bark,n.x,n.y-49)}}}
 for(const c of cars){if(c.dead||!visible(c,60))continue;const p=project3(c.x,c.y,7+Math.sin(elapsed*5+c.x)*Math.min(1,Math.abs(c.v)/160));ctx.save();ctx.translate(p.x,p.y);ctx.rotate(c.a);ctx.fillStyle=c.type==='police'?'#b2b7a1':c.color;ctx.shadowColor='#0009';ctx.shadowBlur=3;ctx.shadowOffsetY=3;ctx.fillRect(-10,-9,16,18);ctx.fillStyle='#c4ccb533';ctx.fillRect(-8,-8,12,2);ctx.restore()}
 for(const r of blastRings){const age=1-r.life/.65;ctx.strokeStyle=`rgba(239,176,85,${(1-age)*.7})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(r.x,r.y,age*125+15,0,TAU);ctx.stroke();if(age<.25){const grad=ctx.createRadialGradient(r.x,r.y,0,r.x,r.y,110);grad.addColorStop(0,'#fce7a9b0');grad.addColorStop(1,'#eeb96500');ctx.fillStyle=grad;ctx.fillRect(r.x-110,r.y-110,220,220)}}
 for(const d of debris){if(!visible(d,150))continue;ctx.fillStyle='#08131570';ctx.beginPath();ctx.ellipse(d.x+3,d.y+4,d.size*.7,d.size*.35,0,0,TAU);ctx.fill();const p=project3(d.x,d.y,d.z);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(d.a);ctx.fillStyle=d.color;ctx.fillRect(-d.size/2,-d.size/2,d.size,d.size*.6);ctx.restore()}
 for(const s of smoke){if(!visible(s,180))continue;const p=project3(s.x,s.y,s.z),alpha=clamp(s.life/s.max,0,1)*.42;ctx.fillStyle=s.dark?`rgba(37,42,38,${alpha})`:`rgba(156,163,145,${alpha})`;ctx.beginPath();ctx.arc(p.x,p.y,s.r,0,TAU);ctx.fill();ctx.fillStyle=`rgba(197,193,161,${alpha*.2})`;ctx.beginPath();ctx.arc(p.x-s.r*.2,p.y-s.r*.2,s.r*.6,0,TAU);ctx.fill()}
}
function drawPursuitEdges(){if(mode!=='play')$('pursuitFx').classList.remove('active')}
function endLife(reason){if(deathReport)return;toastTimer=0;$('toast').classList.remove('show');player.hp=0;save.stats.lives=(save.stats.lives||0)+1;deathReport={id:Date.now().toString(36)+'-'+Math.floor(Math.random()*1e6),build:'0.3-businesses',reason,duration:Math.round(activeElapsed-lifeStart),jobs:save.jobs-lifeJobs,earned:Math.max(0,save.stats.earnings-lifeMoney),district:district(player.x,player.y),rating:0,handling:0};for(const k in keys)keys[k]=false;mouse.down=false;touch.fire=false;touch.x=touch.y=0;mode='feedback';$('pursuitFx').classList.remove('active');$('overlay').classList.remove('hidden');$('titleScreen').classList.add('hidden');$('panel').classList.remove('hidden');$('crosshair').classList.add('hidden');renderDeath();persist()}
function renderDeath(){const r=deathReport;$('panel').innerHTML=`<div class="eyebrow">END OF THIS LIFE · PROTOTYPE 0.2</div><h2>The night caught up with you.</h2><p>${r.reason} in ${r.district.toLowerCase()}. Your empire and upgrades carry on.</p><div class="statsgrid"><div><strong>${Math.floor(r.duration/60)}:${String(r.duration%60).padStart(2,'0')}</strong><small>TIME ON THE STREET</small></div><div><strong>${r.jobs}</strong><small>JOBS COMPLETE</small></div><div><strong>${money(r.earned)}</strong><small>EARNED THIS LIFE</small></div></div><form id="lifeFeedback" data-desk-skip><h3>Help shape the next build.</h3><fieldset><legend>How was this life?</legend><div class="rating-row">${[1,2,3,4,5].map(i=>`<label><input data-desk-skip type="radio" name="rating" value="${i}"><span>${i}</span></label>`).join('')}<small>1 · frustrating &nbsp; 5 · one more run</small></div></fieldset><fieldset><legend>How did driving feel?</legend><div class="rating-row">${[1,2,3,4,5].map(i=>`<label><input data-desk-skip type="radio" name="handling" value="${i}"><span>${i}</span></label>`).join('')}<small>1 · awkward &nbsp; 5 · smooth</small></div></fieldset><label class="feedback-label" for="feedbackNote">What felt good, broke, or should happen next?</label><textarea data-desk-skip id="feedbackNote" name="note" rows="3" maxlength="1000" placeholder="Optional. Please leave out names and personal information."></textarea><p class="feedback-privacy">Only your ratings, note and the run summary above are sent to the game's creator. No name or account is requested.</p><div class="feedback-actions"><button class="primary" type="submit">SEND FEEDBACK & CONTINUE ↗</button><button type="button" class="secondary" id="skipFeedback">SKIP & CONTINUE</button></div><p id="feedbackStatus" role="status"></p></form>`;$('lifeFeedback').addEventListener('submit',submitLifeFeedback);$('skipFeedback').addEventListener('click',continueLife)}
async function submitLifeFeedback(e){e.preventDefault();if(!deathReport)return;const f=$('lifeFeedback'),data=new FormData(f),report={...deathReport,rating:Number(data.get('rating'))||0,handling:Number(data.get('handling'))||0,note:String(data.get('note')||'').slice(0,1000),date:new Date().toISOString(),sent:false};save.feedback=save.feedback||[];const existing=save.feedback.findIndex(v=>v.id===report.id);if(existing>=0)save.feedback[existing]=report;else save.feedback.push(report);save.feedback=save.feedback.slice(-60);persist();const status=$('feedbackStatus'),btn=f.querySelector('button[type="submit"]');btn.disabled=true;status.textContent='Sending your feedback…';
 try{const body=new URLSearchParams({'form-name':'dry-county-feedback','bot-field':'',run:report.id,build:report.build,rating:String(report.rating),handling:String(report.handling),note:report.note,summary:JSON.stringify({reason:report.reason,duration:report.duration,jobs:report.jobs,earned:report.earned,district:report.district}),date:report.date});const res=await fetch(new URL('feedback.html',location.href),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString(),signal:AbortSignal.timeout(8000)});if(!res.ok)throw new Error('Feedback endpoint not available');report.sent=true;const local=save.feedback.find(v=>v.id===report.id);if(local)local.sent=true;persist();status.textContent='Thank you. Feedback sent.';if(deathReport?.id===report.id){continueLife();toast('Thanks. Your feedback was sent.');}}
 catch{if(deathReport?.id!==report.id)return;status.textContent='Feedback is saved on this browser, but the server did not confirm receipt. You can retry, download a copy, or keep playing.';btn.disabled=false;btn.textContent='RETRY SENDING';let b=$('downloadFeedback');if(!b){b=document.createElement('button');b.id='downloadFeedback';b.type='button';b.className='secondary';b.textContent='DOWNLOAD FEEDBACK';f.querySelector('.feedback-actions').appendChild(b)}b.onclick=()=>downloadFeedback(save.feedback.find(v=>v.id===report.id)||report);}
}
function downloadFeedback(report){const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='dry-county-feedback-'+report.id+'.json';a.click();URL.revokeObjectURL(url)}
function continueLife(){if(!deathReport)return;deathReport=null;deathPending=false;$('panel').classList.add('hidden');$('overlay').classList.add('hidden');mode='play';recover();if(!isTouch)$('crosshair').classList.remove('hidden')}
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
function clearInputs(){for(const k in keys)keys[k]=false;mouse.down=false;touch.fire=false;touch.x=touch.y=0}
function enterBusiness(p,viaSecret=false){
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
 activeElapsed+=dt;tickMarket(dt);player.shot=Math.max(0,player.shot-dt);player.invincible=Math.max(0,player.invincible-dt);
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
 if(job.stage>=e.stops.length){if(e.reveal){save.secrets[e.reveal]=save.secrets[e.reveal]||'known';toast(SHOP.secrets.find(s=>s.club===e.reveal).hint)}completeJob();checkEndgame();return say('That is the right parcel. Here is your pay. Thanks for seeing it through.',[option('Glad to help.',endConversation)])}
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
 const [type,price]=interior.shop.service;let car=null;if(type==='repair'){car=cars.filter(c=>!c.dead&&!c.burning&&dist(c,interior.outside)<170).sort((a,b)=>dist(a,interior.outside)-dist(b,interior.outside))[0];if(!car||car.hp>=car.maxHp){toast('Park a damaged, repairable car outside first.');return false}}
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
 if(save.secrets[secret.club]!=='found'){save.secrets[secret.club]='found';save.xp+=100;persist();toast('SPEAKEASY DISCOVERED · '+places.find(p=>p.id===secret.club).name)}
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
function drawInterior(){
 const s=interior.shop,scale=Math.min(w/790,h/610),ox=w/2-360*scale,oy=h/2-250*scale;
 ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);
 ctx.fillStyle='#081415';ctx.fillRect(18,35,688,444);ctx.fillStyle=s.floor;ctx.fillRect(38,62,644,393);
 ctx.strokeStyle='#d6c39818';ctx.lineWidth=1;for(let y=62;y<455;y+=22){ctx.beginPath();ctx.moveTo(38,y);ctx.lineTo(682,y);ctx.stroke()}for(let x=38;x<682;x+=64){ctx.beginPath();ctx.moveTo(x,62);ctx.lineTo(x,455);ctx.stroke()}
 ctx.fillStyle='#233432';ctx.fillRect(25,45,670,17);ctx.fillRect(25,45,13,423);ctx.fillRect(682,45,13,423);ctx.fillRect(25,455,295,13);ctx.fillRect(400,455,295,13);
 ctx.fillStyle=s.color;ctx.fillRect(322,453,76,10);ctx.fillStyle='#f4e4b8';ctx.font='bold 12px Arial';ctx.textAlign='center';ctx.fillText('E · EXIT',360,481);
 for(const b of interior.fixtures){ctx.fillStyle='#0b131665';ctx.fillRect(b.x+5,b.y+7,b.w,b.h);ctx.fillStyle=b.color;ctx.fillRect(b.x,b.y,b.w,b.h);ctx.strokeStyle='#ddc69755';ctx.strokeRect(b.x,b.y,b.w,b.h);ctx.fillStyle='#f1e1c0';ctx.font='9px Arial';ctx.fillText(b.label,b.x+b.w/2,b.y+b.h/2+3)}
 const hidden=SHOP.secrets.find(secret=>secret.front===interior.shop.id);
 if(hidden){ctx.fillStyle=save.secrets[hidden.club]?'#b29b68':'#4c4c40';ctx.fillRect(658,220,21,68);ctx.fillStyle='#e4d1a0';ctx.font='9px Arial';ctx.textAlign='right';ctx.fillText(save.secrets[hidden.club]?'E · CONCEALED DOOR':'UNMARKED PANEL',650,250)}
 if(s.id==='home'&&!save.home.built.includes('roof')){ctx.fillStyle='#d9c38e';ctx.font='12px Arial';ctx.textAlign='center';ctx.fillText(save.home.built.includes('frame')?'FRAME RAISED · ROOF NEEDED':save.home.built.includes('foundation')?'FOUNDATION LAID':'EMPTY HOME LOT',360,340)}
 for(const n of interior.people){drawPerson(n);ctx.fillStyle=s.color;ctx.font='bold 11px Arial';ctx.fillText(n.patron?'···':n.name,n.x,n.y-22);if(dist(n,player)<110){ctx.fillStyle='#f6e8c9';ctx.fillText('F · TALK',n.x,n.y-40)}}
 drawPerson(player);ctx.restore();
}
ensureMarket();

if(save.jobs>0||save.xp>0){$('startBtn').innerHTML='CONTINUE YOUR EMPIRE <b>↗</b>';$('saveNote').textContent=rank()+' · '+money(save.cash)+' · '+save.jobs+' JOBS COMPLETE'}
populate();updateObjective();requestAnimationFrame(loop);
// A read-only diagnostic snapshot makes game state inspectable during verification.
window.dryCounty={snapshot:()=>({build:'0.3-businesses',interior:interior?.place.id||null,inventory:{...save.inventory},secrets:{...save.secrets},moonshineDelivered:save.moonshineDelivered,home:JSON.parse(JSON.stringify(save.home)),mode,player:{x:Math.round(player.x),y:Math.round(player.y),hp:player.hp,vehicle:player.car?.type,ammo:player.ammo},cash:save.cash,xp:save.xp,jobs:save.jobs,heat,map:{width:WORLD,height:WORLD_H,roads:WLD.roads.length,nodes:WLD.nodes.length},npcs:npcs.length,conversation:conversation?.npc?.name||null,lead:lead?.title||null,burning:cars.filter(c=>c.burning).length,contract:job?{type:job.type,stage:job.stage,time:Math.round(job.time),target:{x:job.target.x,y:job.target.y}}:null,cars:cars.length,enemies:enemies.filter(e=>e.hp>0).length,businesses:save.businesses,upgrades:{engine:save.engine,armor:save.armor,grip:save.grip},storageOK})};
})();
