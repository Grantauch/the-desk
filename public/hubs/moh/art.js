/*
 * Medal of Honor project · the memorial screen.
 * MOHArt.render draws a finished 1600 by 900 screen from a small saved design.
 * MOHArt.designer builds the editing tools on the project page.
 * The design is plain JSON saved in one answer box, so it travels with the
 * student's account like any other answer. Nothing here sends anything.
 */
(function (root) {
  'use strict';
  var W = 1600, H = 900, FRAME_W = 800, FRAME_H = 600, MAX = 5800;
  var COLORS = ['#141414', '#f5f0e1', '#7fb3dc', '#cf9f45', '#b3362a', '#5d6b3c', '#8a6a4a', '#9aa3ad'];
  var SIZES = [3, 7, 14];
  var BACKS = {
    night: { label: 'Night ribbon', text: '#f5f0e1', soft: '#a9cdea', accent: '#e7bf6a' },
    parchment: { label: 'Citation paper', text: '#1c1813', soft: '#5a4a35', accent: '#8a5a12' },
    dusk: { label: 'Battlefield dusk', text: '#fff4e2', soft: '#f3c9a0', accent: '#ffd27a' },
    bronze: { label: 'Bronze plaque', text: '#fbe8bf', soft: '#e3c58a', accent: '#fff2cc' }
  };
  var LAYOUTS = { left: 'Picture left', right: 'Picture right', center: 'Picture on top' };
  var STAMPS = ['medal', 'poppy', 'helmet', 'tags', 'plane', 'flag', 'wreath', 'cross', 'pin'];
  var STAMP_LABEL = { medal: 'Medal', poppy: 'Poppy', helmet: 'Helmet', tags: 'Dog tags', plane: 'Biplane', flag: 'Flag', wreath: 'Wreath', cross: 'Grave cross', pin: 'Map pin' };

  function frame(lay) {
    if (lay === 'right') return { x: 720, y: 150 };
    if (lay === 'center') return { x: 400, y: 50 };
    return { x: 80, y: 150 };
  }
  function blank() { return { v: 1, bg: 'night', lay: 'left', ink: [], st: [] }; }
  function parse(text) {
    try {
      var d = JSON.parse(text);
      if (d && d.v === 1) {
        if (!BACKS[d.bg]) d.bg = 'night';
        if (!LAYOUTS[d.lay]) d.lay = 'left';
        d.ink = Array.isArray(d.ink) ? d.ink : []; d.st = Array.isArray(d.st) ? d.st : [];
        return d;
      }
    } catch (e) { /* new design */ }
    return blank();
  }
  function hex2(n) { n = Math.max(0, Math.min(255, Math.round(n))); return (n < 16 ? '0' : '') + n.toString(16); }
  function decode(str) {
    var pts = [];
    for (var i = 0; i + 3 < str.length; i += 4) pts.push([parseInt(str.substr(i, 2), 16), parseInt(str.substr(i + 2, 2), 16)]);
    return pts;
  }

  /* ------------------------------------------------------------- stamps -- */
  function star(ctx, cx, cy, r, inner) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * (inner || 0.42) : r;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
  }
  function drawStamp(ctx, type, x, y, size) {
    var s = size / 100;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(-50, -50);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (type === 'medal') {
      ctx.fillStyle = '#7fb3dc'; ctx.fillRect(34, 0, 32, 30);
      ctx.fillStyle = '#f5f0e1'; [[42, 8], [50, 8], [58, 8], [46, 16], [54, 16], [42, 24], [50, 24], [58, 24]].forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], 1.6, 0, 7); ctx.fill(); });
      ctx.fillStyle = '#cf9f45'; ctx.fillRect(44, 30, 12, 8);
      star(ctx, 50, 66, 30, 0.45); ctx.fillStyle = '#d9a94b'; ctx.fill(); ctx.strokeStyle = '#6d4f18'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(50, 68, 10, 0, 7); ctx.fillStyle = '#efc977'; ctx.fill(); ctx.stroke();
    } else if (type === 'poppy') {
      ctx.fillStyle = '#c4271f';
      for (var i = 0; i < 5; i++) { var a = i * Math.PI * 2 / 5; ctx.beginPath(); ctx.ellipse(50 + Math.cos(a) * 20, 50 + Math.sin(a) * 20, 22, 18, a, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#9c1b14'; ctx.beginPath(); ctx.arc(50, 50, 16, 0, 7); ctx.fill();
      ctx.fillStyle = '#141414'; ctx.beginPath(); ctx.arc(50, 50, 9, 0, 7); ctx.fill();
    } else if (type === 'helmet') {
      ctx.fillStyle = '#5d6b3c'; ctx.strokeStyle = '#2e3520'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(50, 62, 46, 12, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(50, 58, 28, 24, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#6c7b46'; ctx.fill(); ctx.stroke();
    } else if (type === 'tags') {
      ctx.strokeStyle = '#9aa3ad'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(30, 6); ctx.quadraticCurveTo(50, 40, 70, 6); ctx.stroke();
      [[34, 30, -0.2], [52, 36, 0.25]].forEach(function (t) {
        ctx.save(); ctx.translate(t[0] + 12, t[1] + 20); ctx.rotate(t[2]); ctx.fillStyle = '#c7ced6'; ctx.strokeStyle = '#6a7380';
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-14, -22, 28, 44, 7); else ctx.rect(-14, -22, 28, 44); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#6a7380'; ctx.fillRect(-8, -10, 16, 2); ctx.fillRect(-8, -4, 12, 2); ctx.fillRect(-8, 2, 14, 2); ctx.restore();
      });
    } else if (type === 'plane') {
      ctx.fillStyle = '#8a6a4a'; ctx.strokeStyle = '#3d2e1f'; ctx.lineWidth = 2;
      ctx.fillRect(8, 34, 84, 9); ctx.strokeRect(8, 34, 84, 9);
      ctx.fillRect(14, 56, 72, 8); ctx.strokeRect(14, 56, 72, 8);
      ctx.beginPath(); ctx.moveTo(30, 43); ctx.lineTo(30, 56); ctx.moveTo(70, 43); ctx.lineTo(70, 56); ctx.stroke();
      ctx.fillStyle = '#6b5236'; ctx.beginPath(); ctx.ellipse(50, 50, 9, 30, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(22, 38, 3.5, 0, 7); ctx.arc(78, 38, 3.5, 0, 7); ctx.fill();
      ctx.strokeStyle = '#141414'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(38, 16); ctx.lineTo(62, 16); ctx.stroke();
    } else if (type === 'flag') {
      for (var r = 0; r < 7; r++) { ctx.fillStyle = r % 2 ? '#f5f0e1' : '#b3362a'; ctx.fillRect(4, 20 + r * 8.6, 92, 8.6); }
      ctx.fillStyle = '#23365c'; ctx.fillRect(4, 20, 40, 34.4);
      ctx.fillStyle = '#f5f0e1'; for (var a2 = 0; a2 < 4; a2++) for (var b = 0; b < 5; b++) { ctx.beginPath(); ctx.arc(9 + b * 7.5, 25 + a2 * 8, 1.4, 0, 7); ctx.fill(); }
    } else if (type === 'wreath') {
      ctx.fillStyle = '#4c6b34';
      for (var k = 0; k < 22; k++) { var t = Math.PI * 0.62 + k * Math.PI * 1.76 / 21; ctx.save(); ctx.translate(50 + Math.cos(t) * 36, 50 + Math.sin(t) * 36); ctx.rotate(t + Math.PI / 4); ctx.beginPath(); ctx.ellipse(0, 0, 9, 4, 0, 0, 7); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = '#b3362a'; ctx.beginPath(); ctx.moveTo(50, 84); ctx.lineTo(38, 98); ctx.lineTo(46, 98); ctx.lineTo(50, 90); ctx.lineTo(54, 98); ctx.lineTo(62, 98); ctx.closePath(); ctx.fill();
    } else if (type === 'cross') {
      ctx.fillStyle = '#f5f0e1'; ctx.strokeStyle = '#8b8778'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.rect(42, 6, 16, 88); ctx.rect(20, 26, 60, 15); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5d6b3c'; ctx.fillRect(10, 92, 80, 6);
    } else if (type === 'pin') {
      ctx.fillStyle = '#b3362a'; ctx.strokeStyle = '#5e130d'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(50, 38, 26, Math.PI * 0.85, Math.PI * 2.15); ctx.lineTo(50, 96); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f5f0e1'; ctx.beginPath(); ctx.arc(50, 38, 10, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  /* --------------------------------------------------------- background -- */
  function seeded(n) { var x = Math.sin(n * 9301 + 49297) * 233280; return x - Math.floor(x); }
  function drawBack(ctx, bg) {
    var g;
    if (bg === 'parchment') {
      ctx.fillStyle = '#efe4c8'; ctx.fillRect(0, 0, W, H);
      for (var i = 0; i < 260; i++) { ctx.fillStyle = 'rgba(120,90,40,' + (0.03 + seeded(i) * 0.05) + ')'; ctx.beginPath(); ctx.arc(seeded(i + 1) * W, seeded(i + 2) * H, 2 + seeded(i + 3) * 30, 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#8a5a12'; ctx.lineWidth = 6; ctx.strokeRect(28, 28, W - 56, H - 56); ctx.lineWidth = 2; ctx.strokeRect(44, 44, W - 88, H - 88);
    } else if (bg === 'dusk') {
      g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2b2340'); g.addColorStop(0.45, '#8c4a46'); g.addColorStop(0.75, '#e08a4a'); g.addColorStop(1, '#3a2418');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#1d140f'; ctx.beginPath(); ctx.moveTo(0, H);
      for (var x = 0; x <= W; x += 40) ctx.lineTo(x, 780 + Math.sin(x / 140) * 28 + seeded(x) * 18);
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#1d140f'; ctx.lineWidth = 4;
      for (var p = 60; p < W; p += 170) { ctx.beginPath(); ctx.moveTo(p, 790); ctx.lineTo(p + 6, 740); ctx.stroke(); }
      ctx.lineWidth = 1.5; ctx.beginPath(); for (var q = 60; q < W; q += 12) ctx.lineTo(q, 752 + Math.sin(q / 9) * 6); ctx.stroke();
    } else if (bg === 'bronze') {
      g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#5a3d17'); g.addColorStop(0.5, '#8a6326'); g.addColorStop(1, '#3f2a10');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#e3c58a'; ctx.lineWidth = 5; ctx.strokeRect(36, 36, W - 72, H - 72);
      ctx.fillStyle = '#e3c58a'; [[60, 60], [W - 60, 60], [60, H - 60], [W - 60, H - 60]].forEach(function (r) { ctx.beginPath(); ctx.arc(r[0], r[1], 9, 0, 7); ctx.fill(); });
    } else {
      g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1322'); g.addColorStop(1, '#1d2c48');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (var s = 0; s < 120; s++) { ctx.fillStyle = 'rgba(245,240,225,' + (0.15 + seeded(s) * 0.5) + ')'; ctx.beginPath(); ctx.arc(seeded(s + 7) * W, seeded(s + 9) * 560, 0.8 + seeded(s + 11) * 1.8, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#7fb3dc'; ctx.fillRect(0, H - 46, W, 46);
      ctx.fillStyle = '#f5f0e1'; for (var d = 20; d < W; d += 40) { star(ctx, d, H - 23, 8); ctx.fill(); }
    }
  }

  /* --------------------------------------------------------------- text -- */
  function wrap(ctx, text, x, y, maxW, lineH, maxLines, align) {
    var words = String(text || '').split(/\s+/).filter(Boolean), line = '', lines = [];
    words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…'; }
    ctx.textAlign = align || 'left';
    lines.forEach(function (l, i) { ctx.fillText(l, x, y + i * lineH); });
    return y + lines.length * lineH;
  }
  function drawText(ctx, d, t) {
    var c = BACKS[d.bg], col, x, y, w, align;
    if (d.lay === 'center') { x = W / 2; y = 720; w = 1300; align = 'center'; }
    else { col = d.lay === 'right' ? 80 : 960; x = col; y = 210; w = 560; align = 'left'; }
    ctx.fillStyle = c.accent; ctx.font = '600 26px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
    if (d.lay !== 'center') { ctx.textAlign = 'left'; ctx.fillText(String((t.rank || '') + ' · Medal of Honor').toUpperCase(), x, y - 40); }
    ctx.fillStyle = c.text; ctx.font = '800 ' + (d.lay === 'center' ? 64 : 76) + 'px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
    y = wrap(ctx, String(t.name || '').toUpperCase(), x, y + (d.lay === 'center' ? 0 : 40), w, d.lay === 'center' ? 64 : 76, 2, align);
    if (d.lay === 'center') {
      ctx.fillStyle = c.soft; ctx.font = 'italic 400 34px "Source Serif 4", Georgia, serif';
      wrap(ctx, t.quote ? '“' + t.quote.replace(/^["“]|["”]$/g, '') + '”' : (t.title || ''), x, y + 22, w, 42, 2, align);
      return;
    }
    ctx.fillStyle = c.accent; ctx.font = '600 30px "Barlow", Arial, sans-serif';
    y = wrap(ctx, t.title || '', x, y + 26, w, 38, 2, align);
    ctx.fillStyle = c.soft; ctx.font = '400 24px "Barlow", Arial, sans-serif';
    y = wrap(ctx, (t.date || '') + (t.place ? ' · ' + t.place : ''), x, y + 14, w, 30, 2, align);
    if (t.quote) { ctx.fillStyle = c.text; ctx.font = 'italic 400 32px "Source Serif 4", Georgia, serif'; y = wrap(ctx, '“' + t.quote.replace(/^["“]|["”]$/g, '') + '”', x, y + 40, w, 42, 4, align); }
    if (t.caption) { ctx.fillStyle = c.soft; ctx.font = '400 24px "Barlow", Arial, sans-serif'; wrap(ctx, t.caption, x, y + 34, w, 32, 3, align); }
    if (t.by) { ctx.fillStyle = c.soft; ctx.font = '600 20px "Barlow Condensed", Arial, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(String(t.by).toUpperCase(), x, H - 76); }
  }

  /* ------------------------------------------------------------- render -- */
  function render(canvas, design, texts, opts) {
    var d = typeof design === 'string' ? parse(design) : (design || blank());
    var ctx = canvas.getContext('2d');
    canvas.width = W; canvas.height = H;
    drawBack(ctx, d.bg);
    var f = frame(d.lay);
    ctx.save();
    ctx.fillStyle = d.bg === 'parchment' ? '#fbf6ea' : 'rgba(245,240,225,0.95)';
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    ctx.fillRect(f.x, f.y, FRAME_W, FRAME_H); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(f.x, f.y, FRAME_W, FRAME_H); ctx.clip();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    d.ink.forEach(function (s) {
      var pts = decode(s[2] || ''); if (!pts.length) return;
      ctx.strokeStyle = COLORS[s[0]] || COLORS[0]; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = SIZES[s[1]] || SIZES[1];
      ctx.beginPath();
      pts.forEach(function (p, i) { var px = f.x + p[0] / 255 * FRAME_W, py = f.y + p[1] / 255 * FRAME_H; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
      if (pts.length === 1) { ctx.arc(f.x + pts[0][0] / 255 * FRAME_W, f.y + pts[0][1] / 255 * FRAME_H, ctx.lineWidth / 2, 0, 7); ctx.fill(); } else ctx.stroke();
    });
    ctx.restore();
    ctx.strokeStyle = d.bg === 'parchment' ? '#8a5a12' : 'rgba(231,191,106,.8)'; ctx.lineWidth = 4; ctx.strokeRect(f.x, f.y, FRAME_W, FRAME_H);
    d.st.forEach(function (s, i) {
      drawStamp(ctx, s[0], s[1] * 4, s[2] * 4, s[3]);
      if (opts && opts.selected === i) { ctx.strokeStyle = '#e7bf6a'; ctx.setLineDash([10, 8]); ctx.lineWidth = 3; ctx.strokeRect(s[1] * 4 - s[3] / 2 - 6, s[2] * 4 - s[3] / 2 - 6, s[3] + 12, s[3] + 12); ctx.setLineDash([]); }
    });
    drawText(ctx, d, texts || {});
    return canvas;
  }

  /* ----------------------------------------------------------- designer -- */
  function designer(host, opts) {
    var d = parse(opts.value || ''), color = 0, size = 1, selected = -1, drawing = null, dragging = null;
    function el(tag, attrs, text) { var n = document.createElement(tag); Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); }); if (text != null) n.textContent = text; return n; }
    host.innerHTML = '';
    var canvas = el('canvas', { class: 'art-canvas', width: W, height: H, 'aria-label': 'Your memorial screen. Draw inside the frame with the mouse or your finger.', role: 'img' });
    var tools = el('div', { class: 'art-tools' });
    var meter = el('div', { class: 'art-ink' }), bar = el('span'), meterText = el('small');
    meter.appendChild(bar); meter.appendChild(meterText);
    function group(title) { var g = el('fieldset', { class: 'art-group' }); g.appendChild(el('legend', {}, title)); tools.appendChild(g); return g; }
    function button(parent, label, on, extra) { var b = el('button', Object.assign({ type: 'button' }, extra || {}), label); b.addEventListener('click', on); parent.appendChild(b); return b; }

    var gb = group('Background');
    Object.keys(BACKS).forEach(function (k) { button(gb, BACKS[k].label, function () { d.bg = k; commit(); }, { 'data-bg': k }); });
    var gl = group('Layout');
    Object.keys(LAYOUTS).forEach(function (k) { button(gl, LAYOUTS[k], function () { d.lay = k; commit(); }, { 'data-lay': k }); });
    var gc = group('Pencil color');
    COLORS.forEach(function (c, i) { var b = button(gc, '', function () { color = i; paint(); }, { 'data-color': i, 'aria-label': 'Color ' + (i + 1), style: 'background:' + c }); b.className = 'swatch'; });
    var gs = group('Pencil size');
    ['Thin', 'Medium', 'Thick'].forEach(function (n, i) { button(gs, n, function () { size = i; paint(); }, { 'data-size': i }); });
    var gu = group('Fix it');
    button(gu, 'Undo last line', function () { d.ink.pop(); commit(); });
    button(gu, 'Clear drawing', function () { if (d.ink.length && window.confirm('Erase every line you drew? Stamps stay.')) { d.ink = []; commit(); } });
    var gt = group('Add a stamp');
    STAMPS.forEach(function (s) { button(gt, STAMP_LABEL[s], function () { if (d.st.length >= 12) return; var n = d.st.length % 5, f = frame(d.lay); d.st.push([s, Math.round((f.x + FRAME_W / 2) / 4) + (n - 2) * 12, Math.round((f.y + FRAME_H / 2) / 4) + (n - 2) * 8, 140]); selected = d.st.length - 1; commit(); }, { 'data-stamp': s }); });
    var gsel = group('Selected stamp');
    button(gsel, 'Bigger', function () { if (selected >= 0) { d.st[selected][3] = Math.min(400, d.st[selected][3] + 30); commit(); } });
    button(gsel, 'Smaller', function () { if (selected >= 0) { d.st[selected][3] = Math.max(40, d.st[selected][3] - 30); commit(); } });
    button(gsel, 'Remove', function () { if (selected >= 0) { d.st.splice(selected, 1); selected = -1; commit(); } });
    var hint = el('p', { class: 'art-hint' }, 'Draw inside the white frame. Drag a stamp to move it. Your design saves by itself.');
    host.appendChild(canvas); host.appendChild(meter); host.appendChild(hint); host.appendChild(tools);

    function json() { return JSON.stringify(d); }
    function paint() {
      render(canvas, d, opts.texts ? opts.texts() : {}, { selected: selected });
      if (drawing) { var f = frame(d.lay), ctx = canvas.getContext('2d'); ctx.save(); ctx.beginPath(); ctx.rect(f.x, f.y, FRAME_W, FRAME_H); ctx.clip(); ctx.strokeStyle = COLORS[color]; ctx.lineWidth = SIZES[size]; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); drawing.forEach(function (p, i) { var x = f.x + p[0] / 255 * FRAME_W, y = f.y + p[1] / 255 * FRAME_H; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke(); ctx.restore(); }
      var used = json().length, pct = Math.min(100, Math.round(used / MAX * 100));
      bar.style.width = pct + '%'; bar.className = pct > 90 ? 'full' : '';
      meterText.textContent = pct >= 100 ? 'Ink is full. Undo a line to keep drawing.' : 'Ink used: ' + pct + '%';
      tools.querySelectorAll('[data-bg]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-bg') === d.bg ? 'true' : 'false'); });
      tools.querySelectorAll('[data-lay]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-lay') === d.lay ? 'true' : 'false'); });
      tools.querySelectorAll('[data-color]').forEach(function (b) { b.setAttribute('aria-pressed', Number(b.getAttribute('data-color')) === color ? 'true' : 'false'); });
      tools.querySelectorAll('[data-size]').forEach(function (b) { b.setAttribute('aria-pressed', Number(b.getAttribute('data-size')) === size ? 'true' : 'false'); });
      gsel.disabled = selected < 0;
    }
    function commit() { paint(); opts.onChange(json()); }
    function at(e) { var r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; }
    function hitStamp(p) { for (var i = d.st.length - 1; i >= 0; i--) { var s = d.st[i], h = s[3] / 2 + 6; if (Math.abs(p[0] - s[1] * 4) < h && Math.abs(p[1] - s[2] * 4) < h) return i; } return -1; }
    canvas.addEventListener('pointerdown', function (e) {
      if (opts.locked && opts.locked()) return;
      var p = at(e), hit = hitStamp(p);
      canvas.setPointerCapture(e.pointerId);
      if (hit >= 0) { selected = hit; dragging = { i: hit, dx: p[0] - d.st[hit][1] * 4, dy: p[1] - d.st[hit][2] * 4 }; paint(); return; }
      var f = frame(d.lay);
      if (p[0] < f.x || p[0] > f.x + FRAME_W || p[1] < f.y || p[1] > f.y + FRAME_H) { selected = -1; paint(); return; }
      if (json().length >= MAX) { paint(); return; }
      selected = -1;
      drawing = [[(p[0] - f.x) / FRAME_W * 255, (p[1] - f.y) / FRAME_H * 255]];
      paint();
    });
    canvas.addEventListener('pointermove', function (e) {
      var p = at(e);
      if (dragging) { var s = d.st[dragging.i]; s[1] = Math.round(Math.max(0, Math.min(W, p[0] - dragging.dx)) / 4); s[2] = Math.round(Math.max(0, Math.min(H, p[1] - dragging.dy)) / 4); paint(); return; }
      if (!drawing) return;
      var f = frame(d.lay), q = [Math.max(0, Math.min(255, (p[0] - f.x) / FRAME_W * 255)), Math.max(0, Math.min(255, (p[1] - f.y) / FRAME_H * 255))], last = drawing[drawing.length - 1];
      if (Math.abs(q[0] - last[0]) + Math.abs(q[1] - last[1]) >= 2.2) { drawing.push(q); paint(); }
    });
    function end() {
      if (dragging) { dragging = null; commit(); return; }
      if (!drawing) return;
      var str = drawing.map(function (p) { return hex2(p[0]) + hex2(p[1]); }).join('');
      drawing = null;
      d.ink.push([color, size, str]);
      if (json().length > MAX) { d.ink.pop(); commit(); window.alert('That line used more ink than you have left. Undo a line or two, then draw it again.'); return; }
      commit();
    }
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    paint();
    return { refresh: paint, load: function (text) { d = parse(text); selected = -1; paint(); } };
  }

  function image(design, texts) {
    var c = document.createElement('canvas'); render(c, design, texts); return c.toDataURL('image/png');
  }
  root.MOHArt = { render: render, designer: designer, image: image, parse: parse, W: W, H: H };
})(typeof window !== 'undefined' ? window : globalThis);
