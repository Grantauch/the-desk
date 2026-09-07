// storyhubs.ts — the StoryHub catalog.
// Add a new StoryHub by appending an entry. The /storyhubs/ page and the
// sitemap both read from this list, so nothing else needs editing.

export interface StoryHub {
  slug: string;
  href: string;
  title: string;
  course: string;
  unit: string;
  period: string;
  status: string;
  question: string;
  blurb: string;
  cover: string;
  coverAlt: string;
  topics: string[];
  inside: string[];
}

export const storyHubs: StoryHub[] = [
  {
    slug: 'ush9-l014-unions',
    href: '/hubs/ush9-l014-unions.html',
    title: 'unions & collective bargaining',
    course: 'us history 9',
    unit: 'unit 02 / the gilded age',
    period: '1869–1893',
    status: 'ready to teach',
    question: 'what changes when workers stop negotiating as individuals and begin acting together?',
    blurb:
      'A tiny secret society of Philadelphia garment cutters becomes the largest labor organization in the country, beats one of the richest railroad owners in America, grows almost sevenfold, and then collapses in about two years. The story runs from a locked room in 1869 to a five state strike that reached ten thousand workers and still lost.',
    cover: '/storyhub/ush9/l014/assets/a01-founding-room.webp',
    coverAlt:
      'Illustrated reconstruction of Philadelphia garment cutters meeting privately in 1869',
    topics: ['knights of labor', 'terence powderly', 'jay gould', 'haymarket', 'the afl'],
    inside: [
      'A scale you can move from one worker to ten thousand, with what actually changes for the employer and for the workers at every step.',
      'The firing of C. A. Hall in Marshall, Texas, followed out to the five states it stopped.',
      'Archival photographs of Jay Gould and Samuel Gompers from the Library of Congress, with the record for each.',
      'A note repair board and a source list students can check for themselves.',
    ],
  },
];
