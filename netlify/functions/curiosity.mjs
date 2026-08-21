const COLLECTIONS = {
  power: {
    query: 'presidents congress political campaigns',
    category: 'power + the record',
    question: 'What does this image reveal about how power wanted to be seen?',
    clue: 'Begin with the title, date, and creator. Then inspect who controls the frame.',
    related: '/hidden-history/',
    relatedLabel: 'power, evidence, and official stories',
  },
  entertainment: {
    query: 'motion pictures music performers entertainment',
    category: 'entertainment + memory',
    question: 'What survives when entertainment becomes part of the historical record?',
    clue: 'Look past the famous face. What did the photographer, studio, or audience want preserved?',
    related: '/hidden-history/',
    relatedLabel: 'read popular culture as evidence',
  },
  sports: {
    query: 'baseball boxing football athletes',
    category: 'sports + citizenship',
    question: 'What was this sporting image asking its audience to believe?',
    clue: 'Do not start with the score. Start with the people, setting, and intended audience.',
    related: '/beyond-the-scoreboard/',
    relatedLabel: 'the games were never just games',
  },
  mysteries: {
    query: 'unidentified mystery strange unusual',
    category: 'mystery + evidence',
    question: 'What can this record establish—and what remains genuinely uncertain?',
    clue: 'Separate what the catalog states from what the image merely seems to suggest.',
    related: '/hidden-history/',
    relatedLabel: 'separate the record from the legend',
  },
  michigan: {
    query: 'Michigan Detroit Flint',
    category: 'Michigan + change',
    question: 'What argument about Michigan is hiding inside this image?',
    clue: 'Notice what the record centers, what it labels, and what falls outside the frame.',
    related: '/us-history/',
    relatedLabel: 'connect the national story to Michigan',
  },
};
const asText = (value) => {
  if (Array.isArray(value)) return value.find((entry) => typeof entry === 'string')?.trim() ?? '';
  return typeof value === 'string' ? value.trim() : '';
};

const shortText = (value, maximum = 420) => {
  const normalized = asText(value).replace(/\s+/g, ' ');
  return normalized.length > maximum ? `${normalized.slice(0, maximum - 1).trim()}…` : normalized;
};

const trustedLocUrl = (value, imageOnly = false) => {
  try {
    const url = new URL(String(value).replace(/^http:/, 'https:'));
    const trusted = url.hostname === 'loc.gov' || url.hostname.endsWith('.loc.gov');
    if (url.protocol !== 'https:' || !trusted) return '';
    if (imageOnly && !/\.(?:avif|gif|jpe?g|png|webp)$/i.test(url.pathname)) return '';
    url.hash = '';
    return url.href;
  } catch {
    return '';
  }
};

const normalizeRecord = (record, collection, settings) => {
  if (!record || record.access_restricted === true || record.unrestricted === false) return null;
  const title = shortText(record.title || record.item?.title, 150);
  const recordUrl = trustedLocUrl(record.url || record.id);
  const imageUrls = Array.isArray(record.image_url) ? [...record.image_url].reverse() : [];
  const imageUrl = imageUrls.map((value) => trustedLocUrl(value, true)).find(Boolean)
    || trustedLocUrl(record.item?.service_medium, true);
  if (!title || !recordUrl || !imageUrl) return null;

  const description = shortText(record.item?.summary || record.description || record.item?.notes)
    || 'The catalog record supplies the date, creator, format, and collection context for this image.';
  const date = shortText(record.item?.created_published || record.item?.date || record.dates || record.date, 48)
    || 'catalog date';
  const creator = shortText(record.contributor || record.item?.contributor_names, 110);
  const rights = shortText(record.item?.rights_advisory || record.item?.rights_information, 150);

  return {
    collection,
    category: settings.category,
    source: 'Library of Congress live catalog',
    date,
    question: settings.question,
    clue: settings.clue,
    context: `${description} Open the official record to inspect its full metadata before drawing a conclusion.`,
    image: imageUrl,
    alt: title,
    position: 'center',
    record: recordUrl,
    credit: [creator, rights, 'Library of Congress'].filter(Boolean).join(' / '),
    related: settings.related,
    relatedLabel: settings.relatedLabel,
    deeper: '/cold-openers/',
    deeperLabel: 'follow another evidence-first detour',
  };
};

export const normalizeLocResults = (payload, collection) => {
  const settings = COLLECTIONS[collection];
  if (!settings) return [];
  const normalized = (Array.isArray(payload?.results) ? payload.results : [])
    .map((record) => normalizeRecord(record, collection, settings))
    .filter(Boolean);
  const unique = [...new Map(normalized.map((item) => [item.record, item])).values()];
  if (!unique.length) return [];
  const rotation = Math.floor(Date.now() / 604800000) % unique.length;
  return [...unique.slice(rotation), ...unique.slice(0, rotation)].slice(0, 5);
};

export const handler = async (event) => {
  const collection = event?.queryStringParameters?.collection ?? '';
  const settings = COLLECTIONS[collection];
  if (!settings) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
      body: JSON.stringify({ error: 'Unknown collection.' }),
    };
  }

  try {
    const params = new URLSearchParams({ fo: 'json', at: 'results', c: '20', q: settings.query });
    const response = await fetch(`https://www.loc.gov/photos/?${params}`, {
      headers: { 'User-Agent': 'GrantDesk classroom curiosity reader/2.0 (+https://grant-desk.com)' },
      signal: AbortSignal.timeout(9_000),
    });
    if (!response.ok) throw new Error(`Catalog returned ${response.status}`);
    const items = normalizeLocResults(await response.json(), collection);
    return {
      statusCode: items.length ? 200 : 502,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
      },
      body: JSON.stringify({ collection, items }),
    };
  } catch {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
      body: JSON.stringify({ collection, items: [] }),
    };
  }
};
