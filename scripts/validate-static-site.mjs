import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';

const distRoot = resolve(process.cwd(), 'dist');

const walk = async (folder) => {
  const entries = await readdir(folder, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return nested.flat();
};

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const files = await walk(distRoot);
const htmlFiles = files.filter((file) => extname(file).toLowerCase() === '.html');
const failures = [];
let references = 0;

for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, 'utf8');
  const attributes = [...html.matchAll(/\b(?:href|src)=(?:"([^"]+)"|'([^']+)')/gi)];

  for (const match of attributes) {
    const raw = (match[1] ?? match[2] ?? '').trim();
    if (!raw || raw.startsWith('#') || /^(?:https?:|mailto:|tel:|data:|blob:|javascript:|\/\/)/i.test(raw)) continue;
    references += 1;

    let clean;
    try {
      clean = decodeURIComponent(raw.split('#')[0].split('?')[0]);
    } catch {
      failures.push(`${relative(distRoot, htmlFile)} -> malformed URL: ${raw}`);
      continue;
    }

    if (!clean) continue;
    const target = clean.startsWith('/')
      ? resolve(distRoot, `.${clean}`)
      : resolve(dirname(htmlFile), clean);
    if (!target.startsWith(distRoot + sep) && target !== distRoot) {
      failures.push(`${relative(distRoot, htmlFile)} -> escaped build root: ${raw}`);
      continue;
    }

    const candidates = [target];
    if (clean.endsWith('/')) candidates.push(join(target, 'index.html'));
    if (!extname(clean)) candidates.push(`${target}.html`, join(target, 'index.html'));
    if (clean === '/404/' || clean === '/404') candidates.push(join(distRoot, '404.html'));
    if (!(await Promise.all(candidates.map(exists))).some(Boolean)) {
      failures.push(`${relative(distRoot, htmlFile)} -> missing: ${raw}`);
    }
  }
}

if (failures.length) {
  console.error(`Static site validation: FAIL (${failures.length} missing or unsafe references)`);
  failures.slice(0, 100).forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Static site validation: PASS — ${htmlFiles.length} HTML files, ${references} local references checked`);
}
