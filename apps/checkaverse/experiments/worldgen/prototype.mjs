// Standalone design experiment ONLY. Never imported by the live Checkaverse server.
// Deterministic global-coordinate tile sampling with 32x32 streaming chunks.
// All maps and landmarks are imaginary test terrain, not student-facing content.

export const REGION_THEMES = Object.freeze({
  bramblefen_basin: ["wetland", "meadow", "tide"],
  cindergear_expanse: ["industrial", "gear", "stone"],
  tempest_crown: ["highlands", "storm", "ember"],
  starfall_gloam: ["celestial", "cosmic", "shade"],
  verdant_crown: ["jungle", "meadow", "shade"],
  frostglass_reach: ["arctic", "tide", "stone"],
  emberfall_caldera: ["volcanic", "ember", "stone"],
  saltwind_coast: ["coastal", "tide", "storm"],
  glassdune_wastes: ["desert", "gear", "ember"],
  hollowdeep: ["caverns", "gear", "cosmic"],
  sungrass_steppe: ["grasslands", "meadow", "storm"],
  whisperwood: ["ancient_forest", "cosmic", "shade"]
});

export const CHUNK_SIZE = 32;
export const GENERATOR_VERSION = "worldgen-prototype-v1";

export function hashText(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
}

function hashCell(seed, x, y, salt) {
  let h = (seed ^ Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca6b) ^ salt) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

function field(spec, x, y, scale, salt) {
  const gx = Math.floor(x / scale), gy = Math.floor(y / scale);
  const u = smooth((x - gx * scale) / scale);
  const v = smooth((y - gy * scale) / scale);
  const a = hashCell(spec.numericSeed, gx, gy, salt);
  const b = hashCell(spec.numericSeed, gx + 1, gy, salt);
  const c = hashCell(spec.numericSeed, gx, gy + 1, salt);
  const d = hashCell(spec.numericSeed, gx + 1, gy + 1, salt);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

export function createRegionSpec(regionId, worldSeed, size = 256) {
  const theme = REGION_THEMES[regionId];
  if (!theme) throw new RangeError("Unknown region ID: " + regionId);
  if (typeof worldSeed !== "string" || worldSeed.length < 1 || worldSeed.length > 128) {
    throw new TypeError("A nonempty 1..128-character permanent seed is required");
  }
  if (!Number.isInteger(size) || size < 64 || size > 512 || size % CHUNK_SIZE !== 0) {
    throw new RangeError("Prototype size must be a multiple of 32 from 64 to 512");
  }
  const center = Math.floor(size / 2);
  const outpost = Math.floor(size / 8);
  const landmarks = [
    ["crossroads", center, center],
    ["north-gate", center, outpost],
    ["south-gate", center, size - 1 - outpost],
    ["west-gate", outpost, center],
    ["east-gate", size - 1 - outpost, center]
  ].map(([id, x, y]) => Object.freeze({ id, x, y }));
  return Object.freeze({
    regionId, worldSeed, size, chunkSize: CHUNK_SIZE, version: GENERATOR_VERSION,
    theme: theme[0], types: Object.freeze(theme.slice(1)),
    numericSeed: hashText(GENERATOR_VERSION + "|" + regionId + "|" + worldSeed),
    center, landmarks: Object.freeze(landmarks)
  });
}

function baseTerrain(spec, x, y) {
  const height = field(spec, x, y, 41, 11) * 0.7 + field(spec, x, y, 13, 29) * 0.3;
  const moisture = field(spec, x, y, 37, 47) * 0.6 + field(spec, x, y, 11, 59) * 0.4;
  const detail = field(spec, x, y, 7, 71);
  const riverX = spec.center + Math.round(Math.sin(y / 26 + spec.numericSeed / 4294967296 * 6) * Math.min(20, spec.size / 10));
  const nearRiver = Math.abs(x - riverX) < 2.5;
  switch (spec.theme) {
    case "wetland": return (nearRiver || (height < 0.31 && moisture > 0.52)) ? "W" : moisture > 0.54 ? "G" : detail > 0.62 ? "T" : ".";
    case "industrial": return height > 0.63 ? "R" : detail > 0.72 ? "H" : moisture > 0.68 ? "T" : ".";
    case "highlands": return height > 0.58 ? "R" : moisture > 0.60 ? "G" : detail > 0.75 ? "A" : ".";
    case "celestial": return height > 0.70 ? "R" : detail > 0.66 ? "C" : moisture > 0.54 ? "T" : ".";
    case "jungle": return (nearRiver && height < 0.68) ? "W" : moisture > 0.46 ? "T" : detail > 0.57 ? "F" : ".";
    case "arctic": return (nearRiver && height < 0.67) ? "I" : height > 0.64 ? "R" : detail > 0.57 ? "S" : ".";
    case "volcanic": return (nearRiver && height > 0.55) ? "A" : height > 0.66 ? "R" : detail > 0.59 ? "A" : ".";
    case "coastal": return (y < Math.floor(spec.size * 0.18) || (nearRiver && moisture > 0.43)) ? "W" : height > 0.69 ? "R" : "D";
    case "desert": return height > 0.68 ? "R" : detail > 0.65 ? "F" : "D";
    case "caverns": return height > 0.64 ? "R" : detail > 0.64 ? "C" : moisture > 0.63 ? "W" : ".";
    case "grasslands": return moisture > 0.64 ? "G" : detail > 0.59 ? "F" : ".";
    case "ancient_forest": return moisture > 0.49 ? "T" : detail > 0.64 ? "C" : "G";
    default: throw new RangeError("Unknown palette");
  }
}

// Base ecological terrain, without the early prototype's debug-cross path
// and fixed five-point accessibility landmarks. Layer authored/procedural
// routes on top of this result to avoid leaving artificial grid scars.
export function terrainWithoutDebugPaths(spec, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= spec.size || y >= spec.size) {
    throw new RangeError("Tile coordinate outside region");
  }
  return baseTerrain(spec, x, y);
}

export function tileAt(spec, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= spec.size || y >= spec.size) {
    throw new RangeError("Tile coordinate outside region");
  }
  // Fixed, connected two- to three-tile crossroads. Paths always take priority
  // over procedural hazards; this is a minimum accessibility proof, NOT a final map.
  if (spec.landmarks.some(p => p.x === x && p.y === y)) return "L";
  if (Math.abs(x - spec.center) <= 1 || Math.abs(y - spec.center) <= 1) return "P";
  return baseTerrain(spec, x, y);
}

export function generateChunk(spec, chunkX, chunkY) {
  const count = spec.size / CHUNK_SIZE;
  if (!Number.isInteger(chunkX) || !Number.isInteger(chunkY) || chunkX < 0 || chunkY < 0 || chunkX >= count || chunkY >= count) {
    throw new RangeError("Chunk coordinate outside region");
  }
  const rows = [];
  for (let dy = 0; dy < CHUNK_SIZE; dy++) {
    let line = "";
    for (let dx = 0; dx < CHUNK_SIZE; dx++) line += tileAt(spec, chunkX * CHUNK_SIZE + dx, chunkY * CHUNK_SIZE + dy);
    rows.push(line);
  }
  const content = spec.regionId + "|" + spec.version + "|" + spec.numericSeed + "|" + chunkX + "|" + chunkY + "|" + rows.join("");
  return Object.freeze({
    regionId: spec.regionId,
    version: spec.version,
    chunkX, chunkY,
    rows: Object.freeze(rows),
    hash: hashText(content).toString(16).padStart(8, "0")
  });
}

export function verifyLandmarkSpine(spec) {
  const walkable = new Set(["P", "L"]);
  const start = [spec.center, spec.size - 1];
  const visited = new Uint8Array(spec.size * spec.size);
  const queue = [start];
  for (let pos = 0; pos < queue.length; pos++) {
    const [x, y] = queue[pos];
    if (x < 0 || y < 0 || x >= spec.size || y >= spec.size) continue;
    const id = y * spec.size + x;
    if (visited[id] || !walkable.has(tileAt(spec, x, y))) continue;
    visited[id] = 1;
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return Object.freeze({
    passed: spec.landmarks.every(p => visited[p.y * spec.size + p.x] === 1),
    reached: spec.landmarks.filter(p => visited[p.y * spec.size + p.x] === 1).map(p => p.id),
    expected: spec.landmarks.length
  });
}
