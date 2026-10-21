const assert=require('node:assert/strict');
module.exports=function(t){
 const results=[];const check=(name,fn)=>{fn();results.push(name)};
 t.startGame();if(t.job)t.failJob('Town acceptance');
 // Leave the vehicle at the Main Street curb; no input for five game minutes.
 const c=t.player.car,n=t.WLD.nearest(t.WLD.P(590,356));assert.equal(n.edge.road.name,'MT. MORRIS ROAD');
 Object.assign(c,{x:n.x-Math.sin(n.angle)*29,y:n.y+Math.cos(n.angle)*29,a:n.angle,v:0,vx:0,vy:0});t.player.x=c.x;t.player.y=c.y;
 const pedestrians=new Set(),vehicles=new Set(),samples=[],start=performance.now();
 for(let i=0;i<18000;i++){
  t.update(1/60);
  if(i%300===0){
   for(const r of t.peds)if(!r.hidden&&Math.hypot(r.x-c.x,r.y-c.y)<650)pedestrians.add(r.id);
   for(const car of t.cars)if(car.ai==='resident'&&!car.parked&&Math.abs(car.v)>3&&Math.hypot(car.x-c.x,car.y-c.y)<650)vehicles.add(car.residentId);
   if(i%1800===0)samples.push({second:i/60,...t.town.snapshot().states});
  }
 }
 const snapshot=t.town.snapshot();console.log(JSON.stringify({seconds:300,cpuMs:Math.round(performance.now()-start),seenPedestrians:pedestrians.size,seenDrivers:vehicles.size,snapshot,samples},null,2));
 check('Five minutes on Main Street produce independent footfall, business arrivals and car trips',()=>{
  assert(pedestrians.size>=8,'Expected at least eight distinct local pedestrians, got '+pedestrians.size);
  assert(vehicles.size>=2,'Expected at least two local destination trips, got '+vehicles.size);
  assert(snapshot.stats.visits>=8,'Shops need repeat visits');assert(snapshot.stats.parked>=2,'Drivers must arrive and park');
  assert(snapshot.businesses.filter(s=>s.visits>0).length>=3,'Activity must spread across businesses');
  assert.equal(t.mode,'play');assert(t.player.hp>0);assert(Math.hypot(t.player.x-c.x,t.player.y-c.y)<1,'Player remains parked');
 });
 check('Residents retain stable identities, distinct adult proportions and bounded population',()=>{
  assert.equal(t.peds.length,72);assert.equal(new Set(t.peds.map(r=>r.id)).size,72);assert(new Set(t.peds.map(r=>r.bodyScale)).size>=5);
  assert(t.peds.every(r=>r.home&&r.work&&Number.isFinite(r.x)&&Number.isFinite(r.y)));
  assert(t.cars.filter(c=>c.ai==='resident').length<=24);
 });
 check('Both local detail and distant simulation advance',()=>{assert(snapshot.stats.nearSteps>0);assert(snapshot.stats.farSteps>0);assert(snapshot.stats.routes>0)});
 check('Clock freezes in menus and dialogue; indoor exploration advances the town',()=>{
  t.showPanel('pause');const before=t.town.state.minute;for(let i=0;i<120;i++)t.update(1/60);assert.equal(t.town.state.minute,before);t.closePanel();
  t.player.car=null;t.heat=0;t.town.state.minute=600;t.enterBusiness(t.places.find(p=>p.id==='grocer'));assert(t.interior);
  const indoor=t.town.state.minute;for(let i=0;i<120;i++)t.update(1/60);assert(t.town.state.minute>indoor);t.leaveBusiness(true);
 });
 check('Businesses keep hours, permit an active handover and retain emergency access',()=>{
  t.town.state.minute=23*60;assert(!t.town.isOpen('tailor'));assert.equal(t.enterBusiness(t.places.find(p=>p.id==='tailor')),false);
  assert(t.enterBusiness(t.places.find(p=>p.id==='pharmacy')));t.leaveBusiness(true);
  t.town.state.minute=600;assert(t.town.isOpen('tailor'));
 });
 check('Witnesses require proximity and line of sight; remembered reactions survive saves',()=>{
  const near=t.peds[0],far=t.peds[1],p=t.places.find(p=>p.id==='phone');Object.assign(near,{hidden:false,x:p.x,y:p.y,memory:[],down:0});Object.assign(far,{hidden:false,x:p.x+2000,y:p.y,memory:[]});
  assert(t.town.witness('theft',{x:p.x+5,y:p.y})>0);assert.equal(near.memory.at(-1).kind,'theft');assert(!far.memory.length);assert(t.town.description(near).includes('taking that car'));
  const pos={x:near.x,y:near.y};near.hidden=true;t.town.witness('crash',pos);assert.equal(near.memory.length,1,'A resident indoors cannot see the street');
  t.persist();const memories=JSON.stringify(t.save.town.memory);t.startGame();assert.equal(JSON.stringify(t.save.town.memory),memories);assert(t.town.description(t.peds[0]).includes('taking that car'));
 });
 check('Buildings hide incidents from witnesses; delayed reports use the incident position',()=>{
  for(const r of t.peds)r.hidden=true;
  const r=t.peds[0],b=t.buildings.find(b=>b.w<60&&!b.authored),old=r.memory.length;
  Object.assign(r,{hidden:false,wait:99,x:b.x-12,y:b.y+b.h/2});t.town.witness('gunfire',{x:b.x+b.w+12,y:r.y});assert.equal(r.memory.length,old,'No view through a house');
  const p=t.places.find(p=>p.id==='phone');Object.assign(r,{x:p.x,y:p.y,hidden:false,down:0});const incident={x:p.x+5,y:p.y};
  t.town.witness('crash',incident);t.player.car=null;t.player.x=p.x+1000;t.player.y=p.y;t.player.invincible=999;t.heat=0;
  for(let i=0;i<540;i++)t.update(1/60);
  assert(t.town.snapshot().stats.reports>0);assert(Math.hypot(t.LAW.known.x-incident.x,t.LAW.known.y-incident.y)<10,'Report must not follow the player');
 });
 check('An employee finishes a shift and travels home',()=>{
  const r=t.peds.find(r=>r.work==='garage'&&r.employee);Object.assign(r,{state:'working',site:t.town.shops.find(s=>s.id==='garage'),hidden:true,wait:0});t.town.state.minute=20*60;
  for(let i=0;i<70;i++)t.update(1/60);assert.equal(r.target,r.home);assert(['walking','to-car','driving','home'].includes(r.state));
 });
 check('Vehicle body types have matching distinct collision lengths and fit two narrow lanes',()=>{
  const sedan=t.vehicleBody({type:'sedan'}),coupe=t.vehicleBody({type:'coupe'}),truck=t.vehicleBody({type:'truck'});
  assert(coupe.length<sedan.length&&truck.length>sedan.length*1.25);assert(truck.width>sedan.width);
  assert(t.WLD.roads.every(r=>sedan.width*2<=r.width));
  for(const type of ['sedan','coupe','truck','agent']){const body=t.vehicleBody({type}),car=t.newCar(type,300,300,0);assert(t.carContact(car,{x:300+body.length/2-1,y:300},2));assert.equal(t.carContact(car,{x:300+body.length/2+3,y:300},2),null)}
  const houses=t.buildings.filter(b=>!b.authored);assert(Math.min(...houses.map(b=>Math.min(b.w,b.h)))>=36);assert(new Set(houses.map(b=>b.w+'x'+b.h)).size>=4);
 });
 console.log(JSON.stringify({passed:results.length,checks:results},null,2));
};
