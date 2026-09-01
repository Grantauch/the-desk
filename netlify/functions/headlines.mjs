const SOURCES = [
  {
    name: 'CNN',
    lens: 'national',
    feed: 'https://www.cnn.com/sitemap/news.xml',
    home: 'https://www.cnn.com/',
    format: 'news-sitemap',
  },
  {
    name: 'NPR',
    lens: 'national',
    feed: 'https://feeds.npr.org/1001/rss.xml',
    home: 'https://www.npr.org/sections/news/',
    format: 'rss',
  },
  {
    name: 'Fox News',
    lens: 'national',
    feed: 'https://moxie.foxnews.com/google-publisher/us.xml',
    home: 'https://www.foxnews.com/us',
    format: 'rss',
  },
  {
    name: 'MLive',
    lens: 'Michigan',
    feed: 'https://www.mlive.com/arc/outboundfeeds/rss/?outputType=xml',
    home: 'https://www.mlive.com/',
    format: 'rss',
  },
];

const RESPONSE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=1800',
  'X-Content-Type-Options': 'nosniff',
};
const decodeEntities = (value = '') => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .trim();

const readTag = (xml, tag) => {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeEntities(match[1]) : '';
};

const PLACEHOLDER_URL_VALUES = new Set(['undefined', 'null', 'none', 'false', 'n/a', 'na']);

const isPlaceholderUrlValue = (value = '') => {
  const clean = decodeEntities(String(value || '')).trim().replace(/^["']|["']$/g, '');
  const lower = clean.toLowerCase();
  return !lower ||
    PLACEHOLDER_URL_VALUES.has(lower) ||
    /(?:^|\/)(?:undefined|null|none)(?:[?#].*)?$/i.test(lower);
};

const isPlaceholderImageValue = (value = '') => {
  const clean = decodeEntities(String(value || '')).trim().replace(/^["']|["']$/g, '');
  const lower = clean.toLowerCase();
  return isPlaceholderUrlValue(lower) ||
    /\/tracking\//i.test(lower) ||
    /(?:^|[/-])(?:pixel|spacer)(?:[./_-]|$)/i.test(lower);
};

const markupAttribute = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']+)`, 'i'))?.[1] ?? '';

const readImagesFromMarkup = (value = '') => [...String(value || '').matchAll(/<img\b[^>]*>/gi)]
  .map((match) => {
    const tag = match[0];
    const src = markupAttribute(tag, 'src');
    const width = Number(markupAttribute(tag, 'width') || 0);
    const height = Number(markupAttribute(tag, 'height') || 0);
    if ((width && width <= 2) || (height && height <= 2)) return '';
    return src;
  })
  .filter((src) => src && !isPlaceholderImageValue(src));

const firstImageCandidate = (...values) => values
  .flat()
  .map((value) => decodeEntities(value || ''))
  .find((value) => !isPlaceholderImageValue(value)) ?? '';

const readFeedImage = (entry, format) => {
  if (format === 'news-sitemap') return readTag(entry, 'image:loc');
  const media = [...entry.matchAll(/<media:(?:content|thumbnail)[^>]+url=["']([^"']+)/gi)].at(-1)?.[1] ?? '';
  const enclosure = entry.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image\//i)?.[1] ?? '';
  const encoded = entry.match(/<content:encoded(?:\s[^>]*)?>([\s\S]*?)<\/content:encoded>/i)?.[1] ?? '';
  const description = entry.match(/<description(?:\s[^>]*)?>([\s\S]*?)<\/description>/i)?.[1] ?? '';
  return firstImageCandidate(media, enclosure, readImagesFromMarkup(encoded), readImagesFromMarkup(description));
};

const safeHttpsUrl = (value, base) => {
  if (isPlaceholderUrlValue(value)) return '';
  try {
    const url = new URL(value, base);
    return url.protocol === 'https:' && !isPlaceholderUrlValue(url.href) ? url.href : '';
  } catch {
    return '';
  }
};

const safeHttpsImageUrl = (value, base) => {
  if (isPlaceholderImageValue(value)) return '';
  const url = safeHttpsUrl(value, base);
  return url && !isPlaceholderImageValue(url) ? url : '';
};

const fetchText = async (url, timeoutMs = 8_000) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'GrantDesk classroom headline reader/2.0 (+https://grant-desk.com)',
      Accept: 'application/rss+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Request returned ${response.status}`);
  return response.text();
};

const readOpenGraphImage = (html, articleUrl) => {
  const candidates = [
    /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image(?::src)?)["'][^>]+content=["']([^"']+)/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image(?::src)?)["']/i,
  ];
  for (const pattern of candidates) {
    const value = pattern.exec(html)?.[1];
    const url = safeHttpsImageUrl(decodeEntities(value ?? ''), articleUrl);
    if (url) return url;
  }
  return '';
};

const resolveArticleImage = async (story) => {
  if (story.image) return story;
  try {
    const html = await fetchText(story.href, 5_000);
    return { ...story, image: readOpenGraphImage(html, story.href) };
  } catch {
    return story;
  }
};

export const parseSourceFeed = (xml, source) => {
  const entryPattern = source.format === 'news-sitemap'
    ? /<url(?:\s[^>]*)?>([\s\S]*?)<\/url>/gi
    : /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
  const entries = [...xml.matchAll(entryPattern)].map((match) => match[1]).slice(0, 24);
  const seen = new Set();

  return entries.map((entry) => {
    const title = readTag(entry, source.format === 'news-sitemap' ? 'news:title' : 'title');
    const href = safeHttpsUrl(readTag(entry, source.format === 'news-sitemap' ? 'loc' : 'link'), source.home);
    const published = readTag(entry, source.format === 'news-sitemap' ? 'news:publication_date' : 'pubDate');
    const image = safeHttpsImageUrl(readFeedImage(entry, source.format), href || source.home);
    if (!title || !href || seen.has(href)) return null;
    seen.add(href);
    return { title, href, image, published };
  }).filter(Boolean).slice(0, 6);
};

const loadSource = async (source) => {
  try {
    const xml = await fetchText(source.feed);
    const parsed = parseSourceFeed(xml, source);
    const stories = await Promise.all(parsed.map(resolveArticleImage));
    return { name: source.name, lens: source.lens, stories };
  } catch {
    return { name: source.name, lens: source.lens, stories: [] };
  }
};

export const handler = async () => {
  const groups = await Promise.all(SOURCES.map(loadSource));
  return {
    statusCode: 200,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify({ updatedAt: new Date().toISOString(), groups }),
  };
};
