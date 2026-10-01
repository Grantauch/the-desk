/* Tale of the Tape — cutscenes. Short full-screen moments for the turns of a life: the opening in
   1934, each new era, a world title. Drawn live in canvas; any key or click skips. With reduced
   motion they become a still card with a button.
   TOT.cutscene.play(kind, opts) -> Promise that resolves when the scene ends. */
(function (T) {
  'use strict';
  const D = T.data;
  const W = 1280, H = 720, INK = '#17130f';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (k) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
  const rand = (a, b) => a + Math.random() * (b - a);

  const SCENES = {
    intro: { dur: 9000, title: 'THE DEPRESSION', kicker: (o) => `${o.city}, ${D.START_YEAR}`, lines: (o) => ['One in five American workers has no job.', 'A good purse can feed a family for a month.', `You have ${o.money} and a pair of borrowed gloves.`] },
    war: { dur: 8500, title: 'THE WAR YEARS', kicker: () => 'December 1941', lines: () => ['America is at war.', 'Fighters trade robes for uniforms.', 'The draft board knows your name.'] },
    postwar: { dur: 7500, title: 'THE BOOM', kicker: () => '1946', lines: () => ['The soldiers are home.', 'Factories hum. Paychecks are fat.', 'Everybody wants a ticket to the fights.'] },
    tv: { dur: 8500, title: 'THE TELEVISION ERA', kicker: () => '1949', lines: () => ['Boxing moves into the living room.', 'Friday nights, coast to coast.', 'The small clubs start to empty out.'] },
    champion: { dur: 8000, title: 'CHAMPION OF THE WORLD', kicker: (o) => o.division, lines: (o) => [o.name, o.venue] },
    lastbell: { dur: 6500, title: 'THE LAST BELL', kicker: (o) => `${o.year}`, lines: (o) => [o.record, 'The gloves go on a nail by the door.'] },
  };

  T.cutscene = {
    play(kind, opts = {}) {
      const sc = SCENES[kind];
      if (!sc) return Promise.resolve();
      return new Promise((resolve) => {
        const el = document.createElement('div');
        el.className = `cutscene cs-${kind}`;
        el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-label', `${sc.title}. ${sc.lines(opts).join(' ')}`);
        const reduced = opts.reduced;
        el.innerHTML = `<canvas width="${W}" height="${H}" aria-hidden="true"></canvas>
          <div class="cs-text"><p class="cs-kicker">${esc(sc.kicker(opts))}</p><h2 class="cs-title">${esc(sc.title)}</h2>${sc.lines(opts).map((l, i) => `<p class="cs-line" style="--i:${i}">${esc(l)}</p>`).join('')}</div>
          <button class="cs-skip" type="button">${reduced ? 'Continue' : 'Skip ▸'}</button>`;
        document.body.appendChild(el);
        const canvas = el.querySelector('canvas'), ctx = canvas.getContext('2d');
        let start = performance.now(), raf = 0, done = false;
        const state = { parts: [], opts, kind };
        const finish = () => {
          if (done) return; done = true;
          cancelAnimationFrame(raf);
          window.removeEventListener('keydown', onKey, true);
          el.classList.add('out');
          setTimeout(() => { el.remove(); resolve(); }, reduced ? 0 : 450);
        };
        const onKey = (e) => { e.preventDefault(); e.stopPropagation(); if (performance.now() - start > 400) finish(); };
        window.addEventListener('keydown', onKey, true);
        el.addEventListener('click', () => { if (performance.now() - start > 400) finish(); });
        setTimeout(() => el.querySelector('.cs-skip').focus(), 50);
        const frame = (t) => {
          const k = (t - start) / sc.dur;
          draw(kind, ctx, t - start, k, state);
          if (!reduced && k >= 1) { finish(); return; }
          raf = requestAnimationFrame(frame);
        };
        if (reduced) { draw(kind, ctx, sc.dur * 0.7, 0.7, state); el.classList.add('static'); }
        else raf = requestAnimationFrame(frame);
        T.audio && T.audio.play(kind === 'war' ? 'reel' : kind === 'tv' ? 'tvon' : kind === 'champion' ? 'roar' : 'page', kind === 'champion' ? 1 : 0.8);
        if (kind === 'champion') setTimeout(() => !done && T.audio && T.audio.play('win', 1), 600);
      });
    },
  };

  // ---------- drawing ----------
  function draw(kind, c, ms, k, st) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (kind === 'intro') drawIntro(c, ms, k, st);
    else if (kind === 'war') drawWar(c, ms, k, st);
    else if (kind === 'postwar') drawPostwar(c, ms, k, st);
    else if (kind === 'tv') drawTV(c, ms, k, st);
    else if (kind === 'champion') drawChampion(c, ms, k, st);
    else if (kind === 'lastbell') drawLastBell(c, ms, k, st);
    // film grain over everything
    c.fillStyle = 'rgba(0,0,0,.06)';
    for (let i = 0; i < 160; i++) c.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    c.fillStyle = 'rgba(255,255,255,.04)';
    for (let i = 0; i < 80; i++) c.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
  }

  function skyline(c, y, col, seed) {
    c.fillStyle = col;
    c.beginPath(); c.moveTo(0, H);
    let x = 0, n = seed;
    const r = () => { n = (n * 9301 + 49297) % 233280; return n / 233280; };
    while (x < W) {
      const w = 40 + r() * 90, h = 60 + r() * 220;
      c.lineTo(x, y - h); c.lineTo(x + w, y - h);
      if (r() < 0.25) { c.lineTo(x + w * 0.4, y - h); c.lineTo(x + w * 0.45, y - h - 60 - r() * 60); c.lineTo(x + w * 0.55, y - h - 60); c.lineTo(x + w * 0.6, y - h); }
      x += w;
    }
    c.lineTo(W, H); c.closePath(); c.fill();
  }

  function sunburst(c, cx, cy, rot, col, n = 24) {
    c.save(); c.translate(cx, cy); c.rotate(rot); c.fillStyle = col;
    for (let i = 0; i < n; i++) { c.rotate((Math.PI * 2) / n); c.beginPath(); c.moveTo(0, 0); c.lineTo(-90, -1500); c.lineTo(90, -1500); c.closePath(); c.fill(); }
    c.restore();
  }

  function drawIntro(c, ms, k) {
    c.fillStyle = '#7a1d12'; c.fillRect(0, 0, W, H);
    sunburst(c, W / 2, H * 0.62, ms / 9000, 'rgba(255,214,150,.12)');
    const g = c.createRadialGradient(W / 2, H * 0.6, 50, W / 2, H * 0.6, 760); g.addColorStop(0, 'rgba(255,200,120,.35)'); g.addColorStop(1, 'rgba(20,4,2,.85)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // factory smoke
    for (let i = 0; i < 6; i++) {
      const x = 160 + i * 190 + Math.sin(ms / 1400 + i) * 20, y = 300 - ((ms / 30 + i * 80) % 260);
      const sg = c.createRadialGradient(x, y, 0, x, y, 90); sg.addColorStop(0, 'rgba(40,20,14,.35)'); sg.addColorStop(1, 'rgba(40,20,14,0)');
      c.fillStyle = sg; c.fillRect(x - 90, y - 90, 180, 180);
    }
    skyline(c, H * 0.86, '#1a0705', 7);
    // smokestacks
    c.fillStyle = '#1a0705'; for (const x of [210, 260, 980, 1040]) c.fillRect(x, H * 0.86 - 360, 26, 360);
    c.fillStyle = '#120403'; c.fillRect(0, H * 0.86, W, H);
    // a line of men waiting outside a relief office
    for (let i = 0; i < 14; i++) {
      const x = 360 + i * 44, y = H * 0.86;
      c.fillStyle = '#0b0302'; c.beginPath(); c.ellipse(x, y - 78, 11, 13, 0, 0, Math.PI * 2); c.fill();
      c.fillRect(x - 15, y - 88, 30, 5); c.fillRect(x - 9, y - 98, 18, 11);
      c.beginPath(); c.moveTo(x - 17, y); c.lineTo(x - 15, y - 62); c.quadraticCurveTo(x, y - 70, x + 15, y - 62); c.lineTo(x + 17, y); c.fill();
    }
    void k;
  }

  function drawWar(c, ms) {
    if (ms < 3000) {
      // newsreel countdown leader
      c.fillStyle = '#d8d0bd'; c.fillRect(0, 0, W, H);
      const n = 3 - Math.floor(ms / 1000), f = (ms % 1000) / 1000;
      c.fillStyle = '#9a917c';
      c.beginPath(); c.moveTo(W / 2, H / 2); c.arc(W / 2, H / 2, 600, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); c.closePath(); c.fill();
      c.strokeStyle = INK; c.lineWidth = 6;
      c.beginPath(); c.arc(W / 2, H / 2, 250, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(W / 2, H / 2, 210, 0, Math.PI * 2); c.stroke();
      c.lineWidth = 3; c.beginPath(); c.moveTo(0, H / 2); c.lineTo(W, H / 2); c.moveTo(W / 2, 0); c.lineTo(W / 2, H); c.stroke();
      c.fillStyle = INK; c.font = '400 280px "Alfa Slab One", Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), W / 2, H / 2 + 14);
      for (let i = 0; i < 4; i++) { c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(Math.random() * W, 0, 1.5, H); }
      return;
    }
    const m = ms - 3000;
    c.fillStyle = '#0a0d14'; c.fillRect(0, 0, W, H);
    // searchlights
    c.save(); c.globalCompositeOperation = 'lighter';
    [[260, 0.4, 0.0009], [640, -0.2, 0.0012], [1020, 0.25, -0.001]].forEach(([x, a0, sp]) => {
      const a = a0 + Math.sin(m * sp) * 0.5;
      const g = c.createLinearGradient(x, H, x + Math.sin(a) * 800, H - Math.cos(a) * 800); g.addColorStop(0, 'rgba(230,235,255,.35)'); g.addColorStop(1, 'rgba(230,235,255,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(x - 10, H); c.lineTo(x + Math.sin(a - 0.07) * 1000, H - Math.cos(a - 0.07) * 1000); c.lineTo(x + Math.sin(a + 0.07) * 1000, H - Math.cos(a + 0.07) * 1000); c.lineTo(x + 10, H); c.fill();
    });
    c.restore();
    skyline(c, H * 0.9, '#05070b', 13);
    // a troop ship on the water
    c.fillStyle = '#060810'; c.fillRect(0, H * 0.9, W, H);
    const sx = 140 + m * 0.03;
    c.fillStyle = '#10131c'; c.beginPath(); c.moveTo(sx, H * 0.92); c.lineTo(sx + 420, H * 0.92); c.lineTo(sx + 390, H * 0.97); c.lineTo(sx + 30, H * 0.97); c.closePath(); c.fill();
    c.fillRect(sx + 140, H * 0.92 - 50, 120, 50); c.fillRect(sx + 185, H * 0.92 - 90, 26, 40);
  }

  function drawPostwar(c, ms, k, st) {
    c.fillStyle = '#0d1022'; c.fillRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(30,40,90,.6)'); g.addColorStop(1, 'rgba(120,50,30,.5)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    // fireworks
    if (Math.random() < 0.06) { const x = rand(150, W - 150), y = rand(80, 320), col = ['#ffe27a', '#ff8a65', '#9ad0ff', '#f1e6cc'][Math.floor(rand(0, 4))]; for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2, v = rand(1.5, 4); st.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, col }); } }
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const p of st.parts) { p.x += p.vx; p.y += p.vy; p.vy += 0.04; p.vx *= 0.985; p.life -= 0.012; c.fillStyle = p.col; c.globalAlpha = Math.max(0, p.life); c.fillRect(p.x, p.y, 3, 3); }
    c.restore(); c.globalAlpha = 1;
    st.parts = st.parts.filter((p) => p.life > 0);
    skyline(c, H * 0.88, '#06070f', 21);
    c.fillStyle = '#06070f'; c.fillRect(0, H * 0.88, W, H);
    void ms; void k;
  }

  function drawTV(c, ms) {
    c.fillStyle = '#050505'; c.fillRect(0, 0, W, H);
    const on = clamp((ms - 500) / 600, 0, 1);
    if (on <= 0) { c.fillStyle = '#fff'; c.beginPath(); c.arc(W / 2, H / 2, 3, 0, Math.PI * 2); c.fill(); return; }
    // the picture tube warming up: a line, then the whole screen
    const sh = on < 0.5 ? 4 + on * 2 * 40 : H;
    c.save();
    c.beginPath(); c.rect(0, H / 2 - sh / 2, W, sh); c.clip();
    // a test pattern
    c.fillStyle = '#9a9a9a'; c.fillRect(0, 0, W, H);
    const bars = ['#f0f0f0', '#cfcfcf', '#adadad', '#8a8a8a', '#686868', '#474747', '#262626'];
    bars.forEach((b, i) => { c.fillStyle = b; c.fillRect((W / 7) * i, 0, W / 7 + 1, H * 0.12); c.fillRect((W / 7) * i, H * 0.88, W / 7 + 1, H * 0.12); });
    c.strokeStyle = '#111'; c.lineWidth = 8;
    for (const r of [300, 220, 140]) { c.beginPath(); c.arc(W / 2, H / 2, r, 0, Math.PI * 2); c.stroke(); }
    c.lineWidth = 4; c.beginPath(); c.moveTo(W / 2 - 320, H / 2); c.lineTo(W / 2 + 320, H / 2); c.moveTo(W / 2, H / 2 - 320); c.lineTo(W / 2, H / 2 + 320); c.stroke();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; c.beginPath(); c.moveTo(W / 2 + Math.cos(a) * 140, H / 2 + Math.sin(a) * 140); c.lineTo(W / 2 + Math.cos(a) * 300, H / 2 + Math.sin(a) * 300); c.stroke(); }
    // scanlines and roll
    c.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 2);
    const roll = (ms / 6) % H; c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(0, roll, W, 60);
    c.restore();
    const v = c.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 760); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.85)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
  }

  function drawChampion(c, ms, k, st) {
    c.fillStyle = '#0c0504'; c.fillRect(0, 0, W, H);
    // crowd in the dark
    for (let i = 0; i < 70; i++) { const x = (i * 97) % W, y = 470 + ((i * 37) % 140); c.fillStyle = 'rgba(40,16,10,1)'; c.beginPath(); c.ellipse(x, y, 16, 18, 0, 0, Math.PI * 2); c.fill(); c.fillRect(x - 26, y + 14, 52, 80); }
    // spotlight
    const s = clamp(ms / 900, 0, 1);
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(255,240,200,${0.5 * s})`); g.addColorStop(1, `rgba(255,240,200,${0.15 * s})`);
    c.fillStyle = g; c.beginPath(); c.moveTo(W / 2 - 40, 0); c.lineTo(W / 2 + 40, 0); c.lineTo(W / 2 + 330, H); c.lineTo(W / 2 - 330, H); c.closePath(); c.fill();
    c.restore();
    // the fighter, raised up
    if (!st.portrait && T.portrait) { st.portrait = document.createElement('canvas'); st.portrait.width = 440; st.portrait.height = 528; T.portrait(st.portrait, st.opts.look, { mood: 'happy', bg: '#e0a526' }); }
    if (st.portrait) {
      const rise = ease(clamp((ms - 300) / 1200, 0, 1));
      const y = H - rise * 560;
      c.save(); c.translate(W / 2, y + 264); c.rotate(Math.sin(ms / 900) * 0.015);
      c.fillStyle = '#17130f'; c.fillRect(-232, -276, 464, 552);
      c.drawImage(st.portrait, -220, -264, 440, 528);
      // the belt
      c.fillStyle = '#e0a526'; c.strokeStyle = INK; c.lineWidth = 6;
      c.fillRect(-240, 170, 480, 54); c.strokeRect(-240, 170, 480, 54);
      c.beginPath(); c.ellipse(0, 197, 70, 54, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#b8231b'; c.beginPath(); c.ellipse(0, 197, 44, 32, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#f1e6cc'; c.font = '400 26px "Alfa Slab One", Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('★', 0, 199);
      c.restore();
    }
    // flashbulbs
    if (Math.random() < 0.18) st.parts.push({ kind: 'bulb', x: rand(80, W - 80), y: rand(420, 640), life: 1 });
    // ticker tape
    if (ms > 1200 && st.parts.filter((p) => p.kind === 'tape').length < 240) for (let i = 0; i < 6; i++) st.parts.push({ kind: 'tape', x: rand(0, W), y: -20, vy: rand(1.5, 3.5), vx: rand(-0.6, 0.6), r: rand(0, 6), vr: rand(-0.1, 0.1), w: rand(6, 11), h: rand(14, 26), col: ['#f1e6cc', '#fff', '#e0a526'][Math.floor(rand(0, 3))] });
    for (const p of st.parts) {
      if (p.kind === 'bulb') { const gg = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 90); gg.addColorStop(0, `rgba(255,255,255,${p.life})`); gg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gg; c.fillRect(p.x - 90, p.y - 90, 180, 180); p.life -= 0.08; }
      else { p.x += p.vx; p.y += p.vy; p.r += p.vr; c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = p.col; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore(); }
    }
    st.parts = st.parts.filter((p) => (p.kind === 'bulb' ? p.life > 0 : p.y < H + 30));
    void k;
  }

  function drawLastBell(c, ms) {
    c.fillStyle = '#120a07'; c.fillRect(0, 0, W, H);
    const g = c.createRadialGradient(W / 2, 260, 40, W / 2, 260, 600); g.addColorStop(0, 'rgba(255,220,160,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    // an empty ring and a stool in the corner
    c.fillStyle = '#3a2a1c'; c.beginPath(); c.moveTo(220, 470); c.lineTo(1060, 470); c.lineTo(1240, 720); c.lineTo(40, 720); c.closePath(); c.fill();
    c.strokeStyle = '#d8c8a8'; c.lineWidth = 6; for (const y of [330, 380, 430]) { c.beginPath(); c.moveTo(200, y); c.quadraticCurveTo(640, y + 12, 1080, y); c.stroke(); }
    c.fillStyle = '#1b120b'; c.fillRect(190, 300, 22, 190); c.fillRect(1068, 300, 22, 190);
    c.fillStyle = '#5a3d22'; c.fillRect(560, 560, 160, 18); c.fillRect(575, 578, 14, 80); c.fillRect(690, 578, 14, 80);
    // gloves hanging by their laces, swaying
    const sw = Math.sin(ms / 700) * 0.08;
    c.save(); c.translate(640, 90); c.rotate(sw);
    c.strokeStyle = '#d8c8a8'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(-40, 160); c.moveTo(0, 0); c.lineTo(40, 170); c.stroke();
    c.fillStyle = '#8a2a1c'; c.strokeStyle = INK; c.lineWidth = 5;
    c.beginPath(); c.ellipse(-44, 200, 42, 48, 0.2, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(44, 210, 42, 48, -0.2, 0, Math.PI * 2); c.fill(); c.stroke();
    c.restore();
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]); }
})(globalThis.TOT = globalThis.TOT || {});
