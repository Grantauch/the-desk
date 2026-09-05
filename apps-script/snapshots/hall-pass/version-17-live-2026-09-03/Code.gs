/**
 * GrantDesk Classroom — hall pass + daily check-in.
 *
 * Design rules that the rest of this file follows:
 *  1. Student page loads must be cheap. Workbook repair happens on setup and
 *     when the schema version changes, never on every request.
 *  2. Every sheet read inside one execution is memoized. Every write clears the
 *     memo so a later read in the same execution sees fresh values.
 *  3. Anything that changes shared state runs inside a short script lock, and a
 *     busy lock produces a sentence a ninth grader can act on.
 *  4. Student screens receive only their own data.
 */

const GD_SCHEMA_VERSION = '2026-09-02-a';
const GD_MIN_COUNTABLE_PASS_SECONDS = 3;
const GD_ACTION_PROOF_SECONDS = 180;
const GD_STUDENT_LOCK_WAIT_MS = 5000;
const GD_BUSY_LOCK_MESSAGE = 'The classroom system is handling other students right now. Press the button once more.';
const GD_LOCK_CONTENTION_PROPERTY = 'LOCK_CONTENTION_SUMMARY';
const GD_ROLLOVER_PROPERTY = 'LAST_ROLLOVER';
const GD_CHECKIN_TAIL_ROWS = 600;

const GD_STUDENT_ACTIONS = {
  CHECKIN: 'CHECKIN',
  PASS_REQUEST: 'PASS_REQUEST',
  RETURN: 'RETURN',
};

const GD_SHEETS = {
  INSTRUCTIONS: 'Instructions',
  ROSTER: 'Roster',
  LOG: 'Pass Log',
  AUDIT: 'Pass Audit',
  CHECKINS: 'Daily Check-ins',
  QUEUE: 'Pass Queue',
  SETTINGS: 'Settings',
  PINS: 'PIN Cards',
  UNMATCHED: 'Unmatched Sign-ins',
  CALENDAR: 'School Calendar',
};

const GD_HEADERS = {
  ROSTER: ['Student Email', 'Student Name', 'Class / Period', 'PIN Hash', 'Active', 'Unlimited Passes'],
  LOG: [
    'Pass ID', 'Student Email', 'Student Name', 'Class / Period', 'Destination',
    'Out Time', 'Return Time', 'Minutes Out', 'Method', 'Status', 'Ended By', 'Note',
    'Countability', 'Countability Reason', 'Classified At',
    'Authorization Method', 'Authorized At', 'Request ID',
    'Voided At', 'Voided By', 'Void Reason',
  ],
  AUDIT: [
    'Pass ID', 'Student Email', 'Student Name', 'Class / Period', 'Destination',
    'Out Time', 'Return Time', 'Minutes Out', 'Method', 'Status', 'Ended By', 'Note',
    'Countability', 'Countability Reason', 'Classified At',
    'Authorization Method', 'Authorized At', 'Request ID',
    'Voided At', 'Voided By', 'Void Reason', 'Archived At',
  ],
  CHECKINS: ['Check-in ID', 'Date', 'Check-in Time', 'Student Email', 'Student Name', 'Class / Period', 'Method', 'Point', 'Status', 'Note'],
  QUEUE: [
    'Queue ID', 'Student Email', 'Student Name', 'Class / Period', 'Joined At',
    'Status', 'Resolved At', 'Resolution', 'Request ID',
    'Authorization Method', 'Authorized At', 'Identity Method',
  ],
  SETTINGS: ['Key', 'Value', 'What it controls'],
  PINS: ['Student Email', 'Student Name', 'Class / Period', 'PIN', 'Generated At', 'Email Status', 'Emailed At', 'Email Detail'],
  UNMATCHED: ['Signed-in Address', 'First Seen', 'Last Seen', 'Times Seen', 'Likely Match', 'Status', 'Note'],
  CALENDAR: ['Date', 'School Day', 'Label', 'Source', 'Source Revision'],
};

/**
 * Verified against the official Drive PDF "26|27 - Student Calendar"
 * (file 1Gd3ZENe41b1AWRLdbpQ2kdsZj0mEsgoz, revised 08/14/26).
 * Listed reduced/half days are deliberately true school days. The workbook
 * sheet remains editable for official amendments such as a later closure.
 */
const GD_OFFICIAL_CALENDAR_2026_27 = [
  ['2026-08-25', true, 'Students report — full day K-12'],
  ['2026-09-02', true, 'Reduced day'],
  ['2026-09-04', false, 'No school K-12'],
  ['2026-09-07', false, 'Labor Day — no school K-12'],
  ['2026-09-16', true, 'Reduced day'],
  ['2026-09-30', true, 'Reduced day'],
  ['2026-10-14', true, 'Reduced day K-12'],
  ['2026-10-30', true, 'End of first marking period — reduced day K-12'],
  ['2026-11-03', false, 'No school K-12'],
  ['2026-11-04', true, 'Reduced day'],
  ['2026-11-18', true, 'Reduced day'],
  ['2026-11-25', false, 'No school K-12'],
  ['2026-11-26', false, 'Thanksgiving recess'],
  ['2026-11-27', false, 'Thanksgiving recess'],
  ['2026-12-09', true, 'Reduced day'],
  ['2026-12-21', false, 'Holiday break'],
  ['2026-12-22', false, 'Holiday break'],
  ['2026-12-23', false, 'Holiday break'],
  ['2026-12-24', false, 'Holiday break'],
  ['2026-12-25', false, 'Holiday break'],
  ['2026-12-28', false, 'Holiday break'],
  ['2026-12-29', false, 'Holiday break'],
  ['2026-12-30', false, 'Holiday break'],
  ['2026-12-31', false, 'Holiday break'],
  ['2027-01-01', false, 'Holiday break'],
  ['2027-01-04', true, 'Classes resume'],
  ['2027-01-13', true, 'Reduced day'],
  ['2027-01-15', true, 'End of semester — half day K-12'],
  ['2027-01-18', false, 'No school K-12'],
  ['2027-01-27', true, 'Reduced day'],
  ['2027-02-15', false, 'No school K-12'],
  ['2027-02-17', true, 'Reduced day'],
  ['2027-03-03', true, 'Reduced day'],
  ['2027-03-17', true, 'Reduced day'],
  ['2027-03-19', true, 'End of third marking period — reduced day K-12'],
  ['2027-03-26', false, 'Spring break'],
  ['2027-03-29', false, 'Spring break'],
  ['2027-03-30', false, 'Spring break'],
  ['2027-03-31', false, 'Spring break'],
  ['2027-04-01', false, 'Spring break'],
  ['2027-04-02', false, 'Spring break'],
  ['2027-04-05', true, 'Classes resume'],
  ['2027-04-07', true, 'Reduced day'],
  ['2027-04-21', true, 'Reduced day'],
  ['2027-05-05', true, 'Reduced day'],
  ['2027-05-19', true, 'Reduced day'],
  ['2027-05-28', false, 'No school K-12'],
  ['2027-05-31', false, 'Memorial Day — no school K-12'],
  ['2027-06-08', true, 'Last day for students — half day K-12'],
];

const GD_DEFAULT_SETTINGS = [
  ['TEACHER_EMAILS', 'gauch@mtmorrisschools.org', 'Comma-separated staff allowed to open teacher mode'],
  ['SCHOOL_DOMAIN', 'mtmorrisschools.org', 'Only signed-in accounts from this Google Workspace domain may load the app'],
  ['MAX_ACTIVE_PASSES', '1', 'How many students may be out at once'],
  ['STUDENT_PASS_LIMIT', '0', 'Passes allowed per student until the teacher starts a new marking period; 0 means unlimited'],
  ['STUDENT_PASS_RESET_AT', '', 'Timestamp of the teacher-controlled marking-period reset'],
  ['DAILY_PASS_LIMIT', '0', 'Passes allowed per student each school day; 0 means unlimited'],
  ['PASS_COOLDOWN_MINUTES', '5', 'Minutes a student must wait after returning before starting or joining another pass'],
  ['QUEUE_MAX_WAIT_MINUTES', '20', 'A waiting-line entry older than this is dropped so it never carries into the next hour'],
  ['LATE_AFTER_MINUTES', '10', 'When an active pass is highlighted for the teacher'],
  ['STALE_PASS_MINUTES', '20', 'When an active pass gets a stronger teacher follow-up warning'],
  ['RETENTION_DAYS', '180', 'Completed passes older than this move from the hot Pass Log into permanent Pass Audit'],
  ['DESTINATION', 'Restroom', 'Student-facing destination label'],
  ['APP_TITLE', 'Mr. Grant’s Hall Pass', 'Name shown at the top of the pass app'],
  ['CHECKIN_POINT_VALUE', '1', 'Extra-credit points recorded for one daily check-in'],
  ['STUDENT_EMAIL_DOMAIN', 'students.mtmorrisschools.org', 'Only roster addresses at this domain receive PIN emails'],
  ['PIN_EMAIL_SUBJECT', 'Your private GrantDesk PIN', 'Subject line for student PIN emails'],
  ['CHECKIN_URL', 'https://grant-desk.com/check-in/', 'Student link included in PIN emails'],
  ['SCHOOL_YEAR_START', '2026-08-25', 'First student day from the official 2026-27 district calendar'],
  ['SCHOOL_YEAR_END', '2027-06-08', 'Last student day from the official 2026-27 district calendar'],
  ['SCHOOL_CALENDAR_FILE_ID', '1Gd3ZENe41b1AWRLdbpQ2kdsZj0mEsgoz', 'Official student-calendar file in connected My Drive'],
  ['SCHOOL_CALENDAR_FALLBACK_URL', 'https://www.mtmorrisschools.org/', 'Official district website fallback when the needed Drive calendar is unavailable'],
];

/** Session token lifetime for PIN sign-in, in seconds. One class period plus slack. */
const GD_PIN_SESSION_SECONDS = 3600;

/** Per-execution read cache. Apps Script gives each request a fresh global scope. */
let GD_MEMO = {};
let GD_SPREADSHEET = null;

function gdClearMemo_() {
  GD_MEMO = {};
}

function gdMemo_(key, producer) {
  if (!Object.prototype.hasOwnProperty.call(GD_MEMO, key)) GD_MEMO[key] = producer();
  return GD_MEMO[key];
}

function gdForget_(key) {
  delete GD_MEMO[key];
}

/* ---------------------------------------------------------------- menu ---- */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('GrantDesk Pass')
    .addItem('1. Set up / repair workbook', 'setupProject')
    .addItem('2. Generate missing student PINs', 'generateMissingPins')
    .addItem('Preview PIN email distribution', 'previewPinEmailDistribution')
    .addItem('Email unsent PINs…', 'emailStudentPinsFromSheet')
    .addItem('Clear printed PIN cards', 'clearPinCards')
    .addSeparator()
    .addItem('Open today’s check-in log', 'openTodayCheckIns')
    .addItem('Archive old operational rows now', 'purgeOldPasses')
    .addToUi();
}

function setupProject() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('Open this script from the GrantDesk Hall Pass spreadsheet.');
  const authSettings = GD_DEFAULT_SETTINGS.reduce((settings, row) => {
    settings[row[0]] = row[1];
    return settings;
  }, {});
  const settingsSheet = active.getSheetByName(GD_SHEETS.SETTINGS);
  if (settingsSheet && settingsSheet.getLastRow() > 1) {
    settingsSheet.getRange(2, 1, settingsSheet.getLastRow() - 1, 2).getValues().forEach((row) => {
      const key = String(row[0] || '').trim();
      if (key) authSettings[key] = String(row[1] == null ? '' : row[1]).trim();
    });
  }
  assertTeacher_(getActiveEmail_(), authSettings);
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', active.getId());
  ensureSalt_();
  setupWorkbook_();
  installCleanupTrigger_();
  PropertiesService.getScriptProperties().setProperty('WORKBOOK_SCHEMA', GD_SCHEMA_VERSION);
  try {
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      'GrantDesk Pass is ready',
      'Paste students into the Roster tab, then use GrantDesk Pass → Generate missing student PINs.',
      ui.ButtonSet.OK
    );
  } catch (error) {
    // Editor/API executions do not have a spreadsheet UI. The migration is
    // already complete at this point, so leave a truthful success signal
    // instead of making the controlled release run appear to have failed.
    console.log(`GrantDesk Pass is ready · workbook schema ${GD_SCHEMA_VERSION}`);
  }
  return { ok: true, schemaVersion: GD_SCHEMA_VERSION };
}

/* ------------------------------------------------------------ web entry ---- */

function doGet(e) {
  ensureWorkbookReady_();
  const requestedMode = String((e && e.parameter && e.parameter.mode) || 'student').toLowerCase();
  const mode = ['student', 'kiosk', 'teacher', 'checkin'].includes(requestedMode) ? requestedMode : 'student';
  const template = HtmlService.createTemplateFromFile('Index');
  template.appMode = mode;
  return template.evaluate()
    .setTitle(mode === 'checkin' ? 'GrantDesk Daily Check-in' : 'GrantDesk Hall Pass')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getBootstrap(mode) {
  ensureWorkbookReady_();
  const settings = getSettings_();
  const activeEmail = getActiveEmail_();
  assertSchoolAccount_(activeEmail, settings);

  if (mode === 'teacher') {
    assertTeacher_(activeEmail, settings);
    purgeIfDue_();
    return getTeacherState_({ includePinStatus: true });
  }

  if (mode === 'kiosk') {
    return {
      ok: true,
      mode: 'kiosk',
      appTitle: settings.APP_TITLE,
      destination: settings.DESTINATION,
      lateAfterMinutes: numberSetting_(settings, 'LATE_AFTER_MINUTES', 10),
      serverNow: new Date().toISOString(),
    };
  }

  const purpose = mode === 'checkin' ? 'checkin' : 'pass';
  if (!activeEmail) return unrecognizedState_(settings, purpose, 'Enter your six-digit PIN to continue.');

  const students = getStudentsByEmail_(activeEmail);
  if (!students.length) {
    recordUnmatchedSignIn_(activeEmail, purpose);
    return unrecognizedState_(
      settings,
      purpose,
      'Your school account is signed in, but it is not on this class roster. Try your PIN or ask Mr. Grant.'
    );
  }
  if (students.length > 1) return createClassSelectionState_(students, 'google', purpose);
  return getStudentPinPromptState_(students[0], '', 'google', purpose);
}

function unrecognizedState_(settings, purpose, message) {
  return {
    ok: true,
    mode: purpose === 'checkin' ? 'checkin' : 'student',
    recognized: false,
    appTitle: purpose === 'checkin' ? 'Daily Check-in' : settings.APP_TITLE,
    destination: settings.DESTINATION,
    message,
    serverNow: new Date().toISOString(),
  };
}

/* -------------------------------------------------------- identification ---- */

function identifyWithPin(pin, attemptNonce) {
  return identifyPin_(pin, 'pass', attemptNonce);
}

function identifyCheckInWithPin(pin, attemptNonce) {
  return identifyPin_(pin, 'checkin', attemptNonce);
}

function identifyPin_(pin, purpose, attemptNonce) {
  ensureWorkbookReady_();
  const settings = getSettings_();
  const activeEmail = getActiveEmail_();
  assertSchoolAccount_(activeEmail, settings);
  const students = verifyStudentPin_(pin, activeEmail, attemptNonce);
  const email = students[0].email;
  const action = purpose === 'checkin' ? GD_STUDENT_ACTIONS.CHECKIN : inferPassAction_(email);

  if (students.length > 1) {
    const token = putPinSession_(Utilities.getUuid().replace(/-/g, ''), email, '', 'pin', true);
    const actionProof = putStudentActionProof_(email, '', action, 'pin');
    return buildClassSelectionState_(students, token, 'pin', purpose, actionProof, action);
  }
  const token = putPinSession_(Utilities.getUuid().replace(/-/g, ''), email, students[0].key, 'pin', true);
  const actionProof = putStudentActionProof_(email, students[0].key, action, 'pin');
  const next = purpose === 'checkin'
    ? getCheckInState_(students[0], token, 'pin')
    : getStudentState_(students[0], token, 'pin');
  return attachStudentAction_(next, actionProof, action);
}

/**
 * Fresh PIN entry for an already identified personal-device screen. The
 * returned proof is short-lived, server-tracked, action-bound and single-use;
 * the protected mutation consumes it while holding the shared script lock.
 */
function authorizeStudentAction(pin, requestedAction, studentKey, attemptNonce) {
  ensureWorkbookReady_();
  const settings = getSettings_();
  const activeEmail = getActiveEmail_();
  assertSchoolAccount_(activeEmail, settings);
  const students = verifyStudentPin_(pin, activeEmail, attemptNonce);
  const email = students[0].email;
  // AUTO_PASS is the client's "decide for me" sentinel, not a stored action, so
  // it must be resolved to a real GD_STUDENT_ACTIONS value BEFORE validation.
  // Normalizing first throws on every student pass request and return.
  const requested = String(requestedAction || '').trim().toUpperCase();
  const action = requested === 'AUTO_PASS'
    ? inferPassAction_(email)
    : normalizeStudentAction_(requestedAction);

  const selected = studentKey ? getStudentByKey_(studentKey) : null;
  if (selected && selected.email !== email) {
    throw new Error('That PIN belongs to a different student. Switch students before continuing.');
  }
  if (studentKey && !selected) throw new Error('That class selection is no longer active.');

  if (!selected && students.length > 1 && action !== GD_STUDENT_ACTIONS.RETURN) {
    const token = putPinSession_(Utilities.getUuid().replace(/-/g, ''), email, '', 'pin', true);
    const actionProof = putStudentActionProof_(email, '', action, 'pin');
    return buildClassSelectionState_(
      students,
      token,
      'pin',
      action === GD_STUDENT_ACTIONS.CHECKIN ? 'checkin' : 'pass',
      actionProof,
      action
    );
  }

  const student = selected || studentForReturn_(students, email) || students[0];
  const identityMethod = activeEmail && normalizeEmail_(activeEmail) === email ? 'google' : 'pin';
  const token = putPinSession_(Utilities.getUuid().replace(/-/g, ''), email, student.key, identityMethod, true);
  const actionProof = putStudentActionProof_(email, student.key, action, identityMethod);
  const next = action === GD_STUDENT_ACTIONS.CHECKIN
    ? getCheckInState_(student, token, identityMethod)
    : getStudentState_(student, token, identityMethod);
  return attachStudentAction_(next, actionProof, action);
}

function verifyStudentPin_(pin, activeEmail, attemptNonce) {
  assertPinAttemptAllowed_(activeEmail, attemptNonce);
  const cleaned = String(pin || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(cleaned)) throw new Error('Enter your six-digit PIN.');
  const students = getStudentsByPinHash_(hashPin_(cleaned));
  if (!students.length) {
    recordFailedPinAttempt_(activeEmail, attemptNonce);
    throw new Error('That PIN did not match an active student. Try again or ask Mr. Grant.');
  }
  const emails = [...new Set(students.map((student) => student.email))];
  if (emails.length !== 1) throw new Error('That PIN is not unique. Ask Mr. Grant to repair the PIN list.');
  clearPinAttempts_(activeEmail, attemptNonce);
  return students;
}

function normalizeStudentAction_(value) {
  const action = String(value || '').trim().toUpperCase();
  if (!Object.values(GD_STUDENT_ACTIONS).includes(action)) {
    throw new Error('Refresh this page before trying that student action.');
  }
  return action;
}

function inferPassAction_(email) {
  const normalized = normalizeEmail_(email);
  const todayKey = dateKey_(new Date());
  return readPassLog_().some((pass) => (
    pass.studentEmail === normalized && pass.status === 'OUT' && safeDateKey_(pass.outDate) === todayKey
  )) ? GD_STUDENT_ACTIONS.RETURN : GD_STUDENT_ACTIONS.PASS_REQUEST;
}

function studentForReturn_(students, email) {
  const active = readPassLog_()
    .filter((pass) => pass.studentEmail === normalizeEmail_(email) && pass.status === 'OUT')
    .sort((a, b) => (b.outDate ? b.outDate.getTime() : 0) - (a.outDate ? a.outDate.getTime() : 0))[0];
  if (!active) return null;
  return students.find((student) => student.key === active.studentKey) || null;
}

function attachStudentAction_(state, actionProof, action) {
  state.actionProof = actionProof;
  state.authorizedAction = action;
  return state;
}

function putPinSession_(token, email, key, method, pinVerified) {
  const issuedAt = Date.now();
  const body = encodeTokenPart_(JSON.stringify({
    v: 1,
    nonce: String(token || '').slice(0, 80),
    email: normalizeEmail_(email),
    key: key || '',
    method: method === 'google' ? 'google' : 'pin',
    pinVerified: Boolean(pinVerified),
    iat: issuedAt,
    exp: issuedAt + GD_PIN_SESSION_SECONDS * 1000,
  }));
  return `${body}.${signTokenPart_(body)}`;
}

function readPinSession_(pinToken) {
  const token = String(pinToken || '').trim();
  const parts = token.split('.');
  if (parts.length === 2 && parts[0] && parts[1]) {
    try {
      if (!secureEquals_(signTokenPart_(parts[0]), parts[1])) throw new Error('Bad signature');
      const session = JSON.parse(decodeTokenPart_(parts[0]));
      if (!session.exp || Number(session.exp) < Date.now()) throw new Error('Expired token');
      return {
        email: normalizeEmail_(session.email),
        key: String(session.key || ''),
        method: session.method === 'google' ? 'google' : 'pin',
        pinVerified: Boolean(session.pinVerified),
      };
    } catch (error) {
      throw new Error('That PIN session expired. Enter your PIN again.');
    }
  }

  const cached = CacheService.getScriptCache().get(`pin:${token}`);
  if (!cached) throw new Error('That PIN session expired. Enter your PIN again.');
  return JSON.parse(cached);
}

function encodeTokenPart_(value) {
  return Utilities.base64EncodeWebSafe(Utilities.newBlob(String(value), 'text/plain').getBytes()).replace(/=+$/g, '');
}

function decodeTokenPart_(value) {
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(String(value))).getDataAsString('UTF-8');
}

function signTokenPart_(value) {
  const bytes = Utilities.computeHmacSha256Signature(
    String(value),
    ensureSalt_(),
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '');
}

/** Compare signatures without returning as soon as the first byte differs. */
function secureEquals_(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function createClassSelectionState_(students, method, purpose) {
  const token = putPinSession_(Utilities.getUuid().replace(/-/g, ''), students[0].email, '', method, false);
  return buildClassSelectionState_(students, token, method, purpose);
}

function buildClassSelectionState_(students, token, method, purpose, actionProof, authorizedAction) {
  const settings = getSettings_();
  const state = {
    ok: true,
    mode: purpose === 'checkin' ? 'checkin' : 'student',
    recognized: true,
    requiresClassSelection: true,
    appTitle: purpose === 'checkin' ? 'Daily Check-in' : settings.APP_TITLE,
    purpose,
    method,
    pinToken: token,
    studentName: students[0].name,
    serverNow: new Date().toISOString(),
    classes: students
      .map((student) => ({ key: student.key, classPeriod: student.classPeriod }))
      .sort((a, b) => a.classPeriod.localeCompare(b.classPeriod)),
  };
  if (actionProof && authorizedAction) attachStudentAction_(state, actionProof, authorizedAction);
  return state;
}

function selectStudentClass(pinToken, studentKey, purpose, actionProof) {
  const session = readPinSession_(pinToken);
  const student = getStudentByKey_(studentKey);
  if (!student || student.email !== normalizeEmail_(session.email)) {
    throw new Error('Choose one of your own active classes.');
  }
  const method = session.method === 'google' ? 'google' : 'pin';
  let actionSession = null;
  if (actionProof) {
    actionSession = readStudentActionProof_(actionProof);
    if (actionSession.email !== student.email) throw new Error('That PIN proof belongs to a different student.');
    purpose = actionSession.action === GD_STUDENT_ACTIONS.CHECKIN ? 'checkin' : 'pass';
  }
  const nextToken = putPinSession_(pinToken, student.email, student.key, method, session.pinVerified);
  const next = actionSession
    ? (purpose === 'checkin'
      ? getCheckInState_(student, nextToken, method)
      : getStudentState_(student, nextToken, method))
    : getStudentPinPromptState_(student, nextToken, method, purpose);
  return actionSession ? attachStudentAction_(next, actionProof, actionSession.action) : next;
}

function putStudentActionProof_(email, key, action, identityMethod) {
  const issuedAt = Date.now();
  const nonce = Utilities.getUuid().replace(/-/g, '');
  const body = encodeTokenPart_(JSON.stringify({
    v: 2,
    nonce,
    email: normalizeEmail_(email),
    key: String(key || ''),
    action: normalizeStudentAction_(action),
    identityMethod: identityMethod === 'google' ? 'google' : 'pin',
    iat: issuedAt,
    exp: issuedAt + GD_ACTION_PROOF_SECONDS * 1000,
  }));
  PropertiesService.getScriptProperties().setProperty(`student-action:${nonce}`, String(issuedAt + GD_ACTION_PROOF_SECONDS * 1000));
  return `${body}.${signTokenPart_(body)}`;
}

function readStudentActionProof_(actionProof) {
  const token = String(actionProof || '').trim();
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Enter your PIN again for that action.');
  }
  try {
    if (!secureEquals_(signTokenPart_(parts[0]), parts[1])) throw new Error('Bad signature');
    const proof = JSON.parse(decodeTokenPart_(parts[0]));
    if (Number(proof.v) !== 2 || !proof.nonce) throw new Error('Legacy proof');
    if (!proof.exp || Number(proof.exp) < Date.now()) throw new Error('Expired proof');
    return {
      nonce: String(proof.nonce),
      email: normalizeEmail_(proof.email),
      key: String(proof.key || ''),
      action: normalizeStudentAction_(proof.action),
      identityMethod: proof.identityMethod === 'google' ? 'google' : 'pin',
      issuedAt: new Date(Number(proof.iat || 0)),
      expiresAt: new Date(Number(proof.exp || 0)),
    };
  } catch (error) {
    throw new Error('That one-time PIN proof expired. Enter your PIN again.');
  }
}

/** Must be called while the shared script lock is held. */
function consumeStudentActionProof_(actionProof, expectedAction, studentKey) {
  const proof = readStudentActionProof_(actionProof);
  const action = normalizeStudentAction_(expectedAction);
  if (proof.action !== action) throw new Error('That PIN was entered for a different action. Enter it again.');
  const propertyKey = `student-action:${proof.nonce}`;
  const properties = PropertiesService.getScriptProperties();
  const storedExpiry = Number(properties.getProperty(propertyKey) || 0);
  if (!storedExpiry || storedExpiry < Date.now()) {
    properties.deleteProperty(propertyKey);
    throw new Error('That one-time PIN proof was already used or expired. Enter your PIN again.');
  }
  properties.deleteProperty(propertyKey);

  const student = getStudentByKey_(studentKey || proof.key);
  if (!student || student.email !== proof.email) {
    throw new Error('That PIN proof does not match the selected student.');
  }
  if (proof.key && student.key !== proof.key) throw new Error('That PIN proof was issued for a different class.');
  return {
    student,
    method: proof.identityMethod,
    authorizationMethod: 'PIN',
    authorizedAt: proof.issuedAt,
    requestId: proof.nonce,
  };
}

/** Minimal recognized state before a fresh transaction PIN is supplied. */
function getStudentPinPromptState_(student, pinToken, method, purpose) {
  const settings = getSettings_();
  return {
    ok: true,
    mode: purpose === 'checkin' ? 'checkin' : 'student',
    recognized: true,
    pinRequired: true,
    appTitle: purpose === 'checkin' ? 'Daily Check-in' : settings.APP_TITLE,
    destination: settings.DESTINATION,
    student: { key: student.key, name: student.name, classPeriod: student.classPeriod },
    pinToken: pinToken || '',
    method,
    purpose,
    serverNow: new Date().toISOString(),
  };
}

function resolveStudent_(pinToken, requireFreshPinIdentity) {
  if (pinToken) {
    const session = readPinSession_(pinToken);
    if (requireFreshPinIdentity && !session.pinVerified) {
      throw new Error('Enter your PIN to unlock student details on this page.');
    }
    if (!session.key) throw new Error('Choose your class before continuing.');
    const student = getStudentByKey_(session.key);
    if (!student) throw new Error('That student is no longer active on the roster.');
    if (student.email !== normalizeEmail_(session.email)) throw new Error('That class selection is no longer valid.');
    return { student, method: session.method === 'google' ? 'google' : 'pin' };
  }
  if (requireFreshPinIdentity) throw new Error('Enter your PIN to continue.');
  const settings = getSettings_();
  const email = getActiveEmail_();
  assertSchoolAccount_(email, settings);
  if (!email) throw new Error('Enter your six-digit PIN to continue.');
  const students = getStudentsByEmail_(email);
  if (students.length !== 1) {
    throw new Error(students.length > 1
      ? 'Use the six-digit PIN for this class.'
      : 'Your school account is not on the active roster. Use your PIN or ask Mr. Grant.');
  }
  return { student: students[0], method: 'google' };
}

function identityTokenForStudent_(pinToken, student) {
  if (!pinToken) return '';
  try {
    const session = readPinSession_(pinToken);
    if (!session.pinVerified || !session.key) return '';
    if (normalizeEmail_(session.email) !== student.email || session.key !== student.key) return '';
    return pinToken;
  } catch (error) {
    return '';
  }
}

/* ------------------------------------------------------------- check-in ---- */

function refreshCheckInState(pinToken) {
  const resolved = resolveStudent_(pinToken, true);
  return getCheckInState_(resolved.student, pinToken || '', resolved.method);
}

function submitDailyCheckIn(actionProof, studentKey, identityToken) {
  let resolved = null;
  withLock_(() => {
    resolved = consumeStudentActionProof_(actionProof, GD_STUDENT_ACTIONS.CHECKIN, studentKey);
    recordCheckIn_(resolved.student, resolved.method, 'Fresh PIN verified for this check-in');
  }, GD_STUDENT_LOCK_WAIT_MS, 'daily check-in');
  const token = identityTokenForStudent_(identityToken, resolved.student);
  const state = getCheckInState_(resolved.student, token, resolved.method);
  state.actionOutcome = { id: resolved.requestId, kind: 'CHECKED_IN' };
  return state;
}

function getCheckInState_(student, pinToken, method) {
  const settings = getSettings_();
  const todayKey = dateKey_(new Date());
  const allCheckIns = readCheckIns_();
  const checkIn = allCheckIns.find((entry) => (
    entry.dateKey === todayKey &&
    entry.studentKey === student.key &&
    entry.status === 'CHECKED_IN'
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
    attendanceLocked: Boolean(absence && !checkIn),
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
  const existing = todayEntries.find((entry) => entry.status === 'CHECKED_IN');
  const absence = todayEntries.find((entry) => entry.status === 'ABSENT');
  if (existing) {
    if (absence) clearAbsentEntry_(absence, 'Cleared automatically because a check-in was already recorded');
    return existing;
  }
  if (absence && method !== 'teacher') {
    throw new Error('Your attendance needs a teacher update today. Ask Mr. Grant to mark you here.');
  }
  if (absence) clearAbsentEntry_(absence, `Cleared when ${method} check-in was recorded`);

  const settings = getSettings_();
  const row = [
    Utilities.getUuid(),
    todayKey,
    new Date(),
    student.email,
    student.name,
    student.classPeriod,
    method,
    numberSetting_(settings, 'CHECKIN_POINT_VALUE', 1),
    'CHECKED_IN',
    String(note || '').slice(0, 300),
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
  if (todayEntries.some((entry) => entry.status === 'CHECKED_IN')) {
    throw new Error(`${student.name} is already checked in today.`);
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

/* ----------------------------------------------------------- hall pass ---- */

function refreshStudentState(pinToken) {
  const resolved = resolveStudent_(pinToken, true);
  return getStudentState_(resolved.student, pinToken || '', resolved.method);
}

function joinPassQueue() {
  throw new Error('This page is out of date. Reload it, then enter your PIN once to request the bathroom.');
}

function leavePassQueue(pinToken) {
  const resolved = resolveStudent_(pinToken, true);
  withLock_(() => {
    closeWaitingQueueForEmail_(resolved.student.email, 'CANCELLED', 'Student left the line');
    settleWaitingQueue_();
  });
  return getStudentState_(resolved.student, pinToken || '', resolved.method);
}

function startPass() {
  throw new Error('This page is out of date. Reload it, then enter your PIN once to request the bathroom.');
}

function requestBathroomPass(actionProof, studentKey, identityToken) {
  let resolved = null;
  let outcome = null;
  withLock_(() => {
    resolved = consumeStudentActionProof_(actionProof, GD_STUDENT_ACTIONS.PASS_REQUEST, studentKey);
    expirePreviousDayPassesIfDue_();
    outcome = createBathroomRequest_(resolved);
  }, GD_STUDENT_LOCK_WAIT_MS, 'bathroom request');
  const token = identityTokenForStudent_(identityToken, resolved.student);
  return getStudentState_(resolved.student, token, resolved.method, {
    includeEvidence: outcome.kind === 'STARTED' || outcome.kind === 'BLOCKED',
    actionOutcome: { ...outcome, id: resolved.requestId },
  });
}

function returnPass(actionProof, studentKey, identityToken) {
  let resolved = null;
  let closeResult = null;
  withLock_(() => {
    resolved = consumeStudentActionProof_(actionProof, GD_STUDENT_ACTIONS.RETURN, studentKey);
    expirePreviousDayPassesIfDue_();
    closeResult = closePassForStudent_(
      resolved.student.email,
      resolved.student.email,
      'Fresh PIN verified for this return'
    );
    if (!closeResult) throw new Error('No current active pass was found for this student.');
    settleWaitingQueue_();
  }, GD_STUDENT_LOCK_WAIT_MS, 'pass return');
  const token = identityTokenForStudent_(identityToken, resolved.student);
  return getStudentState_(resolved.student, token, resolved.method, {
    includeEvidence: true,
    actionOutcome: {
      id: resolved.requestId,
      kind: closeResult.countable ? 'RETURNED_COUNTABLE' : 'RETURNED_NON_COUNTABLE',
      message: closeResult.countable
        ? 'Your return was recorded.'
        : `This trip lasted under ${GD_MIN_COUNTABLE_PASS_SECONDS.toFixed(1)} seconds, so it remains in the audit but does not use a pass.`,
    },
  });
}

function createBathroomRequest_(authorization) {
  const student = authorization.student;
  settleWaitingQueue_();
  let snapshot = getPassSnapshot_();
  reapExpiredQueue_(snapshot.expiredQueue);
  if (snapshot.expiredQueue.length) snapshot = getPassSnapshot_();
  if (snapshot.active.some((pass) => pass.studentEmail === student.email)) {
    return { kind: 'ALREADY_ACTIVE', message: 'This student already has an active pass.' };
  }
  const existingQueue = snapshot.queue.find((entry) => entry.studentEmail === student.email);
  if (existingQueue) {
    return { kind: 'QUEUED', queueId: existingQueue.queueId, message: 'The existing bathroom request is still in line.' };
  }

  const allowance = getStudentPassAllowance_(student.email, snapshot.settings, snapshot.log);
  if (allowance.blocked) {
    return { kind: 'BLOCKED', message: allowanceMessage_(allowance), blockedReason: allowance.blockedReason };
  }

  if (snapshot.openSlots > 0 && snapshot.queue.length === 0) {
    const passId = appendPassForStudent_(student, snapshot.settings, authorization);
    return { kind: 'STARTED', passId, message: 'Bathroom pass started.' };
  }

  const queueId = Utilities.getUuid();
  getSpreadsheet_().getSheetByName(GD_SHEETS.QUEUE).appendRow([
    queueId,
    student.email,
    student.name,
    student.classPeriod,
    new Date(),
    'WAITING',
    '',
    '',
    authorization.requestId,
    authorization.authorizationMethod,
    authorization.authorizedAt,
    authorization.method,
  ]);
  gdForget_('queue');
  return { kind: 'QUEUED', queueId, message: 'Bathroom request verified and placed in line automatically.' };
}

function appendPassForStudent_(student, settings, authorization) {
  const passId = Utilities.getUuid();
  getSpreadsheet_().getSheetByName(GD_SHEETS.LOG).appendRow([
    passId,
    student.email,
    student.name,
    student.classPeriod,
    settings.DESTINATION,
    new Date(),
    '',
    '',
    authorization.method,
    'OUT',
    '',
    '',
    'PROVISIONAL',
    'Active pass; final duration is not known yet',
    new Date(),
    authorization.authorizationMethod,
    authorization.authorizedAt,
    authorization.requestId,
    '',
    '',
    '',
  ]);
  gdForget_('passlog');
  return passId;
}

/** Promote already PIN-verified requests without asking for a second PIN. */
function settleWaitingQueue_() {
  const promoted = [];
  for (let guard = 0; guard < 200; guard += 1) {
    let snapshot = getPassSnapshot_();
    if (snapshot.expiredQueue.length) {
      reapExpiredQueue_(snapshot.expiredQueue);
      continue;
    }
    if (!snapshot.openSlots || !snapshot.queue.length) break;
    const entry = snapshot.queue[0];
    const student = getStudentByKey_(entry.studentKey);
    if (!student || student.email !== entry.studentEmail) {
      closeQueueRow_(entry.row, 'INELIGIBLE', 'Roster membership is no longer active');
      continue;
    }
    if (snapshot.active.some((pass) => pass.studentEmail === student.email)) {
      closeQueueRow_(entry.row, 'STARTED', 'An active pass already exists for this student');
      continue;
    }
    const allowance = getStudentPassAllowance_(student.email, snapshot.settings, snapshot.log);
    if (allowance.blocked) {
      closeQueueRow_(entry.row, 'INELIGIBLE', `No longer eligible: ${allowance.blockedReason || 'pass policy changed'}`);
      continue;
    }
    const passId = appendPassForStudent_(student, snapshot.settings, {
      method: entry.identityMethod || 'pin',
      authorizationMethod: entry.authorizationMethod || 'PIN',
      authorizedAt: entry.authorizedAt || entry.joinedAt,
      requestId: entry.requestId || entry.queueId,
    });
    closeQueueRow_(entry.row, 'STARTED', 'Verified bathroom request advanced automatically');
    promoted.push(passId);
  }
  return promoted;
}

function getStudentState_(student, pinToken, method, options) {
  const detail = options || {};
  const snapshot = getPassSnapshot_();
  const settings = snapshot.settings;
  const ownPass = snapshot.active.find((pass) => pass.studentEmail === student.email) || null;
  const queue = snapshot.queue;
  const queueIndex = queue.findIndex((entry) => entry.studentEmail === student.email);
  const allowance = getStudentPassAllowance_(student.email, settings, snapshot.log);
  const openSlots = snapshot.openSlots;
  const passAvailable = Boolean(ownPass) || (!allowance.blocked && (
    queueIndex >= 0 ? queueIndex < openSlots : queue.length === 0 && openSlots > 0
  ));
  const state = {
    ok: true,
    mode: 'student',
    recognized: true,
    appTitle: settings.APP_TITLE,
    destination: settings.DESTINATION,
    student: { key: student.key, name: student.name, classPeriod: student.classPeriod },
    pinToken: pinToken || '',
    method,
    ownPass: ownPass ? clientPass_(ownPass) : null,
    passAvailable,
    queuePosition: queueIndex >= 0 ? queueIndex + 1 : 0,
    queueLength: queue.length,
    queuedAt: queueIndex >= 0 ? isoOrEmpty_(queue[queueIndex].joinedAt) : '',
    canJoinQueue: !ownPass && queueIndex < 0 && !allowance.blocked,
    passAllowance: studentAllowanceView_(allowance, Boolean(detail.includeEvidence)),
    lateAfterMinutes: numberSetting_(settings, 'LATE_AFTER_MINUTES', 10),
    serverNow: new Date().toISOString(),
  };
  if (detail.actionOutcome) state.actionOutcome = detail.actionOutcome;
  return state;
}

function getPassSnapshot_() {
  const settings = getSettings_();
  const log = readPassLog_();
  const todayKey = dateKey_(new Date());
  // A missed return from a prior school day must never consume today's only
  // pass slot. Daily cleanup converts these rows to ROLLED_OVER for the audit
  // trail, while this date guard keeps the room usable even if the trigger is
  // delayed or fails before the first student arrives.
  const active = log.filter((pass) => (
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
}

/** Waiting line, oldest verified bathroom request first. */
function readWaitingQueue_(settings, openSlots) {
  const maxWaitMs = Math.max(1, numberSetting_(settings, 'QUEUE_MAX_WAIT_MINUTES', 20)) * 60000;
  const now = Date.now();
  const entries = readPassQueue_()
    .filter((entry) => entry.status === 'WAITING')
    .sort((a, b) => a.joinedAt - b.joinedAt || a.row - b.row);

  const live = [];
  const expired = [];
  entries.forEach((entry) => {
    if (now - entry.joinedAt.getTime() > maxWaitMs) {
      expired.push({ row: entry.row, resolution: 'Waited past the maximum line time' });
      return;
    }
    entry.isTurn = live.length < Math.max(0, Number(openSlots || 0));
    live.push(entry);
  });
  return { live, expired };
}

function reapExpiredQueue_(expired) {
  if (!expired || !expired.length) return;
  expired.forEach((item) => closeQueueRow_(item.row, 'EXPIRED', item.resolution));
}

function closePassForStudent_(studentEmail, endedBy, note) {
  const email = normalizeEmail_(studentEmail);
  const todayKey = dateKey_(new Date());
  const pass = readPassLog_()
    .filter((item) => (
      item.status === 'OUT' && item.studentEmail === email && safeDateKey_(item.outDate) === todayKey
    ))
    .sort((a, b) => (b.outDate ? b.outDate.getTime() : 0) - (a.outDate ? a.outDate.getTime() : 0))[0];
  if (!pass) return null;
  return closePassRow_(pass.row, endedBy, note);
}

function closePassById_(passId, endedBy, note) {
  const pass = readPassLog_().find((item) => item.status === 'OUT' && item.passId === passId);
  if (!pass) throw new Error('That pass is no longer active.');
  return closePassRow_(pass.row, endedBy, note);
}

function closePassRow_(row, endedBy, note) {
  const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.LOG);
  const outTime = sheet.getRange(row, 6).getValue();
  const returned = new Date();
  const durationMs = outTime instanceof Date && !isNaN(outTime)
    ? Math.max(0, returned.getTime() - outTime.getTime())
    : null;
  const minutes = durationMs == null ? '' : Math.round((durationMs / 60000) * 10) / 10;
  const classification = classifyPassDuration_(durationMs);
  sheet.getRange(row, 7, 1, 2).setValues([[returned, minutes]]);
  sheet.getRange(row, 10, 1, 3).setValues([['RETURNED', endedBy, String(note || '').slice(0, 300)]]);
  sheet.getRange(row, 13, 1, 3).setValues([[classification.countability, classification.reason, returned]]);
  gdForget_('passlog');
  return {
    row,
    countable: classification.countable,
    countability: classification.countability,
    durationSeconds: durationMs == null ? null : durationMs / 1000,
  };
}

function classifyPassDuration_(durationMs) {
  if (durationMs == null || !Number.isFinite(Number(durationMs))) {
    return {
      countable: false,
      countability: 'NON_COUNTABLE',
      reason: 'Could not verify a valid sign-out timestamp',
    };
  }
  const countable = Number(durationMs) >= GD_MIN_COUNTABLE_PASS_SECONDS * 1000;
  return {
    countable,
    countability: countable ? 'COUNTABLE' : 'NON_COUNTABLE',
    reason: countable
      ? `Completed at or above the ${GD_MIN_COUNTABLE_PASS_SECONDS.toFixed(1)}-second minimum`
      : `Completed under the ${GD_MIN_COUNTABLE_PASS_SECONDS.toFixed(1)}-second minimum`,
  };
}

function closeWaitingQueueForEmail_(studentEmail, status, resolution) {
  readPassQueue_()
    .filter((entry) => entry.status === 'WAITING' && entry.studentEmail === normalizeEmail_(studentEmail))
    .forEach((entry) => closeQueueRow_(entry.row, status, resolution));
}

function closeQueueRow_(row, status, resolution) {
  const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.QUEUE);
  const queueId = String(sheet.getRange(row, 1).getValue() || '');
  sheet.getRange(row, 6, 1, 3).setValues([[
    status,
    new Date(),
    String(resolution || '').slice(0, 300),
  ]]);
  clearQueueTurn_(queueId);
  gdForget_('queue');
}

function queueTurnKey_(queueId) {
  return `qturn:${String(queueId || '').slice(0, 80)}`;
}

function getQueueTurnStarted_(queueId) {
  if (!queueId) return 0;
  const value = Number(PropertiesService.getScriptProperties().getProperty(queueTurnKey_(queueId)) || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function setQueueTurnStarted_(queueId, timestamp) {
  if (!queueId) return;
  PropertiesService.getScriptProperties().setProperty(queueTurnKey_(queueId), String(timestamp));
}

function clearQueueTurn_(queueId) {
  if (!queueId) return;
  PropertiesService.getScriptProperties().deleteProperty(queueTurnKey_(queueId));
}

/* ------------------------------------------------------- pass allowance ---- */

function getStudentPassPolicy_(settings) {
  return {
    limit: Math.max(0, Math.round(numberSetting_(settings, 'STUDENT_PASS_LIMIT', 0))),
    dailyLimit: Math.max(0, Math.round(numberSetting_(settings, 'DAILY_PASS_LIMIT', 0))),
    cooldownMinutes: Math.max(0, Math.round(numberSetting_(settings, 'PASS_COOLDOWN_MINUTES', 5))),
    resetAt: parseSettingDate_(settings.STUDENT_PASS_RESET_AT).toISOString(),
  };
}

function getStudentPassAllowance_(studentEmail, settings, log, nowValue) {
  const email = normalizeEmail_(studentEmail);
  const policy = getStudentPassPolicy_(settings);
  const now = toDateOrNull_(nowValue) || new Date();
  const todayKey = dateKey_(now);
  const resetAt = new Date(policy.resetAt);
  const unlimited = getUnlimitedPassEmails_().has(email);
  const studentPasses = log.filter((pass) => pass.studentEmail === email);
  const passes = studentPasses.filter((pass) => passValidity_(pass).countable);
  const periodPasses = passes.filter((pass) => pass.outDate.getTime() > resetAt.getTime());
  const todayPasses = passes.filter((pass) => safeDateKey_(pass.outDate) === todayKey);
  const used = periodPasses.length;
  const todayUsed = todayPasses.length;
  const lastReturned = passes
    .filter((pass) => pass.status === 'RETURNED' && pass.returnDate && !isNaN(pass.returnDate))
    .sort((a, b) => b.returnDate - a.returnDate)[0] || null;
  const nextAllowedAt = lastReturned && policy.cooldownMinutes
    ? new Date(lastReturned.returnDate.getTime() + policy.cooldownMinutes * 60000)
    : null;
  const cooldownRemainingSeconds = nextAllowedAt
    ? Math.max(0, Math.ceil((nextAllowedAt.getTime() - now.getTime()) / 1000))
    : 0;
  const capped = Boolean(policy.limit) && !unlimited;
  const dailyCapped = Boolean(policy.dailyLimit) && !unlimited;
  const cooldownEnabled = Boolean(policy.cooldownMinutes) && !unlimited;
  const limitReached = capped && used >= policy.limit;
  const dailyLimitReached = dailyCapped && todayUsed >= policy.dailyLimit;
  const cooldownActive = cooldownEnabled && cooldownRemainingSeconds > 0;
  const blockedReason = limitReached
    ? 'MARKING_PERIOD_LIMIT'
    : dailyLimitReached
      ? 'DAILY_LIMIT'
      : cooldownActive
        ? 'COOLDOWN'
        : '';
  return {
    limit: policy.limit,
    dailyLimit: policy.dailyLimit,
    cooldownMinutes: policy.cooldownMinutes,
    resetAt: policy.resetAt,
    unlimited,
    used,
    todayUsed,
    remaining: capped ? Math.max(0, policy.limit - used) : null,
    dailyRemaining: dailyCapped ? Math.max(0, policy.dailyLimit - todayUsed) : null,
    limitReached,
    dailyLimitReached,
    cooldownActive,
    cooldownRemainingSeconds,
    nextAllowedAt: nextAllowedAt ? nextAllowedAt.toISOString() : '',
    blockedReason,
    blocked: limitReached || dailyLimitReached || cooldownActive,
    periodPasses,
    todayPasses,
    blockedPasses: limitReached ? periodPasses : dailyLimitReached ? todayPasses : [],
  };
}

/**
 * One validity decision feeds every policy window. Blank classification on a
 * completed legacy row remains countable, preserving historical decisions when
 * the 3.0-second rule is introduced. Unknown/corrupt states fail safe.
 */
function passValidity_(pass) {
  if (!pass || !pass.outDate || isNaN(pass.outDate)) {
    return { countable: false, code: 'INVALID_OUT_TIME', reason: 'Missing or invalid sign-out time' };
  }
  if (pass.voidedAt && !isNaN(pass.voidedAt)) {
    return { countable: false, code: 'TEACHER_VOID', reason: pass.voidReason || 'Teacher correction' };
  }
  const status = String(pass.status || '').trim().toUpperCase();
  const classification = String(pass.countability || '').trim().toUpperCase();
  if (classification === 'NON_COUNTABLE') {
    return { countable: false, code: 'NON_COUNTABLE', reason: pass.countabilityReason || 'Non-countable completed pass' };
  }
  if (status === 'OUT') {
    if (classification && classification !== 'PROVISIONAL') {
      return { countable: false, code: 'UNKNOWN_ACTIVE_CLASSIFICATION', reason: 'Active pass classification requires teacher review' };
    }
    return { countable: true, code: 'PROVISIONAL', reason: 'Active pass counts provisionally' };
  }
  if (!['RETURNED', 'ROLLED_OVER'].includes(status)) {
    return { countable: false, code: 'UNKNOWN_STATUS', reason: 'Unknown pass status requires teacher review' };
  }
  if (classification && classification !== 'COUNTABLE') {
    return { countable: false, code: 'UNKNOWN_CLASSIFICATION', reason: 'Unknown countability requires teacher review' };
  }
  if (!pass.returnDate || isNaN(pass.returnDate)) {
    return { countable: false, code: 'INVALID_RETURN_TIME', reason: 'Missing or invalid return time' };
  }
  return {
    countable: true,
    code: classification === 'COUNTABLE' ? 'COUNTABLE' : 'LEGACY_COUNTABLE',
    reason: pass.countabilityReason || 'Completed before explicit countability fields were introduced',
  };
}

function studentPassEvidence_(passes) {
  return (passes || [])
    .slice()
    .sort((a, b) => a.outDate - b.outDate)
    .map((pass) => ({
      passId: pass.passId,
      outTime: isoOrEmpty_(pass.outDate),
      returnTime: isoOrEmpty_(pass.returnDate),
      schoolTime: formatSchoolDateTime_(pass.outDate),
      status: pass.status === 'OUT' ? 'OUT' : 'COMPLETED',
      durationSeconds: pass.outDate && pass.returnDate
        ? Math.max(0, Math.round((pass.returnDate.getTime() - pass.outDate.getTime()) / 100) / 10)
        : null,
    }));
}

function formatSchoolDateTime_(value) {
  const date = toDateOrNull_(value);
  if (!date) return '';
  return Utilities.formatDate(date, Session.getScriptTimeZone() || 'America/Detroit', 'MMM d, yyyy h:mm a');
}

/**
 * What a student may see about their own allowance. The unlimited exemption is
 * a teacher setting: an exempt student's payload has to look exactly like a
 * student in a class with no limit set, so nothing in the response names the
 * exemption or lets the browser work it out.
 */
function studentAllowanceView_(allowance, includeEvidence) {
  const capped = Boolean(allowance.limit) && !allowance.unlimited;
  const dailyCapped = Boolean(allowance.dailyLimit) && !allowance.unlimited;
  const cooldownEnabled = Boolean(allowance.cooldownMinutes) && !allowance.unlimited;
  const view = {
    capped,
    limit: capped ? allowance.limit : 0,
    used: capped ? allowance.used : 0,
    remaining: capped ? allowance.remaining : null,
    limitReached: Boolean(allowance.limitReached),
    dailyCapped,
    dailyLimit: dailyCapped ? allowance.dailyLimit : 0,
    todayUsed: dailyCapped ? allowance.todayUsed : 0,
    dailyRemaining: dailyCapped ? allowance.dailyRemaining : null,
    dailyLimitReached: Boolean(allowance.dailyLimitReached),
    cooldownMinutes: cooldownEnabled ? allowance.cooldownMinutes : 0,
    cooldownActive: Boolean(allowance.cooldownActive),
    cooldownRemainingSeconds: cooldownEnabled ? allowance.cooldownRemainingSeconds : 0,
    nextAllowedAt: cooldownEnabled ? allowance.nextAllowedAt : '',
    blocked: Boolean(allowance.blocked),
    blockedReason: allowance.blockedReason || '',
  };
  if (includeEvidence && !allowance.unlimited) {
    view.periodEvidence = studentPassEvidence_(allowance.periodPasses);
    view.todayEvidence = studentPassEvidence_(allowance.todayPasses);
    view.blockedEvidence = studentPassEvidence_(allowance.blockedPasses);
  }
  return view;
}

function allowanceMessage_(allowance) {
  if (allowance.limitReached) {
    return `You have used all ${allowance.limit} of your passes for this marking period. Ask Mr. Grant if you need to leave the room.`;
  }
  if (allowance.dailyLimitReached) {
    return `You have used today’s ${allowance.dailyLimit}-pass limit. Ask Mr. Grant if you need to leave the room.`;
  }
  const minutes = Math.max(1, Math.ceil(Number(allowance.cooldownRemainingSeconds || 0) / 60));
  return `Wait ${minutes} more minute${minutes === 1 ? '' : 's'} after your last return before taking another pass. Ask Mr. Grant if you need to leave sooner.`;
}

function getStudentPassUsage_(roster, settings, log, verifiedEmails) {
  const verified = verifiedEmails || new Set();
  const studentsByEmail = new Map();
  roster.forEach((student) => {
    if (!studentsByEmail.has(student.email)) {
      studentsByEmail.set(student.email, { email: student.email, name: student.name, classes: [] });
    }
    studentsByEmail.get(student.email).classes.push(student.classPeriod);
  });
  return [...studentsByEmail.values()]
    .map((student) => {
      const allowance = getStudentPassAllowance_(student.email, settings, log);
      return {
        ...student,
        googleVerified: verified.has(student.email),
        limit: allowance.limit,
        dailyLimit: allowance.dailyLimit,
        cooldownMinutes: allowance.cooldownMinutes,
        resetAt: allowance.resetAt,
        unlimited: allowance.unlimited,
        used: allowance.used,
        todayUsed: allowance.todayUsed,
        remaining: allowance.remaining,
        dailyRemaining: allowance.dailyRemaining,
        limitReached: allowance.limitReached,
        dailyLimitReached: allowance.dailyLimitReached,
        cooldownActive: allowance.cooldownActive,
        cooldownRemainingSeconds: allowance.cooldownRemainingSeconds,
        nextAllowedAt: allowance.nextAllowedAt,
        blockedReason: allowance.blockedReason,
        blocked: allowance.blocked,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getUnlimitedPassEmails_() {
  return gdMemo_('unlimited', () => {
    const emails = new Set();
    getRoster_().forEach((student) => {
      if (student.unlimited) emails.add(student.email);
    });
    return emails;
  });
}

/* ----------------------------------------------- unmatched sign-ins ---- */

/**
 * The roster addresses were generated from a naming rule, not exported from
 * the district, so some of them are wrong: a hyphen dropped from a surname is
 * enough to lock a student out of both the Google path and their PIN email.
 * When a real school account reaches the app and the roster does not know it,
 * write the address down so the roster can be corrected from evidence.
 */
function recordUnmatchedSignIn_(email, note) {
  const address = normalizeEmail_(email);
  if (!address) return;
  const cache = CacheService.getScriptCache();
  const key = `unmatched:${address}`;
  if (cache.get(key)) return;
  try {
    withLock_(() => {
      if (cache.get(key)) return;
      const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.UNMATCHED);
      if (!sheet) return;
      const now = new Date();
      const existing = readUnmatched_().find((entry) => entry.email === address);
      if (existing) {
        sheet.getRange(existing.row, 3, 1, 2).setValues([[now, existing.timesSeen + 1]]);
        if (['CLEARED', 'APPLIED'].includes(existing.status)) {
          const priorNote = String(existing.note || '').trim();
          const reopenedNote = [priorNote, 'Reopened after another unmatched sign-in'].filter(Boolean).join(' · ').slice(0, 300);
          sheet.getRange(existing.row, 6, 1, 2).setValues([['NEW', reopenedNote]]);
        }
      } else {
        const suggestion = suggestRosterMatch_(address);
        sheet.appendRow([
          address, now, now, 1,
          suggestion ? `${suggestion.name} <${suggestion.email}>` : '',
          'NEW',
          String(note || ''),
        ]);
      }
      gdForget_('unmatched');
      cache.put(key, '1', 600);
    }, 10000);
  } catch (error) {
    // Never let bookkeeping stop a student from reaching the PIN screen.
  }
}

function readUnmatched_() {
  return gdMemo_('unmatched', () => {
    const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.UNMATCHED);
    if (!sheet) return [];
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    return sheet.getRange(2, 1, lastRow - 1, GD_HEADERS.UNMATCHED.length).getValues().map((row, index) => ({
      row: index + 2,
      email: normalizeEmail_(row[0]),
      firstSeen: toDateOrNull_(row[1]),
      lastSeen: toDateOrNull_(row[2]),
      timesSeen: Number(row[3] || 0),
      likelyMatch: String(row[4] || ''),
      status: String(row[5] || '').trim().toUpperCase(),
      note: String(row[6] || ''),
    })).filter((entry) => entry.email);
  });
}

/** Punctuation is exactly what the generated addresses got wrong, so ignore it. */
function normalizeLocalPart_(email) {
  return normalizeEmail_(email).split('@')[0].replace(/[^a-z0-9]/g, '');
}

function suggestRosterMatch_(email) {
  const target = normalizeLocalPart_(email);
  if (!target) return null;
  const byEmail = new Map();
  getRoster_().forEach((student) => {
    if (!byEmail.has(student.email)) byEmail.set(student.email, student);
  });
  const matches = [...byEmail.values()].filter((student) => normalizeLocalPart_(student.email) === target);
  if (matches.length !== 1) return null;
  return { key: matches[0].key, name: matches[0].name, email: matches[0].email };
}

/**
 * Correcting a roster address by hand silently breaks the student: their PIN
 * card, check-in history and pass history are all keyed to the old address.
 * This moves every one of them together.
 */
function teacherApplyUnmatchedEmail(rosterEmail, realEmail) {
  const settings = getSettings_();
  assertTeacher_(getActiveEmail_(), settings);
  const oldEmail = normalizeEmail_(rosterEmail);
  const newEmail = normalizeEmail_(realEmail);
  if (!oldEmail || !newEmail || oldEmail === newEmail) throw new Error('Choose a different address.');
  assertPlainSheetText_(realEmail, 'Student email');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    throw new Error('Enter the student’s full school email address.');
  }
  const studentDomain = String(settings.STUDENT_EMAIL_DOMAIN || '').toLowerCase();
  if (studentDomain && newEmail.split('@').pop() !== studentDomain) {
    throw new Error(`That address is not on ${studentDomain}.`);
  }

  let result = null;
  withLock_(() => {
    assertPinEmailBatchIdle_();
    const roster = readRosterRows_();
    const rows = roster.filter((student) => student.email === oldEmail);
    if (!rows.length) throw new Error('That student is no longer on the roster.');
    if (roster.some((student) => student.email === newEmail)) {
      throw new Error('That address already belongs to another student on the roster.');
    }
    result = moveStudentIdentity_(oldEmail, newEmail, {
      deliveryDetail: 'Address corrected; the preserved PIN has not yet been delivered to this address',
      unmatchedNote: `Replaced ${oldEmail}`,
    });
  });
  const state = getTeacherState_({ includePinStatus: true });
  state.noticeMessage = `${newEmail} now belongs to that student. ${result.rosterRows} roster row${result.rosterRows === 1 ? '' : 's'} updated; the preserved PIN and ${result.historyRows} history row${result.historyRows === 1 ? '' : 's'} moved with it. PIN delivery to the corrected address is not yet marked sent.`;
  return state;
}

/**
 * Move every retained reference to one student identity without altering any
 * credential, timestamp, status, class membership, or pass fact. PIN delivery
 * is deliberately reset because a prior SENT marker only proves delivery to
 * the old address.
 */
function moveStudentIdentity_(oldEmailValue, newEmailValue, options) {
  const oldEmail = normalizeEmail_(oldEmailValue);
  const newEmail = normalizeEmail_(newEmailValue);
  const detail = String((options && options.deliveryDetail) || 'Address reconciled; PIN delivery to this address is not confirmed').slice(0, 250);
  const spreadsheet = getSpreadsheet_();
  const result = {
    rosterRows: 0,
    pinRows: 0,
    checkInRows: 0,
    passRows: 0,
    queueRows: 0,
    auditRows: 0,
    historyRows: 0,
  };

  result.rosterRows = replaceEmailColumn_(GD_SHEETS.ROSTER, 1, oldEmail, newEmail);
  const pinSheet = spreadsheet.getSheetByName(GD_SHEETS.PINS);
  if (pinSheet && pinSheet.getLastRow() > 1) {
    const emails = pinSheet.getRange(2, 1, pinSheet.getLastRow() - 1, 1).getValues();
    emails.forEach((row, index) => {
      if (normalizeEmail_(row[0]) !== oldEmail) return;
      const sheetRow = index + 2;
      pinSheet.getRange(sheetRow, 1).setValue(newEmail);
      pinSheet.getRange(sheetRow, 6, 1, 3).setValues([['NEEDS_RESEND', '', detail]]);
      result.pinRows += 1;
    });
  }
  result.checkInRows = replaceEmailColumn_(GD_SHEETS.CHECKINS, 4, oldEmail, newEmail);
  result.passRows = replaceEmailColumn_(GD_SHEETS.LOG, 2, oldEmail, newEmail);
  result.queueRows = replaceEmailColumn_(GD_SHEETS.QUEUE, 2, oldEmail, newEmail);
  result.auditRows = replaceEmailColumn_(GD_SHEETS.AUDIT, 2, oldEmail, newEmail);
  result.historyRows = result.checkInRows + result.passRows + result.queueRows + result.auditRows;

  const logged = readUnmatched_().find((entry) => entry.email === newEmail);
  if (logged) {
    spreadsheet.getSheetByName(GD_SHEETS.UNMATCHED).getRange(logged.row, 6, 1, 2)
      .setValues([['APPLIED', String((options && options.unmatchedNote) || 'Matched to retained student identity').slice(0, 300)]]);
  }
  gdClearMemo_();
  return result;
}

function replaceEmailColumn_(sheetName, column, oldEmail, newEmail) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return 0;
  let changed = 0;
  sheet.getRange(2, column, sheet.getLastRow() - 1, 1).getValues().forEach((row, index) => {
    if (normalizeEmail_(row[0]) !== oldEmail) return;
    sheet.getRange(index + 2, column).setValue(newEmail);
    changed += 1;
  });
  return changed;
}

/**
 * Discover only high-confidence stale-address repairs. A printable PIN is the
 * credential evidence: its salted hash must identify exactly one active roster
 * email, preferring the same class membership. Names are never used as keys.
 */
function discoverIdentityReconciliations_() {
  const activeRoster = readRosterRows_().filter((student) => student.active && student.pinHash);
  const activeEmails = new Set(activeRoster.map((student) => student.email));
  const cardsByOldEmail = new Map();
  readPinCards_().forEach((card) => {
    if (!/^\d{6}$/.test(card.pin) || activeEmails.has(card.studentEmail)) return;
    if (!cardsByOldEmail.has(card.studentEmail)) cardsByOldEmail.set(card.studentEmail, []);
    cardsByOldEmail.get(card.studentEmail).push(card);
  });

  const repairs = [];
  cardsByOldEmail.forEach((cards, oldEmail) => {
    const candidateEmails = new Set();
    let ambiguous = false;
    cards.forEach((card) => {
      const pinHash = hashPin_(card.pin);
      const hashMatches = activeRoster.filter((student) => student.pinHash === pinHash);
      const sameClass = hashMatches.filter((student) => (
        student.classPeriod.toLowerCase() === card.classPeriod.toLowerCase()
      ));
      const matches = sameClass.length ? sameClass : hashMatches;
      const emails = [...new Set(matches.map((student) => student.email))];
      if (emails.length > 1) ambiguous = true;
      if (emails.length === 1) candidateEmails.add(emails[0]);
    });
    if (!ambiguous && candidateEmails.size === 1) {
      const newEmail = [...candidateEmails][0];
      if (newEmail && newEmail !== oldEmail) repairs.push({ oldEmail, newEmail, pinRows: cards.length });
    }
  });
  return repairs.sort((a, b) => a.oldEmail.localeCompare(b.oldEmail));
}

/** Idempotent setup-time repair for the known September identity drift. */
function reconcileKnownIdentityDrift_() {
  const repairs = discoverIdentityReconciliations_();
  if (repairs.length) assertPinEmailBatchIdle_();
  const summary = {
    schema: GD_SCHEMA_VERSION,
    reconciledStudents: 0,
    rosterRows: 0,
    pinRows: 0,
    checkInRows: 0,
    passRows: 0,
    queueRows: 0,
    auditRows: 0,
    completedAt: new Date().toISOString(),
  };
  repairs.forEach((repair) => {
    const moved = moveStudentIdentity_(repair.oldEmail, repair.newEmail, {
      deliveryDetail: 'Address reconciled from credential evidence; preserved PIN delivery to this address is not confirmed',
      unmatchedNote: 'Applied by the credential-backed September identity reconciliation',
    });
    summary.reconciledStudents += 1;
    ['rosterRows', 'pinRows', 'checkInRows', 'passRows', 'queueRows', 'auditRows']
      .forEach((key) => { summary[key] += moved[key]; });
  });
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('IDENTITY_RECONCILIATION_LAST_CHECK', JSON.stringify(summary));
  let previous = null;
  try {
    previous = JSON.parse(properties.getProperty('IDENTITY_RECONCILIATION_LAST') || 'null');
  } catch (error) {
    previous = null;
  }
  const previousRepairIsMeaningful = previous
    && previous.schema === GD_SCHEMA_VERSION
    && Number(previous.reconciledStudents || 0) > 0;
  if (summary.reconciledStudents > 0 || !previousRepairIsMeaningful) {
    properties.setProperty('IDENTITY_RECONCILIATION_LAST', JSON.stringify(summary));
  }
  return summary;
}

function teacherDismissUnmatched(email) {
  assertTeacher_(getActiveEmail_(), getSettings_());
  const address = normalizeEmail_(email);
  withLock_(() => {
    const entry = readUnmatched_().find((item) => item.email === address);
    if (!entry) return;
    getSpreadsheet_().getSheetByName(GD_SHEETS.UNMATCHED).getRange(entry.row, 6).setValue('IGNORED');
    gdForget_('unmatched');
  });
  return getTeacherState_({ includePinStatus: false });
}

function teacherClearUnmatchedSignIns(confirmText) {
  assertTeacher_(getActiveEmail_(), getSettings_());
  if (String(confirmText || '') !== 'CLEAR SIGN-IN PROBLEMS') {
    throw new Error('No sign-in problems were cleared. Confirm the action from the teacher dashboard.');
  }
  let cleared = 0;
  withLock_(() => {
    const entries = readUnmatched_().filter((entry) => !['APPLIED', 'IGNORED', 'CLEARED'].includes(entry.status));
    if (!entries.length) return;
    const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.UNMATCHED);
    entries.forEach((entry) => {
      sheet.getRange(entry.row, 6, 1, 2).setValues([['CLEARED', 'Cleared from teacher dashboard']]);
      CacheService.getScriptCache().remove(`unmatched:${entry.email}`);
      cleared += 1;
    });
    gdForget_('unmatched');
  });
  const state = getTeacherState_({ includePinStatus: false });
  state.noticeMessage = cleared
    ? `Cleared ${cleared} sign-in problem${cleared === 1 ? '' : 's'} from the dashboard.`
    : 'No sign-in problems needed clearing.';
  return state;
}

/* --------------------------------------------------------------- teacher ---- */

function refreshTeacherState() {
  assertTeacher_(getActiveEmail_(), getSettings_());
  return getTeacherState_({ includePinStatus: false });
}

function teacherSetPassLimits(maxActivePasses, studentPassLimit) {
  const settings = getSettings_();
  return teacherSetPassRules(
    maxActivePasses,
    studentPassLimit,
    numberSetting_(settings, 'DAILY_PASS_LIMIT', 0),
    numberSetting_(settings, 'PASS_COOLDOWN_MINUTES', 5),
    numberSetting_(settings, 'LATE_AFTER_MINUTES', 10),
    numberSetting_(settings, 'STALE_PASS_MINUTES', 20)
  );
}

function teacherSetPassRules(maxActivePasses, studentPassLimit, dailyPassLimit, cooldownMinutes, lateMinutes, staleMinutes) {
  assertTeacher_(getActiveEmail_(), getSettings_());
  const maxActive = Number(maxActivePasses);
  const perStudentLimit = Number(studentPassLimit);
  const perDayLimit = Number(dailyPassLimit);
  const cooldown = Number(cooldownMinutes);
  const late = Number(lateMinutes);
  const stale = Number(staleMinutes);
  if (!Number.isInteger(maxActive) || maxActive < 1 || maxActive > 10) {
    throw new Error('Concurrent passes must be a whole number from 1 through 10.');
  }
  if (!Number.isInteger(perStudentLimit) || perStudentLimit < 0 || perStudentLimit > 500) {
    throw new Error('The per-student marking-period limit must be a whole number from 0 through 500. Use 0 for unlimited.');
  }
  if (!Number.isInteger(perDayLimit) || perDayLimit < 0 || perDayLimit > 25) {
    throw new Error('The daily pass limit must be a whole number from 0 through 25. Use 0 for unlimited.');
  }
  if (!Number.isInteger(cooldown) || cooldown < 0 || cooldown > 180) {
    throw new Error('The return cooldown must be a whole number from 0 through 180 minutes.');
  }
  if (!Number.isInteger(late) || late < 1 || late > 120) {
    throw new Error('The late-pass warning must be a whole number from 1 through 120 minutes.');
  }
  if (!Number.isInteger(stale) || stale < late || stale > 240) {
    throw new Error('The forgotten-pass warning must be a whole number at least as large as the late warning and no more than 240 minutes.');
  }
  withLock_(() => {
    setSettingValue_('MAX_ACTIVE_PASSES', String(maxActive));
    setSettingValue_('STUDENT_PASS_LIMIT', String(perStudentLimit));
    setSettingValue_('DAILY_PASS_LIMIT', String(perDayLimit));
    setSettingValue_('PASS_COOLDOWN_MINUTES', String(cooldown));
    setSettingValue_('LATE_AFTER_MINUTES', String(late));
    setSettingValue_('STALE_PASS_MINUTES', String(stale));
    settleWaitingQueue_();
  });
  return getTeacherState_({ includePinStatus: false });
}

function teacherResetStudentPassCounters(confirmText) {
  assertTeacher_(getActiveEmail_(), getSettings_());
  if (String(confirmText || '') !== 'RESET ALL STUDENTS') {
    throw new Error('No counters were reset. Confirm the marking-period reset from the teacher dashboard.');
  }
  withLock_(() => setSettingValue_('STUDENT_PASS_RESET_AT', new Date().toISOString()));
  return getTeacherState_({ includePinStatus: false });
}

function teacherSetStudentUnlimited(studentEmail, unlimited) {
  assertTeacher_(getActiveEmail_(), getSettings_());
  const email = normalizeEmail_(studentEmail);
  if (!email) throw new Error('Choose a student first.');
  const flag = unlimited === true || String(unlimited).toLowerCase() === 'true';
  withLock_(() => {
    const rows = getRoster_().filter((student) => student.email === email);
    if (!rows.length) throw new Error('That student is not active on the roster.');
    const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.ROSTER);
    rows.forEach((student) => sheet.getRange(student.row, 6).setValue(flag));
    gdForget_('roster');
    gdForget_('unlimited');
  });
  return getTeacherState_({ includePinStatus: false });
}

function teacherAddStudentClass(studentName, studentEmail, classPeriod) {
  const settings = getSettings_();
  assertTeacher_(getActiveEmail_(), settings);
  const input = normalizeRosterInput_(studentName, studentEmail, classPeriod, settings);
  let result = null;

  withLock_(() => {
    assertPinEmailBatchIdle_();
    const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.ROSTER);
    const allRows = readRosterRows_();
    const sameStudentRows = allRows.filter((student) => student.email === input.email);
    const sameMembership = sameStudentRows.find((student) => student.key === input.key) || null;
    if (sameMembership && sameMembership.active) {
      throw new Error(`${input.name} is already active in ${input.classPeriod}.`);
    }

    const unlimited = sameStudentRows.some((student) => student.unlimited);
    const existingPinHash = (sameStudentRows.find((student) => student.pinHash) || {}).pinHash || '';

    // One school email represents one student. Keep their display name aligned
    // across every class membership when the teacher corrects or adds it here.
    sameStudentRows.forEach((student) => {
      if (student.name !== input.name) sheet.getRange(student.row, 2).setValue(input.name);
    });

    let rosterRow;
    let action;
    if (sameMembership) {
      rosterRow = sameMembership.row;
      action = 'reactivated';
      sheet.getRange(rosterRow, 1, 1, GD_HEADERS.ROSTER.length).setValues([[
        input.email,
        input.name,
        input.classPeriod,
        sameMembership.pinHash || existingPinHash,
        true,
        unlimited,
      ]]);
    } else {
      action = 'added';
      sheet.appendRow([
        input.email,
        input.name,
        input.classPeriod,
        existingPinHash,
        true,
        unlimited,
      ]);
      rosterRow = sheet.getLastRow();
    }
    sheet.getRange(rosterRow, 6).insertCheckboxes().setValue(unlimited);
    gdForget_('roster');
    gdForget_('unlimited');

    const pinRepair = ensureOnePinPerStudent_({ createMissing: true });
    result = {
      action,
      name: input.name,
      classPeriod: input.classPeriod,
      createdPin: pinRepair.createdPins > 0,
    };
  });

  const state = getTeacherState_({ includePinStatus: true });
  state.rosterResult = result;
  return state;
}

function teacherRemoveStudentClass(studentKey) {
  assertTeacher_(getActiveEmail_(), getSettings_());
  const key = String(studentKey || '');
  if (!key) throw new Error('Choose a class membership to remove.');
  let result = null;

  withLock_(() => {
    assertPinEmailBatchIdle_();
    const student = getRoster_().find((entry) => entry.key === key) || null;
    if (!student) throw new Error('That student is no longer active in this class.');

    const todayKey = dateKey_(new Date());
    const activePass = readPassLog_().find((pass) => (
      pass.status === 'OUT' && pass.studentKey === key && safeDateKey_(pass.outDate) === todayKey
    ));
    if (activePass) {
      throw new Error(`Mark ${student.name} returned before removing them from ${student.classPeriod}.`);
    }
    const waiting = readPassQueue_().find((entry) => entry.status === 'WAITING' && entry.studentKey === key);
    if (waiting) {
      throw new Error(`Remove ${student.name} from the waiting line before removing them from ${student.classPeriod}.`);
    }

    getSpreadsheet_().getSheetByName(GD_SHEETS.ROSTER).getRange(student.row, 5).setValue(false);
    gdForget_('roster');
    gdForget_('unlimited');
    result = { action: 'removed', name: student.name, classPeriod: student.classPeriod };
  });

  const state = getTeacherState_({ includePinStatus: true });
  state.rosterResult = result;
  return state;
}

function normalizeRosterInput_(studentName, studentEmail, classPeriod, settings) {
  const cleanText = (value, label, maxLength) => {
    const text = String(value || '').trim().replace(/\s+/g, ' ');
    if (!text) throw new Error(`${label} is required.`);
    if (text.length > maxLength) throw new Error(`${label} is too long.`);
    assertPlainSheetText_(text, label);
    return text;
  };
  const name = cleanText(studentName, 'Student name', 120);
  const emailText = String(studentEmail || '').trim();
  assertPlainSheetText_(emailText, 'Student email');
  const email = normalizeEmail_(emailText);
  const className = cleanText(classPeriod, 'Class / period', 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter the student’s full school email address.');
  }
  const studentDomain = String((settings && settings.STUDENT_EMAIL_DOMAIN) || '').trim().toLowerCase();
  if (studentDomain && email.split('@').pop() !== studentDomain) {
    throw new Error(`Student email must end in @${studentDomain}.`);
  }
  return { name, email, classPeriod: className, key: rosterKey_(email, className) };
}

function assertPlainSheetText_(value, label) {
  if (/^[=+\-@]/.test(String(value || '').trim())) {
    throw new Error(`${label} cannot begin with =, +, -, or @.`);
  }
}

function teacherRemoveFromQueue(queueId) {
  const teacher = getActiveEmail_();
  assertTeacher_(teacher, getSettings_());
  withLock_(() => {
    const entry = readPassQueue_().find((item) => (
      item.status === 'WAITING' && item.queueId === String(queueId || '')
    ));
    if (entry) closeQueueRow_(entry.row, 'REMOVED', `Removed by ${teacher}`);
    settleWaitingQueue_();
  });
  return getTeacherState_({ includePinStatus: false });
}

function teacherStartPass(studentKey) {
  const teacher = getActiveEmail_();
  assertTeacher_(teacher, getSettings_());
  const student = getStudentByKey_(studentKey);
  if (!student) throw new Error('That student is not active on the roster.');

  let overrideReason = '';
  withLock_(() => {
    const snapshot = getPassSnapshot_();
    reapExpiredQueue_(snapshot.expiredQueue);
    if (snapshot.active.some((pass) => pass.studentEmail === student.email)) return;
    if (!snapshot.openSlots) {
      throw new Error('Every pass slot is in use. End an active pass or raise the limit first.');
    }
    const allowance = getStudentPassAllowance_(student.email, snapshot.settings, snapshot.log);
    if (allowance.limitReached) overrideReason = 'marking-period limit';
    else if (allowance.dailyLimitReached) overrideReason = 'daily limit';
    else if (allowance.cooldownActive) overrideReason = 'return cooldown';
    getSpreadsheet_().getSheetByName(GD_SHEETS.LOG).appendRow([
      Utilities.getUuid(), student.email, student.name, student.classPeriod, snapshot.settings.DESTINATION,
      new Date(), '', '', 'teacher', 'OUT', teacher,
      overrideReason ? `Started by teacher override: ${overrideReason}` : 'Started by teacher',
      'PROVISIONAL', 'Active pass; final duration is not known yet', new Date(),
      'TEACHER', new Date(), Utilities.getUuid(), '', '', '',
    ]);
    gdForget_('passlog');
    closeWaitingQueueForEmail_(student.email, 'STARTED', 'Pass started by teacher');
    settleWaitingQueue_();
  });
  const state = getTeacherState_({ includePinStatus: false });
  if (overrideReason) state.noticeMessage = `${student.name} was given a teacher override for the ${overrideReason}.`;
  return state;
}

function teacherEndPass(passId, note) {
  const teacher = getActiveEmail_();
  assertTeacher_(teacher, getSettings_());
  withLock_(() => {
    closePassById_(String(passId || ''), teacher, String(note || '').slice(0, 300));
    settleWaitingQueue_();
  });
  return getTeacherState_({ includePinStatus: false });
}

function teacherGetCountablePasses(studentEmail) {
  const teacher = getActiveEmail_();
  const settings = getSettings_();
  assertTeacher_(teacher, settings);
  const email = normalizeEmail_(studentEmail);
  const studentRows = readRosterRows_().filter((student) => student.email === email);
  if (!studentRows.length) throw new Error('That student is not in the retained roster history.');
  const allowance = getStudentPassAllowance_(email, settings, readPassLog_());
  return {
    ok: true,
    studentEmail: email,
    studentName: studentRows[0].name,
    used: allowance.used,
    limit: allowance.limit,
    passes: allowance.periodPasses
      .slice()
      .sort((a, b) => b.outDate - a.outDate)
      .map((pass) => ({
        passId: pass.passId,
        classPeriod: pass.classPeriod,
        outTime: isoOrEmpty_(pass.outDate),
        returnTime: isoOrEmpty_(pass.returnDate),
        schoolTime: formatSchoolDateTime_(pass.outDate),
        minutesOut: pass.minutesOut,
        status: pass.status,
        method: pass.method,
        authorizationMethod: pass.authorizationMethod || 'LEGACY',
        countability: passValidity_(pass).code,
      })),
  };
}

function teacherVoidPass(passId, reason) {
  const teacher = getActiveEmail_();
  assertTeacher_(teacher, getSettings_());
  const cleanReason = String(reason || '').trim().replace(/\s+/g, ' ');
  if (!cleanReason) throw new Error('Enter a short reason for this correction.');
  if (cleanReason.length > 300) throw new Error('Keep the correction reason to 300 characters or fewer.');
  assertPlainSheetText_(cleanReason, 'Correction reason');
  let outcome = 'unchanged';
  withLock_(() => {
    const pass = readPassLog_().find((entry) => entry.passId === String(passId || ''));
    if (!pass) throw new Error('That pass is no longer in the current correction window.');
    if (pass.status === 'OUT') throw new Error('End the active pass before correcting its history.');
    if (pass.voidedAt) {
      outcome = 'already voided';
      return;
    }
    const now = new Date();
    getSpreadsheet_().getSheetByName(GD_SHEETS.LOG).getRange(pass.row, 19, 1, 3)
      .setValues([[now, teacher, cleanReason]]);
    gdForget_('passlog');
    outcome = 'voided';
  });
  const state = getTeacherState_({ includePinStatus: false });
  state.noticeMessage = outcome === 'voided'
    ? 'The pass was corrected. Its original facts remain preserved for the permanent audit, and it no longer affects allowance or cooldown.'
    : 'That pass was already corrected; the original correction record was preserved.';
  return state;
}

function teacherCheckInStudent(studentKey) {
  const teacher = getActiveEmail_();
  assertTeacher_(teacher, getSettings_());
  const student = getStudentByKey_(studentKey);
  if (!student) throw new Error('That student is not active on the roster.');
  withLock_(() => recordCheckIn_(student, 'teacher', `Recorded by ${teacher}`));
  return getTeacherState_({ includePinStatus: false });
}

function teacherMarkStudentAbsent(studentKey) {
  const teacher = getActiveEmail_();
  assertTeacher_(teacher, getSettings_());
  const student = getStudentByKey_(studentKey);
  if (!student) throw new Error('That student is not active on the roster.');
  withLock_(() => recordAbsence_(student, teacher));
  const state = getTeacherState_({ includePinStatus: false });
  state.noticeMessage = `${student.name} was marked absent for ${student.classPeriod}.`;
  return state;
}

function teacherClearStudentAbsent(studentKey) {
  const teacher = getActiveEmail_();
  assertTeacher_(teacher, getSettings_());
  const student = getStudentByKey_(studentKey);
  if (!student) throw new Error('That student is not active on the roster.');
  let cleared = false;
  withLock_(() => {
    const todayKey = dateKey_(new Date());
    const absence = readCheckIns_().find((entry) => (
      entry.dateKey === todayKey && entry.studentKey === student.key && entry.status === 'ABSENT'
    ));
    if (!absence) return;
    clearAbsentEntry_(absence, `Cleared by ${teacher}`);
    cleared = true;
  });
  const state = getTeacherState_({ includePinStatus: false });
  state.noticeMessage = cleared
    ? `${student.name} is no longer marked absent. They are back in the not-checked-in list.`
    : `${student.name} was not marked absent.`;
  return state;
}

function getTeacherState_(options) {
  const includePinStatus = Boolean(options && options.includePinStatus);
  const settings = getSettings_();
  const rosterRows = getRoster_();
  const roster = rosterRows.map((student) => ({
    key: student.key,
    email: student.email,
    name: student.name,
    classPeriod: student.classPeriod,
    unlimited: student.unlimited,
  }));
  const snapshot = getPassSnapshot_();
  const log = snapshot.log;
  const todayKey = dateKey_(new Date());
  const allCheckIns = readCheckIns_();
  const streaks = buildStreakIndex_(allCheckIns);
  // An address Google has actually handed us is proven; the rest are guesses.
  const googleVerified = new Set();
  allCheckIns.forEach((entry) => {
    if (entry.method === 'google') googleVerified.add(entry.studentEmail);
  });
  const checkInsToday = allCheckIns
    .filter((checkIn) => checkIn.dateKey === todayKey && checkIn.status === 'CHECKED_IN')
    .sort((a, b) => a.checkInTime - b.checkInTime);
  const checkedKeys = new Set(checkInsToday.map((checkIn) => checkIn.studentKey));
  const absencesToday = allCheckIns
    .filter((entry) => entry.dateKey === todayKey && entry.status === 'ABSENT')
    .sort((a, b) => a.studentName.localeCompare(b.studentName));
  const absentKeys = new Set(absencesToday.map((entry) => entry.studentKey));
  const classNames = [...new Set(roster.map((student) => student.classPeriod || 'class'))]
    .sort((a, b) => a.localeCompare(b));
  const checkInSummary = classNames.map((classPeriod) => {
    const classRoster = roster.filter((student) => (student.classPeriod || 'class') === classPeriod);
    return {
      classPeriod,
      checkedIn: classRoster.filter((student) => checkedKeys.has(student.key)).length,
      absent: classRoster.filter((student) => absentKeys.has(student.key)).length,
      roster: classRoster.length,
    };
  });
  const today = log
    .filter((pass) => safeDateKey_(pass.outDate) === todayKey)
    .slice(-100)
    .reverse()
    .map(clientPass_);
  const rolloverPassesToday = log
    .filter((pass) => pass.status === 'ROLLED_OVER' && safeDateKey_(pass.returnDate) === todayKey)
    .sort((a, b) => b.returnDate - a.returnDate)
    .map(clientPass_);

  const studentPassUsage = getStudentPassUsage_(roster, settings, log, googleVerified);
  const state = {
    ok: true,
    mode: 'teacher',
    appTitle: settings.APP_TITLE,
    lateAfterMinutes: numberSetting_(settings, 'LATE_AFTER_MINUTES', 10),
    stalePassMinutes: numberSetting_(settings, 'STALE_PASS_MINUTES', 20),
    maxActivePasses: snapshot.maxActive,
    passPolicy: getStudentPassPolicy_(settings),
    studentPassUsage,
    repeatPassesToday: studentPassUsage
      .filter((student) => student.todayUsed >= 2)
      .map((student) => ({ name: student.name, classes: student.classes, todayUsed: student.todayUsed })),
    unmatchedSignIns: readUnmatched_()
      .filter((entry) => !['APPLIED', 'IGNORED', 'CLEARED'].includes(entry.status))
      .sort((a, b) => (b.lastSeen ? b.lastSeen.getTime() : 0) - (a.lastSeen ? a.lastSeen.getTime() : 0))
      .slice(0, 25)
      .map((entry) => ({
        email: entry.email,
        lastSeen: isoOrEmpty_(entry.lastSeen),
        timesSeen: entry.timesSeen,
        suggestion: suggestRosterMatch_(entry.email),
      })),
    retentionDays: numberSetting_(settings, 'RETENTION_DAYS', 180),
    active: snapshot.active.map(clientPass_),
    queue: snapshot.queue.map((entry, index) => clientQueue_(entry, index + 1)),
    today,
    rolloverPassesToday,
    roster,
    classNames,
    checkInsToday: checkInsToday.map((checkIn) => ({
      ...clientCheckIn_(checkIn),
      streak: streaks.streakFor(checkIn.studentKey, todayKey),
    })),
    absentToday: absencesToday.map(clientCheckIn_),
    checkInSummary,
    notCheckedIn: roster.filter((student) => !checkedKeys.has(student.key) && !absentKeys.has(student.key)),
    lockContention: getLockContentionSummary_(),
    serverNow: new Date().toISOString(),
  };
  if (includePinStatus) state.pinEmailStatus = getPinEmailStatus_();
  return state;
}

function teacherPinEmailStatus() {
  assertTeacher_(getActiveEmail_(), getSettings_());
  return getPinEmailStatus_();
}

/* -------------------------------------------------------------- streaks ---- */

/** One pass over attendance using the official district school-day calendar. */
function buildStreakIndex_(checkIns, calendarValue) {
  const calendar = calendarValue || getSchoolCalendarIndex_();
  const byStudent = new Map();
  checkIns.forEach((entry) => {
    if (entry.status !== 'CHECKED_IN') return;
    if (!isSchoolDayKey_(entry.dateKey, calendar)) return;
    if (!byStudent.has(entry.studentKey)) byStudent.set(entry.studentKey, new Set());
    byStudent.get(entry.studentKey).add(entry.dateKey);
  });
  return {
    streakFor(studentKey, todayKey) {
      const daySet = byStudent.get(studentKey) || new Set();
      return computeStreak_(daySet, todayKey, calendar);
    },
  };
}

function computeStreak_(daySet, todayKey, calendarValue) {
  const calendar = calendarValue || getSchoolCalendarIndex_();
  const checkedInToday = daySet.has(todayKey);
  const todayIsSchoolDay = isSchoolDayKey_(todayKey, calendar);
  const targetKey = checkedInToday && todayIsSchoolDay ? todayKey : previousSchoolDayKey_(todayKey, calendar);

  let current = 0;
  let cursor = targetKey;
  while (daySet.has(cursor)) {
    current += 1;
    cursor = previousSchoolDayKey_(cursor, calendar);
  }

  const days = [...daySet].filter((key) => isSchoolDayKey_(key, calendar)).sort();
  let best = 0;
  let run = 0;
  let previous = '';
  days.forEach((key) => {
    run = previous && nextSchoolDayKey_(previous, calendar) === key ? run + 1 : 1;
    best = Math.max(best, run);
    previous = key;
  });

  return {
    current,
    best: Math.max(best, current),
    checkedInToday,
    weekendProtected: !todayIsSchoolDay,
    nonSchoolDayProtected: !todayIsSchoolDay,
    atRiskToday: todayIsSchoolDay && !checkedInToday && current > 0,
  };
}

function isWeekdayKey_(key) {
  const date = dateFromKey_(key);
  if (isNaN(date)) return false;
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

function getSchoolCalendarIndex_() {
  return gdMemo_('school-calendar', () => {
    const settings = getSettings_();
    const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.CALENDAR);
    const overrides = {};
    if (sheet && sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, GD_HEADERS.CALENDAR.length).getValues()
        .forEach((row) => {
          const key = normalizeDateKey_(row[0]);
          if (key) overrides[key] = isTruthyCell_(row[1], false);
        });
    }
    return {
      startKey: String(settings.SCHOOL_YEAR_START || '').trim(),
      endKey: String(settings.SCHOOL_YEAR_END || '').trim(),
      overrides,
    };
  });
}

function isSchoolDayKey_(key, calendarValue) {
  const calendar = calendarValue || getSchoolCalendarIndex_();
  const normalized = String(key || '').trim();
  if (calendar.startKey && normalized < calendar.startKey) return false;
  if (calendar.endKey && normalized > calendar.endKey) return false;
  if (calendar.overrides && Object.prototype.hasOwnProperty.call(calendar.overrides, normalized)) {
    return Boolean(calendar.overrides[normalized]);
  }
  return isWeekdayKey_(normalized);
}

function previousWeekdayKey_(key) {
  return previousSchoolDayKey_(key, { startKey: '', endKey: '', overrides: {} });
}

function nextWeekdayKey_(key) {
  return nextSchoolDayKey_(key, { startKey: '', endKey: '', overrides: {} });
}

function previousSchoolDayKey_(key, calendarValue) {
  const calendar = calendarValue || getSchoolCalendarIndex_();
  let date = dateFromKey_(key);
  if (isNaN(date)) return '';
  for (let guard = 0; guard < 370; guard += 1) {
    date = new Date(date.getTime() - 86400000);
    const candidate = utcDateKey_(date);
    if (isSchoolDayKey_(candidate, calendar)) return candidate;
  }
  return '';
}

function nextSchoolDayKey_(key, calendarValue) {
  const calendar = calendarValue || getSchoolCalendarIndex_();
  let date = dateFromKey_(key);
  if (isNaN(date)) return '';
  for (let guard = 0; guard < 370; guard += 1) {
    date = new Date(date.getTime() + 86400000);
    const candidate = utcDateKey_(date);
    if (isSchoolDayKey_(candidate, calendar)) return candidate;
  }
  return '';
}

function dateFromKey_(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || '').trim());
  if (!match) return new Date(NaN);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
}

function utcDateKey_(date) {
  return Utilities.formatDate(date, 'UTC', 'yyyy-MM-dd');
}

/* ------------------------------------------------------------ sheet I/O ---- */

function readRosterRows_() {
  const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.ROSTER);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const width = Math.min(GD_HEADERS.ROSTER.length, sheet.getMaxColumns());
  return sheet.getRange(2, 1, lastRow - 1, width).getValues()
    .map((row, index) => {
      const email = normalizeEmail_(row[0]);
      const classPeriod = String(row[2] || '').trim();
      return {
        row: index + 2,
        key: rosterKey_(email, classPeriod),
        email,
        name: String(row[1] || '').trim(),
        classPeriod,
        pinHash: String(row[3] || '').trim(),
        active: isTruthyCell_(row[4], true),
        unlimited: isTruthyCell_(row[5], false),
      };
    })
    .filter((student) => student.email && student.name);
}

function getRoster_() {
  return gdMemo_('roster', () => readRosterRows_().filter((student) => student.active));
}

function getStudentsByEmail_(email) {
  const normalized = normalizeEmail_(email);
  if (!normalized) return [];
  return getRoster_().filter((student) => student.email === normalized);
}

function getStudentByKey_(key) {
  return getRoster_().find((student) => student.key === String(key || '')) || null;
}

function getStudentsByPinHash_(pinHash) {
  return getRoster_().filter((student) => student.pinHash && student.pinHash === pinHash);
}

function readPassLog_() {
  return gdMemo_('passlog', () => {
    const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.LOG);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    return sheet.getRange(2, 1, lastRow - 1, GD_HEADERS.LOG.length).getValues().map((row, index) => ({
      row: index + 2,
      passId: String(row[0] || ''),
      studentEmail: normalizeEmail_(row[1]),
      studentName: String(row[2] || ''),
      classPeriod: String(row[3] || ''),
      studentKey: rosterKey_(row[1], row[3]),
      destination: String(row[4] || ''),
      outDate: toDateOrNull_(row[5]),
      returnDate: toDateOrNull_(row[6]),
      minutesOut: row[7] === '' ? null : Number(row[7]),
      method: String(row[8] || ''),
      status: String(row[9] || ''),
      endedBy: String(row[10] || ''),
      note: String(row[11] || ''),
      countability: String(row[12] || '').trim().toUpperCase(),
      countabilityReason: String(row[13] || ''),
      classifiedAt: toDateOrNull_(row[14]),
      authorizationMethod: String(row[15] || ''),
      authorizedAt: toDateOrNull_(row[16]),
      requestId: String(row[17] || ''),
      voidedAt: toDateOrNull_(row[18]),
      voidedBy: String(row[19] || ''),
      voidReason: String(row[20] || ''),
    })).filter((pass) => pass.passId);
  });
}

function readPassQueue_() {
  return gdMemo_('queue', () => {
    const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.QUEUE);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    return sheet.getRange(2, 1, lastRow - 1, GD_HEADERS.QUEUE.length).getValues().map((row, index) => ({
      row: index + 2,
      queueId: String(row[0] || ''),
      studentEmail: normalizeEmail_(row[1]),
      studentName: String(row[2] || ''),
      classPeriod: String(row[3] || ''),
      studentKey: rosterKey_(row[1], row[3]),
      joinedAt: toDateOrNull_(row[4]),
      status: String(row[5] || ''),
      resolvedAt: toDateOrNull_(row[6]),
      resolution: String(row[7] || ''),
      requestId: String(row[8] || ''),
      authorizationMethod: String(row[9] || ''),
      authorizedAt: toDateOrNull_(row[10]),
      identityMethod: String(row[11] || ''),
    })).filter((entry) => entry.queueId && entry.joinedAt);
  });
}

function mapCheckInRow_(row, rowNumber) {
  return {
    row: rowNumber,
    checkInId: String(row[0] || ''),
    dateKey: normalizeDateKey_(row[1]),
    checkInTime: toDateOrNull_(row[2]),
    studentEmail: normalizeEmail_(row[3]),
    studentName: String(row[4] || ''),
    classPeriod: String(row[5] || ''),
    studentKey: rosterKey_(row[3], row[5]),
    method: String(row[6] || ''),
    point: Number(row[7] || 0),
    status: String(row[8] || ''),
    note: String(row[9] || ''),
  };
}

function readCheckIns_() {
  return gdMemo_('checkins', () => {
    const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.CHECKINS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    return sheet.getRange(2, 1, lastRow - 1, GD_HEADERS.CHECKINS.length).getValues()
      .map((row, index) => mapCheckInRow_(row, index + 2))
      .filter((checkIn) => checkIn.checkInId);
  });
}

/**
 * Read only the rows one school day needs. Daily Check-ins is append-only and is
 * never purged, so scanning the whole sheet inside the shared write lock made
 * every student's check-in hold that lock longer as the year grew. Rows arrive in
 * chronological order, so the day being written is always at the tail. The window
 * widens until it has actually passed an earlier day, and it falls back to the
 * full read whenever that proof is not available, so the answer is never narrower
 * than the whole-sheet scan it replaces.
 */
function readCheckInsForDate_(targetDateKey) {
  const dateKey = String(targetDateKey || '').trim();
  if (!dateKey) return [];
  if (Object.prototype.hasOwnProperty.call(GD_MEMO, 'checkins')) {
    return readCheckIns_().filter((entry) => entry.dateKey === dateKey);
  }
  const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.CHECKINS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const totalRows = lastRow - 1;
  let windowRows = GD_CHECKIN_TAIL_ROWS;
  while (windowRows < totalRows) {
    const startRow = lastRow - windowRows + 1;
    const scanned = sheet.getRange(startRow, 1, windowRows, GD_HEADERS.CHECKINS.length).getValues()
      .map((row, index) => mapCheckInRow_(row, startRow + index))
      .filter((entry) => entry.checkInId);
    if (scanned.some((entry) => entry.dateKey && entry.dateKey < dateKey)) {
      return scanned.filter((entry) => entry.dateKey === dateKey);
    }
    windowRows = Math.min(totalRows, windowRows * 4);
  }
  return readCheckIns_().filter((entry) => entry.dateKey === dateKey);
}

function readPinCards_() {
  return gdMemo_('pincards', () => {
    const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.PINS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    return sheet.getRange(2, 1, lastRow - 1, GD_HEADERS.PINS.length).getValues().map((row, index) => ({
      row: index + 2,
      studentEmail: normalizeEmail_(row[0]),
      studentName: String(row[1] || ''),
      classPeriod: String(row[2] || ''),
      studentKey: rosterKey_(row[0], row[2]),
      pin: String(row[3] || '').replace(/\D/g, ''),
      generatedAt: toDateOrNull_(row[4]),
      emailStatus: String(row[5] || '').trim().toUpperCase(),
      emailedAt: toDateOrNull_(row[6]),
      emailDetail: String(row[7] || ''),
    })).filter((card) => card.studentEmail && card.studentKey);
  });
}

/* ------------------------------------------------------ client payloads ---- */

function clientPass_(pass) {
  return {
    passId: pass.passId,
    studentName: pass.studentName,
    classPeriod: pass.classPeriod,
    studentKey: pass.studentKey,
    destination: pass.destination,
    outTime: isoOrEmpty_(pass.outDate),
    returnTime: isoOrEmpty_(pass.returnDate),
    minutesOut: pass.minutesOut,
    method: pass.method,
    status: pass.status,
    endedBy: pass.endedBy,
    note: pass.note,
    countability: pass.countability,
    countabilityReason: pass.countabilityReason,
    classifiedAt: isoOrEmpty_(pass.classifiedAt),
    authorizationMethod: pass.authorizationMethod,
    authorizedAt: isoOrEmpty_(pass.authorizedAt),
    requestId: pass.requestId,
    voidedAt: isoOrEmpty_(pass.voidedAt),
    voidedBy: pass.voidedBy,
    voidReason: pass.voidReason,
  };
}

function clientQueue_(entry, position) {
  return {
    queueId: entry.queueId,
    studentName: entry.studentName,
    classPeriod: entry.classPeriod,
    studentKey: entry.studentKey,
    joinedAt: isoOrEmpty_(entry.joinedAt),
    isTurn: Boolean(entry.isTurn),
    position,
  };
}

function clientCheckIn_(checkIn) {
  return {
    checkInId: checkIn.checkInId,
    dateKey: checkIn.dateKey,
    checkInTime: isoOrEmpty_(checkIn.checkInTime),
    studentName: checkIn.studentName,
    classPeriod: checkIn.classPeriod,
    studentKey: checkIn.studentKey,
    method: checkIn.method,
    point: checkIn.point,
    status: checkIn.status,
  };
}

/* ------------------------------------------------------------ PIN cards ---- */

function generateMissingPins() {
  // Menu action. Refuse a web-app caller and check who is asking before any
  // repair touches the workbook.
  if (!SpreadsheetApp.getActiveSpreadsheet()) {
    throw new Error('Run this from the GrantDesk Pass menu inside the spreadsheet.');
  }
  assertTeacher_(getActiveEmail_(), settingsForAuth_());
  const result = withLock_(() => {
    assertPinEmailBatchIdle_();
    setupWorkbook_();
    return ensureOnePinPerStudent_({ createMissing: true });
  }, 30000);
  SpreadsheetApp.getUi().alert(
    result.createdPins || result.normalizedMemberships
      ? 'Student PINs are ready'
      : 'No new PINs were needed',
    result.createdPins || result.normalizedMemberships
      ? `${result.createdPins} new student PIN${result.createdPins === 1 ? '' : 's'} created; ${result.normalizedMemberships} class membership${result.normalizedMemberships === 1 ? '' : 's'} synchronized. Every student now uses one PIN in every Mr. Grant class.`
      : 'Every active student already has one PIN shared across all of their Mr. Grant classes.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function ensureOnePinPerStudent_(options) {
  assertPinEmailBatchIdle_();
  const createMissing = Boolean(options && options.createMissing);
  const rosterSheet = getSpreadsheet_().getSheetByName(GD_SHEETS.ROSTER);
  const pinSheet = getSpreadsheet_().getSheetByName(GD_SHEETS.PINS);
  const roster = getRoster_();
  if (!roster.length) return { createdPins: 0, normalizedMemberships: 0, createdCards: 0 };

  const cards = readPinCards_();
  const cardsByEmail = new Map();
  const rosterByEmail = new Map();
  cards.forEach((card) => {
    if (!cardsByEmail.has(card.studentEmail)) cardsByEmail.set(card.studentEmail, []);
    cardsByEmail.get(card.studentEmail).push(card);
  });
  roster.forEach((student) => {
    if (!rosterByEmail.has(student.email)) rosterByEmail.set(student.email, []);
    rosterByEmail.get(student.email).push(student);
  });

  // Read the Active column once instead of probing each row separately.
  const lastRosterRow = rosterSheet.getLastRow();
  const activeColumn = lastRosterRow > 1
    ? rosterSheet.getRange(2, 5, lastRosterRow - 1, 1).getValues()
    : [];
  const activeWrites = [];

  const usedHashes = new Map();
  let createdPins = 0;
  let normalizedMemberships = 0;
  let createdCards = 0;

  [...rosterByEmail.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([email, memberships]) => {
    const emailCards = (cardsByEmail.get(email) || []).filter((card) => /^\d{6}$/.test(card.pin));
    const existingHashes = [...new Set(memberships.map((student) => student.pinHash).filter(Boolean))];
    const sentCard = emailCards.find((card) => card.emailStatus === 'SENT');
    const hashMatchedCard = emailCards.find((card) => memberships.some((student) => student.pinHash === hashPin_(card.pin)));
    let canonicalPin = (sentCard || hashMatchedCard || emailCards[0] || {}).pin || '';
    let canonicalHash = canonicalPin ? hashPin_(canonicalPin) : '';
    if (canonicalHash && usedHashes.has(canonicalHash) && usedHashes.get(canonicalHash) !== email) {
      canonicalPin = '';
      canonicalHash = '';
    }
    if (!canonicalPin && existingHashes.length === 1 && !usedHashes.has(existingHashes[0])) {
      usedHashes.set(existingHashes[0], email);
      memberships.forEach((student) => {
        if (student.pinHash !== existingHashes[0]) {
          rosterSheet.getRange(student.row, 4).setValue(existingHashes[0]);
          normalizedMemberships += 1;
        }
      });
      return;
    }
    if (!canonicalPin && createMissing) {
      do {
        canonicalPin = String(Math.floor(100000 + Math.random() * 900000));
        canonicalHash = hashPin_(canonicalPin);
      } while (usedHashes.has(canonicalHash));
      createdPins += 1;
    }
    if (!canonicalPin) return;
    usedHashes.set(canonicalHash, email);

    memberships.forEach((student) => {
      if (student.pinHash !== canonicalHash) {
        rosterSheet.getRange(student.row, 4).setValue(canonicalHash);
        normalizedMemberships += 1;
      }
      const activeCell = activeColumn[student.row - 2];
      if (activeCell && String(activeCell[0]).trim() === '') activeWrites.push(student.row);
      const card = (cardsByEmail.get(email) || []).find((item) => item.studentKey === student.key);
      if (card) {
        if (card.pin !== canonicalPin) {
          pinSheet.getRange(card.row, 4).setValue(canonicalPin);
          pinSheet.getRange(card.row, 6, 1, 3).clearContent();
          normalizedMemberships += 1;
        }
      } else {
        pinSheet.appendRow([student.email, student.name, student.classPeriod, canonicalPin, new Date(), '', '', '']);
        createdCards += 1;
      }
    });
  });

  activeWrites.forEach((row) => rosterSheet.getRange(row, 5).setValue(true));
  if (createdPins || normalizedMemberships || createdCards) pinSheet.showSheet();
  gdForget_('roster');
  gdForget_('unlimited');
  gdForget_('pincards');
  return { createdPins, normalizedMemberships, createdCards };
}

/* --------------------------------------------------------- PIN delivery ---- */

function previewStudentPinEmails() {
  const settings = getSettings_();
  assertTeacher_(getActiveEmail_(), settings);
  const status = getPinEmailStatus_();
  return {
    ...status,
    remainingDailyQuota: MailApp.getRemainingDailyQuota(),
    subject: settings.PIN_EMAIL_SUBJECT,
    example: [
      'Hello Jordan,',
      '',
      'Here is your private GrantDesk PIN:',
      '123456',
      '',
      `Open ${settings.CHECKIN_URL} for Daily Check-in and Hall Pass. This one PIN works in every Mr. Grant class. Keep it private.`,
      '',
      '— Mr. Grant',
    ].join('\n'),
  };
}

function previewPinEmailDistribution() {
  const preview = previewStudentPinEmails();
  SpreadsheetApp.getUi().alert(
    'GrantDesk PIN email preview',
    [
      `${preview.readyRecipients} student email${preview.readyRecipients === 1 ? '' : 's'} ready`,
      `${preview.sentRecipients} student PIN${preview.sentRecipients === 1 ? '' : 's'} already marked sent`,
      `${preview.missingRecipients} student${preview.missingRecipients === 1 ? '' : 's'} missing a printable PIN`,
      `${preview.invalidDomainRecipients} student address${preview.invalidDomainRecipients === 1 ? '' : 'es'} outside the student domain`,
      `${preview.remainingDailyQuota} recipient${preview.remainingDailyQuota === 1 ? '' : 's'} remaining in today’s Apps Script mail quota`,
      '',
      'Nothing was sent. Use the teacher dashboard or GrantDesk Pass → Email unsent PINs when ready.',
    ].join('\n'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function emailStudentPinsFromSheet() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Email student PINs',
    'This sends one private message to every ready student address. Type EMAIL PINS to confirm.',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;
  const result = runPinEmailBatch_(response.getResponseText());
  ui.alert(
    'PIN email batch finished',
    `${result.sentRecipients} student email${result.sentRecipients === 1 ? '' : 's'} sent; ${result.failedRecipients} recipient${result.failedRecipients === 1 ? '' : 's'} failed.`,
    ui.ButtonSet.OK
  );
}

function sendStudentPinEmails(confirmText) {
  const result = runPinEmailBatch_(confirmText);
  const state = getTeacherState_({ includePinStatus: true });
  state.emailResult = result;
  return state;
}

/**
 * The batch guards itself with a script property rather than the script lock so
 * a long send never blocks a student pressing a button in class.
 */
function runPinEmailBatch_(confirmText) {
  const settings = getSettings_();
  const teacher = getActiveEmail_();
  assertTeacher_(teacher, settings);
  if (String(confirmText || '').trim() !== 'EMAIL PINS') {
    throw new Error('No messages were sent. Type EMAIL PINS exactly to confirm the batch.');
  }

  const properties = PropertiesService.getScriptProperties();
  // Claim the batch while holding the lock so two teacher tabs cannot both
  // pass the check and mail all 112 students twice. The lock is released
  // before the send, so a long batch never blocks a student in class.
  withLock_(() => {
    const startedAt = Number(properties.getProperty('PIN_EMAIL_RUNNING') || 0);
    if (startedAt && Date.now() - startedAt < 600000) {
      throw new Error('A PIN email batch is already running. Wait for it to finish, then refresh.');
    }
    properties.setProperty('PIN_EMAIL_RUNNING', String(Date.now()));
  }, 10000);

  try {
    const delivery = buildPinEmailGroups_();
    const groups = delivery.readyGroups;
    if (!groups.length) {
      return { sentRecipients: 0, failedRecipients: 0, failures: [], message: 'No unsent PIN emails were ready.' };
    }
    const quota = MailApp.getRemainingDailyQuota();
    if (quota < groups.length) {
      throw new Error(`No messages were sent. ${groups.length} recipients are ready, but today’s remaining mail quota is ${quota}.`);
    }

    let sentRecipients = 0;
    let failedRecipients = 0;
    const failures = [];
    groups.forEach((group) => {
      try {
        MailApp.sendEmail(buildPinEmailMessage_(group, settings, teacher));
        markPinEmailRows_(group.memberships.map((membership) => membership.row), 'SENT', settings.PIN_EMAIL_SUBJECT);
        sentRecipients += 1;
      } catch (error) {
        const detail = String(error && error.message ? error.message : error).slice(0, 250);
        markPinEmailRows_(group.memberships.map((membership) => membership.row), 'ERROR', detail);
        failedRecipients += 1;
        failures.push(`${group.email}: ${detail}`);
      }
    });

    return {
      sentRecipients,
      failedRecipients,
      failures: failures.slice(0, 10),
      message: failedRecipients
        ? `${sentRecipients} student emails sent; ${failedRecipients} need attention.`
        : `${sentRecipients} student emails sent successfully.`,
    };
  } finally {
    properties.deleteProperty('PIN_EMAIL_RUNNING');
  }
}

function getPinEmailStatus_() {
  const delivery = buildPinEmailGroups_();
  return {
    readyRecipients: delivery.readyGroups.length,
    sentRecipients: delivery.sentRecipients,
    missingRecipients: delivery.missingRecipients,
    invalidDomainRecipients: delivery.invalidDomainRecipients,
  };
}

function buildPinEmailGroups_() {
  const settings = getSettings_();
  const studentDomain = String(settings.STUDENT_EMAIL_DOMAIN || '').toLowerCase();
  const cardsByEmail = new Map();
  readPinCards_().forEach((card) => {
    if (!cardsByEmail.has(card.studentEmail)) cardsByEmail.set(card.studentEmail, []);
    cardsByEmail.get(card.studentEmail).push(card);
  });
  const studentsByEmail = new Map();
  getRoster_().forEach((student) => {
    if (!studentsByEmail.has(student.email)) {
      studentsByEmail.set(student.email, { student, activeKeys: new Set() });
    }
    studentsByEmail.get(student.email).activeKeys.add(student.key);
  });

  const readyGroups = [];
  let sentRecipients = 0;
  let missingRecipients = 0;
  let invalidDomainRecipients = 0;

  studentsByEmail.forEach((record, email) => {
    const student = record.student;
    const memberships = (cardsByEmail.get(email) || [])
      .filter((card) => record.activeKeys.has(card.studentKey));
    const pins = [...new Set(memberships.map((card) => card.pin).filter((pin) => /^\d{6}$/.test(pin)))];
    if (pins.length !== 1) {
      missingRecipients += 1;
      return;
    }
    if (email.split('@').pop() !== studentDomain) {
      invalidDomainRecipients += 1;
      return;
    }
    if (memberships.length && memberships.every((card) => card.emailStatus === 'SENT')) {
      sentRecipients += 1;
      return;
    }
    readyGroups.push({ email, name: student.name, pin: pins[0], memberships });
  });

  return {
    readyGroups: readyGroups.sort((a, b) => a.email.localeCompare(b.email)),
    sentRecipients,
    missingRecipients,
    invalidDomainRecipients,
  };
}

function buildPinEmailMessage_(group, settings, teacherEmail) {
  const firstName = firstNameFromStudentName_(group.name);
  const body = [
    `Hello ${firstName},`,
    '',
    'Here is your private GrantDesk PIN:',
    group.pin,
    '',
    `Open ${settings.CHECKIN_URL} for Daily Check-in and Hall Pass.`,
    'This one PIN works in every Mr. Grant class. If you are enrolled in more than one, choose the class you are attending after you enter it.',
    'Keep this PIN private.',
    '',
    '— Mr. Grant',
  ].join('\n');
  const htmlBody = [
    `<p>Hello ${escapeHtmlForEmail_(firstName)},</p>`,
    '<p>Here is your private GrantDesk PIN:</p>',
    `<p style="font-family:monospace;font-size:24px;font-weight:bold;letter-spacing:.12em">${escapeHtmlForEmail_(group.pin)}</p>`,
    `<p>Open <a href="${escapeHtmlForEmail_(settings.CHECKIN_URL)}">GrantDesk Daily Check-in</a> for Daily Check-in and Hall Pass.</p>`,
    '<p>This one PIN works in every Mr. Grant class. If you are enrolled in more than one, choose the class you are attending after you enter it.</p>',
    '<p>Keep this PIN private.</p>',
    '<p>— Mr. Grant</p>',
  ].join('');
  return {
    to: group.email,
    subject: settings.PIN_EMAIL_SUBJECT,
    body,
    htmlBody,
    name: 'GrantDesk · Mr. Grant',
    replyTo: teacherEmail,
  };
}

function firstNameFromStudentName_(value) {
  const name = String(value || 'student').trim();
  const firstSide = name.includes(',') ? name.split(',').slice(1).join(',').trim() : name;
  return firstSide.split(/\s+/)[0] || name;
}

function markPinEmailRows_(rows, status, detail) {
  const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.PINS);
  rows.forEach((row) => sheet.getRange(row, 6, 1, 3).setValues([[
    status,
    new Date(),
    String(detail || '').slice(0, 250),
  ]]));
  gdForget_('pincards');
}

function escapeHtmlForEmail_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

function clearPinCards() {
  assertTeacher_(getActiveEmail_(), getSettings_());
  withLock_(() => {
    assertPinEmailBatchIdle_();
    const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.PINS);
    if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, GD_HEADERS.PINS.length).clearContent();
    sheet.hideSheet();
    gdForget_('pincards');
  });
}

function assertPinEmailBatchIdle_() {
  const emailBatchStarted = Number(PropertiesService.getScriptProperties().getProperty('PIN_EMAIL_RUNNING') || 0);
  if (emailBatchStarted && Date.now() - emailBatchStarted < 600000) {
    throw new Error('PIN records cannot be changed while a PIN email batch is running. Wait for the batch to finish.');
  }
}

function openTodayCheckIns() {
  assertTeacher_(getActiveEmail_(), getSettings_());
  const spreadsheet = getSpreadsheet_();
  const sheet = spreadsheet.getSheetByName(GD_SHEETS.CHECKINS);
  spreadsheet.setActiveSheet(sheet);
  sheet.getRange(Math.max(2, sheet.getLastRow()), 1).activate();
}

/* ---------------------------------------------------------------- auth ---- */

function hashPin_(pin) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    `${ensureSalt_()}:${String(pin)}`,
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(bytes);
}

function ensureSalt_() {
  const properties = PropertiesService.getScriptProperties();
  let salt = properties.getProperty('PIN_SALT');
  if (!salt) {
    salt = `${Utilities.getUuid()}${Utilities.getUuid()}`;
    properties.setProperty('PIN_SALT', salt);
  }
  return salt;
}

function assertPinAttemptAllowed_(email, attemptNonce) {
  const cache = CacheService.getScriptCache();
  const key = pinAttemptKey_(email, attemptNonce);
  const attempts = Number(cache.get(key) || 0);
  const limit = email ? 10 : 20;
  if (attempts >= limit) {
    throw new Error(email
      ? 'Too many incorrect PIN attempts. Wait fifteen minutes or ask Mr. Grant.'
      : 'Too many incorrect PIN attempts on this device. Ask Mr. Grant.');
  }

  const shared = Number(cache.get('pin-attempts:shared-global') || 0);
  if (!email && shared >= 1000) {
    throw new Error('Too many incorrect PIN attempts on the shared PIN screen. Ask Mr. Grant.');
  }
}

function recordFailedPinAttempt_(email, attemptNonce) {
  const cache = CacheService.getScriptCache();
  const key = pinAttemptKey_(email, attemptNonce);
  cache.put(key, String(Number(cache.get(key) || 0) + 1), 900);
  if (!email) {
    cache.put('pin-attempts:shared-global', String(Number(cache.get('pin-attempts:shared-global') || 0) + 1), 900);
  }
}

function clearPinAttempts_(email, attemptNonce) {
  CacheService.getScriptCache().remove(pinAttemptKey_(email, attemptNonce));
}

function pinAttemptKey_(email, attemptNonce) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    email ? normalizeEmail_(email) : `anonymous:${String(attemptNonce || 'shared').slice(0, 120)}`,
    Utilities.Charset.UTF_8
  );
  return `pin-attempts:${email ? 'email' : 'anon'}:${Utilities.base64EncodeWebSafe(digest).slice(0, 32)}`;
}

function getActiveEmail_() {
  try {
    return normalizeEmail_(Session.getActiveUser().getEmail());
  } catch (error) {
    return '';
  }
}

/**
 * An empty address is not a failure. Chromebooks signed into a secondary
 * student domain can reach the app without exposing an address to the script,
 * and those students identify themselves with a PIN instead.
 */
function assertSchoolAccount_(email, settings) {
  if (!email) return;
  const domain = String(settings.SCHOOL_DOMAIN || '').toLowerCase();
  if (!domain) return;
  const emailDomain = normalizeEmail_(email).split('@').pop();
  if (emailDomain === domain || emailDomain.endsWith(`.${domain}`)) return;
  throw new Error('Open this page while signed into your school Google account.');
}

/**
 * The teacher list, readable before setupWorkbook_ has built the Settings tab.
 * Authorization has to happen before repair, and repair is what creates the
 * sheet the normal settings read depends on.
 */
function settingsForAuth_() {
  try {
    return getSettings_();
  } catch (error) {
    return GD_DEFAULT_SETTINGS.reduce((settings, row) => {
      settings[row[0]] = row[1];
      return settings;
    }, {});
  }
}

function assertTeacher_(email, settings) {
  const teachers = String(settings.TEACHER_EMAILS || '').split(',').map(normalizeEmail_).filter(Boolean);
  if (!email || !teachers.includes(normalizeEmail_(email))) {
    throw new Error('This view is limited to the teacher account. Sign in as the teacher and reload.');
  }
}

/* ----------------------------------------------------------- settings ---- */

function getSettings_() {
  return gdMemo_('settings', () => {
    const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.SETTINGS);
    const values = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues() : [];
    return values.reduce((settings, row) => {
      const key = String(row[0] || '').trim();
      if (!key) return settings;
      const value = row[1];
      settings[key] = value instanceof Date ? value.toISOString() : String(value == null ? '' : value).trim();
      return settings;
    }, {});
  });
}

function setSettingValue_(key, value) {
  const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.SETTINGS);
  const lastRow = sheet.getLastRow();
  const keys = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(String) : [];
  const index = keys.indexOf(String(key));
  if (index >= 0) {
    sheet.getRange(index + 2, 2).setNumberFormat('@').setValue(value);
    gdForget_('settings');
    return;
  }
  const description = (GD_DEFAULT_SETTINGS.find((row) => row[0] === key) || ['', '', ''])[2];
  sheet.appendRow([key, value, description]);
  sheet.getRange(sheet.getLastRow(), 2).setNumberFormat('@').setValue(value);
  gdForget_('settings');
}

/**
 * A blank or unreadable setting must fall back to the documented default. An
 * empty cell used to read as zero, which would have meant zero points for a
 * check-in and every pass flagged late.
 */
function numberSetting_(settings, key, fallback) {
  const raw = settings[key];
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * Sheets hands back a real boolean for a checkbox, text for a typed value and
 * an empty string for a blank cell. `String(false || '')` is '', so a plain
 * boolean FALSE has to be tested before any string coercion.
 */
function isTruthyCell_(value, blankMeans) {
  if (value === true) return true;
  if (value === false) return false;
  const text = String(value == null ? '' : value).trim().toLowerCase();
  if (text === '') return blankMeans;
  if (['false', 'no', 'n', 'inactive', 'unchecked', '0'].includes(text)) return false;
  if (['true', 'yes', 'y', 'active', 'unlimited', '1'].includes(text)) return true;
  return blankMeans;
}

function parseSettingDate_(value) {
  if (value instanceof Date && !isNaN(value)) return value;
  const text = String(value == null ? '' : value).trim();
  if (!text) return new Date(0);
  const parsed = new Date(text);
  if (!isNaN(parsed)) return parsed;
  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 0) return new Date(numeric);
  return new Date(0);
}

/* ------------------------------------------------------------ plumbing ---- */

function withLock_(action, waitMs, operationLabel) {
  const lock = LockService.getScriptLock();
  const requestedWait = Number(waitMs);
  const maxWaitMs = Number.isFinite(requestedWait) && requestedWait > 0 ? requestedWait : 25000;
  try {
    lock.waitLock(maxWaitMs);
  } catch (error) {
    if (operationLabel) recordLockContention_(operationLabel, maxWaitMs);
    throw new Error(GD_BUSY_LOCK_MESSAGE);
  }
  try {
    gdClearMemo_();
    return action();
  } finally {
    gdClearMemo_();
    lock.releaseLock();
  }
}

/**
 * Keep a privacy-safe, best-effort count of student writes that met a busy
 * shared workbook. This intentionally stores no student key, email, PIN,
 * pass ID, or check-in ID. Property updates can collide during a traffic
 * burst, so the dashboard describes this as an approximate signal count.
 */
function recordLockContention_(operationLabel, waitMs) {
  const label = String(operationLabel || '').trim().slice(0, 60);
  if (!label) return;
  try {
    const properties = PropertiesService.getScriptProperties();
    const today = dateKey_(new Date());
    let summary = null;
    try {
      summary = JSON.parse(properties.getProperty(GD_LOCK_CONTENTION_PROPERTY) || 'null');
    } catch (error) {
      summary = null;
    }
    if (!summary || summary.date !== today) {
      summary = { date: today, retrySignals: 0, byOperation: {} };
    }
    if (!summary.byOperation || typeof summary.byOperation !== 'object' || Array.isArray(summary.byOperation)) {
      summary.byOperation = {};
    }
    summary.retrySignals = Math.max(0, Number(summary.retrySignals) || 0) + 1;
    summary.byOperation[label] = Math.max(0, Number(summary.byOperation[label]) || 0) + 1;
    summary.lastAt = new Date().toISOString();
    summary.lastOperation = label;
    summary.lastWaitMs = Math.max(0, Number(waitMs) || 0);
    properties.setProperty(GD_LOCK_CONTENTION_PROPERTY, JSON.stringify(summary));
  } catch (error) {
    // Diagnostics must never turn a recoverable traffic collision into an outage.
  }
}

function getLockContentionSummary_() {
  const today = dateKey_(new Date());
  const empty = { date: today, retrySignals: 0, byOperation: {}, lastAt: '', lastOperation: '', lastWaitMs: 0 };
  try {
    const raw = JSON.parse(
      PropertiesService.getScriptProperties().getProperty(GD_LOCK_CONTENTION_PROPERTY) || 'null'
    );
    if (!raw || raw.date !== today) return empty;
    const byOperation = {};
    Object.keys(raw.byOperation || {}).slice(0, 10).forEach((key) => {
      const label = String(key || '').slice(0, 60);
      if (label) byOperation[label] = Math.max(0, Number(raw.byOperation[key]) || 0);
    });
    return {
      date: today,
      retrySignals: Math.max(0, Number(raw.retrySignals) || 0),
      byOperation,
      lastAt: String(raw.lastAt || '').slice(0, 40),
      lastOperation: String(raw.lastOperation || '').slice(0, 60),
      lastWaitMs: Math.max(0, Number(raw.lastWaitMs) || 0),
    };
  } catch (error) {
    return empty;
  }
}

function rosterKey_(email, classPeriod) {
  return `${normalizeEmail_(email)}::${String(classPeriod || '').trim().toLowerCase()}`;
}

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function toDateOrNull_(value) {
  if (value instanceof Date) return isNaN(value) ? null : value;
  if (value === '' || value == null) return null;
  const parsed = new Date(value);
  return isNaN(parsed) ? null : parsed;
}

function isoOrEmpty_(date) {
  return date && !isNaN(date) ? date.toISOString() : '';
}

function dateKey_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function safeDateKey_(date) {
  if (!date || isNaN(date)) return '';
  return dateKey_(date);
}

function normalizeDateKey_(value) {
  if (value instanceof Date && !isNaN(value)) return dateKey_(value);
  return String(value || '').trim();
}

/* ------------------------------------------------------------- cleanup ---- */

/**
 * Daily trigger target. Apps Script cannot point a trigger at a private
 * function, so this name stays public, which also means any signed-in account
 * on the school domain can reach it from a page. The teacher check runs first:
 * under the time trigger the active user is the owner, and from the web app it
 * is whoever pressed the button. Deletion then takes the same lock every live
 * pass and queue write takes, so row numbers cannot shift underneath an update
 * already in flight.
 */
function dailyCleanup(event) {
  // A time-driven trigger hands the handler its own triggerUid. A page calling
  // this over google.script.run does not, and a student cannot read the UID of
  // a trigger they do not own, so anything without one has to be the teacher.
  const triggerUid = event && event.triggerUid ? String(event.triggerUid) : '';
  const fromTrigger = Boolean(triggerUid) && ScriptApp.getProjectTriggers()
    .some((trigger) => trigger.getUniqueId() === triggerUid);
  if (!fromTrigger) assertTeacher_(getActiveEmail_(), getSettings_());
  withLock_(() => {
    expirePreviousDayPasses_();
    purgeOldPasses_();
    purgeOldQueue_();
    purgeExpiredActionProofs_();
    PropertiesService.getScriptProperties().setProperty('LAST_PURGE', dateKey_(new Date()));
  });
}

function purgeOldPasses() {
  assertTeacher_(getActiveEmail_(), getSettings_());
  const removed = withLock_(() => ({
    rolledOver: expirePreviousDayPasses_(),
    passes: purgeOldPasses_(),
    queueRows: purgeOldQueue_(),
  }));
  const removedPasses = removed.passes;
  const removedQueueRows = removed.queueRows;
  SpreadsheetApp.getUi().alert(`${removed.rolledOver} prior-day OUT pass${removed.rolledOver === 1 ? '' : 'es'} rolled over, ${removedPasses} old completed pass${removedPasses === 1 ? '' : 'es'} moved into permanent Pass Audit, and ${removedQueueRows} resolved queue entr${removedQueueRows === 1 ? 'y' : 'ies'} removed.`);
}

function purgeIfDue_() {
  const properties = PropertiesService.getScriptProperties();
  const today = dateKey_(new Date());
  if (properties.getProperty('LAST_PURGE') === today) return;
  withLock_(() => {
    const lockedProperties = PropertiesService.getScriptProperties();
    if (lockedProperties.getProperty('LAST_PURGE') === today) return;
    expirePreviousDayPasses_();
    purgeOldPasses_();
    purgeOldQueue_();
    purgeExpiredActionProofs_();
    lockedProperties.setProperty('LAST_PURGE', today);
  });
}

/**
 * Preserve a forgotten pass as an explicit audit event while releasing it from
 * the next school day's live room state. The recorded return time is when the
 * system noticed the rollover, not a claim about when the student came back.
 */
function expirePreviousDayPasses_(nowValue) {
  const now = toDateOrNull_(nowValue) || new Date();
  const todayKey = dateKey_(now);
  const stale = readPassLog_().filter((pass) => (
    pass.status === 'OUT' && safeDateKey_(pass.outDate) !== todayKey
  ));
  if (!stale.length) {
    markRolloverChecked_(todayKey);
    return 0;
  }

  const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.LOG);
  stale.forEach((pass) => {
    const minutes = pass.outDate
      ? Math.max(0, Math.round(((now.getTime() - pass.outDate.getTime()) / 60000) * 10) / 10)
      : '';
    const note = [
      String(pass.note || '').trim(),
      'Automatically rolled over because no return was recorded before the next school day',
    ].filter(Boolean).join(' · ').slice(0, 300);
    sheet.getRange(pass.row, 7, 1, 2).setValues([[now, minutes]]);
    sheet.getRange(pass.row, 10, 1, 3).setValues([['ROLLED_OVER', 'system', note]]);
    sheet.getRange(pass.row, 13, 1, 3).setValues([[
      pass.outDate ? 'COUNTABLE' : 'NON_COUNTABLE',
      pass.outDate
        ? 'No return was recorded before the next school day'
        : 'Could not verify a valid sign-out timestamp',
      now,
    ]]);
  });
  gdForget_('passlog');
  markRolloverChecked_(todayKey);
  return stale.length;
}

function markRolloverChecked_(todayKey) {
  try {
    PropertiesService.getScriptProperties().setProperty(GD_ROLLOVER_PROPERTY, String(todayKey || ''));
  } catch (error) {
    // A missing marker only costs one extra scan later; it must never fail a student write.
  }
}

/**
 * Prior-day rollover has work to do at most once per school day. Running the full
 * Pass Log scan inside every student's bathroom-request and return lock made each
 * of those requests hold the one shared lock longer than it needed to, which is
 * what a class saw as the busy message during a bell rush. Whichever action comes
 * first that day still performs the rollover; everyone after it skips the scan.
 */
function expirePreviousDayPassesIfDue_(nowValue) {
  const todayKey = dateKey_(toDateOrNull_(nowValue) || new Date());
  let marker = '';
  try {
    marker = String(PropertiesService.getScriptProperties().getProperty(GD_ROLLOVER_PROPERTY) || '');
  } catch (error) {
    marker = '';
  }
  if (marker === todayKey) return 0;
  return expirePreviousDayPasses_(nowValue);
}

function purgeOldPasses_() {
  const retentionDays = numberSetting_(getSettings_(), 'RETENTION_DAYS', 180);
  if (!retentionDays) return 0;
  const cutoff = Date.now() - retentionDays * 86400000;
  const rows = readPassLog_()
    .filter((pass) => pass.status !== 'OUT' && pass.returnDate && pass.returnDate.getTime() < cutoff)
    .map((pass) => pass.row)
    .sort((a, b) => b - a);
  const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.LOG);
  const auditSheet = getSpreadsheet_().getSheetByName(GD_SHEETS.AUDIT);
  const archivedIds = readPassAuditIds_();
  rows.forEach((row) => {
    const values = sheet.getRange(row, 1, 1, GD_HEADERS.LOG.length).getValues()[0];
    const passId = String(values[0] || '');
    if (!passId) throw new Error(`Pass Log row ${row} has no Pass ID and was not archived.`);
    if (!archivedIds.has(passId)) {
      auditSheet.appendRow([...values, new Date()]);
      archivedIds.add(passId);
    }
    sheet.deleteRow(row);
  });
  if (rows.length) gdForget_('passlog');
  return rows.length;
}

function readPassAuditIds_() {
  const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.AUDIT);
  if (!sheet || sheet.getLastRow() < 2) return new Set();
  return new Set(sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat().map(String).filter(Boolean));
}

function purgeOldQueue_() {
  const retentionDays = numberSetting_(getSettings_(), 'RETENTION_DAYS', 180);
  if (!retentionDays) return 0;
  const cutoff = Date.now() - retentionDays * 86400000;
  const rows = readPassQueue_()
    .filter((entry) => entry.status !== 'WAITING' && entry.resolvedAt && entry.resolvedAt.getTime() < cutoff)
    .map((entry) => entry.row)
    .sort((a, b) => b - a);
  const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.QUEUE);
  rows.forEach((row) => sheet.deleteRow(row));
  if (rows.length) gdForget_('queue');
  return rows.length;
}

function purgeExpiredActionProofs_() {
  const properties = PropertiesService.getScriptProperties();
  const now = Date.now();
  let removed = 0;
  Object.entries(properties.getProperties()).forEach(([key, value]) => {
    if (!key.startsWith('student-action:')) return;
    if (Number(value || 0) >= now) return;
    properties.deleteProperty(key);
    removed += 1;
  });
  return removed;
}

function installCleanupTrigger_() {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === 'purgeIfDue_') ScriptApp.deleteTrigger(trigger);
  });
  const exists = ScriptApp.getProjectTriggers().some((trigger) => trigger.getHandlerFunction() === 'dailyCleanup');
  if (!exists) ScriptApp.newTrigger('dailyCleanup').timeBased().everyDays(1).atHour(3).create();
}

/* -------------------------------------------------------------- workbook ---- */

function getSpreadsheet_() {
  if (GD_SPREADSHEET) return GD_SPREADSHEET;
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) {
    GD_SPREADSHEET = SpreadsheetApp.openById(id);
    return GD_SPREADSHEET;
  }
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('Run setupProject once from the spreadsheet before deploying the web app.');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', active.getId());
  GD_SPREADSHEET = active;
  return GD_SPREADSHEET;
}

/**
 * Student page loads must not repair the workbook. This runs the full repair
 * once per schema version and then costs a single property read.
 */
function ensureWorkbookReady_() {
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty('WORKBOOK_SCHEMA') === GD_SCHEMA_VERSION) return;
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (error) {
    throw new Error('GrantDesk is finishing a workbook update. Wait a moment, then reload this page.');
  }
  try {
    if (properties.getProperty('WORKBOOK_SCHEMA') === GD_SCHEMA_VERSION) return;
    setupWorkbook_();
    try {
      installCleanupTrigger_();
    } catch (error) {
      // A missing trigger is not worth blocking the classroom over.
    }
    properties.setProperty('WORKBOOK_SCHEMA', GD_SCHEMA_VERSION);
  } finally {
    lock.releaseLock();
  }
}

function setupWorkbook_() {
  const spreadsheet = getSpreadsheet_();
  ensureSheet_(spreadsheet, GD_SHEETS.ROSTER, GD_HEADERS.ROSTER);
  ensureSheet_(spreadsheet, GD_SHEETS.LOG, GD_HEADERS.LOG);
  ensureSheet_(spreadsheet, GD_SHEETS.AUDIT, GD_HEADERS.AUDIT);
  ensureSheet_(spreadsheet, GD_SHEETS.CHECKINS, GD_HEADERS.CHECKINS);
  ensureSheet_(spreadsheet, GD_SHEETS.QUEUE, GD_HEADERS.QUEUE);
  ensureSheet_(spreadsheet, GD_SHEETS.SETTINGS, GD_HEADERS.SETTINGS);
  ensureSheet_(spreadsheet, GD_SHEETS.PINS, GD_HEADERS.PINS);
  ensureSheet_(spreadsheet, GD_SHEETS.UNMATCHED, GD_HEADERS.UNMATCHED);
  ensureSheet_(spreadsheet, GD_SHEETS.CALENDAR, GD_HEADERS.CALENDAR);
  gdClearMemo_();

  const settingsSheet = spreadsheet.getSheetByName(GD_SHEETS.SETTINGS);
  const existing = settingsSheet.getLastRow() > 1
    ? new Set(settingsSheet.getRange(2, 1, settingsSheet.getLastRow() - 1, 1).getValues().flat().map(String))
    : new Set();
  const missing = GD_DEFAULT_SETTINGS.filter((row) => !existing.has(row[0]));
  if (missing.length) {
    settingsSheet.getRange(settingsSheet.getLastRow() + 1, 1, missing.length, 3).setValues(missing);
  }
  removeLegacySettingRows_(settingsSheet, ['PASS_SESSION_LIMIT', 'PASS_SESSION_RESET_AT']);
  setSettingDescription_(
    settingsSheet,
    'QUEUE_CLAIM_MINUTES',
    'Legacy inert setting retained for audit; verified requests now advance automatically'
  );
  setSettingDescription_(
    settingsSheet,
    'RETENTION_DAYS',
    'Completed passes older than this move from the hot Pass Log into permanent Pass Audit'
  );
  gdForget_('settings');
  if (getSettings_().PIN_EMAIL_SUBJECT === 'Your private GrantDesk class PIN') {
    setSettingValue_('PIN_EMAIL_SUBJECT', 'Your private GrantDesk PIN');
  }
  seedOfficialSchoolCalendar_();
  refreshWorkbookInstructions_();

  const logSheet = spreadsheet.getSheetByName(GD_SHEETS.LOG);
  logSheet.getRange('F:G').setNumberFormat('m/d/yyyy h:mm:ss am/pm');
  logSheet.getRange('H:H').setNumberFormat('0.0');
  logSheet.getRange('O:O').setNumberFormat('m/d/yyyy h:mm:ss am/pm');
  logSheet.getRange('Q:Q').setNumberFormat('m/d/yyyy h:mm:ss am/pm');
  logSheet.getRange('S:S').setNumberFormat('m/d/yyyy h:mm:ss am/pm');
  const auditSheet = spreadsheet.getSheetByName(GD_SHEETS.AUDIT);
  auditSheet.getRange('F:G').setNumberFormat('m/d/yyyy h:mm:ss am/pm');
  auditSheet.getRange('H:H').setNumberFormat('0.0');
  auditSheet.getRange('O:O').setNumberFormat('m/d/yyyy h:mm:ss am/pm');
  auditSheet.getRange('Q:Q').setNumberFormat('m/d/yyyy h:mm:ss am/pm');
  auditSheet.getRange('S:S').setNumberFormat('m/d/yyyy h:mm:ss am/pm');
  auditSheet.getRange('V:V').setNumberFormat('m/d/yyyy h:mm:ss am/pm');
  const checkInSheet = spreadsheet.getSheetByName(GD_SHEETS.CHECKINS);
  checkInSheet.getRange('B:B').setNumberFormat('@');
  checkInSheet.getRange('C:C').setNumberFormat('m/d/yyyy h:mm:ss am/pm');
  checkInSheet.getRange('H:H').setNumberFormat('0');
  const queueSheet = spreadsheet.getSheetByName(GD_SHEETS.QUEUE);
  queueSheet.getRange('E:G').setNumberFormat('m/d/yyyy h:mm:ss am/pm');
  queueSheet.getRange('K:K').setNumberFormat('m/d/yyyy h:mm:ss am/pm');
  const pinSheet = spreadsheet.getSheetByName(GD_SHEETS.PINS);
  pinSheet.getRange('E:E').setNumberFormat('m/d/yyyy h:mm am/pm');
  pinSheet.getRange('G:G').setNumberFormat('m/d/yyyy h:mm am/pm');
  spreadsheet.getSheetByName(GD_SHEETS.UNMATCHED).getRange('B:C').setNumberFormat('m/d/yyyy h:mm am/pm');
  spreadsheet.getSheetByName(GD_SHEETS.CALENDAR).getRange('A:A').setNumberFormat('@');

  ensureUnlimitedCheckboxes_(spreadsheet.getSheetByName(GD_SHEETS.ROSTER));
  reconcileKnownIdentityDrift_();
  ensureOnePinPerStudent_({ createMissing: false });
}

function refreshWorkbookInstructions_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(GD_SHEETS.INSTRUCTIONS);
  if (!sheet) sheet = spreadsheet.insertSheet(GD_SHEETS.INSTRUCTIONS, 0);
  if (sheet.getMaxColumns() < 2) sheet.insertColumnsAfter(sheet.getMaxColumns(), 2 - sheet.getMaxColumns());
  const rows = [
    ['1', 'Keep this file private. Do not share the spreadsheet with students or publish it to the web.'],
    ['2', 'Run setupProject after each schema update. It is idempotent and preserves existing credentials and history.'],
    ['3', 'Each daily check-in, bathroom request, and return requires a fresh student PIN.'],
    ['4', 'A verified bathroom request either starts or joins the line automatically. When a slot opens, the same request advances without a second PIN or start button.'],
    ['5', 'Completed trips under 3.0 seconds remain in the private audit but do not count toward the student limit. Teacher corrections require a reason and preserve the original row.'],
    ['6', 'Pass Log is the recent operational window. Older completed rows move into permanent Pass Audit before leaving Pass Log.'],
    ['7', 'School Calendar is seeded from the official 2026-27 Drive calendar. Reduced and half days are school days; listed closures are not. Record official amendments on that tab.'],
    ['8', 'PIN Cards are private credential and delivery records. Preserve existing credentials; a reconciled address stays NEEDS_RESEND until delivery is confirmed.'],
    ['9', 'Update the existing Apps Script deployment in place. Preserve the current /exec URL, domain-only access, and execute-as-deploying-user setting.'],
    ['10', 'Student screens show only that student\'s current state and decision evidence. Names, full logs, corrections, and delivery details stay in teacher-only surfaces.'],
  ];
  sheet.getRange(1, 1).setValue('GrantDesk Hall Pass — private teacher log');
  sheet.getRange(2, 1).setValue(`Operational instructions · schema ${GD_SCHEMA_VERSION}`);
  sheet.getRange(3, 1, rows.length, 2).setValues(rows).setWrap(true).setVerticalAlignment('top');
}

function seedOfficialSchoolCalendar_() {
  const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.CALENDAR);
  const existing = new Set();
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().forEach((row) => {
      const key = normalizeDateKey_(row[0]);
      if (key) existing.add(key);
    });
  }
  const source = 'Drive: 26|27 - Student Calendar (1Gd3ZENe41b1AWRLdbpQ2kdsZj0mEsgoz)';
  const revision = 'Revised 08/14/26; verified 2026-09-02';
  const rows = GD_OFFICIAL_CALENDAR_2026_27
    .filter((entry) => !existing.has(entry[0]))
    .map((entry) => [entry[0], entry[1], entry[2], source, revision]);
  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, GD_HEADERS.CALENDAR.length).setValues(rows);
  gdForget_('school-calendar');
}

function ensureUnlimitedCheckboxes_(rosterSheet) {
  const lastRow = rosterSheet.getLastRow();
  if (lastRow < 2) return;
  const range = rosterSheet.getRange(2, 6, lastRow - 1, 1);
  const values = range.getValues();
  const normalized = values.map((row) => [isTruthyCell_(row[0], false)]);
  range.insertCheckboxes();
  range.setValues(normalized);
  gdForget_('roster');
  gdForget_('unlimited');
}

function removeLegacySettingRows_(sheet, keys) {
  if (sheet.getLastRow() < 2) return;
  const legacy = new Set(keys.map(String));
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues()
    .map((row, index) => ({ row: index + 2, key: String(row[0] || '').trim() }))
    .filter((entry) => legacy.has(entry.key))
    .map((entry) => entry.row)
    .sort((a, b) => b - a);
  rows.forEach((row) => sheet.deleteRow(row));
}

function setSettingDescription_(sheet, key, description) {
  if (sheet.getLastRow() < 2) return;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  const index = values.findIndex((row) => String(row[0] || '').trim() === key);
  if (index >= 0) sheet.getRange(index + 2, 3).setValue(description);
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  if (sheet.getLastRow() === 0 || !sheet.getRange(1, 1).getValue()) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#eeeeee')
      .setFontWeight('bold')
      .setFontColor('#202127');
    return sheet;
  }
  const existing = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  headers.forEach((header, index) => {
    if (!String(existing[index] || '').trim()) {
      sheet.getRange(1, index + 1)
        .setValue(header)
        .setBackground('#eeeeee')
        .setFontWeight('bold')
        .setFontColor('#202127');
    }
  });
  return sheet;
}
