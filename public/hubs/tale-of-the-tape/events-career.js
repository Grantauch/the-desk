/* Tale of the Tape — events while you are fighting.
   Each event: id, title, text, choices [{label, hint, req, go(x)}]. `when` decides if it can happen,
   `weight` how likely, `repeat` (weeks) whether it can come back. `chain: true` events only arrive when
   another event schedules them with x.later(id, minWeeks, maxWeeks). The x helpers live in engine.js (E.api). */
(function (T) {
  'use strict';
  const EV = T.events = T.events || [];
  const add = (...list) => EV.push(...list);
  T.eventById = (id) => EV.find((e) => e.id === id);
  const E = () => T.engine;
  const fights = (s) => s.fights.length;
  const yr = (s) => E().year(s.t);
  const age = (s) => E().age(s);

  // ============ the early days ============
  add(
    {
      id: 'first_gloves', title: 'Hand-Me-Down Gloves', weight: 3, when: (s) => fights(s) < 3,
      text: (s, x) => `Your gloves came from a guy who got them from a guy who got them in 1919. The stuffing is moving around like it has somewhere to be. ${x.trainer()} pokes one. "That's not a glove. That's a mitten with ambitions."`,
      choices: [
        { label: 'Buy a new pair ($8)', hint: 'Power', req: (s) => s.money >= 8, go: (x) => { x.rawMoney(-8); x.stat('pow', 1.5); return 'Real horsehair padding. Your punches finally sound like punches.'; } },
        { label: 'Tape them up and keep going', hint: 'Free, slightly risky', go: (x) => { if (x.chance(0.25)) { x.injure('sprained wrist', 3, 3); return 'The padding shifts mid-session. Your wrist bends the wrong way.'; } x.heart(2); return 'Electrical tape. Very professional.'; } },
      ],
    },
    {
      id: 'watches', title: 'Paid in Watches', weight: 2, when: (s) => fights(s) >= 1 && fights(s) < 8 && yr(s) < 1940,
      text: 'After a club fight the promoter hands you a cheap wristwatch instead of cash. "Prize," he says. Half the amateurs in America get paid this way, and half the pawnshops in America know it.',
      archive: 'In the 1930s amateur boxers often received watches or merchandise instead of money, which they pawned for cash.',
      choices: [
        { label: 'Pawn it', hint: '+$6', go: (x) => { x.rawMoney(6); return 'The pawnbroker has eleven identical watches in the case. He gives you six dollars.'; } },
        { label: 'Argue for real cash', hint: 'Better with fame', go: (x) => { if (x.chance(0.35 + x.s.fame / 60)) { x.rawMoney(15); return 'He grumbles, peels off fifteen dollars, and tells you never to come back. He books you again next month.'; } x.rep(-1); return 'He keeps the watch AND tells other promoters you are "difficult."'; } },
        { label: 'Keep it. You have never owned a watch', hint: 'Heart', go: (x) => { x.heart(5); x.flag('watch'); return 'It runs four minutes fast. You love it anyway.'; } },
      ],
    },
    {
      id: 'golden_gloves', title: 'Golden Gloves', weight: 2, when: (s) => fights(s) < 4 && yr(s) < 1938 && !s.flags.gg,
      text: 'The Golden Gloves tournament is coming. Thousands of amateurs, one city title, big crowds, and every pro manager in the stands. But you would have to box as an amateur again, for no pay.',
      archive: 'The Golden Gloves tournaments in Chicago and New York drew huge crowds in the 1930s. Joe Louis, Sugar Ray Robinson, and many other champions came up through them.',
      choices: [
        { label: 'Enter the tournament', hint: 'A month of no pay. Big upside', go: (x) => { x.flag('gg'); if (x.chance(0.3 + x.E.overall(x.s) / 150)) { x.fame(8); x.sharp(25); x.elo(60); x.remember('gg', 'won a Golden Gloves title', 2); return 'You win the whole thing in front of 15,000 people. Managers you have never met know your name.'; } x.fame(3); x.sharp(15); return 'You make the semifinals and lose a close one. The crowd boos the decision, which is the next best thing.'; } },
        { label: 'Stay pro. Amateurs do not pay rent', go: (x) => { x.heart(-1); return 'You read about the finals in the paper the next week.'; } },
      ],
    },
    {
      id: 'pad_record', title: 'Building a Record', weight: 2, when: (s) => fights(s) >= 3 && fights(s) < 12,
      text: (s, x) => `${x.manager()} closes the office door. "Here's the play. We feed you soft touches for a year. Guys who fall down when you sneeze. You come out of it with a record that sells tickets."`,
      choices: [
        { label: 'Pad the record', hint: 'Easier wins, less respect', go: (x) => { x.elo(40); x.fame(3); x.rep(-3); x.sharp(-5); x.flag('padded'); return 'Three fights, three early nights. The papers call you "unbeaten." The gym calls you something else.'; } },
        { label: 'Fight anybody they put in front of you', hint: 'Heart, reputation', go: (x) => { x.heart(5); x.rep(4); return '"Anybody?" he says. "Anybody," you say. He writes something down and does not show you.'; } },
      ],
    },
    {
      id: 'gym_kid', title: 'The Kid by the Door', weight: 2, when: (s) => fights(s) >= 2 && !s.flags.gym_kid,
      text: 'A skinny kid, maybe eleven, watches every session from the door. He shadowboxes when he thinks no one is looking. His shoes are held together with string.',
      choices: [
        { label: 'Show him how to throw a jab', hint: 'Someday this might matter', go: (x) => { x.flag('gym_kid', x.pick(['Eddie', 'Tommy', 'Ruben', 'Leroy', 'Stan', 'Benny'])); x.heart(5); return `His name is ${x.s.flags.gym_kid}. He throws his first jab like he is mailing a letter. He comes back every day.`; } },
        { label: 'Buy him shoes', hint: '$3, heart', req: (s) => s.money >= 3, go: (x) => { x.rawMoney(-3); x.flag('gym_kid', x.pick(['Eddie', 'Tommy', 'Ruben', 'Leroy', 'Stan', 'Benny'])); x.heart(6); x.rep(2); return 'He does not say thank you. He just shows up the next day, every day, in new shoes.'; } },
        { label: 'Shoo him out', go: (x) => { x.flag('gym_kid', 'gone'); return 'He goes. The doorway looks empty after that.'; } },
      ],
    },
    {
      id: 'spar_job', title: 'Sparring Partner Wanted', weight: 2, when: (s) => fights(s) >= 4 && !s.champ,
      text: (s, x) => { const c = x.champ(); return `${c ? E().fullName(c) + ', the champion,' : 'A top contender'} needs sparring partners for his camp. The pay is $15 a week. The work is getting hit by the best fighter in the world.`; },
      choices: [
        { label: 'Take the job', hint: 'Money, defense, risk', go: (x) => { x.money(40); x.stat('def', 2); x.stat('chn', 0.8); x.flag('studied_champ'); if (x.chance(0.18)) { x.injure('cracked rib', 5, 4); return 'You learn a lot. Most of it through your ribs.'; } return 'You learn how he sets up the right hand. You are not supposed to know that.'; } },
        { label: 'Pass. You are a fighter, not a heavy bag', go: (x) => { x.heart(2); return 'Pride costs sixty dollars. You pay it.'; } },
      ],
    },
    {
      id: 'bolo', title: 'The Bolo Punch', weight: 1.5, when: (s) => fights(s) >= 2 && !s.flags.bolo,
      text: 'An old Filipino fighter at the gym shows you a punch he learned cutting sugar cane with a bolo knife back home: a wide, whipping uppercut that comes from somewhere nobody is looking.',
      archive: 'Filipino fighters were a big part of 1930s American boxing. Ceferino Garcia made the "bolo punch" famous and won the middleweight title in 1939.',
      choices: [
        { label: 'Learn it properly', hint: 'Power', go: (x) => { x.flag('bolo'); x.stat('pow', 2); return 'It takes a month. Then one afternoon it lands on the heavy bag and the chain snaps.'; } },
        { label: 'Learn it for show', hint: 'Fame', go: (x) => { x.flag('bolo'); x.fame(3); return 'You wind it up like a windmill. The crowds love it. It almost never lands.'; } },
      ],
    },
    {
      id: 'nickname', title: 'The Papers Want a Nickname', weight: 3, when: (s) => !s.f.nick && fights(s) >= 3,
      text: (s, x) => `${x.reporter()} of ${x.paper()} says nobody remembers a fighter called "${s.f.first} ${s.f.last}." "Give me something," he says, pencil ready.`,
      choices: (s, x) => {
        const opts = s.f.style === 'slugger' ? ['Dynamite', 'The Hammer', 'Thunder'] : s.f.style === 'boxer' ? ['Professor', 'Silk', 'The Ghost'] : s.f.style === 'swarmer' ? ['Buzzsaw', 'The Hornet', 'Cyclone'] : ['Doc', 'The Sniper', 'Ice'];
        return opts.map((n) => ({ label: `"${n}"`, go: (x2) => { x2.s.f.nick = n; x2.fame(2); return `By Friday every paper in town calls you ${x2.s.f.first} "${n}" ${x2.s.f.last}.`; } }))
          .concat([{ label: 'Let him pick', hint: 'Who knows', go: (x2) => { const n = x2.pick(['Kid Butterfingers', 'Sunshine', 'The Mailman', 'Two-Ton', 'Sleepy']); x2.s.f.nick = n; x2.fame(3); return `He picks "${n}." It sticks. Of course it sticks.`; } }]);
      },
    },
  );

  // ============ money and the Depression ============
  add(
    {
      id: 'broke', title: 'Flat Broke', chain: true, when: (s) => s.money < 0 && !s.retired && s.phase === 'between',
      text: (s) => `You owe ${E().money(-s.money)}. The landlord has started knocking with his whole fist.`,
      choices: [
        { label: 'Pawn your robe and good shoes', go: (x) => { x.rawMoney(Math.round(25 * x.E.eraMoney(x.s.t))); x.heart(-5); return 'The pawnbroker holds your robe up to the light like it might be worth something. It is not. He gives you something anyway.'; } },
        { label: 'Take any fight, tonight', hint: 'Short notice, tough opponent, real money', go: (x) => { x.offer({ level: 'main', rating: Math.round(x.E.overall(x.s) + 8), weeks: 1, tags: ['short notice', 'desperate'], note: 'The guy they booked broke his hand. You are the replacement.' }); return 'A promoter has a hole in his card. You do not ask who is in it.'; } },
        { label: `Borrow from your manager`, hint: 'He will take a bigger cut', go: (x) => { x.rawMoney(Math.round(80 * x.E.eraMoney(x.s.t))); x.flag('owes_manager'); x.rep(-1); return '"Sure, kid," he says, and writes it in a little book you will be seeing a lot of.'; } },
        { label: 'Borrow from the guy at the pool hall', hint: 'Dangerous', go: (x) => { x.rawMoney(Math.round(150 * x.E.eraMoney(x.s.t))); x.flag('loan_shark'); x.later('shark_due', 8, 14); return 'No paperwork. He just remembers. He remembers everything.'; } },
      ],
    },
    {
      id: 'shark_due', title: 'The Vig', chain: true,
      text: (s) => `The man from the pool hall wants his money back, plus interest: ${E().money(Math.round(260 * E().eraMoney(s.t)))}. He says it nicely. That is the scary part.`,
      choices: [
        { label: 'Pay it', req: (s) => s.money >= Math.round(260 * E().eraMoney(s.t)), go: (x) => { x.rawMoney(-Math.round(260 * x.E.eraMoney(x.s.t))); x.flag('loan_shark', false); return 'He counts it twice, smiles, and says to come back anytime. You will not.'; } },
        { label: 'Offer to "do him a favor" instead', hint: 'He knows people', go: (x) => { x.flag('loan_shark', false); x.flag('mob_owned'); x.flag('ever_crooked'); x.later('mob_fix', 4, 12); return '"Funny you should say that," he says.'; } },
        { label: 'Skip town for a while', hint: 'Move cities', go: (x) => { x.s.city = x.pick(['la', 'newyork', 'chicago', 'philly'].filter((c) => c !== x.s.city)); x.flag('loan_shark', false); x.heart(-8); x.fame(-3); return `You take the night train to ${x.city()}. You start over with a new gym and a lot of looking over your shoulder.`; } },
      ],
    },
    {
      id: 'savings', title: 'Where Do You Keep the Money?', weight: 2, when: (s) => s.money >= 150 && !s.flags.banked && !s.flags.mattress,
      text: 'You finally have real money. Your uncle keeps his in a coffee can because the banks failed in 1933. But Washington says deposits are now insured by something called the FDIC.',
      archive: 'Thousands of banks failed in the early Depression and depositors lost their savings. The FDIC, created in 1933, insured bank deposits, and bank failures dropped sharply after 1934.',
      choices: [
        { label: 'Open a bank account', hint: 'Safe', go: (x) => { x.flag('banked'); return 'The teller gives you a little passbook. You check it every week like it might run away.'; } },
        { label: 'Coffee can under the floorboard', hint: 'Risky', go: (x) => { x.flag('mattress'); x.later('mattress_gone', 20, 80); return 'Nobody trusts a bank in this neighborhood. You pry up a board.'; } },
      ],
    },
    {
      id: 'mattress_gone', title: 'The Coffee Can', chain: true, when: (s) => s.flags.mattress && s.money > 40,
      text: 'You pry up the floorboard. The coffee can is there. The money is not.',
      go: (x) => { const lost = Math.round(x.s.money * 0.4); x.rawMoney(-lost); x.heart(-10); x.flag('mattress', false); x.flag('banked'); return `Gone: $${lost}. The next morning you open a bank account.`; },
    },
    {
      id: 'relief', title: 'The Relief Office', weight: 2, when: (s) => yr(s) < 1938 && s.money < 25 && !s.retired, repeat: 60,
      text: 'The line outside the relief office goes around the block. Fighters are not supposed to need help. A lot of them do.',
      archive: 'Before the New Deal, help for the unemployed came mostly from cities, charities, and churches. Federal relief programs grew rapidly after 1933.',
      choices: [
        { label: 'Get in line', hint: 'Money, a little pride', go: (x) => { x.money(15); x.heart(-3); return 'A woman with tired eyes stamps your form. You walk out with groceries and a voucher.'; } },
        { label: 'Fight a smoker for grocery money instead', hint: 'Short notice', go: (x) => { x.offer({ level: 'smoker', weeks: 1, tags: ['short notice'] }); return 'Somebody always needs a body on Friday night.'; } },
      ],
    },
    {
      id: 'freight', title: 'Riding the Rails', weight: 1.5, when: (s) => yr(s) < 1941 && fights(s) >= 2 && s.money < 80,
      text: 'There is a fight two states away. The bus costs money you do not have. A freight train leaves the yard at midnight.',
      archive: 'Hundreds of thousands of people, many of them teenagers, hopped freight trains looking for work during the Depression.',
      choices: [
        { label: 'Hop the freight', hint: 'Free, dangerous', go: (x) => { if (x.chance(0.2)) { x.injure('banged-up knee', 3, 3); return 'A railroad bull chases you off a moving car in Ohio. You make the fight. Your knee does not forgive you.'; } x.heart(4); x.stat('sta', 0.6); return 'You share a boxcar with a fiddle player and two brothers from Arkansas. Best trip of your life.'; } },
        { label: 'Skip the fight', go: () => 'Somebody else takes the forty dollars.' },
      ],
    },
    {
      id: 'promoter_skips', title: 'The Promoter Skipped Town', weight: 1.5, when: (s) => s.fights.length > 0 && ['smoker', 'club', 'prelim'].includes(s.fights[s.fights.length - 1].level) && s.t - s.fights[s.fights.length - 1].t < 6,
      text: 'You go to collect the rest of your purse. The office is empty. The sign is gone. The promoter took the gate and took off.',
      choices: [
        { label: 'Track him down', hint: 'Better with your manager\'s connections', go: (x) => { if (x.chance(x.s.people.manager.trait === 'connected' ? 0.75 : 0.35)) { x.money(20); return 'You find him at a racetrack in Jersey. He pays you. He also tells you to have a nice day, in a voice that means the opposite.'; } x.money(-5); return 'Two weeks and a bus ticket later: nothing.'; } },
        { label: 'Chalk it up to the business', go: (x) => { x.money(-20); x.heart(-3); return 'Lesson learned: get paid before the bell.'; } },
      ],
    },
    {
      id: 'loan_friend', title: 'An Old Friend Needs Money', weight: 1.5, when: (s) => s.money >= 60,
      text: 'A friend from the neighborhood needs money to keep his family\'s apartment. He says he will pay you back. You want to believe him.',
      choices: [
        { label: 'Lend it', hint: 'You might see it again', go: (x) => { x.money(-25); x.rep(2); x.heart(3); x.later('loan_back', 15, 50); return 'He hugs you so hard your ribs creak.'; } },
        { label: 'Say no', go: (x) => { x.heart(-2); return 'He says he understands. You hope he does.'; } },
      ],
    },
    {
      id: 'loan_back', title: 'Paid Back', chain: true,
      text: 'A letter with no return address. Inside: the money you lent, plus five dollars, and a note: "Took longer than I said. Thank you for not asking."',
      go: (x) => { x.money(30); x.heart(6); return ''; },
    },
    {
      id: 'investment', title: 'A Can\'t-Miss Investment', weight: 1.5, when: (s) => s.money >= 400,
      text: (s, x) => x.pick(['A man with a firm handshake is selling shares in an oil well in Oklahoma. "Can\'t miss."', 'A guy from the gym wants partners in a nightclub. "Can\'t miss."', 'Your cousin has a plan to sell refrigerators door to door. "Can\'t miss."']),
      choices: [
        { label: 'Invest half your money', hint: 'Gamble', go: (x) => { const n = Math.round(x.s.money / 2); x.rawMoney(-n); const r = x.rnd(); if (r < 0.2) { x.rawMoney(n * 3); x.remember('money', 'made a fortune on a long-shot investment', 1); return `It hits. You triple it. $${n * 3}. Suddenly everyone is your friend.`; } if (r < 0.5) { x.rawMoney(Math.round(n * 1.2)); return 'It pays back a little more than you put in. Not bad.'; } return 'It misses.'; } },
        { label: 'Keep your money in your pocket', go: () => 'You keep your money. Most of the time that is the right call.' },
      ],
    },
    {
      id: 'highlife', title: 'The High Life', weight: 2, when: (s) => s.fame >= 30 && s.money >= 500 && !s.flags.highlife,
      text: 'Nightclubs. Tailored suits. A table near the band. Everybody wants to buy the fighter a drink, and the fighter wants to pick up the check.',
      choices: [
        { label: 'Live it up', hint: 'Fame up, costs up, sharpness down', go: (x) => { x.flag('highlife'); x.fame(5); x.sharp(-15); x.heart(6); return 'You are photographed with a bandleader, a movie actress, and a man who says he is a count.'; } },
        { label: 'Stay hungry', hint: 'Discipline', go: (x) => { x.flag('frugal'); x.stat('sta', 1); return 'You go home at nine. Every night. Your trainer almost smiles.'; } },
      ],
    },
    {
      id: 'packard', title: 'A Brand-New Packard', weight: 1.5, when: (s) => s.money >= 1500 && s.fame >= 25 && !s.flags.car,
      text: 'A Packard sedan, cream with chrome that could blind a referee. The salesman lets you sit in it. That was his plan all along.',
      choices: [
        { label: 'Buy it', hint: 'Expensive, wonderful', go: (x) => { x.money(-900); x.flag('car'); x.heart(8); x.fame(2); return 'You drive it past your old neighborhood twice. Kids run after it.'; } },
        { label: 'Walk away', go: (x) => { x.flag('car', 'no'); return 'You take the streetcar home. It is fine. It is a perfectly fine streetcar.'; } },
      ],
    },
    {
      id: 'taxes', title: 'A Letter from the IRS', weight: 2, when: (s) => yr(s) >= 1947 && s.c.earned > 15000 && !s.flags.taxes,
      text: 'The government says you owe back taxes on purses you were paid years ago. Your manager says he "thought you handled it." You thought he did.',
      archive: 'Joe Louis earned millions but ended up owing more than $1 million in back taxes and interest, which haunted him the rest of his life.',
      choices: [
        { label: 'Pay what you owe', hint: 'Painful', go: (x) => { x.flag('taxes'); x.rawMoney(-Math.round(Math.max(0, x.s.money) * 0.35)); x.rep(2); return 'A third of your savings, gone in a single envelope.'; } },
        { label: 'Hire a slick accountant', hint: 'Gamble', go: (x) => { x.flag('taxes'); if (x.chance(0.5)) { x.money(-60); return 'He finds deductions you did not know existed. You pay a fraction.'; } x.rawMoney(-Math.round(Math.max(0, x.s.money) * 0.5)); return 'The IRS is not impressed with his creativity. Penalties on top of penalties.'; } },
      ],
    },
  );

  // ============ the people in your corner ============
  add(
    {
      id: 'contract', title: 'The Contract', weight: 2, when: (s) => fights(s) >= 8 && !s.flags.contract_done,
      text: (s, x) => `${x.manager()} wants a new contract: five more years, and a bigger cut. "I made you, kid." You are pretty sure you made you.`,
      choices: [
        { label: 'Sign it', go: (x) => { x.flag('contract_done'); x.s.people.manager.loyalty += 15; return 'He opens a bottle of something brown. You sign three copies.'; } },
        { label: 'Negotiate hard', hint: 'Better with fame', go: (x) => { x.flag('contract_done'); if (x.chance(0.3 + x.s.fame / 100)) { x.rep(2); x.heart(4); return 'He blinks first. Same cut, shorter term.'; } x.s.people.manager.loyalty -= 15; return 'He gives in, but he will remember this.'; } },
        { label: 'Fire him and manage yourself', hint: 'Keep the third. Lose the connections', go: (x) => { x.flag('contract_done'); x.flag('self_managed'); x.elo(-30); x.remember('money', 'fired my manager and handled my own money', 1); return 'You keep every dollar now. You also make every phone call, read every contract, and argue with every promoter.'; } },
      ],
    },
    {
      id: 'manager_skim', title: 'The Numbers Don\'t Add Up', weight: 1.5, when: (s) => fights(s) >= 6 && !s.flags.self_managed && s.people.manager.trait !== 'honest' && !s.flags.skim_found,
      text: (s, x) => `You run into the promoter from your last fight. He mentions the gate was twice what ${x.manager()} told you. "Didn't you get your share?" he asks. You did not.`,
      choices: [
        { label: 'Confront him', go: (x) => { x.flag('skim_found'); if (x.chance(0.5)) { x.money(60); return 'He sweats, says it was "an accounting error," and writes a check.'; } x.heart(-5); return 'He denies everything and tells you to remember who got you your fights.'; } },
        { label: 'Fire him', go: (x) => { x.flag('skim_found'); const m = x.pick(T.data.MANAGERS.filter((m) => m.trait === 'honest')); x.s.people.manager = Object.assign({ loyalty: 60 }, m); x.elo(-20); return `You hire ${m.name}. ${m.line}`; } },
        { label: 'Let it slide', go: (x) => { x.flag('skim_found'); x.heart(-4); return 'You need his connections. You tell yourself that a few times.'; } },
      ],
    },
    {
      id: 'big_manager', title: 'A Big-Time Manager Calls', weight: 1.5, when: (s) => s.fame >= 25 && s.people.manager.trait !== 'connected' && !s.flags.big_mgr,
      text: 'A manager with three contenders and a suite at the Garden wants to buy your contract. He promises title shots. He does not explain how he gets them.',
      choices: [
        { label: 'Sign with him', hint: 'Faster climb. Strings attached', go: (x) => { x.flag('big_mgr'); x.s.people.manager = Object.assign({ loyalty: 50 }, T.data.MANAGERS.find((m) => m.trait === 'connected')); x.elo(50); x.flag('mob_seed'); return `${x.manager()} shakes your hand with both of his. Better fights start showing up right away.`; } },
        { label: 'Stay loyal', hint: 'Reputation', go: (x) => { x.flag('big_mgr'); x.rep(4); x.s.people.manager.loyalty += 20; return 'Your manager hears about it and gets a little misty.'; } },
      ],
    },
    {
      id: 'trainer_poached', title: 'Your Trainer Gets an Offer', weight: 1.2, when: (s) => fights(s) >= 10 && !s.flags.trainer_poach,
      text: (s, x) => `The champion's camp wants ${x.trainer()}. Double the money. ${x.trainer()} tells you before anybody else, which tells you something.`,
      choices: [
        { label: 'Match the money', hint: 'Expensive', req: (s) => s.money >= 200, go: (x) => { x.flag('trainer_poach'); x.money(-120); x.s.people.trainer.loyalty += 25; return '"I\'d have stayed for less," he says. "But I\'ll take it."'; } },
        { label: 'Ask him to stay', hint: 'Depends on loyalty', go: (x) => { x.flag('trainer_poach'); if (x.chance(x.s.people.trainer.loyalty / 100)) { x.heart(6); return 'He stays. "Somebody has to keep you from dropping that left."'; } const t = x.pick(T.data.TRAINERS.filter((t) => t.name !== x.s.people.trainer.name)); x.s.people.trainer = Object.assign({ loyalty: 50 }, t); x.heart(-6); return `He goes. A week later ${t.name} walks into your gym. "${t.line}"`; } },
        { label: 'Tell him to take it', hint: 'Generous', go: (x) => { x.flag('trainer_poach'); x.rep(4); const t = x.pick(T.data.TRAINERS.filter((t) => t.name !== x.s.people.trainer.name)); x.s.people.trainer = Object.assign({ loyalty: 65 }, t); return `He hugs you. ${t.name} takes over your corner.`; } },
      ],
    },
    {
      id: 'trainer_secret', title: 'An Old Trick', weight: 2, repeat: 160, when: (s) => fights(s) >= 3,
      text: (s, x) => `${x.trainer()} pulls you aside after practice. "${x.pick(['Turn your hook over at the end, like you\'re checking your watch.', 'When he jabs, step outside his front foot. Make him turn.', 'Breathe out when you punch. Your grandmother could tell you that.', 'Tuck your chin behind your shoulder on the way in.'])}"`,
      choices: [{ label: 'Drill it for a week', go: (x) => { const k = x.pick(['pow', 'def', 'sta', 'spd']); x.stat(k, 1.5); return `${x.E.statLabel[k]} improves.`; } }],
    },
    {
      id: 'trainer_dies', title: 'An Empty Stool', weight: 3, when: (s) => yr(s) >= 1948 && s.people.trainer.trait === 'old school' && !s.flags.trainer_died && fights(s) >= 10,
      text: (s, x) => `${x.trainer()} dies in his sleep. They find his stopwatch in his pocket, still running. The whole gym goes to the funeral. Fighters you have never met tell stories about him all afternoon.`,
      choices: [
        { label: 'Win the next one for him', hint: 'Heart', go: (x) => { x.flag('trainer_died'); x.heart(15); x.remember('family', `lost ${x.trainer()}, the trainer who taught me everything`, 2); return 'You tape his stopwatch to your locker.'; } },
        { label: 'Take some time away', hint: 'Rest', go: (x) => { x.flag('trainer_died'); x.health(10); x.sharp(-15); x.remember('family', `lost ${x.trainer()}, the trainer who taught me everything`, 2); return 'You do not go to the gym for a month. Then you do.'; } },
      ],
    },
  );

  // ============ the mob ============
  add(
    {
      id: 'mob_1', title: 'A Man in a Nice Coat', weight: (s) => (s.flags.mob_seed || s.people.manager.trait === 'connected' ? 4 : 1.5), when: (s) => s.fame >= 12 && !s.flags.mob_met && fights(s) >= 5,
      text: 'A man in a camel-hair coat is waiting by your car. He knows your record, your mother\'s address, and how much you owe on your rent. He wants to be your "friend." Friends, he explains, help each other.',
      archive: 'Organized crime figures like Frankie Carbo and Blinky Palermo secretly controlled many fighters, managers, and title fights from the 1930s through the 1950s.',
      choices: [
        { label: 'Take the envelope', hint: 'Money now. A debt forever', go: (x) => { x.flag('mob_met'); x.flag('mob_owned'); x.flag('ever_crooked'); x.money(300); x.elo(40); x.later('mob_fix', 6, 20); x.remember('mob', 'took money from the mob', 2); return 'It is thick. You do not count it in front of him. That would be rude.'; } },
        { label: 'Say no, politely', hint: 'Reputation. Maybe trouble', go: (x) => { x.flag('mob_met'); x.flag('refused_mob'); x.rep(6); x.later('mob_squeeze', 8, 25); return '"Polite," he says. "I like polite." He does not sound like he likes it.'; } },
        { label: 'Play along. Promise nothing', hint: 'Risky', go: (x) => { x.flag('mob_met'); x.flag('mob_heat', 1); x.money(100); x.later('mob_fix', 8, 22); return 'You nod in all the right places. He hands you a smaller envelope. "A down payment on our friendship."'; } },
      ],
    },
    {
      id: 'mob_fix', title: 'The Favor', chain: true, when: (s) => !s.retired && s.phase === 'between',
      text: (s) => `The man in the coat sits down at your table without asking. "Next fight, you go down in the sixth. You get ${E().money(Math.round(2000 * E().eraMoney(s.t)))}. Nobody gets hurt." He looks at you. "Nobody."`,
      choices: [
        { label: 'Agree to take the dive', hint: 'Easy money. Lose a fight on purpose', go: (x) => { x.flag('dive_pending'); x.flag('ever_crooked'); x.offer({ level: 'main', rating: Math.round(x.E.overall(x.s) - 4), crooked: true, weeks: 4, tags: ['the fix is in'], note: 'Everyone in the building except the fans knows how this ends.' }); return 'You nod. The fight is signed by morning.'; } },
        { label: 'Refuse', hint: 'Brave. Dangerous', go: (x) => { x.flag('refused_mob'); x.flag('mob_heat', 3); x.rep(5); x.later('mob_revenge', 4, 12); return 'He stands up, buttons his coat, and leaves a nickel tip.'; } },
        { label: 'Go to a reporter', hint: 'Fame, reputation, real danger', go: (x) => { x.flag('refused_mob'); x.flag('mob_heat', 4); x.rep(10); x.fame(6); x.later('mob_revenge', 3, 8); x.remember('mob', `went to ${x.reporter()} about the mob instead of throwing a fight`, 3); return `${x.reporter()}'s story runs on page one, no names, but everybody knows. Your phone rings at 3 a.m. Nobody is there.`; } },
      ],
    },
    {
      id: 'fix_aftermath', title: 'After the Fix', chain: true,
      text: (s, x) => s.flags.dove ? 'A man you have never seen hands you a paper bag in a diner bathroom. It is all there. The crowd booed you on the way out. Your mother asked what happened. You told her you got caught.' : x.data && x.data.result === 'W' ? 'You were supposed to lose. You won. The man in the coat is not at the arena. He does not need to be.' : 'You meant to fight for real, and you lost anyway. The man in the coat sends a bottle of champagne with a card: "Thanks for nothing, friend."',
      go: (x) => {
        if (x.s.flags.dove) { x.rawMoney(Math.round(2000 * x.E.eraMoney(x.s.t))); x.heart(-15); x.rep(-12); x.achieve('bent'); x.flag('dove', false); x.remember('mob', 'threw a fight for the mob', 3); return ''; }
        if (x.data && x.data.result === 'W') { x.flag('mob_heat', 5); x.later('mob_revenge', 2, 6); x.remember('mob', 'double-crossed the mob and won a fight I was paid to lose', 3); x.heart(8); return ''; }
        x.flag('mob_owned', false); return '';
      },
    },
    {
      id: 'mob_revenge', title: 'A Message', chain: true, when: (s) => !s.retired,
      text: (s, x) => x.pick(['Your gym\'s front window is smashed. On the ring apron, somebody left a single boxing glove, cut open.', 'Two men follow you home from roadwork. They don\'t do anything. They just want you to know they can.', 'A promoter calls and cancels your next three dates. "Nothing personal," he says. "Orders."']),
      choices: [
        { label: 'Leave town for a while', hint: 'Move cities', go: (x) => { const c = x.pick(['la', 'newyork', 'chicago', 'philly', 'detroit'].filter((c) => c !== x.s.city)); x.s.city = c; x.flag('mob_heat', 1); x.fame(-3); return `You end up in ${x.city()}. New gym, new faces, same nightmares.`; } },
        { label: 'Pay them off', hint: 'Expensive', req: (s) => s.money >= 400, go: (x) => { x.money(-500); x.flag('mob_heat', 0); return 'It costs more than the dive would have paid. The trouble stops.'; } },
        { label: 'Keep fighting. Let them try', hint: 'Heart. Risk', go: (x) => { x.heart(8); x.rep(5); if (x.chance(0.35)) { x.injure('broken hand', 8, 6); x.remember('mob', 'had my hand broken in an alley for refusing to play ball', 2); return 'Three men catch you in an alley. You get your hands up. One of them breaks.'; } return 'Nothing happens. Every day nothing happens is a small win.'; } },
      ],
    },
    {
      id: 'mob_squeeze', title: 'Nobody Is Calling', chain: true, when: (s) => !s.retired && !s.flags.mob_owned,
      text: 'Ever since you said no, the good fights have dried up. Promoters don\'t return calls. One finally tells you the truth: "You know why."',
      choices: [
        { label: 'Fight wherever they will have you', hint: 'Grind it out', go: (x) => { x.heart(-4); x.elo(-30); x.rep(4); return 'Small towns, small purses, clean hands.'; } },
        { label: 'Go overseas for a while', hint: 'Fame, an adventure', req: (s) => E().year(s.t) >= 1946 || E().year(s.t) <= 1938, go: (x) => { x.offer({ level: 'main', venue: 'Harringay Arena', city: 'London', weeks: 6, tags: ['overseas'], note: 'London promoters do not take orders from New York.' }); return 'A London promoter has never heard of the man in the coat.'; } },
        { label: 'Call that reporter', go: (x) => { x.fame(4); x.rep(4); if (x.chance(0.5)) { x.flag('mob_heat', 0); return 'The story embarrasses the right people. The phone starts ringing again.'; } return 'The story runs. Nothing changes. At least it is on paper now.'; } },
      ],
    },
    {
      id: 'ibc_offer', title: 'The IBC Has a Proposal', chain: true, when: (s) => !s.retired && !s.champ,
      text: 'The International Boxing Club offers you a title eliminator on national television, if you sign an exclusive contract with them and let one of "their" managers take a piece of you.',
      choices: [
        { label: 'Sign', hint: 'Fast track. Strings', go: (x) => { x.flag('mob_seed'); x.elo(80); x.offer({ level: 'eliminator', weeks: 6, rating: Math.round(x.E.overall(x.s) + 3), tags: ['IBC', 'on television'] }); x.rep(-4); return 'The contract is forty pages. The important part is on page thirty-one, in small print.'; } },
        { label: 'Refuse', go: (x) => { x.rep(4); x.elo(-20); return 'Independent fighters wait longer for everything. You wait.'; } },
      ],
    },
  );

  // ============ the rival ============
  add(
    {
      id: 'rival_intro', title: 'The Other Kid', weight: 6, when: (s) => fights(s) >= 2 && !s.flags.rival_met,
      text: (s, x) => { const r = x.rival(); return `On the same card as you: ${E().fullName(r)} from ${r.city}, also ${age(s)}, also hungry, already ${r.w}-${r.l}. He looks you up and down at the weigh-in. "${r.trash}"`; },
      choices: [
        { label: 'Say something back', hint: 'Fame', go: (x) => { x.flag('rival_met'); x.fame(2); x.flag('rival_heat', 2); return `The reporters write it down. "${x.rival().last} vs. ${x.last()}," one of them says, like it is already a poster.`; } },
        { label: 'Shake his hand', hint: 'Reputation', go: (x) => { x.flag('rival_met'); x.rep(3); x.flag('rival_respect', 1); return 'He looks at your hand for a long second. Then he shakes it.'; } },
        { label: 'Ignore him', go: (x) => { x.flag('rival_met'); x.heart(2); return 'You don\'t look at him once. It drives him crazy.'; } },
      ],
    },
    {
      id: 'rival_press', title: 'Your Rival Talks', weight: 2.5, repeat: 80, when: (s) => s.flags.rival_met && E().rival(s) && E().rival(s).active && !s.retired,
      text: (s, x) => { const r = x.rival(); return `${r.last} is ${r.w}-${r.l} now${r.id === s.world.champId ? ' and the champion of the world' : ''}. He tells ${x.paper()} that you are "${x.pick(['a pretty good sparring partner', 'scared of him', 'a nice kid who should get a real job', 'the most overrated fighter in America'])}."`; },
      choices: [
        { label: 'Call him out publicly', hint: 'Might get you the fight', go: (x) => { x.fame(3); x.flag('rival_heat', (x.s.flags.rival_heat || 0) + 1); const r = x.rival(); if (r && x.chance(0.5) && !x.s.offers) { x.offer({ level: r.id === x.s.world.champId ? 'title' : 'main', oppId: r.id, weeks: 6, tags: ['grudge match'] }); return 'He answers in the next morning paper. The promoters do the rest. The fight is on.'; } return 'He answers. You answer. It sells newspapers.'; } },
        { label: 'Let your fists answer', hint: 'Power', go: (x) => { x.stat('pow', 1); x.heart(3); return 'You hit the heavy bag like it owes you money.'; } },
      ],
    },
    {
      id: 'rival_champ', title: 'Your Rival Is Champion', weight: 8, when: (s) => s.flags.rival_champ && !s.flags.rival_champ_seen && !s.retired,
      text: (s, x) => `${x.rivalName()} is the champion of the world. You read it standing up at a newsstand. You read it again. The guy you came up with has the belt.`,
      choices: [
        { label: 'Train like a maniac', hint: 'Heart, stats', go: (x) => { x.flag('rival_champ_seen'); x.heart(10); x.stat('sta', 1.5); x.stat('pow', 1); return 'Two-a-days. Three-a-days. Your trainer has to hide the gym keys.'; } },
        { label: 'Send him a telegram: CONGRATULATIONS STOP SEE YOU SOON', hint: 'Fame', go: (x) => { x.flag('rival_champ_seen'); x.fame(4); return 'He reads it to reporters. They print it. The whole country is now waiting for the fight.'; } },
      ],
    },
    {
      id: 'rival_hurt', title: 'Your Rival Is in the Hospital', weight: 1.5, when: (s) => s.flags.rival_met && (s.flags.rival_fights || 0) >= 1 && E().rival(s) && E().rival(s).active && !s.flags.rival_hurt,
      text: (s, x) => `${x.rival().last} was knocked out cold last night and has not woken up. The papers say it does not look good.`,
      choices: [
        { label: 'Go to the hospital', hint: 'Reputation', go: (x) => { x.flag('rival_hurt'); x.rep(5); x.flag('rival_respect', 3); x.heart(-3); return `You sit in the hallway for six hours. On the second day he wakes up. The first thing he says when he sees you: "${x.rival().last} versus ${x.last()}. Still on."`; } },
        { label: 'Send flowers', go: (x) => { x.flag('rival_hurt'); x.rep(2); return 'He wakes up on the third day. He keeps the card.'; } },
        { label: 'Stay away', go: (x) => { x.flag('rival_hurt'); x.heart(-5); return 'You think about it more than you want to.'; } },
      ],
    },
    {
      id: 'rival_beat_you', title: 'Rematch', weight: 5, when: (s) => { const f = s.fights[s.fights.length - 1]; return f && f.oppId === s.people.rival && f.result === 'L' && s.t - f.t < 30 && !s.retired && !s.offers; },
      text: (s, x) => `${x.rival().last} beat you, and every paper in America printed it. He says he is "done" with you. The fans are not.`,
      choices: [
        { label: 'Demand the rematch', hint: 'Bigger purse, bigger stakes', go: (x) => { const r = x.rival(); x.offer({ level: r.id === x.s.world.champId ? 'title' : 'main', oppId: r.id, weeks: 8, tags: ['rematch'] }); return 'The fans want it. The promoters want it. Eventually, he wants the money.'; } },
        { label: 'Move on', go: (x) => { x.heart(-3); return 'Some losses you carry. You pick this one up and keep walking.'; } },
      ],
    },
    {
      id: 'rival_retires', title: 'Dinner with Your Rival', weight: 4, when: (s) => { const r = E().rival(s); return r && !r.active && s.flags.rival_met && !s.flags.rival_dinner; },
      text: (s, x) => `${x.rivalName()} has retired. He calls you, out of nowhere, and invites you to dinner. "Nobody else understands," he says. "Except you."`,
      choices: [
        { label: 'Go', hint: 'Heart', go: (x) => { x.flag('rival_dinner'); x.heart(12); x.remember('rival', `ended up friends with ${x.rivalName()}, my old rival`, 2); return 'You talk until the restaurant closes. Turns out he hated your jab as much as you hated his right hand.'; } },
        { label: 'Don\'t', go: (x) => { x.flag('rival_dinner'); return 'Some doors you leave closed.'; } },
      ],
    },
  );

  // ============ Deacon Tate and the color line ============
  add(
    {
      id: 'tate_intro', title: 'The Best Fighter in the Gym', weight: 5, when: (s) => fights(s) >= 1 && !s.flags.tate_met,
      text: 'Deacon Tate is the best fighter in your gym, maybe in the city. He is Black, and the top white contenders\' managers will not put their fighters in with him. So he fights the same handful of Black contenders over and over, for smaller purses, waiting for a shot that does not come.',
      archive: 'In the 1930s and 1940s, top Black fighters such as Charley Burley, Holman Williams, and Lloyd Marshall were so dangerous, and so shut out of title fights, that writers later called them "Murderers\' Row." Many never got a title shot.',
      choices: [
        { label: 'Ask him to spar with you', hint: 'Defense. A friend', go: (x) => { x.flag('tate_met'); x.flag('tate_friend'); x.flag('tate_story'); x.stat('def', 2.5); x.stat('chn', 1); return 'He takes you apart for six rounds, then shows you exactly how he did it. "Same time tomorrow?"'; } },
        { label: 'Watch him work', hint: 'Speed', go: (x) => { x.flag('tate_met'); x.flag('tate_story'); x.stat('spd', 1.5); return 'He moves like nothing you have ever seen. You try to copy it in the mirror.'; } },
      ],
    },
    {
      id: 'tate_fight', title: 'Will You Fight Deacon?', weight: 2.5, when: (s) => s.flags.tate_met && fights(s) >= 10 && !s.flags.tate_asked && !s.retired && yr(s) < 1952,
      text: 'Deacon\'s manager comes to you with an idea: fight Deacon. He needs a name on his record to force a title shot. Your manager says you are crazy. Deacon is the most avoided fighter in the division for a reason.',
      archive: 'Black contenders were often told they would only get a big fight if they agreed to lose or "carry" an opponent. Some champions simply never fought them.',
      choices: [
        { label: 'Fight him', hint: 'He is very good. Respect for life', go: (x) => { x.flag('tate_asked'); x.flag('tate_fought'); x.rep(10); x.flag('tate_story'); x.offer({ level: 'main', rating: Math.max(78, Math.round(x.E.overall(x.s) + 12)), weeks: 6, tags: ['Deacon Tate'], note: 'The papers call it the fight nobody wanted to make.', name: 'Deacon Tate' }); return '"You sure?" he asks. You are sure. He nods slowly. "Then I won\'t go easy."'; } },
        { label: 'Say no', hint: 'Protect your record', go: (x) => { x.flag('tate_asked'); x.heart(-4); return 'He does not argue. He has heard no before. That is the worst part.'; } },
      ],
    },
    {
      id: 'tate_road', title: 'No Vacancy', weight: 2, when: (s) => s.flags.tate_friend && !s.flags.tate_road && fights(s) >= 5,
      text: 'You and Deacon are on the road together for a card in another city. At the hotel, the clerk looks at Deacon and says there are no rooms. There is a VACANCY sign in the window.',
      choices: [
        { label: 'Everybody leaves together', hint: 'Costs money, earns respect', go: (x) => { x.flag('tate_road'); x.money(-10); x.rep(6); x.heart(4); x.remember('civil', 'walked out of a segregated hotel with my friend Deacon Tate', 2); return 'You find a boarding house from Deacon\'s Green Book. The owner makes the best fried chicken you have ever had and refuses your money for seconds.'; } },
        { label: 'Argue with the clerk', hint: 'Could go wrong', go: (x) => { x.flag('tate_road'); if (x.chance(0.4)) { x.rep(5); x.fame(2); return 'You raise your voice. The manager comes out, sees who you are, and suddenly finds two rooms. Deacon does not sleep well in either of them.'; } x.rep(3); x.heart(-4); return 'The clerk calls the police. You leave before they arrive. Deacon is quiet the whole drive.'; } },
        { label: 'Stay. Deacon finds his own place', hint: 'Easier tonight', go: (x) => { x.flag('tate_road'); x.rep(-6); x.heart(-6); return '"It\'s fine," Deacon says. "I\'m used to it." He does not look at you at breakfast.'; } },
      ],
    },
    {
      id: 'tate_shot', title: 'Deacon\'s Title Shot', weight: 4, when: (s) => s.flags.tate_met && yr(s) >= 1949 && !s.flags.tate_shot,
      text: 'After fifteen years, at 36 years old, Deacon Tate finally gets a title shot. The champion\'s manager agreed because Deacon is old, and they think he is finished. Deacon asks if you will work his corner.',
      archive: 'Archie Moore, avoided for most of his career, finally won the light heavyweight title in 1952 at about 36 years old. He held it for nearly a decade.',
      choices: [
        { label: 'Work his corner', hint: 'Takes time away from your own fights', go: (x) => { x.flag('tate_shot'); x.sharp(-10); if (x.chance(0.55)) { x.heart(15); x.rep(5); x.remember('civil', 'worked Deacon Tate\'s corner the night he finally won the title', 3); return 'Twelfth round. Deacon catches the champion with the right hand he has been throwing since 1934. When the referee raises his arm, he looks for you first.'; } x.heart(4); x.remember('civil', 'worked Deacon Tate\'s corner in his only title shot', 2); return 'He loses a close decision. In the dressing room he laughs. "Fifteen years for one shot. I\'d do it again."'; } },
        { label: 'Wish him luck', go: (x) => { x.flag('tate_shot'); if (x.chance(0.55)) { x.heart(6); return 'He wins. You hear it on the radio and scream so loud your neighbor bangs on the wall.'; } return 'He loses a split decision. Half the press row thinks he won.'; } },
      ],
    },
  );

  // ============ family and home ============
  add(
    {
      id: 'ma_letter', title: 'A Letter from Home', weight: 2, repeat: 60, when: (s) => !s.people.family.allowance && fights(s) >= 2,
      text: (s, x) => `${s.people.family.name} writes every week. This week: the rent went up, ${x.pick(['your little brother needs shoes', 'the furnace is broken', 'the doctor says she needs rest', 'your sister wants to go to nursing school'])}, and "don't worry about us." You worry.`,
      choices: [
        { label: 'Send money every month', hint: 'Costs a little each month', go: (x) => { x.s.people.family.allowance = true; x.heart(8); x.rep(2); x.remember('family', 'sent money home every month', 1); return 'You start sending ten dollars every month. The letters get happier.'; } },
        { label: 'Send a one-time gift', req: (s) => s.money >= 20, go: (x) => { x.money(-15); x.heart(4); return 'She writes back that you shouldn\'t have. She also says thank you four times.'; } },
        { label: 'Write back. Just words', go: (x) => { x.heart(1); return 'You write three pages. It takes you two hours.'; } },
      ],
    },
    {
      id: 'sweetheart', title: 'Saturday Night at the Dance Hall', weight: 2, when: (s) => !s.people.sweetheart && age(s) >= 19 && age(s) <= 34 && !s.flags.single,
      text: 'The band is playing Benny Goodman, and someone is laughing at your terrible dancing in a way that does not feel like an insult.',
      choices: [
        { label: 'Ask for another dance', hint: 'Heart', go: (x) => { x.s.people.sweetheart = { name: x.pick(['Rosie', 'June', 'Frances', 'Vera', 'Lena', 'Dot', 'Carmen', 'Hazel']) }; x.heart(10); x.later('wedding', 20, 60); return `Their name is ${x.s.people.sweetheart.name}. You walk home at two in the morning without noticing the cold.`; } },
        { label: 'Leave early. Roadwork tomorrow', hint: 'Discipline', go: (x) => { x.flag('single', true); x.stat('sta', 0.5); return 'You run five miles in the morning, thinking about the music.'; } },
      ],
    },
    {
      id: 'wedding', title: 'The Question', chain: true, when: (s) => !!s.people.sweetheart && !s.flags.married,
      text: (s) => `You and ${s.people.sweetheart.name} have been together a long time. There is a ring in the window of a pawnshop on your street. You have walked past it eleven times.`,
      choices: [
        { label: 'Buy the ring and ask', hint: 'Family. Costs go up', go: (x) => { x.flag('married'); x.flag('family'); x.money(-30); x.heart(15); x.remember('family', `married ${x.s.people.sweetheart.name}`, 2); x.later('baby', 30, 90); return 'The answer is yes. Half your gym comes to the wedding. Your trainer cries and blames the onions.'; } },
        { label: 'Not yet. After the title', go: (x) => { x.heart(-3); if (x.chance(0.4)) { x.s.people.sweetheart = null; x.flag('single', true); return 'You wait too long. One day there is a letter instead of a visit.'; } x.later('wedding', 30, 60); return 'They say they understand. They mostly do.'; } },
      ],
    },
    {
      id: 'baby', title: 'A New Corner Man', chain: true,
      text: 'You are a parent. The baby has your chin, poor kid.',
      go: (x) => { x.heart(15); x.flag('kid'); x.remember('family', 'became a parent', 2); return ''; },
    },
    {
      id: 'family_quit', title: 'Your Family Wants You to Quit', weight: 4, when: (s) => s.rec.kod >= 2 && (s.flags.married || s.people.family.allowance) && !s.flags.family_quit && !s.retired,
      text: (s) => `${s.flags.married ? s.people.sweetheart.name : s.people.family.name} watched you get knocked out. Now there is a conversation at the kitchen table you have been dreading.`,
      choices: [
        { label: 'Promise to retire soon', hint: 'Heart', go: (x) => { x.flag('family_quit'); x.flag('promised_retire'); x.heart(6); return '"Soon," you say. You both hear how vague it is.'; } },
        { label: '"This is who I am"', hint: 'Heart down', go: (x) => { x.flag('family_quit'); x.heart(-6); return 'Nobody wins the argument. Nobody ever does.'; } },
      ],
    },
    {
      id: 'homecoming_parade', title: 'Hometown Parade', weight: 4, when: (s) => s.fame >= 45 && !s.flags.parade,
      text: (s, x) => `${x.home()} throws you a parade. A convertible, a marching band, and the mayor who once had you thrown out of a public pool.`,
      choices: [{ label: 'Wave to everybody', go: (x) => { x.flag('parade'); x.fame(4); x.heart(10); x.remember('fame', `got a parade in ${x.home()}`, 2); return 'Your old teacher is on the curb. She is still disappointed about your spelling, but she waves.'; } }],
    },
  );

  // ============ fame, press, and the show ============
  add(
    {
      id: 'radio_quiz', title: 'Radio Quiz Show', weight: 1.6, repeat: 120, when: (s) => s.fame >= 10 && yr(s) < 1955,
      text: 'You are a guest on a radio quiz show. Answer the history question, win a prize for your favorite charity. The host clears his throat dramatically.',
      choices: (s, x) => {
        const qs = [
          { q: 'Which New Deal agency put millions to work building roads and schools?', a: ['The WPA', 'The NFL', 'The FBI'] },
          { q: 'In 1938, Joe Louis knocked out which German fighter in the first round?', a: ['Max Schmeling', 'Primo Carnera', 'Jack Johnson'] },
          { q: 'What was the Dust Bowl?', a: ['Drought and dust storms on the Great Plains', 'A college football game', 'A dance craze'] },
          { q: 'What did the GI Bill give returning veterans?', a: ['Money for school, homes, and businesses', 'Free radios', 'A new uniform'] },
          { q: 'Which baseball player broke the major league color line in 1947?', a: ['Jackie Robinson', 'Babe Ruth', 'Joe DiMaggio'] },
        ];
        const pool = qs.filter((q, i) => (i === 3 ? yr(s) >= 1945 : i === 4 ? yr(s) >= 1947 : i === 1 ? yr(s) >= 1938 : true));
        const q = pool[(s.t * 7) % pool.length];
        const ch = [0, 1, 2].map((i) => ({ label: q.a[i], go: (x2) => { if (i === 0) { x2.fame(3); x2.rep(2); return `"CORRECT!" A bell rings. Somewhere, ${x2.s.people.family.name} is bragging to the neighbors.`; } x2.fame(1); return `"Ohhh, so close!" It was not close. The answer was: ${q.a[0]}.`; } }));
        const k = s.t % 3;
        return ch.slice(k).concat(ch.slice(0, k));
      },
      kicker: (s) => 'On the Air',
    },
    {
      id: 'movie', title: 'Hollywood Calls', weight: 1.5, when: (s) => s.fame >= 35 && !s.flags.movie,
      text: 'A studio wants you for a bit part in a picture: a tough guy who gets punched by the leading man. You would have to fall down convincingly. For the first time in your career.',
      choices: [
        { label: 'Take the part', hint: 'Fame, money, sharpness', go: (x) => { x.flag('movie'); x.fame(6); x.money(400); x.sharp(-15); x.remember('fame', 'played a tough guy in a Hollywood picture', 2); return 'You take the punch in one take. The director says you are "a natural faller." You decide to take that as a compliment.'; } },
        { label: 'Stay in the gym', go: (x) => { x.flag('movie'); x.stat('def', 1); return 'Some other fighter gets punched by the leading man. Good for him.'; } },
      ],
    },
    {
      id: 'endorse', title: 'Your Face on a Cereal Box', weight: 1.5, when: (s) => s.fame >= 30 && !s.flags.endorse,
      text: 'Champion Oats wants your picture on the box. "Breakfast of fighters." Kids would see your face every morning.',
      choices: [
        { label: 'Sign the deal', hint: 'Money, fame', go: (x) => { x.flag('endorse'); x.money(300); x.fame(5); return 'Your little cousin eats four bowls a day now, out of loyalty.'; } },
        { label: 'Hold out for a cigarette company. More money', hint: 'Money, reputation down', go: (x) => { x.flag('endorse'); x.money(700); x.rep(-3); return 'Your face in magazines, holding a cigarette you do not smoke, saying it "calms your nerves."'; } },
      ],
    },
    {
      id: 'reporter_hit', title: 'A Hit Piece', weight: 1.8, repeat: 160, when: (s) => s.fame >= 15,
      text: (s, x) => `${x.reporter()} writes that you are "${x.pick(['soft', 'overrated', 'ducking real competition', 'more interested in nightclubs than roadwork'])}." It runs in ${x.paper()} with a bad photo.`,
      choices: [
        { label: 'Storm into the newsroom', hint: 'Coin flip', go: (x) => { if (x.chance(0.5)) { x.fame(3); return 'You argue until he agrees to watch you train. He writes a better column the next week.'; } x.rep(-3); x.fame(2); return 'You knock over a typewriter. The photo of THAT runs on page one.'; } },
        { label: 'Prove him wrong in the ring', hint: 'Heart', go: (x) => { x.heart(5); x.stat('pow', 0.7); return 'You cut out the column and tape it to your mirror.'; } },
      ],
    },
    {
      id: 'vaudeville', title: 'The Vaudeville Circuit', weight: 1.5, when: (s) => s.fame >= 20 && yr(s) < 1945 && !s.flags.vaudeville,
      text: 'A vaudeville booker wants you on stage: skip rope, shadowbox, tell a few jokes between a juggler and a singing dog. Eight weeks, eight cities, good money.',
      choices: [
        { label: 'Tour', hint: 'Money, fame. Rusty', go: (x) => { x.flag('vaudeville'); x.money(250); x.fame(5); x.sharp(-20); return 'The singing dog gets bigger laughs than you. Every night. You make friends with the dog.'; } },
        { label: 'Decline', go: (x) => { x.flag('vaudeville'); return 'You are a fighter, not an act. Mostly.'; } },
      ],
    },
    {
      id: 'autograph', title: 'A Kid with a Program', weight: 2, repeat: 200, when: (s) => s.fame >= 8,
      text: 'A kid waits outside the arena for an hour in the cold to get your autograph on a crumpled program.',
      choices: [
        { label: 'Sign it, and talk for a while', hint: 'Heart', go: (x) => { x.heart(5); x.rep(1); return 'He tells you he is going to be a fighter. You tell him to stay in school. He ignores you, like you did.'; } },
        { label: 'Sign it and go', go: (x) => { x.heart(1); return 'He runs off holding it over his head like a trophy.'; } },
      ],
    },
    {
      id: 'carnival', title: 'The Carnival Athletic Show', weight: 1.4, when: (s) => yr(s) < 1950 && fights(s) < 15 && !s.flags.carnival,
      text: 'A traveling carnival has an "athletic show": a tent where locals pay to fight the carnival boxer. Last one standing three rounds wins five dollars. They need a carnival boxer.',
      archive: 'Carnival boxing booths were a rough training ground for many 1930s fighters, who sometimes fought a dozen times a day.',
      choices: [
        { label: 'Join for the summer', hint: 'Sharpness, money, wear', go: (x) => { x.flag('carnival'); x.sharp(30); x.money(60); x.health(-6); x.stat('chn', 1.5); return 'You fight farmers, sailors, and one very determined lumberjack. You lose to the lumberjack. You never tell anyone.'; } },
        { label: 'Pass', go: (x) => { x.flag('carnival'); return 'You hear the calliope music from the gym window for weeks.'; } },
      ],
    },
    {
      id: 'move_ny', title: 'New York Is Where the Money Is', weight: 2, when: (s) => s.city !== 'newyork' && s.fame >= 20 && !s.flags.move_offer && !s.retired,
      text: (s, x) => `${x.manager()} says it plain: "Every big fight in this business goes through Madison Square Garden. If we want a title, we move to New York."`,
      choices: [
        { label: 'Move to New York', hint: 'Bigger fights. Lonelier', go: (x) => { x.flag('move_offer'); x.s.city = 'newyork'; x.elo(30); x.heart(-5); x.remember('move', 'moved to New York to chase the big fights', 1); return 'You train at Stillman\'s now, where Lou Stillman yells at everyone equally and the air is mostly cigar.'; } },
        { label: 'Stay home', hint: 'Heart', go: (x) => { x.flag('move_offer'); x.heart(5); return 'Your people are here. The big fights will have to come to you.'; } },
      ],
    },
  );

  // ============ the body ============
  add(
    {
      id: 'doctor_worry', title: 'The Doctor Has Questions', chain: true,
      text: 'After your last knockout, the commission doctor shines a light in your eyes for a long time. "How many times have you been knocked out?" You have to think about it. That worries him more than the number.',
      archive: 'Doctors described "punch drunk" syndrome in boxers as early as 1928. Today it is understood as brain damage from repeated blows to the head.',
      choices: [
        { label: 'Take six months off', hint: 'Health', go: (x) => { x.health(20); x.elo(-30); x.E.passWeeks(x.s, 24, 'rest'); return 'Six months off. The headaches mostly go away.'; } },
        { label: 'See a specialist', hint: '$100', req: (s) => s.money >= 100, go: (x) => { x.money(-80); if (x.chance(0.5)) { x.health(8); return 'Clean bill of health, for now. He tells you to stop getting hit. Great advice, doc.'; } x.flag('warned_brain'); return '"Every knockout makes the next one easier," he says. "And the damage adds up."'; } },
        { label: 'Ignore him', hint: 'Chin down', go: (x) => { x.stat('chn', -2); x.health(-3); return 'You feel fine. Mostly. Some mornings you forget a word.'; } },
      ],
    },
    {
      id: 'doctor_final', title: 'The Commission Pulls Your License', chain: true,
      text: 'The commission doctor will not sign your license. Your body has taken too much. In this state, your fighting career is over.',
      choices: [
        { label: 'Retire', go: (x) => { x.retire('doctor'); return 'You hang up the gloves. Literally: on a nail by the door.'; } },
        { label: 'Fight in a state with looser rules', hint: 'Very dangerous', go: (x) => { x.rep(-6); x.health(5); x.flag('outlaw'); x.flag('forced_doc', false); return 'Some states will license anybody who can stand up. You can still stand up.'; } },
      ],
    },
    {
      id: 'too_old', title: 'Forty', chain: true,
      text: 'You are forty years old. The commission sends a polite letter suggesting it is time. Your knees send a less polite one.',
      choices: [
        { label: 'Retire', go: (x) => { x.retire('age'); return 'Twenty-some years. You did it.'; } },
        { label: 'One more year', hint: 'Old fighters get hurt', go: (x) => { x.health(-10); return 'You lie to the commission doctor about your reading glasses.'; } },
      ],
    },
    {
      id: 'hands', title: 'Bad Hands', weight: 2, when: (s) => s.f.style === 'slugger' && fights(s) >= 12 && !s.flags.bad_hands,
      text: 'Your knuckles ache for three days after every fight now. Your right hand swells up like a catcher\'s mitt.',
      choices: [
        { label: 'Try a new way of wrapping', hint: 'Cheap', go: (x) => { x.flag('bad_hands'); x.stat('pow', -1); x.health(3); return 'Gauze, tape, and a sponge. It helps a little.'; } },
        { label: 'Surgery', hint: '$, time off', req: (s) => s.money >= 150, go: (x) => { x.flag('bad_hands'); x.money(-120); x.injure('healing hand surgery', 10, 6); x.stat('pow', 1); return 'The surgeon removes bone chips the size of rice. Ten weeks in a cast.'; } },
        { label: 'Fight through it', go: (x) => { x.flag('bad_hands'); x.stat('pow', -2); return 'You learn to punch with your hand a little open. It costs you.'; } },
      ],
    },
    {
      id: 'eye_test', title: 'The Eye Chart', weight: 2, when: (s) => fights(s) >= 25 && !s.flags.eye_test,
      text: 'The commission adds an eye exam. You squint at the chart. The bottom line is a gray smudge. The line above it is also a gray smudge.',
      choices: [
        { label: 'Memorize the chart', hint: 'Cheating. It works until it doesn\'t', go: (x) => { x.flag('eye_test'); x.rep(-3); x.stat('def', -1.5); return 'E, F, P, T, O, Z. You pass. You also do not see the left hook in your next sparring session.'; } },
        { label: 'Get glasses for outside the ring', hint: 'Honest', go: (x) => { x.flag('eye_test'); x.heart(2); x.money(-20); return 'You pass with corrected vision. Reporters think the glasses make you look like a professor.'; } },
      ],
    },
    {
      id: 'weight_cut', title: 'Two Pounds Over', weight: 2, phase: 'camp', when: (s) => s.camp && s.camp.done.length >= 1,
      text: 'Three days before the weigh-in, the scale says you are two pounds over. Your trainer hands you a rubber suit and a look.',
      choices: [
        { label: 'Sweat it off in the rubber suit', hint: 'Stamina down for the fight', go: (x) => { x.stat('sta', -1.5); x.health(-2); return 'You run in a rubber suit in July. You make weight with an ounce to spare and the personality of a raisin.'; } },
        { label: 'Skip meals', hint: 'Heart down', go: (x) => { x.heart(-6); return 'You make weight. You also snap at a waiter, a dog, and a priest.'; } },
        { label: 'Pay a fine and fight heavy', hint: 'Costs part of the purse', go: (x) => { if (x.s.camp) x.s.camp.offer.purse = Math.round(x.s.camp.offer.purse * 0.85); x.stat('pow', 0.5); return 'Fifteen percent of your purse goes to the other guy. You eat a steak.'; } },
      ],
    },
    {
      id: 'camp_distraction', title: 'Trouble in Camp', weight: 2, phase: 'camp', when: (s) => s.camp && s.fame >= 15,
      text: (s, x) => x.pick(['Your sparring partners got into a fistfight with each other. Over a card game.', 'Reporters have moved into the training camp hotel. One of them is in the next room.', 'Somebody has been sneaking into camp at night to watch you train.']),
      choices: [
        { label: 'Close the camp', hint: 'Focus', go: (x) => { if (x.s.camp) x.s.camp.scout++; x.fame(-1); return 'No visitors, no reporters, no card games. Peace and quiet. Mostly quiet.'; } },
        { label: 'Let it be a circus', hint: 'Fame', go: (x) => { x.fame(3); x.stat('def', -0.5); return 'Circus it is. Tickets sell. Concentration suffers.'; } },
      ],
    },
  );

  // ============ wartime at home ============
  add(
    {
      id: 'draft_notice', title: 'Greetings', weight: (s) => (s.flags.waiting_draft ? 5 : 2.5), when: (s) => yr(s) >= 1942 && yr(s) <= 1945 && E().weekOf(1945, 7, 1) > s.t && age(s) >= 18 && age(s) <= 37 && !s.flags.veteran && !s.flags.exempt && !s.retired && s.phase === 'between',
      text: (s) => `The letter starts with one word: "Greetings." The draft board has called your number. You are to report for a physical.${s.champ ? ' The champion of the world is going to war.' : ''}`,
      archive: 'About 10 million men were drafted during World War II. Many famous athletes served, including Joe Louis, Billy Conn, Ted Williams, and Joe DiMaggio.',
      choices: (s) => {
        const list = [{ label: 'Report for duty', hint: 'Your career pauses', go: (x) => { if (x.s.health < 55 || x.chance(0.12) || (x.s.injury && x.s.injury.penalty >= 6 && x.chance(0.5))) { x.flag('exempt'); x.heart(-4); x.remember('war', 'was classified 4-F and kept fighting at home during the war', 1); return 'The Army doctor reads your file, presses on your ribs, and stamps it 4-F: unfit for service. You do not know how to feel.'; } x.enlist('Army', 'drafted'); return 'You pass the physical. Two weeks later you are on a train with three hundred other men.'; } }];
        if (s.fame >= 30) list.push({ label: 'Ask to box exhibitions for the troops', hint: 'Still the Army', go: (x) => { x.enlist('Army', 'exhibition'); x.rep(6); return 'The Army agrees. You will box for soldiers on bases around the country, and maybe overseas.'; } });
        list.push({ label: 'Ask for a deferment for war plant work', hint: 'Unpopular', go: (x) => { if (x.chance(0.35)) { x.flag('exempt'); x.rep(-6); x.flag('war_plant'); x.remember('war', 'worked in a war plant instead of serving', 1); return 'Your deferment is approved. Some people at the gym stop talking to you.'; } x.enlist('Army', 'drafted'); return 'Denied. "Lots of people can rivet," the board chairman says. You report on Monday.'; } });
        return list;
      },
    },
    {
      id: 'bond_show', title: 'Boxing for War Bonds', weight: 2, when: (s) => yr(s) >= 1942 && yr(s) <= 1945 && s.fame >= 15 && !s.flags.bond_show,
      text: 'A war bond rally wants you to box a three-round exhibition. Admission is buying a bond.',
      archive: 'Americans bought about $185 billion in war bonds during World War II. Athletes and movie stars headlined bond drives.',
      choices: [
        { label: 'Do it', hint: 'Fame, reputation', go: (x) => { x.flag('bond_show'); x.fame(3); x.rep(5); return 'The rally sells $300,000 in bonds. You get a certificate and a handshake from a general.'; } },
        { label: 'Too busy', go: (x) => { x.flag('bond_show'); x.rep(-2); return 'A columnist notices.'; } },
      ],
    },
  );

  // ============ the television era ============
  add(
    {
      id: 'tv_friday', title: 'Friday Night, Coast to Coast', weight: 3, when: (s) => yr(s) >= 1950 && s.fame >= 15 && !s.champ && !s.offers && !s.retired,
      text: 'A TV boxing show has a slot open on Friday night. The fight will be seen in millions of homes. The opponent is "television friendly," meaning he walks forward and bleeds.',
      choices: [
        { label: 'Take the TV fight', hint: 'Big fame swing', go: (x) => { x.offer({ level: 'main', rating: Math.round(x.E.overall(x.s) + x.int(-4, 6)), weeks: 3, tags: ['on television'] }); return 'The network sends a contract and a list of things not to say on the air.'; } },
        { label: 'Not on short notice', go: () => 'They find somebody else in an hour. There is always somebody else.' },
      ],
    },
    {
      id: 'club_closes', title: 'Your Old Club Closes', weight: 3, when: (s) => yr(s) >= 1952 && !s.flags.club_closed,
      text: (s, x) => `${T.data.CITIES[s.f.home].club}, where you had some of your first fights, is closing. Nobody comes to the small fights anymore. They watch the big ones at home for free.`,
      archive: 'Television nearly wiped out local boxing clubs. Why pay for a small-time card when the big fights were free at home? Hundreds of small clubs closed in the 1950s, and with them the places young fighters learned their trade.',
      choices: [
        { label: 'Go to the last card', hint: 'Heart', go: (x) => { x.flag('club_closed'); x.heart(6); return 'They ask you to say a few words. You manage about four of them.'; } },
        { label: 'Buy the ring', hint: 'Money, a keepsake', req: (s) => s.money >= 200, go: (x) => { x.flag('club_closed'); x.flag('own_ring'); x.money(-80); return 'The old ring, sweat-stained canvas and all, goes into a warehouse. You are not sure why. You just could not let them throw it out.'; } },
      ],
    },
    {
      id: 'sponsor', title: 'A Sponsor Wants You', weight: 2, when: (s) => yr(s) >= 1950 && s.fame >= 35 && !s.flags.sponsor,
      text: (s, x) => `${x.pick(T.data.SPONSORS_1950S)} wants you in their TV commercials: you, a smile, and a slogan that does not quite make sense.`,
      choices: [
        { label: 'Sign', hint: 'Money, fame', go: (x) => { x.flag('sponsor'); x.money(500); x.fame(4); return 'You say "It\'s a knockout!" forty-one times until the director is happy.'; } },
        { label: 'No thanks', go: (x) => { x.flag('sponsor'); x.rep(1); return 'Some other fighter says "It\'s a knockout!" on TV every Friday.'; } },
      ],
    },
    {
      id: 'wrestling', title: 'The Wrestling Promoter', weight: 1.5, when: (s) => yr(s) >= 1948 && s.fame >= 25 && age(s) >= 29 && !s.flags.wrestling,
      text: 'Professional wrestling is the hottest thing on TV, and a promoter wants a "real fighter" to feud with his villain, The Masked Marvel. The ending is decided in advance. The money is real.',
      choices: [
        { label: 'Do one match', hint: 'Money, fame, a little embarrassing', go: (x) => { x.flag('wrestling'); x.money(400); x.fame(4); x.rep(-2); return 'The Masked Marvel hits you with a folding chair, then whispers "you OK, pal?" Very professional.'; } },
        { label: 'Refuse', go: (x) => { x.flag('wrestling'); x.rep(2); return '"Boxing\'s real," you tell him. He laughs for a long time.'; } },
      ],
    },
  );

  // ============ champion life ============
  add(
    {
      id: 'strip_warning', title: 'Defend It or Lose It', chain: true, when: (s) => s.champ,
      text: 'The commission sends a letter: defend your title against the top contender within ninety days, or be stripped.',
      choices: [
        { label: 'Sign for the defense', go: (x) => { const top = x.E.rankings(x.s).find((r) => r.id !== 0); x.s.c.champIdle = 0; x.flag('strip_warned', false); if (top) x.offer({ level: 'title', oppId: top.id, weeks: 8, tags: ['mandatory'] }); return 'You sign. Your manager negotiates for three days over the size of your name on the poster.'; } },
        { label: 'Let them strip you', go: (x) => { x.s.champ = false; const top = x.E.rankings(x.s).find((r) => r.id !== 0); if (top) x.s.world.champId = top.id; x.rep(-5); x.remember('title_lost', 'was stripped of the title for not defending it', 2); return 'You keep the belt. They just give a new one to somebody else.'; } },
      ],
    },
    {
      id: 'champ_dinner', title: 'Dinner at City Hall', weight: 3, when: (s) => s.champ && !s.flags.champ_dinner,
      text: 'The mayor throws a dinner in your honor. You sit next to a senator who calls you "son" and a bishop who asks for tips on his left hook.',
      choices: [{ label: 'Make a speech', go: (x) => { x.flag('champ_dinner'); x.fame(4); x.rep(3); return 'You thank your mother, your trainer, and the guy who sold you your first gloves. People cry. You do not. Mostly.'; } }],
    },
    {
      id: 'champ_bribe', title: 'An Offer to Lose the Belt', weight: 2, when: (s) => s.champ && s.titleDefenses >= 1 && !s.flags.champ_bribe,
      text: 'A man you do not know says certain people would pay a great deal of money if your next title defense ended early. In the challenger\'s favor.',
      choices: [
        { label: 'Throw him out', hint: 'Reputation', go: (x) => { x.flag('champ_bribe'); x.flag('refused_mob'); x.rep(8); x.later('mob_revenge', 6, 20); return 'You throw him out. Literally. He bounces once on the sidewalk.'; } },
        { label: 'Ask how much', hint: 'This is how it starts', go: (x) => { x.flag('champ_bribe'); x.flag('mob_met'); x.later('mob_fix', 1, 4); return 'He names a number. You do not say yes. You do not say no.'; } },
      ],
    },
  );

  // ============ late career ============
  add(
    {
      id: 'young_lion', title: 'The Young Lion', weight: 3, when: (s) => age(s) >= 32 && s.fame >= 20 && !s.retired && !s.offers,
      text: 'A 22-year-old knockout artist wants you. Not because you are dangerous anymore. Because your name looks good on his record. The purse is the biggest you have been offered in years.',
      choices: [
        { label: 'Take the money', hint: 'He is young and dangerous', go: (x) => { x.offer({ level: 'main', rating: Math.round(x.E.overall(x.s) + 9), weeks: 6, tags: ['young lion'], purse: Math.round(x.E.money ? 2500 * x.E.eraMoney(x.s.t) : 2500) }); return 'Old fighters get paid to teach young ones. Sometimes the young ones learn. Sometimes the old ones do.'; } },
        { label: 'Let him find another name', go: (x) => { x.heart(-2); return 'He calls you a coward in the papers. At your age, you can live with it.'; } },
      ],
    },
    {
      id: 'think_retire', title: 'The Long Look in the Mirror', weight: 3, repeat: 80, when: (s) => (age(s) >= 33 || s.health < 35 || s.flags.thinking_retire || s.flags.promised_retire) && !s.retired && s.phase === 'between',
      text: (s, x) => `${x.trainer()} sits down next to you after practice. "${age(s) >= 35 ? 'You\'re slower. I\'m old, so I notice.' : 'You\'ve taken a lot of punches, kid.'} I want you to walk out of this sport, not get carried out." Record: ${s.rec.w}-${s.rec.l}${s.rec.d ? '-' + s.rec.d : ''}. Bank account: ${E().money(s.money)}.`,
      choices: [
        { label: 'Retire now', hint: 'Start your second act', go: (x) => { x.retire('chose'); return 'You hand him your gloves. He holds them like they might break.'; } },
        { label: 'Not yet', go: (x) => { x.heart(-2); return '"Okay," he says. "Not yet."'; } },
      ],
    },
  );

  // ============ odd days (the Oregon Trail department) ============
  add(
    {
      id: 'bridge_out', title: 'The Bridge Is Out', weight: 1.4, repeat: 9999, when: (s) => fights(s) >= 2,
      text: 'On the drive to an out-of-town fight, the bridge is washed out. The river is three feet deep and moving fast. You have a borrowed Chevrolet and a schedule.',
      choices: [
        { label: 'Ford the river', hint: 'You know how this goes', go: (x) => { if (x.chance(0.5)) { x.money(-25); x.heart(-3); return 'You lose: one Chevrolet (borrowed), two suitcases, and your dignity. Your trainer floats past holding his hat. Nobody died of dysentery.'; } x.heart(5); return 'Somehow it works. The car will never be the same. Neither will you.'; } },
        { label: 'Wait for the ferry', hint: 'Slow', go: (x) => { x.sharp(-5); return 'Six hours. You play gin rummy with a traveling Bible salesman and lose eleven dollars.'; } },
        { label: 'Caulk the wagon and float it', go: (x) => { x.heart(3); return 'You do not have a wagon. Your trainer stares at you for a very long time.'; } },
      ],
    },
    {
      id: 'dysentery', title: 'Bad News from the Road', weight: 0.8, when: (s) => fights(s) >= 4 && !s.flags.dysentery,
      text: (s, x) => `${x.manager()} has dysentery.`,
      choices: [{ label: 'Oh no', go: (x) => { x.flag('dysentery'); x.elo(-10); return 'He is fine. He misses two weeks of phone calls. He blames a ham sandwich in Nebraska.'; } }],
    },
    {
      id: 'goat', title: 'A Goat Is Following You', weight: 1, when: (s) => !s.flags.goat && fights(s) >= 1,
      text: 'During roadwork, a goat starts running alongside you. It keeps pace for four miles. It is waiting outside the gym the next morning.',
      choices: [
        { label: 'Adopt the goat', hint: 'Heart. The press loves it', go: (x) => { x.flag('goat'); x.heart(6); x.fame(2); return 'You name it "Uppercut." It eats a reporter\'s notebook. The story runs anyway, with a photo of the goat.'; } },
        { label: 'Run faster', hint: 'Stamina', go: (x) => { x.flag('goat'); x.stat('sta', 1); return 'The goat gives up after a week. You are in the best shape of your life.'; } },
      ],
    },
    {
      id: 'lucky_coin', title: 'A Lucky Coin', weight: 1.2, when: (s) => !s.flags.lucky,
      text: 'You find a 1904 silver dollar on the sidewalk outside the arena. Heads up.',
      choices: [
        { label: 'Tape it inside your robe', hint: 'Heart', go: (x) => { x.flag('lucky'); x.heart(8); return 'It is not superstition if it works.'; } },
        { label: 'Spend it', go: (x) => { x.flag('lucky'); x.rawMoney(1); return 'A dollar is a dollar. Your trainer says you will regret that.'; } },
      ],
    },
    {
      id: 'dance_marathon', title: 'Dance Marathon', weight: 1.2, when: (s) => yr(s) < 1940 && !s.flags.marathon,
      text: 'A dance marathon in town offers a $100 prize to the last couple standing. Some couples have been dancing for nine days. Your trainer says it counts as roadwork. He is joking. You are not.',
      archive: 'Dance marathons were a Depression craze. Desperate couples danced for days or weeks for prize money, food, and a place to sleep.',
      choices: [
        { label: 'Enter', hint: 'Stamina helps', go: (x) => { x.flag('marathon'); if (x.chance(0.15 + x.s.st.sta / 200)) { x.money(100); x.stat('sta', 2); x.fame(2); return 'Day eleven. The last couple standing. You win $100 and cannot feel your feet until Thursday.'; } x.stat('sta', 1); x.heart(-2); return 'You last six days. Your partner falls asleep standing up and that is that.'; } },
        { label: 'Watch for a while', go: (x) => { x.flag('marathon'); return 'It is the saddest, most impressive thing you have ever seen.'; } },
      ],
    },
    {
      id: 'misspelled', title: 'The Robe', weight: 1, when: (s) => s.fame >= 10 && !s.flags.robe,
      text: (s) => `Your new silk robe arrives from the tailor. On the back, in gold thread: "${s.f.first.toUpperCase()} ${s.f.last.toUpperCase().replace(/[AEIOU]/, (m) => ({ A: 'E', E: 'A', I: 'Y', O: 'U', U: 'O' })[m])}."`,
      choices: [
        { label: 'Wear it anyway', hint: 'Fame', go: (x) => { x.flag('robe'); x.fame(2); x.heart(2); return 'The crowd thinks it is a bit. It becomes a bit.'; } },
        { label: 'Send it back', go: (x) => { x.flag('robe'); x.money(-5); return 'The second one is spelled right. It is somehow less fun.'; } },
      ],
    },
    {
      id: 'stray_photographer', title: 'Flashbulb', weight: 1, when: (s) => s.fame >= 20 && !s.flags.photo,
      text: 'A photographer catches you mid-yawn at a press conference. The paper runs it with the headline: "BORED?"',
      choices: [{ label: 'Laugh it off', go: (x) => { x.flag('photo'); x.fame(2); return 'You send the photographer a signed copy. He frames it.'; } }],
    },
  );
})(globalThis.TOT = globalThis.TOT || {});
