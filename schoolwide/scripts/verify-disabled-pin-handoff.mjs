/**
 * SW-178: static safety gate for the OFF-BY-DEFAULT experimental PIN handoff.
 * A source-level tripwire, not an independent audit or student release approval.
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const blocked = new Set([
  'credential-continuity/synthetic-pin-attestation',
  'credential-continuity/postgres-synthetic-replay',
]);

function parsed(relativeName, source) {
  return parse(source, { sourceType: 'module', sourceFilename: relativeName, plugins: ['typescript', 'jsx'] });
}

function walk(root, visitor) {
  const pending = [root];
  while (pending.length) {
    const node = pending.pop();
    if (!node || typeof node !== 'object' || typeof node.type !== 'string') continue;
    visitor(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const item of value) if (item && typeof item.type === 'string') pending.push(item);
      } else if (value && typeof value === 'object' && typeof value.type === 'string') {
        pending.push(value);
      }
    }
  }
}

export function inspectSource(relativeName, source) {
  const normalized = relativeName.replaceAll('\\', '/');
  if (/\.test\.tsx?$/.test(normalized)) return [];
  const findings = [];
  const tree = parsed(normalized, source);
  function checkImport(specifier) {
    if (typeof specifier !== 'string' || !specifier.startsWith('.')) return;
    const target = resolve('/schoolwide/src', dirname(normalized), specifier)
      .replace(/\.(?:[cm]?js|tsx?)$/, '');
    const relativeTarget = relative('/schoolwide/src', target).split(sep).join('/');
    if (blocked.has(relativeTarget)) findings.push(normalized + ' imports protected experimental module ' + relativeTarget);
  }
  walk(tree, node => {
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type)
        && node.source?.type === 'StringLiteral') checkImport(node.source.value);
    if (node.type === 'TSExternalModuleReference' && node.expression?.type === 'StringLiteral') {
      checkImport(node.expression.value);
    }
    const isDynamicImport = node.type === 'ImportExpression';
    const isCall = node.type === 'CallExpression';
    if (isDynamicImport || isCall && (node.callee.type === 'Import'
        || node.callee.type === 'Identifier' && node.callee.name === 'require')) {
      const specifier = isDynamicImport ? node.source : node.arguments[0];
      if (specifier?.type === 'StringLiteral') checkImport(specifier.value);
      else if (specifier?.type === 'TemplateLiteral' && specifier.expressions.length === 0) {
        checkImport(specifier.quasis[0].value.cooked);
      } else {
        findings.push(normalized + ' contains a nonliteral dynamic module import: manual review required');
      }
    }
  });
  return findings;
}

export function inspectServer(source) {
  const tree = parsed('server.ts', source);
  const calls = [];
  walk(tree, node => {
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier'
        && node.callee.name === 'buildApp') calls.push(node);
  });
  if (calls.length !== 1 || calls[0].arguments.length !== 1
      || calls[0].arguments[0].type !== 'ObjectExpression') {
    return ['server.ts must construct exactly one buildApp({ config, database }) with no identity-provider overrides'];
  }
  const fields = calls[0].arguments[0].properties;
  const names = fields.map(field => field.type === 'ObjectProperty' && field.shorthand
    && field.key.type === 'Identifier' ? field.key.name : '<non-shorthand>');
  return names.length === 2 && names[0] === 'config' && names[1] === 'database'
    ? [] : ['server.ts must not inject an unreviewed identity or credential provider'];
}

export function inspectAppDefaults(source) {
  const tree = parsed('app.ts', source);
  const definitions = [];
  walk(tree, node => {
    if (node.type === 'FunctionDeclaration' && node.id?.name === 'buildApp') definitions.push(node);
  });
  if (definitions.length !== 1 || definitions[0].params[0]?.type !== 'ObjectPattern') {
    return ['app.ts must define one buildApp function with explicit disabled provider defaults'];
  }
  const fields = definitions[0].params[0].properties;
  const required = {
    identityProvider: 'DisabledStaffIdentityProvider',
    studentIdentityProvider: 'DisabledStudentIdentityProvider',
    classroomProvider: 'DisabledClassroomProvider',
  };
  const violations = [];
  for (const [name, provider] of Object.entries(required)) {
    const field = fields.find(f => f.type === 'ObjectProperty' && f.key?.name === name);
    const value = field?.value;
    if (value?.type !== 'AssignmentPattern' || value.right?.type !== 'NewExpression'
        || value.right.callee?.type !== 'Identifier' || value.right.callee.name !== provider) {
      violations.push('app.ts must default ' + name + ' to new ' + provider + '()');
    }
  }
  return violations;
}

async function sourceFiles(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(full));
    else if (entry.isFile() && /\.tsx?$/.test(entry.name)) files.push(full);
  }
  return files;
}

export async function verifyDisabledPinHandoff(root = resolve('src')) {
  const violations = [];
  for (const file of await sourceFiles(root)) {
    const name = relative(root, file).split(sep).join('/');
    const source = await readFile(file, 'utf8');
    violations.push(...inspectSource(name, source));
    if (name === 'server.ts') violations.push(...inspectServer(source));
    if (name === 'app.ts') violations.push(...inspectAppDefaults(source));
  }
  if (violations.length) throw new Error('SW-178 DISABLED HANDOFF BOUNDARY FAILED:\n' + violations.join('\n'));
  return 'SW-178 PASS: experimental PIN handoff stays unimported by application code; server retains disabled identity-provider defaults.';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyDisabledPinHandoff().then(console.log, error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
