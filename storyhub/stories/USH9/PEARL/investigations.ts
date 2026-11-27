import type { References } from '../../../../src/lib/storyhub/model';

type Entry = {
  title: string; date?: string; description: string; quote?: string; attribution?: string;
  fields?: { label: string; text: string }[]; refs: References;
};

export const strategy: Entry[] = [
  {
    title: 'An ongoing war in China', date: '1937–1941',
    description: 'Begin in China. Japanese expansion and Chinese resistance had already absorbed years of soldiers, equipment and fuel before the attack on Oʻahu.',
    refs: { places: ['china'], events: ['china-war'], sources: ['road'] },
  },
  {
    title: 'Pressures over oil', date: 'July 1941',
    description: 'Shift south to Indochina and Southeast Asia. Japanese troops’ advance into southern Indochina led to economic measures that cut off U.S. oil. Leaders in Tokyo saw supplies farther south, where colonial powers already controlled territories.',
    refs: { places: ['indochina', 'southeast-asia'], events: ['oil'], sources: ['road', 'hull'] },
  },
  {
    title: 'A fleet in the path of expansion', date: 'Late 1941',
    description: 'Find Hawaiʻi. The U.S. fleet’s base in the central Pacific made a Japanese offensive in the west more complicated. The map lets you compare the separation between Japan, Southeast Asia, Hawaiʻi and the mainland.',
    refs: { places: ['hawaii', 'west-coast'], people: ['yamamoto'], notes: ['goals'], sources: ['navy-time'] },
  },
];

export const planning: Entry[] = [
  {
    title: 'What surprise could accomplish',
    description: 'Yamamoto believed a sudden blow would keep the U.S. Pacific Fleet from immediately interfering with Japan’s operations to the south. In historical terms that was an immediate military objective.',
    fields: [{ label: 'Evidence to check', text: 'Read the first-wave record and compare which ships at Pearl Harbor were damaged and which naval forces were elsewhere.' }],
    refs: { people: ['yamamoto', 'nagumo'], notes: ['goals'], sources: ['strategy', 'navy-time'] },
  },
  {
    title: 'What distance demanded',
    description: 'A carrier force operating across the ocean depended on training, supplies and coordinated reports. The farther it traveled, the more its commanders depended on partial news about distant events.',
    fields: [{ label: 'Evidence to check', text: 'Compare the date of departure with the date of the final decision for war. Preparation gave the leadership options before it made its final choice.' }],
    refs: { events: ['force-leaves', 'decision'], places: ['north-pacific'], sources: ['navy-time', 'road'] },
  },
  {
    title: 'What a damaged fleet could tell them',
    description: 'A damaged ship was something crews could photograph. Whether the attack would change public opinion or shorten a war was a judgment. The scale of U.S. shipbuilding made a long war a serious concern for Japan’s planners.',
    fields: [{ label: 'Evidence to check', text: 'Read Roosevelt’s address and the repair record. Would either record support the assumption that a damaged fleet would make the United States give way?' }],
    refs: { notes: ['repair'], events: ['address', 'midway'], sources: ['salvage', 'speech-transcript'] },
  },
];

export const voices: Entry[] = [
  {
    title: 'Samuel Fuqua on board Arizona', date: 'Action report',
    description: 'Fuqua describes rescue boats taking wounded men off the ship. The paper records events he witnessed while working to evacuate the burning vessel. Follow his account of where people could move as conditions changed.',
    quote: 'This boat took all our stretcher cases off the quarterdeck.',
    attribution: 'Samuel G. Fuqua, USS Arizona survivor report',
    refs: { places: ['arizona'], events: ['arizona-blast'], sources: ['fuqua'] },
  },
  {
    title: 'A rescue on the Oklahoma', date: 'Survivor statements',
    description: 'Survivors described a ship rolling over and water closing off routes. Later, rescuers worked from outside the ship to reach people still inside. Each perspective answers a different question about the capsizing.',
    refs: { places: ['oklahoma'], media: ['oklahoma-rescue'], sources: ['oklahoma', 'loss'] },
  },
  {
    title: 'From a Honolulu rooftop', date: 'Contemporary radio',
    description: 'A KGU newsman described what he could see to listeners far from the raid. The National Archives lists that December 7 recording as 200(R)-54. Its immediacy makes it valuable evidence for what could be known while the attack was underway.',
    fields: [{ label: 'Reading alternative', text: 'The catalog entry identifies the place and context. The Park Service civilian record supplies a readable account of what happened in Honolulu and neighboring communities.' }],
    refs: { places: ['honolulu'], sources: ['voices', 'civilian'] },
  },
  {
    title: 'A nurse’s view from Solace', date: 'Later recollection',
    description: 'Nurse Lt. Willgrube remembered waking to the ship shaking and seeing smoke through a porthole. She recalled that nurses reported to duty and treated people brought aboard. The recollection preserves a view below the level of orders and air movements.',
    refs: { people: ['nurses'], media: ['nurses'], sources: ['nps-time', 'oral'] },
  },
];

export const warnings: Entry[] = [
  {
    title: 'USS Ward reports a submarine', date: 'About 6:45–6:51 a.m. · Navy',
    description: 'Ward’s action report describes an attack on a small submarine. Its crew could give a location and report its own actions.',
    fields: [
      { label: 'Who had it', text: 'The destroyer’s crew and Navy personnel who relayed and assessed the report on shore.' },
      { label: 'How it was read', text: 'The Navy had to confirm an unusual contact. A report sent by radio did not immediately become a fleet-wide alert.' },
      { label: 'Missing evidence', text: 'The report did not identify an approaching formation of aircraft.' },
    ],
    refs: { people: ['ward-crew', 'kimmel'], events: ['ward', 'ward-message'], sources: ['ward-report', 'ward-analysis'] },
  },
  {
    title: 'Opana tracks an approaching formation', date: '7:02 a.m. and after · Army',
    description: 'The operators detected a much larger radar return than they expected. The information center had a separate chain of command.',
    fields: [
      { label: 'Who had it', text: 'Radar operators George Elliott and Joseph Lockard. They passed the observation to the Army information center.' },
      { label: 'How it was read', text: 'The duty officer associated it with American aircraft expected from the mainland.' },
      { label: 'Missing evidence', text: 'The radar observations gave movement and distance. They gave no aircraft identities and carried no message about the submarine.' },
    ],
    refs: { people: ['radar-team', 'short'], events: ['opana-return', 'opana-call'], media: ['radar-plot'], sources: ['radar', 'nps-time'] },
  },
  {
    title: 'Washington sees diplomacy break down', date: 'December 7 · Washington',
    description: 'American officials saw intercepted diplomatic traffic and evidence that talks were about to end. The warning sent toward Hawaiʻi did not arrive in time.',
    fields: [
      { label: 'Who had it', text: 'Officials in Washington with access to decoded diplomatic messages.' },
      { label: 'How it was read', text: 'Messages pointed to a crisis and a time of delivery. Those clues could make a warning urgent.' },
      { label: 'Missing evidence', text: 'The diplomatic record did not describe the target on Oʻahu or identify the radar formation.' },
    ],
    refs: { people: ['roosevelt', 'kimmel', 'short'], notes: ['warning-logic'], sources: ['navy-time', 'nps-time', 'frank-warnings'] },
  },
];

export const infrastructure: Entry[] = [
  {
    title: 'Battleships', date: 'Immediate losses',
    description: 'Eight battleships in the harbor were damaged and some sank. Sailors and repair crews faced immediate loss of life, flooded spaces, fires and a long salvage operation.',
    fields: [{ label: 'Months later', text: 'Six eventually returned to service. Arizona and Oklahoma did not.' }],
    refs: { places: ['arizona', 'oklahoma', 'west-virginia'], notes: ['ship-damage'], sources: ['ships', 'salvage'] },
  },
  {
    title: 'Aircraft carriers', date: 'Absent from the harbor',
    description: 'Enterprise was returning from the Wake Island mission. Lexington was on a mission to deliver planes to Midway. Saratoga was on the West Coast.',
    fields: [{ label: 'Months later', text: 'Carrier forces were central in the Coral Sea and at Midway. Not all the carriers had the same fate. Lexington was lost in the Coral Sea.' }],
    refs: { events: ['midway'], places: ['west-coast', 'midway'], sources: ['carriers', 'midway'] },
  },
  {
    title: 'Fuel, repairs and submarines', date: 'Support capacity survives',
    description: 'Major oil storage, submarine facilities and much of the base’s repair capacity survived. Surviving equipment and people gave the Navy a way to recover, together with shipyards elsewhere.',
    fields: [{ label: 'Months later', text: 'The harbor continued to support operations and repair ships. These outcomes show why evaluating a base requires more than counting damaged ships.' }],
    refs: { notes: ['repair', 'withdrawal'], places: ['pearl-harbor'], sources: ['salvage', 'navy-time'] },
  },
  {
    title: 'The choice to withdraw', date: 'A debated decision',
    description: 'Nagumo withdrew after two waves. Historians assess different evidence about Japanese losses, how much time remained, the uncertain location of U.S. carriers and the potential effect of further damage.',
    fields: [{ label: 'Limits of the claim', text: 'The survival of the fuel and repair facilities is documented. The outcome of an additional raid remains a historical question.' }],
    refs: { people: ['nagumo'], notes: ['withdrawal'], sources: ['navy-time', 'salvage'] },
  },
];
