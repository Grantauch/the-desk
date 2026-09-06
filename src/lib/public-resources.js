// Shared public eligibility; authoring callers must also validate the resulting catalog.
export const isPublicResource = (resource) => resource?.onWebsite === true
  && resource.status !== 'restricted'
  && ((typeof resource.href === 'string' && resource.href.trim().length > 0) || resource.status === 'coming-soon');
