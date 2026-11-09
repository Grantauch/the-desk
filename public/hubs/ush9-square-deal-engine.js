// Square Deal: the cards and the rules engine. No page code lives here, so the rules can be tested alone.
// Reformers push each front toward +6. The Machine pushes toward -6. After ten rounds, 1900 to 1918,
// whoever holds more fronts wins. Outrage builds from exposés, and laws spend it. Laws shield a front:
// every Machine push there is one weaker per law, up to two. Courts can strike laws down, but not amendments.
(function () {
  'use strict';
  const FRONTS = [
    { id: 'city', name: 'The City', sub: 'Bosses, slums and ballots', img: 'city', credit: '"The Brains," Thomas Nast, Harper\'s Weekly, 1871. Library of Congress.' },
    { id: 'factory', name: 'The Factory', sub: 'Hours, safety and children', img: 'factory', credit: 'Addie Card, 12, spinner in a Vermont cotton mill, 1910. Lewis Hine, Library of Congress.' },
    { id: 'market', name: 'The Market', sub: 'Trusts, meat and medicine', img: 'market', credit: '"Next!" Udo Keppler, Puck, 1904. Library of Congress.' },
    { id: 'vote', name: 'The Vote', sub: 'Suffrage, civil rights and the Senate', img: 'vote', credit: '"The Awakening," Hy Mayer, Puck, 1915. Library of Congress.' }
  ];
  const ROUNDS = 10, MAXM = 6, START_M = 0, HAND_MAX = 8, START_HAND = 4, DRAW = 2;
  const influenceFor = round => Math.min(round + 1, 6);
  const yearOf = round => 1898 + round * 2;

  // kind: expose, organize, law, amend, special  |  graft, boss, muscle, spin, court
  // fx: list of effects. push = move the meter (always written as the size, the side decides direction).
  const R = [
    { id: 'riis', name: "Jacob Riis's Flash Camera", cost: 2, kind: 'expose', front: 'city', fx: [['out', 'city', 3], ['push', 'city', 1]],
      fact: 'How the Other Half Lives, 1890, used magnesium flash photos to show readers the inside of New York tenements.' },
    { id: 'steffens', name: 'The Shame of the Cities', cost: 2, kind: 'expose', front: 'city', fx: [['out', 'city', 3], ['push', 'city', 1]],
      fact: 'Lincoln Steffens exposed machine bosses in St. Louis, Minneapolis, Philadelphia and other cities. The book came out in 1904.' },
    { id: 'tarbell', name: "Ida Tarbell's Files", cost: 3, kind: 'expose', front: 'market', fx: [['out', 'market', 4], ['push', 'market', 1]],
      fact: 'Tarbell built her 19 part Standard Oil series for McClure\'s, 1902 to 1904, from court testimony and company records.' },
    { id: 'jungle', name: 'The Jungle', cost: 3, kind: 'expose', front: 'market', fx: [['out', 'market', 3], ['out', 'factory', 1], ['push', 'market', 1]],
      fact: 'Upton Sinclair spent seven weeks in the Chicago stockyards in 1904. Readers cared more about their meat than the workers.' },
    { id: 'hine', name: "Lewis Hine's Camera", cost: 2, kind: 'expose', front: 'factory', fx: [['out', 'factory', 3], ['push', 'factory', 1]],
      fact: 'Hine photographed child workers for the National Child Labor Committee, often talking his way past mill guards.' },
    { id: 'perkins', name: 'Frances Perkins Investigates', cost: 3, kind: 'expose', front: 'factory', fx: [['out', 'factory', 4], ['push', 'factory', 1]],
      fact: 'Perkins watched the Triangle fire in 1911 and then investigated New York factories. In 1933 she became the first woman in a presidential cabinet.' },
    { id: 'wells', name: 'Ida B. Wells Reports', cost: 2, kind: 'expose', front: 'vote', fx: [['out', 'vote', 3], ['push', 'vote', 1]],
      fact: 'After a Memphis mob lynched three Black grocers in 1892, Wells documented lynching across the South. A mob destroyed her newspaper office.' },
    { id: 'gospel', name: 'Social Gospel Sermons', cost: 2, kind: 'expose', front: 'all', fx: [['out', 'all', 1]],
      fact: 'Social Gospel ministers preached that Christians had a duty to fight poverty and unsafe work here on earth.' },
    { id: 'hull', name: 'Hull House', cost: 3, kind: 'organize', front: 'city', fx: [['agent', 'city', 1, 3]],
      fact: 'Jane Addams and Ellen Gates Starr opened Hull House in Chicago in 1889. Volunteers lived in the neighborhood they served.' },
    { id: 'ilgwu', name: 'Uprising of the 20,000', cost: 3, kind: 'organize', front: 'factory', fx: [['agent', 'factory', 1, 3]],
      fact: 'In November 1909, about 20,000 New York shirtwaist workers walked out after Clara Lemlich called for a general strike.' },
    { id: 'nawsa', name: 'NAWSA Marchers', cost: 3, kind: 'organize', front: 'vote', fx: [['agent', 'vote', 1, 3]],
      fact: 'The National American Woman Suffrage Association grew to about two million members and led the final push for the 19th Amendment.' },
    { id: 'naacp', name: 'The NAACP', cost: 3, kind: 'organize', front: 'vote', fx: [['agent', 'vote', 1, 3]],
      fact: 'W.E.B. Du Bois, Ida B. Wells and others founded the NAACP in 1909. It fought segregation in court.' },
    { id: 'tenement', name: 'Tenement House Act', cost: 2, kind: 'law', front: 'city', need: 3, fx: [['push', 'city', 3]],
      fact: 'New York\'s 1901 law required a toilet in every apartment and a window to open air in every room.' },
    { id: 'ballot', name: 'The Secret Ballot', cost: 2, kind: 'law', front: 'city', need: 2, fx: [['push', 'city', 2]],
      fact: 'With a private booth and a printed ballot, a boss could no longer watch how a bribed voter voted.' },
    { id: 'irr', name: 'Initiative, Referendum and Recall', cost: 2, kind: 'law', front: 'city', need: 3, fx: [['push', 'city', 2], ['bust', 'city']],
      fact: 'Oregon led the way in 1902. Voters could write laws, vote on laws and remove officials before their terms ended.' },
    { id: 'meat', name: 'Meat Inspection Act', cost: 3, kind: 'law', front: 'market', need: 4, fx: [['push', 'market', 3]],
      fact: 'Roosevelt signed it on June 30, 1906, about five months after The Jungle came out.' },
    { id: 'pfda', name: 'Pure Food and Drug Act', cost: 2, kind: 'law', front: 'market', need: 3, fx: [['push', 'market', 2]],
      fact: 'Signed the same day as the Meat Inspection Act. Labels now had to admit dangerous ingredients like opium and cocaine.' },
    { id: 'trust', name: 'Trust Busting', cost: 3, kind: 'law', front: 'market', need: 3, fx: [['push', 'market', 2], ['bust', 'market']],
      fact: 'Under the Sherman Antitrust Act, the Supreme Court broke up Northern Securities in 1904 and Standard Oil in 1911.' },
    { id: 'factorylaw', name: 'Factory Safety Laws', cost: 3, kind: 'law', front: 'factory', need: 4, fx: [['push', 'factory', 3]],
      fact: 'After the Triangle fire killed 146 workers in 1911, New York passed dozens of laws on fire exits, sprinklers and hours.' },
    { id: 'keating', name: 'Keating Owen Act', cost: 2, kind: 'law', front: 'factory', need: 3, fx: [['push', 'factory', 2]],
      fact: 'The 1916 law closed interstate trade to goods from factories using workers under 14 or mines using workers under 16.' },
    { id: 'am16', name: '16th Amendment', cost: 3, kind: 'amend', front: 'market', need: 3, fx: [['push', 'market', 2]],
      fact: 'Ratified in 1913, it let Congress tax incomes. The Populists had asked for it back in 1892.' },
    { id: 'am17', name: '17th Amendment', cost: 3, kind: 'amend', front: 'vote', need: 3, fx: [['push', 'vote', 3]],
      fact: 'Ratified in 1913. Voters, not state legislatures, now chose their senators.' },
    { id: 'am19', name: '19th Amendment', cost: 4, kind: 'amend', front: 'vote', need: 4, fx: [['push', 'vote', 4]],
      fact: 'Ratified in August 1920, it barred states from denying the vote because of sex. Tennessee was the 36th state to ratify.' },
    { id: 'square', name: 'The Square Deal', cost: 5, kind: 'special', front: 'all', fx: [['push', 'all', 1]],
      fact: 'Roosevelt\'s promise of fairness rested on consumer protection, control of corporations and conservation.' },
    { id: 'pulpit', name: 'The Bully Pulpit', cost: 1, kind: 'special', front: 'none', fx: [['draw', 2]],
      fact: 'Roosevelt called the presidency a bully pulpit. In his day, bully meant excellent.' }
  ];
  const M = [
    { id: 'tammany', name: 'Tammany Hall', cost: 3, kind: 'boss', front: 'city', fx: [['agent', 'city', 1, 3]],
      fact: 'New York\'s Democratic machine traded jobs, favors and coal in winter for votes. It ran the city for decades.' },
    { id: 'plunkitt', name: 'Honest Graft', cost: 2, kind: 'graft', front: 'city', fx: [['push', 'city', 2]],
      fact: 'Tammany\'s George Washington Plunkitt bragged in 1905, "I seen my opportunities and I took \'em."' },
    { id: 'heelers', name: 'Ward Heelers', cost: 2, kind: 'muscle', front: 'city', fx: [['bust', 'city'], ['push', 'city', 1]],
      fact: 'Ward heelers were a boss\'s street level workers. They found jobs for loyal voters and trouble for disloyal ones.' },
    { id: 'repeaters', name: 'Repeat Voters', cost: 1, kind: 'graft', front: 'city', fx: [['push', 'city', 1]],
      fact: 'Machines paid men to vote early and often, sometimes under the names of dead voters.' },
    { id: 'patronage', name: 'Patronage Jobs', cost: 3, kind: 'boss', front: 'city', fx: [['agent', 'city', 1, 2], ['push', 'city', 1]],
      fact: 'City jobs went to loyal party workers, who were expected to deliver votes and kick back part of their pay.' },
    { id: 'rebates', name: 'Railroad Rebates', cost: 2, kind: 'graft', front: 'market', fx: [['push', 'market', 2]],
      fact: 'Secret railroad discounts let Standard Oil ship cheaper than rivals. By 1880 it refined about 90 percent of American oil.' },
    { id: 'beef', name: 'The Beef Trust', cost: 3, kind: 'boss', front: 'market', fx: [['agent', 'market', 1, 3]],
      fact: 'A handful of Chicago packers fixed prices together. The Supreme Court ruled against them in 1905.' },
    { id: 'holding', name: 'The Holding Company', cost: 3, kind: 'boss', front: 'market', fx: [['agent', 'market', 1, 3]],
      fact: 'A holding company owned the stock of rival firms, turning competitors into one combination without a formal merger.' },
    { id: 'patent', name: 'Patent Medicine Ads', cost: 2, kind: 'spin', front: 'market', fx: [['spin', 'market', 2], ['push', 'market', 1]],
      fact: 'Bottles promised cures for everything. Many held alcohol, opium or cocaine, and nothing on the label said so.' },
    { id: 'buyout', name: 'Buy Out the Competition', cost: 3, kind: 'graft', front: 'market', fx: [['push', 'market', 2], ['draw', 1]],
      fact: 'Rockefeller offered rivals Standard Oil stock or cash. Those who refused faced price wars they could not survive.' },
    { id: 'pinkerton', name: 'Pinkerton Agents', cost: 3, kind: 'muscle', front: 'factory', fx: [['bust', 'factory'], ['push', 'factory', 1]],
      fact: 'At Homestead in 1892, 300 Pinkerton guards hired by Carnegie Steel fought striking workers. Men died on both sides.' },
    { id: 'injunction', name: 'Court Injunction', cost: 2, kind: 'muscle', front: 'factory', fx: [['bust', 'factory']],
      fact: 'Judges ordered strikers back to work, as a federal court did in the Pullman Strike of 1894.' },
    { id: 'speedup', name: 'The Twelve Hour Day', cost: 2, kind: 'graft', front: 'factory', fx: [['push', 'factory', 2]],
      fact: 'Steelworkers often worked twelve hour shifts. US Steel did not give up the twelve hour day until 1923.' },
    { id: 'companytown', name: 'Company Towns', cost: 3, kind: 'boss', front: 'factory', fx: [['agent', 'factory', 1, 3]],
      fact: 'In Pullman, Illinois, the company owned the houses, the stores and the church. Rents stayed high when wages fell in 1894.' },
    { id: 'strikebreakers', name: 'Strikebreakers', cost: 2, kind: 'spin', front: 'factory', fx: [['spin', 'factory', 1], ['push', 'factory', 1]],
      fact: 'Owners brought in replacement workers, often new immigrants who had not been told a strike was on.' },
    { id: 'lochner', name: 'Lochner v. New York', cost: 4, kind: 'court', front: 'any', fx: [['strike', 'any'], ['push', 'target', 2]],
      fact: 'In 1905 the Supreme Court struck down a New York law limiting bakers to ten hours a day.' },
    { id: 'hammer', name: 'Hammer v. Dagenhart', cost: 3, kind: 'court', front: 'factory', fx: [['strike', 'factory'], ['push', 'factory', 2]],
      fact: 'In 1918 the Supreme Court struck down the Keating Owen child labor law. National limits waited until 1938.' },
    { id: 'polltax', name: 'Poll Taxes and Literacy Tests', cost: 3, kind: 'boss', front: 'vote', fx: [['agent', 'vote', 1, 3]],
      fact: 'Southern states charged voters a fee and gave tests that officials graded however they liked. Black voting collapsed.' },
    { id: 'jimcrow', name: 'Jim Crow Laws', cost: 2, kind: 'graft', front: 'vote', fx: [['push', 'vote', 2]],
      fact: 'After Plessy v. Ferguson in 1896 approved separate but equal, segregation laws spread across the South.' },
    { id: 'antisuff', name: 'The Anti Suffrage League', cost: 2, kind: 'spin', front: 'vote', fx: [['spin', 'vote', 2], ['push', 'vote', 1]],
      fact: 'The National Association Opposed to Woman Suffrage, founded in 1911, argued that voting would pull women away from home.' },
    { id: 'boughtvotes', name: 'Bought Votes', cost: 2, kind: 'graft', front: 'vote', fx: [['push', 'vote', 2]],
      fact: 'Before the secret ballot, a voter could be paid and then watched while he dropped a party ticket in the box.' },
    { id: 'senate', name: 'The Bosses of the Senate', cost: 4, kind: 'graft', front: 'all', fx: [['push', 'all', 1]],
      fact: 'A famous 1889 Puck cartoon showed giant trusts looming over senators, who were chosen by state legislatures until 1913.' },
    { id: 'darwin', name: 'Social Darwinism', cost: 4, kind: 'spin', front: 'all', fx: [['spin', 'all', 1]],
      fact: 'Its believers argued that the rich had earned their place and that helping the poor interfered with nature.' },
    { id: 'yellow', name: 'Yellow Journalism', cost: 2, kind: 'spin', front: 'any', fx: [['spin', 'any', 2], ['draw', 1]],
      fact: 'Hearst and Pulitzer sold papers with screaming headlines. A war scare could bury a reform story for weeks.' },
    { id: 'lobby', name: 'Lobbyists', cost: 1, kind: 'graft', front: 'none', fx: [['draw', 2]],
      fact: 'Paid lobbyists worked statehouses and Congress for railroads, oil and sugar, often with gifts and free rail passes.' }
  ];
  const KIND = {
    expose: 'Exposé', organize: 'Organizer', law: 'Law', amend: 'Amendment', special: 'Special',
    graft: 'Graft', boss: 'Boss', muscle: 'Muscle', spin: 'Spin', court: 'Court'
  };
  const BYID = {};
  R.forEach(c => { c.side = 'R'; BYID[c.id] = c; });
  M.forEach(c => { c.side = 'M'; BYID[c.id] = c; });

  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(a, rand) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const clone = o => JSON.parse(JSON.stringify(o));
  const clamp = v => Math.max(-MAXM, Math.min(MAXM, v));

  function newGame(seed) {
    const rand = rng(seed || 1);
    const st = {
      seed: seed || 1, round: 1, turn: 'R', over: false, winner: '',
      fronts: {}, deck: { R: shuffle(R.map(c => c.id), rand), M: shuffle(M.map(c => c.id), rand) },
      hand: { R: [], M: [] }, played: { R: [], M: [] }, inf: { R: 0, M: 0 }, log: [], rs: (rand() * 2 ** 31) >>> 0
    };
    FRONTS.forEach(f => { st.fronts[f.id] = { m: START_M, out: 0, laws: [], ag: { R: [], M: [] } }; });
    for (let i = 0; i < START_HAND; i++) { draw(st, 'R'); draw(st, 'M'); }
    beginTurn(st);
    return st;
  }
  function draw(st, side, n) { for (let k = 0; k < (n || 1); k++) { if (!st.deck[side].length || st.hand[side].length >= HAND_MAX) return; st.hand[side].push(st.deck[side].shift()); } }
  const shield = f => Math.min(2, f.laws.length);
  // Signed push. Machine pushes are weakened by the front's laws.
  function push(st, front, side, amt, notes) {
    const f = st.fronts[front];
    let n = amt;
    if (side === 'M') n = Math.max(0, amt - shield(f));
    const before = f.m;
    f.m = clamp(f.m + (side === 'R' ? n : -n));
    if (notes) notes.push({ front, d: f.m - before, blocked: amt - n });
    return f.m - before;
  }
  function beginTurn(st) {
    const side = st.turn;
    st.inf[side] = influenceFor(st.round);
    draw(st, side, DRAW);
    // Organizers and bosses already on the board go to work.
    const events = [];
    FRONTS.forEach(fr => {
      const f = st.fronts[fr.id];
      f.ag[side].forEach(a => { const d = push(st, fr.id, side, a.pow); events.push({ front: fr.id, id: a.id, d }); a.left--; });
      f.ag[side] = f.ag[side].filter(a => a.left > 0);
    });
    st.agentEvents = events;
  }
  function targetsFor(st, side, id) {
    const c = BYID[id];
    if (!c || c.side !== side) return [];
    if (c.cost > st.inf[side]) return [];
    if (c.kind === 'law' || c.kind === 'amend') return st.fronts[c.front].out >= c.need ? [c.front] : [];
    if (c.kind === 'court') {
      const fs = c.front === 'any' ? FRONTS.map(f => f.id) : [c.front];
      return fs.filter(fid => st.fronts[fid].laws.some(l => !BYID[l].amend && BYID[l].kind !== 'amend'));
    }
    if (c.front === 'any') return FRONTS.map(f => f.id);
    if (c.front === 'all' || c.front === 'none') return ['*'];
    if (c.fx.some(e => e[0] === 'agent')) { const f = st.fronts[c.front]; if (f.ag[side].length >= 2) return []; }
    return [c.front];
  }
  function canPlay(st, side, id) { return targetsFor(st, side, id).length > 0; }
  // Play a card. Returns a list of notes describing what happened, for the page to animate.
  function play(st, side, id, target) {
    const c = BYID[id];
    const ok = targetsFor(st, side, id);
    if (st.over || st.turn !== side || !ok.length) throw new Error('not playable');
    if (target == null || !ok.includes(target)) target = ok[0];
    st.inf[side] -= c.cost;
    st.hand[side].splice(st.hand[side].indexOf(id), 1);
    st.played[side].push(id);
    const notes = [];
    const other = side === 'R' ? 'M' : 'R';
    const fronts = t => t === 'all' ? FRONTS.map(f => f.id) : t === 'any' || t === 'target' ? [target] : [t];
    if (c.kind === 'law' || c.kind === 'amend') {
      const f = st.fronts[c.front];
      f.out -= c.need;
      f.laws.push(id);
      notes.push({ front: c.front, law: id });
    }
    c.fx.forEach(e => {
      const [op, where, a, b] = e;
      if (op === 'push') fronts(where).forEach(fr => push(st, fr, side, a, notes));
      if (op === 'out') fronts(where).forEach(fr => { const f = st.fronts[fr]; f.out = Math.min(9, f.out + a); notes.push({ front: fr, out: a }); });
      if (op === 'spin') fronts(where).forEach(fr => { const f = st.fronts[fr]; const k = Math.min(f.out, a); f.out -= k; notes.push({ front: fr, out: -k }); });
      if (op === 'agent') { st.fronts[where].ag[side].push({ id, pow: a, left: b }); notes.push({ front: where, agent: id }); }
      if (op === 'bust') { const f = st.fronts[where]; if (f.ag[other].length) { const gone = f.ag[other].sort((x, y) => y.left - x.left).shift(); notes.push({ front: where, bust: gone.id }); } }
      if (op === 'strike') {
        const fr = where === 'any' ? target : where; const f = st.fronts[fr];
        const i = f.laws.map((l, n) => [l, n]).reverse().find(([l]) => BYID[l].kind !== 'amend');
        if (i) { f.laws.splice(i[1], 1); notes.push({ front: fr, struck: i[0] }); }
      }
      if (op === 'draw') draw(st, side, where);
    });
    st.log.push({ round: st.round, side, id, target });
    return notes;
  }
  // Trade a card away for a small push. Reformers give a speech and stir up outrage on that card's front.
  // The Machine greases palms and pushes that front one step its way. Either costs 1 influence.
  function rallyFront(st, side, id) {
    const c = BYID[id];
    if (FRONTS.some(f => f.id === c.front)) return c.front;
    // cards for every front, or none, rally where it helps most
    const order = FRONTS.map(f => f.id).sort((a, b) => side === 'R' ? st.fronts[a].m - st.fronts[b].m : st.fronts[b].m - st.fronts[a].m);
    return order[0];
  }
  function canRally(st, side, id) { return !st.over && st.turn === side && st.inf[side] >= 1 && st.hand[side].includes(id); }
  function rally(st, side, id) {
    if (!canRally(st, side, id)) throw new Error('cannot rally');
    const fr = rallyFront(st, side, id);
    st.inf[side] -= 1;
    st.hand[side].splice(st.hand[side].indexOf(id), 1);
    const notes = [];
    if (side === 'R') { const f = st.fronts[fr]; f.out = Math.min(9, f.out + 1); notes.push({ front: fr, out: 1 }); }
    else push(st, fr, 'M', 1, notes);
    st.log.push({ round: st.round, side, id, rally: fr });
    return notes;
  }
  function endTurn(st) {
    if (st.over) return;
    if (st.turn === 'R') { st.turn = 'M'; beginTurn(st); return; }
    // end of round: the news cycle moves on, and big piles of outrage cool off
    FRONTS.forEach(fr => { const f = st.fronts[fr.id]; if (f.out > 4) f.out--; });
    if (st.round >= ROUNDS) { finish(st); return; }
    st.round++; st.turn = 'R'; beginTurn(st);
  }
  function tally(st) {
    let r = 0, m = 0, sum = 0;
    FRONTS.forEach(fr => { const v = st.fronts[fr.id].m; sum += v; if (v > 0) r++; else if (v < 0) m++; });
    return { r, m, sum };
  }
  function finish(st) {
    st.over = true;
    const t = tally(st);
    st.winner = t.r > t.m ? 'R' : t.m > t.r ? 'M' : t.sum > 0 ? 'R' : t.sum < 0 ? 'M' : 'draw';
  }

  /* ---------- Computer player ---------- */
  // Value of a position for the Reformers. The Machine uses the negative.
  function value(st) {
    const late = st.round / ROUNDS;
    let v = 0;
    FRONTS.forEach(fr => {
      const f = st.fronts[fr.id];
      v += f.m * (1 + late * .4);
      v += f.m > 0 ? 1.6 + late * 2 : f.m < 0 ? -1.6 - late * 2 : 0;
      v += shield(f) * 1.3;
      f.ag.R.forEach(a => { v += a.pow * Math.min(a.left, ROUNDS - st.round + 1) * .8; });
      f.ag.M.forEach(a => { v -= Math.max(0, a.pow - shield(f)) * Math.min(a.left, ROUNDS - st.round + 1) * .8; });
      v += Math.min(f.out, 5) * .45 * (1 - late * .6);
    });
    // Outrage is worth more when a law in hand can spend it.
    st.hand.R.forEach(id => { const c = BYID[id]; if (c.need) v += Math.min(st.fronts[c.front].out, c.need) / c.need * 2.2; });
    return v;
  }
  const LEVELS = { easy: { noise: 2.4, skip: .25 }, normal: { noise: .8, skip: .05 }, hard: { noise: 0, skip: 0 } };
  // Choose the next card for the side to move, or null to end the turn.
  function aiPick(st, level, rand) {
    const side = st.turn, sign = side === 'R' ? 1 : -1, L = LEVELS[level] || LEVELS.normal;
    const base = value(st) * sign;
    let best = null;
    const seen = new Set();
    st.hand[side].forEach(id => {
      if (seen.has(id)) return; seen.add(id);
      targetsFor(st, side, id).forEach(t => {
        const s2 = clone(st);
        try { play(s2, side, id, t === '*' ? undefined : t); } catch (e) { return; }
        let gain = value(s2) * sign - base;
        // spending influence well matters, so a played card is worth a little on its own
        gain += .25 + BYID[id].cost * .05 + (rand() - .5) * L.noise;
        if (BYID[id].fx.some(e => e[0] === 'draw')) gain += .6;
        if (!best || gain > best.gain) best = { id, target: t === '*' ? undefined : t, gain };
      });
    });
    // trading away a card the side cannot use soon
    st.hand[side].forEach(id => {
      if (!canRally(st, side, id)) return;
      const s2 = clone(st); rally(s2, side, id);
      const stuck = !canPlay(st, side, id) ? .35 : -.4;
      const gain = value(s2) * sign - base + stuck - BYID[id].cost * .08 + (rand() - .5) * L.noise;
      if (!best || gain > best.gain) best = { id, rally: true, gain };
    });
    if (!best || best.gain <= 0) return null;
    if (rand() < L.skip) return null;
    return best;
  }

  window.SD = { FRONTS, R, M, BYID, KIND, ROUNDS, MAXM, START_M, influenceFor, yearOf, newGame, targetsFor, canPlay, play, canRally, rally, rallyFront, endTurn, tally, value, aiPick, rng, shield };
})();
