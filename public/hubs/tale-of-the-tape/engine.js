/* Tale of the Tape — the career engine.
   Pure game rules: no DOM. Every random roll goes through the career's own seeded generator, so a
   "same start" code really gives two players the same opening hand. app.js draws the screens. */
(function (T) {
  'use strict';
  const D = T.data;
  const E = T.engine = {};
  E.VERSION = 1;
  const WEEKS = 52;

  // ---------- seeded randomness ----------
  function hash(str) {
    let h1 = 0xdeadbeef ^ str.length, h2 = 0x41c6ce57 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    return h1 >>> 0;
  }
  function rnd(s) {
    let t = (s.rs = (s.rs + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const between = (s, a, b) => a + rnd(s) * (b - a);
  const int = (s, a, b) => Math.floor(between(s, a, b + 1));
  const pick = (s, arr) => arr[Math.floor(rnd(s) * arr.length)];
  const chance = (s, p) => rnd(s) < p;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const logistic = (x) => 1 / (1 + Math.exp(-x));
  function weighted(s, items) {
    const total = items.reduce((n, it) => n + Math.max(0, it.w), 0);
    if (total <= 0) return null;
    let r = rnd(s) * total;
    for (const it of items) { r -= Math.max(0, it.w); if (r <= 0) return it.v; }
    return items[items.length - 1].v;
  }
  E.util = { hash, rnd, between, int, pick, chance, clamp, weighted };

  E.makeCode = function (seedNumber) {
    const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
    let n = seedNumber >>> 0, word = '';
    for (let i = 0; i < 3; i++) { word += letters[n % letters.length]; n = Math.floor(n / letters.length); }
    return word + '-' + String(1000 + (seedNumber % 9000)).padStart(4, '0');
  };
  E.normalizeCode = (code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

  // ---------- calendar ----------
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  E.year = (t) => D.START_YEAR + Math.floor(t / WEEKS);
  E.month = (t) => Math.min(11, Math.floor(((t % WEEKS) / WEEKS) * 12));
  E.weekOf = (y, m, day = 1) => (y - D.START_YEAR) * WEEKS + Math.floor((m * WEEKS) / 12 + ((day - 1) / 31) * (WEEKS / 12));
  E.dateLabel = (t) => `${MONTHS[E.month(t)]} ${E.year(t)}`;
  E.shortDate = (t) => `${MON[E.month(t)]} ${E.year(t)}`;
  E.age = (s) => E.year(s.t) - s.f.born;
  E.era = (t) => { const y = E.year(t); return D.ERAS.find((e) => y >= e.from && y < e.to) || D.ERAS[D.ERAS.length - 1]; };
  E.eraMoney = (t) => { const y = E.year(t); return y < 1942 ? 1 : y < 1946 ? 1.3 : y < 1950 ? 1.75 : y < 1956 ? 2.1 : 2.4; };
  E.tvEra = (t) => E.year(t) >= 1949;

  // ---------- game length ----------
  // Every length covers the same history. Shorter games take bigger steps, so each turn,
  // camp and fight carries more weight: more months pass, and every fight counts for more.
  E.PACES = {
    short: { name: 'Short', time: 'about 30 minutes', blurb: 'Each turn is a season. One plan per camp. Only the moments that change your life.', months: 3, kf: 2.5, ek: 2, camp: 'plan', hist: 'major', turn: 'this season', per: 'one season', last: 'Last season' },
    standard: { name: 'Standard', time: 'about an hour', blurb: 'Two months at a time. The whole story with less waiting.', months: 2, kf: 1.7, ek: 1.5, camp: 'plan', hist: 'choices', turn: 'the next two months', per: 'two months', last: 'The last two months' },
    full: { name: 'Full', time: 'a few hours, saved as you go', blurb: 'Month by month. Every week of camp, every headline.', months: 1, kf: 1, ek: 1, camp: 'steps', hist: 'all', turn: 'this month', per: 'one month', last: 'Last month' },
  };
  E.pace = (s) => E.PACES[s && s.pace] || E.PACES.full;
  // A fight-count goal at this length ("twenty fights" in a full career is about eight in a short one).
  E.nf = (s, n) => Math.max(1, Math.round(n / E.pace(s).kf));
  // Fights so far, counted the way a full-length career would count them.
  E.fx = (s) => s.fights.length * E.pace(s).kf;

  // ---------- names and fighters ----------
  function fullName(p) { return p.nick ? `${p.first} "${p.nick}" ${p.last}` : `${p.first} ${p.last}`; }
  E.fullName = fullName;
  E.shortName = (p) => p.last;
  function freshName(s, taken) {
    for (let i = 0; i < 40; i++) {
      const first = pick(s, D.FIRST), last = pick(s, D.LAST), n = `${first} ${last}`;
      if (!D.AVOID.some((a) => n.includes(a)) && !taken.has(n)) { taken.add(n); return { first, last }; }
    }
    return { first: pick(s, D.FIRST), last: pick(s, D.LAST) + ' Jr.' };
  }
  function randomLook(s) {
    return { skin: int(s, 0, D.SKINS.length - 1), hair: int(s, 0, D.HAIRS.length - 1), cut: pick(s, D.HAIRCUTS), trunks: int(s, 0, D.TRUNKS.length - 1), stache: chance(s, 0.28), brow: int(s, 0, 2), build: between(s, 0.9, 1.12), jaw: between(s, 0.9, 1.15), nose: int(s, 0, 2) };
  }
  function opponentStats(rating, style) {
    const m = D.STYLES[style] ? D.STYLES[style].mods : { pow: 0, spd: 0, sta: 0, chn: 0, def: 0 };
    const f = (k) => clamp(Math.round(rating + m[k] * 0.8), 8, 99);
    return { pow: f('pow'), spd: f('spd'), sta: f('sta'), chn: f('chn'), def: f('def') };
  }
  function makeFighter(s, taken, opts = {}) {
    const nm = freshName(s, taken);
    const style = opts.style || pick(s, ['slugger', 'boxer', 'swarmer', 'counter', 'slugger', 'boxer', 'swarmer', 'counter', 'dirty', 'showman']);
    const div = D.DIVISIONS[s.f.division];
    const rating = opts.rating != null ? opts.rating : int(s, 30, 80);
    const city = pick(s, D.ROAD).city;
    return {
      id: s.world ? s.world.nextId++ : opts.id,
      first: nm.first, last: nm.last, nick: chance(s, 0.6) ? pick(s, D.NICKS) : '',
      city, style, rating, age: opts.age || int(s, 20, 31), active: true,
      w: 0, l: 0, d: 0, ko: 0, elo: 0, look: randomLook(s), quirk: pick(s, D.QUIRKS), trash: pick(s, D.TRASH),
      height: int(s, div.height[0], div.height[1]), reach: int(s, div.reach[0], div.reach[1]), vsYou: { w: 0, l: 0, d: 0 },
    };
  }
  function seedRecord(s, f) {
    const fights = Math.max(4, Math.round((f.age - 18) * between(s, 3, 7)));
    const winRate = clamp(0.35 + f.rating / 120 + between(s, -0.1, 0.1), 0.3, 0.97);
    f.w = Math.round(fights * winRate); f.d = Math.round(fights * between(s, 0, 0.06)); f.l = Math.max(0, fights - f.w - f.d);
    f.ko = Math.round(f.w * between(s, 0.2, 0.7));
    f.elo = 1000 + f.rating * 10 + int(s, -40, 40);
  }

  function makeWorld(s) {
    s.world = { fighters: [], champId: null, nextId: 1, lastDefense: 0, news: [] };
    const taken = new Set([`${s.f.first} ${s.f.last}`]);
    s._taken = taken;
    for (let i = 0; i < 22; i++) {
      const rating = Math.round(32 + (i / 21) * 48 + between(s, -3, 3));
      const f = makeFighter(s, taken, { rating, age: int(s, 21, 32) });
      seedRecord(s, f); s.world.fighters.push(f);
    }
    // The rival: a kid your age who is a little ahead of you.
    const rival = makeFighter(s, taken, { rating: 40, age: E.age(s) + int(s, 0, 1), style: pick(s, ['slugger', 'boxer', 'swarmer', 'counter']) });
    rival.w = int(s, 3, 6); rival.l = 0; rival.d = 0; rival.ko = int(s, 1, rival.w); rival.elo = 1300; rival.rival = true; rival.growth = 4.2;
    s.world.fighters.push(rival);
    s.people.rival = rival.id;
    const champ = s.world.fighters.reduce((a, b) => (a.rating > b.rating ? a : b));
    s.world.champId = champ.id; champ.w += 6; champ.elo += 120;
    delete s._taken;
  }
  E.opponentStats = opponentStats;
  E.fighterById = (s, id) => s.world.fighters.find((f) => f.id === id);
  E.rival = (s) => E.fighterById(s, s.people.rival);
  E.champion = (s) => (s.champ ? null : E.fighterById(s, s.world.champId));

  // Rankings: everyone active but the champion, by Elo. The player is in the list as id 0.
  E.rankings = function (s) {
    const list = s.world.fighters.filter((f) => f.active && f.id !== s.world.champId).map((f) => ({ id: f.id, elo: f.elo, f }));
    if (!s.champ && !s.retired) list.push({ id: 0, elo: s.elo, f: null });
    list.sort((a, b) => b.elo - a.elo);
    return list;
  };
  E.playerRank = function (s) {
    if (s.champ) return 0;
    const i = E.rankings(s).findIndex((r) => r.id === 0);
    return i < 0 ? null : i + 1;
  };
  E.rankOf = function (s, id) {
    if (id === s.world.champId && !s.champ) return 0;
    const i = E.rankings(s).findIndex((r) => r.id === id);
    return i + 1;
  };

  // ---------- the player ----------
  E.create = function (o) {
    const code = o.code ? E.normalizeCode(o.code) : '';
    const seedNum = code ? hash(code) : (o.seedNumber != null ? o.seedNumber : (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    const displayCode = code ? o.code.toUpperCase().trim() : E.makeCode(seedNum);
    const s = { v: E.VERSION, rs: seedNum >>> 0, code: displayCode, t: 0, phase: 'between' };
    const bg = D.BACKGROUNDS[o.bg] || D.BACKGROUNDS.newsboy, style = D.STYLES[o.style] || D.STYLES.slugger;
    const div = D.DIVISIONS[o.division] ? o.division : 'welter';
    s.f = {
      first: (o.first || 'Johnny').slice(0, 18), last: (o.last || 'Doyle').slice(0, 22), nick: (o.nick || '').slice(0, 20),
      home: D.CITIES[o.home] ? o.home : 'detroit', division: div, style: D.STYLES[o.style] ? o.style : 'slugger', bg: D.BACKGROUNDS[o.bg] ? o.bg : 'newsboy',
      look: Object.assign({ skin: 2, hair: 0, cut: 'slick', trunks: 0, stache: false, brow: 0, build: 1, jaw: 1, nose: 0 }, o.look || {}),
      born: D.START_YEAR - bg.age, height: 0, reach: 0,
    };
    const dv = D.DIVISIONS[div];
    s.f.height = int(s, dv.height[0], dv.height[1]); s.f.reach = s.f.height + int(s, 0, 4);
    const base = 32;
    const st = {};
    for (const k of ['pow', 'spd', 'sta', 'chn', 'def']) st[k] = base + (style.mods[k] || 0) + (bg.mods[k] || 0) + int(s, -3, 3);
    s.st = st;
    s.health = 100; s.heart = clamp(60 + (bg.mods.heart || 0), 0, 100); s.sharp = clamp(25 + (bg.mods.sharp || 0), 0, 100);
    s.fame = bg.mods.fame || 0; s.rep = 0; s.money = 20 + (bg.mods.money || 0) + int(s, 0, 15);
    s.elo = 1050 + (bg.mods.sharp ? 60 : 0);
    s.injury = null; s.champ = false; s.retired = false; s.titleDefenses = 0; s.belts = 0;
    s.rec = { w: 0, l: 0, d: 0, ko: 0, kod: 0, streak: 0 };
    s.fights = []; s.flags = {}; s.c = { trainStreak: 0, earned: 0, idle: 0, actions: 0, played: 0, events: 0 };
    s.perks = []; s.gear = {}; s.lessons = 0; s.ambition = E.AMBITIONS[o.ambition] ? o.ambition : null;
    s.pace = E.PACES[o.pace] ? o.pace : 'full'; s.why = {};
    s.queue = []; s.seen = {}; s.hist = {}; s.journal = []; s.story = []; s.inbox = []; s.offers = null; s.camp = null; s.service = null; s.after = null; s.ach = [];
    s.city = s.f.home;
    s.people = {
      trainer: Object.assign({ loyalty: 60 }, pick(s, D.TRAINERS)),
      manager: Object.assign({ loyalty: 60 }, pick(s, D.MANAGERS)),
      reporter: pick(s, D.REPORTERS),
      partner: { name: 'Hollis "Deacon" Tate', status: 'gym' },
      family: { name: pick(s, ['Ma', 'Mom', 'Mother', 'Mama']), sent: 0 },
      sweetheart: null,
    };
    makeWorld(s);
    const city = D.CITIES[s.f.home];
    note(s, `You walk into ${city.gym} in ${city.name} with ${money(s.money)} in your pocket. ${s.people.trainer.name} looks you over. "${s.people.trainer.line}"`, 'life');
    remember(s, 'start', `I started boxing in ${city.name} in ${D.START_YEAR}`);
    // History that already happened before the first week becomes background, not a pop-up.
    queueHistory(s);
    return s;
  };

  E.validate = function (s) {
    return !!(s && s.v === E.VERSION && s.f && s.st && s.world && Array.isArray(s.world.fighters) && typeof s.t === 'number' && Array.isArray(s.fights));
  };

  // ---------- journal & story ----------
  function note(s, text, kind = 'life') {
    s.journal.push({ t: s.t, text, kind });
    if (s.journal.length > 400) s.journal.splice(0, s.journal.length - 400);
  }
  function remember(s, key, text, weight = 1) { s.story.push({ t: s.t, key, text, weight, age: E.age(s) }); }
  E.note = note; E.remember = remember;
  function money(n) { return (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US'); }
  E.money = money;

  // ---------- derived numbers ----------
  E.overall = function (s) {
    const st = s.st;
    let o = (st.pow + st.spd * 1.05 + st.sta * 0.85 + st.chn * 0.85 + st.def) / 4.75;
    o *= 0.72 + 0.28 * (s.health / 100);
    o += (s.sharp - 50) / 12 + (s.heart - 50) / 25;
    if (s.injury) o -= s.injury.penalty || 4;
    return o;
  };
  E.oppOverall = (f) => f.rating;
  E.statLabel = { pow: 'Power', spd: 'Speed', sta: 'Stamina', chn: 'Chin', def: 'Defense' };

  E.rankLabel = function (s) {
    if (s.retired) return 'Retired';
    if (s.champ) return 'World Champion';
    const r = E.playerRank(s);
    if (r && r <= 10) return `#${r} contender`;
    if (s.rec.w + s.rec.l + s.rec.d === 0) return 'Unknown';
    if (s.elo > 1350) return 'Up-and-comer';
    if (s.elo > 1200) return 'Club fighter';
    return 'Prelim kid';
  };
  E.addFame = function (s, n) { s.fame = clamp(s.fame + (n > 0 ? n * (1 - s.fame / 115) : n), 0, 100); };
  E.fameLabel = (f) => (f < 5 ? 'Nobody' : f < 15 ? 'Local name' : f < 30 ? 'Known in town' : f < 50 ? 'Headliner' : f < 70 ? 'National name' : f < 88 ? 'Household name' : 'Legend');
  E.monthlyCost = function (s) {
    let c = (s.retired ? 30 + s.fame * 0.2 : 22 + s.fame * 0.7) * E.eraMoney(s.t);
    if (s.flags.family) c += 20 * E.eraMoney(s.t);
    if (s.flags.highlife) c *= 1.6;
    if (s.flags.frugal) c *= 0.75;
    if (E.hasPerk(s, 'frugal')) c *= 0.85;
    if (E.hasGear(s, 'house')) c *= 0.85;
    return Math.round(c + (s.retired ? 0 : E.upkeep(s)));
  };

  // ---------- time ----------
  // Advance a number of weeks. Month-boundary bookkeeping happens inside.
  function tick(s, weeks, mode) {
    for (let i = 0; i < weeks; i++) {
      const before = E.month(s.t), yearBefore = E.year(s.t);
      s.t++;
      if (s.injury) {
        s.injury.weeks -= (mode === 'rest' ? 2 : 1) * (E.hasPerk(s, 'healer') ? 1.5 : 1);
        if (s.injury.weeks <= 0) { note(s, `The ${s.injury.name} has healed.`, 'good'); s.injury = null; }
      }
      if (E.month(s.t) !== before) monthly(s, mode);
      if (E.year(s.t) !== yearBefore) yearly(s);
    }
    queueHistory(s);
    queueScheduled(s);
  }
  function monthly(s, mode) {
    if (s.phase === 'service') { s.money += 50 * E.eraMoney(s.t); }
    else {
      const cost = E.monthlyCost(s);
      s.money -= cost;
    }
    if (s.people.family.allowance) { const a = Math.round(10 * E.eraMoney(s.t)); s.money -= a; s.people.family.sent += a; }
    if (mode !== 'fight' && mode !== 'spar') s.sharp = clamp(s.sharp - 3, 0, 100);
    if (s.health < 100) s.health = clamp(s.health + (mode === 'rest' ? 4 : 1.2) + (E.hasPerk(s, 'healer') ? 1 : 0), 0, 100);
    if (s.fame > (s.flags.max_fame || 0)) s.flags.max_fame = s.fame;
    s.c.months = (s.c.months || 0) + 1;
    if (s.fame > 20 && mode !== 'fight') s.fame = clamp(s.fame - (s.retired ? 0.15 : 0.35), 0, 100);
    if (!s.retired && s.phase !== 'service') worldMonth(s);
    if (s.money < 0) s.flags.was_broke = true;
    if (s.money < 0 && !s.flags.debt_warned && !s.retired) { s.flags.debt_warned = true; schedule(s, 'broke', 0, 1); }
    if (s.money >= 0) s.flags.debt_warned = false;
  }
  function yearly(s) {
    const age = E.age(s);
    if (!s.retired) {
      // Prime is 24 to 29. After 30 the legs go first, then the reflexes, then the chin.
      if (age >= 30) {
        const k = (age >= 35 ? 4 : age >= 33 ? 2.8 : age >= 31 ? 1.8 : 1) * (E.hasPerk(s, 'oldpro') ? 0.6 : 1);
        s.st.spd -= k * between(s, 0.8, 1.3); s.st.sta -= k * between(s, 0.6, 1.2); s.st.def -= k * 0.4;
        if (age >= 33) s.st.chn -= k * 0.8;
        note(s, `You turn ${age}. ${age >= 34 ? 'Mornings hurt now.' : 'A step slower on the stairs, but who is counting?'}`, 'life');
      } else if (age <= 24) {
        s.st.pow += 0.8; s.st.chn += 0.4;
      }
      for (const k in s.st) s.st[k] = clamp(s.st[k], 5, 99);
    }
    // World fighters age too.
    for (const f of s.world.fighters) {
      if (!f.active) continue;
      f.age++;
      const g = f.growth || 2.5;
      if (f.age <= 27) f.rating += between(s, 0.5, g);
      else if (f.age >= 31) f.rating -= between(s, 1, f.age >= 34 ? 5 : 3);
      f.rating = clamp(f.rating, 15, 96);
    }
  }

  // The rest of the division lives its own life.
  function worldMonth(s) {
    const W = s.world, act = W.fighters.filter((f) => f.active && f.id !== W.champId);
    for (const f of act) {
      if (!chance(s, 0.28)) continue;
      const near = act.filter((o) => o !== f && Math.abs(o.elo - f.elo) < 160);
      const o = near.length ? pick(s, near) : null;
      if (o && chance(s, 0.6)) bout(s, f, o, false);
      else { // a tune-up against nobody
        const won = chance(s, clamp(0.55 + f.rating / 200, 0.4, 0.95));
        if (won) { f.w++; if (chance(s, 0.5)) f.ko++; f.elo += 6; } else { f.l++; f.elo -= 18; }
      }
    }
    // Title defenses when the belt is not yours.
    const champ = E.fighterById(s, W.champId);
    if (champ && !s.champ && s.t - W.lastDefense > 20 && chance(s, 0.22)) {
      const ranks = E.rankings(s).filter((r) => r.id !== 0).slice(0, 3);
      if (ranks.length) {
        const challenger = pick(s, ranks).f;
        const champWon = bout(s, champ, challenger, true);
        W.lastDefense = s.t;
        if (!champWon) {
          W.champId = challenger.id;
          worldNews(s, `NEW CHAMPION! ${fullName(challenger).toUpperCase()} TAKES THE ${D.DIVISIONS[s.f.division].name.toUpperCase()} CROWN FROM ${champ.last.toUpperCase()}`);
          if (challenger.id === s.people.rival) { worldNews(s, `Your rival ${challenger.last} is the champion of the world. Reporters want your reaction.`); s.flags.rival_champ = true; }
        } else if (chance(s, 0.5)) worldNews(s, `${champ.last} keeps the title, beating ${challenger.last}.`);
      }
    }
    if (!champ || !champ.active) { // vacant title goes to the top contender
      const top = E.rankings(s).find((r) => r.id !== 0);
      if (top && !s.champ) { W.champId = top.id; worldNews(s, `The vacant title goes to ${fullName(top.f)}.`); }
    }
    // Retirements and new blood.
    for (const f of W.fighters) {
      if (!f.active || f.id === s.people.rival && E.age(s) < 33) continue;
      if ((f.age >= 33 && chance(s, 0.03 + (f.age - 33) * 0.02)) || (f.rating < 24 && chance(s, 0.08))) {
        f.active = false;
        if (f.id === W.champId) { worldNews(s, `Champion ${fullName(f)} retires. The title is vacant.`); }
        else if (f.vsYou && (f.vsYou.w + f.vsYou.l) > 0 && chance(s, 0.6)) worldNews(s, `${fullName(f)}, who fought you ${f.vsYou.w + f.vsYou.l + f.vsYou.d === 1 ? 'once' : (f.vsYou.w + f.vsYou.l + f.vsYou.d) + ' times'}, hangs up the gloves.`);
        const taken = new Set(W.fighters.map((x) => `${x.first} ${x.last}`));
        const kid = makeFighter(s, taken, { rating: int(s, 40, 62), age: int(s, 19, 23) });
        kid.growth = between(s, 2, 4.5);
        kid.w = int(s, 3, 9); kid.ko = int(s, 1, kid.w); kid.l = int(s, 0, 1); kid.elo = 1000 + kid.rating * 10;
        W.fighters.push(kid);
      }
    }
    if (W.fighters.length > 60) W.fighters = W.fighters.filter((f) => f.active || f.vsYou.w + f.vsYou.l + f.vsYou.d > 0 || f.id === s.people.rival);
  }
  function bout(s, a, b, title) {
    const pa = logistic((a.rating - b.rating) / 8 + (title ? 0.15 : 0));
    const aWon = chance(s, pa);
    const w = aWon ? a : b, l = aWon ? b : a;
    w.w++; l.l++; if (chance(s, 0.45)) w.ko++;
    const exp = 1 / (1 + Math.pow(10, (l.elo - w.elo) / 400));
    w.elo += 32 * (1 - exp); l.elo -= 32 * (1 - exp);
    return aWon;
  }
  function worldNews(s, text) { s.world.news.unshift({ t: s.t, text }); s.world.news.length = Math.min(s.world.news.length, 30); note(s, text, 'world'); }
  E.worldNews = worldNews;

  E.passWeeks = function (s, n, mode) { tick(s, n, mode || 'rest'); };
  E.unretire = function (s) {
    s.retired = false; s.phase = 'between'; s.after = null; s.offers = null;
    s.sharp = 0; s.elo = Math.max(1150, s.elo - 120);
    s.st.spd = clamp(s.st.spd - 3, 5, 99); s.st.sta = clamp(s.st.sta - 3, 5, 99);
    s.flags.forced_doc = false; s.c.comebacks = (s.c.comebacks || 0) + 1;
  };

  // ---------- events plumbing ----------
  function schedule(s, id, minWeeks, maxWeeks, data) {
    s.queue.push({ id, at: s.t + int(s, minWeeks, Math.max(minWeeks, maxWeeks)), data: data || null, because: s.ctx || null });
  }
  E.schedule = schedule;
  function queueScheduled(s) {
    const due = s.queue.filter((q) => q.at <= s.t);
    s.queue = s.queue.filter((q) => q.at > s.t);
    for (const q of due) {
      const ev = T.eventById(q.id);
      if (ev && (!ev.when || ev.when(s, q.data))) s.inbox.push({ id: q.id, data: q.data, kind: 'event', because: q.because || null });
    }
  }
  function queueHistory(s) {
    for (const h of T.history) {
      if (s.hist[h.id]) continue;
      const at = E.weekOf(h.y, h.m, h.d || 1);
      if (s.t >= at) {
        s.hist[h.id] = s.t;
        if (at < 2 && s.t < 2) continue; // before the career started
        if (h.when && !h.when(s)) continue;
        if (featured(s, h)) s.inbox.push({ id: h.id, kind: 'history' });
        else digest(s, h);
      }
    }
    printNews(s);
  }
  // Shorter games keep the headlines that ask something of you. The rest share one front page.
  const MAJOR = new Set(['h_dust', 'h_schmeling2', 'h_pearl', 'h_double_v', 'h_jackie', 'h_louis_retires', 'h_tv', 'h_brown', 'h_montgomery', 'h_kefauver']);
  function histChoices(s, h) { return (typeof h.choices === 'function' ? h.choices(s, E.api(s)) : h.choices) || []; }
  function featured(s, h) {
    const mode = E.pace(s).hist;
    if (mode === 'all') return true;
    if (histChoices(s, h).length < 2) return false;
    return mode === 'choices' || MAJOR.has(h.id);
  }
  function digest(s, h) {
    const x = E.api(s), val = (v) => (typeof v === 'function' ? v(s, x) : v);
    const ch = histChoices(s, h);
    // A headline with only one possible response still happens to you.
    if (ch.length === 1 && ch[0].go) ch[0].go(x); else if (!ch.length && h.go) h.go(x);
    s.seen[h.id] = s.t;
    s.newsDesk = s.newsDesk || [];
    s.newsDesk.push({ id: h.id, title: val(h.title), text: val(h.text), kicker: val(h.kicker) || '', archive: val(h.archive) || '', link: h.link || null, when: s.t });
  }
  // The front page goes out once a few stories pile up, or once the oldest is a year old.
  function printNews(s) {
    const desk = s.newsDesk;
    if (!desk || !desk.length || (desk.length < 5 && s.t - desk[0].when < 104)) return;
    let page = s.inbox.find((i) => i.kind === 'digest');
    if (!page) { page = { id: 'digest', kind: 'digest', entries: [] }; s.inbox.push(page); }
    page.entries.push(...desk.splice(0)); delete page.cache;
  }
  // A random event happens with a chance that grows with fame and trouble.
  function rollRandom(s, base) {
    const p = base + s.fame / 400 + (s.flags.mob_heat ? 0.05 : 0) + (s.money < 0 ? 0.08 : 0);
    if (!chance(s, p)) return;
    const pool = [];
    for (const ev of T.events) {
      if (ev.chain || ev.scheduledOnly) continue;
      if (ev.after) { if (s.phase !== 'after' || !s.after || (ev.after !== 'any' && ev.after !== s.after.path)) continue; }
      else if (ev.phase) { if (ev.phase !== s.phase) continue; }
      else if (s.phase !== 'between' && s.phase !== 'camp') continue;
      if (ev.from && E.year(s.t) < ev.from) continue;
      if (ev.to && E.year(s.t) > ev.to) continue;
      const last = s.seen[ev.id];
      if (last != null && (!ev.repeat || s.t - last < ev.repeat * (ev.steady ? 1 : E.pace(s).months))) continue;
      if (ev.when && !ev.when(s)) continue;
      const w = typeof ev.weight === 'function' ? ev.weight(s) : ev.weight != null ? ev.weight : 1;
      if (w > 0) pool.push({ v: ev, w });
    }
    const ev = weighted(s, pool);
    if (ev) s.inbox.push({ id: ev.id, kind: 'event' });
  }
  E.rollRandom = rollRandom;

  // Effects API handed to event choices. Everything an event can do to a career lives here.
  // k scales how much an event choice moves your stats, fame and standing. Shorter games have fewer
  // events, so each one counts for more. Money stays as written, because choices show their prices.
  E.api = function (s, data, k = 1) {
    const x = {
      s, data, E, D, rnd: () => rnd(s), int: (a, b) => int(s, a, b), pick: (arr) => pick(s, arr), chance: (p) => chance(s, p),
      money(n) { n = Math.round(n * (Math.abs(n) > 3 ? E.eraMoney(s.t) : 1)); s.money += n; if (n > 0) s.c.earned += n; return n; },
      rawMoney(n) { s.money += Math.round(n); if (n > 0) s.c.earned += n; },
      stat(key, n) { s.st[key] = clamp(s.st[key] + n * k, 5, 99); },
      fame(n) { E.addFame(s, n * k); },
      rep(n) { s.rep = clamp(s.rep + n * k, -100, 100); },
      heart(n) { s.heart = clamp(s.heart + n, 0, 100); },
      health(n) { s.health = clamp(s.health + n, 0, 100); },
      sharp(n) { s.sharp = clamp(s.sharp + n, 0, 100); },
      elo(n) { s.elo += n * k; },
      flag(k, v = true) { s.flags[k] = v; if (v && s.ctx) { s.why = s.why || {}; if (!s.why[k]) s.why[k] = s.ctx; } },
      has: (k) => !!s.flags[k],
      later(id, a, b, d) { schedule(s, id, a, b == null ? a : b, d); },
      note: (t, k) => note(s, t, k),
      remember: (k, t, w) => remember(s, k, t, w),
      injure(name, weeks, penalty = 4) { if (!s.injury || s.injury.weeks < weeks) s.injury = { name, weeks, penalty }; },
      offer(o) { s.offers = [E.customOffer(s, o)]; },
      achieve: (id) => E.achieve(s, id),
      trainer: () => s.people.trainer.name, manager: () => s.people.manager.name, reporter: () => s.people.reporter.name, paper: () => s.people.reporter.paper,
      rival: () => E.rival(s), rivalName: () => { const r = E.rival(s); return r ? fullName(r) : 'your old rival'; },
      champ: () => E.champion(s), you: () => s.f.first, last: () => s.f.last, city: () => D.CITIES[s.city] ? D.CITIES[s.city].name : s.city,
      home: () => D.CITIES[s.f.home].name, year: () => E.year(s.t), age: () => E.age(s), division: () => D.DIVISIONS[s.f.division].name,
      setPhase(p) { s.phase = p; },
      enlist(branch, how) { E.startService(s, branch, how); },
      retire(reason) { E.retire(s, reason); },
    };
    return x;
  };

  // ---------- techniques, camp upgrades, ambitions ----------
  // Techniques cost lessons, which you earn by fighting. Ring techniques change the fight itself.
  E.PERKS = {
    shoulder: { name: 'Shoulder Roll', kind: 'ring', cost: 4, blurb: 'Roll punches off your shoulder. Your slips and ducks stay safe a little longer.' },
    counter: { name: 'Counter King', kind: 'ring', cost: 5, blurb: 'Counters after a miss hit much harder.' },
    body: { name: 'Body Snatcher', kind: 'ring', cost: 4, blurb: 'Body shots do more damage and drain his stamina faster.' },
    ironjaw: { name: 'Iron Jaw', kind: 'ring', cost: 5, blurb: 'Easier to beat the count, and you come up with more left.' },
    secondwind: { name: 'Second Wind', kind: 'ring', cost: 4, blurb: 'Faster stamina recovery, and every corner break heals a little.' },
    fasthands: { name: 'Fast Hands', kind: 'ring', cost: 5, blurb: 'Your punches come out quicker and snap back faster.' },
    killer: { name: 'Killer Instinct', kind: 'ring', cost: 6, req: (s) => s.rec.ko >= E.nf(s, 3), reqText: (s) => `Needs ${E.nf(s, 3)} knockout${E.nf(s, 3) === 1 ? '' : 's'}`, blurb: 'When he is hurt, you finish. More damage on a staggered opponent.' },
    clinch: { name: 'The Clinch', kind: 'ring', cost: 4, blurb: 'A new move: tie him up (E key or the CLINCH button) to stop his attack and catch your breath. Twice a round.' },
    general: { name: 'Ring General', kind: 'ring', cost: 6, req: (s) => s.fights.length >= E.nf(s, 12), reqText: (s) => `Needs ${E.nf(s, 12)} fights`, blurb: 'You read fighters early. His wind-ups take a little longer to come.' },
    crowd: { name: 'Crowd Pleaser', kind: 'ring', cost: 4, blurb: 'Stars come easier, and every win brings more fame.' },
    discipline: { name: 'Roadwork Discipline', kind: 'life', cost: 4, blurb: 'Every month of training does more.' },
    healer: { name: 'Quick Healer', kind: 'life', cost: 4, blurb: 'Injuries heal faster and your body bounces back.' },
    showman: { name: 'Showmanship', kind: 'life', cost: 5, blurb: 'Promoters pay more for a fighter who sells tickets. Bigger purses, better haggling.' },
    frugal: { name: 'Smart Money', kind: 'life', cost: 3, blurb: 'You live cheaper than your fame says you should.' },
    oldpro: { name: 'Old Pro', kind: 'life', cost: 6, req: (s) => E.age(s) >= 29, reqText: 'Needs age 29', blurb: 'Age takes your legs more slowly. Experience covers what speed cannot.' },
    film: { name: 'Film Study', kind: 'life', cost: 5, req: (s) => E.year(s.t) >= 1946, reqText: 'After 1946, when fight films are easy to get', blurb: 'Studying an opponent counts double, and his tells are labeled in round one.' },
  };
  // Camp upgrades cost money once, and staff take wages every month.
  E.GEAR = {
    bag: { name: 'A heavy bag in the basement', cost: 40, upkeep: 0, blurb: 'All training a little better.' },
    partners: { name: 'Good sparring partners', cost: 150, upkeep: 8, blurb: 'Sparring teaches more and hurts you less.' },
    cutman: { name: 'A real cutman', cost: 120, upkeep: 6, blurb: 'Fewer injuries after fights. Ice and water heals more between rounds.' },
    strength: { name: 'A strength coach', cost: 250, upkeep: 12, blurb: 'Power and chin training work better.' },
    track: { name: 'A track coach', cost: 200, upkeep: 10, blurb: 'Stamina and speed training work better.' },
    robe: { name: 'A silk robe with your name on it', cost: 90, upkeep: 0, blurb: 'You look like a star. More fame from every win.' },
    car: { name: 'A car', cost: 700, upkeep: 5, from: 1936, blurb: 'You can take fights farther away: one more offer every time.' },
    projector: { name: 'A fight-film projector', cost: 600, upkeep: 0, from: 1946, blurb: 'Watch the other man\'s fights. Studying him counts double.' },
    house: { name: 'A house for your family', cost: 4000, upkeep: 0, blurb: 'No more rent. No more sending money home. Your family is set.' },
  };
  E.AMBITIONS = {
    title: { name: 'Win a world title', reward: 25, done: (s) => s.belts > 0 },
    rich: { name: 'Retire with $20,000 in the bank', reward: 15, done: (s) => s.retired && (s.flags.retire_money || 0) >= 20000 },
    iron: { name: 'Never get knocked out (# or more fights)', n: 20, reward: 15, done: (s) => s.fights.length >= E.nf(s, 20) && s.rec.kod === 0 },
    fifty: { name: 'Fight # times', n: 50, reward: 10, done: (s) => s.fights.length >= E.nf(s, 50) },
    famous: { name: 'Become a household name', reward: 15, done: (s) => (s.flags.max_fame || 0) >= 70 },
    rival: { name: 'Beat your rival twice', reward: 15, done: (s) => (s.flags.rival_wins || 0) >= 2 },
    clean: { name: 'Never take a crooked dollar (# or more fights)', n: 20, reward: 10, done: (s) => s.fights.length >= E.nf(s, 20) && !s.flags.ever_crooked },
    unbeaten: { name: 'Win your first # fights', n: 15, reward: 20, done: (s) => !!s.flags.first15 },
    abroad: { name: 'Fight in London', reward: 10, done: (s) => s.fights.some((f) => f.city === 'London') },
  };
  // Goals that count fights shrink with the game length. Pass a career, or just { pace }.
  E.ambName = (s, k) => { const a = E.AMBITIONS[k]; return a.n ? a.name.replace('#', E.nf(s, a.n)) : a.name; };
  E.achText = (s, a) => (a.n ? a.text.replace('#', E.nf(s, a.n)) : a.text);
  E.hasPerk = (s, id) => !!(s.perks && s.perks.includes(id));
  E.hasGear = (s, id) => !!(s.gear && s.gear[id]);
  E.perkCost = (s, id) => E.PERKS[id].cost;
  E.gearCost = (s, id) => Math.round(E.GEAR[id].cost * E.eraMoney(s.t) / 5) * 5;
  E.buyPerk = function (s, id) {
    const p = E.PERKS[id];
    s.perks = s.perks || [];
    if (!p || s.perks.includes(id) || (s.lessons || 0) < p.cost || (p.req && !p.req(s))) return false;
    s.lessons -= p.cost; s.perks.push(id);
    note(s, `${s.people.trainer.name} writes a new page in the notebook: ${p.name}.`, 'good');
    return true;
  };
  E.buyGear = function (s, id) {
    const g = E.GEAR[id];
    s.gear = s.gear || {};
    if (!g || s.gear[id] || (g.from && E.year(s.t) < g.from)) return false;
    const cost = E.gearCost(s, id);
    if (s.money < cost) return false;
    s.money -= cost; s.gear[id] = s.t;
    if (id === 'robe') s.heart = clamp(s.heart + 5, 0, 100);
    if (id === 'house') { s.heart = clamp(s.heart + 20, 0, 100); s.people.family.allowance = false; remember(s, 'family', 'bought my family a house', 3); }
    note(s, `New for the camp: ${g.name.replace(/^an? /, '')}.`, 'good');
    return true;
  };
  E.dropGear = function (s, id) { if (s.gear && s.gear[id] && E.GEAR[id].upkeep) { delete s.gear[id]; note(s, `You let go of ${E.GEAR[id].name.replace(/^an? /, 'your ')}.`, 'life'); return true; } return false; };
  E.upkeep = function (s) {
    let u = 0;
    for (const id in (s.gear || {})) u += E.GEAR[id] ? E.GEAR[id].upkeep : 0;
    return Math.round(u * E.eraMoney(s.t));
  };
  // Haggle once per poster. Fame, a sharp manager and showmanship help. The promoter might walk.
  E.haggle = function (s, offerId) {
    const o = (s.offers || []).find((x) => x.id === offerId);
    if (!o || o.haggled) return null;
    o.haggled = true;
    const p = clamp(0.32 + s.fame / 160 + (['connected', 'showman'].includes(s.people.manager.trait) ? 0.14 : 0) + (E.hasPerk(s, 'showman') ? 0.12 : 0) - (o.level === 'title' ? 0.1 : 0), 0.15, 0.85);
    if (chance(s, p)) {
      const bump = Math.round(o.purse * between(s, 0.15, 0.3) / 5) * 5;
      o.purse += bump;
      return { ok: true, text: `The promoter grumbles, then adds ${money(bump)}.` };
    }
    s.offers = s.offers.filter((x) => x.id !== offerId);
    return { ok: false, text: `The promoter tears up the contract. "Plenty of guys want that fight."` };
  };
  // Elite fighters bring a signature move. Champions, your rival, and anyone rated 78+.
  E.SIGNATURES = { slugger: 'bolo', showman: 'bolo', boxer: 'triple', counter: 'triple', swarmer: 'rush', dirty: 'lowblow' };
  E.SIGNATURE_NAMES = { bolo: 'The Bolo', triple: 'The Triple', rush: 'The Rush', lowblow: 'The Low Blow' };
  E.SIGNATURE_TIPS = { bolo: 'His bolo punch swings up from his right side in a big circle. Slip LEFT. Ducking will not save you.', triple: 'He throws three: jab, jab, then a hook. Slip the jabs and wait for the hook.', rush: 'He charges with three quick body shots. Slip side to side, or keep your guard up.', lowblow: 'He fights dirty: a fast punch below the belt with almost no wind-up. Slip it. The referee may take a point.' };
  E.signatureFor = function (s, opp) {
    if (!opp || opp.club && opp.rating < 78) return null;
    if (opp.id === s.world.champId || opp.rival || opp.id === s.people.rival || opp.rating >= 78) return E.SIGNATURES[opp.style] || 'triple';
    return null;
  };

  // ---------- actions between fights ----------
  const TRAIN = {
    roadwork: { stat: 'sta', name: 'Roadwork', line: 'Five miles before sunrise, every day.' },
    bag: { stat: 'pow', name: 'Heavy bag', line: 'You hit the heavy bag until the chain squeaks.' },
    speed: { stat: 'spd', name: 'Speed bag & rope', line: 'Rat-a-tat on the speed bag. Rope until your calves burn.' },
    spar: { stat: 'def', name: 'Sparring', line: 'Real punches, real mistakes, real lessons.' },
    chin: { stat: 'chn', name: 'Neck & body work', line: 'Medicine ball to the gut. Neck bridges. Ugly, useful.' },
  };
  E.TRAIN = TRAIN;
  function trainGain(s, k, scale = 1) {
    const t = s.people.trainer.trait;
    let m = 1;
    if (t === 'conditioning' && (k === 'sta' || k === 'chn')) m = 1.35;
    if (t === 'scientist' && (k === 'def' || k === 'spd')) m = 1.35;
    if (t === 'old school') m = 1.12;
    if (s.heart < 30) m *= 0.7;
    if (s.c.trainStreak >= 4) m *= 0.75;
    if (E.hasPerk(s, 'discipline')) m *= 1.2;
    if (E.hasGear(s, 'bag')) m *= 1.1;
    if (E.hasGear(s, 'strength') && (k === 'pow' || k === 'chn')) m *= 1.2;
    if (E.hasGear(s, 'track') && (k === 'sta' || k === 'spd')) m *= 1.2;
    const ageMul = E.age(s) >= 34 ? 0.3 : E.age(s) >= 31 ? 0.55 : 1;
    const g = 4.2 * m * ageMul * scale * (1 - s.st[k] / 104) * between(s, 0.6, 1.4);
    s.st[k] = clamp(s.st[k] + g, 5, 99);
    return g;
  }
  E.act = function (s, action, arg) {
    if (s.inbox.length || s.phase !== 'between' || s.retired) return null;
    const res = { lines: [] }, m = E.pace(s).months;
    const span = { 1: 'A month', 2: 'Two months', 3: 'A season' }[m] || 'A month';
    s.c.actions++;
    const x = E.api(s);
    if (action === 'train') {
      if (s.injury && arg !== 'roadwork') { res.lines.push(`The ${s.injury.name} won't allow it. You do light roadwork instead.`); arg = 'roadwork'; }
      const tr = TRAIN[arg] || TRAIN.roadwork;
      let g = 0;
      for (let i = 0; i < m; i++) {
        g += trainGain(s, tr.stat);
        if (arg === 'spar') { trainGain(s, 'chn', 0.35); s.sharp = clamp(s.sharp + 12, 0, 100); if (E.hasGear(s, 'partners')) trainGain(s, 'def', 0.4); }
        s.c.trainStreak++;
      }
      res.lines.push(`${tr.line} ${E.statLabel[tr.stat]} +${g.toFixed(1)}.`);
      if (s.c.trainStreak >= 4 && chance(s, 0.25)) { s.heart = clamp(s.heart - 6, 0, 100); res.lines.push('You are grinding yourself down. The joy is leaking out.'); }
      if (arg === 'spar' && chance(s, 1 - Math.pow(1 - (E.hasGear(s, 'partners') ? 0.035 : 0.07), m))) { x.injure(pick(s, ['bruised rib', 'cut over the eye', 'sprained thumb']), int(s, 3, 6)); res.lines.push(`A sparring partner catches you. ${s.injury.name[0].toUpperCase() + s.injury.name.slice(1)}.`); }
      tick(s, 4 * m, arg === 'spar' ? 'spar' : 'train');
    } else if (action === 'work') {
      const job = D.JOBS.find((j) => E.year(s.t) >= j.from && E.year(s.t) <= j.to) || D.JOBS[D.JOBS.length - 1];
      let pay = 0;
      for (let i = 0; i < m; i++) pay += Math.round(between(s, job.pay[0], job.pay[1]));
      s.money += pay; s.c.earned += pay; s.c.trainStreak = 0;
      res.lines.push(`${span} on ${job.name}. You bring home ${money(pay)}.${job.note && !s.flags['jobnote_' + job.from] ? ' ' + job.note : ''}`);
      s.flags['jobnote_' + job.from] = true;
      s.st.sta = clamp(s.st.sta + 0.3 * m, 5, 99);
      tick(s, 4 * m, 'work');
    } else if (action === 'rest') {
      s.health = clamp(s.health + 8 * m, 0, 100); s.heart = clamp(s.heart + 8 * m, 0, 100); s.c.trainStreak = 0;
      res.lines.push(pick(s, ['You sleep in, eat a real breakfast, and see a picture show.', `${span} off. Your hands stop aching.`, 'You go home for a while. The cooking alone is worth it.']));
      tick(s, 4 * m, 'rest');
    } else if (action === 'press') {
      const tv = E.tvEra(s.t);
      const p = 0.55 + (s.people.manager.trait === 'showman' ? 0.2 : 0) + Math.min(0.2, s.rec.w / 60);
      let hits = 0;
      for (let i = 0; i < m; i++) if (chance(s, p)) hits++;
      if (hits) {
        const b0 = s.fame; for (let i = 0; i < hits; i++) E.addFame(s, int(s, 2, 5) + (tv ? 1 : 0)); const g = Math.max(1, Math.round(s.fame - b0));
        res.lines.push(pick(s, tv
          ? ['You go on a TV variety show and spar with the host. The audience eats it up.', 'A razor company films you shaving. Millions see it.']
          : ['You do a radio spot and tell the story of your first fight. The phones ring.', `${s.people.reporter.name} of ${s.people.reporter.paper} writes you up.`, 'You pose for photographers on a fire escape. The picture runs in three papers.']) + ` Fame +${g}.`);
      } else { res.lines.push(pick(s, ['You show up to a newspaper office. Nobody shows up to meet you.', 'The radio host mispronounces your name four times.', 'You trip on a cable at the photo studio. The photo runs anyway.'])); s.fame = clamp(s.fame + 1, 0, 100); }
      s.c.trainStreak = 0; s.sharp = clamp(s.sharp - 2 * m, 0, 100);
      tick(s, 4 * m, 'press');
    } else if (action === 'circuit') {
      // Three quick bouts on the club circuit, called on the radio.
      res.circuit = [];
      for (let i = 0; i < 3; i++) {
        tick(s, int(s, 2, 4) * m, 'fight');
        const offer = makeOffer(s, 'club');
        const out = E.simFight(s, offer);
        const r = E.resolveFight(s, offer, out);
        res.circuit.push({ offer, out, r });
        if (out.result === 'L' && out.method !== 'DEC') break;
      }
      s.c.trainStreak = 0;
    } else return null;
    if (action !== 'circuit') rollRandom(s, 0.42);
    checkForced(s);
    return res;
  };

  // ---------- fight offers ----------
  function venueFor(s, level) {
    const y = E.year(s.t);
    const home = D.CITIES[s.city] || D.CITIES[s.f.home];
    const ok = (v) => !D.VENUE_OPENED[v] || y >= D.VENUE_OPENED[v];
    if (level === 'smoker') return { venue: pick(s, D.SMOKERS), city: home.name };
    if (level === 'club') return chance(s, 0.65) ? { venue: home.club, city: home.name } : (() => { const r = pick(s, D.ROAD); return { venue: r.venues[r.venues.length > 1 ? 1 : 0], city: r.city }; })();
    if (level === 'main') return chance(s, 0.5) ? { venue: home.arena, city: home.name } : (() => { const r = pick(s, D.ROAD.filter((r) => r.city !== 'London')); return { venue: r.venues[0], city: r.city }; })();
    if (level === 'title') return chance(s, 0.6) ? { venue: 'Madison Square Garden', city: 'New York' } : chance(s, 0.5) ? { venue: home.park, city: home.name } : { venue: pick(s, ['the Polo Grounds', 'Yankee Stadium', 'Chicago Stadium']).replace(/^/, ''), city: 'New York' };
    const r = pick(s, D.ROAD);
    const v = r.venues.filter(ok);
    return { venue: v.length ? v[0] : r.venues[0], city: r.city };
  }
  function clubOpponent(s, lo, hi) {
    const taken = new Set(s.world.fighters.map((f) => `${f.first} ${f.last}`));
    const f = makeFighter(s, taken, { rating: int(s, lo, hi), age: int(s, 19, 34) });
    f.id = -Math.floor(rnd(s) * 1e9) - 1; s.world.nextId--; // club fighters are not tracked in the world list
    seedRecord(s, f); f.club = true;
    f.w = Math.round(f.w * 0.6); f.l = Math.round(f.l * 1.2);
    return f;
  }
  function purseFor(s, level, opp) {
    const base = { smoker: [8, 25], club: [25, 75], prelim: [50, 160], main: [120, 500], ranked: [400, 1500], eliminator: [1200, 3500], title: [5000, 14000] }[level];
    let p = between(s, base[0], base[1]) * (1 + s.fame / 90);
    if (opp && !opp.club) p *= 1 + Math.max(0, (opp.rating - 55) / 90);
    if (s.champ && level === 'title') p *= 2.4;
    if (E.tvEra(s.t)) p *= (level === 'club' || level === 'smoker') ? 0.75 : 1.25;
    if (E.hasPerk(s, 'showman')) p *= 1.12;
    // In a shorter game a purse has to cover a longer stretch of rent.
    return Math.round((p * E.eraMoney(s.t) * E.pace(s).months) / 5) * 5;
  }
  function makeOffer(s, level, opp, extra = {}) {
    const lvl = level;
    if (!opp) {
      const r = E.overall(s);
      if (lvl === 'smoker') opp = clubOpponent(s, 18, 34);
      else if (lvl === 'club') opp = clubOpponent(s, Math.max(20, r - 12), r + 6);
      else opp = clubOpponent(s, Math.max(30, r - 8), r + 10);
    }
    const v = extra.venue ? { venue: extra.venue, city: extra.city } : venueFor(s, lvl === 'ranked' || lvl === 'eliminator' ? 'main' : lvl === 'prelim' ? 'club' : lvl);
    const rounds = { smoker: 4, club: 4, prelim: 6, main: 10, ranked: 10, eliminator: 12, title: 15 }[lvl];
    const baseWeeks = extra.weeks || (lvl === 'title' ? int(s, 6, 10) : lvl === 'smoker' || lvl === 'club' ? int(s, 2, 4) : int(s, 3, 8));
    const weeks = Math.round(baseWeeks * E.pace(s).months);
    const o = {
      id: Math.floor(rnd(s) * 1e9), level: lvl, opp: snapshot(opp), oppId: opp.club ? null : opp.id, rounds, weeks, venue: v.venue, city: v.city,
      purse: extra.purse || purseFor(s, lvl, opp), tv: E.tvEra(s.t) && (lvl === 'main' || lvl === 'ranked' || lvl === 'eliminator' || lvl === 'title') && (s.fame >= 18 || lvl === 'title'),
      title: lvl === 'title', tags: extra.tags || [], note: extra.note || '', crooked: extra.crooked || false,
    };
    o.signature = E.signatureFor(s, opp);
    if (baseWeeks <= 2 && lvl !== 'smoker' && lvl !== 'club') { o.tags.push('short notice'); o.purse = Math.round(o.purse * 1.35); }
    if (v.city !== (D.CITIES[s.city] || D.CITIES[s.f.home]).name) o.tags.push('on the road');
    if (o.tv) o.tags.push('on television');
    if (opp.id === s.people.rival) o.tags.push('your rival');
    const prev = s.fights.filter((f) => f.oppId === opp.id && opp.id != null && opp.id > 0).length;
    if (prev) o.tags.push(prev === 1 ? 'rematch' : `fight number ${prev + 1}`);
    return o;
  }
  E.makeOffer = makeOffer;
  function snapshot(f) {
    return { id: f.id, first: f.first, last: f.last, nick: f.nick, city: f.city, style: f.style, rating: Math.round(f.rating), age: f.age, w: f.w, l: f.l, d: f.d, ko: f.ko, look: f.look, quirk: f.quirk, trash: f.trash, height: f.height, reach: f.reach, club: !!f.club, rival: !!f.rival };
  }
  E.customOffer = function (s, o) {
    let opp = o.oppId ? E.fighterById(s, o.oppId) : null;
    if (!opp) opp = o.rating ? clubOpponent(s, o.rating - 3, o.rating + 3) : null;
    if (opp && o.style) opp.style = o.style;
    if (opp && o.name === 'Deacon Tate') Object.assign(opp, { first: 'Hollis', nick: 'Deacon', last: 'Tate', style: 'counter', city: D.CITIES[s.f.home].name, age: E.age(s) + 4, look: Object.assign({}, opp.look, { skin: 5, cut: 'crop', hair: 0, stache: true }), quirk: 'reads the Bible in his dressing room and never says a word in the ring', trash: 'I pray for every man I fight. Then I fight him.', w: 61, l: 7, d: 3, ko: 38 });
    return makeOffer(s, o.level || 'main', opp, o);
  };

  E.offers = function (s) {
    if (s.offers && s.offers.length) return s.offers;
    const rank = E.playerRank(s), fights = s.fights.length, r = E.overall(s), list = [];
    const act = s.world.fighters.filter((f) => f.active && f.id !== s.world.champId);
    const near = (lo, hi) => act.filter((f) => f.elo >= s.elo + lo && f.elo <= s.elo + hi);
    if (s.champ) {
      const ranks = E.rankings(s).slice(0, 4).map((x) => x.f).filter(Boolean);
      ranks.slice(0, 2).forEach((f, i) => list.push(makeOffer(s, 'title', f, { tags: i === 0 ? ['mandatory challenger'] : [] })));
      const nt = pick(s, act.filter((f) => f.elo < s.elo - 100)) ;
      if (nt) list.push(makeOffer(s, 'main', nt, { tags: ['non-title'], note: 'The belt is not on the line. The money is decent and the risk is lower.' }));
    } else if (fights < E.nf(s, 3)) {
      list.push(makeOffer(s, 'smoker'));
      list.push(makeOffer(s, 'club'));
      if (chance(s, 0.6)) list.push(makeOffer(s, 'club', null, { weeks: 2, tags: ['short notice'], purse: purseFor(s, 'club') * 1.5 }));
    } else if (!rank || rank > 14 || s.elo < 1280) {
      list.push(makeOffer(s, 'club'));
      list.push(makeOffer(s, 'prelim'));
      const step = near(40, 220);
      if (step.length && chance(s, 0.7)) list.push(makeOffer(s, 'main', pick(s, step), { tags: ['step up'] }));
      else list.push(makeOffer(s, 'prelim'));
    } else {
      const ranked = near(-60, 260);
      const tough = near(80, 400);
      if (ranked.length) list.push(makeOffer(s, 'ranked', pick(s, ranked)));
      if (tough.length) list.push(makeOffer(s, 'ranked', pick(s, tough), { tags: ['step up'] }));
      list.push(makeOffer(s, 'main'));
      if (rank <= 3 && (!s.flags.title_shot_given || s.t - s.flags.title_shot_given > 20)) {
        const champ = E.champion(s);
        if (champ) { list.unshift(makeOffer(s, 'title', champ)); s.flags.title_shot_given = Math.max(1, s.t); }
      } else if (rank <= 6 && chance(s, 0.4)) {
        const e = E.rankings(s).filter((x) => x.id !== 0).slice(0, 5).map((x) => x.f);
        if (e.length) list.push(makeOffer(s, 'eliminator', pick(s, e), { tags: ['title eliminator'] }));
      }
    }
    // Sometimes the rival is available.
    const rival = E.rival(s);
    if (rival && rival.active && !s.champ && fights >= E.nf(s, 6) && Math.abs(rival.elo - s.elo) < 260 && chance(s, Math.min(0.7, 0.3 * E.pace(s).kf)) && !list.some((o) => o.oppId === rival.id)) {
      list.push(makeOffer(s, rival.id === s.world.champId ? 'title' : 'main', rival, { tags: [] }));
    }
    if (E.hasGear(s, 'car') && !s.champ && list.length < 4) list.push(makeOffer(s, s.elo > 1350 ? 'main' : 'prelim', null, { tags: ['road trip'] }));
    if (E.year(s.t) >= 1946 && s.fame > 35 && chance(s, 0.12)) list.push(makeOffer(s, 'main', null, { venue: 'Harringay Arena', city: 'London', weeks: 6, tags: ['overseas'] }));
    s.offers = list.slice(0, 4);
    return s.offers;
  };
  E.declineOffers = function (s) {
    s.offers = null;
    if (s.champ) { s.c.champIdle = (s.c.champIdle || 0) + 1; }
  };

  // ---------- training camp ----------
  E.CAMP = {
    roadwork: { stat: 'sta', name: 'Roadwork' }, bag: { stat: 'pow', name: 'Heavy bag' }, speed: { stat: 'spd', name: 'Speed bag' },
    spar: { stat: 'def', name: 'Sparring' }, scout: { name: 'Study the opponent' }, rest: { name: 'Rest' }, press: { name: 'Hype the fight' },
  };
  E.acceptOffer = function (s, offerId) {
    const o = (s.offers || []).find((x) => x.id === offerId);
    if (!o) return null;
    s.offers = null;
    s.camp = { offer: o, blocks: Math.max(1, Math.ceil(o.weeks / 4)), done: [], scout: 0, hype: 0 };
    s.phase = 'camp';
    if (o.title) remember(s, 'title_shot', `got a title shot against ${fullName(o.opp)} at ${o.venue}`, 3);
    note(s, `Signed: ${fullName(o.opp)}, ${o.rounds} rounds at ${o.venue}, ${o.city}. Purse ${money(o.purse)}.`, 'fight');
    return o;
  };
  E.campStep = function (s, what) {
    if (s.phase !== 'camp' || !s.camp || s.inbox.length) return null;
    const c = s.camp, res = { lines: [] };
    const tr = E.CAMP[what] || E.CAMP.roadwork;
    // In the shorter games one plan covers the whole camp, so it does a whole camp's work.
    const plan = E.pace(s).camp === 'plan', n = plan ? c.blocks : 1;
    if (c.done.length >= (plan ? 1 : c.blocks)) return { lines: [], ready: true };
    if (tr.stat) {
      if (s.injury && what !== 'roadwork') { res.lines.push(`The ${s.injury.name} keeps you out of it. Light work only.`); s.health = clamp(s.health + n, 0, 100); }
      else {
        let g = 0;
        for (let i = 0; i < n; i++) { g += trainGain(s, tr.stat, 0.9); if (what === 'spar') s.sharp = clamp(s.sharp + 10, 0, 100); }
        if (what === 'spar' && chance(s, 1 - Math.pow(0.95, n))) { E.api(s).injure('cut over the eye', 3, 3); res.lines.push('A sparring partner opens a cut over your eye. Doc tapes it.'); }
        res.lines.push(`${tr.name}: ${E.statLabel[tr.stat]} +${g.toFixed(1)}.`);
      }
    } else if (what === 'scout') {
      const first = !c.scout;
      for (let i = 0; i < Math.min(n, 3); i++) c.scout += (E.hasPerk(s, 'film') ? 1 : 0) + (E.hasGear(s, 'projector') ? 1 : 0) + 1;
      res.lines.push(first ? `You study ${c.offer.opp.last}. ${scoutLine(c.offer.opp)}` : 'You find another habit. You will know what is coming before it comes.');
      if (plan && n > 1) res.lines.push('By fight night you know his habits better than he does.');
    } else if (what === 'rest') { s.health = clamp(s.health + 4 * n, 0, 100); s.heart = clamp(s.heart + 4 * n, 0, 100); res.lines.push('Rest. Legs fresh. Mind clear.'); }
    else if (what === 'press') {
      c.hype += n; const b0 = s.fame; for (let i = 0; i < n; i++) E.addFame(s, int(s, 1, 3)); const g = Math.max(1, Math.round(s.fame - b0));
      res.lines.push(`You talk up the fight. Ticket sales jump. Fame +${g}, and the purse grows.`);
      c.offer.purse = Math.round(c.offer.purse * (1 + 0.08 * Math.min(n, 3)));
    }
    c.done.push(what);
    const left = c.offer.weeks - (c.done.length - 1) * 4;
    tick(s, plan ? c.offer.weeks : Math.max(1, Math.min(4, left)), what === 'rest' ? 'rest' : what === 'spar' ? 'spar' : 'train');
    if (chance(s, 0.25)) rollRandom(s, 1);
    res.ready = plan || c.done.length >= c.blocks;
    checkForced(s);
    return res;
  };
  function scoutLine(opp) {
    return {
      slugger: 'He loads up on the big right hand. When his shoulder dips, it is coming.',
      boxer: 'He jabs and moves. Get past the jab and he does not like it inside.',
      swarmer: 'He comes in throwing combinations. Slip and counter when he resets.',
      counter: 'He waits for you to miss. Do not swing wild into his guard.',
      dirty: 'He fights dirty: elbows, low ones, the occasional thumb. Keep your guard tight.',
      showman: 'He plays to the crowd. When he showboats, he is wide open.',
    }[opp.style] || 'Hard to read. You will have to feel him out.';
  }
  E.scoutLine = scoutLine;

  // ---------- simulated fights ----------
  const STYLE_EDGE = { boxer: { slugger: 3, swarmer: -3, showman: 2 }, slugger: { swarmer: 3, boxer: -3, counter: -1 }, swarmer: { boxer: 3, counter: -2, slugger: -2 }, counter: { swarmer: 2, slugger: 2, boxer: -2, showman: 3 } };
  E.styleEdge = (a, b) => (STYLE_EDGE[a] && STYLE_EDGE[a][b]) || 0;

  E.simFight = function (s, offer, opts = {}) {
    const ringPerks = (s.perks || []).filter((id) => E.PERKS[id] && E.PERKS[id].kind === 'ring').length;
    const opp = offer.opp, P = E.overall(s) + E.styleEdge(s.f.style, opp.style) + Math.min(4, (s.camp ? s.camp.scout : 0) * 1.2) + Math.min(2.5, ringPerks * 0.35) + (opts.bonus || 0);
    const O = opp.rating + E.styleEdge(opp.style, s.f.style) + (offer.title && !s.champ ? 1.5 : 0);
    const oStats = opponentStats(opp.rating, opp.style);
    const rounds = offer.rounds, lines = [];
    let pDmg = 0, oDmg = 0, pKd = 0, oKd = 0, result = null, method = null, endRound = rounds;
    const cards = [[0, 0], [0, 0], [0, 0]];
    const yName = s.f.last, oName = opp.last;
    for (let r = 1; r <= rounds; r++) {
      const fatigueP = (r / rounds) * (1 - s.st.sta / 110) * 6, fatigueO = (r / rounds) * (1 - oStats.sta / 110) * 6;
      const diff = (P - fatigueP - pDmg / 12) - (O - fatigueO - oDmg / 12);
      const pr = logistic(diff / 7 + between(s, -0.6, 0.6));
      const pWon = chance(s, pr);
      let rkP = 0, rkO = 0;
      // knockdowns
      const kdP = clamp(0.025 + (s.st.pow - oStats.chn) / 420 + Math.max(0, diff) / 140 + oDmg / 900, 0.004, 0.32);
      const kdO = clamp(0.025 + (oStats.pow - s.st.chn) / 420 + Math.max(0, -diff) / 140 + pDmg / 900 + (s.health < 50 ? 0.03 : 0), 0.004, 0.32);
      const line = [];
      if (chance(s, kdP)) {
        rkP++; oKd++; oDmg += 8;
        const up = chance(s, clamp(0.78 - oKd * 0.18 - oDmg / 200 + (oStats.chn - 50) / 200, 0.05, 0.95));
        if (!up) { result = 'W'; method = 'KO'; endRound = r; line.push(pick(s, [`${yName} lands a perfect right hand and ${oName} does not beat the count!`, `A left hook from ${yName} and ${oName} is out cold!`, `${oName} goes down and stays down. It's all over!`])); }
        else line.push(pick(s, [`${yName} drops ${oName} with a short right! He's up at eight.`, `Down goes ${oName}! He beats the count, but his legs are gone.`]));
      }
      if (!result && chance(s, kdO)) {
        rkO++; pKd++; pDmg += 8;
        const up = chance(s, clamp(0.8 - pKd * 0.17 - pDmg / 200 + (s.st.chn - 50) / 180 + (s.heart - 50) / 300, 0.05, 0.96));
        if (!up) { result = 'L'; method = 'KO'; endRound = r; line.push(pick(s, [`${oName} catches ${yName} cold. ${yName} is down... and out.`, `A crushing right from ${oName}! ${yName} cannot get up!`])); }
        else line.push(pick(s, [`${yName} is down from a left hook! Up at seven, shaking his head.`, `${oName} floors ${yName}! He gets up. Brave, maybe foolish.`]));
      }
      const dP = between(s, 2, 7) * (pWon ? 0.6 : 1.3) * (1.1 - s.st.def / 200), dO = between(s, 2, 7) * (pWon ? 1.3 : 0.6) * (1.1 - oStats.def / 200);
      pDmg += dP; oDmg += dO;
      if (!result && (rkP >= 3 || oDmg > 75 && chance(s, 0.35))) { result = 'W'; method = 'TKO'; endRound = r; line.push(`The referee steps in and waves it off. ${yName} wins by stoppage!`); }
      if (!result && (rkO >= 3 || pDmg > 75 && chance(s, 0.35))) { result = 'L'; method = 'TKO'; endRound = r; line.push(`The referee has seen enough. ${oName} wins by stoppage.`); }
      if (!line.length) line.push(roundColor(s, pWon, yName, oName, opp, pr));
      lines.push({ r, text: line.join(' '), pWon });
      for (let j = 0; j < 3; j++) {
        const close = Math.abs(pr - 0.5) < 0.18;
        let jWon = pWon; if (close && chance(s, 0.22)) jWon = !jWon;
        const a = rkO > rkP ? 8 : 9, b = rkP > rkO ? 8 : 9;
        if (jWon) { cards[j][0] += 10; cards[j][1] += rkP > rkO ? 8 : b === 8 ? 8 : 9; } else { cards[j][1] += 10; cards[j][0] += a; }
      }
      if (result) break;
    }
    if (!result) {
      const v = cards.map((c) => Math.sign(c[0] - c[1]));
      const yes = v.filter((x) => x > 0).length, no = v.filter((x) => x < 0).length;
      if (yes >= 2) { result = 'W'; method = yes === 3 ? 'UD' : no === 1 ? 'SD' : 'MD'; }
      else if (no >= 2) { result = 'L'; method = no === 3 ? 'UD' : yes === 1 ? 'SD' : 'MD'; }
      else { result = 'D'; method = 'DRAW'; }
    }
    return { result, method, round: endRound, kdFor: oKd, kdAgainst: pKd, dmgTaken: clamp(pDmg / 100, 0, 1), cards, lines, played: false };
  };
  function roundColor(s, pWon, y, o, opp, pr) {
    const big = Math.abs(pr - 0.5) > 0.25;
    if (pWon) return pick(s, big
      ? [`${y} owns the round, snapping ${o}'s head back with the jab.`, `${y} digs to the body and ${o} winces. Big round.`, `The crowd chants for ${y}. ${o} is just trying to survive.`]
      : [`Close round, but ${y}'s cleaner punches should take it.`, `${y} edges a messy round on activity.`, `Back and forth, with ${y} landing the last good shot.`]);
    return pick(s, big
      ? [`${o} pins ${y} on the ropes and goes to work. Bad round.`, `${o}'s jab is a piston tonight. ${y} can't get inside.`, `${y} is a step behind all round. ${o} takes it easily.`]
      : [`${o} steals a close round with a late flurry.`, `A grinding round. ${o} looks a hair busier.`, `${y} waits too long, and ${o} banks the round.`]);
  }

  // A fixed fight that the fighter agreed to lose.
  E.takeDive = function (s, offer) {
    s.flags.dove = true; s.flags.took_dive = true; s.flags.dive_pending = false;
    const round = Math.min(offer.rounds, 6);
    return { result: 'L', method: 'KO', round, kdFor: 0, kdAgainst: 1, dmgTaken: 0.15, cards: [[0, 0], [0, 0], [0, 0]], lines: [{ r: round, text: `In the ${round === 6 ? 'sixth' : 'round ' + round}, ${s.f.last} goes down from a punch that would not have knocked over a lamp. He stays down. The crowd knows. The crowd always knows.`, pWon: false }], played: false, dive: true };
  };
  E.doubleCross = function (s) { s.flags.dive_pending = false; s.flags.double_cross = true; };

  // ---------- after the fight ----------
  E.resolveFight = function (s, offer, out) {
    const opp = offer.opp, world = opp.id > 0 ? E.fighterById(s, opp.id) : null;
    const lvlFame = { smoker: 1, club: 1.5, prelim: 2, main: 4, ranked: 6, eliminator: 8, title: 14 }[offer.level] || 2;
    const r = { changes: [], headline: '', sub: '', body: '' };
    const wasChamp = s.champ;
    const x = E.api(s);
    const yourName = fullName(s.f), oppName = fullName(opp);
    const kf = E.pace(s).kf; // in a shorter game each fight stands for more of a career
    s.fights.push({ t: s.t, oppId: opp.id > 0 ? opp.id : null, opp: `${opp.first} ${opp.last}`, result: out.result, method: out.method, round: out.round, purse: offer.purse, venue: offer.venue, city: offer.city, level: offer.level, title: offer.title, played: out.played, tv: offer.tv });
    s.sharp = clamp(s.sharp + 14 * kf, 0, 100);
    // Every fight teaches something, win or lose. Playing it yourself teaches more.
    const learn = kf * (out.played ? 1.6 : 1) * (offer.rounds >= 10 ? 1.3 : 1) * (E.age(s) >= 33 ? 0.15 : E.age(s) >= 30 ? 0.4 : 1);
    for (const k of ['pow', 'spd', 'sta', 'chn', 'def']) s.st[k] = clamp(s.st[k] + between(s, 0, 0.7) * learn * (1 - s.st[k] / 105), 5, 99);
    // Money: the purse is split before you ever see it.
    const managerCut = Math.round(offer.purse * (s.flags.self_managed ? 0 : 0.33));
    const trainerCut = Math.round(offer.purse * 0.1);
    const expenses = Math.round(offer.purse * 0.06 + 2 * E.eraMoney(s.t));
    let purse = offer.purse;
    if (out.result === 'L' && offer.level !== 'title') purse = Math.round(purse * 0.85);
    const koBonus = out.played && out.result === 'W' && (out.method === 'KO' || out.method === 'TKO') ? Math.round(purse * 0.15 / 5) * 5 : 0;
    purse += koBonus;
    if (koBonus) r.koBonus = koBonus;
    const net = purse - Math.round(purse * (s.flags.self_managed ? 0 : 0.33)) - Math.round(purse * 0.1) - expenses;
    s.money += net; s.c.earned += Math.max(0, net);
    r.purse = { gross: purse, manager: Math.round(purse * (s.flags.self_managed ? 0 : 0.33)), trainer: Math.round(purse * 0.1), expenses, net, managerName: s.people.manager.name, trainerName: s.people.trainer.name };
    void managerCut; void trainerCut;
    // Ranking points (Elo)
    const oppElo = world ? world.elo : 1000 + opp.rating * 10;
    const exp = 1 / (1 + Math.pow(10, (oppElo - s.elo) / 400));
    const score = out.result === 'W' ? 1 : out.result === 'D' ? 0.5 : 0;
    const K = (s.fights.length < E.nf(s, 10) ? 60 : 42) * kf;
    const delta = K * (score - exp) * (offer.title ? 1.5 : 1);
    s.elo += delta;
    if (world) {
      world.elo -= delta * 0.7;
      world.vsYou[out.result === 'W' ? 'l' : out.result === 'L' ? 'w' : 'd']++;
      if (out.result === 'W') world.l++; else if (out.result === 'L') { world.w++; if (out.method === 'KO' || out.method === 'TKO') world.ko++; } else world.d++;
    }
    const tv = offer.tv;
    const kod = out.method === 'KO' || out.method === 'TKO';
    if (out.result === 'W') {
      s.rec.w++; if (kod) s.rec.ko++;
      s.rec.streak = s.rec.streak > 0 ? s.rec.streak + 1 : 1;
      const before = s.fame;
      x.fame(kf * lvlFame * (kod ? 1.4 : 1) * (tv ? 1.5 : 1) * (out.played ? 1.15 : 1) * (E.hasGear(s, 'robe') ? 1.1 : 1) * (E.hasPerk(s, 'crowd') ? 1.2 : 1)); x.heart(6);
      if (s.rec.w === E.nf(s, 15) && s.rec.l === 0) s.flags.first15 = true;
      const fg = Math.round(s.fame - before); if (fg > 0) r.changes.push(`Fame +${fg}`);
      if (s.rec.w === 1) { remember(s, 'first_win', `won my first fight at ${offer.venue}${kod ? ' by knockout' : ''}`, 1); E.achieve(s, 'first_win'); }
      if (s.rec.ko >= E.nf(s, 10)) E.achieve(s, 'ko_artist');
      if (E.age(s) >= 37) E.achieve(s, 'old_man');
      if (out.played && kod) E.achieve(s, 'skill_ko');
      if (s.flags.lost3 && s.rec.streak >= 3) { E.achieve(s, 'comeback'); remember(s, 'comeback', 'came back from a three-fight losing streak', 2); s.flags.lost3 = false; }
    } else if (out.result === 'L') {
      s.rec.l++;
      if (kod) s.rec.kod++;
      s.rec.streak = s.rec.streak < 0 ? s.rec.streak - 1 : -1;
      if (s.rec.streak <= -3) s.flags.lost3 = true;
      x.fame(kf * (offer.level === 'title' ? 2 : -Math.round(lvlFame / 3))); x.heart(kod ? -12 : -7);
      if (s.rec.l === 1) remember(s, 'first_loss', `lost for the first time, to ${oppName}${kod ? ', who knocked me out' : ''}`, 1);
    } else { s.rec.d++; s.rec.streak = 0; x.fame(kf * Math.round(lvlFame / 2)); }
    // Body damage
    const wear = Math.round((out.dmgTaken * (offer.rounds >= 10 ? 10 : 5) + out.kdAgainst * 2.5 + (kod && out.result === 'L' ? 5 : 0)) * Math.pow(kf, 0.75));
    s.health = clamp(s.health - wear, 0, 100);
    if (wear >= 6) r.changes.push(`Health -${wear}`);
    if (out.kdAgainst >= 2 || (kod && out.result === 'L')) s.st.chn = clamp(s.st.chn - between(s, 0.5, 2.2), 5, 99);
    const injP = Math.min(0.45, (0.025 + out.dmgTaken * 0.2 * (offer.rounds >= 10 ? 1 : 0.6) + (offer.rounds >= 12 ? 0.04 : 0)) * (E.hasGear(s, 'cutman') ? 0.65 : 1) * Math.sqrt(kf));
    if (chance(s, injP)) {
      const inj = pick(s, [['broken hand', 10, 6], ['cut eyebrow', 4, 3], ['cracked rib', 7, 5], ['broken nose', 5, 3], ['detached retina scare', 12, 8], ['torn shoulder', 9, 6]]);
      if (inj[0] === 'detached retina scare' && chance(s, 0.6)) inj[0] = 'swollen eye';
      x.injure(inj[0], inj[1], inj[2]); r.changes.push(`Injury: ${inj[0]} (${inj[1]} weeks)`);
      r.injury = inj[0];
    }
    // Titles
    if (offer.title) {
      if (s.champ) {
        if (out.result === 'L') {
          s.champ = false; s.world.champId = opp.id > 0 ? opp.id : s.world.champId;
          remember(s, 'title_lost', `lost the title to ${oppName} in ${E.year(s.t)}`, 3);
          r.titleLost = true;
        } else { s.titleDefenses++; s.c.champIdle = 0; if (s.titleDefenses >= E.nf(s, 3)) E.achieve(s, 'defender'); r.defended = true; if (s.titleDefenses === 1 || s.titleDefenses % 3 === 0) remember(s, 'defense', `defended the title ${s.titleDefenses} time${s.titleDefenses > 1 ? 's' : ''}`, 2); }
      } else if (out.result === 'W') {
        s.champ = true; s.belts++; s.titleDefenses = 0; s.c.champIdle = 0; s.flags.title_shot_given = false;
        if (world) { s.world.champId = null; }
        x.fame(10);
        remember(s, 'title_won', `won the ${D.DIVISIONS[s.f.division].name.toLowerCase()} championship of the world, beating ${oppName} at ${offer.venue}`, 5);
        E.achieve(s, 'champ'); r.titleWon = true;
        s.flags.ever_champ = true;
      } else { s.flags.title_shot_given = false; s.flags.lost_title_shot = (s.flags.lost_title_shot || 0) + 1; }
    }
    // Rivalry
    if (opp.rival || opp.id === s.people.rival) {
      s.flags.rival_fights = (s.flags.rival_fights || 0) + 1;
      if (out.result === 'W') { s.flags.rival_wins = (s.flags.rival_wins || 0) + 1; if (s.flags.rival_wins >= 2) E.achieve(s, 'rival_done'); }
      remember(s, 'rival', `${out.result === 'W' ? 'beat' : out.result === 'L' ? 'lost to' : 'drew with'} my rival ${oppName}${s.flags.rival_fights > 1 ? ` (fight #${s.flags.rival_fights})` : ''}`, 2);
    }
    if (out.result === 'W') {
      if (s.flags.veteran) s.flags.won_after_war = true;
      if (s.flags.double_cross) s.flags.crossed_and_won = true;
      if (E.age(s) >= 37) s.flags.won_old = true;
      if (s.flags.outlaw) s.flags.outlaw_win = true;
      if (opp.rating - E.overall(s) >= 12) s.flags.big_upset = true;
      if (offer.title && kod && out.round === 1) s.flags.r1_title_ko = true;
    }
    if (offer.venue === 'Madison Square Garden') { s.flags.fought_msg = true; if (out.result === 'W') s.flags.won_msg = true; }
    if (offer.tags.includes('Deacon Tate')) s.flags.tate_fight_done = true;
    if (tv && out.result === 'W') E.achieve(s, 'tv_star');
    if (tv && !s.flags.first_tv) { s.flags.first_tv = true; remember(s, 'tv', `fought on television for the first time in ${E.year(s.t)}`, 2); }
    if (offer.city === 'London') { E.achieve(s, 'abroad'); remember(s, 'abroad', `fought ${oppName} in London`, 1); }
    // Lessons for the trainer's notebook
    let les = (out.result === 'W' ? 1 : 0) + (out.played ? 1 : 0) + (r.titleWon ? 2 : 0) + (out.result === 'W' && ['ranked', 'eliminator', 'title'].includes(offer.level) ? 1 : 0);
    if (s.fights.length <= E.nf(s, 3)) les += 1;
    les = Math.round(les * kf);
    s.lessons = (s.lessons || 0) + les; r.lessons = les;
    if (les) r.changes.push(`Lessons +${les}`);
    if (koBonus) r.changes.push(`Knockout bonus ${money(koBonus)}`);
    // The clipping
    r.headline = headline(s, offer, out, opp, wasChamp);
    r.sub = `${offer.venue}, ${offer.city} — ${E.dateLabel(s.t)}`;
    r.body = clippingBody(s, offer, out, opp);
    r.result = out.result; r.method = out.method;
    r.byline = `By ${s.people.reporter.name}, ${s.people.reporter.paper}`;
    note(s, `${out.result === 'W' ? 'WON' : out.result === 'L' ? 'LOST' : 'DREW'} vs ${oppName} (${methodText(out)}). You keep ${money(net)} of a ${money(purse)} purse.`, out.result === 'W' ? 'good' : out.result === 'L' ? 'bad' : 'fight');
    if (s.phase === 'camp') { s.phase = 'between'; s.camp = null; }
    tick(s, 1, 'fight');
    if (chance(s, 0.5)) rollRandom(s, 0.5);
    // Follow-up hooks for events
    if (out.result === 'L' && kod && s.rec.kod >= E.nf(s, 3) && (!s.flags.doc_t || s.t - s.flags.doc_t > 120)) { s.flags.doc_t = s.t; E.schedule(s, 'doctor_worry', 1, 4); }
    if (offer.crooked) E.schedule(s, 'fix_aftermath', 1, 3, { result: out.result });
    checkForced(s);
    return r;
  };
  function methodText(out) {
    if (out.method === 'KO') return `KO, round ${out.round}`;
    if (out.method === 'TKO') return `TKO, round ${out.round}`;
    if (out.method === 'DRAW') return 'draw';
    return { UD: 'unanimous decision', SD: 'split decision', MD: 'majority decision' }[out.method] || 'decision';
  }
  E.methodText = methodText;
  function headline(s, offer, out, opp, wasChamp) {
    const Y = s.f.last.toUpperCase(), O = opp.last.toUpperCase();
    const ko = out.method === 'KO' || out.method === 'TKO';
    if (offer.title && out.result === 'W' && s.champ) {
      if (s.titleDefenses === 0) return pick(s, [`${Y} IS CHAMPION OF THE WORLD!`, `NEW KING! ${Y} TAKES THE CROWN`, `${Y} DOES IT! TITLE CHANGES HANDS`]);
      return pick(s, [`${Y} KEEPS THE CROWN`, `CHAMP ${Y} TURNS BACK ${O}`, `${Y} STILL KING`]);
    }
    if (offer.title && out.result === 'L') return wasChamp ? pick(s, [`${O} DETHRONES ${Y}`, `${Y} LOSES TITLE`, `THE KING IS DEAD: ${O} WINS CROWN`]) : pick(s, [`${Y} FALLS SHORT`, `${O} TURNS BACK ${Y}`, `NO NEW KING: ${O} STILL CHAMP`]);
    if (out.result === 'W') return ko ? pick(s, [`${Y} FLATTENS ${O} IN ${out.round}`, `${O} COUNTED OUT; ${Y} ROLLS ON`, `LIGHTS OUT FOR ${O}`, `${Y} KAYOES ${O}`]) : pick(s, [`${Y} OUTPOINTS ${O}`, `${Y} GETS THE NOD`, `${Y} TOO SMART FOR ${O}`]);
    if (out.result === 'L') return ko ? pick(s, [`${O} STOPS ${Y}`, `${Y} KAYOED IN ${out.round}`, `${O} DROPS ${Y} FOR THE COUNT`]) : pick(s, [`${O} DECISIONS ${Y}`, `JUDGES FAVOR ${O}`, `${Y} EDGED BY ${O}`]);
    return pick(s, [`${Y}, ${O} FIGHT TO A DRAW`, `NOBODY WINS AT ${offer.venue.replace(/^the /, '').toUpperCase()}`]);
  }
  function clippingBody(s, offer, out, opp) {
    const y = fullName(s.f), o = fullName(opp);
    const crowd = { smoker: 'a few hundred smokers', club: 'a packed house of 1,800', prelim: 'an early crowd', main: 'a crowd of 9,000', ranked: '12,000 fans', eliminator: '14,500 fans', title: 'a record crowd' }[offer.level] || 'a crowd';
    const tvLine = offer.tv ? ' Millions more watched on television.' : E.year(s.t) < 1949 && offer.level !== 'smoker' && offer.level !== 'club' ? ' The fight was carried on the radio.' : '';
    const m = methodText(out);
    if (out.result === 'W') return `${y} defeated ${o} by ${m} before ${crowd}.${tvLine} ${out.kdFor ? `${opp.last} was on the floor ${out.kdFor === 1 ? 'once' : out.kdFor + ' times'}.` : ''} ${s.f.last} is now ${s.rec.w}-${s.rec.l}${s.rec.d ? '-' + s.rec.d : ''}.`;
    if (out.result === 'L') return `${o} beat ${y} by ${m} before ${crowd}.${tvLine} ${out.kdAgainst ? `${s.f.last} was down ${out.kdAgainst === 1 ? 'once' : out.kdAgainst + ' times'}.` : ''} "${pick(s, ['He was the better man tonight.', "I'll be back.", 'No excuses.', 'I want the rematch.'])}" ${s.f.last} said afterward.`;
    return `${y} and ${o} fought ${offer.rounds} hard rounds to a draw before ${crowd}.${tvLine} Nobody in the building agreed with anybody else about it.`;
  }

  // ---------- forced turns ----------
  function checkForced(s) {
    if (T.checkDiscoveries) T.checkDiscoveries(s);
    if (s.retired || s.phase === 'service') return;
    if (s.health <= 12 && !s.flags.forced_doc) { s.flags.forced_doc = true; s.inbox.push({ id: 'doctor_final', kind: 'event' }); }
    if (E.age(s) >= 40 && !s.flags.forced_age) { s.flags.forced_age = true; s.inbox.push({ id: 'too_old', kind: 'event' }); }
    if (s.champ && (s.c.champIdle || 0) >= 3 && !s.flags.strip_warned) { s.flags.strip_warned = true; s.inbox.push({ id: 'strip_warning', kind: 'event' }); }
  }

  // ---------- inbox ----------
  E.nextInbox = (s) => s.inbox[0] || null;
  E.resolveInbox = function (s, choiceIndex) {
    const item = s.inbox[0];
    if (!item) return null;
    if (item.kind === 'discovery') { s.inbox.shift(); const d = T.discoveryById(item.id); if (d && d.go) d.go(E.api(s)); return { text: '' }; }
    if (item.kind === 'digest') { s.inbox.shift(); return { text: '' }; }
    const ev = item.kind === 'history' ? T.historyById(item.id) : T.eventById(item.id);
    s.inbox.shift();
    if (!ev) return { text: '' };
    s.seen[ev.id] = s.t; s.c.events++;
    const x = E.api(s, item.data, E.pace(s).ek);
    const choices = typeof ev.choices === 'function' ? ev.choices(s, x) : ev.choices;
    let text = '', echo = false;
    if (choices && choices.length) {
      const ch = choices[clamp(choiceIndex | 0, 0, choices.length - 1)];
      if (ch.req && !ch.req(s)) return { text: 'That option is not available.' };
      // Remember which choice set things in motion, so later events can point back to it.
      const queued = s.queue.length;
      s.ctx = { t: s.t, id: ev.id, title: typeof ev.title === 'function' ? ev.title(s, x) : ev.title, choice: typeof ch.label === 'function' ? ch.label(s, x) : ch.label };
      try { text = ch.go ? ch.go(x) || '' : ''; } finally {
        const ctx = s.ctx; delete s.ctx;
        echo = s.queue.length > queued || Object.keys(s.why || {}).some((k) => s.why[k] === ctx && [...(watchers()[k] || [])].some((id) => id !== ev.id));
      }
      if (ch.label) s.decisions = (s.decisions || []).concat([{ t: s.t, ev: ev.id, title: typeof ev.title === 'function' ? ev.title(s, x) : ev.title, choice: ch.label }]).slice(-80);
    } else if (ev.go) text = ev.go(x) || '';
    if (text) note(s, text, item.kind === 'history' ? 'world' : 'life');
    checkForced(s);
    return { text, echo };
  };

  // Which flags other events and discoveries check for. A choice that sets one will come back.
  let watched = null;
  function watchers() {
    if (watched) return watched;
    watched = {};
    const scan = (id, fns) => {
      for (const fn of fns) {
        if (typeof fn !== 'function') continue;
        for (const m of String(fn).matchAll(/flags\.(\w+)|has\('(\w+)'\)|f\(s, '(\w+)'\)/g)) { const k = m[1] || m[2] || m[3]; (watched[k] = watched[k] || new Set()).add(id); }
      }
    };
    for (const ev of T.events || []) scan(ev.id, [ev.when, ev.weight, typeof ev.choices === 'function' ? ev.choices : null].concat(Array.isArray(ev.choices) ? ev.choices.map((c) => c.req) : []));
    for (const h of T.history || []) scan(h.id, [h.when, typeof h.choices === 'function' ? h.choices : null]);
    for (const d of T.discoveries || []) scan(d.id, [d.need]);
    return watched;
  }
  // The earlier choice that made this event possible, if there is one.
  E.because = function (s, item) {
    if (item.because) return item.because;
    if (!s.why || (item.kind !== 'event' && item.kind !== 'discovery')) return null;
    const ev = item.kind === 'discovery' ? T.discoveryById(item.id) : T.eventById(item.id);
    const fn = ev && (item.kind === 'discovery' ? ev.need : ev.when);
    if (typeof fn !== 'function') return null;
    const src = String(fn);
    let best = null;
    for (const k in s.why) {
      const w = s.why[k];
      if (!s.flags[k] || w.id === ev.id || s.t - w.t < 4 || (best && best.t >= w.t)) continue;
      if (new RegExp(`(^|[^!])(s\\.flags\\.${k}\\b|f\\(s, '${k}'\\)|has\\('${k}'\\))`).test(src)) best = w;
    }
    return best;
  };
  E.render = function (s, item) {
    if (item.cache) return item.cache;
    item.cache = renderItem(s, item);
    return item.cache;
  };
  function renderItem(s, item) {
    if (item.kind === 'discovery') { const d = T.discoveryById(item.id); return d ? { id: d.id, kind: 'discovery', title: d.name, text: d.text, mix: d.mix, kicker: 'New discovery', archive: '', art: null, link: null, because: E.because(s, item), choices: [{ label: 'Add it to the book', hint: '', ok: true }] } : null; }
    if (item.kind === 'digest') return { id: 'digest', kind: 'digest', title: 'Meanwhile, in the Papers', entries: item.entries || [], text: '', kicker: '', archive: '', art: null, link: null, choices: [{ label: 'Turn the page', hint: '', ok: true }] };
    const ev = item.kind === 'history' ? T.historyById(item.id) : T.eventById(item.id);
    if (!ev) return null;
    const x = E.api(s, item.data);
    const val = (v) => (typeof v === 'function' ? v(s, x) : v);
    const choices = ((typeof ev.choices === 'function' ? ev.choices(s, x) : ev.choices) || []).map((c) => ({ label: val(c.label), hint: val(c.hint) || '', ok: !c.req || c.req(s) }));
    return { id: ev.id, kind: item.kind, title: val(ev.title), text: val(ev.text), kicker: val(ev.kicker) || '', archive: val(ev.archive) || '', art: ev.art || null, link: ev.link || null, because: E.because(s, item), choices };
  }

  // ---------- the war ----------
  E.startService = function (s, branch, how) {
    s.phase = 'service';
    s.service = { branch, how, start: s.t, theater: null, wounded: false, exhibitions: 0, wasRetired: s.retired };
    s.offers = null; s.camp = null;
    if (s.champ) { s.flags.champ_frozen = true; }
    remember(s, 'war', how === 'drafted' ? `got drafted into the ${branch} in ${E.year(s.t)}` : how === 'exhibition' ? `boxed exhibitions for the troops in the ${branch}` : `enlisted in the ${branch} in ${E.year(s.t)}`, 3);
    E.achieve(s, 'served');
    note(s, `You report for duty in the ${branch}.`, 'world');
  };
  E.serviceStep = function (s) {
    if (s.phase !== 'service' || s.inbox.length) return null;
    const q = { 1: 1, 2: 1.5, 3: 2 }[E.pace(s).months] || 1;
    tick(s, Math.round(13 * q), 'service');
    // Bodies change in uniform: fitter, rustier.
    s.st.sta = clamp(s.st.sta + 0.8 * q, 5, 99); s.sharp = clamp(s.sharp - 8 * q, 0, 100);
    const warOver = s.t >= E.weekOf(1945, 8, 15);
    if (warOver && s.t >= E.weekOf(1945, 10, 1)) {
      if (!s.inbox.some((i) => i.id === 'homecoming')) s.inbox.push({ id: 'homecoming', kind: 'event' });
    } else {
      rollRandom(s, 1);
    }
    return { quarter: Math.round((s.t - s.service.start) / 13) };
  };
  E.endService = function (s) {
    const months = Math.round((s.t - s.service.start) / 4.33);
    s.flags.veteran = true; s.flags.gi_bill = true; s.service.months = months;
    if (s.retired) { s.phase = s.after ? 'after' : 'retired'; note(s, `Home after ${months} months in uniform.`, 'good'); return; }
    s.phase = 'between';
    s.flags.veteran = true; s.flags.gi_bill = true;
    const rust = clamp(months / 6, 1, 7);
    s.st.spd = clamp(s.st.spd - rust * 0.6, 5, 99); s.st.def = clamp(s.st.def - rust * 0.5, 5, 99); s.sharp = 5;
    s.elo = Math.max(1100, s.elo - months * 4);
    if (s.flags.champ_frozen) { s.flags.champ_frozen = false; }
    note(s, `Home after ${months} months in uniform. The ring feels smaller. The crowd feels bigger.`, 'good');
    s.service.months = months;
  };

  // ---------- retirement and the second act ----------
  E.PATHS = {
    trainer: { name: 'Trainer', blurb: 'Teach the next kid what took you a career to learn.', ok: () => true },
    gym: { name: 'Gym owner', blurb: 'Your name over the door. Your rules inside.', ok: (s) => s.money >= 3000 * E.eraMoney(s.t) || s.flags.gi_bill },
    referee: { name: 'Referee', blurb: 'Third man in the ring. Everyone yells at you.', ok: (s) => s.rep >= 5 && s.rec.w + s.rec.l >= E.nf(s, 15) },
    broadcaster: { name: 'Broadcaster', blurb: 'Call the fights for radio or TV. Talk for a living.', ok: (s) => s.fame >= 45 },
    promoter: { name: 'Promoter', blurb: 'Make the fights. Count the gate. Make enemies.', ok: (s) => s.money >= 6000 * E.eraMoney(s.t) && s.fame >= 25 },
    business: { name: 'Restaurant owner', blurb: 'Dempsey did it. Steaks, photos on the wall, a handshake at the door.', ok: (s) => s.money >= 8000 * E.eraMoney(s.t) || (s.fame >= 60 && s.money >= 3000) },
    politics: { name: 'Run for office', blurb: 'City council first. People know your face.', ok: (s) => s.fame >= 55 && s.rep >= 15 },
    factory: { name: 'Back to work', blurb: 'A union card, a steady check, a lunch pail. Not everybody gets a second act.', ok: () => true },
  };
  E.retire = function (s, reason) {
    if (s.retired) return;
    s.retired = true; s.phase = 'retired'; s.flags.retire_money = s.money;
    s.retireT = s.t; s.retireReason = reason || 'chose';
    if (s.champ) { s.flags.retired_champ = true; s.champ = false; const top = E.rankings(s).find((r) => r.id !== 0); if (top) s.world.champId = top.id; }
    s.offers = null; s.camp = null;
    const rec = `${s.rec.w}-${s.rec.l}${s.rec.d ? '-' + s.rec.d : ''}`;
    remember(s, 'retire', reason === 'doctor' ? `retired at ${E.age(s)} when the doctors made me (${rec}, ${s.rec.ko} KOs)` : reason === 'age' ? `retired at ${E.age(s)} when the commission said I was too old (${rec})` : `retired at ${E.age(s)} on my own terms (${rec}, ${s.rec.ko} KOs)`, 3);
    if (s.fights.length >= E.nf(s, 20) && s.rec.kod === 0) E.achieve(s, 'iron_chin');
    if (s.fights.length >= E.nf(s, 15) && s.rec.l === 0) E.achieve(s, 'unbeaten');
    if (!s.flags.ever_crooked && s.flags.refused_mob) E.achieve(s, 'clean');
    if (s.money >= 25000) E.achieve(s, 'rich');
    if (s.c.earned >= 10000 && s.money < 500) E.achieve(s, 'broke');
  };
  E.choosePath = function (s, path) {
    if (!E.PATHS[path]) path = 'factory';
    s.after = { path, start: s.t, years: 0, wealth: 0, standing: 0 };
    s.phase = 'after';
    if (path === 'gym') E.achieve(s, 'gym');
    if (path === 'gym' && s.money >= 3000 * E.eraMoney(s.t)) s.money -= Math.round(2500 * E.eraMoney(s.t));
    if (path === 'promoter') s.money -= Math.round(3000 * E.eraMoney(s.t));
    if (path === 'business') s.money -= Math.round(4000 * E.eraMoney(s.t));
    remember(s, 'path', {
      trainer: 'became a trainer', gym: 'opened my own gym', referee: 'became a referee', broadcaster: 'called fights on the air', promoter: 'became a promoter',
      business: 'opened a restaurant with my fight pictures on the wall', politics: 'ran for city council', factory: 'went back to the factory with a union card',
    }[path], 2);
  };
  // One year of life after boxing.
  E.afterStep = function (s) {
    if (s.phase !== 'after' || s.inbox.length) return null;
    const a = s.after;
    const yrs = a.years < 2 ? 1 : a.years < 6 ? int(s, 1, 3) : int(s, 2, 4);
    for (let i = 0; i < yrs; i++) {
      tick(s, 52, 'after');
      const income = { trainer: 700, gym: 1000, referee: 800, broadcaster: 2200, promoter: 1800, business: 2000, politics: 1200, factory: 1100 }[a.path];
      s.money += Math.round(income * between(s, 0.6, 1.4) * E.eraMoney(s.t));
      a.years++;
    }
    s.inbox = s.inbox.filter((i) => i.kind === 'history' || i.kind === 'digest' || T.eventById(i.id) && (T.eventById(i.id).after || T.eventById(i.id).anyPhase));
    rollRandom(s, 1);
    if (E.year(s.t) >= 1960) E.achieve(s, 'long_life');
    if (T.checkDiscoveries) T.checkDiscoveries(s);
    const done = E.year(s.t) >= D.END_YEAR || a.years >= 24;
    if (done) s.phase = 'done';
    return { years: yrs, done };
  };
  E.finish = function (s) { s.phase = 'done'; };

  // ---------- achievements ----------
  E.achieve = function (s, id) { if (!s.ach.includes(id)) { s.ach.push(id); s.newAch = (s.newAch || []).concat(id); } };

  // ---------- the legacy ----------
  E.legacy = function (s) {
    const parts = [];
    const add = (label, n) => { if (n) parts.push({ label, n: Math.round(n) }); };
    const kf = E.pace(s).kf; // fight counts weigh the same at every game length
    add('Wins', s.rec.w * 1.5 * kf);
    add('Knockouts', s.rec.ko * 0.75 * kf);
    add('World titles', s.belts * 40);
    add('Title defenses', (s.titleDefenses * 10 + (s.flags.def_total || 0)) * Math.sqrt(kf));
    add('Fame', s.fame * 0.4);
    add('Reputation', s.rep * 0.5);
    add('Beat your rival', (s.flags.rival_wins || 0) * 8 * Math.sqrt(kf));
    add('Served in the war', s.flags.veteran ? 12 : 0);
    add('Losses', -s.rec.l * kf);
    add('Second act', s.after ? Math.min(12, s.after.years) + (s.after.standing || 0) * 0.6 : 0);
    add('Money in the bank', Math.min(30, Math.max(-10, s.money / 1000)));
    if (s.ambition && E.AMBITIONS[s.ambition] && E.AMBITIONS[s.ambition].done(s)) add(`Ambition: ${E.ambName(s, s.ambition).toLowerCase()}`, E.AMBITIONS[s.ambition].reward);
    if (E.hasGear(s, 'house')) add('Bought the family a house', 8);
    const total = parts.reduce((n, p) => n + p.n, 0);
    const tier = total >= 300 ? 'Immortal' : total >= 215 ? 'Hall of Famer' : total >= 150 ? 'Contender' : total >= 100 ? 'Journeyman' : total >= 50 ? 'Tough Customer' : 'A Hard Life';
    return { parts, total, tier };
  };

  // The career, told in the first person.
  E.tellStory = function (s) {
    const by = (k) => s.story.filter((x) => x.key === k);
    const first = (k) => by(k)[0];
    const out = [];
    const start = first('start');
    out.push(`${start ? start.text : 'I started boxing'}, ${D.BACKGROUNDS[s.f.bg].who} who ${{ slugger: 'hit hard', boxer: 'liked to make them miss', swarmer: 'never stopped coming forward', counter: 'waited for mistakes' }[s.f.style]}.`);
    const keys = ['first_win', 'first_loss', 'rival', 'title_shot', 'title_won', 'defense', 'title_lost', 'war', 'tv', 'mob', 'injury', 'comeback', 'abroad', 'civil', 'family', 'scandal', 'money'];
    const picked = s.story.filter((x) => keys.includes(x.key)).sort((a, b) => a.t - b.t);
    const seen = new Set();
    const lines = [];
    for (const m of picked) {
      const k = m.key + (m.key === 'rival' || m.key === 'defense' ? '' : '');
      if (m.key !== 'rival' && seen.has(k)) continue;
      if (m.key === 'rival' && lines.filter((l) => l.key === 'rival').length >= 2) continue;
      seen.add(k); lines.push(m);
    }
    const ranked = lines.sort((a, b) => b.weight - a.weight).slice(0, 7).sort((a, b) => a.t - b.t);
    const ret = first('retire');
    const line = (m) => `${m.age ? `At ${m.age}, I ` : 'I '}${m.text}.`;
    for (const m of ranked) if (!ret || m.t <= ret.t) out.push(line(m));
    if (ret) out.push(`I ${ret.text}.`);
    const p = first('path'); if (p) out.push(`After that, I ${p.text}${s.after ? ` and stayed at it ${s.after.years} year${s.after.years === 1 ? '' : 's'}` : ''}.`);
    if (ret) for (const m of ranked) if (m.t > ret.t) out.push(line(m));
    const final = s.money > 20000 ? 'I never had to worry about money again.' : s.money < 200 ? 'Most of the money was gone by the end. The stories stayed.' : 'I had enough. That is more than a lot of fighters can say.';
    out.push(final);
    return out.join(' ');
  };

  E.discussion = function (s) {
    const q = [];
    if (s.flags.ever_crooked) q.push('Your fighter took money from the mob. What pressures in that era made a fix possible, and who was hurt by it?');
    else if (s.flags.refused_mob) q.push('Your fighter refused a crooked deal. What did that cost, and was it worth it?');
    if (s.flags.veteran) q.push('Your fighter served in World War II. How did the war change sports careers, and what did fighters like Joe Louis give up?');
    if (s.flags.first_tv) q.push('Television changed boxing in the 1950s. Who won and who lost when fights moved from local clubs to living rooms?');
    if (s.flags.tate_story) q.push(`Deacon Tate was one of the best fighters in the gym but could not get a title shot. What was the color line, and how did it shape boxing in the 1930s and 1940s?`);
    if (s.money < 500 && s.c.earned > 5000) q.push('Your fighter earned real money and ended up with little of it. Where did it go? How did managers and promoters get paid first?');
    if (s.champ || s.flags.ever_champ) q.push('Your fighter became champion. Which historical events gave you that opportunity, and which ones nearly took it away?');
    q.push('Pick one decision you made. If you could change it, what would you do differently, and why?');
    q.push('Which historical event in your career affected your fighter the most? Explain how.');
    return q.slice(0, 4);
  };
})(globalThis.TOT = globalThis.TOT || {});
