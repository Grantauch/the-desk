# Batch 02 continuation: persistent game data

Date: October 23, 2026. Owner: Codex. Branch: `checklings/batch-02-persistence`, stacked on Batch 01 PR #226. **Source implementation; no student-facing deployment.**

## What changed

Started slice 02A with a dedicated game SQL schema and server-side transaction modules. Membership, creature state, exact legacy import provenance, expected revisions, immutable command receipts and consequential events are saved in one transactional database boundary. A server-authorized owner can import a verified legacy candidate or rename an existing living individual. Ownership/class/auth-epoch checks run against the database, and duplicate commands return the committed result.

The modules have no school credentials, no direct classroom-store access and no public mutation route. They do not replace the check-in app, migrate a live student, implement login or make a playable game available.

This is the database portion of 02A. Separate hosted provisioning, deployment, the identity bridge and pilot migration remain outstanding. See [service instructions](../../apps/checklings-service/README.md).

## Weight and scars: accepted, scheduled later

Grant clarified that these can wait until the appropriate gameplay systems exist. The [body-condition and scars requirements](BODY-CONDITION-AND-SCARS.md) now preserve the full requested scope:

- Overfeeding/underfeeding gradually affects a species-relative body shape.
- Both overweight and underweight conditions reduce movement speed and modify damage dealt/taken in battle.
- Prolonged conditions carry a warned risk of lasting health complications.
- Food choices, appropriate exercise, recovery and treatment provide a practical management path.
- Qualifying battle wounds can heal into persistent, anatomically placed scars, with species-specific equivalents and correct placement through motion/body changes.

Feeding/fitness implementation follows core care; combat effects join tactical balance; scars follow localized wounds, healing and art anchors. The current creature schema and legacy migration do not add weight/scar fields or invent historical conditions.

## Validation and limits

| Layer | Evidence |
|---|---|
| Embedded SQL | 18/18 final storage tests passed (17 shared scenarios plus the outer persistence/restore test); combined companion/foundation/storage suite passed 54/54. Exercises actual PostgreSQL SQL through PGlite, with serialized embedded transactions. |
| Persistence / restore | File-backed database close/reopen plus a compatible PGlite archive restore compare creature, event and receipt rows. This is not a hosted disaster-recovery test. |
| Native independent-client tests | **Passed:** [PostgreSQL 18 CI run 39981989607](https://github.com/Grantauch/the-desk/actions/runs/39981989607) on source commit `99c3d6fa05016a1aa217454832bb52721ae87265`. All 18 native tests passed, including 35 distinct physical connections, duplicate delivery and competing revisions. The same run also passed all 18 embedded tests. These are synthetic database results, not hosted/student gameplay evidence. |
| Classroom regressions | Canonical `npm run verify` passed all 18 stages: 440 classroom behaviors, Astro 0 errors/0 warnings, 53 built routes, 136 HTML files and 4,618 local references. Its storage checkpoint had 53 combined tests; a subsequent SQL import-key guard and its final focused suite passed 54/54. The entire gate was not repeated after that focused follow-up; protected CI will run the final source. |
| Production / actual students | No deployment, live migration, student login or Chromebook gameplay test performed by this continuation. |

Assertions cover preserved founder/name/home unlocks across service instances, 35 duplicate deliveries, conflicting payloads, reimport after progress, changed/missing legacy sources, tenant/member/class/active/auth-epoch isolation, competing revision writes, transaction rollback after a partial write, lost acknowledgement after commit, deceased-import preservation, database revision/FK constraints, append-only history, malformed/extra client fields and checksum drift.

## Next work

Subsequent reconciliation: final PR #227 head `0b98f49f5850c07f597bedfadf05f31196563aea` passed [storage integration 39982438432](https://github.com/Grantauch/the-desk/actions/runs/39982438432) and [protected site checks 39982438462](https://github.com/Grantauch/the-desk/actions/runs/39982438462). The PR remains unmerged and undeployed. [Batch 03](BATCH-03-AUTH.md) continues the internal authentication/session foundation on a separate stacked branch.

Native PostgreSQL CI has passed. Finish the 02A staging/deployment package and operational ownership. Then implement slice 02B's verified school-PIN launch bridge and revocable game sessions in staging. Keep all student integration and lethal features off until their own acceptance gates pass. The original four companions remain governed by the separately deployed classroom release.
