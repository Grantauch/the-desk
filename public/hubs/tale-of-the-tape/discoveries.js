/* Tale of the Tape — Discoveries. When two parts of a life collide, something new appears.
   Each discovery names its ingredients ("Veteran + Champion") the way Infinite Craft shows a
   recipe. Found discoveries are kept in a book in this browser across every career.
   Shape: { id, name, mix: [ingredient, ingredient], hint, need(s), text, go(x) } */
(function (T) {
  'use strict';
  const E = () => T.engine;
  const f = (s, k) => !!s.flags[k];
  const champ = (s) => !!s.flags.ever_champ;
  // Counted the way a full-length career would count them, so shorter games can find these too.
  const kos = (s) => s.rec.ko * E().pace(s).kf;
  const fights = (s) => E().fx(s);
  const DISC = T.discoveries = [
    { id: 'cinderella', name: 'The Cinderella Man', mix: ['Flat Broke', 'World Champion'], hint: 'Rock bottom, then the top.', need: (s) => f(s, 'was_broke') && champ(s),
      text: 'Two years ago you could not pay the landlord. Now you have a belt. The papers dig up the old eviction notice and print it next to your title photo.', go: (x) => { x.fame(5); x.heart(8); } },
    { id: 'war_hero', name: 'The War Hero', mix: ['Veteran', 'World Champion'], hint: 'Two kinds of service.', need: (s) => f(s, 'veteran') && champ(s),
      text: 'A champion in uniform, then a champion again. At a ballgame the whole stadium stands up when you walk in.', go: (x) => { x.fame(6); x.rep(6); } },
    { id: 'purple_comeback', name: 'The Purple Heart Comeback', mix: ['Wounded', 'Back in the Ring'], hint: 'Hurt over there, winning over here.', need: (s) => f(s, 'wounded') && f(s, 'won_after_war'),
      text: 'Doctors said the leg would never be the same. It isn\'t. You won anyway. Veterans write you letters for years.', go: (x) => { x.heart(12); x.rep(5); } },
    { id: 'fallen_hero', name: 'The Fallen Hero', mix: ['Veteran', 'Took a Dive'], hint: 'A uniform and an envelope.', need: (s) => f(s, 'veteran') && f(s, 'took_dive'),
      text: 'You came home a hero and then lay down for money. Some of the guys from your unit stop calling. You never tell anyone why.', go: (x) => { x.heart(-8); } },
    { id: 'double_cross', name: 'The Double-Cross', mix: ['The Mob', 'A Fight You Won Anyway'], hint: 'Paid to lose. Didn\'t.', need: (s) => f(s, 'double_cross') && f(s, 'crossed_and_won'),
      text: 'You took their money and won anyway. Somewhere a man in a camel-hair coat is very quiet. The fans think you are the bravest fighter alive. They may be right.', go: (x) => { x.fame(4); x.flag('mob_heat', 5); } },
    { id: 'clean_hands', name: 'Clean Hands, Dirty Town', mix: ['Took Mob Money', 'Refused the Fix'], hint: 'Took the envelope, kept the honor.', need: (s) => f(s, 'mob_money') && f(s, 'refused_mob'),
      text: 'You took their money once. You would not take the dive. That makes you a thief in their book and a hero in yours.', go: (x) => { x.rep(6); } },
    { id: 'ham_and_eggs', name: 'Ham and Eggs', mix: ['A Long Career', 'More Losses Than Wins'], hint: 'Breakfast fighter.', need: (s) => fights(s) >= 30 && s.rec.l > s.rec.w,
      text: 'Old boxing people call you a "ham and egger": the honest working fighter who shows up, gets paid, and buys breakfast. Every great champion needed a hundred of you.', go: (x) => { x.heart(6); x.rep(4); } },
    { id: 'glass_cannon', name: 'Glass Cannon', mix: ['Knockout Artist', 'Knocked Out Often'], hint: 'Gives it and takes it.', need: (s) => kos(s) >= 10 && s.rec.kod * E().pace(s).kf >= 5,
      text: 'Every one of your fights ends with somebody on the floor. Nobody in the arena goes for a hot dog when you fight.', go: (x) => { x.fame(5); } },
    { id: 'iron_man', name: 'Iron Man', mix: ['A Very Long Career', 'Still Standing'], hint: 'Count your fights.', need: (s) => fights(s) >= 50,
      text: 'Fifty professional fights. In the 1930s that was normal. By the 1950s, when TV shrank the clubs, it was rare.', go: (x) => { x.rep(4); } },
    { id: 'goat_champ', name: 'The Goat\'s Champion', mix: ['A Goat', 'World Champion'], hint: 'Bring your mascot to the top.', need: (s) => f(s, 'goat') && champ(s),
      text: 'Uppercut the goat rides in the open car at your title parade. He eats the mayor\'s carnation. This is the most-reprinted photograph of your career.', go: (x) => { x.fame(6); x.heart(10); } },
    { id: 'showbiz', name: 'Showbiz', mix: ['Hollywood', 'Pro Wrestling'], hint: 'Two kinds of fake fighting.', need: (s) => f(s, 'movie_done') && f(s, 'wrestled'),
      text: 'Pictures, wrestling, commercials: you have fallen down for money in every medium America has. An agent calls you "versatile."', go: (x) => { x.money(300); x.rep(-2); } },
    { id: 'golden_boy', name: 'Golden Boy', mix: ['Golden Gloves', 'World Champion'], hint: 'Amateur glory, pro glory.', need: (s) => f(s, 'gg') && champ(s),
      text: 'From the Golden Gloves to a world title. The tournament puts your picture on next year\'s program, right on the cover.', go: (x) => { x.fame(4); } },
    { id: 'brothers', name: 'Brothers in the Struggle', mix: ['Deacon Tate\'s Friend', 'Spoke Up'], hint: 'A friend, and a stand.', need: (s) => f(s, 'tate_friend') && f(s, 'tate_road_stand') && (f(s, 'activist') || f(s, 'activist_seed')),
      text: 'You stood with Deacon when it cost you something. He does not make speeches about it. He just names his son after you.', go: (x) => { x.heart(12); x.rep(6); } },
    { id: 'respect', name: 'Respect', mix: ['Fought Deacon Tate', 'Finished on Your Feet'], hint: 'Make the fight nobody wanted.', need: (s) => f(s, 'tate_fought') && f(s, 'tate_fight_done'),
      text: 'You fought the man the champions would not. Win or lose, the old fighters treat you differently now.', go: (x) => { x.rep(10); } },
    { id: 'family_champ', name: 'Champion of the House', mix: ['Married with a Kid', 'World Champion'], hint: 'A belt and a baby.', need: (s) => f(s, 'married') && f(s, 'kid') && champ(s),
      text: 'Your kid wears the championship belt to bed. It is bigger than they are. You let them.', go: (x) => { x.heart(15); } },
    { id: 'professor', name: 'The Professor', mix: ['Boxer', 'Never Knocked Out'], hint: 'A long career, and nobody ever caught you clean.', need: (s) => s.f.style === 'boxer' && fights(s) >= 20 && s.rec.kod === 0,
      text: 'Fight after fight, and nobody has ever put you down for the count. Sportswriters start calling you "the Professor." You start wearing glasses to press conferences to help.', go: (x) => { x.fame(4); x.stat('def', 1); } },
    { id: 'bolo_bandit', name: 'Bolo Bandit', mix: ['Bolo Punch', 'A Pile of Knockouts'], hint: 'A borrowed punch, many sleeping opponents.', need: (s) => f(s, 'bolo') && kos(s) >= 15,
      text: 'The bolo punch has become your calling card. Kids at the gym wind it up like windmills. Almost none of them land it.', go: (x) => { x.fame(4); x.stat('pow', 1); } },
    { id: 'lucky_belt', name: 'Lucky Silver Dollar', mix: ['Lucky Coin', 'World Champion'], hint: 'Taped inside the robe.', need: (s) => f(s, 'lucky') && champ(s),
      text: 'The 1904 silver dollar is taped inside your robe the night you win the title. You will never, ever spend it now.', go: (x) => { x.heart(8); } },
    { id: 'friday_star', name: 'Friday Night Star', mix: ['Television', 'Sponsor Deal'], hint: 'Fight for the camera, sell for the sponsor.', need: (s) => f(s, 'first_tv') && f(s, 'sponsor'),
      text: 'Your face is in millions of living rooms every other Friday, and between rounds it sells razor blades.', go: (x) => { x.fame(6); x.money(200); } },
    { id: 'self_made', name: 'Self-Made', mix: ['No Manager', 'World Champion'], hint: 'Keep the third and still get there.', need: (s) => f(s, 'self_managed') && champ(s),
      text: 'No manager, no third off the top, no help. Promoters hate negotiating with you. The other fighters love you for it.', go: (x) => { x.rep(5); } },
    { id: 'rags_riches', name: 'Rags to Riches', mix: ['Flat Broke', 'Rich'], hint: 'From the pawnshop to the bank.', need: (s) => f(s, 'was_broke') && s.money >= 20000,
      text: 'You keep the old pawn ticket for your robe in your wallet, behind a stack of hundred-dollar bills.', go: (x) => { x.heart(6); } },
    { id: 'riches_rags', name: 'Easy Come, Easy Go', mix: ['Big Money', 'Broke Again'], hint: 'Earn a fortune. Lose it.', need: (s) => s.c.earned >= 15000 && s.money < 0,
      text: 'You earned more money than your father saw in his whole life, and it is gone. Managers, the high life, the taxman, friends who needed loans. It happens to most of them.', go: (x) => { x.heart(-6); } },
    { id: 'old_lion', name: 'The Old Lion', mix: ['Veteran', 'Winning at 37'], hint: 'Served, then outlasted everyone.', need: (s) => f(s, 'veteran') && f(s, 'won_old'),
      text: 'You went to war, came back, and are still winning fights at an age when most fighters are running bars.', go: (x) => { x.fame(4); x.heart(6); } },
    { id: 'rivals_friends', name: 'Rivals to Friends', mix: ['Beat Your Rival', 'Dinner with Your Rival'], hint: 'Win the fight, then win the friendship.', need: (s) => f(s, 'rival_dinner') && (s.flags.rival_wins || 0) >= 1,
      text: 'You beat him in the ring and now you eat dinner together every Sunday. Your wives say you argue about the same three rounds every week.', go: (x) => { x.heart(10); } },
    { id: 'nemesis', name: 'Nemesis', mix: ['Your Rival', 'Three Fights'], hint: 'Some rivalries need a trilogy.', need: (s) => (s.flags.rival_fights || 0) >= 3,
      text: 'Three fights with the same man. Promoters call it a trilogy. You call it a habit you cannot quit.', go: (x) => { x.fame(5); } },
    { id: 'outlaw_win', name: 'Outlaw', mix: ['License Pulled', 'Won Anyway'], hint: 'Fight where they still let you.', need: (s) => f(s, 'outlaw') && f(s, 'outlaw_win'),
      text: 'One state took your license, so you fought in another one and won. The commission is furious. The fans are delighted. Your doctor is neither.', go: (x) => { x.fame(3); x.health(-4); } },
    { id: 'carny', name: 'Carnival Kid', mix: ['Carnival Boxer', 'Vaudeville Stage'], hint: 'Tents and stages.', need: (s) => f(s, 'carnival_worked') && f(s, 'vaudeville_toured'),
      text: 'You have boxed lumberjacks in a tent and shared a stage with a singing dog. You know how to work a crowd better than anyone in the division.', go: (x) => { x.fame(4); } },
    { id: 'bookkeeper', name: 'The Bookkeeper', mix: ['Bank Account', 'Stayed Hungry'], hint: 'Save like your mother told you.', need: (s) => f(s, 'banked') && f(s, 'frugal') && s.money >= 5000,
      text: 'A fighter with savings. Other fighters ask you for money advice. You tell them all the same thing: get a bank book and do not buy the Packard.', go: (x) => { x.money(150); } },
    { id: 'big_apple', name: 'The Big Apple', mix: ['Moved to New York', 'Won at the Garden'], hint: 'Go where the big fights are.', need: (s) => f(s, 'moved_ny') && f(s, 'won_msg'),
      text: 'You headlined the Garden. You walk past it the next morning just to see your name on the marquee.', go: (x) => { x.fame(5); } },
    { id: 'sarge', name: 'Sergeant Slugger', mix: ['Sergeant', 'A Pile of Knockouts'], hint: 'Stripes and knockouts.', need: (s) => f(s, 'sergeant') && kos(s) >= 15,
      text: 'The men from your old unit come to every fight and chant "SARGE." It catches on with the whole crowd.', go: (x) => { x.fame(4); } },
    { id: 'four_f_champ', name: 'The 4-F Champion', mix: ['Unfit for Service', 'World Champion'], hint: 'The Army said no. The ring said yes.', need: (s) => f(s, 'exempt') && champ(s),
      text: 'The Army called you unfit. Newspapers ask how a man unfit for the Army can be the best fighter in the world. You do not have a good answer.', go: (x) => { x.rep(-3); x.fame(3); } },
    { id: 'dust_gold', name: 'Dust to Gold', mix: ['Dust Bowl', 'World Champion'], hint: 'From the drought to the top.', need: (s) => s.f.bg === 'dust' && champ(s),
      text: 'The wind took your family\'s farm. Now farm families on the Plains listen to your fights on the radio and cheer for one of their own.', go: (x) => { x.fame(5); x.heart(10); } },
    { id: 'paper_champ', name: 'Paper Champion', mix: ['Padded Record', 'World Champion'], hint: 'Soft touches, hard belt.', need: (s) => f(s, 'padded') && champ(s),
      text: 'You built your record on soft touches and won the title anyway. Some writers call you a "paper champion." You defend the belt to make them stop.', go: (x) => { x.heart(-3); x.fame(2); } },
    { id: 'upset', name: 'Shook Up the World', mix: ['Big Underdog', 'Won'], hint: 'Beat someone far better than you.', need: (s) => f(s, 'big_upset'),
      text: 'Nobody gave you a chance. The bookmakers had you at long odds. You won. For a week, you are the most interesting person in America.', go: (x) => { x.fame(6); x.heart(8); } },
    { id: 'two_oh_four', name: 'Two Minutes, Four Seconds', mix: ['Title Fight', 'First-Round Knockout'], hint: 'Like Louis in 1938.', need: (s) => f(s, 'r1_title_ko'),
      text: 'A title fight over in the first round. Some fans were still finding their seats. The radio announcer barely got the names out.', go: (x) => { x.fame(8); } },
    { id: 'gi_coach', name: 'Coach on the GI Bill', mix: ['GI Bill College', 'Trainer'], hint: 'School, then the gym.', need: (s) => f(s, 'college') && s.after && s.after.path === 'trainer',
      text: 'You studied physical education on the GI Bill and now you coach the college boxing team. Your boys win the conference.', go: (x) => { x.heart(8); if (x.s.after) x.s.after.standing += 8; } },
    { id: 'senator_jab', name: 'The Politician\'s Jab', mix: ['World Champion', 'Elected'], hint: 'Win a belt, then a vote.', need: (s) => champ(s) && f(s, 'elected'),
      text: 'Your campaign slogan was "He Fights for You." Your opponent did not have a slogan that could compete.', go: (x) => { if (x.s.after) x.s.after.standing += 6; } },
  ];
  T.discoveryById = (id) => DISC.find((d) => d.id === id);

  // Check every discovery after anything happens. Each can be found once per career.
  T.checkDiscoveries = function (s) {
    s.disc = s.disc || [];
    for (const d of DISC) {
      if (s.disc.includes(d.id)) continue;
      let ok = false;
      try { ok = d.need(s); } catch (e) { ok = false; }
      if (ok) { s.disc.push(d.id); s.inbox.push({ id: d.id, kind: 'discovery' }); E().remember(s, 'discovery', `discovered "${d.name}"`, 0); }
    }
  };
})(globalThis.TOT = globalThis.TOT || {});
