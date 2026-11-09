/* A Splendid Little War? — the USS Maine in Havana Harbor: explosion and investigation. */
(function () {
  'use strict';
  const SLW = window.SLW || {};
  const canvas = document.getElementById('maine');
  if (!canvas) return;
  const stageEl = document.getElementById('maine-stage');
  const labelBox = document.getElementById('maine-labels');
  const copy = document.getElementById('maine-copy');
  const controls = document.getElementById('maine-controls');
  const clock = document.getElementById('maine-clock');
  const flash = document.getElementById('maine-flash');
  const reduce = !!SLW.reduce;
  const stamp = id => { if (SLW.stamp) SLW.stamp(id); };

  /* ---------- Story panel (works even without WebGL) ---------- */
  const TEXT = {
    intro: `<h3>Ten seconds of quiet</h3><p>Most of the crew is asleep below deck in the front of the ship. Captain Charles Sigsbee is in his cabin, writing a letter to his wife. Press the button to see what happened next.</p>`,
    blast: `<h3>9:40 P.M.</h3><p>A small blast, then a huge one, tears through the front of the ship. The bow is thrown upward and the <em>Maine</em> settles into the mud of the harbor within minutes.</p><p><strong>266 of the 355 men aboard die.</strong> Most were enlisted sailors sleeping in the forward part of the ship. Only two of the 26 officers, who slept at the back, were killed.</p><p>Now investigate. Test each theory investigators argued about.</p>`,
    mine: `<h3>Theory A: A mine</h3><div class="theory"><p class="wire who">Backed by: Navy court of inquiry, 1898 · Navy board, 1911</p><p>Divers found part of the ship’s bottom bent <strong>upward and inward</strong>. To the Navy, that meant a blast from outside: a mine under the hull, probably on the port side near the bow.</p><p>The court couldn’t say who placed it. Spain had every reason <em>not</em> to start a war it was likely to lose.</p></div>`,
    fire: `<h3>Theory B: A coal fire</h3><div class="theory"><p class="wire who">Backed by: Admiral Hyman Rickover’s study, 1976</p><p>Warships burned soft coal that could catch fire on its own in hot, stuffy bunkers. On the <em>Maine</em>, <strong>coal bunker A-16</strong> sat right against a magazine packed with gunpowder for the six-inch guns, with one steel wall between them.</p><p>A hidden fire could heat that wall until the powder exploded, blowing the ship apart from the inside. The bent plates, Rickover argued, could come from the magazine blast too.</p></div>`
  };
  let mode = 'intro';
  const seen = new Set();
  function drawPanel() {
    copy.innerHTML = TEXT[mode];
    if (mode === 'intro') controls.innerHTML = `<button type="button" class="btn btn-yellow" data-m="blast">9:40 P.M.</button>`;
    else controls.innerHTML = `
      <button type="button" class="btn${mode === 'mine' ? ' on' : ''}" data-m="mine">Theory A: Mine</button>
      <button type="button" class="btn${mode === 'fire' ? ' on' : ''}" data-m="fire">Theory B: Coal fire</button>
      <button type="button" class="btn" data-m="blast">Replay 9:40</button>`;
  }
  let api = { blast() {}, mine() {}, fire() {}, intro() {} };
  controls.addEventListener('click', e => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    mode = b.dataset.m;
    if (mode === 'blast') { clock.textContent = '9:40 P.M.'; stamp('maine'); }
    if (mode === 'mine' || mode === 'fire') { seen.add(mode); if (seen.size === 2) stamp('theories'); }
    drawPanel();
    api[mode]();
    const f = controls.querySelector(mode === 'blast' ? '[data-m="mine"]' : `[data-m="${mode}"]`);
    if (f) f.focus({ preventScroll: true });
  });
  drawPanel();

  function fallback() {
    canvas.hidden = true;
    const img = document.createElement('img');
    img.src = 'ush9-splendid-little-war/img/maine-divers.jpg'; img.alt = 'The wreck of the Maine in Havana Harbor, 1898';
    img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:grayscale(1) brightness(.6)';
    stageEl.insertBefore(img, stageEl.firstChild);
    const hint = stageEl.querySelector('.drag-hint'); if (hint) hint.hidden = true;
  }

  /* ---------- 3D scene (built when the reader gets close) ---------- */
  function init() {
    if (!window.THREE) { fallback(); return; }
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); } catch (e) { fallback(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x05070c);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070b14, 0.022);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
    const orbit = { r: 17, th: 0.75, ph: 1.22, tx: 0.6, ty: 0.6, tz: 0 };

    scene.add(new THREE.AmbientLight(0x30405f, 0.75));
    scene.add(new THREE.HemisphereLight(0x5a6f99, 0x05070c, 0.45));
    const moon = new THREE.DirectionalLight(0xb7c6e6, 0.75);
    moon.position.set(-30, 40, -25); scene.add(moon);

    /* Sky: stars + moon */
    const starGeo = new THREE.BufferGeometry();
    const sp = [];
    for (let i = 0; i < 1400; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.45;
      sp.push(160 * Math.sin(ph) * Math.cos(th), 160 * Math.cos(ph) + 5, 160 * Math.sin(ph) * Math.sin(th));
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xdfe6f5, size: 0.7, sizeAttenuation: true, fog: false })));
    const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(4, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf3ecd2, fog: false }));
    moonMesh.position.set(-70, 60, -110); scene.add(moonMesh);

    /* Water */
    const waterGeo = new THREE.PlaneGeometry(300, 300, 90, 90);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshPhongMaterial({ color: 0x0b1d31, specular: 0x4a6a96, shininess: 80, flatShading: true, transparent: true, opacity: 1 });
    const water = new THREE.Mesh(waterGeo, waterMat);
    scene.add(water);
    const wpos = waterGeo.attributes.position;
    const wbase = Float32Array.from(wpos.array);

    /* Havana shoreline with lights, Morro Castle lighthouse */
    const shore = new THREE.Mesh(new THREE.BoxGeometry(220, 3, 14), new THREE.MeshLambertMaterial({ color: 0x0b0e16 }));
    shore.position.set(10, 0.6, -62); scene.add(shore);
    const cl = [];
    for (let i = 0; i < 260; i++) cl.push(-60 + Math.random() * 150, 1.4 + Math.random() * 2.2, -55 - Math.random() * 6);
    const cityGeo = new THREE.BufferGeometry(); cityGeo.setAttribute('position', new THREE.Float32BufferAttribute(cl, 3));
    scene.add(new THREE.Points(cityGeo, new THREE.PointsMaterial({ color: 0xffc46b, size: 0.35, fog: false })));
    const morro = new THREE.Group();
    const fort = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 6), new THREE.MeshLambertMaterial({ color: 0x141824 }));
    fort.position.y = 1.5; morro.add(fort);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1, 7, 12), new THREE.MeshLambertMaterial({ color: 0x1b2030 }));
    tower.position.set(2, 6, 0); morro.add(tower);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 12), new THREE.MeshBasicMaterial({ color: 0xfff1c4, fog: false }));
    beacon.position.set(2, 9.8, 0); morro.add(beacon);
    morro.position.set(-58, 0, -40); scene.add(morro);

    /* ---------- The ship ---------- */
    const SPLIT = 1.6;
    const prof = [[-5, 0.45], [-4.7, 0.75], [-4.2, 0.93], [-3.6, 1], [2.4, 1], [3.4, 0.86], [4.2, 0.56], [5, 0.04]];
    function halfW(x) {
      for (let i = 0; i < prof.length - 1; i++) {
        const [x0, w0] = prof[i], [x1, w1] = prof[i + 1];
        if (x >= x0 && x <= x1) return w0 + (w1 - w0) * (x - x0) / (x1 - x0);
      }
      return 0.04;
    }
    function hullGeo(x0, x1) {
      const s = new THREE.Shape();
      const xs = [];
      for (let x = x0; x < x1; x += 0.2) xs.push(x);
      xs.push(x1);
      s.moveTo(xs[0], halfW(xs[0]));
      xs.forEach(x => s.lineTo(x, halfW(x)));
      for (let i = xs.length - 1; i >= 0; i--) s.lineTo(xs[i], -halfW(xs[i]));
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 1.5, bevelEnabled: false, steps: 1 });
      g.rotateX(-Math.PI / 2);
      g.translate(0, -0.7, 0);
      return g;
    }
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.75, metalness: 0.05, transparent: true, opacity: 1 });
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x7b6548, roughness: 0.9, transparent: true, opacity: 1 });
    const buffMat = new THREE.MeshStandardMaterial({ color: 0xc9b383, roughness: 0.8 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.9 });
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.5, metalness: 0.4 });
    const box = (w, h, d, m, x, y, z, parent) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o; };
    const cyl = (r, h, m, x, y, z, parent, rt) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt || r, r, h, 20), m); o.position.set(x, y, z); parent.add(o); return o; };

    const ship = new THREE.Group(); scene.add(ship);
    ship.rotation.y = 0.35;

    // Aft section (stern to the split)
    const aft = new THREE.Group(); ship.add(aft);
    aft.add(new THREE.Mesh(hullGeo(-5, SPLIT), [deckMat, hullMat]));
    box(3.8, 0.55, 1.35, buffMat, -0.7, 1.08, 0, aft);                       // amidships deckhouse
    box(3.9, 0.06, 1.7, deckMat, -0.7, 1.38, 0, aft);                         // hurricane deck
    [0.55, -0.6].forEach(x => {                                               // two funnels, buff with black tops
      cyl(0.23, 1.45, buffMat, x, 2.1, 0, aft);
      cyl(0.24, 0.16, darkMat, x, 2.86, 0, aft);
    });
    const aftMast = cyl(0.06, 3.1, darkMat, -3.0, 2.3, 0, aft); aftMast.userData.mast = true;
    cyl(0.22, 0.22, darkMat, -3.0, 3.3, 0, aft);
    box(0.9, 0.45, 1.1, buffMat, -3.6, 1.02, 0, aft);                       // after deckhouse
    function turret(x, z, dir) {
      const t = cyl(0.4, 0.45, hullMat, x, 1.02, z, aft);
      [-0.13, 0.13].forEach(o => {
        const g = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.2, 10), gunMat);
        g.rotation.z = Math.PI / 2; g.position.set(x + dir * 0.85, 1.05, z + o); aft.add(g);
      });
      return t;
    }
    turret(1.0, 0.68, 1);    // forward turret on the starboard side
    turret(-2.0, -0.68, -1); // after turret on the port side (the Maine's guns were "en echelon")
    [[-1.4, 0.95], [-0.2, -0.95], [-2.4, 0.95]].forEach(([x, z]) => box(0.75, 0.18, 0.28, buffMat, x, 1.48, z, aft)); // boats
    // Ensign on the stern staff
    const flagTex = (function () {
      const c = document.createElement('canvas'); c.width = 76; c.height = 40; const x = c.getContext('2d');
      for (let i = 0; i < 13; i++) { x.fillStyle = i % 2 ? '#f4f1e8' : '#b3261e'; x.fillRect(0, i * 40 / 13, 76, 40 / 13 + 0.5); }
      x.fillStyle = '#25356b'; x.fillRect(0, 0, 32, 21.5);
      x.fillStyle = '#f4f1e8'; for (let r = 0; r < 5; r++) for (let k = 0; k < 9; k++) x.fillRect(2 + k * 3.3, 2 + r * 4, 1.2, 1.2);
      return new THREE.CanvasTexture(c);
    })();
    cyl(0.025, 1.2, darkMat, -5.05, 1.35, 0, aft);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.4), new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide }));
    flag.position.set(-5.45, 1.72, 0); aft.add(flag);

    // Bow section pivots at the bottom of the split so it can be thrown upward
    const bowPivot = new THREE.Group(); bowPivot.position.set(SPLIT, -0.7, 0); ship.add(bowPivot);
    const bow = new THREE.Group(); bow.position.set(-SPLIT, 0.7, 0); bowPivot.add(bow);
    bow.add(new THREE.Mesh(hullGeo(SPLIT, 5), [deckMat, hullMat]));
    box(1.0, 0.6, 1.3, buffMat, 2.7, 1.1, 0, bow);       // forward superstructure
    box(0.55, 0.38, 0.8, buffMat, 2.75, 1.6, 0, bow);    // pilot house
    box(1.3, 0.05, 1.6, deckMat, 2.7, 1.42, 0, bow);     // bridge wings
    cyl(0.07, 3.4, darkMat, 2.15, 2.5, 0, bow);           // military mast
    cyl(0.25, 0.26, darkMat, 2.15, 3.5, 0, bow);          // fighting top
    cyl(0.03, 1.2, darkMat, 4.9, 1.0, 0, bow).rotation.z = -1.1; // bowsprit-style jackstaff

    // Portholes and deck lamps
    const lights = new THREE.Group(); ship.add(lights);
    const ph = [];
    for (let x = -4.4; x <= 4.2; x += 0.32) { const w = halfW(x) + 0.012; ph.push(x, 0.32, w, x, 0.32, -w); }
    const phGeo = new THREE.BufferGeometry(); phGeo.setAttribute('position', new THREE.Float32BufferAttribute(ph, 3));
    lights.add(new THREE.Points(phGeo, new THREE.PointsMaterial({ color: 0xffd38a, size: 0.09 })));
    const lampA = new THREE.PointLight(0xffc77a, 0.9, 7); lampA.position.set(2.7, 2.1, 0); ship.add(lampA);
    const lampB = new THREE.PointLight(0xffc77a, 0.6, 6); lampB.position.set(-4.2, 1.8, 0); ship.add(lampB);
    const mastLamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c4 }));
    mastLamp.position.set(2.15, 4.05, 0); bow.add(mastLamp);

    // Investigation pieces inside the bow
    const bunkerMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, emissive: 0xff4d12, emissiveIntensity: 0, roughness: 1 });
    const magMat = new THREE.MeshStandardMaterial({ color: 0x7a1c14, emissive: 0xff3a10, emissiveIntensity: 0, roughness: 0.8 });
    const bunker = box(0.62, 0.62, 0.55, bunkerMat, 2.25, 0.05, -0.33, bow);
    const wall = box(0.03, 0.66, 0.6, gunMat, 2.58, 0.05, -0.33, bow);
    const magazine = box(0.62, 0.62, 0.55, magMat, 2.91, 0.05, -0.33, bow);
    [bunker, wall, magazine].forEach(o => { o.visible = false; });
    const mine = new THREE.Group();
    const mineBall = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 16), new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.6, roughness: 0.4, emissive: 0x330000 }));
    mine.add(mineBall);
    for (let i = 0; i < 8; i++) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), gunMat);
      const d = new THREE.Vector3().setFromSphericalCoords(0.36, Math.acos(1 - 2 * (i + 0.5) / 8), i * 2.4);
      h.position.copy(d); h.lookAt(d.clone().multiplyScalar(2)); h.rotateX(Math.PI / 2); mine.add(h);
    }
    mine.position.set(2.6, -1.6, -0.75); mine.visible = false; ship.add(mine);
    const shockRings = [0, 1, 2].map(() => {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 40), new THREE.MeshBasicMaterial({ color: 0xff6a3d, transparent: true, opacity: 0, side: THREE.DoubleSide }));
      r.rotation.x = -Math.PI / 2; r.position.set(2.6, -1.0, -0.75); r.visible = false; ship.add(r); return r;
    });

    /* ---------- Explosion particles ---------- */
    const dotTex = (function () {
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
    })();
    function system(n, size, blending, opacity) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const m = new THREE.PointsMaterial({ size, map: dotTex, vertexColors: true, transparent: true, opacity, depthWrite: false, blending });
      const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p);
      return { p, g, n, vel: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n) };
    }
    const fire = system(1100, 0.55, THREE.AdditiveBlending, 1);
    const smoke = system(420, 2.6, THREE.NormalBlending, 0.55);
    const debris = [];
    for (let i = 0; i < 16; i++) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.12 + Math.random() * 0.2, 0.04, 0.1 + Math.random() * 0.2), Math.random() < 0.5 ? hullMat : darkMat);
      d.visible = false; scene.add(d); debris.push({ d, v: new THREE.Vector3(), w: new THREE.Vector3() });
    }
    const fireLight = new THREE.PointLight(0xff7a2e, 0, 45); scene.add(fireLight);
    const origin = new THREE.Vector3();
    function seed(sys, i, strength, smokeKind) {
      const a = sys.g.attributes.position.array;
      a[i * 3] = origin.x + (Math.random() - 0.5) * 0.8; a[i * 3 + 1] = origin.y + Math.random() * 0.4; a[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.8;
      const th = Math.random() * Math.PI * 2, up = smokeKind ? 0.6 + Math.random() * 1.2 : 2 + Math.random() * 9 * strength;
      const out = smokeKind ? Math.random() * 0.6 : Math.random() * 5 * strength;
      sys.vel[i * 3] = Math.cos(th) * out; sys.vel[i * 3 + 1] = up; sys.vel[i * 3 + 2] = Math.sin(th) * out;
      sys.max[i] = sys.life[i] = smokeKind ? 4 + Math.random() * 5 : 0.6 + Math.random() * 1.6;
    }
    function burst() {
      bow.updateMatrixWorld(true);
      origin.set(2.6, 0.4, 0).applyMatrix4(bow.matrixWorld);
      for (let i = 0; i < fire.n; i++) seed(fire, i, 1, false);
      for (let i = 0; i < smoke.n; i++) { seed(smoke, i, 1, true); smoke.life[i] += Math.random() * 3; }
      debris.forEach(o => {
        o.d.visible = true; o.d.position.copy(origin);
        o.v.set((Math.random() - 0.5) * 8, 6 + Math.random() * 9, (Math.random() - 0.5) * 8);
        o.w.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      });
      fireLight.position.copy(origin).add(new THREE.Vector3(0, 1.5, 0));
    }
    const cFire = [new THREE.Color(0xfff4d6), new THREE.Color(0xffa23a), new THREE.Color(0xd2401a), new THREE.Color(0x2a1610)];
    const tmpC = new THREE.Color();
    function stepParticles(sys, dt, smokeKind, respawn) {
      const a = sys.g.attributes.position.array, c = sys.g.attributes.color.array;
      for (let i = 0; i < sys.n; i++) {
        if (sys.life[i] <= 0) {
          if (respawn && Math.random() < (smokeKind ? 0.05 : 0.12)) { seed(sys, i, 0.15, smokeKind); }
          else { a[i * 3 + 1] = -50; continue; }
        }
        sys.life[i] -= dt;
        const k = 1 - Math.max(0, sys.life[i]) / sys.max[i];
        a[i * 3] += sys.vel[i * 3] * dt; a[i * 3 + 1] += sys.vel[i * 3 + 1] * dt; a[i * 3 + 2] += sys.vel[i * 3 + 2] * dt;
        if (smokeKind) { sys.vel[i * 3] += 0.35 * dt; const g = 0.16 + 0.1 * (1 - k); c[i * 3] = g; c[i * 3 + 1] = g; c[i * 3 + 2] = g * 1.05; }
        else {
          sys.vel[i * 3 + 1] -= 6 * dt; sys.vel[i * 3] *= 0.985; sys.vel[i * 3 + 2] *= 0.985;
          const s = k * 3, j = Math.min(2, Math.floor(s));
          tmpC.copy(cFire[j]).lerp(cFire[j + 1], s - j);
          c[i * 3] = tmpC.r; c[i * 3 + 1] = tmpC.g; c[i * 3 + 2] = tmpC.b;
        }
      }
      sys.g.attributes.position.needsUpdate = true; sys.g.attributes.color.needsUpdate = true;
    }
    function clearParticles(sys) { sys.life.fill(0); const a = sys.g.attributes.position.array; for (let i = 0; i < sys.n; i++) a[i * 3 + 1] = -50; sys.g.attributes.position.needsUpdate = true; }

    /* ---------- Labels ---------- */
    const LABELS = {
      bunker: { obj: bunker, text: 'Coal bunker A-16', hot: true },
      magazine: { obj: magazine, text: 'Gunpowder magazine', hot: false },
      mine: { obj: mine, text: 'Mine under the hull', hot: true },
      crew: { obj: null, pos: new THREE.Vector3(3.6, 0.9, 0), text: 'Crew quarters, forward', hot: false },
      officers: { obj: null, pos: new THREE.Vector3(-4.3, 1.4, 0), text: 'Officers’ cabins, aft', hot: false }
    };
    Object.keys(LABELS).forEach(k => {
      const el = document.createElement('span'); el.className = 'mlabel' + (LABELS[k].hot ? ' hot' : ''); el.textContent = LABELS[k].text; el.style.opacity = '0';
      labelBox.appendChild(el); LABELS[k].el = el; LABELS[k].on = false;
    });
    function showLabels(keys) { Object.keys(LABELS).forEach(k => { LABELS[k].on = keys.indexOf(k) > -1; }); }

    /* ---------- State changes ---------- */
    let state = 'intro', T = 0, shake = 0;
    function resetShip() {
      bowPivot.rotation.set(0, 0, 0); bowPivot.position.set(SPLIT, -0.7, 0);
      aft.position.set(0, 0, 0); aft.rotation.set(0, 0, 0);
      lights.visible = true; lampA.intensity = 0.9; lampB.intensity = 0.6; mastLamp.visible = true;
      debris.forEach(o => { o.d.visible = false; });
      clearParticles(fire); clearParticles(smoke); fireLight.intensity = 0;
      hullMat.opacity = 1; deckMat.opacity = 1; hullMat.depthWrite = true; deckMat.depthWrite = true;
      [bunker, wall, magazine].forEach(o => { o.visible = false; });
      bunkerMat.emissiveIntensity = 0; magMat.emissiveIntensity = 0;
      mine.visible = false; shockRings.forEach(r => { r.visible = false; });
      waterMat.opacity = 1; waterMat.depthWrite = true;
    }
    function cutaway() {
      hullMat.opacity = 0.2; deckMat.opacity = 0.25; hullMat.depthWrite = false; deckMat.depthWrite = false;
      waterMat.opacity = 0.45; waterMat.depthWrite = false;
      [bunker, wall, magazine].forEach(o => { o.visible = true; });
    }
    function aim(r, th, ph, ty) { orbitTarget = { r, th, ph, ty }; }
    let orbitTarget = null;

    api = {
      intro() { state = 'intro'; resetShip(); showLabels([]); },
      blast() {
        resetShip(); state = 'blast'; T = 0; shake = 1;
        lights.visible = false; lampA.intensity = 0; lampB.intensity = 0; mastLamp.visible = false;
        burst(); fireLight.intensity = 9;
        if (!reduce) { flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); }
        showLabels([]);
        aim(19, 0.6, 1.2, 0.4);
      },
      mine() {
        resetShip(); state = 'mine'; T = 0; cutaway();
        mine.visible = true; shockRings.forEach(r => { r.visible = true; });
        showLabels(['mine', 'magazine', 'crew']);
        aim(10, 1.15, 1.42, -0.2);
      },
      fire() {
        resetShip(); state = 'fire'; T = 0; cutaway();
        showLabels(['bunker', 'magazine', 'crew', 'officers']);
        aim(9.5, 0.55, 1.05, 0.3);
      }
    };
    if (mode !== 'intro') api[mode]();

    /* ---------- Camera orbit by drag ---------- */
    let dragging = false, lx = 0, ly = 0, idle = 0;
    canvas.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY; orbitTarget = null; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => {
      if (!dragging) return;
      orbit.th -= (e.clientX - lx) * 0.006; orbit.ph = Math.max(0.5, Math.min(1.48, orbit.ph - (e.clientY - ly) * 0.004));
      lx = e.clientX; ly = e.clientY; idle = 0;
    });
    const stop = () => { dragging = false; };
    canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop);

    /* ---------- Size + loop ---------- */
    function resize() {
      const w = stageEl.clientWidth, h = stageEl.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      orbit.zoom = w < 560 ? 1.35 : 1;
    }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stageEl); else window.addEventListener('resize', resize);
    resize();

    const ease = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
    const tmp = new THREE.Vector3();
    let visible = true, raf = 0, last = performance.now();
    function frame(now) {
      raf = 0; if (!visible) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = now / 1000;
      T += dt; idle += dt;

      // Water swell
      const arr = wpos.array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = wbase[i], z = wbase[i + 2];
        arr[i + 1] = Math.sin(x * 0.18 + t * 0.9) * 0.07 + Math.cos(z * 0.23 + t * 1.2) * 0.06;
      }
      wpos.needsUpdate = true;
      beacon.material.color.setScalar(0.5 + 0.5 * Math.max(0, Math.sin(t * 2.2)));
      flag.rotation.y = Math.sin(t * 2) * 0.12;
      ship.position.y = Math.sin(t * 0.8) * 0.03;
      ship.rotation.x = Math.sin(t * 0.6) * 0.008;

      if (state === 'blast') {
        bowPivot.rotation.z = T < 1 ? 0.42 * ease(T) : 0.42 - 0.7 * ease((T - 1) / 6);
        bowPivot.position.y = -0.7 + (T < 1 ? 0.5 * ease(T) : 0.5 - 2.8 * ease((T - 1) / 6));
        aft.position.y = -0.85 * ease((T - 1.5) / 7);
        aft.rotation.x = 0.07 * ease((T - 1.5) / 7);
        fireLight.intensity = Math.max(1.6 + Math.sin(t * 13) * 0.4, 9 * Math.exp(-T * 1.6));
        stepParticles(fire, dt, false, T > 1.6);
        stepParticles(smoke, dt, true, T > 2);
        debris.forEach(o => {
          if (!o.d.visible) return;
          o.v.y -= 9.8 * dt; o.d.position.addScaledVector(o.v, dt);
          o.d.rotation.x += o.w.x * dt; o.d.rotation.y += o.w.y * dt;
          if (o.d.position.y < -0.2) { o.d.position.y = -0.2; o.v.set(0, 0, 0); o.w.set(0, 0, 0); }
        });
        if (T > 1.6) origin.set(2.4, -0.1, 0).applyMatrix4(ship.matrixWorld);
      }
      if (state === 'mine') {
        const rise = ease(T / 1.5);
        mine.position.y = -2.6 + rise * 1.1;
        shockRings.forEach((r, i) => {
          const k = ((T * 0.7 + i / 3) % 1);
          r.scale.setScalar(0.5 + k * 3.2); r.material.opacity = T > 1.2 ? (1 - k) * 0.85 : 0;
        });
        mineBall.material.emissiveIntensity = 0.5 + 0.5 * Math.sin(t * 5);
      }
      if (state === 'fire') {
        const heat = Math.min(1, T / 3);
        bunkerMat.emissiveIntensity = heat * (0.7 + 0.3 * Math.sin(t * 9) * Math.sin(t * 3.7));
        magMat.emissiveIntensity = T > 3 ? Math.min(1.4, (T - 3) / 2.5) * (0.75 + 0.25 * Math.sin(t * 11)) : 0;
      }

      // Camera: glide to a preset, idle drift, shake
      if (orbitTarget) {
        const k = 1 - Math.pow(0.02, dt);
        orbit.r += (orbitTarget.r - orbit.r) * k; orbit.ph += (orbitTarget.ph - orbit.ph) * k; orbit.ty += (orbitTarget.ty - orbit.ty) * k;
        let d = orbitTarget.th - orbit.th; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        orbit.th += d * k;
        if (Math.abs(d) < 0.002 && Math.abs(orbitTarget.r - orbit.r) < 0.02) orbitTarget = null;
      } else if (!dragging && idle > 4 && !reduce) orbit.th += dt * 0.05;
      shake *= Math.pow(0.04, dt);
      const R = orbit.r * (orbit.zoom || 1);
      camera.position.set(
        orbit.tx + R * Math.sin(orbit.ph) * Math.sin(orbit.th) + (reduce ? 0 : (Math.random() - 0.5) * shake * 0.5),
        orbit.ty + R * Math.cos(orbit.ph) + (reduce ? 0 : (Math.random() - 0.5) * shake * 0.5),
        orbit.tz + R * Math.sin(orbit.ph) * Math.cos(orbit.th));
      camera.lookAt(orbit.tx, orbit.ty, orbit.tz);

      // Labels
      const w = stageEl.clientWidth, h = stageEl.clientHeight;
      scene.updateMatrixWorld();
      Object.keys(LABELS).forEach(k => {
        const L = LABELS[k];
        if (!L.on) { L.el.style.opacity = '0'; return; }
        if (L.obj) L.obj.getWorldPosition(tmp); else tmp.copy(L.pos).applyMatrix4(ship.matrixWorld);
        tmp.project(camera);
        L.el.style.transform = `translate(${((tmp.x + 1) / 2 * w).toFixed(1)}px, ${((1 - tmp.y) / 2 * h).toFixed(1)}px) translate(-50%, -140%)`;
        L.el.style.opacity = tmp.z < 1 ? '1' : '0';
      });

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    function play() { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); play(); }).observe(stageEl);
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; play(); });
    play();
  }

  if (SLW.whenNear) SLW.whenNear(stageEl, init); else init();
})();
