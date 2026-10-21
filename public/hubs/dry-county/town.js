/* Dry County 0.6: bounded, local-only civilian simulation. All residents are fictional. */
'use strict';
window.DryTown = (() => {
 const BODY = Object.freeze({sedan:{length:36,width:18},coupe:{length:32,width:16},truck:{length:47,width:20},custom:{length:41,width:18},police:{length:38,width:18},agent:{length:42,width:19}});
 const HOURS = {garage:[7,19],grocer:[7,20],diner:[6,23],pharmacy:[8,20],tailor:[9,18],pawn:[8,19],dealer:[8,18],hardware:[7,19],furniture:[8,18],barber:[8,20],docks:[5,23]};
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)), distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const clock=m=>String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(Math.floor(m%60)).padStart(2,'0');
 function create(api) {
  const {world,buildings,places,residents,cars,newCar,solid,player,save}=api;
  const saved=save.town&&typeof save.town==='object'?save.town:{};
  const state=save.town={v:1,minute:Number.isFinite(saved.minute)?clamp(saved.minute,0,1439.99):470,day:Number.isInteger(saved.day)?Math.max(0,saved.day):0,memory:{}};
  let seconds=0,accumulator=0,nextEvent=12,eventSerial=0,routeBudget=0,grid=new Map();
  const events=[],reports=[],cooldowns=new Map(),stats={arrivals:0,departures:0,visits:0,deliveries:0,parked:0,witnesses:0,reports:0,nearSteps:0,farSteps:0,routes:0,routeDeferrals:0,avoided:0};
  let rng=192606;const random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296};
  const choose=a=>a[Math.floor(random()*a.length)];
  const shops=places.filter(p=>HOURS[p.id]&&p.door).map(p=>({...p,hours:HOURS[p.id],employees:[],customers:[],deliveries:0,visits:0}));
  const homes=buildings.filter(b=>b.style==='house'&&!b.placeId&&world.nearest({x:b.x+b.w/2,y:b.y+b.h/2}).edge.a.component===world.driveNodes[0].component);
  // Stable closest-face entrances for the smaller fictional homes.
  function homePoint(b){const center={x:b.x+b.w/2,y:b.y+b.h/2},n=world.nearest(center),dx=n.x-center.x,dy=n.y-center.y,t=Math.min(b.w/2/(Math.abs(dx)||.001),b.h/2/(Math.abs(dy)||.001));const d=Math.hypot(dx,dy)||1;return{x:center.x+dx*t+dx/d*7,y:center.y+dy*t+dy/d*7}}
  const homeSites=homes.map((b,i)=>({id:'home-'+i,name:'home',door:homePoint(b)}));
  const center=places.find(p=>p.id==='diner');
  homeSites.sort((a,b)=>distance(a.door,center)-distance(b.door,center));
  const first=['Ada','Arthur','Beatrice','Charles','Clara','Edith','Edward','Eleanor','Florence','Frank','George','Grace','Henry','Irene','James','Josephine','Leon','Lillian','Louis','Mabel','Marie','Otis','Pearl','Ruth'];
  const last=['Baker','Brooks','Carter','Cole','Davis','Ellis','Finch','Foster','Green','Hayes','Hill','Jackson','Jones','King','Lewis','Mills','Moore','Parker','Reed','Ross','Turner','Ward','Watson','Wright'];
  function open(shop){const hour=state.minute/60;return hour>=shop.hours[0]&&hour<shop.hours[1]}
  const lookup=id=>shops.find(s=>s.id===id);
  const atDoor=site=>site.door||site;
  function emit(kind,site,text){events.push({id:++eventSerial,kind,site:site.id,x:atDoor(site).x,y:atDoor(site).y,text,until:seconds+12});if(events.length>12)events.shift()}
  function clearLine(a,b,r=5){const n=Math.max(1,Math.ceil(distance(a,b)/8));for(let i=1;i<=n;i++)if(solid(a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n,r))return false;return true}
  // Offsets follow the existing trace. Intersection centers form deliberate
  // crossing points; no path cuts across a building or private garden.
  function path(from,to,driving=false){
   if(routeBudget<=0){stats.routeDeferrals++;return null}routeBudget--;stats.routes++;
   const a=world.nearest(from),b=world.nearest(to);if(a.edge.a.component!==b.edge.a.component)return [];
   const raw=world.route(from,{x:b.x,y:b.y}).filter((p,i,arr)=>!i||distance(p,arr[i-1])>2),out=[];
   const append=(p,crossing=false)=>{if(!out.length||distance(out[out.length-1],p)>1)out.push({x:p.x,y:p.y,crossing})};
   for(let i=1;i<raw.length;i++){
    const u=raw[i-1],v=raw[i],d=distance(u,v);if(d<2)continue;
    const dx=(v.x-u.x)/d,dy=(v.y-u.y)/d,road=world.nearest({x:(u.x+v.x)/2,y:(u.y+v.y)/2}).edge.road;
    const off=driving?Math.min(road.width/4,road.width>=66?10:16):road.width/2+5,trim=Math.min(d/3,driving?22:18);
    let entry={x:u.x+dx*trim-dy*off,y:u.y+dy*trim+dx*off},exit={x:v.x-dx*trim-dy*off,y:v.y-dy*trim+dx*off};
    if(!clearLine(entry,exit,driving?11:5)){entry={x:u.x+dx*trim,y:u.y+dy*trim};exit={x:v.x-dx*trim,y:v.y-dy*trim}}
    const prev=out.at(-1)||from;
    if(!clearLine(prev,entry,driving?11:5))append(u,true);
    append(entry);append(exit);append(v,true);
   }
   if(!driving){const prev=out.at(-1)||from;if(!clearLine(prev,to,5))return [];append(to)}
   return out;
  }
  const keys=p=>Math.floor(p.x/96)+','+Math.floor(p.y/96);
  function rebuildGrid(){grid=new Map();for(const c of cars){if(c.remove||c.hidden)continue;const k=keys(c);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(c)}}
  function closeCars(p,r=120){const out=[];for(let x=Math.floor((p.x-r)/96);x<=Math.floor((p.x+r)/96);x++)for(let y=Math.floor((p.y-r)/96);y<=Math.floor((p.y+r)/96);y++)out.push(...(grid.get(x+','+y)||[]));return out}
  function availablePoint(site,r){const p=atDoor(site);if(!solid(p.x,p.y,r))return{x:p.x,y:p.y};const n=world.nearest(p);return{x:n.x,y:n.y}}
  function chooseSite(r){const work=lookup(r.work),hour=state.minute/60,shift=work.hours[0]+r.shift/60;
   if(r.role==='delivery'&&open(work))return lookup(r.deliveryIndex++%2?'grocer':'hardware');
   if(hour>=shift&&hour<work.hours[1]-.1){
    if((r.visits+state.day+r.serial)%3===0&&hour>11&&hour<14)return lookup('diner');
    if(r.employee)return work;
    const nearby=shops.filter(s=>open(s)&&distance(s,r.home.door)<1700);return choose(nearby.length?nearby:[work]);
   }
   return r.home;
  }
  function depart(r,site){
   if(r.site){const s=lookup(r.site.id);if(s){s.customers=s.customers.filter(id=>id!==r.id);s.employees=s.employees.filter(id=>id!==r.id)}}
   r.site=null;r.hidden=false;r.target=site;r.path=null;r.wait=0;r.state='walking';stats.departures++;
   if(r.car&&!r.car.dead&&!r.car.burning&&!r.car.remove&&r.car!==player.car&&r.car.ai==='resident'&&distance(r.car,r)<180){
    const parking=parkingFor(site,r.car);if(parking&&distance(r,atDoor(site))>380){r.parking=parking;r.state='to-car';r.targetPoint={x:r.car.x,y:r.car.y};return}
   }
   r.targetPoint=availablePoint(site,5);
  }
  function arrive(r){
   const destination=lookup(r.target.id);if(destination&&!open(destination)){depart(r,r.home);return}
   r.state=r.target===r.home?'home':r.employee&&r.target.id===r.work?'working':r.role==='delivery'?'unloading':'shopping';
   r.site=r.target;r.hidden=true;r.path=[];r.visits++;stats.arrivals++;
   r.wait=r.state==='working'?35+r.serial%30:r.state==='home'?25+r.serial%50:r.state==='unloading'?9:7+r.serial%13;
   const s=lookup(r.target.id);if(s){
    if(r.state==='working')s.employees.push(r.id);else{s.customers.push(r.id);s.visits++;stats.visits++}
    if(r.state==='unloading'){s.deliveries++;stats.deliveries++;emit('delivery',s,'A delivery is being unloaded.');}
    else if(r.state==='shopping'&&s.visits%3===1)emit('customer',s,'A customer steps inside.');
   }
  }
  function parkingFor(site,c){
   const n=world.nearest(atDoor(site)),angle=n.angle,body=BODY[c.type]||BODY.sedan,margin=body.length/2+10;
   // Stay away from junctions and railway crossings. Never reserve a shop door.
   for(const side of [1,-1])for(const offset of [0,48,-48,96,-96,144,-144]){
    const d=n.t*n.edge.d+offset;if(d<margin||d>n.edge.d-margin)continue;
    const off=n.edge.road.width/2-body.width/2,x=n.edge.a.x+Math.cos(angle)*d-Math.sin(angle)*off*side,y=n.edge.a.y+Math.sin(angle)*d+Math.cos(angle)*off*side;
    const p={x,y,a:angle+(side<0?Math.PI:0)};
    if(api.railDistance(p)<65||solid(x,y,body.width/2+1)||cars.some(o=>o!==c&&!o.remove&&distance(o,p)<body.length+7))continue;
    if(residents.some(r=>r.car!==c&&r.parking&&distance(r.parking,p)<body.length+7))continue;
    return p;
   }
   return null;
  }
  function move(r,dt){
   if(!r.path){r.path=path(r,r.targetPoint);if(!r.path)return;if(!r.path.length){r.wait=2;r.path=null;return}}
   let remaining=r.speed*(r.panic>0?1.6:1)*dt;
   while(remaining>0&&r.path.length){const p=r.path[0],d=distance(r,p);if(d<1){r.path.shift();continue}const step=Math.min(d,remaining),dx=(p.x-r.x)/d,dy=(p.y-r.y)/d;
    const next={x:r.x+dx*step,y:r.y+dy*step};
    if(r.detailed){
     const car=closeCars(r,60).find(c=>{if(c.dead||c.remove||(c===r.car&&r.state==='to-car'))return false;const body=BODY[c.type],ca=Math.cos(c.a),sa=Math.sin(c.a),rx=next.x-c.x,ry=next.y-c.y;return Math.abs(rx*ca+ry*sa)<body.length/2+5&&Math.abs(-rx*sa+ry*ca)<body.width/2+5});
     if(car){
      if(Math.abs(car.v)>5){r.wait=.3;return}
      const body=BODY[car.type],ca=Math.cos(car.a),sa=Math.sin(car.a),corners=[];
      for(const x of [-body.length/2-9,body.length/2+9])for(const y of [-body.width/2-9,body.width/2+9])corners.push({x:car.x+ca*x-sa*y,y:car.y+sa*x+ca*y});
      const safe=(a,b)=>{if(!clearLine(a,b,5))return false;const count=Math.max(1,Math.ceil(distance(a,b)/3));for(let i=1;i<=count;i++){const x=a.x+(b.x-a.x)*i/count-car.x,y=a.y+(b.y-a.y)*i/count-car.y;if(Math.abs(x*ca+y*sa)<body.length/2+5&&Math.abs(-x*sa+y*ca)<body.width/2+5)return false}return true};
      const options=[];
      for(const a of corners)if(safe(r,a)){if(safe(a,p))options.push([a]);for(const b of corners)if(a!==b&&safe(a,b)&&safe(b,p))options.push([a,b])}
      options.sort((a,b)=>distance(r,a[0])+distance(a[0],a.at(-1))+distance(a.at(-1),p)-distance(r,b[0])-distance(b[0],b.at(-1))-distance(b.at(-1),p));
      if(options.length)r.path.unshift(...options[0]);else r.wait=.4;stats.avoided++;return;
     }
    }
    // Crossings yield to approaching cars, including the player's vehicle.
    if(p.crossing&&closeCars(r,90).some(c=>!c.dead&&Math.abs(c.v)>15&&distance(c,r)<BODY[c.type].length/2+25)){r.wait=.3;stats.avoided++;return}
    if(!clearLine(r,{x:r.x+dx*step,y:r.y+dy*step},5)){r.path=null;r.wait=1;return}
    r.x+=dx*step;r.y+=dy*step;r.a=Math.atan2(dy,dx);r.step=(r.step||0)+step*.17;remaining-=step;r.detouring=false;
    if(step>=d-.01)r.path.shift();
   }
   if(r.path.length)return;
   if(r.state==='to-car'){
    if(r.car===player.car||r.car.dead||r.car.burning||r.car.ai!=='resident'){r.car=null;depart(r,r.target);return}
    r.hidden=true;r.state='driving';r.car.parked=false;r.car.path=null;r.car.destination=r.parking;r.car.targetSite=r.target.id;
   }else arrive(r);
  }
  function remember(r,incident){
   if(r.memory.some(m=>m.id===incident.id))return;
   r.memory.push({...incident});r.memory=r.memory.slice(-6);state.memory[r.id]=r.memory;stats.witnesses++;
   r.bark=incident.kind==='help'?'Much obliged.':incident.kind==='theft'?'That is somebody\'s car!':'I saw that. Stay back.';r.barkUntil=seconds+7;
   if(incident.kind!=='help'){r.panic=8;r.wait=Math.max(r.wait,2);if(r.serial%4===0)reports.push({at:seconds+4+r.serial%5,incident,rid:r.id})}
  }
  function witness(kind,at){
   const previous=cooldowns.get(kind)??-99;if(seconds-previous<3)return 0;cooldowns.set(kind,seconds);
   const incident={id:state.day+'-'+Math.floor(state.minute*100)+'-'+kind,kind,day:state.day,minute:Math.floor(state.minute),x:Math.round(at.x),y:Math.round(at.y)};let count=0;
   for(const r of residents)if(!r.hidden&&distance(r,at)<(kind==='gunfire'?280:180)&&clearLine(r,at,2)){remember(r,incident);count++}
   return count;
  }
  function residentTick(r,dt){
   r.panic=Math.max(0,r.panic-dt);if(r.down>0||r.dive>0){api.pedReaction(r,dt);return}
   if(r.state==='driving'){if(r.car&&r.car.ai==='resident'&&!r.car.dead&&!r.car.burning&&r.car!==player.car){r.x=r.car.x;r.y=r.car.y;return}r.hidden=false;r.car=null;r.state='walking';r.path=null;r.targetPoint=availablePoint(r.target,5)}
   if(r.hidden){r.wait-=dt;if(r.wait>0)return;const dest=chooseSite(r);
    if(dest===r.site){r.wait=15;return}depart(r,dest);return}
   if(r.wait>0){r.wait-=dt;return}
   // React to impact physics while retaining the resident's identity and route.
   if(distance(r,api.focus())<1000){api.pedReaction(r,dt);if(r.down>0||r.dive>0){r.path=null;return}}
   move(r,dt);
  }
  function driveTick(c,dt){
   if(c.knock){c.disrupted=.6;c.knock=false;c.path=null}
   if(c.disrupted>0){api.drive(c,dt,0,0,true);c.disrupted-=dt;return}
   const r=residents.find(p=>p.id===c.residentId);if(!r||r.state!=='driving'||c.parked){if(Math.hypot(c.vx,c.vy)>1)api.drive(c,dt,0,0,true);else c.v=c.vx=c.vy=0;return}
   if(!c.path){c.path=path(c,c.destination,true);if(!c.path||!c.path.length){c.path=null;c.v=c.vx=c.vy=0;return}c.path.push({...c.destination})}
   while(c.path.length&&distance(c,c.path[0])<2)c.path.shift();
   if(!c.path.length){
    c.v=c.vx=c.vy=0;c.parked=true;c.a=r.parking.a;stats.parked++;r.x=c.x-Math.sin(c.a)*(BODY[c.type].width/2+9);r.y=c.y+Math.cos(c.a)*(BODY[c.type].width/2+9);
    r.hidden=false;r.state='walking';r.path=null;r.targetPoint=availablePoint(r.target,5);return;
   }
   const target=c.path[0],d=distance(c,target),angle=Math.atan2(target.y-c.y,target.x-c.x),dx=Math.cos(angle),dy=Math.sin(angle),body=BODY[c.type];
   const look=Math.max(35,c.v*.7+body.length/2),near=closeCars(c,look+40),obstacle=near.find(o=>{
    if(o===c||o.dead||o.remove)return false;const rx=o.x-c.x,ry=o.y-c.y,along=rx*dx+ry*dy,side=Math.abs(-rx*dy+ry*dx);return along>0&&along<look+BODY[o.type].length/2&&side<(body.width+BODY[o.type].width)/2+.5;
   });
   const cross=api.crossingBlocked(c,{x:c.x+dx*look,y:c.y+dy*look});
   const ped=residents.find(p=>!p.hidden&&p!==r&&distance(p,c)<look&&((p.x-c.x)*dx+(p.y-c.y)*dy)>0&&Math.abs(-(p.x-c.x)*dy+(p.y-c.y)*dx)<body.width/2+3);
   c.blockedBy=obstacle?(obstacle.residentId||obstacle.ai):ped?ped.id:cross?'train':null;
   let desired=obstacle||cross||ped?0:c.speed;
   if(d<45&&c.path.length>1){const n=c.path[1],turn=Math.abs(Math.atan2(Math.sin(Math.atan2(n.y-target.y,n.x-target.x)-angle),Math.cos(Math.atan2(n.y-target.y,n.x-target.x)-angle)));if(turn>.4)desired=Math.min(desired,25)}
   if(c.path.length===1)desired=Math.min(desired,Math.max(7,d));
   c.v=clamp(c.v+(desired>c.v?30:-110)*dt,0,Math.max(c.speed,c.v));if(desired===0&&c.v<2)c.v=0;
   if(desired===0){c.waited=(c.waited||0)+dt;stats.avoided++;if(c.waited>4&&!c.honked&&distance(c,api.focus())<800){api.horn();c.honked=true}
    // Wait, then pass a stationary obstruction if there is room and no oncoming
    // vehicle. A junction or occupied passing lane keeps the driver waiting.
    if(obstacle&&Math.abs(obstacle.v)<2&&c.waited>2&&d>look+body.length&&!c.passing){
     const offset=body.width+5,along=(obstacle.x-c.x)*dx+(obstacle.y-c.y)*dy,advance=along+(body.length+BODY[obstacle.type].length)/2+18;
     const one={x:c.x+dx*12+dy*offset,y:c.y+dy*12-dx*offset},two={x:c.x+dx*advance+dy*offset,y:c.y+dy*advance-dx*offset};
     if(advance<d-12&&clearLine(c,one,body.width/2)&&clearLine(one,two,body.width/2)&&clearLine(two,target,body.width/2)&&!near.some(o=>o!==c&&o!==obstacle&&!o.dead&&Math.abs(o.v)>5&&distance(o,two)<120)){
      c.path.unshift(one,two);c.passing=true;c.waited=0;return;
     }
    }
   }
   else{c.waited=0;c.honked=false;if(c.passing&&c.path.length<3)c.passing=false}
   // Exact swept movement prevents fast cars skipping pedestrians or obstacles.
   let step=Math.min(d,c.v*dt);if(obstacle)step=Math.min(step,Math.max(0,distance(c,obstacle)-(body.length+BODY[obstacle.type].length)/2-5));
   const next={x:c.x+dx*step,y:c.y+dy*step};
   if(!clearLine(c,next,body.width/2)){c.v=c.vx=c.vy=0;c.path=null;return}
   c.a+=Math.atan2(Math.sin(angle-c.a),Math.cos(angle-c.a))*Math.min(1,dt*8);c.vx=dx*c.v;c.vy=dy*c.v;c.x=next.x;c.y=next.y;c.throttle=desired>c.v?.4:0;c.braking=desired<c.v;
  }
  // Seventy-two durable identities, concentrated enough for a visible Main Street.
  for(let i=0;i<72&&homeSites.length;i++){
   const home=homeSites[i<30?i%Math.min(homeSites.length,24):Math.floor((i-30)/42*homeSites.length)],work=shops[i%shops.length],p=availablePoint(home,5),id='resident-'+String(i).padStart(3,'0');
   const memory=Array.isArray(saved.memory?.[id])?saved.memory[id].filter(m=>m&&['help','theft','crash','gunfire'].includes(m.kind)&&Number.isFinite(m.day)&&state.day-m.day<=3).slice(-6).map(m=>({id:String(m.id).slice(0,80),kind:m.kind,day:m.day,minute:clamp(Number(m.minute)||0,0,1440),x:clamp(Number(m.x)||0,0,world.width),y:clamp(Number(m.y)||0,0,world.height)})):[];
   const r={id,serial:i,resident:true,name:first[i%first.length]+' '+last[(i*7+Math.floor(i/24))%last.length],role:i%17===0?'delivery':'resident',home,work:work.id,shift:i%7*3,employee:i<shops.length*2,speed:23+i%8*1.6,bodyScale:.58+(i%7)*.025,color:choose(['#6f7260','#7b6b59','#40565a','#7f8070','#8b665b']),...p,a:0,state:'home',site:home,hidden:true,wait:i%18*.7,memory,visits:0,deliveryIndex:0,panic:0,step:0,lodDebt:0};
   residents.push(r);state.memory[id]=memory;
   if(i%3===0){const type=r.role==='delivery'?'truck':['sedan','coupe','sedan','truck'][i/3%4],c=newCar(type,p.x,p.y,0,{ai:'resident',residentId:id,speed:42+i%6*4,parked:true});const park=parkingFor(home,c);if(park){Object.assign(c,park);cars.push(c);r.car=c}}
  }
  function tick(dt){
   seconds+=dt;state.minute+=dt/5;if(state.minute>=1440){state.minute%=1440;state.day++}
   accumulator+=dt;if(accumulator<.05)return;const slice=accumulator;accumulator=0;
   routeBudget=4;rebuildGrid();const focus=api.focus(),quality=api.quality();
   for(const r of residents){const d=distance(r,focus),near=d<(quality===0?650:1050),period=near?.05:d<1900?.25:1;
    r.detailed=near;r.lodDebt+=slice;if(r.lodDebt+1e-8<period)continue;const delta=r.lodDebt;r.lodDebt=0;if(near)stats.nearSteps++;else stats.farSteps++;
    // Distant residents advance their itinerary in one coarse step. Swept path
    // movement still checks the full segment, so returning to view is continuous.
    residentTick(r,delta);
   }
   for(const c of cars)if(c.ai==='resident'&&!c.dead&&!c.burning&&!c.remove&&c!==player.car){c.lodDebt=(c.lodDebt||0)+slice;const period=distance(c,focus)<(quality===0?650:1100)?.05:.25;if(c.lodDebt+1e-8<period)continue;const delta=c.lodDebt;c.lodDebt=0;driveTick(c,delta)}
   for(let i=reports.length-1;i>=0;i--)if(reports[i].at<=seconds){const report=reports.splice(i,1)[0],r=residents.find(r=>r.id===report.rid);if(r&&!r.down){api.report(report.incident);stats.reports++}}
   for(let i=events.length-1;i>=0;i--)if(events[i].until<seconds)events.splice(i,1);
   if(seconds>=nextEvent){nextEvent=seconds+18+random()*18;const active=shops.filter(s=>open(s));if(active.length){const site=choose(active),r=choose(residents.filter(r=>!r.employee&&r.state!=='driving'&&!r.down));if(r){depart(r,site);emit('errand',site,site.id==='diner'?'The breakfast crowd is coming and going.':'A neighbor heads out on an errand.')}}}
  }
  function description(r){const last=r.memory.at(-1);if(last)return last.kind==='help'?'You made that delivery. People appreciate someone who follows through.':last.kind==='theft'?'I remember you taking that car. Keep your hands off mine.':last.kind==='crash'?'I saw that crash. Slow down around here.':'I remember the shooting. I am keeping my distance.';return r.state==='working'?'I am on the clock. Try the counter.':r.target===r.home?'Heading home. It has been a long shift.':'I am on my way to '+(r.target?.name||'work')+'. Those errands will not do themselves.'}
  return {tick,witness,residents,shops,events,state,body:BODY,get seconds(){return seconds},
   isOpen:id=>!lookup(id)||open(lookup(id)),hours:id=>lookup(id)?clock(lookup(id).hours[0]*60)+'–'+clock(lookup(id).hours[1]*60):'24 HOURS',
   takeCar(c){witness('theft',c);const owner=residents.find(r=>r.id===c.residentId);if(owner){owner.car=null;if(owner.state==='driving'){owner.hidden=false;owner.x=c.x;owner.y=c.y;owner.state='walking';owner.path=null;owner.targetPoint=availablePoint(owner.target,5)}}c.residentId=null},
   description,
   snapshot(){return{minute:Math.floor(state.minute),day:state.day,residents:residents.length,visible:residents.filter(r=>!r.hidden).length,states:residents.reduce((a,r)=>(a[r.state]=(a[r.state]||0)+1,a),{}),stats:{...stats},businesses:shops.map(s=>({id:s.id,open:open(s),employees:s.employees.length,customers:s.customers.length,visits:s.visits,deliveries:s.deliveries})),events:events.map(e=>({...e})),remembering:residents.filter(r=>r.memory.length).length,vehicles:cars.filter(c=>c.ai==='resident').map(c=>({id:c.residentId,type:c.type,parked:c.parked,x:Math.round(c.x),y:Math.round(c.y),destination:c.targetSite||'home'}))}}
  };
 }
 return {create,BODY,HOURS};
})();
