/**
 * Scenario fixtures for the hall-pass runtime suite.
 *
 * Every student here is invented. No live roster entry, address, or PIN is
 * reproduced, and the harness never contacts Google, so these fixtures can be
 * run freely without touching production data.
 */

const { createHarness } = require('./gas-harness.cjs');

const STUDENT_DOMAIN = 'students.mtmorrisschools.org';
const TEACHER = 'gauch@mtmorrisschools.org';

/** A Thursday during the 2026-27 school year, mid-morning in Detroit. */
const DEFAULT_NOW = new Date('2026-09-10T14:30:00Z');

const PEOPLE = {
  ada: { email: `ada.byron@${STUDENT_DOMAIN}`, name: 'Byron, Ada' },
  alan: { email: `alan.turing@${STUDENT_DOMAIN}`, name: 'Turing, Alan' },
  grace: { email: `grace.hopper@${STUDENT_DOMAIN}`, name: 'Hopper, Grace' },
  katherine: { email: `katherine.johnson@${STUDENT_DOMAIN}`, name: 'Johnson, Katherine' },
};

/**
 * Boot a workbook with a roster, generated credentials, and any settings the
 * scenario needs. Returns the harness plus helpers that speak in classroom
 * terms rather than sheet coordinates.
 */
function classroom(options = {}) {
  const {
    memberships = [
      [PEOPLE.ada, 'Period 1'],
      [PEOPLE.alan, 'Period 1'],
      [PEOPLE.grace, 'Period 3'],
    ],
    settings = {},
    now = DEFAULT_NOW,
    activeEmail = TEACHER,
  } = options;

  const h = createHarness({ activeEmail, now });
  h.call('ensureWorkbookReady_');

  const roster = h.sheet('Roster');
  memberships.forEach(([person, period, extra = {}]) => {
    roster.appendRow([
      person.email,
      person.name,
      period,
      '',
      extra.active === false ? false : true,
      Boolean(extra.unlimited),
    ]);
  });

  applySettings(h, settings);

  h.newRequest();
  h.call('ensureOnePinPerStudent_', { createMissing: true });

  const pins = new Map();
  h.sheet('PIN Cards').records().forEach((card) => {
    pins.set(String(card['Student Email']), String(card.PIN));
  });

  const api = {
    harness: h,
    people: PEOPLE,
    teacher: TEACHER,

    /** The shared cross-class PIN for one student. */
    pin(person) {
      const value = pins.get(person.email);
      if (!value) throw new Error(`No PIN card for ${person.email}`);
      return value;
    },

    /** The roster key for one class membership. */
    key(person, period) {
      h.newRequest();
      const found = h.call('getRoster_')
        .find((student) => student.email === person.email && student.classPeriod === period);
      if (!found) throw new Error(`No membership for ${person.email} in ${period}`);
      return found.key;
    },

    settings(values) { applySettings(h, values); },

    /**
     * One student action, start to finish, the way a browser performs it:
     * a fresh PIN for authorization, then the protected mutation.
     */
    act(person, period, requestedAction, callName) {
      const studentKey = api.key(person, period);
      h.newRequest();
      h.signInAs(person.email);
      const authorized = h.call('authorizeStudentAction', api.pin(person), requestedAction, studentKey, `nonce-${Math.random()}`);
      if (authorized.requiresClassSelection) return { authorized, state: authorized };
      h.newRequest();
      const state = h.call(callName, authorized.actionProof, studentKey, authorized.pinToken);
      return { authorized, state };
    },

    checkIn(person, period) { return api.act(person, period, 'CHECKIN', 'submitDailyCheckIn'); },
    requestPass(person, period) { return api.act(person, period, 'AUTO_PASS', 'requestBathroomPass'); },
    returnPass(person, period) { return api.act(person, period, 'AUTO_PASS', 'returnPass'); },

    /** A complete trip of a chosen length, in seconds. */
    trip(person, period, seconds) {
      const out = api.requestPass(person, period);
      h.clock.advanceSeconds(seconds);
      const back = api.returnPass(person, period);
      return { out, back };
    },

    teacherState() {
      h.newRequest();
      h.signInAs(TEACHER);
      return h.call('refreshTeacherState');
    },

    passLog() { return h.sheet('Pass Log').records(); },
    passAudit() { return h.sheet('Pass Audit').records(); },
    checkIns() { return h.sheet('Daily Check-ins').records(); },
    queue() { return h.sheet('Pass Queue').records(); },
    rosterRows() { return h.sheet('Roster').records(); },
    pinCards() { return h.sheet('PIN Cards').records(); },
    calendar() { return h.sheet('School Calendar').records(); },
  };

  return api;
}

function applySettings(h, values) {
  const entries = Object.entries(values || {});
  if (!entries.length) return;
  const sheet = h.sheet('Settings');
  const rows = sheet.records();
  entries.forEach(([key, value]) => {
    const existing = rows.find((row) => String(row.Setting || row.Key || '').trim() === key);
    if (existing) {
      sheet.getRange(existing.__row, 2).setValue(String(value));
    } else {
      sheet.appendRow([key, String(value), 'Set by the test suite']);
    }
  });
  h.newRequest();
}

/**
 * Mark dates on the official School Calendar sheet as no-school days. The sheet
 * is seeded with the real 2026-27 district calendar at setup, so tests that care
 * about school days should either use these overrides or pick dates the seeded
 * calendar already agrees about.
 */
function setNoSchoolDays(h, dates) {
  const sheet = h.sheet('School Calendar');
  dates.forEach((date) => sheet.appendRow([date, false, 'Test calendar entry', 'Test suite', '']));
  h.newRequest();
}

/** Mark dates as school days, overriding the seeded calendar. */
function setSchoolDays(h, dates) {
  const sheet = h.sheet('School Calendar');
  dates.forEach((date) => sheet.appendRow([date, true, 'Test calendar entry', 'Test suite', '']));
  h.newRequest();
}

module.exports = { classroom, PEOPLE, TEACHER, STUDENT_DOMAIN, DEFAULT_NOW, setNoSchoolDays, setSchoolDays };
