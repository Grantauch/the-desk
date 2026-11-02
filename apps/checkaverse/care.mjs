// The Checkling body: care stats, conditions, diseases and death.
// Every number comes from content/care.json. This file only runs the rules, so new conditions and diseases are
// content entries, not code. Everything here is pure: the caller passes the random function, so any outcome can be
// replayed from its seed.

import fs from 'node:fs';

const STATS = ['fullness', 'hygiene', 'mood', 'health', 'weight'];
const BATTLE = ['hp', 'power', 'stamina', 'speed'];
const COUNTED = ['feed', 'treat', 'groom', 'play', 'rest', 'medicine', 'battle'];

// ---------- content ----------
export function loadCare(dir) {
  const read = (f) => JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'));
  const rules = { ...read('care.json'), calendar: read('calendar.json'), epitaphs: read('epitaphs.json').causes };
  checkCare(rules);
  return rules;
}

export function checkCare(r) {
  const bad = (m) => { throw new Error(`care content: ${m}`); };
  const isStat = (k) => STATS.includes(k);
  const chance = (c, where) => { for (const k of ['base', 'perDay', 'cap']) if (!(c?.[k] >= 0 && c[k] <= 1)) bad(`${where}.${k} must be between 0 and 1`); };
  for (const k of STATS) if (!(r.start?.[k] >= 0 && r.start[k] <= 100)) bad(`start.${k}`);
  for (const [id, a] of Object.entries(r.actions || {})) {
    if (!(Number.isInteger(a.perDay) && a.perDay > 0)) bad(`actions.${id}.perDay`);
    for (const k of Object.keys(a.effects || {})) if (!isStat(k)) bad(`actions.${id} moves unknown stat ${k}`);
    if (a.blockedBy && !r.conditions[a.blockedBy]) bad(`actions.${id}.blockedBy names an unknown condition`);
  }
  for (const [id, c] of Object.entries(r.conditions || {})) {
    const w = c.when || {};
    const kinds = ['stat', 'today', 'since'].filter((k) => w[k]);
    if (kinds.length !== 1) bad(`conditions.${id}.when needs exactly one of stat, today or since`);
    if (w.stat && !isStat(w.stat)) bad(`conditions.${id} watches unknown stat ${w.stat}`);
    if ((w.today || w.since) && !COUNTED.includes(w.today || w.since)) bad(`conditions.${id} counts unknown action`);
    if (!(Number.isFinite(w.atLeast) || Number.isFinite(w.atMost))) bad(`conditions.${id}.when needs atLeast or atMost`);
    for (const k of Object.keys(c.mods || {})) if (!BATTLE.includes(k)) bad(`conditions.${id}.mods ${k}`);
    if (c.leadsTo && !r.diseases[c.leadsTo]) bad(`conditions.${id}.leadsTo names an unknown disease`);
    if (!c.name || !c.tip) bad(`conditions.${id} needs a name and a tip`);
  }
  chance(r.diseaseRisk, 'diseaseRisk');
  for (const [id, d] of Object.entries(r.diseases || {})) {
    chance(d.death, `diseases.${id}.death`);
    if (!(Number.isInteger(d.doses) && d.doses > 0)) bad(`diseases.${id}.doses`);
    for (const k of Object.keys(d.mods || {})) if (!BATTLE.includes(k)) bad(`diseases.${id}.mods ${k}`);
    if (d.worsensTo && !r.diseases[d.worsensTo]) bad(`diseases.${id}.worsensTo`);
    if (d.needsFixed && !r.conditions[d.needsFixed]) bad(`diseases.${id}.needsFixed`);
    if (d.death.cap > 0 && !(r.epitaphs[id]?.length >= 2)) bad(`diseases.${id} can kill, so it needs at least two epitaphs`);
  }
  for (const [id, x] of Object.entries(r.rare || {})) {
    if (!(x.chance > 0 && x.chance < 1)) bad(`rare.${id}.chance`);
    if (!(r.epitaphs[id]?.length >= 2)) bad(`rare.${id} needs at least two epitaphs`);
  }
  if (!(Number.isInteger(r.egg?.hatchAfter) && r.egg.hatchAfter > 0)) bad('egg.hatchAfter');
  for (const d of Object.keys(r.calendar.noSchool || {})) if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) bad(`calendar date ${d}`);
}

// ---------- days ----------
const addDays = (day, n) => {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
};
export function isSchoolDay(r, day, extraNoSchool = () => false) {
  const c = r.calendar;
  if (day < c.start || day > c.end || c.noSchool[day] !== undefined || extraNoSchool(day)) return false;
  const [y, m, d] = day.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd !== 0 && wd !== 6;
}
// The school days strictly after `from` and strictly before `to`, which are the nights still owed.
export function owedDays(r, from, to, ok = () => true, noSchool) {
  const out = [];
  if (!from || from >= to) return out;
  for (let d = addDays(from, 1), i = 0; d < to && i < 400; d = addDays(d, 1), i++) if (isSchoolDay(r, d, noSchool) && ok(d)) out.push(d);
  return out;
}

// ---------- a body ----------
const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
export function newBody(r, day) {
  return { ...r.start, clock: day, today: { day, n: {} }, since: { rest: 0, battle: 0 }, risk: {}, disease: null, dead: '' };
}
// Old saves and odd rows heal into a full body.
export function readBody(r, json, day) {
  let b;
  try { b = JSON.parse(json || 'null'); } catch { b = null; }
  if (!b || typeof b !== 'object') return newBody(r, day);
  const n = newBody(r, b.clock || day);
  for (const k of STATS) n[k] = Number.isFinite(b[k]) ? clamp(b[k]) : n[k];
  n.today = b.today?.day ? { day: b.today.day, n: { ...b.today.n } } : n.today;
  n.since = { rest: b.since?.rest | 0, battle: b.since?.battle | 0 };
  n.risk = { ...b.risk };
  n.disease = b.disease && r.diseases[b.disease.id] ? { id: b.disease.id, days: b.disease.days | 0, doses: b.disease.doses | 0, dosed: b.disease.dosed || '' } : null;
  n.dead = typeof b.dead === 'string' ? b.dead : '';
  return n;
}
const counts = (b, day) => (b.today.day === day ? b.today.n : {});
function rollToday(b, day) { if (b.today.day < day) b.today = { day, n: {} }; }

// Which conditions hold right now, counting today's actions for `day`.
export function conditions(r, b, day) {
  const n = counts(b, day);
  const out = [];
  for (const [id, c] of Object.entries(r.conditions)) {
    const w = c.when;
    const v = w.stat ? b[w.stat] : w.today ? (n[w.today] || 0) : (b.since[w.since] || 0);
    if ((w.atLeast === undefined || v >= w.atLeast) && (w.atMost === undefined || v <= w.atMost)) out.push(id);
  }
  return out;
}

// Battle stat multipliers from everything the body is going through.
export function battleMods(r, b, day) {
  const m = { hp: 1, power: 1, stamina: 1, speed: 1 };
  const apply = (mods) => { for (const [k, v] of Object.entries(mods || {})) m[k] *= v; };
  for (const id of conditions(r, b, day)) apply(r.conditions[id].mods);
  if (b.disease) apply(r.diseases[b.disease.id].mods);
  for (const k of BATTLE) m[k] = Math.round(m[k] * 100) / 100;
  return m;
}

const move = (b, effects, sign = 1) => { for (const [k, v] of Object.entries(effects || {})) b[k] = clamp(b[k] + v * sign); };
const pct = (c, days) => Math.min(c.cap, c.base + c.perDay * Math.max(0, days - 1));

// One night of the body clock, for a school day the server was running.
// present: the student checked in that day, so the ladder can climb. Returns lines for the overnight report.
export function tick(r, b, day, present, rand) {
  const lines = [];
  if (b.dead) return lines;
  const before = { ...b };
  const held = conditions(r, b, day);
  const D = r.daily;
  // Decay. An absent day only decays down to the floors, so missing class stings but never starts trouble.
  for (const k of ['fullness', 'hygiene', 'mood']) {
    const next = b[k] + D[k];
    b[k] = present ? clamp(next) : clamp(Math.max(next, Math.min(b[k], r.absentFloor[k])));
  }
  if (b.weight !== 50) b.weight = clamp(b.weight + Math.sign(50 - b.weight) * Math.min(D.weightTowardHealthy, Math.abs(50 - b.weight)));
  if (present) {
    if (before.fullness < D.hungryBelow) b.weight = clamp(b.weight + D.hungryWeight);
    for (const id of held) { const c = r.conditions[id]; move(b, c.extraDaily); move(b, c.dailyBonus); }
    if (b.disease) move(b, r.diseases[b.disease.id].extraDaily);
  }
  const n = counts(b, day);
  for (const k of ['rest', 'battle']) b.since[k] = n[k] ? 0 : b.since[k] + (present ? 1 : 0);

  if (present) {
    // Conditions build risk. Days spent in a condition are remembered, so bouncing in and out stays risky,
    // and they fade one a day once it is fixed.
    for (const [id, c] of Object.entries(r.conditions)) {
      if (held.includes(id)) b.risk[id] = (b.risk[id] || 0) + 1;
      else if (b.risk[id]) b.risk[id] -= 1;
      if (!b.risk[id]) delete b.risk[id];
      if (held.includes(id) && c.leadsTo && !b.disease && rand() < pct(r.diseaseRisk, b.risk[id])) {
        b.disease = { id: c.leadsTo, days: 0, doses: 0, dosed: '' };
        lines.push({ k: 'sick', text: `came down with ${r.diseases[c.leadsTo].name.toLowerCase()}` });
      }
    }
    // A disease left untreated gets worse every present day, and can kill.
    if (b.disease && lines.every((l) => l.k !== 'sick')) {
      const d = r.diseases[b.disease.id];
      b.disease.days += 1;
      b.health = clamp(b.health + r.illHealth.perDay);
      if (d.worsensTo && b.disease.days >= d.worsenAfter) {
        b.disease = { id: d.worsensTo, days: 0, doses: 0, dosed: '' };
        lines.push({ k: 'sick', text: `${d.name.toLowerCase()} turned into ${r.diseases[d.worsensTo].name.toLowerCase()}` });
      } else if (rand() < pct(d.death, b.disease.days) || b.health === 0) {
        b.dead = b.disease.id;
        lines.push({ k: 'dead', text: `died of ${d.name.toLowerCase()}` });
        return lines;
      }
    }
  }
  if (!b.disease) b.health = clamp(b.health + D.healthRecover);
  rollToday(b, addDays(day, 1));
  b.clock = day;
  return lines;
}

// Short plain lines for the overnight report card: the body when the student left against the body now.
export function summary(r, a, b, day) { return report(r, a, b, conditions(r, a, day), conditions(r, b, day)); }
function report(r, a, b, was, now) {
  const out = [];
  if (b.fullness < a.fullness && b.fullness <= 35) out.push({ k: 'need', text: 'is hungry' });
  if (b.hygiene < a.hygiene && b.hygiene <= 30) out.push({ k: 'need', text: 'needs a grooming' });
  if (b.mood < a.mood && b.mood <= 30) out.push({ k: 'need', text: 'is bored' });
  if (b.weight > a.weight + 3) out.push({ k: 'body', text: 'put on weight' });
  if (b.weight < a.weight - 3) out.push({ k: 'body', text: 'got thinner' });
  for (const id of now) if (!was.includes(id) && r.conditions[id].when.stat) out.push({ k: 'cond', text: `is now ${r.conditions[id].name.toLowerCase()}` });
  for (const id of was) if (!now.includes(id) && r.conditions[id].when.stat) out.push({ k: 'good', text: `is no longer ${r.conditions[id].name.toLowerCase()}` });
  return out;
}

// ---------- care ----------
// One care action now. Returns { ok, msg, died } and changes the body.
export function act(r, b, action, day, rand, name = 'Your Checkling') {
  const say = (s) => s.replaceAll('{name}', name);
  if (b.dead) return { ok: false, msg: `${name} is gone.` };
  rollToday(b, day);
  const n = b.today.n;
  const rare = r.rare[action];
  if (rare) {
    n[action] = (n[action] || 0) + 1;
    if (rand() < rare.chance) { b.dead = action; return { ok: true, died: true, msg: `${name} ate the ${rare.name}...` }; }
    move(b, rare.otherwise);
    return { ok: true, msg: say(rare.say) };
  }
  const a = r.actions[action];
  if (!a) return { ok: false, msg: 'Unknown care.' };
  if ((n[action] || 0) >= a.perDay) return { ok: false, msg: `${name} has had enough of that today.` };
  if (a.blockedBy && conditions(r, b, day).includes(a.blockedBy)) return { ok: false, msg: `${name} is too ${r.conditions[a.blockedBy].name.toLowerCase()} to do that today.` };
  n[action] = (n[action] || 0) + 1;
  if (action === 'medicine') return medicine(r, b, day, name, say);
  const over = a.overfed && Object.entries(a.overfed.ifAtLeast).every(([k, v]) => b[k] >= v);
  move(b, a.effects);
  if (over) move(b, a.overfed.effects);
  return { ok: true, msg: say(a.say) + (over ? ` ${name} was already full, though.` : '') };
}

function medicine(r, b, day, name, say) {
  if (!b.disease) { move(b, r.overmedicated.effects); return { ok: true, msg: say(r.overmedicated.say) }; }
  const d = r.diseases[b.disease.id];
  if (b.disease.dosed === day) { move(b, r.overmedicated.effects); return { ok: true, msg: `${name} already had today's dose. Too much medicine upset its tummy.` }; }
  b.disease.dosed = day;
  b.disease.doses += 1;
  if (b.disease.doses < d.doses) {
    const left = d.doses - b.disease.doses;
    return { ok: true, msg: `${say(r.actions.medicine.say)} ${d.name} needs ${left} more ${left === 1 ? 'day' : 'days'} of medicine.` };
  }
  if (d.needsFixed && conditions(r, b, day).includes(d.needsFixed)) {
    b.disease.doses = d.doses - 1;
    return { ok: true, msg: `The medicine helps, but ${d.name.toLowerCase()} will not clear up while ${name} is still ${r.conditions[d.needsFixed].name.toLowerCase()}.` };
  }
  b.disease = null;
  return { ok: true, msg: `${name} is cured of ${d.name.toLowerCase()}!` };
}

export function noteBattle(b, day) { if (b.dead) return; rollToday(b, day); b.today.n.battle = (b.today.n.battle || 0) + 1; }

// What a student sees about one Checkling.
export function view(r, b, day) {
  const n = counts(b, day);
  return {
    stats: { fullness: b.fullness, hygiene: b.hygiene, mood: b.mood, health: b.health, weight: b.weight },
    conditions: conditions(r, b, day).map((id) => ({ id, name: r.conditions[id].name, tip: r.conditions[id].tip })),
    disease: b.disease ? { id: b.disease.id, name: r.diseases[b.disease.id].name, dosesLeft: r.diseases[b.disease.id].doses - b.disease.doses, dosedToday: b.disease.dosed === day } : null,
    actions: Object.entries(r.actions).map(([id, a]) => ({ id, label: a.label, left: a.perDay - (n[id] || 0) })),
    dead: b.dead,
  };
}

// Pick a headstone line for a cause, with the species name filled in.
export function epitaph(r, cause, name, rand) {
  const list = r.epitaphs[cause] || ['Here lies {name}. Gone too soon.'];
  return list[Math.floor(rand() * list.length) % list.length].replaceAll('{name}', name);
}

export function causeName(r, cause) {
  return r.diseases[cause]?.name || (r.rare[cause] ? `the ${r.rare[cause].name}` : cause);
}
