import type { StoryEdition } from '../../../../src/lib/storyhub/model';
import { chapters } from './chapters';
import { glossary, notes, scenarios } from './context';
import { events } from './events';
import { media } from './media';
import { people } from './people';
import { layers, places, regions } from './places';
import { sources } from './sources';

export const pearlHarbor: StoryEdition = {
  schema: 2,
  work: {
    id: 'pearl-harbor',
    title: 'Pearl Harbor',
    subtitle: 'The Morning That Changed the World',
    collection: 'U.S. History',
    question: 'How did decisions across the Pacific converge on one morning, and what did that morning change?',
  },
  edition: {
    id: 'pearl-harbor-us-history-2026',
    route: '/storyhubs/pearl-harbor/',
    language: 'en',
    summary: 'Follow the decisions, warning signals and eyewitness records that converge on Oʻahu on December 7, 1941.',
    modes: ['scroll', 'chapter'],
    publication: 'public',
    activity: { type: 'explore' },
  },
  briefing: {
    what: [
      'In 1941, there were wars in Europe and Asia. Japan had occupied Manchuria and was fighting a much larger war in China. In 1940 and 1941, Japanese forces moved into French Indochina, closer to the oil and other resources their leaders wanted in Southeast Asia.',
      'The United States was still formally outside the war. It supplied countries fighting the Axis and tightened trade with Japan. After Japan moved into southern Indochina in July 1941, the U.S. froze Japanese assets and sales of American oil effectively stopped.',
      'Japanese planners saw the Pacific Fleet in Hawaiʻi as an obstacle to expansion south. The leaders of both countries continued talking while Japan prepared to fight. Several choices remained open, with major consequences for people across Asia and the Pacific.',
    ],
    significance: 'The attack brought the United States directly into World War II and changed people’s lives across the Pacific. Set the recorded sequence beside three alternatives, each with its own evidence and uncertainty.',
    scenarios,
  },
  chronology: {
    timeZone: 'Attack times use 1941 Hawaiʻi Standard Time (UTC−10:30). Dates in Tokyo and Washington are labeled where the difference matters.',
    scales: ['years', 'months', 'days', 'hours'],
    detailRange: { start: '1941-12-07T03:30', end: '1941-12-07T10:00' },
  },
  map: { regions, layers, initial: 'pacific' },
  people, events, places, notes, sources, media, glossary, chapters,
};
