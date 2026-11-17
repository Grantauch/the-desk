# SW-170 — Staging & Release Readiness

Status: IN PROGRESS — repository package built; external staging deployment pending

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

The first serious staging target is the approved Google Cloud project `grantdesk-deployment` in `us-central1`:

- Cloud Run for the containerized Schoolwide service;
- Cloud SQL for PostgreSQL;
- the Cloud Run/Cloud SQL Unix-socket integration for the application database connection;
- Secret Manager for the database URL and future provider secrets;
- Artifact Registry for immutable container images;
- Cloud Logging / Cloud Monitoring for service health and failure evidence;
- GitHub Actions with Workload Identity Federation for short-lived deployment authentication;
- a GitHub Environment named `schoolwide-staging` as an additional release boundary.

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
- deploy from an ordinary push, merge, or generic click-to-deploy action.

Repository staging qualification may run automatically on pull requests because it only verifies code, migrations, tests, and the deployable container image.

The actual staging deployment has a separate guarded trigger: a release-request commit that changes exactly one file. That request can deploy only the already-qualified parent commit, must explicitly say `STAGING_ONLY`, and must explicitly prohibit real data.

## Staging release gates

A staged release is acceptable only when all of these pass on the exact commit being deployed:

1. Schoolwide production firewall.
2. Staging-release machinery guard.
3. TypeScript check.
4. Complete Schoolwide automated test suite.
5. Production build.
6. Clean PostgreSQL migration run.
7. Immediate second migration run with no failure.
8. Deployable container image build.
9. Cloud SQL automated-backup, point-in-time-recovery and deletion-protection checks.
10. Immutable staged image tagged with the exact qualified Git commit SHA.
11. Cloud migration job completes successfully before the service is updated.
12. `/health/live` returns healthy.
13. `/health/ready` proves database readiness.
14. Root service fingerprint reports the expected Schoolwide release SHA.
15. Protected/private routes continue to fail closed while real identity providers are intentionally disabled.

## No-code cloud handoff

The one-time Google Cloud setup is scripted in `scripts/bootstrap-staging-gcp.sh`.

Grant's intended interaction is deliberately small:

1. Open Google Cloud Shell while `GrantDesk Deployment` is the selected project.
2. Run the approved bootstrap command.
3. Read the staging-only warning and type `CREATE-STAGING` to authorize creation of the isolated staging resources.
4. Copy the final `SW170_CLOUD_READY` block back to the release agent.

The bootstrap generates the database password itself and stores it directly in Secret Manager. It does not print that password in the completion block.

The returned completion block contains only non-secret resource identifiers. The release agent records those identifiers in `schoolwide/release/staging-cloud.json`; no database password, OAuth secret, service-account key, or student credential belongs in GitHub.

## Passwordless GitHub → Google trust

The bootstrap creates a Workload Identity Federation provider instead of a downloadable Google service-account JSON key.

The trust condition is restricted to:

- repository: `Grantauch/the-desk`;
- Git ref: `refs/heads/schoolwide/sw-170-staging-release-readiness`.

The Schoolwide verification gate tests that this branch restriction, keyless-auth design and release ordering remain present.

## Cloud SQL minimum operating policy

Before a staging deployment is considered complete, the Cloud SQL PostgreSQL instance must have:

- automated backups enabled;
- point-in-time recovery enabled;
- deletion protection enabled;
- a bounded Schoolwide database/user;
- application access through the Cloud Run-mounted `/cloudsql/...` socket;
- no database credential committed to the repository;
- zero real student/staff/PIN/OAuth/Classroom data during SW-170.

## Human release model

Grant does not need to know Docker, PostgreSQL, Cloud Run, IAM, or `gcloud` commands to operate Schoolwide.

Normal release behavior is:

- GitHub automatically proves whether the Schoolwide code, migrations, release guards and container qualify for staging;
- the one-time Google Cloud bootstrap creates the isolated resources and passwordless trust boundary;
- the safe resource identifiers are recorded in the Schoolwide branch;
- that exact resource-config commit must pass the full qualification gates;
- the release agent creates one staging request file naming the already-qualified parent commit;
- the deployment workflow builds that exact commit, migrates first, deploys second, and smoke-tests the result;
- the workflow records the staging URL and exact release SHA;
- any failed gate stops certification.

## Certification target

SW-170 is complete only when:

- the final pre-release parent commit passes Schoolwide CI;
- automatic staging qualification passes, including the deployable container build;
- `grantdesk-deployment` contains the isolated staging resources with branch-restricted Workload Identity Federation;
- an exact qualified SW-170 commit has been deployed to Cloud Run staging;
- migration + live + ready + exact-release + private-route smoke checks all pass;
- Cloud SQL backup/PITR/deletion protection are verified;
- no real student/staff data has been introduced;
- the existing Apps Script Hall Pass remains unchanged and authoritative.

Until those conditions are met, evidence must say `STAGING_SETUP_PENDING`, not production-ready.

## What comes next

After SW-170 is certified and frozen, SW-180 should wire real staff/student identity and finish ordinary-user UX against staging. Real data migration and classroom pilots remain later stages.
