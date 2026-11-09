// Blacktop Kings gameplay: plays are decided by skill, position and timing, not dice.
// Runs the real match engine headless (canvas stubbed) with a seeded random source.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const DIR = path.join(__dirname, '../public/hubs/blacktop-kings');
const STEP = 1 / 60;

function seeded(seed) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function context() {
  const self = new Proxy(function () {}, { get: (t, k) => (k === 'measureText' ? () => ({ width: 10 }) : () => self), set: () => true });
  return self;
}
function load(seed, extra = {}) {
  const math = Object.create(Math); math.random = seeded(seed);
  const window = { BK: {}, devicePixelRatio: 1, addEventListener() {}, dispatchEvent() {} };
  const sandbox = {
    window, Math: math, console, performance: { now: () => 0 }, localStorage: extra.localStorage,
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => context() }) },
  };
  window.BK.assets = { get: () => null, board: () => 'board', fans: [], ensureCourt() {}, surface: () => 'asphalt' };
  vm.createContext(sandbox);
  for (const file of ['data.js', 'input.js', 'art-baller.js', 'art-court.js', 'fx.js', 'game-core.js', 'game-ai.js'].concat(extra.coach ? ['game-coach.js'] : [])) {
    vm.runInContext(fs.readFileSync(path.join(DIR, file), 'utf8'), sandbox, { filename: file });
  }
  return window.BK;
}
function crew(BK, quick) { return { name: quick.name, colors: quick.colors.slice(), logo: quick.logo, players: quick.members.map((id) => BK.data.LEGEND_BY_ID[id]) }; }
function match(BK, o = {}) {
  const D = BK.data;
  const events = [];
  const m = new BK.Match({ getContext: () => context(), clientWidth: 1280 }, {
    court: D.COURTS[0], target: o.target || 21, rule: 'standard', skill: o.skill == null ? 0.58 : o.skill,
    teams: [crew(BK, o.a || D.QUICK_CREWS[0]), crew(BK, o.b || D.QUICK_CREWS[1])], humans: o.humans || [],
    onEvent: (type, data) => events.push({ type, data, time: m.time }),
  });
  m.events = events;
  return m;
}
// A quiet court for one play: everybody parked at half court, ball in p's hands at (x, y).
function scene(BK, x, y) {
  const m = match(BK);
  m.phase = 'live'; m.phaseT = 0;
  m.players.forEach((q) => { q.x = 2; q.y = (q.slot - 1) * 9 + (q.team ? 3 : -3); q.vx = 0; q.vy = 0; q.want = { x: 0, y: 0 }; });
  const p = m.teams[0].players[0];
  p.x = x; p.y = y;
  m.giveBall(p, true); m.cleared = true; m.shotClock = 12;
  m.updatePlayers(STEP, false);
  return { m, p, d: m.teams[1].players[0] };
}
function until(m, types, secs) {
  for (let i = 0; i < secs / STEP; i++) {
    m.update(STEP);
    const hit = m.events.find((e) => types.includes(e.type));
    if (hit) return hit.type;
  }
  return null;
}
// Jump and let go `off` seconds from the top of the jump.
function jumper(m, p, off) {
  m.startJumpShot(p, { human: true });
  const at = p.shot.apex + off;
  for (let i = 0; i < 90 && p.state === 'shoot' && p.st + STEP < at; i++) m.update(STEP);
  m.releaseShot(p, at);
}

const BK = load(7);
const AI = BK.AI;
BK.AI = null; // single plays below have no computer brains moving people around
const C = BK.art.COURT;

// 1. A release in the green window goes in from anywhere: mid-range, the arc, the corners, and the
// 45-degree bank spots off the glass.
let spots = 0;
for (const d of [10, 14, 18, 22.5, 25]) {
  for (const deg of [-75, -45, -20, 0, 20, 45, 75]) {
    const a = deg * Math.PI / 180;
    const { m, p } = scene(BK, C.rimX - Math.cos(a) * d, Math.sin(a) * d);
    jumper(m, p, 0);
    assert.equal(p.shot && p.shot.quality, 'perfect');
    assert.equal(until(m, ['score', 'miss', 'block'], 4), 'score', `A perfect release from ${d} ft at ${deg} degrees must go in`);
    spots++;
  }
}

// 2. Misses follow the release: early comes up short off the front rim, late goes long off the back.
function firstIron(off) {
  const { m, p } = scene(BK, C.rimX - 20, 0);
  let contact = null;
  const step = m.ballStep;
  m.ballStep = function (h) { const hit = step.call(this, h); if ((hit & 3) && !contact) contact = { x: this.ball.x, hit }; return hit; };
  jumper(m, p, off);
  assert.equal(until(m, ['score', 'miss'], 4), 'miss', `A release ${off} s off the top must miss`);
  return contact;
}
const early = firstIron(-0.2), late = firstIron(0.2);
assert.ok(early && early.x < C.rimX, 'An early release must hit the front of the rim');
assert.ok(late && (late.x > C.rimX || late.hit & 2), 'A late release must hit the back of the rim or the glass');

// 3. The green window is set by ratings and shrinks under a contest. Nothing is rolled.
{
  const { m, p, d } = scene(BK, C.rimX - 23, 0);
  const open = m.shotWindow(p, p.x, p.y, 0).w;
  p.r.out = 9; const sniper = m.shotWindow(p, p.x, p.y, 0).w;
  p.r.out = 3; const brick = m.shotWindow(p, p.x, p.y, 0).w;
  assert.ok(sniper > open && open > brick, 'A better deep rating must widen the window');
  p.r.out = 6; const unguarded = m.shotWindow(p, p.x, p.y, 0).w;
  d.x = p.x + 1.8; d.y = p.y;
  assert.ok(m.shotWindow(p, p.x, p.y, 0).w < unguarded * 0.7, 'A hand in the face must shrink the window');
}

// 4. Blocks take timing and position. A defender in the shooter's face who leaves the floor with
// him gets it; the same defender jumping half a second early is on the way down and gets nothing.
function blockTry(lead) {
  const { m, p, d } = scene(BK, C.rimX - 14, 0);
  d.x = p.x + 1.75; d.y = 0; d.r.blk = 9;
  d.hgtFt = p.hgtFt + 0.6; d.reach = d.hgtFt * 1.33;
  m.jump(d, 'block');
  for (let t = 0; t < lead; t += STEP) m.updateAir(d, STEP); // left the floor `lead` seconds early
  m.startJumpShot(p, { human: true });
  const at = p.shot.apex;
  for (let i = 0; i < 90 && p.st + STEP < at && p.state === 'shoot' && !p.shot.released; i++) m.update(STEP);
  if (!p.shot.released) m.releaseShot(p, at);
  return until(m, ['score', 'miss', 'block'], 4);
}
assert.equal(blockTry(0), 'block', 'A tall defender who jumps with the shooter blocks it');
assert.notEqual(blockTry(0.5), 'block', 'A defender who jumped too early is coming down when the ball goes up');

// 5. Touching a shot on its way down is goaltending, and the basket counts.
{
  const { m, p, d } = scene(BK, C.rimX - 20, 0);
  jumper(m, p, 0);
  const b = m.ball;
  for (let i = 0; i < 240 && !(b.vz < 0 && b.z < C.rimZ + 3 && b.z > C.rimZ + 0.6); i++) m.update(STEP);
  d.x = b.x; d.y = b.y; d.state = 'block'; d.z = b.z - d.reach + 0.2; d.vz = 0;
  m.update(STEP);
  const score = m.events.find((e) => e.type === 'score');
  assert.ok(score && m.events.some((e) => e.type === 'goaltend'), 'Goaltending must award the basket');
}

// 6. Steals need a hand on an exposed ball. Reaching across the dribbler's body comes up empty
// and leaves the defender off balance; reaching at the ball side takes it.
function reach(side) {
  const { m, p, d } = scene(BK, 28, 0);
  d.r.stl = 10; // the longest arms in the game, right on top of him
  for (let i = 0; i < 40; i++) { d.x = 29.2; d.y = 1.3 * side; m.updatePlayers(STEP, false); }
  const b = m.ball; const ex = m.ballExposure(p, d);
  m.tryStealAction(d);
  for (let i = 0; i < 12; i++) m.updatePlayers(STEP, false);
  return { stolen: b.holder === d || b.state === 'loose', whiff: d.whiff, ballSide: Math.sign(b.y - p.y), reach: ex.reach };
}
const shielded = reach(1);
assert.equal(shielded.ballSide, -1, 'The dribble must move to the side away from the defender');
assert.ok(shielded.reach, 'The defender is close enough to touch the ball');
assert.equal(shielded.stolen, false, 'A reach through the body must not get the ball');
assert.equal(shielded.whiff, true, 'A whiffed reach leaves the defender off balance');
{
  // a crossover swings the ball out front: reach then and it's yours
  const { m, p, d } = scene(BK, 28, 0);
  d.x = 30.4; d.y = 0.2; d.r.stl = 9;
  m.startTrick(p, 'side', false, { x: 0, y: 1 });
  let got = false;
  for (let i = 0; i < 30 && !got; i++) {
    m.updatePlayers(STEP, false);
    const ex = m.ballExposure(p, d);
    if (ex.reach && ex.open && d.state === 'move') { m.tryStealAction(d); }
    got = m.ball.holder === d || (m.ball.state === 'loose' && m.events.some((e) => e.type === 'steal'));
  }
  assert.ok(got, 'Crossing over in front of a defender must give them a chance at the ball');
}

// 7. Ankle breakers come from a defender leaning the wrong way, not from a roll.
function shake(dvx) {
  const { m, p, d } = scene(BK, 26, 0);
  d.x = 29; d.y = 0; d.vx = 0; d.vy = dvx; d.state = 'move';
  m.startTrick(p, 'side', false, { x: 0, y: 1 });
  for (let i = 0; i < 20; i++) { d.vy = dvx; m.updateTrick(p, STEP); p.st += STEP; }
  return d.state;
}
assert.equal(shake(0), 'move', 'A defender standing square must not be shaken');
assert.ok(['stumble', 'fallen'].includes(shake(-18)), 'A defender sliding the other way at full speed must be shaken');

// 8. Rebounds go to the player in position, every time.
for (let k = 0; k < 6; k++) {
  const { m } = scene(BK, 20, 0);
  const near = m.teams[k % 2].players[1], far = m.teams[1 - (k % 2)].players[1];
  const y0 = -6 + k * 2.4;
  near.x = 37; near.y = y0; far.x = 37; far.y = y0 + 2.2;
  const b = m.ball; b.state = 'loose'; b.holder = null; b.x = 37; b.y = y0 + 0.4; b.z = 5; b.vx = 0; b.vy = 0; b.vz = 0; b.lastTeam = 0;
  for (let i = 0; i < 30 && b.state === 'loose'; i++) m.updateBall(STEP);
  assert.ok(b.holder === near, 'The closer player must come down with it');
}

// 9. Take it back: a stop inside the arc must be cleared behind the arc before it can score.
{
  const { m } = scene(BK, 20, 0);
  const d = m.teams[1].players[1]; d.x = 38; d.y = 2;
  m.giveBall(d);
  assert.equal(m.offense, 1); assert.equal(m.cleared, false);
  m.checkCleared(); assert.equal(m.cleared, false, 'Still inside the arc');
  d.x = C.rimX - C.arcR - 1.5; d.y = 0; m.checkCleared();
  assert.equal(m.cleared, true, 'Behind the arc clears it');
}

// 10. The shot clock: hold it for 12 seconds and the ball goes the other way.
{
  const { m } = scene(BK, 20, 0);
  for (let i = 0; i < 12.2 / STEP && m.phase === 'live'; i++) m.update(STEP);
  assert.ok(m.events.some((e) => e.type === 'shotClock'), 'Holding the ball must run out the shot clock');
  assert.equal(m.nextOffense, 1);
}

// 11. Whole games, computer against computer: they finish, and the box score looks like basketball.
BK.AI = AI;
const totals = { fga: 0, fgm: 0, games: 0, blocks: 0, steals: 0 };
for (let g = 0; g < 6; g++) {
  const quick = BK.data.QUICK_CREWS;
  const m = match(BK, { a: quick[g], b: quick[(g + 3) % quick.length] });
  m.phase = 'check';
  m.simulate(60 * 20);
  assert.ok(m.over, `Game ${g} must reach the target`);
  m.players.forEach((p) => { totals.fga += p.stats.fga; totals.fgm += p.stats.fgm; totals.blocks += p.stats.blk; });
  totals.steals += m.events.filter((e) => e.type === 'steal').length;
  totals.games++;
}
const fg = totals.fgm / totals.fga;
assert.ok(fg > 0.32 && fg < 0.62, `Field goal percentage ${fg.toFixed(2)} must look like basketball`);
assert.ok(totals.blocks / totals.games < 12, 'Blocks must stay a highlight, not a habit');
assert.ok(totals.steals / totals.games < 9, 'Steals must stay a highlight, not a habit');

// 12. Timing is the skill: the same crew shooting with tight releases must far outshoot sloppy ones.
function shooting(spread, seed) {
  const B = load(seed);
  let att = 0, made = 0;
  for (let g = 0; g < 3; g++) {
    const quick = B.data.QUICK_CREWS;
    const m = match(B, { a: quick[g], b: quick[g + 4] });
    m.phase = 'check';
    const start = m.startJumpShot;
    m.startJumpShot = function (p, o) { start.call(this, p, o); if (p.team === 0 && p.shot) p.shot.autoAt = Math.max(0.03, p.shot.apex + (B.Match.prototype.helpers.rand(-1, 1) + B.Match.prototype.helpers.rand(-1, 1)) * spread); };
    const launch = m.launchShot;
    m.launchShot = function (p, kind) { if (p.team === 0 && kind === 'jumper') att++; return launch.apply(this, arguments); };
    const score = m.scoreBasket;
    m.scoreBasket = function (p, kind) { if (p.team === 0 && kind === 'jumper') made++; return score.apply(this, arguments); };
    m.simulate(60 * 20);
  }
  return made / att;
}
const sharp = shooting(0.02, 11), sloppy = shooting(0.15, 11);
assert.ok(sharp - sloppy > 0.3, `Tight releases (${sharp.toFixed(2)}) must beat sloppy ones (${sloppy.toFixed(2)}) by a mile`);

// 13. The coach: a tip shows the first time it matters, in the player's own keys, and only once.
{
  const store = new Map();
  const B = load(5, { coach: true, localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) } });
  B.AI = null;
  const human = () => ({ team: 0, label: 'YOU', keyLayout: 'solo', ctrl: { state: { x: 0, y: 0 }, hit: {}, released: {}, pressT: {}, releaseT: {}, lastSource: 'keys', poll() {}, clearEdges() {} } });
  const play = () => {
    const m = match(B, { humans: [human()] });
    m.phase = 'live'; m.phaseT = 0;
    m.players.forEach((q) => { q.x = 2; q.y = (q.slot - 1) * 9 + (q.team ? 3 : -3); q.vx = 0; q.vy = 0; q.want = { x: 0, y: 0 }; });
    const p = m.teams[0].players[0]; p.x = 20; p.y = 0;
    m.giveBall(p, true); m.cleared = true; m.humans[0].player = p; m.syncHumans();
    let tip = null;
    for (let i = 0; i < 2.5 / STEP && !tip; i++) { m.update(STEP); m.time += STEP; tip = m.coach && m.coach.cur; }
    return tip;
  };
  const first = play();
  assert.ok(first && first.id === 'shoot', 'With the ball and nothing else going on, the coach explains the jumper');
  assert.ok(first.parts.some((w) => w.key === 'J'), 'The tip names the player\'s own shoot key');
  assert.ok(JSON.parse(store.get('bk-coach')).includes('shoot'), 'A tip that showed is remembered');
  const again = play();
  assert.ok(!again || again.id !== 'shoot', 'A tip only shows once');
}

console.log(`Blacktop gameplay: ${spots} perfect releases, short/long misses, rated windows, timed blocks, goaltending, shielded steals, momentum ankles, positional rebounds, take-back, shot clock, coach tips, ${totals.games} AI games (${(fg * 100).toFixed(0)}% FG) and timing skill (${(sharp * 100).toFixed(0)}% vs ${(sloppy * 100).toFixed(0)}%) passed.`);
