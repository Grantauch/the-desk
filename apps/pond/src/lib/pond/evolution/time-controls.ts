/**
 * E01: biological time controls.
 *
 * Contract from Grant (via Dot, message 190): Pause/Resume and the 1x/4x/16x/64x
 * speeds change BIOLOGICAL time only. They never multiply, skip, pause or
 * replace PondSim.step. Placed materials keep falling and flowing in real time.
 *
 * The driver therefore calls the physics step exactly once per real frame,
 * whatever the biology speed or pause state is, and only then advances the
 * EvolutionClock. Ecology day callbacks run after physics so they see the
 * world the player sees. The physics pause stays PondSim.paused, which the
 * biology controls never read or write.
 *
 * Commit rule (E00 contract, revised after Dot's review in thread 315):
 * each ecology day is its own transaction. The clock publishes day N only
 * after the callback for day N has returned. If day N throws, days before it
 * stay committed exactly once, day N and everything after it stay queued in
 * the clock's pending time, and the next frame retries day N. The callback
 * may not re-enter the controls or change the clock while it runs; if it
 * does, or if it throws, the clock is put back to that day's snapshot.
 * Day N is checked against the clock's day limit BEFORE its callback runs,
 * so ecology never commits a day the clock cannot publish.
 *
 * Synchronous rule: a day commits when its callback RETURNS, so the callback
 * must finish its work before returning. Async callbacks are rejected by the
 * type (SyncEcologyDay), and at runtime a callback that returns a promise or
 * any other thenable is treated like a throw: the clock goes back to that
 * day's snapshot, the day is not published and stays queued. The returned
 * thenable is never awaited, chained or called.
 */
import { ECO_DAY_REAL_MS, EvolutionClock, MAX_CATCHUP_DAYS_PER_CALL, MAX_PENDING_DAYS, TIME_SPEEDS, type ClockSnapshot, type TimeSpeed } from "./clock.ts";
import type { PondRegion } from "../sim.ts";

/** The one PondSim member E01 is allowed to touch. */
export type PhysicsStepper = { step(region?: PondRegion): void };

export type EcologyDay = (day: number) => void;

/**
 * Compile-time half of the synchronous rule: resolves to never for a callback
 * whose declared return type is a promise or thenable, so async functions do
 * not type-check as ecology callbacks. Runtime rejection covers the rest.
 */
export type SyncEcologyDay<F extends EcologyDay> =
  F extends (day: number) => infer R
    ? 0 extends 1 & R ? F // any: left to the runtime check
    : [Extract<R, PromiseLike<unknown>>] extends [never] ? F : never
    : never;

/** Reads then at most once; a throwing then getter propagates like a callback error. */
function isThenable(value: unknown): boolean {
  if ((typeof value !== "object" || value === null) && typeof value !== "function") return false;
  return typeof (value as { then?: unknown }).then === "function";
}

export type FrameReport = Readonly<{
  physicsSteps: 1;
  /** Days committed during this frame. */
  days: number;
  /** Last committed day after this frame. */
  day: number;
  pendingDays: number;
  /**
   * True only when the requested speed was not sustained: real time was
   * clipped by the clock's backlog cap, or whole days are still queued after
   * this frame. A frame that drains every whole day is not saturated.
   */
  saturated: boolean;
}>;

/** Highest day EvolutionClock can publish (mirrors its own overflow check). */
const MAX_DAY = Number.MAX_SAFE_INTEGER - MAX_PENDING_DAYS;
const PENDING_CAPACITY_MS = MAX_PENDING_DAYS * ECO_DAY_REAL_MS;

/** Real frame times above this are clamped, so a background tab cannot dump a huge backlog. */
export const MAX_FRAME_MILLIS = 250;

function sameClock(a: ClockSnapshot, b: ClockSnapshot): boolean {
  return a.day === b.day && a.pendingMillis === b.pendingMillis && a.speed === b.speed && a.paused === b.paused;
}

/**
 * F only exists so the constructor can reject promise-returning callbacks at
 * compile time; it defaults to EcologyDay and no member depends on it.
 */
export class EvolutionTimeControls<F extends EcologyDay = EcologyDay> {
  readonly clock: EvolutionClock;
  private readonly onDay: EcologyDay;
  private readonly dayBudget: number;
  private busy = false;

  /** An ecology callback is required: there is no running biology clock without real ecology behind it. */
  constructor(onDay: F & SyncEcologyDay<F>, options: { clock?: EvolutionClock; dayBudget?: number } = {}) {
    if (typeof onDay !== "function") throw new TypeError("EvolutionTimeControls needs an ecology day callback");
    this.clock = options.clock ?? new EvolutionClock();
    this.onDay = onDay;
    const budget = options.dayBudget ?? 8;
    if (!Number.isSafeInteger(budget) || budget < 0 || budget > MAX_CATCHUP_DAYS_PER_CALL) {
      throw new RangeError("Invalid ecology day budget");
    }
    this.dayBudget = budget;
  }

  get speeds(): readonly TimeSpeed[] { return TIME_SPEEDS; }
  get speed(): TimeSpeed { return this.clock.snapshot().speed; }
  get paused(): boolean { return this.clock.snapshot().paused; }

  setSpeed(speed: TimeSpeed): void { this.guard(); this.clock.setSpeed(speed); }
  pause(): void { this.guard(); this.clock.setPaused(true); }
  resume(): void { this.guard(); this.clock.setPaused(false); }
  toggle(): void { this.guard(); this.clock.setPaused(!this.paused); }
  snapshot(): ClockSnapshot { return this.clock.snapshot(); }
  restore(input: unknown): void { this.guard(); this.clock.restore(input); }

  private guard(): void {
    if (this.busy) throw new Error("Ecology day callback may not change biology time");
  }

  /**
   * One rendered frame. Physics steps once, at real time, before any biology.
   * Biology then accrues realMillis * speed (unless biology is paused) and
   * commits whole days one at a time, bounded by the clock's backlog cap and
   * the per-frame day budget.
   */
  frame(sim: PhysicsStepper, realMillis: number, region?: PondRegion): FrameReport {
    this.guard();
    sim.step(region);
    const ms = Number.isFinite(realMillis) ? Math.min(MAX_FRAME_MILLIS, Math.max(0, Math.round(realMillis))) : 0;
    // Admission clipping is measured here, not from advance(ms, 0): with a zero
    // budget the clock reports any whole ready day as saturation.
    const start = this.clock.snapshot();
    const clipped = !start.paused && start.pendingMillis + ms * start.speed > PENDING_CAPACITY_MS;
    // Accrue time only; a zero budget publishes no day.
    this.clock.advance(ms, 0);
    let committed = 0;
    this.busy = true;
    try {
      while (committed < this.dayBudget) {
        const before = this.clock.snapshot();
        if (before.paused || before.pendingMillis < ECO_DAY_REAL_MS) break;
        // Preflight: never let ecology commit a day the clock cannot publish.
        if (before.day + 1 > MAX_DAY) throw new RangeError("Evolution clock overflow");
        try {
          const result: unknown = this.onDay(before.day + 1);
          if (isThenable(result)) {
            throw new TypeError("Ecology day callback must be synchronous; it returned a promise or thenable");
          }
        } catch (error) {
          // Undo anything the callback did to the clock before it threw or returned a thenable.
          this.clock.restore(before);
          throw error;
        }
        if (!sameClock(before, this.clock.snapshot())) {
          this.clock.restore(before);
          throw new Error("Ecology day callback changed the evolution clock");
        }
        // The day's ecology has committed; publish exactly that one day.
        const step = this.clock.advance(0, 1);
        if (step.days !== 1) throw new Error("Evolution clock failed to publish a committed day");
        committed++;
      }
    } finally {
      this.busy = false;
    }
    const after = this.clock.snapshot();
    const pendingDays = Math.floor(after.pendingMillis / ECO_DAY_REAL_MS);
    return { physicsSteps: 1, days: committed, day: after.day, pendingDays, saturated: clipped || (!after.paused && pendingDays > 0) };
  }
}
