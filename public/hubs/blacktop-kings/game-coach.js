/* Blacktop Kings — the coach. Short tips that show up the first time they matter during a game, in
   the controls the player is actually using (keyboard, gamepad, or touch buttons). Each tip shows
   once, remembered in this browser. One-player games only; Settings can turn it off or start over.
   The tips are drawn by drawCoach in game-render.js. */
(function (BK) {
  'use strict';
  const M = BK.Match.prototype;
  const C = BK.art.COURT;
  const STORE = 'bk-coach';
  const hyp = Math.hypot;
  const RIM = { x: C.rimX, y: C.rimY };
  const distRim = (o) => hyp(o.x - RIM.x, o.y - RIM.y);

  function loadSeen() { try { const a = JSON.parse(localStorage.getItem(STORE) || '[]'); return new Set(Array.isArray(a) ? a : []); } catch (e) { return new Set(); } }
  function saveSeen(seen) { try { localStorage.setItem(STORE, JSON.stringify([...seen])); } catch (e) { /* tips just show again next time */ } }
  BK.coach = { reset() { try { localStorage.removeItem(STORE); } catch (e) { /* nothing saved to clear */ } } };

  // A tip is a list of words and {button} tokens. State tips are checked a few times a second;
  // event tips answer something that just happened.
  const TIPS = [
    { id: 'takeback', parts: ['Your ball. Take it back behind the arc before you shoot.'], when: (m, p) => !m.cleared && m.ball.holder && m.ball.holder.team === p.team },
    { id: 'clock', parts: ['Shot clock is running out. Get a shot up.'], when: (m, p) => m.ball.holder === p && m.shotClock < 4.5 },
    { id: 'cross', parts: ['Your defender is leaning.', '{trick}', 'plus the other direction crosses them up.'], when: (m, p) => m.ball.holder === p && p.state === 'move' && leaning(p) },
    { id: 'rim', parts: ['Near the rim,', '{shoot}', 'finishes. Hold', '{turbo}', 'to take off from farther out.'], when: (m, p) => m.ball.holder === p && m.cleared && distRim(p) < Math.max(7, m.dunkRange(p, true)) },
    { id: 'shoot', parts: ['Hold', '{shoot}', 'to rise. Let go at the top of the jump, in the green.'], when: (m, p) => m.ball.holder === p && m.cleared && p.state === 'move' },
    { id: 'pass', parts: ['{pass}', 'passes to the open teammate. Push the stick at one to pick them.'], when: (m, p) => m.ball.holder === p && p.ai.holdT > 4 },
    { id: 'defense', parts: ['Stay between your player and the rim.', '{shoot}', 'jumps to block,', '{trick}', 'reaches for the ball.'], when: (m, p) => m.offense !== p.team && m.ball.state === 'held' },
    { id: 'switch', parts: ['{pass}', 'switches you to the defender closest to the ball.'], when: (m, p, c) => m.offense !== p.team && c.defT > 7 },
  ];
  const EVENT_TIPS = {
    early: ['Early comes up short. Hold', '{shoot}', 'a beat longer and let go in the green.'],
    late: ['Late goes long. Let go of', '{shoot}', 'a beat sooner.'],
    contest: ['A hand in your face shrinks the green. Get free with', '{trick}', 'or move it with', '{pass}', 'first.'],
    blocked: ['Blocked. Shoot with space, or go up before the shot blocker can get there.'],
    whiff: ['Reach when the ball is on your side, not through their body. Wait for the crossover.'],
    goaltend: ['Goaltending: block it on the way up. On the way down, their basket counts.'],
  };

  // Is the man guarding p sliding hard across the line to the rim?
  function leaning(p) {
    const rx = RIM.x - p.x, ry = RIM.y - p.y, rd = hyp(rx, ry) || 1;
    return p.opps.some((o) => o.state === 'move' && hyp(o.x - p.x, o.y - p.y) < 5 && Math.abs(o.vx * -ry / rd + o.vy * rx / rd) > 9);
  }

  M.coachState = function () {
    if (this.coach !== undefined) return this.coach;
    const on = !this.attract && this.opts.coach !== false && this.humans.length === 1;
    this.coach = on ? { seen: loadSeen(), cur: null, queue: [], gap: 1.5, tick: 0, defT: 0 } : null;
    return this.coach;
  };
  // The button a tip should show, in the player's current controls.
  M.coachKey = function (h, action) {
    const touch = BK.input && BK.input.touchVisible && BK.input.touchVisible() && h.ctrl.lastSource !== 'pad';
    if (touch) return action.toUpperCase();
    const src = h.ctrl.lastSource === 'pad' ? BK.KEYS.pad : BK.KEYS[h.keyLayout || 'solo'];
    return String(src[action] || action).split(/ or | \/ /)[0].replace(/\s*\([^)]*\)/g, '').toUpperCase();
  };
  M.coachShow = function (id, parts) {
    const c = this.coach, h = this.humans[0];
    c.seen.add(id); saveSeen(c.seen);
    c.cur = { id, life: 4.6, t: 0, parts: parts.map((w) => (/^\{\w+\}$/.test(w) ? { key: this.coachKey(h, w.slice(1, -1)) } : w)) };
  };
  M.coachUpdate = function (dt) {
    const c = this.coachState(); if (!c) return;
    const h = this.humans[0], p = h.player;
    if (c.cur) { c.cur.t += dt; if (c.cur.t >= c.cur.life) { c.cur = null; c.gap = 2.2; } return; }
    if (c.gap > 0) { c.gap -= dt; return; }
    if (this.phase !== 'live' || !p) return;
    c.defT = this.offense !== p.team ? c.defT + dt : 0;
    c.queue = c.queue.filter((q) => this.time - q.at < 3);
    const next = c.queue.shift();
    if (next) { this.coachShow(next.id, EVENT_TIPS[next.id]); return; }
    if ((c.tick -= dt) > 0) return;
    c.tick = 0.25;
    const tip = TIPS.find((t) => !c.seen.has(t.id) && t.when(this, p, c));
    if (tip) this.coachShow(tip.id, tip.parts);
  };
  M.coachEvent = function (type, d) {
    const c = this.coachState(); if (!c) return;
    let id = null;
    if (type === 'release' && d.p.human) {
      // the biggest lesson first: way off on timing, then the contest, then a near miss on timing
      if (d.quality === 'early' || d.quality === 'late') id = d.quality;
      else if (d.c > 0.55) id = 'contest';
      else if (d.quality === 'slightEarly') id = 'early';
      else if (d.quality === 'slightLate') id = 'late';
    } else if (type === 'block' && d.shooter.human) id = 'blocked';
    else if (type === 'whiff' && d.p.human) id = 'whiff';
    else if (type === 'goaltend' && d.o.human) id = 'goaltend';
    if (id && !c.seen.has(id) && !c.queue.some((q) => q.id === id)) c.queue.push({ id, at: this.time });
  };
})(window.BK = window.BK || {});
