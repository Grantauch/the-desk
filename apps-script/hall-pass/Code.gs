const GD_SHEETS = {
  ROSTER: 'Roster',
  LOG: 'Pass Log',
  CHECKINS: 'Daily Check-ins',
  QUEUE: 'Pass Queue',
  SETTINGS: 'Settings',
  PINS: 'PIN Cards',
};

const GD_HEADERS = {
  ROSTER: ['Student Email', 'Student Name', 'Class / Period', 'PIN Hash', 'Active'],
  LOG: ['Pass ID', 'Student Email', 'Student Name', 'Class / Period', 'Destination', 'Out Time', 'Return Time', 'Minutes Out', 'Method', 'Status', 'Ended By', 'Note'],
  CHECKINS: ['Check-in ID', 'Date', 'Check-in Time', 'Student Email', 'Student Name', 'Class / Period', 'Method', 'Point', 'Status', 'Note'],
  QUEUE: ['Queue ID', 'Student Email', 'Student Name', 'Class / Period', 'Joined At', 'Status', 'Resolved At', 'Resolution'],
  SETTINGS: ['Key', 'Value', 'What it controls'],
  PINS: ['Student Email', 'Student Name', 'Class / Period', 'PIN', 'Generated At', 'Email Status', 'Emailed At', 'Email Detail'],
};

const GD_DEFAULT_SETTINGS = [
  ['TEACHER_EMAILS', 'gauch@mtmorrisschools.org', 'Comma-separated staff allowed to open teacher mode'],
  ['SCHOOL_DOMAIN', 'mtmorrisschools.org', 'Only signed-in accounts from this Google Workspace domain may load the app'],
  ['MAX_ACTIVE_PASSES', '1', 'How many students may be out at once'],
  ['PASS_SESSION_LIMIT', '0', 'How many passes may start before the teacher resets the counter; 0 means unlimited'],
  ['PASS_SESSION_RESET_AT', '', 'Automatic timestamp written by the teacher reset button'],
  ['LATE_AFTER_MINUTES', '10', 'When an active pass is highlighted for the teacher'],
  ['RETENTION_DAYS', '180', 'Returned passes older than this are removed by the daily cleanup'],
  ['DESTINATION', 'Restroom', 'Student-facing destination label'],
  ['APP_TITLE', 'Mr. Grant’s Hall Pass', 'Name shown at the top of the pass app'],
  ['CHECKIN_POINT_VALUE', '1', 'Extra-credit points recorded for one daily check-in'],
  ['STUDENT_EMAIL_DOMAIN', 'students.mtmorrisschools.org', 'Only roster addresses at this domain receive PIN emails'],
  ['PIN_EMAIL_SUBJECT', 'Your private GrantDesk class PIN', 'Subject line for student PIN emails'],
  ['CHECKIN_URL', 'https://grant-desk.com/check-in/', 'Student link included in PIN emails'],
];

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

function doGet(e) {
  setupWorkbook_();
  const requestedMode = String((e && e.parameter && e.parameter.mode) || 'student').toLowerCase();
  const mode = ['student', 'kiosk', 'teacher', 'checkin'].includes(requestedMode) ? requestedMode : 'student';
  const template = HtmlService.createTemplateFromFile('Index');
  template.appMode = mode;
  return template.evaluate()
    .setTitle(mode === 'checkin' ? 'GrantDesk Daily Check-in' : 'GrantDesk Hall Pass')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getBootstrap(mode) {
  setupWorkbook_();
  purgeIfDue_();
  const settings = getSettings_();
  const activeEmail = getActiveEmail_();
  assertSchoolAccount_(activeEmail, settings);

  if (mode === 'teacher') {
    assertTeacher_(activeEmail, settings);
    return getTeacherState_();
  }

  if (mode === 'checkin') {
    const students = getStudentsByEmail_(activeEmail);
    if (students.length !== 1) {
      return {
        ok: true,
        mode: 'checkin',
        recognized: false,
        appTitle: 'Daily Check-in',
        message: students.length > 1
          ? 'You are enrolled in more than one of Mr. Grant’s classes. Use the six-digit PIN for this period.'
          : 'Your school account is signed in, but it is not on this class roster. Try your PIN or ask Mr. Grant.',
      };
    }
    return getCheckInState_(students[0], '', 'google');
  }

  if (mode === 'kiosk') {
    return {
      ok: true,
      mode: 'kiosk',
      appTitle: settings.APP_TITLE,
      destination: settings.DESTINATION,
      lateAfterMinutes: numberSetting_(settings, 'LATE_AFTER_MINUTES', 10),
    };
  }

  const students = getStudentsByEmail_(activeEmail);
  if (students.length !== 1) {
    return {
      ok: true,
      mode: 'student',
      recognized: false,
      appTitle: settings.APP_TITLE,
      destination: settings.DESTINATION,
      message: students.length > 1
        ? 'You are enrolled in more than one of Mr. Grant’s classes. Use the six-digit PIN for this period.'
        : 'Your school account is signed in, but it is not on this class roster. Try your PIN or ask Mr. Grant.',
    };
  }
  return getStudentState_(students[0], '', 'google');
}

function identifyWithPin(pin) {
  const settings = getSettings_();
  const activeEmail = getActiveEmail_();
  assertSchoolAccount_(activeEmail, settings);
  assertPinAttemptAllowed_(activeEmail);
  const cleaned = String(pin || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(cleaned)) throw new Error('Enter your six-digit PIN.');
  const student = getStudentByPinHash_(hashPin_(cleaned));
  if (!student) {
    recordFailedPinAttempt_(activeEmail);
    throw new Error('That PIN did not match an active student. Try again or ask Mr. Grant.');
  }
  clearPinAttempts_(activeEmail);

  const token = Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put(`pin:${token}`, JSON.stringify({ key: student.key }), 21600);
  return getStudentState_(student, token, 'pin');
}

function identifyCheckInWithPin(pin) {
  const settings = getSettings_();
  const activeEmail = getActiveEmail_();
  assertSchoolAccount_(activeEmail, settings);
  assertPinAttemptAllowed_(activeEmail);
  const cleaned = String(pin || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(cleaned)) throw new Error('Enter your six-digit PIN.');
  const student = getStudentByPinHash_(hashPin_(cleaned));
  if (!student) {
    recordFailedPinAttempt_(activeEmail);
    throw new Error('That PIN did not match an active student. Try again or ask Mr. Grant.');
  }
  clearPinAttempts_(activeEmail);

  const token = Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put(`pin:${token}`, JSON.stringify({ key: student.key }), 21600);
  return getCheckInState_(student, token, 'pin');
}

function refreshCheckInState(pinToken) {
  const resolved = resolveStudent_(pinToken);
  return getCheckInState_(resolved.student, pinToken || '', resolved.method);
}

function submitDailyCheckIn(pinToken) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const resolved = resolveStudent_(pinToken);
    recordCheckIn_(resolved.student, resolved.method, '');
    return getCheckInState_(resolved.student, pinToken || '', resolved.method);
  } finally {
    lock.releaseLock();
  }
}

function refreshStudentState(pinToken) {
  const resolved = resolveStudent_(pinToken);
  return getStudentState_(resolved.student, pinToken || '', resolved.method);
}

function joinPassQueue(pinToken) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const resolved = resolveStudent_(pinToken);
    const student = resolved.student;
    if (getActivePasses_().some((pass) => pass.studentKey === student.key)) {
      return getStudentState_(student, pinToken || '', resolved.method);
    }
    const waiting = getWaitingQueue_();
    if (!waiting.some((entry) => entry.studentKey === student.key)) {
      const session = getPassSessionState_(getSettings_(), readPassLog_());
      if (session.limitReached) {
        throw new Error('This class has reached its pass limit. Mr. Grant can reset the counter when the next pass session begins.');
      }
      getSpreadsheet_().getSheetByName(GD_SHEETS.QUEUE).appendRow([
        Utilities.getUuid(), student.email, student.name, student.classPeriod,
        new Date(), 'WAITING', '', '',
      ]);
    }
    return getStudentState_(student, pinToken || '', resolved.method);
  } finally {
    lock.releaseLock();
  }
}

function leavePassQueue(pinToken) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const resolved = resolveStudent_(pinToken);
    closeWaitingQueueForStudent_(resolved.student.key, 'CANCELLED', 'Student left the line');
    return getStudentState_(resolved.student, pinToken || '', resolved.method);
  } finally {
    lock.releaseLock();
  }
}

function startPass(pinToken) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const resolved = resolveStudent_(pinToken);
    const student = resolved.student;
    const settings = getSettings_();
    const log = readPassLog_();
    const active = log.filter((pass) => pass.status === 'OUT');
    const existing = active.find((pass) => pass.studentKey === student.key);
    if (existing) return getStudentState_(student, pinToken || '', resolved.method);

    const maxActive = numberSetting_(settings, 'MAX_ACTIVE_PASSES', 1);
    const session = getPassSessionState_(settings, log);
    if (session.limitReached) {
      throw new Error('This class has reached its pass limit. Mr. Grant can reset the counter when the next pass session begins.');
    }
    const openSlots = Math.max(0, maxActive - active.length);
    const availableStarts = session.limit ? Math.min(openSlots, session.remaining) : openSlots;
    if (!availableStarts) throw new Error('The pass is in use. Your numbered place in line is saved.');

    const waiting = getWaitingQueue_();
    const ownQueueIndex = waiting.findIndex((entry) => entry.studentKey === student.key);
    if (waiting.length && (ownQueueIndex < 0 || ownQueueIndex >= availableStarts)) {
      const position = ownQueueIndex < 0 ? waiting.length + 1 : ownQueueIndex + 1;
      throw new Error(`Please wait for your turn. Your current place in line is #${position}.`);
    }

    const now = new Date();
    getSpreadsheet_().getSheetByName(GD_SHEETS.LOG).appendRow([
      Utilities.getUuid(),
      student.email,
      student.name,
      student.classPeriod,
      settings.DESTINATION,
      now,
      '',
      '',
      resolved.method,
      'OUT',
      '',
      '',
    ]);
    if (ownQueueIndex >= 0) closeQueueRow_(waiting[ownQueueIndex].row, 'STARTED', 'Pass started');
    return getStudentState_(student, pinToken || '', resolved.method);
  } finally {
    lock.releaseLock();
  }
}

function returnPass(pinToken) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const resolved = resolveStudent_(pinToken);
    closePassForStudent_(resolved.student.key, resolved.student.email, '');
    return getStudentState_(resolved.student, pinToken || '', resolved.method);
  } finally {
    lock.releaseLock();
  }
}

function refreshTeacherState() {
  const settings = getSettings_();
  assertTeacher_(getActiveEmail_(), settings);
  return getTeacherState_();
}

function teacherSetPassLimits(maxActivePasses, sessionPassLimit) {
  const settings = getSettings_();
  assertTeacher_(getActiveEmail_(), settings);
  const maxActive = Number(maxActivePasses);
  const sessionLimit = Number(sessionPassLimit);
  if (!Number.isInteger(maxActive) || maxActive < 1 || maxActive > 10) {
    throw new Error('Concurrent passes must be a whole number from 1 through 10.');
  }
  if (!Number.isInteger(sessionLimit) || sessionLimit < 0 || sessionLimit > 500) {
    throw new Error('The pass-session limit must be a whole number from 0 through 500. Use 0 for unlimited.');
  }
  setSettingValue_('MAX_ACTIVE_PASSES', String(maxActive));
  setSettingValue_('PASS_SESSION_LIMIT', String(sessionLimit));
  return getTeacherState_();
}

function teacherResetPassSession() {
  const settings = getSettings_();
  const teacher = getActiveEmail_();
  assertTeacher_(teacher, settings);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    setSettingValue_('PASS_SESSION_RESET_AT', new Date().toISOString());
    cancelAllWaitingQueue_(`Pass session reset by ${teacher}`);
    return getTeacherState_();
  } finally {
    lock.releaseLock();
  }
}

function teacherRemoveFromQueue(queueId) {
  const settings = getSettings_();
  const teacher = getActiveEmail_();
  assertTeacher_(teacher, settings);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const entry = getWaitingQueue_().find((item) => item.queueId === String(queueId || ''));
    if (entry) closeQueueRow_(entry.row, 'REMOVED', `Removed by ${teacher}`);
    return getTeacherState_();
  } finally {
    lock.releaseLock();
  }
}

function teacherStartPass(studentKey) {
  const settings = getSettings_();
  const teacher = getActiveEmail_();
  assertTeacher_(teacher, settings);
  const student = getStudentByKey_(studentKey);
  if (!student) throw new Error('That student is not active on the roster.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const log = readPassLog_();
    const active = log.filter((pass) => pass.status === 'OUT');
    if (active.some((pass) => pass.studentKey === student.key)) return getTeacherState_();
    if (active.length >= numberSetting_(settings, 'MAX_ACTIVE_PASSES', 1)) {
      throw new Error('The pass is already in use. End the active pass before starting another.');
    }
    const session = getPassSessionState_(settings, log);
    if (session.limitReached) {
      throw new Error('The current pass-session limit has been reached. Reset the pass counter before starting another.');
    }
    getSpreadsheet_().getSheetByName(GD_SHEETS.LOG).appendRow([
      Utilities.getUuid(), student.email, student.name, student.classPeriod, settings.DESTINATION,
      new Date(), '', '', 'teacher', 'OUT', teacher, 'Started by teacher',
    ]);
    closeWaitingQueueForStudent_(student.key, 'STARTED', 'Pass started by teacher');
    return getTeacherState_();
  } finally {
    lock.releaseLock();
  }
}

function teacherEndPass(passId, note) {
  const settings = getSettings_();
  const teacher = getActiveEmail_();
  assertTeacher_(teacher, settings);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    closePassById_(String(passId || ''), teacher, String(note || '').slice(0, 300));
    return getTeacherState_();
  } finally {
    lock.releaseLock();
  }
}

function teacherCheckInStudent(studentKey) {
  const settings = getSettings_();
  const teacher = getActiveEmail_();
  assertTeacher_(teacher, settings);
  const student = getStudentByKey_(studentKey);
  if (!student) throw new Error('That student is not active on the roster.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    recordCheckIn_(student, 'teacher', `Recorded by ${teacher}`);
    return getTeacherState_();
  } finally {
    lock.releaseLock();
  }
}

function getTeacherState_() {
  const settings = getSettings_();
  const roster = getRoster_().map((student) => ({
    key: student.key,
    email: student.email,
    name: student.name,
    classPeriod: student.classPeriod,
  }));
  const log = readPassLog_();
  const active = log.filter((pass) => pass.status === 'OUT');
  const queue = getWaitingQueue_();
  const passSession = getPassSessionState_(settings, log);
  const todayKey = dateKey_(new Date());
  const allCheckIns = readCheckIns_();
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
    .filter((pass) => dateKey_(pass.outDate) === todayKey)
    .slice(-100)
    .reverse()
    .map(clientPass_);
  return {
    ok: true,
    mode: 'teacher',
    appTitle: settings.APP_TITLE,
    lateAfterMinutes: numberSetting_(settings, 'LATE_AFTER_MINUTES', 10),
    maxActivePasses: numberSetting_(settings, 'MAX_ACTIVE_PASSES', 1),
    passSession,
    retentionDays: numberSetting_(settings, 'RETENTION_DAYS', 180),
    active: active.map(clientPass_),
    queue: queue.map((entry, index) => clientQueue_(entry, index + 1)),
    today,
    roster,
    checkInsToday: checkInsToday.map((checkIn) => ({
      ...clientCheckIn_(checkIn),
      streak: calculateCheckInStreak_(checkIn.studentKey, allCheckIns, todayKey),
    })),
    checkInSummary,
    notCheckedIn: roster.filter((student) => !checkedKeys.has(student.key)),
    pinEmailStatus: getPinEmailStatus_(),
  };
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
    streak: calculateCheckInStreak_(student.key, allCheckIns, todayKey),
  };
}

function getStudentState_(student, pinToken, method) {
  const settings = getSettings_();
  const log = readPassLog_();
  const active = log.filter((pass) => pass.status === 'OUT');
  const ownPass = active.find((pass) => pass.studentKey === student.key);
  const waiting = getWaitingQueue_();
  const queueIndex = waiting.findIndex((entry) => entry.studentKey === student.key);
  const maxActive = numberSetting_(settings, 'MAX_ACTIVE_PASSES', 1);
  const passSession = getPassSessionState_(settings, log);
  const openSlots = Math.max(0, maxActive - active.length);
  const remainingStarts = passSession.limit ? passSession.remaining : openSlots;
  const usableSlots = Math.min(openSlots, remainingStarts);
  const passAvailable = Boolean(ownPass) || (!passSession.limitReached && (
    queueIndex >= 0 ? queueIndex < usableSlots : waiting.length === 0 && usableSlots > 0
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
    queueLength: waiting.length,
    queuedAt: queueIndex >= 0 ? clientQueue_(waiting[queueIndex], queueIndex + 1).joinedAt : '',
    canJoinQueue: !ownPass && queueIndex < 0 && !passSession.limitReached,
    passSession,
    lateAfterMinutes: numberSetting_(settings, 'LATE_AFTER_MINUTES', 10),
  };
}

function resolveStudent_(pinToken) {
  if (pinToken) {
    const cached = CacheService.getScriptCache().get(`pin:${pinToken}`);
    if (!cached) throw new Error('That PIN session expired. Enter your PIN again.');
    const student = getStudentByKey_(JSON.parse(cached).key);
    if (!student) throw new Error('That student is no longer active on the roster.');
    return { student, method: 'pin' };
  }
  const settings = getSettings_();
  const email = getActiveEmail_();
  assertSchoolAccount_(email, settings);
  const students = getStudentsByEmail_(email);
  if (students.length !== 1) {
    throw new Error(students.length > 1
      ? 'Use the six-digit PIN for this class.'
      : 'Your school account is not on the active roster. Use your PIN or ask Mr. Grant.');
  }
  return { student: students[0], method: 'google' };
}

function closePassForStudent_(studentKey, endedBy, note) {
  const active = getActivePasses_();
  const pass = active.find((item) => item.studentKey === studentKey);
  if (!pass) return;
  closePassRow_(pass.row, endedBy, note);
}

function closePassById_(passId, endedBy, note) {
  const pass = getActivePasses_().find((item) => item.passId === passId);
  if (!pass) throw new Error('That pass is no longer active.');
  closePassRow_(pass.row, endedBy, note);
}

function closePassRow_(row, endedBy, note) {
  const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.LOG);
  const outTime = sheet.getRange(row, 6).getValue();
  const returned = new Date();
  const minutes = outTime instanceof Date ? Math.round(((returned.getTime() - outTime.getTime()) / 60000) * 10) / 10 : '';
  sheet.getRange(row, 7, 1, 6).setValues([[
    returned,
    minutes,
    sheet.getRange(row, 9).getValue(),
    'RETURNED',
    endedBy,
    note || '',
  ]]);
}

function getActivePasses_() {
  return readPassLog_().filter((pass) => pass.status === 'OUT');
}

function getWaitingQueue_() {
  return readPassQueue_()
    .filter((entry) => entry.status === 'WAITING')
    .sort((a, b) => a.joinedAt - b.joinedAt || a.row - b.row);
}

function readPassQueue_() {
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
    joinedAt: row[4] instanceof Date ? row[4] : new Date(row[4]),
    status: String(row[5] || ''),
    resolvedAt: row[6] instanceof Date ? row[6] : (row[6] ? new Date(row[6]) : null),
    resolution: String(row[7] || ''),
  })).filter((entry) => entry.queueId && entry.joinedAt && !isNaN(entry.joinedAt));
}

function clientQueue_(entry, position) {
  return {
    queueId: entry.queueId,
    studentName: entry.studentName,
    classPeriod: entry.classPeriod,
    studentKey: entry.studentKey,
    joinedAt: entry.joinedAt && !isNaN(entry.joinedAt) ? entry.joinedAt.toISOString() : '',
    position,
  };
}

function closeWaitingQueueForStudent_(studentKey, status, resolution) {
  getWaitingQueue_()
    .filter((entry) => entry.studentKey === studentKey)
    .forEach((entry) => closeQueueRow_(entry.row, status, resolution));
}

function closeQueueRow_(row, status, resolution) {
  getSpreadsheet_().getSheetByName(GD_SHEETS.QUEUE).getRange(row, 6, 1, 3).setValues([[
    status,
    new Date(),
    String(resolution || '').slice(0, 300),
  ]]);
}

function cancelAllWaitingQueue_(resolution) {
  getWaitingQueue_().forEach((entry) => closeQueueRow_(entry.row, 'RESET', resolution));
}

function getPassSessionState_(settings, log) {
  const todayStart = schoolDayStart_();
  const configuredReset = new Date(String(settings.PASS_SESSION_RESET_AT || ''));
  const resetAt = configuredReset instanceof Date && !isNaN(configuredReset) && configuredReset > todayStart
    ? configuredReset
    : todayStart;
  const limit = numberSetting_(settings, 'PASS_SESSION_LIMIT', 0);
  const used = log.filter((pass) => pass.outDate && !isNaN(pass.outDate) && pass.outDate >= resetAt).length;
  return {
    limit,
    used,
    remaining: limit ? Math.max(0, limit - used) : null,
    limitReached: Boolean(limit && used >= limit),
    resetAt: resetAt.toISOString(),
  };
}

function schoolDayStart_() {
  return Utilities.parseDate(
    `${dateKey_(new Date())} 00:00:00`,
    Session.getScriptTimeZone(),
    'yyyy-MM-dd HH:mm:ss'
  );
}

function readPassLog_() {
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
    outDate: row[5] instanceof Date ? row[5] : new Date(row[5]),
    returnDate: row[6] instanceof Date ? row[6] : (row[6] ? new Date(row[6]) : null),
    minutesOut: row[7] === '' ? null : Number(row[7]),
    method: String(row[8] || ''),
    status: String(row[9] || ''),
    endedBy: String(row[10] || ''),
    note: String(row[11] || ''),
  })).filter((pass) => pass.passId);
}

function clientPass_(pass) {
  return {
    passId: pass.passId,
    studentEmail: pass.studentEmail,
    studentName: pass.studentName,
    classPeriod: pass.classPeriod,
    studentKey: pass.studentKey,
    destination: pass.destination,
    outTime: pass.outDate && !isNaN(pass.outDate) ? pass.outDate.toISOString() : '',
    returnTime: pass.returnDate && !isNaN(pass.returnDate) ? pass.returnDate.toISOString() : '',
    minutesOut: pass.minutesOut,
    method: pass.method,
    status: pass.status,
    endedBy: pass.endedBy,
    note: pass.note,
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

  const now = new Date();
  const settings = getSettings_();
  const row = [
    Utilities.getUuid(),
    todayKey,
    now,
    student.email,
    student.name,
    student.classPeriod,
    method,
    numberSetting_(settings, 'CHECKIN_POINT_VALUE', 1),
    'CHECKED_IN',
    String(note || '').slice(0, 300),
  ];
  getSpreadsheet_().getSheetByName(GD_SHEETS.CHECKINS).appendRow(row);
  return {
    row: getSpreadsheet_().getSheetByName(GD_SHEETS.CHECKINS).getLastRow(),
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

function readCheckIns_() {
  const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.CHECKINS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, GD_HEADERS.CHECKINS.length).getValues().map((row, index) => ({
    row: index + 2,
    checkInId: String(row[0] || ''),
    dateKey: String(row[1] || ''),
    checkInTime: row[2] instanceof Date ? row[2] : new Date(row[2]),
    studentEmail: normalizeEmail_(row[3]),
    studentName: String(row[4] || ''),
    classPeriod: String(row[5] || ''),
    studentKey: rosterKey_(row[3], row[5]),
    method: String(row[6] || ''),
    point: Number(row[7] || 0),
    status: String(row[8] || ''),
    note: String(row[9] || ''),
  })).filter((checkIn) => checkIn.checkInId);
}

function clientCheckIn_(checkIn) {
  return {
    checkInId: checkIn.checkInId,
    dateKey: checkIn.dateKey,
    checkInTime: checkIn.checkInTime && !isNaN(checkIn.checkInTime) ? checkIn.checkInTime.toISOString() : '',
    studentEmail: checkIn.studentEmail,
    studentName: checkIn.studentName,
    classPeriod: checkIn.classPeriod,
    studentKey: checkIn.studentKey,
    method: checkIn.method,
    point: checkIn.point,
    status: checkIn.status,
  };
}

function calculateCheckInStreak_(studentKey, checkIns, todayKey) {
  const days = [...new Set(checkIns
    .filter((entry) => entry.studentKey === studentKey && entry.status === 'CHECKED_IN' && isWeekdayKey_(entry.dateKey))
    .map((entry) => entry.dateKey))]
    .sort();
  const daySet = new Set(days);
  const checkedInToday = daySet.has(todayKey);
  const targetKey = checkedInToday && isWeekdayKey_(todayKey)
    ? todayKey
    : previousWeekdayKey_(todayKey);

  let current = 0;
  if (daySet.has(targetKey)) {
    let cursor = targetKey;
    while (daySet.has(cursor)) {
      current += 1;
      cursor = previousWeekdayKey_(cursor);
    }
  }

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
    best,
    checkedInToday,
    weekendProtected: !isWeekdayKey_(todayKey),
    atRiskToday: isWeekdayKey_(todayKey) && !checkedInToday && current > 0,
  };
}

function isWeekdayKey_(key) {
  const date = dateFromKey_(key);
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

function previousWeekdayKey_(key) {
  let date = dateFromKey_(key);
  do {
    date = new Date(date.getTime() - 86400000);
  } while ([0, 6].includes(date.getUTCDay()));
  return utcDateKey_(date);
}

function nextWeekdayKey_(key) {
  let date = dateFromKey_(key);
  do {
    date = new Date(date.getTime() + 86400000);
  } while ([0, 6].includes(date.getUTCDay()));
  return utcDateKey_(date);
}

function dateFromKey_(key) {
  const parts = String(key || '').split('-').map(Number);
  return new Date(Date.UTC(parts[0] || 1970, (parts[1] || 1) - 1, parts[2] || 1, 12));
}

function utcDateKey_(date) {
  return Utilities.formatDate(date, 'UTC', 'yyyy-MM-dd');
}

function getRoster_() {
  const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.ROSTER);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, GD_HEADERS.ROSTER.length).getValues()
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
        active: row[4] === true || !['false', 'no', 'inactive', '0'].includes(String(row[4] || '').toLowerCase()),
      };
    })
    .filter((student) => student.email && student.name && student.active);
}

function getStudentByEmail_(email) {
  const matches = getStudentsByEmail_(email);
  return matches.length === 1 ? matches[0] : null;
}

function getStudentsByEmail_(email) {
  const normalized = normalizeEmail_(email);
  return getRoster_().filter((student) => student.email === normalized);
}

function getStudentByKey_(key) {
  return getRoster_().find((student) => student.key === String(key || '')) || null;
}

function getStudentByPinHash_(pinHash) {
  return getRoster_().find((student) => student.pinHash && student.pinHash === pinHash) || null;
}

function generateMissingPins() {
  setupWorkbook_();
  assertTeacher_(getActiveEmail_(), getSettings_());
  const rosterSheet = getSpreadsheet_().getSheetByName(GD_SHEETS.ROSTER);
  const pinSheet = getSpreadsheet_().getSheetByName(GD_SHEETS.PINS);
  const roster = getRoster_();
  const usedHashes = new Set(roster.map((student) => student.pinHash).filter(Boolean));
  const cards = [];
  roster.forEach((student) => {
    if (student.pinHash) return;
    let pin;
    let pinHash;
    do {
      pin = String(Math.floor(100000 + Math.random() * 900000));
      pinHash = hashPin_(pin);
    } while (usedHashes.has(pinHash));
    usedHashes.add(pinHash);
    rosterSheet.getRange(student.row, 4).setValue(pinHash);
    if (rosterSheet.getRange(student.row, 5).isBlank()) rosterSheet.getRange(student.row, 5).setValue(true);
    cards.push([student.email, student.name, student.classPeriod, pin, new Date()]);
  });
  if (cards.length) {
    pinSheet.showSheet();
    pinSheet.getRange(pinSheet.getLastRow() + 1, 1, cards.length, cards[0].length).setValues(cards);
  }
  SpreadsheetApp.getUi().alert(
    cards.length ? `${cards.length} PIN card${cards.length === 1 ? '' : 's'} created` : 'No new PINs were needed',
    cards.length ? 'Print or distribute the PIN Cards tab, then clear it from the GrantDesk Pass menu.' : 'Every active roster row already has a PIN hash.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function previewStudentPinEmails() {
  setupWorkbook_();
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
      'Period 1 — C US History A: 123456',
      '',
      `Open ${settings.CHECKIN_URL} for Daily Check-in and Hall Pass. Keep this PIN private.`,
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
      `${preview.readyMemberships} class PIN${preview.readyMemberships === 1 ? '' : 's'} included`,
      `${preview.sentMemberships} class PIN${preview.sentMemberships === 1 ? '' : 's'} already marked sent`,
      `${preview.missingMemberships} active roster row${preview.missingMemberships === 1 ? '' : 's'} missing a printable PIN`,
      `${preview.invalidDomainMemberships} roster address${preview.invalidDomainMemberships === 1 ? '' : 'es'} outside the student domain`,
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
  const state = sendStudentPinEmails(response.getResponseText());
  const result = state.emailResult;
  ui.alert(
    'PIN email batch finished',
    `${result.sentRecipients} student email${result.sentRecipients === 1 ? '' : 's'} sent; ${result.sentMemberships} class PIN${result.sentMemberships === 1 ? '' : 's'} delivered; ${result.failedRecipients} recipient${result.failedRecipients === 1 ? '' : 's'} failed.`,
    ui.ButtonSet.OK
  );
}

function sendStudentPinEmails(confirmText) {
  setupWorkbook_();
  const settings = getSettings_();
  const teacher = getActiveEmail_();
  assertTeacher_(teacher, settings);
  if (String(confirmText || '').trim() !== 'EMAIL PINS') {
    throw new Error('No messages were sent. Type EMAIL PINS exactly to confirm the batch.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const delivery = buildPinEmailGroups_();
    const groups = delivery.readyGroups;
    const quota = MailApp.getRemainingDailyQuota();
    if (!groups.length) {
      const state = getTeacherState_();
      state.emailResult = { sentRecipients: 0, sentMemberships: 0, failedRecipients: 0, message: 'No unsent PIN emails were ready.' };
      return state;
    }
    if (quota < groups.length) {
      throw new Error(`No messages were sent. ${groups.length} recipients are ready, but today’s remaining mail quota is ${quota}.`);
    }

    let sentRecipients = 0;
    let sentMemberships = 0;
    let failedRecipients = 0;
    const failures = [];
    groups.forEach((group) => {
      try {
        MailApp.sendEmail(buildPinEmailMessage_(group, settings, teacher));
        markPinEmailRows_(group.memberships.map((membership) => membership.row), 'SENT', settings.PIN_EMAIL_SUBJECT);
        sentRecipients += 1;
        sentMemberships += group.memberships.length;
      } catch (error) {
        const detail = String(error && error.message ? error.message : error).slice(0, 250);
        markPinEmailRows_(group.memberships.map((membership) => membership.row), 'ERROR', detail);
        failedRecipients += 1;
        failures.push(`${group.email}: ${detail}`);
      }
    });

    const state = getTeacherState_();
    state.emailResult = {
      sentRecipients,
      sentMemberships,
      failedRecipients,
      failures: failures.slice(0, 10),
      message: failedRecipients
        ? `${sentRecipients} student emails sent; ${failedRecipients} need attention.`
        : `${sentRecipients} student emails sent successfully.`,
    };
    return state;
  } finally {
    lock.releaseLock();
  }
}

function getPinEmailStatus_() {
  const delivery = buildPinEmailGroups_();
  return {
    readyRecipients: delivery.readyGroups.length,
    readyMemberships: delivery.readyGroups.reduce((sum, group) => sum + group.memberships.length, 0),
    sentMemberships: delivery.sentMemberships,
    missingMemberships: delivery.missingMemberships,
    invalidDomainMemberships: delivery.invalidDomainMemberships,
  };
}

function buildPinEmailGroups_() {
  const settings = getSettings_();
  const studentDomain = String(settings.STUDENT_EMAIL_DOMAIN || '').toLowerCase();
  const cardsByKey = new Map();
  readPinCards_().forEach((card) => cardsByKey.set(card.studentKey, card));
  const groupsByEmail = new Map();
  let sentMemberships = 0;
  let missingMemberships = 0;
  let invalidDomainMemberships = 0;

  getRoster_().forEach((student) => {
    const card = cardsByKey.get(student.key);
    if (!card || !/^\d{6}$/.test(card.pin)) {
      missingMemberships += 1;
      return;
    }
    if (student.email.split('@').pop() !== studentDomain) {
      invalidDomainMemberships += 1;
      return;
    }
    if (card.emailStatus === 'SENT') {
      sentMemberships += 1;
      return;
    }
    if (!groupsByEmail.has(student.email)) {
      groupsByEmail.set(student.email, { email: student.email, name: student.name, memberships: [] });
    }
    groupsByEmail.get(student.email).memberships.push(card);
  });

  return {
    readyGroups: [...groupsByEmail.values()].sort((a, b) => a.email.localeCompare(b.email)),
    sentMemberships,
    missingMemberships,
    invalidDomainMemberships,
  };
}

function readPinCards_() {
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
    generatedAt: row[4] instanceof Date ? row[4] : (row[4] ? new Date(row[4]) : null),
    emailStatus: String(row[5] || '').trim().toUpperCase(),
    emailedAt: row[6] instanceof Date ? row[6] : (row[6] ? new Date(row[6]) : null),
    emailDetail: String(row[7] || ''),
  })).filter((card) => card.studentEmail && card.studentKey);
}

function buildPinEmailMessage_(group, settings, teacherEmail) {
  const firstName = firstNameFromStudentName_(group.name);
  const membershipLines = group.memberships.map((membership) => `${membership.classPeriod}: ${membership.pin}`);
  const body = [
    `Hello ${firstName},`,
    '',
    'Here is your private GrantDesk class PIN:',
    ...membershipLines,
    '',
    `Open ${settings.CHECKIN_URL} for Daily Check-in and Hall Pass.`,
    'Keep this PIN private. If you have more than one Mr. Grant class, use the PIN listed for the class you are attending.',
    '',
    '— Mr. Grant',
  ].join('\n');
  const htmlRows = group.memberships.map((membership) => (
    `<li><strong>${escapeHtmlForEmail_(membership.classPeriod)}</strong>: <span style="font-family:monospace;font-size:18px">${escapeHtmlForEmail_(membership.pin)}</span></li>`
  )).join('');
  const htmlBody = [
    `<p>Hello ${escapeHtmlForEmail_(firstName)},</p>`,
    '<p>Here is your private GrantDesk class PIN:</p>',
    `<ul>${htmlRows}</ul>`,
    `<p>Open <a href="${escapeHtmlForEmail_(settings.CHECKIN_URL)}">GrantDesk Daily Check-in</a> for Daily Check-in and Hall Pass.</p>`,
    '<p>Keep this PIN private. If you have more than one Mr. Grant class, use the PIN listed for the class you are attending.</p>',
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
}

function openTodayCheckIns() {
  const settings = getSettings_();
  assertTeacher_(getActiveEmail_(), settings);
  const spreadsheet = getSpreadsheet_();
  const sheet = spreadsheet.getSheetByName(GD_SHEETS.CHECKINS);
  spreadsheet.setActiveSheet(sheet);
  sheet.getRange(Math.max(2, sheet.getLastRow()), 1).activate();
}

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

function assertPinAttemptAllowed_(email) {
  const attempts = Number(CacheService.getScriptCache().get(pinAttemptKey_(email)) || 0);
  if (attempts >= 10) {
    throw new Error('Too many incorrect PIN attempts. Wait 15 minutes or ask Mr. Grant.');
  }
}

function recordFailedPinAttempt_(email) {
  const cache = CacheService.getScriptCache();
  const key = pinAttemptKey_(email);
  const attempts = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(attempts), 900);
}

function clearPinAttempts_(email) {
  CacheService.getScriptCache().remove(pinAttemptKey_(email));
}

function pinAttemptKey_(email) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    normalizeEmail_(email),
    Utilities.Charset.UTF_8
  );
  return `pin-attempts:${Utilities.base64EncodeWebSafe(digest).slice(0, 32)}`;
}

function getSettings_() {
  const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.SETTINGS);
  const values = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues() : [];
  return values.reduce((settings, row) => {
    const key = String(row[0] || '').trim();
    if (key) settings[key] = String(row[1] == null ? '' : row[1]).trim();
    return settings;
  }, {});
}

function setSettingValue_(key, value) {
  const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.SETTINGS);
  const lastRow = sheet.getLastRow();
  const keys = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(String) : [];
  const index = keys.indexOf(String(key));
  if (index >= 0) {
    sheet.getRange(index + 2, 2).setValue(value);
    return;
  }
  const description = (GD_DEFAULT_SETTINGS.find((row) => row[0] === key) || ['', '', ''])[2];
  sheet.appendRow([key, value, description]);
}

function numberSetting_(settings, key, fallback) {
  const value = Number(settings[key]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function getActiveEmail_() {
  return normalizeEmail_(Session.getActiveUser().getEmail());
}

function rosterKey_(email, classPeriod) {
  return `${normalizeEmail_(email)}::${String(classPeriod || '').trim().toLowerCase()}`;
}

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function assertSchoolAccount_(email, settings) {
  const domain = String(settings.SCHOOL_DOMAIN || '').toLowerCase();
  const emailDomain = normalizeEmail_(email).split('@').pop();
  const allowed = emailDomain === domain || emailDomain.endsWith(`.${domain}`);
  if (!email || !domain || !allowed) {
    throw new Error('Open this pass while signed into your school Google account. If that is not available, use the classroom kiosk.');
  }
}

function assertTeacher_(email, settings) {
  assertSchoolAccount_(email, settings);
  const teachers = String(settings.TEACHER_EMAILS || '').split(',').map(normalizeEmail_).filter(Boolean);
  if (!teachers.includes(normalizeEmail_(email))) throw new Error('This view is limited to the teacher account.');
}

function dateKey_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function purgeOldPasses() {
  const settings = getSettings_();
  assertTeacher_(getActiveEmail_(), settings);
  const removedPasses = purgeOldPasses_();
  const removedQueueRows = purgeOldQueue_();
  SpreadsheetApp.getUi().alert(`${removedPasses} old returned pass${removedPasses === 1 ? '' : 'es'} and ${removedQueueRows} resolved queue entr${removedQueueRows === 1 ? 'y' : 'ies'} removed.`);
}

function purgeIfDue_() {
  const properties = PropertiesService.getScriptProperties();
  const today = dateKey_(new Date());
  if (properties.getProperty('LAST_PURGE') === today) return;
  purgeOldPasses_();
  purgeOldQueue_();
  properties.setProperty('LAST_PURGE', today);
}

function purgeOldPasses_() {
  const settings = getSettings_();
  const retentionDays = numberSetting_(settings, 'RETENTION_DAYS', 180);
  if (!retentionDays) return 0;
  const cutoff = Date.now() - retentionDays * 86400000;
  const rows = readPassLog_()
    .filter((pass) => pass.status !== 'OUT' && pass.returnDate && pass.returnDate.getTime() < cutoff)
    .map((pass) => pass.row)
    .sort((a, b) => b - a);
  const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.LOG);
  rows.forEach((row) => sheet.deleteRow(row));
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
  return rows.length;
}

function installCleanupTrigger_() {
  const exists = ScriptApp.getProjectTriggers().some((trigger) => trigger.getHandlerFunction() === 'purgeIfDue_');
  if (!exists) ScriptApp.newTrigger('purgeIfDue_').timeBased().everyDays(1).atHour(3).create();
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('Run setupProject once from the spreadsheet before deploying the web app.');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', active.getId());
  return active;
}

function setupWorkbook_() {
  const spreadsheet = getSpreadsheet_();
  ensureSheet_(spreadsheet, GD_SHEETS.ROSTER, GD_HEADERS.ROSTER);
  ensureSheet_(spreadsheet, GD_SHEETS.LOG, GD_HEADERS.LOG);
  ensureSheet_(spreadsheet, GD_SHEETS.CHECKINS, GD_HEADERS.CHECKINS);
  ensureSheet_(spreadsheet, GD_SHEETS.QUEUE, GD_HEADERS.QUEUE);
  ensureSheet_(spreadsheet, GD_SHEETS.SETTINGS, GD_HEADERS.SETTINGS);
  ensureSheet_(spreadsheet, GD_SHEETS.PINS, GD_HEADERS.PINS);

  const settingsSheet = spreadsheet.getSheetByName(GD_SHEETS.SETTINGS);
  const existing = settingsSheet.getLastRow() > 1
    ? new Set(settingsSheet.getRange(2, 1, settingsSheet.getLastRow() - 1, 1).getValues().flat().map(String))
    : new Set();
  const missing = GD_DEFAULT_SETTINGS.filter((row) => !existing.has(row[0]));
  if (missing.length) settingsSheet.getRange(settingsSheet.getLastRow() + 1, 1, missing.length, 3).setValues(missing);

  spreadsheet.getSheetByName(GD_SHEETS.LOG).getRange('F:G').setNumberFormat('m/d/yyyy h:mm:ss am/pm');
  spreadsheet.getSheetByName(GD_SHEETS.LOG).getRange('H:H').setNumberFormat('0.0');
  spreadsheet.getSheetByName(GD_SHEETS.CHECKINS).getRange('B:B').setNumberFormat('@');
  spreadsheet.getSheetByName(GD_SHEETS.CHECKINS).getRange('C:C').setNumberFormat('m/d/yyyy h:mm:ss am/pm');
  spreadsheet.getSheetByName(GD_SHEETS.CHECKINS).getRange('H:H').setNumberFormat('0');
  spreadsheet.getSheetByName(GD_SHEETS.QUEUE).getRange('E:G').setNumberFormat('m/d/yyyy h:mm:ss am/pm');
  spreadsheet.getSheetByName(GD_SHEETS.PINS).getRange('E:E').setNumberFormat('m/d/yyyy h:mm am/pm');
  spreadsheet.getSheetByName(GD_SHEETS.PINS).getRange('G:G').setNumberFormat('m/d/yyyy h:mm am/pm');
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0 || !sheet.getRange(1, 1).getValue()) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#eeeeee')
      .setFontWeight('bold')
      .setFontColor('#202127');
  } else {
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
  }
  return sheet;
}
