# StoryHub work controls and reliability audit — October 26, 2026

Owner: Codex. Baseline: main `cee8654`, immediately after PR #243 (Load My Work). Work branch: `feat/storyhub-work-panel`.

Status: source repaired and focused verification passed; protected review pending. Production remains the baseline until the protected website release and a separate update of the existing Turn In Apps Script deployment. Classroom validation remains pending.

## What this system can establish

| Evidence | Supported statement | Limit |
| --- | --- | --- |
| Private Turn Ins row with Submission ID, server time, roster identity and answers | This answer snapshot reached the service and was recorded as a deliberate Turn In under that student's PIN identity. | A PIN identifies an account; it does not establish which human entered the answers or who wrote them. |
| Confirmed account save / private Drafts or Progress record | These answers reached account storage at the recorded server time. | A draft is work in progress. Draft history is retained for 30 days; the current Progress view and Turn Ins follow their existing retention. |
| Tab copy | This browser tab retained a copy at its last successful storage readback. | Closing, discarding or clearing the tab/browser, storage failure and Chromebook resets can destroy it. A new tab is intentionally blank for shared-device privacy. |
| Clipboard / downloaded backup | The student has attempted to keep a separate copy. | Downloads can be cancelled, clipboard contents replaced and files edited. Neither establishes a server receipt, authorship or the original creation time. |
| Paste limit | The page can prevent a long paste unless the student enables the writing-tool/prior-draft option. | It cannot detect AI, prove cheating, observe other pages or prevent deliberate browser manipulation. |
| No saved record found | No confirmed account save or Turn In was found in the records reviewed. | It does not prove that the student never worked, never attempted a save, lied or cheated. Unsaved offline work is possible. |

Suggested parent/admin wording: “The records reviewed show [a confirmed Turn In / a saved draft / no confirmed account save] for this assignment. The recorded snapshot contains [specific answers or blanks] at [server time]. This tells us what reached the system; it does not establish whether unsaved work existed on another device.”

## Findings and repairs

| Finding at baseline | Repair in this branch |
| --- | --- |
| Storage exceptions silently fall back to memory, while UI still says saved in this tab. | Verify sessionStorage readback, expose blocked storage and keep exit warnings. |
| Copy sets its success marker before clipboard success. | Mark copied only after confirmed clipboard or fallback success. |
| Hidden, blank research rounds disappear from the submitted answer list. | Capture all answer fields and radio groups, including blanks. |
| Loading/resetting dispatches edit events during replacement. | Suppress persistence and background saves until the replacement completes. |
| Pending responses can arrive after an account or class changes. | Serialize write/account transitions; ignore responses from obsolete client generations. Check the account token against the Turn In PIN on v9. |
| An old tab can overwrite newer account work. | Compare unique server revisions under the same script lock as the write. Pause on conflict; preserve the visible draft and require explicit recovery. |
| Reusing a cached submission ID can acknowledge changed answers. | Validate the complete answer payload and class against the cached receipt before acknowledging it. Durable duplicate detection remains in place. |
| Same-timestamp writes / old receipt retries can regress the Progress view. | Assign monotonically increasing server write times under the lock and retain unique revisions. |
| A corrupt latest draft/cache or a 4,000-row search cutoff can prevent recovery of retained work. | Fall back to durable records and search older retained work in bounded batches. Optional work-cache failures cannot negate a durable write. |
| Catalogue controls differ and older hubs retain answer copies in localStorage. | Common controls on all 47 catalogue pages; old answer copies move to sessionStorage without deleting existing storage. Reading pages explicitly have no written draft. |

## Student controls

All 36 catalogue pages that collect work share: PIN Load My Work, confirmed Save now, backup download/import, Copy answers, Print, undo of a load within the tab, Turn In, a download of the acknowledged Turn In reference, and sign-out. The floating status control remains available while scrolling. Existing lesson-specific activities and approved writing tools remain.

The 11 reading/viewing pages receive a common reading panel with Print and an explicit explanation that there is no written assignment draft on that page. They never create phantom assignments or contact the save service.

Common writing support uses the existing 12-word paste rule and a visible override for a student's own draft or a writing tool. Full URLs and explicitly identified source fields are allowed. The wrestling project's existing tools continue to own its paste behavior. No keystroke counts, clipboard history, process receipts, activity scores or AI scores are added or transmitted. Superseded the same day at the owner's request: see [WRITING-TIMELINE.md](WRITING-TIMELINE.md). The clipboard is still never read and no AI score is computed.

Finished status now refers to the exact question/answer snapshot, including blank fields. Capturing previously omitted hidden questions can move an older Progress entry to In progress; its original immutable Turn Ins row remains available.

Personal JSON backups contain only hub identity, answer values, labels, an unverified export time and a notice. They contain no PIN, token or account credentials. Import validates the format, hub, field names and radio choices before changing any answers. Import cannot assert a submission or restore authentication.

## Release sequence and unresolved deployment gate

1. Pass the focused server/browser checks, canonical verification and protected GitHub build. Review the exact source diff and public-data boundary.
2. Publish the v2 website client through the protected PR workflow and verify the production commit. Preserve the existing stable service URL.
3. Update only Code.gs in the existing Turn In project and edit its existing deployment to v9. Do not create a new workbook, change Hall Pass, change sharing, change access policy or replace the stable URL. No new setup/migration is required for v9.
4. Run `activateWorkProtection` in the existing project. This requires revision-aware writes and refuses an older open page with a reload message. Until this step, legacy requests remain compatible and are not protected by the new revision contract.
5. Verify the public service reports v9, `writeProtocol: 1`, `checkedWritesRequired: true`, and ready. Run the existing synthetic load test in its dedicated test sheets, verify actual unique rows and recovery, then disable load-test mode.
6. Have students copy/download pending work before refreshing older open tabs. Run a real Chromebook class cycle; separately record classroom evidence.

The agent's attempt to open the Apps Script project list was blocked by automatic approval review at the Google Accounts origin. No account/session workaround was attempted. Existing-project sign-in and activation need explicit user authorization. Local synthetic tests do not exercise Google quotas, district filtering, real service contention or actual Chromebook crashes.

Submission snapshots are append-only through the student API. Authorized Google Sheets editors can still alter rows; these are operational records, not a tamper-proof forensic log.

The system is designed to avoid silent loss and unsupported success messages. It is not infallible. Apps Script/Sheets writes are not database transactions; partial service failures require checking immutable Turn Ins and retained drafts. No grade, discipline decision or cheating finding is automated here.

## Verification record

- Server suite: 51/51 synthetic checks passed, including stale revisions in the same clock tick, lost acknowledgements, strict legacy-client refusal, cached payload mismatch, wrong-account submission and corrupt-row fallback.
- Canonical `npm run verify`: passed all full-release stages; static output contains 136 HTML files and 4,628 local references. Final added server regressions pass separately.
- Astro/TypeScript: 0 errors, 0 warnings (informational hints remain).
- StoryHub manifests and sealed public assets: passed (13 releases / 117 files).
- Final work browser suite: 34/34 passed against the v9 synthetic service, including all 40 wired answer hubs, all 11 catalogue readers, 35 concurrent flaky-network submissions, blocked storage, failed copy, conflict recovery, credential-free backup roundtrip, exact receipts and shared paste override. The final account-switch/PIN-clear regression also passed independently.
- Wrestling writing/recovery suite: passed all five rounds, PIN recovery, offline edits, cancellation/confirmation, Turn In, shared-device resets, 320/390/1366-pixel accessibility and reduced motion.
- Broader browser checks: 57/57 main site UI, 48/48 extended UI, 83 Jeopardy checks, 15/15 companion/Pond checks passed. The combined browser command stopped at the unchanged The League game’s 320-pixel landing-page overflow in the local Chromium 153 runtime. Its HTML matches baseline. The remaining shared-save, Jeopardy and companion stages were run independently. No full-browser green claim is made; the protected CI environment must resolve that release-check limitation.
- Production deployment, live synthetic load test and classroom cycle: pending.
