# SW-181 — Signed assertion scope must match the one-use replay store

**Scope:** OFF-BY-DEFAULT synthetic credential handoff hardening. No PIN-verification service or live Apps Script route is enabled by this change. Independent security architecture review remains required.

## Problem

SW-175's verifier independently confirmed that the signed token was issued for its configured `expectedSchoolId` and `expectedIssuer`. SW-176's PostgreSQL callback separately captured a trusted `schoolId`, `organizationId` and `issuer` when constructed, but accepted *only the nonce digest and expiration*. A future caller could accidentally verify a token for School A while passing a callback bound to School B. That callback could insert the signed nonce under B's scope and return success despite the mismatch; a later replay in A could be accepted, breaking the intended one-time semantics.

The existing mismatch test only changed `expectedSchoolId`, so it did not exercise the dangerous case where signed claims and verifier expectations agree but the SQL callback's school differs.

## Repair

The verifier now supplies one immutable/typed consumption object containing `nonceDigest`, `expiresAtEpochSeconds`, and the **already verified** signed `schoolId` and `issuer`. The PostgreSQL adapter matches both claims to its trusted server-side school/issuer *before issuing SQL*. Scope mismatch returns false without making any replay-table insert. Matching adapters preserve atomic unique-key single use, across connections, and still burn a token before PIN comparison.

The type change deliberately breaks any older two-argument replay callback at compile time in code that uses the typed API. There is no production route or legacy PIN source integrated to migrate.

## Synthetic evidence

- SW-175 unit tests now assert that the replay consumer sees the signed school and issuer, in addition to the nonce digest and expiry. Malformed/tampered/scope-mismatched tokens cannot reach the callback.
- SW-181 PostgreSQL integration: a valid token, correct expected school and correct expected issuer, **but a wrong-school SQL adapter**, must reject without insertion into the other school's replay table. Same for wrong issuer. The same token must then work exactly once with the correctly scoped adapter.
- Existing two-connection-pool 35-concurrent-attempt test and wrong-PIN burn-before-PIN-compare tests remain required.
- The adapter denies malformed scope and invalid expiry before touching the database.

## Still not approved

The source must independently verify the existing Hall Pass PIN and identity; school organization mapping must be server-trusted; verify key custody and rotation, student session binding, HTTPS/CSRF, device/account rate limits, access authorization, inactive students, recovery, real school-network acceptance and district authorization. Never export PIN Cards, roster, legacy salt or historical credential hashes for this test. Existing lunch PINs and production Hall Pass/Check-In remain unchanged.

**Review:** this is an additional defense in a disconnected prototype, not permission to add an endpoint or turn on student login.
