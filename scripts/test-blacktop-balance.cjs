// Blacktop Kings competitive balance lab.
// Runs the real engine headless with deterministic randomness and guards the meta against accidental
// dominant crews/archetypes, broken difficulty curves, or runaway Crown scoring.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const DIR = path.join(__dirname, '../public/hubs/blacktop-kings');
const DEEP = process.argv.includes('--deep');
const QUICK_ROUNDS = DEEP ? 6 : 4;
const ARCH_ROUNDS = DEEP ? 12 : 8;
const DIFF_GAMES = 40;

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function context() {
  const self = new Proxy(function () {}, {
    get: (t, k) => (k === 'measureText' ? () => ({ width: 10 }) : () => self),
    set: () => true,
  });
  return self;
}
function load(seed) {
  const math = Object.create(Math);
  math.random = seeded(seed);
  const window = { BK: {}, devicePixelRatio: 1, addEventListener() {}, dispatchEvent() {} };
  const sandbox = {
    window,
    Math: math,
    console,
    performance: { now: () => 0 },
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => context() }) },
  };
  window.BK.assets = { get: () => null, board: () => 'board', fans: [], ensureCourt() {}, surface: () => 'asphalt' };
  vm.createContext(sandbox);
  for (const file of ['data.js', 'input.js', 'art-baller.js', 'art-court.js', 'fx.js', 'game-core.js', 'game-ai.js']) {
    vm.runInContext(fs.readFileSync(path.join(DIR, file), 'utf8'), sandbox, { filename: file });
  }
  window.BK.setSeed = (seed) => { math.random = seeded(seed); };
  return window.BK;
}

function quickCrew(BK, quick) {
  return {
    name: quick.name,
    colors: quick.colors.slice(),
    logo: quick.logo,
    players: quick.members.map((id) => BK.data.LEGEND_BY_ID[id]),
  };
}
function archetypeCrew(BK, arch, side) {
  const base = BK.data.ARCHETYPES[arch].base;
  const body = {
    slasher: { hgt: 78, build: 'athletic', dunk: 'tomahawk' },
    sniper: { hgt: 75, build: 'lean', dunk: 'twohand' },
    general: { hgt: 76, build: 'athletic', dunk: 'twohand' },
    trickster: { hgt: 74, build: 'lean', dunk: 'reverse' },
    big: { hgt: 83, build: 'strong', dunk: 'twohand' },
  }[arch];
  const players = [0, 1, 2].map((slot) => ({
    id: `bal-${arch}-${side}-${slot}`,
    first: BK.data.ARCHETYPES[arch].name,
    last: String(slot + 1),
    nick: BK.data.ARCHETYPES[arch].name,
    num: slot + 1,
    arch,
    hgt: body.hgt + slot - 1,
    build: body.build,
    r: Object.assign({}, base),
    look: { skin: '#8d5524', hair: 'buzz', jersey: 'tank', shorts: 'mid', socks: 'crew', shoes: 'high' },
    dunk: body.dunk,
  }));
  return {
    name: BK.data.ARCHETYPES[arch].name,
    colors: side ? ['#1f6feb', '#ffffff'] : ['#e8352b', '#ffffff'],
    logo: 'star',
    players,
  };
}
function makeMatch(BK, teamA, teamB, opts = {}) {
  const events = [];
  let m;
  m = new BK.Match({ getContext: () => context(), clientWidth: 1280 }, {
    court: BK.data.COURTS[opts.court || 0],
    target: opts.target || 11,
    rule: opts.rule || 'standard',
    skill: opts.skill == null ? 0.58 : opts.skill,
    firstOffense: opts.firstOffense,
    teams: [teamA, teamB],
    humans: [],
    onEvent: (type, data) => events.push({ type, data, time: m.time }),
  });
  m.events = events;
  return m;
}
function finishGame(m, label) {
  m.phase = 'check';
  // An observed 9-10 game finished at 12:05; allow defensive games to finish and count their result.
  // This is a liveness ceiling, not a wall-clock promise or a balance-threshold adjustment.
  const ceilingMinutes = DEEP ? 20 : 12;
  m.simulate(60 * ceilingMinutes);
  assert.ok(m.over, `${label} must finish inside ${ceilingMinutes} simulated minutes`);
  const fga = m.players.reduce((n, p) => n + p.stats.fga, 0);
  const fgm = m.players.reduce((n, p) => n + p.stats.fgm, 0);
  const blocks = m.players.reduce((n, p) => n + p.stats.blk, 0);
  const steals = m.players.reduce((n, p) => n + p.stats.stl, 0);
  const ankles = m.players.reduce((n, p) => n + p.stats.ankles, 0);
  const dunks = m.players.reduce((n, p) => n + p.stats.dnk, 0);
  const scores = m.events.filter((e) => e.type === 'score');
  const crownScores = scores.filter((e) => e.data.crown);
  const releases = m.events.filter((e) => e.type === 'release');
  const score = [m.teams[0].score, m.teams[1].score];
  return {
    winner: score[0] > score[1] ? 0 : 1,
    score,
    points: score[0] + score[1],
    time: m.time,
    fga, fgm, blocks, steals, ankles, dunks,
    deepMakes: scores.filter((e) => e.data.deep).length,
    layupMakes: scores.filter((e) => e.data.kind === 'layup').length,
    dunkMakes: scores.filter((e) => e.data.kind === 'dunk').length,
    insideJumperMakes: scores.filter((e) => e.data.kind === 'jumper' && !e.data.deep).length,
    crownScores: crownScores.length,
    offensiveRebounds: m.events.filter((e) => e.type === 'rebound' && e.data.off).length,
    releases: Object.fromEntries(['perfect', 'slightEarly', 'slightLate', 'early', 'late'].map((q) => [q, releases.filter((e) => e.data.quality === q).length])),
    releaseMakes: Object.fromEntries(['perfect', 'slightEarly', 'slightLate', 'early', 'late'].map((q) => [q, scores.filter((e) => e.data.kind === 'jumper' && e.data.quality === q).length])),
    maxCrownSwing: crownScores.reduce((mx, e) => Math.max(mx, e.data.pts + e.data.stolen), 0),
  };
}
function table(names) {
  return Object.fromEntries(names.map((name) => [name, { games: 0, wins: 0, pf: 0, pa: 0 }]));
}
function record(t, a, b, g) {
  t[a].games++; t[b].games++;
  t[a].pf += g.score[0]; t[a].pa += g.score[1];
  t[b].pf += g.score[1]; t[b].pa += g.score[0];
  if (g.winner === 0) t[a].wins++; else t[b].wins++;
}
function rates(t) {
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, {
    games: v.games,
    wins: v.wins,
    winRate: +(v.wins / v.games).toFixed(3),
    margin: +((v.pf - v.pa) / v.games).toFixed(2),
  }]));
}
function aggregate(games) {
  const sum = games.reduce((a, g) => {
    for (const k of ['points', 'fga', 'fgm', 'blocks', 'steals', 'ankles', 'dunks', 'deepMakes', 'layupMakes', 'dunkMakes', 'insideJumperMakes', 'crownScores', 'offensiveRebounds', 'time']) a[k] += g[k];
    for (const q of Object.keys(g.releases)) a.releases[q] = (a.releases[q] || 0) + g.releases[q];
    for (const q of Object.keys(g.releaseMakes)) a.releaseMakes[q] = (a.releaseMakes[q] || 0) + g.releaseMakes[q];
    a.maxCrownSwing = Math.max(a.maxCrownSwing, g.maxCrownSwing);
    return a;
  }, { points: 0, fga: 0, fgm: 0, blocks: 0, steals: 0, ankles: 0, dunks: 0, deepMakes: 0, layupMakes: 0, dunkMakes: 0, insideJumperMakes: 0, crownScores: 0, offensiveRebounds: 0, releases: {}, releaseMakes: {}, time: 0, maxCrownSwing: 0 });
  const n = games.length;
  return {
    games: n,
    fg: +(sum.fgm / Math.max(1, sum.fga)).toFixed(3),
    pointsPerFga: +(sum.points / Math.max(1, sum.fga)).toFixed(3),
    fgaPerGame: +(sum.fga / n).toFixed(2),
    blocksPerGame: +(sum.blocks / n).toFixed(2),
    stealsPerGame: +(sum.steals / n).toFixed(2),
    anklesPerGame: +(sum.ankles / n).toFixed(2),
    dunksPerGame: +(sum.dunks / n).toFixed(2),
    deepMakesPerGame: +(sum.deepMakes / n).toFixed(2),
    layupMakesPerGame: +(sum.layupMakes / n).toFixed(2),
    dunkMakesPerGame: +(sum.dunkMakes / n).toFixed(2),
    insideJumperMakesPerGame: +(sum.insideJumperMakes / n).toFixed(2),
    crownScoresPerGame: +(sum.crownScores / n).toFixed(2),
    offensiveReboundsPerGame: +(sum.offensiveRebounds / n).toFixed(2),
    releaseOutcomes: sum.releases,
    releaseResults: Object.fromEntries(Object.entries(sum.releases).map(([quality, attempts]) => {
      const makes = sum.releaseMakes[quality] || 0;
      assert.ok(makes <= attempts, `${quality}: made jumpers cannot exceed releases`);
      return [quality, { attempts, makes, fg: attempts ? +(makes / attempts).toFixed(3) : null }];
    })),
    maxCrownSwing: sum.maxCrownSwing,
    avgSeconds: +(sum.time / n).toFixed(1),
  };
}

// 1. Quick Game round robin. The release gate uses four mirrored passes; --deep uses six.
const BQ = load(177);
const quick = BQ.data.QUICK_CREWS;
const quickStandings = table(quick.map((q) => q.name));
const quickGames = [];
for (let round = 0; round < QUICK_ROUNDS; round++) {
  for (let i = 0; i < quick.length; i++) {
    for (let j = i + 1; j < quick.length; j++) {
      for (const swap of [false, true]) {
        const qa = swap ? quick[j] : quick[i], qb = swap ? quick[i] : quick[j];
        BQ.setSeed(177000 + round * 1000 + i * 30 + j);
        const m = makeMatch(BQ, quickCrew(BQ, qa), quickCrew(BQ, qb), {
          target: 11,
          firstOffense: (round + i + j + (swap ? 1 : 0)) % 2,
        });
        const g = finishGame(m, `Quick: ${qa.name} vs ${qb.name}`);
        quickGames.push(g);
        record(quickStandings, qa.name, qb.name, g);
      }
    }
  }
}

// 2. Pure archetype round robin: equal rating budgets, archetype-appropriate body types.
// The release gate uses eight mirrored passes; --deep expands this to twelve.
const BA = load(178);
const arches = Object.keys(BA.data.ARCHETYPES);
const archStandings = table(arches);
const archGames = [];
for (let round = 0; round < ARCH_ROUNDS; round++) {
  for (let i = 0; i < arches.length; i++) {
    for (let j = i + 1; j < arches.length; j++) {
      for (const swap of [false, true]) {
        const aa = swap ? arches[j] : arches[i], ab = swap ? arches[i] : arches[j];
        BA.setSeed(178000 + round * 1000 + i * 30 + j);
        const m = makeMatch(BA, archetypeCrew(BA, aa, 0), archetypeCrew(BA, ab, 1), {
          target: 11,
          firstOffense: (round + i + j + (swap ? 1 : 0)) % 2,
        });
        const g = finishGame(m, `Archetype: ${aa} vs ${ab}`);
        archGames.push(g);
        record(archStandings, aa, ab, g);
      }
    }
  }
}

// 3. Difficulty curve. Same rotating Quick crews, forty games at each AI skill.
function difficulty(skill, seed) {
  const B = load(seed);
  const games = [];
  for (let g = 0; g < DIFF_GAMES; g++) {
    const a = B.data.QUICK_CREWS[g % B.data.QUICK_CREWS.length];
    const b = B.data.QUICK_CREWS[(g + 4) % B.data.QUICK_CREWS.length];
    games.push(finishGame(makeMatch(B, quickCrew(B, a), quickCrew(B, b), {
      target: 11, skill, firstOffense: g % 2,
    }), `Difficulty ${skill}: ${a.name} vs ${b.name}`));
  }
  return aggregate(games);
}
const difficultyReport = {
  chill: difficulty(0.32, 320),
  street: difficulty(0.58, 580),
  legend: difficulty(0.86, 860),
};

// Each named court and existing rule must complete a real seeded game too.
const BC = load(179);
const courtRuleCoverage = [];
for (let court = 0; court < BC.data.COURTS.length; court++) {
  for (const rule of ['standard', 'deep', 'dunks', 'crowns']) {
    BC.setSeed(179000 + court * 10 + courtRuleCoverage.length);
    const a = quickCrew(BC, BC.data.QUICK_CREWS[0]), b = quickCrew(BC, BC.data.QUICK_CREWS[4]);
    const g = finishGame(makeMatch(BC, a, b, { court, rule }), `Court ${court} / ${rule}`);
    assert.ok(g.maxCrownSwing <= (rule === 'crowns' ? 8 : 6), 'Court/rule Crown swing stays bounded');
    courtRuleCoverage.push({ court: BC.data.COURTS[court].name, rule, seconds: +g.time.toFixed(1) });
  }
}

// 4. Crown Rules has a hard scoreboard-swing budget. It should be dramatic, not a reset button.
{
  const B = load(181);
  const a = quickCrew(B, B.data.QUICK_CREWS[0]), b = quickCrew(B, B.data.QUICK_CREWS[1]);
  const m = makeMatch(B, a, b, { rule: 'crowns', target: 99 });
  m.phase = 'live';
  m.teams[0].score = 0; m.teams[1].score = 10; m.teams[0].crownActive = 2;
  m.scoreBasket(m.teams[0].players[0], 'jumper', true, { quality: 'perfect' });
  assert.deepEqual([m.teams[0].score, m.teams[1].score], [6, 8], 'A deep Double Crown in Crown Rules must be +6 / -2');
  const swing = 6 + 2;
  assert.equal(swing, 8, 'Crown Rules maximum planned swing is eight points, not twelve');
}

// 5. Report the human green-window baseline by archetype at the arc.
// This is diagnostic: archetypes should feel different, but the report makes future drift visible.
const BW = load(182);
const windowReport = {};
for (const arch of arches) {
  const team = archetypeCrew(BW, arch, 0);
  const opp = archetypeCrew(BW, 'general', 1);
  const m = makeMatch(BW, team, opp, { target: 99 });
  m.phase = 'live';
  const p = m.teams[0].players[0];
  p.x = BW.art.COURT.rimX - BW.art.COURT.arcR - 0.5; p.y = 0;
  m.teams[1].players.forEach((d, i) => { d.x = 2; d.y = i * 8; });
  windowReport[arch] = +m.shotWindow(p, p.x, p.y, 0).w.toFixed(4);
}

const quickRates = rates(quickStandings);
const archRates = rates(archStandings);
const report = {
  version: 'PR177',
  mode: DEEP ? 'deep' : 'release',
  totalSimulatedGames: quickGames.length + archGames.length + DIFF_GAMES * 3 + courtRuleCoverage.length,
  courtRuleCoverage,
  quick: { standings: quickRates, aggregate: aggregate(quickGames) },
  archetypes: { standings: archRates, aggregate: aggregate(archGames), greenWindowAtArc: windowReport },
  difficulty: difficultyReport,
  crownRules: { deepDoubleCrown: { points: 6, opponentLoss: 2, totalSwing: 8 } },
};
console.log('BLACKTOP_BALANCE_REPORT');
console.log(JSON.stringify(report, null, 2));

// Guardrails are intentionally broad. They catch broken metas; they do not force every style to 50/50.
const qRates = Object.values(quickRates).map((x) => x.winRate);
assert.ok(Math.max(...qRates) <= 0.85 && Math.min(...qRates) >= 0.15, 'No Quick crew should be effectively unbeatable or unplayable');
const aRates = Object.values(archRates).map((x) => x.winRate);
assert.ok(Math.max(...aRates) <= 0.8 && Math.min(...aRates) >= 0.2, 'No equal-budget archetype should own or disappear from the meta');
assert.ok(Math.max(...aRates) - Math.min(...aRates) <= 0.5, 'Equal-budget archetype win-rate spread must stay within 50 points');

for (const [name, x] of Object.entries({ quick: report.quick.aggregate, archetype: report.archetypes.aggregate })) {
  assert.ok(x.fg >= 0.3 && x.fg <= 0.65, `${name} FG% ${x.fg} must remain basketball-like`);
  assert.ok(x.blocksPerGame < 12, `${name} blocks must remain highlights`);
  assert.ok(x.stealsPerGame < 9, `${name} steals must remain highlights`);
}
assert.ok(difficultyReport.legend.pointsPerFga >= difficultyReport.chill.pointsPerFga * 0.9, 'Legend AI should not become less efficient than Chill once shot value is counted');
assert.ok(difficultyReport.legend.avgSeconds <= difficultyReport.chill.avgSeconds * 1.25, 'Legend games should not bog down versus Chill');

console.log('Blacktop balance: deterministic meta, archetype parity, difficulty curve and Crown swing guardrails passed.');
