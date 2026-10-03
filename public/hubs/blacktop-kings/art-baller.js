/* Blacktop Kings — the ballers. Every player is drawn from shapes in canvas: no images.
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
  // Stylized athlete proportions, in feet. u scales everything to the player's height.
  // sw/ww/hw: shoulder, waist, and hip width as seen in the three-quarter view.
  const BUILD = {
    lean: { sw: 1.34, ww: 0.84, hw: 0.9, arm: 0.165, thigh: 0.27, calf: 0.2, belly: 0, neck: 0.17 },
    athletic: { sw: 1.5, ww: 0.92, hw: 0.96, arm: 0.19, thigh: 0.3, calf: 0.22, belly: 0, neck: 0.2 },
    strong: { sw: 1.66, ww: 1.02, hw: 1.04, arm: 0.23, thigh: 0.33, calf: 0.245, belly: 0.03, neck: 0.24 },
    heavy: { sw: 1.62, ww: 1.32, hw: 1.24, arm: 0.235, thigh: 0.37, calf: 0.26, belly: 0.2, neck: 0.25 },
  };
  A.dims = function (hgtIn, build) {
    const H = (hgtIn || 76) / 12;
    const b = BUILD[build] || BUILD.athletic;
    const u = H / 6.5;
    return {
      H, b, u, k: u,
      foot: 0.32 * u, thigh: 1.58 * u, shin: 1.57 * u, leg: 3.15 * u,
      torso: 1.72 * u, neck: 0.2 * u, headR: Math.max(0.47, 0.5 * Math.pow(u, 0.6)),
      upper: 1.15 * u, fore: 1.12 * u,
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

  // ---------- poses ----------
  // Every pose returns: pelvis [x,y], lean (rad, + forward), tilt (head), footF/footB, handF/handB,
  // armSign F/B (elbow bend direction), legSign (knee direction), and optional extras.
  A.pose = function (kind, o) {
    o = o || {};
    const d = o.dims; const t = o.t || 0; const time = o.time || 0;
    const stand = d.foot + d.leg * 0.97;
    const P = { pelvis: [0, stand], lean: 0.04, tilt: 0, footF: [0.32, 0], footB: [-0.28, 0], handF: [0.25, stand * 0.92], handB: [-0.18, stand * 0.92], armF: -1, armB: -1, legF: 1, legB: 1 };
    const chestY = () => P.pelvis[1] + d.torso;
    const bob = Math.sin(time * 3.2) * 0.03;
    switch (kind) {
      case 'idle': {
        // athletic stance: knees soft, feet apart, hands off the jersey
        P.pelvis = [0, stand - 0.16 + bob]; P.lean = 0.1;
        P.footF = [0.42, 0]; P.footB = [-0.36, 0];
        P.handF = [0.84, P.pelvis[1] - 0.6 + bob]; P.handB = [-0.7, P.pelvis[1] - 0.52 + bob]; P.armF = -1; P.armB = -1;
        break;
      }
      case 'card': {
        // trading-card pose: ball on the hip, other hand at the side
        P.pelvis = [0, stand - 0.1]; P.lean = 0.02; P.tilt = 0.12;
        P.footF = [0.38, 0]; P.footB = [-0.32, 0];
        P.handF = [1.3, P.pelvis[1] + d.torso * 0.08]; P.handB = [-0.88, P.pelvis[1] + 0.02]; P.armF = -1; P.armB = -1;
        break;
      }
      case 'defend': {
        const slide = Math.sin(time * 9) * 0.06;
        P.pelvis = [0, stand - d.leg * 0.2 + bob]; P.lean = 0.3;
        P.footF = [0.75 + slide, 0]; P.footB = [-0.65 + slide, 0];
        // wide stance, active hands out to both sides
        const shY = P.pelvis[1] + d.torso * 0.84, w = Math.sin(time * 5) * 0.15;
        P.handF = [2.15 * d.u, shY - 0.75 * d.u + w]; P.handB = [-1.95 * d.u, shY - 0.55 * d.u - w]; P.armF = -1; P.armB = 1;
        break;
      }
      case 'run': {
        const ph = o.phase || 0; const sp = clamp(o.speed || 1, 0.3, 1.6);
        const stride = 0.65 + 0.45 * sp, lift = 0.32 + 0.28 * sp;
        P.pelvis = [0, stand - 0.1 - Math.abs(Math.sin(ph)) * 0.12 * sp]; P.lean = 0.12 + 0.14 * sp;
        P.footF = [Math.cos(ph) * stride, Math.max(0, Math.sin(ph)) * lift];
        P.footB = [Math.cos(ph + Math.PI) * stride, Math.max(0, Math.sin(ph + Math.PI)) * lift];
        // elbows bent about 90 degrees, hands pumping from the hip to chest height
        const shY = P.pelvis[1] + d.torso * 0.84, k = d.u;
        const sF = -Math.cos(ph) * Math.min(1, sp), sB = -sF;
        P.handF = [0.6 + sF * 0.8 * k + 0.15, shY - (1.3 - Math.max(0, sF) * 0.35) * k];
        P.handB = [-0.55 + sB * 0.8 * k + 0.15, shY - (1.3 - Math.max(0, sB) * 0.35) * k];
        P.armF = -1; P.armB = -1;
        break;
      }
      case 'crouch': {
        P.pelvis = [0, stand - d.leg * 0.3]; P.lean = 0.35; P.footF = [0.45, 0]; P.footB = [-0.35, 0];
        P.handF = [0.6, P.pelvis[1] + 0.3]; P.handB = [0.3, P.pelvis[1] + 0.2];
        break;
      }
      case 'jumpshot': {
        // t: 0 crouch -> 0.18 takeoff -> 0.55 release -> 1 land
        const crouch = t < 0.18 ? Math.sin(t / 0.18 * Math.PI) * 0.22 : 0;
        P.pelvis = [0, stand - d.leg * crouch]; P.lean = t < 0.18 ? 0.25 : -0.05;
        const air = t > 0.18 && t < 0.92;
        P.footF = air ? [0.18, -0.2] : [0.3, 0]; P.footB = air ? [-0.1, -0.1] : [-0.25, 0];
        if (air) { P.footF = [0.15, P.pelvis[1] - d.leg * 0.9]; P.footB = [-0.12, P.pelvis[1] - d.leg * 0.92]; }
        const top = P.pelvis[1] + d.torso;
        const rel = o.released;
        const k = clamp((t - 0.12) / 0.35, 0, 1);
        P.handF = rel ? [0.55, top + d.upper + d.fore * 0.95] : [lerp(0.4, 0.2, k), lerp(top - 0.3, top + d.upper + 0.55, k)];
        P.handB = rel ? [0.15, top + d.upper * 0.8] : [lerp(0.25, 0.05, k), lerp(top - 0.4, top + d.upper + 0.35, k)];
        P.armF = 1; P.armB = 1; P.tilt = 0.15;
        break;
      }
      case 'layup': {
        P.pelvis = [0, stand]; P.lean = -0.05;
        P.footF = [0.5, P.pelvis[1] - d.leg * 0.45]; P.footB = [-0.25, P.pelvis[1] - d.leg * 0.98]; P.legF = 1;
        const top = P.pelvis[1] + d.torso;
        const k = clamp(t * 1.6, 0, 1);
        P.handF = [lerp(0.3, 0.75, k), lerp(top, top + d.upper + d.fore * 0.95, k)]; P.handB = [-0.2, top - 0.6];
        P.armF = 1; P.armB = -1; P.tilt = 0.2;
        break;
      }
      case 'dunk': {
        poseDunk(P, d, t, o.style || 'twohand', stand);
        break;
      }
      case 'hang': {
        P.pelvis = [0, stand]; P.lean = -0.1;
        const sw = Math.sin(time * 6) * 0.25;
        P.footF = [0.3 + sw, P.pelvis[1] - d.leg * 0.85]; P.footB = [-0.1 + sw * 0.7, P.pelvis[1] - d.leg * 0.88];
        const top = P.pelvis[1] + d.torso;
        P.handF = [0.55, top + d.upper + d.fore * 0.9]; P.handB = [0.3, top + d.upper + d.fore * 0.92]; P.armF = 1; P.armB = 1; P.tilt = 0.25;
        break;
      }
      case 'block': {
        P.pelvis = [0, stand]; P.lean = -0.08;
        P.footF = [0.3, P.pelvis[1] - d.leg * 0.85]; P.footB = [-0.2, P.pelvis[1] - d.leg * 0.95];
        const top = P.pelvis[1] + d.torso; const swat = o.swat || 0;
        P.handF = [lerp(0.35, 1.2, swat), top + d.upper + d.fore * lerp(0.95, 0.6, swat)]; P.handB = [0.05, top + d.upper + d.fore * 0.85];
        P.armF = 1; P.armB = 1; P.tilt = 0.3;
        break;
      }
      case 'rebound': {
        P.pelvis = [0, stand]; P.lean = 0;
        P.footF = [0.25, P.pelvis[1] - d.leg * 0.8]; P.footB = [-0.25, P.pelvis[1] - d.leg * 0.82];
        const top = P.pelvis[1] + d.torso;
        P.handF = [0.45, top + d.upper + d.fore * 0.9]; P.handB = [0.15, top + d.upper + d.fore * 0.88]; P.armF = 1; P.armB = 1; P.tilt = 0.35;
        break;
      }
      case 'steal': {
        const k = Math.sin(clamp(t, 0, 1) * Math.PI);
        P.pelvis = [0.15 * k, stand - d.leg * 0.22 * k]; P.lean = 0.2 + 0.4 * k;
        P.footF = [0.4 + 0.7 * k, 0]; P.footB = [-0.45, 0];
        P.handF = [lerp(0.8, 2.2, k), lerp(stand, stand * 0.55, k)]; P.handB = [-0.95, stand * 0.95]; P.armF = -1;
        break;
      }
      case 'pass': {
        const k = Math.sin(clamp(t, 0, 1) * Math.PI);
        P.pelvis = [0, stand - 0.05]; P.lean = 0.12 + 0.1 * k; P.footF = [0.55, 0]; P.footB = [-0.3, 0];
        const cy = P.pelvis[1] + d.torso * 0.75;
        P.handF = [lerp(1.0, 2.5, k), cy]; P.handB = [lerp(0.5, 2.2, k), cy + 0.12]; P.armF = -1; P.armB = -1;
        break;
      }
      case 'catch': {
        P.pelvis = [0, stand - 0.1]; P.lean = 0.1;
        const cy = P.pelvis[1] + d.torso * 0.75;
        P.handF = [0.9, cy + 0.1]; P.handB = [0.75, cy - 0.05]; P.armF = -1; P.armB = -1;
        break;
      }
      case 'stumble': {
        const w = Math.sin(time * 18);
        P.pelvis = [-0.2, stand - 0.25]; P.lean = -0.35 + w * 0.1;
        P.footF = [0.2 + w * 0.2, 0]; P.footB = [0.35 - w * 0.2, 0.05];
        const cy = P.pelvis[1] + d.torso;
        P.handF = [0.9 + w * 0.3, cy + 0.6]; P.handB = [-1.3, cy + 0.3 - w * 0.3]; P.armF = 1; P.armB = 1; P.tilt = -0.3;
        break;
      }
      case 'fallen': {
        P.pelvis = [-0.35, 0.42]; P.lean = -0.65;
        P.footF = [1.9, 0.08]; P.footB = [1.55, 0.2]; P.legF = 1; P.legB = 1;
        P.handF = [-1.05, 0.12]; P.handB = [-1.25, 0.15]; P.armF = 1; P.armB = 1; P.tilt = -0.45;
        break;
      }
      case 'celebrate': poseCelebrate(P, d, o.style || 'flex', time, stand); break;
      case 'trick': poseTrick(P, d, o.style || 'cross', t, stand, time); break;
      case 'walk': {
        const ph = o.phase || 0;
        P.pelvis = [0, stand - Math.abs(Math.sin(ph)) * 0.05];
        P.footF = [Math.cos(ph) * 0.45, Math.max(0, Math.sin(ph)) * 0.2]; P.footB = [Math.cos(ph + Math.PI) * 0.45, Math.max(0, Math.sin(ph + Math.PI)) * 0.2];
        P.handF = [-Math.cos(ph) * 0.3 + 0.1, stand * 0.88]; P.handB = [Math.cos(ph) * 0.3 - 0.1, stand * 0.9];
        break;
      }
      default: break;
    }
    if (o.ballHand) { P.handF = o.ballHand; }
    if (o.ballHandB) { P.handB = o.ballHandB; }
    return P;
  };

  function poseDunk(P, d, t, style, stand) {
    // t 0..1 across the whole flight. Slam at ~0.78.
    P.pelvis = [0, stand]; P.lean = 0.05;
    const rise = clamp(t / 0.6, 0, 1);
    P.footF = [lerp(0.3, 0.75, rise), P.pelvis[1] - d.leg * lerp(0.9, 0.45, rise)];
    P.footB = [lerp(-0.2, -0.55, rise), P.pelvis[1] - d.leg * 0.95];
    const top = P.pelvis[1] + d.torso; const reach = d.upper + d.fore;
    const slam = clamp((t - 0.7) / 0.14, 0, 1);
    P.armF = 1; P.armB = 1; P.tilt = 0.2;
    const overhead = [ -0.35, top + reach * 0.85 ];
    const front = [ 0.95, top + reach * 0.45 ];
    switch (style) {
      case 'tomahawk': {
        const cock = [-0.85, top + reach * 0.7];
        P.handF = slam ? lerpPt(cock, [0.9, top + reach * 0.55], slam) : lerpPt([0.4, top], cock, rise);
        P.handB = [0.5, top + reach * 0.4]; P.lean = slam ? 0.25 : -0.12;
        break;
      }
      case 'windmill': case 'eclipse': {
        const a = -Math.PI / 2 + clamp(t / 0.78, 0, 1) * TAU * 1.05;
        const sh = [0.05, top - 0.1];
        P.handF = slam >= 1 ? [0.9, top + reach * 0.5] : [sh[0] + Math.cos(a) * reach * 0.98, sh[1] + Math.sin(a) * reach * 0.98];
        P.handB = [0.45, top + reach * 0.3]; P.armF = Math.cos(a) > 0 ? -1 : 1;
        if (style === 'eclipse') { P.footF = [0.4, P.pelvis[1] - d.leg * 0.4]; P.footB = [-0.1, P.pelvis[1] - d.leg * 0.5]; }
        break;
      }
      case 'reverse': {
        P.handF = slam ? lerpPt(overhead, [-0.4, top + reach * 0.75], slam) : lerpPt([0.4, top], [0.1, top + reach * 0.95], rise);
        P.handB = slam ? lerpPt([-0.1, top + reach * 0.9], [-0.5, top + reach * 0.6], slam) : [-0.05, top + reach * 0.9]; P.lean = -0.25;
        break;
      }
      case 'cradle': {
        const cr = clamp(t / 0.55, 0, 1);
        const low = [0.35, P.pelvis[1] - 0.2];
        P.handF = slam ? lerpPt([-0.6, top + reach * 0.7], front, slam) : cr < 1 ? lerpPt([0.5, top - 0.2], low, Math.sin(cr * Math.PI)) : lerpPt(low, [-0.6, top + reach * 0.7], clamp((t - 0.55) / 0.15, 0, 1));
        P.handB = [0.3, top + 0.2];
        break;
      }
      case 'legs': {
        const k = clamp((t - 0.2) / 0.45, 0, 1);
        P.footF = [0.9, P.pelvis[1] - d.leg * 0.55]; P.footB = [-0.8, P.pelvis[1] - d.leg * 0.6];
        P.handF = slam ? lerpPt(overhead, front, slam) : k < 1 ? [lerp(0.6, -0.1, k), lerp(top - 0.1, P.pelvis[1] - 0.3, Math.sin(k * Math.PI))] : lerpPt([-0.1, P.pelvis[1]], overhead, clamp((t - 0.65) / 0.08, 0, 1));
        P.handB = k > 0.3 && k < 0.8 ? [0.1, P.pelvis[1] - 0.25] : [-0.3, top + 0.2];
        break;
      }
      case 'spin360': default: {
        P.handF = slam ? lerpPt(overhead, front, slam) : lerpPt([0.5, top], overhead, rise);
        P.handB = slam ? lerpPt([-0.15, top + reach * 0.8], [0.75, top + reach * 0.5], slam) : lerpPt([0.3, top], [-0.15, top + reach * 0.8], rise);
        P.lean = slam ? 0.2 : -0.1;
        break;
      }
    }
    if (t > 0.86) { // hanging after the slam
      P.handF = [0.75, top + reach * 0.9]; P.handB = [0.5, top + reach * 0.88]; P.armF = 1; P.armB = 1;
      P.footF = [0.4, P.pelvis[1] - d.leg * 0.85]; P.footB = [0.05, P.pelvis[1] - d.leg * 0.9];
    }
  }

  function poseCelebrate(P, d, style, time, stand) {
    const top = stand + d.torso; const reach = d.upper + d.fore;
    const beat = Math.sin(time * 9);
    P.lean = -0.05; P.tilt = 0.15;
    switch (style) {
      case 'chest': {
        P.handF = beat > 0.3 ? [0.35, top - 0.35] : [0.7, top - 0.2]; P.handB = [-0.3, stand * 0.95]; P.armF = -1; P.tilt = 0.4; break;
      }
      case 'shush': { P.handF = [0.62, top + d.neck + d.headR * 0.4]; P.handB = [-0.3, stand * 0.92]; P.armF = -1; P.lean = 0.15; P.tilt = -0.05; break; }
      case 'roof': { const up = (beat + 1) / 2; P.handF = [0.35, top + reach * lerp(0.6, 0.95, up)]; P.handB = [0.05, top + reach * lerp(0.6, 0.95, up)]; P.armF = 1; P.armB = 1; P.tilt = 0.35; break; }
      case 'point': { P.handF = [0.75, top + reach * 0.95]; P.handB = [-0.25, stand * 0.9]; P.armF = 1; P.tilt = 0.5; break; }
      case 'shoulders': { const k = (beat + 1) / 2; P.handF = [lerp(-0.1, -0.45, k), top - 0.05]; P.handB = [-0.3, stand * 0.92]; P.armF = -1; P.lean = -0.12; P.tilt = 0.25; break; }
      case 'dance': {
        const st = Math.sin(time * 7);
        P.pelvis = [st * 0.12, stand - 0.15 - Math.abs(st) * 0.08]; P.footF = [0.45 + st * 0.3, Math.max(0, st) * 0.3]; P.footB = [-0.35 + st * 0.3, Math.max(0, -st) * 0.3];
        P.handF = [0.55 + st * 0.3, top - 0.2 + Math.abs(st) * 0.4]; P.handB = [-0.45 - st * 0.2, top - 0.3]; P.armF = -1; P.armB = 1; break;
      }
      case 'crown': {
        const k = clamp((Math.sin(time * 2.2) + 1) / 2, 0, 1);
        P.handF = [0.25, top + d.neck + d.headR * 2 + lerp(0.6, 0.05, k)]; P.handB = [-0.15, top + d.neck + d.headR * 2 + lerp(0.6, 0.05, k)]; P.armF = 1; P.armB = 1; P.tilt = 0.1; break;
      }
      case 'lock': { P.handF = [0.55, top + d.neck + d.headR * 1.3]; P.handB = [-0.25, stand * 0.92]; P.armF = 1; P.lean = 0.1; P.tilt = -0.1; break; }
      case 'flex': default: {
        P.handF = [0.35, top + 0.55 + beat * 0.05]; P.handB = [-0.45, top + 0.5]; P.armF = 1; P.armB = 1; P.tilt = 0.3; P.lean = -0.08; break;
      }
    }
  }

  function poseTrick(P, d, style, t, stand, time) {
    const k = Math.sin(clamp(t, 0, 1) * Math.PI);
    P.pelvis = [0, stand - 0.18 - 0.12 * k]; P.lean = 0.25;
    P.footF = [0.6, 0]; P.footB = [-0.5, 0];
    P.handF = [0.5, stand * 0.7]; P.handB = [-0.1, stand * 0.75];
    switch (style) {
      case 'hesi': P.pelvis[1] += 0.08 * k; P.lean = lerp(0.25, -0.05, k); P.footF = [0.4 + 0.3 * k, 0]; break;
      case 'cross': P.footF = [lerp(0.6, 0.2, k), 0]; P.footB = [lerp(-0.5, -0.8, k), 0]; P.lean = 0.3; break;
      case 'legs': P.footF = [0.85, 0]; P.footB = [-0.7, 0]; P.pelvis[1] -= 0.1; break;
      case 'behind': P.lean = 0.35; P.footF = [0.7, 0]; P.footB = [-0.4, 0]; P.handB = [-0.6, stand * 0.75]; break;
      case 'spin': case 'tornado': P.lean = 0.15; P.footF = [0.35, k * 0.15]; P.footB = [-0.35, 0]; P.handB = [-0.6, stand * 0.9 + k * 0.4]; break;
      case 'world': P.footF = [0.5, 0]; P.footB = [-0.5, 0]; break;
      case 'head': P.lean = -0.05 * k; P.pelvis[1] += 0.1; P.tilt = 0.25 * k; break;
      case 'dome': P.lean = 0.05; P.footF = [0.7, 0]; P.handB = [-0.35, stand * 0.9]; break;
      case 'juggle': P.lean = 0; P.pelvis[1] += 0.12; break;
      default: break;
    }
    void time;
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
    const skin = L.skin, skinB = shade(skin, -0.24);
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
    const ux = Math.sin(lean), uy = Math.cos(lean), nx = Math.cos(lean), ny = -Math.sin(lean);
    const TP = (a, c) => [pel[0] + ux * a + nx * c, pel[1] + uy * a + ny * c];
    const T = d.torso, sw = d.sw, ww = d.ww, hw = d.hw, B = d.belly;
    const shF = TP(T * 0.86, sw * 0.42), shB = TP(T * 0.88, -sw * 0.4);
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
      const rot = clamp((a + Math.PI / 2) * 0.3, -0.45, 0.45);
      const Ls = 0.98 * u, fh = d.foot, st = 0.11 * u, yb = -fh + st;
      const collar = L.shoes === 'high' ? 0.34 * u : L.shoes === 'mid' || L.shoes === 'glow' ? 0.18 * u : -0.02 * u;
      const sc = back ? shade(L.shoeColor, -0.22) : L.shoeColor, acc = back ? shade(L.shoeAccent, -0.22) : L.shoeAccent;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(rot);
      const up = new Path2D();
      up.moveTo(-0.37 * Ls, yb);
      up.bezierCurveTo(-0.43 * Ls, yb + 0.22 * u, -0.36 * Ls, collar - 0.05 * u, -0.24 * Ls, collar + 0.03 * u);
      up.lineTo(0.05 * Ls, collar);
      up.bezierCurveTo(0.2 * Ls, collar - 0.06 * u, 0.3 * Ls, yb + 0.34 * u, 0.46 * Ls, yb + 0.29 * u);
      up.bezierCurveTo(0.66 * Ls, yb + 0.24 * u, 0.7 * Ls, yb + 0.06 * u, 0.64 * Ls, yb);
      up.closePath();
      ctx.lineWidth = olW * 2; ctx.strokeStyle = OL; ctx.stroke(up);
      ctx.fillStyle = sc; ctx.fill(up);
      if (!FINE) {
        ctx.fillStyle = acc; ctx.beginPath(); ctx.ellipse(0.6 * Ls, yb + 0.05 * u, 0.12 * Ls, 0.08 * u, 0, 0, TAU); ctx.fill();
        ctx.fillRect(-0.36 * Ls, yb + 0.06 * u, 0.62 * Ls, 0.07 * u);
      } else {
      ctx.save(); ctx.clip(up);
      ctx.fillStyle = acc;
      ctx.beginPath(); ctx.ellipse(0.66 * Ls, yb, 0.14 * Ls, 0.1 * u, 0, 0, TAU); ctx.fill(); // toe cap
      ctx.beginPath(); ctx.ellipse(-0.42 * Ls, yb + 0.12 * u, 0.12 * Ls, 0.2 * u, 0, 0, TAU); ctx.fill(); // heel counter
      ctx.fillRect(-0.3 * Ls, yb + 0.05 * u, 0.72 * Ls, 0.06 * u); // side band
      ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(-0.5 * Ls, yb, Ls * 1.3, 0.06 * u);
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.ellipse(0.4 * Ls, yb + 0.2 * u, 0.12 * Ls, 0.035 * u, -0.25, 0, TAU); ctx.fill();
      ctx.restore();
      }
      // laces
      if (L.shoes !== 'low' && FINE) {
        ctx.strokeStyle = back ? '#c9c9c9' : '#ffffff'; ctx.lineWidth = 0.04 * u;
        for (let i = 0; i < 3; i++) { const t = i / 3; const lx = lerp(0.08, 0.36, t) * Ls, ly = lerp(collar - 0.04 * u, yb + 0.3 * u, t); ctx.beginPath(); ctx.moveTo(lx - 0.05 * u, ly + 0.03 * u); ctx.lineTo(lx + 0.05 * u, ly - 0.03 * u); ctx.stroke(); }
      }
      // sole
      const sole = new Path2D(); const sx0 = -0.41 * Ls, sx1 = 0.69 * Ls;
      sole.moveTo(sx0 + st * 0.5, -fh); sole.lineTo(sx1 - st * 0.6, -fh); sole.quadraticCurveTo(sx1 + st * 0.3, -fh, sx1, yb + st * 0.1);
      sole.lineTo(sx0, yb); sole.quadraticCurveTo(sx0 - st * 0.2, -fh, sx0 + st * 0.5, -fh); sole.closePath();
      ctx.lineWidth = olW * 2; ctx.strokeStyle = OL; ctx.stroke(sole);
      ctx.fillStyle = L.shoes === 'glow' ? '#7df9ff' : back ? '#d6d6d6' : '#f6f6f2'; ctx.fill(sole);
      if (L.shoes === 'glow' && !back) { ctx.save(); ctx.shadowColor = '#7df9ff'; ctx.shadowBlur = 12; ctx.fill(sole); ctx.restore(); }
      ctx.restore();
    };

    const shortsLen = { short: 0.34, mid: 0.54, long: 0.72, baggy: 0.82 }[L.shorts] || 0.54;
    const shortsK = { short: 1.24, mid: 1.36, long: 1.4, baggy: 1.6 }[L.shorts] || 1.36;
    const drawLeg = (j, back) => {
      const sk = back ? skinB : skin;
      const tr = d.thighR, kr = d.thighR * 0.66, ar = d.calfR * 0.56;
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
    const drawHand = (j, sk) => {
      const dx = j[4] - j[2], dy = j[5] - j[3]; const a = Math.atan2(dy, dx);
      ctx.save(); ctx.translate(j[4], j[5]); ctx.rotate(a);
      const hr = d.armR * 1.0;
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
      const segs = [[j[0], j[1], j[2], j[3], ar * 1.22, ar * 0.7, [0.2, 0.1]], [j[2], j[3], wx, wy, ar * 0.76, ar * 0.5, [0.12, 0.06]]];
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
      drawHand(j, sk);
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
    const bp = [TP(-0.05, -hw * 0.5), TP(T * 0.42, -ww * 0.5), TP(T * 0.74, -sw * 0.44), TP(T * 0.94, -sw * 0.5), TP(T * 1.05, -sw * 0.28), TP(T * 1.08, 0), TP(T * 1.05, sw * 0.28), TP(T * 0.94, sw * 0.5), TP(T * 0.74, sw * 0.45 + B * 0.3), TP(T * 0.42, ww * 0.5 + B), TP(-0.05, hw * 0.5)];
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
      ctx.save(); ctx.translate(np[0], np[1]); ctx.scale(1, -1); ctx.rotate(lean);
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
    p.moveTo(hx + r * 0.8, hy + r * 0.4);
    p.bezierCurveTo(hx + r * 0.74, hy + r * 1.08, hx - r * 0.56, hy + r * 1.14, hx - r * 0.88, hy + r * 0.36);
    p.bezierCurveTo(hx - r * 1.04, hy - r * 0.12, hx - r * 0.78, hy - r * 0.52, hx - r * 0.42, hy - r * 0.62);
    p.bezierCurveTo(hx - r * 0.2, hy - r * 0.86, hx + r * 0.14, hy - r * 1.02, hx + r * 0.44, hy - r * 0.99);
    p.bezierCurveTo(hx + r * 0.68, hy - r * 0.96, hx + r * 0.8, hy - r * 0.72, hx + r * 0.82, hy - r * 0.46);
    p.bezierCurveTo(hx + r * 0.9, hy - r * 0.2, hx + r * 0.94, hy + r * 0.06, hx + r * 0.8, hy + r * 0.4);
    p.closePath();
    return p;
  }
  // Hair that sits on the skull. t: height above the skull, front: how low the hairline comes.
  function hairCap(hx, hy, r, t, front) {
    const p = new Path2D();
    const fx = hx + r * (0.6 + front * 0.16), fy = hy + r * (0.56 - front * 0.14);
    p.moveTo(fx, fy);
    p.bezierCurveTo(hx + r * (0.8 + t * 0.4), hy + r * (1.12 + t), hx - r * (0.56 + t * 0.3), hy + r * (1.2 + t), hx - r * (0.92 + t), hy + r * 0.36);
    p.bezierCurveTo(hx - r * (1.08 + t), hy - r * 0.08, hx - r * 0.84, hy - r * 0.46, hx - r * 0.54, hy - r * 0.54);
    p.bezierCurveTo(hx - r * 0.42, hy - r * 0.22, hx - r * 0.24, hy + r * 0.04, hx - r * 0.04, hy - r * 0.02);
    p.lineTo(hx + r * 0.04, hy - r * 0.24); p.lineTo(hx + r * 0.15, hy - r * 0.2);
    p.quadraticCurveTo(hx + r * 0.16, hy + r * 0.36, fx, fy);
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
    const ex = hx - r * 0.26, ey = hy - r * 0.06;
    ctx.fillStyle = skin; ctx.strokeStyle = OL; ctx.lineWidth = olW * 1.6;
    ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.17, r * 0.25, -0.15, 0, TAU); ctx.fill(); ctx.stroke();
    if (big) { ctx.strokeStyle = shade(skin, -0.32); ctx.lineWidth = r * 0.045; ctx.beginPath(); ctx.arc(ex + r * 0.02, ey, r * 0.1, -1.2, 1.4); ctx.stroke(); }
    // nose
    const nose = new Path2D();
    nose.moveTo(hx + r * 0.86, hy + r * 0.02); nose.quadraticCurveTo(hx + r * 1.12, hy - r * 0.2, hx + r * 0.98, hy - r * 0.3); nose.quadraticCurveTo(hx + r * 0.9, hy - r * 0.33, hx + r * 0.82, hy - r * 0.28);
    ctx.fillStyle = skin; ctx.fill(nose);
    ctx.strokeStyle = OL; ctx.lineWidth = olW * 1.5; ctx.stroke(nose);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(hx + r * 0.7, hy - r * 0.22, r * 0.12, r * 0.1, 0, 0, TAU); ctx.fill();
    // eyes
    const eyeY = hy + r * 0.1;
    const brC = shade(['#d8d8d8', '#f3e5b5', '#e8c46e'].includes(L.hairColor) ? '#8a6a3a' : L.hairColor, -0.15);
    [[hx + r * 0.32, 1], [hx + r * 0.73, 0.7]].forEach(([ex2, k]) => {
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
    const mx = hx + r * 0.6, my = hy - r * 0.52;
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
        [[hx + r * 0.32, 0.95], [hx + r * 0.74, 0.75]].forEach(([x, s]) => { ctx.beginPath(); ctx.ellipse(x, ey2, r * 0.2 * s, r * 0.18, 0, 0, TAU); ctx.fill(); ctx.stroke(); });
      } else if (L.eyewear === 'shades') {
        ctx.fillStyle = '#0d0d10'; ctx.beginPath(); ctx.moveTo(hx + r * 0.12, ey2 + r * 0.12); ctx.lineTo(hx + r * 0.96, ey2 + r * 0.14); ctx.lineTo(hx + r * 0.88, ey2 - r * 0.12); ctx.lineTo(hx + r * 0.16, ey2 - r * 0.1); ctx.closePath(); ctx.fill();
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
      p.moveTo(hx - r * 0.1, hy + r * 0.12);
      p.bezierCurveTo(hx - r * 0.16, hy - r * 0.4, hx - r * 0.05, hy - r * (0.75 + big * 0.2), hx + r * 0.42, hy - r * (1.04 + big * 0.32));
      p.bezierCurveTo(hx + r * 0.75, hy - r * (1.0 + big * 0.25), hx + r * 0.86, hy - r * 0.7, hx + r * 0.82, hy - r * 0.38);
      p.quadraticCurveTo(hx + r * 0.6, hy - r * 0.34, hx + r * 0.36, hy - r * 0.3);
      p.quadraticCurveTo(hx + r * 0.1, hy - r * 0.2, hx + r * 0.08, hy + r * 0.12);
      p.closePath(); return p;
    };
    switch (L.facial) {
      case 'stubble': ctx.globalAlpha *= 0.32; ctx.fill(beard(0)); break;
      case 'mustache': ctx.beginPath(); ctx.ellipse(hx + r * 0.64, hy - r * 0.36, r * 0.24, r * 0.075, -0.08, 0, TAU); ctx.fill(); break;
      case 'goatee':
        ctx.beginPath(); ctx.ellipse(hx + r * 0.64, hy - r * 0.36, r * 0.22, r * 0.065, -0.08, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(hx + r * 0.52, hy - r * 0.84, r * 0.2, r * 0.17, 0.1, 0, TAU); ctx.fill(); break;
      case 'chinstrap':
        ctx.strokeStyle = c; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.moveTo(hx - r * 0.05, hy + r * 0.05); ctx.bezierCurveTo(hx - r * 0.12, hy - r * 0.6, hx + r * 0.1, hy - r * 0.95, hx + r * 0.6, hy - r * 0.93); ctx.stroke(); break;
      case 'beard': case 'bigbeard': {
        ctx.fill(beard(L.facial === 'bigbeard' ? 1 : 0));
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(hx + r * 0.3, hy - r * 0.85, r * 0.45, r * 0.18, 0.1, 0, TAU); ctx.fill();
        ctx.fillStyle = L.skin; ctx.beginPath(); ctx.ellipse(hx + r * 0.6, hy - r * 0.53, r * 0.16, r * 0.07, 0, 0, TAU); ctx.fill();
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
        const p = new Path2D(); p.moveTo(hx + r * 0.7, hy + r * 0.5); p.lineTo(hx + r * 0.78, hy + r * 1.42); p.lineTo(hx - r * 0.82, hy + r * 1.46); p.quadraticCurveTo(hx - r * 1.04, hy + r * 0.9, hx - r * 0.9, hy + r * 0.2); p.lineTo(hx - r * 0.5, hy - r * 0.45); p.lineTo(hx + r * 0.1, hy - r * 0.15); p.quadraticCurveTo(hx + r * 0.2, hy + r * 0.4, hx + r * 0.7, hy + r * 0.5); p.closePath();
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

  // A trading card: team-color backdrop, the player from the thighs up, ball on the hip.
  A.drawPortrait = function (ctx, player, colors, box, opts) {
    opts = opts || {};
    const d = A.dims(player.hgt, player.build);
    const pri = colors.pri, sec = colors.sec;
    ctx.save();
    ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
    const g = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
    g.addColorStop(0, shade(pri, 0.08)); g.addColorStop(1, shade(pri, -0.55));
    ctx.fillStyle = g; ctx.fillRect(box.x, box.y, box.w, box.h);
    // a bold stripe in the trim color and a burst of light behind the head
    ctx.globalAlpha = 0.35; ctx.fillStyle = sec;
    ctx.beginPath(); ctx.moveTo(box.x + box.w * 0.55, box.y); ctx.lineTo(box.x + box.w * 0.85, box.y); ctx.lineTo(box.x + box.w * 0.35, box.y + box.h); ctx.lineTo(box.x + box.w * 0.05, box.y + box.h); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    const rg = ctx.createRadialGradient(box.x + box.w * 0.55, box.y + box.h * 0.28, 2, box.x + box.w * 0.55, box.y + box.h * 0.28, box.w * 0.75);
    rg.addColorStop(0, 'rgba(255,255,255,0.35)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    const dot = Math.max(3, box.w / 22);
    for (let yy = box.y; yy < box.y + box.h; yy += dot) for (let xx = box.x + ((yy / dot) % 2) * dot / 2; xx < box.x + box.w; xx += dot) { ctx.beginPath(); ctx.arc(xx, yy, dot * 0.16, 0, TAU); ctx.fill(); }
    // the player
    // frame from the hips up so the face carries the card
    const visible = d.H * 0.56 + 0.3;
    const scale = box.h * 0.95 / visible;
    const footY = box.y + box.h * 0.05 + (d.H + 0.25) * scale;
    const pose = A.pose('card', { dims: d, time: opts.time || 1.2 });
    const hands = A.drawBaller(ctx, { x: box.x + box.w * 0.36, y: footY, scale, hgt: player.hgt, build: player.build, look: player.look, num: player.num, colors, facing: 1, pose, dims: d, time: opts.time || 1.2 });
    if (opts.ball !== false) A.drawBall(ctx, hands.handF[0] + scale * 0.32, hands.handF[1] - scale * 0.05, scale * 0.5, 0.5);
    // vignette and a thin inner frame
    const v = ctx.createLinearGradient(0, box.y + box.h * 0.7, 0, box.y + box.h);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = v; ctx.fillRect(box.x, box.y, box.w, box.h);
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
