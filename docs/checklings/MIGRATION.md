# Preserving existing pets

## What exists now

The production backend stores `checkling-v1:<class-membership-key>` as a small JSON preference:

```json
{"v":1,"species":"bolt","name":"Original friend","habitat":"sky"}
```

The property key is private. A student's shared PIN can identify several memberships, and each membership can have its own pet. There is no historical individual ID, birth date, health, inventory, breeding line or saved battle record in this format. Official streaks, points, attendance timestamps and late-review decisions belong to the classroom service. Snack, matching and memory-game progress is temporary view state, so there is no durable score to migrate from those games.

The five actual habitat IDs are `meadow`, `grove`, `cove`, `sky`, `cosmos`. Their official best-streak milestones are 0, 3, 7, 14, 30. PR #223 calls Cloud Island `cloud`. Adapt that presentation label at the boundary; do not rename or lose the saved `sky` home.

The current preference writer permits changing species as well as name. At cutover, preserve the current stored selection as the founding individual. Earlier choices cannot be reconstructed from this preference alone. New individual identity becomes immutable after import; the old species-switching writer must be fenced for migrated memberships before game mutations are enabled.

## Executable rehearsal

`apps/checklings-foundation/migration.cjs` is a pure planner. It accepts a trusted server export, official summary and private migration key. It does not read production, write properties, create a database or award anything.

1. Verify tenant and membership privately. Derive one stable source-slot identifier using a keyed HMAC of a structured tuple. Preserve the same key across retries and restore; do not derive public identifiers from a PIN, email or unkeyed hash. Keep mapping credentials in the private bridge.
2. Read the exact existing preference and official best streak. Keep a private backup of original bytes and source fingerprint. Never place exports or identity mappings in GitHub, a public build or browser storage.
3. Reject malformed JSON, unknown schema/species or damaged names into review. Do not silently replace a pet. Missing preferences remain unadopted.
4. Preserve species, exact bounded nickname and every earned home. For unknown or locked homes, reproduce the current server's meadow fallback and retain the original value for review. Already-earned valid homes remain selected.
5. Assign one individual per source slot. Unknown birth date stays `null`. Mark `origin=legacy-import`; import time is separate. Initialize only newly introduced care/development fields at a safe baseline. `level=1` and `xp=0` do not replace the official streak, old stage or earned homes, which remain recorded separately. Never infer unrecorded neglect, illness or death from absence before import.
6. On retry, leave an already-imported individual untouched, including later name, injuries, evolution or death. A changed source fingerprint or conflicting destination record blocks cutover for that membership.
7. Bind `ownerMembershipId` privately inside the database transaction. The planner deliberately returns an identity-minimized candidate, not a complete persisted row. Database insertion must atomically enforce unique source slot and creature ID, record an import event, and compare the source fingerprint.

The automated rehearsal exercises all four founders, five homes, every unlock threshold, old three-field preferences, null/corrupt data, long names, tenant/class separation, repeat imports, changed sources and deceased individuals. One test uses the actual Apps Script source in the synthetic workbook harness, saves a pet, plans import, logs in again and verifies the original pet and classroom facts are unchanged. This demonstrates compatibility of the import plan. It does not prove a production migration or database concurrency behavior.

## Cutover sequence for a later release

| Step | Required evidence | Failure action |
|---|---|---|
| Back up | Private export, source counts, fingerprints and restore rehearsal; exact deployed source baseline | Stop before writes |
| Shadow import | Synthetic first, then private dry-run report; source count equals imported + no-pet + review, with no unexplained records | Resolve every discrepancy |
| Fence one pilot membership | Small reviewed Apps Script change disables legacy pet writes only for migrated members; check-in and pass RPCs unchanged | Keep game writes disabled |
| Final read | Re-read under the same legacy writer fence/lock; fingerprint must match import candidate | Review changed record; do not overwrite |
| Import transaction | Unique source slot, creature, ownership mapping and ledger commit atomically | Entire transaction rolls back |
| Enable pilot | Feature flag activates new game writes only after destination/readback matches | Remain on original view |
| Cross-device check | Verified synthetic/pilot account sees the identical individual on two devices | Freeze pilot; investigate |
| Expand cohort | No unexpected attendance writes, no duplicate imports and acceptable service latency | Disable new game access |

Legacy pet writes must not continue alongside new authoritative pet writes. The fence is per membership, guarded by the existing classroom lock, with a second fingerprint check immediately before import. Game-service downtime while fenced must never fail attendance or Hall Pass; the original companion may display a read-only saved-pet fallback.

## Recovery

Before new game writes begin, remove the pilot flag/fence if necessary; the original properties are untouched. After game writes begin, disable gameplay and preserve the database plus event ledger. Do not re-import stale preferences over newer progress or move a dead creature back into the roster. Repair verified technical errors through a separate audited admin event. A bad site release is fixed forward through Git and the normal pipeline. Preserve the existing Apps Script deployment URL and current access settings.

A live migration is blocked until the durable adapter passes real transaction, crash/retry, concurrent-import and backup/restore tests, and the five-file Apps Script bridge release passes its own protected synthetic smoke. None of those later migration gates is represented by the offline planner.
