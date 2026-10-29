/*
 * the desk · desk-save.js
 *
 * One save system for every hub with answer boxes. Load it once, near the end
 * of the page:  <script src="/hubs/desk-save.js" defer></script>
 *
 * What it does for a student:
 *   0. The page opens behind a PIN gate. After the hall pass PIN and a name
 *      check, account saving runs from the first answer and earlier work
 *      loads. Teacher devices skip it with ?deskteacher=on (once per browser).
 *   1. Every answer box saves while they type and survives a refresh. The copy
 *      lives in this browser tab only, so the next student on a shared
 *      Chromebook opens a blank page.
 *   2. With their hall pass PIN, work also saves to their account and comes
 *      back on any Chromebook.
 *   3. A Turn In panel at the bottom sends the answers to the teacher's private
 *      sheet and shows a confirmation only after the sheet has them.
 *   4. Common controls load account work, export/import a personal backup, copy
 *      answers and show acknowledged Turn In references. Exit warnings protect
 *      work that has no confirmed account copy or successful clipboard copy.
 *   5. A writing timeline records how each answer took shape in this tab:
 *      typing in short batches, pastes, text that appeared without typing,
 *      loads, and time away from the page. It goes to the teacher's private
 *      Writing Timeline sheet only with Turn In. Students are told on the page.
 *   6. Read aloud, bottom left, reads selected text or the passage in the
 *      middle of the screen with the Chromebook's own voice. Nothing is sent.
 *
 * Placement: the Turn In panel goes inside <div data-desk-turnin></div> when a
 * hub has one, otherwise at the end of the page. Put data-desk-skip on any
 * input (or wrapper) that is not an answer, such as a search box.
 *
 * Setup: paste the Turn In web app URL (ends in /exec) into ENDPOINT below.
 * With ENDPOINT empty, everything except the account save and Turn In works.
 */
(function () {
  'use strict';

  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbzssPoF99g1UTOrsVnMHy-jQaPwII8-lyxHwjlpNK8oa89KVSq48G5MkjiwTOCrgaJP/exec';

  if (window.__deskSave) return;
  window.__deskSave = { version: '3' };

  var IDLE_SIGNOUT_MS = 20 * 60 * 1000;
  var CLOUD_DEBOUNCE_MS = 60 * 1000;
  var CLOUD_MAX_WAIT_MS = 60 * 1000;
  // Long assignments may request a more frequent, bounded cloud cadence.
  // Local tab persistence still runs on every answer edit.
  var requestedAutosave = Number(document.body && document.body.getAttribute('data-desk-autosave-ms'));
  if (requestedAutosave >= 15000 && requestedAutosave <= 60000) {
    CLOUD_DEBOUNCE_MS = requestedAutosave;
    CLOUD_MAX_WAIT_MS = Math.max(requestedAutosave, 30000);
  }
  var cadenceText = requestedAutosave >= 15000 && requestedAutosave <= 60000
    ? 'after a short pause, or about every ' + Math.round(CLOUD_MAX_WAIT_MS / 1000) + ' seconds while you keep typing'
    : 'about once a minute';
  var SNAPSHOT_MS = 4000;
  var REQUEST_TIMEOUT_MS = 15000;

  var testHooks = window.__deskSaveTest || null;
  if (testHooks) {
    if (typeof testHooks.endpoint === 'string') ENDPOINT = testHooks.endpoint;
    if (testHooks.idleMs) IDLE_SIGNOUT_MS = testHooks.idleMs;
    if (testHooks.debounceMs) CLOUD_DEBOUNCE_MS = testHooks.debounceMs;
    if (testHooks.snapshotMs) SNAPSHOT_MS = testHooks.snapshotMs;
  }
  var cloudOn = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(ENDPOINT) || Boolean(testHooks && ENDPOINT);

  // Every answer page opens behind the hall pass PIN, so work saves to the
  // student's account from the first answer. A teacher device (projector,
  // preview) skips the gate after visiting any hub once with ?deskteacher=on,
  // and ?deskteacher=off turns the gate back on for that browser.
  var teacherDevice = false;
  try {
    var teacherParam = new URLSearchParams(location.search).get('deskteacher');
    if (teacherParam === 'on') localStorage.setItem('desk-save:teacher', '1');
    if (teacherParam === 'off') localStorage.removeItem('desk-save:teacher');
    teacherDevice = localStorage.getItem('desk-save:teacher') === '1';
  } catch (e) { /* storage blocked: the gate stays on */ }
  var gateOn = cloudOn && !teacherDevice && !(testHooks && testHooks.gate === false);
  // The PIN typed at the gate stays in this page's memory only, so Turn In
  // does not ask for it again. It is never written to storage.
  var heldPin = '';

  var hub = (location.pathname.replace(/\/+$/, '').split('/').pop() || 'hub').replace(/\.html?$/i, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'hub';
  var course = (hub.match(/^(ush9|hh|bts)(?=-|$)/) || [])[1] || '';
  var STORE_KEY = 'desk-save:v1:' + hub;

  /* ------------------------------------------------------------ storage -- */

  var memory = {};
  function readJson(store, key) {
    try {
      var raw = window[store].getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return memory[store + key] || null;
    }
  }
  var tabDurable = false;
  var applying = false;
  var transitioning = false;
  var generation = 0;
  function writeJson(store, key, value) {
    memory[store + key] = value;
    try {
      var json = JSON.stringify(value);
      window[store].setItem(key, json);
      return window[store].getItem(key) === json;
    } catch (e) { return false; }
  }
  function removeKey(store, key) {
    delete memory[store + key];
    try { window[store].removeItem(key); } catch (e) { /* nothing to remove */ }
  }

  function randomId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  var device = readJson('localStorage', 'desk-save:device');
  if (!device) { device = randomId(); writeJson('localStorage', 'desk-save:device', device); }
  // One id per open tab, so the server can tell this tab's own late save from another tab's work.
  var tabId = readJson('sessionStorage', 'desk-save:tab');
  if (!tabId) { tabId = randomId(); writeJson('sessionStorage', 'desk-save:tab', tabId); }

  var state = null;
  function blankState() {
    return { values: {}, updatedAt: 0, lastActive: Date.now(), token: '', firstName: '', classPeriod: '', classes: [], cloudHash: '', cloudAt: '', turnedInHash: '', turnedInAt: '', classroomUrl: '', copiedHash: '', submission: null, everSaved: false, identityKey: '', remoteAt: '', conflict: false, receipt: null, saveError: '', backupHash: '', undoValues: null };
  }
  function persist() { tabDurable = writeJson('sessionStorage', STORE_KEY, state); return tabDurable; }

  /* ------------------------------------------------------------- fields -- */

  var keyOf = new WeakMap();

  function fields() {
    var list = Array.prototype.slice.call(document.querySelectorAll('textarea, input[type="text"], input:not([type])'));
    return list.filter(function (el) {
      return !el.disabled && !el.closest('[data-desk-skip]') && el.type !== 'hidden';
    });
  }

  function assignKeys(list) {
    var seen = {};
    var unnamed = 0;
    list.forEach(function (el) {
      var base;
      if (el.id) base = 'id:' + el.id;
      else if (el.getAttribute('data-q')) base = 'q:' + el.getAttribute('data-q').slice(0, 80);
      else if (el.name) base = 'n:' + el.name;
      else base = 'i:' + (unnamed++);
      var key = base;
      if (seen[base]) key = base + '#' + (++seen[base]);
      else seen[base] = 1;
      keyOf.set(el, key);
    });
  }

  function snapshot() {
    var list = fields();
    assignKeys(list);
    var values = {};
    list.forEach(function (el) { values[keyOf.get(el)] = el.value; });
    radioGroups().forEach(function (g) {
      var on = g.radios.filter(function (r) { return r.checked; })[0];
      values['r:' + g.name] = on ? on.value : '';
    });
    return values;
  }

  /* Choice buttons, such as picking an essay prompt, grouped by name. */
  function radioGroups() {
    var groups = {};
    var order = [];
    Array.prototype.slice.call(document.querySelectorAll('input[type="radio"][name]')).forEach(function (r) {
      if (r.disabled || r.closest('[data-desk-skip]')) return;
      if (!groups[r.name]) { groups[r.name] = { name: r.name, radios: [] }; order.push(r.name); }
      groups[r.name].radios.push(r);
    });
    return order.map(function (n) { return groups[n]; });
  }

  function radioText(r) {
    var holder = r.closest('label') || (r.labels && r.labels[0]);
    return (holder ? spacedText(holder) : '') || r.value;
  }

  function groupLabel(g) {
    if (g.name === 'prompt') return 'Essay prompt';
    var set = g.radios[0].closest('fieldset');
    var legend = set && set.querySelector('legend');
    return legend ? spacedText(legend) : 'Choice: ' + g.name;
  }

  function checkRadio(g, match) {
    var target = g.radios.filter(match)[0];
    var changed = false;
    g.radios.forEach(function (r) {
      var want = r === target;
      if (r.checked !== want) { r.checked = want; changed = true; }
    });
    if (changed) (target || g.radios[0]).dispatchEvent(new Event('change', { bubbles: true }));
    return changed;
  }

  function resetRadios() {
    radioGroups().forEach(function (g) { checkRadio(g, function (r) { return r.defaultChecked; }); });
  }

  function setValue(el, value) {
    if (el.value === value) return false;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function visible(el) {
    return Boolean(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function clean(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  /** Text of a block with a space between its pieces, so "A1" and "Why…" do not run together. */
  function spacedText(node) {
    var parts = [];
    var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
      var parent = walker.currentNode.parentElement;
      if (parent && parent.closest('script,style,button')) continue;
      parts.push(walker.currentNode.nodeValue);
    }
    return clean(parts.join(' '));
  }

  function labelFor(el) {
    // Drop live counters such as "Word count 0 / 250" that sit inside some labels.
    return rawLabel(el).replace(/\s*(word count|words)\s+\d+\b.*$/i, '').trim() || 'Answer';
  }

  function rawLabel(el) {
    var dq = clean(el.getAttribute('data-q') || el.getAttribute('data-back'));
    if (dq.length > 14 && /\s/.test(dq)) return dq.slice(0, 380);
    if (el.labels && el.labels.length) {
      var own = spacedText(el.labels[0]);
      if (own.length > 3) return own.slice(0, 380);
    }
    var by = el.getAttribute('aria-labelledby');
    if (by) {
      var text = clean(by.split(/\s+/).map(function (id) { var n = document.getElementById(id); return n ? n.textContent : ''; }).join(' '));
      if (text.length > 3) return text.slice(0, 380);
    }
    var aria = clean(el.getAttribute('aria-label'));
    if (aria.length >= 5 && !/^(your )?answer\b/i.test(aria)) return aria.slice(0, 380);

    // The nearest text block just before the box, for markup like <div class="q"><div>question</div><textarea>.
    var branch = el;
    for (var up = 0; up < 3 && branch.parentElement; up++) {
      var sib = branch.previousElementSibling;
      while (sib) {
        if (!sib.matches('script,style,button,input,textarea,select,img,svg,figure') && !sib.querySelector('textarea,input,select')) {
          var near = spacedText(sib);
          if (near.length >= 8) return near.slice(0, 380);
        }
        if (sib.querySelector && sib.querySelector('textarea,input,select')) break;
        sib = sib.previousElementSibling;
      }
      branch = branch.parentElement;
      if (branch.matches('section,article,main,body')) break;
    }

    var node = el;
    for (var depth = 0; depth < 5 && node.parentElement; depth++) {
      node = node.parentElement;
      var candidates = node.querySelectorAll('h1,h2,h3,h4,h5,h6,label,legend,p,dt,li,strong,b,blockquote,.q,.prompt,.question');
      for (var i = candidates.length - 1; i >= 0; i--) {
        var c = candidates[i];
        if (c.contains(el) || c.querySelector('textarea,input')) continue;
        if (!(c.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
        var t = spacedText(c);
        if (t.length >= 8) return t.slice(0, 380);
      }
    }
    return clean(el.getAttribute('placeholder') || aria || dq || el.id || 'Answer').slice(0, 380);
  }

  function answers(forSending) {
    var list = fields();
    assignKeys(list);
    // Hidden research rounds still belong to the assignment. Never omit blanks.
    var out = list.map(function (el) {
      return { k: keyOf.get(el), q: labelFor(el), a: el.value };
    });
    radioGroups().forEach(function (g) {
      var on = g.radios.filter(function (r) { return r.checked; })[0];
      out.push({ k: 'r:' + g.name, q: groupLabel(g), a: on ? radioText(on).slice(0, 600) : '' });
    });
    return out;
  }

  function hashOf(list) {
    return JSON.stringify(list.map(function (e) { return [e.k, e.a]; }));
  }

  function answeredCount(list) {
    return list.filter(function (e) { return clean(e.a); }).length;
  }

  function hasWork() {
    var values = snapshot();
    return fields().some(function (el) { return clean(values[keyOf.get(el)]) && values[keyOf.get(el)] !== el.defaultValue; }) || radioGroups().some(function (g) { return g.radios.some(function (r) { return r.checked && !r.defaultChecked; }); });
  }

  /* ------------------------------------------------------------ network -- */

  function post(body, options) {
    options = options || {};
    var attempts = options.attempts || 1;
    body.device = device;
    body.tab = tabId;
    if (testHooks && testHooks.loadTestKey) body.test = testHooks.loadTestKey;
    function once() {
      var controller = window.AbortController ? new AbortController() : null;
      var timer = setTimeout(function () { if (controller) controller.abort(); }, options.timeoutMs || REQUEST_TIMEOUT_MS);
      return fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        redirect: 'follow',
        credentials: 'omit',
        keepalive: body.action === 'save',
        signal: controller ? controller.signal : undefined
      }).then(function (response) {
        if (!response.ok) { clearTimeout(timer); throw new Error('http ' + response.status); }
        return response.json().finally(function () { clearTimeout(timer); });
      }, function (error) {
        clearTimeout(timer);
        throw error;
      });
    }
    function attempt(n) {
      return once().then(function (result) {
        if (result && (result.code === 'server' || result.code === 'busy') && n < attempts) return wait(n).then(function () { return attempt(n + 1); });
        return result;
      }, function (error) {
        if (n < attempts) return wait(n).then(function () { return attempt(n + 1); });
        throw error;
      });
    }
    return attempt(1);
  }

  function wait(n) {
    return new Promise(function (resolve) { setTimeout(resolve, 1200 * n + Math.random() * 800); });
  }

  /* -------------------------------------------------------------- cloud -- */

  var cloudTimer = null;
  var cloudFirstPending = 0;
  var cloudBusy = false;
  var cloudPromise = null;
  var finishing = false;
  var cloudRetry = 0;

  function scheduleCloud() {
    if (!cloudOn || !state.token || applying || transitioning || finishing || state.conflict) return;
    var now = Date.now();
    if (!cloudFirstPending) cloudFirstPending = now;
    clearTimeout(cloudTimer);
    var delay = Math.max(0, Math.min(CLOUD_DEBOUNCE_MS, cloudFirstPending + CLOUD_MAX_WAIT_MS - now));
    cloudTimer = setTimeout(saveCloud, delay);
  }

  function saveCloud() {
    clearTimeout(cloudTimer);
    if (!cloudOn || !state.token || transitioning || finishing || state.conflict) return Promise.resolve(false);
    var list = answers(false);
    var hash = hashOf(list);
    if (hash === state.cloudHash) { cloudFirstPending = 0; return Promise.resolve(true); }
    if (!answeredCount(list) && !state.everSaved) { state.cloudHash = hash; return Promise.resolve(true); }
    if (cloudBusy) return cloudPromise.then(function () { return saveCloud(); });
    cloudBusy = true;
    var started = generation, owner = state;
    cloudPromise = post({ writeProtocol: 1, baseRevision: state.remoteAt, action: 'save', token: state.token, hub: hub, course: course, classPeriod: state.classPeriod, title: document.title, page: location.pathname, answers: list }).then(function (result) {
      cloudBusy = false;
      if (started !== generation || state !== owner) return false;
      if (result && result.code === 'conflict') {
        state.conflict = true; persist();
        ui.refresh('Another tab or device saved a different version. Download a backup, then Load My Work to compare. Account saving is paused.');
        return false;
      }
      if (result && result.ok && result.savedAt && Number.isFinite(Date.parse(result.savedAt))) {
        state.cloudHash = hash;
        state.everSaved = true;
        state.cloudAt = result.savedAt;
        state.remoteAt = result.revision || result.savedAt;
        cloudFirstPending = 0;
        cloudRetry = 0;
        persist();
        ui.refresh();
        if (hashOf(answers(false)) !== state.cloudHash) scheduleCloud();
        return true;
      }
      if (result && result.code === 'signed_out') {
        state.token = '';
        persist();
        ui.refresh('Enter your PIN again to keep saving to your account.');
        return false;
      }
      if (result && /^(too_big|bad_request|refused|reload_required)$/.test(result.code)) { state.saveError = result.error || 'Account save was refused.'; persist(); ui.refresh(); return false; }
      throw new Error(result && result.error || 'save failed');
    }).catch(function () {
      cloudBusy = false;
      if (started !== generation || state !== owner) return false;
      cloudRetry = Math.min(cloudRetry + 1, 4);
      clearTimeout(cloudTimer);
      cloudTimer = setTimeout(saveCloud, 15000 * cloudRetry);
      ui.refresh();
      return false;
    });
    return cloudPromise;
  }

  function beaconSave() {
    // Unacknowledged unload writes can race newer work. Save through the
    // acknowledged queue while visible; keep the tab/backup warning on exit.
    if (state) { persist(); saveCloud(); }
  }

  /* ----------------------------------------------------------- timeline -- */

  // Writing timeline: how each answer took shape in this tab. It is sent only
  // with Turn In, to the teacher's private sheet. It shows typing, pastes, text
  // that appeared without typing and time away from the page. It is evidence for
  // a conversation, never a verdict: it cannot see other devices or who typed.
  var TL_KEY = 'desk-save:timeline:v1:' + hub;
  var TL_FLUSH_MS = testHooks && testHooks.timelineFlushMs || 15000;
  var TL_MAX_CHARS = 45000;
  var TL_BIG = 25;
  var TL_HIST = [150, 300, 600, 1500, 5000, 30000];
  var tl = null;
  var tlTimer = null;
  var awayStart = 0;

  function tlBlank() { return { v: 1, startedAt: new Date().toISOString(), t0: Date.now(), f: {}, away: [], marks: [], bases: {} }; }
  function tlSec(ms) { return Math.max(0, Math.round(((ms || Date.now()) - tl.t0) / 1000)); }
  function tlField(key) {
    return tl.f[key] || (tl.f[key] = { ops: [], typed: 0, del: 0, pasted: 0, big: 0, hist: [0, 0, 0, 0, 0, 0, 0], ms: 0, lastKey: 0, lastEdit: 0, pending: 0, seen: null });
  }
  function tlDiff(a, b) {
    if (a === b) return null;
    var s = 0, max = Math.min(a.length, b.length);
    while (s < max && a.charCodeAt(s) === b.charCodeAt(s)) s++;
    var ea = a.length, eb = b.length;
    while (ea > s && eb > s && a.charCodeAt(ea - 1) === b.charCodeAt(eb - 1)) { ea--; eb--; }
    return [s, ea - s, b.slice(s, eb)];
  }
  function tlOp(key, text, kind, at) {
    var rec = tlField(key);
    var d = tlDiff(tl.bases[key] || '', text);
    rec.pending = 0;
    if (!d) return;
    rec.ops.push([at == null ? tlSec() : at, d[0], d[1], d[2], kind]);
    tl.bases[key] = text;
    if (/^[pbx]$/.test(kind)) rec.big = Math.max(rec.big, d[2].length);
  }
  // Typing is stored in short batches rather than per key.
  function tlFlush(key, text) {
    var rec = tl.f[key];
    if (rec && rec.pending) tlOp(key, text, 't', tlSec(rec.lastEdit));
  }
  function tlFlushAll() {
    if (!tl) return;
    var list = fields(); assignKeys(list);
    list.forEach(function (el) { var rec = tl.f[keyOf.get(el)]; if (rec && rec.pending) tlFlush(keyOf.get(el), rec.seen == null ? el.value : rec.seen); });
  }
  function tlSave(now) {
    if (!tl) return;
    clearTimeout(tlTimer);
    if (now) { writeJson('sessionStorage', TL_KEY, tl); return; }
    tlTimer = setTimeout(function () { writeJson('sessionStorage', TL_KEY, tl); }, 1000);
  }
  // Programmatic changes: initial values, account loads, backups and undo.
  function tlSync(kind) {
    if (!tl) return;
    var list = fields(); assignKeys(list);
    list.forEach(function (el) {
      var key = keyOf.get(el), rec = tlField(key);
      if (rec.pending) tlFlush(key, rec.seen == null ? el.value : rec.seen);
      tlOp(key, el.value, kind);
      rec.seen = el.value;
    });
    tlSave();
  }
  function tlReset() {
    tl = tlBlank();
    tlSync('i');
    tlSave(true);
  }
  function tlMark(name) { if (tl) { tl.marks.push([tlSec(), name]); if (tl.marks.length > 100) tl.marks.shift(); tlSave(); } }

  function tlInput(e) {
    var el = e.target;
    if (!tl || applying || fields().indexOf(el) < 0) return;
    var key = keyOf.get(el);
    if (!key) { assignKeys(fields()); key = keyOf.get(el); }
    var rec = tlField(key), now = Date.now(), type = e.inputType || '';
    var prev = rec.seen != null ? rec.seen : (tl.bases[key] || '');
    var d = tlDiff(prev, el.value);
    rec.seen = el.value;
    if (!d) return;
    var ins = d[2].length;
    rec.del += d[1];
    if (rec.lastEdit && now - rec.lastEdit < 60000) rec.ms += now - rec.lastEdit;
    rec.lastEdit = now;
    var key1 = (type === 'insertText' || type === 'insertCompositionText') && ins <= 3;
    var small = key1 || type === 'insertLineBreak' || type === 'insertParagraph' || /^delete/.test(type) || (type === 'insertReplacementText' && ins < TL_BIG) || (!type && ins <= 3);
    if (small) {
      if (key1 || type === 'insertLineBreak' || type === 'insertParagraph') {
        rec.typed += ins;
        if (rec.lastKey) {
          var gap = now - rec.lastKey, b = 0;
          while (b < TL_HIST.length && gap >= TL_HIST[b]) b++;
          rec.hist[b]++;
        }
        rec.lastKey = now;
      }
      if (!rec.pending) rec.pending = now;
      if (now - rec.pending >= TL_FLUSH_MS) tlFlush(key, el.value);
    } else {
      // Anything larger than a keystroke is stored on its own, with its kind.
      if (rec.pending) tlOp(key, prev, 't', tlSec(rec.lastEdit));
      var kind = /^insertFrom(Paste|Drop)/.test(type) ? 'p' : /^history/.test(type) ? 'u' : type ? 'b' : 'x';
      if (kind === 'p') rec.pasted += ins;
      tlOp(key, el.value, kind);
      rec.lastKey = 0;
    }
    tlSave();
  }
  // Text that changed with no input event: set by the page or an extension.
  function tlTick() {
    if (!tl || applying) return;
    var now = Date.now(), list = fields(); assignKeys(list);
    list.forEach(function (el) {
      var key = keyOf.get(el), rec = tlField(key);
      if (rec.seen == null) rec.seen = tl.bases[key] || '';
      if (el.value !== rec.seen) {
        if (rec.pending) tlOp(key, rec.seen, 't', tlSec(rec.lastEdit));
        tlOp(key, el.value, 'x');
        rec.seen = el.value;
        tlSave();
      } else if (rec.pending && now - rec.pending >= TL_FLUSH_MS) { tlFlush(key, el.value); tlSave(); }
    });
  }
  function tlAway() {
    if (!tl || awayStart) return;
    awayStart = Date.now();
    tlFlushAll();
    tlSave(true);
  }
  function tlBack() {
    if (!tl || !awayStart) return;
    var dur = Date.now() - awayStart, at = tlSec(awayStart);
    awayStart = 0;
    if (dur < 2000) return;
    tl.away.push([at, Math.round(dur / 1000)]);
    if (tl.away.length > 300) tl.away.shift();
    tlSave();
  }
  // Rebuild every saved text so long timelines can be thinned to fit.
  function tlTexts(ops) {
    var text = '', out = [];
    ops.forEach(function (op) { text = text.slice(0, op[1]) + op[3] + text.slice(op[1] + op[2]); out.push(text); });
    return out;
  }
  function tlThin(rec) {
    var texts = tlTexts(rec.ops), kept = [], keptTexts = [], merged = false;
    for (var i = 0; i < rec.ops.length; i++) {
      var op = rec.ops[i], next = rec.ops[i + 1];
      if (op[4] === 't' && next && next[4] === 't') {
        var d = tlDiff(keptTexts.length ? keptTexts[keptTexts.length - 1] : '', texts[i + 1]);
        if (d) { kept.push([next[0], d[0], d[1], d[2], 't']); keptTexts.push(texts[i + 1]); }
        i++; merged = true;
      } else {
        var d2 = tlDiff(keptTexts.length ? keptTexts[keptTexts.length - 1] : '', texts[i]);
        if (d2) { kept.push([op[0], d2[0], d2[1], d2[2], op[4]]); keptTexts.push(texts[i]); }
      }
    }
    rec.ops = kept;
    return merged;
  }
  function tlPayload() {
    try {
      if (!tl) return undefined;
      tlTick(); tlFlushAll();
      var out = { v: 1, startedAt: tl.startedAt, sentAt: new Date().toISOString(), fields: {}, away: tl.away.slice(), marks: tl.marks.slice() };
      var list = fields(); assignKeys(list);
      list.forEach(function (el) {
        var key = keyOf.get(el), rec = tl.f[key];
        if (!rec || !rec.ops.length) return;
        out.fields[key] = { ops: rec.ops.slice(), typed: rec.typed, del: rec.del, pasted: rec.pasted, big: rec.big, hist: rec.hist.slice(), ms: rec.ms };
      });
      var guard = 0;
      while (JSON.stringify(out).length > TL_MAX_CHARS && guard++ < 12) {
        var any = false;
        Object.keys(out.fields).forEach(function (k) { if (tlThin(out.fields[k])) any = true; });
        if (!any) break;
      }
      if (JSON.stringify(out).length > TL_MAX_CHARS) {
        // Keep the counts and the large events; drop the step by step replay.
        Object.keys(out.fields).forEach(function (k) {
          var f = out.fields[k];
          f.notable = f.ops.filter(function (op) { return /^[pbx]$/.test(op[4]); }).map(function (op) { return [op[0], op[4], op[3].length]; }).slice(-40);
          f.ops = [];
        });
        out.truncated = true;
      }
      return out;
    } catch (error) {
      return undefined;
    }
  }

  /* ------------------------------------------------------------- events -- */

  function onEdit() {
    if (applying) return;
    var values = snapshot();
    if (JSON.stringify(values) === JSON.stringify(state.values)) return;
    state.saveError = '';
    state.values = values;
    state.updatedAt = Date.now();
    state.lastActive = Date.now();
    persist();
    scheduleCloud();
    ui.refresh();
  }

  var lastActivityWrite = 0;
  function onActivity() {
    state.lastActive = Date.now();
    if (state.lastActive - lastActivityWrite > 15000) { lastActivityWrite = state.lastActive; persist(); }
  }

  function idleCheck() {
    if (!state.token || Date.now() - state.lastActive < IDLE_SIGNOUT_MS) return;
    saveCloud().then(function (saved) {
      if (!saved || !state.token || hashOf(answers(false)) !== state.cloudHash || Date.now() - state.lastActive < IDLE_SIGNOUT_MS) return;
      var name = state.firstName;
      resetPage();
      ui.refresh('Signed out after 20 quiet minutes. ' + (name ? name + ', your' : 'Your') + ' work is saved. Enter your PIN to bring it back.');
    });
  }

  function resetPage() {
    heldPin = '';
    generation++; clearTimeout(cloudTimer); cloudFirstPending = 0;
    applying = true;
    fields().forEach(function (el) { setValue(el, el.defaultValue); });
    resetRadios();
    state = blankState();
    state.values = snapshot();
    persist();
    window.dispatchEvent(new Event('desk-save:reset'));
    applying = false;
  }

  /* ------------------------------------------------------------ actions -- */

  function signIn(pin, options) {
    if (transitioning || finishing) return Promise.resolve({ ok: false, message: 'Wait for the current account check.' });
    transitioning = true;
    clearTimeout(cloudTimer);
    var beforeHash = hashOf(answers(false));
    var beforeOwner = state;
    return Promise.resolve(cloudPromise).then(function () {
      return post({ action: 'signin', pin: pin, hub: hub, course: course }, { attempts: 2 });
    }).then(function (result) {
      if (!result || !result.ok) return { ok: false, code: result && result.code || 'server', message: result && result.error || 'That did not go through. Try again.' };
      if (state !== beforeOwner || beforeHash !== hashOf(answers(false))) return { ok: false, message: 'Your answers changed while loading. They were kept. Choose Load My Work again when ready.' };
      var draft = result.draft && Array.isArray(result.draft.answers) ? result.draft : null;
      var switching = Boolean(state.token);
      var differentStudent = switching && (!result.identityKey || result.identityKey !== state.identityKey);
      var replaceDraft = Boolean(draft && options && options.recover);
      if ((replaceDraft || switching) && hasWork() && (!draft || hashOf(answers(false)) !== hashOf(draft.answers))) {
        if (!window.confirm('Load the account copy and replace the answers on screen? Cancel to download a backup first. You can also undo the load in this tab.')) {
          state.conflict = true; persist();
          return { ok: false, message: 'Recovery cancelled. Your visible work was kept. Account saving is paused. Download a backup before recovering another version.' };
        }
      }
      var known = new Set(answers(false).map(function (e) { return e.k; }));
      if (draft && draft.answers.some(function (e) { return !known.has(e.k) && clean(e.a); })) {
        state.conflict = true; persist();
        return { ok: false, message: 'The account copy contains answers this version of the page cannot display. Your work was kept. Ask your teacher to recover the full version before saving.' };
      }
      generation++;
      state.undoValues = differentStudent ? null : snapshot();
      applying = true;
      if (switching) {
        fields().forEach(function (el) { setValue(el, el.defaultValue); });
        resetRadios();
        window.dispatchEvent(new Event('desk-save:reset'));
      }
      state.token = result.token;
      state.identityKey = result.identityKey || '';
      state.firstName = result.firstName || '';
      state.classes = result.classes || [];
      state.classPeriod = result.classPeriod || '';
      state.turnedInAt = ''; state.turnedInHash = '';
      state.receipt = null; state.submission = null;
      state.conflict = false;
      state.remoteAt = draft && (draft.revision || draft.savedAt) || '';
      state.cloudAt = draft && draft.savedAt || '';
      state.everSaved = Boolean(draft);
      state.lastActive = Date.now();
      var restored = 0, byKey = {};
      if (draft) draft.answers.forEach(function (e) { byKey[e.k] = e.a; });
      var list = fields(); assignKeys(list);
      list.forEach(function (el) {
        var saved = byKey[keyOf.get(el)];
        if (replaceDraft || switching) {
          if (setValue(el, typeof saved === 'string' ? saved : el.defaultValue)) restored++;
        } else if (typeof saved === 'string' && clean(saved) && (!clean(el.value) || el.value === el.defaultValue) && setValue(el, saved)) restored++;
      });
      radioGroups().forEach(function (g) {
        var saved = byKey['r:' + g.name];
        if (replaceDraft || switching) checkRadio(g, function (r) { return saved ? radioText(r).slice(0, 600) === saved : r.defaultChecked; });
        else if (saved && !g.radios.some(function (r) { return r.checked && !r.defaultChecked; })) checkRadio(g, function (r) { return radioText(r).slice(0, 600) === saved; });
      });
      applying = false;
      state.values = snapshot();
      tlSync('l');
      state.cloudHash = draft ? hashOf(draft.answers) : '';
      if (draft && draft.turnedIn && draft.classPeriod === state.classPeriod && hashOf(answers(false)) === state.cloudHash) {
        state.turnedInAt = draft.finishedAt || draft.savedAt;
        state.turnedInHash = hashOf(answers(true));
      }
      state.classroomUrl = classroomAssignmentUrl(result.classroomUrl);
      persist();
      var hello = state.firstName ? 'Welcome back, ' + state.firstName + '. ' : '';
      return { ok: true, message: hello + (restored ? restored + ' answers brought back. ' : (!draft ? 'No account copy was found for this assignment. ' : 'Your account copy is loaded. ')) + 'Check your name before saving.' };
    }).catch(function () {
      applying = false;
      return { ok: false, code: 'offline', message: 'Could not reach the save system. Your visible answers were kept. Keep this tab open or download a backup.' };
    }).finally(function () {
      transitioning = false;
      if (state.token && !state.conflict && hasWork() && hashOf(answers(false)) !== state.cloudHash) saveCloud();
    });
  }

  function sendTurnIn(pin) {
    // A version conflict pauses autosave, never Turn In. The server records the press and
    // keeps the newer account copy as current progress.
    if (transitioning) return Promise.resolve({ ok: false, message: 'Wait for the current request to finish.' });
    var list = answers(true);
    var hash = hashOf(list);
    if (!answeredCount(list)) return Promise.resolve({ ok: false, message: 'Write at least one answer first.' });
    if (!state.submission || state.submission.hash !== hash) state.submission = { id: randomId(), hash: hash };
    var fullHash = hashOf(answers(false));
    var owner = state, started = generation;
    persist();
    return post({
      writeProtocol: 1,
      baseRevision: state.token ? state.remoteAt : '',
      action: 'turnin',
      pin: pin,
      accountToken: state.token || undefined,
      hub: hub,
      course: course,
      title: document.title,
      page: location.pathname,
      classPeriod: state.classPeriod,
      submissionId: state.submission.id,
      answers: list,
      timeline: tlPayload()
    }, { attempts: 3, timeoutMs: 40000 }).then(function (result) {
      if (owner !== state || started !== generation) return { ok: false, message: 'The account changed. Load My Work to check the result.' };
      if (result && result.code === 'conflict') { state.conflict = true; persist(); }
      if (result && result.code === 'pick_class') {
        state.classes = result.classes || [];
        persist();
        return { ok: false, pickClass: true, message: 'Which class is this for? Pick one, then press Turn In again.' };
      }
      if (!result || !result.ok || !result.turnedInAt || !Number.isFinite(Date.parse(result.turnedInAt))) return { ok: false, message: (result && result.error) || 'That did not go through. Press Turn In again.' };
      state.token = result.token || state.token;
      state.identityKey = result.identityKey || state.identityKey;
      state.firstName = result.firstName || state.firstName;
      state.classPeriod = result.classPeriod || state.classPeriod;
      state.classes = result.classes || state.classes;
      state.turnedInHash = hash;
      state.turnedInAt = result.turnedInAt;
      state.classroomUrl = classroomAssignmentUrl(result.classroomUrl);
      state.cloudHash = fullHash;
      state.cloudAt = result.turnedInAt; state.remoteAt = result.revision || result.turnedInAt; state.everSaved = true;
      state.receipt = { submissionId: result.submissionId || state.submission.id, turnedInAt: result.turnedInAt, firstName: state.firstName, classPeriod: state.classPeriod, hub: hub, answers: list, source: 'Server acknowledged Turn In. This downloaded copy can be edited; verify against the private teacher record.' };
      if (hashOf(answers(false)) !== fullHash) scheduleCloud();
      state.lastActive = Date.now();
      persist();
      return { ok: true, message: 'Turned in, ' + (state.firstName || 'you are all set') + '. ' + state.classPeriod + ', ' + clock(result.turnedInAt) + '.' };
    }, function () {
      return { ok: false, message: 'Didn’t go through. Check the WiFi and press Turn In again. Your answers are still here.' };
    });
  }

  function turnIn(pin) {
    if (finishing || transitioning) return Promise.resolve({ ok: false, message: 'Wait for the current request to finish.' });
    finishing = true; clearTimeout(cloudTimer);
    return Promise.resolve(cloudPromise).then(function () { return sendTurnIn(pin); }).finally(function () {
      finishing = false;
      if (state.token && !state.conflict && hashOf(answers(false)) !== state.cloudHash) scheduleCloud();
    });
  }

  function copyAnswers() {
    var list = answers(true);
    var lines = [document.title, ''];
    list.forEach(function (e, i) { lines.push((i + 1) + '. ' + e.q, clean(e.a) ? e.a.trim() : '(blank)', ''); });
    var text = lines.join('\n');
    function copied(ok) { if (ok) { state.copiedHash = hashOf(list); persist(); } return ok; }
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return copied(true); }, function () { return copied(legacyCopy(text)); });
    }
    return Promise.resolve(copied(legacyCopy(text)));
  }

  function legacyCopy(text) {
    var box = document.createElement('textarea');
    box.value = text;
    box.setAttribute('readonly', '');
    box.setAttribute('data-desk-skip', '');
    box.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(box);
    box.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    box.remove();
    return ok;
  }

  function downloadJson(data, suffix) {
    var url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    var a = make('a', { href: url, download: hub + '-' + suffix + '.json' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function applyValues(values) {
    applying = true;
    var list = fields(); assignKeys(list);
    list.forEach(function (el) { if (Object.prototype.hasOwnProperty.call(values, keyOf.get(el))) setValue(el, values[keyOf.get(el)]); });
    radioGroups().forEach(function (g) {
      if (Object.prototype.hasOwnProperty.call(values, 'r:' + g.name)) checkRadio(g, function (r) { return r.value === values['r:' + g.name]; });
    });
    applying = false;
    tlSync('r');
    onEdit();
  }

  function importBackup(file) {
    if (transitioning || finishing || cloudBusy) return Promise.reject(new Error('Wait for saving to finish, then load the backup.'));
    if (!file || file.size > 2000000) return Promise.reject(new Error('Choose a StoryHub backup smaller than 2 MB.'));
    return file.text().then(function (text) {
      var data;
      try { data = JSON.parse(text); } catch (e) { throw new Error('This file is not a readable StoryHub backup.'); }
      if (!data || data.format !== 'desk-work-backup' || data.version !== 1 || data.hub !== hub || !data.values || typeof data.values !== 'object' || Array.isArray(data.values)) throw new Error('This backup belongs to another assignment or uses an unsupported format. Your answers were kept.');
      var known = snapshot(), keys = Object.keys(data.values);
      if (keys.some(function (k) { return !Object.prototype.hasOwnProperty.call(known, k) || typeof data.values[k] !== 'string'; })) throw new Error('Some backup answers do not match this page. Your answers were kept. Ask your teacher to recover the original version.');
      radioGroups().forEach(function (g) {
        var value = data.values['r:' + g.name];
        if (value && !g.radios.some(function (r) { return r.value === value; })) throw new Error('A saved choice no longer matches this page. Your answers were kept.');
      });
      if (hasWork() && !window.confirm('Replace matching answers with this backup? Cancel to download your current version first. Undo load is available in this tab.')) return false;
      state.undoValues = snapshot();
      // A file contains work only. It cannot assert identity, a server receipt or cheating evidence.
      applyValues(data.values);
      return true;
    });
  }

  function clock(iso) {
    var d = iso ? new Date(iso) : new Date();
    if (isNaN(d)) return 'unconfirmed time';
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  // Only teacher-configured Classroom assignment URLs may replace the safe home link.
  function classroomAssignmentUrl(value) {
    var text = String(value || '').trim();
    return /^https:\/\/classroom\.google\.com\/(?:u\/\d+\/)?c\/[A-Za-z0-9_-]+\/a\/[A-Za-z0-9_-]+(?:\/details)?\/?(?:\?authuser=\d+)?$/.test(text) ? text : '';
  }

  /* ----------------------------------------------------------------- ui -- */

  var CSS = [
    ':host{all:initial;font-family:inherit;color:var(--ds-fg);font-size:16px;line-height:1.45}',
    '*{box-sizing:border-box;font:inherit;color:inherit}',
    '.panel{background:var(--ds-bg);border:1px solid var(--ds-line);border-radius:14px;padding:22px 22px 20px;max-width:640px;margin:48px auto 140px;box-shadow:0 1px 0 var(--ds-line)}',
    '.panel.floating{position:fixed;inset:auto 12px 76px 12px;margin:0 auto;z-index:2147483001;max-height:calc(100vh - 100px);overflow:auto;box-shadow:0 18px 50px rgba(0,0,0,.35)}',
    'h2{font-size:1.3rem;font-weight:700;margin:0 0 4px;letter-spacing:.01em}',
    '.sub{margin:0 0 16px}',
    '.tools{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;padding-top:16px;border-top:1px solid var(--ds-line)}',
    '.tools button{font-size:.9rem;padding:9px 12px}',
    '.help{margin:14px 0 0;font-size:.85rem}',
    '[hidden]{display:none!important}',
    '@media print{:host{display:none!important}}',
    '.row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
    'label{display:flex;flex-direction:column;gap:6px;font-weight:600;font-size:.9rem}',
    'input{width:9.5em;padding:10px 12px;border-radius:10px;border:1px solid var(--ds-line-strong);background:var(--ds-bg);color:var(--ds-fg);letter-spacing:.3em;font-size:1.1rem}',
    'input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid var(--ds-fg);outline-offset:2px}',
    '.handoff{margin-top:18px;padding-top:16px;border-top:1px solid var(--ds-line)}',
    '.handoff[hidden]{display:none}',
    '.handoff p{margin:0 0 12px;font-size:.95rem}',
    '.handoff a{display:inline-block;min-height:44px;padding:10px 16px;border:1px solid var(--ds-fg);border-radius:10px;font-weight:700;text-decoration:underline;text-underline-offset:3px}',
    'button{cursor:pointer;min-height:44px;padding:10px 18px;border-radius:10px;border:1px solid var(--ds-fg);background:transparent;font-weight:700}',
    'button.primary{background:var(--ds-fg);color:var(--ds-bg)}',
    'button[disabled]{opacity:.55;cursor:wait}',
    '.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;align-items:flex-end}',
    '.classes{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 0}',
    '.classes[hidden]{display:none}',
    '.classes button[aria-pressed="true"]{background:var(--ds-fg);color:var(--ds-bg)}',
    '.status{margin:14px 0 0;font-weight:600}',
    '.status:empty{margin:0}',
    '.status.good::before{content:"\\2713  "}',
    '.status.bad{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:4px}',
    '.close{position:absolute;top:8px;right:8px;min-height:36px;padding:4px 10px;border:none;font-size:1.3rem;line-height:1}',
    '.panel:not(.floating) .close{display:none}',
    '.chip{position:fixed;right:14px;bottom:var(--ds-lift,14px);z-index:2147483000;display:flex;align-items:center;gap:8px;min-height:40px;padding:8px 14px;border-radius:999px;background:var(--ds-bg);border:1px solid var(--ds-line-strong);font-size:.85rem;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.25)}',
    '.dot{width:9px;height:9px;border-radius:50%;background:#2e9d5b;flex:none}',
    '.dot.warn{background:#d98a1c}',
    '.dot.off{background:transparent;border:2px solid currentColor}',
    '.pop{position:fixed;right:14px;bottom:calc(var(--ds-lift,14px) + 50px);z-index:2147483000;width:min(340px,calc(100vw - 28px));background:var(--ds-bg);border:1px solid var(--ds-line-strong);border-radius:14px;padding:16px;box-shadow:0 18px 50px rgba(0,0,0,.35);font-size:.95rem}',
    '.pop[hidden]{display:none}',
    '.pop p{margin:0 0 12px}',
    '.pop .actions{margin-top:10px}',
    '.link{border:none;padding:6px 0;min-height:auto;text-decoration:underline;font-weight:600}',
    '.gate{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto;background:color-mix(in srgb, var(--ds-bg) 90%, transparent);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}',
    '.gate[hidden]{display:none}',
    '.gate .panel{margin:auto;width:100%;max-width:480px;border-color:var(--ds-line-strong);box-shadow:0 24px 70px rgba(0,0,0,.35)}',
    '.kicker{margin:0 0 12px;font-size:.8rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}',
    '.who{margin:8px 0 2px;font-size:1.7rem;font-weight:700;line-height:1.15}',
    '.gate .step[hidden]{display:none}',
    '@media (max-width:520px){.gate .panel{margin:auto;padding:18px}.who{font-size:1.4rem}}',
    '@media (max-width:520px){.panel{margin:32px 12px;padding:18px}.chip{right:10px}}',
    '@media (prefers-reduced-motion:no-preference){.panel.floating,.pop{animation:rise .18s ease-out}@keyframes rise{from{transform:translateY(8px);opacity:0}to{transform:none;opacity:1}}}'
  ].join('\n');

  function rgb(color) {
    var m = String(color).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  }
  function luminance(c) {
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function contrast(a, b) {
    var x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  /** Borrow the page's own text and background colors, and fall back to a safe pair when they clash. */
  function pageColors() {
    var fgText = getComputedStyle(document.body).color || 'rgb(17, 17, 17)';
    var fg = rgb(fgText) || { r: 17, g: 17, b: 17, a: 1 };
    var bg = null;
    var node = document.body;
    while (node && !bg) {
      var c = rgb(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0.85) bg = c;
      node = node.parentElement;
    }
    var darkText = luminance(fg) < 0.4;
    if (!bg || contrast(fg, bg) < 4.5) {
      return darkText ? { fg: fgText, bg: 'rgb(250, 248, 244)' } : { fg: fgText, bg: 'rgb(16, 18, 22)' };
    }
    return { fg: fgText, bg: 'rgb(' + bg.r + ', ' + bg.g + ', ' + bg.b + ')' };
  }

  function make(tag, attrs, text) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    if (text) el.textContent = text;
    return el;
  }

  var ui = { refresh: function () {} };
  var fullPasteAllowed = false;
  var pasteViews = [];

  function buildUi() {
    var colors = pageColors();
    function host(id) {
      var h = make('div', { id: id, 'data-desk-skip': '' });
      h.style.setProperty('--ds-fg', colors.fg);
      h.style.setProperty('--ds-bg', colors.bg);
      h.style.setProperty('--ds-line', 'color-mix(in srgb, ' + colors.fg + ' 22%, transparent)');
      h.style.setProperty('--ds-line-strong', 'color-mix(in srgb, ' + colors.fg + ' 45%, transparent)');
      var root = h.attachShadow({ mode: 'open' });
      root.appendChild(make('style', {}, CSS));
      return { host: h, root: root };
    }

    /* Turn In panel */
    var panelHost = host('desk-save-panel');
    var panel = make('section', { class: 'panel', 'aria-labelledby': 'ds-title', role: 'region' });
    panel.style.position = 'relative';
    var closeBtn = make('button', { class: 'close', type: 'button', 'aria-label': 'Close' }, '×');
    var title = make('h2', { id: 'ds-title' }, cloudOn ? 'Turn in your work' : 'Before you leave');
    var sub = make('p', { class: 'sub' });
    var classes = make('div', { class: 'classes', role: 'group', 'aria-label': 'Your class' });
    classes.hidden = true;
    var actions = make('div', { class: 'actions' });
    var pinLabel = make('label', {}, 'Hall pass PIN');
    var pin = make('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '6', pattern: '[0-9]*', 'aria-describedby': 'ds-status' });
    pinLabel.appendChild(pin);
    var turnBtn = make('button', { class: 'primary', type: 'button' }, 'Turn In');
    var copyBtn = make('button', { type: 'button' }, 'Copy my answers');
    if (cloudOn) { actions.appendChild(pinLabel); actions.appendChild(turnBtn); }
    actions.appendChild(copyBtn);
    var status = make('p', { class: 'status', id: 'ds-status', role: 'status', 'aria-live': 'polite' });
    var handoff = make('div', { class: 'handoff', hidden: '' });
    var handoffNote = make('p', { id: 'ds-classroom-note' }, 'Your finished work is saved on the desk. If your teacher assigned this in Google Classroom, open that assignment and choose Turn In or Mark as done there.');
    var classroomLink = make('a', { href: 'https://classroom.google.com/', target: '_blank', rel: 'noopener noreferrer', referrerpolicy: 'no-referrer', 'aria-describedby': 'ds-classroom-note' }, 'Open Google Classroom');
    handoff.appendChild(handoffNote);
    handoff.appendChild(classroomLink);
    [closeBtn, title, sub, classes, actions, status, handoff].forEach(function (n) { panel.appendChild(n); });
    panelHost.root.appendChild(panel);

    var slot = document.querySelector('[data-desk-turnin]');
    if (slot) slot.appendChild(panelHost.host);
    else document.body.appendChild(panelHost.host);

    /* Status chip and its popover */
    var chipHost = host('desk-save-chip');
    var chip = make('button', { class: 'chip', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'ds-pop' });
    var dot = make('span', { class: 'dot', 'aria-hidden': 'true' });
    var chipText = make('span');
    chip.appendChild(dot);
    chip.appendChild(chipText);
    var pop = make('div', { class: 'pop', id: 'ds-pop', role: 'dialog', 'aria-label': 'Saving your work' });
    pop.hidden = true;
    var popText = make('p');
    var popActions = make('div', { class: 'actions' });
    var popPinLabel = make('label', {}, 'Hall pass PIN');
    var popPin = make('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '6', pattern: '[0-9]*' });
    popPinLabel.appendChild(popPin);
    var signBtn = make('button', { class: 'primary', type: 'button' }, 'Save to my account');
    var goTurnIn = make('button', { class: 'link', type: 'button' }, cloudOn ? 'Go to Turn In' : 'Go to Copy my answers');
    var signOutBtn = make('button', { class: 'link', type: 'button' }, 'Not you? Sign out');
    var popStatus = make('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
    pop.appendChild(popText);
    pop.appendChild(popActions);
    pop.appendChild(popStatus);
    chipHost.root.appendChild(pop);
    chipHost.root.appendChild(chip);
    document.body.appendChild(chipHost.host);

    /* PIN gate: the page stays covered until a student signs in. */
    var gateHost = host('desk-save-gate');
    var gate = make('div', { class: 'gate' });
    gate.hidden = true;
    var gateCard = make('section', { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ds-gate-title' });
    var pageName = clean((document.querySelector('h1') || {}).textContent || document.title || '').slice(0, 120);
    if (pageName) gateCard.appendChild(make('p', { class: 'kicker' }, pageName));
    var gateStatus = make('p', { class: 'status', role: 'status', 'aria-live': 'polite' });

    var stepPin = make('div', { class: 'step' });
    stepPin.appendChild(make('h2', { id: 'ds-gate-title' }, 'Enter your PIN to start'));
    stepPin.appendChild(make('p', { class: 'sub' }, 'Your answers save to your account while you work. Open this page on any Chromebook later and your work comes back.'));
    var gateActions = make('div', { class: 'actions' });
    var gatePinLabel = make('label', {}, 'Hall pass PIN');
    var gatePin = make('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '6', pattern: '[0-9]*' });
    gatePinLabel.appendChild(gatePin);
    var gateStart = make('button', { class: 'primary', type: 'button' }, 'Start');
    gateActions.appendChild(gatePinLabel);
    gateActions.appendChild(gateStart);
    stepPin.appendChild(gateActions);
    var gateOffline = make('button', { type: 'button', hidden: '' }, 'Start without saving to my account');
    gateOffline.style.marginTop = '14px';
    var gateHelp = make('p', { class: 'help' }, 'Forgot your PIN? Ask your teacher before you start.');

    var stepWho = make('div', { class: 'step', hidden: '' });
    var whoTitle = make('h2', { id: 'ds-gate-who-title' }, 'Is this you?');
    var whoName = make('p', { class: 'who' });
    var whoClass = make('p', { class: 'sub' });
    var whoClasses = make('div', { class: 'classes', role: 'group', 'aria-label': 'Which class is this for?' });
    var whoActions = make('div', { class: 'actions' });
    var whoYes = make('button', { class: 'primary', type: 'button' }, 'Yes, that is me');
    var whoNo = make('button', { type: 'button' }, 'Not me');
    whoActions.appendChild(whoYes);
    whoActions.appendChild(whoNo);
    [whoTitle, whoName, whoClass, whoClasses, whoActions].forEach(function (n) { stepWho.appendChild(n); });

    [stepPin, stepWho, gateStatus, gateOffline, gateHelp].forEach(function (n) { gateCard.appendChild(n); });
    gate.appendChild(gateCard);
    gateHost.root.appendChild(gate);
    document.body.appendChild(gateHost.host);

    var inerted = [];
    function coverPage(on) {
      if (on) {
        Array.prototype.slice.call(document.body.children).forEach(function (el) {
          if (el === gateHost.host || el.inert || el.tagName === 'SCRIPT') return;
          el.inert = true; inerted.push(el);
        });
        document.documentElement.style.overflow = 'hidden';
      } else {
        inerted.forEach(function (el) { el.inert = false; });
        inerted = [];
        document.documentElement.style.overflow = '';
      }
    }

    function showStep(step) {
      stepPin.hidden = step !== 'pin';
      stepWho.hidden = step !== 'who';
      gateHelp.hidden = step !== 'pin';
      if (step !== 'pin') gateOffline.hidden = true;
      gateCard.setAttribute('aria-labelledby', step === 'pin' ? 'ds-gate-title' : 'ds-gate-who-title');
    }

    function openGate() {
      if (!gateOn || state.token) return;
      showStep('pin');
      gatePin.value = '';
      gateOffline.hidden = true;
      busy(gateStart, false, 'Start');
      setStatus(gateStatus, message, messageGood);
      if (gate.hidden) { gate.hidden = false; coverPage(true); }
      setTimeout(function () { gatePin.focus({ preventScroll: true }); }, 0);
    }

    function closeGate() {
      if (gate.hidden) return;
      gate.hidden = true;
      coverPage(false);
      setStatus(gateStatus, '', false);
    }

    function showWho() {
      showStep('who');
      setStatus(gateStatus, '', false);
      var list = state.classes || [];
      var needsClass = list.length > 1 && list.indexOf(state.classPeriod) === -1;
      whoTitle.textContent = needsClass ? 'Which class is this for?' : 'Is this you?';
      whoName.textContent = state.firstName || 'Your account';
      whoClass.textContent = needsClass ? 'Pick your class to start.' : (state.classPeriod || '');
      whoClass.hidden = !whoClass.textContent;
      whoYes.hidden = needsClass;
      whoClasses.textContent = '';
      whoClasses.hidden = !needsClass;
      if (needsClass) {
        list.forEach(function (name) {
          var b = make('button', { type: 'button' }, name);
          b.addEventListener('click', function () {
            state.classPeriod = name;
            state.cloudHash = '';
            persist();
            scheduleCloud();
            closeGate();
            ui.refresh();
          });
          whoClasses.appendChild(b);
        });
      }
      setTimeout(function () { (needsClass ? whoClasses.querySelector('button') : whoYes).focus({ preventScroll: true }); }, 0);
    }

    gatePin.addEventListener('input', function () { gatePin.value = digits(gatePin).slice(0, 6); });
    gatePin.addEventListener('keydown', function (e) { if (e.key === 'Enter') gateStart.click(); });
    gateStart.addEventListener('click', function () {
      var code = digits(gatePin);
      if (code.length !== 6) { setStatus(gateStatus, 'Enter your six digit hall pass PIN.', false); gatePin.focus(); return; }
      busy(gateStart, true, 'Checking…');
      setStatus(gateStatus, '', false);
      signIn(code, { recover: true }).then(function (result) {
        busy(gateStart, false, 'Start');
        gatePin.value = '';
        ui.refresh();
        if (!result.ok || !state.token) {
          setStatus(gateStatus, result.message, false);
          // A wrong PIN never unlocks the page. A save system that cannot be
          // reached should not keep a student from working.
          gateOffline.hidden = result.code === 'bad_pin';
          gatePin.focus();
          return;
        }
        heldPin = code;
        message = ''; messageGood = false;
        ui.refresh();
        showWho();
      });
    });
    gateOffline.addEventListener('click', function () {
      closeGate();
      message = 'Your answers are saving in this tab only. Enter your PIN here when the connection is back.';
      messageGood = false;
      ui.refresh();
      openPop(true);
    });
    whoYes.addEventListener('click', function () { closeGate(); ui.refresh(); });
    whoNo.addEventListener('click', function () {
      resetPage();
      message = 'Signed out. Enter your own PIN.';
      messageGood = false;
      ui.refresh();
      openGate();
    });
    // Signing out, being signed out after a quiet stretch, or "Not me" all
    // bring the gate back. A switch between students keeps it closed.
    window.addEventListener('desk-save:reset', function () {
      setTimeout(function () { if (!state.token) openGate(); }, 0);
    });

    var toolViews = [];
    var message = '';
    var messageGood = false;
    var resumeHost = null;
    var resumeText, resumeStatus, resumePin, resumeSign, resumeNow, resumeClasses, resumeOut;
    var resumeSlot = document.querySelector('[data-desk-resume]');
    if (!resumeSlot && fields().length) {
      resumeSlot = make('div', { 'data-desk-resume': '' });
      var main = document.querySelector('main') || document.body;
      main.insertBefore(resumeSlot, main.firstChild);
    }
    if (resumeSlot && cloudOn) {
      var resumeSignLabel = resumeSlot.getAttribute('data-desk-resume-label') || 'Load My Work';
      resumeHost = host('desk-save-resume');
      var resumePanel = make('section', { class: 'panel', 'aria-label': 'Your work' });
      resumePanel.style.margin = '24px auto 32px';
      resumePanel.appendChild(make('h2', {}, 'Your work'));
      resumeText = make('p', { class: 'sub' });
      resumeClasses = make('div', { class: 'classes', role: 'group', 'aria-label': 'Your class for this work' });
      resumeClasses.hidden = true;
      var resumeActions = make('div', { class: 'actions' });
      var resumeLabel = make('label', {}, 'Hall pass PIN');
      resumePin = make('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '6', 'aria-label': 'Hall pass PIN to save or recover work' });
      resumeLabel.appendChild(resumePin);
      resumeSign = make('button', { type: 'button', class: 'primary' }, resumeSignLabel);
      resumeNow = make('button', { type: 'button' }, 'Save now');
      resumeStatus = make('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
      [resumeLabel, resumeSign, resumeNow].forEach(function (n) { resumeActions.appendChild(n); });
      [resumeText, resumeClasses, resumeActions, resumeStatus].forEach(function (n) { resumePanel.appendChild(n); });
      resumeHost.root.appendChild(resumePanel);
      resumeSlot.appendChild(resumeHost.host);
      addTools(resumePanel, resumeStatus);
      var jumpFinish = make('button', { type: 'button' }, 'Go to Turn In');
      jumpFinish.addEventListener('click', function () { panelHost.host.scrollIntoView({ block: 'center', behavior: 'auto' }); (pinLabel.hidden ? turnBtn : pin).focus({ preventScroll: true }); });
      resumeActions.appendChild(jumpFinish);
      resumeOut = signOutBtn.cloneNode(true);
      resumeActions.appendChild(resumeOut);
      resumeOut.addEventListener('click', function () { signOutBtn.click(); });
      resumePin.addEventListener('input', function () { resumePin.value = digits(resumePin).slice(0, 6); });
      resumeSign.addEventListener('click', function () {
        var code = digits(resumePin);
        if (code.length !== 6) { setStatus(resumeStatus, 'Enter your six digit hall pass PIN.', false); return; }
        busy(resumeSign, true, 'Checking…');
        clearTimeout(cloudTimer);
        signIn(code, { recover: true }).then(function (result) {
          resumePin.value = '';
          busy(resumeSign, false, resumeSignLabel);
          ui.refresh();
          setStatus(resumeStatus, result.message, result.ok);
        });
      });
      resumePin.addEventListener('keydown', function (e) { if (e.key === 'Enter') resumeSign.click(); });
      resumeNow.addEventListener('click', function () {
        busy(resumeNow, true, 'Saving…');
        saveCloud().then(function (ok) {
          busy(resumeNow, false, 'Save now');
          var current = ok && state.token && state.cloudAt && hashOf(answers(false)) === state.cloudHash;
          setStatus(resumeStatus, current ? 'Account save confirmed. Check the name and time above.' : 'Latest account save not confirmed. Keep this tab open; saving will retry.', current);
        });
      });
    }

    function addTools(target, feedback) {
      var tools = make('div', { class: 'tools', 'aria-label': 'Work controls' });
      var download = make('button', { type: 'button' }, 'Download backup');
      var load = make('button', { type: 'button' }, 'Load backup file');
      var file = make('input', { type: 'file', accept: '.json,application/json', hidden: '', 'aria-label': 'StoryHub backup file' });
      var copy = make('button', { type: 'button' }, 'Copy answers');
      var undo = make('button', { type: 'button' }, 'Undo load');
      var receipt = make('button', { type: 'button' }, 'Download Turn In receipt');
      var print = make('button', { type: 'button' }, 'Print');
      var evidence = make('p', { class: 'help' });
      [download, load, copy, undo, receipt, print].forEach(function (n) { tools.appendChild(n); });
      file.setAttribute('data-desk-skip', ''); document.body.appendChild(file);
      target.appendChild(tools); target.appendChild(evidence);
      if (cloudOn) target.appendChild(make('p', { class: 'help' }, 'This page keeps a timeline of how your answers were written, such as pastes and time away from the page. Your teacher receives it when you press Turn In.'));
      if (!document.getElementById('lab-paste-feedback')) {
        var pasteLabel = make('label', { class: 'help' });
        var pasteCheck = make('input', { type: 'checkbox' });
        pasteCheck.style.cssText = 'width:20px;height:20px;letter-spacing:normal';
        pasteLabel.appendChild(pasteCheck);
        pasteLabel.appendChild(document.createTextNode('Allow full paste for my own draft or a writing tool'));
        var pasteHelp = make('p', { class: 'help', role: 'status', 'aria-live': 'polite' }, 'Write in your own words. Short quotes and source links can be pasted. Longer pastes need the option above.');
        target.appendChild(pasteLabel); target.appendChild(pasteHelp);
        pasteViews.push({ checkbox: pasteCheck, feedback: pasteHelp });
        pasteCheck.addEventListener('change', function () {
          fullPasteAllowed = pasteCheck.checked;
          pasteViews.forEach(function (v) { v.checkbox.checked = fullPasteAllowed; });
          tlMark(fullPasteAllowed ? 'paste-on' : 'paste-off');
        });
      }
      download.addEventListener('click', function () {
        downloadJson({ format: 'desk-work-backup', version: 1, hub: hub, title: document.title, exportedAt: new Date().toISOString(), values: snapshot(), answers: answers(false), notice: 'Personal backup. This file does not prove a server save, submission time or authorship.' }, 'backup');
        // Starting a download does not prove the file landed. Keep the unload guard.
        setStatus(feedback, 'Backup download started. Check that the file is in Downloads before closing.', true);
      });
      load.addEventListener('click', function () { file.click(); });
      file.addEventListener('change', function () {
        importBackup(file.files[0]).then(function (ok) {
          ui.refresh(); setStatus(feedback, ok ? 'Backup loaded. This is work in progress; save or Turn In when ready.' : 'Load cancelled. Your answers were kept.', ok);
        }).catch(function (error) { setStatus(feedback, error.message, false); }).finally(function () { file.value = ''; });
      });
      copy.addEventListener('click', function () { copyAnswers().then(function (ok) { setStatus(feedback, ok ? 'Copied. Paste your answers where needed.' : 'Copy was blocked. Download a backup instead.', ok); }); });
      undo.addEventListener('click', function () {
        if (!state.undoValues || transitioning || finishing || cloudBusy) return;
        var previous = state.undoValues; state.undoValues = snapshot(); applyValues(previous);
        ui.refresh(); setStatus(feedback, 'Previous on-screen answers restored. Save or Turn In this version when ready.', true);
      });
      receipt.addEventListener('click', function () { if (state.receipt) downloadJson(state.receipt, 'turn-in-receipt'); });
      print.addEventListener('click', function () { window.print(); });
      toolViews.push({ undo: undo, receipt: receipt, evidence: evidence });
    }
    addTools(panel, status);

    window.addEventListener('desk-save:reset', function () {
      [pin, popPin, resumePin].filter(Boolean).forEach(function (input) { input.value = ''; });
      [status, popStatus, resumeStatus].filter(Boolean).forEach(function (node) { setStatus(node, '', false); });
      message = ''; messageGood = false;
    });

    function setStatus(node, text, good) {
      node.textContent = text || '';
      node.className = 'status' + (text ? (good ? ' good' : ' bad') : '');
    }

    function renderClasses() {
      var list = state.classes || [];
      [classes, resumeClasses].filter(Boolean).forEach(function (target) {
      target.textContent = '';
      if (list.length < 2) { target.hidden = true; return; }
      target.hidden = false;
      list.forEach(function (name) {
        var b = make('button', { type: 'button', 'aria-pressed': String(name === state.classPeriod) }, name);
        b.addEventListener('click', function () {
          generation++; clearTimeout(cloudTimer);
          state.classPeriod = name;
          state.cloudHash = '';
          state.turnedInHash = '';
          state.turnedInAt = '';
          state.classroomUrl = '';
          state.submission = null; state.receipt = null;
          persist();
          scheduleCloud();
          ui.refresh();
          if (target === resumeClasses) resumePin.focus({ preventScroll: true });
          else pin.focus();
        });
        target.appendChild(b);
      });
      });
    }

    ui.refresh = function (note) {
      if (typeof note === 'string') { message = note; messageGood = false; }
      var list = answers(true);
      var count = answeredCount(list);
      var hash = hashOf(list);
      var total = list.length;
      if (resumeHost) {
        var pending = hashOf(answers(false)) !== state.cloudHash;
        resumeHost.host.setAttribute('data-signed-in', state.token ? 'true' : 'false');
        resumeNow.hidden = !state.token;
        resumeOut.hidden = !state.token;
        resumeText.textContent = state.token
          ? 'Signed in as ' + (state.firstName || 'your account') + (state.classPeriod ? ' · ' + state.classPeriod : '') + '. ' +
            (pending ? (cloudRetry ? 'Account save is retrying. Your latest work is in this tab.' : 'Latest edits are saved in this tab; account save is pending.') : (state.cloudAt ? 'Account save confirmed at ' + clock(state.cloudAt) + '.' : 'Ready to save your work.')) + ' Returning from another device? Enter your PIN again before editing to recover the latest account copy.'
          : 'Enter your Hall Pass PIN to load your saved work or start saving to your account. Use the same PIN when you return, including on another Chromebook.';
      }
      handoff.hidden = !(cloudOn && state.turnedInAt && hash === state.turnedInHash);
      var assignmentUrl = classroomAssignmentUrl(state.classroomUrl);
      classroomLink.href = assignmentUrl || 'https://classroom.google.com/';
      classroomLink.textContent = assignmentUrl ? 'Open Classroom assignment' : 'Open Google Classroom';
      if (cloudOn) {
        if (state.turnedInAt && hash === state.turnedInHash) sub.textContent = 'Turned in at ' + clock(state.turnedInAt) + '. Change anything and you can turn in again.';
        else if (state.turnedInAt) sub.textContent = 'Your changes save as work in progress. Press Turn In when you finish this version.';
        else if (state.token) sub.textContent = count + ' of ' + total + ' answered. Your progress saves to ' + (state.firstName ? state.firstName + '’s' : 'your') + ' account ' + cadenceText + '. Press Turn In when you finish.';
        else sub.textContent = count + ' of ' + total + ' answered. Enter your PIN to save progress ' + cadenceText + '. Press Turn In when you finish.';
      } else {
        sub.textContent = count + ' of ' + total + ' answered. Your answers stay while this tab is open. Copy them before you close it.';
      }
      // Signed in at the gate in this page: Turn In already has the PIN.
      pinLabel.hidden = Boolean(cloudOn && heldPin && state.token);
      renderClasses();
      toolViews.forEach(function (view) {
        view.undo.hidden = !state.undoValues;
        view.receipt.hidden = !state.receipt;
        view.evidence.textContent = (tabDurable ? 'Tab copy available until this tab closes. ' : 'Browser storage is blocked. These answers may disappear on refresh. Download a backup now. ') + (state.cloudAt ? 'Last account confirmation: ' + clock(state.cloudAt) + '. ' : 'Account save has not been confirmed. ') + (state.saveError ? state.saveError + ' Download a backup. ' : '') + (state.conflict ? 'Version conflict: account saving is paused. Download a backup, then Load My Work. ' : '') + (state.receipt ? 'Turn In reference: ' + state.receipt.submissionId + '. ' : '') + 'A saved draft is not a finished submission.';
      });

      popActions.textContent = '';
      if (!cloudOn) {
        chipText.textContent = 'Saved in this tab';
        dot.className = 'dot';
        popText.textContent = 'Your answers save while you type and come back if the page refreshes. They stay in this tab only, so copy them before you close it.';
        popActions.appendChild(goTurnIn);
      } else if (state.token) {
        var behind = hashOf(answers(false)) !== state.cloudHash;
        chipText.textContent = behind ? (cloudBusy ? 'Saving…' : 'Saved in this tab') : 'Saved · ' + (state.firstName || 'your account') + (state.cloudAt ? ' · ' + clock(state.cloudAt) : '');
        dot.className = behind && cloudRetry ? 'dot warn' : 'dot';
        if (behind && cloudRetry) chipText.textContent = 'Saved in this tab · retrying';
        popText.textContent = 'Saving to ' + (state.firstName ? state.firstName + '’s' : 'your') + ' account. Your progress saves ' + cadenceText + '. Press Turn In when you finish. Open this page on any Chromebook and enter your PIN to pick up where you left off.';
        popActions.appendChild(goTurnIn);
        popActions.appendChild(signOutBtn);
      } else {
        chipText.textContent = 'Save my work';
        dot.className = 'dot off';
        popText.textContent = 'Right now your answers are saved in this tab only. Enter your hall pass PIN to save them to your account. Started on another Chromebook? This brings that work back.';
        popActions.appendChild(popPinLabel);
        popActions.appendChild(signBtn);
      }
      if (message) setStatus(popStatus, message, messageGood);
      if (!tabDurable) { chipText.textContent = 'Storage blocked · download backup'; dot.className = 'dot warn'; }
      else if (state.saveError) { chipText.textContent = 'Account save refused · download backup'; dot.className = 'dot warn'; }
      else if (state.conflict) { chipText.textContent = 'Version conflict · load work'; dot.className = 'dot warn'; }
      if (resumeHost && state.conflict) resumeText.textContent = 'Your on-screen answers were kept. Account saving is paused to protect another version. Download a backup, then Load My Work.';
      if (resumeHost && !tabDurable) resumeText.textContent = 'Browser storage is blocked. Keep this page open and download a backup. ' + (state.token ? 'Signed in as ' + state.firstName + '.' : 'Enter your PIN for account saving.');
    };

    function openPop(open) {
      pop.hidden = !open;
      chip.setAttribute('aria-expanded', String(open));
      if (open) {
        ui.refresh();
        setTimeout(function () { (state.token || !cloudOn ? goTurnIn : popPin).focus(); }, 0);
      }
    }

    chip.addEventListener('click', function () { openPop(pop.hidden); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { openPop(false); panel.classList.remove('floating'); }
    });
    document.addEventListener('pointerdown', function (e) {
      if (!pop.hidden && e.composedPath().indexOf(chipHost.host) === -1) openPop(false);
    });

    goTurnIn.addEventListener('click', function () {
      openPop(false);
      panelHost.host.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(function () {
        var r = panel.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) panel.classList.add('floating');
        (cloudOn ? (pinLabel.hidden ? turnBtn : pin) : copyBtn).focus({ preventScroll: true });
      }, 450);
    });
    closeBtn.addEventListener('click', function () { panel.classList.remove('floating'); });

    signOutBtn.addEventListener('click', function () {
      saveCloud().then(function (saved) {
        if (!saved || hashOf(answers(false)) !== state.cloudHash) {
          ui.refresh('Your account save is still retrying. Wait for Saved before signing out.');
          return;
        }
        resetPage();
        message = 'Signed out. This page is blank for the next person.';
        messageGood = true;
        ui.refresh();
        setStatus(popStatus, message, true);
      });
    });

    function digits(input) { return String(input.value || '').replace(/\D/g, ''); }
    [pin, popPin].forEach(function (input) {
      input.addEventListener('input', function () { input.value = digits(input).slice(0, 6); });
    });

    function busy(button, on, label) {
      button.disabled = on;
      button.textContent = label;
    }

    signBtn.addEventListener('click', function () {
      var code = digits(popPin);
      if (code.length !== 6) { message = 'Enter your six digit hall pass PIN.'; messageGood = false; ui.refresh(); return; }
      busy(signBtn, true, 'Checking…');
      signIn(code, { recover: true }).then(function (result) {
        busy(signBtn, false, 'Save to my account');
        popPin.value = '';
        message = result.message;
        messageGood = result.ok;
        ui.refresh();
        setStatus(popStatus, message, messageGood);
      });
    });
    popPin.addEventListener('keydown', function (e) { if (e.key === 'Enter') signBtn.click(); });

    turnBtn.addEventListener('click', function () {
      var code = digits(pin);
      if (!code && heldPin && state.token) code = heldPin;
      if (code.length !== 6) { setStatus(status, 'Enter your six digit hall pass PIN.', false); pin.focus(); return; }
      busy(turnBtn, true, 'Sending…');
      setStatus(status, '', false);
      turnIn(code).then(function (result) {
        busy(turnBtn, false, 'Turn In');
        if (result.ok) pin.value = '';
        ui.refresh();
        setStatus(status, result.message, result.ok);
        if (result.pickClass) {
          var first = classes.querySelector('button');
          if (first) first.focus();
        }
      });
    });
    pin.addEventListener('keydown', function (e) { if (e.key === 'Enter') turnBtn.click(); });

    copyBtn.addEventListener('click', function () {
      copyAnswers().then(function (ok) {
        setStatus(status, ok ? 'Copied. Paste it wherever your teacher asked.' : 'Copy was blocked. Select your answers and copy them by hand.', ok);
        ui.refresh();
      });
    });

    /* Keep the chip clear of a hub's own fixed bars and drawers in the bottom corner. */
    function lift() {
      var top = innerHeight;
      var points = [[innerWidth - 24, innerHeight - 22], [innerWidth - 120, innerHeight - 22], [innerWidth - 220, innerHeight - 22], [innerWidth - 24, innerHeight - 52], [innerWidth - 220, innerHeight - 52]];
      points.forEach(function (p) {
        (document.elementsFromPoint(p[0], p[1]) || []).forEach(function (el) {
          if (el === chipHost.host || el === panelHost.host || el === document.body || el === document.documentElement) return;
          for (var n = el; n && n !== document.body; n = n.parentElement) {
            var pos = getComputedStyle(n).position;
            if (pos === 'fixed' || pos === 'sticky') {
              var r = n.getBoundingClientRect();
              if (r.height < innerHeight * 0.5 && r.top > innerHeight * 0.4) top = Math.min(top, r.top);
              break;
            }
          }
        });
      });
      var value = Math.round(Math.max(14, innerHeight - top + 10)) + 'px';
      if (chipHost.host.style.getPropertyValue('--ds-lift') !== value) chipHost.host.style.setProperty('--ds-lift', value);
    }
    lift();
    setInterval(lift, 1500);

    // The chip steps aside while the Turn In panel itself is on screen.
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        var showing = entries[0].isIntersecting;
        chip.style.visibility = showing && pop.hidden ? 'hidden' : '';
      }, { threshold: 0.25 }).observe(panelHost.host);
    }
    addEventListener('resize', lift);

    ui.refresh();
    if (gateOn && !state.token) openGate();
    if (testHooks) window.__deskSave.gate = function () { return !gate.hidden; };
  }

  /* --------------------------------------------------------------- boot -- */

  /* --------------------------------------------------------- read aloud -- */

  // Uses the Chromebook's own speech engine. Nothing is sent anywhere.
  var READ_CSS = [
    ':host{all:initial;font-family:inherit;color:var(--ds-fg);font-size:16px;line-height:1.3}',
    '*{box-sizing:border-box;font:inherit;color:inherit}',
    '.bar{position:fixed;left:14px;bottom:var(--ds-lift,14px);z-index:2147483000;display:flex;align-items:center;gap:6px;padding:4px;border-radius:999px;background:var(--ds-bg);border:1px solid var(--ds-line-strong);box-shadow:0 6px 20px rgba(0,0,0,.25)}',
    'button{min-height:40px;min-width:40px;padding:6px 14px;border-radius:999px;border:1px solid transparent;background:transparent;font-size:.85rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px}',
    'button:hover{border-color:var(--ds-line-strong)}',
    'button:focus-visible{outline:3px solid currentColor;outline-offset:2px}',
    'svg{width:18px;height:18px;flex:none}',
    '[hidden]{display:none!important}',
    '@media (max-width:520px){.bar{left:10px}.main .label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}}',
    '@media print{.bar{display:none}}'
  ].join('');

  function readChunks(text) {
    var clean1 = String(text || '').replace(/\s+/g, ' ').trim();
    var parts = clean1.match(/[^.!?]+[.!?]+["'”’)\]]*\s*|[^.!?]+$/g) || [];
    var out = [], cur = '';
    parts.forEach(function (p) {
      while (p.length > 240) {
        var cut = p.lastIndexOf(', ', 220); if (cut < 80) cut = p.lastIndexOf(' ', 220); if (cut < 80) cut = 220;
        if (cur) { out.push(cur); cur = ''; }
        out.push(p.slice(0, cut + 1).trim()); p = p.slice(cut + 1);
      }
      if ((cur + ' ' + p).length > 240) { if (cur) out.push(cur); cur = p.trim(); }
      else cur = (cur + ' ' + p).trim();
    });
    if (cur) out.push(cur);
    return out.filter(function (c) { return /\w/.test(c); });
  }

  function buildReadAloud() {
    var synth = window.speechSynthesis;
    if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') return;
    try { synth.cancel(); } catch (e) {}
    var colors = pageColors();
    var h = make('div', { id: 'desk-read-aloud', 'data-desk-skip': '' });
    h.style.setProperty('--ds-fg', colors.fg);
    h.style.setProperty('--ds-bg', colors.bg);
    h.style.setProperty('--ds-line-strong', 'color-mix(in srgb, ' + colors.fg + ' 45%, transparent)');
    var root = h.attachShadow({ mode: 'open' });
    root.appendChild(make('style', {}, READ_CSS));
    var mark = document.createElement('style');
    mark.textContent = '.desk-reading{outline:3px solid currentColor;outline-offset:4px;border-radius:4px}';
    document.head.appendChild(mark);
    var bar = make('div', { class: 'bar', role: 'group', 'aria-label': 'Read aloud' });
    var icon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
    var mainBtn = make('button', { class: 'main', type: 'button' });
    mainBtn.innerHTML = icon + '<span class="label"></span>';
    var label = mainBtn.querySelector('.label');
    var pauseBtn = make('button', { type: 'button', hidden: '' }, 'Pause');
    var stopBtn = make('button', { type: 'button', hidden: '' }, 'Stop');
    var speeds = [0.8, 1, 1.25];
    var speed = 1;
    try { var savedSpeed = Number(localStorage.getItem('desk-read-aloud:speed')); if (speeds.indexOf(savedSpeed) >= 0) speed = savedSpeed; } catch (e) {}
    var speedBtn = make('button', { type: 'button', 'aria-label': 'Reading speed' });
    [mainBtn, pauseBtn, stopBtn, speedBtn].forEach(function (b) { bar.appendChild(b); });
    root.appendChild(bar);
    document.body.appendChild(h);

    var queue = [], speaking = false, paused = false, block = null, voice = null, run = 0;
    function pickVoice() {
      var list = synth.getVoices() || [];
      voice = list.filter(function (v) { return /^en-US/i.test(v.lang) && /google/i.test(v.name); })[0]
        || list.filter(function (v) { return /^en-US/i.test(v.lang); })[0]
        || list.filter(function (v) { return /^en/i.test(v.lang); })[0] || null;
    }
    pickVoice();
    if ('onvoiceschanged' in synth) synth.addEventListener('voiceschanged', pickVoice);

    function selectedText() {
      var a = document.activeElement;
      if (a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && /^(text|search)?$/.test(a.type || ''))) && a.selectionEnd > a.selectionStart) {
        return a.value.slice(a.selectionStart, a.selectionEnd);
      }
      var sel = window.getSelection && window.getSelection();
      var text = sel ? String(sel) : '';
      if (sel && sel.anchorNode && h.contains(sel.anchorNode)) return '';
      return text.trim().length > 1 ? text : '';
    }
    // With nothing selected, read the passage in the middle of the screen.
    function passage() {
      var x = Math.round(window.innerWidth / 2), y = Math.round(window.innerHeight * 0.42);
      var el = document.elementFromPoint(x, y);
      if (!el || el.closest('[data-desk-skip]') || el === document.body || el === document.documentElement) {
        el = Array.prototype.slice.call(document.querySelectorAll('main p, main h1, main h2, main h3, main li, main blockquote, p, h1, h2, li, blockquote')).filter(function (n) {
          var r = n.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight && !n.closest('[data-desk-skip]') && n.innerText.trim();
        })[0] || null;
      }
      if (!el) return null;
      var target = el.closest('p, li, blockquote, figcaption, h1, h2, h3, h4, td, label, dd') || el;
      var container = target.closest('section, article, [data-section]');
      if (container && !container.closest('[data-desk-skip]') && container.innerText.length <= 2500) target = container;
      return target.innerText.trim() ? target : null;
    }
    function refresh() {
      var sel = !speaking && selectedText();
      label.textContent = speaking ? (paused ? 'Paused' : 'Reading') : sel ? 'Read selection' : 'Read aloud';
      mainBtn.setAttribute('aria-label', speaking ? 'Read aloud is playing' : sel ? 'Read the selected text aloud' : 'Read this part of the page aloud');
      mainBtn.disabled = speaking;
      pauseBtn.hidden = stopBtn.hidden = !speaking;
      pauseBtn.textContent = paused ? 'Resume' : 'Pause';
      speedBtn.textContent = (speed === 1 ? '1' : String(speed)) + 'x';
      speedBtn.setAttribute('aria-label', 'Reading speed ' + speed + ' times. Change speed');
    }
    function clearBlock() { if (block) block.classList.remove('desk-reading'); block = null; }
    function stop() {
      run++; queue = []; speaking = false; paused = false;
      try { synth.cancel(); } catch (e) {}
      clearBlock(); refresh();
    }
    function next(id) {
      if (id !== run) return;
      if (!queue.length) { speaking = false; paused = false; clearBlock(); refresh(); return; }
      var u = new SpeechSynthesisUtterance(queue.shift());
      if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-US';
      u.rate = speed;
      u.onend = function () { next(id); };
      u.onerror = function (e) { if (e && e.error === 'interrupted') return; next(id); };
      synth.speak(u);
    }
    function start(text, el) {
      stop();
      queue = readChunks(text);
      if (!queue.length) return;
      if (el) { block = el; el.classList.add('desk-reading'); }
      speaking = true; refresh();
      next(run);
    }
    mainBtn.addEventListener('pointerdown', function (e) { e.preventDefault(); });
    mainBtn.addEventListener('click', function () {
      var sel = selectedText();
      if (sel) { start(sel, null); return; }
      var el = passage();
      if (el) { el.scrollIntoView({ block: 'nearest' }); start(el.innerText, el); }
    });
    pauseBtn.addEventListener('click', function () {
      if (!speaking) return;
      if (paused) { synth.resume(); paused = false; } else { synth.pause(); paused = true; }
      refresh();
    });
    stopBtn.addEventListener('click', stop);
    speedBtn.addEventListener('click', function () {
      speed = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
      try { localStorage.setItem('desk-read-aloud:speed', String(speed)); } catch (e) {}
      refresh();
    });
    var selTimer = null;
    document.addEventListener('selectionchange', function () { clearTimeout(selTimer); selTimer = setTimeout(refresh, 150); });
    document.addEventListener('select', function () { clearTimeout(selTimer); selTimer = setTimeout(refresh, 150); }, true);
    window.addEventListener('pagehide', stop);
    window.addEventListener('desk-save:reset', stop);
    window.__deskSave.readAloud = { stop: stop };
    refresh();
  }

  function buildReaderUi() {
    var colors = pageColors();
    var h = make('aside', { id: 'desk-save-reader', 'data-desk-skip': '' });
    h.style.setProperty('--ds-fg', colors.fg); h.style.setProperty('--ds-bg', colors.bg);
    h.style.setProperty('--ds-line', 'currentColor');
    var root = h.attachShadow({ mode: 'open' }); root.appendChild(make('style', {}, CSS));
    var card = make('section', { class: 'panel', 'aria-label': 'StoryHub controls' });
    card.appendChild(make('h2', {}, 'StoryHub controls'));
    card.appendChild(make('p', {}, 'This page has no written answer boxes. There is no assignment draft to save or load here.'));
    var print = make('button', { type: 'button' }, 'Print'); print.addEventListener('click', function () { window.print(); });
    card.appendChild(print); root.appendChild(card);
    var main = document.querySelector('main') || document.body; main.appendChild(h);
    window.__deskSave.mode = 'reading'; window.__deskSave.ready = true;
  }

  function boot() {
    try { buildReadAloud(); } catch (error) { /* Reading support must never stop saving. */ }
    if (!fields().length && !radioGroups().length) { buildReaderUi(); return; }
    window.__deskSave.mode = 'assignment';
    var saved = readJson('sessionStorage', STORE_KEY);
    state = saved && typeof saved === 'object' && saved.values ? Object.assign(blankState(), saved) : blankState();

    var list = fields();
    assignKeys(list);
    list.forEach(function (el) {
      var key = keyOf.get(el);
      var value = saved && saved.values && Object.prototype.hasOwnProperty.call(saved.values, key) ? saved.values[key] : el.defaultValue;
      setValue(el, value);
    });
    radioGroups().forEach(function (g) {
      var key = 'r:' + g.name;
      if (saved && saved.values && Object.prototype.hasOwnProperty.call(saved.values, key)) {
        checkRadio(g, function (r) { return r.value === saved.values[key]; });
      } else {
        checkRadio(g, function (r) { return r.defaultChecked; });
      }
    });
    state.values = snapshot();
    persist();
    var savedTl = readJson('sessionStorage', TL_KEY);
    if (savedTl && savedTl.v === 1 && savedTl.t0 && savedTl.f && savedTl.bases) { tl = savedTl; tl.away = tl.away || []; tl.marks = tl.marks || []; tlSync('r'); }
    else tlReset();
    window.addEventListener('desk-save:reset', tlReset);
    buildUi();
    // Refreshing during the one-minute wait must restart the pending account save.
    if (state.token && hashOf(answers(false)) !== state.cloudHash) scheduleCloud();
    // A tab left signed in for a long time is signed out once its work is safely on the account.
    idleCheck();

    document.addEventListener('input', tlInput, true);
    document.addEventListener('input', function (e) { if (e.target && e.target.matches && e.target.matches('textarea, input')) onEdit(); }, true);
    document.addEventListener('change', function (e) { if (e.target && e.target.matches && e.target.matches('textarea, input')) onEdit(); }, true);
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (type) {
      document.addEventListener(type, onActivity, { capture: true, passive: true });
    });
    setInterval(onEdit, SNAPSHOT_MS);
    setInterval(tlTick, SNAPSHOT_MS);
    setInterval(idleCheck, testHooks && testHooks.idleMs ? 250 : 30000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { tlAway(); beaconSave(); } else tlBack(); });
    // A video or embedded activity taking focus is not leaving the page.
    window.addEventListener('blur', function () { setTimeout(function () { var a = document.activeElement; if ((a && a.tagName === 'IFRAME') || document.hasFocus()) return; tlAway(); }, 0); });
    window.addEventListener('focus', tlBack);
    window.addEventListener('pagehide', function () { tlFlushAll(); tlSave(true); beaconSave(); });
    window.addEventListener('online', function () { if (state.token) saveCloud(); });
    window.addEventListener('beforeunload', function (e) {
      if (!hasWork()) return;
      var hash = hashOf(answers(true));
      if (hash === state.turnedInHash || hash === state.copiedHash || hash === state.backupHash || (state.token && hashOf(answers(false)) === state.cloudHash && state.cloudAt)) return;
      e.preventDefault();
      e.returnValue = '';
    });

    // A paste rule is writing support, never an authorship or AI detector.
    // It never reads the clipboard. A blocked long paste is noted on the
    // writing timeline, which goes to the teacher only with Turn In.
    if (!document.getElementById('lab-paste-feedback')) {
      var guardPaste = function (e) {
        if (fullPasteAllowed || fields().indexOf(e.target) < 0) return;
        var field = e.target;
        if (field.getAttribute('data-desk-paste') === 'source' || /^(?:source|citation)(?:-|_|$)/i.test(field.id)) return;
        var transfer = e.clipboardData || e.dataTransfer;
        var text = transfer && transfer.getData('text/plain') || '';
        if (/^https?:\/\/\S+$/i.test(text.trim()) || (text.trim().match(/\S+/g) || []).length <= 12) return;
        e.preventDefault();
        tlMark('paste-blocked');
        pasteViews.forEach(function (v) { v.feedback.textContent = 'Long paste was not inserted. For your own draft or a writing tool, choose Allow full paste first.'; });
        ui.refresh('Long paste was not inserted. Use Allow full paste in Your work for your own draft or a writing tool.');
      };
      document.addEventListener('paste', guardPaste, true);
      document.addEventListener('drop', guardPaste, true);
      window.addEventListener('desk-save:reset', function () {
        fullPasteAllowed = false;
        pasteViews.forEach(function (v) { v.checkbox.checked = false; v.feedback.textContent = 'Write in your own words. Short quotes and source links can be pasted. Longer pastes need the option above.'; });
      });
    }
    window.__deskSave.ready = true;
    window.__deskSave.hub = hub;
    if (testHooks) {
      window.__deskSave.state = function () { return JSON.parse(JSON.stringify(state)); };
      window.__deskSave.answers = function () { return answers(true); };
      window.__deskSave.saveCloud = saveCloud;
      window.__deskSave.timeline = function () { return JSON.parse(JSON.stringify(tlPayload() || null)); };
    }
  }

  function start() {
    // Hubs restore their own saved answers on load. Running after them lets this
    // script overwrite anything a previous student left in the browser.
    setTimeout(boot, 60);
  }
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();
