# ICEBREAK — Batches 01–10 integration review

**Date:** November 22, 2026
**Target:** `Grantauch/the-desk` / `main` at `ca023c5336bd5236a0aff6da2313dd7abbb79e74`
**Source:** Batch 10 head `a1d0b75c3d39ffc6ee4866998df9b84abd11d5a4`, containing the prior nine stacked ICEBREAK batches
**Branch:** `integration/icebreak-10-batches-main-20261122`
**State:** Draft review candidate. No production deployment.

## Integration decisions

Current `main` already contains the public First Shift beta from PR #471. The ten-batch branch has a separate ancestry, so a direct squash merge reported three **add/add** conflicts. They were reviewed and resolved in favor of the full, regression-tested later implementation:

- `public/hubs/icebreak.html` — original beta replaced with the complete ten-batch game
- `tests/icebreak/checks.cjs` — later hit/physics regression coverage
- `tests/icebreak/fixture.cjs` — later event, AI and storage test harness

The original `main` Play-server site separation, teacher/student tools and other unrelated changes remain untouched. The Games catalog already links to `/hubs/icebreak.html` and required no duplicate card.

The resulting diff is limited to ICEBREAK runtime/tests/docs, `package.json` test commands and the CI site-check workflow. No credentials, student roster, PINs or private data were added. Existing browser-local Shift Book records retain their versioned migration behavior.

## Required checks repaired

The Batch 10 package test script omitted `tests/icebreak/balance.cjs`, which contains seven useful cases for carving, checking leverage, whiffs and recovery. All seven passed independently; this integration includes them in the required source test command.

GitHub `.github/workflows/site-check.yml` now includes a dedicated `npm run icebreak:test` after locked dependency installation and `npm run icebreak:browser` after Chromium provisioning when browser verification is selected. This makes ICEBREAK a first-class release check, rather than relying only on historical standalone tests.

## Verified in an isolated full-site Windows checkout

| Test / deliverable | Observed result |
| --- | --- |
| Locked dependency install | `npm ci --include=dev` — passed |
| ICEBREAK source checks | **95 / 95 passed**, including all seven restored balance cases |
| ICEBREAK browser scenarios | **29 / 29 passed**, seven Chromium runners, no reported page exceptions |
| Astro / TypeScript check | `npm run check` — completed successfully; existing unrelated diagnostics include warnings |
| Production site build | `npm run build` — passed, **57 generated pages** |
| Complete local link/site validation | `npm run site:validate` — passed, **199 HTML files, 6,457 local references** |
| Sealed StoryHub asset verification | **38 releases, 401 sealed files** passed in the built output |
| Hosted GitHub protected CI | Not yet verified for this integrated branch |
| Real phone / touch / Bluetooth gamepad | Not tested on physical devices |
| Two-human match and subjective gameplay evaluation | Not tested with real players |

Browser acceptance covers both WebGL and Canvas renderers on desktop 1440×900 and mobile-sized 390×844 Chromium emulation. This verifies browser operation, not a physical phone or classroom network.

## Production and release boundary

A read-only Netlify check confirmed that the current published site remains the ready `main` deployment of `ca023c5336bd5236a0aff6da2313dd7abbb79e74`. This integration has **not** merged and is **not** live. A prior Vercel status reported a build-rate limit, which is not evidence of a code failure and is separate from the Netlify production deployment.

The original ten stacked PRs remain open for historical review. Do not merge them individually while this consolidated review is in progress. Protected CI, review of the integrated candidate, physical-device testing, real two-player play sessions and a separately confirmed Netlify deploy remain explicit prerequisites before claiming classroom or commercial readiness.

**Next action:** Open a single draft PR against `main` from the integration branch, verify hosted checks, and perform human/device acceptance before any production merge.
