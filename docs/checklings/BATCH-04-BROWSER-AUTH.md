# Batch 04: browser authentication boundary

October 23, 2026. Owner: Codex. Branch: `checklings/batch-04-browser-auth`, stacked on PR #228. **Source implementation, not mounted or deployed. No student login, migration or playable game is live from this batch.**

## Result and boundaries

Added a Fetch Request/Response adapter for the separate game host, minimal sign-in/callback documents and a browser client for intentional pet reads/renames and Done. The handler does not start a server, alter Netlify routing or read school records. No existing Apps Script, static classroom page or public artwork changed. The real school-side verified-PIN issuer and roster mapping/synchronization are still unimplemented.

Files under `apps/checklings-service/` contain the runtime changes and tests. `.github/workflows/checklings-storage.yml` adds a separate synthetic Chromium job. The root test command and both repair ledgers are updated. There is no production entry point or fixture login route. The synthetic issuer, test renderer and TLS server exist only in test files.

| Route | Boundary |
|---|---|
| GET `/auth/start` | Identity-free button; deliberately begins the fixed school sign-in path. |
| GET `/auth/callback` | Clears the fragment before parsing/importing, then exchanges exact flow/state/code fields. Successful exchange goes to the fixed game root. |
| GET `/auth/client.js` | Browser module with no token/identity storage. |
| POST `/auth/launch` | Cancels any preceding browser flow and session, creates a fresh proof cookie and returns only the fixed school launch URL with a signed public ticket. |
| POST `/bridge/assertion` | Server callers only: refuse Origin, Cookie and Fetch Metadata headers; require a bounded, correctly signed school assertion. Returns a one-use code. |
| POST `/auth/exchange` | Reads proof only from its host-only HttpOnly cookie. Returns no token in JSON; writes a fresh session cookie. |
| POST `/auth/logout` | Cancels the browser's pending launch, revokes the current session and clears both cookies. Confirmed success requires database acknowledgement. |
| POST `/api/creature`, `/api/rename` | Intentional authenticated read or existing nickname command. Strict schemas, server ownership/revisions and durable receipts remain authoritative. No browser legacy-import route. |

All cookie-authenticated POST routes require the exact configured HTTPS Origin, `X-Checklings-Request: 1`, JSON and same-origin Fetch Metadata when present. There are no CORS allowances. Other methods/queries are rejected. This combines explicit origin verification and non-simple request headers; it is not authorization by a client-supplied student ID. The bridge's lack of browser headers is only an extra transport check: its HMAC remains mandatory.

Bodies are bounded to 8 KB, valid UTF-8 JSON and a two-second total read deadline; compressed bodies and malformed/extra command fields fail. Duplicate tracked cookie names fail closed. Every response denies caching and referrers, restricts resources to the game origin, denies framing and adds a fresh script nonce. The platform must preserve separate Set-Cookie headers.

The `__Host-ck-flow` cookie has Secure, HttpOnly, Path=/, SameSite=Lax and a 60-second lifetime for a top-level school return. The `__Host-ck-session` cookie uses Secure, HttpOnly, Path=/, SameSite=Strict and a 15-minute browser maximum. Neither has Domain. Server idle/absolute expiry remains authoritative. No PIN, session token, browser proof or student identity is stored in localStorage/sessionStorage or returned in API JSON. The callback code stays briefly in the fragment/closure and same-origin POST only; hosting logs must exclude request bodies and credential-bearing queries.

## Done, late responses and expiry

A token-only logout could miss a newly committed exchange whose response has not reached the browser. Additive migration 003 links new sessions to their launch flow and adds a durable cancellation timestamp. Done can use the existing proof cookie to cancel the flow and revoke its resulting session even before the browser receives the token. Cancellation and exchange lock the same flow row: either exchange sees cancellation and refuses, or cancellation follows its commit and revokes the resulting session. Repeated cancellation is harmless. Previously issued schema-2 sessions retain their hashes and NULL flow provenance; token-based logout continues to work.

Normal authenticated work locks membership → session/flow. Cancellation is the deliberate exception: it locks flow → session and never membership. No session operation subsequently requests a flow lock, so it does not create a reverse lock cycle with commands. Native contention tests exercise 35 exchanges racing cancellation.

The browser clears its private renderer immediately on Done, aborts pending private fetches and broadcasts clearing to other tabs. Generation checks guard rendering/navigation even when a test transport ignores AbortSignal. Hidden or restored cached pages clear private state; resuming private reads requires a fresh page load/sign-in. Missing BroadcastChannel support fails closed. No background polling extends the session.

Successful exchanges/private commands include a redacted server remaining-time header. A non-refreshing session check supplies that window after the command; the browser subtracts the full request duration and schedules clearing within that budget. It never decides server eligibility from its own wall clock. A revoke/expiry between commit and this check can suppress the response even though the command committed: recover through the original command ID/current state, never a fabricated success or a fresh duplicate command.

Sign-out quota exhaustion does not block a verified same-origin Done request. If the database cannot confirm revocation, the handler clears browser credentials, returns 503 and the page says sign-out could not be confirmed. It cannot promise server invalidation during an outage. Browser generation checks still suppress late painting; server checks fail closed while persistence is unavailable. This requires explicit outage acceptance before classroom use.

## Shared request limits

Migration 003 also adds shared SQL request counters, with atomic upsert and bounded counts. The host must provide a canonical client IP from trusted platform/socket metadata; arbitrary forwarded headers are not accepted. Only a keyed HMAC bucket, minute window and count are stored; raw IPs are not. Separate server-only rate key, minimum 32 random bytes. Missing address/database fails closed.

Initial per-address/minute budgets: launch 120, exchange 240, logout 240, private bridge 120, commands 600. These allow a 35-student school NAT burst but still need realistic staging/load review. Operator expiry cleanup must delete old rate windows, expired sessions, expired assertion rows and then unreferenced expired flows, respecting the new session-to-flow FK. Student requests never run cleanup. Edge abuse/resource limits, backups and a least-privilege runtime role remain hosting gates.

## Validation and evidence

The final focused suite passes **103/103**: 20 original companion, 16 foundation, 41 embedded storage/auth/rate tests, two schema upgrades, 16 HTTP boundary tests and eight browser-client privacy tests. Schema 1 → 3 preserves the founder/progress/history; schema 2 → 3 preserves an issued session. First two SQL migrations are unchanged. File-backed reopen/archive restore also compare rate/cancellation/session records. Embedded transactions remain serialized.

The native PostgreSQL runner now includes 40 shared scenarios plus its outer test, with 35 independently held physical connections, including exchange/cancellation and shared quota contention. A separate Chromium CI job drives six synthetic HTTPS journeys plus its outer test: top-level return/cookies, CSRF, two tabs/late reads, Done during delayed exchange, invalid fragment erasure and server expiry. The browser's school page is intercepted and a test issuer signs synthetic claims. These checks do not verify Google school access, actual PIN entry, Workspace restrictions, students or Chromebooks. Local Chromium is unavailable; no local browser pass is claimed. Native/browser CI for this branch is pending at publication. Canonical `npm run verify` passed all 18 stages with the final 103 Checklings tests, all 440 classroom behaviors, Astro 0 errors/0 warnings (156 hints), 53 routes, 136 HTML files, 4,618 references and 13 releases/117 sealed assets. Track subsequent native/browser/protected site CI results in the pull request.

Subsequent independent CI evidence: [run 40008927061](https://github.com/Grantauch/the-desk/actions/runs/40008927061) passed on runtime source `0a1cc4714bb0f245e17081811c43e6457565f0d0` in [draft PR #229](https://github.com/Grantauch/the-desk/pull/229). PostgreSQL job 120603932280 passed 67/67 embedded service tests and 41/41 native tests using 35 distinct physical connections. Chromium job 120603931992 passed all six HTTPS journeys plus its outer test (7/7). Both job logs were independently read. Protected site run 40008927145 remains separate/in progress at this checkpoint. This follow-up changes evidence documentation only; runtime and tests remain identical to the tested source. These results supersede the initial pending-native/browser note above and do not imply actual school authentication or deployment.

Parent head `60d2624c6ae16d837fdb90661440a861bd05e823` now has passing [site/browser 39999302788](https://github.com/Grantauch/the-desk/actions/runs/39999302788) and [PostgreSQL 39999302907](https://github.com/Grantauch/the-desk/actions/runs/39999302907) checks. Parent evidence does not validate this branch. PRs #226–228 remain unmerged and undeployed.

## Next implementation

Build the separately reviewed school-side ticket verification and verified-PIN assertion bridge without coupling attendance/pass commits to game requests. Establish opaque membership mappings, epoch/deactivation propagation and a guarded pilot migration fence. Package the separate service/origin with fixed school callback configuration, private keys, trusted address extraction, database roles, cleanup, backups, cost controls and redacted monitoring. The adapter's success root must be mounted with the real game frontend; this batch provides only sign-in/callback documents and a client API.

Then verify staging end to end with independent synthetic identities and actual school Chrome/Workspace navigation before any production release or student import. Teacher roles/feature settings, fresh privileged-action assertions, the first playable care UI and all twelve species remain later slices. Body condition, exercise, chronic complications and localized battle scars keep their accepted later schedule.

Primary references: [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie). The private bridge and hosting integration still require their own review and field evidence.
