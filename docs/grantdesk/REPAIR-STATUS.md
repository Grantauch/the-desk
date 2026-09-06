# GrantDesk repair status

Updated 2026-09-06. Authority: revised launch capsule. Baseline: `4513ae7543ef42aa6c2152b34a443e5ff0e28cd7`. The [machine-readable ledger](repair-status.json) records all 73 IDs, dependencies, and current evidence.

Batch 0.5 is complete. Problems 14 and 19 are VERIFIED at implementation commit `e5297d2fe4a116ef78559faf1dfffbaade6abe57`, pushed to `main` with matching remote SHA. [GitHub Actions canonical verify passed](https://github.com/Grantauch/the-desk/actions/runs/33983159223). Problem 40 is also VERIFIED by that successful push. The nineteen previously completed items remain PUSHED pending exact Netlify deployment correlation; they have not been reopened or reimplemented. Baseline GitHub Actions passed. Live first-day and tax pages match the baseline after line-ending normalization.

PASS: 64 handoff checks; structural Hall Pass suite; 89 runtime checks; 11 tools fixtures; 46 resource/release fixtures; Astro 0 errors, 0 warnings, 8 hints; build 51 routes; 66 HTML files and 2709 local references. Final verification preserved all 172 tracked and new source/document paths byte-for-byte, including the dependency preflight. All four dependency-availability scenarios passed.

No older checkout work was recovered or merged. Former VERIFY_LOCAL entries without subsequent repair evidence remain OPEN. Preserve the Version 8 recovery branch. The foundation release did not migrate or deploy Apps Script. The Hall Pass repair is deployed and synthetically verified as Version 18. No real student PIN is used.

| ID | Status | Evidence / next action |
| --- | --- | --- |
| 1 | VERIFIED | Version 18; 298 runtime checks and full gate pass; native migration and deployed protected synthetic smoke pass. FIELD_PENDING. |
| 2 | VERIFIED | Version 18; 298 runtime checks and full gate pass; native migration and deployed protected synthetic smoke pass. FIELD_PENDING. |
| 3 | VERIFIED | Version 18; 298 runtime checks and full gate pass; native migration and deployed protected synthetic smoke pass. FIELD_PENDING. |
| 4 | VERIFIED | Version 18; 298 runtime checks and full gate pass; native migration and deployed protected synthetic smoke pass. FIELD_PENDING. |
| 5 | VERIFIED | Version 18; 298 runtime checks and full gate pass; native migration and deployed protected synthetic smoke pass. FIELD_PENDING. |
| 6 | VERIFIED | Version 18; 298 runtime checks and full gate pass; native migration and deployed protected synthetic smoke pass. FIELD_PENDING. |
| 7 | VERIFIED | Version 18; 298 runtime checks and full gate pass; native migration and deployed protected synthetic smoke pass. FIELD_PENDING. |
| 8 | VERIFIED | Version 18; 298 runtime checks and full gate pass; native migration and deployed protected synthetic smoke pass. FIELD_PENDING. |
| 9 | OPEN | Not assigned in the revised remaining register; no closure claimed. Read this specification ID only when selected. |
| 10 | LOCAL_VERIFIED | Netlify now calls the canonical npm run verify command, matching GitHub Actions and local publishing. Exact Netlify production execution remains unverified until dashboard access is available. |
| 11 | OPEN | Live GitHub API reports admin and push permission. main branch-protection endpoint reports Branch not protected (404). Earlier external authority blocker cleared; no settings changed in this batch. |
| 12 | OPEN | Not assigned in the revised remaining register; no closure claimed. Read this specification ID only when selected. |
| 13 | PUSHED | Editor save/rebuild/confirm copy. Launch capsule reports implementation and tests at 002b302; included in baseline 4513ae7. Do not reimplement. |
| 14 | VERIFIED | Canonical six-stage verify implemented; GitHub Actions calls it once; check dependency preflight added. START-HERE and CLAUDE document the command. Final canonical verify passed with 46 resource/release fixture groups and unchanged source/data checksums. Pushed to main and remote SHA confirmed. GitHub Actions canonical verify passed: https://github.com/Grantauch/the-desk/actions/runs/33983159223 |
| 15 | VERIFIED | Policy settled in specification: live-data:check remains a separate health check, excluded from deterministic verification. |
| 16 | LOCAL_VERIFIED | Resource sync uses the shared eligibility helper, preserves linked and null/empty/absent-href coming-soon resources and assignments, validates both outputs before writes, exports only public fields, and preserves private source files. |
| 17 | LOCAL_VERIFIED | Local editor listing and assignment validation use shared eligibility. Coming-soon status is visible; an actual HTTP save/publish fixture preserves placeholders and private-only assignment history while rejecting concurrent mutations. |
| 18 | LOCAL_VERIFIED | Ordinary local/editor publishing never runs resources:sync. The full gate and synthetic editor publication pass without private inventories; public catalog and private source bytes are preserved. |
| 19 | VERIFIED | Read-only catalog/assignment validator and shared eligibility helper implemented, without private inventories. Archived unapproved resource removed only from public JSON; baseline history and Drive source preserved. 136 resources, 128 links, 8 placeholders. Final canonical verify passed with 46 resource/release fixture groups and unchanged source/data checksums. Pushed to main and remote SHA confirmed. GitHub Actions canonical verify passed: https://github.com/Grantauch/the-desk/actions/runs/33983159223 |
| 20 | PUSHED | First-day instructional dates and no-school rows. Launch capsule reports implementation and tests at 002b302; site:validate negative-tested; included in baseline 4513ae7. Do not reimplement. |
| 21 | PUSHED | US History 9 scope reaches the present. Launch capsule reports implementation and tests at 002b302; site:validate; included in baseline 4513ae7. Do not reimplement. |
| 22 | PUSHED | BTS September milestone: inventing american sport. Launch capsule reports implementation and tests at 002b302; included in baseline 4513ae7. Do not reimplement. |
| 23 | OPEN | Grant must decide the claim-specific mapping from Supported and complicated labels to the fixed verdict vocabulary before implementation. |
| 24 | OPEN | Open per revised capsule. |
| 25 | PUSHED | Syllabus-aligned periods and BTS unit names. Launch capsule reports implementation and tests at 002b302; included in baseline 4513ae7. Do not reimplement. |
| 26 | PUSHED | Civil Rights & the Soundtrack of a Movement. Launch capsule reports implementation and tests at 002b302; included in baseline 4513ae7. Do not reimplement. |
| 27 | OPEN | Open per revised capsule. |
| 28 | OPEN | Open per revised capsule. |
| 29 | OPEN | Open per revised capsule. |
| 30 | OPEN | Open per revised capsule. |
| 31 | VERIFIED | Version 18; 298 runtime checks and full gate pass; native migration and deployed protected synthetic smoke pass. FIELD_PENDING. |
| 32 | VERIFIED | Version 18; 298 runtime checks and full gate pass; native migration and deployed protected synthetic smoke pass. FIELD_PENDING. |
| 33 | VERIFIED | Version 18; 298 runtime checks and full gate pass; native migration and deployed protected synthetic smoke pass. FIELD_PENDING. |
| 34 | VERIFIED | Version 18; 298 runtime checks and full gate pass; native migration and deployed protected synthetic smoke pass. FIELD_PENDING. |
| 35 | PUSHED | Version 17 source snapshot and fingerprint. Launch capsule reports implementation and tests at 4513ae7; included in baseline 4513ae7. Do not reimplement. |
| 36 | PUSHED | Versions 14-16 unsafe rollback warnings. Launch capsule reports implementation and tests at 4513ae7; included in baseline 4513ae7. Do not reimplement. |
| 37 | VERIFIED | OPERATIONS.md reflects Version 18, current policy, safe recovery and pending classroom observation. |
| 38 | OPEN | Open per revised capsule. |
| 39 | BLOCKED_EXTERNAL | No exact Netlify deployment fingerprint exposed by current GitHub status/deployment APIs. Existing browser tab listed at Netlify login; UI inspection timed out. Stop fingerprint pursuit and continue independent Batch 1 work. |
| 40 | VERIFIED | Windows Git push to main succeeded at e5297d2fe4a116ef78559faf1dfffbaade6abe57 and git ls-remote confirmed the same SHA. Current GitHub API reports admin and push permission. Write authority tested once; do not re-diagnose historical setup. |
| 41 | OPEN | Not assigned in the revised remaining register; no closure claimed. Read this specification ID only when selected. |
| 42 | PUSHED | Group sizes use Math.ceil. Launch capsule reports implementation and tests at 002b302; tools:test fixtures; included in baseline 4513ae7. Do not reimplement. |
| 43 | PUSHED | Cold call identifies roster slots. Launch capsule reports implementation and tests at 002b302; tools:test fixtures; included in baseline 4513ae7. Do not reimplement. |
| 44 | PUSHED | Timer uses wall clock. Launch capsule reports implementation and tests at 002b302; tools:test fixtures; included in baseline 4513ae7. Do not reimplement. |
| 45 | OPEN | Open per revised capsule. |
| 46 | OPEN | Open per revised capsule. |
| 47 | PUSHED | GD1 packed-text and private-note copy. Launch capsule reports implementation and tests at 002b302; included in baseline 4513ae7. Do not reimplement. |
| 48 | PUSHED | 2026 head-of-household tax bound. Launch capsule reports implementation and tests at 002b302; site:validate; included in baseline 4513ae7. Do not reimplement. |
| 49 | OPEN | Open per revised capsule. |
| 50 | OPEN | Open per revised capsule. |
| 51 | OPEN | Open per revised capsule. |
| 52 | PUSHED | README courses and commands. Launch capsule reports implementation and tests at 4513ae7; included in baseline 4513ae7. Do not reimplement. |
| 53 | PUSHED | CLAUDE stack and maintenance rules. Launch capsule reports implementation and tests at 4513ae7; included in baseline 4513ae7. Do not reimplement. |
| 54 | PUSHED | EDITING conventions corrected. Launch capsule reports implementation and tests at 4513ae7; included in baseline 4513ae7. Do not reimplement. |
| 55 | PUSHED | START-HERE publishing routes. Launch capsule reports implementation and tests at 4513ae7; included in baseline 4513ae7. Do not reimplement. |
| 56 | PUSHED | Curriculum eligibility and documented href-only gap. Launch capsule reports implementation and tests at 4513ae7; included in baseline 4513ae7. Do not reimplement. |
| 57 | PUSHED | Stale root jeopardy copies removed; canonical hubs retained. Launch capsule reports implementation and tests at 4513ae7; included in baseline 4513ae7. Do not reimplement. |
| 58 | LOCAL_VERIFIED | Both legacy batch scripts delegate to publish.bat and the shared publisher. No automatic all-files staging or index-lock deletion. Intended batches, failure stops, source stability, upload retry and remote SHA confirmation are covered with synthetic repositories. |
| 59 | PRESERVE_VERIFIED | Preserved per revised capsule; existing handoff, structural Hall Pass, and runtime regression suites passed locally. No reimplementation and no new classroom field claim. |
| 60 | PRESERVE_VERIFIED | Preserved per revised capsule; existing handoff, structural Hall Pass, and runtime regression suites passed locally. No reimplementation and no new classroom field claim. |
| 61 | PRESERVE_VERIFIED | Preserved per revised capsule; existing handoff, structural Hall Pass, and runtime regression suites passed locally. No reimplementation and no new classroom field claim. |
| 62 | PRESERVE_VERIFIED | Preserved per revised capsule; existing handoff, structural Hall Pass, and runtime regression suites passed locally. No reimplementation and no new classroom field claim. |
| 63 | PRESERVE_VERIFIED | Preserved per revised capsule; existing handoff, structural Hall Pass, and runtime regression suites passed locally. No reimplementation and no new classroom field claim. |
| 64 | PRESERVE_VERIFIED | Preserved per revised capsule; existing handoff, structural Hall Pass, and runtime regression suites passed locally. No reimplementation and no new classroom field claim. |
| 65 | PRESERVE_VERIFIED | Preserved per revised capsule; existing handoff, structural Hall Pass, and runtime regression suites passed locally. No reimplementation and no new classroom field claim. |
| 66 | PRESERVE_VERIFIED | Preserved per revised capsule; existing handoff, structural Hall Pass, and runtime regression suites passed locally. No reimplementation and no new classroom field claim. |
| 67 | PRESERVE_VERIFIED | Preserved per revised capsule; existing handoff, structural Hall Pass, and runtime regression suites passed locally. No reimplementation and no new classroom field claim. |
| 68 | PRESERVE_VERIFIED | Preserved per revised capsule; existing handoff, structural Hall Pass, and runtime regression suites passed locally. No reimplementation and no new classroom field claim. |
| 69 | PRESERVE_VERIFIED | Preserved per revised capsule; existing handoff, structural Hall Pass, and runtime regression suites passed locally. No reimplementation and no new classroom field claim. |
| 70 | PRESERVE_VERIFIED | Preserved per revised capsule; existing handoff, structural Hall Pass, and runtime regression suites passed locally. No reimplementation and no new classroom field claim. |
| 71 | PRESERVE_VERIFIED | Preserved per revised capsule; existing handoff, structural Hall Pass, and runtime regression suites passed locally. No reimplementation and no new classroom field claim. |
| 72 | PRESERVE_VERIFIED | Preserved per revised capsule; existing handoff, structural Hall Pass, and runtime regression suites passed locally. No reimplementation and no new classroom field claim. |
| 73 | PRESERVE_VERIFIED | Preserved per revised capsule; existing handoff, structural Hall Pass, and runtime regression suites passed locally. No reimplementation and no new classroom field claim. |

Next executable task: push the locally verified publishing/resource batch and check GitHub Actions; exact Netlify deployment needs authenticated dashboard access.

Problem 11 is now OPEN because administrator access is available; main currently has no branch protection. The START-HERE follow-up is complete. The curriculum publishing gaps are resolved in the current batch. Problem 23 still requires Grant's content mapping. Problem 39 is BLOCKED_EXTERNAL: no deployment fingerprint exposed by GitHub, and the existing Netlify login tab could not be inspected because the browser request timed out. No exact deployment is inferred. This does not block independent release work.

### Hall Pass release complete — September 6

Released September 6, 2026 at 1:00 AM America/Detroit on the existing deployment, from source commit a7ea2b25358ba9dc686a299730b32b492e4da339. All five files were saved, the editor reloaded, and each file read back and matched to tested source. The manifest, stable /exec, owner execution and school-domain-only access were preserved.

The native synthetic migration rehearsal passed twice without further changes. The focused live migration preserved original facts in six existing sheets and all prior setting values. Schema: 2026-09-05-session-a.

The Version 18 web-app synthetic smoke completed at 1:01:44 AM: STARTED, RETURNED_COUNTABLE, evidenceUsed 1; test pass voided, synthetic membership deactivated, production facts unchanged. The result was recovered from the execution log after a browser interruption, without repeating the test. No real student PIN or email was used. Synthetic workbook URLs remain private.

Full canonical verify and GitHub Actions passed, including 298 behavioral checks. Real classroom field verification remains FIELD_PENDING. Versions 14-16 remain unsafe to redeploy.

[GitHub Actions passed](https://github.com/Grantauch/the-desk/actions/runs/34012833475). [Release fingerprint](../../apps-script/snapshots/hall-pass/version-18-live-2026-09-06/FINGERPRINT.md). Student, kiosk, daily check-in and teacher entry checks passed after deployment.

### Publishing/resource safeguards — September 6

Problems 10, 16–18 and 58 are locally verified. Full canonical verify PASS: 64 handoff checks, structural suite, 298 Hall Pass behavioral checks, 11 classroom-tool checks, 47 resource/gate fixtures, 17 publishing/resource integration checks, StoryHub validation, Astro 0 errors/0 warnings (8 existing hints), 51 built routes, 66 HTML files/2709 references. All 202 source/document paths retained identical checksums.

The new integration checks use temporary local repositories and a local editor HTTP fixture, with no external test uploads. They cover failed checks, unchanged source/private inventories, preserved coming-soon assignments, unrelated changes, Git locks, concurrent saves, remote divergence, cancelled confirmation and failed-upload recovery. The ordinary authoring inventory was not synced.

Production source commit/push and GitHub Actions are the next release steps. Netlify dashboard sign-in is required for an exact deployment fingerprint; no success is inferred. Apps Script Version 18 and the private workbook are unchanged.
