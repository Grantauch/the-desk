// Art for the expansion: every gun form in the upgrade trees, the specialist enemy units,
// surrendering prisoners, Polish cavalry and the field fortifications. All drawn in code and cached.
(function (root) {
  const BK = root.BK;
  const A = BK.Art;
  const { rr, poly, fillStroke, shade, crewHead, sandbags, hullGrad, OUT, GUN, HULL, FRAMES, SPR } = A._h;

  function canvas(w, h) {
    const cv = document.createElement("canvas");
    cv.width = w * 2; cv.height = h * 2;
    const c = cv.getContext("2d");
    c.scale(2, 2);
    return { cv, c };
  }
  function blob(c, x, y, r, col) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = col; c.fill(); }
  function crate(c, x, y, w, h, col, stripe) {
    c.save();
    c.translate(x, y);
    rr(c, -w / 2, -h / 2, w, h, 0.8);
    fillStroke(c, col || "#6b5634", 0.8);
    c.strokeStyle = "rgba(0,0,0,0.35)";
    c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(w / 2, 0); c.stroke();
    if (stripe) { c.fillStyle = stripe; c.fillRect(-w / 2, -h / 2 + 1, w, 1.4); }
    c.restore();
  }
  function barrel(c, x, y, len, w, col, k) {
    rr(c, x + k, -w / 2 + y, len, w, Math.min(1.5, w / 2));
    c.fillStyle = col || "#3a4036";
    c.fill();
    c.strokeStyle = OUT;
    c.lineWidth = 1;
    c.stroke();
  }
  function bands(c, x, y, n, k) {
    c.fillStyle = "#e8e2cf";
    for (let i = 0; i < Math.min(n, 6); i++) c.fillRect(x + k + i * 2.2, y - 2.2, 1.1, 4.4);
  }

  // ------------------------------------------------------------------ bases (do not rotate)
  const BASE_R = { sandbag: 30, concrete: 30, casemate: 32, camo: 30, deep: 33, tower: 33, post: 28, battery: 42, tank7tp: 30, truck: 32, turret75: 34 };
  A.formRadius = function (t) {
    const n = t.path && BK.TREES[t.kind][t.path[t.path.length - 1]];
    return (BASE_R[(n && n.look && n.look.base) || "sandbag"] || 30) * BK.GS;
  };
  const baseCache = {};
  function base(look, kind) {
    const key = kind + "|" + look.base + "|" + (look.crates ? 1 : 0) + (look.radio ? 1 : 0) + (look.phos ? 1 : 0) + (look.branches ? 1 : 0) + (look.ghillie ? 1 : 0) + (look.light ? 1 : 0);
    if (baseCache[key]) return baseCache[key];
    const S = 100;
    const { cv, c } = canvas(S, S);
    c.translate(S / 2, S / 2);
    const big = kind === "f75" || kind === "aa";
    switch (look.base) {
      case "concrete": {
        blob(c, 1, 2, 24, "rgba(30,26,20,0.4)");
        const g = c.createRadialGradient(-6, -6, 2, 0, 0, 23);
        g.addColorStop(0, "#b4b0a4"); g.addColorStop(0.7, "#8a877d"); g.addColorStop(1, "#5e5c55");
        c.beginPath(); c.arc(0, 0, 22, 0, Math.PI * 2); c.fillStyle = g; c.fill();
        c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke();
        // Shuttering marks and chips in the concrete.
        c.strokeStyle = "rgba(60,58,52,0.35)"; c.lineWidth = 0.6;
        for (let r = 8; r < 22; r += 4) { c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke(); }
        c.beginPath(); c.arc(0, 0, 13, 0, Math.PI * 2); c.fillStyle = "#3a3934"; c.fill();
        c.beginPath(); c.arc(0, 0, 13, 0, Math.PI * 2); c.strokeStyle = "rgba(0,0,0,0.6)"; c.lineWidth = 1.5; c.stroke();
        break;
      }
      case "casemate": {
        c.fillStyle = "rgba(30,26,20,0.4)"; c.fillRect(-25, -23, 52, 50);
        const g = c.createLinearGradient(-24, -24, 24, 24);
        g.addColorStop(0, "#aaa79c"); g.addColorStop(1, "#5f5d56");
        rr(c, -24, -24, 48, 48, 5); fillStroke(c, g, 1.3);
        c.strokeStyle = "rgba(255,255,240,0.18)"; c.lineWidth = 1;
        rr(c, -20, -20, 40, 40, 3); c.stroke();
        c.beginPath(); c.arc(0, 0, 14, 0, Math.PI * 2); c.fillStyle = "#34332e"; c.fill();
        sandbags(c, 23, 16, false);
        break;
      }
      case "camo": {
        blob(c, 0, 0, 22, "rgba(48,40,26,0.55)");
        blob(c, 0, 0, 17, "#5b4c33");
        // Netting over poles, scrim and cut brush.
        const r = BK.makeRng(9);
        for (let i = 0; i < 40; i++) {
          const a = r() * 6.28, d = 10 + r() * 15;
          blob(c, Math.cos(a) * d, Math.sin(a) * d, 2.5 + r() * 3.5, r.pick(["#4f5a33", "#3d4728", "#6b6b3e", "#5a4a2c", "#2f3a22"]));
        }
        c.strokeStyle = "rgba(30,26,16,0.5)"; c.lineWidth = 0.5;
        for (let i = -22; i < 22; i += 4) { c.beginPath(); c.moveTo(i, -22); c.lineTo(i + 10, 22); c.stroke(); c.beginPath(); c.moveTo(-22, i); c.lineTo(22, i + 8); c.stroke(); }
        break;
      }
      case "deep": {
        blob(c, 0, 0, 30, "rgba(60,48,30,0.5)");
        // Spoil berm, timber revetment and the dark pit.
        const g = c.createRadialGradient(0, 0, 12, 0, 0, 30);
        g.addColorStop(0, "#3b2f1f"); g.addColorStop(0.55, "#6e5a3c"); g.addColorStop(1, "rgba(120,100,70,0)");
        c.beginPath(); c.arc(0, 0, 30, 0, Math.PI * 2); c.fillStyle = g; c.fill();
        c.beginPath(); c.arc(0, 0, 19, 0, Math.PI * 2); c.fillStyle = "#241c12"; c.fill();
        c.strokeStyle = "#7a5a34"; c.lineWidth = 2.4;
        for (let i = 0; i < 18; i++) { const a = (i / 18) * 6.28; c.beginPath(); c.moveTo(Math.cos(a) * 17, Math.sin(a) * 17); c.lineTo(Math.cos(a + 0.3) * 17, Math.sin(a + 0.3) * 17); c.stroke(); }
        sandbags(c, 23, 15, true);
        break;
      }
      case "tower": {
        // A timber flak platform on four legs. Its shadow does the talking.
        c.strokeStyle = "#3e2e1c"; c.lineWidth = 3;
        for (const [x, y] of [[-20, -20], [20, -20], [-20, 20], [20, 20]]) { c.beginPath(); c.moveTo(x * 1.15, y * 1.15); c.lineTo(x * 0.7, y * 0.7); c.stroke(); }
        c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(-23, -23); c.lineTo(23, 23); c.moveTo(23, -23); c.lineTo(-23, 23); c.stroke();
        rr(c, -19, -19, 38, 38, 2);
        const g = c.createLinearGradient(-19, -19, 19, 19);
        g.addColorStop(0, "#9a7a52"); g.addColorStop(1, "#5c4630");
        fillStroke(c, g, 1.2);
        c.strokeStyle = "rgba(30,20,10,0.55)"; c.lineWidth = 0.6;
        for (let y = -17; y < 19; y += 3.4) { c.beginPath(); c.moveTo(-19, y); c.lineTo(19, y); c.stroke(); }
        c.strokeStyle = "#6b5236"; c.lineWidth = 2.2; rr(c, -19, -19, 38, 38, 2); c.stroke();
        break;
      }
      case "post": {
        blob(c, 1, 2, 18, "rgba(30,26,20,0.4)");
        blob(c, 0, 0, 14, "#6b5b3d");
        sandbags(c, 15, 10, true);
        break;
      }
      case "battery": {
        // Two pits joined by a crawl trench, ready ammunition between them.
        c.fillStyle = "rgba(40,32,20,0.45)";
        rr(c, -42, -18, 84, 36, 16); c.fill();
        c.fillStyle = "#5e4f35";
        rr(c, -14, -5, 28, 10, 3); c.fill();
        for (const s of [-1, 1]) {
          c.save(); c.translate(s * 26, 0);
          blob(c, 0, 0, 17, "#6b5b3d");
          sandbags(c, 18, 12, false);
          c.restore();
        }
        crate(c, 0, -9, 7, 5); crate(c, 0, 9, 7, 5);
        break;
      }
      case "turret75": {
        blob(c, 1, 3, 32, "rgba(30,26,20,0.45)");
        const g = c.createRadialGradient(-8, -8, 4, 0, 0, 31);
        g.addColorStop(0, "#a9a69b"); g.addColorStop(1, "#5a5852");
        poly(c, Array.from({ length: 8 }, (_, i) => [Math.cos((i / 8) * 6.28 + 0.39) * 31, Math.sin((i / 8) * 6.28 + 0.39) * 31]));
        fillStroke(c, g, 1.4);
        c.beginPath(); c.arc(0, 0, 20, 0, Math.PI * 2); c.fillStyle = "#3d3c36"; c.fill();
        break;
      }
      case "tank7tp":
      case "truck":
        blob(c, 0, 0, 26, "rgba(70,56,34,0.35)");
        break;
      default: {
        blob(c, 1, 2, 21, "rgba(40,32,20,0.45)");
        blob(c, 0, 0, 18, "#6b5b3d");
        sandbags(c, big ? 21 : 19, big ? 15 : 13, false);
      }
    }
    if (look.crates) { crate(c, -22, 16, 8, 6); crate(c, -14, 22, 8, 6); crate(c, 20, 18, 8, 6, "#5e5a30"); }
    if (look.phos) { crate(c, -22, -16, 8, 6, "#6b6a5c", "#c23b2a"); crate(c, -15, -22, 8, 6, "#6b6a5c", "#c23b2a"); }
    if (look.radio) {
      crate(c, 18, -18, 9, 7, "#4c5038");
      c.strokeStyle = "#1c1c18"; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(21, -20); c.lineTo(30, -34); c.stroke();
      blob(c, 30, -34, 1.2, "#222");
    }
    if (look.branches || look.ghillie) {
      const r = BK.makeRng(17);
      for (let i = 0; i < 12; i++) {
        const a = r() * 6.28, d = 16 + r() * 8;
        c.save(); c.translate(Math.cos(a) * d, Math.sin(a) * d); c.rotate(a);
        c.fillStyle = r.pick(["#3e4a27", "#4f5c30", "#2e3a1e"]);
        c.beginPath(); c.ellipse(0, 0, 6, 2.6, 0, 0, 6.28); c.fill();
        c.restore();
      }
    }
    if (look.light) {
      // The searchlight on its own stand beside the guns.
      c.save(); c.translate(-22, -20);
      blob(c, 0, 0, 7, "#3a3c34");
      blob(c, 0, 0, 5, "#d8dccd");
      blob(c, -1.2, -1.2, 2, "rgba(255,255,255,0.9)");
      c.restore();
    }
    return (baseCache[key] = { cv, S });
  }

  // ------------------------------------------------------------------ weapons (rotate with the aim)
  const W = {};
  W.mg = (c, t, k) => GUN.mg(c, t, k, false);
  W.mg2 = (c, t, k) => GUN.mg(c, t, k, true);
  W.mg4 = (c, t, rec) => {
    const k = -rec * 2.5;
    blob(c, 0, 0, 9, "#3a3d33");
    c.beginPath(); c.arc(0, 0, 9, 0, 6.28); c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
    for (const off of [-6, -2, 2, 6]) {
      barrel(c, -2, off, 16, 3.2, "#40433b", k);
      c.fillStyle = "#1d1d1a"; c.fillRect(14 + k, off - 0.8, 6, 1.6);
    }
    c.fillStyle = "#4e5a33"; c.fillRect(-8, -12, 6, 4); c.fillRect(-8, 8, 6, 4);
    crewHead(c, -6, 0);
  };
  W.can20 = (c, t, rec) => {
    const k = -rec * 4;
    poly(c, [[4, -8], [7, -8], [7, 8], [4, 8]]);
    fillStroke(c, shade(c, 4, -8, 3, 16, "#5d6845", "#7c8a5c", "#3d462d"), 1);
    barrel(c, -8, 0, 36, 3.6, "#3a3e36", k);
    rr(c, 28 + k, -2.4, 6, 4.8, 1); c.fillStyle = "#24261f"; c.fill();
    c.fillStyle = "#555a4a"; c.fillRect(-4 + k, -7, 6, 5);
    crewHead(c, -10, -5); crewHead(c, -10, 5);
  };
  W.flamer = (c, t, rec) => {
    barrel(c, -4, 0, 26, 3, "#44403a", 0);
    c.fillStyle = "#2a2622"; c.fillRect(21, -2.2, 4, 4.4);
    for (const y of [-6, 6]) { rr(c, -14, y - 3.2, 12, 6.4, 3); fillStroke(c, "#4c5a3a", 0.9); }
    if (rec > 0.1) blob(c, 26, 0, 2.5, "rgba(255,170,60,0.9)");
    crewHead(c, -8, 0);
  };
  W.atr = (c, t, k) => GUN.atr(c, t, k);
  W.atr2 = (c, t, k) => { c.save(); c.translate(0, -7); GUN.atr(c, t, k); c.restore(); c.save(); c.translate(-4, 7); GUN.atr(c, t, k * 0.6); c.restore(); };
  W.atr4 = (c, t, k) => { for (const [x, y] of [[0, -18], [-3, -6], [0, 6], [-3, 18]]) { c.save(); c.translate(x, y); c.scale(0.9, 0.9); GUN.atr(c, t, k); c.restore(); } };
  W.at37 = (c, t, k) => GUN.at37(c, t, k);
  W.at37x2 = (c, t, k) => { for (const y of [-12, 12]) { c.save(); c.translate(0, y); c.scale(0.85, 0.85); GUN.at37(c, t, k); c.restore(); } };
  W.mortar = (c, t, k) => GUN.mortar(c, t, k);
  W.mortar2 = (c, t, k) => { for (const y of [-9, 9]) { c.save(); c.translate(0, y); c.scale(0.85, 0.85); GUN.mortar(c, t, k); c.restore(); } };
  W.mortar4 = (c, t, k) => { for (const [x, y] of [[-6, -10], [-6, 10], [8, -10], [8, 10]]) { c.save(); c.translate(x, y); c.scale(0.7, 0.7); GUN.mortar(c, t, k); c.restore(); } };
  W.mortar120 = (c, t, rec) => {
    blob(c, -3, 0, 10, "#34362f");
    c.strokeStyle = "#2c2d27"; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(12, 0); c.lineTo(16, -10); c.moveTo(12, 0); c.lineTo(16, 10); c.stroke();
    rr(c, -6, -5, 20 + rec * 2, 10, 5); fillStroke(c, "#434838", 1.1);
    blob(c, 14 + rec * 2, 0, 4.2, "#0e0e0e");
    crate(c, -16, -14, 9, 6); crate(c, -16, 14, 9, 6);
    crewHead(c, -12, 0); crewHead(c, 2, 13); crewHead(c, 2, -13);
  };
  W.mortarSiege = (c, t, rec) => {
    for (const s of [-1, 1]) { rr(c, -10, s * 14 - 4, 18, 8, 3); fillStroke(c, "#1f1f1b", 0.9); }
    blob(c, -2, 0, 12, "#30322b");
    rr(c, -8, -7, 28 + rec * 3, 14, 7); fillStroke(c, "#3f4436", 1.3);
    blob(c, 20 + rec * 3, 0, 5.5, "#0c0c0c");
    crate(c, -22, -6, 10, 7); crate(c, -22, 6, 10, 7);
    crewHead(c, -14, -14); crewHead(c, -14, 14); crewHead(c, 6, 18);
  };
  W.aa = (c, t, k) => GUN.aa(c, t, k);
  W.aa2 = (c, t, rec) => {
    const k = -rec * 3;
    c.strokeStyle = "#2d3128"; c.lineWidth = 3; c.lineCap = "round";
    c.beginPath();
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2; c.moveTo(0, 0); c.lineTo(Math.cos(a) * 16, Math.sin(a) * 16); }
    c.stroke();
    blob(c, 0, 0, 10, "#55603f");
    for (const y of [-4, 4]) {
      barrel(c, -6, y, 34, 3.6, "#3b4136", k);
      c.fillStyle = "#24261f"; c.fillRect(28 + k, y - 2.6, 5, 5.2);
      c.fillStyle = "#b08f3b"; c.fillRect(-2 + k, y - 1.4, 6, 2.8);
    }
    crewHead(c, -4, -12); crewHead(c, -4, 12); crewHead(c, -12, 0);
  };
  W.f75 = (c, t, k) => GUN.f75(c, t, k);
  W.f75long = (c, t, rec) => {
    GUN.f75(c, t, rec);
    const k = -rec * 6;
    barrel(c, 30, 0, 18, 5, "#3a4036", k);
    rr(c, 46 + k, -4, 6, 8, 1); c.fillStyle = "#24261f"; c.fill();
  };
  W.f75x2 = (c, t, k) => { for (const y of [-26, 26]) { c.save(); c.translate(0, y); c.scale(0.8, 0.8); GUN.f75(c, t, k); c.restore(); } };
  W.howitzer = (c, t, rec) => {
    const k = -rec * 4;
    c.strokeStyle = "#2b2e26"; c.lineWidth = 3.4; c.lineCap = "round";
    c.beginPath(); c.moveTo(-2, 0); c.lineTo(-26, -8); c.moveTo(-2, 0); c.lineTo(-26, 8); c.stroke();
    for (const s of [-1, 1]) { rr(c, -6, s * 14 - 3.5, 13, 7, 2.5); c.fillStyle = "#1c1c19"; c.fill(); }
    poly(c, [[2, -12], [6, -12], [6, 12], [2, 12]]);
    fillStroke(c, shade(c, 2, -12, 4, 24, "#5d6845", "#7c8a5c", "#3d462d"), 1.1);
    barrel(c, -8, 0, 32, 9, "#3a4036", k);
    c.fillStyle = "#1a1a17"; c.fillRect(23 + k, -3.5, 2, 7);
    crewHead(c, -12, -9); crewHead(c, -12, 9); crewHead(c, -20, 0);
  };
  W.howitzer3 = (c, t, k) => { for (const y of [-28, 0, 28]) { c.save(); c.translate(y === 0 ? 4 : 0, y); c.scale(0.72, 0.72); W.howitzer(c, t, k); c.restore(); } };
  W.turret75 = (c, t, rec) => {
    const k = -rec * 5;
    const g = c.createRadialGradient(-4, -4, 2, 0, 0, 18);
    g.addColorStop(0, "#8f8c80"); g.addColorStop(1, "#4b4a44");
    c.beginPath(); c.arc(0, 0, 17, 0, 6.28); fillStroke(c, g, 1.3);
    c.beginPath(); c.arc(0, 0, 17, -0.7, 0.7); c.strokeStyle = "rgba(255,255,240,0.2)"; c.lineWidth = 2; c.stroke();
    barrel(c, 12, 0, 34, 6, "#3a3d36", k);
    c.fillStyle = "#24261f"; c.fillRect(44 + k, -3.6, 3, 7.2);
    blob(c, -7, -6, 2.6, "#2a2a26");
  };

  // Vehicles: the hull holds its own heading, the turret follows the aim.
  function tracks(c, L, W2) {
    for (const s of [-1, 1]) {
      rr(c, -L / 2, s * (W2 / 2) - (s > 0 ? 5 : 0), L, 5, 2);
      fillStroke(c, "#25241f", 0.9);
      c.strokeStyle = "rgba(90,86,74,0.6)"; c.lineWidth = 0.7;
      for (let x = -L / 2 + 2; x < L / 2; x += 2.6) { c.beginPath(); c.moveTo(x, s * (W2 / 2) - (s > 0 ? 5 : 0)); c.lineTo(x, s * (W2 / 2) - (s > 0 ? 5 : 0) + 5); c.stroke(); }
    }
  }
  const VEH = {};
  VEH.tank7tp = {
    hull(c, t, look) {
      tracks(c, 36, 24);
      rr(c, -17, -9, 34, 18, 3);
      fillStroke(c, hullGrad(c, 18, "#5a6a3d", "#7d8e57", "#3c4729"), 1.2);
      // Polish three tone camouflage of the period.
      c.save(); c.clip();
      const r = BK.makeRng(31);
      for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? "rgba(122,96,58,0.55)" : "rgba(40,48,30,0.55)"; c.beginPath(); c.ellipse(r.range(-14, 14), r.range(-7, 7), r.range(4, 8), r.range(3, 5), r() * 3, 0, 6.28); c.fill(); }
      c.restore();
      c.fillStyle = "#2c3222"; c.fillRect(-16, -4, 5, 8);
      if (look.vet) { c.fillStyle = "#e8e2cf"; for (let i = 0; i < 5; i++) c.fillRect(-14 + i * 2.4, 6, 1, 2.4); }
    },
    turret(c, t, rec, look) {
      const k = -rec * 4;
      barrel(c, 6, 0, 20, 2.8, "#353a2e", k);
      c.beginPath(); c.arc(0, 0, 8, 0, 6.28);
      fillStroke(c, hullGrad(c, 8, "#5a6a3d", "#7d8e57", "#3c4729"), 1.1);
      blob(c, -2, -2.5, 2.4, "#2d331f");
      if (look.vet) { c.fillStyle = "#e8e2cf"; c.font = "bold 5px sans-serif"; c.fillText("1", -5, 6); }
    },
  };
  VEH.truck = {
    hull(c, t, look) {
      const plate = look.armored;
      for (const [x, y] of [[-12, -9], [-12, 9], [10, -9], [10, 9], [-4, -9], [-4, 9]]) { rr(c, x - 3, y - 2, 6, 4, 1.5); c.fillStyle = "#151512"; c.fill(); }
      rr(c, 8, -7, 12, 14, 2);
      fillStroke(c, plate ? "#4f5a3a" : "#5b6844", 1);
      c.fillStyle = "#1e2420"; c.fillRect(10, -5, 3, 10);
      rr(c, -20, -9, 28, 18, 1.5);
      fillStroke(c, plate ? shade(c, -20, -9, 28, 18, "#56603f", "#6b774f", "#3b4329") : "#6b5a3c", 1);
      if (!plate) { c.strokeStyle = "rgba(30,20,10,0.5)"; c.lineWidth = 0.6; for (let x = -18; x < 8; x += 3) { c.beginPath(); c.moveTo(x, -9); c.lineTo(x, 9); c.stroke(); } }
      else { c.strokeStyle = "rgba(0,0,0,0.4)"; c.lineWidth = 0.8; c.strokeRect(-18, -7, 24, 14); }
    },
    turret(c, t, rec, look) {
      c.save(); c.translate(-6, 0); c.scale(0.7, 0.7); GUN.aa(c, t, rec); c.restore();
    },
  };

  // Rotating extras on the weapon itself.
  function extras(c, t, look, rec) {
    const k = -rec * 3;
    if (look.scope) { rr(c, 6 + k, -3.6, 9, 2, 1); c.fillStyle = "#151513"; c.fill(); blob(c, 15 + k, -2.6, 1.2, "rgba(140,200,255,0.8)"); }
    if (look.sight) {
      c.beginPath(); c.arc(16 + k, 0, 5, 0, 6.28); c.strokeStyle = "rgba(20,20,18,0.9)"; c.lineWidth = 0.9; c.stroke();
      c.beginPath(); c.moveTo(11 + k, 0); c.lineTo(21 + k, 0); c.moveTo(16 + k, -5); c.lineTo(16 + k, 5); c.stroke();
    }
    if (look.bands) bands(c, 4, 0, (t.rank || 0) + 2, k);
    if (look.loader) { crewHead(c, -14, -11); crate(c, -18, -2, 6, 5); }
    if (look.side) {
      c.save(); c.translate(-2, 16); c.scale(0.7, 0.7); GUN.mg(c, t, rec, false); c.restore();
    }
    if (look.light) {
      // Beam toward the sky, drawn soft so it reads at night and at dusk.
      const g = c.createLinearGradient(0, 0, 160, 0);
      g.addColorStop(0, "rgba(255,250,220,0.22)"); g.addColorStop(1, "rgba(255,250,220,0)");
      c.fillStyle = g;
      c.beginPath(); c.moveTo(0, -3); c.lineTo(160, -22); c.lineTo(160, 22); c.lineTo(0, 3); c.fill();
    }
    if (look.ghillie) {
      const r = BK.makeRng(5);
      for (let i = 0; i < 10; i++) blob(c, r.range(-22, 0), r.range(-6, 6), r.range(2, 3.6), r.pick(["#4a5530", "#5f6638", "#3a4426"]));
    }
  }

  A.lookOf = function (t) {
    if (!t.path) return { base: "sandbag", w: t.kind };
    const n = BK.TREES[t.kind][t.path[t.path.length - 1]];
    return (n && n.look) || { base: "sandbag", w: t.kind };
  };

  A.gun = function (c, t, opts) {
    const look = A.lookOf(t);
    const b = base(look, t.kind);
    c.save();
    c.translate(t.x, t.y);
    c.scale(BK.GS, BK.GS);
    const v = VEH[look.base];
    if (t.ko > 0) c.globalAlpha = 0.55;
    if (v) {
      c.drawImage(b.cv, -b.S / 2, -b.S / 2, b.S, b.S);
      if (t.baseAng == null) t.baseAng = t.ang;
      c.save(); c.rotate(t.baseAng); v.hull(c, t, look); c.restore();
      c.rotate(t.ang);
      v.turret(c, t, t.recoil || 0, look);
    } else {
      // The raised tower lifts the guns: draw them a little larger.
      c.drawImage(b.cv, -b.S / 2, -b.S / 2, b.S, b.S);
      c.rotate(t.ang);
      if (look.base === "tower") c.scale(1.08, 1.08);
      (W[look.w] || W[t.kind] || W.mg)(c, t, t.recoil || 0);
      extras(c, t, look, t.recoil || 0);
    }
    c.restore();
  };

  const shCache = {};
  A.gunShadow = function (c, t, sun) {
    const look = A.lookOf(t);
    const key = look.base;
    let sh = shCache[key];
    const R = BASE_R[key] || 30;
    if (!sh) {
      const S = 160;
      const o = document.createElement("canvas");
      o.width = o.height = S;
      const oc = o.getContext("2d");
      oc.filter = "blur(4px)";
      oc.fillStyle = "#000";
      oc.translate(S / 2, S / 2);
      if (key === "casemate" || key === "tower") oc.fillRect(-R * 0.82, -R * 0.82, R * 1.64, R * 1.64);
      else if (key === "battery") { oc.beginPath(); oc.ellipse(0, 0, R, R * 0.48, 0, 0, 6.28); oc.fill(); }
      else { oc.beginPath(); oc.arc(0, 0, R * 0.8, 0, 6.28); oc.fill(); }
      sh = shCache[key] = o;
    }
    const s = BK.GS;
    const lift = key === "tower" ? 14 : key === "deep" ? 0 : key === "concrete" || key === "casemate" || key === "turret75" ? 6 : 3;
    c.save();
    c.globalAlpha = sun.a * (key === "deep" ? 0.4 : 0.9);
    c.drawImage(sh, t.x + sun.x * lift - 80 * s * 0.5, t.y + sun.y * lift - 80 * s * 0.5, 80 * s, 80 * s);
    c.restore();
  };

  // A picture of a gun form, for the upgrade panel.
  const iconCache = {};
  A.formIcon = function (kind, nodeId, size) {
    const key = kind + nodeId + (size || 64);
    if (iconCache[key]) return iconCache[key];
    const s = size || 64;
    const cv = document.createElement("canvas");
    cv.width = cv.height = s * 2;
    const c = cv.getContext("2d");
    const node = BK.TREES[kind][nodeId];
    const path = [];
    for (let n = node; n; n = n.parent && BK.TREES[kind][n.parent]) path.unshift(n.id);
    const R = (BASE_R[node.look.base] || 30) + (node.look.w === "f75long" ? 12 : 6);
    c.translate(s, s);
    c.scale((s * 0.95) / R / BK.GS, (s * 0.95) / R / BK.GS);
    A.gun(c, { kind, path, x: 0, y: 0, ang: -0.6, baseAng: -0.6, recoil: 0, ko: 0, rank: 2 });
    return (iconCache[key] = cv.toDataURL());
  };

  // Build bar icons use the same art as the first form of each gun.
  A.gunIcon = function (kind, size) { return A.formIcon(kind, kind, size || 48); };

  // ------------------------------------------------------------------ specialist infantry
  function soldier(c, e, o, opt) {
    // Legs, tunic and helmet like the rifle squads, with the kit drawn by the caller.
    HULL.inf(c, Object.assign({}, e, { kind: opt.officer ? "officer" : "inf" }), o);
  }
  HULL.pioneer = function (c, e, o) {
    soldier(c, e, o, {});
    // Flammenwerfer 35: the fuel tank on the back and the lance forward.
    rr(c, -9, -4, 6, 8, 2.5);
    fillStroke(c, "#4a4a3a", 0.9);
    blob(c, -6, -1.5, 1.2, "rgba(255,255,230,0.3)");
    c.strokeStyle = "#1e1d18"; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(-3, 3); c.quadraticCurveTo(2, 6, 4, 2.5); c.lineTo(12, 2); c.stroke();
    blob(c, 12.5, 2, 1, e.t % 0.5 < 0.25 ? "#ffb34a" : "#ff6a2a");
  };
  HULL.sniper = function (c, e, o) {
    soldier(c, e, o, {});
    // Scoped Kar98k, longer than the rifle squads carry, and a scrim of foliage on the helmet.
    c.strokeStyle = "#20201c"; c.lineWidth = 1.1;
    c.beginPath(); c.moveTo(4, 1.5); c.lineTo(13, 1.2); c.stroke();
    c.fillStyle = "#111"; c.fillRect(5, -0.4, 4, 1.4);
    for (const [x, y] of [[-0.5, -2], [2, 2], [1, -0.5], [-1.5, 1.5]]) blob(c, x, y, 1.4, "#4f5a30");
  };
  HULL.mortarteam = function (c, e, o) {
    const set = e.mode === "setup";
    // Two men: the gunner with the tube, the loader with the baseplate and bombs.
    c.save(); c.translate(0, -5); soldier(c, e, o, {}); c.restore();
    c.save(); c.translate(-6, 6); soldier(c, Object.assign({}, e, { seed: (e.seed || 0) + 2 }), o, {}); c.restore();
    if (set) {
      blob(c, 9, 0, 3.4, "#3a3c34");
      rr(c, 6, -1.6, 8, 3.2, 1.6); fillStroke(c, "#454a3d", 0.8);
    } else {
      c.strokeStyle = "#3f443a"; c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(-2, -8); c.lineTo(6, -6); c.stroke();
      blob(c, -9, 6, 2.6, "#3a3c34");
    }
  };
  HULL.engineer = function (c, e, o) {
    soldier(c, e, o, {});
    // Pick and shovel across the back, a box of charges on the hip.
    c.strokeStyle = "#5c4426"; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-6, -4); c.lineTo(-1, 4); c.stroke();
    c.fillStyle = "#6b6a63"; c.fillRect(-1.5, 3.2, 2.6, 2);
    crate(c, 1, 5.6, 3.6, 2.4, "#5b5030");
  };
  for (const k of ["pioneer", "sniper", "mortarteam", "engineer"]) FRAMES[k] = 8;

  // A soldier who has given up: rifle dropped, hands up, a white rag held high.
  const prisonerCache = {};
  A.prisoner = function (c, e, t) {
    const f = Math.floor((t * 6 + (e.seed || 0)) % 4);
    let sp = prisonerCache[f];
    if (!sp) {
      const { cv, c: cc } = canvas(40, 40);
      cc.translate(20, 20);
      cc.scale(BK.US, BK.US);
      HULL.inf(cc, { kind: "inf", t: f * 0.17, seed: 0 }, {});
      // Arms up and out; the white cloth flutters.
      cc.strokeStyle = "#68705b"; cc.lineWidth = 2;
      cc.beginPath(); cc.moveTo(0.5, -4.6); cc.lineTo(-2, -9); cc.moveTo(0.5, 4.6); cc.lineTo(-2, 9); cc.stroke();
      cc.fillStyle = "#f2efe4";
      cc.beginPath(); cc.moveTo(-2, -9); cc.lineTo(-7, -12 + f); cc.lineTo(-6, -7); cc.closePath(); cc.fill();
      sp = prisonerCache[f] = cv;
    }
    c.drawImage(sp, -20, -20, 40, 40);
  };

  // ------------------------------------------------------------------ Polish cavalry
  const horseCache = {};
  A.horse = function (c, t, coat, rider) {
    const f = Math.floor(t * 10) % 4;
    const key = coat + f + (rider || "");
    let sp = horseCache[key];
    if (!sp) {
      const { cv, c: cc } = canvas(60, 36);
      cc.translate(30, 18);
      const gait = [-3, -1, 3, 1][f];
      // Legs at the gallop.
      cc.strokeStyle = "#1e140c"; cc.lineWidth = 2.2; cc.lineCap = "round";
      cc.beginPath();
      cc.moveTo(8, -4); cc.lineTo(14 + gait, -6);
      cc.moveTo(8, 4); cc.lineTo(14 - gait, 6);
      cc.moveTo(-9, -4); cc.lineTo(-15 - gait, -6);
      cc.moveTo(-9, 4); cc.lineTo(-15 + gait, 6);
      cc.stroke();
      cc.beginPath(); cc.ellipse(0, 0, 13, 5.6, 0, 0, 6.28);
      const g = cc.createLinearGradient(0, -6, 0, 6);
      g.addColorStop(0, coat); g.addColorStop(0.4, shadeHex(coat, 30)); g.addColorStop(1, shadeHex(coat, -30));
      cc.fillStyle = g; cc.fill(); cc.strokeStyle = OUT; cc.lineWidth = 0.9; cc.stroke();
      cc.beginPath(); cc.moveTo(10, -2.5); cc.quadraticCurveTo(18, -2, 20, 0); cc.quadraticCurveTo(18, 2, 10, 2.5); cc.fillStyle = coat; cc.fill(); cc.stroke();
      cc.fillStyle = "#1a120a"; cc.fillRect(-15, -1, 4, 2);
      if (rider === "uhlan") {
        // Rider in khaki with the rogatywka cap and a lance with its pennant.
        cc.beginPath(); cc.ellipse(-1, 0, 4, 5.5, 0, 0, 6.28); cc.fillStyle = "#6f6a48"; cc.fill(); cc.strokeStyle = OUT; cc.stroke();
        cc.fillStyle = "#4f4b33"; cc.fillRect(-3, -3, 5, 6);
        cc.beginPath(); cc.arc(0, 0, 2.6, 0, 6.28); cc.fillStyle = "#5c5a3c"; cc.fill(); cc.stroke();
        cc.strokeStyle = "#5a4328"; cc.lineWidth = 1;
        cc.beginPath(); cc.moveTo(-8, 4); cc.lineTo(22, 7); cc.stroke();
        cc.fillStyle = "#f2efe4"; cc.beginPath(); cc.moveTo(18, 6.6); cc.lineTo(13, 8.5); cc.lineTo(13, 6.2); cc.fill();
        cc.fillStyle = "#c8242c"; cc.beginPath(); cc.moveTo(18, 6.6); cc.lineTo(13, 6.2); cc.lineTo(13, 4.8); cc.fill();
      } else if (rider === "farmer") {
        cc.beginPath(); cc.ellipse(-1, 0, 4, 5, 0, 0, 6.28); cc.fillStyle = "#6a5440"; cc.fill(); cc.strokeStyle = OUT; cc.stroke();
        cc.beginPath(); cc.arc(0, 0, 2.6, 0, 6.28); cc.fillStyle = "#2c2a26"; cc.fill();
      }
      sp = horseCache[key] = cv;
    }
    c.drawImage(sp, -30, -18, 60, 36);
  };
  function shadeHex(hex, d) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + d)), g = Math.max(0, Math.min(255, ((n >> 8) & 255) + d)), b = Math.max(0, Math.min(255, (n & 255) + d));
    return `rgb(${r},${g},${b})`;
  }
  A.shadeHex = shadeHex;

  // ------------------------------------------------------------------ armored train Śmiały
  A.trainCar = function (c, kind, t) {
    const L = kind === "loco" ? 64 : 58;
    c.fillStyle = "rgba(0,0,0,0.35)";
    c.fillRect(-L / 2 + 4, -12 + 4, L, 24);
    rr(c, -L / 2, -12, L, 24, 3);
    fillStroke(c, hullGrad(c, 24, "#56603f", "#73805a", "#353d27"), 1.3);
    c.save(); c.clip();
    const r = BK.makeRng(kind.length * 9);
    for (let i = 0; i < 7; i++) { c.fillStyle = i % 2 ? "rgba(120,92,56,0.5)" : "rgba(36,44,28,0.5)"; c.beginPath(); c.ellipse(r.range(-L / 2, L / 2), r.range(-10, 10), r.range(6, 12), r.range(4, 7), r() * 3, 0, 6.28); c.fill(); }
    c.restore();
    c.strokeStyle = "rgba(0,0,0,0.4)"; c.lineWidth = 0.8;
    for (let x = -L / 2 + 8; x < L / 2; x += 10) { c.beginPath(); c.moveTo(x, -12); c.lineTo(x, 12); c.stroke(); }
    if (kind === "loco") {
      blob(c, L / 2 - 14, 0, 6, "#2a2c24");
      if (Math.sin(t * 9) > 0) blob(c, L / 2 - 14, 0, 3, "rgba(80,80,74,0.6)");
    } else {
      // A turret with a 75mm gun at each end.
      for (const s of [-1, 1]) {
        c.save(); c.translate(s * (L / 2 - 14), 0);
        blob(c, 0, 0, 8.5, "#4a5236");
        c.strokeStyle = OUT; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 8.5, 0, 6.28); c.stroke();
        rr(c, 4, -1.8, 16, 3.6, 1); c.fillStyle = "#2c3022"; c.fill();
        c.restore();
      }
      c.fillStyle = "#e8e2cf"; c.font = "bold 6px sans-serif"; c.fillText("ŚMIAŁY", -12, 2.5);
    }
  };

  // ------------------------------------------------------------------ fortifications
  const fortCache = {};
  A.fort = function (c, f, sun) {
    const key = f.kind + Math.round(f.ang * 10) + (f.hp < f.maxHp * 0.5 ? "d" : "");
    let sp = fortCache[key];
    if (!sp) {
      const S = 90;
      const { cv, c: cc } = canvas(S, S);
      cc.translate(S / 2, S / 2);
      cc.rotate(f.ang);
      const dmg = f.hp < f.maxHp * 0.5;
      if (f.kind === "sandbag") {
        // A short wall two bags high, with its shadow baked in.
        cc.fillStyle = `rgba(0,0,0,${sun.a})`;
        rr(cc, -20 + sun.x * 4, -6 + sun.y * 4, 40, 12, 5); cc.fill();
        const r = BK.makeRng(Math.round(f.ang * 100));
        for (let row = 0; row < 2; row++) {
          for (let i = 0; i < 4; i++) {
            if (dmg && r() < 0.35) continue;
            cc.save();
            cc.translate(-15 + i * 10 + (row ? 5 : 0) - (row ? 2.5 : 0), row ? -2.5 : 2.5);
            rr(cc, -5.4, -3.4, 10.8, 6.8, 3);
            const tone = 150 + Math.floor(r() * 30) - row * 10;
            cc.fillStyle = `rgb(${tone},${tone - 18},${tone - 58})`;
            cc.fill(); cc.strokeStyle = "rgba(60,50,30,0.8)"; cc.lineWidth = 1; cc.stroke();
            cc.restore();
          }
        }
      } else if (f.kind === "wire") {
        // Concertina wire on pickets.
        cc.strokeStyle = "rgba(40,36,30,0.9)"; cc.lineWidth = 0.8;
        for (let i = -30; i < 30; i += 3) { cc.beginPath(); cc.ellipse(i, 0, 3.4, 7, 0.3, 0, 6.28); cc.stroke(); }
        cc.strokeStyle = "rgba(170,160,140,0.5)"; cc.lineWidth = 0.4;
        for (let i = -30; i < 30; i += 6) { cc.beginPath(); cc.ellipse(i + 1, -1, 3, 6, 0.3, 0, 6.28); cc.stroke(); }
        cc.fillStyle = "#4a3a24";
        for (let i = -30; i <= 30; i += 15) cc.fillRect(i - 1, -1, 2, 2);
      } else if (f.kind === "roadblock") {
        // Felled logs, a farm cart on its side and a row of steel hedgehogs.
        cc.fillStyle = `rgba(0,0,0,${sun.a})`;
        cc.fillRect(-32 + sun.x * 5, -8 + sun.y * 5, 64, 16);
        for (const y of [-4, 2]) { rr(cc, -30, y - 3, 60, 6, 3); fillStroke(cc, "#6b4e2e", 0.9); cc.fillStyle = "#c8a874"; cc.beginPath(); cc.ellipse(30, y, 1.6, 3, 0, 0, 6.28); cc.fill(); }
        for (const x of [-22, 0, 22]) {
          cc.save(); cc.translate(x, 10); cc.strokeStyle = "#2a2a26"; cc.lineWidth = 2;
          cc.beginPath(); cc.moveTo(-5, -5); cc.lineTo(5, 5); cc.moveTo(5, -5); cc.lineTo(-5, 5); cc.moveTo(0, -6); cc.lineTo(0, 6); cc.stroke(); cc.restore();
        }
      } else if (f.kind === "traps") {
        // A row of anti tank pits, covered with brush.
        for (const x of [-20, 0, 20]) {
          rr(cc, x - 7, -6, 14, 12, 2); cc.fillStyle = "#2a2014"; cc.fill();
          cc.strokeStyle = "rgba(120,100,60,0.8)"; cc.lineWidth = 0.7;
          for (let i = -6; i < 6; i += 2) { cc.beginPath(); cc.moveTo(x - 7, i); cc.lineTo(x + 7, i + 2); cc.stroke(); }
        }
      }
      sp = fortCache[key] = { cv, S };
    }
    c.drawImage(sp.cv, f.x - sp.S / 2, f.y - sp.S / 2, sp.S, sp.S);
  };

  // A crater bowl, drawn per radius bucket.
  const craterCache = {};
  A.crater = function (c, cr) {
    const rb = Math.max(6, Math.round(cr.r / 2) * 2);
    let sp = craterCache[rb];
    if (!sp) {
      const S = rb * 3;
      const { cv, c: cc } = canvas(S, S);
      cc.translate(S / 2, S / 2);
      const g = cc.createRadialGradient(-rb * 0.15, -rb * 0.15, rb * 0.1, 0, 0, rb * 1.35);
      g.addColorStop(0, "rgba(24,18,12,0.9)");
      g.addColorStop(0.55, "rgba(52,40,26,0.85)");
      g.addColorStop(0.75, "rgba(120,98,66,0.65)");
      g.addColorStop(1, "rgba(120,98,66,0)");
      cc.fillStyle = g;
      cc.beginPath(); cc.arc(0, 0, rb * 1.35, 0, 6.28); cc.fill();
      // Lit rim on the sun side, thrown clods.
      cc.beginPath(); cc.arc(0, 0, rb * 0.95, Math.PI * 0.9, Math.PI * 1.7);
      cc.strokeStyle = "rgba(190,168,120,0.45)"; cc.lineWidth = rb * 0.18; cc.stroke();
      const r = BK.makeRng(rb * 13);
      for (let i = 0; i < rb; i++) { const a = r() * 6.28, d = rb * (1 + r() * 0.5); blob(cc, Math.cos(a) * d, Math.sin(a) * d, 0.8 + r() * 1.4, "rgba(70,54,34,0.7)"); }
      sp = craterCache[rb] = { cv, S };
    }
    c.drawImage(sp.cv, cr.x - sp.S / 2, cr.y - sp.S / 2, sp.S, sp.S);
  };
})(typeof window !== "undefined" ? window : globalThis);
