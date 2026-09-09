import { spawnSync } from 'node:child_process';

const runAudit = (args) => {
  const result = spawnSync('npm', ['audit', '--json', ...args], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (result.error) throw result.error;
  try {
    return JSON.parse(result.stdout || '{}');
  } catch {
    throw new Error(`npm audit did not return JSON. stderr: ${result.stderr || '(empty)'}`);
  }
};

const summarize = (label, audit) => {
  const vulnerabilities = audit.vulnerabilities || {};
  const important = Object.entries(vulnerabilities)
    .filter(([, value]) => ['high', 'critical'].includes(value?.severity))
    .map(([name, value]) => ({
      package: name,
      severity: value.severity,
      direct: Boolean(value.isDirect),
      fix: value.fixAvailable === true
        ? 'available'
        : value.fixAvailable && typeof value.fixAvailable === 'object'
          ? `${value.fixAvailable.name || name}@${value.fixAvailable.version || 'available'}`
          : 'none listed',
      via: Array.isArray(value.via)
        ? value.via.map((item) => typeof item === 'string' ? item : item?.title || item?.name).filter(Boolean).join(' | ')
        : '',
    }));

  console.log(`\n${label}`);
  console.log(`high=${audit.metadata?.vulnerabilities?.high || 0} critical=${audit.metadata?.vulnerabilities?.critical || 0}`);
  if (important.length) console.table(important);
  else console.log('No high/critical advisories reported.');
  return important;
};

const production = runAudit(['--omit=dev']);
const full = runAudit([]);
const productionImportant = summarize('Production dependency audit', production);
const fullImportant = summarize('Full dependency audit', full);

console.log(`\nDependency audit report: ${productionImportant.length} production and ${fullImportant.length} total high/critical package entries.`);
console.log('This CI step is diagnostic; release blocking remains handled by the explicit dependency policy rather than transient registry state.');
