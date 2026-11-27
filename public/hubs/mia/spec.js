/*
 * Michigan Athlete Report · the one list of steps and answer boxes.
 * The project page, the printed paper and the teacher page all read this list.
 *
 * Box ids keep the moh-a-* and moh-b-* names on purpose. The Turn In script
 * hands a partner's answers across only for keys on its Medal of Honor owner
 * list, so reusing those keys gives this project working teams with no change
 * to the live Apps Script. The words, poster and screen keys are not used here.
 *
 * owner "a" boxes belong to Partner A (The Early Years), owner "b" boxes to
 * Partner B (The Career). A student working alone owns both, except Partner B's
 * reflection, because every student writes exactly one reflection of their own.
 */
(function (root) {
  'use strict';
  var STEPS = [
    { id: 'facts', n: 1, title: 'Meet your athlete', short: 'Fact file', day: 'Day 1',
      intro: 'Open your athlete\'s page and find each fact. Write each one as a short sentence in your own words.' },
    { id: 'story1', n: 2, title: 'Write your first chapter', short: 'Chapter one', day: 'Day 1',
      intro: 'Answer one box at a time. Two or three sentences per box is plenty. When you finish, your boxes become a chapter of the report.' },
    { id: 'story2', n: 3, title: 'Write your second chapter', short: 'Chapter two', day: 'Day 2',
      intro: 'Same plan: one box at a time, two or three sentences each.' },
    { id: 'why', n: 4, title: 'Why this story matters', short: 'Why it matters', day: 'Day 2',
      intro: 'This part is just yours. Your partner writes their own.' },
    { id: 'finish', n: 5, title: 'Finish and turn in', short: 'Finish', day: 'Day 2',
      intro: 'Check your jobs, look over the full report, and press Turn In.' }
  ];

  var CHAPTERS = {
    before: { title: 'Growing Up in Michigan', owner: 'a', source: 'growingUp', where: 'Growing Up' },
    day: { title: 'The Big Moment', owner: 'b', source: 'bigMoment', where: 'The Big Moment' },
    cite: { title: 'Beyond the Scoreboard', owner: 'a', source: 'beyond', where: 'Beyond the Scoreboard' },
    after: { title: 'Legacy', owner: 'b', source: 'legacy', where: 'Legacy' }
  };

  // kind: fact, box (chapter sentence box), why
  var FIELDS = [
    { id: 'moh-a-fact-born', step: 'facts', owner: 'a', kind: 'fact', min: 15, label: 'Where and when was this athlete born?', ph: 'This athlete was born in ... on ...', paper: 'Born' },
    { id: 'moh-a-fact-before', step: 'facts', owner: 'a', kind: 'fact', min: 20, label: 'What ties this athlete to Michigan? Name a town, a school or a team.', ph: 'Their Michigan roots are ...', paper: 'Michigan roots' },
    { id: 'moh-a-fact-join', step: 'facts', owner: 'a', kind: 'fact', min: 20, label: 'When and how did they start their sport?', ph: 'They started playing when ...', paper: 'Getting started' },
    { id: 'moh-b-fact-unit', step: 'facts', owner: 'b', kind: 'fact', min: 15, label: 'What sport, position and teams are they known for?', ph: 'They played ... for ...', paper: 'Sport and teams' },
    { id: 'moh-b-fact-day', step: 'facts', owner: 'b', kind: 'fact', min: 20, label: 'What was their biggest moment? Give the date and the place.', ph: 'On ... in ..., they ...', paper: 'Biggest moment' },
    { id: 'moh-b-fact-end', step: 'facts', owner: 'b', kind: 'fact', min: 20, label: 'How did their career end, or what are they doing now?', ph: 'Their career ended when ...', paper: 'After the game' },

    { id: 'moh-a-before-1', step: 'story1', owner: 'a', kind: 'box', chapter: 'before', min: 60, label: 'Where did they grow up? Who was in their family?', ph: 'They grew up in ...' },
    { id: 'moh-a-before-2', step: 'story1', owner: 'a', kind: 'box', chapter: 'before', min: 60, label: 'What was their town or neighborhood like when they were young?', ph: 'Back then, their town was ...' },
    { id: 'moh-a-before-3', step: 'story1', owner: 'a', kind: 'box', chapter: 'before', min: 60, label: 'How did they get started in their sport? Who helped them?', ph: 'They started when ...' },
    { id: 'moh-b-day-1', step: 'story1', owner: 'b', kind: 'box', chapter: 'day', min: 60, label: 'Set the scene. When and where did it happen, and what was on the line?', ph: 'On ..., in ..., ...' },
    { id: 'moh-b-day-2', step: 'story1', owner: 'b', kind: 'box', chapter: 'day', min: 60, label: 'What made it hard? Who or what stood in the way?', ph: 'The hard part was ...' },
    { id: 'moh-b-day-3', step: 'story1', owner: 'b', kind: 'box', chapter: 'day', min: 100, label: 'What did they do? Tell it in order: first, next, then.', ph: 'First, they ...' },

    { id: 'moh-a-cite-1', step: 'story2', owner: 'a', kind: 'box', chapter: 'cite', min: 60, label: 'What did this athlete face away from the game? Think about race, money, injury or where they came from.', ph: 'Away from the game, they faced ...' },
    { id: 'moh-a-cite-2', step: 'story2', owner: 'a', kind: 'box', chapter: 'cite', min: 60, label: 'How did people react to them at the time? Think about fans, reporters and their hometown.', ph: 'At the time, people ...' },
    { id: 'moh-a-cite-3', step: 'story2', owner: 'a', kind: 'box', chapter: 'cite', min: 60, label: 'What does their story show about Michigan or America in their time?', ph: 'Their story shows ...' },
    { id: 'moh-b-after-1', step: 'story2', owner: 'b', kind: 'box', chapter: 'after', min: 60, label: 'What happened in their career after the big moment?', ph: 'After that, they ...' },
    { id: 'moh-b-after-2', step: 'story2', owner: 'b', kind: 'box', chapter: 'after', min: 60, label: 'What records, awards or honors did they earn? Use at least one number.', ph: 'They earned ...' },
    { id: 'moh-b-after-3', step: 'story2', owner: 'b', kind: 'box', chapter: 'after', min: 60, label: 'How is this athlete remembered in Michigan today?', ph: 'Today, ...' },

    { id: 'moh-a-why-1', step: 'why', owner: 'a', kind: 'why', min: 80, label: 'Which moment in this story surprised you the most? Why?', ph: 'The moment that surprised me most was ...' },
    { id: 'moh-a-why-2', step: 'why', owner: 'a', kind: 'why', min: 80, label: 'What does this story teach you that a box score never could?', ph: 'A box score would not show ...' },
    { id: 'moh-b-why-1', step: 'why', owner: 'b', kind: 'why', min: 80, label: 'Which moment in this story surprised you the most? Why?', ph: 'The moment that surprised me most was ...' },
    { id: 'moh-b-why-2', step: 'why', owner: 'b', kind: 'why', min: 80, label: 'What does this story teach you that a box score never could?', ph: 'A box score would not show ...' }
  ];

  // A student working alone owns every box except Partner B's reflection.
  function owns(role, field) {
    if (role === 'solo') return !(field.owner === 'b' && field.kind === 'why');
    return field.owner === String(role || '').toLowerCase();
  }
  function done(field, value) {
    var v = String(value || '').trim();
    if (field.done) return v === field.done;
    return v.length >= field.min;
  }
  function paragraph(values) {
    return values.map(function (v) {
      v = String(v || '').replace(/\s+/g, ' ').trim();
      if (v && !/[.!?"')]$/.test(v)) v += '.';
      return v;
    }).filter(Boolean).join(' ');
  }
  function niceDate(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T12:00:00');
    if (isNaN(d)) return String(iso);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  var HUB = 'bts-michigan-athletes-project';
  var FILTERS = [
    ['all', 'Everyone'], ['women', 'Women'], ['olympics', 'Olympians'], ['boxing', 'Boxing'], ['basketball', 'Basketball'],
    ['baseball', 'Baseball'], ['football', 'Football'], ['hockey', 'Hockey'], ['detroit', 'Metro Detroit'], ['flint', 'Flint'], ['mid', 'Mid Michigan and Kalamazoo']
  ];
  root.MOH = { STEPS: STEPS, FIELDS: FIELDS, CHAPTERS: CHAPTERS, owns: owns, done: done, paragraph: paragraph, niceDate: niceDate, HUB: HUB, FILTERS: FILTERS };
})(typeof window !== 'undefined' ? window : globalThis);
