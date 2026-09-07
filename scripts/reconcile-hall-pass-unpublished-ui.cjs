const fs = require('node:fs');
const path = require('node:path');

const target = path.join(process.cwd(), 'apps-script', 'hall-pass', 'Index.html');
let source = fs.readFileSync(target, 'utf8');

const replacements = [
  [
`      .teacher-mode .student-head h2 { font-size:30px; line-height:1.15; font-weight:720; }
      .teacher-mode .student-head { padding:8px 0 22px; }`,
`      .teacher-mode .brandbar { margin-bottom:20px; }
      .teacher-mode .top { margin-bottom:18px; }
      .teacher-mode h1 { font-size:42px; }
      .teacher-mode .school { display:none; }
      .teacher-mode .student-head h2 { font-size:22px; line-height:1.2; font-weight:720; }
      .teacher-mode .student-head { padding:0 0 18px; align-items:center; }
      .teacher-mode .student-meta { display:none; }`
  ],
  [
`      .help-tooltip { position:fixed; z-index:100; max-width:min(310px,calc(100vw - 24px)); padding:13px 15px; border:1px solid #3c4056; background:#202437; color:#fff; border-radius:11px; font:400 12px/1.6 var(--display); box-shadow:0 8px 24px #17182726; }`,
`      .help-tooltip { position:fixed; z-index:100; max-width:min(310px,calc(100vw - 24px)); padding:13px 15px; border:1px solid #3c4056; background:#202437; color:#fff; border-radius:11px; font:400 12px/1.6 var(--display); box-shadow:0 8px 24px #17182726; }
      .teacher-action-dialog { width:min(520px,calc(100% - 32px)); padding:28px; border:1px solid var(--line); border-radius:20px; color:var(--ink); background:white; }
      .teacher-action-dialog h2 { margin:0 0 14px; font-size:25px; line-height:1.2; letter-spacing:-.6px; }
      .teacher-action-dialog p { margin:0 0 20px; font-size:14px; color:var(--muted); line-height:1.65; }
      .teacher-action-dialog label { display:grid; gap:9px; font-size:13px; font-weight:600; }
      .teacher-action-dialog textarea { width:100%; min-height:96px; padding:12px; border:1px solid #cdd3e5; border-radius:10px; resize:vertical; }
      .teacher-action-dialog .button-row { margin-top:24px; }
      .teacher-action-dialog .button-row > * { flex:1 1 120px; min-height:46px; }
      .teacher-action-dialog::backdrop { background:#171b365c; backdrop-filter:blur(3px); }`
  ],
  [
`      .pin-input { margin-top:26px; min-height:64px; border:1px solid #cdd3e5; background:#fafbff; letter-spacing:.28em; }`,
`      .pin-input { margin-top:26px; min-height:64px; border:1px solid #cdd3e5; background:#fafbff; letter-spacing:.28em; }
      .pin-label { display:block; margin-top:24px; color:#555d73; font-size:12px; font-weight:600; }
      .pin-label + .pin-input { margin-top:10px; }`
  ],
  [
`        .workspace-tab { flex:0 0 auto; padding:9px 12px; }`,
`        .workspace-tab { flex:0 0 auto; padding:9px 12px; }
        .teacher-mode .top, .teacher-mode .student-head { flex-direction:row; align-items:center; }
        .teacher-mode h1 { font-size:34px; }
        .teacher-mode .student-head h2 { font-size:19px; }
        .teacher-mode .top .eyebrow { font-size:8px; }
        .teacher-mode .brandbar { margin-bottom:18px; }`
  ],
  [
`throw new Error('Several students are updating the shared classroom log at the same time. No check-in or pass change was made. Wait five seconds and press once more; this is traffic, not a bad PIN. your teacher can use the teacher backup controls if needed.');`,
`throw new Error('Several students are updating the shared classroom log at the same time. No check-in or pass change was made. Wait five seconds and press once more; this is traffic, not a bad PIN. Your teacher can use the teacher backup controls if needed.');`
  ],
  [
`            <input type="password" class="pin-input" id="pin" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off" aria-label="Six-digit student PIN">`,
`            <label class="pin-label" for="pin">Your six-digit PIN</label>
            <input type="password" class="pin-input" id="pin" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off" aria-label="Six-digit student PIN" required>`
  ],
  [
`            <input type="password" class="pin-input" id="action-pin" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off" aria-label="Six-digit student PIN">`,
`            <label class="pin-label" for="action-pin">Your six-digit PIN</label>
            <input type="password" class="pin-input" id="action-pin" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off" aria-label="Six-digit student PIN" required>`
  ],
  [
`      const filterPassCounts = (term) => {`,
`      const reportFilterResults = (fieldId, rowSelector, term) => {
        const field = document.getElementById(fieldId);
        if (!field) return;
        let note = document.getElementById(\`${'${fieldId}'}-results\`);
        if (!note) {
          note = document.createElement('p'); note.id = \`${'${fieldId}'}-results\`;
          note.className = 'message'; note.style.marginTop = '10px';
          note.setAttribute('role', 'status'); field.after(note);
        }
        const count = [...document.querySelectorAll(rowSelector)].filter((row) => !row.hidden).length;
        note.hidden = !String(term || '').trim();
        note.textContent = count ? \`${'${count}'} matching class ${'${count === 1 ? \'enrollment\' : \'enrollments\'}'}.\` : 'No matching students. Try another name or class.';
      };

      const filterPassCounts = (term) => {`
  ],
  [
`        document.querySelectorAll('[data-pass-row]').forEach((row) => {
          row.hidden = Boolean(needle) && !row.dataset.passRow.includes(needle);
        });`,
`        document.querySelectorAll('[data-pass-row]').forEach((row) => {
          row.hidden = Boolean(needle) && !row.dataset.passRow.includes(needle);
        });
        reportFilterResults('pass-count-filter', '[data-pass-row]', term);`
  ],
  [
`        document.querySelectorAll('[data-attendance-row]').forEach((row) => {
          row.hidden = Boolean(needle) && !row.dataset.attendanceRow.includes(needle);
        });`,
`        document.querySelectorAll('[data-attendance-row]').forEach((row) => {
          row.hidden = Boolean(needle) && !row.dataset.attendanceRow.includes(needle);
        });
        reportFilterResults('attendance-filter', '[data-attendance-row]', term);`
  ],
  [
`        document.querySelectorAll('[data-roster-row]').forEach((row) => {
          row.hidden = Boolean(needle) && !row.dataset.rosterRow.includes(needle);
        });`,
`        document.querySelectorAll('[data-roster-row]').forEach((row) => {
          row.hidden = Boolean(needle) && !row.dataset.rosterRow.includes(needle);
        });
        reportFilterResults('roster-filter', '[data-roster-row]', term);`
  ],
  [
`          '[data-pass-access]': 'Teacher-private access setting. Applies across this student’s memberships and requires an audit reason.',`,
`          '[data-pass-access-email]': 'Teacher-private access setting. Applies across this student’s memberships and requires an audit reason.',`
  ],
  [
`            <div class="teacher-section-head"><div><h3>live pass board.</h3><p>${'${state.retentionDays}'}-day operational window plus permanent Pass Audit · maximum ${'${state.maxActivePasses}'} out at once · ${'${passPolicy.limit ? `${passPolicy.limit} per marking period` : \'no marking-period cap\'}'} · ${'${passPolicy.dailyLimit ? `${passPolicy.dailyLimit} per day` : \'no daily cap\'}'} · ${'${passPolicy.cooldownMinutes ? `${passPolicy.cooldownMinutes}-minute cooldown` : \'no cooldown\'}'}</p></div></div>`,
`            <div class="teacher-section-head"><div><h3>live pass board.</h3><p>Up to ${'${escapeHtml(state.maxActivePasses)}'} students out at once. The waiting line moves automatically when space opens.</p></div></div>`
  ],
  [
`          adoptState(await call('refreshTeacherState'));
          teacherLastRefresh = Date.now();`,
`          adoptState(await call('refreshTeacherState'));
          teacherPinStatus = await call('teacherPinEmailStatus');
          teacherLastRefresh = Date.now();`
  ],
  [
`          if (inFlight || screen !== 'teacher') return;`,
`          if (inFlight || screen !== 'teacher' || teacherIsEditing()) return;`
  ]
];

for (const [from, to] of replacements) {
  const count = source.split(from).length - 1;
  if (count !== 1) {
    throw new Error(`Expected exactly one match for reconciliation replacement, found ${count}: ${from.slice(0, 120)}`);
  }
  source = source.replace(from, to);
}

if (!source.includes("`${late} overdue ${late === 1 ? 'pass' : 'passes'}`")) {
  throw new Error('Required overdue-pass wording is missing after reconciliation.');
}
if (source.includes("`${late} ${late === 1 ? 'pass needs' : 'passes need'} a check`")) {
  throw new Error('Regressed pass-needs-a-check wording is present.');
}

fs.writeFileSync(target, source, 'utf8');
console.log('Applied audited unpublished Hall Pass UI refinements while preserving overdue-pass wording.');
