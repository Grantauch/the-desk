// Art for the expansion: every gun form in the upgrade trees, the specialist enemy units,
// surrendering prisoners, Polish cavalry and the field fortifications. All drawn in code and cached.
(function (root) {
  const BK = root.BK;
  const A = BK.Art;
  const { rr, poly, fillStroke, shade, hullGrad, OUT, GUN, HULL, FRAMES, SPR } = A._h;

  // Offscreen canvas in logical units. sc is the backing resolution (2x unless asked).
  function canvas(w, h, sc) {
    sc = sc || 2;
    const cv = document.createElement("canvas");
    cv.width = Math.ceil(w * sc); cv.height = Math.ceil(h * sc);
    const c = cv.getContext("2d");
    c.scale(sc, sc);
    return { cv, c };
  }
  function blob(c, x, y, r, col) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = col; c.fill(); }

  // ------------------------------------------------------------------ shared drawing kit (cached paths only)
  // Light comes from the top left. Everything here runs once per cached sprite, so gradients are fine.
  const OL = { base: "#5d6845", light: "#8a9866", dark: "#353d27" };
  const ST = { base: "#3a4036", light: "#6f7766", dark: "#1b1e18" };
  function lin(c, y0, y1, dark, light, base, darker) {
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, dark); g.addColorStop(0.3, light); g.addColorStop(0.6, base); g.addColorStop(1, darker || dark);
    return g;
  }
  function diag(c, x, y, w, h, light, base, dark) {
    const g = c.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, light); g.addColorStop(0.5, base); g.addColorStop(1, dark);
    return g;
  }
  // Chipped paint, scratches and dirt inside the current path.
  function wear(c, pathFn, seed, x, y, w, h, n) {
    const r = BK.makeRng(seed);
    c.save(); pathFn(); c.clip();
    for (let i = 0; i < (n || 6); i++) {
      const px = x + r() * w, py = y + r() * h;
      c.fillStyle = r() < 0.6 ? "rgba(210,205,175,0.38)" : "rgba(30,28,20,0.4)";
      c.beginPath(); c.ellipse(px, py, 0.4 + r() * 0.9, 0.3 + r() * 0.5, r() * 3, 0, 6.28); c.fill();
    }
    for (let i = 0; i < Math.ceil((n || 6) / 3); i++) blob(c, x + r() * w, y + h * (0.55 + r() * 0.45), 1.5 + r() * 2.5, "rgba(84,64,36,0.22)");
    c.restore();
  }
  function outline(c, pathFn, lw) { pathFn(); c.strokeStyle = OUT; c.lineWidth = lw || 1; c.stroke(); }
  // A round tube along +x: barrels, jackets, trail legs. Shaded across its width.
  function tube(c, x, y, len, w, pal, seed) {
    pal = pal || ST;
    const p = () => rr(c, x, y - w / 2, len, w, Math.min(1.4, w / 2));
    p(); c.fillStyle = lin(c, y - w / 2, y + w / 2, pal.dark, pal.light, pal.base); c.fill();
    if (seed != null) wear(c, p, seed, x, y - w / 2, len, w, Math.ceil(len / 5));
    c.fillStyle = "rgba(255,255,235,0.22)"; c.fillRect(x + 1, y - w * 0.28, len - 2, Math.max(0.35, w * 0.1));
    outline(c, p, Math.min(1, 0.4 + w * 0.12));
  }
  function barrel(c, x, y, len, w, col, k) {
    const pal = col && col !== ST.base ? { base: col, light: shadeHex(col, 40), dark: shadeHex(col, -26) } : ST;
    tube(c, x + k, y, len, w, pal, Math.round(len * 7 + w * 3));
  }
  // Multi baffle muzzle brake like the Bofors guns carry.
  function brake(c, x, y, len, w) {
    const p = () => rr(c, x, y - w / 2, len, w, 0.8);
    p(); c.fillStyle = lin(c, y - w / 2, y + w / 2, "#121410", "#5a6052", "#2a2e26"); c.fill();
    c.fillStyle = "#0b0c0a";
    for (let i = 1; i < 3; i++) c.fillRect(x + (len * i) / 3 - 0.35, y - w / 2, 0.7, w);
    outline(c, p, 0.8);
  }
  function crate(c, x, y, w, h, col, stripe) {
    col = col || "#6b5634";
    c.save();
    c.translate(x, y);
    blob(c, 0.7, 0.9, Math.max(w, h) * 0.55, "rgba(0,0,0,0.18)");
    const p = () => rr(c, -w / 2, -h / 2, w, h, 0.7);
    p(); c.fillStyle = diag(c, -w / 2, -h / 2, w, h, shadeHex(col, 34), col, shadeHex(col, -30)); c.fill();
    c.strokeStyle = "rgba(30,20,10,0.45)"; c.lineWidth = 0.4;
    for (let i = 1; i < 3; i++) { c.beginPath(); c.moveTo(-w / 2, -h / 2 + (h * i) / 3); c.lineTo(w / 2, -h / 2 + (h * i) / 3); c.stroke(); }
    c.fillStyle = "rgba(255,245,215,0.22)"; c.fillRect(-w / 2 + 0.5, -h / 2 + 0.4, w - 1, 0.5);
    c.fillStyle = "rgba(20,16,10,0.6)"; c.fillRect(-w / 2 + 0.6, -0.4, 0.8, 0.8); c.fillRect(w / 2 - 1.4, -0.4, 0.8, 0.8);
    if (stripe) { c.fillStyle = stripe; c.fillRect(-w / 2, -h / 2 + 1, w, 1.2); }
    outline(c, p, 0.7);
    c.restore();
  }
  function bands(c, x, y, n, k) {
    for (let i = 0; i < Math.min(n, 6); i++) {
      const bx = x + k + i * 2.2;
      c.fillStyle = "#1a1a16"; c.fillRect(bx - 0.25, y - 2.5, 1.6, 5);
      c.fillStyle = "#ece6d2"; c.fillRect(bx, y - 2.3, 1.1, 4.6);
    }
  }
  // Brass shells in a wooden ready rack, base end up.
  function shellRack(c, x, y, n, a) {
    c.save(); c.translate(x, y); c.rotate(a || 0);
    const w = n * 3 + 1.4;
    crate(c, 0, 0, w, 5.2, "#6e5532");
    for (let i = 0; i < n; i++) {
      const sx = -w / 2 + 2.2 + i * 3;
      c.beginPath(); c.arc(sx, 0, 1.25, 0, 6.28);
      const g = c.createRadialGradient(sx - 0.4, -0.4, 0.1, sx, 0, 1.3);
      g.addColorStop(0, "#f2d98a"); g.addColorStop(1, "#8c6a24");
      c.fillStyle = g; c.fill(); c.strokeStyle = "rgba(40,28,10,0.8)"; c.lineWidth = 0.35; c.stroke();
      blob(c, sx, 0, 0.35, "#5a4a2a");
    }
    c.restore();
  }
  // A belt of brass rounds from the box to the feed.
  function belt(c, x0, y0, cx, cy, x1, y1, n) {
    for (let i = 0; i <= n; i++) {
      const u = i / n, v = 1 - u;
      const px = v * v * x0 + 2 * u * v * cx + u * u * x1, py = v * v * y0 + 2 * u * v * cy + u * u * y1;
      const dx = 2 * v * (cx - x0) + 2 * u * (x1 - cx), dy = 2 * v * (cy - y0) + 2 * u * (y1 - cy);
      c.save(); c.translate(px, py); c.rotate(Math.atan2(dy, dx));
      c.fillStyle = "#2c2a22"; c.fillRect(-0.55, -1.5, 1.1, 3);
      c.fillStyle = i % 2 ? "#d4b45a" : "#b8953c"; c.fillRect(-0.4, -1.3, 0.8, 2.6);
      c.restore();
    }
  }
  // A spoked artillery wheel seen from above and a little behind: iron tire, felloe, spokes and hub.
  function wheel(c, x, y, R, w) {
    c.save(); c.translate(x, y);
    blob(c, 0.8, 1, R * 0.8, "rgba(0,0,0,0.22)");
    c.beginPath(); c.ellipse(0, 0, R, w, 0, 0, 6.28); c.fillStyle = "#1e1d19"; c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.9; c.stroke();
    c.beginPath(); c.ellipse(0, 0, R - 0.9, w - 0.6, 0, 0, 6.28); c.fillStyle = "#6b5232"; c.fill();
    c.beginPath(); c.ellipse(0, 0, R - 1.8, w - 1.1, 0, 0, 6.28); c.fillStyle = "#2e2a20"; c.fill();
    c.strokeStyle = "#8a6c44"; c.lineWidth = 0.55;
    c.beginPath();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.28; c.moveTo(Math.cos(a) * 1, Math.sin(a) * 0.5); c.lineTo(Math.cos(a) * (R - 1.6), Math.sin(a) * (w - 1)); }
    c.stroke();
    c.beginPath(); c.ellipse(-R * 0.25, -w * 0.45, R * 0.6, 0.35, 0, 0, 6.28); c.fillStyle = "rgba(255,240,210,0.25)"; c.fill();
    blob(c, 0, 0, 1.4, "#3a3a32"); blob(c, -0.4, -0.3, 0.6, "#9a9a88");
    c.restore();
  }
  // Rubber tyred disc wheel, for the Bofors carriages.
  function discWheel(c, x, y, L, w) {
    const p = () => rr(c, x - L / 2, y - w / 2, L, w, w / 2);
    p(); c.fillStyle = lin(c, y - w / 2, y + w / 2, "#0e0e0c", "#3c3c36", "#1c1c19"); c.fill();
    outline(c, p, 0.8);
    c.fillStyle = "#4e5a3a"; c.fillRect(x - 1.4, y - w / 2 + 0.6, 2.8, w - 1.2);
    blob(c, x, y, 0.7, "#2a2a24");
  }
  // A gun shield: plate with a lit top edge, rivets and chips.
  function shield(c, x, y0, y1, th, seed) {
    th = th || 3.4;
    const p = () => poly(c, [[x, y0 + 1.5], [x + th * 0.6, y0], [x + th, y0 + 0.6], [x + th, y1 - 0.6], [x + th * 0.6, y1], [x, y1 - 1.5]]);
    blob(c, x + th + 1.2, (y0 + y1) / 2 + 1, Math.abs(y1 - y0) * 0.3, "rgba(0,0,0,0)");
    p(); c.fillStyle = diag(c, x, y0, th, y1 - y0, OL.light, OL.base, OL.dark); c.fill();
    wear(c, p, seed || 11, x, y0, th, y1 - y0, Math.ceil((y1 - y0) / 2.5));
    c.fillStyle = "rgba(255,255,230,0.25)"; c.fillRect(x + 0.3, y0 + 1.5, 0.6, y1 - y0 - 3);
    c.fillStyle = "rgba(20,20,14,0.7)";
    for (let yy = y0 + 2; yy < y1 - 1; yy += 3.2) c.fillRect(x + th * 0.5, yy, 0.7, 0.7);
    outline(c, p, 1);
  }
  // One crewman from above: wz.31 helmet, khaki tunic, arms reaching toward the work.
  function crew(c, x, y, a, o) {
    o = o || {};
    c.save(); c.translate(x, y); c.rotate(a || 0);
    blob(c, 0.7, 0.9, 4.4, "rgba(0,0,0,0.22)");
    if (o.arms !== false) {
      const r = o.reach == null ? 4.2 : o.reach, sp = o.spread || 0;
      c.lineCap = "round";
      c.beginPath(); c.moveTo(-0.6, -3.4); c.lineTo(r, -1.5 - sp); c.moveTo(-0.6, 3.4); c.lineTo(r, 1.5 + sp);
      c.strokeStyle = OUT; c.lineWidth = 2.5; c.stroke();
      c.strokeStyle = "#6a6442"; c.lineWidth = 1.6; c.stroke();
      blob(c, r, -1.5 - sp, 0.85, "#c39a74"); blob(c, r, 1.5 + sp, 0.85, "#c39a74");
      if (o.hold) { c.save(); c.translate(r + 0.8, 0); o.hold(c); c.restore(); }
    }
    // Tunic over the shoulders, webbing across.
    c.beginPath(); c.ellipse(-1, 0, 2.9, 4.6, 0, 0, 6.28);
    const g = c.createLinearGradient(-3, -4.6, 1, 4.6);
    g.addColorStop(0, "#8c8458"); g.addColorStop(0.5, "#6a6442"); g.addColorStop(1, "#45412a");
    c.fillStyle = g; c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.8; c.stroke();
    c.strokeStyle = "rgba(40,32,18,0.7)"; c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(-3.2, -2.6); c.lineTo(0.8, 2.8); c.stroke();
    // wz.31 helmet: rounded dome, narrow brim ring, light on the crown.
    c.beginPath(); c.arc(0.3, 0, 3.15, 0, 6.28); c.fillStyle = "#33361f"; c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.75; c.stroke();
    c.beginPath(); c.arc(0.3, 0, 2.55, 0, 6.28);
    const h = c.createRadialGradient(-0.6, -0.9, 0.2, 0.3, 0, 2.7);
    h.addColorStop(0, "#9a9a68"); h.addColorStop(0.45, "#62653f"); h.addColorStop(1, "#3c3f25");
    c.fillStyle = h; c.fill();
    blob(c, -0.4, -0.8, 0.6, "rgba(255,255,230,0.35)");
    c.restore();
  }
  function crewHead(c, x, y) { crew(c, x, y, 0); }
  // Better sandbags for every base: each bag lit from the top left, seams and ties.
  function sandbags(c, r, n, open) {
    const g = BK.makeRng(n * 31 + Math.round(r));
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (pass ? Math.PI / n : 0);
        if (open && Math.cos(a) > 0.82) continue;
        const rad = pass ? r - 2.2 : r;
        const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
        c.save();
        c.translate(x, y);
        c.rotate(a + Math.PI / 2);
        if (!pass) blob(c, 1, 1.4, 5, "rgba(0,0,0,0.2)");
        const p = () => rr(c, -5.2, -3.2, 10.4, 6.4, 3);
        const tone = 148 + Math.floor(g() * 30) + (pass ? 10 : 0);
        const base = `rgb(${tone},${tone - 18},${tone - 58})`;
        p();
        const gr = c.createLinearGradient(-5 * Math.cos(-a - 2.36), -5 * Math.sin(-a - 2.36), 5 * Math.cos(-a - 2.36), 5 * Math.sin(-a - 2.36));
        gr.addColorStop(0, `rgb(${tone + 34},${tone + 14},${tone - 26})`); gr.addColorStop(0.55, base); gr.addColorStop(1, `rgb(${tone - 42},${tone - 58},${tone - 90})`);
        c.fillStyle = gr; c.fill();
        c.strokeStyle = "rgba(58,46,26,0.85)"; c.lineWidth = 0.9; c.stroke();
        c.strokeStyle = "rgba(80,64,40,0.5)"; c.lineWidth = 0.4;
        c.beginPath(); c.moveTo(-3.6, 0); c.lineTo(3.6, 0); c.moveTo(4, -2); c.lineTo(4.4, 2); c.stroke();
        if (g() < 0.3) blob(c, -1 + g() * 3, 1, 1.2, "rgba(70,54,30,0.3)");
        c.restore();
      }
    }
  }
  // Hand the improved kit to art3.js, which reads A._h after this file loads.
  Object.assign(A._h, { crewHead, sandbags });

  // ------------------------------------------------------------------ bases (do not rotate)
  const BASE_R = { sandbag: 30, concrete: 30, casemate: 32, camo: 30, deep: 33, tower: 33, post: 28, battery: 42, tank7tp: 30, truck: 32, turret75: 34 };
  A.formRadius = function (t) {
    const n = t.path && BK.TREES[t.kind][t.path[t.path.length - 1]];
    return (BASE_R[(n && n.look && n.look.base) || "sandbag"] || 30) * BK.GS;
  };
  // Cache resolution follows the screen: sharp at zoom 1.7 on a high density display, lighter on a plain Chromebook screen.
  const SC = typeof devicePixelRatio === "number" && devicePixelRatio >= 1.5 ? 4 : 3;
  const baseCache = {};
  A.BASES = {};
  function pitFloor(c, R) {
    const g = c.createRadialGradient(-R * 0.3, -R * 0.3, 1, 0, 0, R);
    g.addColorStop(0, "#82704c"); g.addColorStop(0.7, "#6b5b3d"); g.addColorStop(1, "#4e422b");
    c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fillStyle = g; c.fill();
    const r = BK.makeRng(R * 7);
    for (let i = 0; i < 14; i++) blob(c, r.range(-R, R) * 0.8, r.range(-R, R) * 0.8, r.range(0.6, 1.8), r() < 0.5 ? "rgba(50,40,24,0.35)" : "rgba(160,140,100,0.3)");
    // Spent brass in the dirt.
    for (let i = 0; i < 6; i++) { c.save(); c.translate(r.range(-R, R) * 0.7, r.range(-R, R) * 0.7); c.rotate(r() * 6); c.fillStyle = "#c9a84e"; c.fillRect(-0.8, -0.3, 1.6, 0.6); c.restore(); }
  }
  function base(look, kind) {
    const key = kind + "|" + JSON.stringify(look);
    if (baseCache[key]) return baseCache[key];
    const S = 100;
    const { cv, c } = canvas(S, S, SC);
    c.translate(S / 2, S / 2);
    const big = kind === "f75" || kind === "aa";
    switch (look.base) {
      case "concrete": {
        blob(c, 2, 3, 24, "rgba(30,26,20,0.4)");
        const g = c.createRadialGradient(-8, -8, 2, 0, 0, 23);
        g.addColorStop(0, "#c2beb2"); g.addColorStop(0.65, "#8e8b81"); g.addColorStop(1, "#5a5851");
        const p = () => { c.beginPath(); c.arc(0, 0, 22, 0, Math.PI * 2); };
        p(); c.fillStyle = g; c.fill();
        wear(c, p, 41, -22, -22, 44, 44, 26);
        outline(c, p, 1.2);
        c.strokeStyle = "rgba(60,58,52,0.3)"; c.lineWidth = 0.5;
        for (let r = 15; r < 22; r += 3) { c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke(); }
        // Cracks and the firing embrasure.
        c.strokeStyle = "rgba(40,38,34,0.6)"; c.lineWidth = 0.5;
        c.beginPath(); c.moveTo(-18, 9); c.lineTo(-14, 7); c.lineTo(-12, 10); c.moveTo(12, -16); c.lineTo(10, -12); c.lineTo(13, -9); c.stroke();
        c.beginPath(); c.arc(0, 0, 14.5, 0, Math.PI * 2); c.fillStyle = "#5e5b53"; c.fill();
        c.beginPath(); c.arc(0, 0, 13, 0, Math.PI * 2); c.fillStyle = "#34332e"; c.fill();
        c.beginPath(); c.arc(0, 0, 13, Math.PI * 0.15, Math.PI * 0.85); c.strokeStyle = "rgba(255,255,240,0.2)"; c.lineWidth = 1; c.stroke();
        c.beginPath(); c.arc(0, 0, 14.5, Math.PI * 1.1, Math.PI * 1.6); c.strokeStyle = "rgba(255,255,240,0.3)"; c.lineWidth = 0.8; c.stroke();
        break;
      }
      case "casemate": {
        c.fillStyle = "rgba(30,26,20,0.4)"; c.fillRect(-24, -22, 52, 50);
        const g = c.createLinearGradient(-24, -24, 24, 24);
        g.addColorStop(0, "#b8b5aa"); g.addColorStop(0.6, "#86837a"); g.addColorStop(1, "#57554f");
        const p = () => rr(c, -24, -24, 48, 48, 5);
        p(); c.fillStyle = g; c.fill(); wear(c, p, 43, -24, -24, 48, 48, 28); outline(c, p, 1.3);
        c.strokeStyle = "rgba(255,255,240,0.22)"; c.lineWidth = 1;
        c.beginPath(); c.moveTo(-20, 18); c.lineTo(-20, -20); c.lineTo(18, -20); c.stroke();
        c.strokeStyle = "rgba(0,0,0,0.28)";
        c.beginPath(); c.moveTo(20, -18); c.lineTo(20, 20); c.lineTo(-18, 20); c.stroke();
        c.beginPath(); c.arc(0, 0, 15, 0, Math.PI * 2); c.fillStyle = "#5a5852"; c.fill();
        c.beginPath(); c.arc(0, 0, 13.5, 0, Math.PI * 2); c.fillStyle = "#34332e"; c.fill();
        sandbags(c, 23, 16, false);
        break;
      }
      case "camo": {
        blob(c, 0, 0, 22, "rgba(48,40,26,0.55)");
        pitFloor(c, 17);
        // Netting over poles, scrim and cut brush.
        const r = BK.makeRng(9);
        for (let i = 0; i < 46; i++) {
          const a = r() * 6.28, d = 10 + r() * 15;
          const col = r.pick(["#4f5a33", "#3d4728", "#6b6b3e", "#5a4a2c", "#2f3a22"]);
          const x = Math.cos(a) * d, y = Math.sin(a) * d, rad = 2.5 + r() * 3.5;
          blob(c, x + 0.8, y + 1, rad, "rgba(0,0,0,0.18)");
          blob(c, x, y, rad, col);
          blob(c, x - rad * 0.3, y - rad * 0.3, rad * 0.45, "rgba(200,200,140,0.12)");
        }
        c.strokeStyle = "rgba(30,26,16,0.5)"; c.lineWidth = 0.45;
        for (let i = -22; i < 22; i += 4) { c.beginPath(); c.moveTo(i, -22); c.lineTo(i + 10, 22); c.stroke(); c.beginPath(); c.moveTo(-22, i); c.lineTo(22, i + 8); c.stroke(); }
        break;
      }
      case "deep": {
        blob(c, 0, 0, 30, "rgba(60,48,30,0.5)");
        const g = c.createRadialGradient(-4, -4, 12, 0, 0, 30);
        g.addColorStop(0, "#3b2f1f"); g.addColorStop(0.55, "#7a6544"); g.addColorStop(1, "rgba(120,100,70,0)");
        c.beginPath(); c.arc(0, 0, 30, 0, Math.PI * 2); c.fillStyle = g; c.fill();
        c.beginPath(); c.arc(0, 0, 19, 0, Math.PI * 2); c.fillStyle = "#241c12"; c.fill();
        c.beginPath(); c.arc(1.5, 1.5, 16, 0, Math.PI * 2); c.fillStyle = "#2f2517"; c.fill();
        // Timber revetment, plank by plank, lit on the far side of the pit.
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * 6.28;
          c.strokeStyle = OUT; c.lineWidth = 2.8;
          c.beginPath(); c.moveTo(Math.cos(a) * 17.5, Math.sin(a) * 17.5); c.lineTo(Math.cos(a + 0.28) * 17.5, Math.sin(a + 0.28) * 17.5); c.stroke();
          c.strokeStyle = Math.cos(a - 0.8) > 0 ? "#8e6c40" : "#6a4e2c"; c.lineWidth = 2;
          c.stroke();
        }
        sandbags(c, 23, 15, true);
        break;
      }
      case "tower": {
        c.strokeStyle = "#2e2214"; c.lineWidth = 3.2;
        for (const [x, y] of [[-20, -20], [20, -20], [-20, 20], [20, 20]]) { c.beginPath(); c.moveTo(x * 1.18, y * 1.18); c.lineTo(x * 0.7, y * 0.7); c.stroke(); }
        c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(-23, -23); c.lineTo(23, 23); c.moveTo(23, -23); c.lineTo(-23, 23); c.stroke();
        blob(c, 3, 3, 22, "rgba(0,0,0,0.25)");
        const p = () => rr(c, -19, -19, 38, 38, 2);
        p();
        const g = c.createLinearGradient(-19, -19, 19, 19);
        g.addColorStop(0, "#a8875c"); g.addColorStop(1, "#5c4630");
        c.fillStyle = g; c.fill();
        const r = BK.makeRng(23);
        for (let y = -19; y < 19; y += 3.4) {
          c.fillStyle = `rgba(${r() < 0.5 ? "255,230,190" : "40,24,10"},${0.05 + r() * 0.08})`; c.fillRect(-19, y, 38, 3.4);
          c.strokeStyle = "rgba(30,20,10,0.55)"; c.lineWidth = 0.5; c.beginPath(); c.moveTo(-19, y); c.lineTo(19, y); c.stroke();
          c.fillStyle = "rgba(20,14,8,0.7)"; c.fillRect(-17, y + 1.4, 0.7, 0.7); c.fillRect(16.3, y + 1.4, 0.7, 0.7);
        }
        c.strokeStyle = "#6b5236"; c.lineWidth = 2.2; p(); c.stroke();
        outline(c, p, 0.8);
        // Ammunition boxes stacked at the rail.
        crate(c, -13, 13, 7, 5, "#5a5a34"); crate(c, -6, 14, 7, 5, "#5a5a34");
        break;
      }
      case "post": {
        blob(c, 1, 2, 18, "rgba(30,26,20,0.4)");
        pitFloor(c, 14);
        sandbags(c, 15, 10, true);
        break;
      }
      case "battery": {
        c.fillStyle = "rgba(40,32,20,0.45)";
        rr(c, -42, -18, 84, 36, 16); c.fill();
        c.fillStyle = "#5e4f35";
        rr(c, -14, -5, 28, 10, 3); c.fill();
        c.fillStyle = "rgba(30,22,12,0.5)"; c.fillRect(-14, 3, 28, 2);
        for (const s of [-1, 1]) {
          c.save(); c.translate(s * 26, 0);
          pitFloor(c, 17);
          sandbags(c, 18, 12, false);
          c.restore();
        }
        crate(c, -3, -9, 7, 5); crate(c, 4, -9, 6, 5, "#5e5a30"); crate(c, 0, 9, 7, 5);
        if (kind === "f75") { shellRack(c, -2, 1, 5); }
        break;
      }
      case "turret75": {
        blob(c, 2, 4, 32, "rgba(30,26,20,0.45)");
        const g = c.createRadialGradient(-10, -10, 4, 0, 0, 32);
        g.addColorStop(0, "#bcb9ad"); g.addColorStop(0.6, "#8a877d"); g.addColorStop(1, "#55534d");
        const p = () => poly(c, Array.from({ length: 8 }, (_, i) => [Math.cos((i / 8) * 6.28 + 0.39) * 31, Math.sin((i / 8) * 6.28 + 0.39) * 31]));
        p(); c.fillStyle = g; c.fill(); wear(c, p, 47, -31, -31, 62, 62, 30); outline(c, p, 1.4);
        c.strokeStyle = "rgba(255,255,240,0.2)"; c.lineWidth = 0.8;
        for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28 + 0.39; c.beginPath(); c.moveTo(Math.cos(a) * 31, Math.sin(a) * 31); c.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); c.stroke(); }
        c.beginPath(); c.arc(0, 0, 21.5, 0, Math.PI * 2); c.fillStyle = "#5c5a53"; c.fill();
        c.beginPath(); c.arc(0, 0, 20, 0, Math.PI * 2); c.fillStyle = "#3d3c36"; c.fill();
        break;
      }
      case "tank7tp":
      case "truck": {
        blob(c, 0, 0, 26, "rgba(70,56,34,0.35)");
        // Churned earth and track marks where it pulled in.
        c.strokeStyle = "rgba(50,38,22,0.35)"; c.lineWidth = 3;
        c.beginPath(); c.moveTo(-26, -9); c.lineTo(26, -9); c.moveTo(-26, 9); c.lineTo(26, 9); c.stroke();
        break;
      }
      default: {
        if (A.BASES[look.base]) { A.BASES[look.base](c, look, kind); break; }
        blob(c, 1, 2, 21, "rgba(40,32,20,0.45)");
        pitFloor(c, 18);
        sandbags(c, big ? 21 : 19, big ? 15 : 13, false);
        // Kit the crew keeps by the pit.
        if (kind === "f75") shellRack(c, -20, 20, 4, -0.8);
        else if (kind === "mg") { crate(c, -19, 19, 7, 5, "#4e5a33"); crate(c, -14, 23, 7, 5, "#4e5a33"); }
        else if (kind === "at37") shellRack(c, -21, 18, 3, -0.7);
        else if (kind === "aa") crate(c, -20, 19, 9, 5, "#5a5a34", "#b08f3b");
      }
    }
    if (look.crates) { crate(c, -22, 16, 8, 6); crate(c, -14, 22, 8, 6); crate(c, 20, 18, 8, 6, "#5e5a30"); }
    if (look.phos) { crate(c, -22, -16, 8, 6, "#6b6a5c", "#c23b2a"); crate(c, -15, -22, 8, 6, "#6b6a5c", "#c23b2a"); }
    if (look.radio) {
      crate(c, 18, -18, 9, 7, "#4c5038");
      c.fillStyle = "#1c1c18"; c.fillRect(15.5, -19.5, 2, 1.4); blob(c, 20, -18, 1, "#c8c2a0");
      c.strokeStyle = "#1c1c18"; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(21, -20); c.lineTo(30, -34); c.stroke();
      blob(c, 30, -34, 1.2, "#222");
      crew(c, 24, -11, 2.4, { reach: 3 });
    }
    if (look.branches || look.ghillie) {
      const r = BK.makeRng(17);
      for (let i = 0; i < 14; i++) {
        const a = r() * 6.28, d = 16 + r() * 8;
        c.save(); c.translate(Math.cos(a) * d, Math.sin(a) * d); c.rotate(a);
        c.fillStyle = "rgba(0,0,0,0.2)"; c.beginPath(); c.ellipse(0.8, 0.8, 6, 2.6, 0, 0, 6.28); c.fill();
        c.fillStyle = r.pick(["#3e4a27", "#4f5c30", "#2e3a1e"]);
        c.beginPath(); c.ellipse(0, 0, 6, 2.6, 0, 0, 6.28); c.fill();
        c.strokeStyle = "rgba(20,26,10,0.6)"; c.lineWidth = 0.4; c.beginPath(); c.moveTo(-6, 0); c.lineTo(6, 0); c.stroke();
        c.restore();
      }
    }
    if (look.light) {
      c.save(); c.translate(-22, -20);
      blob(c, 1, 1.5, 7.5, "rgba(0,0,0,0.3)");
      blob(c, 0, 0, 7, "#3a3c34");
      const g = c.createRadialGradient(-1.5, -1.5, 0.5, 0, 0, 5);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.5, "#e8ead8"); g.addColorStop(1, "#9ea290");
      blob(c, 0, 0, 5, g);
      c.strokeStyle = "rgba(40,40,36,0.5)"; c.lineWidth = 0.4;
      for (let i = -4; i <= 4; i += 2) { c.beginPath(); c.moveTo(i, -4.6); c.lineTo(i, 4.6); c.stroke(); }
      c.restore();
    }
    return (baseCache[key] = { cv, S });
  }

  // ------------------------------------------------------------------ weapons (rotate with the aim)
  // The six original guns, redrawn. They replace the simpler art.js versions on the shared GUN table.
  GUN.mg = function (c, t, rec, twin) {
    const k = -rec * 2.5;
    // Tripod: two rear legs and the front leg, lit along the top.
    c.lineCap = "round";
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-9, -7); c.moveTo(0, 0); c.lineTo(-9, 7); c.moveTo(0, 0); c.lineTo(9, 0);
    c.strokeStyle = OUT; c.lineWidth = 2.6; c.stroke();
    c.strokeStyle = "#3d3b31"; c.lineWidth = 1.6; c.stroke();
    c.strokeStyle = "rgba(200,190,150,0.3)"; c.lineWidth = 0.5; c.stroke();
    // Belt box on the left with the belt running up into the feed.
    crate(c, 0, 9.5, 7, 4.6, "#4e5a33");
    c.fillStyle = "#e8e2cf"; c.fillRect(-2, 9, 2.6, 0.7);
    for (const off of twin ? [-2.8, 2.8] : [0]) {
      belt(c, 1, 7.4, 2, off + 5, 2 + k, off + 2.4, twin ? 5 : 7);
      // Perforated cooling jacket.
      tube(c, 6 + k, off, 13, 4.2, ST, 5 + off);
      c.fillStyle = "rgba(8,8,6,0.75)";
      for (let x = 8; x < 18; x += 2.1) { c.fillRect(x + k, off - 1.1, 0.9, 0.8); c.fillRect(x + 1 + k, off + 0.4, 0.9, 0.8); }
      // Receiver, spade grips and the cone of the flash hider.
      const p = () => rr(c, -6 + k, off - 2.5, 13, 5, 1.2);
      p(); c.fillStyle = lin(c, off - 2.5, off + 2.5, "#1c1d18", "#5e6255", "#34372f"); c.fill(); outline(c, p, 0.9);
      c.fillStyle = "rgba(0,0,0,0.45)"; c.fillRect(-1 + k, off - 2.5, 0.5, 5);
      c.fillStyle = "#24241f"; c.fillRect(-8.4 + k, off - 2, 2.6, 1.3); c.fillRect(-8.4 + k, off + 0.7, 2.6, 1.3);
      poly(c, [[19 + k, off - 1.3], [24 + k, off - 1.9], [24 + k, off + 1.9], [19 + k, off + 1.3]]);
      c.fillStyle = "#1a1b17"; c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.6; c.stroke();
      c.fillStyle = "#4a4a40"; c.fillRect(2 + k, off - 0.6, 3, 1.2);
    }
    crew(c, -11.5, 0, 0, { reach: 3.2, spread: twin ? 1 : 0 });
    crew(c, -3.5, 11.5, -0.7, { reach: 3 });
  };
  GUN.mg.cmd = [-11.5, 0];
  GUN.atr = function (c, t, rec) {
    const k = -rec * 3;
    // Prone rifleman: boots, legs, body, then the long rifle on its bipod.
    c.lineCap = "round";
    c.beginPath(); c.moveTo(-14, -2); c.lineTo(-23, -4.5); c.moveTo(-14, 2); c.lineTo(-23, 4.5);
    c.strokeStyle = OUT; c.lineWidth = 3.4; c.stroke();
    c.strokeStyle = "#5a5436"; c.lineWidth = 2.4; c.stroke();
    blob(c, -23.4, -4.6, 1.3, "#1e1a14"); blob(c, -23.4, 4.6, 1.3, "#1e1a14");
    const p = () => rr(c, -16, -4, 14, 8, 3.6);
    p(); c.fillStyle = lin(c, -4, 4, "#3f3b25", "#8a8258", "#665f3e"); c.fill();
    c.strokeStyle = "rgba(30,24,12,0.6)"; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-10, -4); c.lineTo(-10, 4); c.stroke();
    outline(c, p, 0.8);
    crate(c, -9, -4.6, 4, 2.4, "#5a5232");
    c.beginPath(); c.moveTo(-4, -3.4); c.lineTo(3 + k, -1.4); c.moveTo(-4, 3.4); c.lineTo(-1 + k, 1.6);
    c.strokeStyle = OUT; c.lineWidth = 2.3; c.stroke(); c.strokeStyle = "#6a6442"; c.lineWidth = 1.5; c.stroke();
    // Ur wz.35: wooden stock, long thin barrel, box magazine and its muzzle brake.
    c.save(); c.translate(k, 0);
    const s = () => poly(c, [[-7, -1.6], [3, -1.8], [3, 1.8], [-7, 2.2], [-9, 1.2], [-9, -1]]);
    s(); c.fillStyle = diag(c, -9, -2, 12, 4, "#9a7246", "#6b4b2c", "#3e2a16"); c.fill(); outline(c, s, 0.7);
    tube(c, 2, 0, 28, 2.2, ST, 3);
    rr(c, 3, -3.4, 3, 1.9, 0.4); c.fillStyle = "#2a2b25"; c.fill();
    brake(c, 29, 0, 3.6, 3.2);
    c.restore();
    c.lineCap = "round";
    c.beginPath(); c.moveTo(18, 0); c.lineTo(21, -5); c.moveTo(18, 0); c.lineTo(21, 5);
    c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(); c.strokeStyle = "#45463c"; c.lineWidth = 0.9; c.stroke();
    crew(c, -2, 0, 0, { arms: false });
    // The loader lies beside him with spare magazines.
    crew(c, -8, -10, 0.3, { reach: 3 });
    crate(c, -13, -14, 4, 3, "#4e5a33");
  };
  GUN.atr.cmd = [-8, -10];
  GUN.at37 = function (c, t, rec) {
    const k = -rec * 5;
    // Split trail legs with spades.
    c.lineCap = "round";
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(-1, s * 2); c.lineTo(-20, s * 9.5);
      c.strokeStyle = OUT; c.lineWidth = 3.8; c.stroke();
      c.strokeStyle = OL.base; c.lineWidth = 2.6; c.stroke();
      c.strokeStyle = "rgba(220,230,180,0.3)"; c.lineWidth = 0.6; c.stroke();
      rr(c, -23, s * 9.5 - 2.4, 3, 4.8, 0.8); fillStroke(c, "#25261f", 0.7);
    }
    rr(c, -2.5, -11, 3, 22, 1); fillStroke(c, "#2c2e26", 0.7);
    discWheel(c, -1, -11.5, 10, 3.6); discWheel(c, -1, 11.5, 10, 3.6);
    shield(c, 3, -10, 10, 3, 13);
    // Cradle, recoil cylinder, barrel and the slotted muzzle brake.
    const p = () => rr(c, -4, -3.2, 12, 6.4, 1.5);
    p(); c.fillStyle = lin(c, -3.2, 3.2, OL.dark, OL.light, OL.base); c.fill(); outline(c, p, 0.9);
    tube(c, -8 + k, 0, 33, 3.2, ST, 37);
    brake(c, 24 + k, 0, 6, 5.2);
    rr(c, -10 + k, -2.6, 4, 5.2, 0.8); fillStroke(c, "#4d5245", 0.8);
    c.fillStyle = "#c9a54a"; c.fillRect(-10.5 + k, -0.6, 1.4, 1.2);
    crew(c, -9, -5.5, 0.1, { reach: 4 });
    crew(c, -10, 5.5, -0.1, { reach: 3.5, hold: (cc) => { cc.fillStyle = "#c9a54a"; cc.fillRect(-1, 0.5, 4, 1.4); cc.fillStyle = "#2a2a22"; cc.fillRect(3, 0.5, 1.4, 1.4); } });
  };
  GUN.at37.cmd = [-9, -5.5];
  GUN.mortar = function (c, t, rec) {
    // Baseplate with its ribs.
    const bp = () => rr(c, -9, -6.5, 11, 13, 2);
    bp(); c.fillStyle = diag(c, -9, -6.5, 11, 13, "#6a6d60", "#45483e", "#25271f"); c.fill();
    c.strokeStyle = "rgba(10,10,8,0.6)"; c.lineWidth = 0.5;
    c.beginPath(); c.moveTo(-9, -6.5); c.lineTo(2, 6.5); c.moveTo(-9, 6.5); c.lineTo(2, -6.5); c.stroke();
    wear(c, bp, 19, -9, -6.5, 11, 13, 6); outline(c, bp, 0.9);
    // Bipod, traverse wheel and the sight.
    c.lineCap = "round";
    c.beginPath(); c.moveTo(9, 0); c.lineTo(13, -8); c.moveTo(9, 0); c.lineTo(13, 8);
    c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke(); c.strokeStyle = "#45483d"; c.lineWidth = 1.4; c.stroke();
    blob(c, 13, -8, 1.2, "#22231d"); blob(c, 13, 8, 1.2, "#22231d");
    c.beginPath(); c.moveTo(11.5, -4.5); c.lineTo(11.5, 4.5); c.strokeStyle = "#30322a"; c.lineWidth = 1; c.stroke();
    c.beginPath(); c.arc(9, -3.6, 1.6, 0, 6.28); c.strokeStyle = "#1e1f1a"; c.lineWidth = 0.7; c.stroke();
    rr(c, 5, 2.6, 3, 2, 0.4); fillStroke(c, "#2a2b24", 0.5);
    // The tube, steep and foreshortened, and its open muzzle.
    // Widens toward the muzzle, which stands higher and nearer the eye.
    const m = 11 + rec * 1.5;
    const tb = () => poly(c, [[-4, -2.2], [m, -3.1], [m, 3.1], [-4, 2.2]]);
    tb(); c.fillStyle = lin(c, -3.1, 3.1, ST.dark, ST.light, ST.base); c.fill();
    wear(c, tb, 21, -4, -3, m + 4, 6, 4);
    c.fillStyle = "rgba(255,255,235,0.22)"; c.fillRect(-3, -1.5, m + 2, 0.5);
    outline(c, tb, 0.9);
    c.fillStyle = "#24261f"; c.fillRect(4, -2.8, 1.4, 5.6);
    c.beginPath(); c.arc(11 + rec * 1.5, 0, 3.1, 0, 6.28); c.fillStyle = "#4a4e42"; c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.8; c.stroke();
    blob(c, 11 + rec * 1.5, 0, 2.2, "#0b0b09");
    c.beginPath(); c.arc(11 + rec * 1.5, 0, 2.8, 3.4, 5.0); c.strokeStyle = "rgba(255,255,230,0.35)"; c.lineWidth = 0.5; c.stroke();
    // An open bomb case.
    crate(c, -14, -12, 8, 5.4);
    for (let i = 0; i < 3; i++) { blob(c, -16.5 + i * 2.5, -12, 0.95, "#8a8a6a"); blob(c, -16.5 + i * 2.5, -12, 0.4, "#2a2a22"); }
    crew(c, 3, -11, 1.25, { reach: 3.5 });
    crew(c, -2, 11, -1.4, { reach: 4.5, hold: (cc) => { blob(cc, 0.5, 0, 1.6, "#4a4c3c"); blob(cc, 0.5, 0, 0.6, "#c8c0a0"); } });
  };
  GUN.mortar.cmd = [3, -11];
  GUN.aa = function (c, t, rec) {
    const k = -rec * 3;
    // Cruciform platform: four outriggers with screw jacks.
    c.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2, ex = Math.cos(a) * 16, ey = Math.sin(a) * 16;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(ex, ey);
      c.strokeStyle = OUT; c.lineWidth = 4; c.stroke();
      c.strokeStyle = "#3a4130"; c.lineWidth = 2.8; c.stroke();
      c.strokeStyle = "rgba(220,230,180,0.25)"; c.lineWidth = 0.6; c.stroke();
      rr(c, ex - 2, ey - 2, 4, 4, 0.8); fillStroke(c, "#2a2b24", 0.7);
      blob(c, ex, ey, 0.8, "#6a6a5c");
    }
    const p = () => { c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); };
    p(); c.fillStyle = diag(c, -9, -9, 18, 18, OL.light, OL.base, OL.dark); c.fill(); wear(c, p, 27, -9, -9, 18, 18, 10); outline(c, p, 1);
    c.beginPath(); c.arc(0, 0, 6, 0, 6.28); c.strokeStyle = "rgba(0,0,0,0.35)"; c.lineWidth = 0.6; c.stroke();
    // Layers' seats and handwheels.
    for (const s of [-1, 1]) { rr(c, -6, s * 8 - 1.6, 5, 3.2, 1); fillStroke(c, "#2c2f26", 0.6); c.beginPath(); c.arc(-0.5, s * 6, 1.6, 0, 6.28); c.strokeStyle = "#1a1a16"; c.lineWidth = 0.6; c.stroke(); }
    // Barrel, recoil spring housing, flash hider and a four round clip on top.
    tube(c, -6 + k, 0, 34, 4.2, ST, 29);
    const h = () => rr(c, -7 + k, -3.3, 15, 6.6, 1.4);
    h(); c.fillStyle = lin(c, -3.3, 3.3, OL.dark, OL.light, OL.base); c.fill(); outline(c, h, 0.9);
    poly(c, [[27 + k, -2.4], [34 + k, -3.6], [34 + k, 3.6], [27 + k, 2.4]]);
    c.fillStyle = lin(c, -3.6, 3.6, "#0e0f0c", "#4a4f44", "#24261f"); c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.8; c.stroke();
    c.fillStyle = "#2a2a22"; c.fillRect(-3 + k, -2, 7, 4);
    for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? "#d8b85c" : "#c09a40"; c.fillRect(-2.6 + k + i * 1.7, -1.6, 1.4, 3.2); c.fillStyle = "#6a5a3a"; c.fillRect(-2.6 + k + i * 1.7, -1.6, 1.4, 0.6); }
    crew(c, -4, -11, 0.2, { reach: 3.5 });
    crew(c, -4, 11, -0.2, { reach: 3.5 });
    crew(c, -14, 0, 0, { reach: 4, hold: (cc) => { cc.fillStyle = "#c09a40"; cc.fillRect(-1, -1.6, 3, 3.2); } });
  };
  GUN.aa.cmd = [-14, 0];
  GUN.f75 = function (c, t, rec, o) {
    o = o || {};
    const k = -rec * 6;
    // Pole trail with its spade and handspike.
    const tr = () => poly(c, [[-2, -3.2], [-28, -1.8], [-30, 0], [-28, 1.8], [-2, 3.2]]);
    tr(); c.fillStyle = lin(c, -3.2, 3.2, OL.dark, OL.light, OL.base); c.fill(); wear(c, tr, 61, -30, -3, 28, 6, 8); outline(c, tr, 1);
    c.beginPath(); c.arc(-30, 0, 3, Math.PI * 0.6, Math.PI * 1.4); c.strokeStyle = "#1e1f1a"; c.lineWidth = 1.6; c.stroke();
    c.beginPath(); c.arc(-24, 0, 1.6, 0, 6.28); c.strokeStyle = "#2a2a24"; c.lineWidth = 0.7; c.stroke();
    // Axle and the big spoked wheels.
    rr(c, -2.5, -14, 3, 28, 1); fillStroke(c, "#2c2e26", 0.7);
    wheel(c, -1, -14.5, 7.5, 2.8); wheel(c, -1, 14.5, 7.5, 2.8);
    shield(c, 3, -13, 13, 3.4, 75);
    c.fillStyle = "#1a1b16"; c.fillRect(3.5, -3, 3, 1.2);
    // Cradle with the recoil cylinder, then the barrel.
    const cr = () => rr(c, -9, -3.9, 30, 7.8, 1.6);
    cr(); c.fillStyle = lin(c, -3.9, 3.9, OL.dark, OL.light, OL.base); c.fill(); wear(c, cr, 63, -9, -4, 30, 8, 8); outline(c, cr, 0.9);
    const L = o.long ? 58 : 44;
    tube(c, -12 + k, 0, L, 4.6, ST, 77);
    if (o.long) brake(c, -12 + L - 1 + k, 0, 6, 7.4);
    else { rr(c, 30 + k, -3.1, 3, 6.2, 0.8); fillStroke(c, "#25271f", 0.7); }
    rr(c, -14.5 + k, -3.3, 4, 6.6, 1); fillStroke(c, "#565b4d", 0.8);
    c.strokeStyle = "#20211b"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-14 + k, 3.3); c.lineTo(-16 + k, 5.4); c.stroke();
    crew(c, -15, -8, 0.15, { reach: 3.5 });
    crew(c, -15, 8.5, -0.1, { reach: 3.5, hold: (cc) => { cc.fillStyle = "#c9a54a"; cc.fillRect(-2, -0.6, 5, 2); cc.fillStyle = "#3a3e30"; cc.fillRect(3, -0.6, 1.8, 2); } });
    crew(c, -22, -9, 0.3, { reach: 2.5, hold: (cc) => { cc.fillStyle = "#1c1c18"; cc.fillRect(-0.8, -2.4, 1.6, 4.8); } });
  };
  GUN.f75.cmd = [-22, -9];

  const W = {};
  W.mg = (c, t, k) => GUN.mg(c, t, k, false);
  W.mg.cmd = GUN.mg.cmd;
  W.mg2 = (c, t, k) => GUN.mg(c, t, k, true);
  W.mg2.cmd = GUN.mg.cmd;
  W.mg4 = (c, t, rec) => {
    const k = -rec * 2.5;
    // Quad pivot: a pedestal ring, four Brownings, a drum of belts each side.
    blob(c, 0.8, 1, 10, "rgba(0,0,0,0.22)");
    const p = () => { c.beginPath(); c.arc(0, 0, 9, 0, 6.28); };
    p(); c.fillStyle = diag(c, -9, -9, 18, 18, "#5e6253", "#3a3d33", "#1e201a"); c.fill(); wear(c, p, 33, -9, -9, 18, 18, 8); outline(c, p, 1);
    for (const off of [-6.5, -2.2, 2.2, 6.5]) {
      tube(c, 4 + k, off, 13, 3.2, ST, 40 + off * 3);
      c.fillStyle = "rgba(8,8,6,0.7)"; for (let x = 6; x < 16; x += 2.2) c.fillRect(x + k, off - 0.4, 0.9, 0.8);
      rr(c, -3 + k, off - 1.9, 8, 3.8, 1); fillStroke(c, "#2e302a", 0.7);
      c.fillStyle = "#17170f"; c.fillRect(17 + k, off - 0.9, 4.5, 1.8);
    }
    for (const s of [-1, 1]) { crate(c, -5, s * 12, 7, 4.4, "#4e5a33"); belt(c, -3, s * 9.6, -1, s * 9, 0 + k, s * 6.5, 4); }
    c.fillStyle = "#e8e2cf"; c.fillRect(-1.5, -1.2, 3, 2.4);
    crew(c, -9, 0, 0, { reach: 4, spread: 2 });
  };
  W.mg4.cmd = [-9, 0];
  W.can20 = (c, t, rec) => {
    const k = -rec * 4;
    // 20mm wz.38 on its pedestal, with a curved shield and a top box magazine.
    rr(c, -6, -6, 12, 12, 2.5); fillStroke(c, "#2c2e26", 0.8);
    shield(c, 4, -8.5, 8.5, 3, 21);
    tube(c, -8 + k, 0, 34, 3.6, ST, 23);
    brake(c, 26 + k, 0, 5, 4.6);
    const h = () => rr(c, -9 + k, -3.2, 13, 6.4, 1.2);
    h(); c.fillStyle = lin(c, -3.2, 3.2, "#1e2019", "#626657", "#3a3d33"); c.fill(); outline(c, h, 0.8);
    rr(c, -5 + k, -7.5, 6, 4.6, 0.8); fillStroke(c, "#4e5a33", 0.8);
    c.fillStyle = "#c9a54a"; c.fillRect(-4.4 + k, -3.6, 4.8, 0.8);
    crew(c, -11, -5, 0.1, { reach: 3.5 });
    crew(c, -11, 5, -0.1, { reach: 3.5 });
  };
  W.can20.cmd = [-11, -5];
  W.flamer = (c, t, rec) => {
    // Bunker flamethrower: twin fuel bottles, the pressure line and a long nozzle.
    for (const y of [-6, 6]) {
      const p = () => rr(c, -15, y - 3.3, 12, 6.6, 3.3);
      p(); c.fillStyle = lin(c, y - 3.3, y + 3.3, "#2a3020", "#7a8a5a", "#4c5a3a"); c.fill(); outline(c, p, 0.9);
      c.fillStyle = "#c23b2a"; c.fillRect(-12, y - 3.3, 1.2, 6.6);
      blob(c, -3.6, y, 1.2, "#22221c");
    }
    c.strokeStyle = "#1c1b16"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-3, -6); c.quadraticCurveTo(0, -2, 0, 0); c.moveTo(-3, 6); c.quadraticCurveTo(0, 2, 0, 0); c.stroke();
    tube(c, -4, 0, 26, 3, { base: "#44403a", light: "#7a746a", dark: "#1e1c18" }, 31);
    rr(c, 21, -2.4, 4.4, 4.8, 1); fillStroke(c, "#1a1814", 0.7);
    blob(c, 25, 0, 1.2, rec > 0.1 ? "#ffd27a" : "#3a2a1a");
    if (rec > 0.1) { blob(c, 27, 0, 3, "rgba(255,170,60,0.85)"); blob(c, 27, 0, 1.6, "rgba(255,240,180,0.9)"); }
    crew(c, -8, 0, 0, { reach: 5 });
  };
  W.flamer.cmd = [-8, 0];
  W.atr = (c, t, k) => GUN.atr(c, t, k);
  W.atr.cmd = GUN.atr.cmd;
  W.atr2 = (c, t, k) => { c.save(); c.translate(0, -7); GUN.atr(c, t, k); c.restore(); c.save(); c.translate(-4, 7); GUN.atr(c, t, k * 0.6); c.restore(); };
  W.atr2.cmd = [-8, -17];
  W.atr4 = (c, t, k) => { for (const [x, y] of [[0, -18], [-3, -6], [0, 6], [-3, 18]]) { c.save(); c.translate(x, y); c.scale(0.9, 0.9); GUN.atr(c, t, k); c.restore(); } };
  W.atr4.cmd = [-7.2, -27];
  W.at37 = (c, t, k) => GUN.at37(c, t, k);
  W.at37.cmd = GUN.at37.cmd;
  W.at37x2 = (c, t, k) => { for (const y of [-12, 12]) { c.save(); c.translate(0, y); c.scale(0.85, 0.85); GUN.at37(c, t, k); c.restore(); } };
  W.at37x2.cmd = [-7.65, -16.7];
  W.mortar = (c, t, k) => GUN.mortar(c, t, k);
  W.mortar.cmd = GUN.mortar.cmd;
  W.mortar2 = (c, t, k) => { for (const y of [-9, 9]) { c.save(); c.translate(0, y); c.scale(0.85, 0.85); GUN.mortar(c, t, k); c.restore(); } };
  W.mortar2.cmd = [2.55, -18.35];
  W.mortar4 = (c, t, k) => { for (const [x, y] of [[-6, -10], [-6, 10], [8, -10], [8, 10]]) { c.save(); c.translate(x, y); c.scale(0.7, 0.7); GUN.mortar(c, t, k); c.restore(); } };
  W.mortar4.cmd = [-3.9, -17.7];
  W.mortar120 = (c, t, rec) => {
    // 120mm: a heavy round baseplate, a fat tube, three crew and a row of big bombs.
    const bp = () => { c.beginPath(); c.arc(-4, 0, 10, 0, 6.28); };
    bp(); c.fillStyle = diag(c, -14, -10, 20, 20, "#686b5e", "#3e4137", "#1e201a"); c.fill();
    c.strokeStyle = "rgba(10,10,8,0.55)"; c.lineWidth = 0.6;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28; c.beginPath(); c.moveTo(-4, 0); c.lineTo(-4 + Math.cos(a) * 10, Math.sin(a) * 10); c.stroke(); }
    wear(c, bp, 51, -14, -10, 20, 20, 8); outline(c, bp, 1);
    c.lineCap = "round";
    c.beginPath(); c.moveTo(12, 0); c.lineTo(17, -11); c.moveTo(12, 0); c.lineTo(17, 11);
    c.strokeStyle = OUT; c.lineWidth = 3.2; c.stroke(); c.strokeStyle = "#3e4136"; c.lineWidth = 2; c.stroke();
    blob(c, 17, -11, 1.6, "#1e1f1a"); blob(c, 17, 11, 1.6, "#1e1f1a");
    tube(c, -6, 0, 21 + rec * 2, 10, { base: "#434838", light: "#7a8068", dark: "#1e2119" }, 53);
    c.beginPath(); c.arc(15 + rec * 2, 0, 5, 0, 6.28); c.fillStyle = "#50554a"; c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.9; c.stroke();
    blob(c, 15 + rec * 2, 0, 3.8, "#0b0b09");
    c.beginPath(); c.arc(15 + rec * 2, 0, 4.4, 3.4, 5.0); c.strokeStyle = "rgba(255,255,230,0.35)"; c.lineWidth = 0.6; c.stroke();
    crate(c, -17, -14, 9, 6); crate(c, -17, 14, 9, 6, "#5e5a30", "#b08f3b");
    for (let i = 0; i < 3; i++) { blob(c, -20 + i * 3, -14, 1.2, "#7a7a5c"); blob(c, -20 + i * 3, -14, 0.5, "#222"); }
    crew(c, -14, 0, 0, { reach: 4 }); crew(c, 3, 13.5, -1.3, { reach: 3.5 }); crew(c, 3, -13.5, 1.3, { reach: 3.5 });
  };
  W.mortar120.cmd = [-14, 0];
  W.mortarSiege = (c, t, rec) => {
    // A siege mortar on a tracked bed, with its own ammunition sledge.
    for (const s of [-1, 1]) {
      const p = () => rr(c, -12, s * 14 - 4, 22, 8, 3);
      p(); c.fillStyle = lin(c, s * 14 - 4, s * 14 + 4, "#0e0e0c", "#3c3c34", "#1e1e1a"); c.fill(); outline(c, p, 0.9);
      c.strokeStyle = "rgba(110,106,92,0.55)"; c.lineWidth = 0.6;
      for (let x = -10; x < 10; x += 2.4) { c.beginPath(); c.moveTo(x, s * 14 - 4); c.lineTo(x, s * 14 + 4); c.stroke(); }
    }
    const b = () => rr(c, -12, -11, 22, 22, 3);
    b(); c.fillStyle = diag(c, -12, -11, 22, 22, OL.light, OL.base, OL.dark); c.fill(); wear(c, b, 71, -12, -11, 22, 22, 12); outline(c, b, 1);
    c.fillStyle = "rgba(20,20,14,0.7)"; for (const [x, y] of [[-10, -9], [8, -9], [-10, 9], [8, 9]]) c.fillRect(x, y, 1, 1);
    blob(c, -2, 0, 10, "#30322b");
    tube(c, -8, 0, 30 + rec * 3, 14, { base: "#3f4436", light: "#767c66", dark: "#1a1c16" }, 73);
    c.fillStyle = "rgba(0,0,0,0.45)"; c.fillRect(4, -7, 1.2, 14); c.fillRect(12, -7, 1.2, 14);
    c.beginPath(); c.arc(21 + rec * 3, 0, 7, 0, 6.28); c.fillStyle = "#4c5144"; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
    blob(c, 21 + rec * 3, 0, 5.4, "#0b0b09");
    c.beginPath(); c.arc(21 + rec * 3, 0, 6.2, 3.4, 5.0); c.strokeStyle = "rgba(255,255,230,0.35)"; c.lineWidth = 0.7; c.stroke();
    crate(c, -23, -6, 10, 7); crate(c, -23, 6, 10, 7, "#5e5a30", "#b08f3b");
    crew(c, -15, -15, 0.3); crew(c, -15, 15, -0.3); crew(c, 6, 19, -1.2);
  };
  W.mortarSiege.cmd = [-15, -15];
  W.aa = (c, t, k) => GUN.aa(c, t, k);
  W.aa.cmd = GUN.aa.cmd;
  W.aa2 = (c, t, rec) => {
    const k = -rec * 3;
    c.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2, ex = Math.cos(a) * 17, ey = Math.sin(a) * 17;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(ex, ey);
      c.strokeStyle = OUT; c.lineWidth = 4.2; c.stroke(); c.strokeStyle = "#3a4130"; c.lineWidth = 3; c.stroke();
      rr(c, ex - 2, ey - 2, 4, 4, 0.8); fillStroke(c, "#2a2b24", 0.7);
    }
    const p = () => { c.beginPath(); c.arc(0, 0, 10.5, 0, 6.28); };
    p(); c.fillStyle = diag(c, -10, -10, 20, 20, OL.light, OL.base, OL.dark); c.fill(); wear(c, p, 29, -10, -10, 20, 20, 10); outline(c, p, 1);
    for (const y of [-4.2, 4.2]) {
      tube(c, -6 + k, y, 34, 3.6, ST, 30 + y);
      poly(c, [[27 + k, y - 2], [33 + k, y - 3], [33 + k, y + 3], [27 + k, y + 2]]);
      c.fillStyle = "#1c1d18"; c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.7; c.stroke();
    }
    const h = () => rr(c, -7 + k, -7.4, 15, 14.8, 2);
    h(); c.fillStyle = lin(c, -7.4, 7.4, OL.dark, OL.light, OL.base); c.fill(); outline(c, h, 0.9);
    for (const y of [-4.2, 4.2]) for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? "#d8b85c" : "#c09a40"; c.fillRect(-3 + k + i * 1.6, y - 1.4, 1.3, 2.8); }
    crew(c, -4, -13, 0.25); crew(c, -4, 13, -0.25);
    crew(c, -14, 0, 0, { reach: 4, hold: (cc) => { cc.fillStyle = "#c09a40"; cc.fillRect(-1, -1.6, 3, 3.2); } });
  };
  W.aa2.cmd = [-14, 0];
  W.f75 = (c, t, k) => GUN.f75(c, t, k);
  W.f75.cmd = GUN.f75.cmd;
  W.f75long = (c, t, rec) => GUN.f75(c, t, rec, { long: true });
  W.f75long.cmd = GUN.f75.cmd;
  W.f75x2 = (c, t, k) => { for (const y of [-26, 26]) { c.save(); c.translate(0, y); c.scale(0.8, 0.8); GUN.f75(c, t, k); c.restore(); } };
  W.f75x2.cmd = [-17.6, -33.2];
  W.howitzer = (c, t, rec) => {
    const k = -rec * 4;
    // 100mm wz.14/19: split box trail, spoked wheels, a short fat barrel over a long cradle.
    c.lineCap = "round";
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(-2, s * 2); c.lineTo(-27, s * 8);
      c.strokeStyle = OUT; c.lineWidth = 4.6; c.stroke(); c.strokeStyle = OL.base; c.lineWidth = 3.4; c.stroke();
      c.strokeStyle = "rgba(220,230,180,0.28)"; c.lineWidth = 0.7; c.stroke();
      rr(c, -30, s * 8 - 2.6, 3.4, 5.2, 0.8); fillStroke(c, "#22231d", 0.7);
    }
    rr(c, -2.5, -15, 3, 30, 1); fillStroke(c, "#2c2e26", 0.7);
    wheel(c, -1, -15, 8, 3); wheel(c, -1, 15, 8, 3);
    shield(c, 3, -12, 12, 3.6, 81);
    const cr = () => rr(c, -12, -5.4, 30, 10.8, 2);
    cr(); c.fillStyle = lin(c, -5.4, 5.4, OL.dark, OL.light, OL.base); c.fill(); wear(c, cr, 83, -12, -5.4, 30, 10.8, 9); outline(c, cr, 1);
    tube(c, -9 + k, 0, 33, 8.4, ST, 85);
    c.fillStyle = "rgba(0,0,0,0.4)"; c.fillRect(6 + k, -4.2, 0.9, 8.4);
    rr(c, 22 + k, -4.8, 3, 9.6, 1); fillStroke(c, "#25271f", 0.8);
    rr(c, -12.5 + k, -4, 4, 8, 1); fillStroke(c, "#565b4d", 0.8);
    shellRack(c, -21, -12, 3, 0.3);
    crew(c, -13, -10, 0.2); crew(c, -13, 10, -0.2, { hold: (cc) => { cc.fillStyle = "#c9a54a"; cc.fillRect(-2, -0.8, 5, 2.4); cc.fillStyle = "#3a3e30"; cc.fillRect(3, -0.8, 2, 2.4); } });
    crew(c, -21, 0, 0, { reach: 2.5 });
  };
  W.howitzer.cmd = [-21, 0];
  W.howitzer3 = (c, t, k) => { for (const y of [-28, 0, 28]) { c.save(); c.translate(y === 0 ? 4 : 0, y); c.scale(0.72, 0.72); W.howitzer(c, t, k); c.restore(); } };
  W.howitzer3.cmd = [-11.1, 0];
  W.turret75 = (c, t, rec) => {
    const k = -rec * 5;
    blob(c, 1.5, 2, 18, "rgba(0,0,0,0.3)");
    tube(c, 12 + k, 0, 34, 6, ST, 91);
    rr(c, 44 + k, -3.9, 3.4, 7.8, 0.8); fillStroke(c, "#24261f", 0.8);
    rr(c, 13, -4.6, 6, 9.2, 1.5); fillStroke(c, "#4b4a44", 0.9);
    const g = c.createRadialGradient(-5, -5, 2, 0, 0, 18);
    g.addColorStop(0, "#a9a698"); g.addColorStop(0.6, "#6c6a62"); g.addColorStop(1, "#3e3d38");
    const p = () => { c.beginPath(); c.arc(0, 0, 17, 0, 6.28); };
    p(); c.fillStyle = g; c.fill(); wear(c, p, 93, -17, -17, 34, 34, 16); outline(c, p, 1.3);
    c.beginPath(); c.arc(0, 0, 17, -0.7, 0.7); c.strokeStyle = "rgba(255,255,240,0.2)"; c.lineWidth = 2; c.stroke();
    c.fillStyle = "rgba(20,20,16,0.8)";
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.28; c.fillRect(Math.cos(a) * 14.5 - 0.4, Math.sin(a) * 14.5 - 0.4, 0.8, 0.8); }
    c.beginPath(); c.arc(-7, -6, 4, 0, 6.28); c.fillStyle = "#55534c"; c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.7; c.stroke();
    blob(c, -7, -6, 2.4, "#2a2a26");
    // The gun commander stands up in the hatch.
    crew(c, -7, -6, 0, { arms: false });
    c.fillStyle = "#151512"; c.fillRect(9, -9, 3, 1.2); c.fillRect(9, 7.8, 3, 1.2);
  };
  W.turret75.cmd = [-7, -6];

  // Vehicles: the hull holds its own heading, the turret follows the aim.
  function tracks(c, L, W2) {
    for (const s of [-1, 1]) {
      const y0 = s * (W2 / 2) - (s > 0 ? 5 : 0);
      const p = () => rr(c, -L / 2, y0, L, 5, 2);
      p(); c.fillStyle = lin(c, y0, y0 + 5, "#0f0f0d", "#3e3c34", "#25241f"); c.fill(); outline(c, p, 0.9);
      c.strokeStyle = "rgba(120,114,98,0.6)"; c.lineWidth = 0.6;
      for (let x = -L / 2 + 2; x < L / 2; x += 2.4) { c.beginPath(); c.moveTo(x, y0 + 0.4); c.lineTo(x, y0 + 4.6); c.stroke(); }
    }
  }
  const VEH = {};
  VEH.tank7tp = {
    hull(c, t, look) {
      blob(c, 1.5, 2, 19, "rgba(0,0,0,0.25)");
      tracks(c, 36, 24);
      const p = () => rr(c, -17, -9, 34, 18, 3);
      p(); c.fillStyle = hullGrad(c, 18, "#5a6a3d", "#8a9c62", "#3c4729"); c.fill();
      c.save(); p(); c.clip();
      const r = BK.makeRng(31);
      for (let i = 0; i < 7; i++) { c.fillStyle = i % 2 ? "rgba(122,96,58,0.55)" : "rgba(40,48,30,0.55)"; c.beginPath(); c.ellipse(r.range(-14, 14), r.range(-7, 7), r.range(4, 8), r.range(3, 5), r() * 3, 0, 6.28); c.fill(); }
      c.restore();
      wear(c, p, 35, -17, -9, 34, 18, 16);
      outline(c, p, 1.2);
      // Engine deck louvres, hatches, rivets, exhaust and tools.
      c.fillStyle = "#2c3222"; c.fillRect(-16, -4, 5, 8);
      c.strokeStyle = "rgba(0,0,0,0.5)"; c.lineWidth = 0.5;
      for (let y = -6; y <= 6; y += 1.6) { c.beginPath(); c.moveTo(-10, y); c.lineTo(-5, y); c.stroke(); }
      c.fillStyle = "rgba(20,20,14,0.75)";
      for (let x = -15; x <= 15; x += 3.4) { c.fillRect(x, -8.2, 0.7, 0.7); c.fillRect(x, 7.5, 0.7, 0.7); }
      rr(c, 10, -6.5, 5, 4, 1); fillStroke(c, "#4a5634", 0.6);
      c.fillStyle = "rgba(255,255,230,0.25)"; c.fillRect(-16, -8.4, 32, 0.6);
      c.fillStyle = "#3a2c1c"; c.fillRect(-8, 7.4, 10, 1);
      if (look.vet) {
        // Bolted appliqué plates, a hull MG and a kill tally.
        for (const y of [-9, 6.2]) { rr(c, 2, y, 13, 2.8, 0.6); fillStroke(c, "#4d5a35", 0.6); }
        tube(c, 15, 3.5, 6, 1.6, ST, 3);
        c.fillStyle = "#e8e2cf"; for (let i = 0; i < 5; i++) c.fillRect(-14 + i * 2.4, 5.4, 1, 2.4);
      }
    },
    turret(c, t, rec, look) {
      const k = -rec * 4;
      tube(c, 6 + k, 0, 20, 2.8, ST, 7);
      rr(c, 24 + k, -2, 3, 4, 0.6); fillStroke(c, "#202219", 0.6);
      const p = () => { c.beginPath(); c.arc(0, 0, 8.5, 0, 6.28); };
      p(); c.fillStyle = diag(c, -8, -8, 16, 16, "#8a9c62", "#5a6a3d", "#33401f"); c.fill(); wear(c, p, 9, -8, -8, 16, 16, 8); outline(c, p, 1.1);
      c.beginPath(); c.arc(-2, -2.5, 3, 0, 6.28); c.fillStyle = "#4a5634"; c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.6; c.stroke();
      blob(c, -2, -2.5, 1.6, "#2d331f");
      c.fillStyle = "#151512"; c.fillRect(4.5, 3, 2, 1);
      if (look.vet) { crew(c, -2.5, 3, 0, { arms: false }); c.fillStyle = "#e8e2cf"; c.font = "bold 5px sans-serif"; c.fillText("1", -7, -2); }
    },
  };
  VEH.truck = {
    hull(c, t, look) {
      const plate = look.armored;
      blob(c, 1.5, 2, 20, "rgba(0,0,0,0.25)");
      for (const [x, y] of [[-12, -9.5], [-12, 9.5], [12, -9.5], [12, 9.5], [-5, -9.5], [-5, 9.5]]) { rr(c, x - 3, y - 2, 6, 4, 1.5); c.fillStyle = "#151512"; c.fill(); c.fillStyle = "#3a3a32"; c.fillRect(x - 0.8, y - 1, 1.6, 2); }
      // Cab: bonnet, windscreen and roof.
      const cb = () => rr(c, 8, -7.5, 14, 15, 2.5);
      cb(); c.fillStyle = diag(c, 8, -7.5, 14, 15, plate ? "#6b774f" : "#7a8a5c", plate ? "#4f5a3a" : "#5b6844", "#2f3822"); c.fill(); wear(c, cb, 57, 8, -7.5, 14, 15, 8); outline(c, cb, 1);
      c.strokeStyle = "rgba(0,0,0,0.4)"; c.lineWidth = 0.5;
      for (let y = -5; y <= 5; y += 1.6) { c.beginPath(); c.moveTo(16, y); c.lineTo(21, y); c.stroke(); }
      c.fillStyle = plate ? "#1e2420" : "#6a8a90"; c.fillRect(13, -6, 2.2, 12);
      if (!plate) { c.fillStyle = "rgba(255,255,255,0.35)"; c.fillRect(13.4, -5.4, 0.7, 5); }
      blob(c, 21.5, -5.5, 1.1, "#d8d4b8"); blob(c, 21.5, 5.5, 1.1, "#d8d4b8");
      // Bed.
      const bd = () => rr(c, -21, -9, 29, 18, 1.5);
      bd(); c.fillStyle = plate ? diag(c, -21, -9, 29, 18, "#6b774f", "#56603f", "#363d27") : diag(c, -21, -9, 29, 18, "#8a7650", "#6b5a3c", "#45391f"); c.fill();
      wear(c, bd, 59, -21, -9, 29, 18, 12); outline(c, bd, 1);
      if (!plate) { c.strokeStyle = "rgba(30,20,10,0.5)"; c.lineWidth = 0.6; for (let x = -19; x < 8; x += 3) { c.beginPath(); c.moveTo(x, -9); c.lineTo(x, 9); c.stroke(); } }
      else {
        c.strokeStyle = "rgba(0,0,0,0.4)"; c.lineWidth = 0.8; c.strokeRect(-19, -7, 25, 14);
        c.fillStyle = "rgba(20,20,14,0.75)"; for (let x = -19; x <= 6; x += 3.1) { c.fillRect(x, -8.4, 0.7, 0.7); c.fillRect(x, 7.7, 0.7, 0.7); }
      }
      c.fillStyle = "rgba(255,255,230,0.2)"; c.fillRect(-20, -8.6, 27, 0.6);
      crate(c, -18, -5.5, 5, 4, "#5a5a34", "#b08f3b"); crate(c, -18, 5.5, 5, 4, "#5a5a34", "#b08f3b");
    },
    turret(c, t, rec, look) {
      c.save(); c.translate(-6, 0); c.scale(0.7, 0.7); GUN.aa(c, t, rec); c.restore();
    },
  };

  // Rotating extras on the weapon itself (the searchlight beam is drawn live, see beam()).
  function extras(c, t, look, rec) {
    const k = -rec * 3;
    if (look.scope) {
      // Telescopic sight on its mount, with a lens glint. Twin rifle teams get one on each rifle.
      const at = look.w === "atr2" ? [[0, -7], [-4, 7]] : [[0, 0]];
      for (const [ox, oy] of at) {
        c.save(); c.translate(ox, oy + (look.w === "atr2" ? 1.4 : 0));
        rr(c, 5 + k, -4.2, 11, 2.4, 1.2); c.fillStyle = lin(c, -4.2, -1.8, "#050505", "#4a4a44", "#1a1a18"); c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.6; c.stroke();
        c.fillStyle = "#2a2a24"; c.fillRect(8 + k, -1.9, 1, 1.4); c.fillRect(12 + k, -1.9, 1, 1.4);
        blob(c, 16 + k, -3, 1.25, "#1a1a18"); blob(c, 16 + k, -3, 0.9, "rgba(140,200,255,0.9)"); blob(c, 15.7 + k, -3.3, 0.35, "#ffffff");
        c.restore();
      }
    }
    if (look.sight) {
      // Ring and bead sight for aircraft, wire rings with a center bead.
      c.strokeStyle = "rgba(20,20,18,0.9)"; c.lineWidth = 0.8;
      c.beginPath(); c.arc(16 + k, 0, 5.5, 0, 6.28); c.stroke();
      c.beginPath(); c.arc(16 + k, 0, 2.8, 0, 6.28); c.stroke();
      c.beginPath(); c.moveTo(10.5 + k, 0); c.lineTo(21.5 + k, 0); c.moveTo(16 + k, -5.5); c.lineTo(16 + k, 5.5); c.stroke();
      c.strokeStyle = "rgba(255,255,230,0.3)"; c.lineWidth = 0.4; c.beginPath(); c.arc(16 + k, 0, 5.5, 3.4, 4.8); c.stroke();
      blob(c, 16 + k, 0, 0.8, "#d8c060");
    }
    if (look.bands) bands(c, 4, 0, (t.rank || 0) + 2, k);
    if (look.loader) {
      crew(c, -15, -11, 0.4, { hold: (cc) => { cc.fillStyle = "#c9a54a"; cc.fillRect(-1.5, -0.7, 4, 1.4); } });
      crate(c, -19, -2, 6, 5, "#6b5634", "#c9a54a");
      shellRack(c, -21, 6, 3, 1.57);
    }
    if (look.side) {
      c.save(); c.translate(-2, 16); c.scale(0.7, 0.7); GUN.mg(c, t, rec, false); c.restore();
    }
    if (look.ghillie) {
      const r = BK.makeRng(5);
      for (let i = 0; i < 16; i++) {
        const x = r.range(-24, 2), y = r.range(-7, 7), rad = r.range(1.6, 3.4);
        blob(c, x + 0.5, y + 0.6, rad, "rgba(0,0,0,0.2)");
        blob(c, x, y, rad, r.pick(["#4a5530", "#5f6638", "#3a4426", "#6b6b3e"]));
      }
      c.strokeStyle = "rgba(40,48,20,0.8)"; c.lineWidth = 0.5;
      for (let i = 0; i < 10; i++) { const x = r.range(-22, 0), y = r.range(-6, 6); c.beginPath(); c.moveTo(x, y); c.lineTo(x + r.range(-3, 3), y + r.range(-3, 3)); c.stroke(); }
    }
  }

  // Shared with art3.js, which adds the new guns and their forms.
  A._f = { W, VEH, BASE_R, base, extras, canvas, blob, crate, barrel, bands, tracks };

  const fallbackLook = {};
  A.lookOf = function (t) {
    if (!t.path) return fallbackLook[t.kind] || (fallbackLook[t.kind] = { base: "sandbag", w: t.kind });
    const n = BK.TREES[t.kind][t.path[t.path.length - 1]];
    return (n && n.look) || fallbackLook[t.kind] || (fallbackLook[t.kind] = { base: "sandbag", w: t.kind });
  };

  // ------------------------------------------------------------------ sprite cache for the moving parts
  // Each weapon layer, vehicle hull and vehicle turret is drawn once into an offscreen canvas at SC x,
  // sized to its real painted bounds, and then only blitted (rotated) each frame. Keys:
  //   weapon:  "w|kind|lookJSON|recoilBucket" (+ "|r<rank>" when the look paints kill bands)
  //   hull:    "h|base|lookJSON"     turret: "u|base|lookJSON|recoilBucket"
  // Sprites are made lazily, so only forms that are actually drawn cost memory. A drawer that must
  // animate every frame can opt out with W[name].live = true (or VEH[name].live = true).
  const lookKey = new WeakMap();
  function lk(look) { let s = lookKey.get(look); if (!s) { s = JSON.stringify(look); lookKey.set(look, s); } return s; }
  const REC = [0, 0.45, 0.9];
  function recBucket(r) { return !r ? 0 : r < 0.22 ? 0 : r < 0.67 ? 1 : 2; }
  const sprites = new Map();
  let meas = null;
  const MS = 320;
  function sprite(key, draw) {
    let sp = sprites.get(key);
    if (sp) return sp;
    // Find the painted bounds at 1x, then draw for real at SC x into a tight canvas.
    if (!meas) { const cv = document.createElement("canvas"); cv.width = cv.height = MS; meas = cv.getContext("2d", { willReadFrequently: true }); }
    meas.setTransform(1, 0, 0, 1, 0, 0);
    meas.clearRect(0, 0, MS, MS);
    meas.translate(MS / 2, MS / 2);
    meas.save(); draw(meas); meas.restore();
    let x0 = MS, y0 = MS, x1 = -1, y1 = -1;
    try {
      const d = meas.getImageData(0, 0, MS, MS).data;
      for (let y = 0; y < MS; y++) {
        const row = y * MS * 4;
        for (let x = 0; x < MS; x++) if (d[row + x * 4 + 3] > 3) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y; }
      }
    } catch (e) { x0 = 0; y0 = 0; x1 = MS - 1; y1 = MS - 1; }
    if (x1 < 0) { x0 = y0 = MS / 2 - 2; x1 = y1 = MS / 2 + 2; }
    const bx = x0 - MS / 2 - 2, by = y0 - MS / 2 - 2, bw = x1 - x0 + 5, bh = y1 - y0 + 5;
    const { cv, c } = canvas(bw, bh, SC);
    c.translate(-bx, -by);
    c.save(); draw(c); c.restore();
    sp = { cv, x: bx, y: by, w: bw, h: bh };
    sprites.set(key, sp);
    return sp;
  }
  function blit(c, sp) { c.drawImage(sp.cv, sp.x, sp.y, sp.w, sp.h); }

  // The searchlight beam: one soft gradient image, stretched along the aim each frame.
  let beamCv = null;
  function beam(c) {
    if (!beamCv) {
      const { cv, c: b } = canvas(160, 46, 1);
      const g = b.createLinearGradient(0, 0, 160, 0);
      g.addColorStop(0, "rgba(255,250,220,0.22)"); g.addColorStop(1, "rgba(255,250,220,0)");
      b.fillStyle = g;
      b.beginPath(); b.moveTo(0, 20); b.lineTo(160, 1); b.lineTo(160, 45); b.lineTo(0, 26); b.fill();
      beamCv = cv;
    }
    c.drawImage(beamCv, 0, -23, 160, 46);
  }

  // Rank on the commander's shoulder straps, drawn live because crews earn it mid battle.
  // Szer. plain, Kpr. two bars, Plut. three bars, Sierż. a silver galloon, Chor. galloon and star.
  function rankMark(c, cmd, rank) {
    if (!cmd || !rank) return;
    const x = cmd[0] - 1.9, y = cmd[1];
    for (const s of [-1, 1]) {
      const sy = s > 0 ? y + 1.9 : y - 4.5;
      c.fillStyle = "#1a1810"; c.fillRect(x - 0.3, sy - 0.3, 2.6, 3.2);
      c.fillStyle = rank >= 3 ? "#d8dccd" : "#55502f"; c.fillRect(x, sy, 2, 2.6);
      if (rank < 3) { c.fillStyle = "#e8e2cf"; for (let i = 0; i < rank + 1; i++) c.fillRect(x, sy + 0.25 + i * 0.85, 2, 0.45); }
      else { c.fillStyle = "#55502f"; c.fillRect(x + 0.55, sy + 0.4, 0.9, 1.8); if (rank >= 4) { c.fillStyle = "#ffd84d"; c.fillRect(x + 0.4, sy + 0.9, 1.2, 0.9); } }
    }
  }

  A.gun = function (c, t, opts) {
    const look = A.lookOf(t);
    const b = base(look, t.kind);
    const L = lk(look);
    const rb = recBucket(t.recoil);
    c.save();
    c.translate(t.x, t.y);
    c.scale(BK.GS, BK.GS);
    const v = VEH[look.base];
    if (t.ko > 0) c.globalAlpha = 0.55;
    c.drawImage(b.cv, -b.S / 2, -b.S / 2, b.S, b.S);
    if (v) {
      if (t.baseAng == null) t.baseAng = t.ang;
      // A drawer marked live (v.live) animates per frame and skips the cache.
      c.save(); c.rotate(t.baseAng);
      if (v.live) v.hull(c, t, look);
      else { const hk = "h|" + look.base + "|" + L; blit(c, sprites.get(hk) || sprite(hk, (cc) => v.hull(cc, t, look))); }
      c.restore();
      c.rotate(t.ang);
      if (v.live) v.turret(c, t, t.recoil || 0, look);
      else { const uk = "u|" + look.base + "|" + L + "|" + rb; blit(c, sprites.get(uk) || sprite(uk, (cc) => v.turret(cc, t, REC[rb], look))); }
    } else {
      c.rotate(t.ang);
      // The raised tower lifts the guns: draw them a little larger.
      if (look.base === "tower") c.scale(1.08, 1.08);
      // A form with no weapon of its own (the Fortress Gun) uses the drawer named after its base.
      const fn = W[look.w] || W[look.base] || W[t.kind] || W.mg;
      if (fn.live) { fn(c, t, t.recoil || 0); extras(c, t, look, t.recoil || 0); }
      else {
        const wk = "w|" + t.kind + "|" + L + "|" + rb + (look.bands ? "|r" + (t.rank || 0) : "");
        blit(c, sprites.get(wk) || sprite(wk, (cc) => { fn(cc, t, REC[rb]); extras(cc, t, look, REC[rb]); }));
      }
      rankMark(c, fn.cmd, t.rank || 0);
      if (look.light) beam(c);
    }
    c.restore();
  };
  A.gunCacheSize = function () { return sprites.size; };

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
  A.trainCar = function (c, kind, t, turretAngle) {
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
        if (turretAngle != null) c.rotate(turretAngle);
        blob(c, 0, 0, 8.5, "#4a5236");
        c.strokeStyle = OUT; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 8.5, 0, 6.28); c.stroke();
        rr(c, 4, -1.8, 16, 3.6, 1); c.fillStyle = "#2c3022"; c.fill();
        c.restore();
      }
      c.fillStyle = "#e8e2cf"; c.font = "bold 6px sans-serif"; c.fillText(turretAngle == null ? "ŚMIAŁY" : "PATROL", -12, 2.5);
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
