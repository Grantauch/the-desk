/**
 * the desk · Turn In load test against the real, deployed web app.
 *
 *   node scripts/turn-in-load-test.mjs <web app URL ending in /exec> <load test key> [students]
 *
 * Get the key by running startLoadTest in the Turn In Apps Script editor.
 * Synthetic students use PINs 900001 and up, so no real PIN is ever sent.
 * Their rows land in the Load Test tab only. Run stopLoadTest afterward.
 *
 * Wave 1: every student presses Turn In at the same moment (the bell).
 * Wave 2: every student signs in and autosaves at the same moment.
 * Failed requests retry the way desk-save.js does, with the same submission id,
 * so the Load Test tab should end with exactly one row per student.
 */

const [url, key, countArg] = process.argv.slice(2);
if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url || '') || !key) {
  console.log('Usage: node scripts/turn-in-load-test.mjs <web app URL ending in /exec> <load test key> [students]');
  process.exit(2);
}
const count = Math.max(1, Math.min(60, Number(countArg) || 35));
const words = (n, seed) => Array.from({ length: n }, (_, i) => ['railroad', 'strike', 'wages', 'Pullman', 'Debs', 'federal', 'troops', 'union'][(i + seed) % 8]).join(' ');
const answers = (seed) => Array.from({ length: 8 }, (_, i) => ({ k: `id:q${i + 1}`, q: `Load test question ${i + 1}`, a: words(150, seed + i) }));

async function call(body) {
  const started = Date.now();
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  return { json, ms: Date.now() - started };
}

async function withRetry(body, attempts = 3) {
  let last;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const out = await call(body);
      if (out.json && out.json.code === 'server' && i < attempts) { last = out; continue; }
      return { ...out, tries: i };
    } catch (error) {
      last = { error, tries: i };
      await new Promise((r) => setTimeout(r, 1200 * i + Math.random() * 800));
    }
  }
  return last;
}

function summarize(label, results) {
  const ok = results.filter((r) => r.json && r.json.ok);
  const times = ok.map((r) => r.ms).sort((a, b) => a - b);
  const pct = (p) => times.length ? times[Math.min(times.length - 1, Math.floor(p * times.length))] : 0;
  const retried = results.filter((r) => r.tries > 1).length;
  console.log(`${label}: ${ok.length} of ${results.length} succeeded · median ${pct(0.5)} ms · slowest ${times[times.length - 1] || 0} ms · ${retried} needed a retry`);
  results.filter((r) => !(r.json && r.json.ok)).forEach((r, i) => console.log(`  failure ${i + 1}: ${r.error ? r.error.message : JSON.stringify(r.json)}`));
  return ok.length === results.length;
}

const pins = Array.from({ length: count }, (_, i) => String(900001 + i));
const run = Date.now().toString(36);

console.log(`Load testing ${url} with ${count} synthetic students.`);
const wave1 = await Promise.all(pins.map((pin, i) => withRetry({
  action: 'turnin', test: key, pin, hub: 'load-test', title: 'Load test', page: '/load-test',
  submissionId: `load-${run}-${pin}`, answers: answers(i), device: `load-${pin}`,
})));
const good1 = summarize('Wave 1, everyone presses Turn In at once', wave1);

const signins = await Promise.all(pins.map((pin) => withRetry({ action: 'signin', test: key, pin, hub: 'load-test', device: `load-${pin}` })));
const wave2 = await Promise.all(signins.map((s, i) => s.json && s.json.ok
  ? withRetry({ action: 'save', token: s.json.token, hub: 'load-test', answers: answers(i + 3) })
  : Promise.resolve(s)));
const good2 = summarize('Wave 2, everyone autosaves at once', wave2);

console.log(good1 && good2
  ? `PASS. Open the Turn In sheet: the Load Test tab should have ${count} new rows, one per synthetic student.`
  : 'FAIL. Do not put this in front of students yet.');
process.exit(good1 && good2 ? 0 : 1);
