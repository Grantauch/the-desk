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
  ['Los Angeles International Airport', 33.942, -118.408, /\b(?:lax airport|at lax)\b/i],
  ['Miami', 25.762, -80.192, /\bmiami\b/i],
  ['New Delhi', 28.614, 77.209, /\bnew delhi\b/i],
  ['Chicago', 41.878, -87.630, /\bchicago\b/i],
  ['Boston', 42.360, -71.059, /\bboston\b/i],
  ['Seattle', 47.606, -122.332, /\bseattle\b/i],
  ['Toronto', 43.653, -79.383, /\btoronto\b/i],
  ['Mexico City', 19.433, -99.133, /\bmexico city\b/i],
  ['Madrid', 40.417, -3.704, /\bmadrid\b/i],
  ['Rome', 41.903, 12.496, /\brome,? italy\b/i],
  ['Moscow', 55.756, 37.617, /\bmoscow\b/i],
  ['Seoul', 37.566, 126.978, /\bseoul\b/i],
];

// Region pins represent a named area in the headline. They use approximate
// reference points, and never imply a street-level event location.
const REGIONS = [
  ['California', 37.25, -119.54, /\bcalifornia\b/i],
  ['Texas', 31.45, -99.33, /\btexas\b/i],
  ['Florida', 27.85, -81.66, /\bflorida\b/i],
  ['Michigan', 44.18, -84.50, /\bmichigan\b/i],
  ['South Carolina', 33.86, -80.97, /\bsouth carolina\b/i],
  ['North Carolina', 35.52, -79.38, /\bnorth carolina\b/i],
  ['Pennsylvania', 40.93, -77.77, /\bpennsylvania\b/i],
  ['Ohio', 40.29, -82.79, /\bohio\b/i],
  ['United Kingdom', 54.7, -2.7, /(?:\bunited kingdom\b|\bu\.k\.(?!\w))/i],
  ['France', 46.60, 2.45, /\bfrance\b/i],
  ['Germany', 51.16, 10.45, /\bgermany\b/i],
  ['Ukraine', 48.38, 31.16, /\bukraine\b/i],
  ['Iran', 32.43, 53.69, /\biran\b/i],
  ['India', 22.70, 79.56, /\bindia\b/i],
  ['Japan', 36.20, 138.25, /\bjapan\b/i],
  ['Australia', -25.73, 134.49, /\baustralia\b/i],
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
      const cities = ambiguous ? [] : PLACES.filter(place => place[3].test(entry.title));
      const regions = ambiguous ? [] : REGIONS.filter(region => region[3].test(entry.title));
      if (cities.length + regions.length !== 1) { unplaced++; continue; }
      const [place, lat, lon] = cities[0] ?? regions[0];
      const approximate = regions.length === 1;
      const summary = approximate
        ? 'This pin marks the approximate center of the region named in the headline. Open the source for the reporting and exact context.'
        : 'Location matched from the headline. Open the publisher’s article for the reporting and context.';
      stories.push({ id: `news-${stories.length}`, kind: 'news', title: entry.title.slice(0, 240), href: url.href, source: group.name.slice(0, 60), published: new Date(published).toISOString(), place: approximate ? `${place} · approximate region` : place, lat, lon, date: new Date(published).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' }), summary });
      if (stories.length === 18) return { stories, unplaced };
    }
  }
  return { stories, unplaced };
}

export const pointFromLatLon = (lat, lon, radius = 1) => {
  const phi = lat * Math.PI / 180, theta = lon * Math.PI / 180;
  return [radius * Math.cos(phi) * Math.cos(theta), radius * Math.sin(phi), -radius * Math.cos(phi) * Math.sin(theta)];
};
