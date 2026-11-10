const cloudMap = 'https://clouds.matteason.co.uk/images/2048x1024/clouds.jpg';
const maximumBytes = 1_000_000;

export default async function atlasClouds(request) {
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } });
  try {
    const upstream = await fetch(cloudMap, {
      headers: { Accept: 'image/jpeg' },
      redirect: 'error',
      signal: AbortSignal.timeout(4500),
    });
    if (!upstream.ok || !upstream.headers.get('content-type')?.startsWith('image/jpeg')
      || Number(upstream.headers.get('content-length')) > maximumBytes) {
      throw new Error('Satellite image unavailable');
    }
    const image = new Uint8Array(await upstream.arrayBuffer());
    if (image.length < 4 || image.length > maximumBytes || image[0] !== 0xff || image[1] !== 0xd8) {
      throw new Error('Invalid satellite image');
    }
    return new Response(image, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=300',
        'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=900, stale-while-revalidate=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Satellite clouds unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
