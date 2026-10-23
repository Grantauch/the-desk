# Batch 03: launch broker and revocable sessions

October 23, 2026. Owner: Codex. Branch: `checklings/batch-03-auth-sessions`, stacked on persistence PR #227. **Internal source implementation; no school login or student-facing deployment.**

## Result

Added the database portion of slice 02B: signed launch tickets, verification of private school assertions, one-use codes bound to the originating browser proof/state, opaque sessions, expiry and durable logout. `createGameStore` passes its current transaction client to the verifier. Membership, session validation, creature mutation, event and receipt therefore share one transaction; no nested pool acquisition is needed.

Migration 002 adds launch flows, assertion replay records and sessions. Migration 001 is unchanged. The migration runner checks the entire ordered checksum history, applies only missing migrations, and rejects gaps, unknown versions and changed checksums. Readiness also checks every applied checksum. An upgrade rehearsal starts with the exact Batch 02 SQL and an imported founder, then compares membership, creature, event and receipt rows before/after migration 002.

## Private protocol implemented

There is no HTTP router or school-side signer in this batch. Each broker configuration fixes one opaque school issuer, game audience and tenant, with two separate private keys of at least 32 random bytes. Copy keys on construction. Use independent keys from Hall Pass and legacy import; do not send them to browsers. Identifiers in the protocol are opaque mappings, never a workbook ID, real name, email or PIN.

| Step | Internal contract |
|---|---|
| Begin | Generate a 256-bit flow ID, private browser proof and state. Store proof/state hashes and a 60-second expiry. Return the private proof separately from the signed public ticket. |
| Launch ticket | `base64url(UTF-8 JSON) + "." + base64url(HMAC-SHA256(flowKey, "checklings:launch:v1" + LF + body))`. `LF` is one newline byte (`0x0a`). Claims: `v:1`, `iss:gameAudience`, `aud:schoolIssuer`, `flowId`, `challenge`, `state`, `iat`, `exp`. Challenge is base64url SHA-256 of the private proof's ASCII text. |
| School assertion | Same envelope, separate `assertionKey` and domain `checklings:bridge:v1`. Exact claims: `v:1`, `iss`, `aud`, `tenantId`, `memberId`, `classId`, `authEpoch`, `flowId`, `challenge`, `jti`, `iat`, `exp`. Timestamps are integer Unix seconds; maximum assertion lifetime is 30 seconds; future/expired assertions fail closed. `jti` is a fresh 256-bit random base64url string. No role or extra fields accepted. |
| Accept | Verify HMAC in constant time, fixed issuer/audience/tenant, active existing membership/class/epoch, matching unexpired flow/challenge and unused assertion ID. Atomically record assertion use and hash a fresh 256-bit code. A flow receives only one code; duplicate assertion delivery is rejected. |
| Exchange | Require exact flow ID, private browser proof, state and code. Recheck membership, issuer/audience, time and all hashes after acquiring locks. Consume once and insert a fresh session hash in one transaction. Codes expire with the assertion or launch flow, whichever comes first. |
| Session | Store only SHA-256 of a 256-bit random opaque token. Enforce two-minute idle and fifteen-minute absolute expiry using the database clock. Intentional authenticated work refreshes idle expiry within the absolute limit. Check current active membership/class/epoch each time. |
| Logout | Lock the owner, durably mark the session revoked, and allow repeated logout. Every later authorized command and receipt replay fails. Unknown/expired tokens do not prevent clearing the future browser cookie. |

All base64url secrets are unpadded canonical 43-character encodings of 32 random bytes. Ticket bodies have no identity. Only hashes of private browser proofs, codes and sessions are stored. Public state is included in the signed ticket, with its hash in the flow row. Database time is checked after locks; the injected test clock is a trusted test dependency, never a client timestamp.

Lock order is membership → flow/session. An initial unlocked lookup supplies a lock hint only; the record is re-read and validated under the appropriate lock. Concurrent requests for an owner serialize. A completed logout does not undo a command that committed before it obtained the lock. It prevents later work. Owner changes/epoch revocation likewise wait for in-flight owner transactions.

Authorization refresh rolls back if a gameplay command fails. No polling transport is implemented; future background polling must not keep unattended sessions alive. An acknowledgement lost after code consumption requires a fresh launch; the broker cannot recover the unhashed token from its hash. A newly minted token is never reused from a cookie supplied by the client. The future shared-device adapter must revoke its previous game cookie before replacing it and clear rendered private state on Done.

## Validation

The final focused suite passes **72/72**: 20 original companion scenarios, 16 foundation scenarios, 35 embedded storage/auth tests and one schema-upgrade rehearsal. Embedded transactions are serialized. File-backed close/reopen and compatible archive restore now compare launch/assertion/session rows as well as creature/history/receipt rows. These are synthetic SQL results.

The native PostgreSQL 18 runner uses the same 34 shared scenarios plus its outer test and first proves 35 distinct physical connections. New cases include 35 simultaneous assertion deliveries, 35 simultaneous code exchanges, concurrent logout/mutations, cross-tenant/issuer/audience isolation, forged/expired/extra claims, mismatched browser proof/state/challenge, session timeout, deactivation/class/epoch changes, revoked receipt replay and rollback/lost exchange acknowledgements. Native CI for this branch is pending at initial publication. Canonical `npm run verify` passed all 18 stages on this source: 72 Checklings tests, all 440 classroom behaviors, Astro 0 errors/0 warnings (155 hints), 53 routes, 136 HTML files, 4,618 local references and 13 releases/117 sealed assets. Protected site/browser CI remains separate. Record subsequent CI results in the pull request; these initial source notes describe checks completed before publication.

Parent PR #227 head `0b98f49f5850c07f597bedfadf05f31196563aea` independently passed both [storage integration 39982438432](https://github.com/Grantauch/the-desk/actions/runs/39982438432) and [protected site checks 39982438462](https://github.com/Grantauch/the-desk/actions/runs/39982438462). Parent evidence does not validate this new branch.

## Remaining integration gates

Implement the actual school-side verified-PIN launch and ticket verification as a separately reviewed Apps Script release, then the separate game's HTTPS adapter and callback. The adapter must enforce fixed callback/launch origins, POST-only mutations, exact Origin/CSRF checks, bounded JSON bodies, rate limits, generic redacted errors, no-store responses, secure host-only HttpOnly SameSite cookies and credential-safe logging. The flow proof belongs only in the flow cookie; the session token only in the session cookie. Clear the URL fragment before further callback work; allow no third-party assets, analytics or referrers there. No public method may accept a client identity, private legacy export or raw PIN.

Provisioning remains separate: dedicated service/project/database, least-privilege roles, managed backup/restore, cost limits, expiry cleanup, monitoring and private key rotation. Replay IDs must survive until their assertions expire; remove assertion rows before their expired flow rows. No automatic cleanup is run by a student request.

The broker consumes existing membership records; it neither creates a roster nor synchronizes it from school. Database deactivation/epoch changes are tested, but propagation from Apps Script is unimplemented. A session can otherwise last up to fifteen minutes after verification. Privileged multiplayer and teacher operations need fresh bridge validity and a separate verified teacher role; neither operation exists here. Keep gameplay/teacher/lethal flags off until their own implementation and tests.

Then test actual Chrome/Workspace navigation, cookie behavior, shared-device Done and late responses, two devices, school roster changes and service outages using synthetic accounts; separately verify exact production releases and actual Chromebook play. Passing these source tests does not establish that students can log in or use the expanded game. No existing Apps Script or Netlify classroom release is changed. Body condition, exercise, chronic complications and localized scars remain in their accepted later phases.

Primary implementation references: [Node crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html), [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html). They inform primitives/session handling; this private bridge still needs its own integration/security review.
