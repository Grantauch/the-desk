// Generates content/town.json and content/house.json. Run after changing the layout: node tools/gen-town.mjs
// Tiles: . grass, P path, F flowers, L empty lot, T tree, W water, H building, S bus stop.
// T W H S are solid. Plots are listed separately so the server can drop houses onto them.
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
for (const [x, y] of [[5, 11], [9, 10], [15, 10], [20, 16], [14, 22], [7, 24], [19, 24], [23, 9], [2, 2], [22, 2]]) set(x, y, 'F');

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
};

// House interior: X wall, B bed, K shelf, R rug, N pet bed, D the way out. X B K N are solid.
const house = {
  id: 'house',
  rows: [
    'XXXXXXXXXX',
    'XKK....BBX',
    'X.......BX',
    'X..RRR...X',
    'X..RRR..NX',
    'X........X',
    'X........X',
    'XXXXDXXXXX',
  ],
  enter: [4, 6],
  exit: { x: 4, y: 7 },
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'town.json'), JSON.stringify(town, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'house.json'), JSON.stringify(house, null, 2) + '\n');
console.log('town', W, 'x', H, 'plots', plots.length);
