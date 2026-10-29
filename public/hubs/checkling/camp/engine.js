/* Pixel Camp 6 engine: pure camp rules. No school-service contracts live here.
   Version 1 saves (Pixel Camp 4.x) load unchanged and upgrade in memory to version 3. */
(function(root){
 'use strict';
 const SPECIES={
  mochi:{name:'Mochi',region:'Meadows',title:'A very small optimist',color:'#b8d885',personality:'Affectionate, earnest, easily delighted.',preference:'Play, then a quiet rest.',verb:'Tend the seedlings',finds:['a curled moonbean seed','a tiny garden spring','a night-blooming water lily'],signature:'Comfort blanket',signatureHint:'9 damage and a 12-point shield for this turn.',forage:'sniffs around and tugs at something half buried'},
  bolt:{name:'Bolt',region:'Mechanical frontier',title:'Chief inspector of pebbles',color:'#f3ce75',personality:'Investigates everything. Especially the things that do nothing.',preference:'A little study, with breaks.',verb:'Inspect the mechanism',finds:['a brass seed counter','a working waterwheel cog','a little star-shaped dial'],signature:'Salvage charge',signatureHint:'13 damage, plus 8 per stored block charge (maximum 2).',forage:'taps the ground three times, then digs exactly once'},
  zee:{name:'Zee',region:'Cosmic expanse',title:'Head in the constellations',color:'#c3b9ec',personality:'A dreamy observer with oddly specific questions.',preference:'Quiet observation and a clean place to rest.',verb:'Look for a pattern',finds:['a spiral in the seed heads','a waterwheel shadow clock','a reflected constellation'],signature:'Orbit',signatureHint:'Alternates: 21 damage, then 13 damage with an 8-point shield.',forage:'stares at one spot until something glints'},
  ember:{name:'Ember',region:'Volcanic wastes',title:'Brave enough for both of you',color:'#efb07c',personality:'Protective, proud, and an accidental cook.',preference:'A meal and wing-rest after a trip.',verb:'Warm the old clay',finds:['a fired-clay seed marker','a mended clay water spout','a little lantern bowl'],signature:'Banked heat',signatureHint:'14 damage. Recover stores heat for one 26-damage burst.',forage:'warms the ground and something wriggles loose'}
 };
 const IDS=Object.keys(SPECIES);
 const STOPS=[{id:'garden',name:'The seed gate',eyebrow:'01 / THE GARDEN',text:'A gate leans into the path. Underneath it, a row of forgotten seedlings waits for a little attention.',icon:'sprout'}, {id:'mill',name:'The old waterwheel',eyebrow:'02 / THE STREAM',text:'The waterwheel clicks once, then stops. A narrow channel carries the stream past a patch of thirsty moss.',icon:'wheel'}, {id:'pond',name:'The star pond',eyebrow:'03 / THE CLEARING',text:'A quiet pool holds the sky. Something small catches the light between the reeds.',icon:'star'}];
 const DECOR=[
  {id:'planter',name:'Moonbean planter',cost:3,description:'Grown from the discoveries you brought home.'},
  {id:'lantern',name:'Clay lantern',cost:6,description:'A small warm light beside the trail.'},
  {id:'pennants',name:'Trail pennants',cost:9,description:'A little celebration for a well-loved clearing.'},
  {id:'shelf',name:'Curio shelf',cost:12,description:'Somewhere to keep the small things you find.'},
  {id:'campfire',name:'Campfire ring',cost:16,description:'Everyone gathers when the fire is going.'},
  {id:'chimes',name:'Wind chimes',cost:20,description:'You can hear camp from all the way down the trail.'}
 ];
 /* Curios: one per trail stop per day, the same for every camp that day. */
 const CURIOS=[
  {id:'acorn',name:'Capped acorn',stop:0,rarity:'common',cell:13,note:'Still has its little hat.'},
  {id:'pinecone',name:'Tight pinecone',stop:0,rarity:'common',cell:10,note:'Closed up. Rain must be coming.'},
  {id:'fern',name:'Fiddlehead fern',stop:0,rarity:'uncommon',cell:3,note:'Curled like it is keeping a secret.'},
  {id:'mushroom',name:'Spotted mushroom',stop:0,rarity:'uncommon',cell:7,note:'Pretty. Do not eat it.'},
  {id:'nest',name:'Robin egg nest',stop:0,rarity:'uncommon',cell:0,note:'Empty and abandoned, so it is fine to keep.'},
  {id:'clover',name:'Four-leaf clover',stop:0,rarity:'rare',cell:12,note:'Four leaves. Counted twice.'},
  {id:'holeystone',name:'Holey stone',stop:1,rarity:'common',cell:2,note:'The stream wore a window through it.'},
  {id:'frog',name:'Wheel frog',stop:1,rarity:'common',cell:4,note:'Lives under the wheel. Visits, then leaves.'},
  {id:'gear',name:'Brass gear',stop:1,rarity:'uncommon',cell:5,note:'Fell off something important.'},
  {id:'quill',name:'Heron quill',stop:1,rarity:'uncommon',cell:6,note:'A long teal feather from the reeds.'},
  {id:'key',name:'Old mill key',stop:1,rarity:'rare',cell:14,note:'Nobody knows which door it opens.'},
  {id:'dragonfly',name:'Dragonfly',stop:2,rarity:'common',cell:8,note:'Stayed on a finger for a whole second.'},
  {id:'snailshell',name:'Spiral shell',stop:2,rarity:'common',cell:11,note:'The snail moved out a long time ago.'},
  {id:'firefly',name:'Firefly jar',stop:2,rarity:'uncommon',cell:1,note:'Let go again before bedtime.'},
  {id:'geode',name:'Pond geode',stop:2,rarity:'uncommon',cell:9,note:'Plain outside. Purple inside.'},
  {id:'starbottle',name:'Star in a bottle',stop:2,rarity:'rare',cell:15,note:'Fell into the pond. Fished out.'}
 ];
 const WEIGHT={common:5,uncommon:3,rare:1};
 const FORAGE_ENERGY=12;
 /* Practice ladder. Each tier is a fixed, readable pattern; the stump never rolls dice. */
 const TIERS=[
  {tier:1,name:'Sapling Stump',hp:125,pattern:[
   {name:'Measured strike',short:'STRIKE · 12',detail:'12 damage. Guard reduces it to 3.',damage:12},
   {name:'Winding up',short:'WIND-UP',detail:'No attack this turn. A heavy hit is coming.',damage:0},
   {name:'Heavy swing',short:'BIG HIT · 28',detail:'28 damage. A good moment to guard.',damage:28},
   {name:'Cooling down',short:'REST',detail:'No attack this turn. A good moment to recover.',damage:0}]},
  {tier:2,name:'Old Oak Stump',hp:165,pattern:[
   {name:'Measured strike',short:'STRIKE · 16',detail:'16 damage. Guard reduces it to 4.',damage:16},
   {name:'Root snare',short:'ROOT SNARE',detail:'Drains 4 stamina unless you guard.',damage:0,drain:4},
   {name:'Winding up',short:'WIND-UP',detail:'No attack this turn. A heavy hit is coming.',damage:0},
   {name:'Heavy swing',short:'BIG HIT · 34',detail:'34 damage. A good moment to guard.',damage:34},
   {name:'Cooling down',short:'REST',detail:'No attack this turn. A good moment to recover.',damage:0}]},
  {tier:3,name:'Elder Stump',hp:185,pattern:[
   {name:'Measured strike',short:'STRIKE · 16',detail:'16 damage. Guard reduces it to 4.',damage:16},
   {name:'Bark armor',short:'BARK ARMOR',detail:'Takes half damage this turn. Recover instead of striking.',damage:0,armor:true},
   {name:'Double swipe',short:'2 × 10',detail:'Two 10-damage swipes. Guard blocks most of both.',damage:10,hits:2},
   {name:'Winding up',short:'WIND-UP',detail:'No attack this turn. A crushing hit is coming.',damage:0},
   {name:'Crushing blow',short:'CRUSH · 36',detail:'36 damage. Guard or switch in a fresh friend.',damage:36},
   {name:'Root snare',short:'ROOT SNARE',detail:'Drains 4 stamina unless you guard.',damage:0,drain:4},
   {name:'Cooling down',short:'REST',detail:'No attack this turn. A good moment to recover.',damage:0}]}
 ];
 const BOND_LEVELS=[{at:0,name:'New friend'},{at:25,name:'Pal'},{at:50,name:'Good friend'},{at:75,name:'Best friend'},{at:100,name:'Forever friend'}];
 const BOND_NOTES={
  mochi:['','Mochi saves you the sunny spot now.','Mochi falls asleep leaning on you.','Mochi waits at the gate when you are away.','Mochi planted a seed with your name on it.'],
  bolt:['','Bolt shows you a pebble. It is the good pebble.','Bolt lets you hold the measuring string.','Bolt built you a tiny chair. It wobbles.','Bolt keeps a notebook just about you.'],
  zee:['','Zee pointed out your star. It is a small one.','Zee hums when you sit close.','Zee named a constellation after you.','Zee says you are part of the sky now.'],
  ember:['','Ember lets you hold the warm bowl.','Ember curls a wing around you when it rains.','Ember stands guard while you rest.','Ember made dinner. It is mostly toast.']
 };

 const MATERIALS=[{id:'wood',name:'Fallen wood',icon:'planter',stop:0},{id:'stone',name:'Smooth stones',icon:'wheel',stop:1},{id:'fiber',name:'Reed fiber',icon:'sprout',stop:2}];
 const RECIPES=[
  {id:'seedbox',name:'Seedling box',icon:'planter',cost:{wood:3,fiber:3},note:'A tiny garden for Mochi’s big idea.'},
  {id:'toolkit',name:'Pocket toolkit',icon:'wheel',cost:{wood:3,stone:3},note:'Bolt insists every pebble needs a tool.'},
  {id:'starchart',name:'Sky chart',icon:'star',cost:{fiber:3,stone:3},note:'A map with room for an undiscovered star.'},
  {id:'hearth',name:'Warm hearth',icon:'lantern',cost:{wood:3,stone:3},note:'Ember’s safest place to make toast.'},
  {id:'gardenbench',name:'Promise bench',icon:'bed',cost:{wood:6,fiber:3},founder:'mochi',note:'A place to wait for the first flower.'},
  {id:'waterclock',name:'Waterwheel clock',icon:'wheel',cost:{wood:6,stone:3},founder:'bolt',note:'It measures time in tiny splashes.'},
  {id:'observatory',name:'Pocket observatory',icon:'star',cost:{stone:6,fiber:3},founder:'zee',note:'The sky is a little closer from here.'},
  {id:'teatable',name:'Lantern tea table',icon:'lantern',cost:{wood:3,stone:6},founder:'ember',note:'Four seats, four bowls, one warm clearing.'}
 ];
 const JOURNEYS={
  mochi:{title:'The garden that waited',recipe:'seedbox',chapters:[
   {title:'A forgotten promise',text:'Behind the seed gate, Mochi finds four empty planting spaces. Someone meant to come back.',choices:['Plant a hopeful seed','Make room for every seed'],replies:['Mochi pats the earth twice. One pat for the seed, one for the promise.','Four neat spaces. Mochi leaves the largest one for a seed nobody has found yet.']},
   {title:'Water for the little ones',text:'The wheel is turning again. Your seedling box needs a steady trickle, and Mochi has a very small bucket.',choices:['Build a little channel','Take turns with the bucket'],replies:['Water finds its own path. Mochi follows it all the way home.','Back and forth together. The bucket is tiny; the company is excellent.']},
   {title:'Under the same stars',text:'A flower opens by the pond. Mochi brings it home without picking it: a picture in the journal is enough.',choices:['Draw the flower together','Leave a seed for tomorrow'],replies:['The drawing is mostly circles. Mochi thinks it is perfect. The garden has a keeper now.','A seed, a promise, and a sunny spot saved for you. Mochi’s garden is home.']}
  ]},
  bolt:{title:'The machine that listened',recipe:'toolkit',chapters:[
   {title:'A very important click',text:'Bolt hears a click under the seed gate. Three pebbles, one loose cog, and a question nobody asked yet.',choices:['Sort the useful bits','Follow the clicking sound'],replies:['Bolt labels the best pebble IMPORTANT. The others are also important.','The click is a seed counter. Bolt has found a project.']},
   {title:'One turn at a time',text:'Toolkit ready, Bolt studies the old waterwheel. The loose cog fits, if you both hold still.',choices:['Let Bolt fit the cog','Steady the wheel together'],replies:['Click. Turn. Splash. Bolt checks it seven more times, just to be sure.','Four paws and one careful push. The wheel remembers how to turn.']},
   {title:'Something worth measuring',text:'At the pond, Bolt’s little dial follows the ripples. It cannot measure friendship. Bolt keeps trying anyway.',choices:['Name the new machine','Sit and count ripples'],replies:['The Together-O-Meter records one very good afternoon. Bolt declares it accurate.','Bolt closes the notebook. Some things are better shared than measured.']}
  ]},
  zee:{title:'A constellation for two',recipe:'starchart',chapters:[
   {title:'Patterns in the grass',text:'Zee sees a spiral in the seed heads. It looks almost like a constellation that has not reached the sky.',choices:['Sketch the spiral','Look from another angle'],replies:['A spiral, a dot, a question mark. Zee saves the question mark.','From the gate, it looks like a tiny boat. Zee has a destination now.']},
   {title:'A clock made of shadows',text:'With your sky chart, Zee watches the waterwheel’s shadow. Every turn points somewhere new.',choices:['Trace the moving shadow','Compare it with the chart'],replies:['A circle in the journal. Zee says it is also a journey.','The shadow points toward the pond. Zee knew it would, but looks pleased anyway.']},
   {title:'Your place in the sky',text:'At the star pond, the missing dot is finally visible. Zee waits for you to see it too.',choices:['Name a constellation together','Keep the quiet discovery'],replies:['Two stars and the space between them. Zee calls it Company.','You both know where to look now. Zee says that is enough.']}
  ]},
  ember:{title:'A light to come home to',recipe:'hearth',chapters:[
   {title:'Cold clay, warm hands',text:'An old clay marker has cracked beside the gate. Ember warms it carefully, waiting for your signal.',choices:['Mend the old marker','Shape a new little bowl'],replies:['The crack becomes a golden seam. Ember looks impossibly proud.','A bowl just big enough for a warm snack. Ember has plans.']},
   {title:'A gentler kind of fire',text:'Your hearth is ready. At the wheel, Ember tests how a warm clay spout can help the cold stream.',choices:['Warm the clay slowly','Make a shelter for the spout'],replies:['A little heat, a little patience. Ember learns that gentle can be brave.','A roof, a warm stone, a safe stream. Ember checks everyone is comfortable.']},
   {title:'Four bowls at lantern hour',text:'The pond holds the last light. Ember has brought four bowls. Nobody has to stand guard tonight.',choices:['Set the table for everyone','Share the first warm bowl'],replies:['Four friends gather. Ember finally sits down, wing to wing with home.','Warmth travels from bowl to bowl. Ember kept the smallest one for you.']}
  ]}
 };
 function journeyStatus(s,id=s.selected){
  const done=s.journeys[id],story=JOURNEYS[id],p=s.pets[id];
  if(done>=3)return {done,complete:true,next:null};
  let next=null;
  if(!p.discoveries.includes(done))next={kind:'trail',pet:id,stop:done};
  else if(done===1&&!s.crafted.includes(story.recipe))next={kind:'craft',id:story.recipe};
  else if(done===2&&p.bond<25)next={kind:'friendship',pet:id};
  else if(p.energy<8)next={kind:'rest',pet:id};
  else if(s.stop!==done||s.selected!==id)next={kind:'journey',pet:id,stop:done};
  return {done,complete:false,next,ready:!next,chapter:story.chapters[done]};
 }
 function canCraft(s,id){const r=RECIPES.find(r=>r.id===id);return !!r&&!s.crafted.includes(id)&&(!r.founder||s.journeys[r.founder]===3)&&Object.entries(r.cost).every(([m,n])=>s.materials[m]>=n);}
 function toV2(state){const s=hydrate(state);s.version=2;delete s.journeys;delete s.materials;delete s.crafted;delete s.equippedCraft;return s;}
 const clean=(s,n=160)=>typeof s==='string'?s.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,n):'';
 const num=(v,def=0,min=0,max=100)=>Number.isFinite(v)?Math.max(min,Math.min(max,Math.round(v))):def;
 const isDay=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d);
 function initial(){const pets={};for(const id of IDS)pets[id]={nickname:'',food:70,energy:80,clean:75,joy:65,bond:0,discoveries:[],memories:[],care:[],battles:0};return {format:'checklings-first-trail',version:3,journeys:{mochi:0,bolt:0,zee:0,ember:0},materials:{wood:0,stone:0,fiber:0},crafted:[],equippedCraft:'',selected:'mochi',stop:0,weather:'sun',quiet:false,decor:[],equipped:'',pets,curios:[],forage:{day:'',taken:[]},revision:0};}
 function stamps(s){return IDS.reduce((n,id)=>n+s.pets[id].discoveries.length+s.pets[id].battles,0);}
 function hydrate(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.format!=='checklings-first-trail'||(raw.version!==1&&raw.version!==2&&raw.version!==3))throw Error('This is not a Pixel Camp save. Your current companions are unchanged.');
  const v2=raw.version>=2,s=initial();s.selected=IDS.includes(raw.selected)?raw.selected:'mochi';s.stop=num(raw.stop,0,0,2);s.weather=['sun','rain','dusk'].includes(raw.weather)?raw.weather:'sun';s.quiet=raw.quiet===true;s.revision=num(raw.revision,0,0,1000000);
  for(const id of IDS){const p=raw.pets?.[id];if(!p||typeof p!=='object'||Array.isArray(p))throw Error('The save is missing a founder. Your current companions are unchanged.');const q=s.pets[id];q.nickname=clean(p.nickname,24);for(const key of ['food','energy','clean','joy','bond'])q[key]=num(p[key],q[key]);q.battles=num(p.battles,0,0,v2?3:1);q.discoveries=Array.isArray(p.discoveries)?[...new Set(p.discoveries.filter(x=>Number.isInteger(x)&&x>=0&&x<3))]:[];q.care=Array.isArray(p.care)?[...new Set(p.care.filter(x=>['feed','play','rest','clean','observe'].includes(x)))]:[];q.memories=Array.isArray(p.memories)?p.memories.filter(x=>x&&typeof x.id==='string'&&typeof x.text==='string').slice(-24).map(x=>({id:clean(x.id,60),text:clean(x.text,200)})):[];}
  if(v2){s.curios=Array.isArray(raw.curios)?[...new Set(raw.curios.filter(x=>CURIOS.some(c=>c.id===x)))]:[];const f=raw.forage&&typeof raw.forage==='object'&&!Array.isArray(raw.forage)?raw.forage:{};s.forage={day:isDay(f.day)?f.day:'',taken:isDay(f.day)&&Array.isArray(f.taken)?[...new Set(f.taken.filter(x=>Number.isInteger(x)&&x>=0&&x<3))]:[]};}
  if(raw.version===3){for(const id of IDS)s.journeys[id]=num(raw.journeys?.[id],0,0,3);for(const m of MATERIALS)s.materials[m.id]=num(raw.materials?.[m.id],0,0,99);s.crafted=Array.isArray(raw.crafted)?[...new Set(raw.crafted.filter(id=>RECIPES.some(r=>r.id===id&&(!r.founder||s.journeys[r.founder]===3))))]:[];s.equippedCraft=s.crafted.includes(raw.equippedCraft)?raw.equippedCraft:'';}
  s.decor=Array.isArray(raw.decor)?[...new Set(raw.decor.filter(x=>DECOR.some(d=>d.id===x&&stamps(s)>=d.cost)))]:[];s.equipped=s.decor.includes(raw.equipped)?raw.equipped:'';return s;
 }
 /* A camp saved for a school that only knows version 1. Ladder, curios and new decor stay out. */
 function toV1(state){const s=hydrate(state),o={format:'checklings-first-trail',version:1,selected:s.selected,stop:s.stop,weather:s.weather,quiet:s.quiet,decor:[],equipped:'',pets:{},revision:s.revision};for(const id of IDS){const p=s.pets[id];o.pets[id]={nickname:p.nickname,food:p.food,energy:p.energy,clean:p.clean,joy:p.joy,bond:p.bond,discoveries:p.discoveries.slice(),memories:p.memories.map(m=>({id:m.id,text:m.text})),care:p.care.slice(),battles:Math.min(1,p.battles)};}const v1Stamps=IDS.reduce((n,id)=>n+o.pets[id].discoveries.length+o.pets[id].battles,0);o.decor=s.decor.filter(id=>['planter','lantern','pennants'].includes(id)&&DECOR.find(d=>d.id===id).cost<=v1Stamps);o.equipped=o.decor.includes(s.equipped)?s.equipped:'';return o;}
 function name(s,id=s.selected){return s.pets[id].nickname||SPECIES[id].name;}
 function memory(p,id,text){if(p.memories.some(m=>m.id===id))return false;p.memories.push({id,text});p.memories=p.memories.slice(-24);return true;}
 function bondLevel(bond){let level=0;for(let i=0;i<BOND_LEVELS.length;i++)if(bond>=BOND_LEVELS[i].at)level=i;return level;}
 /* Same pick for everyone on a given day: a tiny FNV-1a hash of the date and the stop. */
 function hash(text){let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h>>>0;}
 function curioFor(day,stop){if(!isDay(day)||!Number.isInteger(stop)||stop<0||stop>2)return null;const pool=CURIOS.filter(c=>c.stop===stop),total=pool.reduce((n,c)=>n+WEIGHT[c.rarity],0);let roll=hash('willowbank:'+day+':'+stop)%total;for(const c of pool){roll-=WEIGHT[c.rarity];if(roll<0)return c;}return pool[pool.length-1];}
 function forageOpen(s,day,stop=s.stop){if(!isDay(day))return false;return !(s.forage.day===day&&s.forage.taken.includes(stop));}
 function dispatch(state,action){
  const s=hydrate(state),p=s.pets[s.selected],id=s.selected;let message='',changed=false;
  if(!action||typeof action!=='object')return {state:s,message:'Choose an activity.',changed:false};
  const bondBefore=bondLevel(p.bond);
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
   case 'forage':{
    const day=action.day;if(!isDay(day)){message='Forage needs today’s date.';break;}
    if(!forageOpen(s,day)){message='Already foraged at '+STOPS[s.stop].name.toLowerCase()+' today. Something new turns up tomorrow.';break;}
    if(p.energy<FORAGE_ENERGY){message=name(s)+' needs a rest before foraging. Rest is free.';break;}
    const c=curioFor(day,s.stop);if(s.forage.day!==day)s.forage={day,taken:[]};s.forage.taken.push(s.stop);
    p.energy-=FORAGE_ENERGY;p.bond=Math.min(100,p.bond+4);
    if(s.curios.includes(c.id)){message=name(s)+' found another '+c.name.toLowerCase()+'. It is already on your shelf.';}
    else{s.curios.push(c.id);remember('curio-'+c.id,name(s)+' '+SPECIES[id].forage+': '+c.name.toLowerCase()+'. '+c.note);message=name(s)+' found a '+c.name.toLowerCase()+'! It goes on the curio shelf.';}
    changed=true;break;}
   case 'gather':{const m=MATERIALS[s.stop];if(p.energy<15){message=name(s)+' needs a free rest before gathering.';break;}if(s.materials[m.id]>=99){message='Your '+m.name.toLowerCase()+' basket is full. Build something in the workshop.';break;}p.energy-=15;p.food=Math.max(0,p.food-4);const amount=Math.min(3,99-s.materials[m.id]);s.materials[m.id]+=amount;message=name(s)+' gathered '+amount+' '+m.name.toLowerCase()+'. Nothing growing was harmed.';changed=true;break;}
   case 'craft':{const r=RECIPES.find(r=>r.id===action.id);if(!r)break;if(s.crafted.includes(r.id)){message=r.name+' is already yours. Place it in camp.';break;}if(!canCraft(s,r.id)){message=r.founder&&s.journeys[r.founder]<3?'Finish '+SPECIES[r.founder].name+'’s journey to build this keepsake.':'Gather the missing supplies on the trail. Rest is always free.';break;}for(const [m,n] of Object.entries(r.cost))s.materials[m]-=n;s.crafted.push(r.id);s.equippedCraft=r.id;message=r.name+' built and placed! Your other decorations stay with you.';changed=true;break;}
   case 'place-craft':if(s.crafted.includes(action.id)&&s.equippedCraft!==action.id){s.equippedCraft=action.id;message=RECIPES.find(r=>r.id===action.id).name+' placed in camp.';changed=true;}break;
   case 'journey':{const status=journeyStatus(s);if(status.complete){message='This journey is complete. Its memories are in the journal.';break;}if(!status.ready){message='Finish the next step on your journey card first.';break;}if(action.chapter!==status.done||!Number.isInteger(action.choice)||action.choice<0||action.choice>1){message='Choose one of this chapter’s two paths.';break;}p.energy-=8;p.bond=Math.min(100,p.bond+6);const m=MATERIALS[status.done].id;s.materials[m]=Math.min(99,s.materials[m]+3);s.journeys[id]++;message=status.chapter.replies[action.choice];remember('journey-'+status.done,message);if(s.journeys[id]===3)message+=' Journey complete! A special workshop keepsake is now available.';changed=true;break;}
   case 'unlock':{const d=DECOR.find(x=>x.id===action.id);if(!d)break;if(stamps(s)<d.cost){message='Collect '+d.cost+' trail stamps through discovery or practice. Stamps are milestones, so they are never spent.';break;}if(!s.decor.includes(d.id)){s.decor.push(d.id);changed=true;}if(s.equipped!==d.id){s.equipped=d.id;changed=true;}message=d.name+' is now in your clearing.';break;}
   case 'battle-win':{const tier=Number.isInteger(action.tier)&&action.tier>=1&&action.tier<=3?action.tier:1;if(tier>p.battles+1){message='Clear the '+TIERS[p.battles].name.toLowerCase()+' first.';break;}if(p.battles>=tier){message='A fine rematch. That badge is already in your journal.';break;}p.battles=tier;remember(tier===1?'practice':'practice-'+tier,tier===1?'Completed a friendly practice against the training dummy. No injuries.':name(s)+' beat the '+TIERS[tier-1].name.toLowerCase()+'. Everyone walked home fine.');message=name(s)+' earned the '+TIERS[tier-1].name.toLowerCase()+' badge and one trail stamp. Everyone returns healthy.';changed=true;break;}
   default:message='Choose an activity.';
  }
  if(changed){
   if(['feed','rest','clean','play','observe'].includes(action.type)&&!p.care.includes(action.type))p.care.push(action.type);
   const level=bondLevel(p.bond);if(level>bondBefore&&level>0){remember('bond-'+level,BOND_NOTES[id][level]);s.bondUp={pet:id,level};}
   s.revision=Math.min(1000000,s.revision+1);
  }
  const levelUp=s.bondUp||null;delete s.bondUp;
  return {state:s,message,changed,bondUp:levelUp};
 }
 function tierInfo(tier){return TIERS[Math.max(0,Math.min(2,(tier||1)-1))];}
 function startBattle(id,tier=1){if(!IDS.includes(id))throw Error('Choose a founder.');const t=tierInfo(tier);const fighters={};for(const key of IDS)fighters[key]={hp:65,stamina:10,charge:0,orbit:0,heat:0};return {active:id,fighters,enemy:t.hp,enemyMax:t.hp,tier:t.tier,turn:0,round:1,log:[],result:null};}
 function intentFor(b){const t=tierInfo(b&&b.tier);return t.pattern[(b?b.turn:0)%t.pattern.length];}
 /* Kept for 4.x callers: the sapling pattern. */
 const intents=TIERS[0].pattern;
 function battleMove(raw,move,swap){
  const b=JSON.parse(JSON.stringify(raw));if(!b.tier)b.tier=1;if(!b.enemyMax)b.enemyMax=tierInfo(b.tier).hp;
  if(b.result)return {battle:b,message:'Practice has finished.',changed:false};const p=b.fighters[b.active];let damage=0,shield=0,guard=false,msg='';
  const intent=intentFor(b);
  if(move==='switch'){if(!IDS.includes(swap)||swap===b.active||b.fighters[swap].hp<=0)return {battle:b,message:'Choose another available companion.',changed:false};b.active=swap;msg=SPECIES[swap].name+' steps in.';}
  else if(p.hp<=0)return {battle:b,message:'Choose another companion to continue, or leave practice.',changed:false};
  else if(move==='strike'){if(p.stamina<3)return {battle:b,message:'Not enough stamina. Guard or recover.',changed:false};p.stamina-=3;damage=16;msg='A careful strike.';}
  else if(move==='signature'){if(p.stamina<5)return {battle:b,message:'Not enough stamina for a signature. Guard or recover.',changed:false};p.stamina-=5;if(b.active==='mochi'){damage=9;shield=12;}if(b.active==='bolt'){damage=13+8*p.charge;p.charge=0;}if(b.active==='zee'){damage=p.orbit===0?21:13;shield=p.orbit===0?0:8;p.orbit=1-p.orbit;}if(b.active==='ember'){damage=p.heat?26:14;p.heat=0;}msg=SPECIES[b.active].signature+'.';}
  else if(move==='guard'){guard=true;p.stamina=Math.min(10,p.stamina+2);msg='Braced for the next move.';}
  else if(move==='recover'){p.stamina=Math.min(10,p.stamina+5);if(b.active==='ember')p.heat=1;msg='Stamina recovered'+(b.active==='ember'?'; a little heat banked.':'.');}
  else return {battle:b,message:'Choose a practice move.',changed:false};
  if(damage&&intent.armor){damage=Math.ceil(damage/2);msg+=' The bark armor softens it.';}
  b.enemy=Math.max(0,b.enemy-damage);if(damage)msg+=' '+damage+' damage.';
  if(b.enemy===0){b.result='win';msg+=' Practice complete. No one is hurt.';}
  else {
   const target=b.fighters[b.active],hits=intent.hits||1;let taken=0,left=shield;
   for(let i=0;i<hits;i++){const hit=intent.damage;if(!hit)continue;let t=guard?Math.ceil(hit*.25):hit;const blocked=Math.min(left,t);t-=blocked;left-=blocked;taken+=t;}
   target.hp=Math.max(0,target.hp-taken);
   if(b.active==='bolt'&&intent.damage>0&&(guard||shield>0))target.charge=Math.min(2,target.charge+1);
   if(intent.damage)msg+=' Stump dealt '+taken+' practice damage.';
   if(intent.drain&&!guard){const lost=Math.min(target.stamina,intent.drain);target.stamina-=lost;msg+=' Roots grab: '+lost+' stamina lost.';}
   if(intent.drain&&guard)msg+=' Guarded the roots.';
   if(!IDS.some(id=>b.fighters[id].hp>0)){b.result='loss';msg+=' Practice ends. Everyone returns healthy; watch the next move and guard the big ones.';}
  }
  b.turn++;b.round++;b.log.unshift(msg);b.log=b.log.slice(0,8);return {battle:b,message:msg,changed:true};
 }
 const api={MATERIALS,RECIPES,JOURNEYS,journeyStatus,canCraft,toV2,SPECIES,IDS,STOPS,DECOR,CURIOS,TIERS,BOND_LEVELS,FORAGE_ENERGY,initial,hydrate,toV1,dispatch,name,stamps,bondLevel,curioFor,forageOpen,startBattle,battleMove,intentFor,tierInfo,intents};root.FirstTrail=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
