// Generates content/town.json, house.json, wilds.json and kettle.json. Run: node tools/gen-town.mjs
// Tiles: . grass, P path, F flowers, L empty lot, T tree, W water, H building or prop, S bus stop, E exit to another map.
// Wilds only: G tall grass, C starflower clearing, R rocky ground, A scorched heath. Each is an encounter zone in content/wild.json.
// T W H S are solid. Plots are listed separately so the server can drop houses onto them.
// Props are the Sprite Book art drawn over the map: s is the file in public/art, x the left edge,
// b the bottom edge and w the width, all in tiles. Each prop's footprint is set to H so it is solid.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');
// Leave identical maps untouched, including their checkout's line endings.
const writeMap = (name, map) => {
  const file = path.join(OUT, name);
  const text = JSON.stringify(map, null, 2) + '\n';
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') === text) return;
  fs.writeFileSync(file, text);
};
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
writeMap('town.json', town);
writeMap('house.json', house);
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
writeMap('wilds.json', wilds);
console.log('wilds', WW, 'x', WH);

// ---------- Kettle Creek, the student's home town ----------
const KW = 40, KH = 26;
const k = Array.from({ length: KH }, () => Array(KW).fill('.'));
const kset = (x, y, c) => { if (x >= 0 && y >= 0 && x < KW && y < KH) k[y][x] = c; };
const krect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) kset(x, y, c); };
const kprops = [];
const kprop = (s, fx, fy, fw, fh, x, b, wd, sign) => {
  krect(fx, fy, fx + fw - 1, fy + fh - 1, 'H');
  kprops.push({ s, x, b, w: wd, f: [fx, fy, fw, fh], ...(sign ? { sign } : {}) });
};
krect(0, 0, KW - 1, 0, 'T'); krect(0, KH - 1, KW - 1, KH - 1, 'T');
krect(0, 0, 0, KH - 1, 'T'); krect(KW - 1, 0, KW - 1, KH - 1, 'T');

// A grassy northern route, a village loop and a quiet creek on the east bank.
// Route 1 is a natural patch, not a rectangle, like the zones in the wilds.
const kblob = (cx, cy, rx, ry, c, seed) => {
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 0.82 + 0.3 * (n - Math.floor(n))) kset(x, y, c);
  }
};
kblob(8, 4.5, 6.2, 2.9, 'G', 11); kblob(13, 3.5, 2.2, 1.8, 'G', 12);
krect(12, 11, 27, 11, 'P'); krect(12, 21, 27, 21, 'P');
krect(12, 8, 12, 21, 'P'); krect(27, 9, 27, 21, 'P');
krect(6, 13, 32, 13, 'P'); krect(32, 8, 32, 13, 'P');
for (let y = 12; y <= 23; y++) {
  const x = y < 17 ? 35 : 34;
  krect(x, y, x + 1, y, 'W');
}

// Five tile wide art at its native 64 pixels per tile. Only the lower three
// rows collide, leaving the roofs (including the tall apothecary roof) above.
const doors = [];
// off is the doorway's column inside the art, so the door tile sits right under the door students see.
for (const [s, x, y, place, off] of [
  ['house-cottage', 4, 10, 'home', 1],
  ['kc-store', 16, 6, 'store', 3],
  ['kc-apothecary', 22, 6, 'apothecary', 1],
  ['kc-clinic', 16, 16, 'clinic', 1],
  ['kc-daycare', 23, 16, 'daycare', 1],
]) {
  kprop(s, x, y, 5, 3, x, y + 3, 5, place);
  const door = { x: x + off, y: y + 3, place };
  doors.push(door);
  krect(door.x, door.y, door.x, y < 10 ? 11 : door.y + 1, 'P');
}
krect(5, 14, 6, 15, 'P');
krect(18, 20, 18, 21, 'P'); krect(25, 20, 25, 21, 'P');
kprop('prop-route-sign', 11, 8, 1, 1, 11, 9, 102 / 64, 'route-1');

// Fences use the same footprint pattern as town props. Short end pieces can
// overlap visually; each sprite stays at its native two tile width.
const fence = (x, y, fw = 2, drawX = x) => kprop('prop-fence', x, y, fw, 1, drawX, y + 1, 2);
// Cemetery hill: 11 by 7, with alternating grave rows and clear walking lanes.
for (let x = 27; x <= 35; x += 2) fence(x, 2);
fence(37, 2, 1);
for (let y = 3; y <= 7; y++) { fence(27, y, 1, 26); fence(37, y, 1); }
fence(27, 8); fence(29, 8); fence(34, 8); fence(36, 8);
// The arch has solid posts and an open middle. Its sign footprint is the west
// post, not the walkable aperture; the east post is solid too.
kprop('kc-cemetery-gate', 31, 8, 1, 1, 31, 9, 3, 'cemetery-gate');
kset(33, 8, 'H');
const graves = [];
for (const y of [3, 5, 7]) for (const x of [28, 29, 30, 31, 33, 34, 35, 36]) graves.push([x, y]);

// A small practice enclosure with a southern entrance off the home lane.
for (const x of [3, 5, 7, 9]) fence(x, 18);
for (let y = 19; y <= 22; y++) { fence(3, y, 1, 2); fence(10, y, 1); }
fence(3, 23); fence(7, 23); fence(9, 23);
krect(5, 23, 6, 23, 'P'); krect(6, 21, 6, 24, 'P');
krect(6, 24, 12, 24, 'P'); krect(12, 21, 12, 24, 'P');
kprop('prop-route-sign', 7, 22, 1, 1, 7, 23, 102 / 64, 'practice-yard');

// The bus and welcome sign sit just below the southern stretch of the loop.
kprop('prop-bus-stop', 17, 23, 2, 1, 17, 24, 2, 'bus-stop-kc');
kprop('kc-town-sign', 21, 23, 2, 1, 21, 24, 2, 'town-sign-kc');
krect(17, 22, 22, 22, 'P'); krect(20, 21, 20, 23, 'P');
for (const [x, y] of [[11, 12], [28, 12], [13, 20], [30, 9]]) kprop('prop-lantern', x, y, 1, 1, x, y + 1, 47 / 64, 'lantern');
for (const [x, y] of [[29, 17], [14, 23]]) kprop('prop-bench', x, y, 2, 1, x, y + 1, 2, 'bench');
for (const [x, y] of [[2, 11], [30, 21]]) kprop('prop-rock', x, y, 1, 1, x, y + 1, 1, 'rock');
for (const [x, y] of [[3, 14], [22, 20], [33, 11]]) kprop('prop-bush', x, y, 1, 1, x, y + 1, 1, 'bush');
for (const [x, y] of [[2, 9], [10, 15], [29, 23], [37, 18]]) kprop('prop-tree', x, y, 1, 1, x, y + 1, 122 / 64);
for (const [x, y] of [[3, 13], [9, 13], [15, 9], [21, 10], [28, 15], [31, 19], [16, 22], [23, 24]]) kset(x, y, 'F');

const kettle = {
  id: 'kettle',
  rows: k.map((r) => r.join('')),
  arrive: [[5, 14], [6, 14], [5, 15], [6, 15]],
  props: kprops,
  doors,
  graves,
  exits: [],
};

// Check both the empty map and a full cemetery: future headstones must never
// cut off a walking lane or strand another headstone without an approach.
const neighbours = (x, y) => [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
const walkable = (x, y) => '.PFG'.includes(k[y]?.[x] ?? ' ');
const checkKettle = (occupiedGraves) => {
  const blocked = new Set(occupiedGraves ? graves.map(([x, y]) => `${x},${y}`) : []);
  const seen = new Set();
  const queue = [kettle.arrive[0]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i], key = `${x},${y}`;
    if (!walkable(x, y) || blocked.has(key) || seen.has(key)) continue;
    seen.add(key);
    queue.push(...neighbours(x, y));
  }
  const reachable = (x, y) => seen.has(`${x},${y}`);
  for (let y = 0; y < KH; y++) for (let x = 0; x < KW; x++) {
    if (walkable(x, y) && !blocked.has(`${x},${y}`) && !reachable(x, y)) throw new Error(`Kettle unreachable tile ${x},${y}`);
  }
  for (const { x, y, place } of doors) {
    if (k[y][x] !== 'P' || !reachable(x, y)) throw new Error(`Kettle unreachable door ${place}`);
  }
  for (const [x, y] of kettle.arrive) if (!reachable(x, y)) throw new Error(`Kettle unreachable arrival ${x},${y}`);
  for (const [x, y] of graves) {
    if (k[y][x] !== '.' || !neighbours(x, y).some(([nx, ny]) => reachable(nx, ny))) throw new Error(`Kettle inaccessible grave ${x},${y}`);
  }
};
checkKettle(false);
checkKettle(true);
writeMap('kettle.json', kettle);
console.log('kettle', KW, 'x', KH, 'doors', doors.length, 'graves', graves.length, 'reachability OK');
