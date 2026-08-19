(() => {
  const ROOT_SELECTOR = '[data-curiosity-desk]';
  const TIME_ZONE = 'America/Detroit';
  const CACHE_PREFIX = 'the-desk:curiosity:';
  const FETCH_TIMEOUT = 7000;

  const sourceTopics = {
    loc: [
      ['michigan', 'Michigan + memory'], ['baseball', 'sports + citizenship'], ['invention', 'technology + change'],
      ['president', 'power + spectacle'], ['civil rights', 'rights + citizenship'], ['aviation', 'technology + risk'],
      ['suffrage', 'rights + power'], ['war poster', 'war + persuasion'],
    ],
    newspapers: [
      ['michigan', 'Michigan + headlines'], ['baseball', 'sports + headlines'], ['election', 'power + headlines'],
      ['aviation', 'technology + headlines'], ['prohibition', 'law + culture'], ['labor strike', 'work + power'],
      ['war', 'war + headlines'], ['crime', 'law + spectacle'],
    ],
    met: [
      ['armor', 'war + objects'], ['map', 'maps + power'], ['astronomy', 'science + belief'], ['mask', 'identity + ritual'],
      ['weapon', 'war + technology'], ['horse', 'power + movement'], ['game', 'play + culture'], ['revolution', 'power + memory'],
    ],
    artic: [
      ['war', 'war + memory'], ['machine', 'technology + imagination'], ['map', 'maps + meaning'], ['Chicago', 'cities + change'],
      ['revolution', 'power + memory'], ['myth', 'myth + memory'], ['sports', 'sports + culture'], ['politics', 'power + persuasion'],
    ],
    cleveland: [
      ['sword', 'war + objects'], ['armor', 'war + technology'], ['politics', 'power + persuasion'], ['map', 'maps + meaning'],
      ['machine', 'technology + design'], ['myth', 'myth + memory'], ['war', 'war + memory'], ['sport', 'sports + culture'],
    ],
    nasa: [
      ['Apollo', 'space + risk'], ['Mars', 'space + exploration'], ['experimental aircraft', 'technology + risk'],
      ['space shuttle', 'space + engineering'], ['astronaut training', 'space + people'], ['Earth observation', 'science + perspective'],
      ['hurricane', 'science + disaster'], ['robotics', 'technology + exploration'],
    ],
  };

  const stripHtml = (value = '') => {
    const template = document.createElement('template');
    template.innerHTML = String(value);
    return (template.content.textContent || '').replace(/\s+/g, ' ').trim();
  };

  const shorten = (value, max = 520) => {
    const text = stripHtml(value);
    if (text.length <= max) return text;
    const clipped = text.slice(0, max - 1);
    const boundary = Math.max(clipped.lastIndexOf('. '), clipped.lastIndexOf('; '), clipped.lastIndexOf(', '));
    return `${clipped.slice(0, boundary > max * 0.55 ? boundary + 1 : max - 1).trim()}…`;
  };

  const hash = (value) => {
    let h = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  const dayKey = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const safeHttps = (value) => {
    if (!value) return '';
    try {
      const url = new URL(String(value), window.location.href);
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  };

  const fetchText = async (url) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const fetchJson = async (url) => {
    const safe = safeHttps(url);
    if (!safe) throw new Error('Unsafe URL');
    const routes = [
      safe,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(safe)}`,
    ];

    let lastError;
    for (const route of routes) {
      try {
        return JSON.parse(await fetchText(route));
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Request failed');
  };

  const preloadImage = (url) => new Promise((resolve) => {
    const safe = safeHttps(url);
    if (!safe) return resolve(false);
    const image = new Image();
    const timeout = window.setTimeout(() => resolve(false), 6000);
    image.onload = () => {
      window.clearTimeout(timeout);
      resolve(image.naturalWidth > 120 && image.naturalHeight > 90);
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      resolve(false);
    };
    image.src = safe;
  });

  const formatDate = (value, fallback = 'archive date') => {
    if (!value) return fallback;
    const year = String(value).match(/\b(?:1[0-9]{3}|20[0-9]{2})\b/)?.[0];
    return year || String(value).slice(0, 24);
  };

  const commonItem = ({ source, category, title, date, image, record, credit, context, clue, question, alt }) => ({
    source,
    category,
    date: formatDate(date),
    image: safeHttps(image),
    record: safeHttps(record),
    credit: shorten(credit, 180),
    context: shorten(context, 560),
    clue: shorten(clue, 180),
    question: shorten(question, 180),
    alt: shorten(alt || title, 220),
    related: '/hidden-history/',
    relatedLabel: 'separate the artifact from the story around it',
    deeper: '/rabbit-holes/',
    deeperLabel: 'take the next unexpected turn',
  });

  const choose = (items, seed) => items.length ? items[seed % items.length] : null;

  const loadLoc = async (topic, seed, newspapers = false) => {
    const section = newspapers ? 'newspapers' : 'photos';
    const url = `https://www.loc.gov/${section}/?fo=json&c=50&q=${encodeURIComponent(topic[0])}`;
    const data = await fetchJson(url);
    const results = (data.results || []).filter((item) => item.image_url?.length && safeHttps(item.id));
    const raw = choose(results, seed);
    if (!raw) return null;

    const image = [...(raw.image_url || [])].reverse().map(safeHttps).find(Boolean) || '';
    const title = stripHtml(raw.title || raw.item?.title || (newspapers ? 'Historic newspaper page' : 'Library of Congress artifact'));
    const description = Array.isArray(raw.description) ? raw.description.join(' ') : raw.description || raw.item?.notes?.join?.(' ') || '';
    const date = raw.date || raw.item?.date || raw.created_published_date || '';

    return commonItem({
      source: newspapers ? 'Library of Congress / Chronicling America' : 'Library of Congress',
      category: topic[1],
      title,
      date,
      image,
      record: raw.id,
      credit: newspapers ? 'Library of Congress / Chronicling America / original newspaper record' : 'Library of Congress / original catalog record',
      question: newspapers
        ? 'What did this newspaper page think was important enough to put in front of its readers?'
        : `What can “${title}” tell us before we read the catalog description?`,
      clue: newspapers ? 'Start with the biggest type, the image placement, and what the page assumes readers already know.' : 'Start with what the creator chose to put inside the frame — and what is missing.',
      context: description || `${title}. This digitized primary source is preserved by the Library of Congress. Open the original record to inspect the full catalog description, date, creator, and rights information.`,
      alt: title,
    });
  };

  const loadMet = async (topic, seed) => {
    const search = await fetchJson(`https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(topic[0])}`);
    const ids = search.objectIDs || [];
    if (!ids.length) return null;
    const start = seed % ids.length;

    for (let offset = 0; offset < Math.min(10, ids.length); offset += 1) {
      const id = ids[(start + offset) % ids.length];
      const raw = await fetchJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
      if (!raw?.isPublicDomain || !safeHttps(raw.primaryImageSmall || raw.primaryImage)) continue;
      const title = stripHtml(raw.title || raw.objectName || 'Met object');
      const maker = stripHtml(raw.artistDisplayName || raw.culture || raw.department || 'unknown maker');
      return commonItem({
        source: 'The Metropolitan Museum of Art',
        category: topic[1],
        title,
        date: raw.objectDate || raw.objectBeginDate,
        image: raw.primaryImageSmall || raw.primaryImage,
        record: raw.objectURL,
        credit: `${maker} / The Metropolitan Museum of Art / public domain`,
        question: `What would you guess “${title}” was made to do — or make people feel — before reading the museum label?`,
        clue: 'Look at the material, scale, wear, and decoration before deciding what kind of object this is.',
        context: [raw.objectName, raw.objectDate, raw.culture, raw.period, raw.medium, raw.department].filter(Boolean).join('. '),
        alt: `${title}, from The Metropolitan Museum of Art.`,
      });
    }
    return null;
  };

  const loadArtic = async (topic, seed) => {
    const fields = 'id,title,image_id,date_display,artist_display,place_of_origin,medium_display,thumbnail,is_public_domain,department_title';
    const url = `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(topic[0])}&query%5Bterm%5D%5Bis_public_domain%5D=true&fields=${encodeURIComponent(fields)}&limit=50`;
    const data = await fetchJson(url);
    const rows = (data.data || []).filter((item) => item.is_public_domain && item.image_id);
    const raw = choose(rows, seed);
    if (!raw) return null;
    const title = stripHtml(raw.title || 'Art Institute object');
    const image = `${data.config?.iiif_url || 'https://www.artic.edu/iiif/2'}/${raw.image_id}/full/843,/0/default.jpg`;

    return commonItem({
      source: 'Art Institute of Chicago',
      category: topic[1],
      title,
      date: raw.date_display,
      image,
      record: `https://www.artic.edu/artworks/${raw.id}`,
      credit: `${stripHtml(raw.artist_display || 'unknown maker')} / Art Institute of Chicago / public domain`,
      question: `Why might “${title}” have looked different to its first audience than it does to us?`,
      clue: 'Before reading the label, separate what you can actually see from what you are assuming.',
      context: [raw.artist_display, raw.date_display, raw.place_of_origin, raw.medium_display, raw.department_title].filter(Boolean).map(stripHtml).join('. '),
      alt: raw.thumbnail?.alt_text || `${title}, Art Institute of Chicago.`,
    });
  };

  const loadCleveland = async (topic, seed) => {
    const url = `https://openaccess-api.clevelandart.org/api/artworks/?q=${encodeURIComponent(topic[0])}&cc0&has_image=1&limit=50`;
    const data = await fetchJson(url);
    const rows = (data.data || []).filter((item) => item.share_license_status === 'CC0' && item.images?.web?.url);
    const raw = choose(rows, seed);
    if (!raw) return null;
    const title = stripHtml(raw.title || 'Cleveland Museum object');

    return commonItem({
      source: 'Cleveland Museum of Art',
      category: topic[1],
      title,
      date: raw.creation_date,
      image: raw.images.web.url,
      record: raw.url,
      credit: 'Cleveland Museum of Art / Open Access / CC0',
      question: `What clues tell you how “${title}” was meant to be used, seen, or understood?`,
      clue: 'Treat the object like evidence: material first, decoration second, museum label last.',
      context: raw.tombstone || [raw.creation_date, ...(raw.culture || []), raw.technique, raw.department].filter(Boolean).join('. '),
      alt: `${title}, Cleveland Museum of Art.`,
    });
  };

  const loadNasa = async (topic, seed) => {
    const data = await fetchJson(`https://images-api.nasa.gov/search?q=${encodeURIComponent(topic[0])}&media_type=image&page_size=50`);
    const rows = (data.collection?.items || []).filter((item) => item.data?.[0] && item.links?.some((link) => link.render === 'image' || link.href));
    const raw = choose(rows, seed);
    if (!raw) return null;
    const meta = raw.data[0];
    const image = raw.links.find((link) => link.render === 'image')?.href || raw.links[0]?.href;
    const title = stripHtml(meta.title || 'NASA image');

    return commonItem({
      source: 'NASA Image and Video Library',
      category: topic[1],
      title,
      date: meta.date_created,
      image,
      record: `https://images.nasa.gov/details/${encodeURIComponent(meta.nasa_id)}`,
      credit: `${stripHtml(meta.center || 'NASA')} / NASA Image and Video Library`,
      question: `What exactly are we looking at in “${title}” — and what problem was it meant to solve or reveal?`,
      clue: 'Ignore the caption for a moment. Use scale, setting, equipment, and people to build your first explanation.',
      context: meta.description || meta.description_508 || `${title}. Open the NASA record for the full description and asset information.`,
      alt: title,
    });
  };

  const sources = [
    { key: 'loc', load: (topic, seed) => loadLoc(topic, seed, false) },
    { key: 'newspapers', load: (topic, seed) => loadLoc(topic, seed, true) },
    { key: 'met', load: loadMet },
    { key: 'artic', load: loadArtic },
    { key: 'cleveland', load: loadCleveland },
    { key: 'nasa', load: loadNasa },
  ];

  const readCache = (key) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(CACHE_PREFIX + key) || 'null');
      return parsed?.record && parsed?.image ? parsed : null;
    } catch {
      return null;
    }
  };

  const writeCache = (key, item) => {
    try {
      Object.keys(localStorage).filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_PREFIX + key)
        .forEach((name) => localStorage.removeItem(name));
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
    } catch {
      // Storage is optional; the deterministic date/source selection still works without it.
    }
  };

  const getDailyItem = async () => {
    const date = dayKey();
    const cached = readCache(date);
    if (cached && await preloadImage(cached.image)) return cached;

    const sourceStart = hash(`${date}:source`) % sources.length;
    for (let attempt = 0; attempt < sources.length; attempt += 1) {
      const source = sources[(sourceStart + attempt) % sources.length];
      const topics = sourceTopics[source.key];
      const topic = topics[hash(`${date}:${source.key}:topic`) % topics.length];
      const seed = hash(`${date}:${source.key}:${topic[0]}`);
      try {
        const item = await source.load(topic, seed);
        if (!item?.image || !item?.record || !await preloadImage(item.image)) continue;
        writeCache(date, item);
        return item;
      } catch {
        // Move to the next institution; the hand-picked desk remains visible until one succeeds.
      }
    }
    return null;
  };

  const render = (root, item) => {
    if (!item) return;
    const image = root.querySelector('[data-field="image"]');
    if (image instanceof HTMLImageElement) {
      image.src = item.image;
      image.alt = item.alt;
      image.style.objectPosition = 'center';
    }

    const setText = (name, value) => root.querySelectorAll(`[data-field="${name}"]`).forEach((element) => {
      element.textContent = value;
    });

    setText('date', item.date);
    setText('category', item.category);
    setText('source', item.source);
    setText('question', item.question);
    setText('clue', item.clue);
    setText('context', item.context);
    setText('credit', item.credit);
    setText('related-label', item.relatedLabel);
    setText('deeper-label', item.deeperLabel);
    setText('count', 'daily artifact / changes every day');
    setText('status', `Today’s Curiosity Desk artifact: ${item.question}`);

    root.querySelectorAll('[data-link="record"]').forEach((link) => link.setAttribute('href', item.record));
    root.querySelector('[data-link="related"]')?.setAttribute('href', item.related);
    root.querySelector('[data-link="deeper"]')?.setAttribute('href', item.deeper);

    const panel = root.querySelector('[data-field="context-panel"]');
    const reveal = root.querySelector('[data-action="reveal"]');
    if (panel instanceof HTMLElement) panel.hidden = true;
    if (reveal instanceof HTMLButtonElement) {
      reveal.setAttribute('aria-expanded', 'false');
      reveal.textContent = 'reveal the context';
    }

    root.dataset.dailyCuriosityLoaded = 'true';
  };

  const start = async () => {
    const root = document.querySelector(ROOT_SELECTOR);
    if (!(root instanceof HTMLElement) || root.dataset.dailyCuriosityStarted === 'true') return;
    root.dataset.dailyCuriosityStarted = 'true';

    const item = await getDailyItem();
    if (item) render(root, item);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  document.addEventListener('astro:page-load', start);
})();
