# SW-170 — Google Cloud Staging Boundary

This file defines the one-time cloud setup and ongoing release boundary without requiring Grant to become the system administrator or understand application code.

## Grant's role

Grant is the product owner. His required decisions are limited to:

- which approved Google Cloud project/account may host Schoolwide staging;
- whether the school/district permits the proposed staging data boundary;
- when a staged release may advance into later real-identity and pilot work.

Grant should not be expected to manage containers, databases, IAM roles, credentials, migrations, or server restarts.

## Approved SW-170 target

- Google Cloud project: `grantdesk-deployment`
- region: `us-central1`
- environment: staging only
- real school data: prohibited
- production authority: unchanged

## Required staging resources

The guarded bootstrap creates or preserves:

1. **Cloud Run service** — `grantdesk-schoolwide-staging`
2. **Cloud Run migration job** — `grantdesk-schoolwide-staging-migrate`
3. **Cloud SQL PostgreSQL instance** — `grantdesk-schoolwide-staging`
4. **Schoolwide database** — `grantdesk_schoolwide`
5. **Secret Manager secret** — `grantdesk-schoolwide-staging-db-url`
6. **Artifact Registry repository** — `grantdesk-schoolwide`
7. **Runtime service account** — `grantdesk-sw-runtime`
8. **Deployment service account** — `grantdesk-sw-deploy`
9. **Workload Identity Federation pool/provider** — passwordless GitHub deployment identity
10. Cloud platform logging/health evidence used by the release gate.

## Database protection gate

The Cloud SQL staging instance is not acceptable until all of the following are true:

- automated backups are enabled;
- point-in-time recovery is enabled;
- deletion protection is enabled;
- a dedicated Schoolwide database/user is used;
- the application connects through Cloud Run's mounted `/cloudsql/...` Unix socket;
- no database password is committed to GitHub;
- no real student, staff, PIN, OAuth, Classroom, or legacy-export data is loaded during SW-170.

## Secret rule

GitHub-to-Google deployment authentication uses Workload Identity Federation and short-lived credentials.

Never store in repository source:

- Google service-account JSON keys;
- database passwords or full database URLs;
- OAuth client secrets;
- student credentials;
- PIN material;
- legacy workbook IDs or export payloads.

The bootstrap generates the staging database password and writes its database URL directly to Secret Manager. The completion block deliberately returns only safe resource identifiers.

## Minimum IAM shape

Keep the runtime and deployment identities separate.

### Runtime service account

It may:

- connect to the assigned Cloud SQL instance;
- read the specific Schoolwide staging database secret;
- use normal Cloud Run platform logging/metrics.

It should not administer Cloud Run, alter IAM, own the project, or access the legacy Apps Script system.

### Deployment service account

It may perform the bounded staging release work, including:

- update the named staging Cloud Run service and migration job;
- push images to the staging Artifact Registry;
- inspect the staging Cloud SQL/secret configuration used by release preflight;
- act as the approved runtime account while deploying those named resources.

It should not own the project or receive organization-wide authority.

## GitHub trust boundary

The Workload Identity Federation provider is restricted to both:

- `Grantauch/the-desk`; and
- `refs/heads/schoolwide/sw-170-staging-release-readiness`.

No downloadable service-account key is created.

The deployment workflow also requires a one-file release-request commit. That request can deploy only its already-qualified parent commit and must assert:

- `authority: STAGING_ONLY`
- `real_data_allowed: false`

## Resource configuration

After the bootstrap finishes, it prints a block beginning `SW170_CLOUD_READY`.

Those returned values are resource identifiers, not credentials. The release agent records them in:

`schoolwide/release/staging-cloud.json`

The staging-release guard rejects known secret-bearing fields from that file.

## Deployment sequence

Once the cloud foundation exists:

1. record the safe cloud resource identifiers in `staging-cloud.json`;
2. allow that commit to pass Schoolwide CI, staging qualification, and site check;
3. create `staging-deploy-request.json` as the only file changed in the next commit;
4. require the request to name its already-qualified parent SHA and remain `STAGING_ONLY` with real data prohibited;
5. authenticate to Google through short-lived Workload Identity Federation;
6. verify Cloud SQL backups/PITR/deletion protection;
7. check out and build the exact qualified parent commit;
8. push its immutable image tagged with that SHA;
9. run database migrations as a one-off Cloud Run job;
10. update the staging service only if migrations succeed;
11. run `scripts/staging-smoke.mjs` against the resulting staging URL;
12. record the exact release SHA, request SHA, image identifier and URL.

A failed step stops certification.

## SW-170 exit evidence

The final checkpoint needs evidence for:

- repository CI PASS;
- staging qualification + container build PASS;
- branch-restricted keyless Google authentication PASS;
- Cloud SQL backup/PITR/deletion protection PASS;
- staging migration PASS;
- live/readiness PASS;
- exact release SHA PASS;
- private route fail-closed PASS;
- real-data count = 0;
- production impact = NONE.

Only then should SW-170 be frozen and SW-180 begin real Google identity and ordinary-user UX work.
