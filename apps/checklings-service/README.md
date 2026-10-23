# Checklings persistence foundation

Owner: Codex. Branch: `checklings/batch-02-persistence`, based on Batch 01 PR #226.

Internal Node modules and SQL only. No HTTP mutation endpoint, school login, public game UI, production database or Netlify service is deployed by this change. No student record is read or imported. Production integration remains disabled.

- `database.mjs`: explicit, checksum-guarded schema migration; PostgreSQL pool transaction adapter; redacted readiness result.
- `migrations/001-foundation.sql`: scoped membership/creature storage, command receipts and append-only event journal, with ownership/provenance/revision constraints.
- `store.mjs`: injected server authorization; rechecked database membership/class/auth epoch; atomic legacy import and nickname changes; private owner reads.
- `storage-contract.mjs`: shared synthetic assertions against embedded SQL and independent PostgreSQL clients.
- `storage.test.mjs`: embedded PostgreSQL assertions, file-backed close/reopen and archive restore. Embedded transactions are serialized; this does not establish independent-client contention or hosted durability.
- `native-storage.integration.mjs`: the same contract using a real PostgreSQL pool with 35 separately opened physical connections. This is an explicit opt-in synthetic test, not a production load tool.

## Run locally

From the repository root:

```sh
npm ci --include=dev
node --test apps/checklings-service/storage.test.mjs
npm run checkling:test
npm run verify
```

The test-only PGlite and pg dependencies live in repository development tooling. The server modules accept a private database adapter; deploying a separate service later requires its own runtime dependency/configuration package, credentials and release verification. None of these modules is imported by the public site or Apps Script.

For native integration, provide a disposable PostgreSQL database named `checklings_test`, set `CHECKLINGS_TEST_DATABASE_URL` privately, set `CHECKLINGS_TEST_DATABASE_PURPOSE=synthetic-only`, and run:

```sh
node --test apps/checklings-service/native-storage.integration.mjs
```

The runner creates and drops only its own random `ck_test_...` schema. It refuses an absent opt-in or a different database name. Do not point it at production. `.github/workflows/checklings-storage.yml` provides an ephemeral PostgreSQL 18 service with synthetic CI-only credentials. No stored secret or school connection is required.

## Transaction rules

The native adapter acquires one client for BEGIN through COMMIT/ROLLBACK. A member row lock serializes commands for that owner. A committed receipt is checked before applying a repeated command; different payloads cannot reuse its ID. State, consequential event and receipt commit together. A callback failure rolls everything back. Unknown connection/commit failures are not retried automatically; the caller retries the same command ID to recover its stored receipt. Only recognized transaction-abort codes receive bounded internal retries.

This batch handles one owner and one creature per consequential command. Future cross-owner battles, lineage, inventory and reward settlement require their own SQL tables, sorted multi-owner locking or serializable transactions, and tests. An event uniqueness rule currently permits one creature event per command; extend it deliberately when implementing multi-creature settlement.

A replayed receipt describes its original committed result. It may be older than a later rename, injury or death. The future UI must compare revisions, reject stale repainting and load the current creature after command recovery. Battle eligibility must always read current locked database state, never a historical receipt or client snapshot.

`authorize` must be a trusted server verifier returning opaque tenant, membership and class IDs plus the current auth epoch. This batch does not implement it. A caller-supplied identity object cannot be treated as authenticated. `importLegacy` accepts a private verified school export, not a browser payload. Keep both methods behind the future authenticated server adapter; do not expose module methods directly through a public router.

An imported state can be renamed, but reimport cannot overwrite its later progress or resurrect it. Missing/corrupt/conflicting legacy source requires review. Source preferences remain untouched because the game has no access to the classroom store. The separately reviewed per-membership legacy writer fence and final source-fingerprint recheck are still required before a pilot import.

## Later body and injury systems

[Body condition and scars](../../docs/checklings/BODY-CONDITION-AND-SCARS.md) are scheduled future work. Creature schema remains v2. Do not start tracking weight, invent wound history, apply damage modifiers or render scars from the current persistence code. Add versioned state/table migrations and their gameplay tests when core care and localized combat damage exist.

## Remaining before staging or classroom use

Complete native independent-client CI; package a separate deployable service; provision a dedicated owner-approved database; implement the real school-session bridge and server session revocation; configure a least-privilege runtime role versus migration owner; managed backup/restore rehearsal; cost/resource limits and redacted monitoring; migration fence; actual multi-device UI and Chromebook verification. Local SQL tests and a passing native test container do not prove these deployment gates.

Primary references: [node-postgres transactions](https://node-postgres.com/features/transactions), [PostgreSQL row locking](https://www.postgresql.org/docs/current/explicit-locking.html), [PGlite API and archive limits](https://pglite.dev/docs/api). PGlite archives are for compatible PGlite instances; they are not a managed PostgreSQL backup format.
