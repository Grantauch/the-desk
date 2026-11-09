# Candidate art: technical admission v1

Task `CK-ARTGATE-20261029-001` corrects the five reproduced failures in the [independent review](reviews/2026-10-29-art-contract.md). The previous author's package and proposals remain intact. This separate tool is development-only. It never writes images, imports a species into the game, changes a student save or contacts the school service.

Run from the repository with its existing development dependencies and Chromium installed:

```sh
npm run checkling:art -- inventory public/hubs/checkling/camp/assets
npm run checkling:art -- admit path/to/staged/species path/to/manifest.json
node scripts/test-art-admission.mjs
```

Inventory is bounded to 64 immediate PNG, WebP or GIF files. It reports file hashes, sizes, structural checks, actual browser decoding and first-frame pixel transparency. Exit 0 means inventory completed; `technicalPass` is always null. An unreadable/malformed file remains an explicit failed file fact. Inventory is never an admission result.

Admission requires this versioned manifest; fill every hash from the exact candidate bytes:

```json
{
  "version": 1,
  "policy": "pilot-still-v1",
  "speciesId": "synthetic-example",
  "reducedMotionPose": "idle",
  "poses": {
    "idle": { "path": "idle.png", "sha256": "64-lowercase-hex-characters" },
    "attack": { "path": "attack.png", "sha256": "64-lowercase-hex-characters" },
    "defend": { "path": "defend.png", "sha256": "64-lowercase-hex-characters" },
    "hurt": { "path": "hurt.png", "sha256": "64-lowercase-hex-characters" },
    "knockout": { "path": "knockout.png", "sha256": "64-lowercase-hex-characters" }
  }
}
```

The accepted isolated staging policy is `pilot-still-v1`: five distinct 256×256 PNG/WebP still files, at most **45,056 bytes each and 184,320 bytes together**, actual visible pixels, and zero alpha at all four corners. All files need some transparency and must match the manifest hashes. Reusing a path or identical bytes for different poses fails. Animation cannot substitute for reduced-motion stills. This policy explicitly binds the tighter proposal targets; callers cannot relax them with manifest budgets. A later policy requires a separate accepted interface change.

The decoder uses the repository's existing Playwright Chromium in an isolated offline context. PNG chunk bounds/CRCs/IDAT/IEND and animation markers, WebP RIFF/chunk boundaries/animation, and GIF blocks/trailer are checked before decoding. Header-valid but undecodable image data fails. GIF transparency is measured from the first decoded frame, never inferred merely from GIF format. Inventory makes no all-frame transparency or animation-quality claim. Inputs are capped at 1 MiB and 1,048,576 decoded pixels. Paths must stay within the chosen root; remote URLs, traversal, absolute paths and redirected symlink paths fail. The manifest is capped at 64 KiB. Output uses relative image paths and contains no machine path or credentials.

Admission exit **0** means `TECHNICAL_CANDIDATE_ONLY`; exit **1** means `REJECTED`; exit **2** means invalid invocation/input or unavailable decoder. Missing Chromium is a failure, never a fallback to header-only approval. Reports do not approve a visual pose merely because its hash differs: originality, silhouette, anatomy/anchors, ecological identity, clipping, five visibly distinct poses, reduced-motion experience and physical Chromebook performance require independent evidence. Corner transparency alone does not prove a clean complete silhouette. No candidate artwork is delivered or approved by the synthetic tests.

The current founders are a protected legacy baseline. Their original eight files retain the existing [fingerprints](founder-art-baseline.json); they are measured by inventory without being forced through a new still-size rule. Admission refuses founder IDs. No file exemptions, recompression, replacement, canonical label changes or save migrations are performed. The live game remains the four original founders; the 12-species pilot and later 300-species gate remain open.

The regression suite generates complete PNG fixtures with independently calculated chunk CRCs and compressed image data, checks every truncated prefix, browser-encodes/decodes WebP, measures the independently reviewed opaque GIF87a, exercises both budget limits, actual decode failure, missing/duplicate poses, hashes, transparency/empty images, paths, limits and real CLI exit codes. It independently inventories and rehashes all eight originals before/after. It runs within `companion:browser`, after Chromium installation in protected CI, without changing the canonical verification lane or adding dependencies.
