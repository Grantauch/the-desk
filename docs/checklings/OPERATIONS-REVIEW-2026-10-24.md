# Independent operations design review — October 24, 2026

Owner/reviewer: Codex. Scope: technical review of [PR #235](https://github.com/Grantauch/the-desk/pull/235), head `f70d3799a48edc6d641c2e56859b905e53621de7`, operations document blob `242e9e5bfd8752ad3d61ce2245d8cf108ecaca44`. Evidence: **DESIGN REVIEWED; NOT PROVISIONED, RESTORED OR DEPLOYED**.

## Decision

The proposed isolation and recovery architecture is suitable as the technical basis for staging preparation. No source-level objection blocks that design. It separates the game service/database from school commits, preserves opaque identities and their recovery keys, distinguishes migration/runtime/backup privileges, and requires independent-client receipt/recovery checks. Its capacity and recovery figures are targets, not measured results.

This technical decision does not satisfy CK-HOST-001's complete acceptance gate. The owner still needs concrete provider, region/privacy, spending ceiling, retention, operator and key-escrow decisions. Actual hosting, least-privilege grants, encrypted backup/restore and school/Chromebook acceptance require separate observed evidence. Preserve the other author's proposal and task ownership; record this review alongside it.

## Required interpretation during implementation

- Review publication of Batch05 is now explicitly authorized by Grant. The original cloud workspace was removed by maintenance. Its source was recovered from recorded changes and proven identical by complete Git tree `8e20ee6134a9943b2d9d6bc07868f823d67fd940`, preserved as new commit `c4807fc0a2ad41e7cc731757baba8412d018591b`. The proposal's publication-blocked statement is historical. Source publication and school deployment remain separate actions.
- Batch05 access leases expire within 120 seconds. A launch or explicit teacher refresh renews the class; no automatic renewal exists. A staging host must demonstrate sustained, usable renewal and fail-closed expiry before extended play is called ready. A mounted endpoint alone does not satisfy this requirement.
- Run the recovery checks for schemas actually implemented. Battles, inventory, memorials and lineage are future restore cases; they cannot be counted as passing while their tables/gameplay do not exist. Founder identity, names, homes, revisions, events, receipts, authentication epochs and migration checksums are current checks.
- Native PostgreSQL recovery must use a PostgreSQL-compatible backup/restore path. The embedded PGlite archive test establishes its own close/reopen/archive behavior and does not establish managed PostgreSQL backup durability.
- Private school identity-key escrow and bridge class revision counters are external recovery dependencies. Never put their values in a public manifest. A game database backup cannot reconstruct them by itself.
- Prove runtime permissions with denied destructive/audit-modifying operations under the actual runtime credential. A role name or deployment configuration file does not prove least privilege.
- Force a fresh school launch after recovery unless session continuity has its own reviewed design. Verify expired/paused/revoked access and stale tabs remain rejected; receipt recovery must not grant duplicate progress.

## Integration sequence

1. Publish the recovered Batch05 review branch; inspect its native PostgreSQL, browser and protected site checks.
2. Combine Batch05 with PR #239's shared-device transport-failure repair and test the combination. Preserve both histories and their evidence.
3. Prepare CK-HOST-001's isolated staging package against that combined source. Obtain the concrete infrastructure decisions before provisioning. Keep school imports and production publication gated.
4. Measure a synthetic backup/restore rehearsal, lease renewal and two-device behavior before the guarded pilot migration. Classroom validation remains a later, separately recorded result.

References: [Batch05 lease and release boundaries](BATCH-05-SCHOOL-BRIDGE.md), [database/transaction adapter](../../apps/checklings-service/database.mjs), [shared-device privacy review](INTEGRATION-REVIEW-2026-10-24.md), and the reviewed operations proposal in PR #235. This review contains no claim of a hosted service or working backup.
