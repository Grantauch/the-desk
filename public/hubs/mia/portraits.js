/*
 * Michigan Athlete Report · athlete images.
 * An athlete with a photo record gets that image. Everyone else gets a
 * lettered tile in the sport's color, so cards never show a broken image.
 * photo: { src, caption, credit, url, alt } on the athlete record.
 */
(function () {
  'use strict';
  var list = window.MI_ATHLETES || [], records = {};
  var COLORS = { Boxing: '#8c2b22', Basketball: '#b4561c', Baseball: '#1f4e7a', Football: '#3d5a2a', Hockey: '#2b5f73', Tennis: '#6a7d1f' };
  list.forEach(function (a) {
    var p = a.photo || {};
    records[a.slug] = { caption: p.caption || '', credit: p.credit || '', url: p.url || '', alt: p.alt || a.name, label: '' };
  });
  function initials(name) {
    return String(name).replace(/\(.*?\)/g, '').split(/\s+and\s+/i).map(function (part) {
      var w = part.trim().split(/\s+/).filter(Boolean);
      return (w[0] || '').charAt(0) + (w.length > 1 ? w[w.length - 1].charAt(0) : '');
    }).join(' · ').toUpperCase();
  }
  function image(slug, usage) {
    var a = list.find(function (x) { return x.slug === slug; }) || { name: slug, sport: '' };
    if (a.photo && a.photo.src) {
      var img = document.createElement('img');
      img.src = a.photo.src; img.alt = usage === 'profile' ? (a.photo.alt || a.name) : '';
      img.width = 300; img.height = 360; img.decoding = 'async';
      if (usage !== 'profile') img.loading = 'lazy';
      return img;
    }
    var tile = document.createElement('div');
    tile.className = 'mia-tile mia-tile-' + (usage || 'card');
    tile.style.setProperty('--tile', COLORS[a.sport] || '#203a5c');
    if (usage === 'profile') { tile.setAttribute('role', 'img'); tile.setAttribute('aria-label', a.name + ', ' + a.sport); }
    else tile.setAttribute('aria-hidden', 'true');
    var b = document.createElement('b'); b.textContent = initials(a.name); tile.appendChild(b);
    if (usage !== 'thumb') { var s = document.createElement('span'); s.textContent = a.sport; tile.appendChild(s); }
    return tile;
  }
  window.MOH_PORTRAITS = { records: records, image: image };
})();
