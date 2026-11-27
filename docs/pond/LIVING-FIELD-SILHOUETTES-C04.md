# Pond C04 — Living Field Silhouettes

Draft visual-only batch stacked on C03 #517 (then C02 #510 and C01 #508).

## What changed
- Six resident silhouette families now read distinctly at small simulation scale: swimmer, flyer, grounded walker, rooted growth, mechanical inhabitant, and floating drifter.
- Bodies use restrained naturalist pigments, asymmetrical details and movement derived from the existing age, heading and phase.
- No universal square background, neon glow, new imagery, generated art or fabricated biological portrait.
- The rendered profile comes from the original discovery facets; marks are stylized locomotion cues, not claims that an abstract recipe creates a scientifically accurate organism.

## Compatibility and scope
Only `PondEcosystem.render` changed in production source. No particle update, creature step, interaction logic, recipe, discovery ID, import/export, storage key, save version, atlas schema, or physics change. Newly drawn forms are not added to saved data. The render loop still draws at most 80 inhabitants.

## Test and release gates
- New unit regression renders all six locomotion modes with a minimal 2D canvas context and checks that rendering does not change resident snapshots.
- Run `npm --prefix apps/pond test` and `npm --prefix apps/pond run build`.
- Validate generated publication assets with `node scripts/validate-pond-build.mjs` and run the Pond browser acceptance script.
- Review screenshots at 320x568, 390x844 and desktop, including dense resident scenes; ensure no UI overlap, canvas regression or browser error.
- Preserve stacked order: C01 #508 -> C02 #510 -> C03 #517 -> C04. Retarget/rebase and verify protected full-site CI and independent review before publication.

**Status:** Source and test authored only. Build, browser screenshot QA, full-site CI, independent review, and publication are not yet verified. Do not merge independently.
