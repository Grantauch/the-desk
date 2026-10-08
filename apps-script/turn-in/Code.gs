/**
 * the desk — Turn In
 *
 * A small web app that receives student work from the hubs on grant-desk.com.
 * It is its own Apps Script project, separate from Hall Pass, so a rush of
 * turn ins at the bell can never slow down check ins or passes.
 *
 * Students identify themselves with the same six digit PIN they use for the
 * hall pass. This script reads the Hall Pass roster (read only) to match a PIN
 * to a student, then writes to its own private workbook:
 *
 *   Turn Ins   one row per press of Turn In
 *   Drafts     autosaved work, so a student can pick up on another Chromebook
 *   Load Test  rows written only by the synthetic load test
 *
 * Every sheet write happens under the script lock and is flushed before the
 * lock is released. A live load test on Oct 5 2026 showed that 35 concurrent
 * appendRow calls without the lock kept only 5 rows, so the lock is required.
 * Nothing here edits the roster.
 */

const TI_VERSION = '2026-10-08-turn-in-v4';
const TI_AUTO_IDLE_MINUTES = 30;
const TI_AUTO_LOOKBACK_HOURS = 48;
const TI_TURNIN_LOCK_MS = 25000;
const TI_DRAFT_LOCK_MS = 6000;
const TI_TOKEN_SECONDS = 4 * 60 * 60;
const TI_ROSTER_CACHE_SECONDS = 10 * 60;
const TI_DRAFT_CACHE_SECONDS = 6 * 60 * 60;
const TI_SUBMISSION_CACHE_SECONDS = 15 * 60;
const TI_FAIL_WINDOW_SECONDS = 10 * 60;
const TI_FAILS_PER_DEVICE = 8;
const TI_FAILS_GLOBAL = 60;
const TI_MAX_FIELDS = 80;
const TI_MAX_ANSWER_CHARS = 6000;
const TI_MAX_QUESTION_CHARS = 400;
const TI_MAX_PAYLOAD_CHARS = 45000;
const TI_DRAFT_SCAN_ROWS = 4000;
const TI_DRAFT_KEEP_DAYS = 30;

const TI_SHEETS = {
  TURN_INS: 'Turn Ins',
  DRAFTS: 'Drafts',
  LOAD_TEST: 'Load Test',
};

const TI_HEADERS = {
  TURN_INS: ['Turned In', 'Class / Period', 'Student Name', 'Student Email', 'Hub', 'Hub Title', 'Answered', 'Words', 'Answers', 'Page', 'Submission ID', 'Data', 'How'],
  DRAFTS: ['Saved At', 'Student Email', 'Hub', 'Data'],
};
TI_HEADERS.LOAD_TEST = TI_HEADERS.TURN_INS;

const TI_COURSE_WORDS = {
  ush9: ['us history', 'u.s. history', 'ush', 'american history', 'history 9'],
  hh: ['hidden history', 'hidden', 'hh'],
  bts: ['beyond the scoreboard', 'scoreboard', 'bts'],
};

/* ---------------------------------------------------------------- web app -- */

function doGet() {
  const props = PropertiesService.getScriptProperties();
  return json_({
    ok: true,
    service: 'the desk turn in',
    version: TI_VERSION,
    ready: Boolean(props.getProperty('ROSTER_SPREADSHEET_ID') && props.getProperty('PIN_SALT') && props.getProperty('TURNIN_SPREADSHEET_ID')),
  });
}

function doPost(e) {
  let request;
  try {
    request = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (error) {
    return json_({ ok: false, code: 'bad_request', error: 'That request could not be read.' });
  }
  try {
    return json_(route_(request || {}));
  } catch (error) {
    if (error && error.studentMessage) return json_({ ok: false, code: error.code || 'refused', error: error.studentMessage });
    console.error(error && error.stack || error);
    return json_({ ok: false, code: 'server', error: 'Something went wrong on our end. Press the button again.' });
  }
}

function route_(request) {
  const action = String(request.action || '');
  if (action === 'ping') return { ok: true, version: TI_VERSION };
  if (action === 'signin') return signIn_(request);
  if (action === 'save') return saveDraft_(request);
  if (action === 'turnin') return turnIn_(request);
  throw refuse_('bad_request', 'That request could not be read.');
}

/* ---------------------------------------------------------------- actions -- */

function signIn_(request) {
  const hub = cleanHub_(request.hub);
  const identity = identify_(request);
  const token = makeToken_(identity.email, identity.test);
  return {
    ok: true,
    token,
    firstName: firstName_(identity.name),
    classes: identity.classes,
    classPeriod: pickClass_(identity.classes, request.course),
    draft: identity.test ? null : findDraft_(identity.email, hub),
  };
}

function saveDraft_(request) {
  const hub = cleanHub_(request.hub);
  const session = readToken_(request.token);
  const answers = cleanAnswers_(request.answers);
  const savedAt = new Date();
  const identity = identityByEmail_(session.email);
  const classPeriod = identity ? chooseClass_(identity.classes, request.classPeriod, request.course) : '';
  const record = { hub, answers, savedAt: savedAt.toISOString(), autoEligible: Boolean(classPeriod),
    classPeriod, title: String(request.title || '').slice(0, 200), page: String(request.page || '').slice(0, 300) };
  if (session.test) {
    return { ok: true, savedAt: record.savedAt };
  }
  // A save is acknowledged only after a durable write. Cache alone can be evicted.
  const drafts = workbook_().getSheetByName(TI_SHEETS.DRAFTS);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(TI_DRAFT_LOCK_MS)) throw refuse_('busy', 'Lots of students are saving right now. Your page will try again.');
  try {
    drafts.appendRow([savedAt, session.email, hub, JSON.stringify(record)]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  CacheService.getScriptCache().put(draftCacheKey_(session.email, hub), JSON.stringify(record), TI_DRAFT_CACHE_SECONDS);
  return { ok: true, savedAt: record.savedAt };
}

function turnIn_(request) {
  const hub = cleanHub_(request.hub);
  const submissionId = String(request.submissionId || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 64);
  if (!submissionId) throw refuse_('bad_request', 'That request could not be read.');

  const cache = CacheService.getScriptCache();
  const previous = cache.get(`sub:${submissionId}`);
  if (previous) return JSON.parse(previous);

  const identity = identify_(request);
  const answers = cleanAnswers_(request.answers);
  const classPeriod = chooseClass_(identity.classes, request.classPeriod, request.course);
  if (!classPeriod) {
    return { ok: false, code: 'pick_class', classes: identity.classes, firstName: firstName_(identity.name), error: 'Pick your class, then press Turn In again.' };
  }

  const answered = answers.filter((entry) => entry.a.trim()).length;
  const words = answers.reduce((sum, entry) => sum + countWords_(entry.a), 0);
  const title = String(request.title || '').slice(0, 200);
  const page = String(request.page || '').slice(0, 300);
  const turnedInAt = new Date();
  const record = { hub, answers, savedAt: turnedInAt.toISOString(), turnedIn: true };

  // Open the sheet before taking the lock so the lock is held only for the write itself.
  const sheet = workbook_().getSheetByName(identity.test ? TI_SHEETS.LOAD_TEST : TI_SHEETS.TURN_INS);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(TI_TURNIN_LOCK_MS)) {
    throw refuse_('busy', 'Lots of students are turning in right now. Press Turn In again.');
  }
  try {
    // A retry of this same press may have finished while this one waited for the lock.
    const landed = cache.get(`sub:${submissionId}`);
    if (landed) return JSON.parse(landed);
    turnInRow_(sheet, [
      turnedInAt,
      classPeriod,
      identity.name,
      identity.email,
      hub,
      title,
      `${answered} of ${answers.length}`,
      words,
      readableAnswers_(answers),
      page,
      submissionId,
      JSON.stringify(record),
      'Pressed',
    ]);
    cache.put(`sub:${submissionId}`, JSON.stringify(resultFor_(identity, classPeriod, turnedInAt, answered, answers.length)), TI_SUBMISSION_CACHE_SECONDS);
  } finally {
    lock.releaseLock();
  }

  if (!identity.test) {
    cache.put(draftCacheKey_(identity.email, hub), JSON.stringify(record), TI_DRAFT_CACHE_SECONDS);
  }

  return resultFor_(identity, classPeriod, turnedInAt, answered, answers.length);
}

function turnInRow_(sheet, row) {
  sheet.appendRow(row);
  SpreadsheetApp.flush();
}

function resultFor_(identity, classPeriod, turnedInAt, answered, total) {
  return {
    ok: true,
    firstName: firstName_(identity.name),
    classPeriod,
    turnedInAt: turnedInAt.toISOString(),
    answered,
    total,
    token: makeToken_(identity.email, identity.test),
    classes: identity.classes,
  };
}

/* --------------------------------------------------------------- identity -- */

function identify_(request) {
  const props = PropertiesService.getScriptProperties();
  const testKey = props.getProperty('LOAD_TEST_KEY');
  const pin = String(request.pin || '').replace(/\D/g, '');

  if (testKey && request.test && String(request.test) === testKey) {
    if (!/^9\d{5}$/.test(pin)) throw refuse_('bad_pin', 'Load test PINs start with 9.');
    const n = pin.slice(-3);
    return {
      email: `load-test-${n}@example.invalid`,
      name: `Load Test ${n}`,
      classes: ['Load Test'],
      test: true,
    };
  }

  const device = String(request.device || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 64) || 'unknown';
  assertAttemptsAllowed_(device);
  if (!/^\d{6}$/.test(pin)) throw refuse_('bad_pin', 'Enter your six digit hall pass PIN.');

  const match = rosterByHash_()[hashPin_(pin)];
  if (!match) {
    recordFailedAttempt_(device);
    throw refuse_('bad_pin', 'That PIN did not match. Try again or ask your teacher.');
  }
  if (match.emails.length !== 1) throw refuse_('bad_pin', 'That PIN needs to be fixed. Ask your teacher.');
  return { email: match.emails[0], name: match.name, classes: match.classes, test: false };
}

function rosterByHash_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('roster:v1');
  if (cached) return JSON.parse(cached);

  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('ROSTER_SPREADSHEET_ID');
  if (!id) throw refuse_('not_ready', 'Turn In is not set up yet. Use the copy button for now.');
  const sheet = SpreadsheetApp.openById(id).getSheetByName('Roster');
  if (!sheet) throw refuse_('not_ready', 'Turn In is not set up yet. Use the copy button for now.');

  const lastRow = sheet.getLastRow();
  const map = {};
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, 5).getValues().forEach((row) => {
      const email = String(row[0] || '').trim().toLowerCase();
      const name = String(row[1] || '').trim();
      const classPeriod = String(row[2] || '').trim();
      const pinHash = String(row[3] || '').trim();
      const active = isTruthyCell_(row[4], true);
      if (!email || !name || !pinHash || !active) return;
      const entry = map[pinHash] || (map[pinHash] = { name, emails: [], classes: [] });
      if (entry.emails.indexOf(email) === -1) entry.emails.push(email);
      if (classPeriod && entry.classes.indexOf(classPeriod) === -1) entry.classes.push(classPeriod);
    });
  }
  try {
    cache.put('roster:v1', JSON.stringify(map), TI_ROSTER_CACHE_SECONDS);
  } catch (error) {
    // A very large roster can exceed the cache value limit. Reading the sheet each time still works.
  }
  return map;
}

/** Mirrors hashPin_ in the Hall Pass project. Both must share the same PIN_SALT. */
function hashPin_(pin) {
  const salt = PropertiesService.getScriptProperties().getProperty('PIN_SALT');
  if (!salt) throw refuse_('not_ready', 'Turn In is not set up yet. Use the copy button for now.');
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, `${salt}:${pin}`, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes);
}

function isTruthyCell_(value, blankMeans) {
  if (value === true) return true;
  if (value === false) return false;
  const text = String(value == null ? '' : value).trim().toLowerCase();
  if (text === '') return blankMeans;
  if (['false', 'no', 'n', 'inactive', 'unchecked', '0'].indexOf(text) !== -1) return false;
  if (['true', 'yes', 'y', 'active', 'unlimited', '1'].indexOf(text) !== -1) return true;
  return blankMeans;
}

function pickClass_(classes, course) {
  if (classes.length === 1) return classes[0];
  const words = TI_COURSE_WORDS[String(course || '').toLowerCase()];
  if (!words) return '';
  const matches = classes.filter((name) => {
    const lower = ` ${name.toLowerCase()} `;
    return words.some((word) => lower.indexOf(word.length <= 3 ? ` ${word} ` : word) !== -1);
  });
  return matches.length === 1 ? matches[0] : '';
}

function chooseClass_(classes, requested, course) {
  const wanted = String(requested || '').trim();
  if (wanted && classes.indexOf(wanted) !== -1) return wanted;
  return pickClass_(classes, course);
}

function firstName_(name) {
  const text = String(name || '').trim();
  if (text.indexOf(',') !== -1) return text.split(',')[1].trim().split(/\s+/)[0] || text;
  return text.split(/\s+/)[0] || text;
}

function identityByEmail_(email) {
  const entries = Object.values(rosterByHash_()).filter((entry) => entry.emails.length === 1 && entry.emails[0] === email);
  if (!entries.length) return null;
  const classes = [];
  entries.forEach((entry) => entry.classes.forEach((name) => { if (classes.indexOf(name) === -1) classes.push(name); }));
  return { email, name: entries[0].name, classes };
}

// Ignore empty hidden fields and labels; compare the actual answers by stable key.
function answerSignature_(answers) {
  return JSON.stringify(answers.filter((entry) => entry.a.trim()).map((entry) => [entry.k, entry.a]).sort((a, b) => a[0].localeCompare(b[0])));
}

/** Every 15 minutes: submit recent identified work after 30 minutes without changes. */
function autoTurnIn() {
  const book = workbook_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(TI_DRAFT_LOCK_MS)) return 0;
  let written = 0;
  try {
    const drafts = book.getSheetByName(TI_SHEETS.DRAFTS);
    const sheet = book.getSheetByName(TI_SHEETS.TURN_INS);
    if (drafts.getLastRow() < 2) return 0;
    const latest = {};
    const submitted = {};
    const keyOf = (email, hub) => JSON.stringify([email, hub]);
    drafts.getRange(2, 1, drafts.getLastRow() - 1, 4).getValues().forEach((row) => {
      const key = keyOf(String(row[1]).toLowerCase(), String(row[2]));
      // A corrupt newest row suppresses older work rather than submitting stale answers.
      latest[key] = { email: String(row[1]).toLowerCase(), hub: String(row[2]), data: null };
      try { latest[key].data = JSON.parse(row[3]); } catch (error) { /* skip */ }
    });
    if (sheet.getLastRow() >= 2) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues().forEach((row) => {
        const key = keyOf(String(row[3]).toLowerCase(), String(row[4]));
        try { submitted[key] = JSON.parse(row[11]); } catch (error) { submitted[key] = null; }
      });
    }
    const started = Date.now();
    Object.keys(latest).some((key) => {
      if (written >= 35 || Date.now() - started > 20000) return true;
      const draft = latest[key];
      const data = draft.data;
      if (!data || !data.autoEligible || !Array.isArray(data.answers)) return false;
      const stamp = Date.parse(data.savedAt);
      const age = Date.now() - stamp;
      if (!Number.isFinite(age) || age < TI_AUTO_IDLE_MINUTES * 60000 || age > TI_AUTO_LOOKBACK_HOURS * 3600000) return false;
      const identity = identityByEmail_(draft.email);
      if (!identity || identity.classes.indexOf(data.classPeriod) === -1) return false;
      const answers = cleanAnswers_(data.answers);
      const answered = answers.filter((entry) => entry.a.trim()).length;
      if (!answered) return false;
      const prior = submitted[key];
      // A newer manual turn in wins, even if an older autosave landed afterward.
      if (prior && (Date.parse(prior.savedAt) >= stamp || answerSignature_(prior.answers) === answerSignature_(answers))) return false;
      const at = new Date();
      const record = { hub: draft.hub, answers, savedAt: at.toISOString(), turnedIn: true };
      const submissionId = 'auto-' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, key + data.savedAt));
      turnInRow_(sheet, [at, data.classPeriod, identity.name, identity.email, draft.hub, data.title || draft.hub,
        `${answered} of ${answers.length}`, answers.reduce((sum, entry) => sum + countWords_(entry.a), 0),
        readableAnswers_(answers), data.page || '', submissionId, JSON.stringify(record), 'Auto']);
      // Invalidate a cached draft; restoration must see the committed submission.
      CacheService.getScriptCache().remove(draftCacheKey_(draft.email, draft.hub));
      written += 1;
      return false;
    });
  } finally {
    lock.releaseLock();
  }
  return written;
}

/* ----------------------------------------------------------------- tokens -- */

function makeToken_(email, test) {
  const body = Utilities.base64EncodeWebSafe(JSON.stringify({ e: email, t: test ? 1 : 0, x: Math.floor(Date.now() / 1000) + TI_TOKEN_SECONDS }));
  return `${body}.${sign_(body)}`;
}

function readToken_(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2 || sign_(parts[0]) !== parts[1]) throw refuse_('signed_out', 'Enter your PIN again to keep saving.');
  let data;
  try {
    data = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  } catch (error) {
    throw refuse_('signed_out', 'Enter your PIN again to keep saving.');
  }
  if (!data || !data.e || Number(data.x) < Date.now() / 1000) throw refuse_('signed_out', 'Enter your PIN again to keep saving.');
  return { email: data.e, test: data.t === 1 };
}

function sign_(text) {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('TOKEN_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('TOKEN_SECRET', secret);
  }
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(text, secret));
}

/* --------------------------------------------------------------- throttle -- */

function attemptBucket_() {
  return Math.floor(Date.now() / (TI_FAIL_WINDOW_SECONDS * 1000));
}

function assertAttemptsAllowed_(device) {
  const cache = CacheService.getScriptCache();
  const bucket = attemptBucket_();
  const all = cache.getAll([`fail:all:${bucket}`, `fail:${device}:${bucket}`]);
  if (Number(all[`fail:${device}:${bucket}`] || 0) >= TI_FAILS_PER_DEVICE) {
    throw refuse_('slow_down', 'Too many wrong PINs on this Chromebook. Wait a few minutes or ask your teacher.');
  }
  if (Number(all[`fail:all:${bucket}`] || 0) >= TI_FAILS_GLOBAL) {
    throw refuse_('slow_down', 'Turn In is paused for a few minutes. Use the copy button for now.');
  }
}

function recordFailedAttempt_(device) {
  const cache = CacheService.getScriptCache();
  const bucket = attemptBucket_();
  [`fail:all:${bucket}`, `fail:${device}:${bucket}`].forEach((key) => {
    cache.put(key, String(Number(cache.get(key) || 0) + 1), TI_FAIL_WINDOW_SECONDS);
  });
}

/* ----------------------------------------------------------------- drafts -- */

function draftCacheKey_(email, hub) {
  return `draft:${hub}:${Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, email))}`;
}

function findDraft_(email, hub) {
  const cached = CacheService.getScriptCache().get(draftCacheKey_(email, hub));
  if (cached) return JSON.parse(cached);

  const book = workbook_();
  const candidates = [
    newestMatch_(book.getSheetByName(TI_SHEETS.DRAFTS), 2, 3, 4, email, hub),
    newestMatch_(book.getSheetByName(TI_SHEETS.TURN_INS), 4, 5, 12, email, hub),
  ].filter(Boolean);
  if (!candidates.length) return null;
  candidates.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  return candidates[0];
}

function newestMatch_(sheet, emailCol, hubCol, dataCol, email, hub) {
  if (!sheet) return null;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const count = Math.min(lastRow - 1, TI_DRAFT_SCAN_ROWS);
  const start = lastRow - count + 1;
  const width = Math.max(emailCol, hubCol, dataCol);
  const rows = sheet.getRange(start, 1, count, width).getValues();
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (String(rows[i][emailCol - 1]).toLowerCase() === email && String(rows[i][hubCol - 1]) === hub) {
      try {
        return JSON.parse(rows[i][dataCol - 1]);
      } catch (error) {
        return null;
      }
    }
  }
  return null;
}

/* ---------------------------------------------------------------- answers -- */

function cleanHub_(value) {
  const hub = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(hub)) throw refuse_('bad_request', 'That request could not be read.');
  return hub;
}

function cleanAnswers_(value) {
  if (!Array.isArray(value)) throw refuse_('bad_request', 'That request could not be read.');
  if (value.length > TI_MAX_FIELDS) throw refuse_('too_big', 'This page has too many answer boxes to send. Use the copy button.');
  const answers = value.map((entry) => ({
    k: String(entry && entry.k || '').slice(0, 120),
    q: String(entry && entry.q || '').slice(0, TI_MAX_QUESTION_CHARS),
    a: String(entry && entry.a || '').slice(0, TI_MAX_ANSWER_CHARS),
  })).filter((entry) => entry.k);
  if (JSON.stringify(answers).length > TI_MAX_PAYLOAD_CHARS) throw refuse_('too_big', 'Your answers are too long to send in one piece. Use the copy button.');
  return answers;
}

function readableAnswers_(answers) {
  return answers.map((entry, index) => `${index + 1}. ${entry.q || entry.k}\n${entry.a.trim() || '(blank)'}`).join('\n\n');
}

function countWords_(text) {
  const words = String(text || '').trim().match(/\S+/g);
  return words ? words.length : 0;
}

/* ---------------------------------------------------------------- helpers -- */

function workbook_() {
  const id = PropertiesService.getScriptProperties().getProperty('TURNIN_SPREADSHEET_ID');
  if (!id) throw refuse_('not_ready', 'Turn In is not set up yet. Use the copy button for now.');
  return SpreadsheetApp.openById(id);
}

function refuse_(code, studentMessage) {
  const error = new Error(studentMessage);
  error.code = code;
  error.studentMessage = studentMessage;
  return error;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------- teacher setup ---- */

/**
 * Run once from the editor after filling in the two Script Properties
 * ROSTER_SPREADSHEET_ID and PIN_SALT. Creates the private Turn In workbook,
 * checks the roster, and installs automatic turn in and nightly draft cleanup.
 */
function setup() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Turn In is busy. Run setup again.');
  try {
    return setup_();
  } finally {
    try { SpreadsheetApp.flush(); } finally { lock.releaseLock(); }
  }
}

function setup_() {
  const props = PropertiesService.getScriptProperties();
  const rosterId = props.getProperty('ROSTER_SPREADSHEET_ID');
  const salt = props.getProperty('PIN_SALT');
  if (!rosterId) throw new Error('Add the Script Property ROSTER_SPREADSHEET_ID first. See SETUP.md step 3.');
  if (!salt) throw new Error('Add the Script Property PIN_SALT first. See SETUP.md step 3.');

  CacheService.getScriptCache().remove('roster:v1');
  const students = Object.keys(rosterByHash_()).length;
  if (!students) throw new Error('The roster was readable but no active students with PINs were found.');

  let id = props.getProperty('TURNIN_SPREADSHEET_ID');
  let book = id ? SpreadsheetApp.openById(id) : null;
  if (!book) {
    book = SpreadsheetApp.create('the desk · Turn Ins');
    props.setProperty('TURNIN_SPREADSHEET_ID', book.getId());
  }
  ensureSheet_(book, TI_SHEETS.TURN_INS, TI_HEADERS.TURN_INS);
  ensureSheet_(book, TI_SHEETS.DRAFTS, TI_HEADERS.DRAFTS);
  ensureSheet_(book, TI_SHEETS.LOAD_TEST, TI_HEADERS.LOAD_TEST);
  const blank = book.getSheetByName('Sheet1');
  if (blank && book.getSheets().length > 1 && blank.getLastRow() === 0) book.deleteSheet(blank);

  ScriptApp.getProjectTriggers()
    .filter((trigger) => ['pruneDrafts', 'autoTurnIn'].indexOf(trigger.getHandlerFunction()) !== -1)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('pruneDrafts').timeBased().everyDays(1).atHour(2).create();
  ScriptApp.newTrigger('autoTurnIn').timeBased().everyMinutes(15).create();

  console.log(`Ready. ${students} students with PINs. Turn ins go to ${book.getUrl()}`);
  return book.getUrl();
}

function ensureSheet_(book, name, headers) {
  let sheet = book.getSheetByName(name);
  if (!sheet) sheet = book.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  // Upgrade the existing header without replacing student rows.
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  if (name !== TI_SHEETS.DRAFTS) {
    sheet.setColumnWidth(headers.indexOf('Answers') + 1, 480);
    sheet.hideColumns(headers.indexOf('Data') + 1);
  } else {
    sheet.hideColumns(headers.indexOf('Data') + 1);
  }
  return sheet;
}

/** Nightly: drop autosaved drafts older than TI_DRAFT_KEEP_DAYS. Turn ins are never deleted. */
function pruneDrafts() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const sheet = workbook_().getSheetByName(TI_SHEETS.DRAFTS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    const cutoff = Date.now() - TI_DRAFT_KEEP_DAYS * 24 * 60 * 60 * 1000;
    const stamps = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    let oldRows = 0;
    while (oldRows < stamps.length) {
      const stamp = stamps[oldRows][0];
      const time = stamp instanceof Date ? stamp.getTime() : new Date(stamp).getTime();
      if (!(time < cutoff)) break;
      oldRows += 1;
    }
    if (oldRows) sheet.deleteRows(2, oldRows);
  } finally {
    lock.releaseLock();
  }
}

/** Optional: turn the synthetic load test on or off. See SETUP.md step 7. */
function startLoadTest() {
  const key = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  PropertiesService.getScriptProperties().setProperty('LOAD_TEST_KEY', key);
  console.log(`Load test key: ${key}  (run stopLoadTest when you are done)`);
  return key;
}

function stopLoadTest() {
  PropertiesService.getScriptProperties().deleteProperty('LOAD_TEST_KEY');
  console.log('Load test turned off.');
}
