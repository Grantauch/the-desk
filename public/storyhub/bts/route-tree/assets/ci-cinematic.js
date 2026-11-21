/* Local, unsaved evidence comparison. Native source disclosures also work without JS. */
document.querySelectorAll('[data-ink-compare]').forEach(figure => {
  const stage = figure.querySelector('.ink-stage');
  const controls = figure.querySelector('.ink-controls');
  if (!stage || !controls) return;
  const range = controls.querySelector('input');
  const render = () => {
    const value = Math.max(0, Math.min(100, Number(range.value)));
    stage.style.setProperty('--ink-reveal', `${value}%`);
    range.setAttribute('aria-valuetext', `${value}% ink interpretation, ${100 - value}% source photograph`);
  };
  controls.hidden = false;
  range.addEventListener('input', render);
  render();
});
