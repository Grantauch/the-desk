# Checklings Living World — Integration Handoff (2026-10-22)

**Owner:** ChatGPT. **Status:** isolated prototype; not integrated, merged, deployed or classroom-verified.

## Source and local verification

- `apps/checklings-world/living-world.cjs`: pure CommonJS engine; no PIN, attendance, gradebook, browser storage, or network dependencies.
- `apps/checklings-world/living-world.test.cjs`: 14 synthetic deterministic tests (see latest native suite below).
- Run: `node --test apps/checklings-world/living-world.test.cjs`
- Identical copies of these two files passed 11/11 tests locally in Node before upload. The GitHub branch has not passed protected CI yet.

## October 23 follow-up: no-op revision correctness (native 49/49)

A reviewer found that capped care requests, duplicate check-ins/quest claims and already-owned craft requests were incrementing the stored member revision even when they changed nothing. `change()` now distinguishes a genuinely modified serialized state from an unchanged one and preserves the original revision for true no-ops. **Official school-day rollover, changed care values and verified streak/stage advancement still persist and increment the revision**; avoiding a revision does not imply an arbitrary database store callback performs no physical write.

Five new tests cover 100 rejected actions, duplicate reward/claim/craft, unnecessary basic-care attempts, a real day rollover on a no-op, and a genuine streak promotion without a daily reward. On exact committed GitHub blobs, Node v22.16.0 ran `node --test apps/checklings-world/*.test.cjs` => **49/49 PASS, 0 failed** (11 raid, 14 living-world, **24 progression**).

- Updated progression source blob: `36b2e3904c6300d1159b7945b912c8063957c8c3`
- Updated progression test blob: `cece5342a686c998798fcf0dd71e653272131277`
- Other four source/test blobs remain unchanged from the 44-case verification below.
- This is a synthetic, unmerged prototype. The real game must use explicit transactional no-op/idempotency semantics in its reviewed PostgreSQL adapter. No school PIN, Hall Pass, classroom, student record, production build or active session is modified here.

## October 23 independent native Node verification — exact PR source

**Result: 44/44 passed, 0 failed, 0 skipped** on **Node v22.16.0**, run with `node --test apps/checklings-world/*.test.cjs` against all six files extracted from PR #223 head `33a42871cb0d7ec7a5374a5d0afa92c23007ebcc`. **Every file's Git blob SHA was verified** before execution. This supersedes earlier V8 shim-only evidence for these exact 44 cases; the earlier historical notes below are retained for traceability. 

| Suite | Passed | Source Git blob | Test Git blob |
| --- | ---: | --- | --- |
| Living world + home aliases | 14/14 | `8976e4e713426f8856dcfbae79dcefc61fe17a52` | `bc1e5867756d5ac6454fd61549c7387fae16ffa1` |
| Care + progression + crate replay | 19/19 | `f068ef459e5e22adff241ec0338eab57559c9591` | `9d11c3dd8dc48ecc9f4c9d91cd5473b8510ab071` |
| Raid and knockouts | 11/11 | `768f7e06129a52f5d9773573db20fa33e8ca9f1e` | `f7c62be791f001e9025d1ba4f645c005ef19d0e0` |

Full unmodified TAP output and the exact verified source snapshot are in `checklings_PR223_native_44_pass_QA.zip` (independent QA artifact, linked in PR discussion/team board). No real database/service, browser, classroom Chromebook, teacher feature flag, production authentication, or live release has been verified. Source remains an **unmerged, undeployed prototype**, and this passing suite does not unblock Batch05 or the separate CK-MP-IMPL/CK-CARE-IMPL gates.

## October 23 follow-up: isolated raid correctness hardening

- `rooms.cjs` no longer stalls on a knocked-out active seat. It advances to the next surviving participant and resolves one boss action per full round of living teammates. Ordinary `encourage` cannot revive a zero-HP knockout.
- The in-room, **non-authoritative display journal** retains at most the latest **32 moves** (only eight in player views). Long support-only raids cannot grow the stored display array indefinitely. This does **not** substitute for a durable, append-only authoritative event ledger in a future game service.
- `rooms.test.cjs` now has **11** synthetic tests, including four KO/cadence regressions and a 240-move bounded-history stress case. Exact source and committed tests passed **11/11** in an isolated V8 harness with Node-test/crypto/Buffer/in-memory-store stand-ins; a native Node run, protected CI, 35 separate PostgreSQL clients and two-device classroom tests remain unverified by that harness.
- None of this prototype is an implemented release of the blocked multiplayer milestone. Real ownership, class authorization, turn receipts, crash-safe settlement and teacher gating remain implementation tasks after approval.

## October 23 essential-care and crate-retry safeguards (isolated prototype)

The original progression module incorrectly made all care depend on a verified **school day** and stopped meal/rest/bath actions after the daily reward budget. `care()` now always offers a **free basic recovery floor of 45** for hunger, energy, or cleanliness when school is closed or the rewarded action cap is exhausted; no bond, quest, dust, or crate is minted from this fallback. Optional play/study/treat remain school-day/budget gated. Recovery is limited to the needed vital, never an unlimited resource farm. This is not a permanent-death or illness engine; final welfare rules belong to CK-CARE-001 and tested school integration.

`open()` now requires a bounded member-scoped idempotency `commandId` (8–128 alphanumeric/`_`/`-`) along with expected revision. It persists the last 64 settled crate-opening receipts in this **synthetic prototype member record** so lost acknowledgements can return the originally rolled item/response without spending another crate. Reusing a command ID with a different revision rejects; a fresh stale command rejects; previous receipts can be re-read after the school-day gate closes, but a fresh roll is refused. Truncation protects stored-record size: a retry older than 64 openings may return `Stale request`, but must never reroll or grant again. The actual game must use its authoritative `ck_command_receipts` table, not copy this in-memory/member-state ledger as a production schema.

`progression.test.cjs` has **19** committed tests, including seven newly written/updated care and crate regression scenarios. All **19/19** passed when executing the exact GitHub JS source and test text in an isolated V8 harness with Node-crypto/test/Buffer/store shims. This is not a native Node run, a database restore, a secured session, or a school Chromebook validation. No existing check-in/attendance/PIN source or deployed game was changed. The previous two-argument `open(token,revision)` prototype signature now rejects by design; no actual player-facing client uses this prototype module.

## October 23 sky-home compatibility

The authoritative legacy home ID is `sky`, not `cloud`. Earlier prototype scenery keyed Cloud Island under `cloud` and would reject a migrated original pet's valid `sky` home. The living-world observer now accepts **`sky` as canonical**, with `cloud` retained only as a compatibility alias; both hash to the same scene/event key and the observer returns `habitat:'sky'`. `living-world.test.cjs` now contains 14 tests, including valid legacy sky behavior, alias/reload equality and an exactly-five-homes registry check (14/14 in exact-source isolated JS harness). The exported registry exposes `meadow`, `grove`, `cove`, `sky`, `cosmos` only, even though an old caller may still request `cloud`. No migrated school data, attendance, home entitlement, live page, or authoritative service was changed. Native Node and real Chromebook tests remain future integration gates.

## Features built

- Four temperament-specific personalities and greeting banks.
- Five biomes, three visitors and three weather conditions each, plus four season identifiers.
- Stable daily world event IDs, visitors and weather selected by opaque seeded deterministic hashing. Presentation changes across morning, afternoon, evening and night without randomly rewriting the day's events.
- Five nonlethal care vitals: hunger, joy, energy, clean and focus.
- Seven care actions with limits of four effective actions per school day, at most two of one action, and no currency minting in the engine.
- Authoritative school-day ordinal input means weekends and school closures can be excluded by the existing backend.
- Offline vital decay capped at three school days; no pet death, progress loss or bond reset.
- Scene response provides mood, suggested care, expression, animation hint and greeting for a future visual renderer.
- Small versioned state and input validation. Do **not** trust client-supplied state in production.

## Findings reviewing Gemini v5 HTML and AI Team Board

The supplied 5,071-line studio is a demonstration, not a deployed four-student multiplayer system. It saves a browser-local demo snapshot under `the_desk_checklings_v2_state`. Its battle code accepts untrusted combat loadouts. Its `GFT-` postcard codes use an unkeyed 12-bit FNV-style checksum, so anybody can fabricate them, redeem the same code repeatedly and create cosmetic items or 35 Star Dust each time. The `CHK-` code is not authenticated. The quest UI offers `Complete & Claim` for unearned tasks and includes an instant grand chest override. The AI Team Board reports Phase 4 source and the Gemini Phase 5 setup, but its Drive archive/doc folder links returned not found/permission denied from this connection. The complete HTML was supplied in chat, so these findings are source-grounded.

**Do not deploy Gemini's prototype rewards, gift codes, loot or battle claims directly against student accounts.** Reserve reward minting for authenticated backend actions, with a transaction/claim ID and an idempotent redemption ledger, and validate item ownership and transfer rights. Never put student keys, PINs, names or public deterministic hashes of them in challenge codes.

## Safe integration order

1. Finish and deploy the separately merged startup repair PR #221 using the existing protected Apps Script bridge and verify the four authenticated entry modes; preserve the existing stable deployment URL, access settings and five deployment files.
2. Add production persistence for world state behind a versioned backend API with strict membership-session checking, server-owned seed, server-computed school calendar and bounded write rate. Existing `checkling-v1:` preferences remain valid. Do not infer a 256-character service storage limit: assess actual PropertiesService quotas and aggregate usage. Avoid storing student data in public client saves.
3. Wire this engine as an opt-in companion view. On shared kiosks retain 10-second unattended handoff, two-minute hard reset, explicit next student, and stale-response rejection. Verify test students only.
4. Keep rewards disabled pending secure server-side claim and anti-replay implementation, with reward economy tests.
5. Deliver the co-op/world village with a real authenticated room/session service or plainly label it pass-and-play/simulated. Moderate shared names and messages and provide teacher controls and noncompetitive cozy play.
6. Integrate only after canonical `npm run verify`, protected browser/CI and privacy checks pass. GitHub merging and production Apps Script deployment are separate gates.

## Next phase proposed for AI colleagues

Real-life world persistence + time and season renderer, not another inflated list of unverified features. Students should see evolving micro-stories, earned decoration placement, relationship and environment changes without punishments for absence or endless task farming.

No existing Apps Script, Netlify, attendance, hall-pass or teacher dashboard files were modified in this branch.
