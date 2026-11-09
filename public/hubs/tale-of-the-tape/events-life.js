/* Tale of the Tape — events in uniform and after the last bell. Same shape as events-career.js. */
(function (T) {
  'use strict';
  const EV = T.events = T.events || [];
  const add = (...list) => EV.push(...list);
  const E = () => T.engine;
  const yr = (s) => E().year(s.t);
  const age = (s) => E().age(s);
  const svc = (s) => s.service || {};

  // ============ in uniform ============
  add(
    {
      id: 'svc_boot', title: 'Basic Training', phase: 'service', weight: 9, when: (s) => !s.flags.svc_boot,
      text: (s, x) => `Your drill sergeant reads your name off the roster, stops, and looks up. "THE ${x.last().toUpperCase()}? The fighter?" Every man in the barracks turns around. "Well, well. Let's see you do pushups, champ."`,
      choices: [
        { label: 'Do two hundred', hint: 'Stamina', go: (x) => { x.flag('svc_boot'); x.stat('sta', 2); x.rep(3); return 'You stop at two hundred because he tells you to stop. He likes you after that, in the way sergeants like anybody.'; } },
        { label: 'Crack a joke', hint: 'Heart', go: (x) => { x.flag('svc_boot'); x.heart(5); return 'The barracks laughs. You peel potatoes for a week. Worth it.'; } },
      ],
    },
    {
      id: 'svc_tournament', title: 'The Base Boxing Tournament', phase: 'service', weight: 3, when: (s) => !s.flags.svc_tourney,
      text: 'The base is holding a boxing tournament and everyone expects the pro to win it. Your first opponent is a farm kid from Iowa who has never boxed and is not afraid of anything.',
      choices: [
        { label: 'Win it, but carry the kid', hint: 'Reputation', go: (x) => { x.flag('svc_tourney'); x.rep(4); x.sharp(15); return 'You win the tournament. The Iowa kid lasts three rounds and becomes your best friend on the base.'; } },
        { label: 'Teach the base a lesson', hint: 'Sharpness', go: (x) => { x.flag('svc_tourney'); x.sharp(25); x.fame(1); return 'You win four fights in four nights, none of them past the second round. The colonel bets on you and wins a jeep.'; } },
      ],
    },
    {
      id: 'svc_exhibition', title: 'On the Same Card as Joe Louis', phase: 'service', weight: (s) => (svc(s).how === 'exhibition' ? 8 : 1.5), when: (s) => !s.flags.svc_louis && yr(s) <= 1945,
      text: 'The Army sends you on an exhibition tour of camps and hospitals. On one card, the headliner is Sergeant Joe Louis, heavyweight champion of the world. He boxes three easy rounds, then spends an hour signing casts in the hospital ward.',
      archive: 'Louis boxed about 96 exhibitions for roughly two million soldiers. He pushed back against segregation on Army bases and was once detained by military police for refusing to leave a "whites only" bus station waiting room.',
      choices: [
        { label: 'Say hello', hint: 'Heart', go: (x) => { x.flag('svc_louis'); x.heart(10); x.remember('war', 'shared a card with Joe Louis on an Army exhibition tour', 2); return 'He shakes your hand and asks where you are from. He is quieter than you expected. "Keep your left up," he says, and goes back to the soldiers.'; } },
        { label: 'Watch him work the ward', go: (x) => { x.flag('svc_louis'); x.rep(4); x.remember('war', 'shared a card with Joe Louis on an Army exhibition tour', 2); return 'He never hurries a single soldier. You do the next ward the same way.'; } },
      ],
    },
    {
      id: 'svc_orders', title: 'Orders', phase: 'service', weight: 6, when: (s) => !svc(s).theater && s.flags.svc_boot,
      text: (s) => (svc(s).how === 'exhibition' ? 'Your orders come through. Special Services: more exhibitions, morale shows, bond drives. Some of them overseas.' : 'Your orders come through. You will be shipping out.'),
      choices: (s) => [{
        label: 'Read them',
        go: (x) => {
          const how = svc(x.s).how;
          const theater = how === 'exhibition' ? (x.chance(0.4) ? 'Europe' : 'stateside') : x.pick(['Europe', 'Europe', 'the Pacific', 'the Pacific', 'stateside']);
          x.s.service.theater = theater;
          if (theater === 'stateside') return 'You will stay stateside: training camps in Texas, Georgia, and California. You teach hand-to-hand combat to men younger than you.';
          x.remember('war', `shipped out to ${theater} in ${x.year()}`, 2);
          return theater === 'Europe' ? 'You sail from New York on a troop ship so crowded you sleep in shifts. The Statue of Liberty gets small behind you.' : 'You ship out of San Francisco under the Golden Gate Bridge. Somebody starts singing. Nobody tells him to stop.';
        },
      }],
    },
    {
      id: 'svc_letter', title: 'Mail Call', phase: 'service', weight: 3, repeat: 30,
      text: (s, x) => `A letter from ${s.flags.married && s.people.sweetheart ? s.people.sweetheart.name : s.people.family.name}. ${x.pick(['They read about you in the paper.', 'The neighborhood has a victory garden now.', 'Prices are up and everybody has a ration book.', 'They put a blue star in the front window for you.'])}`,
      choices: [
        { label: 'Write back that night', hint: 'Heart', go: (x) => { x.heart(6); return 'You write it on your helmet by flashlight. It is mostly about food.'; } },
        { label: 'Read it until it falls apart', go: (x) => { x.heart(3); return 'You keep it in your breast pocket, folded into a square.'; } },
      ],
    },
    {
      id: 'svc_combat', title: 'Under Fire', phase: 'service', weight: 3, when: (s) => (svc(s).theater === 'Europe' || svc(s).theater === 'the Pacific') && !s.flags.svc_combat,
      text: (s) => (svc(s).theater === 'Europe' ? 'Your unit moves up through hedgerows in France. Shells land close enough to rattle your teeth. Nothing in a boxing ring prepared you for this, and everything did.' : 'Your unit hits the beach on an island you had never heard of a month ago. The heat is the second-worst thing about it.'),
      archive: 'Many professional athletes served in combat. Others, especially famous ones, were assigned to morale and physical-training jobs, which caused public arguments about fairness.',
      choices: [
        { label: 'Keep your head down and get your men through', go: (x) => {
          x.flag('svc_combat');
          if (x.chance(0.18)) { x.health(-25); x.flag('wounded'); x.rep(8); x.stat('spd', -3); x.remember('war', 'was wounded in combat and got a Purple Heart', 3); return 'Shrapnel in your leg. A medic who looks about fifteen patches you up. You get a Purple Heart and three months in a hospital.'; }
          x.rep(6); x.heart(-6); x.remember('war', `saw combat in ${x.s.service.theater}`, 2); return 'You come through it. Not everybody does. You carry the names with you.';
        } },
      ],
    },
    {
      id: 'svc_bulge', title: 'Winter in the Ardennes', phase: 'service', weight: 6, when: (s) => svc(s).theater === 'Europe' && s.t >= E().weekOf(1944, 11, 16) && s.t <= E().weekOf(1945, 1, 25) && !s.flags.bulge,
      text: 'December 1944. The Germans break through in the Ardennes forest. Snow, fog, and no one sure where the front is. Men are cut off. Supplies are short. It is the coldest you have ever been.',
      archive: 'The Battle of the Bulge (Dec 1944 to Jan 1945) was the largest battle the U.S. Army fought in the war. African American volunteers fought in integrated platoons for the first time during the crisis.',
      choices: [{ label: 'Hold on', go: (x) => { x.flag('bulge'); x.stat('sta', 2); x.heart(-8); x.rep(5); x.remember('war', 'held the line in the Battle of the Bulge', 3); return 'You share a foxhole and one blanket with a kid from Alabama. You both make it to January.'; } }],
    },
    {
      id: 'svc_segregation', title: 'The Mess Hall', phase: 'service', weight: 2, when: (s) => !s.flags.svc_seg,
      text: 'At a camp in the South, German prisoners of war are served in the base restaurant. Black American soldiers in uniform are told to eat in the kitchen.',
      archive: 'Black soldiers served in segregated units during World War II. Several wrote about watching German POWs receive better treatment than they did.',
      choices: [
        { label: 'Take your tray to the kitchen and eat with them', hint: 'Reputation', go: (x) => { x.flag('svc_seg'); x.flag('activist_seed'); x.rep(6); x.remember('civil', 'ate in the kitchen with the Black soldiers when the mess hall would not serve them', 2); return 'Nobody says anything. A sergeant writes your name down. You keep doing it.'; } },
        { label: 'Write home about it', go: (x) => { x.flag('svc_seg'); return 'You write it down so you will not pretend later that you did not see it.'; } },
        { label: 'Look away', go: (x) => { x.flag('svc_seg'); x.heart(-3); return 'It is the Army. You tell yourself that.'; } },
      ],
    },
    {
      id: 'svc_buddy', title: 'Your Buddy', phase: 'service', weight: 3, when: (s) => !s.flags.svc_buddy,
      text: (s, x) => `${x.pick(['Sal', 'Moe', 'Jimmy', 'Hector', 'Walt', 'Danny'])}, from your unit, can't box at all but won't stop asking you to teach him. He says he's going to open a diner after the war and hang your picture by the register.`,
      choices: [{ label: 'Teach him', go: (x) => { x.flag('svc_buddy', true); x.heart(5); x.later('buddy_diner', 40, 120); return 'He never learns to keep his elbows in. He makes you laugh every day.'; } }],
    },
    {
      id: 'svc_promotion', title: 'Stripes', phase: 'service', weight: 2, when: (s) => !s.flags.sergeant,
      text: 'Your captain makes you a sergeant. Somebody has to keep these kids alive and in shape, and they listen to you.',
      choices: [{ label: 'Sew them on', go: (x) => { x.flag('sergeant'); x.rep(4); x.heart(3); return 'Sergeant. Your mother will frame the photo.'; } }],
    },
    {
      id: 'homecoming', title: 'Coming Home', chain: true, anyPhase: true,
      text: (s) => `The war is over. You come home on a train full of soldiers, through towns hanging flags off every porch. You are ${age(s)}. ${s.flags.wounded ? 'Your leg aches when it rains.' : 'Your body feels different. Harder in some places. Slower in others.'} The GI Bill would pay for school, or help you start a business. Or you could lace the gloves back up.`,
      choices: (s) => s.retired ? [{ label: 'Go home', go: (x) => { x.E.endService(x.s); return 'You walk up your own front steps for the first time in years.'; } }] : [
        { label: 'Back to boxing', hint: 'Rusty, but hungry', go: (x) => { x.E.endService(x.s); x.remember('war', 'came home from the war and went straight back to the gym', 1); return 'The first day back in the gym, you get winded skipping rope. The second day, a little less.'; } },
        { label: 'Use the GI Bill for college. Retire', hint: 'A different life', go: (x) => { x.E.endService(x.s); x.flag('college'); x.retire('chose'); x.remember('war', 'used the GI Bill to go to college', 2); return 'You enroll at a state college. You are the only freshman with a cauliflower ear.'; } },
      ],
    },
    {
      id: 'buddy_diner', title: 'The Diner', chain: true, anyPhase: true,
      text: 'A postcard: a photo of a little diner with a neon sign. On the back, in your Army buddy\'s handwriting: "Your picture is by the register. Free pie for life. Come by."',
      go: (x) => { x.heart(10); return ''; },
    },
  );

  // ============ life after boxing: everybody ============
  add(
    {
      id: 'aft_comeback', title: 'One More Time', after: 'any', weight: 3, when: (s) => s.after.years <= 4 && age(s) <= 39 && s.health >= 25 && !s.flags.comeback_offered,
      text: (s) => `A promoter calls. "${s.money < 1000 ? 'I hear things are tight.' : 'The fans miss you.'} One big fight, ${s.f.last}. Your name still sells tickets." Your old gloves are on a nail by the door.`,
      choices: [
        { label: 'Come back', hint: 'Rusty and older', go: (x) => { x.flag('comeback_offered'); x.E.unretire(x.s); x.remember('comeback', `came out of retirement at ${x.age()}`, 2); return 'You take the gloves off the nail. They still fit. Your trunks do not.'; } },
        { label: 'Stay retired', hint: 'Heart', go: (x) => { x.flag('comeback_offered'); x.heart(5); return 'You hang up the phone. You leave the gloves on the nail.'; } },
      ],
    },
    {
      id: 'aft_kid', title: 'The Kid Is All Grown Up', after: 'any', weight: 6, when: (s) => s.flags.gym_kid && s.flags.gym_kid !== 'gone' && !s.flags.kid_back,
      text: (s) => `Remember ${s.flags.gym_kid}, the skinny kid by the gym door? He is a ranked contender now. He knocks on your door and asks if you will work his corner for his title fight.`,
      choices: [
        { label: 'Work his corner', hint: 'Your old lessons matter now', go: (x) => { x.flag('kid_back'); const won = x.chance(0.4 + (x.s.after.path === 'trainer' || x.s.after.path === 'gym' ? 0.2 : 0)); if (won) { x.heart(15); x.rep(6); x.s.after.standing += 15; x.remember('legacy', `worked the corner when ${x.s.flags.gym_kid}, the kid I taught to jab, won the title`, 4); return `${x.s.flags.gym_kid} wins the title with a jab you taught him when he was eleven. In the ring afterward, he hands you the belt first.`; } x.heart(6); x.s.after.standing += 6; x.remember('legacy', `worked the corner for ${x.s.flags.gym_kid}, the kid I taught to jab, in his title fight`, 2); return 'He loses a close one. In the dressing room he says, "Next time." You believe him.'; } },
        { label: 'Watch from the crowd', go: (x) => { x.flag('kid_back'); x.heart(8); return 'You cheer so loud the man next to you asks if you are his father. "Something like that," you say.'; } },
      ],
    },
    {
      id: 'aft_tate', title: 'Deacon Comes By', after: 'any', weight: 4, when: (s) => s.flags.tate_friend && !s.flags.aft_tate,
      text: 'Deacon Tate shows up at your door with a bag of oranges, the way he used to bring them to the gym. He is retired too. Neither of you has to explain anything.',
      choices: [
        { label: 'Ask him to work with you', hint: 'Partnership', go: (x) => { x.flag('aft_tate'); x.s.after.standing += 8; x.heart(8); return 'He says yes before you finish asking. For the next ten years, the two of you are never more than a phone call apart.'; } },
        { label: 'Spend the afternoon on the porch', go: (x) => { x.flag('aft_tate'); x.heart(10); return 'You talk about 1938 until the streetlights come on.'; } },
      ],
    },
    {
      id: 'aft_hof', title: 'The Hall of Fame', after: 'any', weight: 5, when: (s) => yr(s) >= 1954 && !s.flags.hof_vote && (s.belts > 0 || s.fame >= 60),
      text: 'Ring Magazine is voting on its Boxing Hall of Fame. Your name is on the ballot.',
      archive: 'The Ring Magazine Boxing Hall of Fame began inducting fighters in 1954.',
      choices: [{
        label: 'Wait for the call',
        go: (x) => {
          x.flag('hof_vote');
          const L = x.E.legacy(x.s).total;
          if (L >= 110 || (x.s.belts > 0 && x.chance(0.5))) { x.flag('hof'); x.fame(10); x.s.after.standing += 20; x.remember('legacy', 'was voted into the Boxing Hall of Fame', 5); return 'The phone rings at 7 a.m. You are in. You sit on the kitchen floor for a while.'; }
          return 'The call does not come this year. Your trainer would have said the voters were bums. He would have been right.';
        },
      }],
    },
    {
      id: 'aft_pension', title: 'No Pension', after: 'any', weight: 2, when: (s) => !s.flags.aft_pension,
      text: (s, x) => `You run into a fighter you used to see at every card. He is selling pencils outside a train station. Boxers do not get pensions. Nobody saved anything for him, including him.`,
      archive: 'Unlike baseball players, who won a pension plan in 1947, professional boxers had no union and no pension. Many famous fighters died broke.',
      choices: [
        { label: 'Help him out', hint: 'Money', req: (s) => s.money >= 100, go: (x) => { x.flag('aft_pension'); x.money(-60); x.rep(5); x.heart(4); return 'You give him enough for a month\'s rent and the name of a guy who is hiring.'; } },
        { label: 'Start a fund for old fighters', hint: 'Reputation, fame', req: (s) => s.fame >= 30, go: (x) => { x.flag('aft_pension'); x.rep(8); x.s.after.standing += 8; x.remember('legacy', 'started a fund for broke old fighters', 3); return 'Benefit dinners, exhibitions, a lot of phone calls. It is not a pension. It is better than nothing.'; } },
        { label: 'Buy a pencil', go: (x) => { x.flag('aft_pension'); return 'You buy a pencil. You keep it in your pocket for years.'; } },
      ],
    },
    {
      id: 'aft_memoir', title: 'The Book', after: 'any', weight: 2, when: (s) => s.fame >= 35 && !s.flags.memoir,
      text: (s, x) => `${x.reporter()} wants to write your life story. "As told to." You would have to remember everything. Even the parts you would rather not.`,
      choices: [
        { label: 'Tell all of it', hint: 'Fame, reputation', go: (x) => { x.flag('memoir'); x.fame(4); x.rep(x.s.flags.ever_crooked ? 6 : 2); x.money(200); return 'You tell all of it. The book sells modestly. One reviewer calls it "surprisingly honest." You underline that.'; } },
        { label: 'The highlights only', go: (x) => { x.flag('memoir'); x.money(300); return 'The book is mostly about your left hook. It sells fine.'; } },
      ],
    },
    {
      id: 'aft_health', title: 'Slurring', after: 'any', weight: 4, when: (s) => (s.rec.kod >= 3 || s.health < 30) && !s.flags.aft_health,
      text: (s) => `${s.flags.married && s.people.sweetheart ? s.people.sweetheart.name : 'Your sister'} notices first. Your words come out slow sometimes. Your hands shake when you pour coffee. The doctor uses a phrase you have heard about other fighters: "punch drunk."`,
      archive: 'Repeated head blows can cause what is now called chronic traumatic encephalopathy (CTE). In the 1950s it was called "punch drunk" or dementia pugilistica, and fighters got little help.',
      choices: [{ label: 'Take it one day at a time', go: (x) => { x.flag('aft_health'); x.health(-10); x.heart(-5); x.remember('injury', 'paid for the punches in my later years', 2); return 'Some days are good. On good days you tell the old stories, and you tell them well.'; } }],
    },
    {
      id: 'aft_tv_interview', title: 'Old Film', after: 'any', weight: 2, when: (s) => yr(s) >= 1955 && s.fame >= 30 && !s.flags.old_film,
      text: 'A TV sports show wants to air film of one of your old fights and interview you. You have never seen yourself fight. Not once.',
      choices: [{ label: 'Watch it on the air', go: (x) => { x.flag('old_film'); x.fame(3); x.heart(6); return 'You were faster than you remember. You were also dropping your left hand. Your old trainer was right about everything.'; } }],
    },
  );

  // ============ second acts ============
  add(
    // Trainer
    {
      id: 'tr_prospect', title: 'A Prospect', after: 'trainer', weight: 6, when: (s) => !s.flags.prospect,
      text: 'A raw kid walks into the gym and knocks a sparring partner through the ropes on his first day. No technique, all heart. Every trainer in town wants him. He wants you.',
      choices: [
        { label: 'Teach him defense first', hint: 'Slow and safe', go: (x) => { x.flag('prospect', 'safe'); x.later('tr_prospect_shot', 80, 160); return 'Six months of nothing but footwork. He hates you. Then he stops getting hit.'; } },
        { label: 'Turn him loose', hint: 'Fast and risky', go: (x) => { x.flag('prospect', 'fast'); x.later('tr_prospect_shot', 40, 100); return 'Nine knockouts in nine fights. The papers love him. You worry.'; } },
      ],
    },
    {
      id: 'tr_prospect_shot', title: 'Your Fighter\'s Title Shot', chain: true, anyPhase: true, when: (s) => !!s.after,
      text: 'The kid you trained has a title shot. In the corner before the first bell, he looks at you the way you used to look at your trainer.',
      choices: [{
        label: 'Give him the speech',
        go: (x) => {
          const p = x.s.flags.prospect === 'safe' ? 0.55 : 0.4;
          if (x.chance(p)) { x.s.after.standing += 18; x.heart(12); x.fame(6); x.remember('legacy', 'trained a world champion', 4); return 'He wins. You do not remember climbing into the ring. You remember the noise.'; }
          x.s.after.standing += 6; x.heart(-3); x.remember('legacy', 'trained a fighter all the way to a title shot', 2); return 'He loses, but he finishes on his feet. "Again," he says in the dressing room. "We go again."';
        },
      }],
    },
    {
      id: 'tr_hurt', title: 'He Wants to Fight Hurt', after: 'trainer', weight: 3, when: (s) => !s.flags.tr_hurt,
      text: 'Your fighter hurt his hand in camp and wants to fight anyway. The purse would pay his family\'s rent for a year.',
      choices: [
        { label: 'Pull him out', hint: 'Reputation', go: (x) => { x.flag('tr_hurt'); x.rep(4); x.s.after.standing += 4; return 'He does not speak to you for a week. His hand heals. He thanks you later, sort of.'; } },
        { label: 'Let him fight', hint: 'Money', go: (x) => { x.flag('tr_hurt'); x.money(150); if (x.chance(0.5)) return 'He wins with one hand. Everyone calls it courage. You call it luck.'; x.heart(-6); return 'He loses, and the hand never heals right. You think about it for a long time.'; } },
      ],
    },
    // Gym
    {
      id: 'gym_rent', title: 'The Rent Goes Up', after: 'gym', weight: 3, repeat: 150,
      text: 'The landlord doubles the rent. The building could make more money as a furniture store.',
      choices: [
        { label: 'Pay it', go: (x) => { x.money(-400); return 'You pay. You start charging a quarter more a month. Nobody complains, out loud.'; } },
        { label: 'Hold a benefit card', hint: 'Fame helps', go: (x) => { if (x.chance(0.4 + x.s.fame / 150)) { x.money(300); x.s.after.standing += 4; return 'Every fighter who ever trained there shows up. You make the rent and then some.'; } x.money(-200); return 'A rainy night and a thin crowd. You make half the rent.'; } },
      ],
    },
    {
      id: 'gym_pal', title: 'The Neighborhood Kids', after: 'gym', weight: 4, when: (s) => !s.flags.gym_pal,
      text: 'A police captain asks if you will run a free boxing program for neighborhood kids after school. "Keeps them off the corner."',
      choices: [
        { label: 'Open the doors for free', hint: 'Money down, standing up', go: (x) => { x.flag('gym_pal'); x.money(-100); x.s.after.standing += 10; x.rep(6); x.remember('legacy', 'ran a free boxing program for neighborhood kids', 3); return 'Forty kids show up on the first day. Thirty-nine of them have never been in a gym. One of them is a natural.'; } },
        { label: 'Charge a little', go: (x) => { x.flag('gym_pal'); x.money(60); x.s.after.standing += 3; return 'A dime a session. Some kids cannot pay. You look the other way a lot.'; } },
      ],
    },
    {
      id: 'gym_camp', title: 'A Contender Wants Your Gym', after: 'gym', weight: 3, when: (s) => !s.flags.gym_camp,
      text: 'The top contender wants to train at your gym for his title fight. Reporters, photographers, and a lot of money would come with him.',
      choices: [{ label: 'Rent him the gym', go: (x) => { x.flag('gym_camp'); x.money(500); x.fame(3); return 'For six weeks your gym is in every newspaper in the country. Membership doubles.'; } }],
    },
    // Referee
    {
      id: 'ref_call', title: 'The Call', after: 'referee', weight: 4, repeat: 150,
      text: 'A fighter is getting beaten badly, but it is a big title fight, the crowd is screaming, and his corner will not throw the towel. It is your decision.',
      choices: [
        { label: 'Stop it now', hint: 'Reputation', go: (x) => { x.rep(5); x.s.after.standing += 5; return 'The crowd boos for five minutes. The fighter\'s mother finds you afterward and hugs you.'; } },
        { label: 'Give him one more round', go: (x) => { if (x.chance(0.6)) { x.fame(2); return 'He survives the round. He loses the decision. He walks out on his own.'; } x.rep(-8); x.heart(-10); return 'He goes down hard in the next round and is carried out. You do not sleep for a long time.'; } },
      ],
    },
    {
      id: 'ref_bribe', title: 'An Envelope for the Referee', after: 'referee', weight: 3, when: (s) => !s.flags.ref_bribe,
      text: 'Before a big fight, someone slips an envelope into your coat pocket. Inside is a lot of money and a note: "Watch the low blows. From our guy, not to him."',
      choices: [
        { label: 'Report it to the commission', hint: 'Reputation', go: (x) => { x.flag('ref_bribe'); x.rep(10); x.s.after.standing += 8; return 'The commission makes a quiet arrest. You referee the fight straight down the middle.'; } },
        { label: 'Keep it', hint: 'Money', go: (x) => { x.flag('ref_bribe'); x.money(800); x.rep(-15); x.flag('ever_crooked'); return 'You keep it. You call the fight straight anyway, mostly. That does not make it better.'; } },
      ],
    },
    // Broadcaster
    {
      id: 'bc_big', title: 'The Big Broadcast', after: 'broadcaster', weight: 4, when: (s) => !s.flags.bc_big,
      text: (s) => `The network wants you on the call for the biggest fight of the year, ${yr(s) >= 1950 ? 'on television, coast to coast' : 'on the radio, coast to coast'}.`,
      choices: [{ label: 'Call it like you lived it', go: (x) => { x.flag('bc_big'); x.fame(6); x.s.after.standing += 8; x.money(300); x.remember('legacy', 'called the biggest fight of the year on national broadcast', 2); return 'In the seventh round you predict the knockout one punch before it lands. The sports pages call you "the voice."'; } }],
    },
    {
      id: 'bc_gaffe', title: 'On the Air', after: 'broadcaster', weight: 2, when: (s) => !s.flags.bc_gaffe,
      text: 'Live on the air, you forget a fighter\'s name. Completely. Ten seconds of silence, coast to coast.',
      choices: [{ label: 'Laugh at yourself', go: (x) => { x.flag('bc_gaffe'); x.fame(2); return '"Folks, I\'ve been hit in the head a few times myself." The mail is overwhelmingly kind.'; } }],
    },
    {
      id: 'bc_clay', title: 'Interviewing the Kid from Louisville', after: 'broadcaster', weight: 6, when: (s) => yr(s) >= 1961 && !s.flags.bc_clay,
      text: 'You interview a young heavyweight named Cassius Clay. He predicts the round he will win in, recites a poem he wrote, and asks you whether you think he is pretty. You have never seen anything like him.',
      choices: [{ label: 'Let him talk', go: (x) => { x.flag('bc_clay'); x.fame(3); x.heart(6); return 'You barely say a word. It is the best interview of your career.'; } }],
    },
    // Promoter
    {
      id: 'pr_tv', title: 'The TV Contract', after: 'promoter', weight: 4, when: (s) => yr(s) >= 1950 && !s.flags.pr_tv,
      text: 'A network offers to televise your fight cards. The money is enormous. The catch: they want to pick the matchups, and they want blood.',
      choices: [
        { label: 'Sign', hint: 'Money', go: (x) => { x.flag('pr_tv'); x.money(2500); x.rep(-3); return 'Your cards are on TV every other Friday. You make more money in a year than in your whole fighting career.'; } },
        { label: 'Keep control', hint: 'Standing', go: (x) => { x.flag('pr_tv'); x.s.after.standing += 6; x.rep(3); return 'You promote fights that make sense. Smaller money. Better sleep.'; } },
      ],
    },
    {
      id: 'pr_mob', title: 'Partners', after: 'promoter', weight: 3, when: (s) => !s.flags.pr_mob,
      text: 'Certain people want a piece of your promotion company. They explain this the way people explain the weather: something that is going to happen to you.',
      choices: [
        { label: 'Refuse and go to the district attorney', hint: 'Brave', go: (x) => { x.flag('pr_mob'); x.rep(10); x.s.after.standing += 8; if (x.chance(0.3)) { x.money(-1500); return 'Your office burns down in March. Nobody is charged. You rebuild.'; } return 'The DA is very interested. So, unfortunately, are they. You hire a driver.'; } },
        { label: 'Take them on as partners', hint: 'Money', go: (x) => { x.flag('pr_mob'); x.flag('ever_crooked'); x.money(2000); x.rep(-10); return 'Business is better than ever. You stop asking who decides which fighters win.'; } },
      ],
    },
    // Restaurant
    {
      id: 'biz_famous', title: 'A Famous Table', after: 'business', weight: 4, when: (s) => !s.flags.biz_famous,
      text: 'A movie star, a senator, and two Yankees eat at your restaurant on the same night. A columnist writes it up. Suddenly the wait for a table is two hours.',
      choices: [{ label: 'Work the room', go: (x) => { x.flag('biz_famous'); x.money(1500); x.fame(3); x.s.after.standing += 5; return 'You shake four hundred hands. Everyone asks about your biggest fight. You give a slightly different answer every time.'; } }],
    },
    {
      id: 'biz_slump', title: 'A Slow Year', after: 'business', weight: 3, repeat: 150,
      text: 'People are moving to the suburbs. Downtown is emptying out after dark. The restaurant had eleven customers on Saturday.',
      archive: 'In the 1950s millions of families moved to new suburbs, helped by highways and federal home loans. Many downtown businesses struggled.',
      choices: [
        { label: 'Open a second spot in the suburbs', hint: 'Gamble', go: (x) => { if (x.chance(0.55)) { x.money(2000); x.s.after.standing += 5; return 'The suburban location has a parking lot and a line out the door.'; } x.money(-2500); return 'The new place never catches on. You close it after a year.'; } },
        { label: 'Tighten the belt', go: (x) => { x.money(-300); return 'You cut the menu and the hours. You hang on.'; } },
      ],
    },
    // Politics
    {
      id: 'pol_election', title: 'Election Night', after: 'politics', weight: 6, when: (s) => !s.flags.pol_election,
      text: 'Your name is on the ballot for city council. Your campaign posters are old fight posters with a new slogan.',
      choices: [{
        label: 'Wait for the returns',
        go: (x) => {
          x.flag('pol_election');
          if (x.chance(0.35 + x.s.fame / 200 + x.s.rep / 200)) { x.flag('elected'); x.s.after.standing += 15; x.remember('legacy', 'got elected to the city council', 3); return 'You win by eleven hundred votes. Your victory speech is short. "I promise to fight for you" gets the biggest cheer.'; }
          x.s.after.standing += 3; return 'You lose by six hundred votes. Your opponent mentions your knockout losses in every speech. Politics is a rough sport.';
        },
      }],
    },
    {
      id: 'pol_vote', title: 'The Housing Vote', after: 'politics', weight: 5, when: (s) => s.flags.elected && !s.flags.pol_vote,
      text: 'The council is voting on whether new public housing will be open to everyone or kept segregated. Your district is split. Your phone does not stop ringing.',
      archive: 'Fights over segregated housing were common in Northern cities in the 1940s and 1950s, including riots when Black families moved into white neighborhoods.',
      choices: [
        { label: 'Vote to open it to everyone', hint: 'Right, risky', go: (x) => { x.flag('pol_vote'); x.rep(10); x.s.after.standing += 10; x.flag('activist'); x.achieve('activist'); x.remember('civil', 'voted to integrate public housing on the city council', 3); return 'It passes by one vote. Yours. Somebody throws a brick through your office window. Somebody else sends flowers.'; } },
        { label: 'Vote to keep it segregated', go: (x) => { x.flag('pol_vote'); x.rep(-12); return 'You tell yourself you are representing your district. Deacon Tate stops returning your calls.'; } },
      ],
    },
    // Back to work
    {
      id: 'fac_strike', title: 'Strike Vote', after: 'factory', weight: 5, when: (s) => !s.flags.fac_strike,
      text: 'The union calls a strike vote. Better pay, a pension, health insurance. The company says it will replace anybody who walks out.',
      archive: 'After World War II, waves of strikes swept the auto, steel, and coal industries. Unions won pensions and health benefits that built the 1950s middle class.',
      choices: [
        { label: 'Walk the picket line', hint: 'Reputation', go: (x) => { x.flag('fac_strike'); x.money(-200); x.rep(5); x.s.after.standing += 6; return 'A hundred and thirteen days. The union wins a pension plan. You get the pension that boxing never gave you.'; } },
        { label: 'Cross it', go: (x) => { x.flag('fac_strike'); x.money(300); x.rep(-8); return 'You keep getting paid. Nobody eats lunch with you for a long time.'; } },
      ],
    },
    {
      id: 'fac_famous', title: 'The Guy on Line Four', after: 'factory', weight: 3, when: (s) => s.fame >= 20 && !s.flags.fac_famous,
      text: 'A new kid on the assembly line keeps staring at you. Finally he says: "My dad took me to see you fight when I was seven."',
      choices: [{ label: 'Tell him about it', go: (x) => { x.flag('fac_famous'); x.heart(8); return 'You tell him about it at lunch. Then every lunch for a month. He does not seem to mind.'; } }],
    },
    {
      id: 'fac_steward', title: 'Union Steward', after: 'factory', weight: 3, when: (s) => !s.flags.steward,
      text: 'The guys on your line ask you to be their union steward. "You\'re not scared of anybody," they say.',
      choices: [{ label: 'Take the job', go: (x) => { x.flag('steward'); x.s.after.standing += 8; x.rep(4); x.remember('legacy', 'became a union steward at the plant', 2); return 'You turn out to be very good at arguing with management. You had practice with promoters.'; } }],
    },
  );
})(globalThis.TOT = globalThis.TOT || {});
