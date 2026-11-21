// Procedural Polish farmland for the larger battlefields: a patchwork of fields in different crops,
// hedgerow verges, a river with its banks, and a railway line. Small maps use the painted terrain image.
(function (root) {
  const BK = root.BK;
  const T = (BK.Terrain = {});

  function tile(size, paint) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = size;
    const c = cv.getContext("2d");
    paint(c, size, BK.makeRng(size * 7 + paint.length));
    return cv;
  }
  function speckle(c, s, r, n, cols, w, h) {
    for (let i = 0; i < n; i++) {
      c.fillStyle = r.pick(cols);
      c.fillRect(r() * s, r() * s, w || 1 + r() * 2, h || 1 + r() * 2);
    }
  }

  // One seamless tile per crop. Rows run along x, so rotating the pattern turns the furrows.
  let TILES = null;
  function tiles() {
    if (TILES) return TILES;
    TILES = {
      wheat: tile(128, (c, s, r) => {
        c.fillStyle = "#b8974c"; c.fillRect(0, 0, s, s);
        for (let y = 0; y < s; y += 4) {
          c.fillStyle = y % 8 ? "rgba(120,92,40,0.35)" : "rgba(230,205,140,0.35)";
          c.fillRect(0, y, s, 1.5);
        }
        speckle(c, s, r, 900, ["#d6b56a", "#9c7c38", "#e4c983", "#8a6b2e"], 1, 3);
      }),
      stubble: tile(128, (c, s, r) => {
        c.fillStyle = "#c5ae78"; c.fillRect(0, 0, s, s);
        for (let y = 0; y < s; y += 6) { c.fillStyle = "rgba(140,115,70,0.3)"; c.fillRect(0, y, s, 1); }
        speckle(c, s, r, 700, ["#d8c48e", "#a88f58", "#e7d6a4"], 1.5, 1);
      }),
      plowed: tile(128, (c, s, r) => {
        c.fillStyle = "#6c5034"; c.fillRect(0, 0, s, s);
        for (let y = 0; y < s; y += 5) {
          c.fillStyle = "rgba(40,28,16,0.55)"; c.fillRect(0, y, s, 2);
          c.fillStyle = "rgba(150,118,80,0.35)"; c.fillRect(0, y + 2.5, s, 1);
        }
        speckle(c, s, r, 400, ["#7d6040", "#5a4128", "#8f7350"]);
      }),
      meadow: tile(128, (c, s, r) => {
        c.fillStyle = "#6e8a3e"; c.fillRect(0, 0, s, s);
        for (let i = 0; i < 40; i++) {
          const x = r() * s, y = r() * s, rad = 6 + r() * 16;
          const g = c.createRadialGradient(x, y, 0, x, y, rad);
          g.addColorStop(0, r() < 0.5 ? "rgba(140,160,70,0.35)" : "rgba(70,95,40,0.35)");
          g.addColorStop(1, "rgba(0,0,0,0)");
          c.fillStyle = g;
          c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        }
        speckle(c, s, r, 900, ["#82a04a", "#5c7632", "#93ad5a", "#4f682a"], 1, 2);
        speckle(c, s, r, 30, ["#e8e2c6", "#d9c24c"], 1.5, 1.5);
      }),
      potato: tile(128, (c, s, r) => {
        c.fillStyle = "#5e4a32"; c.fillRect(0, 0, s, s);
        for (let y = 2; y < s; y += 8) {
          for (let x = 0; x < s; x += 5) {
            c.fillStyle = r() < 0.5 ? "#4f6b2c" : "#628238";
            c.beginPath(); c.arc(x + r() * 2, y + r() * 2, 2.4 + r(), 0, 6.28); c.fill();
          }
        }
      }),
      grass: tile(128, (c, s, r) => {
        c.fillStyle = "#68803b"; c.fillRect(0, 0, s, s);
        speckle(c, s, r, 1100, ["#7a9446", "#5a7030", "#86a050", "#4c6328"], 1, 2);
      }),
    };
    return TILES;
  }

  function nearPaths(paths, x, y) {
    let d = 1e9;
    for (const p of paths) d = Math.min(d, p.near(x, y));
    return d;
  }

  // Build the extra geometry a big map needs: fields, river, rail.
  T.layout = function (map, paths) {
    const W = map.ww, H = map.wh;
    const rng = BK.makeRng(map.seed * 131 + 9);
    const cell = 300;
    const nx = Math.ceil(W / cell) + 1, ny = Math.ceil(H / cell) + 1;
    const pts = [];
    for (let j = 0; j <= ny; j++) {
      pts[j] = [];
      for (let i = 0; i <= nx; i++) {
        const edge = i === 0 || j === 0 || i === nx || j === ny;
        pts[j][i] = [i * cell + (edge ? 0 : rng.range(-90, 90)) - cell / 2, j * cell + (edge ? 0 : rng.range(-90, 90)) - cell / 2];
      }
    }
    const kinds = ["wheat", "wheat", "stubble", "plowed", "plowed", "meadow", "meadow", "potato", "stubble"];
    const fields = [];
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const quad = [pts[j][i], pts[j][i + 1], pts[j + 1][i + 1], pts[j + 1][i]];
        // Split some cells in two for long strip fields, a Polish country look.
        if (rng() < 0.45) {
          const m1 = [(quad[0][0] + quad[1][0]) / 2, (quad[0][1] + quad[1][1]) / 2], m2 = [(quad[3][0] + quad[2][0]) / 2, (quad[3][1] + quad[2][1]) / 2];
          fields.push({ poly: [quad[0], m1, m2, quad[3]], kind: rng.pick(kinds), ang: rng.range(-0.3, 0.3) + Math.PI / 2 });
          fields.push({ poly: [m1, quad[1], quad[2], m2], kind: rng.pick(kinds), ang: rng.range(-0.3, 0.3) + Math.PI / 2 });
        } else fields.push({ poly: quad, kind: rng.pick(kinds), ang: rng.range(0, Math.PI) });
      }
    }
    const lay = { fields, river: null, rail: null };
    if (map.river) lay.river = Object.assign(BK.buildPath(map.river.map(([x, y]) => [x * W, y * H]), 8), { width: map.riverWidth || 64 });
    if (map.rail) lay.rail = BK.buildPath(map.rail.map(([x, y]) => [x * W, y * H]), 8);
    return lay;
  };

  T.isWater = function (lay, x, y) {
    return !!(lay && lay.river && lay.river.near(x, y) < lay.river.width / 2 + 10);
  };

  // Physical surface cues baked into the static battlefield texture once.
  // These are field-specific crop rows and crushed edges, not a new sprite or
  // another procedural layer in the 60fps render loop. They never affect paths.
  T.paintFieldRelief = function (c, f, seed) {
    if (!f.poly || f.poly.length < 3) return;
    const rng = BK.makeRng((seed * 151 + f.poly.length * 19 + Math.round(f.poly[0][0] * 11 + f.poly[0][1])) | 0);
    const xs = f.poly.map(p => p[0]), ys = f.poly.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
    const radius = Math.hypot(maxX - minX, maxY - minY) * .75 + 15;
    c.save();
    c.beginPath(); c.moveTo(f.poly[0][0], f.poly[0][1]);
    for (const p of f.poly.slice(1)) c.lineTo(p[0], p[1]);
    c.closePath(); c.clip();
    c.translate(centerX, centerY); c.rotate(f.ang || 0);
    const density = f.kind === 'plowed' ? 8 : f.kind === 'wheat' ? 17 : 26;
    // Narrow irregular rows with dark and bright sides, varying by crop type.
    for (let y = -radius; y <= radius; y += density) {
      const sway = rng.range(-3, 3);
      c.strokeStyle = f.kind === 'plowed' ? 'rgba(24,17,12,.19)' : f.kind === 'wheat' ? 'rgba(78,57,23,.12)' : 'rgba(42,47,23,.10)';
      c.lineWidth = f.kind === 'plowed' ? 3.2 : 1.5;
      c.beginPath(); c.moveTo(-radius, y + sway); c.lineTo(radius, y + sway + rng.range(-2, 2)); c.stroke();
      c.strokeStyle = f.kind === 'plowed' ? 'rgba(210,182,131,.21)' : 'rgba(241,221,155,.17)';
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(-radius, y + sway + 3); c.lineTo(radius, y + sway + 3); c.stroke();
    }
    // Crushed stalks, damp patches, exposed earth; deterministic per field.
    const n = Math.min(210, Math.max(24, Math.round(((maxX - minX) * (maxY - minY)) / 3000)));
    for (let i = 0; i < n; i++) {
      const x = rng.range(-radius, radius), y = rng.range(-radius, radius);
      c.strokeStyle = rng() < .55 ? 'rgba(245,224,177,.23)' : 'rgba(50,43,25,.19)';
      c.lineWidth = rng.range(.7, 1.5);
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + rng.range(2, 9), y + rng.range(-3, 3)); c.stroke();
      if (f.kind === 'wheat' && rng() < .3) {
        c.fillStyle = 'rgba(237,215,151,.31)'; c.fillRect(x + 3, y - 1, 2, 2);
      }
    }
    c.restore();
  };

  T.paint = function (c, map, lay, paths) {
    const W = map.ww, H = map.wh;
    const tl = tiles();
    c.fillStyle = c.createPattern(tl.grass, "repeat");
    c.fillRect(0, 0, W, H);
    for (const f of lay.fields) {
      const pat = c.createPattern(tl[f.kind], "repeat");
      if (pat.setTransform) pat.setTransform(new DOMMatrix().rotate((f.ang * 180) / Math.PI));
      c.beginPath();
      c.moveTo(f.poly[0][0], f.poly[0][1]);
      for (const p of f.poly.slice(1)) c.lineTo(p[0], p[1]);
      c.closePath();
      c.fillStyle = pat;
      c.fill();
      T.paintFieldRelief(c, f, map.seed);
    }
    // Grass verges between fields, with scattered bushes along them.
    const rng = BK.makeRng(map.seed * 17);
    c.lineJoin = "round";
    for (const f of lay.fields) {
      c.beginPath();
      c.moveTo(f.poly[0][0], f.poly[0][1]);
      for (const p of f.poly.slice(1)) c.lineTo(p[0], p[1]);
      c.closePath();
      c.strokeStyle = "rgba(78,98,46,0.95)";
      c.lineWidth = 7;
      c.stroke();
      c.strokeStyle = "rgba(40,50,24,0.35)";
      c.lineWidth = 1.5;
      c.stroke();
      for (let k = 0; k < f.poly.length; k++) {
        const a = f.poly[k], b = f.poly[(k + 1) % f.poly.length];
        const n = Math.floor(BK.dist(a[0], a[1], b[0], b[1]) / 40);
        for (let i = 0; i < n; i++) {
          if (rng() > 0.4) continue;
          const t = rng(), x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
          const r = rng.range(4, 9);
          c.fillStyle = "rgba(0,0,0,0.28)";
          c.beginPath(); c.arc(x + 3, y + 3, r, 0, 6.28); c.fill();
          const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
          g.addColorStop(0, "#7f9a45"); g.addColorStop(1, "#3c5122");
          c.fillStyle = g;
          c.beginPath(); c.arc(x, y, r, 0, 6.28); c.fill();
        }
      }
    }
    if (lay.river) T.paintRiver(c, lay.river);
    if (lay.rail) T.paintRail(c, lay.rail, paths);
  };

  function strokePath(c, pts, w, style) {
    c.strokeStyle = style;
    c.lineWidth = w;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) c.lineTo(p[0], p[1]);
    c.stroke();
  }

  T.paintRiver = function (c, rv) {
    const w = rv.width;
    strokePath(c, rv.pts, w + 26, "rgba(70,58,36,0.8)");
    strokePath(c, rv.pts, w + 12, "#4b5a3a");
    strokePath(c, rv.pts, w, "#2f4a4c");
    strokePath(c, rv.pts, w * 0.75, "#355a5c");
    strokePath(c, rv.pts, w * 0.4, "#3f6a69");
    // Glints on the current and reeds along the banks.
    const r = BK.makeRng(rv.pts.length);
    for (let i = 0; i < rv.pts.length; i += 2) {
      const [x, y] = rv.pts[i];
      if (r() < 0.5) {
        c.strokeStyle = "rgba(190,215,210,0.25)";
        c.lineWidth = 1.2;
        const ox = r.range(-w * 0.3, w * 0.3), oy = r.range(-w * 0.3, w * 0.3);
        c.beginPath(); c.moveTo(x + ox, y + oy); c.lineTo(x + ox + 7, y + oy + 1); c.stroke();
      }
      const a = i < rv.pts.length - 1 ? Math.atan2(rv.pts[i + 1][1] - y, rv.pts[i + 1][0] - x) : 0;
      for (const s of [-1, 1]) {
        if (r() < 0.55) continue;
        const bx = x - Math.sin(a) * (w / 2 + 4) * s, by = y + Math.cos(a) * (w / 2 + 4) * s;
        c.strokeStyle = r() < 0.5 ? "#6a7a3a" : "#8a8a48";
        c.lineWidth = 1.3;
        for (let k = 0; k < 4; k++) {
          c.beginPath(); c.moveTo(bx + r.range(-4, 4), by + r.range(-4, 4)); c.lineTo(bx + r.range(-6, 6), by + r.range(-9, -3)); c.stroke();
        }
      }
    }
  };

  T.paintRail = function (c, rl) {
    strokePath(c, rl.pts, 30, "rgba(40,34,24,0.35)");
    strokePath(c, rl.pts, 24, "#7a7266");
    // sleepers
    for (let i = 0; i < rl.pts.length - 1; i++) {
      const [x, y] = rl.pts[i], [x2, y2] = rl.pts[i + 1];
      const a = Math.atan2(y2 - y, x2 - x);
      c.save();
      c.translate(x, y);
      c.rotate(a);
      c.fillStyle = "#4a3a28";
      c.fillRect(-1.6, -11, 3.2, 22);
      c.restore();
    }
    for (const off of [-6, 6]) {
      c.strokeStyle = "#2b2a28";
      c.lineWidth = 2.2;
      c.beginPath();
      for (let i = 0; i < rl.pts.length - 1; i++) {
        const [x, y] = rl.pts[i], [x2, y2] = rl.pts[i + 1];
        const a = Math.atan2(y2 - y, x2 - x);
        const px = x - Math.sin(a) * off, py = y + Math.cos(a) * off;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
      c.strokeStyle = "rgba(220,220,210,0.35)";
      c.lineWidth = 0.7;
      c.stroke();
    }
  };

  // Where a road crosses the river: a timber bridge with railings, painted over the road.
  T.bridges = function (lay, paths) {
    const out = [];
    if (!lay.river) return out;
    for (const p of paths) {
      let inside = false, start = 0;
      for (let d = 0; d < p.len; d += 4) {
        const [x, y] = p.at(d);
        const w = lay.river.near(x, y) < lay.river.width / 2 + 14;
        if (w && !inside) { inside = true; start = d; }
        if (!w && inside) {
          inside = false;
          const [mx, my, a] = p.at((start + d) / 2);
          if (!out.some((b) => BK.dist(b.x, b.y, mx, my) < 40)) out.push({ x: mx, y: my, ang: a, len: d - start + 24 });
        }
      }
    }
    return out;
  };
  T.paintBridge = function (c, b) {
    c.save();
    c.translate(b.x, b.y);
    c.rotate(b.ang);
    c.fillStyle = "rgba(0,0,0,0.35)";
    c.fillRect(-b.len / 2 + 4, -36, b.len, 76);
    c.fillStyle = "#6b5236";
    c.fillRect(-b.len / 2, -33, b.len, 66);
    c.strokeStyle = "rgba(40,28,16,0.55)";
    c.lineWidth = 1;
    for (let x = -b.len / 2 + 3; x < b.len / 2; x += 5) { c.beginPath(); c.moveTo(x, -33); c.lineTo(x, 33); c.stroke(); }
    for (const s of [-1, 1]) {
      c.fillStyle = "#3e2e1c";
      c.fillRect(-b.len / 2, s * 34 - 2.5, b.len, 5);
      for (let x = -b.len / 2; x <= b.len / 2; x += 18) c.fillRect(x - 2.5, s * 34 - 4, 5, 8);
    }
    c.restore();
  };

  // Railway: a slow freight train now and then, for life on the bigger maps.
  T.railAt = function (lay, d) { return lay.rail ? lay.rail.at(d) : null; };
})(typeof window !== "undefined" ? window : globalThis);
