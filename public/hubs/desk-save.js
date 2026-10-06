/*
 * the desk · desk-save.js
 *
 * One save system for every hub with answer boxes. Load it once, near the end
 * of the page:  <script src="/hubs/desk-save.js" defer></script>
 *
 * What it does for a student:
 *   1. Every answer box saves while they type and survives a refresh. The copy
 *      lives in this browser tab only, so the next student on a shared
 *      Chromebook opens a blank page.
 *   2. With their hall pass PIN, work also saves to their account and comes
 *      back on any Chromebook.
 *   3. A Turn In panel at the bottom sends the answers to the teacher's private
 *      sheet and shows a confirmation only after the sheet has them.
 *   4. The browser asks before leaving a page whose answers were never turned
 *      in or copied.
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

  var ENDPOINT = '';

  if (window.__deskSave) return;
  window.__deskSave = { version: '1' };

  var IDLE_SIGNOUT_MS = 20 * 60 * 1000;
  var CLOUD_DEBOUNCE_MS = 15 * 1000;
  var CLOUD_MAX_WAIT_MS = 60 * 1000;
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

  var hub = (location.pathname.split('/').pop() || 'hub').replace(/\.html?$/i, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'hub';
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
  function writeJson(store, key, value) {
    memory[store + key] = value;
    try { window[store].setItem(key, JSON.stringify(value)); } catch (e) { /* memory copy still works */ }
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

  var state = null;
  function blankState() {
    return { values: {}, updatedAt: 0, lastActive: Date.now(), token: '', firstName: '', classPeriod: '', classes: [], cloudHash: '', cloudAt: '', turnedInHash: '', turnedInAt: '', copiedHash: '', submission: null, everSaved: false };
  }
  function persist() { writeJson('sessionStorage', STORE_KEY, state); }

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
    var shown = list.filter(function (el) { return visible(el) || clean(el.value); });
    // A page whose only box sits in a closed drawer still counts that box.
    if (forSending && shown.length) list = shown;
    var out = list.map(function (el) {
      return { k: keyOf.get(el), q: labelFor(el), a: el.value };
    });
    radioGroups().forEach(function (g) {
      var on = g.radios.filter(function (r) { return r.checked; })[0];
      var seen = g.radios.some(function (r) { return visible(r.closest('label') || r); });
      if (forSending && !seen && !on) return;
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
    return fields().some(function (el) { return clean(values[keyOf.get(el)]) && values[keyOf.get(el)] !== el.defaultValue; });
  }

  /* ------------------------------------------------------------ network -- */

  function post(body, options) {
    options = options || {};
    var attempts = options.attempts || 1;
    body.device = device;
    if (testHooks && testHooks.loadTestKey) body.test = testHooks.loadTestKey;
    function once() {
      var controller = window.AbortController ? new AbortController() : null;
      var timer = setTimeout(function () { if (controller) controller.abort(); }, REQUEST_TIMEOUT_MS);
      return fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        redirect: 'follow',
        credentials: 'omit',
        signal: controller ? controller.signal : undefined
      }).then(function (response) {
        clearTimeout(timer);
        if (!response.ok) throw new Error('http ' + response.status);
        return response.json();
      }, function (error) {
        clearTimeout(timer);
        throw error;
      });
    }
    function attempt(n) {
      return once().then(function (result) {
        if (result && result.code === 'server' && n < attempts) return wait(n).then(function () { return attempt(n + 1); });
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
  var cloudRetry = 0;

  function scheduleCloud() {
    if (!cloudOn || !state.token) return;
    var now = Date.now();
    if (!cloudFirstPending) cloudFirstPending = now;
    clearTimeout(cloudTimer);
    var delay = Math.max(0, Math.min(CLOUD_DEBOUNCE_MS, cloudFirstPending + CLOUD_MAX_WAIT_MS - now));
    cloudTimer = setTimeout(saveCloud, delay);
  }

  function saveCloud() {
    clearTimeout(cloudTimer);
    if (!cloudOn || !state.token) return Promise.resolve(true);
    var list = answers(false);
    var hash = hashOf(list);
    if (hash === state.cloudHash) { cloudFirstPending = 0; return Promise.resolve(true); }
    if (!answeredCount(list) && !state.everSaved) { state.cloudHash = hash; return Promise.resolve(true); }
    if (cloudBusy) { scheduleCloud(); return Promise.resolve(false); }
    cloudBusy = true;
    return post({ action: 'save', token: state.token, hub: hub, answers: list }).then(function (result) {
      cloudBusy = false;
      if (result && result.ok) {
        state.cloudHash = hash;
        state.everSaved = true;
        state.cloudAt = result.savedAt;
        cloudFirstPending = 0;
        cloudRetry = 0;
        persist();
        ui.refresh();
        return true;
      }
      if (result && result.code === 'signed_out') {
        state.token = '';
        persist();
        ui.refresh('Enter your PIN again to keep saving to your account.');
        return false;
      }
      throw new Error(result && result.error || 'save failed');
    }).catch(function () {
      cloudBusy = false;
      cloudRetry = Math.min(cloudRetry + 1, 4);
      clearTimeout(cloudTimer);
      cloudTimer = setTimeout(saveCloud, 15000 * cloudRetry);
      ui.refresh();
      return false;
    });
  }

  function beaconSave() {
    if (!cloudOn || !state || !state.token || !navigator.sendBeacon) return;
    var list = answers(false);
    if (hashOf(list) === state.cloudHash) return;
    if (!answeredCount(list) && !state.everSaved) return;
    try {
      var body = JSON.stringify({ action: 'save', token: state.token, hub: hub, answers: list, device: device });
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain;charset=utf-8' }));
    } catch (e) { /* the tab copy is still there */ }
  }

  /* ------------------------------------------------------------- events -- */

  function onEdit() {
    var values = snapshot();
    if (JSON.stringify(values) === JSON.stringify(state.values)) return;
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
      if (!saved || !state.token || Date.now() - state.lastActive < IDLE_SIGNOUT_MS) return;
      var name = state.firstName;
      resetPage();
      ui.refresh('Signed out after 20 quiet minutes. ' + (name ? name + ', your' : 'Your') + ' work is saved. Enter your PIN to bring it back.');
    });
  }

  function resetPage() {
    fields().forEach(function (el) { setValue(el, el.defaultValue); });
    resetRadios();
    state = blankState();
    state.values = snapshot();
    persist();
  }

  /* ------------------------------------------------------------ actions -- */

  function signIn(pin) {
    return post({ action: 'signin', pin: pin, hub: hub, course: course }, { attempts: 2 }).then(function (result) {
      if (!result || !result.ok) return { ok: false, message: result && result.error || 'That did not go through. Try again.' };
      state.token = result.token;
      state.firstName = result.firstName || '';
      state.classes = result.classes || [];
      if (result.classPeriod) state.classPeriod = result.classPeriod;
      state.lastActive = Date.now();
      var restored = 0;
      if (result.draft && Array.isArray(result.draft.answers)) {
        var byKey = {};
        result.draft.answers.forEach(function (e) { byKey[e.k] = e.a; });
        var list = fields();
        assignKeys(list);
        list.forEach(function (el) {
          var saved = byKey[keyOf.get(el)];
          if (saved && clean(saved) && (!clean(el.value) || el.value === el.defaultValue) && setValue(el, saved)) restored++;
        });
        radioGroups().forEach(function (g) {
          var saved = byKey['r:' + g.name];
          if (!saved || g.radios.some(function (r) { return r.checked && !r.defaultChecked; })) return;
          checkRadio(g, function (r) { return radioText(r).slice(0, 600) === saved; });
        });
        if (result.draft.turnedIn) {
          state.turnedInAt = result.draft.savedAt;
        }
      }
      state.values = snapshot();
      state.cloudHash = '';
      persist();
      // A blank page never overwrites saved work.
      if (hasWork()) saveCloud();
      else state.cloudHash = hashOf(answers(false));
      var hello = state.firstName ? 'Welcome back, ' + state.firstName + '. ' : '';
      if (restored) return { ok: true, message: hello + restored + (restored === 1 ? ' answer' : ' answers') + ' brought back.' };
      return { ok: true, message: hello + 'Your answers now save to your account.' };
    }, function () {
      return { ok: false, message: 'Could not reach the save system. Your answers are still saved in this tab.' };
    });
  }

  function turnIn(pin) {
    var list = answers(true);
    var hash = hashOf(list);
    if (!answeredCount(list)) return Promise.resolve({ ok: false, message: 'Write at least one answer first.' });
    if (!state.submission || state.submission.hash !== hash) state.submission = { id: randomId(), hash: hash };
    persist();
    return post({
      action: 'turnin',
      pin: pin,
      hub: hub,
      course: course,
      title: document.title,
      page: location.pathname,
      classPeriod: state.classPeriod,
      submissionId: state.submission.id,
      answers: list
    }, { attempts: 3 }).then(function (result) {
      if (result && result.code === 'pick_class') {
        state.classes = result.classes || [];
        persist();
        return { ok: false, pickClass: true, message: 'Which class is this for? Pick one, then press Turn In again.' };
      }
      if (!result || !result.ok) return { ok: false, message: (result && result.error) || 'That did not go through. Press Turn In again.' };
      state.token = result.token || state.token;
      state.firstName = result.firstName || state.firstName;
      state.classPeriod = result.classPeriod || state.classPeriod;
      state.classes = result.classes || state.classes;
      state.turnedInHash = hash;
      state.turnedInAt = result.turnedInAt;
      state.cloudHash = hashOf(answers(false));
      state.lastActive = Date.now();
      persist();
      return { ok: true, message: 'Turned in, ' + (state.firstName || 'you are all set') + '. ' + state.classPeriod + ', ' + clock(result.turnedInAt) + '.' };
    }, function () {
      return { ok: false, message: 'Didn’t go through. Check the WiFi and press Turn In again. Your answers are still here.' };
    });
  }

  function copyAnswers() {
    var list = answers(true);
    var lines = [document.title, ''];
    list.forEach(function (e, i) { lines.push((i + 1) + '. ' + e.q, clean(e.a) ? e.a.trim() : '(blank)', ''); });
    var text = lines.join('\n');
    state.copiedHash = hashOf(list);
    persist();
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
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

  function clock(iso) {
    var d = iso ? new Date(iso) : new Date();
    if (isNaN(d)) d = new Date();
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  /* ----------------------------------------------------------------- ui -- */

  var CSS = [
    ':host{all:initial;font-family:inherit;color:var(--ds-fg);font-size:16px;line-height:1.45}',
    '*{box-sizing:border-box;font:inherit;color:inherit}',
    '.panel{background:var(--ds-bg);border:1px solid var(--ds-line);border-radius:14px;padding:22px 22px 20px;max-width:640px;margin:48px auto 140px;box-shadow:0 1px 0 var(--ds-line)}',
    '.panel.floating{position:fixed;inset:auto 12px 76px 12px;margin:0 auto;z-index:2147483001;max-height:calc(100vh - 100px);overflow:auto;box-shadow:0 18px 50px rgba(0,0,0,.35)}',
    'h2{font-size:1.3rem;font-weight:700;margin:0 0 4px;letter-spacing:.01em}',
    '.sub{margin:0 0 16px;opacity:.78}',
    '.row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
    'label{display:flex;flex-direction:column;gap:6px;font-weight:600;font-size:.9rem}',
    'input{width:9.5em;padding:10px 12px;border-radius:10px;border:1px solid var(--ds-line-strong);background:var(--ds-bg);color:var(--ds-fg);letter-spacing:.3em;font-size:1.1rem}',
    'input:focus-visible,button:focus-visible{outline:3px solid var(--ds-fg);outline-offset:2px}',
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
    [closeBtn, title, sub, classes, actions, status].forEach(function (n) { panel.appendChild(n); });
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

    var message = '';
    var messageGood = false;

    function setStatus(node, text, good) {
      node.textContent = text || '';
      node.className = 'status' + (text ? (good ? ' good' : ' bad') : '');
    }

    function renderClasses() {
      classes.textContent = '';
      var list = state.classes || [];
      if (list.length < 2) { classes.hidden = true; return; }
      classes.hidden = false;
      list.forEach(function (name) {
        var b = make('button', { type: 'button', 'aria-pressed': String(name === state.classPeriod) }, name);
        b.addEventListener('click', function () {
          state.classPeriod = name;
          persist();
          renderClasses();
          pin.focus();
        });
        classes.appendChild(b);
      });
    }

    ui.refresh = function (note) {
      if (typeof note === 'string') { message = note; messageGood = false; }
      var list = answers(true);
      var count = answeredCount(list);
      var hash = hashOf(list);
      var total = list.length;
      if (cloudOn) {
        if (state.turnedInAt && hash === state.turnedInHash) sub.textContent = 'Turned in at ' + clock(state.turnedInAt) + '. Change anything and you can turn in again.';
        else if (state.turnedInAt) sub.textContent = 'You changed your answers after turning in. Press Turn In again to send the new version.';
        else sub.textContent = count + ' of ' + total + ' answered. Enter your hall pass PIN and press Turn In.';
      } else {
        sub.textContent = count + ' of ' + total + ' answered. Your answers stay while this tab is open. Copy them before you close it.';
      }
      renderClasses();

      popActions.textContent = '';
      if (!cloudOn) {
        chipText.textContent = 'Saved in this tab';
        dot.className = 'dot';
        popText.textContent = 'Your answers save while you type and come back if the page refreshes. They stay in this tab only, so copy them before you close it.';
        popActions.appendChild(goTurnIn);
      } else if (state.token) {
        var behind = hashOf(answers(false)) !== state.cloudHash;
        chipText.textContent = behind ? 'Saving…' : 'Saved · ' + (state.firstName || 'your account') + (state.cloudAt ? ' · ' + clock(state.cloudAt) : '');
        dot.className = behind && cloudRetry ? 'dot warn' : 'dot';
        if (behind && cloudRetry) chipText.textContent = 'Saved in this tab · retrying';
        popText.textContent = 'Saving to ' + (state.firstName ? state.firstName + '’s' : 'your') + ' account. Open this page on any Chromebook and enter your PIN to pick up where you left off.';
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
        (cloudOn ? pin : copyBtn).focus({ preventScroll: true });
      }, 450);
    });
    closeBtn.addEventListener('click', function () { panel.classList.remove('floating'); });

    signOutBtn.addEventListener('click', function () {
      saveCloud().then(function () {
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
      signIn(code).then(function (result) {
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
  }

  /* --------------------------------------------------------------- boot -- */

  function boot() {
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
    buildUi();
    // A tab left signed in for a long time is signed out once its work is safely on the account.
    idleCheck();

    document.addEventListener('input', function (e) { if (e.target && e.target.matches && e.target.matches('textarea, input')) onEdit(); }, true);
    document.addEventListener('change', function (e) { if (e.target && e.target.matches && e.target.matches('textarea, input')) onEdit(); }, true);
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (type) {
      document.addEventListener(type, onActivity, { capture: true, passive: true });
    });
    setInterval(onEdit, SNAPSHOT_MS);
    setInterval(idleCheck, testHooks && testHooks.idleMs ? 250 : 30000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') beaconSave(); });
    window.addEventListener('pagehide', beaconSave);
    window.addEventListener('beforeunload', function (e) {
      if (!hasWork()) return;
      var hash = hashOf(answers(true));
      if (hash === state.turnedInHash || hash === state.copiedHash) return;
      e.preventDefault();
      e.returnValue = '';
    });

    window.__deskSave.ready = true;
    window.__deskSave.hub = hub;
    if (testHooks) {
      window.__deskSave.state = function () { return JSON.parse(JSON.stringify(state)); };
      window.__deskSave.answers = function () { return answers(true); };
      window.__deskSave.saveCloud = saveCloud;
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
