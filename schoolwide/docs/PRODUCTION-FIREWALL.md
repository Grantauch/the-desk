# Schoolwide production firewall

## Protected production

Grant's existing Version 18 classroom Hall Pass/Daily Check-In system remains the operational source of truth. SW-010 must not change its source, workbook, deployment, public route configuration, credentials, or data.

## SW-010 allowed repository paths

- `schoolwide/**`
- `.github/workflows/schoolwide-ci.yml`

The `npm run firewall` check compares the current branch with `origin/main` (or another explicitly supplied base) and fails if this batch changes files outside those paths.

It also scans Schoolwide source code for direct references to protected legacy runtime mechanisms. Documentation may describe the migration boundary; application source may not call into it.

## Legacy integration contract

There is no legacy adapter in SW-010. The configuration vocabulary reserves only:

- `LEGACY_READ_ADAPTER_MODE=disabled` — default/current.
- `LEGACY_READ_ADAPTER_MODE=shadow-read` — future read-only adapter mode after a migration batch authorizes it.
- `LEGACY_PRODUCTION_WRITES=forbidden` — literal safety invariant; any other value fails configuration parsing.

A future migration phase may read a bounded legacy export/snapshot. It must never turn this switch into a general write bridge.

## Data rule

No real student data, PIN material, secret salt, OAuth token, private workbook contents, or private deployment identifiers belong in this repository or its CI fixtures.
