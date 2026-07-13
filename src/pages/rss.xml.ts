// rss.xml — a feed of announcements, so families can subscribe
// with any RSS reader and never miss a post. Builds automatically
// from src/content/announcements/ — nothing to maintain here.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async ({ site }) => {
  const announcements = (await getCollection('announcements')).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
  );

  const items = announcements
    .map(
      (a) => `    <item>
      <title>${escape(a.data.title)}</title>
      <link>${new URL('/announcements/', site).href}</link>
      <guid isPermaLink="false">${a.id}</guid>
      <pubDate>${a.data.date.toUTCString()}</pubDate>
      <description>${escape(a.body ?? '')}</description>
    </item>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>the desk — announcements</title>
    <link>${site?.href}</link>
    <description>announcements from the desk — us history, economics, and law.</description>
    <language>en-us</language>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};
