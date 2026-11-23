# SW-189 — Offline teacher-preview Chrome startup reliability

**Review-only CI infrastructure. Not a classroom-ready claim, production deployment or change to PR #524.**

## Failure being repaired

Schoolwide CI [run 45092165944](https://github.com/Grantauch/the-desk/actions/runs/45092165944) first attempted to run the real Chrome preview for the fictional six-stage PRELAUNCH teacher kit and failed after a fixed 10-second browser startup poll because its isolated `DevToolsActivePort` file was not created. The exact same source passed on a GitHub job rerun. PostgreSQL security tests, migration 021 and synthetic encrypted restore passed on both attempts.

## SW-189 change

- Introduce `scripts/chrome-startup.mjs` for **only** the browser startup phase in `test-teacher-kit-browser.mjs`.
- At most two 15-second startup windows; if the first process fails, kill it and remove its one-time profile before making a second attempt using a newly generated profile.
- Reject missing, malformed, nonnumeric or out-of-range DevTools ports, including shell-like input.
- Handle synchronous executable failures and asynchronous Node spawn errors without silently skipping browser tests.
- Use `--disable-dev-shm-usage` for ephemeral, memory-constrained GitHub runners while retaining no-background-networking, `--headless=new`, ephemeral profile and random localhost DevTools port.
- The original mobile (390 and 320), desktop (1440), keyboard, print, privacy reset, fictional kiosk, teacher PRELAUNCH and non-authorized deployment assertions remain unchanged. After browser startup succeeds, failure of **any** one of those assertions is a hard test failure; it is never retried or suppressed.
- Both failed startup attempts produce an explicit error. The process and profile are cleaned on failure and at completion, including idempotent cleanup.
- Add `node --test scripts/test-chrome-startup.mjs` as a separate Schoolwide CI step with synthetic stub browser processes and no external data/network access.

## Testing

The 8 isolated synthetic regression cases cover: immediate valid launch; initial failure then distinct-profile success; permanent failure with two cleanups; malicious/invalid DevTools port; exited process; throwing executable; invalid retry/poll arguments; persistent failure remains a failure.

Run the full original Chrome teacher-preview browser test unchanged against the updated launch helper, and run the existing Schoolwide CI and Staging Qualification at the exact new draft PR head. A green test proves the preview's local behavior only; **not** district-managed ChromeOS, school-network acceptance, login/PIN continuity, offsite production backups, real authorization or student readiness.

## Isolation and release hold

The implementation must live in a **separate draft PR** based on review-only `schoolwide/sw-186-review-consolidation`. Do not modify or rebase the target branch while Dot independently reviews [PR #524](https://github.com/Grantauch/the-desk/pull/524) at `bcb83a7067b581930fa1c85d79bb5116ac9744b0`.

Claude's later Team Desk hold forbids Schoolwide PR approval, merge or deployment until Claude or Grant explicitly changes it. No live student PIN, Apps Script, Hall Pass, Check-In, production database or school credential integration was touched.
