from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CODE = ROOT / 'apps-script/hall-pass/Code.gs'
INDEX = ROOT / 'apps-script/hall-pass/Index.html'
PAGE = ROOT / 'src/pages/check-in.astro'
STATIC_TEST = ROOT / 'scripts/test-hall-pass-app.cjs'
RUNTIME_TEST = ROOT / 'scripts/test-hall-pass-runtime.cjs'


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


def replace_between(text, start, end, replacement, label):
    left = text.find(start)
    if left < 0:
        raise SystemExit(f'{label}: start marker not found')
    right = text.find(end, left + len(start))
    if right < 0:
        raise SystemExit(f'{label}: end marker not found')
    return text[:left] + replacement + text[right:]


# ---------------------------------------------------------------- Code.gs
code = CODE.read_text()
code = replace_once(
    code,
    "const GD_SCHEMA_VERSION = '2026-09-05-session-a';",
    "const GD_SCHEMA_VERSION = '2026-09-09-late-checkins';",
    'schema version',
)
code = replace_once(
    code,
    "  ['CHECKIN_WINDOW_MINUTES', '5', 'Student check-in window from the selected class start; end is exclusive'],",
    "  ['CHECKIN_WINDOW_MINUTES', '5', 'Minutes after class starts that count as on-time; later student check-ins are still recorded for teacher point review'],",
    'check-in setting description',
)

session_policy = r'''function getClassSession_(student, nowValue) {
  const now = toDateOrNull_(nowValue) || new Date();
  const day = getSchoolDaySchedule_(now);
  const selectedPeriod = periodNumberFromClass_(student && student.classPeriod);
  const result = {
    ...day,
    selectedPeriod,
    currentPeriod: null,
    classStart: '',
    classEnd: '',
    checkInAllowed: false,
    checkInLate: false,
    checkInCutoff: '',
    checkInWindowMinutes: 0,
    passRequestAllowed: false,
    blockReason: '',
    checkInMessage: '',
    passMessage: '',
  };
  if (!day.schoolDay) {
    result.blockReason = 'NO_SCHOOL';
    result.checkInMessage = result.passMessage = 'There is no student session today. Ask your teacher if you need help.';
    return result;
  }
  const profile = getBellScheduleIndex_()[day.scheduleKey];
  const period = profile && profile.valid && profile.periods[selectedPeriod];
  const settings = getSettings_();
  const timingKeys = ['PASS_PROTECT_FIRST_MINUTES', 'PASS_PROTECT_LAST_MINUTES', 'CHECKIN_WINDOW_MINUTES'];
  const values = timingKeys.map((key) => String(settings[key] == null ? '' : settings[key]).trim());
  const timing = values.map(Number);
  if (!period || values.some((value) => value === '') || timing.some((value) => !Number.isFinite(value) || value < 0) || timing[2] <= 0) {
    result.blockReason = 'SCHEDULE_UNKNOWN';
    result.checkInMessage = result.passMessage = 'The class schedule needs a teacher update. Ask your teacher.';
    return result;
  }
  const clock = Utilities.formatDate(now, Session.getScriptTimeZone() || 'America/Detroit', 'HH:mm:ss').split(':').map(Number);
  const seconds = clock[0] * 3600 + clock[1] * 60 + clock[2] + now.getMilliseconds() / 1000;
  const dayOrigin = now.getTime() - seconds * 1000;
  const classStart = dayOrigin + period.start * 60000;
  const classEnd = dayOrigin + period.end * 60000;
  const checkInCutoff = classStart + timing[2] * 60000;
  const current = Object.values(profile.periods).find((entry) => seconds >= entry.start * 60 && seconds < entry.end * 60);
  result.currentPeriod = current ? current.period : null;
  result.classStart = new Date(classStart).toISOString();
  result.classEnd = new Date(classEnd).toISOString();
  result.checkInCutoff = new Date(checkInCutoff).toISOString();
  result.checkInWindowMinutes = timing[2];
  // The window is now a grading boundary, not a lockout. Once this class begins,
  // a student may still record today's arrival; anything after the cutoff is late.
  result.checkInAllowed = now.getTime() >= classStart;
  result.checkInLate = result.checkInAllowed && now.getTime() >= checkInCutoff;
  result.passRequestAllowed = now.getTime() >= classStart + timing[0] * 60000 && now.getTime() < classEnd - timing[1] * 60000;
  result.blockReason = now.getTime() < classStart ? 'CLASS_NOT_STARTED' : now.getTime() >= classEnd ? 'CLASS_ENDED' : 'PROTECTED_WINDOW';
  result.checkInMessage = !result.checkInAllowed
    ? 'Check-in opens when your selected class begins.'
    : result.checkInLate
      ? `The ${timing[2]}-minute on-time window has ended. You can still sign in; it will be recorded as late for your teacher to review.`
      : '';
  result.passMessage = result.passRequestAllowed ? '' : 'New bathroom requests are closed outside your selected class or during its first and last ten minutes. Ask your teacher if you need to leave.';
  return result;
}

function studentActionEligibility_(student, action, nowValue) {
  if (action === GD_STUDENT_ACTIONS.RETURN) return { allowed: true, blockReason: '', message: '' };
  const session = getClassSession_(student, nowValue);
  if (action === GD_STUDENT_ACTIONS.CHECKIN) {
    return {
      allowed: session.checkInAllowed,
      late: Boolean(session.checkInLate),
      cutoff: session.checkInCutoff,
      windowMinutes: session.checkInWindowMinutes,
      blockReason: session.checkInAllowed ? '' : session.blockReason,
      message: session.checkInMessage,
    };
  }
  if (getStudentPassAccess_(student.email) === 'ESCORT_ONLY') return { allowed: false, blockReason: 'TEACHER_REQUIRED', message: 'Ask your teacher before leaving the room.' };
  return { allowed: session.passRequestAllowed, blockReason: session.passRequestAllowed ? '' : session.blockReason, message: session.passMessage };
}

'''
code = replace_between(
    code,
    'function getClassSession_(student, nowValue) {',
    'function assertStudentActionEligible_(student, action) {',
    session_policy,
    'class-session policy',
)

checkin_block = r'''function checkInStatusIsRecorded_(statusValue) {
  return ['CHECKED_IN', 'LATE_PENDING', 'LATE_APPROVED', 'LATE_NO_POINT'].includes(String(statusValue || '').trim().toUpperCase());
}

function checkInStatusIsLate_(statusValue) {
  return String(statusValue || '').trim().toUpperCase().startsWith('LATE_');
}

function checkInStatusCountsForStreak_(statusValue) {
  const status = String(statusValue || '').trim().toUpperCase();
  return status === 'CHECKED_IN' || status === 'LATE_APPROVED';
}

function refreshCheckInState(pinToken) {
  const resolved = resolveStudent_(pinToken, true);
  return getCheckInState_(resolved.student, pinToken || '', resolved.method);
}

function submitDailyCheckIn(actionProof, studentKey, identityToken) {
  let resolved = null;
  let recorded = null;
  withLock_(() => {
    resolved = consumeStudentActionProof_(actionProof, GD_STUDENT_ACTIONS.CHECKIN, studentKey);
    assertStudentActionEligible_(resolved.student, GD_STUDENT_ACTIONS.CHECKIN);
    recorded = recordCheckIn_(resolved.student, resolved.method, 'Fresh PIN verified for this check-in');
  }, GD_STUDENT_LOCK_WAIT_MS, 'daily check-in');
  const token = identityTokenForStudent_(identityToken, resolved.student);
  const state = getCheckInState_(resolved.student, token, resolved.method);
  state.actionOutcome = {
    id: resolved.requestId,
    kind: recorded && checkInStatusIsLate_(recorded.status) ? 'LATE_CHECK_IN_RECORDED' : 'CHECKED_IN',
  };
  return state;
}

function getCheckInState_(student, pinToken, method) {
  const settings = getSettings_();
  const todayKey = dateKey_(new Date());
  const allCheckIns = readCheckIns_();
  const checkIn = allCheckIns.find((entry) => (
    entry.dateKey === todayKey &&
    entry.studentKey === student.key &&
    checkInStatusIsRecorded_(entry.status)
  ));
  const absence = allCheckIns.find((entry) => (
    entry.dateKey === todayKey &&
    entry.studentKey === student.key &&
    entry.status === 'ABSENT'
  ));
  return {
    ok: true,
    mode: 'checkin',
    recognized: true,
    appTitle: 'Daily Check-in',
    student: { key: student.key, name: student.name, classPeriod: student.classPeriod },
    pinToken: pinToken || '',
    method,
    dateKey: todayKey,
    pointValue: numberSetting_(settings, 'CHECKIN_POINT_VALUE', 1),
    checkedIn: Boolean(checkIn),
    lateCheckIn: Boolean(checkIn && checkInStatusIsLate_(checkIn.status)),
    lateReviewStatus: checkIn && checkInStatusIsLate_(checkIn.status) ? checkIn.status : '',
    // An old absent mark is evidence, not a student lock. A later sign-in clears
    // that mark in the audit trail and writes the actual arrival time.
    attendanceLocked: false,
    priorAbsence: Boolean(absence && !checkIn),
    sessionEligibility: studentActionEligibility_(student, GD_STUDENT_ACTIONS.CHECKIN),
    checkIn: checkIn ? clientCheckIn_(checkIn) : null,
    streak: buildStreakIndex_(allCheckIns).streakFor(student.key, todayKey),
    serverNow: new Date().toISOString(),
  };
}

function recordCheckIn_(student, method, note) {
  const todayKey = dateKey_(new Date());
  const todayEntries = readCheckInsForDate_(todayKey).filter((entry) => (
    entry.studentKey === student.key
  ));
  const existing = todayEntries.find((entry) => checkInStatusIsRecorded_(entry.status));
  const absence = todayEntries.find((entry) => entry.status === 'ABSENT');
  if (existing) {
    if (absence) clearAbsentEntry_(absence, 'Cleared automatically because a check-in was already recorded');
    return existing;
  }
  if (absence) clearAbsentEntry_(absence, `Cleared when ${method} check-in was recorded`);

  const settings = getSettings_();
  const session = method === 'teacher' ? null : getClassSession_(student);
  const late = Boolean(session && session.checkInLate);
  const point = late ? 0 : numberSetting_(settings, 'CHECKIN_POINT_VALUE', 1);
  const status = late ? 'LATE_PENDING' : 'CHECKED_IN';
  const lateDetail = late
    ? `Late sign-in after the ${session.checkInWindowMinutes}-minute on-time window; teacher point review pending`
    : '';
  const row = [
    Utilities.getUuid(),
    todayKey,
    new Date(),
    student.email,
    student.name,
    student.classPeriod,
    method,
    point,
    status,
    [String(note || '').trim(), lateDetail].filter(Boolean).join(' · ').slice(0, 300),
  ];
  getSpreadsheet_().getSheetByName(GD_SHEETS.CHECKINS).appendRow(row);
  gdForget_('checkins');
  return {
    checkInId: row[0],
    dateKey: row[1],
    checkInTime: row[2],
    studentEmail: row[3],
    studentName: row[4],
    classPeriod: row[5],
    studentKey: rosterKey_(row[3], row[5]),
    method: row[6],
    point: row[7],
    status: row[8],
    note: row[9],
  };
}

function recordAbsence_(student, teacher) {
  const todayKey = dateKey_(new Date());
  const todayEntries = readCheckInsForDate_(todayKey).filter((entry) => (
    entry.studentKey === student.key
  ));
  if (todayEntries.some((entry) => checkInStatusIsRecorded_(entry.status))) {
    throw new Error(`${student.name} already has a check-in recorded today.`);
  }
  const existing = todayEntries.find((entry) => entry.status === 'ABSENT');
  if (existing) return existing;

  const row = [
    Utilities.getUuid(),
    todayKey,
    new Date(),
    student.email,
    student.name,
    student.classPeriod,
    'teacher',
    0,
    'ABSENT',
    `Marked absent by ${teacher}`.slice(0, 300),
  ];
  getSpreadsheet_().getSheetByName(GD_SHEETS.CHECKINS).appendRow(row);
  gdForget_('checkins');
  return {
    checkInId: row[0],
    dateKey: row[1],
    checkInTime: row[2],
    studentEmail: row[3],
    studentName: row[4],
    classPeriod: row[5],
    studentKey: rosterKey_(row[3], row[5]),
    method: row[6],
    point: row[7],
    status: row[8],
    note: row[9],
  };
}

function clearAbsentEntry_(entry, detail) {
  const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.CHECKINS);
  const existingNote = String(entry.note || '').trim();
  const nextNote = [existingNote, String(detail || '').trim()].filter(Boolean).join(' · ').slice(0, 300);
  sheet.getRange(entry.row, 9, 1, 2).setValues([['CLEARED', nextNote]]);
  gdForget_('checkins');
}

'''
code = replace_between(
    code,
    'function refreshCheckInState(pinToken) {',
    '/* ----------------------------------------------------------- hall pass ---- */',
    checkin_block,
    'daily check-in backend',
)

checkin_window_setter = r'''function teacherSetCheckInWindow(checkInWindowMinutes, clientContract) {
  const teacher = getActiveEmail_();
  assertTeacher_(teacher, getSettings_());
  assertTeacherClient_(clientContract);
  const minutes = Number(checkInWindowMinutes);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
    throw new Error('The on-time check-in window must be a whole number from 1 through 240 minutes.');
  }
  withLock_(() => setSettingValue_('CHECKIN_WINDOW_MINUTES', String(minutes)));
  const state = getTeacherState_({ includePinStatus: false });
  state.noticeMessage = `On-time check-ins now run for ${minutes} minute${minutes === 1 ? '' : 's'} after each class begins. Later student sign-ins will still be recorded for your point review.`;
  return state;
}

'''
code = replace_once(
    code,
    'function teacherResetStudentPassCounters(confirmText) {',
    checkin_window_setter + 'function teacherResetStudentPassCounters(confirmText) {',
    'teacher check-in timing setter',
)

late_review = r'''function teacherReviewLateCheckIn(checkInId, decision, clientContract) {
  const teacher = getActiveEmail_();
  assertTeacher_(teacher, getSettings_());
  assertTeacherClient_(clientContract);
  const id = String(checkInId || '').trim();
  const choice = String(decision || '').trim().toUpperCase();
  if (!['AWARD_POINT', 'KEEP_NO_POINT'].includes(choice)) {
    throw new Error('Choose whether to award the late check-in point or keep it at zero.');
  }
  let studentName = 'Student';
  let outcome = '';
  withLock_(() => {
    const entry = readCheckIns_().find((item) => item.checkInId === id);
    if (!entry || !checkInStatusIsLate_(entry.status)) {
      throw new Error('That late sign-in is no longer available for review. Refresh the teacher dashboard.');
    }
    const award = choice === 'AWARD_POINT';
    const point = award ? numberSetting_(getSettings_(), 'CHECKIN_POINT_VALUE', 1) : 0;
    const status = award ? 'LATE_APPROVED' : 'LATE_NO_POINT';
    const detail = award
      ? `Late check-in point awarded by ${teacher}`
      : `Late check-in kept at zero points by ${teacher}`;
    const note = [String(entry.note || '').trim(), detail].filter(Boolean).join(' · ').slice(0, 300);
    getSpreadsheet_().getSheetByName(GD_SHEETS.CHECKINS)
      .getRange(entry.row, 8, 1, 3)
      .setValues([[point, status, note]]);
    gdForget_('checkins');
    const student = getStudentByKey_(entry.studentKey) || {
      email: entry.studentEmail,
      name: entry.studentName,
      classPeriod: entry.classPeriod,
    };
    studentName = student.name;
    outcome = award ? `Awarded ${point} point${point === 1 ? '' : 's'}` : 'Kept at 0 points';
    auditTeacherAction_(
      teacher,
      student,
      award ? 'LATE_CHECKIN_POINT_AWARDED' : 'LATE_CHECKIN_NO_POINT',
      ['LATE_CHECKIN'],
      '',
      entry.checkInId
    );
  });
  const state = getTeacherState_({ includePinStatus: false });
  state.noticeMessage = `${studentName}: ${outcome}. The original late sign-in time remains in the private log.`;
  return state;
}

'''
code = replace_once(
    code,
    'function teacherMarkStudentAbsent(studentKey) {',
    late_review + 'function teacherMarkStudentAbsent(studentKey) {',
    'late check-in review action',
)

code = replace_once(
    code,
    ".filter((checkIn) => checkIn.dateKey === todayKey && checkIn.status === 'CHECKED_IN')",
    ".filter((checkIn) => checkIn.dateKey === todayKey && checkInStatusIsRecorded_(checkIn.status))",
    'teacher recorded-check-in filter',
)
code = replace_once(
    code,
    '  const checkedKeys = new Set(checkInsToday.map((checkIn) => checkIn.studentKey));',
    "  const lateCheckInsToday = checkInsToday.filter((checkIn) => checkInStatusIsLate_(checkIn.status));\n  const checkedKeys = new Set(checkInsToday.map((checkIn) => checkIn.studentKey));",
    'teacher late-check-in list',
)
code = replace_once(
    code,
    "    lateAfterMinutes: numberSetting_(settings, 'LATE_AFTER_MINUTES', 10),\n    stalePassMinutes: numberSetting_(settings, 'STALE_PASS_MINUTES', 20),",
    "    lateAfterMinutes: numberSetting_(settings, 'LATE_AFTER_MINUTES', 10),\n    stalePassMinutes: numberSetting_(settings, 'STALE_PASS_MINUTES', 20),\n    checkInWindowMinutes: numberSetting_(settings, 'CHECKIN_WINDOW_MINUTES', 5),",
    'teacher check-in window payload',
)
code = replace_once(
    code,
    "    checkInsToday: checkInsToday.map((checkIn) => ({\n      ...clientCheckIn_(checkIn),\n      streak: streaks.streakFor(checkIn.studentKey, todayKey),\n    })),\n    absentToday: absencesToday.map(clientCheckIn_),",
    "    checkInsToday: checkInsToday.map((checkIn) => ({\n      ...clientCheckIn_(checkIn),\n      streak: streaks.streakFor(checkIn.studentKey, todayKey),\n    })),\n    lateCheckInsToday: lateCheckInsToday.map((checkIn) => ({\n      ...clientCheckIn_(checkIn),\n      streak: streaks.streakFor(checkIn.studentKey, todayKey),\n    })),\n    absentToday: absencesToday.map(clientCheckIn_),",
    'teacher late-check-in payload',
)
code = replace_once(
    code,
    "    if (entry.status !== 'CHECKED_IN') return;",
    "    if (!checkInStatusCountsForStreak_(entry.status)) return;",
    'streak eligibility',
)
CODE.write_text(code)

# ---------------------------------------------------------------- Index.html
html = INDEX.read_text()
html = replace_once(
    html,
    "        if (['getBootstrap', 'refreshTeacherState', 'teacherStartPass', 'teacherEndPass', 'teacherGetMembershipPasses', 'teacherSetStudentPassAccess', 'teacherCheckInStudent'].includes(name)) args.push(TEACHER_CONTRACT);",
    "        if (['getBootstrap', 'refreshTeacherState', 'teacherStartPass', 'teacherEndPass', 'teacherGetMembershipPasses', 'teacherSetStudentPassAccess', 'teacherCheckInStudent', 'teacherSetCheckInWindow', 'teacherReviewLateCheckIn'].includes(name)) args.push(TEACHER_CONTRACT);",
    'teacher contract plumbing',
)
html = replace_once(
    html,
    "      .checkin-confirm p { margin: 7px 0 0; color: #046049; font-size: 14px; line-height: 1.5; }",
    "      .checkin-confirm p { margin: 7px 0 0; color: #046049; font-size: 14px; line-height: 1.5; }\n      .checkin-confirm.late { border-color: #e8ce96; background: #fff8e8; }\n      .checkin-confirm.late .checkin-point { background: #795300; font-size: 15px; letter-spacing: .03em; text-transform: uppercase; }\n      .checkin-confirm.late h3 { color: #5e4100; }\n      .checkin-confirm.late p { color: #6b4a00; }",
    'late confirmation style',
)

render_checkin = r'''      const renderCheckIn = () => {
        clearError();
        clearInterval(timerHandle);
        screen = 'checkin';
        setTitle('Daily Check-in');
        const firstName = firstNameFromDisplayName(state.student.name);
        const checkInStatus = String((state.checkIn && state.checkIn.status) || '');
        const late = Boolean(state.lateCheckIn);
        const lateApproved = checkInStatus === 'LATE_APPROVED';
        const lateNoPoint = checkInStatus === 'LATE_NO_POINT';
        const recordedPoint = state.checkIn ? Number(state.checkIn.point || 0) : Number(state.pointValue || 0);
        const pointLabel = late ? (lateApproved ? `+${escapeHtml(recordedPoint)}` : lateNoPoint ? '0' : 'late') : `+${escapeHtml(state.pointValue)}`;
        const streak = state.streak || { current: 0, best: 0, checkedInToday: false, nonSchoolDayProtected: false, atRiskToday: false };
        const streakMessage = late && !lateApproved
          ? `Your late sign-in is recorded. Today joins the streak only if your teacher awards the point. Best streak: ${escapeHtml(streak.best)} school day${Number(streak.best) === 1 ? '' : 's'}.`
          : streak.nonSchoolDayProtected
            ? 'Non-school day protected. Weekends and official calendar closures never break the count.'
            : streak.checkedInToday
              ? `Today is locked in. Best streak: ${escapeHtml(streak.best)} school day${Number(streak.best) === 1 ? '' : 's'}.`
              : streak.current
                ? `Check in today to keep it going. Best streak: ${escapeHtml(streak.best)} school days.`
                : 'Check in today to begin a school-day streak. Weekends and official no-school days never break it.';
        const eligibility = state.sessionEligibility || { allowed: false, late: false, message: '' };
        const actionIsLate = !state.checkedIn && Boolean(eligibility.late);
        const recordedMessage = late
          ? lateApproved
            ? `Late sign-in recorded at ${formatClock(state.checkIn && state.checkIn.checkInTime)}. Your teacher awarded ${escapeHtml(recordedPoint)} point${recordedPoint === 1 ? '' : 's'}; the original sign-in time stays recorded.`
            : lateNoPoint
              ? `Late sign-in recorded at ${formatClock(state.checkIn && state.checkIn.checkInTime)}. Your teacher reviewed it and kept today at 0 points.`
              : `Late sign-in recorded at ${formatClock(state.checkIn && state.checkIn.checkInTime)}. No point has been added yet; your teacher can review it.`
          : `Your attendance check-in was recorded at ${formatClock(state.checkIn && state.checkIn.checkInTime)}. Opening this page again today shows this same confirmation, not another point.`;

        content.className = '';
        content.innerHTML = `
          <div class="checkin-card">
            <div class="student-head">
              <div>
                <p class="eyebrow">${state.checkedIn ? late ? 'late sign-in' : 'recorded for today' : actionIsLate ? 'late check-in available' : 'on-time check-in'}</p>
                <h2>${escapeHtml(firstName)}.</h2>
                <p class="student-meta">${escapeHtml(state.student.classPeriod || 'class')} · ${escapeHtml(state.method === 'pin' ? 'student PIN' : 'school Google account')}</p>
              </div>
              <span class="status-dot ${state.checkedIn && !late ? '' : 'busy'}">${state.checkedIn ? late ? 'late recorded' : 'checked in' : actionIsLate ? 'late window' : 'not checked in yet'}</span>
            </div>
            <div class="streak-card" role="status">
              <span class="streak-number">${escapeHtml(streak.current)}</span>
              <div><h3>school-day streak.</h3><p>${streakMessage}</p></div>
            </div>
            ${state.checkedIn ? `
              <div class="checkin-confirm ${late ? 'late' : ''}" role="status">
                <span class="checkin-point">${pointLabel}</span>
                <div>
                  <h3>${late ? 'Late sign-in recorded' : 'you’re in.'}</h3>
                  <p>${recordedMessage}</p>
                </div>
              </div>
              <div class="pass-action">
                <button class="secondary" id="checkin-refresh">refresh confirmation</button>
                ${sharedDevice()
                  ? '<button class="primary" id="checkin-next">done — next student</button>'
                  : '<button class="secondary" id="checkin-pin">use a PIN instead</button>'}
              </div>` : `
              <div class="checkin-copy">
                <p class="message">${!eligibility.allowed
                  ? escapeHtml(eligibility.message)
                  : actionIsLate
                    ? `The on-time window was ${escapeHtml(eligibility.windowMinutes || 5)} minutes. You can still sign in now. It will be recorded as late with 0 points until your teacher reviews it.`
                    : 'Press once to record today’s attendance check-in and your daily extra-credit point. The date and time come from the classroom system.'}</p>
              </div>
              <div class="pass-action">
                <button class="primary" id="checkin-action" ${!eligibility.allowed ? 'disabled' : ''}>${actionIsLate ? 'record late sign-in' : 'check in for today'}</button>
                ${sharedDevice()
                  ? '<button class="secondary" id="checkin-next">different student</button>'
                  : '<button class="secondary" id="checkin-pin">use a PIN instead</button>'}
              </div>`}
          </div>`;

        const actionButton = document.querySelector('#checkin-action');
        if (actionButton) actionButton.addEventListener('click', () => renderActionPin(
          'CHECKIN',
          actionIsLate
            ? 'Enter your PIN once. Your late sign-in will be recorded for your teacher to review.'
            : 'Enter your PIN once to record today’s attendance check-in and point.'
        ));

        const refreshButton = document.querySelector('#checkin-refresh');
        if (refreshButton) refreshButton.addEventListener('click', (event) => act(event.currentTarget, async () => {
          adoptState(await call('refreshCheckInState', pinToken));
          renderCheckIn();
        }));

        const nextButton = document.querySelector('#checkin-next');
        if (nextButton) nextButton.addEventListener('click', () => resetToPin('Enter your six-digit PIN to check in.'));

        const pinButton = document.querySelector('#checkin-pin');
        if (pinButton) pinButton.addEventListener('click', () => resetToPin('Use your one six-digit student PIN. It works in all your classes.'));
        armIdleReset();
      };

'''
html = replace_between(
    html,
    '      const renderCheckIn = () => {',
    '      /* ------------------------------------------------------------ teacher */',
    render_checkin,
    'student late check-in UI',
)
html = replace_once(
    html,
    "          if (sharedDevice()) scheduleHandoff('Recorded. This screen clears itself for the next student.', HANDOFF_AFTER_CHECKIN_MS);",
    "          if (sharedDevice()) scheduleHandoff(state.actionOutcome && state.actionOutcome.kind === 'LATE_CHECK_IN_RECORDED' ? 'Late sign-in recorded. This screen clears itself for the next student.' : 'Recorded. This screen clears itself for the next student.', HANDOFF_AFTER_CHECKIN_MS);",
    'shared-device late confirmation',
)
html = replace_once(
    html,
    "        'stale-pass-minutes',\n        'attendance-filter',",
    "        'stale-pass-minutes',\n        'checkin-window-minutes',\n        'attendance-filter',",
    'teacher editable check-in window',
)
html = replace_once(
    html,
    "          staleMinutes: teacherFieldValue('#stale-pass-minutes'),\n          teacherStudent:",
    "          staleMinutes: teacherFieldValue('#stale-pass-minutes'),\n          checkInWindowMinutes: teacherFieldValue('#checkin-window-minutes'),\n          teacherStudent:",
    'capture check-in timing',
)
html = replace_once(
    html,
    "        apply('#stale-pass-minutes', snapshot.staleMinutes);\n        apply('#teacher-student',",
    "        apply('#stale-pass-minutes', snapshot.staleMinutes);\n        apply('#checkin-window-minutes', snapshot.checkInWindowMinutes);\n        apply('#teacher-student',",
    'restore check-in timing',
)
html = replace_once(
    html,
    "          'stale-pass-minutes': 'Show a stronger check-on-student warning. Must be at least the overdue-warning time. This does not end a pass.',",
    "          'stale-pass-minutes': 'Show a stronger check-on-student warning. Must be at least the overdue-warning time. This does not end a pass.',\n          'checkin-window-minutes': 'Minutes after class starts that count as on-time. Students can still sign in afterward; late sign-ins begin at 0 points until you review them.',",
    'check-in timing help',
)
html = replace_once(
    html,
    "        const absentToday = state.absentToday || [];\n        const repeatPassesToday = state.repeatPassesToday || [];",
    "        const absentToday = state.absentToday || [];\n        const lateCheckInsToday = state.lateCheckInsToday || [];\n        const pendingLateCheckIns = lateCheckInsToday.filter((checkIn) => checkIn.status === 'LATE_PENDING');\n        const checkInWindowMinutes = Number(state.checkInWindowMinutes || 5);\n        const repeatPassesToday = state.repeatPassesToday || [];",
    'teacher late-check-in variables',
)

late_rows = r'''        const lateCheckInRows = lateCheckInsToday.length ? lateCheckInsToday
          .slice()
          .sort((a, b) => new Date(a.checkInTime) - new Date(b.checkInTime))
          .map((checkIn) => {
            const pending = checkIn.status === 'LATE_PENDING';
            const approved = checkIn.status === 'LATE_APPROVED';
            const decision = approved ? 'point awarded' : checkIn.status === 'LATE_NO_POINT' ? 'no point' : 'needs review';
            const actions = pending
              ? `<div class="table-actions"><button class="secondary compact" data-late-checkin-review="${escapeHtml(checkIn.checkInId)}" data-late-decision="AWARD_POINT">award point</button><button class="secondary compact danger" data-late-checkin-review="${escapeHtml(checkIn.checkInId)}" data-late-decision="KEEP_NO_POINT">keep no point</button></div>`
              : approved
                ? `<button class="secondary compact danger" data-late-checkin-review="${escapeHtml(checkIn.checkInId)}" data-late-decision="KEEP_NO_POINT">change to no point</button>`
                : `<button class="secondary compact" data-late-checkin-review="${escapeHtml(checkIn.checkInId)}" data-late-decision="AWARD_POINT">award point</button>`;
            return `<tr><td class="who">${escapeHtml(checkIn.studentName)}</td><td>${escapeHtml(checkIn.classPeriod)}</td><td>${formatClock(checkIn.checkInTime)}</td><td>${escapeHtml(checkIn.point)}</td><td>${escapeHtml(decision)}</td><td class="action">${actions}</td></tr>`;
          }).join('')
          : '<tr><td colspan="6">No late sign-ins today.</td></tr>';

'''
html = replace_once(
    html,
    '        const notCheckedRows = notChecked.length ? notChecked',
    late_rows + '        const notCheckedRows = notChecked.length ? notChecked',
    'late sign-in table rows',
)
html = replace_once(
    html,
    "              <div><h3>daily check-ins.</h3><p>${state.checkInsToday.length} recorded · ${absentToday.length} marked absent · one point maximum per class membership each day</p></div>",
    "              <div><h3>daily check-ins.</h3><p>${state.checkInsToday.length} recorded · ${lateCheckInsToday.length} late · ${pendingLateCheckIns.length} need point review · ${absentToday.length} marked absent</p></div>",
    'teacher attendance summary',
)
attendance_controls = r'''            <div class="checkin-summary">${summaryHtml}</div>
            <section class="subcard" id="checkin-timing" style="margin-top:18px">
              <h3>on-time window</h3>
              <div class="override">
                <label>Minutes after class starts<input type="number" id="checkin-window-minutes" min="1" max="240" step="1" value="${escapeHtml(checkInWindowMinutes)}"></label>
                <p class="message">After this many minutes, students are not blocked. Their sign-in is saved as late with 0 points until you decide whether to award the daily point.</p>
                <button class="secondary" id="save-checkin-window">save check-in timing</button>
              </div>
            </section>
            <details class="subcard log" id="late-checkins-details" data-teacher-details style="margin-top:18px" ${pendingLateCheckIns.length ? 'open' : ''}>
              <summary>late sign-ins · ${escapeHtml(lateCheckInsToday.length)} today · ${escapeHtml(pendingLateCheckIns.length)} need review</summary>
              <p class="message" style="margin:12px 0">Late students are recorded immediately instead of being denied. Awarding the point also counts the day toward the student’s check-in streak; keeping no point preserves the late record at zero.</p>
              <table><thead><tr><th>student</th><th>class</th><th>signed in</th><th>point</th><th>review</th><th class="action">decision</th></tr></thead><tbody>${lateCheckInRows}</tbody></table>
            </details>
            <section class="subcard" style="margin-top:18px"><h3>record a student’s attendance</h3>'''
html = replace_once(
    html,
    '            <div class="checkin-summary">${summaryHtml}</div>\n            <section class="subcard" style="margin-top:18px"><h3>record a student’s attendance</h3>',
    attendance_controls,
    'teacher attendance controls',
)

late_handlers = r'''        document.querySelector('#save-checkin-window').addEventListener('click', async (event) => {
          const minutes = Number(document.querySelector('#checkin-window-minutes').value);
          act(event.currentTarget, async () => {
            adoptState(await call('teacherSetCheckInWindow', minutes));
            renderTeacher();
          });
        });

        document.querySelectorAll('[data-late-checkin-review]').forEach((button) => button.addEventListener('click', async () => {
          const decision = button.dataset.lateDecision;
          const prompt = decision === 'AWARD_POINT'
            ? 'Award the daily point for this late sign-in? The original late time will remain in the private log.'
            : 'Keep this late sign-in at 0 points? The original late time will remain in the private log.';
          if (!await teacherConfirm(prompt)) return;
          act(button, async () => {
            adoptState(await call('teacherReviewLateCheckIn', button.dataset.lateCheckinReview, decision));
            renderTeacher();
          });
        }));

'''
html = replace_once(
    html,
    "        document.querySelector('#save-pass-limits').addEventListener('click', async (event) => {",
    late_handlers + "        document.querySelector('#save-pass-limits').addEventListener('click', async (event) => {",
    'late check-in teacher handlers',
)
html = replace_once(
    html,
    "        const unmatched = (data.unmatchedSignIns || []).length;\n        const rollovers = (data.rolloverPassesToday || []).length;",
    "        const unmatched = (data.unmatchedSignIns || []).length;\n        const pendingLateCheckIns = (data.lateCheckInsToday || []).filter((checkIn) => checkIn.status === 'LATE_PENDING').length;\n        const rollovers = (data.rolloverPassesToday || []).length;",
    'late notification count',
)
html = replace_once(
    html,
    "        if (late) add('urgent', `${late} overdue ${late === 1 ? 'pass' : 'passes'}`, 'Review the students who are still out. Mark returned only after confirming they are back.', 'overview', 'live-pass-section', 'View passes');",
    "        if (late) add('urgent', `${late} overdue ${late === 1 ? 'pass' : 'passes'}`, 'Review the students who are still out. Mark returned only after confirming they are back.', 'overview', 'live-pass-section', 'View passes');\n        if (pendingLateCheckIns) add('warning', `${pendingLateCheckIns} late ${pendingLateCheckIns === 1 ? 'sign-in needs' : 'sign-ins need'} point review`, 'Students were allowed to sign in after your on-time window. Decide whether each one earns the daily point.', 'attendance', 'late-checkins-details', 'Review late sign-ins');",
    'late review notification',
)
INDEX.write_text(html)

# --------------------------------------------------------- public launcher
page = PAGE.read_text()
page = replace_once(page, 'description="Record today’s private class attendance check-in and daily extra-credit point."', 'description="Record today’s private class attendance check-in; late arrivals stay recorded for teacher review."', 'public description')
page = replace_once(page, 'grantdesk // first five minutes', 'grantdesk // daily attendance', 'public eyebrow')
page = replace_once(
    page,
    'Open the check-in with your school Google account, confirm the class, and enter your fresh six-digit PIN. That records one attendance check-in and one daily extra-credit point.',
    'Open the check-in with your school Google account, confirm the class, and enter your fresh six-digit PIN. On-time check-ins earn the daily point automatically; late sign-ins are still recorded for teacher review.',
    'public intro',
)
page = replace_once(page, 'one check-in · one day · one point', 'on time · point earned · late · still recorded', 'public launch eyebrow')
page = replace_once(
    page,
    'Enter your one student PIN for today’s check-in. GrantDesk supplies the official date and time.',
    'Enter your one student PIN for today’s check-in. GrantDesk supplies the official date and time, even when the sign-in is late.',
    'public PIN step',
)
page = replace_once(
    page,
    'Wait for the green confirmation and check your school-day streak. Weekends and official no-school days never break it; reduced and half days still count.',
    'Wait for the confirmation and check your school-day streak. On-time check-ins count automatically; if you are late, your teacher decides whether that day earns the point and joins the streak.',
    'public streak step',
)
PAGE.write_text(page)

# --------------------------------------------------------------- tests
static_test = STATIC_TEST.read_text()
static_test = replace_once(static_test, "assert.match(code, /GD_SCHEMA_VERSION\\s*=\\s*'2026-09-05-session-a'/);", "assert.match(code, /GD_SCHEMA_VERSION\\s*=\\s*'2026-09-09-late-checkins'/);", 'static schema assertion')
static_test = replace_once(
    static_test,
    "assert.match(code, /function teacherSetPassRules/);",
    "assert.match(code, /function teacherSetPassRules/);\nassert.match(code, /function teacherSetCheckInWindow/);\nassert.match(code, /function teacherReviewLateCheckIn/);\nassert.match(code, /LATE_PENDING/);\nassert.match(code, /LATE_APPROVED/);\nassert.match(code, /LATE_NO_POINT/);\nassert.match(html, /Late sign-in recorded/);",
    'static late feature assertions',
)
STATIC_TEST.write_text(static_test)

runtime_test = RUNTIME_TEST.read_text()
runtime_test = replace_once(runtime_test, "assert.equal(c.harness.properties.getProperty('WORKBOOK_SCHEMA'), '2026-09-05-session-a');", "assert.equal(c.harness.properties.getProperty('WORKBOOK_SCHEMA'), '2026-09-09-late-checkins');", 'runtime schema assertion')

late_tests = r'''
test('the teacher-configured on-time window changes when a check-in becomes late', () => {
  const c = classroom({
    now: new Date('2026-09-10T11:40:00Z'),
    settings: { CHECKIN_WINDOW_MINUTES: 15 },
  });
  const result = c.checkIn(PEOPLE.ada, 'Period 1');
  const row = c.checkIns()[0];
  assert.equal(String(row.Status), 'CHECKED_IN');
  assert.equal(Number(row.Point), 1);
  assert.equal(outcomeOf(result).kind, 'CHECKED_IN');
});

test('a student after the on-time window is recorded late instead of denied', () => {
  const c = classroom({
    now: new Date('2026-09-10T11:40:00Z'),
    settings: { CHECKIN_WINDOW_MINUTES: 5 },
  });
  const result = c.checkIn(PEOPLE.ada, 'Period 1');
  const row = c.checkIns()[0];
  assert.equal(String(row.Status), 'LATE_PENDING');
  assert.equal(Number(row.Point), 0);
  assert.equal(outcomeOf(result).kind, 'LATE_CHECK_IN_RECORDED');
  assert.equal(result.state.checkedIn, true);
  assert.equal(result.state.lateCheckIn, true);
});

test('a student can still record a late sign-in after the selected class has ended', () => {
  const c = classroom({ now: new Date('2026-09-10T13:00:00Z') });
  const result = c.checkIn(PEOPLE.ada, 'Period 1');
  assert.equal(outcomeOf(result).kind, 'LATE_CHECK_IN_RECORDED');
  assert.equal(String(c.checkIns()[0].Status), 'LATE_PENDING');
});

test('a late sign-in clears an earlier absent mark without deleting either audit fact', () => {
  const c = classroom({ now: new Date('2026-09-10T11:40:00Z') });
  const key = c.key(PEOPLE.ada, 'Period 1');
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherMarkStudentAbsent', key);
  c.checkIn(PEOPLE.ada, 'Period 1');
  const rows = c.checkIns();
  assert.equal(rows.length, 2);
  assert.equal(String(rows[0].Status), 'CLEARED');
  assert.equal(String(rows[1].Status), 'LATE_PENDING');
});

test('the teacher can award the point for a late sign-in and it then counts for the streak', () => {
  const c = classroom({ now: new Date('2026-09-10T11:40:00Z') });
  c.checkIn(PEOPLE.ada, 'Period 1');
  const id = String(c.checkIns()[0]['Check-in ID']);
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const state = c.harness.call('teacherReviewLateCheckIn', id, 'AWARD_POINT', TEACHER_CONTRACT);
  const row = c.checkIns()[0];
  assert.equal(String(row.Status), 'LATE_APPROVED');
  assert.equal(Number(row.Point), 1);
  const teacherRow = state.lateCheckInsToday.find((entry) => entry.checkInId === id);
  assert.equal(teacherRow.status, 'LATE_APPROVED');
  assert.equal(teacherRow.streak.current, 1);
});

test('the teacher can keep a late sign-in at zero without removing the arrival record', () => {
  const c = classroom({ now: new Date('2026-09-10T11:40:00Z') });
  c.checkIn(PEOPLE.ada, 'Period 1');
  const id = String(c.checkIns()[0]['Check-in ID']);
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  const state = c.harness.call('teacherReviewLateCheckIn', id, 'KEEP_NO_POINT', TEACHER_CONTRACT);
  const row = c.checkIns()[0];
  assert.equal(String(row.Status), 'LATE_NO_POINT');
  assert.equal(Number(row.Point), 0);
  const teacherRow = state.lateCheckInsToday.find((entry) => entry.checkInId === id);
  assert.equal(teacherRow.status, 'LATE_NO_POINT');
  assert.equal(teacherRow.streak.current, 0);
});

test('the teacher can change a reviewed late decision while the original sign-in time remains', () => {
  const c = classroom({ now: new Date('2026-09-10T11:40:00Z') });
  c.checkIn(PEOPLE.ada, 'Period 1');
  const first = c.checkIns()[0];
  const id = String(first['Check-in ID']);
  const originalTime = first['Check-in Time'].getTime();
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherReviewLateCheckIn', id, 'KEEP_NO_POINT', TEACHER_CONTRACT);
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherReviewLateCheckIn', id, 'AWARD_POINT', TEACHER_CONTRACT);
  const row = c.checkIns()[0];
  assert.equal(String(row.Status), 'LATE_APPROVED');
  assert.equal(Number(row.Point), 1);
  assert.equal(row['Check-in Time'].getTime(), originalTime);
});

'''
runtime_test = replace_once(
    runtime_test,
    "test('checking in twice in one day does not add a second row or a second point', () => {",
    late_tests + "test('checking in twice in one day does not add a second row or a second point', () => {",
    'runtime late check-in tests',
)
RUNTIME_TEST.write_text(runtime_test)

for path in (CODE, INDEX, PAGE, STATIC_TEST, RUNTIME_TEST):
    if not path.read_text().strip():
        raise SystemExit(f'{path} became empty')

print('late check-in implementation applied')
