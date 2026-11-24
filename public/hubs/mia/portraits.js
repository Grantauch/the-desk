/*
 * Michigan Athlete Report · athlete images.
 * An athlete with a photo record gets that image. Everyone else gets a
 * lettered tile in the sport's color, so cards never show a broken image.
 * Only reviewed same-site photographs are loaded on the public gallery and profiles.
 */
(function () {
  'use strict';
  var list = window.MI_ATHLETES || [], records = {};
  var COLORS = { Boxing: '#8c2b22', Basketball: '#b4561c', Baseball: '#1f4e7a', Football: '#3d5a2a', Hockey: '#2b5f73', Tennis: '#6a7d1f' };
  var PHOTOS = {
    'eddie-tolan': [
      'Eddie Tolan, foreground runner in the original group photo.',
      'NEA / Midland Reporter-Telegram, May 2, 1930, p. 4 · Texas Tech University · U.S. public domain · Cropped',
      'https://newspapers.swco.ttu.edu/bitstreams/97bfc603-4559-4a54-b1c4-9f13f1e4baf9/download#page=4'
    ],
    'joe-louis': [
      'Joe Louis in a boxing stance wearing gloves.',
      'Library of Congress, c. 1936 · No known publication restrictions; no renewal recorded · Cropped',
      'https://www.loc.gov/pictures/item/2017657394/'
    ],
    'sheila-young': [
      'Sheila Young smiling at the 1975 world speed skating championships medal ceremony in Assen.',
      'Hans Peters / Anefo / Nationaal Archief · Cropped',
      'https://www.nationaalarchief.nl/onderzoeken/fotocollectie/ac623d06-d0b4-102d-bcf8-003048976d84',
      'CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'
    ],
    'thomas-hearns': [
      'Tommy Hearns in Detroit around December 1981.',
      'Carptrash · Cropped',
      'https://commons.wikimedia.org/wiki/File:Tommy_Hearns_ca._Dec._1981,_Detroit_Michigan_USA.jpg',
      'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0/'
    ],
    'kirk-gibson': [
      'Kirk Gibson at a 2017 event in Phoenix, Arizona.',
      'Gage Skidmore · Cropped',
      'https://commons.wikimedia.org/wiki/File:Kirk_Gibson_by_Gage_Skidmore.jpg',
      'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0/'
    ]
  };
  list.forEach(function (a) {
    var p = PHOTOS[a.slug];
    records[a.slug] = p ? {
      src: '/hubs/mia/portraits/' + a.slug + '.webp',
      alt: p[0], caption: p[1], url: p[2], credit: 'Original photo',
      license: p[3], licenseUrl: p[4]
    } : {};
  });
  function initials(name) {
    return String(name).replace(/\(.*?\)/g, '').split(/\s+and\s+/i).map(function (part) {
      var w = part.trim().split(/\s+/).filter(Boolean);
      return (w[0] || '').charAt(0) + (w.length > 1 ? w[w.length - 1].charAt(0) : '');
    }).join(' · ').toUpperCase();
  }
  function initialsTile(a, usage) {
    var tile = document.createElement('div');
    tile.className = 'mia-tile mia-tile-' + (usage || 'card');
    tile.style.setProperty('--tile', COLORS[a.sport] || '#203a5c');
    if (usage === 'profile') { tile.setAttribute('role', 'img'); tile.setAttribute('aria-label', a.name + ', ' + a.sport); }
    else tile.setAttribute('aria-hidden', 'true');
    var b = document.createElement('b'); b.textContent = initials(a.name); tile.appendChild(b);
    if (usage !== 'thumb') { var s = document.createElement('span'); s.textContent = a.sport; tile.appendChild(s); }
    return tile;
  }
  function image(slug, usage) {
    var a = list.find(function (x) { return x.slug === slug; }) || { name: slug, sport: '' };
    var p = records[slug];
    if (!p || !p.src || (usage !== 'card' && usage !== 'profile')) return initialsTile(a, usage);
    var img = document.createElement('img');
    img.alt = usage === 'profile' ? p.alt : '';
    img.width = 480; img.height = 576; img.decoding = 'async';
    if (usage === 'card') img.loading = 'lazy';
    img.addEventListener('error', function () { img.replaceWith(initialsTile(a, usage)); }, { once: true });
    img.src = p.src;
    return img;
  }
  window.MOH_PORTRAITS = { records: records, image: image };
})();
