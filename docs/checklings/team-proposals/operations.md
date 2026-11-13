# CK-OPS-001 — Checklings isolated staging and recovery runbook

Status: **PROPOSAL — NOT DEPLOYED**. Owner: ChatGPT Personal. Pinned review base: `89f4502966ec1bca9bd6ce093c8f90b8d2f906a2`. Scope: operations design only. This document does not authorize provisioning, paid plans, access-control changes, live migration, or publishing private classroom data.

## Release boundary and ownership

The existing Hall Pass / Daily Check-In Apps Script deployment remains the authoritative school membership and attendance system. It must never wait on Checklings calls inside check-in, hall-pass, attendance, points or queue commits. The public `grant-desk.com` static site is only a launch link/art host. Stage Checklings on a **separate** Node/HTTPS service and a dedicated PostgreSQL database/project, service account, deployment pipeline, DNS origin and secret scope. No production classroom credentials, PINs, workbook exports, rosters or secrets go in GitHub or static assets. Begin with a synthetic tenant/class/member set only; no actual student data.

Assign named humans before provisioning: owner of game service, database, school issuer/bridge, backups, billing, security incident decisions and independent QA. Owner approves geographic processing location, institution/privacy requirements, retention window, service budget, provider terms, disclosure and incident-response channel. Until that approval, this is a provider-neutral design, not a vendor endorsement.

## Suggested environments

| Environment | Identity and data | Access | Deployment/rollback |
| --- | --- | --- | --- |
| Development | Synthetic IDs and disposable database; fake school issuer | Developers with scoped accounts | Rebuild from pinned migrations and test fixtures |
| Isolated staging | Synthetic school/class records only; dedicated private Postgres | Allowlisted reviewers; HTTPS-only; no public enumeration | Immutable artifact + migration preflight + reversible code rollout |
| Production (later, separately approved) | Only minimum opaque tenant/class/member IDs and private mapped school assertions | Strict least privilege; independent game origin | Human-approved release; audited actions; independent source-of-truth preservation |

The source stack includes an unmounted browser HTTP adapter and session broker in Batch04, but it is not a hosted login or a game UI. Batch05 school bridge is blocked from publication; **do not reimplement or publish it under this task**. Preview/CI tests do not establish Chrome Workspace or student readiness.

## Provisioning and secrets checklist (not executable until approved)

1. Create a dedicated managed PostgreSQL instance and an independently deployed service using separate project/accounts, region and billing alert. Private network connectivity to database; TLS required; default-deny ingress other than HTTPS game routes. No direct classroom sheet access from database/service.
2. Separate credential roles: migrator (DDL during approved deploy), runtime (only necessary DML and EXECUTE), backup operator (read/dump and encrypted destination), restore operator (isolated recovery access), and break-glass admin (time-bound audited). A compromised runtime token must not drop tables, modify audit history or read school credentials.
3. Store credentials in service secret manager, never source, runtime logs, front-end env, screenshots, sheet or support tickets. Separate service signing keys from Hall Pass sessions and school issuer keys. Include controlled rotation, ownership and revocation procedure; rotate on suspected exposure.
4. Capture immutable deployment evidence: source SHA, compiled artifact digest, migration IDs/checksums, database engine version, region, environment, deployment ID, synthetic gate results and rollback artifact. Record these in an access-controlled release ledger, not public student data.
5. Configure health and readiness independently: readiness depends on an authenticated database connectivity check, but check-in and Hall Pass readiness do not depend on game readiness. Return explicit unavailable/read-only state when persistence is down; never claim saved after timeout without receipt readback.

## Durable backup set

**A database dump alone is not enough.** A recoverable snapshot must include: game memberships and active/auth epochs; creatures, source-slot/legacy import fences and exact source fingerprints; founder species/names/homes/official preserved keepsakes; inventories, progression and revision counters; event and immutable command-receipt ledgers; sessions/launch records with revocations; encounters/battles/settlement/death and memorial/lineage records as schemas are introduced; teacher settings; schema-migration version/checksums; species/rules/assets version references; **identity mapping key or a secure recoverable escrow thereof** required to re-derive stable source slots; and documented service-signing/rotation epoch. Never place actual key bytes inside backups' plaintext manifest or CI logs.

Run encrypted scheduled snapshots with point-in-time WAL where provider supports it. Initial *proposed* policy: daily full snapshots, continuous WAL/PITR with an at-most-24-hour recoverability objective, 30 daily restore points and 12 monthly points. Set formal RPO/RTO only after measured tests and school-owner approval; an initial target for staging is **RPO ≤ 24 hours** without WAL or **≤ 1 hour** with verified WAL/PITR, **RTO ≤ 4 hours**. Targets are not observed performance.

Use authenticated encryption with keys held outside the database deployment, key rotation/version documentation, destination immutability or deletion protection, and a second independent failure location. A D: drive may hold a **secondary encrypted copy**, never the only backup; verify whether it is a separate disk or merely another partition of the same computer. No school account exports or student secrets on D: without explicit policy approval. Restrict destination reads, record snapshot age/size/hash/retention, and alert on incomplete or missing backups. Backup job must not obtain destructive production privileges.

## Measurable restore rehearsal (synthetic only)

1. Seed test records for all four founders (Mochi/Bolt/Zee/Ember), including distinctive names and earned homes; two distinct classes/members, a rejected cross-class write, and existing migration ledger entries. Include a pet with later progress, a memorialized/deceased creature, duplicate command receipt, a pending battle state, revoked session, and auth-epoch rotation. No real PINs or rosters.
2. Execute a verified normal backup while writes occur. Record snapshot ID, exact database schema revision, source SHA, encrypted object hash, key version, previous/next event sequence, source-slot mapping reference, command-receipt counts and per-table row counts. Restore to a **new isolated** database, never over a live tenant.
3. Provision the matching game artifact/migrations and decrypt only inside the approved recovery boundary. Verify SQL constraints and independently compare identity source-slot hashes, founder ID/name/home, saved progression, inventory, ownership, revisions, events, receipts, memorials/ancestry, active epochs, teacher flags and migration checksums. Confirm no omitted encrypted key dependency prevents an existing legacy source-slot from matching.
4. Repeat exactly the same `command_id` and payload after restore: response must be the original receipt with **zero extra reward, item, creature, XP or event**. Repeat it with a conflicting payload: reject. Attempt an outdated revision: reject. Verify an already-deceased creature cannot reappear in the roster; a stale import cannot overwrite later progress.
5. Test duplicate 35-client requests against **35 independent physical PostgreSQL connections**; assert one settlement/receipt, ownership consistency, bounded contention, no duplicate credit, and no lost events. Embedded PGlite tests alone do not satisfy this requirement.
6. Revoke all restored sessions unless session/key continuity has an independently approved design; test that a revoked/expired session stays rejected, the newer auth epoch invalidates older assertions, and stale browser tabs cannot repaint a next student's data. A safe default is to force a fresh verified school launch after disaster recovery.
7. Inject faults: backup missing/expired, corrupted ciphertext or wrong key, interruption mid-import, crash before commit, lost acknowledgement after commit, WAL gap, SQL upgrade mismatch, database unavailable during care and game unavailable during classroom check-in. Every unexpected condition must fail closed for *game writes* and leave original Hall Pass/check-in/pass fully functional.
8. Record elapsed backup-to-recovered-ready time, oldest successful recoverable timestamp, difference from last committed ledger event, checksum/row/revision mismatches, 35-client latency p50/p95/p99, and explicit pass/fail. Independent reviewer signs the exercise before declaring staging restoration verified.

**Acceptance thresholds:** zero missing founders or changed saved names/homes; zero duplicate grants/settlements/imports; zero foreign-class reads/writes; zero resurrection or invented legacy history; 100% receipt/event/revision consistency to the selected restore point; no game dependency introduced into school commits; measured recovery within the *approved* RPO/RTO. Unknown is FAIL/PENDING, not evidence.

## Incident playbook

- **Game host down:** disable new launch via game-only flag; show “Checklings unavailable; your last confirmed save is preserved.” Do not block attendance or issue school-system retries. Determine which commands committed by idempotency receipt, not by browser spinner.
- **Database/network partial failure:** pause game commands and dangerous timers, show uncertain save state, preserve failed request IDs for bounded replay, no automatic lethal decay; do not accept client-derived results.
- **Suspected account/secret breach:** stop new sessions, rotate affected scope, revoke sessions/launches, preserve append-only sanitized audit, isolate the game environment and notify institutional owner; never expose school secrets in incident chat.
- **Bad migration or release:** roll back *code* to pinned compatible artifact where schema permits; do not blindly downgrade or restore live DB over newer student state. Otherwise halt writes, take forensic snapshot, plan forward repair using idempotent migration. Roll back feature flag for pilot membership before game writes begin; after game writes, preserve game events and prohibit stale legacy reimport.
- **Data corruption:** isolate affected tenant, preserve evidence and recent backups, restore in an isolated environment, compare ledger to authoritative receipts and source fences, and obtain approval for a carefully scoped repair. Permanent-death reversals only through explicit audited technical correction, not routine restore side effects.

Every incident note should include UTC/ET time, sanitized environment, deployment SHA, incident scope, last confirmed receipt, recovery decision owner, and customer-visible state. No PIN/name/grade/roster/secret in logs.

## Data lifecycle and cleanup

Document approved retention separately for: anonymous launch flows, unexchanged one-use codes, hashed sessions, deactivated memberships, idempotency receipts, gameplay events, player saves, memorial/ancestry records, backups and audit logs. Until approved, do **not** silently prune data needed for consistency or restoration. Expired sessions/codes can be removed only after their replay-prevention tombstones and abuse/audit requirements are satisfied. Schedule bounded incremental deletion with observability, idempotent retries and verification that no active account, key reference, receipt or restore point is orphaned. Deletion/privacy requests require school-owner authorization, verified subject scope, and a documented treatment of retained backups.

## Resource budgets, rate limits and alarms

Before external spend, require a named monthly **hard cost ceiling** approved by Grant and an owner for billing alerts and shutdown; avoid invented provider prices. Set staging request caps, per-membership/class/tenant concurrency quotas and maximum command/body lengths. Track database connections, CPU, storage/WAL growth, backup objects, restore success, HTTP 429/5xx, invalid assertions, queue age and game command latency. Start with 35 distinct concurrent synthetic clients as an acceptance floor, then size capacity from measured p95/p99 and timeout/retry behavior. Throttle new game work before consuming classroom resources; protect logout/revocation even when quotas are saturated. Disable optional expensive features rather than endanger durability or school operations.

## Release gates and evidence register

| Gate | Evidence required | State now |
| --- | --- | --- |
| Approvals | Provider/region/cost cap/privacy, named operators, restore-key escrow | PENDING |
| Isolation | Independent game host, Postgres, identity scopes and network ACLs | NOT PROVISIONED |
| Source | PRs #226–229 reviewed with native/protected checks; staged dependency order | REVIEW BRANCHES; NOT MERGED |
| School access | Reviewed Batch05 source publication authorization, private issuer, real Chrome/Workspace bridge | BLOCKED / NOT DEPLOYED |
| Recovery | Encrypted restore of source-slot identity, revision/event/receipt history, 35 independent clients, fault injection | PROPOSED; NOT EXECUTED |
| Player reality | Cross-device synthetic staging and actual school Chromebooks without real student imports | NOT VERIFIED |
| Release | Independent deploy ID/site SHA/Apps Script version and classroom smoke | NOT RELEASED |

**Integrator handoff:** Codex reviews this design and agrees on operators, hosting topology, database roles, real retention/RPO/RTO, cost cap, restore keys and exact test automation before any change to shared contracts/service files. This document should not be cited as evidence of a hosted game, database backup or playable Checklings expansion.
