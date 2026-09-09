from pathlib import Path

root = Path(__file__).resolve().parents[1]


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)


# Keep the repository handoff map aligned with the intentional schema/API change.
path = root / 'scripts/validate-grantdesk-handoff.mjs'
text = path.read_text()
text = replace_once(
    text,
    "  'teacherVoidPass',\n  'teacherApplyUnmatchedEmail',",
    "  'teacherVoidPass',\n  'teacherSetCheckInWindow',\n  'teacherReviewLateCheckIn',\n  'teacherApplyUnmatchedEmail',",
    'critical-function map',
)
text = replace_once(
    text,
    "  /const\\s+GD_SCHEMA_VERSION\\s*=\\s*['\"]2026-09-05-session-a['\"]/.test(code),\n  'tracked workbook schema is 2026-09-05-session-a'",
    "  /const\\s+GD_SCHEMA_VERSION\\s*=\\s*['\"]2026-09-09-late-checkins['\"]/.test(code),\n  'tracked workbook schema is 2026-09-09-late-checkins'",
    'schema handoff map',
)
path.write_text(text)

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

# Preserve teacher-entered absences while still allowing a student to create a
# separate late-arrival fact after the configured on-time window has elapsed.
code_path = root / 'apps-script/hall-pass/Code.gs'
code = code_path.read_text()
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
    "  const existing = todayEntries.find((entry) => checkInStatusIsRecorded_(entry.status));\n  const absence = todayEntries.find((entry) => entry.status === 'ABSENT');\n  if (existing) return existing;\n\n  const settings = getSettings_();\n  const late = method !== 'teacher' && Boolean(lateOverride);\n  if (absence && method !== 'teacher' && !late) {\n    throw new Error('Your attendance needs a teacher update today. Ask your teacher to mark you here.');\n  }\n  if (absence && method === 'teacher') {\n    clearAbsentEntry_(absence, `Cleared when ${method} check-in was recorded`);\n  }",
    'teacher absence compatibility',
)
code_path.write_text(code)

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

# Update the new behavioral expectation: a late student arrival is evidence in
# addition to a teacher absence, not a student-side erasure of that absence.
runtime_path = root / 'scripts/test-hall-pass-runtime.cjs'
runtime = runtime_path.read_text()
runtime = replace_once(
    runtime,
    "test('a late sign-in clears an earlier absent mark without deleting either audit fact', () => {\n  const c = classroom({ now: new Date('2026-09-10T11:40:00Z') });\n  const key = c.key(PEOPLE.ada, 'Period 1');\n  c.harness.newRequest();\n  c.harness.signInAs(TEACHER);\n  c.harness.call('teacherMarkStudentAbsent', key);\n  c.checkIn(PEOPLE.ada, 'Period 1');\n  const rows = c.checkIns();\n  assert.equal(rows.length, 2);\n  assert.equal(String(rows[0].Status), 'CLEARED');\n  assert.equal(String(rows[1].Status), 'LATE_PENDING');\n});",
    "test('a late sign-in is recorded alongside an earlier teacher absence', () => {\n  const c = classroom({ now: new Date('2026-09-10T11:40:00Z') });\n  const key = c.key(PEOPLE.ada, 'Period 1');\n  c.harness.newRequest();\n  c.harness.signInAs(TEACHER);\n  c.harness.call('teacherMarkStudentAbsent', key);\n  c.checkIn(PEOPLE.ada, 'Period 1');\n  const rows = c.checkIns();\n  assert.equal(rows.length, 2);\n  assert.equal(String(rows[0].Status), 'ABSENT');\n  assert.equal(String(rows[1].Status), 'LATE_PENDING');\n});",
    'runtime absence-plus-late test',
)
runtime_path.write_text(runtime)

print('handoff map, public guidance, and teacher-absence compatibility aligned')
