(() => {
  const SECTION_SELECTOR = '#headlines';
  const CARD_SELECTOR = '[data-headline-carousel]';
  const STORY_IMAGE_SELECTOR = '[data-story-image]';
  const REFRESH_INTERVAL = 30 * 60_000;
  const SECOND_PASS_DELAY = 11_000;

  const ALLOWED_FEEDS = new Set([
    'https://www.cnn.com/sitemap/news.xml',
    'https://feeds.npr.org/1001/rss.xml',
    'https://moxie.foxnews.com/google-publisher/us.xml',
    'https://www.mlive.com/arc/outboundfeeds/rss/?outputType=xml',
  ]);

  const feedProxies = [
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  ];

  const decodeHtml = (value) => {
    if (!value) return '';
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value.trim();
  };

  const safeHttpsUrl = (value) => {
    if (!value || typeof value !== 'string') return '';
    const decoded = decodeHtml(value).trim();
    const normalized = decoded.startsWith('//') ? `https:${decoded}` : decoded;

    try {
      const url = new URL(normalized, window.location.href);
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  };

  const imageProxyUrl = (value) => {
    const safe = safeHttpsUrl(value);
    if (!safe || safe.includes('wsrv.nl/')) return '';
    return `https://wsrv.nl/?url=${encodeURIComponent(safe)}&w=1200&h=638&fit=cover&output=webp&q=82`;
  };

  const textFrom = (element, names) => {
    const wanted = Array.isArray(names) ? names : [names];
    const descendants = [element, ...element.getElementsByTagName('*')];

    for (const name of wanted) {
      const lowered = name.toLowerCase();
      const node = descendants.find((candidate) => {
        const qualified = candidate.tagName?.toLowerCase() ?? '';
        const local = candidate.localName?.toLowerCase() ?? '';
        return qualified === lowered || local === lowered || qualified.endsWith(`:${lowered}`);
      });
      if (node?.textContent?.trim()) return node.textContent.trim();
    }

    return '';
  };

  const elementsNamed = (element, names) => {
    const wanted = new Set((Array.isArray(names) ? names : [names]).map((name) => name.toLowerCase()));
    return [...element.getElementsByTagName('*')].filter((candidate) => {
      const qualified = candidate.tagName?.toLowerCase() ?? '';
      const local = candidate.localName?.toLowerCase() ?? '';
      return wanted.has(qualified)
        || wanted.has(local)
        || [...wanted].some((name) => qualified.endsWith(`:${name}`));
    });
  };

  const imageFromMarkup = (markup) => {
    if (!markup) return '';
    const template = document.createElement('template');
    template.innerHTML = markup;

    const image = template.content.querySelector('img[src]')?.getAttribute('src');
    if (image) return image;

    const srcset = template.content.querySelector('img[srcset], source[srcset]')?.getAttribute('srcset') ?? '';
    return srcset.split(',')[0]?.trim().split(/\s+/)[0] ?? '';
  };

  const bestImageFromEntry = (entry, format) => {
    if (format === 'news-sitemap') {
      return safeHttpsUrl(textFrom(entry, ['image:loc', 'loc']));
    }

    const mediaNodes = elementsNamed(entry, ['media:content', 'media:thumbnail', 'content', 'thumbnail'])
      .filter((node) => node.hasAttribute('url'));

    const rankedMedia = mediaNodes
      .map((node) => ({
        url: node.getAttribute('url') ?? '',
        area: (Number(node.getAttribute('width')) || 0) * (Number(node.getAttribute('height')) || 0),
      }))
      .filter((candidate) => safeHttpsUrl(candidate.url))
      .sort((a, b) => b.area - a.area);

    if (rankedMedia[0]?.url) return safeHttpsUrl(rankedMedia[0].url);

    const enclosure = elementsNamed(entry, 'enclosure').find((node) => {
      const type = node.getAttribute('type') ?? '';
      return node.hasAttribute('url') && (!type || type.startsWith('image/'));
    });
    const enclosureUrl = safeHttpsUrl(enclosure?.getAttribute('url') ?? '');
    if (enclosureUrl) return enclosureUrl;

    const description = textFrom(entry, ['description', 'encoded', 'content:encoded']);
    return safeHttpsUrl(imageFromMarkup(description));
  };

  const formatPublished = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return 'latest edition';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York',
    }).format(date);
  };

  const storiesFromXml = (xml, format) => {
    const documentXml = new DOMParser().parseFromString(xml, 'application/xml');
    if (documentXml.querySelector('parsererror')) return [];

    const entries = format === 'news-sitemap'
      ? [...documentXml.getElementsByTagName('url')]
      : [...documentXml.getElementsByTagName('item')];
    const seen = new Set();

    return entries.map((entry) => {
      const title = textFrom(entry, format === 'news-sitemap' ? ['news:title', 'title'] : 'title');
      const href = safeHttpsUrl(textFrom(entry, 'loc') || textFrom(entry, 'link'));
      const published = textFrom(entry, format === 'news-sitemap'
        ? ['news:publication_date', 'publication_date']
        : ['pubDate', 'published', 'updated']);
      const image = bestImageFromEntry(entry, format);

      if (!title || !href || seen.has(href)) return null;
      seen.add(href);
      return { title, href, image, published: formatPublished(published) };
    }).filter(Boolean).slice(0, 6);
  };

  const fetchWithTimeout = async (url, timeoutMs = 6_500) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        signal: controller.signal,
        headers: { Accept: 'application/xml,text/xml,text/plain,*/*' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const fetchFeedXml = async (feed) => {
    const safeFeed = safeHttpsUrl(feed);
    if (!safeFeed || !ALLOWED_FEEDS.has(safeFeed)) return '';

    const attempts = [safeFeed, ...feedProxies.map((proxy) => proxy(safeFeed))];
    for (const attempt of attempts) {
      try {
        const xml = await fetchWithTimeout(attempt);
        if (xml && /<(?:rss|feed|urlset|item|url)[\s>]/i.test(xml)) return xml;
      } catch {
        // Try the next route. Existing server-rendered stories remain untouched if all routes fail.
      }
    }
    return '';
  };

  const storyImageCache = new Map();

  const rememberStoryImages = (card) => {
    card.querySelectorAll('[data-story]').forEach((story) => {
      const href = safeHttpsUrl(story.getAttribute('data-href') ?? '');
      const image = safeHttpsUrl(story.getAttribute('data-image') ?? '');
      if (href && image) storyImageCache.set(href, image);
    });
  };

  const protectHeadlineUpdates = (card) => {
    if (card.dataset.thumbnailRepairReady === 'true') return;
    rememberStoryImages(card);

    card.addEventListener('headline:update', (event) => {
      if (!(event instanceof CustomEvent) || !Array.isArray(event.detail)) return;
      event.detail.forEach((story) => {
        if (!story || typeof story !== 'object') return;
        const href = safeHttpsUrl(story.href ?? '');
        const incoming = safeHttpsUrl(story.image ?? '');
        const image = incoming || (href ? storyImageCache.get(href) : '') || '';
        story.image = image;
        if (href && image) storyImageCache.set(href, image);
      });
    }, { capture: true });

    card.dataset.thumbnailRepairReady = 'true';
  };

  const refreshCard = async (card) => {
    const feed = card.dataset.feed ?? '';
    const format = card.dataset.feedFormat ?? 'rss';
    const xml = await fetchFeedXml(feed);
    if (!xml) return false;

    const stories = storiesFromXml(xml, format);
    if (!stories.length) return false;

    stories.forEach((story) => {
      if (story.href && story.image) storyImageCache.set(story.href, story.image);
    });
    card.dispatchEvent(new CustomEvent('headline:update', { detail: stories }));
    return true;
  };

  const refreshSection = async (section) => {
    const cards = [...section.querySelectorAll(CARD_SELECTOR)].filter((card) => card instanceof HTMLElement);
    cards.forEach(protectHeadlineUpdates);

    const results = await Promise.allSettled(cards.map(refreshCard));
    if (!results.some((result) => result.status === 'fulfilled' && result.value)) return;

    const updated = section.querySelector('[data-headlines-updated]');
    if (updated) {
      const now = new Date();
      updated.textContent = `live refresh ${formatPublished(now.toISOString())}`;
      updated.setAttribute('datetime', now.toISOString());
    }
  };

  const installImageFailureFallback = () => {
    document.addEventListener('error', (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.matches(STORY_IMAGE_SELECTOR)) return;

      const failedUrl = safeHttpsUrl(image.currentSrc || image.src);
      if (!failedUrl || failedUrl.includes('wsrv.nl/')) return;
      if (image.dataset.proxyFor === failedUrl) return;

      const proxied = imageProxyUrl(failedUrl);
      if (!proxied) return;

      event.stopImmediatePropagation();
      image.dataset.proxyFor = failedUrl;
      image.hidden = true;
      image.src = proxied;
    }, true);
  };

  const start = () => {
    const section = document.querySelector(SECTION_SELECTOR);
    if (!(section instanceof HTMLElement) || section.dataset.thumbnailRepairInstalled === 'true') return;

    section.dataset.thumbnailRepairInstalled = 'true';
    installImageFailureFallback();
    section.querySelectorAll(CARD_SELECTOR).forEach((card) => {
      if (card instanceof HTMLElement) protectHeadlineUpdates(card);
    });

    window.setTimeout(() => refreshSection(section), 250);
    window.setTimeout(() => refreshSection(section), SECOND_PASS_DELAY);
    window.setInterval(() => refreshSection(section), REFRESH_INTERVAL);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  document.addEventListener('astro:page-load', start);
})();
