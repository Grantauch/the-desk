import assert from 'node:assert/strict';
import test from 'node:test';
import { AUDIT_TIMEOUT_MS, runAudit, summarize } from './report-dependency-audit.mjs';

const report = (vulnerabilities = {}) => JSON.stringify({ vulnerabilities, metadata: { vulnerabilities: { moderate: 0, high: 0, critical: 0 } } });

test('a stalled registry is killed within a bounded diagnostic budget', () => {
  const result = runAudit(['--omit=dev'], (command, args, options) => {
    assert.equal(command, 'npm');
    assert.ok(args.includes('--omit=dev'));
    assert.ok(args.includes('--fetch-retries=1'));
    assert.equal(options.timeout, AUDIT_TIMEOUT_MS);
    assert.ok(options.timeout <= 60_000);
    assert.equal(options.killSignal, 'SIGKILL');
    return { error: { code: 'ETIMEDOUT' }, status: null, stdout: '' };
  });
  assert.equal(result.available, false);
  assert.match(result.reason, /timed out/);
});

test('an unavailable registry cannot become a clean audit result', () => {
  for (const stdout of ['', '<html>gateway error</html>', '{}', '{"error":{"code":"EAI_AGAIN"}}']) {
    const result = runAudit([], () => ({ status: 1, stdout }));
    const lines = [];
    assert.equal(summarize('Audit', result, { log: line => lines.push(line), table() { assert.fail('No invented vulnerabilities table'); } }), null);
    assert.match(lines.join('\n'), /UNAVAILABLE/);
    assert.doesNotMatch(lines.join('\n'), /No moderate\/high\/critical advisories reported/);
  }
});

test('valid advisories survive the normal npm audit exit code of one', () => {
  const audit = runAudit([], () => ({ status: 1, stdout: report({ example: { severity: 'high', isDirect: true, fixAvailable: true, via: ['example advisory'] } }) }));
  const rows = summarize('Audit', audit, { log() {}, table() {} });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].severity, 'high');
  assert.equal(rows[0].package, 'example');
});

test('a valid zero-advisory result is distinct from a failed process', () => {
  assert.equal(runAudit([], () => ({ status: 0, stdout: report() })).available, true);
  assert.equal(runAudit([], () => ({ status: 2, stdout: report() })).available, false);
  assert.equal(runAudit([], () => ({ status: null, signal: 'SIGTERM', stdout: report() })).available, false);
});
