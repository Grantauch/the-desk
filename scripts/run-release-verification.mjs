import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { classifyRelease, verificationScriptFor } from './release-lane.mjs';

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const parseArgs = argv => {
  const options = { headRef: 'HEAD', index: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--base') options.baseRef = argv[++i];
    else if (arg === '--head') options.headRef = argv[++i];
    else if (arg === '--index') options.index = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
};

export function inferBaseRef(env = process.env) {
  if (env.GRANTDESK_RELEASE_BASE) return env.GRANTDESK_RELEASE_BASE;
  if (env.CACHED_COMMIT_REF && /^[0-9a-f]{40}$/i.test(env.CACHED_COMMIT_REF)) return env.CACHED_COMMIT_REF;
  return null;
}

export function runReleaseVerification({ projectRoot = resolve('.'), baseRef, headRef = 'HEAD', index = false } = {}) {
  const classification = classifyRelease({ projectRoot, baseRef, headRef, index });
  const script = verificationScriptFor(classification);
  console.log(`Release verification lane: ${classification.mode === 'storyhub' ? 'STORYHUB FAST' : 'FULL'}`);
  console.log(classification.reason);
  if (classification.routes.length) console.log(`Focused browser routes: ${classification.routes.join(', ')}`);
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  run(npm, ['run', script], { cwd: projectRoot });
  return classification;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const baseRef = options.baseRef || inferBaseRef();
    runReleaseVerification({ projectRoot: resolve('.'), ...options, baseRef });
  } catch (error) {
    console.error(`Release verification failed closed: ${error.message}`);
    process.exitCode = 1;
  }
}
