/* Manifest: 1848 — game data */
'use strict';
const A = n => 'art/' + n + '.webp';

/* ---------------- CARDS ---------------- */
// play(c,u) runs inside combat. c = combat api. u = upgraded?
const CARDS = {
  /* starter */
  steady_pace:{name:'Steady Pace',type:'action',arch:'starter',rarity:'starter',cost:1,art:'art_steady_pace',
    desc:u=>`Gain <b>${u?8:5}</b> Progress.`, play:async(c,u)=>c.prog(u?8:5)},
  brace_wagon:{name:'Brace the Wagon',type:'action',arch:'starter',rarity:'starter',cost:1,art:'art_brace_wagon',
    desc:u=>`Gain <b>${u?8:5}</b> Stability.`, play:async(c,u)=>c.stab(u?8:5)},
  frontier_rifle:{name:'Frontier Rifle',type:'supply',arch:'starter',rarity:'starter',cost:1,art:'ic_rifle',icon:true,
    desc:u=>`Gain <b>${u?9:6}</b> Progress. <b>+${u?6:4}</b> more against Wildlife or Bandits.`,
    play:async(c,u)=>{c.prog(u?9:6); if(c.hasTag('wildlife')||c.hasTag('bandits')) c.prog(u?6:4);}},
  hardtack_rations:{name:'Hardtack Rations',type:'supply',arch:'starter',rarity:'starter',cost:0,art:'ic_hardtack',icon:true,exhaust:true,
    desc:u=>`Heal <b>${u?5:3}</b> HP. Draw 1 card. <i>Exhaust.</i>`, play:async(c,u)=>{c.heal(u?5:3); await c.draw(1);}},

  /* speed */
  whip_the_oxen:{name:'Whip the Oxen',type:'action',arch:'speed',rarity:'common',cost:1,art:'art_whip_the_oxen',
    desc:u=>`Gain <b>${u?11:8}</b> Progress. Lose 2 HP.`, play:async(c,u)=>{c.prog(u?11:8); c.selfHurt(2);}},
  lighten_the_load:{name:'Lighten the Load',type:'action',arch:'speed',rarity:'common',cost:0,needsOther:true,art:'art_lighten_the_load',
    desc:u=>`Discard another card. Gain <b>${u?7:4}</b> Progress and <b>+1</b> Stamina.`,
    play:async(c,u)=>{await c.chooseFromHand('Discard a card',x=>true,x=>c.discardCard(x)); c.prog(u?7:4); c.gainStam(1);}},
  night_travel:{name:'Night Travel',type:'action',arch:'speed',rarity:'uncommon',cost:2,art:'art_night_travel',
    desc:u=>`Gain <b>${u?18:13}</b> Progress. Shuffle an <b>Exhaustion</b> into your discard.`,
    play:async(c,u)=>{c.prog(u?18:13); c.addTemp('exhaustion','discard');}},
  double_yoke:{name:'Double Yoke',type:'action',arch:'speed',rarity:'uncommon',cost:1,art:'ic_yoke',icon:true,
    desc:u=>`Gain <b>${u?4:3}</b> Progress for each card played this turn, this one included.`,
    play:async(c,u)=>c.prog((u?4:3)*c.playedThisTurn)},
  double_time_hitch:{name:'Double-Time Hitch',type:'power',arch:'speed',rarity:'rare',cost:1,costUp:0,art:'art_double_time_hitch',
    desc:u=>`Every 3rd card you play each turn grants <b>+5</b> Progress.`, play:async(c,u)=>c.power('hitch',5)},

  /* trader */
  haggle:{name:'Haggle',type:'action',arch:'trader',rarity:'common',cost:1,art:'art_haggle',
    desc:u=>`Gain <b>${u?6:4}</b> Stability and <b>${u?11:8}</b> Gold.`, play:async(c,u)=>{c.stab(u?6:4); c.gold(u?11:8);}},
  trade_goods:{name:'Trade Goods',type:'supply',arch:'trader',rarity:'common',cost:0,art:'ic_coins',icon:true,exhaust:true,
    desc:u=>`Gain <b>${u?8:5}</b> Gold. Draw 1 card. <i>Exhaust.</i>`, play:async(c,u)=>{c.gold(u?8:5); await c.draw(1);}},
  bribe_the_ferryman:{name:'Bribe the Ferryman',type:'action',arch:'trader',rarity:'uncommon',cost:1,art:'art_bribe_the_ferryman',
    desc:u=>`Spend 15 Gold to gain <b>${u?19:14}</b> Progress. Short on gold? Gain 4.`,
    play:async(c,u)=>{ if(G.gold>=15){c.spend(15); c.prog(u?19:14);} else c.prog(4);}},
  cast_iron_cargo:{name:'Cast-Iron Cargo',type:'supply',arch:'trader',rarity:'uncommon',cost:2,art:'art_cast_iron_cargo',
    desc:u=>`Gain <b>${u?13:10}</b> Stability, plus <b>${u?3:2}</b> for every 25 Gold you hold.`,
    play:async(c,u)=>c.stab((u?13:10)+(u?3:2)*Math.floor(G.gold/25))},
  manifest_monopoly:{name:'Manifest Monopoly',type:'power',arch:'trader',rarity:'rare',cost:1,art:'art_manifest_monopoly',
    desc:u=>`Whenever you gain Gold this encounter, gain <b>${u?5:3}</b> Progress.`, play:async(c,u)=>c.power('monopoly',u?5:3)},

  /* survival */
  boil_river_water:{name:'Boil River Water',type:'action',arch:'survival',rarity:'common',cost:1,art:'art_boil_river_water',
    desc:u=>`Gain <b>${u?8:5}</b> Stability. <b>Purge</b> an Illness curse from your hand.`,
    play:async(c,u)=>{c.stab(u?8:5); const k=c.hand.find(x=>CARDS[x.id].tags&&CARDS[x.id].tags.includes('illness')); if(k) c.purge(k);}},
  spare_wheel:{name:'Spare Wheel',type:'supply',arch:'survival',rarity:'common',cost:1,art:'ic_wheel',icon:true,exhaust:true,
    desc:u=>`Gain <b>${u?11:8}</b> Stability. <b>Purge</b> a Broken Axle in hand. <i>Exhaust.</i>`,
    play:async(c,u)=>{c.stab(u?11:8); const k=c.hand.find(x=>x.id==='broken_axle'); if(k) c.purge(k);}},
  gather_firewood:{name:'Gather Firewood',type:'supply',arch:'survival',rarity:'common',cost:0,art:'ic_firewood',icon:true,exhaust:true,
    desc:u=>`Gain <b>${u?6:4}</b> Stability. Draw 1 card. <i>Exhaust.</i>`, play:async(c,u)=>{c.stab(u?6:4); await c.draw(1);}},
  smoked_jerky:{name:'Smoked Jerky',type:'supply',arch:'survival',rarity:'uncommon',cost:0,art:'ic_jerky',icon:true,exhaust:true,
    desc:u=>`Heal <b>${u?6:4}</b> HP, gain <b>+1</b> Stamina, draw 1. <i>Exhaust.</i>`,
    play:async(c,u)=>{c.heal(u?6:4); c.gainStam(1); await c.draw(1);}},
  lash_it_down:{name:'Lash It Down',type:'supply',arch:'survival',rarity:'uncommon',cost:2,art:'ic_rope',icon:true,
    desc:u=>`Gain <b>${u?16:12}</b> Stability. Your Stability carries over to next turn.`,
    play:async(c,u)=>{c.stab(u?16:12); c.retainStab=true;}},
  campfire_prep:{name:'Campfire Prep',type:'power',arch:'survival',rarity:'rare',cost:1,art:'art_campfire_prep',
    desc:u=>`Whenever a card Exhausts this encounter, gain <b>${u?6:4}</b> Progress and <b>${u?6:4}</b> Stability.`,
    play:async(c,u)=>c.power('campfire',u?6:4)},

  /* apothecary */
  bitter_tonic:{name:'Bitter Tonic',type:'action',arch:'apothecary',rarity:'common',cost:1,art:'art_bitter_tonic',
    desc:u=>`Draw <b>${u?3:2}</b> cards. If any is a Curse, gain <b>7</b> Stability.`,
    play:async(c,u)=>{const d=await c.draw(u?3:2); if(d.some(x=>CARDS[x.id].type==='curse')) c.stab(7);}},
  patent_medicine:{name:'Patent Medicine',type:'supply',arch:'apothecary',rarity:'common',cost:0,art:'ic_bottle',icon:true,
    desc:u=>`<b>Exhaust</b> a Curse in your hand. Heal <b>${u?5:3}</b> HP.`,
    play:async(c,u)=>{const k=c.hand.find(x=>CARDS[x.id].type==='curse'); if(k) c.exhaustCard(k); c.heal(u?5:3);}},
  fever_dream:{name:'Fever Dream',type:'action',arch:'apothecary',rarity:'uncommon',cost:1,art:'art_fever_dream',
    desc:u=>`Gain <b>${u?7:5}</b> Progress, plus <b>${u?6:5}</b> for every Curse in your hand.`,
    play:async(c,u)=>c.prog((u?7:5)+(u?6:5)*c.hand.filter(x=>CARDS[x.id].type==='curse').length)},
  snake_oil:{name:'Snake Oil',type:'action',arch:'apothecary',rarity:'uncommon',cost:1,art:'art_snake_oil',
    desc:u=>`Exhaust every Curse in your hand. Gain 10 Gold and <b>${u?6:4}</b> Progress for each.`,
    play:async(c,u)=>{const cs=c.hand.filter(x=>CARDS[x.id].type==='curse'); for(const k of cs){c.exhaustCard(k); c.gold(10); c.prog(u?6:4);} }},
  plague_doctors_grit:{name:"Plague Doctor's Grit",type:'power',arch:'apothecary',rarity:'rare',cost:2,costUp:1,art:'art_plague_doctors_grit',
    desc:u=>`Curses no longer punish you at end of turn. Drawing a Curse gives <b>4</b> Progress and <b>4</b> Stability.`,
    play:async(c,u)=>c.power('grit',4)},

  /* neutral */
  lantern_light:{name:'Lantern Light',type:'supply',arch:'neutral',rarity:'common',cost:1,art:'ic_lantern',icon:true,
    desc:u=>`Gain <b>${u?5:3}</b> Progress. Draw 2 cards.`, play:async(c,u)=>{c.prog(u?5:3); await c.draw(2);}},
  take_bearings:{name:'Take Bearings',type:'action',arch:'neutral',rarity:'common',cost:1,art:'ic_compass',icon:true,
    desc:u=>`Gain <b>${u?8:5}</b> Stability. Draw 2 extra cards next turn.`, play:async(c,u)=>{c.stab(u?8:5); c.nextDraw+=2;}},
  read_the_map:{name:'Read the Map',type:'action',arch:'neutral',rarity:'uncommon',cost:1,costUp:0,art:'ic_scroll',icon:true,exhaust:true,
    desc:u=>`Draw 3 cards. <i>Exhaust.</i>`, play:async(c,u)=>{await c.draw(3);}},
  leave_it_on_the_trail:{name:'Leave It on the Trail',type:'action',arch:'neutral',rarity:'uncommon',cost:0,needsOther:true,art:'ic_satchel',icon:true,exhaust:true,
    desc:u=>`<b>Purge</b> a card in your hand from your wagon for good.${u?' Draw 1.':''} <i>Exhaust.</i>`,
    play:async(c,u)=>{await c.chooseFromHand('Leave which card on the trail?',x=>true,x=>c.purge(x)); if(u) await c.draw(1);}},
  abandon_the_stove:{name:'Abandon the Stove',type:'action',arch:'neutral',rarity:'uncommon',cost:0,art:'ic_stove',icon:true,
    desc:u=>`Gain <b>${u?15:10}</b> Progress. <b>Purge</b> this card.`, play:async(c,u,self)=>{c.prog(u?15:10); self._purgeSelf=true;}},

  /* curses */
  dysentery:{name:'Dysentery',type:'curse',tags:['illness'],rarity:'curse',cost:-1,art:'art_dysentery',unplayable:true,
    desc:u=>`Unplayable. If in hand at end of turn, lose <b>3</b> HP.`,
    endTurn:(c,k)=>c.selfHurt(Math.max(0,3-(c.crew('sawbones')?2:0)),'Dysentery')},
  broken_axle:{name:'Broken Axle',type:'curse',tags:['wagon'],rarity:'curse',cost:2,art:'art_broken_axle',
    desc:u=>`Pay 2 Stamina to <b>Purge</b> this. Otherwise draw 1 fewer card next turn.`,
    play:async(c,u,self)=>{self._purgeSelf=true;}, endTurn:(c,k)=>{c.nextDraw-=1;}},
  mudlocked:{name:'Mudlocked',type:'curse',tags:['terrain'],rarity:'curse',cost:1,art:'art_mudlocked',exhaust:true,
    desc:u=>`Pay 1 Stamina to Exhaust. While in hand, Speed cards cost 1 more.`, play:async()=>{}},
  frostbite:{name:'Frostbite',type:'curse',tags:['weather'],rarity:'curse',cost:-1,art:'art_frostbite',unplayable:true,
    desc:u=>`Unplayable. While in hand, each Stability gain is 2 less. Exhausts at end of turn.`,
    endTurn:(c,k)=>{c.exhaustCard(k);}},
  exhaustion:{name:'Exhaustion',type:'curse',tags:['fatigue'],rarity:'curse',cost:-1,art:'art_exhaustion',unplayable:true,
    desc:u=>`Unplayable. At end of turn: lose 2 HP, draw 1 fewer next turn, then Exhaust.`,
    endTurn:(c,k)=>{c.selfHurt(2,'Exhaustion'); c.nextDraw-=1; c.exhaustCard(k);}},
  grief:{name:'Grief',type:'curse',tags:['morale'],rarity:'curse',cost:-1,art:'art_grief',unplayable:true,
    desc:u=>`Unplayable. If in hand at end of turn, 1 less Stamina next turn.`, endTurn:(c,k)=>{c.nextStam-=1;}},
};
for (const [id,c] of Object.entries(CARDS)) c.id=id;
const SPEED = new Set(['whip_the_oxen','lighten_the_load','night_travel','double_yoke','double_time_hitch']);
const REWARD_POOL = Object.values(CARDS).filter(c=>!['starter','curse'].includes(c.rarity)).map(c=>c.id);

/* ---------------- WAGONS ---------------- */
const WAGONS = [
  {id:'stagecoach',name:'The Stagecoach Express',tag:'Speed',hp:36,gold:20,cap:16,art:'wagon_stagecoach',arch:'speed',
   passive:'First-Light Sprint',pdesc:'+1 Stamina on Turn 1 of every encounter.',
   blurb:'Light, fast and fragile. Small load limit, big bursts.',
   remove:['brace_wagon'],add:['whip_the_oxen','lighten_the_load']},
  {id:'conestoga',name:'The Conestoga Freighter',tag:'Trader',hp:48,gold:45,cap:22,art:'wagon_conestoga',arch:'trader',flip:true,
   passive:'Heavy Hitch',pdesc:'Start every encounter with 4 Stability. Forts stock 1 extra card at 20% off.',
   blurb:'A rolling warehouse. Haul more, buy cheaper, grind it out.',
   remove:['steady_pace'],add:['haggle','cast_iron_cargo']},
  {id:'schooner',name:'The Prairie Schooner',tag:'Survivalist',hp:40,gold:25,cap:18,art:'wagon_schooner',arch:'survival',
   passive:'Field Provisions',pdesc:'Heal 1 HP whenever a card Exhausts (3 per encounter).',
   blurb:'The classic emigrant wagon. Tough, steady and patched together.',
   remove:['steady_pace'],add:['boil_river_water','spare_wheel']},
  {id:'apothecary',name:"The Apothecary's Cart",tag:'Curse-Flip',hp:39,gold:30,cap:17,art:'wagon_apothecary',arch:'apothecary',
   passive:'Tolerated Poison',pdesc:'The first Curse you draw each turn draws you a replacement card.',
   blurb:'Starts sick on purpose. Turns misery into momentum.',
   remove:[],add:['bitter_tonic','fever_dream','dysentery']},
];
const STARTER = ['steady_pace','steady_pace','steady_pace','steady_pace','steady_pace','brace_wagon','brace_wagon','brace_wagon','brace_wagon','frontier_rifle','hardtack_rations'];

/* ---------------- CREW ---------------- */
const CREW = {
  blacksmith:{name:'The Blacksmith',desc:'The first Supply card you play each encounter costs 0.'},
  scout:{name:'The Frontier Scout',desc:'Draw 2 extra cards on Turn 1 against Wildlife, Mountain and Boss encounters.'},
  cook:{name:'The Camp Cook',desc:'Heal 3 HP after an encounter if you played a Supply card in it.'},
  gambler:{name:'The River Gambler',desc:'+5 Gold at the start of each encounter. Once per encounter, tap to redraw your hand.'},
  sawbones:{name:'The Sawbones',desc:'Dysentery deals 2 less damage at end of turn.'},
  preacher:{name:'The Trail Preacher',desc:'Whenever you Purge a Curse from your wagon, gain 3 Max HP and heal 3.'},
  oxdriver:{name:'The Ox-Driver',desc:'Every 4th Action card you play in an encounter grants 5 Progress.'},
  cartographer:{name:'The Cartographer',desc:'Reveals what waits at every ? on the map. +10 Gold at each fort.'},
};

/* ---------------- KEEPSAKES ---------------- */
const RELICS = {
  compass:{name:'Brass Compass',art:'rl_compass',desc:'Draw 1 extra card on Turn 1 of every encounter.'},
  skillet:{name:'Cast-Iron Skillet',art:'rl_skillet',desc:'Heal 2 HP after every encounter.'},
  dollar:{name:'Silver Dollar',art:'rl_dollar',desc:'Encounters pay 25% more Gold.'},
  journal:{name:'Trail Journal',art:'rl_journal',desc:'Card rewards offer 4 choices instead of 3.'},
  watch:{name:'Pocket Watch',art:'rl_watch',desc:'Every stop on the trail takes 1 fewer day.'},
  blanket:{name:'Buffalo Robe',art:'rl_blanket',desc:'Start every encounter with 5 Stability.'},
  horseshoe:{name:'Lucky Horseshoe',art:'rl_horseshoe',desc:'The first hit you take each encounter is 5 less.'},
  flask:{name:'Tin Flask',art:'rl_flask',desc:'Heal 6 HP whenever you reach a fort or a campfire.'},
  goldpan:{name:'Gold Pan',art:'rl_goldpan',desc:'Gain 2 Gold whenever you play a Supply card.'},
};

/* ---------------- ENCOUNTERS ---------------- */
// intents: {n:name, i:icon, d:damage, h:hits, t:extra text, fx:fn(c)}
const ENC = {
  buffalo:{name:'Buffalo Stampede',art:'enc_buffalo',tags:['wildlife'],need:24,intents:[
    {n:'Thundering Herd',i:'attack',d:7},{n:'Trample',i:'attack',d:3,h:2},{n:'The Herd Mills',i:'freeze',t:'Blocks 6 Progress',fx:c=>c.barrier(6)}]},
  dust:{name:'Dust Storm',art:'enc_dust',tags:['weather'],need:22,intents:[
    {n:'Choking Dust',i:'curse',d:4,t:'Adds Exhaustion',fx:c=>c.addTemp('exhaustion','discard')},{n:'Sandblast',i:'attack',d:8}]},
  mud:{name:'Mired in Mud',art:'enc_mud',tags:['terrain'],need:22,intents:[
    {n:'Sucking Mud',i:'curse',d:3,t:'Mudlocked into hand',fx:c=>c.addTemp('mudlocked','hand')},{n:'Wheels Sink',i:'attack',d:6,t:'Blocks 4 Progress',fx:c=>c.barrier(4)}]},
  wolves:{name:'Gray Wolves',art:'enc_wolves',tags:['wildlife'],need:20,intents:[
    {n:'Circling',i:'buff',t:'Next attack +4',fx:c=>c.enrage(4)},{n:'Lunge',i:'attack',d:5,h:2}]},
  river:{name:'River Crossing',art:'enc_bridge',tags:['river'],need:26,intents:[
    {n:'Rising Water',i:'attack',d:6},{n:'Timber Snag',i:'curse',d:3,t:'Broken Axle into discard',fx:c=>c.addTemp('broken_axle','discard')},{n:'Swift Current',i:'attack',d:4,h:2}]},
  bandit_ambush:{name:'Bandit Ambush',art:'enc_bandits',haz:'bandits',tags:['bandits'],need:24,intents:[
    {n:'Hold-Up',i:'steal',d:5,t:'Steals 10 Gold if it gets through',fx:c=>c.stealIfHit(10)},{n:'Gunfire',i:'attack',d:4,h:2}]},
  /* elites */
  platte:{name:'The Platte River Swell',art:'enc_flood',tags:['river'],need:36,elite:true,intents:[
    {n:'Rising Current',i:'attack',d:8},{n:'Undertow',i:'scatter',d:4,t:'If Stability < 8, washes away a Supply card',fx:c=>c.undertow(8)},{n:'The Swell',i:'freeze',t:'Blocks 8 Progress',fx:c=>c.barrier(8)}]},
  devilsgate:{name:"Devil's Gate Toll Crew",art:'enc_bandits',tags:['bandits'],need:42,elite:true,intents:[
    {n:'Toll Shakedown',i:'steal',d:7,t:'Steals 12 Gold if it gets through',fx:c=>c.stealIfHit(12)},{n:'Rifle Volley',i:'attack',d:11},{n:'Hold the Gate',i:'freeze',t:'Blocks 10 Progress',fx:c=>c.barrier(10)}]},
  bluemtn:{name:'The Blue Mountains Freeze',art:'ev_frozen',tags:['mountain','weather'],need:48,elite:true,intents:[
    {n:'Biting Gale',i:'curse',d:9,t:'Frostbite into hand',fx:c=>c.addTemp('frostbite','hand')},{n:'Whiteout',i:'attack',d:6,h:2}]},
  /* bosses */
  supercell:{name:'The Chimney Rock Supercell',art:'boss_supercell',bg:'bg_act1_night',tags:['weather','storm'],need:60,boss:true,wx:'rain',intents:[
    {n:'Gale Force',i:'scatter',d:7,t:'Discards a random card',fx:c=>c.discardRandom(1)},
    {n:'Flash Flood',i:'curse',d:5,t:'Mudlocked into discard',fx:c=>c.addTemp('mudlocked','discard')},
    {n:'Gathering Storm',i:'buff',t:'Next attack +6',fx:c=>c.enrage(6)},
    {n:'Lightning Strike',i:'attack',d:14}]},
  avalanche:{name:'The Big Hill Runaway',art:'boss_avalanche',haz:'bighill',tags:['mountain'],need:72,boss:true,weight:2,intents:[
    {n:'Runaway Wagon',i:'curse',d:8,t:'Broken Axle into your draw pile',fx:c=>c.addTemp('broken_axle','draw')},
    {n:'Winded Oxen',i:'buff',t:'1 less Stamina next turn',fx:c=>{c.nextStam-=1;}},
    {n:'Loose Rock',i:'attack',d:11,t:'Blocks 8 Progress',fx:c=>c.barrier(8)}]},
  columbia1:{name:'Columbia Gorge: Early Blizzard',art:'boss_blizzard',tags:['weather','mountain'],need:52,boss:true,wx:'snow',phase2:'columbia2',intents:[
    {n:'Freezing Squall',i:'curse',d:9,t:'Frostbite into hand',fx:c=>c.addTemp('frostbite','hand')},
    {n:'Ice Fog',i:'freeze',d:4,t:'Blocks 10 Progress',fx:c=>c.barrier(10)},
    {n:'Snow Squall',i:'attack',d:5,h:2}]},
  columbia2:{name:'Columbia Gorge: Running the Rapids',art:'boss_rapids',tags:['river'],need:62,boss:true,raft:true,intents:[
    {n:'Whitewater Surge',i:'attack',d:8,esc:3},{n:'Rocks Ahead',i:'attack',d:6,h:2}]},
};
const ACT_NORMALS = {1:['buffalo','dust','mud','wolves'],2:['wolves','dust','mud','buffalo'],3:['wolves','mud','dust']};
const ACT_ELITE = {1:'platte',2:'devilsgate',3:'bluemtn'};
const ACT_BOSS = {1:'supercell',2:'avalanche',3:'columbia1'};
/* 2D hazard scenes. Keys listed here have haz_<key>_a/_b/_c.webp in art/. Others fall back to the framed portrait. */
const HAZ_READY = new Set([]);
/* Rear view wagon sprites. Keys listed here have rig_<key>_ok/_hurt.webp in art/. */
const RIG_READY = new Set([]);
const ACT_SCALE = {1:{need:1,dmg:1},2:{need:1.4,dmg:1.3},3:{need:1.75,dmg:1.55}};
const PLACE_NAMES = {
  1:{buffalo:'Buffalo on the Platte',dust:'Dust on the Platte Road',mud:'Mired in Spring Mud',wolves:'Prairie Wolves',river:'Kansas River Ford'},
  2:{buffalo:'Buffalo on the Sweetwater',dust:'Great Divide Dust',mud:'Snowmelt Mud',wolves:'Mountain Wolves',river:'Green River Ford'},
  3:{buffalo:'Stray Herd',dust:'Snake River Dust',mud:'Blue Mountain Mud',wolves:'Timber Wolves',river:'Snake River Crossing'},
};
const ACTS = {
  1:{name:'The Great Plains',from:'Independence, Missouri',to:'Fort Laramie',bg:'bg_act1',miles:650,fort:'Fort Kearny'},
  2:{name:'The Rocky Mountains',from:'Fort Laramie',to:'Fort Hall',bg:'bg_act2',miles:620,fort:'Fort Bridger'},
  3:{name:'The Final Pass',from:'Fort Hall',to:'Oregon City',bg:'bg_act3',miles:730,fort:'Fort Boise'},
};
const NODE_DAYS = {trail:7,river:6,elite:8,mystery:5,fort:6,camp:6,boss:8};
const START_DAY = Date.UTC(1848,4,5); // May 5, 1848
const WINTER_DAY = Date.UTC(1848,9,5); // Oct 5
const JULY4 = Date.UTC(1848,6,4);
