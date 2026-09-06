/** Teacher-only release checks. Synthetic workbooks are retained, never mailed or shared. */
function releaseAssert_(condition, message) {
  if (!condition) throw new Error('Release check failed: ' + message);
}

function releaseSheetValues_(book, name, width) {
  const sheet = book.getSheetByName(name);
  return sheet && sheet.getLastRow() ? sheet.getRange(1, 1, sheet.getLastRow(), width).getValues() : [];
}

function releasePreservedState_(book) {
  const rows = {};
  [[GD_SHEETS.ROSTER,6],[GD_SHEETS.LOG,21],[GD_SHEETS.AUDIT,22],
    [GD_SHEETS.CHECKINS,10],[GD_SHEETS.QUEUE,12],[GD_SHEETS.PINS,8]].forEach(([name,width]) => {
    rows[name] = JSON.stringify(releaseSheetValues_(book, name, width));
  });
  return rows;
}

function releaseAssertPreserved_(before, book) {
  const after = releasePreservedState_(book);
  Object.keys(before).forEach(name => releaseAssert_(before[name] === after[name], name + ' existing facts changed'));
}

/** Add only the session schema; no PIN regeneration, identity reconciliation or history cleanup. */
function releaseMigrateSessionWorkbook_() {
  const book = getSpreadsheet_();
  const roster = book.getSheetByName(GD_SHEETS.ROSTER);
  const calendar = book.getSheetByName(GD_SHEETS.CALENDAR);
  releaseAssert_(roster && calendar, 'expected existing workbook tabs');
  const accessHeader = String(roster.getRange(1,7).getValue() || '').trim();
  const scheduleHeader = String(calendar.getRange(1,6).getValue() || '').trim();
  releaseAssert_(!accessHeader || accessHeader === 'Pass Access', 'Roster column 7 needs explicit migration review');
  releaseAssert_(!scheduleHeader || scheduleHeader === 'Schedule Key', 'Calendar column 6 needs explicit migration review');
  const before = releasePreservedState_(book);
  const settingsBefore = { ...getSettings_() };
  ensureSheet_(book, GD_SHEETS.ROSTER, GD_HEADERS.ROSTER);
  ensureSheet_(book, GD_SHEETS.CALENDAR, GD_HEADERS.CALENDAR);
  ensureSheet_(book, GD_SHEETS.BELLS, GD_HEADERS.BELLS);
  ensureSheet_(book, GD_SHEETS.TEACHER_AUDIT, GD_HEADERS.TEACHER_AUDIT);
  ['CHECKIN_WINDOW_MINUTES','PASS_PROTECT_FIRST_MINUTES','PASS_PROTECT_LAST_MINUTES'].forEach(key => {
    if (!Object.prototype.hasOwnProperty.call(settingsBefore, key)) {
      setSettingValue_(key, GD_DEFAULT_SETTINGS.find(row => row[0] === key)[1]);
    }
  });
  migrateSessionPolicy_();
  releaseAssertPreserved_(before, book);
  const settingsAfter = getSettings_();
  Object.keys(settingsBefore).forEach(key => releaseAssert_(settingsBefore[key] === settingsAfter[key], 'existing setting changed: ' + key));
  releaseAssert_(Object.keys(getBellScheduleIndex_()).length >= 3, 'missing default schedule profiles');
  return { ok: true, schema: GD_SCHEMA_VERSION, preservedSheets: Object.keys(before).length };
}

/** Run from the editor before migrating production. The old synthetic source and migrated copy remain. */
function releaseRehearseSessionMigration() {
  assertTeacher_(getActiveEmail_(), getSettings_());
  const production = getSpreadsheet_();
  const source = SpreadsheetApp.create('GrantDesk SYNTHETIC session migration source ' + new Date().toISOString());
  try {
    GD_SPREADSHEET = source; gdClearMemo_();
    [[GD_SHEETS.ROSTER,GD_HEADERS.ROSTER.slice(0,6)], [GD_SHEETS.CALENDAR,GD_HEADERS.CALENDAR.slice(0,5)],
      [GD_SHEETS.LOG,GD_HEADERS.LOG],[GD_SHEETS.AUDIT,GD_HEADERS.AUDIT],[GD_SHEETS.CHECKINS,GD_HEADERS.CHECKINS],
      [GD_SHEETS.QUEUE,GD_HEADERS.QUEUE],[GD_SHEETS.PINS,GD_HEADERS.PINS],[GD_SHEETS.SETTINGS,GD_HEADERS.SETTINGS]]
      .forEach(([name,headers])=>ensureSheet_(source,name,headers));
    const legacySettings = GD_DEFAULT_SETTINGS.filter(row=>!['CHECKIN_WINDOW_MINUTES','PASS_PROTECT_FIRST_MINUTES','PASS_PROTECT_LAST_MINUTES'].includes(row[0]));
    source.getSheetByName(GD_SHEETS.SETTINGS).getRange(2,1,legacySettings.length,3).setValues(legacySettings);
    ['Period 1','Period 3'].forEach(period=>source.getSheetByName(GD_SHEETS.ROSTER).appendRow(['migration.synthetic@example.invalid','Synthetic, Migration',period,'synthetic-existing-hash',true,true]));
    const completed = ['synthetic-history','migration.synthetic@example.invalid','Synthetic, Migration','Period 1','Restroom',new Date('2026-09-01T11:50:00Z'),new Date('2026-09-01T11:51:00Z'),1,'pin','RETURNED','','Preserved synthetic fact','COUNTABLE','Synthetic',new Date(),'PIN',new Date(),'synthetic-request','','',''];
    source.getSheetByName(GD_SHEETS.LOG).appendRow(completed);
    source.getSheetByName(GD_SHEETS.AUDIT).appendRow([...completed,new Date()]);
    source.getSheetByName(GD_SHEETS.PINS).appendRow(['migration.synthetic@example.invalid','Synthetic, Migration','Period 1','synthetic-placeholder',new Date(),'NOT_SENT','','No delivery']);
    source.getSheetByName(GD_SHEETS.CALENDAR).appendRow(['2026-09-02',true,'Reduced day','Synthetic fixture','test']);
    SpreadsheetApp.flush();
    const migrated = source.copy('GrantDesk SYNTHETIC session migration verified copy ' + new Date().toISOString());
    GD_SPREADSHEET = migrated; gdClearMemo_();
    const result = releaseMigrateSessionWorkbook_();
    const afterFirst = JSON.stringify(migrated.getSheets().map(sheet=>releaseSheetValues_(migrated,sheet.getName(),sheet.getLastColumn())));
    releaseMigrateSessionWorkbook_();
    releaseAssert_(afterFirst === JSON.stringify(migrated.getSheets().map(sheet=>releaseSheetValues_(migrated,sheet.getName(),sheet.getLastColumn()))), 'second migration changed data');
    releaseAssert_(getStudentPassAccess_('migration.synthetic@example.invalid') === 'UNLIMITED','legacy unlimited not preserved');
    releaseAssert_(getSchoolDaySchedule_(new Date('2026-09-02T12:00:00Z')).scheduleKey === 'REDUCED','calendar profile not migrated');
    const evidence = { ...result, idempotent: true, syntheticOnly: true, sourceUrl: source.getUrl(), migratedUrl: migrated.getUrl() };
    PropertiesService.getScriptProperties().setProperty('SESSION_MIGRATION_REHEARSED', GD_SCHEMA_VERSION);
    console.log(JSON.stringify(evidence));
    return evidence;
  } finally { GD_SPREADSHEET = production; gdClearMemo_(); }
}

/** Run only after the synthetic rehearsal has passed. */
function releaseMigrateLiveSessionWorkbook() {
  assertTeacher_(getActiveEmail_(), getSettings_());
  releaseAssert_(PropertiesService.getScriptProperties().getProperty('SESSION_MIGRATION_REHEARSED') === GD_SCHEMA_VERSION, 'synthetic migration rehearsal must pass first');
  const result = withLock_(() => {
    const result = releaseMigrateSessionWorkbook_();
    PropertiesService.getScriptProperties().setProperty('WORKBOOK_SCHEMA', GD_SCHEMA_VERSION);
    return result;
  }, 30000);
  console.log(JSON.stringify(result));
  return result;
}

/** Runs the deployed protected RPC functions against an isolated synthetic workbook. */
function releaseRunSyntheticSmoke(clientContract) {
  const teacher = getActiveEmail_();
  assertTeacher_(teacher, getSettings_());
  assertTeacherClient_(clientContract);
  const production = getSpreadsheet_();
  const before = releasePreservedState_(production);
  const book = SpreadsheetApp.create('GrantDesk SYNTHETIC protected release smoke ' + new Date().toISOString());
  try {
    GD_SPREADSHEET = book; gdClearMemo_();
    setupWorkbook_();
    const email = 'release.synthetic@' + getSettings_().STUDENT_EMAIL_DOMAIN;
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    const period = 'Period 1 — SYNTHETIC RELEASE CHECK';
    book.getSheetByName(GD_SHEETS.ROSTER).appendRow([email,'Synthetic, Release',period,hashPin_(pin),true,false,'STANDARD']);
    const now = new Date();
    const clock = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm').split(':').map(Number);
    const minute = clock[0]*60+clock[1];
    releaseAssert_(minute >= 20 && minute < 1420, 'run synthetic smoke at least twenty minutes from midnight');
    const clockText = value => `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
    book.getSheetByName(GD_SHEETS.BELLS).appendRow(['SYNTHETIC',1,clockText(minute-15),clockText(minute+20),'Synthetic smoke only','test']);
    book.getSheetByName(GD_SHEETS.CALENDAR).appendRow([dateKey_(now),true,'Synthetic smoke only','test','test','SYNTHETIC']);
    gdClearMemo_();
    const student = getStudentsByEmail_(email)[0];
    const proof = authorizeStudentAction(pin,'AUTO_PASS',student.key,'synthetic-release');
    const started = requestBathroomPass(proof.actionProof, student.key, proof.pinToken);
    releaseAssert_(started.actionOutcome.kind === 'STARTED','fresh PIN did not start pass');
    Utilities.sleep(3100);
    const returnProof = authorizeStudentAction(pin,'AUTO_PASS',student.key,'synthetic-return');
    const returned = returnPass(returnProof.actionProof,student.key,returnProof.pinToken);
    releaseAssert_(returned.actionOutcome.kind === 'RETURNED_COUNTABLE','fresh PIN did not return countable pass');
    const evidence = teacherGetMembershipPasses(student.key,GD_TEACHER_CONTRACT);
    releaseAssert_(evidence.used === 1 && evidence.passes.length === 1,'membership evidence disagrees');
    teacherVoidPass(evidence.passes[0].passId,'Synthetic release check completed');
    book.getSheetByName(GD_SHEETS.ROSTER).getRange(student.row,5).setValue(false);
    releaseAssertPreserved_(before,production);
    const result = { ok: true, schema: GD_SCHEMA_VERSION, clientContract: GD_TEACHER_CONTRACT,
      syntheticOnly: true, request: 'STARTED', return: 'RETURNED_COUNTABLE', evidenceUsed: evidence.used,
      testPassVoided: true, testMembershipDeactivated: true, productionFactsUnchanged: true, workbookUrl: book.getUrl() };
    console.log(JSON.stringify(result)); return result;
  } finally { GD_SPREADSHEET = production; gdClearMemo_(); }
}
