// Every unit and gun is drawn in code, top down, facing +x. That lets weak spots light up,
// turrets track, wheels turn and damage show without a sprite sheet. Drawn art is cached
// into images per animation frame, so a full column costs little each frame.
(function (root) {
  const BK = root.BK;
  const A = (BK.Art = {});

  const OUT = "rgba(12,12,9,0.9)";
  // Scale for guns and scenery, alongside BK.US for units.
  BK.GS = 1.3;

  function rr(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  A.rr = rr;

  function shade(c, x, y, w, h, base, light, dark) {
    const g = c.createLinearGradient(x, y, x + w * 0.4, y + h);
    g.addColorStop(0, light);
    g.addColorStop(0.45, base);
    g.addColorStop(1, dark);
    return g;
  }

  // Top down light falls on the crown of a hull, so shading runs across the width.
  function hullGrad(c, W, base, light, dark) {
    const g = c.createLinearGradient(0, -W / 2, 0, W / 2);
    g.addColorStop(0, dark);
    g.addColorStop(0.28, light);
    g.addColorStop(0.55, base);
    g.addColorStop(1, dark);
    return g;
  }

  function poly(c, pts) {
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
  }

  function fillStroke(c, fill, lw) {
    c.fillStyle = fill;
    c.fill();
    c.lineWidth = lw || 1.2;
    c.strokeStyle = OUT;
    c.stroke();
  }

  // Thin light edge just inside the outline, so plates read as raised metal.
  function bevel(c, pathFn, alpha) {
    c.save();
    pathFn();
    c.clip();
    pathFn();
    c.lineWidth = 2.2;
    c.strokeStyle = `rgba(255,250,235,${alpha || 0.16})`;
    c.stroke();
    c.restore();
  }

  // Road dust caked on the tail and the lower edges.
  function dirt(c, L, W, amt) {
    const g = c.createLinearGradient(-L / 2, 0, -L / 2 + L * 0.45, 0);
    g.addColorStop(0, `rgba(122,100,66,${0.45 * (amt || 1)})`);
    g.addColorStop(1, "rgba(122,100,66,0)");
    c.fillStyle = g;
    c.globalCompositeOperation = "source-atop";
    c.fillRect(-L / 2 - 4, -W / 2 - 4, L + 8, W + 8);
    const g2 = c.createLinearGradient(0, -W / 2, 0, W / 2);
    g2.addColorStop(0, `rgba(110,90,60,${0.3 * (amt || 1)})`);
    g2.addColorStop(0.2, "rgba(110,90,60,0)");
    g2.addColorStop(0.8, "rgba(110,90,60,0)");
    g2.addColorStop(1, `rgba(110,90,60,${0.3 * (amt || 1)})`);
    c.fillStyle = g2;
    c.fillRect(-L / 2 - 4, -W / 2 - 4, L + 8, W + 8);
    c.globalCompositeOperation = "source-over";
  }

  // Soft edged brown blotches over panzer grey, the 1939 two tone scheme.
  function camo(c, seed, L, W, alpha) {
    const r = BK.makeRng(Math.floor(seed * 1000) + 7);
    for (let i = 0; i < 5; i++) {
      const x = r.range(-L / 2.4, L / 2.4), y = r.range(-W / 3, W / 3), s = r.range(4, 9);
      const g = c.createRadialGradient(x, y, 0, x, y, s);
      g.addColorStop(0, `rgba(96,74,48,${alpha || 0.5})`);
      g.addColorStop(0.7, `rgba(96,74,48,${(alpha || 0.5) * 0.8})`);
      g.addColorStop(1, "rgba(96,74,48,0)");
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(x, y, s * 1.4, s * 0.8, r.range(0, 3), 0, Math.PI * 2);
      c.fill();
    }
  }

  function rivets(c, pts) {
    for (const [x, y] of pts) {
      c.fillStyle = "rgba(0,0,0,0.45)";
      c.fillRect(x - 0.5, y - 0.2, 1.1, 1.1);
      c.fillStyle = "rgba(255,255,240,0.25)";
      c.fillRect(x - 0.6, y - 0.6, 0.8, 0.8);
    }
  }

  function grille(c, x0, x1, y0, y1, glow) {
    rr(c, x0, y0, x1 - x0, y1 - y0, 1.5);
    c.fillStyle = glow ? `rgba(255,${140 + glow * 70},50,${0.6 + glow * 0.35})` : "#2c2e2a";
    c.fill();
    c.strokeStyle = "rgba(0,0,0,0.75)";
    c.lineWidth = 0.7;
    for (let y = y0 + 1.6; y < y1 - 0.8; y += 1.8) {
      c.beginPath();
      c.moveTo(x0 + 1, y);
      c.lineTo(x1 - 1, y);
      c.stroke();
    }
    c.strokeStyle = "rgba(255,255,240,0.12)";
    c.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
  }

  // Gold corner brackets mark a weak spot, like a gunsight picking it out.
  function brackets(c, x0, x1, y0, y1, pulse) {
    const k = Math.min(4, (x1 - x0) * 0.35, (y1 - y0) * 0.35);
    c.save();
    c.strokeStyle = `rgba(255,214,90,${0.65 + 0.35 * pulse})`;
    c.lineWidth = 1.4;
    c.lineCap = "round";
    c.shadowColor = "rgba(255,200,60,0.9)";
    c.shadowBlur = 4;
    const p = 1.5;
    c.beginPath();
    c.moveTo(x0 - p, y0 - p + k); c.lineTo(x0 - p, y0 - p); c.lineTo(x0 - p + k, y0 - p);
    c.moveTo(x1 + p - k, y0 - p); c.lineTo(x1 + p, y0 - p); c.lineTo(x1 + p, y0 - p + k);
    c.moveTo(x1 + p, y1 + p - k); c.lineTo(x1 + p, y1 + p); c.lineTo(x1 + p - k, y1 + p);
    c.moveTo(x0 - p + k, y1 + p); c.lineTo(x0 - p, y1 + p); c.lineTo(x0 - p, y1 + p - k);
    c.stroke();
    c.restore();
  }

  // Track run with moving links, drive sprocket at the front and idler at the back.
  function tracks(c, L, W, tw, phase) {
    for (const side of [-1, 1]) {
      const y = side * (W / 2 - tw / 2);
      rr(c, -L / 2, y - tw / 2, L, tw, tw * 0.45);
      const g = c.createLinearGradient(0, y - tw / 2, 0, y + tw / 2);
      g.addColorStop(0, "#1b1a16");
      g.addColorStop(0.5, "#3a3830");
      g.addColorStop(1, "#1b1a16");
      c.fillStyle = g;
      c.fill();
      c.save();
      rr(c, -L / 2, y - tw / 2, L, tw, tw * 0.45);
      c.clip();
      const sp = 3.2;
      const off = ((phase % sp) + sp) % sp;
      for (let x = -L / 2 - sp + off; x < L / 2 + sp; x += sp) {
        c.fillStyle = "rgba(150,145,125,0.4)";
        c.fillRect(x, y - tw / 2, 1.1, tw);
        c.fillStyle = "rgba(0,0,0,0.4)";
        c.fillRect(x + 1.1, y - tw / 2, 0.8, tw);
      }
      // caked mud along the outer edge
      c.fillStyle = "rgba(110,88,58,0.35)";
      c.fillRect(-L / 2, side > 0 ? y + tw / 2 - 1.4 : y - tw / 2, L, 1.4);
      c.restore();
      c.strokeStyle = OUT;
      c.lineWidth = 1;
      rr(c, -L / 2, y - tw / 2, L, tw, tw * 0.45);
      c.stroke();
    }
  }

  function wheel(c, x, y, r, w) {
    rr(c, x - r, y - w / 2, r * 2, w, Math.min(2, w / 2));
    const g = c.createLinearGradient(0, y - w / 2, 0, y + w / 2);
    g.addColorStop(0, "#111");
    g.addColorStop(0.5, "#34332e");
    g.addColorStop(1, "#111");
    c.fillStyle = g;
    c.fill();
    c.fillStyle = "rgba(160,150,120,0.25)";
    c.fillRect(x - r + 1, y - w / 2 + 0.6, r * 2 - 2, 0.8);
  }

  function smallLight(c, x, y) {
    c.beginPath();
    c.arc(x, y, 1.6, 0, Math.PI * 2);
    c.fillStyle = "#c9cbb8";
    c.fill();
    c.strokeStyle = OUT;
    c.lineWidth = 0.7;
    c.stroke();
  }

  function jerry(c, x, y, rot) {
    c.save();
    c.translate(x, y);
    c.rotate(rot || 0);
    rr(c, -2.6, -1.8, 5.2, 3.6, 0.6);
    fillStroke(c, "#4b5338", 0.7);
    c.strokeStyle = "rgba(255,255,230,0.25)";
    c.beginPath(); c.moveTo(-2, -0.4); c.lineTo(2, 0.6); c.stroke();
    c.restore();
  }

  // ------------------------------------------------------------------ the 1939 palette
  const GREY = { base: "#555b5f", light: "#848c90", dark: "#2c3033" };
  const GREY_D = { base: "#4b5155", light: "#79818a", dark: "#272a2d" };

  // ------------------------------------------------------------------ hulls
  // Each hull draws everything except a rotating turret. TURRET holds those, drawn on top.
  const HULL = {};
  const TURRET = {};

  HULL.inf = function (c, e, o) {
    const officer = e.kind === "officer";
    const walk = Math.sin(e.t * 9 + e.seed) * 1.8;
    // legs and boots
    c.lineCap = "round";
    c.strokeStyle = "#3e4235";
    c.lineWidth = 2.6;
    c.beginPath();
    c.moveTo(-1.5, -2.4); c.lineTo(-5 + walk, -2.6);
    c.moveTo(-1.5, 2.4); c.lineTo(-5 - walk, 2.6);
    c.stroke();
    c.strokeStyle = "#1d1b16";
    c.lineWidth = 2.6;
    c.beginPath();
    c.moveTo(-5 + walk, -2.6); c.lineTo(-6 + walk, -2.6);
    c.moveTo(-5 - walk, 2.6); c.lineTo(-6 - walk, 2.6);
    c.stroke();
    // torso, field grey tunic
    c.beginPath();
    c.ellipse(0, 0, 3.6, 6.2, 0, 0, Math.PI * 2);
    const tg = c.createLinearGradient(0, -6, 0, 6);
    tg.addColorStop(0, officer ? "#4c5144" : "#59604f");
    tg.addColorStop(0.35, officer ? "#6f7564" : "#7c846d");
    tg.addColorStop(1, officer ? "#3a3e33" : "#454b3c");
    fillStroke(c, tg, 1);
    // pack, bread bag, or map case for officers
    if (!officer) {
      rr(c, -4.6, -2.8, 2.8, 5.6, 1);
      fillStroke(c, "#544a35", 0.7);
    } else {
      rr(c, -1, 3.6, 3.6, 2.2, 0.5);
      fillStroke(c, "#5a3d23", 0.6);
    }
    // arms carrying the rifle
    c.strokeStyle = officer ? "#5a6050" : "#68705b";
    c.lineWidth = 2.1;
    c.beginPath();
    c.moveTo(0.5, -4.6); c.lineTo(4.2, -1.2);
    c.moveTo(0.5, 4.6); c.lineTo(4.2, 2.4);
    c.stroke();
    if (!officer) {
      c.strokeStyle = "#5c3f22";
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(-1.5, 3.4);
      c.lineTo(9, 1.6 + walk * 0.25);
      c.stroke();
      c.strokeStyle = "#232320";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(5, 2); c.lineTo(10, 1.3 + walk * 0.25);
      c.stroke();
    } else {
      // pistol hand and binoculars at the chest
      c.fillStyle = "#1e1e1b";
      c.fillRect(3.6, -2, 2.2, 1.6);
      c.fillRect(3.6, 0.6, 2.2, 1.6);
    }
    // head and helmet with a light rim
    c.beginPath();
    c.arc(0.8, 0, 3.6, 0, Math.PI * 2);
    const hg = c.createRadialGradient(-0.2, -1.4, 0.4, 0.8, 0, 3.8);
    if (officer) { hg.addColorStop(0, "#80826b"); hg.addColorStop(1, "#33352b"); }
    else { hg.addColorStop(0, "#949b84"); hg.addColorStop(0.6, "#606853"); hg.addColorStop(1, "#3f4537"); }
    c.fillStyle = hg;
    c.fill();
    c.strokeStyle = OUT;
    c.lineWidth = 1;
    c.stroke();
    if (officer) {
      c.fillStyle = "#1f201a";
      c.fillRect(3.6, -2.4, 1.8, 4.8);
      c.fillStyle = "#d8bd62";
      c.fillRect(0.2, -0.7, 1.4, 1.4);
    } else {
      c.beginPath();
      c.arc(0.8, 0, 2.4, Math.PI * 0.8, Math.PI * 1.6);
      c.strokeStyle = "rgba(255,255,240,0.22)";
      c.lineWidth = 0.8;
      c.stroke();
    }
  };
  HULL.officer = HULL.inf;

  HULL.moto = function (c, e) {
    // sidecar on the right
    c.beginPath();
    c.ellipse(0.5, 7, 9.5, 4.8, 0, 0, Math.PI * 2);
    fillStroke(c, hullGrad(c, 10, "#50564d", "#7d8676", "#2f342d"), 1);
    c.beginPath();
    c.ellipse(-1, 7, 4.5, 3, 0, 0, Math.PI * 2);
    c.fillStyle = "#1f201c";
    c.fill();
    c.beginPath();
    c.arc(-1, 7, 2.7, 0, Math.PI * 2);
    c.fillStyle = "#68705b";
    c.fill();
    c.strokeStyle = OUT;
    c.lineWidth = 0.8;
    c.stroke();
    // sidecar MG
    c.fillStyle = "#1c1c19";
    c.fillRect(4, 6.3, 7, 1.3);
    // the bike
    wheel(c, -10.5, -1, 3.2, 2.6);
    wheel(c, 10.5, -1, 3.2, 2.6);
    rr(c, -9, -3.3, 18, 4.6, 2);
    fillStroke(c, hullGrad(c, 5, "#3c3f39", "#6a6f66", "#20221f"), 1);
    c.strokeStyle = "#8b8d84";
    c.lineWidth = 1.1;
    c.beginPath(); c.moveTo(7, -6.5); c.lineTo(7, 4); c.stroke();
    // rider in a greatcoat with goggles on the helmet
    c.beginPath();
    c.ellipse(-1.5, -1, 4.2, 4.6, 0, 0, Math.PI * 2);
    fillStroke(c, "#68705b", 0.9);
    c.beginPath();
    c.arc(-0.5, -1, 2.8, 0, Math.PI * 2);
    c.fillStyle = "#4f5646";
    c.fill();
    c.stroke();
    c.fillStyle = "rgba(170,200,205,0.8)";
    c.fillRect(1.2, -2.3, 1.1, 2.6);
  };

  HULL.truck = function (c, e, o) {
    const L = 46, W = 20;
    for (const x of [-15, -7, 14]) for (const s of [-1, 1]) wheel(c, x, s * (W / 2), 3.6, 3.6);
    // cargo bed under canvas
    const bed = () => rr(c, -23, -W / 2, 30, W, 2.5);
    bed();
    fillStroke(c, hullGrad(c, W, "#8a8156", "#b0a578", "#575238"), 1.2);
    c.save();
    bed();
    c.clip();
    for (let x = -19; x < 6; x += 5) {
      const g = c.createLinearGradient(x - 2.5, 0, x + 2.5, 0);
      g.addColorStop(0, "rgba(60,54,30,0.0)");
      g.addColorStop(0.5, "rgba(60,54,30,0.45)");
      g.addColorStop(1, "rgba(60,54,30,0.0)");
      c.fillStyle = g;
      c.fillRect(x - 2.5, -W / 2, 5, W);
    }
    // tie down rope along the edge
    c.strokeStyle = "rgba(210,190,140,0.5)";
    c.lineWidth = 0.6;
    c.setLineDash([1.5, 1.5]);
    c.strokeRect(-22, -W / 2 + 1.2, 28, W - 2.4);
    c.restore();
    bevel(c, bed, 0.12);
    // fuel drums at the tail, the weak spot
    const pulse = o.weak ? o.pulse : 0;
    for (const y of [-5, 5]) {
      c.beginPath();
      c.arc(-18.5, y, 4.3, 0, Math.PI * 2);
      const g = c.createRadialGradient(-19.6, y - 1.6, 0.4, -18.5, y, 4.5);
      g.addColorStop(0, "#ff9a70");
      g.addColorStop(0.35, "#d8442c");
      g.addColorStop(1, "#5e140c");
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = OUT;
      c.lineWidth = 0.9;
      c.stroke();
      c.beginPath();
      c.arc(-18.5, y, 2.4, 0, Math.PI * 2);
      c.strokeStyle = "rgba(40,10,5,0.6)";
      c.stroke();
      c.fillStyle = "#2a2a26";
      c.fillRect(-17.6, y - 2.6, 1.6, 1.2);
    }
    if (o.weak) brackets(c, -23, -14, -10, 10, pulse);
    // cab and hood
    const cab = () => rr(c, 7.5, -W / 2 + 1, 9.5, W - 2, 2.5);
    cab();
    fillStroke(c, hullGrad(c, W, "#566156", "#869183", "#323a33"), 1.2);
    bevel(c, cab, 0.14);
    c.fillStyle = "rgba(140,175,185,0.6)";
    rr(c, 14.5, -6.5, 2.2, 13, 1);
    c.fill();
    const hood = () => rr(c, 16.5, -W / 2 + 3, 7.5, W - 6, 2);
    hood();
    fillStroke(c, hullGrad(c, W - 6, "#4f594f", "#7a8578", "#2d342e"), 1.1);
    c.strokeStyle = "rgba(0,0,0,0.4)";
    c.lineWidth = 0.6;
    for (let x = 18; x < 23; x += 1.4) { c.beginPath(); c.moveTo(x, -4); c.lineTo(x, -1.5); c.moveTo(x, 1.5); c.lineTo(x, 4); c.stroke(); }
    smallLight(c, 23, -6);
    smallLight(c, 23, 6);
    dirt(c, L, W, 0.8);
  };

  HULL.armcar = function (c, e, o) {
    const L = 38, W = 20;
    const pulse = o.weak ? o.pulse : 0;
    for (const x of [-11, 11]) for (const s of [-1, 1]) wheel(c, x, s * (W / 2 + 0.5), 4.8, 4.6);
    if (o.weak) {
      brackets(c, -16, -6, -12.5, -8, pulse);
      brackets(c, 6, 16, 8, 12.5, pulse);
    }
    const body = () => poly(c, [[-19, -6.5], [-13, -9.5], [12, -9.5], [19.5, -4.5], [19.5, 4.5], [12, 9.5], [-13, 9.5], [-19, 6.5]]);
    body();
    fillStroke(c, hullGrad(c, W, "#646f74", "#9aa7ad", "#3a4246"), 1.3);
    bevel(c, body, 0.18);
    c.strokeStyle = "rgba(0,0,0,0.3)";
    c.lineWidth = 0.8;
    poly(c, [[-13, -5.5], [11, -5.5], [15.5, -2], [15.5, 2], [11, 5.5], [-13, 5.5]]);
    c.stroke();
    grille(c, -18, -13.5, -4, 4, 0);
    smallLight(c, 18.5, -5.5);
    smallLight(c, 18.5, 5.5);
    rivets(c, [[-10, -8], [-4, -8], [2, -8], [8, -8], [-10, 8], [-4, 8], [2, 8], [8, 8]]);
    // whip antenna
    c.strokeStyle = "rgba(40,40,36,0.8)";
    c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(-14, -7); c.lineTo(-24, -11); c.stroke();
    dirt(c, L, W, 0.7);
  };
  TURRET.armcar = {
    x: -1, y: 0,
    draw(c) {
      c.fillStyle = "#1f201d";
      rr(c, 4, -0.9, 13, 1.8, 0.6);
      c.fill();
      const t = () => poly(c, [[-6.5, -5.8], [4, -6.3], [7.5, -3], [7.5, 3], [4, 6.3], [-6.5, 5.8]]);
      t();
      fillStroke(c, hullGrad(c, 12, "#5c676c", "#8f9ba1", "#363e42"), 1.1);
      c.save();
      t();
      c.clip();
      c.fillStyle = "rgba(10,10,10,0.55)";
      c.fillRect(-6, -5, 12.5, 10);
      c.strokeStyle = "rgba(225,228,220,0.5)";
      c.lineWidth = 0.55;
      for (let i = -6; i <= 7; i += 1.8) { c.beginPath(); c.moveTo(i, -6); c.lineTo(i, 6); c.stroke(); }
      for (let j = -5; j <= 5; j += 1.8) { c.beginPath(); c.moveTo(-7, j); c.lineTo(8, j); c.stroke(); }
      c.restore();
    },
  };

  function tankHull(c, e, o, s) {
    const { L, W, tw, P } = s;
    tracks(c, L, W, tw, e.dist * 1.2);
    // fenders over the tracks with stowage on them
    for (const side of [-1, 1]) {
      const y0 = side < 0 ? -W / 2 - 0.6 : W / 2 - tw * 0.6 + 0.6;
      rr(c, -L / 2 + 2.5, y0, L - 5, tw * 0.6, 1.2);
      c.fillStyle = side < 0 ? P.light : P.dark;
      c.globalAlpha = 0.55;
      c.fill();
      c.globalAlpha = 1;
    }
    const hull = () => poly(c, [[-L / 2 + 1.5, -W / 2 + tw - 1.5], [L / 2 - 6, -W / 2 + tw - 1.5], [L / 2 - 1, -W / 2 + tw + 2.5], [L / 2 - 1, W / 2 - tw - 2.5], [L / 2 - 6, W / 2 - tw + 1.5], [-L / 2 + 1.5, W / 2 - tw + 1.5]]);
    hull();
    fillStroke(c, hullGrad(c, W - 2 * tw + 3, P.base, P.light, P.dark), 1.3);
    camo(c, e.seed + (s.seedOff || 0), L, W - 2 * tw, 0.42);
    bevel(c, hull, 0.17);
    // glacis seam and front plate
    c.strokeStyle = "rgba(0,0,0,0.35)";
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(L / 2 - 6, -W / 2 + tw - 1); c.lineTo(L / 2 - 6, W / 2 - tw + 1);
    c.stroke();
    // engine deck, the weak spot
    const pulse = o.weak ? o.pulse : 0;
    const eg = s.engine;
    grille(c, eg[0], eg[1], eg[2], eg[3], o.weak ? 0.35 + 0.65 * pulse : 0);
    if (o.weak) brackets(c, eg[0], eg[1], eg[2], eg[3], pulse);
    // exhausts with soot
    c.fillStyle = "#24211d";
    rr(c, -L / 2 - 1.5, -W / 2 + tw + 1, 3, 3.2, 1); c.fill();
    const sg = c.createRadialGradient(-L / 2 + 1, -W / 2 + tw + 2.6, 0, -L / 2 + 1, -W / 2 + tw + 2.6, 6);
    sg.addColorStop(0, "rgba(20,18,16,0.55)");
    sg.addColorStop(1, "rgba(20,18,16,0)");
    c.fillStyle = sg;
    c.fillRect(-L / 2, -W / 2 + tw - 4, 10, 12);
    // driver visor and hull MG port
    c.fillStyle = "rgba(0,0,0,0.65)";
    c.fillRect(L / 2 - 4.5, -W / 2 + tw + 1, 1.6, 4.5);
    c.beginPath();
    c.arc(L / 2 - 3.5, W / 2 - tw - 3.5, 1.3, 0, Math.PI * 2);
    c.fill();
    smallLight(c, L / 2 - 1, -W / 2 + 1.6);
    smallLight(c, L / 2 - 1, W / 2 - 1.6);
    // pioneer tools on the left fender
    c.strokeStyle = "#5c4127";
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(-L / 4, -W / 2 + 1.2); c.lineTo(L / 6, -W / 2 + 1.2); c.stroke();
    c.fillStyle = "#3d3f3b";
    c.fillRect(L / 6, -W / 2 + 0.4, 2.5, 1.8);
    rivets(c, s.rivets || []);
    if (o.weak && o.showTracks) {
      brackets(c, -L / 2 + 2, L / 2 - 2, -W / 2, -W / 2 + tw, pulse * 0.6);
      brackets(c, -L / 2 + 2, L / 2 - 2, W / 2 - tw, W / 2, pulse * 0.6);
    }
  }

  function tankTurret(c, r, P, barrel, opts) {
    opts = opts || {};
    // barrel and mantlet
    rr(c, r * 0.7, -barrel.w / 2, barrel.len, barrel.w, barrel.w / 2.5);
    c.fillStyle = "#2c302e";
    c.fill();
    c.strokeStyle = OUT;
    c.lineWidth = 0.9;
    c.stroke();
    c.fillStyle = "rgba(255,255,240,0.18)";
    c.fillRect(r * 0.7, -barrel.w / 2 + 0.4, barrel.len - 1, 0.7);
    if (barrel.muzzle) {
      rr(c, r * 0.7 + barrel.len - 2.5, -barrel.w / 2 - 0.8, 3.5, barrel.w + 1.6, 1);
      c.fillStyle = "#1f2220";
      c.fill();
    }
    if (opts.coax) {
      c.fillStyle = "#1d1e1c";
      c.fillRect(r * 0.6, 2.4, r * 0.9, 1.3);
    }
    rr(c, r * 0.55, -r * 0.42, r * 0.5, r * 0.84, 1.5);
    fillStroke(c, P.dark, 0.9);
    const t = () => poly(c, [[-r * 0.98, -r * 0.78], [r * 0.5, -r * 0.92], [r * 0.95, -r * 0.42], [r * 0.95, r * 0.42], [r * 0.5, r * 0.92], [-r * 0.98, r * 0.78]]);
    t();
    const g = c.createRadialGradient(-r * 0.15, -r * 0.25, r * 0.1, 0, 0, r * 1.1);
    g.addColorStop(0, P.light);
    g.addColorStop(0.6, P.base);
    g.addColorStop(1, P.dark);
    fillStroke(c, g, 1.2);
    bevel(c, t, 0.2);
    if (opts.camo) camo(c, opts.camo, r * 2, r * 1.6, 0.35);
    if (opts.cupola) {
      c.beginPath();
      c.arc(-r * 0.45, -r * 0.05, r * 0.38, 0, Math.PI * 2);
      const cg = c.createRadialGradient(-r * 0.55, -r * 0.15, 0.3, -r * 0.45, -r * 0.05, r * 0.4);
      cg.addColorStop(0, P.light);
      cg.addColorStop(1, P.dark);
      c.fillStyle = cg;
      c.fill();
      c.strokeStyle = OUT;
      c.lineWidth = 0.8;
      c.stroke();
    }
    if (opts.hatch) {
      rr(c, -r * 0.55, r * 0.05, r * 0.6, r * 0.5, 1);
      c.fillStyle = "rgba(0,0,0,0.2)";
      c.fill();
      c.strokeStyle = "rgba(0,0,0,0.45)";
      c.stroke();
    }
    c.fillStyle = "rgba(0,0,0,0.6)";
    c.fillRect(r * 0.2, -r * 0.82, r * 0.35, 0.8);
    c.fillRect(r * 0.2, r * 0.74, r * 0.35, 0.8);
    if (opts.num) {
      c.fillStyle = "rgba(240,238,228,0.9)";
      c.font = `700 ${Math.max(4.5, r * 0.62)}px Oswald, sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(opts.num, -r * 0.1, -r * 0.5);
    }
  }

  HULL.ltank = function (c, e, o) {
    tankHull(c, e, o, { L: 46, W: 28, tw: 6, P: GREY, engine: [-22, -13, -6.5, 6.5], rivets: [[-6, -7.5], [2, -7.5], [10, -7.5], [-6, 7.5], [2, 7.5], [10, 7.5]] });
    // rod antenna at the right rear
    c.strokeStyle = "rgba(30,30,28,0.8)";
    c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(-14, 8); c.lineTo(-27, 14); c.stroke();
    dirt(c, 46, 28);
  };
  TURRET.ltank = { x: 3, y: -1, draw(c) { tankTurret(c, 8.4, GREY, { len: 15, w: 2.6 }, { coax: true, hatch: true, camo: 3, num: "121" }); } };

  HULL.smoke = function (c, e, o) {
    tankHull(c, e, o, { L: 46, W: 28, tw: 6, P: GREY, engine: [-22, -13, -6.5, 6.5], seedOff: 2 });
    // smoke candle rack, white so it reads at a glance
    for (let i = -1; i <= 1; i++) {
      rr(c, -11, i * 4.5 - 1.7, 6.5, 3.4, 1.5);
      const g = c.createLinearGradient(0, i * 4.5 - 1.7, 0, i * 4.5 + 1.7);
      g.addColorStop(0, e.smokePopped ? "#3a3a36" : "#ffffff");
      g.addColorStop(1, e.smokePopped ? "#222" : "#bdbab0");
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = OUT;
      c.lineWidth = 0.7;
      c.stroke();
    }
    dirt(c, 46, 28);
  };
  TURRET.smoke = {
    x: 5, y: -1,
    draw(c) {
      tankTurret(c, 8.4, GREY, { len: 14, w: 2.6 }, { coax: true, hatch: true, camo: 4 });
      c.beginPath();
      c.arc(0, 0, 9.6, 0, Math.PI * 2);
      c.strokeStyle = "rgba(245,243,235,0.85)";
      c.lineWidth = 1.5;
      c.stroke();
    },
  };

  HULL.mtank = function (c, e, o) {
    tankHull(c, e, o, { L: 60, W: 32, tw: 7, P: GREY_D, engine: [-29, -18, -8.5, 8.5], seedOff: 5, rivets: [[-8, -8.5], [0, -8.5], [8, -8.5], [16, -8.5], [-8, 8.5], [0, 8.5], [8, 8.5], [16, 8.5]] });
    // spare road wheels on the front plate, jerry cans on the deck
    for (const y of [-5, 0, 5]) {
      c.beginPath();
      c.arc(25.5, y, 2.4, 0, Math.PI * 2);
      c.fillStyle = "#2b2c29";
      c.fill();
      c.strokeStyle = "rgba(255,255,240,0.18)";
      c.lineWidth = 0.6;
      c.stroke();
    }
    jerry(c, -15, -6, 0);
    jerry(c, -15, 6, 0);
    c.strokeStyle = "rgba(30,30,28,0.8)";
    c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(-20, 9); c.lineTo(-34, 16); c.stroke();
    dirt(c, 60, 32);
  };
  TURRET.mtank = { x: 2, y: 0, draw(c) { tankTurret(c, 11.5, GREY_D, { len: 13, w: 4.6, muzzle: true }, { cupola: true, coax: true, camo: 6, num: "412" }); } };

  HULL.htrack = function (c, e, o) {
    const L = 54, W = 22;
    c.save();
    c.translate(-8, 0);
    tracks(c, 34, W, 5, e.dist * 1.2);
    c.restore();
    wheel(c, 19, -W / 2 + 1, 4, 4);
    wheel(c, 19, W / 2 - 1, 4, 4);
    const body = () => poly(c, [[-26, -9], [10, -9], [22, -6.5], [27.5, -3], [27.5, 3], [22, 6.5], [10, 9], [-26, 9]]);
    body();
    fillStroke(c, hullGrad(c, 18, "#585b4c", "#868a74", "#33352b"), 1.3);
    camo(c, e.seed + 9, 40, 14, 0.38);
    bevel(c, body, 0.16);
    grille(c, 15, 24, -3.5, 3.5, 0);
    smallLight(c, 26, -4.5);
    smallLight(c, 26, 4.5);
    // open crew bay with riflemen seated along the sides
    const pulse = o.weak ? o.pulse : 0;
    rr(c, -21, -7, 27, 14, 2);
    c.fillStyle = "#1c1d18";
    c.fill();
    c.strokeStyle = "rgba(255,255,240,0.12)";
    c.lineWidth = 0.8;
    c.stroke();
    if (!e.empty) {
      for (const [hx, hy] of [[-17, -3.6], [-11, -3.6], [-5, -3.6], [-17, 3.6], [-11, 3.6], [-5, 3.6]]) {
        c.beginPath();
        c.arc(hx, hy, 2.6, 0, Math.PI * 2);
        const g = c.createRadialGradient(hx - 0.7, hy - 0.7, 0.2, hx, hy, 2.7);
        g.addColorStop(0, "#8f967e");
        g.addColorStop(1, "#454b3c");
        c.fillStyle = g;
        c.fill();
      }
    }
    if (o.weak) brackets(c, -20.5, 5.5, -7, 7, pulse);
    // shielded MG at the front of the bay
    rr(c, 6, -4, 2.6, 8, 0.6);
    fillStroke(c, "#2b2c27", 0.7);
    c.fillStyle = "#1a1a17";
    c.fillRect(8.5, -0.7, 8, 1.4);
    dirt(c, L, W);
  };

  HULL.command = function (c, e, o) {
    tankHull(c, e, o, { L: 64, W: 34, tw: 7, P: GREY, engine: [-31, -20, -8.5, 8.5], seedOff: 7 });
    // fixed command superstructure in place of a turret
    const sup = () => rr(c, -8, -10, 26, 20, 3);
    sup();
    fillStroke(c, hullGrad(c, 20, GREY.base, GREY.light, GREY.dark), 1.2);
    bevel(c, sup, 0.18);
    camo(c, 11, 26, 18, 0.35);
    c.fillStyle = "#1f2120";
    c.fillRect(17, -1, 9, 2);
    rr(c, 0, -5, 8, 10, 1.5);
    c.fillStyle = "rgba(0,0,0,0.25)";
    c.fill();
    // the frame antenna, plain steel until a crewed gun is looking for it
    if (!e.antennaDown) {
      c.save();
      c.lineWidth = 1.8;
      c.strokeStyle = "#2a2c2b";
      rr(c, -24, -14, 30, 28, 3);
      c.stroke();
      c.lineWidth = 0.7;
      c.strokeStyle = "rgba(220,220,205,0.45)";
      rr(c, -24, -14, 30, 28, 3);
      c.stroke();
      c.lineWidth = 1;
      c.strokeStyle = "#2a2c2b";
      c.beginPath();
      c.moveTo(-24, 0); c.lineTo(6, 0);
      c.moveTo(-9, -14); c.lineTo(-9, 14);
      c.stroke();
      c.restore();
      if (o.weak) brackets(c, -25, 7, -15, 15, o.pulse);
    } else {
      c.strokeStyle = "rgba(30,24,18,0.9)";
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(-24, -14); c.lineTo(-11, -6); c.moveTo(6, 14); c.lineTo(-4, 4);
      c.stroke();
    }
    // command pennant
    c.fillStyle = "rgba(235,233,225,0.9)";
    c.fillRect(20, -14, 6, 2.5);
    c.fillStyle = "rgba(150,40,30,0.9)";
    c.fillRect(20, -11.5, 6, 2);
    dirt(c, 64, 34);
  };

  // The prototype gets drawn live: its three turrets each aim and die on their own.
  HULL.nbfz = function (c, e, o) {
    tankHull(c, e, o, { L: 86, W: 38, tw: 8, P: GREY_D, engine: [-42, -31, -9.5, 9.5], seedOff: 13 });
    c.fillStyle = "rgba(0,0,0,0.2)";
    rr(c, -28, -11, 60, 22, 3);
    c.fill();
    dirt(c, 86, 38);
  };
  function nbfzTurrets(c, e, o) {
    const pulse = o.weak ? o.pulse : 0;
    for (const t0 of e.turrets || []) {
      const tt = Object.assign({}, t0, { x: t0.x / BK.US, y: t0.y / BK.US });
      if (tt.dead) {
        c.beginPath();
        c.arc(tt.x, tt.y, tt.big ? 10 : 6, 0, Math.PI * 2);
        c.fillStyle = "#151412";
        c.fill();
        continue;
      }
      const rel = tt.aimAng != null ? BK.wrapAng(tt.aimAng - (e.ang || 0)) : 0;
      c.save();
      c.translate(tt.x, tt.y);
      c.rotate(rel);
      if (tt.big) tankTurret(c, 13, GREY_D, { len: 18, w: 4.8, muzzle: true }, { cupola: true, coax: true, num: "NbFz" });
      else tankTurret(c, 6.5, GREY_D, { len: 9, w: 2 }, {});
      c.restore();
      if (o.weak) brackets(c, tt.x - (tt.big ? 13 : 7), tt.x + (tt.big ? 13 : 7), tt.y - (tt.big ? 13 : 7), tt.y + (tt.big ? 13 : 7), pulse);
    }
  }

  // ------------------------------------------------------------------ registry
  const ENEMY = {};
  for (const k of Object.keys(HULL)) {
    ENEMY[k] = function (c, e, o) {
      HULL[k](c, e, o);
      const T = TURRET[k];
      if (T) {
        c.save();
        c.translate(T.x, T.y);
        c.rotate(o.aim || 0);
        T.draw(c, e, o);
        c.restore();
      }
      if (k === "nbfz") nbfzTurrets(c, e, o);
    };
  }

  // ------------------------------------------------------------------ aircraft
  const weakRing = (c, x0, x1, y0, y1, p) => brackets(c, x0, x1, y0, y1, p);
  // ------------------------------------------------------------------- aircraft
  function stukaShape(c, s, colors, leader) {
    const [g1, g2, glass, nose] = colors;
    c.save();
    c.scale(s, s);
    // inverted gull wing from above: swept kink near the root
    const wing = [[2, -4], [6, -12], [3, -27], [-4, -28], [-6, -12], [-6, -4], [-6, 4], [-6, 12], [-4, 28], [3, 27], [6, 12], [2, 4]];
    poly(c, wing);
    fillStroke(c, g1, 1.3);
    // splinter camo
    c.save();
    poly(c, wing);
    c.clip();
    c.fillStyle = g2;
    poly(c, [[6, -14], [-2, -28], [-8, -20], [0, -8]]); c.fill();
    poly(c, [[6, 18], [-4, 10], [-8, 24], [0, 30]]); c.fill();
    c.restore();
    // spatted landing gear
    c.fillStyle = "rgba(0,0,0,0.35)";
    c.beginPath(); c.ellipse(4, -10, 4, 2.2, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(4, 10, 4, 2.2, 0, 0, Math.PI * 2); c.fill();
    // tailplane
    poly(c, [[-16, -2], [-18, -9], [-22, -9], [-22, 9], [-18, 9], [-16, 2]]);
    fillStroke(c, g2, 1.1);
    if (leader) {
      c.fillStyle = "#e3b93a";
      c.fillRect(-14, -5, 3, 10);
    }
    // fuselage
    poly(c, [[22, -3.5], [16, -4.6], [-6, -4], [-21, -1.6], [-21, 1.6], [-6, 4], [16, 4.6], [22, 3.5]]);
    fillStroke(c, g1, 1.3);
    // greenhouse canopy
    rr(c, -4, -2.6, 13, 5.2, 2);
    c.fillStyle = glass;
    c.fill();
    c.strokeStyle = "rgba(20,30,30,0.6)";
    c.lineWidth = 0.6;
    for (let x = -1; x < 9; x += 3) { c.beginPath(); c.moveTo(x, -2.6); c.lineTo(x, 2.6); c.stroke(); }
    // engine cowling
    rr(c, 14, -4.2, 8, 8.4, 2);
    c.fillStyle = nose;
    c.fill();
    c.restore();
  }

  ENEMY.stuka = function (c, e, o) {
    const s = 0.9 + (1 - e.alt) * 0.35;
    stukaShape(c, s, ["#46553e", "#2f3b2b", "rgba(170,205,215,0.85)", "#3a4535"], false);
    if (o.weak) weakRing(c, 12 * s, 22 * s, -5 * s, 5 * s, o.pulse);
    propDisc(c, 23 * s, e.t);
  };
  ENEMY.leader = function (c, e, o) {
    const s = 1.1 + (1 - e.alt) * 0.4;
    stukaShape(c, s, ["#46553e", "#2f3b2b", "rgba(170,205,215,0.85)", "#d9a92e"], true);
    if (o.weak) weakRing(c, 12 * s, 22 * s, -5 * s, 5 * s, o.pulse);
    propDisc(c, 23 * s, e.t);
  };
  ENEMY.recon = function (c, e, o) {
    c.save();
    // parasol wing over the fuselage
    poly(c, [[-14, -2.5], [12, -3.5], [19, -2.5], [19, 2.5], [12, 3.5], [-14, 2.5]]);
    fillStroke(c, "#6d7a82", 1.2);
    poly(c, [[-13, -1.5], [-17, -9], [-20, -9], [-20, 9], [-17, 9], [-13, 1.5]]);
    fillStroke(c, "#5b676e", 1);
    rr(c, -3, -27, 12, 54, 4);
    fillStroke(c, shade(c, -3, -27, 12, 54, "#76838b", "#97a4ab", "#4f5a60"), 1.3);
    c.strokeStyle = "rgba(0,0,0,0.3)";
    c.beginPath(); c.moveTo(-3, -20); c.lineTo(9, -20); c.moveTo(-3, 20); c.lineTo(9, 20); c.stroke();
    // observer gondola
    c.fillStyle = "rgba(170,205,215,0.85)";
    c.fillRect(2, -1.8, 6, 3.6);
    c.restore();
    if (o.weak) weakRing(c, 10, 19, -5, 5, o.pulse);
    propDisc(c, 20, e.t);
  };

  function propDisc(c, x, t) {
    c.save();
    c.translate(x, 0);
    c.beginPath();
    c.ellipse(0, 0, 1.6, 8, 0, 0, Math.PI * 2);
    c.fillStyle = "rgba(30,30,30,0.18)";
    c.fill();
    c.rotate(t * 40);
    c.strokeStyle = "rgba(30,30,30,0.45)";
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(0, -8); c.lineTo(0, 8);
    c.stroke();
    c.restore();
  }

  // Prebuilt images of each unit, with a few animation frames, so a full column costs little to draw.

  // ------------------------------------------------------------------ cached drawing
  const SPR = {}, TSPR = {}, SHD = {};
  const LIVE = { nbfz: 1, stuka: 1, leader: 1, recon: 1 };
  const FRAMES = { inf: 8, officer: 8, ltank: 4, smoke: 4, htrack: 4, command: 4, mtank: 4 };
  const HEIGHT = { inf: 3, officer: 3, moto: 3.5, truck: 7, armcar: 6, ltank: 7, smoke: 7, htrack: 6, mtank: 9, command: 9, nbfz: 10 };

  function canvasFor(span) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = Math.ceil(span * 2);
    const cc = cv.getContext("2d");
    cc.scale(2, 2);
    cc.translate(span / 2, span / 2);
    return { cv, cc };
  }
  function spanOf(def) {
    return (Math.max(def.L || 20, def.Wd || 20, (def.r || 8) * 2) / BK.US + 30) * BK.US;
  }

  function frameOf(e, def) {
    const nf = FRAMES[e.kind] || 1;
    if (nf === 1) return [0, 1];
    if (def.kind === "foot") return [Math.floor((((e.t * 9 + e.seed) / (Math.PI * 2)) % 1 + 1) % 1 * nf), nf];
    return [Math.floor((((e.dist * 1.2) % 3.2) / 3.2 + 1) % 1 * nf) % nf, nf];
  }

  A.enemyFast = function (c, e, o) {
    o = o || {};
    if (LIVE[e.kind]) return A.enemy(c, e, o);
    const def = BK.ENEMIES[e.kind];
    const [f, nf] = frameOf(e, def);
    const weak = o.weak ? 1 : 0;
    const key = e.kind + f + weak + (o.showTracks ? "t" : "") + (e.antennaDown ? "a" : "") + (e.smokePopped ? "s" : "") + (e.empty ? "e" : "");
    let sp = SPR[key];
    if (!sp) {
      const span = spanOf(def);
      const { cv, cc } = canvasFor(span);
      cc.scale(BK.US, BK.US);
      const fake = { kind: e.kind, seed: 0, t: def.kind === "foot" ? ((f / nf) * Math.PI * 2) / 9 : 0, dist: def.kind !== "foot" ? ((f / nf) * 3.2) / 1.2 : 0, antennaDown: e.antennaDown, smokePopped: e.smokePopped, empty: e.empty, alt: 1 };
      HULL[e.kind](cc, fake, { weak: !!weak, pulse: 0.75, showTracks: o.showTracks });
      sp = SPR[key] = { cv, span };
    }
    c.drawImage(sp.cv, -sp.span / 2, -sp.span / 2, sp.span, sp.span);
    const T = TURRET[e.kind];
    if (T) {
      let ts = TSPR[e.kind];
      if (!ts) {
        const span = 50 * BK.US;
        const { cv, cc } = canvasFor(span);
        cc.scale(BK.US, BK.US);
        T.draw(cc, e, {});
        ts = TSPR[e.kind] = { cv, span };
      }
      c.save();
      c.translate(T.x * BK.US, T.y * BK.US);
      c.rotate(o.aim || 0);
      c.drawImage(ts.cv, -ts.span / 2, -ts.span / 2, ts.span, ts.span);
      c.restore();
    }
  };

  A.enemy = function (c, e, o) {
    c.save();
    c.scale(BK.US, BK.US);
    (ENEMY[e.kind] || ENEMY.inf)(c, e, o || {});
    c.restore();
  };

  // A blurred silhouette of each unit, drawn in world space and pushed away from the sun.
  function silhouette(kind, drawFn, span) {
    const { cv, cc } = canvasFor(span);
    drawFn(cc);
    cc.setTransform(1, 0, 0, 1, 0, 0);
    cc.globalCompositeOperation = "source-in";
    cc.fillStyle = "#000";
    cc.fillRect(0, 0, cv.width, cv.height);
    const out = document.createElement("canvas");
    out.width = cv.width; out.height = cv.height;
    const oc = out.getContext("2d");
    oc.filter = "blur(3px)";
    oc.drawImage(cv, 0, 0);
    return { cv: out, span };
  }
  A.shadow = function (c, e, sun, alpha) {
    const def = BK.ENEMIES[e.kind];
    let sh = SHD[e.kind];
    if (!sh) {
      const span = spanOf(def);
      sh = SHD[e.kind] = silhouette(e.kind, (cc) => {
        cc.scale(BK.US, BK.US);
        const fake = { kind: e.kind, seed: 0, t: 0, dist: 0, alt: 1, turrets: def.turrets && def.turrets.map((t) => Object.assign({}, t)) };
        HULL[e.kind](cc, fake, {});
        const T = TURRET[e.kind];
        if (T) { cc.save(); cc.translate(T.x, T.y); T.draw(cc, fake, {}); cc.restore(); }
      }, span);
    }
    const h = HEIGHT[e.kind] || 4;
    c.save();
    c.translate(e.x + sun.x * h, e.y + sun.y * h);
    c.rotate(e.ang);
    c.globalAlpha = alpha == null ? sun.a : alpha;
    c.drawImage(sh.cv, -sh.span / 2, -sh.span / 2, sh.span, sh.span);
    c.restore();
  };
  // Planes cast a shadow on the ground; the higher they fly, the farther it falls.
  A.airShadow = function (c, e, sun) {
    const off = 20 + e.alt * 80;
    const sx = sun ? sun.x / sun.len : 0.55, sy = sun ? sun.y / sun.len : 1;
    c.save();
    c.translate(e.x + sx * off, e.y + sy * off);
    c.rotate(e.ang);
    const s = (0.75 + (1 - e.alt) * 0.3) * BK.US;
    c.scale(s, s);
    c.globalAlpha = 0.2 + (1 - e.alt) * 0.18;
    c.fillStyle = "#000";
    if (e.kind === "recon") {
      c.fillRect(-14, -2.5, 33, 5);
      c.fillRect(-3, -27, 12, 54);
    } else {
      poly(c, [[2, -4], [6, -12], [3, -27], [-4, -28], [-6, -12], [-6, 12], [-4, 28], [3, 27], [6, 12], [2, 4]]);
      c.fill();
      c.fillRect(-21, -3, 43, 6);
      c.fillRect(-22, -9, 5, 18);
    }
    c.restore();
  };

  // P.11 fighter, the Polish gull wing, for strafing runs.
  A.p11 = function (c, x, y, ang, t) {
    c.save();
    c.translate(x + 60, y + 80);
    c.rotate(ang);
    c.globalAlpha = 0.22;
    c.fillStyle = "#000";
    c.fillRect(-14, -26, 10, 52);
    c.fillRect(-20, -2, 36, 4);
    c.restore();
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    poly(c, [[-10, -27], [-3, -27], [-1, -6], [-1, 6], [-3, 27], [-10, 27], [-12, 6], [-12, -6]]);
    fillStroke(c, "#5c6a43", 1.2);
    // red and white checkers on the wing tips
    for (const s of [-1, 1]) {
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        c.fillStyle = (i + j) % 2 ? "#f2efe6" : "#c8312b";
        c.fillRect(-10 + i * 3.5, s * 20 - 3 + j * 3, 3.5, 3);
      }
    }
    poly(c, [[16, -3], [8, -4.2], [-18, -1.5], [-18, 1.5], [8, 4.2], [16, 3]]);
    fillStroke(c, "#66744a", 1.2);
    poly(c, [[-15, -1], [-18, -7], [-21, -7], [-21, 7], [-18, 7], [-15, 1]]);
    fillStroke(c, "#55623d", 1);
    c.beginPath();
    c.ellipse(16, 0, 2.5, 6, 0, 0, Math.PI * 2);
    c.fillStyle = "#3a3a32";
    c.fill();
    c.fillStyle = "rgba(170,205,215,0.8)";
    c.fillRect(-2, -1.6, 5, 3.2);
    propDisc(c, 19, t);
    c.restore();
  };

  // ------------------------------------------------------------------- guns
  function sandbags(c, r, n, open) {
    const g = BK.makeRng(n * 31 + Math.round(r));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (open && Math.cos(a) > 0.82) continue;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      c.save();
      c.translate(x, y);
      c.rotate(a + Math.PI / 2);
      rr(c, -5.2, -3.2, 10.4, 6.4, 3);
      const tone = 150 + Math.floor(g() * 30);
      c.fillStyle = `rgb(${tone},${tone - 18},${tone - 58})`;
      c.fill();
      c.strokeStyle = "rgba(60,50,30,0.8)";
      c.lineWidth = 1;
      c.stroke();
      c.strokeStyle = "rgba(255,240,200,0.18)";
      c.beginPath();
      c.moveTo(-3.5, -1.5); c.lineTo(3.5, -1.5);
      c.stroke();
      c.restore();
    }
  }

  function crewHead(c, x, y) {
    c.beginPath();
    c.arc(x, y, 3.4, 0, Math.PI * 2);
    const g = c.createRadialGradient(x - 1, y - 1, 0.3, x, y, 3.6);
    g.addColorStop(0, "#8c8a56");
    g.addColorStop(1, "#4d4b2a");
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = OUT;
    c.lineWidth = 0.9;
    c.stroke();
  }

  const GUN = {};
  GUN.mg = function (c, t, rec, twin) {
    const k = -rec * 2.5;
    c.fillStyle = "#2b2b26";
    // tripod legs
    c.strokeStyle = "#3a382f";
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(0, 0); c.lineTo(-8, -6);
    c.moveTo(0, 0); c.lineTo(-8, 6);
    c.moveTo(0, 0); c.lineTo(5, 0);
    c.stroke();
    for (const off of twin ? [-2.6, 2.6] : [0]) {
      rr(c, -5 + k, off - 2.2, 14, 4.4, 1.5);
      c.fillStyle = "#3c3e38";
      c.fill();
      c.strokeStyle = OUT;
      c.lineWidth = 1;
      c.stroke();
      rr(c, 8 + k, off - 1.6, 12, 3.2, 1);
      c.fillStyle = "#555850";
      c.fill();
      c.strokeStyle = "rgba(0,0,0,0.5)";
      for (let x = 10; x < 19; x += 2.2) { c.beginPath(); c.moveTo(x + k, off - 1.6); c.lineTo(x + k, off + 1.6); c.stroke(); }
      c.fillStyle = "#1d1d1a";
      c.fillRect(20 + k, off - 0.9, 4, 1.8);
    }
    // ammo belt box
    c.fillStyle = "#4e5a33";
    c.fillRect(-2, 4, 6, 5);
    crewHead(c, -10, -1);
    crewHead(c, -6, 9);
  };
  GUN.atr = function (c, t, rec) {
    const k = -rec * 3;
    // prone rifleman, legs back
    c.fillStyle = "#545232";
    rr(c, -16, -3.5, 14, 7, 3); c.fill();
    c.strokeStyle = "#4a482c";
    c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(-15, -2); c.lineTo(-22, -4); c.moveTo(-15, 2); c.lineTo(-22, 4); c.stroke();
    crewHead(c, -2, 0);
    // the long rifle
    c.fillStyle = "#3d3a30";
    rr(c, -4 + k, -1.4, 34, 2.8, 1); c.fill();
    c.fillStyle = "#6b4b2c";
    rr(c, -6 + k, -2, 9, 4, 1.5); c.fill();
    c.fillStyle = "#1d1d1a";
    c.fillRect(29 + k, -2, 3, 4);
    // bipod
    c.strokeStyle = "#2b2a25";
    c.lineWidth = 1.1;
    c.beginPath(); c.moveTo(18, 0); c.lineTo(21, -5); c.moveTo(18, 0); c.lineTo(21, 5); c.stroke();
    // loader
    crewHead(c, -8, -10);
  };
  GUN.at37 = function (c, t, rec) {
    const k = -rec * 5;
    c.strokeStyle = "#2f332b";
    c.lineWidth = 2.6;
    c.lineCap = "round";
    c.beginPath(); c.moveTo(-2, 0); c.lineTo(-18, -9); c.moveTo(-2, 0); c.lineTo(-18, 9); c.stroke();
    c.fillStyle = "#1c1c19";
    rr(c, -4, -12, 7, 4, 1.5); c.fill();
    rr(c, -4, 8, 7, 4, 1.5); c.fill();
    // shield
    poly(c, [[3, -9], [6, -9], [6, 9], [3, 9]]);
    fillStroke(c, shade(c, 3, -9, 3, 18, "#5d6845", "#7c8a5c", "#3d462d"), 1.1);
    // barrel with muzzle brake
    rr(c, -6 + k, -2, 32, 4, 1);
    c.fillStyle = "#3e443a";
    c.fill();
    c.strokeStyle = OUT;
    c.lineWidth = 1;
    c.stroke();
    rr(c, 24 + k, -3, 5, 6, 1);
    c.fillStyle = "#2a2d27";
    c.fill();
    crewHead(c, -10, -5);
    crewHead(c, -10, 5);
  };
  GUN.mortar = function (c, t, rec) {
    // baseplate
    c.beginPath();
    c.arc(-2, 0, 7, 0, Math.PI * 2);
    c.fillStyle = "#3a3c34";
    c.fill();
    // bipod
    c.strokeStyle = "#2c2d27";
    c.lineWidth = 1.8;
    c.beginPath(); c.moveTo(8, 0); c.lineTo(11, -7); c.moveTo(8, 0); c.lineTo(11, 7); c.stroke();
    // tube, foreshortened
    rr(c, -4, -3.2, 14 + rec * 1.5, 6.4, 3);
    c.fillStyle = "#454a3d";
    c.fill();
    c.strokeStyle = OUT;
    c.lineWidth = 1;
    c.stroke();
    c.beginPath();
    c.arc(10 + rec * 1.5, 0, 2.7, 0, Math.PI * 2);
    c.fillStyle = "#111";
    c.fill();
    // bomb crates
    c.fillStyle = "#6b5634";
    c.fillRect(-14, -12, 7, 5);
    c.fillRect(-14, 7, 7, 5);
    crewHead(c, -10, 0);
    crewHead(c, 0, 10);
  };
  GUN.aa = function (c, t, rec) {
    const k = -rec * 3;
    c.strokeStyle = "#2d3128";
    c.lineWidth = 3;
    c.lineCap = "round";
    c.beginPath();
    for (const a of [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4]) {
      c.moveTo(0, 0); c.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
    }
    c.stroke();
    c.beginPath();
    c.arc(0, 0, 8, 0, Math.PI * 2);
    fillStroke(c, "#55603f", 1.1);
    // seats
    c.fillStyle = "#33372c";
    c.fillRect(-6, -9, 5, 3);
    c.fillRect(-6, 6, 5, 3);
    rr(c, -6 + k, -2.2, 34, 4.4, 1.5);
    c.fillStyle = "#3b4136";
    c.fill();
    c.strokeStyle = OUT;
    c.lineWidth = 1;
    c.stroke();
    // flash hider
    c.beginPath();
    c.moveTo(28 + k, -2.6); c.lineTo(33 + k, -3.6); c.lineTo(33 + k, 3.6); c.lineTo(28 + k, 2.6);
    c.closePath();
    c.fillStyle = "#24261f";
    c.fill();
    // clip feed on top
    c.fillStyle = "#b08f3b";
    c.fillRect(-2 + k, -1.5, 6, 3);
    crewHead(c, -4, -11);
    crewHead(c, -4, 11);
  };
  GUN.f75 = function (c, t, rec) {
    const k = -rec * 6;
    c.strokeStyle = "#2b2e26";
    c.lineWidth = 3.6;
    c.lineCap = "round";
    c.beginPath(); c.moveTo(-2, 0); c.lineTo(-26, 0); c.stroke();
    c.fillStyle = "#1c1c19";
    for (const s of [-1, 1]) { rr(c, -6, s * 13 - 3, 12, 6, 2); c.fill(); }
    poly(c, [[2, -14], [7, -14], [7, 14], [2, 14]]);
    fillStroke(c, shade(c, 2, -14, 5, 28, "#5d6845", "#7c8a5c", "#3d462d"), 1.2);
    rr(c, -10 + k, -3, 44, 6, 1.5);
    c.fillStyle = "#3a4036";
    c.fill();
    c.strokeStyle = OUT;
    c.lineWidth = 1.1;
    c.stroke();
    c.fillStyle = "#24261f";
    c.fillRect(32 + k, -3.6, 3, 7.2);
    crewHead(c, -12, -8);
    crewHead(c, -12, 8);
    crewHead(c, -20, -4);
  };

  const baseCache = {};
  function gunBase(kind) {
    if (baseCache[kind]) return baseCache[kind];
    const cv = document.createElement("canvas");
    cv.width = cv.height = 120;
    const c = cv.getContext("2d");
    c.scale(2, 2);
    c.translate(30, 30);
    c.beginPath();
    c.ellipse(1, 2, 21, 20, 0, 0, Math.PI * 2);
    c.fillStyle = "rgba(40,32,20,0.45)";
    c.fill();
    c.beginPath();
    c.arc(0, 0, 18, 0, Math.PI * 2);
    c.fillStyle = "#6b5b3d";
    c.fill();
    const big = kind === "f75" || kind === "aa";
    sandbags(c, big ? 21 : 19, big ? 15 : 13, false);
    return (baseCache[kind] = cv);
  }

  const gunShadowCache = {};
  A.gunShadow = function (c, t, sun) {
    let sh = gunShadowCache[t.kind];
    if (!sh) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 140;
      const cc = cv.getContext("2d");
      cc.translate(70, 70);
      cc.scale(2, 2);
      cc.beginPath();
      cc.arc(0, 0, t.kind === "f75" || t.kind === "aa" ? 25 : 23, 0, Math.PI * 2);
      cc.fillStyle = "#000";
      cc.fill();
      const o = document.createElement("canvas");
      o.width = o.height = 140;
      const oc = o.getContext("2d");
      oc.filter = "blur(4px)";
      oc.drawImage(cv, 0, 0);
      sh = gunShadowCache[t.kind] = o;
    }
    const s = BK.GS;
    c.save();
    c.globalAlpha = sun.a * 0.9;
    c.drawImage(sh, t.x + sun.x * 3 - 35 * s, t.y + sun.y * 3 - 35 * s, 70 * s, 70 * s);
    c.restore();
  };

  A.gun = function (c, t, opts) {
    opts = opts || {};
    const kind = t.kind;
    c.save();
    c.translate(t.x, t.y);
    c.scale(BK.GS, BK.GS);
    c.drawImage(gunBase(kind), -30, -30, 60, 60);
    c.rotate(t.ang);
    if (t.ko > 0) c.globalAlpha = 0.55;
    GUN[kind](c, t, t.recoil || 0, t.spec === "twin");
    c.restore();
  };

  // Icon versions for the build bar and wave preview.
  A.gunIcon = function (kind, size) {
    const cv = document.createElement("canvas");
    const s = size || 64;
    cv.width = cv.height = s * 2;
    const c = cv.getContext("2d");
    c.scale((s * 2) / 64 / BK.GS, (s * 2) / 64 / BK.GS);
    A.gun(c, { kind, x: 30 * BK.GS, y: 32 * BK.GS, ang: -0.6, recoil: 0, ko: 0 });
    return cv.toDataURL();
  };
  A.enemyIcon = function (kind, size) {
    const cv = document.createElement("canvas");
    const s = size || 48;
    cv.width = cv.height = s * 2;
    const c = cv.getContext("2d");
    const def = BK.ENEMIES[kind];
    const span = (def.air ? Math.max(def.L, def.Wd) : def.L || 18) / BK.US;
    const sc = (s * 2 * 0.82) / span;
    c.translate(s, s);
    c.scale(sc / BK.US, sc / BK.US);
    c.rotate(-Math.PI / 2);
    const fake = { kind, t: 0.3, seed: 3, dist: 0, alt: 1, turrets: def.turrets && def.turrets.map((x) => Object.assign({}, x)), antennaDown: false };
    A.enemy(c, fake, {});
    return cv.toDataURL();
  };
  // Shared helpers for art2.js.
  A._h = { rr, poly, fillStroke, shade, crewHead, sandbags, hullGrad, OUT, GUN, HULL, TURRET, FRAMES, LIVE, SPR };
})(typeof window !== "undefined" ? window : globalThis);
