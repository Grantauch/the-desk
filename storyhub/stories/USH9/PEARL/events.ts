import type { Moment } from '../../../../src/lib/storyhub/model';

const rows = [
  [
    "overthrow",
    "1893-01-17",
    "January 17, 1893",
    "The Hawaiian Kingdom is overthrown",
    "A group backed by U.S. diplomatic and military presence overthrows Queen Liliʻuokalani’s government.",
    "The harbor’s land and water had a long Indigenous history before the U.S. built its naval base.",
    [
      "years"
    ],
    {
      "places": [
        "hawaii"
      ],
      "notes": [
        "puuloa"
      ],
      "sources": [
        "hawaii",
        "puuloa"
      ]
    },
    "pacific"
  ],
  [
    "annexation",
    "1898-07-07",
    "July 1898",
    "The United States annexes Hawaiʻi",
    "The United States annexes Hawaiʻi by joint resolution. The islands become a U.S. territory in 1900.",
    "The legal and political change preceded the naval base visible in the 1941 photograph.",
    [
      "years"
    ],
    {
      "places": [
        "hawaii",
        "pearl-harbor"
      ],
      "notes": [
        "puuloa"
      ],
      "sources": [
        "hawaii",
        "prewar"
      ]
    },
    "pacific",
    null,
    "prewar"
  ],
  [
    "manchuria",
    "1931-09-18",
    "September 1931",
    "Japan seizes Manchuria",
    "Japan’s Kwantung Army begins an occupation of Manchuria in northeastern China.",
    "The 1931 seizure and the broader 1937 war are distinct steps in a longer process of expansion.",
    [
      "years",
      "months"
    ],
    {
      "places": [
        "china",
        "japan"
      ],
      "notes": [
        "imperial-war"
      ],
      "sources": [
        "road"
      ]
    },
    "pacific"
  ],
  [
    "china-war",
    "1937-07-07",
    "July 1937",
    "War with China expands",
    "A clash near Beijing leads to full-scale war. Chinese resistance continues as Japan occupies major cities.",
    "The cost of continuing the war shaped Japan’s search for resources and U.S. policy toward Japan.",
    [
      "years",
      "months"
    ],
    {
      "places": [
        "china",
        "japan"
      ],
      "notes": [
        "imperial-war"
      ],
      "sources": [
        "road"
      ]
    },
    "pacific"
  ],
  [
    "tripartite",
    "1940-09-27",
    "September 27, 1940",
    "Japan, Germany and Italy sign the Tripartite Pact",
    "The three governments align while war is already underway in Europe and Asia.",
    "The treaty is part of the context for U.S. decisions. Germany’s December 1941 declaration was a separate decision.",
    [
      "months"
    ],
    {
      "places": [
        "japan"
      ],
      "sources": [
        "road",
        "ushmm"
      ]
    },
    "pacific"
  ],
  [
    "oil",
    "1941-07-26",
    "July 1941",
    "An asset freeze cuts off U.S. oil",
    "Japanese forces move into southern French Indochina. The United States freezes Japanese assets, and oil exports to Japan effectively stop.",
    "Economic pressure raised the costs of Japan’s existing policy. The documents show leaders continued to make choices under that pressure.",
    [
      "years",
      "months"
    ],
    {
      "people": [
        "yamamoto",
        "roosevelt"
      ],
      "places": [
        "indochina",
        "japan"
      ],
      "notes": [
        "oil-pressure"
      ],
      "sources": [
        "road"
      ]
    },
    "pacific"
  ],
  [
    "force-leaves",
    "1941-11-26",
    "November 26, 1941 · Japan date",
    "The carrier force sails",
    "Nagumo’s force leaves Japan for the North Pacific while diplomacy continues.",
    "The approach is shown as a broad historical region. A single line would imply greater certainty about positions than this lesson’s sources support.",
    [
      "months",
      "days"
    ],
    {
      "people": [
        "yamamoto",
        "nagumo",
        "aircrews"
      ],
      "places": [
        "north-pacific",
        "japan"
      ],
      "notes": [
        "goals"
      ],
      "sources": [
        "navy-time",
        "strategy"
      ]
    },
    "pacific"
  ],
  [
    "hull-note",
    "1941-11-26",
    "November 26, 1941 · Washington date",
    "The United States submits a proposal",
    "The Hull Note asks Japan to withdraw forces from China and Indochina as part of a wider agreement.",
    "This document is a U.S. proposal. Compare it with evidence of the departure of the force and Japan’s subsequent decision for war.",
    [
      "months",
      "days"
    ],
    {
      "people": [
        "roosevelt",
        "yamamoto"
      ],
      "places": [
        "washington",
        "china"
      ],
      "notes": [
        "oil-pressure",
        "contingency"
      ],
      "sources": [
        "hull",
        "road"
      ]
    },
    "pacific"
  ],
  [
    "war-warning",
    "1941-11-27",
    "November 27, 1941",
    "Washington warns Army and Navy commands",
    "The Pacific commands receive separate warnings about Japanese action. The Navy warning emphasizes that aggressive action is expected in the Pacific.",
    "A general warning differs from a confirmed location, time and form of attack.",
    [
      "days"
    ],
    {
      "people": [
        "kimmel",
        "short"
      ],
      "places": [
        "washington",
        "pearl-harbor"
      ],
      "notes": [
        "warning-logic"
      ],
      "sources": [
        "navy-time",
        "ward-analysis"
      ]
    },
    "oahu"
  ],
  [
    "decision",
    "1941-12-01",
    "December 1, 1941 · Japan date",
    "Japan’s leadership makes its final decision for war",
    "Japan’s leadership adopts the decision to go to war with the United States, Great Britain and the Netherlands.",
    "Naval movement had already begun. The final decision and the force’s departure were distinct events.",
    [
      "days"
    ],
    {
      "people": [
        "yamamoto",
        "nagumo"
      ],
      "places": [
        "japan",
        "north-pacific"
      ],
      "sources": [
        "road",
        "navy-time"
      ]
    },
    "pacific"
  ],
  [
    "ford-morning",
    "1941-12-07",
    "December 7, 1941 · before dawn",
    "Oʻahu on Sunday morning",
    "Ships are in port and soldiers, sailors and civilians begin their day around Oʻahu.",
    "The accompanying aerial photograph dates to 1940. It orients you to the setting rather than documenting the attack morning.",
    [
      "months",
      "days"
    ],
    {
      "people": [
        "islanders",
        "defenders"
      ],
      "places": [
        "oahu",
        "pearl-harbor"
      ],
      "sources": [
        "ford",
        "nps-time",
        "civilian"
      ]
    },
    "oahu",
    null,
    "ford-island"
  ],
  [
    "condor",
    "1941-12-07T03:50",
    "About 3:50 a.m.",
    "A possible periscope",
    "Minesweeper USS Condor signals USS Ward that its crew may have seen a periscope. Ward searches.",
    "The report is uncertain. Ward’s later contact provides a different kind of evidence.",
    [
      "hours"
    ],
    {
      "people": [
        "ward-crew"
      ],
      "places": [
        "pearl-entrance"
      ],
      "notes": [
        "warning-logic"
      ],
      "sources": [
        "ward-report",
        "nps-time"
      ]
    },
    "oahu",
    "warnings",
    "ward"
  ],
  [
    "launch",
    "1941-12-07T06:10",
    "About 6:10 a.m.",
    "First-wave aircraft begin launching",
    "The Japanese carriers launch the first group of aircraft north of Oʻahu.",
    "The precise positions of aircraft changed throughout the morning. The map shows broad geography.",
    [
      "hours"
    ],
    {
      "people": [
        "fuchida",
        "nagumo",
        "aircrews"
      ],
      "places": [
        "north-pacific"
      ],
      "sources": [
        "nps-time",
        "navy-time"
      ]
    },
    "pacific",
    null
  ],
  [
    "ward",
    "1941-12-07T06:45",
    "About 6:45 a.m.",
    "Ward attacks a submarine",
    "USS Ward attacks a midget submarine near the entrance to Pearl Harbor after seeing its periscope.",
    "Records distinguish when Ward sighted the submarine, when it fired and when it reported the contact. The minutes vary across accounts.",
    [
      "hours"
    ],
    {
      "people": [
        "ward-crew",
        "kimmel"
      ],
      "places": [
        "pearl-entrance"
      ],
      "notes": [
        "warning-logic"
      ],
      "sources": [
        "ward-report",
        "ward-analysis",
        "nps-time"
      ]
    },
    "oahu",
    "warnings",
    "ward"
  ],
  [
    "ward-message",
    "1941-12-07T06:51",
    "About 6:51 a.m.",
    "Ward sends a report to shore",
    "Ward radios that it attacked a submarine in defensive waters. The Navy begins assessing the report.",
    "The time a message was sent and the time it reached a particular officer are different questions.",
    [
      "hours"
    ],
    {
      "people": [
        "ward-crew",
        "kimmel"
      ],
      "places": [
        "pearl-entrance",
        "oahu"
      ],
      "notes": [
        "warning-logic"
      ],
      "sources": [
        "ward-report",
        "ward-analysis"
      ]
    },
    "oahu",
    "warnings"
  ],
  [
    "opana-return",
    "1941-12-07T07:02",
    "7:02 a.m.",
    "Opana detects a formation",
    "Army radar operators observe a strong return from aircraft approaching Oʻahu.",
    "The radar plot records the formation’s movement. The equipment did not tell the operators which aircraft they were seeing.",
    [
      "hours"
    ],
    {
      "people": [
        "radar-team",
        "short"
      ],
      "places": [
        "opana"
      ],
      "media": [
        "radar-plot"
      ],
      "notes": [
        "warning-logic"
      ],
      "sources": [
        "radar",
        "nps-time"
      ]
    },
    "oahu",
    "warnings",
    "radar-plot"
  ],
  [
    "opana-call",
    "1941-12-07T07:20",
    "About 7:20 a.m.",
    "The information center evaluates the report",
    "The radar operators relay what they saw. Lieutenant Tyler believes the aircraft may be the B-17s expected from the mainland.",
    "Tyler was interpreting an Army report. Ward’s earlier report traveled through Navy channels.",
    [
      "hours"
    ],
    {
      "people": [
        "radar-team",
        "short"
      ],
      "places": [
        "opana"
      ],
      "notes": [
        "warning-logic"
      ],
      "sources": [
        "nps-time",
        "ward-analysis"
      ]
    },
    "oahu",
    "warnings",
    "opana"
  ],
  [
    "kaneohe-hit",
    "1941-12-07T07:53",
    "About 7:53 a.m.",
    "Aircraft attack Kāneʻohe",
    "The naval air station on the east side of Oʻahu is struck at the start of the raid.",
    "The opening strikes took place at several locations. The times vary across reporting points.",
    [
      "hours"
    ],
    {
      "people": [
        "aircrews",
        "defenders"
      ],
      "places": [
        "kaneohe",
        "wheeler"
      ],
      "notes": [
        "geography"
      ],
      "sources": [
        "nps-time",
        "airfields"
      ]
    },
    "oahu",
    "first-wave"
  ],
  [
    "attack-start",
    "1941-12-07T07:55",
    "About 7:55 a.m.",
    "The attack reaches Pearl Harbor",
    "Aircraft attack naval ships and facilities around Ford Island. The raid also strikes airfields across Oʻahu.",
    "The photograph shows the attack already underway, with a plume beside USS West Virginia. Its precise exposure time is uncertain.",
    [
      "days",
      "hours"
    ],
    {
      "people": [
        "fuchida",
        "kimmel",
        "defenders"
      ],
      "places": [
        "pearl-harbor",
        "hickam",
        "wheeler"
      ],
      "media": [
        "first-wave"
      ],
      "notes": [
        "source-perspective"
      ],
      "sources": [
        "nps-time",
        "navy-time",
        "attack-photo"
      ]
    },
    "oahu",
    "first-wave",
    "first-wave"
  ],
  [
    "arizona-blast",
    "1941-12-07T08:06",
    "About 8:06 a.m.",
    "USS Arizona explodes",
    "A bomb hit is followed by a catastrophic explosion in Arizona’s forward magazines.",
    "Samuel Fuqua’s action report helps connect events aboard Arizona to what observers saw across the harbor.",
    [
      "hours"
    ],
    {
      "people": [
        "defenders"
      ],
      "places": [
        "arizona"
      ],
      "notes": [
        "ship-damage"
      ],
      "sources": [
        "nps-time",
        "fuqua",
        "loss"
      ]
    },
    "harbor",
    "first-wave",
    "battleship-row"
  ],
  [
    "second-wave",
    "1941-12-07T08:54",
    "About 8:54 a.m.",
    "The second wave strikes",
    "More Japanese aircraft attack the harbor and airfields. Fires and rescue work from the first wave continue.",
    "The 8:54 marker is a useful reference point. Arrival and departure times differed across the island.",
    [
      "hours"
    ],
    {
      "people": [
        "nagumo",
        "defenders",
        "nurses"
      ],
      "places": [
        "hickam",
        "bellows",
        "pearl-harbor"
      ],
      "notes": [
        "geography"
      ],
      "sources": [
        "nps-time",
        "navy-time",
        "aftermath"
      ]
    },
    "oahu",
    "second-wave",
    "attack-aftermath"
  ],
  [
    "nevada-grounded",
    "1941-12-07T09:10",
    "About 9:10 a.m.",
    "USS Nevada runs aground",
    "Already damaged, Nevada moves down the harbor, then runs aground rather than risking a sinking in the channel.",
    "The ship’s location at the end of the raid differs from its initial position on the mooring chart.",
    [
      "hours"
    ],
    {
      "people": [
        "defenders"
      ],
      "places": [
        "nevada"
      ],
      "notes": [
        "ship-damage"
      ],
      "sources": [
        "nps-time",
        "salvage"
      ]
    },
    "harbor",
    "second-wave"
  ],
  [
    "attack-ends",
    "1941-12-07T10:00",
    "By about 10 a.m.",
    "The raiders leave Oʻahu",
    "The air attack ends after two waves. Rescue and damage control continue.",
    "This approximate endpoint describes the raid as a whole. Individual action reports give different last-contact times.",
    [
      "hours"
    ],
    {
      "people": [
        "nagumo",
        "defenders",
        "nurses"
      ],
      "places": [
        "pearl-harbor",
        "oahu"
      ],
      "notes": [
        "withdrawal",
        "repair"
      ],
      "sources": [
        "navy-time",
        "nps-time",
        "salvage"
      ]
    },
    "oahu",
    null,
    "attack-aftermath"
  ],
  [
    "martial-law",
    "1941-12-07T18:00",
    "December 7 · later that day",
    "The territory goes under martial law",
    "The territorial governor declares martial law. Military authority extends into civilian life.",
    "This entry uses a date rather than a claimed exact hour. Martial law continued until October 1944.",
    [
      "days"
    ],
    {
      "people": [
        "residents",
        "islanders"
      ],
      "places": [
        "honolulu"
      ],
      "notes": [
        "incarceration"
      ],
      "sources": [
        "martial",
        "hawaii"
      ]
    },
    "oahu"
  ],
  [
    "address",
    "1941-12-08",
    "December 8, 1941 · Washington date",
    "Roosevelt addresses Congress",
    "Roosevelt asks for war with Japan after the attack. Congress declares war that day.",
    "The written document and recording make it possible to examine the president’s case directly.",
    [
      "years",
      "months",
      "days"
    ],
    {
      "people": [
        "roosevelt"
      ],
      "places": [
        "washington"
      ],
      "media": [
        "address"
      ],
      "notes": [
        "speech-context"
      ],
      "sources": [
        "speech",
        "speech-transcript",
        "declaration",
        "voices"
      ]
    },
    "pacific",
    null,
    "address"
  ],
  [
    "europe-war",
    "1941-12-11",
    "December 11, 1941",
    "Germany and Italy declare war",
    "Germany and Italy declare war on the United States. Congress responds with declarations of war on both.",
    "Pearl Harbor changed U.S. politics. The December 11 declarations were separate steps in the war’s expansion.",
    [
      "days"
    ],
    {
      "people": [
        "roosevelt"
      ],
      "places": [
        "washington"
      ],
      "notes": [
        "speech-context"
      ],
      "sources": [
        "declaration",
        "ushmm"
      ]
    },
    "pacific"
  ],
  [
    "exclusion",
    "1942-02-19",
    "February 19, 1942",
    "Executive Order 9066",
    "Roosevelt authorizes military commanders to establish exclusion areas. Implementation forces people of Japanese ancestry from West Coast communities.",
    "Compare what the order authorizes with what authorities did under it, and with the separate system of military rule in Hawaiʻi.",
    [
      "years",
      "months"
    ],
    {
      "people": [
        "roosevelt",
        "residents"
      ],
      "places": [
        "washington",
        "oahu"
      ],
      "notes": [
        "incarceration"
      ],
      "sources": [
        "eo9066",
        "martial"
      ]
    },
    "pacific"
  ],
  [
    "midway",
    "1942-06-04",
    "June 4–7, 1942",
    "The Battle of Midway",
    "U.S. carrier forces defeat Japan’s carrier force. Japan loses four fleet carriers.",
    "Midway connects to Pearl Harbor through surviving ships and aircrews, and through intelligence used in a different way.",
    [
      "years",
      "months"
    ],
    {
      "people": [
        "nagumo",
        "aircrews"
      ],
      "places": [
        "midway",
        "hawaii"
      ],
      "notes": [
        "repair"
      ],
      "sources": [
        "midway",
        "carriers"
      ]
    },
    "pacific"
  ],
  [
    "surrender",
    "1945-09-02",
    "September 2, 1945",
    "Japan formally surrenders",
    "Representatives sign the surrender instrument aboard USS Missouri in Tokyo Bay.",
    "Nearly four years of warfare followed Pearl Harbor. This document records the formal end of the war.",
    [
      "years"
    ],
    {
      "places": [
        "japan"
      ],
      "sources": [
        "surrender",
        "ushmm"
      ]
    },
    "pacific"
  ],
  [
    "memorial-opens",
    "1962-05-30",
    "May 30, 1962",
    "The Arizona Memorial is dedicated",
    "The memorial spans the sunken battleship alongside Ford Island.",
    "The structure and the wreck belong to two different moments. Compare the archival harbor and the memorial view.",
    [
      "years"
    ],
    {
      "places": [
        "arizona"
      ],
      "media": [
        "memorial"
      ],
      "notes": [
        "source-perspective"
      ],
      "sources": [
        "memorial",
        "loss"
      ]
    },
    "harbor",
    null,
    "memorial"
  ]
] as const;

export const events: Moment[] = rows.map(([id, date, label, title, description, evidence, scales, refs, region, layer, visual]) => ({
  id, date, label, title, description, evidence, scales: [...scales], refs, region, layer: layer ?? undefined, visual,
}));
