import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, 'apps-script', 'hall-pass');
const EVIDENCE_DIR = path.join(ROOT, 'artifacts');
const EVIDENCE_PATH = path.join(EVIDENCE_DIR, 'hall-pass-apps-script-release.json');

const SOURCE_FILES = [
  { disk: 'Code.gs', name: 'Code', type: 'SERVER_JS' },
  { disk: 'Index.html', name: 'Index', type: 'HTML' },
  { disk: 'ReleaseChecks.gs', name: 'ReleaseChecks', type: 'SERVER_JS' },
  { disk: 'ReleaseCheck.html', name: 'ReleaseCheck', type: 'HTML' },
  { disk: 'appsscript.json', name: 'appsscript', type: 'JSON' },
];
const EXPECTED_REMOTE_NAMES = SOURCE_FILES.map((file) => file.name).sort();
const API_BASE = 'https://script.googleapis.com/v1';
const AUDITED_OLD_OVERDUE_COPY = "`${late} ${late === 1 ? 'pass needs' : 'passes need'} a check`";
const AUDITED_NEW_OVERDUE_COPY = "`${late} overdue ${late === 1 ? 'pass' : 'passes'}`";
const AUDITED_REPOSITORY_FILTER_SEPARATOR = "      };\n\n      const filterPassCounts = (term) => {";
const AUDITED_HEAD_FILTER_SEPARATOR = "      };\n      const filterPassCounts = (term) => {";

function fail(message) {
  throw new Error(message);
}

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) fail(`Missing required environment value: ${name}`);
  return value;
}

function normalizeSource(source) {
  return String(source ?? '').replace(/\r\n/g, '\n').replace(/\n$/, '');
}

function digest(source) {
  return createHash('sha256').update(normalizeSource(source), 'utf8').digest('hex');
}

function canonicalFiles(files) {
  return [...(files || [])]
    .map((file) => ({
      name: String(file.name || ''),
      type: String(file.type || ''),
      source: normalizeSource(file.source),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function sameContent(left, right) {
  const a = canonicalFiles(left);
  const b = canonicalFiles(right);
  if (a.length !== b.length) return false;
  return a.every((file, index) => {
    const other = b[index];
    return file.name === other.name && file.type === other.type && file.source === other.source;
  });
}

function summarizeFiles(files) {
  return canonicalFiles(files).map((file) => ({
    name: file.name,
    type: file.type,
    bytes: Buffer.byteLength(file.source, 'utf8'),
    sha256: digest(file.source),
  }));
}

function assertExpectedFileSet(files, label) {
  const names = canonicalFiles(files).map((file) => file.name).sort();
  if (JSON.stringify(names) !== JSON.stringify(EXPECTED_REMOTE_NAMES)) {
    fail(`${label} file set is not the five-file Hall Pass release set. Expected ${EXPECTED_REMOTE_NAMES.join(', ')}; got ${names.join(', ') || '(none)'}. Refusing to overwrite Apps Script.`);
  }
}

function classifyAuditedHead(headFiles, localFiles) {
  if (sameContent(headFiles, localFiles)) {
    return { safe: true, kind: 'REPOSITORY_SOURCE' };
  }

  const head = canonicalFiles(headFiles);
  const local = canonicalFiles(localFiles);
  if (head.length !== local.length) return { safe: false, kind: 'UNKNOWN' };

  let differingFile = null;
  for (let index = 0; index < head.length; index += 1) {
    const remote = head[index];
    const repository = local[index];
    if (remote.name !== repository.name || remote.type !== repository.type) {
      return { safe: false, kind: 'UNKNOWN' };
    }
    if (remote.source !== repository.source) {
      if (differingFile) return { safe: false, kind: 'UNKNOWN' };
      differingFile = { remote, repository };
    }
  }

  if (!differingFile || differingFile.remote.name !== 'Index') {
    return { safe: false, kind: 'UNKNOWN' };
  }

  const remoteIndex = differingFile.remote.source;
  const repositoryIndex = differingFile.repository.source;
  const oldCount = remoteIndex.split(AUDITED_OLD_OVERDUE_COPY).length - 1;
  const newCount = repositoryIndex.split(AUDITED_NEW_OVERDUE_COPY).length - 1;
  if (oldCount !== 1 || newCount !== 1) {
    return { safe: false, kind: 'UNKNOWN' };
  }

  let reconciled = remoteIndex.replace(AUDITED_OLD_OVERDUE_COPY, AUDITED_NEW_OVERDUE_COPY);
  if (reconciled !== repositoryIndex) {
    const headSeparatorCount = reconciled.split(AUDITED_HEAD_FILTER_SEPARATOR).length - 1;
    const repositorySeparatorCount = repositoryIndex.split(AUDITED_REPOSITORY_FILTER_SEPARATOR).length - 1;
    if (headSeparatorCount !== 1 || repositorySeparatorCount !== 1) {
      return { safe: false, kind: 'UNKNOWN' };
    }
    reconciled = reconciled.replace(AUDITED_HEAD_FILTER_SEPARATOR, AUDITED_REPOSITORY_FILTER_SEPARATOR);
  }
  if (reconciled !== repositoryIndex) {
    return { safe: false, kind: 'UNKNOWN' };
  }

  return {
    safe: true,
    kind: 'AUDITED_EDITOR_DRAFT_RECONCILIATION',
    detail: 'Apps Script HEAD matches the tested repository source after only the previously audited overdue-pass wording correction and, when present, the exact known formatting-only blank-line restoration.',
  };
}

async function readLocalFiles() {
  const files = [];
  for (const descriptor of SOURCE_FILES) {
    const source = await readFile(path.join(SOURCE_DIR, descriptor.disk), 'utf8');
    if (!source.trim()) fail(`${descriptor.disk} is empty.`);
    if (descriptor.type === 'JSON') JSON.parse(source);
    files.push({ name: descriptor.name, type: descriptor.type, source });
  }
  assertExpectedFileSet(files, 'Repository');
  return files;
}

function parseOAuthSecret() {
  let parsed;
  try {
    parsed = JSON.parse(required('GAS_OAUTH_JSON'));
  } catch (error) {
    fail(`GAS_OAUTH_JSON is not valid JSON: ${error.message}`);
  }
  for (const field of ['client_id', 'client_secret', 'refresh_token']) {
    if (!String(parsed[field] || '').trim()) fail(`GAS_OAUTH_JSON is missing ${field}.`);
  }
  return parsed;
}

async function accessToken() {
  const oauth = parseOAuthSecret();
  const body = new URLSearchParams({
    client_id: oauth.client_id,
    client_secret: oauth.client_secret,
    refresh_token: oauth.refresh_token,
    grant_type: 'refresh_token',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    fail(`Google OAuth refresh failed (${response.status}): ${data.error_description || data.error || 'unknown error'}`);
  }
  return data.access_token;
}

async function google(token, apiPath, options = {}) {
  const response = await fetch(`${API_BASE}${apiPath}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
  }
  if (!response.ok) {
    const detail = data?.error?.message || data?.raw || response.statusText;
    fail(`Apps Script API ${options.method || 'GET'} ${apiPath} failed (${response.status}): ${detail}`);
  }
  return data;
}

function webAppEntry(deployment) {
  return (deployment.entryPoints || []).find((entry) => entry.entryPointType === 'WEB_APP' && entry.webApp);
}

function assertDeploymentSafety(deployment, deploymentId, expectedAccess, expectedExecuteAs) {
  if (deployment.deploymentId !== deploymentId) fail('Apps Script returned a different deployment ID than requested.');
  const webApp = webAppEntry(deployment);
  if (!webApp) fail('Target deployment is not a web app.');
  if (!String(webApp.webApp.url || '').includes(deploymentId)) fail('Target web-app URL does not contain the expected deployment ID.');
  const config = webApp.webApp.entryPointConfig || {};
  if (config.access !== expectedAccess) {
    fail(`Target web-app access changed or is unexpected: expected ${expectedAccess}, got ${config.access || '(missing)'}.`);
  }
  if (config.executeAs !== expectedExecuteAs) {
    fail(`Target web-app execution identity changed or is unexpected: expected ${expectedExecuteAs}, got ${config.executeAs || '(missing)'}.`);
  }
  return {
    url: webApp.webApp.url,
    access: config.access,
    executeAs: config.executeAs,
  };
}

async function writeEvidence(evidence) {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await writeFile(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
}

async function restoreAfterFailure(token, scriptId, deploymentId, before, evidence) {
  const rollback = { attempted: true, deployment: 'not-needed', head: 'not-needed' };
  try {
    if (before.deploymentMutated) {
      await google(token, `/projects/${encodeURIComponent(scriptId)}/deployments/${encodeURIComponent(deploymentId)}`, {
        method: 'PUT',
        body: JSON.stringify({ deploymentConfig: before.deployment.deploymentConfig }),
      });
      rollback.deployment = 'restored';
    }
  } catch (error) {
    rollback.deployment = `FAILED: ${error.message}`;
  }
  try {
    if (before.headMutated) {
      await google(token, `/projects/${encodeURIComponent(scriptId)}/content`, {
        method: 'PUT',
        body: JSON.stringify({ files: before.head.files }),
      });
      rollback.head = 'restored';
    }
  } catch (error) {
    rollback.head = `FAILED: ${error.message}`;
  }
  evidence.rollback = rollback;
}

async function selfTest() {
  const local = await readLocalFiles();
  const withWindowsLines = local.map((file) => ({ ...file, source: file.source.replace(/\n/g, '\r\n') }));
  if (!sameContent(local, withWindowsLines)) fail('Line-ending normalization self-test failed.');
  assertExpectedFileSet(local, 'Self-test');
  const manifest = local.find((file) => file.name === 'appsscript');
  JSON.parse(manifest.source);

  const repositoryClassification = classifyAuditedHead(local, local);
  if (!repositoryClassification.safe || repositoryClassification.kind !== 'REPOSITORY_SOURCE') {
    fail('Repository-source editor draft classification self-test failed.');
  }

  const stagedOldCopy = local.map((file) => file.name === 'Index'
    ? { ...file, source: file.source.replace(AUDITED_NEW_OVERDUE_COPY, AUDITED_OLD_OVERDUE_COPY) }
    : { ...file });
  const auditedClassification = classifyAuditedHead(stagedOldCopy, local);
  if (!auditedClassification.safe || auditedClassification.kind !== 'AUDITED_EDITOR_DRAFT_RECONCILIATION') {
    fail('Audited overdue-copy editor draft classification self-test failed.');
  }

  const stagedOldCopyAndWhitespace = local.map((file) => file.name === 'Index'
    ? {
        ...file,
        source: file.source
          .replace(AUDITED_NEW_OVERDUE_COPY, AUDITED_OLD_OVERDUE_COPY)
          .replace(AUDITED_REPOSITORY_FILTER_SEPARATOR, AUDITED_HEAD_FILTER_SEPARATOR),
      }
    : { ...file });
  const auditedWhitespaceClassification = classifyAuditedHead(stagedOldCopyAndWhitespace, local);
  if (!auditedWhitespaceClassification.safe || auditedWhitespaceClassification.kind !== 'AUDITED_EDITOR_DRAFT_RECONCILIATION') {
    fail('Audited overdue-copy plus exact whitespace editor draft classification self-test failed.');
  }

  const unknownDraft = local.map((file) => file.name === 'Index'
    ? { ...file, source: `${file.source}\n<!-- unexpected editor draft -->` }
    : { ...file });
  if (classifyAuditedHead(unknownDraft, local).safe) {
    fail('Unknown editor draft must not pass reconciliation safety classification.');
  }

  console.log('Hall Pass Apps Script deploy bridge: self-test PASS — five-file release set, manifest JSON, hashing, normalized source comparison, and audited editor-draft reconciliation verified.');
}

async function main() {
  if (process.argv.includes('--self-test')) return selfTest();

  const modeArg = process.argv.find((value) => value.startsWith('--mode='));
  const mode = modeArg ? modeArg.split('=')[1] : String(process.env.GAS_DEPLOY_MODE || 'preflight').trim();
  if (!['preflight', 'deploy'].includes(mode)) fail(`Unsupported mode: ${mode}. Use preflight or deploy.`);

  const scriptId = required('GAS_SCRIPT_ID');
  const deploymentId = required('GAS_DEPLOYMENT_ID');
  const expectedAccess = String(process.env.GAS_EXPECTED_ACCESS || 'DOMAIN').trim();
  const expectedExecuteAs = String(process.env.GAS_EXPECTED_EXECUTE_AS || 'USER_DEPLOYING').trim();
  const githubSha = String(process.env.GITHUB_SHA || 'local').trim();
  const githubRef = String(process.env.GITHUB_REF_NAME || '').trim();

  if (mode === 'deploy' && githubRef && githubRef !== 'main') fail(`Production deploys must run from main; current ref is ${githubRef}.`);

  const localFiles = await readLocalFiles();
  const token = await accessToken();
  const encodedScript = encodeURIComponent(scriptId);
  const encodedDeployment = encodeURIComponent(deploymentId);

  const project = await google(token, `/projects/${encodedScript}`);
  if (project.scriptId !== scriptId) fail('Apps Script project identity mismatch.');

  const deployment = await google(token, `/projects/${encodedScript}/deployments/${encodedDeployment}`);
  const entryBefore = assertDeploymentSafety(deployment, deploymentId, expectedAccess, expectedExecuteAs);
  const oldVersion = Number(deployment?.deploymentConfig?.versionNumber);
  if (!Number.isInteger(oldVersion) || oldVersion < 1) fail('Target deployment does not point to a numbered version.');

  const head = await google(token, `/projects/${encodedScript}/content`);
  const deployedContent = await google(token, `/projects/${encodedScript}/content?versionNumber=${oldVersion}`);
  assertExpectedFileSet(head.files, 'Apps Script HEAD');
  assertExpectedFileSet(deployedContent.files, `Apps Script deployed version ${oldVersion}`);

  let headDisposition = 'DEPLOYED_VERSION';
  if (!sameContent(head.files, deployedContent.files)) {
    const classification = classifyAuditedHead(head.files, localFiles);
    if (!classification.safe) {
      fail('Apps Script HEAD contains an unpublished editor change that is neither the exact tested repository source nor the specifically audited UI draft. Refusing to overwrite it.');
    }
    headDisposition = classification.kind;
  }

  const evidence = {
    status: mode === 'preflight' ? 'PREFLIGHT_OK' : 'STARTED',
    mode,
    timestamp: new Date().toISOString(),
    githubSha,
    scriptId,
    deploymentId,
    projectTitle: project.title,
    headDisposition,
    deploymentBefore: {
      versionNumber: oldVersion,
      url: entryBefore.url,
      access: entryBefore.access,
      executeAs: entryBefore.executeAs,
      updateTime: deployment.updateTime,
    },
    repositoryFiles: summarizeFiles(localFiles),
    remoteHeadBefore: summarizeFiles(head.files),
  };
  await writeEvidence(evidence);

  if (mode === 'preflight') {
    const draftNote = headDisposition === 'DEPLOYED_VERSION'
      ? 'no unpublished editor draft'
      : headDisposition === 'REPOSITORY_SOURCE'
        ? 'editor HEAD already equals the exact tested repository source'
        : 'the editor/repository differences are limited to the specifically audited overdue-pass wording regression and known formatting-only blank line, which deploy will replace with tested repository source';
    console.log(`Preflight PASS — project ${project.title}; deployment ${deploymentId}; current version ${oldVersion}; URL and domain/execute-as settings preserved; ${draftNote}.`);
    return;
  }

  const before = { head, deployment, headMutated: false, deploymentMutated: false };
  try {
    await google(token, `/projects/${encodedScript}/content`, {
      method: 'PUT',
      body: JSON.stringify({ files: localFiles }),
    });
    before.headMutated = true;

    const readBack = await google(token, `/projects/${encodedScript}/content`);
    assertExpectedFileSet(readBack.files, 'Apps Script read-back HEAD');
    if (!sameContent(localFiles, readBack.files)) fail('Apps Script source read-back did not match the exact tested repository source.');

    const description = `GrantDesk Hall Pass ${githubSha.slice(0, 12)} ${new Date().toISOString()}`;
    const version = await google(token, `/projects/${encodedScript}/versions`, {
      method: 'POST',
      body: JSON.stringify({ description }),
    });
    const versionNumber = Number(version.versionNumber);
    if (!Number.isInteger(versionNumber) || versionNumber <= oldVersion) fail(`Google returned an invalid new version number: ${version.versionNumber}`);

    const oldConfig = deployment.deploymentConfig || {};
    await google(token, `/projects/${encodedScript}/deployments/${encodedDeployment}`, {
      method: 'PUT',
      body: JSON.stringify({
        deploymentConfig: {
          scriptId,
          versionNumber,
          manifestFileName: oldConfig.manifestFileName || 'appsscript',
          description,
        },
      }),
    });
    before.deploymentMutated = true;

    const after = await google(token, `/projects/${encodedScript}/deployments/${encodedDeployment}`);
    const entryAfter = assertDeploymentSafety(after, deploymentId, expectedAccess, expectedExecuteAs);
    if (entryAfter.url !== entryBefore.url) fail(`Stable Hall Pass URL changed unexpectedly: ${entryBefore.url} -> ${entryAfter.url}`);
    if (Number(after?.deploymentConfig?.versionNumber) !== versionNumber) fail('Deployment did not advance to the newly created Apps Script version.');

    evidence.status = 'DEPLOYED';
    evidence.deploymentAfter = {
      versionNumber,
      url: entryAfter.url,
      access: entryAfter.access,
      executeAs: entryAfter.executeAs,
      updateTime: after.updateTime,
    };
    evidence.remoteHeadAfter = summarizeFiles(readBack.files);
    await writeEvidence(evidence);

    console.log(`DEPLOYED — Apps Script version ${versionNumber}; existing deployment ID and URL preserved; access=${entryAfter.access}; executeAs=${entryAfter.executeAs}.`);
  } catch (error) {
    evidence.status = 'FAILED';
    evidence.error = error.message;
    await restoreAfterFailure(token, scriptId, deploymentId, before, evidence);
    await writeEvidence(evidence);
    throw error;
  }
}

main().catch((error) => {
  console.error(`Hall Pass Apps Script deploy bridge FAILED: ${error.message}`);
  process.exitCode = 1;
});
