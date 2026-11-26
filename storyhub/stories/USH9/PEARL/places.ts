import type { MapLayer, MapRegion, Place } from '../../../../src/lib/storyhub/model';

const placesRows = [
  [
    "japan",
    "Japan",
    "pacific",
    [
      26.38,
      24.71
    ],
    "Region",
    "Japan’s government and naval command directed the war in China and plans to expand south. The carrier force assembled before sailing into the North Pacific.",
    {
      "people": [
        "yamamoto",
        "nagumo"
      ],
      "events": [
        "manchuria",
        "force-leaves"
      ],
      "sources": [
        "road",
        "navy-time"
      ]
    }
  ],
  [
    "china",
    "China",
    "pacific",
    [
      11.04,
      28.24
    ],
    "Region",
    "China resisted full-scale Japanese invasion from 1937. The war in China preceded U.S. entry into World War II and shaped attempts to reach a settlement in 1941.",
    {
      "events": [
        "china-war",
        "hull-note"
      ],
      "notes": [
        "imperial-war"
      ],
      "sources": [
        "road",
        "hull"
      ]
    }
  ],
  [
    "indochina",
    "French Indochina",
    "pacific",
    [
      6.75,
      50.59
    ],
    "Colonial territory",
    "Japanese troops moved into southern Indochina in 1941. Its location near British and Dutch colonial holdings deepened fears of further expansion.",
    {
      "events": [
        "oil"
      ],
      "notes": [
        "oil-pressure"
      ],
      "sources": [
        "road"
      ]
    }
  ],
  [
    "southeast-asia",
    "Southeast Asia",
    "pacific",
    [
      14.72,
      64.71
    ],
    "Region",
    "Oil and other resources in Southeast Asia figured in Japanese decisions. Officials calculated the risks of seizing supplies by force from European and American colonial powers.",
    {
      "events": [
        "oil",
        "decision"
      ],
      "notes": [
        "oil-pressure",
        "goals"
      ],
      "sources": [
        "road",
        "navy-time"
      ]
    }
  ],
  [
    "north-pacific",
    "North Pacific approach",
    "pacific",
    [
      47.85,
      17.65
    ],
    "Approximate area",
    "The Japanese carrier force approached Hawaiʻi across the North Pacific. This marker identifies a broad region of the historical voyage.",
    {
      "people": [
        "nagumo",
        "fuchida",
        "aircrews"
      ],
      "events": [
        "force-leaves",
        "launch"
      ],
      "notes": [
        "goals"
      ],
      "sources": [
        "navy-time",
        "nps-time"
      ]
    }
  ],
  [
    "hawaii",
    "Hawaiʻi",
    "pacific",
    [
      65.64,
      43.53
    ],
    "U.S. territory in 1941",
    "The island chain lies between the West Coast and the western Pacific. The Pacific Fleet’s presence at Pearl Harbor made it part of officials’ strategic calculations.",
    {
      "people": [
        "kimmel",
        "islanders"
      ],
      "events": [
        "annexation",
        "attack-start"
      ],
      "notes": [
        "puuloa",
        "goals"
      ],
      "sources": [
        "prewar",
        "hawaii",
        "navy-time"
      ]
    },
    "prewar"
  ],
  [
    "midway",
    "Midway",
    "pacific",
    [
      53.99,
      35.29
    ],
    "Atoll",
    "In June 1942, U.S. forces defeated Japan’s carrier force near Midway. Carrier aviation and advance knowledge helped shape a very different outcome from December 1941.",
    {
      "people": [
        "nagumo"
      ],
      "events": [
        "midway"
      ],
      "notes": [
        "repair"
      ],
      "sources": [
        "midway",
        "carriers"
      ]
    }
  ],
  [
    "west-coast",
    "U.S. West Coast",
    "pacific",
    [
      87.12,
      23.53
    ],
    "Region",
    "Pacific supply and repair routes connected Hawaiʻi with the mainland. Saratoga was in the San Diego area on December 7.",
    {
      "events": [
        "exclusion"
      ],
      "notes": [
        "incarceration",
        "repair"
      ],
      "sources": [
        "carriers",
        "eo9066"
      ]
    }
  ],
  [
    "washington",
    "Washington, D.C. (off map)",
    "pacific",
    [
      97,
      15
    ],
    "Off-map reference",
    "Washington lies east of this projection. Messages and decisions traveled between Washington and Hawaiʻi, then operating on clocks five and a half hours apart.",
    {
      "people": [
        "roosevelt"
      ],
      "events": [
        "hull-note",
        "address",
        "europe-war"
      ],
      "notes": [
        "speech-context"
      ],
      "sources": [
        "speech-transcript",
        "nps-time"
      ]
    },
    "address"
  ],
  [
    "oahu",
    "Oʻahu",
    "oahu",
    [
      50.7,
      39.62
    ],
    "Island",
    "Military facilities occupied a small part of a populated island. Read this map of historical places with the accounts of civilians, sailors and Army personnel.",
    {
      "people": [
        "islanders",
        "residents"
      ],
      "events": [
        "ford-morning",
        "martial-law"
      ],
      "notes": [
        "puuloa"
      ],
      "sources": [
        "hawaii",
        "civilian"
      ]
    },
    "prewar"
  ],
  [
    "opana",
    "Opana radar station",
    "oahu",
    [
      41.41,
      10.57
    ],
    "Army radar site",
    "Army operators on Oʻahu’s North Shore detected a large formation at 7:02 a.m. The plot recorded movement before the operators knew whose planes were approaching.",
    {
      "people": [
        "radar-team",
        "short"
      ],
      "events": [
        "opana-return",
        "opana-call"
      ],
      "media": [
        "radar-plot"
      ],
      "sources": [
        "radar",
        "nps-time"
      ]
    },
    "opana",
    [
      "warnings"
    ]
  ],
  [
    "pearl-harbor",
    "Pearl Harbor / Puʻuloa",
    "oahu",
    [
      49.3,
      71.89
    ],
    "Harbor",
    "The naval base occupied waters with a long Native Hawaiian history. Ford Island and the Navy Yard appear in photographs from before and during the raid.",
    {
      "people": [
        "kimmel",
        "defenders",
        "islanders"
      ],
      "events": [
        "ford-morning",
        "attack-start",
        "attack-ends"
      ],
      "notes": [
        "puuloa",
        "ship-damage"
      ],
      "sources": [
        "prewar",
        "puuloa",
        "mooring-chart"
      ]
    },
    "prewar",
    [
      "first-wave",
      "second-wave"
    ]
  ],
  [
    "pearl-entrance",
    "Pearl Harbor entrance",
    "oahu",
    [
      46.76,
      84.53
    ],
    "Historical warning site",
    "Ward reported attacking a small submarine in waters near the harbor entrance that morning. The marker gives the general area where the contact occurred.",
    {
      "people": [
        "ward-crew"
      ],
      "events": [
        "condor",
        "ward",
        "ward-message"
      ],
      "sources": [
        "ward-report",
        "ward-analysis"
      ]
    },
    "ward",
    [
      "warnings"
    ]
  ],
  [
    "hickam",
    "Hickam Field",
    "oahu",
    [
      52.68,
      80.38
    ],
    "Army airfield",
    "Japanese planes struck the Army airfield beside the harbor. Some newly arriving B-17 bombers made it down during the raid.",
    {
      "people": [
        "defenders",
        "short",
        "nurses"
      ],
      "events": [
        "attack-start",
        "second-wave"
      ],
      "sources": [
        "hickam-photo",
        "airfields"
      ]
    },
    "hickam",
    [
      "first-wave",
      "second-wave"
    ]
  ],
  [
    "wheeler",
    "Wheeler Field",
    "oahu",
    [
      38.73,
      50
    ],
    "Army airfield",
    "Wheeler housed Army fighter planes. Aircraft on the ground were damaged before many could take off.",
    {
      "people": [
        "defenders",
        "short"
      ],
      "events": [
        "kaneohe-hit",
        "attack-start"
      ],
      "notes": [
        "geography"
      ],
      "sources": [
        "airfields",
        "navy-time"
      ]
    },
    null,
    [
      "first-wave"
    ]
  ],
  [
    "kaneohe",
    "Kāneʻohe naval air station",
    "oahu",
    [
      76.06,
      56.98
    ],
    "Navy air station",
    "At the naval station on the eastern side of the island, Japanese planes struck Navy patrol aircraft at the beginning of the raid.",
    {
      "people": [
        "defenders"
      ],
      "events": [
        "kaneohe-hit"
      ],
      "sources": [
        "airfields",
        "nps-time"
      ]
    },
    null,
    [
      "first-wave"
    ]
  ],
  [
    "ewa",
    "ʻEwa Mooring Mast Field",
    "oahu",
    [
      35.77,
      82.08
    ],
    "Marine airfield",
    "Japanese aircraft struck Marine aviation at ʻEwa near the southwestern coast of Oʻahu.",
    {
      "people": [
        "defenders"
      ],
      "events": [
        "attack-start"
      ],
      "notes": [
        "geography"
      ],
      "sources": [
        "airfields",
        "navy-time"
      ]
    },
    null,
    [
      "first-wave",
      "second-wave"
    ]
  ],
  [
    "bellows",
    "Bellows Field",
    "oahu",
    [
      83.66,
      73.21
    ],
    "Army airfield",
    "Army planes on the eastern coast of the island came under attack. First- and second-wave accounts record different strikes at Bellows.",
    {
      "people": [
        "defenders"
      ],
      "events": [
        "second-wave"
      ],
      "sources": [
        "airfields",
        "navy-time"
      ]
    },
    null,
    [
      "first-wave",
      "second-wave"
    ]
  ],
  [
    "honolulu",
    "Honolulu",
    "oahu",
    [
      64.23,
      83.58
    ],
    "Civilian community",
    "People in Honolulu and other communities were killed or injured, including by falling American anti-aircraft rounds. Territorial officials declared martial law later that day.",
    {
      "people": [
        "islanders",
        "residents"
      ],
      "events": [
        "martial-law"
      ],
      "notes": [
        "incarceration"
      ],
      "sources": [
        "civilian",
        "martial"
      ]
    }
  ],
  [
    "ford-island",
    "Ford Island",
    "harbor",
    [
      36.86,
      33.91
    ],
    "Naval air station",
    "The island separated moorings on different sides of the harbor. Battleship Row lay on the southeast side. USS Utah was on the northwest side.",
    {
      "people": [
        "defenders"
      ],
      "events": [
        "attack-start"
      ],
      "media": [
        "ford-island",
        "battleship-row"
      ],
      "sources": [
        "ford",
        "mooring-chart",
        "ships"
      ]
    },
    "ford-island",
    [
      "first-wave"
    ]
  ],
  [
    "nevada",
    "USS Nevada (BB-36)",
    "harbor",
    [
      74.71,
      29.91
    ],
    "Battleship · F-8",
    "Moored alone near the northeastern end of the row. Nevada got underway after a torpedo hit and suffered further damage before being run aground. She was repaired and returned to service.",
    {
      "people": [
        "defenders"
      ],
      "events": [
        "nevada-grounded"
      ],
      "sources": [
        "mooring-chart",
        "ships",
        "salvage"
      ]
    },
    "battleship-row",
    [
      "first-wave",
      "second-wave"
    ]
  ],
  [
    "arizona",
    "USS Arizona (BB-39)",
    "harbor",
    [
      68.14,
      35.3
    ],
    "Battleship · F-7",
    "Moored inside the repair ship Vestal. A bomb hit led to an explosion in her forward magazines and killed 1,177 aboard. Her wreck remains in the harbor under the memorial.",
    {
      "people": [
        "defenders"
      ],
      "events": [
        "arizona-blast",
        "memorial-opens"
      ],
      "media": [
        "memorial"
      ],
      "sources": [
        "mooring-chart",
        "fuqua",
        "loss",
        "memorial"
      ]
    },
    "battleship-row",
    [
      "first-wave"
    ]
  ],
  [
    "tennessee",
    "USS Tennessee (BB-43)",
    "harbor",
    [
      61.71,
      38.43
    ],
    "Battleship · F-6, inboard",
    "Tennessee lay against the mooring inside West Virginia. Bombs and fire damaged the ship. She remained afloat, was repaired and returned to service.",
    {
      "people": [
        "defenders"
      ],
      "events": [
        "attack-start"
      ],
      "places": [
        "west-virginia"
      ],
      "sources": [
        "mooring-chart",
        "ships",
        "salvage"
      ]
    },
    "battleship-row",
    [
      "first-wave"
    ]
  ],
  [
    "west-virginia",
    "USS West Virginia (BB-48)",
    "harbor",
    [
      65.71,
      42.61
    ],
    "Battleship · F-6, outboard",
    "Moored outside Tennessee. West Virginia took torpedo and bomb hits and settled into the harbor. Rescuers later reached some trapped men. Doris Miller served here. West Virginia was raised, rebuilt and returned to combat in 1944.",
    {
      "people": [
        "doris-miller",
        "defenders"
      ],
      "events": [
        "attack-start",
        "second-wave"
      ],
      "places": [
        "tennessee"
      ],
      "sources": [
        "mooring-chart",
        "ships",
        "salvage",
        "miller"
      ]
    },
    "battleship-row",
    [
      "first-wave"
    ]
  ],
  [
    "maryland",
    "USS Maryland (BB-46)",
    "harbor",
    [
      56.29,
      44.52
    ],
    "Battleship · F-5, inboard",
    "Moored inside Oklahoma. Bombs damaged Maryland, which remained afloat. After repairs she returned to service early in 1942.",
    {
      "people": [
        "defenders"
      ],
      "events": [
        "attack-start"
      ],
      "places": [
        "oklahoma"
      ],
      "sources": [
        "mooring-chart",
        "ships",
        "salvage"
      ]
    },
    "battleship-row",
    [
      "first-wave"
    ]
  ],
  [
    "oklahoma",
    "USS Oklahoma (BB-37)",
    "harbor",
    [
      59.29,
      49.39
    ],
    "Battleship · F-5, outboard",
    "Oklahoma lay outside Maryland, closer to open water. She capsized after torpedo hits. A total of 429 aboard died and 32 trapped men were rescued. Oklahoma was raised but never fought again, and sank under tow in 1947.",
    {
      "people": [
        "defenders"
      ],
      "events": [
        "attack-start"
      ],
      "places": [
        "maryland"
      ],
      "sources": [
        "mooring-chart",
        "oklahoma",
        "loss",
        "salvage"
      ]
    },
    "attack-aftermath",
    [
      "first-wave"
    ]
  ],
  [
    "california",
    "USS California (BB-44)",
    "harbor",
    [
      43,
      56
    ],
    "Battleship · F-3",
    "The southernmost battleship along the row. Torpedoes and a bomb damaged California, which slowly settled into the harbor. She was raised, repaired and returned to combat in 1944.",
    {
      "people": [
        "defenders"
      ],
      "events": [
        "attack-start"
      ],
      "sources": [
        "mooring-chart",
        "mooring-photo",
        "salvage"
      ]
    },
    "moorings",
    [
      "first-wave"
    ]
  ],
  [
    "pennsylvania",
    "USS Pennsylvania (BB-38)",
    "harbor",
    [
      34.86,
      90.78
    ],
    "Battleship · Navy Yard dry dock",
    "The fleet flagship was in dry dock across the water from Battleship Row. Bombing damaged her and fires burned among ships in the dock. Pennsylvania was repaired and returned to service.",
    {
      "people": [
        "defenders",
        "kimmel"
      ],
      "events": [
        "second-wave"
      ],
      "sources": [
        "mooring-chart",
        "ships",
        "salvage",
        "pennsylvania-photo",
        "nps-time"
      ]
    },
    "pennsylvania",
    [
      "second-wave"
    ]
  ]
] as const;

export const places: Place[] = placesRows.map(([id, title, region, [x, y], type, description, refs, visual, layers]) => ({
  id, title, region, x, y, type, description, refs, visual: visual ?? undefined, layers: layers ? [...layers] : undefined,
}));

export const regions: MapRegion[] = [
  {
    id: 'pacific', title: 'Pacific', visual: 'pacific-map',
    description: 'Broad geographic context for 1941. The dashed line shows a reconstructed direction of travel across the North Pacific. Washington is off the map.',
    labels: [{ name: 'Pacific Ocean', x: 56, y: 58 }],
    movements: [{
      label: 'Carrier force approach, schematic', source: 'navy-time',
      points: [{ x: 28, y: 22 }, { x: 37, y: 14 }, { x: 49, y: 17 }, { x: 59, y: 23 }, { x: 65, y: 35 }],
    }],
  },
  { id: 'oahu', title: 'Oʻahu', visual: 'oahu-map', description: 'Historical sites on a present-day shoreline base. Marker positions identify general locations, including where the warning occurred.' },
  { id: 'harbor', title: 'Ford Island & moorings', visual: 'harbor-chart', description: 'Rotated detail of Navy station chart NH 114475. Markers identify the positions at the start of the raid. Pennsylvania is at the Navy Yard.' },
];
export const layers: MapLayer[] = [
  { id: 'warnings', title: 'Warnings', description: 'The Opana report and the Ward contact came from different parts of the island and separate commands.' },
  { id: 'first-wave', title: 'First wave', description: 'Highlighted places appear in first-wave records. The evidence describes overlapping events across Oʻahu.' },
  { id: 'second-wave', title: 'Second wave', description: 'Highlighted places connect to the second wave. Nevada’s pin shows its original berth.' },
];
