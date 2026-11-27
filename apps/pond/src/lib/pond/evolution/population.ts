/** Coarse population metadata only. Does not spawn or evolve residents yet. */
export const COHORT_SCHEMA_VERSION = 1;
export const MAX_COHORTS = 2048;
export const MAX_REPRESENTED_POPULATION = 1_000_000;
export type Cohort = Readonly<{
  key: string;
  founderId: string;
  lineageId: string;
  habitatCell: number;
  represented: number;
  geneticSeed: number;
}>;
export type PopulationSnapshot = Readonly<{ version: 1; cohorts: Cohort[] }>;

const idOkay = (value: unknown, max = 90) =>
  typeof value === "string" && value.length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value);

/** Validate all data atomically; no untrusted dynamic object keys or allocations. */
export function validatePopulation(value: unknown, habitatCellCount: number): PopulationSnapshot {
  if (!Number.isSafeInteger(habitatCellCount) || habitatCellCount <= 0 || habitatCellCount > 65536) throw new RangeError("Invalid habitat grid");
  if (!value || typeof value !== "object") throw new Error("Invalid population data");
  const data = value as Record<string, unknown>;
  if (data.version !== 1 || !Array.isArray(data.cohorts) || data.cohorts.length > MAX_COHORTS) throw new Error("Invalid cohort collection");
  const keys = new Set<string>();
  let total = 0;
  const cohorts: Cohort[] = [];
  for (const candidate of data.cohorts) {
    if (!candidate || typeof candidate !== "object") throw new Error("Invalid cohort");
    const c = candidate as Record<string, unknown>;
    if (!idOkay(c.key) || !idOkay(c.founderId) || !idOkay(c.lineageId) ||
      typeof c.habitatCell !== "number" || !Number.isSafeInteger(c.habitatCell) || c.habitatCell < 0 || c.habitatCell >= habitatCellCount ||
      typeof c.represented !== "number" || !Number.isSafeInteger(c.represented) || c.represented <= 0 ||
      typeof c.geneticSeed !== "number" || !Number.isSafeInteger(c.geneticSeed) || c.geneticSeed < 1 || c.geneticSeed > 0xffffffff) {
      throw new Error("Invalid cohort fields");
    }
    if (keys.has(c.key as string)) throw new Error("Duplicate cohort key");
    keys.add(c.key as string);
    total += c.represented as number;
    if (total > MAX_REPRESENTED_POPULATION) throw new Error("Represented population exceeds limit");
    cohorts.push({ key: c.key as string, founderId: c.founderId as string, lineageId: c.lineageId as string,
      habitatCell: c.habitatCell as number, represented: c.represented as number, geneticSeed: c.geneticSeed as number });
  }
  return { version: 1, cohorts };
}
