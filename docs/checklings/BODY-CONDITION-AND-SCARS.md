# Later development: body condition and battle scars

Accepted requirements from Grant, October 23, 2026. **Scheduled for later implementation**, after the relevant core care/combat systems exist. These additions do not delay the current database and authentication work. No body simulation, combat modifier or scar renderer is implemented by this document.

## Placement in the roadmap

| Work | Prerequisites | Scheduled point |
|---|---|---|
| Intake, body condition and exercise | Persistent care, species needs, safe time accrual, food/activity commands | After slice 04 core care; before the combat balance/content freeze |
| Movement and battle modifiers | Condition model plus server combat rules | With slice 06 tactical PvE integration |
| Localized wounds and healing history | Server-resolved hit regions, persistent injuries and treatment | During slice 06 combat/injury implementation |
| Visible lasting scars | Stable species artwork, animation anchors, wounds and healing | After core injury settlement; before accepting final species art |
| Long-term complications | Warned prolonged condition, treatment and rescue rules | After the condition/recovery loop; integrate with slice 07 consequence testing |

The first 12-species pilot can establish these systems at small scale when their prerequisites are ready. Do not represent a chart, body-shape preview or static scar overlay as completed gameplay. The full accepted requirements remain part of the finished game even if a feature is deferred beyond an initial technical pilot.

## Feeding changes the individual

Separate immediate hunger/satiety, long-term energy balance, body reserves, muscle/fitness, exhaustion and underlying health. A full stomach is not the same as a healthy body condition. Repeated overfeeding and underfeeding should gradually change the Checkling's own silhouette and movement, with clear cause-and-effect feedback. Species have different healthy builds and needs; use species-relative condition rather than one universal body shape or human weight target. Growth/evolution and inherited build must not be mistaken for feeding effects.

Both underweight and overweight conditions reduce movement speed. Both alter damage dealt and damage taken in battle. Exact numbers and interactions are to be balanced later, not hardcoded now. Distinguish movement/turn speed, physical output, elemental/special attacks, defense and stamina so extra body mass is not an automatic universal damage bonus. Avoid a dominant strategy based on deliberately starving or repeatedly overfeeding a creature.

Prolonged unhealthy condition can accumulate a server-recorded risk of lasting health complications. Track exposure and recovery over meaningful active-care periods. One snack or one missed visit cannot instantly create a chronic condition. Names and rules describe fictional species physiology; do not present this as a medical model for people.

Warnings explain the creature's actual trend and likely consequence before a major complication. Missing school, losing internet or an outage must not silently advance an irreversible health/death timer. Persist a bounded offline-care calculation and pause serious-risk accrual while access is unavailable, consistently with the charter.

## A useful recovery loop

Give the keeper practical choices: appropriate portions and food types, species-appropriate exercise/play, training intensity, rest and treatment. Recovery takes sustained care. Exercise can improve fitness and help manage excess reserves; underfed creatures need enough food and recovery instead of extra exertion. Overexercise creates fatigue/injury risk and cannot serve as an instant weight-reset button. Injury can temporarily limit exercise, so adapted activities and treatment remain available.

Food, rest and necessary rescue treatment cannot be locked behind wins, currency poverty or a daily XP cap. Nurturing players receive meaningful progress for sustained rehabilitation and fitness work. Keep body-condition messaging factual and specific to the creature, without appearance-based insults or public weight rankings.

## Wounds belong where the hit landed

The server records the resolved region, not a client-claimed scar location: body, head, limb, wing, tail or the species' actual anatomy. A wound needs a battle/turn/event ID, damage type, severity, region, treatment and healing history. Species without a tail cannot receive a tail injury. Determine hits from validated moves and combat rules; arbitrary client coordinates cannot create wounds or modify defense.

Qualifying damage can leave scars once the wound heals. Not every small hit creates a permanent mark. Cuts, burns, damaged plating or analogous species-specific injuries need different visual treatments. Bolt may retain a dent or repaired seam; Ember may show a healed mark in its scales. Preserve each founder's identity.

Scars stay anchored to the affected surface through idle, movement, attack, hurt, growth and changes in body condition. Use body-region anchors/masks and species-authored art variants, not a line painted over the entire sprite. Mirroring must preserve the anatomical side. Views must not display a far-side scar through the body. This requires species-specific asset work and visual QA.

Separate a healed cosmetic scar from continuing functional damage. The visible mark records history; persistent pain/weakness or limited movement comes from an explicitly recorded unresolved injury/complication. Treatment and rehabilitation can restore function while a mark remains. Preserve severe injury, major battle and rehabilitation milestones in the individual's life history and Memorial Grove snapshot.

## Persistence work to allow now

Keep versioned creature state and an append-only consequential-event ledger. Later schema migrations can add body condition, exposure history, fitness, anatomy-specific wounds and scars without resetting founder identity, names, earned habitats, lineage or prior events. Unknown preexisting feeding/wound history stays unknown. Do not infer an old injury or weight problem from a student's attendance streak.

Future battle settlement must atomically commit damage, wound events, any injury/condition changes and the saved result. Retried commands cannot apply a second wound, duplicate scars, reroll a complication or reset a recovery timeline. Freeze each battle's rule version and relevant starting condition so replays can explain its modifiers.

## Acceptance tests for the future feature

- Sustained over/underfeeding produces gradual saved body changes, slower movement and documented changes to both dealt/taken battle damage. Appropriate care returns the creature toward its own healthy range.
- Nutrition, exercise, rest, growth and an injury restricting exercise interact sensibly. No infinite exercise or feed/fast cycling exploit gives free combat strength.
- Long-term complications need sufficiently prolonged recorded condition and warnings. Recovery remains usable; absence/disconnect/outage does not create an unavoidable loss.
- A specific qualifying wound heals into a scar in the same anatomical location. It stays correctly positioned across body states, poses, mirroring and reloads. Invalid regions and forged coordinates are rejected.
- Duplicate settlement and lost responses create exactly one injury/scar/complication result; old pets migrate without invented history.
- Every first-12 species has a reviewed anatomy/body-variation plan. Chromebook performance, reduced motion and mature non-graphic artwork pass actual UI testing.
