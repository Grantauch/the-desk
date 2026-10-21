/* Dry County flight experiment — isolated from the 0.6 ground simulation.
 * Units are existing world pixels; altitude is a separate simulation axis.
 * No assets, dependencies, globals other than DryFlight, or persistence required.
 */
'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.DryFlight=api;
})(typeof window!=='undefined'?window:undefined,function(){
  const PI=Math.PI,TAU=PI*2;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const damp=(current,target,k,dt)=>current+(target-current)*(1-Math.exp(-k*dt));
  const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const TYPES=Object.freeze({
    rotorcraft:Object.freeze({name:'County Air Patrol · experimental rotorcraft',period:'Alternate-history prototype, 1926',span:60,accel:105,drag:1.28,turn:1.65,climb:82,ceiling:220,cruise:105,fuel:270,police:true}),
    biplane:Object.freeze({name:'Curtiss JN-4 · Jenny',period:'Period aircraft',span:86,accel:145,drag:.64,turn:1.15,climb:94,ceiling:260,cruise:160,stall:42,fuel:360}),
    balloon:Object.freeze({name:'County Fair Observation Balloon',period:'Period aircraft',span:74,accel:18,drag:1.9,turn:.53,climb:33,ceiling:185,cruise:32,fuel:460})
  });
  function create(type,x,y,options={}){
    if(!TYPES[type])throw new RangeError('Unknown aircraft: '+type);
    if(!Number.isFinite(x)||!Number.isFinite(y))throw new TypeError('Aircraft must have finite coordinates');
    return {type,x,y,z:0,a:options.heading||-PI/2,vx:0,vy:0,vz:0,
      throttle:0,fuel:TYPES[type].fuel,health:100,rotor:0,flightTime:0,
      landed:true,search:null,searchAge:0,...options};
  }
  function step(c,controls={},dt=1/60,environment={}){
    if(!TYPES[c.type])throw new RangeError('Unknown aircraft');
    if(!Number.isFinite(dt)||dt<=0)return c;
    // Integrate in small bounded steps, including when a tab resumes after sleep.
    const steps=Math.ceil(Math.min(dt,.25)/(1/60)),h=Math.min(dt,.25)/steps;
    for(let i=0;i<steps;i++)integrate(c,controls,h,environment);
    return c;
  }
  function integrate(c,input,dt,env){
    const def=TYPES[c.type],forward=clamp(Number(input.forward)||0,-1,1),
      turn=clamp(Number(input.turn)||0,-1,1),lift=clamp(Number(input.lift)||0,-1,1);
    const windX=clamp(Number(env.windX)||0,-30,30),windY=clamp(Number(env.windY)||0,-30,30);
    const powered=c.fuel>0&&c.health>0;
    c.a=angle(c.a+turn*def.turn*dt*(c.type==='biplane'?.35+Math.min(1,Math.hypot(c.vx,c.vy)/65)*.65:1));
    c.throttle=damp(c.throttle,powered?Math.max(0,forward):0,c.type==='biplane'?1.6:2.5,dt);
    const speed=Math.hypot(c.vx,c.vy);
    const thrust=powered?def.accel*c.throttle:0;
    const ax=Math.cos(c.a)*thrust,ay=Math.sin(c.a)*thrust;
    const resist=Math.exp(-def.drag*dt);
    c.vx=(c.vx+ax*dt)*resist;
    c.vy=(c.vy+ay*dt)*resist;
    if(c.type==='balloon'){
      c.vx=damp(c.vx,windX*.85+Math.cos(c.a)*c.throttle*def.cruise,1.1,dt);
      c.vy=damp(c.vy,windY*.85+Math.sin(c.a)*c.throttle*def.cruise,1.1,dt);
    }else if(c.z>0){
      c.vx+=windX*.1*dt;c.vy+=windY*.1*dt;
    }
    const s=Math.hypot(c.vx,c.vy);
    if(s>def.cruise){c.vx*=def.cruise/s;c.vy*=def.cruise/s}
    const canClimb=c.type!=='biplane'||s>=def.stall;
    let upward=(powered&&canClimb?lift*def.climb:0);
    if(c.type==='biplane'&&!canClimb)upward-=58;
    if(!powered&&c.z>0)upward-=50;
    c.vz=clamp((c.vz+upward*dt)*Math.exp(-dt*(c.type==='balloon'?1.75:2.1)),-55,55);
    if(c.z>=def.ceiling&&c.vz>0)c.vz=0;
    c.z=clamp(c.z+c.vz*dt,0,def.ceiling);
    if(c.z===0){c.vz=0;c.landed=true}
    else c.landed=false;
    c.x+=c.vx*dt;c.y+=c.vy*dt;
    // Altitude is not permission to leave the map. Preserve motion at edges without teleporting.
    const width=Number(env.width)||6800,height=Number(env.height)||3300,margin=54;
    if(c.x<margin){c.x=margin;c.vx=Math.max(0,c.vx)}
    if(c.y<margin){c.y=margin;c.vy=Math.max(0,c.vy)}
    if(c.x>width-margin){c.x=width-margin;c.vx=Math.min(0,c.vx)}
    if(c.y>height-margin){c.y=height-margin;c.vy=Math.min(0,c.vy)}
    if(powered&&(c.z>0||c.throttle>.05))c.fuel=Math.max(0,c.fuel-dt*(.17+c.throttle*.36+(c.type==='balloon'&&lift>0?.09:0)));
    c.flightTime+=dt;c.rotor=(c.rotor+dt*(powered?22:4))%TAU;
  }
  function policeInput(c,target,dt){
    if(target&&target.visible!==false&&Number.isFinite(target.x)&&Number.isFinite(target.y)){
      c.search={x:target.x,y:target.y};c.searchAge=0;
    }else c.searchAge+=Math.max(0,dt);
    const goal=c.search;
    if(!goal||c.searchAge>35)return {forward:.18,turn:.23,lift:c.z<85?1:c.z>125?-1:0,searching:true};
    const dx=goal.x-c.x,dy=goal.y-c.y,d=Math.hypot(dx,dy);
    const off=angle(Math.atan2(dy,dx)-c.a);
    const aim=clamp(off*1.4,-1,1);
    const wantedAltitude=clamp(d*.13,68,140);
    return {forward:d>160?.85:d>65?.36:0,turn:aim,lift:c.z<wantedAltitude-7?1:c.z>wantedAltitude+7?-1:0,searching:c.searchAge>0};
  }
  function updatePolice(c,target,dt,environment={}){
    const command=policeInput(c,target,dt);
    step(c,command,dt,environment);
    return command;
  }
  function render(ctx,c,time=0,options={}){
    const def=TYPES[c.type];if(!def)return;
    const low=!!options.lowDetail,shadowAlpha=clamp(.3-c.z/700,.07,.30);
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,'+shadowAlpha+')';ctx.beginPath();
    ctx.ellipse(c.x+c.z*.26,c.y+c.z*.31,def.span*.53+c.z*.08,def.span*.22+c.z*.045,c.a,0,TAU);ctx.fill();
    // Rotor downwash / grass and road grit, only near the ground.
    if(!low&&c.type==='rotorcraft'&&c.z>2&&c.z<52){
      const p=1-c.z/52;
      ctx.strokeStyle='rgba(219,200,148,'+(p*.22)+')';ctx.lineWidth=1.3;
      for(let i=0;i<5;i++){const a=time*1.8+i*TAU/5;
        ctx.beginPath();ctx.arc(c.x+Math.cos(a)*24,c.y+Math.sin(a)*24,14+p*24,a,a+1.45);ctx.stroke();
      }
    }
    if(def.police&&c.z>15&&options.beamTarget&&!low){
      const t=options.beamTarget;
      ctx.fillStyle='rgba(244,224,161,.065)';ctx.strokeStyle='rgba(244,224,161,.25)';
      ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(c.x,c.y);
      ctx.lineTo(t.x-32,t.y-32);ctx.arc(t.x,t.y,45,Math.PI*1.25,Math.PI*-.25);
      ctx.closePath();ctx.fill();ctx.beginPath();ctx.arc(t.x,t.y,45,0,TAU);ctx.stroke();
    }
    ctx.translate(c.x,c.y);
    ctx.rotate(c.a);
    // Top-down artwork scales modestly with altitude while the shadow stays on the ground.
    ctx.scale(1+Math.min(c.z/950,.2),1+Math.min(c.z/950,.2));
    if(c.type==='rotorcraft'){
      ctx.fillStyle='#1c2628';ctx.fillRect(-53,-4,56,8);
      ctx.fillStyle='#67766d';ctx.fillRect(-51,-15,16,30);
      ctx.fillStyle='#22363a';ctx.beginPath();ctx.ellipse(5,0,36,17,0,0,TAU);ctx.fill();
      ctx.fillStyle='#889b94';ctx.beginPath();ctx.ellipse(14,0,19,12,0,0,TAU);ctx.fill();
      ctx.strokeStyle='#c9cebf';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-22,-21);ctx.lineTo(19,-21);ctx.moveTo(-22,21);ctx.lineTo(19,21);ctx.stroke();
      ctx.save();ctx.rotate(c.rotor);ctx.strokeStyle='rgba(225,229,211,'+(low?.65:.45)+')';
      ctx.lineWidth=low?5:7;ctx.beginPath();ctx.moveTo(-43,0);ctx.lineTo(43,0);ctx.stroke();
      ctx.strokeStyle='#1f2629';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-43);ctx.lineTo(0,43);ctx.stroke();ctx.restore();
      ctx.fillStyle='#f0d397';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText('LAW',3,3);
    }else if(c.type==='biplane'){
      ctx.fillStyle='#ad9470';ctx.fillRect(-12,-40,25,80);
      ctx.fillStyle='#705b3f';ctx.fillRect(-26,-34,13,68);
      ctx.fillStyle='#6e4233';ctx.beginPath();ctx.ellipse(0,0,43,8,0,0,TAU);ctx.fill();
      ctx.fillStyle='#d7b783';ctx.fillRect(-19,-12,40,24);
      ctx.fillStyle='#394647';ctx.beginPath();ctx.arc(10,0,7,0,TAU);ctx.fill();
      ctx.save();ctx.translate(44,0);ctx.rotate(c.rotor);ctx.strokeStyle='#ddd0a3';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-18);ctx.lineTo(0,18);ctx.stroke();ctx.restore();
    }else{
      ctx.fillStyle='#6c5035';ctx.fillRect(-11,-7,22,14);
      ctx.strokeStyle='#cab286';ctx.lineWidth=1.2;for(const y of [-9,9]){ctx.beginPath();ctx.moveTo(-11,y);ctx.lineTo(-16,y*1.5);ctx.stroke();}
      ctx.fillStyle='#e5c392';ctx.beginPath();ctx.ellipse(0,0,37,27,0,0,TAU);ctx.fill();
      ctx.strokeStyle='#9c774c';ctx.lineWidth=2;for(const y of [-14,0,14]){ctx.beginPath();ctx.moveTo(-31,y);ctx.lineTo(31,y);ctx.stroke();}
    }
    // Position lights are purpose-built vectors: no per-frame generated sprites.
    if(c.type!=='balloon'&&Math.sin(time*5)>0){ctx.fillStyle='#f9edba';ctx.beginPath();ctx.arc(0,-def.span*.44,3,0,TAU);ctx.fill();
      ctx.fillStyle='#de7c62';ctx.beginPath();ctx.arc(0,def.span*.44,3,0,TAU);ctx.fill();}
    ctx.restore();
  }
  return Object.freeze({TYPES,create,step,policeInput,updatePolice,render});
});
