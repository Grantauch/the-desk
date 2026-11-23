import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { verifySyntheticRecoveryWorkflow } from './validate-synthetic-recovery-workflow.mjs';

const repo = join(process.cwd(), '..');
const target = join(repo, '.github', 'workflows', 'schoolwide-cross-runner-recovery.yml');
const original = (await readFile(target, 'utf8')).replace(/\r\n/g, '\n');
function mutate(before, after) {
  assert.ok(original.includes(before), 'test fixture must contain exact original pattern');
  const changed = original.replace(before, after);
  assert.notEqual(changed, original, 'security mutation must be effective');
  return changed;
}
function denies(name, before, after) {
  test(name, () => {
    assert.throws(() => verifySyntheticRecoveryWorkflow(mutate(before, after)),
      /Schoolwide production firewall: unsafe synthetic recovery workflow/);
  });
}

test('SW-187 permits exactly the current synthetic two-runner workload', () => {
  assert.equal(verifySyntheticRecoveryWorkflow(original), true);
  assert.equal(verifySyntheticRecoveryWorkflow(original.replace(/\n/g, '\r\n')), true);
  // A YAML comment is not a permission. The former substring guard rejected
  // comments that merely mentioned forbidden words.
  assert.equal(verifySyntheticRecoveryWorkflow('# workflow_dispatch: permissions: write-all\n' + original), true);
});

denies('SW-187 rejects root permissions write-all',
  'permissions:\n  contents: read', 'permissions: write-all');
denies('SW-187 rejects root elevated scope',
  'permissions:\n  contents: read', 'permissions:\n  contents: write');
denies('SW-187 rejects job-level contents:write even though root is read-only',
  '  package_synthetic:\n', '  package_synthetic:\n    permissions:\n      contents: write\n');
denies('SW-187 rejects job-level permissions write-all',
  '  restore_synthetic:\n', '  restore_synthetic:\n    permissions: write-all\n');
denies('SW-187 rejects extra privileged job',
  'jobs:\n', 'jobs:\n  deploy:\n    runs-on: ubuntu-latest\n    permissions: write-all\n');
denies('SW-187 rejects extra job environment even if root stays read-only',
  '    runs-on: ubuntu-latest\n', '    runs-on: ubuntu-latest\n    environment: production\n');
denies('SW-187 rejects manual dispatch',
  '  pull_request:\n', '  workflow_dispatch:\n  pull_request:\n');
denies('SW-187 rejects pull_request_target even when normal pull_request still present',
  '  pull_request:\n', '  pull_request_target:\n  pull_request:\n');
denies('SW-187 rejects additional job-level environment variable',
  '      NODE_ENV: test\n', '      NODE_ENV: test\n      GITHUB_TOKEN: dangerous\n');
denies('SW-187 rejects unpinned action versions',
  'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
  'actions/checkout@v7');
denies('SW-187 rejects an unexpected action in an authorized step',
  'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
  'attacker/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1');
denies('SW-187 rejects additional step shell commands',
  'run: npm ci --no-audit --no-fund && npm run db:migrate',
  'run: npm ci --no-audit --no-fund && npm run db:migrate && curl example.com');
denies('SW-187 rejects longer artifact retention',
  'retention-days: 1', 'retention-days: 90');
denies('SW-187 rejects server database URL swapping',
  'grantdesk_schoolwide_export_ci', 'grantdesk_schoolwide_production');
denies('SW-187 rejects duplicate YAML keys',
  'permissions:\n  contents: read', 'permissions:\n  contents: read\npermissions:\n  contents: read');
denies('SW-187 rejects YAML aliases/anchors instead of trusting resolved values',
  'name: Schoolwide Cross-Runner Synthetic Recovery',
  'name: &workflow Schoolwide Cross-Runner Synthetic Recovery');
test('SW-187 refuses toJSON(secrets) regardless of whitespace', () => {
  const secretExpression = '$' + '{{ toJSON ( secrets ) }}';
  assert.throws(
    () => verifySyntheticRecoveryWorkflow(mutate(
      'run: npm ci --no-audit --no-fund && npm run db:migrate',
      'run: echo "' + secretExpression + '"')),
    /unsafe synthetic recovery workflow/,
  );
});
test('SW-187 all four Schoolwide workflows pin every external action to verified immutable SHA', async () => {
  for (const name of ['schoolwide-ci.yml', 'schoolwide-staging.yml',
                       'schoolwide-cross-runner-recovery.yml', 'schoolwide-staging-deploy.yml']) {
    const data = (await readFile(join(repo, '.github', 'workflows', name), 'utf8')).replace(/\r\n/g, '\n');
    const actions = [...data.matchAll(/^\s*uses:\s+(\S+)\s*$/gm)].map(match => match[1]);
    assert.ok(actions.length >= 1, name + ' must use pinned actions');
    for (const action of actions) {
      assert.match(action, /^[a-z0-9-]+\/[a-z0-9-]+@[a-f0-9]{40}$/,
        name + ': external action is not commit-pinned: ' + action);
    }
  }
});
