// Pure logic behind the tools page, kept here so it can be tested directly.
// The page imports these and scripts/test-classroom-tools.mjs asserts them.

/**
 * How many groups a roster splits into when the teacher asks for groups of at
 * most `size`. Rounding to nearest overfills the last group, so a request for
 * groups of four can quietly produce a group of five.
 * @param {number} rosterSize
 * @param {number} size
 * @returns {number}
 */
export const groupCount = (rosterSize, size) => Math.max(1, Math.ceil(rosterSize / size));

/**
 * Deal names round robin into `nGroups` buckets.
 * @param {string[]} names
 * @param {number} nGroups
 * @returns {string[][]}
 */
export const dealGroups = (names, nGroups) => {
  const groups = Array.from({ length: nGroups }, () => []);
  names.forEach((name, index) => groups[index % nGroups].push(name));
  return groups;
};

/**
 * Roster entries carry their own identity, so two students with the same name
 * are two separate people to the cold call picker.
 * @param {string[]} names
 * @returns {{ name: string, key: string }[]}
 */
export const rosterSlots = (names) => {
  const seen = new Map();
  return names.map((name) => {
    const occurrence = seen.get(name) ?? 0;
    seen.set(name, occurrence + 1);
    return { name, key: occurrence + ' ' + name };
  });
};

/**
 * Seconds left against the wall clock. A background tab throttles callbacks,
 * so counting them loses time. Reading the clock does not.
 * @param {number} deadline
 * @param {number} now
 * @returns {number}
 */
export const secondsUntil = (deadline, now) => Math.max(0, Math.ceil((deadline - now) / 1000));
