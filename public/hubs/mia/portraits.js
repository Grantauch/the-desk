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
    ],
    'allison-schmitt': [
      "Allison Schmitt at a Pool Safely water-safety event in Chicago in 2017.",
      "PoolSafely / U.S. Consumer Product Safety Commission · Cropped",
      "https://commons.wikimedia.org/wiki/File:Olympian_Allison_Schmitt_takes_the_Pool_Safely_Pledge_%2834690230622%29.jpg",
      "CC BY 2.0",
      "https://creativecommons.org/licenses/by/2.0/"
    ],
    'brad-keselowski': [
      "Brad Keselowski waves at driver introductions at Las Vegas Motor Speedway in 2026.",
      "TaurusEmerald · Cropped",
      "https://commons.wikimedia.org/wiki/File:Brad_Keselowski_Driver_Introductions_Las_Vegas_Fall_2026.jpg",
      "CC BY-SA 4.0",
      "https://creativecommons.org/licenses/by-sa/4.0/"
    ],
    'chris-webber': [
      "Chris Webber on the court at the 2010 NBA Asia Challenge in the Philippines.",
      "inboundpass · Cropped",
      "https://commons.wikimedia.org/wiki/File:Chris_Webber_NBA_Asia_Challenge_2010.jpg",
      "CC BY 2.0",
      "https://creativecommons.org/licenses/by/2.0/"
    ],
    'claressa-shields': [
      "Claressa Shields, wearing red boxing gear, enters the arena at the 2015 Pan American Games.",
      "theharv58 · Cropped",
      "https://commons.wikimedia.org/wiki/File:Claressa_Shields_enters.jpg",
      "CC BY 2.0",
      "https://creativecommons.org/licenses/by/2.0/"
    ],
    'davis-and-white': [
      "Meryl Davis and Charlie White during the 2013 World Figure Skating Championships medal ceremony.",
      "Ludwig Welnicki; retouched by MagentaGreen · Cropped",
      "https://commons.wikimedia.org/wiki/File:Meryl_Davis_and_Charlie_White_-_World_Champions_2013_%28retouched%29.jpg",
      "CC BY-SA 3.0",
      "https://creativecommons.org/licenses/by-sa/3.0/"
    ],
    'derek-jeter': [
      "Derek Jeter batting for the New York Yankees in Baltimore in 2007.",
      "Keith Allison · Cropped",
      "https://commons.wikimedia.org/wiki/File:Derek_Jeter_2007_by_Keith_Allison.jpg",
      "CC BY-SA 2.0",
      "https://creativecommons.org/licenses/by-sa/2.0/"
    ],
    'draymond-green': [
      "Draymond Green at a U.S. basketball practice in Rio de Janeiro in 2016.",
      "Fernando Frazão/Agência Brasil · Cropped",
      "https://commons.wikimedia.org/wiki/File:Draymond_Green_2016.jpg",
      "CC BY 2.0",
      "https://creativecommons.org/licenses/by/2.0/"
    ],
    'dylan-larkin': [
      "Dylan Larkin skating for the Detroit Red Wings during a 2015 preseason game.",
      "Ken Lund · Cropped",
      "https://commons.wikimedia.org/wiki/File:Dylan_Larkin_%2821515345120%29.jpg",
      "CC BY-SA 2.0",
      "https://creativecommons.org/licenses/by-sa/2.0/"
    ],
    'george-gervin': [
      "George Gervin at NBA All-Star Center Court in 2016.",
      "lam_chihang · Cropped",
      "https://commons.wikimedia.org/wiki/File:All-Star_Game_Weekend_George_%22The_Iceman%22_Gervin_at_NBA_All-Star_Center_Court_2016_%2825038053785%29.jpg",
      "CC BY 2.0",
      "https://creativecommons.org/licenses/by/2.0/"
    ],
    'jerome-bettis': [
      "Jerome Bettis at a Super Bowl welcome reception in Santa Clara in 2016.",
      "Veronica Davison / USDA · Cropped",
      "https://commons.wikimedia.org/wiki/File:Jerome_Bettis_2016.jpg",
      "CC BY-SA 2.0",
      "https://creativecommons.org/licenses/by-sa/2.0/"
    ],
    'jim-abbott': [
      "Jim Abbott pitching for the Calgary Cannons in 1998.",
      "John Traub / Albuquerque Isotopes Baseball Club · Cropped",
      "https://commons.wikimedia.org/wiki/File:Jim_Abbott_Cannons.jpg",
      "CC BY-SA 3.0",
      "https://creativecommons.org/licenses/by-sa/3.0/"
    ],
    'jordyn-wieber': [
      "Jordyn Wieber preparing to throw the first pitch at Comerica Park in 2012.",
      "Dave Hogg · Cropped",
      "https://commons.wikimedia.org/wiki/File:Jordyn_Wieber_Detroit.jpg",
      "CC BY 2.0",
      "https://creativecommons.org/licenses/by/2.0/"
    ],
    'magic-johnson': [
      "Magic Johnson at the 2014 Carousel of Hope Gala.",
      "Ashley Velez / Neon Tommy · Cropped",
      "https://commons.wikimedia.org/wiki/File:Magic_Johnson_2014_%28cropped%29.jpg",
      "CC BY-SA 2.0",
      "https://creativecommons.org/licenses/by-sa/2.0/"
    ],
    'mateen-cleaves': [
      "Mateen Cleaves wearing his Seattle SuperSonics number 24 jersey in 2006.",
      "Jeramey Jannene · Cropped",
      "https://commons.wikimedia.org/wiki/File:Mateen_Cleaves_%28100071202%29_%28cropped%29.jpg",
      "CC BY 2.0",
      "https://creativecommons.org/licenses/by/2.0/"
    ],
    'mike-modano': [
      "Mike Modano in a Dallas Stars jersey in 2007.",
      "Paul Hoch · Cropped",
      "https://commons.wikimedia.org/wiki/File:Modano_stars_2007_%28467934429%29_%28cropped%29.jpg",
      "CC BY 2.0",
      "https://creativecommons.org/licenses/by/2.0/"
    ],
    'serena-williams': [
      "Serena Williams at a press conference in Doha in 2013.",
      "Vinod Divakaran / Doha Stadium Plus Qatar · Cropped",
      "https://commons.wikimedia.org/wiki/File:Serena_Williams_Doha_2013_%28cropped%29.jpg",
      "CC BY 2.0",
      "https://creativecommons.org/licenses/by/2.0/"
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
