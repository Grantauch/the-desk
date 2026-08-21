import { handler as headlinesHandler } from '../netlify/functions/headlines.mjs';
import { handler as curiosityHandler } from '../netlify/functions/curiosity.mjs';

const headlineResponse = await headlinesHandler({});
if (headlineResponse.statusCode !== 200) throw new Error(`Headline function returned ${headlineResponse.statusCode}`);
const headlinePayload = JSON.parse(headlineResponse.body);
if (!Array.isArray(headlinePayload.groups) || headlinePayload.groups.length !== 4) {
  throw new Error('Headline function did not return all four newsrooms.');
}

const headlineSummary = headlinePayload.groups.map((group) => ({
  source: group.name,
  stories: Array.isArray(group.stories) ? group.stories.length : 0,
  images: Array.isArray(group.stories) ? group.stories.filter((story) => story.image).length : 0,
}));

const thumbnailSummary = await Promise.all(headlinePayload.groups.map(async (group) => {
  const sourceImage = group.stories?.find((story) => story.image)?.image;
  if (!sourceImage) return { source: group.name, status: 0, type: '', bytes: 0 };
  const proxy = new URL('https://images.weserv.nl/');
  proxy.searchParams.set('url', sourceImage);
  proxy.searchParams.set('w', '960');
  proxy.searchParams.set('h', '510');
  proxy.searchParams.set('fit', 'cover');
  proxy.searchParams.set('output', 'webp');
  const response = await fetch(proxy, { signal: AbortSignal.timeout(15_000) });
  const bytes = response.ok ? (await response.arrayBuffer()).byteLength : 0;
  return { source: group.name, status: response.status, type: response.headers.get('content-type') ?? '', bytes };
}));

const collections = ['power', 'entertainment', 'sports', 'mysteries', 'michigan'];
const curiositySummary = await Promise.all(collections.map(async (collection) => {
  const response = await curiosityHandler({ queryStringParameters: { collection } });
  const payload = JSON.parse(response.body);
  return { collection, status: response.statusCode, records: Array.isArray(payload.items) ? payload.items.length : 0 };
}));

console.table(headlineSummary);
console.table(thumbnailSummary);
console.table(curiositySummary);

if (headlineSummary.some((source) => source.stories < 1)) {
  throw new Error('At least one headline source returned no usable stories.');
}
if (headlineSummary.some((source) => source.images < 1)) {
  throw new Error('At least one headline source returned no usable article images.');
}
if (thumbnailSummary.some((image) => image.status !== 200 || !image.type.startsWith('image/') || image.bytes < 5_000)) {
  throw new Error('At least one headline thumbnail proxy failed to return a usable image.');
}
if (curiositySummary.some((collection) => collection.status !== 200 || collection.records < 1)) {
  throw new Error('At least one curiosity collection returned no usable records.');
}

console.log('Live data validation: PASS');
