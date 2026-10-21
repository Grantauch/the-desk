/* Dry County flight sound bed — two reusable Web Audio voices, no samples.
   Never starts until the game's sound gesture has already unlocked AudioContext.
   No oscillator allocation in update() and no claims of real recorded 1926 audio. */
'use strict';
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.DryAirAudio=api;
})(typeof window!=='undefined'?window:undefined,function(){
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function create(context,bus){
  if(!context||!bus)return {update:()=>{},dispose:()=>{},stats:()=>({voices:0})};
  const voices=[];
  function voice(){
   const main=context.createOscillator(),beat=context.createOscillator(),
     low=context.createBiquadFilter(),output=context.createGain();
   main.type='sawtooth';main.frequency.value=60;
   beat.type='triangle';beat.frequency.value=23;
   low.type='lowpass';low.frequency.value=430;
   output.gain.value=0;
   main.connect(low);beat.connect(low);low.connect(output);output.connect(bus);
   main.start();beat.start();
   const obj={main,beat,low,output};voices.push(obj);return obj;
  }
  const own=voice(),law=voice();
  function set(v,c,listener,enabled,now){
   const position=listener||{x:0,y:0},dx=(c?.x||0)-position.x,dy=(c?.y||0)-position.y,
     dist=Math.hypot(dx,dy);
   // The pilot is always audible; law air unit attenuates with world distance.
   const near=v===own?1:clamp(1-dist/1000,0,1);
   const powered=!!c&&c.fuel>0&&c.health>0;
   const amp=enabled&&powered?near*(v===own?.057:.065):0;
   const speed=c?Math.hypot(c.vx||0,c.vy||0):0;
   const load=c?clamp((c.throttle||0),0,1):0;
   const rotor=c?.type==='rotorcraft',balloon=c?.type==='balloon';
   const source=balloon?35:rotor?52:85;
   // Relative radial speed: approaching craft raises frequency slightly.
   const vr=dist>1?(((c?.vx||0)-(position.vx||0))*dx+((c?.vy||0)-(position.vy||0))*dy)/dist:0;
   const doppler=clamp(1-vr/1600,.91,1.09);
   const pitch=source*(.86+load*.24+Math.min(1,speed/170)*.16)*doppler;
   v.main.frequency.setTargetAtTime(pitch,now,.11);
   v.beat.frequency.setTargetAtTime(balloon?28:rotor?pitch*.46:pitch*.8,now,.13);
   v.low.frequency.setTargetAtTime(balloon?175:rotor?350+load*280:650+load*400,now,.15);
   v.output.gain.setTargetAtTime(amp,now,.15);
   return amp;
  }
  let last={own:0,law:0};
  function update({pilot=null,police=null,listener=null,enabled=false}={}){
   const t=context.currentTime;
   last={own:set(own,pilot,listener,enabled,t),law:set(law,police,listener,enabled,t)};
   return last;
  }
  function dispose(){
   for(const v of voices){v.output.gain.value=0;v.main.stop();v.beat.stop();v.main.disconnect();v.beat.disconnect();v.low.disconnect();v.output.disconnect()}
   voices.length=0;
  }
  return {update,dispose,stats:()=>({voices:voices.length,levels:{...last}})};
 }
 return Object.freeze({create});
});
