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
