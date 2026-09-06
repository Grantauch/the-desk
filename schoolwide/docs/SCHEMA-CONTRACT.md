# Schoolwide schema contract

Status: SW-020 relational foundation. This document describes storage ownership only. Business behavior remains owned by later SW batches.

## Canonical boundaries

- `organizations` is the future district/organization boundary.
- `schools` is the hard tenant boundary for school-owned operational data.
- Internal UUIDs are canonical. Email, display name, Google IDs, Classroom IDs and legacy keys are attributes or aliases, never person primary keys.
- School-owned joins use composite school keys where a cross-tenant reference would otherwise be possible.
- Staff users belong to an organization and receive school roles/section assignments separately.
- Configuration provenance actors may act across schools only inside their own organization; raw SQL cannot attach another organization's user as creator/updater/setter.
- Deactivation preserves rows. Institutional history is not cascade-deleted.
- School-local calendar facts use `date`; event timestamps use `timestamptz`.
- Provider-specific behavior is intentionally absent. The schema is standard PostgreSQL.

## Table ownership and lifecycle

| Table | Source of truth / provenance | Lifecycle | Behavior owner |
| --- | --- | --- | --- |
| `organizations` | GrantDesk admin configuration | mutable config, deactivate | SW-120 |
| `schools` | GrantDesk admin configuration | mutable config, deactivate | SW-120 |
| `academic_years` | school configuration | bounded dates, deactivate | SW-040/SW-120 |
| `academic_terms` | school configuration | bounded dates, retained | SW-040 |
| `users` | future Google staff sign-in + admin state | mutable identity attributes, deactivate | SW-030 |
| `staff_profiles` | school/district staff metadata | mutable, deactivate | SW-030/SW-120 |
| `user_roles` | server-side role grants | effective-dated/revocable | SW-030 |
| `students` | roster/import reconciliation | canonical person row, deactivate | SW-100/SW-140 |
| `student_identity_aliases` | manual/Classroom/legacy identity evidence | aliases retained/retired | SW-100/SW-140 |
| `sections` | manual/Classroom/legacy section reconciliation | deactivate, never destroy history | SW-090/SW-100/SW-140 |
| `section_staff_assignments` | role/section administration | effective-dated/revocable | SW-030/SW-120 |
| `enrollments` | manual/Classroom/legacy roster reconciliation | ACTIVE/INACTIVE/PENDING_REVIEW | SW-100/SW-140 |
| `schedule_profiles` | school configuration | mutable config, deactivate | SW-040 |
| `schedule_periods` | school configuration | retained with profile | SW-040 |
| `school_calendar_days` | explicit school calendar provenance | one authoritative row per school/date | SW-040 |
| `destinations` | school configuration | mutable config, deactivate | SW-070/SW-120 |
| `school_policy_sets` | school configuration | effective-dated, retained | SW-040/SW-120 |
| `policy_values` | policy-set configuration | mutable only through audited config service | SW-040 |
| `section_policy_overrides` | authorized staff override | effective-dated, retained | SW-040 |
| `student_access_rules` | authorized private access rule | effective-dated, retained | SW-040/SW-120 |
| `audit_events` | required application/system audit | append-only at database trigger | SW-080 |
| `idempotency_keys` | protected write request boundary | short-lived operational state | SW-050/SW-060/SW-070 |
| `transactional_outbox` | same transaction as future audited business writes | retryable mutable delivery state | SW-080/SW-130 |

## Tenant integrity

The following relationships are protected by composite keys rather than application filtering alone:

- student identity alias -> student within the same school
- enrollment -> section and student within the same school
- role grant -> school and user within the same organization
- section staff -> section in the same school and user in the same organization
- section -> academic year in the same school
- academic term -> academic year in the same school
- schedule period/calendar day -> schedule profile in the same school
- policy set -> academic year in the same school
- policy value -> policy set in the same school
- section override -> section in the same school
- student access rule -> student and optional section in the same school
- calendar/policy/override/access provenance actor -> user in the same organization as the owning school
- audit actor student -> student in the same school
- audit/idempotency/outbox organization -> school in the same organization

A staff user can legitimately hold assignments in multiple schools inside their organization; authorization for a particular school or section is therefore a role/assignment concern owned by SW-030, not a duplicated `school_id` on `users`.

## Identity rules

- Two students may have the same display name.
- `students.id` is the person key.
- `student_identity_aliases` carries mutable/retired aliases.
- `(school_id, kind, normalized_value)` is unique to prevent ambiguous authoritative alias resolution inside one school.
- Google staff subject IDs are unique when present, but Google OAuth behavior is not implemented until SW-030.
- No schema field stores plaintext PINs, OAuth tokens, PIN salt, or real production credentials.

## Schedule and policy storage versus behavior

SW-020 only stores the inputs. SW-040 owns effective-session and effective-policy calculation.

- `ordinal_by_time` exists so period labels do not imply chronological order.
- `school_calendar_days` is the explicit school-day record and may point to a schedule profile only on a school day.
- `school_policy_sets`, `policy_values`, `section_policy_overrides`, and `student_access_rules` retain provenance/effective intervals.
- Configuration actor references are organization-bound but intentionally not school-bound, allowing a future district administrator to configure multiple schools inside their organization when SW-030/SW-120 authorizes it.
- The database guarantees ownership and valid interval shape; it does not yet decide override precedence, eligibility, cooldown or pass limits.

## Audit, idempotency and outbox

- `audit_events` is append-only: UPDATE and DELETE are rejected by a database trigger.
- `correlation_id` joins synthetic/future business facts to audit and outbox records without exposing secrets.
- `idempotency_keys` prevents duplicate logical request keys within a school; later services own response replay semantics.
- `transactional_outbox` is deliberately mutable delivery state and has a bounded pending-work index.
- Sanitized JSON columns must never contain PINs, OAuth tokens, action-proof secrets or private credentials.

## Migration policy

`001_identity_and_tenancy.sql` is frozen as the verified SW-010 baseline. SW-020 begins the append-only durable chain:

1. `002_organization_academics.sql`
2. `003_schedule_calendar_policy.sql`
3. `004_idempotency_outbox_audit.sql`
4. `005_policy_actor_tenant_integrity.sql`

Migration 005 is an additive hardening migration discovered during SW-020 review. It backfills organization ownership from the already-validated school relationship before making the new keys NOT NULL, so it is safe for disposable or future synthetic development rows created after migration 003.

The current application has no persistent Schoolwide environment or real Schoolwide data, so SW-020 can safely introduce new NOT NULL tenant keys without a legacy Schoolwide backfill. Real legacy classroom migration is a separate later read-only/shadow process beginning at SW-140.
