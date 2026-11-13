# Bramblefen Basin Wave Two: provisional attack balance review

**November 3, 2026 — design/testing evidence, not student-facing content or an approval.** A synthetic **39,168-battle** sweep evaluated 12 working wetland species against four current playable founders and one another with the actual Checkaverse battle engine. All new signatures are implemented only as a nonproduction **in-memory content proposal**. No live species, students, rewards or battle rules changed.

## Test method and limits

Inputs: `apps/checkaverse/experiments/worldgen/bramblefen-wave2.content.json` (candidate v2), current `battle.mjs` and current battle move/type/settings/species JSON. The only new data are twelve simulated species, using the exact supported attack components. At levels **10 and 30**, all **136 unordered pairs** of sixteen combatants were evaluated under **nine pressure/conserve/defend policy combinations** with **eight deterministic random seeds** mirrored across both trainer seats.

`136 pairs × 2 levels × 9 strategy pairs × 8 seeds × 2 seats = 39,168 bouts`.

This study tests **base forms only**, not final level 15/20/30 evolutions; policies are naive; it excludes human adversarial tactics, class-level capture distributions, healing items, illness combinations and Chromebook multiplayer. Do not infer real PvP win probabilities.

## Findings from first two design passes

The first draft made several high-defense/low-power signatures too weak against founders. We made the following **prototype-only** adjustments, preserving the creature's intended care and role flavor.

| Candidate | First pass vs current founders* | Second pass* | Change tested |
| --- | ---: | ---: | --- |
| Reedawn | 29.9% | 29.9% | No change |
| Cattunnel | 45.0% | 45.0% | No change |
| Skidril | 35.4% | 35.4% | No change |
| Finline | 26.0% | 65.1% | Power 7→8; shelter damage 7→10 |
| Pollisk | 16.3% | 48.3% | Power 7→8, faster, higher Power growth; 12 damage, guard ×0.75 |
| Mosswhirl | 44.7% | 44.7% | No change |
| Glasprite | 22.8% | 66.1% | Power 7→8, higher growth; damage 10, shield 11 |
| Mudhorn | 42.7% | 42.7% | No change |
| Thornlock | 27.1% | 64.8% | Power 7→8, higher growth; damage 10, shield 13 |
| Seedrift | 27.6% | 27.6% | No change |
| Rippletap | 31.2% | 31.2% | No change |
| Whisprill | **1.0%** | **59.0%** | HP 46→49, Power 7→8, higher growth; cost 4, damage 12, restore 2 |

`* Candidate win share` is averaged across all four founders, two tested levels and all tested policy pairs. This is a **screening indicator, not a targeted 50% metric**: the founders include type advantages and disadvantages, and sample policies are not equivalent to student gameplay.

### What improved, what remains broken

- **Neutral type imbalance flags:** **68 → 54** pair/level summaries with average A-side win share outside 20%–80%. These are diagnostic alerts rather than hard failures. Fifty-four remains too many to call the candidate wave balanced.
- **Long-battle flags:** **15 → 11** pair/level summaries with a 40-turn time-limit rate of 25% or greater. Shield-heavy kits still risk lengthy matches, particularly when two defensive species meet.
- **Biggest practical rescue:** Whisprill was nearly unable to beat any founder in simple policies, making its "sustain" role a trap. The second version now has a meaningful low-cost attack with stamina recovery. This **may** be too efficient in other matchups; evaluate before acceptance.
- **Likely overcorrection candidates:** Finline, Glasprite and Thornlock now achieve strong simulated outcomes against founders. Some may overperform versus other defensive species or rely on the same shield pattern, reducing role diversity.
- **Progression caution:** Level scaling matters greatly. Raising a species from Power growth 0.1 to 0.2 can increase effectiveness sharply by level 30. No final stat growth should be chosen from level 10 results alone.

## Gameplay-design issues beyond raw numbers

**One-turn shields:** Shield strength only applies when that move is selected in the engine; it is not a persistent shield. The design and art should make that clear. Teams of tankier Checklings must still have practical offense and ways to finish matches within a reasonable class session.

**"Disruptor" has no opponent-impairing move verb yet:** Mosswhirl and Rippletap currently express disruption as *their own* improved stamina timing or a telegraphed attack rhythm. They cannot reduce opposing stamina, change action order or inflict a slow without a separately reviewed engine change. Do not promise debuffs in creature descriptions.

**Art and identity overlap:** Finline/Glasprite/Thornlock all use defensive protection but require different visible body silhouettes, story voices and animation reads. Avoid designing twelve creatures that merely share the same generic attack with a different noun.

**Care consequences stay independent:** These synthetic duels use healthy statistics. Obesity, malnutrition, exhaustion, boredom, grooming and illness already influence combat. A later matrix must compare new species under **real** condition modifiers without rewarding deliberate neglect as a mandatory PvP tactic.

## Recommended third pass

1. Preserve the v2 snapshot (`BRAMBLEFEN-BALANCE-V2.json`) and re-run exact same seeds after each edit. Treat it as a reproducible regression fixture, not live-balance certification.
2. Inspect **neutral-type** pairings and both seat positions first. Separate strong/weak elemental edges before proposing fixes.
3. Expand opponent policies beyond three basic routines, including turn-aware exploitation of `phases`, counter strategies for expensive burst moves, and recovery loops.
4. Run at **levels 1, 10, 15, 20, 30, 50**, then test actual evolution forms once approved. Do not simulate unapproved evolutions by claiming the base species evolved.
5. Validate repeated defensive duels against the **40-turn cap** and actual teacher/school-session timing; flag if a safe 3–5 minute visit becomes impractical.
6. Revalidate *all 12* against first-wave nonfounders once Bramble, Reedling, Lantern, Mossbit, Spindle, Cloudlet, Flickit and Hushmoth are released and have engine-approved moves.
7. Approve names, originality, Field Guide lore, care responses and four art frames with Claude/Grant before moving any proposal into the production catalog.

**Status: substantial design progress; no balance sign-off.** The documented concept names, move specifications and derived numbers are proposals under PR #302, not changes to the student game.
