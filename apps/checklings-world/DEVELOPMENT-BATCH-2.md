# Checklings — development batch 2 (2026-10-22)

**Owner:** ChatGPT. **Branch:** `chatgpt/checklings-living-world-20261022`. **PR:** #223 (draft). The production Check-In and Hall Pass files were not modified.

## Added to the earlier living-world prototype

- `progression.cjs` — dependency-injected server-authoritative student progression: four species, 43 collectible cosmetics in seven equipment categories, care vitals, milestones, nonlethal progression, school-day daily welcome awards, three claimable quests, Star Dust crafting, equips, limited crates and optimistic crate replay rejection.
- `progression.test.cjs` — 12 synthetic contract tests. Run with `node --test apps/checklings-world/progression.test.cjs`.
- `rooms.cjs` — authentic 2–4-participant room protocol (NOT deployed): random 80-bit invite codes with only their SHA-256 hash as a storage locator, classroom-only membership, participant-only views, teacher enable gate, lobby readiness, atomic expected revisions, server-controlled raid moves and turns, 30-minute expiry, no real names.
- `rooms.test.cjs` — six room-behavior tests. Run `node --test apps/checklings-world/rooms.test.cjs`.
- `preview.html` — standalone responsive no-network visual exploration: customizable Checkling with color and accessories, five selectable biomes, a day/night toggle, visitor rotation, five vitals and care activities. Nothing is saved. Open this file locally or through a PR preview; it must not be advertised as live account gameplay.

## Security and deployment boundaries

The test stores are **in-memory synthetic fixtures** and are *not* safe for simultaneous production traffic. Production requires an authenticated backend with durable atomic transactions; an attendance reader returning verified official records computed server-side; school-day calendar index; a non-exported per-student secret seed; request rate limiting; and a teacher-controlled raid feature flag. `load`, `adopt`, `care`, `claim`, `craft`, `open`, `create`, `join`, `view`, and `move` must **only** be server functions. Never expose these CommonJS modules in public browser JavaScript.

Crate revision checks protect sequential retries only when the store's `transact` implementation guarantees atomic compare-and-write. A stale expected revision does not make a non-atomic backing store secure. Similarly, hashed invite locators are not an authentication substitute: session verification and class membership checks remain essential.

Rewards must be exclusively non-purchasable and decorative; no real-money payment or purchasable loot boxes for students. Publish transparent cosmetic odds before any loot-based rewards. No losses or punishments for being absent or missing a care day; accessibility and noncompetitive play remain equal paths.

## Checks and remaining tasks

- The earlier pure living-world prototype had 11 locally passing Node tests.
- The newly added GitHub source/test files have been committed but **no protected CI result or deployment is claimed in this handoff**. Run each test suite and the canonical repository verification before moving from draft.
- Next: connect to a private durable service using the existing signed classroom session, ensure race-safe transactions across simultaneous writes, migrate old `checkling-v1` preferences without replacing any, and test kiosk expiry/stale responses. Do not mix this with the already completed Version 41 startup repair.
- After backend verification, build proper polished creature art/sprites and first-party room networking UI. The included HTML preview is a *visual sandbox*, not AAA artwork and not a deployed multiplayer game.

## Current live baseline

As of the latest checked GitHub PR #221 description, the classroom startup repair was separately deployed as Apps Script **Version 41**, with synthetic release checks and four entry modes passing. Actual classroom usage remains a separate gate. This PR #223 is not merged or deployed.
