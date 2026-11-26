import { E } from "./elements.ts";
import {
  FORMS, FORCES, HABITATS, TRAITS, getOutcome, type DiscoveryOutcome,
} from "./discovery.ts";
import type { PondSim, PondRegion } from "./sim.ts";

/**
 * The Pond's living layer. These are bounded individual specimens, not extra
 * grid material IDs: original falling-sand saves and 21 particle behaviors
 * remain unchanged. A procedural identity determines morphology, habitat,
 * locomotion, and the small, measurable effect it has on its surroundings.
 */
export const MAX_RESIDENTS = 80;
export const RESIDENTS_VERSION = 1;

export type Locomotion = "swim" | "walk" | "fly" | "root" | "mechanical" | "drift";
export type Influence = "grow" | "heat" | "cool" | "rain" | "clean" | "work" | "glow";

export type ResidentSave = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  age: number;
  phase: number;
};

export type ResidentProfile = Readonly<{
  mode: Locomotion;
  influence: Influence;
  hue: number;
  accent: number;
  size: number;
  speed: number;
  resilience: number;
  name: string;
}>;

const SWIMMERS = new Set(["Otter", "Turtle", "Whale", "Jellyfish", "Coral"]);
const WALKERS = new Set(["Fox", "Stag", "Wolf", "Rabbit", "Frog", "Beetle", "Serpent", "Giant"]);
const FLYERS = new Set(["Hawk", "Moth", "Owl", "Dragon", "Phoenix", "Kite", "Balloon", "Comet", "Star"]);
const ROOTED = new Set(["Mushroom", "Fern", "Flower", "Tree", "Crystal", "Seed", "Shell", "Island", "Cottage", "Tower"]);
const MACHINES = new Set(["Robot", "Clock", "Bicycle", "Golem", "Lantern", "Ship"]);
const CLASSIC_SWIM = new Set(["Fish", "Algae", "Reef", "Seagull"]);
const CLASSIC_FLY = new Set(["Bird", "Butterfly", "Cloud", "Storm", "Fairy", "Spirit", "Lightning"]);
const CLASSIC_ROOT = new Set(["Plant", "Garden", "Forest", "Tree", "Stone", "Mountain", "Oasis", "Glacier", "Glass", "Moss"]);
const CLASSIC_MACHINE = new Set(["Machine", "Robot", "Android", "Pump", "Windmill", "Factory", "Clock", "Tool"]);
const CLASSIC_WALK = new Set(["Animal", "Human", "Cyborg", "Wildlife", "Phoenix", "Thunderbird"]);
const HUNTERS = new Set(["Wolf", "Fox", "Hawk", "Dragon", "Serpent", "Owl"]);
const PREY = new Set(["Rabbit", "Frog", "Moth", "Fish", "Beetle", "Butterfly", "Bird"]);
const POLLINATORS = new Set(["Moth", "Beetle", "Butterfly", "Bird", "Sprite", "Fairy"]);
const VEGETATION = new Set(["Mushroom", "Fern", "Flower", "Tree", "Seed", "Plant", "Garden", "Forest", "Moss", "Algae"]);
function species(outcome: DiscoveryOutcome): string {
  return outcome.kind === "classic" ? outcome.name : FORMS[outcome.facets.form]!;
}


export function residentProfile(outcome: DiscoveryOutcome): ResidentProfile {
  const { form, habitat, force, trait } = outcome.facets;
  const shape = FORMS[form];
  const region = HABITATS[habitat];
  const power = FORCES[force];
  const property = TRAITS[trait];
  let mode: Locomotion =
    SWIMMERS.has(shape) ? "swim" :
    WALKERS.has(shape) ? "walk" :
    FLYERS.has(shape) ? "fly" :
    ROOTED.has(shape) ? "root" :
    MACHINES.has(shape) ? "mechanical" : "drift";
  if (outcome.kind === "classic") {
    if (CLASSIC_SWIM.has(outcome.name)) mode = "swim";
    else if (CLASSIC_FLY.has(outcome.name)) mode = "fly";
    else if (CLASSIC_ROOT.has(outcome.name)) mode = "root";
    else if (CLASSIC_MACHINE.has(outcome.name)) mode = "mechanical";
    else if (CLASSIC_WALK.has(outcome.name)) mode = "walk";
  }
  if (["Ocean", "Reef", "Lagoon", "Lake", "River", "Atoll"].includes(region) && mode === "walk") mode = "swim";
  let influence: Influence = "glow";
  if (["Solar", "Flame", "Volcanic", "Sulfur", "Sunbeam"].includes(power)) influence = "heat";
  else if (["Frost", "Lunar", "Moonbeam"].includes(power)) influence = "cool";
  else if (["Tidal", "Rain", "Oceanic", "River", "Mist"].includes(power)) influence = "rain";
  else if (["Moss", "Rooted", "Mycelial", "Spore", "Pollen"].includes(power) || mode === "root") influence = "grow";
  else if (["Iron", "Copper", "Clockwork", "Electric", "Magnetic"].includes(power) || mode === "mechanical") influence = "work";
  else if (["Windborne", "Aurora", "Prismatic"].includes(power)) influence = "clean";
  if (outcome.kind === "classic") {
    if (["Plant", "Tree", "Garden", "Forest", "Moss", "Flower", "Algae"].includes(outcome.name)) influence = "grow";
    if (["Fire", "Sun", "Lava", "Lightning"].includes(outcome.name)) influence = "heat";
    if (["Ice", "Snow", "Glacier"].includes(outcome.name)) influence = "cool";
    if (["Water", "Rain", "River", "Ocean", "Lake"].includes(outcome.name)) influence = "rain";
  }
  return {
    mode, influence,
    hue: (force * 29 + form * 11) % 360,
    accent: (habitat * 23 + trait * 7 + 80) % 360,
    size: 2 + ((form + trait) % 3),
    speed: 0.16 + (trait % 5) * 0.055,
    resilience: property === "Armored" || property === "Ancient" || power === "Obsidian" ? 0.85 : 1,
    name: outcome.name,
  };
}

function safeNumber(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

/** All-or-nothing validation prevents malformed imports from changing a pond. */
export function validateResidents(value: unknown, sim: PondSim): ResidentSave[] {
  if (!Array.isArray(value) || value.length > MAX_RESIDENTS) {
    throw new Error("That pond has too many residents or an invalid collection.");
  }
  return value.map((item: unknown): ResidentSave => {
    if (!item || typeof item !== "object") throw new Error("Invalid resident.");
    const data = item as Record<string, unknown>;
    if (typeof data.id !== "string" || !getOutcome(data.id) ||
      !safeNumber(data.x, 0, sim.w - 1) || !safeNumber(data.y, 0, sim.h - 1) ||
      !safeNumber(data.vx, -2, 2) || !safeNumber(data.vy, -2, 2) ||
      !safeNumber(data.energy, 0, 100) || !safeNumber(data.age, 0, 10_000_000) ||
      !safeNumber(data.phase, 0, 1000) ||
      !sim.inDish(Math.round(data.x), Math.round(data.y))) {
      throw new Error("Invalid resident position or identity.");
    }
    return {
      id: data.id, x: data.x, y: data.y, vx: data.vx, vy: data.vy,
      energy: data.energy, age: data.age, phase: data.phase,
    } as ResidentSave;
  });
}

function isSwimmable(cell: number): boolean {
  return cell === E.WATER || cell === E.SLIME || cell === E.OIL;
}

export class PondEcosystem {
  private creatures: ResidentSave[] = [];
  private ticks = 0;
  lastInteraction: string | null = null;
  interactionCount = 0;
  get count() { return this.creatures.length; }
  snapshot(): ResidentSave[] { return this.creatures.map((r) => ({ ...r })); }
  clear() {
    this.creatures = [];
    this.ticks = 0;
    this.lastInteraction = null;
    this.interactionCount = 0;
  }

  /** Keep existing inhabitants in their original relative positions as the bowl grows. */
  translate(dx: number, dy: number, sim: PondSim): void {
    const next = this.creatures.map((r) => ({ ...r, x: r.x + dx, y: r.y + dy }));
    this.creatures = validateResidents(next, sim);
  }

  restore(value: unknown, sim: PondSim): void {
    const next = validateResidents(value, sim);
    this.creatures = next;
    this.ticks = 0;
    this.lastInteraction = null;
    this.interactionCount = 0;
  }

  add(id: string, x: number, y: number, sim: PondSim): boolean {
    const outcome = getOutcome(id);
    const px = Math.round(x), py = Math.round(y);
    if (!outcome || this.count >= MAX_RESIDENTS || !sim.inBounds(px, py) ||
        !sim.inDish(px, py) || sim.locked[sim.idx(px, py)]) return false;
    // A new resident gets a deterministic heading and phase. No random state
    // needs to be serialized, and keeping residents bounded avoids frame drops.
    const salt = outcome.facets.form * 17 + outcome.facets.force * 13 + px * 7 + py;
    const heading = (salt % 628) / 100;
    this.creatures.push({
      id, x: px, y: py,
      vx: Math.cos(heading) * 0.4,
      vy: Math.sin(heading) * 0.2,
      energy: 100, age: 0, phase: (salt % 500) / 10,
    });
    return true;
  }

  removeLast(): boolean {
    if (this.creatures.length === 0) return false;
    this.creatures.pop();
    return true;
  }

  step(sim: PondSim, region?: PondRegion): void {
    this.ticks++;
    for (let n = this.creatures.length - 1; n >= 0; n--) {
      const creature = this.creatures[n]!;
      if (region && (creature.x < region.x - 8 || creature.x >= region.x + region.width + 8 ||
          creature.y < region.y - 8 || creature.y >= region.y + region.height + 8)) continue;
      const outcome = getOutcome(creature.id);
      if (!outcome) { this.creatures.splice(n, 1); continue; }
      const profile = residentProfile(outcome);
      creature.age++;
      const x = Math.round(creature.x);
      const y = Math.round(creature.y);
      const i = sim.idx(x, y);
      const cell = sim.grid[i]!;
      const hazardous = cell === E.FIRE || cell === E.LAVA || cell === E.ACID;
      if (hazardous && profile.influence !== "heat") creature.energy -= 0.3 * profile.resilience;
      if (profile.mode === "swim" && !isSwimmable(cell)) creature.energy -= 0.06;
      if (!hazardous && (profile.mode !== "swim" || isSwimmable(cell))) creature.energy = Math.min(100, creature.energy + 0.04);
      if (creature.energy <= 0) {
        this.creatures.splice(n, 1);
        continue;
      }

      if (profile.mode !== "root") {
        // Gentle deterministic schooling, flutter, and walking. Avoids per-step
        // allocation, world-sized searches, and random calls.
        const t = creature.age * (profile.mode === "fly" ? 0.1 : 0.055) + creature.phase;
        const drift = profile.mode === "fly" ? -0.18 :
          profile.mode === "swim" ? 0 :
          profile.mode === "drift" ? -0.11 : 0.09;
        creature.vx = creature.vx * 0.98 + Math.sin(t * 0.37) * 0.016;
        creature.vy = creature.vy * 0.94 + (Math.sin(t) * 0.018 + drift * 0.025);
        const speed = profile.speed;
        const nx = creature.x + Math.max(-speed, Math.min(speed, creature.vx));
        const ny = creature.y + Math.max(-speed, Math.min(speed, creature.vy));
        // A resident cannot escape the glass bowl or move into locked walls.
        if (sim.inBounds(Math.round(nx), Math.round(ny)) &&
          sim.inDish(Math.round(nx), Math.round(ny)) &&
          !sim.locked[sim.idx(Math.round(nx), Math.round(ny))]) {
          creature.x = nx;
          creature.y = ny;
        } else {
          creature.vx *= -0.9;
          creature.vy *= -0.9;
        }
      }

      // Different forces and forms change the *real sand world*, not just
      // the sprite color. Limit changes to ~two per second per resident.
      if ((this.ticks + n * 7) % 24 === 0) this.influence(sim, creature, profile);
    }
    if (this.ticks % 24 === 0) this.interact(sim, region);
  }

  /**
   * Each resident participates in at most one relationship per ecology beat.
   * At 80 residents this is O(80²) only twice per second, never per pixel or
   * per rendered frame. The social rules use existing material IDs exclusively.
   */
  private interact(sim: PondSim, region?: PondRegion): void {
    const active = this.creatures.map((creature) => {
      const outcome = getOutcome(creature.id)!;
      return { creature, name: species(outcome), profile: residentProfile(outcome) };
    }).filter(({ creature }) => !region || (
      creature.x >= region.x - 8 && creature.x < region.x + region.width + 8 &&
      creature.y >= region.y - 8 && creature.y < region.y + region.height + 8
    ));
    const used = new Set<number>();
    let applied = 0;
    for (let i = 0; i < active.length && applied < 6; i++) {
      if (used.has(i)) continue;
      for (let j = i + 1; j < active.length; j++) {
        if (used.has(j)) continue;
        const a = active[i]!, b = active[j]!;
        const dx = a.creature.x - b.creature.x;
        const dy = a.creature.y - b.creature.y;
        if (dx * dx + dy * dy > 100) continue;
        const hunter = HUNTERS.has(a.name) && PREY.has(b.name) ? a :
          HUNTERS.has(b.name) && PREY.has(a.name) ? b : null;
        const victim = hunter === a ? b : hunter === b ? a : null;
        const pollinator = POLLINATORS.has(a.name) && VEGETATION.has(b.name) ? a :
          POLLINATORS.has(b.name) && VEGETATION.has(a.name) ? b : null;
        const plant = pollinator === a ? b : pollinator === b ? a : null;
        const grazer = !HUNTERS.has(a.name) && a.profile.mode === "walk" && VEGETATION.has(b.name) ? a :
          !HUNTERS.has(b.name) && b.profile.mode === "walk" && VEGETATION.has(a.name) ? b : null;
        const food = grazer === a ? b : grazer === b ? a : null;
        const machine = a.profile.mode === "mechanical" && VEGETATION.has(b.name) ? a :
          b.profile.mode === "mechanical" && VEGETATION.has(a.name) ? b : null;
        const crop = machine === a ? b : machine === b ? a : null;
        let event: string | null = null;
        if (hunter && victim) {
          victim.creature.energy = Math.max(0, victim.creature.energy - 1.2);
          hunter.creature.energy = Math.min(100, hunter.creature.energy + 0.4);
          event = hunter.name + " chased " + victim.name;
        } else if (pollinator && plant) {
          pollinator.creature.energy = Math.min(100, pollinator.creature.energy + 0.5);
          plant.creature.energy = Math.min(100, plant.creature.energy + 0.2);
          const x = Math.round(plant.creature.x) + 3;
          const y = Math.round(plant.creature.y) + 2;
          if (sim.inBounds(x, y) && sim.inDish(x, y) && sim.grid[sim.idx(x, y)] === E.EMPTY) {
            sim.spawn(sim.idx(x, y), E.SEED);
          }
          event = pollinator.name + " pollinated " + plant.name;
        } else if (grazer && food) {
          grazer.creature.energy = Math.min(100, grazer.creature.energy + 0.7);
          food.creature.energy = Math.max(0, food.creature.energy - 0.08);
          event = grazer.name + " grazed near " + food.name;
        } else if (machine && crop) {
          const x = Math.round(crop.creature.x) - 2;
          const y = Math.round(crop.creature.y) + 2;
          if (sim.inBounds(x, y) && sim.inDish(x, y) && sim.grid[sim.idx(x, y)] === E.EMPTY) {
            sim.spawn(sim.idx(x, y), E.WATER);
          }
          crop.creature.energy = Math.min(100, crop.creature.energy + 0.3);
          event = machine.name + " irrigated " + crop.name;
        } else if (a.profile.mode === "swim" && b.profile.mode === "swim") {
          const vx = (a.creature.vx + b.creature.vx) / 2;
          a.creature.vx = a.creature.vx * 0.7 + vx * 0.3;
          b.creature.vx = b.creature.vx * 0.7 + vx * 0.3;
          a.creature.energy = Math.min(100, a.creature.energy + 0.2);
          b.creature.energy = Math.min(100, b.creature.energy + 0.2);
          event = a.name + " and " + b.name + " schooled together";
        }
        if (event) {
          this.lastInteraction = event;
          this.interactionCount++;
          used.add(i);
          used.add(j);
          applied++;
          break;
        }
      }
    }
  }

  private influence(sim: PondSim, resident: ResidentSave, profile: ResidentProfile): void {
    const x = Math.round(resident.x), y = Math.round(resident.y);
    const seed = resident.age + resident.phase * 17;
    const dx = Math.sin(seed * 0.71) > 0 ? 2 : -2;
    const dy = Math.cos(seed * 0.53) > 0 ? 2 : -2;
    const nx = x + dx, ny = y + dy;
    if (!sim.inBounds(nx, ny) || !sim.inDish(nx, ny)) return;
    const idx = sim.idx(nx, ny);
    if (sim.locked[idx]) return;
    const there = sim.grid[idx];
    const center = sim.grid[sim.idx(x, y)];
    if (profile.influence === "heat" && there === E.WATER) sim.spawn(idx, E.STEAM);
    else if (profile.influence === "cool" && there === E.WATER) sim.spawn(idx, E.ICE);
    else if (profile.influence === "rain" && there === E.FIRE) sim.setCell(idx, E.SMOKE, 20);
    else if (profile.influence === "rain" && there === E.EMPTY && center === E.PLANT) sim.spawn(idx, E.WATER);
    else if (profile.influence === "grow" && there === E.EMPTY && (center === E.WATER || center === E.PLANT || center === E.SAND)) sim.spawn(idx, E.SEED);
    else if (profile.influence === "work" && there === E.SAND) sim.spawn(idx, E.STONE);
    else if (profile.influence === "clean" && (there === E.SMOKE || there === E.ACID)) sim.setCell(idx, E.EMPTY);
  }

  /** Canvas layer uses native low-resolution pixels, not expensive DOM sprites. */
  /**
   * C04: Field-drawn residents. These silhouettes describe locomotion rather
   * than pretending every procedural discovery depicts a literal animal.
   * Rendering reads existing state only: no simulation or save changes.
   */
  render(ctx: CanvasRenderingContext2D, originX = 0, originY = 0): void {
    if (!this.creatures.length) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const creature of this.creatures) {
      const outcome = getOutcome(creature.id);
      if (!outcome) continue;
      const profile = residentProfile(outcome);
      const x = Math.round(creature.x - originX);
      const y = Math.round(creature.y - originY);
      if (x < -12 || y < -12 || x > ctx.canvas.width + 12 || y > ctx.canvas.height + 12) continue;

      const s = profile.size;
      const phase = creature.age + creature.phase;
      const bob = Math.round(Math.sin(phase * .075) * (profile.mode === "fly" || profile.mode === "drift" ? 2 : 1));
      const flutter = Math.round(Math.sin(phase * .21) * 2);
      const direction = creature.vx < -.04 ? -1 : 1;
      const { form, habitat, force, trait } = outcome.facets;
      // Pigment family is stable per discovery, with restrained naturalist inks.
      const inks = ["#8bb0a1", "#c0a478", "#a3b8c6", "#b3ad85", "#caa58e", "#9fa5c4"] as const;
      const body = inks[(form + force) % inks.length]!;
      const light = inks[(habitat + trait + 2) % inks.length]!;
      const shade = "#263831";
      const mark = (px: number, py: number, w: number, h: number, ink: string) => {
        ctx.fillStyle = ink;
        ctx.fillRect(px, py, w, h);
      };

      // Avoid a square backing behind every resident: each mode has a
      // purpose-drawn contour, with just enough dark contrast for sand/water.
      if (profile.mode === "swim") {
        const yy = y + bob;
        const tailX = x - direction * (s + 2);
        mark(x - s, yy - 2, s * 2 + 1, 5, shade);
        mark(x - s + 1, yy - 1, s * 2 - 1, 3, body);
        mark(tailX - 1, yy - 3, 3, 2, shade);
        mark(tailX - 1, yy + 2, 3, 2, shade);
        mark(tailX, yy - 2, 2, 4, body);
        mark(x - direction, yy - 3, 2, 1, light);
        mark(x + direction * (s - 1), yy - 1, 1, 1, shade);
      } else if (profile.mode === "fly") {
        const yy = y + bob;
        // A winged mark: split wings and a narrow body, never a glowing orb.
        mark(x - 1, yy - s, 3, s * 2 + 1, shade);
        mark(x, yy - s + 1, 1, s * 2 - 1, body);
        mark(x - s - 3, yy - 2 - flutter, s + 2, 2, shade);
        mark(x + 2, yy - 2 + flutter, s + 2, 2, shade);
        mark(x - s - 2, yy - 1 - flutter, s + 1, 2, light);
        mark(x + 2, yy - 1 + flutter, s + 1, 2, light);
        mark(x, yy - s - 1, 1, 1, light);
      } else if (profile.mode === "root") {
        // Stem, differentiated foliage canopy, and visible anchoring roots.
        mark(x - 1, y - s, 3, s * 2 + 2, shade);
        mark(x, y - s, 1, s * 2, body);
        mark(x - s - 1, y - s - 2 + bob, s * 2 + 3, s + 2, shade);
        mark(x - s, y - s - 1 + bob, s * 2 + 1, s, body);
        mark(x - s + 1, y - s + bob, s - 1, 1, light);
        mark(x - s, y + s, s, 2, shade);
        mark(x + 1, y + s, s, 2, shade);
      } else if (profile.mode === "mechanical") {
        // A riveted body with asymmetric feet and an antenna.
        mark(x - s, y - s, s * 2 + 1, s * 2 + 1, shade);
        mark(x - s + 1, y - s + 1, s * 2 - 1, s * 2 - 1, body);
        mark(x, y - s - 3, 1, 3, shade);
        mark(x - s + 1, y - s + 2, 2, 2, light);
        mark(x + s - 2, y - s + 2, 2, 2, light);
        mark(x - s, y + s, 2, 2, shade);
        mark(x + s - 1, y + s, 2, 2, shade);
      } else if (profile.mode === "drift") {
        // Floating bell with irregular trailing threads.
        const yy = y + bob;
        mark(x - s, yy - s, s * 2 + 1, s + 1, shade);
        mark(x - s + 1, yy - s + 1, s * 2 - 1, s - 1, body);
        mark(x - s + 1, yy + 1, 1, Math.max(1, s + flutter), light);
        mark(x, yy, 1, s + 2, light);
        mark(x + s - 1, yy + 1, 1, s - flutter + 2, light);
      } else {
        // Ground-moving oval body, two legs, and a directional face.
        const yy = y + bob;
        mark(x - s, yy - s + 1, s * 2 + 1, s * 2 - 1, shade);
        mark(x - s + 1, yy - s + 2, s * 2 - 1, s * 2 - 3, body);
        mark(x - s + 1, yy + s, 2, 2, shade);
        mark(x + s - 2, yy + s, 2, 2, shade);
        mark(x + direction * (s - 1), yy - 1, 1, 1, shade);
        mark(x - direction * s, yy - s, 2, 2, light);
      }
      // Existing facets supply a tiny, stable mark rather than arbitrary
      // extra anatomy. Marks can be compared with the specimen's field index.
      if (trait % 3 === 0) mark(x, y - s + bob, 1, 1, light);
      if (force % 5 === 0) mark(x - 1, y + bob, 1, 1, light);
    }
    ctx.restore();
  }
}
