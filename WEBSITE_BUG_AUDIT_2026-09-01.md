# GrantDesk website bug audit — 2026-09-01

## Release status at the time of this report

The Google Drive folder supplied on 2026-09-01 contained `Code.gs` and `Index.html` for the GrantDesk Hall Pass Apps Script project. Those files are not safe to publish unchanged: they add teacher roster management, but they also predate protections that are present in the public Version 9 deployment.

An additive merged candidate is now in `apps-script/hall-pass/`. It keeps the public Version 9 privacy, authorization, locking, PIN-email, unmatched-sign-in, and teacher-refresh corrections while adding the supplied roster-management controls. Exact source snapshots are preserved under `apps-script/snapshots/hall-pass/`:

- `version-9-live-2026-08-29/` — recovered baseline of the currently public deployment.
- `version-10-drive-supplied-2026-08-31/` — the two files supplied through Drive, preserved unchanged.

The merged candidate passes `npm.cmd run hall-pass:test`, `npm.cmd run check`, and `npm.cmd run build`. After explicit teacher confirmation, it was saved in Apps Script and released as **Version 11 on 2026-09-01** by updating the existing public deployment. The public deployment URL was preserved, it still executes as the deploying teacher, and access remains limited to Mt. Morris Consolidated Schools.

Post-deployment checks passed without using a real student PIN:

- Student Hall Pass loaded the expected account-recognition/PIN fallback and private-screen copy.
- Kiosk mode loaded its six-digit PIN screen and the real-interaction idle-reset logic is present in the deployed client.
- Daily Check-in loaded its correct mode and PIN fallback.
- Teacher mode loaded `sign-in problems.`, `class rosters.`, roster add/reactivate controls, hall-pass controls, and PIN-delivery controls.
- The public `/pass/` and `/check-in/` landing pages still target this same deployment; the check-in link retains `mode=checkin`.
- No console errors or warnings were observed in those verification paths.

## Severity guide

- **P1 — fix before depending on the affected behavior:** an active failure, privacy/data-integrity risk, or classroom-blocking path.
- **P2 — schedule next:** a reliability, security-hardening, release-quality, or accessibility problem with a practical failure mode.
- **P3 — backlog:** low-impact correctness, metadata, semantics, or polish.

## Findings

### P1 — The live NPR thumbnail pipeline is currently failing on a valid feed update

**Evidence:** `npm.cmd run live-data:check` failed on 2026-09-01. CNN, Fox News, and MLive returned usable WebP images; NPR returned HTTP 400 from the image proxy. The current NPR feed's first item includes an image element whose `src` is the literal string `undefined`. In `netlify/functions/headlines.mjs`, `readImageFromMarkup()` accepts that value. `safeHttpsUrl()` then resolves it relative to the NPR article URL, creating an NPR article-path URL ending in `/undefined`. Because that truthy value is treated as an image, `resolveArticleImage()` never falls back to the article's Open Graph image. The image proxy correctly rejects the resulting non-image/non-allowlisted URL.

**Impact:** the NPR card falls back to the local source cover instead of showing the current story image, and the live-data release gate fails. The failure is feed-dependent, so it can disappear and recur as the top story changes.

**Fix direction:** reject placeholder values such as `undefined`, `null`, and non-absolute/non-image feed candidates before resolving them. If a feed candidate is missing or invalid, fetch the article's Open Graph image. Add a fixture containing `<img src='undefined'>` plus a tracking pixel so the failure is reproducible offline. Keep the existing publisher-host allowlist in the proxy.

**Verification:** the fixture must resolve to the article's actual Open Graph image or the local fallback, never an article URL; then `npm.cmd run live-data:check` must pass on all four sources.

### P1 — The automatic daily purge can race with live pass and queue writes

**Evidence:** `getBootstrap('teacher')` calls `purgeIfDue_()` in `apps-script/hall-pass/Code.gs`. That function sets `LAST_PURGE` and calls `purgeOldPasses_()` and `purgeOldQueue_()` without the script lock used by live pass/queue mutations. Both purge helpers delete sheet rows. The explicit `dailyCleanup()` and manual `purgeOldPasses()` paths correctly take `withLock_()`, but the first teacher-dashboard load of the day does not.

**Impact:** if the teacher opens the dashboard while a student starts/ends a pass or joins/leaves the queue, row deletion can shift row numbers underneath the other request. The wrong row could be updated or a cleanup could fail. Because `LAST_PURGE` is set before deletion, a failed purge is not retried that day.

**Fix direction:** put the due-check, row deletions, and `LAST_PURGE` write inside one `withLock_()` callback. Write `LAST_PURGE` only after both purges complete. Keep the pre-lock teacher authorization already performed by `getBootstrap()`.

**Verification:** add a structural regression test asserting that `purgeIfDue_()` uses `withLock_()` and writes `LAST_PURGE` after both purge calls. Then run an adversarial Apps Script test with a pass mutation and teacher bootstrap launched together.

### P2 — A forgotten `OUT` pass can occupy the only slot indefinitely

**Evidence:** `getPassSnapshot_()` counts every log row whose status is `OUT`. Queue entries have claim and maximum-wait expiration, but active passes have no stale threshold, teacher alert, or automatic reconciliation. Retention cleanup explicitly excludes `OUT` rows.

**Impact:** if a student closes the page, loses connectivity, or forgets to press the return button, the pass remains unavailable and the queue can churn until the teacher notices and ends the pass manually.

**Fix direction:** add a teacher-private stale-pass threshold and visible alert. Prefer a conservative workflow: flag an unusually long pass first, then let the teacher end it. If automatic return is desired, make the threshold explicit and preserve an audit note stating that the system closed it.

**Verification:** create an old `OUT` fixture and confirm that it is clearly flagged without exposing another student's identity to students. Confirm that the teacher can resolve it and the next queued student becomes eligible.

### P2 — The shared-kiosk failed-PIN counter is global across all anonymous devices

**Evidence:** anonymous PIN failures use the single cache key `pin-attempts:shared`. At 200 failures, every anonymous PIN screen using the deployment is blocked until the cache entry expires. The key does not distinguish a classroom device or session.

**Impact:** one malfunctioning or abusive device can temporarily deny PIN access to every other shared kiosk. The generous threshold reduces accidental lockout but does not isolate the blast radius.

**Fix direction:** issue a short-lived anonymous device/session nonce when kiosk mode loads and key the counter by a hash of that nonce. Keep a high global circuit breaker as a second layer, but do not use it as the ordinary per-device limit.

**Verification:** exhaust the limit on one synthetic kiosk session and confirm a second session can still sign in. Confirm that the same first session remains throttled for the intended period.

### P2 — PIN sessions and queue-turn timing depend only on best-effort cache entries

**Evidence:** PIN identity sessions are stored only in `CacheService.getScriptCache()` for one hour. Queue-turn start timestamps also live only in the script cache. Apps Script cache entries may be evicted before their requested expiration.

**Impact:** a cache eviction can force a student to re-enter a PIN during an active interaction. Evicting a queue-turn timestamp restarts the claim window, allowing a stale first-in-line entry to hold its turn longer than intended.

**Fix direction:** keep opaque tokens in the client, but persist only the minimum server-side state needed for reliable expiry in a small private sheet or script property store. Alternatively, store a signed token with issued-at, expiry, student key, and purpose so ordinary validation is stateless. Do not put private exemption reasons or other teacher-only data in the token.

**Verification:** deliberately clear the script cache between PIN entry and the next action, and while a queue turn is active. The system should either continue safely or fail in a bounded, explicit way without extending another student's queue claim.

### P2 — Four fixable transitive dependency advisories are present

**Evidence:** `npm.cmd audit --omit=dev --json` reported three high-severity and one moderate advisory in transitive packages:

- `js-yaml` 4.3.0 — high; fixed in 4.3.1 or later.
- `nanoid` 3.3.16 — high; fixed in 3.3.18 or later.
- `sharp` 0.34.5 — high; fixed in 0.35.0 or later.
- `postcss` 8.5.19 — moderate; fixed after 8.5.22.

They currently arrive through Astro and the Tailwind/Vite build chain, so this is primarily a build/deployment risk rather than evidence that the static public pages are directly exploitable. A dry run showed patch-level replacements are available, but the proposed audit fix also changes/removes a large part of the installed dependency tree and therefore should not be applied blindly.

**Fix direction:** update Astro from 7.1.1 to the current compatible 7.2.x release and Tailwind packages from 4.3.2 to 4.3.3, reinstall from the lockfile, rerun the audit, and explicitly verify the resolved versions of all four packages. Review any remaining `sharp` override separately.

**Verification:** require zero known high/critical advisories, then rerun `check`, `build`, `site:validate`, `detour:validate`, `remix:validate`, and visual checks of image-heavy pages.

### P2 — The static-site validator mistakes Netlify Function URLs for missing files

**Evidence:** `npm.cmd run site:validate` reports four missing references on `/news/`. They are all legitimate root-relative `/.netlify/functions/news-image?...` URLs. `scripts/validate-static-site.mjs` strips the query string and maps every root-relative URL under `dist`, so it looks for a nonexistent static file at `dist/.netlify/functions/news-image`.

**Impact:** a healthy build cannot pass its documented local release gate whenever news cards have proxied images. Repeated false alarms make it easier to ignore a later genuine missing-file failure.

**Fix direction:** classify `/.netlify/functions/` references as dynamic endpoints. Check that the named function source exists under `netlify/functions/`, then let `live-data:check` perform the behavioral test.

**Verification:** `site:validate` must pass with dynamic news-image URLs while still failing for a deliberately missing ordinary image or document.

### P2 — The homepage attributes a known misquotation to Winston Churchill

**Evidence:** `src/data/site-content.json` displays: “The farther backward you can look, the farther forward you are likely to see.” The International Churchill Society lists the “farther/further backward” wording as falsely attributed and gives Churchill's documented wording as “The longer you can look back, the farther you can look forward.” Source: <https://winstonchurchill.org/resources/quotes/quotes-falsely-attributed/>.

**Impact:** this is a factual credibility issue on a history teacher's homepage.

**Fix direction:** use the documented wording and retain Churchill attribution, or replace the quotation with a fully sourced line whose exact wording can be traced to a speech/book.

**Verification:** source-check the final wording against a primary text or a specialist archive and record the citation near the content source.

### P3 — First Day Materials uses the redirecting `www` host in canonical and content links

**Evidence:** the live page is `https://grant-desk.com/first-day-materials/`, but `public/first-day-materials/index.html` declares `https://www.grant-desk.com/first-day-materials/` as both canonical and Open Graph URL. Several body/footer links also use `https://www.grant-desk.com`. The `www` host redirects to the non-`www` host.

**Impact:** unnecessary redirects and conflicting canonical signals for search/social crawlers.

**Fix direction:** use `https://grant-desk.com/` consistently for the canonical, Open Graph URL, and internal homepage links.

**Verification:** crawl the page and require a canonical whose origin exactly matches the final response URL.

### P3 — Eleven public classroom hubs have no explicit indexing policy or share metadata

**Evidence:** eleven linked files under `public/hubs/` have titles but no meta description, canonical URL, or `noindex`. They are not listed in the sitemap, yet ordinary crawlers can still discover them from site links.

**Impact:** the pages can be indexed with weak search snippets and competing raw-file URLs, or remain accidentally discoverable when the intended policy was classroom-only.

**Fix direction:** choose a policy. If public/discoverable, add canonical URLs, concise descriptions, and sitemap entries. If intentionally classroom-only/unlisted, add `noindex, nofollow` and keep them out of the sitemap.

**Verification:** crawl all `/hubs/*.html` routes and require either complete public metadata or an explicit `noindex` policy.

### P3 — Three Jeopardy pages contain two static level-one headings

**Evidence:** `classroom-jeopardy.html`, `jeopardy-hidden-history-unit1.html`, and `jeopardy-scoreboard-unit1.html` each contain an `<h1>` in the category picker and another `<h1>` in the game board. Only one mode is visually active at a time, but both remain in the document outline.

**Impact:** screen-reader heading navigation can present two page titles, and automated accessibility/SEO checks flag the pages.

**Fix direction:** keep one document-level `<h1>` and make the mode-specific heading an `<h2>`, or update the accessible/hidden state so the inactive mode is removed from the accessibility tree.

**Verification:** check the accessibility tree in picker and board modes; each state should expose one clear level-one page title.

### P3 — The First Day Materials page lacks the site's normal skip link and navigation landmarks

**Evidence:** the standalone file begins its content with `<main class="wrap">` and has no skip-to-content link or `<nav>` landmark. It does include a visible link back to “the desk,” so users are not stranded.

**Impact:** keyboard and screen-reader navigation is less consistent than the rest of the site, especially on a long page.

**Fix direction:** either move the page into the shared Astro layout or add the same skip link, labeled navigation landmark, main target ID, and footer navigation used elsewhere.

**Verification:** tab from the top of the page and confirm the first control can jump directly to main content; inspect the accessibility tree for banner, navigation, main, and contentinfo landmarks.

### P3 — Homepage copy is missing a word

**Evidence:** `src/data/site-content.json` contains “This designed to make class a little easier.”

**Fix direction:** change it to “This is designed to make class a little easier.” or revise the sentence.

### P3 — Roster email validation does not reject a leading equals sign

**Evidence:** the merged roster form rejects a leading `=` for student names and class names through `cleanText()`, but the email value bypasses that check. The broad email regex permits several characters that Sheets may interpret as a formula when `appendRow()` writes a string beginning with `=`.

**Impact:** a malformed pasted email can become a formula/error cell or produce an unusable roster row. The action is teacher-only, so the exposure is limited.

**Fix direction:** reject email values beginning with `=`, `+`, `-`, or `@` before writing, and validate the local part more narrowly for the district's actual address format. Write user-supplied values as explicit text where practical.

**Verification:** test formula-like, whitespace, mixed-case, wrong-domain, duplicate, and valid district addresses; none of the invalid cases should create or modify a row.

### P3 — Unmatched-sign-in recording is not serialized

**Evidence:** `recordUnmatchedSignIn_()` uses a ten-minute cache throttle but does not use the script lock when it reads the unmatched ledger, increments an existing row, or appends a new row.

**Impact:** simultaneous first visits from the same or different unrecognized accounts can create duplicate rows or lose a count increment. This does not block the student—the function deliberately swallows bookkeeping errors—but it weakens the teacher's evidence for roster correction.

**Fix direction:** keep the cache throttle, but perform the read/update/append and memo invalidation inside `withLock_()`. Do not hold the lock while doing unrelated network work.

**Verification:** invoke the recorder concurrently for the same address and require one row with the correct count.

## Verified healthy behavior

The audit also produced substantial positive evidence:

- The live crawl covered 62 public HTML pages, including all 46 sitemap URLs and linked standalone tools.
- All 62 pages returned usable HTML.
- All 93 discovered internal references resolved; there were **zero broken internal links**.
- No `file:///`, Windows user path, OneDrive path, `localhost`, or `127.0.0.1` references were found in the public/site source scan.
- `https://www.grant-desk.com/` redirects to the canonical non-`www` origin.
- Representative browser checks of `/resources/`, `/learning-hubs/`, `/hubs/classroom-jeopardy.html`, `/pass/`, and `/check-in/` produced no console errors.
- The Hall Pass and Daily Check-in launch controls point to the same Apps Script deployment, and the check-in control supplies the correct `mode=checkin` parameter.
- The news UI has a local source-cover fallback, so the current NPR parser failure degrades the story image instead of leaving a broken-image icon.
- The global response headers include clickjacking, MIME-sniffing, referrer, and browser-permission protections; the private editor also has a restrictive CSP and `noindex` policy.
- The merged Hall Pass candidate keeps student payloads free of the teacher-private unlimited-pass flag, keeps teacher authorization before sensitive repair operations, serializes explicit cleanup and PIN-email claims, preserves unmatched-sign-in evidence, and resets shared-device identity based on real interaction rather than polling.
- `npm.cmd run check` passed with zero errors, warnings, or hints.
- `npm.cmd run build` produced 51 pages successfully.
- `npm.cmd run detour:validate` passed with 80 unique decks and 90 opening stories.
- `npm.cmd run remix:validate` passed with no student-ready remix records accidentally exposed.

## Recommended repair order for the next token window

1. Fix the NPR feed-image parser and add its regression fixture; rerun the live-data gate.
2. Lock `purgeIfDue_()` and write `LAST_PURGE` only after successful cleanup.
3. Add stale-pass detection/teacher resolution.
4. Isolate kiosk PIN throttles per device/session and make cache loss behavior explicit.
5. Upgrade and verify the four vulnerable transitive packages.
6. Correct the static validator's Netlify Function handling.
7. Correct the Churchill quotation and homepage typo.
8. Resolve canonical/indexing/accessibility metadata in one small static-site pass.
9. Harden roster email validation and unmatched-ledger locking.

## Reproduction commands

Run these from the GrantDeskSite checkout:

```powershell
npm.cmd run hall-pass:test
npm.cmd run check
npm.cmd run build
npm.cmd run detour:validate
npm.cmd run remix:validate
npm.cmd run site:validate
npm.cmd run live-data:check
npm.cmd audit --omit=dev --json
node ..\work\site-audit-2026-09-01\crawl.mjs
```

Expected exceptions at this snapshot:

- `site:validate` fails on four dynamic `/.netlify/functions/news-image` references because of the validator bug described above.
- `live-data:check` currently fails on NPR because of the feed-image parser bug described above.
