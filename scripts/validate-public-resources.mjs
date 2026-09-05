import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isPublicResource } from '../src/lib/public-resources.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;

// Shape checks only. External reachability belongs to live-data:check;
// existence of local routes belongs to site:validate after build.
export function isPublicHref(href) {
  if (!isText(href) || /[\s\\\u0000-\u001f\u007f]/.test(href)) return false;
  let decoded;
  try { decoded = decodeURIComponent(href); } catch { return false; }
  if (/[\\\u0000-\u001f\u007f]/.test(decoded)) return false;
  if (href.startsWith('/')) {
    return !decoded.startsWith('//') && !decoded.split(/[/?#]/).includes('..');
  }
  try {
    const url = new URL(href);
    return href.startsWith('https://') && url.protocol === 'https:'
      && Boolean(url.hostname) && !url.username && !url.password
      && url.hostname !== 'localhost' && !url.hostname.endsWith('.localhost');
  } catch { return false; }
}

export function validatePublicResources(catalog, materials) {
  const errors = [];
  const fail = (message) => errors.push(message);
  if (!isObject(catalog) || !Array.isArray(catalog.resources)) {
    return ['catalog.resources must be an array'];
  }
  const resources = catalog.resources;
  if (catalog.source !== 'the-desk-public-resource-catalog') fail('catalog.source must identify the public resource catalog');
  if (resources.length === 0) fail('public catalog must not be empty');
  if (!Number.isInteger(catalog.resourceCount) || catalog.resourceCount !== resources.length) {
    fail(`resourceCount must equal ${resources.length}`);
  }
  const linkedCount = resources.filter((item) => isObject(item) && isText(item.href)).length;
  if (!Number.isInteger(catalog.linkedCount) || catalog.linkedCount !== linkedCount) {
    fail(`linkedCount must equal ${linkedCount}`);
  }
  const byId = new Map();
  resources.forEach((resource, index) => {
    const label = `resources[${index}]`;
    if (!isObject(resource)) { fail(`${label} must be an object`); return; }
    for (const field of ['id', 'course', 'unitTopic', 'name', 'type']) {
      if (!isText(resource[field])) fail(`${label}.${field} is required and must be non-empty text`);
    }
    if (isText(resource.id)) {
      if (byId.has(resource.id)) fail(`${label}: duplicate resource id ${resource.id}`);
      else byId.set(resource.id, resource);
    }
    if (resource.onWebsite !== true) fail(`${label}.onWebsite must be true`);
    if (resource.status === 'restricted') fail(`${label}: restricted resources cannot be public`);
    if (resource.status !== undefined && !['coming-soon', 'restricted'].includes(resource.status)) {
      fail(`${label}.status must be omitted or coming-soon`);
    }
    if (!isPublicResource(resource)) fail(`${label}: resource is not publicly eligible`);
    const noHref = resource.href === null || resource.href === undefined || resource.href === '';
    if (noHref) {
      if (resource.status !== 'coming-soon') fail(`${label}: missing href requires coming-soon status`);
    } else if (!isPublicHref(resource.href)) {
      fail(`${label}.href must be an HTTPS URL or a site-root-relative path without credentials or traversal`);
    }
  });

  if (!isObject(materials) || !isObject(materials.courses)) {
    fail('materials.courses must be an object');
    return errors;
  }
  if (materials.version !== 1) fail('materials.version must be 1');
  if (Object.keys(materials.courses).length === 0) fail('materials.courses must not be empty');
  for (const [course, units] of Object.entries(materials.courses)) {
    if (!isText(course) || !isObject(units)) { fail('each assignment course must name an object of units'); continue; }
    for (const [unit, ids] of Object.entries(units)) {
      const label = `assignments ${course} / ${unit}`;
      if (!isText(unit)) fail(`${label}: unit name must be non-empty`);
      if (!Array.isArray(ids)) { fail(`${label} must be an array`); continue; }
      const seen = new Set();
      for (const id of ids) {
        if (!isText(id)) { fail(`${label}: assignment id must be non-empty text`); continue; }
        if (seen.has(id)) fail(`${label}: duplicate assignment ${id}`);
        seen.add(id);
        const resource = byId.get(id);
        if (!resource) fail(`${label}: missing resource ${id}`);
        else if (resource.course !== course) fail(`${label}: course mismatch for ${id}`);
      }
    }
  }
  return errors;
}

export function main(args = process.argv.slice(2)) {
  const paths = {
    '--catalog': resolve(root, 'src/data/resources.json'),
    '--materials': resolve(root, 'src/data/unit-materials.json'),
  };
  try {
    for (let i = 0; i < args.length; i += 2) {
      if (!Object.hasOwn(paths, args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) {
        throw new Error('Usage: validate-public-resources.mjs [--catalog file] [--materials file]');
      }
      paths[args[i]] = resolve(args[i + 1]);
    }
    const catalog = JSON.parse(readFileSync(paths['--catalog'], 'utf8'));
    const materials = JSON.parse(readFileSync(paths['--materials'], 'utf8'));
    const errors = validatePublicResources(catalog, materials);
    if (errors.length) {
      console.error(`Public resource validation FAILED (${errors.length}):\n${errors.map((error) => `- ${error}`).join('\n')}`);
      return 1;
    }
    console.log(`Public resources passed: ${catalog.resourceCount} resources, ${catalog.linkedCount} links, ${catalog.resources.filter((r) => !r.href).length} coming-soon placeholders. Assignments valid. No files changed.`);
    return 0;
  } catch (error) {
    console.error(`Public resource validation FAILED: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main();
}
