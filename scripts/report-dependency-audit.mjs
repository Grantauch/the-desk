import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const AUDIT_TIMEOUT_MS = 60_000;

export const runAudit = (args, spawn = spawnSync) => {
  const result = spawn('npm', ['audit', '--json', '--fetch-timeout=20000', '--fetch-retries=1', ...args], {
    encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
    timeout: AUDIT_TIMEOUT_MS, killSignal: 'SIGKILL',
  });
  if (result.error || result.signal) return { available: false, reason: result.error?.code === 'ETIMEDOUT' ? 'registry request timed out' : 'audit process did not complete' };
  try {
    const audit = JSON.parse(result.stdout || '{}');
    if (![0, 1].includes(result.status) || audit.error || !audit.vulnerabilities || !audit.metadata?.vulnerabilities) {
      return { available: false, reason: 'registry did not return a valid audit report' };
    }
    return { available: true, audit };
  } catch {
    return { available: false, reason: 'registry did not return an audit JSON report' };
  }
};

export const summarize = (label, result, output = console) => {
  output.log(`\n${label}`);
  if (!result.available) {
    output.log(`UNAVAILABLE: ${result.reason}. No clean audit result is claimed.`);
    return null;
  }
  const { audit } = result;
  const vulnerabilities = audit.vulnerabilities || {};
  const important = Object.entries(vulnerabilities)
    .filter(([, value]) => ['moderate', 'high', 'critical'].includes(value?.severity))
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

  output.log(`moderate=${audit.metadata.vulnerabilities.moderate || 0} high=${audit.metadata.vulnerabilities.high || 0} critical=${audit.metadata.vulnerabilities.critical || 0}`);
  if (important.length) output.table(important);
  else output.log('No moderate/high/critical advisories reported.');
  return important;
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const productionImportant = summarize('Production dependency audit', runAudit(['--omit=dev']));
  const fullImportant = summarize('Full dependency audit', runAudit([]));
  console.log(`\nDependency audit report: ${productionImportant === null ? 'unavailable' : productionImportant.length} production and ${fullImportant === null ? 'unavailable' : fullImportant.length} total moderate/high/critical package entries.`);
  console.log('This CI step is diagnostic; release blocking remains handled by the explicit dependency policy rather than transient registry state.');
}
