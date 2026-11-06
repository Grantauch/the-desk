import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const python = process.env.CODEX_PRIMARY_RUNTIME_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const result = spawnSync(python, [fileURLToPath(new URL('./check-hall-pass-publication.py', import.meta.url))], { stdio: 'inherit' });
if (result.error) console.error('Hall Pass publication guard could not run; refusing release.');
process.exitCode = result.status ?? 1;
