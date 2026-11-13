/* The Entry List: two bicycles on a board floor.
   Geometry first drafted by an orchestra worker (codestral), corrected and finished by hand.
   Renders only when something changes, so a Chromebook is not running a loop for nothing. */
(function () {
  'use strict';
  var stage = document.getElementById('bike-stage');
  if (!stage) return;
  var canvas = document.getElementById('bike-canvas');
  var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-bike]'));
  var readout = document.getElementById('bike-readout');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var SPECS = {
    high: {
      label: 'High wheeler, 1880s',
      rows: [
        ['Front wheel', 'about 52 inches across, and bigger for taller riders'],
        ['Rider sits', 'almost straight above the front wheel, about five feet off the ground'],
        ['Drive', 'pedals bolted straight to the front hub, one turn of the pedals is one turn of the wheel'],
        ['Tires', 'solid rubber'],
        ['Who could ride it', 'young, athletic men willing to fall head first over the bars']
      ]
    },
    safety: {
      label: 'Safety bicycle, 1890s',
      rows: [
        ['Wheels', 'two of the same size, about 28 inches'],
        ['Rider sits', 'low, between the wheels, with both feet able to reach the ground'],
        ['Drive', 'a chain from the pedals to the rear wheel, so gearing sets the speed instead of wheel size'],
        ['Tires', 'air filled, after 1888'],
        ['Who could ride it', 'almost anyone, including women and children']
      ]
    }
  };

  var current = 'safety';
  function writeReadout() {
    var s = SPECS[current];
    var html = '<p class="rd-title">' + s.label + '</p><dl>';
    s.rows.forEach(function (r) { html += '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; });
    readout.innerHTML = html + '</dl>';
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.bike === current)); });
  }
  writeReadout();

  var api = { show: function () {} };
  buttons.forEach(function (b) {
    b.addEventListener('click', function () { current = b.dataset.bike; writeReadout(); api.show(current); });
  });

  function fallback() {
    canvas.hidden = true;
    stage.classList.add('no-3d');
  }

  function rod(THREE, a, b, r, mat) {
    var dir = new THREE.Vector3().subVectors(b, a);
    var len = dir.length();
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.castShadow = true;
    return mesh;
  }

  function wheel(THREE, cx, cy, R, tube, spokes, mats) {
    var g = new THREE.Group();
    var tire = new THREE.Mesh(new THREE.TorusGeometry(R, tube, 8, 56), mats.tire);
    tire.position.set(cx, cy, 0); tire.castShadow = true; g.add(tire);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(R - tube - 0.006, 0.007, 6, 56), mats.metal);
    rim.position.set(cx, cy, 0); g.add(rim);
    var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 10), mats.metal);
    hub.rotation.x = Math.PI / 2; hub.position.set(cx, cy, 0); g.add(hub);
    for (var i = 0; i < spokes; i++) {
      var ang = (i / spokes) * Math.PI * 2;
      var side = i % 2 === 0 ? 0.045 : -0.045;
      var a = new THREE.Vector3(cx, cy, side);
      var b = new THREE.Vector3(cx + Math.cos(ang) * (R - tube - 0.01), cy + Math.sin(ang) * (R - tube - 0.01), 0);
      var s = rod(THREE, a, b, 0.0025, mats.metal); s.castShadow = false; g.add(s);
    }
    return g;
  }

  function saddleMesh(THREE, mats, x, y) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), mats.saddle);
    m.scale.set(1.6, 0.35, 0.9); m.position.set(x, y, 0); m.castShadow = true;
    return m;
  }

  function buildHighWheeler(THREE, mats) {
    var g = new THREE.Group();
    g.add(wheel(THREE, 0.30, 0.66, 0.66, 0.02, 40, mats));
    g.add(wheel(THREE, -0.62, 0.22, 0.22, 0.016, 18, mats));
    var curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.27, 1.40, 0), new THREE.Vector3(-0.15, 1.30, 0),
      new THREE.Vector3(-0.50, 0.75, 0), new THREE.Vector3(-0.62, 0.24, 0)
    ]);
    var bb = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.022, 8, false), mats.frame);
    bb.castShadow = true; g.add(bb);
    g.add(rod(THREE, new THREE.Vector3(0.27, 1.40, 0.06), new THREE.Vector3(0.30, 0.66, 0.07), 0.016, mats.frame));
    g.add(rod(THREE, new THREE.Vector3(0.27, 1.40, -0.06), new THREE.Vector3(0.30, 0.66, -0.07), 0.016, mats.frame));
    g.add(rod(THREE, new THREE.Vector3(0.24, 1.46, -0.31), new THREE.Vector3(0.24, 1.46, 0.31), 0.012, mats.metal));
    [0.31, -0.31].forEach(function (z) {
      var grip = rod(THREE, new THREE.Vector3(0.24, 1.46, z), new THREE.Vector3(0.24, 1.46, z + (z > 0 ? 0.08 : -0.08)), 0.017, mats.saddle);
      g.add(grip);
    });
    [[0.08, 1], [-0.08, -1]].forEach(function (p) {
      var crank = rod(THREE, new THREE.Vector3(0.30, 0.66, p[0]), new THREE.Vector3(0.30 + 0.13 * p[1], 0.66, p[0]), 0.01, mats.metal);
      g.add(crank);
      var pedal = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.025, 0.07), mats.metal);
      pedal.position.set(0.30 + 0.13 * p[1], 0.66, p[0] + (p[0] > 0 ? 0.04 : -0.04)); g.add(pedal);
    });
    var sad = saddleMesh(THREE, mats, 0.12, 1.47); g.add(sad);
    g.userData.saddleY = 1.47;
    return g;
  }

  function buildSafety(THREE, mats) {
    var g = new THREE.Group();
    g.add(wheel(THREE, 0.53, 0.355, 0.355, 0.026, 32, mats));
    g.add(wheel(THREE, -0.53, 0.355, 0.355, 0.026, 32, mats));
    var B = new THREE.Vector3(0.0, 0.30, 0), S = new THREE.Vector3(-0.10, 0.86, 0);
    var H1 = new THREE.Vector3(0.42, 0.90, 0), H2 = new THREE.Vector3(0.46, 0.74, 0);
    [[S, B], [H1, S], [H2, B]].forEach(function (p) { g.add(rod(THREE, p[0], p[1], 0.016, mats.frame)); });
    g.add(rod(THREE, H1, H2, 0.021, mats.frame));
    [0.05, -0.05].forEach(function (z) {
      var rear = new THREE.Vector3(-0.53, 0.355, z);
      g.add(rod(THREE, B, rear, 0.012, mats.frame));
      g.add(rod(THREE, S, rear, 0.011, mats.frame));
      g.add(rod(THREE, H2, new THREE.Vector3(0.53, 0.355, z), 0.013, mats.frame));
    });
    g.add(rod(THREE, H1, new THREE.Vector3(0.40, 1.00, 0), 0.011, mats.metal));
    g.add(rod(THREE, new THREE.Vector3(0.40, 1.00, -0.25), new THREE.Vector3(0.40, 1.00, 0.25), 0.011, mats.metal));
    [0.25, -0.25].forEach(function (z) {
      g.add(rod(THREE, new THREE.Vector3(0.40, 1.00, z), new THREE.Vector3(0.40, 1.00, z + (z > 0 ? 0.08 : -0.08)), 0.017, mats.saddle));
    });
    var sad = saddleMesh(THREE, mats, -0.13, 0.95); g.add(sad);
    g.add(rod(THREE, S, new THREE.Vector3(-0.13, 0.93, 0), 0.012, mats.metal));
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.009, 6, 40), mats.metal);
    ring.position.set(0, 0.30, 0.07); g.add(ring);
    var cog = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.007, 6, 24), mats.metal);
    cog.position.set(-0.53, 0.355, 0.07); g.add(cog);
    g.add(rod(THREE, new THREE.Vector3(0, 0.40, 0.07), new THREE.Vector3(-0.53, 0.395, 0.07), 0.004, mats.chain));
    g.add(rod(THREE, new THREE.Vector3(0, 0.20, 0.07), new THREE.Vector3(-0.53, 0.315, 0.07), 0.004, mats.chain));
    [[0.09, 1], [-0.09, -1]].forEach(function (p) {
      g.add(rod(THREE, new THREE.Vector3(0, 0.30, p[0]), new THREE.Vector3(0.17 * p[1], 0.30, p[0]), 0.01, mats.metal));
      var pedal = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.025, 0.07), mats.metal);
      pedal.position.set(0.17 * p[1], 0.30, p[0] + (p[0] > 0 ? 0.04 : -0.04)); g.add(pedal);
    });
    g.userData.saddleY = 0.95;
    return g;
  }

  function init() {
    if (!window.THREE) { fallback(); return; }
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); }
    catch (e) { fallback(); return; }
    if (!renderer.getContext()) { fallback(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
    var hemi = new THREE.HemisphereLight(0xfff3d6, 0x6b4a2a, 0.75); scene.add(hemi);
    var key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(2.5, 4, 3); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -2; key.shadow.camera.right = 2; key.shadow.camera.top = 2; key.shadow.camera.bottom = -1;
    scene.add(key);

    var mats = {
      frame: new THREE.MeshStandardMaterial({ color: 0x17140f, roughness: 0.35, metalness: 0.4 }),
      tire: new THREE.MeshStandardMaterial({ color: 0x241f1b, roughness: 0.9 }),
      metal: new THREE.MeshStandardMaterial({ color: 0xc9c2b2, roughness: 0.3, metalness: 0.85 }),
      chain: new THREE.MeshStandardMaterial({ color: 0x8b8578, roughness: 0.5, metalness: 0.7 }),
      saddle: new THREE.MeshStandardMaterial({ color: 0x6a3b22, roughness: 0.7 })
    };

    /* banked pine boards with chalk lines */
    var boards = new THREE.Group();
    for (var i = 0; i < 18; i++) {
      var shade = i % 3 === 0 ? 0xb98a52 : (i % 3 === 1 ? 0xc4945a : 0xae7f4a);
      var plank = new THREE.Mesh(new THREE.BoxGeometry(5, 0.03, 0.14),
        new THREE.MeshStandardMaterial({ color: shade, roughness: 0.8 }));
      plank.position.set(0, -0.015, -1.2 + i * 0.145);
      plank.receiveShadow = true;
      boards.add(plank);
    }
    var chalk = new THREE.Mesh(new THREE.BoxGeometry(5, 0.002, 0.025), new THREE.MeshBasicMaterial({ color: 0xf4efe2 }));
    chalk.position.set(0, 0.002, 0.55); boards.add(chalk);
    scene.add(boards);

    /* a person-height pole so the saddle height reads against something */
    var pole = new THREE.Group();
    var poleMat = new THREE.MeshBasicMaterial({ color: 0xf4efe2 });
    for (var f = 0; f <= 6; f++) {
      var tick = new THREE.Mesh(new THREE.BoxGeometry(f % 1 === 0 ? 0.12 : 0.06, 0.006, 0.006), poleMat);
      tick.position.set(0, f * 0.3048, 0); pole.add(tick);
    }
    var shaft = new THREE.Mesh(new THREE.BoxGeometry(0.008, 1.83, 0.008), poleMat);
    shaft.position.y = 0.915; pole.add(shaft);
    pole.position.set(-1.35, 0, 0.35);
    scene.add(pole);

    var bikes = { high: buildHighWheeler(THREE, mats), safety: buildSafety(THREE, mats) };
    scene.add(bikes.high); scene.add(bikes.safety);

    var line = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.006, 0.006), new THREE.MeshBasicMaterial({ color: 0x0f8a86 }));
    scene.add(line);

    var target = new THREE.Vector3(0, 0.7, 0);
    var theta = 1.25, phi = 1.35, radius = 4.6;
    function place() {
      camera.position.set(target.x + radius * Math.sin(phi) * Math.cos(theta),
        target.y + radius * Math.cos(phi), target.z + radius * Math.sin(phi) * Math.sin(theta));
      camera.lookAt(target);
    }
    function size() {
      var w = stage.clientWidth, h = stage.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix();
    }
    function render() { place(); renderer.render(scene, camera); }

    api.show = function (which) {
      bikes.high.visible = which === 'high';
      bikes.safety.visible = which === 'safety';
      var y = bikes[which].userData.saddleY;
      line.position.set(-0.95, y, 0.35);
      render();
    };

    var drag = null;
    canvas.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag) return;
      theta += (e.clientX - drag.x) * 0.008;
      phi = Math.min(1.5, Math.max(0.55, phi - (e.clientY - drag.y) * 0.006));
      drag = { x: e.clientX, y: e.clientY }; render();
    });
    ['pointerup', 'pointercancel'].forEach(function (t) { canvas.addEventListener(t, function () { drag = null; }); });
    canvas.addEventListener('keydown', function (e) {
      var used = true;
      if (e.key === 'ArrowLeft') theta -= 0.15;
      else if (e.key === 'ArrowRight') theta += 0.15;
      else if (e.key === 'ArrowUp') phi = Math.max(0.55, phi - 0.1);
      else if (e.key === 'ArrowDown') phi = Math.min(1.5, phi + 0.1);
      else used = false;
      if (used) { e.preventDefault(); render(); }
    });
    window.addEventListener('resize', function () { size(); render(); });
    size(); api.show(current);
    stage.classList.add('ready');
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); init(); }
    }, { rootMargin: '300px' });
    io.observe(stage);
  } else init();
  void reduce;
})();
