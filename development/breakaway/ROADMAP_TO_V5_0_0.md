# BREAKAWAY — Roadmap to V5.0.0 Final Release

**Written:** November 26, 2026 · **Status:** Plan, not authorization to deploy  
**Starting point:** [V4.8.7 latest development source](LATEST.md) · **Source PR:** [#602](https://github.com/Grantauch/the-desk/pull/602)  
**Target:** An original, premium-feeling, instantly understandable, highly replayable top-down arcade football game. Keep the **60-second Classic** game the flagship. No licensed teams/players, external game dependencies, student data, accounts or hidden tracking.

> The versions below are **quality milestones, not calendar promises**. A batch may be refined or repeated until its gate passes. A GitHub development-source merge is NOT a website release.

## What is already working at V4.8.7

- Five blockers on the opening drive, reduced by **one per touchdown** to a permanent one-blocker floor; no mid-drive removal.
- Defenders knocked down remain down for that possession. Stalling releases **pre-positioned** reserve defenders; no teleporting replacements.
- Fair defensive pursuit, leverage-based blocking, understandable score breakdown and no farming points while standing still.
- Near-miss tackle escape using a **flashing E/A/TAP prompt over the grapple**—never an obscuring modal overlay.
- Short replay of copied states with clock, physics, score and defenders **fully frozen**; skip works from keyboard, touch and gamepad.
- Impact shake/particles, 2.5D lighting, expressive player poses, **distance-driven slow footsteps** (V4.8.6) and upper-body motion blends (V4.8.7).
- Existing automatic Chromium/simulation coverage; **physical phone/controller, Safari and Firefox acceptance remains unfinished**.

The historical B01–B12 master roadmap grouped sound, modes, local progress, QA and launch into broad batches (formerly called V4.8, V4.9, V4.10, V4.11, V5.0). Those were placeholders; the real releases through V4.8.7 focused on football feel and visuals. **This document now sets the actual forward version sequence.**

## The complete version sequence

| Milestone | Priority | Core objective | Change class |
|---|---|---|---|
| **V4.8.8** | P0 | Foot-plant realism, animation continuity and mobile rendering cost | Rendering |
| **V4.8.9** | P0 | Tackle/score broadcast direction, camera and replay legibility | Rendering/UI |
| **V4.9.0** | P1 | Original layered game audio and stadium character | Audio |
| **V4.9.1** | P1 | First-run help, input clarity and cohesive settings | UI |
| **V4.9.2** | P1 | Carefully limited extra game modes | Gameplay |
| **V4.9.3** | P0 | Adaptive difficulty, tackling and blocker balance | Gameplay |
| **V4.9.4** | P2 | Optional offline records, milestones and fictional uniforms | Persistence |
| **V4.9.5** | P1 | Unified final art direction, field and menu polish | Visual/UI |
| **V4.9.6** | P0 | Accessibility, touch, controller and keyboard parity | Input |
| **V4.9.7** | P0 | Device frame-time, memory and cross-browser hardening | Engineering |
| **V4.9.8** | P0 | Repeatable release process, rights/security/hosting audit | Release |
| **V5.0.0-rc.1** | P0 | Feature freeze and full acceptance candidate | QA only |
| **V5.0.0-rc.2** | Conditional | Bug-fix-only candidate, if RC1 needs corrections | QA only |
| **V5.0.0** | P0 | Tagged source, immutable build and controlled public release | Final |

---

## Stage I — Finish athlete motion and game feel

### V4.8.8 — Weight, foot plants and animation optimization

**Player result:** Athletes appear to plant, push off, brace and recover naturally instead of flickering or pinwheeling.

**Jobs:** Watch real-speed footage of sprint→cut→spin, stiff arm, block, hurdle, grapple and fall. Refine short transitions and planted-foot contact with the turf. Prevent stride phase discontinuities at sudden speed changes, idle, pause and replay. Improve torso/arm balance without random movement. Keep downed-defender settled poses still. Cache high-cost shoulder pad, limb and shadow shapes; profile on narrow phone.

**Ship gate:** football engine byte-identical to V4.8.7; 120 Hz gait/idle/acceleration tests; twelve action scenarios; screenshots plus side-by-side **real-speed** footage; 500 seeded games; 2,000 renderer draws; four viewports; honest phone frame-time report. Reject the build if a slower frame rate or an obvious sliding shoe undercuts the improvement.

### V4.8.9 — Camera and replay director

**Player result:** Big plays are dramatic but never hard to follow.

**Jobs:** Keep the runner and relevant defenders in view; avoid camera oversteer and unseen tackles. Differentiate tackle, touchdown, counter and broken-tackle camera timing. Replays must exclusively render a bounded buffer of copied frames, with graceful memory cap and clean skip. Keep scoreboard and touch controls stable during impact shake. Retain the **small flashing input above the actual grapple**; no focus changes, modal darkening or large on-screen prompt. Reduced Effects supplies still-frame replay and no jolt/flash.

**Ship gate:** test replay start/middle/end skip, clock frozen to exact value, no score or position mutation and no replay physics; 320px mobile viewport; all three input modes; no hidden defender; 500 games, 2,000 draws and memory-bound checks. Reject distracting effects even if screenshots look cinematic.

## Stage II — Add product identity and meaningful replay value

### V4.9.0 — Original audio and stadium presence

**Player result:** Cleats, contact, crowd reaction, possession and touchdowns sound like one cohesive sports game.

**Jobs:** Build a small original sound vocabulary (cleat/turf, whistle, impact, missed tackle, counter, score, crowd swell); dynamic layers based on actual play; master/effects/crowd controls, persisted mute, mobile WebAudio unlock and tab-visibility cleanup. All sounds must be original or explicitly cleared; never fetch unlicensed sports clips or autoplay before user interaction.

**Ship gate:** muted means genuinely silent, no audio leaks after 100 start/pause/reset cycles, playback requires a user gesture, audio interruption/recovery tested, non-audio play equally understandable. Browser/devices report what works and what was not tested.

### V4.9.1 — Onboarding, controls and menus

**Player result:** A first-time player learns the game within a minute and can restart without hunting for a button.

**Jobs:** Optional, non-obstructive first-play tutorial; explain movement, special moves, defense reads, the near-miss escape, five-to-one blocker progression and five score categories. Improve pause/settings/result hierarchy; visible touch/keyboard/controller mappings and small-phone layout. Restore sound, Reduced Effects and High Visibility without storage dependency.

**Ship gate:** at least three unaided human first-game playtests; complete touch/controller/keyboard path to start, play, pause, replay, result and rematch; no hidden primary buttons at 320px; keyboard focus and legible high-visibility mode. No giant tutorial modal covering gameplay.

### V4.9.2 — Modes with genuine purpose

**Player result:** Varied goals using the same strong running system—not a mode menu full of shallow options.

**Jobs:** Keep **Classic 60 Seconds** mechanically and statistically comparable to its legacy score history. Add **One-Drive Challenge** with clear goal/termination. Consider a bounded **Endurance** mode only after the first extra mode passes acceptance; at most two new modes for 5.0. Each mode needs own rules, results, records and predictable restart.

**Ship gate:** 500 seeded completed games per introduced mode; score ledger exact; no cross-mode score contamination; every mode handles tackle, touchdown, pause, replay, timeout and unusual restart; all controllers work. Do not add online rooms, leagues or franchise systems.

### V4.9.3 — Fair defensive difficulty and blocking

**Player result:** Newcomers are rewarded early; skilled players earn more with fewer blockers—not through cheating defenders.

**Jobs:** Calibrate the **5→4→3→2→1** blockers-after-touchdowns curve against opening-drive and later-drive success. Test defender assignments, contain, recovery, cutbacks, stalling reserves and failed blocker leverage. Balance near-miss mashing input across devices. Audit scoring and clock skip exploits, no stationary farming, clean cuts and special move counters. Publish matched seed comparisons to V4.8.7 and to last accepted Classic.

**Ship gate:** 120 matched-seed before/after minimum for any rule change, targeted per-support cohorts and **5,000-seed distribution goal**; opener demonstrably approachable while one-blocker stage demonstrably harder; human fairness reviews. No mid-possession defender resurrection, spawning, rubber-banding, or false contact cues.

### V4.9.4 — Offline replayability without accounts

**Player result:** Returning players can track improvement and enjoy a small set of custom looks.

**Jobs:** Separate local bests by mode; optional skill milestones; a modest set of original fictional jerseys/colorblind-safe colors; versioned localStorage schema; export/import/reset; corrupt storage and private-mode fallback. No gameplay advantages for cosmetics and no personal identity or account.

**Ship gate:** storage migration and malformed-file tests; reset truly resets, import/export round-trips, Classic historic records preserved, blocked storage never blocks play; no network writes or tracking. No achievement can be farmed from replay playback.

### V4.9.5 — Cohesive premium art/UX

**Player result:** Title, field, HUD, replay, menus and final results look authored as one game.

**Jobs:** Lock visual tokens (type, color, contrast, 2.5D lighting and texture); finish helmets/cleats/shadows and fallen sprites; stadium/end-zone polish; distinctive but restrained score graphics and game-over celebration. Make gameplay readable above decoration on 320px phones and short landscape views; high visibility and reduced effects have intentional looks.

**Ship gate:** four-viewport comparisons covering menu, run, contact, replay, pause and result; real-speed footage, no clipped or overlapping HUD, readable input cues, measured render budget, human visual acceptance. Reject extra particle polish that worsens clarity.

## Stage III — Make the game dependable everywhere

### V4.9.6 — Accessibility and controller/touch completeness

**Player result:** Every player can navigate and finish the game from their available controls.

**Jobs:** Keyboard focus and repeat/held-press correctness; gamepad dead zones, connect/disconnect/reconnect, navigation and dash/escape button-edge behavior; touch safe-area hit targets, portrait/landscape reflow and one-finger usability. Real Reduced Effects and High Visibility, non-color-only threats, readable settings, no required flashing or audio.

**Ship gate:** full end-to-end keyboard/gamepad/touch flow with pause/resume/rematch, iPhone Safari + Android Chrome hands-on if available, desktop Chrome/Firefox/WebKit automation, physical controller checks. Document gaps truthfully; no critical function behind one input-only action.

### V4.9.7 — Performance and cross-browser engineering

**Player result:** Stable, responsive football on ordinary devices and long sessions.

**Jobs:** Instrument frame-time average/p95/p99, replay memory, sprite/shadow/particle draw costs, high-DPI cap and audio node lifecycle. Cache repeated geometry, cull unseen objects, cap buffers, respond gracefully to orientation and hidden tabs. Fixed-step physics must remain deterministic at 30/60/120Hz display pacing. A WebGL or engine rewrite is **not** part of V5 unless separately authorized and proved feature-parity.

**Ship gate:** target **60 FPS / 16.7ms total frame time** on agreed mid-range real-phone test devices in Classic play, with a documented lower-effects fallback when impossible. Thirty-minute memory/input/clock soak, **5,000 seeded games** at final performance gate, cross-browser smoke, zero unbounded allocations or pause/replay timing errors. Do not claim real-device FPS based on headless Chromium alone.

### V4.9.8 — Security, rights and release engineering

**Player result:** A trustworthy offline package and safe, reversible website rollout.

**Jobs:** Canonical reproducible HTML build and SHA-256 manifest; original or cleared art/audio audit; verify zero student/school integration, network requirement, tracking or secrets; inspect save privacy and safe reset. Complete instructions, icons, browser metadata, release notes and QA evidence. Create independent launch/verification/rollback steps for grant-desk.com and freegameplace.com.

**Ship gate:** protected CI, independent code/visual review, no unresolved critical/high bugs, correct checksum from clean build, all essential controls, public-route isolation, known last-good rollback SHA; complete rehearsal on staging. Updating a development PR must never silently overwrite a production game.

## Stage IV — Freeze, prove, release

### V5.0.0-rc.1 — Feature freeze

Freeze visuals, physics, modes, sound and progression. Run complete browser and seeded suites, 30-minute soak, storage migration, accessibility, legal and human first-game checks on the **exact frozen RC bytes**. Only blocker/crash/clarity issues may be fixed; no new gameplay ideas.

**Gate:** all required tests documented, at least one real desktop and phone run, one real touch and controller pass, no critical/high bugs, sign-off on performance, licensing, offline behavior and clock/replay invariance.

### V5.0.0-rc.2 — Only if RC1 requires fixes

Fix root causes only. Include a regression test for every correction, re-run the entire acceptance suite and reviewer confirmation. Do not add new modes, graphics effects, score systems or optional features. More RCs are allowed if needed; the number is not a deadline.

### V5.0.0 — Final, verified release

**Prerequisites:** Grant's approval, independent reviewer, passing CI/QA, human real-device acceptance, source and playable artifact frozen, release SHA and rollback SHA recorded.

1. Merge reviewed source, tag \`v5.0.0\`, publish a GitHub Release with portable HTML, changelog, license/rights statement, checksum manifest, QA and rollback.
2. Publish to one approved host using **that site's** release process, and check real public bytes, gameplay, touch, replay clock, cache and console.
3. Observe for defects; approve the other host separately, then verify its public bytes and controls. The two sites may deploy differently.
4. Regression-check unrelated games, especially **Gridiron Blitz**. If failed, restore last known good for the affected host only.
5. Announce 5.0.0 live **only after verifying** every domain intended for rollout.

The definition of final is **a tested release on intended public hosts with a reliable rollback**, not simply a version label or a merged GitHub PR.

---

## Non-negotiable regressions (fail any gate immediately)

- Downed defenders stand up, teleport or become active before the possession resets.
- Stalling generates new defenders beside the runner instead of visibly releasing pre-positioned reserves.
- Blocker removal happens for yardage, during a drive, or below one; difficulty stops following touchdowns.
- Replay or tackle struggle consumes/adds clock, score, or mutates the simulated football future.
- Near-miss escape becomes a full-screen modal instead of the small E/A/TAP cue over actual contact.
- Feet rotate rapidly while stationary or jump stride phase when speed changes; animations conceal an active hit.
- Camera shake obscures score, button targets or threats; Reduced Effects fails to disable it.
- Points fail to reconcile with the breakdown or can be repeatedly farmed by stalling.
- An extra mode silently rewrites Classic rules/records; data migration loses local records.
- A game gains unauthorized network calls, student accounts, ads, unlicensed assets or background tracking.
- A GitHub source-only task modifies production \`public/\`, unrelated websites or Gridiron Blitz.

## Repeatable delivery contract for EACH version

| Evidence | Minimum each development batch | Elevated final/physics gates |
|---|---|---|
| Source | New dated folder, clean branch/PR, readable patch, reproducible HTML, manifest and rollback | Final tag, independently built SHA |
| Engine | Syntax and deterministic state invariants, exact ledger, clock, downed/blocked state | Core hash identity for visual-only work, explicit diff for changed physics |
| Game simulations | ≥500 completed full games plus targeted cases | ≥120 matched seeds when rules change; ≥5,000 for final balance/performance |
| Browser | 1440×900 desktop, 390×844 phone, 320×568 narrow, 844×390 landscape | Chrome, Firefox, Safari/WebKit and actual phone/controller |
| Visual | ≥2,000 draw smoke, captures of gameplay/contact/replay/results | Real-speed footage, measured frame-time and reduced-effects acceptance |
| Controls | Keyboard, touch, gamepad, pause, settings, replay, end and rematch | Reconnect, focus, low FPS, blur, orientation and accessibility |
| Release | Public GitHub source and recorded QA; site unchanged until reviewed | CI, independent approval, hash-verified live pages and tested rollback |

**Human/physical evidence cannot be manufactured from automated tests.** Mark it pending when not done. A failing gate means refine the same version rather than increasing the number.

## Team operating model

**One owner and one file claim per version.** All collaborators read [LATEST.md](LATEST.md), [AGENTS.md](AGENTS.md), this roadmap, and their Team Desk task before editing. Create a new dated release directory rather than mutating frozen releases; update the single LATEST pointer **after** full QA.

Suggested roles, **not standing assignments**: Codex or Claude handles one scoped implementation; a different AI reviews state/performance, a visual reviewer checks actual game footage, Dot keeps claims, PRs, handoffs and release gates organized, and Grant chooses the aesthetic and expressly authorizes publishing. Each handoff names exact commit/PR, changed files, build SHA, tests, known deficits and rollback.

Avoid calendar promises and feature bloat. The V5.0.0 goal is **quality of football play**.

### Explicitly out of V5.0.0 scope

Online multiplayer/rooms, global leaderboards, school login/grades, real teams/leagues, payments, a huge franchise/career mode, and a full WebGL/3D engine migration. These each need separate approval, architecture, privacy and performance work.

**Next actionable task: V4.8.8**, with full-speed animation review and phone render optimization, after the source organization/PR #602 review gate clears.