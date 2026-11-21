import type { Evidence } from '../../../../src/lib/storyhub/model';

const evidenceRows = [
  [
    "pennsylvania-photo",
    "Pennsylvania, Cassin and Downes in dry dock, 80-G-32511",
    "U.S. Navy / National Archives",
    "https://www.history.navy.mil/content/history/nhhc/our-collections/photography/wars-and-events/world-war-ii/pearl-harbor-raid/attacks-in-the-navy-yard-area/uss-pennsylvania--cassin-and-downes-during-the-pearl-harbor-atta/80-G-32511.html",
    "Archival photograph",
    "Pennsylvania stands behind the damaged destroyers Downes and Cassin on December 7, 1941."
  ],
  [
    "frank-warnings",
    "The Three Missed Tactical Warnings That Could Have Made a Difference at Pearl Harbor",
    "Richard B. Frank, The National WWII Museum",
    "https://www.nationalww2museum.org/war/articles/pearl-harbor-missed-tactical-warnings",
    "Historical analysis",
    "An interpretation of how warnings worked in different commands and what an earlier alert might have changed."
  ],
  [
    "speech-audio",
    "Roosevelt’s December 8 address, original recording",
    "Franklin D. Roosevelt Presidential Library and Museum",
    "https://archive.org/details/FranklinDelanoRooseveltDayOfInfamySpeech",
    "Primary record",
    "Public-domain recording. The local clip includes the complete spoken address through the first seconds of the final applause."
  ],
  [
    "road",
    "Japan, China, the United States and the Road to Pearl Harbor",
    "Office of the Historian, U.S. Department of State",
    "https://history.state.gov/milestones/1937-1945/pearl-harbor",
    "Historical analysis",
    "A diplomatic overview of imperial expansion, the war in China, U.S. restrictions and the failed negotiations."
  ],
  [
    "hull",
    "Outline of proposed U.S.–Japanese agreement, November 26, 1941",
    "Foreign Relations of the United States",
    "https://history.state.gov/historicaldocuments/frus1941v04/d486",
    "Primary record",
    "The U.S. proposal, including the withdrawal of Japanese armed forces from China and Indochina."
  ],
  [
    "charter",
    "The Atlantic Conference and Charter, 1941",
    "Office of the Historian, U.S. Department of State",
    "https://history.state.gov/milestones/1937-1945/atlantic-conf",
    "Historical analysis",
    "American aid and Atlantic policy before entry into the war."
  ],
  [
    "nps-time",
    "December 7 chronology",
    "Pearl Harbor National Memorial, National Park Service",
    "https://www.nps.gov/perl/learn/historyculture/timeline.htm",
    "Historical analysis",
    "A park chronology of warnings, air raids and the response. Compare individual timestamps with contemporary records."
  ],
  [
    "navy-time",
    "H-Gram 085 and historical accounts of the raid",
    "Naval History and Heritage Command",
    "https://www.history.navy.mil/about-us/leadership/director/directors-corner/h-grams/h-gram-085.html",
    "Historical analysis",
    "Naval historian Samuel J. Cox discusses Japanese decisions, warning and surprise, both waves and their aftermath."
  ],
  [
    "salvage",
    "Pearl Harbor: Why, How, Fleet Salvage and Final Appraisal",
    "Naval History and Heritage Command",
    "https://www.history.navy.mil/research/library/online-reading-room/title-list-alphabetically/p/pearl-harbor-why-how.html",
    "Historical analysis",
    "Historian Homer N. Wallin examines the raid and the long effort to repair the Pacific Fleet. Wallin helped lead that salvage work."
  ],
  [
    "strategy",
    "Waging War: Yamamoto and World War II",
    "National Museum of the Pacific War",
    "https://www.pacificwarmuseum.org/learn/articles/waging-war",
    "Historical analysis",
    "Yamamoto’s position, knowledge of the United States and strategic thinking."
  ],
  [
    "ward-report",
    "USS Ward action report",
    "Naval History and Heritage Command",
    "https://www.history.navy.mil/content/history/nhhc/research/archives/digital-exhibits-highlights/action-reports/wwii-pearl-harbor-attack/ships-s-z/uss-ward-dd-139-action-report.html",
    "Primary record",
    "Lieutenant Commander William Outerbridge’s account of the submarine contact, action and report."
  ],
  [
    "ward-analysis",
    "USS Ward and the early warnings",
    "Naval History and Heritage Command",
    "https://www.history.navy.mil/about-us/leadership/director/directors-corner/h-grams/h-gram-001/h-001-2.html",
    "Historical analysis",
    "The Navy’s retrospective on the submarine incident and the separate Army radar report."
  ],
  [
    "radar",
    "Radar plot for December 7, 1941",
    "National Archives, RG 128",
    "https://www.archives.gov/legislative/features/pearl-harbor",
    "Primary record",
    "An Army radar record shows an approaching formation. The plot records movement without identifying nationality."
  ],
  [
    "survivor-reports",
    "Pearl Harbor survivor reports",
    "Naval History and Heritage Command",
    "https://www.history.navy.mil/research/library/online-reading-room/title-list-alphabetically/p/pearl-harbor-survivor-reports.html",
    "Primary record",
    "Ship-by-ship accounts from survivors, including USS Arizona and USS Oklahoma."
  ],
  [
    "oral",
    "Pearl Harbor oral history interviews",
    "Pearl Harbor National Memorial, National Park Service",
    "https://www.nps.gov/valr/learn/historyculture/oral-history-interviews.htm",
    "Later recollection",
    "Firsthand memories recorded after the event. The interviews are linked at their archive."
  ],
  [
    "voices",
    "Voices of World War II, 1937–1945",
    "National Archives",
    "https://www.archives.gov/research/military/ww2/sound-recordings.html",
    "Primary record",
    "The archive lists the KGU Honolulu broadcast during the attack and Roosevelt’s address to Congress."
  ],
  [
    "civilian",
    "Civilian casualties",
    "Pearl Harbor National Memorial, National Park Service",
    "https://www.nps.gov/perl/learn/historyculture/civilian-casualties.htm",
    "Historical analysis",
    "Research on civilians killed and injured across Oʻahu, including the effects of American anti-aircraft fire."
  ],
  [
    "loss",
    "People of Pearl Harbor",
    "Pearl Harbor National Memorial, National Park Service",
    "https://www.nps.gov/perl/learn/historyculture/people.htm",
    "Historical analysis",
    "Casualty and survivor accounts by ship and community."
  ],
  [
    "remembrance",
    "National Pearl Harbor Remembrance Day",
    "Pearl Harbor National Memorial, National Park Service",
    "https://www.nps.gov/perl/learn/historyculture/national-pearl-harbor-remembrance-day.htm",
    "Historical analysis",
    "Memorial totals for American deaths and injuries."
  ],
  [
    "puuloa",
    "Honouliuli Ahupuaʻa",
    "Honouliuli National Historic Site, National Park Service",
    "https://www.nps.gov/hono/learn/honouliuli-ahupua-a.htm",
    "Historical analysis",
    "Native Hawaiian relationships to land and water, with the long history of the district that includes the west loch of Pearl Harbor."
  ],
  [
    "hawaii",
    "Hawaiʻi, the Military, and the National Park",
    "National Park Service",
    "https://www.nps.gov/hale/learn/historyculture/upload/Hawaii-the-Military-and-the-National-Park-WWII-and-its-Impacts-on-Culture-and-the-Environment.pdf",
    "Historical analysis",
    "A historical study of territorial Hawaiʻi, Indigenous history and militarization, and the war’s impact on residents."
  ],
  [
    "martial",
    "Honouliuli historical overview",
    "Honouliuli National Historic Site, National Park Service",
    "https://www.nps.gov/hono/learn/historical-overview.htm",
    "Historical analysis",
    "Wartime martial law, selective detention and the camps in Hawaiʻi."
  ],
  [
    "eo9066",
    "Executive Order 9066, February 19, 1942",
    "National Archives",
    "https://www.archives.gov/milestone-documents/executive-order-9066",
    "Primary record",
    "The order enabled military exclusion, which led to forced removal and incarceration."
  ],
  [
    "ushmm",
    "Pearl Harbor",
    "United States Holocaust Memorial Museum",
    "https://encyclopedia.ushmm.org/content/en/article/pearl-harbor",
    "Historical analysis",
    "The attack, war declarations and the wider context of World War II."
  ],
  [
    "carriers",
    "Pacific Fleet carrier locations on December 7",
    "Naval History and Heritage Command",
    "https://www.history.navy.mil/content/history/nhhc/research/library/online-reading-room/title-list-alphabetically/c/carrier-locations.html",
    "Historical analysis",
    "Documents why Enterprise, Lexington and Saratoga were absent."
  ],
  [
    "midway",
    "Battle of Midway, June 1942",
    "Naval History and Heritage Command",
    "https://www.history.navy.mil/about-us/leadership/director/directors-corner/h-grams/h-gram-006/h-006-1.html",
    "Historical analysis",
    "The battle and the role of carriers and intelligence six months after Pearl Harbor."
  ],
  [
    "surrender",
    "Surrender of Japan, September 2, 1945",
    "National Archives",
    "https://www.archives.gov/milestone-documents/surrender-of-japan",
    "Primary record",
    "The formal instrument of surrender that ended World War II."
  ],
  [
    "speech",
    "Roosevelt’s address to Congress, December 8, 1941",
    "National Archives, Records of the U.S. Senate",
    "https://www.archives.gov/legislative/features/day-of-infamy",
    "Primary record",
    "Three pages of Roosevelt’s prepared message. The delivered recording has small differences from the written text."
  ],
  [
    "speech-transcript",
    "Joint Address to Congress and full written transcript",
    "National Archives",
    "https://www.archives.gov/milestone-documents/joint-address-to-congress-declaration-of-war-against-japan",
    "Primary record",
    "Transcription of the Senate’s copy of the written address, with context about the declaration."
  ],
  [
    "declaration",
    "Declaration of war with Japan",
    "U.S. Senate",
    "https://www.senate.gov/about/powers-procedures/declarations-of-war.htm",
    "Primary record",
    "The dates and votes for the U.S. declarations of war against Japan, Germany and Italy."
  ],
  [
    "portrait-yamamoto",
    "Isoroku Yamamoto, NH 63430",
    "Naval History and Heritage Command",
    "https://www.history.navy.mil/our-collections/photography/numerical-list-of-images/nhhc-series/nh-series/NH-63000/NH-63430.html",
    "Archival photograph",
    "An Imperial Japanese Navy portrait from the early 1940s, preserved in the files of Rear Admiral Samuel Eliot Morison."
  ],
  [
    "portrait-nagumo",
    "Chūichi Nagumo, NH 63423",
    "Naval History and Heritage Command",
    "https://www.history.navy.mil/content/history/nhhc/our-collections/photography/numerical-list-of-images/nhhc-series/nh-series/NH-63000/NH-63423.html",
    "Archival photograph",
    "Imperial Japanese Navy portrait, circa 1941–42, from the Morison files."
  ],
  [
    "fuchida-papers",
    "Mitsuo Fuchida papers",
    "Hoover Institution Library & Archives",
    "https://www.hoover.org/news/hoover-archives-acquires-captain-mitsuo-fuchida-papers",
    "Historical analysis",
    "Archive note on the first wave’s airborne commander and the record of his career."
  ],
  [
    "kimmel",
    "Husband E. Kimmel",
    "Naval History and Heritage Command",
    "https://www.history.navy.mil/our-collections/photography/us-people/k/kimmel-husband-e.html",
    "Historical analysis",
    "Service biography of the commander of the United States Fleet and Pacific Fleet."
  ],
  [
    "miller",
    "Doris Miller’s service and Navy Cross",
    "Naval History and Heritage Command",
    "https://www.history.navy.mil/content/history/nhhc/browse-by-topic/wars-conflicts-and-operations/world-war-ii/manning-the-us-navy/miller.html",
    "Archival photograph",
    "Service record and photographs, including his Navy Cross portrait."
  ],
  [
    "portrait-fdr",
    "Franklin D. Roosevelt, color portrait, 1944",
    "National Archives via Wikimedia Commons",
    "https://commons.wikimedia.org/wiki/File:FDR_1944_Color_Portrait.jpg",
    "Archival photograph",
    "Official wartime portrait. The image was made in 1944."
  ],
  [
    "prewar",
    "Pearl Harbor, October 30, 1941, 80-G-182874",
    "U.S. Navy / National Archives",
    "https://www.history.navy.mil/our-collections/photography/wars-and-events/world-war-ii/pearl-harbor-raid/pearl-harbor-in-1940-1941/80-G-182874.html",
    "Archival photograph",
    "Southwest-looking view of Ford Island, the Navy Yard and Hickam Field before the attack."
  ],
  [
    "ford",
    "Ford Island, May 3, 1940, 80-G-411117",
    "U.S. Navy / National Archives",
    "https://www.history.navy.mil/our-collections/photography/wars-and-events/world-war-ii/pearl-harbor-raid/pearl-harbor-in-1940-1941/80-G-411117.html",
    "Archival photograph",
    "Vertical view of Ford Island more than a year before the attack. Ship positions in this photo belong to 1940."
  ],
  [
    "attack-photo",
    "Pearl Harbor attack, NH 50930",
    "Naval History and Heritage Command",
    "https://www.history.navy.mil/our-collections/photography/wars-and-events/world-war-ii/pearl-harbor-raid/overall-views-of-the-pearl-harbor-attack/NH-50930.html",
    "Archival photograph",
    "A Japanese aerial photograph at the beginning of the attack, with Ford Island and a water plume beside USS West Virginia."
  ],
  [
    "ships",
    "Ships present at Pearl Harbor at 0800",
    "Naval History and Heritage Command",
    "https://www.history.navy.mil/research/library/online-reading-room/title-list-alphabetically/s/ships-present-at-pearl-harbor.html",
    "Historical analysis",
    "The harbor’s ship inventory, links to individual action reports and ship fates."
  ],
  [
    "row",
    "Battleship Row photograph, 80-G-32596",
    "U.S. Navy / National Archives",
    "https://www.history.navy.mil/content/history/nhhc/our-collections/photography/wars-and-events/world-war-ii/pearl-harbor-raid/post-attack-ship-salvage/general-views/80-G-32596.html",
    "Archival photograph",
    "A view across Battleship Row probably taken December 8. Arizona is still burning."
  ],
  [
    "mooring-chart",
    "Battleship Row station chart, NH 114475",
    "Naval History and Heritage Command",
    "https://www.history.navy.mil/our-collections/photography/numerical-list-of-images/nhhc-series/nh-series/NH-114000/NH-114475.html",
    "Primary record",
    "Navy chart of vessels at the harbor at the time of the attack. The rotated detail used here retains its original shorelines and station order."
  ],
  [
    "mooring-photo",
    "Aerial view of moorings, 80-G-387584",
    "U.S. Navy / National Archives",
    "https://www.history.navy.mil/content/history/museums/nmusn/explore/photography/wwii/wwii-pacific/us-entry-into-wwii-japanese-offensive/1941-december-7-japanese-attack-on-pearl-harbor/japanese-attack-battleship-row/80-g-387584.html",
    "Archival photograph",
    "A December 10 view of the south side of Ford Island including USS California."
  ],
  [
    "aftermath",
    "Battleship Row during the raid, 80-G-32416",
    "U.S. Navy / National Archives",
    "https://www.history.navy.mil/content/history/museums/nmusn/explore/photography/wwii/wwii-pacific/us-entry-into-wwii-japanese-offensive/1941-december-7-japanese-attack-on-pearl-harbor/japanese-air-attack/80-g-32416.html",
    "Archival photograph",
    "A view from the harbor showing fires and the capsized Oklahoma."
  ],
  [
    "airfields",
    "Attacks on U.S. aircraft and airfields",
    "National Museum of the United States Navy",
    "https://www.history.navy.mil/content/history/museums/nmusn/explore/photography/wwii/wwii-pacific/us-entry-into-wwii-japanese-offensive/1941-december-7-japanese-attack-on-pearl-harbor/us-aircraft-and-airfields.html",
    "Archival photograph",
    "An archival collection and overview of the raids on Oʻahu airfields."
  ],
  [
    "hickam-photo",
    "B-17 at Hickam Field, SC 127002",
    "U.S. Army Signal Corps / National Archives",
    "https://www.history.navy.mil/our-collections/photography/wars-and-events/world-war-ii/pearl-harbor-raid/attacks-on-airfields-and-aerial-combat/general-views/SC-127002.html",
    "Archival photograph",
    "A bomber after landing during the raid, with smoke rising in the distance."
  ],
  [
    "memorial",
    "USS Arizona Memorial and Arizona’s history",
    "Pearl Harbor National Memorial, National Park Service",
    "https://www.nps.gov/perl/learn/historyculture/uss-arizona.htm",
    "Archival photograph",
    "A U.S. Navy photograph shows the 1962 memorial above Arizona’s wreck."
  ],
  [
    "coastlines",
    "Natural Earth 1:10m land polygons, v5.1.2",
    "Natural Earth",
    "https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-land/",
    "Map data",
    "Public-domain shoreline data used as a geographic base. Markers and labels describe 1941. Modern administrative boundaries are omitted."
  ],
  [
    "rights-navy",
    "Scanning, copyright and citation information",
    "Naval History and Heritage Command",
    "https://www.history.navy.mil/content/history/nhhc/about-us/services-and-policies/scan-copyright.html",
    "Historical analysis",
    "NHHC identifies relevant restrictions in its catalog. Use the appropriate credit line."
  ],
  [
    "fuqua",
    "USS Arizona action report, Samuel G. Fuqua",
    "Naval History and Heritage Command",
    "https://www.history.navy.mil/research/archives/digital-exhibits-highlights/action-reports/wwii-pearl-harbor-attack/ships-a-c/uss-arizona-bb-39-action-report.html",
    "Primary record",
    "A survivor’s contemporary report from aboard Arizona, including the rescue and evacuation."
  ],
  [
    "oklahoma",
    "USS Oklahoma survivor statements",
    "Naval History and Heritage Command",
    "https://www.history.navy.mil/research/library/online-reading-room/title-list-alphabetically/p/pearl-harbor-survivor-reports/uss-oklahoma-reports-survivor-pearl-harbor.html",
    "Primary record",
    "Eyewitness statements describing the list, escape and evacuation on Oklahoma."
  ],
  [
    "portrait-kimmel",
    "Husband E. Kimmel, NH 82800",
    "Naval History and Heritage Command",
    "https://www.history.navy.mil/our-collections/photography/us-people/k/kimmel-husband-e/nh-82800.html",
    "Archival photograph",
    "The Pacific Fleet commander in his Pearl Harbor headquarters during 1941."
  ],
  [
    "fuchida-photo",
    "Mitsuo Fuchida, October 1941",
    "Imperial Japanese Navy via Wikimedia Commons",
    "https://commons.wikimedia.org/wiki/File:Lt.Com_Mitsuo_Fuchida.jpg",
    "Archival photograph",
    "Period image of Fuchida during training. The catalog records the public-domain status."
  ]
] as const;

export const sources: Evidence[] = evidenceRows.map(([id, title, institution, url, kind, description]) => ({
  id, title, institution, url, kind, description,
}));
