const $ = (selector) =>
  document.querySelector(selector);
const $$ = (selector) =>
  Array.from(document.querySelectorAll(selector));
// desk-save.js handles all student-answer persistence, PIN restore and Turn In.
// Only ephemeral activity selections are held here; never duplicate answer storage.
const state = {};
function updateWords() {
  const words = Array.from(document.querySelectorAll('textarea[data-save]'))
    .map(el => el.value).join(' ').trim().split(/\s+/).filter(Boolean).length;
  const count = $('#word-count');
  if (count) count.textContent = words + ' WORDS';
}
function save() { updateWords(); }
document.addEventListener('input', event => {
  if (event.target?.matches?.('textarea[data-save]')) updateWords();
});
const choices = {
  trial:
    'This is what the Allies chose. A trial creates a public record and requires proof, but it can be slow, costly, and controversial.',
  summary:
    'This would have been faster, but it would deny defendants a chance to answer evidence and make it easier for future governments to justify executions without a trial.',
};
$$('[data-choice]').forEach(button =>
  button.addEventListener('click', () => {
    const value = button.getAttribute('data-choice') || '';
    state.choice = value;
    $$('[data-choice]').forEach(b =>
      b.classList.toggle('active', b === button)
    );
    const output = $('#choice-feedback');
    if (output) output.textContent = choices[value] || '';
    save();
  })
);
if (state.choice) {
  const button = $('[data-choice="' + state.choice + '"]');
  button?.classList.add('active');
  const out = $('#choice-feedback');
  if (out) out.textContent = choices[state.choice] || '';
}
const reveal = $('#reveal-two');
const two = $('#two-answer');
reveal?.addEventListener('click', () => {
  const opening = two?.hasAttribute('hidden');
  if (opening) two?.removeAttribute('hidden');
  else two?.setAttribute('hidden', '');
  reveal.setAttribute('aria-expanded', String(opening));
  reveal.innerHTML = opening
    ? 'HIDE THE TWO EXCEPTIONS <span>−</span>'
    : 'REVEAL THE TWO EXCEPTIONS <span>＋</span>';
});
const record = {
  public: {
    num: '347',
    sub: 'EXECUTIONS CLAIMED',
    lines: [
      '43 years old',
      '15 years as a hangman',
      'Experience in Texas and Oklahoma',
    ],
  },
  record: {
    num: '60–100',
    sub: 'MACLEAN’S ESTIMATE',
    lines: [
      'Born in Wichita, Kansas, in 1911',
      '35 years old in October 1946',
      'Roughly two years as a hangman; prior experience unverified',
    ],
  },
};
const dataBox = $('#record-data');
function renderRecord(tab) {
  const d = record[tab];
  if (!dataBox || !d) return;
  dataBox.innerHTML =
    '<div class="big-data"><strong>' +
    d.num +
    '</strong><span>' +
    d.sub +
    '</span></div><ul>' +
    d.lines.map(s => '<li>' + s + '</li>').join('') +
    '</ul>';
  $$('[data-tab]').forEach(button => {
    button.classList.toggle(
      'selected',
      button.getAttribute('data-tab') === tab
    );
    button.setAttribute(
      'aria-selected',
      String(button.getAttribute('data-tab') === tab)
    );
  });
  state.recordTab = tab;
  save();
}
$$('[data-tab]').forEach(b =>
  b.addEventListener('click', () =>
    renderRecord(b.getAttribute('data-tab') || 'public')
  )
);
renderRecord(state.recordTab || 'public');
const witness = {
  '1': 'Supported. A reporter could directly hear sounds, even when he could not see the space behind the screen.',
  '2': 'Correct. The witness could NOT directly see what happened behind the screen, determine the cause, or measure consciousness.',
  '3': 'Supported. A near-contemporary report helps establish when a statement was made, though even a timely witness can be mistaken.',
};
$$('[data-witness]').forEach(b =>
  b.addEventListener('click', () => {
    state.witness = b.getAttribute('data-witness') || '';
    $$('[data-witness]').forEach(v => v.classList.toggle('active', v === b));
    const out = $('#witness-feedback');
    if (out) out.textContent = witness[state.witness];
    save();
  })
);
if (state.witness) {
  $('[data-witness="' + state.witness + '"]')?.classList.add('active');
  const out = $('#witness-feedback');
  if (out) out.textContent = witness[state.witness] || '';
}
const claims = [
  {
    id: 'c1',
    text: 'Twelve Nazi leaders received death sentences at Nuremberg.',
    answer: 'documented',
    explain: 'The official tribunal verdict lists twelve death sentences.',
  },
  {
    id: 'c2',
    text: 'Woods told reporters he had performed 347 executions.',
    answer: 'attributed',
    explain:
      'Documented as a statement Woods made. That does NOT verify he performed 347 executions.',
  },
  {
    id: 'c3',
    text: 'MacLean estimated Woods actually handled roughly 60–100 hangings.',
    answer: 'attributed',
    explain:
      'A historian’s estimate based on records, not an exact official total.',
  },
  {
    id: 'c4',
    text: 'A contemporary witness reported hearing groans after Streicher fell.',
    answer: 'documented',
    explain:
      'Kingsbury-Smith reported hearing those sounds. The sounds alone do not establish the cause.',
  },
  {
    id: 'c5',
    text: 'Woods deliberately prolonged every execution.',
    answer: 'not-proven',
    explain:
      'Intent has not been independently demonstrated. An allegation about Streicher does not prove intent for all ten men.',
  },
  {
    id: 'c6',
    text: 'German scientists secretly murdered Woods in 1950.',
    answer: 'not-proven',
    explain:
      'The supported record describes an electrical accident. Murder stories lack reliable evidence.',
  },
];
const labels = {
  documented: 'DOCUMENTED',
  attributed: 'ATTRIBUTED / ESTIMATED',
  'not-proven': 'NOT ESTABLISHED',
};
const list = $('#claim-list');
if (list)
  list.innerHTML = claims
    .map(
      (c, i) =>
        '<article class="claim"><strong><span style="color:#a84635;font:900 21px Barlow Condensed;margin-right:10px;">' +
        String(i + 1).padStart(2, '0') +
        '</span>' +
        c.text +
        '</strong><div class="claim-choices">' +
        Object.keys(labels)
          .map(
            k =>
              '<button data-claim="' +
              c.id +
              '" data-class="' +
              k +
              '" aria-pressed="false">' +
              labels[k] +
              '</button>'
          )
          .join('') +
        '</div><p class="claim-feedback" id="feedback-' +
        c.id +
        '" hidden></p></article>'
    )
    .join('');
function gradeClaim(id, value) {
  state[id] = value;
  $$('[data-claim="' + id + '"]').forEach(b => {
    const is = b.getAttribute('data-class') === value;
    b.classList.toggle('selected', is);
    b.setAttribute('aria-pressed', String(is));
  });
  const claim = claims.find(c => c.id === id);
  const result = $('#feedback-' + id);
  if (result && claim) {
    result.removeAttribute('hidden');
    result.textContent =
      (claim.answer === value
        ? 'MATCHES THE RECORD. '
        : 'RECONSIDER YOUR CATEGORY. ') + claim.explain;
  }
  const tally = claims.filter(c => Boolean(state[c.id])).length;
  const score = $('#score');
  if (score) score.textContent = tally + ' / 6 REVIEWED';
  save();
}
$$('[data-claim]').forEach(b =>
  b.addEventListener('click', () =>
    gradeClaim(
      b.getAttribute('data-claim') || '',
      b.getAttribute('data-class') || ''
    )
  )
);
claims.forEach(c => {
  if (state[c.id]) gradeClaim(c.id, state[c.id]);
});
$$('[name="judgment"]').forEach(input => {
  const radio = input;
  radio.checked = state.judgment === radio.value;
  radio.addEventListener('change', () => {
    state.judgment = radio.value;
    save();
  });
});
function compiled() {
  const field = (id) =>
    (
      (document.getElementById(id))?.value || ''
    ).trim() || '[No response]';
  const response = [
    'HIDDEN HISTORY / BYTESIZE 03 — THE HANGMAN OF NUREMBERG',
    'CASE FILE 046 — STUDENT RESPONSE',
    '',
    '01 — What is a trade-off to your 1945 choice?',
    field('a1'),
    '',
    '02 — Can we trust Woods’s published résumé?',
    field('a2'),
    '',
    '03 — Which claim was most misleading?',
    field('a3'),
    '',
    '04 — Your verdict using two cited pieces of evidence',
    'Selected judgment: ' + (state.judgment || '[Not selected]'),
    field('a4'),
    '',
    '05 — Should all convicted people receive humane treatment?',
    field('a5'),
    '',
    'EVIDENCE REVIEW: ' +
      claims.filter(c => Boolean(state[c.id])).length +
      '/6 examined',
    'WITNESS CHECK: ' + (state.witness || '[Not selected]'),
    '',
    'Copying or downloading this document is NOT confirmation of PIN-based Turn In.',
  ];
  return response.join('\n');
}
const exportStatus = $('#export-status');
$('#copy-work')?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(compiled());
    if (exportStatus)
      exportStatus.textContent =
        'Response copied. Paste it where your teacher directs.';
  } catch {
    if (exportStatus)
      exportStatus.textContent =
        'Copy blocked by your browser. Use Download Backup instead.';
  }
});
$('#download-work')?.addEventListener('click', () => {
  const a = document.createElement('a');
  const blob = new Blob([compiled()], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = 'Hidden_History_Nuremberg_Case_File_046.txt';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  if (exportStatus)
    exportStatus.textContent =
      'Backup downloaded. This is not a confirmed submission.';
});
$('#print-work')?.addEventListener('click', () => window.print());
function onScroll() {
  const total = document.documentElement.scrollHeight - window.innerHeight;
  const percent =
    total > 0 ? Math.max(0, Math.min(100, (window.scrollY / total) * 100)) : 0;
  const fill = $('#progress-fill');
  if (fill) fill.style.width = percent + '%';
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();
updateWords();
