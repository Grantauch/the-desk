# Hall Pass school directory and teacher kit

## Current release-gate checkpoint - November 13

Package `1.0.0-rc.2` adds offline integrity checks, operator field evidence, a source manifest, strict setup links and recovery/smoke materials. The classroom application remains `1.0.0-rc.1`; the November 5 follow-up corrects template setup recovery for failed settings reads. This candidate is held outside `public/`; no production or student PIN change is authorized. [Release readiness](hall-pass-release-readiness.md) maps complete/partial requirements and actual environment blockers. Central software updates, explicit identity/version references and browser duplicate-name exception review remain gaps. The RC1 description below records inherited implementation, not clean-environment release approval.

Batch 02 evidence now uses credential-repair candidate `4e0ede69f23f41d8329c367a3c8ad04f3391712f`: **447 Hall Pass runtime behaviors across 32 areas**, with local canonical verification passed. Its protected [site-check](https://github.com/Grantauch/the-desk/actions/runs/43502935244/job/132153108324) was running when this checkpoint was prepared; the final combined head also requires its own protected pass. The repeatable canonical-LF private archive is 182,830 bytes, SHA-256 `da7566c5cb55e4c440889bce599c2e6d1541d0044ca8a48846afec035092d71a`; payload manifest SHA-256 `532c1a8231eebd6b0db907e9c56839b966702ce1e3181c3ad3f30def721ec09c`. All seven archived source hashes match. Both approval flags remain false, and public output was rejected. See the readiness document for reproduction and exact-baseline limits.

## Confirmed requirements

Use the exact existing lunch number as the sole PIN: five or six digits, preserving leading zeros. Store the school privately, unassigned until explicit classroom enrollment. Independent teachers retain private dashboards and logs. Distribute a ZIP with Start Here, complete source, version, checksums and recovery. Keep real school data and credentials out of the ZIP and public repository. Preserve the existing production link and history.

## Implemented release candidate 1.0.0-rc.1

The separate private School Directory has School Student ID (plain text), Student Name, School Email and Status. AVAILABLE permits explicit active classroom memberships to use the record; it grants no membership itself. DISABLED revokes directory-based access across connected rooms. Records without verified email cannot be enrolled.

Imports accept alternating number/name lines or tab-separated number/name/email. Optional number/email mappings join by exact number. The previewed, confirmed import is additive, preserves disabled records and creates no class memberships. Duplicate IDs/emails, malformed numbers, formula-like names and wrong-domain mappings are rejected. No name-based identity guesses.

The coordinator shares only the separate directory with individually authorized participating teachers as Viewers. Existing classrooms cannot connect until every active email has a verified number. New teachers connect and explicitly enroll by number and period. Removing a classroom membership preserves history.

Hall Pass and Turn In read current directory credentials server-side without a cross-request credential cache. Directory failures never restore old PINs. Credential corrections invalidate identity sessions and Hall Pass action proofs. Each teacher retains an independent salt and private logs. Local random resets and ad hoc lunch imports are refused in connected rooms.

The kiosk offers a large keypad, explicit submission at either PIN length, clearing of submitted digits, immediate generic confirmation/reset after actions, abandoned-entry clearing, optional fullscreen/wake-lock and connection messages. Teacher access stays server-authorized. Uncertain network sign-outs must be checked in the dashboard before retrying the toggle action.

## Install and update

Extract the ZIP and open Start Here.html. Copy the blank bound-script template under the teacher's school account. The built-in setup creates the private workbook and class settings after Google permission approval. Google still requires owner web-app deployment. The launcher creates separate /exec kiosk and teacher links; no website or terminal is required.

The ZIP includes exact source as an IT/recovery fallback, verified against checksums and the current repository bytes. Shared directory corrections are automatic; independent Apps Script software copies still need versioned deployment updates. The directory panel reports software version. Recovery retains the existing workbook and deployment, with private backups and Google version history.

## Evidence and remaining prerequisites

Candidate Hall Pass: 447 behaviors across 32 areas. Independent-workbook tests cover shared credentials, enrollment isolation, old-PIN refusal, corrections, revocation, malformed source, stale previews and persistent rate limits after cache/nonce resets. The earlier November 4 checkpoint separately recorded 61 Turn In tests, five private-preflight tests and kiosk checks at 320/768/1366; those historical counts are not a new execution claim in this evidence refresh. Teacher-kit integrity, exact canonical source hashes, repeatable archive bytes and rejection of public output were rechecked on November 13.

Canonical verification, protected CI, production deployment and live smoke are separate evidence stages in PR #320 and release control. Real credential cutover still requires authoritative school email mappings for the supplied numbers, a verified second-teacher installation and managed Chromebook field acceptance. The package is labeled a release candidate until field checks pass. A code merge never by itself rotates student PINs.
