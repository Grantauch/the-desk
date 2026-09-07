import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const SCOPES = [
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.deployments',
];
const PORT = 53682;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;

function fail(message) {
  throw new Error(message);
}

function arg(name) {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : '';
}

async function credentialsFromFile(filePath) {
  const absolute = path.resolve(filePath);
  const raw = JSON.parse(await readFile(absolute, 'utf8'));
  const credentials = raw.installed || raw.web;
  if (!credentials?.client_id || !credentials?.client_secret) {
    fail('OAuth credential file must contain an installed or web client_id and client_secret. A Desktop app OAuth client is recommended.');
  }
  return { client_id: credentials.client_id, client_secret: credentials.client_secret };
}

async function exchangeCode(credentials, code) {
  const body = new URLSearchParams({
    client_id: credentials.client_id,
    client_secret: credentials.client_secret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) fail(`Google token exchange failed (${response.status}): ${data.error_description || data.error || 'unknown error'}`);
  if (!data.refresh_token) fail('Google did not return a refresh token. Revoke the test authorization for this OAuth client and run again so Google presents consent with offline access.');
  return data;
}

async function main() {
  const credentialPath = arg('credentials');
  if (!credentialPath) {
    console.log('Usage: node scripts/get-hall-pass-google-oauth-token.mjs --credentials "C:\\path\\to\\client_secret.json"');
    process.exitCode = 2;
    return;
  }

  const credentials = await credentialsFromFile(credentialPath);
  const state = crypto.randomUUID();
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.searchParams.set('client_id', credentials.client_id);
  auth.searchParams.set('redirect_uri', REDIRECT_URI);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('scope', SCOPES.join(' '));
  auth.searchParams.set('access_type', 'offline');
  auth.searchParams.set('prompt', 'consent');
  auth.searchParams.set('include_granted_scopes', 'true');
  auth.searchParams.set('state', state);

  console.log('\nONE-TIME GRANTDESK GOOGLE AUTHORIZATION');
  console.log('1. Keep this terminal open.');
  console.log('2. Open the URL below in a browser signed in as the school account that owns/deploys Hall Pass.');
  console.log('3. Approve only Apps Script project + deployment management.');
  console.log('\n' + auth.toString() + '\n');

  const code = await new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      try {
        const url = new URL(request.url, REDIRECT_URI);
        if (url.pathname !== '/callback') {
          response.writeHead(404).end('Not found');
          return;
        }
        if (url.searchParams.get('state') !== state) {
          response.writeHead(400).end('State mismatch. Close this tab.');
          server.close();
          reject(new Error('OAuth state mismatch.'));
          return;
        }
        const error = url.searchParams.get('error');
        if (error) {
          response.writeHead(400).end('Authorization was not completed. You can close this tab.');
          server.close();
          reject(new Error(`Google authorization failed: ${error}`));
          return;
        }
        const returnedCode = url.searchParams.get('code');
        if (!returnedCode) {
          response.writeHead(400).end('Missing authorization code.');
          return;
        }
        response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('GrantDesk authorization received. Return to the terminal.');
        server.close();
        resolve(returnedCode);
      } catch (error) {
        reject(error);
      }
    });
    server.on('error', reject);
    server.listen(PORT, '127.0.0.1');
  });

  const token = await exchangeCode(credentials, code);
  const secret = JSON.stringify({
    client_id: credentials.client_id,
    client_secret: credentials.client_secret,
    refresh_token: token.refresh_token,
  });

  console.log('\nSUCCESS. Do not paste this value into ChatGPT, email, a document, or a repository file.');
  console.log('In GitHub, create the protected environment secret named GAS_OAUTH_JSON and paste the following entire one-line value:');
  console.log('\n' + secret + '\n');
  console.log('After saving that secret, delete the downloaded OAuth credential JSON if you do not otherwise need it.');
}

main().catch((error) => {
  console.error(`OAuth setup FAILED: ${error.message}`);
  process.exitCode = 1;
});
