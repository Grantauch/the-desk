import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, text) => fs.writeFileSync(path.join(root, rel), text);

function replaceOnce(text, search, replacement, label) {
  const first = text.indexOf(search);
  if (first < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (text.indexOf(search, first + search.length) >= 0) throw new Error(`Patch anchor is not unique: ${label}`);
  return text.slice(0, first) + replacement + text.slice(first + search.length);
}

function insertAfter(text, anchor, addition, label) {
  const first = text.indexOf(anchor);
  if (first < 0) throw new Error(`Missing insertion anchor: ${label}`);
  if (text.indexOf(anchor, first + anchor.length) >= 0) throw new Error(`Insertion anchor is not unique: ${label}`);
  return text.slice(0, first + anchor.length) + addition + text.slice(first + anchor.length);
}

// ---------------------------------------------------------------- Code.gs --
let code = read('apps-script/hall-pass/Code.gs');

const periodHelperAnchor = `function periodNumberFromClass_(classPeriod) {
  const match = /^Period\\s+([1-6])(?:\\b|\\s|$)/i.exec(String(classPeriod || '').trim());
  return match ? Number(match[1]) : null;
}
`;
const periodHelpers = `
/** Return the period physically meeting in this room right now. */
function currentScheduledPeriod_(nowValue) {
  const now = toDateOrNull_(nowValue) || new Date();
  const day = getSchoolDaySchedule_(now);
  if (!day.schoolDay || !day.scheduleKey) return null;
  const profile = getBellScheduleIndex_()[day.scheduleKey];
  if (!profile || !profile.valid) return null;
  const localTime = Utilities.formatDate(
    now,
    Session.getScriptTimeZone() || 'America/Detroit',
    'HH:mm'
  );
  const minute = bellMinutes_(localTime);
  if (minute === null) return null;
  const current = Object.values(profile.periods)
    .find((entry) => minute >= entry.start && minute < entry.end);
  return current ? current.period : null;
}

/**
 * An unresolved pass remains an active/auditable fact until it is returned or
 * rolled over. Capacity is a different question: once that student's class is
 * no longer the class physically meeting here, the forgotten return must not
 * consume a later period's bathroom slot.
 */
function passBlocksCurrentCapacity_(pass, nowValue) {
  if (!pass || pass.status !== 'OUT') return false;
  const currentPeriod = currentScheduledPeriod_(nowValue);
  if (!currentPeriod) return false;
  return periodNumberFromClass_(pass.classPeriod) === currentPeriod;
}
`;
code = insertAfter(code, periodHelperAnchor, periodHelpers, 'current-period capacity helpers');

const oldSnapshot = `  const active = log.filter((pass) => (
    pass.status === 'OUT' && safeDateKey_(pass.outDate) === todayKey
  ));
  const maxActive = Math.max(1, Math.round(numberSetting_(settings, 'MAX_ACTIVE_PASSES', 1)));
  const openSlots = Math.max(0, maxActive - active.length);
  const queueState = readWaitingQueue_(settings, openSlots);
  return {
    settings,
    log,
    active,
    maxActive,
    openSlots,
    queue: queueState.live,
    expiredQueue: queueState.expired,
  };
`;
const newSnapshot = `  const active = log.filter((pass) => (
    pass.status === 'OUT' && safeDateKey_(pass.outDate) === todayKey
  ));
  const currentPeriod = currentScheduledPeriod_();
  const capacityActive = active.filter((pass) => passBlocksCurrentCapacity_(pass));
  const maxActive = Math.max(1, Math.round(numberSetting_(settings, 'MAX_ACTIVE_PASSES', 1)));
  const openSlots = Math.max(0, maxActive - capacityActive.length);
  const queueState = readWaitingQueue_(settings, openSlots);
  return {
    settings,
    log,
    active,
    capacityActive,
    currentPeriod,
    maxActive,
    openSlots,
    queue: queueState.live,
    expiredQueue: queueState.expired,
  };
`;
code = replaceOnce(code, oldSnapshot, newSnapshot, 'getPassSnapshot period-boundary capacity');

const oldTeacherActive = `    retentionDays: numberSetting_(settings, 'RETENTION_DAYS', 180),
    active: snapshot.active.map(clientPass_),
    queue: snapshot.queue.map((entry, index) => clientQueue_(entry, index + 1)),
`;
const newTeacherActive = `    retentionDays: numberSetting_(settings, 'RETENTION_DAYS', 180),
    currentPeriod: snapshot.currentPeriod,
    capacityUsed: snapshot.capacityActive.length,
    active: snapshot.active.map((pass) => ({
      ...clientPass_(pass),
      blocksCurrentCapacity: snapshot.capacityActive.some((activePass) => activePass.passId === pass.passId),
    })),
    queue: snapshot.queue.map((entry, index) => clientQueue_(entry, index + 1)),
`;
code = replaceOnce(code, oldTeacherActive, newTeacherActive, 'teacher current-capacity payload');

write('apps-script/hall-pass/Code.gs', code);

// ------------------------------------------------------------- Index.html --
let html = read('apps-script/hall-pass/Index.html');

const oldOwnPass = `            ${'${ownPass ? `'}
              <div class=\"timer\">
                <p class=\"timer-label\">time out of class</p>
                <p class=\"timer-time\" id=\"student-timer\">00:00</p>
              </div>
              <button class=\"primary return\" id=\"pass-action\">I’m back</button>${'` : `${waitingHtml}${queued && allowance.blocked ? blockedHtml : \'\'}${readyHtml}`}'}
`;
const newOwnPass = `            ${'${ownPass ? `'}
              <div class=\"timer\">
                <p class=\"timer-label\">time out of class</p>
                <p class=\"timer-time\" id=\"student-timer\">00:00</p>
              </div>
              <div class=\"notice success\" role=\"status\"><h3>when you walk back in, end the pass.</h3><p>Your pass stays open until you tap the green button and enter your PIN again. That final tap keeps Who’s Out and the waiting line accurate for everyone.</p></div>
              <button class=\"primary return\" id=\"pass-action\">I’m back — end my pass</button>${'` : `${waitingHtml}${queued && allowance.blocked ? blockedHtml : \'\'}${readyHtml}`}'}
`;
html = replaceOnce(html, oldOwnPass, newOwnPass, 'student return reminder');
html = replaceOnce(
  html,
  `            ? 'Enter your PIN again to record that you are back.'`,
  `            ? 'One last step: enter your PIN to mark yourself back in and free the classroom pass slot.'`,
  'student return PIN copy'
);

const oldNotificationVars = `        const active = data.active || [];
        const late = active.filter((pass) => Math.floor(elapsedSeconds(pass.outTime) / 60) >= Number(data.lateAfterMinutes || 10)).length;
        const unmatched = (data.unmatchedSignIns || []).length;
`;
const newNotificationVars = `        const active = data.active || [];
        const late = active.filter((pass) => Math.floor(elapsedSeconds(pass.outTime) / 60) >= Number(data.lateAfterMinutes || 10)).length;
        const carryover = active.filter((pass) => pass.blocksCurrentCapacity === false).length;
        const unmatched = (data.unmatchedSignIns || []).length;
`;
html = replaceOnce(html, oldNotificationVars, newNotificationVars, 'carryover notification count');

const oldLateNotification = `        if (late) add('urgent', \`${'${late}'} overdue ${'${late === 1 ? \'pass\' : \'passes\'}'}\`, 'Review the students who are still out. Mark returned only after confirming they are back.', 'overview', 'live-pass-section', 'View passes');
        if (pendingLateCheckIns) add('warning', \`${'${pendingLateCheckIns}'} late ${'${pendingLateCheckIns === 1 ? \'sign-in needs\' : \'sign-ins need\'}'} point review\`, 'Students were allowed to sign in after your on-time window. Decide whether each one earns the daily point.', 'attendance', 'late-checkins-details', 'Review late sign-ins');
`;
const newLateNotification = `        if (late) add('urgent', \`${'${late}'} overdue ${'${late === 1 ? \'pass\' : \'passes\'}'}\`, 'Review the students who are still out. Mark returned only after confirming they are back.', 'overview', 'live-pass-section', 'View passes');
        if (carryover) add('warning', \`${'${carryover}'} unresolved ${'${carryover === 1 ? \'pass is\' : \'passes are\'}'} from an earlier class\`, 'The pass records stay open for follow-up and audit, but they no longer consume the current class’s bathroom capacity.', 'overview', 'live-pass-section', 'Resolve passes');
        if (pendingLateCheckIns) add('warning', \`${'${pendingLateCheckIns}'} late ${'${pendingLateCheckIns === 1 ? \'sign-in needs\' : \'sign-ins need\'}'} point review\`, 'Students were allowed to sign in after your on-time window. Decide whether each one earns the daily point.', 'attendance', 'late-checkins-details', 'Review late sign-ins');
`;
html = replaceOnce(html, oldLateNotification, newLateNotification, 'carryover teacher notification');

const oldActiveHtml = `        const activeHtml = state.active.length ? state.active.map((pass) => {
          const minutes = Math.floor(elapsedSeconds(pass.outTime) / 60);
          const late = minutes >= lateAfter;
          const stale = minutes >= staleAfter;
          return \`
          <article class=\"active-pass ${'${stale ? \'stale-pass\' : late ? \'late\' : \'\'}'}\">
            <strong>${'${escapeHtml(pass.studentName)}'}${'${stale ? \'<span class=\"late-flag\">check now</span>\' : late ? \'<span class=\"late-flag\">over \' + escapeHtml(lateAfter) + \' min</span>\' : \'\'}'}</strong>
            <small>${'${escapeHtml(pass.classPeriod)}'} · out at ${'${formatClock(pass.outTime)}'} · <span data-live-time=\"${'${escapeHtml(pass.outTime)}'}\">${'${elapsed(pass.outTime)}'}</span>${'${stale ? \' · possible forgotten pass\' : \'\'}'}</small>
            <button class=\"secondary\" data-end-pass=\"${'${escapeHtml(pass.passId)}'}\">mark returned</button>
          </article>\`;
        }).join('') : '<p class=\"all-clear\">Nobody is out right now.</p>';
`;
const newActiveHtml = `        const activeHtml = state.active.length ? state.active.map((pass) => {
          const minutes = Math.floor(elapsedSeconds(pass.outTime) / 60);
          const late = minutes >= lateAfter;
          const stale = minutes >= staleAfter;
          const carryover = pass.blocksCurrentCapacity === false;
          const flag = carryover
            ? '<span class=\"late-flag\">earlier class · not blocking</span>'
            : stale
              ? '<span class=\"late-flag\">check now</span>'
              : late
                ? '<span class=\"late-flag\">over ' + escapeHtml(lateAfter) + ' min</span>'
                : '';
          return \`
          <article class=\"active-pass ${'${carryover || stale ? \'stale-pass\' : late ? \'late\' : \'\'}'}\">
            <strong>${'${escapeHtml(pass.studentName)}'}${'${flag}'}</strong>
            <small>${'${escapeHtml(pass.classPeriod)}'} · out at ${'${formatClock(pass.outTime)}'} · <span data-live-time=\"${'${escapeHtml(pass.outTime)}'}\">${'${elapsed(pass.outTime)}'}</span>${'${carryover ? \' · unresolved from an earlier class; current-class capacity is already released\' : stale ? \' · possible forgotten pass\' : \'\'}'}</small>
            <button class=\"secondary\" data-end-pass=\"${'${escapeHtml(pass.passId)}'}\">${'${carryover || stale ? \'mark returned now\' : \'mark returned\'}'}</button>
          </article>\`;
        }).join('') : '<p class=\"all-clear\">Nobody is out right now.</p>';
`;
html = replaceOnce(html, oldActiveHtml, newActiveHtml, 'teacher unresolved-pass cards');

const oldRoomStatus = `        const roomStatusHtml = \`
          <div class=\"checkin-summary room-summary\">
            <div class=\"summary-tile\"><strong>${'${escapeHtml((state.active || []).length)}'} / ${'${escapeHtml(state.maxActivePasses)}'}</strong><span>out right now</span></div>
            <div class=\"summary-tile\"><strong>${'${escapeHtml((state.queue || []).length)}'}</strong><span>waiting in line</span></div>
            <div class=\"summary-tile\"><strong>${'${escapeHtml(state.checkInsToday.length)}'}</strong><span>class check-ins today</span></div>
            <div class=\"summary-tile ${'${latePassCount ? \'attention\' : \'\'}'}\"><strong>${'${escapeHtml(latePassCount)}'}</strong><span>overdue passes</span></div>
          </div>\`;
`;
const newRoomStatus = `        const unresolvedEarlier = (state.active || []).filter((pass) => pass.blocksCurrentCapacity === false).length;
        const roomStatusHtml = \`
          <div class=\"checkin-summary room-summary\">
            <div class=\"summary-tile\"><strong>${'${escapeHtml(Number(state.capacityUsed || 0))}'} / ${'${escapeHtml(state.maxActivePasses)}'}</strong><span>current-class slots used</span></div>
            <div class=\"summary-tile\"><strong>${'${escapeHtml((state.queue || []).length)}'}</strong><span>waiting in line</span></div>
            <div class=\"summary-tile\"><strong>${'${escapeHtml(state.checkInsToday.length)}'}</strong><span>class check-ins today</span></div>
            <div class=\"summary-tile ${'${latePassCount ? \'attention\' : \'\'}'}\"><strong>${'${escapeHtml(latePassCount)}'}</strong><span>overdue passes</span></div>
            <div class=\"summary-tile ${'${unresolvedEarlier ? \'attention\' : \'\'}'}\"><strong>${'${escapeHtml(unresolvedEarlier)}'}</strong><span>earlier-class passes to resolve</span></div>
          </div>\`;
`;
html = replaceOnce(html, oldRoomStatus, newRoomStatus, 'teacher current-capacity summary');

const oldLateDetails = `              <p class=\"message\" style=\"margin:12px 0\">Late students are recorded immediately instead of being denied. Awarding the point also counts the day toward the student’s check-in streak; keeping no point preserves the late record at zero.</p>
              <table><thead><tr><th>student</th><th>class</th><th>signed in</th><th>point</th><th>review</th><th class=\"action\">decision</th></tr></thead><tbody>${'${lateCheckInRows}'}</tbody></table>
`;
const newLateDetails = `              <p class=\"message\" style=\"margin:12px 0\">Late students are recorded immediately instead of being denied. Awarding the point also counts the day toward the student’s check-in streak; keeping no point preserves the late record at zero.</p>
              ${'${pendingLateCheckIns.length ? `'}
                <div class=\"notice warning\" style=\"margin:12px 0\">
                  <h3>${'${escapeHtml(pendingLateCheckIns.length)}'} arrivals need review.</h3>
                  <p>Use the individual buttons below when decisions differ, or resolve every currently pending late sign-in at once.</p>
                  <div class=\"button-row\"><button class=\"secondary\" id=\"award-all-late\">award all pending points</button><button class=\"secondary danger\" id=\"zero-all-late\">keep all pending at 0</button></div>
                </div>${'` : \'\'}'}
              <table><thead><tr><th>student</th><th>class</th><th>signed in</th><th>point</th><th>review</th><th class=\"action\">decision</th></tr></thead><tbody>${'${lateCheckInRows}'}</tbody></table>
`;
html = replaceOnce(html, oldLateDetails, newLateDetails, 'late-review batch controls');

const oldLateListener = `        document.querySelectorAll('[data-late-checkin-review]').forEach((button) => button.addEventListener('click', () => act(button, async () => {
          const decision = button.dataset.lateDecision;
          const prompt = decision === 'AWARD_POINT'
            ? 'Award the daily point for this late sign-in? The original late time will remain in the private log.'
            : 'Keep this late sign-in at 0 points? The original late time will remain in the private log.';
          if (!await teacherConfirm(prompt)) return;
          adoptState(await call('teacherReviewLateCheckIn', button.dataset.lateCheckinReview, decision));
          renderTeacher();
        })));
`;
const newLateListener = `${oldLateListener}
        [['award-all-late', 'AWARD_POINT'], ['zero-all-late', 'KEEP_NO_POINT']].forEach(([id, decision]) => {
          const button = document.querySelector(\`#${'${id}'}\`);
          if (!button) return;
          button.addEventListener('click', () => act(button, async () => {
            const count = pendingLateCheckIns.length;
            const prompt = decision === 'AWARD_POINT'
              ? \`Award the daily point to all ${'${count}'} currently pending late sign-ins? Each original late time stays in the private log.\`
              : \`Keep all ${'${count}'} currently pending late sign-ins at 0 points? Each original late time stays in the private log.\`;
            if (!await teacherConfirm(prompt)) return;
            let nextState = null;
            for (const checkIn of pendingLateCheckIns) {
              nextState = await call('teacherReviewLateCheckIn', checkIn.checkInId, decision);
            }
            if (nextState) adoptState(nextState);
            renderTeacher();
          }));
        });
`;
html = replaceOnce(html, oldLateListener, newLateListener, 'late-review batch behavior');

write('apps-script/hall-pass/Index.html', html);

// -------------------------------------------------------- runtime coverage --
let runtime = read('scripts/test-hall-pass-runtime.cjs');
const capacityTestAnchor = `test('the room fills to the configured capacity', () => {
  const c = classroom({ settings: { MAX_ACTIVE_PASSES: 2 } });
  assert.equal(outcomeOf(c.requestPass(PEOPLE.ada, 'Period 1')).kind, 'STARTED');
  assert.equal(outcomeOf(c.requestPass(PEOPLE.alan, 'Period 1')).kind, 'STARTED');
  assert.equal(c.passLog().filter((row) => String(row.Status) === 'OUT').length, 2);
});
`;
const fieldCapacityTest = `

test('an unresolved earlier-period pass stays visible without blocking the current class', () => {
  const c = classroom({
    now: new Date('2026-09-10T11:50:00Z'),
    settings: { MAX_ACTIVE_PASSES: 1 },
    memberships: [[PEOPLE.ada, 'Period 1'], [PEOPLE.alan, 'Period 3']],
  });
  assert.equal(outcomeOf(c.requestPass(PEOPLE.ada, 'Period 1')).kind, 'STARTED');
  c.harness.clock.advanceSeconds(140 * 60); // 7:50 AM -> 10:10 AM local; Period 3 is now meeting.
  c.harness.newRequest();
  const before = c.teacherState();
  assert.equal(before.active.length, 1, 'the forgotten pass must remain visible for follow-up');
  assert.equal(before.active[0].blocksCurrentCapacity, false, 'the earlier class must release current-room capacity');
  assert.equal(before.capacityUsed, 0);
  assert.equal(before.currentPeriod, 3);
  assert.equal(outcomeOf(c.requestPass(PEOPLE.alan, 'Period 3')).kind, 'STARTED');
  assert.equal(c.passLog().filter((row) => String(row.Status) === 'OUT').length, 2, 'audit state preserves both unresolved/current passes');
  const after = c.teacherState();
  assert.equal(after.capacityUsed, 1, 'only the current-period pass consumes the configured slot');
});
`;
runtime = insertAfter(runtime, capacityTestAnchor, fieldCapacityTest, 'runtime period-boundary capacity test');
write('scripts/test-hall-pass-runtime.cjs', runtime);

// ----------------------------------------------------- structural coverage --
let appTest = read('scripts/test-hall-pass-app.cjs');
const snapshotAssertions = `const passSnapshot = functionSource('getPassSnapshot_');
assert.match(passSnapshot, /safeDateKey_\\(pass\\.outDate\\)\\s*===\\s*todayKey/);
assert.match(functionSource('expirePreviousDayPasses_'), /'ROLLED_OVER'/);
`;
const newSnapshotAssertions = `const passSnapshot = functionSource('getPassSnapshot_');
assert.match(passSnapshot, /safeDateKey_\\(pass\\.outDate\\)\\s*===\\s*todayKey/);
assert.match(passSnapshot, /capacityActive/);
assert.match(passSnapshot, /passBlocksCurrentCapacity_/);
assert.match(functionSource('currentScheduledPeriod_'), /getBellScheduleIndex_/);
assert.match(functionSource('passBlocksCurrentCapacity_'), /periodNumberFromClass_/);
assert.match(functionSource('expirePreviousDayPasses_'), /'ROLLED_OVER'/);
assert.match(html, /earlier class · not blocking/);
assert.match(html, /award all pending points/);
assert.match(html, /I’m back — end my pass/);
`;
appTest = replaceOnce(appTest, snapshotAssertions, newSnapshotAssertions, 'structural field-hardening assertions');
write('scripts/test-hall-pass-app.cjs', appTest);

console.log('Applied Hall Pass Friday field hardening patch.');
