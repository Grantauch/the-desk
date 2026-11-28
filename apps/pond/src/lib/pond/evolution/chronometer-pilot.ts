import { E } from "../elements.ts";
import { EvolutionTimeControls } from "./time-controls.ts";

type HabitatGrid = { readonly w: number; readonly h: number; readonly grid: ArrayLike<number>; inDish(x: number, y: number): boolean };
export type HabitatObservation = Readonly<{ day: number; samples: number; water: number; plants: number; heat: number }>;

const LATTICE = 24;
export function observeHabitat(world: HabitatGrid, day: number): HabitatObservation {
  let samples = 0, water = 0, plants = 0, heat = 0;
  for (let row = 0; row < LATTICE; row++) {
    const y = Math.floor((row + 0.5) * world.h / LATTICE);
    for (let col = 0; col < LATTICE; col++) {
      const x = Math.floor((col + 0.5) * world.w / LATTICE);
      if (!world.inDish(x, y)) continue;
      samples++;
      const cell = world.grid[y * world.w + x];
      if (cell === E.WATER) water++;
      else if (cell === E.PLANT || cell === E.SEED) plants++;
      else if (cell === E.FIRE || cell === E.LAVA) heat++;
    }
  }
  return { day, samples, water, plants, heat };
}

/** Session-only observations; no save change and no writes to the grain grid. */
export class ChronometerPilot {
  private world: HabitatGrid | undefined;
  private fraction = 0;
  private latest: HabitatObservation | null = null;
  readonly controls = new EvolutionTimeControls((day: number) => {
    if (!this.world) throw new Error("No pond to observe");
    this.latest = observeHabitat(this.world, day);
  }, { dayBudget: 2 });

  get observation(): HabitatObservation | null { return this.latest; }

  /** Call once for each existing running fixed step, never once per draw. */
  step(world: HabitatGrid, stepExistingSimulation: () => void) {
    this.world = world;
    // Integer quanta of 22/23 ms sum to exactly 1,000 ms per 45 steps.
    this.fraction += 1000;
    const ms = Math.floor(this.fraction / 45);
    this.fraction -= ms * 45;
    try {
      return this.controls.frame({ step: stepExistingSimulation }, ms);
    } finally {
      this.world = undefined;
    }
  }
}
