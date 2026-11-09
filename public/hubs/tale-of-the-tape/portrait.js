/* Tale of the Tape — fighter portraits. One drawing style for every place a face appears:
   the creator, the fighter card, fight posters, the tale of the tape, and the share card.
   TOT.portrait(canvas, look, {pose, bg, era, mood, bruised}) */
(function (T) {
  'use strict';
  const D = T.data;
  const INK = '#17130f';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => clamp(Math.round(v * (1 + amt)), 0, 255);
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  let dotCache = {};
  function dots(ctx, color) {
    if (dotCache[color]) return dotCache[color];
    const c = document.createElement('canvas'); c.width = c.height = 8;
    const x = c.getContext('2d'); x.fillStyle = color; x.beginPath(); x.arc(4, 4, 1.7, 0, Math.PI * 2); x.fill();
    dotCache[color] = ctx.createPattern(c, 'repeat');
    return dotCache[color];
  }

  T.portrait = function (canvas, look, opts = {}) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    look = Object.assign({ skin: 2, hair: 0, cut: 'slick', trunks: 0, stache: false, brow: 0, build: 1, jaw: 1, nose: 0 }, look || {});
    const skin = D.SKINS[look.skin] || D.SKINS[2], hair = D.HAIRS[look.hair] || D.HAIRS[0], trunks = D.TRUNKS[look.trunks] || D.TRUNKS[0];
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    // background: a poster sunburst
    const bg = opts.bg || (opts.era === 'tv' ? '#2a7f7a' : opts.era === 'newsreel' ? '#5b5a3a' : '#b8231b');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.translate(w / 2, h * 0.42);
    ctx.fillStyle = 'rgba(255,240,200,.14)';
    for (let i = 0; i < 18; i++) { ctx.rotate(Math.PI / 9); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-w * 0.12, -h); ctx.lineTo(w * 0.12, -h); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = dots(ctx, 'rgba(23,19,15,.18)'); ctx.fillRect(0, h * 0.55, w, h * 0.45);
    // scale to a 200x240 design space
    const k = Math.min(w / 200, h / 240);
    ctx.translate((w - 200 * k) / 2, h - 240 * k); ctx.scale(k, k);
    const build = look.build || 1, jaw = look.jaw || 1;
    // shoulders
    const sw = 92 * build;
    const tg = ctx.createLinearGradient(100 - sw, 0, 100 + sw, 0);
    tg.addColorStop(0, shade(skin, -0.25)); tg.addColorStop(0.4, skin); tg.addColorStop(1, shade(skin, -0.3));
    ctx.fillStyle = tg; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(100 - sw, 245); ctx.quadraticCurveTo(100 - sw - 4, 175, 100 - 40, 168); ctx.lineTo(140, 168); ctx.quadraticCurveTo(100 + sw + 4, 175, 100 + sw, 245); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(23,19,15,.4)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(52, 205); ctx.quadraticCurveTo(80, 220, 98, 206); ctx.moveTo(148, 205); ctx.quadraticCurveTo(120, 220, 102, 206); ctx.stroke();
    // neck
    ctx.fillStyle = shade(skin, -0.12); ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(78, 140); ctx.lineTo(122, 140); ctx.lineTo(130, 172); ctx.lineTo(70, 172); ctx.closePath(); ctx.fill(); ctx.stroke();
    // head
    ctx.save(); ctx.translate(100, 102);
    for (const s of [-1, 1]) { ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(s * 41, 4, 9, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    const fg = ctx.createLinearGradient(-40, 0, 40, 0); fg.addColorStop(0, shade(skin, -0.15)); fg.addColorStop(0.5, skin); fg.addColorStop(1, shade(skin, -0.2));
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(-39, -16); ctx.quadraticCurveTo(-41, -54, 0, -56); ctx.quadraticCurveTo(41, -54, 39, -16); ctx.quadraticCurveTo(41, 33 * jaw, 18, 47 * jaw); ctx.lineTo(-18, 47 * jaw); ctx.quadraticCurveTo(-41, 33 * jaw, -39, -16); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (opts.bruised) { ctx.fillStyle = 'rgba(90,30,70,.4)'; ctx.beginPath(); ctx.ellipse(16, -2, 13, 9, 0, 0, Math.PI * 2); ctx.fill(); }
    // hair
    ctx.fillStyle = hair; ctx.beginPath();
    const cut = look.cut;
    if (cut === 'bald') { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.ellipse(-10, -44, 13, 5, -0.3, 0, Math.PI * 2); ctx.fill(); }
    else {
      if (cut === 'curly') { for (let i = -3; i <= 3; i++) { ctx.moveTo(i * 11 + 10, -48); ctx.arc(i * 11, -48 + Math.abs(i) * 3, 10, 0, Math.PI * 2); } }
      else if (cut === 'flat') ctx.rect(-38, -72, 76, 26);
      else if (cut === 'crop') { ctx.moveTo(-39, -24); ctx.quadraticCurveTo(-41, -61, 0, -61); ctx.quadraticCurveTo(41, -61, 39, -24); ctx.quadraticCurveTo(25, -46, 0, -46); ctx.quadraticCurveTo(-25, -46, -39, -24); }
      else if (cut === 'wave') { ctx.moveTo(-41, -20); ctx.quadraticCurveTo(-46, -70, 5, -66); ctx.quadraticCurveTo(48, -64, 41, -20); ctx.quadraticCurveTo(33, -50, 15, -44); ctx.quadraticCurveTo(-3, -58, -16, -43); ctx.quadraticCurveTo(-30, -48, -41, -20); }
      else { ctx.moveTo(-41, -19); ctx.quadraticCurveTo(-44, -68, 0, -66); ctx.quadraticCurveTo(44, -68, 41, -19); ctx.quadraticCurveTo(36, -50, 0, -50); ctx.quadraticCurveTo(-36, -50, -41, -19); }
      ctx.fill(); ctx.stroke();
    }
    // brows & eyes
    const mood = opts.mood || 'tough';
    ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = 6;
    const bA = mood === 'happy' ? -0.1 : mood === 'sad' ? -0.35 : 0.22 + (look.brow || 0) * 0.08;
    for (const s of [-1, 1]) { ctx.save(); ctx.translate(s * 16, -20); ctx.rotate(-s * bA); ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke(); ctx.restore(); }
    ctx.lineWidth = 3;
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#fbf6e8'; ctx.beginPath(); ctx.ellipse(s * 16, -6, 8, mood === 'tough' ? 5 : 6.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(s * 16 + (opts.look === 'side' ? 2 : 0), -5.5, 3, 0, Math.PI * 2); ctx.fill();
    }
    // nose
    ctx.fillStyle = shade(skin, -0.12); ctx.lineWidth = 3.5; ctx.beginPath();
    if (look.nose === 1) { ctx.moveTo(-2, -2); ctx.lineTo(-8, 16); ctx.quadraticCurveTo(0, 21, 8, 16); }
    else if (look.nose === 2) { ctx.moveTo(2, -2); ctx.quadraticCurveTo(11, 14, 3, 18); ctx.lineTo(-6, 16); }
    else { ctx.moveTo(0, -2); ctx.lineTo(-6, 15); ctx.lineTo(6, 15); }
    ctx.fill(); ctx.stroke();
    if (look.stache) { ctx.fillStyle = hair; ctx.beginPath(); ctx.moveTo(-18, 26); ctx.quadraticCurveTo(0, 17, 18, 26); ctx.quadraticCurveTo(0, 24, -18, 26); ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke(); }
    ctx.lineWidth = 3.5;
    if (mood === 'happy') { ctx.fillStyle = '#fbf6e8'; ctx.beginPath(); ctx.moveTo(-13, 30); ctx.quadraticCurveTo(0, 42, 13, 30); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else if (mood === 'sad') { ctx.beginPath(); ctx.moveTo(-11, 36); ctx.quadraticCurveTo(0, 29, 11, 36); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(-12, 32); ctx.quadraticCurveTo(0, 34, 12, 30); ctx.stroke(); }
    ctx.restore();
    // gloves up
    if (opts.pose !== 'plain') {
      const gc = trunks === '#b8231b' ? '#1f3f8f' : '#b8231b';
      for (const s of [-1, 1]) {
        const gx = 100 + s * 58, gy = 196;
        ctx.fillStyle = '#f1e6cc'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(gx, gy + 30, 22, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = gc; ctx.beginPath(); ctx.ellipse(gx, gy, 31, 33, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(gx + s * 22, gy + 6, 11, 16, -s * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(gx - s * 8, gy - 14, 10, 6, s * 0.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  };
})(globalThis.TOT = globalThis.TOT || {});
