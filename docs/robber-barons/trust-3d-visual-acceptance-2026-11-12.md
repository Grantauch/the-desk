# Trust Formation GLB visual acceptance — November 12, 2026

This is a visual asset **review and preservation decision**, not a release authorization.

## Source

- Student page: `public/hubs/robber-barons.html`
- Asset: `public/hubs/robber-barons-vfx/trust-formation-animation-v1.glb` (~8.96 MB).
- Current fallback: `public/hubs/robber-barons-vfx/trust-formation-fast-classroom.webp` (~299 KB), plus reduced-motion poster (~16 KB).
- Original feature PR #159 and merged replacement PR #160. PR #160 explicitly disabled realtime GLB display because the ground plane made the octopus tiny.
- This isolated browser renderer: `scripts/inspect-trust-formation-3d.mjs`. CI [run 43345333455](https://github.com/Grantauch/the-desk/actions/runs/43345333455) **passed** and generated [visual comparison screenshots and mesh bounds](https://github.com/Grantauch/the-desk/actions/runs/43345333455/artifacts/14001097714).

## Measured and visually inspected

The GLB loads with the bundled Three.js/GLTFLoader. The scene contains **105 meshes** and a **4-second** main body animation (plus many auxiliary tracks).

- Full model bounds span ~**30 world units**, because of a broad brown ground plane.
- Relevant medallion/subject bounds span ~**8.7 units** horizontally and ~**1.91 units** vertically.
- The original full-world camera renders the octopus as a tiny object in a largely empty plane.
- A narrower subject-bounds camera markedly increases its size, but the rendered version remains a simple dark shape on a flat brown field compared with the higher-contrast, compositionally superior animated WebP. It is **not yet an upgrade worth replacing the current effect**.

## Release decision

**Keep `TRUST_VFX_PREMIUM=false`.** Do not make students download a 9 MB asset merely to substitute a visually inferior effect for the ~299 KB animation.

Future 3D optional-mode acceptance should require a proper authored background/stage rather than exposing the brown floor, visual hierarchy and lighting improvements, mobile performance and data-saver acceptance, and independent side-by-side comparison against the existing animated fallback. Avoid implicit premium activation even on fast desktop GPUs until those criteria pass.

The Blender source/model is preserved for later authoring. No source art has been deleted, and no student page or gameplay settings are changed by this PR.
