const ALLOWED_IMAGE_HOSTS = [
  'cnn.com',
  'brightspotcdn.com',
  'npr.org',
  'foxnews.com',
  'mlive.com',
];

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const isAllowedHost = (hostname) => {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  return ALLOWED_IMAGE_HOSTS.some((host) => normalized === host || normalized.endsWith(`.${host}`));
};

const readImageUrl = (event) => {
  const value = event?.queryStringParameters?.url ?? '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !isAllowedHost(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
};

const imageResponse = async (response) => {
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  if (!response.ok || !contentType.startsWith('image/')) return null;

  const body = await response.arrayBuffer();
  if (!body.byteLength || body.byteLength > MAX_IMAGE_BYTES) return null;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(body.byteLength),
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      'X-Content-Type-Options': 'nosniff',
    },
    body: Buffer.from(body).toString('base64'),
    isBase64Encoded: true,
  };
};

const fetchImage = async (url, trustedHost) => {
  let current = new URL(url);

  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(current, {
      headers: {
        'User-Agent': 'GrantDesk classroom headline image reader/1.0 (+https://grant-desk.com)',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(12_000),
    });

    if (response.status < 300 || response.status >= 400) return response;

    const location = response.headers.get('location');
    if (!location) throw new Error('Image redirect had no destination.');
    const next = new URL(location, current);
    const allowed = trustedHost === 'publisher'
      ? next.protocol === 'https:' && isAllowedHost(next.hostname)
      : next.protocol === 'https:' && next.hostname === trustedHost;
    if (!allowed) throw new Error('Image redirect left its trusted host.');
    current = next;
  }

  throw new Error('Image redirected too many times.');
};

export const handler = async (event = {}) => {
  const sourceUrl = readImageUrl(event);
  if (!sourceUrl) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
      body: 'Unsupported news image URL.',
    };
  }

  try {
    const optimized = new URL('https://images.weserv.nl/');
    optimized.searchParams.set('url', sourceUrl.href);
    optimized.searchParams.set('w', '960');
    optimized.searchParams.set('h', '510');
    optimized.searchParams.set('fit', 'cover');
    optimized.searchParams.set('output', 'webp');

    const optimizedImage = await imageResponse(await fetchImage(optimized, 'images.weserv.nl'));
    if (optimizedImage) return optimizedImage;

    const originalImage = await imageResponse(await fetchImage(sourceUrl, 'publisher'));
    if (originalImage) return originalImage;
  } catch {
    // The card's local newsroom cover handles a temporary upstream failure.
  }

  return {
    statusCode: 502,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
    body: 'News image temporarily unavailable.',
  };
};
