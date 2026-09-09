from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


code_path = Path("apps-script/hall-pass/Code.gs")
code = code_path.read_text()

code = replace_once(
    code,
    "const GD_CHECKIN_FLUSH_TRIGGER_PROPERTY = 'CHECKIN_FLUSH_TRIGGER_INSTALLED';\n",
    "const GD_CHECKIN_FLUSH_TRIGGER_PROPERTY = 'CHECKIN_FLUSH_TRIGGER_INSTALLED';\nconst GD_INFERRED_PASS_ACTION_STABILITY_SECONDS = 8;\n",
    "stability constant",
)

code = replace_once(
    code,
    "  const action = purpose === 'checkin' ? GD_STUDENT_ACTIONS.CHECKIN : inferPassAction_(email);\n",
    "  const action = purpose === 'checkin'\n    ? GD_STUDENT_ACTIONS.CHECKIN\n    : stabilizeInferredPassAction_(email, attemptNonce, inferPassAction_(email));\n",
    "identifyPin action stabilization",
)

code = replace_once(
    code,
    "  const action = requested === 'AUTO_PASS'\n    ? inferPassAction_(email)\n    : normalizeStudentAction_(requestedAction);\n",
    "  const action = requested === 'AUTO_PASS'\n    ? stabilizeInferredPassAction_(email, attemptNonce, inferPassAction_(email))\n    : normalizeStudentAction_(requestedAction);\n",
    "authorizeStudentAction AUTO_PASS stabilization",
)

infer_block = """function inferPassAction_(email) {
  const normalized = normalizeEmail_(email);
  const todayKey = dateKey_(new Date());
  return readPassLog_().some((pass) => (
    pass.studentEmail === normalized && pass.status === 'OUT' && safeDateKey_(pass.outDate) === todayKey
  )) ? GD_STUDENT_ACTIONS.RETURN : GD_STUDENT_ACTIONS.PASS_REQUEST;
}
"""
stable_helper = infer_block + """

/**
 * Keep a generic PIN submission bound to the action it first inferred for a
 * few seconds. This is defense in depth for rapid duplicate submits: if the
 * first request starts a pass, a near-simultaneous duplicate cannot observe
 * that new OUT row and reinterpret itself as a RETURN. Explicit PASS_REQUEST
 * and RETURN buttons bypass this helper and remain immediate.
 */
function stabilizeInferredPassAction_(email, attemptNonce, inferredAction) {
  const action = normalizeStudentAction_(inferredAction);
  const nonce = String(attemptNonce || '').trim();
  if (!nonce) return action;
  try {
    const cache = CacheService.getScriptCache();
    const key = `pass-intent:${nonce.slice(0, 80)}`;
    const cached = cache.get(key);
    if (cached) {
      const prior = JSON.parse(cached);
      if (
        normalizeEmail_(prior.email) === normalizeEmail_(email) &&
        [GD_STUDENT_ACTIONS.PASS_REQUEST, GD_STUDENT_ACTIONS.RETURN].includes(prior.action)
      ) return prior.action;
    }
    cache.put(
      key,
      JSON.stringify({ email: normalizeEmail_(email), action }),
      GD_INFERRED_PASS_ACTION_STABILITY_SECONDS
    );
  } catch (error) {
    // Browser-side non-reentrancy remains authoritative if cache is unavailable.
  }
  return action;
}
"""
code = replace_once(code, infer_block, stable_helper, "inferred action helper")

late_old = """    const award = choice === 'AWARD_POINT';
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
"""
late_new = """    const award = choice === 'AWARD_POINT';
    const point = award ? numberSetting_(getSettings_(), 'CHECKIN_POINT_VALUE', 1) : 0;
    const status = award ? 'LATE_APPROVED' : 'LATE_NO_POINT';
    const student = getStudentByKey_(entry.studentKey) || {
      email: entry.studentEmail,
      name: entry.studentName,
      classPeriod: entry.classPeriod,
    };
    studentName = student.name;
    outcome = award ? `Awarded ${point} point${point === 1 ? '' : 's'}` : 'Kept at 0 points';

    // Double-clicking the same decision is an idempotent no-op.
    if (String(entry.status || '').toUpperCase() === status && Number(entry.point || 0) === point) return;

    const detail = award
      ? `Late check-in point awarded by ${teacher}`
      : `Late check-in kept at zero points by ${teacher}`;
    const baseNote = String(entry.note || '')
      .split(' · ')
      .filter((part) => !/^Late check-in (point awarded|kept at zero points) by /.test(part))
      .join(' · ')
      .trim();
    const note = [baseNote, detail].filter(Boolean).join(' · ').slice(0, 300);
    getSpreadsheet_().getSheetByName(GD_SHEETS.CHECKINS)
      .getRange(entry.row, 8, 1, 3)
      .setValues([[point, status, note]]);
    gdForget_('checkins');
    auditTeacherAction_(
      teacher,
      student,
      award ? 'LATE_CHECKIN_POINT_AWARDED' : 'LATE_CHECKIN_NO_POINT',
      ['LATE_CHECKIN'],
      '',
      entry.checkInId
    );
"""
code = replace_once(code, late_old, late_new, "late review idempotency")
code_path.write_text(code)

html_path = Path("apps-script/hall-pass/Index.html")
html = html_path.read_text()
act_old = """      /** Wraps a button action so polling never overwrites a request in flight. */
      const act = async (button, work) => {
        if (button) button.disabled = true;
        inFlight += 1;
        clearError();
        try {
          await work();
        } catch (error) {
          showError(error.message);
          if (button) button.disabled = false;
        } finally {
          inFlight -= 1;
          armIdleReset();
        }
      };
"""
act_new = """      /**
       * Run at most one classroom mutation at a time in this page. A second
       * submit while the first is unresolved is ignored, so a PASS_REQUEST can
       * never race itself and become a RETURN after the OUT row appears.
       */
      const act = async (button, work) => {
        if (inFlight) return false;
        if (button) button.disabled = true;
        inFlight = 1;
        clearError();
        try {
          await work();
          return true;
        } catch (error) {
          showError(error.message);
          return false;
        } finally {
          inFlight = 0;
          if (button && document.contains(button)) button.disabled = false;
          armIdleReset();
        }
      };
"""
html = replace_once(html, act_old, act_new, "client non-reentrant act")

for label in ["initial PIN early re-enable", "action PIN early re-enable"]:
    html = replace_once(
        html,
        "            button.disabled = false;\n            if (state.requiresClassSelection) renderClassSelection();\n            else await completeAuthorizedAction();\n",
        "            if (state.requiresClassSelection) renderClassSelection();\n            else await completeAuthorizedAction();\n",
        label,
    )

late_handler_old = """        document.querySelectorAll('[data-late-checkin-review]').forEach((button) => button.addEventListener('click', async () => {
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
"""
late_handler_new = """        document.querySelectorAll('[data-late-checkin-review]').forEach((button) => button.addEventListener('click', () => act(button, async () => {
          const decision = button.dataset.lateDecision;
          const prompt = decision === 'AWARD_POINT'
            ? 'Award the daily point for this late sign-in? The original late time will remain in the private log.'
            : 'Keep this late sign-in at 0 points? The original late time will remain in the private log.';
          if (!await teacherConfirm(prompt)) return;
          adoptState(await call('teacherReviewLateCheckIn', button.dataset.lateCheckinReview, decision));
          renderTeacher();
        })));
"""
html = replace_once(html, late_handler_old, late_handler_new, "late review pre-confirm lock")
html_path.write_text(html)

app_test_path = Path("scripts/test-hall-pass-app.cjs")
app_test = app_test_path.read_text()
marker = "// Preserve the behavioral coverage that predates the Version 9 recovery."
issue73_structural = r"""
// --- Issue 73: protected UI actions must be non-reentrant. ---
const clientActMatch = clientScript.match(/const act = async \(button, work\) => \{([\s\S]*?)\n      \};/);
assert.ok(clientActMatch, 'The client action wrapper must still exist');
assert.match(clientActMatch[1], /if \(inFlight\) return false;/);
assert.match(clientActMatch[1], /inFlight = 1;/);
assert.match(clientActMatch[1], /inFlight = 0;/);
assert.match(clientActMatch[1], /document\.contains\(button\)/);
const initialPinHandler = clientScript.match(/#pin-form'[\s\S]*?const completeAuthorizedAction/);
assert.ok(initialPinHandler);
assert.doesNotMatch(initialPinHandler[0], /button\.disabled = false/);
const actionPinHandler = clientScript.match(/#action-pin-form'[\s\S]*?const renderResolvedState/);
assert.ok(actionPinHandler);
assert.doesNotMatch(actionPinHandler[0], /button\.disabled = false/);
assert.match(clientScript, /data-late-checkin-review[\s\S]*?addEventListener\('click', \(\) => act\(button, async \(\) => \{/);
assert.match(functionSource('identifyPin_'), /stabilizeInferredPassAction_/);
assert.match(functionSource('authorizeStudentAction'), /stabilizeInferredPassAction_/);
const lateReviewSource = functionSource('teacherReviewLateCheckIn');
assert.match(lateReviewSource, /String\(entry\.status \|\| ''\)\.toUpperCase\(\) === status/);
"""
app_test = replace_once(app_test, marker, issue73_structural + "\n" + marker, "Issue 73 structural tests")
app_test_path.write_text(app_test)

runtime_path = Path("scripts/test-hall-pass-runtime.cjs")
runtime = runtime_path.read_text()
runtime_marker = "\n\nrequire('./lib/hall-pass-session-tests.cjs')(test, section);\nreport();"
issue73_runtime = r"""

section('Issue 73 duplicate-action guard');

test('a duplicate generic PIN submit cannot turn a just-started pass into a return', () => {
  const c = classroom();
  const nonce = 'same-device-issue-73';
  c.harness.newRequest();
  const first = c.harness.call('identifyWithPin', c.pin(PEOPLE.ada), nonce);
  const key = first.student.key;
  assert.equal(first.authorizedAction, 'PASS_REQUEST');
  c.harness.newRequest();
  const started = c.harness.call('requestBathroomPass', first.actionProof, key, first.pinToken);
  assert.equal((started.actionOutcome || {}).kind, 'STARTED');
  c.harness.newRequest();
  const duplicate = c.harness.call('identifyWithPin', c.pin(PEOPLE.ada), nonce);
  assert.equal(duplicate.authorizedAction, 'PASS_REQUEST');
  c.harness.newRequest();
  const replayedIntent = c.harness.call('requestBathroomPass', duplicate.actionProof, key, duplicate.pinToken);
  assert.equal((replayedIntent.actionOutcome || {}).kind, 'ALREADY_ACTIVE');
  const rows = c.passLog();
  assert.equal(rows.length, 1);
  assert.equal(String(rows[0].Status), 'OUT');
});

test('an explicit return still works immediately while generic intent is stabilized', () => {
  const c = classroom();
  const nonce = 'same-device-explicit-return';
  c.harness.newRequest();
  const first = c.harness.call('identifyWithPin', c.pin(PEOPLE.ada), nonce);
  const key = first.student.key;
  c.harness.newRequest();
  c.harness.call('requestBathroomPass', first.actionProof, key, first.pinToken);
  c.harness.newRequest();
  const returning = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), 'RETURN', key, nonce);
  assert.equal(returning.authorizedAction, 'RETURN');
  c.harness.newRequest();
  c.harness.call('returnPass', returning.actionProof, key, returning.pinToken);
  assert.equal(String(c.passLog()[0].Status), 'RETURNED');
});

test('replaying the same late-attendance decision is idempotent', () => {
  const c = classroom({ now: new Date('2026-09-10T11:40:00Z') });
  c.checkIn(PEOPLE.ada, 'Period 1');
  const id = String(c.checkIns()[0]['Check-in ID']);
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherReviewLateCheckIn', id, 'AWARD_POINT', TEACHER_CONTRACT);
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherReviewLateCheckIn', id, 'AWARD_POINT', TEACHER_CONTRACT);
  const row = c.checkIns()[0];
  assert.equal(String(row.Status), 'LATE_APPROVED');
  assert.equal((String(row.Note).match(/Late check-in point awarded by/g) || []).length, 1);
});
"""
if runtime_marker not in runtime:
    raise SystemExit("runtime report marker not found")
runtime = runtime.replace(runtime_marker, issue73_runtime + runtime_marker, 1)
runtime_path.write_text(runtime)
