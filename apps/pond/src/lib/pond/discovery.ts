import { E, type ElementId } from "./elements.ts";

/**
 * Infinite-craft-style discoveries. Only IDs are stored; the catalog is calculated
 * on demand. The four independent facets provide 40 * 64^3 = 10,485,760
 * distinct, stable procedural identities without allocating a giant array.
 * This is a possibility space, not ten million hand-written recipes or physics.
 */
export const STARTERS = ["Water", "Fire", "Earth", "Wind"] as const;
export const DISCOVERY_STORAGE_KEY = "pond-discoveries-v2";
export const MAX_DISCOVERIES = 6000;

export const FORMS = [
  "Fox", "Otter", "Turtle", "Stag", "Hawk", "Moth", "Beetle", "Whale",
  "Wolf", "Mushroom", "Fern", "Flower", "Tree", "Coral", "Crystal", "Golem",
  "Lantern", "Clock", "Kite", "Ship", "Tower", "Island", "Comet", "Moon",
  "Star", "Dragon", "Phoenix", "Sprite", "Serpent", "Rabbit", "Owl", "Frog",
  "Jellyfish", "Robot", "Bicycle", "Balloon", "Seed", "Shell", "Cottage", "Giant",
] as const;

export const HABITATS = [
  "Forest", "Desert", "Tundra", "Reef", "Marsh", "Volcano", "Glacier", "Cavern",
  "Meadow", "Valley", "Ocean", "River", "Lake", "Mountain", "Canyon", "Jungle",
  "Savanna", "Prairie", "Orchard", "Garden", "Bog", "Swamp", "Mangrove", "Lagoon",
  "Delta", "Waterfall", "Harbor", "Dune", "Geyser", "Cliff", "Plateau", "Grove",
  "Basin", "Ridge", "Crater", "Archipelago", "Coast", "Atoll", "Ravine", "Cloudbank",
  "Sky", "Orbit", "Moon", "Asteroid", "Nebula", "Planet", "Temple", "Ruins",
  "Village", "City", "Library", "Laboratory", "Workshop", "Foundry", "Greenhouse", "Observatory",
  "Lighthouse", "Market", "Trainyard", "Castle", "Shipwreck", "Catacomb", "Clocktower", "Dreamland",
] as const;

export const FORCES = [
  "Solar", "Lunar", "Tidal", "Magnetic", "Electric", "Stormbound", "Frost", "Flame",
  "Moss", "Crystal", "Glass", "Clockwork", "Steam", "Echo", "Gravity", "Static",
  "Prismatic", "Amber", "Obsidian", "Copper", "Silver", "Golden", "Neon", "Shadow",
  "Starlit", "Comet", "Aurora", "Rooted", "Mycelial", "Spore", "Pollen", "Sapphire",
  "Ruby", "Emerald", "Fossil", "Meteor", "Windborne", "Volcanic", "Coral", "Oceanic",
  "River", "Rain", "Dawn", "Dusk", "Midnight", "Nocturnal", "Daylight", "Dream",
  "Memory", "Music", "Velvet", "Iron", "Paper", "Ink", "Marble", "Granite",
  "Salt", "Sulfur", "Quartz", "Thunder", "Mist", "Sunbeam", "Moonbeam", "Cosmic",
] as const;

export const TRAITS = [
  "Glowing", "Whispering", "Dancing", "Sleeping", "Hollow", "Ancient", "Tiny", "Giant",
  "Wandering", "Hidden", "Floating", "Blooming", "Flickering", "Shimmering", "Spinning", "Singing",
  "Feral", "Gentle", "Curious", "Restless", "Brave", "Timid", "Wild", "Patient",
  "Silent", "Radiant", "Weathered", "Mysterious", "Swift", "Steady", "Forgotten", "Endless",
  "Fragile", "Golden", "Silvered", "Painted", "Striped", "Spotted", "Marbled", "Feathered",
  "Armored", "Scaled", "Fractured", "Twisted", "Woven", "Luminous", "Frozen", "Smoldering",
  "Drifting", "Humming", "Bubbling", "Sparkling", "Crackling", "Crawling", "Soaring", "Diving",
  "Rolling", "Growing", "Shifting", "Inverted", "Wriggling", "Reborn", "Murmuring", "Secret",
] as const;

export const OUTCOME_SPACE = FORMS.length * HABITATS.length * FORCES.length * TRAITS.length;
export type Facets = Readonly<{ form: number; habitat: number; force: number; trait: number }>;
export type DiscoveryOutcome = Readonly<{
  id: string;
  name: string;
  kind: "classic" | "procedural";
  facets: Facets;
}>;

// Intuitive discoveries always win over the procedural engine.
const CURATED: ReadonlyArray<readonly [string, string, string]> = [
  ["Earth", "Water", "Mud"], ["Fire", "Water", "Steam"], ["Fire", "Wind", "Energy"],
  ["Earth", "Wind", "Dust"], ["Steam", "Wind", "Cloud"], ["Cloud", "Water", "Rain"],
  ["Earth", "Rain", "Plant"], ["Mud", "Plant", "Swamp"], ["Fire", "Plant", "Ash"],
  ["Plant", "Water", "Garden"], ["Garden", "Water", "Forest"], ["Forest", "Wind", "Leaves"],
  ["Earth", "Fire", "Lava"], ["Lava", "Water", "Stone"], ["Stone", "Wind", "Sand"],
  ["Sand", "Water", "Beach"], ["Beach", "Water", "Ocean"], ["Ocean", "Wind", "Wave"],
  ["Cloud", "Energy", "Storm"], ["Rain", "Storm", "Lightning"], ["Energy", "Stone", "Metal"],
  ["Metal", "Stone", "Tool"], ["Forest", "Tool", "Wood"], ["Tool", "Wood", "Machine"],
  ["Fire", "Wood", "Campfire"], ["Campfire", "Water", "Soup"], ["Ocean", "Plant", "Algae"],
  ["Algae", "Water", "Life"], ["Earth", "Life", "Animal"], ["Animal", "Water", "Fish"],
  ["Animal", "Wind", "Bird"], ["Bird", "Ocean", "Seagull"], ["Fish", "Ocean", "Reef"],
  ["Life", "Stone", "Fossil"], ["Energy", "Life", "Spirit"], ["Spirit", "Forest", "Fairy"],
  ["Machine", "Water", "Pump"], ["Machine", "Wind", "Windmill"], ["Energy", "Machine", "Robot"],
  ["Robot", "Life", "Android"], ["Cloud", "Stone", "Mountain"], ["Mountain", "Water", "River"],
  ["River", "Plant", "Valley"], ["Fire", "Sand", "Glass"], ["Glass", "Water", "Aquarium"],
  ["Aquarium", "Fish", "Fish Tank"], ["Garden", "Life", "Butterfly"], ["Butterfly", "Wind", "Migration"],
  ["Fire", "Fire", "Sun"], ["Water", "Water", "Lake"], ["Earth", "Earth", "Mountain"],
  ["Wind", "Wind", "Breeze"], ["Wind", "Water", "Wave"], ["Sun", "Rain", "Rainbow"],
  ["Sun", "Plant", "Flower"], ["Plant", "Earth", "Roots"], ["Stone", "Stone", "Boulder"],
  ["Glass", "Sand", "Hourglass"], ["Clock", "Wind", "Time"], ["Life", "Life", "Human"],
  ["Human", "Tool", "Invention"], ["Human", "Fire", "Cooking"], ["Human", "Stone", "Shelter"],
  ["Human", "Forest", "Village"], ["Village", "Stone", "City"], ["City", "Energy", "Industry"],
  ["Industry", "Machine", "Factory"], ["Robot", "Human", "Cyborg"], ["Sun", "Water", "Rainbow"],
  ["Sun", "Earth", "Desert"], ["Desert", "Water", "Oasis"], ["Plant", "Bird", "Nest"],
  ["Nest", "Life", "Egg"], ["Egg", "Fire", "Phoenix"], ["Forest", "Animal", "Wildlife"],
  ["Bird", "Storm", "Thunderbird"], ["Ocean", "Storm", "Hurricane"], ["Stone", "Plant", "Moss"],
  ["Moss", "Water", "Bog"], ["Cloud", "Wind", "Snow"], ["Snow", "Water", "Ice"],
  ["Mountain", "Ice", "Glacier"], ["Metal", "Energy", "Clock"],
];

function key(a: string, b: string): string {
  return [a, b].sort().join("\u0000");
}

const recipes = new Map<string, string>();
const known = new Set<string>(STARTERS);
for (const [a, b, result] of CURATED) {
  const pair = key(a, b);
  if (recipes.has(pair)) throw new Error("Duplicate Pond recipe: " + a + " + " + b);
  recipes.set(pair, result);
  known.add(result);
}
export const RECIPE_COUNT = recipes.size;

function hash(input: string): number {
  let n = 2166136261;
  for (let i = 0; i < input.length; i++) n = Math.imul(n ^ input.charCodeAt(i), 16777619);
  n ^= n >>> 16;
  n = Math.imul(n, 0x7feb352d);
  n ^= n >>> 15;
  n = Math.imul(n, 0x846ca68b);
  return (n ^ (n >>> 16)) >>> 0;
}

function classicFacets(name: string): Facets {
  return {
    form: hash("form:" + name) % FORMS.length,
    habitat: hash("habitat:" + name) % HABITATS.length,
    force: hash("force:" + name) % FORCES.length,
    trait: hash("trait:" + name) % TRAITS.length,
  };
}

export function facetIndex({ form, habitat, force, trait }: Facets): number {
  return (((form * HABITATS.length + habitat) * FORCES.length + force) * TRAITS.length) + trait;
}

export function facetsFromIndex(index: number): Facets {
  if (!Number.isSafeInteger(index) || index < 0 || index >= OUTCOME_SPACE) throw new RangeError("Invalid discovery index");
  let remaining = index;
  const trait = remaining % TRAITS.length;
  remaining = Math.floor(remaining / TRAITS.length);
  const force = remaining % FORCES.length;
  remaining = Math.floor(remaining / FORCES.length);
  const habitat = remaining % HABITATS.length;
  const form = Math.floor(remaining / HABITATS.length);
  return { form, habitat, force, trait };
}

export function idFromFacets(facets: Facets): string {
  const index = facetIndex(facets);
  if (Object.entries(facets).some(([axis, value]) => !Number.isInteger(value) || value < 0 || value >= (
    axis === "form" ? FORMS.length : axis === "habitat" ? HABITATS.length : axis === "force" ? FORCES.length : TRAITS.length
  ))) throw new RangeError("Invalid discovery facets");
  return "v:" + index.toString(36);
}

const classicCache = new Map<string, DiscoveryOutcome>();
for (const name of known) classicCache.set(name, { id: name, name, kind: "classic", facets: classicFacets(name) });

export function getOutcome(id: string): DiscoveryOutcome | null {
  const classic = classicCache.get(id);
  if (classic) return classic;
  const match = /^v:([0-9a-z]{1,6})$/.exec(id);
  if (!match) return null;
  const index = Number.parseInt(match[1]!, 36);
  if (index >= OUTCOME_SPACE || index.toString(36) !== match[1]) return null;
  const facets = facetsFromIndex(index);
  return {
    id,
    kind: "procedural",
    facets,
    name: TRAITS[facets.trait] + " " + FORCES[facets.force] + " " +
      HABITATS[facets.habitat] + " " + FORMS[facets.form],
  };
}

/**
 * Order-independent and deterministic. Curated outcomes keep their known
 * semantics; all other pairs produce a stable procedural combination.
 */
export function combine(a: string, b: string): DiscoveryOutcome | null {
  const inputs = [a, b].sort();
  const left = getOutcome(inputs[0]!);
  const right = getOutcome(inputs[1]!);
  if (!left || !right) return null;
  if (left.kind === "classic" && right.kind === "classic") {
    const curated = recipes.get(key(left.name, right.name));
    if (curated) return getOutcome(curated);
  }
  const signature = inputs.join("|");
  const blend = (axis: keyof Facets, size: number) =>
    (hash(signature + "|" + axis) + left.facets[axis] * 3 + right.facets[axis] * 5) % size;
  const facets: Facets = {
    form: blend("form", FORMS.length),
    habitat: blend("habitat", HABITATS.length),
    force: blend("force", FORCES.length),
    trait: blend("trait", TRAITS.length),
  };
  return getOutcome(idFromFacets(facets));
}

/** One of the existing real physics materials, never an invented particle ID. */
export function paintMaterial(outcome: DiscoveryOutcome): ElementId {
  const direct: Record<string, ElementId> = {
    Water: E.WATER, Fire: E.FIRE, Earth: E.STONE, Wind: E.STEAM,
    Mud: E.SLIME, Steam: E.STEAM, Plant: E.PLANT, Sand: E.SAND,
    Lava: E.LAVA, Stone: E.STONE, Wood: E.WOOD, Ice: E.ICE,
    Metal: E.STONE, Fish: E.CRITTER, Animal: E.CRITTER,
    Forest: E.PLANT, Cloud: E.STEAM, Ash: E.POWDER,
    Snow: E.SNOW, Ocean: E.WATER, River: E.WATER,
    Flame: E.FIRE, Algae: E.FUNGUS, Moss: E.FUNGUS,
  };
  if (outcome.kind === "classic" && direct[outcome.name] !== undefined) return direct[outcome.name]!;
  const form = FORMS[outcome.facets.form];
  const habitat = HABITATS[outcome.facets.habitat];
  const force = FORCES[outcome.facets.force];
  if (["Flame", "Volcanic", "Sulfur", "Solar", "Sunbeam"].includes(force)) return habitat === "Volcano" ? E.LAVA : E.FIRE;
  if (["Frost", "Midnight", "Moonbeam"].includes(force) || ["Glacier", "Tundra"].includes(habitat)) return E.ICE;
  if (["Tidal", "Oceanic", "River", "Rain", "Mist"].includes(force) || ["Ocean", "Lake", "River", "Lagoon"].includes(habitat)) return E.WATER;
  if (["Fox", "Otter", "Turtle", "Stag", "Hawk", "Moth", "Beetle", "Whale", "Wolf",
    "Dragon", "Phoenix", "Serpent", "Rabbit", "Owl", "Frog", "Jellyfish"].includes(form)) return E.CRITTER;
  if (["Mushroom", "Coral"].includes(form)) return E.FUNGUS;
  if (["Fern", "Flower", "Tree"].includes(form)) return E.PLANT;
  if (form === "Seed") return E.SEED;
  if (["Lantern", "Clock", "Ship", "Tower", "Robot", "Bicycle", "Cottage"].includes(form)) return E.WOOD;
  if (["Comet", "Moon", "Star", "Balloon", "Sprite"].includes(form)) return E.STEAM;
  if (["Shell", "Crystal", "Golem", "Giant", "Island"].includes(form)) return E.STONE;
  return E.SAND;
}

export function restoreDiscoveries(saved: unknown, legacy: unknown = null): string[] {
  const candidates = Array.isArray(saved) ? saved : Array.isArray(legacy) ? legacy : [];
  const results = new Set<string>(STARTERS);
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || candidate.length > 90 || !getOutcome(candidate)) continue;
    results.add(candidate);
    if (results.size >= MAX_DISCOVERIES) break;
  }
  return [...results];
}
