// sitemap.xml — built at deploy time from the list below.
// If you add a page to src/pages/, add its path here too.
import type { APIRoute } from 'astro';

const paths = [
  '/',
  '/us-history/',
  '/economics/',
  '/law/',
  '/simulations/',
  '/games/',
  '/tools/',
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
