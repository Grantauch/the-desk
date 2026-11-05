/* Offline only. No account, roster, PIN, URL, or credential input belongs here. */
(function (root) {
  'use strict';
  const VERSION = '1.0.0-rc.2';
  const payload = ['Start Here.html','Preflight.html','preflight.js','Smoke-Test.md','README.md',
    'School-IT-Checklist.md','VERSION.json','Recovery.md','verify.py','SOURCE-MANIFEST.json',
    'source/Code.gs','source/Index.html','source/ReleaseChecks.gs','source/ReleaseCheck.html',
    'source/appsscript.json','source/Setup.gs','source/SetupWizard.html'];
  const cases = [
    ['clean_environment','Extract this exact ZIP on a clean supported computer; open Start Here.'],
    ['two_school_accounts','Two authorized teachers complete Google consent and setup in separate private copies.'],
    ['source_integrity','School IT compares all seven copied template files to SOURCE-MANIFEST.json before deployment.'],
    ['domain_policy','IT confirms school-only access, execute as owner, account restrictions and kiosk policy.'],
    ['directory_privacy','Directory sharing is private to authorized staff; classroom workbooks and logs are isolated.'],
    ['inactive_default','Synthetic import creates no memberships; every unassigned identity is refused in both rooms.'],
    ['exact_shared_pin','Five-digit and leading-zero six-digit synthetic values work unchanged in both explicitly enrolled rooms.'],
    ['teacher_boundaries','A student/kiosk account and the other teacher cannot open this classroom’s teacher controls.'],
    ['pass_return','A synthetic pass and return succeed on the managed Chromebook in both rooms; logs agree.'],
    ['screen_privacy','PIN and student details clear after actions, idle timeout and reload; no previous identity remains.'],
    ['throttling','Synthetic invalid attempts remain limited after reload, cache clear and browser nonce changes.'],
    ['revocation','Coordinated synthetic correction and disable invalidate old PINs, sessions and outstanding proofs in both rooms.'],
    ['network_recovery','Wi-Fi interruption is reconciled in the teacher log before retrying an uncertain request.'],
    ['rollback_history','Rehearse software and directory recovery in staging; completed logs/history remain intact.'],
    ['district_authorization','District authorizes cafeteria credential reuse, directory access and recovery policy.'],
    ['update_model','Approved version update/rollback path needs no manual source patch for each teacher copy.']
  ];
  const fail = () => { throw Error('Package check failed. Re-extract the trusted candidate; do not use these files.'); };
  async function digest(bytes) {
    const hash = await root.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2,'0')).join('');
  }
  async function verifyFiles(files) {
    const map = new Map();
    for (const file of files) {
      const raw = file.webkitRelativePath || file.name;
      const name = file.webkitRelativePath ? raw.slice(raw.indexOf('/') + 1) : raw;
      if (!name || name.startsWith('/') || name.includes('\\') || name.split('/').some(p => !p || p === '.' || p === '..') || map.has(name)) fail();
      map.set(name,file);
    }
    const expected = [...payload,'MANIFEST.sha256'];
    if (map.size !== expected.length || expected.some(name => !map.has(name))) fail();
    if (files.some(file => file.size > 4000000) || files.reduce((sum,file) => sum + file.size,0) > 12000000) fail();
    const manifest = await map.get('MANIFEST.sha256').text();
    const hashes = new Map();
    for (const line of manifest.trimEnd().split('\n')) {
      const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
      if (!match || !payload.includes(match[2]) || hashes.has(match[2])) fail();
      hashes.set(match[2],match[1]);
    }
    if (hashes.size !== payload.length) fail();
    for (const name of payload) if (await digest(await map.get(name).arrayBuffer()) !== hashes.get(name)) fail();
    const version = JSON.parse(await map.get('VERSION.json').text());
    if (version.version !== VERSION || version.applicationVersion !== '1.0.0-rc.1' || version.status !== 'RELEASE_CANDIDATE' || version.distributionApproved !== false || version.productionCutoverAuthorized !== false || version.studentDataIncluded !== false) fail();
    const source = JSON.parse(await map.get('SOURCE-MANIFEST.json').text());
    const sourceNames = payload.filter(name => name.startsWith('source/'));
    if (source.packageVersion !== VERSION || source.applicationVersion !== version.applicationVersion || Object.keys(source.files).length !== sourceNames.length || sourceNames.some(name => source.files[name] !== hashes.get(name))) fail();
    if (!source.normalizedFiles || Object.keys(source.normalizedFiles).length !== sourceNames.length) fail();
    for (const name of sourceNames) {
      const normalized = (await map.get(name).text()).replace(/\r\n/g,'\n').replace(/\n+$/,'');
      if (await digest(new TextEncoder().encode(normalized)) !== source.normalizedFiles[name]) fail();
    }
    const manifestBytes = await map.get('MANIFEST.sha256').arrayBuffer();
    return { packageVersion: VERSION, applicationVersion: version.applicationVersion,
      manifestSha256: await digest(manifestBytes), checkedFiles: payload.length, integrity: 'PASS' };
  }
  function report(integrity, statuses, zipSha256) {
    if (!integrity || integrity.integrity !== 'PASS' || !/^[a-f0-9]{64}$/.test(zipSha256 || '')) throw Error('Check the extracted package and select the original ZIP first.');
    const results = cases.map(([id]) => ({id, result: ['PASS','FAIL','BLOCKED'].includes(statuses[id]) ? statuses[id] : 'NOT_RUN'}));
    return { evidenceSchema: 1, ...integrity, zipSha256, results,
      recordedAt: new Date().toISOString(), evidenceType: 'OPERATOR_RECORDED_NOT_INDEPENDENTLY_VERIFIED',
      distributionApproved: false, productionCutoverAuthorized: false };
  }
  root.HallPassKit = {version: VERSION, payload, cases, digest, verifyFiles, report};
})(globalThis);
