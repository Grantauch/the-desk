import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export function filesBelow(directory) {
  return readdirSync(directory, {withFileTypes:true}).flatMap(entry => entry.isDirectory()
    ? filesBelow(join(directory, entry.name)) : [join(directory, entry.name)]).sort();
}
export function pondSourceHash(root) {
  const directory = join(root, 'apps/pond');
  const files = [...filesBelow(join(directory, 'src')), ...['index.html','favicon.svg','og.jpg','package.json','package-lock.json','tsconfig.json','vite.config.ts','publish.mjs'].map(name => join(directory, name))];
  const hash = createHash('sha256');
  for (const file of files.sort()) hash.update(relative(root, file).replaceAll('\\','/')).update('\0').update(readFileSync(file)).update('\0');
  return hash.digest('hex');
}
