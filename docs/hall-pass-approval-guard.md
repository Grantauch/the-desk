# Hall Pass approval guard — issue #329

Task owner: Codex. Source-review branch: `work/hall-pass-329-approval-guard`.
Production, template, ZIP publication and PIN cutover remain unauthorized. This batch
does not change the application, policy flags, existing public ZIP or production.

## Protected checks

| Path | Required check |
| --- | --- |
| `scripts/check-hall-pass-publication.py` | Read `distribution/hall-pass-teacher-kit/VERSION.json`; require an explicit boolean `distributionApproved`. If false, reject Hall Pass ZIPs anywhere under `public/`. Match case-insensitive HallPass / Hall-Pass / Hall_Pass path names, and inspect `VERSION.json` members to detect renamed installer ZIPs. Reject unreadable metadata, invalid ZIPs and symlinks under `public/`. |
| `npm run verify`, `verify:full`, `verify:storyhub-fast`, `build` | Run the publication guard before downstream verification/build commands. `build` uses npm's `prebuild` hook. Missing Python fails closed. Netlify's configured `npm run verify` uses the same gate. |
| `.github/workflows/site-check.yml` | Run fixture tests and the publication guard before dependency installation and either release lane. |
| Both Apps Script deploy workflows | Restrict dispatch/comment jobs to `Grantauch`, including `github.triggering_actor` for reruns. Existing `main` and production-environment restrictions remain. Turn In manual dispatch now also requires `DEPLOY TURN IN`. |
| Both `scripts/deploy-*-apps-script.mjs` entrypoints | Before credentials, source reads or network access, require exact repository `Grantauch/the-desk`, ref `refs/heads/main`, owner actor and rerun actor, supported event, and boolean `productionCutoverAuthorized: true`. Dispatch requires event input `mode: deploy` and exact `DEPLOY HALL PASS` / `DEPLOY TURN IN`. Comments require a newly created exact `/deploy-hall-pass` / `/deploy-turn-in` command by the owner on #28. |
| Existing candidate builder | Still refuses every output destination under `public/`, even if someone changes the distribution flag. No new public ZIP creation path is introduced. |

Preflight mode retains its existing read-only behavior. No preflight or deployment
workflow was invoked for this batch. The guard itself performs no network requests
and does not fetch, interpret or write approval comments.

## Verification

`npm run hall-pass:approval:test`: **10/10 grouped fixture tests PASS**. Includes
strict booleans, closed-gate owner refusal, actor/rerun/repository/ref/event failures,
exact confirmation and comment checks, renamed/case-varied/nested ZIPs, invalid or
missing metadata, unrelated ZIP allowance, malformed ZIP refusal, candidate-builder
public-output refusal and copied npm gate integration. Deployment entrypoints are
copied to temporary fixture directories with synthetic policy/events, no application
source or credentials, and a fetch trap. Refusals occur before source/credential
access; zero network attempts or release-evidence artifacts are observed. Synthetic
open policies test only the pure authorization decision, never a successful deploy.

Node syntax checks for the changed deployment helpers and shared authorization
module pass. All three changed workflow YAML files parse. Whitespace checks pass.

The actual read-only `npm run verify` exits 1 at the new guard because the unchanged
inherited `public/downloads/HallPass-Teacher-Installer-v1.0.0-rc.1.zip` is present and
`distributionApproved` is false. Full downstream verification is therefore **blocked,
not passed**. There is intentionally no RC1 exception or approval override. A later
authorized batch must reconcile that artifact with the release policy before a site
build can pass. Removing it or setting approval true is outside this batch.

## Limits and handoff

- These are repository/script policy checks, not an authentication service. The
  local policy flags are necessary technical conditions, not proof of approval.
  A new owner comment on #319 must explicitly authorize cutover and name the Batch
  07 freeze SHA; district approval and all human gates in #329 still apply. This
  batch neither validates those records nor grants approval by a passing test/PR.
- GitHub event/actor fields are trusted in GitHub Actions. A local operator able to
  forge environment/event files or change the code can bypass these checks. Keep
  existing environment protections, review requirements and credential controls.
- The scanner recognizes ZIP filenames/paths and installer `VERSION.json` identity.
  A deliberately renamed and repackaged archive stripped of identity, another
  archive format or external hosting is outside this detector. It never extracts
  archives; metadata reads are bounded to 64 KiB per version member.
- Direct `astro build`, arbitrary direct provider uploads, old workflow revisions,
  the separate template publisher, and provider consoles are not made secure by
  npm hooks. No remote permissions or environment settings were changed.
- Existing online downloads are not revoked by this source change. No production
  system, private workbook, real student data, PIN, token or credential was read.
- The source-review commit uses `[skip ci]` to avoid starting the deployment
  workflow's PR self-test. No workflow is dispatched, rerun or approved. Protected
  CI and any future activation remain separate; do not merge this review as a
  workaround for the closed gate.

Next action: owner/reviewer reviews the guard source. Keep publication and cutover
closed; resolve the inherited ZIP and #329 human gates in a separately authorized
batch. This fixture pass is engineering evidence only.
