// Generates content/town.json and content/house.json. Run after changing the layout: node tools/gen-town.mjs
// Tiles: . grass, P path, F flowers, L empty lot, T tree, W water, H building or prop, S bus stop, E exit to another map.
// Wilds only: G tall grass, C starflower clearing, R rocky ground, A scorched heath. Each is an encounter zone in content/wild.json.
// T W H S are solid. Plots are listed separately so the server can drop houses onto them.
// Props are the Sprite Book art drawn over the map: s is the file in public/art, x the left edge,
// b the bottom edge and w the width, all in tiles. Each prop's footprint is set to H so it is solid.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');
const W = 64, H = 28;
const g = Array.from({ length: H }, () => Array(W).fill('.'));
const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c; };
const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); };

// Border of trees.
rect(0, 0, W - 1, 0, 'T'); rect(0, H - 1, W - 1, H - 1, 'T'); rect(0, 0, 0, H - 1, 'T'); rect(W - 1, 0, W - 1, H - 1, 'T');

// The plaza on the west side.
rect(2, 13, W - 2, 13, 'P');        // main street across the whole town
rect(12, 2, 12, 25, 'P');           // north south street through the plaza
rect(3, 3, 8, 6, 'H');              // future arena
rect(15, 3, 21, 6, 'H');            // future merchant row
rect(15, 7, 21, 7, 'P'); rect(18, 8, 18, 12, 'P');
rect(3, 15, 10, 21, 'P');
rect(4, 16, 9, 20, 'W'); set(4, 16, 'P'); set(9, 16, 'P'); set(4, 20, 'P'); set(9, 20, 'P');
set(13, 12, 'S');                   // bus stop, new arrivals step off here
set(12, 1, 'P'); set(12, 0, 'E');   // the gate north to the wilds, at the top of the plaza street
for (const [x, y] of [[16, 17], [17, 17], [16, 18], [17, 18], [21, 20], [22, 20], [21, 21], [22, 21], [6, 9], [7, 9]]) set(x, y, 'T');
for (const [x, y] of [[5, 11], [9, 10], [14, 22], [7, 24], [19, 24], [23, 9], [2, 2], [22, 2]]) set(x, y, 'F');

const props = [];
// f is the solid footprint [x, y, w, h]. sign names the line in content/signs.json shown when a trainer looks at it.
const prop = (s, fx, fy, fw, fh, x, b, w, sign) => {
  rect(fx, fy, fx + fw - 1, fy + fh - 1, 'H');
  props.push({ s, x, b, w, f: [fx, fy, fw, fh], ...(sign ? { sign } : {}) });
};
prop('arena', 3, 3, 6, 4, 2.5, 7, 7, 'arena');
prop('prop-route-sign', 13, 1, 1, 1, 12.9, 2, 1.6, 'route-sign-town');
prop('market-stall', 15, 3, 4, 4, 15, 7, 3.4, 'market-stall');
prop('market-stall', 19, 3, 3, 4, 18.6, 7, 3.4, 'market-stall');
prop('prop-bus', 14, 10, 4, 2, 14, 12, 4, 'bus');
prop('prop-bus-stop', 14, 12, 1, 1, 13, 13, 2, 'bus-stop');       // the sign stands on the S tile, the bench takes the tile beside it
prop('prop-notice-board', 8, 11, 2, 1, 7.8, 12, 2.4, 'notice-board');
prop('merge-stone', 20, 16, 2, 2, 19.6, 18, 2.8, 'merge-stone');
for (const [x, y] of [[10, 12], [20, 12], [7, 14], [23, 14], [25, 6], [25, 18]]) prop('prop-lantern', x, y, 1, 1, x + 0.14, y + 1, 0.73, 'lantern');
for (const [x, y] of [[5, 22], [13, 15]]) prop('prop-bench', x, y, 2, 1, x, y + 1, 2, 'bench');
for (const [x, y] of [[3, 9], [21, 9], [9, 25]]) prop('prop-rock', x, y, 1, 1, x, y + 1, 1, 'rock');
for (const [x, y] of [[2, 24], [23, 2], [19, 22]]) prop('prop-bush', x, y, 1, 1, x, y + 1, 1, 'bush');

// The Neighborhood on the east side: 24 plots, 5 by 4, in 4 rows of 6, enough for a full class hour.
// Plots 1 to 12 are the three columns nearest the plaza and fill first; 13 to 24 are the far three.
rect(26, 2, 26, 25, 'P');
const plots = [];
let id = 1;
for (const r of [3, 9, 15, 21]) rect(26, r + 4, W - 2, r + 4, 'P');
for (const cols of [[27, 33, 39], [45, 51, 57]]) {
  for (const r of [3, 9, 15, 21]) {
    for (const c of cols) {
      rect(c, r, c + 4, r + 3, 'L');
      plots.push({ id: id++, x: c, y: r, w: 5, h: 4, door: { x: c + 2, y: r + 2 } });
    }
  }
}
for (const [x, y] of [[32, 4], [38, 10], [32, 16], [38, 22], [44, 5], [44, 17], [25, 8], [25, 20],
  [50, 4], [56, 10], [50, 16], [56, 22], [62, 5], [62, 17]]) set(x, y, 'F');
for (const [x, y] of [[24, 3], [24, 4], [24, 24], [24, 25]]) set(x, y, 'T');

const town = {
  id: 'checkaverse',
  rows: g.map((r) => r.join('')),
  arrive: [[14, 13], [15, 13], [16, 13], [14, 14], [15, 12], [16, 14], [13, 13], [17, 13]],
  plots,
  props,
  // Stepping onto an exit tile walks into another map. at is where the trainer appears there.
  exits: [{ x: 12, y: 0, to: 'wilds', at: [28, 41], f: 'u' }],
};

// House interior: X wall, B bed, K furniture and plants, R rug, N pet bed, D the way out. X B K N are solid.
// The layout follows the house-interior art, which the client draws half a tile left so its doorway sits on D.
const house = {
  id: 'house',
  art: { s: 'house-interior', x: -0.5, y: 0, w: 10, h: 8 },
  rows: [
    'XXXXXXXXXX',
    'XXXXXXXXXX',
    'KBBK..KNNX',
    '.BB.RRRNNX',
    'KBB.RRR.KX',
    '....RRR..X',
    '.......KKX',
    'XXXXDXXXXX',
  ],
  enter: [4, 6],
  exit: { x: 4, y: 7 },
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'town.json'), JSON.stringify(town, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'house.json'), JSON.stringify(house, null, 2) + '\n');
console.log('town', W, 'x', H, 'plots', plots.length);

// ---------- the wilds, north of the town gate ----------
// Four terrain zones, each with its own wild Checklings (content/wild.json). A creek splits the map with one bridge.
const WW = 56, WH = 44;
const w = Array.from({ length: WH }, () => Array(WW).fill('.'));
const wset = (x, y, c) => { if (x >= 0 && y >= 0 && x < WW && y < WH) w[y][x] = c; };
const wrect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) wset(x, y, c); };
// A blob: a rough oval so zones never look like rectangles.
const blob = (cx, cy, rx, ry, c, seed) => {
  for (let y = cy - ry - 1; y <= cy + ry + 1; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
    const wobble = 0.82 + 0.3 * (n - Math.floor(n));
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= wobble) wset(x, y, c);
  }
};
wrect(0, 0, WW - 1, 1, 'T'); wrect(0, WH - 2, WW - 1, WH - 1, 'T'); wrect(0, 0, 1, WH - 1, 'T'); wrect(WW - 2, 0, WW - 1, WH - 1, 'T');
// Zones first, paths over them.
blob(11, 34, 8, 5, 'G', 1); blob(37, 37, 6, 3, 'G', 2); blob(20, 27, 5, 3, 'G', 3); blob(9, 24, 4, 3, 'G', 4);
blob(11, 8, 8, 5, 'C', 5);
blob(44, 8, 8, 5, 'R', 6);
blob(46, 27, 6, 6, 'A', 7);
// The creek, with its bank, west to east, and the bridge where the main path crosses.
for (let x = 2; x < WW - 2; x++) { const y = 17 + Math.round(Math.sin(x / 5) * 1.2); wset(x, y, 'W'); wset(x, y + 1, 'W'); }
// Paths: the main trail north from the gate, branches west and east above the creek, and a loop south.
wrect(28, 22, 28, WH - 2, 'P');
wrect(28, 4, 28, 21, 'P');
wrect(10, 12, 46, 12, 'P');
wrect(18, 30, 38, 30, 'P'); wrect(38, 30, 38, 27, 'P'); wrect(38, 27, 41, 27, 'P');
wset(28, WH - 1, 'E');
wset(28, WH - 2, 'P');
// Tree clumps between zones so each area feels like its own place.
for (const [x, y] of [[21, 6], [22, 7], [21, 8], [33, 5], [34, 6], [33, 7], [24, 22], [25, 23], [32, 23], [33, 22], [4, 15], [5, 14], [50, 15],
  [51, 14], [21, 35], [22, 36], [21, 37], [33, 33], [44, 36], [45, 37], [3, 29], [52, 33], [52, 34], [16, 40], [40, 41], [5, 4], [50, 3],
  [36, 15], [19, 15], [42, 20], [14, 20], [31, 39], [24, 39]]) wset(x, y, 'T');
const wprops = [];
const wprop = (s, fx, fy, fw, fh, x, b, wd, sign) => {
  wrect(fx, fy, fx + fw - 1, fy + fh - 1, 'H');
  wprops.push({ s, x, b, w: wd, f: [fx, fy, fw, fh], ...(sign ? { sign } : {}) });
};
// Drawn only, never solid: the bridge lies flat over the water.
wprops.push({ s: 'prop-bridge', x: 26.5, b: 19.3, w: 3, flat: true });
wprop('prop-route-sign', 29, 40, 1, 1, 28.9, 41, 1.6, 'route-sign');
for (const [x, y] of [[40, 6], [47, 5], [50, 9], [43, 11], [38, 9], [48, 12]]) wprop('prop-rock', x, y, 1, 1, x, y + 1, 1, 'rock-wild');
for (const [x, y] of [[23, 30], [33, 30]]) wprop('prop-fence', x, y - 1, 2, 1, x, y, 2);
for (const [x, y] of [[44, 23], [49, 31]]) wprop('prop-lantern', x, y, 1, 1, x + 0.14, y + 1, 0.73, 'lantern-heath');
for (const [x, y] of [[6, 30], [16, 9], [30, 26]]) wprop('prop-bush', x, y, 1, 1, x, y + 1, 1, 'bush');
wprop('prop-bench', 30, 36, 2, 1, 30, 37, 2, 'bench');
const wilds = {
  id: 'wilds',
  name: 'The wilds',
  rows: w.map((r) => r.join('')),
  props: wprops,
  exits: [{ x: 28, y: WH - 1, to: 'town', at: [12, 1], f: 'd' }],
};
fs.writeFileSync(path.join(OUT, 'wilds.json'), JSON.stringify(wilds, null, 2) + '\n');
console.log('wilds', WW, 'x', WH);
