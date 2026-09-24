// Publishes the Hall Pass source into the blank classroom template other
// teachers copy. It creates or updates a container-bound Apps Script project
// on a template spreadsheet the school account owns. It never touches the
// production Hall Pass project or deployment, and never creates a deployment:
// each teacher deploys their own copy.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const SOURCE_DIR = path.join(process.cwd(), 'apps-script', 'hall-pass');
const SOURCE_FILES = [
  { disk: 'Code.gs', name: 'Code', type: 'SERVER_JS' },
  { disk: 'Index.html', name: 'Index', type: 'HTML' },
  { disk: 'ReleaseChecks.gs', name: 'ReleaseChecks', type: 'SERVER_JS' },
  { disk: 'ReleaseCheck.html', name: 'ReleaseCheck', type: 'HTML' },
  { disk: 'appsscript.json', name: 'appsscript', type: 'JSON' },
];
const API_BASE = 'https://script.googleapis.com/v1';
const ID_PATTERN = /^[A-Za-z0-9_-]{20,120}$/;

const fail = (message) => { throw new Error(message); };
const env = (name) => String(process.env[name] || '').trim();

async function readLocalFiles() {
  const files = [];
  for (const descriptor of SOURCE_FILES) {
    const source = await readFile(path.join(SOURCE_DIR, descriptor.disk), 'utf8');
    if (!source.trim()) fail(`${descriptor.disk} is empty.`);
    if (descriptor.type === 'JSON') JSON.parse(source);
    files.push({ name: descriptor.name, type: descriptor.type, source });
  }
  return files;
}

async function accessToken() {
  let oauth;
  try { oauth = JSON.parse(env('GAS_OAUTH_JSON')); } catch { fail('GAS_OAUTH_JSON is missing or not valid JSON.'); }
  for (const field of ['client_id', 'client_secret', 'refresh_token']) {
    if (!String(oauth[field] || '').trim()) fail(`GAS_OAUTH_JSON is missing ${field}.`);
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: oauth.client_id,
      client_secret: oauth.client_secret,
      refresh_token: oauth.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) fail(`Google OAuth refresh failed (${response.status}): ${data.error_description || data.error || 'unknown error'}`);
  return data.access_token;
}

async function google(token, apiPath, options = {}) {
  const response = await fetch(`${API_BASE}${apiPath}`, {
    ...options,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
  const text = await response.text();
  let data = {};
  if (text) { try { data = JSON.parse(text); } catch { data = { raw: text }; } }
  if (!response.ok) fail(`Apps Script API ${options.method || 'GET'} ${apiPath} failed (${response.status}): ${data?.error?.message || data?.raw || response.statusText}`);
  return data;
}

async function main() {
  const productionScriptId = env('GAS_SCRIPT_ID');
  const sheetId = env('TEMPLATE_SHEET_ID');
  let scriptId = env('TEMPLATE_SCRIPT_ID');
  if (!productionScriptId) fail('GAS_SCRIPT_ID is required so the production project can be refused.');
  if (!scriptId && !sheetId) fail('Provide the template spreadsheet ID (first run) or the template script ID (updates).');
  if (sheetId && !ID_PATTERN.test(sheetId)) fail('The template spreadsheet ID does not look like a Google file ID.');
  if (scriptId && !ID_PATTERN.test(scriptId)) fail('The template script ID does not look like an Apps Script project ID.');
  if (scriptId === productionScriptId) fail('Refusing to overwrite the production Hall Pass project with the template.');

  const files = await readLocalFiles();
  const token = await accessToken();

  if (!scriptId) {
    const created = await google(token, '/projects', {
      method: 'POST',
      body: JSON.stringify({ title: 'Hall Pass', parentId: sheetId }),
    });
    scriptId = String(created.scriptId || '');
    if (!scriptId) fail('Google did not return a script ID for the new template project.');
    if (scriptId === productionScriptId) fail('Google returned the production project ID. Stopping.');
    console.log(`CREATED template project ${scriptId} bound to spreadsheet ${sheetId}.`);
  }

  const project = await google(token, `/projects/${scriptId}`);
  if (sheetId && project.parentId && project.parentId !== sheetId) {
    fail(`Template project ${scriptId} is bound to ${project.parentId}, not ${sheetId}. Nothing was changed.`);
  }
  if (!project.parentId) fail('That script is not bound to a spreadsheet, so copies would not carry it. Nothing was changed.');

  await google(token, `/projects/${scriptId}/content`, { method: 'PUT', body: JSON.stringify({ files }) });
  const readBack = await google(token, `/projects/${scriptId}/content`);
  const remote = new Map((readBack.files || []).map((file) => [file.name, String(file.source || '').replace(/\r\n/g, '\n')]));
  for (const file of files) {
    if (remote.get(file.name) !== file.source.replace(/\r\n/g, '\n')) fail(`Read-back mismatch for ${file.name}.`);
  }

  const summary = [
    `PUBLISHED — Hall Pass template source updated and read back (${files.length} files).`,
    `Template script ID: ${scriptId}`,
    `Template spreadsheet: https://docs.google.com/spreadsheets/d/${project.parentId}/edit`,
    `Teacher copy link: https://docs.google.com/spreadsheets/d/${project.parentId}/copy`,
  ].join('\n');
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Hall Pass classroom template\n\n\`\`\`\n${summary}\n\`\`\`\n`);
  }
}

main().catch((error) => {
  console.error(`Hall Pass template publish FAILED: ${error.message}`);
  process.exitCode = 1;
});
