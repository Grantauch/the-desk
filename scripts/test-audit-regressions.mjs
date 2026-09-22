import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [firstDay, learningHubs, hallPassOps] = await Promise.all([
  read('public/first-day-materials/index.html'),
  read('src/pages/learning-hubs.astro'),
  read('apps-script/hall-pass/OPERATIONS.md'),
]);

const checks = [
  [
    firstDay.includes('On-time check-ins earn the point automatically; late sign-ins are still recorded for teacher review.'),
    'First Day check-in guidance matches the late-sign-in policy',
  ],
  [
    firstDay.includes('<b>Debunked</b>') && !firstDay.includes('<b>Supported</b>'),
    'First Day Hidden History verdicts use Debunked instead of Supported',
  ],
  [
    firstDay.includes('Current U.S. History unit: The Gilded Age.')
      && firstDay.includes('The table below is the original launch map, not the live pacing calendar.'),
    'First Day pacing copy names the current unit and does not present the launch map as live pacing',
  ],
  [
    firstDay.includes('If you\'re late, the sign-in is still recorded at 0 until I decide whether to award the point.')
      && !firstDay.includes('No catch, no limit'),
    'First Day extra-credit copy does not promise automatic points for late sign-ins',
  ],
  [
    learningHubs.includes('data-overall-streak>0</strong>')
      && learningHubs.includes('return streak;')
      && !learningHubs.includes('Math.max(1, streak)'),
    'A fresh Learning Hub profile starts at a real zero-day streak',
  ],
  [
    hallPassOps.includes('Version 30 is deployed.')
      && hallPassOps.includes('baa8ad44416d5023796f112501de8461233e918c')
      && hallPassOps.includes('35777981230')
      && hallPassOps.includes('35778256624')
      && hallPassOps.includes('6ab2df797957c4000848c386')
      && hallPassOps.includes('2026-09-21-backend-b')
      && hallPassOps.includes('2026-09-22-all-teacher-rpcs')
      && hallPassOps.includes('2026-09-22-roster-sync-v1')
      && hallPassOps.includes('2026-09-22-roster-write-v1'),
    'Hall Pass operations identifies the verified Version 30 production fingerprint',
  ],
  [
    hallPassOps.includes('Students are not blocked afterward: a late sign-in is recorded immediately at 0 points until the teacher reviews whether to award the daily point.'),
    'Hall Pass operations documents the current configurable late-sign-in policy',
  ],
];

for (const [condition, label] of checks) {
  assert.ok(condition, label);
  console.log(`PASS ${label}`);
}

console.log(`Audit regressions: ${checks.length}/${checks.length} checks passed.`);
