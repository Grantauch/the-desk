/** Eco-time contracts; E01 will wire controls to this clock after review. */
export const TIME_SPEEDS = [1, 4, 16, 64] as const;
export type TimeSpeed = (typeof TIME_SPEEDS)[number];
export const ECO_DAY_REAL_MS = 1000;
export const MAX_PENDING_DAYS = 4096;
export const MAX_CATCHUP_DAYS_PER_CALL = 64;
export type ClockSnapshot = Readonly<{
  version: 1;
  day: number;
  pendingMillis: number;
  speed: TimeSpeed;
  paused: boolean;
}>;
export type ClockAdvance = Readonly<{ days: number; pendingDays: number; saturated: boolean }>;

function safeInt(n: unknown, min: number, max: number): n is number {
  return typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
}
function isSpeed(n: unknown): n is TimeSpeed {
  return typeof n === "number" && TIME_SPEEDS.some(s => s === n);
}
export class EvolutionClock {
  private day = 0;
  private pendingMillis = 0;
  private speed: TimeSpeed = 1;
  private paused = true;
  setSpeed(speed: TimeSpeed): void {
    if (!isSpeed(speed)) throw new RangeError("Unsupported time speed");
    this.speed = speed;
  }
  setPaused(paused: boolean): void { this.paused = Boolean(paused); }
  snapshot(): ClockSnapshot {
    return { version: 1, day: this.day, pendingMillis: this.pendingMillis, speed: this.speed, paused: this.paused };
  }
  restore(input: unknown): void {
    if (!input || typeof input !== "object") throw new Error("Invalid eco-time snapshot");
    const data = input as Record<string, unknown>;
    if (data.version !== 1 || !safeInt(data.day, 0, Number.MAX_SAFE_INTEGER - MAX_PENDING_DAYS) ||
      !safeInt(data.pendingMillis, 0, MAX_PENDING_DAYS * ECO_DAY_REAL_MS) ||
      !isSpeed(data.speed) || typeof data.paused !== "boolean") {
      throw new Error("Invalid eco-time fields");
    }
    this.day = data.day;
    this.pendingMillis = data.pendingMillis;
    this.speed = data.speed;
    this.paused = data.paused;
  }
  /**
   * Day = logical ecology step, not a rendered frame. Never reports more days
   * than the caller's budget. If the backlog reaches its cap, saturated=true
   * signals that requested speed could not be sustained.
   * E01 must commit ecology callbacks before publishing the advanced day.
   */
  advance(realMillis: number, dayBudget = 8): ClockAdvance {
    if (!safeInt(realMillis, 0, 1000) || !safeInt(dayBudget, 0, MAX_CATCHUP_DAYS_PER_CALL)) {
      throw new RangeError("Clock input outside bounded scheduling contract");
    }
    if (this.paused) return { days: 0, pendingDays: Math.floor(this.pendingMillis / ECO_DAY_REAL_MS), saturated: false };
    const capacity = MAX_PENDING_DAYS * ECO_DAY_REAL_MS;
    const requested = this.pendingMillis + realMillis * this.speed;
    const admitted = Math.min(requested, capacity);
    this.pendingMillis = admitted;
    const days = Math.min(dayBudget, Math.floor(this.pendingMillis / ECO_DAY_REAL_MS));
    if (this.day + days > Number.MAX_SAFE_INTEGER - MAX_PENDING_DAYS) throw new RangeError("Evolution clock overflow");
    this.day += days;
    this.pendingMillis -= days * ECO_DAY_REAL_MS;
    return { days, pendingDays: Math.floor(this.pendingMillis / ECO_DAY_REAL_MS), saturated: requested > capacity || this.pendingMillis >= ECO_DAY_REAL_MS };
  }
}
