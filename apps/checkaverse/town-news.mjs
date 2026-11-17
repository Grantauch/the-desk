// The town's memory and its news (design bible, The living world). The event log records what happens; the Gazette
// is printed from it on the first visit of each school day; residents write letters overnight; and the overnight
// director's checked lines live in a bank here. Names appear only for good news.

import fs from 'node:fs';

export function openNews(db, today) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS world_events (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, day TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS world_events_day ON world_events(day);
    CREATE TABLE IF NOT EXISTS gazette (day TEXT PRIMARY KEY, upto INTEGER NOT NULL, paper TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS mail (id INTEGER PRIMARY KEY AUTOINCREMENT, pid TEXT NOT NULL, day TEXT NOT NULL, rule TEXT NOT NULL, sender TEXT NOT NULL, text TEXT NOT NULL, unread INTEGER NOT NULL DEFAULT 1);
    CREATE INDEX IF NOT EXISTS mail_pid ON mail(pid);
    CREATE TABLE IF NOT EXISTS director_lines (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, who TEXT NOT NULL, text TEXT NOT NULL, status TEXT NOT NULL, made TEXT NOT NULL);
  `);
  const q = {
    add: db.prepare('INSERT INTO world_events (at, day, kind, data) VALUES (?, ?, ?, ?)'),
    after: db.prepare('SELECT id, day, kind, data FROM world_events WHERE id > ? AND day < ? ORDER BY id'),
    lastPaper: db.prepare('SELECT * FROM gazette WHERE day < ? ORDER BY day DESC LIMIT 1'),
    paper: db.prepare('SELECT * FROM gazette WHERE day = ?'),
    savePaper: db.prepare('INSERT OR IGNORE INTO gazette (day, upto, paper) VALUES (?, ?, ?)'),
    maxEvent: db.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM world_events WHERE day < ?'),
    addMail: db.prepare('INSERT INTO mail (pid, day, rule, sender, text) VALUES (?, ?, ?, ?, ?)'),
    mail: db.prepare('SELECT id, day, sender, text, unread FROM mail WHERE pid = ? ORDER BY id DESC LIMIT 12'),
    unread: db.prepare('SELECT COUNT(*) AS n FROM mail WHERE pid = ? AND unread = 1'),
    readAll: db.prepare('UPDATE mail SET unread = 0 WHERE pid = ?'),
    sentBefore: db.prepare('SELECT 1 FROM mail WHERE pid = ? AND rule = ? LIMIT 1'),
    lines: db.prepare("SELECT id, who, text, status FROM director_lines WHERE day = ? ORDER BY id"),
    liveLines: db.prepare("SELECT id, who, text FROM director_lines WHERE day = ? AND status = 'live' ORDER BY id"),
    addLine: db.prepare('INSERT INTO director_lines (day, who, text, status, made) VALUES (?, ?, ?, ?, ?)'),
    setLine: db.prepare('UPDATE director_lines SET status = ? WHERE id = ?'),
  };
  const parse = (r) => ({ ...r, data: JSON.parse(r.data) });
  return {
    record(kind, data) { const d = today(); q.add.run(new Date().toISOString(), d, kind, JSON.stringify(data)); },
    // Everything since the last paper, up to the end of yesterday.
    sinceLastPaper(day) { const last = q.lastPaper.get(day); return q.after.all(last ? last.upto : 0, day).map(parse); },
    paper(day) { const r = q.paper.get(day); return r ? JSON.parse(r.paper) : null; },
    savePaper(day, paper) { q.savePaper.run(day, q.maxEvent.get(day).id, JSON.stringify(paper)); return this.paper(day); },
    mail(pid) { return { letters: q.mail.all(pid), unread: q.unread.get(pid).n }; },
    addMail(pid, day, letter) { q.addMail.run(pid, day, letter.rule, letter.from, letter.text); },
    sentBefore: (pid, rule) => Boolean(q.sentBefore.get(pid, rule)),
    readAll: (pid) => q.readAll.run(pid),
    lines: (day) => q.lines.all(day),
    liveLines: (day) => q.liveLines.all(day),
    addLine(day, who, text, status) { q.addLine.run(day, who, text, status, new Date().toISOString()); },
    setLine: (id, status) => q.setLine.run(status, id),
  };
}

export function loadNewsContent(dir) {
  const read = (f) => JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'));
  const G = read('gazette.json'), M = read('mail.json');
  const bad = (m) => { throw new Error(`news content: ${m}`); };
  for (const k of ['quiet', 'deaths', 'ghost', 'catches', 'evolve', 'learn', 'wins', 'spars']) if (!G[k]?.title || !G[k]?.body) bad(`gazette.json needs ${k}`);
  const WHEN = new Set(['firstDay', 'partnerSick', 'partnerHungry', 'gymClose', 'gymNever', 'frost', 'evolveSoon', 'always']);
  if (!(M.perDay >= 1 && M.perDay <= 4)) bad('mail perDay must be 1 to 4');
  for (const r of M.rules) if (!r.id || !r.from || !WHEN.has(r.when) || !r.text) bad(`mail rule ${r.id} is incomplete`);
  return { gazette: G, mail: M };
}

const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ''));
const pick = (x, rand) => (Array.isArray(x) ? x[Math.floor(rand() * x.length)] : x);
const listNames = (names) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);
function topBy(list, key) { const c = new Map(); for (const x of list) c.set(x[key], (c.get(x[key]) || 0) + 1); return [...c].sort((a, b) => b[1] - a[1])[0] || null; }

// The paper: a lead and up to five more stories from the events, plus checked director quotes.
export function composeGazette(G, events, lines, { day, speciesName, rand = Math.random }) {
  const by = (k) => events.filter((e) => e.kind === k).map((e) => e.data);
  const stories = [];
  const deaths = by('death');
  if (deaths.length) stories.push({ title: deaths.length === 1 ? pick(G.deaths.one, rand) : fill(pick(G.deaths.title, rand), { n: deaths.length }), body: G.deaths.body, kind: 'death' });
  const ghosts = by('ghost');
  if (ghosts.length) stories.push({ title: fill(pick(G.ghost.title, rand), ghosts[0]), body: fill(G.ghost.body, { ...ghosts[0], species: speciesName(ghosts[0].species) }), kind: 'ghost' });
  const evolves = by('evolve');
  if (evolves.length) {
    const e = evolves[0];
    stories.push({ title: evolves.length === 1 ? fill(G.evolve.title[0], { trainer: e.trainer, species: speciesName(e.to) }) : fill(G.evolve.title[1], { n: evolves.length }),
      body: fill(G.evolve.body, { list: listNames([...new Set(evolves.map((x) => x.trainer))].slice(0, 4)) }), kind: 'evolve' });
  }
  const catches = by('catch');
  if (catches.length) {
    const best = [...catches].sort((a, b) => b.level - a.level)[0];
    stories.push({ title: catches.length === 1 ? G.catches.one : fill(pick(G.catches.title, rand), { n: catches.length }), body: fill(G.catches.body, { ...best, species: speciesName(best.species) }), kind: 'catch' });
  }
  const wins = by('win'), top = topBy(wins, 'trainer');
  if (top && top[1] >= 2) stories.push({ title: fill(pick(G.wins.title, rand), { trainer: top[0], n: top[1] }), body: fill(G.wins.body, { trainer: top[0] }), kind: 'win' });
  const learned = by('learn');
  if (learned.length) stories.push({ title: learned.length === 1 ? G.learn.one : fill(pick(G.learn.title, rand), { n: learned.length }), body: fill(G.learn.body, { list: listNames([...new Set(learned.map((x) => x.trainer))].slice(0, 4)) }), kind: 'learn' });
  const spars = by('spar'), champ = topBy(spars.filter((s) => s.winner), 'winner');
  if (spars.length && champ) stories.push({ title: fill(spars.length === 1 ? G.spars.one : pick(G.spars.title, rand), { n: spars.length, resident: champ[0] }), body: fill(G.spars.body, { resident: champ[0], w: champ[1], n: spars.length }), kind: 'spar' });
  if (!stories.length) stories.push({ title: G.quiet.title, body: G.quiet.body, kind: 'quiet' });
  return { masthead: G.masthead, day, stories: stories.slice(0, 6), aroundTown: G.aroundTown, quotes: lines.map((l) => ({ who: l.who, text: l.text })) };
}

// Today's letters for one trainer, from the rules in order, at most perDay, never the welcome twice.
export function composeMail(M, ctx, sentBefore) {
  const out = [];
  for (const r of M.rules) {
    if (out.length >= M.perDay) break;
    const ok = { firstDay: ctx.firstDay && !sentBefore(r.id), partnerSick: ctx.flag === 'sick', partnerHungry: ctx.flag === 'hungry',
      gymClose: Boolean(ctx.gymClose), gymNever: ctx.gymNever && !sentBefore(r.id), frost: ctx.frost, evolveSoon: ctx.evolveSoon, always: out.length === 0 }[r.when];
    if (ok) out.push({ rule: r.id, from: r.from, text: fill(r.text, { nick: ctx.nick, species: ctx.species, ...(ctx.gymClose || {}) }) });
  }
  return out;
}
