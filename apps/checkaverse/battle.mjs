// Checklings battle engine. Pure rules: no sockets, no timers, no database.
// Every species, move, type and number comes from content/battle. The server owns the state;
// browsers only draw it. Rolls come from a recorded seed, so any battle a student reports can be replayed exactly.

import fs from 'node:fs';
import path from 'node:path';

const STATS = ['hp', 'power', 'stamina', 'speed'];
// A side that spent its turn on something else, like throwing a catching charm, takes no move.
export const PASS = 'pass';
const NO_MOVE = { name: '', type: null, cost: 0 };
const TRIGGERS = new Set(['blocked', 'recover']);
const MOVE_KEYS = new Set(['name', 'type', 'cost', 'damage', 'guard', 'restore', 'shield', 'first', 'bonus', 'phases', 'detail']);

// ---------- loading and checking the content ----------
// Any mistake in the data stops the server before a student sees it.
export function loadRules(dir) {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  return checkRules({ types: read('types.json'), moves: read('moves.json').moves, species: read('species.json'), settings: read('settings.json') });
}

export function checkRules(rules) {
  const { types, moves, species, settings } = rules;
  const bad = (msg) => { throw new Error(`battle content: ${msg}`); };
  const T = types.types;
  const ids = Object.keys(T);
  if (!(types.strong > 1) || !(types.weak > 0 && types.weak < 1)) bad('strong must be above 1 and weak between 0 and 1');
  for (const id of ids) {
    const beats = T[id].beats;
    if (!Array.isArray(beats) || beats.length !== 2) bad(`${id} must beat exactly two types`);
    for (const b of beats) {
      if (!T[b]) bad(`${id} beats unknown type ${b}`);
      if (b === id) bad(`${id} cannot beat itself`);
      if (T[b].beats.includes(id)) bad(`${id} and ${b} cannot beat each other`);
    }
    const weakTo = ids.filter((o) => T[o].beats.includes(id));
    if (weakTo.length !== 2) bad(`${id} must be weak to exactly two types, it is weak to ${weakTo.length}`);
  }
  for (const [id, m] of Object.entries(moves)) {
    for (const k of Object.keys(m)) if (!MOVE_KEYS.has(k)) bad(`move ${id} has unknown field ${k}`);
    if (typeof m.name !== 'string' || !m.name) bad(`move ${id} needs a name`);
    if (m.type !== null && !T[m.type]) bad(`move ${id} has unknown type ${m.type}`);
    if (!Number.isInteger(m.cost) || m.cost < 0 || m.cost > 10) bad(`move ${id} cost must be 0 to 10`);
    const parts = m.phases || [m];
    if (m.phases && (!Array.isArray(m.phases) || m.phases.length < 2)) bad(`move ${id} phases needs two or more steps`);
    for (const ph of parts) {
      if (ph.damage !== undefined && !(ph.damage >= 0 && ph.damage <= 60)) bad(`move ${id} damage must be 0 to 60`);
      if (ph.shield !== undefined && !(ph.shield >= 0 && ph.shield <= 40)) bad(`move ${id} shield must be 0 to 40`);
    }
    if (m.guard !== undefined && !(m.guard >= 0 && m.guard < 1)) bad(`move ${id} guard must be a share below 1`);
    if (m.restore !== undefined && !(Number.isInteger(m.restore) && m.restore > 0 && m.restore <= 10)) bad(`move ${id} restore must be 1 to 10`);
    if (m.bonus && !(typeof m.bonus.counter === 'string' && m.bonus.per > 0 && m.bonus.per <= 20)) bad(`move ${id} bonus needs a counter and a per of 1 to 20`);
    if (typeof m.detail !== 'string' || !m.detail) bad(`move ${id} needs a detail line for the move button`);
  }
  if (!Number.isInteger(species.visitLevel) || species.visitLevel < 1 || species.visitLevel > 50) bad('visitLevel must be 1 to 50');
  for (const [id, s] of Object.entries(species.species)) {
    if (!/^[a-z]+$/.test(id)) bad(`species id ${id} must be lowercase letters`);
    if (!T[s.type]) bad(`species ${id} has unknown type ${s.type}`);
    for (const st of STATS) {
      if (!(s.base[st] > 0)) bad(`species ${id} needs a base ${st}`);
      if (!(s.growth[st] >= 0)) bad(`species ${id} needs a growth ${st}`);
    }
    if (!Array.isArray(s.moves) || s.moves.length < 1 || s.moves.length > 4) bad(`species ${id} knows 1 to 4 moves`);
    for (const mv of s.moves) if (!moves[mv]) bad(`species ${id} knows unknown move ${mv}`);
    if (!s.moves.some((mv) => moves[mv].cost === 0)) bad(`species ${id} needs a free move so it can never get stuck`);
    for (const tr of s.traits || []) {
      if (!TRIGGERS.has(tr.on)) bad(`species ${id} trait has unknown trigger ${tr.on}`);
      if (typeof tr.add !== 'string' || !(tr.max >= 1)) bad(`species ${id} trait needs add and max`);
    }
    // A move that spends a counter needs something that fills it, or the bonus is dead text.
    for (const mv of s.moves) {
      const b = moves[mv].bonus;
      if (b && !(s.traits || []).some((tr) => tr.add === b.counter)) bad(`species ${id} move ${mv} spends ${b.counter} but nothing fills it`);
    }
  }
  if (!(settings.turnSeconds >= 5 && settings.turnSeconds <= 120)) bad('turnSeconds must be 5 to 120');
  if (!(settings.maxTurns >= 5)) bad('maxTurns must be at least 5');
  if (!(settings.roll[0] > 0 && settings.roll[0] <= settings.roll[1] && settings.roll[1] <= 1.2)) bad('roll must be a low and high multiplier');
  return rules;
}

// ---------- helpers ----------
// Small seeded random numbers (mulberry32). Same seed, same battle.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function statsAt(rules, speciesId, level) {
  const s = rules.species.species[speciesId];
  const out = {};
  for (const st of STATS) out[st] = Math.round(s.base[st] + s.growth[st] * level);
  return out;
}

export function typeMultiplier(rules, moveType, defenderType) {
  if (!moveType) return 1;
  const T = rules.types.types;
  if (T[moveType].beats.includes(defenderType)) return rules.types.strong;
  if (T[defenderType].beats.includes(moveType)) return rules.types.weak;
  return 1;
}

// ---------- a battle ----------
// sides: [{ name, species, level }, { name, species, level }]
export function createBattle(rules, sides, seed) {
  return {
    seed: seed >>> 0,
    turn: 0,
    over: false,
    winner: null, // 0, 1, or 'draw'
    reason: '',
    sides: sides.map((s) => {
      const sp = rules.species.species[s.species];
      if (!sp) throw new Error(`unknown species ${s.species}`);
      const level = s.level || rules.species.visitLevel;
      const st = statsAt(rules, s.species, level);
      return {
        name: s.name, species: s.species, level, type: sp.type,
        hp: st.hp, maxHp: st.hp, stamina: st.stamina, maxStamina: st.stamina, power: st.power, speed: st.speed,
        counters: {}, phase: {},
      };
    }),
  };
}

export function canUse(rules, battle, side, moveId) {
  const f = battle.sides[side];
  const sp = rules.species.species[f.species];
  if (!sp.moves.includes(moveId)) return false;
  return f.stamina >= rules.moves[moveId].cost;
}

// The fallback when a trainer runs out the clock: the first free defensive move the species knows.
export function fallbackMove(rules, battle, side) {
  const sp = rules.species.species[battle.sides[side].species];
  return sp.moves.find((m) => rules.moves[m].guard !== undefined) || sp.moves.find((m) => rules.moves[m].cost === 0);
}

function bump(rules, f, on) {
  for (const tr of rules.species.species[f.species].traits || []) {
    if (tr.on === on) f.counters[tr.add] = Math.min(tr.max, (f.counters[tr.add] || 0) + 1);
  }
}

// Plays one turn. choices: [moveId for side 0, moveId for side 1]. Returns events for the screen to play in order.
export function resolveTurn(rules, battle, choices) {
  if (battle.over) throw new Error('battle is over');
  const rand = rng(battle.seed + battle.turn * 7919);
  battle.turn++;
  const events = [];
  const say = (text) => events.push({ k: 'say', text });
  const picks = choices.map((mv, i) => (mv === PASS || canUse(rules, battle, i, mv) ? mv : fallbackMove(rules, battle, i)));
  // What each side's move does this turn, phases chosen now.
  const acts = picks.map((mv, i) => {
    const m = mv === PASS ? NO_MOVE : rules.moves[mv];
    const f = battle.sides[i];
    let step = m;
    if (m.phases) { const n = f.phase[mv] || 0; step = { ...m, ...m.phases[n % m.phases.length] }; f.phase[mv] = (n + 1) % m.phases.length; }
    return { side: i, id: mv, m, step, guard: m.guard, shield: step.shield || 0 };
  });
  // Faster first. A tie is a coin flip from the seed.
  const coin = rand() < 0.5;
  const order = [0, 1].sort((a, b) => {
    const d = battle.sides[b].speed - battle.sides[a].speed;
    return d || (coin ? a - b : b - a);
  });
  const restore = (i, amount) => {
    const f = battle.sides[i];
    const got = Math.min(amount, f.maxStamina - f.stamina);
    f.stamina += got;
    events.push({ k: 'stamina', side: i, value: f.stamina, delta: got });
  };
  // Moves marked first (guard, recover, shields) act before any hit lands, whatever the speed, like a block should.
  for (const i of order) {
    const a = acts[i], f = battle.sides[i];
    if (!a.m.first) continue;
    f.stamina -= a.m.cost;
    events.push({ k: 'use', side: i, move: a.id, name: a.m.name, type: a.m.type, stamina: f.stamina });
    if (a.m.restore) restore(i, a.m.restore);
    if (a.guard !== undefined) say(`${speciesName(rules, f)} braces for the next hit.`);
    if (a.shield) say(`${speciesName(rules, f)} is shielded for ${a.shield}.`);
    if (a.m.restore && a.guard === undefined && !a.step.damage) bump(rules, f, 'recover');
  }
  // Then attacks, in speed order. A knocked out Checkling does not get its move.
  for (const i of order) {
    const a = acts[i], me = battle.sides[i], foe = battle.sides[1 - i], foeAct = acts[1 - i];
    if (me.hp <= 0 || a.id === PASS) continue;
    if (!a.m.first) {
      me.stamina -= a.m.cost;
      events.push({ k: 'use', side: i, move: a.id, name: a.m.name, type: a.m.type, stamina: me.stamina });
      if (a.m.restore) restore(i, a.m.restore);
    }
    if (!a.step.damage) continue;
    let base = a.step.damage;
    if (a.m.bonus) {
      const c = me.counters[a.m.bonus.counter] || 0;
      if (c) { base += a.m.bonus.per * c; me.counters[a.m.bonus.counter] = 0; }
    }
    const [lo, hi] = rules.settings.roll;
    const mult = typeMultiplier(rules, a.m.type, foe.type);
    let dmg = Math.max(1, Math.round(base * (me.power / 10) * mult * (lo + (hi - lo) * rand())));
    let blocked = false;
    if (foeAct.guard !== undefined) { dmg = Math.ceil(dmg * foeAct.guard); blocked = true; }
    if (foeAct.shield > 0) {
      const soak = Math.min(foeAct.shield, dmg);
      foeAct.shield -= soak; dmg -= soak; blocked = true;
    }
    if (blocked) bump(rules, foe, 'blocked');
    foe.hp = Math.max(0, foe.hp - dmg);
    events.push({ k: 'hit', side: 1 - i, dmg, hp: foe.hp, eff: mult > 1 ? 'strong' : mult < 1 ? 'weak' : null, blocked });
    if (mult > 1) say("It's a strong matchup!");
    if (mult < 1) say('It was not very strong.');
    if (foe.hp === 0) { events.push({ k: 'ko', side: 1 - i }); say(`${speciesName(rules, foe)} is knocked out!`); }
  }
  const down = battle.sides.map((s) => s.hp === 0);
  if (down[0] || down[1]) {
    end(battle, down[0] && down[1] ? 'draw' : down[0] ? 1 : 0, 'knockout');
  } else if (battle.turn >= rules.settings.maxTurns) {
    const share = battle.sides.map((s) => s.hp / s.maxHp);
    end(battle, share[0] === share[1] ? 'draw' : share[0] > share[1] ? 0 : 1, 'time');
    say('The match hit its turn limit. More health left wins.');
  }
  return { picks, events };
}

export function forfeit(battle, side, reason) {
  if (battle.over) return;
  end(battle, 1 - side, reason || 'forfeit');
}

function end(battle, winner, reason) {
  battle.over = true;
  battle.winner = winner;
  battle.reason = reason;
}

export function speciesName(rules, f) { return rules.species.species[f.species].name; }

// What the browser is allowed to see. Nothing here is secret, but it stays small.
export function view(rules, battle) {
  return {
    turn: battle.turn, over: battle.over, winner: battle.winner, reason: battle.reason,
    sides: battle.sides.map((f) => {
      const sp = rules.species.species[f.species];
      return {
        name: f.name, species: f.species, speciesName: sp.name, type: f.type, level: f.level,
        hp: f.hp, maxHp: f.maxHp, stamina: f.stamina, maxStamina: f.maxStamina, counters: { ...f.counters },
        moves: sp.moves.map((id) => {
          const m = rules.moves[id];
          const next = m.phases ? m.phases[(f.phase[id] || 0) % m.phases.length] : null;
          return { id, name: m.name, type: m.type, cost: m.cost, detail: m.detail, next: next ? next.damage : null, ok: f.stamina >= m.cost };
        }),
      };
    }),
  };
}
