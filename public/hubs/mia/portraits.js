/*
 * Michigan Athlete Report · real archival and contemporary athlete portraits.
 * All 24 reference images come from Wikimedia Commons, with source and license
 * linked on each athlete's profile. Portraits are cropped for the card frames.
 * Maintain the initial tile as a network/error fallback, never a fake likeness.
 * Per-athlete photo overrides can still be supplied in athletes.js.
 */
(function () {
  'use strict';
  var list = window.MI_ATHLETES || [], records = {};
  // [exact Commons file name, author/collection, license (when verified)]
  var FILES = {
    "joe-louis": ["Joe Louis cph.3b09981.jpg", "Library of Congress", "Public domain"],
    "claressa-shields": ["Claressa Shields enters.jpg", "Harvey Krausz", "CC BY 2.0"],
    "thomas-hearns": ["Tommy Hearns ca. Dec. 1981, Detroit Michigan USA.jpg", "Carptrash", ""],
    "serena-williams": ["Serena Williams Doha 2013 (cropped).jpg", "Vinod Divakaran / Doha Stadium Plus Qatar", "CC BY 2.0"],
    "magic-johnson": ["Magic Johnson 2014 (cropped).jpg", "Neon Tommy", "CC BY-SA 2.0"],
    "draymond-green": ["Draymond Green 2016.jpg", "Fernando Frazão / Agência Brasil", "CC BY 2.0"],
    "chris-webber": ["Chris Webber NBA Asia Challenge 2010.jpg", "inboundpass", "CC BY 2.0"],
    "george-gervin": ["George Gervin ABA.jpeg", "Kevin Fitzgerald", "Public domain"],
    "mateen-cleaves": ["Mateen Cleaves (100071202) (cropped).jpg", "Jeramey Jannene", "CC BY 2.0"],
    "jim-abbott": ["Jim Abbott Cannons.jpg", "John Traub / Albuquerque Isotopes Baseball Club", "CC BY-SA 3.0"],
    "derek-jeter": ["Derek Jeter 2007 by Keith Allison.jpg", "Keith Allison", ""],
    "willie-horton": ["Willie Horton 1975.jpg", "Detroit Tigers", "Public domain"],
    "kirk-gibson": ["Kirk Gibson by Gage Skidmore.jpg", "Gage Skidmore", "CC BY-SA 3.0"],
    "jerome-bettis": ["Jerome Bettis 2016.jpg", "Veronica Davison / USDA", "CC BY-SA 2.0"],
    "hayes-jones": ["Hayes Jones 1963.jpg", "Publicity photograph", "Public domain"],
    "eddie-tolan": ["Eddie Tolan 1932.jpg", "Keystone-France", ""],
    "sheila-young": ["Sheila Young 1975.jpg", "Hans Peters / Anefo / Dutch National Archives", "CC0"],
    "jordyn-wieber": ["Jordyn Wieber Detroit.jpg", "Dave Hogg", "CC BY 2.0"],
    "davis-and-white": ["Meryl Davis and Charlie White - World Champions 2013 (retouched).jpg", "Ludwig Welnicki; retouched by MagentaGreen", "CC BY-SA 3.0"],
    "allison-schmitt": ["Allison Schmitt (USA) 2016.jpg", "Fernando Frazão / Agência Brasil", "CC BY 2.0"],
    "mike-modano": ["Modano stars 2007 (467934429) (cropped).jpg", "Paul Hoch", "CC BY 2.0"],
    "dylan-larkin": ["Dylan Larkin 20180125 212425.jpg", "SecretName101", "CC BY 4.0"],
    "brad-keselowski": ["Brad Keselowski Driver Introductions Las Vegas Fall 2026.jpg", "TaurusEmerald", ""],
    "the-sheik": ["The Sheik 1973.jpg", "Wikimedia Commons", ""]
  };
  var COLORS = { Boxing: '#8c2b22', Basketball: '#b4561c', Baseball: '#1f4e7a', Football: '#3d5a2a', Hockey: '#2b5f73', Tennis: '#6a7d1f' };
  function commonsPhoto(a) {
    var data = FILES[a.slug];
    if (!data) return null;
    var file = data[0].replace(/ /g, '_');
    return {
      src: 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(file) + '?width=640',
      alt: 'Photograph of ' + a.name,
      caption: 'Photo: ' + data[1] + (data[2] ? ' · ' + data[2] : '') + ' · Display cropped',
      credit: 'Original, attribution and license',
      url: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(file)
    };
  }
  list.forEach(function (a) {
    var p = (a.photo && a.photo.src) ? a.photo : (commonsPhoto(a) || {});
    records[a.slug] = {
      src: p.src || '', caption: p.caption || '', credit: p.credit || '',
      url: p.url || '', alt: p.alt || a.name, label: ''
    };
  });
  function initials(name) {
    return String(name).replace(/\(.*?\)/g, '').split(/\s+and\s+/i).map(function (part) {
      var w = part.trim().split(/\s+/).filter(Boolean);
      return (w[0] || '').charAt(0) + (w.length > 1 ? w[w.length - 1].charAt(0) : '');
    }).join(' · ').toUpperCase();
  }
  function tile(a, usage) {
    var fallback = document.createElement('div');
    fallback.className = 'mia-tile mia-tile-' + (usage || 'card');
    fallback.style.setProperty('--tile', COLORS[a.sport] || '#203a5c');
    if (usage === 'profile') {
      fallback.setAttribute('role', 'img');
      fallback.setAttribute('aria-label', a.name + ', ' + a.sport);
    } else fallback.setAttribute('aria-hidden', 'true');
    var b = document.createElement('b'); b.textContent = initials(a.name);
    fallback.appendChild(b);
    if (usage !== 'thumb') {
      var s = document.createElement('span'); s.textContent = a.sport;
      fallback.appendChild(s);
    }
    return fallback;
  }
  function image(slug, usage) {
    var a = list.find(function (x) { return x.slug === slug; }) || { name: slug, sport: '' };
    var p = records[slug] || {};
    if (!p.src) return tile(a, usage);
    var img = document.createElement('img');
    img.className = 'mia-photo mia-photo-' + (usage || 'card');
    img.setAttribute('data-athlete', slug);
    img.src = p.src;
    // The athlete's name is printed on each gallery card; avoid a second
    // redundant screen-reader announcement. Profiles need descriptive alt.
    img.alt = usage === 'profile' ? p.alt : '';
    img.width = 300; img.height = 360; img.decoding = 'async';
    if (usage !== 'profile') img.loading = 'lazy';
    img.addEventListener('error', function () {
      if (img.parentNode) img.parentNode.replaceChild(tile(a, usage), img);
    }, { once: true });
    return img;
  }
  window.MOH_PORTRAITS = { records: records, image: image };
})();
