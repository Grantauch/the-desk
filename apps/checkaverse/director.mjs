// The overnight director (design bible, The living world). Run once a night on the home PC by Task Scheduler,
// after school hours. It copies the database first, reads yesterday's event log, and asks the local model (Ollama)
// for a short quote from a few residents about what happened in town. Every line goes through checkLine and a
// second model answer to the mock test before it is marked live. Students only ever see live lines.
// The teacher page can pause it, and a paused director does nothing at all.
//
//   node director.mjs            run tonight's pass
//   node director.mjs --dry      show what it would write, write nothing

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { openNews } from './town-news.mjs';
import { todayKey } from './accounts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(fs.readFileSync(path.join(HERE, 'content', f), 'utf8'));

// Every check a line has to pass, before the mock test. Returns '' when it passes, or the reason it failed.
export function checkLine(text, D, allowedNames) {
  if (typeof text !== 'string') return 'no text';
  const t = text.trim().replace(/^["'“”]+|["'“”]+$/g, '');
  if (t.length < 12) return 'too short';
  if (t.length > D.maxLength) return 'too long';
  if (!/^[A-Za-z0-9 ,.!?']+$/.test(t)) return 'unusual characters';
  if (/\d/.test(t)) return 'numbers';
  const lower = ` ${t.toLowerCase().replace(/[^a-z' ]/g, ' ')} `;
  for (const w of D.blocked) if (lower.includes(` ${w} `) || lower.includes(` ${w}s `)) return `blocked word ${w}`;
  // A capital letter in the middle of a sentence is a name. Only residents, species and place names are allowed.
  const words = t.split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    const w = words[i].replace(/[^A-Za-z']/g, '');
    if (/^[A-Z]/.test(w) && !/[.!?]$/.test(words[i - 1]) && !/^I('m|'ve|'ll|'d)?$/.test(w) && !allowedNames.has(w.replace(/'s$/, ''))) return `unknown name ${w}`;
  }
  return '';
}

// Plain facts about yesterday for the prompt. Counts and resident names only, never a trainer's name, and nothing
// about deaths or sickness.
export function factsFrom(events, speciesName) {
  const n = (k) => events.filter((e) => e.kind === k).length;
  const facts = [];
  if (n('catch')) facts.push(`${n('catch')} Checklings were caught in the wilds.`);
  if (n('evolve')) facts.push(`${n('evolve')} Checklings grew into new forms.`);
  if (n('learn')) facts.push(`Trainers learned ${n('learn')} new moves at the gym.`);
  if (n('win')) facts.push(`Trainers battled each other ${n('win')} times.`);
  const spars = events.filter((e) => e.kind === 'spar' && e.data.winner);
  if (spars.length) facts.push(`Residents had ${spars.length} friendly battles. ${spars.map((s) => `${s.data.winner} beat ${s.data.winner === s.data.a ? s.data.b : s.data.a}`).slice(0, 4).join('. ')}.`);
  if (!facts.length) facts.push('It was a quiet day in town.');
  return facts.join(' ');
}

async function ask(D, prompt, numPredict = 80) {
  const res = await fetch(D.url, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: D.model, prompt, stream: false, think: false, options: { num_predict: numPredict, temperature: 0.8 } }) });
  if (!res.ok) throw new Error(`model answered ${res.status}`);
  return String((await res.json()).response || '').trim();
}

export async function runDirector({ db, D, world, species, day = todayKey(), dry = false, log = console.log, rand = Math.random }) {
  const news = openNews(db, () => day);
  const paused = db.prepare("SELECT value FROM meta WHERE key = 'director:paused'").get()?.value === '1';
  if (paused) { log('The director is paused from the teacher page. Nothing written.'); return { paused: true, lines: [] }; }
  if (news.lines(day).length) { log(`Already ran for ${day}.`); return { lines: [] }; }
  const yesterday = db.prepare('SELECT kind, data FROM world_events WHERE day < ? ORDER BY id DESC LIMIT 400').all(day).map((r) => ({ kind: r.kind, data: JSON.parse(r.data) }));
  const facts = factsFrom(yesterday, (s) => species[s]?.name || s);
  const residents = [...world.residents].sort(() => rand() - 0.5).slice(0, D.quotes);
  const allowed = new Set([...world.residents.map((r) => r.name), ...Object.values(species).map((s) => s.name), 'Checkaverse', 'Checkling', 'Checklings', 'Kettle', 'Creek', 'Gazette', 'Meadow', 'Gear', 'Cosmic', 'Ember', 'Tide', 'Stone', 'Storm', 'Shade', 'Route']);
  const out = [];
  for (const r of residents) {
    const prompt = `You are ${r.name}, the ${String(r.role || 'resident').toLowerCase()} in a cozy cartoon town called the Checkaverse, where people raise creatures called Checklings. Yesterday in town: ${facts} Write one short, friendly, upbeat line (under 20 words) that ${r.name} might say to a visitor this morning about yesterday or about their own work. Do not mention anyone by name except other residents. Reply with the line only.`;
    let text = '', reason = '';
    try {
      text = (await ask(D, prompt)).split('\n')[0].trim().replace(/^["'“”]+|["'“”]+$/g, '');
      reason = checkLine(text, D, allowed);
      if (!reason) {
        const verdict = await ask(D, `${D.mockQuestion}\n\nLine: "${text}"`, 4);
        if (!/^no\b/i.test(verdict)) reason = `mock test said ${verdict.slice(0, 12) || 'nothing'}`;
      }
    } catch (err) { reason = `model unreachable: ${err.message}`; }
    out.push({ who: r.id, name: r.name, text, status: reason ? 'dropped' : 'live', reason });
    log(`${reason ? 'DROPPED' : 'live   '} ${r.name}: ${text || '(nothing)'}${reason ? `  [${reason}]` : ''}`);
  }
  if (!dry) for (const l of out) news.addLine(day, l.who, l.text || '(nothing)', l.status);
  return { lines: out };
}

// Run from the command line: copy the database, then direct.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dry = process.argv.includes('--dry');
  const DATA_DIR = process.env.CHECKAVERSE_DATA || path.resolve(HERE, '..', 'storage');
  if (!dry) {
    const b = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(HERE, 'backup.mjs')], { stdio: 'inherit', env: process.env });
    if (b.status !== 0) { console.log('The database copy failed, so the director did not run.'); process.exit(1); }
  }
  const db = new DatabaseSync(path.join(DATA_DIR, 'checkaverse.db'));
  db.exec('PRAGMA busy_timeout = 5000');
  const D = read('director.json');
  const world = read('world.json');
  const species = read(path.join('battle', 'species.json')).species;
  const r = await runDirector({ db, D, world, species, dry });
  db.close();
  console.log(r.paused ? 'Paused.' : `${r.lines.filter((l) => l.status === 'live').length} of ${r.lines.length} lines went live.`);
}
