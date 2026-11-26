# Breakaway — collaborative AI development source

> **LATEST: [V4.8.7 — November 26, 2026](LATEST.md)**

The canonical standalone, playable game is [releases/2026-11-26-v4.8.7/index.html](releases/2026-11-26-v4.8.7/index.html). Download it and open locally. There are no required accounts, external scripts, or online services.

## Directory organization

```text
development/breakaway/
  LATEST.md                     # one authoritative pointer
  AGENTS.md                     # rules for collaborators
  AI_HANDOFF.md                 # history and protected gameplay
  releases/
    2026-11-26-v4.8.6/          # frozen rollback, weighted footfalls
    2026-11-26-v4.8.7/          # LATEST: smooth limb/action transitions
      index.html                # exact single-file playable source
      BUILD_MANIFEST.json       # build date/checksum
      QA_REPORT.md              # measured QA
      source/
        baseline-v4.8.6.html   # frozen prior version
        renderer.patch         # readable V4.8.6→V4.8.7 source diff
        apply_motion_blends.py # patch-based regeneration
      tests/
        verify-build.cjs       # source, syntax, physics invariance
```

For edits, branch from the latest dated source, keep a reproducible patch or modular source, run tests on four screen sizes plus touch/controller, preserve the previous version and update `LATEST.md` only after QA.

GitHub source publication is **not** the public website deployment. Breakaway is separate from Gridiron Blitz. No student data, PINs or external school services belong here.
