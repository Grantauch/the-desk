# SW-172 — isolated VPS staging candidate (no real student data)

> STATUS: SOURCE REVIEW ONLY. This is **not deployed**, **not approved for student use**, and **not a production cutover**. The legacy Google Apps Script Hall Pass and Check-In remain authoritative. No PINs, rosters, attendance, student names, Google secrets, or exports may be introduced during this stage.

## Why this exists

Grant's rented VPS is hosting Margin separately. Schoolwide already has a portable Fastify/PostgreSQL core and test fixtures, but SW-170 bound all staging startups to a Cloud SQL socket. This candidate makes an **explicit**, restricted VPS staging option possible without changing the Cloud SQL default or weakening the legacy-production firewall.

The VPS deployment is a separate stack. Do **not** attach to the existing Margin database, use its credentials, modify its Caddy site, or share its runtime volume. Do **not** route `/pass/`, `/check-in/`, existing `/exec` URLs, or active student traffic here.

## Repository review gates before use

- Review this change against parent `schoolwide/sw-171-commercial-hardening`, not against the website's `main`.
- Run `npm run verify` from `schoolwide/`, then run database migrations and the full Schoolwide integration suite against a **disposable** PostgreSQL 18 database in CI. An unrun or failing check is not a pass.
- Confirm the existing Cloud SQL staging guard tests still pass and the VPS path tests reject a public database host and production tier.
- Inspect all image packages and the container build; the inherited Dockerfile currently uses `npm install` without a committed lockfile. Pin dependencies and produce a reviewed immutable image before any environment can hold real data.
- Confirm a clean source tree and an exact, reviewed 40-character commit SHA before building.

## What this candidate provides

- PostgreSQL 18 in a **separate** named volume; database port is not published.
- Independent migration job that must exit successfully before the service starts.
- Service bound only to `127.0.0.1:18787` on the host; Caddy and Margin's current network configuration are not modified.
- Production writes to legacy Apps Script are always forbidden.
- Workers and external Google identity providers remain disabled.
- Private staging database URL can only target `postgres:5432/grantdesk_schoolwide_stage` as `grantdesk_stage`; a real Internet hostname fails startup.
- Liveness, readiness, and unauthorized-teacher-route checks reuse `scripts/staging-smoke.mjs`.
- Restart policy and bounded application log files; operational alerting and real backup restoration are **not** certified by Compose alone.

## Operator preflight (not authorization to deploy)

Before an operator deploys this separate candidate to the VPS, verify enough RAM/CPU/disk for **Margin and this isolated PostgreSQL**, free loopback port 18787, OS patching, Docker Compose availability, firewall, and encrypted offsite backups. Confirm the school/district's privacy terms and hosting-region requirements before moving any actual student records.

From an *authorized and reviewed* checkout of `schoolwide/sw-172-vps-staging-candidate`, with no uncommitted files:

```sh
cd schoolwide
test -z "$(git status --porcelain)" || { echo 'Refusing unreviewed changes'; exit 1; }
REVIEWED_SHA="$(git rev-parse HEAD)"
test "${#REVIEWED_SHA}" -eq 40 || exit 1
umask 077
DB_PASSWORD="$(openssl rand -hex 32)"
printf 'SCHOOLWIDE_DB_PASSWORD=%s\nSCHOOLWIDE_RELEASE_SHA=%s\n' "$DB_PASSWORD" "$REVIEWED_SHA" > deploy/.env.vps-stage
unset DB_PASSWORD REVIEWED_SHA
chmod 600 deploy/.env.vps-stage
docker compose --env-file deploy/.env.vps-stage -f deploy/vps-staging.compose.yml config --quiet
```

The `.env.vps-stage` file is ignored by Git and must remain on the VPS in an access-restricted directory; do not send it to chat, logs, GitHub, browser consoles, or students. The placeholder values in source/tests are deliberately synthetic and not deployed passwords.

After operator authorization and a successful CI review:

```sh
docker compose --env-file deploy/.env.vps-stage -f deploy/vps-staging.compose.yml up -d --build
curl --fail --show-error http://127.0.0.1:18787/health/live
curl --fail --show-error http://127.0.0.1:18787/health/ready
STAGING_URL=http://127.0.0.1:18787 EXPECTED_RELEASE_SHA="$(git rev-parse HEAD)" node scripts/staging-smoke.mjs
```

Never open PostgreSQL port 5432 or the loopback staging service to the public Internet. If a remote synthetic classroom test becomes necessary, use a vetted VPN/private test path or a separately protected Caddy route. Do not use an existing Margin hostname for this service.

## Safe failure and cleanup

If the migration fails, the app must not start. Examine sanitized container logs without exposing `DATABASE_URL`, passwords or real student records. Preserve the isolated volume for debugging. Stop the candidate with:

```sh
docker compose --env-file deploy/.env.vps-stage -f deploy/vps-staging.compose.yml down
```

**Do not use `down --volumes`** unless explicitly destroying a purely synthetic disposable environment with approved recovery evidence. Do not change existing Margin DNS, Margin Caddy routes, Vercel, live Apps Script, schoolwide student directory, or credentials during this work.

## Acceptance required before any Hall Pass / Check-In cutover

1. **Margin first:** finish two-browser/two-device classroom sync, interruption/reconnect and recovery checks; verify actual VPS/HTTPS routing rather than assuming a GitHub merge equals a live deploy.
2. **Server reliability:** measure Margin load and Schoolwide resource contention. Establish disk alerts, service restarts, remote encrypted backups, *tested* PostgreSQL restore, certificate monitoring and secret rotation.
3. **Synthetic functional parity:** Google staff identity, school/teacher section isolation, student PIN preservation (raw digit strings including leading zeros, hashed only), active/inactive student restrictions, action proofs, attendance windows, deduplication, late review, the pass line, return, 3-second countability, and full audit history.
4. **Classroom load:** exercise 35 simultaneous check-ins, multiple 35-student periods, kiosks and teacher dashboards together; record p50/p95/p99 latency, 429s, failures, queue consistency, database connections and memory. Targets are provisional until measured.
5. **Legacy data reconciliation:** only after district authorization, use the read-only importer and non-authoritative shadow comparison. Never import real records into this synthetic-only stage; any later restricted environment needs a separately approved design.
6. **Release:** obtain owner/district approval; take and verify recovery copies; avoid a mid-class switch; move routes only after proven parity; execute a tested rollback that prevents split-brain writes and loss of records.

## Known remaining blockers

- No SSH/hosting-provider access or actual VPS specifications are established in this task.
- The current private Margin app has not passed a real two-device acceptance test.
- Schoolwide's student-facing browser login, production Google OAuth, and full roster/credential migration are not certified.
- This candidate does not implement a complete release pipeline, public hostname, cloud backup, operational monitoring, or a school/district security approval.
- Both the current classroom system and Schoolwide staging must keep isolated ownership until a documented cutover.

**Exit state:** a reviewable VPS staging candidate. No production merge, no real student data, no service deployment, no public URLs switched.
