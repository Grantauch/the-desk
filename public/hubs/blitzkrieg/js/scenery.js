// Farms, fences, telegraph lines, shrines and old wreckage, placed by seed around each road.
// Everything here is painted into the ground layer once, shadows included.
(function (root) {
  const BK = root.BK;
  const S = (BK.Scenery = {});

  function nearRoad(paths, x, y) {
    let d = 1e9;
    for (const p of paths) d = Math.min(d, p.near(x, y));
    return d;
  }

  BK.makeProps = function (map, paths, layout) {
    const W = map.ww || BK.W, H = map.wh || BK.H;
    const area = (W * H) / (1280 * 720);
    const rng = BK.makeRng(map.seed * 977 + 5);
    const props = [];
    const water = (x, y, r) => (map.procedural ? BK.Terrain.isWater(layout, x, y) || (layout && layout.river && layout.river.near(x, y) < layout.river.width / 2 + r) : y > 612 - r);
    const clear = (x, y, r) => {
      if (x < r + 10 || x > W - r - 10 || y < r + 10 || y > H - r - 10) return false;
      if (water(x, y, r)) return false;
      if (layout && layout.rail && layout.rail.near(x, y) < r + 20) return false;
      for (const q of props) if (BK.dist(x, y, q.x, q.y) < r + q.r + 12) return false;
      return true;
    };
    const add = (o) => { props.push(o); return o; };

    // Villages: houses strung along the road near each centre, a church in the first, a windmill on the edge.
    (map.villages || []).forEach(([vx, vy], vi) => {
      const cx = vx * W, cy = vy * H;
      let placed = 0;
      for (let tries = 0; tries < 260 && placed < 7; tries++) {
        const a = rng() * 6.28, d = rng.range(70, 240);
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
        const dr = nearRoad(paths, x, y);
        if (dr < 78 || dr > 150 || !clear(x, y, 46)) continue;
        // Face the road like a real street front.
        let ra = 0, bd = 1e9;
        for (const p of paths) for (let dd = 0; dd < p.len; dd += 16) { const [px, py, pa] = p.at(dd); const d2 = (px - x) ** 2 + (py - y) ** 2; if (d2 < bd) { bd = d2; ra = pa; } }
        add({ kind: "house", x, y, r: 40, rot: ra + rng.range(-0.15, 0.15), w: 78, h: 50, block: true, roof: rng.pick(["thatch", "tile", "thatch"]), burning: rng() < 0.2 });
        placed++;
        if (rng() < 0.4) { const sx = x + rng.range(-50, 50), sy = y + rng.range(-50, 50); if (clear(sx, sy, 10)) add({ kind: "sweep", x: sx, y: sy, r: 10, rot: rng() * 6, block: true }); }
      }
      if (vi === 0) for (let tries = 0; tries < 200; tries++) {
        const x = cx + rng.range(-200, 200), y = cy + rng.range(-200, 200);
        if (nearRoad(paths, x, y) < 90 || !clear(x, y, 58)) continue;
        add({ kind: "church", x, y, r: 54, rot: rng.range(-0.3, 0.3), block: true });
        break;
      }
      for (let tries = 0; tries < 200; tries++) {
        const a = rng() * 6.28, d = rng.range(240, 380);
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
        if (nearRoad(paths, x, y) < 90 || !clear(x, y, 34)) continue;
        add({ kind: "windmill", x, y, r: 30, rot: rng() * 6, block: true, spin: rng.range(0.4, 0.8) });
        break;
      }
    });

    // Farmsteads in the open country.
    let farms = 0, burning = false;
    const farmTarget = Math.round(2 * Math.sqrt(area));
    for (let tries = 0; tries < 900 && farms < farmTarget; tries++) {
      const x = rng.range(80, W - 80), y = rng.range(70, H - 100);
      const d = nearRoad(paths, x, y);
      if (d < 105 || d > 260 || !clear(x, y, 80)) continue;
      const rot = rng.range(-0.5, 0.5);
      const fire = !burning && rng() < 0.7;
      if (fire) burning = true;
      add({ kind: "house", x, y, r: 44, rot, w: 86, h: 54, block: true, roof: rng.pick(["thatch", "tile"]), burning: fire, stork: rng() < 0.35 });
      const bx = x + Math.cos(rot) * 96 - Math.sin(rot) * rng.range(-20, 20), by = y + Math.sin(rot) * 96 + rng.range(10, 30);
      if (clear(bx, by, 38) && nearRoad(paths, bx, by) > 70) add({ kind: rng() < 0.6 ? "barn" : "shed", x: bx, y: by, r: 38, rot: rot + rng.range(-0.2, 0.2), w: 74, h: 48, block: true });
      const wx = x - Math.cos(rot) * 56 + rng.range(-10, 10), wy = y + rng.range(30, 46);
      if (clear(wx, wy, 10)) add({ kind: rng() < 0.5 ? "well" : "sweep", x: wx, y: wy, r: 10, rot: rng() * 6, block: true });
      const cx = x + rng.range(-40, 40), cy = y - rng.range(40, 55);
      if (clear(cx, cy, 12)) add({ kind: "crates", x: cx, y: cy, r: 12, rot: rng.range(0, 3), block: true });
      // An orchard behind the house.
      if (rng() < 0.5) {
        const ox = x - Math.cos(rot) * 130, oy = y - Math.sin(rot) * 130;
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
          const tx = ox + (i - 1) * 32 + rng.range(-3, 3), ty = oy + (j - 1) * 32 + rng.range(-3, 3);
          if (clear(tx, ty, 14) && nearRoad(paths, tx, ty) > 60) add({ kind: "tree", x: tx, y: ty, r: 15, s: 0.62, rot: rng() * 3, block: true, orchard: true });
        }
      }
      farms++;
    }

    // Telegraph lines along every road, set back on one side.
    for (const main of paths.slice(0, map.procedural ? 3 : 1)) {
      const side = rng() < 0.5 ? -1 : 1;
      let last = null;
      for (let d = 60; d < main.len; d += 130) {
        const [px, py, a] = main.at(d);
        const x = px - Math.sin(a) * 46 * side, y = py + Math.cos(a) * 46 * side;
        if (!clear(x, y, 6) || nearRoad(paths, x, y) < 38) { last = null; continue; }
        last = add({ kind: "pole", x, y, r: 6, block: true, prev: last, rot: a, stork: rng() < 0.06 });
      }
    }

    const roadside = (kind, off, r, extra) => {
      for (let i = 0; i < 120; i++) {
        const p = rng.pick(paths);
        const [px, py, a] = p.at(rng.range(p.len * 0.12, p.len * 0.88));
        const sd = rng() < 0.5 ? -1 : 1;
        const x = px - Math.sin(a) * off * sd, y = py + Math.cos(a) * off * sd;
        if (nearRoad(paths, x, y) < off - 6 || !clear(x, y, r)) continue;
        return add(Object.assign({ kind, x, y, r, rot: a + rng.range(-0.4, 0.4), block: true }, extra || {}));
      }
    };
    const k = Math.max(1, Math.round(Math.sqrt(area)));
    for (let i = 0; i < k; i++) { roadside("shrine", 46, 9); roadside("cart", 50, 16); roadside("tks", 56, 16); }
    // Old Polish bunkers on the defended lines.
    if (map.id === "mlawa" || map.id === "wizna") for (let i = 0; i < 4; i++) roadside("bunker", 90, 22);

    for (let n = 0, tries = 0; n < Math.round(4 * area) && tries < 600; tries++) {
      const x = rng.range(60, W - 60), y = rng.range(60, H - 120);
      const a = rng.range(0, Math.PI), L = rng.range(90, 170);
      const x2 = x + Math.cos(a) * L, y2 = y + Math.sin(a) * L;
      let ok = x2 > 20 && x2 < W - 20 && y2 > 20 && y2 < H - 100;
      for (let q = 0; ok && q <= 6; q++) {
        const fx = x + (x2 - x) * (q / 6), fy = y + (y2 - y) * (q / 6);
        if (nearRoad(paths, fx, fy) < 60 || !clear(fx, fy, 8)) ok = false;
      }
      if (!ok) continue;
      const f = add({ kind: "fence", x: (x + x2) / 2, y: (y + y2) / 2, x1: x, y1: y, x2, y2, r: 4, block: false });
      for (let q = 0; q <= 6; q++) add({ kind: "block", x: x + (x2 - x) * (q / 6), y: y + (y2 - y) * (q / 6), r: 8, block: true, of: f });
      n++;
    }

    // Woods: clumps of trees, more of them on the bigger maps.
    const kinds = ["tree", "pine", "tree", "pine", "hay"];
    const woods = map.procedural ? Math.round(area * 1.6) : 0;
    for (let w = 0; w < woods; w++) {
      const cx = rng.range(80, W - 80), cy = rng.range(80, H - 120);
      if (nearRoad(paths, cx, cy) < 120) continue;
      for (let i = 0; i < 9; i++) {
        const x = cx + rng.range(-90, 90), y = cy + rng.range(-70, 70);
        if (nearRoad(paths, x, y) < 66 || !clear(x, y, 22)) continue;
        add({ kind: rng() < 0.6 ? "pine" : "tree", x, y, r: 24, s: rng.range(0.9, 1.25), rot: rng.range(-0.4, 0.4), block: true });
      }
    }
    for (let n = 0, tries = 0; n < Math.round(16 * Math.sqrt(area)) && tries < 1200; tries++) {
      const x = rng.range(30, W - 30), y = rng.range(30, H - 60);
      if (nearRoad(paths, x, y) < 66 || !clear(x, y, 26)) continue;
      const kind = rng.pick(kinds);
      add({ kind, x, y, r: kind === "hay" ? 24 : 26, s: rng.range(0.9, 1.2), rot: rng.range(-0.4, 0.4), block: true });
      n++;
    }
    for (let n = 0, tries = 0; n < Math.round(5 * area) && tries < 400; tries++) {
      const x = rng.range(60, W - 60), y = rng.range(60, H - 100);
      if (nearRoad(paths, x, y) < 60 || !clear(x, y, 22)) continue;
      add({ kind: "stooks", x, y, r: 0, rot: rng.range(0, 3), block: false, seed: n });
      n++;
    }
    for (let n = 0; n < Math.round(7 * area); n++) {
      const x = rng.range(40, W - 40), y = rng.range(40, H - 100);
      if (water(x, y, 10)) continue;
      add({ kind: "crater", x, y, r: 0, s: rng.range(0.6, 1.3), block: false, seed: n });
    }
    return props;
  };

  // ------------------------------------------------------------------ drawing
  function rr(c, x, y, w, h, r) { BK.Art.rr(c, x, y, w, h, r); }

  function softShadow(c, sun, fn, h, blur) {
    c.save();
    c.translate(sun.x * h, sun.y * h);
    c.filter = `blur(${blur || 3}px)`;
    c.globalAlpha = sun.a;
    c.fillStyle = "#000";
    c.strokeStyle = "#000";
    fn();
    c.restore();
  }

  function roof(c, w, h, kind, rng) {
    // Two planes split along the ridge: the lit side and the shaded side.
    const thatch = kind === "thatch";
    const top = thatch ? ["#b49a5c", "#8e7740"] : ["#a35a3c", "#7a3f2a"];
    const bot = thatch ? ["#7c6634", "#5c4b26"] : ["#6b3524", "#4f2619"];
    let g = c.createLinearGradient(0, -h / 2, 0, 0);
    g.addColorStop(0, top[1]); g.addColorStop(1, top[0]);
    c.fillStyle = g;
    c.fillRect(-w / 2, -h / 2, w, h / 2);
    g = c.createLinearGradient(0, 0, 0, h / 2);
    g.addColorStop(0, bot[0]); g.addColorStop(1, bot[1]);
    c.fillStyle = g;
    c.fillRect(-w / 2, 0, w, h / 2);
    if (thatch) {
      c.lineWidth = 0.8;
      for (let i = 0; i < 260; i++) {
        const x = rng.range(-w / 2, w / 2), y = rng.range(-h / 2, h / 2);
        c.strokeStyle = rng() < 0.5 ? "rgba(60,46,20,0.35)" : "rgba(220,200,140,0.25)";
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + rng.range(-1, 1), y + (y < 0 ? 3 : -3));
        c.stroke();
      }
    } else {
      c.strokeStyle = "rgba(40,16,10,0.4)";
      c.lineWidth = 0.7;
      for (let y = -h / 2 + 3; y < h / 2; y += 3.2) { c.beginPath(); c.moveTo(-w / 2, y); c.lineTo(w / 2, y); c.stroke(); }
      for (let x = -w / 2; x < w / 2; x += 4) for (let y = -h / 2; y < h / 2; y += 6.4) { c.beginPath(); c.moveTo(x + ((y / 3.2) % 2) * 2, y); c.lineTo(x + ((y / 3.2) % 2) * 2, y + 3.2); c.stroke(); }
    }
    // ridge
    c.fillStyle = thatch ? "#5a4824" : "#4a2016";
    c.fillRect(-w / 2, -1.2, w, 2.4);
    c.strokeStyle = "rgba(0,0,0,0.6)";
    c.lineWidth = 1.2;
    c.strokeRect(-w / 2, -h / 2, w, h);
  }

  S.draw = function (c, pr, sun, rngSeed) {
    const rng = BK.makeRng(Math.round(pr.x * 13 + pr.y * 7 + (rngSeed || 0)));
    c.save();
    c.translate(pr.x, pr.y);
    switch (pr.kind) {
      case "sweep":
      case "bunker":
        c.restore();
        S.drawExtra(c, pr, sun);
        return;
      case "crater": {
        const s = 16 * pr.s;
        let g = c.createRadialGradient(0, 0, s * 0.2, 0, 0, s * 1.5);
        g.addColorStop(0, "rgba(40,30,18,0.7)");
        g.addColorStop(0.55, "rgba(70,54,34,0.45)");
        g.addColorStop(0.75, "rgba(170,145,105,0.35)");
        g.addColorStop(1, "rgba(170,145,105,0)");
        c.fillStyle = g;
        c.beginPath();
        c.arc(0, 0, s * 1.5, 0, Math.PI * 2);
        c.fill();
        for (let i = 0; i < 10; i++) {
          c.fillStyle = "rgba(60,46,28,0.5)";
          const a = rng() * 6.28, d = rng.range(s * 1.1, s * 2);
          c.fillRect(Math.cos(a) * d, Math.sin(a) * d, 2, 2);
        }
        break;
      }
      case "stooks": {
        c.rotate(pr.rot);
        for (let i = 0; i < 9; i++) {
          const x = (i % 3) * 18 - 18 + rng.range(-3, 3), y = Math.floor(i / 3) * 16 - 16 + rng.range(-3, 3);
          c.save();
          c.translate(x, y);
          c.fillStyle = `rgba(0,0,0,${sun.a * 0.9})`;
          c.beginPath();
          c.ellipse(sun.x * 4, sun.y * 4, 7, 6, 0, 0, Math.PI * 2);
          c.fill();
          // a stook from above: a dome of bound sheaves, the tied tops gathered at the centre
          const g = c.createRadialGradient(-1.5, -1.5, 0.5, 0, 0, 7);
          g.addColorStop(0, "#e3c983");
          g.addColorStop(0.6, "#b8994f");
          g.addColorStop(1, "#7d6631");
          c.fillStyle = g;
          c.beginPath();
          c.arc(0, 0, 6.5, 0, 6.28);
          c.fill();
          c.strokeStyle = "rgba(90,70,30,0.55)";
          c.lineWidth = 0.7;
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * 6.28 + 0.3;
            c.beginPath();
            c.moveTo(Math.cos(a) * 1.5, Math.sin(a) * 1.5);
            c.lineTo(Math.cos(a) * 6.2, Math.sin(a) * 6.2);
            c.stroke();
          }
          c.restore();
        }
        break;
      }
      case "fence": {
        c.translate(-pr.x, -pr.y);
        const len = BK.dist(pr.x1, pr.y1, pr.x2, pr.y2), n = Math.floor(len / 14);
        const line = (ox, oy, col, w) => {
          c.strokeStyle = col;
          c.lineWidth = w;
          c.beginPath();
          c.moveTo(pr.x1 + ox, pr.y1 + oy);
          c.lineTo(pr.x2 + ox, pr.y2 + oy);
          c.stroke();
        };
        line(sun.x * 1.6, sun.y * 1.6, `rgba(0,0,0,${sun.a})`, 2.6);
        line(0, 0, "#6e5536", 2.2);
        line(0, -1, "rgba(220,190,140,0.35)", 0.7);
        for (let k = 0; k <= n; k++) {
          const x = pr.x1 + (pr.x2 - pr.x1) * (k / n), y = pr.y1 + (pr.y2 - pr.y1) * (k / n);
          c.fillStyle = `rgba(0,0,0,${sun.a})`;
          c.fillRect(x + sun.x * 2 - 1.5, y + sun.y * 2 - 1.5, 3, 3);
          c.fillStyle = "#4e3a22";
          c.fillRect(x - 1.8, y - 1.8, 3.6, 3.6);
        }
        break;
      }
      case "pole": {
        // wire to the previous pole, and the long shadow a pole throws in low sun
        if (pr.prev) {
          const dx = pr.prev.x - pr.x, dy = pr.prev.y - pr.y;
          c.strokeStyle = `rgba(0,0,0,${sun.a * 0.6})`;
          c.lineWidth = 0.8;
          for (const o of [-2, 2]) { c.beginPath(); c.moveTo(sun.x * 5, sun.y * 5 + o); c.lineTo(dx + sun.x * 5, dy + sun.y * 5 + o); c.stroke(); }
          c.strokeStyle = "rgba(30,28,24,0.75)";
          c.lineWidth = 0.7;
          for (const o of [-2, 2]) { c.beginPath(); c.moveTo(0, o); c.lineTo(dx, dy + o); c.stroke(); }
        }
        c.strokeStyle = `rgba(0,0,0,${sun.a * 0.9})`;
        c.lineWidth = 2.6;
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(sun.x * 5, sun.y * 5);
        c.stroke();
        c.save();
        c.rotate(pr.rot + Math.PI / 2);
        c.fillStyle = "#3c2d1c";
        c.fillRect(-6, -1, 12, 2);
        c.fillStyle = "#d8d3c2";
        c.fillRect(-5.5, -1.6, 1.6, 1.6);
        c.fillRect(3.9, -1.6, 1.6, 1.6);
        c.restore();
        c.beginPath();
        c.arc(0, 0, 2.6, 0, 6.28);
        c.fillStyle = "#5a4328";
        c.fill();
        break;
      }
      case "house":
      case "barn":
      case "shed": {
        c.rotate(pr.rot);
        const w = pr.kind === "shed" ? 48 : pr.w, h = pr.kind === "shed" ? 32 : pr.h;
        softShadow(c, { x: sun.x * Math.cos(-pr.rot) - sun.y * Math.sin(-pr.rot), y: sun.x * Math.sin(-pr.rot) + sun.y * Math.cos(-pr.rot), a: sun.a * 1.2 }, () => c.fillRect(-w / 2, -h / 2, w, h), 3.5, 4);
        if (pr.kind === "house") {
          roof(c, w, h, pr.roof, rng);
          // chimney
          c.fillStyle = "rgba(0,0,0,0.4)";
          c.fillRect(w * 0.18 + 2, -h * 0.3 + 2, 6, 6);
          c.fillStyle = "#8a7e72";
          c.fillRect(w * 0.18, -h * 0.3, 6, 6);
          c.fillStyle = "#222";
          c.fillRect(w * 0.18 + 1.5, -h * 0.3 + 1.5, 3, 3);
          if (pr.burning) {
            // A fallen section of roof, charred rafters over the glow of the fire inside.
            const hx = -w * 0.18, hy = 2;
            const g = c.createRadialGradient(hx, hy, 1, hx, hy, 20);
            g.addColorStop(0, "#ffb347");
            g.addColorStop(0.4, "#c2410c");
            g.addColorStop(0.8, "#2a120a");
            g.addColorStop(1, "rgba(20,10,6,0.9)");
            c.fillStyle = g;
            c.beginPath();
            c.ellipse(hx, hy, 21, 15, 0.3, 0, 6.28);
            c.fill();
            c.strokeStyle = "#140c08";
            c.lineWidth = 2;
            for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(hx + i * 6 - 4, hy - 12); c.lineTo(hx + i * 6 + 3, hy + 12); c.stroke(); }
            c.fillStyle = "rgba(15,10,6,0.5)";
            c.beginPath();
            c.ellipse(hx + 14, hy - 4, 16, 10, 0, 0, 6.28);
            c.fill();
          }
        } else if (pr.kind === "barn") {
          const g = c.createLinearGradient(0, -h / 2, 0, h / 2);
          g.addColorStop(0, "#6a4a30"); g.addColorStop(0.5, "#8b6640"); g.addColorStop(0.52, "#5a3d26"); g.addColorStop(1, "#3d2a1a");
          c.fillStyle = g;
          c.fillRect(-w / 2, -h / 2, w, h);
          c.strokeStyle = "rgba(30,18,10,0.55)";
          c.lineWidth = 0.8;
          for (let x = -w / 2 + 3; x < w / 2; x += 3.4) { c.beginPath(); c.moveTo(x, -h / 2); c.lineTo(x, h / 2); c.stroke(); }
          c.fillStyle = "#3a2716";
          c.fillRect(-w / 2, -1.4, w, 2.8);
          c.strokeStyle = "rgba(0,0,0,0.6)";
          c.lineWidth = 1.2;
          c.strokeRect(-w / 2, -h / 2, w, h);
          // a door left open, hay spilling out
          c.fillStyle = "#c9a95a";
          c.beginPath();
          c.ellipse(w / 2 + 6, 4, 8, 5, 0, 0, 6.28);
          c.fill();
        } else {
          c.fillStyle = "#6b6a63";
          c.fillRect(-w / 2, -h / 2, w, h);
          c.strokeStyle = "rgba(0,0,0,0.4)";
          c.lineWidth = 0.7;
          for (let y = -h / 2 + 2.5; y < h / 2; y += 2.5) { c.beginPath(); c.moveTo(-w / 2, y); c.lineTo(w / 2, y); c.stroke(); }
          c.strokeStyle = "rgba(0,0,0,0.6)";
          c.lineWidth = 1.2;
          c.strokeRect(-w / 2, -h / 2, w, h);
        }
        break;
      }
      case "well": {
        c.fillStyle = `rgba(0,0,0,${sun.a})`;
        c.beginPath(); c.arc(sun.x * 2, sun.y * 2, 9, 0, 6.28); c.fill();
        c.beginPath(); c.arc(0, 0, 8.5, 0, 6.28);
        c.fillStyle = "#8d877a"; c.fill();
        c.strokeStyle = "rgba(40,36,30,0.8)"; c.lineWidth = 1; c.stroke();
        c.beginPath(); c.arc(0, 0, 5, 0, 6.28);
        c.fillStyle = "#1a1d1e"; c.fill();
        c.fillStyle = "#4e3a22";
        c.fillRect(-9, -1, 18, 2);
        break;
      }
      case "crates": {
        c.rotate(pr.rot);
        const boxes = [[-6, -5], [5, -4], [-1, 6]];
        for (const [x, y] of boxes) {
          c.fillStyle = `rgba(0,0,0,${sun.a})`;
          c.fillRect(x - 5 + sun.x * 1.5, y - 5 + sun.y * 1.5, 10, 10);
        }
        for (const [x, y] of boxes) {
          rr(c, x - 5, y - 5, 10, 10, 1);
          c.fillStyle = "#7b5f38"; c.fill();
          c.strokeStyle = "#3a2a14"; c.lineWidth = 1; c.stroke();
          c.beginPath(); c.moveTo(x - 5, y - 5); c.lineTo(x + 5, y + 5); c.strokeStyle = "rgba(58,42,20,0.6)"; c.stroke();
        }
        // a barrel beside them
        c.beginPath(); c.arc(12, 7, 4.2, 0, 6.28);
        c.fillStyle = "#4a3b26"; c.fill();
        c.strokeStyle = "#222"; c.stroke();
        break;
      }
      case "shrine": {
        // A wooden roadside cross under a small roof, common along Polish country roads.
        c.rotate(pr.rot);
        c.strokeStyle = `rgba(0,0,0,${sun.a})`;
        c.lineWidth = 3;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(sun.x * 6, sun.y * 6); c.stroke();
        rr(c, -6, -5, 12, 10, 1.5);
        c.fillStyle = "#5b3b25"; c.fill();
        c.strokeStyle = "rgba(0,0,0,0.6)"; c.lineWidth = 1; c.stroke();
        c.fillStyle = "#3a2616";
        c.fillRect(-0.9, -6.5, 1.8, 13);
        c.fillRect(-4.2, -2, 8.4, 1.8);
        for (let i = 0; i < 7; i++) {
          c.fillStyle = rng.pick(["#d23b2e", "#f2efe6", "#e8c24a", "#7a4fb0"]);
          c.beginPath(); c.arc(rng.range(-9, 9), rng.range(7, 11), 1.3, 0, 6.28); c.fill();
        }
        break;
      }
      case "cart": {
        c.rotate(pr.rot);
        c.fillStyle = `rgba(0,0,0,${sun.a})`;
        c.save(); c.translate(sun.x * 2.5, sun.y * 2.5); c.fillRect(-14, -8, 28, 16); c.restore();
        c.fillStyle = "#c9a95a";
        c.beginPath(); c.ellipse(-20, 3, 9, 6, 0.4, 0, 6.28); c.fill();
        c.fillStyle = "#1f1a12";
        c.fillRect(-9, -11, 7, 3); c.fillRect(-9, 8, 7, 3);
        rr(c, -14, -8, 28, 16, 1.5);
        c.fillStyle = "#7a5a34"; c.fill();
        c.strokeStyle = "#2a1c0e"; c.lineWidth = 1.1; c.stroke();
        c.strokeStyle = "rgba(40,26,12,0.6)";
        c.lineWidth = 0.7;
        for (let x = -12; x < 14; x += 3.5) { c.beginPath(); c.moveTo(x, -8); c.lineTo(x, 8); c.stroke(); }
        c.fillStyle = "#c9a95a";
        c.beginPath(); c.ellipse(-2, 0, 9, 5, 0, 0, 6.28); c.fill();
        c.strokeStyle = "#4e3a22";
        c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(14, -4); c.lineTo(30, -7); c.moveTo(14, 4); c.lineTo(28, 9); c.stroke();
        break;
      }
      case "tks": {
        // A TKS tankette knocked out earlier in the day, burned dark, track thrown.
        c.rotate(pr.rot);
        const g = c.createRadialGradient(0, 0, 4, 0, 0, 34);
        g.addColorStop(0, "rgba(20,16,12,0.55)");
        g.addColorStop(1, "rgba(20,16,12,0)");
        c.fillStyle = g;
        c.beginPath(); c.arc(0, 0, 34, 0, 6.28); c.fill();
        c.fillStyle = `rgba(0,0,0,${sun.a})`;
        c.fillRect(-13 + sun.x * 2, -9 + sun.y * 2, 26, 18);
        c.fillStyle = "#1c1b18";
        rr(c, -13, -9, 26, 4, 1.5); c.fill();
        rr(c, -13, 5, 26, 4, 1.5); c.fill();
        // thrown track trailing behind
        c.strokeStyle = "#1c1b18";
        c.lineWidth = 3.5;
        c.beginPath(); c.moveTo(-13, 7); c.quadraticCurveTo(-24, 14, -30, 6); c.stroke();
        BK.Art.rr(c, -11, -6, 22, 12, 2);
        const hg = c.createLinearGradient(0, -6, 0, 6);
        hg.addColorStop(0, "#3a3a2c"); hg.addColorStop(0.4, "#5c5a40"); hg.addColorStop(1, "#2a2a20");
        c.fillStyle = hg; c.fill();
        c.strokeStyle = "rgba(0,0,0,0.8)"; c.lineWidth = 1; c.stroke();
        c.fillStyle = "rgba(120,60,30,0.55)";
        c.beginPath(); c.ellipse(2, -1, 6, 4, 0, 0, 6.28); c.fill();
        c.fillStyle = "#121110";
        c.fillRect(3, -3, 6, 4);
        c.strokeStyle = "#2a2a22";
        c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(8, -1); c.lineTo(17, -3); c.stroke();
        break;
      }
    }
    c.restore();
  };


  // ------------------------------------------------------------------ village buildings
  S.drawExtra = function (c, pr, sun) {
    const rng = BK.makeRng(Math.round(pr.x * 11 + pr.y * 5));
    c.save();
    c.translate(pr.x, pr.y);
    switch (pr.kind) {
      case "church": {
        // A wooden village church: long nave, shingled roof, square bell tower at the front.
        c.rotate(pr.rot);
        softShadow(c, { x: sun.x, y: sun.y, a: sun.a * 1.2 }, () => { c.fillRect(-52, -24, 88, 48); c.fillRect(30, -15, 30, 30); }, 9, 5);
        const g = c.createLinearGradient(0, -24, 0, 24);
        g.addColorStop(0, "#5a4a3c"); g.addColorStop(0.5, "#7a6450"); g.addColorStop(0.52, "#4a3a2c"); g.addColorStop(1, "#33281e");
        c.fillStyle = g;
        c.fillRect(-52, -24, 84, 48);
        c.strokeStyle = "rgba(20,14,8,0.5)";
        c.lineWidth = 0.6;
        for (let x = -50; x < 32; x += 3) { c.beginPath(); c.moveTo(x, -24); c.lineTo(x, 24); c.stroke(); }
        c.fillStyle = "#2b2219";
        c.fillRect(-52, -1.5, 84, 3);
        c.fillStyle = "#3d3025";
        c.fillRect(30, -15, 28, 30);
        c.fillStyle = "#5c4a38";
        c.beginPath(); c.moveTo(30, -15); c.lineTo(44, 0); c.lineTo(30, 15); c.closePath(); c.fill();
        c.fillStyle = "#4a3a2c";
        c.beginPath(); c.moveTo(58, -15); c.lineTo(44, 0); c.lineTo(58, 15); c.closePath(); c.fill();
        c.fillStyle = "#c9b45a";
        c.fillRect(42.5, -6, 3, 12);
        c.fillRect(38, -1.5, 12, 3);
        c.strokeStyle = "rgba(0,0,0,0.6)";
        c.lineWidth = 1.2;
        c.strokeRect(-52, -24, 84, 48);
        c.strokeRect(30, -15, 28, 30);
        break;
      }
      case "windmill": {
        // A wooden post mill, the Polish koźlak, on its trestle. Sails turn live.
        c.rotate(pr.rot);
        softShadow(c, sun, () => c.fillRect(-14, -11, 28, 22), 12, 4);
        c.strokeStyle = "#3a2b1c";
        c.lineWidth = 3;
        c.beginPath(); c.moveTo(-18, -16); c.lineTo(18, 16); c.moveTo(18, -16); c.lineTo(-18, 16); c.stroke();
        const g = c.createLinearGradient(0, -11, 0, 11);
        g.addColorStop(0, "#5b4532"); g.addColorStop(0.5, "#86684a"); g.addColorStop(1, "#4a3828");
        c.fillStyle = g;
        c.fillRect(-14, -11, 28, 22);
        c.strokeStyle = "rgba(20,14,8,0.6)";
        c.lineWidth = 0.6;
        for (let y = -10; y < 11; y += 2.4) { c.beginPath(); c.moveTo(-14, y); c.lineTo(14, y); c.stroke(); }
        c.lineWidth = 1.2;
        c.strokeStyle = "rgba(0,0,0,0.7)";
        c.strokeRect(-14, -11, 28, 22);
        c.strokeStyle = "#4a3828";
        c.lineWidth = 2;
        c.beginPath(); c.moveTo(-14, 0); c.lineTo(-30, 0); c.stroke();
        break;
      }
      case "sweep": {
        // A well sweep, the long counterweighted pole over a village well.
        c.fillStyle = `rgba(0,0,0,${sun.a})`;
        c.beginPath(); c.arc(sun.x * 2, sun.y * 2, 8, 0, 6.28); c.fill();
        c.save(); c.rotate(pr.rot);
        c.strokeStyle = `rgba(0,0,0,${sun.a * 0.8})`;
        c.lineWidth = 2.4;
        c.beginPath(); c.moveTo(-26 + sun.x * 10, sun.y * 10); c.lineTo(30 + sun.x * 10, sun.y * 10); c.stroke();
        c.restore();
        c.beginPath(); c.arc(0, 0, 7, 0, 6.28);
        c.fillStyle = "#7b6a50"; c.fill();
        c.strokeStyle = "rgba(30,24,16,0.8)"; c.lineWidth = 1; c.stroke();
        c.beginPath(); c.arc(0, 0, 4, 0, 6.28); c.fillStyle = "#162022"; c.fill();
        c.rotate(pr.rot);
        c.strokeStyle = "#5a4328";
        c.lineWidth = 2;
        c.beginPath(); c.moveTo(-26, 0); c.lineTo(30, 0); c.stroke();
        c.fillStyle = "#6b6a63";
        c.beginPath(); c.arc(-26, 0, 3, 0, 6.28); c.fill();
        c.fillStyle = "#3a2b1c";
        c.fillRect(6, -2, 4, 4);
        break;
      }
      case "bunker": {
        // A small Polish concrete bunker from the 1939 lines, long abandoned to this road.
        c.rotate(pr.rot);
        softShadow(c, sun, () => { c.beginPath(); c.ellipse(0, 0, 22, 16, 0, 0, 6.28); c.fill(); }, 4, 4);
        const g = c.createRadialGradient(-5, -5, 2, 0, 0, 22);
        g.addColorStop(0, "#a7a49a"); g.addColorStop(1, "#5d5b55");
        c.fillStyle = g;
        c.beginPath(); c.ellipse(0, 0, 21, 15, 0, 0, 6.28); c.fill();
        c.strokeStyle = "rgba(0,0,0,0.6)"; c.lineWidth = 1.2; c.stroke();
        c.fillStyle = "#1a1a18";
        c.fillRect(14, -5, 7, 10);
        c.fillStyle = "rgba(80,100,50,0.5)";
        for (let i = 0; i < 8; i++) { c.beginPath(); c.arc(rng.range(-16, 10), rng.range(-12, 12), rng.range(2, 4), 0, 6.28); c.fill(); }
        break;
      }
    }
    c.restore();
  };

  // A ruined building: broken walls, rubble, charred beams. It gives cover to whoever is inside.
  S.drawRuin = function (c, pr, sun) {
    const rng = BK.makeRng(Math.round(pr.x * 3 + pr.y * 17));
    const w = pr.kind === "church" ? 84 : pr.kind === "shed" ? 48 : pr.kind === "windmill" ? 30 : pr.w || 70;
    const h = pr.kind === "church" ? 48 : pr.kind === "shed" ? 32 : pr.kind === "windmill" ? 24 : pr.h || 46;
    c.save();
    c.translate(pr.x, pr.y);
    c.rotate(pr.rot || 0);
    const g = c.createRadialGradient(0, 0, 4, 0, 0, Math.max(w, h) * 0.7);
    g.addColorStop(0, "rgba(22,18,14,0.8)");
    g.addColorStop(1, "rgba(22,18,14,0)");
    c.fillStyle = g;
    c.fillRect(-w, -h, w * 2, h * 2);
    c.fillStyle = "#2a241e";
    c.fillRect(-w / 2, -h / 2, w, h);
    // Rubble heaps.
    for (let i = 0; i < 26; i++) {
      c.fillStyle = rng.pick(["#6b6258", "#4c443c", "#8a7f70", "#3a332c"]);
      c.beginPath();
      c.arc(rng.range(-w / 2, w / 2), rng.range(-h / 2, h / 2), rng.range(2, 5), 0, 6.28);
      c.fill();
    }
    // Standing wall stubs with their shadows.
    c.lineCap = "square";
    const walls = [[-w / 2, -h / 2, w / 2 - rng.range(10, 30), -h / 2], [-w / 2, -h / 2, -w / 2, h / 2 - rng.range(8, 20)], [w / 2, h / 2, w / 2 - rng.range(14, 34), h / 2]];
    for (const [x1, y1, x2, y2] of walls) {
      c.strokeStyle = `rgba(0,0,0,${sun.a})`;
      c.lineWidth = 5;
      c.beginPath(); c.moveTo(x1 + sun.x * 4, y1 + sun.y * 4); c.lineTo(x2 + sun.x * 4, y2 + sun.y * 4); c.stroke();
      c.strokeStyle = pr.kind === "house" || pr.kind === "church" ? "#c8bca6" : "#7a5c3c";
      c.lineWidth = 4;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    }
    c.strokeStyle = "#140d08";
    c.lineWidth = 2.4;
    for (let i = 0; i < 4; i++) {
      const x = rng.range(-w / 3, w / 3), y = rng.range(-h / 3, h / 3), a = rng() * 3;
      c.beginPath(); c.moveTo(x - Math.cos(a) * 14, y - Math.sin(a) * 14); c.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); c.stroke();
    }
    c.restore();
  };

  // Sprites per prop and state, so destructible scenery costs one image draw a frame.
  const SPR = new Map();
  S.sprite = function (pr, sun, images) {
    const key = pr.kind + "|" + pr.state + "|" + Math.round(pr.x) + "|" + Math.round(pr.y);
    let sp = SPR.get(key);
    if (sp) return sp;
    const size = Math.ceil((pr.kind === "church" ? 90 : (pr.r || 20) + 40) * 2);
    const cv = document.createElement("canvas");
    cv.width = cv.height = size * 2;
    const c = cv.getContext("2d");
    c.scale(2, 2);
    c.translate(size / 2 - pr.x, size / 2 - pr.y);
    const st = pr.state;
    if (pr.kind === "tree" || pr.kind === "pine" || pr.kind === "hay") {
      const im = images && images["prop-" + pr.kind];
      const s = 80 * (pr.s || 1);
      if (st === "felled") {
        // The trunk lies where the blast threw it, crown scorched.
        c.save();
        c.translate(pr.x, pr.y);
        c.rotate(pr.fallAng || 0);
        c.fillStyle = "rgba(0,0,0,0.3)";
        c.fillRect(2, -1, 36, 9);
        c.fillStyle = "#4a3624";
        c.fillRect(0, -4, 34, 8);
        if (im) { c.globalAlpha = 0.85; c.filter = "brightness(0.55) saturate(0.6)"; c.drawImage(im, 18, -s * 0.3, s * 0.6, s * 0.6); }
        c.restore();
        c.fillStyle = "#2a1e14";
        c.beginPath(); c.arc(pr.x, pr.y, 5, 0, 6.28); c.fill();
      } else if (st === "burnt") {
        c.fillStyle = "rgba(20,16,12,0.7)";
        c.beginPath(); c.arc(pr.x, pr.y, pr.r, 0, 6.28); c.fill();
        c.fillStyle = "rgba(90,80,70,0.5)";
        c.beginPath(); c.arc(pr.x + 3, pr.y - 2, pr.r * 0.5, 0, 6.28); c.fill();
      } else if (im) {
        c.save();
        c.translate(pr.x, pr.y);
        c.rotate(pr.rot || 0);
        if (st === "damaged") c.filter = "brightness(0.75) saturate(0.7)";
        c.drawImage(im, -s / 2, -s / 2, s, s);
        c.restore();
      }
    } else if (st === "ruin") {
      S.drawRuin(c, pr, sun);
    } else if (pr.kind === "church" || pr.kind === "windmill") {
      S.drawExtra(c, pr, sun);
    } else if (pr.kind === "cart" || pr.kind === "crates") {
      if (st === "burnt") { c.fillStyle = "rgba(20,16,12,0.75)"; c.beginPath(); c.arc(pr.x, pr.y, pr.r, 0, 6.28); c.fill(); }
      else S.draw(c, pr, sun);
    } else {
      S.draw(c, pr, sun);
      if (st === "damaged") {
        // Shell holes in the roof.
        const rng = BK.makeRng(Math.round(pr.x + pr.y));
        for (let i = 0; i < 3; i++) {
          const x = pr.x + rng.range(-pr.r * 0.6, pr.r * 0.6), y = pr.y + rng.range(-pr.r * 0.4, pr.r * 0.4);
          const g = c.createRadialGradient(x, y, 1, x, y, 10);
          g.addColorStop(0, "rgba(10,8,6,0.95)"); g.addColorStop(0.6, "rgba(30,22,14,0.7)"); g.addColorStop(1, "rgba(30,22,14,0)");
          c.fillStyle = g;
          c.beginPath(); c.arc(x, y, 10, 0, 6.28); c.fill();
        }
      }
    }
    sp = { cv, size, x: pr.x - size / 2, y: pr.y - size / 2 };
    SPR.set(key, sp);
    return sp;
  };
  S.LIVE = { house: 1, barn: 1, shed: 1, church: 1, windmill: 1, tree: 1, pine: 1, hay: 1, cart: 1, crates: 1 };

  // Windmill sails, drawn every frame.
  S.drawSails = function (c, pr, t) {
    if (pr.state === "ruin") return;
    c.save();
    c.translate(pr.x + Math.cos(pr.rot) * -30, pr.y + Math.sin(pr.rot) * -30);
    c.rotate(pr.rot + Math.PI / 2);
    c.scale(1, 0.35);
    c.rotate(t * (pr.spin || 0.5) * (pr.state === "damaged" ? 0.2 : 1));
    for (let i = 0; i < 4; i++) {
      c.rotate(Math.PI / 2);
      c.fillStyle = "rgba(0,0,0,0.25)";
      c.fillRect(4, -5 + 6, 38, 10);
      c.fillStyle = "#d6cdb6";
      c.fillRect(4, -5, 38, 10);
      c.strokeStyle = "#4a3828";
      c.lineWidth = 1.5;
      c.strokeRect(4, -5, 38, 10);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(44, 0); c.stroke();
    }
    c.restore();
  };

  // Where smoke should pour from: the burning farmhouse.
  S.fires = function (props) {
    const out = [];
    for (const p of props) {
      if (p.kind === "house" && p.burning) {
        out.push({ prop: p, x: p.x + Math.cos(p.rot) * -p.w * 0.18 - Math.sin(p.rot) * 2, y: p.y + Math.sin(p.rot) * -p.w * 0.18 + Math.cos(p.rot) * 2 });
      }
    }
    return out;
  };
})(typeof window !== "undefined" ? window : globalThis);
