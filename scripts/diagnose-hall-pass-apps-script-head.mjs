import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const API_BASE = 'https://script.googleapis.com/v1';
const SOURCE_FILES = [
  { disk: 'Code.gs', name: 'Code', type: 'SERVER_JS' },
  { disk: 'Index.html', name: 'Index', type: 'HTML' },
  { disk: 'ReleaseChecks.gs', name: 'ReleaseChecks', type: 'SERVER_JS' },
  { disk: 'ReleaseCheck.html', name: 'ReleaseCheck', type: 'HTML' },
  { disk: 'appsscript.json', name: 'appsscript', type: 'JSON' },
];

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required environment value: ${name}`);
  return value;
}

function normalize(source) {
  return String(source ?? '').replace(/\r\n/g, '\n').replace(/\n$/, '');
}

function sha(source) {
  return createHash('sha256').update(normalize(source), 'utf8').digest('hex');
}

function byName(files) {
  return new Map((files || []).map((file) => [String(file.name || ''), {
    name: String(file.name || ''),
    type: String(file.type || ''),
    source: normalize(file.source),
  }]));
}

async function token() {
  const oauth = JSON.parse(required('GAS_OAUTH_JSON'));
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
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(`Google OAuth refresh failed (${response.status}).`);
  return data.access_token;
}

async function google(accessToken, apiPath) {
  const response = await fetch(`${API_BASE}${apiPath}`, {
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Apps Script API request failed (${response.status}).`);
  return data;
}

async function localFiles() {
  const root = path.join(process.cwd(), 'apps-script', 'hall-pass');
  const files = [];
  for (const file of SOURCE_FILES) {
    files.push({
      name: file.name,
      type: file.type,
      source: await readFile(path.join(root, file.disk), 'utf8'),
    });
  }
  return files;
}

function relation(left, right) {
  if (!left || !right) return 'missing';
  return left.type === right.type && left.source === right.source ? 'MATCH' : 'DIFF';
}

function info(file) {
  if (!file) return { bytes: 0, lines: 0, sha256: '(missing)' };
  return {
    bytes: Buffer.byteLength(file.source, 'utf8'),
    lines: file.source ? file.source.split('\n').length : 0,
    sha256: sha(file.source),
  };
}

async function main() {
  const scriptId = required('GAS_SCRIPT_ID');
  const deploymentId = required('GAS_DEPLOYMENT_ID');
  const accessToken = await token();
  const encodedScript = encodeURIComponent(scriptId);
  const encodedDeployment = encodeURIComponent(deploymentId);

  const deployment = await google(accessToken, `/projects/${encodedScript}/deployments/${encodedDeployment}`);
  const versionNumber = Number(deployment?.deploymentConfig?.versionNumber);
  const head = await google(accessToken, `/projects/${encodedScript}/content`);
  const deployed = await google(accessToken, `/projects/${encodedScript}/content?versionNumber=${versionNumber}`);
  const repository = await localFiles();

  const h = byName(head.files);
  const d = byName(deployed.files);
  const r = byName(repository);

  console.log('\n=== HALL PASS UNPUBLISHED HEAD DIAGNOSTIC ===');
  console.log(`Currently deployed Apps Script version: ${versionNumber}`);
  console.log('This diagnostic prints hashes/size/equality only; it does not expose source text or secrets.');

  for (const descriptor of SOURCE_FILES) {
    const name = descriptor.name;
    const headFile = h.get(name);
    const deployedFile = d.get(name);
    const repoFile = r.get(name);
    const headInfo = info(headFile);
    const deployedInfo = info(deployedFile);
    const repoInfo = info(repoFile);
    console.log(`\n${descriptor.disk}`);
    console.log(`  HEAD vs deployed:   ${relation(headFile, deployedFile)}`);
    console.log(`  HEAD vs repository: ${relation(headFile, repoFile)}`);
    console.log(`  HEAD       ${headInfo.lines} lines / ${headInfo.bytes} bytes / ${headInfo.sha256}`);
    console.log(`  Deployed   ${deployedInfo.lines} lines / ${deployedInfo.bytes} bytes / ${deployedInfo.sha256}`);
    console.log(`  Repository ${repoInfo.lines} lines / ${repoInfo.bytes} bytes / ${repoInfo.sha256}`);
  }

  console.log('\n=== END DIAGNOSTIC ===\n');
}

main().catch((error) => {
  console.error(`Hall Pass HEAD diagnostic FAILED: ${error.message}`);
  process.exitCode = 1;
});
