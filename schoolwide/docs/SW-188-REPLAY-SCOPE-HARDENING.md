# SW-188 — Replay scope hardening (synthetic only)

**Decision: NO-GO for real PIN handoff or schoolwide deployment.** This batch addresses only Claude's PR #524 defense-in-depth review items C, D and E in the disabled, synthetic-only existing-PIN contract. It does not add a live route, source PIN verifier, student identity mapping, cleanup scheduler, or deploy anything. Existing Hall Pass, Check-In, Apps Script, student PINs and student records must not be read or modified.

## C — Bind both school and audience into the replay digest

Previously the one-way nonce digest used `SHA256("schoolwide-one-use-nonce-v1\\0" + issuer + "\\0" + nonce)`. The SQL uniqueness key already enforced school and issuer, and the signed attestation checked audience. Nevertheless the digest by itself did not include the entire signed destination scope.

The replacement is `SHA256("schoolwide-one-use-nonce-v2\\0" + issuer + "\\0" + canonicalSchoolId + "\\0" + audience + "\\0" + nonce)`. All inputs come from previously verified **signed** claims. No source PIN, student alias, salt, key or clear token is in the digest or the SQL table. The change has a new domain separator to avoid accidentally treating an old-scope digest as equivalent; this is a **synthetic-only protocol change**, not authorization to rotate a production system. It does not undo one-time consumption, atomic PostgreSQL uniqueness or wrong-PIN burn-before-check.

New unit tests deliberately construct **distinct signed fictional tokens with the same nonce** and prove unique digests for a different signed school or audience, plus exact v2 digest reproducibility.

## D — Canonicalize UUID school identifiers consistently

A UUID has the same identity regardless of hexadecimal letter case. Synthetic opaque school aliases, by contrast, remain case-sensitive.

- On token issuance, school IDs matching UUID syntax are lowercased before signing.
- During verification, an expected UUID school ID is normalized before comparison to the signed claim. Wrong schools still fail *before* consuming the nonce.
- The trusted PostgreSQL scope and consumption school UUID are compared case-insensitively and the INSERT always uses the scope's lowercase UUID. There is still exactly **one** replay key for that school.
- Synthetic tests prove a signed uppercase UUID becomes lowercase, can be matched by an uppercase trusted scope, is rejected under the wrong UUID, and cannot be consumed twice across separate database pools.

This doesn't establish that a given UUID is correctly mapped to a district student. A trusted server-side district identity mapping remains a separate, unapproved requirement.

## E — Scoped expired replay cleanup index

Migration `020_synthetic_pin_handoff_replay.sql` remains **unchanged**. New additive migration `021_synthetic_replay_scoped_expiry_index.sql` adds:

```sql
CREATE INDEX IF NOT EXISTS legacy_pin_handoff_replays_school_issuer_expiry_idx
  ON legacy_pin_handoff_replays (school_id, issuer, expires_at);
```

This matches the existing bounded cleanup's school + issuer filter and expiration ordering. It is still scoped by organization in the WHERE clause. The old general `expires_at` index and primary key remain. The migration has no schema changes that expose or import a real PIN or student identity, and its presence is verified in PostgreSQL schema integration tests. Schema expectations are updated from **20 to 21** ordered migrations, and the recovery CI scripts already compare source and restored migration counts dynamically.

**Important:** A migration file in an unmerged GitHub branch is not evidence that any database was modified. Do not run this against private or production school data without separate authorization.

## Verification and decision boundaries

Required before accepting source changes:

- Fixed-clock synthetic attestation tests for issuer, audience, school, PIN, leading zeros, TTL, wrong-PIN burn-before-check and concurrency
- SW-188 same-nonce/different-scope digest separation and UUID case normalization tests
- Disposable PostgreSQL 18 tests: two-pool one-use behavior, uppercase UUID scope, school isolation, cleanup lock handling, 21 ordered migrations and index definition
- Production runtime import-isolation guard, parsed workflow firewall and pinned action checks
- GitHub exact-head Schoolwide CI, Staging Qualification, site check and separate-runner fictional encrypted recovery

The existing Team Desk decision barring **all agents from merging, approving, or deploying Schoolwide PRs while Claude is away** remains active. The updated head of [PR #524](https://github.com/Grantauch/the-desk/pull/524) must receive a new independent review. District permission, a real source verifier and key custody, managed Chromebook/school network acceptance, actual encrypted offsite backup/independent restore, and rollback remain mandatory gates for any student-facing cutover.
