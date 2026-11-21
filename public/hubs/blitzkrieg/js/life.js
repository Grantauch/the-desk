// Life on the battlefield that the battle does not control: grazing cattle and horses, geese,
// farmers, refugee columns and horse carts on the roads between waves, storks on the chimneys,
// and aircraft passing high overhead. Render side only, so it never touches the simulation.
(function (root) {
  const BK = root.BK;
  const R = BK.fxr || Math.random;
  const A = BK.Art;
  const rnd = (a, b) => a + (b - a) * R();
  const pick = (arr) => arr[Math.floor(R() * arr.length)];

  // ------------------------------------------------------------------ drawings, cached by frame
  const cache = {};
  function sprite(key, w, h, draw) {
    if (cache[key]) return cache[key];
    const cv = document.createElement("canvas");
    cv.width = w * 2; cv.height = h * 2;
    const c = cv.getContext("2d");
    c.scale(2, 2);
    c.translate(w / 2, h / 2);
    draw(c);
    return (cache[key] = { cv, w, h });
  }
  function put(c, sp, x, y, ang) {
    c.save(); c.translate(x, y); c.rotate(ang);
    c.drawImage(sp.cv, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
    c.restore();
  }
  const OUT = "rgba(14,12,9,0.85)";

  function cow(coat, f) {
    return sprite("cow" + coat + f, 44, 26, (c) => {
      const step = [-1.5, 0, 1.5, 0][f];
      c.strokeStyle = "#1c150e"; c.lineWidth = 2; c.lineCap = "round";
      c.beginPath(); c.moveTo(7, -4); c.lineTo(9 + step, -6); c.moveTo(7, 4); c.lineTo(9 - step, 6); c.moveTo(-8, -4); c.lineTo(-10 - step, -6); c.moveTo(-8, 4); c.lineTo(-10 + step, 6); c.stroke();
      c.beginPath(); c.ellipse(0, 0, 11, 6.4, 0, 0, 6.28);
      c.fillStyle = coat; c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.9; c.stroke();
      if (coat === "#f0ebe0") { c.fillStyle = "#2a2622"; c.beginPath(); c.ellipse(-3, -2, 3.5, 2.6, 0.4, 0, 6.28); c.fill(); c.beginPath(); c.ellipse(4, 2.5, 2.6, 2, 0, 0, 6.28); c.fill(); }
      c.beginPath(); c.ellipse(13, 0, 4, 3.2, 0, 0, 6.28); c.fillStyle = coat; c.fill(); c.stroke();
      c.fillStyle = "#d8c8a0"; c.fillRect(14.5, -4, 1, 2); c.fillRect(14.5, 2, 1, 2);
      c.strokeStyle = "#2a2018"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-11, 0); c.lineTo(-15, 1); c.stroke();
    });
  }
  function goose(f) {
    return sprite("goose" + f, 16, 12, (c) => {
      c.beginPath(); c.ellipse(0, 0, 4.4, 2.8, 0, 0, 6.28); c.fillStyle = "#f4f2ea"; c.fill(); c.strokeStyle = "rgba(60,56,50,0.7)"; c.lineWidth = 0.6; c.stroke();
      c.strokeStyle = "#f4f2ea"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(3, 0); c.lineTo(6 + (f ? 0.6 : 0), f ? -0.5 : 0.5); c.stroke();
      c.fillStyle = "#e8902a"; c.fillRect(6.4, -0.4, 1.6, 0.9);
    });
  }
  function person(kind, f) {
    // Seen from above: shoulders, head, and the walk in the legs.
    return sprite("p" + kind + f, 20, 20, (c) => {
      const step = [-2, 0, 2, 0][f];
      const coat = { farmer: "#6a5440", woman: "#7a3a30", child: "#5a6a7a", refugee: "#5a5048", priest: "#1e1c1a" }[kind] || "#5a5048";
      c.strokeStyle = "#2a2420"; c.lineWidth = 1.8; c.lineCap = "round";
      c.beginPath(); c.moveTo(-1, -1.6); c.lineTo(-4 + step, -1.8); c.moveTo(-1, 1.6); c.lineTo(-4 - step, 1.8); c.stroke();
      const s = kind === "child" ? 0.75 : 1;
      c.scale(s, s);
      c.beginPath(); c.ellipse(0, 0, 3, 5, 0, 0, 6.28); c.fillStyle = coat; c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.8; c.stroke();
      if (kind === "woman") { c.beginPath(); c.arc(0.6, 0, 2.7, 0, 6.28); c.fillStyle = "#c8b48a"; c.fill(); c.stroke(); }
      else { c.beginPath(); c.arc(0.6, 0, 2.5, 0, 6.28); c.fillStyle = kind === "priest" ? "#1a1816" : "#3a3028"; c.fill(); c.stroke(); }
      if (kind === "refugee") { c.fillStyle = "#8a7a5a"; c.fillRect(-4.5, -2.5, 3, 5); }
      if (kind === "farmer") { c.strokeStyle = "#7a5a34"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(2, 3); c.lineTo(8, 5); c.stroke(); }
    });
  }
  function cart(load) {
    // A Polish farm wagon, the fura: long ladder sides, four wheels, a load of household goods.
    return sprite("cart" + load, 46, 24, (c) => {
      for (const [x, y] of [[-9, -8], [-9, 8], [9, -8], [9, 8]]) { c.fillStyle = "#2a2018"; c.fillRect(x - 3.5, y - 1.2, 7, 2.4); }
      c.fillStyle = "#6b5034"; c.fillRect(-14, -6, 28, 12);
      c.strokeStyle = "#3e2c1c"; c.lineWidth = 1; c.strokeRect(-14, -6, 28, 12);
      c.strokeStyle = "rgba(40,28,16,0.6)"; c.lineWidth = 0.6;
      for (let x = -12; x < 14; x += 3) { c.beginPath(); c.moveTo(x, -6); c.lineTo(x, 6); c.stroke(); }
      if (load === "goods") {
        c.fillStyle = "#8a7050"; c.fillRect(-11, -4, 8, 8);
        c.fillStyle = "#b8a68a"; c.beginPath(); c.ellipse(3, 0, 5, 4, 0, 0, 6.28); c.fill();
        c.fillStyle = "#7a3a30"; c.fillRect(-2, -3.5, 4, 3);
      } else if (load === "hay") {
        c.fillStyle = "#c8a85a"; c.beginPath(); c.ellipse(0, 0, 13, 6.5, 0, 0, 6.28); c.fill();
        c.strokeStyle = "rgba(120,90,40,0.6)"; c.lineWidth = 0.5;
        for (let i = -10; i < 12; i += 2.5) { c.beginPath(); c.moveTo(i, -5); c.lineTo(i + 2, 5); c.stroke(); }
      }
      c.strokeStyle = "#4a3624"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(14, 0); c.lineTo(22, 0); c.stroke();
    });
  }
  function car(kind, col) {
    // A Polski Fiat 508 or a farm lorry piled with a family's belongings.
    return sprite("car" + kind + col, 44, 24, (c) => {
      const L = kind === "lorry" ? 36 : 26, Wd = kind === "lorry" ? 15 : 12;
      for (const [x, y] of [[-L * 0.3, -Wd / 2], [-L * 0.3, Wd / 2], [L * 0.3, -Wd / 2], [L * 0.3, Wd / 2]]) { c.fillStyle = "#141210"; c.fillRect(x - 3, y - 1.4, 6, 2.8); }
      c.beginPath(); c.roundRect ? c.roundRect(-L / 2, -Wd / 2, L, Wd, 3) : c.rect(-L / 2, -Wd / 2, L, Wd);
      c.fillStyle = col; c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.9; c.stroke();
      if (kind === "lorry") {
        c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(L / 2 - 10, -Wd / 2, 10, Wd);
        c.fillStyle = "#8a7050"; c.fillRect(-L / 2 + 2, -Wd / 2 + 2, 10, Wd - 4);
        c.fillStyle = "#b8a68a"; c.beginPath(); c.ellipse(-L / 2 + 17, 0, 5, 4, 0, 0, 6.28); c.fill();
      } else {
        c.fillStyle = "rgba(20,24,28,0.75)"; c.fillRect(-3, -Wd / 2 + 1.5, 8, Wd - 3);
        c.fillStyle = "rgba(255,255,255,0.18)"; c.fillRect(-L / 2 + 2, -Wd / 2 + 1, L - 4, 1.2);
      }
      c.fillStyle = "#e8e0b8"; c.fillRect(L / 2 - 1, -Wd / 2 + 1.5, 1.5, 2); c.fillRect(L / 2 - 1, Wd / 2 - 3.5, 1.5, 2);
    });
  }
  function stork(f) {
    return sprite("stork" + f, 30, 30, (c) => {
      if (f < 2) {
        // On the nest, wings folded.
        c.beginPath(); c.arc(0, 0, 8, 0, 6.28); c.fillStyle = "#5a4630"; c.fill();
        c.strokeStyle = "rgba(40,30,18,0.8)"; c.lineWidth = 0.7;
        for (let a = 0; a < 6.28; a += 0.5) { c.beginPath(); c.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); c.lineTo(Math.cos(a + 0.4) * 8.5, Math.sin(a + 0.4) * 8.5); c.stroke(); }
        c.beginPath(); c.ellipse(0, 0, 4.4, 2.6, 0, 0, 6.28); c.fillStyle = "#f4f2ec"; c.fill();
        c.fillStyle = "#151515"; c.fillRect(-4.4, -1.2, 2.4, 2.4);
        c.strokeStyle = "#d84a2a"; c.lineWidth = 1; c.beginPath(); c.moveTo(3, f ? -0.5 : 0.5); c.lineTo(7.5, f ? -1.5 : 1.5); c.stroke();
      } else {
        // In flight, black flight feathers on white wings.
        const w = f === 2 ? 1 : 0.8;
        c.fillStyle = "#f4f2ec";
        c.beginPath(); c.ellipse(0, 0, 6, 2, 0, 0, 6.28); c.fill();
        c.beginPath(); c.moveTo(1, 0); c.lineTo(-2, -13 * w); c.lineTo(-5, -13 * w); c.lineTo(-3, 0); c.moveTo(1, 0); c.lineTo(-2, 13 * w); c.lineTo(-5, 13 * w); c.lineTo(-3, 0); c.fill();
        c.fillStyle = "#151515"; c.fillRect(-5, -13 * w, 3, 6 * w); c.fillRect(-5, 7 * w, 3, 6 * w);
        c.strokeStyle = "#d84a2a"; c.lineWidth = 1; c.beginPath(); c.moveTo(6, 0); c.lineTo(11, 0); c.stroke();
      }
    });
  }

  // ------------------------------------------------------------------ the life system
  class Life {
    constructor(g, sun) {
      this.g = g;
      this.sun = sun;
      this.items = [];
      this.planes = [];
      this.planeT = rnd(14, 30);
      this.columnT = 3;
      this.t = 0;
      const houses = g.props.filter((p) => p.kind === "house" || p.kind === "barn");
      this.houses = houses;
      const area = (g.WW * g.WH) / (1280 * 720);
      // Herds graze in open ground away from the road.
      const herdN = Math.round(1 + area * 1.2);
      for (let i = 0; i < herdN; i++) {
        const spot = this.openSpot(90);
        if (!spot) continue;
        const kind = R() < 0.6 ? "cow" : "horse";
        const n = kind === "cow" ? 2 + Math.floor(R() * 4) : 1 + Math.floor(R() * 3);
        for (let k = 0; k < n; k++) {
          this.items.push({ kind, x: spot.x + rnd(-40, 40), y: spot.y + rnd(-30, 30), ang: R() * 6.28, hx: spot.x, hy: spot.y, coat: kind === "cow" ? pick(["#7a4a2a", "#f0ebe0", "#5a3a22", "#8a6a4a"]) : pick(["#6a4428", "#3a2618", "#8a6a48", "#cfc4b0"]), walkT: rnd(1, 6), sp: 0, f: 0 });
        }
      }
      // Geese around the farmyards.
      for (const h of houses.slice(0, Math.round(2 + area))) {
        if (R() < 0.5) continue;
        const n = 3 + Math.floor(R() * 5);
        const a = R() * 6.28;
        for (let k = 0; k < n; k++) this.items.push({ kind: "goose", x: h.x + Math.cos(a) * 60 + k * 7, y: h.y + Math.sin(a) * 60 + rnd(-6, 6), ang: R() * 6.28, hx: h.x + Math.cos(a) * 60, hy: h.y + Math.sin(a) * 60, walkT: rnd(0.5, 3), sp: 0, f: 0 });
      }
      // Farmers at work near the houses; they go inside when the shooting starts.
      for (const h of houses) {
        if (R() < 0.45) continue;
        const a = R() * 6.28;
        this.items.push({ kind: "person", role: pick(["farmer", "farmer", "woman", "child"]), x: h.x + Math.cos(a) * 70, y: h.y + Math.sin(a) * 70, ang: R() * 6.28, hx: h.x, hy: h.y, home: h, walkT: rnd(1, 4), sp: 0, f: 0 });
      }
      // Storks nest on some chimneys and poles.
      for (const p of g.props) if (p.stork) this.items.push({ kind: "stork", x: p.x + (p.kind === "pole" ? 0 : 6), y: p.y - (p.kind === "pole" ? 0 : 4), nx: p.x, ny: p.y, ang: R() * 6.28, state: "nest", nestT: rnd(10, 40), f: 0, alt: 0 });
    }
    openSpot(pad) {
      const g = this.g;
      for (let tries = 0; tries < 30; tries++) {
        const x = rnd(pad, g.WW - pad), y = rnd(pad, g.WH - pad);
        if (g.nearRoad && g.nearRoad(x, y) < 110) continue;
        if (g.isWater && g.isWater(x, y)) continue;
        if (g.props.some((p) => p.block && (p.x - x) ** 2 + (p.y - y) ** 2 < (p.r + 50) ** 2)) continue;
        if (g.towers.some((t) => (t.x - x) ** 2 + (t.y - y) ** 2 < 100 * 100)) continue;
        return { x, y };
      }
      return null;
    }
    // A blast nearby: animals bolt, people run for cover, storks take off.
    scare(x, y, r) {
      const rr = (r || 60) * 4;
      for (const it of this.items) {
        const d2 = (it.x - x) ** 2 + (it.y - y) ** 2;
        if (d2 > rr * rr) continue;
        if (it.kind === "stork") { if (it.state === "nest") { it.state = "fly"; it.alt = 0.2; it.ang = Math.atan2(it.y - y, it.x - x); it.flyT = rnd(14, 24); } continue; }
        it.ang = Math.atan2(it.y - y, it.x - x) + rnd(-0.4, 0.4);
        it.panic = rnd(2.5, 4.5);
        it.sp = it.kind === "goose" ? 50 : it.kind === "person" ? 70 : 90;
      }
    }
    update(dt) {
      const g = this.g;
      this.t += dt;
      const combat = g.phase === "combat";
      for (const it of this.items) {
        if (it.kind === "stork") { this.updateStork(it, dt); continue; }
        if (it.gone) continue;
        if (it.panic > 0) {
          it.panic -= dt;
        } else if (it.kind === "person" && combat && it.home) {
          // Head for the house, and stay in it once there.
          const d = Math.hypot(it.home.x - it.x, it.home.y - it.y);
          if (d < it.home.r * 0.8 || it.home.state === "ruin") { it.hidden = it.home.state !== "ruin"; it.sp = 0; if (it.home.state === "ruin") it.hidden = false; }
          else { it.ang = Math.atan2(it.home.y - it.y, it.home.x - it.x); it.sp = 55; }
        } else if (it.kind === "column" || it.kind === "wagon" || it.kind === "car") {
          // handled below
        } else {
          it.hidden = false;
          it.walkT -= dt;
          if (it.walkT <= 0) {
            it.walkT = rnd(2, 7);
            const dh = Math.hypot(it.hx - it.x, it.hy - it.y);
            if (dh > 70) it.ang = Math.atan2(it.hy - it.y, it.hx - it.x) + rnd(-0.5, 0.5);
            else it.ang += rnd(-1.4, 1.4);
            it.sp = R() < 0.45 ? 0 : it.kind === "goose" ? rnd(8, 14) : it.kind === "person" ? rnd(14, 22) : rnd(6, 12);
          }
        }
        if (it.kind === "column" || it.kind === "wagon" || it.kind === "car") this.updateTraveller(it, dt, combat);
        else {
          it.x += Math.cos(it.ang) * it.sp * dt;
          it.y += Math.sin(it.ang) * it.sp * dt;
          it.x = Math.max(10, Math.min(g.WW - 10, it.x));
          it.y = Math.max(10, Math.min(g.WH - 10, it.y));
          if (it.panic <= 0 && it.kind !== "person" && it.sp > 30) it.sp = 10;
        }
        it.anim = (it.anim || 0) + dt * (it.sp > 0 ? it.sp * 0.25 : 0);
      }
      this.items = this.items.filter((it) => !it.gone);
      // Refugees and wagons on the roads, only while the guns are quiet.
      if (!combat) {
        this.columnT -= dt;
        if (this.columnT <= 0 && this.items.filter((i) => i.kind === "column" || i.kind === "wagon" || i.kind === "car").length < 10) {
          this.columnT = rnd(6, 14);
          this.spawnTraveller();
        }
      }
      // Aircraft passing over: German bomber formations high up, a pair of Polish P.11 fighters.
      this.planeT -= dt;
      if (this.planeT <= 0) {
        this.planeT = rnd(25, 55);
        this.spawnFlyover();
      }
      for (const p of this.planes) { p.x += Math.cos(p.ang) * p.sp * dt; p.y += Math.sin(p.ang) * p.sp * dt; p.t += dt; }
      this.planes = this.planes.filter((p) => p.t < p.life);
    }
    spawnTraveller() {
      const g = this.g;
      const pi = Math.floor(R() * g.paths.length);
      const p = g.paths[pi];
      // They travel away from the front, toward the town the guns defend.
      const wagon = R() < 0.4;
      if (R() < 0.18) {
        const kind = R() < 0.5 ? "auto" : "lorry";
        this.items.push({ kind: "car", car: kind, col: pick(kind === "auto" ? ["#2a2c30", "#4a3a2a", "#3a4a3a", "#6a2a22"] : ["#4a5040", "#5a4a32"]), path: pi, d: rnd(p.len * 0.1, p.len * 0.6), sp: rnd(38, 52), x: 0, y: 0, ang: 0, lat: rnd(-5, 5) });
        return;
      }
      const d0 = rnd(p.len * 0.1, p.len * 0.6);
      if (wagon) {
        this.items.push({ kind: "wagon", path: pi, d: d0, sp: rnd(22, 30), load: pick(["goods", "hay", "goods"]), coat: pick(["#6a4428", "#3a2618", "#8a6a48"]), x: 0, y: 0, ang: 0, lat: rnd(-6, 6) });
      } else {
        const n = 3 + Math.floor(R() * 6);
        for (let i = 0; i < n; i++) {
          this.items.push({ kind: "column", role: pick(["refugee", "refugee", "woman", "child", "farmer"]), path: pi, d: d0 - i * rnd(10, 16), sp: rnd(16, 22), lat: rnd(-12, 12), x: 0, y: 0, ang: 0 });
        }
      }
    }
    updateTraveller(it, dt, combat) {
      const p = this.g.paths[it.path];
      const hurry = combat ? 2.2 : 1;
      it.d += it.sp * hurry * dt;
      if (it.d > p.len) { it.gone = true; return; }
      if (it.d < 0) return;
      const [x, y, a] = p.at(it.d);
      it.x = x - Math.sin(a) * it.lat;
      it.y = y + Math.cos(a) * it.lat;
      it.ang = a;
      it.sp = it.sp || 18;
    }
    spawnFlyover() {
      const g = this.g;
      const fromLeft = R() < 0.5;
      const ang = (fromLeft ? 0 : Math.PI) + rnd(-0.4, 0.4);
      const y0 = rnd(g.WH * 0.1, g.WH * 0.9);
      const x0 = fromLeft ? -200 : g.WW + 200;
      const polish = R() < 0.3;
      const n = polish ? 2 : pick([3, 3, 5, 6]);
      const life = (g.WW + 500) / (polish ? 260 : 150);
      for (let i = 0; i < n; i++) {
        const row = Math.floor((i + 1) / 2), side = i % 2 ? 1 : -1;
        const back = row * 60, off = row * 46 * side;
        this.planes.push({
          polish, x: x0 - Math.cos(ang) * back - Math.sin(ang) * off, y: y0 - Math.sin(ang) * back + Math.cos(ang) * off,
          ang, sp: polish ? 260 : 150, t: 0, life, alt: polish ? 0.75 : 1,
        });
      }
      if (this.onPlane) this.onPlane(polish);
    }
    updateStork(it, dt) {
      it.f = (it.f || 0) + dt;
      if (it.state === "nest") {
        it.nestT -= dt;
        if (it.nestT <= 0) { it.state = "fly"; it.flyT = rnd(10, 22); it.ang = R() * 6.28; it.alt = 0.1; }
        return;
      }
      it.flyT -= dt;
      it.alt = Math.min(1, it.alt + dt * 0.5);
      if (it.flyT <= 0) {
        // Circle back and settle on the nest.
        const a = Math.atan2(it.ny - it.y, it.nx - it.x);
        let da = a - it.ang;
        while (da > Math.PI) da -= 6.28;
        while (da < -Math.PI) da += 6.28;
        it.ang += Math.max(-1.5 * dt, Math.min(1.5 * dt, da));
        if (Math.hypot(it.nx - it.x, it.ny - it.y) < 10) { it.state = "nest"; it.nestT = rnd(15, 40); it.x = it.nx; it.y = it.ny; it.alt = 0; return; }
      } else it.ang += Math.sin(it.f * 0.4) * dt * 0.4;
      it.x += Math.cos(it.ang) * 48 * dt;
      it.y += Math.sin(it.ang) * 48 * dt;
    }

    // Under the units: animals, people and wagons.
    drawGround(c, view) {
      const sun = this.sun;
      for (const it of this.items) {
        if (it.kind === "stork" || it.hidden) continue;
        if (it.x < view.x0 - 40 || it.x > view.x1 + 40 || it.y < view.y0 - 40 || it.y > view.y1 + 40) continue;
        const f = Math.floor(it.anim || 0) % 4;
        // Soft shadow.
        c.globalAlpha = sun.a * 0.8;
        c.fillStyle = "#000";
        const big = it.kind === "cow" || it.kind === "horse" || it.kind === "wagon" || it.kind === "car";
        c.beginPath(); c.ellipse(it.x + sun.x * 3, it.y + sun.y * 3, big ? 12 : 4, big ? 7 : 3, it.ang, 0, 6.28); c.fill();
        c.globalAlpha = 1;
        if (it.kind === "cow") put(c, cow(it.coat, it.sp > 0 ? f : 1), it.x, it.y, it.ang);
        else if (it.kind === "horse") { c.save(); c.translate(it.x, it.y); c.rotate(it.ang); c.scale(0.8, 0.8); A.horse(c, it.sp > 20 ? it.anim * 0.12 : 0, it.coat, null); c.restore(); }
        else if (it.kind === "goose") put(c, goose(it.sp > 0 ? f % 2 : 0), it.x, it.y, it.ang);
        else if (it.kind === "person" || it.kind === "column") put(c, person(it.role, it.sp > 0 ? f : 1), it.x, it.y, it.ang);
        else if (it.kind === "car") {
          put(c, car(it.car, it.col), it.x, it.y, it.ang);
          if (R() < 0.15) BK.app && BK.app.R && BK.app.R.fx.add({ kind: "dust", x: it.x - Math.cos(it.ang) * 16, y: it.y - Math.sin(it.ang) * 16, vx: 0, vy: 0, life: 0.8, size: 6, grow: 14, a: 0.35, drag: 0.94 });
        }
        else if (it.kind === "wagon") {
          put(c, cart(it.load), it.x - Math.cos(it.ang) * 8, it.y - Math.sin(it.ang) * 8, it.ang);
          c.save(); c.translate(it.x + Math.cos(it.ang) * 16, it.y + Math.sin(it.ang) * 16); c.rotate(it.ang); c.scale(0.7, 0.7); A.horse(c, it.anim * 0.1, it.coat, null); c.restore();
          put(c, person("farmer", 1), it.x - Math.cos(it.ang) * 2, it.y - Math.sin(it.ang) * 2, it.ang);
        }
      }
    }
    // Over the trees: storks in flight and on their nests, aircraft high above.
    drawAir(c, view) {
      const sun = this.sun;
      for (const it of this.items) {
        if (it.kind !== "stork") continue;
        if (it.state === "nest") { put(c, stork(Math.floor(it.f * 0.7) % 2), it.x, it.y, it.ang); continue; }
        const off = 30 * it.alt;
        c.globalAlpha = 0.18; c.fillStyle = "#000";
        c.beginPath(); c.ellipse(it.x + sun.x * off, it.y + sun.y * off, 8, 3, it.ang, 0, 6.28); c.fill();
        c.globalAlpha = 1;
        put(c, stork(2 + (Math.floor(it.f * 3) % 2)), it.x, it.y, it.ang);
      }
      for (const p of this.planes) {
        if (p.x < view.x0 - 300 || p.x > view.x1 + 300 || p.y < view.y0 - 300 || p.y > view.y1 + 300) continue;
        // Shadow far from the plane, it is that high up.
        const off = 160 * p.alt;
        c.save();
        c.globalAlpha = 0.16;
        c.translate(p.x + sun.x * off, p.y + sun.y * off);
        c.rotate(p.ang);
        c.fillStyle = "#000";
        c.fillRect(-14, -3, 28, 6); c.fillRect(-3, -22, 7, 44);
        c.restore();
        c.save();
        c.globalAlpha = 0.92;
        if (p.polish) { A.p11(c, p.x, p.y, p.ang, this.t); }
        else {
          c.translate(p.x, p.y); c.rotate(p.ang); c.scale(0.62, 0.62);
          A.enemy(c, { kind: "leader", t: this.t, seed: 1, dist: 0, alt: 1, x: 0, y: 0, ang: 0 }, {});
        }
        c.restore();
      }
    }
  }
  BK.Life = Life;
})(typeof window !== "undefined" ? window : globalThis);
