/* The First Englishman: the Piltdown assemblage as a turnable specimen.
   A stylized model, not a scan. An orchestra worker drafted a first version of the geometry;
   this file is a rebuild by hand. Renders only on change. */
(function () {
  'use strict';
  var stage = document.getElementById('spec-stage');
  if (!stage) return;
  var canvas = document.getElementById('spec-canvas');
  var panel = document.getElementById('spec-panel');
  var btns = Array.prototype.slice.call(document.querySelectorAll('[data-spec]'));
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var TEXT = {
    assembled: '<h4>As shown in 1912</h4><p>Pieces of a braincase and half a lower jaw, every piece the same deep brown of something very old. Everything white is plaster. Woodward modeled the missing parts so the head would read as one animal.</p><p class="mono">Plaster is a guess. It is not evidence.</p>',
    section: '<h4>Take it apart</h4><p>Pull the plaster away and look where the jaw would have met the skull. The rounded knob that hinges a jaw to a skull is broken off. The chin, which shows whether a jaw is ape or human, is broken off too.</p><p class="mono">The two pieces that could have proven a match are the two pieces that are missing. The marked edges are breaks.</p>',
    file: '<h4>Under the microscope</h4><p>The two molars in the jaw are flat on top, like a human tooth worn by chewing. Under magnification the surfaces carry straight parallel scratches.</p><p class="mono">Chewing wears teeth in every direction. A file goes one way.</p>',
    stain: '<h4>The color</h4><p>The brown that made the bones look half a million years old was put there by a person. Tests in the 1950s found chromium in the stain on some pieces. Dawson had said he soaked fragments in a chemical solution to harden them.</p><p class="mono">Scrape the surface of a stained piece and the bone underneath is pale.</p>',
    inside: '<h4>Inside, 2016</h4><p>CT scans looked inside the teeth and bones. Small cavities had been packed with gravel from the Piltdown pits and sealed with a grey putty. The same putty turns up at both sites.</p><p class="mono">Whoever did this filled the holes with local gravel so the pieces would match where they were supposedly found.</p>'
  };
  var mode = 'assembled';
  function write() {
    panel.innerHTML = TEXT[mode];
    btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.spec === mode)); });
  }
  write();
  var api = { set: function () {} };
  btns.forEach(function (b) {
    b.addEventListener('click', function () { mode = b.dataset.spec; write(); api.set(mode); });
  });

  function fallback() { canvas.hidden = true; stage.classList.add('no-3d'); }

  function init() {
    if (!window.THREE) { fallback(); return; }
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); }
    catch (e) { fallback(); return; }
    if (!renderer.getContext()) { fallback(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(30, 1, 0.01, 10);
    scene.add(new THREE.HemisphereLight(0xfff1dc, 0x2a1512, 0.55));
    var rake = new THREE.DirectionalLight(0xffe9c8, 1.05); rake.position.set(-0.6, 0.35, 0.4); scene.add(rake);
    var fill = new THREE.DirectionalLight(0xb9c6d8, 0.25); fill.position.set(0.5, 0.2, -0.6); scene.add(fill);

    var C = {
      fossil: new THREE.Color(0x5b3519), bone: new THREE.Color(0xe8dcc0), stain: new THREE.Color(0xd9822b)
    };
    var boneMat = new THREE.MeshStandardMaterial({ color: C.fossil.clone(), roughness: 0.78, side: THREE.DoubleSide });
    var toothMat = new THREE.MeshStandardMaterial({ color: 0xd9c9a3, roughness: 0.35, transparent: true, opacity: 1 });
    var plasterMat = new THREE.MeshStandardMaterial({ color: 0xf1ebdc, roughness: 0.95, side: THREE.DoubleSide });
    var mark = new THREE.MeshBasicMaterial({ color: 0xd9822b });
    var puttyMat = new THREE.MeshStandardMaterial({ color: 0x8c8a85, roughness: 0.9 });
    var gravelMat = new THREE.MeshStandardMaterial({ color: 0x9a7a4a, roughness: 1 });

    var root = new THREE.Group(); scene.add(root);
    var R = 0.095, SX = 1.12, SY = 0.9, SZ = 0.84;

    /* braincase fragments: partial spheres with real gaps between them */
    var FR = [
      [0.15, 0.68, 0.10, 0.30],  // left parietal
      [1.17, 0.66, 0.10, 0.30],  // right parietal
      [1.82, 0.36, 0.30, 0.30],  // occipital, back of head
      [0.32, 0.42, 0.44, 0.20],  // left temporal
      [0.86, 0.26, 0.18, 0.22],  // frontal
      [1.86, 0.30, 0.12, 0.16],  // small piece, upper back
      [0.90, 0.22, 0.43, 0.14],  // left brow edge
      [1.25, 0.40, 0.44, 0.16],  // right temporal
      [0.05, 0.10, 0.02, 0.10]   // crown flake
    ];
    var frags = [];
    var cranium = new THREE.Group(); root.add(cranium);
    FR.forEach(function (f) {
      var g = new THREE.SphereGeometry(R, 20, 14, f[0] * Math.PI, f[1] * Math.PI, f[2] * Math.PI, f[3] * Math.PI);
      var m = new THREE.Mesh(g, boneMat);
      m.scale.set(SX, SY, SZ);
      var pm = (f[0] + f[1] / 2) * Math.PI, tm = (f[2] + f[3] / 2) * Math.PI;
      var dir = new THREE.Vector3(-Math.cos(pm) * Math.sin(tm), Math.cos(tm), Math.sin(pm) * Math.sin(tm)).normalize();
      m.userData.dir = dir;
      cranium.add(m); frags.push(m);
    });
    var plasterSkull = new THREE.Mesh(new THREE.SphereGeometry(R * 0.985, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.66), plasterMat);
    plasterSkull.scale.set(SX, SY, SZ); root.add(plasterSkull);

    /* the jaw: right half only, broken at the chin and at the hinge */
    function jawShape() {
      var s = new THREE.Shape();
      s.moveTo(0.060, -0.030);
      s.quadraticCurveTo(0.020, -0.040, -0.025, -0.036);
      s.quadraticCurveTo(-0.048, -0.032, -0.050, -0.010);
      s.lineTo(-0.052, 0.034);
      s.lineTo(-0.034, 0.038);
      s.lineTo(-0.024, 0.008);
      s.quadraticCurveTo(-0.010, 0.002, 0.052, 0.002);
      s.lineTo(0.064, -0.012);
      s.lineTo(0.060, -0.030);
      return s;
    }
    var jawGeo = new THREE.ExtrudeGeometry(jawShape(), { depth: 0.013, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 2, curveSegments: 10 });
    jawGeo.translate(0, 0, -0.0065);
    var jaw = new THREE.Group();
    var jawMesh = new THREE.Mesh(jawGeo, boneMat); jaw.add(jawMesh);
    jaw.position.set(0.045, -0.118, -0.034); jaw.rotation.y = 0.32;
    root.add(jaw);
    var plasterJaw = new THREE.Mesh(jawGeo, plasterMat);
    plasterJaw.scale.set(0.985, 0.985, -0.985); plasterJaw.position.set(0.045, -0.118, 0.034); plasterJaw.rotation.y = -0.32;
    root.add(plasterJaw);

    /* break edges in the signal color */
    var chinBreak = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.022, 0.02), mark);
    chinBreak.position.set(0.063, -0.019, 0); chinBreak.rotation.z = -0.2; jaw.add(chinBreak);
    var hingeBreak = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.004, 0.02), mark);
    hingeBreak.position.set(-0.043, 0.037, 0); hingeBreak.rotation.z = -0.2; jaw.add(hingeBreak);
    var missing = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 8), new THREE.MeshBasicMaterial({ color: 0xd9822b, transparent: true, opacity: 0.35, depthWrite: false }));
    missing.position.set(-0.045, 0.052, 0); jaw.add(missing);

    /* molars, flat on top, with file marks; putty plugs inside */
    var molars = [];
    [-0.006, 0.008].forEach(function (x) {
      var t = new THREE.Mesh(new THREE.BoxGeometry(0.0115, 0.008, 0.0105), toothMat);
      t.position.set(x, 0.006, 0); jaw.add(t); molars.push(t);
      var marks = new THREE.Group();
      for (var i = 0; i < 6; i++) {
        var l = new THREE.Mesh(new THREE.BoxGeometry(0.0108, 0.0004, 0.00045), mark);
        l.position.set(0, 0.0041, -0.0042 + i * 0.0017); marks.add(l);
      }
      t.add(marks); t.userData.marks = marks;
      var plug = new THREE.Mesh(new THREE.SphereGeometry(0.0024, 8, 6), puttyMat);
      plug.position.set(0, -0.001, 0); t.add(plug); t.userData.plug = plug;
    });

    /* canine found separately in 1913 */
    var prof = [];
    for (var k = 0; k <= 8; k++) { var tt = k / 8; prof.push(new THREE.Vector2(0.0045 * Math.sin(Math.PI * Math.min(1, tt * 1.15)) + 0.0005, tt * 0.022)); }
    var canine = new THREE.Mesh(new THREE.LatheGeometry(prof, 12), toothMat);
    canine.position.set(0.12, -0.11, 0.05); canine.rotation.z = -0.25; root.add(canine);
    var cPlug = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 8, 6), gravelMat); cPlug.position.y = 0.006; canine.add(cPlug);

    /* specimen card under everything, with a scale bar */
    var card = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.003, 0.24), new THREE.MeshStandardMaterial({ color: 0xefe6d2, roughness: 1 }));
    card.position.set(0.02, -0.165, 0); root.add(card);
    for (var s = 0; s < 5; s++) {
      var seg = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.0015, 0.006), new THREE.MeshBasicMaterial({ color: s % 2 ? 0xefe6d2 : 0x2a1512 }));
      seg.position.set(-0.11 + s * 0.02, -0.1628, 0.1); root.add(seg);
    }

    /* state */
    var target = new THREE.Vector3(0.02, -0.05, 0);
    var theta = 0.95, phi = 1.25, radius = 0.72;
    var want = { theta: theta, phi: phi, radius: radius, tx: target.x, ty: target.y, tz: target.z, explode: 0, stain: 0 };
    var cur = { explode: 0, stain: 0 };
    var stainBase = C.fossil.clone();

    function apply() {
      frags.forEach(function (m) { m.position.copy(m.userData.dir).multiplyScalar(cur.explode * 0.04); });
      jaw.position.y = -0.118 - cur.explode * 0.03;
      boneMat.color.copy(stainBase).lerp(C.stain, cur.stain * 0.75);
      camera.position.set(target.x + radius * Math.sin(phi) * Math.cos(theta), target.y + radius * Math.cos(phi), target.z + radius * Math.sin(phi) * Math.sin(theta));
      camera.lookAt(target);
      renderer.render(scene, camera);
    }

    function look(tx, ty, tz, r, th, ph) { want.tx = tx; want.ty = ty; want.tz = tz; want.radius = r; if (th != null) want.theta = th; if (ph != null) want.phi = ph; }

    api.set = function (m) {
      plasterSkull.visible = plasterJaw.visible = m === 'assembled';
      var showBreaks = m === 'section';
      chinBreak.visible = hingeBreak.visible = missing.visible = showBreaks;
      molars.forEach(function (t) { t.userData.marks.visible = m === 'file'; t.userData.plug.visible = m === 'inside'; });
      cPlug.visible = m === 'inside';
      toothMat.opacity = m === 'inside' ? 0.35 : 1;
      boneMat.transparent = m === 'inside'; boneMat.opacity = m === 'inside' ? 0.55 : 1;
      want.explode = m === 'section' ? 1 : 0;
      want.stain = m === 'stain' ? 1 : 0;
      if (m === 'file') look(0.045, -0.105, -0.034, 0.16, 1.1, 0.62);
      else if (m === 'section') look(0.02, -0.07, 0, 0.82, 0.25, 1.35);
      else look(0.02, -0.05, 0, 0.72, null, null);
      if (m === 'stain') stainBase.copy(C.fossil);
      kick();
    };

    var anim = null;
    function step() {
      var k = reduce ? 1 : 0.16, done = true;
      function ease(a, b) { var v = a + (b - a) * k; if (Math.abs(b - v) > 0.0005) done = false; else v = b; return v; }
      cur.explode = ease(cur.explode, want.explode);
      cur.stain = ease(cur.stain, want.stain);
      target.x = ease(target.x, want.tx); target.y = ease(target.y, want.ty); target.z = ease(target.z, want.tz);
      radius = ease(radius, want.radius); theta = ease(theta, want.theta); phi = ease(phi, want.phi);
      apply();
      anim = done ? null : requestAnimationFrame(step);
    }
    function kick() { if (!anim) anim = requestAnimationFrame(step); }

    var drag = null;
    canvas.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag) return;
      theta += (e.clientX - drag.x) * 0.009; want.theta = theta;
      phi = Math.min(2.6, Math.max(0.35, phi - (e.clientY - drag.y) * 0.007)); want.phi = phi;
      drag = { x: e.clientX, y: e.clientY }; apply();
    });
    ['pointerup', 'pointercancel'].forEach(function (t) { canvas.addEventListener(t, function () { drag = null; }); });
    canvas.addEventListener('keydown', function (e) {
      var used = true;
      if (e.key === 'ArrowLeft') want.theta = theta - 0.2;
      else if (e.key === 'ArrowRight') want.theta = theta + 0.2;
      else if (e.key === 'ArrowUp') want.phi = Math.max(0.35, phi - 0.15);
      else if (e.key === 'ArrowDown') want.phi = Math.min(2.6, phi + 0.15);
      else used = false;
      if (used) { e.preventDefault(); kick(); }
    });
    function size() {
      var w = stage.clientWidth, h = stage.clientHeight;
      renderer.setSize(w, h, false); camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', function () { size(); apply(); });
    size(); api.set(mode); apply();
    stage.classList.add('ready');
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); init(); }
    }, { rootMargin: '300px' });
    io.observe(stage);
  } else init();
})();
