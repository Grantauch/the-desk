# World War I Museums — Editable Blender Assets

These Blender files are the editable sources for optimized browser 3D exhibits.

| Historical object | Editable Blender source | Browser assets | Draw-call meshes |
| --- | --- | --- | ---: |
| British Mark I Male tank (1916) | mark1_male_1916.blend | public/hubs/ush9-the-arsenal/models/mark1_male_1916_web.glb and public/hubs/ush9-over-the-somme/models/mark1_male_1916_web.glb | 8 |
| British SMLE Mk III rifle (1914) | smle_mkiii_rifle.blend | public/hubs/ush9-the-arsenal/models/smle_mkiii_rifle_web.glb | 7 |

## Integration

The Arsenal has an asynchronous browser GLB reader in its self-contained Three.js page. Its original procedural exhibits remain visible until the replacement succeeds and remain as fallbacks if a load fails. The reader supports these known uncompressed, no-texture exports and validates the expected number of material batches. New assets must be configured explicitly.

Over the Somme loads the tank with Three.js GLTFLoader from apps/over-the-somme/game/props.ts, cloning shared meshes for its two sites. The existing instanced procedural tank is the fallback. Run npm ci, npm run typecheck, and npm run build in apps/over-the-somme to rebuild public/hubs/ush9-over-the-somme/somme.js.

Both models were generated using Blender 5.2 and the optimized GLB exports were browser-tested in Chrome. Surface colors and geometry are historical approximations rather than engineering scans; verify fine details against museum photography before using them as historical evidence.

Preserve the source Blender files alongside optimized exports for future model revisions. Continue upgrading the remaining Arsenal objects and the Over the Top trench exhibits using this workflow.

## November 4 reconstruction batch 1

| Exhibit | Source / GLB stem | Triangles | Material batches | GLB bytes |
|---|---|---:|---:|---:|
| Vickers Mk I machine gun on tripod | vickers_mki_1914 | 3,908 | 7 | 111,012 |
| British QF 18-pounder field gun | qf18_field_gun_1914 | 4,812 | 6 | 130,308 |
| Sopwith Camel F.1 (1917) | sopwith_camel_1917 | 7,776 | 10 | 197,128 |

Rebuild these models with `python build_exhibits.py` in a Python environment
containing `bpy==5.2.3`. Individual components remain editable in each compressed
`.blend`; the GLB exports merge components by material. No textures, animation
tracks, external buffers or additional Three.js library are needed.

All are interpretive reconstructions. Hardware, paint shades, markings and internal
mechanisms are simplified, and gallery display dimensions are intentionally scaled.
The Vickers has its water jacket, receiver, spade grips, tripod, condenser hose and
canvas ammunition belt. The 18-pounder has wooden spoked wheels with steel tyres,
a single pole trail and spring housing above the barrel. The Camel has paired
cambered wings, rotary engine, twin guns, rigging, fixed wheels and British roundels;
its static propeller is intentional. Existing placards and interactive labs are preserved.

Reference records consulted for period/type and recognizable features:
- National Army Museum Vickers Mk I, 1914–1918: https://collection.nam.ac.uk/detail.php?acc=1974-07-42-1
- National Army Museum QF 18-pounder Mk I, 1906: https://collection.nam.ac.uk/detail.php?acc=1998-09-17-1
- RCAF Sopwith Camel history/specifications: https://www.canada.ca/en/air-force/services/aircraft/sopwith-camel.html
- National Museum of the USAF Camel: https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/197401/sopwith-f-1-camel/

Production route recovery: Netlify production was still serving commit 3a3d0114
because newer production builds were skipped for account credit exhaustion. The
already-built PR #305 deploy `6aea7da4775e0c260094143d` was published through
Netlify on November 3 local time, restoring both missing museums without a source
routing change. HTTP 200 was read back from both extensionless routes, both HTML
routes and both existing Arsenal GLBs. This is separate from new batch deployment.

## November 4 reconstruction batch 2

| Exhibit | Source / GLB stem | Triangles | Batches | GLB bytes |
|---|---|---:|---:|---:|
| Small-box respirator with gas cylinders | small_box_respirator_1916 | 11,008 | 8 | 233,128 |
| Screw pickets, twisted barbed wire and coil | screw_picket_wire_1916 | 23,660 | 2 | 453,296 |
| Wex M1917 flamethrower | wex_flamethrower_1917 | 3,184 | 7 | 77,556 |

Rebuild with `python build_trench_equipment.py` using the same bpy environment.
The gas scene deliberately distinguishes 1915 cylinder attacks from the improved
1916 British small-box respirator; its mask is displayed on a neutral museum bust.
The Wex has an annular fuel tank and central pressure vessel. These are external
interpretive reconstructions. Valve internals and precise military paint/markings
are omitted. Wire uses period barbs rather than modern razor tape. Existing gas
particles and flame animation are transferred from the original exhibit at load
success; the entire original remains the failure fallback.

References:
- Australian War Memorial SBR: https://www.awm.gov.au/collection/C1042620
- Canadian War Museum SBR: https://www.warmuseum.ca/firstworldwar/objects-and-photos/equipment-and-vehicles/uniforms-and-personal-gear/small-box-respirator/
- Australian War Memorial Wex discussion: https://www.awm.gov.au/wartime/102/assault-by-fire
- National Army Museum wiring party, 1917: https://collection.nam.ac.uk/detail.php?acc=2002-02-589-3
- Australian War Memorial screw picket: https://www.awm.gov.au/collection/C136923

## November 4 reconstruction batch 3

| Exhibit | Source / GLB stem | Triangles | Batches | GLB bytes |
|---|---|---:|---:|---:|
| Rigid Zeppelin airship, circa 1915 | zeppelin_1915 | 13,768 | 6 | 270,520 |
| Ocean-going German U-boat, circa 1916 | uboat_1916 | 13,688 | 7 | 441,516 |

Rebuild with `python build_airship_submarine.py`. The airship has a long fabric
envelope with frame/longitudinal seams, four tail fins, suspended gondolas and
engine cars. The U-boat has a narrow casing, modest bridge, twin periscopes, deck
gun, flooding slots, hydroplanes, rudder and twin propellers. These represent
WWI equipment families, not exact serial-numbered vessels. They omit interiors
and ship-specific refits. They must not be described as WWII Type VII equipment
or exact engineering replicas. All eight previously placeholder Arsenal exhibits
now have Blender replacement assets, alongside the previously completed rifle/tank.

References:
- National Army Museum Zeppelin gondola, 1916: https://collection.nam.ac.uk/detail.php?acc=1972-08-67-1-65
- IWM contemporary wreckage film, 1916: https://film.iwmcollections.org.uk/record/1686
- RAF Museum first Zeppelin raids: https://www.rafmuseum.org.uk/blog/the-few-and-the-first-battle-of-britain/
- U.S. Naval History and Heritage Command WWI U-boat exhibition panels: https://www.history.navy.mil/content/dam/nhhc/browse-by-topic/War%20and%20Conflict/world-war-i/panels_7-12.pdf
- Canadian War Museum WWI deck gun: https://www.warmuseum.ca/cwm/exhibitions/navy/objects_photos_search-e.aspx@section=4-D&id=6&page=0.html

## Over the Top: instanced sandbag reconstruction

`trench_sandbag_1916.blend` is an editable, rounded hessian bag with uneven fill
and a perimeter seam; `trench_sandbag_1916_web.glb` is 7,360 bytes, 252 triangles
and one material batch. Rebuild using `python build_sandbag.py`. It replaces the
geometry in the existing two instanced sandbag meshes, preserving all instance
transforms, movement, lessons, trench-parts interaction and adaptive quality. It
does not create one scene object per bag. The original box geometry stays in use
if the optional asset is unavailable or fails format/scale validation. The bag
is an interpretive environment prop, not a scan of a specific surviving artifact.

Reference context: Imperial War Museums trench construction guide:
https://www.iwm.org.uk/sites/default/files/files/2023-10/first_world_war_large_print_guide.pdf
