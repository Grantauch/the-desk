/* Ground/air adapter: no direct dependency on the main game's private state.
   One stable craft per pad; saved snapshots never spawn duplicates. */
'use strict';
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.DryAirBridge=api;
})(typeof window!=='undefined'?window:undefined,function(){
 const PI=Math.PI,TAU=PI*2,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const PRESETS=Object.freeze([
  {id:'rotor',type:'rotorcraft',label:'EXPERIMENTAL ROTORCRAFT',pos:[-140,337],a:PI/2},
  {id:'jenny',type:'biplane',label:'JENNY BIPLANE',pos:[-131,172],a:PI/2},
  {id:'fair',type:'balloon',label:'OBSERVATION BALLOON',pos:[-145,515],a:PI/2}
 ]);
 function create({flight,world,blocked,save=null,onChange=()=>{}}){
  if(!flight||!world||typeof blocked!=='function')throw Error('Air bridge requires flight, map and collision');
  const craft=[],pads=[];
  let mounted=null,warningTime=0,clock=0;
  // Keep pads in genuinely open lots. The authored 0.6 town changes can move
  // buildings, so placement probes the finished map rather than hardcoding clearance.
  function placement(p){
    const base=world.P(...p.pos),radius=flight.TYPES[p.type].span*.44;
    for(const distance of [0,35,75,115,160,205,260,315]){
      for(let i=0;i<12;i++){
        const a=i*TAU/12,x=base.x+Math.cos(a)*distance,y=base.y+Math.sin(a)*distance;
        if(!blocked(x,y,radius+11,0))return {x,y};
      }
    }
    throw Error('No clear pad for '+p.id);
  }
  for(const p of PRESETS){
    const at=placement(p);
    pads.push({id:p.id,type:p.type,name:p.label,x:at.x,y:at.y,r:flight.TYPES[p.type].span*.44+14});
    craft.push(flight.create(p.type,at.x,at.y,{id:p.id,a:p.a,home:{x:at.x,y:at.y},lastSafe:{x:at.x,y:at.y}}));
  }
  function snapshot(){
    return {v:1,craft:craft.map(c=>{
      const safe=(!c.landed||blocked(c.x,c.y,flight.TYPES[c.type].span*.44+5,0))?c.lastSafe:{x:c.x,y:c.y};
      return {id:c.id,x:safe.x,y:safe.y,a:c.a,fuel:+clamp(c.fuel,0,flight.TYPES[c.type].fuel).toFixed(2),health:clamp(c.health,1,100)};
    })};
  }
  function restore(raw){
    mounted=null;
    const data=raw&&raw.v===1&&Array.isArray(raw.craft)?raw.craft:[];
    for(let i=0;i<craft.length;i++){
      const old=craft[i],home=pads[i],record=data.find(a=>a&&a.id===old.id);
      const rad=flight.TYPES[old.type].span*.44+5;
      const saved=record&&Number.isFinite(record.x)&&Number.isFinite(record.y)
       &&record.x>=60&&record.x<=world.width-60&&record.y>=60&&record.y<=world.height-60
       &&!blocked(record.x,record.y,rad,0)?record:home;
      craft[i]=flight.create(old.type,saved.x,saved.y,{
        id:old.id,a:Number.isFinite(record?.a)?record.a:PRESETS[i].a,
        home:{x:home.x,y:home.y},lastSafe:{x:saved.x,y:saved.y},
        fuel:clamp(Number(record?.fuel??flight.TYPES[old.type].fuel),0,flight.TYPES[old.type].fuel),
        health:clamp(Number(record?.health??100),1,100)
      });
    }
  }
  restore(save);
  function nearest(player,radius=83){
    if(!player||player.car||mounted)return null;
    let found=null,d=radius;
    for(const c of craft){if(!c.landed||Math.hypot(c.vx,c.vy)>14)continue;
      const now=Math.hypot(player.x-c.x,player.y-c.y);
      if(now<d){d=now;found=c}
    }
    return found;
  }
  function interaction(player){
    if(mounted){
      const c=mounted,speed=Math.hypot(c.vx,c.vy);
      if(c.z>1.2||Math.abs(c.vz)>2)return {handled:true,message:'LAND FIRST · Descend with C before exiting.'};
      if(speed>15)return {handled:true,message:'SLOW DOWN · Release W before leaving the aircraft.'};
      let point=null;
      for(const side of [c.a+PI/2,c.a-PI/2,c.a+PI,c.a]){
        const d=flight.TYPES[c.type].span*.45+19,x=c.x+Math.cos(side)*d,y=c.y+Math.sin(side)*d;
        if(!blocked(x,y,10,0)){point={x,y};break}
      }
      if(!point)return {handled:true,message:'CANOPY BLOCKED · Move to a clear landing spot.'};
      const p=player;mounted=null;p.air=null;p.x=point.x;p.y=point.y;p.a=c.a;p.vx=p.vy=0;
      c.throttle=0;c.vx=c.vy=c.vz=0;c.landed=true;c.lastSafe={x:c.x,y:c.y};
      onChange();
      return {handled:true,kind:'exit',message:'OUT OF THE COCKPIT · Aircraft secured.'};
    }
    const c=nearest(player);
    if(!c)return {handled:false};
    mounted=c;player.air=c;player.car=null;player.x=c.x;player.y=c.y;player.a=c.a;
    player.vx=player.vy=0;onChange();
    return {handled:true,kind:'board',message:flight.TYPES[c.type].name+' · SHIFT climb / C descend.'};
  }
  function tick(player,inputs,dt,wind={}){
    if(!mounted||player.air!==mounted)return null;
    clock+=dt;
    const c=mounted,prev={x:c.x,y:c.y,z:c.z};
    const radius=flight.TYPES[c.type].span*.43;
    flight.step(c,inputs,dt,{width:world.width,height:world.height,windX:wind.x||0,windY:wind.y||0,turbulence:wind.turbulence||0});
    let hit=false;
    const len=Math.hypot(c.x-prev.x,c.y-prev.y,c.z-prev.z),steps=Math.max(1,Math.ceil(len/8));
    for(let i=1;i<=steps;i++){
      const f=i/steps,x=prev.x+(c.x-prev.x)*f,y=prev.y+(c.y-prev.y)*f,z=prev.z+(c.z-prev.z)*f;
      if(blocked(x,y,radius,z)){hit=true;break}
    }
    if(hit){
      const speed=Math.hypot(c.vx,c.vy,c.vz);
      c.x=prev.x;c.y=prev.y;c.z=prev.z;c.vx=c.vy=c.vz=0;c.throttle=0;
      c.health=Math.max(1,c.health-Math.max(1,speed*.04)*dt*10);
      warningTime=clock+2.25;
    }else if(c.landed&&Math.hypot(c.vx,c.vy)<15&&!blocked(c.x,c.y,radius+5,0)){
      c.lastSafe={x:c.x,y:c.y};
    }
    // Air-to-ground transition is real, but an unpowered aircraft never
    // becomes a teleport or a zero-fuel permanently stuck vehicle.
    if(c.landed&&Math.hypot(c.vx,c.vy)<5){
      const pad=pads.find(p=>Math.hypot(p.x-c.x,p.y-c.y)<p.r+75);
      if(pad){c.fuel=Math.min(flight.TYPES[c.type].fuel,c.fuel+dt*13);c.health=Math.min(100,c.health+dt*8)}
    }
    player.x=c.x;player.y=c.y;player.a=c.a;
    player.vx=c.vx;player.vy=c.vy;
    return {hit,warning:clock<warningTime?'ROOF / OBSTACLE · CLIMB OR TURN':null};
  }
  function abandon(player){
    if(!mounted)return;
    const c=mounted,safe=c.lastSafe;
    c.x=safe.x;c.y=safe.y;c.z=0;c.vx=c.vy=c.vz=0;c.throttle=0;c.landed=true;
    mounted=null;if(player)player.air=null;onChange();
  }
  function drawPads(ctx,time,visible=()=>true){
    for(const p of pads){if(!visible(p,130))continue;
      ctx.save();ctx.translate(p.x,p.y);ctx.strokeStyle='#ddc58a99';ctx.lineWidth=2;
      ctx.setLineDash([9,11]);ctx.beginPath();ctx.arc(0,0,p.r+7,0,TAU);ctx.stroke();ctx.setLineDash([]);
      ctx.strokeStyle='#e1c78f88';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-p.r*.45,0);ctx.lineTo(p.r*.45,0);ctx.moveTo(0,-p.r*.45);ctx.lineTo(0,p.r*.45);ctx.stroke();
      ctx.fillStyle='#f5e1b1';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText('AIRFIELD · '+p.id.toUpperCase(),0,-p.r-16);ctx.restore();
    }
  }
  function drawCraft(ctx,time,quality=2,visible=()=>true,phase='air',visual={}){
    for(const c of craft){
      const airborne=c.z>3;
      if((phase==='air')!==airborne||!visible(c,150))continue;
      flight.render(ctx,c,time,{lowDetail:quality<2,reducedMotion:!!visual.reducedMotion,rain:visual.rain||0});
    }
  }
  function map(ctx,point,full=false){
    for(const pad of pads){const q=point(pad);ctx.fillStyle='#f2d09a';ctx.strokeStyle='#111e1d';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(q.x,q.y,full?5:3,0,TAU);ctx.fill();ctx.stroke();
      if(full){ctx.font='bold 8px Arial';ctx.textAlign='center';ctx.fillText('AIRFIELD',q.x,q.y-9)}
    }
  }
  return {craft,pads,nearest,interaction,tick,snapshot,restore,abandon,drawPads,drawCraft,map,
    get mounted(){return mounted},get warning(){return clock<warningTime?'ROOF / OBSTACLE · CLIMB OR TURN':null}};
 }
 return Object.freeze({PRESETS,create});
});
