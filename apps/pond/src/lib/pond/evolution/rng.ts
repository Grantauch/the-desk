/** Evolution-only seeded generator; NOT a promise of deterministic particle physics. */
export type RandomSnapshot = Readonly<{ version: 1; state: number }>;

export class EvolutionRandom {
  private state: number;
  constructor(seed: number) {
    this.state = EvolutionRandom.valid(seed);
  }
  private static valid(seed: number): number {
    if (!Number.isSafeInteger(seed) || seed <= 0 || seed > 0xffffffff) {
      throw new RangeError("Evolution RNG state must be an unsigned nonzero 32-bit integer");
    }
    return seed >>> 0;
  }
  nextUint32(): number {
    let s = this.state;
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    this.state = s >>> 0;
    return this.state;
  }
  nextFloat(): number { return this.nextUint32() / 0x100000000; }
  nextInt(exclusive: number): number {
    if (!Number.isSafeInteger(exclusive) || exclusive <= 0 || exclusive > 0x100000000) {
      throw new RangeError("exclusive limit must be in [1, 2^32]");
    }
    const domain = 0x100000000;
    const bound = domain - (domain % exclusive);
    let value: number;
    do { value = this.nextUint32(); } while (value >= bound);
    return value % exclusive;
  }
  snapshot(): RandomSnapshot { return { version: 1, state: this.state }; }
  restore(input: unknown): void {
    if (!input || typeof input !== "object") throw new Error("Invalid evolution RNG snapshot");
    const value = input as Record<string, unknown>;
    if (value.version !== 1 || typeof value.state !== "number") throw new Error("Invalid evolution RNG version or state");
    this.state = EvolutionRandom.valid(value.state);
  }
}

/** Stable, explicitly scoped initial seed from a discovery ID and world seed. */
export function founderSeed(worldSeed: number, discoveryId: string): number {
  if (!Number.isSafeInteger(worldSeed) || worldSeed <= 0 || worldSeed > 0xffffffff) throw new RangeError("Invalid world seed");
  if (typeof discoveryId !== "string" || !discoveryId.length || discoveryId.length > 90) throw new RangeError("Invalid discovery identity");
  let n = (2166136261 ^ worldSeed) >>> 0;
  for (let i = 0; i < discoveryId.length; i++) n = Math.imul(n ^ discoveryId.charCodeAt(i), 16777619) >>> 0;
  return n || 0x9e3779b9;
}
