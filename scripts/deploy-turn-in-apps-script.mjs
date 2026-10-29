// Updates the existing Turn In web app to apps-script/turn-in/Code.gs.
// Replaces only Code. The live manifest (web app access settings) is sent back unchanged,
// so the stable /exec URL, access and execute-as settings stay exactly as they are.
// Refuses if the editor holds unpublished changes or an unexpected file set.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const API = 'https://script.googleapis.com/v1';

function fail(message) { throw new Error(message); }
function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) fail(`Missing required environment value: ${name}`);
  return value;
}
const norm = (text) => String(text ?? '').replace(/\r\n/g, '\n').replace(/\n$/, '');
const canon = (files) => [...(files || [])].map((f) => ({ name: f.name, type: f.type, source: norm(f.source) })).sort((a, b) => a.name.localeCompare(b.name));
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

async function accessToken() {
  const oauth = JSON.parse(required('GAS_OAUTH_JSON'));
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: oauth.client_id, client_secret: oauth.client_secret, refresh_token: oauth.refresh_token, grant_type: 'refresh_token' }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) fail(`Google OAuth refresh failed (${response.status}): ${data.error_description || data.error || 'unknown'}`);
  return data.access_token;
}

async function google(token, apiPath, options = {}) {
  const response = await fetch(`${API}${apiPath}`, { ...options, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) fail(`Apps Script API ${options.method || 'GET'} ${apiPath} failed (${response.status}): ${data?.error?.message || data.raw || response.statusText}`);
  return data;
}

function webApp(deployment) {
  const entry = (deployment.entryPoints || []).find((e) => e.entryPointType === 'WEB_APP' && e.webApp);
  if (!entry) fail('Target deployment is not a web app.');
  return entry.webApp;
}

async function main() {
  const mode = String(process.env.GAS_DEPLOY_MODE || 'preflight').trim();
  if (!['preflight', 'deploy'].includes(mode)) fail(`Unsupported mode: ${mode}`);
  const scriptId = required('TURN_IN_SCRIPT_ID');
  const deploymentId = required('TURN_IN_DEPLOYMENT_ID');
  const code = await readFile(path.join(process.cwd(), 'apps-script', 'turn-in', 'Code.gs'), 'utf8');
  const version = (code.match(/const TI_VERSION = '([^']+)'/) || [])[1];
  if (!version) fail('Code.gs has no TI_VERSION.');

  const token = await accessToken();
  const s = encodeURIComponent(scriptId);
  const d = encodeURIComponent(deploymentId);
  const deployment = await google(token, `/projects/${s}/deployments/${d}`);
  const before = webApp(deployment);
  const oldVersion = Number(deployment?.deploymentConfig?.versionNumber);
  if (!Number.isInteger(oldVersion)) fail('Deployment does not point to a numbered version.');

  const head = await google(token, `/projects/${s}/content`);
  const live = await google(token, `/projects/${s}/content?versionNumber=${oldVersion}`);
  const names = canon(head.files).map((f) => f.name).sort().join(',');
  if (names !== ['Code', 'appsscript'].sort().join(',')) fail(`Unexpected Turn In file set: ${names}. Refusing to overwrite.`);
  const newFiles = canon(head.files).map((f) => (f.name === 'Code' ? { ...f, source: code } : f));
  if (!same(head.files, live.files) && !same(head.files, newFiles)) fail('The Turn In editor has unpublished changes. Refusing to overwrite them.');
  console.log(`Preflight OK: ${deployment.deploymentConfig.description || ''} version ${oldVersion}, ${before.url}, access ${before.access}, execute as ${before.executeAs}.`);
  if (mode === 'preflight') return;

  await google(token, `/projects/${s}/content`, { method: 'PUT', body: JSON.stringify({ files: newFiles }) });
  const readBack = await google(token, `/projects/${s}/content`);
  if (!same(readBack.files, newFiles)) fail('Source read-back did not match.');
  const created = await google(token, `/projects/${s}/versions`, { method: 'POST', body: JSON.stringify({ description: `Turn In ${version}` }) });
  const versionNumber = Number(created.versionNumber);
  if (!(versionNumber > oldVersion)) fail(`Invalid new version ${created.versionNumber}.`);
  try {
    const updated = await google(token, `/projects/${s}/deployments/${d}`, {
      method: 'PUT',
      body: JSON.stringify({ deploymentConfig: { scriptId, versionNumber, manifestFileName: deployment.deploymentConfig.manifestFileName || 'appsscript', description: `Turn In ${version}` } }),
    });
    const after = webApp(updated);
    if (after.url !== before.url || after.access !== before.access || after.executeAs !== before.executeAs) fail('Web app URL or access changed.');
  } catch (error) {
    await google(token, `/projects/${s}/deployments/${d}`, {
      method: 'PUT',
      body: JSON.stringify({ deploymentConfig: { scriptId, versionNumber: oldVersion, manifestFileName: deployment.deploymentConfig.manifestFileName || 'appsscript', description: deployment.deploymentConfig.description || '' } }),
    }).catch(() => {});
    throw error;
  }

  for (let i = 0; i < 20; i += 1) {
    const health = await fetch(before.url, { redirect: 'follow' }).then((r) => r.json()).catch(() => ({}));
    if (health.version === version) { console.log(`Deployed version ${versionNumber}: ${JSON.stringify(health)}`); return; }
    await new Promise((r) => setTimeout(r, 3000));
  }
  fail(`Deployed version ${versionNumber}, but /exec did not report ${version} yet.`);
}

main().catch((error) => { console.error(error.message); process.exit(1); });
