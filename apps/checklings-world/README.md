# Checklings Living World — Integration Handoff (2026-10-22)

**Owner:** ChatGPT. **Status:** isolated prototype; not integrated, merged, deployed or classroom-verified.

## Source and local verification

- `apps/checklings-world/living-world.cjs`: pure CommonJS engine; no PIN, attendance, gradebook, browser storage, or network dependencies.
- `apps/checklings-world/living-world.test.cjs`: 11 synthetic deterministic tests.
- Run: `node --test apps/checklings-world/living-world.test.cjs`
- Identical copies of these two files passed 11/11 tests locally in Node before upload. The GitHub branch has not passed protected CI yet.

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
