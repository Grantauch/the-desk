(() => {
  const audit = document.querySelector('[data-record-audit]');
  if (audit) {
    const buttons = [...audit.querySelectorAll('[data-audit-filter]')];
    const entries = [...audit.querySelectorAll('.record-entry[data-level]')];
    const status = audit.querySelector('[data-audit-status]');

    function applyFilter(value) {
      let shown = 0;
      entries.forEach(entry => {
        const visible = value === 'all' || entry.dataset.level === value;
        entry.hidden = !visible;
        if (visible) shown += 1;
      });
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.auditFilter === value)));
      if (status) {
        status.textContent = value === 'all'
          ? `${shown} audited entries shown. Eleven are firmly tied to football injury; nine require attribution caution.`
          : `${shown} ${value.replaceAll('-', ' ')} ${shown === 1 ? 'entry' : 'entries'} shown.`;
      }
    }

    buttons.forEach(button => button.addEventListener('click', () => applyFilter(button.dataset.auditFilter)));
    applyFilter('all');
  }

  const opener = document.querySelector('[data-gold-guide-open]');
  const guide = document.querySelector('[data-gold-guide]');
  const shade = document.querySelector('[data-gold-guide-shade]');
  const closer = document.querySelector('[data-gold-guide-close]');
  if (!opener || !guide || !shade || !closer) return;

  function setGuide(open) {
    guide.classList.toggle('is-open', open);
    shade.classList.toggle('is-open', open);
    guide.setAttribute('aria-hidden', String(!open));
    opener.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('gold-guide-opened', open);
    if (open) closer.focus();
    else opener.focus();
  }

  opener.addEventListener('click', () => setGuide(true));
  closer.addEventListener('click', () => setGuide(false));
  shade.addEventListener('click', () => setGuide(false));
  guide.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setGuide(false)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && guide.classList.contains('is-open')) setGuide(false);
  });
})();
