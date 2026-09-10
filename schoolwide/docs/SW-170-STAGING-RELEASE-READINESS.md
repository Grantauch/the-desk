# SW-170 — Staging & Release Readiness

Status: IN PROGRESS

## Purpose

Turn the certified SW-160 Schoolwide engine into a deployable, observable staging service without making it authoritative for any real classroom.

SW-170 is a productization/release-readiness batch, not a new Hall Pass feature batch.

## Plain-language outcome

At the end of SW-170, Grant should be able to open one staging URL and answer three questions without knowing code:

1. Is the Schoolwide service online?
2. Can it reach its database?
3. Did the latest staged release pass its safety checks?

The staging environment must be safe to leave running without changing the current Apps Script Hall Pass, workbook, stable `/exec`, or grant-desk.com production routes.

## Chosen staging architecture

The first serious staging target is Google Cloud:

- Cloud Run for the containerized Schoolwide service;
- Cloud SQL for PostgreSQL;
- Secret Manager for database and future provider secrets;
- Artifact Registry for immutable container images;
- Cloud Logging / Cloud Monitoring for service health and failure evidence;
- GitHub Actions with Workload Identity Federation for short-lived deployment authentication;
- a GitHub Environment named `schoolwide-staging` as the release boundary.

This follows ADR-0001's portable runtime decision. Google Cloud is an operational deployment choice, not a domain dependency.

## Hard safety boundaries

SW-170 MUST NOT:

- switch any student or staff link to Schoolwide;
- change or write the legacy Apps Script Hall Pass or workbook;
- import real school data;
- enable real staff or student identity providers;
- enable real Google Classroom synchronization;
- migrate or reveal real PINs, PIN hashes, salts, peppers, OAuth tokens, or other credentials;
- create a production Schoolwide environment;
- make Schoolwide authoritative;
- deploy automatically from a push or merge.

Repository staging qualification may run automatically on pull requests because it only verifies code, migrations, tests, and the deployable container image. Any future action that actually changes Google Cloud staging must remain a separate manual release step and fail closed if required environment configuration is missing.

## Staging release gates

A staged release is acceptable only when all of these pass on the exact commit being deployed:

1. Schoolwide production firewall.
2. TypeScript check.
3. Complete Schoolwide automated test suite.
4. Production build.
5. Clean PostgreSQL migration run.
6. Immediate second migration run with no failure.
7. Deployable container image build.
8. Immutable staged image tagged with the exact Git commit SHA.
9. Cloud migration job completes successfully before the service is updated.
10. `/health/live` returns healthy.
11. `/health/ready` proves database readiness.
12. Root service fingerprint reports the expected Schoolwide release.
13. Protected/private routes continue to fail closed while real identity providers are intentionally disabled.

## GitHub environment configuration

A future manual cloud deployment consumes configuration from the GitHub Environment `schoolwide-staging`. No long-lived Google service-account JSON key is permitted.

Required repository/environment variables:

- `GCP_PROJECT_ID`
- `GCP_REGION`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`
- `GCP_ARTIFACT_REPOSITORY`
- `GCP_CLOUD_RUN_SERVICE`
- `GCP_CLOUD_RUN_MIGRATION_JOB`
- `GCP_CLOUD_SQL_CONNECTION`
- `GCP_RUNTIME_SERVICE_ACCOUNT`
- `GCP_DATABASE_URL_SECRET`

These are identifiers, not application secrets. `GCP_DATABASE_URL_SECRET` names a Secret Manager secret; the database URL value itself must never be stored in GitHub source.

## Cloud SQL minimum operating policy

Before a staging deployment is considered complete, the Cloud SQL PostgreSQL instance must have:

- automated backups enabled;
- point-in-time recovery enabled where the selected Cloud SQL tier supports it;
- deletion protection enabled;
- no public database password committed to the repository;
- a documented restore rehearsal plan;
- a bounded database user dedicated to Schoolwide.

## Human release model

Grant does not need to know Docker, PostgreSQL, Cloud Run, or `gcloud` commands to operate Schoolwide.

Normal release behavior should be:

- GitHub automatically proves whether the Schoolwide code/migrations/container qualify for staging;
- an authorized person or connected release agent manually starts the actual cloud staging release;
- the release path migrates, deploys, and smoke-tests the exact certified commit;
- the release record captures the staging URL and release SHA;
- failures stop the release rather than partially declaring success.

## Certification target

SW-170 is complete only when:

- this branch passes Schoolwide CI;
- automatic staging qualification passes, including the deployable container build;
- a real `schoolwide-staging` environment has been configured with short-lived Google authentication;
- an exact SW-170 commit has been deployed to staging through a manual release action;
- migration + service smoke checks pass against that deployed staging environment;
- Cloud SQL backup settings are recorded;
- no real student/staff data has been introduced;
- production remains unchanged.

Until those conditions are met, label evidence `STAGING_SETUP_PENDING`, not production-ready.

## What comes next

After SW-170 is certified, SW-180 should wire real staff/student identity and finish ordinary-user UX against staging. Real data migration and classroom pilots remain later stages.
