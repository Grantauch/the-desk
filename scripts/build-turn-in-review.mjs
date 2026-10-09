import { readdir, readFile } from 'node:fs/promises';
import { reviewRequests } from './lib/turn-in-review-sheet.mjs';
const hubs = [];
for (const file of await readdir(new URL('../public/hubs/', import.meta.url))) {
  if (!file.endsWith('.html')) continue;
  const html = await readFile(new URL('../public/hubs/' + file, import.meta.url), 'utf8');
  if (!html.includes('/hubs/desk-save.js')) continue;
  hubs.push({ hub: file.replace(/\.html$/, ''), title: (html.match(/<title>([^<]+)/i)?.[1] || file).replace(/&amp;/g, '&').trim() });
}
const [reviewId = 101, rosterId = 102, linksId = 103, finishedId = 104] = process.argv.slice(2).map(Number);
const requests = reviewRequests({ reviewId, rosterId, linksId, hubs, finishedId });
const qaRequests = reviewRequests({ reviewId: 201, rosterId: 202, linksId: 0, title: 'Review QA', rosterTitle: 'Review QA Roster', progressTitle: 'Review QA Progress', defaultClass: 'QA Class A', defaultHub: 'qa-lesson-1', includeSupportTabs: false, hidden: true });
console.log(JSON.stringify({ hubs, requests, qaRequests }));
