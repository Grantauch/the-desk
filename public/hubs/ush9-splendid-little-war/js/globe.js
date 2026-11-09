/* A Splendid Little War? — 3D dotted globe that follows the scroll story. */
(function () {
  'use strict';
  const SLW = window.SLW || {};
  const canvas = document.getElementById('globe');
  if (!canvas) return;
  const stage = canvas.parentElement;
  const labelBox = document.getElementById('globe-labels');
  const fallback = document.getElementById('globe-fallback');
  const reduce = !!SLW.reduce;

  function fail() {
    canvas.hidden = true;
    if (fallback) fallback.hidden = false;
    const hint = stage.querySelector('.globe-hint'); if (hint) hint.hidden = true;
  }
  if (!window.THREE || !window.d3 || !window.topojson || !SLW.world) { fail(); return; }

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
  catch (e) { fail(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 4.2);
  const tilt = new THREE.Group(), spin = new THREE.Group();
  tilt.add(spin); scene.add(tilt);

  const D2R = Math.PI / 180;
  function ll(lat, lon, r) {
    const phi = (90 - lat) * D2R, th = (lon + 180) * D2R;
    return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
  }

  /* Ocean sphere, graticule, atmosphere */
  spin.add(new THREE.Mesh(new THREE.SphereGeometry(0.995, 64, 48), new THREE.MeshBasicMaterial({ color: 0x0c1322 })));
  const gratMat = new THREE.LineBasicMaterial({ color: 0x8fa3c7, transparent: true, opacity: 0.09 });
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts = []; for (let lon = -180; lon <= 180; lon += 4) pts.push(ll(lat, lon, 1.001));
    spin.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gratMat));
  }
  for (let lon = -180; lon < 180; lon += 30) {
    const pts = []; for (let lat = -90; lat <= 90; lat += 4) pts.push(ll(lat, lon, 1.001));
    spin.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gratMat));
  }
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1.16, 64, 48), new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(0x6f8fc4) } },
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 c; varying vec3 vN; void main(){ float i = pow(max(0.0, 0.62 - dot(vN, vec3(0.0, 0.0, 1.0))), 2.4); gl_FragColor = vec4(c * i, i); }',
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
  }));
  scene.add(glow);

  /* Round dot sprite */
  const dotTex = (function () {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); x.arc(16, 16, 14, 0, Math.PI * 2); x.fill();
    const t = new THREE.CanvasTexture(c); return t;
  })();

  /* Places */
  const PLACES = {
    washington: [38.9, -77.04, 'Washington'], keywest: [24.56, -81.78, 'Key West'], havana: [23.14, -82.36, 'Havana'],
    santiago: [20.02, -75.83, 'Santiago'], sanjuan: [18.47, -66.11, 'Puerto Rico'], honolulu: [21.31, -157.86, 'Hawaii'],
    guam: [13.44, 144.79, 'Guam'], manila: [14.6, 120.98, 'Manila'], hongkong: [22.3, 114.17, 'Hong Kong'],
    sf: [37.77, -122.42, 'San Francisco']
  };
  const markers = {};
  const ringGeo = new THREE.RingGeometry(0.018, 0.026, 32);
  const dotGeo = new THREE.SphereGeometry(0.009, 12, 12);
  Object.keys(PLACES).forEach(k => {
    const [lat, lon, name] = PLACES[k];
    const g = new THREE.Group();
    const p = ll(lat, lon, 1.004);
    g.position.copy(p);
    g.lookAt(p.clone().multiplyScalar(2));
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xede9dd, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xede9dd }));
    g.add(ring); g.add(dot); g.visible = false;
    spin.add(g);
    const lab = document.createElement('span'); lab.className = 'glabel'; lab.textContent = name; lab.style.opacity = '0';
    labelBox.appendChild(lab);
    markers[k] = { g, ring, dot, lab, on: false, hot: false };
  });

  /* Arcs */
  const arcMat = new THREE.MeshBasicMaterial({ color: 0xf2c230, transparent: true, opacity: 0.95 });
  let arcs = [];
  function makeArc(a, b) {
    const A = PLACES[a], B = PLACES[b];
    const v1 = ll(A[0], A[1], 1.003), v2 = ll(B[0], B[1], 1.003);
    const ang = v1.angleTo(v2);
    const mid = v1.clone().add(v2).normalize().multiplyScalar(1.003 + ang * 0.32);
    const curve = new THREE.QuadraticBezierCurve3(v1, mid, v2);
    const geo = new THREE.TubeGeometry(curve, 80, 0.0045, 6, false);
    geo.setDrawRange(0, 0);
    const mesh = new THREE.Mesh(geo, arcMat);
    spin.add(mesh);
    return { mesh, geo, total: geo.index.count, p: 0 };
  }
  function clearArcs() { arcs.forEach(a => { spin.remove(a.mesh); a.geo.dispose(); }); arcs = []; }

  /* Story steps */
  const STEPS = [
    { lat: 18, lon: -100, dist: 4.4, places: [], hot: [], arcs: [] },
    { lat: 22, lon: -80, dist: 2.6, places: ['havana', 'keywest', 'washington'], hot: ['havana'], arcs: [['keywest', 'havana']] },
    { lat: 23, lon: -82, dist: 2.25, places: ['havana', 'keywest'], hot: ['havana'], arcs: [] },
    { lat: 17, lon: 118, dist: 2.9, places: ['hongkong', 'manila'], hot: ['manila'], arcs: [['hongkong', 'manila']] },
    { lat: 22, lon: 172, dist: 3.5, places: ['sf', 'honolulu', 'guam', 'manila'], hot: ['guam'], arcs: [['sf', 'honolulu'], ['honolulu', 'guam'], ['guam', 'manila']] },
    { lat: 20, lon: -77, dist: 2.35, places: ['santiago', 'havana'], hot: ['santiago'], arcs: [] },
    { lat: 24, lon: -150, dist: 3.2, places: ['honolulu', 'sf'], hot: ['honolulu'], arcs: [['sf', 'honolulu']] },
    { lat: 19, lon: -68, dist: 2.5, places: ['sanjuan', 'santiago', 'havana'], hot: ['sanjuan'], arcs: [] },
    { lat: 26, lon: -155, dist: 4.3, places: ['washington', 'sanjuan', 'havana', 'honolulu', 'guam', 'manila'], hot: ['sanjuan', 'honolulu', 'guam', 'manila', 'havana'], arcs: [['washington', 'sanjuan'], ['washington', 'havana'], ['washington', 'honolulu'], ['honolulu', 'guam'], ['guam', 'manila']] }
  ];
  const target = { y: 0, x: 0, d: 4.4 };
  let current = -1, dragging = false, userMoved = false;

  function setStep(n) {
    if (n === current) return;
    current = n;
    const S = STEPS[n];
    target.y = -(S.lon + 90) * D2R;
    target.x = S.lat * D2R;
    target.d = S.dist;
    userMoved = false;
    Object.keys(markers).forEach(k => {
      const m = markers[k];
      m.on = S.places.indexOf(k) > -1; m.hot = S.hot.indexOf(k) > -1;
      m.g.visible = m.on;
      const col = m.hot ? 0xf2c230 : 0xede9dd;
      m.ring.material.color.setHex(col); m.dot.material.color.setHex(col);
      m.lab.classList.toggle('hot', m.hot);
    });
    clearArcs();
    arcs = S.arcs.map(a => makeArc(a[0], a[1]));
    if (reduce) arcs.forEach(a => { a.p = 1; a.geo.setDrawRange(0, a.total); });
    document.querySelectorAll('.gstep').forEach(el => el.classList.toggle('active', Number(el.dataset.step) === n));
    if (n === STEPS.length - 1 && SLW.stamp) SLW.stamp('globe');
  }
  // Start already facing the Americas
  spin.rotation.y = -(STEPS[0].lon + 90) * D2R; tilt.rotation.x = STEPS[0].lat * D2R;
  setStep(0);

  /* Scroll → step */
  const stepEls = Array.from(document.querySelectorAll('.gstep'));
  let ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const vh = window.innerHeight, line = window.innerWidth < 900 ? vh * 0.72 : vh * 0.5;
      let best = 0, bestD = Infinity;
      stepEls.forEach(el => {
        const r = el.getBoundingClientRect();
        const c = r.top + r.height / 2;
        if (r.top < line + vh * 0.35) { const d = Math.abs(c - line); if (d < bestD) { bestD = d; best = Number(el.dataset.step); } }
      });
      const first = stepEls[0] && stepEls[0].getBoundingClientRect();
      if (first && first.top > line) best = 0;
      setStep(best);
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  /* Dragging */
  let px = 0, py = 0, vy = 0;
  canvas.addEventListener('pointerdown', e => { dragging = true; px = e.clientX; py = e.clientY; vy = 0; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - px, dy = e.clientY - py; px = e.clientX; py = e.clientY;
    spin.rotation.y += dx * 0.006; vy = dx * 0.006;
    tilt.rotation.x = Math.max(-1.2, Math.min(1.2, tilt.rotation.x + dy * 0.006));
    userMoved = true;
  });
  const end = () => { dragging = false; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  /* Land dots, once the map data arrives */
  SLW.world.then(world => {
    const land = topojson.feature(world, world.objects.countries);
    const W = 2048, H = 1024;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const proj = d3.geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]);
    const path = d3.geoPath(proj, ctx);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); path(land); ctx.fill();
    const HL = new Set(['192', '630', '608', '316']); // Cuba, Puerto Rico, Philippines, Guam
    ctx.fillStyle = '#ff0000';
    land.features.filter(f => HL.has(String(f.id))).forEach(f => { ctx.beginPath(); path(f); ctx.fill(); });
    const px = ctx.getImageData(0, 0, W, H).data;
    const N = window.innerWidth < 700 ? 30000 : 52000;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const base = new THREE.Color(0xe4dcc4), hl = new THREE.Color(0xf2c230);
    const golden = Math.PI * (3 - Math.sqrt(5));
    let n = 0;
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2, rad = Math.sqrt(1 - y * y), th = golden * i;
      const x = Math.cos(th) * rad, z = Math.sin(th) * rad;
      const lat = Math.asin(y) / D2R;
      let lon = Math.atan2(z, -x) / D2R - 180; if (lon < -180) lon += 360;
      const ix = Math.min(W - 1, Math.floor((lon + 180) / 360 * W)), iy = Math.min(H - 1, Math.floor((90 - lat) / 180 * H));
      const k = (iy * W + ix) * 4;
      if (px[k + 3] < 128) continue;
      const hawaii = lat > 18 && lat < 23 && lon > -161 && lon < -154;
      const c = (px[k + 1] < 100 || hawaii) ? hl : base;
      pos[n * 3] = x * 1.0; pos[n * 3 + 1] = y; pos[n * 3 + 2] = z;
      col[n * 3] = c.r; col[n * 3 + 1] = c.g; col[n * 3 + 2] = c.b;
      n++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos.slice(0, n * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col.slice(0, n * 3), 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: window.innerWidth < 700 ? 0.022 : 0.019, map: dotTex, vertexColors: true, transparent: true, alphaTest: 0.4, sizeAttenuation: true }));
    spin.add(pts);
    // Small islands vanish at this dot density; give them a cluster so they read on the globe
    ['guam', 'honolulu', 'sanjuan'].forEach(k => {
      const [lat, lon] = PLACES[k];
      const g = new THREE.BufferGeometry().setFromPoints([ll(lat, lon, 1.002)]);
      spin.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.03, map: dotTex, color: 0xf2c230, transparent: true, alphaTest: 0.4 })));
    });
  }).catch(fail);

  /* Size + render loop */
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
  resize();

  const tmp = new THREE.Vector3();
  function wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
  let visible = true, raf = 0, t0 = performance.now();
  function frame(t) {
    raf = 0;
    if (!visible) return;
    const dt = Math.min(0.05, (t - t0) / 1000); t0 = t;
    const k = reduce ? 1 : 1 - Math.pow(0.0015, dt);
    if (!dragging) {
      if (current === 0 && !reduce) { spin.rotation.y += dt * 0.12; target.y = spin.rotation.y; }
      else if (!userMoved) {
        spin.rotation.y += wrap(target.y - spin.rotation.y) * k;
        tilt.rotation.x += (target.x - tilt.rotation.x) * k;
      } else if (Math.abs(vy) > 0.0005 && !reduce) { spin.rotation.y += vy; vy *= 0.94; }
    }
    // Keep the globe a little smaller on narrow screens
    const narrow = stage.clientWidth < 520 ? 1.18 : 1;
    camera.position.z += (target.d * narrow - camera.position.z) * k;
    // Arcs draw in
    arcs.forEach(a => {
      if (a.p < 1) { a.p = Math.min(1, a.p + dt * 0.9); a.geo.setDrawRange(0, Math.floor(a.p * a.total / 3) * 3); }
    });
    // Markers pulse; labels follow
    const w = stage.clientWidth, h = stage.clientHeight, s = 1 + 0.35 * Math.sin(t / 260);
    scene.updateMatrixWorld();
    Object.keys(markers).forEach(key => {
      const m = markers[key];
      if (!m.on) { m.lab.style.opacity = '0'; return; }
      m.ring.scale.setScalar(m.hot && !reduce ? s : 1);
      m.g.getWorldPosition(tmp);
      const facing = tmp.z > 0.28;
      tmp.project(camera);
      m.lab.style.transform = `translate(${((tmp.x + 1) / 2 * w).toFixed(1)}px, ${((1 - tmp.y) / 2 * h).toFixed(1)}px) translate(-50%, -150%)`;
      m.lab.style.opacity = facing ? '1' : '0';
    });
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  function play() { if (!raf && visible) { t0 = performance.now(); raf = requestAnimationFrame(frame); } }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); play(); }, { rootMargin: '100px 0px' }).observe(stage);
  }
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; play(); });
  play();
})();
