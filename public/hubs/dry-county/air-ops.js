/* Dry County Flight B3 — altitude-aware law patrol and optional air courier.
   No direct coupling to game globals. Ground police receive verified sightings only.
   Experimental police rotorcraft is deliberately alternate-history for 1926. */
'use strict';
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.DryAirOps=api;
})(typeof window!=='undefined'?window:undefined,function(){
 const PI=Math.PI,TAU=PI*2,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const norm=a=>Math.atan2(Math.sin(a),Math.cos(a));
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const ROUTE=Object.freeze([[.13,.22],[.37,.23],[.67,.38],[.75,.68],[.42,.74],[.19,.54]]);
 const STOPS=Object.freeze([{name:'WOODLAND CACHE',at:[180,425]},{name:'FREIGHT LOOKOUT',at:[495,435]}]);
 function create({flight,world,blocked,onCourier=()=>{}}){
  if(!flight||!world||typeof blocked!=='function')throw Error('Air operations require flight, world and collision');
  const base={x:world.width*.085,y:world.height*.24},points=ROUTE.map(([x,y])=>({x:world.width*x,y:world.height*y}));
  let c=null,phase='off',index=0,clock=0,scan=0,spotted=false,lastSight=-100,seenCount=0,cooldown=0;
  let courier=null;
  const drops=STOPS.map(s=>({...s,x:world.P(...s.at).x,y:world.P(...s.at).y}));
  function clearPolice(){c=null;phase='off';index=0;spotted=false;lastSight=-100;seenCount=0;scan=0;}
  function reset(){clearPolice();courier=null;clock=0;cooldown=0}
  function deploy(){
   c=flight.create('rotorcraft',base.x,base.y,{id:'law-air-one',z:110,landed:false,a:0,search:null,searchAge:0,fuel:flight.TYPES.rotorcraft.fuel});
   index=0;phase='patrol';scan=0;spotted=false;lastSight=-100;seenCount=0;
  }
  // Ray is tested in XYZ, not against 2D ground sight. Roofs block the
  // sloped observation ray even if the rotorcraft is above the building.
  function clearSight(from,to){
    const d=distance(from,to),dz=(to.z||0)-(from.z||0),n=Math.ceil(d/20);
    if(n<2)return true;
    for(let i=1;i<n;i++){
     const f=i/n,x=from.x+(to.x-from.x)*f,y=from.y+(to.y-from.y)*f,z=(from.z||0)+dz*f;
     if(blocked(x,y,2,z))return false;
    }
    return true;
  }
  function canSpot(air,target,rain=0,night=0){
   if(!air||!target||!Number.isFinite(target.x)||!Number.isFinite(target.y))return false;
   const r=distance(air,target),height=Math.abs(air.z-(target.z||0));
   const range=clamp(610*(1-clamp(rain,0,1)*.4-clamp(night,0,1)*.14),295,650);
   if(r>range||height>210)return false;
   const aim=Math.abs(norm(Math.atan2(target.y-air.y,target.x-air.x)-air.a));
   const maxAngle=r<80?.96:.78; // beam-facing search; no rear omniscience
   if(aim>maxAngle)return false;
   return clearSight(air,target);
  }
  function flyTo(goal,dt,wind,altitude=112){
   const dx=goal.x-c.x,dy=goal.y-c.y,d=Math.hypot(dx,dy);
   const turn=clamp(norm(Math.atan2(dy,dx)-c.a)*1.65,-1,1);
   const input={forward:d>200?.82:d>65?.48:.14,turn,lift:c.z<altitude-9?1:c.z>altitude+9?-1:0};
   flight.step(c,input,dt,{width:world.width,height:world.height,windX:wind.x||0,windY:wind.y||0,turbulence:wind.turbulence||0});
   return d;
  }
  function tickLaw(dt,{heat=0,player=null,wind={},rain=0,night=0,search=null}={}){
   if(!Number.isFinite(dt)||dt<=0)return {visible:false,justSpotted:false,phase};
   const step=Math.min(dt,.25);clock+=step;cooldown=Math.max(0,cooldown-step);
   if(!c){if(heat>=56&&cooldown<=0)deploy();else return {visible:false,justSpotted:false,phase};}
   const target=player?{x:player.x,y:player.y,z:player.air?.z||0,vx:player.air?.vx||player.car?.vx||player.vx||0,vy:player.air?.vy||player.car?.vy||player.vy||0}:null;
   // A wanted helicopter never learns a new live position unless the
   // altitude/FOV/rain/roof checks above succeed.
   spotted=heat>=15&&canSpot(c,target,rain,night);
   let justSpotted=false;
   if(spotted){
    if(phase!=='track')justSpotted=true;
    lastSight=clock;seenCount++;phase='track';
    flight.updatePolice(c,{x:target.x,y:target.y,visible:true},step,{width:world.width,height:world.height,windX:wind.x||0,windY:wind.y||0,turbulence:wind.turbulence||0});
   }else if(c.search&&c.searchAge<28&&heat>=15){
    phase='search';
    flight.updatePolice(c,null,step,{width:world.width,height:world.height,windX:wind.x||0,windY:wind.y||0,turbulence:wind.turbulence||0});
   }else if(heat>=15){
    phase='patrol';
    // Ground squad search locations are already last-reported knowledge;
    // never borrow player.x/player.y when no aircraft sight exists.
    const point=search&&Number.isFinite(search.x)&&Number.isFinite(search.y)&&clock-lastSight>30?search:points[index];
    const d=flyTo(point,step,wind,118);
    if(d<95&&point===points[index])index=(index+1)%points.length;
   }else{
    phase='return';
    const d=flyTo(base,step,wind,120);
    if(d<90){clearPolice();cooldown=18;return {visible:false,justSpotted:false,phase};}
   }
   // Roof safety while turning at lower altitude.
   if(c&&blocked(c.x,c.y,22,c.z)){c.z=Math.min(flight.TYPES.rotorcraft.ceiling,c.z+40);c.vz=Math.max(c.vz,8)}
   // If the patrol runs out of fuel, it must retire rather than magically
   // keep pursuing. New patrol can only spawn after a cooldown.
   if(c&&c.fuel<=0){clearPolice();cooldown=90;return {visible:false,justSpotted:false,phase};}
   return {visible:spotted,justSpotted,phase,lastKnown:c?.search?{x:c.search.x,y:c.search.y}:null};
  }
  function startCourier(player){
   if(!player?.air)return {ok:false,message:'BOARD AN AIRCRAFT TO TAKE THIS RUN'};
   if(courier)return {ok:false,message:'AIR COURIER ALREADY ACTIVE'};
   if(player.air.z>12||distance(player,player.air.home)>170)return {ok:false,message:'START THIS RUN AT YOUR AIRFIELD'};
   courier={stage:0,time:255,airId:player.air.id,flown:0,completed:0};
   onCourier('start',{stage:0});
   return {ok:true,message:'AIR COURIER · TWO HIGH-ALTITUDE DROPS · RETURN TO ANY AIRFIELD'};
  }
  function tickCourier(dt,{player=null,pads=[]}={}){
   if(!courier)return null;
   const q=courier,air=player?.air;
   q.time=Math.max(0,q.time-Math.min(dt,.25));
   if(q.time===0||!air||air.id!==q.airId||air.fuel<=0){
    const why=q.time===0?'TIME EXPIRED':air?.fuel<=0?'OUT OF FUEL':'AIRCRAFT LEFT';
    courier=null;onCourier('fail',{message:why});return {failed:true,message:why};
   }
   q.flown+=Math.hypot(air.vx,air.vy)*Math.min(dt,.25);
   if(q.stage<drops.length){
    const drop=drops[q.stage];
    if(distance(player,drop)<125&&air.z>=60&&air.z<=220){
     q.stage++;q.completed++;onCourier('drop',{stage:q.stage,name:drop.name});
     return {drop:true,name:drop.name,stage:q.stage};
    }
   }else if(air.landed&&air.z<1.2&&Math.hypot(air.vx,air.vy)<18&&pads.some(p=>distance(player,p)<p.r+125)){
    const reward=42,xp=65;courier=null;onCourier('complete',{reward,xp});
    return {complete:true,reward,xp};
   }
   return {active:true,stage:q.stage,time:q.time};
  }
  function draw(ctx,time,quality=2,visible=()=>true,visual={}){
   if(c&&visible(c,210)){const beam=spotted&&c.search?{x:c.search.x,y:c.search.y}:c.search&&c.searchAge<22?c.search:{x:c.x+Math.cos(c.a)*145,y:c.y+Math.sin(c.a)*145};
    flight.render(ctx,c,time,{lowDetail:quality<2,reducedMotion:!!visual.reducedMotion,rain:visual.rain||0,beamTarget:visual.lights===false?null:beam,beamStrength:spotted?1:phase==='search'?.56:.28});
    if(quality>=2&&beam&&visual.lights!==false){ctx.save();ctx.strokeStyle=spotted?'rgba(250,221,128,.45)':'rgba(247,218,143,.16)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(beam.x,beam.y,30+Math.sin(time*4)*3,0,TAU);ctx.stroke();ctx.restore();}
   }
   if(courier){const drop=drops[courier.stage];if(drop&&visible(drop,180)){
    ctx.save();ctx.strokeStyle='#e8c47d';ctx.lineWidth=3;ctx.setLineDash([10,8]);ctx.lineDashOffset=-time*14;
    ctx.beginPath();ctx.arc(drop.x,drop.y,105+Math.sin(time*2)*3,0,TAU);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#f3deb2';ctx.font='bold 12px Arial';ctx.textAlign='center';ctx.fillText('AIR DROP '+(courier.stage+1)+'/2 · 60–220 FT',drop.x,drop.y-120);ctx.restore();
   }}
  }
  function map(ctx,point,full=false){
   if(c){const p=point(c);ctx.fillStyle=spotted?'#f5a17e':'#8ab3df';ctx.strokeStyle='#0c1b22';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x,p.y-5);ctx.lineTo(p.x+5,p.y);ctx.lineTo(p.x,p.y+5);ctx.lineTo(p.x-5,p.y);ctx.closePath();ctx.fill();ctx.stroke();}
   if(courier){const obj=drops[courier.stage];if(obj){const p=point(obj);ctx.fillStyle='#e9c67b';ctx.fillRect(p.x-4,p.y-4,8,8)}}
  }
  function courierText(){
   if(!courier)return '';
   const objective=drops[courier.stage]?.name||'RETURN TO AIRFIELD · LAND';
   return 'COURIER '+Math.max(0,Math.ceil(courier.time))+'s · '+objective;
  }
  return {tickLaw,tickCourier,startCourier,clearSight,canSpot,draw,map,reset,courierText,
   get aircraft(){return c},get phase(){return phase},get visible(){return spotted},get lastSighting(){return lastSight},get courier(){return courier},get drops(){return drops}};
 }
 return Object.freeze({ROUTE,STOPS,create});
});
