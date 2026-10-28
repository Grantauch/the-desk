/* Over There: shared state, dog tags, chapter nav, data loading. */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Tab only: a shared Chromebook starts clean for the next student.
  const store = {
    get(k, fallback) { try { const v = sessionStorage.getItem('ot1-' + k); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(k, v) { try { sessionStorage.setItem('ot1-' + k, JSON.stringify(v)); } catch (e) {} }
  };

  const OT = window.OT = window.OT || {};
  OT.$ = $; OT.$$ = $$; OT.reduce = reduce; OT.store = store;
  const BASE = 'ush9-over-there/';
  OT.base = BASE;
  const getJSON = url => fetch(BASE + url).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
  OT.world = getJSON('data/countries-50m.json');
  OT.world.catch(() => {});
  let usP = null;
  OT.us = () => (usP = usP || getJSON('data/states-10m.json'));

  OT.whenNear = function (el, fn) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(); return; }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: '400px 0px' });
    io.observe(el);
  };
  OT.commas = n => Number(n).toLocaleString('en-US');
  OT.countTo = function (el, to, fmt) {
    fmt = fmt || OT.commas;
    const from = Number(el.dataset.v || 0); el.dataset.v = to;
    if (reduce) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = 700;
    (function tick(t) {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(Math.round(from + (to - from) * e));
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  };
  OT.esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* Dog tags */
  const TAGS = [
    ['globe', 'Follow the war around the globe', '#top'],
    ['days', 'Step through all 37 days', '#days'],
    ['lusitania', 'Sort the Lusitania passengers', '#lusitania'],
    ['decoder', 'Decode the Zimmermann Telegram', '#decoder'],
    ['vote', 'Cast your vote in the House', '#vote'],
    ['front', 'Move the Western Front', '#westfront'],
    ['pins', 'Meet four Americans at the front', '#westfront'],
    ['trench', 'Explore the whole trench', '#trench'],
    ['words', 'Close every case file', '#words'],
    ['flu', 'Make the flu prediction', '#flu'],
    ['points', 'Score all fourteen points', '#points'],
    ['verdict', 'Write your verdict', '#verdict']
  ];
  const saved = store.get('tags', []);
  const tags = new Set(Array.isArray(saved) ? saved : []);
  function render() {
    $('#tag-count').textContent = tags.size;
    $('#tag-total').textContent = TAGS.length;
    $('#tag-list').innerHTML = TAGS.map(([id, label, href]) => `<li class="${tags.has(id) ? 'done' : ''}"><a href="${href}">${label}</a></li>`).join('');
  }
  OT.tag = function (id) {
    if (tags.has(id)) return;
    tags.add(id); store.set('tags', Array.from(tags)); render();
    const s = $('#tags summary');
    if (s && !reduce && s.animate) s.animate([{ transform: 'scale(1.3)', background: '#C8B88A', color: '#0F110D' }, { transform: 'scale(1)' }], { duration: 700, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  };
  render();
  $('#tag-list').addEventListener('click', e => { if (e.target.closest('a')) $('#tags').open = false; });

  /* Active chapter in the nav */
  (function () {
    const links = $$('.chapters a');
    const secs = links.map(a => document.getElementById(a.dataset.ch)).filter(Boolean);
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(es => {
      es.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(a => a.classList.toggle('active', a.dataset.ch === e.target.id));
        const on = links.find(a => a.dataset.ch === e.target.id);
        if (on) on.parentElement.scrollTo({ left: on.offsetLeft - 40, behavior: reduce ? 'auto' : 'smooth' });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(s => io.observe(s));
  })();
})();
