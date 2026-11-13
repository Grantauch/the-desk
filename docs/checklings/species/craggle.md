# Craggle — original mountain-species dossier

**Task:** CK-SPEC-003 · **Owner:** ChatGPT Personal · **State:** DESIGN_ONLY / candidate, NOT PLAYABLE · **Pinned source:** `89f4502966ec1bca9bd6ce093c8f90b8d2f906a2` · **Owned file:** `docs/checklings/species/craggle.md`

**Pitch:** Craggle is a careful, stubborn little tunnel maker that reads a mountain by listening to it. It carries a broad, uneven mineral shield over its back and a shovel-shaped nose. It is excellent at finding a route everyone else overlooked and terrible at admitting it should take a rest.

This proposal is additive and consistent with the existing `apps/checklings-foundation/species-plan.json` and `docs/checklings/FIRST-12.md`. It does not modify the catalog, replace the original four pets, generate art, grant rewards, define a production API or claim gameplay exists.

## Canonical identity and originality

| Property | Locked proposal |
| --- | --- |
| Base species ID | `craggle` — **one** candidate base species |
| Name | Craggle |
| Ecosystem | `mountains` |
| Affinity | `stone` |
| Tactical hook | **Brace:** slow, visible preparation resists knockback and empowers one later strike |
| Keeper / discovery hook | Find **safe cave paths** and usable stone for **carving** |
| Basic care preference | **Rest after digging** and species-appropriate mineral-balanced food |
| Existing personality | Stubborn, careful, unexpectedly tidy |
| Existing candidate silhouette | Asymmetric, mineral-backed burrower with broad shovel snout |
| Present art state | Planned, not reviewed or playable |

**One-glance test:** Craggle must be identifiable in a 48–64 CSS-pixel monochrome silhouette by its **oversized sloping shovel nose**, low-four-legged digging posture, and off-center mountain-ridge plating that sweeps across **only one side** of its back. Do not make it a generic round rock, a turtle, a golem, or a brown recolor of another creature.

The plated ridge has **three unequal angled plates** growing from one flank, supported by a squat flexible body. The broad snout is blunted and nearly horizontal at rest; two short feeler whiskers detect subtle rock vibration. One shoulder has a small wedge-shaped shoulder plate, while the opposite shoulder is visibly smooth. Four thick gripping feet have three rounded digging pads each. The actual sculpt/rig artist may simplify this construction while preserving asymmetry and the identifying shovel/ridge shape. Eyes are low-set and expressive without human eyebrows or a large cartoon mouth. The body must **not** be a literal pile of stones.

**Material language:** muted blue-gray slate, warm umber soil, pale sandstone abrasion at the plate edges. The ridge has flat stratified planes, but the belly and snout show a contrasting worn, soft surface. No metal armor or weapons, no glowing gemstones by default. Species-specific minerals can be added as earned props, but a skin variation or new plate pattern is not another base species toward the promised 300.

**Ecological role:** In the mountains, rockfall, frost cracks, buried springs and small passages change travel routes. Craggle digs *small* channels, anchors unstable loose stones, marks safe passage and finds naturally workable stone. It cannot magically control all rock or ignore cave-in risk. Fictional geology is inspired by recognizable clues: loose versus stable rock, water tracing, visible cracks and echo. Treat the cave as an authored puzzle, not a realistic occupational-safety procedure.

## Character beyond “the defensive rock pet”

A Craggle tries to clean dust off a shelf while dragging in twice as much gravel. It keeps surprisingly neat piles of stone chips. It has a particular dislike of someone calling a doorway a “hole.” It hears tapping and can investigate too long, so player-selected rest is meaningful. A timid individual may hide behind its ridge; a confident one may go first into a well-lit tunnel. Neither becomes a radically different species.

**Species-default temperament centers**, for independent CK-BEH-001 review, not persisted facts:

| Trait (0–100) | Proposed center | Design implication |
| --- | ---: | --- |
| Curiosity | 65 | Interested in odd echoes and small cracks |
| Sociability | 42 | Slow to greet, but useful on a team |
| Caution | 78 | Prefers studying a crossing before moving |
| Activity | 51 | Strong bursts of digging require recovery |
| Resilience | 77 | Patient when a route needs several attempts |

Individual traits require a once-persisted owner-authorized seed and later recorded events. Species tendencies must not fix behavior forever. A recently frightened Craggle may favor a safer nook; a trusted one can choose to explore with the keeper. A new or imported legacy pet has no invented past memory of a cave, scar, birth date or rescue.

## Care loop: Examine → Brace → Carve → Rest

**Goal:** A nurturing player learns to read rock stability, creates a small carved keepsake, and improves a home without combat.

1. **Examine:** Show a close-up of two stone faces with differences the student can actually see. One has a continuous stable surface and the other a visible growing crack. Student taps or selects a clue; Craggle responds with distinct inspection poses.
2. **Brace:** Student places a temporary wooden or stone support at a clearly suggested location. It stabilizes **one local work area** rather than granting permanent invulnerability. A too-small prop wobbles and can be repositioned without currency penalty.
3. **Carve:** Choose a deliberate pattern for a locally found flat stone (simple wave, notch, spiral, or grid). After a confirmed server-authoritative action, unlock that **one** personal display tile/field note. Repeated retries do not duplicate the item.
4. **Rest:** Digging costs some energy; a basic rest option and free essential care are always accessible. The visible positive choice is to stop before fatigue becomes dangerous, not to grind a discomfort meter.

**Interesting tradeoff:** Craggle can choose a stable but long passage or a short but currently blocked passage. A keeper may conserve energy by recording the safer detour; a more adventurous individual may propose clearing a small obstruction **after** adequate observation. Both deliver meaningful progress once completed. No route can trap a child or lock food/treatment behind battle winnings. No missing-day or offline deterioration.

**Observable individuality:** After a *committed* carving event, a Craggle may inspect its saved piece and arrange it carefully on return. Without that event, it may inspect an empty spot; it must not “remember” a thing it never made. Reactions should vary with actual temperament and well-being, not be simple per-species random text.

## Exploration vignette: The Three Echoes

Three stops that teach a tiny bit about safe paths by making the player interpret the environment. These are **content candidates**, not existing level geometry or generated assets.

| Stop | Visible clue and question | Meaningful choice | Persistent keeper outcome |
| --- | --- | --- | --- |
| **Old Steps** | Two cliffside paths: one straight but scattered with loose stones, another wider and visibly worn smooth. Which one looks stable? | Inspect the rock face first, then commit a route. Wrong choice causes a harmless blocked route and a specific retry clue. | Saved **safe trail marker** and an illustrated field note showing why the stable path worked. |
| **Hollow Wall** | Three taps produce a dull, a clear and a rattling echo. Which wall suggests a small empty space? | Listen/replay and compare a visual waveform/transcript; locate a small cavity without tunneling through dangerous supports. | One approved carving-stone discovery and a visible marked niche. |
| **Spring Shelf** | A small stream erodes one side of a ledge. Can Craggle reach the collection point without using the crumbling edge? | Place a simple brace on stable ground or take a longer path. | A **carved trail plaque** for the keeper's home and a saved map waypoint. |

Each scene must provide **real explanatory feedback**, not just an arbitrary right/wrong gate. For the echo test, show textual waveform descriptions so audio is never essential. All failure routes are recoverable; there is no permanent death from a classroom puzzle mistake. Saved outcomes must not reset on reload, share across students or repeatedly mint rewards. Respect narrative/world authoring authority: these stops should be reconciled with CK-WORLD-001's route before integration rather than automatically spliced into it.

### Micro-story in seven beats

1. A footpath is closed, not with a villain but with a rock that moved overnight.
2. Craggle digs one inch, backs up, and listens with its broad snout touching the stone.
3. A student notices that the old worn track curves **around** the unstable patch.
4. Craggle is annoyed. The longer path is also the sensible one.
5. In a hollow niche, an echo changes. Craggle finds a flat stone worth keeping.
6. The student carves a route marker. A future traveler can now find the safe path.
7. Craggle straightens a crooked edge on the marker. Then straightens it again.

**Humor:** “Craggle has alphabetized the rocks. Nobody knows what that means.” Short, concrete, never at the expense of rescue warnings or student struggles.

## Combat design candidate: Brace / Counterweight

Craggle should play like a **defender that needs timing**, not a permanent damage wall. Its opponent can see exactly when it becomes harder to knock back and when it is about to spend stored force.

**Proposed turn sequence (subject to CK-BATTLE-001 mechanics review):**

1. **Prepare Brace:** Spend a defined stamina amount to enter a **visible braced state**. Craggle gains capped protection against knockback/displacement *for one short window*. It does not gain damage immunity and cannot stack multiple braces.
2. **Opponent response:** The player sees braced icon and time remaining. Opponents can use focus/special damage, defend/recover, use terrain to alter position, or wait out the limited window. Exact interactions depend on the accepted battle system.
3. **Take a hit or stabilize:** An eligible defended contact may **arm one counterweight token** with a strict maximum. The token is a battle-state record, not a body stat, permanent upgrade, or free repeated RNG draw.
4. **Release:** One clearly named **Lever Strike** spends the token for a modest, capped benefit and clears it atomically. Miss, KO, turn expiration, replacement or match settlement cannot reroll or duplicate the token.
5. **Rebalance:** Craggle must recover stamina or choose another legal action; “brace forever” should lose to thoughtful alternatives.

**Boundaries and caps, not finalized values:** at most one stored counterweight token per eligible creature; suggested initial braced duration 1–2 turns for tests; no stacking into a permanent invincible stance; cannot refresh the braced state without a real resource cost. Balance actual damage, turn/initiative effects, affinities and counterplay in CK-BATTLE-001's approved design. Require a useful basic attack, safe defend, rest/recover and accessible keeper advancement; no monster is born strictly worse because it prefers nurturing.

**Knockouts are not death.** Battle HP and stamina are separate from long-term energy, illnesses, injuries and permanent-death conditions. Ordinary classroom duels are nonlethal. A serious authored lethal PvE scenario would need a separate visible warning, consent, retreat path and server adjudication, never a flavor-ability side effect. A disconnected client cannot continue accruing irreversible risk or secretly lose a creature.

**No client-issued truth:** Server verifies ownership, species, battle and unit revisions, active seat, move, stamina, relevant terrain, condition/rule version and teacher settings. The authoritative turn transaction creates only one token/defense/reward event despite retries. Client can request a legal action, never claim knockback resistance, granted stats, winning result or new items.

**Readable encounter example:** “Craggle braces its feet. It can resist one push this turn.” Next: “Counterweight ready: Lever Strike will spend it.” The opponent sees “Craggle is braced. Wait, reposition, or attack another way.” No hidden procs, icons with no text, or visual effects that obscure the state.

## Expression and animation brief for CK-ART-001

**Identity anchors:** shovel snout, one-sided three-plate ridge, grounded four-footed shape. Craggle must not sprout six legs, turn into a boulder, or show plate mirroring that makes the ridge jump to the opposite body side. If idle sprites mirror for efficiency, actual rig art and scars must preserve anatomical left/right provenance.

| Proposed state | Motion / visual story | Reduced-motion or missing-asset fallback |
| --- | --- | --- |
| Original portrait and idle | Weight shifts between feet; low snout angles toward ground | Approved still + “Craggle is listening” |
| Investigation | Snout touches floor; short feeler tremble; eyes glance to a crack | Still + text “Examining the stone” |
| Care / tidy | Scoops one stone to its neat pile with a foot | Still + “Sorting stone pieces” |
| Dig | Two controlled shovel strokes; dust falls and clears quickly | Static dust mark + progress/status label |
| Carve | Traces a line in a flat slate tile, pauses to inspect it | Static tile with readable pattern |
| Rest / fatigue | Ridge lowers, nose settles safely on forefeet | Still + “Needs rest” |
| Brave choice | Sets feet before entering a safe known passage | Still + named next choice |
| Brace | Lean and grounded stance, one short dust puff; braced icon near feet | Icon plus “Braced: 1 turn” |
| Counterweight ready | One ridge plate catches light once; no constant blinking | Static token indicator and plain text |
| Lever Strike | Brief snout-and-shoulder lift; impact flash optional and restrained | Still + move transcript and HP numbers |
| Hurt / KO | Controlled backward wobble or crouch, never comically smashed | Still + explicit KO/health status |
| Rescue / recovery | Rests, receives help and gets back to balanced posture | Accessible text and free care action |

**Art technical contract:** CK-ART-001 owns pose dimensions, permitted formats, atlas budget, anchors, rights checks and actual existing-file inventory. Do not invent screenshot proof or a checksum. For Chromebook performance, lazy-load optional battle and exploration poses, preserve a still fallback and avoid particle-heavy quarry dust/shake loops. Every state must be comprehensible at 320px and 200% zoom with keyboard and screen reader. High contrast and a reduced-motion route are required.

**Future body condition/scars:** Only anatomy-validated plate, shoulder, snout and leg regions may receive future healed marks. A damaged mineral plate could later show a repaired seam after a *recorded qualifying injury and healing event*, not by random cosmetic RNG. Art anchors must remain stable across stage, pose, mirrored direction and later gradual body-build changes. No current injury/scar assets claimed.

## Candidate events and replayable identity

These names are **content labels awaiting approval**, not production endpoints or schema:

| Candidate event | Authority needed | Reaction that is earned, not invented |
| --- | --- | --- |
| `care.rest_completed` | Saved rest command and authoritative care revision | Next strenuous activity begins without pretending the last rest never happened |
| `world.stable_path_marked` | Committed Old Steps waypoint | Craggle checks that confirmed safer turn |
| `world.cavity_found` | Verified Hollow Wall discovery | Briefly taps the saved niche on revisit |
| `craft.trail_plaque_carved` | Committed one-time crafting result and owned object | Straightens the existing plaque in its home |
| `social.help_accepted` | Actual player-selected support action | May approach a previously helpful friend more readily |
| `battle.counterweight_spent` | Authoritative battle settlement and valid token | Short satisfied posture on later safe battle prep |
| `danger.rescue_confirmed` | Audited rescue event and nonlethal resumption | Cautious relief reaction, no retroactive fabricated trauma |

**Memory rules:** A genuine committed event can support contextual callbacks; a missed school day cannot create a remembered neglect story. Same-species individuals must differ through persisted temperament and real choices without forfeiting skills or essential care. The replay experiment in CK-BEH-LAB-001 is synthetic, not a trusted service contract. Any learned-preference tag handling must incorporate its independently reported prototype-security/correctness review, and memory identifiers must not include student names, PINs or private school records.

## Student-facing copy samples

| Context | Sample |
| --- | --- |
| First introduction | “Craggle heard something under that rock. Now it has questions.” |
| Calm greeting | “It carefully puts one pebble back exactly where it found it.” |
| Route choice | “Loose stones ahead. The longer path looks safer.” |
| Successful clue | “That echo is different. There may be an opening nearby.” |
| Wrong choice | “This spot is unstable. Try the worn path instead.” |
| Happy discovery | “A smooth carving stone! Craggle inspects every edge.” |
| Craft confirmation | “Your trail plaque is saved. It marks the safe way.” |
| Fatigue | “Craggle's legs are tired. Let it rest before digging again.” |
| Brace | “Braced: resists one push. One turn left.” |
| Counterweight | “Counterweight ready. Lever Strike can use it once.” |
| KO | “Craggle is knocked out of this match, not gone forever.” |
| Rescue | “Craggle needs help. Basic care and rescue are free.” |
| Quiet joke | “It has sorted eight pebbles. Seven are the same pebble.” |

Copy should be readable for students who need short, straightforward instructions. An expressive animation never replaces the explicit state label, feedback or consequence.

## Acceptance scenarios for later implementation

**These are specifications, NOT_RUN.** Design review is not proof of a working species, school field use or combat balance.

| Test | Scenario | Observable, authoritative acceptance |
| --- | --- | --- |
| CRG-01 | Blackout silhouette at 48–64 CSS pixels | Distinguishable asymmetrical ridge, four feet and shovel snout; not a generic rock/turtle/golem or copy of another species |
| CRG-02 | Create two Craggle with different persistent seeds | Same core skills with distinct observable preferences over recorded experience, no fabricated past |
| CRG-03 | Perform Examine/Brace/Carve twice with same command ID | Only one carved object, quest advancement, receipt and memory; no economy duplication |
| CRG-04 | Choose unstable Old Steps path | Specific recoverable failure clue, never invisible punishment or irreversible injury |
| CRG-05 | Correctly compare Hollow Wall echoes without speakers | Full keyboard and readable visual waveform/transcript alternative, same discovery |
| CRG-06 | Solve Spring Shelf by long route or safe brace | Both choices can complete quest, different acknowledged cost/observation |
| CRG-07 | Finish three-stop adventure with no battle | Durable personal discovery + decor item + home progression, no required combat XP |
| CRG-08 | Save trail marker, sign out, reopen on two devices | Identical authoritative progress, no lost stone/waypoint and no stale overwrite |
| CRG-09 | Set Brace while eligible, then attempt to stack another | Correct bounded duration and resource cost; no permanent unbreakable stance |
| CRG-10 | Eligible defended hit arms counterweight; duplicate battle request | Maximum one token, identical settled receipt, no rerolled resource or HP |
| CRG-11 | Spend token using Lever Strike once | Token gone, capped published effect applied once; no stale recharge exploit |
| CRG-12 | Counter during prepared Brace with alternative move/terrain | At least one viable response; no automatic mandatory single-species advantage |
| CRG-13 | Craggle faints in ordinary classroom PvP | No death, no memorial, lasting status only if separate valid rule |
| CRG-14 | Exercise or explore to exhaustion | Rest and free essential rescue always work; school absence/outage never turns it into death |
| CRG-15 | UI in reduced motion, keyboard-only, 320px and actual school Chromebook | Brace, warning, route clue and status independently readable and operable |
| CRG-16 | Enter any legitimately unlocked legacy habitat, including `sky` | Existing earned home/legacy streak untouched; no invented home or new attendance point |
| CRG-17 | Switch verified accounts on shared Chromebook | No previous owner's carving, memory, home, name or map on the next user's display |
| CRG-18 | Inspect future healed plate scar | Only from a recorded actual wound/heal, anatomical side stable in all poses; no arbitrary cosmetic health changes |

At design acceptance, require originality review against **Mochi** (soft garden protection), **Mosswisp** (six-legged forest microhabitat linking), **Rimehorn** (frost reserves/shelter care), **Duneglass** (light redirect) and against common stone-monster genre silhouettes. Craggle’s player decision must remain **route safety + carving vs. timed brace**, not “a tougher Craggle recolor.”

## Delivery dependencies and honest status

- **CK-ART-001:** palette/pose/rig style, actual art filenames, limits and originality/right-to-use review.
- **CK-CARE-001:** trusted cost and restoration for digging, rest, carving, hunger and free rescue; no school absence fatal decay.
- **CK-BEH-001/002:** validated species temperament baseline, genuine episodic memory and reduced-motion expressions; never synthesize unknown import history.
- **CK-WORLD-001 / CK-KEEP-001:** route design, persistent authored clues, quest receipt, one-time keeper rewards, noncombat parity and saved habitat state.
- **CK-BATTLE-001:** detailed legal turns, stamina, brace and token caps, counterplay, effects, economy and replay.
- **Codex:** independent review and future approved catalog/content integration. **Do not merge directly into a live game** based on this document.
- **Grant:** approve tone and the actual asymmetrical silhouette before expensive visual production.

**Actual deliverable:** one original first-12 species proposal, ecology and exploration script, keeper and battle hooks, visual requirements, 18 future tests. **No runtime implementation, new art, deployment, migrated pet or school Chromebook evidence is claimed.** 
