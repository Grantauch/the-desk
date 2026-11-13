/* The First Englishman: the Piltdown pieces as one turnable specimen tray.
   The jaw outline is traced from the 1953 British Museum photograph of the real
   Piltdown mandible, and both of its faces carry that photograph. The braincase is
   a modeled vault with fragment shapes placed from published drawings. The canine
   is modeled. Renders only when something changes. */
(function () {
  'use strict';
  var stage = document.getElementById('spec-stage');
  if (!stage) return;
  var canvas = document.getElementById('spec-canvas');
  var btns = Array.prototype.slice.call(document.querySelectorAll('[data-spec]'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('[data-spec-panel]'));
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ASSET = '/storyhub/hh/the-first-englishman/assets/';
  var mode = 'cast';
  var api = { set: function () {} };

  function write() {
    btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.spec === mode)); });
    panels.forEach(function (p) { p.hidden = p.dataset.specPanel !== mode; });
  }
  btns.forEach(function (b) {
    b.addEventListener('click', function () { mode = b.dataset.spec; write(); api.set(mode); });
  });
  write();

  function fallback() { canvas.hidden = true; stage.classList.add('no-3d'); }

  /* outline of the real jaw, traced from Weiner, Oakley and Le Gros Clark 1953, plate 8 */
  var JAW = {"aspect":1.6487,"pts":[[0.0989,1.0],[0.0806,0.9478],[0.0624,0.9209],[0.0297,0.9304],[0.0,0.8892],[0.0,0.8323],[0.0153,0.7848],[0.0479,0.6851],[0.0566,0.6123],[0.0566,0.4747],[0.0624,0.4019],[0.0921,0.2848],[0.1209,0.2215],[0.1717,0.1361],[0.2006,0.1092],[0.2457,0.0997],[0.3388,0.0918],[0.4194,0.0807],[0.5307,0.0617],[0.6352,0.0538],[0.7044,0.0475],[0.7802,0.0332],[0.8618,0.0174],[0.9338,0.0],[0.9751,0.0063],[0.9952,0.019],[0.9933,0.0316],[0.9616,0.0553],[0.9357,0.0807],[0.9184,0.1218],[0.9002,0.1661],[0.8848,0.1867],[0.8551,0.2041],[0.8378,0.2516],[0.8215,0.2943],[0.8013,0.3338],[0.7956,0.3513],[0.7793,0.3861],[0.7754,0.3877],[0.7649,0.4209],[0.7438,0.4415],[0.7179,0.4399],[0.7169,0.4842],[0.7207,0.5459],[0.6967,0.5459],[0.6919,0.5522],[0.6727,0.5491],[0.6641,0.5396],[0.6315,0.5316],[0.6132,0.5158],[0.6084,0.4937],[0.6027,0.4842],[0.5806,0.4858],[0.5787,0.519],[0.5202,0.5047],[0.5173,0.4953],[0.5173,0.4652],[0.5211,0.4494],[0.5202,0.4177],[0.4635,0.4256],[0.429,0.4968],[0.429,0.5095],[0.4203,0.5301],[0.4031,0.5949],[0.3801,0.6345],[0.3407,0.7231],[0.3157,0.7737],[0.3013,0.8418],[0.2908,0.9177],[0.2802,0.9604],[0.2591,0.981],[0.2265,0.981],[0.2006,0.9715],[0.1621,0.9873],[0.1257,0.9984]]};

  function hash(x, y, z) {
    var h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
    return h - Math.floor(h);
  }
  function noise(x, y, z) {
    var ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    var fx = x - ix, fy = y - iy, fz = z - iz;
    function s(t) { return t * t * (3 - 2 * t); }
    var ux = s(fx), uy = s(fy), uz = s(fz), v = 0;
    for (var a = 0; a < 2; a++) for (var b = 0; b < 2; b++) for (var c = 0; c < 2; c++) {
      var w = (a ? ux : 1 - ux) * (b ? uy : 1 - uy) * (c ? uz : 1 - uz);
      v += w * hash(ix + a, iy + b, iz + c);
    }
    return v;
  }

  function boneTexture(THREE, base, spots, seed) {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 900; i++) {
      var x = hash(i, seed, 1) * 256, y = hash(seed, i, 2) * 256, r = 1 + hash(i, i, seed) * 9;
      g.fillStyle = spots[i % spots.length];
      g.globalAlpha = 0.05 + hash(i, 3, seed) * 0.16;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  function init() {
    if (!window.THREE) { fallback(); return; }
    var THREE = window.THREE, renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); }
    catch (e) { fallback(); return; }
    if (!renderer.getContext()) { fallback(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(28, 1, 0.005, 10);
    scene.add(new THREE.HemisphereLight(0xfff3e0, 0x2a1512, 0.55));
    var rake = new THREE.DirectionalLight(0xffe7c4, 1.15); rake.position.set(-0.5, 0.8, 0.6); scene.add(rake);
    var fill = new THREE.DirectionalLight(0xb7c4d8, 0.35); fill.position.set(0.6, 0.2, -0.7); scene.add(fill);

    var loader = new THREE.TextureLoader();
    function tex(name) {
      var t = loader.load(ASSET + name, function () { kick(); });
      return t;
    }

    var fossilTex = boneTexture(THREE, '#5c361c', ['#331b0c', '#7a4c2a', '#24130a', '#8e5c34'], 7);
    var plasterTex = boneTexture(THREE, '#efe8d8', ['#d9cfb9', '#fffaf0', '#cfc4ad'], 3);
    var boneMat = new THREE.MeshStandardMaterial({ map: fossilTex, color: 0xffffff, roughness: 0.82, side: THREE.DoubleSide, transparent: true, opacity: 1 });
    var plasterMat = new THREE.MeshStandardMaterial({ map: plasterTex, color: 0xffffff, roughness: 0.96, side: THREE.DoubleSide });
    var markMat = new THREE.MeshBasicMaterial({ color: 0xd9822b });
    var ghostMat = new THREE.MeshBasicMaterial({ color: 0xd9822b, transparent: true, opacity: 0.32, depthWrite: false });
    var paleMat = new THREE.MeshStandardMaterial({ color: 0xf2e6cf, roughness: 0.9 });

    var root = new THREE.Group(); scene.add(root);

    /* ---------- the jaw, from the photograph ---------- */
    var JW = 0.12, JH = JW / JAW.aspect, JD = 0.013;
    var shape = new THREE.Shape();
    JAW.pts.forEach(function (p, i) {
      var x = p[0] * JW - JW / 2, y = p[1] * JH;
      if (i) shape.lineTo(x, y); else shape.moveTo(x, y);
    });
    var sideGeo = new THREE.ExtrudeGeometry(shape, { depth: JD, bevelEnabled: true, bevelThickness: 0.0028, bevelSize: 0.0016, bevelSegments: 3, curveSegments: 4 });
    var hidden = new THREE.MeshBasicMaterial({ visible: false });
    var jawSideMat = new THREE.MeshStandardMaterial({ color: 0x6a4024, roughness: 0.85 });
    var capGeo = new THREE.ShapeGeometry(shape);
    var uv = capGeo.attributes.uv, pos = capGeo.attributes.position;
    for (var i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + JW / 2) / JW, pos.getY(i) / JH);
    uv.needsUpdate = true;
    var outerMat = new THREE.MeshStandardMaterial({ map: tex('jaw-tex-outer.webp'), transparent: true, alphaTest: 0.35, roughness: 0.8, side: THREE.FrontSide });
    var innerMat = new THREE.MeshStandardMaterial({ map: tex('jaw-tex-inner.webp'), transparent: true, alphaTest: 0.35, roughness: 0.8, side: THREE.BackSide });

    function buildJaw(isPlaster) {
      var g = new THREE.Group();
      g.add(new THREE.Mesh(sideGeo, [hidden, isPlaster ? plasterMat : jawSideMat]));
      if (isPlaster) {
        var cap = new THREE.Mesh(capGeo, plasterMat); cap.position.z = JD + 0.0029; g.add(cap);
        var back = new THREE.Mesh(capGeo, plasterMat); back.position.z = -0.0029; g.add(back);
      } else {
        var front = new THREE.Mesh(capGeo, outerMat); front.position.z = JD + 0.0029; g.add(front);
        var rear = new THREE.Mesh(capGeo, innerMat); rear.position.z = -0.0029; g.add(rear);
      }
      return g;
    }
    var jaw = new THREE.Group();
    var jawReal = buildJaw(false); jawReal.position.z = -JD / 2; jaw.add(jawReal);
    jaw.position.set(0.006, 0.0, 0.034); jaw.rotation.y = 0.30;
    root.add(jaw);

    var jawPlaster = new THREE.Group();
    var jp = buildJaw(true); jp.position.z = -JD / 2; jawPlaster.add(jp);
    jawPlaster.scale.z = -1; jawPlaster.position.set(0.006, 0.0, -0.034); jawPlaster.rotation.y = -0.30;
    root.add(jawPlaster);

    /* the parts that would have settled it: the chin and the hinge knob */
    function local(px, py) { return new THREE.Vector3(px * JW - JW / 2, py * JH, 0); }
    var chinFill = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0075, 10, 28, Math.PI * 0.62), plasterMat);
    chinFill.rotation.set(Math.PI / 2, 0, -Math.PI * 0.31); chinFill.position.set(0.064, 0.008, 0);
    root.add(chinFill);
    var condyleFill = new THREE.Mesh(new THREE.SphereGeometry(0.008, 16, 12), plasterMat);
    condyleFill.scale.set(1.4, 0.8, 1); condyleFill.position.copy(local(0.09, 1.05)); jaw.add(condyleFill);
    var chinGhost = new THREE.Mesh(new THREE.SphereGeometry(0.011, 16, 12), ghostMat);
    chinGhost.position.copy(local(1.04, 0.12)); jaw.add(chinGhost);
    var condyleGhost = new THREE.Mesh(new THREE.SphereGeometry(0.009, 16, 12), ghostMat);
    condyleGhost.position.copy(local(0.09, 1.07)); jaw.add(condyleGhost);
    var chinEdge = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.012, JD + 0.007), markMat);
    chinEdge.position.copy(local(0.985, 0.03)); chinEdge.rotation.z = 0.5; jaw.add(chinEdge);
    var condyleEdge = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.0022, JD + 0.007), markMat);
    condyleEdge.position.copy(local(0.08, 0.96)); condyleEdge.rotation.z = -0.25; jaw.add(condyleEdge);

    /* file marks across the two molar crowns, which sit at 0.52 to 0.72 of the length */
    var fileMarks = new THREE.Group();
    for (var f = 0; f < 9; f++) {
      var l = new THREE.Mesh(new THREE.BoxGeometry(0.0235, 0.0005, 0.0004), markMat);
      l.position.set(local(0.62, 0.548).x, 0.548 * JH + 0.0006, -JD / 2 + 0.0012 + f * (JD - 0.0024) / 8);
      l.rotation.y = 0.04;
      fileMarks.add(l);
    }
    jaw.add(fileMarks);

    /* drill test: curled shavings from the jaw, dust from the skull */
    var bit = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.05, 10), new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.8, roughness: 0.3 }));
    bit.rotation.z = Math.PI / 2; bit.position.copy(local(0.33, 0.25)); bit.position.z = 0.03; bit.rotation.x = Math.PI / 2;
    jaw.add(bit);
    var curls = new THREE.Group();
    for (var s = 0; s < 14; s++) {
      var cu = new THREE.Mesh(new THREE.TorusGeometry(0.0018 + hash(s, 1, 1) * 0.0012, 0.00045, 6, 14, Math.PI * (1.1 + hash(s, 2, 2))), paleMat);
      cu.position.set(local(0.33, 0.25).x + (hash(s, 3, 3) - 0.5) * 0.018, local(0.33, 0.25).y - 0.004 - hash(s, 4, 4) * 0.012, JD / 2 + 0.006 + hash(s, 5, 5) * 0.01);
      cu.rotation.set(hash(s, 6, 6) * 6, hash(s, 7, 7) * 6, 0);
      curls.add(cu);
    }
    jaw.add(curls);
    var hole = new THREE.Mesh(new THREE.CircleGeometry(0.0022, 16), paleMat);
    hole.position.copy(local(0.33, 0.25)); hole.position.z = JD / 2 + 0.0032; jaw.add(hole);

    /* ---------- the braincase ---------- */
    var cranium = new THREE.Group(); root.add(cranium);
    cranium.position.set(-0.03, 0.112, 0);
    function vault(d, k) {
      var x = d.x * 0.092, y = d.y * (d.y > 0 ? 0.074 : 0.07), z = d.z * 0.068;
      if (d.x < 0) x *= 1 + 0.07 * (1 - d.y * d.y);
      return new THREE.Vector3(x * k, y * k, z * k);
    }
    var SEEDS = [
      { d: [-0.1, 0.72, 0.68], r: 0.62 },
      { d: [0.08, 0.02, 1.0], r: 0.42 },
      { d: [-1.0, 0.18, 0.25], r: 0.5 },
      { d: [-0.25, 0.75, -0.6], r: 0.38 },
      { d: [0.78, 0.5, 0.25], r: 0.27 },
      { d: [-0.05, 0.05, -1.0], r: 0.2 }
    ].map(function (s) { return { d: new THREE.Vector3().fromArray(s.d).normalize(), r: s.r }; });
    var sphere = new THREE.SphereGeometry(1, 200, 140).toNonIndexed();
    var sp = sphere.attributes.position, suv = sphere.attributes.uv;
    var buckets = SEEDS.map(function () { return { p: [], u: [] }; });
    var plasterBucket = { p: [], u: [] };
    var cen = new THREE.Vector3(), a = new THREE.Vector3();
    for (var t = 0; t < sp.count; t += 3) {
      cen.set(0, 0, 0);
      for (var k2 = 0; k2 < 3; k2++) cen.add(a.fromBufferAttribute(sp, t + k2));
      cen.normalize();
      if (cen.y < -0.5 || (cen.y < -0.2 && cen.x > 0.55)) continue;
      var best = -1, bestScore = 9;
      SEEDS.forEach(function (sd, si) {
        var ang = cen.angleTo(sd.d) + (noise(cen.x * 9 + si, cen.y * 9, cen.z * 9) - 0.5) * 0.2 + (noise(cen.x * 31, cen.y * 31 + si, cen.z * 31) - 0.5) * 0.06;
        if (ang < sd.r && ang < bestScore) { bestScore = ang; best = si; }
      });
      var bucket = best >= 0 ? buckets[best] : plasterBucket;
      for (var k3 = 0; k3 < 3; k3++) {
        a.fromBufferAttribute(sp, t + k3);
        var v = vault(a, best >= 0 ? 1 : 0.985);
        bucket.p.push(v.x, v.y, v.z); bucket.u.push(suv.getX(t + k3) * 3, suv.getY(t + k3) * 3);
      }
    }
    function meshFrom(b, mat, thick) {
      var g = new THREE.BufferGeometry();
      var P = b.p.slice(), U = b.u.slice();
      if (thick) {
        for (var q = 0; q < b.p.length; q += 9) {
          for (var r = 2; r >= 0; r--) { P.push(b.p[q + r * 3] * 0.86, b.p[q + r * 3 + 1] * 0.86, b.p[q + r * 3 + 2] * 0.86); }
          var uq = (q / 3) * 2;
          for (var r2 = 2; r2 >= 0; r2--) U.push(b.u[uq + r2 * 2], b.u[uq + r2 * 2 + 1]);
        }
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      g.computeVertexNormals();
      return new THREE.Mesh(g, mat);
    }
    var frags = buckets.map(function (b, i) {
      var m = meshFrom(b, boneMat, true); m.userData.dir = SEEDS[i].d.clone(); cranium.add(m); return m;
    });
    var plasterSkull = meshFrom(plasterBucket, plasterMat, false); cranium.add(plasterSkull);
    var skullHole = new THREE.Mesh(new THREE.CircleGeometry(0.0026, 16), paleMat);
    var dust = new THREE.Group();
    (function () {
      var d = SEEDS[0].d.clone(), surf = vault(d, 1.003);
      skullHole.position.copy(surf); skullHole.lookAt(surf.clone().multiplyScalar(2)); frags[0].add(skullHole);
      for (var n = 0; n < 40; n++) {
        var g = new THREE.Mesh(new THREE.SphereGeometry(0.00045, 5, 4), paleMat);
        g.position.copy(surf).add(new THREE.Vector3((hash(n, 1, 9) - 0.5) * 0.014, -0.004 - hash(n, 2, 9) * 0.012, (hash(n, 3, 9) - 0.5) * 0.014));
        dust.add(g);
      }
      frags[0].add(dust);
    })();

    /* ---------- the canine, found in 1913, and what was inside it ---------- */
    var prof = [];
    for (var c = 0; c <= 14; c++) {
      var tt = c / 14;
      var rad = 0.0042 * Math.sin(Math.PI * Math.min(1, 0.08 + tt * 0.98)) + 0.0006 * (1 - tt);
      prof.push(new THREE.Vector2(Math.max(0.0004, rad), tt * 0.024));
    }
    var paint = new THREE.MeshStandardMaterial({ color: 0x3a2414, roughness: 0.55, transparent: true, opacity: 1 });
    var canine = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), paint);
    canine.scale.set(1, 1, 0.75);
    var canineGroup = new THREE.Group(); canineGroup.add(canine);
    canineGroup.position.set(0.085, -0.023, 0.07); canineGroup.rotation.set(0, 0.4, -1.35);
    root.add(canineGroup);
    var grains = new THREE.Group();
    var grainMat = new THREE.MeshStandardMaterial({ color: 0xa8743c, roughness: 1 });
    for (var gI = 0; gI < 19; gI++) {
      var gr = new THREE.Mesh(new THREE.SphereGeometry(0.00062 + hash(gI, 5, 1) * 0.0002, 6, 5), grainMat);
      gr.position.set((hash(gI, 1, 4) - 0.5) * 0.0026, 0.002 + gI * 0.00052, (hash(gI, 2, 4) - 0.5) * 0.0018);
      grains.add(gr);
    }
    var plug = new THREE.Mesh(new THREE.SphereGeometry(0.0011, 10, 8), new THREE.MeshStandardMaterial({ color: 0x6b2c14, roughness: 1 }));
    plug.scale.set(1, 1.4, 1); plug.position.y = 0.0012; grains.add(plug);
    canineGroup.add(grains);

    /* ---------- specimen card and scale bar ---------- */
    var card = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.003, 0.22), new THREE.MeshStandardMaterial({ color: 0xd9ccb0, roughness: 1 }));
    card.position.set(0.0, -0.032, 0); root.add(card);
    for (var sb = 0; sb < 5; sb++) {
      var seg = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.0012, 0.004), new THREE.MeshBasicMaterial({ color: sb % 2 ? 0xc9bea6 : 0x2a1512 }));
      seg.position.set(-0.12 + sb * 0.01, -0.0298, 0.095); root.add(seg);
    }

    /* ---------- state and camera ---------- */
    var target = new THREE.Vector3(0, 0.075, 0);
    var view = { theta: 1.15, phi: 1.42, radius: 0.5 };
    var want = { theta: view.theta, phi: view.phi, radius: view.radius, tx: 0, ty: 0.075, tz: 0, explode: 0, drop: 0, see: 1 };
    var cur = { explode: 0, drop: 0, see: 1 };

    function worldOf(obj, v) { obj.updateMatrixWorld(true); return v.clone().applyMatrix4(obj.matrixWorld); }

    function apply() {
      frags.forEach(function (m) { m.position.copy(m.userData.dir).multiplyScalar(cur.explode * 0.03); });
      jaw.position.y = -cur.drop * 0.03;
      boneMat.opacity = cur.see;
      paint.opacity = 0.25 + 0.75 * cur.see;
      camera.position.set(
        target.x + view.radius * Math.sin(view.phi) * Math.cos(view.theta),
        target.y + view.radius * Math.cos(view.phi),
        target.z + view.radius * Math.sin(view.phi) * Math.sin(view.theta));
      camera.lookAt(target);
      renderer.render(scene, camera);
    }
    function look(v, r, th, ph) { want.tx = v.x; want.ty = v.y; want.tz = v.z; want.radius = r; if (th != null) want.theta = th; if (ph != null) want.phi = ph; }

    api.set = function (m) {
      var cast = m === 'cast', apart = m === 'apart', teeth = m === 'teeth', inside = m === 'canine', drilling = m === 'drill';
      plasterSkull.visible = jawPlaster.visible = chinFill.visible = condyleFill.visible = cast;
      chinGhost.visible = condyleGhost.visible = chinEdge.visible = condyleEdge.visible = apart;
      fileMarks.visible = teeth;
      grains.visible = inside;
      bit.visible = curls.visible = hole.visible = skullHole.visible = dust.visible = drilling;
      card.visible = !inside;
      want.explode = apart ? 1 : 0;
      want.drop = apart ? 1 : 0;
      want.see = inside ? 0.18 : 1;
      if (teeth) look(worldOf(jaw, local(0.62, 0.55)), 0.11, 1.5, 0.75);
      else if (inside) look(worldOf(canineGroup, new THREE.Vector3(0, 0.012, 0)), 0.07, 1.05, 1.5);
      else if (drilling) look(worldOf(jaw, local(0.4, 0.5)), 0.26, 1.3, 1.25);
      else if (apart) look(new THREE.Vector3(0, 0.07, 0), 0.52, 0.7, 1.3);
      else look(new THREE.Vector3(0, 0.075, 0), 0.5, 1.15, 1.42);
      kick();
    };

    var anim = null;
    function step() {
      var k = reduce ? 1 : 0.14, done = true;
      function ease(x, y) { var v = x + (y - x) * k; if (Math.abs(y - v) > 0.0003) done = false; else v = y; return v; }
      cur.explode = ease(cur.explode, want.explode); cur.drop = ease(cur.drop, want.drop); cur.see = ease(cur.see, want.see);
      target.x = ease(target.x, want.tx); target.y = ease(target.y, want.ty); target.z = ease(target.z, want.tz);
      view.radius = ease(view.radius, want.radius); view.theta = ease(view.theta, want.theta); view.phi = ease(view.phi, want.phi);
      apply();
      anim = done ? null : requestAnimationFrame(step);
    }
    function kick() { if (!anim) anim = requestAnimationFrame(step); }

    var drag = null;
    canvas.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag) return;
      view.theta += (e.clientX - drag.x) * 0.009; want.theta = view.theta;
      view.phi = Math.min(2.5, Math.max(0.3, view.phi - (e.clientY - drag.y) * 0.007)); want.phi = view.phi;
      drag = { x: e.clientX, y: e.clientY }; apply();
    });
    ['pointerup', 'pointercancel'].forEach(function (n) { canvas.addEventListener(n, function () { drag = null; }); });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault(); want.radius = Math.min(0.9, Math.max(0.05, view.radius * (e.deltaY > 0 ? 1.1 : 0.9))); kick();
    }, { passive: false });
    canvas.addEventListener('keydown', function (e) {
      var used = true;
      if (e.key === 'ArrowLeft') want.theta = view.theta - 0.2;
      else if (e.key === 'ArrowRight') want.theta = view.theta + 0.2;
      else if (e.key === 'ArrowUp') want.phi = Math.max(0.3, view.phi - 0.15);
      else if (e.key === 'ArrowDown') want.phi = Math.min(2.5, view.phi + 0.15);
      else if (e.key === '+' || e.key === '=') want.radius = Math.max(0.05, view.radius * 0.88);
      else if (e.key === '-') want.radius = Math.min(0.9, view.radius * 1.12);
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
    window.__piltdownSpecimen = { ready: true };
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); init(); }
    }, { rootMargin: '300px' });
    io.observe(stage);
  } else init();
})();
