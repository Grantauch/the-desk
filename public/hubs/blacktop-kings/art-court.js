/* Blacktop Kings — courts, scenery, the hoop, and the crowd.
   The world is in feet. x runs from half court (0) to the baseline (47); the basket sits at x 41.75.
   y runs across the court, -25 far sideline to +25 near sideline; z is height. A fixed broadcast-style
   camera on the near sideline projects it all. The static scene is painted once per game. */
(function (BK) {
  'use strict';
  const A = BK.art = BK.art || {};
  const TAU = Math.PI * 2;
  const shade = (h, a) => A.shade(h, a);

  A.COURT = { len: 47, half: 25, rimX: 41.75, rimY: 0, rimZ: 10, rimR: 0.78, boardX: 43, arcR: 22, cornerY: 21, keyHalf: 8, ftX: 28 };
  const C = A.COURT;
  C.cornerX = C.rimX - Math.sqrt(C.arcR * C.arcR - C.cornerY * C.cornerY);
  // Is the point outside the two-point line?
  C.isDeep = (x, y) => (x >= C.cornerX ? Math.abs(y) > C.cornerY : Math.hypot(x - C.rimX, y - C.rimY) > C.arcR);

  // ---------- camera ----------
  A.makeCamera = function (o) {
    const W = o.W, H = o.H;
    const cam = { W, H, pos: o.pos.slice(), yaw: o.yaw, pitch: o.pitch, fov: o.fov, cx: W / 2, cy: H / 2 + (o.shiftY || 0) };
    cam.update = function () {
      const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      cam.f = [sy * cp, -cy * cp, -sp];
      cam.r = [cy, sy, 0];
      cam.u = [sp * sy, -sp * cy, cp];
      cam.F = (H / 2) / Math.tan(cam.fov / 2);
      cam.horizon = cam.cy - cam.F * Math.tan(cam.pitch);
    };
    cam.project = function (x, y, z) {
      const rx = x - cam.pos[0], ry = y - cam.pos[1], rz = (z || 0) - cam.pos[2];
      let d = rx * cam.f[0] + ry * cam.f[1] + rz * cam.f[2];
      if (d < 0.5) d = 0.5;
      const k = cam.F / d;
      return { x: cam.cx + (rx * cam.r[0] + ry * cam.r[1]) * k, y: cam.cy - (rx * cam.u[0] + ry * cam.u[1] + rz * cam.u[2]) * k, s: k, d };
    };
    // Screen-space stick direction -> world ground direction.
    cam.stickToWorld = function (sx, sy) {
      const fx = Math.sin(cam.yaw), fy = -Math.cos(cam.yaw);
      return [sx * cam.r[0] - sy * fx, sx * cam.r[1] - sy * fy];
    };
    // World ground direction -> screen direction sign (for facing).
    cam.screenDX = (dx, dy) => dx * cam.r[0] + dy * cam.r[1];
    cam.update();
    return cam;
  };
  A.defaultCamera = (W, H) => A.makeCamera({ W, H, pos: [24, 80, 28], yaw: 0, pitch: 0.245, fov: 0.56, shiftY: 44 * H / 720 });

  // ---------- small helpers ----------
  function path3(ctx, cam, pts) {
    ctx.beginPath();
    pts.forEach((p, i) => { const q = cam.project(p[0], p[1], p[2] || 0); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
    ctx.closePath();
  }
  function fill3(ctx, cam, pts, color) { path3(ctx, cam, pts); ctx.fillStyle = color; ctx.fill(); }
  function stripe(ctx, cam, pts, w, color, z) {
    // a painted line on the ground with real width in feet
    ctx.fillStyle = color;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1]; const m = Math.hypot(dx, dy) || 1;
      const nx = -dy / m * w / 2, ny = dx / m * w / 2;
      const ex = dx / m * w * 0.3, ey = dy / m * w * 0.3;
      path3(ctx, cam, [[a[0] + nx - ex, a[1] + ny - ey, z], [b[0] + nx + ex, b[1] + ny + ey, z], [b[0] - nx + ex, b[1] - ny + ey, z], [a[0] - nx - ex, a[1] - ny - ey, z]]);
      ctx.fill();
    }
  }
  function arcPts(cx, cy, r, a0, a1, n) {
    const out = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return out;
  }
  function box3(ctx, cam, x0, x1, y0, y1, z0, z1, col, opts) {
    opts = opts || {};
    const top = opts.top || shade(col, 0.12), side = opts.side || shade(col, -0.22);
    // side faces
    if (cam.pos[0] < x0) fill3(ctx, cam, [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], side);
    if (cam.pos[0] > x1) fill3(ctx, cam, [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], side);
    if (cam.pos[2] > z1) fill3(ctx, cam, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], top);
    fill3(ctx, cam, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], col);
  }
  A.box3 = box3; A.fill3 = fill3; A.path3 = path3;

  function windows(ctx, cam, x0, x1, y, z0, z1, lit, rnd, color, cols, rows) {
    const w = (x1 - x0) / cols, h = (z1 - z0) / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const on = rnd() < lit;
      const col = on ? color : 'rgba(0,0,0,0.28)';
      fill3(ctx, cam, [[x0 + i * w + w * 0.2, y, z0 + j * h + h * 0.25], [x0 + i * w + w * 0.8, y, z0 + j * h + h * 0.25], [x0 + i * w + w * 0.8, y, z0 + j * h + h * 0.8], [x0 + i * w + w * 0.2, y, z0 + j * h + h * 0.8]], col);
    }
  }

  // ---------- the static scene ----------
  A.paintScene = function (ctx, cam, court) {
    const W = cam.W, H = cam.H; const rnd = BK.data.rng('scene-' + court.id);
    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, Math.max(40, cam.horizon + 40));
    sky.addColorStop(0, court.sky[0]); sky.addColorStop(0.55, court.sky[1]); sky.addColorStop(1, court.sky[2]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // celestial
    if (court.time === 'night' || court.id === 'crown') {
      for (let i = 0; i < 120; i++) { ctx.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.7})`; const s = rnd() < 0.1 ? 2 : 1; ctx.fillRect(rnd() * W, rnd() * cam.horizon * 0.95, s, s); }
      ctx.fillStyle = '#f4f1e1'; ctx.beginPath(); ctx.arc(W * 0.82, cam.horizon * 0.25, 22, 0, TAU); ctx.fill();
      ctx.fillStyle = court.sky[0]; ctx.beginPath(); ctx.arc(W * 0.82 + 9, cam.horizon * 0.25 - 6, 19, 0, TAU); ctx.fill();
    } else if (court.time === 'sunset' || court.time === 'dusk') {
      const sx = court.time === 'sunset' ? W * 0.68 : W * 0.25, sy = cam.horizon - 18;
      const g = ctx.createRadialGradient(sx, sy, 10, sx, sy, 260); g.addColorStop(0, 'rgba(255,240,180,0.95)'); g.addColorStop(0.15, 'rgba(255,200,120,0.6)'); g.addColorStop(1, 'rgba(255,120,80,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, cam.horizon + 40);
      ctx.fillStyle = '#fff2c6'; ctx.beginPath(); ctx.arc(sx, sy, 46, 0, TAU); ctx.fill();
    } else if (court.time === 'day') {
      const g = ctx.createRadialGradient(W * 0.15, 30, 10, W * 0.15, 30, 200); g.addColorStop(0, 'rgba(255,255,230,0.9)'); g.addColorStop(1, 'rgba(255,255,230,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, cam.horizon);
    }
    if (court.time === 'day' || court.time === 'overcast' || court.time === 'sunset') {
      for (let i = 0; i < 7; i++) {
        const cx = rnd() * W, cy = 20 + rnd() * cam.horizon * 0.6, s = 30 + rnd() * 50;
        ctx.fillStyle = court.time === 'sunset' ? 'rgba(255,170,150,0.35)' : court.time === 'overcast' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.75)';
        for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(cx + (k - 2) * s * 0.45, cy + Math.sin(k * 2.1) * s * 0.12, s * 0.5, s * 0.28, 0, 0, TAU); ctx.fill(); }
      }
    }
    const scene = SCENES[court.scene] || SCENES.lot;
    scene.back(ctx, cam, court, rnd);
    // ground
    const gy = Math.max(0, cam.horizon);
    if (scene.ground) scene.ground(ctx, cam, court, rnd);
    else { ctx.fillStyle = court.ground; ctx.fillRect(0, gy, W, H - gy); }
    scene.mid(ctx, cam, court, rnd);
    paintCourt(ctx, cam, court, rnd);
    if (scene.front) scene.front(ctx, cam, court, rnd);
  };

  function paintCourt(ctx, cam, court, rnd) {
    const L = C.len, Hf = C.half;
    const surf = court.scene;
    // apron
    fill3(ctx, cam, [[-L - 4, -Hf - 4], [L + 6, -Hf - 4], [L + 6, Hf + 4], [-L - 4, Hf + 4]], shade(court.court, -0.18));
    // court
    fill3(ctx, cam, [[-L, -Hf], [L, -Hf], [L, Hf], [-L, Hf]], court.court);
    if (surf === 'gym') {
      for (let y = -Hf; y < Hf; y += 1.2) {
        const c = shade(court.court, (rnd() - 0.5) * 0.12);
        fill3(ctx, cam, [[-L, y], [L, y], [L, y + 1.2], [-L, y + 1.2]], c);
      }
      ctx.save(); ctx.globalAlpha = 0.25;
      for (let i = 0; i < 400; i++) { const x = -L + rnd() * L * 2, y = -Hf + Math.floor(rnd() * 42) * 1.2; stripe(ctx, cam, [[x, y], [x, y + 1.2]], 0.06, shade(court.court, -0.3)); }
      ctx.restore();
    }
    if (surf === 'lot' || surf === 'cage' || surf === 'underpass') {
      // asphalt grit and cracks
      for (let i = 0; i < 2600; i++) {
        const x = -L + rnd() * (L * 2 + 6), y = -Hf - 4 + rnd() * (Hf * 2 + 8); const p = cam.project(x, y, 0);
        ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.16)';
        const s = Math.max(1, p.s * 0.12); ctx.fillRect(p.x, p.y, s, s * 0.6);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 9; i++) {
        let x = rnd() * L, y = -Hf + rnd() * Hf * 2; ctx.beginPath(); let p = cam.project(x, y, 0); ctx.moveTo(p.x, p.y);
        for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 6; y += (rnd() - 0.5) * 6; p = cam.project(x, y, 0); ctx.lineTo(p.x, p.y); }
        ctx.stroke();
      }
    }
    // two-point area tint
    const arc = arcPts(C.rimX, 0, C.arcR, Math.PI - Math.asin(C.cornerY / C.arcR), Math.PI + Math.asin(C.cornerY / C.arcR), 40);
    const inside = [[L, -C.cornerY], [C.cornerX, -C.cornerY]].concat(arc.slice().reverse().map(([x, y]) => [x, y])).concat([[C.cornerX, C.cornerY], [L, C.cornerY]]);
    const tint = surf === 'gym' ? 'rgba(255,255,255,0.05)' : surf === 'crown' ? 'rgba(255,210,63,0.07)' : 'rgba(255,255,255,0.06)';
    fill3(ctx, cam, inside, tint);
    // key
    fill3(ctx, cam, [[L, -C.keyHalf], [C.ftX, -C.keyHalf], [C.ftX, C.keyHalf], [L, C.keyHalf]], court.key);
    fill3(ctx, cam, [[-L, -C.keyHalf], [-C.ftX, -C.keyHalf], [-C.ftX, C.keyHalf], [-L, C.keyHalf]], court.key);
    // center circle
    const cc = arcPts(0, 0, 6, 0, TAU, 48);
    fill3(ctx, cam, cc, shade(court.key, 0.05));
    const lc = court.line; const lw = 0.2;
    // boundary
    stripe(ctx, cam, [[-L, -Hf], [L, -Hf], [L, Hf], [-L, Hf], [-L, -Hf]], lw * 1.2, lc);
    stripe(ctx, cam, [[0, -Hf], [0, Hf]], lw, lc);
    stripe(ctx, cam, cc, lw, lc);
    stripe(ctx, cam, arcPts(0, 0, 2, 0, TAU, 24), lw, lc);
    // key lines + free throw circle
    [1, -1].forEach((side) => {
      const bx = side * L, fx = side * C.ftX;
      stripe(ctx, cam, [[bx, -C.keyHalf], [fx, -C.keyHalf], [fx, C.keyHalf], [bx, C.keyHalf]], lw, lc);
      stripe(ctx, cam, arcPts(fx, 0, 6, side > 0 ? Math.PI / 2 : -Math.PI / 2, side > 0 ? Math.PI * 1.5 : Math.PI / 2, 24), lw, lc);
      const rx = side * C.rimX;
      const a0 = Math.asin(C.cornerY / C.arcR);
      const pts = side > 0 ? arcPts(rx, 0, C.arcR, Math.PI - a0, Math.PI + a0, 50) : arcPts(rx, 0, C.arcR, -a0, a0, 50);
      stripe(ctx, cam, [[bx, -C.cornerY], pts[0]], lw, lc);
      stripe(ctx, cam, pts, lw, lc);
      stripe(ctx, cam, [pts[pts.length - 1], [bx, C.cornerY]], lw, lc);
      // block marks
      [-1, 1].forEach((s2) => stripe(ctx, cam, [[side * (L - 7), s2 * C.keyHalf], [side * (L - 7), s2 * (C.keyHalf + 0.8)]], 0.5, lc));
    });
    // center emblem: a crown painted at half court
    drawGroundCrown(ctx, cam, 0, 0, 3.0, court.accent);
    if (surf === 'crown') {
      // gold sheen
      const p0 = cam.project(C.rimX - 10, 0, 0);
      const g = ctx.createRadialGradient(p0.x, p0.y, 10, p0.x, p0.y, 600); g.addColorStop(0, 'rgba(255,210,63,0.12)'); g.addColorStop(1, 'rgba(255,210,63,0)');
      ctx.fillStyle = g; path3(ctx, cam, [[-L, -Hf], [L, -Hf], [L, Hf], [-L, Hf]]); ctx.fill();
    }
    // lighting: day courts get a soft vignette, night courts get light pools
    if (court.time === 'night' || court.time === 'indoor' || court.time === 'dusk') {
      ctx.save(); path3(ctx, cam, [[-L - 4, -Hf - 4], [L + 6, -Hf - 4], [L + 6, Hf + 4], [-L - 4, Hf + 4]]); ctx.clip();
      const p = cam.project(28, 0, 0);
      const g = ctx.createRadialGradient(p.x, p.y, 40, p.x, p.y, cam.W * 0.75);
      g.addColorStop(0, 'rgba(255,240,200,0.10)'); g.addColorStop(0.6, 'rgba(0,0,0,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cam.W, cam.H); ctx.restore();
    }
  }
  function drawGroundCrown(ctx, cam, cx, cy, s, color) {
    // u runs along the court (x), v points away from the camera (-y)
    const P = (u, v) => [cx + u * s, cy - v * s];
    ctx.save(); ctx.globalAlpha = 0.85;
    fill3(ctx, cam, [P(-1.1, -0.35), P(-1.25, 0.75), P(-0.55, 0.2), P(0, 0.95), P(0.55, 0.2), P(1.25, 0.75), P(1.1, -0.35)], color);
    fill3(ctx, cam, [P(-1.1, -0.5), P(1.1, -0.5), P(1.1, -0.8), P(-1.1, -0.8)], color);
    ctx.restore();
  }

  // ---------- scenes ----------
  function skyline(ctx, cam, rnd, opts) {
    // flat silhouettes on the horizon (too far for perspective to matter)
    const hz = cam.horizon; const W = cam.W;
    let x = -20;
    while (x < W + 20) {
      const w = 30 + rnd() * 70, h = opts.min + rnd() * (opts.max - opts.min);
      ctx.fillStyle = opts.color; ctx.fillRect(x, hz - h, w, h + 4);
      if (rnd() < 0.25) { ctx.fillRect(x + w * 0.4, hz - h - 18, 3, 18); }
      if (opts.lit) {
        for (let wy = hz - h + 6; wy < hz - 4; wy += 7) for (let wx = x + 4; wx < x + w - 4; wx += 6) {
          if (rnd() < opts.lit) { ctx.fillStyle = opts.litColor; ctx.fillRect(wx, wy, 3, 3); }
        }
      }
      x += w + rnd() * 6;
    }
  }
  function chainFence(ctx, cam, x0, x1, y, h, color, post) {
    const top = []; const steps = Math.ceil((x1 - x0) / 0.8);
    ctx.save();
    path3(ctx, cam, [[x0, y, 0], [x1, y, 0], [x1, y, h], [x0, y, h]]); ctx.clip();
    ctx.strokeStyle = color; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.55;
    for (let i = -Math.ceil(h / 0.8); i < steps; i++) {
      const a = cam.project(x0 + i * 0.8, y, 0), b = cam.project(x0 + i * 0.8 + h, y, h);
      const c2 = cam.project(x0 + i * 0.8 + h, y, 0), d = cam.project(x0 + i * 0.8, y, h);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.moveTo(c2.x, c2.y); ctx.lineTo(d.x, d.y); ctx.stroke();
    }
    ctx.restore();
    void top;
    for (let x = x0; x <= x1 + 0.01; x += 10) { const a = cam.project(x, y, 0), b = cam.project(x, y, h); ctx.strokeStyle = post; ctx.lineWidth = Math.max(2, a.s * 0.3); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    const a = cam.project(x0, y, h), b = cam.project(x1, y, h); ctx.strokeStyle = post; ctx.lineWidth = Math.max(2, a.s * 0.22); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  function tree(ctx, cam, x, y, h, col) {
    const base = cam.project(x, y, 0), top = cam.project(x, y, h);
    ctx.strokeStyle = '#4a3322'; ctx.lineWidth = Math.max(2, base.s * 0.8); ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y + (base.y - top.y) * 0.3); ctx.stroke();
    const r = h * 0.3 * top.s;
    [[0, 0, 1], [-0.6, 0.25, 0.75], [0.6, 0.2, 0.8], [0, -0.45, 0.7]].forEach(([dx, dy, k], i) => {
      ctx.fillStyle = shade(col, -0.1 + i * 0.06); ctx.beginPath(); ctx.arc(top.x + dx * r, top.y + dy * r + r * 0.3, r * k, 0, TAU); ctx.fill();
    });
  }
  function palm(ctx, cam, x, y, h, col) {
    const base = cam.project(x, y, 0), top = cam.project(x + 2, y, h);
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, base.s * 0.9); ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.quadraticCurveTo(base.x, (base.y + top.y) / 2, top.x, top.y); ctx.stroke();
    const r = h * 0.35 * top.s; ctx.fillStyle = col;
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI + i * Math.PI / 6;
      ctx.beginPath(); ctx.moveTo(top.x, top.y);
      ctx.quadraticCurveTo(top.x + Math.cos(a) * r * 0.6, top.y + Math.sin(a) * r * 0.6 - r * 0.3, top.x + Math.cos(a) * r, top.y + Math.sin(a) * r * 0.5 + r * 0.35);
      ctx.quadraticCurveTo(top.x + Math.cos(a) * r * 0.5, top.y + Math.sin(a) * r * 0.4, top.x, top.y + 2); ctx.fill();
    }
  }
  function lightPole(ctx, cam, x, y, h) {
    const a = cam.project(x, y, 0), b = cam.project(x, y, h);
    ctx.strokeStyle = '#2b2e33'; ctx.lineWidth = Math.max(2, a.s * 0.45); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.fillStyle = '#3a3e45'; ctx.fillRect(b.x - a.s * 1.6, b.y - a.s * 0.4, a.s * 3.2, a.s * 0.9);
    ctx.fillStyle = '#fff6d0'; ctx.fillRect(b.x - a.s * 1.4, b.y + a.s * 0.3, a.s * 2.8, a.s * 0.25);
  }
  A.lightPoleTop = (cam, x, y, h) => cam.project(x, y, h);

  function mural(ctx, cam, x0, x1, y, z0, z1, rnd, palette) {
    fill3(ctx, cam, [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], palette[0]);
    for (let i = 0; i < 9; i++) {
      const cx = x0 + rnd() * (x1 - x0), cz = z0 + rnd() * (z1 - z0), r = 1.5 + rnd() * 4;
      const pts = []; const n = 5 + Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) { const a = k / n * TAU; const rr = r * (0.6 + rnd() * 0.6); pts.push([Math.min(x1, Math.max(x0, cx + Math.cos(a) * rr)), y, Math.min(z1, Math.max(z0, cz + Math.sin(a) * rr))]); }
      fill3(ctx, cam, pts, palette[1 + (i % (palette.length - 1))]);
    }
    // a bold zig-zag stripe across
    ctx.save(); ctx.globalAlpha = 0.9;
    const zz = []; for (let x = x0; x <= x1; x += 3) zz.push([x, y, z0 + (z1 - z0) * (0.45 + ((x - x0) / 3 % 2 ? 0.15 : -0.1))]);
    for (let i = 0; i < zz.length - 1; i++) fill3(ctx, cam, [zz[i], zz[i + 1], [zz[i + 1][0], y, zz[i + 1][2] + 0.8], [zz[i][0], y, zz[i][2] + 0.8]], palette[palette.length - 1]);
    ctx.restore();
  }

  const SCENES = {
    lot: {
      back(ctx, cam, court, rnd) { skyline(ctx, cam, rnd, { min: 20, max: 70, color: '#9fb3c8' }); },
      mid(ctx, cam, court, rnd) {
        // row houses across the street
        for (let x = -70; x < 120; x += 22 + rnd() * 6) {
          const w = 18 + rnd() * 4, h = 16 + rnd() * 9, col = ['#b85c4a', '#d9c9a3', '#7f9fb5', '#c98d5a', '#8a9a6a'][Math.floor(rnd() * 5)];
          box3(ctx, cam, x, x + w, -100, -84, 0, h, col);
          fill3(ctx, cam, [[x - 1, -84, h], [x + w + 1, -84, h], [x + w / 2, -92, h + 7]], '#4a3a35');
          windows(ctx, cam, x + 2, x + w - 2, -83.9, 3, h - 2, 0.15, rnd, '#ffe9a8', 3, 2);
        }
        for (let i = 0; i < 8; i++) tree(ctx, cam, -40 + i * 20 + rnd() * 6, -66 - rnd() * 6, 17 + rnd() * 6, '#3f8a3a');
        mural(ctx, cam, 4, 40, -36, 0, 9, rnd, ['#e9e2d3', '#e8352b', '#1f6feb', '#ffb300', '#14b8a6', '#111111']);
        chainFence(ctx, cam, -50, 70, -31, 10, '#9aa1a8', '#6c737a');
        // telephone wire
        const a = cam.project(-30, -55, 26), b = cam.project(90, -55, 26);
        ctx.strokeStyle = 'rgba(30,30,30,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, a.y + 18, b.x, b.y); ctx.stroke();
        [-30, 30, 90].forEach((x) => { const p = cam.project(x, -55, 0), q = cam.project(x, -55, 28); ctx.strokeStyle = '#5a4532'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); });
      },
    },
    beach: {
      back(ctx, cam, court, rnd) {
        // ocean band
        const hz = cam.horizon;
        const g = ctx.createLinearGradient(0, hz, 0, hz + 90); g.addColorStop(0, '#5a4f9a'); g.addColorStop(1, '#2f6fa8');
        ctx.fillStyle = g; ctx.fillRect(0, hz, cam.W, 110);
        ctx.fillStyle = 'rgba(255,220,160,0.6)'; for (let i = 0; i < 50; i++) ctx.fillRect(cam.W * 0.5 + rnd() * cam.W * 0.3, hz + 3 + rnd() * 70, 10 + rnd() * 30, 2);
        // ferris wheel
        const fx = cam.W * 0.12, fy = hz - 70, fr = 62; ctx.strokeStyle = '#2b1d4a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(fx, fy, fr, 0, TAU); ctx.stroke();
        for (let i = 0; i < 12; i++) { const a = i * TAU / 12; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + Math.cos(a) * fr, fy + Math.sin(a) * fr); ctx.stroke(); ctx.fillStyle = '#2b1d4a'; ctx.fillRect(fx + Math.cos(a) * fr - 4, fy + Math.sin(a) * fr, 8, 8); }
        ctx.beginPath(); ctx.moveTo(fx - 30, hz + 4); ctx.lineTo(fx, fy); ctx.lineTo(fx + 30, hz + 4); ctx.stroke();
      },
      ground(ctx, cam) {
        const top = cam.horizon + 92;
        const g = ctx.createLinearGradient(0, top, 0, cam.H); g.addColorStop(0, '#d9b77a'); g.addColorStop(1, '#f0d59c');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, top);
        for (let x = 0; x <= cam.W; x += 40) ctx.lineTo(x, top + Math.sin(x * 0.03) * 4);
        ctx.lineTo(cam.W, cam.H); ctx.lineTo(0, cam.H); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3; ctx.beginPath();
        for (let x = 0; x <= cam.W; x += 40) { const y = top - 2 + Math.sin(x * 0.03) * 4; if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.stroke();
      },
      mid(ctx, cam, court, rnd) {
        // boardwalk planks
        fill3(ctx, cam, [[-80, -44, 0], [120, -44, 0], [120, -36, 0], [-80, -36, 0]], '#8a5a3a');
        for (let x = -80; x < 120; x += 2) { const a = cam.project(x, -44, 0), b = cam.project(x, -36, 0); ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        box3(ctx, cam, 60, 72, -72, -64, 0, 9, '#e8352b'); fill3(ctx, cam, [[59, -64, 9], [73, -64, 9], [66, -68, 13]], '#ffffff');
        for (let i = 0; i < 6; i++) palm(ctx, cam, -40 + i * 26 + rnd() * 8, -62 - rnd() * 8, 22 + rnd() * 8, '#2a1d3a');
        // rope fence
        for (let x = -50; x <= 70; x += 8) { const p = cam.project(x, -31, 0), q = cam.project(x, -31, 3.5); ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = Math.max(2, p.s * 0.35); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
        const a = cam.project(-50, -31, 3.2), b = cam.project(70, -31, 3.2); ctx.strokeStyle = '#e8d6b0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        // lifeguard tower
        box3(ctx, cam, 70, 76, -40, -34, 6, 11, '#f2f2f2'); fill3(ctx, cam, [[69, -34, 11], [77, -34, 11], [73, -37, 14]], '#e8352b');
        [70.5, 75.5].forEach((x) => { const p = cam.project(x, -34, 0), q = cam.project(x, -34, 6); ctx.strokeStyle = '#ddd'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); });
      },
    },
    cage: {
      back(ctx, cam, court, rnd) { skyline(ctx, cam, rnd, { min: 60, max: 150, color: '#7d8a99' }); },
      mid(ctx, cam, court, rnd) {
        for (let x = -80; x < 130; x += 26) {
          const w = 24, h = 30 + rnd() * 22; const col = ['#8b3a2b', '#a14b33', '#6e2f25', '#7d4630'][Math.floor(rnd() * 4)];
          box3(ctx, cam, x, x + w, -110, -90, 0, h, col);
          windows(ctx, cam, x + 2, x + w - 2, -89.9, 4, h - 3, 0.1, rnd, '#ffe9a8', 4, Math.floor(h / 9));
          // fire escape
          for (let z = 10; z < h - 4; z += 9) { fill3(ctx, cam, [[x + 6, -89.8, z], [x + 16, -89.8, z], [x + 16, -89.8, z + 0.6], [x + 6, -89.8, z + 0.6]], '#1f1f22'); }
          if (rnd() < 0.5) { box3(ctx, cam, x + 8, x + 14, -102, -96, h, h + 8, '#5a3b26'); fill3(ctx, cam, [[x + 7.5, -96, h + 8], [x + 14.5, -96, h + 8], [x + 11, -99, h + 11]], '#3a2618'); }
        }
        // the street and a parked car or two
        fill3(ctx, cam, [[-90, -86, 0.01], [140, -86, 0.01], [140, -62, 0.01], [-90, -62, 0.01]], '#3a3836');
        for (let x = -80; x < 130; x += 12) stripe(ctx, cam, [[x, -74], [x + 6, -74]], 0.5, '#e8d36a', 0.02);
        [[-20, '#1f6feb'], [55, '#e8352b'], [95, '#f2f2f2']].forEach(([x, c]) => { box3(ctx, cam, x, x + 14, -70, -64, 0.8, 4, c); box3(ctx, cam, x + 3, x + 11, -69.5, -64.5, 4, 6.2, A.shade(c, -0.1)); });
        chainFence(ctx, cam, -50, 72, -30, 16, '#c3c9cf', '#5d646b');
      },
      front(ctx, cam) { chainFence(ctx, cam, 52, 52.01, -30, 16, '#c3c9cf', '#5d646b'); void cam; },
    },
    rooftop: {
      back(ctx, cam, court, rnd) {
        const hz = cam.horizon;
        const glow = ctx.createLinearGradient(0, hz - 140, 0, hz + 10); glow.addColorStop(0, 'rgba(255,62,165,0)'); glow.addColorStop(1, 'rgba(255,62,165,0.35)');
        ctx.fillStyle = glow; ctx.fillRect(0, hz - 140, cam.W, 150);
        skyline(ctx, cam, rnd, { min: 30, max: 120, color: '#1a1638', lit: 0.25, litColor: '#ffd98a' });
        skyline(ctx, cam, rnd, { min: 60, max: 210, color: '#0d0b20', lit: 0.18, litColor: '#9fe8ff' });
      },
      mid(ctx, cam, court, rnd) {
        box3(ctx, cam, -70, 120, -36, -33, 0, 3.5, '#3b3a46');
        // neon signs
        // roof clutter: vents, AC units, a stair house, string lights
        [[-30, -52], [-8, -60], [12, -48], [44, -56], [84, -50], [100, -62]].forEach(([x, y], i) => {
          box3(ctx, cam, x, x + 7, y - 5, y, 0, 4 + (i % 3), '#5b5d6b');
          const a = cam.project(x + 3.5, y, 2.2); ctx.fillStyle = '#2a2b33'; ctx.beginPath(); ctx.arc(a.x, a.y, a.s * 1.6, 0, Math.PI * 2); ctx.fill();
        });
        box3(ctx, cam, -62, -46, -78, -64, 0, 12, '#4a4757'); fill3(ctx, cam, [[-60, -63.9, 0], [-54, -63.9, 0], [-54, -63.9, 8], [-60, -63.9, 8]], '#ffcf7a');
        for (let i = 0; i < 26; i++) { const x = -50 + i * 5; const p = cam.project(x, -34, 9 + Math.sin(i * 0.9) * 0.8); ctx.fillStyle = ['#ffe14d', '#ff3ea5', '#2ec5ff', '#3fd13f'][i % 4]; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.5, p.s * 0.25), 0, Math.PI * 2); ctx.fill(); }
        [['#ff3ea5', -20, -95, 'OPEN'], ['#14b8a6', 30, -105, 'HOOPS'], ['#ffe14d', 80, -92, 'LATE']].forEach(([c, x, y, word]) => {
          ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = 18; ctx.strokeStyle = c; ctx.lineWidth = 3;
          path3(ctx, cam, [[x, y, 26], [x + 16, y, 26], [x + 16, y, 33], [x, y, 33]]); ctx.stroke();
          const p = cam.project(x + 8, y, 29.5); ctx.fillStyle = c; ctx.font = `700 ${Math.round(p.s * 4)}px Anton, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(word, p.x, p.y); ctx.restore();
        });
        // water tower
        box3(ctx, cam, 62, 70, -52, -44, 14, 24, '#4a3326'); fill3(ctx, cam, [[61.5, -44, 24], [70.5, -44, 24], [66, -48, 28]], '#2c1d14');
        [63, 69].forEach((x) => { const p = cam.project(x, -44, 0), q = cam.project(x, -44, 14); ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); });
        // antenna
        const a = cam.project(-20, -48, 0), b = cam.project(-20, -48, 40); ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        // railing
        chainFence(ctx, cam, -50, 72, -30, 5, '#8a8fa8', '#555a70');
      },
    },
    underpass: {
      back(ctx, cam, court, rnd) {
        skyline(ctx, cam, rnd, { min: 30, max: 110, color: '#1c2333', lit: 0.2, litColor: '#ffcf7a' });
      },
      mid(ctx, cam, court, rnd) {
        // pillars with murals
        [-30, 0, 30, 60, 90].forEach((x, i) => {
          box3(ctx, cam, x - 3, x + 3, -42, -36, 0, 34, '#6a6c70');
          mural(ctx, cam, x - 3, x + 3, -35.95, 2, 18, BK.data.rng('pillar' + i), ['#55585e', '#ff6a13', '#2ec5ff', '#ffe14d', '#ff3ea5', '#111111']);
        });
        chainFence(ctx, cam, -50, 72, -31, 8, '#9aa1a8', '#55595f');
        void rnd;
      },
      front(ctx, cam) {
        // the freeway deck overhead
        const W = cam.W;
        ctx.fillStyle = '#23252b'; ctx.fillRect(0, 0, W, 34);
        const g = ctx.createLinearGradient(0, 34, 0, 60); g.addColorStop(0, '#3a3c42'); g.addColorStop(1, 'rgba(58,60,66,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 34, W, 26);
        ctx.fillStyle = '#16171b'; for (let x = 0; x < W; x += 120) ctx.fillRect(x, 0, 14, 40);
      },
    },
    harbor: {
      back(ctx, cam, court, rnd) {
        const hz = cam.horizon;
        ctx.fillStyle = '#28324f'; ctx.fillRect(0, hz - 4, cam.W, 60);
        // cranes
        [[cam.W * 0.15, 0.5], [cam.W * 0.55, 0.42], [cam.W * 0.88, 0.46]].forEach(([x, s]) => {
          ctx.strokeStyle = '#1b1f30'; ctx.lineWidth = 5 * s;
          ctx.beginPath(); ctx.moveTo(x - 30 * s, hz); ctx.lineTo(x - 30 * s, hz - 150 * s); ctx.moveTo(x + 30 * s, hz); ctx.lineTo(x + 30 * s, hz - 150 * s);
          ctx.moveTo(x - 90 * s, hz - 150 * s); ctx.lineTo(x + 140 * s, hz - 150 * s); ctx.moveTo(x - 30 * s, hz - 110 * s); ctx.lineTo(x + 30 * s, hz - 110 * s); ctx.stroke();
          ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 100 * s, hz - 150 * s); ctx.lineTo(x + 100 * s, hz - 90 * s); ctx.stroke();
        });
      },
      mid(ctx, cam, court, rnd) {
        const cols = ['#c0392b', '#2471a3', '#d68910', '#1e8449', '#7d3c98', '#5d6d7e', '#ca6f1e'];
        for (let x = -80; x < 130; x += 21) {
          const stack = 1 + Math.floor(rnd() * 2.4);
          for (let k = 0; k < stack; k++) {
            const col = cols[Math.floor(rnd() * cols.length)];
            box3(ctx, cam, x, x + 20, -76, -68, k * 8.6, k * 8.6 + 8.5, col);
            for (let rx = x + 1; rx < x + 20; rx += 1.2) { const a = cam.project(rx, -67.95, k * 8.6 + 0.4), b = cam.project(rx, -67.95, k * 8.6 + 8.1); ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
          }
        }
        // forklift and pallets
        box3(ctx, cam, 64, 70, -50, -46, 0, 4, '#f2c14e'); box3(ctx, cam, 66, 69, -49, -47, 4, 7, '#2a2b33');
        [[-30, -46], [-24, -46], [10, -48]].forEach(([x, y]) => box3(ctx, cam, x, x + 4, y - 4, y, 0, 1.2, '#9a6b3c'));
        chainFence(ctx, cam, -50, 72, -31, 9, '#a5a19a', '#5f5a52');
        // bollards
        for (let x = -40; x <= 60; x += 20) box3(ctx, cam, x, x + 1.4, -34, -32.6, 0, 2.6, '#f2c14e');
      },
    },
    gym: {
      back(ctx, cam) {
        // the back wall fills the "sky"
        const hz = cam.horizon + 40;
        const g = ctx.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, '#2a1d14'); g.addColorStop(1, '#5a4330');
        ctx.fillStyle = g; ctx.fillRect(0, 0, cam.W, hz);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
        for (let y = 8; y < hz; y += 14) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cam.W, y); ctx.stroke(); for (let x = (y / 14) % 2 ? 0 : 20; x < cam.W; x += 40) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 14); ctx.stroke(); } }
        // high windows
        for (let x = 60; x < cam.W; x += 220) { ctx.fillStyle = '#7fa6c9'; ctx.fillRect(x, 6, 120, 34); ctx.strokeStyle = '#2a1d14'; ctx.lineWidth = 4; ctx.strokeRect(x, 6, 120, 34); ctx.beginPath(); ctx.moveTo(x + 60, 6); ctx.lineTo(x + 60, 40); ctx.stroke(); }
        // banners
        ['#1a2f8f', '#e8352b', '#ffe14d', '#0f8a4b', '#7b2ff7'].forEach((c, i) => {
          const x = 120 + i * 230; ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, 48); ctx.lineTo(x + 60, 48); ctx.lineTo(x + 60, 118); ctx.lineTo(x + 30, 104); ctx.lineTo(x, 118); ctx.closePath(); ctx.fill();
          A.drawLogo(ctx, ['star', 'crown', 'bolt', 'flame', 'diamond'][i], x + 30, 76, 16, '#ffffff', A.shade(c, -0.25));
        });
      },
      ground(ctx, cam, court) { ctx.fillStyle = court.ground; ctx.fillRect(0, cam.horizon + 40, cam.W, cam.H); },
      mid(ctx, cam) {
        // bleachers behind the far sideline
        for (let r = 0; r < 6; r++) box3(ctx, cam, -50, 72, -36 - r * 2.2, -34 - r * 2.2, r * 1.5, r * 1.5 + 1.5, A.shade('#8a6a45', -r * 0.05));
      },
    },
    crown: {
      back(ctx, cam) {
        const hz = cam.horizon;
        // stadium bowl
        ctx.fillStyle = '#0c0a12'; ctx.beginPath(); ctx.moveTo(0, hz + 10); ctx.quadraticCurveTo(cam.W / 2, hz - 190, cam.W, hz + 10); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        const rr = BK.data.rng('crown-flash');
        for (let i = 0; i < 500; i++) { const x = rr() * cam.W; const top = hz + 10 - (1 - Math.pow((x - cam.W / 2) / (cam.W / 2), 2)) * 95; const y = top + rr() * (hz + 10 - top); ctx.fillStyle = `rgba(${200 + rr() * 55},${180 + rr() * 75},${150 + rr() * 100},${0.2 + rr() * 0.5})`; ctx.fillRect(x, y, 2, 2); }
        // the big crown on the jumbotron
        const cx = cam.W * 0.5, cy = hz - 120;
        ctx.fillStyle = '#1a1424'; ctx.fillRect(cx - 90, cy - 50, 180, 90); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.strokeRect(cx - 90, cy - 50, 180, 90);
        ctx.save(); ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 25; A.drawLogo(ctx, 'crown', cx, cy - 5, 34, '#ffd23f', '#1a1424'); ctx.restore();
      },
      ground(ctx, cam) { ctx.fillStyle = '#0d0b12'; ctx.fillRect(0, cam.horizon, cam.W, cam.H); },
      mid(ctx, cam) {
        for (let r = 0; r < 5; r++) box3(ctx, cam, -60, 80, -38 - r * 2.4, -35.6 - r * 2.4, r * 1.8, r * 1.8 + 1.8, A.shade('#2a2238', -r * 0.06));
        box3(ctx, cam, -60, 80, -33, -32.4, 0, 3, '#ffd23f', { top: '#fff1a8' });
      },
    },
  };

  // ---------- the crowd (drawn every frame) ----------
  function mix(a, b, k) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k);
    return '#' + [16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, '0')).join('');
  }
  A.makeCrowd = function (court) {
    const rnd = BK.data.rng('crowd-' + court.id);
    const people = [];
    const rows = court.scene === 'rooftop' ? 1 : court.scene === 'gym' ? 5 : court.scene === 'crown' ? 4 : 3;
    const density = court.scene === 'rooftop' ? 0.35 : court.scene === 'harbor' || court.scene === 'beach' ? 0.65 : 0.85;
    const shirts = ['#e8352b', '#1f6feb', '#ffffff', '#ffb300', '#0f8a4b', '#7b2ff7', '#14b8a6', '#1e2128', '#ff6a13', '#ff3ea5', '#c9b26b', '#5d6470'];
    for (let r = 0; r < rows; r++) {
      let y, z;
      if (court.scene === 'gym') { y = -35 - r * 2.2; z = r * 1.5 + 1.5; }
      else if (court.scene === 'crown') { y = -36.6 - r * 2.4; z = r * 1.8 + 1.8; }
      else { y = -28.5 - r * 1.7; z = r * 0.9; }
      for (let x = -45; x < 70; x += 1.9 + rnd() * 0.8) {
        if (rnd() > density) continue;
        // the crowd sits back a little: softer colors, darker toward the back rows, so the players pop
        const dim = -0.12 - r * 0.07;
        const mute = (c) => A.shade(mix(c, '#7d7a86', 0.28), dim);
        people.push({ x: x + rnd() * 0.6, y, z, h: 5.2 + rnd() * 1.2, shirt: mute(shirts[Math.floor(rnd() * shirts.length)]), skin: A.shade(BK.data.SKIN[Math.floor(rnd() * BK.data.SKIN.length)], dim * 0.6), ph: rnd() * TAU, hype: 0.5 + rnd() * 0.8, sit: court.scene === 'gym' || court.scene === 'crown' });
      }
    }
    people.sort((a, b) => a.y - b.y);
    return people;
  };
  A.drawCrowd = function (ctx, cam, people, time, excite, court) {
    const night = court.time === 'night' || court.id === 'crown';
    for (const p of people) {
      const jump = excite > 0.2 ? Math.max(0, Math.sin(time * 9 * p.hype + p.ph)) * excite * 1.6 : Math.sin(time * 1.5 + p.ph) * 0.05;
      const z = p.z + (p.sit && excite < 0.3 ? -1.4 : 0) + jump;
      const feet = cam.project(p.x, p.y, z); const s = feet.s;
      const bodyH = p.h * 0.55 * s, headR = p.h * 0.085 * s;
      const top = feet.y - p.h * 0.85 * s;
      const shirt = night ? A.shade(p.shirt, -0.5) : p.shirt;
      ctx.fillStyle = night ? '#141018' : '#2a2a30';
      ctx.fillRect(feet.x - s * 0.45, feet.y - p.h * 0.35 * s, s * 0.9, p.h * 0.35 * s);
      ctx.fillStyle = shirt; A.roundRect(ctx, feet.x - s * 0.6, top + headR * 1.4, s * 1.2, bodyH, s * 0.3); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(feet.x + s * 0.18, top + headR * 1.6, s * 0.38, bodyH * 0.9);
      ctx.fillStyle = night ? A.shade(p.skin, -0.45) : p.skin;
      ctx.beginPath(); ctx.arc(feet.x, top + headR * 0.5, headR, 0, TAU); ctx.fill();
      if (excite > 0.35) {
        const a = Math.sin(time * 10 * p.hype + p.ph);
        ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = Math.max(1.5, s * 0.25); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(feet.x - s * 0.5, top + headR * 1.8); ctx.lineTo(feet.x - s * (0.8 + a * 0.2), top - headR * 1.2);
        ctx.moveTo(feet.x + s * 0.5, top + headR * 1.8); ctx.lineTo(feet.x + s * (0.8 - a * 0.2), top - headR * 1.2); ctx.stroke();
      }
      if (night && excite > 0.5 && Math.sin(time * 23 + p.ph * 7) > 0.97) { ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(feet.x, top, s * 0.5, 0, TAU); ctx.fill(); }
    }
  };

  // Lights that glow on top of everything at night. Drawn every frame with additive blending.
  A.drawGlows = function (ctx, cam, court, time) {
    if (court.time !== 'night' && court.time !== 'indoor' && court.time !== 'dusk') return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const lamps = court.scene === 'gym' ? [[0, -10, 34], [24, -10, 34], [48, -10, 34], [12, 10, 34], [36, 10, 34]] : [[-8, -34, 26], [24, -34, 26], [56, -34, 26]];
    lamps.forEach(([x, y, z], i) => {
      const p = cam.project(x, y, z); const r = p.s * 12 * (1 + Math.sin(time * 2 + i) * 0.03);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      const c = court.scene === 'underpass' ? '255,170,80' : court.scene === 'rooftop' ? '200,160,255' : '255,240,200';
      g.addColorStop(0, `rgba(${c},0.55)`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    });
    if (court.id === 'crown') {
      // sweeping spotlights
      for (let i = 0; i < 3; i++) {
        const a = Math.sin(time * 0.5 + i * 2.1) * 0.5;
        const bx = cam.W * (0.2 + i * 0.3), by = cam.horizon - 60;
        const ex = bx + Math.sin(a) * 600, ey = cam.H;
        const g = ctx.createLinearGradient(bx, by, ex, ey); g.addColorStop(0, 'rgba(255,230,150,0.22)'); g.addColorStop(1, 'rgba(255,230,150,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(bx - 6, by); ctx.lineTo(bx + 6, by); ctx.lineTo(ex + 120, ey); ctx.lineTo(ex - 120, ey); ctx.closePath(); ctx.fill();
      }
    }
    if (court.scene === 'rooftop') {
      const p = cam.project(-20, -48, 40); const on = Math.sin(time * 3) > 0;
      if (on) { const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 16); g.addColorStop(0, 'rgba(255,40,40,0.9)'); g.addColorStop(1, 'rgba(255,40,40,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  };

  // ---------- the hoop ----------
  // part 'back': pole, board, back of the rim and net. part 'front': front of the rim and net.
  A.drawHoop = function (ctx, cam, hoop, part, court, time) {
    const rx = C.rimX, rz = C.rimZ + (hoop.shake ? Math.sin(time * 70) * hoop.shake * 0.35 - hoop.shake * 0.25 : 0);
    const bx = C.boardX;
    if (part === 'back') {
      // pole and arm
      const base = cam.project(49.5, 0, 0), top = cam.project(49.5, 0, 12.6), arm = cam.project(bx + 0.5, 0, 11.6);
      ctx.strokeStyle = '#1d2026'; ctx.lineCap = 'round';
      ctx.lineWidth = base.s * 0.75; ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
      ctx.lineWidth = base.s * 0.45; ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(arm.x, arm.y); ctx.stroke();
      ctx.beginPath(); const mid = cam.project(48, 0, 9.5); ctx.moveTo(mid.x, mid.y); ctx.lineTo(arm.x, arm.y + base.s * 0.6); ctx.stroke();
      // pad
      const p0 = cam.project(49.5, 0, 0.2), p1 = cam.project(49.5, 0, 6.5);
      ctx.strokeStyle = court.accent; ctx.lineWidth = base.s * 1.3; ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      // board
      const jig = hoop.shake ? Math.sin(time * 60) * hoop.shake * 0.12 : 0;
      if (!hoop.shattered) {
        path3(ctx, cam, [[bx, -3, 9.5 + jig], [bx, 3, 9.5 + jig], [bx, 3, 13 + jig], [bx, -3, 13 + jig]]);
        ctx.fillStyle = court.scene === 'lot' || court.scene === 'cage' ? 'rgba(240,240,236,0.92)' : 'rgba(210,235,255,0.35)'; ctx.fill();
        ctx.strokeStyle = court.scene === 'crown' ? '#ffd23f' : '#f4f4f4'; ctx.lineWidth = Math.max(2, base.s * 0.18); ctx.stroke();
        path3(ctx, cam, [[bx - 0.02, -1, 10.1 + jig], [bx - 0.02, 1, 10.1 + jig], [bx - 0.02, 1, 11.6 + jig], [bx - 0.02, -1, 11.6 + jig]]);
        ctx.strokeStyle = court.scene === 'lot' || court.scene === 'cage' ? '#e8352b' : '#ffffff'; ctx.lineWidth = Math.max(1.5, base.s * 0.12); ctx.stroke();
      } else {
        path3(ctx, cam, [[bx, -3, 9.5], [bx, 3, 9.5], [bx, 3, 13], [bx, -3, 13]]);
        ctx.strokeStyle = '#9aa1a8'; ctx.lineWidth = Math.max(2, base.s * 0.18); ctx.stroke();
      }
      // bracket
      const br0 = cam.project(bx, 0, rz), br1 = cam.project(rx + C.rimR, 0, rz);
      ctx.strokeStyle = '#c0391f'; ctx.lineWidth = Math.max(2, base.s * 0.2); ctx.beginPath(); ctx.moveTo(br0.x, br0.y); ctx.lineTo(br1.x, br1.y); ctx.stroke();
    }
    // rim + net halves
    const n = 20; const ring = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU; ring.push([rx + Math.cos(a) * C.rimR, Math.sin(a) * C.rimR, a]); }
    const isFront = (y) => y > 0;
    // net
    const sw = hoop.swish || 0; const netLen = 1.7 + sw * 0.6;
    ctx.lineWidth = 1.2; ctx.strokeStyle = court.scene === 'gym' || court.scene === 'crown' ? 'rgba(255,255,255,0.85)' : 'rgba(205,210,215,0.9)';
    ring.forEach(([x, y, a]) => {
      if (isFront(y) !== (part === 'front')) return;
      const k = 0.58; const sway = Math.sin(time * 14 + a * 3) * sw * 0.25;
      const bx2 = rx + Math.cos(a) * C.rimR * k + sway, by2 = Math.sin(a) * C.rimR * k;
      const p = cam.project(x, y, rz), q = cam.project(bx2, by2, rz - netLen);
      const a2 = a + TAU / n * 1.5; const q2 = cam.project(rx + Math.cos(a2) * C.rimR * k + sway, Math.sin(a2) * C.rimR * k, rz - netLen);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.moveTo(p.x, p.y); ctx.lineTo(q2.x, q2.y); ctx.stroke();
    });
    // rim
    ctx.strokeStyle = court.scene === 'crown' ? '#ffd23f' : '#e2401c'; ctx.lineWidth = Math.max(2.5, cam.project(rx, 0, rz).s * 0.14); ctx.lineCap = 'round';
    ctx.beginPath(); let started = false;
    for (let i = 0; i <= n; i++) {
      const [x, y] = ring[i % n];
      const want = isFront(y) === (part === 'front') || (i % n === 0) || (i % n === n / 2);
      const p = cam.project(x, y, rz);
      if (want) { if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y); } else started = false;
    }
    ctx.stroke();
  };
})(window.BK = window.BK || {});
