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
    slug: 'ush9-s01-the-margin',
    href: '/hubs/ush9-s01-the-margin.html',
    title: 'the margin',
    course: 'us history 9',
    unit: 'unit 02 / the gilded age',
    period: '1838–1889',
    status: 'ready to teach',
    question: 'how many ordinary decisions can a safety margin survive before there is no margin left?',
    blurb:
      'The South Fork dam begins as a state engineering project, is breached and abandoned, then returns as the centerpiece of a private club. Students follow the missing pipes, lowered crest, warnings, storm, flood path, liability fight, and the engineering disagreement that still matters.',
    cover: '/storyhub/subday/margin-cover.svg',
    coverAlt: 'Blueprint style cross section of the South Fork dam above a valley',
    topics: ['johnstown flood', 'south fork dam', 'gilded age wealth', 'liability', 'safety margin'],
    inside: [
      'A subtraction instrument that shows how safety features disappeared without inventing unsupported capacity percentages.',
      'The fifty-seven minute route from the dam to Johnstown and the accepted death toll of 2,209.',
      'Competing engineering conclusions presented as a real evidence disagreement rather than a fake certainty.',
      'Persistent student notes, note repair, reduced-motion support, and a source-transparency panel.',
    ],
  },
  {
    slug: 'hh-s01-the-desk-it-stopped-at',
    href: '/hubs/hh-s01-the-desk-it-stopped-at.html',
    title: 'the desk it stopped at',
    course: 'hidden history',
    unit: 'standalone / evidence lab',
    period: '1962–1997',
    status: 'ready to teach',
    question: 'what can a real declassified document prove — and where does the evidence stop?',
    blurb:
      'Operation Northwoods is real, signed, declassified, and routinely misused online. Students keep proposal, approval, and execution separate while following the paper from the Joint Chiefs to the desk where the released record stops.',
    cover: '/storyhub/subday/desk-cover.svg',
    coverAlt: 'Dark archival desk with a declassified 1962 memorandum',
    topics: ['operation northwoods', 'declassified records', 'primary sources', 'claim scope', 'corroboration'],
    inside: [
      'An annex instrument that separates what was proposed from what was approved or carried out.',
      'A status chain from request to draft to signed transmittal to the point where the released record stops.',
      'A claim ladder that makes students decide how far one genuine document can carry a later claim.',
      'Persistent student notes, note repair, reduced-motion support, and a source-transparency panel.',
    ],
  },
  {
    slug: 'bts-s01-the-death-harvest',
    href: '/hubs/bts-s01-the-death-harvest.html',
    title: 'the death harvest',
    course: 'beyond the scoreboard',
    unit: 'the national stage / standalone',
    period: '1905–1912',
    status: 'ready to teach',
    question: 'did the forward pass save football, or did the rule book need a deeper rewrite?',
    blurb:
      'Newspapers turn football deaths into a national tally, Roosevelt brings college leaders to the White House, and the sport rewrites its rules. Then the counts rise again. Students test the famous forward-pass story against the rule book and the messy newspaper series.',
    cover: '/storyhub/subday/death-harvest-cover.svg',
    coverAlt: 'Dark green football field with a 1905 program ledger and football',
    topics: ['1905 football crisis', 'theodore roosevelt', 'forward pass', 'ncaa origins', 'sports safety'],
    inside: [
      'A 1905 rule constraint test showing why mass plays made strategic sense under five yards in three downs.',
      'A season series that preserves conflicting newspaper totals instead of turning them into fake official data.',
      'The 1909 second crisis, the 1910 changes that attacked mass play directly, and the origins of the NCAA.',
      'Persistent student notes, note repair, reduced-motion support, and a source-transparency panel.',
    ],
  },
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
