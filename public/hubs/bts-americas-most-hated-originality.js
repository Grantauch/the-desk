/* Beyond the Scoreboard · student writing tools.
 * No keystroke counts, paste history, edit tracking, process receipts, or AI scores.
 * Student answers are saved only through the existing desk-save.js service.
 */
(function () {
  'use strict';
  function boot() {
    var lab = document.getElementById('lab');
    if (!lab) return;
    var feedback = document.getElementById('lab-paste-feedback');
    var fullPaste = document.getElementById('lab-paste-override');
    var heel = document.getElementById('lab-heel');
    var defense = document.getElementById('lab-defense-prompt');
    if (!feedback || !fullPaste || !heel || !defense) return;
    var originalHint = feedback.textContent;
    var MAX_PASTE_WORDS = 12;
    var sources = new Set(['lab-source-one', 'lab-source-two']);
    var expanded = null;

    function wordCount(value) {
      return (String(value || '').trim().match(/\S+/g) || []).length;
    }
    function closeExpanded() {
      if (!expanded) return;
      var old = expanded;
      expanded = null;
      old.field.classList.remove('lab-editor-expanded');
      document.body.classList.remove('lab-writing-open');
      old.button.textContent = 'Expand';
      old.button.setAttribute('aria-expanded', 'false');
      old.textarea.focus({ preventScroll: true });
    }
    function expand(field, textarea, button) {
      if (expanded && expanded.field === field) {
        closeExpanded();
        return;
      }
      closeExpanded();
      field.classList.add('lab-editor-expanded');
      document.body.classList.add('lab-writing-open');
      expanded = { field: field, textarea: textarea, button: button };
      button.textContent = 'Close big box';
      button.setAttribute('aria-expanded', 'true');
      textarea.focus({ preventScroll: true });
    }
    window.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && expanded) {
        event.preventDefault();
        closeExpanded();
      }
    });

    var boxes = Array.prototype.slice.call(lab.querySelectorAll('.lab-panel .lab-field textarea'));
    boxes.forEach(function (textarea) {
      var field = textarea.closest('.lab-field');
      if (!field) return;
      var isSource = sources.has(textarea.id);
      textarea.setAttribute('lang', 'en');
      textarea.setAttribute('spellcheck', 'true');
      textarea.setAttribute('autocorrect', 'on');
      textarea.setAttribute('autocapitalize', isSource ? 'off' : 'sentences');
      textarea.rows = Math.max(textarea.rows || 0, 5);

      var toolbar = document.createElement('div');
      toolbar.className = 'lab-writing-tools';
      var count = document.createElement('span');
      count.className = 'lab-word-count';
      count.setAttribute('aria-live', 'off');
      count.textContent = wordCount(textarea.value) + ' words';
      toolbar.appendChild(count);

      var caps = null;
      if (!isSource) {
        caps = document.createElement('button');
        caps.type = 'button';
        caps.className = 'lab-editor-button';
        caps.textContent = 'Auto-caps: on';
        caps.setAttribute('aria-pressed', 'true');
        caps.setAttribute('aria-label', 'Automatic capital letters. On. Click to turn off.');
        caps.addEventListener('click', function () {
          var enabled = caps.getAttribute('aria-pressed') !== 'true';
          caps.setAttribute('aria-pressed', String(enabled));
          caps.textContent = 'Auto-caps: ' + (enabled ? 'on' : 'off');
          caps.setAttribute('aria-label', 'Automatic capital letters. ' + (enabled ? 'On. Click to turn off.' : 'Off. Click to turn on.'));
          textarea.setAttribute('autocapitalize', enabled ? 'sentences' : 'off');
        });
        toolbar.appendChild(caps);
      }

      var enlarge = document.createElement('button');
      enlarge.type = 'button';
      enlarge.className = 'lab-editor-button lab-editor-expand';
      enlarge.textContent = 'Expand';
      enlarge.setAttribute('aria-controls', textarea.id);
      enlarge.setAttribute('aria-expanded', 'false');
      enlarge.addEventListener('click', function () { expand(field, textarea, enlarge); });
      toolbar.appendChild(enlarge);
      field.appendChild(toolbar);

      textarea.addEventListener('input', function () {
        count.textContent = wordCount(textarea.value) + ' words';
      });

      /* Native autocapitalize helps on phones. This handles physical Chromebook
       * keyboards too, but only for single letters at a sentence beginning.
       * Never rewrite citations, pasted text, selections, or IME composition. */
      if (!isSource) {
        textarea.addEventListener('beforeinput', function (event) {
          if (!event.cancelable || event.isComposing || event.inputType !== 'insertText' ||
              !event.data || !/^[a-z]$/.test(event.data) ||
              caps.getAttribute('aria-pressed') !== 'true') return;
          var start = textarea.selectionStart, end = textarea.selectionEnd;
          if (start !== end || start == null) return;
          var before = textarea.value.slice(0, start);
          var atStart = !before.replace(/[\s"'“”‘’()[\]]/g, '');
          var afterPunctuation = /[.!?]\s*["'“”‘’([ ]*$/.test(before);
          var afterNewline = /\n\s*["'“”‘’([ ]*$/.test(before);
          if (!(atStart || afterPunctuation || afterNewline)) return;
          event.preventDefault();
          textarea.setRangeText(event.data.toUpperCase(), start, end, 'end');
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        });
      }
    });

    lab.addEventListener('paste', function (event) {
      var textarea = event.target;
      if (!textarea || !textarea.matches || !textarea.matches('.lab-panel textarea') ||
          sources.has(textarea.id) || fullPaste.checked) return;
      var text = event.clipboardData && event.clipboardData.getData('text/plain');
      if (typeof text !== 'string' || !text.length) return;
      if (wordCount(text) > MAX_PASTE_WORDS) {
        event.preventDefault();
        feedback.textContent = 'That was more than 12 words, so it was not pasted. Write your answer here, or check "Allow full paste" if you wrote it elsewhere or use a writing tool.';
      }
    }, true);
    fullPaste.addEventListener('change', function () {
      feedback.textContent = fullPaste.checked
        ? 'Full paste is on. You can paste your own draft or use an accessibility tool.'
        : originalHint;
    });

    var challenges = [
      function (h) { return 'For ' + h + ', find one source that disagrees with your idea. What would you say about it?'; },
      function (h) { return 'For ' + h + ', which date might someone get wrong? What source shows the correct date?'; },
      function (h) { return 'For ' + h + ', how was the real wrestler different from the character? Give one fact and a source.'; },
      function (h) { return 'For ' + h + ', name one detail that fans in a different decade might see differently.'; },
      function (h) { return 'For ' + h + ', what is your strongest fact? What does that fact NOT tell us?'; }
    ];
    function challengeIndex(value) {
      return Array.prototype.reduce.call(value, function (n, c) {
        return ((n * 31) + c.charCodeAt(0)) % 65521;
      }, 7) % challenges.length;
    }
    function updateDefense() {
      var name = heel.value.trim() || 'your wrestler';
      defense.textContent = challenges[challengeIndex(name.toLowerCase())](name);
      var answer = document.getElementById('lab-defense-answer');
      if (answer) answer.setAttribute('data-q', 'Source defense: ' + defense.textContent);
    }
    heel.addEventListener('input', updateDefense);
    updateDefense();
    window.addEventListener('desk-save:reset', function () {
      closeExpanded();
      fullPaste.checked = false;
      feedback.textContent = originalHint;
      boxes.forEach(function (textarea) {
        textarea.setAttribute('autocapitalize', sources.has(textarea.id) ? 'off' : 'sentences');
        var count = textarea.parentElement.querySelector('.lab-word-count');
        if (count) count.textContent = wordCount(textarea.value) + ' words';
        var caps = textarea.parentElement.querySelector('.lab-editor-button[aria-pressed]');
        if (caps) {
          caps.setAttribute('aria-pressed', 'true');
          caps.textContent = 'Auto-caps: on';
          caps.setAttribute('aria-label', 'Automatic capital letters. On. Click to turn off.');
        }
      });
      updateDefense();
    });
    /* Clear obsolete counters on this device. This code never creates new ones. */
    try { sessionStorage.removeItem('bts-heels:originality-session:v1'); } catch (error) { /* optional */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
