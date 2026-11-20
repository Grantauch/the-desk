// Canvas assets and world-layer drawing for the student playtest additions.
(function (root) {
  const BK = root.BK, A = BK.Art, RP = BK.Renderer.prototype;
  const { W, BASE_R } = A._f;
  const ink = "#221e19", mint = "#a7e6dd", brass = "#f1cb72";

  function block(c, x, y, w, h, fill) {
    c.fillStyle = fill;
    c.fillRect(x, y, w, h);
    c.strokeStyle = ink; c.lineWidth = 1.3; c.strokeRect(x, y, w, h);
  }
  function floor(c, color) {
    c.beginPath(); c.ellipse(0, 4, 24, 19, 0, 0, Math.PI * 2);
    c.fillStyle = color; c.fill(); c.strokeStyle = ink; c.lineWidth = 1.4; c.stroke();
  }

  BASE_R.student_fieldpay = 29;
  A.BASES.student_fieldpay = (c, look) => {
    floor(c, "#7d7148");
    for (const x of [-14, -7, 0]) {
      c.strokeStyle = "#d7c981"; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(x, -9); c.lineTo(x - 4, 10); c.stroke();
      c.strokeStyle = "#b8a063"; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x + 2, -8); c.lineTo(x - 2, 11); c.stroke();
    }
    block(c, 5, -12, 13, 12, "#af8d5f");
    block(c, 5, -10, 13, 2, brass);
    block(c, 7, 2, 10, 8, "#96764c");
    if (look.studentForm === "fieldpay_market") { block(c, 9, 10, 8, 4, brass); block(c, -2, 10, 9, 5, "#ad8a52"); }
  };
  BASE_R.student_repairpost = 30;
  A.BASES.student_repairpost = (c, look) => {
    floor(c, "#665f46");
    block(c, -15, -13, 27, 27, "#7f9c84");
    block(c, -17, -14, 30, 5, "#b5c69d");
    c.fillStyle = "#f6edda";
    c.fillRect(-5, -5, 4, 13); c.fillRect(-10, -1, 14, 4);
    block(c, 14, 0, 7, 10, "#af8d5f");
    if (look.studentForm === "repairpost_crew") block(c, -20, 0, 6, 9, brass);
  };
  BASE_R.student_dispatch = 30;
  A.BASES.student_dispatch = (c, look) => {
    floor(c, "#746a54");
    block(c, -15, -13, 27, 20, "#496d6b");
    block(c, -17, -14, 31, 5, "#7ea09a");
    c.strokeStyle = mint; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(-11, 1); c.lineTo(6, 1);
    c.moveTo(1, -4); c.lineTo(6, 1); c.lineTo(1, 6); c.stroke();
    block(c, -10, 10, 9, 6, "#aa8e61");
    block(c, 2, 10, 8, 6, "#806740");
    if (look.studentForm === "dispatch_air") {
      c.fillStyle = brass;
      c.fillRect(-2, -11, 2, 8); c.fillRect(-6, -8, 10, 2);
    } else if (look.studentForm === "dispatch_patrol") {
      c.fillStyle = brass;
      for (const x of [-9, -3, 3]) c.fillRect(x, -10, 3, 3);
    }
  };
  W.student_noop = () => {};

  // Reuse the original animation art for the new encounters and add a distinct status plate.
  const kinds = BK.STUDENT_BOSSES;
  for (const key of ["enemyFast", "enemy", "shadow"]) {
    const old = A[key];
    A[key] = function (c, e, ...args) {
      return old.call(this, c, kinds[e.kind] ? Object.assign({}, e, { kind: kinds[e.kind] }) : e, ...args);
    };
  }
  const oldIcon = A.enemyIcon;
  A.enemyIcon = function (kind, size) { return oldIcon.call(this, kinds[kind] || kind, size); };
  const oldStatus = RP.drawStatus;
  RP.drawStatus = function (c, e) {
    oldStatus.call(this, c, e);
    if (!kinds[e.kind]) return;
    const y = e.y - (e.air ? 47 : e.def.kind === "foot" ? 29 : 44);
    c.save(); c.translate(e.x, y);
    c.fillStyle = "#2a2320"; c.fillRect(-19, -3, 38, 6);
    c.fillStyle = "#e7ac58"; c.fillRect(-17, -1, 34 * BK.clamp(e.hp / e.maxHp, 0, 1), 2);
    c.fillStyle = "#eccf87"; c.beginPath();
    c.moveTo(-26, -5); c.lineTo(-22, 0); c.lineTo(-26, 5); c.lineTo(-30, 0); c.closePath(); c.fill();
    c.restore();
  };

  function allied(c, u) {
    const bomber = u.kind === "bomber";
    c.save(); c.translate(u.x, u.y - (bomber ? 14 : 0)); c.rotate(u.ang);
    if (bomber) {
      c.beginPath();
      for (const [x, y] of [[23,0], [13,-5], [2,-5], [-5,-23], [-12,-24], [-9,-6], [-20,-4], [-26,-11],
        [-32,-10], [-28,0], [-32,10], [-26,11], [-20,4], [-9,6], [-12,24], [-5,23], [2,5], [13,5]]) c.lineTo(x, y);
      c.closePath(); c.fillStyle = "#4c807c"; c.fill(); c.strokeStyle = ink; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = mint; c.fillRect(-4, -20, 3, 9); c.fillRect(-4, 11, 3, 9);
      c.fillStyle = "#d4eee3"; c.fillRect(9, -2, 5, 4);
    } else if (u.kind === "patrol") {
      const t = Math.sin(u.age * 16) * 2.5;
      for (const [x, y] of [[-6,-8], [0,0], [-6,8]]) {
        c.save(); c.translate(x, y); c.rotate(t * 0.12);
        block(c, -4, -4, 8, 8, "#5a8f83");
        c.fillStyle = mint; c.fillRect(2, -1.5, 3, 3);
        c.restore();
      }
    } else {
      block(c, -10, -8, 18, 16, "#596d5a");
      block(c, -7, -6, 13, 12, "#6c9a86");
      c.fillStyle = ink;
      for (const x of [-9, 5]) { c.fillRect(x, -10, 5, 3); c.fillRect(x, 7, 5, 3); }
      c.fillStyle = mint; c.fillRect(6, -5, 2, 10);
    }
    c.strokeStyle = mint; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-5, -4); c.lineTo(0, 0); c.lineTo(-5, 4); c.stroke();
    if (u.flash > 0) {
      c.fillStyle = brass; c.beginPath(); c.arc(bomber ? 3 : 11, 0, 3, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
  const oldHandle = RP.handle;
  RP.handle = function (ev) {
    if (ev.type !== "studentBurst") return oldHandle.call(this, ev);
    if (this.fx) this.fx.rings.push({ x: ev.x, y: ev.y, r: 4, max: 26, life: 0.38, age: 0, w: 2 });
  };
  const oldOverlay = RP.drawOverlay;
  RP.drawOverlay = function (c, v) {
    const bounds = this.viewRect(40);
    for (const u of this.g.studentAllies || []) {
      if (u.x >= bounds.x0 && u.x <= bounds.x1 && u.y >= bounds.y0 && u.y <= bounds.y1) allied(c, u);
    }
    return oldOverlay.call(this, c, v);
  };
})(typeof window !== "undefined" ? window : globalThis);
