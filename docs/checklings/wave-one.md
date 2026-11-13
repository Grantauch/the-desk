# Checklings Wave One: the first twelve lines

Owner Grant, lead Claude. Locked Nov 1, 2026. Read `DESIGN.md` first; this file fills its tables for the first wave and outranks any older roster, including Grok's World Depth Pack drafts in Drive (v1 to v3), which this replaces.

## What changed from Grok's draft

Kept: the building descriptions, the headstone lines, the morning report lines, the catching lines and most of the Field Guide entries. They match the bible's tone and are edited lightly below.

Changed:

- **Every type gets one new line.** The draft had no Storm or Shade Checkling and doubled up on Tide and Stone. Creekcap and Stumpkin are held for a later wave. Flickit (Storm, a spark quilled hedgehog so it never reads as a second cloud next to Cloudlet) and Hushmoth (Shade) take their places.
- **One pebble Checkling is enough.** Bolt already inspects pebbles. Pebble became Spindle, a wind up Gear Checkling, and Mossbit no longer collects pebbles.
- **Every column is filled.** Evolution group, forms, battle stats and signature moves were missing.
- **Nothing jokes about a student.** The Slim broth line about students who "already know why" is gone. Jokes land on Checklings only.
- **Trainers, not students.** Player facing lines call players trainers.

Tossed: the Kettle Creek map tile note (four tile names and a six line sketch, not a map) and the four sprites in "Checklings Grok Generated Sprites" (hot pink backgrounds instead of FF00FF, and redraws of art already in the game).

## The roster

Founders are two stage evolvers at levels 15 and 30, as the bible sets for steady attendance. Their evolved forms are named in the Phase 2 pass. New lines split evenly: four one stage morphers whose form depends on care history, and four non evolvers that can merge. Merge recipes are hidden by design and are kept out of this public repo.

| Line | Type | Group | How it changes | Personality | Favorite routine | Care reaction | Habitat | Catch at | Favorite food |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mochi | Meadow | Two stage | Level 15 and 30 | An earnest optimist sure today is the best day yet | Sits on a mossy roof and watches the creek | Grooming brightens its glow. Neglect dims it, never the optimism | Meadow edges, cottage flower boxes | Starter | Store berries |
| Bolt | Gear | Two stage | Level 15 and 30 | Inspects pebbles and has an opinion on each | Lines up three stones of exactly the same size | Overtraining speeds its sorting and costs sleep. Underfeeding slows it and makes it fret | Practice yard, rocky paths | Starter | One river stone it may keep |
| Zee | Cosmic | Two stage | Level 15 and 30 | Asks oddly specific questions | Stares at the sky until someone asks what it sees | Too much medicine sharpens the questions. Good rest softens them | Open plaza, the hill | Starter | Anything left out in starlight |
| Ember | Ember | Two stage | Level 15 and 30 | Brave in every battle and still cannot make toast | Sits too close to the apothecary cauldron | Overfeeding slows its warmth. Neglect makes it flicker and turns bravery into stubbornness | Near chimneys and lanterns | Starter | Anything slightly burned |
| Bramble | Meadow | One stage morpher | Level 20. Kept: Thornbloom. Round: Berryhold. Scrappy: Briarwisp | Hides one berry a day, then forgets where | Rustles in low bushes until someone notices | Too much food and it hides more than it can remember. Too little play and the rustling stops | Path bushes, plot edges | Route 1 tall grass | Any berry left on a windowsill |
| Reedling | Tide | One stage morpher | Level 20. Kept: Marshreed. Round: Lilyback. Scrappy: Riptail | Counts ripples and gets upset if the number is wrong | Floats with only its eyes above the water | Good grooming keeps the ripples clean. Too little play and it sinks lower | Creek, plaza pond | Creek bank | Mint from the clinic garden |
| Lantern | Ember | One stage morpher | Level 20. Kept: Hearthglow. Round: Kilnback. Scrappy: Sparkwick | Hums when the light is right, quiet when it is not | Perches on the hook of any lantern post | Too much rest lowers the hum. Neglect makes it flicker even when full | Lantern posts | Lantern posts at dusk | Warm honey |
| Mossbit | Stone | One stage morpher | Level 20. Kept: Mossgard. Round: Boulderbud. Scrappy: Flintling | Sits so still that moss grows over its feet | Picks one rock and stays on it all day | Good rest thickens the moss. Overtraining chips it off | Mossy rocks, the Merge Stone base | Mossy rocks | Soft bark |
| Spindle | Gear | Non evolver, can merge | Never evolves | Winds itself up and forgets what it was winding up for | Spins in place until it tips over, then starts again | Overtraining makes it spin too fast to stop. Underfeeding makes it wind down halfway | Waterwheel, practice yard | Waterwheel | Seeds with a crunch |
| Cloudlet | Cosmic | Non evolver, can merge | Never evolves | Tries to sit on things that are not solid | Stares at the space just above the ground | Too much play and it drifts higher. Neglect and it sinks almost to the grass | Open sky over the plaza and the hill | Open fields | Anything left outside overnight |
| Flickit | Storm | Non evolver, can merge | Never evolves. A round hedgehog with yellow zigzag quills | Startles at its own sparks and pretends it meant to | Hides in tall grass before a storm and buzzes | Too much play and it crackles all night. Too little rest and the sparks go dim | Tall grass on stormy days | Route 1 on rainy days | Rainwater from a leaf |
| Hushmoth | Shade | Non evolver, can merge | Never evolves | So quiet that nobody notices it until it is sitting on their shoulder | Rests on the dark side of a lantern post | Too much grooming and it hides from the brush. Neglect and it stops coming out at all | Under eaves, behind headstones | The hill at dusk | Moonflower nectar |

## Battle entries

Same scale as `apps/checkaverse/content/battle/species.json`: base stats at level 1, the same growth as the founders. Strike, Guard and Recover are shared. These go into the battle content only when each line's front and back sprites pass the art check, then get tuned with the balance simulation in `battle.test.mjs`.

| Line | HP | Power | Stamina | Speed | Signature | Cost | What it does | Engine |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bramble | 48 | 8 | 9 | 7 | Thorn tangle | 5 | 10 damage, and the target loses 2 stamina | Needs a small new verb, drain |
| Reedling | 46 | 8 | 10 | 8 | Ripple count | 4 | Takes turns: 8, then 12, then 16 damage | Ready (phases) |
| Lantern | 44 | 9 | 10 | 7 | Steady glow | 4 | 10 damage and 3 stamina back | Ready (damage plus restore) |
| Mossbit | 56 | 7 | 9 | 4 | Moss coat | 5 | 6 damage and a 16 point shield this turn | Ready (shield, first) |
| Spindle | 46 | 8 | 10 | 8 | Wind up | 5 | 10 damage, plus 5 for each wind stored by Recover, up to 3 | Ready (bonus and recover trait) |
| Cloudlet | 50 | 7 | 9 | 9 | Drift | 4 | 10 damage while hits land at half | Ready (guard 0.5 with damage) |
| Flickit | 40 | 10 | 8 | 11 | Static snap | 7 | 24 damage | Ready |
| Hushmoth | 44 | 9 | 9 | 10 | Quiet wings | 5 | Takes turns: 8 damage with a 6 point shield, then 20 damage | Ready (phases) |

## Field Guide lines

Shown once a line is owned. Seen lines show only the silhouette.

- **Mochi.** The oldest stories say the first Mochi sat with whoever built the waterwheel and would not leave until the wheel turned true.
- **Bolt.** Old trainers say a Bolt was first to notice the Merge Stone's spirals match on both sides.
- **Zee.** The first Zee question is carved very small on the back of the Merge Stone. Nobody has answered it yet.
- **Ember.** One Ember kept the whole town's lanterns lit through a long rain by refusing to sit still.
- **Bramble.** Old paths still hide berry stashes that Brambles left and never found again.
- **Reedling.** People used to time the waterwheel by how many ripples a Reedling made in one turn.
- **Lantern.** The first lantern posts went up because a Lantern refused to come inside on a dark night.
- **Mossbit.** The oldest headstones on the hill wear the same moss pattern as a well kept Mossbit.
- **Spindle.** The waterwheel squeaks in the same rhythm a Spindle spins. Nobody knows which one started it.
- **Cloudlet.** The first Cloudlet showed up the day the bus route was marked and followed the bus sign for a week.
- **Flickit.** Trainers on Route 1 know rain is coming when the grass starts to buzz.
- **Hushmoth.** If a lantern post looks a little darker on one side, check the dark side.

## Writing bank

Approved player facing lines for features that are not built yet. Each goes into a content file when its feature is built.

### Headstones (several per cause, so stones rarely repeat)

- **Overfed, heart trouble.** Here lies Biscuit. Ate the whole thing. Then the other whole thing. / Stopped counting after the third bowl. / The berries were very good. The berries were too good. / Found the bottom of the bowl. Then found another bowl.
- **Untested potion.** Pip tried the purple potion. It was not grape. / Asked what would happen. Found out. / The cauldron is still bubbling. Pip is not. / The bottle said maybe. The bottle was right.
- **Neglect, the Glooms.** Finally got that nap. / The creek kept going. This one did not. / The lantern stayed lit. The Checkling did not. / The moss grew over its feet. It did not mind.
- **Overtrained.** Measured everything except how much time was left. / One more stump. Then one more. / Counted the rings. Forgot to rest.
- **Glowing mushroom.** Licked the glowing mushroom. Regrets nothing. Regrets everything. / It looked like a berry. It was not a berry. / The glow was pretty. The glow was enough.

### Morning report lines

- Hunger dropped overnight. The berries in the store window look brighter this morning.
- Weight went up. The creek is running high, and a Reedling is counting the new ripples.
- A sniffle started. The clinic has fresh mint.
- The merchant restocked. Someone sold a strength tonic yesterday. It is already gone.
- The notice board has a new drawing. Two Checklings went in. One came out.
- A wild one was seen near the bus stop at dusk. It did not stay.

### Catching lines

| Place | Throw | Caught | Got away |
| --- | --- | --- | --- |
| Route 1 tall grass | The charm lands soft in the grass. | It steps into the charm's glow. | It hops back into the taller grass. The charm rolls to a stop among the flowers. |
| Checkaverse wilds | The charm spins once on the stone path. Trainers nearby stop to watch. | It accepts. The plaza notices. | It slips between two market stalls. The charm comes back warm but empty. |
| Creek bank | The charm floats on the current, then sinks toward its reflection. | It climbs out dripping and follows. | It slips under the bank. The charm washes up a few steps downstream. |
| Practice yard | The charm bounces off a stump and settles in the dirt. | It steps over the stump and into the glow. | It ducks behind the stump before the charm stops spinning. |
| The hill | The charm settles among the small flowers. | It steps forward. The flowers bend and spring back. | It slips behind a headstone. Only the charm is left. |

When the wild Checkling is sick or neglected, add: It looks like it has been on its own too long.

### Items

- **Catching charm.** A small wooden charm from the general store. Works best when the wild Checkling is already tired.
- **Strength tonic.** Ember root and river stone. Makes the next battle hit harder. The label says do not drink it yourself.
- **Stamina draught.** Reed fiber and honey. Restores stamina mid battle. Smells like the creek after rain.
- **Clear tea.** Mint and spring water. Cures a cold. The clinic garden grows the mint.
- **Slim broth.** Kelp and bitter leaf. Takes weight off a Checkling over three days. Tastes exactly as good as it sounds.
- **Grooming brush.** Soft bristles from the general store. Makes a Checkling's markings clearer.

### Kettle Creek buildings

- **General store.** Berries in the window, sacks of feed by the door. The owner remembers every customer's favorite. The charm shelf is restocked by morning.
- **Apothecary.** Crooked stone walls, purple roof, pink smoke, teal cauldron. Brews whatever you forage. Not responsible for untested potions.
- **Clinic.** White cottage, red roof, a heart on the sign. Treats colds, mange and heart trouble. Hands out stickers after checkups.
- **Day Care.** A wide yellow barn with a fenced yard. Watches Checklings while their trainers are away. Nobody has ever been bored here.
- **Practice yard.** Stumps of every height. The dirt is packed from years of feet.
- **Cemetery gate.** A wooden arch with vines and small flowers. Every class has its own field on the hill. The stones stay.
- **Bus stop.** The only way to the Checkaverse. The bench is always a little damp. The bus is never late. It is only sometimes not running.

## Art for this wave

The eight new lines go to Gemini as Sprite Book Wave 5 (the Google Doc "Checklings Sprite Book Wave 5: New Checklings" in Drive). Each line is one sheet of four on FF00FF, like the Wave 2 starter sheets: front, front happy, back, back blink. Morph forms come in a later wave. Nothing pink or magenta inside a body: cheeks and mouths use warm red or orange. The Wave 2 Zee front fails this rule (its belly is magenta), so it is in the same doc as a redo.
