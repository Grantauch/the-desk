// Shared public eligibility; authoring callers must also validate the resulting catalog.
export const isPublicResource = (resource) => resource?.onWebsite === true
  && resource.status !== 'restricted'
  && (Boolean(resource.href) || resource.status === 'coming-soon');
