# GrantDesk Hall Pass — steady-state operations

Issue #14 is closed and the Version 15 contention release is deployed. This file is the
current operating checklist. Nothing here is a release blocker; these are the ordinary
production-care checks and the verification work that is still open.

Production fingerprint as of 2026-09-02 (Version 16):

| Fact | Value |
| --- | --- |
| Repository head | `0a062d8` (main) |
| Deployed application source | `005ac939619a316831478ef7d196d1b288c10e6a` |
| Apps Script version | 16, existing deployment updated in place |
| Workbook schema | `2026-09-02-a` (no migration pending) |
| Rollback baseline | `apps-script/snapshots/hall-pass/version-15-live-2026-09-02` |

## Daily and weekly checks

- Watch the private teacher dashboard's retry-signal card during first-hour traffic. A small
  non-zero count means automatic recovery absorbed a collision. A large or climbing count on a
  normal day is worth investigating; it is never evidence of a PIN or roster problem.
- Confirm `/pass/`, `/check-in/` and the Hall Pass card in `/tools/` still load and still point at
  the current `/exec` deployment.
- Watch Pass Log growth against the 180-day retention window, and confirm rows are moving into
  Pass Audit rather than being dropped.
- Add official school-calendar amendments to the School Calendar tab as the district publishes them.

## Open verification work

1. **Teacher cold start.** One teacher bootstrap request exceeded the 45-second client timeout during
   the Version 14 smoke; an immediate reload passed. Time several genuinely cold loads on the school
   network. If it does not recur, record that and close the concern. If it does, profile the teacher
   bootstrap server calls before changing any timeout value.
2. **Roster change versus PIN-email batch.** Version 15 added `assertPinEmailBatchIdle_` to the roster,
   PIN-generation, PIN-card and identity-repair paths. The acceptance test still needs to run on
   controlled fixtures or a private test copy: prove that a roster addition, deactivation, reactivation
   or email correction made after a delivery batch assembled its recipients cannot send a credential to
   a stale address, and that the recorded delivery status matches the address actually used. Never
   exercise this against the live roster or by sending real mail.
3. **Synthetic end-to-end staging smoke.** Build a private workbook and deployment with synthetic
   identities and run the real runtime sequence: fresh-PIN check-in, immediate bathroom request,
   automatic queue entry and promotion, fresh-PIN return, replay rejection, stale-tab rejection, a
   2.9-second non-countable return, a 3.0-second countable return, a teacher void, and lockout
   evidence. Local regression coverage is strong; this closes the gap to actual Apps Script
   transaction behavior without touching real student records.
4. **`NEEDS_RESEND` credential records.** Ten PIN-card records were repointed to corrected addresses
   during the identity migration, and their delivery status was set to `NEEDS_RESEND` because a prior
   `SENT` marker could not prove delivery to the corrected address. All ten students had already used
   their PINs successfully, so this is not a reason for a roster-wide reset. Review each record, decide
   whether that student actually needs another delivery, and keep any real send a separate,
   teacher-confirmed action.
5. **Netlify deploy fingerprint.** Read the successful Netlify deployment record and tie its deploy ID,
   timestamp and production URL to repository head `a0a55a1`, so the public-release proof is as
   recoverable as the Apps Script and workbook fingerprints.
6. **Recovery rehearsal.** Occasionally rehearse a rollback to the preserved Version 14 snapshot on a
   non-production copy, so the rollback path is known to work before it is ever needed.

## Release gate

Run before any production change:

```sh
npm run hall-pass:verify   # 58 handoff checks + Hall Pass runtime regressions
npm run check              # Astro and TypeScript
npm run build              # production build
npm run site:validate      # static route and local-reference check
```

Then follow the gates in `DEPLOY.md`: verify the Apps Script editor against the tracked source,
update the existing deployment rather than creating a new URL, and smoke student, kiosk, check-in
and teacher modes without using a real student PIN.
