import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const privatePath = path.join(root, 'src', 'data', 'resources.private.json');
const publicPath = path.join(root, 'src', 'data', 'resources.json');
const privateMaterialsPath = path.join(root, 'src', 'data', 'unit-materials.private.json');
const materialsPath = path.join(root, 'src', 'data', 'unit-materials.json');

const fullInventory = JSON.parse(readFileSync(privatePath, 'utf8'));
fullInventory.resourceCount = fullInventory.resources.length;
fullInventory.linkedCount = fullInventory.resources.filter((resource) => Boolean(resource.href)).length;
writeFileSync(privatePath, `${JSON.stringify(fullInventory, null, 2)}\n`, 'utf8');

const resources = fullInventory.resources.filter(
  (resource) => resource.onWebsite === true && resource.href && resource.status !== 'restricted',
);
const publicInventory = {
  source: 'the-desk-public-resource-catalog',
  resourceCount: resources.length,
  linkedCount: resources.filter((resource) => Boolean(resource.href)).length,
  resources,
};
writeFileSync(publicPath, `${JSON.stringify(publicInventory, null, 2)}\n`, 'utf8');

const approvedIds = new Set(resources.map((resource) => resource.id));
const materials = JSON.parse(readFileSync(privateMaterialsPath, 'utf8'));
for (const units of Object.values(materials.courses || {})) {
  for (const [unit, ids] of Object.entries(units)) {
    units[unit] = Array.isArray(ids) ? ids.filter((id) => approvedIds.has(id)) : [];
  }
}
writeFileSync(materialsPath, `${JSON.stringify(materials, null, 2)}\n`, 'utf8');

console.log(`Private inventory: ${fullInventory.resourceCount} resources / ${fullInventory.linkedCount} links`);
console.log(`Public catalog: ${publicInventory.resourceCount} approved resources`);
