/* Manifest: 1848 — narrator and trail events */
'use strict';

/* Eli Haskins, a fictional trail pilot (the guide a wagon company hired), narrates in 1848.
   Each key holds one or more lines; one is picked at random. */
const TR = {
  intro:["Name's Eli Haskins. I've piloted wagon companies to Oregon since '43, and I've buried more friends on this road than I care to count. Listen close and you won't join them."],
  pickWagon:["Pick your wagon careful. Most folks hitch oxen, not horses. Oxen cost less, eat prairie grass, and thieves have a harder time driving them off in the night."],
  act1:["Independence, Missouri. We wait here till the spring grass greens, because our oxen will graze their way two thousand miles to Oregon."],
  act2:["Fort Laramie. Still a fur company post, though there's talk the Army wants to buy it. Rest the oxen. The mountains come next."],
  act3:["Fort Hall. The Hudson's Bay Company runs it. Past here, at the Raft River, the California road splits off to the south. Oregon lies west, past the Snake and the Blue Mountains."],
  firstFight:["The trail fights back. Spend Stamina to play cards. Fill the Progress bar to get past, and raise Stability to soak up the blow it's about to land."],
  fight:["Steady now. A company that panics is a company that stalls.","Watch the sign above the obstacle. It tells you exactly what's coming next turn.","Keep moving! The calendar is as dangerous as any river.","Most graves on this road come from sickness and accidents, not fights. Mind your health."],
  elite:["This one's no ordinary rut in the road. Brace yourselves!","A hard one. Beat it and somebody new might ask to join the company."],
  boss_supercell:["Chimney Rock! No landmark on this road gets written about more. Today it's standing under a storm black as gunpowder."],
  boss_avalanche:["Big Hill. One of the steepest pulls on the whole road, and the company ahead of us lost a wagon on it. Look out below!"],
  boss_columbia1:["The Dalles. The Barlow toll road climbs over the Cascades, but this company goes down the Columbia, and winter's closing in!"],
  boss_columbia2:["Lash the wagon to the raft! The Columbia's rapids have drowned emigrants who survived everything else on this road."],
  winSmall:["Ha! That's how it's done.","On to the next mile.","Good work. The oxen thank you, I'm sure.","Keep that up and we'll see Oregon yet."],
  winElite:["Now that was a fight worth having!","Fine work. The company grows stronger."],
  winBoss:["Ring the bell and break out the coffee! We made it through!"],
  lowHp:["Your people are flagging. Brace the wagon before you push on!","Careful! A dead company makes no progress at all."],
  overload:["Your wagon's overloaded and the oxen are paying for it. Leave something behind!"],
  cardSkip:["Smart. Every pound you don't carry is a pound your oxen don't pull."],
  map:["Pick your road. Shorter isn't always safer, and safer isn't always shorter.","Every stop costs days. Mind the calendar. Snow doesn't care how brave you are.","A question mark can mean treasure or trouble. That's the trail for you."],
  fort:["Fort prices would make a Missouri storekeeper blush, but there's nowhere else to buy for a long stretch.","A fort! Trade, repair, and lighten the load."],
  camp:["Circle the wagons and build a fire. Even the toughest company needs a night's sleep."],
  curse:["Sickness rides with every train. Disease kills more emigrants than every accident on this road put together."],
  death:["The trail took another company. Folks reckon one in ten who start this road never see the end of it. Try again, and try smarter."],
  win:["Oregon City! Two thousand miles on foot beside a wagon. I've piloted a lot of companies, and few walked it better."],
  indepOnTime:["Independence Rock before the Fourth of July! The saying goes: reach the Rock by Independence Day or risk the snows. Carve your name and celebrate!"],
  indepLate:["Independence Rock after the Fourth. That's what every pilot dreads. We're behind, and the mountains won't wait."],
  chimneyView:["There! Chimney Rock on the horizon. You'll see it for days before we reach it."],
  devilsGate:["Devil's Gate, where the Sweetwater cuts straight through a granite ridge. Wagons have to go around."],
  southPassNear:["South Pass is near. Cross it and every river runs to the Pacific."],
  blueMtns:["The Blue Mountains. Some slopes here are so steep we lower the wagons on ropes chained to trees."],
  dalles:["The Dalles is close. Since '46 there's the Barlow Road, a toll road around Mount Hood, but this company is bound for the river."],
  winter:["Snow already! Two winters back the Donner Party lingered too long and got trapped in the Sierra. Don't repeat their mistake."],
  purge:["Lighter already! This road is lined with dressers, stoves and pianos folks couldn't haul any farther."],
  crew:["Glad to have them. A company is only as strong as its people."],
  relic:["A keepsake! Small things carried a long way mean a great deal out here."],
  goldNews:["Gold! A man named Marshall found it at Sutter's Mill back in January. Watch your company. Men are dropping their plows and riding south."],
  territory:["Word from Washington: on August 14, Congress gave Oregon a territorial government. The treaty with Britain made it American back in '46. Now it has a government to match."],
};

/* Trail events. img = art key. choices: {t:label, d:detail, ok:fn(g)->bool, go:fn(g)->string|Promise} */
const EVENTS = [
  {id:'overturned',acts:[1],img:'ev_overturned',title:"The Overturned Wagon",
   text:"A settler's wagon lies on its side in a creek bed, wheels in the air. Its owners are nowhere in sight. Crates are scattered through the shallows.",
   choices:[
    {t:'Scavenge the cargo',d:'+1 uncommon card, +20 Gold, add Dysentery',go:g=>{g.addCard(g.randCard('uncommon'));g.addGold(20);g.addCard('dysentery');return 'You haul out what you can. The creek water did not agree with everyone.';}},
    {t:'Right the wagon',d:'Lose 4 HP. A grateful stranger joins your crew.',go:g=>{g.hurt(4);return g.recruitRandom();}},
    {t:'Keep moving',d:'Heal 3 HP',go:g=>{g.healHp(3);return 'You leave it to the next train.';}}]},
  {id:'ferry',acts:[1,2],img:'ev_ferry',title:"The River Ferryman",
   text:"A man with a raft and a long pole works the crossing and names a steep price for every wagon. Emigrants grumbled about ferry fees all along the road, and most of them paid anyway.",
   choices:[
    {t:'Pay 30 Gold',d:'Your next River crossing is free',ok:g=>g.gold>=30,go:g=>{g.addGold(-30);g.flags.ferry=true;return 'He touches his hat. The next river will be easy.';}},
    {t:'Haggle him down',d:'Needs Haggle or Bribe in your wagon. Pay 10 Gold, next River free.',ok:g=>g.gold>=10&&g.deck.some(c=>c.id==='haggle'||c.id==='bribe_the_ferryman'),go:g=>{g.addGold(-10);g.flags.ferry=true;return 'A lower price and a handshake. Not bad.';}},
    {t:'Build your own raft',d:'Lose 5 HP. Gain Spare Wheel.',go:g=>{g.hurt(5);g.addCard('spare_wheel');return 'Hard work and wet boots, but you keep your money.';}}]},
  {id:'chest',acts:[1,2,3],img:'ev_chest',title:"The Abandoned Medicine Chest",
   text:"A brass-bound chest sits beneath a trail marker. Somebody's whole pharmacy, left behind to lighten a wagon.",
   choices:[
    {t:'Crack it open',d:'+1 rare Apothecary card, add Dysentery',go:g=>{g.addCard(g.randCard('rare','apothecary'));g.addCard('dysentery');return 'Some bottles help. Some definitely do not.';}},
    {t:'Sell the brass and vials',d:'+25 Gold',go:g=>{g.addGold(25);return 'Brass fetches a fair price at any fort.';}},
    {t:'Leave it in peace',d:'Purge a Curse from your wagon (or +3 Max HP)',go:async g=>{ if(g.deck.some(c=>CARDS[c.id].type==='curse')){await g.pickPurge(c=>CARDS[c.id].type==='curse','Purge which Curse?');return 'You feel better already.';} g.maxHp+=3;g.healHp(3);return 'A clear conscience. +3 Max HP.';}}]},
  {id:'blacksmith',acts:[1,2],img:'ev_blacksmith',title:"The Stranded Blacksmith",
   text:"A blacksmith has set up a portable forge beside the road. His own wagon broke down and his oxen died. He will work for food or coin.",
   choices:[
    {t:'Share provisions',d:'Remove a Supply card. Upgrade 2 random cards.',ok:g=>g.deck.some(c=>CARDS[c.id].type==='supply'),go:async g=>{await g.pickPurge(c=>CARDS[c.id].type==='supply','Give up which Supply card?');g.upgradeRandom(2);return 'Fed and grateful, he hammers your gear into shape.';}},
    {t:'Pay 25 Gold',d:'Upgrade a card of your choice. +4 Max HP.',ok:g=>g.gold>=25,go:async g=>{g.addGold(-25);await g.pickUpgrade();g.maxHp+=4;g.healHp(4);return 'Fine work, fairly paid.';}},
    {t:'Pass by',d:'+10 Gold (you find a dropped coin purse)',go:g=>{g.addGold(10);return 'Somebody else will help him. You hope.';}}]},
  {id:'wildfire',acts:[1],img:'ev_wildfire',title:"The Prairie Wildfire",
   text:"Smoke on the horizon, then flame. A grass fire is racing across the prairie toward the trail.",
   choices:[
    {t:'Whip through the gap',d:'Lose 6 HP. Gain upgraded Whip the Oxen, +20 Gold.',go:g=>{g.hurt(6);g.addCard('whip_the_oxen',true);g.addGold(20);return 'Singed but through! You find coins in a burned-out camp.';}},
    {t:'Backburn a firebreak',d:'Remove a card from your wagon. Take no damage.',go:async g=>{await g.pickPurge(c=>true,'Burn which card for the firebreak?');return 'The fire starves at your break and passes by.';}}]},
  {id:'cardgame',acts:[1,2,3],img:'ev_cardgame',title:"The Midnight Card Game",
   text:"Lantern light and the snap of cards on a crate lid. A smiling stranger waves you over. \"Friendly game?\"",
   choices:[
    {t:'Ante up 20 Gold',d:'50%: win 55 Gold and a rare card',ok:g=>g.gold>=20,go:g=>{g.addGold(-20); if(rf()<0.5){g.addGold(55);g.addCard(g.randCard('rare'));return 'Royal luck! You rake in the pot.';} return 'He shows four aces. Of course he does.';}},
    {t:'Cheat the deck',d:'+35 Gold, but someone notices',go:g=>{g.addGold(35);g.flags.ambush=true;return 'You pocket the winnings. Shadows follow you out of camp...';}},
    {t:'Watch and learn',d:'Gain Haggle',go:g=>{g.addCard('haggle');return 'You pick up a trick or two about bargaining.';}}]},
  {id:'snakes',acts:[1,2],img:'enc_snakes',title:"The Rattlesnake Nest",
   text:"Supply crates left beside the trail. The buzzing from underneath them is unmistakable.",
   choices:[
    {t:'Reach for the crates',d:'Lose 7 HP. Gain upgraded Frontier Rifle and Smoked Jerky.',go:g=>{g.hurt(7);g.addCard('frontier_rifle',true);g.addCard('smoked_jerky');return 'Bitten, swollen, and well supplied.';}},
    {t:'Smoke them out',d:'Pay 15 Gold for lamp oil. Gain an uncommon card.',ok:g=>g.gold>=15,go:g=>{g.addGold(-15);g.addCard(g.randCard('uncommon'));return 'The snakes slither off. The crates are yours.';}},
    {t:'Detour around',d:'Costs 3 extra days',go:g=>{g.addDays(3);return 'Safe, but slow.';}}]},
  {id:'trapper',acts:[2],img:'npc_prospector',title:"The Starving Trapper",
   text:"A gaunt mountain man stumbles out of the willows. The beaver trade collapsed years ago and he has nothing left but a bundle of old pelts.",
   choices:[
    {t:'Feed him',d:'Lose 6 HP of your own rations. He pays you in pelts worth 60 Gold.',go:g=>{g.hurt(6);g.addGold(60);return 'He eats like a wolf, then presses his pelts into your hands.';}},
    {t:'Rob him',d:'+40 Gold. Add Grief.',go:g=>{g.addGold(40);g.addCard('grief');return 'Your company is quiet the rest of the day.';}},
    {t:'Point him toward the fort',d:'+3 Max HP',go:g=>{g.maxHp+=3;g.healHp(3);return 'He thanks you and limps off east.';}}]},
  {id:'shortcut',acts:[2,3],img:'ev_frozen',title:"The Frozen Shortcut",
   text:"A guide in a fur hat swears he knows a cutoff that saves ten days. In 1845 a guide named Stephen Meek promised the same thing. The families who followed him into the Oregon high desert ran out of water and food, fell sick, and more than twenty of them died.",
   choices:[
    {t:'Take the shortcut',d:'Save 10 days. Add Broken Axle and Frostbite.',go:g=>{g.addDays(-10);g.addCard('broken_axle');g.addCard('frostbite');return 'Faster, colder, and hard on the wagon.';}},
    {t:'Stick to the main trail',d:'Heal 5 HP. Gain Boil River Water.',go:g=>{g.healHp(5);g.addCard('boil_river_water');return 'The long way is the known way.';}}]},
  {id:'ghost',acts:[3],img:'ev_ghost',title:"The Ghost Wagon",
   text:"In the fog ahead, a wagon glows pale blue. No oxen. No driver. Lanterns swing on its bows.",
   choices:[
    {t:'Take the lanterns',d:'Lose 8 HP. Gain a random keepsake.',go:g=>{g.hurt(8);return g.giveRandomRelic();}},
    {t:'Leave an offering',d:'Pay 20 Gold. Purge ALL Curses from your wagon.',ok:g=>g.gold>=20,go:g=>{g.addGold(-20);const n=g.purgeAllCurses();return n?`The fog lifts, and so does a weight. ${n} curse${n>1?'s':''} gone.`:'The fog lifts. You had nothing to lose anyway.';}},
    {t:'Drive hard until dawn',d:'Save 4 days. +1 Stamina on Turn 1 of the final boss.',go:g=>{g.addDays(-4);g.flags.driveHard=true;return 'You do not look back.';}}]},
  {id:'furniture',acts:[1,2],img:'ic_stove',contain:true,title:"Furniture on the Prairie",
   text:"The trail here is lined with abandoned goods: a walnut dresser, a rocking chair, a cast-iron stove. Families learned the hard way that oxen could not haul a whole house to Oregon.",
   choices:[
    {t:'Lighten your own wagon',d:'Remove up to 2 cards',go:async g=>{await g.pickPurge(c=>true,'Leave which card behind? (1 of 2)',true);await g.pickPurge(c=>true,'Leave another card? (2 of 2)',true);return 'Your oxen walk a little easier.';}},
    {t:'Take the stove anyway',d:'Gain Abandon the Stove',go:g=>{g.addCard('abandon_the_stove');return 'It is a very good stove. For now.';}},
    {t:'Leave it all',d:'Nothing happens',go:g=>'You roll on past the furniture graveyard.'}]},
  {id:'traders',acts:[2,3],img:'rl_blanket',contain:true,title:"Trading on the Trail",
   text:null, // set dynamically
   choices:[
    {t:'Trade goods for food',d:'Remove a card. Heal 15 HP and +5 Max HP.',ok:g=>g.deck.some(c=>CARDS[c.id].type!=='curse'),go:async g=>{const c=await g.pickPurge(c=>CARDS[c.id].type!=='curse','Trade which card?'); if(!c){g.healHp(3);return 'You have nothing they want. You part on good terms.';} g.maxHp+=5;g.healHp(15);return g.act===3?'Dried salmon and camas root. The best meal in weeks.':'Buffalo meat and fresh moccasins. A fair trade.';}},
    {t:'Hire a guide for the next river',d:'Pay 25 Gold. Your next River crossing is free.',ok:g=>g.gold>=25,go:g=>{g.addGold(-25);g.flags.ferry=true;return 'Your guide knows every safe ford on this stretch.';}},
    {t:'Thank them and move on',d:'Heal 3 HP',go:g=>{g.healHp(3);return 'You part on good terms.';}}]},
  {id:'goldfever',acts:[2,3],minDate:Date.UTC(1848,6,20),img:'rl_goldpan',contain:true,title:"Gold Fever",
   text:"A rider gallops past heading south, shouting the news: gold at Sutter's Mill in California! Half your company starts muttering about turning south.",
   choices:[
    {t:'Pay 30 Gold to keep everyone together',d:'Your crew stays',ok:g=>g.gold>=30&&g.crew.length>0,go:g=>{g.addGold(-30);return 'A bonus and a speech keeps the company bound for Oregon.';}},
    {t:'Let them go',d:'A random crew member leaves. They leave you a Gold Pan.',ok:g=>g.crew.length>0,go:g=>{const c=g.loseRandomCrew();g.addRelic('goldpan');return `${c} rides off to California, leaving a gold pan behind.`;}},
    {t:'Try a creek yourself',d:'50%: +60 Gold. Otherwise lose 6 HP.',go:g=>{if(rf()<.5){g.addGold(60);return 'Color in the pan! Not much, but it spends.';} g.hurt(6);return 'Cold water, sore back, no gold.';}}]},
  {id:'territory',acts:[3],minDate:Date.UTC(1848,9,1),img:'rl_journal',contain:true,title:"News from Washington",
   text:"A rider overtakes the company with newspapers carried out from the States. On August 14, 1848, Congress organized the Oregon Territory. The 1846 treaty with Britain had already made this country American. Now it has a territorial government.",
   choices:[
    {t:'Celebrate',d:'Heal 10 HP. Costs 2 days.',go:g=>{g.healHp(10);g.addDays(2);return 'Fiddles come out. Everyone sleeps late.';}},
    {t:'Press on',d:'Save 3 days',go:g=>{g.addDays(-3);return 'Good news travels well at a fast walk.';}}]},
];
