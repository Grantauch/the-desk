
/* BTS America's Most Hated: stage navigation, evidence comparison and self-check.
 * Student answers are intentionally NOT saved here. Shared desk-save.js owns
 * all PIN recovery, snapshots, cloud progress and server-acknowledged Turn In.
 */
(function () {
  'use strict';
  function boot() {
    var lab = document.getElementById('lab');
    if (!lab) return;
    var tabs = Array.prototype.slice.call(lab.querySelectorAll('[data-lab-tab]'));
    var panels = Array.prototype.slice.call(lab.querySelectorAll('[data-lab-round]'));
    var input = function (id) { return document.getElementById(id); };
    var val = function (id) { var el = input(id); return el ? el.value.trim() : ''; };
    var selection = input('lab-heel');
    var scores = [10, 15, 15, 15, 15, 10, 10, 5, 5];
    var required = [
      ['lab-heel', 'lab-identity', 'lab-character-clue'],
      ['lab-history', 'lab-event-date', 'lab-character-date', 'lab-timeline-meaning'],
      ['lab-wrestling', 'lab-audience', 'lab-america'],
      ['lab-source-one', 'lab-source-one-claim', 'lab-source-two', 'lab-source-two-claim', 'lab-independent', 'lab-visual'],
      ['lab-slide-one', 'lab-slide-two', 'lab-talk']
    ];
    /* These thresholds signal meaningful draft text, NOT factual quality. */
    var minimums = {
      'lab-heel': 3, 'lab-identity': 45, 'lab-character-clue': 20,
      'lab-history': 45, 'lab-event-date': 4, 'lab-character-date': 4, 'lab-timeline-meaning': 35,
      'lab-wrestling': 45, 'lab-audience': 45, 'lab-america': 45,
      'lab-source-one': 20, 'lab-source-one-claim': 25, 'lab-source-two': 20,
      'lab-source-two-claim': 25, 'lab-independent': 25, 'lab-visual': 25,
      'lab-slide-one': 20, 'lab-slide-two': 20, 'lab-talk': 35
    };
    var active = 1;

    function go(n, shouldScroll) {
      if (n < 1 || n > panels.length) return;
      active = n;
      tabs.forEach(function (button) {
        var on = +button.getAttribute('data-lab-tab') === n;
        if (on) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      });
      panels.forEach(function (panel) {
        panel.hidden = +panel.getAttribute('data-lab-round') !== n;
      });
      if (shouldScroll) {
        tabs[n - 1].focus({ preventScroll: true });
        lab.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      }
    }
    tabs.forEach(function (button) {
      button.addEventListener('click', function () { go(+button.getAttribute('data-lab-tab'), true); });
    });
    lab.querySelectorAll('[data-lab-go]').forEach(function (button) {
      button.addEventListener('click', function () { go(+button.getAttribute('data-lab-go'), true); });
    });

    /* Draw the selection from the existing 15-person card, not a second fact list. */
    var choices = input('lab-heel-choices');
    var datalist = input('lab-heel-options');
    var boutNames = Array.prototype.slice.call(document.querySelectorAll('#card .bout__name'))
      .map(function (node) { return node.textContent.trim(); })
      .filter(Boolean);
    boutNames.forEach(function (name) {
      var option = document.createElement('option');
      option.value = name;
      datalist.appendChild(option);
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = name;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', function () {
        selection.value = name;
        selection.dispatchEvent(new Event('input', { bubbles: true }));
        selection.dispatchEvent(new Event('change', { bubbles: true }));
        selection.focus();
      });
      choices.appendChild(button);
    });
    function markChoice() {
      choices.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.textContent === selection.value.trim()));
      });
    }
    selection.addEventListener('input', markChoice);

    function draftStatus() {
      return required.map(function (fields) {
        return fields.every(function (id) { return val(id).length >= minimums[id]; });
      });
    }
    function update() {
      var drafts = draftStatus();
      var complete = drafts.filter(Boolean).length;
      var progress = input('lab-progress');
      progress.textContent = complete + ' / 5';
      input('lab-meter').setAttribute('aria-valuenow', String(complete));
      input('lab-meter-fill').style.width = (complete / 5 * 100) + '%';
      tabs.forEach(function (button, i) {
        button.setAttribute('data-drafted', String(drafts[i]));
      });
      var score = 0;
      scores.forEach(function (points, index) {
        var checked = lab.querySelector('input[name="lab_check_' + (index + 1) + '"]:checked');
        if (checked && checked.value === 'Yes') score += points;
      });
      input('lab-score-count').textContent = score + ' of 100 points self-checked';
      var unfinished = drafts.map(function (ready, i) { return ready ? '' : 'round ' + (i + 1); }).filter(Boolean);
      var message = complete === 5
        ? 'All five rounds have draft content. That does NOT certify accuracy or an A. Check your historical dates, evidence, sources, delivery and rubric.'
        : 'Draft content still needed in ' + unfinished.join(', ') + '. Your teacher grades the actual work, not this meter.';
      input('lab-missing').textContent = message;
      markChoice();
    }
    lab.addEventListener('input', update);
    lab.addEventListener('change', update);

    /* Partial dates are accepted without inventing an exact day. */
    function parseDate(raw) {
      var y = /^(\d{4})$/.exec(raw);
      if (y) {
        var yr = +y[1];
        return yr >= 1800 && yr <= 2100 ? { year: yr, precision: 'year', time: Date.UTC(yr, 0, 1) } : null;
      }
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
      if (!m) return null;
      var a = +m[1], b = +m[2], c = +m[3];
      if (a < 1800 || a > 2100) return null;
      var d = new Date(Date.UTC(a, b - 1, c));
      if (d.getUTCFullYear() !== a || d.getUTCMonth() + 1 !== b || d.getUTCDate() !== c) return null;
      return { year: a, precision: 'day', time: d.getTime() };
    }
    input('lab-compare').addEventListener('click', function () {
      var event = parseDate(val('lab-event-date'));
      var start = parseDate(val('lab-character-date'));
      var boutRaw = val('lab-match-date');
      var bout = boutRaw ? parseDate(boutRaw) : null;
      var msg = '';
      if (!event || !start || (boutRaw && !bout)) {
        msg = 'Use a supported year (YYYY) or exact date (YYYY-MM-DD). Do not guess a day if the source gives only a year.';
      } else if (event.year === start.year && (event.precision === 'year' || start.precision === 'year')) {
        msg = 'The event and earliest verified character date fall in the same year. Your dates are not precise enough to say which happened first. Look for stronger evidence.';
      } else if (start.time < event.time) {
        msg = 'Your evidence places this character before the historical event. The event could have reshaped the act, but cannot have created an already-existing act.';
      } else if (start.time > event.time) {
        msg = 'Your event comes first. That makes an influence possible, but it does not prove one. Find a source linking the storyline to the event.';
      } else {
        msg = 'Both events have the same recorded date. This alone cannot prove the storyline was caused by the news.';
      }
      if (bout && event && bout.year < event.year) msg += ' Your selected match or promo also predates the event. Recheck the causal claim.';
      else if (bout && event && bout.year > event.year) msg += ' Your match or promo follows the headline; use a reliable source to explain the connection.';
      msg += ' Record your conclusion in the box above the Next button.';
      input('lab-date-feedback').textContent = msg;
    });

    /* A zero-pressure practice stopwatch. Timings remain on-device only. */
    var elapsed = 0, started = 0, ticker = 0;
    var clock = input('lab-clock'), hint = input('lab-timer-result');
    function ms() { return elapsed + (started ? Date.now() - started : 0); }
    function paintTimer() {
      var sec = Math.floor(ms() / 1000);
      clock.textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
    }
    function feedback() {
      var sec = Math.floor(ms() / 1000);
      hint.textContent = sec < 120 ? 'Under 2:00. Add explanation or evidence.' :
        sec <= 180 ? 'Within the 2–3 minute target.' : 'Over 3:00. Cut details that do not support your argument.';
    }
    input('lab-timer-start').addEventListener('click', function () {
      if (started) return;
      started = Date.now();
      ticker = setInterval(paintTimer, 250);
      hint.textContent = 'Practice out loud, not just in your head.';
    });
    input('lab-timer-stop').addEventListener('click', function () {
      if (started) {
        elapsed = ms();
        started = 0;
        clearInterval(ticker);
      }
      paintTimer(); feedback();
    });
    input('lab-timer-reset').addEventListener('click', function () {
      clearInterval(ticker);
      elapsed = 0; started = 0; paintTimer();
      hint.textContent = 'Aim for 2:00–3:00.';
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && started) {
        elapsed = ms();
        started = 0;
        clearInterval(ticker);
        paintTimer();
        hint.textContent = 'Paused when you switched away. Resume when ready.';
      }
    });

    /* Default to round one with all research fields present for desk-save. */
    go(1, false);
    update();
    /* PIN restoration runs in the shared runtime shortly after window load. */
    window.addEventListener('load', function () { setTimeout(update, 200); }, { once: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
