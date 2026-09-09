const origin = (process.env.GRANTDESK_ORIGIN || 'https://grant-desk.com').replace(/\/$/, '');
const timeoutMs = Number(process.env.LIVE_DATA_TIMEOUT_MS || 15_000);

const getJson = async (path) => {
  const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json();
};

const getImage = async (sourceUrl) => {
  const path = `/.netlify/functions/news-image?url=${encodeURIComponent(sourceUrl)}`;
  const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
  const bytes = response.ok ? (await response.arrayBuffer()).byteLength : 0;
  return {
    status: response.status,
    type: response.headers.get('content-type') || '',
    bytes,
  };
};

const headlines = await getJson('/.netlify/functions/headlines');
if (!Array.isArray(headlines.groups) || headlines.groups.length !== 4) {
  throw new Error(`Production headlines returned ${headlines.groups?.length ?? 0} newsrooms; expected 4.`);
}

const newsrooms = [];
for (const group of headlines.groups) {
  const stories = Array.isArray(group.stories) ? group.stories : [];
  const firstImage = stories.find((story) => typeof story.image === 'string' && story.image.startsWith('http'))?.image;
  if (stories.length < 1) throw new Error(`${group.name || 'Unknown newsroom'} returned no usable stories.`);
  if (!firstImage) throw new Error(`${group.name || 'Unknown newsroom'} returned no usable article images.`);
  const image = await getImage(firstImage);
  if (image.status !== 200 || !image.type.startsWith('image/') || image.bytes < 5_000) {
    throw new Error(`${group.name || 'Unknown newsroom'} thumbnail proxy failed: ${JSON.stringify(image)}`);
  }
  newsrooms.push({ source: group.name, stories: stories.length, imageBytes: image.bytes });
}

const collections = ['power', 'entertainment', 'sports', 'mysteries', 'michigan'];
const curiosity = [];
for (const collection of collections) {
  const payload = await getJson(`/.netlify/functions/curiosity?collection=${encodeURIComponent(collection)}`);
  const records = Array.isArray(payload.items) ? payload.items.length : 0;
  if (records < 1) throw new Error(`Curiosity collection ${collection} returned no usable records.`);
  curiosity.push({ collection, records });
}

console.table(newsrooms);
console.table(curiosity);
console.log(`Production live data health: PASS — ${origin}`);
