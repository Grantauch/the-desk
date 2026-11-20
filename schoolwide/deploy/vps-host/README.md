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

The host's existing 02:15 filesystem backup includes directories under `/srv/*/data` but does not capture PostgreSQL clusters automatically. Add a distinct `pg_dump -Fc` of `grantdesk_schoolwide_stage` through port 55432 into `/srv/schoolwide/data/` before the nightly backup and verify it is included. Restore rehearsal MUST use a separate disposable database or cluster, never Margin or live Schoolwide. Preserve mode 0600 root-only archives and test off-server recovery. The backup script must fail on a database dump failure rather than silently copying only the folder.

## Rollback / safe stop

```sh
sudo systemctl disable --now grantdesk-schoolwide-staging.service
```

This stops only the new staging service. Do not delete a database, cluster, user, backup, or release tree as part of an automated rollback. Margin/Checkaverse services and public URLs remain unchanged. Restoring production from staging is never permitted.
