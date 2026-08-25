const GD_SHEETS = {
  ROSTER: 'Roster',
  LOG: 'Pass Log',
  CHECKINS: 'Daily Check-ins',
  SETTINGS: 'Settings',
  PINS: 'PIN Cards',
};

const GD_HEADERS = {
  ROSTER: ['Student Email', 'Student Name', 'Class / Period', 'PIN Hash', 'Active'],
  LOG: ['Pass ID', 'Student Email', 'Student Name', 'Class / Period', 'Destination', 'Out Time', 'Return Time', 'Minutes Out', 'Method', 'Status', 'Ended By', 'Note'],
  CHECKINS: ['Check-in ID', 'Date', 'Check-in Time', 'Student Email', 'Student Name', 'Class / Period', 'Method', 'Point', 'Status', 'Note'],
  SETTINGS: ['Key', 'Value', 'What it controls'],
  PINS: ['Student Email', 'Student Name', 'Class / Period', 'PIN', 'Generated At'],
};

const GD_DEFAULT_SETTINGS = [
  ['TEACHER_EMAILS', 'gauch@mtmorrisschools.org', 'Comma-separated staff allowed to open teacher mode'],
  ['SCHOOL_DOMAIN', 'mtmorrisschools.org', 'Only signed-in accounts from this Google Workspace domain may load the app'],
  ['MAX_ACTIVE_PASSES', '1', 'How many students may be out at once'],
  ['LATE_AFTER_MINUTES', '10', 'When an active pass is highlighted for the teacher'],
  ['RETENTION_DAYS', '180', 'Returned passes older than this are removed by the daily cleanup'],
  ['DESTINATION', 'Restroom', 'Student-facing destination label'],
  ['APP_TITLE', 'Mr. Grant’s Hall Pass', 'Name shown at the top of the pass app'],
  ['CHECKIN_POINT_VALUE', '1', 'Extra-credit points recorded for one daily check-in'],
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('GrantDesk Pass')
    .addItem('1. Set up / repair workbook', 'setupProject')
    .addItem('2. Generate missing student PINs', 'generateMissingPins')
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
    const student = getStudentByEmail_(activeEmail);
    if (!student) {
      return {
        ok: true,
        mode: 'checkin',
        recognized: false,
        appTitle: 'Daily Check-in',
        message: 'Your school account is signed in, but it is not on this class roster. Try your PIN or ask Mr. Grant.',
      };
    }
    return getCheckInState_(student, '', 'google');
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

  const student = getStudentByEmail_(activeEmail);
  if (!student) {
    return {
      ok: true,
      mode: 'student',
      recognized: false,
      appTitle: settings.APP_TITLE,
      destination: settings.DESTINATION,
      message: 'Your school account is signed in, but it is not on this class roster. Try your PIN or ask Mr. Grant.',
    };
  }
  return getStudentState_(student, '', 'google');
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
  CacheService.getScriptCache().put(`pin:${token}`, JSON.stringify({ email: student.email }), 21600);
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
  CacheService.getScriptCache().put(`pin:${token}`, JSON.stringify({ email: student.email }), 21600);
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

function startPass(pinToken) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const resolved = resolveStudent_(pinToken);
    const student = resolved.student;
    const settings = getSettings_();
    const active = getActivePasses_();
    const existing = active.find((pass) => pass.studentEmail === student.email);
    if (existing) return getStudentState_(student, pinToken || '', resolved.method);

    const maxActive = numberSetting_(settings, 'MAX_ACTIVE_PASSES', 1);
    if (active.length >= maxActive) throw new Error('The pass is in use right now. Give it a minute and try again.');

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
    closePassForStudent_(resolved.student.email, resolved.student.email, '');
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

function teacherStartPass(studentEmail) {
  const settings = getSettings_();
  const teacher = getActiveEmail_();
  assertTeacher_(teacher, settings);
  const student = getStudentByEmail_(studentEmail);
  if (!student) throw new Error('That student is not active on the roster.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const active = getActivePasses_();
    if (active.some((pass) => pass.studentEmail === student.email)) return getTeacherState_();
    if (active.length >= numberSetting_(settings, 'MAX_ACTIVE_PASSES', 1)) {
      throw new Error('The pass is already in use. End the active pass before starting another.');
    }
    getSpreadsheet_().getSheetByName(GD_SHEETS.LOG).appendRow([
      Utilities.getUuid(), student.email, student.name, student.classPeriod, settings.DESTINATION,
      new Date(), '', '', 'teacher', 'OUT', teacher, 'Started by teacher',
    ]);
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

function teacherCheckInStudent(studentEmail) {
  const settings = getSettings_();
  const teacher = getActiveEmail_();
  assertTeacher_(teacher, settings);
  const student = getStudentByEmail_(studentEmail);
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
    email: student.email,
    name: student.name,
    classPeriod: student.classPeriod,
  }));
  const log = readPassLog_();
  const todayKey = dateKey_(new Date());
  const checkInsToday = readCheckIns_()
    .filter((checkIn) => checkIn.dateKey === todayKey && checkIn.status === 'CHECKED_IN')
    .sort((a, b) => a.checkInTime - b.checkInTime);
  const checkedEmails = new Set(checkInsToday.map((checkIn) => checkIn.studentEmail));
  const classNames = [...new Set(roster.map((student) => student.classPeriod || 'class'))]
    .sort((a, b) => a.localeCompare(b));
  const checkInSummary = classNames.map((classPeriod) => {
    const classRoster = roster.filter((student) => (student.classPeriod || 'class') === classPeriod);
    return {
      classPeriod,
      checkedIn: classRoster.filter((student) => checkedEmails.has(student.email)).length,
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
    retentionDays: numberSetting_(settings, 'RETENTION_DAYS', 180),
    active: log.filter((pass) => pass.status === 'OUT').map(clientPass_),
    today,
    roster,
    checkInsToday: checkInsToday.map(clientCheckIn_),
    checkInSummary,
    notCheckedIn: roster.filter((student) => !checkedEmails.has(student.email)),
  };
}

function getCheckInState_(student, pinToken, method) {
  const settings = getSettings_();
  const todayKey = dateKey_(new Date());
  const checkIn = readCheckIns_().find((entry) => (
    entry.dateKey === todayKey &&
    entry.studentEmail === student.email &&
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
  };
}

function getStudentState_(student, pinToken, method) {
  const settings = getSettings_();
  const active = getActivePasses_();
  const ownPass = active.find((pass) => pass.studentEmail === student.email);
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
    passAvailable: Boolean(ownPass) || active.length < numberSetting_(settings, 'MAX_ACTIVE_PASSES', 1),
    lateAfterMinutes: numberSetting_(settings, 'LATE_AFTER_MINUTES', 10),
  };
}

function resolveStudent_(pinToken) {
  if (pinToken) {
    const cached = CacheService.getScriptCache().get(`pin:${pinToken}`);
    if (!cached) throw new Error('That PIN session expired. Enter your PIN again.');
    const student = getStudentByEmail_(JSON.parse(cached).email);
    if (!student) throw new Error('That student is no longer active on the roster.');
    return { student, method: 'pin' };
  }
  const settings = getSettings_();
  const email = getActiveEmail_();
  assertSchoolAccount_(email, settings);
  const student = getStudentByEmail_(email);
  if (!student) throw new Error('Your school account is not on the active roster. Use your PIN or ask Mr. Grant.');
  return { student, method: 'google' };
}

function closePassForStudent_(studentEmail, endedBy, note) {
  const active = getActivePasses_();
  const pass = active.find((item) => item.studentEmail === studentEmail);
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
    entry.studentEmail === student.email &&
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
    method: checkIn.method,
    point: checkIn.point,
    status: checkIn.status,
  };
}

function getRoster_() {
  const sheet = getSpreadsheet_().getSheetByName(GD_SHEETS.ROSTER);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, GD_HEADERS.ROSTER.length).getValues()
    .map((row, index) => ({
      row: index + 2,
      email: normalizeEmail_(row[0]),
      name: String(row[1] || '').trim(),
      classPeriod: String(row[2] || '').trim(),
      pinHash: String(row[3] || '').trim(),
      active: row[4] === true || !['false', 'no', 'inactive', '0'].includes(String(row[4] || '').toLowerCase()),
    }))
    .filter((student) => student.email && student.name && student.active);
}

function getStudentByEmail_(email) {
  const normalized = normalizeEmail_(email);
  return getRoster_().find((student) => student.email === normalized) || null;
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

function numberSetting_(settings, key, fallback) {
  const value = Number(settings[key]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function getActiveEmail_() {
  return normalizeEmail_(Session.getActiveUser().getEmail());
}

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function assertSchoolAccount_(email, settings) {
  const domain = String(settings.SCHOOL_DOMAIN || '').toLowerCase();
  if (!email || !domain || !email.endsWith(`@${domain}`)) {
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
  const removed = purgeOldPasses_();
  SpreadsheetApp.getUi().alert(`${removed} old returned pass${removed === 1 ? '' : 'es'} removed.`);
}

function purgeIfDue_() {
  const properties = PropertiesService.getScriptProperties();
  const today = dateKey_(new Date());
  if (properties.getProperty('LAST_PURGE') === today) return;
  purgeOldPasses_();
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
  spreadsheet.getSheetByName(GD_SHEETS.PINS).getRange('E:E').setNumberFormat('m/d/yyyy h:mm am/pm');
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
  }
  return sheet;
}
