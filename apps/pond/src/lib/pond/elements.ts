export const E = {
  EMPTY: 0,
  WALL: 1,
  SAND: 2,
  WATER: 3,
  SALT: 4,
  STONE: 5,
  WOOD: 6,
  ICE: 7,
  LAVA: 8,
  OIL: 9,
  ACID: 10,
  SLIME: 11,
  SEED: 12,
  PLANT: 13,
  FUNGUS: 14,
  POWDER: 15,
  FIRE: 16,
  STEAM: 17,
  SMOKE: 18,
  CRITTER: 19,
  SNOW: 20,
} as const;

export type ElementId = (typeof E)[keyof typeof E];

export const ERASER = 255;
export const WIND = 254;

export type ToolId = ElementId | typeof ERASER | typeof WIND;

export const COLS = 192;
export const ROWS = 192;

export type Rgb = readonly [number, number, number];

export const RGB: Rgb[] = [
  [14, 12, 11], // empty dish
  [42, 38, 34], // wall
  [226, 184, 106], // sand
  [64, 146, 198], // water
  [232, 228, 220], // salt
  [120, 118, 112], // stone
  [132, 92, 58], // wood
  [186, 224, 236], // ice
  [214, 74, 32], // lava
  [58, 48, 40], // oil
  [132, 196, 62], // acid
  [86, 168, 122], // slime
  [168, 140, 72], // seed
  [62, 140, 78], // plant
  [80, 140, 130], // fungus
  [72, 70, 68], // powder
  [232, 92, 42], // fire
  [200, 214, 222], // steam
  [90, 88, 86], // smoke
  [198, 92, 108], // critter
  [236, 240, 244], // snow
];

export const DENSITY = new Uint8Array([
  0, 255, 5, 3, 5, 90, 90, 90, 6, 2, 3, 4, 5, 90, 90, 5, 0, 0, 0, 5, 4,
]);

export const KIND = {
  EMPTY: 0,
  STATIC: 1,
  POWDER: 2,
  LIQUID: 3,
  GAS: 4,
  AGENT: 5,
} as const;

export const KIND_OF = new Uint8Array([
  KIND.EMPTY, // empty
  KIND.STATIC, // wall
  KIND.POWDER, // sand
  KIND.LIQUID, // water
  KIND.POWDER, // salt
  KIND.STATIC, // stone
  KIND.STATIC, // wood
  KIND.STATIC, // ice
  KIND.LIQUID, // lava
  KIND.LIQUID, // oil
  KIND.LIQUID, // acid
  KIND.LIQUID, // slime
  KIND.POWDER, // seed
  KIND.STATIC, // plant
  KIND.STATIC, // fungus
  KIND.POWDER, // powder
  KIND.GAS, // fire
  KIND.GAS, // steam
  KIND.GAS, // smoke
  KIND.AGENT, // critter
  KIND.POWDER, // snow
]);

export const SLIDE = new Uint8Array([
  0, 0, 0, 4, 0, 0, 0, 0, 2, 3, 3, 1, 0, 0, 0, 0, 1, 2, 2, 0, 0,
]);

/** Ignite chance 0–100 when fire touches this cell. */
export const IGNITE = new Uint8Array([
  0, 0, 0, 0, 0, 0, 18, 0, 0, 55, 0, 12, 20, 28, 35, 100, 0, 0, 0, 40, 0,
]);

export type PaletteItem = {
  id: ToolId;
  name: string;
  blurb: string;
  swatch: string;
};

export const PALETTE: PaletteItem[] = [
  { id: E.SAND, name: "Sand", blurb: "Piles up. Sinks in water.", swatch: "bg-sand" },
  { id: E.WATER, name: "Water", blurb: "Flows. Puts out fire. Freezes near ice.", swatch: "bg-water" },
  { id: E.FIRE, name: "Fire", blurb: "Rises. Eats wood, oil, plants.", swatch: "bg-fire" },
  { id: E.PLANT, name: "Plant", blurb: "Grows when water is nearby.", swatch: "bg-plant" },
  { id: E.STONE, name: "Stone", blurb: "Stays put. Melts in lava.", swatch: "bg-stone" },
  { id: E.WOOD, name: "Wood", blurb: "Burns slowly. Makes a little cabin.", swatch: "bg-wood" },
  { id: E.ICE, name: "Ice", blurb: "Spreads into water. Melts near heat.", swatch: "bg-ice" },
  { id: E.LAVA, name: "Lava", blurb: "Boils water into steam. Cools to stone.", swatch: "bg-lava" },
  { id: E.OIL, name: "Oil", blurb: "Floats. Loves fire a little too much.", swatch: "bg-oil" },
  { id: E.SEED, name: "Seed", blurb: "Sprouts on wet sand.", swatch: "bg-seed" },
  { id: E.ACID, name: "Acid", blurb: "Chews wood, stone, plants.", swatch: "bg-acid" },
  { id: E.SLIME, name: "Slime", blurb: "Thick. Slow. Weirdly soothing.", swatch: "bg-slime" },
  { id: E.POWDER, name: "Powder", blurb: "Looks harmless. It is not.", swatch: "bg-powder" },
  { id: E.SNOW, name: "Snow", blurb: "Soft powder. Melts into water.", swatch: "bg-snow" },
  { id: E.CRITTER, name: "Critter", blurb: "Walks, snacks on plants, drowns.", swatch: "bg-critter" },
  { id: E.FUNGUS, name: "Fungus", blurb: "Spreads over wood and plants.", swatch: "bg-fungus" },
  { id: E.SALT, name: "Salt", blurb: "Dissolves. Makes water heavier.", swatch: "bg-salt" },
  { id: E.WALL, name: "Wall", blurb: "A glass ledge. Nothing passes.", swatch: "bg-wall" },
  { id: WIND, name: "Wind", blurb: "Pushes whatever you stroke.", swatch: "bg-accent" },
  { id: ERASER, name: "Erase", blurb: "Wipe a hole in the dish.", swatch: "bg-surface-2" },
];

export const RECIPES: { id: string; title: string; body: string }[] = [
  { id: "steam", title: "Steam", body: "Water touches fire or lava." },
  { id: "stone", title: "New stone", body: "Lava meets water and cools." },
  { id: "sprout", title: "Sprout", body: "A seed rests on wet sand." },
  { id: "grow", title: "Growth", body: "Plants drink nearby water." },
  { id: "boom", title: "Boom", body: "Fire finds powder." },
  { id: "freeze", title: "Freeze", body: "Ice creeps into still water." },
  { id: "melt", title: "Melt", body: "Heat turns ice and snow to water." },
  { id: "eat", title: "Snack", body: "A critter nibbles a plant." },
  { id: "birth", title: "Baby", body: "A well-fed critter makes another." },
  { id: "fungus", title: "Bloom", body: "Fungus claims wood or plant." },
  { id: "acid", title: "Hole", body: "Acid eats stone, wood, or plant." },
  { id: "oilfire", title: "Inferno", body: "Oil catches. Keep water ready." },
];

export const HINTS = [
  "Oil floats. Fire loves oil. Water puts it out.",
  "Seeds sprout on wet sand.",
  "Shake the dish to wake everything up.",
  "Lava and water make stone and steam.",
  "Critters eat plants and drown in deep water.",
  "Acid chews through wood and stone.",
  "Ice will slowly freeze still water.",
  "Powder plus fire is a bad idea. Or a great one.",
  "Fungus takes over a garden if you let it.",
  "A well-fed critter makes another critter.",
  "Snow melts near fire and lava.",
  "Draw a cup of stone, then pour water in.",
];

export function toolById(id: ToolId): PaletteItem {
  return PALETTE.find((p) => p.id === id) ?? PALETTE[0]!;
}
