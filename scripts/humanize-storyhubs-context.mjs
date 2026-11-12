import { readFile, writeFile } from 'node:fs/promises';

const groups = [
  {
    name: 'The Margin',
    files: [
      new URL('../public/hubs/ush9-s01-the-margin.html', import.meta.url),
      new URL('./enrich-us-history-gold.mjs', import.meta.url),
    ],
    replacements: [
      [
        'This is not a story in which one villain pulls one lever. It is a systems story: a public work changes hands, ordinary decisions consume its safety margin, warnings fail to create enforcement, and the people downstream inherit the bill.',
        'Here is the basic problem. The dam was built with several ways to handle too much water. Over time, people removed or weakened those protections. Nobody had to wake up planning a disaster. They only had to keep choosing convenience while a whole town lived downhill.',
      ],
      [
        'Its spillway and five low discharge pipes gave water two ways out and operators a way to lower the reservoir before danger.',
        'Think of a bathtub with an overflow drain and a plug you can pull. The spillway handled extra water at the top. Five pipes near the bottom let workers lower the lake on purpose before it became dangerous.',
      ],
      [
        'The pipes, crest height, spillway opening, and engineered repair were each changed for an ordinary reason. Together, the changes reduced protection.',
        'One choice removed the drain. Another lowered the rim. Another made the overflow easier to clog. Each choice looked manageable by itself. Together, they left the lake with fewer safe ways to get rid of water.',
      ],
      [
        'A private club owned the lake. Mill towns occupied the valley. Courts rejected compensation while outside donors financed relief.',
        'The club controlled the lake and made the decisions. The towns below lived with the danger. After the flood, survivors and donors carried most of the cost because the courts made the club pay nothing.',
      ],
      [
        'The system had already stopped being a system.',
        'By the time the club got it, this was an abandoned dam, not a working public water system.',
      ],
      [
        'Safety was not just the height of the wall. It was the combined ability to store water, pass excess water, and intentionally release it before the lake reached the crest.',
        'The bathtub comparison helps here. Safety depended on the size of the tub, the height of its rim, the open overflow, and the ability to pull the drain. Weaken several of those at once and the water reaches the top much sooner.',
      ],
      [
        'A warning can lose force by surviving',
        'Why people stopped reacting',
      ],
      [
        "Concern did not end with Fulton's 1880 report. Warnings and scares recurred in 1881, 1885, 1887, and 1888. Each time the dam remained standing, the next warning became easier to treat as another rumor.",
        "Warnings and scares came in 1881, 1885, 1887, and 1888. Each time nothing happened, people learned the wrong lesson: the warning must have been exaggerated. It is like a fire alarm that goes off so often that people stop leaving the building.",
      ],
      [
        'Knowledge did not create authority.',
        'Knowing about the danger did not give anyone the power to fix it.',
      ],
      [
        "No effective regulator could require inspection, restore the outlet pipes, order the spillway cleared, or force the owners to rebuild. Warning without enforcement left the final decision with the risk's owners.",
        'There was no effective regulator that could inspect the dam and order repairs. Engineers could warn. Townspeople could worry. The owners still got the final say about a danger that pointed downhill at somebody else.',
      ],
      [
        'An earth dam cannot safely become its own spillway.',
        'Once water ran over the top, the dam began washing itself away.',
      ],
      [
        'Water crossed the lowered center of the crest, cut into loose fill, and enlarged a channel until the center collapsed. The lake emptied in roughly 36 to 45 minutes; estimates differ because no instrument was timing the breach.',
        'This was packed earth, not one solid slab of concrete. Water poured over the lowered middle, carried dirt away, opened a larger gap, and then carried even more dirt away. The lake emptied in roughly 36 to 45 minutes. Nobody was standing there with a stopwatch, so the honest answer is a range.',
      ],
      [
        'The legal system demanded proof that survivors could not realistically assemble.',
        'To win, survivors had to prove exactly who was legally at fault and exactly how each decision caused the flood.',
      ],
      [
        "Courts applied a negligence standard rather than automatic liability for keeping a dangerous reservoir. The club was a corporation, members' personal fortunes were shielded, founder Benjamin Ruff was dead, records were incomplete, and local juries lived inside the defendants' economic network.",
        "There was no rule saying that the owner of a dangerous reservoir automatically paid when it failed. Survivors had to prove negligence. The club's corporate structure protected members' personal fortunes, important records were missing, and some of the best-connected lawyers in the region were on the other side.",
      ],
      [
        'Philanthropy after the fact was not legal liability.',
        'A later donation was charity. It was not the same as being ordered to pay for the harm.',
      ],
    ],
    duplicateSectionId: 'margin-map-title',
  },
  {
    name: 'The Desk It Stopped At',
    files: [
      new URL('../public/hubs/hh-s01-the-desk-it-stopped-at.html', import.meta.url),
      new URL('./enrich-hidden-history-gold.mjs', import.meta.url),
    ],
    replacements: [
      [
        'A real document can be described inaccurately. This StoryHub keeps the paper’s identity, status, and evidentiary limits attached from the first page to the last.',
        'The paper is real. That does not make every story attached to it real. We are going to separate three questions people often mash together: Who wrote it? Did anyone approve it? Did it actually happen?',
      ],
      [
        'Date, sender, recipient, classification, signature, archival location, and release history establish the object before anyone argues about its meaning.',
        'First, make sure the thing is real. Check the date, author, recipient, signature, classification marks, and where the archive keeps it. That settles whether the document exists. It does not settle what happened next.',
      ],
      [
        'A staff paper, recommendation, approval, directive, and completed operation occupy different positions in a decision chain.',
        'Think about a football play. Drawing it on the whiteboard is one step. Putting it in the game plan is another. Calling it in the huddle is another. Actually running it is another. A proposal and an operation are that far apart.',
      ],
      [
        'The memorandum proves what senior officials proposed. A new claim—especially about an unrelated event—requires new evidence.',
        'This memo proves that senior military leaders were willing to recommend these ideas. It cannot prove that someone approved them, that anyone carried them out, or that a different event years later was staged.',
      ],
      [
        'Bay of Pigs failed in three days.',
        'The United States had already tried to remove Castro. It went badly.',
      ],
      [
        'A CIA-backed Cuban exile force landed on April 17 and was defeated and captured. The public humiliation did not end the administration’s objective of removing Fidel Castro’s government.',
        'In April 1961, a CIA-backed force of Cuban exiles landed at the Bay of Pigs. Castro’s forces defeated it in three days. The failure embarrassed the Kennedy administration, but the United States kept looking for ways to weaken or remove Castro’s government.',
      ],
      [
        'Operation Mongoose reorganized the effort.',
        'Operation Mongoose was the next organized attempt.',
      ],
      [
        'The Cuba Project combined sabotage, propaganda, intelligence collection, and planning for possible American intervention under Brigadier General Edward Lansdale.',
        'Operation Mongoose, also called the Cuba Project, pulled sabotage, propaganda, spying, and invasion planning into one program. Brigadier General Edward Lansdale helped coordinate it.',
      ],
      [
        'Lansdale asked for pretexts.',
        'Lansdale asked the military for possible excuses to intervene.',
      ],
      [
        'The request went to the Joint Chiefs in writing. Their Caribbean Survey Group developed the response. The process was routine staff work; the content that moved through it was not.',
        'A pretext is the public reason used to justify an action when the real reason is different. Lansdale asked for possible pretexts in writing. A military staff group answered with Northwoods. The paperwork moved through normal channels even though the ideas inside it were extreme.',
      ],
      [
        'Senior adviser, not operational commander.',
        'Lemnitzer could recommend an operation. He could not order one by himself.',
      ],
      [
        'The Chairman of the Joint Chiefs was the highest-ranking uniformed officer and principal military adviser to the President and Secretary of Defense. The Joint Chiefs could assess, plan, and recommend; they could not independently order an operation.',
        'As Chairman of the Joint Chiefs, Lemnitzer was the top uniformed military adviser. His signature mattered. It showed that the proposal reached the highest military advisory level. The President and Secretary of Defense still held the authority to approve action.',
      ],
      [
        'Command authority ran around the Joint Chiefs.',
        'The chain of command did not run through the Joint Chiefs.',
      ],
      [
        'The document became public through a law and review process. Declassification changes who may read a record; it does not by itself prove every interpretation made about that record.',
        'This was not a mystery file dumped online by an anonymous account. A federal law created a review process, and the government released the document in 1997. Declassified means the public is now allowed to read it. It does not mean every claim made about it is automatically true.',
      ],
      [
        'A real archival link makes the whole package feel verified. But the document only verifies the statement written on its face; it cannot automatically verify the extra status or unrelated conclusion added during retelling.',
        'This is why the internet version can sound convincing: it starts with a real document. Then one retelling changes “proposed” to “planned,” another changes “planned” to “was going to happen,” and soon the citation is being used to prove something the paper never says.',
      ],
      [
        'Proving absence requires a method.',
        'How can we say it probably stopped if we cannot prove that every secret file has been found?',
      ],
      [
        'An approval or operation should have produced directives, tasking orders, unit records, and after-action reports. A collection complete enough to contain the proposal but none of those later artifacts is strong evidence that the chain stopped. It is still an argument from an expected record, not magical proof that no unknown paper could exist.',
        'An approved operation normally creates more paperwork: orders, assignments, unit records, and reports afterward. Researchers found the proposal but none of that follow-up trail. That is strong evidence that it stopped. It is not a magic guarantee that no unknown page could ever appear.',
      ],
      [
        'Neither half cancels the other. Treating a proposal as policy inflates the evidence; treating a rejected proposal as meaningless shrinks it. Historical maturity is the ability to keep both findings in the same sentence.',
        'Keep both parts. Senior military leaders really did sign and send a proposal built around deceiving the public. The proposal was not approved, and the released record shows no operation carrying it out. Leaving out either part gives students a worse version of the history.',
      ],
    ],
    duplicateSectionId: 'desk-map-title',
  },
  {
    name: 'The Death Harvest',
    files: [
      new URL('../public/hubs/bts-s01-the-death-harvest.html', import.meta.url),
      new URL('./enrich-storyhubs-gold.mjs', import.meta.url),
    ],
    replacements: [
      [
        'The famous version says Theodore Roosevelt and the forward pass saved football. This StoryHub tests that version against three different kinds of evidence.',
        'The clean version is easy to remember: football became deadly, Theodore Roosevelt stepped in, and the forward pass saved the sport. The real story is messier. We need to look at what the old rules rewarded, who could change them, and what happened after they did.',
      ],
      [
        'Newspapers created a national number from local reports. The deaths were real, but the total had no common definition or official collector.',
        'There was no national injury database. Newspapers built a season total by collecting reports from town after town. That makes the count imperfect, but it does not make the dead players imaginary.',
      ],
      [
        'Five yards in three downs, no neutral zone, and legal pushing made a massed run rational. Violence was built into the game’s incentives.',
        'Coaches were not choosing piles because they lacked imagination. The rules rewarded short, crowded runs. When five yards in three downs keeps the ball, smashing everyone into one spot starts to make strategic sense.',
      ],
      [
        'The President could apply pressure. Colleges controlled the rules. The organization they formed for safety eventually became the NCAA.',
        'Roosevelt could call powerful people into a room and make the problem national news. He could not rewrite college football’s rule book. The colleges had to do that, and the organization they created eventually became the NCAA.',
      ],
      [
        'The event did not change. The frame did.',
        'One death was local news. A running national list made the pattern visible.',
      ],
      [
        'A death reported in one town was local news. Wire services let sports pages add names from different places into one running season total. Once the number appeared beside standings and scores, readers could see a national pattern that no league or government office was tracking.',
        'Think of trying to understand today’s football injuries with no league database and no internet. Reporters clipped stories from different towns and added the names together. The list was messy, but it let readers see that this was bigger than one terrible game.',
      ],
      [
        'Three attempts made every yard expensive.',
        'Old football made a short gain feel like the only safe choice for the offense.',
      ],
      [
        'A team had only three downs to gain five yards. A failed outside run or an experimental play could force a punt, so coaches concentrated blockers and the runner at one point for a short, dependable gain.',
        'Picture a goal-line push on almost every important snap. A team had three downs to gain five yards. One failed outside run could force a punt, so coaches packed blockers around the runner and tried to grind out a few feet at a time.',
      ],
      [
        'The flying wedge was gone. Its logic survived.',
        'Officials banned one famous formation, but teams kept the same basic idea: build a human battering ram.',
      ],
      [
        'Sixty minutes, both directions.',
        'The same players took the hits on offense and defense.',
      ],
      [
        'Substitution was restricted, so players generally played offense and defense for the full game. Leather headgear was optional. Exhaustion and repeated mass plays compounded the danger created by the formation.',
        'Substitutions were limited. Many players stayed on the field for the whole game, playing offense and defense, while leather headgear was optional. By the fourth quarter, tired players were still meeting another full-speed pile.',
      ],
      [
        'Football’s political figure met football’s rule makers.',
        'The President had influence. The colleges had the rule book.',
      ],
      [
        'The schools agreed to enforce existing rules and discourage unnecessary roughness. No rule changed at the White House, no federal action followed, and Roosevelt did not claim a power to abolish football.',
        'The meeting ended with a promise to enforce the rules already on the books and cut unnecessary roughness. Roosevelt did not sign a football law, ban the sport, or write a new rule. The actual changes came later from the colleges and their committees.',
      ],
      [
        'Reform stories are easier to remember when one famous person commands a solution. The actual chain involved a death, a chancellor, two conventions, and a rules committee.',
        'The Roosevelt version sticks because one famous hero is easier to remember. The real chain included player deaths, an NYU chancellor who organized colleges, two meetings, and a committee that had the power to rewrite the rules.',
      ],
      [
        'Legal did not mean usable.',
        'The first legal forward pass was a pretty bad gamble.',
      ],
      [
        'An incomplete forward pass gave the ball to the opponent at the spot of the throw. A pass caught in the end zone was a touchback for the defense. The throw also had to cross the line at least five yards to one side of center.',
        'Miss the pass and the other team got the ball where you threw it. Complete it in the end zone and the defense got a touchback. You also could not throw from the middle of the field. Coaches looked at those penalties and mostly kept running.',
      ],
      [
        'Correlation is not a complete cause.',
        'The numbers tell us the first reform did not solve the problem. They do not tell us exactly why each player died.',
      ],
      [
        'The forward pass gets the legend. The safety change that endured was a redesign of formation, blocking, substitution, and field geometry.',
        'The forward pass gets the movie version. The bigger safety fix changed how many bodies could crowd behind the ball, how blockers could connect, whether teammates could shove the runner, and when exhausted players could rest.',
      ],
      [
        'The familiar NCAA came afterward.',
        'The NCAA did not begin as the giant sports business students know today.',
      ],
      [
        'Eligibility enforcement, the definition of amateurism, national championships, and broadcast contracts developed over the following century. They were not the institution’s founding purpose.',
        'Its first job was helping colleges write safer, shared rules. Eligibility enforcement, amateurism rules, national championships, and television money came later. The emergency committee outlived the emergency and grew into something much larger.',
      ],
    ],
  },
];

function replaceEverywhere(text, before, after) {
  if (text.includes(before)) return { text: text.split(before).join(after), changed: true };
  if (text.includes(after)) return { text, changed: false };
  throw new Error(`Could not find old or revised wording: ${before}`);
}

function collapseAdjacentDuplicateSection(text, id) {
  const startNeedle = `<section class="wrap instrument" aria-labelledby="${id}">`;
  const start = text.indexOf(startNeedle);
  if (start < 0) throw new Error(`Missing section ${id}`);
  const end = text.indexOf('</section>', start);
  if (end < 0) throw new Error(`Unclosed section ${id}`);
  const section = text.slice(start, end + '</section>'.length);
  let revised = text;
  while (revised.includes(section + section)) revised = revised.replace(section + section, section);
  return revised;
}

for (const group of groups) {
  for (const file of group.files) {
    let text = await readFile(file, 'utf8');
    let changed = false;
    for (const [before, after] of group.replacements) {
      const result = replaceEverywhere(text, before, after);
      text = result.text;
      changed ||= result.changed;
    }
    if (group.duplicateSectionId && file.pathname.includes('/public/hubs/')) {
      const deduped = collapseAdjacentDuplicateSection(text, group.duplicateSectionId);
      changed ||= deduped !== text;
      text = deduped;
    }
    if (changed) await writeFile(file, text);
  }
  console.log(`PASS ${group.name}: plain-language context installed`);
}
