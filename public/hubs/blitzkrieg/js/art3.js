// Art for the five newer guns and their upgrade forms. Uses the hooks art2.js exposes in BK.Art._f.
// Bases are drawn once into art2's cache; weapon drawings are deterministic (seeded scatter only),
// so they can be cached at a few recoil values.
(function (root) {
  const BK = root.BK;
  const A = BK && BK.Art;
  if (!A || !A._f || !A._h) return;
  const { rr, poly, fillStroke, shade, sandbags, hullGrad, OUT } = A._h;
  const { W, VEH, BASE_R, blob, crate, tracks } = A._f;
  const TAU = Math.PI * 2;
  const BASES = A.BASES || (A.BASES = {});

  const P = {
    tunic: "#6e6a44", tunicL: "#8e885b", tunicD: "#46432a", trous: "#5c5839",
    skin: "#d2a780", boot: "#2a2016", strap: "#3f321f", pack: "#5e4e32",
    steel: "#3a4036", steelL: "#626a5a", steelD: "#1f231c",
    wood: "#7a5a36", woodL: "#a37d4e", woodD: "#4a3420",
    dirt: "#6b5a3c", dirtL: "#8e7852", dirtD: "#3a2d1d", pit: "#241b11",
    brass: "#c49a3e", brassL: "#ecd07a", olive: "#4e5a33", oliveL: "#7c8a5c",
  };

  // ------------------------------------------------------------------ small helpers
  function lin(c, x0, y0, x1, y1, stops) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
    return g;
  }
  function rad(c, x, y, r0, r1, stops, ox, oy) {
    const g = c.createRadialGradient(x + (ox || 0), y + (oy || 0), r0, x, y, r1);
    stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
    return g;
  }
  function line(c, x0, y0, x1, y1, col, w) {
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1);
    c.strokeStyle = col; c.lineWidth = w; c.stroke();
  }
  function ell(c, x, y, rx, ry, a, fill, lw) {
    c.beginPath(); c.ellipse(x, y, rx, ry, a || 0, 0, TAU);
    if (lw === undefined) { c.fillStyle = fill; c.fill(); } else fillStroke(c, fill, lw);
  }
  // A lumpy closed shape around a centre, for spoil heaps and berms.
  function lumpy(c, x, y, rx, ry, n, jit, seed) {
    const r = BK.makeRng(seed);
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU, j = 1 + (i === n ? 0 : (r() - 0.5) * jit);
      const px = x + Math.cos(a) * rx * j, py = y + Math.sin(a) * ry * j;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
  }
  function bag(c, x, y, a, tone, w, h) {
    c.save(); c.translate(x, y); c.rotate(a);
    w = w || 10; h = h || 6.2;
    rr(c, -w / 2, -h / 2, w, h, h / 2);
    c.fillStyle = `rgb(${tone},${tone - 18},${tone - 58})`; c.fill();
    c.strokeStyle = "rgba(60,48,28,0.85)"; c.lineWidth = 0.9; c.stroke();
    c.strokeStyle = "rgba(255,240,200,0.22)"; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(-w / 2 + 1.6, -h / 2 + 1.3); c.lineTo(w / 2 - 1.6, -h / 2 + 1.3); c.stroke();
    c.strokeStyle = "rgba(50,40,24,0.45)"; c.lineWidth = 0.5;
    c.beginPath(); c.moveTo(w / 2 - 2, -h / 2 + 0.8); c.lineTo(w / 2 - 2, h / 2 - 0.8); c.stroke();
    c.restore();
  }
  function bagArc(c, cx, cy, r, a0, a1, n, seed, size) {
    const g = BK.makeRng(seed);
    for (let i = 0; i < n; i++) {
      const a = n === 1 ? a0 : a0 + ((a1 - a0) * i) / (n - 1);
      bag(c, cx + Math.cos(a) * r, cy + Math.sin(a) * r, a + Math.PI / 2, 146 + Math.floor(g() * 34), size || 10, (size || 10) * 0.62);
    }
  }
  function tufts(c, seed, n, r0, r1) {
    const g = BK.makeRng(seed);
    c.lineWidth = 0.7; c.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const a = g() * TAU, d = r0 + g() * (r1 - r0), x = Math.cos(a) * d, y = Math.sin(a) * d;
      c.strokeStyle = g.pick(["#56622f", "#6d7a3c", "#465226", "#7f8a48"]);
      c.beginPath();
      for (let k = -1; k <= 1; k++) { c.moveTo(x, y); c.lineTo(x + k * 1.4 + g() * 0.6, y - 2 - g() * 1.6); }
      c.stroke();
    }
  }
  function casings(c, seed, n, x, y, spread) {
    const g = BK.makeRng(seed);
    for (let i = 0; i < n; i++) {
      c.save(); c.translate(x + (g() - 0.5) * spread, y + (g() - 0.5) * spread); c.rotate(g() * TAU);
      c.fillStyle = P.brass; c.fillRect(-0.8, -0.35, 1.6, 0.7);
      c.restore();
    }
  }
  function plankRect(c, x, y, w, h, seed, horiz) {
    rr(c, x, y, w, h, 1.2);
    fillStroke(c, lin(c, x, y, x + w, y + h, [P.woodL, P.wood, P.woodD]), 1.1);
    c.save(); rr(c, x, y, w, h, 1.2); c.clip();
    const g = BK.makeRng(seed);
    c.strokeStyle = "rgba(30,20,10,0.5)"; c.lineWidth = 0.55;
    if (horiz) for (let yy = y + 3; yy < y + h; yy += 3.2) { c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke(); }
    else for (let xx = x + 3; xx < x + w; xx += 3.2) { c.beginPath(); c.moveTo(xx, y); c.lineTo(xx, y + h); c.stroke(); }
    c.fillStyle = "rgba(255,230,180,0.08)";
    for (let i = 0; i < 6; i++) c.fillRect(x + g() * w, y + g() * h, 2 + g() * 4, 0.6);
    c.restore();
  }

  // ------------------------------------------------------------------ figures
  function helmet(c, x, y, r) {
    r = r || 3.3;
    blob(c, x + 0.5, y + 0.7, r + 0.6, "rgba(0,0,0,0.28)");
    c.beginPath(); c.arc(x, y, r + 0.55, 0, TAU); fillStroke(c, "#3c3e26", 0.8);
    c.beginPath(); c.arc(x, y, r, 0, TAU);
    c.fillStyle = rad(c, x, y, 0.2, r, ["#a6a874", "#686c43", "#3e4028"], -r * 0.4, -r * 0.4); c.fill();
    blob(c, x - r * 0.38, y - r * 0.38, r * 0.28, "rgba(255,255,220,0.35)");
  }
  // The rogatywka: a four cornered crown with corners fore, aft and to the sides.
  function roga(c, x, y, r, officer) {
    r = r || 3.4;
    blob(c, x + 0.5, y + 0.7, r + 0.4, "rgba(0,0,0,0.28)");
    c.beginPath(); c.arc(x, y, r * 0.82, 0, TAU); fillStroke(c, "#2e2c1e", 0.7);
    c.beginPath(); c.ellipse(x + r * 0.78, y, r * 0.38, r * 0.72, 0, -Math.PI / 2, Math.PI / 2); c.fillStyle = "#181610"; c.fill();
    c.save(); c.translate(x, y); c.rotate(Math.PI / 4);
    rr(c, -r * 0.92, -r * 0.92, r * 1.84, r * 1.84, r * 0.3);
    fillStroke(c, lin(c, -r, -r, r, r, ["#a59d6a", "#7a7349", "#4f4a2e"]), 0.7);
    c.restore();
    c.strokeStyle = "rgba(0,0,0,0.35)"; c.lineWidth = 0.45;
    c.beginPath(); c.moveTo(x - r * 1.2, y); c.lineTo(x + r * 1.2, y); c.moveTo(x, y - r * 1.2); c.lineTo(x, y + r * 1.2); c.stroke();
    if (officer) {
      // Silver braid round the crown and a darker band for the staff officer.
      c.save(); c.translate(x, y); c.rotate(Math.PI / 4);
      rr(c, -r * 0.62, -r * 0.62, r * 1.24, r * 1.24, r * 0.2); c.strokeStyle = "rgba(215,212,190,0.55)"; c.lineWidth = 0.35; c.stroke();
      c.restore();
    }
    blob(c, x + r * 0.55, y, 0.6, "#e2dfd0");
  }
  // One soldier, top down, facing +x. pose: stand, kneel, prone. arms: hand points in the man's frame.
  function man(c, x, y, a, o) {
    o = o || {};
    const pose = o.pose || "stand";
    const tun = o.tunic || P.tunic;
    c.save(); c.translate(x, y); c.rotate(a || 0);
    if (pose === "prone") {
      ell(c, -5, 1.2, 12, 5, 0, "rgba(0,0,0,0.22)");
      c.lineCap = "round";
      for (const s of [-1, 1]) {
        line(c, -5, s * 1.5, -15, s * 3.6 + (o.spread || 0) * s, P.tunicD, 3.4);
        line(c, -5, s * 1.5, -15, s * 3.6 + (o.spread || 0) * s, P.trous, 2.6);
        blob(c, -16, s * 3.8 + (o.spread || 0) * s, 1.6, P.boot);
      }
      ell(c, -1, 0, 6.4, 4.4, 0, shade(c, -7, -4.4, 12, 8.8, tun, P.tunicL, P.tunicD), 0.9);
      line(c, -4.6, -4, -4.6, 4, P.strap, 0.9);
      if (o.pack !== false) { rr(c, -6.6, -2.6, 3.6, 5.2, 1.2); fillStroke(c, P.pack, 0.6); }
    } else if (pose === "kneel") {
      ell(c, 0, 1.2, 7, 6.5, 0, "rgba(0,0,0,0.22)");
      c.lineCap = "round";
      line(c, 0, 3, 5.5, 3.6, P.tunicD, 3.2); line(c, 0, 3, 5.5, 3.6, P.trous, 2.4);
      line(c, -1, -3, -7, -3.2, P.tunicD, 3); line(c, -1, -3, -7, -3.2, P.trous, 2.2);
      blob(c, -7.6, -3.2, 1.5, P.boot);
      ell(c, 0, 0, 4.2, 5.3, 0, shade(c, -4, -5, 8, 10, tun, P.tunicL, P.tunicD), 0.9);
      if (o.pack !== false) { rr(c, -5.2, -2.6, 3, 5.2, 1.1); fillStroke(c, P.pack, 0.6); }
    } else {
      ell(c, 0.6, 1.2, 5, 6.2, 0, "rgba(0,0,0,0.22)");
      ell(c, 0, 0, 3.8, 5.5, 0, shade(c, -4, -5.5, 8, 11, tun, P.tunicL, P.tunicD), 0.9);
      if (o.pack) { rr(c, -4.8, -2.6, 3, 5.2, 1.1); fillStroke(c, P.pack, 0.6); }
      if (o.belt) line(c, -3.4, -3.4, 3.2, 3.6, "#3a2a18", 0.9);
    }
    const sh = pose === "prone" ? [3, 3.4] : [0.6, 4.2];
    if (o.arms) {
      c.lineCap = "round";
      o.arms.forEach((h, i) => {
        if (!h) return;
        const sy = i === 0 ? -sh[1] : sh[1];
        line(c, sh[0], sy, h[0], h[1], P.tunicD, 2.5);
        line(c, sh[0], sy, h[0], h[1], tun, 1.7);
        blob(c, h[0], h[1], 1.05, P.skin);
      });
    }
    const hx = pose === "prone" ? 5.6 : 0.8;
    if (o.head === "roga") roga(c, hx, 0, 3.3, false);
    else if (o.head === "officer") roga(c, hx, 0, 3.4, true);
    else helmet(c, hx, 0, 3.2);
    c.restore();
  }
  function rifle(c, x, y, len, a, bayonet) {
    c.save(); c.translate(x, y); c.rotate(a || 0);
    poly(c, [[0, -1], [len * 0.38, -0.7], [len * 0.38, 0.7], [0, 1.2]]);
    fillStroke(c, lin(c, 0, -1, 0, 1, [P.woodL, P.wood, P.woodD]), 0.6);
    rr(c, len * 0.36, -0.55, len * 0.64, 1.1, 0.4); c.fillStyle = P.steelD; c.fill();
    rr(c, len * 0.38, -0.8, len * 0.38, 1.6, 0.5); c.fillStyle = P.woodD; c.fill();
    if (bayonet) line(c, len, 0, len + 4, 0, "#a9ad9e", 0.7);
    c.restore();
  }
  function binocs(c, x, y) {
    rr(c, x, y - 2.1, 2.8, 1.6, 0.6); c.fillStyle = "#1b1b17"; c.fill();
    rr(c, x, y + 0.5, 2.8, 1.6, 0.6); c.fill();
    blob(c, x + 2.6, y - 1.3, 0.5, "rgba(150,200,255,0.7)"); blob(c, x + 2.6, y + 1.3, 0.5, "rgba(150,200,255,0.7)");
  }

  // ------------------------------------------------------------------ RKM wz.28 (Polish BAR)
  function rkmGun(c, x, y, s) {
    c.save(); c.translate(x, y); if (s) c.scale(s, s);
    // Bipod legs splayed at the muzzle end.
    c.lineCap = "round";
    line(c, 15.5, 0, 18.5, -4.6, P.steelD, 1); line(c, 15.5, 0, 18.5, 4.6, P.steelD, 1);
    blob(c, 18.5, -4.6, 0.7, P.steelD); blob(c, 18.5, 4.6, 0.7, P.steelD);
    // Butt and stock.
    poly(c, [[-8, -1.9], [0, -1.3], [0, 1.3], [-8, 2.1]]);
    fillStroke(c, lin(c, 0, -2, 0, 2, [P.woodL, P.wood, P.woodD]), 0.8);
    c.fillStyle = P.steelD; c.fillRect(-8.4, -1.9, 0.9, 4);
    // Receiver and handguard.
    rr(c, 0, -1.8, 10, 3.6, 0.8); fillStroke(c, lin(c, 0, -1.8, 0, 1.8, [P.steelL, P.steel, P.steelD]), 0.8);
    rr(c, 10, -1.5, 6, 3, 1.2); fillStroke(c, lin(c, 0, -1.5, 0, 1.5, [P.woodL, P.wood, P.woodD]), 0.7);
    rr(c, 16, -0.75, 8, 1.5, 0.5); c.fillStyle = P.steelD; c.fill();
    rr(c, 23.5, -1.15, 2.4, 2.3, 0.4); c.fillStyle = "#14140f"; c.fill();
    // The 20 round box magazine.
    rr(c, 3.4, -2.5, 4.4, 5, 0.6); fillStroke(c, lin(c, 3.4, -2.5, 7.8, 2.5, ["#7b8070", "#4d5246", "#2c2f27"]), 0.7);
    c.strokeStyle = "rgba(0,0,0,0.4)"; c.lineWidth = 0.4;
    for (let i = 4.6; i < 7.6; i += 1) { c.beginPath(); c.moveTo(i, -2.3); c.lineTo(i, 2.3); c.stroke(); }
    line(c, 0.4, -1.3, 9.6, -1.3, "rgba(230,235,210,0.28)", 0.5);
    c.restore();
  }
  function magPouch(c, x, y, a) {
    c.save(); c.translate(x, y); c.rotate(a || 0);
    rr(c, -3.5, -2.6, 7, 5.2, 1.2); fillStroke(c, "#6b5a36", 0.7);
    for (let i = 0; i < 3; i++) { c.fillStyle = "#3e4238"; c.fillRect(-2.6 + i * 2.1, -1.8, 1.5, 3.6); }
    c.fillStyle = "rgba(255,240,200,0.18)"; c.fillRect(-3.3, -2.4, 6.6, 0.7);
    c.restore();
  }
  const lookOf = (t) => (t && A.lookOf ? A.lookOf(t) : {}) || {};
  function ammoBox(c, x, y, a) {
    // An open ammunition box of full magazines.
    c.save(); c.translate(x, y); c.rotate(a || 0);
    rr(c, -4.5, -3.2, 9, 6.4, 0.8); fillStroke(c, lin(c, -4.5, -3.2, 4.5, 3.2, ["#6b7a48", "#4e5a33", "#2f3720"]), 0.8);
    rr(c, -3.8, -2.5, 7.6, 5, 0.4); c.fillStyle = "#1e2016"; c.fill();
    for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? "#4d5246" : "#5a5f52"; c.fillRect(-3.4 + i * 1.5, -2.2, 1.2, 4.4); }
    rr(c, -4.5, -5.4, 9, 2, 0.6); fillStroke(c, "#5a6a3d", 0.6);
    c.restore();
  }
  W.rkm = (c, t, rec) => {
    const k = -rec * 2.5;
    const look = lookOf(t);
    casings(c, 41, 6, 4, 8, 6);
    if (look.scope) {
      // Scout team: the second man spots with binoculars, map case at his side.
      man(c, -8, -11, -0.35, { pose: "prone", arms: [[6.6, -1.6], [6.6, 1.6]] });
      c.save(); c.translate(-8, -11); c.rotate(-0.35); binocs(c, 7.6, 0); c.restore();
      rr(c, -20, -16, 5, 4, 0.6); fillStroke(c, "#6b4a2a", 0.6);
    } else {
      // Assistant on the left with a fresh magazine, pouch beside him.
      man(c, -10, -10, -0.25, { pose: "prone", arms: [[6, -1.2], [6.4, 2]] });
      c.save(); c.translate(-10, -10); c.rotate(-0.25);
      rr(c, 5.4, -1.8, 3, 4, 0.5); fillStroke(c, "#4d5246", 0.6);
      c.restore();
    }
    if (look.crates) { ammoBox(c, -20, -4, 0.2); magPouch(c, -3, -17, -0.4); magPouch(c, 3, -15, -0.2); }
    else magPouch(c, -20, -2, 0.3);
    // Gunner behind the gun, the butt in his right shoulder.
    man(c, -10, 1, 0, { pose: "prone", arms: [[6.2, -1.6], [8, 2.6]] });
    rkmGun(c, -3 + k, 2.6);
  };
  W.rkmsec = (c, t, rec) => {
    const k = -rec * 2.2;
    const g = BK.makeRng(77);
    // A section standing to in the trench: riflemen either side of the RKM.
    for (const [yy, bay] of [[-27, true], [-14, false], [14, true], [27, false]]) {
      const xx = -3 + (g() - 0.5) * 2.4, a = (g() - 0.5) * 0.2;
      man(c, xx, yy, a, { pose: "stand", pack: true, arms: [[5.5, -0.4], [3.4, 2.4]] });
      rifle(c, xx + 0.5, yy + 1.9, 16, a, bay);
    }
    casings(c, 13, 8, 6, 4, 10);
    man(c, -4, 0, 0, { pose: "stand", arms: [[5, -1.2], [8.5, 2.2]] });
    rkmGun(c, -1 + k, 1.8);
    magPouch(c, 5, -7.5, 0.1);
  };
  W.rkmaa = (c, t, rec) => {
    const k = -rec * 2;
    // The tall AA tripod: long splayed legs, a column and the gun cocked up at the sky.
    c.lineCap = "round";
    for (const a of [0, 2.2, -2.2]) {
      const fx = Math.cos(a) * 15, fy = Math.sin(a) * 15;
      line(c, 0, 0, fx + 1, fy + 1.4, "rgba(0,0,0,0.25)", 2);
      line(c, 0, 0, fx, fy, P.steelD, 1.8);
      line(c, 0, 0, fx * 0.9, fy * 0.9, "rgba(180,190,170,0.35)", 0.5);
      blob(c, fx, fy, 1.2, P.steelD);
    }
    // Ground shadow of the gun thrown down and to the right.
    c.save(); c.translate(5, 5); c.globalAlpha = 0.22; rr(c, -6, -1.6, 28, 3.2, 1.5); c.fillStyle = "#000"; c.fill(); c.restore();
    blob(c, 0, 0, 3, P.steel);
    c.save(); c.translate(k, 0);
    // Perspective: the muzzle end is nearer the eye, so it reads a touch larger.
    c.scale(1.05, 1.05);
    rkmGun(c, -4, 0, 1);
    // Ring sight on the barrel.
    c.beginPath(); c.arc(15, 0, 4.4, 0, TAU); c.strokeStyle = "#1a1a16"; c.lineWidth = 0.8; c.stroke();
    c.beginPath(); c.arc(15, 0, 2.2, 0, TAU); c.lineWidth = 0.5; c.stroke();
    c.beginPath(); c.moveTo(10.6, 0); c.lineTo(19.4, 0); c.moveTo(15, -4.4); c.lineTo(15, 4.4); c.lineWidth = 0.45; c.stroke();
    c.restore();
    // Gunner standing under it, leaning back; loader kneeling with magazines.
    man(c, -10, 0, 0, { pose: "stand", arms: [[5, -1.4], [6.5, 1.4]] });
    man(c, -8, 12, -0.4, { pose: "kneel", arms: [[4.5, -1], [4.5, 1.8]] });
    magPouch(c, -15, -10, 0.4);
    magPouch(c, -2, 14, -0.2);
  };
  function lancePennant(c, x0, y0, x1, y1) {
    line(c, x0 + 0.8, y0 + 1, x1 + 0.8, y1 + 1, "rgba(0,0,0,0.25)", 1.2);
    line(c, x0, y0, x1, y1, "#6a4a2a", 1.1);
    line(c, x1, y1, x1 + (x1 - x0) * 0.08, y1 + (y1 - y0) * 0.08, "#c8ccc0", 1);
    const a = Math.atan2(y1 - y0, x1 - x0);
    c.save(); c.translate(x1 - Math.cos(a) * 2.5, y1 - Math.sin(a) * 2.5); c.rotate(a + Math.PI);
    // A swallowtail lance pennant, white over red.
    poly(c, [[0, 0], [9, 0], [7, 2], [9.5, 4.4], [0, 4.4]]); c.fillStyle = "#c8242c"; c.fill();
    poly(c, [[0, 0], [9, 0], [7.5, 2.2], [0, 2.2]]); c.fillStyle = "#f2efe4"; c.fill();
    poly(c, [[0, 0], [9, 0], [7, 2], [9.5, 4.4], [0, 4.4]]); c.strokeStyle = "rgba(20,10,10,0.7)"; c.lineWidth = 0.5; c.stroke();
    c.restore();
  }
  W.rkmcav = (c, t, rec) => {
    const k = -rec * 2.5;
    casings(c, 52, 5, 4, 8, 6);
    // Dismounted uhlans in rogatywka caps: two carbines covering the RKM.
    for (const [yy, a] of [[-14, -0.15], [14, 0.15]]) {
      man(c, -5, yy, a, { pose: "kneel", head: "roga", arms: [[5.5, -0.6], [3.5, 2.6]] });
      rifle(c, -4.5, yy + 1.6, 13, a, false);
    }
    man(c, -11, 1, 0, { pose: "prone", head: "roga", arms: [[6.2, -1.6], [8, 2.6]] });
    rkmGun(c, -4 + k, 2.6);
    // The section leader with the lance and pennant, stood behind.
    man(c, -21, -6, 0.2, { pose: "stand", head: "roga", arms: [[3, -3], [2, 3]] });
    if (t && A.lookOf && A.lookOf(t).pennant !== false) lancePennant(c, -25, 4, -14, -24);
    // A sabre lying by the carbine man.
    line(c, -13, 18, -3, 21, "#9da291", 0.9); line(c, -13, 18, -14.6, 17.4, "#4a3420", 1.5);
  };

  // ------------------------------------------------------------------ granatnik wz.36
  function bomb(c, x, y, a, heat) {
    c.save(); c.translate(x, y); c.rotate(a);
    line(c, -2.6, 0, -1, 0, "#2b2d26", 1.1);
    line(c, -2.8, -0.9, -2.8, 0.9, "#2b2d26", 0.7);
    ell(c, 0.4, 0, 1.9, 1.2, 0, heat ? "#5f6a3e" : "#565e48", 0.5);
    if (heat) { c.fillStyle = "#c62a22"; c.fillRect(-0.3, -1.15, 0.8, 2.3); }
    blob(c, -0.2, -0.45, 0.4, "rgba(255,255,230,0.35)");
    c.restore();
  }
  function granatnik(c, x, y, rec, heat) {
    const k = -rec * 1.2;
    c.save(); c.translate(x, y);
    // Spade baseplate, monopod leg and the short tube cocked up at 45 degrees.
    poly(c, [[-1.5, -3.6], [1.5, -3.2], [2.2, 0], [1.5, 3.2], [-1.5, 3.6]]);
    fillStroke(c, lin(c, -1.5, -3.6, 2, 3.6, ["#5a5e50", "#3a3d34", "#22241e"]), 0.8);
    line(c, 4, 0, 4.8, 3.6, P.steelD, 0.9);
    rr(c, 0.5 + k, -1.6, 9.5, 3.2, 1.4);
    fillStroke(c, lin(c, 0, -1.6, 0, 1.6, ["#6d7462", "#454a3d", "#262920"]), 0.8);
    rr(c, 2.2 + k, -2.1, 2.2, 4.2, 0.6); c.fillStyle = "#30332b"; c.fill();
    blob(c, 10 + k, 0, 1.6, "#0e0e0c");
    c.beginPath(); c.arc(10 + k, 0, 1.6, 0, TAU); c.strokeStyle = "#5c6352"; c.lineWidth = 0.5; c.stroke();
    if (heat) { c.fillStyle = "#c62a22"; c.fillRect(6.5 + k, -1.7, 0.8, 3.4); }
    c.restore();
  }
  function bombPouch(c, x, y, heat, seed) {
    rr(c, x - 4.5, y - 3, 9, 6, 1.5); fillStroke(c, "#6b5a36", 0.7);
    rr(c, x - 4.5, y - 3, 9, 1.6, 0.8); c.fillStyle = "#57482a"; c.fill();
    const g = BK.makeRng(seed);
    for (let i = 0; i < 4; i++) bomb(c, x - 2.6 + i * 1.8, y + 0.8, -Math.PI / 2 + (g() - 0.5) * 0.3, heat);
  }
  function spade(c, x, y, a) {
    c.save(); c.translate(x, y); c.rotate(a);
    line(c, -5, 0, 1, 0, P.wood, 1.2);
    poly(c, [[1, -1.8], [4.5, -1.6], [5.4, 0], [4.5, 1.6], [1, 1.8]]); fillStroke(c, "#5d6152", 0.6);
    c.restore();
  }
  function granTeam(c, t, rec, heat, loader, ready) {
    if (ready) {
      // Quick hands: a row of bombs laid out by the tube, ready to drop.
      for (let i = 0; i < 6; i++) bomb(c, 2 + i * 2.4, 10.5, -Math.PI / 2, heat);
      rr(c, 0, 13, 15, 1.2, 0.5); c.fillStyle = "rgba(60,50,30,0.5)"; c.fill();
    }
    granatnik(c, 4, 1.5, rec, heat);
    man(c, -6, 0, 0.05, { pose: "kneel", arms: [[7.5, 0.4], [8, 3.4]] });
    bombPouch(c, -6, 11, heat, 3);
    spade(c, -14, -9, 0.4);
    if (loader) {
      // A loader with a shaped charge bomb ready in his hand.
      man(c, -5, -12, 0.5, { pose: "kneel", arms: [[5, -0.6], [5.5, 1.6]] });
      c.save(); c.translate(-5, -12); c.rotate(0.5); bomb(c, 6.2, 0.6, 0, true); c.restore();
    }
  }
  W.gran = (c, t, rec) => {
    const look = lookOf(t);
    c.save(); c.scale(1.12, 1.12);
    granTeam(c, t, rec, !!look.heat, !!look.heat, !!look.crates);
    c.restore();
  };
  W.gran3 = (c, t, rec) => {
    for (const [x, y] of [[2, -19], [-2, 0], [2, 19]]) {
      c.save(); c.translate(x, y); c.scale(0.82, 0.82);
      granatnik(c, 4, 1.5, rec, false);
      man(c, -6, 0, 0.05, { pose: "kneel", arms: [[7.5, 0.4], [8, 3.4]] });
      bombPouch(c, -7, 10, false, 5 + y);
      c.restore();
    }
  };

  // ------------------------------------------------------------------ 100mm wz.14/19 howitzer
  function spokeWheel(c, x, y, s) {
    c.save(); c.translate(x, y);
    // Seen from above the wheel is a narrow band; spokes and the felloe show on the outer face.
    rr(c, -7.5, -2.3, 15, 4.6, 2); fillStroke(c, "#25221c", 0.9);
    rr(c, -6.6, -1.5, 13.2, 3, 1.4); c.fillStyle = "#6b5232"; c.fill();
    c.strokeStyle = "rgba(20,14,8,0.8)"; c.lineWidth = 0.55;
    for (let i = -5.4; i <= 5.4; i += 1.8) { c.beginPath(); c.moveTo(i, -1.5); c.lineTo(i * 0.8, 1.5); c.stroke(); }
    line(c, -6.6, -s * 1.1, 6.6, -s * 1.1, "rgba(255,230,180,0.25)", 0.5);
    rr(c, -1.8, s > 0 ? 1.6 : -3.6, 3.6, 2, 0.6); fillStroke(c, P.steel, 0.6);
    c.restore();
  }
  function shell(c, x, y, a, len) {
    len = len || 9;
    c.save(); c.translate(x, y); c.rotate(a);
    rr(c, -len / 2, -1.5, len * 0.45, 3, 0.4); fillStroke(c, lin(c, 0, -1.5, 0, 1.5, [P.brassL, P.brass, "#7a5c22"]), 0.5);
    poly(c, [[-len / 2 + len * 0.45, -1.4], [len / 2 - 1.6, -1.4], [len / 2, 0], [len / 2 - 1.6, 1.4], [-len / 2 + len * 0.45, 1.4]]);
    fillStroke(c, lin(c, 0, -1.4, 0, 1.4, ["#7c8a5c", "#4e5a33", "#2f3720"]), 0.5);
    c.fillStyle = "#c0b088"; c.fillRect(-len / 2 + len * 0.45, -1.4, 0.6, 2.8);
    c.restore();
  }
  function how100(c, t, rec, v) {
    v = v || {};
    const k = -rec * 5;
    // Box trail with the spade and lunette.
    poly(c, [[-2, -5.5], [-34, -2.8], [-34, 2.8], [-2, 5.5]]);
    fillStroke(c, lin(c, 0, -5.5, 0, 5.5, ["#3c4729", "#6f7d50", "#4e5a33", "#2d3520"]), 1.1);
    line(c, -6, 0, -30, 0, "rgba(0,0,0,0.3)", 1.2);
    line(c, -4, -4.6, -32, -2.2, "rgba(255,255,220,0.15)", 0.6);
    poly(c, [[-33, -4.2], [-37.5, -3.4], [-38.5, 0], [-37.5, 3.4], [-33, 4.2]]); fillStroke(c, "#2a2c24", 0.9);
    c.beginPath(); c.arc(-35, 0, 1.3, 0, TAU); c.strokeStyle = "#8a8f7e"; c.lineWidth = 0.6; c.stroke();
    line(c, -24, -5.5, -24, 5.5, "#4a3420", 1);
    // Axle and spoked wheels.
    rr(c, -3, -16, 4, 32, 1.2); c.fillStyle = "#24261f"; c.fill();
    spokeWheel(c, -1, -14.5, -1); spokeWheel(c, -1, 14.5, 1);
    // Cradle and barrel.
    const len = v.long ? 40 : 29, wid = v.heavy ? 9 : 7.6;
    rr(c, -12, -4.4, 21, 8.8, 2); fillStroke(c, "#3b4530", 1);
    rr(c, -10 + k, -wid / 2, len, wid, 2.2);
    fillStroke(c, hullGrad(c, wid, "#3e4538", "#6b7464", "#21251e"), 1.1);
    line(c, -8 + k, -wid / 2 + 1.4, len - 13 + k, -wid / 2 + 1.4, "rgba(240,245,220,0.28)", 0.8);
    if (v.long) {
      // Counterweight collar near the muzzle of the longer tube.
      rr(c, len - 22 + k, -wid / 2 - 1.3, 7, wid + 2.6, 1.6);
      fillStroke(c, hullGrad(c, wid + 2.6, "#363d31", "#5f685a", "#1d201a"), 1);
    }
    rr(c, len - 13 + k, -wid / 2 - 0.6, 3, wid + 1.2, 1); fillStroke(c, "#30352b", 0.8);
    blob(c, len - 10 + k, 0, wid * 0.32, "#0d0d0b");
    // Breech ring and block.
    const bw = v.heavy ? 13 : 10;
    rr(c, -14 + k, -bw / 2, 6, bw, 1.6); fillStroke(c, lin(c, 0, -bw / 2, 0, bw / 2, ["#6b7464", "#3a4036", "#1e211b"]), 1);
    line(c, -14 + k, -bw / 2 - 0.8, -17 + k, -bw / 2 - 2.4, "#8a8f7e", 0.9);
    if (v.heavy) { c.fillStyle = "#b9ad80"; c.fillRect(-12 + k, -1, 2, 2); }
    // Gun shield with bent wings and a sight hole.
    poly(c, [[2.5, -17], [5.8, -17.6], [6.4, -5], [7.6, -3.2], [7.6, 3.2], [6.4, 5], [5.8, 17.6], [2.5, 17]]);
    fillStroke(c, shade(c, 2.5, -17, 5, 34, "#5d6845", "#8a9866", "#3a4429"), 1.1);
    c.fillStyle = "rgba(0,0,0,0.45)";
    for (const yy of [-14, -9, 9, 14]) c.fillRect(4.2, yy, 0.8, 0.8);
    c.fillStyle = "#14140f"; c.fillRect(3.8, -8, 2.4, 2);
    // Handwheels on the left of the cradle.
    c.beginPath(); c.arc(-5, -7.6, 2, 0, TAU); c.strokeStyle = "#1e211b"; c.lineWidth = 0.8; c.stroke();
    // Ready rounds and the crew of four.
    if (v.heavy) {
      // A fresh stack of heavy rounds and their crates beside the trail.
      crate(c, -28, 13, 9, 6, "#5e5a30"); crate(c, -19, 14.5, 9, 6, "#6b5634");
      for (let i = 0; i < 4; i++) shell(c, -28 + i * 0.2, -11 - i * 3.2, 0, 10);
      for (let i = 0; i < 3; i++) shell(c, -28.4, -12.6 - i * 3.2, 0, 10);
    } else {
      for (let i = 0; i < 3; i++) shell(c, -22, -13 - i * 3.3, 0, 9);
    }
    if (v.plan) {
      // Fire plan: a range board pinned up by the layer and an aiming stake out front.
      rr(c, -18, -19, 6, 5, 0.5); fillStroke(c, "#e8e0c4", 0.5);
      c.strokeStyle = "rgba(40,40,40,0.55)"; c.lineWidth = 0.35;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-17.3, -17.8 + i * 1.3); c.lineTo(-13, -17.8 + i * 1.3); c.stroke(); }
      blob(c, 14, -19, 1, "#e8e2cf"); blob(c, 14, -19, 0.5, "#c62a22");
    }
    man(c, -10, -10, 0.15, { pose: "kneel", arms: [[5, 2.6], [4.4, 4.2]] });
    man(c, -17, 7, 0, { pose: "stand", arms: [[4.5, -1.4], [4.5, 1.6]] });
    c.save(); c.translate(-17, 7); shell(c, 6, 0, 0, 9); c.restore();
    man(c, -27, -8, 0.5, { pose: "stand", arms: [[3.6, 3.6], [1.5, 4.5]] });
    man(c, -29, 9, -0.4, { pose: "stand", arms: [[3.6, -4], [2, -3]] });
  }
  W.how100 = (c, t, rec) => how100(c, t, rec, { plan: !!lookOf(t).crates });
  W.how100long = (c, t, rec) => how100(c, t, rec, { long: true });
  W.how100heavy = (c, t, rec) => how100(c, t, rec, { heavy: true });
  W.how100x2 = (c, t, rec) => {
    for (const y of [-25, 25]) { c.save(); c.translate(0, y); c.scale(0.72, 0.72); how100(c, t, rec, {}); c.restore(); }
    crate(c, -20, 0, 8, 6, "#6b5634"); crate(c, -11, 0, 8, 6, "#5e5a30");
  };
  W.how100x4 = (c, t, rec) => {
    for (const [x, y] of [[-2, -39], [6, -13], [6, 13], [-2, 39]]) { c.save(); c.translate(x, y); c.scale(0.56, 0.56); how100(c, t, rec, {}); c.restore(); }
  };

  // ------------------------------------------------------------------ observers
  function phone(c, x, y) {
    // Field telephone in its leather case, handset off the hook and the wire running out.
    c.save(); c.translate(x, y);
    rr(c, -3.5, -2.6, 7, 5.2, 1); fillStroke(c, lin(c, -3.5, -2.6, 3.5, 2.6, ["#8a6034", "#5e3e1e", "#3a2412"]), 0.7);
    blob(c, -1.5, 0, 1.2, "#1c1c18"); blob(c, -1.5, 0, 0.5, "#8a8f7e");
    rr(c, 0.6, -1.6, 2.4, 3.2, 0.8); c.fillStyle = "#1c1c18"; c.fill();
    c.beginPath(); c.moveTo(-3.5, 1.5); c.bezierCurveTo(-7, 3, -8, -2, -12, 0); c.strokeStyle = "rgba(20,20,16,0.8)"; c.lineWidth = 0.5; c.stroke();
    c.restore();
  }
  W.scope = (c, t, rec) => {
    if (lookOf(t).base === "balloon") {
      // The observer is up in the basket; on the ground the telephonist takes his calls down the tether.
      phone(c, 7, -2);
      man(c, 2, -3, 0, { pose: "kneel", arms: [[5, -1], [4.5, 2.6]] });
      c.beginPath(); c.arc(2.8, -3, 3.6, -1.2, 1.2); c.strokeStyle = "#1c1c18"; c.lineWidth = 0.6; c.stroke();
      rr(c, 1, 4, 6, 4.5, 0.6); fillStroke(c, "#e6dfc6", 0.6);
      line(c, 2, 5.4, 6, 5.4, "rgba(40,40,40,0.5)", 0.4); line(c, 2, 6.8, 5, 6.8, "rgba(40,40,40,0.5)", 0.4);
      man(c, -6, 3, 0.1, { pose: "stand", arms: [[3.4, -1.6], [3.4, 1.6]] });
      c.save(); c.translate(-6, 3); c.rotate(0.1); binocs(c, 3.6, 0); c.restore();
      return;
    }
    // Scissor periscope on its tripod, horns spread forward.
    c.lineCap = "round";
    for (const a of [0.4, -0.4, Math.PI]) line(c, 5, 0, 5 + Math.cos(a) * 7, Math.sin(a) * 7, P.woodD, 1.1);
    for (const s of [-1, 1]) {
      c.save(); c.translate(5, 0); c.rotate(s * 0.55);
      rr(c, -0.5, -1.2, 11, 2.4, 1); fillStroke(c, lin(c, 0, -1.2, 0, 1.2, ["#6b7464", "#3e4538", "#1d201a"]), 0.7);
      rr(c, 9.5, -1.6, 2.4, 3.2, 0.8); c.fillStyle = "#1b1c17"; c.fill();
      blob(c, 11.4, 0, 0.8, "rgba(150,200,255,0.8)");
      c.restore();
    }
    rr(c, 2.4, -2.2, 4, 4.4, 1); fillStroke(c, P.steel, 0.7);
    man(c, -2, 0, 0, { pose: "stand", arms: [[3, -2.2], [3, 2.2]] });
    // A second man with binoculars and the notebook.
    man(c, -9, 12, -0.25, { pose: "kneel", arms: [[3.4, -1.6], [3.4, 1.6]] });
    c.save(); c.translate(-9, 12); c.rotate(-0.25); binocs(c, 3.6, 0); c.restore();
    if (lookOf(t).radio) phone(c, -16, 4);
    rr(c, -15, -12, 6, 4.5, 0.6); fillStroke(c, "#e6dfc6", 0.6);
    line(c, -14, -10.8, -10, -10.8, "rgba(40,40,40,0.5)", 0.4); line(c, -14, -9.4, -11, -9.4, "rgba(40,40,40,0.5)", 0.4);
  };
  W.flare = (c, t, rec) => {
    // An open flare box: red, green and white cartridges.
    c.save(); c.translate(-12, 11);
    rr(c, -5, -3.5, 10, 7, 0.8); fillStroke(c, lin(c, -5, -3.5, 5, 3.5, [P.woodL, P.wood, P.woodD]), 0.8);
    rr(c, -4, -2.5, 8, 5, 0.4); c.fillStyle = "#2e2416"; c.fill();
    const cols = ["#d23a2a", "#3aa04a", "#f0ecd8"];
    for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) { blob(c, -2.8 + i * 1.9, -1.1 + r * 2.3, 0.85, cols[(i + r) % 3]); }
    c.restore();
    // The observer, arm raised with the wide bore flare pistol.
    man(c, -2, 0, 0, { pose: "stand", arms: [[8, -1], [2.6, 3.6]] });
    rr(c, 7, -2.1, 3, 2.2, 0.6); c.fillStyle = "#2a2a24"; c.fill();
    rr(c, 9.5, -2.4, 5, 2.8, 1); fillStroke(c, "#4d5246", 0.6);
    blob(c, 14.5, -1, 1, "#0e0e0c");
    if (rec > 0.25) { blob(c, 17, -1, 3 * rec, "rgba(255,120,80,0.6)"); blob(c, 17, -1, 1.4 * rec, "rgba(255,240,200,0.9)"); }
    // A partner on the binoculars.
    man(c, -6, -12, 0.3, { pose: "kneel", arms: [[3.4, -1.6], [3.4, 1.6]] });
    c.save(); c.translate(-6, -12); c.rotate(0.3); binocs(c, 3.6, 0); c.restore();
    if (lookOf(t).radio) phone(c, -15, -4);
  };
  function mapSheet(c, x, y, w, h, seed) {
    rr(c, x, y, w, h, 0.6); fillStroke(c, "#e9e2c8", 0.6);
    c.save(); rr(c, x, y, w, h, 0.6); c.clip();
    const g = BK.makeRng(seed);
    c.strokeStyle = "rgba(140,110,60,0.55)"; c.lineWidth = 0.4;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(x + w * (0.3 + g() * 0.4), y + h * (0.3 + g() * 0.4), 1.5 + i * 1.5, 1 + i * 1.1, g(), 0, TAU); c.stroke(); }
    line(c, x, y + h * 0.7, x + w, y + h * 0.4, "rgba(90,90,90,0.7)", 0.6);
    c.strokeStyle = "rgba(60,110,190,0.8)"; c.lineWidth = 0.5;
    c.beginPath(); c.moveTo(x + w * 0.2, y + h * 0.15); c.quadraticCurveTo(x + w * 0.6, y + h * 0.4, x + w * 0.5, y + h * 0.9); c.stroke();
    c.strokeStyle = "#c62a22"; c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(x + w * 0.85, y + h * 0.2); c.lineTo(x + w * 0.6, y + h * 0.55); c.lineTo(x + w * 0.68, y + h * 0.42); c.moveTo(x + w * 0.6, y + h * 0.55); c.lineTo(x + w * 0.72, y + h * 0.56); c.stroke();
    c.restore();
  }
  function mapTable(c, x, y, w, h, seed) {
    c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(x + 1.2, y + 1.6, w, h);
    rr(c, x, y, w, h, 0.8); fillStroke(c, lin(c, x, y, x + w, y + h, [P.woodL, P.wood, P.woodD]), 0.8);
    mapSheet(c, x + 1, y + 1, w - 2, h - 2, seed);
  }
  W.officer = (c, t, rec) => {
    mapTable(c, 2, -8, 12, 16, 9);
    // Compass and pencil on the map.
    blob(c, 11, 4, 1.2, "#2a2a26"); blob(c, 11, 4, 0.7, "#d8d6c6");
    line(c, 5, -5, 8, -3, "#c2a040", 0.6);
    man(c, -3, 0, 0, { pose: "stand", head: "officer", tunic: "#77724b", belt: true, arms: [[5, -3.5], [5, 3.6]] });
    // The runner: helmet, rifle slung, dispatch case in hand.
    man(c, -7, 13, -0.6, { pose: "stand", pack: true, arms: [[4, -1.4], [2, 4]] });
    rifle(c, -12, 15, 14, -1.2, false);
    c.save(); c.translate(-7, 13); c.rotate(-0.6); rr(c, 3.4, -3.6, 4, 3, 0.4); fillStroke(c, "#e8e0c4", 0.5); c.restore();
  };

  // Commander head positions, for the live rank straps art2 paints on top.
  W.rkm.cmd = [-4.4, 1]; W.rkmsec.cmd = [-3.2, 0]; W.rkmaa.cmd = [-9.2, 0]; W.rkmcav.cmd = [-20.2, -5.8];
  W.gran.cmd = [-5.8, 0]; W.gran3.cmd = [-6.3, 0];
  W.how100.cmd = W.how100long.cmd = W.how100heavy.cmd = [-9.2, -9.9]; W.how100x2.cmd = [-6.6, -32.1]; W.how100x4.cmd = [0.9, -18.5];
  W.scope.cmd = [-1.2, 0]; W.flare.cmd = [-1.2, 0]; W.officer.cmd = [-2.2, 0];

  // ------------------------------------------------------------------ bases
  BASES.foxhole = (c) => {
    blob(c, 1, 2, 25, "rgba(50,40,24,0.28)");
    lumpy(c, 0, 0, 20, 19, 22, 0.22, 4);
    c.fillStyle = rad(c, 0, 0, 8, 21, [P.dirtL, P.dirt, "rgba(107,90,60,0.4)"], -4, -4); c.fill();
    // The pit, darkest at the bottom with a sunlit rim at top left.
    ell(c, -1, 0, 12.5, 11, 0, rad(c, 0, 1, 1, 12.5, [P.pit, "#2f2416", "#5a4a30"], 1, 1));
    c.beginPath(); c.ellipse(-1, 0, 12.5, 11, 0, Math.PI * 0.95, Math.PI * 1.65); c.strokeStyle = "rgba(200,176,130,0.45)"; c.lineWidth = 1.4; c.stroke();
    bagArc(c, 0, 0, 16.5, -1.15, 1.15, 6, 7);
    bag(c, -15, 12, 0.7, 152); bag(c, -17, -9, -0.6, 160);
    tufts(c, 11, 14, 20, 26);
    const g = BK.makeRng(23);
    for (let i = 0; i < 10; i++) { const a = g() * TAU, d = 15 + g() * 7; blob(c, Math.cos(a) * d, Math.sin(a) * d, 0.7 + g(), "rgba(70,54,34,0.7)"); }
  };
  BASE_R.foxhole = 26;

  const TRENCH = [[-1, -33], [6, -22], [-2, -11], [5, 0], [-2, 11], [6, 22], [-1, 33]];
  function trenchPath(c, dx) {
    c.beginPath();
    TRENCH.forEach(([x, y], i) => (i ? c.lineTo(x + dx, y) : c.moveTo(x + dx, y)));
  }
  BASES.trench = (c) => {
    tufts(c, 19, 12, 26, 38);
    c.lineJoin = "round"; c.lineCap = "round";
    trenchPath(c, 1); c.strokeStyle = "rgba(50,40,24,0.3)"; c.lineWidth = 30; c.stroke();
    // Parapet to the front, parados behind, then the revetment and the floor.
    trenchPath(c, 4); c.strokeStyle = P.dirt; c.lineWidth = 25; c.stroke();
    trenchPath(c, 7); c.strokeStyle = P.dirtL; c.lineWidth = 14; c.stroke();
    trenchPath(c, -6); c.strokeStyle = "#7d6a48"; c.lineWidth = 8; c.stroke();
    trenchPath(c, 0); c.strokeStyle = P.woodD; c.lineWidth = 14; c.stroke();
    c.setLineDash([1.1, 2.2]);
    trenchPath(c, 0); c.strokeStyle = P.woodL; c.lineWidth = 14; c.stroke();
    c.setLineDash([]);
    trenchPath(c, 0); c.strokeStyle = P.pit; c.lineWidth = 10.5; c.stroke();
    trenchPath(c, 0.8); c.strokeStyle = "#3a2c1a"; c.lineWidth = 6; c.stroke();
    // Duckboards down the floor.
    c.strokeStyle = "rgba(150,118,74,0.75)"; c.lineWidth = 0.8;
    for (let i = 0; i < TRENCH.length - 1; i++) {
      const [x0, y0] = TRENCH[i], [x1, y1] = TRENCH[i + 1];
      for (let f = 0.1; f < 1; f += 0.18) {
        const x = x0 + (x1 - x0) * f + 0.8, y = y0 + (y1 - y0) * f;
        c.beginPath(); c.moveTo(x - 2.2, y); c.lineTo(x + 2.2, y); c.stroke();
      }
    }
    // Sandbags along the front lip.
    const g = BK.makeRng(31);
    for (let i = 0; i < TRENCH.length - 1; i++) {
      const [x0, y0] = TRENCH[i], [x1, y1] = TRENCH[i + 1];
      const a = Math.atan2(y1 - y0, x1 - x0);
      for (let f = 0.15; f < 1; f += 0.42) bag(c, x0 + (x1 - x0) * f + 12, y0 + (y1 - y0) * f, a, 146 + Math.floor(g() * 34), 9, 5.6);
      // Revetment stakes along both walls.
      for (let f = 0; f < 1; f += 0.25) for (const s of [-1, 1]) blob(c, x0 + (x1 - x0) * f + s * 6.4, y0 + (y1 - y0) * f, 0.9, P.woodD);
    }
  };
  BASE_R.trench = 38;

  function staticHorse(c, x, y, a, coat, seed) {
    const hx = A.shadeHex || ((h) => h);
    c.save(); c.translate(x, y); c.rotate(a);
    ell(c, 1.5, 2, 14, 6.2, 0, "rgba(0,0,0,0.25)");
    for (const [lx, ly] of [[7, -3.6], [7, 3.6], [-7.5, -3.3], [-7.5, 3.3]]) blob(c, lx, ly, 1.5, "#1a120a");
    c.lineCap = "round";
    c.beginPath(); c.moveTo(-11, 0); c.quadraticCurveTo(-15, 0.5, -17, 2.4);
    c.strokeStyle = "#1e140c"; c.lineWidth = 2.6; c.stroke();
    c.beginPath(); c.ellipse(0, 0, 11.5, 5, 0, 0, TAU);
    const g = c.createLinearGradient(0, -5, 0, 5);
    g.addColorStop(0, hx(coat, -25)); g.addColorStop(0.3, hx(coat, 35)); g.addColorStop(0.6, coat); g.addColorStop(1, hx(coat, -40));
    c.fillStyle = g; c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.8; c.stroke();
    // Neck and head reaching forward to the picket rope, drawn over the shoulders.
    c.beginPath(); c.moveTo(5.5, -3.6); c.quadraticCurveTo(10, -2.6, 13.4, -1.9); c.lineTo(13.4, 1.9); c.quadraticCurveTo(10, 2.6, 5.5, 3.6); c.closePath();
    fillStroke(c, lin(c, 0, -3.6, 0, 3.6, [hx(coat, 30), coat, hx(coat, -35)]), 0.7);
    c.beginPath(); c.ellipse(16.6, 0, 4.6, 2.1, 0, 0, TAU);
    fillStroke(c, lin(c, 0, -2.1, 0, 2.1, [hx(coat, 25), coat, hx(coat, -35)]), 0.7);
    blob(c, 20.2, 0, 1.4, hx(coat, -55));
    if (seed === 2) line(c, 14, 0, 19.4, 0, "#e8e2d0", 0.9);
    line(c, 4.5, 0, 13.2, 0, "#1a120a", 1.4);
    for (const s of [-1, 1]) { poly(c, [[13.4, s * 1.1], [11.6, s * 2.2], [12.4, s * 0.6]]); c.fillStyle = hx(coat, -30); c.fill(); }
    c.strokeStyle = "#2a1a0e"; c.lineWidth = 0.5; c.beginPath(); c.ellipse(18.4, 0, 0.6, 2.1, 0, 0, TAU); c.stroke();
    // Saddle cloth, saddle and the rolled cloak.
    rr(c, -3.6, -4.6, 7.2, 9.2, 1.6); fillStroke(c, "#28303f", 0.5);
    rr(c, -2.6, -3.4, 5.4, 6.8, 2); fillStroke(c, lin(c, 0, -3.4, 0, 3.4, ["#8a5e36", "#5c3a1e", "#3a2412"]), 0.5);
    line(c, -1.6, -2.2, 2, -2.2, "rgba(255,230,190,0.3)", 0.5);
    rr(c, -6.6, -3.4, 2.4, 6.8, 1.2); fillStroke(c, "#6d6844", 0.5);
    blob(c, 0.4, -4.8, 0.7, "#9aa090"); blob(c, 0.4, 4.8, 0.7, "#9aa090");
    c.restore();
  }
  BASES.horses = (c) => {
    blob(c, -8, 0, 42, "rgba(60,48,30,0.16)");
    lumpy(c, 0, 0, 16, 15, 16, 0.18, 8);
    c.fillStyle = rad(c, 0, 0, 4, 16, ["#5a4a30", P.dirt, "rgba(107,90,60,0.2)"]); c.fill();
    const g = BK.makeRng(14);
    for (let i = 0; i < 9; i++) { c.strokeStyle = "rgba(196,170,96,0.7)"; c.lineWidth = 0.6; const x = -46 + g() * 16, y = -30 + g() * 60; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 3 + g() * 3, y + g() * 2 - 1); c.stroke(); }
    // Picket rope between two stakes, three horses tied along it.
    line(c, -15, -34, -15, 34, "rgba(0,0,0,0.3)", 1.4);
    line(c, -16, -34, -16, 34, "#b8a678", 0.8);
    for (const y of [-34, 34]) { blob(c, -16, y, 1.9, P.woodD); blob(c, -16.4, y - 0.4, 0.9, P.woodL); }
    for (const [y, a, coat] of [[-20, 0.1, "#6b4226"], [0, -0.04, "#3a2a1e"], [20, -0.12, "#8a5a32"]]) {
      c.save(); c.translate(-32, y); c.scale(0.88, 0.88); staticHorse(c, 0, 0, a, coat, y === 0 ? 2 : 1); c.restore();
    }
    bagArc(c, 0, 0, 14.5, -0.95, 0.95, 5, 21);
    crate(c, -14, 26, 7, 5, "#6b5634");
    tufts(c, 27, 10, 16, 30);
  };
  BASE_R.horses = 36;

  BASES.gunpit = (c) => {
    blob(c, 0, 0, 46, "rgba(50,40,24,0.22)");
    lumpy(c, 0, 0, 42, 38, 28, 0.12, 12);
    c.fillStyle = rad(c, 0, 0, 22, 42, [P.dirtL, P.dirt, "rgba(107,90,60,0.25)"], -6, -6); c.fill();
    // Berm crest highlight and the dug floor.
    c.beginPath(); c.ellipse(0, 0, 33, 29, 0, Math.PI * 0.85, Math.PI * 1.75); c.strokeStyle = "rgba(210,186,140,0.4)"; c.lineWidth = 2.2; c.stroke();
    ell(c, 0, 0, 30, 26, 0, rad(c, 0, 0, 4, 30, ["#6e5c3e", "#5a4a30", "#3a2e1e"], -4, -4));
    c.strokeStyle = "rgba(40,30,18,0.35)"; c.lineWidth = 1.6;
    for (const y of [-12, 12]) { c.beginPath(); c.moveTo(-26, y * 0.6); c.quadraticCurveTo(0, y, 24, y * 0.8); c.stroke(); }
    // Timber revetment across the front.
    for (let i = 0; i < 9; i++) {
      const a = -0.95 + i * 0.24;
      c.save(); c.translate(Math.cos(a) * 29, Math.sin(a) * 25); c.rotate(a);
      rr(c, -1.6, -3.6, 3.2, 7.2, 1.4); fillStroke(c, lin(c, -1.6, 0, 1.6, 0, [P.woodL, P.wood, P.woodD]), 0.6);
      c.restore();
    }
    bagArc(c, 0, 0, 35, -0.7, 0.7, 6, 33);
    // Ammunition niche at the rear with racked rounds.
    rr(c, -40, -10, 9, 20, 1.5); c.fillStyle = "#2a2014"; c.fill();
    for (let i = 0; i < 5; i++) { blob(c, -36, -7.5 + i * 3.7, 1.5, P.brass); blob(c, -36, -7.5 + i * 3.7, 0.5, "#5a4418"); }
    crate(c, -28, -24, 9, 6, "#6b5634"); crate(c, -20, -29, 9, 6, "#5e5a30");
    tufts(c, 41, 16, 38, 46);
  };
  BASE_R.gunpit = 40;

  BASES.obspost = (c, look) => {
    blob(c, 1, 2, 26, "rgba(50,40,24,0.3)");
    lumpy(c, 0, 0, 21, 21, 18, 0.15, 5);
    c.fillStyle = P.dirt; c.fill();
    ell(c, 0, 0, 13, 13, 0, rad(c, 0, 0, 2, 13, ["#3a2e1e", "#2a2014", "#4a3a26"]));
    // A double wall of sandbags, open at the back for the crawl in.
    const g = BK.makeRng(61);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; if (Math.cos(a) < -0.9) continue; bag(c, Math.cos(a) * 19, Math.sin(a) * 19, a + Math.PI / 2, 140 + Math.floor(g() * 30), 9, 5.8); }
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + 0.26; if (Math.cos(a) < -0.85) continue; bag(c, Math.cos(a) * 14.5, Math.sin(a) * 14.5, a + Math.PI / 2, 154 + Math.floor(g() * 30), 8, 5); }
    // Brush stuck in the wall to break the outline.
    const r = BK.makeRng(66);
    for (let i = 0; i < 7; i++) {
      const a = -1.3 + r() * 2.6;
      c.save(); c.translate(Math.cos(a) * 20, Math.sin(a) * 20); c.rotate(a);
      c.fillStyle = r.pick(["#3e4a27", "#4f5c30", "#2e3a1e"]);
      c.beginPath(); c.ellipse(0, 0, 4.5, 2, 0, 0, TAU); c.fill();
      c.restore();
    }
    if (look && look.radio) {
      // Telephone wire run out from a cable reel at the back.
      c.strokeStyle = "rgba(20,20,16,0.8)"; c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(-20, 6); c.bezierCurveTo(-30, 10, -34, 24, -46, 30); c.stroke();
      blob(c, -22, 8, 3.4, "#3a3c30"); blob(c, -22, 8, 1.4, "#8a7a4c");
    }
    tufts(c, 63, 10, 22, 28);
  };
  BASE_R.obspost = 28;

  BASES.obstower = (c, look) => {
    // A long ground shadow sells the height.
    c.save(); c.filter = "blur(2px)"; c.globalAlpha = 0.26; c.fillStyle = "#000";
    rr(c, -6, 0, 38, 38, 3); c.fill();
    c.strokeStyle = "#000"; c.lineWidth = 2.6; c.lineCap = "round";
    for (const [fx, fy, tx, ty] of [[-38, 38, 6, 30], [38, 38, 34, 30], [38, -38, 34, 2], [-38, -38, 6, 2]]) { c.beginPath(); c.moveTo(fx, fy); c.lineTo(tx, ty); c.stroke(); }
    c.restore();
    blob(c, 0, 0, 44, "rgba(60,48,30,0.14)");
    // Four splayed legs from the ground to the platform corners, with cross braces.
    const feet = [[-38, -38], [38, -38], [38, 38], [-38, 38]], tops = [[-16, -16], [16, -16], [16, 16], [-16, 16]];
    c.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const f = feet[i], n = feet[(i + 1) % 4], tn = tops[(i + 1) % 4], tf = tops[i];
      line(c, f[0], f[1], (tn[0] + n[0]) / 2, (tn[1] + n[1]) / 2, "#4a3420", 1.3);
      line(c, n[0], n[1], (tf[0] + f[0]) / 2, (tf[1] + f[1]) / 2, "#4a3420", 1.3);
    }
    for (let i = 0; i < 4; i++) {
      const [fx, fy] = feet[i], [tx, ty] = tops[i];
      blob(c, fx, fy, 2.6, "rgba(0,0,0,0.3)");
      line(c, fx, fy, tx, ty, P.woodD, 4.6);
      line(c, fx, fy, tx, ty, P.wood, 3.2);
      line(c, fx - 0.8, fy - 0.8, tx - 0.6, ty - 0.6, "rgba(255,230,180,0.3)", 0.8);
      blob(c, fx, fy, 2.2, P.woodD);
    }
    // Ladder up the back.
    for (const s of [-1, 1]) line(c, -46, s * 3.4, -16, s * 2.8, P.woodD, 1.3);
    c.strokeStyle = P.woodL; c.lineWidth = 0.9;
    for (let x = -44; x < -17; x += 3) { c.beginPath(); c.moveTo(x, -3.2); c.lineTo(x, 3.2); c.stroke(); }
    // Platform: planks, rail, and sandbags along the front edge.
    plankRect(c, -18, -18, 36, 36, 5, true);
    c.strokeStyle = "#5a4026"; c.lineWidth = 2.2; rr(c, -18, -18, 36, 36, 1.5); c.stroke();
    c.strokeStyle = "rgba(255,230,180,0.25)"; c.lineWidth = 0.6; rr(c, -17, -17, 34, 34, 1.2); c.stroke();
    for (const [x, y] of tops) { rr(c, x - 2, y - 2, 4, 4, 0.8); fillStroke(c, P.woodD, 0.6); }
    rr(c, -17, -3, 5, 6, 0.6); c.fillStyle = "#1e160c"; c.fill();
    for (let i = 0; i < 4; i++) bag(c, 14.5, -12 + i * 8, Math.PI / 2, 150 + i * 6, 8, 5);
    if (look && look.maptable) mapTable(c, -15, -15, 11, 9, 4);
  };
  BASE_R.obstower = 36;

  BASES.balloon = (c) => {
    // Ground: winch wagon, tether and the balloon's soft shadow.
    blob(c, 4, 6, 30, "rgba(60,48,30,0.14)");
    c.save(); c.filter = "blur(2.5px)";
    ell(c, 8, 10, 27, 10, -0.55, "rgba(0,0,0,0.2)");
    for (const s of [-1, 1]) ell(c, 8 - 22 * 0.85 + s * 8 * 0.52, 10 + 22 * 0.52 + s * 8 * 0.85, 6, 3.6, -0.55 + s * 0.5, "rgba(0,0,0,0.16)");
    c.restore();
    c.save(); c.translate(18, 22); c.rotate(-0.4);
    for (const [x, y] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) { rr(c, x - 3, y - 1.6, 6, 3.2, 1.2); c.fillStyle = "#151512"; c.fill(); }
    rr(c, -10, -6, 20, 12, 1.5); fillStroke(c, lin(c, 0, -6, 0, 6, ["#7c8a5c", "#4e5a33", "#2f3720"]), 1);
    ell(c, -1, 0, 4, 5, 0, lin(c, 0, -5, 0, 5, ["#7b8070", "#3e4238", "#22251e"]), 0.7);
    line(c, -1, -5, -1, 5, "rgba(180,170,130,0.6)", 0.5);
    rr(c, 4, -4, 5, 8, 0.8); fillStroke(c, "#3a4030", 0.6);
    c.restore();
    crate(c, 30, 12, 7, 5, "#6b5634"); crate(c, 29, 32, 7, 5, "#5e5a30");
    // Tether rising to the belly band.
    c.beginPath(); c.moveTo(17, 22); c.quadraticCurveTo(6, 0, -17, -14);
    c.strokeStyle = "rgba(20,20,16,0.85)"; c.lineWidth = 0.7; c.stroke();
    // The balloon itself: a Caquot style envelope with three tail lobes.
    c.save(); c.translate(-19, -20); c.rotate(-0.55);
    const L = 29, R = 11.5;
    for (const s of [-1, 1]) {
      c.beginPath(); c.ellipse(-L + 6, s * 9.5, 7.5, 4.6, s * 0.5, 0, TAU);
      fillStroke(c, lin(c, 0, s * 4, 0, s * 14, s < 0 ? ["#d6d3b6", "#a3a184"] : ["#9a987c", "#6a6952"]), 0.9);
      c.strokeStyle = "rgba(60,58,44,0.4)"; c.lineWidth = 0.4;
      c.beginPath(); c.ellipse(-L + 6, s * 9.5, 4.5, 2.5, s * 0.5, 0, TAU); c.stroke();
    }
    c.beginPath(); c.ellipse(-L + 2, 0, 7, 3.4, 0, 0, TAU);
    fillStroke(c, lin(c, 0, -3.4, 0, 3.4, ["#dcd9be", "#a8a688", "#77765e"]), 0.8);
    c.beginPath(); c.moveTo(L, 0);
    c.bezierCurveTo(L, -R * 1.05, L * 0.2, -R, -L * 0.3, -R * 0.85);
    c.bezierCurveTo(-L * 0.8, -R * 0.65, -L, -R * 0.3, -L, 0);
    c.bezierCurveTo(-L, R * 0.3, -L * 0.8, R * 0.65, -L * 0.3, R * 0.85);
    c.bezierCurveTo(L * 0.2, R, L, R * 1.05, L, 0);
    c.closePath();
    const eg = c.createLinearGradient(0, -R, 0, R);
    eg.addColorStop(0, "#8f8d72"); eg.addColorStop(0.18, "#e4e1c6"); eg.addColorStop(0.45, "#bdbb9c"); eg.addColorStop(0.8, "#85846a"); eg.addColorStop(1, "#5c5b48");
    fillStroke(c, eg, 1.1);
    c.save(); c.clip();
    // Gore seams along the length and the rigging band round the belly.
    c.strokeStyle = "rgba(70,68,52,0.35)"; c.lineWidth = 0.45;
    for (const f of [-0.66, -0.33, 0.33, 0.66]) { c.beginPath(); c.moveTo(L, 0); c.quadraticCurveTo(0, f * R * 2.1, -L, f * R * 0.3); c.stroke(); }
    for (const x of [-16, -4, 8, 18]) { c.beginPath(); c.ellipse(x, 0, 1.4, R, 0, 0, TAU); c.stroke(); }
    line(c, 2, -R, 2, R, "rgba(60,50,30,0.6)", 1.1);
    c.beginPath(); c.ellipse(10, -R * 0.42, L * 0.45, R * 0.18, -0.04, 0, TAU); c.fillStyle = "rgba(255,255,240,0.35)"; c.fill();
    c.restore();
    // Red and white roundel checks on the nose, and the basket hanging just out from under the belly.
    rr(c, 19, -2.2, 4.4, 4.4, 0.6); c.fillStyle = "#f2efe4"; c.fill();
    c.fillStyle = "#c8242c"; c.fillRect(19, -2.2, 2.2, 2.2); c.fillRect(21.2, 0, 2.2, 2.2);
    c.strokeStyle = "rgba(20,10,10,0.6)"; c.lineWidth = 0.4; c.strokeRect(19, -2.2, 4.4, 4.4);
    c.strokeStyle = "rgba(40,34,20,0.7)"; c.lineWidth = 0.4;
    for (const x of [-2, 6]) { c.beginPath(); c.moveTo(x, R * 0.8); c.lineTo(3, R + 3); c.stroke(); }
    rr(c, 0.8, R + 2.2, 4.6, 3.6, 0.8); fillStroke(c, lin(c, 0, R + 2, 0, R + 6, ["#b08a54", "#7a5a36"]), 0.6);
    c.restore();
  };
  BASE_R.balloon = 42;

  BASES.tent = (c) => {
    blob(c, -6, -4, 40, "rgba(60,48,30,0.16)");
    tufts(c, 91, 12, 26, 40);
    // The staff tent: ridge along x, door open to the front.
    c.save(); c.translate(-22, -16);
    c.fillStyle = "rgba(0,0,0,0.28)"; c.fillRect(-14, -9, 32, 23);
    c.strokeStyle = "rgba(220,210,170,0.8)"; c.lineWidth = 0.4;
    for (const [x, y, px, py] of [[-12, -11, -16, -19], [12, -11, 14, -19], [-12, 11, -16, 19], [12, 11, 14, 19]]) {
      c.beginPath(); c.moveTo(x, y); c.lineTo(px, py); c.stroke(); blob(c, px, py, 0.9, P.woodD);
    }
    // Hipped roof: two long slopes and two end slopes, lit from the top left.
    poly(c, [[-15, -11], [15, -11], [11, 0], [-11, 0]]); fillStroke(c, lin(c, 0, -11, 0, 0, ["#8a8460", "#b0a97c"]), 0.9);
    poly(c, [[-11, 0], [11, 0], [15, 11], [-15, 11]]); fillStroke(c, lin(c, 0, 0, 0, 11, ["#76704c", "#56512f"]), 0.9);
    poly(c, [[-15, -11], [-11, 0], [-15, 11]]); fillStroke(c, lin(c, -15, 0, -11, 0, ["#a39c70", "#8a8460"]), 0.9);
    poly(c, [[15, -11], [11, 0], [15, 11]]); fillStroke(c, lin(c, 11, 0, 15, 0, ["#6a6444", "#4e4a2e"]), 0.9);
    // Door flap tied back on the front end.
    poly(c, [[15, -5], [12.6, 0], [15, 5]]); c.fillStyle = "#16140c"; c.fill();
    poly(c, [[15, -5], [12.6, 0], [17.5, -6.5]]); fillStroke(c, "#9a9368", 0.5);
    c.strokeStyle = "rgba(40,36,20,0.35)"; c.lineWidth = 0.45;
    for (let x = -8; x <= 8; x += 4) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x * 1.3, -11); c.moveTo(x, 0); c.lineTo(x * 1.3, 11); c.stroke(); }
    line(c, -11, 0, 11, 0, "#3e3a24", 1.1);
    line(c, -10, -0.8, 10, -0.8, "rgba(255,250,220,0.3)", 0.5);
    // Scalloped valance along the eaves.
    c.strokeStyle = "rgba(50,46,28,0.7)"; c.lineWidth = 0.5;
    for (let x = -14; x < 15; x += 3) { c.beginPath(); c.arc(x + 1.5, -11, 1.5, 0, Math.PI); c.stroke(); c.beginPath(); c.arc(x + 1.5, 11, 1.5, Math.PI, TAU); c.stroke(); }
    c.restore();
    // Pennant on its pole beside the door.
    blob(c, 13, -26, 1.4, P.woodD);
    line(c, 14, -25, 22, -20, "rgba(0,0,0,0.25)", 0.8);
    c.save(); c.translate(13, -26);
    poly(c, [[0, -0.2], [12, 1], [9.5, 2.8], [12, 4.6], [0, 4.4]]); c.fillStyle = "#c8242c"; c.fill();
    poly(c, [[0, -0.2], [12, 1], [10.5, 2.1], [0, 2.1]]); c.fillStyle = "#f2efe4"; c.fill();
    poly(c, [[0, -0.2], [12, 1], [9.5, 2.8], [12, 4.6], [0, 4.4]]); c.strokeStyle = "rgba(20,10,10,0.7)"; c.lineWidth = 0.4; c.stroke();
    c.restore();
    // Camp stool, a field telephone crate and the dispatch bicycle.
    rr(c, -20, 14, 5, 5, 0.6); fillStroke(c, "#6b5232", 0.6);
    crate(c, -27, 4, 8, 6, "#4c5038");
    c.strokeStyle = "#1e1e1a"; c.lineWidth = 0.8;
    c.beginPath(); c.arc(16, 22, 3.2, 0, TAU); c.moveTo(29.2, 22); c.arc(26, 22, 3.2, 0, TAU); c.stroke();
    c.beginPath(); c.moveTo(16, 22); c.lineTo(20, 19); c.lineTo(25, 19); c.lineTo(26, 22); c.moveTo(20, 19); c.lineTo(21, 22); c.lineTo(16, 22); c.stroke();
  };
  BASE_R.tent = 34;

  // ------------------------------------------------------------------ TKS tankette
  const CAMO = ["#4a5a2c", "#6e4426", "#3e4a26", "#7a5232"];
  function tksHullPath(c) {
    poly(c, [[-12.5, -6], [7.5, -6], [12.8, -3.4], [12.8, 3.4], [7.5, 6], [-12.5, 6]]);
  }
  function tksBody(c, look, dug, plain) {
    if (!dug) {
      ell(c, 1.2, 1.6, 15, 9.6, 0, "rgba(0,0,0,0.25)");
      tracks(c, 26, 17.4);
      // Mudguards over the tracks.
      for (const s of [-1, 1]) { rr(c, -12, s * 7 - 1, 22, 2, 0.6); c.fillStyle = "rgba(60,64,44,0.9)"; c.fill(); }
    }
    tksHullPath(c);
    fillStroke(c, hullGrad(c, 12, "#8f8352", "#ab9f6c", "#615a38"), 1.1);
    c.save(); tksHullPath(c); c.clip();
    const r = BK.makeRng(plain ? 91 : 47);
    for (let i = 0; i < 9; i++) {
      c.fillStyle = CAMO[i % 4];
      lumpy(c, r.range(-11, 11), r.range(-5, 5), r.range(3.5, 6), r.range(2.4, 4), 9, 0.5, 100 + i); c.fill();
      c.strokeStyle = "rgba(30,26,16,0.5)"; c.lineWidth = 0.4; c.stroke();
    }
    // Light and shade over the paint, so the hull still reads as a rounded box.
    tksHullPath(c); c.fillStyle = hullGrad(c, 12, "rgba(0,0,0,0)", "rgba(255,250,220,0.22)", "rgba(0,0,0,0.3)"); c.fill();
    // Raised crew superstructure on the front half, engine deck behind.
    poly(c, [[-2, -5.4], [7, -5.4], [10.4, -3], [10.4, 3], [7, 5.4], [-2, 5.4]]);
    c.fillStyle = "rgba(255,250,220,0.12)"; c.fill(); c.strokeStyle = "rgba(0,0,0,0.45)"; c.lineWidth = 0.6; c.stroke();
    rr(c, -11.2, -3.4, 6.4, 6.8, 0.6); c.fillStyle = "rgba(20,18,10,0.35)"; c.fill();
    c.strokeStyle = "rgba(0,0,0,0.5)"; c.lineWidth = 0.45;
    for (let x = -10.4; x < -5; x += 1.3) { c.beginPath(); c.moveTo(x, -3); c.lineTo(x, 3); c.stroke(); }
    c.restore();
    // Rivets along the plate seams.
    c.fillStyle = "rgba(20,18,10,0.55)";
    for (let x = -11.5; x < 7; x += 2.3) { c.fillRect(x, -5.5, 0.55, 0.55); c.fillRect(x, 5, 0.55, 0.55); }
    for (let y = -4.6; y < 5; y += 2.3) c.fillRect(-2.4, y, 0.5, 0.5);
    // Driver's hatch on the left, exhaust on the left flank, headlight and the hull MG ball on the right front.
    rr(c, 2.5, -4.6, 4, 3.6, 0.8); fillStroke(c, "#6d6644", 0.6);
    blob(c, 6, -2.8, 0.45, "#16160f");
    rr(c, -10, -7.4, 7, 1.5, 0.7); fillStroke(c, "#3a3226", 0.5);
    blob(c, 12, -4.2, 1, "#e8e4c8"); blob(c, 11.8, -4.4, 0.4, "#fff");
    blob(c, 11.6, 2.9, 1.9, "#3b3f33");
    c.beginPath(); c.arc(11.6, 2.9, 1.9, 0, TAU); c.strokeStyle = OUT; c.lineWidth = 0.6; c.stroke();
    blob(c, 11.1, 2.4, 0.6, "rgba(255,255,230,0.35)");
    if (!plain) { rr(c, 13.2, 2.3, 3, 1.2, 0.4); c.fillStyle = "#1d1d1a"; c.fill(); }
    // Tow hook at the rear.
    rr(c, -14, -1, 2, 2, 0.4); c.fillStyle = P.steelD; c.fill();
    if (look && look.vet && !plain) {
      // A veteran crew rides heads up: driver's hatch open, a tarp roll and spare links on the deck.
      rr(c, 2.5, -4.6, 4, 3.6, 0.8); c.fillStyle = "#1a1810"; c.fill();
      rr(c, 2.6, -8.4, 3.8, 3.4, 0.8); fillStroke(c, "#6d6644", 0.5);
      helmet(c, 4.4, -2.8, 1.7);
      rr(c, -11.5, -5.2, 7, 2.2, 1); fillStroke(c, "#8a8360", 0.5);
      // Kill tally painted on the engine deck.
      c.fillStyle = "#ece7d2";
      for (let i = 0; i < 4; i++) c.fillRect(-11 + i * 1.7, 3.6, 0.8, 2);
      c.fillRect(-11.4, 4.4, 6.6, 0.5);
    }
  }
  function tksMount(c, rec, look, small) {
    const k = -rec * (look.gun20 ? 3.5 : 2);
    // The gunner's armored cupola with the gun through its front.
    if (look.gun20) {
      rr(c, -3 + k, -1.6, 8, 3.2, 0.8); fillStroke(c, "#3b3f33", 0.7);
      rr(c, 4 + k, -0.85, 24, 1.7, 0.6); fillStroke(c, lin(c, 0, -0.85, 0, 0.85, ["#6b7464", "#3a4036", "#1d201a"]), 0.6);
      rr(c, 27 + k, -1.6, 3.8, 3.2, 0.6); fillStroke(c, "#25281f", 0.6);
      c.fillStyle = "rgba(255,255,255,0.35)"; c.fillRect(28 + k, -1.6, 0.5, 3.2); c.fillRect(29.4 + k, -1.6, 0.5, 3.2);
      rr(c, -1 + k, -3.6, 3.4, 2.4, 0.4); fillStroke(c, "#4a4e40", 0.5);
      if (look.vet && !small) { c.fillStyle = "#ece7d2"; for (let i = 0; i < 3; i++) c.fillRect(8 + i * 1.6 + k, -0.95, 0.7, 1.9); }
    } else {
      rr(c, 2 + k, -1.2, 13, 2.4, 0.8); fillStroke(c, "#3c3e38", 0.6);
      c.strokeStyle = "rgba(0,0,0,0.55)"; c.lineWidth = 0.4;
      for (let x = 5; x < 14; x += 1.6) { c.beginPath(); c.arc(x + k, 0, 0.4, 0, TAU); c.stroke(); }
      rr(c, 14.5 + k, -0.7, 3, 1.4, 0.4); c.fillStyle = "#1d1d1a"; c.fill();
    }
    c.beginPath(); c.arc(0, 0, 4.4, 0, TAU);
    fillStroke(c, rad(c, 0, 0, 0.5, 4.6, ["#b0a470", "#857a4c", "#4e4930"], -1.4, -1.4), 0.9);
    c.beginPath(); c.arc(-0.6, 0, 2.6, 0, TAU); c.fillStyle = "#2a2a1e"; c.fill();
    helmet(c, -0.6, 0, 2.3);
    c.fillStyle = "rgba(20,18,10,0.5)";
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; c.fillRect(Math.cos(a) * 3.6 - 0.25, Math.sin(a) * 3.6 - 0.25, 0.5, 0.5); }
  }
  function trailer(c, x, crates, tarpSeed) {
    line(c, x + 13, 0, x + 17, 0, P.steelD, 1.2);
    for (const s of [-1, 1]) { rr(c, x + 2.5, s * 7.2 - 1.8, 7, 3.6, 1.2); c.fillStyle = "#151512"; c.fill(); }
    rr(c, x, -6, 13, 12, 1.2);
    fillStroke(c, lin(c, x, -6, x, 6, ["#5a6a3d", "#7d8e57", "#3c4729"]), 1);
    if (crates) {
      crate(c, x + 3.5, -2.6, 5.4, 4.4, "#6b5634"); crate(c, x + 9.4, -2.6, 5.4, 4.4, "#5e5a30");
      crate(c, x + 3.5, 2.8, 5.4, 4.4, "#5e5a30", "#c8b070"); crate(c, x + 9.4, 2.8, 5.4, 4.4, "#6b5634");
    } else {
      rr(c, x + 1, -5, 11, 10, 2); fillStroke(c, lin(c, 0, -5, 0, 5, ["#968e62", "#78714c", "#555036"]), 0.6);
      c.strokeStyle = "rgba(40,30,16,0.7)"; c.lineWidth = 0.5;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x + 3 + i * 3.4, -5); c.lineTo(x + 3 + i * 3.4, 5); c.stroke(); }
    }
  }
  function tools(c) {
    // Toolbox, a jack and a run of spare track links.
    c.save(); c.translate(0, 15.5);
    rr(c, -6, -2.4, 9, 4.8, 0.8); fillStroke(c, lin(c, 0, -2.4, 0, 2.4, ["#7a2e22", "#5a2018", "#3a140e"]), 0.7);
    line(c, -3.5, 0, 0.5, 0, "#c8c2a6", 0.7);
    blob(c, 7, 0, 2.2, "#3a3e34"); blob(c, 7, 0, 1, "#8a8f7e");
    c.restore();
    for (let i = 0; i < 6; i++) { rr(c, -12 + i * 2.6, -16.5, 2.3, 4.2, 0.4); fillStroke(c, "#2e2d27", 0.5); }
    rr(c, 4, -17, 5, 3, 0.6); fillStroke(c, "#6b5232", 0.5);
  }
  function miniTks(c, x, y, seed) {
    c.save(); c.translate(x, y); c.scale(0.78, 0.78);
    tksBody(c, {}, false, true);
    tksMount(c, 0, { gun20: true }, true);
    c.restore();
  }
  VEH.tks = {
    hull(c, t, look) {
      c.scale(1.15, 1.15);
      if (look.platoon) { miniTks(c, -10, -21, 1); miniTks(c, -10, 21, 2); }
      if (look.trailer) {
        trailer(c, -30, look.crates, 1);
        if (look.column) {
          line(c, -30, 0, -34, 0, P.steelD, 1.2);
          trailer(c, -47, false, 2);
          crate(c, -43, -3, 5.4, 4.4, "#6b5634"); crate(c, -37.6, -3, 5.4, 4.4, "#5e5a30");
          crate(c, -43, 3, 5.4, 4.4, "#5e5a30"); crate(c, -37.6, 3, 5.4, 4.4, "#6b5634");
          crate(c, -40.3, 0, 5.4, 4.4, "#7a6440", "#c8b070");
        }
      }
      if (look.tools) tools(c);
      tksBody(c, look, false, false);
    },
    turret(c, t, rec, look) { c.scale(1.15, 1.15); tksMount(c, rec, look, false); },
  };
  VEH.tksdug = {
    hull(c, t, look) {
      c.scale(1.15, 1.15);
      tksBody(c, look, true, false);
      // Sunk to the deck: dark earth crowding the hull edges and dirt on the plates.
      c.save(); tksHullPath(c); c.clip();
      c.strokeStyle = "rgba(20,14,8,0.55)"; c.lineWidth = 5; tksHullPath(c); c.stroke();
      c.restore();
      const g = BK.makeRng(73);
      for (let i = 0; i < 10; i++) blob(c, g.range(-12, 0), g.range(-5, 5), 0.5 + g() * 0.8, "rgba(90,70,44,0.85)");
      for (let i = 0; i < 4; i++) {
        c.save(); c.translate(g.range(-12, -4), g.range(-5, 5)); c.rotate(g() * 3);
        c.fillStyle = g.pick(["#3e4a27", "#4f5c30"]); c.beginPath(); c.ellipse(0, 0, 3.6, 1.4, 0, 0, TAU); c.fill();
        c.restore();
      }
    },
    turret(c, t, rec, look) { c.scale(1.15, 1.15); tksMount(c, rec, Object.assign({ gun20: true }, look), false); },
  };
  BASES.tks = (c) => {
    blob(c, 0, 0, 24, "rgba(70,56,34,0.22)");
    blob(c, 0, 0, 17, "rgba(70,56,34,0.18)");
    const g = BK.makeRng(81);
    for (let i = 0; i < 14; i++) { const a = g() * TAU, d = 8 + g() * 14; c.fillStyle = "rgba(60,46,28,0.35)"; c.fillRect(Math.cos(a) * d, Math.sin(a) * d, 1.6, 0.8); }
  };
  BASE_R.tks = 21;
  BASES.tksdug = (c) => {
    blob(c, 0, 0, 30, "rgba(50,40,24,0.25)");
    lumpy(c, 0, 0, 27, 26, 22, 0.16, 15);
    c.fillStyle = rad(c, 0, 0, 14, 27, [P.dirtL, P.dirt, "rgba(107,90,60,0.3)"], -5, -5); c.fill();
    c.beginPath(); c.arc(0, 0, 21, Math.PI * 0.9, Math.PI * 1.7); c.strokeStyle = "rgba(210,186,140,0.4)"; c.lineWidth = 2; c.stroke();
    ell(c, 0, 0, 17.5, 17.5, 0, rad(c, 0, 0, 4, 17.5, ["#140e08", "#1e160c", "#3e3020"], 2, 2));
    bagArc(c, 0, 0, 22.5, -0.85, 0.85, 6, 44);
    tufts(c, 95, 12, 26, 32);
  };
  BASE_R.tksdug = 32;
})(typeof window !== "undefined" ? window : globalThis);
