// Generates content/town.json and content/house.json. Run after changing the layout: node tools/gen-town.mjs
// Tiles: . grass, P path, F flowers, L empty lot, T tree, W water, H building or prop, S bus stop.
// T W H S are solid. Plots are listed separately so the server can drop houses onto them.
// Props are the Sprite Book art drawn over the map: s is the file in public/art, x the left edge,
// b the bottom edge and w the width, all in tiles. Each prop's footprint is set to H so it is solid.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');
const W = 46, H = 28;
const g = Array.from({ length: H }, () => Array(W).fill('.'));
const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c; };
const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); };

// Border of trees.
rect(0, 0, W - 1, 0, 'T'); rect(0, H - 1, W - 1, H - 1, 'T'); rect(0, 0, 0, H - 1, 'T'); rect(W - 1, 0, W - 1, H - 1, 'T');

// The plaza on the west side.
rect(2, 13, 44, 13, 'P');           // main street across the whole town
rect(12, 2, 12, 25, 'P');           // north south street through the plaza
rect(3, 3, 8, 6, 'H');              // future arena
rect(15, 3, 21, 6, 'H');            // future merchant row
rect(15, 7, 21, 7, 'P'); rect(18, 8, 18, 12, 'P');
rect(3, 15, 10, 21, 'P');
rect(4, 16, 9, 20, 'W'); set(4, 16, 'P'); set(9, 16, 'P'); set(4, 20, 'P'); set(9, 20, 'P');
set(13, 12, 'S');                   // bus stop, new arrivals step off here
for (const [x, y] of [[16, 17], [17, 17], [16, 18], [17, 18], [21, 20], [22, 20], [21, 21], [22, 21], [6, 9], [7, 9]]) set(x, y, 'T');
for (const [x, y] of [[5, 11], [9, 10], [14, 22], [7, 24], [19, 24], [23, 9], [2, 2], [22, 2]]) set(x, y, 'F');

const props = [];
const prop = (s, fx, fy, fw, fh, x, b, w) => { rect(fx, fy, fx + fw - 1, fy + fh - 1, 'H'); props.push({ s, x, b, w }); };
prop('arena', 3, 3, 6, 4, 2.5, 7, 7);
prop('market-stall', 15, 3, 4, 4, 15, 7, 3.4);
prop('market-stall', 19, 3, 3, 4, 18.6, 7, 3.4);
prop('prop-bus', 14, 10, 4, 2, 14, 12, 4);
prop('prop-bus-stop', 14, 12, 1, 1, 13, 13, 2);       // the sign stands on the S tile, the bench takes the tile beside it
prop('prop-notice-board', 8, 11, 2, 1, 7.8, 12, 2.4);
prop('merge-stone', 20, 16, 2, 2, 19.6, 18, 2.8);
for (const [x, y] of [[10, 12], [20, 12], [7, 14], [23, 14], [25, 6], [25, 18]]) prop('prop-lantern', x, y, 1, 1, x + 0.14, y + 1, 0.73);
for (const [x, y] of [[5, 22], [13, 15]]) prop('prop-bench', x, y, 2, 1, x, y + 1, 2);
for (const [x, y] of [[3, 9], [21, 9], [9, 25]]) prop('prop-rock', x, y, 1, 1, x, y + 1, 1);
for (const [x, y] of [[2, 24], [23, 2], [19, 22]]) prop('prop-bush', x, y, 1, 1, x, y + 1, 1);

// The Neighborhood on the east side: 12 plots, 5 by 4, in 4 rows of 3.
rect(26, 2, 26, 25, 'P');
const plots = [];
let id = 1;
for (const r of [3, 9, 15, 21]) {
  rect(26, r + 4, 44, r + 4, 'P');
  for (const c of [27, 33, 39]) {
    rect(c, r, c + 4, r + 3, 'L');
    plots.push({ id: id++, x: c, y: r, w: 5, h: 4, door: { x: c + 2, y: r + 2 } });
  }
}
for (const [x, y] of [[32, 4], [38, 10], [32, 16], [38, 22], [44, 5], [44, 17], [25, 8], [25, 20]]) set(x, y, 'F');
for (const [x, y] of [[24, 3], [24, 4], [24, 24], [24, 25]]) set(x, y, 'T');

const town = {
  id: 'checkaverse',
  rows: g.map((r) => r.join('')),
  arrive: [[14, 13], [15, 13], [16, 13], [14, 14], [15, 12], [16, 14], [13, 13], [17, 13]],
  plots,
  props,
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
