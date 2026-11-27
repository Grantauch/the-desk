import type { ContextNote, GlossaryTerm, Scenario } from '../../../../src/lib/storyhub/model';

const noteRows = [
  [
    "imperial-war",
    "Japan’s war in China",
    [
      "Japan’s leaders sought land, power and resources. The conquest of Manchuria preceded the full-scale invasion of China in 1937. Japanese forces committed mass violence against civilians and captured soldiers in places such as Nanjing.",
      "Chinese forces kept fighting. By 1941, Japan was trying to sustain a costly war as other nations put pressure on its trade."
    ],
    {
      "places": [
        "china",
        "japan"
      ],
      "events": [
        "manchuria",
        "china-war"
      ],
      "sources": [
        "road",
        "ushmm"
      ]
    }
  ],
  [
    "oil-pressure",
    "Why oil and trade mattered",
    [
      "Oil powered ships, aircraft and industry. The U.S. asset freeze and export restrictions after the move into southern Indochina made it much harder for Japan to buy oil.",
      "Japanese officials could negotiate, change imperial policy, or seek control of supplies by force. Each involved choices, risks and consequences for the people already at war in Asia."
    ],
    {
      "places": [
        "indochina",
        "southeast-asia"
      ],
      "events": [
        "oil",
        "hull-note"
      ],
      "sources": [
        "road",
        "hull"
      ]
    }
  ],
  [
    "goals",
    "Immediate and long-term goals",
    [
      "Damaging the fleet could temporarily protect Japan’s wider offensive. Getting the United States to accept Japanese domination in Asia was a longer-term political objective.",
      "The first claim is visible in ship damage. Testing the second requires evidence from the U.S. response, ship repairs and the Pacific War."
    ],
    {
      "people": [
        "yamamoto",
        "nagumo"
      ],
      "events": [
        "force-leaves",
        "address",
        "midway"
      ],
      "sources": [
        "strategy",
        "navy-time",
        "salvage"
      ]
    }
  ],
  [
    "puuloa",
    "Puʻuloa before the naval base",
    [
      "Pearl Harbor was Puʻuloa, a place connected to Native Hawaiian food, work and relationships to the land and water. Honouliuli, beside the west loch, is one ahupuaʻa, an Indigenous land division.",
      "The U.S. military expanded in a territory annexed after the overthrow of the Hawaiian Kingdom. The 1941 base photographs record one era in that much longer history."
    ],
    {
      "people": [
        "islanders",
        "residents"
      ],
      "places": [
        "pearl-harbor"
      ],
      "events": [
        "overthrow",
        "annexation"
      ],
      "sources": [
        "puuloa",
        "hawaii"
      ]
    }
  ],
  [
    "warning-logic",
    "A warning has an audience",
    [
      "The source, recipient and timing of a warning shape what action it can prompt. Navy personnel assessed a submarine report. Army personnel assessed a radar contact. Leaders in Washington saw diplomatic intercepts.",
      "Later investigators could place all three in one chronology. Those on duty in 1941 had separate channels, incomplete information and uncertain interpretations."
    ],
    {
      "people": [
        "radar-team",
        "ward-crew",
        "short",
        "kimmel"
      ],
      "events": [
        "ward",
        "opana-return"
      ],
      "media": [
        "radar-plot"
      ],
      "sources": [
        "ward-report",
        "ward-analysis",
        "radar"
      ]
    }
  ],
  [
    "source-perspective",
    "What can a source see?",
    [
      "A photograph freezes one angle at one moment. An action report tells you what its author could observe and what the author reconstructed shortly afterward.",
      "A later interview adds details and personal meaning. Its date and distance from the events matter. Use independent evidence to test where accounts agree and where their vantage points differ."
    ],
    {
      "media": [
        "first-wave",
        "radar-plot"
      ],
      "sources": [
        "attack-photo",
        "fuqua",
        "oral"
      ]
    }
  ],
  [
    "ship-damage",
    "Sunk, lost and repaired",
    [
      "Several ships settled into the shallow harbor. Some were raised, rebuilt and returned to service. Arizona remained where it sank, and Oklahoma was raised but never returned to combat.",
      "Observe how positions, damage and salvage each answer a different question about the fleet."
    ],
    {
      "places": [
        "arizona",
        "oklahoma",
        "tennessee",
        "west-virginia"
      ],
      "sources": [
        "mooring-chart",
        "salvage",
        "ships"
      ]
    }
  ],
  [
    "geography",
    "The attack across Oʻahu",
    [
      "Military aircraft and ships were spread across the island. The attack included both the harbor and airfields operated by the Army, Navy and Marines.",
      "Multiple reports of the starting time can describe different first strikes. Compare places and look at the timing labels before drawing a conclusion."
    ],
    {
      "places": [
        "hickam",
        "wheeler",
        "kaneohe",
        "ewa",
        "bellows"
      ],
      "events": [
        "kaneohe-hit",
        "attack-start",
        "second-wave"
      ],
      "sources": [
        "nps-time",
        "airfields"
      ]
    }
  ],
  [
    "repair",
    "A base does more than hold ships",
    [
      "A fleet needs fuel, repairs, people, aircraft and supply routes. Pearl Harbor sustained serious losses while much of its support infrastructure survived.",
      "Salvage at the harbor and work in mainland yards restored several battleships. The carriers that were away on December 7 remained central to the Pacific War."
    ],
    {
      "places": [
        "pearl-harbor",
        "west-coast",
        "midway"
      ],
      "events": [
        "attack-ends",
        "midway"
      ],
      "sources": [
        "salvage",
        "carriers",
        "midway"
      ]
    }
  ],
  [
    "withdrawal",
    "Why did the force withdraw?",
    [
      "Nagumo withdrew after the two waves. The returning aircrews had inflicted severe damage. The locations of U.S. carriers remained uncertain, and the Japanese force had its own constraints.",
      "Historians weigh the possible impact of damage to fuel and repair facilities against uncertainty about time, opposition and how much an additional raid could accomplish."
    ],
    {
      "people": [
        "nagumo",
        "yamamoto"
      ],
      "events": [
        "second-wave",
        "attack-ends"
      ],
      "sources": [
        "navy-time",
        "salvage"
      ]
    }
  ],
  [
    "speech-context",
    "From description to a declaration",
    [
      "Roosevelt’s address combined the shock of December 7 with reports of attacks elsewhere. His speech was a request to Congress. The votes and declarations were separate legal steps.",
      "The printed message and the spoken recording differ in small details. Where they change, the differences help you hear the speech as a public act delivered at a particular moment."
    ],
    {
      "people": [
        "roosevelt"
      ],
      "events": [
        "address",
        "europe-war"
      ],
      "media": [
        "address"
      ],
      "sources": [
        "speech",
        "speech-transcript",
        "declaration"
      ]
    }
  ],
  [
    "incarceration",
    "Martial law and forced removal",
    [
      "Martial law began in Hawaiʻi after the attack. Authorities selectively arrested and held people, including residents of Japanese ancestry. Military control continued until October 1944.",
      "On the mainland, a different policy forced families of Japanese ancestry to leave West Coast homes and incarcerated them. Executive Order 9066 enabled military exclusion and did not name a specific ethnic group. The policy’s implementation targeted people of Japanese ancestry."
    ],
    {
      "people": [
        "residents",
        "islanders"
      ],
      "events": [
        "martial-law",
        "exclusion"
      ],
      "sources": [
        "martial",
        "eo9066",
        "hawaii"
      ]
    }
  ],
  [
    "contingency",
    "How historical alternatives work",
    [
      "Start with a documented condition, then change one choice. Consider what would still be true after the change. Japan’s war in China and U.S. aid to the Allies would still shape events.",
      "When a source establishes a pressure or an option, it cannot tell you for certain which path a government would have taken."
    ],
    {
      "events": [
        "hull-note",
        "decision",
        "address",
        "europe-war"
      ],
      "sources": [
        "road",
        "hull",
        "ushmm"
      ]
    }
  ]
] as const;

export const notes: ContextNote[] = noteRows.map(([id, title, paragraphs, refs]) => ({ id, title, paragraphs: [...paragraphs], refs }));

export const scenarios: Scenario[] = [
  {
    "id": "actual",
    "title": "The historical sequence",
    "premise": "Japan attacks Pearl Harbor and other sites in the Pacific.",
    "documented": "Japan’s forces attacked Oʻahu on December 7. Congress declared war on Japan on December 8. The United States and Germany and Italy went to war on December 11.",
    "possibility": "The attack gave Roosevelt a direct case for war and moved Congress to act quickly.",
    "uncertainty": "The consequences involved further decisions by several governments, including the German and Italian declarations.",
    "refs": {
      "events": [
        "attack-start",
        "address",
        "europe-war"
      ],
      "sources": [
        "declaration",
        "ushmm"
      ]
    }
  },
  {
    "id": "negotiation",
    "title": "Negotiations continue",
    "premise": "Tokyo delays a final decision and accepts more talks.",
    "documented": "Negotiators exchanged proposals through November. The United States sought Japanese withdrawals, which Japan’s leadership strongly opposed.",
    "possibility": "A temporary agreement could have bought time or moderated part of the trade crisis.",
    "uncertainty": "The war in China and fundamental disagreements would continue. There is no guarantee that either government could accept or sustain a deal.",
    "refs": {
      "events": [
        "hull-note",
        "decision"
      ],
      "sources": [
        "hull",
        "road"
      ]
    }
  },
  {
    "id": "southern-war",
    "title": "Fighting begins elsewhere",
    "premise": "Japan omits the attack on Oʻahu but attacks to the south.",
    "documented": "Japan’s actual offensive involved the U.S.-controlled Philippines and British and Dutch interests, as well as Hawaiʻi.",
    "possibility": "An attack on an American territory or military force elsewhere could lead Congress to declare war after a different sequence of events.",
    "uncertainty": "We cannot know how an intact fleet at Pearl Harbor would have affected decisions or combat elsewhere.",
    "refs": {
      "places": [
        "southeast-asia",
        "hawaii"
      ],
      "notes": [
        "goals"
      ],
      "sources": [
        "navy-time",
        "speech-transcript",
        "ushmm"
      ]
    }
  },
  {
    "id": "delay",
    "title": "American entry is delayed",
    "premise": "Japan avoids an immediate clash with U.S. forces.",
    "documented": "The United States was already helping opponents of the Axis. A U.S. oil cutoff and fighting in Asia and Europe predated the raid.",
    "possibility": "American involvement might remain indirect for a time. A later incident, in the Pacific or Atlantic, could change that.",
    "uncertainty": "The timing of a later entry, the politics behind it and the timing of Germany’s choices would remain open.",
    "refs": {
      "events": [
        "oil",
        "europe-war"
      ],
      "notes": [
        "contingency"
      ],
      "sources": [
        "charter",
        "road",
        "ushmm"
      ]
    }
  }
];

export const glossary: GlossaryTerm[] = [
  [
    "Aircraft carrier",
    "A warship whose flight deck lets aircraft take off and land at sea."
  ],
  [
    "Ahupuaʻa",
    "A Hawaiian land division, often linking inland areas and the sea."
  ],
  [
    "Armada / fleet",
    "A group of naval vessels organized under a command."
  ],
  [
    "Asset freeze",
    "A restriction on moving or spending money and property. In 1941 it meant Japanese purchases needed U.S. approval."
  ],
  [
    "Battleship",
    "A large, armored warship built to fight with heavy guns."
  ],
  [
    "Belligerent",
    "A country formally taking part in a war."
  ],
  [
    "Counterfactual",
    "A reasoned exploration of what might follow if a historical event or choice were different."
  ],
  [
    "Imperialism",
    "The extension of one state’s power over other lands and peoples."
  ],
  [
    "Incarceration",
    "Confinement by authorities. In this story, people of Japanese ancestry were forcibly removed and confined."
  ],
  [
    "Inboard / outboard",
    "Inboard means closer to the shore or mooring. Outboard means farther from it, on the water side."
  ],
  [
    "Magazine",
    "A space aboard a ship where ammunition and explosives are stored."
  ],
  [
    "Martial law",
    "Military control of powers usually exercised by civilian government."
  ],
  [
    "Mooring",
    "A fixed place where a ship is secured in the water."
  ],
  [
    "Primary source",
    "A record made by people who took part in or observed the events being studied, or an object from the time."
  ],
  [
    "Radar",
    "Equipment that detects objects, such as aircraft, using reflected radio waves."
  ],
  [
    "Salvage",
    "Recovering a wreck or damaged ship so it, or parts of it, can be repaired or used."
  ],
  [
    "Surprise attack",
    "An attack that takes place before defenders know enough to prepare for it."
  ]
].map(([term, definition]) => ({ term, definition }));
