// sitemap.xml — built at deploy time from the list below.
// If you add a page to src/pages/, add its path here too.
import type { APIRoute } from 'astro';
import { learningHubs } from '../data/learningHubs';
import passConfig from '../data/pass-config.json';
import { remixPublicRoutes } from '../data/remixCatalog';

const paths = [
  '/',
  '/us-history/',
  '/hidden-history/',
  '/hidden-history/syllabus/',
  '/beyond-the-scoreboard/',
  '/beyond-the-scoreboard/syllabus/',
  '/resources/',
  ...remixPublicRoutes,
  '/learning-hubs/',
  ...learningHubs.map((hub) => `/learn/${hub.courseSlug}/${hub.slug}/`),
  '/simulations/',
  '/games/',
  '/glossary/',
  '/cold-openers/',
  '/rabbit-holes/',
  '/tools/',
  ...(passConfig.enabled ? ['/pass/'] : []),
  '/calendar/',
  '/fact-check-friday/',
  '/showcase/',
  '/announcements/',
  '/about/',
];

export const GET: APIRoute = ({ site }) => {
  const urls = paths
    .map((p) => `  <url><loc>${new URL(p, site).href}</loc></url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};
