# SW-186 — One-stop Schoolwide safety-stack review and release decision record

**Decision as of November 22, 2026: NO-GO for live student authentication, PIN handoff, schoolwide deployment, and production data migration.**

This document gathers the already-tested **synthetic-only** work for one independent technical review. It is **not** security approval, district authorization, a production deployment checklist that has been signed off, or a claim that the school's network was tested.

## Review target and change surface

- **Review base:** `schoolwide/sw-172-vps-staging-candidate` at `7752016acd68c9bc836ce3a830d95a8ee3717187` (same synthetic staging base used by the source PRs).
- **Integrated source before this document:** `schoolwide/sw-185-test-module-boundary` at `e68ddca607b0298993f33c8204b549b1abb7c582`, 13 commits beyond review base.
- **Change summary at that SHA:** 29 files, 1,562 insertions, 78 deletions. All changed paths start with `schoolwide/` or are one of `.github/workflows/schoolwide-ci.yml` and `.github/workflows/schoolwide-cross-runner-recovery.yml`.
- **Review-only consolidation:** a separate PR based directly on the synthetic staging branch so the full integrated diff is visible in one review. Previous source PRs and their branches are unchanged. **Do not merge this consolidation PR into main or deploy it.**
- Parent security/authentication candidate **#433 remains draft**. Its authorizations and live test evidence are separate from this branch.

## Changes to review — source PRs versus consolidated behavior

| Batch | Original PR | Integrated content | Key verification |
| --- | --- | --- | --- |
| SW-178 | [#484](https://github.com/Grantauch/the-desk/pull/484) | AST tripwire prevents importing off-by-default PIN handoff and injecting live identity providers | Six adversarial static guard tests; 3/3 source-head CI |
| SW-179 | [#487](https://github.com/Grantauch/the-desk/pull/487) | Six-step offline teacher PRELAUNCH training and synthetic privacy/device rehearsal | Chrome mobile/desktop/keyboard/print/privacy and packaging; 3/3 source-head CI |
| SW-180 | [#491](https://github.com/Grantauch/the-desk/pull/491) | CI-only encrypted backup, wrong-key/tamper denial, restore to clean isolated PostgreSQL 18 container, cleanup confirmation | 54 schema tables, 20 migrations, 3 **fictional** canary records; 3/3 source-head CI |
| SW-181 | [#495](https://github.com/Grantauch/the-desk/pull/495) | Signed school and issuer bind the nonce replay callback to trusted PostgreSQL scope | Wrong-school/wrong-issuer regression, concurrency/once-only tests; 3/3 source-head CI |
| SW-182 | [#498](https://github.com/Grantauch/the-desk/pull/498) | Integration of four above, fixes guarded-module type dependency without relaxing guard; v0.2.1 normalized ZIP | Linux/Windows identical v0.2.1 SHA, 3/3 integrated CI |
| SW-183 | [#503](https://github.com/Grantauch/the-desk/pull/503) | Fictional encrypted database artifact transferred between two separate GitHub-hosted runners; strict exact-path CI workflow firewall | Independent runner restores 54 tables, 20 migrations, 3 fake canaries, wrong-key/tamper denial; **4/4 CI** on source-head |
| SW-184 | [#512](https://github.com/Grantauch/the-desk/pull/512) | Bounded expired nonce ledger cleanup; scope-specific PostgreSQL `SKIP LOCKED`; no scheduler | Five PostgreSQL cleanup cases PASS; 3/3 source-head CI |
| SW-185 | [#519](https://github.com/Grantauch/the-desk/pull/519) | Prevent application code importing exempt synthetic test/spec modules; deterministic HMAC-tamper test | Red→green import-boundary test, deterministic tamper negative test, 3/3 source-head CI |

### Latest integrated Linux evidence

At integrated source SHA `e68ddca607b0298993f33c8204b549b1abb7c582`:

- [Schoolwide CI run 45077588889](https://github.com/Grantauch/the-desk/actions/runs/45077588889) — **SUCCESS**. Explicit log `ok 7` SW-185 test/spec boundary, `ok 31` SW-175 HMAC tampering, synthetic encrypted PG18 restore + ephemeral cleanup.
- [Staging Qualification run 45077588793](https://github.com/Grantauch/the-desk/actions/runs/45077588793) — **SUCCESS**. This is CI staging qualification, **not confirmation of a new deployment to the private VPS**.
- [site check run 45077588792](https://github.com/Grantauch/the-desk/actions/runs/45077588792) — **SUCCESS**.
- The separate two-runner synthetic export/restore workflow [45073198879](https://github.com/Grantauch/the-desk/actions/runs/45073198879) was **SUCCESS** at SW-183 source head `728b2483d18eef7035b5df9d828a94cabf2c302e`. That workflow was not re-triggered by the later source-only SW-184/185 edits; do **not** claim cross-runner verification at the later SHA.
- **Offline teacher training ZIP v0.2.1:** TheAtlas `C:\Users\Grant\Downloads\Schoolwide_Teacher_Prelaunch_v0.2.1.zip`, SHA-256 `75c663ead5c636dead313e0d0fc8a674dc41722f1597cb46e2ad34ba05486bef`; Linux and Windows matched on SW-182. Previously delivered v0.2.0 ZIP was **not overwritten**.

All CI uses fictional data. The SW-183 test encryption passphrase is **public by design** and must never be used as a real secret or represented as secure production key management.

## Reviewer decision sequence

The independent security reviewer should answer these in order, with specific code/file references, before recommending *any* merge:

1. **Source-level boundary** — can untrusted runtime import the off-by-default attestation/replay modules, including through test/spec modules, dynamic imports, loaders, or alternate paths? Are the provider defaults truly disabled under all deployed entry points?
2. **Issuer trust and same-PIN continuity** — where does the original source independently verify a presented PIN **without publishing or exporting** it, its salt/hash or roster? How are identity, active enrollment, school/organization mapping, key trust/rotation and leading-zero PIN preservation established? A synthetic signed attestation is not proof of an approved real source verifier.
3. **Replay and abuse** — does the PostgreSQL consume operation match authenticated issuer and school, stay atomic across connections, burn bad-PIN attempts, preserve rate limits and expiry, resist replay despite DB failover, and return safe errors? Can a cleanup worker be limited to expired records and scoped batches without deleting valid one-use guards?
4. **School data and legal approval** — is district authorization recorded for storing any real student identities, verifying lunch-number PINs or sharing data between Schoolwide and existing Apps Script/Check-In? Are access, retention, audit and data-processing permissions documented?
5. **Recovery/rollback** — is there a **real** encrypted off-site backup with custody/rotation of private keys, evidence of transfer and restoration on an independently authorized machine, accurate RPO/RTO and a tested backout that preserves active pass sessions? Synthetic public-key CI artifacts do not fulfill this gate.
6. **School Chromebook acceptance** — real student-facing kiosk versus separate teacher dashboard, touchscreen/keyboard, managed school Wi-Fi/firewall, login and timeout, idle privacy reset, timing accuracy, accessibility, teacher setup, staff support and recovery were **not verified on district devices**.
7. **Change-control evidence** — review constituent diffs and the consolidated PR. Confirm no real PIN import, production application changes or staging promotion before any individually authorized next stage. The final reviewer should explicitly designate the acceptable synthetic-only merge target/sequence.

## GO / NO-GO matrix (default is NO-GO)

| Required for live use | Verified now | Evidence owner and acceptable proof |
| --- | --- | --- |
| Composite source compiles and passes synthetic CI | **YES — CI only** | GitHub exact-head workflow logs above |
| Production/authentication traffic remains disconnected | **YES — source guard only** | SW-178 and SW-185 source tests; **not** a live runtime penetration test |
| Independent security threat model and code review | **NO — no submitted review found as of this packet** | Claude + approved security reviewer: signed security decision referencing exact commits |
| District approval for identity/PIN verification and student processing | **NO** | District owner and school admin: written authorized scope |
| Trusted existing-PIN source attestation and key custody | **NO** | Approved technical owner: auditable source verifier and rotation/key control |
| Real school Chromebook and network field acceptance | **NO** | Teacher/district IT: supervised evidence on managed device |
| Encrypted production offsite backup with private keys | **NO** | District technical owner: verifiable encrypted offsite backup and custody |
| Restoration on genuinely independent approved machine | **NO** | District technical owner: restore drill + documented RPO/RTO |
| Tested rollback without harming live pass/check-in data | **NO** | Operations owner: restore/rollback and session-continuity evidence |
| Specific authorized production cutover | **NO** | Grant + district owner: explicit signed authorization |

**GO requires independent evidence for every row. Never infer GO from GitHub green checks, a draft review, a downloaded teacher training ZIP, or a synthetic Chromebook preview.**

## Non-negotiable safety rules

- Do not merge the consolidated review PR, its source PRs, or draft #433 into the public production branch without appropriate review/authorization. Any approved merge must have an explicit target and stated scope.
- Do not enable a real PIN handoff endpoint, import/hash/export actual lunch-number PINs, download rosters or student records, or modify production Hall Pass/Check-In/Apps Script.
- Do not treat separate GitHub Actions runners as equivalent to an independently managed offsite disaster-recovery environment.
- Never treat the teacher PRELAUNCH ZIP as an authorized student kiosk installer.
- Retain all unapproved rows as NO-GO in Team Desk. A reviewer may approve **synthetic-only staging source integration** while keeping the live rollout blocked.

## What Claude should decide now

**One decision requested:** whether the 13-commit integrated synthetic safety stack is acceptable for **source-only integration into the existing isolated staging candidate**, and if so the required merge order and outstanding corrections. The reviewer may reject/require changes; **neither outcome authorizes production credentials, school devices or live data.**

Leave an explicit review in the consolidated PR and update Team Desk with that decision. Keep the parent #433 draft until the independent security review and operational go/no-go evidence exist.
