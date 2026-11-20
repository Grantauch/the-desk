/* Read-only assignment field guide. No student account, inputs, saving or Turn In. */
(function () {
  'use strict';
  var steps = ['facts', 'words', 'story1', 'story2', 'why', 'art', 'finish'];
  var root = document.getElementById('guide-tour');
  if (!root) return;
  var panels = Array.prototype.slice.call(root.querySelectorAll('[data-tour-panel]'));
  var links = Array.prototype.slice.call(root.querySelectorAll('[data-tour-link]'));
  var count = document.getElementById('tour-counter');
  var position = document.getElementById('tour-position');
  var progress = document.getElementById('tour-progress');
  var prev = document.getElementById('tour-prev');
  var next = document.getElementById('tour-next');
  var pager = document.querySelector('[data-tour-pager]');
  if (panels.length !== steps.length || links.length !== steps.length || !prev || !next || !pager) return;

  var current = steps.indexOf(decodeURIComponent(window.location.hash.slice(1)).replace(/^tour-/, ''));
  if (current < 0) current = 0;

  function show(index, moveFocus, updateAddress) {
    current = Math.max(0, Math.min(steps.length - 1, index));
    panels.forEach(function (panel, i) { panel.hidden = i !== current; });
    links.forEach(function (link, i) {
      if (i === current) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
    count.textContent = 'Step ' + (current + 1) + ' of ' + steps.length;
    position.textContent = (current + 1) + ' / ' + steps.length;
    progress.style.width = ((current + 1) / steps.length * 100) + '%';
    prev.disabled = current === 0;
    next.disabled = current === steps.length - 1;
    next.textContent = current === steps.length - 1 ? 'You saw every step' : 'Next step →';
    if (updateAddress && window.history && window.history.replaceState) {
      window.history.replaceState(null, '', '#tour-' + steps[current]);
    }
    if (moveFocus) {
      document.getElementById('walkthrough').scrollIntoView({ block: 'start' });
      var title = panels[current].querySelector('h3');
      if (title) title.focus({ preventScroll: true });
    }
  }

  links.forEach(function (link, i) {
    link.addEventListener('click', function (event) {
      event.preventDefault();
      show(i, true, true);
    });
  });
  prev.addEventListener('click', function () { show(current - 1, true, true); });
  next.addEventListener('click', function () { show(current + 1, true, true); });

  panels.forEach(function (panel) {
    var items = Array.prototype.slice.call(panel.querySelectorAll('.idea-bank li'));
    var output = panel.querySelector('.idea-live');
    var trigger = panel.querySelector('.idea-next');
    if (!items.length || !output || !trigger) return;
    var index = 0;
    trigger.addEventListener('click', function () {
      index = (index + 1) % items.length;
      output.textContent = items[index].textContent;
    });
  });

  document.body.setAttribute('data-tour-ready', '');
  pager.hidden = false;
  show(current, false, false);
  window.addEventListener('hashchange', function () {
    var index = steps.indexOf(decodeURIComponent(window.location.hash.slice(1)).replace(/^tour-/, ''));
    if (index >= 0 && index !== current) show(index, false, false);
  });
})();