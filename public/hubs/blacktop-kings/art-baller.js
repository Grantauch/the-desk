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
  const BUILD = {
    lean: { chest: 0.155, arm: 0.27, thigh: 0.44, shin: 0.33, belly: 0 },
    athletic: { chest: 0.175, arm: 0.32, thigh: 0.5, shin: 0.37, belly: 0 },
    strong: { chest: 0.195, arm: 0.38, thigh: 0.56, shin: 0.41, belly: 0.02 },
    heavy: { chest: 0.205, arm: 0.4, thigh: 0.6, shin: 0.44, belly: 0.12 },
  };
  A.dims = function (hgtIn, build) {
    const H = (hgtIn || 76) / 12;
    const b = BUILD[build] || BUILD.athletic;
    const k = H / 6.4;
    return {
      H, b, k,
      foot: 0.12, leg: 0.47 * H, thigh: 0.235 * H, shin: 0.235 * H,
      torso: 0.285 * H, neck: 0.03 * H, headR: Math.max(0.43, 0.074 * H),
      upper: 0.165 * H, fore: 0.165 * H,
      chestW: b.chest * H, armW: b.arm * k, thighW: b.thigh * k, shinW: b.shin * k, belly: b.belly * H,
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
        P.pelvis = [0, stand - 0.08 + bob]; P.lean = 0.08;
        P.handF = [0.35, stand * 0.88 + bob]; P.handB = [-0.25, stand * 0.9 + bob];
        break;
      }
      case 'defend': {
        const slide = Math.sin(time * 9) * 0.06;
        P.pelvis = [0, stand - d.leg * 0.2 + bob]; P.lean = 0.3;
        P.footF = [0.75 + slide, 0]; P.footB = [-0.65 + slide, 0];
        const cy = P.pelvis[1] + d.torso * 0.8;
        P.handF = [1.05, cy + 0.35 + Math.sin(time * 5) * 0.12]; P.handB = [0.75, cy - 0.5]; P.armF = 1; P.armB = -1;
        break;
      }
      case 'run': {
        const ph = o.phase || 0; const sp = clamp(o.speed || 1, 0.3, 1.6);
        const stride = 0.65 + 0.45 * sp, lift = 0.32 + 0.28 * sp;
        P.pelvis = [0, stand - 0.1 - Math.abs(Math.sin(ph)) * 0.12 * sp]; P.lean = 0.12 + 0.14 * sp;
        P.footF = [Math.cos(ph) * stride, Math.max(0, Math.sin(ph)) * lift];
        P.footB = [Math.cos(ph + Math.PI) * stride, Math.max(0, Math.sin(ph + Math.PI)) * lift];
        const cy = P.pelvis[1] + d.torso * 0.55;
        P.handF = [-Math.cos(ph) * 0.65 * sp + 0.2, cy + Math.sin(ph) * 0.12]; P.handB = [Math.cos(ph) * 0.65 * sp - 0.1, cy - Math.sin(ph) * 0.12];
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
        P.handF = [lerp(0.5, 2.0, k), lerp(stand, stand * 0.55, k)]; P.handB = [-0.45, stand * 0.95]; P.armF = -1;
        break;
      }
      case 'pass': {
        const k = Math.sin(clamp(t, 0, 1) * Math.PI);
        P.pelvis = [0, stand - 0.05]; P.lean = 0.12 + 0.1 * k; P.footF = [0.55, 0]; P.footB = [-0.3, 0];
        const cy = P.pelvis[1] + d.torso * 0.75;
        P.handF = [lerp(0.4, 1.5, k), cy]; P.handB = [lerp(0.25, 1.35, k), cy + 0.1]; P.armF = -1; P.armB = -1;
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
        P.handF = [0.4 + w * 0.3, cy + 0.6]; P.handB = [-0.8, cy + 0.3 - w * 0.3]; P.armF = 1; P.armB = 1; P.tilt = -0.3;
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
  function seg(ctx, x1, y1, x2, y2, w, col) {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function limb(ctx, j, w1, w2, col, ol, olW) {
    // j: [x0,y0,x1,y1,x2,y2]. Outline pass first, then color, so the joint stays clean.
    seg(ctx, j[0], j[1], j[2], j[3], w1 + olW * 2, ol); seg(ctx, j[2], j[3], j[4], j[5], w2 + olW * 2, ol);
    seg(ctx, j[0], j[1], j[2], j[3], w1, col); seg(ctx, j[2], j[3], j[4], j[5], w2, col);
  }
  function partial(j, f) {
    // point at fraction f along the 2-segment limb (0 root, 0.5 joint, 1 end)
    if (f <= 0.5) { const k = f / 0.5; return [lerp(j[0], j[2], k), lerp(j[1], j[3], k)]; }
    const k = (f - 0.5) / 0.5; return [lerp(j[2], j[4], k), lerp(j[3], j[5], k)];
  }

  // ---------- the baller ----------
  // o: { x, y, scale (px per foot), hgt (in), build, look, num, colors {pri, sec, num}, facing (+1/-1), spin (rad),
  //      pose (from A.pose), ballLayer ('back'|'front'|null), drawBall(ctx) in screen space, glow, flash, alpha, time }
  A.drawBaller = function (ctx, o) {
    const d = o.dims || A.dims(o.hgt, o.build);
    const L = o.look ? A.fullLook(o.look) : DEFAULT_LOOK;
    const P = o.pose;
    const col = o.colors || { pri: '#e8352b', sec: '#ffffff', num: '#ffffff' };
    let kx = (o.facing || 1) * Math.cos(o.spin || 0);
    if (Math.abs(kx) < 0.12) kx = kx < 0 ? -0.12 : 0.12;
    const ol = '#14110f'; const olW = 0.055;
    const skin = L.skin, skinB = shade(skin, -0.2);

    ctx.save();
    const baseT = ctx.getTransform();
    const withScreen = (c, fn) => { c.save(); c.setTransform(baseT); fn(c); c.restore(); };
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    ctx.translate(o.x, o.y);
    ctx.scale(o.scale * kx, -o.scale);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = 18; }

    // joints
    const pel = P.pelvis; const lean = P.lean;
    const ux = Math.sin(lean), uy = Math.cos(lean); const nx = Math.cos(lean), ny = -Math.sin(lean);
    const TP = (along, across) => [pel[0] + ux * along + nx * across, pel[1] + uy * along + ny * across];
    const T = d.torso, cw = d.chestW;
    const shF = TP(T * 0.9, cw * 0.16), shB = TP(T * 0.9, -cw * 0.22);
    const hipF = TP(0.05, cw * 0.12), hipB = TP(0.05, -cw * 0.16);
    const neckBase = TP(T * 1.0, 0.0);
    const hd = P.tilt || 0;
    const hx = neckBase[0] + Math.sin(lean + hd * 0.5) * (d.neck + d.headR * 0.9);
    const hy = neckBase[1] + Math.cos(lean + hd * 0.5) * (d.neck + d.headR * 0.9);

    const legJ = (hip, foot, sign) => { const r = ik(hip[0], hip[1], foot[0], foot[1] + d.foot, d.thigh, d.shin, sign); return [hip[0], hip[1], r.jx, r.jy, r.ex, r.ey]; };
    const armJ = (sh, hand, sign) => { const r = ik(sh[0], sh[1], hand[0], hand[1], d.upper, d.fore, sign); return [sh[0], sh[1], r.jx, r.jy, r.ex, r.ey]; };
    const legF = legJ(hipF, P.footF, P.legF || 1), legB = legJ(hipB, P.footB, P.legB || 1);
    const armF = armJ(shF, P.handF, P.armF || -1), armB = armJ(shB, P.handB, P.armB || -1);

    const shortsLen = { short: 0.3, mid: 0.52, long: 0.72, baggy: 0.82 }[L.shorts] || 0.52;
    const shortsW = L.shorts === 'baggy' ? 1.55 : L.shorts === 'long' ? 1.38 : 1.3;
    const shoeCol = L.shoeColor, shoeAcc = L.shoeAccent;

    const drawLeg = (j, back) => {
      const sk = back ? skinB : skin;
      limb(ctx, j, d.thighW, d.shinW, sk, ol, olW);
      // socks
      const sockTop = { low: 0.93, crew: 0.84, tall: 0.7, stripes: 0.68 }[L.socks] || 0.84;
      const sockCol = back ? shade(L.sockColor, -0.15) : L.sockColor;
      const s0 = partial(j, sockTop), s1 = [j[4], j[5]];
      seg(ctx, s0[0], s0[1], s1[0], s1[1], d.shinW * 1.02, sockCol);
      if (L.socks === 'stripes') {
        const a = partial(j, 0.71), b = partial(j, 0.735), c2 = partial(j, 0.76), e = partial(j, 0.785);
        seg(ctx, a[0], a[1], b[0], b[1], d.shinW * 1.05, col.pri); seg(ctx, c2[0], c2[1], e[0], e[1], d.shinW * 1.05, col.sec);
      }
      // knee sleeve
      if (L.kneeSleeve === 'both' || L.kneeSleeve === (back ? 'left' : 'right')) {
        const a = partial(j, 0.38), b = partial(j, 0.66);
        seg(ctx, a[0], a[1], b[0], b[1], d.thighW * 1.04, back ? shade(L.sleeveColor, -0.15) : L.sleeveColor);
      }
      // shoe
      const fx = j[4], fy = j[5] - d.foot * 0.6;
      const sc = back ? shade(shoeCol, -0.18) : shoeCol;
      const high = L.shoes === 'high' ? 0.32 : L.shoes === 'mid' ? 0.24 : 0.16;
      ctx.fillStyle = ol;
      roundRect(ctx, fx - 0.3 - olW, fy - 0.12 - olW, 0.88 + olW * 2, high + 0.18 + olW * 2, 0.16); ctx.fill();
      ctx.fillStyle = sc; roundRect(ctx, fx - 0.3, fy - 0.12, 0.88, high + 0.18, 0.14); ctx.fill();
      // toe cap and heel tab in the accent color (plain blocks, no maker marks)
      ctx.fillStyle = back ? shade(shoeAcc, -0.18) : shoeAcc;
      roundRect(ctx, fx + 0.3, fy - 0.08, 0.26, high * 0.55 + 0.08, 0.1); ctx.fill();
      roundRect(ctx, fx - 0.3, fy - 0.02, 0.16, high + 0.1, 0.06); ctx.fill();
      if (L.shoes !== 'low') { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(fx - 0.05, fy + high * 0.55, 0.32, 0.04); }
      ctx.fillStyle = L.shoes === 'glow' ? '#7df9ff' : '#f4f4f4'; ctx.fillRect(fx - 0.3, fy - 0.12, 0.88, 0.07);
      if (L.shoes === 'glow' && !back) { ctx.save(); ctx.shadowColor = '#7df9ff'; ctx.shadowBlur = 10; ctx.fillRect(fx - 0.3, fy - 0.12, 0.88, 0.07); ctx.restore(); }
    };
    const drawShortsLeg = (j, back) => {
      const e = partial(j, shortsLen * 0.5);
      const h0 = partial(j, Math.max(0.02, shortsLen * 0.5 - 0.035));
      const c = back ? shade(col.pri, -0.2) : col.pri;
      const sw = d.thighW * shortsW;
      ctx.lineCap = 'butt';
      seg(ctx, j[0], j[1], e[0], e[1], sw + olW * 2, ol);
      seg(ctx, j[0], j[1], e[0], e[1], sw, c);
      seg(ctx, h0[0], h0[1], e[0], e[1], sw, back ? shade(col.sec, -0.2) : col.sec);
      ctx.lineCap = 'round';
    };
    const drawArm = (j, back) => {
      const sk = back ? skinB : skin;
      limb(ctx, j, d.armW, d.armW * 0.9, sk, ol, olW);
      if (!back && L.tattoo !== 'none') {
        ctx.save(); ctx.globalAlpha *= 0.45; ctx.strokeStyle = '#1b2a3a'; ctx.lineWidth = 0.05;
        const segs = L.tattoo === 'sleeve' ? [[0.08, 0.92]] : L.tattoo === 'forearm' ? [[0.6, 0.88]] : [[0.25, 0.32]];
        segs.forEach(([a, b]) => {
          for (let f = a; f < b; f += 0.07) {
            const p1 = partial(j, f), p2 = partial(j, Math.min(b, f + 0.05));
            ctx.beginPath(); ctx.moveTo(p1[0] - d.armW * 0.3, p1[1]); ctx.lineTo(p2[0] + d.armW * 0.3, p2[1]); ctx.stroke();
          }
        });
        ctx.restore();
      }
      const sleeved = L.armSleeve === 'both' || L.armSleeve === (back ? 'left' : 'right');
      if (sleeved) {
        const a = partial(j, 0.12), b = partial(j, 0.93);
        const sc = back ? shade(L.sleeveColor, -0.15) : L.sleeveColor;
        seg(ctx, a[0], a[1], j[2], j[3], d.armW * 1.04, sc); seg(ctx, j[2], j[3], b[0], b[1], d.armW * 0.95, sc);
      }
      const bands = L.wristbands === 'both' || (L.wristbands === 'one' && !back);
      if (bands) { const a = partial(j, 0.8), b = partial(j, 0.88); seg(ctx, a[0], a[1], b[0], b[1], d.armW * 1.1, back ? shade(L.headbandColor, -0.15) : L.headbandColor); }
      if (L.jersey === 'tee') {
        const a = partial(j, 0.0), b = partial(j, 0.22);
        const jc = back ? shade(col.pri, -0.2) : col.pri;
        seg(ctx, a[0], a[1], b[0], b[1], d.armW * 1.45 + olW * 2, ol); seg(ctx, a[0], a[1], b[0], b[1], d.armW * 1.45, jc);
      }
      // hand
      ctx.fillStyle = ol; ctx.beginPath(); ctx.arc(j[4], j[5], d.armW * 0.68 + olW, 0, TAU); ctx.fill();
      ctx.fillStyle = sk; ctx.beginPath(); ctx.arc(j[4], j[5], d.armW * 0.68, 0, TAU); ctx.fill();
    };

    // ---- back layer ----
    if (o.ballLayer === 'behind' && o.drawBall) withScreen(ctx, o.drawBall);
    drawHairBack(ctx, L, hx, hy, d.headR, o.time || 0, P, true);
    drawArm(armB, true);
    if (o.ballLayer === 'back' && o.drawBall) withScreen(ctx, o.drawBall);
    drawLeg(legB, true);
    drawShortsLeg(legB, true);

    // ---- torso ----
    const w = cw, wb = cw * 0.92 + d.belly;
    const pts = {
      hipB: TP(-0.05, -wb * 0.5), hipF: TP(-0.05, wb * 0.5), belly: TP(T * 0.42, w * 0.5 + d.belly), chestF: TP(T * 0.82, w * 0.52),
      shF: TP(T * 1.0, w * 0.3), neckF: TP(T * 1.02, w * 0.12), neckB: TP(T * 1.02, -w * 0.12), shB: TP(T * 1.0, -w * 0.42), chestB: TP(T * 0.75, -w * 0.5),
    };
    // waistband / shorts top
    const wbA = TP(-0.12, -wb * 0.56), wbB = TP(-0.12, wb * 0.56), wbC = TP(0.22, wb * 0.54), wbD = TP(0.22, -wb * 0.54);
    ctx.fillStyle = col.pri; ctx.strokeStyle = ol; ctx.lineWidth = olW * 2;
    poly(ctx, [wbA, wbB, wbC, wbD]); ctx.stroke(); ctx.fill();
    // jersey body
    const jerseyCol = L.jersey === 'mesh' ? shade(col.pri, 0.18) : col.pri;
    ctx.beginPath();
    ctx.moveTo(pts.hipB[0], pts.hipB[1]);
    ctx.lineTo(pts.hipF[0], pts.hipF[1]);
    ctx.quadraticCurveTo(pts.belly[0], pts.belly[1], pts.chestF[0], pts.chestF[1]);
    ctx.quadraticCurveTo(pts.shF[0] + ux * 0.05, pts.shF[1], pts.neckF[0], pts.neckF[1]);
    ctx.lineTo(pts.neckB[0], pts.neckB[1]);
    ctx.quadraticCurveTo(pts.shB[0], pts.shB[1] + 0.05, pts.chestB[0], pts.chestB[1]);
    ctx.closePath();
    ctx.lineWidth = olW * 2; ctx.strokeStyle = ol; ctx.stroke();
    ctx.fillStyle = jerseyCol; ctx.fill();
    // jersey trim
    ctx.save(); ctx.clip();
    ctx.strokeStyle = col.sec; ctx.lineWidth = L.jersey === 'throwback' ? 0.16 : 0.08;
    ctx.beginPath(); ctx.moveTo(pts.hipB[0], pts.hipB[1] + 0.04); ctx.lineTo(pts.hipF[0], pts.hipF[1] + 0.04); ctx.stroke();
    if (L.jersey === 'throwback') { const a = TP(0.25, -w), b = TP(0.25, w); ctx.lineWidth = 0.06; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    if (L.jersey === 'mesh') { ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let yy = -0.2; yy < T + 0.2; yy += 0.14) for (let xx = -w; xx < w; xx += 0.14) { const p = TP(yy, xx); ctx.fillRect(p[0], p[1], 0.05, 0.05); } }
    // shoulder trim (armhole)
    ctx.lineWidth = 0.09; ctx.beginPath(); ctx.arc(shF[0], shF[1] - 0.02, d.armW * 0.75, 0, TAU); ctx.stroke();
    ctx.restore();
    if (L.jersey === 'hoodie') {
      ctx.fillStyle = shade(col.pri, -0.12); ctx.strokeStyle = ol; ctx.lineWidth = olW * 2;
      const hb = TP(T * 1.02, -w * 0.45); const ht = TP(T * 1.18, -w * 0.25);
      ctx.beginPath(); ctx.moveTo(pts.neckF[0], pts.neckF[1]); ctx.quadraticCurveTo(ht[0], ht[1] + 0.2, hb[0], hb[1]); ctx.lineTo(pts.neckB[0], pts.neckB[1]); ctx.closePath(); ctx.stroke(); ctx.fill();
    }
    // number
    if (o.num != null && o.scale * Math.abs(kx) > 6) {
      const np = TP(T * 0.55, w * 0.12);
      ctx.save(); ctx.translate(np[0], np[1]); ctx.scale(1, -1); ctx.rotate(lean);
      ctx.font = `700 ${(T * 0.36).toFixed(3)}px Anton, Impact, 'Arial Narrow', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 0.07; ctx.strokeStyle = shade(col.pri, -0.45); ctx.strokeText(String(o.num), 0, 0);
      ctx.fillStyle = col.num || col.sec; ctx.fillText(String(o.num), 0, 0);
      ctx.restore();
    }
    // chain
    if (L.chain !== 'none') {
      const cc = L.chain === 'silver' ? '#d9dde3' : '#ffd23f';
      const a = TP(T * 1.0, w * 0.15), b = TP(T * 0.78, w * 0.28), c2 = TP(T * 0.98, -w * 0.1);
      ctx.strokeStyle = cc; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(c2[0], c2[1]); ctx.quadraticCurveTo(b[0] - 0.1, b[1], a[0], a[1]); ctx.stroke();
      ctx.fillStyle = cc; ctx.beginPath();
      if (L.chain === 'crown') { const bx = b[0], by = b[1]; ctx.moveTo(bx - 0.1, by); ctx.lineTo(bx - 0.12, by + 0.12); ctx.lineTo(bx - 0.05, by + 0.06); ctx.lineTo(bx, by + 0.14); ctx.lineTo(bx + 0.05, by + 0.06); ctx.lineTo(bx + 0.12, by + 0.12); ctx.lineTo(bx + 0.1, by); ctx.closePath(); }
      else ctx.arc(b[0], b[1], 0.07, 0, TAU);
      ctx.fill();
    }

    // ---- front leg ----
    drawLeg(legF, false);
    drawShortsLeg(legF, false);

    // ---- head ----
    seg(ctx, neckBase[0], neckBase[1], hx, hy - d.headR * 0.6, d.armW * 1.25 + olW * 2, ol);
    seg(ctx, neckBase[0], neckBase[1], hx, hy - d.headR * 0.6, d.armW * 1.25, skin);
    drawHead(ctx, L, hx, hy, d.headR, P, o, ol, olW, col);

    // ---- front arm ----
    drawArm(armF, false);
    if (o.ballLayer === 'front' && o.drawBall) withScreen(ctx, o.drawBall);

    ctx.restore();

    // Report hand positions in screen space so the game can glue the ball to them.
    const toScreen = (bx, by) => [o.x + bx * o.scale * kx, o.y - by * o.scale];
    return { handF: toScreen(armF[4], armF[5]), handB: toScreen(armB[4], armB[5]), head: toScreen(hx, hy), headR: d.headR * o.scale };
  };

  function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  A.roundRect = roundRect;

  // ---------- hair ----------
  function drawHairBack(ctx, L, hx, hy, r, time, P) {
    const c = L.hairColor; const ol = '#14110f';
    const sway = Math.sin(time * 6) * 0.08;
    ctx.save();
    ctx.lineWidth = 0.05; ctx.strokeStyle = ol; ctx.fillStyle = c;
    switch (L.hair) {
      case 'afro': circ(ctx, hx - r * 0.18, hy + r * 0.22, r * 1.42, true); break;
      case 'bigfro': circ(ctx, hx - r * 0.22, hy + r * 0.35, r * 1.85, true); break;
      case 'long': case 'shaggy': {
        ctx.beginPath(); ctx.moveTo(hx - r * 0.2, hy + r * 1.0); ctx.quadraticCurveTo(hx - r * 1.4, hy + r * 0.6, hx - r * (L.hair === 'long' ? 1.25 : 1.0) + sway, hy - r * (L.hair === 'long' ? 2.1 : 1.2));
        ctx.lineTo(hx - r * 0.1, hy - r * 0.9); ctx.closePath(); ctx.stroke(); ctx.fill(); break;
      }
      case 'mullet': { ctx.beginPath(); ctx.moveTo(hx - r * 0.4, hy + r * 0.2); ctx.quadraticCurveTo(hx - r * 1.3, hy - r * 0.6, hx - r * 0.9 + sway, hy - r * 1.9); ctx.lineTo(hx - r * 0.1, hy - r * 0.9); ctx.closePath(); ctx.stroke(); ctx.fill(); break; }
      case 'locs': {
        ctx.lineWidth = r * 0.22;
        for (let i = 0; i < 6; i++) {
          const sx = hx - r * (0.1 + i * 0.16), sy = hy + r * (0.7 - i * 0.12);
          ctx.strokeStyle = ol; ctx.lineWidth = r * 0.26; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx - r * 0.6, sy - r * 0.8, sx - r * 0.45 + sway * (1 + i * 0.2), sy - r * 2.0); ctx.stroke();
          ctx.strokeStyle = c; ctx.lineWidth = r * 0.18; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx - r * 0.6, sy - r * 0.8, sx - r * 0.45 + sway * (1 + i * 0.2), sy - r * 2.0); ctx.stroke();
        }
        break;
      }
      case 'ponytail': {
        const bx = hx - r * 0.95, by = hy + r * 0.35;
        ctx.beginPath(); ctx.moveTo(bx + r * 0.2, by + r * 0.15); ctx.quadraticCurveTo(bx - r * 0.9, by + r * 0.1 + sway * 3, bx - r * 0.8 + sway * 2, by - r * 1.4);
        ctx.quadraticCurveTo(bx - r * 0.2, by - r * 0.4, bx + r * 0.25, by - r * 0.15); ctx.closePath(); ctx.stroke(); ctx.fill();
        break;
      }
      default: break;
    }
    if (L.headband === 'ninja') {
      ctx.strokeStyle = L.headbandColor; ctx.lineWidth = r * 0.16;
      ctx.beginPath(); ctx.moveTo(hx - r * 0.95, hy + r * 0.35); ctx.quadraticCurveTo(hx - r * 1.6, hy + r * 0.6 + sway * 4, hx - r * 2.3, hy + r * 0.1 + sway * 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx - r * 0.95, hy + r * 0.3); ctx.quadraticCurveTo(hx - r * 1.5, hy + sway * 4, hx - r * 2.1, hy - r * 0.3 + sway * 6); ctx.stroke();
    }
    ctx.restore();
    void P;
  }
  function circ(ctx, x, y, r, stroke) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); if (stroke) ctx.stroke(); ctx.fill(); }

  function drawHead(ctx, L, hx, hy, r, P, o, ol, olW, col) {
    const skin = L.skin;
    // ear (behind head center)
    ctx.fillStyle = ol; ctx.beginPath(); ctx.ellipse(hx - r * 0.12, hy + r * 0.02, r * 0.24 + olW, r * 0.3 + olW, 0, 0, TAU); ctx.fill();
    // head shape: skull plus a jaw toward the face side, outlined together
    ctx.fillStyle = ol;
    ctx.beginPath(); ctx.ellipse(hx, hy, r * 0.98 + olW, r * 1.06 + olW, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx + r * 0.33, hy - r * 0.42, r * 0.6 + olW, r * 0.55 + olW, 0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.ellipse(hx, hy, r * 0.98, r * 1.06, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx + r * 0.33, hy - r * 0.42, r * 0.6, r * 0.55, 0.3, 0, TAU); ctx.fill();
    // nose
    ctx.beginPath(); ctx.moveTo(hx + r * 0.9, hy + r * 0.05); ctx.quadraticCurveTo(hx + r * 1.18, hy - r * 0.18, hx + r * 0.92, hy - r * 0.28); ctx.closePath();
    ctx.fill(); ctx.strokeStyle = ol; ctx.lineWidth = olW; ctx.stroke();
    // ear detail
    ctx.fillStyle = shade(skin, -0.12); ctx.beginPath(); ctx.ellipse(hx - r * 0.12, hy + r * 0.02, r * 0.2, r * 0.26, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = shade(skin, -0.3); ctx.beginPath(); ctx.ellipse(hx - r * 0.1, hy + r * 0.02, r * 0.08, r * 0.13, 0, 0, TAU); ctx.fill();

    // facial hair base (under features)
    drawFacial(ctx, L, hx, hy, r);

    // eyes
    const eyeY = hy + r * 0.12;
    const eyes = [[hx + r * 0.3, 0.8], [hx + r * 0.72, 1]];
    const eyeStyle = L.eyes;
    eyes.forEach(([ex, sz]) => {
      const ew = r * 0.15 * sz, eh = r * (eyeStyle === 'wide' ? 0.17 : eyeStyle === 'sleepy' ? 0.08 : eyeStyle === 'focused' ? 0.1 : 0.13) * sz;
      ctx.fillStyle = '#fbfbf7'; ctx.beginPath(); ctx.ellipse(ex, eyeY, ew, eh, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1a120c'; ctx.beginPath(); ctx.ellipse(ex + ew * 0.35, eyeY - eh * 0.1, ew * 0.55, Math.min(eh, ew * 0.6), 0, 0, TAU); ctx.fill();
      if (eyeStyle === 'sleepy') { ctx.fillStyle = shade(skin, -0.1); ctx.fillRect(ex - ew, eyeY, ew * 2, eh * 1.2); }
      ctx.strokeStyle = ol; ctx.lineWidth = olW * 0.8; ctx.beginPath(); ctx.ellipse(ex, eyeY, ew, eh, 0, 0, TAU); ctx.stroke();
    });
    // brows
    ctx.strokeStyle = shade(L.hairColor === '#d8d8d8' ? '#777777' : L.hairColor, -0.1); ctx.lineCap = 'round';
    const bw = L.brows === 'thick' ? r * 0.11 : r * 0.07;
    ctx.lineWidth = bw;
    eyes.forEach(([ex, sz]) => {
      const by = eyeY + r * 0.24;
      ctx.beginPath();
      if (L.brows === 'angry') { ctx.moveTo(ex - r * 0.16 * sz, by + r * 0.06); ctx.lineTo(ex + r * 0.16 * sz, by - r * 0.06); }
      else if (L.brows === 'raised') { ctx.moveTo(ex - r * 0.16 * sz, by); ctx.quadraticCurveTo(ex, by + r * 0.12, ex + r * 0.16 * sz, by + r * 0.02); }
      else { ctx.moveTo(ex - r * 0.16 * sz, by); ctx.quadraticCurveTo(ex, by + r * 0.05, ex + r * 0.16 * sz, by - r * 0.01); }
      ctx.stroke();
    });
    // mouth
    const mx = hx + r * 0.6, my = hy - r * 0.48;
    ctx.lineWidth = olW * 1.1; ctx.strokeStyle = ol;
    switch (L.mouth) {
      case 'smile': ctx.beginPath(); ctx.moveTo(mx - r * 0.18, my + r * 0.04); ctx.quadraticCurveTo(mx, my - r * 0.14, mx + r * 0.2, my + r * 0.06); ctx.stroke(); break;
      case 'grin':
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(mx - r * 0.2, my + r * 0.05); ctx.quadraticCurveTo(mx, my - r * 0.22, mx + r * 0.22, my + r * 0.06); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
      case 'tongue':
        ctx.fillStyle = '#3a0d10'; ctx.beginPath(); ctx.ellipse(mx, my, r * 0.14, r * 0.1, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e0566a'; ctx.beginPath(); ctx.ellipse(mx + r * 0.06, my - r * 0.14, r * 0.1, r * 0.16, -0.3, 0, TAU); ctx.fill(); ctx.stroke(); break;
      case 'guard':
        ctx.fillStyle = col.sec || '#ffffff'; ctx.beginPath(); ctx.ellipse(mx + r * 0.12, my - r * 0.02, r * 0.18, r * 0.08, 0.2, 0, TAU); ctx.fill(); ctx.stroke(); break;
      case 'snarl':
        ctx.fillStyle = '#fff'; ctx.fillRect(mx - r * 0.16, my - r * 0.05, r * 0.32, r * 0.1); ctx.strokeRect(mx - r * 0.16, my - r * 0.05, r * 0.32, r * 0.1); break;
      default: ctx.beginPath(); ctx.moveTo(mx - r * 0.16, my); ctx.lineTo(mx + r * 0.18, my - r * 0.01); ctx.stroke(); break;
    }
    // hair on top
    drawHairTop(ctx, L, hx, hy, r, ol, olW, o.time || 0);
    // headwear
    if (L.headband === 'band' || L.headband === 'wide' || L.headband === 'ninja') {
      const hw = L.headband === 'wide' ? r * 0.32 : r * 0.2;
      ctx.save(); ctx.beginPath(); ctx.ellipse(hx, hy, r * 1.0, r * 1.08, 0, 0, TAU); ctx.clip();
      ctx.fillStyle = L.headbandColor; ctx.fillRect(hx - r * 1.1, hy + r * 0.42, r * 2.2, hw);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(hx - r * 1.1, hy + r * 0.42, r * 2.2, hw * 0.25);
      ctx.restore();
      ctx.strokeStyle = ol; ctx.lineWidth = olW; ctx.beginPath(); ctx.moveTo(hx - r * 0.98, hy + r * 0.42); ctx.lineTo(hx + r * 0.98, hy + r * 0.42); ctx.stroke();
    }
    if (L.headband === 'bandana') {
      ctx.fillStyle = L.headbandColor; ctx.strokeStyle = ol; ctx.lineWidth = olW;
      ctx.beginPath(); ctx.ellipse(hx - r * 0.05, hy + r * 0.45, r * 1.03, r * 0.72, 0, Math.PI * 1.02, Math.PI * 1.98, true); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx - r * 0.95, hy + r * 0.5); ctx.lineTo(hx - r * 1.45, hy + r * 0.25); ctx.lineTo(hx - r * 1.2, hy + r * 0.65); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(hx - r * 0.5 + i * r * 0.35, hy + r * 0.85, r * 0.05, 0, TAU); ctx.fill(); }
    }
    if (L.eyewear !== 'none') {
      const ey = hy + r * 0.12;
      if (L.eyewear === 'goggles') {
        ctx.strokeStyle = '#111'; ctx.lineWidth = r * 0.1; ctx.beginPath(); ctx.moveTo(hx - r * 0.95, ey + r * 0.05); ctx.lineTo(hx + r * 0.2, ey); ctx.stroke();
        ctx.fillStyle = 'rgba(190,230,255,0.45)'; ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = r * 0.07;
        [[hx + r * 0.3, 0.85], [hx + r * 0.74, 1]].forEach(([x, s]) => { ctx.beginPath(); ctx.ellipse(x, ey, r * 0.21 * s, r * 0.19 * s, 0, 0, TAU); ctx.fill(); ctx.stroke(); });
      } else if (L.eyewear === 'shades') {
        ctx.fillStyle = '#0d0d10'; ctx.beginPath(); ctx.moveTo(hx + r * 0.1, ey + r * 0.12); ctx.lineTo(hx + r * 0.98, ey + r * 0.14); ctx.lineTo(hx + r * 0.9, ey - r * 0.12); ctx.lineTo(hx + r * 0.15, ey - r * 0.1); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#0d0d10'; ctx.lineWidth = r * 0.07; ctx.beginPath(); ctx.moveTo(hx + r * 0.12, ey + r * 0.1); ctx.lineTo(hx - r * 0.7, ey + r * 0.12); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(hx + r * 0.6, ey + r * 0.02, r * 0.14, r * 0.05);
      } else if (L.eyewear === 'visor') {
        ctx.save(); ctx.shadowColor = '#2ec5ff'; ctx.shadowBlur = 12; ctx.fillStyle = 'rgba(46,197,255,0.85)';
        ctx.beginPath(); ctx.moveTo(hx - r * 0.2, ey + r * 0.15); ctx.lineTo(hx + r * 1.02, ey + r * 0.13); ctx.lineTo(hx + r * 0.96, ey - r * 0.12); ctx.lineTo(hx - r * 0.2, ey - r * 0.1); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
  }

  function drawFacial(ctx, L, hx, hy, r) {
    if (L.facial === 'none') return;
    const c = L.hairColor === '#d8d8d8' ? '#9a9a9a' : L.hairColor;
    ctx.save();
    ctx.fillStyle = c;
    switch (L.facial) {
      case 'stubble': ctx.globalAlpha *= 0.35; ctx.beginPath(); ctx.ellipse(hx + r * 0.35, hy - r * 0.5, r * 0.62, r * 0.48, 0.3, 0, TAU); ctx.fill(); break;
      case 'mustache': ctx.beginPath(); ctx.ellipse(hx + r * 0.66, hy - r * 0.33, r * 0.26, r * 0.08, -0.1, 0, TAU); ctx.fill(); break;
      case 'goatee':
        ctx.beginPath(); ctx.ellipse(hx + r * 0.66, hy - r * 0.33, r * 0.24, r * 0.07, -0.1, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(hx + r * 0.6, hy - r * 0.78, r * 0.2, r * 0.17, 0, 0, TAU); ctx.fill(); break;
      case 'chinstrap':
        ctx.strokeStyle = c; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.moveTo(hx - r * 0.25, hy - r * 0.05); ctx.quadraticCurveTo(hx - r * 0.1, hy - r * 0.85, hx + r * 0.65, hy - r * 0.86); ctx.stroke(); break;
      case 'beard': case 'bigbeard': {
        const big = L.facial === 'bigbeard' ? 1.35 : 1;
        ctx.beginPath(); ctx.moveTo(hx - r * 0.3, hy - r * 0.0); ctx.quadraticCurveTo(hx - r * 0.25, hy - r * 0.95 * big, hx + r * 0.55, hy - r * 1.0 * big);
        ctx.quadraticCurveTo(hx + r * 0.95, hy - r * 0.85 * big, hx + r * 0.9, hy - r * 0.32); ctx.lineTo(hx + r * 0.3, hy - r * 0.3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = L.skin; ctx.beginPath(); ctx.ellipse(hx + r * 0.6, hy - r * 0.5, r * 0.2, r * 0.09, 0, 0, TAU); ctx.fill();
        break;
      }
      default: break;
    }
    ctx.restore();
  }

  function drawHairTop(ctx, L, hx, hy, r, ol, olW, time) {
    const c = L.hairColor;
    ctx.save();
    ctx.fillStyle = c; ctx.strokeStyle = ol; ctx.lineWidth = olW;
    const cap = (front, depth) => {
      // a cap of hair over the top of the head; front: how far toward the face it reaches (0..1)
      ctx.beginPath(); ctx.ellipse(hx - r * 0.05, hy + r * 0.12, r * 1.02, r * 1.0, 0, Math.PI * (0.02 - front * 0.12), Math.PI * (1.0 + depth * 0.3), false);
      ctx.quadraticCurveTo(hx - r * 0.2, hy + r * 0.55, hx + r * (0.4 + front * 0.4), hy + r * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    };
    switch (L.hair) {
      case 'bald': ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(hx + r * 0.1, hy + r * 0.62, r * 0.32, r * 0.14, -0.3, 0, TAU); ctx.fill(); break;
      case 'buzz': ctx.globalAlpha *= 0.75; cap(0.2, 0.25); break;
      case 'fade': cap(0.25, 0.1); ctx.globalAlpha *= 0.4; ctx.beginPath(); ctx.ellipse(hx - r * 0.35, hy + r * 0.15, r * 0.55, r * 0.5, 0, 0, TAU); ctx.fill(); break;
      case 'waves': cap(0.25, 0.2); ctx.strokeStyle = shade(c, 0.25); ctx.lineWidth = r * 0.05; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(hx - r * 0.1, hy + r * 0.1, r * (0.55 + i * 0.14), Math.PI * 0.25, Math.PI * 0.75); ctx.stroke(); } break;
      case 'curly': cap(0.25, 0.2); for (let i = 0; i < 8; i++) { const a = Math.PI * (0.1 + i * 0.11); circ(ctx, hx + Math.cos(a) * r * 0.95 - r * 0.05, hy + r * 0.15 + Math.sin(a) * r * 0.95, r * 0.2, true); } break;
      case 'flattop': ctx.beginPath(); ctx.moveTo(hx - r * 0.95, hy + r * 0.2); ctx.lineTo(hx - r * 0.9, hy + r * 1.28); ctx.lineTo(hx + r * 0.78, hy + r * 1.28); ctx.lineTo(hx + r * 0.9, hy + r * 0.55); ctx.quadraticCurveTo(hx, hy + r * 0.75, hx - r * 0.9, hy + r * 0.3); ctx.fill(); ctx.stroke(); break;
      case 'afro': case 'bigfro': cap(0.3, 0.2); break;
      case 'cornrows': cap(0.3, 0.3); ctx.strokeStyle = shade(c, 0.3); ctx.lineWidth = r * 0.05; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(hx + r * (0.55 - i * 0.05), hy + r * (0.55 + i * 0.1)); ctx.quadraticCurveTo(hx - r * 0.2, hy + r * (0.9 + i * 0.05), hx - r * 0.9, hy + r * (0.3 + i * 0.06)); ctx.stroke(); } break;
      case 'locs': cap(0.3, 0.25); break;
      case 'twists': cap(0.3, 0.2); ctx.lineWidth = r * 0.16; for (let i = 0; i < 9; i++) { const a = Math.PI * (0.08 + i * 0.1); const x1 = hx + Math.cos(a) * r * 0.9 - r * 0.05, y1 = hy + r * 0.15 + Math.sin(a) * r * 0.9; ctx.strokeStyle = ol; ctx.lineWidth = r * 0.2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + Math.cos(a) * r * 0.38, y1 + Math.sin(a) * r * 0.38); ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = r * 0.13; ctx.stroke(); } break;
      case 'mohawk': ctx.globalAlpha *= 0.5; cap(0.1, 0.1); ctx.globalAlpha = 1; ctx.beginPath(); ctx.moveTo(hx + r * 0.5, hy + r * 0.85); for (let i = 0; i <= 5; i++) { const a = Math.PI * (0.3 + i * 0.13); ctx.lineTo(hx + Math.cos(a) * r * 1.65, hy + r * 0.1 + Math.sin(a) * r * 1.65); ctx.lineTo(hx + Math.cos(a + 0.06) * r * 1.0, hy + r * 0.1 + Math.sin(a + 0.06) * r * 1.0); } ctx.closePath(); ctx.fill(); ctx.stroke(); break;
      case 'spiky': cap(0.3, 0.2); ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = Math.PI * (0.12 + i * 0.12); ctx.moveTo(hx + Math.cos(a - 0.12) * r * 0.95, hy + r * 0.1 + Math.sin(a - 0.12) * r * 0.95); ctx.lineTo(hx + Math.cos(a) * r * 1.55, hy + r * 0.1 + Math.sin(a) * r * 1.55); ctx.lineTo(hx + Math.cos(a + 0.12) * r * 0.95, hy + r * 0.1 + Math.sin(a + 0.12) * r * 0.95); } ctx.fill(); ctx.stroke(); break;
      case 'ponytail': cap(0.35, 0.35); break;
      case 'bun': cap(0.35, 0.3); circ(ctx, hx - r * 0.35, hy + r * 1.15, r * 0.42, true); break;
      case 'long': cap(0.45, 0.4); break;
      case 'shaggy': cap(0.5, 0.35); ctx.beginPath(); ctx.moveTo(hx + r * 0.2, hy + r * 0.9); ctx.quadraticCurveTo(hx + r * 1.0, hy + r * 0.8, hx + r * 0.95, hy + r * 0.25 + Math.sin(time * 6) * r * 0.03); ctx.lineTo(hx + r * 0.6, hy + r * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
      case 'mullet': cap(0.3, 0.35); break;
      default: break;
    }
    ctx.restore();
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
