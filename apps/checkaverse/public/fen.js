// Bramblefen Basin: the first giant region, a 256 by 256 wetland of rivers, reeds and flooded forest.
// The whole map is built from content/fen.json and its seed. The server and every browser run this same file,
// so the basin is identical for everyone and never has to be sent over the wire. Only integer hashing and plain
// arithmetic are used, so every engine gets the same answer. The server sends the map's hash and the client
// checks it after building.
//
// Tiles: '.' grass, 'm' moss, 'M' marsh mud, 'w' shallow water (walkable), 'W' deep water, 'T' trees,
// 'G' reed beds, 'Q' glowcap hollow, 'P' dirt lane, 'B' boardwalk, 'K' bramble bush, 'O' mossy rock,
// 'U' old stump, 'H' under a landmark, 'E' the way out.

export const FEN_SOLID = new Set(['T', 'W', 'H', 'S', 'K', 'O', 'U']);
const WALK = (c) => !FEN_SOLID.has(c) && c !== 'E';

function h32(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1440662683);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return h >>> 0;
}
const u01 = (x, y, s) => h32(x, y, s) / 4294967296;
function vnoise(x, y, cell, s) {
  const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
  const u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty);
  const a = u01(ix, iy, s), b = u01(ix + 1, iy, s), c = u01(ix, iy + 1, s), d = u01(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s, c) => vnoise(x, y, c, s) * 0.55 + vnoise(x, y, c / 2, s + 1) * 0.3 + vnoise(x, y, c / 4, s + 2) * 0.15;
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function fenHash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function compass(dx, dy) {
  // Eight way direction without trig: compare the slopes.
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (ay * 5 < ax * 2) return dx >= 0 ? 'east' : 'west';
  if (ax * 5 < ay * 2) return dy >= 0 ? 'south' : 'north';
  return `${dy < 0 ? 'north' : 'south'}${dx < 0 ? 'west' : 'east'}`;
}

export function generateFen(cfg) {
  const S = cfg.size, seed = cfg.seed | 0, L = cfg.landmarks;
  const R = rng(seed);
  const g = new Uint8Array(S * S).fill(46); // '.'
  const C = (ch) => ch.charCodeAt(0);
  const at = (x, y) => (x < 0 || y < 0 || x >= S || y >= S ? 'T' : String.fromCharCode(g[y * S + x]));
  const set = (x, y, ch) => { if (x >= 0 && y >= 0 && x < S && y < S) g[y * S + x] = C(ch); };
  const disc = (cx, cy, r, fn) => {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r2 && x >= 0 && y >= 0 && x < S && y < S) fn(x, y, dx * dx + dy * dy);
    }
  };

  // 1. Wet ground, ponds and the forest come from three noise fields.
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const wet = fbm(x, y, seed + 11, 40), wood = fbm(x, y, seed + 23, 22), moss = fbm(x, y, seed + 37, 14);
    let ch = '.';
    if (wet > 0.69) ch = 'W';
    else if (wet > 0.635) ch = 'w';
    else if (wet > 0.58) ch = 'M';
    else if (wood > 0.6) ch = 'T';
    else if (wood > 0.52 || moss > 0.66) ch = 'm';
    g[y * S + x] = C(ch);
  }

  // 2. The river runs from the north edge to the Big Pool, past the Old Mill and out the east side.
  const pts = [[84 + Math.floor(R() * 24), -2], [96 + Math.floor(R() * 16), 40], [116 + Math.floor(R() * 10), 84], [L.arch.x, L.arch.y],
    [158, 136 + Math.floor(R() * 8)], [L.mill.x - 2, L.mill.y + 7], [228, 166 + Math.floor(R() * 10)], [S + 2, 172 + Math.floor(R() * 14)]];
  const water = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, len = Math.sqrt(dx * dx + dy * dy), n = Math.ceil(len * 2);
    for (let k = 0; k <= n; k++) {
      const t = k / n, wob = (vnoise(i * 97 + k / 6, 3, 1, seed + 5) - 0.5) * 9;
      water.push([ax + dx * t - (dy / len) * wob, ay + dy * t + (dx / len) * wob, i >= 4 ? 2.1 : 1.6]);
    }
  }
  for (const [x, y, r] of water) disc(x, y, r + 2.4, (px, py) => { if (at(px, py) !== 'W') set(px, py, 'w'); });
  for (const [x, y, r] of water) disc(x, y, r, (px, py) => set(px, py, 'W'));

  // 3. The Big Pool around the Sunken Arch, with an island for the arch itself.
  {
    const { x: cx, y: cy } = L.arch;
    for (let y = cy - 18; y <= cy + 18; y++) for (let x = cx - 24; x <= cx + 24; x++) {
      const dx = (x - cx) / 21, dy = (y - cy) / 14, d = dx * dx + dy * dy, edge = 1 + (vnoise(x, y, 6, seed + 41) - 0.5) * 0.35;
      if (d < edge * 0.78) set(x, y, 'W'); else if (d < edge) { if (at(x, y) !== 'W') set(x, y, 'w'); }
    }
  }

  // 4. The reed sea around the Heron Stone, with a small dry island in the middle.
  {
    const { x: cx, y: cy } = L.heron;
    disc(cx, cy, 17, (x, y, d2) => {
      const n = vnoise(x, y, 4, seed + 53);
      if (d2 > 17 * 17 * (0.75 + n * 0.25)) return;
      set(x, y, n > 0.78 ? 'w' : 'G');
    });
    disc(cx, cy, 2.6, (x, y) => set(x, y, '.'));
  }

  // 5. Reeds grow along every bank, and in patches on the wet ground.
  {
    const near = new Uint8Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const c = at(x, y);
      if (c !== 'W' && c !== 'w') continue;
      for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) if (xx >= 0 && yy >= 0 && xx < S && yy < S) near[yy * S + xx] = 1;
    }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const c = at(x, y), n = fbm(x, y, seed + 61, 16);
      if ((c === '.' || c === 'M' || c === 'm') && ((near[y * S + x] && n > 0.47) || n > 0.68)) set(x, y, 'G');
    }
  }

  // 6. The hidden clearing: a ring of old trees around a glowing hollow.
  {
    const { x: cx, y: cy } = L.hollow;
    disc(cx, cy, 13, (x, y, d2) => { if (d2 >= 8 * 8) set(x, y, 'T'); });
    disc(cx, cy, 8, (x, y) => set(x, y, vnoise(x, y, 3, seed + 71) > 0.52 ? 'Q' : 'm'));
  }

  // 7. Dry ground under the landmarks: the arch's island in the Big Pool, the mill yard, the ring's rise and the
  // gate clearing at the south edge.
  disc(L.arch.x, L.arch.y, 4.6, (x, y, d2) => set(x, y, d2 <= 9 ? '.' : 'm'));
  disc(L.ring.x, L.ring.y, 7, (x, y, d2) => set(x, y, d2 < 20 ? '.' : 'm'));
  disc(L.mill.x, L.mill.y, 4, (x, y) => { if (at(x, y) !== 'W') set(x, y, '.'); });
  for (let y = S - 16; y < S; y++) for (let x = L.gate.x - 9; x <= L.gate.x + 9; x++) if (!(at(x, y) === 'T' && Math.abs(x - L.gate.x) > 6)) set(x, y, '.');
  disc(L.ranger.x, L.ranger.y, 5, (x, y) => set(x, y, '.'));

  // 8. A wall of forest around the whole basin.
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const edge = Math.min(x, y, S - 1 - x, S - 1 - y);
    const corridor = y > L.gate.y && Math.abs(x - L.gate.x) <= 2;
    if (!corridor && (edge < 3 || (edge < 6 && vnoise(x, y, 5, seed + 83) > 0.55))) set(x, y, 'T');
  }

  // 9. Landmarks stand on solid footprints ('H'), each with a prop for the art.
  const props = [], marks = [];
  const stamp = (id, s, x, b, w, f, extra = {}) => {
    for (let yy = f[1]; yy < f[1] + f[3]; yy++) for (let xx = f[0]; xx < f[0] + f[2]; xx++) set(xx, yy, 'H');
    props.push({ s, x, b, w, f, sign: `fen-${id}`, ...extra });
  };
  const gx = L.gate.x, gy = L.gate.y;
  stamp('gate', 'kc-cemetery-gate', gx - 1.5, gy + 1.15, 4, [gx - 1, gy, 1, 1], { fen: 'gate' });
  set(gx + 1, gy, 'H');
  stamp('ranger', 'house-cottage', L.ranger.x - 2, L.ranger.y + 1, 4, [L.ranger.x - 2, L.ranger.y - 1, 4, 2], { fen: 'ranger' });
  stamp('arch', 'merge-stone', L.arch.x - 1.3, L.arch.y + 1, 2.6, [L.arch.x - 1, L.arch.y, 2, 1], { fen: 'arch' });
  stamp('mill', 'house-creek', L.mill.x - 2.5, L.mill.y + 1, 5, [L.mill.x - 2, L.mill.y - 1, 5, 2], { fen: 'mill' });
  stamp('hollow', 'house-stump', L.hollow.x - 2.5, L.hollow.y + 1, 5, [L.hollow.x - 2, L.hollow.y - 1, 5, 2], { fen: 'hollow' });
  stamp('heron', 'prop-rock', L.heron.x - 1.1, L.heron.y + 1.05, 2.2, [L.heron.x - 1, L.heron.y, 2, 1], { fen: 'heron' });
  // The Lantern Ring: twelve lanterns round the rise. No trig: the ring is walked as a square rounded by a disc test.
  {
    const { x: cx, y: cy } = L.ring, ring = [[0, -5], [3, -4], [4, -3], [5, 0], [4, 3], [3, 4], [0, 5], [-3, 4], [-4, 3], [-5, 0], [-4, -3], [-3, -4]];
    for (const [dx, dy] of ring) { set(cx + dx, cy + dy, 'H'); props.push({ s: 'prop-lantern', x: cx + dx + 0.13, b: cy + dy + 1, w: 0.74, f: [cx + dx, cy + dy, 1, 1], sign: 'fen-ring' }); }
    marks.push({ id: 'ring', x: cx, y: cy });
  }
  for (const id of ['gate', 'ranger', 'arch', 'mill', 'hollow', 'heron']) marks.push({ id, x: L[id].x, y: L[id].y });

  // 10. Routes: boardwalks over water and lanes over land, joining every landmark to the gate.
  // Smooth noise in the cost bends the trails the way feet would, instead of ruler straight lines.
  const base = (c) => {
    switch (c) {
      case 'P': case 'B': return 1;
      case '.': case 'm': case 'M': case 'Q': return 2;
      case 'G': return 3;
      case 'w': return 4;
      case 'W': return 7;
      case 'T': return 9;
      default: return 0; // H, K, O, U, E: never
    }
  };
  const cost = (x, y) => {
    if (x < 2 || y < 2 || x > S - 3 || y > S - 2) return 0;
    const c = at(x, y), b = base(c);
    return b && (c === 'P' || c === 'B' ? b : b * (0.45 + 1.6 * vnoise(x, y, 9, seed + 101)));
  };
  const routeTiles = new Uint8Array(S * S);
  function route(a, b, hidden) {
    // A* on the grid with a binary heap. Ties break by insertion order, so every engine finds the same path.
    const N = S * S, gs = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = []; let order = 0;
    const push = (f, i) => { heap.push([f, order++, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] < heap[k][0] || (heap[p][0] === heap[k][0] && heap[p][1] < heap[k][1])) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; for (const c of [l, r]) if (c < heap.length && (heap[c][0] < heap[m][0] || (heap[c][0] === heap[m][0] && heap[c][1] < heap[m][1]))) m = c; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const s = a[1] * S + a[0], t = b[1] * S + b[0];
    gs[s] = 0; push(0, s);
    while (heap.length) {
      const [, , i] = pop();
      if (closed[i]) continue;
      closed[i] = 1;
      if (i === t) break;
      const x = i % S, y = (i - x) / S;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= S || ny >= S) continue;
        const j = ny * S + nx, c = j === t ? 1 : cost(nx, ny);
        if (!c || closed[j]) continue;
        const ng = gs[i] + c;
        if (ng < gs[j]) { gs[j] = ng; from[j] = i; push(ng + (Math.abs(nx - b[0]) + Math.abs(ny - b[1])) * 0.8, j); }
      }
    }
    if (from[t] < 0) throw new Error(`fen: no route to ${b}`);
    const path = [];
    for (let i = from[t]; i !== s && i >= 0; i = from[i]) path.push(i);
    path.push(s);
    path.reverse();
    for (const i of path) {
      const x = i % S, y = (i - x) / S, c = at(x, y);
      if (c === 'H') continue;
      // Trees right beside a trail would hide anyone walking it, so the trail cuts a three tile corridor.
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (at(x + dx, y + dy) === 'T' && x + dx > 2 && x + dx < S - 3 && y + dy > 2 && y + dy < S - 3) set(x + dx, y + dy, 'm');
      routeTiles[i] = 1;
      const quiet = hidden && Math.abs(x - hidden.x) + Math.abs(y - hidden.y) < 18;
      if (c === 'W' || c === 'w') set(x, y, 'B');
      else if (c !== 'P' && c !== 'B') set(x, y, quiet ? 'm' : 'P');
    }
    return path;
  }
  const front = (id, dy = 1) => [L[id].x, L[id].y + dy];
  const below = (f) => [f[0] + 1, f[1] + f[3]];
  // The gate road: straight north from the way out.
  for (let y = gy + 1; y < S - 1; y++) set(gx, y, 'P');
  set(gx, S - 1, 'E');
  for (let y = gy + 1; y < S; y++) routeTiles[y * S + gx] = 1;
  const start = [gx, gy - 1];
  set(gx, gy, 'P'); routeTiles[gy * S + gx] = 1;
  const routes = [];
  routes.push(route([gx, gy], start));
  routes.push(route(start, front('arch')));
  routes.push(route(start, below([L.ranger.x - 2, L.ranger.y - 1, 4, 2])));
  routes.push(route(front('arch'), [L.ring.x, L.ring.y + 6]));
  routes.push(route(front('arch'), below([L.mill.x - 2, L.mill.y - 1, 5, 2])));
  routes.push(route(below([L.mill.x - 2, L.mill.y - 1, 5, 2]), [L.ring.x, L.ring.y + 6]));
  routes.push(route(start, front('heron')));
  routes.push(route(front('heron'), below([L.hollow.x - 2, L.hollow.y - 1, 5, 2]), L.hollow));

  // 11. Lanterns along the trails, standing on dry ground beside them. The hidden trail gets none.
  {
    let since = 0;
    for (const path of routes) for (const i of path) {
      const x = i % S, y = (i - x) / S;
      if (at(x, y) !== 'B' && at(x, y) !== 'P') { since = 0; continue; }
      if (++since < 16) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const lx = x + dx, ly = y + dy, c = at(lx, ly);
        if (!'.mMG'.includes(c) || routeTiles[ly * S + lx]) continue;
        set(lx, ly, 'H');
        props.push({ s: 'prop-lantern', x: lx + 0.13, b: ly + 1, w: 0.74, f: [lx, ly, 1, 1], sign: 'fen-lantern' });
        since = 0;
        break;
      }
    }
  }

  // 12. Brambles, mossy rocks and old stumps on open ground, never on or beside a route.
  for (let y = 4; y < S - 4; y++) for (let x = 4; x < S - 4; x++) {
    const c = at(x, y);
    if (!'.mM'.includes(c)) continue;
    let byRoute = false;
    for (let yy = y - 1; yy <= y + 1 && !byRoute; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (routeTiles[yy * S + xx] || at(xx, yy) === 'H') { byRoute = true; break; }
    if (byRoute) continue;
    const r = u01(x, y, seed + 97);
    if (r < 0.012) set(x, y, 'K');
    else if (r < 0.02) set(x, y, c === 'M' ? 'U' : 'O');
    else if (r < 0.026 && c === 'm') set(x, y, 'U');
  }

  // 13. Everything a trainer cannot reach from the gate grows over. Lost shallows deepen, lost ground turns to forest.
  {
    const seen = new Uint8Array(S * S), q = [start[1] * S + start[0]];
    seen[q[0]] = 1;
    for (let k = 0; k < q.length; k++) {
      const i = q[k], x = i % S, y = (i - x) / S;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = x + dx, ny = y + dy, j = ny * S + nx;
        if (nx < 0 || ny < 0 || nx >= S || ny >= S || seen[j] || !WALK(at(nx, ny))) continue;
        seen[j] = 1; q.push(j);
      }
    }
    for (let i = 0; i < S * S; i++) {
      const c = String.fromCharCode(g[i]);
      if (seen[i] || !WALK(c)) continue;
      g[i] = C(c === 'w' ? 'W' : 'T');
    }
  }

  // 14. Signposts where the routes leave the gate and the Big Pool, pointing the way to every landmark.
  const NAMES = Object.fromEntries(Object.entries(L).map(([k, v]) => [k, v.name]));
  const signs = { ...(cfg.signs || {}) };
  const post = (key, x, y, list) => {
    for (const [dx, dy] of [[1, 0], [-1, 0], [2, 0], [-2, 0]]) {
      const px = x + dx, py = y + dy;
      if (!'.mMG'.includes(at(px, py)) || routeTiles[py * S + px]) continue;
      set(px, py, 'H');
      props.push({ s: 'prop-route-sign', x: px - 0.3, b: py + 1, w: 1.6, f: [px, py, 1, 1], sign: key });
      const lines = list.map((id) => {
        const dx2 = L[id].x - px, dy2 = L[id].y - py, steps = Math.round((Math.abs(dx2) + Math.abs(dy2)) / 10) * 10;
        return `${NAMES[id][0].toUpperCase()}${NAMES[id].slice(1)}, ${compass(dx2, dy2)}, about ${steps} steps.`;
      });
      signs[key] = lines.join(' ');
      return;
    }
  };
  post('fen-post-gate', start[0], start[1] - 2, ['arch', 'heron', 'ranger', 'mill']);
  post('fen-post-pool', L.arch.x, L.arch.y + 3, ['ring', 'mill', 'heron', 'gate']);
  signs['fen-post-gate'] = `${signs['fen-post-gate'] || ''} The wilds are back through the gate.`.trim();

  const rows = [];
  for (let y = 0; y < S; y++) { let r = ''; for (let x = 0; x < S; x++) r += String.fromCharCode(g[y * S + x]); rows.push(r); }
  const exits = [{ x: gx, y: S - 1, to: cfg.exit.to, at: cfg.exit.at, f: cfg.exit.f }];
  const map = { id: 'fen', name: cfg.name, version: cfg.version, rows, props, exits, arrive: [gx, S - 3], marks, signs };
  map.hash = fenHash(rows.join('\n') + JSON.stringify(props));
  return map;
}

if (typeof window !== 'undefined') window.CheckaverseFen = { generateFen, fenHash, FEN_SOLID };
