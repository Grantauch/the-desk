import type { Person } from '../../../../src/lib/storyhub/model';

const profiles = [
  [
    "yamamoto",
    "Isoroku Yamamoto",
    "Admiral · Commander in Chief, Combined Fleet, Imperial Japanese Navy",
    "1884–1943",
    "Yamamoto pressed for a carrier attack against the U.S. Pacific Fleet. He saw an early strike as a way to buy Japan time.",
    "He had studied and served in the United States and understood its ability to build ships and aircraft over a long war.",
    "He promoted a surprise attack and pressed the naval leadership to back it. The judgment rested on assumptions about what the United States would do afterward.",
    [
      "Yamamoto grew up in Nagaoka and pursued a career in the Imperial Japanese Navy. Before the war he served as a naval attaché in Washington and advocated greater attention to aviation within the navy.",
      "He commanded the Combined Fleet from 1939. Nagumo commanded the carrier force at sea. Fuchida led the first air wave. Yamamoto was killed in 1943 after U.S. forces intercepted information about his flight."
    ],
    "yamamoto",
    {
      "people": [
        "nagumo",
        "fuchida",
        "aircrews"
      ],
      "events": [
        "force-leaves",
        "attack-start"
      ],
      "places": [
        "japan",
        "north-pacific"
      ],
      "notes": [
        "goals"
      ],
      "sources": [
        "portrait-yamamoto",
        "strategy",
        "navy-time"
      ]
    }
  ],
  [
    "nagumo",
    "Chūichi Nagumo",
    "Vice admiral · Commander of the carrier force, Imperial Japanese Navy",
    "1887–1944",
    "Nagumo commanded the fleet that carried out the attack. Decisions made at sea were his responsibility.",
    "Reports came from returning aircrews and scouts. He could assess his own ships and aircraft but lacked firm locations for the U.S. carriers.",
    "After the planned waves returned, Nagumo withdrew. The record supports competing judgments about the costs and likely results of a further raid.",
    [
      "Nagumo led the First Air Fleet during the Pearl Harbor operation. His carrier force later fought at Midway, where Japan lost four aircraft carriers.",
      "His role differed from Yamamoto’s. Yamamoto oversaw the Combined Fleet and promoted the plan. Nagumo led the force that executed it."
    ],
    "nagumo",
    {
      "people": [
        "yamamoto",
        "fuchida"
      ],
      "events": [
        "force-leaves",
        "second-wave",
        "attack-ends"
      ],
      "places": [
        "north-pacific",
        "hawaii"
      ],
      "notes": [
        "withdrawal"
      ],
      "sources": [
        "portrait-nagumo",
        "navy-time",
        "midway"
      ]
    }
  ],
  [
    "fuchida",
    "Mitsuo Fuchida",
    "Commander · First-wave air leader, Imperial Japanese Navy",
    "1902–1976",
    "Fuchida led the first wave of Japanese aircraft from the carrier Akagi.",
    "As an airborne commander, he could see parts of the attack unfold and signal that surprise had been achieved. His view was limited to what he could observe and what others reported.",
    "He directed the opening operation in the air. His later accounts are a historical source whose claims can be compared with contemporary documents.",
    [
      "Fuchida was a career naval aviator. His papers include accounts, correspondence and other records from the war and his life afterward.",
      "His postwar writing became influential in English. Scholars use it alongside other records because participant memories can change and may describe events outside their direct view."
    ],
    "first-wave",
    {
      "people": [
        "nagumo",
        "aircrews",
        "yamamoto"
      ],
      "events": [
        "launch",
        "attack-start"
      ],
      "places": [
        "north-pacific",
        "pearl-harbor"
      ],
      "notes": [
        "source-perspective"
      ],
      "sources": [
        "fuchida-papers",
        "navy-time",
        "attack-photo"
      ]
    }
  ],
  [
    "roosevelt",
    "Franklin D. Roosevelt",
    "President · United States",
    "1882–1945",
    "Roosevelt led the United States through the Depression and most of World War II.",
    "His administration knew U.S.–Japanese talks had deteriorated. Reports on December 7 established that the attack was part of a wider offensive.",
    "He presented the attack to Congress and asked for war with Japan. Congress made the formal declaration.",
    [
      "Before December 1941, Roosevelt aided nations fighting the Axis while the United States stayed outside the war as a formal combatant. His government also restricted trade with Japan.",
      "In his December 8 address, Roosevelt drew on reports from across the Pacific to describe the scale of the crisis. The prepared text and the recording offer two ways to examine his argument."
    ],
    "roosevelt",
    {
      "people": [
        "kimmel"
      ],
      "events": [
        "oil",
        "hull-note",
        "address",
        "europe-war"
      ],
      "places": [
        "washington",
        "hawaii"
      ],
      "notes": [
        "speech-context"
      ],
      "sources": [
        "road",
        "charter",
        "speech-transcript",
        "portrait-fdr"
      ]
    }
  ],
  [
    "kimmel",
    "Husband E. Kimmel",
    "Admiral · Commander in Chief, U.S. Fleet and Pacific Fleet",
    "1882–1968",
    "Kimmel was the senior Navy commander at Pearl Harbor when the attack occurred.",
    "The Navy had warned of war, with attention focused on possible Japanese moves in Asia. Kimmel did not have confirmed knowledge of an air attack on Oʻahu that morning before it began.",
    "His command had to judge the submarine report on its own information chain. Later investigations debated both his decisions and the intelligence available to him.",
    [
      "Kimmel assumed Pacific Fleet command in February 1941. Training and the readiness of ships and crews in Hawaiian waters fell under his responsibility.",
      "Following the attack he was relieved of command, as was General Short. Examining the evidence each commander had helps answer a more precise question than assigning blame alone."
    ],
    "kimmel",
    {
      "people": [
        "short",
        "ward-crew"
      ],
      "events": [
        "war-warning",
        "ward",
        "attack-start"
      ],
      "places": [
        "pearl-harbor",
        "oahu"
      ],
      "notes": [
        "warning-logic"
      ],
      "sources": [
        "kimmel",
        "portrait-kimmel",
        "ward-analysis",
        "navy-time"
      ]
    }
  ],
  [
    "short",
    "Walter C. Short",
    "Lieutenant general · Hawaiian Department, U.S. Army",
    "1880–1949",
    "Short commanded the Army forces that defended the territory.",
    "Washington warned his command of worsening relations and possible hostile action. The local Army and Navy did not have a common picture of the threats on December 7.",
    "Short took steps shaped by the threat of sabotage, including concentrating aircraft where guards could watch them. The positioning made some aircraft easier to damage in air raids.",
    [
      "Short became commander of the Hawaiian Department in 1941. Army responsibilities included radar, aircraft and coastal defense.",
      "The Army radar station at Opana detected the first air wave, but its operators’ report did not trigger a general alert. The photograph shows a station in his command."
    ],
    "opana",
    {
      "people": [
        "kimmel",
        "radar-team"
      ],
      "events": [
        "war-warning",
        "opana-return",
        "attack-start"
      ],
      "places": [
        "opana",
        "wheeler",
        "hickam"
      ],
      "notes": [
        "warning-logic"
      ],
      "sources": [
        "navy-time",
        "ward-analysis",
        "airfields"
      ]
    }
  ],
  [
    "doris-miller",
    "Doris Miller",
    "Mess attendant · USS West Virginia, U.S. Navy",
    "1919–1943",
    "Miller carried wounded sailors and used an anti-aircraft gun during the attack.",
    "He was on West Virginia when the ship was hit. His immediate decisions were guided by conditions on board, including the crew members he could help.",
    "Miller went to help on deck. He became the first Black sailor to receive the Navy Cross.",
    [
      "Miller grew up in Waco, Texas, and enlisted in 1939. The segregated Navy offered Black sailors a restricted set of roles, primarily service work. Miller was serving as a mess attendant at Pearl Harbor.",
      "He was killed in 1943 when the escort carrier Liscome Bay sank. The Navy portrait shows him after receiving the Navy Cross."
    ],
    "doris-miller",
    {
      "people": [
        "defenders",
        "nurses"
      ],
      "events": [
        "attack-start",
        "second-wave"
      ],
      "places": [
        "west-virginia"
      ],
      "sources": [
        "miller",
        "nps-time"
      ]
    }
  ],
  [
    "ward-crew",
    "USS Ward’s crew",
    "Destroyer crew · U.S. Navy",
    "",
    "Ward’s crew investigated a report and attacked a small submarine near the harbor entrance.",
    "The original report was uncertain. Seeing a periscope close to an incoming ship gave the crew direct evidence of a submarine contact.",
    "Lieutenant Commander William Outerbridge sent a radio report up the Navy chain. The report is a different source from the Army radar plot.",
    [
      "The patrol first responded to a message from USS Condor. Later reports put the firing at different minutes around 6:45 a.m.",
      "The crew's official account gives an unusually close view of what one ship observed and could report."
    ],
    "ward",
    {
      "people": [
        "kimmel",
        "radar-team"
      ],
      "events": [
        "condor",
        "ward",
        "ward-message"
      ],
      "places": [
        "pearl-entrance"
      ],
      "notes": [
        "warning-logic"
      ],
      "sources": [
        "ward-report",
        "ward-analysis"
      ]
    }
  ],
  [
    "radar-team",
    "The Opana radar team",
    "George Elliott and Joseph Lockard · U.S. Army",
    "",
    "Two Army privates caught a large radar return while practicing at Opana.",
    "They knew the size and movement of a group of aircraft. Their equipment could not identify the aircraft or their mission.",
    "They reported the detection. Lieutenant Kermit Tyler, at the information center, associated it with arriving American aircraft.",
    [
      "The two men were on an early morning radar shift. They stayed beyond the scheduled end of the shift and continued to use the set.",
      "The original plot preserves what the equipment showed. It also shows how differently a record can look before and after an event."
    ],
    "opana",
    {
      "people": [
        "short",
        "ward-crew"
      ],
      "events": [
        "opana-return",
        "opana-call"
      ],
      "places": [
        "opana"
      ],
      "media": [
        "radar-plot"
      ],
      "sources": [
        "radar",
        "nps-time",
        "ward-analysis"
      ]
    }
  ],
  [
    "aircrews",
    "Japanese planners and aircrews",
    "Imperial Japanese Navy",
    "",
    "Staff officers and aircrews prepared a large operation across a great distance.",
    "Crew members trained for specific roles. Planners had intelligence about the base, with uncertainty about where U.S. ships would be on the day.",
    "They carried out two coordinated air waves. What individual crew members could see and report varied by assignment.",
    [
      "Minoru Genda helped design the operation. Pilots, observers, mechanics and deck crews turned the plan into a working carrier operation.",
      "The aerial photograph of Ford Island shows one aircrew’s perspective. Pair it with American records and the later repair evidence."
    ],
    "first-wave",
    {
      "people": [
        "yamamoto",
        "nagumo",
        "fuchida"
      ],
      "events": [
        "force-leaves",
        "launch",
        "attack-start"
      ],
      "places": [
        "north-pacific",
        "oahu"
      ],
      "sources": [
        "navy-time",
        "attack-photo"
      ]
    }
  ],
  [
    "defenders",
    "American defenders and rescuers",
    "U.S. Navy, Marines and Army",
    "",
    "Ship crews and airfield personnel responded while the attack was still taking place.",
    "They knew what they could see or could learn from those nearby. Smoke, noise and broken communications could cut off that view.",
    "Crew members fought fires, moved wounded people and tried to reach trapped sailors. Some could also return fire or take off.",
    [
      "Arizona officer Samuel Fuqua described directing fire control and evacuation on a burning deck. The survivor statements from Oklahoma describe a different problem, getting off a ship that was rolling over.",
      "Each record helps establish what happened aboard a specific ship. Reading across ships separates the whole harbor picture from one person’s observation."
    ],
    "battleship-row",
    {
      "people": [
        "doris-miller",
        "nurses"
      ],
      "events": [
        "attack-start",
        "arizona-blast",
        "second-wave"
      ],
      "places": [
        "arizona",
        "oklahoma",
        "wheeler"
      ],
      "sources": [
        "fuqua",
        "oklahoma",
        "survivor-reports",
        "oral"
      ]
    }
  ],
  [
    "nurses",
    "Nurses and medical crews",
    "Army and Navy Nurse Corps · Oʻahu",
    "",
    "Military nurses and other medical personnel cared for the injured aboard ships and on shore.",
    "Personnel at different facilities saw different parts of the emergency as casualties arrived.",
    "Nurses on Solace and at Tripler tended wounded people while the raid and rescue work continued.",
    [
      "Army nurse Annie G. Fox was the chief nurse at Hickam Field. At other sites, groups of nurses mobilized wherever wounded people could reach them.",
      "The photograph shows Navy nurses aboard Solace later in the war, in 1945. It represents the ship’s medical service and does not depict the morning of the attack."
    ],
    "nurses",
    {
      "people": [
        "defenders",
        "doris-miller"
      ],
      "events": [
        "attack-start",
        "second-wave",
        "attack-ends"
      ],
      "places": [
        "hickam",
        "pearl-harbor"
      ],
      "sources": [
        "nps-time"
      ]
    }
  ],
  [
    "islanders",
    "Hawaiian civilians",
    "Native Hawaiian families and other residents of territorial Hawaiʻi",
    "",
    "Oʻahu was home to communities with lives and histories of their own.",
    "Residents saw and heard parts of the raid from farms, neighborhoods and workplaces. What caused a particular explosion was often unclear until later investigation.",
    "People sought shelter, cared for one another and helped document civilian injuries and deaths.",
    [
      "Native Hawaiian communities maintained relationships with the land and waters that existed long before the naval base. U.S. military expansion transformed their use of parts of the island.",
      "The National Park Service documents civilian casualties caused by the Japanese raid and by American anti-aircraft fire. Read these records alongside the harbor photographs."
    ],
    "prewar",
    {
      "people": [
        "residents",
        "nurses"
      ],
      "events": [
        "ford-morning",
        "martial-law"
      ],
      "places": [
        "oahu",
        "honolulu"
      ],
      "notes": [
        "puuloa"
      ],
      "sources": [
        "hawaii",
        "puuloa",
        "civilian"
      ]
    }
  ],
  [
    "residents",
    "Japanese American residents",
    "Citizens and immigrant families in Hawaiʻi and on the mainland",
    "",
    "People of Japanese ancestry were part of local communities across the islands, including many U.S. citizens.",
    "Most had no more information about the attack than their neighbors. Ancestry did not make local residents participants in the Imperial Japanese Navy’s decisions.",
    "Families confronted martial law, selective detention in Hawaiʻi and mass forced removal on the mainland. Many Japanese Americans also served in the U.S. military.",
    [
      "Japanese immigration to Hawaiʻi grew in the plantation era. By 1941, people of Japanese ancestry made up more than a third of the territorial population.",
      "Detention and martial law in Hawaiʻi differed from mass incarceration on the mainland. Honouliuli held civilians and prisoners of war in different sections, with different legal circumstances."
    ],
    "prewar",
    {
      "people": [
        "islanders",
        "roosevelt"
      ],
      "events": [
        "martial-law",
        "exclusion"
      ],
      "places": [
        "honolulu",
        "oahu"
      ],
      "notes": [
        "incarceration"
      ],
      "sources": [
        "hawaii",
        "martial",
        "eo9066"
      ]
    }
  ]
] as const;

export const people: Person[] = profiles.map(([id, name, role, life, overview, knew, decision, biography, visual, refs]) => ({
  id, name, role, life, overview, knew, decision, biography: [...biography], visual, refs,
}));
