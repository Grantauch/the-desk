# Checklings integration review: transport failures and private views

Task: `CK-INT-PRIVACY-001`. Owner: Codex / review-20261024.
Base: published Batch04 `89f4502966ec1bca9bd6ce093c8f90b8d2f906a2` (PR #229).
Branch: `checklings/integration/foundation-review-20261024`.

## Problem and result

The prerelease browser client cleared private pet rendering for parsed HTTP errors,
Done, hidden/cached tabs and session expiry. A rejected fetch, interrupted response
body or JSON parse failure skipped that clearing path. A previously displayed pet
could remain visible until another privacy event or the existing idle timer.
An unreadable 401 response had the same failure. This finding concerns the
unmounted Checklings service boundary; it does not establish a defect in the live
Daily Check-In companion.

The private-request catch path now uses the existing clear operation before
rethrowing an otherwise unhandled failure. This clears local rendering, broadcasts
to peer tabs, aborts pending private requests and advances the generation so that
a transport ignoring cancellation cannot repaint an old result. Cleared clients
remain inactive. The error still reaches the caller. Local clearing does not
claim server logout, cancel a committed command or retry a mutation.

This is one runtime guard plus tests. There are no new commands, schema changes,
creature migrations, auth grants, dependencies or production endpoints. Existing
Done/revocation behavior is preserved. Batch05 source and its publication block
are outside this branch.

## Reproduction and verification

Runtime: native Node v24.15.0; Chromium via the existing Playwright dependency.
All accounts, school returns, pet records and failures were synthetic.

| Check | Result |
| --- | --- |
| Unmodified published baseline: `npm run checkling:test` | 103 passed; 0 failed/skipped |
| Existing browser-client tests plus five new regressions, before fix | Original 8 passed; all 5 new cases failed |
| `node --test apps/checklings-service/browser-client.test.mjs`, after fix | 13 passed; 0 failed/skipped |
| `node --test --test-timeout=60000 apps/checklings-service/browser.integration.mjs` | 10 browser scenarios plus outer test: 11 passed; 0 failed/skipped |
| Canonical `npm run verify` | All 18 stages passed: 108 Checklings tests, 440 classroom behaviors, 53 built routes, 136 HTML files, 4,618 local references, 13 releases / 117 sealed assets |
| Native multi-client PostgreSQL and protected GitHub CI for this branch | Pending publication; no inherited pass claimed |

The new unit cases cover network rejection, interrupted body, malformed success
JSON, unreadable unauthorized response, and cross-tab cancellation/late success.
They first render private content before inducing failure, verify local and peer
clearing, and ensure cleared clients cannot request or display more private work.
The new real Chromium scenarios independently render a visible pet over local
HTTPS and then inject a network abort, malformed 200 response or HTML 401.
Existing browser cases still cover school callback/cookies, CSRF, two tabs, delayed
exchange/Done, invalid fragment clearing and server expiry.
An additional integration case lets the real rename handler commit, discards its
HTTP acknowledgement, confirms privacy clearing, replays the same command without
a second revision, and signs in again to display the saved nickname. Clearing a
private view therefore does not erase a committed action in this synthetic flow.
Astro reported 0 errors and 0 warnings. The subsequent evidence-only edits record
these results; the runtime and test blobs below remain the exact executed bytes.
After Git's Windows CRLF-to-LF normalization, the complete 108-case Checklings
suite and 11-case Chromium suite were replayed against files byte-matching the
staged Git blobs. Both passed. The full 18-stage gate was not repeated for this
line-ending-only normalization or the evidence-document edits.

Exact tested Git blobs:

- `browser-client.mjs`: `1021812d7936df3b28caf9608a8f5f90df68cf07`
- `browser-client.test.mjs`: `b0e25e648d90416b404974da988bb094c699413e`
- `browser.integration.mjs`: `149efd42a583a70dca88599600c0d8a660d22177`

Fetch rejection and response-body parsing are separate asynchronous failure points;
see [MDN's Fetch guidance](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch).
Modern web guidance was consulted; its client error-handling advice applies here.
No experimental connection policy or additional browser requirement was added.

## Next gate and limits

Independently review this small change against PR #229 and read its exact-head
storage/browser and protected-site CI. Keep the change separate from main until
the existing stack's review and release gates are satisfied. Hosted staging,
actual school Google/Workspace access, Chromebook behavior, student enjoyment
and classroom validation remain unverified. NOT MERGED. NOT DEPLOYED.
