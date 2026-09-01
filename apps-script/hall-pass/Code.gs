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

const GD_SCHEMA_VERSION = '2026-09-01-a';

const GD_SHEETS = {
  ROSTER: 'Roster',
  LOG: 'Pass Log',
  CHECKINS: 'Daily Check-ins',
  QUEUE: 'Pass Queue',
  SETTINGS: 'Settings',
  PINS: 'PIN Cards',
  UNMATCHED: 'Unmatched Sign-ins',
};

const GD_HEADERS = {
  ROSTER: ['Student Email', 'Student Name', 'Class / Period', 'PIN Hash', 'Active', 'Unlimited Passes'],
  LOG: ['Pass ID', 'Student Email', 'Student Name', 'Class / Period', 'Destination', 'Out Time', 'Return Time', 'Minutes Out', 'Method', 'Status', 'Ended By', 'Note'],
  CHECKINS: ['Check-in ID', 'Date', 'Check-in Time', 'Student Email', 'Student Name', 'Class / Period', 'Method', 'Point', 'Status', 'Note'],
  QUEUE: ['Queue ID', 'Student Email', 'Student Name', 'Class / Period', 'Joined At', 'Status', 'Resolved At', 'Resolution'],
  SETTINGS: ['Key', 'Value', 'What it controls'],
  PINS: ['Student Email', 'Student Name', 'Class / Period', 'PIN', 'Generated At', 'Email Status', 'Emailed At', 'Email Detail'],
  UNMATCHED: ['Signed-in Address', 'First Seen', 'Last Seen', 'Times Seen', 'Likely Match', 'Status', 'Note'],
};

const GD_DEFAULT_SETTINGS = [
  ['TEACHER_EMAILS', 'gauch@mtmorrisschools.org', 'Comma-separated staff allowed to open teacher mode'],
  ['SCHOOL_DOMAIN', 'mtmorrisschools.org', 'Only signed-in accounts from this Google Workspace domain may load the app'],
  ['MAX_ACTIVE_PASSES', '1', 'How many students may be out at once'],
  ['STUDENT_PASS_LIMIT', '0', 'Passes allowed per student until the teacher starts a new marking period; 0 means unlimited'],
  ['STUDENT_PASS_RESET_AT', '', 'Timestamp of the teacher-controlled marking-period reset'],
  ['QUEUE_CLAIM_MINUTES', '3', 'How long the student at the front of the line has to start the pass before the line moves on'],
  ['QUEUE_MAX_WAIT_MINUTES', '20', 'A waiting-line entry older than this is dropped so it never carries into the next hour'],
  ['LATE_AFTER_MINUTES', '10', 'When an active pass is highlighted for the teacher'],
  ['STALE_PASS_MINUTES', '20', 'When an active pass gets a stronger teacher follow-up warning'],
  ['RETENTION_DAYS', '180', 'Returned passes older than this are removed by the daily cleanup'],
  ['DESTINATION', 'Restroom', 'Student-facing destination label'],
  ['APP_TITLE', 'Mr. Grant’s Hall Pass', 'Name shown at the top of the pass app'],
  ['CHECKIN_POINT_VALUE', '1', 'Extra-credit points recorded for one daily check-in'],
  ['STUDENT_EMAIL_DOMAIN', 'students.mtmorrisschools.org', 'Only roster addresses at this domain receive PIN emails'],
  ['PIN_EMAIL_SUBJECT', 'Your private GrantDesk PIN', 'Subject line for student PIN emails'],
  ['CHECKIN_URL', 'https://grant-desk.com/check-in/', 'Student link included in PIN emails'],
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
    .addItem('Run privacy cleanup now', 'purgeOldPasses')
    .addToUi();
}

function setupProject() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('Open this script from the GrantDesk Hall Pass spreadsheet.');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', active.getId());
  ensureSalt_();
  setupWorkbook_();
  assertTeacher_(getActiveEmail_(), getSettings_());
  installCleanupTrigger_();
  SpreadsheetApp.getUi().alert(
    'GrantDesk Pass is ready',
    'Paste students into the Roster tab, then use GrantDesk Pass → Generate missing student PINs.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
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
  return purpose === 'checkin'
    ? getCheckInState_(students[0], '', 'google')
    : getStudentState_(students[0], '', 'google');
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

  if (students.length > 1) {
    const token = putPinSession_(Utilities.getUuid().replace(/-/g, ''), emails[0], '', 'pin');
    return buildClassSelectionState_(students, token, 'pin', purpose);
  }
  const token = putPinSession_(Utilities.getUuid().replace(/-/g, ''), emails[0], students[0].key, 'pin');
  return purpose === 'checkin'
    ? getCheckInState_(students[0], token, 'pin')
    : getStudentState_(students[0], token, 'pin');
}

function putPinSession_(token, email, key, method) {
  const issuedAt = Date.now();
  const body = encodeTokenPart_(JSON.stringify({
    v: 1,
    nonce: String(token || '').slice(0, 80),
    email: normalizeEmail_(email),
    key: key || '',
    method: method === 'google' ? 'google' : 'pin',
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
      if (signTokenPart_(parts[0]) !== parts[1]) throw new Error('Bad signature');
      const session = JSON.parse(decodeTokenPart_(parts[0]));
      if (!session.exp || Number(session.exp) < Date.now()) throw new Error('Expired token');
      return {
        email: normalizeEmail_(session.email),
        key: String(session.key || ''),
        method: session.method === 'google' ? 'google' : 'pin',
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

function createClassSelectionState_(students, method, purpose) {
  const token = putPinSession_(Utilities.getUuid().replace(/-/g, ''), students[0].email, '', method);
  return buildClassSelectionState_(students, token, method, purpose);
}

function buildClassSelectionState_(students, token, method, purpose) {
  const settings = getSettings_();
  return {
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
}

function selectStudentClass(pinToken, studentKey, purpose) {
  const session = readPinSession_(pinToken);
  const student = getStudentByKey_(studentKey);
  if (!student || student.email !== normalizeEmail_(session.email)) {
    throw new Error('Choose one of your own active classes.');
  }
  const method = session.method === 'google' ? 'google' : 'pin';
  const nextToken = putPinSession_(pinToken, student.email, student.key, method);
  return purpose === 'checkin'
    ? getCheckInState_(student, nextToken, method)
    : getStudentState_(student, nextToken, method);
}

function resolveStudent_(pinToken) {
  if (pinToken) {
    const session = readPinSession_(pinToken);
    if (!session.key) throw new Error('Choose your class before continuing.');
    const student = getStudentByKey_(session.key);
    if (!student) throw new Error('That student is no longer active on the roster.');
    if (student.email !== normalizeEmail_(session.email)) throw new Error('That class selection is no longer valid.');
    return { student, method: session.method === 'google' ? 'google' : 'pin' };
  }
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

/* ------------------------------------------------------------- check-in ---- */

function refreshCheckInState(pinToken) {
  const resolved = resolveStudent_(pinToken);
  return getCheckInState_(resolved.student, pinToken || '', resolved.method);
}

function submitDailyCheckIn(pinToken) {
  const resolved = resolveStudent_(pinToken);
  withLock_(() => recordCheckIn_(resolved.student, resolved.method, ''));
  return getCheckInState_(resolved.student, pinToken || '', resolved.method);
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
  return {
    ok: true,
    mode: 'checkin',
    recognized: true,
    appTitle: 'Daily Check-in',
    student: { name: student.name, classPeriod: student.classPeriod },
    pinToken: pinToken || '',
    method,
    dateKey: todayKey,
    pointValue: numberSetting_(settings, 'CHECKIN_POINT_VALUE', 1),
    checkedIn: Boolean(checkIn),
    checkIn: checkIn ? clientCheckIn_(checkIn) : null,
    streak: buildStreakIndex_(allCheckIns).streakFor(student.key, todayKey),
    serverNow: new Date().toISOString(),
  };
}

function recordCheckIn_(student, method, note) {
  const todayKey = dateKey_(new Date());
  const existing = readCheckIns_().find((entry) => (
    entry.dateKey === todayKey &&
    entry.studentKey === student.key &&
    entry.status === 'CHECKED_IN'
  ));
  if (existing) return existing;

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

/* ----------------------------------------------------------- hall pass ---- */

function refreshStudentState(pinToken) {
  const resolved = resolveStudent_(pinToken);
  return getStudentState_(resolved.student, pinToken || '', resolved.method);
}

function joinPassQueue(pinToken) {
  const resolved = resolveStudent_(pinToken);
  withLock_(() => {
    const student = resolved.student;
    const snapshot = getPassSnapshot_();
    reapExpiredQueue_(snapshot.expiredQueue);
    if (snapshot.active.some((pass) => pass.studentEmail === student.email)) return;
    if (snapshot.queue.some((entry) => entry.studentEmail === student.email)) return;

    const allowance = getStudentPassAllowance_(student.email, snapshot.settings, snapshot.log);
    if (allowance.limitReached) throw new Error(allowanceMessage_(allowance));

    getSpreadsheet_().getSheetByName(GD_SHEETS.QUEUE).appendRow([
      Utilities.getUuid(), student.email, student.name, student.classPeriod,
      new Date(), 'WAITING', '', '',
    ]);
    gdForget_('queue');
  });
  return getStudentState_(resolved.student, pinToken || '', resolved.method);
}

function leavePassQueue(pinToken) {
  const resolved = resolveStudent_(pinToken);
  withLock_(() => closeWaitingQueueForEmail_(resolved.student.email, 'CANCELLED', 'Student left the line'));
  return getStudentState_(resolved.student, pinToken || '', resolved.method);
}

function startPass(pinToken) {
  const resolved = resolveStudent_(pinToken);
  withLock_(() => {
    const student = resolved.student;
    const snapshot = getPassSnapshot_();
    reapExpiredQueue_(snapshot.expiredQueue);
    if (snapshot.active.some((pass) => pass.studentEmail === student.email)) return;

    const allowance = getStudentPassAllowance_(student.email, snapshot.settings, snapshot.log);
    if (allowance.limitReached) throw new Error(allowanceMessage_(allowance));
    if (!snapshot.openSlots) throw new Error('The pass is in use right now. Join the line to save your place.');

    const queue = snapshot.queue;
    const ownQueueIndex = queue.findIndex((entry) => entry.studentEmail === student.email);
    if (queue.length && (ownQueueIndex < 0 || ownQueueIndex >= snapshot.openSlots)) {
      const position = ownQueueIndex < 0 ? queue.length + 1 : ownQueueIndex + 1;
      throw new Error(`Please wait for your turn. Your place in line is #${position}.`);
    }

    getSpreadsheet_().getSheetByName(GD_SHEETS.LOG).appendRow([
      Utilities.getUuid(),
      student.email,
      student.name,
      student.classPeriod,
      snapshot.settings.DESTINATION,
      new Date(),
      '',
      '',
      resolved.method,
      'OUT',
      '',
      '',
    ]);
    gdForget_('passlog');
    if (ownQueueIndex >= 0) closeQueueRow_(queue[ownQueueIndex].row, 'STARTED', 'Pass started');
  });
  return getStudentState_(resolved.student, pinToken || '', resolved.method);
}

function returnPass(pinToken) {
  const resolved = resolveStudent_(pinToken);
  withLock_(() => closePassForStudent_(resolved.student.email, resolved.student.email, ''));
  return getStudentState_(resolved.student, pinToken || '', resolved.method);
}

function getStudentState_(student, pinToken, method) {
  const snapshot = getPassSnapshot_();
  const settings = snapshot.settings;
  const ownPass = snapshot.active.find((pass) => pass.studentEmail === student.email) || null;
  const queue = snapshot.queue;
  const queueIndex = queue.findIndex((entry) => entry.studentEmail === student.email);
  const allowance = getStudentPassAllowance_(student.email, settings, snapshot.log);
  const openSlots = snapshot.openSlots;
  const passAvailable = Boolean(ownPass) || (!allowance.limitReached && (
    queueIndex >= 0 ? queueIndex < openSlots : queue.length === 0 && openSlots > 0
  ));
  return {
    ok: true,
    mode: 'student',
    recognized: true,
    appTitle: settings.APP_TITLE,
    destination: settings.DESTINATION,
    student: { name: student.name, classPeriod: student.classPeriod },
    pinToken: pinToken || '',
    method,
    ownPass: ownPass ? clientPass_(ownPass) : null,
    passAvailable,
    queuePosition: queueIndex >= 0 ? queueIndex + 1 : 0,
    queueLength: queue.length,
    queuedAt: queueIndex >= 0 ? isoOrEmpty_(queue[queueIndex].joinedAt) : '',
    claimMinutes: Math.max(1, numberSetting_(settings, 'QUEUE_CLAIM_MINUTES', 3)),
    canJoinQueue: !ownPass && queueIndex < 0 && !allowance.limitReached,
    passAllowance: studentAllowanceView_(allowance),
    lateAfterMinutes: numberSetting_(settings, 'LATE_AFTER_MINUTES', 10),
    serverNow: new Date().toISOString(),
  };
}

function getPassSnapshot_() {
  const settings = getSettings_();
  const log = readPassLog_();
  const active = log.filter((pass) => pass.status === 'OUT');
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

/**
 * Waiting line, oldest first, with two safety valves so one student can never
 * stall the line for the rest of the hour:
 *  - the students currently entitled to go have a limited window to press start
 *  - any entry older than the maximum wait is dropped
 */
function readWaitingQueue_(settings, openSlots) {
  const claimMs = Math.max(1, numberSetting_(settings, 'QUEUE_CLAIM_MINUTES', 3)) * 60000;
  const maxWaitMs = Math.max(1, numberSetting_(settings, 'QUEUE_MAX_WAIT_MINUTES', 20)) * 60000;
  const now = Date.now();
  const entries = readPassQueue_()
    .filter((entry) => entry.status === 'WAITING')
    .sort((a, b) => a.joinedAt - b.joinedAt || a.row - b.row);

  const live = [];
  const expired = [];
  let eligible = 0;
  entries.forEach((entry) => {
    if (now - entry.joinedAt.getTime() > maxWaitMs) {
      expired.push({ row: entry.row, resolution: 'Waited past the maximum line time' });
      return;
    }
    if (eligible < openSlots) {
      const stored = getQueueTurnStarted_(entry.queueId);
      const since = stored > 0 ? stored : now;
      if (!stored) setQueueTurnStarted_(entry.queueId, now);
      if (now - since > claimMs) {
        expired.push({ row: entry.row, resolution: 'Did not start the pass during their turn' });
        return;
      }
      entry.isTurn = true;
      eligible += 1;
    }
    live.push(entry);
  });
  return { live, expired };
}

function reapExpiredQueue_(expired) {
  if (!expired || !expired.length) return;
  expired.forEach((item) => closeQueueRow_(item.row, 'EXPIRED', item.resolution));
}

function closePassForStudent_(studentEmail, endedBy, note) {
  const pass = readPassLog_().find((item) => (
    item.status === 'OUT' && item.studentEmail === normalizeEmail_(studentEmail)
  ));
  if (!pass) return;
  closePassRow_(pass.row, endedBy, note);
}

function closePassById_(passId, endedBy, note) {
  const pass = readPassLog_().find((item) => item.status === 'OUT' && item.passId === passId);
  if (!pass) throw new Error('That pass is no longer active.');
  closePassRow_(pass.row, endedBy, note);
}

function closePassRow_(row, endedBy, note) {
  const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.LOG);
  const outTime = sheet.getRange(row, 6).getValue();
  const returned = new Date();
  const minutes = outTime instanceof Date && !isNaN(outTime)
    ? Math.round(((returned.getTime() - outTime.getTime()) / 60000) * 10) / 10
    : '';
  sheet.getRange(row, 7, 1, 2).setValues([[returned, minutes]]);
  sheet.getRange(row, 10, 1, 3).setValues([['RETURNED', endedBy, String(note || '').slice(0, 300)]]);
  gdForget_('passlog');
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
    resetAt: parseSettingDate_(settings.STUDENT_PASS_RESET_AT).toISOString(),
  };
}

function getStudentPassAllowance_(studentEmail, settings, log) {
  const email = normalizeEmail_(studentEmail);
  const policy = getStudentPassPolicy_(settings);
  const resetAt = new Date(policy.resetAt);
  const unlimited = getUnlimitedPassEmails_().has(email);
  const used = log.filter((pass) => (
    pass.studentEmail === email &&
    pass.outDate && !isNaN(pass.outDate) && pass.outDate.getTime() > resetAt.getTime()
  )).length;
  const capped = Boolean(policy.limit) && !unlimited;
  return {
    limit: policy.limit,
    resetAt: policy.resetAt,
    unlimited,
    used,
    remaining: capped ? Math.max(0, policy.limit - used) : null,
    limitReached: capped && used >= policy.limit,
  };
}

/**
 * What a student may see about their own allowance. The unlimited exemption is
 * a teacher setting: an exempt student's payload has to look exactly like a
 * student in a class with no limit set, so nothing in the response names the
 * exemption or lets the browser work it out.
 */
function studentAllowanceView_(allowance) {
  const capped = Boolean(allowance.limit) && !allowance.unlimited;
  return {
    capped,
    limit: capped ? allowance.limit : 0,
    used: capped ? allowance.used : 0,
    remaining: capped ? allowance.remaining : null,
    limitReached: Boolean(allowance.limitReached),
  };
}

function allowanceMessage_(allowance) {
  return `You have used all ${allowance.limit} of your passes for this marking period. Ask Mr. Grant if you need to leave the room.`;
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
    .map((student) => ({
      ...student,
      googleVerified: verified.has(student.email),
      ...getStudentPassAllowance_(student.email, settings, log),
    }))
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

  let moved = 0;
  withLock_(() => {
    const roster = getRoster_();
    const rows = roster.filter((student) => student.email === oldEmail);
    if (!rows.length) throw new Error('That student is no longer on the roster.');
    if (roster.some((student) => student.email === newEmail)) {
      throw new Error('That address already belongs to another student on the roster.');
    }
    const spreadsheet = getSpreadsheet_();
    rows.forEach((student) => {
      spreadsheet.getSheetByName(GD_SHEETS.ROSTER).getRange(student.row, 1).setValue(newEmail);
      moved += 1;
    });
    readPinCards_().filter((card) => card.studentEmail === oldEmail)
      .forEach((card) => spreadsheet.getSheetByName(GD_SHEETS.PINS).getRange(card.row, 1).setValue(newEmail));
    readCheckIns_().filter((entry) => entry.studentEmail === oldEmail)
      .forEach((entry) => spreadsheet.getSheetByName(GD_SHEETS.CHECKINS).getRange(entry.row, 4).setValue(newEmail));
    readPassLog_().filter((pass) => pass.studentEmail === oldEmail)
      .forEach((pass) => spreadsheet.getSheetByName(GD_SHEETS.LOG).getRange(pass.row, 2).setValue(newEmail));
    readPassQueue_().filter((entry) => entry.studentEmail === oldEmail)
      .forEach((entry) => spreadsheet.getSheetByName(GD_SHEETS.QUEUE).getRange(entry.row, 2).setValue(newEmail));
    const logged = readUnmatched_().find((entry) => entry.email === newEmail);
    if (logged) {
      spreadsheet.getSheetByName(GD_SHEETS.UNMATCHED).getRange(logged.row, 6, 1, 2)
        .setValues([['APPLIED', `Replaced ${oldEmail}`]]);
    }
    gdClearMemo_();
  });
  const state = getTeacherState_({ includePinStatus: true });
  state.noticeMessage = `${newEmail} now belongs to that student. ${moved} roster row${moved === 1 ? '' : 's'} updated, PIN and history moved with it.`;
  return state;
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

function teacherClearUnmatchedSignIns() {
  assertTeacher_(getActiveEmail_(), getSettings_());
  let cleared = 0;
  withLock_(() => {
    const entries = readUnmatched_().filter((entry) => entry.status !== 'APPLIED' && entry.status !== 'IGNORED');
    if (!entries.length) return;
    const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.UNMATCHED);
    entries.forEach((entry) => {
      sheet.getRange(entry.row, 6, 1, 2).setValues([['IGNORED', 'Cleared from teacher dashboard']]);
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
  assertTeacher_(getActiveEmail_(), getSettings_());
  const maxActive = Number(maxActivePasses);
  const perStudentLimit = Number(studentPassLimit);
  if (!Number.isInteger(maxActive) || maxActive < 1 || maxActive > 10) {
    throw new Error('Concurrent passes must be a whole number from 1 through 10.');
  }
  if (!Number.isInteger(perStudentLimit) || perStudentLimit < 0 || perStudentLimit > 500) {
    throw new Error('The per-student marking-period limit must be a whole number from 0 through 500. Use 0 for unlimited.');
  }
  withLock_(() => {
    setSettingValue_('MAX_ACTIVE_PASSES', String(maxActive));
    setSettingValue_('STUDENT_PASS_LIMIT', String(perStudentLimit));
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
    const student = getRoster_().find((entry) => entry.key === key) || null;
    if (!student) throw new Error('That student is no longer active in this class.');

    const activePass = readPassLog_().find((pass) => pass.status === 'OUT' && pass.studentKey === key);
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
  });
  return getTeacherState_({ includePinStatus: false });
}

function teacherStartPass(studentKey) {
  const teacher = getActiveEmail_();
  assertTeacher_(teacher, getSettings_());
  const student = getStudentByKey_(studentKey);
  if (!student) throw new Error('That student is not active on the roster.');

  withLock_(() => {
    const snapshot = getPassSnapshot_();
    reapExpiredQueue_(snapshot.expiredQueue);
    if (snapshot.active.some((pass) => pass.studentEmail === student.email)) return;
    if (!snapshot.openSlots) {
      throw new Error('Every pass slot is in use. End an active pass or raise the limit first.');
    }
    const allowance = getStudentPassAllowance_(student.email, snapshot.settings, snapshot.log);
    if (allowance.limitReached) {
      throw new Error(`${student.name} has used all ${allowance.limit} passes for this marking period. Reset the counters, raise the allowance, or mark this student unlimited.`);
    }
    getSpreadsheet_().getSheetByName(GD_SHEETS.LOG).appendRow([
      Utilities.getUuid(), student.email, student.name, student.classPeriod, snapshot.settings.DESTINATION,
      new Date(), '', '', 'teacher', 'OUT', teacher, 'Started by teacher',
    ]);
    gdForget_('passlog');
    closeWaitingQueueForEmail_(student.email, 'STARTED', 'Pass started by teacher');
  });
  return getTeacherState_({ includePinStatus: false });
}

function teacherEndPass(passId, note) {
  const teacher = getActiveEmail_();
  assertTeacher_(teacher, getSettings_());
  withLock_(() => closePassById_(String(passId || ''), teacher, String(note || '').slice(0, 300)));
  return getTeacherState_({ includePinStatus: false });
}

function teacherCheckInStudent(studentKey) {
  const teacher = getActiveEmail_();
  assertTeacher_(teacher, getSettings_());
  const student = getStudentByKey_(studentKey);
  if (!student) throw new Error('That student is not active on the roster.');
  withLock_(() => recordCheckIn_(student, 'teacher', `Recorded by ${teacher}`));
  return getTeacherState_({ includePinStatus: false });
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
  const classNames = [...new Set(roster.map((student) => student.classPeriod || 'class'))]
    .sort((a, b) => a.localeCompare(b));
  const checkInSummary = classNames.map((classPeriod) => {
    const classRoster = roster.filter((student) => (student.classPeriod || 'class') === classPeriod);
    return {
      classPeriod,
      checkedIn: classRoster.filter((student) => checkedKeys.has(student.key)).length,
      roster: classRoster.length,
    };
  });
  const today = log
    .filter((pass) => safeDateKey_(pass.outDate) === todayKey)
    .slice(-100)
    .reverse()
    .map(clientPass_);

  const state = {
    ok: true,
    mode: 'teacher',
    appTitle: settings.APP_TITLE,
    lateAfterMinutes: numberSetting_(settings, 'LATE_AFTER_MINUTES', 10),
    stalePassMinutes: numberSetting_(settings, 'STALE_PASS_MINUTES', 20),
    maxActivePasses: snapshot.maxActive,
    passPolicy: getStudentPassPolicy_(settings),
    studentPassUsage: getStudentPassUsage_(roster, settings, log, googleVerified),
    unmatchedSignIns: readUnmatched_()
      .filter((entry) => entry.status !== 'APPLIED' && entry.status !== 'IGNORED')
      .sort((a, b) => (b.lastSeen ? b.lastSeen.getTime() : 0) - (a.lastSeen ? a.lastSeen.getTime() : 0))
      .slice(0, 25)
      .map((entry) => ({
        email: entry.email,
        lastSeen: isoOrEmpty_(entry.lastSeen),
        timesSeen: entry.timesSeen,
        suggestion: suggestRosterMatch_(entry.email),
      })),
    retentionDays: numberSetting_(settings, 'RETENTION_DAYS', 180),
    queueClaimMinutes: Math.max(1, numberSetting_(settings, 'QUEUE_CLAIM_MINUTES', 3)),
    active: snapshot.active.map(clientPass_),
    queue: snapshot.queue.map((entry, index) => clientQueue_(entry, index + 1)),
    today,
    roster,
    classNames,
    checkInsToday: checkInsToday.map((checkIn) => ({
      ...clientCheckIn_(checkIn),
      streak: streaks.streakFor(checkIn.studentKey, todayKey),
    })),
    checkInSummary,
    notCheckedIn: roster.filter((student) => !checkedKeys.has(student.key)),
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

/**
 * One pass over the check-in log builds every student's weekday history, so the
 * teacher dashboard does not recompute the whole log once per student.
 */
function buildStreakIndex_(checkIns) {
  const byStudent = new Map();
  checkIns.forEach((entry) => {
    if (entry.status !== 'CHECKED_IN') return;
    if (!isWeekdayKey_(entry.dateKey)) return;
    if (!byStudent.has(entry.studentKey)) byStudent.set(entry.studentKey, new Set());
    byStudent.get(entry.studentKey).add(entry.dateKey);
  });
  return {
    streakFor(studentKey, todayKey) {
      const daySet = byStudent.get(studentKey) || new Set();
      return computeStreak_(daySet, todayKey);
    },
  };
}

function computeStreak_(daySet, todayKey) {
  const checkedInToday = daySet.has(todayKey);
  const todayIsWeekday = isWeekdayKey_(todayKey);
  const targetKey = checkedInToday && todayIsWeekday ? todayKey : previousWeekdayKey_(todayKey);

  let current = 0;
  let cursor = targetKey;
  while (daySet.has(cursor)) {
    current += 1;
    cursor = previousWeekdayKey_(cursor);
  }

  const days = [...daySet].sort();
  let best = 0;
  let run = 0;
  let previous = '';
  days.forEach((key) => {
    run = previous && nextWeekdayKey_(previous) === key ? run + 1 : 1;
    best = Math.max(best, run);
    previous = key;
  });

  return {
    current,
    best: Math.max(best, current),
    checkedInToday,
    weekendProtected: !todayIsWeekday,
    atRiskToday: todayIsWeekday && !checkedInToday && current > 0,
  };
}

function isWeekdayKey_(key) {
  const date = dateFromKey_(key);
  if (isNaN(date)) return false;
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

function previousWeekdayKey_(key) {
  let date = dateFromKey_(key);
  if (isNaN(date)) return '';
  do {
    date = new Date(date.getTime() - 86400000);
  } while ([0, 6].includes(date.getUTCDay()));
  return utcDateKey_(date);
}

function nextWeekdayKey_(key) {
  let date = dateFromKey_(key);
  if (isNaN(date)) return '';
  do {
    date = new Date(date.getTime() + 86400000);
  } while ([0, 6].includes(date.getUTCDay()));
  return utcDateKey_(date);
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
    })).filter((entry) => entry.queueId && entry.joinedAt);
  });
}

function readCheckIns_() {
  return gdMemo_('checkins', () => {
    const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.CHECKINS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    return sheet.getRange(2, 1, lastRow - 1, GD_HEADERS.CHECKINS.length).getValues().map((row, index) => ({
      row: index + 2,
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
    })).filter((checkIn) => checkIn.checkInId);
  });
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
  setupWorkbook_();
  const result = ensureOnePinPerStudent_({ createMissing: true });
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
  const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.PINS);
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, GD_HEADERS.PINS.length).clearContent();
  sheet.hideSheet();
  gdForget_('pincards');
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

function withLock_(action, waitMs) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(waitMs || 25000);
  } catch (error) {
    throw new Error('The classroom system is handling other students right now. Press the button once more.');
  }
  try {
    gdClearMemo_();
    return action();
  } finally {
    gdClearMemo_();
    lock.releaseLock();
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
    purgeOldPasses_();
    purgeOldQueue_();
    PropertiesService.getScriptProperties().setProperty('LAST_PURGE', dateKey_(new Date()));
  });
}

function purgeOldPasses() {
  assertTeacher_(getActiveEmail_(), getSettings_());
  const removed = withLock_(() => ({ passes: purgeOldPasses_(), queueRows: purgeOldQueue_() }));
  const removedPasses = removed.passes;
  const removedQueueRows = removed.queueRows;
  SpreadsheetApp.getUi().alert(`${removedPasses} old returned pass${removedPasses === 1 ? '' : 'es'} and ${removedQueueRows} resolved queue entr${removedQueueRows === 1 ? 'y' : 'ies'} removed.`);
}

function purgeIfDue_() {
  const properties = PropertiesService.getScriptProperties();
  const today = dateKey_(new Date());
  if (properties.getProperty('LAST_PURGE') === today) return;
  withLock_(() => {
    const lockedProperties = PropertiesService.getScriptProperties();
    if (lockedProperties.getProperty('LAST_PURGE') === today) return;
    purgeOldPasses_();
    purgeOldQueue_();
    lockedProperties.setProperty('LAST_PURGE', today);
  });
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
  rows.forEach((row) => sheet.deleteRow(row));
  if (rows.length) gdForget_('passlog');
  return rows.length;
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
    return;
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
  ensureSheet_(spreadsheet, GD_SHEETS.CHECKINS, GD_HEADERS.CHECKINS);
  ensureSheet_(spreadsheet, GD_SHEETS.QUEUE, GD_HEADERS.QUEUE);
  ensureSheet_(spreadsheet, GD_SHEETS.SETTINGS, GD_HEADERS.SETTINGS);
  ensureSheet_(spreadsheet, GD_SHEETS.PINS, GD_HEADERS.PINS);
  ensureSheet_(spreadsheet, GD_SHEETS.UNMATCHED, GD_HEADERS.UNMATCHED);
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
  gdForget_('settings');
  if (getSettings_().PIN_EMAIL_SUBJECT === 'Your private GrantDesk class PIN') {
    setSettingValue_('PIN_EMAIL_SUBJECT', 'Your private GrantDesk PIN');
  }

  const logSheet = spreadsheet.getSheetByName(GD_SHEETS.LOG);
  logSheet.getRange('F:G').setNumberFormat('m/d/yyyy h:mm:ss am/pm');
  logSheet.getRange('H:H').setNumberFormat('0.0');
  const checkInSheet = spreadsheet.getSheetByName(GD_SHEETS.CHECKINS);
  checkInSheet.getRange('B:B').setNumberFormat('@');
  checkInSheet.getRange('C:C').setNumberFormat('m/d/yyyy h:mm:ss am/pm');
  checkInSheet.getRange('H:H').setNumberFormat('0');
  const queueSheet = spreadsheet.getSheetByName(GD_SHEETS.QUEUE);
  queueSheet.getRange('E:G').setNumberFormat('m/d/yyyy h:mm:ss am/pm');
  const pinSheet = spreadsheet.getSheetByName(GD_SHEETS.PINS);
  pinSheet.getRange('E:E').setNumberFormat('m/d/yyyy h:mm am/pm');
  pinSheet.getRange('G:G').setNumberFormat('m/d/yyyy h:mm am/pm');
  spreadsheet.getSheetByName(GD_SHEETS.UNMATCHED).getRange('B:C').setNumberFormat('m/d/yyyy h:mm am/pm');

  ensureUnlimitedCheckboxes_(spreadsheet.getSheetByName(GD_SHEETS.ROSTER));
  ensureOnePinPerStudent_({ createMissing: false });
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
