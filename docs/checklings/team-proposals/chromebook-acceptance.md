# Checklings — classroom and Chromebook acceptance matrix

**Work item:** CK-QA-001 · **Status:** review proposal, not a release approval · **Owner:** ChatGPT Personal (QA-20261023-1729) · **Baseline:** 89f4502966ec1bca9bd6ce093c8f90b8d2f906a2

This is an executable test plan for the first **12 complete species** pilot. It is not a record that tests have been run. The known October 23 source baseline contains reviewed but unmerged Outputs 01–04; Batch05 school PIN bridge is locally tested and **not published or deployed**. Keep the production Daily Check-In/Hall Pass and its private records untouched. Do not run destructive or load tests against a real classroom tenant.

## 1. Evidence ladder and pass accounting

| Level | Name | What counts | What never counts |
| --- | --- | --- | --- |
| S0 | SOURCE | Static review, reproducible unit/integration command, exact SHA, assertions and full stdout/stderr or CI URL | A draft/specification, screenshot, or claim from another agent |
| S1 | HOSTED_SYNTHETIC | Isolated staging host and database; independent synthetic school identities; verified server/log/DB outcomes; timestamps and request IDs | Local mock pretending to be a deployment; production check-in endpoints |
| S2 | SCHOOL_DEVICE | Real district Chromebook model/ChromeOS/browser, school network, teacher supervision, synthetic or separately consented test identity, timestamp and screen evidence | Local Chrome emulation or a personal laptop |
| S3 | STUDENT_PILOT | Authorized small-group observed sessions, deidentified feedback and failure counts; no student records on a shared report | An AI-operated browser or a load-test account |

Use **PASS / FAIL / BLOCKED / NOT_RUN** per case **per applicable level**. Never roll up missing S2/S3 evidence into an overall PASS. Each entry logs version, test ID, environment, anonymized actor IDs, command or steps, expected vs actual, log/screenshot reference, date/time, defect issue and reviewer. Protect private test evidence outside the public repository. No real names, PINs, emails, grades, rosters, raw assertion tokens, or identifiable screenshots.

**Proposed launch decision:** any failed safety/privacy/isolation or save-integrity case blocks student rollout. A failed S2 accessibility case blocks the school-device pilot. S3 cannot be claimed until a real, authorized student session occurred. Code correctness, staging readiness, verified Chromebook readiness, and classroom pilot readiness are separate gates.

## 2. Minimum environment setup

1. Pin exact service, web, schema, content and Apps Script version/commit; record which are actually deployed. Do not imply GitHub PR equals production.
2. Use a separate game staging host, disposable DB and 35+ synthetic accounts in at least two synthetic classes, with two different synthetic teacher roles. Never reuse production Hall Pass credentials or data.
3. Use controlled clocks for lease expiry, weekend, school closure and outage cases. Document timezone and time source; do not silently manipulate production time.
4. Matrix must cover: current Chrome desktop, school Chromebook on Wi-Fi, phone viewport for companion-only activities if supported, high-latency profile, screen reader/keyboard/reduced-motion, and 35 concurrent clients.
5. Start with four migrated founders; exercise all 12 only after their species/art/play loops are implemented. Label features **NOT_IMPLEMENTED** rather than pretending a missing feature passed.
6. For service tests, capture before-and-after authoritative DB records (sanitized), command IDs, event counts, idempotency receipts and error responses.

## 3. Functional and safety acceptance cases

An "action" below is performed by a synthetic identity unless S2/S3 is explicitly required. In each case, the decisive assertion is against server state, not visual feedback alone.

| ID | Level | Exercise / reproduction | Required observable outcome |
| --- | --- | --- | --- |
| CKQ-001 | S0/S1 | Verify feature flag off and launch game with no valid school assertion | Existing check-in/pass remains usable; game session not issued; no game data mutation |
| CKQ-002 | S1/S2 | Enter with verified class A account, refresh and reopen top-level Chrome tab | Exact synthetic membership binds to game identity; no PIN/session secret in URL or client logs |
| CKQ-003 | S1/S2 | Log out A on shared Chromebook; immediately launch B and use Back, tab restore and cache | No A creature, nickname, home, saved state or token visible to B; server rejects A's revoked session |
| CKQ-004 | S1/S2 | Open same identity on two devices; edit pet/home state; refresh both | Both converge to one committed revision; stale response cannot overwrite newer state |
| CKQ-005 | S1 | Replay or exchange browser-bound launch ticket across browsers/sessions | One-use ticket accepted at most once; replay and wrong browser fail closed without leaking identity |
| CKQ-006 | S1 | Expire game lease and submit a previously prepared mutation | Server rejects stale lease; no write; reauthorization requires valid issuer policy |
| CKQ-007 | S1/S2 | Teacher pauses class while students are active and one device is offline | Paused class cannot start/commit new game actions; retry after reconnect cannot bypass pause |
| CKQ-008 | S1 | Teacher resumes only class A while class B remains paused | Only A regains actions; no cross-class effect |
| CKQ-009 | S1 | Present valid identity token but wrong class or wrong teacher scope | Access denied; no cross-class pet observation or mutation |
| CKQ-010 | S0/S1 | Inject malformed or missing roster snapshot; attempt renewal | Reject/hold safe state; no broadened authorization or fallback to unverified class |
| CKQ-011 | S1 | Deactivate a member while existing tabs remain open | Current leases and subsequent commands stop within the documented bound; no silent renewal |
| CKQ-012 | S1 | Send CSRF-less request, disallowed origin, oversized body and forged mutation actor | All refused with stable error codes; 0 committed game events |
| CKQ-013 | S0/S1 | Search app/API/log output for PIN, names, teacher credentials and sensitive school data | No secret/private identity exposure in game logs, public repo, staging artifacts or network URL |
| CKQ-014 | S1/S2 | Save pet, disconnect immediately after server commit but before response, retry same command | Exactly one state transition and receipt; client recovers committed result |
| CKQ-015 | S1 | Submit identical care action from two tabs simultaneously with the same command ID | Exactly one treatment/reward; duplicate returns same or clearly safe idempotent result |
| CKQ-016 | S1/S2 | Load existing founder twice via import and re-open after restart | Founder ID/name, legitimate keepsakes, home and progress preserved; no duplicate pet or overwrite |
| CKQ-017 | S1 | Import incomplete/invalid legacy state; service crashes mid-import | Atomic rollback or resumable fence; existing daily check-in and legacy pet remain intact |
| CKQ-018 | S1 | Submit forged client reward, battle victory, capture and ownership fields | Server ignores/rejects unverifiable outcomes; no currency/item/species inflation |
| CKQ-019 | S1/S2 | Lose network for 2 minutes during care, edit several controls, reconnect | Clear offline messaging; no fake success; queued action either commits once or is explicitly recoverable |
| CKQ-020 | S1 | Restart DB/service during accepted but unsettled action; replay command | No partial double settlement; committed events reconcile after restart |
| CKQ-021 | S1 | Game service down while synthetic check-in/pass/attendance endpoints receive normal traffic | Classroom endpoints remain independent; no game outage creates/checks/changes a school record |
| CKQ-022 | S1 | Simulate weekend, holiday, seven inactive days, school closure and outage | No lethal warning timer or irreversible state transition caused by absence alone |
| CKQ-023 | S1/S2 | Active sustained neglect with server-logged warning and rescue window | Warning visible/accessibly narrated; sufficient opportunity for a no-cost intervention before any lethal decision |
| CKQ-024 | S1 | Rescue with zero virtual currency while ill/exhausted | Free essential rescue succeeds; monetization or poverty cannot trap a pet |
| CKQ-025 | S1 | Danger-tagged PvE encounter: deliberately accept risk, then retreat in available window | Risk and consequence clearly displayed; retreat behavior deterministic and persisted |
| CKQ-026 | S1 | Same dangerous PvE encounter with legitimate final consequence | Death and memorial recorded exactly once; no resurrection on reconnect; ancestry and account Encyclopedia preserved |
| CKQ-027 | S1/S2 | Ordinary PvP defeat, disconnect and rematch | Never permanent death; battle HP/KO distinct from lasting injury and care vitals |
| CKQ-028 | S1 | Repeated unusual clock/lease/network events during a pending warning | Warning time cannot be consumed by outage; no early death from retries or tab suspension |
| CKQ-029 | S1/S2 | Complete keeper-only route: care, observe, craft/decorate, discover, exhibit | Persisted discovery, meaningful unlock and development milestone without a battle win |
| CKQ-030 | S1/S2 | Complete battler route with deliberate counters, recover/defend and switching | Server-legal actions and resource choices change results; full retry/return path after defeat |
| CKQ-031 | S2/S3 | Matched-duration keeper and battler playtests; compare goal access, progress and satisfaction | Comparable creature, habitat and milestone access; no required combat for essential keeper progression; record observations separately |
| CKQ-032 | S0/S1/S2 | Inspect first 12 species in home, discovery and combat | 12 **original base** silhouettes/roles/ecologies/care identities and optimized art; evolutions/recolors are not new base species |
| CKQ-033 | S1 | Capture same encounter from racing requests/accounts | Exactly-once ownership transition with authoritative random draw and audit event |
| CKQ-034 | S1 | Two authenticated student simulations join class duel/co-op on different devices | Genuine independent sessions, teacher scope, legal turn order, real shared result; no bot mislabeled as student |
| CKQ-035 | S1 | Opponent closes tab, reconnects or never returns during battle | Defined timeout/forfeit/recovery; no permanent dead-seat stall or duplicate reward |
| CKQ-036 | S1 | Teacher closes or pauses session mid-duel and then recovers | All parties see consistent session state; no cross-class join or continuing behind pause |
| CKQ-037 | S2 | Navigate all core features using keyboard only, including menus, battle, rescue, confirmation | Visible focus, logical order, operable controls and no keyboard trap |
| CKQ-038 | S2 | Enable screen reader; read creature conditions, warning, risk, timers and Turn/Save feedback | Every consequential state conveyed in text; no solely color/sound/animation warning |
| CKQ-039 | S2 | Enable reduced motion and low power; revisit all 12 species and battle | No essential information requires animation; no flashing or uncontrolled motion; stills retain information |
| CKQ-040 | S2 | Use 320/390 px equivalent layout and school Chromebook native resolution at 100/200% zoom | No clipped controls, horizontal trap or unreachable rescue/teacher control; readable type/contrast |
| CKQ-041 | S1/S2 | Break/miss an image/audio/atlas file, reload with cache cleared | Fallback art/text state; UI still explains vitals/battle; saves unaffected |
| CKQ-042 | S1 | Simulate 35 clients logging in, viewing home, caring and saving concurrently for 20 minutes | No cross-account leak, duplicate pet/reward, event loss or unhandled server error; publish latency/error measurements |
| CKQ-043 | S2 | Run 20-minute session on lowest available representative school Chromebook and actual school Wi-Fi | Record hardware/ChromeOS, memory, battery/heat observations, task timing, input delay and any navigation stalls |
| CKQ-044 | S1/S2 | Throttle/reconnect network repeatedly while switching tabs and locking lid | Recoverable state with authoritative revision and actionable errors; game outage never blocks check-in |
| CKQ-045 | S1/S2 | Teacher disables feature flag / starts rollback during an active session | Game actions close safely; legacy school processes continue; persisted pet/event records remain recoverable |
| CKQ-046 | S1 | Recover from encrypted staging backup including identity mapping, revision and events | Imported accounts, pets, warning clocks, command receipts and memorial counts match pre-backup manifest |
| CKQ-047 | S2/S3 | Ask representative readers to locate "how to rescue," "how to quit," and "how to save" unaided | Key actions understood; misread terms and dead ends logged and fixed before expansion |
| CKQ-048 | S0/S1/S2 | Compare all observed functionality to milestone labels and release notes | Claims explicitly distinguish designed, implemented, staging, production and student-verified behavior |

## 4. Performance profile and budgets

**Do not invent passing measurements.** Before piloting, record a representative Chromebook baseline and approve targets with the integration owner. Suggested initial targets for discussion, not evidence: home usable p95 <= 4 s after valid launch on school Wi-Fi; normal UI interaction response p95 <= 100 ms excluding server wait; save acknowledgment p95 <= 2 s on staging at 35 concurrent synthetic clients; 0 authorization leaks, irreversible loss, or duplicated settlements. Report p50/p95/p99 for launch, mutations, autosave and battle turns, plus error counts and peak memory. Compare idle tab vs loaded game and reduced-motion state. Record actual timeouts and network shaping.

Do not force a 35-student load test against the school's live Apps Script or private Drive infrastructure. Load the independent game staging service with synthetic signed fixtures. Run classroom S2 performance separately and only with administrative/teacher permission.

## 5. Release gates and stop conditions

| Gate | Required before proceeding | Stop immediately when |
| --- | --- | --- |
| G0 — review | CK-INT-001 school bridge publication approval resolved separately; pinned contracts and isolated staging owner known | No safe branch, missing version, or competing writer of a reserved file |
| G1 — source | Applicable S0 tests green at exact commits; contracts accepted; no private files/keys in diff | Unexpected school-system diff, leak, failed high-severity checks |
| G2 — synthetic staging | S1 auth, isolation, data-integrity, crash/retry, recovery, PvP and rescue cases PASS; backout proven | Any unauthorized action, duplicate settlement, school disruption or unreviewed schema change |
| G3 — real Chromebook | S2 verified on district hardware/network for relevant implemented features; critical accessibility/rescue flows PASS | Identifiability leak, lost pet/progress, blocked essential rescue or inaccessible warning |
| G4 — pilot | Authorized supervised S3 session with deidentified findings; teacher freeze/rollback available; open failures triaged | Any unexpected irreversible death, unsafe account swap, or classroom-interfering failure |
| G5 — expand | All **12** base species and both playstyles demonstrate actual complete loops, art, state and school-device stability | Only a synthetic prototype, recolors counted as species, or missing 12-species gate |

The G0 publication approval requirement applies to the separate Batch05 source, not permission to bypass its recorded block by implementing this checklist. All S2 and S3 work remains **NOT_RUN** until independently conducted. Nothing here authorizes deployment, real-student account access, purchase or hardware exposure.

## 6. Test record template

Use one row per test × environment (store private raw evidence elsewhere):

    Test_ID | Source_SHA | Service_version | Apps_Script_version | Environment_level
    Browser_and_device | Synthetic_class_ID | Steps_or_command | Expected
    Actual | PASS/FAIL/BLOCKED/NOT_RUN | Latency_p50_p95 | Sanitized_log_ref
    Screenshot_or_a11y_ref | Defect_link | Timestamp_ET | Independent_reviewer

Each identified defect needs severity (blocker/high/medium/low), replication steps, the last known good version, responsible owner and one independent retest. If a feature has not been built, status is BLOCKED (NOT_IMPLEMENTED), not a misleading FAIL or PASS.

## 7. Ready-to-run first verification sequence

For the next integration owner: (1) pin exact merged/tested source and stage endpoints, (2) establish disposable synthetic identities, (3) automate CKQ-001–020 plus CKQ-021/022/024/026/027/033/035/036/042/045/046 as features actually become available, (4) open distinct defects, (5) perform rollback and backup recovery, (6) schedule independent CKQ-003/004/007/019/029/030/037–044/047 on real district devices, and (7) capture supervised S3 parity feedback only after G3 passes.

**Handoff:** Proposed matrix only; **no tests executed and no new Checklings runtime shipped by this file**. Coordinator/reviewer should approve thresholds, stage ownership, privacy boundaries and exact gate-to-task mappings. Related tasks: CK-INT-001, CK-OPS-001, CK-CARE-001, CK-BEH-003 and CK-PILOT-012.
