/**
 * Fake Apps Script runtime for apps-script/turn-in/Code.gs.
 *
 * The roster comes from the Hall Pass fixtures, so PINs are generated and
 * hashed by the real Hall Pass code. Used by the server suite and by the
 * browser suite, which answers the hubs' network calls with this same code.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHarness, FakeSheet, FakeSpreadsheet } = require('./gas-harness.cjs');
const { classroom, PEOPLE } = require('./hall-pass-fixtures.cjs');

const CODE = path.join(__dirname, '..', '..', 'apps-script', 'turn-in', 'Code.gs');

if (!FakeSheet.prototype.hideColumns) FakeSheet.prototype.hideColumns = function hideColumns() { return this; };

function world(options = {}) {
  const school = classroom({
    memberships: options.memberships || [
      [PEOPLE.ada, 'Period 1'],
      [PEOPLE.alan, 'Period 1'],
      [PEOPLE.alan, 'Period 5'],
      [PEOPLE.grace, 'Period 1'],
      [PEOPLE.katherine, 'Period 2'],
    ],
  });
  const hallSalt = school.harness.properties.getProperty('PIN_SALT');
  assert.ok(hallSalt, 'Hall Pass fixtures produce a PIN salt');

  // A separate Apps Script project: its own properties, cache and clock.
  const h = createHarness({ now: new Date('2026-10-06T14:00:00Z') });
  const books = new Map([['roster-book', school.harness.spreadsheet]]);
  let created = 0;
  const SpreadsheetApp = {
    flush: () => {},
    openById: (id) => {
      if (!books.has(id)) throw new Error(`No workbook ${id}`);
      return books.get(id);
    },
    create: (name) => {
      created += 1;
      const book = new FakeSpreadsheet(`turnin-book-${created}`);
      book.insertSheet('Sheet1');
      book.title = name;
      books.set(book.getId(), book);
      return book;
    },
  };
  const ContentService = {
    MimeType: { JSON: 'JSON' },
    createTextOutput: (text) => ({ text, mime: '', setMimeType(m) { this.mime = m; return this; } }),
  };
  const logs = [];
  const sandbox = {
    SpreadsheetApp,
    ContentService,
    PropertiesService: h.sandbox.PropertiesService,
    CacheService: h.sandbox.CacheService,
    LockService: h.sandbox.LockService,
    Utilities: h.sandbox.Utilities,
    ScriptApp: h.sandbox.ScriptApp,
    Date: h.sandbox.Date,
    console: { log: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')) },
    JSON, Math, String, Number, Array, Object, Error, Boolean, RegExp,
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(CODE, 'utf8'), sandbox, { filename: CODE });

  if (options.configure !== false) {
    h.properties.setProperty('ROSTER_SPREADSHEET_ID', 'roster-book');
    h.properties.setProperty('PIN_SALT', hallSalt);
    sandbox.setup();
  }

  const post = (body) => {
    const out = sandbox.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } });
    assert.equal(out.mime, 'JSON');
    return JSON.parse(out.text);
  };
  const book = () => books.get(h.properties.getProperty('TURNIN_SPREADSHEET_ID'));
  const rows = (name) => book().getSheetByName(name).records();
  return { school, h, sandbox, post, book, rows, logs, pin: (p) => school.pin(p), clock: h.clock };
}


/** Invented students for crowd tests: Student 01 through Student NN, all in Period 3. */
function crowd(count) {
  return Array.from({ length: count }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return [{ email: `student.${n}@students.mtmorrisschools.org`, name: `Student, Number${n}` }, 'Period 3'];
  });
}

module.exports = { world, crowd, PEOPLE, CODE };
