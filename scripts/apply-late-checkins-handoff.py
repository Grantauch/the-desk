from pathlib import Path

root = Path(__file__).resolve().parents[1]


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)


# This feature reuses existing Daily Check-ins columns and the existing
# CHECKIN_WINDOW_MINUTES setting. Keep the workbook schema identity unchanged;
# a schema bump would unnecessarily rerun migration/reconciliation logic.
code_path = root / 'apps-script/hall-pass/Code.gs'
code = code_path.read_text()
code = replace_once(
    code,
    "const GD_SCHEMA_VERSION = '2026-09-09-late-checkins';",
    "const GD_SCHEMA_VERSION = '2026-09-05-session-a';",
    'schema neutrality',
)

# Preserve teacher-entered absences while still allowing a student to create a
# separate late-arrival fact after the configured on-time window has elapsed.
code = replace_once(
    code,
    "function assertStudentActionEligible_(student, action) {\n  const eligibility = studentActionEligibility_(student, action);\n  if (!eligibility.allowed) throw new Error(eligibility.message);\n}",
    "function assertStudentActionEligible_(student, action) {\n  const eligibility = studentActionEligibility_(student, action);\n  if (!eligibility.allowed) throw new Error(eligibility.message);\n  return eligibility;\n}",
    'eligibility return value',
)
code = replace_once(
    code,
    "    resolved = consumeStudentActionProof_(actionProof, GD_STUDENT_ACTIONS.CHECKIN, studentKey);\n    assertStudentActionEligible_(resolved.student, GD_STUDENT_ACTIONS.CHECKIN);\n    recorded = recordCheckIn_(resolved.student, resolved.method, 'Fresh PIN verified for this check-in');",
    "    resolved = consumeStudentActionProof_(actionProof, GD_STUDENT_ACTIONS.CHECKIN, studentKey);\n    const eligibility = assertStudentActionEligible_(resolved.student, GD_STUDENT_ACTIONS.CHECKIN);\n    recorded = recordCheckIn_(\n      resolved.student,\n      resolved.method,\n      'Fresh PIN verified for this check-in',\n      Boolean(eligibility.late)\n    );",
    'late eligibility handoff',
)
code = replace_once(
    code,
    "  const absence = allCheckIns.find((entry) => (\n    entry.dateKey === todayKey &&\n    entry.studentKey === student.key &&\n    entry.status === 'ABSENT'\n  ));\n  return {",
    "  const absence = allCheckIns.find((entry) => (\n    entry.dateKey === todayKey &&\n    entry.studentKey === student.key &&\n    entry.status === 'ABSENT'\n  ));\n  const sessionEligibility = studentActionEligibility_(student, GD_STUDENT_ACTIONS.CHECKIN);\n  return {",
    'check-in eligibility state',
)
code = replace_once(
    code,
    "    // An old absent mark is evidence, not a student lock. A later sign-in clears\n    // that mark in the audit trail and writes the actual arrival time.\n    attendanceLocked: false,\n    priorAbsence: Boolean(absence && !checkIn),\n    sessionEligibility: studentActionEligibility_(student, GD_STUDENT_ACTIONS.CHECKIN),",
    "    // A teacher-entered absence stays authoritative while the student is still\n    // inside the on-time window. After the cutoff, a separate late-arrival record\n    // may be added without silently clearing the teacher's attendance decision.\n    attendanceLocked: Boolean(absence && !checkIn && !sessionEligibility.late),\n    priorAbsence: Boolean(absence && !checkIn),\n    sessionEligibility,",
    'attendance lock state',
)
code = replace_once(
    code,
    "function recordCheckIn_(student, method, note) {",
    "function recordCheckIn_(student, method, note, lateOverride) {",
    'record check-in signature',
)
code = replace_once(
    code,
    "  const existing = todayEntries.find((entry) => checkInStatusIsRecorded_(entry.status));\n  const absence = todayEntries.find((entry) => entry.status === 'ABSENT');\n  if (existing) {\n    if (absence) clearAbsentEntry_(absence, 'Cleared automatically because a check-in was already recorded');\n    return existing;\n  }\n  if (absence) clearAbsentEntry_(absence, `Cleared when ${method} check-in was recorded`);\n\n  const settings = getSettings_();\n  const session = method === 'teacher' ? null : getClassSession_(student);\n  const late = Boolean(session && session.checkInLate);",
    "  const existing = todayEntries.find((entry) => checkInStatusIsRecorded_(entry.status));\n  const absence = todayEntries.find((entry) => entry.status === 'ABSENT');\n  if (existing) return existing;\n\n  const settings = getSettings_();\n  const session = method === 'teacher' ? null : getClassSession_(student);\n  const late = method !== 'teacher' && Boolean(lateOverride);\n  if (absence && method !== 'teacher' && !late) {\n    throw new Error('Your attendance needs a teacher update today. Ask your teacher to mark you here.');\n  }\n  if (absence && method === 'teacher') {\n    clearAbsentEntry_(absence, `Cleared when ${method} check-in was recorded`);\n  }",
    'teacher absence compatibility',
)
# Teacher manual attendance after the on-time boundary remains an audited
# override: require a reason even though student self-check-in remains available.
code = replace_once(
    code,
    "    const eligibility = studentActionEligibility_(student, GD_STUDENT_ACTIONS.CHECKIN);\n    if (!eligibility.allowed && !cleanReason) throw new Error('Enter a short private reason for recording attendance outside the check-in window.');\n    const entry = recordCheckIn_(student, 'teacher', `Recorded by ${teacher}`);\n    auditTeacherAction_(teacher, student, 'CHECKIN_RECORDED', eligibility.allowed ? [] : [eligibility.blockReason], cleanReason, entry.checkInId);",
    "    const eligibility = studentActionEligibility_(student, GD_STUDENT_ACTIONS.CHECKIN);\n    const restrictions = [];\n    if (!eligibility.allowed) restrictions.push(eligibility.blockReason);\n    if (eligibility.late) restrictions.push('LATE_CHECKIN_WINDOW');\n    if (restrictions.length && !cleanReason) throw new Error('Enter a short private reason for recording attendance outside the on-time check-in window.');\n    const entry = recordCheckIn_(student, 'teacher', `Recorded by ${teacher}`);\n    auditTeacherAction_(teacher, student, 'CHECKIN_RECORDED', restrictions, cleanReason, entry.checkInId);",
    'teacher late attendance audit',
)
code_path.write_text(code)

# Keep the repository handoff map aligned with the new teacher-facing API while
# retaining the existing workbook schema version.
path = root / 'scripts/validate-grantdesk-handoff.mjs'
text = path.read_text()
text = replace_once(
    text,
    "  'teacherVoidPass',\n  'teacherApplyUnmatchedEmail',",
    "  'teacherVoidPass',\n  'teacherSetCheckInWindow',\n  'teacherReviewLateCheckIn',\n  'teacherApplyUnmatchedEmail',",
    'critical-function map',
)
path.write_text(text)

# Undo schema-only test edits from the implementation script; no schema changed.
static_path = root / 'scripts/test-hall-pass-app.cjs'
static_test = static_path.read_text()
static_test = replace_once(
    static_test,
    "assert.match(code, /GD_SCHEMA_VERSION\\s*=\\s*'2026-09-09-late-checkins'/);",
    "assert.match(code, /GD_SCHEMA_VERSION\\s*=\\s*'2026-09-05-session-a'/);",
    'static schema assertion',
)
static_path.write_text(static_test)

runtime_path = root / 'scripts/test-hall-pass-runtime.cjs'
runtime = runtime_path.read_text()
runtime = replace_once(
    runtime,
    "assert.equal(c.harness.properties.getProperty('WORKBOOK_SCHEMA'), '2026-09-09-late-checkins');",
    "assert.equal(c.harness.properties.getProperty('WORKBOOK_SCHEMA'), '2026-09-05-session-a');",
    'runtime schema assertion',
)
# A late student arrival is evidence in addition to a teacher absence, not a
# student-side erasure of that absence.
runtime = replace_once(
    runtime,
    "test('a late sign-in clears an earlier absent mark without deleting either audit fact', () => {\n  const c = classroom({ now: new Date('2026-09-10T11:40:00Z') });\n  const key = c.key(PEOPLE.ada, 'Period 1');\n  c.harness.newRequest();\n  c.harness.signInAs(TEACHER);\n  c.harness.call('teacherMarkStudentAbsent', key);\n  c.checkIn(PEOPLE.ada, 'Period 1');\n  const rows = c.checkIns();\n  assert.equal(rows.length, 2);\n  assert.equal(String(rows[0].Status), 'CLEARED');\n  assert.equal(String(rows[1].Status), 'LATE_PENDING');\n});",
    "test('a late sign-in is recorded alongside an earlier teacher absence', () => {\n  const c = classroom({ now: new Date('2026-09-10T11:40:00Z') });\n  const key = c.key(PEOPLE.ada, 'Period 1');\n  c.harness.newRequest();\n  c.harness.signInAs(TEACHER);\n  c.harness.call('teacherMarkStudentAbsent', key);\n  c.checkIn(PEOPLE.ada, 'Period 1');\n  const rows = c.checkIns();\n  assert.equal(rows.length, 2);\n  assert.equal(String(rows[0].Status), 'ABSENT');\n  assert.equal(String(rows[1].Status), 'LATE_PENDING');\n});",
    'runtime absence-plus-late test',
)
runtime_path.write_text(runtime)

# The original session matrix treated the five-minute cutoff as a hard lockout.
# It should now verify two separate facts: check-in remains available after class
# begins, while the cutoff flips the record from on-time to late. Pass timing is
# unchanged and remains independently asserted.
session_path = root / 'scripts/lib/hall-pass-session-tests.cjs'
session_tests = session_path.read_text()
session_tests = replace_once(
    session_tests,
    "      const cases = [\n        ['before start', startMs - 1, false, false],\n        ['at start', startMs, true, false],\n        ['before five minutes', startMs + 300000 - 1, true, false],\n        ['at five minutes', startMs + 300000, false, false],\n        ['before ten minutes', startMs + 600000 - 1, false, false],\n        ['at ten minutes', startMs + 600000, false, true],\n        ['before final ten', endMs - 600000 - 1, false, true],\n        ['at final ten', endMs - 600000, false, false],\n        ['at bell', endMs, false, false],\n      ];\n      for (const [label, time, checkInAllowed, passRequestAllowed] of cases) {",
    "      const cases = [\n        ['before start', startMs - 1, false, false, false],\n        ['at start', startMs, true, false, false],\n        ['before five minutes', startMs + 300000 - 1, true, false, false],\n        ['at five minutes', startMs + 300000, true, true, false],\n        ['before ten minutes', startMs + 600000 - 1, true, true, false],\n        ['at ten minutes', startMs + 600000, true, true, true],\n        ['before final ten', endMs - 600000 - 1, true, true, true],\n        ['at final ten', endMs - 600000, true, true, false],\n        ['at bell', endMs, true, true, false],\n      ];\n      for (const [label, time, checkInAllowed, checkInLate, passRequestAllowed] of cases) {",
    'session timing cases',
)
session_tests = replace_once(
    session_tests,
    "          assert.equal(session.checkInAllowed, checkInAllowed);\n          assert.equal(session.passRequestAllowed, passRequestAllowed);",
    "          assert.equal(session.checkInAllowed, checkInAllowed);\n          assert.equal(Boolean(session.checkInLate), checkInLate);\n          assert.equal(session.passRequestAllowed, passRequestAllowed);",
    'session late assertion',
)
session_tests = replace_once(
    session_tests,
    "  test('wrong-time PIN identification issues no action proof', () => {\n    const c = classroom();\n    const before = Object.keys(c.harness.properties.getProperties()).filter(k=>k.startsWith('student-action:')).length;\n    assert.throws(() => c.harness.call('identifyCheckInWithPin', c.pin(PEOPLE.ada), 'test'), /first five/);\n    assert.equal(Object.keys(c.harness.properties.getProperties()).filter(k=>k.startsWith('student-action:')).length, before);\n    assert.deepEqual(counts(c), [0,0,0]);\n  });",
    "  test('late-time PIN identification still issues a protected check-in proof', () => {\n    const c = classroom();\n    const before = Object.keys(c.harness.properties.getProperties()).filter(k=>k.startsWith('student-action:')).length;\n    const identified = c.harness.call('identifyCheckInWithPin', c.pin(PEOPLE.ada), 'test');\n    assert.ok(identified.actionProof);\n    assert.equal(Boolean(identified.sessionEligibility && identified.sessionEligibility.late), true);\n    assert.equal(Object.keys(c.harness.properties.getProperties()).filter(k=>k.startsWith('student-action:')).length, before + 1);\n    assert.deepEqual(counts(c), [0,0,0]);\n  });",
    'late identification proof test',
)
session_tests = replace_once(
    session_tests,
    "  for (const [action, time, endpoint] of [['CHECKIN','07:34:59','submitDailyCheckIn'], ['PASS_REQUEST','08:14:59','requestBathroomPass']]) {\n    test(`${action} is checked again under the lock after its boundary`, () => {\n      const c = classroom({now:new Date(`2026-09-10T${time}-04:00`)});\n      const key = c.key(PEOPLE.ada, 'Period 1');\n      const proof = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), action, key, 'boundary');\n      c.harness.clock.advanceSeconds(1); c.harness.newRequest();\n      assert.throws(() => c.harness.call(endpoint, proof.actionProof, key, proof.pinToken), /first five|first and last ten/);\n      assert.deepEqual(counts(c), [0,0,0]);\n    });\n  }",
    "  test('CHECKIN is reclassified as late under the lock when the cutoff passes', () => {\n    const c = classroom({now:new Date('2026-09-10T07:34:59-04:00')});\n    const key = c.key(PEOPLE.ada, 'Period 1');\n    const proof = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'CHECKIN', key, 'boundary');\n    c.harness.clock.advanceSeconds(1); c.harness.newRequest();\n    const state = c.harness.call('submitDailyCheckIn', proof.actionProof, key, proof.pinToken);\n    assert.equal(state.lateCheckIn, true);\n    assert.equal(String(c.checkIns()[0].Status), 'LATE_PENDING');\n  });\n  test('PASS_REQUEST is still checked again under the lock after its boundary', () => {\n    const c = classroom({now:new Date('2026-09-10T08:14:59-04:00')});\n    const key = c.key(PEOPLE.ada, 'Period 1');\n    const proof = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'PASS_REQUEST', key, 'boundary');\n    c.harness.clock.advanceSeconds(1); c.harness.newRequest();\n    assert.throws(() => c.harness.call('requestBathroomPass', proof.actionProof, key, proof.pinToken), /first and last ten/);\n    assert.deepEqual(counts(c), [0,0,0]);\n  });",
    'boundary race tests',
)
session_path.write_text(session_tests)

# Preserve the existing public promise about weekends and official no-school days.
page_path = root / 'src/pages/check-in.astro'
page = page_path.read_text()
page = replace_once(
    page,
    'Wait for the confirmation and check your school-day streak. On-time check-ins count automatically; if you are late, your teacher decides whether that day earns the point and joins the streak.',
    'Wait for the confirmation and check your school-day streak. On-time check-ins count automatically; if you are late, your teacher decides whether that day earns the point and joins the streak. Weekends and official no-school days never break it.',
    'public streak guidance',
)
page_path.write_text(page)

# The student interface should retain the old teacher-attendance warning while
# still switching to the late-recording action once the configured cutoff passes.
html_path = root / 'apps-script/hall-pass/Index.html'
html = html_path.read_text()
html = replace_once(
    html,
    "${state.checkedIn ? late ? 'late sign-in' : 'recorded for today' : actionIsLate ? 'late check-in available' : 'on-time check-in'}",
    "${state.checkedIn ? late ? 'late sign-in' : 'recorded for today' : state.attendanceLocked ? 'teacher attendance review' : actionIsLate ? 'late check-in available' : 'on-time check-in'}",
    'student attendance eyebrow',
)
html = replace_once(
    html,
    "${state.checkedIn ? late ? 'late recorded' : 'checked in' : actionIsLate ? 'late window' : 'not checked in yet'}",
    "${state.checkedIn ? late ? 'late recorded' : 'checked in' : state.attendanceLocked ? 'see your teacher' : actionIsLate ? 'late window' : 'not checked in yet'}",
    'student attendance status',
)
html = replace_once(
    html,
    "            ${state.checkedIn ? `\n              <div class=\"checkin-confirm ${late ? 'late' : ''}\" role=\"status\">",
    "            ${state.checkedIn ? `\n              <div class=\"checkin-confirm ${late ? 'late' : ''}\" role=\"status\">",
    'student recorded branch anchor',
)
html = replace_once(
    html,
    "              </div>` : `\n              <div class=\"checkin-copy\">",
    "              </div>` : state.attendanceLocked ? `\n              <div class=\"notice warning\" role=\"status\">\n                <h3>teacher update needed.</h3>\n                <p>Your teacher already entered today’s attendance. Ask your teacher to update it. If the on-time window passes before that happens, this screen will allow a separate late sign-in instead of deleting the teacher’s record.</p>\n              </div>\n              <div class=\"pass-action\">\n                ${sharedDevice()\n                  ? '<button class=\"secondary\" id=\"checkin-next\">different student</button>'\n                  : '<button class=\"secondary\" id=\"checkin-pin\">use a PIN instead</button>'}\n              </div>` : `\n              <div class=\"checkin-copy\">",
    'student attendance warning branch',
)
html_path.write_text(html)

print('late check-in timing, audit, and regression expectations aligned')
