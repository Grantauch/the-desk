// These reviewed teacher references may still carry legacy student-publish flags.
const teacherOnlyResourceIds = new Set([
  '488-hidden-history-unit-4-myth-stations-verification-lab',
  '490-hidden-history-unit-4-performance-task-claim-bank',
]);

// Shared public eligibility; authoring callers must also validate the resulting catalog.
export const isPublicResource = (resource) => resource?.onWebsite === true
  && !teacherOnlyResourceIds.has(resource.id)
  && resource.status !== 'restricted'
  && ((typeof resource.href === 'string' && resource.href.trim().length > 0) || resource.status === 'coming-soon');
