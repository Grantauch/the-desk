import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const policyPath = fileURLToPath(new URL('../../distribution/hall-pass-teacher-kit/VERSION.json', import.meta.url));
const confirmations = { 'hall-pass': 'DEPLOY HALL PASS', 'turn-in': 'DEPLOY TURN IN' };

// This is a necessary technical gate, not proof of district/owner approval on #319.
export function checkProductionAuthorization({ service, mode, policy, env, event }) {
  if (!Object.hasOwn(confirmations, service) || !['preflight', 'deploy'].includes(mode)) {
    throw new Error('Production approval guard: unsupported service or mode.');
  }
  if (mode === 'preflight') return;
  const refuse = message => { throw new Error(`Production approval guard: ${message}`); };
  if (env.GITHUB_REPOSITORY !== 'Grantauch/the-desk' || env.GITHUB_REF !== 'refs/heads/main') {
    refuse('deploy requires Grantauch/the-desk on main.');
  }
  if (env.GITHUB_ACTOR !== 'Grantauch' || env.GITHUB_TRIGGERING_ACTOR !== 'Grantauch') {
    refuse('deploy requires the owner, including the actor requesting a rerun.');
  }
  if (env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    if (event?.inputs?.mode !== 'deploy' || event?.inputs?.confirmation !== confirmations[service]) {
      refuse(`manual deploy requires exact confirmation: ${confirmations[service]}.`);
    }
  } else if (env.GITHUB_EVENT_NAME === 'issue_comment') {
    if (event?.action !== 'created' || event?.issue?.number !== 28 ||
        event?.comment?.user?.login !== 'Grantauch' || event?.comment?.body !== `/deploy-${service}`) {
      refuse('deploy requires the exact owner-only release-control comment on #28.');
    }
  } else {
    refuse('deploy requires an owner workflow_dispatch or issue_comment.');
  }
  if (policy?.productionCutoverAuthorized !== true) {
    refuse('productionCutoverAuthorized is not true; the #329 cutover gate remains closed.');
  }
}

export async function assertProductionAuthorization(service, mode) {
  if (mode === 'preflight') return;
  // Read all evidence before credentials, source reads, OAuth, or network access.
  let policy, event;
  try {
    policy = JSON.parse(await readFile(policyPath, 'utf8'));
    event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  } catch {
    throw new Error('Production approval guard: missing or invalid policy/event evidence.');
  }
  checkProductionAuthorization({ service, mode, policy, env: process.env, event });
}
