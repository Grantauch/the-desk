// Drawing the commander and the range preview on the field. Loaded after render2.js.
(function (root) {
  const BK = root.BK;
  const A = BK.Art;
  const RP = BK.Renderer.prototype;
  const TAU = Math.PI * 2;

  // ------------------------------------------------------------------ the commander's sprite
  // Captain and runner, top down, facing +x. Four walking frames, cached at 4x.
  const cache = {};
  function sprite(frame) {
    if (cache[frame]) return cache[frame];
    const S = 56, K = 4;
    const cv = document.createElement("canvas");
    cv.width = cv.height = S * K;
    const c = cv.getContext("2d");
    c.scale(K, K);
    c.translate(S / 2, S / 2);
    const H = A._p;
    const sw = [0, 1.4, 0, -1.4][frame];
    if (H) {
      // The runner a step behind, rifle slung, carrying the dispatch case.
      H.man(c, -9, 7 + sw * 0.4, 0, { head: "helmet", arms: [[3, -4], [2, 4]], pack: true });
      H.rifle(c, -14, 4, 15, 0.3, false);
      // The captain: greatcoat, map case, pistol forward, rogatywka with silver braid.
      c.save();
      c.scale(1.25, 1.25);
      H.man(c, 2, -2 + sw * 0.3, 0, { head: "officer", tunic: "#77704a", arms: [[9, -2.5], [3, 5]], belt: true });
      c.restore();
      c.fillStyle = "#2a2622";
      c.fillRect(13, -4.6, 4, 1.6);
      c.fillStyle = "#5a3e22";
      c.fillRect(1.5, 5.5, 4.5, 3.4);
      // Rank stars on the cap band, and the white and red armband.
      c.fillStyle = "#e9e4cf";
      for (let i = 0; i < 3; i++) c.fillRect(-1.5 + i * 1.7, -6.7, 1, 1);
      c.fillStyle = "#f2efe4"; c.fillRect(-0.5, 3.8, 2.6, 1.2);
      c.fillStyle = "#c23b2a"; c.fillRect(-0.5, 5, 2.6, 1.2);
    } else {
      c.beginPath(); c.arc(0, 0, 8, 0, TAU); c.fillStyle = "#77704a"; c.fill();
    }
    return (cache[frame] = { cv, S });
  }
  A.hero = function (c, h, time) {
    const f = h.tx !== h.x || h.ty !== h.y ? Math.floor(h.walk * 8) % 4 : 0;
    const sp = sprite(f);
    // A ring on the ground marks the commander at any zoom.
    c.beginPath(); c.arc(h.x, h.y, 17, 0, TAU);
    c.fillStyle = "rgba(20,16,8,0.35)"; c.fill();
    c.strokeStyle = "rgba(255,207,74,0.85)"; c.lineWidth = 1.6; c.stroke();
    c.save();
    c.translate(h.x, h.y);
    c.rotate(h.ang);
    const s = BK.US * 1.35;
    c.scale(s, s);
    c.drawImage(sp.cv, -sp.S / 2, -sp.S / 2, sp.S, sp.S);
    c.restore();
  };
  A.heroIcon = function (size) {
    const s = size || 48;
    const cv = document.createElement("canvas");
    cv.width = cv.height = s * 2;
    const c = cv.getContext("2d");
    const sp = sprite(0);
    c.translate(s, s);
    c.rotate(-Math.PI / 2);
    c.drawImage(sp.cv, -s * 1.1, -s * 1.1, s * 2.2, s * 2.2);
    return cv.toDataURL();
  };

  // ------------------------------------------------------------------ field drawing
  const baseLive = RP.drawLiveProps;
  RP.drawLiveProps = function (c, v, layer) {
    baseLive.call(this, c, v, layer);
    if (layer !== "high" || !this.g) return;
    const g = this.g, app = BK.app;
    if (this.quiet || !app || app.g !== g) return;
    // Every gun's reach at once, while the preview is on.
    if (app.rangeAll) {
      c.save();
      for (const t of g.towers) {
        const s = g.towerStats(t);
        if (!s.range) continue;
        const sup = BK.GUNS[t.kind].support;
        c.beginPath(); c.arc(t.x, t.y, s.range, 0, TAU);
        c.fillStyle = sup ? "rgba(120,200,255,0.06)" : "rgba(255,230,150,0.05)";
        c.fill();
        c.strokeStyle = sup ? "rgba(140,210,255,0.55)" : "rgba(255,230,160,0.45)";
        c.lineWidth = 1.2;
        c.setLineDash(sup ? [6, 5] : []);
        c.stroke();
        if (s.minRange) { c.beginPath(); c.arc(t.x, t.y, s.minRange, 0, TAU); c.strokeStyle = "rgba(255,120,90,0.4)"; c.setLineDash([3, 4]); c.stroke(); }
      }
      c.setLineDash([]);
      c.restore();
    }
    const h = g.hero;
    if (!h) return;
    const sel = app.mode === "hero";
    if (h.dead) {
      // Where he will come back, with the time left.
      c.save();
      c.globalAlpha = 0.8;
      c.beginPath(); c.arc(h.home.x, h.home.y, 14, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - h.respawn / BK.HERO.respawn));
      c.strokeStyle = "#9fe870"; c.lineWidth = 3; c.stroke();
      c.fillStyle = "#f2e3b0"; c.font = "bold 11px system-ui, sans-serif"; c.textAlign = "center";
      c.fillText(Math.ceil(h.respawn) + "s", h.home.x, h.home.y + 4);
      c.textAlign = "left";
      c.restore();
      return;
    }
    if (sel) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);
      c.beginPath(); c.arc(h.x, h.y, 18 + pulse * 2, 0, TAU);
      c.strokeStyle = `rgba(255,214,90,${0.6 + 0.4 * pulse})`; c.lineWidth = 2.5; c.stroke();
      c.beginPath(); c.arc(h.x, h.y, BK.HERO.range, 0, TAU);
      c.strokeStyle = "rgba(255,214,90,0.25)"; c.lineWidth = 1; c.setLineDash([4, 5]); c.stroke(); c.setLineDash([]);
    }
    if (sel || h.tx !== h.x || h.ty !== h.y) {
      if (Math.hypot(h.tx - h.x, h.ty - h.y) > 4) {
        c.save();
        c.strokeStyle = "rgba(255,230,160,0.55)"; c.lineWidth = 1.5; c.setLineDash([3, 5]);
        c.beginPath(); c.moveTo(h.x, h.y); c.lineTo(h.tx, h.ty); c.stroke();
        c.setLineDash([]);
        // A small pennant where he is headed.
        c.strokeStyle = "#2a2016"; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(h.tx, h.ty); c.lineTo(h.tx, h.ty - 16); c.stroke();
        c.fillStyle = "#f2efe4"; c.fillRect(h.tx, h.ty - 16, 9, 3);
        c.fillStyle = "#c23b2a"; c.fillRect(h.tx, h.ty - 13, 9, 3);
        c.restore();
      }
    }
    A.hero(c, h, this.time);
    if (h.flash > 0) { c.beginPath(); c.arc(h.x, h.y, 14, 0, TAU); c.fillStyle = `rgba(255,80,60,${h.flash * 3})`; c.fill(); }
    // Health and level.
    const w = 30, k = Math.max(0, h.hp / h.maxHp);
    c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(h.x - w / 2 - 1, h.y - 31, w + 2, 5);
    c.fillStyle = k > 0.4 ? "#9fe870" : "#ff5a4f"; c.fillRect(h.x - w / 2, h.y - 30, w * k, 3);
    c.beginPath(); c.arc(h.x - w / 2 - 6, h.y - 28.5, 5.5, 0, TAU); c.fillStyle = "#ffcf4a"; c.fill();
    c.strokeStyle = "rgba(0,0,0,0.6)"; c.lineWidth = 1; c.stroke();
    c.fillStyle = "#1a1712"; c.font = "bold 8px system-ui, sans-serif"; c.textAlign = "center";
    c.fillText(String(h.lvl), h.x - w / 2 - 6, h.y - 25.8);
    c.textAlign = "left";
  };

  // A rally ring when the captain calls the guns on.
  const baseHandle = RP.handle;
  RP.handle = function (ev) {
    if (ev.type === "rally" && this.fx) {
      this.fx.rings.push({ x: ev.x, y: ev.y, r: 20, max: ev.r, life: 0.8, age: 0, w: 4 });
      if (BK.Audio.ui && !this.quiet) BK.Audio.ui();
    }
    return baseHandle.call(this, ev);
  };
})(typeof window !== "undefined" ? window : globalThis);
