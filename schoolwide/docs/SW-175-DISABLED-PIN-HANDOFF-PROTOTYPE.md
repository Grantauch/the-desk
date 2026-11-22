# SW-175 — Existing-PIN handoff: disabled security prototype

**Status:** OFF BY DEFAULT — experimental protocol and synthetic tests only. Not a
production architecture approval, data importer, or live Apps Script integration.

**Goal:** Reuse the student's current Hall Pass lunch-number PIN without exporting
PIN Cards, raw PIN hashes or the Apps Script `PIN_SALT`; never reset the roster.

## Threat model and reason for this approach

The tracked Hall Pass source hashes a 5/6-digit PIN using SHA-256 and a shared
server-side salt. The code of the *currently tracked* legacy verifier requires
six digits. A bulk export of shared salt plus hashes would allow rapid offline
guessing if leaked. Salted fast hashes do not become secure simply by encrypting
the transfer. A rollout should minimize the number of places those historical
credential materials ever exist.

A safer possible architecture is **first-use, source-authenticated enrollment**:
the still-authoritative Hall Pass verifies the student's already-known PIN,
uniquely resolves the student identity and issues a signed, short-lived,
school-scoped confirmation. The student submits that SAME PIN to Schoolwide,
together with the confirmation, over an authenticated, CSRF-protected HTTPS
session. Schoolwide checks the confirmation against an *already reconciled*
school/identity mapping, atomically burns the single-use nonce, verifies that
the submitted PIN matches the authenticated source PIN, and provisions a new
scrypt verifier from that same user-entered PIN. It never guesses or reissues a
credential, and a failed first-use never disables the legacy Hall Pass.

This is a **design candidate for Claude's security review**, not approval or
implementation of the live endpoint. In particular, never implement a bridge
which takes a client-selected student alias as proof of identity.

## Current prototype (not wired to any route)

`src/credential-continuity/synthetic-pin-attestation.ts` exports only two
pure-ish operations:

- `issueSyntheticLegacyPinAttestation`: creates a versioned envelope signed
  with HMAC-SHA256, binding a short-lived nonce to the *exact PIN string* and
  to issuer, audience, opaque student alias and school.
- `verifySyntheticLegacyPinAttestation`: validates strict canonical encoding,
  key length (32+ bytes), scope, signature, issue/expiry timestamps (60 seconds
  maximum), PIN text (5 or 6 digits with leading zeroes), and a caller-provided
  **atomic nonce digest-consumption** operation. It consumes the nonce before
  PIN comparison to prevent repeated guesses with one stolen envelope.

No raw PIN, PIN hash, source salt or school roster appears in the envelope.
Error messages are generic. This module is not imported by `buildApp`, has
**no HTTP route**, no connected legacy Apps Script RPC, no env secret, no
database migration, and no access to the source PIN data. All inputs in tests
are fictional. Tests cover issuer/audience/school/student confusion, tampering,
wrong PIN, single-use semantics, expiry and clock skew, malformed envelopes,
35 concurrent uses, and fail-closed nonce-store errors.

### Security properties still requiring implementation and review

1. **Trusted issuer**: prove the legacy Apps Script version can verify a PIN
   reliably without silently normalizing five-digit values or exposing either
   a salt or hash. Any issuer code changes must be separately reviewed and
   rolled out via the existing stable deployment only after authorization.
2. **Student identity binding**: require a valid, school-restricted mapping
   from the source's unique identity to the destination student. Teacher-
   authorized enrollments must remain section-specific; an alias supplied
   only by the client is not an identity proof.
3. **Shared-key custody/rotation**: issue distinct high-entropy keys per school
   or logical issuer and audience, keep them exclusively in server-side secret
   storage, plan rotation and emergency revocation. The prototype has no
   issuer key registry or revocation controls. Loss of a shared key together
   with captured PIN bindings would allow offline guessing of low-entropy PINs;
   treat any leak as an immediate credential incident.
4. **Durable one-time replay prevention**: back the `consumeNonceDigest`
   callback with a PostgreSQL UNIQUE constraint and atomic INSERT, scoped
   by issuer and school, storing only a digest and expiration. Never use a
   process-local Map in production. Fail closed on database timeout. Apply
   conservative account/device and cross-kiosk rate limits without locking
   out an entire classroom behind one shared IP.
5. **Transport and browser boundaries**: send the token/PIN only in a secure
   HTTPS POST body; never URL query, analytics, log, QR code or referrer. Use
   appropriate session authentication, secure cookies, CSRF protection and
   content-security policy. Prevent bearer handoff tokens from escaping
   into student-facing JavaScript logs or browser history.
6. **Credential creation and recovery**: verify the original PIN *once* on
   the source and once on Schoolwide, then rehash it into the current scrypt
   verifier without changing the value. Resolve mismatched/duplicate
   identities and inactive/PENDING_REVIEW membership with teacher review; do
   not fabricate automatic matches or silently activate an enrollment.
   Recovery must preserve legacy authority until all required evidence passes.
7. **Privacy and rollout**: obtain district authorization for processing
   existing student credentials; conduct a controlled synthetic end-to-end
   test, ChromeOS kiosk/teacher tests on school Wi-Fi, authenticated recovery
   rehearsals, audit review, and a staged opt-in activation with rollback.
   Do not turn on the public Schoolwide route as a substitute for these tests.

## Evidence

`synthetic-pin-attestation.test.ts` has seven adversarial test cases and
**no production data**. The existing `T-PIN-022` separately proves that a
fictional old Hall Pass-format hash can authenticate with the student's
unchanged PIN and be upgraded to a strong Schoolwide verifier.

**No real student/PIN source has been migrated; no public code or deployed
Apps Script changed.** This protocol must be security-reviewed before binding
it to any actual identity or credential service.
