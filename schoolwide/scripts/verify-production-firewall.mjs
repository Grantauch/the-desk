import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const allowedChangedPaths = [
  'schoolwide/',
  '.github/workflows/schoolwide-ci.yml',
  '.github/workflows/schoolwide-staging.yml',
  '.github/workflows/schoolwide-staging-deploy.yml',
  '.github/workflows/schoolwide-cross-runner-recovery.yml',
  'tsconfig.json',
];
const forbiddenSourceReferences = [
  'apps-script/hall-pass',
  'google.script.run',
  'SPREADSHEET_ID',
  'script.google.com/macros',
];

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function changedPaths() {
  const explicitBase = process.env.SCHOOLWIDE_BASE_REF;
  const candidates = [explicitBase, 'origin/main', 'main'].filter(Boolean);
  for (const base of candidates) {
    try {
      return git(['diff', '--name-only', `${base}...HEAD`]).split(/\r?\n/).filter(Boolean);
    } catch {
      // Try the next locally available base ref.
    }
  }
  throw new Error('Could not resolve a base ref for the Schoolwide production-firewall check.');
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

const changes = changedPaths();
// Directory exceptions end in '/'. Workflow files and root configs must match
// exactly; a file whose name merely starts with an allowed name is NOT safe.
const outside = changes.filter((path) => !allowedChangedPaths.some((allowed) =>
  allowed.endsWith('/') ? path.startsWith(allowed) : path === allowed,
));
if (outside.length) {
  throw new Error(`Schoolwide production firewall: changes outside the isolated Schoolwide lane: ${outside.join(', ')}`);
}

// The one newly allowed workflow is itself test-only and cannot request
// broader GitHub authority, secrets, deploy triggers or production resources.
const crossRunnerFile = '.github/workflows/schoolwide-cross-runner-recovery.yml';
if (changes.includes(crossRunnerFile)) {
  const workflow = await readFile(join(process.cwd(), '..', crossRunnerFile), 'utf8');
  const required = [
    'name: Schoolwide Cross-Runner Synthetic Recovery',
    'permissions:\n  contents: read',
    'package_synthetic:',
    'restore_synthetic:',
    'needs: package_synthetic',
    'SCHOOLWIDE_CROSS_RUNNER_SYNTHETIC:',
    'postgres:18-alpine',
    'actions/upload-artifact@v4',
    'actions/download-artifact@v4',
    'retention-days: 1',
  ];
  for (const marker of required) {
    if (!workflow.includes(marker)) {
      throw new Error(`Schoolwide production firewall: unsafe synthetic recovery workflow, missing ${marker}.`);
    }
  }
  if ((workflow.match(/runs-on: ubuntu-latest/g) ?? []).length !== 2) {
    throw new Error('Schoolwide production firewall: recovery requires exactly two ephemeral hosted runners.');
  }
  const forbidden = [
    'workflow_dispatch:', 'pull_request_target:', 'repository_dispatch:',
    'workflow_run:', 'id-token: write', 'contents: write', 'secrets.',
    'credentials_json:', 'environment: production', 'google-github-actions/auth',
  ];
  for (const marker of forbidden) {
    if (workflow.includes(marker)) {
      throw new Error(`Schoolwide production firewall: unauthorized recovery workflow token ${marker}.`);
    }
  }
}

const trackedEnvironmentFile = changes.find((path) => /^schoolwide\/\.env(?:\.|$)/.test(path) && path !== 'schoolwide/.env.example');
if (trackedEnvironmentFile) throw new Error(`Do not commit Schoolwide environment secrets: ${trackedEnvironmentFile}`);

for (const file of await walk(join(process.cwd(), 'src'))) {
  const content = await readFile(file, 'utf8');
  for (const forbidden of forbiddenSourceReferences) {
    if (content.includes(forbidden)) {
      throw new Error(`Schoolwide production firewall: ${relative(process.cwd(), file)} references protected legacy runtime token ${forbidden}.`);
    }
  }
}

console.log(`Schoolwide production firewall PASS · ${changes.length} changed path(s) remain isolated.`);
