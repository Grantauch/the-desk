# Checklings care contract compatibility audit

This is a read-only *review* utility for comparing the published foundation's `Creature.care` contract and migration defaults with a proposed care-rule document. It does not rewrite the game, migrate pets, approve an interface, execute a school operation, or modify student records.

```sh
node apps/checklings-tools/care-contract-audit/audit.cjs \
  apps/checklings-foundation/contracts.ts \
  apps/checklings-foundation/migration.cjs \
  /path/to/CARE-001-care-interface.md
node --test apps/checklings-tools/care-contract-audit/audit.test.cjs
```

`exit 0` means no detected field/range inconsistencies, `1` means review blockers, and `2` means bad or unreadable input. This syntax-based checker works only with the documented inline `Creature.care` TypeScript declaration, the fixed `INITIAL_CARE` literal in migration.cjs, and a Markdown table of `INT (min..max)` rows under Section 1; on schema changes it should fail for manual review rather than guessing.

## Findings against Gemini v1.1 CK-CARE-001 design proposal

Pinned Batch04 `apps/checklings-foundation/contracts.ts` defines `Creature.schemaVersion:2` with care fields `nutrition`, `happiness`, `energy`, `cleanliness`, `focus`, all on 0–100 scales, plus separate `friendship`. The published `migration.cjs` initializes values 82/85/84/88/78 and never reads a legacy `t` nibble. The candidate care proposal instead specifies `satiety`, `hydration_cleanliness`, `energy`, `happiness`, `friendship_bond` with 0–1000 values, omits `focus` and introduces `development_stage` and a reserved body-condition column.

The checker reports five hard field/scale discrepancies (three missing canonical meters, two changed scales among retained names), plus review warnings for renamed/new fields, `friendship`, a reserved column and the optional legacy `t` reference. This flags a **not-yet-accepted interface/migration choice**. It does not assert the proposal is malicious or the production app uses those meters. A conversion could be valid if accepted by the integration owner and implemented with additive versioned migration, exact old-state preservation, rollback and tests; do not silently change live schema v2.

The proposal retains important **positive** requirements: free essential care, bounded absence decay, no lethal offline time and receipt-based idempotency. Those requirements should survive reconciliation. A new `INTERFACE` record must explain authoritative field mappings, 0–100 vs 0–1000 scaling/rounding, preservation of separate focus and friendship, officially sourced legacy values, consumers, database compatibility, and repeat restore/migration tests. Test actual private synthetic imports and real PostgreSQL only after approval. This tool is a reviewer preflight, not a production migration or test result.

## Independent review repair (2026-10-23)

The original checker incorrectly accepted three cases: an INT default exceeding its declared range, a duplicate proposed meter row, and duplicate keys in `INITIAL_CARE` whose first value was silently overwritten by `Object.fromEntries`. These were reproduced against the original exact source (6 baseline tests passing; 3 reviewer checks failing). The review's patch was independently applied and tested: **9/9 native Node tests PASS** (six original cases plus three new regression cases in `review-regression.test.cjs`). The parser now checks proposed default values, reversed ranges and duplicate names, and rejects duplicate migration defaults. This is only a source-level contract preflight; it does not approve the proposed v1.1 care schema, perform migrations or establish classroom readiness.

Run all focused tests with `node --test apps/checklings-tools/care-contract-audit/*.test.cjs`. Keep the PR draft until independent review and ordinary CI gate decisions.

## Real proposal-derived founder stage compatibility (Oct 23)

A direct CLI run against the **actual unchanged** Gemini v1.1 care-interface.md revealed a legitimate explicit derived default: `development_stage` is `Preserved from founder streak (0..4)`, not a missing number. The earlier strict default checker falsely labeled it `PROPOSAL_DEFAULT_MISSING`. The parser now handles this specific documented derivation as `PROPOSAL_DERIVED_DEFAULT` **warning requiring a verified official streak source**, not a silent approval or fabricated number. Unspecified/TBD/blank defaults still fail closed, and numeric out-of-range defaults remain errors.

The revised code passed 11/11 native Node22.16 tests (9 baseline + 2 new). Against the real Gemini design and published-source excerpts for the canonical v2 care/migration schema, CLI now yields the five substantive hard mismatches (missing nutrition, cleanliness, focus; scale changes to energy and happiness), along with review warnings for migration/renaming. The five errors do not approve the incompatible proposed model. Exact tested source blob `64634a5562458c34f83199494948cef3662b9171`, test blob `cddf87d45c9c54634e08f58542ce63d019d86947` matched GitHub readback. No student, Apps Script, database or live runtime changes.
