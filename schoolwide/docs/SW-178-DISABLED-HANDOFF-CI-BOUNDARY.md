# SW-178 — fail-closed boundary for the disabled PIN handoff

**Status:** A synthetic-only CI tripwire, not an approved credential architecture or a live installer. This patch cannot enable Schoolwide on student devices.

## Why
SW-175 and SW-176 include the experimental signed PIN attestation and PostgreSQL replay adapter, but there was previously no automated proof that a future edit would not import the experimental code into the running Schoolwide API. Green unit tests do not establish this isolation by themselves.

## Enforced boundary
- `npm run handoff:guard` parses non-test Schoolwide TypeScript source using Babel's TypeScript parser, rejecting direct imports, re-exports, literal dynamic imports, and `require()` references to either protected experimental module.
- Nonliteral dynamic `import()` or `require()` in non-test source requires manual review and fails closed; no inferred exemptions.
- `src/server.ts` must call `buildApp({ config, database })` exactly once, without injecting a new student, staff, classroom, or other identity provider.
- The existing synthetic unit and PostgreSQL integration tests are still permitted to import the experimental modules; there is no changed API route, secret, migration, database or production deployment.
- The gate runs automatically as part of `npm run verify`, including Schoolwide CI. Its own tests check deliberate boundary violations and legitimate test-only imports.

## Security review still required
This test is only a static guard against accidental wiring. It is **not** a substitute for an independent architecture review, real school/district approval, verified legacy identity proof, Google student identity binding, key custody/rotation, CSRF/HTTPS protections, device-level rate limiting, a real ChromeOS/school-network rehearsal, or a recovery/cutover decision.

The existing-PIN handoff is still off by default. Do not register a live verifier route or remove this guard without a separately approved and audited change. Production Hall Pass/Check-In and lunch PINs remain source of truth.
