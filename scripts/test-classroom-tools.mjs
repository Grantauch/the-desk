// Fixtures for the tools page logic: group maker, cold call identity, timer clock.
import assert from 'node:assert/strict';
import { groupCount, dealGroups, rosterSlots, secondsUntil } from '../src/lib/classroom-tools.js';

const results = [];
const check = (label, fn) => {
  try {
    fn();
    results.push(['PASS', label]);
  } catch (error) {
    results.push(['FAIL', `${label} -> ${error.message}`]);
  }
};

const roster = (n) => Array.from({ length: n }, (unused, index) => `student ${index + 1}`);

// --- group maker: a request for groups of N must never produce a group of N+1 ---
check('9 names in groups of 4 makes 3 groups', () => assert.equal(groupCount(9, 4), 3));
check('5 names in groups of 4 makes 2 groups', () => assert.equal(groupCount(5, 4), 2));
check('8 names in groups of 4 makes 2 groups', () => assert.equal(groupCount(8, 4), 2));
check('2 names in groups of 4 makes 1 group', () => assert.equal(groupCount(2, 4), 1));

check('no group ever exceeds the requested maximum', () => {
  for (let size = 2; size <= 8; size += 1) {
    for (let total = 2; total <= 60; total += 1) {
      const groups = dealGroups(roster(total), groupCount(total, size));
      const largest = Math.max(...groups.map((group) => group.length));
      assert.ok(largest <= size, `roster ${total} in groups of ${size} produced a group of ${largest}`);
      assert.equal(groups.flat().length, total, `roster ${total} in groups of ${size} lost or duplicated a name`);
    }
  }
});

// --- cold call: duplicate display names stay separate people ---
check('two students named Alex are two callable slots', () => {
  const slots = rosterSlots(['Alex', 'Jordan', 'Alex']);
  assert.equal(slots.length, 3);
  assert.equal(new Set(slots.map((slot) => slot.key)).size, 3);
  assert.deepEqual(slots.map((slot) => slot.name), ['Alex', 'Jordan', 'Alex']);
});

check('calling one Alex leaves the other Alex in the pool', () => {
  const slots = rosterSlots(['Alex', 'Jordan', 'Alex']);
  const called = new Set([slots[0].key]);
  const pool = slots.filter((slot) => !called.has(slot.key));
  assert.equal(pool.length, 2);
  assert.ok(pool.some((slot) => slot.name === 'Alex'), 'the second Alex was collapsed into the first');
});

check('slot keys are stable across rebuilds of the same roster', () => {
  const first = rosterSlots(['Alex', 'Alex', 'Sam']);
  const second = rosterSlots(['Alex', 'Alex', 'Sam']);
  assert.deepEqual(first.map((slot) => slot.key), second.map((slot) => slot.key));
});

// --- timer: elapsed time comes from the clock, not from callback count ---
check('a throttled tab does not gain time', () => {
  const start = 1_000_000;
  const deadline = start + 300 * 1000;
  assert.equal(secondsUntil(deadline, start), 300);
  // One callback fires after a 45 second background stall.
  assert.equal(secondsUntil(deadline, start + 45_000), 255);
});

check('the timer floors at zero and never runs negative', () => {
  const deadline = 1_000_000;
  assert.equal(secondsUntil(deadline, deadline), 0);
  assert.equal(secondsUntil(deadline, deadline + 60_000), 0);
});

check('a paused and resumed timer keeps its remaining seconds', () => {
  const paused = secondsUntil(1_000_000 + 300_000, 1_000_000 + 20_000);
  assert.equal(paused, 280);
  const resumedAt = 5_000_000;
  assert.equal(secondsUntil(resumedAt + paused * 1000, resumedAt), 280);
});

const failed = results.filter(([status]) => status === 'FAIL');
results.forEach(([status, label]) => console.log(`${status}  ${label}`));
if (failed.length) {
  console.error(`Classroom tools: FAIL — ${failed.length} of ${results.length} checks failed.`);
  process.exitCode = 1;
} else {
  console.log(`Classroom tools: PASS — ${results.length} checks across the group maker, cold call picker and timer.`);
}
