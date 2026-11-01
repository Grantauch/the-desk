# Checklings Design Bible

Copy of the live Design Bible (https://claude.ai/artifact/HcExvrJT5D5BuupKX4GJNH), owner Grant, as of Oct 29, 2026. The live doc wins if the two ever disagree. Only Grant or Claude edits this file.

## What Checklings is

Checklings is an original creature game that is half Pokémon and half Tamagotchi. Every student raises a Checkling that grows and gets stronger each time they check in to class. It is a new IP. No Pokémon names, art, moves or music appear anywhere.

The game serves two kinds of players in one world. Nurturers groom, feed, care for and decorate. Competitors level up, battle, craft potions and climb rankings. Neither path is required, and both feed the same Checkling. Both kinds of players meet in the Checkaverse, a shared town where students find each other and battle face to face.

The health system is what makes Checklings more than the sum of its influences. A Checkling's body responds to how it is treated. Too much food over time makes it obese. Too little over time makes it weak. Neglect long enough and it can die for good. Those effects carry into battle, so a nurturer's choices matter to a competitor and the other way around.

This document is the single source of truth. Any AI working on Checklings reads it first and builds toward it. If an older doc, board row or handoff disagrees with this one, this one wins.

## The core loop

A student checks in, finds out what happened to their Checkling overnight, takes care of it, then spends the rest of the visit on whatever they enjoy. A normal visit takes three to five minutes.

1. **Check in.** The PIN check-in records attendance and pays the day's growth: XP toward the next level plus a daily coin allowance. This is the only reliable source of growth, so coming to class is how a Checkling gets stronger.
2. **See the overnight report.** One short card shows what changed since the last visit. Hunger dropped. Weight went up. A sniffle started. A merchant restocked. The card makes the student want to act.
3. **Care.** Feed, groom, clean, play, rest, give medicine. Every care action moves real stats, and doing too much of one thing has a cost.
4. **Choose a path.** Ride the bus to the Checkaverse to find classmates and battle them, or stay in Kettle Creek to forage, catch, brew potions and decorate.
5. **Leave.** The body clock keeps running on school days. Tomorrow's report is already being written.

Every feature added to Checklings must plug into one of these five steps. A feature that does not is cut or held for later.

## The Checkling

Each student owns their Checklings. Nobody is handed a shared cast. Every student starts with exactly one, hatched at their first check-in, and it becomes their partner for the year. More are caught in the wild later.

**One system, not two.** Today a student has a hatched Checkling inside Check-In and a separate Pixel Camp with four founders everyone gets. These merge. The hatched Checkling is the partner in the game. Its species, name and earned streak carry over. Mochi, Bolt, Zee and Ember stop being a shared party and become the four starter species, chosen at hatch. The other three can be found later like any other species.

**Party and Den.** A student carries a party of up to three Checklings. Extra Checklings rest in the Den, where their body clocks are paused. A student who only wants one pet cares for one. A student who wants a team takes on more daily care. Three keeps a full party manageable in a five minute visit.

**Growth.** Levels run from 1 to 50. A check-in is the main source of XP. Battles and care give smaller amounts. The curve is tuned so steady attendance reaches the first evolution around six weeks in and the second near the end of first semester. Spotty attendance still grows, only slower.

**Stats.** Every Checkling carries two sets.

| Stat | Side | What moves it |
| --- | --- | --- |
| Fullness | Care | Drops on school days. Food raises it. |
| Weight | Care | Rises when fed while already full. Falls when underfed or exercised. |
| Hygiene | Care | Drops with time and play. Grooming raises it. |
| Mood | Care | Play, attention and a clean home raise it. Neglect lowers it. |
| Health | Care | Falls from sickness, extreme weight or long neglect. Medicine and good care restore it. |
| HP | Battle | Grows with level. Knocked out at zero, restored after the match. |
| Power | Battle | Grows with level. Raised slightly by obesity. |
| Stamina | Battle | Grows with level. Cut sharply by obesity and poor health. |
| Speed | Battle | Grows with level. Decides who moves first. |

**Personality.** Each species keeps the voice the founders already have. Mochi is an earnest optimist. Bolt inspects pebbles. Zee asks oddly specific questions. Ember is brave and burns the toast. New species get written the same way: one line of personality, one favorite routine, one way they react to care.

## Health and consequences

Every action in Checklings has a counter action, and pushing either one too far has a cost. A Checkling's body keeps score, and a Checkling pushed too far for too long can die for good.

**The ladder.** Care problems climb from bad to worse, but chance drives every step instead of fixed timers. Two neglected Checklings will not die on the same day. A tough one might hang on longer than expected, and an unlucky one might not.

1. **Condition.** One extreme gives a minor buff and a major penalty. Overfed becomes obese. Underfed becomes scrawny.
2. **Disease.** Staying in a condition too long, or slipping into it too often, raises the daily chance of a disease. A disease carries a major penalty on every stat it touches.
3. **Death.** The longer a disease goes untreated, the higher the daily chance of death.

**Every action and its counter.** This is the starting set.

| Care | Too much | Too little | Can lead to |
| --- | --- | --- | --- |
| Food | Obese: Power up a little, Stamina down a lot | Scrawny: Speed up a little, Power and HP down a lot | Heart trouble, chronic malnutrition |
| Play | Wired: Speed up a little, cannot rest that day | Bored: Guard up a little, Mood falls fast | Burnout, the Glooms |
| Rest | Lazy: HP up a little, Speed down a lot | Exhausted: Power up a little from adrenaline, misses more often | Couch rot, collapse |
| Grooming | Primped: Mood up a little, refuses to battle in mud or rain | Grimy: Takes hits a little better, catches colds easily | Mange |
| Training | Overtrained: Power up a little, Stamina capped | Out of shape: Mood up a little, battle stats slowly drift down | Torn muscle |
| Medicine | Overmedicated: Cured fast, then side effects | Untreated: No buff, the illness keeps going | Whatever went untreated gets worse |

The table will grow into thousands of outcomes over time. Each one is written as a content entry, not hard code, so new ones can be added constantly. The Tech section explains how.

**Rare instant death.** A few rare choices kill on the spot with no ladder. Drinking an untested potion, eating a glowing mushroom, feeding something that should never be eaten. These are gambles a student chose to take. Ordinary feeding and care never cause instant death.

**What never kills.** Being absent never kills. The body clock pauses on weekends, breaks and snow days, and the teacher can send a party to Day Care during a long absence. A server outage never kills. A battle knockout never kills, and the Checkling recovers fully after the match.

**The Checkling Cemetery.** Every Checkling that dies gets a cartoon headstone in a shared cemetery for its class, a little cartoon field every student in that class can visit. Each stone shows the name, species, level, days lived, cause of death and one dark humor epitaph written for that cause. Starting examples:

- Here lies Biscuit. Ate the whole thing. Then the other whole thing.
- Pip tried the purple potion. It was not grape.
- Licked the glowing mushroom. Regrets nothing. Regrets everything.
- Finally got that nap.
- Sparky measured everything except how much time was left.

The epitaph bank grows with every new cause of death, with several lines per cause so stones rarely repeat. Epitaphs joke about the Checkling and how it died, never about the student.

**After a death.** The student gets a new egg at their next check-in. There is no revive. Permanent means permanent.

## Battles

Battles are turn based in the Red/Blue mold: pick a move, both sides act, speed decides who goes first. The stamina system already in Pixel Camp stays. Strike, Guard, Recover and a signature move are a solid base, and the stump that telegraphs its next move is a good training dummy.

**Moves.** A Checkling knows up to four moves and learns new ones at set levels. When it learns a fifth, the student picks one to forget, the same as Red/Blue.

**Types.** The four founder regions become the first types: Meadow, Gear, Cosmic and Ember. Four more are added for the full roster: Tide, Stone, Storm and Shade. Each type is strong against two others and weak against two. The full chart is kept in one data file so it can be tuned without touching code.

**Walk up and battle. This is the core of the game.** Two students meet in the Checkaverse. One walks up to the other, faces them and sends a challenge. The other accepts or turns it down with a phrase. The battle opens on the spot. Both students pick a move each turn, and a turn timer of about 30 seconds keeps it moving. Players standing nearby can watch.

- Saying no is always free. A turned down challenger waits a few minutes before challenging the same player again.
- A student can set themselves to Busy and receive no challenges.
- The only thing at stake between players is rank points. Nobody loses a Checkling, an item or coins to another student.
- A player who leaves mid battle forfeits, and the other player wins.

**Everyone else to fight.**

| Opponent | Where | Reward |
| --- | --- | --- |
| Other players | Anywhere in the Checkaverse | Rank points, coins |
| Wild Checklings | Tall grass | XP, ingredients, a chance to catch |
| Training stumps | Kettle Creek practice yard | Badges, small XP |
| Town trainers | Set spots in Kettle Creek and the Checkaverse | Coins, items |
| The Champion | The Checkaverse arena, a ladder of four trainers | A title and a rare egg once per semester |

**Rankings.** Each class hour has a weekly battle ranking that resets every Monday, so a student who joins in March can still win a week. Nurturers get rankings too: longest living Checkling, best kept home and most species discovered.

**Potions.** Ingredients come from foraging and wild battles. The apothecary cauldron brews them into potions. A student can bring two items into a battle.

| Potion | Ingredients | Effect |
| --- | --- | --- |
| Strength tonic | Ember root, river stone | Power up for one battle |
| Stamina draught | Reed fiber, honey | Restores stamina mid battle |
| Clear tea | Mint, spring water | Cures a cold |
| Slim broth | Kelp, bitter leaf | Takes off weight over three days |

**Limits.** Battle XP is capped each day, so check-ins stay the main source of growth. Too many battles in a day causes Overtrained. Knockouts are never permanent.

## Collection and evolution

The long term goal is 300 Checkling lines, released in waves of twelve. Collecting them is the reason to keep exploring after the partner is strong.

| Group | Lines | How it changes | Forms |
| --- | --- | --- | --- |
| Two stage evolvers | 100 | Evolve by level, usually near 15 and 30 | 300 |
| One stage morphers | 100 | Evolve once. The form depends on care history | 200 or more |
| Non evolvers | 100 | Never evolve. Some can merge | 100 |
| Merge rares | Grows over time | Made only by merging two specific Checklings | One each |

**Care shapes evolution.** This is the Tamagotchi half doing real work. A morpher that was well kept becomes one form. One that stayed obese becomes a round, slow, heavy hitting form. One that was neglected becomes a scrappy, fragile form. Every morph form is a real, usable Checkling, not a punishment. Students will trade notes on how to get each one.

**Merging.** Two specific Checklings brought to the Merge Stone become one rare Checkling. Both originals are given up. Recipes are hidden. When any student discovers one, it is posted on the village notice board for everyone.

**How students get new Checklings.**

- Hatch a starter at the first check-in
- Catch a wild Checkling in tall grass by weakening it in battle and throwing a catching charm from the shop
- Find eggs while foraging, from rankings, or from the Champion
- Buy rare eggs from a merchant
- Merge two Checklings

**The Field Guide.** The journal's Field guide becomes the full dex. Seen species show a silhouette. Owned species show the full entry with personality, favorite food and evolution hints.

**Art rules.** Every form needs a front sprite, a back sprite for battle and a two frame idle. Conditions like obese or sick are drawn as shape tweaks and overlays on the base sprite, not as separate sprites for hundreds of forms. That keeps the art load possible. All species follow the founder art style already in the game.

**Wave One.** The first twelve lines, their tables, battle entries and approved writing are in `docs/checklings/wave-one.md`.

**The sprite target.** The goal is 600 forms, added as we go in waves of twelve lines. At about one wave a month during the school year, the full set takes two and a half to three years. It works only if every wave follows one locked art contract and is approved before the next wave starts.

## Kettle Creek, the home town

Kettle Creek is each student's own single player town, laid out like Pallet Town. The current one screen camp becomes the student's home yard inside it. Kettle Creek always works, even when the Checkaverse is unreachable.

**Movement.** Top down and grid based, one tile per step, the same as Red/Blue. Arrow keys or WASD move the player, and clicking or tapping a spot walks there. Doors lead into small interior maps. Tall grass at the edge of town can start a wild encounter. Kettle Creek and the Checkaverse share this movement engine.

**What is in Kettle Creek.**

| Place | What happens there |
| --- | --- |
| Your home | Rest, decorate, the Den |
| General store | Food, catching charms, grooming supplies |
| Apothecary | Medicine and the potion cauldron |
| Clinic | Treats conditions and diseases, gives checkups |
| Day Care | Boards Checklings during absences |
| Practice yard | The stump ladder |
| Seed gate, waterwheel, star pond | The three current trail stops, now real spots for foraging and gathering |
| Route 1 | Tall grass and wild Checklings |
| The Checkling Cemetery | A cartoon field on the hill with every headstone from the student's class |
| The bus stop | The way to the Checkaverse |

**The bus stop.** A student walks up to the bus stop and is asked whether they want to ride to the Checkaverse. Yes loads the shared world. If the Checkaverse cannot be reached, the sign says the bus is not running right now, and Kettle Creek keeps working as normal.

**Build rules.** Maps are made in Tiled, a free map editor, and saved as data files. Code never hand places tiles. Tiles are 32 by 32 pixels and match the founder art style. Everything runs on one canvas with no heavy effects, so it stays smooth on a school Chromebook.

## The Checkaverse

The Checkaverse is a much bigger town that every student shares, and it is the center of Checklings. It is always on and it is persistent. Whatever happens there stays there for everyone. Whoever is online right now is walking around it, which during class mostly means classmates in the same hour.

**What is in the Checkaverse.**

| Place | What happens there |
| --- | --- |
| The plaza | Where players gather, meet and challenge each other |
| The Neighborhood | Empty plots that fill with the houses of whoever is online |
| The arena | Town trainers, the Champion ladder, weekly rankings |
| Merchant row | Shops stocked with items other players sold |
| Notice board | Discovered merge recipes, rankings, news |
| The Merge Stone | Merging two Checklings |
| The wilds | Bigger grass areas with species that never appear in Kettle Creek |

**The Neighborhood.** Every student owns a house, the same one they decorate back in Kettle Creek. When a student rides the bus in, their house drops into a free plot in the Neighborhood, and the plot empties again when they log off. While the owner is online, other players can walk in and look around at the decorations, the Den and any trophies on display. The owner can lock the door from inside or from the menu, and a locked house shows a closed sign on its door. Visitors can look but never take, move or change anything. A house never loads while its owner is offline, so nobody tours an empty home.

**Trainer names.** Players never type their own name. Each student gets a randomly generated trainer name built from approved word lists, like Brave Otter or Quiet Comet, and can reroll it a few times. The teacher's dashboard shows who is who. Real names stay off the shared map, and bad names cannot happen.

**No chat. Phrases only.** Players talk by picking from a phrase menu, and the phrase appears in a speech bubble over their character for a few seconds.

- Starter phrases: Hi! / Nice Checkling! / Want to battle? / Good game / Thanks! / See you tomorrow
- Unlockable phrases are rewards, earned from evolutions, Champion wins, rare catches and long streaks. Example: My Checkling is round and proud.
- Every phrase is written ahead of time. Nothing a student types ever reaches another student.

**The merchant economy.** When a student sells an item to a merchant, it appears in that merchant's stock for everyone. The merchant pays the seller a base price and sells it to the next buyer at 50% more. Stock is first come, first served. Items nobody buys in five school days go back to the merchant's default goods. Players cannot hand coins or items to each other directly, which closes the easy routes for pressure or cheating.

**Contagion.** A Checkling with a cold can pass it to Checklings standing nearby. Students learn to keep a sick Checkling home in Kettle Creek until it is treated.

**Teacher controls.** The teacher can pause the Checkaverse, hide a player from it, see the merchant sales log and send any party to Day Care.

**Not planned yet.** Red/Blue had Checkling trading. It is held for later because it needs its own rules against pressure between students.

## Daily return

Students come back because something real changed while they were gone and something good is waiting today. Missing one day should sting a little. It should never wreck a Checkling.

| Rhythm | Hook |
| --- | --- |
| Every school day | Check-in XP and coins. The overnight report. Hunger and hygiene need tending. One forage find per trail spot, the same for everyone that day. Merchants restock. A featured wild species appears in the tall grass. |
| Streak milestones | 3, 7, 14 and 30 day streaks pay out an egg, a phrase or a rare decoration. The milestones already exist in Check-In and carry over. |
| Eggs | An egg hatches after five check-ins, so every egg pulls a student back for a week. |
| Evolution | The level bar shows how many check-ins remain until the next evolution. |
| Every Monday | Rankings reset. A new merge recipe hint goes up on the notice board. |
| Every semester | The Village Champion ladder resets with a new rare egg. |

The current daily forage curio stays. It was the right idea, it just cannot carry the whole job alone.

## Scope rules

Pokémon Red and Blue are the only Pokémon influence. If a feature first appeared in a later game, it is out unless this section lists it as an exception.

**In, from Red/Blue.** A party, four moves per Checkling, types, level evolution, wild encounters in tall grass, town trainers, a Champion, a shop, a Day Care, a dex, a walkable town with interiors.

**In, as named exceptions.** These come from Tamagotchi or from the owner's own design, not from later Pokémon games.

- Eggs and hatching, because a Tamagotchi starts as an egg
- The health system and permanent death
- Morph evolution shaped by care
- Merging
- The Checkaverse, the merchant economy and the phrase menu
- Potion brewing and the Checkling Cemetery

**Out.** Abilities, natures, held items, shiny variants, breeding, a day and night cycle, double battles, a Checkling that follows the player around town, free text chat, anything bought with real money, and paid or random loot boxes.

**Do not soften the game.** Earlier builds drifted into a game with no stakes. The text said rest was always free, feeding was refused when full, and everyone always came home healthy. That direction is reversed. An AI that wants to make the game gentler must raise it with the owner first instead of quietly building it.

**Keep the look.** The current founder art and the Kettle Creek camp scene set the visual standard. New art matches it.

## Tech

Checklings is built so thousands of outcomes can keep being added without the code turning into a tangle. Student identity stays in Check-In and never reaches the game server.

**Rules are content, not code.** The engine stays small and the content grows without limit. Every food, condition, disease, potion, move, species, random event, epitaph and phrase is an entry in a data file. The engine reads the entries and runs them. A rare instant death looks like this:

```yaml
id: glowing_mushroom
when: eat glowing_mushroom
chance: 0.02
effects: death cause=glowing_mushroom
otherwise: mood +20, hygiene -10, say mushroom_glow
```

- Content is sorted into folders by kind: species, moves, foods, potions, conditions, diseases, events, epitaphs, phrases, maps.
- One schema checks every entry before release, so a typo in entry 3,000 is caught before a student sees it.
- Every entry gets an automatic test that confirms it loads, its chances make sense and its effects point at real stats.
- Random rolls use a recorded seed, so any strange outcome a student reports can be replayed exactly.
- Adding a new contingency means adding an entry. Changing the engine is rare and reviewed by the lead AI.

**How a visit connects.**

1. The student enters their PIN in Check-In, which records attendance as it does today.
2. Check-In hands the game a short lived signed ticket carrying an anonymous player ID, the class hour, today's check-in status and the streak. It carries no name, PIN or email.
3. Kettle Creek opens from grant-desk.com. Riding the bus connects to the Checkaverse at game.grant-desk.com.
4. The server checks the ticket, credits the day's XP once and opens the live connection.

**The server.**

| Piece | Choice |
| --- | --- |
| Server | Node.js with WebSockets for movement, phrases, challenges and merchants |
| Data | One SQLite database file |
| Rules | The engine plus the content folders, shared by server and browser |
| Authority | The server decides XP, coins, items, health, catches and battle results. The browser only displays them. |
| Body clock | Runs once per school day using the calendar synced from Check-In |
| Backups | Copied every night to Google Drive and to a second drive |

**Where the Checkaverse runs. Decided Oct 29, 2026.** The Checkaverse runs on Grant's home PC for now, in C:\Checklings (moved from D:\Checklings on Oct 30 when the D drive failed), reached at game.grant-desk.com through a Cloudflare Tunnel so no router ports open and the home address stays hidden. It moves to a small rented server later. The server code reads every path and port from environment variables, so the move is copying the folder, pointing the same tunnel at the new machine and stopping it at home. Small always on servers in the $4 to $6 a month range exist (Hetzner, DigitalOcean, OVHcloud) if uptime becomes the problem. The first test is whether game.grant-desk.com loads on a school Chromebook, since the filter already blocks netlify.app addresses. Source for the server is in apps/checkaverse.

**Outages.** When the Checkaverse is down, the bus is not running, Kettle Creek still works, and the body clock does not tick that day. An outage never hurts a Checkling.

**Moving existing saves.** Pixel Camp saves in the Checkling Camps tab of the private workbook are imported once. The student's hatched Checkling, name and streak carry over as the partner.

## Build phases

The pet comes first because every battle depends on a Checkling worth caring about. Live battles in the Checkaverse are the core of the game, so they arrive in Phase 3, right after battles work against the computer. The build order chart is in the live doc.

A phase starts only after the gate above it passes in a real classroom. Phases 1 and 2 run on the current Check-In host, so they ship without waiting on the server. The live host for Phase 3 is decided above, and a test plaza is already running so the Chromebook connection can be proven early.

## Rules for every AI on Checklings

Checklings has drifted before because several AIs built from each other's handoffs instead of from one plan. These rules stop that.

1. **Read this document before any Checklings work.** It outranks older docs in the repo, board rows and handoffs. When they disagree, follow this one and flag the conflict on the board.
2. **Name the loop step and the phase.** Every task says which core loop step it serves and which phase it belongs to. Work from a later phase does not start until the gate before it passes.
3. **Do not soften the game.** No refusing food, no removing death, no copy promising that nothing can go wrong. A change that makes the game gentler goes to the owner as a question first.
4. **Stay inside the scope rules.** Red/Blue plus the named exceptions. Anything else is a proposal, not a build.
5. **Fill the table before building.** A new condition, potion, species or building fills every column of its table in this document first, then goes in as a content entry, never as special case code.
6. **Claude is the lead AI.** Claude reviews handoffs from other AIs and has final say on how they are carried out. Only the owner or Claude edits this document. Other AIs propose changes on the board.
7. **Keep release notes short.** A release note says in a few plain lines what changed for students and what to test in class. No long verification essays.
8. **Test it like a student before it ships.** Anything students touch is played through at Chromebook size before release. Once checks pass, merge and deploy without waiting for approval, then fix problems live.
