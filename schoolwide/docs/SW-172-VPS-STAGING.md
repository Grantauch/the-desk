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

## Confirmed VPS baseline and operator preflight (not authorization to deploy)

The supplied OVHcloud VPS-2 specification is Ubuntu 26.04 LTS, 4 vCPU, 8 GB RAM, 75 GB storage in US East. Margin uses `margin.service`, Caddy, and a separate local PostgreSQL `margin` database. The server is configured for nightly `/srv/*/data` filesystem backups at 02:15, but **that pattern does not inherently capture database transactions or Docker named volumes**. It must not be treated as a PostgreSQL backup until an actual database dump and a restore have been verified. Margin's own Postgres backups must also be verified by its server owner.

The candidate caps its normal app and Postgres containers to 512 MiB and 1 GiB RAM respectively, with 1 vCPU per service. These are **staging safety limits**, not throughput guarantees; the preflight checks available capacity rather than presuming all 8 GB are free. Staging uses its own Compose network and database and never modifies `margin.service`, existing PostgreSQL roles, Caddy, DNS, or SSH.

TheAtlas is the authorized SSH bridge according to the server handoff; the remote device was unavailable at the time this source was prepared. No VPS commands were executed in this review.

Before an operator deploys, check the host without changing its services:

```sh
cd schoolwide
bash scripts/vps-host-preflight.sh
```

This reports capacity, Margin/Caddy health, port collisions and Docker availability without opening private configuration files. Treat any `BLOCK` result as a stop. It does **not** establish the existing backups' recoverability or authorize live student data.

Also verify OS patching, private network/firewall, free disk after image builds, and a working encrypted offsite backup with a tested restore. Confirm the school/district's privacy terms and hosting-region requirements before moving any actual student records.

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

## Staging database backup coverage

The Compose database is stored in a dedicated Docker volume and is intentionally **outside** Margin's database. The existing host's `/srv/*/data` backup job will not automatically include that Docker volume. For this *synthetic-only staging candidate*, `scripts/vps-staging-backup.sh` creates a restrictive PostgreSQL custom-format dump in `/srv/schoolwide/data/backups` that the host's filesystem backup can subsequently copy. It validates that the archive is readable, but that does not prove a full restore.

Once staging is actually deployed and an operator has verified the source and private environment file:

```sh
cd schoolwide
bash scripts/vps-staging-backup.sh
```

The operator must separately set up a scheduled backup run before the existing 02:15 filesystem backup window, and test restore into a **separate disposable database**. No schedule or offsite replication has been created by this PR. Retention, encryption, free-space alerts and a true restore rehearsal are required before any data-bearing environment is approved.

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
