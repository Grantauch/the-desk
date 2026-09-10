import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const repoRoot = resolve(process.cwd(), '..');
const deploymentWorkflowPath = resolve(repoRoot, '.github/workflows/schoolwide-staging-deploy.yml');
const bootstrapPath = resolve(process.cwd(), 'scripts/bootstrap-staging-gcp.sh');
const cloudConfigPath = resolve(process.cwd(), 'release/staging-cloud.json');
const releaseRequestPath = resolve(process.cwd(), 'release/staging-deploy-request.json');

function requireText(content, token, description) {
  if (!content.includes(token)) {
    throw new Error(`SW-170 staging release guard: missing ${description}.`);
  }
}

function forbidText(content, token, description) {
  if (content.includes(token)) {
    throw new Error(`SW-170 staging release guard: forbidden ${description}.`);
  }
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const workflow = await readFile(deploymentWorkflowPath, 'utf8');
const bootstrap = await readFile(bootstrapPath, 'utf8');

requireText(workflow, "schoolwide/sw-170-staging-release-readiness", 'branch lock');
requireText(workflow, "schoolwide/release/staging-deploy-request.json", 'explicit release-request trigger');
requireText(workflow, "grantdesk-deployment", 'staging project lock');
requireText(workflow, "us-central1", 'staging region lock');
requireText(workflow, "STAGING_ONLY", 'staging-only authority assertion');
requireText(workflow, "real_data_allowed", 'real-data release assertion');
requireText(workflow, "DATABASE_SOCKET_PATH=/cloudsql/", 'Cloud SQL Unix socket configuration');
requireText(workflow, "LEGACY_PRODUCTION_WRITES=forbidden", 'legacy write prohibition');
requireText(workflow, "OPERATIONS_WORKERS_ENABLED=false", 'SW-170 worker disablement');
requireText(workflow, "google-github-actions/auth@v3", 'short-lived Google authentication action');
forbidText(workflow, 'credentials_json:', 'long-lived Google service-account JSON authentication');
forbidText(workflow, 'workflow_dispatch:', 'unguarded click-to-deploy trigger');

requireText(bootstrap, 'PROJECT_ID="${PROJECT_ID:-grantdesk-deployment}"', 'bootstrap project default');
requireText(bootstrap, '--enable-point-in-time-recovery', 'Cloud SQL point-in-time recovery');
requireText(bootstrap, '--deletion-protection', 'Cloud SQL deletion protection');
requireText(bootstrap, "roles/cloudsql.client", 'runtime Cloud SQL permission');
requireText(bootstrap, "roles/iam.workloadIdentityUser", 'GitHub Workload Identity Federation binding');
requireText(bootstrap, "assertion.repository == '${GITHUB_REPO}'", 'GitHub repository trust restriction');
forbidText(bootstrap, 'service-account-key', 'service-account key creation');
forbidText(bootstrap, 'keys create', 'service-account key creation');

if (await exists(cloudConfigPath)) {
  const cloud = JSON.parse(await readFile(cloudConfigPath, 'utf8'));
  if (cloud.project_id !== 'grantdesk-deployment') throw new Error('SW-170 cloud config must target grantdesk-deployment.');
  if (cloud.region !== 'us-central1') throw new Error('SW-170 cloud config must target us-central1.');
  const forbiddenKeys = ['database_url', 'database_password', 'password', 'credentials_json', 'service_account_key'];
  for (const key of forbiddenKeys) {
    if (Object.hasOwn(cloud, key)) throw new Error(`SW-170 cloud config may not contain secret field ${key}.`);
  }
}

if (await exists(releaseRequestPath)) {
  const request = JSON.parse(await readFile(releaseRequestPath, 'utf8'));
  if (!/^[0-9a-f]{40}$/.test(request.release_sha ?? '')) throw new Error('SW-170 release request requires an exact 40-character Git SHA.');
  if (request.authority !== 'STAGING_ONLY') throw new Error('SW-170 release request must remain STAGING_ONLY.');
  if (request.real_data_allowed !== false) throw new Error('SW-170 release request must prohibit real data.');
}

console.log('SW-170 staging release machinery PASS · keyless auth, private DB path, staging-only trigger, and real-data prohibition verified.');
