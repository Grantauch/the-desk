# Bramblefen Basin — Wave Two character bible and attack design

**Candidate writing and experimental combat only.** This version reflects the second provisional tuning pass; none of these numbers is approved for production. CK013–CK024 are **not** live, approved, originality-cleared or illustrated species. This expands `BRAMBLEFEN-WAVE2.md`. The names may change; the locked first twelve species, signatures and personalities in `wave-one.md` stay unchanged. Editable move prototypes are in `apps/checkaverse/experiments/worldgen/bramblefen-wave2.content.json`; do not import that file into the live content catalog.

## What makes the marsh worth remembering?

The oldest Kettle Creek residents say the water used to run straight through Bramblefen. Then someone built the Crooked Footbridge. The river found a longer way around it, and the bridge followed the river instead of the other way around. The footbridge still creaks whenever the water rises; its center plank is always dry. One afternoon, a Reedling counted 99 ripples from beneath it and refused to count the hundredth. That is why the local notice board calls the deep channel the **Hundredth Ripple**.

**Writing tone:** earnest creatures with small eccentricities, kind-but-dry narration, strange places treated as ordinary by longtime residents. The jokes belong to the creatures and the landscape, never to a real student, body size or medical condition. No fixed time-of-day requirement or day/night engine is implied by phrases such as sunrise or evening; those are fiction, not encounter gates.

## Twelve candidate personalities, world lore and combat identities

### CK013 · Reedawn — Meadow, two-stage, vanguard

**Voice:** Greets tree stumps as though each one has a name. Sometimes waits for an answer.  
**Routine:** Circles the Crooked Footbridge and stands beside the same stump each visit.  
**Care:** Gentle grooming straightens its reed antlers; on rough days they bend into a little arch.  
**Field Guide:** When the river cuts a new bank, a Reedawn is the first to stand at its edge. Older ones have been seen waiting for a crossing that no longer exists.  
**Encounter flavor:** Two reeds move in opposite directions. The fawn below them does not seem surprised.  
**Signature — Reed Pledge:** Costs 5 stamina, 10 Meadow damage; incoming damage is multiplied by 0.65 for that turn. This is a moderate protective strike, not a free heal.  
**Counterplay and art:** Reach it with stronger neutral attacks or wait out the expensive defensive sequence. Reed antlers form a clear V in its rear-facing sprite.

### CK014 · Cattunnel — Meadow, two-stage, bruiser

**Voice:** Digs a tunnel only to decorate the doorway.  
**Routine:** Carries dry peat to the same entrance and pats it flat with both paws.  
**Care:** Rest lets it inspect its own handiwork instead of starting another tunnel.  
**Field Guide:** Some of the oldest marsh paths are tunnels filled in by Cattunnels. Their entrances are marked by the only neat piles of dirt for miles.  
**Encounter flavor:** A tiny doorway appears in a dry bank. A mole emerges to straighten it.  
**Signature — Peat Charge:** Costs 6 stamina for 20 Meadow damage. High burst, little flexibility on a small stamina pool.  
**Counterplay and art:** Guard and recovery turns can punish overcommitting. Draw the shovel snout as one distinct block, not a generic round mole.

### CK015 · Skidril — Tide, two-stage, skirmisher

**Voice:** Skates backward after every successful turn so it can admire the splash.  
**Routine:** Traces a loop beside the first calm pool after the footbridge.  
**Care:** Play adds an extra little circle to its routine; exhaustion makes it stop short.  
**Field Guide:** Skidrils race their own reflections because the reflections always seem to have the lead.  
**Encounter flavor:** A line appears across still water. Then the skater doubles back along it.  
**Signature — Puddle Waltz:** Costs 5, alternating **12 then 17** Tide damage each use. No invisibility, speed buff or dodge chance.  
**Counterplay and art:** Defense timed for the stronger second pass; broad fin-feet distinguish its silhouette from Arctic Sliddew.

### CK016 · Finline — Tide, two-stage, warder

**Voice:** Tries to find a reed that fits between its fins. Rejects every one as the wrong shape.  
**Routine:** Drifts under the same fallen log until the current turns it around.  
**Care:** A quiet rest makes its paired fins move in perfect time.  
**Field Guide:** Fishermen once followed a Finline through floodwater. It returned them to the same bank after a very scenic detour.  
**Encounter flavor:** Two narrow fins cut the creek like the sides of a canoe.  
**Signature — Reed Shelter:** Costs 5, 10 Tide damage, plus **10 shield** for that turn. Defensive style must be distinct from Thornlock's heavy shell.  
**Counterplay and art:** Repeated shielding loses pressure. Show the fins as two long parallel blades.

### CK017 · Pollisk — Meadow, care-morph, attrition

**Voice:** Says nothing, but sails as though it expects to be saluted.  
**Routine:** Climbs the tallest pollen bank, then waits for the breeze to decide its route.  
**Care:** Grooming lets light through its sail; too much debris weighs it down.  
**Field Guide:** The pollen on a Pollisk's sail is old enough to tell where it has been. Pollisks consider this valuable navigation information.  
**Encounter flavor:** A golden sail moves above the flowers, carried by something the size of a snail.  
**Signature — Pollen Sail:** Costs 4, 12 Meadow damage, with incoming damage multiplied by **0.75** that turn. Lower-cost but weaker guard than Reed Pledge.  
**Counterplay and art:** Repeated partial guarding is vulnerable to stronger offense. Design the single translucent sail large enough to read clearly.

### CK018 · Mosswhirl — Meadow, care-morph, tempo

**Voice:** Ties its own moss ribbons into bows; never finishes the last knot.  
**Routine:** Waits beneath the Sleeping Willow for a ribbon to drift downstream.  
**Care:** Play loosens ribbons into broad circles; hunger makes it gather them close.  
**Field Guide:** A Mosswhirl can follow the river by the moss on its tail. When lost, it ties a new knot and pretends this was the destination.  
**Encounter flavor:** A green ribbon spins under the willow before the otter holding it appears.  
**Signature — Moss Knot:** Costs 5, 13 Meadow damage and returns **2 stamina** to the user. Net stamina cost is normally 3.  
**Counterplay and art:** Favors an efficient tempo without actually draining an opponent. Distinguish from Mossbit: long swimming body, looping ribbon tail, never pebble/moss armor.

### CK019 · Glasprite — Tide, care-morph, sustain

**Voice:** Startles at its own reflection, then checks that the reflection is all right.  
**Routine:** Polishes one crescent of shell against the smoothest stone at Glasswater Pool.  
**Care:** Rest slows its twitchy movements; good grooming brings out a second transparent edge.  
**Field Guide:** Glasprites gather where the water is so still that stars can be seen in daylight. The stars are usually bubbles.  
**Encounter flavor:** A crescent hangs in the water with no creature visible behind it. Then it sneezes.  
**Signature — Glass Halfmoon:** Costs 5, 10 Tide damage, creates **11 shield** for one turn.  
**Counterplay and art:** Wins through survivability rather than high damage. A single crescent-shaped top shell distinguishes it from generic shrimp.

### CK020 · Mudhorn — Tide, care-morph, artillery

**Voice:** Hums into a hollow reed and listens long enough to hear someone answer.  
**Routine:** Stands at Mudtrumpet Hollow and tests the same note against the same bank.  
**Care:** Rest lowers its pitch; overtraining makes it miss the note and look offended.  
**Field Guide:** An old marsh map marks three lost villages by the calls of Mudhorns. The birds have moved. The marks have not.  
**Encounter flavor:** A deep note comes out of the cattails. The tall heron appears after it fades.  
**Signature — Hollow Bellow:** Costs **7 stamina** for **23 Tide damage**. Deliberately high commitment; no new area-of-effect mechanic.  
**Counterplay and art:** Slow speed and high cost enable guard/counter turns. The flared trumpet bill is more important than extra feathers.

### CK021 · Thornlock — Meadow, non-evolver, warder

**Voice:** Carries one favorite twig. Refuses to explain the attachment.  
**Routine:** Inspects each log bank for a better place to set the twig, then keeps carrying it.  
**Care:** Grooming removes the old leaves wedged between its interlocking shell plates.  
**Field Guide:** When floods wash away a bank, Thornlocks hold the last twigs in place. They are not especially good at this, but nobody has told them.  
**Encounter flavor:** Something in the reeds clicks shut. A turtle looks up, still holding its twig.  
**Signature — Briar Buckle:** Costs 5, 10 Meadow damage plus **13 shield** for the turn. Tankiest shield among the proposal's wetland kits.  
**Counterplay and art:** Must not also have dominant offense. Draw the shell as several interlocked angular briars.

### CK022 · Seedrift — Meadow, non-evolver, skirmisher

**Voice:** Insists its brief hops are flights. Reminds every passerby.  
**Routine:** Waits beneath a four-winged seed canopy at the edge of the Pollen Flats.  
**Care:** Play makes the canopy rise higher; too much activity leaves the spider clinging to its string.  
**Field Guide:** Some Seedrifts have crossed the whole basin without touching the ground. They always describe it as a much longer journey.  
**Encounter flavor:** A seed parachute drops from nowhere. Eight tiny feet begin arguing with the wind.  
**Signature — Seed Dive:** Costs 5; alternates **16 Meadow damage** and **7 damage plus 8 shield**. Its second phase trades pressure for safety.  
**Counterplay and art:** The shield phase only matters if attacks are properly ordered; confirm exact engine behavior. Single giant seed-parachute silhouette, not wings attached to body.

### CK023 · Rippletap — Tide, non-evolver, rhythm

**Voice:** Counts ripples in threes and starts again when it reaches four.  
**Routine:** Draws three circles with its front legs, then watches the circles join.  
**Care:** Rest makes the leg circles slower and more even.  
**Field Guide:** Rippletaps marked the old ferry crossing before there was a bridge. One still waits for a ferry that nobody remembers building.  
**Encounter flavor:** Three perfect rings appear one after another. The fourth never does.  
**Signature — Circle Count:** Costs 5; three-use phase cycle of **9, 13 and 17 Tide damage**. No actual opponent timer or move-lock effect is implemented.  
**Counterplay and art:** A patient player can anticipate the stronger third beat. Avoid Reedling's existing habit of counting ripples as an identical personality; this species cares about shapes, not numeric accuracy.

### CK024 · Whisprill — Tide, non-evolver, sustain

**Voice:** Follows small currents because they seem to be going somewhere important.  
**Routine:** Collects dew on its droplet-shaped wings above the creek.  
**Care:** Grooming makes the dew beads glow; over-rest makes it almost motionless on reeds.  
**Field Guide:** When dawn mist fills Bramblefen, Whisprills carry a little of the creek on their wings. The creek has never asked for it back.  
**Encounter flavor:** Two teardrop wings appear through the mist, each holding one bead of water.  
**Signature — Dew Return:** Costs 4, **12 Tide damage** and restores **2 stamina** to the user (normal net cost 2).  
**Counterplay and art:** Long-term stamina efficiency, not a healing spell or team support; low raw damage keeps its niche different from Mudhorn.

## Attack-design review ledger

All twelve are **actual-engine-compatible proposals**: exactly four moves per creature (`Strike`, `Guard`, `Recover`, and signature). No ninth element, new passive trait, opponent-stamina drain, poison, status lock, invisibility, speed buff, guaranteed dodge, or priority rule was invented. Stamina restore, shields and guard use the existing engine fields.

| Candidate | Signature | Cost | Damage / sequence | Extra supported effect | Balance concern |
| --- | --- | ---: | --- | --- | --- |
| Reedawn | Reed Pledge | 5 | 10 | Incoming hits ×0.65 | defensive offense too efficient? |
| Cattunnel | Peat Charge | 6 | 20 | None | burst versus founders |
| Skidril | Puddle Waltz | 5 | 12 → 17 | Alternating phases | fast first strikes |
| Finline | Reed Shelter | 5 | 10 | Shield 10 | low damage stalemate |
| Pollisk | Pollen Sail | 4 | 12 | Incoming hits ×0.75 | partial guard too cheap? |
| Mosswhirl | Moss Knot | 5 | 13 | Restore stamina 2 | sustained pressure |
| Glasprite | Glass Halfmoon | 5 | 10 | Shield 11 | repeated shields |
| Mudhorn | Hollow Bellow | 7 | 23 | None | burst versus low-HP starters |
| Thornlock | Briar Buckle | 5 | 10 | Shield 13 | long PvP turns |
| Seedrift | Seed Dive | 5 | 16 → 7 | 8 shield in second phase | signature becomes unpredictable |
| Rippletap | Circle Count | 5 | 9 → 13 → 17 | Three phases | damage sequence clarity |
| Whisprill | Dew Return | 4 | 12 | Restore stamina 2 | infinite-stall risk |

**Key mechanics gap:** The currently supported engine cannot actually delay an opponent's move, reduce an opponent's stamina, cause a persistent slow, or grant healing to another partner. A **disruptor** must currently mean visible tempo and stamina efficiency, not a hidden debuff. Better to label these candidates honestly than sneak in new battle verbs. If that gap compromises tactical diversity across 300 lines, Claude should propose a small reviewed move-system extension later.

## Art, recording and quality gates

Each creature needs an original recognizably different pixel silhouette, front/happy/back/blink frames, readable animation of its one signature, and care-state pose guidance. Lore is not a justification for duplicate art. The human-readable attack text must match actual `battle.mjs` event behavior, including one-turn shields and phase sequences.

This document clears **writing exploration** only. It does not clear original-name searches, sprite provenance, approval of morph forms, PVP strategy balance, student Chromebook tests, accessibility, or deployment. Do not publish the experimental content JSON automatically.
