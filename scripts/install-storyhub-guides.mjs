import { readFile, writeFile } from 'node:fs/promises';

const configs = [
  {
    file: 'bts-s01-the-death-harvest.html',
    sections: ['The tally', 'Five yards in three downs', 'The numbers do not reconcile', 'The White House', 'Harold Moore', 'The new rules', 'What happened next', 'The second crisis', 'The rules that worked', 'Who was actually dying?', 'What the organization became', 'The one that did not get fixed'],
    recap: [
      'Newspapers assembled a national death tally before any official collector existed.',
      'The 1905 rules rewarded mass momentum and concentrated bodies into the pile.',
      'Roosevelt applied pressure, but colleges—not the President—controlled the rule book.',
      'The December 1905 reform body became the NCAA in 1910.',
      'The forward pass arrived with restrictions; broader changes in 1910 and 1912 mattered too.',
      'The crisis continued because many victims played outside elite college football and concussion remained unsolved.'
    ]
  },
  {
    file: 'hh-s01-the-desk-it-stopped-at.html',
    sections: ['The page', 'Where it came from', 'What it proposed', 'Lyman Lemnitzer', 'The desk it stopped at', 'Thirty-five years', 'The claim drifts', 'Do not shrink it', 'Do not inflate it', 'What the document is'],
    recap: [
      'A genuine March 13, 1962 memorandum proposed manufactured pretexts for war with Cuba.',
      'The Joint Chiefs signed and transmitted the proposal to Secretary of Defense Robert McNamara.',
      'The Joint Chiefs advised; they could not independently authorize or execute the plan.',
      'No approval, directive, tasking, operational record, or after-action report has been found.',
      'A 1992 records law led to the memorandum’s public release in 1997.',
      'The mature conclusion keeps both facts: it was seriously proposed and it was not approved or carried out.'
    ]
  },
  {
    file: 'ush9-s01-the-margin.html',
    sections: ['The specification', 'Four decisions', 'Sixty-one names', 'Everyone knew it leaked', 'The rain', 'The morning', 'The dam gave way', 'Fourteen miles', 'The stone bridge', 'What was counted', 'Nobody paid', 'The road'],
    recap: [
      'The original public dam had a spillway and five pipes that could deliberately lower the lake.',
      'Four ordinary decisions removed pipes, weakened repair, lowered the crest, and obstructed the spillway.',
      'Warnings existed, but no effective regulator forced the private owners to restore the system.',
      'Extreme rain met a dam with reduced capacity and a valley without a reliable evacuation system.',
      'The flood crossed fourteen populated miles and killed an accepted 2,209 people.',
      'Every lawsuit failed; survivors and outside donors absorbed the loss.',
      'Engineers still dispute the alternate outcome, but agree that the club spent away safety margin.'
    ]
  }
];

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

for (const config of configs) {
  const file = new URL(`../public/hubs/${config.file}`, import.meta.url);
  let html = await readFile(file, 'utf8');
  if (html.includes('data-gold-guide')) {
    console.log(`${config.file}: lesson guide already installed.`);
    continue;
  }

  const nav = [];
  for (const [index, title] of config.sections.entries()) {
    const needle = `<h2>${title}</h2>`;
    if (!html.includes(needle)) throw new Error(`${config.file}: missing guide heading ${title}`);
    const id = `story-${String(index + 1).padStart(2, '0')}-${slug(title)}`;
    html = html.replace(needle, `<h2 id="${id}" data-gold-anchor>${title}</h2>`);
    nav.push(`<li><a href="#${id}">${String(index + 1).padStart(2, '0')} · ${title}</a></li>`);
  }

  const button = '<button type="button" class="btn gold-guide-open" data-gold-guide-open aria-controls="goldGuide" aria-expanded="false">Guide</button>';
  const today = '<a class="btn" href="/hubs/substitute-day-2026-09-08.html">Today</a>';
  if (!html.includes(today)) throw new Error(`${config.file}: missing Today link.`);
  html = html.replace(today, `${button}${today}`);

  const guide = `<div class="gold-guide-shade" data-gold-guide-shade></div><aside class="gold-guide" id="goldGuide" data-gold-guide aria-label="Lesson index and recap" aria-hidden="true"><div class="gold-guide__head"><h2>Lesson guide</h2><button type="button" data-gold-guide-close>Close</button></div><nav aria-label="Story sections"><ol>${nav.join('')}</ol></nav><div class="gold-guide__recap"><h3>The story in 60 seconds</h3><ol>${config.recap.map(item => `<li>${item}</li>`).join('')}</ol></div></aside>`;
  const notes = '<aside class="notes" id="notes">';
  if (!html.includes(notes)) throw new Error(`${config.file}: missing notes drawer.`);
  html = html.replace(notes, `${guide}${notes}`);

  const artScript = '<script src="/storyhub/subday-20260908/storyhub-art.js"></script>';
  const goldScript = '<script src="/storyhub/subday-20260908/storyhub-gold.js"></script>';
  if (!html.includes(goldScript)) {
    if (!html.includes(artScript)) throw new Error(`${config.file}: missing art script.`);
    html = html.replace(artScript, `${artScript}${goldScript}`);
  }

  await writeFile(file, html);
  console.log(`${config.file}: installed lesson guide.`);
}
