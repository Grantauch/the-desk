# First 12 species: implementation plan

The 12 entries in `apps/checklings-foundation/species-plan.json` are design candidates. They are not 12 implemented species. The four founders have existing idle/still art; all battle poses and new-species art remain production work. New names/designs also require an originality review before acceptance.

Each candidate has a distinct body, personality, battle hook, nurturing/discovery hook and care preference. The 12 cover the 12 eventual ecosystems as starter representatives. Full ecosystem maps and 25 species per ecosystem arrive only after this slice works.

| Species | Ecosystem | Tactical role | Nurturing / discovery role |
|---|---|---|---|
| Mochi | Meadows | Guard-earned ally shield | Unusual garden plants |
| Bolt | Mechanical frontier | Block-and-counter charge | Gadget repair and crafting patterns |
| Zee | Cosmic expanse | Alternating support/attack | Star mapping and night discoveries |
| Ember | Volcanic wastes | Stored-heat burst | Incubation warmth and fired-clay decor |
| Mosswisp | Ancient forest | Linked healing marks | Forest restoration and plant identification |
| Brinebell | Oceans | Initiative manipulation | Tide songs and shell mosaics |
| Craggle | Mountains | Slow braced defender | Safe cave paths and carving stone |
| Kitefin | Stormlands | Ally turn-order support | Weather charts and canopy seeds |
| Rimehorn | Frozen wilderness | Protection/healing reserve | Seed preservation and snow shelters |
| Siltstilts | Marshes | Poison filtering | Wetland restoration and nursery discoveries |
| Duneglass | Desert | Telegraphed energy redirect | Light puzzles, fossils and glass recipes |
| Vesperveil | Haunted ruins | Pattern-punishing feint | Ruin research and relic displays |

## Delivery slices and gates

Each slice uses its own feature branch and small release. Complete the implementation, tests and review before any production gate. The existing four remain usable until a verified pilot cutover.

| Slice | Concrete deliverable | Required acceptance evidence |
|---|---|---|
| 02A: durable service | Separate synthetic/staging game service, SQL schema, migrations, command receipts, event ledger, minimal health endpoint | Real database rollback/crash/duplicate-command tests; 35 concurrent synthetic writers; backup restore; no classroom credentials in game service |
| 02B: identity bridge | Verified school PIN launch and scoped game session; teacher flags default off | Wrong-member/class/tenant/replay/CSRF tests; top-level Chrome launch; expiry, deactivation and shared-device revocation; all Hall Pass regressions |
| 03: safe pilot import | Versioned per-membership fence and shadow import, original pet display on two devices | Every founder/name/earned home matches private source; counts reconcile; no duplicates, no classroom writes; failed import leaves source usable |
| 04: home and care | First four founders with saved home, vitals, illness, exhaustion, happiness, cleanliness, friendship and development; weather and personal reactions | Actual student UI save/reload; recoverable neglect and care tradeoffs; free rescue; no farming; no offline death; accessibility and outage isolation |
| 05: discovery and collection | Eight additional complete species, encounters, capture, Encyclopedia, one explorable route plus habitat scenes | Server encounter/capture rolls; exactly-once ownership; all 12 have distinct assets/behavior; noncombat discovery access and meaningful habitat rewards |
| 06: tactical PvE | 1v1 turn-based fights with three-creature team selection and sequential switching; terrain, statuses, stamina, species signatures and injuries | Server move legality/ownership/RNG; matchup and strategy tests; resume/disconnect; no dead-seat stalls or duplicate settlement; actual UI battles |
| 07: consequences and memorials | Warned active neglect, optional lethal PvE, rescue/retreat, permanent death, Memorial Grove | Full warning → intervention and warning → deliberate final risk → death paths; durable memorial/ancestry; no offline/PvP death; bug-repair audit |
| 08: classroom multiplayer | Teacher-enabled nonlethal class duels plus a small cooperative encounter | Two independently authenticated synthetic accounts play on different devices; class scoping, turn legality, reconnect and teacher pause; no simulated partner advertised as a student |
| 09: lineage and parity | Limited nesting/hatching, inherited traits, mutations, ancestry; care/discovery exhibition and decor progression | Real server parent/child records, cooldown and no-cycle tests; dead ancestors preserved; no mutation counted as new species; both playstyles complete a substantial progression goal |
| 10: 12-species classroom pilot | Complete slice through student UI and teacher controls | Actual school Chromebook acceptance, all 12 species playable, stable pilot, verified exact game/site/Apps Script releases; no expansion until passed |

This first slice intentionally touches each core system at small scale. A single working breeding rule, co-op encounter or weather pattern demonstrates the plumbing; it does not complete the full promised system. Larger ecosystems, deeper breeding, tournaments, team formats and the full 300-species collection still require later work.

## Rules to lock before combat implementation

- All 12 affinities and an explicit versioned effectiveness table. Use bounded multipliers such as 0.75/1/1.25 as a simulation starting point; no assumed genre chart. Cap combined effects and make the table visible to players.
- Initial stat budget and move costs per role; four equipped moves, one signature mechanic, visible counterplay and a useful defend/recover option per species. No rarity-based automatic advantage. Defaults are design candidates until simulation and playtesting.
- Separate battle HP/stamina, persistent illness/injuries and long-term care. A normal knockout is not a death. Low energy warns and restricts dangerous activities; it never locks a student out of rest/treatment.
- Each species needs a working care preference, discovery action, battle identity and meaningful personal-development choice. Shared animation rigs and moves are allowed; recolors and identical tactical behavior do not satisfy species identity.
- Account-level Encyclopedia, legacy homes and achievements survive individual death. The individual stays deceased and is recorded in Memorial Grove. Unknown legacy birth/ancestry facts remain unknown.

## Tests that prove the slice works

1. **Returning owner:** migrated founder, exact name, earned sky home and official best-streak keepsakes on two devices. Older tabs cannot overwrite the imported individual. The next student's screen is blank of prior identity.
2. **Keeper route:** a player earns a comparable habitat upgrade, species discovery, exhibition achievement and personal-development milestone through care, observation, crafting and decoration without winning a battle. Each activity commits persistent state. Decorations cannot be merely a currency sink for battle winnings.
3. **Battler route:** a player succeeds through a deliberate counter-team and resource choices; a losing strategy can recover through training and care. Record a tactical choice per species that materially changes an outcome.
4. **Fair stakes:** serious active neglect can lead to death after warnings and affordable intervention. Closing the Chromebook, missing a week, a school closure, expired auth or a service outage does not consume the rescue window. Repeated reconnects neither duplicate decay nor erase an already recorded warning.
5. **Dangerous adventure:** labeled risk, bound consent, retreat opportunity, server result, injury or permanent death, exactly one memorial and surviving ancestry links. Ordinary PvP cannot use this path.
6. **Real class interaction:** two verified independent accounts cooperate or duel across devices, with server-authoritative shared state, teacher restrictions and no cross-class access.
7. **Economy/crash recovery:** duplicate requests, simultaneous captures, battle settlement after timeout and repeated import cannot mint an extra creature/item/reward or resurrect a dead one. Test against the actual database, including lost responses after commit.
8. **School reality:** 35 synthetic concurrent accounts plus separate actual Chromebook checks. Record model/browser and network, command/save timing, keyboard-only play, reduced motion, reading clarity and the teacher's pause/recovery flow. These observations must be labeled separately from local automated results.

Keeper/Battler parity needs evidence from equal-duration play sessions and player feedback. Compare access to creatures, habitat upgrades, meaningful achievements and time to a satisfying goal. Identical XP numbers alone do not prove equal depth or enjoyment. Students choose their playstyle freely; it is not assigned by gender.

## Artwork acceptance per species

Original silhouette and ecological brief → concept review → approved portrait and idle → attack/defend/hurt/knockout states → habitat scale/readability → reduced-motion stills → optimized sprite atlas → in-game acceptance. Provide image dimensions, asset hashes, alt text and rights/originality notes in the content manifest. Lazy-load battle and habitat assets; do not send 300 portraits to a Chromebook at startup.

## Expansion gate

After the complete 12 pass, expand to 50, 100, 150 and 300 distinct base species in reviewed content batches. Version 1.0 remains blocked until all 300, all 12 ecosystems, the complete promised systems and school-device stability are verified in gameplay. Do not rename this 12-species slice to 1.0.
