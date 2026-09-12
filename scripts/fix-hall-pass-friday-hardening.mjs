import fs from 'node:fs';

function replaceOnce(text, search, replacement, label) {
  const first = text.indexOf(search);
  if (first < 0) throw new Error(`Missing follow-up patch anchor: ${label}`);
  if (text.indexOf(search, first + search.length) >= 0) throw new Error(`Follow-up patch anchor is not unique: ${label}`);
  return text.slice(0, first) + replacement + text.slice(first + search.length);
}

const appPath = 'scripts/test-hall-pass-app.cjs';
let app = fs.readFileSync(appPath, 'utf8');
app = replaceOnce(
  app,
  "behaviorContext.readWaitingQueue_ = () => ({ live: [], expired: [] });\nconst rolloverSafeSnapshot = behaviorContext.__gdBehavior.getPassSnapshot_();",
  "behaviorContext.readWaitingQueue_ = () => ({ live: [], expired: [] });\n// This isolated structural harness intentionally has no workbook services.\n// Stub the room period so the snapshot test stays focused on prior-day rollover.\nbehaviorContext.currentScheduledPeriod_ = () => null;\nconst rolloverSafeSnapshot = behaviorContext.__gdBehavior.getPassSnapshot_();",
  'structural snapshot room-period stub'
);
fs.writeFileSync(appPath, app);

const runtimePath = 'scripts/test-hall-pass-runtime.cjs';
let runtime = fs.readFileSync(runtimePath, 'utf8');
runtime = replaceOnce(
  runtime,
  "c.harness.clock.advanceSeconds(140 * 60); // 7:50 AM -> 10:10 AM local; Period 3 is now meeting.",
  "c.harness.clock.advanceSeconds(146 * 60); // 7:50 AM -> 10:16 AM local; Period 3 requests are open.",
  'Friday period-boundary runtime clock'
);
fs.writeFileSync(runtimePath, runtime);

console.log('Applied Hall Pass Friday verification follow-up.');
