# Checklings contract / affinity audit — independent review utility

**Status:** source-only development aid. It reads local files; it does not change the game, shared contracts, classroom app, database, or any student data. The first-12 roster is a design plan, not 12 playable creatures.

## Why this exists

The pinned Batch04 sources define **12 lower-case** `Affinity` values in `apps/checklings-foundation/contracts.ts` and 12 first-slice species assignments in `apps/checklings-foundation/species-plan.json`. A separate, unapproved design proposal introduces **six uppercase** `Ecological Affinity` / battle groups (e.g. `CANOPY_FLORA` and `TIDAL_BRINE`). These may be useful for a role/terrain grouping but are **not the current persisted Affinity type**, and they must not silently replace it.

An independent inspection found two references to the undefined `FROST_RIME` where the table declares `ASTRAL_RIME`. Its six-group table also has nonreciprocal advantage/resistance pairs, and lists `ASTRAL_RIME` as an affinity-wide advantage against itself; these require explicit design choices rather than silent code changes. That is an internal typo/undefined type in the proposal. No runtime game fault is claimed; the proposal has not been integrated.

## Run

```sh
node apps/checklings-tools/contract-audit/audit.cjs \
  apps/checklings-foundation/species-plan.json \
  apps/checklings-foundation/contracts.ts \
  /path/to/battle-rules.md \
  /path/to/mosswisp.md /path/to/brinebell.md
node --test apps/checklings-tools/contract-audit/audit.test.cjs
```

The battle proposal and species markdown paths can be local reviewer-only files and **must not** contain student information. The tool never opens network connections or writes any input. Output is JSON: `canonicalErrors` and `battle.errors` are stop signs; `battle.warnings` indicate a proposed mapping needs a reviewed and accepted interface decision. Exit 0 means no structural errors; exit 1 means errors; exit 2 means malformed or missing input.

## What the tool checks

- The actual exported TypeScript `Affinity` string-literal union is parsed from the source, not a guessed synonym list.
- The design-plan species list has unique IDs, known canonical affinities, and known ecosystem keys.
- A proposed `Affinity ID` battle table has unique group IDs and no references to absent groups (including resistance and advantage cells).
- Reciprocal advantage/resistance declarations agree in both directions: if A is strong against B, B lists A under Resisted By (and vice versa). Self-advantage is flagged as an affinity-wide balance defect; a one-move exception belongs in an explicitly named ability rule.
- Proposed `Ecological Affinity` labels in species briefs resolve inside their **proposed table**, not automatically to the canonical `Affinity` field.

This is a narrow syntactic contract check. It cannot approve a 6-versus-12 balance change, migrate saved creatures, assess silhouettes, verify animations, balance PvP, or confirm playable/deployed behavior. A change to the actual battle affinity model requires a new `INTERFACE` proposal describing source/current version, mapping and migrations, every consumer, backwards compatibility, authority, tests, and an explicit accepted decision from the integration owner. Preserve founder IDs, pets, names, homes and student progress regardless of the proposed classification.

## Strictness hardening — October 23, 2026

An independent review identified three previous false approvals: (1) `Affinity` union terms such as `string` or unknown type expressions were silently ignored if at least one quoted literal appeared, (2) a bare/unformatted matchup name in a battle table was ignored instead of considered a malformed declaration, and (3) a malformed `**Ecological Affinity**` brief label was treated as absent. The parser now fails closed on all three, without deciding the 6-versus-12 mapping or modifying catalogs. This is deliberately syntax-constrained: when the agreed table/type notation changes, update the checker after review rather than silently skipping unknown tokens.

New `review-regression.test.cjs` covers all three. Run `node --test apps/checklings-tools/contract-audit/*.test.cjs` — **12/12 native Node tests PASS** (nine existing plus three new). Exact source Git blob `1c1caba9c4177a57d62fd4b0276fd20563a6b6b8` and new test blob `abfbd0fcd01dcc4a33176dd963d5052e09b10cba` match locally executed files. This is a source-only validation improvement, not a production release.
