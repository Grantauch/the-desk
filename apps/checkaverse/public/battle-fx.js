// Attack animations for the battle screen. Every move gets an effect drawn from its type: an ember fireball, a
// tide wave, swirling leaves, a spinning gear, a falling star, stone shards, a lightning strike, a shade wisp, and
// a plain impact for Strike. Guard raises a shield and Recover lifts sparkles. Pure DOM and the Web Animations API,
// nothing to load. With reduced motion every effect becomes a short still flash on the target.
(() => {
  'use strict';
  const TYPE = {
    ember: { core: '#ffcf4a', glow: '#ff6a1f', shape: 'orb' },
    tide: { core: '#bff0ff', glow: '#2f8fe0', shape: 'orb' },
    meadow: { core: '#c8f07a', glow: '#3f9b3a', shape: 'leaves' },
    gear: { core: '#ffe9a6', glow: '#c9a227', shape: 'gear' },
    cosmic: { core: '#fff6c8', glow: '#a77bff', shape: 'star' },
    stone: { core: '#d9cbb3', glow: '#7d6a55', shape: 'rocks' },
    storm: { core: '#fffbd0', glow: '#8fd3ff', shape: 'bolt' },
    shade: { core: '#d6c2ff', glow: '#4a2a7a', shape: 'wisp' },
  };
  const PLAIN = { core: '#ffffff', glow: '#ffd166', shape: 'impact' };

  const centerOf = (scene, el) => {
    const s = scene.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height * 0.55, w: r.width, h: r.height };
  };
  function bit(scene, cls, style) {
    const el = document.createElement('span');
    el.className = `fx ${cls}`;
    for (const [k, v] of Object.entries(style)) { if (k.startsWith('--')) el.style.setProperty(k, v); else el.style[k] = v; }
    scene.appendChild(el);
    return el;
  }
  const done = (anim, el) => anim.finished.then(() => el.remove(), () => el.remove());
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // The shapes that fly.
  function projectile(scene, from, to, c, ms) {
    const size = Math.max(26, Math.min(64, to.w * 0.28));
    const el = bit(scene, `fx-${c.shape}`, {
      width: `${size}px`, height: `${size}px`, left: `${from.x - size / 2}px`, top: `${from.y - size / 2}px`,
      '--core': c.core, '--glow': c.glow,
    });
    if (c.shape === 'leaves' || c.shape === 'rocks') for (let i = 0; i < 3; i++) el.appendChild(document.createElement('i'));
    const dx = to.x - from.x, dy = to.y - from.y;
    const arc = c.shape === 'rocks' ? -Math.abs(dy) * 0.6 - 40 : c.shape === 'wisp' ? 30 : -20;
    const spin = c.shape === 'gear' || c.shape === 'leaves' ? 720 : c.shape === 'star' ? 360 : 0;
    const frames = [0, 0.5, 1].map((t) => ({
      transform: `translate(${dx * t}px, ${dy * t + arc * 4 * t * (1 - t)}px) rotate(${spin * t}deg) scale(${0.6 + 0.6 * t})`,
      opacity: t === 1 ? 0.9 : 1,
    }));
    const a = el.animate(frames, { duration: ms, easing: 'cubic-bezier(.4,.05,.6,1)' });
    // A short trail of fading copies behind the shape.
    for (let k = 1; k <= 3; k++) {
      const ghost = el.cloneNode(true);
      ghost.style.opacity = String(0.35 / k);
      scene.appendChild(ghost);
      done(ghost.animate(frames, { duration: ms, delay: k * 45, easing: 'cubic-bezier(.4,.05,.6,1)' }), ghost);
    }
    done(a, el);
    return a.finished.catch(() => {});
  }
  // A lightning bolt drops from the top of the scene straight onto the target, with a white flash.
  async function bolt(scene, to, c) {
    const el = bit(scene, 'fx-bolt', { left: `${to.x - 36}px`, top: '0px', height: `${to.y}px`, '--core': c.core, '--glow': c.glow });
    done(el.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }, { opacity: 0 }], { duration: 520 }), el);
    flash(scene, 'rgba(255,255,240,0.55)', 260);
    await sleep(260);
  }
  // Shards fall from above onto the target.
  async function rockfall(scene, to, c) {
    for (let i = 0; i < 6; i++) {
      const size = Math.max(22, to.w * 0.16) + (i % 3) * 8;
      const el = bit(scene, 'fx-shard', { width: `${size}px`, height: `${size}px`, left: `${to.x - to.w * 0.45 + (i * to.w * 0.9) / 5 - size / 2}px`, top: `${to.y - to.h * 0.9}px`, '--core': c.core, '--glow': c.glow });
      done(el.animate([{ transform: 'translateY(-60px) rotate(0deg)', opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: `translateY(${to.h * 0.8}px) rotate(${90 + i * 40}deg)`, opacity: 1 }],
        { duration: 380, delay: i * 70, easing: 'cubic-bezier(.5,0,1,1)' }), el);
    }
    await sleep(520);
  }
  function flash(scene, color, ms) {
    const el = bit(scene, 'fx-flash', { background: color });
    done(el.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: ms }), el);
  }
  // What lands on the target: a burst ring and sparks in the move's colors.
  function impact(scene, to, c) {
    const size = Math.max(60, to.w * 0.7);
    const ring = bit(scene, 'fx-ring', { width: `${size}px`, height: `${size}px`, left: `${to.x - size / 2}px`, top: `${to.y - size / 2}px`, '--core': c.core, '--glow': c.glow });
    done(ring.animate([{ transform: 'scale(.2)', opacity: 1 }, { transform: 'scale(.95)', opacity: 1, offset: 0.55 }, { transform: 'scale(1.3)', opacity: 0 }], { duration: 460, easing: 'ease-out' }), ring);
    if (c.shape === 'impact') {
      // Strike: a white star burst right on the target.
      const st = bit(scene, 'fx-star', { width: `${size * 0.8}px`, height: `${size * 0.8}px`, left: `${to.x - size * 0.4}px`, top: `${to.y - size * 0.4}px`, '--core': '#fff', '--glow': '#ffd166' });
      done(st.animate([{ transform: 'scale(.3) rotate(0deg)', opacity: 1 }, { transform: 'scale(1.1) rotate(20deg)', opacity: 1, offset: 0.4 }, { transform: 'scale(1.2) rotate(30deg)', opacity: 0 }], { duration: 420 }), st);
    }
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
      const sp = bit(scene, 'fx-spark', { left: `${to.x - 4}px`, top: `${to.y - 4}px`, '--core': c.core, '--glow': c.glow });
      done(sp.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(ang) * size * 0.7}px, ${Math.sin(ang) * size * 0.7}px) scale(.3)`, opacity: 0 }],
        { duration: 420, easing: 'cubic-bezier(.1,.7,.3,1)' }), sp);
    }
    if (c.shape === 'impact' || c.shape === 'rocks') shake(scene, 6);
  }
  function shake(scene, px) {
    scene.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${-px}px, ${px / 2}px)` }, { transform: `translate(${px}px, ${-px / 2}px)` }, { transform: 'translate(0,0)' }],
      { duration: 220, iterations: 1 });
  }
  // Guard: a shield bubble around the user. Recover: sparkles rising off it.
  async function shield(scene, me) {
    const size = Math.max(80, me.w * 1.05);
    const el = bit(scene, 'fx-shield', { width: `${size}px`, height: `${size}px`, left: `${me.x - size / 2}px`, top: `${me.y - size / 2}px` });
    done(el.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: 0.35 }, { transform: 'scale(1.05)', opacity: 0 }], { duration: 900, easing: 'ease-out' }), el);
    await sleep(380);
  }
  async function sparkle(scene, me, color) {
    for (let i = 0; i < 9; i++) {
      const el = bit(scene, 'fx-plus', { left: `${me.x - me.w * 0.35 + (i * me.w * 0.7) / 8}px`, top: `${me.y + me.h * 0.2}px`, '--core': color });
      done(el.animate([{ transform: 'translateY(0) scale(.5)', opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: `translateY(${-me.h * 0.7}px) scale(1)`, opacity: 0 }],
        { duration: 700, delay: (i % 3) * 90, easing: 'ease-out' }), el);
    }
    await sleep(420);
  }

  // move: { id, type, damage?, guard?, restore? } from the battle view. Resolves when the shot lands.
  async function play(scene, userEl, targetEl, move, reduce) {
    if (!scene || !userEl || !targetEl || !move) return;
    const me = centerOf(scene, userEl), foe = centerOf(scene, targetEl);
    const c = TYPE[move.type] || PLAIN;
    if (move.guard) { if (!reduce) await shield(scene, me); return; }
    if (!move.damage) { if (!reduce) await sparkle(scene, me, '#9dffb0'); return; }
    if (reduce) { flash(scene, 'rgba(255,255,255,0.35)', 200); await sleep(150); return; }
    if (move.shield) shield(scene, me);
    if (c.shape === 'bolt') await bolt(scene, foe, c);
    else if (c.shape === 'rocks') await rockfall(scene, foe, c);
    else if (c.shape !== 'impact') await projectile(scene, me, foe, c, 440);
    impact(scene, foe, c);
    await sleep(120);
  }
  window.CheckaverseBattleFx = { play, types: Object.keys(TYPE) };
})();
