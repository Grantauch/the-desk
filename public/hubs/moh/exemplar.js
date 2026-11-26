/* Reading-only view controls. No account, answer fields or save/Turn In hooks. */
(function () {
  'use strict';
  var toggle = document.getElementById('toggle-notes');
  var status = document.getElementById('view-status');
  if (!toggle || !status) return;
  document.querySelector('[data-example-controls]').hidden = false;
  toggle.addEventListener('click', function () {
    var hidden = document.body.classList.toggle('notes-hidden');
    toggle.setAttribute('aria-pressed', String(!hidden));
    toggle.textContent = hidden ? 'Show explanation notes' : 'Hide explanation notes';
    status.textContent = hidden ? 'Reading the finished assignment. Explanation notes are hidden.' : 'Explanation notes are showing.';
  });
  document.getElementById('print-example').addEventListener('click', function () { window.print(); });
})();
