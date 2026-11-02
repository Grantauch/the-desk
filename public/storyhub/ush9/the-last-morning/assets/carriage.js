/* The Last Morning: dining car 2419D in the forest clearing near Compiègne.
   An orchestra worker (codestral) drafted the car body; spacing, chairs and the scene were rebuilt by hand.
   A stylized model, not a measured reconstruction. Renders only when something changes. */
(function () {
  'use strict';
  var stage = document.getElementById('car-stage');
  if (!stage) return;
  var canvas = document.getElementById('car-canvas');
  var slider = document.getElementById('car-time');
  var clock = document.getElementById('car-clock');
  var panel = document.getElementById('car-panel');
  var views = Array.prototype.slice.call(document.querySelectorAll('[data-view]'));
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var VIEWS = {
    outside: '<h4>Dining car 2419D</h4><p>Built in 1914 as a restaurant car for the Wagons Lits company. In October 1918 it was pulled into Marshal Ferdinand Foch\'s private train and fitted out as an office. The German delegation\'s train waited on a second track nearby.</p>',
    foch: '<h4>Foch\'s side of the table</h4><p>Marshal Ferdinand Foch, supreme commander of the Allied armies, sat at the center with General Maxime Weygand beside him. Britain\'s First Sea Lord, Admiral Rosslyn Wemyss, signed for the Allies with Foch.</p><p>Foch had given the Germans 72 hours to accept. He did not negotiate much.</p>',
    german: '<h4>The German side</h4><img class="pp" src="/storyhub/ush9/the-last-morning/assets/erzberger.webp" width="400" height="563" alt="Portrait of Matthias Erzberger, a heavyset man with glasses, seated at a desk."><p>Matthias Erzberger led the German delegation. He was a politician, not a general. He had crossed the lines on November 7 with a white flag on the lead car and reached the clearing the next morning.</p><p>While he waited, the Kaiser gave up his throne and fled to the Netherlands. Erzberger was signing for a government that had changed behind him.</p>',
    papers: '<h4>The papers</h4><p>The signatures went on between about 5:12 and 5:20 in the morning. The time was written as 5:00. Fighting was to stop at 11:00, Paris time.</p><p>Six hours remained, and the war was not over until they ran out.</p>',
    y1940: '<h4>June 22, 1940</h4><p>Twenty two years later Germany conquered France. Adolf Hitler ordered this same car pulled out of its museum and set on the exact spot in the clearing.</p><p>He sat in Foch\'s chair. This time France signed. Then the car was hauled to Berlin as a trophy. It was destroyed in Germany near the end of the Second World War.</p>'
  };
  var view = 'outside';
  function writePanel() {
    panel.innerHTML = VIEWS[view];
    views.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === view)); });
  }
  function fmt(m) { var h = Math.floor(m / 60), mm = m % 60; return h + ':' + (mm < 10 ? '0' : '') + mm + ' a.m.'; }
  function writeClock() {
    var m = +slider.value;
    clock.textContent = view === 'y1940' ? 'June 22, 1940' : fmt(m);
    slider.setAttribute('aria-valuetext', fmt(m) + ', ' + (660 - m) + ' minutes until the guns stop');
    slider.disabled = view === 'y1940';
  }
  writePanel(); writeClock();
  var api = { view: function () {}, time: function () {} };
  views.forEach(function (b) {
    b.addEventListener('click', function () { view = b.dataset.view; writePanel(); writeClock(); api.view(view); });
  });
  slider.addEventListener('input', function () { writeClock(); api.time(+slider.value); });

  function fallback() { canvas.hidden = true; stage.classList.add('no-3d'); }

  function init() {
    if (!window.THREE) { fallback(); return; }
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); }
    catch (e) { fallback(); return; }
    if (!renderer.getContext()) { fallback(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;

    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0b1020, 18, 70);
    var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    var hemi = new THREE.HemisphereLight(0x9fb3d6, 0x1c2416, 0.3); scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xffe2b0, 0.2); sun.position.set(-20, 6, 12); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -16; sun.shadow.camera.right = 16; sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12;
    scene.add(sun);
    var lamp = new THREE.PointLight(0xffc77a, 1.2, 12, 2); lamp.position.set(0, 3.1, 0); scene.add(lamp);

    var M = {
      body: new THREE.MeshStandardMaterial({ color: 0x3b2416, roughness: 0.55 }),
      trim: new THREE.MeshStandardMaterial({ color: 0xb8913f, roughness: 0.35, metalness: 0.7 }),
      roof: new THREE.MeshStandardMaterial({ color: 0x2c2e30, roughness: 0.8 }),
      glass: new THREE.MeshStandardMaterial({ color: 0xffd9a0, roughness: 0.1, transparent: true, opacity: 0.32, emissive: 0x5a3a10, emissiveIntensity: 0.6 }),
      iron: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.5 }),
      floor: new THREE.MeshStandardMaterial({ color: 0x5a3a26, roughness: 0.8 }),
      table: new THREE.MeshStandardMaterial({ color: 0x4a2e1c, roughness: 0.5 }),
      cloth: new THREE.MeshStandardMaterial({ color: 0x2f4a2c, roughness: 0.95 }),
      chair: new THREE.MeshStandardMaterial({ color: 0x5d2f1d, roughness: 0.6 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xd8a640, roughness: 0.3, metalness: 0.6, emissive: 0x6b4a10, emissiveIntensity: 0.5 }),
      paper: new THREE.MeshStandardMaterial({ color: 0xf2ede0, roughness: 0.9 })
    };
    function box(w, h, d, x, y, z, mat, parent) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
      (parent || car).add(m); return m;
    }

    var car = new THREE.Group(); scene.add(car);
    /* sides: lower band, upper band, pillars and glass between them */
    [1.45, -1.45].forEach(function (z) {
      box(20, 0.8, 0.08, 0, 1.6, z, M.body);
      box(20, 0.6, 0.08, 0, 3.25, z, M.body);
      for (var i = 0; i <= 10; i++) box(0.55, 0.95, 0.08, -10 + 0.275 + i * (19.45 / 10), 2.475, z, M.body);
      for (var j = 0; j < 10; j++) box(1.38, 0.95, 0.02, -10 + 0.275 + (j + 0.5) * (19.45 / 10), 2.475, z * 0.985, M.glass);
      box(20, 0.05, 0.1, 0, 2.0, z * 1.01, M.trim);
      box(20, 0.05, 0.1, 0, 2.95, z * 1.01, M.trim);
    });
    [10, -10].forEach(function (x) { box(0.08, 2.35, 2.9, x, 2.375, 0, M.body); });
    box(19.8, 0.1, 2.8, 0, 1.2, 0, M.floor);
    var roof = new THREE.Group(); car.add(roof);
    box(20.3, 0.14, 3.05, 0, 3.62, 0, M.roof, roof);
    box(18, 0.36, 1.25, 0, 3.86, 0, M.roof, roof);
    box(19, 0.35, 2.4, 0, 0.98, 0, M.iron);
    [7, -7].forEach(function (bx) {
      box(2.6, 0.3, 2.2, bx, 0.62, 0, M.iron);
      [[0.9, 0.72], [-0.9, 0.72], [0.9, -0.72], [-0.9, -0.72]].forEach(function (p) {
        var w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 14), M.iron);
        w.rotation.x = Math.PI / 2; w.position.set(bx + p[0], 0.5, p[1]); w.castShadow = true; car.add(w);
      });
    });
    [10.5, -10.5].forEach(function (px) {
      box(0.9, 0.1, 2.6, px, 1.2, 0, M.iron);
      box(0.05, 0.9, 2.5, px + (px > 0 ? 0.42 : -0.42), 1.7, 0, M.iron);
      box(0.5, 0.06, 1.0, px + (px > 0 ? 0.2 : -0.2), 0.75, 1.2, M.iron);
    });
    /* the table and the chairs */
    box(5.2, 0.08, 1.3, 0, 1.96, 0, M.table);
    box(5.1, 0.012, 1.2, 0, 2.006, 0, M.cloth);
    [[2.4, 0.55], [-2.4, 0.55], [2.4, -0.55], [-2.4, -0.55]].forEach(function (p) { box(0.07, 0.72, 0.07, p[0], 1.6, p[1], M.table); });
    var seats = { foch: null, german: null };
    function chair(x, z) {
      var g = new THREE.Group(); var s = z > 0 ? 1 : -1;
      box(0.46, 0.06, 0.46, 0, 1.71, 0, M.chair, g);
      box(0.46, 0.6, 0.06, 0, 2.02, 0.21 * s, M.chair, g);
      [[0.19, 0.19], [-0.19, 0.19], [0.19, -0.19], [-0.19, -0.19]].forEach(function (p) { box(0.04, 0.46, 0.04, p[0], 1.45, p[1], M.chair, g); });
      g.position.set(x, 0, z); car.add(g); return g;
    }
    [-1.8, -0.6, 0.6, 1.8].forEach(function (x) {
      var a = chair(x, 1.0), b = chair(x, -1.0);
      if (x === 0.6) { seats.foch = a; seats.german = b; }
    });
    var papers = new THREE.Group(); car.add(papers);
    for (var p = 0; p < 3; p++) { var sh = box(0.3, 0.01, 0.21, 0, 2.02 + p * 0.01, 0, M.paper, papers); sh.rotation.y = (p - 1) * 0.2; }
    papers.position.x = 0.6;

    /* the clearing: ground, two tracks, trees */
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: 0x2d3524, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    [0, -14].forEach(function (tz) {
      [0.72, -0.72].forEach(function (rz) { var r = new THREE.Mesh(new THREE.BoxGeometry(90, 0.08, 0.08), M.iron); r.position.set(0, 0.04, tz + rz); scene.add(r); });
      for (var t = -44; t <= 44; t += 1.2) { var tie = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 2.2), new THREE.MeshStandardMaterial({ color: 0x3a2a1c })); tie.position.set(t, 0.01, tz); scene.add(tie); }
    });
    var other = new THREE.Group(); scene.add(other);
    var bodyB = box(20, 2.4, 2.9, 0, 2.4, 0, new THREE.MeshStandardMaterial({ color: 0x24301f, roughness: 0.7 }), other);
    bodyB.castShadow = true; other.position.set(-4, 0, -14);
    var trunkMat = new THREE.MeshStandardMaterial({ color: 0x2b2118 }), leafMat = new THREE.MeshStandardMaterial({ color: 0x31402a, roughness: 1 });
    var seed = 7; function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (var k = 0; k < 70; k++) {
      var ang = rnd() * Math.PI * 2, dist = 18 + rnd() * 30;
      var tx = Math.cos(ang) * dist, tz2 = Math.sin(ang) * dist * 0.8 - 6;
      if (tz2 > -2 && tx > -24) continue;
      var tr = new THREE.Group();
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 6, 6), trunkMat); trunk.position.y = 3; tr.add(trunk);
      var crown = new THREE.Mesh(new THREE.ConeGeometry(2.2 + rnd(), 7 + rnd() * 4, 7), leafMat); crown.position.y = 8.5; tr.add(crown);
      tr.position.set(tx, 0, tz2); tr.scale.setScalar(0.8 + rnd() * 0.6); scene.add(tr);
    }

    /* light by the clock: dark at 5:00, grey dawn, full overcast day by 11:00 */
    var night = new THREE.Color(0x141c30), dawn = new THREE.Color(0x5b6478), day = new THREE.Color(0xa9b2bd), june = new THREE.Color(0xc9d8e8);
    var sky = new THREE.Color();
    function lightFor(min) {
      if (view === 'y1940') { sky.copy(june); hemi.intensity = 0.9; sun.intensity = 0.9; lamp.intensity = 0.2; }
      else {
        var t = Math.min(1, Math.max(0, (min - 300) / 360));
        if (t < 0.4) sky.copy(night).lerp(dawn, t / 0.4); else sky.copy(dawn).lerp(day, (t - 0.4) / 0.6);
        hemi.intensity = 0.45 + t * 0.5; sun.intensity = 0.12 + t * 0.55; lamp.intensity = 1.5 - t * 0.7;
        M.glass.emissiveIntensity = 0.7 - t * 0.5;
      }
      scene.background = sky; scene.fog.color.copy(sky);
    }

    var CAMS = {
      outside: { p: [14, 6.5, 17], t: [0, 2, 0], roof: true },
      foch: { p: [0.2, 3.05, -1.3], t: [0.6, 1.9, 1.0], roof: false, fov: 64 },
      german: { p: [1.0, 3.05, 1.3], t: [0.6, 1.9, -1.0], roof: false, fov: 64 },
      papers: { p: [1.6, 3.0, 1.0], t: [0.6, 2.0, 0], roof: false, fov: 50 },
      y1940: { p: [-13, 5, 15], t: [0, 2, 0], roof: true }
    };
    var camPos = new THREE.Vector3().fromArray(CAMS.outside.p), camTgt = new THREE.Vector3().fromArray(CAMS.outside.t);
    var wantPos = camPos.clone(), wantTgt = camTgt.clone();
    var orbit = 0;
    function render() {
      var pos = camPos.clone();
      if (orbit) { var c = Math.cos(orbit), s = Math.sin(orbit), dx = pos.x - camTgt.x, dz = pos.z - camTgt.z; pos.x = camTgt.x + dx * c - dz * s; pos.z = camTgt.z + dx * s + dz * c; }
      camera.position.copy(pos); camera.lookAt(camTgt);
      renderer.render(scene, camera);
    }
    var anim = null;
    function step() {
      var k = reduce ? 1 : 0.12;
      camPos.lerp(wantPos, k); camTgt.lerp(wantTgt, k);
      render();
      if (camPos.distanceTo(wantPos) > 0.01 || camTgt.distanceTo(wantTgt) > 0.01) anim = requestAnimationFrame(step);
      else { camPos.copy(wantPos); camTgt.copy(wantTgt); render(); anim = null; }
    }
    function kick() { if (!anim) anim = requestAnimationFrame(step); }

    api.view = function (v) {
      var c = CAMS[v]; wantPos.fromArray(c.p); wantTgt.fromArray(c.t); orbit = 0;
      camera.fov = c.fov || 40; camera.updateProjectionMatrix();
      roof.visible = c.roof;
      [seats.foch, seats.german].forEach(function (g) { g.children.forEach(function (m) { m.material = M.chair; }); });
      if (v === 'foch' || v === 'y1940') seats.foch.children.forEach(function (m) { m.material = M.gold; });
      if (v === 'german') seats.german.children.forEach(function (m) { m.material = M.gold; });
      papers.children.forEach(function (m) { m.material = v === 'papers' ? M.gold : M.paper; });
      lightFor(+slider.value); kick();
    };
    api.time = function (m) { lightFor(m); render(); };

    var drag = null;
    canvas.addEventListener('pointerdown', function (e) { drag = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', function (e) { if (drag == null) return; orbit += (e.clientX - drag) * 0.006; drag = e.clientX; render(); });
    ['pointerup', 'pointercancel'].forEach(function (t) { canvas.addEventListener(t, function () { drag = null; }); });
    canvas.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { orbit -= 0.15; e.preventDefault(); render(); }
      if (e.key === 'ArrowRight') { orbit += 0.15; e.preventDefault(); render(); }
    });
    function size() { var w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix(); }
    window.addEventListener('resize', function () { size(); render(); });
    size(); api.view(view); render();
    stage.classList.add('ready');
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); init(); }
    }, { rootMargin: '300px' });
    io.observe(stage);
  } else init();
})();
