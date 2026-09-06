import { isPublicResource } from '../src/lib/public-resources.js';

export function editorResources(library, materials) {
  return library.filter((item) => isPublicResource(item) && Object.hasOwn(materials.courses, item.course))
    .map(({ id, course, unitTopic, name, type, status }) => ({ id, course, unitTopic, name, type, status }));
}

export function validateMaterials(template, library, candidate) {
  const resourcesById = new Map(library.filter(isPublicResource).map((item) => [item.id, item]));
  const clean = { version: 1, courses: {} };
  for (const [course, units] of Object.entries(template.courses)) {
    clean.courses[course] = {};
    for (const unit of Object.keys(units)) {
      const ids = candidate?.courses?.[course]?.[unit];
      if (!Array.isArray(ids)) throw new Error(`The ${unit} choices are incomplete.`);
      const unique = [...new Set(ids)];
      for (const id of unique) {
        const resource = resourcesById.get(id);
        if (!resource || resource.course !== course) throw new Error(`One ${unit} item no longer matches this library.`);
      }
      clean.courses[course][unit] = unique;
    }
  }
  return clean;
}
