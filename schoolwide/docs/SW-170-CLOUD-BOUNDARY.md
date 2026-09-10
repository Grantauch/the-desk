# SW-170 — Google Cloud Staging Boundary

This file is written so the Schoolwide staging environment can be configured without requiring Grant to become the system administrator or understand the application code.

## Grant's role

Grant is the product owner. His required decisions should be limited to:

- which approved Google Cloud project/account may host Schoolwide staging;
- whether the school/district permits the proposed staging data boundary;
- when a staged release may be promoted into later real-identity and pilot work.

Grant should not be expected to manage containers, database commands, credentials, migrations, or server restarts.

## Required staging resources

Create these inside one dedicated Google Cloud project:

1. **Cloud Run service** — `grantdesk-schoolwide-staging`
2. **Cloud Run migration job** — `grantdesk-schoolwide-staging-migrate`
3. **Cloud SQL for PostgreSQL** — dedicated staging instance and database
4. **Secret Manager secret** — contains the runtime database URL; never store the value in GitHub source
5. **Artifact Registry repository** — stores immutable Schoolwide container images
6. **Runtime service account** — used only by the Cloud Run service/job
7. **Deployment service account** — used only by the GitHub staging release lane
8. **Workload Identity Federation provider** — trusts GitHub's short-lived OIDC identity for `Grantauch/the-desk`; do not create a downloadable service-account key
9. **Cloud Logging / Monitoring** — retain service errors, restart evidence and readiness failures

Resource names may differ if the hosting organization has naming standards. Record the final identifiers as GitHub Environment variables rather than application source.

## Database protection gate

The Cloud SQL staging instance is not acceptable until all of the following are true:

- PostgreSQL is supported by the Schoolwide migration suite;
- automated backups are enabled;
- point-in-time recovery is enabled;
- deletion protection is enabled;
- a dedicated Schoolwide database/user is used;
- the database is not treated as an extension of the current classroom workbook;
- no real student, staff, PIN, OAuth, or Classroom data is loaded during SW-170.

## Identity / secret rule

GitHub-to-Google deployment authentication must use Workload Identity Federation and short-lived credentials.

Do not store:

- Google service-account JSON keys;
- database passwords/URLs;
- OAuth client secrets;
- student credentials;
- legacy workbook IDs or export payloads

in repository source or normal GitHub variables.

Actual runtime secrets belong in Secret Manager. GitHub variables may contain only resource identifiers needed to locate the approved staging resources.

## Minimum IAM shape

Keep the two service accounts separate.

### Runtime service account

It needs only what the running service/job requires, including:

- connect to the assigned Cloud SQL instance;
- read the specific Secret Manager secret(s) assigned to Schoolwide staging;
- write normal service logs/metrics through the platform.

It should not administer Cloud Run, create databases, alter IAM, or write to the legacy Apps Script system.

### Deployment service account

It needs only what the staging release lane requires, including:

- push images to the staging Artifact Registry repository;
- update the named staging Cloud Run service and migration job;
- act as the approved runtime service account when deploying those resources;
- inspect the staging Cloud SQL/secret/resource configuration needed for release preflight.

It should not own the Google Cloud project and should not have organization-wide authority.

The Workload Identity Federation trust must be restricted to the `Grantauch/the-desk` repository and, when configured through a GitHub Environment, the `schoolwide-staging` release boundary.

## GitHub Environment

Create a GitHub Environment named:

`schoolwide-staging`

Record these identifiers as environment/repository variables:

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

No value in this list should itself contain a database password or application credential.

## Deployment sequence

When cloud access is connected, the release agent should perform this sequence on one exact Git commit:

1. pass Schoolwide CI;
2. pass staging qualification and build the container;
3. verify the Cloud SQL backup/PITR/deletion-protection gate;
4. build and push an immutable container image tagged with the exact Git SHA;
5. run migrations as a one-off staging migration job;
6. update the staging service only if migrations succeed;
7. run `scripts/staging-smoke.mjs` against the resulting staging URL;
8. record the exact Git SHA, image identifier and staging URL;
9. leave staff identity, student identity, Classroom synchronization and legacy writes disabled in SW-170.

A failed step stops the release. Do not call a partially updated environment certified.

## SW-170 exit evidence

The release checkpoint needs evidence for:

- repository CI PASS;
- exact container build PASS;
- staging Cloud SQL protection PASS;
- staging migration PASS;
- live/readiness PASS;
- exact release SHA PASS;
- private route fail-closed PASS;
- real-data count = 0;
- production impact = NONE.

Only then should SW-170 be frozen and SW-180 begin real Google identity and ordinary-user UX work.
