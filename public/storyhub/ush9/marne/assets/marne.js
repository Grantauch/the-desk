/* Thirty Miles From Paris: the Marne sand table, the taxi, the prediction and the evidence cards. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var IMG = '/storyhub/ush9/marne/assets/';

  /* ---------- theme ---------- */
  var themeBtn = $('theme');
  var isDark = function () { return getComputedStyle(document.documentElement).colorScheme === 'dark'; };
  var syncTheme = function () { var d = isDark(); themeBtn.textContent = d ? 'Headlights on' : 'Headlights off'; themeBtn.setAttribute('aria-pressed', String(d)); };
  if (themeBtn) {
    syncTheme();
    themeBtn.addEventListener('click', function () { document.documentElement.dataset.theme = isDark() ? 'light' : 'dark'; syncTheme(); });
  }

  /* ---------- images that fail to load disappear quietly ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('main img'), function (img) {
    img.addEventListener('error', function () { var pt = img.closest('.portrait'); if (pt) { pt.classList.add('noimg'); img.remove(); return; } var f = img.closest('figure'); (f || img).style.display = 'none'; });
  });

  /* ---------- video: load only on request ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-yt]'), function (el) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'play';
    b.textContent = '▶ Play: ' + el.dataset.title;
    b.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.title = el.dataset.title;
      f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(el.dataset.yt) + '?autoplay=1&rel=0';
      f.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
      f.allowFullscreen = true;
      el.replaceChildren(f);
    });
    el.append(b);
  });

  /* ---------- geography ---------- */
  var LON0 = 2.0, LON1 = 4.7, LAT0 = 48.45, LAT1 = 49.65;
  var KX = 7.3, KZ = 11.1, CLON = 3.35, CLAT = 49.05; // 1 unit = 10 km
  var W = (LON1 - LON0) * KX, H = (LAT1 - LAT0) * KZ;
  var X = function (lon) { return (lon - CLON) * KX; };
  var Z = function (lat) { return -(lat - CLAT) * KZ; };

  var RIVERS = [
    { name: 'Marne', w: 9, pts: [[4.7, 48.7], [4.58, 48.72], [4.36, 48.96], [4.15, 49.03], [3.95, 49.04], [3.64, 49.07], [3.40, 49.05], [3.24, 48.98], [3.13, 48.95], [3.0, 48.97], [2.88, 48.96], [2.71, 48.87], [2.55, 48.85], [2.41, 48.82]], label: [3.62, 49.09] },
    { name: 'Seine', w: 10, pts: [[3.55, 48.45], [3.30, 48.42], [2.95, 48.40], [2.66, 48.54], [2.48, 48.61], [2.41, 48.82], [2.35, 48.86], [2.25, 48.88], [2.20, 48.93], [2.07, 49.0], [2.0, 49.02]], label: [2.82, 48.44] },
    { name: 'Ourcq', w: 6, pts: [[3.62, 49.2], [3.35, 49.21], [3.13, 49.18], [3.06, 49.08], [3.02, 49.0], [3.03, 48.97]], label: [3.22, 49.235] },
    { name: 'Aisne', w: 8, pts: [[4.7, 49.42], [4.40, 49.45], [4.10, 49.43], [3.90, 49.40], [3.62, 49.38], [3.32, 49.38], [3.05, 49.42], [2.83, 49.42]], label: [3.55, 49.42] },
    { name: 'Oise', w: 7, pts: [[2.83, 49.42], [2.62, 49.33], [2.47, 49.26], [2.3, 49.15], [2.10, 49.05], [2.07, 49.0]], label: [2.4, 49.26] },
    { name: 'Grand Morin', w: 5, pts: [[3.75, 48.75], [3.40, 48.78], [3.08, 48.81], [2.95, 48.86], [2.86, 48.9]], label: [3.4, 48.765] },
    { name: 'Petit Morin', w: 4, pts: [[3.88, 48.84], [3.70, 48.86], [3.54, 48.87], [3.30, 48.93], [3.13, 48.95]], label: [3.48, 48.895] }
  ];
  var TOWNS = [
    ['Meaux', 2.88, 48.96], ['Nanteuil le Haudouin', 2.81, 49.14], ['Senlis', 2.58, 49.21], ['Compiègne', 2.83, 49.42],
    ['Soissons', 3.32, 49.38], ['Château Thierry', 3.40, 49.05], ['Épernay', 3.95, 49.04], ['Reims', 4.03, 49.26],
    ['Coulommiers', 3.08, 48.81], ['Montmirail', 3.54, 48.87], ['Sézanne', 3.72, 48.72], ['Provins', 3.30, 48.56],
    ['Melun', 2.66, 48.54], ['Montmort', 3.82, 48.92], ['La Ferté sous Jouarre', 3.13, 48.95], ['Châlons', 4.36, 48.96]
  ];

  /* ---------- the story by date ---------- */
  var ARMIES = {
    g1: { side: 'de', short: '1st Army · Kluck', title: 'German 1st Army', name: 'General Alexander von Kluck', img: 'kluck.webp', text: 'The army on the far right of the German sweep, closest to Paris. Some of his men had marched more than 300 miles since mid August. His choice to turn southeast, and then to rush north to the Ourcq, opened the gap.' },
    g4: { side: 'de', short: 'IV Reserve · Gronau', title: 'German IV Reserve Corps', name: 'General Hans von Gronau', img: null, text: 'Left behind to guard Kluck’s right side. About 24,000 men. On September 5 it ran into the French 6th Army near the Ourcq and held for a full day, which warned Kluck in time.' },
    g2: { side: 'de', short: '2nd Army · Bülow', title: 'German 2nd Army', name: 'General Karl von Bülow', img: 'bulow.webp', text: 'Kluck’s neighbor to the east. On the evening of September 8 he told Hentsch his army was worn down to cinders, and the next morning he ordered it back.' },
    g3: { side: 'de', short: '3rd Army · Hausen', title: 'German 3rd Army', name: 'General Max von Hausen', img: null, text: 'Attacked Foch’s army in the marshes of Saint Gond on September 8 and pushed it back about 8 miles, but could not break through.' },
    f6: { side: 'fr', short: '6th Army · Maunoury', title: 'French 6th Army', name: 'General Michel Maunoury', img: 'maunoury.webp', text: 'About 150,000 men, mostly reservists, gathered north of Paris. Most of them arrived by train. The taxis brought about 4,000 more.' },
    bef: { side: 'uk', short: 'BEF · French', title: 'British Expeditionary Force', name: 'Field Marshal Sir John French', img: 'john-french.webp', text: 'About 100,000 British soldiers. After two weeks of retreat they turned around and walked north into the gap on September 8 and 9.' },
    f5: { side: 'fr', short: '5th Army · Franchet d’Espèrey', title: 'French 5th Army', name: 'General Louis Franchet d’Espèrey', img: null, text: 'Took command on September 3, the day before the counterattack was ordered. British soldiers nicknamed him Desperate Frankie. His army drove Bülow’s right flank back across the Marne.' },
    f9: { side: 'fr', short: '9th Army · Foch', title: 'French 9th Army', name: 'General Ferdinand Foch', img: 'foch.webp', text: 'Held the center in the marshes of Saint Gond. Pushed back but never broken. Four years later he would command every Allied army on the Western Front.' }
  };
  var STEPS = [
    { date: 'Sept 1 to 2', title: 'The turn', text: 'Kluck’s 1st Army was supposed to swing west of Paris. His men were exhausted and the French 5th Army was retreating in front of him, so he turned southeast to chase it and stay close to Bülow’s 2nd Army. The turn sent him east of Paris instead of around it, with his right side passing the city.',
      pos: { g1: [3.02, 48.99, 135], g4: [2.78, 49.12, 225], g2: [3.62, 49.05, 180], g3: [4.12, 48.98, 180], f6: [2.45, 49.02, 60], bef: [2.78, 48.70, 20], f5: [3.35, 48.66, 0], f9: [3.85, 48.70, 0] } },
    { date: 'Sept 3', title: 'Seen from the air', text: 'French airman Louis Breguet flew over Kluck’s columns and saw them marching southeast. British pilots reported the same thing. In Paris, Gallieni read the reports and saw the opening: the German flank was going past the city, close enough to hit.', plane: true,
      pos: { g1: [3.14, 48.87, 150], g4: [2.80, 49.08, 225], g2: [3.62, 48.98, 180], g3: [4.12, 48.93, 180], f6: [2.45, 49.02, 60], bef: [2.80, 48.66, 20], f5: [3.38, 48.62, 0], f9: [3.86, 48.66, 0] } },
    { date: 'Sept 5', title: 'Contact on the Ourcq', text: 'Joffre ordered the whole Allied line to turn and attack on September 6. A day early, Maunoury’s 6th Army marched east from Paris and ran into Gronau’s corps near the Ourcq River. Gronau had about 24,000 men against about 150,000, and he held them for a day. That warning let Kluck turn around.',
      pos: { g1: [3.16, 48.80, 170], g4: [2.88, 49.06, 260], g2: [3.62, 48.88, 190], g3: [4.12, 48.86, 190], f6: [2.70, 49.06, 85], bef: [2.85, 48.66, 20], f5: [3.40, 48.62, 0], f9: [3.86, 48.68, 0] } },
    { date: 'Sept 6 to 7', title: 'The gap opens', text: 'Kluck rushed his corps north to fight the 6th Army. Every corps he moved widened the space between his army and Bülow’s. By September 7 the gap was about 30 miles wide, guarded only by cavalry. That night about 600 Paris taxis carried reinforcements to the 6th Army.', gap: true, taxis: true,
      pos: { g1: [3.00, 49.10, 265], g4: [2.95, 49.19, 260], g2: [3.62, 48.84, 215], g3: [4.10, 48.82, 200], f6: [2.80, 49.10, 85], bef: [2.98, 48.76, 10], f5: [3.42, 48.72, 10], f9: [3.86, 48.74, 10] } },
    { date: 'Sept 8', title: 'Into the gap', text: 'The British and Franchet d’Espèrey’s 5th Army pushed north into the gap and crossed the Petit Morin River. To the east, Hausen hit Foch in the marshes of Saint Gond and drove him back about 8 miles, but Foch’s line held. From Luxembourg, Moltke sent Lieutenant Colonel Richard Hentsch by car to find out what was going on.', gap: true, hentsch: 1,
      pos: { g1: [3.02, 49.12, 265], g4: [2.96, 49.21, 260], g2: [3.74, 48.90, 220], g3: [4.02, 48.78, 215], f6: [2.82, 49.11, 85], bef: [3.16, 48.92, 15], f5: [3.56, 48.84, 20], f9: [3.88, 48.70, 15] } },
    { date: 'Sept 9', title: 'The order to retreat', text: 'Bülow told Hentsch his army was cinders and ordered it back. At 11:30 that morning Hentsch reached Kluck’s headquarters and told the chief of staff that the 1st Army had to retreat too. With the British and French already inside the gap, two German armies started north.', gap: true, hentsch: 2,
      pos: { g1: [3.10, 49.22, 200], g4: [3.02, 49.29, 200], g2: [3.86, 49.06, 200], g3: [4.12, 48.92, 200], f6: [2.88, 49.14, 70], bef: [3.28, 49.02, 10], f5: [3.66, 48.96, 15], f9: [3.92, 48.80, 15] } },
    { date: 'Sept 13', title: 'Dig in', text: 'The Germans fell back about 40 miles to the high ground north of the Aisne River and started digging. When the Allies attacked up the slopes, machine guns in the new trenches stopped them. By November the trenches ran about 440 miles, from Switzerland to the North Sea.', trench: true,
      pos: { g1: [3.22, 49.47, 180], g4: [2.98, 49.47, 180], g2: [3.82, 49.46, 180], g3: [4.25, 49.33, 180], f6: [3.00, 49.37, 0], bef: [3.48, 49.38, 0], f5: [3.92, 49.33, 0], f9: [4.18, 49.12, 0] } }
  ];
  var TAXI_ROUTE = [[2.32, 48.856], [2.45, 48.92], [2.6, 49.0], [2.72, 49.08], [2.81, 49.14]];
  var HENTSCH_1 = [[4.7, 49.5], [4.3, 49.2], [4.0, 49.0], [3.82, 48.92]];
  var HENTSCH_2 = [[3.82, 48.92], [3.5, 49.02], [3.25, 49.1], [3.08, 49.14]];
  var TRENCH = [[2.85, 49.46], [3.1, 49.45], [3.35, 49.43], [3.6, 49.45], [3.85, 49.44], [4.05, 49.4], [4.3, 49.32], [4.6, 49.28]];

  /* step buttons, text list, commander card */
  var stepsEl = $('steps'), nowEl = $('stepNow'), listEl = $('stepList'), whoEl = $('who');
  var current = 0;
  STEPS.forEach(function (s, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = '<span></span>';
    b.firstChild.textContent = s.date;
    b.append(document.createTextNode(s.title));
    b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    b.addEventListener('click', function () { goStep(i); });
    stepsEl.append(b);
    var li = document.createElement('li');
    var strong = document.createElement('b');
    strong.textContent = s.date + ', ' + s.title + '. ';
    li.append(strong, document.createTextNode(s.text));
    listEl.append(li);
  });
  var showStepText = function (i) {
    var s = STEPS[i];
    nowEl.innerHTML = '<p class="kicker" style="margin:0 0 6px"></p><h3></h3><p></p>';
    nowEl.children[0].textContent = s.date + ', 1914 · step ' + (i + 1) + ' of ' + STEPS.length;
    nowEl.children[1].textContent = s.title;
    nowEl.children[2].textContent = s.text;
    Array.prototype.forEach.call(stepsEl.children, function (b, j) { b.setAttribute('aria-pressed', String(j === i)); });
  };
  var showWho = function (id) {
    var a = ARMIES[id];
    whoEl.innerHTML = '<h4></h4><img alt="" hidden><p class="name"></p><p></p>';
    whoEl.children[0].textContent = a.title;
    var img = whoEl.children[1];
    if (a.img) {
      img.alt = a.name;
      img.onload = function () { img.hidden = false; };
      img.onerror = function () { img.remove(); };
      img.src = IMG + a.img;
    } else img.remove();
    whoEl.children[2].textContent = a.name;
    whoEl.children[3].textContent = a.text;
  };
  var goStep = function () {};
  showStepText(0);

  /* ---------- 2D paper map (the table's surface, and the fallback) ---------- */
  var TW = 2048, TH = Math.round(2048 * H / W);
  var px = function (lon) { return (lon - LON0) / (LON1 - LON0) * TW; };
  var py = function (lat) { return (LAT1 - lat) / (LAT1 - LAT0) * TH; };
  var drawPaperMap = function () {
    var c = document.createElement('canvas'); c.width = TW; c.height = TH;
    var g = c.getContext('2d');
    g.fillStyle = '#E2D5B3'; g.fillRect(0, 0, TW, TH);
    var seed = 7; var rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    g.fillStyle = 'rgba(120, 95, 50, 0.08)';
    for (var i = 0; i < 9000; i++) g.fillRect(rnd() * TW, rnd() * TH, 2, 2);
    g.strokeStyle = 'rgba(110, 90, 50, 0.18)'; g.lineWidth = 1.5;
    for (var lo = 2.0; lo <= 4.7001; lo += 0.25) { g.beginPath(); g.moveTo(px(lo), 0); g.lineTo(px(lo), TH); g.stroke(); }
    for (var la = 48.5; la <= 49.65; la += 0.25) { g.beginPath(); g.moveTo(0, py(la)); g.lineTo(TW, py(la)); g.stroke(); }
    // Saint Gond marshes
    g.save(); g.translate(px(3.85), py(48.81)); g.fillStyle = 'rgba(80, 110, 90, 0.22)';
    g.beginPath(); g.ellipse(0, 0, 70, 26, -0.15, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(60, 90, 70, 0.6)'; g.lineWidth = 2;
    for (var m = -50; m <= 50; m += 14) { g.beginPath(); g.moveTo(m - 6, 4); g.lineTo(m + 6, 4); g.moveTo(m - 2, -6); g.lineTo(m + 9, -6); g.stroke(); }
    g.restore();
    g.font = 'italic 34px Georgia, serif'; g.fillStyle = 'rgba(50, 80, 60, 0.95)'; g.textAlign = 'center';
    g.fillText('Marshes of Saint Gond', px(3.85), py(48.81) + 60);
    // rivers
    RIVERS.forEach(function (r) {
      g.strokeStyle = '#4C6F93'; g.lineWidth = r.w; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); r.pts.forEach(function (p, k) { (k ? g.lineTo : g.moveTo).call(g, px(p[0]), py(p[1])); }); g.stroke();
      g.font = 'italic 44px Georgia, serif'; g.fillStyle = '#2F5276'; g.textAlign = 'center';
      g.fillText(r.name, px(r.label[0]), py(r.label[1]) - 8);
    });
    // Paris and its ring of forts
    g.setLineDash([10, 9]); g.strokeStyle = 'rgba(60, 40, 30, 0.6)'; g.lineWidth = 3;
    g.beginPath(); g.arc(px(2.36), py(48.86), 118, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(70, 50, 35, 0.35)'; g.beginPath(); g.arc(px(2.35), py(48.86), 40, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2A1F17'; g.font = '700 64px Georgia, serif'; g.textAlign = 'center'; g.fillText('PARIS', px(2.35), py(48.86) + 100);
    g.font = 'italic 30px Georgia, serif'; g.fillText('ring of forts', px(2.36), py(48.86) - 128);
    // towns
    g.textAlign = 'left';
    TOWNS.forEach(function (t) {
      g.fillStyle = '#2A1F17'; g.fillRect(px(t[1]) - 8, py(t[2]) - 8, 16, 16);
      g.font = '36px Georgia, serif'; g.fillText(t[0], px(t[1]) + 14, py(t[2]) + 12);
    });
    // cartouche, scale and north
    g.strokeStyle = '#2A1F17'; g.lineWidth = 3; g.strokeRect(TW - 520, TH - 150, 490, 120);
    g.font = '700 34px Georgia, serif'; g.textAlign = 'center'; g.fillStyle = '#2A1F17';
    g.fillText('THE MARNE · SEPTEMBER 1914', TW - 275, TH - 98);
    var km20 = 20 / ((LON1 - LON0) * 73) * TW;
    g.fillRect(TW - 430, TH - 72, km20, 8); g.font = '22px Georgia, serif';
    g.fillText('20 km · about 12 miles', TW - 430 + km20 / 2 + 110, TH - 62);
    g.beginPath(); g.moveTo(70, 120); g.lineTo(54, 170); g.lineTo(70, 158); g.lineTo(86, 170); g.closePath(); g.fill();
    g.font = '700 30px Georgia, serif'; g.fillText('N', 70, 110);
    g.strokeStyle = '#4A3A26'; g.lineWidth = 14; g.strokeRect(7, 7, TW - 14, TH - 14);
    return c;
  };
  var paper = drawPaperMap();

  var COLORS = { de: '#5D6157', fr: '#5577B8', uk: '#A88B52' };
  var drawFallback = function (i) {
    var host = $('fallbackMap');
    if (!host) return;
    var c = host.querySelector('canvas');
    if (!c) { c = document.createElement('canvas'); c.width = TW; c.height = TH; c.style.width = '100%'; c.style.height = 'auto'; c.setAttribute('role', 'img'); host.append(c); }
    var g = c.getContext('2d');
    g.drawImage(paper, 0, 0);
    var s = STEPS[i];
    if (s.gap) { g.strokeStyle = '#A3241F'; g.lineWidth = 10; g.setLineDash([24, 16]); g.beginPath(); g.moveTo(px(s.pos.g1[0]), py(s.pos.g1[1])); g.lineTo(px(s.pos.g2[0]), py(s.pos.g2[1])); g.stroke(); g.setLineDash([]); }
    if (s.trench) { g.strokeStyle = '#3B2A1A'; g.lineWidth = 12; g.beginPath(); TRENCH.forEach(function (p, k) { (k ? g.lineTo : g.moveTo).call(g, px(p[0]), py(p[1])); }); g.stroke(); }
    Object.keys(s.pos).forEach(function (id) {
      var p = s.pos[id], a = ARMIES[id];
      g.fillStyle = COLORS[a.side]; g.fillRect(px(p[0]) - 60, py(p[1]) - 20, 120, 40);
      g.fillStyle = '#111'; g.font = '600 26px Georgia, serif'; g.textAlign = 'center';
      g.fillText(a.short, px(p[0]), py(p[1]) - 30);
    });
    c.setAttribute('aria-label', 'Flat map of the Marne battlefield, ' + s.date + ': ' + s.title);
  };

  /* ---------- 3D sand table ---------- */
  var startTable = function () {
    var canvas = $('tableCanvas'), stage = $('tableStage'), labelBox = $('tableLabels');
    var T = window.THREE;
    var renderer;
    try {
      if (!T) throw new Error('no three');
      renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true });
    } catch (e) {
      stage.classList.add('no-3d');
      goStep = function (i) { current = i; showStepText(i); drawFallback(i); };
      drawFallback(0);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    var scene = new T.Scene();
    scene.background = new T.Color('#1A140E');
    var camera = new T.PerspectiveCamera(42, 1, 0.1, 200);
    scene.add(new T.HemisphereLight(0xfff4dd, 0x3a2c1c, 0.85));
    var sun = new T.DirectionalLight(0xffffff, 0.55); sun.position.set(-6, 14, 8); scene.add(sun);

    var tex = new T.CanvasTexture(paper);
    if (renderer.capabilities.getMaxAnisotropy) tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    var map = new T.Mesh(new T.PlaneGeometry(W, H), new T.MeshBasicMaterial({ map: tex }));
    map.rotation.x = -Math.PI / 2; scene.add(map);
    var frame = new T.Mesh(new T.BoxGeometry(W + 1.2, 0.8, H + 1.2), new T.MeshLambertMaterial({ color: 0x4A3523 }));
    frame.position.y = -0.41; scene.add(frame);

    // Eiffel Tower, small, so Paris reads at a glance
    var iron = new T.MeshLambertMaterial({ color: 0x3A2E24 });
    var tower = new T.Mesh(new T.ConeGeometry(0.22, 1.1, 4), iron);
    tower.position.set(X(2.35), 0.55, Z(48.86)); scene.add(tower);

    // army blocks
    var blocks = {}, blockList = [];
    var wedgeGeo = new T.ConeGeometry(0.16, 0.34, 3);
    Object.keys(ARMIES).forEach(function (id) {
      var a = ARMIES[id];
      var grp = new T.Group();
      var mat = new T.MeshLambertMaterial({ color: COLORS[a.side] });
      var box = new T.Mesh(new T.BoxGeometry(id === 'g4' ? 0.9 : 1.5, 0.34, 0.52), mat);
      box.position.y = 0.17; box.userData.id = id; grp.add(box);
      var cap = new T.Mesh(new T.BoxGeometry(id === 'g4' ? 0.92 : 1.52, 0.04, 0.54), new T.MeshLambertMaterial({ color: a.side === 'de' ? 0x22241F : a.side === 'fr' ? 0x2D3E63 : 0x6A5530 }));
      cap.position.y = 0.36; grp.add(cap);
      var wedge = new T.Mesh(wedgeGeo, new T.MeshLambertMaterial({ color: 0xF2EBDA }));
      wedge.rotation.x = -Math.PI / 2; wedge.position.set(0, 0.4, -0.34); grp.add(wedge);
      scene.add(grp);
      blocks[id] = { grp: grp, box: box, from: null, to: null };
      blockList.push(box);
      var lbl = document.createElement('button');
      lbl.type = 'button'; lbl.className = 'lbl ' + a.side; lbl.textContent = a.short;
      lbl.addEventListener('click', function () { select(id); });
      labelBox.append(lbl);
      blocks[id].lbl = lbl;
    });
    var noteLabel = function (text, cls) { var d = document.createElement('div'); d.className = 'lbl ' + (cls || 'note'); d.textContent = text; d.hidden = true; labelBox.append(d); return d; };

    // gap band
    var gapMat = new T.MeshBasicMaterial({ color: 0xA3241F, transparent: true, opacity: 0.75 });
    var gapBar = new T.Mesh(new T.BoxGeometry(1, 0.05, 0.16), gapMat); gapBar.visible = false; scene.add(gapBar);
    var gapLbl = noteLabel('The gap · about 30 miles', 'gap');

    // routes drawn as flat ribbons
    var ribbon = function (pts, color, width) {
      var g = new T.Group();
      for (var k = 1; k < pts.length; k++) {
        var a = pts[k - 1], b = pts[k];
        var ax = X(a[0]), az = Z(a[1]), bx = X(b[0]), bz = Z(b[1]);
        var len = Math.hypot(bx - ax, bz - az);
        var seg = new T.Mesh(new T.BoxGeometry(len, 0.04, width), new T.MeshBasicMaterial({ color: color }));
        seg.position.set((ax + bx) / 2, 0.03, (az + bz) / 2);
        seg.rotation.y = -Math.atan2(bz - az, bx - ax);
        g.add(seg);
      }
      g.visible = false; scene.add(g); return g;
    };
    var taxiRoad = ribbon(TAXI_ROUTE, 0xE0B656, 0.08);
    var h1 = ribbon(HENTSCH_1, 0x22241F, 0.07), h2 = ribbon(HENTSCH_2, 0x22241F, 0.07);
    var trench = ribbon(TRENCH, 0x3B2A1A, 0.2);
    var taxiLbl = noteLabel('About 600 taxis, night of Sept 6 to 7');
    var hentschLbl = noteLabel('Hentsch’s car');
    var trenchLbl = noteLabel('The first trenches');
    var planeLbl = noteLabel('Breguet’s airplane');
    var hqLbl = noteLabel('Bülow’s HQ, Montmort');
    var parisLbl = noteLabel('Paris'); parisLbl.hidden = false;

    // moving bits: taxis, a car, an airplane
    var sampler = function (pts) {
      var segs = [], total = 0;
      for (var k = 1; k < pts.length; k++) { var l = Math.hypot(X(pts[k][0]) - X(pts[k - 1][0]), Z(pts[k][1]) - Z(pts[k - 1][1])); segs.push(l); total += l; }
      return function (t) {
        var d = t * total;
        for (var k = 0; k < segs.length; k++) {
          if (d <= segs[k] || k === segs.length - 1) { var f = Math.min(1, d / segs[k]); return [X(pts[k][0]) + (X(pts[k + 1][0]) - X(pts[k][0])) * f, Z(pts[k][1]) + (Z(pts[k + 1][1]) - Z(pts[k][1])) * f]; }
          d -= segs[k];
        }
      };
    };
    var taxiAt = sampler(TAXI_ROUTE);
    var cabGeo = new T.BoxGeometry(0.16, 0.1, 0.09), cabMat = new T.MeshLambertMaterial({ color: 0x9B2420 });
    var cabs = [];
    for (var c = 0; c < 14; c++) { var cab = new T.Mesh(cabGeo, cabMat); cab.visible = false; scene.add(cab); cabs.push(cab); }
    var car = new T.Mesh(new T.BoxGeometry(0.28, 0.14, 0.15), new T.MeshLambertMaterial({ color: 0x111111 })); car.visible = false; scene.add(car);
    var plane = new T.Group();
    var wingMat = new T.MeshLambertMaterial({ color: 0xD8CDB0 });
    var w1 = new T.Mesh(new T.BoxGeometry(0.16, 0.02, 1.0), wingMat); w1.position.y = 0.08; plane.add(w1);
    var w2 = new T.Mesh(new T.BoxGeometry(0.16, 0.02, 1.0), wingMat); w2.position.y = -0.06; plane.add(w2);
    var fus = new T.Mesh(new T.BoxGeometry(0.7, 0.07, 0.08), new T.MeshLambertMaterial({ color: 0x6B5A3A })); plane.add(fus);
    plane.visible = false; scene.add(plane);

    // camera control
    var view = { th: 0, ph: 0.9, r: 15.5, minR: 9 }, goal = null, narrow = false;
    var TX = X(3.2), TZ = 0.5, tgt = { fx: TX, fz: TZ, tx: TX, tz: TZ };
    var homeR = function () { return narrow ? 21 : 15.5; };
    var placeCamera = function () {
      camera.position.set(TX + Math.sin(view.ph) * Math.sin(view.th) * view.r, Math.cos(view.ph) * view.r, TZ + Math.sin(view.ph) * Math.cos(view.th) * view.r);
      camera.lookAt(TX, 0, TZ);
    };
    var resize = function () {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      var wasNarrow = narrow;
      narrow = w < 560;
      if (narrow !== wasNarrow) { view.r = homeR(); view.ph = narrow ? 0.62 : 0.9; Object.keys(blocks).forEach(function (id) { blocks[id].lbl.textContent = narrow ? ARMIES[id].name.split(' ').pop().replace('d’Espèrey', 'Franchet') : ARMIES[id].short; }); }
      camera.updateProjectionMatrix();
      dirty = true;
    };
    var dirty = true, visible = true, raf = 0;
    var pointers = new Map(), dragMoved = 0, pinch0 = 0;
    canvas.addEventListener('pointerdown', function (e) { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]); dragMoved = 0; goal = null; if (pointers.size === 2) { var p = Array.from(pointers.values()); pinch0 = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]); } });
    canvas.addEventListener('pointermove', function (e) {
      if (!pointers.has(e.pointerId)) return;
      var prev = pointers.get(e.pointerId); var dx = e.clientX - prev[0], dy = e.clientY - prev[1];
      pointers.set(e.pointerId, [e.clientX, e.clientY]);
      if (pointers.size === 2) { var p = Array.from(pointers.values()); var d = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]); if (pinch0) view.r = Math.max(9, Math.min(34, view.r * pinch0 / d)); pinch0 = d; }
      else { view.th -= dx * 0.006; view.ph = Math.max(0.06, Math.min(1.32, view.ph - dy * 0.005)); }
      dragMoved += Math.abs(dx) + Math.abs(dy); dirty = true; kick();
    });
    var endPtr = function (e) {
      if (pointers.size === 1 && dragMoved < 6) pick(e);
      pointers.delete(e.pointerId); pinch0 = 0;
    };
    canvas.addEventListener('pointerup', endPtr);
    canvas.addEventListener('pointercancel', function (e) { pointers.delete(e.pointerId); });
    canvas.addEventListener('wheel', function (e) { e.preventDefault(); view.r = Math.max(9, Math.min(34, view.r * (1 + e.deltaY * 0.001))); dirty = true; kick(); }, { passive: false });
    $('viewTop').addEventListener('click', function () { goal = { th: 0, ph: 0.06, r: homeR() + 2 }; kick(); });
    $('viewTable').addEventListener('click', function () { goal = { th: 0, ph: narrow ? 0.62 : 0.9, r: homeR() }; kick(); });

    var ray = new T.Raycaster(), ndc = new T.Vector2();
    var pick = function (e) {
      var r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      var hit = ray.intersectObjects(blockList)[0];
      if (hit) select(hit.object.userData.id);
    };
    var selected = null;
    var select = function (id) {
      selected = id; showWho(id);
      Object.keys(blocks).forEach(function (k) { blocks[k].box.material.emissive = new T.Color(k === id ? 0x553311 : 0x000000); });
      dirty = true; kick();
    };

    // stepping
    var anim = { t: 1 };
    var setFrom = function () { Object.keys(blocks).forEach(function (id) { var g = blocks[id].grp; blocks[id].from = [g.position.x, g.position.z, g.rotation.y]; }); };
    var applyStep = function (i, instant) {
      var s = STEPS[i];
      setFrom();
      Object.keys(blocks).forEach(function (id) {
        var p = s.pos[id];
        var target = -p[2] * Math.PI / 180;
        var from = blocks[id].from[2];
        while (target - from > Math.PI) target -= Math.PI * 2;
        while (target - from < -Math.PI) target += Math.PI * 2;
        blocks[id].to = [X(p[0]), Z(p[1]), target];
      });
      var ids = Object.keys(s.pos), cxs = 0, czs = 0;
      ids.forEach(function (id) { cxs += X(s.pos[id][0]); czs += Z(s.pos[id][1]); });
      tgt.fx = TX; tgt.fz = TZ; tgt.tx = cxs / ids.length; tgt.tz = czs / ids.length + 0.6;
      anim.t = instant || reduce ? 1 : 0;
      if (anim.t === 1) { TX = tgt.tx; TZ = tgt.tz; Object.keys(blocks).forEach(function (id) { var b = blocks[id]; b.grp.position.set(b.to[0], 0, b.to[1]); b.grp.rotation.y = b.to[2]; }); }
      gapBar.visible = !!s.gap; gapLbl.hidden = !s.gap;
      gapLbl.textContent = i >= 5 ? 'The gap · British and French inside it' : 'The gap · about 30 miles';
      taxiRoad.visible = !!s.taxis; taxiLbl.hidden = !s.taxis;
      cabs.forEach(function (cb) { cb.visible = !!s.taxis; });
      h1.visible = !!s.hentsch; h2.visible = s.hentsch === 2; car.visible = !!s.hentsch; hentschLbl.hidden = !s.hentsch; hqLbl.hidden = !s.hentsch;
      trench.visible = !!s.trench; trenchLbl.hidden = !s.trench;
      plane.visible = !!s.plane; planeLbl.hidden = !s.plane;
      dirty = true; kick();
    };
    goStep = function (i) { current = i; showStepText(i); applyStep(i, false); };

    var v3 = new T.Vector3();
    var queue = [];
    var placeLabel = function (el, x, y, z) {
      if (el.hidden) return;
      v3.set(x, y, z).project(camera);
      var off = v3.z > 1 || v3.x < -1.1 || v3.x > 1.1 || v3.y < -1.1 || v3.y > 1.1;
      el.style.visibility = off ? 'hidden' : 'visible';
      if (!off) queue.push({ el: el, x: (v3.x + 1) / 2 * canvas.clientWidth, y: (1 - v3.y) / 2 * canvas.clientHeight });
    };
    // labels that would overlap get pushed upward until they clear each other
    var layoutLabels = function () {
      var placed = [];
      queue.sort(function (a, b) { return b.y - a.y; });
      queue.forEach(function (q) {
        var w = q.el.offsetWidth || 90, h = (q.el.offsetHeight || 18) + 2;
        var y = q.y, tries = 0, hit = true;
        while (hit && tries < 12) {
          hit = false;
          for (var i = 0; i < placed.length; i++) {
            var p = placed[i];
            if (Math.abs(p.x - q.x) < (p.w + w) / 2 && y > p.y - p.h && y - h < p.y) { y = p.y - p.h; hit = true; }
          }
          tries++;
        }
        placed.push({ x: q.x, y: y, w: w, h: h });
        q.el.style.left = q.x + 'px';
        q.el.style.top = y + 'px';
      });
      queue = [];
    };
    var loops = function () { var s = STEPS[current]; return !!(s.taxis || s.plane || s.hentsch); };
    var last = 0;
    var tick = function (now) {
      raf = 0;
      var dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      var more = false;
      if (goal) {
        var k = reduce ? 1 : 1 - Math.pow(0.001, dt);
        view.th += (goal.th - view.th) * k; view.ph += (goal.ph - view.ph) * k; view.r += (goal.r - view.r) * k;
        if (Math.abs(goal.ph - view.ph) < 0.002 && Math.abs(goal.th - view.th) < 0.002 && Math.abs(goal.r - view.r) < 0.02) goal = null; else more = true;
        dirty = true;
      }
      if (anim.t < 1) {
        anim.t = Math.min(1, anim.t + dt / 1.1);
        var e = anim.t < 0.5 ? 2 * anim.t * anim.t : 1 - Math.pow(-2 * anim.t + 2, 2) / 2;
        Object.keys(blocks).forEach(function (id) { var b = blocks[id]; b.grp.position.set(b.from[0] + (b.to[0] - b.from[0]) * e, 0, b.from[1] + (b.to[1] - b.from[1]) * e); b.grp.rotation.y = b.from[2] + (b.to[2] - b.from[2]) * e; });
        TX = tgt.fx + (tgt.tx - tgt.fx) * e; TZ = tgt.fz + (tgt.tz - tgt.fz) * e;
        more = true; dirty = true;
      }
      var s = STEPS[current], tt = now / 1000;
      if (s.taxis) { cabs.forEach(function (cb, i) { var f = ((tt * 0.07) + i / cabs.length) % 1; var q = taxiAt(f); cb.position.set(q[0], 0.07, q[1]); }); dirty = true; }
      if (s.hentsch) {
        var route = s.hentsch === 2 ? sampler(HENTSCH_1.concat(HENTSCH_2.slice(1))) : sampler(HENTSCH_1);
        var q2 = route((tt * 0.09) % 1); car.position.set(q2[0], 0.09, q2[1]); dirty = true;
      }
      if (s.plane) { var g1 = blocks.g1.grp.position; plane.position.set(g1.x + Math.cos(tt * 0.8) * 1.6, 2.2, g1.z + Math.sin(tt * 0.8) * 1.6); plane.rotation.y = -tt * 0.8; dirty = true; }
      if (dirty) {
        // gap bar between Kluck and Bülow
        if (gapBar.visible) {
          var a = blocks.g1.grp.position, b = blocks.g2.grp.position;
          var len = Math.hypot(b.x - a.x, b.z - a.z) - 1.3;
          gapBar.scale.x = Math.max(0.1, len);
          gapBar.position.set((a.x + b.x) / 2, 0.06, (a.z + b.z) / 2);
          gapBar.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
          placeLabel(gapLbl, gapBar.position.x, 0.2, gapBar.position.z);
        }
        placeCamera();
        renderer.render(scene, camera);
        Object.keys(blocks).forEach(function (id) { var p = blocks[id].grp.position; placeLabel(blocks[id].lbl, p.x, 0.62, p.z); });
        placeLabel(parisLbl, X(2.35), 1.25, Z(48.86));
        placeLabel(taxiLbl, X(2.55), 0.2, Z(48.97));
        if (s.hentsch) placeLabel(hentschLbl, car.position.x, 0.4, car.position.z);
        placeLabel(hqLbl, X(3.82), 0.15, Z(48.92) + 0.4);
        placeLabel(trenchLbl, X(3.6), 0.3, Z(49.45));
        if (s.plane) placeLabel(planeLbl, plane.position.x, plane.position.y + 0.3, plane.position.z);
        layoutLabels();
        dirty = false;
      }
      if ((more || (loops() && !reduce)) && visible) kick();
      else if (loops() && reduce && !more) { /* hold still */ }
    };
    var kick = function () { if (!raf && visible) raf = requestAnimationFrame(tick); };
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) { dirty = true; kick(); } }, { rootMargin: '100px' }).observe(stage);
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);
    resize();
    applyStep(0, true);
    placeCamera();
    kick();
    window.__marneTable = { goStep: function (i) { goStep(i); }, renderer: renderer };
  };

  /* ---------- 3D taxi ---------- */
  var startTaxi = function () {
    var canvas = $('taxiCanvas'), stage = $('taxiStage');
    var T = window.THREE, renderer;
    try { if (!T) throw new Error('no three'); renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true }); }
    catch (e) { stage.style.display = 'none'; setupMeter(null); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    var scene = new T.Scene(); scene.background = new T.Color('#07090C');
    var camera = new T.PerspectiveCamera(36, 1, 0.1, 100);
    scene.add(new T.HemisphereLight(0xcfd8ff, 0x1a1410, 0.75));
    var key = new T.DirectionalLight(0xfff0d0, 0.9); key.position.set(4, 6, 5); scene.add(key);
    var rim = new T.DirectionalLight(0x8899ff, 0.35); rim.position.set(-5, 3, -4); scene.add(rim);

    var M = function (c) { return new T.MeshLambertMaterial({ color: c }); };
    var red = M(0x7E1F1C), black = M(0x141414), brass = new T.MeshPhongMaterial({ color: 0xB8902E, shininess: 60 }), leather = M(0x2A1A12), glass = new T.MeshPhongMaterial({ color: 0x223040, transparent: true, opacity: 0.55, shininess: 90 });
    var cab = new T.Group(); scene.add(cab);
    var add = function (geo, mat, x, y, z, parent) { var m = new T.Mesh(geo, mat); m.position.set(x, y, z); (parent || cab).add(m); return m; };
    // chassis and body
    add(new T.BoxGeometry(3.3, 0.12, 1.0), black, 0, 0.45, 0);
    add(new T.BoxGeometry(1.75, 0.55, 1.28), red, -0.75, 0.78, 0);
    add(new T.BoxGeometry(0.9, 0.62, 1.3), glass, -0.35, 1.36, 0);
    add(new T.BoxGeometry(0.06, 0.66, 1.3), red, 0.12, 1.36, 0);
    add(new T.BoxGeometry(0.98, 0.06, 1.34), black, -0.37, 1.7, 0);
    var hood = new T.Mesh(new T.CylinderGeometry(0.36, 0.36, 1.32, 14, 1, false, 0, Math.PI), black);
    hood.rotation.x = Math.PI / 2; hood.rotation.z = Math.PI / 2; hood.position.set(-1.27, 1.06, 0); cab.add(hood);
    // driver bay, seat, steering
    add(new T.BoxGeometry(0.7, 0.3, 1.2), leather, 0.45, 0.66, 0);
    add(new T.BoxGeometry(0.12, 0.5, 1.2), leather, 0.18, 0.95, 0);
    var col = add(new T.CylinderGeometry(0.025, 0.025, 0.7, 6), black, 0.78, 0.95, 0.3); col.rotation.z = 0.6;
    var sw = add(new T.TorusGeometry(0.15, 0.02, 6, 18), black, 0.62, 1.2, 0.3); sw.rotation.y = Math.PI / 2; sw.rotation.x = 0.5;
    // the Renault bonnet, sloping to the front, radiator behind it at the dash
    var shape = new T.Shape();
    shape.moveTo(0, 0); shape.lineTo(0.95, 0); shape.lineTo(0.95, 0.2); shape.quadraticCurveTo(0.7, 0.5, 0.15, 0.55); shape.lineTo(0, 0.55); shape.lineTo(0, 0);
    var bonnet = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: 0.82, bevelEnabled: false }), black);
    bonnet.position.set(0.85, 0.51, -0.41); cab.add(bonnet);
    for (var f = 0; f < 6; f++) add(new T.BoxGeometry(0.02, 0.5, 0.05), brass, 0.86, 0.78, -0.45 + f * 0.18);
    // lamps
    [-0.38, 0.38].forEach(function (z) { var l = add(new T.CylinderGeometry(0.09, 0.07, 0.16, 12), brass, 1.75, 0.92, z); l.rotation.z = Math.PI / 2; });
    // wheels with spokes
    var wheels = [];
    [[1.15, 0.7], [1.15, -0.7], [-1.15, 0.7], [-1.15, -0.7]].forEach(function (p) {
      var w = new T.Group(); w.position.set(p[0], 0.4, p[1]); cab.add(w);
      w.add(new T.Mesh(new T.TorusGeometry(0.36, 0.06, 8, 26), black));
      var hub = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.14, 10), brass); hub.rotation.x = Math.PI / 2; w.add(hub);
      for (var s = 0; s < 10; s++) { var sp = new T.Mesh(new T.BoxGeometry(0.03, 0.62, 0.03), red); sp.rotation.z = s * Math.PI / 10; w.add(sp); }
      wheels.push(w);
    });
    // fenders and running boards
    [[1.15, 0.7], [1.15, -0.7], [-1.15, 0.7], [-1.15, -0.7]].forEach(function (p) {
      var fe = new T.Mesh(new T.CylinderGeometry(0.47, 0.47, 0.22, 16, 1, true, -Math.PI / 2.3, Math.PI / 1.15), new T.MeshLambertMaterial({ color: 0x141414, side: T.DoubleSide }));
      fe.rotation.x = Math.PI / 2; fe.position.set(p[0], 0.4, p[1]); cab.add(fe);
    });
    [0.72, -0.72].forEach(function (z) { add(new T.BoxGeometry(1.4, 0.04, 0.22), black, 0, 0.47, z); });
    // the taximeter and its flag
    add(new T.BoxGeometry(0.16, 0.2, 0.14), brass, 0.7, 1.25, -0.55);
    var flagPivot = new T.Group(); flagPivot.position.set(0.7, 1.35, -0.55); cab.add(flagPivot);
    var flag = new T.Mesh(new T.BoxGeometry(0.02, 0.32, 0.18), M(0xA3241F)); flag.position.y = 0.16; flagPivot.add(flag);
    // the road
    var road = new T.Mesh(new T.PlaneGeometry(30, 3), M(0x1D1F22)); road.rotation.x = -Math.PI / 2; scene.add(road);
    var dashes = [];
    for (var d = 0; d < 12; d++) { var ds = new T.Mesh(new T.PlaneGeometry(0.9, 0.08), M(0x6A6450)); ds.rotation.x = -Math.PI / 2; ds.position.set(-13 + d * 2.4, 0.005, 1.2); scene.add(ds); dashes.push(ds); }
    // soldiers: blue coat, red trousers, red and blue kepi
    var soldiers = [];
    var coat = M(0x34467A), trouser = M(0xB0261F), skin = M(0xC9A07E), kepiTop = M(0xB0261F);
    var seats = [[-0.35, 0.3], [-0.35, -0.3], [-1.05, 0.3], [-1.05, -0.3], [0.45, -0.32]];
    var makeSoldier = function () {
      var g = new T.Group();
      var legs = new T.Mesh(new T.BoxGeometry(0.34, 0.16, 0.24), trouser); legs.position.set(0.12, 0.08, 0); g.add(legs);
      var body = new T.Mesh(new T.CylinderGeometry(0.13, 0.16, 0.48, 10), coat); body.position.y = 0.36; g.add(body);
      var head = new T.Mesh(new T.SphereGeometry(0.1, 12, 10), skin); head.position.y = 0.7; g.add(head);
      var kepi = new T.Mesh(new T.CylinderGeometry(0.085, 0.1, 0.12, 12), kepiTop); kepi.position.y = 0.8; kepi.rotation.z = 0.12; g.add(kepi);
      var band = new T.Mesh(new T.CylinderGeometry(0.102, 0.102, 0.04, 12), M(0x23305A)); band.position.y = 0.75; g.add(band);
      var rifle = new T.Mesh(new T.BoxGeometry(0.03, 0.75, 0.03), M(0x3B2A1A)); rifle.position.set(0.17, 0.5, 0.1); rifle.rotation.z = -0.15; g.add(rifle);
      return g;
    };
    var driver = makeSoldier(); driver.children.forEach(function (m) { if (m.material === coat || m.material === trouser || m.material === kepiTop) m.material = M(0x1E1E22); });
    driver.position.set(0.45, 0.8, 0.32); cab.add(driver);

    var view = { th: 0.85, ph: 1.15, r: 7.2 };
    var place = function () { camera.position.set(Math.sin(view.ph) * Math.sin(view.th) * view.r, Math.cos(view.ph) * view.r + 0.3, Math.sin(view.ph) * Math.cos(view.th) * view.r); camera.lookAt(0, 0.8, 0); };
    var dirty = true, raf = 0, visible = true, driving = false, last = 0, dropping = [];
    var resize = function () { var w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; view.r = w < 420 ? 8.6 : 7.2; camera.updateProjectionMatrix(); dirty = true; kick(); };
    var down = null;
    canvas.addEventListener('pointerdown', function (e) { canvas.setPointerCapture(e.pointerId); down = [e.clientX, e.clientY]; });
    canvas.addEventListener('pointermove', function (e) { if (!down) return; view.th -= (e.clientX - down[0]) * 0.008; view.ph = Math.max(0.35, Math.min(1.45, view.ph - (e.clientY - down[1]) * 0.005)); down = [e.clientX, e.clientY]; dirty = true; kick(); });
    canvas.addEventListener('pointerup', function () { down = null; });
    canvas.addEventListener('pointercancel', function () { down = null; });

    var tick = function (now) {
      raf = 0;
      var dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      var more = false;
      dropping = dropping.filter(function (s) { s.position.y = Math.max(s.userData.y, s.position.y - dt * 4); if (s.position.y > s.userData.y) { more = true; return true; } return false; });
      if (driving) {
        wheels.forEach(function (w) { w.rotation.z -= dt * 9; });
        dashes.forEach(function (ds) { ds.position.x += dt * 6; if (ds.position.x > 15) ds.position.x -= 28.8; });
        cab.position.y = Math.sin(now / 70) * 0.012;
        more = true;
      }
      if (more || dirty) { place(); renderer.render(scene, camera); dirty = false; }
      if (more && visible) kick();
    };
    var kick = function () { if (!raf && visible) raf = requestAnimationFrame(tick); };
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) { dirty = true; kick(); } }).observe(stage);
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);
    resize();
    setupMeter({
      load: function (n) { var s = makeSoldier(); var seat = seats[n]; s.userData.y = seat[0] > 0 ? 0.8 : 0.85; s.position.set(seat[0], reduce ? s.userData.y : 3, seat[1]); cab.add(s); soldiers.push(s); if (!reduce) dropping.push(s); dirty = true; kick(); },
      drive: function (on) { driving = on && !reduce; flagPivot.rotation.x = on ? Math.PI / 2 : 0; dirty = true; kick(); },
      reset: function () { soldiers.forEach(function (s) { cab.remove(s); }); soldiers = []; dropping = []; driving = false; flagPivot.rotation.x = 0; cab.position.y = 0; dirty = true; kick(); }
    });
  };

  /* ---------- meter (works with or without the 3D cab) ---------- */
  var setupMeter = function (scene3d) {
    var loadBtn = $('loadBtn'), driveBtn = $('driveBtn'), resetBtn = $('resetBtn');
    var flag = $('meterFlag'), mPass = $('mPass'), mKm = $('mKm'), mClock = $('mClock'), note = $('taxiNote');
    var loaded = 0, timer = 0, loadTimer = 0;
    var fresh = function () {
      loaded = 0; clearInterval(timer); clearInterval(loadTimer);
      mPass.textContent = '0 of 5'; mKm.textContent = '0 km'; mClock.textContent = '·';
      flag.textContent = 'LIBRE'; flag.classList.remove('down');
      loadBtn.disabled = false; driveBtn.disabled = true;
      note.textContent = 'Four soldiers rode in back and one sat beside the driver. Their rifles and packs came along.';
    };
    loadBtn.addEventListener('click', function () {
      loadBtn.disabled = true;
      var step = function () {
        if (scene3d) scene3d.load(loaded);
        loaded++; mPass.textContent = loaded + ' of 5';
        if (loaded >= 5) { clearInterval(loadTimer); driveBtn.disabled = false; note.textContent = 'Full. Six hundred cabs like this one, five men each, two trips for many of them.'; }
      };
      if (reduce) { while (loaded < 5) step(); } else { step(); loadTimer = setInterval(step, 380); }
    });
    driveBtn.addEventListener('click', function () {
      driveBtn.disabled = true;
      flag.textContent = 'EN ROUTE'; flag.classList.add('down');
      if (scene3d) scene3d.drive(true);
      var km = 0;
      var arrive = function () {
        clearInterval(timer); mKm.textContent = '50 km';
        if (scene3d) scene3d.drive(false);
        flag.textContent = 'ARRIVED · NANTEUIL';
        mClock.textContent = '70,012 F';
        note.textContent = 'The Treasury paid 70,012 francs for the whole job, about 117 francs a cab. Now scroll down: how much did all those taxis add up to?';
      };
      if (reduce) { arrive(); return; }
      timer = setInterval(function () { km += 1; mKm.textContent = km + ' km'; if (km >= 50) arrive(); }, 70);
    });
    resetBtn.addEventListener('click', function () { if (scene3d) scene3d.reset(); fresh(); });
    fresh();
  };

  /* ---------- predict: 1,000 dots ---------- */
  var setupPredict = function () {
    var svg = $('dots'), guess = $('guess'), out = $('guessOut'), btn = $('revealBtn'), rev = $('reveal');
    var NS = 'http://www.w3.org/2000/svg', dots = [];
    for (var i = 0; i < 1000; i++) {
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', 6 + (i % 40) * 9.75); c.setAttribute('cy', 6 + Math.floor(i / 40) * 9.75); c.setAttribute('r', 3.2);
      c.setAttribute('fill', '#2F3742'); svg.append(c); dots.push(c);
    }
    var revealed = false;
    var paint = function () {
      var n = Number(guess.value);
      out.innerHTML = n + ' <small>out of 1,000</small>';
      dots.forEach(function (d, i) {
        var fill = '#2F3742', stroke = 'none';
        if (revealed && i >= 4 && i < 139) fill = '#4F6FB0';
        if (i < n) { stroke = '#E9E2D0'; if (!revealed) fill = '#8A7A55'; }
        if (revealed && i < 4) fill = '#E0644F';
        d.setAttribute('fill', fill); d.setAttribute('stroke', stroke); d.setAttribute('stroke-width', stroke === 'none' ? 0 : 1);
      });
    };
    guess.addEventListener('input', paint);
    btn.addEventListener('click', function () {
      revealed = true; paint();
      var n = Number(guess.value);
      rev.innerHTML = '<p><b>About 4.</b> The red dots. The taxis carried about 4,000 soldiers out of roughly 1,080,000 French soldiers in the battle. You guessed ' + n + '. The blue dots are the rest of the 6th Army, about 135 of every 1,000, and most of them came by train.</p><p>So why does every French schoolkid learn about the taxis? Because the story felt like Paris itself driving out to save the country. Newspapers loved it, and it lifted spirits when France badly needed good news. One of the cabs is still on display in the army museum in Paris.</p>';
      btn.textContent = 'Shown';
      btn.disabled = true;
    });
    paint();
  };

  /* ---------- legend or record ---------- */
  var CARDS = [
    { claim: 'The Paris taxis saved the city.', truth: 'legend', why: 'The taxis carried about 4,000 soldiers. Most of the 6th Army’s 150,000 men came by train, and historians rate the taxis’ effect on the fighting as small. Their real effect was on morale, in Paris and across France.' },
    { claim: 'Pilots spotted the German turn.', truth: 'record', why: 'French airman Louis Breguet reported Kluck’s columns heading southeast on September 3, and British pilots filed reports of the same movement. Sir John French praised the Royal Flying Corps in his official dispatch of September 7.' },
    { claim: 'Foch sent the message “My center is giving way, my right is retreating. Situation excellent. I attack.”', truth: 'unproven', why: 'Foch did hold the marshes of Saint Gond, and he did counterattack. No copy of this message has turned up in the French army’s records. The line shows up in accounts written after the war.' },
    { claim: 'Moltke told the Kaiser, “Your Majesty, we have lost the war.”', truth: 'unproven', why: 'The quote appears in later accounts, and no record from September 1914 shows him saying it. His letter to his wife that week does survive. It is gloomy, but it says nothing that blunt.' },
    { claim: 'A lieutenant colonel ordered two German armies to retreat.', truth: 'record', why: 'Richard Hentsch carried spoken authority from Moltke. Bülow had already decided to pull back, and Kluck’s chief of staff accepted Hentsch’s order on September 9. A 1917 army inquiry ruled that Hentsch acted within his instructions.' }
  ];
  var TAGS = { record: 'In the record', legend: 'Legend', unproven: 'Can’t prove it' };
  var setupCards = function () {
    var host = $('cards');
    CARDS.forEach(function (c) {
      var card = document.createElement('div'); card.className = 'card';
      var p = document.createElement('p'); p.className = 'claim'; p.textContent = c.claim;
      var row = document.createElement('div'); row.className = 'btns'; row.setAttribute('role', 'group'); row.setAttribute('aria-label', 'Your call');
      var v = document.createElement('div'); v.className = 'verdict'; v.hidden = true; v.setAttribute('aria-live', 'polite');
      ['record', 'legend', 'unproven'].forEach(function (k) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = TAGS[k]; b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', function () {
          Array.prototype.forEach.call(row.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          v.hidden = false;
          v.innerHTML = '<b class="tag"></b><div></div><span class="you"></span>';
          v.children[0].className = 'tag ' + c.truth; v.children[0].textContent = TAGS[c.truth];
          v.children[1].textContent = c.why;
          v.children[2].textContent = k === c.truth ? 'You called it.' : 'You said ' + TAGS[k].toLowerCase() + '.';
        });
        row.append(b);
      });
      card.append(p, row, v);
      host.append(card);
    });
  };

  setupPredict();
  setupCards();
  startTable();
  startTaxi();
})();
