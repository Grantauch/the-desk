/* Blacktop Kings — animated ballers drawn from canvas shapes, with optional generated fabric detail.
   Coordinates inside a body are feet, origin at the feet, +x the way the player faces, +y up.
   BK.art.pose(kind, opts) builds joint targets; BK.art.drawBaller(ctx, o) draws them. */
(function (BK) {
  'use strict';
  const A = BK.art = BK.art || {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const TAU = Math.PI * 2;

  function shade(hex, amt) {
    if (!hex || hex[0] !== '#') return hex;
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; } else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  }
  function luminance(hex) {
    const n = parseInt((hex || '#000000').slice(1), 16);
    return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  }
  A.shade = shade; A.luminance = luminance; A.clamp = clamp; A.lerp = lerp;

  const DEFAULT_LOOK = {
    skin: '#8d5524', hair: 'fade', hairColor: '#141010', facial: 'none', brows: 'normal', eyes: 'normal', mouth: 'flat',
    headband: 'none', headbandColor: '#ffffff', eyewear: 'none', armSleeve: 'none', sleeveColor: '#0b0b0d', kneeSleeve: 'none',
    wristbands: 'none', socks: 'crew', sockColor: '#ffffff', shoes: 'high', shoeColor: '#ffffff', shoeAccent: '#e8352b', chain: 'none',
    tattoo: 'none', jersey: 'tank', shorts: 'mid', aura: 'none', trail: 'none',
  };
  A.DEFAULT_LOOK = DEFAULT_LOOK;
  A.fullLook = (look) => Object.assign({}, DEFAULT_LOOK, look || {});

  // ---------- body measurements ----------
  // Stylized athlete proportions, in feet, measured from the approved character model sheet: a long
  // torso and neck, a head a little larger than the sheet's so faces still read at game size, lean
  // arms, and chunky high-top sneakers. u scales everything to the player's height.
  // sw/ww/hw: shoulder, waist, and hip width as seen in the three-quarter view.
  const BUILD = {
    lean: { sw: 1.6, ww: 0.92, hw: 1.0, arm: 0.155, thigh: 0.25, calf: 0.18, belly: 0, neck: 0.18 },
    athletic: { sw: 1.82, ww: 1.03, hw: 1.1, arm: 0.18, thigh: 0.29, calf: 0.21, belly: 0, neck: 0.22 },
    strong: { sw: 2.02, ww: 1.14, hw: 1.18, arm: 0.215, thigh: 0.33, calf: 0.235, belly: 0.03, neck: 0.26 },
    heavy: { sw: 1.96, ww: 1.5, hw: 1.4, arm: 0.21, thigh: 0.37, calf: 0.26, belly: 0.16, neck: 0.27 },
  };
  A.dims = function (hgtIn, build) {
    const H = (hgtIn || 76) / 12;
    const b = BUILD[build] || BUILD.athletic;
    const u = H / 6.5;
    return {
      H, b, u, k: u,
      foot: 0.34 * u, thigh: 1.6 * u, shin: 1.36 * u, leg: 2.96 * u,
      torso: 2.12 * u, neck: 0.3 * u, headR: Math.max(0.33, 0.37 * Math.pow(u, 0.6)),
      upper: 1.1 * u, fore: 0.98 * u,
      sw: b.sw * u, ww: b.ww * u, hw: b.hw * u,
      armR: b.arm * u, thighR: b.thigh * u, calfR: b.calf * u, belly: b.belly * u, neckR: b.neck * u,
      // older names some callers still read
      chestW: b.sw * u, armW: b.arm * 2 * u, thighW: b.thigh * 2 * u, shinW: b.calf * 2 * u,
    };
  };

  // ---------- two-bone IK ----------
  function ik(rx, ry, tx, ty, a, b, sign) {
    let dx = tx - rx, dy = ty - ry; let d = Math.hypot(dx, dy) || 0.0001;
    const dc = clamp(d, Math.abs(a - b) + 0.01, a + b - 0.002);
    const base = Math.atan2(dy, dx);
    const cosA = clamp((a * a + dc * dc - b * b) / (2 * a * dc), -1, 1);
    const ang = base + sign * Math.acos(cosA);
    return { jx: rx + Math.cos(ang) * a, jy: ry + Math.sin(ang) * a, ex: rx + Math.cos(base) * dc, ey: ry + Math.sin(base) * dc };
  }

  // ---------- skeleton anchors ----------
  // The poses and the drawing share these, so a pose can place a hand relative to its own shoulder.
  // The torso is drawn turned three-quarters toward the camera, like the model sheet: the near arm
  // (F, drawn in front, the one that handles the ball) hangs from the back edge of the chest and the
  // far arm (B, drawn behind) from the front edge. Raising the near arm rolls its shoulder forward
  // and up (P.roll, 0..1), so a shot or a dunk reaches past the face instead of across it.
  function frame(P, d) {
    const lean = P.lean || 0, pel = P.pelvis, roll = P.roll || 0;
    const ux = Math.sin(lean), uy = Math.cos(lean), nx = Math.cos(lean), ny = -Math.sin(lean);
    const TP = (a, c) => [pel[0] + ux * a + nx * c, pel[1] + uy * a + ny * c];
    return { TP, ux, uy, nx, ny, shF: TP(d.torso * lerp(0.87, 0.93, roll), d.sw * lerp(-0.32, 0.04, roll)), shB: TP(d.torso * 0.88, d.sw * 0.36) };
  }
  A.shoulders = (P, d) => { const f = frame(P, d); return { F: f.shF, B: f.shB }; };
  // Where a drawn hand really ends up once the arm's length is applied, and which way the palm points.
  A.armEnd = function (P, d, front) {
    const f = frame(P, d); const sh = front ? f.shF : f.shB; const h = front ? P.handF : P.handB;
    const q = ik(sh[0], sh[1], h[0], h[1], d.upper, d.fore, (front ? P.armF : P.armB) || -1);
    const a = Math.atan2(q.ey - q.jy, q.ex - q.jx) + ((front ? P.wristF : P.wristB) || 0);
    return { x: q.ex, y: q.ey, dx: Math.cos(a), dy: Math.sin(a), elbow: [q.jx, q.jy], shoulder: sh };
  };
  // How high a standing player's fingertips reach with the arm straight up.
  A.handReach = (d) => d.foot + d.leg * 0.995 + d.torso * 0.86 + (d.upper + d.fore) * 0.97 + d.armR;
  // Running: the share of each stride a foot spends planted. Faster strides spend less.
  A.runDuty = (speed) => lerp(0.44, 0.31, clamp(speed, 0, 1));
  const smooth = (k) => k * k * (3 - 2 * k);

  // ---------- poses ----------
  // Every pose returns: pelvis [x,y], lean (rad, + forward), tilt (head), footF/footB, handF/handB,
  // armF/armB (elbow bend: -1 folds the elbow the natural way; +1 only for an elbow thrown out behind
  // the body, like the near arm of a double-biceps flex), legF/legB (+1, knees forward), optional
  // wristF/wristB (radians) and toe (radians, negative points the toes down in the air). Hands are
  // written relative to their own shoulder, so leaning or crouching never twists an arm. The poses
  // follow the approved model sheet: low, wide defense and dribbling, a committed sprint, a high set
  // point with the guide hand dropping on the follow-through.
  A.pose = function (kind, o) {
    o = o || {};
    const d = o.dims; const t = o.t || 0; const time = o.time || 0; const u = d.u;
    const stand = d.foot + d.leg * 0.995;
    const R = d.upper + d.fore;
    const P = { pelvis: [0, stand], lean: 0.04, tilt: 0, footF: [0.32, 0], footB: [-0.28, 0], handF: [0.25, stand * 0.92], handB: [-0.18, stand * 0.92], armF: -1, armB: -1, legF: 1, legB: 1 };
    const bob = Math.sin(time * 3.2) * 0.03;
    // hand helpers, valid once pelvis and lean are set
    const S = () => frame(P, d);
    const rel = (s, x, y) => [s[0] + x * u, s[1] + y * u];
    const polar = (s, deg, k) => { const a = deg * Math.PI / 180; return [s[0] + Math.cos(a) * R * k, s[1] + Math.sin(a) * R * k]; };
    switch (kind) {
      case 'idle': {
        // athletic stance: knees soft, feet apart, arms hanging loose at the sides
        P.pelvis = [0, stand - 0.07 * u + bob * 0.35]; P.lean = 0.07;
        P.footF = [0.62 * u, 0]; P.footB = [-0.42 * u, 0];
        const s = S();
        P.handF = rel(s.shF, 0.2, -1.9 + bob * 0.4); P.handB = rel(s.shB, 0.15, -1.9 + bob * 0.4);
        break;
      }
      case 'hold': {
        // triple threat: ball on the near hip, the far hand over the front of it
        P.pelvis = [0, stand - 0.18 * u + bob * 0.3]; P.lean = 0.2;
        P.footF = [0.75 * u, 0]; P.footB = [-0.5 * u, 0];
        const s = S();
        P.handF = rel(s.shF, 0.9, -1.55); P.handB = rel(s.shB, 0.15, -1.35);
        break;
      }
      case 'dribble': {
        // live dribble standing still: low and wide, the off arm out front as a bar
        P.pelvis = [0, stand - d.leg * 0.31 + bob * 0.4]; P.lean = 0.46;
        P.footF = [0.95 * u, 0]; P.footB = [-0.8 * u, 0];
        const s = S(); P.handF = rel(s.shF, 0.9, -1.75); P.handB = rel(s.shB, 1.0, -1.25);
        break;
      }
      case 'card': {
        // trading-card pose: ball on the near hip, the other hand at the side
        P.pelvis = [0, stand - 0.025]; P.lean = -0.025; P.tilt = 0.04;
        P.footF = [0.38, 0]; P.footB = [-0.32, 0];
        const s = S(); P.handF = rel(s.shF, 0.78, -1.6); P.handB = rel(s.shB, 0.2, -1.88);
        break;
      }
      case 'defend': {
        // deep and wide: the near hand low in front, the far arm long and high to bother the look
        const slide = Math.sin(time * 9) * 0.05, w = Math.sin(time * 5) * 0.12;
        P.pelvis = [0, stand - d.leg * 0.33 + bob]; P.lean = 0.44;
        P.footF = [1.05 * u + slide, 0]; P.footB = [-0.95 * u + slide, 0];
        const s = S();
        P.handF = rel(s.shF, 1.15, -1.7 - w); P.handB = rel(s.shB, 1.7, 0.5 + w);
        break;
      }
      case 'slide': {
        // defensive shuffle: low and wide, feet step apart and back together, never cross
        const ph = o.phase || 0, sp = clamp(o.speed == null ? 1 : o.speed, 0, 1.3);
        const s1 = Math.sin(ph), c1 = Math.cos(ph), w = Math.sin(time * 6) * 0.1;
        P.pelvis = [0, stand - d.leg * 0.31 - Math.abs(s1) * 0.05 * u]; P.lean = 0.42;
        const open = 0.24 * u * sp * c1;
        P.footF = [1.0 * u + open, Math.max(0, s1) * 0.12 * u * sp]; P.footB = [-0.9 * u - open, Math.max(0, -s1) * 0.12 * u * sp];
        const s = S();
        P.handF = rel(s.shF, 1.2, -1.6 - w); P.handB = rel(s.shB, 1.6, 0.25 + w);
        break;
      }
      case 'run': poseRun(P, d, o); break;
      case 'crouch': {
        P.pelvis = [0, stand - d.leg * 0.3]; P.lean = 0.35; P.footF = [0.45, 0]; P.footB = [-0.35, 0];
        const s = S(); P.handF = rel(s.shF, 1.0, -1.4); P.handB = rel(s.shB, 0.3, -1.3);
        break;
      }
      case 'jumpshot': {
        // t: 0 gather -> 0.18 takeoff -> ~0.55 release at the top -> 1 land
        const crouch = t < 0.18 ? Math.sin(t / 0.18 * Math.PI) * 0.22 : 0;
        P.pelvis = [0, stand - d.leg * crouch]; P.lean = lerp(0.2, -0.03, smooth(clamp((t - 0.08) / 0.16, 0, 1))); P.tilt = 0.14;
        const air = t > 0.16 && t < 0.94;
        if (air) { P.footF = [0.25 * u, P.pelvis[1] - d.leg * 0.93]; P.footB = [-0.05 * u, P.pelvis[1] - d.leg * 0.95]; P.toe = -0.55; }
        else { P.footF = [0.42 * u, 0]; P.footB = [-0.24 * u, 0]; }
        const s = S();
        if (o.released) {
          // follow through: shooting arm long toward the rim, wrist snapped down, guide hand dropped
          P.roll = 1; const s2 = S();
          const follow = o.releaseBlend == null ? 1 : smooth(o.releaseBlend);
          P.handF = lerpPt(rel(s2.shF, 0.55, 1.55), polar(s2.shF, 70, 0.97), follow);
          P.handB = lerpPt(rel(s2.shB, -0.35, 1.75), rel(s2.shB, 0.3, -1.75), follow); P.wristF = -1.25 * follow;
        } else {
          // the ball rises from the chest to the set point over the forehead, elbow out in front of the face
          const k = smooth(clamp((t - 0.1) / 0.32, 0, 1));
          P.roll = k; const s2 = S();
          P.handF = lerpPt(rel(s.shF, 1.0, -0.8), rel(s2.shF, 0.55, 1.55), k);
          P.handB = lerpPt(rel(s.shB, -0.1, -0.75), rel(s2.shB, -0.35, 1.75), k);
          P.wristF = lerp(0, 0.25, k);
        }
        break;
      }
      case 'layup': {
        P.pelvis = [0, stand]; P.lean = lerp(0.12, -0.06, clamp(t, 0, 1)); P.tilt = 0.22; P.toe = -0.45;
        // knee drive on the near leg, the trail leg hangs long
        P.footF = [0.55 * u, P.pelvis[1] - d.leg * 0.52]; P.footB = [-0.3 * u, P.pelvis[1] - d.leg * 0.97];
        const s = S(); const k = smooth(clamp(t * 1.9, 0, 1));
        P.roll = k; const s2 = S();
        P.handF = lerpPt(rel(s.shF, 1.0, -0.7), polar(s2.shF, 70, 0.97), k);
        P.handB = lerpPt(rel(s.shB, -0.1, -0.7), rel(s.shB, 0.4, -1.5), k);
        P.wristF = lerp(0.35, -0.45, clamp((t - 0.42) * 3, 0, 1));
        break;
      }
      case 'dunk': {
        poseDunk(P, d, t, o.style || 'twohand', stand, o.rim);
        break;
      }
      case 'hang': {
        P.pelvis = [0, stand]; P.lean = -0.1; P.tilt = 0.25; P.toe = -0.5; P.roll = 1;
        const sw = Math.sin(time * 6) * 0.22;
        P.footF = [(0.35 + sw) * u, P.pelvis[1] - d.leg * 0.86]; P.footB = [(0.05 + sw * 0.7) * u, P.pelvis[1] - d.leg * 0.9];
        const s = S();
        P.handF = o.rim ? o.rim : polar(s.shF, 72, 0.97);
        P.handB = o.rim ? [o.rim[0] + 0.45 * u, o.rim[1]] : polar(s.shB, 88, 0.97);
        break;
      }
      case 'block': {
        P.pelvis = [0, stand]; P.lean = -0.06; P.tilt = 0.3; P.toe = -0.45; P.roll = 1;
        P.footF = [0.3 * u, P.pelvis[1] - d.leg * 0.86]; P.footB = [-0.14 * u, P.pelvis[1] - d.leg * 0.93];
        const s = S(), swat = o.swat || 0;
        P.handF = polar(s.shF, lerp(80, 36, swat), 0.97); P.handB = polar(s.shB, 96, 0.95); P.wristF = -0.9 * swat;
        break;
      }
      case 'rebound': {
        P.pelvis = [0, stand]; P.lean = 0.02; P.tilt = 0.35; P.toe = -0.4; P.roll = 1;
        P.footF = [0.28 * u, P.pelvis[1] - d.leg * 0.82]; P.footB = [-0.2 * u, P.pelvis[1] - d.leg * 0.86];
        const s = S(); P.handF = polar(s.shF, 76, 0.96); P.handB = polar(s.shB, 100, 0.96);
        break;
      }
      case 'steal': {
        // a quick lunge: the near hand stabs at the ball, the far arm swings back for balance
        const k = Math.sin(clamp(t, 0, 1) * Math.PI);
        P.pelvis = [0.1 * k * u, stand - d.leg * 0.24 * k]; P.lean = 0.18 + 0.38 * k; P.roll = 0.6 * k;
        P.footF = [(0.55 + 0.6 * k) * u, 0]; P.footB = [-0.5 * u, 0];
        const s = S();
        P.handF = lerpPt(rel(s.shF, 0.9, -1.6), rel(s.shF, 2.0, -0.9), k); P.handB = rel(s.shB, -0.9, -1.5);
        break;
      }
      case 'pass': {
        // the chest pass: a quick two-hand push, thumbs turning down, then the arms come back
        const k = t < 0.3 ? smooth(t / 0.3) : 1 - smooth((clamp(t, 0, 1) - 0.3) / 0.7);
        P.pelvis = [0, stand - 0.08 * u]; P.lean = 0.12 + 0.12 * k; P.roll = 0.4 * k;
        P.footF = [(0.65 + 0.2 * k) * u, 0]; P.footB = [-0.35 * u, 0];
        const s = S();
        P.handF = lerpPt(rel(s.shF, 1.0, -0.75), rel(s.shF, 2.0, -0.5), k);
        P.handB = lerpPt(rel(s.shB, -0.15, -0.8), rel(s.shB, 0.9, -0.55), k);
        P.wristF = -0.6 * k;
        break;
      }
      case 'catch': {
        const secure = smooth(clamp(t, 0, 1));
        P.pelvis = [0, stand - (0.12 + (o.rebound ? 0.1 : 0)) * u]; P.lean = 0.12; P.roll = 0.35;
        P.footF = [0.6 * u, 0]; P.footB = [-0.38 * u, 0];
        const s = S();
        P.handF = lerpPt(rel(s.shF, 1.7, o.rebound ? 0.4 : -0.5), rel(s.shF, 1.05, -0.95), secure);
        P.handB = lerpPt(rel(s.shB, 0.8, o.rebound ? 0.45 : -0.45), rel(s.shB, 0.35, -0.9), secure);
        break;
      }
      case 'stumble': {
        const w = Math.sin(time * 18);
        P.pelvis = [-0.2 * u, stand - 0.25 * u]; P.lean = -0.35 + w * 0.1; P.tilt = -0.3;
        P.footF = [(0.35 + w * 0.2) * u, 0]; P.footB = [(-0.2 - w * 0.2) * u, 0.05];
        // arms wheel for balance
        const s = S(); P.handF = polar(s.shF, 150 - w * 30, 0.9); P.handB = polar(s.shB, 55 + w * 30, 0.9);
        break;
      }
      case 'fallen': {
        // sat down hard, propped up on both hands behind
        P.pelvis = [-0.35, 0.42]; P.lean = -0.65;
        P.footF = [1.9, 0.08]; P.footB = [1.55, 0.2];
        P.handF = [-1.25, 0.15]; P.handB = [-0.95, 0.12]; P.tilt = -0.45;
        break;
      }
      case 'celebrate': poseCelebrate(P, d, o.style || 'flex', time, stand); break;
      case 'trick': poseTrick(P, d, o.style || 'cross', t, stand); break;
      case 'walk': {
        const ph = o.phase || 0;
        P.pelvis = [0, stand - Math.abs(Math.sin(ph)) * 0.05];
        P.footF = [Math.cos(ph) * 0.45, Math.max(0, Math.sin(ph)) * 0.2]; P.footB = [Math.cos(ph + Math.PI) * 0.45, Math.max(0, Math.sin(ph + Math.PI)) * 0.2];
        const s = S(); P.handF = rel(s.shF, 0.25 - Math.cos(ph) * 0.35, -1.9); P.handB = rel(s.shB, 0.1 + Math.cos(ph) * 0.35, -1.9);
        break;
      }
      default: break;
    }
    // coming down from the air: the knees give for a moment and the arms drop with the body
    if (o.land) {
      const k = o.land * u;
      P.pelvis = [P.pelvis[0], P.pelvis[1] - 0.4 * k]; P.lean += 0.16 * o.land;
      P.handF = [P.handF[0], P.handF[1] - 0.3 * k]; P.handB = [P.handB[0], P.handB[1] - 0.3 * k];
    }
    if (o.plant && ['run', 'slide', 'dribble'].includes(kind)) {
      P.pelvis[1] -= 0.1 * u * o.plant;
      P.lean -= 0.12 * o.plant;
    }
    if (o.contact) {
      P.pelvis[0] -= 0.16 * u * o.contact;
      P.lean -= 0.22 * o.contact; P.tilt -= 0.12 * o.contact;
    }
    // The game can put a hand on the ball. A dribbling hand reaches as far toward the ball as the arm
    // allows (o.ballClamp); otherwise a hand only follows the ball while it is within reach, so a juggle
    // or a bounce off somebody's head never stretches the arm out like a stick.
    if (o.ballHand || o.ballHandB) {
      const s = S();
      const follow = (hand, target, sh) => {
        const dx = target[0] - sh[0], dy = target[1] - sh[1], dist = Math.hypot(dx, dy);
        if (o.ballClamp) { const k = Math.min(1, R * 0.97 / (dist || 1)); return [sh[0] + dx * k, sh[1] + dy * k]; }
        const w = clamp((R * 1.1 - dist) / (R * 0.22), 0, 1);
        return w >= 1 ? target : lerpPt(hand, target, w);
      };
      if (o.ballHand) P.handF = follow(P.handF, o.ballHand, s.shF);
      if (o.ballHandB) P.handB = follow(P.handB, o.ballHandB, s.shB);
    }
    return P;
  };

  // Blend two poses (for smooth changes between animations). Elbow and knee directions come from b.
  A.mixPose = function (a, b, k) {
    if (!a || k >= 1) return b;
    const m = Object.assign({}, b);
    m.pelvis = lerpPt(a.pelvis, b.pelvis, k); m.lean = lerp(a.lean || 0, b.lean || 0, k); m.tilt = lerp(a.tilt || 0, b.tilt || 0, k);
    m.footF = lerpPt(a.footF, b.footF, k); m.footB = lerpPt(a.footB, b.footB, k);
    m.handF = lerpPt(a.handF, b.handF, k); m.handB = lerpPt(a.handB, b.handB, k);
    m.wristF = lerp(a.wristF || 0, b.wristF || 0, k); m.wristB = lerp(a.wristB || 0, b.wristB || 0, k);
    m.toe = lerp(a.toe || 0, b.toe || 0, k); m.roll = lerp(a.roll || 0, b.roll || 0, k);
    return m;
  };

  // A running stride. Each foot spends the first part of its cycle planted and sliding back under the
  // hips at running speed (o.stride is half that slide, in feet, so the shoe stays put on the court),
  // then swings through: heel up behind, knee driving forward, foot down ahead. Arms pump opposite:
  // at full speed the front fist comes up near the chin and the back elbow drives up behind.
  function poseRun(P, d, o) {
    const u = d.u, sp = clamp(o.speed == null ? 1 : o.speed, 0, 1.7), k01 = clamp(sp, 0, 1);
    const duty = A.runDuty(sp);
    const Lh = clamp(o.stride != null ? o.stride : (0.45 + 0.62 * k01) * u, 0.16 * u, 1.35 * u);
    const lift = (0.35 + 0.7 * k01) * u;
    const legL = (d.thigh + d.shin) * 0.985;
    const h = Math.sqrt(Math.max(1, legL * legL - Lh * Lh));
    const bobA = (0.04 + 0.07 * k01) * u;
    const cyc = (((o.phase || 0) / TAU) % 1 + 1) % 1;
    // lowest through each footfall, highest in the air between them
    P.pelvis = [0, d.foot + h - 0.08 * u - bobA - bobA * Math.cos(4 * Math.PI * (cyc - duty / 2))];
    P.lean = 0.12 + 0.33 * k01 + clamp((o.accel || 0) / 150, -0.12, 0.16);
    P.tilt = 0.04;
    const foot = (c, hx) => {
      if (c < duty) return [hx + Lh * (1 - 2 * c / duty), 0];
      const k = (c - duty) / (1 - duty);
      return [hx - Lh + 2 * Lh * smooth(k), lift * Math.pow(Math.sin(Math.PI * k), 0.85) * (1 - 0.3 * k)];
    };
    P.footF = foot(cyc, 0.24 * u); P.footB = foot((cyc + 0.5) % 1, -0.22 * u);
    const a = -Math.cos(TAU * cyc) * lerp(0.45, 1, k01);
    P.roll = 0.3 * Math.max(0, a);
    const s = frame(P, d);
    const hand = (sh, v) => [sh[0] + (0.15 + (v > 0 ? 1.3 : 0.92) * v) * u, sh[1] + (-1.65 + (v > 0 ? 1.3 * v : -0.68 * v)) * u];
    P.handF = hand(s.shF, a); P.handB = hand(s.shB, -a);
  }

  function poseDunk(P, d, t, style, stand, rim) {
    // t 0..1 across the whole flight; the slam lands at ~0.78
    const u = d.u, R = d.upper + d.fore;
    P.pelvis = [0, stand]; P.lean = 0.06; P.tilt = 0.2; P.toe = -0.5;
    const rise = clamp(t / 0.6, 0, 1);
    // the near knee drives up to about hip height; the trail leg hangs long behind
    P.footF = [lerp(0.35, 0.68, rise) * u, P.pelvis[1] - d.leg * lerp(0.9, 0.48, rise)];
    P.footB = [lerp(-0.18, -0.55, rise) * u, P.pelvis[1] - d.leg * 0.97];
    const slam = smooth(clamp((t - 0.68) / 0.12, 0, 1));
    const chestF = (() => { const s0 = frame(P, d); return [s0.shF[0] + 1.0 * u, s0.shF[1] - 0.6 * u]; })();
    const up = smooth(rise);
    P.roll = style === 'windmill' || style === 'eclipse' || style === 'cradle' ? 0.5 : style === 'legs' && t < 0.6 ? 0.2 : up;
    const s = frame(P, d);
    const at = (sh, deg, k) => { const a = deg * Math.PI / 180; return [sh[0] + Math.cos(a) * R * k, sh[1] + Math.sin(a) * R * k]; };
    switch (style) {
      case 'tomahawk': {
        // one hand cocked way back behind the head, then whipped over the top
        P.handF = slam > 0 ? at(s.shF, lerp(140, 36, slam), 0.97) : lerpPt(chestF, at(s.shF, 140, 0.97), up);
        P.handB = [s.shB[0] + 0.6 * u, s.shB[1] - 1.3 * u];
        P.lean = lerp(-0.12, 0.22, slam);
        break;
      }
      case 'windmill': case 'eclipse': {
        // straight arm: down, back, up and over the top
        const k = clamp(t / 0.78, 0, 1);
        P.handF = at(s.shF, -55 - (style === 'eclipse' ? 640 : 280) * k, 0.97);
        P.handB = [s.shB[0] + 0.5 * u, s.shB[1] - 1.4 * u];
        if (style === 'eclipse') { P.footF = [0.6 * u, P.pelvis[1] - d.leg * 0.42]; P.footB = [0, P.pelvis[1] - d.leg * 0.5]; }
        break;
      }
      case 'reverse': {
        // up overhead, then thrown back over the head as the body turns away from the rim
        P.handF = slam > 0 ? at(s.shF, lerp(85, 150, slam), lerp(0.94, 0.97, slam)) : lerpPt(chestF, at(s.shF, 85, 0.94), up);
        P.handB = [P.handF[0] + 0.28 * u, P.handF[1]];
        P.lean = -0.2;
        break;
      }
      case 'cradle': {
        // rock the ball low and back, then sweep it all the way over the top
        const a = t < 0.45 ? lerp(-60, -150, smooth(t / 0.45)) : lerp(-150, -325, smooth(clamp((t - 0.45) / 0.33, 0, 1)));
        P.handF = at(s.shF, a, t < 0.45 ? 0.95 : 0.97);
        P.handB = [s.shB[0] + 0.3 * u, s.shB[1] - 1.2 * u];
        break;
      }
      case 'legs': {
        // pass it under the legs with both knees tucked, bring it back up, slam
        const under = [0.05 * u, P.pelvis[1] - 0.15 * u];
        if (t < 0.2) P.handF = chestF;
        else if (t < 0.42) P.handF = lerpPt(chestF, under, smooth((t - 0.2) / 0.22));
        else if (t < 0.66) P.handF = lerpPt(under, at(s.shF, 110, 0.93), smooth((t - 0.42) / 0.24));
        else P.handF = at(s.shF, lerp(110, 36, slam), lerp(0.93, 0.97, slam));
        P.handB = t > 0.22 && t < 0.5 ? [0.15 * u, P.pelvis[1] - 0.25 * u] : [s.shB[0] + 0.45 * u, s.shB[1] - 0.9 * u];
        if (t > 0.15 && t < 0.62) { P.footF = [0.8 * u, P.pelvis[1] - d.leg * 0.42]; P.footB = [0.25 * u, P.pelvis[1] - d.leg * 0.48]; }
        break;
      }
      case 'spin360': default: {
        // both hands take it up behind the head, then hammer it forward
        P.handF = slam > 0 ? at(s.shF, lerp(100, 40, slam), lerp(0.94, 0.97, slam)) : lerpPt(chestF, at(s.shF, 100, 0.94), up);
        P.handB = [P.handF[0] + 0.25 * u, P.handF[1] + 0.05 * u];
        P.lean = lerp(-0.1, 0.2, slam);
        break;
      }
    }
    // the slamming hand finishes on the rim when the game knows where it is
    if (rim && t > 0.66) {
      const w = smooth(clamp((t - 0.68) / 0.1, 0, 1));
      const hb = [P.handB[0] - P.handF[0], P.handB[1] - P.handF[1]];
      P.handF = lerpPt(P.handF, rim, w);
      if (style !== 'tomahawk' && style !== 'windmill' && style !== 'eclipse' && style !== 'cradle') P.handB = [P.handF[0] + hb[0], P.handF[1] + hb[1]];
    }
    if (t > 0.86) { // hanging after the slam
      P.handF = rim || at(s.shF, 72, 0.97); P.handB = rim ? [rim[0] + 0.45 * u, rim[1]] : at(s.shB, 88, 0.97);
      P.footF = [0.4 * u, P.pelvis[1] - d.leg * 0.85]; P.footB = [0.05 * u, P.pelvis[1] - d.leg * 0.9];
    }
  }

  function poseCelebrate(P, d, style, time, stand) {
    const u = d.u, R = d.upper + d.fore;
    const beat = Math.sin(time * 9);
    P.lean = -0.05; P.tilt = 0.15;
    P.footF = [0.45 * u, 0]; P.footB = [-0.35 * u, 0];
    let s = frame(P, d);
    const rel = (sh, x, y) => [sh[0] + x * u, sh[1] + y * u];
    const at = (sh, deg, k) => { const a = deg * Math.PI / 180; return [sh[0] + Math.cos(a) * R * k, sh[1] + Math.sin(a) * R * k]; };
    const hangB = rel(s.shB, 0.2, -1.9);
    switch (style) {
      case 'chest': {
        // pounding the chest
        P.tilt = 0.4; s = frame(P, d);
        P.handF = beat > 0.3 ? rel(s.shF, 0.7, -0.45) : rel(s.shF, 0.45, -0.35); P.handB = rel(s.shB, 0.2, -1.9); break;
      }
      case 'shush': { P.lean = 0.15; P.tilt = -0.05; P.roll = 0.5; s = frame(P, d); P.handF = rel(s.shF, 0.95, 0.7); P.handB = rel(s.shB, 0.2, -1.9); break; }
      case 'roof': { const k = (beat + 1) / 2; P.tilt = 0.35; P.roll = 0.8; s = frame(P, d); P.handF = rel(s.shF, 0.9, 1.2 + 0.55 * k); P.handB = rel(s.shB, -0.3, 1.2 + 0.55 * k); break; }
      case 'point': { P.tilt = 0.5; P.roll = 1; s = frame(P, d); P.handF = at(s.shF, 75, 0.97); P.handB = hangB; break; }
      case 'shoulders': {
        // brushing the dirt off the far shoulder
        const k = (beat + 1) / 2; P.lean = -0.12; P.tilt = 0.25; s = frame(P, d);
        P.handF = lerpPt(rel(s.shF, 1.15, 0.08), rel(s.shF, 1.3, -0.2), k); P.handB = rel(s.shB, 0.2, -1.9); break;
      }
      case 'dance': {
        const st = Math.sin(time * 7);
        P.pelvis = [st * 0.12, stand - 0.15 - Math.abs(st) * 0.08]; P.footF = [0.45 + st * 0.3, Math.max(0, st) * 0.3]; P.footB = [-0.35 + st * 0.3, Math.max(0, -st) * 0.3];
        s = frame(P, d);
        P.handF = rel(s.shF, 0.9 + st * 0.4, -0.95 + Math.abs(st) * 0.5); P.handB = rel(s.shB, 0.2 - st * 0.3, -1.05); break;
      }
      case 'crown': {
        // setting a crown on his own head
        const k = clamp((Math.sin(time * 2.2) + 1) / 2, 0, 1); P.tilt = 0.1; P.roll = 0.7; s = frame(P, d);
        P.handF = rel(s.shF, 0.55, 1.6 + lerp(0.5, 0, k)); P.handB = rel(s.shB, -0.6, 1.6 + lerp(0.5, 0, k)); break;
      }
      case 'lock': { P.lean = 0.1; P.tilt = -0.1; P.roll = 0.5; s = frame(P, d); P.handF = rel(s.shF, 0.95, 0.5); P.handB = rel(s.shB, 0.2, -1.9); break; }
      case 'flex': default: {
        // double biceps: the near elbow out behind, the far one out front, fists up by the head
        P.tilt = 0.3; P.lean = -0.08; s = frame(P, d);
        P.handF = rel(s.shF, -0.35, 1.0 + beat * 0.05); P.armF = 1; P.handB = rel(s.shB, 0.3, 1.0 + beat * 0.05); break;
      }
    }
  }

  function poseTrick(P, d, style, t, stand) {
    const u = d.u;
    const k = Math.sin(clamp(t, 0, 1) * Math.PI);
    // low and wide like the model sheet's crossover, the chest out over the ball
    P.pelvis = [0, stand - d.leg * 0.33 - 0.08 * k * u]; P.lean = 0.5;
    P.footF = [0.95 * u, 0]; P.footB = [-0.8 * u, 0];
    switch (style) {
      case 'hesi': P.pelvis[1] += 0.12 * k * u; P.lean = lerp(0.38, 0.1, k); P.footF = [(0.75 + 0.3 * k) * u, 0]; break;
      case 'cross': P.footF = [lerp(0.95, 0.5, k) * u, 0]; P.footB = [lerp(-0.8, -1.05, k) * u, 0]; P.lean = 0.55; break;
      case 'legs': P.footF = [1.1 * u, 0]; P.footB = [-0.9 * u, 0]; P.pelvis[1] -= 0.08 * u; break;
      case 'behind': P.lean = 0.5; P.footF = [1.0 * u, 0]; P.footB = [-0.6 * u, 0]; break;
      case 'spin': case 'tornado': P.lean = 0.2; P.footF = [0.45 * u, k * 0.15]; P.footB = [-0.4 * u, 0]; P.pelvis[1] += 0.15 * u; break;
      case 'world': P.footF = [0.75 * u, 0]; P.footB = [-0.7 * u, 0]; P.lean = 0.3; break;
      case 'head': P.lean = 0.1 - 0.1 * k; P.pelvis[1] += 0.3 * u; P.tilt = 0.25 * k; break;
      case 'dome': P.lean = 0.12; P.pelvis[1] += 0.2 * u; P.footF = [0.95 * u, 0]; break;
      case 'juggle': P.lean = 0.05; P.pelvis[1] += 0.35 * u; P.tilt = 0.3 * k; break;
      default: break;
    }
    const s = frame(P, d);
    const rel = (sh, x, y) => [sh[0] + x * u, sh[1] + y * u];
    // the hand without the ball stays out front as an arm bar; the game puts the other one on the ball
    P.handF = rel(s.shF, 0.9, -1.75); P.handB = rel(s.shB, 1.0, -1.25);
    switch (style) {
      case 'behind': P.handB = rel(s.shB, -1.45, -1.4); break;
      case 'spin': case 'tornado': P.handB = rel(s.shB, 0.2, -1.3); break;
      case 'world': P.handB = rel(s.shB, 0.3, -1.6); break;
      case 'head': P.handF = rel(s.shF, 1.0, lerp(-1.5, 0.9, k)); P.handB = rel(s.shB, 0.1, lerp(-1.3, 0.8, k)); break;
      case 'juggle': P.handF = rel(s.shF, 1.1, lerp(-1.5, 0.5, k)); P.handB = rel(s.shB, 0.3, lerp(-1.3, 0.4, k)); break;
      case 'dome': P.handF = rel(s.shF, 1.8, lerp(-1.3, 0.4, k)); P.handB = rel(s.shB, -0.2, -1.6); break;
      default: break;
    }
  }
  const lerpPt = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];

  // ---------- drawing primitives ----------
  const OL = '#15110f';
  let SHADE_OFF = false; // set per draw: tiny players skip the shading passes
  let FINE = true; // set per draw: decorative clipped detail only when the player is big on screen
  const LIGHT = [0.55, 0.83]; // light comes from the front and above

  // A tapered capsule from A (radius r1) to B (radius r2), added to a Path2D. bulge: [front, back]
  // swell of each side at the middle, as a fraction of the mean radius. flat: square end at B.
  function taper(path, ax, ay, bx, by, r1, r2, bulge, flat) {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 0.0001;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const mx = (ax + bx) / 2, my = (ay + by) / 2, mr = (r1 + r2) / 2;
    const b0 = bulge ? bulge[0] : 0, b1 = bulge ? bulge[1] : 0;
    const an = Math.atan2(ny, nx);
    path.moveTo(ax + nx * r1, ay + ny * r1);
    path.quadraticCurveTo(mx + nx * mr * (1 + b0 * 2), my + ny * mr * (1 + b0 * 2), bx + nx * r2, by + ny * r2);
    if (flat) path.lineTo(bx - nx * r2, by - ny * r2);
    else path.arc(bx, by, r2, an, an - Math.PI, true);
    path.quadraticCurveTo(mx - nx * mr * (1 + b1 * 2), my - ny * mr * (1 + b1 * 2), ax - nx * r1, ay - ny * r1);
    path.arc(ax, ay, r1, an - Math.PI, an - 2 * Math.PI, true);
    path.closePath();
  }
  function limbPath(segs) { const p = new Path2D(); segs.forEach((s) => taper(p, s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7])); return p; }
  // Same outline, but the first segment's root cap is left open so it melts into the body.
  function openRootOutline(segs) {
    const p = new Path2D();
    segs.forEach((s, i) => {
      if (i) { taper(p, s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7]); return; }
      const [ax, ay, bx, by, r1, r2, bulge, flat] = s;
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 0.0001; const nx = -dy / L, ny = dx / L;
      const mx = (ax + bx) / 2, my = (ay + by) / 2, mr = (r1 + r2) / 2; const b0 = bulge ? bulge[0] : 0, b1 = bulge ? bulge[1] : 0;
      const an = Math.atan2(ny, nx);
      // start a little way down the limb so the shoulder top stays clean
      const k = Math.min(0.35, r1 * 1.1 / L);
      const sx = ax + dx * k, sy = ay + dy * k;
      p.moveTo(sx + nx * lerp(r1, r2, k), sy + ny * lerp(r1, r2, k));
      p.quadraticCurveTo(mx + nx * mr * (1 + b0 * 2), my + ny * mr * (1 + b0 * 2), bx + nx * r2, by + ny * r2);
      if (flat) p.lineTo(bx - nx * r2, by - ny * r2); else p.arc(bx, by, r2, an, an - Math.PI, true);
      p.quadraticCurveTo(mx - nx * mr * (1 + b1 * 2), my - ny * mr * (1 + b1 * 2), sx - nx * lerp(r1, r2, k), sy - ny * lerp(r1, r2, k));
    });
    return p;
  }
  // Outline, fill, then cel shading clipped inside: a shadow band on the side away from the light and
  // a thin highlight on the lit side.
  function fillShaded(ctx, path, segs, color, olW, opts) {
    opts = opts || {};
    if (olW) { ctx.lineWidth = olW * 2; ctx.strokeStyle = OL; ctx.stroke(opts.outline || path); }
    ctx.fillStyle = color; ctx.fill(path);
    if (opts.flat || SHADE_OFF) return;
    // shading bands drawn inside the limb by geometry (no clip, which is slow): a shadow band
    // along the side away from the light and a thin highlight on the lit side
    ctx.lineCap = 'butt';
    for (const s of segs) {
      const dx = s[2] - s[0], dy = s[3] - s[1], L = Math.hypot(dx, dy) || 1;
      let nx = -dy / L, ny = dx / L;
      if (nx * LIGHT[0] + ny * LIGHT[1] > 0) { nx = -nx; ny = -ny; }
      const r = Math.min(s[4], s[5]);
      const ex = dx / L * r * 0.35, ey = dy / L * r * 0.35;
      ctx.strokeStyle = `rgba(0,0,0,${opts.dark || 0.22})`; ctx.lineWidth = r * 0.62;
      ctx.beginPath(); ctx.moveTo(s[0] + nx * s[4] * 0.6 + ex, s[1] + ny * s[4] * 0.6 + ey); ctx.lineTo(s[2] + nx * s[5] * 0.6 - ex, s[3] + ny * s[5] * 0.6 - ey); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${opts.light || 0.2})`; ctx.lineWidth = r * 0.24;
      ctx.beginPath(); ctx.moveTo(s[0] - nx * s[4] * 0.52 + ex, s[1] - ny * s[4] * 0.52 + ey); ctx.lineTo(s[2] - nx * s[5] * 0.52 - ex, s[3] - ny * s[5] * 0.52 - ey); ctx.stroke();
    }
    ctx.lineCap = 'round';
  }
  function pt(j, f) {
    // point at fraction f along a two-bone limb (0 root, 0.5 joint, 1 end)
    if (f <= 0.5) { const k = f / 0.5; return [lerp(j[0], j[2], k), lerp(j[1], j[3], k)]; }
    const k = (f - 0.5) / 0.5; return [lerp(j[2], j[4], k), lerp(j[3], j[5], k)];
  }

  // ---------- the baller ----------
  // o: { x, y, scale (px per foot), hgt (in), build, look, num, colors {pri, sec, num}, facing (+1/-1), spin (rad),
  //      pose (from A.pose), ballLayer ('behind'|'back'|'front'|null), drawBall(ctx) in screen space, alpha, time }
  A.drawBaller = function (ctx, o) {
    const d = o.dims || A.dims(o.hgt, o.build);
    const L = o.look ? A.fullLook(o.look) : DEFAULT_LOOK;
    const P = o.pose;
    const col = o.colors || { pri: '#e8352b', sec: '#ffffff', num: '#ffffff' };
    let kx = (o.facing || 1) * Math.cos(o.spin || 0);
    if (Math.abs(kx) < 0.12) kx = kx < 0 ? -0.12 : 0.12;
    const u = d.u;
    const olW = clamp(1.5 / Math.max(1, o.scale), 0.026 * u, 0.06 * u);
    const skin = L.skin, skinB = shade(skin, -0.16);
    const time = o.time || 0;
    SHADE_OFF = o.scale < 9;
    FINE = o.scale > 24;

    ctx.save();
    const baseT = ctx.getTransform();
    const withScreen = (c, fn) => { c.save(); c.setTransform(baseT); fn(c); c.restore(); };
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    ctx.translate(o.x, o.y);
    ctx.scale(o.scale * kx, -o.scale);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // ---- skeleton ----
    const pel = P.pelvis; const lean = P.lean;
    const fr = frame(P, d); const TP = fr.TP;
    const T = d.torso, sw = d.sw, ww = d.ww, hw = d.hw, B = d.belly;
    const shF = fr.shF, shB = fr.shB;
    const hipF = TP(0.02, hw * 0.23), hipB = TP(0.04, -hw * 0.21);
    const neckBase = TP(T * 0.98, sw * 0.03);
    const r = d.headR;
    const tilt = P.tilt || 0;
    const hang = lean * 0.55 + tilt * 0.35;
    const reachUp = d.neck + r * 0.78;
    const hx = neckBase[0] + Math.sin(hang) * reachUp + r * 0.14, hy = neckBase[1] + Math.cos(hang) * reachUp;
    const legJ = (hip, foot, sign) => { const q = ik(hip[0], hip[1], foot[0], foot[1] + d.foot, d.thigh, d.shin, sign); return [hip[0], hip[1], q.jx, q.jy, q.ex, q.ey]; };
    const armJ = (sh, hand, sign) => { const q = ik(sh[0], sh[1], hand[0], hand[1], d.upper, d.fore, sign); return [sh[0], sh[1], q.jx, q.jy, q.ex, q.ey]; };
    const legF = legJ(hipF, P.footF, P.legF || 1), legB = legJ(hipB, P.footB, P.legB || 1);
    const armF = armJ(shF, P.handF, P.armF || -1), armB = armJ(shB, P.handB, P.armB || -1);

    // ---- pieces ----
    const drawShoe = (j, back) => {
      const ax = j[4], ay = j[5];
      const a = Math.atan2(ay - j[3], ax - j[2]);
      // the shoe follows the shin a little, and points its toe down in the air
      const rot = clamp((a + Math.PI / 2) * 0.3, -0.45, 0.45) + (P.toe || 0);
      // chunky high-tops, like the model sheet: the shoe is drawn a size up from the body's unit
      const su = u * 1.22;
      const fh = d.foot, st = 0.075 * su, yb = -fh + st;
      const collar = L.shoes === 'high' ? 0.2 * su : L.shoes === 'mid' || L.shoes === 'glow' ? 0.1 * su : 0.015 * su;
      const sc = back ? shade(L.shoeColor, -0.22) : L.shoeColor, acc = back ? shade(L.shoeAccent, -0.22) : L.shoeAccent;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(rot);
      const up = new Path2D();
      // A fitted heel, ankle collar, flat forefoot, and a round toe. A separate
      // tongue and side panel keep the high-top from becoming a white wedge.
      up.moveTo(-0.3 * su, yb);
      up.quadraticCurveTo(-0.34 * su, yb + 0.13 * su, -0.27 * su, collar + 0.035 * su);
      up.lineTo(-0.055 * su, collar + 0.045 * su);
      up.lineTo(0.1 * su, collar + 0.005 * su);
      up.quadraticCurveTo(0.14 * su, yb + 0.19 * su, 0.3 * su, yb + 0.155 * su);
      up.bezierCurveTo(0.47 * su, yb + 0.15 * su, 0.62 * su, yb + 0.115 * su, 0.62 * su, yb + 0.045 * su);
      up.quadraticCurveTo(0.62 * su, yb - 0.005 * su, 0.52 * su, yb);
      up.closePath();
      ctx.lineWidth = olW * 1.5; ctx.strokeStyle = OL; ctx.stroke(up);
      ctx.fillStyle = sc; ctx.fill(up);
      ctx.save(); ctx.clip(up);
      ctx.fillStyle = shade(sc, -0.28);
      ctx.beginPath(); ctx.moveTo(-0.33 * su, yb); ctx.lineTo(-0.29 * su, collar);
      ctx.lineTo(-0.13 * su, collar - 0.045 * su); ctx.lineTo(-0.05 * su, yb + 0.045 * su); ctx.closePath(); ctx.fill();
      // angular quarter panel, with a small opening above the midsole
      ctx.fillStyle = acc;
      ctx.beginPath(); ctx.moveTo(-0.27 * su, yb + 0.04 * su); ctx.lineTo(-0.1 * su, yb + 0.19 * su);
      ctx.lineTo(0.04 * su, yb + 0.17 * su); ctx.lineTo(0.19 * su, yb + 0.045 * su);
      ctx.lineTo(0.36 * su, yb + 0.03 * su); ctx.lineTo(0.22 * su, yb); ctx.lineTo(-0.27 * su, yb); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(sc, -0.18);
      ctx.beginPath(); ctx.moveTo(-0.05 * su, collar + 0.06 * su); ctx.lineTo(0.08 * su, collar + 0.025 * su);
      ctx.lineTo(0.28 * su, yb + 0.145 * su); ctx.lineTo(0.17 * su, yb + 0.09 * su); ctx.closePath(); ctx.fill();
      if (FINE) {
        ctx.strokeStyle = shade(sc, -0.4); ctx.lineWidth = 0.012 * su;
        ctx.beginPath(); ctx.moveTo(0.4 * su, yb + 0.15 * su); ctx.quadraticCurveTo(0.33 * su, yb + 0.09 * su, 0.38 * su, yb); ctx.stroke();
        ctx.fillStyle = shade(sc, -0.3);
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc((0.38 + i * 0.055) * su, yb + 0.105 * su, 0.009 * su, 0, TAU); ctx.fill(); }
        ctx.fillStyle = 'rgba(255,255,255,0.32)'; ctx.fillRect(-0.23 * su, collar - 0.025 * su, 0.11 * su, 0.028 * su);
      }
      ctx.restore();
      // laces
      if (FINE) {
        ctx.strokeStyle = luminance(sc) > 0.65 ? '#4d5360' : '#ecebe4'; ctx.lineWidth = 0.018 * su;
        for (let i = 0; i < 4; i++) { const t = i / 4; const lx = lerp(0.025, 0.23, t) * su, ly = lerp(collar - 0.025 * su, yb + 0.16 * su, t); ctx.beginPath(); ctx.moveTo(lx - 0.045 * su, ly); ctx.lineTo(lx + 0.055 * su, ly - 0.025 * su); ctx.stroke(); }
      }
      // sole
      const sole = new Path2D();
      sole.moveTo(-0.3 * su, yb); sole.lineTo(0.58 * su, yb);
      sole.quadraticCurveTo(0.65 * su, yb + 0.025 * su, 0.62 * su, -fh + 0.025 * su);
      sole.quadraticCurveTo(0.42 * su, -fh - 0.018 * su, 0.2 * su, -fh + 0.015 * su);
      sole.lineTo(-0.26 * su, -fh); sole.quadraticCurveTo(-0.33 * su, -fh, -0.3 * su, yb); sole.closePath();
      ctx.lineWidth = olW * 1.25; ctx.strokeStyle = OL; ctx.stroke(sole);
      ctx.fillStyle = L.shoes === 'glow' ? '#7df9ff' : back ? '#c3c5c4' : '#e6e5df'; ctx.fill(sole);
      ctx.strokeStyle = back ? '#333941' : '#444b55'; ctx.lineWidth = 0.025 * su;
      ctx.beginPath(); ctx.moveTo(-0.25 * su, -fh + 0.005 * su); ctx.lineTo(0.21 * su, -fh + 0.024 * su); ctx.quadraticCurveTo(0.42 * su, -fh, 0.57 * su, -fh + 0.014 * su); ctx.stroke();
      if (L.shoes === 'glow' && !back) { ctx.save(); ctx.shadowColor = '#7df9ff'; ctx.shadowBlur = 12; ctx.fill(sole); ctx.restore(); }
      ctx.restore();
    };

    const shortsLen = { short: 0.34, mid: 0.54, long: 0.72, baggy: 0.82 }[L.shorts] || 0.54;
    const shortsK = { short: 1.24, mid: 1.36, long: 1.4, baggy: 1.6 }[L.shorts] || 1.36;
    const drawLeg = (j, back) => {
      const sk = back ? skinB : skin;
      const tr = d.thighR, kr = d.thighR * 0.72, ar = d.calfR * 0.56;
      const segs = [[j[0], j[1], j[2], j[3], tr, kr, [0.14, 0.06]], [j[2], j[3], j[4], j[5], kr * 0.96, ar, [0.04, 0.24]]];
      fillShaded(ctx, limbPath(segs), segs, sk, olW);
      // knee sleeve
      if (L.kneeSleeve === 'both' || L.kneeSleeve === (back ? 'left' : 'right')) {
        const a = pt(j, 0.38), b = pt(j, 0.66);
        const ks = [[a[0], a[1], b[0], b[1], kr * 1.25, kr * 1.12, [0.05, 0.05], true]];
        fillShaded(ctx, limbPath(ks), ks, back ? shade(L.sleeveColor, -0.2) : L.sleeveColor, olW);
      }
      // sock
      const top = { low: 0.94, crew: 0.83, tall: 0.68, stripes: 0.66 }[L.socks] || 0.83;
      const s0 = pt(j, top);
      const sr0 = lerp(kr * 0.96, ar, (top - 0.5) / 0.5) * 1.07;
      const ss = [[s0[0], s0[1], j[4], j[5], sr0, ar * 1.07, [0.02, 0.1]]];
      const sp = limbPath(ss);
      fillShaded(ctx, sp, ss, back ? shade(L.sockColor, -0.2) : L.sockColor, olW);
      if (L.socks === 'stripes') {
        ctx.save(); ctx.clip(sp);
        [[0.04, col.pri], [0.1, col.sec]].forEach(([f, c]) => { const a = pt(j, top + f); const b = pt(j, top + f + 0.035); ctx.strokeStyle = back ? shade(c, -0.2) : c; ctx.lineWidth = d.thighR * 2; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); });
        ctx.restore(); ctx.lineCap = 'round';
      }
      drawShoe(j, back);
    };
    const drawShortsLeg = (j, back) => {
      const e = pt(j, shortsLen * 0.5);
      const r0 = d.thighR * shortsK * 1.04, r1 = d.thighR * shortsK * (L.shorts === 'baggy' ? 1.0 : 0.86);
      const segs = [[j[0], j[1], e[0], e[1], r0, r1, [0.04, 0.04], true]];
      const p = limbPath(segs);
      const c = back ? shade(col.pri, -0.22) : col.pri;
      fillShaded(ctx, p, segs, c, olW, { light: 0.12 });
      // side stripe and hem (kept inside the shorts by geometry)
      const dx = e[0] - j[0], dy = e[1] - j[1], Lg = Math.hypot(dx, dy) || 1; const nnx = -dy / Lg, nny = dx / Lg;
      ctx.strokeStyle = back ? shade(col.sec, -0.22) : col.sec; ctx.lineWidth = r1 * 0.24; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(j[0] - nnx * r0 * 0.66, j[1] - nny * r0 * 0.66); ctx.lineTo(e[0] - nnx * r1 * 0.66, e[1] - nny * r1 * 0.66); ctx.stroke();
      if (FINE) { ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.07 * u; ctx.beginPath(); ctx.moveTo(e[0] + nnx * r1 * 0.9 - dx / Lg * 0.05 * u, e[1] + nny * r1 * 0.9 - dy / Lg * 0.05 * u); ctx.lineTo(e[0] - nnx * r1 * 0.9 - dx / Lg * 0.05 * u, e[1] - nny * r1 * 0.9 - dy / Lg * 0.05 * u); ctx.stroke(); }
      ctx.lineCap = 'round';
    };
    const drawHand = (j, sk, wrist) => {
      const dx = j[4] - j[2], dy = j[5] - j[3]; const a = Math.atan2(dy, dx) + (wrist || 0);
      ctx.save(); ctx.translate(j[4], j[5]); ctx.rotate(a);
      const hr = d.armR * 1.3;
      const hp = new Path2D(); hp.ellipse(hr * 0.15, 0, hr * 1.12, hr * 0.92, 0, 0, TAU);
      const th = new Path2D(); th.ellipse(-hr * 0.15, hr * 0.78, hr * 0.48, hr * 0.32, -0.6, 0, TAU);
      ctx.lineWidth = olW * 2; ctx.strokeStyle = OL; ctx.stroke(hp); ctx.stroke(th);
      ctx.fillStyle = sk; ctx.fill(hp); ctx.fill(th);
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(hr * 0.3, -hr * 0.35, hr * 0.8, hr * 0.42, 0, 0, TAU); ctx.fill();
      ctx.restore();
    };
    const drawArm = (j, back) => {
      const sk = back ? skinB : skin;
      const ar = d.armR;
      const fx = j[4] - j[2], fy = j[5] - j[3], fl = Math.hypot(fx, fy) || 1;
      const wx = j[4] - fx / fl * ar * 0.9, wy = j[5] - fy / fl * ar * 0.9;
      const segs = [[j[0], j[1], j[2], j[3], ar * 1.18, ar * 0.72, [0.2, 0.1]], [j[2], j[3], wx, wy, ar * 0.76, ar * 0.5, [0.12, 0.06]]];
      const p = limbPath(segs);
      fillShaded(ctx, p, segs, sk, olW, { outline: openRootOutline(segs) });
      // ink
      if (L.tattoo !== 'none') {
        ctx.save(); ctx.clip(p); ctx.strokeStyle = back ? 'rgba(10,15,25,0.42)' : 'rgba(18,28,42,0.5)'; ctx.lineWidth = 0.045 * u;
        const ranges = L.tattoo === 'sleeve' ? [[0.06, 0.9]] : L.tattoo === 'forearm' ? [[0.58, 0.88]] : [[0.22, 0.3]];
        ranges.forEach(([a0, a1]) => {
          for (let f = a0; f < a1; f += 0.055) {
            const q0 = pt(j, f), q1 = pt(j, Math.min(a1, f + 0.055));
            ctx.beginPath(); ctx.moveTo(q0[0] - ar, q0[1]); ctx.quadraticCurveTo((q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2 + ar * 0.6, q1[0] + ar, q1[1]); ctx.stroke();
          }
        });
        ctx.restore();
      }
      if (L.armSleeve === 'both' || L.armSleeve === (back ? 'left' : 'right')) {
        const a = pt(j, 0.14);
        const ss = [[a[0], a[1], j[2], j[3], ar * 0.95, ar * 0.76, [0.15, 0.1]], [j[2], j[3], wx, wy, ar * 0.8, ar * 0.56, [0.1, 0.05], true]];
        fillShaded(ctx, limbPath(ss), ss, back ? shade(L.sleeveColor, -0.2) : L.sleeveColor, olW);
      }
      if (L.wristbands === 'both' || (L.wristbands === 'one' && !back)) {
        const a = pt(j, 0.82);
        const ws = [[a[0], a[1], wx, wy, ar * 0.66, ar * 0.64, null, true]];
        fillShaded(ctx, limbPath(ws), ws, back ? shade(L.headbandColor, -0.2) : L.headbandColor, olW);
      }
      if (L.jersey === 'tee') {
        const a = pt(j, 0.24);
        const ts = [[j[0], j[1], a[0], a[1], ar * 1.5, ar * 1.25, [0.05, 0.05], true]];
        fillShaded(ctx, limbPath(ts), ts, back ? shade(col.pri, -0.22) : col.pri, olW);
      }
      drawHand(j, sk, back ? P.wristB : P.wristF);
    };

    // ---- back layer ----
    if (o.ballLayer === 'behind' && o.drawBall) withScreen(ctx, o.drawBall);
    drawHairBack(ctx, L, hx, hy, r, time, olW);
    drawArm(armB, true);
    if (o.ballLayer === 'back' && o.drawBall) withScreen(ctx, o.drawBall);
    drawLeg(legB, true);
    drawShortsLeg(legB, true);
    drawLeg(legF, false);
    drawShortsLeg(legF, false);
    // shorts seat and waistband
    const seat = new Path2D();
    const s1 = TP(0.26, -hw * 0.56), s2 = TP(0.26, hw * 0.56 + B * 0.6), s3 = TP(-0.3, hw * 0.6), s4 = TP(-0.3, -hw * 0.6);
    seat.moveTo(s1[0], s1[1]); seat.lineTo(s2[0], s2[1]); seat.lineTo(s3[0], s3[1]); seat.lineTo(s4[0], s4[1]); seat.closePath();
    ctx.lineWidth = olW * 2; ctx.strokeStyle = OL; ctx.stroke(seat); ctx.fillStyle = col.pri; ctx.fill(seat);

    // ---- torso ----
    const body = new Path2D();
    const bp = [TP(0.15, -hw * 0.5), TP(T * 0.42, -ww * 0.5), TP(T * 0.74, -sw * 0.44), TP(T * 0.94, -sw * 0.5), TP(T * 1.05, -sw * 0.28), TP(T * 1.08, 0), TP(T * 1.05, sw * 0.28), TP(T * 0.94, sw * 0.5), TP(T * 0.74, sw * 0.45 + B * 0.3), TP(T * 0.42, ww * 0.5 + B), TP(0.15, hw * 0.5)];
    smoothClosed(body, bp);
    ctx.lineWidth = olW * 2; ctx.strokeStyle = OL; ctx.stroke(body); ctx.fillStyle = skin; ctx.fill(body);
    // jersey
    const jer = new Path2D();
    const hemB = TP(-0.04, -hw * 0.58), hemF = TP(-0.04, hw * 0.58 + B * 0.5);
    const tee = L.jersey === 'tee';
    const pitF = TP(T * 0.7, sw * 0.44 + B * 0.25), pitB = TP(T * 0.7, -sw * 0.43);
    const strapF = tee ? TP(T * 0.96, sw * 0.52) : TP(T * 1.0, sw * 0.26), strapB = tee ? TP(T * 0.96, -sw * 0.52) : TP(T * 1.0, -sw * 0.25);
    const neckF = TP(T * 1.05, sw * 0.15), neckB = TP(T * 1.05, -sw * 0.11);
    const holeF = tee ? TP(T * 0.86, sw * 0.52) : TP(T * 0.82, sw * 0.26), holeB = tee ? TP(T * 0.86, -sw * 0.52) : TP(T * 0.82, -sw * 0.25);
    const dip = TP(T * (L.jersey === 'hoodie' ? 0.95 : 0.86), sw * 0.03);
    jer.moveTo(hemB[0], hemB[1]); jer.lineTo(hemF[0], hemF[1]);
    const wF = TP(T * 0.42, ww * 0.55 + B), wB = TP(T * 0.42, -ww * 0.55);
    jer.quadraticCurveTo(wF[0], wF[1], pitF[0], pitF[1]);
    jer.quadraticCurveTo(holeF[0], holeF[1], strapF[0], strapF[1]);
    if (tee) { const t1 = TP(T * 1.05, sw * 0.32); jer.quadraticCurveTo(t1[0], t1[1], neckF[0], neckF[1]); } else jer.lineTo(neckF[0], neckF[1]);
    jer.quadraticCurveTo(dip[0], dip[1], neckB[0], neckB[1]);
    if (tee) { const t2 = TP(T * 1.05, -sw * 0.32); jer.quadraticCurveTo(t2[0], t2[1], strapB[0], strapB[1]); } else jer.lineTo(strapB[0], strapB[1]);
    jer.quadraticCurveTo(holeB[0], holeB[1], pitB[0], pitB[1]);
    jer.quadraticCurveTo(wB[0], wB[1], hemB[0], hemB[1]);
    jer.closePath();
    const jc = L.jersey === 'mesh' ? shade(col.pri, 0.16) : col.pri;
    ctx.fillStyle = jc; ctx.fill(jer);
    // The neutral material follows the moving torso; crew colors, trim and numbers remain live.
    const weave = BK.assets && BK.assets.get('jersey-weave');
    if (weave && A.drawImageQuad && o.scale >= 12) {
      ctx.save(); ctx.clip(jer); ctx.globalAlpha *= L.jersey === 'mesh' ? 0.5 : 0.3;
      ctx.globalCompositeOperation = 'soft-light';
      const pts = [TP(T * 1.1, -sw * 0.62), TP(T * 1.1, sw * 0.62), TP(-0.1, sw * 0.62), TP(-0.1, -sw * 0.62)];
      A.drawImageQuad(ctx, weave, pts.map(([x, y]) => ({ x, y })));
      ctx.restore();
    }
    if (!FINE) {
      ctx.strokeStyle = col.sec; ctx.lineWidth = 0.16 * u; ctx.lineCap = 'butt';
      const h1 = TP(-0.0, -hw * 0.5), h2 = TP(-0.0, hw * 0.5 + B * 0.4); ctx.beginPath(); ctx.moveTo(h1[0], h1[1]); ctx.lineTo(h2[0], h2[1]); ctx.stroke(); ctx.lineCap = 'round';
    } else {
    ctx.save(); ctx.clip(jer);
    if (L.jersey === 'mesh') { ctx.fillStyle = 'rgba(0,0,0,0.13)'; for (let a = -0.3; a < T * 1.2; a += 0.12 * u) for (let c = -sw * 0.6; c < sw * 0.6; c += 0.12 * u) { const q = TP(a, c); ctx.fillRect(q[0], q[1], 0.045 * u, 0.045 * u); } }
    // hem band and side panel in the trim color
    ctx.fillStyle = col.sec;
    { const a1 = TP(0.05, -sw), a2 = TP(0.05, sw), a3 = TP(-0.2, sw), a4 = TP(-0.2, -sw); ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]); ctx.lineTo(a3[0], a3[1]); ctx.lineTo(a4[0], a4[1]); ctx.closePath(); ctx.fill(); }
    if (L.jersey === 'throwback') { const a1 = TP(0.24, -sw), a2 = TP(0.24, sw), a3 = TP(0.16, sw), a4 = TP(0.16, -sw); ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]); ctx.lineTo(a3[0], a3[1]); ctx.lineTo(a4[0], a4[1]); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    }
    // trim on the neckline and armholes
    ctx.strokeStyle = col.sec; ctx.lineWidth = (L.jersey === 'throwback' ? 0.11 : 0.075) * u;
    const trim = new Path2D();
    trim.moveTo(pitF[0], pitF[1]); trim.quadraticCurveTo(holeF[0], holeF[1], strapF[0], strapF[1]);
    trim.moveTo(neckF[0], neckF[1]); trim.quadraticCurveTo(dip[0], dip[1], neckB[0], neckB[1]);
    trim.moveTo(strapB[0], strapB[1]); trim.quadraticCurveTo(holeB[0], holeB[1], pitB[0], pitB[1]);
    if (!tee) ctx.stroke(trim);
    ctx.lineWidth = olW * 1.6; ctx.strokeStyle = OL; ctx.stroke(jer);
    // torso shading: the far side turns away from the light
    if (!FINE) {
      const q1 = TP(-0.04, -hw * 0.5), q2 = TP(T * 0.42, -ww * 0.5), q3 = TP(T * 0.9, -sw * 0.48), q4 = TP(T * 0.9, -sw * 0.12), q5 = TP(-0.04, -hw * 0.14);
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.moveTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.lineTo(q3[0], q3[1]); ctx.lineTo(q4[0], q4[1]); ctx.lineTo(q5[0], q5[1]); ctx.closePath(); ctx.fill();
    } else {
    ctx.save(); ctx.clip(body);
    const g0 = TP(T * 0.5, -sw * 0.55), g1 = TP(T * 0.5, sw * 0.55);
    const tg = ctx.createLinearGradient(g0[0], g0[1], g1[0], g1[1]);
    tg.addColorStop(0, 'rgba(0,0,0,0.32)'); tg.addColorStop(0.42, 'rgba(0,0,0,0.04)'); tg.addColorStop(0.75, 'rgba(255,255,255,0.08)'); tg.addColorStop(1, 'rgba(255,255,255,0.02)');
    ctx.fillStyle = tg; ctx.fillRect(pel[0] - 4, pel[1] - 2, 8, 6);
    ctx.restore();
    }
    // number
    if (o.num != null && o.scale * Math.abs(kx) > 5) {
      const np = TP(T * 0.52, sw * 0.07);
      ctx.save(); ctx.translate(np[0], np[1]); ctx.scale(kx < 0 ? -1 : 1, -1); ctx.rotate(lean * (kx < 0 ? -1 : 1));
      ctx.font = `400 ${(T * 0.36).toFixed(3)}px Anton, Impact, 'Arial Narrow', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 0.075 * u; ctx.strokeStyle = shade(col.pri, -0.5); ctx.strokeText(String(o.num), 0, 0);
      ctx.fillStyle = col.num || col.sec; ctx.fillText(String(o.num), 0, 0);
      ctx.restore();
    }
    if (L.jersey === 'hoodie') {
      const h1 = TP(T * 1.02, -sw * 0.34), h2 = TP(T * 1.22, -sw * 0.28), h3 = TP(T * 1.1, sw * 0.02);
      const hp = new Path2D(); hp.moveTo(neckB[0], neckB[1]); hp.quadraticCurveTo(h1[0], h1[1] + 0.1, h2[0], h2[1]); hp.quadraticCurveTo(h3[0], h3[1] + 0.1, neckF[0], neckF[1]); hp.closePath();
      ctx.lineWidth = olW * 2; ctx.strokeStyle = OL; ctx.stroke(hp); ctx.fillStyle = shade(col.pri, -0.18); ctx.fill(hp);
    }

    // ---- neck and head ----
    const nTop = [hx - r * 0.18, hy - r * 0.62];
    const ns = [[neckBase[0], neckBase[1] - 0.05, nTop[0], nTop[1], d.neckR * 1.05, d.neckR * 0.92, [0.05, 0.08]]];
    fillShaded(ctx, limbPath(ns), ns, skin, olW, { dark: 0.3 });
    if (L.chain !== 'none') {
      const cc = L.chain === 'silver' ? '#e4e8ee' : '#ffd23f';
      const a = TP(T * 1.03, -sw * 0.12), b = TP(T * 0.78, sw * 0.1), c2 = TP(T * 1.03, sw * 0.18);
      ctx.strokeStyle = shade(cc, -0.35); ctx.lineWidth = 0.075 * u; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(b[0], b[1] - 0.1, c2[0], c2[1]); ctx.stroke();
      ctx.strokeStyle = cc; ctx.lineWidth = 0.045 * u; ctx.stroke();
      const pc = TP(T * 0.84, sw * 0.05);
      ctx.fillStyle = cc; ctx.strokeStyle = OL; ctx.lineWidth = olW;
      ctx.beginPath();
      if (L.chain === 'crown') { const bx = pc[0], by = pc[1], k = 0.13 * u; ctx.moveTo(bx - k, by - k * 0.5); ctx.lineTo(bx - k * 1.1, by + k * 0.7); ctx.lineTo(bx - k * 0.4, by + k * 0.2); ctx.lineTo(bx, by + k * 0.9); ctx.lineTo(bx + k * 0.4, by + k * 0.2); ctx.lineTo(bx + k * 1.1, by + k * 0.7); ctx.lineTo(bx + k, by - k * 0.5); ctx.closePath(); }
      else ctx.arc(pc[0], pc[1], 0.075 * u, 0, TAU);
      ctx.fill(); ctx.stroke();
    }
    drawHead(ctx, L, hx, hy, r, o, olW, col);

    // ---- front arm ----
    drawArm(armF, false);
    if (o.ballLayer === 'front' && o.drawBall) withScreen(ctx, o.drawBall);
    ctx.restore();

    const toScreen = (bx, by) => [o.x + bx * o.scale * kx, o.y - by * o.scale];
    return { handF: toScreen(armF[4], armF[5]), handB: toScreen(armB[4], armB[5]), head: toScreen(hx, hy), headR: r * o.scale };
  };

  // Closed Catmull-Rom spline through points (smooth body outlines).
  function smoothClosed(path, pts) {
    const n = pts.length;
    path.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      path.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
    path.closePath();
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  A.roundRect = roundRect;

  // ---------- the head (three-quarter view, facing +x) ----------
  function headPath(hx, hy, r) {
    const p = new Path2D();
    p.moveTo(hx + r * 0.77, hy + r * 0.38);
    p.bezierCurveTo(hx + r * 0.77, hy + r * 1.05, hx - r * 0.6, hy + r * 1.1, hx - r * 0.86, hy + r * 0.36);
    p.quadraticCurveTo(hx - r * 0.95, hy - r * 0.1, hx - r * 0.68, hy - r * 0.55);
    p.lineTo(hx - r * 0.25, hy - r * 0.87);
    p.quadraticCurveTo(hx + r * 0.08, hy - r * 1.0, hx + r * 0.38, hy - r * 0.87);
    p.lineTo(hx + r * 0.7, hy - r * 0.57);
    p.quadraticCurveTo(hx + r * 0.9, hy - r * 0.12, hx + r * 0.77, hy + r * 0.38);
    p.closePath();
    return p;
  }
  // Hair that sits on the skull. t: height above the skull, front: how low the hairline comes.
  function hairCap(hx, hy, r, t, front) {
    const p = new Path2D();
    const fx = hx + r * (0.69 + front * 0.1), fy = hy + r * (0.6 - front * 0.08);
    p.moveTo(fx, fy);
    p.bezierCurveTo(hx + r * (0.8 + t * 0.4), hy + r * (1.12 + t), hx - r * (0.56 + t * 0.3), hy + r * (1.2 + t), hx - r * (0.92 + t), hy + r * 0.36);
    p.bezierCurveTo(hx - r * (1.02 + t), hy - r * 0.08, hx - r * 0.82, hy - r * 0.3, hx - r * 0.65, hy - r * 0.3);
    p.lineTo(hx - r * 0.48, hy - r * 0.28); p.lineTo(hx - r * 0.45, hy + r * 0.32);
    p.quadraticCurveTo(hx - r * 0.1, hy + r * 0.62, fx, fy);
    p.closePath();
    return p;
  }

  function drawHairBack(ctx, L, hx, hy, r, time, olW) {
    const c = L.hairColor; const sway = Math.sin(time * 6) * 0.08;
    ctx.save(); ctx.lineWidth = olW * 2; ctx.strokeStyle = OL; ctx.fillStyle = c;
    const blob = (p) => { ctx.stroke(p); ctx.fill(p); };
    switch (L.hair) {
      case 'afro': case 'bigfro': {
        const R = L.hair === 'afro' ? 1.42 : 1.82;
        const p = new Path2D(); const cx = hx - r * 0.12, cy = hy + r * (L.hair === 'afro' ? 0.28 : 0.42);
        for (let i = 0; i <= 28; i++) { const a = i / 28 * TAU; const rr = r * R * (1 + Math.sin(i * 2.3) * 0.035); const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.96; if (i) p.lineTo(x, y); else p.moveTo(x, y); }
        p.closePath(); blob(p);
        ctx.save(); ctx.clip(p); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.arc(cx - r * R * 0.4, cy - r * R * 0.35, r * R, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 40; i++) { const a = i * 2.4, rr = r * R * ((i * 37) % 100) / 110; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, r * 0.08, 0, TAU); ctx.fill(); }
        ctx.restore();
        break;
      }
      case 'long': case 'shaggy': case 'mullet': {
        const len = L.hair === 'long' ? 2.3 : L.hair === 'mullet' ? 2.0 : 1.35;
        const p = new Path2D();
        p.moveTo(hx - r * 0.1, hy + r * 1.0);
        p.bezierCurveTo(hx - r * 1.35, hy + r * 0.9, hx - r * 1.25, hy - r * len * 0.4, hx - r * 1.0 + sway, hy - r * len);
        p.quadraticCurveTo(hx - r * 0.55, hy - r * (len - 0.15), hx - r * 0.25 + sway * 0.5, hy - r * len * 0.82);
        p.quadraticCurveTo(hx - r * 0.4, hy - r * 0.3, hx - r * 0.2, hy - r * 0.1);
        p.closePath(); blob(p);
        ctx.save(); ctx.clip(p); ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = r * 0.05;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(hx - r * (0.5 + i * 0.18), hy + r * 0.6); ctx.quadraticCurveTo(hx - r * (1.0 + i * 0.05), hy - r * len * 0.3, hx - r * (0.7 + i * 0.1) + sway, hy - r * len * 0.95); ctx.stroke(); }
        ctx.restore();
        break;
      }
      case 'locs': {
        for (let i = 0; i < 7; i++) {
          const sx = hx - r * (0.05 + i * 0.15), sy = hy + r * (0.75 - i * 0.12);
          const ex = sx - r * (0.35 + i * 0.04) + sway * (1 + i * 0.25), ey = sy - r * (2.0 - i * 0.05);
          ctx.strokeStyle = OL; ctx.lineWidth = r * 0.27; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx - r * 0.7, sy - r * 0.8, ex, ey); ctx.stroke();
          ctx.strokeStyle = shade(c, i % 2 ? 0.08 : -0.04); ctx.lineWidth = r * 0.18; ctx.stroke();
        }
        break;
      }
      case 'ponytail': {
        const bx = hx - r * 0.92, by = hy + r * 0.32;
        const p = new Path2D();
        p.moveTo(bx + r * 0.18, by + r * 0.18);
        p.bezierCurveTo(bx - r * 0.9, by + r * 0.25 + sway * 3, bx - r * 1.0 + sway * 2, by - r * 0.9, bx - r * 0.65 + sway * 2, by - r * 1.55);
        p.quadraticCurveTo(bx - r * 0.25, by - r * 0.6, bx + r * 0.22, by - r * 0.18); p.closePath(); blob(p);
        ctx.fillStyle = L.headbandColor === c ? '#e8352b' : (L.headbandColor || '#e8352b'); ctx.beginPath(); ctx.ellipse(bx + r * 0.05, by + r * 0.02, r * 0.14, r * 0.2, 0.3, 0, TAU); ctx.fill(); ctx.stroke();
        break;
      }
      default: break;
    }
    if (L.headband === 'ninja') {
      ctx.strokeStyle = L.headbandColor; ctx.lineWidth = r * 0.17;
      ctx.beginPath(); ctx.moveTo(hx - r * 0.92, hy + r * 0.48); ctx.quadraticCurveTo(hx - r * 1.6, hy + r * 0.6 + sway * 4, hx - r * 2.3, hy + r * 0.15 + sway * 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx - r * 0.92, hy + r * 0.42); ctx.quadraticCurveTo(hx - r * 1.5, hy + r * 0.05 + sway * 4, hx - r * 2.1, hy - r * 0.25 + sway * 6); ctx.stroke();
    }
    ctx.restore();
  }

  function drawHead(ctx, L, hx, hy, r, o, olW, col) {
    const skin = L.skin; const scalePx = r * (o.scale || 20);
    const big = scalePx > 12;
    const head = headPath(hx, hy, r);
    ctx.lineWidth = olW * 2; ctx.strokeStyle = OL; ctx.stroke(head);
    ctx.fillStyle = skin; ctx.fill(head);
    // roundness: light on the face, shadow wrapping the back of the skull and under the jaw
    if (!FINE) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(hx - r * 0.42, hy - r * 0.05, r * 0.42, r * 0.78, 0.1, 0, TAU); ctx.fill(); } else {
    ctx.save(); ctx.clip(head);
    const hg = ctx.createRadialGradient(hx + r * 0.5, hy + r * 0.25, r * 0.1, hx + r * 0.1, hy, r * 1.35);
    hg.addColorStop(0, 'rgba(255,255,255,0.14)'); hg.addColorStop(0.5, 'rgba(0,0,0,0)'); hg.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = hg; ctx.fillRect(hx - r * 1.6, hy - r * 1.7, r * 3.2, r * 3.4);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(hx + r * 0.25, hy - r * 0.98, r * 0.7, r * 0.22, 0.15, 0, TAU); ctx.fill();
    ctx.restore();
    }
    drawFacial(ctx, L, hx, hy, r);
    // hair over the skull, then the ear sits on top of it
    drawHairTop(ctx, L, hx, hy, r, olW, o.time || 0, head);
    // ear
    const ex = hx - r * 0.63, ey = hy - r * 0.04;
    ctx.fillStyle = skin; ctx.strokeStyle = OL; ctx.lineWidth = olW * 1.6;
    ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.17, r * 0.25, -0.15, 0, TAU); ctx.fill(); ctx.stroke();
    if (big) { ctx.strokeStyle = shade(skin, -0.32); ctx.lineWidth = r * 0.045; ctx.beginPath(); ctx.arc(ex + r * 0.02, ey, r * 0.1, -1.2, 1.4); ctx.stroke(); }
    // nose
    const nose = new Path2D();
    nose.moveTo(hx + r * 0.55, hy + r * 0.08); nose.quadraticCurveTo(hx + r * 0.59, hy - r * 0.06, hx + r * 0.79, hy - r * 0.17); nose.quadraticCurveTo(hx + r * 0.7, hy - r * 0.3, hx + r * 0.47, hy - r * 0.23);
    ctx.fillStyle = skin; ctx.fill(nose);
    ctx.strokeStyle = OL; ctx.lineWidth = olW * 1.5; ctx.stroke(nose);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(hx + r * 0.51, hy - r * 0.24, r * 0.085, r * 0.055, 0, 0, TAU); ctx.fill();
    // eyes
    const eyeY = hy + r * 0.1;
    const brC = shade(['#d8d8d8', '#f3e5b5', '#e8c46e'].includes(L.hairColor) ? '#8a6a3a' : L.hairColor, -0.15);
    [[hx - r * 0.04, 1], [hx + r * 0.49, 0.78]].forEach(([ex2, k]) => {
      const ew = r * 0.15 * k, eh = r * ({ wide: 0.13, sleepy: 0.065, focused: 0.075, normal: 0.1 }[L.eyes] || 0.1);
      if (!big) {
        ctx.fillStyle = '#1a120c'; ctx.beginPath(); ctx.ellipse(ex2 + ew * 0.15, eyeY, Math.max(ew * 0.55, r * 0.05), Math.max(eh * 0.85, r * 0.05), 0, 0, TAU); ctx.fill();
      } else {
        const eye = new Path2D();
        eye.moveTo(ex2 - ew, eyeY); eye.quadraticCurveTo(ex2, eyeY + eh * 2, ex2 + ew, eyeY + eh * 0.2); eye.quadraticCurveTo(ex2, eyeY - eh * 1.4, ex2 - ew, eyeY);
        ctx.fillStyle = '#f7f4ee'; ctx.fill(eye);
        ctx.save(); ctx.clip(eye);
        ctx.fillStyle = '#2b1a10'; ctx.beginPath(); ctx.arc(ex2 + ew * 0.3, eyeY + eh * 0.2, Math.max(eh * 1.15, ew * 0.55), 0, TAU); ctx.fill();
        ctx.fillStyle = '#0b0705'; ctx.beginPath(); ctx.arc(ex2 + ew * 0.32, eyeY + eh * 0.2, Math.max(eh * 0.6, ew * 0.28), 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(ex2 + ew * 0.5, eyeY + eh * 0.6, ew * 0.16, 0, TAU); ctx.fill();
        if (L.eyes === 'sleepy') { ctx.fillStyle = shade(skin, -0.08); ctx.fillRect(ex2 - ew * 1.2, eyeY + eh * 0.15, ew * 2.4, eh * 2); }
        ctx.restore();
        ctx.strokeStyle = OL; ctx.lineWidth = r * 0.05; ctx.beginPath(); ctx.moveTo(ex2 - ew * 1.05, eyeY + eh * 0.1); ctx.quadraticCurveTo(ex2, eyeY + eh * (L.eyes === 'sleepy' ? 0.9 : 2.05), ex2 + ew * 1.05, eyeY + eh * 0.25); ctx.stroke();
      }
      // brow
      const by = eyeY + r * 0.23; ctx.strokeStyle = brC; ctx.lineCap = 'round';
      ctx.lineWidth = r * (L.brows === 'thick' ? 0.12 : 0.085);
      ctx.beginPath();
      if (L.brows === 'angry') { ctx.moveTo(ex2 - r * 0.15 * k, by + r * 0.06); ctx.lineTo(ex2 + r * 0.14 * k, by - r * 0.05); }
      else if (L.brows === 'raised') { ctx.moveTo(ex2 - r * 0.15 * k, by); ctx.quadraticCurveTo(ex2, by + r * 0.12, ex2 + r * 0.15 * k, by + r * 0.03); }
      else { ctx.moveTo(ex2 - r * 0.15 * k, by - r * 0.01); ctx.quadraticCurveTo(ex2, by + r * 0.05, ex2 + r * 0.15 * k, by); }
      ctx.stroke();
    });
    // mouth
    const mx = hx + r * 0.3, my = hy - r * 0.51;
    ctx.lineWidth = Math.max(olW * 1.3, r * 0.045); ctx.strokeStyle = '#3a1712';
    switch (L.mouth) {
      case 'smile': ctx.beginPath(); ctx.moveTo(mx - r * 0.17, my + r * 0.05); ctx.quadraticCurveTo(mx, my - r * 0.12, mx + r * 0.18, my + r * 0.07); ctx.stroke(); break;
      case 'grin': { const m = new Path2D(); m.moveTo(mx - r * 0.19, my + r * 0.06); m.quadraticCurveTo(mx, my - r * 0.24, mx + r * 0.2, my + r * 0.07); m.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill(m); ctx.stroke(m); break; }
      case 'tongue':
        ctx.fillStyle = '#3a0d10'; ctx.beginPath(); ctx.ellipse(mx, my, r * 0.13, r * 0.09, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e0566a'; ctx.beginPath(); ctx.ellipse(mx + r * 0.06, my - r * 0.13, r * 0.1, r * 0.15, -0.3, 0, TAU); ctx.fill(); ctx.stroke(); break;
      case 'guard': ctx.fillStyle = col.sec || '#ffffff'; ctx.beginPath(); ctx.ellipse(mx + r * 0.1, my - r * 0.02, r * 0.17, r * 0.075, 0.2, 0, TAU); ctx.fill(); ctx.stroke(); break;
      case 'snarl': ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(mx - r * 0.15, my + r * 0.03); ctx.lineTo(mx + r * 0.17, my + r * 0.05); ctx.lineTo(mx + r * 0.15, my - r * 0.06); ctx.lineTo(mx - r * 0.13, my - r * 0.05); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
      default: ctx.beginPath(); ctx.moveTo(mx - r * 0.15, my + r * 0.01); ctx.quadraticCurveTo(mx, my - r * 0.03, mx + r * 0.17, my + r * 0.02); ctx.stroke(); break;
    }
    // headwear
    if (L.headband === 'band' || L.headband === 'wide' || L.headband === 'ninja') {
      const bw = L.headband === 'wide' ? r * 0.3 : r * 0.18;
      ctx.save(); ctx.clip(head);
      ctx.fillStyle = L.headbandColor; ctx.beginPath(); ctx.moveTo(hx - r * 1.2, hy + r * 0.42); ctx.lineTo(hx + r * 1.2, hy + r * 0.48); ctx.lineTo(hx + r * 1.2, hy + r * 0.48 + bw); ctx.lineTo(hx - r * 1.2, hy + r * 0.42 + bw); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(hx - r * 1.2, hy + r * 0.42, r * 2.4, bw * 0.28);
      ctx.restore();
      ctx.strokeStyle = OL; ctx.lineWidth = olW * 1.2; ctx.beginPath(); ctx.moveTo(hx - r * 0.98, hy + r * 0.42); ctx.lineTo(hx + r * 0.88, hy + r * 0.47); ctx.moveTo(hx - r * 1.0, hy + r * 0.42 + bw); ctx.lineTo(hx + r * 0.84, hy + r * 0.47 + bw); ctx.stroke();
    }
    if (L.headband === 'bandana') {
      const cap = hairCap(hx, hy, r, 0.1, 0.6);
      ctx.lineWidth = olW * 2; ctx.strokeStyle = OL; ctx.stroke(cap); ctx.fillStyle = L.headbandColor; ctx.fill(cap);
      ctx.save(); ctx.clip(cap); ctx.fillStyle = 'rgba(255,255,255,0.45)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(hx - r * 0.6 + i * r * 0.28, hy + r * (0.7 + (i % 2) * 0.22), r * 0.05, 0, TAU); ctx.fill(); } ctx.restore();
      ctx.fillStyle = L.headbandColor; ctx.beginPath(); ctx.moveTo(hx - r * 0.9, hy + r * 0.3); ctx.lineTo(hx - r * 1.45, hy + r * 0.05); ctx.lineTo(hx - r * 1.25, hy + r * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (L.eyewear !== 'none') {
      const ey2 = hy + r * 0.1;
      if (L.eyewear === 'goggles') {
        ctx.strokeStyle = '#111'; ctx.lineWidth = r * 0.1; ctx.beginPath(); ctx.moveTo(hx - r * 0.9, ey2 + r * 0.06); ctx.lineTo(hx + r * 0.16, ey2); ctx.stroke();
        ctx.fillStyle = 'rgba(190,230,255,0.42)'; ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = r * 0.07;
        [[hx - r * 0.04, 0.95], [hx + r * 0.49, 0.75]].forEach(([x, s]) => { ctx.beginPath(); ctx.ellipse(x, ey2, r * 0.2 * s, r * 0.18, 0, 0, TAU); ctx.fill(); ctx.stroke(); });
      } else if (L.eyewear === 'shades') {
        ctx.fillStyle = '#0d0d10'; ctx.beginPath(); ctx.moveTo(hx - r * 0.24, ey2 + r * 0.12); ctx.lineTo(hx + r * 0.74, ey2 + r * 0.14); ctx.lineTo(hx + r * 0.68, ey2 - r * 0.12); ctx.lineTo(hx - r * 0.2, ey2 - r * 0.1); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#0d0d10'; ctx.lineWidth = r * 0.07; ctx.beginPath(); ctx.moveTo(hx + r * 0.14, ey2 + r * 0.1); ctx.lineTo(hx - r * 0.7, ey2 + r * 0.12); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(hx + r * 0.58, ey2 + r * 0.02, r * 0.14, r * 0.05);
      } else if (L.eyewear === 'visor') {
        ctx.save(); ctx.shadowColor = '#2ec5ff'; ctx.shadowBlur = 12; ctx.fillStyle = 'rgba(46,197,255,0.85)';
        ctx.beginPath(); ctx.moveTo(hx - r * 0.2, ey2 + r * 0.15); ctx.lineTo(hx + r * 1.0, ey2 + r * 0.13); ctx.lineTo(hx + r * 0.94, ey2 - r * 0.12); ctx.lineTo(hx - r * 0.2, ey2 - r * 0.1); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
  }

  function drawFacial(ctx, L, hx, hy, r) {
    if (L.facial === 'none') return;
    const c = L.hairColor === '#d8d8d8' ? '#9a9a9a' : L.hairColor;
    ctx.save(); ctx.fillStyle = c;
    const beard = (big) => {
      const p = new Path2D();
      p.moveTo(hx - r * 0.49, hy - r * 0.08);
      p.bezierCurveTo(hx - r * 0.64, hy - r * 0.46, hx - r * 0.32, hy - r * (0.82 + big * 0.2), hx + r * 0.12, hy - r * (0.98 + big * 0.32));
      p.bezierCurveTo(hx + r * 0.57, hy - r * (0.98 + big * 0.25), hx + r * 0.72, hy - r * 0.64, hx + r * 0.68, hy - r * 0.35);
      p.quadraticCurveTo(hx + r * 0.44, hy - r * 0.32, hx + r * 0.16, hy - r * 0.35);
      p.quadraticCurveTo(hx - r * 0.3, hy - r * 0.34, hx - r * 0.35, hy - r * 0.08);
      p.closePath(); return p;
    };
    switch (L.facial) {
      case 'stubble': ctx.globalAlpha *= 0.32; ctx.fill(beard(0)); break;
      case 'mustache': ctx.beginPath(); ctx.ellipse(hx + r * 0.33, hy - r * 0.36, r * 0.24, r * 0.075, -0.08, 0, TAU); ctx.fill(); break;
      case 'goatee':
        ctx.beginPath(); ctx.ellipse(hx + r * 0.33, hy - r * 0.36, r * 0.22, r * 0.065, -0.08, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(hx + r * 0.16, hy - r * 0.8, r * 0.19, r * 0.15, 0.1, 0, TAU); ctx.fill(); break;
      case 'chinstrap':
        ctx.strokeStyle = c; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.moveTo(hx - r * 0.48, hy - r * 0.04); ctx.bezierCurveTo(hx - r * 0.65, hy - r * 0.6, hx + r * 0.1, hy - r * 1.08, hx + r * 0.58, hy - r * 0.7); ctx.stroke(); break;
      case 'beard': case 'bigbeard': {
        ctx.fill(beard(L.facial === 'bigbeard' ? 1 : 0));
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(hx + r * 0.3, hy - r * 0.85, r * 0.45, r * 0.18, 0.1, 0, TAU); ctx.fill();
        ctx.fillStyle = L.skin; ctx.beginPath(); ctx.ellipse(hx + r * 0.3, hy - r * 0.53, r * 0.2, r * 0.08, 0, 0, TAU); ctx.fill();
        break;
      }
      default: break;
    }
    ctx.restore();
  }

  function drawHairTop(ctx, L, hx, hy, r, olW, time, head) {
    const c = L.hairColor;
    ctx.save(); ctx.lineWidth = olW * 1.8; ctx.strokeStyle = OL; ctx.fillStyle = c;
    const capDraw = (t, front, alpha) => {
      const p = hairCap(hx, hy, r, t, front);
      if (alpha != null) { ctx.save(); ctx.globalAlpha *= alpha; ctx.fill(p); ctx.restore(); }
      else { ctx.stroke(p); ctx.fill(p); }
      // a little shine on top
      if (FINE) { ctx.save(); ctx.clip(p); ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.beginPath(); ctx.ellipse(hx + r * 0.1, hy + r * (0.95 + t), r * 0.45, r * 0.12, -0.15, 0, TAU); ctx.fill(); ctx.restore(); }
      return p;
    };
    switch (L.hair) {
      case 'bald': ctx.fillStyle = 'rgba(255,255,255,0.24)'; ctx.beginPath(); ctx.ellipse(hx + r * 0.12, hy + r * 0.72, r * 0.3, r * 0.12, -0.3, 0, TAU); ctx.fill(); break;
      case 'buzz': { const p = capDraw(0.02, 0.25, 0.72); ctx.save(); ctx.clip(p); ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 26; i++) { ctx.fillRect(hx - r * 0.9 + (i * 0.37 % 1.7) * r, hy + r * (0.2 + (i * 0.53 % 0.9)), r * 0.05, r * 0.05); } ctx.restore(); break; }
      case 'fade': {
        const p = hairCap(hx, hy, r, 0.08, 0.3);
        ctx.save(); ctx.clip(p);
        const g = ctx.createLinearGradient(0, hy + r * 1.1, 0, hy - r * 0.3);
        g.addColorStop(0, c); g.addColorStop(0.45, c); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fill(p); ctx.restore();
        ctx.save(); ctx.globalAlpha *= 0.6; ctx.stroke(p); ctx.restore();
        break;
      }
      case 'waves': { const p = capDraw(0.06, 0.3); ctx.save(); ctx.clip(p); ctx.strokeStyle = shade(c, 0.28); ctx.lineWidth = r * 0.05; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(hx - r * 0.15, hy + r * 0.1, r * (0.45 + i * 0.16), Math.PI * 0.2, Math.PI * 0.82); ctx.stroke(); } ctx.restore(); break; }
      case 'curly': {
        capDraw(0.1, 0.32);
        for (let i = 0; i < 9; i++) { const a = Math.PI * (0.06 + i * 0.105); const x = hx - r * 0.06 + Math.cos(a) * r * 1.02, y = hy + r * 0.2 + Math.sin(a) * r * 0.98; ctx.beginPath(); ctx.arc(x, y, r * 0.19, 0, TAU); ctx.stroke(); ctx.fill(); }
        break;
      }
      case 'flattop': {
        const p = new Path2D(); p.moveTo(hx + r * 0.7, hy + r * 0.56); p.lineTo(hx + r * 0.72, hy + r * 1.4); p.lineTo(hx - r * 0.8, hy + r * 1.43); p.quadraticCurveTo(hx - r * 0.98, hy + r * 0.85, hx - r * 0.88, hy + r * 0.25); p.lineTo(hx - r * 0.65, hy - r * 0.16); p.lineTo(hx - r * 0.46, hy - r * 0.14); p.lineTo(hx - r * 0.43, hy + r * 0.35); p.quadraticCurveTo(hx - r * 0.06, hy + r * 0.63, hx + r * 0.7, hy + r * 0.56); p.closePath();
        ctx.stroke(p); ctx.fill(p); ctx.save(); ctx.clip(p); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(hx - r, hy + r * 1.3, r * 2, r * 0.2); ctx.restore();
        break;
      }
      case 'afro': case 'bigfro': capDraw(0.12, 0.34); break;
      case 'cornrows': { const p = capDraw(0.04, 0.32); ctx.save(); ctx.clip(p); ctx.strokeStyle = shade(c, 0.32); ctx.lineWidth = r * 0.05; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(hx + r * (0.62 - i * 0.06), hy + r * (0.5 + i * 0.1)); ctx.quadraticCurveTo(hx - r * 0.1, hy + r * (1.05 + i * 0.02), hx - r * 0.95, hy + r * (0.35 - i * 0.12)); ctx.stroke(); } ctx.restore(); break; }
      case 'locs': capDraw(0.08, 0.32); break;
      case 'twists': {
        capDraw(0.06, 0.3);
        for (let i = 0; i < 10; i++) { const a = Math.PI * (0.06 + i * 0.095); const x1 = hx - r * 0.06 + Math.cos(a) * r * 0.98, y1 = hy + r * 0.2 + Math.sin(a) * r * 0.98; const x2 = x1 + Math.cos(a) * r * 0.42, y2 = y1 + Math.sin(a) * r * 0.42; ctx.strokeStyle = OL; ctx.lineWidth = r * 0.22; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = r * 0.14; ctx.stroke(); }
        break;
      }
      case 'mohawk': {
        capDraw(0.01, 0.2, 0.4);
        const p = new Path2D(); p.moveTo(hx + r * 0.55, hy + r * 0.8);
        for (let i = 0; i <= 5; i++) { const a = Math.PI * (0.3 + i * 0.13); p.lineTo(hx + Math.cos(a) * r * 1.62, hy + r * 0.12 + Math.sin(a) * r * 1.62); p.lineTo(hx + Math.cos(a + 0.07) * r * 1.0, hy + r * 0.12 + Math.sin(a + 0.07) * r * 1.0); }
        p.closePath(); ctx.stroke(p); ctx.fill(p); break;
      }
      case 'spiky': {
        capDraw(0.08, 0.3);
        const p = new Path2D(); for (let i = 0; i < 7; i++) { const a = Math.PI * (0.12 + i * 0.12); p.moveTo(hx + Math.cos(a - 0.12) * r * 0.98, hy + r * 0.12 + Math.sin(a - 0.12) * r * 0.98); p.lineTo(hx + Math.cos(a) * r * 1.55, hy + r * 0.12 + Math.sin(a) * r * 1.55); p.lineTo(hx + Math.cos(a + 0.12) * r * 0.98, hy + r * 0.12 + Math.sin(a + 0.12) * r * 0.98); }
        ctx.stroke(p); ctx.fill(p); break;
      }
      case 'ponytail': capDraw(0.06, 0.38); break;
      case 'bun': { capDraw(0.06, 0.38); ctx.beginPath(); ctx.arc(hx - r * 0.35, hy + r * 1.18, r * 0.4, 0, TAU); ctx.stroke(); ctx.fill(); break; }
      case 'long': capDraw(0.08, 0.5); break;
      case 'shaggy': {
        capDraw(0.12, 0.42);
        const p = new Path2D(); p.moveTo(hx + r * 0.1, hy + r * 1.0); p.quadraticCurveTo(hx + r * 1.0, hy + r * 0.95, hx + r * 0.95, hy + r * 0.3 + Math.sin(time * 6) * r * 0.03); p.lineTo(hx + r * 0.66, hy + r * 0.5); p.lineTo(hx + r * 0.5, hy + r * 0.38); p.closePath();
        ctx.stroke(p); ctx.fill(p); break;
      }
      case 'mullet': capDraw(0.06, 0.32); break;
      default: break;
    }
    ctx.restore();
    void head;
  }

  // ---------- the ball ----------
  A.drawBall = function (ctx, x, y, r, rot, opts) {
    opts = opts || {};
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot || 0);
    const illustrated = !opts.color && BK.assets && BK.assets.get('ball');
    if (illustrated) {
      ctx.drawImage(illustrated, -r, -r, r * 2, r * 2);
      ctx.restore(); return;
    }
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
    const base = opts.color || '#f07a1a';
    g.addColorStop(0, shade(base, 0.35)); g.addColorStop(0.6, base); g.addColorStop(1, shade(base, -0.35));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(30,14,6,0.85)'; ctx.lineWidth = Math.max(1, r * 0.11);
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
    ctx.beginPath(); ctx.arc(-r * 1.25, 0, r * 0.95, -0.85, 0.85); ctx.stroke();
    ctx.beginPath(); ctx.arc(r * 1.25, 0, r * 0.95, Math.PI - 0.85, Math.PI + 0.85); ctx.stroke();
    ctx.strokeStyle = 'rgba(20,10,4,0.9)'; ctx.lineWidth = Math.max(1, r * 0.08); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.restore();
  };

  // ---------- crew logos (unit box -1..1) ----------
  A.drawLogo = function (ctx, id, x, y, size, c1, c2) {
    ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.fillStyle = c2 || '#111'; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
    ctx.lineWidth = 0.1; ctx.strokeStyle = c1 || '#fff'; ctx.beginPath(); ctx.arc(0, 0, 0.9, 0, TAU); ctx.stroke();
    ctx.fillStyle = c1 || '#fff'; ctx.beginPath();
    switch (id) {
      case 'crown': ctx.moveTo(-0.6, 0.35); ctx.lineTo(-0.66, -0.35); ctx.lineTo(-0.3, 0.0); ctx.lineTo(0, -0.5); ctx.lineTo(0.3, 0.0); ctx.lineTo(0.66, -0.35); ctx.lineTo(0.6, 0.35); ctx.closePath(); ctx.fill(); ctx.fillRect(-0.6, 0.42, 1.2, 0.14); break;
      case 'flame': ctx.moveTo(0, -0.7); ctx.bezierCurveTo(0.6, -0.2, 0.55, 0.3, 0.3, 0.6); ctx.bezierCurveTo(0.35, 0.2, 0.1, 0.1, 0.05, -0.1); ctx.bezierCurveTo(0, 0.2, -0.3, 0.3, -0.2, 0.62); ctx.bezierCurveTo(-0.6, 0.35, -0.5, -0.1, 0, -0.7); ctx.fill(); break;
      case 'bolt': ctx.moveTo(0.15, -0.72); ctx.lineTo(-0.4, 0.08); ctx.lineTo(-0.02, 0.08); ctx.lineTo(-0.18, 0.72); ctx.lineTo(0.42, -0.12); ctx.lineTo(0.04, -0.12); ctx.closePath(); ctx.fill(); break;
      case 'star': for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? 0.3 : 0.7; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); break;
      case 'wing': ctx.moveTo(-0.6, 0.3); ctx.quadraticCurveTo(-0.3, -0.6, 0.65, -0.55); ctx.quadraticCurveTo(0.3, -0.35, 0.55, -0.25); ctx.quadraticCurveTo(0.2, -0.1, 0.45, 0.05); ctx.quadraticCurveTo(0.1, 0.12, 0.3, 0.3); ctx.closePath(); ctx.fill(); break;
      case 'diamond': ctx.moveTo(0, -0.7); ctx.lineTo(0.5, -0.15); ctx.lineTo(0, 0.7); ctx.lineTo(-0.5, -0.15); ctx.closePath(); ctx.fill(); break;
      case 'fist': A.roundRect(ctx, -0.45, -0.4, 0.9, 0.6, 0.15); ctx.fill(); ctx.fillRect(-0.3, 0.15, 0.6, 0.45); ctx.fillStyle = c2 || '#111'; for (let i = 0; i < 3; i++) ctx.fillRect(-0.18 + i * 0.25, -0.38, 0.04, 0.3); break;
      case 'moon': ctx.arc(0, 0, 0.62, 0, TAU); ctx.fill(); ctx.fillStyle = c2 || '#111'; ctx.beginPath(); ctx.arc(0.28, -0.18, 0.55, 0, TAU); ctx.fill(); break;
      case 'wave': ctx.moveTo(-0.7, 0.4); ctx.quadraticCurveTo(-0.5, -0.6, 0.2, -0.55); ctx.quadraticCurveTo(0.7, -0.5, 0.55, -0.05); ctx.quadraticCurveTo(0.3, -0.35, 0.05, -0.15); ctx.quadraticCurveTo(0.35, 0.1, 0.7, 0.4); ctx.closePath(); ctx.fill(); break;
      case 'eye': ctx.moveTo(-0.7, 0); ctx.quadraticCurveTo(0, -0.65, 0.7, 0); ctx.quadraticCurveTo(0, 0.65, -0.7, 0); ctx.fill(); ctx.fillStyle = c2 || '#111'; ctx.beginPath(); ctx.arc(0, 0, 0.24, 0, TAU); ctx.fill(); break;
      case 'gear': for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; const rr = i % 2 ? 0.5 : 0.7; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.fillStyle = c2 || '#111'; ctx.beginPath(); ctx.arc(0, 0, 0.2, 0, TAU); ctx.fill(); break;
      case 'paw': ctx.ellipse(0, 0.2, 0.32, 0.28, 0, 0, TAU); ctx.fill(); [[-0.42, -0.15], [-0.15, -0.45], [0.15, -0.45], [0.42, -0.15]].forEach(([px, py]) => { ctx.beginPath(); ctx.arc(px, py, 0.14, 0, TAU); ctx.fill(); }); break;
      default: ctx.arc(0, 0, 0.5, 0, TAU); ctx.fill();
    }
    ctx.restore();
  };

  A.drawImageCover = function (ctx, image, box) {
    const scale = Math.max(box.w / image.naturalWidth, box.h / image.naturalHeight);
    const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
    ctx.drawImage(image, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
  };
  // A trading card: the player from the thighs up, ball on the hip, over a cel-shaded backdrop:
  // flat crew color, a flat burst behind the head, one hard shadow plane with halftone, a trim slash.
  A.drawPortrait = function (ctx, player, colors, box, opts) {
    opts = opts || {};
    const d = A.dims(player.hgt, player.build);
    const pri = colors.pri, sec = colors.sec;
    const px = opts.px || 0.36, facing = opts.facing === -1 ? -1 : 1;
    const X = (k) => box.x + box.w * k, bottom = box.y + box.h;
    ctx.save();
    ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
    const room = opts.backgroundKey && BK.assets && BK.assets.get(opts.backgroundKey);
    if (room) A.drawImageCover(ctx, room, box);
    else {
    // a player facing left gets the backdrop mirrored; the player is turned, never flipped, so numbers read right
    ctx.save();
    if (facing === -1) { ctx.translate(box.x * 2 + box.w, 0); ctx.scale(-1, 1); }
    ctx.fillStyle = shade(pri, -0.06); ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.fillStyle = shade(pri, 0.16); ctx.beginPath(); ctx.arc(X(px + 0.14), box.y + box.h * 0.3, Math.min(box.w * 0.5, box.h * 0.42), 0, TAU); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.moveTo(X(px + 0.4), box.y); ctx.lineTo(box.x + box.w, box.y); ctx.lineTo(box.x + box.w, bottom); ctx.lineTo(X(px + 0.08), bottom); ctx.closePath();
    ctx.fillStyle = shade(pri, -0.36); ctx.fill(); ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    const dot = Math.max(3, Math.min(box.w, box.h) / 26);
    for (let yy = box.y; yy < bottom + dot; yy += dot) for (let xx = box.x + (Math.round((yy - box.y) / dot) % 2) * dot / 2; xx < box.x + box.w + dot; xx += dot) { ctx.beginPath(); ctx.arc(xx, yy, dot * 0.24, 0, TAU); ctx.fill(); }
    ctx.restore();
    ctx.globalAlpha = 0.9; ctx.fillStyle = sec === pri ? shade(pri, 0.4) : sec;
    ctx.beginPath(); ctx.moveTo(X(px + 0.33), box.y); ctx.lineTo(X(px + 0.38), box.y); ctx.lineTo(X(px + 0.06), bottom); ctx.lineTo(X(px + 0.01), bottom); ctx.closePath(); ctx.fill();
    ctx.restore();
    // the player
    }
    // frame from the hips up so the face carries the card
    const visible = d.H * 0.56 + 0.3;
    const scale = box.h * 0.95 / visible;
    const footY = box.y + box.h * 0.05 + (d.H + 0.25) * scale;
    const pose = A.pose('card', { dims: d, time: opts.time || 1.2 });
    const hands = A.drawBaller(ctx, { x: X(facing === 1 ? px : 1 - px), y: footY, scale, hgt: player.hgt, build: player.build, look: player.look, num: player.num, colors, facing, pose, dims: d, time: opts.time || 1.2 });
    if (opts.ball !== false) A.drawBall(ctx, hands.handF[0] + scale * 0.32 * facing, hands.handF[1] - scale * 0.05, scale * 0.5, 0.5);
    // a hard floor band so the card sits on something
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(box.x, box.y + box.h * 0.88, box.w, box.h * 0.12);
    ctx.restore();
  };

  // Draw a standing baller centered in a box (menus, cards, the creator).
  A.drawCard = function (ctx, player, colors, box, opts) {
    opts = opts || {};
    const d = A.dims(player.hgt, player.build);
    const scale = opts.scale || (box.h * 0.9) / Math.max(6.6, player.hgt / 12 + 0.5);
    const pose = A.pose(opts.pose || 'idle', { dims: d, time: opts.time || 0, style: opts.style, t: opts.t || 0 });
    const footY = box.y + box.h - box.h * 0.04;
    return A.drawBaller(ctx, {
      x: box.x + box.w / 2 - (opts.facing === -1 ? -0.2 : 0.2) * scale, y: footY, scale, hgt: player.hgt, build: player.build, look: player.look, num: player.num,
      colors, facing: opts.facing || 1, pose, dims: d, time: opts.time || 0,
    });
  };
})(window.BK = window.BK || {});
