// Curated locations point to existing lessons. Country outlines are modern;
// these coordinates locate a story, not a historical territorial claim.
export const HISTORY = [
  { id: 'new-york', lat: 40.714, lon: -73.997, year: 1900, title: 'the other half', place: 'New York, United States', date: '1870–1901', summary: 'Investigate Jacob Riis, flash photography, and the tenements the camera brought into view.', href: '/hubs/ush9-the-other-half.html', course: 'us history', art: '/atlas/us-history.webp' },
  { id: 'sarajevo', lat: 43.857, lon: 18.429, year: 1914, title: 'thirty seven days', place: 'Sarajevo, Bosnia and Herzegovina', date: 'June–August 1914', summary: 'Follow the decisions that turned an assassination into a European war.', href: '/hubs/ush9-bytesize-thirty-seven-days', course: 'us history' },
  { id: 'somme', lat: 50.02, lon: 2.697, year: 1916, title: 'over the somme', place: 'La Boisselle, France', date: '1 July 1916', summary: 'Explore the field from the air and investigate the ground beneath the first day of the offensive.', href: '/hubs/ush9-over-the-somme', course: 'us history' },
  { id: 'watergate', lat: 38.899, lon: -77.055, year: 1974, title: 'who pressed record', place: 'Washington, D.C., United States', date: '1971–1974', summary: 'Trace the testimony, tapes, and evidence that ended a presidency.', href: '/hubs/hh-who-pressed-record.html', course: 'hidden history' },
  { id: 'detroit', lat: 42.331, lon: -83.046, year: 1938, title: 'two minutes, four seconds', place: 'Detroit, United States · Joe Louis’s hometown', date: '1908–1981', summary: 'Follow a Detroit fighter onto the national stage and examine what the country asked of him.', href: '/hubs/bts-two-minutes-four-seconds.html', course: 'beyond the scoreboard', art: '/atlas/beyond-the-scoreboard.webp' },
  { id: 'lowell', lat: 42.633, lon: -71.316, year: 2003, title: 'the fighter: who calls the shots?', place: 'Lowell, Massachusetts, United States', date: '1978–2003', summary: 'Explore the real people, place, and choices behind The Fighter.', href: '/hubs/bts-the-fighter.html', course: 'beyond the scoreboard' },
];

// A deliberately small, conservative title matcher. Unknown or conflicting
// places remain unplaced; the publisher's headquarters is never substituted.
export const PLACES = [
  ['New York', 40.713, -74.006, /\bnew york(?: city)?\b/i],
  ['Washington, D.C.', 38.907, -77.037, /\b(?:washington,? d\.?c\.?|white house)\b/i],
  ['Detroit', 42.331, -83.046, /\bdetroit\b/i],
  ['Flint', 43.013, -83.687, /\bflint\b/i],
  ['London', 51.507, -0.128, /\blondon\b/i],
  ['Paris', 48.857, 2.352, /\bparis\b/i],
  ['Berlin', 52.52, 13.405, /\bberlin\b/i],
  ['Kyiv', 50.45, 30.523, /\b(?:kyiv|kiev)\b/i],
  ['Tokyo', 35.676, 139.65, /\btokyo\b/i],
  ['Beijing', 39.904, 116.407, /\bbeijing\b/i],
  ['Los Angeles', 34.052, -118.244, /\blos angeles\b/i],
  ['Miami', 25.762, -80.192, /\bmiami\b/i],
];

export function newsFromPayload(payload, now = Date.now()) {
  const publishers = { CNN: 'cnn.com', NPR: 'npr.org', 'Fox News': 'foxnews.com', MLive: 'mlive.com' };
  const seen = new Set();
  const stories = [];
  let unplaced = 0;
  for (const group of Array.isArray(payload?.groups) ? payload.groups.slice(0, 4) : []) {
    const publisher = publishers[group?.name];
    if (!publisher) continue;
    for (const entry of Array.isArray(group.stories) ? group.stories.slice(0, 24) : []) {
      if (typeof entry?.title !== 'string' || typeof entry?.href !== 'string' || entry.title.length > 1000 || entry.href.length > 2048) continue;
      let url;
      try { url = new URL(entry.href); } catch { continue; }
      const published = Date.parse(entry.published);
      if (url.protocol !== 'https:' || url.username || url.password || !(url.hostname === publisher || url.hostname.endsWith(`.${publisher}`)) || !Number.isFinite(published) || published > now + 3600000 || now - published > 72 * 3600000 || seen.has(url.href)) continue;
      seen.add(url.href);
      const ambiguous = /\b(?:paris,? texas|london,? ontario|new york mills)\b/i.test(entry.title);
      const matches = ambiguous ? [] : PLACES.filter(place => place[3].test(entry.title));
      if (matches.length !== 1) { unplaced++; continue; }
      const [place, lat, lon] = matches[0];
      stories.push({ id: `news-${stories.length}`, kind: 'news', title: entry.title.slice(0, 240), href: url.href, source: group.name.slice(0, 60), published: new Date(published).toISOString(), place, lat, lon, date: new Date(published).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' }), summary: 'Location matched from the headline. Open the publisher’s article for the reporting and context.' });
      if (stories.length === 18) return { stories, unplaced };
    }
  }
  return { stories, unplaced };
}

export const pointFromLatLon = (lat, lon, radius = 1) => {
  const phi = lat * Math.PI / 180, theta = lon * Math.PI / 180;
  return [radius * Math.cos(phi) * Math.cos(theta), radius * Math.sin(phi), -radius * Math.cos(phi) * Math.sin(theta)];
};
