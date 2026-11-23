import test from "node:test";
import assert from "node:assert/strict";
import { E } from "../elements.ts";
import { POND_SIZES, PondSim, type PondRegion } from "../sim.ts";
import { ECO_DAY_REAL_MS, MAX_PENDING_DAYS, TIME_SPEEDS, type TimeSpeed } from "./clock.ts";
import { EvolutionTimeControls, type EcologyDay } from "./time-controls.ts";

/**
 * E01 gate: biology speed and Pause/Resume must never change the physical
 * world. Every run is compared against the same frames driven by plain
 * PondSim.step with no evolution clock at all, cell for cell. Math.random is
 * seeded per run so both sides see the identical physics random stream.
 */

const FRAME_MS = 16;
type Plan = { speed: TimeSpeed; pauseAt?: number; resumeAt?: number };

function seeded<T>(seed: number, run: () => T): T {
  const real = Math.random;
  let s = seed >>> 0;
  Math.random = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  try { return run(); } finally { Math.random = real; }
}

function region(size: number): PondRegion | undefined {
  if (size <= 320) return undefined;
  const c = size / 2;
  return { x: c - 60, y: c - 80, width: 120, height: 160 };
}

function scene(size: number): PondSim {
  const sim = new PondSim(size, size);
  sim.clearInterior();
  const c = size / 2;
  for (let dx = -5; dx <= 5; dx++) sim.setCell(sim.idx(c + dx, c + 2), E.STONE);
  sim.paint(c - 30, c - 40, E.SAND, 1);
  sim.paint(c - 15, c - 40, E.POWDER, 1);
  sim.paint(c + 15, c - 40, E.SNOW, 1);
  sim.paint(c, c - 22, E.WATER, 3);
  sim.paint(c + 30, c - 10, E.STONE, 1);
  return sim;
}

function count(sim: PondSim, kind: number): number {
  let n = 0;
  for (let i = 0; i < sim.grid.length; i++) if (sim.grid[i] === kind) n++;
  return n;
}

function lowest(sim: PondSim, kind: number): number {
  let y = -1;
  for (let i = 0; i < sim.grid.length; i++) if (sim.grid[i] === kind) y = Math.max(y, Math.floor(i / sim.w));
  return y;
}

function baseline(size: number, frames: number): Uint8Array {
  return seeded(size, () => {
    const sim = scene(size);
    for (let f = 0; f < frames; f++) sim.step(region(size));
    return sim.snapshot();
  });
}

function withControls(size: number, frames: number, plan: Plan) {
  return seeded(size, () => {
    const sim = scene(size);
    let steps = 0;
    const counted = { step: (r?: PondRegion) => { steps++; sim.step(r); } };
    let days = 0;
    const tc = new EvolutionTimeControls(() => { days++; });
    tc.setSpeed(plan.speed);
    tc.resume();
    const start = { sand: lowest(sim, E.SAND), snow: lowest(sim, E.SNOW), powder: lowest(sim, E.POWDER), water: lowest(sim, E.WATER) };
    const stone = count(sim, E.STONE);
    for (let f = 0; f < frames; f++) {
      if (f === plan.pauseAt) tc.pause();
      if (f === plan.resumeAt) tc.resume();
      const report = tc.frame(counted, FRAME_MS, region(size));
      assert.equal(report.physicsSteps, 1);
    }
    return { sim, steps, days, start, stone, tc };
  });
}

const FRAMES = 72;

for (const size of POND_SIZES) {
  const expected = baseline(size, FRAMES);
  for (const speed of TIME_SPEEDS) {
    test(`E01 ${size}x${size} at ${speed}x: physics matches real time exactly`, () => {
      const run = withControls(size, FRAMES, { speed });
      assert.equal(run.steps, FRAMES, "exactly one PondSim.step per real frame");
      assert.deepEqual(run.sim.snapshot(), expected, "biology speed must not change the material grid");
      assert.ok(lowest(run.sim, E.SAND) >= run.start.sand + 12, "sand falls");
      assert.ok(lowest(run.sim, E.POWDER) >= run.start.powder + 12, "powder falls");
      assert.ok(lowest(run.sim, E.SNOW) >= run.start.snow + 10, "snow falls");
      assert.ok(lowest(run.sim, E.WATER) > run.start.water, "water flows down");
      assert.equal(count(run.sim, E.STONE), run.stone, "static stone stays");
      assert.equal(run.days, Math.floor((FRAMES * FRAME_MS * speed) / 1000), "biology runs at the chosen speed");
    });

    test(`E01 ${size}x${size} at ${speed}x: biology Pause/Resume leaves physics running`, () => {
      const run = withControls(size, FRAMES, { speed, pauseAt: 10, resumeAt: 50 });
      assert.equal(run.steps, FRAMES, "physics keeps stepping while biology is paused");
      assert.deepEqual(run.sim.snapshot(), expected, "biology pause must not freeze or alter materials");
      assert.ok(run.days <= Math.floor((32 * FRAME_MS * speed) / 1000) + 1, "no biology days pass while paused");
    });
  }
}

test("E01 biology controls never touch the physics pause", () => {
  const sim = new PondSim();
  const tc = new EvolutionTimeControls(() => {});
  tc.resume();
  tc.setSpeed(64);
  tc.pause();
  tc.toggle();
  assert.equal(sim.paused, false);
  sim.paused = true;
  tc.frame(sim, FRAME_MS);
  assert.equal(sim.paused, true, "the world pause belongs to the player, not biology");
});

test("E01 there is no biology clock without a real ecology callback", () => {
  // @ts-expect-error the callback is required
  assert.throws(() => new EvolutionTimeControls(), TypeError);
  // @ts-expect-error the callback must be a function
  assert.throws(() => new EvolutionTimeControls(42), TypeError);
});

test("E01 a failing first ecology day does not publish it and keeps it queued", () => {
  const tc = new EvolutionTimeControls(() => { throw new Error("ecology failed"); });
  tc.resume();
  tc.setSpeed(64);
  const before = tc.snapshot();
  assert.throws(() => tc.frame({ step() {} }, 100), /ecology failed/);
  const after = tc.snapshot();
  assert.equal(after.day, before.day, "the failed day is not published");
  assert.equal(after.pendingMillis, before.pendingMillis + 100 * 64, "the failed day stays queued");
});

test("E01 a second-day failure commits day 1 once and retries day 2 without duplicates", () => {
  const committed: number[] = [];
  let failDay2 = true;
  const tc = new EvolutionTimeControls(day => {
    if (day === 2 && failDay2) { failDay2 = false; throw new Error("day 2 failed"); }
    committed.push(day);
  });
  tc.resume();
  tc.setSpeed(64);
  // 100 ms at 64x = 6400 biology ms = 6 whole days queued.
  assert.throws(() => tc.frame({ step() {} }, 100), /day 2 failed/);
  assert.deepEqual(committed, [1]);
  assert.equal(tc.snapshot().day, 1, "clock publishes exactly the committed day");
  assert.equal(tc.snapshot().pendingMillis, 5400, "day 2 onward stays queued");
  const retry = tc.frame({ step() {} }, 0);
  assert.equal(retry.days, 5);
  assert.equal(retry.day, 6);
  assert.deepEqual(committed, [1, 2, 3, 4, 5, 6], "every day commits exactly once, in order");
  assert.equal(tc.snapshot().pendingMillis, 400);
});

test("E01 the ecology callback cannot re-enter the controls", () => {
  const sim = { step() {} };
  const attempts: Array<(tc: EvolutionTimeControls) => void> = [
    tc => { tc.frame(sim, 16); },
    tc => { tc.setSpeed(1); },
    tc => { tc.pause(); },
    tc => { tc.resume(); },
    tc => { tc.toggle(); },
    tc => { tc.restore(tc.snapshot()); },
  ];
  for (const attempt of attempts) {
    let calls = 0;
    const tc: EvolutionTimeControls = new EvolutionTimeControls(() => { calls++; attempt(tc); });
    tc.resume();
    tc.setSpeed(64);
    const before = tc.snapshot();
    assert.throws(() => tc.frame(sim, 100), /may not change biology time/);
    assert.equal(calls, 1);
    assert.equal(tc.snapshot().day, before.day, "no day is published after a reentry attempt");
    assert.equal(tc.snapshot().speed, 64);
    assert.equal(tc.snapshot().paused, false);
    // The guard is released afterwards.
    tc.pause();
    tc.resume();
  }
});

test("E01 the ecology callback cannot mutate the clock directly", () => {
  const mutations: Array<(tc: EvolutionTimeControls) => void> = [
    tc => tc.clock.setSpeed(1),
    tc => tc.clock.setPaused(true),
    tc => tc.clock.advance(1000, 1),
    tc => tc.clock.restore({ ...tc.clock.snapshot(), day: 99 }),
  ];
  for (const mutate of mutations) {
    const tc: EvolutionTimeControls = new EvolutionTimeControls(() => mutate(tc));
    tc.resume();
    tc.setSpeed(64);
    tc.frame({ step() {} }, 0);
    const before = tc.snapshot();
    assert.throws(() => tc.frame({ step() {} }, 100), /changed the evolution clock/);
    const after = tc.snapshot();
    assert.equal(after.day, before.day);
    assert.equal(after.speed, 64);
    assert.equal(after.paused, false);
    assert.equal(after.pendingMillis, before.pendingMillis + 6400, "the day stays queued after a rejected mutation");
  }
});

test("E01 huge or bad frame times are clamped and bounded", () => {
  let days = 0;
  const tc = new EvolutionTimeControls(() => { days++; });
  tc.resume();
  tc.setSpeed(64);
  const r = tc.frame({ step() {} }, 60_000);
  assert.ok(r.days <= 8 && days === r.days);
  assert.equal(tc.frame({ step() {} }, Number.NaN).physicsSteps, 1);
  assert.equal(tc.frame({ step() {} }, -5).physicsSteps, 1);
});

test("E01 at the clock's day limit no ecology day runs before overflow", () => {
  let calls = 0;
  const tc = new EvolutionTimeControls(() => { calls++; });
  const limit = Number.MAX_SAFE_INTEGER - MAX_PENDING_DAYS;
  tc.restore({ version: 1, day: limit, pendingMillis: 0, speed: 64, paused: false });
  assert.throws(() => tc.frame({ step() {} }, 100), /overflow/);
  assert.equal(calls, 0, "ecology must not commit a day the clock cannot publish");
  const after = tc.snapshot();
  assert.equal(after.day, limit);
  assert.equal(after.pendingMillis, 6400, "the unpublishable days stay queued");
  // The day below the limit still commits normally.
  tc.restore({ version: 1, day: limit - 1, pendingMillis: 0, speed: 64, paused: false });
  assert.throws(() => tc.frame({ step() {} }, 100), /overflow/);
  assert.equal(calls, 1);
  assert.equal(tc.snapshot().day, limit);
});

test("E01 a callback that mutates the clock and then throws is rolled back", () => {
  const mutations: Array<(tc: EvolutionTimeControls) => void> = [
    tc => tc.clock.setSpeed(1),
    tc => tc.clock.setPaused(true),
    tc => tc.clock.advance(1000, 1),
    tc => tc.clock.restore({ ...tc.clock.snapshot(), day: 99 }),
  ];
  for (const mutate of mutations) {
    const tc: EvolutionTimeControls = new EvolutionTimeControls(() => { mutate(tc); throw new Error("ecology failed after mutation"); });
    tc.resume();
    tc.setSpeed(64);
    const before = tc.snapshot();
    assert.throws(() => tc.frame({ step() {} }, 100), /ecology failed after mutation/);
    const after = tc.snapshot();
    assert.equal(after.day, before.day);
    assert.equal(after.speed, 64);
    assert.equal(after.paused, false);
    assert.equal(after.pendingMillis, before.pendingMillis + 6400, "the failed day stays queued with the clock as it was");
  }
});

test("E01 saturation means clipped time or a real whole-day backlog, not normal accrual", () => {
  const drained = new EvolutionTimeControls(() => {});
  drained.resume();
  drained.setSpeed(64);
  for (let f = 0; f < 20; f++) {
    const r = drained.frame({ step() {} }, 16);
    assert.equal(r.pendingDays, 0);
    assert.equal(r.saturated, false, `fully drained 64x/16ms frame ${f} is not saturated`);
  }

  const backlog = new EvolutionTimeControls(() => {}, { dayBudget: 1 });
  backlog.resume();
  backlog.setSpeed(64);
  const b = backlog.frame({ step() {} }, 100);
  assert.equal(b.days, 1);
  assert.equal(b.pendingDays, 5);
  assert.equal(b.saturated, true, "whole days left after the budget is saturation");

  const capacity = MAX_PENDING_DAYS * ECO_DAY_REAL_MS;
  const clipped = new EvolutionTimeControls(() => {});
  clipped.restore({ version: 1, day: 0, pendingMillis: capacity - 100, speed: 64, paused: false });
  assert.equal(clipped.frame({ step() {} }, 16).saturated, true, "time clipped by the backlog cap is saturation");

  const paused = new EvolutionTimeControls(() => {});
  paused.restore({ version: 1, day: 0, pendingMillis: capacity, speed: 64, paused: true });
  assert.equal(paused.frame({ step() {} }, 16).saturated, false, "a paused clock is never saturated");
});

test("E01 promise-returning ecology callbacks do not type-check", () => {
  const sim = { step() {} };
  // @ts-expect-error an async callback cannot be an ecology day
  const asyncArrow = new EvolutionTimeControls(async () => {});
  // @ts-expect-error a callback declared to return a promise cannot be an ecology day
  const promiseReturn = new EvolutionTimeControls((day: number) => Promise.resolve(day));
  // @ts-expect-error a callback that sometimes returns a promise cannot be an ecology day
  const sometimesAsync = new EvolutionTimeControls((day: number) => (day > 0 ? Promise.resolve() : undefined));
  for (const tc of [asyncArrow, promiseReturn, sometimesAsync]) {
    tc.resume();
    tc.setSpeed(64);
    assert.throws(() => tc.frame(sim, 100), /must be synchronous/);
    assert.equal(tc.snapshot().day, 0);
  }
  // Ordinary synchronous callbacks still type-check, declared or inline.
  function declared(_day: number): void {}
  const value: EcologyDay = () => {};
  new EvolutionTimeControls(declared);
  new EvolutionTimeControls(value);
  new EvolutionTimeControls(day => { void day; });
  new EvolutionTimeControls((): never => { throw new Error("always fails"); });
  new EvolutionTimeControls((day: number) => (day > 0 ? 1 : "x"));
});

test("E01 a thenable from the ecology callback is not published and stays queued", () => {
  let thenCalls = 0;
  const thenable = { then() { thenCalls++; } };
  const returns: Array<() => unknown> = [
    () => Promise.resolve(),
    () => thenable,
    () => Object.assign(() => {}, { then() { thenCalls++; } }),
  ];
  for (const make of returns) {
    let calls = 0;
    // A widened EcologyDay hides the async return from the type, so the runtime must catch it.
    const onDay = (() => { calls++; return make(); }) as EcologyDay;
    const tc = new EvolutionTimeControls(onDay);
    tc.resume();
    tc.setSpeed(64);
    let steps = 0;
    const sim = { step() { steps++; } };
    const before = tc.snapshot();
    assert.throws(() => tc.frame(sim, 100), (error: unknown) => error instanceof TypeError && /must be synchronous/.test(error.message));
    assert.equal(calls, 1, "the frame stops at the first async day");
    assert.equal(steps, 1, "physics still stepped exactly once");
    const after = tc.snapshot();
    assert.equal(after.day, before.day, "the async day is not published");
    assert.equal(after.pendingMillis, before.pendingMillis + 6400, "the async day stays queued");
    // Every later frame refuses again; nothing is published or duplicated.
    assert.throws(() => tc.frame(sim, 0), /must be synchronous/);
    assert.equal(tc.snapshot().day, before.day);
    assert.equal(calls, 2);
    // The guard is released afterwards.
    tc.pause();
    tc.resume();
  }
  assert.equal(thenCalls, 0, "a returned thenable is never called");
});

test("E01 a second-day thenable commits day 1 once and retries day 2 without duplicates", () => {
  const committed: number[] = [];
  let asyncDay2 = true;
  const onDay = ((day: number) => {
    if (day === 2 && asyncDay2) { asyncDay2 = false; return Promise.resolve(); }
    committed.push(day);
  }) as EcologyDay;
  const tc = new EvolutionTimeControls(onDay);
  tc.resume();
  tc.setSpeed(64);
  assert.throws(() => tc.frame({ step() {} }, 100), /must be synchronous/);
  assert.deepEqual(committed, [1]);
  assert.equal(tc.snapshot().day, 1, "only the synchronous day is published");
  assert.equal(tc.snapshot().pendingMillis, 5400, "day 2 onward stays queued");
  const retry = tc.frame({ step() {} }, 0);
  assert.equal(retry.days, 5);
  assert.deepEqual(committed, [1, 2, 3, 4, 5, 6], "every day commits exactly once, in order");
});

test("E01 a callback that mutates the clock and then returns a thenable is rolled back", () => {
  const mutations: Array<(tc: EvolutionTimeControls) => void> = [
    tc => tc.clock.setSpeed(1),
    tc => tc.clock.setPaused(true),
    tc => tc.clock.advance(1000, 1),
    tc => tc.clock.restore({ ...tc.clock.snapshot(), day: 99 }),
  ];
  for (const mutate of mutations) {
    const tc: EvolutionTimeControls = new EvolutionTimeControls((() => { mutate(tc); return Promise.resolve(); }) as EcologyDay);
    tc.resume();
    tc.setSpeed(64);
    const before = tc.snapshot();
    assert.throws(() => tc.frame({ step() {} }, 100), /must be synchronous/);
    const after = tc.snapshot();
    assert.equal(after.day, before.day);
    assert.equal(after.speed, 64);
    assert.equal(after.paused, false);
    assert.equal(after.pendingMillis, before.pendingMillis + 6400);
  }
});

test("E01 a throwing then getter is rolled back like a callback error", () => {
  const poisoned = { get then(): unknown { throw new Error("then getter failed"); } };
  const tc = new EvolutionTimeControls((() => poisoned) as EcologyDay);
  tc.resume();
  tc.setSpeed(64);
  const before = tc.snapshot();
  assert.throws(() => tc.frame({ step() {} }, 100), /then getter failed/);
  assert.equal(tc.snapshot().day, before.day);
  assert.equal(tc.snapshot().pendingMillis, before.pendingMillis + 6400);
});

test("E01 non-thenable return values from a synchronous callback still commit", () => {
  const values: unknown[] = [undefined, null, 0, "x", {}, { then: 1 }, () => {}];
  for (const value of values) {
    const tc = new EvolutionTimeControls((() => value) as EcologyDay);
    tc.resume();
    tc.setSpeed(64);
    const report = tc.frame({ step() {} }, 100);
    assert.equal(report.days, 6);
    assert.equal(report.day, 6);
  }
});
