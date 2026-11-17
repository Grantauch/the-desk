# Mosswisp — original first-12 species brief

**Task:** CK-SPEC-001 | **Phase:** first-12 candidate design, NOT implemented | **Task owner:** ChatGPT Personal | **Baseline:** `89f4502966ec1bca9bd6ce093c8f90b8d2f906a2` | **Owned path:** `docs/checklings/species/mosswisp.md`

> **One-line identity:** A quiet six-legged forest restorer carries a single seed-lantern and repairs the small, easily missed places in a living forest. It is not a floating ghost, a generic mushroom monster, or a recolored Mochi.

This is an **original content proposal**, not an approved species in the live game, a finalized ability balance sheet or a rendered asset. It preserves the design-candidate facts in `apps/checklings-foundation/species-plan.json` and `docs/checklings/FIRST-12.md`. Proposed art and mechanical details require independent review by CK-ART-001, CK-BATTLE-001, CK-CARE-001 and CK-BEH-001. No shared catalog, live art, database, service or existing pets are modified.

## Locked candidate identity

| Field | Candidate value | What must not silently change |
| --- | --- | --- |
| `id` | `mosswisp` | Stable base species ID; evolved forms do **not** count as additional base species |
| Name | Mosswisp | One of first 12 distinct original species |
| Ecosystem ID | `forest` | Ancient forest is a setting label; `forest` is the canonical 12-ecosystem key |
| Affinity | `spirit` | Do not silently remap to growth just because it looks like moss |
| Base silhouette | Low, broad six-legged moss lattice with a **single hanging seed lantern** | No humanoid/floaty-wisp redesign and no founder-art reuse |
| Baseline personality | Patient; collects fallen things; quietly repairs damaged places | No claim of natural language understanding or consciousness |
| Battle hook | Linked healing marks | Not free full-party healing or damage immunity |
| Keeper/discovery hook | Forest restoration and fictional plant identification | Not an alternate name for Mochi's garden |
| Care preference | Habitat tidying and gentle play | Essential food, rest and free rescue remain universally accessible |
| Art status | PLANNED | No existing complete concept, portrait, attack frames or atlas is certified here |

**Visual originality test at thumbnail size:** In black silhouette from 48–64 CSS pixels, a viewer must see a low moss “bridge” of interwoven ribs, **six distinguishable legs**, and one distinctive pendant seed-lantern hung beneath a bent stem. The living lattice forms sheltered openings that admit light and tiny forest debris; it is not a bag of vegetation or a bright magical cloud. The lantern contains **one viable-looking seed shape**, not a human face or jewel.

## A creature shaped by its job

In old forests, fallen logs, broken roots and sheltered gaps can become the starting places for new growth. Mosswisp tends these small microhabitats. The woven body looks halfway between an animal and a miniature living footbridge: dark flexible root ribs under a velvety moss coat, small leaf tabs where the joints meet, broad gripping pads on six asymmetrical legs, and a single gently swinging seed pod on an overhanging stalk. The head is only a subtle swelling with two readable eyes; avoid a big baby-animal face. No clothes, tools, weapon or backpack by default.

Its lantern is **not a lightbulb or magic healing machine**. When Mosswisp finds a suitable place for a seed, it bends down and gently deposits a visible point of light/dust for a moment. The moment teaches the player to look under obstacles and preserve continuity between forest patches. Art direction should treat the light as a short illustrative cue, not an unbounded particle system.

**Ecological niche:** Mosswisp picks up leaf fragments, identifies fungus-like symbionts, carries seeds across narrow gaps and makes little shelters along rotting wood. It helps a recovering woodland connect isolated patches. It cannot instantly regrow a destroyed forest; restoration is a long-term, visible, authored progression route that respects the game's world state.

**Personality:** Patient, stubborn about unfinished work, quietly curious about what others threw away. Startles at careless trampling, but can grow more adventurous or sociable through **recorded** play and care. Its small delight is fitting three mismatched pieces of bark into a surprisingly useful ramp. Some individuals become meticulous organizers; others hoard ridiculous bits of twig until taught to sort them. The species default should influence tendencies without declaring each individual identical.

**Where it lives:** Shaded understory and fallen-log crossings. Habitat needs dry breathing spaces and a little dampness: not soaking standing water. In a shared classroom safe space, a student can keep Mosswisp in any legitimately earned home via habitat-safe decor props; it does **not** retroactively change preexisting founder homes or attendance streaks.

## The player should learn who Mosswisp is by doing

### Care loop: Gather → Sort → Shelter

1. **Gather:** Mosswisp notices three bits of fallen material around its habitat: a leaf, a twig and a loose seed husk. The player picks what to collect. Show which items are useful instead of hiding success behind random chance.
2. **Sort:** The player chooses the appropriate small sheltered location. A safe mistake produces a readable, reversible wobble or mess, not a lost creature, illness or withheld meal.
3. **Shelter:** The player arranges a tiny windbreak over a nursery patch. Once a **server-authoritative, idempotent** action succeeds, Mosswisp can visibly return to inspect that specific patch, and the player earns a small restoration observation.
4. **Rest:** After enough active work, Mosswisp needs a rest. A player who just wants to nurture it can choose gentle tidying/observation and still progress. A player who wants battle can use the same small environmental clues for tactics.

**Care preferences:** a clean resting nook, a place to put found items, gentle play that does not damage the lattice. “Clean” should mean safe habitat housekeeping, not an ever-decaying penalty while school is closed. Persistent feeding, illness, body condition and permanent death rules come from the care contract, not this text. A new or poor player always has a free path to essential rescue, meal and rest.

### Discovery loop: The Broken Log Trail

Use a finite authored micro-route rather than pretending an unlimited procedural forest exists. Proposed **three explorable stops**:

| Stop | Player observes | Meaningful choice | Commit-worthy result | Keeper reward (no fight needed) |
| --- | --- | --- | --- | --- |
| **Fallen Log** | A sapling cannot get light through a small gap | Clear debris **or** build a gentle brace | Recorded improvement to the log microhabitat | One field note on decomposers and a found structural pattern |
| **Fungus Steps** | Thin pale threads connect shaded and dry patches | Examine tracks and choose where not to tread | Logged, optional fictional “thread network” discovery | A small bridge decoration blueprint |
| **Seed Crossing** | One sheltered side is isolated by a short muddy dip | Place a miniature shelter before transporting a seed | First confirmed patch linkage and a one-time discovery event | A living-bridge decoration or habitat microfeature |

**Player agency:** The route presents visible clues, at least one genuine decision and consequences that the world remembers. Choosing carefully can conserve an in-game resource or reveal extra observational text. Incorrect choices remain recoverable and should not cause hidden death; an intelligent player can learn from outcomes. Keeper completion requires no PvP or boss victory.

**Natural repeat play:** New weather may reveal different litter and small pests, but content variation cannot reroll a once-earned blueprint or let the player repeatedly cash out the same discovery. The game should show the improved log and bridge afterward, not reset the environment on refresh.

**Separation from existing roles:** Mochi grows unusual plants in a **garden**; Mosswisp reconnects **forest microhabitats and safe crossings**. Siltstilts later deals with **wetland filtration**, Craggle with **safe cave paths**, Rimehorn with **seed storage**. Each is a different player decision/visual affordance, not merely a new dialogue skin.

## Battle: Root Relay — linked healing marks

**Fantasy:** Mosswisp supports allies by preparing safe ground. Its old root lattices make “threads” where a modest portion of healing can travel from one marked position to another. This is **tactical positioning and turn planning**, not uncounterable passive regen.

**Proposed rules contract for the battle owner to tune, not authorized production values:**

- `root_relay` requires an alive, owned, battle-eligible Mosswisp in an allowed mode and enough stamina. It **plants one visible mark** on a valid allied unit or field position; each mark has a battle-bound ID and explicit expiry/turn count.
- Mosswisp may maintain **at most two** linked marks at once (proposed initial cap). New placement when full either rejects with explanation or replaces the oldest **according to a versioned rule**, never silently stacks healing.
- A later valid healing action directed at one marked ally may pass a **smaller capped fraction** to the other *still eligible* marked ally if both links are active and neither exceeds max HP. Healing travels **once per resolved trigger** and is logged in the one battle transaction.
- If the ally is KO'd, mark expires, position becomes invalid or battle ends, **no phantom heal** is applied. Root Relay cannot revive a dead creature, cancel a memorial, or undo permanent injury without the separately approved healing rules.
- Ordinary PvP remains nonlethal. Players must see mark placement, remaining duration, which ally will receive secondary healing, and the counterplay **before** committing a turn.
- Valid counterplay: disrupt/break a link, pressure one marked ally, reposition around the linked area, or wait out the expiry; actual effect names, costs and viability are owned by CK-BATTLE-001.
- No client may submit final healing amount, RNG, target ownership, battle stage, cooldown or reward. Server settlement is atomic and idempotent.

**Teachable telegraph:** Two tiny root icons appear under valid allies with a thin intermittent line, plus the text “Linked 2 turns” and “Next heal shares a little.” The animation is decorative. A reduced-motion still shows the same relationship and a number; the link never exists only as a colored line.

**A useful turn:** Mosswisp must choose between guarding itself, establishing a link, or healing a hurt ally. A target that rushes damage may beat the setup, while a careful team can profit. The species should have relevant offense and a basic defend/recover path; every Mosswisp must not be forced into a passive healer role.

## Creature-specific individuality and memory

**Species-default temperament proposal** (0–100 centers; NOT authoritative fields): curiosity 62, sociability 43, caution 68, activity 37, resilience 72. The quiet inclination makes Mosswisp more likely to inspect and help than chase, but individual seeded traits and recorded actions can produce adventurous or enthusiastic creatures. The independent CK-BEH-LAB-001 experiment demonstrates that a content designer must not set a species to choose one intent 90% of the time by accident.

| Verifiable event candidate | Later response | What would be a false memory |
| --- | --- | --- |
| `world.log_shelter_built` | Checks the repaired fallen-log nook | “You built this last week” without a recorded event |
| `world.thread_network_mapped` | Points out the saved thread map on return | Treat a generated sky/forest image as a finished discovery |
| `world.seed_crossing_restored` | Uses the genuinely repaired crossing | Show restored map for another player's account |
| `care.habitat_sorted` | Puts the next found twig in its familiar spot | Invent past preferences on legacy import |
| `social.play_completed` | Approaches an activity it has positively experienced | Assume all Mosswisp dislike loud games |
| `battle.ally_relay_saved` | Displays a brief contextual readiness cue | Give combat bonus without a settled battle |
| `danger.rescue_confirmed` | After a validated rescue, briefly settles in a safe nook | Convert a failed network response into rescue success |

Use the real server receipt, event ID, creature ownership and versioned narrative selection to decide what to recall. Memory salience and any forgetting mechanism must be bounded and transparent. A pet whose earliest history predates the game never retroactively “remembers” those missing interactions.

**Small expression variations from real experience:** A tidy Mosswisp may put new twigs in sorted piles. An adventurous Mosswisp may inspect a second forest path. A stressed Mosswisp may choose the nearest protected nook instead of a social greeting. None of these are a mental-health classification or a claim that an AI has become sentient.

## Scene and animation direction (future assets)

Do not generate the art in this task; this brief instructs CK-ART-001 and future concept artists.

**Visual anchors**
- **Top view:** single delicate curved stem emerges from the front-left upper rib and drops a seed-lantern under the lower jaw area; always one pendant seed.
- **Profile:** body never floats; three legs on each side at rest; a deliberate grounded shadow and staggered alternating walk.
- **Chest/body:** porous rib lattice contains actual negative space. Moss surface should be painterly with tonal depth, not noisy photoreal moss wallpaper.
- **Face:** two small eye patches readable against dark leaves, expression through eye angle and stalk/stance; do not rely on a human mouth.
- **Colors:** forest charcoal / green / muted gold for readable contrast; lantern accent warm yellow rather than saturated cyan ghost glow. New palette still requires the shared art style contract.
- **Stage and individuality:** cosmetic moss density, fallen-leaf adornments or lantern shade can vary while six legs and lattice silhouette remain. Variants are NOT additional species toward 300.
- **Later scars:** only anatomy-valid rooted regions (rib lattice, stalk, legs) may receive healed marks once CK-BODY-CONDITION-AND-SCARS work exists. No childlike detached textures that float across mirrored frames.

**Future authored states:** original concept and approved idle; investigate; gather; sort; gentle play; rest; worried shelter; plant mark; mark linked; short heal-transfer; defend; attack; hurt; KO; rescue; recovered; discover. Combat states remain **planned**. Animation may be short; no ambient loop is allowed to obscure HP, care warning, controls or a teacher pause.

**Accessibility:** A static image and text must fully explain state. Example static alt: “Mosswisp, a low six-legged creature with a seed lantern, crouches beside a repaired log.” Battle status: “Two allies linked; one turn remains. Healing on either can share a small amount.” Provide text for errors, retries, options and discoveries; avoid direction-only gestures, faint link colors or sound-dependent instructions.

**Technical budgets:** Exact dimensions, file types, atlas organization, texture size and per-pose byte limits must come from CK-ART-001. Do not invent measured performance or actual PNG filenames. Lazy-load discovery and battle artwork only when needed; provide an optimized still for a resource-constrained Chromebook and a no-motion fallback. File paths, checksums and third-party ownership/rights reviews belong in the approved manifest. Confirm originality against other 11 base species and licensed external examples.

## In-world microcopy samples (student-readable)

These are proposed copy, not a canonized voice transcript. Do not surface apparent thoughts as factually remembered incidents unless tied to a committed event.

| Situation | Text candidate |
| --- | --- |
| First meeting | “It collected three leaves. It is still deciding where they go.” |
| Looking at a broken crossing | “Mosswisp points to the gap. There is room for a tiny bridge.” |
| Picking up a twig | “Good twig. Wrong size. Still a good twig.” |
| Gentle play | “It makes a little doorway. You are invited to duck.” |
| Overexertion | “The little legs are tired. Rest comes first.” |
| Confirmed shelter build | “Mosswisp checks the shelter you just finished.” |
| Confirmed prior map | “That thread path looks familiar. It's on your saved map.” |
| No memory available | “Mosswisp studies the forest floor. It may have an idea.” |
| Healing setup | “Root Relay is ready. Pick an ally to link.” |
| Invalid link | “That ally cannot be linked now. Choose another or defend.” |
| Link expired | “The root link faded. You can make a new one.” |
| Genuine discovery | “A tiny safe crossing. Not much to look at. A lot to live in.” |
| Funny idle | “Mosswisp has sorted four sticks by how much they resemble sticks.” |
| Low comfort | “Mosswisp needs a safe spot and a little care.” |
| Rescue warning | “Mosswisp needs help. Rescue is free. Choose Rescue or Rest.” |

Humor stays light even though the complete game will eventually contain serious consequences. Never make a death warning sound like a prize or an earned punishment. Keep text short and concrete for students with different reading levels.

## Dependency and test plan

| Test ID | Synthetic or future action | Acceptance target |
| --- | --- | --- |
| MSW-01 | Render silhouettes without color at 48–64 CSS px | Six legs, broad lattice, **one** pendant seed distinguishable from founders and other species |
| MSW-02 | Create two Mosswisp individuals with independent seeded temperament | Both retain species identity; meaningful optional variation without hard-coded behavioral clones |
| MSW-03 | Perform Gather/Sort/Shelter twice with identical committed command ID | No duplicated saved patch, decoration unlock or memory event |
| MSW-04 | Complete all three forest micro-route stops without winning a fight | Patch changes persist; keeper earns an independently meaningful discovery and decor milestone |
| MSW-05 | Choose an unsuitable material/shelter during route | Clear, recoverable explanation; no fabricated progress, irreversible harm or reward |
| MSW-06 | Leave/reload and revisit a legitimately repaired crossing | Same authoritative crossing, pet and prior event display; no wrong-account data |
| MSW-07 | New Mosswisp with zero committed memories | No prior “you saved this forest” or fabricated favorite-activity claims |
| MSW-08 | Plant two battle links, attempt a third | Enforced cap and visible replacement/rejection behavior; no overflow |
| MSW-09 | Heal a linked ally during a legal turn | Correct primary/secondary capped healing, once per authoritative settled trigger |
| MSW-10 | Expire, disrupt or KO a linked target before heal | No phantom transfer, resurrection, duplicate healing or state corruption |
| MSW-11 | Run nonlethal class PvP and disconnected/retried battle settlement | Legal server turn order; no permanent death and no repeated reward |
| MSW-12 | Explore with exhaustion or distress | Free rest/help available; no hidden penalty for offline absence or school closure |
| MSW-13 | Operate route and battle using keyboard/reduced motion | All routes, statuses, linked allies and recovery actions usable/readable without animation |
| MSW-14 | Place in meadow/grove/cove/sky/cosmos available homes | Valid saved homes remain stable; no unauthorized unlock or attendance effect |
| MSW-15 | Load missing or corrupt optional art | Approved fallback still and all instructions remain; care and server saves continue |
| MSW-16 | Compare selected Mosswisp behavior to Mochi, Siltstilts and Rimehorn | Distinct gameplay and ecologies, not recolored synonyms or arbitrary name-swapped rewards |

All cases **NOT_RUN** as of this proposal. MSW-01 depends on approved original art, MSW-04/06 on persistent world, MSW-08–11 on verified battles, and real Chromebook checks on student-safe staging. Do not count a markdown species brief as species #5 **playable** or as progress toward the complete 300-species shipped requirement.

## Handoff

- **CK-ART-001:** original silhouette/pose/rig concept, rights review, reduced-motion still, atlas and optimized asset manifest. Do not use founder assets as placeholder “new species done.”
- **CK-CARE-001:** map Gather/Sort/Shelter and essential rest/rescue to approved server commands; bound all rewards and effects.
- **CK-BEH-001 / CK-BEH-002:** individuality centers, authentic event-derived memory reactions and expression-state contract. CK-BEH-LAB-001's deterministic experiment is not an approved runtime interface.
- **CK-BATTLE-001:** link legality, stamina, expiry, caps, counterplay, server settlement and PvP rules, with no unbounded heal stacking.
- **CK-WORLD-001 / CK-KEEP-001:** connect the authored Broken Log Trail, ecological consequences, Encyclopedia/keeper advancement and parity economy; no battle win required.
- **Codex:** independent originality/feasibility review. Publish through later catalog/content PR only after art/gameplay contracts are approved.
- **Grant:** review whether this ecology, humor and silhouette match the desired mature-but-playful Checklings tone.

**Delivered:** an original single-species **content design**, 16 proposed acceptance cases, no source implementation, no live scene, no school data, no published art or deployment.
