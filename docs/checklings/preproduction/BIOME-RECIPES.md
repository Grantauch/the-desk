# Twelve biome worldbuilding recipes (regional map identity)

**Status:** world-design working brief for Claude and Grant, **not generated production maps**. Follows the approved twelve-region section of `docs/checklings/DESIGN.md` and the technical boundaries in `WORLD-ARCHITECTURE.md`.

The procedural generator should not merely swap grass colors. Each biome needs a unique **macro layout grammar**, several recognizable authored landmarks, distinct material/vegetation patterns, ecological pockets for species and safe re-entry. The 256×256 proof tests the grammar; the 512×512 aspiration is only enabled after classroom performance and exploration-density tests.

| Biome | Procedural macro grammar | Fixed landmark anchors (candidates) | Traversal identity | Wildlife/ecological niches |
| --- | --- | --- | --- | --- |
| **Bramblefen Basin** | Branching slow rivers with raised peat islands; willow roots cross channels | Crooked Footbridge, Sleeping Willow, Drowned Steps, Glasswater Pool | Footbridges, reeds and looping high-bank trails; never rely on a single floodable path | Peat tunnels, drifting reeds, pollen banks, still water; Meadow/Tide |
| **Cindergear Expanse** | Concentric quarry terraces cut by abandoned rail lines and slag hills | Silent Foundry, Bell Tower, Great Lift, Quarry Heart | Switchbacks, rails as landmarks, gantries and passages | Warm machinery, cold scrap, mineral ledges; Gear/Stone |
| **Tempest Crown** | Tall linked ridges, switchback paths, stone saddles and sheltered valleys | Thunder Arch, Wind Observatory, Shepherd's Hearth, Broken Spire | Fast scenic ridges versus longer sheltered routes; no sudden unavoidable death | Exposed ledges, warm rock cracks, cloud shadows; Storm/Ember |
| **Starfall Gloam** | Fragmented luminous terraces and dark groves converging on a crater | Fallen Lens, Observatory Steps, Quiet Crater, Mirror Grove | Strange but clearly readable branching paths, reflections and light markers | Celestial stone, soft grotto moss, twilight groves; Cosmic/Shade |
| **Verdant Crown** | Interlocking canopy ridges above meandering jungle waterways and root valleys | Crownfall Waterfall, Vine Court, Old Canopy Bridge, Temple Root | Dry lower routes and authored elevated walkways; visibility and sound cues | Fern shade, sunlit canopy, root burrows, humid pools; Meadow/Shade |
| **Frostglass Reach** | Connected glacial valleys, frozen basins and sheltered stone highlands | Blueglass Lake, North Cairn, Rime Shelter, Wind-Carved Arch | Ice surface versus secure gravel ridge; marked return routes always stay open | Slush edge, ice caverns, rock fields, meltwater channels; Tide/Stone |
| **Emberfall Caldera** | Nested crater rims with branching ash channels and protected vent valleys | Cinder Bell, Red Basin, Old Ash Road, Hearth Vent | Ring trail and safe bridges across striking lava visuals; explicit intentional risks only | Ash pockets, thermal cracks, basalt fields; Ember/Stone |
| **Saltwind Coast** | Curved bays, connected islands, spit beaches and eroded headlands | Singing Lighthouse, Three Shells, Saltwind Causeway, Reef Steps | Broad beaches and stable coastal causeways; optional inlet loops | Tide pools, kelp shallows, cliff nests, spray meadows; Tide/Storm |
| **Glassdune Wastes** | Large dune fields arranged around hard-rock mesas, oases and buried routes | Sunken Clock, Glass Arch, Dustwell, Sand Observatory | Landmark-to-landmark navigation in open sand; paths do not vanish behind daily rerolls | Burrow dunes, hot stone, oasis shade, abandoned brass; Gear/Ember |
| **Hollowdeep** | Network of large caverns, mineral veins, safe shafts and circular side chambers | Resonance Hall, Starwell Chamber, Deep Foundry, Echo Gate | Constrained network through memorable chambers; mandatory exit route marked | Crystal pools, dark ore seams, mechanical relics; Gear/Cosmic |
| **Sungrass Steppe** | Broad sightline plains and gentle rolling ridges cut by gulches | Windmill Ridge, Tall Bell, Stone Circle, Bloom Plain | Long horizon navigation; hidden ravines but no featureless 500-tile stretches | Open grass, burrow fields, rain pools, rocky perches; Meadow/Storm |
| **Whisperwood** | Interlocking old-growth rings with giant trunks, root walks and secluded groves | Listening Tree, Candle Stairs, Moon Hollow, Four Echoes | Deliberately confusing *branches*, never ambiguous safety/return path | Shadow bark, star pollen, moss hollows, quiet canopies; Cosmic/Shade |

## Non-negotiable implementation details

### Route identity comes before random decoration

1. Author the gate graph and mandatory safe corridors first. Determine how one walks from the existing Wilds into the region, how one travels between major landmarks, and how one returns.
2. Generate elevations, rivers, ridges and vegetation from globally addressed seeded noise. The route solver then connects mandatory destinations, adding bridges, stairs, passes or stable walkways as biome-specific geometry.
3. Apply landmark art/collision overlays; run **automatic reachable-path checks** with every authored solid object inserted. A map is rejected if any gateway or critical point becomes inaccessible.
4. Generate ecological pockets anchored to terrain, not arbitrary rectangular spawn tables. The encounter engine chooses only approved species with legal levels, capture odds and rewards.
5. Place minor reusable environmental details. Decorative density must not turn every chunk into heavy per-frame sprite work, and unique discoveries need durable IDs if they affect a student's progress.

### Distance, journey rhythm and classroom time

The existing smooth walking target is approximately **180 ms per tile** under ideal uninterrupted movement. Straight crossings at that pace take about **46 seconds over 256 tiles** or **92 seconds over 512 tiles**, before obstacles, conversations and battles. Those are *movement calculations*, not verified real-world trip times.

The daily check-in remains a **3–5 minute visit**. A biome must support enjoyable short excursions and saving location/progress, alongside longer voluntary exploration. Avoid requiring one full-map traversal just to reach a basic care action, rejoin classmates or get back from a school bell interruption. Rejoining at a safe world position, reliable bus access and consistent nearby landmarks matter more than giant nominal map dimensions.

### Heterogeneous encounters, not type power creep

The 24 proposed lines per biome in `300-line-concept-register.csv` include twelve each of its two dominant battle types, spread across two future waves. Regional catch tables should vary by habitat and path depth. A creature caught in a distant area isn't automatically stronger at equal level; rarity and acquisition effort do not guarantee duel wins. Every species still needs its own art, personality, care consequence, battle role and visual readability.

### Discovery-density and world-liveliness budget

Propose **8–16 handcrafted anchor destinations** per fully developed major biome, plus smaller deterministic locations and bounded active NPC/creature groups. These are **initial design budgets**, not release promises. Treat empty walks as a QA defect: playtest before deciding if a region's 512² scale is actually warranted. Procedurally generated vegetation may be cheap to produce, but unique dialogue, art assets, encounter balance and rewards remain expensive to author.

Weather and environmental variation can enrich scenery but must not contradict the Design Bible's existing phase/scope boundaries or turn missed attendance, a disabled PC or an ordinary unexpected movement into irreversible pet loss. The rare fatal choices already permitted by the Bible remain explicit and player-chosen.

## First prototype recommendation

Start with **Verdant Crown** (jungle) or **Bramblefen Basin** (wetland): both demonstrate tricky river/vegetation seam handling, recognizable handcrafted landmarks, safe route construction and a mix of habitats. Use **256×256 with 32×32 generated chunks**; load the center and adjoining chunks, observe two remote clients, then test real Chromebook scrolling. Only scale once measured rather than claiming the current cross-road-only experiment proves a full biome.

All twelve regions need a region-specific map brief, approved anchors and a content budget before production map creation. This recipe document is not a substitute for authored tile art or signed school playtests.
