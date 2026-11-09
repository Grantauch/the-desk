/* Over There: the Lusitania, May 7, 1915. Fire the torpedo, then scrub through eighteen minutes. */
(function () {
  'use strict';
  const OT = window.OT || {};
  const canvas = document.getElementById('lusi3d');
  if (!canvas) return;
  const stageEl = document.getElementById('lusi-stage');
  const labelBox = document.getElementById('lusi-labels');
  const copy = document.getElementById('lusi-copy');
  const controls = document.getElementById('lusi-controls');
  const clock = document.getElementById('lusi-clock');
  const gauges = document.getElementById('lusi-gauges');
  const scopeEl = document.getElementById('lusi-scope');
  const flash = document.getElementById('lusi-flash');
  const reduce = !!OT.reduce;
  const tag = id => { if (OT.tag) OT.tag(id); };
  const esc = OT.esc || (s => s);

  /* ---------- Story (works without WebGL) ---------- */
  const BEATS = [
    { m: 0, h: '2:10 P.M.', p: 'The torpedo hits the starboard side just behind the bridge. Seconds later a second, much bigger explosion bursts up from inside the ship. Nobody has ever proven what caused it.' },
    { m: 1, h: 'The lights go out', p: 'Steam pressure drops and the electricity fails. Below decks it is suddenly dark. Passengers in the elevators are trapped between floors. The ship is still moving forward at speed, and it cannot be stopped.' },
    { m: 4, h: 'A fifteen degree list', p: 'Water pours into the starboard side and the ship tilts hard to the right. On the left, the port lifeboats swing in and jam against the hull. On the right, the starboard boats swing so far out that people have to jump the gap to reach them.' },
    { m: 9, h: 'Lowering the boats', p: 'Captain William Turner orders the boats held until the ship slows down. Crew and passengers lower some anyway. Several tip as the ship moves, spilling people into the sea. Of 48 lifeboats, only six get away cleanly, all from the starboard side.' },
    { m: 13, h: 'The bow goes under', p: 'Water reaches the forward decks. People slide down the tilting decks or jump into the cold Atlantic. The four funnels lean over the water.' },
    { m: 15, h: 'Bow on the bottom', p: 'The Lusitania is 787 feet long. The sea here is only about 300 feet deep. Her bow hits the seabed while her stern is still standing up in the air.' },
    { m: 18, h: '2:28 P.M. Gone', p: 'Eighteen minutes after the torpedo, the stern slips under. Fishing boats and steamers from Queenstown, Ireland reach the scene hours later. She settles on her starboard side, where the wreck still lies. 1,198 people die, including 128 Americans and 94 children.' }
  ];
  const INTRO = `<h3>Off the Old Head of Kinsale</h3><p>Friday, May 7, 1915. The <em>Lusitania</em> is six days out of New York and eleven miles off the coast of Ireland, steaming at 18 knots in fog that has just lifted. Most passengers are finishing lunch.</p><p>Seven hundred meters away, Captain Walther Schwieger of the German submarine U-20 is watching through his periscope.</p>`;
  const SECOND = `<h3>The second explosion</h3><p class="wire" style="color:var(--night-soft)">U-20 war diary, May 7, 1915</p><blockquote style="font-style:italic;border-left:3px solid var(--khaki);padding-left:.8rem">“An unusually heavy detonation takes place with a very strong explosion cloud… The explosion of the torpedo must have been followed by a second one (boiler or coal or powder?).”</blockquote><p>Even the man who fired the torpedo was not sure. Tap a marker on the ship to see each theory.</p>`;
  const THEORIES = {
    cargo: ['Munitions in the hold', 'Germany said the ship carried weapons. It did: about 4.2 million rifle cartridges, plus shell casings and fuses. Divers confirmed the cartridges in the wreck. But most experts say rifle ammunition does not explode in one huge blast.'],
    coal: ['Coal dust', 'The torpedo hit near the coal bunkers, which were nearly empty at the end of the voyage and full of fine coal dust. Robert Ballard, who explored the wreck in 1993, argued that the blast kicked the dust into the air and it ignited.'],
    steam: ['A boiler or steam line', 'Cold seawater rushing into a boiler room could make a high pressure steam line or boiler burst. Some engineers think this best explains why the ship lost power almost at once.']
  };
  let mode = 'intro', minute = 0, playing = false;
  const theorySeen = new Set();
  function beatAt(m) { let b = BEATS[0]; BEATS.forEach(x => { if (m >= x.m) b = x; }); return b; }
  function fmtClock(m) { const t = 10 + Math.floor(m); return `2:${String(t).padStart(2, '0')} P.M.`; }
  function drawPanel() {
    if (mode === 'intro' || mode === 'scope') {
      copy.innerHTML = INTRO;
      controls.innerHTML = `<button type="button" class="btn btn-olive" data-a="fire">Fire the torpedo</button><button type="button" class="btn${mode === 'scope' ? ' on' : ''}" data-a="scope" aria-pressed="${mode === 'scope'}">Periscope view</button>`;
      return;
    }
    if (mode === 'second') {
      copy.innerHTML = SECOND + `<div id="lusi-theory" class="note" style="background:var(--night-3)"><p class="wire" style="color:var(--night-soft)">Theories checked: ${theorySeen.size} of 3</p></div>`;
    } else {
      const b = beatAt(minute);
      copy.innerHTML = `<h3>${esc(b.h)}</h3><p>${esc(b.p)}</p>`;
    }
    controls.innerHTML = `
      <label class="wire" for="lusi-min" style="color:var(--night-soft);flex-basis:100%">Minutes after the torpedo: <b id="lusi-min-out" style="color:var(--flare)">${minute.toFixed(0)}</b> of 18</label>
      <input type="range" id="lusi-min" min="0" max="18" step="0.1" value="${minute}" data-desk-skip style="flex-basis:100%;accent-color:#C8B88A">
      <button type="button" class="btn btn-olive" data-a="play">${playing ? 'Pause' : minute >= 18 ? 'Replay' : 'Play'}</button>
      <button type="button" class="btn${mode === 'boats' ? ' on' : ''}" data-a="boats">The lifeboats</button>
      <button type="button" class="btn${mode === 'second' ? ' on' : ''}" data-a="second">Second explosion</button>
      <button type="button" class="btn${mode === 'under' ? ' on' : ''}" data-a="under">Underwater</button>`;
  }
  function setMinute(m, fromSlider) {
    minute = Math.max(0, Math.min(18, m));
    clock.textContent = fmtClock(minute);
    const out = document.getElementById('lusi-min-out'); if (out) out.textContent = minute.toFixed(0);
    const sl = document.getElementById('lusi-min'); if (sl && !fromSlider) sl.value = minute;
    if (mode !== 'second') {
      const b = beatAt(minute), h = copy.querySelector('h3');
      if (h && h.textContent !== b.h) copy.innerHTML = `<h3>${esc(b.h)}</h3><p>${esc(b.p)}</p>`;
    }
    if (minute >= 18) { tag('lusi3d'); if (playing) { playing = false; const pb = controls.querySelector('[data-a="play"]'); if (pb) pb.textContent = 'Replay'; } }
  }
  let api = { fire() {}, scope() {}, view() {}, theory() {}, setMinute() {} };
  controls.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'fire') { mode = 'run'; minute = 0; playing = !reduce; drawPanel(); setMinute(0); api.fire(); return; }
    if (a === 'scope') { mode = mode === 'scope' ? 'intro' : 'scope'; drawPanel(); api.scope(mode === 'scope'); return; }
    if (a === 'play') { if (minute >= 18) setMinute(0); playing = !playing; b.textContent = playing ? 'Pause' : 'Play'; return; }
    if (a === 'boats' || a === 'second' || a === 'under') {
      mode = mode === a ? 'run' : a;
      if (mode === 'boats' && minute < 4) setMinute(5);
      if (mode === 'under' && minute < 14) setMinute(15);
      if (mode === 'second') playing = false;
      drawPanel(); setMinute(minute); api.view(mode);
      const f = controls.querySelector(`[data-a="${a}"]`); if (f) f.focus({ preventScroll: true });
    }
  });
  controls.addEventListener('input', e => { if (e.target.id === 'lusi-min') { playing = false; const pb = controls.querySelector('[data-a="play"]'); if (pb) pb.textContent = 'Play'; setMinute(Number(e.target.value), true); } });
  drawPanel();
  function showTheory(k) {
    theorySeen.add(k);
    const t = THEORIES[k], box = document.getElementById('lusi-theory');
    if (box) box.innerHTML = `<p class="wire" style="color:var(--night-soft)">Theories checked: ${theorySeen.size} of 3</p><h4 style="font-family:var(--font-display);font-size:1.35rem;text-transform:uppercase;color:var(--flare)">${esc(t[0])}</h4><p>${esc(t[1])}</p>`;
    if (theorySeen.size === 3) tag('lusi3d');
  }

  function fallback() {
    canvas.hidden = true;
    const img = document.createElement('img');
    img.src = OT.base + 'img/lusitania.jpg'; img.alt = 'The Lusitania at sea';
    img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:grayscale(1) brightness(.7)';
    stageEl.insertBefore(img, stageEl.firstChild);
    stageEl.querySelectorAll('.drag-hint').forEach(el => { el.hidden = true; });
  }

  /* ---------- 3D ---------- */
  function init() {
    if (!window.THREE) { fallback(); return; }
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); } catch (e) { fallback(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const SKY = new THREE.Color(0xaec3cc), DEEP = new THREE.Color(0x0e3a44);
    renderer.setClearColor(SKY);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(SKY.getHex(), 30, 140);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 500);
    const orbit = { r: 19, th: 1.05, ph: 1.28, tx: 0, ty: 0.3, tz: 0 };

    scene.add(new THREE.HemisphereLight(0xdfeaf0, 0x3a4a48, 0.85));
    const sun = new THREE.DirectionalLight(0xfff3dc, 0.95); sun.position.set(30, 45, 25); scene.add(sun);

    /* Sea surface: translucent, so the sinking hull stays visible below */
    const SEABED = -3.9;
    const waterGeo = new THREE.PlaneGeometry(320, 320, 100, 100); waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshPhongMaterial({ color: 0x2f5d66, specular: 0x5f7d82, shininess: 25, flatShading: true, transparent: true, opacity: 0.78, depthWrite: false, side: THREE.DoubleSide });
    const water = new THREE.Mesh(waterGeo, waterMat); water.renderOrder = 2; scene.add(water);
    const wpos = waterGeo.attributes.position, wbase = Float32Array.from(wpos.array);
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(320, 320, 40, 40), new THREE.MeshLambertMaterial({ color: 0x4d5a4c }));
    bed.rotation.x = -Math.PI / 2; bed.position.y = SEABED; scene.add(bed);
    const bp = bed.geometry.attributes.position;
    for (let i = 0; i < bp.count; i++) bp.setZ(i, (Math.sin(bp.getX(i) * 0.3) + Math.cos(bp.getY(i) * 0.21)) * 0.06);
    bp.needsUpdate = true; bed.geometry.computeVertexNormals();
    // Depth gauge from surface to seabed
    const gauge = new THREE.Group(); gauge.position.set(9.5, 0, 1.6); scene.add(gauge);
    const gMat = new THREE.LineBasicMaterial({ color: 0xe9f7c5, transparent: true, opacity: 0.85 });
    gauge.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, SEABED, 0)]), gMat));
    [0, SEABED].forEach(y => gauge.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.3, y, 0), new THREE.Vector3(0.3, y, 0)]), gMat)));
    gauge.visible = false;

    /* Irish coast to the north, with the Old Head lighthouse */
    const coast = new THREE.Group(); scene.add(coast);
    const cMat = new THREE.MeshLambertMaterial({ color: 0x6f7f68 });
    for (let i = 0; i < 9; i++) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(6 + Math.random() * 5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), cMat);
      hill.scale.y = 0.28 + Math.random() * 0.12; hill.position.set(-70 + i * 18, -0.2, -105 - Math.random() * 10); coast.add(hill);
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(5, 2.2, 3), cMat); head.position.set(-18, 1, -92); coast.add(head);
    const lh = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 2.2, 10), new THREE.MeshLambertMaterial({ color: 0xf2efe6 })); lh.position.set(-18, 3.2, -92); coast.add(lh);

    /* ---------- The ship: bow toward +x, starboard toward +z ---------- */
    const L = 5, SPLITS = 0.56;
    const prof = [[-5, 0.32], [-4.75, 0.46], [-4.2, 0.54], [-3.2, 0.56], [2.6, 0.56], [3.7, 0.46], [4.5, 0.26], [5, 0.03]];
    function halfW(x) { for (let i = 0; i < prof.length - 1; i++) { const [x0, w0] = prof[i], [x1, w1] = prof[i + 1]; if (x >= x0 && x <= x1) return w0 + (w1 - w0) * (x - x0) / (x1 - x0); } return 0.03; }
    function hull(x0, x1, y0, h, scale) {
      const s = new THREE.Shape(), xs = [];
      for (let x = x0; x < x1; x += 0.1) xs.push(x); xs.push(x1);
      s.moveTo(xs[0], halfW(xs[0]) * scale); xs.forEach(x => s.lineTo(x, halfW(x) * scale));
      for (let i = xs.length - 1; i >= 0; i--) s.lineTo(xs[i], -halfW(xs[i]) * scale);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, y0, 0); return g;
    }
    const M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8, metalness: 0.05 }, o || {}));
    const black = M(0x17181a), red = M(0x7d2a1e), white = M(0xeeebe2), deck = M(0xb59a6e), funnelMat = M(0x222326), dark = M(0x111111);
    const box = (w, h, d, m, x, y, z, p) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); p.add(o); return o; };
    const cyl = (r, h, m, x, y, z, p, rt) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt || r, r, h, 20), m); o.position.set(x, y, z); p.add(o); return o; };

    const shipPitch = new THREE.Group(); scene.add(shipPitch);   // pitch (bow down) and depth
    const shipRoll = new THREE.Group(); shipPitch.add(shipRoll);    // list to starboard
    shipRoll.add(new THREE.Mesh(hull(-L, L, -0.45, 0.3, 0.97), red));      // below the waterline
    shipRoll.add(new THREE.Mesh(hull(-L, L, -0.15, 0.95, 1), black));      // black hull to the shelter deck
    shipRoll.add(new THREE.Mesh(hull(-4.6, 4.3, 0.8, 0.03, 0.99), deck));
    // White superstructure in steps
    box(6.6, 0.32, 0.98, white, -0.35, 0.97, 0, shipRoll);
    box(6.2, 0.3, 0.92, white, -0.35, 1.28, 0, shipRoll);
    box(5.4, 0.04, 1.02, deck, -0.45, 1.45, 0, shipRoll);   // boat deck
    box(0.5, 0.3, 0.7, white, 2.75, 1.6, 0, shipRoll);       // bridge
    box(0.1, 0.04, 1.2, white, 2.95, 1.76, 0, shipRoll);     // bridge wings
    // Rows of windows
    const win = [];
    for (let x = -4.4; x <= 4.0; x += 0.12) { const w = halfW(x) + 0.006; [0.25, 0.5].forEach(y => win.push(x, y, w, x, y, -w)); }
    for (let x = -3.5; x <= 2.8; x += 0.14) win.push(x, 1.05, 0.495, x, 1.05, -0.495, x, 1.3, 0.465, x, 1.3, -0.465);
    const winGeo = new THREE.BufferGeometry(); winGeo.setAttribute('position', new THREE.Float32BufferAttribute(win, 3));
    const winMat = new THREE.PointsMaterial({ color: 0x2d3233, size: 0.045 }); shipRoll.add(new THREE.Points(winGeo, winMat));
    // Four funnels, raked aft
    const FUN = [1.95, 0.75, -0.45, -1.65];
    FUN.forEach(x => { const f = cyl(0.21, 1.7, funnelMat, x, 2.25, 0, shipRoll, 0.2); f.rotation.z = 0.07; const t = cyl(0.215, 0.12, dark, x - 0.06, 3.05, 0, shipRoll); t.rotation.z = 0.07; });
    // Masts
    [[4.1, 3.6], [-4.0, 3.4]].forEach(([x, h]) => { const m = cyl(0.035, h, dark, x, 0.85 + h / 2, 0, shipRoll); m.rotation.z = 0.07; });
    // Lifeboats hang from davits on the boat deck. Each one swings to hang straight down as the ship lists.
    const boats = [];
    const boatMat = M(0xf4f1e8), boatIn = M(0x8a6b45);
    for (let i = 0; i < 11; i++) {
      const x = -3.0 + i * 0.52;
      [1, -1].forEach(side => {
        const piv = new THREE.Group(); piv.position.set(x, 1.62, side * 0.5); shipRoll.add(piv);
        const b = new THREE.Group(); piv.add(b);
        const hullB = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.4, 10, 1, false, 0, Math.PI), boatMat);
        hullB.rotation.z = Math.PI / 2; hullB.rotation.y = Math.PI; hullB.position.y = -0.15; b.add(hullB);
        box(0.38, 0.01, 0.13, boatIn, 0, -0.15, 0, b);
        const davit = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.02), dark); davit.position.set(0, 0.03, side * 0.03); piv.add(davit);
        boats.push({ piv, b, side, x });
      });
    }
    // Six boats that got away, rowing clear on the starboard side
    const freeBoats = [];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.42, 10, 1, false, 0, Math.PI), boatMat); hb.rotation.z = Math.PI / 2; hb.rotation.y = Math.PI; g.add(hb);
      box(0.38, 0.01, 0.13, boatIn, 0, 0, 0, g);
      g.visible = false; scene.add(g); freeBoats.push({ g, x: -2.5 + i * 0.9, z: 2.2 + (i % 3) * 0.7, t: 9 + i * 0.6 });
    }
    // The second explosion: three theory markers inside the hull, near where the torpedo hit
    const markMat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.95, depthTest: false });
    const TH = {
      cargo: { pos: new THREE.Vector3(3.6, 0.15, 0), color: 0xe0703a },
      coal: { pos: new THREE.Vector3(2.35, 0.1, 0.36), color: 0xc8b88a },
      steam: { pos: new THREE.Vector3(1.4, -0.05, 0.05), color: 0xe9f7c5 }
    };
    Object.keys(TH).forEach(k => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), markMat(TH[k].color)); m.renderOrder = 5; m.position.copy(TH[k].pos); m.visible = false; m.userData.theory = k; shipRoll.add(m); TH[k].mesh = m; });
    const hitPoint = new THREE.Vector3(2.45, 0.05, 0.57);

    /* U-20's periscope and the torpedo */
    const sub = new THREE.Group(); scene.add(sub);
    const SUBPOS = new THREE.Vector3(9, 0, 27);
    sub.position.copy(SUBPOS);
    cyl(0.05, 1.0, dark, 0, 0.4, 0, sub); box(0.06, 0.06, 0.16, dark, 0, 0.9, -0.06, sub);
    const subWake = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 1.4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
    subWake.rotation.x = -Math.PI / 2; subWake.position.set(0, 0.02, 0.8); sub.add(subWake);
    const torp = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 1.6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    torp.rotation.x = -Math.PI / 2; scene.add(torp);

    /* Particles: water column, smoke, funnel smoke */
    const dotTex = (function () { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    function sys(n, size, opacity, blending) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3).fill(-80), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const p = new THREE.Points(g, new THREE.PointsMaterial({ size, map: dotTex, vertexColors: true, transparent: true, opacity, depthWrite: false, blending: blending || THREE.NormalBlending }));
      p.frustumCulled = false; scene.add(p);
      return { m: p.material, g, n, vel: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n), kind: new Uint8Array(n) };
    }
    const spray = sys(700, 0.42, 0.95), smoke = sys(320, 1.7, 0.5), fsmoke = sys(160, 1.1, 0.35);
    const smokeMat = smoke.m;
    const tmpV = new THREE.Vector3();
    function emitBlast(strength) {
      shipRoll.updateMatrixWorld(true);
      tmpV.copy(hitPoint).applyMatrix4(shipRoll.matrixWorld);
      const a = spray.g.attributes.position.array, c = spray.g.attributes.color.array;
      for (let i = 0; i < spray.n; i++) {
        if (spray.life[i] > 0 && Math.random() < 0.5) continue;
        a[i * 3] = tmpV.x + (Math.random() - 0.5) * 0.6; a[i * 3 + 1] = tmpV.y + Math.random() * 0.3; a[i * 3 + 2] = tmpV.z + Math.random() * 0.4;
        spray.vel[i * 3] = (Math.random() - 0.5) * 1.6 * strength; spray.vel[i * 3 + 1] = (3 + Math.random() * 7) * strength; spray.vel[i * 3 + 2] = (0.4 + Math.random() * 1.8) * strength;
        spray.max[i] = spray.life[i] = 1 + Math.random() * 1.6;
        const dirty = strength > 1 && Math.random() < 0.35; spray.kind[i] = dirty ? 1 : 0;
        const v = dirty ? 0.25 + Math.random() * 0.15 : 0.92 + Math.random() * 0.08; c[i * 3] = v; c[i * 3 + 1] = v; c[i * 3 + 2] = dirty ? v : v * 1.02;
      }
      const s = smoke.g.attributes.position.array;
      for (let i = 0; i < smoke.n; i++) {
        if (smoke.life[i] > 0 && Math.random() < 0.6) continue;
        s[i * 3] = tmpV.x + (Math.random() - 0.5); s[i * 3 + 1] = tmpV.y + 0.5 + Math.random(); s[i * 3 + 2] = tmpV.z + Math.random() * 0.6;
        smoke.vel[i * 3] = -0.4 - Math.random() * 0.4; smoke.vel[i * 3 + 1] = 0.6 + Math.random() * 1.6 * strength; smoke.vel[i * 3 + 2] = Math.random() * 0.4;
        smoke.max[i] = smoke.life[i] = 5 + Math.random() * 6;
      }
    }
    function stepSys(S, dt, gravity, colorFn) {
      const a = S.g.attributes.position.array, c = S.g.attributes.color.array;
      for (let i = 0; i < S.n; i++) {
        if (S.life[i] <= 0) { a[i * 3 + 1] = -80; continue; }
        S.life[i] -= dt;
        a[i * 3] += S.vel[i * 3] * dt; a[i * 3 + 1] += S.vel[i * 3 + 1] * dt; a[i * 3 + 2] += S.vel[i * 3 + 2] * dt;
        S.vel[i * 3 + 1] -= gravity * dt;
        if (gravity && a[i * 3 + 1] < 0) S.life[i] = 0;
        if (colorFn) colorFn(c, i, 1 - S.life[i] / S.max[i]);
      }
      S.g.attributes.position.needsUpdate = true; S.g.attributes.color.needsUpdate = true;
    }
    const smokeColor = (c, i, k) => { const g = 0.18 + 0.32 * k; c[i * 3] = g; c[i * 3 + 1] = g; c[i * 3 + 2] = g; };
    const fsColor = (c, i, k) => { const g = 0.25 + 0.4 * k; c[i * 3] = g; c[i * 3 + 1] = g; c[i * 3 + 2] = g * 1.02; };
    let fsAcc = 0;
    function funnelSmoke(dt, rate) {
      fsAcc += dt * rate;
      const a = fsmoke.g.attributes.position.array;
      while (fsAcc > 1) {
        fsAcc -= 1;
        const i = Math.floor(Math.random() * fsmoke.n); const fx = FUN[Math.floor(Math.random() * 4)];
        tmpV.set(fx - 0.1, 3.15, 0).applyMatrix4(shipRoll.matrixWorld);
        a[i * 3] = tmpV.x; a[i * 3 + 1] = tmpV.y; a[i * 3 + 2] = tmpV.z;
        fsmoke.vel[i * 3] = -1.6 - Math.random() * 0.6; fsmoke.vel[i * 3 + 1] = 0.35 + Math.random() * 0.3; fsmoke.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
        fsmoke.max[i] = fsmoke.life[i] = 3 + Math.random() * 2;
      }
    }

    /* Labels */
    const LABELS = {
      hit: { pos: hitPoint, text: 'Torpedo hits here', hot: true },
      bridge: { pos: new THREE.Vector3(2.75, 1.9, 0), text: 'Bridge', hot: false },
      port: { pos: new THREE.Vector3(-0.4, 1.5, -0.62), text: 'Port boats jammed against the hull', hot: false },
      stbd: { pos: new THREE.Vector3(-0.4, 1.3, 0.75), text: 'Starboard boats swing far out', hot: true },
      sub: { world: SUBPOS.clone().add(new THREE.Vector3(0, 1.1, 0)), text: 'U-20, 700 meters away', hot: true },
      bed: { world: new THREE.Vector3(9.5, SEABED, 1.6), text: 'Seabed, about 300 feet down', hot: false },
      surface: { world: new THREE.Vector3(9.5, 0.05, 1.6), text: 'Surface', hot: false },
      cargo: { pos: TH.cargo.pos, text: 'Cargo hold', hot: false, theory: 'cargo' },
      coal: { pos: TH.coal.pos, text: 'Coal bunkers', hot: false, theory: 'coal', below: true },
      steam: { pos: TH.steam.pos, text: 'Boiler rooms', hot: false, theory: 'steam' }
    };
    Object.keys(LABELS).forEach(k => {
      const Lb = LABELS[k];
      const el = document.createElement(Lb.theory ? 'button' : 'span');
      el.className = 'mlabel' + (Lb.hot ? ' hot' : '') + (Lb.theory ? ' tbtn' : '');
      el.textContent = Lb.text; el.style.opacity = '0';
      if (Lb.theory) { el.type = 'button'; el.tabIndex = -1; el.addEventListener('click', () => showTheory(Lb.theory)); }
      labelBox.appendChild(el); Lb.el = el; Lb.on = false;
    });
    function showLabels(keys) { Object.keys(LABELS).forEach(k => { LABELS[k].on = keys.indexOf(k) > -1; LABELS[k].el.tabIndex = LABELS[k].on && LABELS[k].theory ? 0 : -1; }); }
    showLabels(['sub']);

    /* Sinking keyframes: minute, bow down pitch in degrees, depth of the ship's center, list in degrees */
    const KF = [[0, 0, 0, 0], [1, 0.4, -0.06, 3], [4, 2.5, -0.25, 15], [9, 5, -0.55, 15], [12, 10, -1.0, 16], [13.5, 18, -1.45, 18], [15, 26, -1.7, 20]];
    const D = Math.PI / 180;
    function pose(m) {
      if (m <= 15) {
        let i = 0; while (i < KF.length - 2 && m > KF[i + 1][0]) i++;
        const a = KF[i], b = KF[i + 1], k = Math.max(0, Math.min(1, (m - a[0]) / (b[0] - a[0])));
        return { pitch: a[1] + (b[1] - a[1]) * k, y: a[2] + (b[2] - a[2]) * k, roll: a[3] + (b[3] - a[3]) * k };
      }
      // Bow resting on the bottom: the stern settles until it slips under
      // then she settles onto her starboard side, the way the wreck still lies
      const k = Math.min(1, (m - 15) / 3);
      const pitch = 26 - 23 * k;
      return { pitch, y: SEABED + 0.5 + L * Math.sin(pitch * D), roll: 20 + 50 * k };
    }
    let fired = false, T = 0, shake = 0, view = 'run', blasts = 0;
    let orbitTarget = { r: 19, th: 1.05, ph: 1.28, ty: 0.3 };
    function aim(r, th, ph, ty, tx) { orbitTarget = { r, th, ph, ty, tx: tx || 0 }; }
    api = {
      fire() {
        fired = true; T = 0; blasts = 0; view = 'run'; scopeOn(false);
        torp.material.opacity = 0.85; aim(17, 0.9, 1.3, 0.2); showLabels(['sub']);
      },
      scope(on) { scopeOn(on); },
      view(v) {
        view = v;
        Object.keys(TH).forEach(k => { TH[k].mesh.visible = v === 'second'; });
        black.transparent = red.transparent = v === 'second'; black.opacity = red.opacity = v === 'second' ? 0.28 : 1;
        black.depthWrite = red.depthWrite = v !== 'second';
        white.transparent = deck.transparent = funnelMat.transparent = v === 'second'; white.opacity = deck.opacity = funnelMat.opacity = v === 'second' ? 0.3 : 1;
        white.depthWrite = deck.depthWrite = funnelMat.depthWrite = v !== 'second';
        smokeMat.opacity = v === 'second' ? 0.12 : 0.5;
        gauge.visible = v === 'under' || minute >= 13;
        if (v === 'boats') { aim(6.5, 0.18, 1.3, 1.0); showLabels(['port', 'stbd']); }
        else if (v === 'second') { aim(8.5, 0.12, 1.35, 0.3, 2.0); showLabels(['cargo', 'coal', 'steam']); }
        else if (v === 'under') { aim(17, 0.1, 1.6, -1.9, 1.5); showLabels(['bed', 'surface']); }
        else { aim(17, 0.9, 1.3, 0.2); showLabels(minute < 3 ? ['hit', 'bridge'] : []); }
      }
    };
    let scope = false;
    function scopeOn(on) {
      scope = !!on; scopeEl.hidden = !scope;
      showLabels(scope ? [] : (fired ? [] : ['sub']));
    }
    api.setMinute = () => {};

    /* Drag to orbit */
    let dragging = false, lx = 0, ly = 0, idle = 0;
    canvas.addEventListener('pointerdown', e => { if (scope) return; dragging = true; lx = e.clientX; ly = e.clientY; orbitTarget = null; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => {
      if (!dragging) return;
      orbit.th -= (e.clientX - lx) * 0.006; orbit.ph = Math.max(0.35, Math.min(1.75, orbit.ph - (e.clientY - ly) * 0.004));
      lx = e.clientX; ly = e.clientY; idle = 0;
    });
    const stop = () => { dragging = false; };
    canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop);

    function resize() {
      const w = stageEl.clientWidth, h = stageEl.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); orbit.zoom = w < 560 ? 1.4 : 1;
    }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stageEl); else window.addEventListener('resize', resize);
    resize();

    const tmp = new THREE.Vector3(), fogCol = new THREE.Color();
    let visible = true, raf = 0, last = performance.now();
    function frame(now) {
      raf = 0; if (!visible) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = now / 1000; idle += dt;
      // swell
      const arr = wpos.array;
      for (let i = 0; i < arr.length; i += 3) { const x = wbase[i], z = wbase[i + 2]; arr[i + 1] = Math.sin(x * 0.16 + t * 0.8) * 0.06 + Math.cos(z * 0.2 + t * 1.1) * 0.05; }
      wpos.needsUpdate = true;

      // Torpedo run, then the two explosions, then the clock
      if (fired) {
        T += dt;
        const run = Math.min(1, T / 3.2);
        shipRoll.updateMatrixWorld(true);
        const target = tmp.copy(hitPoint).applyMatrix4(shipRoll.matrixWorld);
        const p = SUBPOS.clone().lerp(new THREE.Vector3(target.x, 0.02, target.z), run);
        torp.position.copy(p); torp.position.y = 0.03;
        torp.rotation.z = Math.atan2(SUBPOS.x - target.x, SUBPOS.z - target.z);
        if (run >= 1 && blasts === 0) {
          blasts = 1; torp.material.opacity = 0; emitBlast(1); shake = 0.6;
          if (!reduce) { flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); }
          showLabels(['hit', 'bridge']);
        }
        if (blasts === 1 && T > 4.2) { blasts = 2; emitBlast(1.7); shake = 1.2; if (!reduce) { flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); } }
        if (blasts === 2 && playing && view !== 'second') setMinute(minute + dt * (reduce ? 18 : 0.5));
      }
      const P = pose(fired ? minute : 0);
      shipPitch.position.y = P.y + Math.sin(t * 0.7) * (fired ? 0 : 0.03);
      shipPitch.rotation.z = -P.pitch * D;
      shipRoll.rotation.x = P.roll * D;
      gauge.visible = view === 'under' || (fired && minute >= 13);
      // Lifeboats hang straight down whatever the list
      boats.forEach(o => {
        o.b.rotation.x = -P.roll * D;
        o.b.visible = !(fired && minute > 9 && o.side === 1 && Math.abs(o.x - 0.1) < 1.4); // six starboard boats lowered away
      });
      freeBoats.forEach(o => {
        const show = fired && minute >= o.t;
        o.g.visible = show;
        if (show) { const drift = Math.min(1, (minute - o.t) / 6); o.g.position.set(o.x - drift * 0.6, 0.05 + Math.sin(t * 1.3 + o.x) * 0.03, o.z + drift * 2.2); }
      });
      // Smoke from the funnels while she still has steam
      if (!fired || minute < 12) funnelSmoke(dt, fired ? Math.max(0, 14 - minute) : 14);
      stepSys(fsmoke, dt, 0, fsColor);
      stepSys(spray, dt, 9.8, null);
      stepSys(smoke, dt, -0.05, smokeColor);
      if (fired && blasts >= 1 && minute < 3 && Math.random() < dt * 1.2) emitBlast(0.2);

      // Camera
      if (scope) {
        camera.position.set(SUBPOS.x, 0.9, SUBPOS.z);
        camera.lookAt(0, 0.9, 0);
        if (camera.fov !== 24) { camera.fov = 24; camera.updateProjectionMatrix(); }
      } else {
        if (camera.fov !== 40) { camera.fov = 40; camera.updateProjectionMatrix(); }
        if (orbitTarget) {
          const k = 1 - Math.pow(0.03, dt);
          orbit.r += (orbitTarget.r - orbit.r) * k; orbit.ph += (orbitTarget.ph - orbit.ph) * k; orbit.ty += (orbitTarget.ty - orbit.ty) * k; orbit.tx += ((orbitTarget.tx || 0) - orbit.tx) * k;
          let d = orbitTarget.th - orbit.th; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; orbit.th += d * k;
          if (Math.abs(d) < 0.002 && Math.abs(orbitTarget.r - orbit.r) < 0.02) orbitTarget = null;
        } else if (!dragging && idle > 5 && !reduce && view !== 'second' && view !== 'boats') orbit.th += dt * 0.04;
        shake *= Math.pow(0.05, dt);
        const R = orbit.r * (orbit.zoom || 1), j = reduce ? 0 : shake * 0.4;
        const ty = view === 'under' ? orbit.ty : orbit.ty + (fired ? Math.min(0, P.y * 0.5) : 0);
        camera.position.set(orbit.tx + R * Math.sin(orbit.ph) * Math.sin(orbit.th) + (Math.random() - 0.5) * j, ty + R * Math.cos(orbit.ph) + (Math.random() - 0.5) * j, orbit.tz + R * Math.sin(orbit.ph) * Math.cos(orbit.th));
        camera.lookAt(orbit.tx, ty, orbit.tz);
      }
      // Under the surface the world turns green and dim
      const under = camera.position.y < 0;
      stageEl.classList.toggle('dim', under || scope);
      fogCol.copy(under ? DEEP : SKY);
      scene.fog.color.copy(fogCol); renderer.setClearColor(fogCol);
      scene.fog.near = under ? 2 : 30; scene.fog.far = under ? 34 : 140;

      // Labels
      const w = stageEl.clientWidth, h = stageEl.clientHeight;
      scene.updateMatrixWorld();
      Object.keys(LABELS).forEach(k => {
        const Lb = LABELS[k];
        if (!Lb.on) { Lb.el.style.opacity = '0'; Lb.el.style.pointerEvents = 'none'; return; }
        if (Lb.world) tmp.copy(Lb.world); else tmp.copy(Lb.pos).applyMatrix4(shipRoll.matrixWorld);
        tmp.project(camera);
        Lb.el.style.transform = `translate(${((tmp.x + 1) / 2 * w).toFixed(1)}px, ${((1 - tmp.y) / 2 * h).toFixed(1)}px) translate(-50%, ${Lb.below ? '45%' : '-140%'})`;
        const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
        Lb.el.style.opacity = vis ? '1' : '0'; Lb.el.style.pointerEvents = vis && Lb.theory ? 'auto' : 'none';
      });
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    function play() { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); play(); }).observe(stageEl);
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; play(); });
    play();
  }
  if (OT.whenNear) OT.whenNear(stageEl, init); else init();

  // Gauges in the corner track the list and the boats
  function gaugeLoop() {
    if (gauges) {
      const P = mode === 'intro' || mode === 'scope' ? null : minute;
      if (P === null) gauges.textContent = '18 knots · course east';
      else {
        const list = minute < 1 ? Math.round(minute * 3) : minute < 4 ? Math.round(3 + (minute - 1) * 4) : minute < 12 ? 15 : minute < 15 ? Math.round(15 + (minute - 12) * 1.7) : Math.round(20 + 50 * Math.min(1, (minute - 15) / 3));
        gauges.textContent = `List ${list}° to starboard · boats away ${minute < 9 ? 0 : Math.min(6, Math.floor((minute - 9) / 0.6) + 1)} of 48`;
      }
    }
    requestAnimationFrame(gaugeLoop);
  }
  gaugeLoop();
})();
