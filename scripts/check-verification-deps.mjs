import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Astro offers to install missing check dependencies. Fail before that prompt
// so verification cannot hang or modify package files, even outside CI.
const requireFromProject = createRequire(resolve(process.cwd(), 'package.json'));
const unavailable = [];
for (const name of ['@astrojs/check', 'typescript']) {
  try {
    await import(pathToFileURL(requireFromProject.resolve(name)).href);
  } catch {
    unavailable.push(name);
  }
}
if (unavailable.length) {
  console.error(`Verification dependencies unavailable: ${unavailable.join(', ')}. Run npm install --include=dev (npm.cmd in PowerShell), then retry. No installation was attempted.`);
  process.exitCode = 1;
}
