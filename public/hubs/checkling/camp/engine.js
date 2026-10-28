/* First Trail: an isolated, local sample-state playtest. No school-service contracts. */
(function(root){
 'use strict';
 const SPECIES={
  mochi:{name:'Mochi',region:'Meadows',title:'A very small optimist',color:'#b8d885',personality:'Affectionate, earnest, easily delighted.',preference:'Play, then a quiet rest.',verb:'Tend the seedlings',finds:['a curled moonbean seed','a tiny garden spring','a night-blooming water lily'],signature:'Comfort blanket',signatureHint:'9 damage and a 12-point shield for this turn.'},
  bolt:{name:'Bolt',region:'Mechanical frontier',title:'Chief inspector of pebbles',color:'#f3ce75',personality:'Investigates everything. Especially the things that do nothing.',preference:'A little study, with breaks.',verb:'Inspect the mechanism',finds:['a brass seed counter','a working waterwheel cog','a little star-shaped dial'],signature:'Salvage charge',signatureHint:'13 damage, plus 8 per stored block charge (maximum 2).'},
  zee:{name:'Zee',region:'Cosmic expanse',title:'Head in the constellations',color:'#c3b9ec',personality:'A dreamy observer with oddly specific questions.',preference:'Quiet observation and a clean place to rest.',verb:'Look for a pattern',finds:['a spiral in the seed heads','a waterwheel shadow clock','a reflected constellation'],signature:'Orbit',signatureHint:'Alternates: 21 damage, then 13 damage with an 8-point shield.'},
  ember:{name:'Ember',region:'Volcanic wastes',title:'Brave enough for both of you',color:'#efb07c',personality:'Protective, proud, and an accidental cook.',preference:'A meal and wing-rest after a trip.',verb:'Warm the old clay',finds:['a fired-clay seed marker','a mended clay water spout','a little lantern bowl'],signature:'Banked heat',signatureHint:'14 damage. Recover stores heat for one 26-damage burst.'}
 };
 const IDS=Object.keys(SPECIES);
 const STOPS=[{id:'garden',name:'The seed gate',eyebrow:'01 / THE GARDEN',text:'A gate leans into the path. Underneath it, a row of forgotten seedlings waits for a little attention.',icon:'sprout'}, {id:'mill',name:'The old waterwheel',eyebrow:'02 / THE STREAM',text:'The waterwheel clicks once, then stops. A narrow channel carries the stream past a patch of thirsty moss.',icon:'wheel'}, {id:'pond',name:'The star pond',eyebrow:'03 / THE CLEARING',text:'A quiet pool holds the sky. Something small catches the light between the reeds.',icon:'star'}];
 const DECOR=[{id:'planter',name:'Moonbean planter',cost:3,description:'Grown from the discoveries you brought home.'},{id:'lantern',name:'Clay lantern',cost:6,description:'A small warm light beside the trail.'},{id:'pennants',name:'Trail pennants',cost:9,description:'A little celebration for a well-loved clearing.'}];
 const clean=(s,n=160)=>typeof s==='string'?s.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,n):'';
 const num=(v,def=0,min=0,max=100)=>Number.isFinite(v)?Math.max(min,Math.min(max,Math.round(v))):def;
 function initial(){const pets={};for(const id of IDS)pets[id]={nickname:'',food:70,energy:80,clean:75,joy:65,bond:0,discoveries:[],memories:[],care:[],battles:0};return {format:'checklings-first-trail',version:1,selected:'mochi',stop:0,weather:'sun',quiet:false,decor:[],equipped:'',pets,revision:0};}
 function hydrate(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.format!=='checklings-first-trail'||raw.version!==1)throw Error('This is not a First Trail version 1 save. Your current companions are unchanged.');
  const s=initial();s.selected=IDS.includes(raw.selected)?raw.selected:'mochi';s.stop=num(raw.stop,0,0,2);s.weather=['sun','rain','dusk'].includes(raw.weather)?raw.weather:'sun';s.quiet=raw.quiet===true;s.revision=num(raw.revision,0,0,1000000);
  for(const id of IDS){const p=raw.pets?.[id];if(!p||typeof p!=='object'||Array.isArray(p))throw Error('The save is missing a founder. Your current companions are unchanged.');const q=s.pets[id];q.nickname=clean(p.nickname,24);for(const key of ['food','energy','clean','joy','bond'])q[key]=num(p[key],q[key]);q.battles=num(p.battles,0,0,1);q.discoveries=Array.isArray(p.discoveries)?[...new Set(p.discoveries.filter(x=>Number.isInteger(x)&&x>=0&&x<3))]:[];q.care=Array.isArray(p.care)?[...new Set(p.care.filter(x=>['feed','play','rest','clean','observe'].includes(x)))]:[];q.memories=Array.isArray(p.memories)?p.memories.filter(x=>x&&typeof x.id==='string'&&typeof x.text==='string').slice(-24).map(x=>({id:clean(x.id,60),text:clean(x.text,200)})):[];}
  s.decor=Array.isArray(raw.decor)?[...new Set(raw.decor.filter(x=>DECOR.some(d=>d.id===x&&stamps(s)>=d.cost)))]:[];s.equipped=s.decor.includes(raw.equipped)?raw.equipped:'';return s;
 }
 function name(s,id=s.selected){return s.pets[id].nickname||SPECIES[id].name;}
 function memory(p,id,text){if(p.memories.some(m=>m.id===id))return false;p.memories.push({id,text});p.memories=p.memories.slice(-24);return true;}
 function stamps(s){return IDS.reduce((n,id)=>n+s.pets[id].discoveries.length+s.pets[id].battles,0);}
 function dispatch(state,action){
  const s=hydrate(state),p=s.pets[s.selected],id=s.selected;let message='',changed=false;
  if(!action||typeof action!=='object')return {state:s,message:'Choose an activity.',changed:false};
  const remember=(key,text)=>memory(p,key,text);
  switch(action.type){
   case 'select':if(IDS.includes(action.id)&&action.id!==s.selected){s.selected=action.id;changed=true;message=name(s)+' is ready for a little company.';}break;
   case 'stop':if(Number.isInteger(action.value)&&action.value>=0&&action.value<3&&action.value!==s.stop){s.stop=action.value;changed=true;message=STOPS[s.stop].name+'. Take your time.';}break;
   case 'weather':if(['sun','rain','dusk'].includes(action.value)&&s.weather!==action.value){s.weather=action.value;changed=true;message={sun:'Warm light returns to the clearing.',rain:'A passing shower. Everyone can find shelter.',dusk:'Lantern hour. The pond begins to hold the stars.'}[s.weather];}break;
   case 'quiet':s.quiet=!s.quiet;changed=true;message=s.quiet?'Quiet mode on. All activities still work.':'A little movement returns to the clearing.';break;
   case 'rename':{const nick=clean(action.value,24).trim();if(nick!==p.nickname){p.nickname=nick;changed=true;message='Your companion is now called '+name(s)+'.';}break;}
   case 'feed':if(p.food>=90){message=name(s)+' is comfortably full. Save that snack for later.';break;}p.food=Math.min(100,p.food+28);p.joy=Math.min(100,p.joy+5);p.bond=Math.min(100,p.bond+3);message=name(s)+(id==='ember'?' warms the bowl, then gives you a very satisfied look.':' settles down with a little meal.');changed=true;break;
   case 'rest':if(p.energy>=95&&p.joy>=75){message=name(s)+' is already well rested. A quiet moment is welcome anyway.';break;}p.energy=100;p.joy=Math.min(100,p.joy+12);p.bond=Math.min(100,p.bond+2);message=name(s)+' rests in the shelter. Energy restored, with no cost.';if(p.care.includes('play')&&id==='mochi')remember('care-routine','You played together, then made room for a quiet rest. Mochi liked that rhythm.');changed=true;break;
   case 'clean':if(p.clean>=95){message='The resting place is already clean and comfortable.';break;}p.clean=100;p.joy=Math.min(100,p.joy+8);p.bond=Math.min(100,p.bond+2);message=name(s)+(id==='zee'?' inspects the clean blanket, then curls up to watch the sky.':' helps tidy the resting place.');changed=true;break;
   case 'play':if(p.energy<25){message=name(s)+' needs a rest first. Rest is always available.';break;}if(p.joy>=95&&p.care.includes('play')){message=name(s)+' is happily played out. Try a gentle walk or a rest.';break;}p.energy-=15;p.food=Math.max(0,p.food-8);p.clean=Math.max(0,p.clean-8);p.joy=Math.min(100,p.joy+25);p.bond=Math.min(100,p.bond+5);message=name(s)+(id==='bolt'?' invents a game with a completely ordinary pebble.':' chases a drifting leaf, then looks back to see if you noticed.');changed=true;break;
   case 'observe':if(!remember('observe-'+s.stop,name(s)+' shared a quiet moment at '+STOPS[s.stop].name.toLowerCase()+'.')){message='You sit quietly. This moment is already in your journal.';break;}p.bond=Math.min(100,p.bond+3);message=name(s)+(id==='zee'?' follows a pattern in the light. You wait together.':' leans closer. There is no hurry.');changed=true;break;
   case 'discover':if(p.discoveries.includes(s.stop)){message='You already recorded '+SPECIES[id].finds[s.stop]+'. Try another founder’s way of looking.';break;}if(p.energy<18){message=name(s)+' needs a rest before exploring. You can always return home.';break;}p.energy-=18;p.food=Math.max(0,p.food-8);p.clean=Math.max(0,p.clean-5);p.bond=Math.min(100,p.bond+8);p.discoveries.push(s.stop);remember('find-'+s.stop,'At '+STOPS[s.stop].name.toLowerCase()+', '+name(s)+' found '+SPECIES[id].finds[s.stop]+'.');message=name(s)+' discovered '+SPECIES[id].finds[s.stop]+'. One trail stamp earned.';changed=true;break;
   case 'unlock':{const d=DECOR.find(x=>x.id===action.id);if(!d)break;if(stamps(s)<d.cost){message='Collect '+d.cost+' trail stamps through discovery or practice. Stamps are milestones, so they are never spent.';break;}if(!s.decor.includes(d.id)){s.decor.push(d.id);changed=true;}if(s.equipped!==d.id){s.equipped=d.id;changed=true;}message=d.name+' is now in your clearing.';break;}
   case 'battle-win':if(p.battles){message='A fine rematch. The practice badge is already in your journal.';break;}p.battles=1;remember('practice','Completed a friendly practice against the training dummy. No injuries.');message=name(s)+' earned a practice badge and one trail stamp. Everyone returns healthy.';changed=true;break;
   default:message='Choose an activity.';
  }
  if(changed){if(['feed','rest','clean','play','observe'].includes(action.type)&&!p.care.includes(action.type))p.care.push(action.type);s.revision=Math.min(1000000,s.revision+1);}
  return {state:s,message,changed};
 }
 function startBattle(id){if(!IDS.includes(id))throw Error('Choose a founder.');const fighters={};for(const key of IDS)fighters[key]={hp:65,stamina:10,charge:0,orbit:0,heat:0};return {active:id,fighters,enemy:125,turn:0,round:1,log:[],result:null};}
 const intents=[{name:'Measured strike',detail:'12 damage. Guard reduces it to 3.',damage:12},{name:'Winding up',detail:'No attack this turn. A heavy hit is coming.',damage:0},{name:'Heavy swing',detail:'28 damage. A good moment to guard.',damage:28},{name:'Cooling down',detail:'No attack this turn. A good moment to recover.',damage:0}];
 function battleMove(raw,move,swap){
  const b=JSON.parse(JSON.stringify(raw));if(b.result)return {battle:b,message:'Practice has finished.',changed:false};const p=b.fighters[b.active];let damage=0,shield=0,guard=false,msg='';
  if(move==='switch'){if(!IDS.includes(swap)||swap===b.active||b.fighters[swap].hp<=0)return {battle:b,message:'Choose another available companion.',changed:false};b.active=swap;msg=SPECIES[swap].name+' steps in.';}
  else if(p.hp<=0)return {battle:b,message:'Choose another companion to continue, or leave practice.',changed:false};
  else if(move==='strike'){if(p.stamina<3)return {battle:b,message:'Not enough stamina. Guard or recover.',changed:false};p.stamina-=3;damage=16;msg='A careful strike.';}
  else if(move==='signature'){if(p.stamina<5)return {battle:b,message:'Not enough stamina for a signature. Guard or recover.',changed:false};p.stamina-=5;if(b.active==='mochi'){damage=9;shield=12;}if(b.active==='bolt'){damage=13+8*p.charge;p.charge=0;}if(b.active==='zee'){damage=p.orbit===0?21:13;shield=p.orbit===0?0:8;p.orbit=1-p.orbit;}if(b.active==='ember'){damage=p.heat?26:14;p.heat=0;}msg=SPECIES[b.active].signature+'.';}
  else if(move==='guard'){guard=true;p.stamina=Math.min(10,p.stamina+2);msg='Braced for the next move.';}
  else if(move==='recover'){p.stamina=Math.min(10,p.stamina+5);if(b.active==='ember')p.heat=1;msg='Stamina recovered'+(b.active==='ember'?'; a little heat banked.':'.');}
  else return {battle:b,message:'Choose a practice move.',changed:false};
  b.enemy=Math.max(0,b.enemy-damage);if(damage)msg+=' '+damage+' damage.';
  if(b.enemy===0){b.result='win';msg+=' Practice complete. No one is hurt.';}
  else {const target=b.fighters[b.active],hit=intents[b.turn%4].damage;const taken=guard?Math.ceil(hit*.25):Math.max(0,hit-shield);target.hp=Math.max(0,target.hp-taken);if(b.active==='bolt'&&hit>0&&(guard||shield>0))target.charge=Math.min(2,target.charge+1);if(hit)msg+=' Dummy dealt '+taken+' practice damage.';if(!IDS.some(id=>b.fighters[id].hp>0)){b.result='loss';msg+=' Practice ends. Everyone returns healthy; try guarding the heavy swing.';}}
  b.turn++;b.round++;b.log.unshift(msg);b.log=b.log.slice(0,8);return {battle:b,message:msg,changed:true};
 }
 const api={SPECIES,IDS,STOPS,DECOR,initial,hydrate,dispatch,name,stamps,startBattle,battleMove,intents};root.FirstTrail=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
