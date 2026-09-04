/**
 * An in-memory Google Apps Script runtime for the GrantDesk hall pass.
 *
 * The point of this file is to let Code.gs run for real, headlessly, against a
 * synthetic workbook. Assertions about source text can only prove a name is
 * present; Version 16 shipped a fault in a function the old suite name-checked
 * but never called, and it took the classroom down. Everything here exists so a
 * test can enter a PIN and then read the rows the app actually wrote.
 *
 * Nothing in here talks to Google. No roster, credential, or student record
 * from the live workbook is used or reproduced; every fixture is invented.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const CODE_PATH = path.join(__dirname, '..', '..', 'apps-script', 'hall-pass', 'Code.gs');

/* ------------------------------------------------------------------ sheets -- */

const A1_COLUMN_RANGE = /^([A-Z]+):([A-Z]+)$/;

function columnToIndex(letters) {
  return [...letters].reduce((total, letter) => total * 26 + (letter.charCodeAt(0) - 64), 0);
}

/**
 * Apps Script hands back a rectangle that stays live against the sheet. Reads
 * and writes both go through the parent, so a Range captured before a write
 * still sees the write, exactly as the real API behaves.
 */
class FakeRange {
  constructor(sheet, row, column, numRows, numColumns) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.numRows = numRows;
    this.numColumns = numColumns;
  }

  getRow() { return this.row; }
  getColumn() { return this.column; }
  getNumRows() { return this.numRows; }
  getNumColumns() { return this.numColumns; }

  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r += 1) {
      const row = [];
      for (let c = 0; c < this.numColumns; c += 1) {
        row.push(this.sheet.readCell(this.row + r, this.column + c));
      }
      out.push(row);
    }
    return out;
  }

  getValue() { return this.getValues()[0][0]; }

  getDisplayValues() {
    return this.getValues().map((row) => row.map((value) => (
      value === '' || value === null || value === undefined ? '' : String(value)
    )));
  }

  setValues(values) {
    if (!Array.isArray(values) || values.length !== this.numRows) {
      throw new Error(
        `setValues expected ${this.numRows} rows, received ${Array.isArray(values) ? values.length : typeof values}`
      );
    }
    values.forEach((row, r) => {
      if (!Array.isArray(row) || row.length !== this.numColumns) {
        throw new Error(
          `setValues expected ${this.numColumns} columns, received ${Array.isArray(row) ? row.length : typeof row}`
        );
      }
      row.forEach((value, c) => this.sheet.writeCell(this.row + r, this.column + c, value));
    });
    return this;
  }

  setValue(value) {
    for (let r = 0; r < this.numRows; r += 1) {
      for (let c = 0; c < this.numColumns; c += 1) {
        this.sheet.writeCell(this.row + r, this.column + c, value);
      }
    }
    return this;
  }

  clearContent() {
    for (let r = 0; r < this.numRows; r += 1) {
      for (let c = 0; c < this.numColumns; c += 1) {
        this.sheet.writeCell(this.row + r, this.column + c, '');
      }
    }
    return this;
  }

  // A checkbox is a data-validation skin over the same boolean cell, so the
  // harness only has to keep the call chainable.
  insertCheckboxes() { return this; }
  removeCheckboxes() { return this; }
  setDataValidation() { return this; }
  clearDataValidations() { return this; }

  // Presentation is irrelevant to behavior, but it has to chain like the real API.
  setNumberFormat() { return this; }
  setNumberFormats() { return this; }
  setFontWeight() { return this; }
  setFontColor() { return this; }
  setBackground() { return this; }
  setWrap() { return this; }
  setVerticalAlignment() { return this; }
  setHorizontalAlignment() { return this; }
  setBorder() { return this; }
}

class FakeSheet {
  constructor(name, maxColumns = 26) {
    this.name = name;
    this.rows = [];
    this.maxColumns = maxColumns;
    this.hidden = false;
    this.frozenRows = 0;
  }

  getName() { return this.name; }
  setName(name) { this.name = name; return this; }
  getMaxColumns() { return this.maxColumns; }
  getMaxRows() { return Math.max(this.rows.length, 1000); }

  ensureRow(row) {
    while (this.rows.length < row) this.rows.push(new Array(this.maxColumns).fill(''));
    return this.rows[row - 1];
  }

  readCell(row, column) {
    const record = this.rows[row - 1];
    if (!record) return '';
    const value = record[column - 1];
    return value === undefined ? '' : value;
  }

  writeCell(row, column, value) {
    if (column > this.maxColumns) {
      throw new Error(`${this.name}: write to column ${column} exceeds ${this.maxColumns} columns`);
    }
    const record = this.ensureRow(row);
    record[column - 1] = value === undefined || value === null ? '' : value;
  }

  isBlank(value) {
    return value === '' || value === null || value === undefined;
  }

  getLastRow() {
    for (let r = this.rows.length; r >= 1; r -= 1) {
      if (this.rows[r - 1].some((value) => !this.isBlank(value))) return r;
    }
    return 0;
  }

  getLastColumn() {
    let last = 0;
    this.rows.forEach((row) => {
      row.forEach((value, index) => {
        if (!this.isBlank(value)) last = Math.max(last, index + 1);
      });
    });
    return last;
  }

  getRange(a, b, c, d) {
    if (typeof a === 'string') {
      const match = A1_COLUMN_RANGE.exec(a.trim().toUpperCase());
      if (!match) throw new Error(`Unsupported A1 notation in the harness: ${a}`);
      const start = columnToIndex(match[1]);
      const end = columnToIndex(match[2]);
      return new FakeRange(this, 1, start, Math.max(this.getLastRow(), 1), end - start + 1);
    }
    return new FakeRange(this, a, b, c === undefined ? 1 : c, d === undefined ? 1 : d);
  }

  getDataRange() {
    return new FakeRange(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1));
  }

  appendRow(values) {
    const row = this.ensureRow(this.getLastRow() + 1);
    values.forEach((value, index) => {
      if (index >= this.maxColumns) throw new Error(`${this.name}: appendRow exceeds ${this.maxColumns} columns`);
      row[index] = value === undefined || value === null ? '' : value;
    });
    return this;
  }

  deleteRow(row) {
    this.rows.splice(row - 1, 1);
    return this;
  }

  deleteRows(row, count) {
    this.rows.splice(row - 1, count);
    return this;
  }

  insertColumnsAfter(_column, count) {
    this.maxColumns += count;
    this.rows.forEach((row) => {
      while (row.length < this.maxColumns) row.push('');
    });
    return this;
  }

  setFrozenRows(count) { this.frozenRows = count; return this; }
  hideSheet() { this.hidden = true; return this; }
  showSheet() { this.hidden = false; return this; }
  activate() { return this; }
  autoResizeColumn() { return this; }
  autoResizeColumns() { return this; }
  setColumnWidth() { return this; }

  /** Test-side convenience: every data row as an array, header excluded. */
  dataRows() {
    const last = this.getLastRow();
    if (last < 2) return [];
    return this.getRange(2, 1, last - 1, this.maxColumns).getValues();
  }

  /** Test-side convenience: data rows as objects keyed by the header text. */
  records() {
    const last = this.getLastRow();
    if (last < 1) return [];
    const headers = this.getRange(1, 1, 1, this.maxColumns).getValues()[0];
    return this.dataRows().map((row, index) => {
      const record = { __row: index + 2 };
      headers.forEach((header, column) => {
        if (String(header || '').trim()) record[String(header)] = row[column];
      });
      return record;
    });
  }
}

class FakeSpreadsheet {
  constructor(id) {
    this.id = id;
    this.sheets = [];
  }

  getId() { return this.id; }
  getName() { return 'GrantDesk Hall Pass — Test Workbook'; }
  getSheets() { return [...this.sheets]; }
  getSheetByName(name) { return this.sheets.find((sheet) => sheet.getName() === name) || null; }

  insertSheet(name) {
    if (this.getSheetByName(name)) throw new Error(`Sheet already exists: ${name}`);
    const sheet = new FakeSheet(name);
    this.sheets.push(sheet);
    return sheet;
  }

  deleteSheet(sheet) {
    this.sheets = this.sheets.filter((entry) => entry !== sheet);
  }
}

/* ------------------------------------------------------------- date format -- */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Utilities.formatDate is timezone-aware and the app depends on that: a school
 * date computed in UTC instead of America/Detroit lands on the wrong day for
 * anything after 8pm, which would silently corrupt streaks and daily limits.
 */
function formatDateInZone(date, timeZone, pattern) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  const hour24 = Number(parts.hour === '24' ? '0' : parts.hour);
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const meridiem = hour24 < 12 ? 'AM' : 'PM';

  return pattern
    .replace(/yyyy/g, parts.year)
    .replace(/MMM/g, MONTHS_SHORT[Number(parts.month) - 1])
    .replace(/MM/g, parts.month)
    .replace(/dd/g, parts.day)
    .replace(/HH/g, String(hour24).padStart(2, '0'))
    .replace(/hh/g, String(hour12).padStart(2, '0'))
    .replace(/mm/g, parts.minute)
    .replace(/ss/g, parts.second)
    .replace(/\bd\b/g, String(Number(parts.day)))
    .replace(/\bh\b/g, String(hour12))
    .replace(/\ba\b/g, meridiem);
}

/* ------------------------------------------------------------------ bytes --- */

// Apps Script byte arrays are signed. Round-tripping through unsigned bytes and
// back is what keeps hashes and tokens byte-identical to production.
const toSignedBytes = (buffer) => [...buffer].map((byte) => (byte > 127 ? byte - 256 : byte));
const toBuffer = (bytes) => Buffer.from(bytes.map((byte) => (byte < 0 ? byte + 256 : byte)));

/* ---------------------------------------------------------------- harness --- */

function createHarness(options = {}) {
  const {
    activeEmail = '',
    timeZone = 'America/Detroit',
    now = new Date('2026-09-04T13:00:00Z'),
    mailQuota = 1500,
    spreadsheetId = 'test-workbook-id',
  } = options;

  const state = {
    now: now instanceof Date ? new Date(now.getTime()) : new Date(now),
    activeEmail,
    timeZone,
    uuidCounter: 0,
    properties: new Map(),
    cache: new Map(),
    triggers: [],
    sentMail: [],
    mailQuota,
    lock: {
      held: false,
      waits: [],
      // Set to a number to refuse that many waitLock calls, simulating contention.
      refuseNext: 0,
      acquisitions: 0,
    },
    uiAlerts: [],
  };

  const spreadsheet = new FakeSpreadsheet(spreadsheetId);

  const clock = {
    set(value) { state.now = value instanceof Date ? new Date(value.getTime()) : new Date(value); },
    advanceSeconds(seconds) { state.now = new Date(state.now.getTime() + seconds * 1000); },
    advanceMinutes(minutes) { clock.advanceSeconds(minutes * 60); },
    advanceDays(days) { clock.advanceSeconds(days * 86400); },
    get() { return new Date(state.now.getTime()); },
  };

  // The app calls `new Date()` constantly. Tests need to control it, so the
  // sandbox gets a Date whose zero-argument form is the harness clock.
  class HarnessDate extends Date {
    constructor(...args) {
      if (args.length === 0) super(state.now.getTime());
      else super(...args);
    }
    static now() { return state.now.getTime(); }
  }

  const properties = {
    getProperty: (key) => (state.properties.has(key) ? state.properties.get(key) : null),
    setProperty: (key, value) => { state.properties.set(key, String(value)); return properties; },
    deleteProperty: (key) => { state.properties.delete(key); return properties; },
    getProperties: () => Object.fromEntries(state.properties),
    setProperties: (values) => {
      Object.entries(values).forEach(([key, value]) => state.properties.set(key, String(value)));
      return properties;
    },
    deleteAllProperties: () => { state.properties.clear(); return properties; },
    getKeys: () => [...state.properties.keys()],
  };

  const cache = {
    get: (key) => {
      const entry = state.cache.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= state.now.getTime()) {
        state.cache.delete(key);
        return null;
      }
      return entry.value;
    },
    put: (key, value, seconds) => {
      state.cache.set(key, {
        value: String(value),
        expiresAt: state.now.getTime() + (Number(seconds) || 600) * 1000,
      });
    },
    remove: (key) => { state.cache.delete(key); },
    getAll: (keys) => {
      const out = {};
      keys.forEach((key) => {
        const value = cache.get(key);
        if (value !== null) out[key] = value;
      });
      return out;
    },
    removeAll: (keys) => keys.forEach((key) => state.cache.delete(key)),
  };

  const scriptLock = {
    waitLock(timeoutMs) {
      state.lock.waits.push({ timeoutMs, at: state.now.getTime() });
      if (state.lock.refuseNext > 0) {
        state.lock.refuseNext -= 1;
        throw new Error('Could not obtain lock in time.');
      }
      if (state.lock.held) throw new Error('Could not obtain lock in time.');
      state.lock.held = true;
      state.lock.acquisitions += 1;
      return true;
    },
    tryLock(timeoutMs) {
      try {
        scriptLock.waitLock(timeoutMs);
        return true;
      } catch (error) {
        return false;
      }
    },
    releaseLock() { state.lock.held = false; },
    hasLock() { return state.lock.held; },
  };

  const sandbox = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    Date: HarnessDate,

    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet,
      openById: () => spreadsheet,
      getUi: () => {
        const ui = {
          ButtonSet: { OK: 'OK', OK_CANCEL: 'OK_CANCEL', YES_NO: 'YES_NO' },
          Button: { OK: 'OK', CANCEL: 'CANCEL', YES: 'YES', NO: 'NO' },
          alert: (...args) => { state.uiAlerts.push(args); return 'OK'; },
          prompt: () => ({ getResponseText: () => '', getSelectedButton: () => 'CANCEL' }),
          createMenu: () => {
            const menu = { addItem: () => menu, addSeparator: () => menu, addSubMenu: () => menu, addToUi: () => menu };
            return menu;
          },
          showSidebar: () => {},
          showModalDialog: () => {},
        };
        return ui;
      },
      flush: () => {},
    },

    PropertiesService: {
      getScriptProperties: () => properties,
      getUserProperties: () => properties,
      getDocumentProperties: () => properties,
    },

    CacheService: {
      getScriptCache: () => cache,
      getUserCache: () => cache,
      getDocumentCache: () => cache,
    },

    LockService: {
      getScriptLock: () => scriptLock,
      getUserLock: () => scriptLock,
      getDocumentLock: () => scriptLock,
    },

    Session: {
      getActiveUser: () => ({ getEmail: () => state.activeEmail }),
      getEffectiveUser: () => ({ getEmail: () => state.activeEmail }),
      getScriptTimeZone: () => state.timeZone,
    },

    Utilities: {
      Charset: { UTF_8: 'UTF_8', US_ASCII: 'US_ASCII' },
      DigestAlgorithm: { SHA_256: 'SHA_256', SHA_1: 'SHA_1', MD5: 'MD5' },

      getUuid: () => {
        state.uuidCounter += 1;
        const n = String(state.uuidCounter).padStart(12, '0');
        return `00000000-0000-4000-8000-${n}`;
      },

      // Accepts a string or a signed byte array, as the real API does. Passing a
      // byte array through String() instead would silently corrupt every token.
      newBlob: (value) => {
        const buffer = Array.isArray(value) ? toBuffer(value) : Buffer.from(String(value), 'utf8');
        return {
          getBytes: () => toSignedBytes(buffer),
          getDataAsString: () => buffer.toString('utf8'),
          getContentType: () => 'text/plain',
        };
      },

      base64EncodeWebSafe: (input) => {
        const buffer = Array.isArray(input) ? toBuffer(input) : Buffer.from(String(input), 'utf8');
        return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
      },

      base64Encode: (input) => {
        const buffer = Array.isArray(input) ? toBuffer(input) : Buffer.from(String(input), 'utf8');
        return buffer.toString('base64');
      },

      base64DecodeWebSafe: (value) => toSignedBytes(
        Buffer.from(String(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64')
      ),

      base64Decode: (value) => toSignedBytes(Buffer.from(String(value), 'base64')),

      computeDigest: (algorithm, value) => {
        const nodeAlgorithm = { SHA_256: 'sha256', SHA_1: 'sha1', MD5: 'md5' }[algorithm] || 'sha256';
        return toSignedBytes(crypto.createHash(nodeAlgorithm).update(String(value), 'utf8').digest());
      },

      computeHmacSha256Signature: (value, key) => toSignedBytes(
        crypto.createHmac('sha256', String(key)).update(String(value), 'utf8').digest()
      ),

      formatDate: (date, zone, pattern) => formatDateInZone(date, zone, pattern),
      sleep: () => {},
    },

    MailApp: {
      getRemainingDailyQuota: () => state.mailQuota,
      sendEmail: (message) => {
        state.sentMail.push(message);
        state.mailQuota = Math.max(0, state.mailQuota - 1);
      },
    },

    HtmlService: {
      createTemplateFromFile: () => ({
        evaluate: () => ({
          setTitle: function setTitle() { return this; },
          setXFrameOptionsMode: function setXFrame() { return this; },
          addMetaTag: function addMetaTag() { return this; },
          setFaviconUrl: function setFavicon() { return this; },
        }),
      }),
      XFrameOptionsMode: { ALLOWALL: 'ALLOWALL', DEFAULT: 'DEFAULT' },
    },

    ScriptApp: {
      getProjectTriggers: () => state.triggers.map((trigger) => ({
        getHandlerFunction: () => trigger.handler,
        getUniqueId: () => trigger.id,
      })),
      deleteTrigger: (trigger) => {
        const id = trigger.getUniqueId();
        state.triggers = state.triggers.filter((entry) => entry.id !== id);
      },
      newTrigger: (handler) => {
        const builder = {
          timeBased: () => builder,
          everyDays: () => builder,
          everyHours: () => builder,
          atHour: () => builder,
          create: () => {
            const trigger = { handler, id: `trigger-${state.triggers.length + 1}` };
            state.triggers.push(trigger);
            return { getHandlerFunction: () => handler, getUniqueId: () => trigger.id };
          },
        };
        return builder;
      },
    },
  };

  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  const source = fs.readFileSync(CODE_PATH, 'utf8').replace(/\r\n/g, '\n');
  vm.runInContext(source, sandbox, { filename: CODE_PATH });

  /** Call any top-level function in Code.gs by name. */
  const call = (name, ...args) => {
    const fn = sandbox[name];
    if (typeof fn !== 'function') throw new Error(`Code.gs has no function named ${name}`);
    return fn(...args);
  };

  const sheet = (name) => {
    const found = spreadsheet.getSheetByName(name);
    if (!found) throw new Error(`No sheet named ${name}. Present: ${spreadsheet.getSheets().map((s) => s.getName()).join(', ')}`);
    return found;
  };

  return {
    sandbox,
    context: sandbox,
    spreadsheet,
    state,
    clock,
    call,
    sheet,
    properties,
    cache,
    lock: state.lock,
    sentMail: state.sentMail,
    signInAs(email) { state.activeEmail = email; },
    signOut() { state.activeEmail = ''; },
    /** Apps Script gives every request a fresh global scope; mirror that between calls. */
    newRequest() {
      if (typeof sandbox.gdClearMemo_ === 'function') sandbox.gdClearMemo_();
    },
    setMailQuota(value) { state.mailQuota = value; },
    refuseLocks(count) { state.lock.refuseNext = count; },
  };
}

module.exports = { createHarness, formatDateInZone, FakeSheet, FakeSpreadsheet };
