# Hall Pass issue #319 — clean-environment release readiness

Owner: Codex. Review branch: `work/hall-pass-release-gate`. Inspected main: `e30413bea130962e26317dc1cc9f6b4a0fbad95f` on November 4, 2026 (Detroit). Requirements: [issue #319](https://github.com/Grantauch/the-desk/issues/319), updated November 4. The November 4 preparation batch changed no production, deployment, directory, roster, student credential or existing public download. The November 5 setup-error follow-up below supersedes its source-only promotion hold for the setup repair.

## Requirement map

| Requirement | Current source and evidence | Remaining gap |
| --- | --- | --- |
| Private schoolwide directory, separate classroom memberships | `Code.gs` has a separate directory workbook. Import adds no classroom memberships. Active membership is required in each room. Independent-workbook synthetic tests pass. | Actual district sharing policy and two school-account installations must be tested. |
| Exact shared lunch-number PIN | Server reads the same private directory in each room, preserves five/six digits and leading zeros, refuses local random resets when connected, and invalidates sessions/proofs when current credentials change. | Real mapping/cutover is not authorized here. District must authorize reuse of payment-related identifiers. |
| Authoritative identity and import review | Exact number/email mappings; duplicate IDs/emails, wrong-domain records, malformed/numeric cells and stale previews are rejected. Private roster validator reports duplicate-name counts without printing records. | Browser import has no duplicate-name exception-review workflow. Directory columns use the lunch number as School Student ID plus verified email/status; separate immutable ID and explicit credential-version reference columns are not implemented. Current invalidation derives from the credential hash. Reconcile this schema with #319 before claiming full completion. |
| Classroom isolation and default denial | Teacher-owned workbooks/logs and explicit per-room enrollment; unassigned/disabled identities are refused. | Verify actual school-account roles, directory ACLs and managed kiosk account in the domain. Viewers of the directory can read identifiers; only individually authorized staff may receive that access. |
| Kiosk privacy and defensive controls | Explicit five/six-digit submission, immediate clearing, timeout, persistent server throttling and fail-closed directory lookup are implemented and covered synthetically. | Real Chromebook keyboard/touchscreen/sleep/relaunch/Wi-Fi/lockout acceptance pending. |
| Single versioned browser-first kit | This batch builds package `1.0.0-rc.2` with Start Here, all seven program files (classroom application `1.0.0-rc.1`, with corrected template setup recovery), package/source manifests, offline Preflight, optional IT verifier, smoke tests, recovery and school checklist. | No finished release or new public download is published. Google OAuth and owner deployment remain required steps. |
| Exact template/source integrity | Package includes exact and editor-normalized source hashes; setup requests the coordinator's approved blank-template link instead of embedding an unchecked mutable template. | Current hosted template was not read/modified. IT must compare all seven files or provision an approved exact-source blank template. Version labels alone cannot prove integrity. |
| Centrally managed software updates | Directory corrections are read automatically. Package and application versions are distinguished. | **Unmet:** independent Apps Script copies still require per-copy software deployment updates. Decide and implement an approved central service or school-managed update mechanism; test upgrade and compatible rollback before release. |
| Clean-environment release gate | Exact archive verifier, 16-case operator record, strict defaults and artifact fingerprints now exist. Incomplete/altered evidence cannot approve publication/cutover. | A clean supported computer, second school-account user and dedicated managed Chromebook have not completed the exact ZIP test. |
| Recovery and production protection | Separate software/directory recovery, private backups, history preservation, compatible-version restrictions and coordinated credential recovery are documented. Builder refuses `public/` output. | School IT must rehearse restoration with synthetic history, retain private configuration and explicitly authorize a later cutover. |

## What changed in this batch

- Deterministic RC2 archive builds only to a private output path, refuses unknown/symlinked inputs and embedded Apps Script deployment endpoints/common Google token forms, and requires DOMAIN/USER_DEPLOYING in the packaged manifest. It does not retrieve runtime data or credentials. An allowlist and known-pattern checks are defense in depth, not proof that arbitrary edited source contains no personal data.
- Browser Preflight checks all 17 payload files plus the manifest using locally selected files. Missing, extra, duplicate, changed and unsafe filenames fail. SHA-256 verifies consistency, not authorship; compare the original ZIP hash with a separately trusted record.
- Evidence records contain version, artifact fingerprints, time and fixed test results only. No names, school links, PINs or account details are requested. Changing the chosen artifact clears prior field results. Reports remain operator observations, with distribution/cutover approval always false.
- IT's standard-library verifier reads the original ZIP without extraction, rejects duplicate/path-escape entries, checks source/payload manifests and binds the operator record to the exact ZIP and manifest. Exit 0 means valid integrity/all recorded cases passed when supplied; 2 means incomplete observations; 1 means invalid package/evidence. No result authorizes a release.
- Start Here generates strict separate kiosk/dashboard/protected-test URLs locally and provides an optional portable HTML kiosk shortcut. Error states clear old links. The classroom server remains unchanged; the November 5 follow-up corrects the template wizard’s failed-startup recovery.

## Candidate fingerprint (held, not published)

Archive: `HallPass-Teacher-Installer-v1.0.0-rc.2.zip`.

SHA-256: `da342495e6906d90d39bb4002830b7fc81c0fc05f23bc847f3332eea60ba6855`.

Payload manifest SHA-256: `c00e4f869652fa1bee17a533194da0e027457abc79d099a086d83af8b7f26dd7`.

Rebuild privately with `python scripts/build-hall-pass-teacher-kit.py`; verify with the included `verify.py`. The candidate is not placed in `public/` or a release attachment.

## Verification evidence

- `node scripts/test-hall-pass-teacher-kit.cjs`: PASS. Exercises actual launcher handlers, Preflight UI defaults and stale-artifact resets, deterministic builds, exact seven source files, checksum/tamper/missing/extra/duplicate failures, evidence binding and forged approval rejection. Invokes the synthetic Python negative tests.
- `npm run hall-pass:verify`: PASS, including 441 runtime behaviors across 32 areas, structural/handoff checks, independent-room directory/credential/revocation/throttling tests and new kit checks.
- `python scripts/test-schoolwide-hall-pass-roster.py`: PASS, 5 tests. No private roster was read.
- Chrome HTTP preview: Start Here renders; synthetic template/deployment links generate correctly; Preflight renders 16 Not run cases with evidence download disabled initially. A hidden-link CSS issue observed in review was fixed. This is preview UI evidence only.
- Browser limitation: direct `file://` navigation was rejected by the cloud browser's URL security policy. No workaround or policy change was attempted. The actual extracted local-file flow, browser folder hashing and downloaded evidence have **not** been browser-verified here. Node executes the real handlers/hash logic, but does not replace that field check. School IT/teacher must run the native extraction flow on the supported computer.
- Full canonical `npm run verify`: PASS (exit 0). Diagnostics: 265 files, 0 errors, 0 warnings, 213 hints. Static validation: 167 HTML files and 5,464 local references; 32 StoryHub releases / 244 sealed assets passed. Verification did not change tracked source. Hosted protected CI and field acceptance remain separate pending stages.

The existing RC1 archive and setup-page link under `public/` were already present in inspected main. This task leaves them unchanged and does not certify or withdraw them. Their presence in source is not evidence that #319's release gate passed. No production-state claim is inferred from that older artifact.

## Required next owners

1. Engineering + school IT: resolve central software updates and the explicit identity/version schema and private exception-review gaps. These are implementation gaps, not user approvals that can be inferred from the current request.
2. District/coordinator: authorize lunch-number reuse, identify approved staff directory access/retention/recovery ownership, and provide authoritative identity mappings through a protected channel. Never place that source in GitHub or this ZIP.
3. School IT + second teacher: confirm exact blank-template source, complete two school-account staging installs, and run the managed Chromebook tests against this exact candidate. Retain approval and raw evidence privately.
4. Release owner: review all clean-environment evidence before publishing a finished versioned ZIP. Only later, with backups and explicit owner/district authorization, schedule and perform the coordinated production cutover. The completed installer release remains held; the November 5 user request separately authorizes promotion of the setup repair after protected checks.

## Local handoff and publication hold

Owner approval now explicitly covers pushing the source-only branch `work/hall-pass-release-gate` to `Grantauch/the-desk` and opening a draft pull request. The first push was blocked by automatic approval review before that permission was received. That November 4 source-review approval alone did not authorize ZIP publication, merging, template changes, production deployment or credential cutover. The November 5 request to handle the other teacher’s setup error authorizes the tested setup repair and template/site promotion; it does not establish managed-Chromebook or school-account field acceptance. Protected CI and school field acceptance remain separate evidence stages.

## November 5 — setup startup failure follow-up

The teacher supplied a screenshot of “reading from storage / PERMISSION_DENIED”. The startup failure handler previously opened an empty About form and enabled Next without loading workbook settings. The corrected wizard stops at a recovery screen, leaves protected navigation disabled, preserves the Google message as text, and offers an explicit retry. A successful settings load enables the questions. Failed saves retain answers and stay on their current screen.

Google documents unsupported multiple-account sign-in in Apps Script: https://developers.google.com/apps-script/guides/support/troubleshooting#issues_with_multiple_google_accounts . A school-only Chrome profile or one-account Incognito session is a possible environmental recovery, not a confirmed diagnosis from the screenshot. Existing teacher copies require that recovery or their own source update; hosted template changes only reach new copies. No permission weakening, scope guess, property reset or tab deletion is used.

The public setup guide and private review kit include those steps. Browser regression coverage uses only synthetic Google replies at phone and dialog widths, including repeated failure, invalid responses, blocked navigation, successful retry, preserved save inputs, step progress and WCAG A/AA. Protected CI and actual second-teacher field confirmation remain separate gates.

November 5 focused Hall Pass verification passes all 441 runtime behaviors, structural/handoff validation, independent-room directory tests, setup handler regressions and package integrity negatives. Local Chrome startup was blocked by the execution environment (Unix-socket creation refused), so no local browser pass is claimed. The actual-HTML test is part of the required protected browser suite. Full canonical verification is still running at this source checkpoint.
