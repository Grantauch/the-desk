import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isPublicResource } from '../src/lib/public-resources.js';
import { validatePublicResources } from './validate-public-resources.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function makePublicResources(fullInventory, privateMaterials) {
  // Export only the public catalog schema, never extra private authoring fields.
  const resources = fullInventory.resources.filter(isPublicResource)
    .map(({ id, course, unitTopic, name, type, onWebsite, href, status }) => ({
      id, course, unitTopic, name, type, onWebsite, href, ...(status === undefined ? {} : { status }),
    }));
  const catalog = {
    source: 'the-desk-public-resource-catalog',
    resourceCount: resources.length,
    linkedCount: resources.filter((resource) => typeof resource.href === 'string' && resource.href.trim()).length,
    resources,
  };
  const approvedIds = new Set(resources.map((resource) => resource.id));
  const materials = structuredClone(privateMaterials);
  for (const units of Object.values(materials.courses || {})) {
    for (const [unit, ids] of Object.entries(units)) {
      if (!Array.isArray(ids)) throw new Error('Private unit assignments must be arrays. No catalog files were written.');
      units[unit] = ids.filter((id) => approvedIds.has(id));
    }
  }
  const errors = validatePublicResources(catalog, materials);
  if (errors.length) throw new Error(`Resource sync validation failed. No catalog files were written.\n${errors.join('\n')}`);
  return { catalog, materials };
}

export function syncPublicResources(projectRoot = root) {
  const data = path.join(projectRoot, 'src', 'data');
  // Validate both outputs before authoring. Private source files stay unchanged.
  const inventory = JSON.parse(readFileSync(path.join(data, 'resources.private.json'), 'utf8'));
  const privateMaterials = JSON.parse(readFileSync(path.join(data, 'unit-materials.private.json'), 'utf8'));
  const { catalog, materials } = makePublicResources(inventory, privateMaterials);
  writeFileSync(path.join(data, 'resources.json'), `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  writeFileSync(path.join(data, 'unit-materials.json'), `${JSON.stringify(materials, null, 2)}\n`, 'utf8');
  return catalog;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const catalog = syncPublicResources();
    console.log(`Public catalog: ${catalog.resourceCount} approved resources / ${catalog.linkedCount} links. Private sources unchanged.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
