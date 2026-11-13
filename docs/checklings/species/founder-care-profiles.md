# First four Checklings — founder care, personality and expression profiles

**Task:** CK-FOUNDERS-001 | **Owner:** ChatGPT Personal | **Status:** design proposal for independent review; NOT implemented or deployed | **Pinned baseline:** `89f4502966ec1bca9bd6ce093c8f90b8d2f906a2`

The four original Checklings already belong to real owners. **Do not replace, redesign, randomize, rename, re-adopt or silently reset them.** Expand their personalities as a content layer over authoritative individual creatures. This document deliberately proposes no mutation to the legacy Checkling schema, the existing image catalog, Apps Script, authentication, database, game rules, or live artwork.

## Existing facts that this proposal treats as fixed

| ID / canonical name | Identity to preserve | Authoritative first-12 design | Existing art |
| --- | --- | --- | --- |
| `mochi` / Mochi | Original soft-hearted monster; affectionate, earnest, easily delighted; existing silhouette | Meadows / growth; guarding builds an ally shield; unusual garden plants; **play followed by quiet rest** | Keep original still and idle; no battle art is finished |
| `bolt` / Bolt | Original small curious robot; investigates useless pebbles and everything else; existing silhouette | Mechanical frontier / alloy; blocked hits charge bounded counterattack; gadget repair and crafting patterns; **study with breaks** | Keep original still and idle |
| `zee` / Zee | Original cosmic daydreamer; dreamy observer with specific questions; existing silhouette | Cosmic expanse / cosmic; alternates support and attack; star maps and discoveries; **quiet observation and a clean resting place** | Keep original still and idle |
| `ember` / Ember | Original pocket dragon with tiny wings; brave, protective, proud of accidental cooking; existing silhouette | Volcanic wastes / flame; rest banks one controlled heat burst; nest warming and fired-clay decor; **meals and wing rest after exploring** | Keep original still and idle |

Sources of truth: `apps/checklings-foundation/species-plan.json`, `docs/checklings/FIRST-12.md`, `docs/checkling-pond/README.md` and `docs/checklings/MIGRATION.md` at the pinned base. Existing live pet artwork remains under `public/hubs/checkling/pets/`. The companion's earlier Grok export contained the original four friends, berry play and nuzzles; its five school-day keepsake stages and earned homes predate the larger game.

**Legacy promises:** Current `checkling-v1` preferences may contain only species, up-to-18-character nickname, and chosen habitat. The five actual home IDs are `meadow`, `grove`, `cove`, `sky`, `cosmos` (best school-day streak milestones 0/3/7/14/30). The label Cloud Island does not change stored `sky`. Official streaks, milestones and earned homes are **not** new-care XP. A missed day does not shrink a pet or cause game death. Legacy records do not contain a saved birth date, memory history, disposition, injuries, weight, genealogy, or battle wins. Those facts must never be reverse-invented.

## Species defaults are not individual personality

A **species default** is a soft starting inclination that influences first impressions. An **individual** has a separately created, persisted temperament seed, genuine recorded experience, species-relative wellness, likes/dislikes, learned preferences and voluntary choices. A Mochi that becomes cautious stays Mochi; two Mochi should feel distinct, and **no Checkling is permanently locked out of a keeper activity or battle role because of species**.

**Proposed non-authoritative 0–100 temperament center points** (for the independent behavior-contract owner to review; NOT a current persisted field):

| Species | Curiosity | Sociability | Caution | Activity | Resilience | What the shape of the profile means |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Mochi | 60 | 78 | 52 | 46 | 59 | Loves togetherness, takes an interest in living things; not always brave |
| Bolt | 88 | 49 | 34 | 72 | 62 | Investigates mechanisms impulsively; retreat is learned and possible |
| Zee | 78 | 40 | 61 | 35 | 67 | Notices patterns and needs quiet; not helpless in a fight |
| Ember | 66 | 67 | 27 | 79 | 55 | Runs toward trouble, protects allies; has to learn pacing |

This is a **distribution**, not four hardcoded identical personality vectors. At adoption/import: preserve immutable species; create a *new, random server-authorized seed exactly once* in the appropriate creation transaction, store it with an algorithm version and independently record real future events. A deterministic replay experiment can sample those fields, but its current hash is not cryptographic and must not issue identities or outcomes. A legacy founder with no events has **no recorded prior favorite toy, trauma, friendship, or rescue**. Generated flavor thought may be shown as clearly ephemeral presentation, never misrepresented as a remembered incident. Future memories cite committed event IDs.

**Storytelling contract:** Expressions imply creatures have temperament and respond to care; marketing must not claim genuine consciousness. The owner decides how dark the humor gets. Warnings, illness and rescue copy stay clear rather than using jokes that disguise consequences. Keeper and battler pathways remain equally consequential; students choose freely.

## The four founder design profiles

### Mochi — a garden keeper who learns to stand firm

- **Silhouette / sound:** Maintain the owner-supplied round, soft-hearted original form. Any new face/leaf/prop is a detachable overlay, not a redesign. Gentle bounce and a small rustle are optional; a reduced-motion still communicates every state.
- **First impression:** Watches a hand approach; brightens at familiarity. Can be clingy *or* independent according to an individual's genuine care history. Not a speaking human in a costume.
- **Core needs:** Group play **and recovery time**; appreciation for plant varieties. Do not mechanically penalize students for preferring solitary care or for not visiting outside school.
- **Suggested care verb:** **Tend the Patch** (water/weed/observe an individual plant). A calm attention choice reveals a plant detail; an energetic play choice risks an amusing harmless mix-up, not permanent loss. Provide quiet rest and a no-cost essential-care alternative.
- **Individuality moment:** After a real remembered event `tend_patch:patch-1`, later return may show Mochi inspecting that patch first. Without that event, use generic curiosity, not “remember when you planted...”.
- **Discovery role:** Read soil/plant cues; contribute a garden observation or rare seed clue. Keeper obtains a recorded Encyclopedia finding, an accessible decoration pattern and meaningful progression without battle.
- **Tactical identity:** Guard-earned ally shield. Tell the player when a shield is queued, its cap, duration and counterplay. Mochi trades immediate offense for protecting a teammate; successful defense is rewarding, not an involuntary role.
- **Stress / recovery:** Under high distress may tuck in or look for reassurance; recovery moves through approach → slow nuzzle → rest. Prolonged absence is never the trigger. Repeated nuzzles should not magically cure a serious illness.
- **Five expression ideas:** curious head-tip, pleased little hop, determined planted stance, worried curled still, sleepy settle. These are **proposed states**, not claims of existing frames.
- **A distinctive joke:** Finds a pebble in the garden and guards it as if it were an extremely valuable vegetable. No coins or loot awarded by this incidental animation.

### Bolt — a tinkerer whose curiosity has a cost

- **Silhouette / sound:** Preserve the original robot proportions and markings. Future articulation uses readable eye/indicator changes, arm movement and a tiny harmless mechanical click; respect reduced motion, no flashing or aggressive looping.
- **First impression:** Notices an imperfect hinge long before noticing a prize. Gets distracted by pebbles even in a well-equipped workshop. Curiosity is not a blanket advantage in combat.
- **Core needs:** Periods of safe investigation interleaved with actual rest. Too many intense actions can exhaust Bolt; it remains capable of basic care and free treatment.
- **Suggested care verb:** **Inspect and Repair** (choose one of two visible faulty gadgets). Observe first yields a clue; rushing produces a funny reversible misassembly. On a confirmed repair event, one actual crafting pattern may be unlocked, idempotently.
- **Individuality moment:** A Bolt that has genuinely repaired the wind-up gate may greet the same gate differently. A new Bolt can only notice it, not boast about past repairs.
- **Discovery role:** Reveals mechanical joinery, working diagrams and noncombat crafting recipes, including habitat tools accessible without victories.
- **Tactical identity:** Block → store exactly one bounded charge → visibly spend charge on a counterstrike. Repeated blocks cannot accumulate unbounded damage; exhaustion/recovery is visible.
- **Stress / recovery:** Under high fatigue slows inspection, pauses to cool and requests a break. Don't use red error lights as the only illness signal; pair with a plain text status.
- **Five expression ideas:** lens/eyes zoom, two-beat investigative turn, satisfied repair-click pose, cautious overheating rest, braced counterattack. Proposed layered poses; no new artwork claimed.
- **A distinctive joke:** Quietly sorts pebbles by how much they look like other pebbles. The notes are almost certainly unnecessary, which does not stop Bolt.

### Zee — an observer who makes discoveries by noticing patterns

- **Silhouette / sound:** Keep original cosmic figure, scale and facial identity. Avoid transforming Zee into a generic star/glowing orb. Optional low-amplitude float is decorative; provide static star-map indicators in reduced motion.
- **First impression:** Spends longer noticing a shadow or a constellation than other creatures do. Curious, not automatically all-knowing. Questions should reveal uncertainty, not invent history.
- **Core needs:** Quiet observation and **a clean resting place**. Loud activity is an option, not a forbidden path; a sociable Zee may enjoy company after building real friendship.
- **Suggested care verb:** **Map the Night** (compare two visible constellations). An observation made and committed at the correct stage creates a durable map fragment. Mistakes invite another look rather than “failed forever.”
- **Individuality moment:** Zee can react differently to a confirmed discovered constellation it has seen before. Do not imply a last-night visit unless the event exists.
- **Discovery role:** Tracks real in-world sky cycles, landmarks and navigation clues. Reward actual player interpretation rather than auto-filling every solution from an “oracle pet.”
- **Tactical identity:** Orbit alternates support and attack phases, with current/next phase clearly displayed. Counterplay depends on predicting and timing the phase; no invisible state changes after reload.
- **Stress / recovery:** With low comfort, watches quietly from a safe location. After rest and care, asks to observe together or displays a small discovered constellation.
- **Five expression ideas:** upward glance, thoughtful slow tilt, tiny orbit indicator, supportive open stance, settled observatory still.
- **A distinctive joke:** Asks why there are twelve stars in a constellation that everyone else insists contains eleven. On closer inspection, one is a moth.

### Ember — a protective adventurer who learns to slow down

- **Silhouette / sound:** Preserve owner-supplied tiny-winged pocket dragon. Maintain recognizable flame/scale palette. Scars or heat vents are future **anatomy-anchored** overlay work, not a replacement species skin.
- **First impression:** Stands between companions and a harmless noise, then pretends it wasn't worried. Brave and protective, not permanently angry or aggressive.
- **Core needs:** Real meals, exercise/exploration **and wing recovery**. Feeding is not permission for infinite training; later body-condition features model long-term effects independently.
- **Suggested care verb:** **Warm the Nest** (select safe warmth and rest intervals). Earn a verified incubator care contribution or fired-clay decoration once, with clear resource costs. Overheating causes a recoverable need for rest, not an untelegraphed death.
- **Individuality moment:** Ember may inspect a fired-clay ornament it actually made; newcomers cannot be told they already baked something. A gentle keeper experience may soften bravado; no forced aggression.
- **Discovery role:** Warms seed nests and supports safe volcanic exploration. Shares decorated kiln tiles, nest upgrades and discoveries with noncombat players.
- **Tactical identity:** Rest/defend can **bank one bounded heat burst** for an openly telegraphed move; spending clears the charge. Opponents get meaningful defend/reposition options, and ordinary PvP never uses permanent death.
- **Stress / recovery:** Overexertion makes wing beats smaller and seeks warmth/rest; caregiver always has a free basic meal/rest option, even after a battle loss.
- **Five expression ideas:** proud upright stance, curious sniff, folded-wing rest, heat-bank posture, relieved protective nuzzle.
- **A distinctive joke:** Is extremely proud of a piece of toast that is, by any reasonable definition, charcoal. Other Checklings are very polite about it.

## Cross-species behavior matrix: not just dialogue variations

These are **design expectations for visible reactions**, not an executable simulation or runtime behavior.

| Input / context | Mochi | Bolt | Zee | Ember |
| --- | --- | --- | --- | --- |
| Returning after legitimate recent care | Checks previously tended patch if logged | Inspects recently repaired gadget if logged | Points at confirmed observed sky note | Examines a kiln creation if logged |
| Quiet care action | Relaxed, gains reassurance | Focused calibration | Calm observation | Gently folds wings |
| High-energy play choice | Short playful bounce then rest need | Investigative sprint; can tire | Joins on its own terms | Excited chase; needs wing recovery |
| Small reversible mistake | Knocks over watering pail | Repairs wrong side first | Counts moth as a star | Proudly burns toast |
| Genuine discovery reward | Unusual seed/plant field note | Recipe or repair pattern | Star-map/landmark fragment | Warm nest or fired-clay decor |
| Battle preparation | Protects ally by guarding | Deliberately blocks to charge | Announces next orbit phase | Announces banked heat |
| Active low comfort | Withdraws gently | Stops to cool and regulate | Seeks calm, clean nook | Rests wings and seeks care |
| Real friendship milestone | Initiates a nuzzle | Offers an inspected odd trinket | Shares a discovered pattern | Stands watch while ally rests |

**Variation rule:** Do not choose all reactions from species ID alone. The server-authoritative creature snapshot must supply well-being, durable temperament, genuine event-derived preferences and current context. If insufficient data exist, use a safe generic idle, not a fabricated memory. The player can influence but not fully script reactions. Different individuals can learn different favorite activities; species defaults are not eternal bonuses or penalties.

## Interaction and memory event candidates (for CK-CARE-001 and CK-BEH-001)

No client-claimed outcome should become a memory. The following names are **proposed content identifiers only**, NOT a shared API or committed schema:

| Candidate event | Required legitimate evidence | Memory-safe callback example | Forbidden shortcut |
| --- | --- | --- | --- |
| `care.patch_tended` | Committed patch care command + owning creature | “Looks toward the patch it helped tend” | Invent a plant history from species alone |
| `craft.gadget_repaired` | One-time authoritative repair and receipt | “Checks the gate it fixed” | Repeat/reload to mint more recipes |
| `discovery.constellation_mapped` | Server-approved exploration result | “Recognizes the map it helped make” | Assume yesterday's night sky was visited |
| `craft.nest_warmed` | Committed nest care and appropriate resources | “Inspects the nest it helped warm” | Treat a failed request as successful |
| `social.comfort_received` | Real acknowledged care interaction and consent | More willingness to approach | Force “attachment” on a newly imported pet |
| `battle.ally_protected` | Settled authoritative battle event | Cautious ally looks more trusting | Client reports battle victory |
| `danger.rescued` | Audited actual rescue (never inferred) | Recovery animation tied to event | Retroactively suggest a rescue happened |
| `home.changed` | Authorized durable home choice / revision | Looks around its chosen home | Unlock arbitrary home due to cosmetic action |

Store references to legitimate events and bound derived episodic selection; sensitive classroom metadata should **never** enter pet memory. No fabricated attendance, student names, personal emails, voice recordings, location tracking or identity scoring. Avoid personal diagnoses or attachment pressure. Memories remain inspectable, correctable, and revocable under the future privacy model. An irreversible outcome such as death is a separately reviewed consequence, never triggered by a flavor event.

### Individual examples that should be replayable

- **Same species / different lives:** Two newly created Mochi with the same species baseline but independently persisted temperament seeds should demonstrate some divergent voluntary reactions over a representative test, while both remain able to protect and garden. Never require one to have a “past favorite” before experience exists.
- **Same individual / repeated input:** One Bolt that has already repaired gate A may reference it after reload; replaying identical event ID changes neither memory count nor crafting inventory.
- **Context outranks flavor:** Tired Ember asks to rest even if adventurous by temperament. In a real warned-danger state all four prioritize accessible warning/rescue content over a joke or favorite animation.
- **Cross-device truth:** The same Zee sees the same confirmed constellation memory and home across devices after a saved revision. A second user on the same Chromebook sees none of it.

## Stage-appropriate presentation

The legacy **five school-day growth stages** remain an earned visual/progress journey; do not redesign the sprites or relabel earned stage on this task. These proposals support layered *expressions* that can be added incrementally once actual assets exist:

| Proposed group | Minimum frame contract | Required nonanimated equivalent |
| --- | --- | --- |
| Idle/curious/joy | Existing original still + optional 2–4 restrained frames or transform offsets | Approved original still and explicit mood text |
| Care/rest/low-energy | One readable anticipation, response and settled state | Still pose + “Resting” / “Needs rest” |
| Discovery/crafting | 1–2 brief unique emotes and optional owned prop overlays | Static badge and unlocked item/field note text |
| Tactical prep/attack/defend/KO | Future approved species-specific poses tied to server battle phases | Phase/charge/guard text and static actor icon |
| Illness/rescue/recovery | Clear warning and recovery states, sober and accessible | Written status, free care action and persistent rescue notice |
| Future healed wound/scar | Anatomy-owned mask/anchor with visible stage and near/far handling | The wound log remains accessible even if art asset missing |

**Asset protocol:** Designers must reference the exact existing art files and visually QA new layers. No image file renames in this proposal. An original founder's face/silhouette should remain recognizable at 48–64 CSS pixels. Preserve the existing still fallback. Target reduced-motion, keyboard navigation, high-contrast states and descriptive alt/status text. Avoid flashing effect loops, rapid screen shaking, audio-first instructions, giant atlases or downloading 300 assets at initial launch. Battle and scar anchors do not exist yet; they are dependencies for later artists, not completed work.

Suggested staged asset families per founder: `idle`, `curious`, `joy`, `rest`, `care_response`, `discovery`, `guard_or_charge`, `attack`, `hurt`, `ko`, `rescue`, `recovered`, plus a proposed anatomy surface map for future localized wounds. Pose lists do not imply current coverage. Avoid artist-generated “generic baby creature” replacements.

## Keeper and battler parity by founder

| Founder | Keeper goal with committed evidence | Battle tactical choice with observable consequence | Does not require |
| --- | --- | --- | --- |
| Mochi | Tend a plant collection → identify species → unlock decorative garden display | Guard now for capped ally shield later | Winning any battle to grow a garden |
| Bolt | Repair habitat tools → unlock pattern → craft useful room fixture | Spend stamina to block now and counter later | Buying a win-derived power item to complete repair |
| Zee | Observe sky → map landmarks → decorate observatory / unlock discovery | Choose attack/support phase timing for orbit | Fighting to obtain map fragments |
| Ember | Care for warm nest → create fired-clay tile → display a kiln set | Rest to bank heat, then choose burst timing | PvP participation for incubation progress |

Account-level discovery and earned homes persist if an individual dies under separately approved rules; ordinary class duels never kill. Serious neglect requires verified warnings, generous chance to intervene and free rescue. Outages, expired sessions, weekends and school absence do not silently advance irreversible harm. A battle victory does not automatically make a creature's social memories “happier,” and a solitary keeper should not be starved of character development. The owner may choose either path regardless of gender.

## Observable acceptance cases for the eventual pilot

Each line must be tested against an actual implemented and server-authoritative feature when available; **all remain NOT_RUN for this document**. Test with synthetic member identities and a real district Chromebook gate later.

| ID | Test | Pass requirement |
| --- | --- | --- |
| FND-01 | Import an existing founder with an 18-character nickname and `sky` home | Exact species ID, nickname, home, best streak and earned other homes remain; no fabricated age/likes or prior injury |
| FND-02 | Import a founder twice, then refresh two devices | No duplicate individual and no changed temperament/name/habitat; older tabs cannot overwrite current state |
| FND-03 | Create 30 synthetic individuals of a single founder species | Stable species defaults but individual variation; no default alone determines every observed action |
| FND-04 | Replay identical authorized care event twice | Exactly one durable memory/effect, same revision/receipt; no reward duplication |
| FND-05 | Care for each founder, then leave and return with validated session | Saved preference/experience influences a visible context-specific reaction; new pet never references fabricated history |
| FND-06 | Exhaust Ember or Bolt through allowable active choices | Visible need for rest, free recovery always operable, no offline lethal penalty |
| FND-07 | Exercise each founder's keeper loop without a battle | One persistent discovery and one relevant habitat/decor progression unlocked per species |
| FND-08 | Exercise each founder's battle hook with defender/counterplay | Guard/charge/orbit/heat state telegraphed, capped, server-legal, saved and once-settled |
| FND-09 | Put two same-species pets with different recorded lives on identical scene | Meaningful difference when their context/temperament predicts one; both remain eligible for same core goals |
| FND-10 | Reduced-motion and keyboard-only experience at 320 px and school Chromebook | All relevant states text-readable; no animation required to discover warnings, rest, rewards or counters |
| FND-11 | Swap two verified accounts on a shared device | The second account sees no prior name, expressions, story, memory or art overlays tied to private state |
| FND-12 | Create a serious distress/warning scene | Status and free rescue override comedy flavor; no irreversible effect caused by absent days or downtime |
| FND-13 | Retain legacy `sky` home and advance a new game cosmetic unlock | No retroactive attendance points or best-streak adjustment; new progression stored separately |
| FND-14 | Revisit missing, unapproved or corrupt art in all five growth stages | Existing approved still and plain text remain; no broken expression covers the pet or needed controls |
| FND-15 | Two founder individuals perform the same discovery on different devices | Each receives only its own committed event/memory and entitlement; no cross-account leakage |
| FND-16 | A wounded founder later heals into an anatomy-localized mark (**future gate**) | Artwork tracks true body region across poses/stages and mirroring; no client-claimed scar or functional penalty after full recovery |

Do not infer implementation from this check list; source, staging, school device and actual student pilot are different evidence classes. For acceptance of this *design* document, require reviewer confirmation that: (1) founder appearances are preserved against originals; (2) the four roles produce different care/discovery/battle choices; (3) preference and event descriptions are suitable for later schemas; (4) expressive copy is comprehensible at middle-school reading levels; and (5) the art plan does not claim assets exist.

## Exact integration boundaries and handoff

- **CK-CARE-001:** owns real care command semantics, resource spend, essential recovery, idempotency and authoritative server effects. This document only names desired species-specific reactions.
- **CK-BEH-001/002:** own persistent trait/memory contract and first-12 expressive vocabulary. The independent `CK-BEH-LAB-001` / PR #231 provides **synthetic** replay experiments, not an approved shared API. Use this proposal's species distributions as feedback, not a production constant.
- **CK-BATTLE-001:** owns real tactical mechanics, caps, move costs and PvP boundaries. Guard, charge, orbit and banked heat are existing *design hooks*, not attacks authorized by this task.
- **CK-ART-001:** owns art manifest names, pose/atlas technical budgets and first-12 visual acceptance. This document cannot certify file presence or visual likeness.
- **CK-KEEP-001:** owns rewards, actual keeper economy and parity timing. Proposed discovery loops must not bypass authored server content or duplicate entitlements.
- **CK-MIGRATE-001:** owns original preference source, HMAC-protected membership mapping, import fence, anti-duplication and restore. Never change or backfill legacy `checkling-v1` based on founder flavor.
- **Codex:** independent integration reviewer; may approve this proposal as input to the interface/content pipeline once the other task owners reconcile it. Do not merge it directly into a deployed endpoint.
- **Publication:** Batch05 private school bridge was previously blocked from publication pending specific owner authorization. No code in that bridge or any attendance/Hall Pass path is requested or changed here.

**Delivered evidence state:** design-only markdown content, four founder dossiers, candidate events, 16 future acceptance checks. **No runtime test, new art, persisted personality, real school trial, game service or release is claimed.**
