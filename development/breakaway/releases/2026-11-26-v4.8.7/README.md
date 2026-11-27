# Breakaway V4.8.7 — Motion Blends (LATEST)

**Build date:** 2026-11-26. **Status:** development, not deployed to production.

- **Playable:** [index.html](index.html) — open the file locally in a modern browser.
- **Previous version:** [source/baseline-v4.8.6.html](source/baseline-v4.8.6.html).
- **Readable patch:** [source/renderer.patch](source/renderer.patch), showing the exact renderer-only changes from V4.8.6.
- **Rebuild:** `python3 source/apply_motion_blends.py` (requires the standard `patch` executable; output must SHA-match index.html).
- **QA:** [QA_REPORT.md](QA_REPORT.md), plus `node tests/verify-build.cjs`.

The new version smooths arm extension/retraction and torso reactions while keeping the proven distance-based V4.8.6 footfall cycle unchanged. The game engine is byte-identical to V4.8.6.

**SHA-256:** `81ed2080bbe91473c8c003f4a178fa4297e8bd057fd8459a7905739cfd4571ce`.
