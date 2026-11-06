# Checklings: 300-line roster architecture and balance gates

**Status:** preproduction design proposal for Claude/Grant; **not** new live species.  
**Authority:** `docs/checklings/DESIGN.md` and the locked first twelve lines in `docs/checklings/wave-one.md`.  
**Source register:** `docs/checklings/preproduction/300-line-concept-register.csv`.

## What the 300-line register does, and does not, mean

The register contains **300 unique species-line slots**, not 300 game-ready creatures, original character names, polished silhouettes, move sets or art assets. Entries CK001–CK012 are pointers to the already-approved Wave One lines; **do not replace or reinterpret their canonical species sheets**. Entries CK013–CK300 are working visual/concept hooks to select, rewrite, combine or reject through design review. Their `role` and `care_focus` cells describe what a designer must explore; they are **not new battle abilities, passive natures or implemented behaviors**. The `id` is the planning slot; IDs must not become server species IDs until approved and migrated.

Each of the 12 biomes has **24 proposed new lines** organized into two 12-line waves, both containing 6 lines per regional type and 4 lines per evolution category. Twelve regions × 24 = 288 proposals; plus the existing 12 = 300.

### Exact quota proof

| Axis | Quota |
| --- | ---: |
| Two-stage evolution lines | 100 (4 locked + 96 proposals) |
| Care-dependent morpher lines | 100 (4 locked + 96 proposals) |
| Non-evolver lines | 100 (4 locked + 96 proposals) |
| Meadow, Gear, Cosmic, Ember | 38 each (36 proposals + 2 locked each) |
| Tide, Stone, Storm, Shade | 37 each (36 proposals + 1 locked each) |
| Waves | 25 × 12 lines = 300, including locked Wave One |
| Biome distribution | 12 regions × 24 proposed lines = 288 |

To balance the elemental distribution **without expanding eight battle types**, each type is assigned to exactly **three** major biomes:

| Region | Proposed regional type pair |
| --- | --- |
| Bramblefen Basin | Meadow + Tide |
| Cindergear Expanse | Gear + Stone |
| Tempest Crown | Storm + Ember |
| Starfall Gloam | Cosmic + Shade |
| Verdant Crown | Meadow + Shade |
| Frostglass Reach | Tide + Stone |
| Emberfall Caldera | Ember + Stone |
| Saltwind Coast | Tide + Storm |
| Glassdune Wastes | Gear + Ember |
| Hollowdeep | Gear + Cosmic |
| Sungrass Steppe | Meadow + Storm |
| Whisperwood | Cosmic + Shade |

Biome pairs are **habitat specializations**, not limitations on where a species may appear, nor guarantees that only those two types ever spawn. A visitor can encounter appropriate travelers and seasonal migrants elsewhere if the approved distribution allows it.

## The evolution/art budget is larger than the number 300

- 100 two-stage lines × 3 forms each = **300** forms.
- 100 care-morph lines × (base + 3 care-conditioned outcomes) = **400** forms **if** all three proposed outcomes are distinct playable forms, as in locked Wave One.
- 100 non-evolver lines × 1 form = **100** forms.
- Total is **up to 800 forms** before merge rares, not 300 and not automatically the earlier approximate 600-form target. The actual approved count must be reconciled with the Design Bible before production budgeting.
- With a minimum of front, back and two idle frames per form, this is up to **3,200 artwork poses/frames**, before overlays and animation. Condition overlays must reuse common art where possible. A line is not shipped without its required assets; re-coloring does not count as a new species line.

## Content schema proposed for an approved line

```yaml
id: to_be_assigned_after_review
planning_slot: CK013
display_name: approved_original_name
home_biome: bramblefen
habitats: [tall_grass, reed_edge]
type: meadow
evolution_category: two_stage  # or care_morph, non_evolver
visual_silhouette: single_distinctive_readable_shape
personality: one_line_species_voice
favorite_routine: something_observable
care_reaction: meaningful_stat_or_behavior_feedback
favorite_food: food_catalog_reference
role_intent: vanguard # non-mechanical design label
capture: { earliest_wave: 2, encounter_zone: region_zone_id, method: wild }
evolution: { rules_ref: named_validated_content_entry }
battle: { stats_ref: named_validated_content_entry, moves_ref: named_validated_content_entry }
field_guide: authored_unique_lore
art: { front: approved_asset, back: approved_asset, idle_a: approved_asset, idle_b: approved_asset }
review: { design: pending, safety: pending, art: pending, balance: pending, browser: pending }
```

The actual schema should be finalized with the running engine's content contracts; this example does not authorize adding new server fields yet.

## Combat design boundaries

Preserve the currently deployed engine, which has **eight types**, four moves per battle partner, type multipliers of **1.30 strong** and **0.75 weak**, a **30-second** PvP turn timer, and capped battle XP. Never change these constants to make a roster spreadsheet look balanced. The existing first four founders have the following level-one values and must remain unchanged without a separate tested balance proposal:

| Founder | HP | Power | Stamina | Speed |
| --- | ---: | ---: | ---: | ---: |
| Mochi | 50 | 8 | 9 | 6 |
| Bolt | 52 | 8 | 10 | 7 |
| Zee | 48 | 8 | 9 | 8 |
| Ember | 46 | 8 | 8 | 9 |

**Role tags** are descriptive targets for different tradeoffs, not species-specific passive powers: vanguard (balanced), bruiser (short-burst damage), skirmisher (speed), warder (defense), attrition (longer fights), disruptor (timing and stamina pressure), sustain (recovery), and artillery (costly signature move). Each role needs at least one exploitable weakness. Reuse permitted move and content mechanics; any new effect verb needs independent engine/design approval. Do not introduce the unapproved abilities/natures/held items features excluded by the Bible.

### Proposed statistical guardrails — screening only, not automatic truth

For a *new, unapproved* level-one species, begin exploratory stat tuning near **HP 40–58, Power 7–10, Stamina 8–11, Speed 4–11**. These are **proposed design ranges, not current engine limits**. A rough pre-simulation budget can flag aggressive all-around designs:

`screening_score = (HP - 50)/4 + 2*(Power - 8) + 1.5*(Stamina - 9) + (Speed - 8)`

A value far outside approximately **-3 to +3** triggers manual review, **not** automatic rejection; the formula is unvalidated and cannot capture move effects, matchups, tempo or true effectiveness. Use the battle engine's own damage/stamina/turn logic for final outcomes. Species level curves should remain compatible with existing `content/growth.json` and the 1–50 level system. Evolutions should transform role expression, not generate an uncontrolled stat escalation.

### Test matrix for every release wave

1. **Content integrity:** unique internal identifiers; legal eight types; no dangling move/food/form/art/encounter references; no unapproved species behavior or out-of-scope mechanics; canonical names and stable art hashes.
2. **Type and level coverage:** simulate legal same-level matchups at representative levels **1, 10, 15, 20, 30, 50** against the current roster; include at least neutral, strong and weak type situations. Verify both trainer seats, multiple deterministic seeds and legal move choices; do not let an AI pick an illegal move.
3. **Strategy diversity:** compare human-plausible policies (aggressive, patient, defensive, stamina-conscious), not one naive random strategy. Detect infinite guarding/recovery loops, guaranteed first-turn knockouts, unbounded shields, exhaustion traps or stall to the engine's **40-turn** limit.
4. **Care-state parity:** compare healthy, overfed, underfed, exhausted, sick and neglected-but-recovering states. Do not remove meaningful care penalties or make neglected creatures intrinsically better, and keep ordinary battle KOs nonfatal.
5. **Fairness review:** flag sustained broad equal-level win rates outside a provisional **40–60%** *pooled-neutral* band for inspection; do not treat this as a universal hard pass/fail because type disadvantages and sample confidence matter. Test win-rate uncertainty, both sides and population mix. Look for counterplay against each signature strategy.
6. **Acquisition and catchability:** match rarity to habitat opportunity and meaningful effort, not raw battle dominance. Preserve safe access to starter-growth encounters. Ensure catch and egg probabilities are reproducible with seeds and are not exploitable through rapid reloads or overlapping connections.
7. **Classroom progression:** check-in remains the reliable main XP source; battle farming caps stay in force; both nurturing and battling remain attractive. Test 3–5 minute visits and newly joining students against high-level veterans.
8. **Physical verification:** before shipping a wave, test real browser movement, encounters, battle animation, care display, saves and reconnects on actual school Chromebooks.

Start with tens of seeds per matchup to detect obvious defects, then use larger replicated samples for flagged cases. A full 300 × 300 matchup space can be millions of battle simulations across levels and health states; run staged CI matrices rather than demanding all combinations on every edit. Archive the engine revision, seed list, opponent selection, policy, win/loss/draw and fight length so every surprising result can be replayed.

## Biome-specific gameplay without artificial power creep

Biomes should modify which creatures appear, their routine/ecological stories, catch opportunities and environmental navigation. Do **not** automatically raise base stats because a species is found in a faraway biome. Use access constraints, encounter difficulty and quest complexity separately. New species must add distinct choices, not simply outclass older species. Care-conditioned morph outcomes should each have viable competitive tradeoffs and compelling identities; a "neglected" form must never be advertised as optimal care.

## Review and production sequence

- **Gate A — concepts:** Claude and Grant select the motif, silhouette, personality, ecological niche and gameplay role for each seed.
- **Gate B — content:** approve name, original art brief, food/health hooks, evolution form names, habitats and Field Guide entry.
- **Gate C — battle:** tune stats, moves and accessible counters in isolated deterministic simulation against released content; check for exploits and condition synergies.
- **Gate D — art:** confirm style, frames, transparency, contrast, provenance and fallback; no new species launch on placeholder/rejected art.
- **Gate E — release:** publish only the approved 12-line wave after school-device verification and real-world save/rollback checks.

**Important:** The CSV is a **working planning register**. It deliberately does not claim all 288 new species designs are complete. Never automatically import its provisional concept labels into the live battle/species catalog.
