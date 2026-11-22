# SW-184 — Bounded expiry cleanup for disabled synthetic PIN replay guards

**Scope:** Source-only retention helper and CI tests. The original Hall Pass and Check-In, students, live lunch-number PINs, Apps Script, private VPS service, and production are unchanged. This batch must NOT connect the credential handoff or schedule real maintenance.

## Finding

SW-176 migration 020 created `legacy_pin_handoff_replays`, with expiry timestamps, one-way SHA-256 digests, a uniqueness key and an `expires_at` index. SW-176 inserts a new record for each synthetic one-use confirmation, but there was **no deletion or cleanup mechanism**. If deployed without retention controls, this ledger could grow indefinitely and retain metadata beyond the token's sixty-second validity.

## Remediation

`pruneExpiredSyntheticNonceReplays(database, scope, limit=250)` uses an explicit trusted `organizationId` + `schoolId` + `issuer` and only deletes records whose `expires_at` is on or before the PostgreSQL server's current time. It uses the existing expiry index and a single bounded SQL statement:
- `LIMIT` is a safe integer between 1 and **500**; larger, negative, fractional or non-finite limits are rejected before SQL.
- `FOR UPDATE SKIP LOCKED` avoids waiting on other maintenance workers and prevents double deletion across database connections.
- Deletes are constrained to the exact trusted school + organization + issuer. Another school's records are not touched.
- Unexpired rows are always retained, preserving the one-use replay check. The returned count is only a count of removed rows, not a student or credential detail.
- A missing, invalid or spoofed scope fails closed; database errors use a generic message without leaking SQL, nonce, issuer, or school identifiers.
- The helper does **not** run automatically in the student-facing application. An independently approved background maintenance owner and schedule would be required after the overall authentication architecture is approved.

There is no new database migration: migration 020's existing index supports this query. We do not rewrite previously applied migrations.

## Acceptance

The isolated PostgreSQL integration test runs **only** in a GitHub-hosted Linux `NODE_ENV=test` job with forbidden legacy writes and exact `127.0.0.1` ephemeral `grantdesk_schoolwide` database. It creates its own randomized fictional organization and two schools, inserts expired and unexpired one-way synthetic digests, and removes all fixtures afterward. It verifies:
1. Input scope and 1–500 batch limits fail before SQL.
2. At most the requested number of expired rows are removed per call.
3. No cross-organization, cross-school, or cross-issuer cleanup and no unexpired deletion.
4. A row locked by another database connection is skipped and can be cleaned after its lock is released.
5. Concurrent workers do not count/delete any record twice.
6. The replay schema still contains no source PIN, student alias, raw token, source hash, salt, or secret.

The original 35-concurrent single-use protection, wrong-PIN burn-before-check, SW-181 cross-scope denial, and SW-178 disconnected-authentication guard remain in full CI. The existing Schoolwide test service is disposable, synthetic-only, and cannot verify real school-network performance or production retention.

## Release decision

Keep PR #503 and its parent #498 unmerged pending Claude's independent security review. This is a **reviewable helper**, not a claim that automatic cleanup or private-school retention is now operational. Do not start a scheduler, connect a source PIN verifier, migrate a roster, publish a Chromebook kiosk, or touch live Hall Pass/Check-In until district authorization, approved identity mapping, and real recovery/ChromeOS evidence exist.
