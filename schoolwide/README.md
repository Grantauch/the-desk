# GrantDesk Schoolwide

This directory is the isolated application lane for the schoolwide GrantDesk build. It is intentionally independent from the classroom Apps Script Hall Pass/Check-In runtime.

## SW-010 status

SW-010 establishes only the foundation: a portable TypeScript HTTP service, PostgreSQL tenancy/identity schema, environment boundary, migration runner, container boundary, CI, and production-firewall tests. It does **not** implement Hall Pass, Check-In, Google Classroom synchronization, or migration of real classroom data.

## Local start

```sh
docker compose up -d postgres
npm install
cp .env.example .env
npm run db:migrate
npm run dev
```

Health endpoints:

- `GET /health/live` — process liveness; does not require the database.
- `GET /health/ready` — database readiness; fails closed with HTTP 503.

## Verification

```sh
npm run verify
```

The gate runs the Schoolwide production firewall, TypeScript checking, tests, and a production build. CI separately applies database migrations twice against a disposable PostgreSQL 18 service to prove initial migration repeatability.

## Production boundary

The current classroom system remains authoritative and writable until a later explicitly approved cutover. Schoolwide code must not write to the legacy workbook or Apps Script runtime. The only legacy integration mode reserved by configuration is a future `shadow-read` adapter; it is not implemented in SW-010.

Read `AGENTS.md` and `docs/PRODUCTION-FIREWALL.md` before changing this directory.
