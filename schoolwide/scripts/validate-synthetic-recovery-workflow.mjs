/**
 * SW-187: immutable source-level policy for two fictional, test-only CI jobs.
 * No production secrets, deploy triggers, dynamic expressions or extra jobs.
 */
import { parseDocument, isAlias, isMap, isSeq } from 'yaml';

const ACTION = Object.freeze({
  checkout: 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1', // verified v7
  node: 'actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1', // verified v7
  upload: 'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02', // verified v4
  download: 'actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093', // verified v4
});
const deny = (reason) => { throw new Error('Schoolwide production firewall: unsafe synthetic recovery workflow (' + reason + ').'); };
function mapping(value, label, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) deny(label + ' must be mapping');
  if (Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) deny(label + ' has extra or missing keys');
}
function equal(actual, expected, label) {
  const a = typeof actual === 'string' ? actual.trim() : actual;
  const b = typeof expected === 'string' ? expected.trim() : expected;
  if (JSON.stringify(a) !== JSON.stringify(b)) deny(label + ' is not on the allowlist');
}
function noAliases(node) {
  if (!node) return;
  if (isAlias(node) || node.anchor) deny('YAML aliases and anchors are not approved');
  if (isMap(node)) for (const pair of node.items) { noAliases(pair.key); noAliases(pair.value); }
  if (isSeq(node)) for (const item of node.items) noAliases(item);
}
function exactStep(step, expected, label) {
  mapping(step, label, Object.keys(expected));
  for (const [key, value] of Object.entries(expected)) {
    if (key === 'with' || key === 'env') {
      mapping(step[key], label + '.' + key, Object.keys(value));
      for (const [k, v] of Object.entries(value)) equal(step[key][k], v, label + '.' + key + '.' + k);
    } else equal(step[key], value, label + '.' + key);
  }
}
const noOptIn = (mode) => [
  'set +e',
  'bash scripts/ci-cross-runner-synthetic-recovery.sh ' + mode,
  'status=$?',
  'set -e',
  'test "$status" -eq 3',
].join('\n');
const PACKAGE_STEPS = [
  { name: 'Checkout isolated Schoolwide sources', uses: ACTION.checkout },
  { name: 'Node 22', uses: ACTION.node, with: { 'node-version': '22', 'package-manager-cache': false } },
  { name: 'Install and apply migrations to fresh fictional database', run: 'npm ci --no-audit --no-fund && npm run db:migrate' },
  { name: 'Deny recovery export without synthetic opt-in', run: noOptIn('export') },
  { name: 'Encrypt synthetic PostgreSQL backup in first CI runner', env: { SCHOOLWIDE_CROSS_RUNNER_SYNTHETIC: 'true' }, run: 'bash scripts/ci-cross-runner-synthetic-recovery.sh export' },
  { name: 'Transfer ONLY fictional encrypted archive and manifest', uses: ACTION.upload,
    with: { name: 'schoolwide-sw183-fictional-encrypted', path: 'schoolwide/out/sw183-cross-runner/',
      'if-no-files-found': 'error', 'retention-days': 1 } },
];
const RESTORE_STEPS = [
  { name: 'Checkout recovery test (not a deployment)', uses: ACTION.checkout },
  { name: 'Download only encrypted fictional backup into second runner', uses: ACTION.download,
    with: { name: 'schoolwide-sw183-fictional-encrypted', path: 'schoolwide/out/sw183-cross-runner/' } },
  { name: 'Deny recovery restore without synthetic opt-in', run: noOptIn('restore') },
  { name: 'Verify artifact and restore fictional PostgreSQL on separate runner', env: { SCHOOLWIDE_CROSS_RUNNER_SYNTHETIC: 'true' }, run: 'bash scripts/ci-cross-runner-synthetic-recovery.sh restore' },
];
function exactJob(job, id, database, needs, expectedSteps) {
  const label = 'jobs.' + id;
  mapping(job, label, needs ? ['name', 'needs', 'runs-on', 'services', 'defaults', 'env', 'steps'] : ['name', 'runs-on', 'services', 'defaults', 'env', 'steps']);
  equal(job.name, needs ? 'Restore fictional backup on separate CI runner' : 'Generate fictional encrypted backup', label + '.name');
  if (needs) equal(job.needs, 'package_synthetic', label + '.needs');
  equal(job['runs-on'], 'ubuntu-latest', label + '.runs-on');
  mapping(job.services, label + '.services', ['postgres']);
  const pg = job.services.postgres;
  mapping(pg, label + '.postgres', ['image', 'env', 'ports', 'options']);
  equal(pg.image, 'postgres:18-alpine', label + '.image');
  mapping(pg.env, label + '.postgres.env', ['POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD']);
  equal(pg.env.POSTGRES_DB, database, label + '.database');
  equal(pg.env.POSTGRES_USER, 'grantdesk', label + '.user');
  equal(pg.env.POSTGRES_PASSWORD, 'grantdesk', label + '.password');
  if (!Array.isArray(pg.ports) || pg.ports.length !== 1) deny(label + '.ports');
  equal(String(pg.ports[0]), '5432:5432', label + '.ports');
  equal(pg.options, [
    '--health-cmd "pg_isready -U grantdesk -d ' + database + '"',
    '--health-interval 5s', '--health-timeout 3s', '--health-retries 10',
  ].join(' '), label + '.postgres.options');
  mapping(job.defaults, label + '.defaults', ['run']);
  mapping(job.defaults.run, label + '.defaults.run', ['working-directory']);
  equal(job.defaults.run['working-directory'], 'schoolwide', label + '.working-directory');
  mapping(job.env, label + '.env', ['NODE_ENV', 'DATABASE_URL', 'LEGACY_PRODUCTION_WRITES']);
  equal(job.env.NODE_ENV, 'test', label + '.node-env');
  equal(job.env.LEGACY_PRODUCTION_WRITES, 'forbidden', label + '.writes');
  equal(job.env.DATABASE_URL, 'postgresql://grantdesk:grantdesk@127.0.0.1:5432/' + database, label + '.dsn');
  if (!Array.isArray(job.steps) || job.steps.length !== expectedSteps.length) deny(label + '.step-count');
  job.steps.forEach((step, i) => exactStep(step, expectedSteps[i], label + '.steps[' + i + ']'));
}
export function verifySyntheticRecoveryWorkflow(text) {
  if (typeof text !== 'string' || text.length > 30000) deny('invalid input');
  // The approved workflow needs zero expression substitution. Any expression
  // requires another security review, including secrets.toJSON and vars access.
  if (text.includes('$' + '{{')) deny('dynamic GitHub expressions');
  const doc = parseDocument(text, { version: '1.2', uniqueKeys: true, merge: false });
  if (doc.errors.length || doc.warnings.length) deny('ambiguous or invalid YAML');
  noAliases(doc.contents);
  let workflow;
  try { workflow = doc.toJS({ maxAliasCount: 0 }); } catch { deny('invalid YAML nodes'); }
  mapping(workflow, 'root', ['name', 'on', 'permissions', 'jobs']);
  equal(workflow.name, 'Schoolwide Cross-Runner Synthetic Recovery', 'name');
  mapping(workflow.on, 'on', ['push', 'pull_request']);
  mapping(workflow.on.push, 'push', ['branches', 'paths']);
  equal(workflow.on.push.branches, ['schoolwide/**'], 'push branches');
  const watched = [
    'schoolwide/scripts/ci-cross-runner-synthetic-recovery.sh',
    'schoolwide/db/migrations/**',
    '.github/workflows/schoolwide-cross-runner-recovery.yml',
  ];
  equal(workflow.on.push.paths, watched, 'push paths');
  mapping(workflow.on.pull_request, 'pull_request', ['paths']);
  equal(workflow.on.pull_request.paths, watched, 'PR paths');
  mapping(workflow.permissions, 'permissions', ['contents']);
  equal(workflow.permissions.contents, 'read', 'permissions.contents');
  mapping(workflow.jobs, 'jobs', ['package_synthetic', 'restore_synthetic']);
  exactJob(workflow.jobs.package_synthetic, 'package_synthetic', 'grantdesk_schoolwide_export_ci', false, PACKAGE_STEPS);
  exactJob(workflow.jobs.restore_synthetic, 'restore_synthetic', 'grantdesk_schoolwide_restore_ci', true, RESTORE_STEPS);
  return true;
}
