
/* Beyond the Scoreboard · originality coach.
 * Transparent, aggregated in-browser writing-process receipts; never AI detection.
 * Does not read clipboard content beyond counting words during a paste event.
 * Does not record individual keys, timing between keys, or activity on other tabs.
 * Counters live in tab sessionStorage. A human-readable summary enters desk-save
 * through an answer textarea and travels to the same private Turn In sheet.
 */
(function () {
  'use strict';

  function boot() {
    var lab = document.getElementById('lab');
    if (!lab) return;
    var report = document.getElementById('lab-process-report');
    var feedback = document.getElementById('lab-originality-feedback');
    var status = document.getElementById('lab-originality-status');
    var override = document.getElementById('lab-paste-override');
    var reason = document.getElementById('lab-paste-reason');
    var defense = document.getElementById('lab-defense-prompt');
    var heel = document.getElementById('lab-heel');
    if (!report || !status || !feedback || !heel) return;

    var STORE = 'bts-heels:originality-session:v1';
    var MAX_PASTE_WORDS = 12;
    var sourceFields = new Set(['lab-source-one', 'lab-source-two']);
    var ignored = new Set(['lab-process-report', 'lab-paste-reason']);
    var activeInput = {
      'lab-identity': true, 'lab-character-clue': true, 'lab-history': true,
      'lab-timeline-meaning': true, 'lab-wrestling': true, 'lab-audience': true,
      'lab-america': true, 'lab-talk': true, 'lab-slide-one': true,
      'lab-slide-two': true, 'lab-slide-three': true,
      'lab-initial-hypothesis': true, 'lab-revised-hypothesis': true,
      'lab-source-one-claim': true, 'lab-source-two-claim': true,
      'lab-independent': true, 'lab-visual': true, 'lab-defense-answer': true
    };
    var state;
    var hadPreviousSession = false;
    try {
      var parsed = JSON.parse(sessionStorage.getItem(STORE) || 'null');
      if (parsed && parsed.v === 1 && typeof parsed.pastes === 'number') {
        state = parsed;
        hadPreviousSession = true;
      }
    } catch (error) { /* storage can be blocked */ }
    function blankState() { return {
      v: 1, pastes: 0, blocked: 0, allowed: 0, imported: 0,
      pastedWords: 0, sourcePastes: 0, sourceWords: 0, maxPaste: 0,
      characterKeyPresses: 0, deletions: 0, nonKeyboardInserts: 0,
      largeUnattributedChanges: 0, editSessions: 0,
      firstWorkAt: 0, lastWorkAt: 0,
      fields: {}, stamped: {}, exceptionsUsed: 0,
      priorReport: ''
    }; }
    if (!state) state = blankState();
    var lastEdit = 0;
    var stampAnchor = state.firstWorkAt || Date.now();
    var currentReport = '';

    function eligible(el) {
      return Boolean(el && el.id && lab.contains(el) &&
        !ignored.has(el.id) && (activeInput[el.id] || sourceFields.has(el.id)));
    }
    function countWords(value) {
      return (String(value || '').trim().match(/\S+/g) || []).length;
    }
    function save() {
      try { sessionStorage.setItem(STORE, JSON.stringify(state)); } catch (error) { /* limited session memory */ }
    }
    function touch(el) {
      var now = Date.now();
      if (!state.firstWorkAt) {
        state.firstWorkAt = now;
        stampAnchor = now;
      }
      if (!lastEdit || now - lastEdit > 120000) state.editSessions += 1;
      lastEdit = now;
      state.lastWorkAt = now;
      if (el && el.id) state.fields[el.id] = true;
    }
    function reportText() {
      var chunks = [
        'WRITING PROCESS RECEIPT — NOT AN AI DETECTOR',
        'Scope: this browser tab/session only. Work restored from another device may not be represented.',
        'Citation fields permit unrestricted paste; analysis fields limit ordinary paste to ' + MAX_PASTE_WORDS + ' words per action unless the student turns on an exception.',
        'Analysis paste attempts: ' + state.pastes + ' | accepted: ' + state.allowed +
          ' | rejected (>12 words): ' + state.blocked + ' | exception imports: ' + state.imported,
        'Analysis words added by accepted paste: ' + state.pastedWords +
          ' | largest paste attempt: ' + state.maxPaste + ' words',
        'Citation pastes: ' + state.sourcePastes +
          ' | citation pasted words: ' + state.sourceWords,
        'Printable keyboard presses: ' + state.characterKeyPresses +
          ' | deletion operations: ' + state.deletions +
          ' | other input insert events: ' + state.nonKeyboardInserts +
          ' | unusually large non-paste changes: ' + state.largeUnattributedChanges,
        'Editing bursts (2-minute inactivity gap): ' + state.editSessions +
          ' | research fields visited: ' + Object.keys(state.fields).length,
        'Student exception switch activations: ' + state.exceptionsUsed,
        'Draft evidence stamps: ' + (Object.keys(state.stamped).sort().map(function (k) {
          return 'round ' + k + ' (+' + state.stamped[k].minute + 'm, ' + state.stamped[k].words + ' words in its writing fields)';
        }).join('; ') || 'none'),
        'Interpretation: counts can miss voice typing, imports, other devices, offline writing and browser manipulation. They cannot establish authorship or academic misconduct. Review the evidence and ask follow-up questions.'
      ];
      if (state.priorReport) {
        chunks.push('Previous device/session receipt (as restored from saved work; not merged with these counts):');
        chunks.push(state.priorReport);
      }
      return chunks.join('\n');
    }
    function render() {
      var hasActivity = Boolean(state.firstWorkAt || state.exceptionsUsed ||
        Object.keys(state.stamped).length || state.priorReport);
      currentReport = hasActivity ? reportText() : '';
      if (hasActivity && report.value !== currentReport) {
        report.value = currentReport;
        /* desk-save records the receipt as part of the student's work. */
        report.dispatchEvent(new Event('input', { bubbles: true }));
      }
      var stamped = Object.keys(state.stamped).length;
      status.textContent = 'Pastes tried: ' + state.pastes +
        ' · large pastes stopped: ' + state.blocked +
        ' · keyboard edits: ' + state.characterKeyPresses +
        ' · draft stamps: ' + stamped + '/5';
      save();
    }
    var deferredRender = 0;
    function scheduleRender() {
      clearTimeout(deferredRender);
      deferredRender = setTimeout(function () { deferredRender = 0; render(); }, 400);
    }
    window.addEventListener('pagehide', function () {
      if (deferredRender) { clearTimeout(deferredRender); deferredRender = 0; render(); }
    });
    function show(message) {
      feedback.textContent = message;
    }

    lab.addEventListener('paste', function (event) {
      var el = event.target;
      if (!eligible(el) || !event.isTrusted) return;
      /* No clipboard contents are saved, even on a rejected paste. */
      var clip = event.clipboardData && event.clipboardData.getData('text/plain');
      if (typeof clip !== 'string' || !clip.length) {
        show('Paste information was unavailable. If text appears, cite your sources and explain it in your own words.');
        return;
      }
      var size = countWords(clip);
      touch(el);
      if (sourceFields.has(el.id)) {
        state.sourcePastes += 1;
        state.sourceWords += size;
        show('Citation paste counted. Bibliography entries are exempt for accurate titles, authors and URLs; explanations and analysis still follow the paste limit.');
      } else {
        state.pastes += 1;
        state.maxPaste = Math.max(state.maxPaste, size);
        if (size > MAX_PASTE_WORDS && !override.checked) {
          event.preventDefault();
          state.blocked += 1;
          show('That paste contained ' + size + ' words and was not inserted. Write your analysis in your own words, or use the documented accessibility/prior-work exception below.');
        } else {
          state.allowed += 1;
          state.pastedWords += size;
          if (size > MAX_PASTE_WORDS) {
            state.imported += 1;
            show('Long paste accepted with the exception switch. Include why you imported this work in the explanation field.');
          } else {
            show(size + '-word paste counted. Remember to cite outside facts and explain your own reasoning.');
          }
        }
      }
      render();
    }, true);

    lab.addEventListener('keydown', function (event) {
      if (!eligible(event.target) || !event.isTrusted || event.repeat ||
          !activeInput[event.target.id] || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key && event.key.length === 1) {
        state.characterKeyPresses += 1; touch(event.target); scheduleRender();
      }
    }, true);

    lab.addEventListener('beforeinput', function (event) {
      if (!eligible(event.target) || !event.isTrusted) return;
      if (String(event.inputType).startsWith('delete')) {
        state.deletions += 1; touch(event.target); scheduleRender();
      } else if (activeInput[event.target.id] &&
                 event.inputType && !/insertFromPaste|insertText/i.test(event.inputType)) {
        state.nonKeyboardInserts += 1; touch(event.target); scheduleRender();
      }
    }, true);

    var fieldLengths = {};
    function updateFieldLengths() {
      lab.querySelectorAll('textarea,input[type="text"]').forEach(function (el) {
        if (eligible(el)) fieldLengths[el.id] = el.value.length;
      });
    }
    updateFieldLengths();
    /* Shared account recovery emits ordinary input events for restored fields.
     * Keep length baselines current without treating recovery as student edits. */
    lab.addEventListener('input', function (event) {
      if (event.isTrusted) return;
      if (eligible(event.target)) fieldLengths[event.target.id] = event.target.value.length;
      if (event.target === report && window.__deskSave && window.__deskSave.ready &&
          report.value && report.value !== currentReport) {
        preserveReceipt(report.value);
        scheduleRender();
      }
    });
    window.addEventListener('load', function () { setTimeout(updateFieldLengths, 250); }, { once: true });
    lab.addEventListener('input', function (event) {
      var el = event.target;
      if (!eligible(el) || !event.isTrusted) return;
      var prior = fieldLengths[el.id] || 0;
      if (activeInput[el.id] && el.value.length - prior > 500 &&
          !(event.inputType && /insertFromPaste/i.test(event.inputType))) {
        state.largeUnattributedChanges += 1;
      }
      fieldLengths[el.id] = el.value.length;
      touch(el);
      scheduleRender();
    }, true);

    override.addEventListener('change', function () {
      if (override.checked) {
        state.exceptionsUsed += 1;
        show('Long pastes are temporarily permitted in analysis boxes. Explain the accessibility or previous-work reason below; the teacher can review it. This is not a misconduct finding.');
      } else show('The ordinary 12-word paste limit is active again.');
      render();
    });

    lab.querySelectorAll('[data-lab-stamp]').forEach(function (button) {
      button.addEventListener('click', function () {
        var n = +button.getAttribute('data-lab-stamp');
        var panel = document.getElementById('lab-round-' + n);
        if (!panel) return;
        var content = Array.prototype.slice.call(panel.querySelectorAll('textarea'))
          .filter(function (el) { return !ignored.has(el.id); })
          .map(function (el) { return el.value; }).join(' ');
        var words = countWords(content);
        if (words < 20) {
          show('Write at least 20 words in this round before stamping its draft. The stamp does not grade the writing.');
          return;
        }
        var minute = Math.max(0, Math.round((Date.now() - stampAnchor) / 60000));
        state.stamped[n] = { minute: minute, words: words };
        touch(null);
        show('Round ' + n + ' draft stamped (' + words + ' words in this round). A stamp is a process checkpoint, not evidence that AI was or was not used.');
        render();
      });
    });

    var challenges = [
      function (h) { return 'For ' + h + ', identify one source that would challenge your interpretation. How would you respond to that evidence?'; },
      function (h) { return 'For ' + h + ', which date is easiest to get wrong, and what document or recording establishes it?'; },
      function (h) { return 'For ' + h + ', why is the wrestler’s real biography different from the advertised character? Prove it with a specific source.'; },
      function (h) { return 'For ' + h + ', find one promotional detail that an American fan in another decade might have interpreted differently.'; },
      function (h) { return 'For ' + h + ', what is your strongest piece of historical evidence, and what does it NOT prove?'; }
    ];
    function challengeIndex(str) {
      return Array.prototype.reduce.call(str, function (n, c) { return ((n * 31) + c.charCodeAt(0)) % 65521; }, 7) % challenges.length;
    }
    function updateDefense() {
      var name = heel.value.trim() || 'your wrestler';
      defense.textContent = challenges[challengeIndex(name.toLowerCase())](name);
      document.getElementById('lab-defense-answer').setAttribute('data-q', 'Source defense: ' + defense.textContent);
    }
    heel.addEventListener('input', updateDefense);
    updateDefense();

    function preserveReceipt(text) {
      if (text.indexOf('WRITING PROCESS RECEIPT') === -1) return;
      /* Keep only the latest other-session summary, avoiding recursive growth.
       * The final receipt stays well within Turn In's 6,000-character limit. */
      state.priorReport = text.split('\nPrevious device/session receipt')[0].slice(0, 2800);
    }
    window.addEventListener('desk-save:reset', function () {
      clearTimeout(deferredRender);
      deferredRender = 0;
      state = blankState();
      lastEdit = 0;
      stampAnchor = Date.now();
      currentReport = '';
      report.value = '';
      override.checked = false;
      feedback.textContent = 'New session. The ordinary 12-word paste limit is active; accessibility and prior-work exceptions are available below.';
      updateFieldLengths();
      render();
    });

    /* Audit receipt across a reload is restored by desk-save later. */
    render();
    window.addEventListener('load', function () {
        setTimeout(function () {
          if (!hadPreviousSession && report.value && report.value !== currentReport &&
              report.value.indexOf('WRITING PROCESS RECEIPT') !== -1) {
            preserveReceipt(report.value);
          }
          render();
        }, 140);
      }, { once: true });
    /* Form and report are readable as a teacher-facing note: never a private tracker. */
    window.__heelOriginality = { version: '1', receipt: function () { return report.value; } };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
