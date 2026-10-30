/* Personal report. Reads live assignment fields and never writes their values.
 * The shared desk-save runtime remains the only owner of research answers.
 */
(function () {
  'use strict';
  function boot() {
    var lab = document.getElementById('lab');
    if (!lab) return;
    var chapters = [
      { title: 'The person behind the character', fields: [
        ['lab-heel', 'The wrestler'], ['lab-identity', 'Identity and portrayal'],
        ['lab-initial-hypothesis', 'First impressions'], ['lab-character-clue', 'The defining detail']
      ] },
      { title: 'The history behind the headline', fields: [
        ['lab-history', 'The historical moment'], ['lab-event-date', 'The event'],
        ['lab-character-date', 'The character on record'], ['lab-match-date', 'The match or storyline'],
        ['lab-timeline-meaning', 'What the timeline establishes']
      ] },
      { title: 'The meaning of the boos', fields: [
        ['lab-wrestling', 'History in the ring'], ['lab-audience', 'The audience and its fears'],
        ['lab-america', 'What the portrayal reveals'], ['lab-revised-hypothesis', 'A changed understanding']
      ] },
      { title: 'The evidence behind the argument', fields: [
        ['lab-source-one', 'Source one'], ['lab-source-one-claim', 'What the first source establishes'],
        ['lab-source-two', 'Source two'], ['lab-source-two-claim', 'What the second source establishes'],
        ['lab-independent', 'An independent perspective'], ['lab-visual', 'The visual record']
      ] },
      { title: 'The closing argument', fields: [
        ['lab-slide-one', 'Introducing the heel'], ['lab-slide-two', 'Connecting the headline'],
        ['lab-slide-three', 'The conclusion'], ['lab-talk', 'The presentation'],
        ['lab-defense-answer', 'Defending the evidence']
      ] }
    ];
    var store = 'bts-heels:report:v1';
    var answerStore = 'desk-save:v1:bts-americas-most-hated-research';
    var dialog, report, deck, stage, counter, back, next, meta, opener;
    var slides = [], slideIndex = 0, presenting = false, renderTimer = 0, resizeTimer = 0;
    var lastScope = '', returnScroll = 0;
    function value(id) { var field = document.getElementById(id); return field ? field.value : ''; }
    function node(tag, cls, text) {
      var el = document.createElement(tag);
      if (cls) el.className = cls;
      if (text !== undefined) el.textContent = text;
      return el;
    }
    function button(text, handler, cls) {
      var el = node('button', cls || 'hr-button', text);
      el.type = 'button'; el.addEventListener('click', handler); return el;
    }
    function today() {
      var d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function savedState() {
      try { return JSON.parse(sessionStorage.getItem(answerStore) || '{}'); } catch (e) { return {}; }
    }
    function scope() {
      var state = savedState();
      try { return state.identityKey || sessionStorage.getItem('desk-save:tab') || 'this-tab'; }
      catch (e) { return 'this-tab'; }
    }
    function loadMeta() {
      var state = savedState(), saved = {};
      lastScope = scope();
      try { saved = JSON.parse(sessionStorage.getItem(store) || '{}'); } catch (e) { /* optional storage */ }
      if (saved.scope !== lastScope) saved = {};
      meta.name.value = typeof saved.name === 'string' ? saved.name : state.firstName || '';
      meta.hour.value = typeof saved.hour === 'string' ? saved.hour : state.classPeriod || '';
      meta.date.value = /^\d{4}-\d{2}-\d{2}$/.test(saved.date || '') ? saved.date : today();
    }
    function saveMeta() {
      try { sessionStorage.setItem(store, JSON.stringify({ scope: lastScope, name: meta.name.value, hour: meta.hour.value, date: meta.date.value })); }
      catch (e) { /* The report remains usable if browser storage is unavailable. */ }
    }
    function dateText() {
      var raw = meta.date.value;
      if (!raw) return '';
      return new Date(raw + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    function sentence(text) {
      text = text.trim();
      if (typeof Intl.Segmenter === 'function') return new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)[Symbol.iterator]().next().value?.segment.trim() || '';
      return (text.match(/^[\s\S]*?(?:[.!?](?:["”’']?)(?=\s|$)|$)/) || [text])[0].trim();
    }
    function quote() {
      var text = value('lab-america').trim() || value('lab-identity').trim();
      if (!text) {
        var first = Array.prototype.find.call(lab.querySelectorAll('.lab-panel textarea'), function (el) { return el.value.trim(); });
        text = first ? first.value : '';
      }
      return sentence(text);
    }
    function read() {
      return chapters.map(function (chapter, index) {
        var fields = chapter.fields.map(function (field) {
          return { id: field[0], title: field[1], text: value(field[0]), round: index + 1 };
        });
        if (index === 4) {
          var review = [];
          lab.querySelectorAll('#lab-rubric fieldset').forEach(function (fieldset) {
            var chosen = fieldset.querySelector('input:checked');
            if (!chosen) return;
            var legend = fieldset.querySelector('legend').cloneNode(true);
            legend.querySelectorAll('.lab-points').forEach(function (el) { el.remove(); });
            review.push(legend.textContent.trim().replace(/^Q\d+\s*·\s*/, '').replace(/\btwo-sentence\b/g, 'two sentence').replace(/2[–-]3/, '2 to 3') + ': ' + chosen.value);
          });
          if (review.length) fields.push({ id: 'lab-rubric', title: 'My final review', text: review.join('\n'), round: 5 });
        }
        return { title: chapter.title, number: String(index + 1).padStart(2, '0'), fields: fields };
      });
    }
    function missing(field) {
      var note = node('p', 'hr-incomplete', 'This part is not finished yet. ');
      var link = node('a', '', 'Return to round ' + field.round);
      link.href = '#lab-round-' + field.round;
      link.addEventListener('click', function (e) {
        e.preventDefault(); close();
        document.querySelector('[data-lab-tab="' + field.round + '"]').click();
        var target = document.getElementById(field.id);
        target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'center', behavior: 'auto' });
      });
      note.appendChild(link); return note;
    }
    function cover() {
      var el = node('header', 'hr-cover');
      el.appendChild(node('p', 'hr-eyebrow', 'Beyond the Scoreboard / The Heel Project'));
      var title = node('h1', '', "America’s Most");
      title.appendChild(node('span', '', 'Hated'));
      el.appendChild(title);
      if (value('lab-heel').trim()) el.appendChild(node('p', 'hr-subject', value('lab-heel')));
      var line = quote();
      if (line) el.appendChild(node('blockquote', 'hr-quote', line));
      var byline = node('div', 'hr-byline');
      [meta.name.value.trim(), meta.hour.value.trim() ? 'Hour ' + meta.hour.value.trim() : '', dateText()].filter(Boolean).forEach(function (text) { byline.appendChild(node('span', '', text)); });
      if (byline.childElementCount) el.appendChild(byline);
      return el;
    }
    function render() {
      if (!dialog.open || presenting) return;
      report.replaceChildren(cover());
      read().forEach(function (chapter) {
        var section = node('section', 'hr-chapter');
        section.id = 'hr-chapter-' + chapter.number;
        section.setAttribute('aria-labelledby', 'hr-title-' + chapter.number);
        if (!chapter.fields.some(function (f) { return f.text.trim(); })) section.classList.add('hr-empty-chapter');
        var head = node('header', 'hr-chapter-head');
        head.appendChild(node('span', 'hr-number', chapter.number));
        var title = node('h2', '', chapter.title); title.id = 'hr-title-' + chapter.number;
        head.appendChild(title); section.appendChild(head);
        chapter.fields.forEach(function (field) {
          var block = node('div', 'hr-response' + (field.text.trim() ? '' : ' hr-empty'));
          block.dataset.field = field.id;
          block.appendChild(node('h3', '', field.title));
          if (field.text.trim()) {
            block.appendChild(node('p', 'hr-answer', field.text));
            if ((field.text.trim().match(/\S+/g) || []).length <= 8) block.classList.add('hr-short');
          } else block.appendChild(missing(field));
          section.appendChild(block);
        });
        report.appendChild(section);
      });
    }
    function open(event) {
      opener = event?.currentTarget || document.activeElement;
      returnScroll = scrollY;
      loadMeta();
      dialog.showModal(); render(); dialog.scrollTop = 0;
      document.body.classList.add('hr-open');
      dialog.querySelector('[data-hr-close]').focus({ preventScroll: true });
    }
    function close() {
      if (presenting) stopPresent();
      dialog.close(); document.body.classList.remove('hr-open');
      window.scrollTo({ top: returnScroll, behavior: 'instant' });
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    }
    function slideShell(chapter) {
      var slide = node('article', 'hr-slide');
      var head = node('header', 'hr-slide-head');
      head.appendChild(node('span', 'hr-number', chapter.number));
      head.appendChild(node('h2', '', chapter.title));
      slide.appendChild(head); slide.appendChild(node('div', 'hr-slide-body'));
      return slide;
    }
    function fits(slide) {
      var body = slide.querySelector('.hr-slide-body');
      return slide.scrollHeight <= slide.clientHeight + 1 && slide.scrollWidth <= slide.clientWidth + 1 &&
        (!body || (body.scrollHeight <= body.clientHeight + 1 && body.scrollWidth <= body.clientWidth + 1));
    }
    function segments(text) {
      if (typeof Intl.Segmenter === 'function') return Array.from(new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text), function (s) { return s.segment; });
      return text.match(/[^.!?]*[.!?]+[\s"”’']*|[^.!?]+$/g) || [text];
    }
    function grow(slide) {
      var body = slide.querySelector('.hr-slide-body');
      if (!body) return;
      var base = parseFloat(getComputedStyle(body).fontSize);
      var maximum = Math.min(innerWidth * .041, 76);
      for (var size = base + 2; size <= maximum; size += 2) {
        body.style.fontSize = size + 'px';
        if (!fits(slide)) { body.style.fontSize = (size - 2) + 'px'; break; }
      }
    }
    function paginate(chapter) {
      var slide = slideShell(chapter), body = slide.lastElementChild;
      stage.replaceChildren(slide);
      function finish() {
        if (body.childElementCount) { grow(slide); slides.push(slide); }
        slide = slideShell(chapter); body = slide.lastElementChild; stage.replaceChildren(slide);
      }
      chapter.fields.filter(function (f) { return f.text.trim(); }).forEach(function (field) {
        var queue = segments(field.text), block = null, paragraph = null;
        function addBlock() {
          block = node('div', 'hr-slide-response'); block.dataset.field = field.id;
          block.appendChild(node('h3', '', field.title));
          paragraph = node('p', 'hr-answer'); block.appendChild(paragraph); body.appendChild(block);
        }
        while (queue.length) {
          if (!block) addBlock();
          var before = paragraph.textContent, part = queue[0];
          paragraph.textContent = before + part;
          if (fits(slide)) { queue.shift(); continue; }
          paragraph.textContent = before;
          if (before || body.childElementCount > 1) {
            if (!before) block.remove();
            finish(); block = null; continue;
          }
          // An oversized sentence falls back to a word boundary, then a Unicode
          // grapheme boundary. No content is dropped and no text is made tiny.
          var units = typeof Intl.Segmenter === 'function'
            ? Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(part), function (s) { return s.segment; }) : Array.from(part);
          var low = 1, high = units.length, count = 0;
          while (low <= high) {
            var mid = Math.floor((low + high) / 2);
            paragraph.textContent = units.slice(0, mid).join('');
            if (fits(slide)) { count = mid; low = mid + 1; } else high = mid - 1;
          }
          if (!count) throw new Error('Report slide has no room for its first line.');
          var chunk = units.slice(0, count).join('');
          var boundary = chunk.search(/\s+\S*$/);
          if (boundary > 0) chunk = chunk.slice(0, boundary + 1);
          paragraph.textContent = chunk;
          queue[0] = part.slice(chunk.length);
          if (!queue[0]) queue.shift();
          finish(); block = null;
        }
      });
      if (body.childElementCount) { grow(slide); slides.push(slide); }
    }
    function buildSlides() {
      slides = [];
      var first = node('article', 'hr-slide hr-slide-cover');
      var c = cover();
      var quoteNode = c.querySelector('.hr-quote');
      // The full quote is preserved in the opening slides when too long for the
      // title card. The read view and PDF always retain the complete sentence.
      if (quoteNode) quoteNode.remove();
      first.appendChild(c); stage.replaceChildren(first);
      slides.push(first);
      var line = quote();
      if (line) paginate({ title: 'The argument', number: '“', fields: [{ id: 'cover-quote', title: '', text: line }] });
      read().forEach(paginate);
      slideIndex = Math.min(slideIndex, slides.length - 1);
      showSlide(slideIndex);
    }
    function showSlide(n) {
      slideIndex = Math.max(0, Math.min(slides.length - 1, n));
      stage.replaceChildren(slides[slideIndex]);
      counter.textContent = (slideIndex + 1) + ' / ' + slides.length;
      back.disabled = slideIndex === 0; next.disabled = slideIndex === slides.length - 1;
    }
    function stopPresent() {
      if (!presenting) return;
      presenting = false; dialog.classList.remove('hr-presenting'); deck.hidden = true;
      if (document.fullscreenElement === deck) document.exitFullscreen().catch(function () {});
      render(); dialog.querySelector('[data-hr-present]').focus({ preventScroll: true });
    }
    function present() {
      presenting = true; slideIndex = 0; deck.hidden = false; dialog.classList.add('hr-presenting');
      buildSlides(); deck.focus({ preventScroll: true });
      if (deck.requestFullscreen) deck.requestFullscreen().then(function () { if (presenting) buildSlides(); }).catch(function () { /* Window-filling fallback retains all controls. */ });
    }
    function build() {
      dialog = node('dialog', 'hr-dialog'); dialog.id = 'heel-report';
      dialog.setAttribute('aria-label', "America's Most Hated report"); dialog.setAttribute('data-desk-skip', '');
      var toolbar = node('div', 'hr-toolbar');
      var closeButton = button('Back to project', close); closeButton.dataset.hrClose = '';
      toolbar.appendChild(closeButton);
      var actions = node('div', 'hr-actions');
      var presentButton = button('Present', present); presentButton.dataset.hrPresent = '';
      actions.appendChild(presentButton);
      actions.appendChild(button('Save as PDF', function () { render(); window.print(); }, 'hr-button hr-button-primary'));
      toolbar.appendChild(actions); dialog.appendChild(toolbar);
      var identity = node('div', 'hr-identity'); meta = {};
      [['name', 'Student name', 'text'], ['hour', 'Class hour', 'text'], ['date', 'Date', 'date']].forEach(function (field) {
        var label = node('label', '', field[1]), input = node('input');
        input.id = 'hr-' + field[0]; input.type = field[2]; input.autocomplete = 'off';
        input.setAttribute('data-desk-skip', '');
        label.htmlFor = input.id; label.appendChild(input); identity.appendChild(label); meta[field[0]] = input;
        input.addEventListener('input', function () { saveMeta(); render(); });
      });
      dialog.appendChild(identity);
      report = node('article', 'hr-report'); report.setAttribute('aria-label', 'Personal research report'); dialog.appendChild(report);
      deck = node('div', 'hr-deck'); deck.hidden = true; deck.tabIndex = -1;
      deck.setAttribute('aria-label', 'Report presentation');
      stage = node('div', 'hr-stage'); deck.appendChild(stage);
      var controls = node('nav', 'hr-deck-controls'); controls.setAttribute('aria-label', 'Slide controls');
      back = button('Previous', function () { showSlide(slideIndex - 1); });
      next = button('Next', function () { showSlide(slideIndex + 1); });
      counter = node('span', 'hr-slide-count'); counter.setAttribute('aria-live', 'polite');
      controls.append(back, counter, next, button('Exit presentation', stopPresent)); deck.appendChild(controls); dialog.appendChild(deck);
      stage.addEventListener('click', function () { showSlide(slideIndex + 1); });
      dialog.addEventListener('cancel', function (event) { event.preventDefault(); if (presenting) stopPresent(); else close(); });
      dialog.addEventListener('keydown', function (event) {
        if (!presenting || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === 'Escape') { event.preventDefault(); stopPresent(); }
        else if (event.target.closest('button') && (event.key === ' ' || event.key === 'Enter')) return;
        else if (['ArrowRight', 'ArrowDown', ' ', 'PageDown'].includes(event.key)) { event.preventDefault(); showSlide(slideIndex + 1); }
        else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) { event.preventDefault(); showSlide(slideIndex - 1); }
        else if (event.key === 'Home') { event.preventDefault(); showSlide(0); }
        else if (event.key === 'End') { event.preventDefault(); showSlide(slides.length - 1); }
      });
      document.body.appendChild(dialog);
      var access = button('Report', open, 'hr-access'); access.setAttribute('aria-haspopup', 'dialog'); access.setAttribute('aria-controls', dialog.id);
      document.querySelector('.bar__in').appendChild(access);
      var finish = button('Finish and view report', open, 'lab-action'); finish.id = 'hr-finish';
      document.querySelector('#lab-round-5 .lab-controls').appendChild(finish);
    }
    build();
    function schedule() {
      if (!dialog.open || presenting) return;
      clearTimeout(renderTimer); renderTimer = setTimeout(render, 0);
    }
    lab.addEventListener('input', schedule); lab.addEventListener('change', schedule);
    window.addEventListener('desk-save:reset', function () {
      try { sessionStorage.removeItem(store); } catch (e) { /* optional */ }
      if (dialog.open) close();
      report.replaceChildren(); slides = []; meta.name.value = ''; meta.hour.value = ''; meta.date.value = today();
    });
    document.addEventListener('fullscreenchange', function () { if (presenting && !document.fullscreenElement) stopPresent(); });
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer); resizeTimer = setTimeout(function () { if (presenting) buildSlides(); }, 120);
    });
    window.addEventListener('beforeprint', function () { if (dialog.open && !presenting) render(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
