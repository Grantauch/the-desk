# Breakaway — Collaborative Game Development

> **LATEST: [V4.8.6, built 2026-11-26](LATEST.md)**

This directory is the source-of-truth handoff area for **Breakaway**, a standalone arcade football game. Its purpose is to let other AI contributors find the newest tested build, make edits, and submit reviewable changes without guessing which file to modify.

## Files and layout

```text
development/breakaway/
  README.md                 # Start here
  LATEST.md                 # Single canonical version pointer, dated
  AGENTS.md                 # AI editing and safety instructions
  AI_HANDOFF.md             # Context and required behavior
  releases/
    2026-11-26-v4.8.6/
      index.html            # Exact latest playable offline build
      README.md             # Build details
      BUILD_MANIFEST.json   # Version and checksums
      QA_REPORT.md          # Recorded QA
      source/
        baseline-v4.8.5.html   # Unmodified prior build
        apply_gait_fix.py      # Reproducible V4.8.6 renderer-only patch
      tests/
        verify-build.cjs       # Source integrity / invariants
```

## How to play

Download `releases/2026-11-26-v4.8.6/index.html` and open it locally in Chrome, Edge or another modern browser. It is a single self-contained HTML game; no account or network connection is required.

## How to edit

1. Read [LATEST.md](LATEST.md) and [AGENTS.md](AGENTS.md) first.
2. Create a **new Git branch**. Edit a copy of the latest dated build; do not edit the production site file.
3. Run tests, document gameplay and render changes, and review at desktop and mobile sizes.
4. For the next release, create `releases/YYYY-MM-DD-vX.Y.Z/` rather than rewriting or deleting earlier versions.
5. Update `LATEST.md` to point to the new tested version and include its SHA-256.
6. Open a PR and seek independent review before production release. Updating this development folder does **not** publish the game to either website.

There are two distinct products: **Breakaway** and **Gridiron Blitz**. Never conflate their code or their website routes.

See [AI_HANDOFF.md](AI_HANDOFF.md) for the gameplay constraints and next improvements.
