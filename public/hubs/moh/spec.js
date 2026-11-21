/*
 * Medal of Honor project · the one list of steps and answer boxes.
 * The project page, the printed paper and the teacher page all read this list,
 * so a box only has to be described once.
 *
 * owner "a" boxes belong to Partner A (Poster Lead), owner "b" boxes to Partner B
 * (Screen Lead). A student working alone owns both, except Partner B's reflection,
 * because every student writes exactly one reflection of their own.
 */
(function (root) {
  'use strict';
  var STEPS = [
    { id: 'facts', n: 1, title: 'Meet your veteran', short: 'Fact file', day: 'Day 1',
      intro: 'Open your veteran\'s page and find each fact. Write each one as a short sentence in your own words.' },
    { id: 'words', n: 2, title: 'Crack the citation', short: 'Hard words', day: 'Day 1',
      intro: 'The citation is the official paper that explains why he got the medal. Pick three hard words from it and explain each one like you would to a friend.' },
    { id: 'story1', n: 3, title: 'Write your first chapter', short: 'Chapter one', day: 'Day 2',
      intro: 'Answer one box at a time. Two or three sentences per box is plenty. When you finish, your boxes become a chapter of the report.' },
    { id: 'story2', n: 4, title: 'Write your second chapter', short: 'Chapter two', day: 'Day 3',
      intro: 'Same plan: one box at a time, two or three sentences each.' },
    { id: 'why', n: 5, title: 'Why he matters', short: 'Why he matters', day: 'Day 4',
      intro: 'This part is just yours. Your partner writes their own.' },
    { id: 'art', n: 6, title: 'Make your art piece', short: 'Art piece', day: 'Days 4 to 6',
      intro: 'Plan your piece here, then make it. Each partner makes a different piece.' },
    { id: 'finish', n: 7, title: 'Finish and turn in', short: 'Finish', day: 'Day 7',
      intro: 'Check your jobs, look over the full paper, and press Turn In.' }
  ];

  var CHAPTERS = {
    before: { title: 'Before the War', owner: 'a' },
    day: { title: 'The Day He Earned the Medal', owner: 'b' },
    cite: { title: 'The Citation in Plain English', owner: 'a' },
    after: { title: 'After the War', owner: 'b' }
  };

  // kind: fact, word, meaning, box (chapter sentence box), why, short, gen (page made, not typed)
  var FIELDS = [
    { id: 'moh-a-fact-born', step: 'facts', owner: 'a', kind: 'fact', min: 15, label: 'Where and when was he born?', ph: 'He was born in ... on ...', paper: 'Born' },
    { id: 'moh-a-fact-before', step: 'facts', owner: 'a', kind: 'fact', min: 20, label: 'What did he do before the war? Name a job, a school or someone in his family.', ph: 'Before the war he ...', paper: 'Before the war' },
    { id: 'moh-a-fact-join', step: 'facts', owner: 'a', kind: 'fact', min: 20, label: 'How and when did he join the military?', ph: 'He joined in ...', paper: 'Joining up' },
    { id: 'moh-b-fact-unit', step: 'facts', owner: 'b', kind: 'fact', min: 15, label: 'What was his rank and unit when he earned the medal?', ph: 'He was a ... in the ...', paper: 'Rank and unit' },
    { id: 'moh-b-fact-day', step: 'facts', owner: 'b', kind: 'fact', min: 20, label: 'When and where did he earn the Medal of Honor?', ph: 'On ... near ...', paper: 'The action' },
    { id: 'moh-b-fact-end', step: 'facts', owner: 'b', kind: 'fact', min: 20, label: 'When did he receive the medal, and when did he die?', ph: 'He received the medal in ...', paper: 'The medal and his death' },

    { id: 'moh-a-word-1', step: 'words', owner: 'a', kind: 'word', min: 3, label: 'Hard word 1 from the citation', ph: 'Type the word' },
    { id: 'moh-a-mean-1', step: 'words', owner: 'a', kind: 'meaning', min: 10, label: 'What hard word 1 means, in your own words', ph: 'It means ...' },
    { id: 'moh-a-word-2', step: 'words', owner: 'a', kind: 'word', min: 3, label: 'Hard word 2 from the citation', ph: 'Type the word' },
    { id: 'moh-a-mean-2', step: 'words', owner: 'a', kind: 'meaning', min: 10, label: 'What hard word 2 means, in your own words', ph: 'It means ...' },
    { id: 'moh-a-word-3', step: 'words', owner: 'a', kind: 'word', min: 3, label: 'Hard word 3 from the citation', ph: 'Type the word' },
    { id: 'moh-a-mean-3', step: 'words', owner: 'a', kind: 'meaning', min: 10, label: 'What hard word 3 means, in your own words', ph: 'It means ...' },
    { id: 'moh-b-word-1', step: 'words', owner: 'b', kind: 'word', min: 3, label: 'Hard word 4 from the citation', ph: 'Type the word' },
    { id: 'moh-b-mean-1', step: 'words', owner: 'b', kind: 'meaning', min: 10, label: 'What hard word 4 means, in your own words', ph: 'It means ...' },
    { id: 'moh-b-word-2', step: 'words', owner: 'b', kind: 'word', min: 3, label: 'Hard word 5 from the citation', ph: 'Type the word' },
    { id: 'moh-b-mean-2', step: 'words', owner: 'b', kind: 'meaning', min: 10, label: 'What hard word 5 means, in your own words', ph: 'It means ...' },
    { id: 'moh-b-word-3', step: 'words', owner: 'b', kind: 'word', min: 3, label: 'Hard word 6 from the citation', ph: 'Type the word' },
    { id: 'moh-b-mean-3', step: 'words', owner: 'b', kind: 'meaning', min: 10, label: 'What hard word 6 means, in your own words', ph: 'It means ...' },

    { id: 'moh-a-before-1', step: 'story1', owner: 'a', kind: 'box', chapter: 'before', min: 60, label: 'Where did he grow up? Who was in his family?', ph: 'He grew up in ...' },
    { id: 'moh-a-before-2', step: 'story1', owner: 'a', kind: 'box', chapter: 'before', min: 60, label: 'What was his life like before the war? What did he do for work or school?', ph: 'Before the war, he ...' },
    { id: 'moh-a-before-3', step: 'story1', owner: 'a', kind: 'box', chapter: 'before', min: 60, label: 'How did he end up in the military and in the war?', ph: 'In 1917, ...' },
    { id: 'moh-b-day-1', step: 'story1', owner: 'b', kind: 'box', chapter: 'day', min: 60, label: 'Set the scene. When and where was the fight, and what was his job there?', ph: 'On ..., his unit was ...' },
    { id: 'moh-b-day-2', step: 'story1', owner: 'b', kind: 'box', chapter: 'day', min: 60, label: 'What was the danger? What went wrong?', ph: 'The problem was ...' },
    { id: 'moh-b-day-3', step: 'story1', owner: 'b', kind: 'box', chapter: 'day', min: 100, label: 'What did he do? Tell it in order: first, next, then.', ph: 'First, he ...' },

    { id: 'moh-a-cite-1', step: 'story2', owner: 'a', kind: 'box', chapter: 'cite', part: 0, min: 50, label: 'Part 1 of the citation, rewritten in your own words', ph: 'This part says that ...' },
    { id: 'moh-a-cite-2', step: 'story2', owner: 'a', kind: 'box', chapter: 'cite', part: 1, min: 50, label: 'Part 2 of the citation, rewritten in your own words', ph: 'Next, it says ...' },
    { id: 'moh-a-cite-3', step: 'story2', owner: 'a', kind: 'box', chapter: 'cite', part: 2, min: 50, label: 'Part 3 of the citation, rewritten in your own words', ph: 'At the end, it says ...' },
    { id: 'moh-b-after-1', step: 'story2', owner: 'b', kind: 'box', chapter: 'after', min: 60, label: 'What happened to him right after the fight?', ph: 'After the fight, he ...' },
    { id: 'moh-b-after-2', step: 'story2', owner: 'b', kind: 'box', chapter: 'after', min: 60, label: 'When did he get the Medal of Honor? If it came late, why?', ph: 'He received the medal ...' },
    { id: 'moh-b-after-3', step: 'story2', owner: 'b', kind: 'box', chapter: 'after', min: 60, label: 'How is he remembered today?', ph: 'Today, ...' },

    { id: 'moh-a-why-1', step: 'why', owner: 'a', kind: 'why', min: 80, label: 'Which moment in his story surprised you the most? Why?', ph: 'The moment that surprised me most was ...' },
    { id: 'moh-a-why-2', step: 'why', owner: 'a', kind: 'why', min: 80, label: 'What does his story show you about courage, or about America in 1918?', ph: 'His story shows ...' },
    { id: 'moh-b-why-1', step: 'why', owner: 'b', kind: 'why', min: 80, label: 'Which moment in his story surprised you the most? Why?', ph: 'The moment that surprised me most was ...' },
    { id: 'moh-b-why-2', step: 'why', owner: 'b', kind: 'why', min: 80, label: 'What does his story show you about courage, or about America in 1918?', ph: 'His story shows ...' },

    { id: 'moh-a-poster-head', step: 'art', owner: 'a', kind: 'short', min: 4, label: 'Poster headline, five words or fewer', ph: 'Only One of Us Can Get Out' },
    { id: 'moh-a-poster-scene', step: 'art', owner: 'a', kind: 'short', min: 30, label: 'What will you draw in the middle? Describe the scene in one sentence.', ph: 'I will draw ...' },
    { id: 'moh-a-poster-fact-1', step: 'art', owner: 'a', kind: 'short', min: 10, label: 'Fact box 1 for the poster', ph: 'Born: ...' },
    { id: 'moh-a-poster-fact-2', step: 'art', owner: 'a', kind: 'short', min: 10, label: 'Fact box 2 for the poster', ph: 'Unit: ...' },
    { id: 'moh-a-poster-fact-3', step: 'art', owner: 'a', kind: 'short', min: 10, label: 'Fact box 3 for the poster', ph: 'The day: ...' },
    { id: 'moh-a-poster-fact-4', step: 'art', owner: 'a', kind: 'short', min: 10, label: 'Fact box 4 for the poster', ph: 'Number to remember: ...' },
    { id: 'moh-a-poster-quote', step: 'art', owner: 'a', kind: 'short', min: 15, label: 'A quote from the citation for your poster, 12 words or fewer', ph: 'Copy a few words from the citation' },
    { id: 'moh-a-poster-layout', step: 'art', owner: 'a', kind: 'gen', min: 1, label: 'Poster layout choice' },
    { id: 'moh-a-poster-status', step: 'art', owner: 'a', kind: 'gen', min: 1, label: 'Poster progress', done: 'Done' },
    { id: 'moh-b-screen-title', step: 'art', owner: 'b', kind: 'short', min: 4, label: 'Screen title, five words or fewer', ph: 'He Went Back for Them' },
    { id: 'moh-b-screen-caption', step: 'art', owner: 'b', kind: 'short', min: 30, label: 'One sentence that explains your picture', ph: 'This shows the moment when ...' },
    { id: 'moh-b-screen-quote', step: 'art', owner: 'b', kind: 'short', min: 15, label: 'A quote from the citation for your screen, 12 words or fewer', ph: 'Copy a few words from the citation' },
    { id: 'moh-b-screen-data', step: 'art', owner: 'b', kind: 'gen', min: 30, label: 'Memorial screen design' }
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
  // Split a citation into three parts on sentence boundaries, as even as possible.
  function citationParts(text) {
    var sentences = String(text || '').match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g) || [String(text || '')];
    sentences = sentences.map(function (s) { return s.trim(); }).filter(Boolean);
    if (sentences.length <= 3) {
      while (sentences.length < 3) {
        var longest = sentences.reduce(function (best, s, i) { return s.length > sentences[best].length ? i : best; }, 0);
        var s = sentences[longest], cut = s.indexOf(', ', Math.floor(s.length / 2));
        if (cut < 0) cut = s.lastIndexOf(', ', Math.floor(s.length / 2));
        if (cut < 0) { sentences.push(''); continue; }
        sentences.splice(longest, 1, s.slice(0, cut + 1), s.slice(cut + 2));
      }
      return sentences.slice(0, 3);
    }
    var total = sentences.join(' ').length, parts = ['', '', ''], target = total / 3, part = 0, used = 0;
    sentences.forEach(function (s, i) {
      var left = sentences.length - i;
      if (part < 2 && parts[part] && (used + s.length / 2 > target * (part + 1) || left <= 2 - part)) part++;
      parts[part] = (parts[part] ? parts[part] + ' ' : '') + s;
      used += s.length + 1;
    });
    return parts;
  }
  function paragraph(values) {
    return values.map(function (v) {
      v = String(v || '').replace(/\s+/g, ' ').trim();
      if (v && !/[.!?"')]$/.test(v)) v += '.';
      return v;
    }).filter(Boolean).join(' ');
  }
  function age(born, on) {
    var b = new Date(born + 'T12:00:00'), d = new Date(on + 'T12:00:00');
    var a = d.getFullYear() - b.getFullYear();
    if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) a--;
    return a;
  }
  function niceDate(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  var HUB = 'ush9-medal-of-honor-project';
  var BRANCH_LABEL = { army: 'Army', marines: 'Marine Corps', navy: 'Navy', air: 'Air Service' };
  var FILTERS = [
    ['all', 'Everyone'], ['meuse', 'Meuse-Argonne'], ['killed', 'Gave his life'], ['late', 'Medal came late'],
    ['immigrant', 'Born in another country'], ['michigan', 'Michigan'], ['air', 'Pilots'], ['marines', 'Marines'], ['navy', 'Navy'], ['lostbattalion', 'Lost Battalion'], ['belleau', 'Belleau Wood']
  ];
  root.MOH = { STEPS: STEPS, FIELDS: FIELDS, CHAPTERS: CHAPTERS, owns: owns, done: done, citationParts: citationParts, paragraph: paragraph, age: age, niceDate: niceDate, HUB: HUB, BRANCH_LABEL: BRANCH_LABEL, FILTERS: FILTERS };
})(typeof window !== 'undefined' ? window : globalThis);
