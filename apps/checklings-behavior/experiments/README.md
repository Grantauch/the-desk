# Checklings individuality lab — CK-BEH-LAB-001

**Synthetic experiment only.** No production adapter, gameplay, server state, student data, LLM, remote requests, or evidence of consciousness. This task is scoped to `apps/checklings-behavior/experiments/**` on the pinned Batch04 baseline `89f4502966ec1bca9bd6ce093c8f90b8d2f906a2`.

## Hypothesis

Two individuals of the **same species** should react differently based on durable traits and genuinely recorded experiences; replaying the same records must not reroll temperament or fabricate events.

- `engine.mjs`: species-anchored, seeded curiosity/sociability/caution/activity/resilience; 0–100 derived energy/trust/comfort; deterministic, bounded (16) event memories; bounded (12) tag preferences; six read-only suggested intentions.
- `engine.test.mjs`: **20 node:test cases** covering deterministic replay, duplicate suppression and conflict detection, no invented history, hard limits, absence of caller mutation, personality separation, fatigue/distress/recovery priority, bounded diagnostic diversity and no implicit commit.
- `run.mjs`: three synthetic creatures with the same events; 1,000 sample replays; 300 independently seeded same-species creatures; reproducible SHA-256 snapshot digest and machine-dependent process timing and heap delta.

Run with **Node 22+**, no installation:

```bash
node --test apps/checklings-behavior/experiments/engine.test.mjs
node apps/checklings-behavior/experiments/run.mjs > /tmp/checklings-individuality-report.json
```

## Findings

The original unbalanced heuristic selected **socialize for 259/300** synthetic individuals in one identical scene. The revised heuristic selects **observe 142, socialize 97, explore 49, withdraw 12**. The maximum single choice is 47.3% rather than 86.3%; this only demonstrates variation in the specified synthetic sampling condition.

**Review fix (October 23):** Missing tag names such as `constructor`, `__proto__`, and `toString` previously read inherited properties from a normal JavaScript object, yielding `NaN` scores. Intent scoring now uses own-property lookup and finite/range validation. Four added tests cover missing reserved-name tags, authentically recorded reserved-name tags, nonfinite/forged preference values, read-only behavior and null-prototype inputs. The 20 tests are local synthetic checks, not production authorization tests.

The 300-person diagnostic has a *temporary* regression limit of no intent above 55%, with at least four unique responses. Rest and seek_comfort are deliberately not forced into a neutral scene; targeted tests instead confirm that exhaustion causes rest and repeated scares trigger withdrawal. These are proposed scoring weights; actual player-facing behavior and age-appropriate creative content require independent design review.

## Boundaries

| Area | Prototype | Integration/approval still needed |
| --- | --- | --- |
| Input | Synthetically supplied 1–256 sequential event records; exact duplicate events ignored, same-ID conflicts rejected | Trusted server-issued events, authoritative ledger, schema/content version migration |
| Identity | `creatureId` and seed accepted as parameters | Real creation authority, persist seed once, isolate memberships and classrooms |
| Vitals | 0–100 **derived indicators** for tests | Game-authoritative care, health and absence/death rules |
| Memory | Up to 16 traceable event IDs/tags selected by fixed salience/recency | Student-data privacy, deletion/redaction, consent and user-visible explanation |
| Preference | Up to 12 capped per-tag weights [-25,25] | Content-approved vocabulary, persistence and recovery |
| Intent | Read-only, deterministic recommendation for snapshot/revision/scene | Approved autonomy guardrails, gameplay UX, effects, teacher controls |
| Runtime | Local Node, synthetic workload; no external dependencies | Browser, real Chromebook, server, replay and school acceptance testing |

### Review notes

- Simple FNV-derived seed hash is **not cryptographic**, not secure identity and not a substitute for real randomness at creature creation.
- A given temperament can make the same choice as another; the system expresses long-term **tendencies**, not a guarantee of different responses at every moment.
- `chooseIntent` consumes experiment snapshots, not trusted save files. Production callers must validate data and enforce authorization before any actual action.
- For more than 256 events, implement a versioned snapshot/replay mechanism. **Never silently discard persistent history** to fit this experiment's array cap.
- Process wall time, CPU time and heap delta are not peak memory, production throughput, browser performance or classroom validation.
- No output should be presented as a conscious, sentient or independently suffering being.
- No Batch05 source/publication, current Hall Pass, classroom roster or production game was changed.

**Handoff:** Review with CK-BEH-001 (model and memory contract) and CK-BEH-003 (observable acceptance tests). Codex must approve any shared interface and integrate it separately after the relevant staging gates. This task should remain a **draft review PR**, not an automatic deployment.
