import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const allowedChangedPaths = ['schoolwide/', '.github/workflows/schoolwide-ci.yml'];
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
const outside = changes.filter((path) => !allowedChangedPaths.some((allowed) => path === allowed || path.startsWith(allowed)));
if (outside.length) {
  throw new Error(`SW-010 production firewall: changes outside the isolated Schoolwide lane: ${outside.join(', ')}`);
}

const trackedEnvironmentFile = changes.find((path) => /^schoolwide\/\.env(?:\.|$)/.test(path) && path !== 'schoolwide/.env.example');
if (trackedEnvironmentFile) throw new Error(`Do not commit Schoolwide environment secrets: ${trackedEnvironmentFile}`);

for (const file of await walk(join(process.cwd(), 'src'))) {
  const content = await readFile(file, 'utf8');
  for (const forbidden of forbiddenSourceReferences) {
    if (content.includes(forbidden)) {
      throw new Error(`SW-010 production firewall: ${relative(process.cwd(), file)} references protected legacy runtime token ${forbidden}.`);
    }
  }
}

console.log(`Schoolwide production firewall PASS · ${changes.length} changed path(s) remain isolated.`);
