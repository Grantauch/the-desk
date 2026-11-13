# Resident lives

Owner: Codex. User-authorized expansion of core loop step 4 in the existing Checkaverse. Reuses the cottage, stump and creek house art and the existing interior, with no new species, currency, pet-care rule or school service. The design bible remains owned by Grant/Claude.

Residents have homes, travel, work, breaks and visits. Their actions update resident state, leave visible work results and inform their conversations. A server clock synchronizes the shared town and wilds. Each saved trainer's Kettle Creek has separate resident state, resumed on return. The map keeps its daylight; activity cycles do not add a day/night system.

| Resident | Home | Work and actual state change | Break / social connection | Visible proof |
| --- | --- | --- | --- | --- |
| Rowan | Kettle south lane | Clear the Route 1 verge; count cleared sections | Visit Mara, then write trail notes at home | Rake, clearing marks, trail log |
| Nell | Kettle south lane | Water clinic beds; moisture rises then decays | Receive Pax's parcels; read at home | Watering can, damp beds, sprouts |
| Ivo | Kettle south lane | Observe creek fish; record sightings | Visit Nell's garden, then rest at home | Notebook, water rings, field notes |
| Pax | Kettle south lane | Collect a parcel at the store; carry it to the clinic; leave a delivered parcel | Visit Nell; sort labels at home | Carried parcel, delivery crate, delivery count |
| Mara | Kettle south lane | Tend the cemetery approach; clear leaves | Meet Rowan; press flowers at home | Broom, swept approach, visit memory |
| Orin | Town south lane | Inspect bus-stop equipment; log completed checks | Visit Tess; read at home | Clipboard, bus inspection marker |
| Tess | Town south lane | Unpack and arrange market crates; stock-display count changes | Receive Orin; tally at home | Carried crate, arranged produce boxes |
| Bram | Town south lane | Sweep and inspect the arena entrance | Meet Ada at the pond; stretch at home | Broom, swept ring, inspection count |
| Ada | Town south lane | Tend planters on the Neighborhood road | Meet Bram; rest at home | Watering can, watered planters |
| Fern | Town south lane | Walk to the wilds; collect field observations | Visit Wren; write notes at home | Notebook, marked field observation |
| Sol | Town south lane | Carry a repair bundle to the bridge and inspect it | Visit Fern; repair tools at home | Tool roll, bridge inspection marks |
| Wren | Town south lane | Observe and tend the starflower edge | Visit Fern; press flowers at home | Notebook, flower markers |

Homes have named doors and distinct interior descriptions and furnishings over the existing interior art. Residents enter and leave through their own doorway. Visitors can look and talk, with no ability to take or alter belongings. The permanent houses use added south lanes and do not consume the 24 player plots or move existing buildings, doors, forage locations or graves. Layout comes from Tiled JSON data and an idempotent importer.

The server owns activity progress, carried props, work results, completed-task counters, social memories and energy/rest. It stores only authored resident state and anonymous scope keys in a separate namespace. NPC work changes scenery, not shop inventory or player rewards. Speech is authored; no generated/free text or outside AI service is needed.

Player interactions can interrupt a resident briefly; teacher pause freezes every resident clock. Catch-up after an inactive scope is bounded and harmless. Rendering honors reduced motion without changing the shared simulation. Browser snapshots interpolate movement and draw the current carried/work prop. Resident information identifies their actual destination and gives a way to find them across maps and homes.

Acceptance: walk a full home/work/break cycle; enter a home and find its resident there; watch a parcel move from pickup through delivery; observe work changes and social memories; verify two clients agree; reconnect/restart and recover resident state; preserve private-scope isolation, pause, quests, player homes and battles; play at Chromebook and phone sizes. Local, hosted, merged, deployed and classroom evidence are separate.
