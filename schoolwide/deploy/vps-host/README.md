# SW-172 systemd/PG18 staging on grant-server (synthetic data ONLY)

This is the preferred staging route for the existing OVHcloud VPS-2. The host has Node 22.22, PostgreSQL 18.6, `systemd` and no Docker. Margin already uses PostgreSQL 18-main on TCP 5432; Checkaverse runs separately. **Do not install Docker or modify the Margin/Checkaverse services to run this test.**

## Isolation contract

- Independent PostgreSQL 18 cluster `18/schoolwide_stage` listens only on localhost port **55432**.
- Separate operating-system account and PostgreSQL role `grantdesk_stage`, peer authenticated via `/var/run/postgresql`.
- Database `grantdesk_schoolwide_stage`; does not share Margin tables/roles/data or the main 5432 cluster.
- Staging API binds `127.0.0.1:18787` only; not publicly routed through Caddy.
- `LEGACY_PRODUCTION_WRITES=forbidden`; no real identities, tokens, PINs, student or teacher records, imports, or sync workers.
- Hardened systemd unit `deploy/vps-host/grantdesk-schoolwide-staging.service`, with 768 MiB memory and one vCPU limits, starts migrations first.
- Host read-only preflight: `SCHOOLWIDE_STAGING_MODE=vps-host bash scripts/vps-host-preflight.sh`.
- Leave the old Apps Script and GrantDesk public student launch links untouched.

## Host provisioning (operator-only, after exact green GitHub checks)

Do not run when any of these names/ports are already in use. Confirm server health, disk free, exact reviewed branch, and no existing `/srv/schoolwide` application before starting.

```bash
# Dedicated account and a NEW PostgreSQL cluster: never alter 18/main.
sudo useradd --system --user-group --home-dir /srv/schoolwide --shell /usr/sbin/nologin grantdesk_stage
sudo pg_createcluster 18 schoolwide_stage -p 55432 --start
sudo -u postgres createuser -p 55432 --no-superuser --no-createdb --no-createrole grantdesk_stage
sudo -u postgres createdb -p 55432 -O grantdesk_stage grantdesk_schoolwide_stage

# Inspect and reject unexpected non-loopback listeners:
pg_lsclusters
ss -ltn | grep 55432
sudo -u grantdesk_stage psql -h /var/run/postgresql -p 55432 -d grantdesk_schoolwide_stage -Atqc 'select current_user'
```

The private source checkout may use a sparse clone of the public `Grantauch/the-desk` repository pinned to the exact reviewed commit. Run `npm install --no-audit --no-fund` and `npm run build` in `schoolwide/`. Do not check out a floating branch for the running release without recording the deployed SHA.

Create `/etc/grantdesk-schoolwide/staging.env` root-owned mode 0600, with these exact public settings and an actual reviewed release SHA (no password needed for Unix peer auth):

```sh
NODE_ENV=production
HOST=127.0.0.1
PORT=18787
LOG_LEVEL=info
DATABASE_URL=postgresql://grantdesk_stage@localhost:55432/grantdesk_schoolwide_stage
DATABASE_SOCKET_PATH=/var/run/postgresql
DB_POOL_MAX=10
SCHOOLWIDE_INSTANCE_ID=grant-server-synthetic-stage
DEPLOYMENT_TIER=staging
STAGING_PLATFORM=vps-host
RELEASE_SHA=REPLACE_WITH_REVIEWED_40_CHAR_SHA
LEGACY_READ_ADAPTER_MODE=disabled
LEGACY_PRODUCTION_WRITES=forbidden
OPERATIONS_WORKERS_ENABLED=false
```

Set `/srv/schoolwide/current` to the reviewed built release directory. Install the committed systemd unit and validate it with `sudo systemd-analyze verify /etc/systemd/system/grantdesk-schoolwide-staging.service`. Only then `sudo systemctl daemon-reload` and `sudo systemctl enable --now grantdesk-schoolwide-staging.service`. A failed migration prevents startup. No Caddy/DNS/ufw edits are necessary.

## Synthetic acceptance

```sh
curl -fsS http://127.0.0.1:18787/health/live
curl -fsS http://127.0.0.1:18787/health/ready
STAGING_URL=http://127.0.0.1:18787 EXPECTED_RELEASE_SHA=REVIEWED_SHA node scripts/staging-smoke.mjs
sudo systemctl is-active margin.service caddy.service checkaverse.service
```

Confirm the private teacher endpoint is HTTP 401 without a staff session, the server reports the exact release SHA, and `ss -ltn` shows 18787 and 55432 on loopback only. Verify no real data, and capture an anonymized test record only.

A real two-device school browser pilot, production Google identity, district data approval, full credential migration and Hall Pass cutover remain separate blocked steps. The legacy Apps Script workbook remains authoritative.

## Backup and recovery

The host's existing 02:15 filesystem backup includes directories under `/srv/*/data` but does not capture PostgreSQL clusters automatically. Once an isolated synthetic-only database actually exists, run `sudo bash scripts/vps-host-staging-backup.sh` to create a mode-0600 `pg_dump -Fc` in `/srv/schoolwide/data/`, then verify the nightly host backup contains it. The source includes an optional `grantdesk-schoolwide-staging-backup.service` and `.timer` set for 02:05, but neither is installed or enabled by this PR. Enable the timer only after the staging database is ready, the script has succeeded manually, and a disposable restore rehearsal has passed. Monitor job failures and confirm the 02:15 host archive actually includes the dump. Restore rehearsal MUST use a separate disposable database or cluster, never Margin or live Schoolwide. The script rotates matching local staging PostgreSQL dumps after 14 days (and the host archive separately retains 14 days). A successful full restore into a disposable `grantdesk_schoolwide_restore_probe` database was verified on the host: 52 public tables and 19 applied migrations, equal to staging as of November 20, 2026. Off-server encrypted recovery remains unverified. Its failures must not be ignored.

### Bounded, read-only staging probe

After the restricted account, database migrations, service and exact SHA are independently verified, execute:

```sh
cd /srv/schoolwide/current
EXPECTED_RELEASE_SHA="$(git -C /srv/schoolwide/repo rev-parse HEAD)" \
  PROBE_REQUESTS=35 PROBE_CONCURRENCY=10 \
  node scripts/vps-host-probe.mjs
```

For up to 150 total requests per endpoint, `PROBE_REQUESTS=150 PROBE_CONCURRENCY=10`. The probe is hard-coded to `http://127.0.0.1:18787`, accepts no student IDs/PINs, and only tests the public health route plus unauthorized teacher access. It records p50, p95 and p99 request latency without private payloads. **It is not a true 150-student Check-In/Hall Pass workload test.** That later test needs synthetic authenticated identities and full mutation/queue parity checks; do not claim classroom capacity from a health endpoint test.

### One-time 35-student HTTP Check-In on the actual VPS

The committed `scripts/vps-host-classroom-probe.mjs` is a one-shot synthetic HTTP mutation test, separate from the read-only health probe. It refuses to run unless (1) the operating-system user is `grantdesk_stage`, (2) the expected 40-character release SHA matches localhost staging, (3) a deliberately explicit `VPS_SYNTHETIC_LOAD=yes` flag is present, and (4) the private staging DB has exactly 19 migrations and **zero students, Check-Ins and passes**. The script creates only fictional students with fake one-time proof tokens, makes 35 concurrent POST Check-Ins and 35 matching retries over `127.0.0.1:18787`, then verifies unique attendance, one point each, audit entries and outbox rows. It reports p50/p95/p99 for the first 35 HTTP submissions.

**Run only after** the reviewed commit is installed, migrations pass, staging is confirmed free of real data, and the server is healthy:

```sh
cd /srv/schoolwide/current
sudo -u grantdesk_stage env VPS_SYNTHETIC_LOAD=yes \
  EXPECTED_RELEASE_SHA="$(readlink /srv/schoolwide/current | sed 's#.*/##')" \
  node scripts/vps-host-classroom-probe.mjs
```

Do not rerun against the same staging database. The 35 fictional records intentionally remain in the isolated DB as evidence. This test uses seeded synthetic action proofs, **not real PIN authentication**, and does not establish school Chromebook/Wi-Fi performance or production student-data readiness.

### One-time 35-student Hall Pass HTTP concurrency and FIFO test

`scripts/vps-host-pass-queue-probe.mjs` checks a synthetic class with **35 simultaneous requests**, a strict **one-active-pass capacity**, **34 waiting requests**, repeated idempotent submissions, an actual student-return request using a fictional single-use action proof, and FIFO promotion of the earliest waiting request. The test verifies the database counts and audit/outbox evidence. It is a *server-side localhost* acceptance test, not a school Chromebook or physical kiosk test.

Strict prerequisites: `grantdesk_stage` OS account; exact reviewed `EXPECTED_RELEASE_SHA`; `VPS_SYNTHETIC_PASS_LOAD=yes`; staging API healthy on `127.0.0.1:18787`; exactly 19 migrations, one pre-existing fictional school, 35 synthetic students, 35 synthetic Check-Ins and **zero Hall Pass requests or passes**. Any unexpected real/student records fail the test before writes. The script creates a *second fictional school*, never alters the existing Check-In fixture, and leaves test evidence intact after completion. Run **only once**, after an exact-head CI-green release:

```sh
sudo -u grantdesk_stage env \
  VPS_SYNTHETIC_PASS_LOAD=yes \
  EXPECTED_RELEASE_SHA=REVIEWED_40_CHARACTER_RELEASE_SHA \
  node /srv/schoolwide/current/scripts/vps-host-pass-queue-probe.mjs
```

Review `/srv/LOG.md` and GitHub PR #433 for results. Do not run this in production, do not reset the staging database to force another run, and do not claim it tests actual PIN login, active teacher sessions or 35 physical school devices. Backup the resulting evidence and rehearse a disposable restore before relying on the backup.

## Rollback / safe stop

```sh
sudo systemctl disable --now grantdesk-schoolwide-staging.service
```

This stops only the new staging service. Do not delete a database, cluster, user, backup, or release tree as part of an automated rollback. Margin/Checkaverse services and public URLs remain unchanged. Restoring production from staging is never permitted.
