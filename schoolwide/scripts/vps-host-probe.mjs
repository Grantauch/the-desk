// Read-only synthetic staging probe; no PINs, rosters, check-ins or passes.
// Requires the isolated loopback service and a reviewed exact release SHA.
const base = 'http://127.0.0.1:18787';
const expected = process.env.EXPECTED_RELEASE_SHA ?? '';
const count = Number(process.env.PROBE_REQUESTS ?? '35');
const concurrency = Number(process.env.PROBE_CONCURRENCY ?? '10');
if (!/^[0-9a-f]{40}$/.test(expected)) throw new Error('Set EXPECTED_RELEASE_SHA to the reviewed 40-character commit.');
if (!Number.isInteger(count) || count < 1 || count > 150) throw new Error('PROBE_REQUESTS must be 1–150.');
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 20) throw new Error('PROBE_CONCURRENCY must be 1–20.');

async function request(path, timeoutMs = 5000) {
  const start = performance.now();
  const response = await fetch(new URL(path, base), {
    redirect: 'error',
    cache: 'no-store',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  // Never log entire private responses. Only bounded public health metadata.
  const ms = performance.now() - start;
  return { status: response.status, ms, response };
}
function expect(ok, message) {
  if (!ok) throw new Error(message);
}
const root = await request('/');
const metadata = await root.response.json();
expect(root.status === 200 && metadata.service === 'grantdesk-schoolwide', 'Incorrect staging service.');
expect(metadata.deploymentTier === 'staging' && metadata.releaseSha === expected, 'Incorrect staging tier or release.');
const live = await request('/health/live');
const liveBody = await live.response.json();
expect(live.status === 200 && liveBody.releaseSha === expected, 'Liveness or SHA mismatch.');
const ready = await request('/health/ready');
const readyBody = await ready.response.json();
expect(ready.status === 200 && readyBody.releaseSha === expected && readyBody.status === 'ready', 'Database not ready.');
const privateRoute = await request('/api/v1/teacher/sections');
expect(privateRoute.status === 401, 'Private teacher endpoint did not fail closed.');
console.log('Staging identity, database readiness and unauthenticated teacher isolation: PASS.');

const samples = [
  { path: '/health/ready', status: 200, durations: [] },
  { path: '/api/v1/teacher/sections', status: 401, durations: [] },
];
const failures = [];
// Bounded workers, not a single burst of 150 concurrent requests.
for (const sample of samples) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, count) }, async () => {
    while (cursor < count) {
      const index = cursor++;
      try {
        const result = await request(sample.path);
        if (result.status !== sample.status) {
          failures.push({ path: sample.path, request: index + 1, status: result.status });
        } else {
          sample.durations.push(result.ms);
        }
      } catch (error) {
        failures.push({ path: sample.path, request: index + 1, type: error?.name ?? 'network-error' });
      }
    }
  }));
}
function percentile(sorted, n) {
  return sorted[Math.max(0, Math.ceil(n * sorted.length) - 1)];
}
for (const sample of samples) {
  const ms = [...sample.durations].sort((a, b) => a - b);
  const fmt = n => Number(n?.toFixed(1) ?? 0);
  console.log(JSON.stringify({
    path: sample.path,
    expectedHttp: sample.status,
    requests: count,
    succeeded: ms.length,
    p50_ms: fmt(percentile(ms, .50)),
    p95_ms: fmt(percentile(ms, .95)),
    p99_ms: fmt(percentile(ms, .99)),
  }));
}
if (failures.length) {
  console.error(JSON.stringify({ failureCount: failures.length, firstFailures: failures.slice(0, 5) }));
  process.exitCode = 1;
} else {
  console.log('Synthetic, read-only staging request probe: PASS.');
}
console.log('LIMIT: this does NOT exercise student PINs, real check-ins, Hall Pass mutations, or actual device recovery.');
