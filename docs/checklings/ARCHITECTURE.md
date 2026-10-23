# Checklings technical architecture

Status: implementation decision for the first playable version. Infrastructure and authentication bridge are not provisioned or deployed by Batch 01.

## Deployment boundaries

| Boundary | Authority | Deployment | Failure behavior |
|---|---|---|---|
| Existing Hall Pass / Daily Check-In Apps Script | School-account/PIN verification, active class membership, official calendar, attendance, points, streak | Five-file source, guarded new version on existing `/exec` | Never awaits a game request while committing attendance or pass actions |
| Existing grant-desk.com Netlify site | Public launch links and optimized artwork | Main branch site build | Missing game art/link cannot affect classroom records |
| Separate Checklings service and origin | Game sessions, creatures, commands, encounters, battles, rewards and memorials | Independent Netlify project, Node functions, independent game releases | Offline/read-only notice; no fabricated save success; no lethal clock progress during outage |
| Dedicated managed PostgreSQL database | Durable game state, constraints, transactions, event and idempotency ledgers | Separate game database and credentials | No access to attendance workbook; rollback incomplete game transactions |
| Private identity bridge | Maps verified membership to opaque game tenant/class/member identifiers | Small separately reviewed Apps Script integration plus private broker | Optional launch fails; existing PIN check-in/pass still works |

Select a dedicated Node service with PostgreSQL transactions. Use a separate Netlify project so game load, deploy configuration and credentials do not sit in the production site's functions. No database provider, paid plan, domain or credential has been created. Provisioning must first establish owner, cost cap, approved student-data location, backup retention and restore access. Do not reuse a classroom game's anonymous Firebase room store or an undeployed schoolwide application as identity authority.

This is a design choice based on the need for atomic multi-creature battles, item settlement, imports and permanent death. Google currently documents 9 KB per property value and 500 KB per property store. The small existing preference format is appropriate for a bounded preference, but growing game history would compete with classroom service storage and execution quotas. The existing test's 256-character assertion describes its current payload size, not a Google service limit. [Google quotas](https://developers.google.com/apps-script/guides/services/quotas).

## Authentication and shared Chromebooks

Never forward the existing Hall Pass PIN or signed Hall Pass session to Netlify. Retain existing school-account/PIN checks. A typed name, invite code, class parameter, browser save or claimed student ID cannot establish identity.

Proposed launch protocol to implement and test in staging:

1. Open the game as a top-level page. The game server creates a 60-second launch flow, a cryptographic state value and PKCE-style challenge, with a private server-side verifier bound to a host-only secure HttpOnly flow cookie. No student identity is present yet.
2. The student deliberately follows the verified Apps Script launch path, enters the existing PIN there, chooses their own class where necessary and confirms opening that class's game. No attendance proof is issued. Only allow a game-server-signed, unexpired launch flow with the configured audience and fixed callback origin. Do not accept arbitrary return URLs.
3. Apps Script privately sends an HMAC-authenticated assertion to the broker over HTTPS: opaque tenant/class/member IDs, auth epoch, flow/challenge, issued/expiry times and random single-use assertion ID. Separate signing key from the Hall Pass session secret. No PIN, real name, email or attendance workbook identifier is sent. The game does not gain school workbook access. Replay assertions are rejected transactionally.
4. Broker issues a random one-use code bound to that exact launch flow and challenge. Return through a user-activated top-level link to a fixed minimal callback page, with code/state in a URL fragment. The callback immediately clears the fragment and POSTs them to its own origin. No analytics, third-party assets or referrers on the callback. Never put PINs or Hall Pass tokens in a URL. The short-lived launch code is still a credential and must not be logged or persisted in client storage.
5. The game server checks the flow cookie, state, audience, time, challenge and one-use code in a transaction, consumes the code, and issues an opaque secure HttpOnly SameSite session cookie. Store only the session token hash. Rotate session identity on login; reject cookie fixation and cross-origin mutation requests. Every mutation checks session, active membership, tenant, classroom, ownership, feature settings, command schema and expected revision.
6. Use a separate game session: 2-minute idle expiry and 15-minute absolute maximum for the first slice, server enforced; intentional activity resets only idle expiry. Longer play requires fresh school verification. Existing shared check-in screen keeps its ten-second unattended handoff and two-minute inactivity behavior. Done/Next student immediately revokes the game session and clears rendered private state; stale async responses cannot repaint the next student's screen. No bearer token, PIN or student save in localStorage.

The top-level flow avoids depending on third-party cookies in the Apps Script iframe. Its callback, fragment handling, navigation permission and school Workspace restrictions still require real Chrome/Chromebook testing. [Batch 03](BATCH-03-AUTH.md) implements the internal SQL-backed launch broker, assertion verification, one-use exchange, session expiry and logout with synthetic tests. The school-side issuer, HTTP/cookie/CSRF adapter and shared-device UI remain unimplemented. Database membership/epoch checks work locally; school roster propagation is not implemented. Ordinary sessions last at most fifteen minutes. Privileged actions and multiplayer joining will require fresh bridge validity; a separate teacher role and revocation interface are still required. Do not claim immediate roster-deactivation propagation or usable school login from broker tests.

Teacher commands require a separate server-verified teacher role issued by the school bridge. A student session or client-supplied role cannot change class settings, revoke others, repair records or enable lethal gameplay. Scope every teacher action to its authorized classes and record consequential actions in an audit ledger.

Security tests: forged/expired/wrong-audience assertion, replay, stolen code without flow cookie, swapped state/class, wrong challenge, empty membership, duplicate exchange, CSRF, expired/revoked session, PIN rotation, roster deactivation, two tabs, late response after Done, and blocked third-party cookies. Use approved synthetic identities; never real student PINs.

## Persistent tables and transaction contract

`contracts.ts` defines the creature, species, battle, progression, session, death record, Encyclopedia and event views. It is a compile-checked design contract, not a runtime validator. Command handlers need strict schemas and bounds. Version content/rules separately from saved-instance schema.

| Table | Key constraints / purpose |
|---|---|
| game_memberships | Opaque tenant/class/member; unique private bridge mapping; active/auth epoch |
| game_sessions, launch_flows, launch_assertions | Hashed tokens/codes, expiry/revocation, unique consumed assertion ID |
| species_catalog | Immutable species ID + catalog version; base ID distinct from evolved form ID |
| creatures | Unique instance ID and nullable unique legacy source slot; owner membership FK; lifecycle/revision checks |
| legacy_imports | Unique tenant/source slot, fingerprint, import event, private backup reference |
| progression, inventory | Membership-owned aggregate; nonnegative balances; unique member/item ownership |
| command_receipts | Unique member + command ID; payload hash and stored response; different payload reuse rejected |
| game_events | Append-only event ID, actor, aggregate revision, rules version, timestamp and minimal private payload |
| battles, battle_units | Frozen team/owned instances and content version; active creature locks; unique settlement event |
| discoveries, achievements | Unique member/species or achievement claim; rebuilt safe Encyclopedia views |
| lineage_edges | Persistent parent/child links; no cycles, parent IDs distinct; dead ancestors remain resolvable |
| death_records | Exactly one finalized death per creature; warning/consent/rescue event references; memorial snapshot |
| teacher_settings | Per-class battle/co-op/breeding/lethal/humor flags; pause and revoke controls |

Each command: authenticate → validate payload → begin transaction → claim idempotency key → lock all affected aggregates in stable ID order → check revisions/ownership/rules → compute effects with server RNG → persist state + event + receipt + any settlement → commit → acknowledge saved. Crash before commit leaves no changes; timeout after commit returns the original receipt on retry. Random rewards and encounters are sampled and recorded once per committed command. Do not reroll a settled result or accept client HP, damage, rewards, timestamps or match outcomes.

Use row locks for aggregates and explicit unique constraints for claims/imports/settlements. Cross-aggregate invariants require a serializable transaction or an equally demonstrated locking strategy. Retry the entire aborted transaction on recognized serialization/deadlock errors, with a bounded budget and unchanged command identity. A Map-based store is insufficient evidence. [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html).

Before applying a battle turn, lock battle and creature records and verify every unit remains alive, owned, eligible and not in another match/expedition/breeding action. Skip knocked-out seats; end when no legal next turn exists. Settlement atomically applies injuries, rewards, deaths when allowed, memorial entries and Encyclopedia changes exactly once. Multiplayer snapshots disclose only participant-safe aliases and battle state.

## Care, danger and permanent death

Care values use one direction: 100 is healthy. Store nutrition, happiness, energy, cleanliness and focus; derive plain-language hunger/exhaustion displays. Illness, injuries, friendship, personal development and ancestry are separate state.

Accepted later scope: [body condition, exercise and localized battle scars](BODY-CONDITION-AND-SCARS.md). Use additive versioned state migrations and consequential events so these can be introduced after core care/combat without resetting existing pets. Do not equate immediate satiety with long-term body condition or invent historical feeding/wounds during import. Current schema v2 is unchanged; no weight or scar simulation is active.

Preserve the founder's official best streak and earned habitats as a legacy achievement. Game XP, care and team strength are a separate system. Attendance can provide a verified one-time welcome cosmetic later; nurturing, discovery, crafting and exploration must offer equivalent access without perfect attendance. No game command can edit school points or attendance.

Offline decay may lower bounded care values, but cannot commit death. Repeated logins cannot multiply a capped absence calculation: record a continuous absence interval, last authoritative accrual time and applied cap. Closures and weekends use the verified calendar. Danger timers pause on disconnect, outage, teacher freeze and inactivity; wall-clock catch-up never consumes rescue opportunities.

Candidate first-slice neglect rule: a critical creature gets a persistent specific warning and at least three deliberate opportunities to take freely available rescue actions. Only explicit continued risky activity after warning may consume those opportunities. Merely opening, reading, closing, refreshing, losing a session or going offline consumes none. These numbers are tuning candidates. Essential food, rest and treatment cannot be blocked by daily reward caps or currency poverty. Limit XP/reward farming separately from rescue care. A healthy return is always possible before the final irreversible action.

Optional lethal PvE requires the teacher lethal flag, healthy-enough eligibility, plain-language risk confirmation bound to that expedition/creature/rules version, and an available retreat/rescue choice before the final risky step. Disconnect pauses or safely suspends the encounter without a lethal timer. Ordinary PvP is nonlethal. Do not infer consent from a general login or a prior expedition.

`mayCommitDeath` tests an admission policy only. The eventual service must derive its facts from persisted events and atomically record `critical → dead`, remove the individual from playable teams, write its Memorial Grove snapshot and preserve lineage/achievements. No public gameplay command reverses death. Bug corrections require a teacher/admin audit event with before/after state and cause. Epitaphs come from reviewed templates, are teacher configurable and do not mock a real student or real loss.

## Isolation, operations and release gates

The initial bridge is user-triggered. Do not add per-turn UrlFetch calls, game polling, game triggers or game locks to Apps Script. Do not invoke game code from attendance/pass commit paths. Game assets must lazy-load after classroom confirmation or in the independent game origin. Production secrets have separate scopes; public catalog contains no student information. Preview credentials can only reach synthetic/staging databases.

Required before pilot: SQL migration + real transaction tests; encrypted backups + restore drill; all flags default off; clear teacher pause/kill switch; redacted request/error logs; no secret/session/pet-name payloads in analytics; command latency/error and database resource monitoring; low-frequency event-driven/polling multiplayer first; rate limits per verified member/class and IP with classroom-NAT tolerance; operational data retention policy preserving game legacies while allowing authorized account deletion.

Proposed initial performance gates: 35 simultaneous synthetic students, under 2 seconds p95 for ordinary committed commands at that load, responsive keyboard navigation and animations on an actual school Chromebook, no unbounded journals or background simulation loops. These are targets, not measured results. Record hardware, browser, network conditions and observed timings. A synthetic load test cannot establish school-device performance or student usability.
