const baseUrl = (process.env.STAGING_URL ?? '').replace(/\/$/, '');
const expectedReleaseSha = process.env.EXPECTED_RELEASE_SHA ?? '';

if (!baseUrl) throw new Error('STAGING_URL is required.');
if (!/^[0-9a-f]{40}$/.test(expectedReleaseSha)) throw new Error('EXPECTED_RELEASE_SHA must be the exact 40-character Git commit SHA.');

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      redirect: 'error',
      signal: controller.signal,
      headers: { ...(options.headers ?? {}), 'cache-control': 'no-store' },
    });
    let body = null;
    try { body = await response.json(); } catch { /* status-only assertion */ }
    return { response, body };
  } finally {
    clearTimeout(timeout);
  }
}

const root = await request('/');
if (root.response.status !== 200) throw new Error(`Root fingerprint returned HTTP ${root.response.status}.`);
if (root.body?.service !== 'grantdesk-schoolwide') throw new Error('Root fingerprint did not identify GrantDesk Schoolwide.');
if (root.body?.version !== 'sw-170') throw new Error(`Expected SW-170 fingerprint; received ${root.body?.version ?? 'missing'}.`);
if (root.body?.status !== 'staging-release-readiness') throw new Error(`Unexpected SW-170 status ${root.body?.status ?? 'missing'}.`);
if (root.body?.deploymentTier !== 'staging') throw new Error(`Staging deployment reported tier ${root.body?.deploymentTier ?? 'missing'}.`);
if (root.body?.releaseSha !== expectedReleaseSha) throw new Error(`Staging release SHA mismatch: expected ${expectedReleaseSha}, received ${root.body?.releaseSha ?? 'missing'}.`);

const live = await request('/health/live');
if (live.response.status !== 200 || live.body?.status !== 'ok') throw new Error(`Liveness gate failed with HTTP ${live.response.status}.`);
if (live.body?.releaseSha !== expectedReleaseSha) throw new Error('Liveness endpoint release SHA does not match the deployed commit.');

const ready = await request('/health/ready');
if (ready.response.status !== 200 || ready.body?.status !== 'ready') throw new Error(`Database readiness gate failed with HTTP ${ready.response.status}.`);
if (ready.body?.releaseSha !== expectedReleaseSha) throw new Error('Readiness endpoint release SHA does not match the deployed commit.');

const privateRoute = await request('/api/v1/teacher/sections');
if (privateRoute.response.status !== 401) {
  throw new Error(`Private teacher route must fail closed without a staff session; received HTTP ${privateRoute.response.status}.`);
}

console.log(`Schoolwide staging smoke PASS · ${expectedReleaseSha} · liveness/readiness/private-route gates healthy.`);
