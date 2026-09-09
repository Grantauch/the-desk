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
    slug: 'ush9-l016-the-one-that-passed',
    href: '/hubs/ush9-l016-the-one-that-passed.html',
    title: 'the one that passed',
    course: 'us history 9',
    unit: 'unit 02 / the gilded age',
    period: '1867–1943',
    status: 'ready to teach',
    question: 'what happened when a labor demand became a law against other workers?',
    blurb:
      'Begin with Chinese railroad workers on strike in the Sierra Nevada. Handle the records of exclusion, cancelled return papers, and unequal proof — then follow the people who organized, refused, and fought back in court.',
    cover: '/storyhub/ush9/l016/assets/sierra.webp',
    coverAlt: 'AI-authored reconstruction of an empty railroad cut in the Sierra Nevada',
    topics: ['chinese exclusion', 'nativism', 'labor', 'equal protection', 'wong kim ark'],
    inside: [
      'Seven document-led interactions, including a fixed-outcome stamp register and a crossing that cannot outrun a law.',
      'The original exclusion statute and Wong Kim Ark’s photographed departure statement from the National Archives.',
      'A year-by-year record of exclusion from 1882 to repeal in 1943 and an annual quota of 105.',
      'Fourteen narrative sections, ten terms, six note repairs, source transparency, and a complete reduced-motion reading view.',
    ],
  },
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
    cover: '/storyhub/subday-20260908/margin/13-the-road.webp',
    coverAlt: 'Generated cyanotype-style reconstruction of the road across the South Fork dam',
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
    cover: '/storyhub/subday-20260908/desk/05-the-desk-it-stopped-at.webp',
    coverAlt: 'Generated reconstruction of a Cold War planning map stopped on an official desk',
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
    cover: '/storyhub/subday-20260908/harvest/01-the-tally.webp',
    coverAlt: 'Generated sepia reconstruction of a 1905 football death tally on a wooden desk',
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
  {
    slug: 'ush9-l015-who-showed-up',
    href: '/hubs/ush9-l015-who-showed-up.html',
    title: 'who showed up',
    course: 'us history 9',
    unit: 'unit 02 / the gilded age',
    period: '1877–1895',
    status: 'ready to teach',
    question: 'when workers stopped the trains, who arrived to make them move again?',
    blurb:
      'Four strikes across seventeen years reveal a system getting faster and more distant: local militia, outside troops, hired detectives, and finally a court order that could reach a national union without leaving the courtroom.',
    cover: '/storyhub/ush9/l015/assets/a01-rail-yard.svg',
    coverAlt: 'Authored paper-and-ink scene of an empty rail yard at first light',
    topics: ['great railroad strike', 'haymarket', 'homestead', 'pullman strike', 'labor injunctions'],
    inside: [
      'A rail-network timeline that shows the 1877 strike spreading city by city and records who answered it.',
      'A workday dial, a Pullman household ledger, and a step-by-step federal injunction instrument.',
      'Six visible plain-language bridges that explain local loyalty, private force, the eight-hour demand, the company-town loop, and why paper became more powerful than troops.',
      'A final comparison ladder and a note-repair table built around six common historical distortions.',
    ],
  },
  {
    slug: 'bts-l03-not-in-the-room',
    href: '/hubs/bts-l03-not-in-the-room.html',
    title: 'not in the room',
    course: 'beyond the scoreboard',
    unit: 'unit 01 / inventing american sport',
    period: '1876–1885',
    status: 'ready to teach',
    question: 'what changes when the people doing the work are missing from the meeting?',
    blurb:
      'Baseball owners create a league, set entry rules, and close the labor market while the players who produce the game are absent from the room. Students follow exactly where control moved and who gained it.',
    cover: '/storyhub/bts/l03/assets/cover-ledger.svg',
    coverAlt: 'Editorial ledger cover with an intentionally empty player chair',
    topics: ['national league origins', 'william hulbert', 'club ownership', 'reserve rule', 'player labor'],
    inside: [
      'A four-clause charter audit that makes students identify the problem each owner rule was designed to solve.',
      'A reserve-rule market that shows how one agreement can erase competing bids without making labor illegal.',
      'A pay-and-freedom plot that separates earning more from controlling where you may work.',
      'Visible classroom-language explanations, note repair, persistent notes, and a source register.',
    ],
  },
  {
    slug: 'hh-l06-two-sources',
    href: '/hubs/hh-l06-two-sources.html',
    title: 'two sources',
    course: 'hidden history',
    unit: 'unit 01 / the official story vs. the rumor',
    period: '1969–1974',
    status: 'ready to teach',
    question: 'when a hundred retellings trace back to one origin, how many sources do you really have?',
    blurb:
      'The “Paul is dead” rumor and the Watergate investigation put two very different source networks side by side. Students trace origins, collapse repeated claims, and test whether each conclusion can be disproved.',
    cover: '/storyhub/hh/l06/assets/cover-signal.svg',
    coverAlt: 'Editorial receiver dial contrasting repeated signals with independent signals',
    topics: ['source independence', 'corroboration', 'paul is dead', 'watergate', 'falsifiability'],
    inside: [
      'A backward trace that follows many rumor outlets to the same two Michigan origins.',
      'A source-deduplication instrument that distinguishes repeated work from independent evidence.',
      'A symmetric disproof test applied to both the rumor and the reporting method.',
      'Seven visible plain-language bridges, named-person placeholders, note repair, and transparent source limits.',
    ],
  },
  {
    slug: 'ush9-l018-the-debt-didnt-move',
    href: '/hubs/ush9-l018-the-debt-didnt-move.html',
    title: 'the debt didn’t move',
    course: 'us history 9',
    unit: 'unit 02 / the gilded age',
    period: '1870s–1896',
    status: 'ready to teach',
    question: 'what happens when the price of what you sell falls while the number you owe refuses to change?',
    blurb:
      'Wheat gets cheaper. The mortgage does not. A farm problem widens into rail regulation, cooperative organizing, the Colored Farmers’ Alliance, the Omaha Platform, free silver, and the strange 1896 bargain that helped swallow the party while leaving parts of its argument behind.',
    cover: '/storyhub/ush9/l018/assets/01-the-number-that-didnt-move.webp',
    coverAlt: 'Generated interpretive StoryHub art of an 1890s farmer facing a fixed debt while crop value falls',
    topics: ['populism', 'farm debt', 'railroad rates', 'free silver', 'farmers alliance', 'omaha platform'],
    inside: [
      'A wheat-price model that makes a fixed debt harder to pay as crop prices fall from 1891 to 1894.',
      'A two-sided railroad-rate field that keeps higher western freight rates and lower traffic density visible at the same time.',
      'The Colored Farmers’ Alliance as a main part of the agrarian story, including the collision between economic cooperation and racial power.',
      'Seven teaching interactions, a note-repair ending, and a source panel that separates generated narrative art from historical evidence.',
    ],
  },
];
