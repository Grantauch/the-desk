/* Front Lines: the shared thread through the WWI battle ByteSizes.
   One list of battles in date order. A battle links once its hub is published:
   set its href here and every other battle page picks it up. */
(function () {
  'use strict';
  var BATTLES = [
    { id: 'tannenberg', name: 'Tannenberg', when: 'Aug 1914', start: '1914-08-26' },
    { id: 'marne', name: 'The Marne', when: 'Sept 1914', start: '1914-09-05', href: '/hubs/ush9-bytesize-marne.html' },
    { id: 'far-fronts', name: 'Tsingtao and East Africa', when: 'Oct 1914', start: '1914-10-31' },
    { id: 'ypres', name: 'Second Ypres', when: 'Apr 1915', start: '1915-04-22' },
    { id: 'gallipoli', name: 'Gallipoli', when: 'Apr 1915', start: '1915-04-25' },
    { id: 'verdun', name: 'Verdun', when: 'Feb 1916', start: '1916-02-21' },
    { id: 'jutland', name: 'Jutland and the U boats', when: 'May 1916', start: '1916-05-31' },
    { id: 'brusilov', name: 'The Brusilov Offensive', when: 'June 1916', start: '1916-06-04' },
    { id: 'somme', name: 'The Somme', when: 'July 1916', start: '1916-07-01' },
    { id: 'vimy', name: 'Vimy Ridge', when: 'Apr 1917', start: '1917-04-09' },
    { id: 'messines', name: 'Messines Ridge', when: 'June 1917', start: '1917-06-07' },
    { id: 'aqaba', name: 'Aqaba and Megiddo', when: 'July 1917', start: '1917-07-06' },
    { id: 'passchendaele', name: 'Passchendaele', when: 'July 1917', start: '1917-07-31' },
    { id: 'caporetto', name: 'Caporetto', when: 'Oct 1917', start: '1917-10-24' },
    { id: 'cambrai', name: 'Cambrai', when: 'Nov 1917', start: '1917-11-20' },
    { id: 'kaiserschlacht', name: 'The Kaiser’s Battle', when: 'Mar 1918', start: '1918-03-21' },
    { id: 'cantigny', name: 'Cantigny and Château Thierry', when: 'May 1918', start: '1918-05-28' },
    { id: 'belleau', name: 'Belleau Wood', when: 'June 1918', start: '1918-06-06' },
    { id: 'amiens', name: 'Amiens', when: 'Aug 1918', start: '1918-08-08' },
    { id: 'st-mihiel', name: 'St. Mihiel', when: 'Sept 1918', start: '1918-09-12' },
    { id: 'meuse-argonne', name: 'The Meuse Argonne', when: 'Sept 1918', start: '1918-09-26' }
  ];
  var T0 = Date.UTC(1914, 6, 28), T1 = Date.UTC(1918, 10, 11);
  var pct = function (iso) { var p = iso.split('-').map(Number); return ((Date.UTC(p[0], p[1] - 1, p[2]) - T0) / (T1 - T0)) * 100; };
  var el = function (tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };

  var strip = document.querySelector('[data-front-lines]');
  var hereId = strip ? strip.getAttribute('data-front-lines') : document.documentElement.getAttribute('data-front-lines');
  var hereIndex = -1;
  BATTLES.forEach(function (b, i) { if (b.id === hereId) hereIndex = i; });

  if (strip && hereIndex > -1) {
    var here = BATTLES[hereIndex];
    var row = el('div', 'fl-row');
    var mark = el('div', 'fl-mark');
    mark.innerHTML = '<svg viewBox="0 0 34 10" aria-hidden="true"><path d="M0 6 H5 V2 H11 V8 H17 V3 H23 V7 H29 V4 H34" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
    mark.append(document.createTextNode('Front Lines '));
    mark.append(el('span', '', 'battle ' + (hereIndex + 1) + ' of ' + BATTLES.length));
    var ribbon = el('div', 'fl-ribbon');
    ribbon.setAttribute('role', 'list');
    ribbon.setAttribute('aria-label', 'World War I battles from 1914 to 1918');
    ribbon.append(el('div', 'fl-axis'));
    [1915, 1916, 1917, 1918].forEach(function (y) {
      var yr = el('span', 'fl-year', String(y));
      yr.style.left = pct(y + '-01-01') + '%';
      yr.setAttribute('aria-hidden', 'true');
      ribbon.append(yr);
    });
    BATTLES.forEach(function (b, i) {
      var isHere = i === hereIndex;
      var live = b.href && !isHere;
      var t = el(live ? 'a' : 'span', 'fl-tick' + (isHere ? ' fl-here' : ''));
      t.style.left = pct(b.start) + '%';
      t.setAttribute('role', 'listitem');
      var label = b.name + ', ' + b.when + (isHere ? ', you are here' : live ? '' : ', coming soon');
      t.setAttribute('aria-label', label);
      t.title = label;
      if (live) t.href = b.href;
      if (isHere) t.setAttribute('aria-current', 'page');
      ribbon.append(t);
    });
    var lab = el('span', 'fl-label', here.name);
    var p = pct(here.start);
    lab.style.left = p > 70 ? 'auto' : 'calc(' + p + '% + 9px)';
    if (p > 70) lab.style.right = 'calc(' + (100 - p) + '% + 9px)';
    ribbon.append(lab);
    row.append(mark, ribbon);
    strip.replaceChildren(row);
  }

  var next = document.querySelector('[data-front-lines-next]');
  if (next && hereIndex > -1) {
    var wrap = el('div', 'fl-next');
    var add = function (label, b) {
      if (!b) return;
      var part = el('span', '');
      part.append(document.createTextNode(label + ' '));
      if (b.href) { var a = el('a', '', b.name + ' · ' + b.when); a.href = b.href; part.append(a); }
      else { part.append(el('span', 'fl-soon', b.name + ' · ' + b.when)); part.append(el('span', 'fl-soon-note', ' (coming soon)')); }
      wrap.append(part);
    };
    add('Before this:', BATTLES[hereIndex - 1]);
    add('Next on the front lines:', BATTLES[hereIndex + 1]);
    next.replaceChildren(wrap);
  }
})();
