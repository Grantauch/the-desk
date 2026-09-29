/* THE LEAGUE — deterministic, shared browser/simulation rules. No network or student data. */
(function (root) {
  'use strict';
  const VERSION = 1;
  const TEAMS = [
    ['Detroit', 'Motors', '#bafa62', 'DM'], ['Chicago', 'Blaze', '#ffac75', 'CB'],
    ['Brooklyn', 'Royals', '#9bb8ff', 'BR'], ['Oakland', 'Oaks', '#7ee0c0', 'OO'],
    ['Miami', 'Wave', '#f3a5d4', 'MW'], ['Seattle', 'Sound', '#ddd080', 'SS'],
  ];
  const STRATEGIES = ['dynasty', 'media', 'builder', 'community', 'balanced', 'saver'];
  const WEIGHTS = {
    dynasty: { talent: 3.4, fans: 1.5, media: 1, stadium: 1, rep: 1, cash: .8 },
    media: { talent: 1.6, fans: 1.6, media: 3.1, stadium: 1, rep: 1, cash: 1 },
    builder: { talent: 1.5, fans: 1.6, media: 1.2, stadium: 3.1, rep: 1, cash: 1 },
    community: { talent: 1.6, fans: 2.3, media: 1, stadium: 1, rep: 2.7, cash: .9 },
    balanced: { talent: 2.4, fans: 2, media: 2, stadium: 2, rep: 1.7, cash: 1 },
    saver: { talent: 1.6, fans: 1.4, media: 1.7, stadium: 1.7, rep: 1.2, cash: 1.7 },
  };
  const asset = (name, type, description, effect) => ({ name, type, description, effect });
  const ERAS = [
    { year: '1900–1919', title: 'Build a hometown.', short: 'Hometown', pool: 0, rule: 'Ticket sales run the league. Fans earn a share of the gate. There is no broadcast money yet.', history: 'Before mass broadcasting, a franchise depended heavily on the people who could get to its ballpark. This fictional league starts with that local business problem.', source: 'https://baseballhall.org/discover/baseball-history/radio-days', sourceName: 'Baseball Hall of Fame · Radio Days', assets: [asset('The hometown ace', 'talent', 'A star on the field. A reason to buy a ticket.', { talent: 2, fans: 1 }), asset('A proper ballpark', 'stadium', 'Turn the turnstiles. Build something that lasts.', { stadium: 2, fans: 1 })] },
    { year: '1920s–1930s', title: 'Now everyone can listen.', short: 'Radio', pool: 12, rule: 'Radio switches on a shared broadcast pool. More media reach means a bigger slice—not unlimited money.', history: 'KDKA broadcast a major-league baseball game on August 5, 1921. Radio let people follow teams without buying a seat.', source: 'https://baseballhall.org/discover/baseball-history/radio-days', sourceName: 'Baseball Hall of Fame · Radio Days', assets: [asset('The radio deal', 'media', 'Your team, in living rooms across the region.', { media: 2, fans: 1 }), asset('The home-run idol', 'talent', 'The player everyone came to hear about.', { talent: 2, fans: 1, media: 1 })] },
    { year: '1940s–1950s', title: 'Open the doors.', short: 'Integration', pool: 18, rule: 'Every franchise gains +1 team strength this era. Community investment earns an extra +1 fan this era.', history: 'Jackie Robinson debuted for Brooklyn on April 15, 1947, breaking the modern major-league color barrier. Integration was a struggle for rights and opportunity, not an owner upgrade. The game models a league-wide opening of opportunity; exclusion is not a playable strategy.', source: 'https://baseballhall.org/discover/inside-pitch/robinson-signs-first-big-league-contract', sourceName: 'Baseball Hall of Fame · Robinson debuts', assets: [asset('The next generation', 'talent', 'A deep scouting network finds new talent.', { talent: 2, fans: 1 }), asset('The neighborhood club', 'community', 'Build a team the neighborhood can call its own.', { rep: 2, fans: 2 })] },
    { year: '1960s', title: 'The screen gets bigger.', short: 'Television', pool: 30, rule: 'Television expands the broadcast pool. Half is split equally; half follows media reach. Smaller teams share in the boom.', history: 'Pete Rozelle pushed NFL owners toward shared television revenue. National broadcasting could support the whole league, including smaller markets. Our fictional league borrows that principle.', source: 'https://www.profootballhof.com/news/pete-rozelle-s-legacy', sourceName: 'Pro Football Hall of Fame · Pete Rozelle', assets: [asset('Prime-time television', 'media', 'The game everybody watches after dinner.', { media: 3 }), asset('The highlight machine', 'talent', 'Great plays. Better replays.', { talent: 2, media: 1, fans: 1 })] },
    { year: '1970s', title: 'Players have leverage.', short: 'Player power', pool: 36, rule: 'Choose a labor deal before bidding. Payroll rises from this era onward. A lockout saves cash but costs fans, trust, and two eras of strength.', history: 'In 1975, an arbitration ruling freed Andy Messersmith and Dave McNally from baseball’s reserve system. Free agency changed players’ bargaining power. The game’s negotiate/lockout choice compresses a broader history of labor conflict.', source: 'https://baseballhall.org/discover/short-stops/free-agency-still-fuels-baseball', sourceName: 'Baseball Hall of Fame · Free agency', assets: [asset('The free-agent star', 'talent', 'A short contract. A serious shot at a title.', { talent: 3, fans: 1 }), asset('The national sponsor', 'media', 'A bigger audience for your franchise.', { media: 2, rep: 1 })] },
    { year: '1980s–1990s', title: 'Who pays for the stadium?', short: 'Stadium wars', pool: 42, rule: 'A new city offers a subsidy: +$6 and +2 stadium, but −2 fans and −2 trust. Stay and gain +1 trust.', history: 'Cities have used public money to attract or retain teams. A subsidy can help an owner while creating costs and opportunity costs for residents. Franchise profit is not the same as public benefit.', source: 'https://www.stlouisfed.org/publications/page-one-economics/2017/05/01/the-economics-of-subsidizing-sports-stadiums', sourceName: 'Federal Reserve Bank of St. Louis · Stadium subsidies', assets: [asset('The luxury boxes', 'stadium', 'Premium seats. Premium revenue.', { stadium: 2, fans: 1 }), asset('The cable empire', 'media', 'More channels. More time for your team.', { media: 2, fans: 1 })] },
    { year: '1990s–2000s', title: 'The whole world is watching.', short: 'Global stars', pool: 48, rule: 'Fans matter more to broadcast share: fan reach doubles its usual contribution this era.', history: 'The 1992 Dream Team helped basketball reach a worldwide audience. Stars and media could build audiences far beyond a team’s hometown.', source: 'https://www.nba.com/news/history-top-moments-dream-team-1992', sourceName: 'NBA · The 1992 Dream Team', assets: [asset('The global superstar', 'talent', 'One player. Millions of new eyes.', { talent: 2, media: 2, fans: 1 }), asset('The signature brand', 'community', 'A team identity people wear everywhere.', { fans: 2, rep: 1, media: 1 })] },
    { year: '2010s–today', title: 'Every screen is a stadium.', short: 'Streaming', pool: 54, rule: 'The biggest broadcast pool of the game. Final contracts last for this era only. Build value before the final whistle.', history: 'The NFL’s 2022 Thursday-night schedule included games on Prime Video. Streaming added another way for leagues to sell access to audiences.', source: 'https://www.nfl.com/schedules/2022/prime-time/thursday-night-football', sourceName: 'NFL · 2022 Thursday-night schedule', assets: [asset('The streaming rights', 'media', 'Your franchise on the smallest screen in the room.', { media: 3, fans: 1 }), asset('The last missing piece', 'talent', 'One final push for the championship.', { talent: 3, fans: 1 })] },
  ];
  const copy = x => JSON.parse(JSON.stringify(x));
  const round = x => Math.round(x * 10) / 10;
  const clamp = x => Math.max(0, Math.min(10, x));
  function random(s) { let x = s.rng | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; s.rng = x >>> 0; return s.rng / 4294967296; }
  function create({ mode = 'solo', count = 6, names = [], seed = Date.now() } = {}) {
    count = mode === 'solo' ? 6 : Math.max(2, Math.min(6, Math.trunc(count) || 6));
    return { version: VERSION, mode, rng: (seed >>> 0) || 1, era: 0, phase: 'history', lot: 0, turn: 0, auction: null, sold: null, season: null, log: [], completed: 0,
      teams: TEAMS.slice(0, count).map((x, i) => ({ id: i, name: String(names[i] || x.slice(0, 2).join(' ')).slice(0, 24), color: x[2], badge: x[3], human: mode === 'class' || i === 0, strategy: STRATEGIES[i], cash: 16, fans: 4, media: 1, stadium: 1, rep: 4, titles: 0, contracts: [], laborUntil: -1, relocated: false, lastAction: '', assets: [] })) };
  }
  function rating(t, era) { return Math.max(1, Math.min(8, 3 + t.contracts.filter(c => c.until >= era).reduce((n, c) => n + c.value, 0) + (era === 2 ? 1 : 0) - (t.laborUntil >= era ? 1 : 0))); }
  function value(t) { return round(.65 * t.cash + 2 * t.fans + 2 * t.media + 2 * t.stadium + 2.5 * t.rep + 6 * t.titles); }
  function standings(s) { return [...s.teams].sort((a, b) => value(b) - value(a) || a.id - b.id); }
  function note(s, text) { s.log.push({ era: s.era, text }); }
  function apply(t, effect, era, label) {
    for (const [k, v] of Object.entries(effect)) {
      if (k === 'talent') t.contracts.push({ value: v, until: Math.min(7, era + 1), name: label });
      else if (k === 'cash') t.cash = round(Math.max(0, t.cash + v));
      else t[k] = clamp(t[k] + v);
    }
  }
  function actions(t, era) {
    return [
      { id: 'develop', name: 'Develop the team', cost: 3, effect: { talent: 2 }, detail: `+2 strength for ${era === 7 ? 'this era' : 'this era and next'}. Better title odds; higher payroll.`, icon: 'talent' },
      { id: 'marketing', name: 'Make some noise', cost: 3 + Math.max(0, t.media - 4), effect: { media: 1, fans: 1 }, detail: '+1 media reach, +1 fan. Compete for broadcast money.', icon: 'media' },
      { id: 'stadium', name: 'Build the ballpark', cost: 4 + Math.max(0, t.stadium - 4), effect: { stadium: 1, fans: 1 }, detail: '+1 stadium, +1 fan. Every stadium point earns $0.5 each era.', icon: 'stadium' },
      { id: 'community', name: 'Back the community', cost: 2, effect: { rep: 1, fans: era === 2 ? 2 : 1 }, detail: `+1 trust, +${era === 2 ? 2 : 1} fan. Public support adds lasting franchise value.`, icon: 'community' },
      { id: 'save', name: 'Keep the cash', cost: 0, effect: {}, detail: 'Spend nothing. Keep your options open for the next auction.', icon: 'cash' },
    ];
  }
  function utility(t, eff, era) {
    const w = WEIGHTS[t.strategy];
    return Object.entries(eff).reduce((n, [k, v]) => n + v * w[k] * (k === 'talent' ? (era === 7 ? .65 : 1) * Math.max(.15, (8 - rating(t, era)) / 5) : k === 'cash' ? .6 : Math.max(.15, 1 - t[k] / 13)), 0);
  }
  function botAction(s, t) {
    return actions(t, s.era).filter(a => a.cost <= t.cash).map(a => ({ a, u: utility(t, a.effect, s.era) - a.cost * (.16 + .1 * WEIGHTS[t.strategy].cash) + random(s) * .8 })).sort((a, b) => b.u - a.u)[0].a.id;
  }
  function openAuction(s) {
    const a = ERAS[s.era].assets[s.lot];
    s.phase = 'auction';
    s.auction = { high: -1, bid: 0, passed: s.teams.map(() => false), caps: s.teams.map(t => t.human ? 0 : Math.max(0, Math.min(Math.floor(t.cash - 3), Math.round(utility(t, a.effect, s.era) * 1.25 + random(s) * 3)))) };
  }
  // Bots set their ceiling before any human bid. They do not read hidden human intentions.
  function botsBid(s) {
    const a = s.auction;
    let guard = 0;
    while (guard++ < 200) {
      const willing = s.teams.filter(t => !t.human && t.id !== a.high && !a.passed[t.id] && a.caps[t.id] >= a.bid + 1 && t.cash >= a.bid + 1);
      if (!willing.length) break;
      const t = willing[Math.floor(random(s) * willing.length)];
      a.bid++; a.high = t.id;
    }
  }
  function decisionOptions(s) {
    return s.era === 4 ? [
      { id: 'negotiate', name: 'Negotiate', cost: 2, detail: 'Pay $2. Gain +1 trust. Keep full team strength.', effect: { cash: -2, rep: 1 } },
      { id: 'lockout', name: 'Lock out', cost: 0, detail: 'Gain $3. Lose 1 fan and 1 trust. −1 strength this era and next.', effect: { cash: 3, fans: -1, rep: -1 } },
    ] : [
      { id: 'stay', name: 'Stay home', cost: 0, detail: 'Keep your fans. Gain +1 trust.', effect: { rep: 1 } },
      { id: 'move', name: 'Take the subsidy', cost: 0, detail: 'Gain $6 and +2 stadium. Lose 2 fans and 2 trust. Your old city loses its team.', effect: { cash: 6, stadium: 2, fans: -2, rep: -2 } },
    ];
  }
  function makeDecision(s, t, id) {
    const d = decisionOptions(s).find(x => x.id === id);
    if (!d || t.cash < d.cost) throw new Error('That decision is not affordable.');
    apply(t, d.effect, s.era, d.name);
    if (id === 'lockout') t.laborUntil = s.era + 1;
    if (id === 'move') t.relocated = true;
    note(s, `${t.name}: ${d.name}.`);
  }
  function advanceTurn(s) {
    while (s.turn < s.teams.length && !s.teams[s.turn].human) {
      const t = s.teams[s.turn];
      if (s.phase === 'decision') {
        const d = decisionOptions(s).filter(x => x.cost <= t.cash).map(x => ({ id: x.id, u: utility(t, x.effect, s.era) - (x.id === 'lockout' ? WEIGHTS[t.strategy].talent * 1.2 : 0) + random(s) })).sort((a,b) => b.u-a.u)[0];
        makeDecision(s, t, d.id);
      } else invest(s, t, botAction(s, t));
      s.turn++;
    }
    if (s.turn === s.teams.length) { if (s.phase === 'decision') openAuction(s); else s.phase = 'season'; }
  }
  function invest(s, t, id) {
    const a = actions(t, s.era).find(x => x.id === id);
    if (!a || t.cash < a.cost) throw new Error('You cannot afford that investment.');
    t.cash = round(t.cash - a.cost); apply(t, a.effect, s.era, a.name); t.lastAction = a.name;
    note(s, `${t.name}: ${a.name}${a.cost ? ` ($${a.cost})` : ''}.`);
  }
  function resolveSeason(s) {
    const rolls = s.teams.map(t => { const dice = [1 + Math.floor(random(s) * 6), 1 + Math.floor(random(s) * 6)]; return { id: t.id, dice, rating: rating(t, s.era), performance: round(dice[0] + dice[1] + .65 * rating(t, s.era)), tiebreak: random(s) }; });
    rolls.sort((a,b) => b.performance-a.performance || b.tiebreak-a.tiebreak);
    const champ = s.teams[rolls[0].id]; champ.titles++; champ.fans = clamp(champ.fans + 1); champ.cash = round(champ.cash + 2);
    const totalFans = s.teams.reduce((n,t) => n + Math.max(1,t.fans),0);
    const attention = t => Math.max(1,t.media + (s.era === 6 ? .7 : .35) * t.fans);
    const totalMedia = s.teams.reduce((n,t) => n + attention(t),0);
    const pool = ERAS[s.era].pool * s.teams.length / 6;
    const income = s.teams.map(t => {
      const base = 3, gate = round(s.teams.length * 3 * Math.max(1,t.fans) / totalFans);
      const media = round(pool * (s.era >= 3 ? .5 / s.teams.length + .5 * attention(t) / totalMedia : attention(t) / totalMedia));
      const stadium = round(.5 * t.stadium), payroll = round(.3 * rating(t,s.era) * (s.era >= 4 ? 1.4 : 1));
      const net = round(base + gate + media + stadium - payroll);
      t.cash = round(Math.max(0,t.cash + net));
      return { id:t.id, base,gate,media,stadium,payroll,net, bonus:t.id === champ.id ? 2 : 0 };
    });
    s.season = { era:s.era, champ:champ.id, rolls,income }; s.completed++; s.phase = 'results';
    note(s, `${champ.name} win the ${ERAS[s.era].short} championship.`);
  }
  function transition(state, command) {
    const s = copy(state), { type } = command;
    if (type === 'begin' && s.phase === 'history') {
      s.turn = 0; s.lot = 0;
      if ([4,5].includes(s.era)) { s.phase = 'decision'; advanceTurn(s); } else openAuction(s);
    } else if (type === 'decision' && s.phase === 'decision') {
      makeDecision(s, s.teams[s.turn], command.id); s.turn++; advanceTurn(s);
    } else if (type === 'bid' && s.phase === 'auction') {
      const t = s.teams[command.team], a = s.auction;
      if (!t || !t.human || a.high === t.id || a.passed[t.id] || t.cash < a.bid + 1) throw new Error('That bid is not available.');
      a.bid++; a.high = t.id; botsBid(s);
    } else if (type === 'pass' && s.phase === 'auction') {
      const t = s.teams[command.team], a = s.auction;
      if (!t || !t.human || a.high === t.id) throw new Error('The high bidder cannot pass.');
      a.passed[t.id] = true; botsBid(s);
      if (s.teams.filter(t => t.human).every(t => a.passed[t.id] || t.cash < a.bid + 1)) return transition(s, {type:'sell'});
    } else if (type === 'sell' && s.phase === 'auction') {
      botsBid(s);
      const a = s.auction, lot = ERAS[s.era].assets[s.lot];
      if (a.high >= 0) { const t=s.teams[a.high]; t.cash=round(t.cash-a.bid); apply(t,lot.effect,s.era,lot.name); t.assets.push({name:lot.name,era:s.era,price:a.bid}); note(s,`${t.name} bought ${lot.name} for $${a.bid}.`); }
      else note(s,`${lot.name} went unsold.`);
      s.sold = { team:a.high,price:a.bid,name:lot.name,effect:lot.effect }; s.phase = 'sold';
    } else if (type === 'nextLot' && s.phase === 'sold') {
      if (s.lot === 0) {s.lot=1;openAuction(s);} else {s.phase='office';s.turn=0;advanceTurn(s);}
    } else if (type === 'invest' && s.phase === 'office') {
      invest(s,s.teams[s.turn],command.id);s.turn++;advanceTurn(s);
    } else if (type === 'season' && s.phase === 'season') resolveSeason(s);
    else if (type === 'nextEra' && s.phase === 'results') {
      if(s.era === 7) s.phase='final'; else {s.era++;s.phase='history';s.teams.forEach(t=>{t.contracts=t.contracts.filter(c=>c.until>=s.era);});}
    } else if (type === 'finish' && s.phase === 'results') s.phase='final';
    else throw new Error('That action is not available at this point.');
    return s;
  }
  function validate(s) {
    if (!s || s.version !== VERSION || !['solo','class'].includes(s.mode) || !Number.isInteger(s.rng) || s.rng < 1 || s.rng > 4294967295 || !Number.isInteger(s.era) || s.era<0 || s.era>7 || !['history','decision','auction','sold','office','season','results','final'].includes(s.phase)) return false;
    if(!Array.isArray(s.teams)||s.teams.length<2||s.teams.length>6||!Array.isArray(s.log)||s.log.length>500||!Number.isInteger(s.completed)||s.completed<0||s.completed>8) return false;
    if(!s.log.every(x=>x&&Number.isInteger(x.era)&&x.era>=0&&x.era<=7&&typeof x.text==='string'&&x.text.length<300)) return false;
    const validTeams=s.teams.every((t,i)=>t && t.id===i && typeof t.name==='string' && t.name.length>0 && t.name.length<=24 && t.color===TEAMS[i][2] && t.badge===TEAMS[i][3] && typeof t.human==='boolean' && STRATEGIES.includes(t.strategy) && ['cash','fans','media','stadium','rep','titles'].every(k=>Number.isFinite(t[k])&&t[k]>=0&&t[k]<10000) && ['fans','media','stadium','rep'].every(k=>t[k]<=10) && Number.isInteger(t.titles)&&t.titles<=8 && Number.isInteger(t.laborUntil)&&typeof t.relocated==='boolean'&&typeof t.lastAction==='string'&&t.lastAction.length<80 && Array.isArray(t.contracts)&&t.contracts.length<=20&&t.contracts.every(c=>c&&Number.isInteger(c.until)&&c.until>=0&&c.until<=7&&Number.isFinite(c.value)&&c.value>0&&c.value<=3&&typeof c.name==='string'&&c.name.length<80) && Array.isArray(t.assets)&&t.assets.length<=16&&t.assets.every(a=>a&&typeof a.name==='string'&&a.name.length<80&&Number.isInteger(a.era)&&Number.isFinite(a.price)));
    if(!validTeams || (s.mode==='solo' ? s.teams.length!==6||s.teams.some((t,i)=>t.human!==(i===0)) : s.teams.some(t=>!t.human))) return false;
    if(!Number.isInteger(s.lot)||s.lot<0||s.lot>1||!Number.isInteger(s.turn)||s.turn<0||s.turn>s.teams.length) return false;
    if(['office','decision'].includes(s.phase)&&s.turn>=s.teams.length) return false;
    if(s.phase==='decision'&&![4,5].includes(s.era))return false;
    if(s.phase==='auction') { const a=s.auction; if(!a||!Number.isInteger(a.high)||a.high< -1||a.high>=s.teams.length||!Number.isInteger(a.bid)||a.bid<0||a.bid>10000||!Array.isArray(a.passed)||a.passed.length!==s.teams.length||!a.passed.every(x=>typeof x==='boolean')||!Array.isArray(a.caps)||a.caps.length!==s.teams.length||!a.caps.every(x=>Number.isInteger(x)&&x>=0&&x<10000)||(a.high>=0&&a.bid>s.teams[a.high].cash))return false; }
    if(s.phase==='sold') {const a=s.sold;if(!a||!Number.isInteger(a.team)||a.team< -1||a.team>=s.teams.length||!Number.isFinite(a.price)||typeof a.name!=='string'||!a.effect||Object.keys(a.effect).some(k=>!['talent','fans','media','stadium','rep','cash'].includes(k))||!Object.values(a.effect).every(Number.isFinite))return false;}
    if(['results','final'].includes(s.phase)) {const a=s.season;if(!a||!Number.isInteger(a.champ)||a.champ<0||a.champ>=s.teams.length||!Array.isArray(a.rolls)||a.rolls.length!==s.teams.length||!Array.isArray(a.income)||a.income.length!==s.teams.length)return false;
      if(!a.rolls.every(r=>r&&Number.isInteger(r.id)&&r.id>=0&&r.id<s.teams.length&&Array.isArray(r.dice)&&r.dice.length===2&&r.dice.every(d=>Number.isInteger(d)&&d>=1&&d<=6)&&Number.isFinite(r.rating)&&Number.isFinite(r.performance))||!a.income.every(r=>r&&Number.isInteger(r.id)&&r.id>=0&&r.id<s.teams.length&&['base','gate','media','stadium','payroll','net','bonus'].every(k=>Number.isFinite(r[k]))))return false; }
    return true;
  }
  root.League = { VERSION, TEAMS, STRATEGIES, ERAS, create, transition, rating, value, standings, actions, decisionOptions, botAction, validate, copy, round };
})(globalThis);
