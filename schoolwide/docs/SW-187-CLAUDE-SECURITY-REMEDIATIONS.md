# SW-187 — Claude's required security changes, A and B

**Status:** Source-only repair on the existing review-only Schoolwide consolidation PR #524. No merge, approval, student identity/PIN bridge, Hall Pass, Check-In, Apps Script, schoolwide runtime or external deployment was performed.

This follows Claude's independent review of the SW-186 head `ece398a5b2436086c7b70bc926bf922bd846db5e`. Claude found two items **mandatory before any real student data work**. The subsequent Team Desk decision prohibits **all AI agents from merging, approving, or deploying Schoolwide PRs** while Claude is out. The earlier synthetic-only merge authorization does **not** override that later hold. Updating #524's head requires a new independent review; the previous assessment is not transferable to new SHA without inspection.

## A — fail-closed parsed YAML, not string-substring denylist

Original `schoolwide/scripts/verify-production-firewall.mjs` checked the cross-runner recovery workflow with text substrings. Such matching missed `permissions: write-all`, nested `jobs.<job>.permissions`, alternate `toJSON(secrets)` expressions, and YAML aliases or unexpected jobs.

The validator now parses YAML 1.2 using the pinned `yaml` package (dev dependency, no production-runtime import) with duplicate-key detection, rejects aliases and anchors, and checks the **exact structure** of the **one synthetic cross-runner workflow**:

- Top-level keys are exactly `name`, `on`, `permissions`, and `jobs`.
- Triggers are limited to the original scoped `push` and `pull_request` file/branch paths, without manual execution or high-privilege webhook triggers.
- Workflow permissions must contain `contents: read` **only**; jobs may not introduce their own permissions or `environment` contexts.
- Exactly two named `ubuntu-latest` jobs are allowed, each with its own exact disposable PostgreSQL 18 service, localhost test DSN, fixed expected test environment and `working-directory: schoolwide`. Restoration must depend on the export job.
- Every step must match its known action/run/arguments/environment keys and values. Only SHA-pinned Checkout/Node/Artifact actions and the required fixed commands are allowed. No arbitrary shell addition or extra artifact upload is accepted.
- GitHub expression interpolation is entirely forbidden in this synthetic workflow; its legitimate commands require none. A different workflow must be separately reviewed rather than added to this policy.
- The existing path-level production firewall remains in effect; the new parser only governs `.github/workflows/schoolwide-cross-runner-recovery.yml`. It **does not** claim to audit the separate staging-deployment workflow's entire behavior.

`npm run firewall` now runs both the existing file-scope firewall and `node --test scripts/test-production-firewall.mjs`.

## B — pin workflow actions to immutable Git SHAs

All external `uses:` references in the four Schoolwide workflows are now pinned to verified GitHub remote tag commits. This includes two Google actions used by the pre-existing isolated staging deploy workflow; that workflow is **not being triggered or deployed** by this change.

| Action | Verified tag | Pinned Git commit |
| --- | --- | --- |
| `actions/checkout` | v7 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node` | v7 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| `actions/upload-artifact` | v4 | `ea165f8d65b6e75b540449e92b4886f43607fa02` |
| `actions/download-artifact` | v4 | `d3f86a106a0bac45b974a628896c90dbdf5c8093` |
| `google-github-actions/auth` | v3 | `7c6bc770dae815cd3e89ee6cdf493a5fab2cc093` |
| `google-github-actions/setup-gcloud` | v3 | `aa5489c8933f4cc7a4f7d45035b3b1440c9c10db` |

Values were checked using `git ls-remote` against each GitHub action repository's indicated tag immediately before the pin. The test scans all four Schoolwide workflow YAML files and rejects any unpinned action reference.

### SW-170 staging-guard compatibility

The first exact-head GitHub run confirmed the 19 parsed-firewall tests passed, but the older `verify-staging-release.mjs` still insisted on the literal floating `google-github-actions/auth@v3` tag. That correctly failed after pinning. The existing staging guard now **requires the specific verified SHA** for Google authentication **and** for the Google Cloud CLI setup, instead of accepting the old tag. Existing no-manual-dispatch, staging-only release-request, branch, keyless-workload-identity and real-data protections remain unchanged. This is a static CI guard change, **not a staging deployment**.

## Regression evidence and limitations

- **19 focused local firewall checks**: current workload and Windows CRLF accepted; mutations for `write-all` root/job, job permission escalation, extra jobs, deploy environment, manual webhook, `pull_request_target`, unexpected environment, action refs/versions, shell injection, artifact retention, DB scope, YAML duplicate keys, anchors/aliases, and `toJSON ( secrets )` rejected; all external Schoolwide action references checked for full SHAs.
- **7/7** existing SW-178/185 disabled authentication boundary tests passed.
- TypeScript check, build and existing path firewall pass.
- Exact-head GitHub Linux Schoolwide CI, Staging Qualification, site check, and fictional two-runner recovery **must be rerun and observed on the new PR #524 SHA**. Local checks are not classroom acceptance.
- No real student records, PINs, existing Apps Script, VPS backups, or teacher-facing live service were read or modified. The synthetic CI password is public and remains **not** a production backup key.

## Release hold

**NO-GO for merging/approving/deploying while Claude is away.** Even after green checks, Claude or Grant must explicitly clear the later no-merge order and re-review this new exact head. Separate district identity approval, source PIN verification/key custody, managed Chromebook/school Wi-Fi acceptance, privately encrypted offsite production backup, independent restore and rollback are still required before actual student use.

See the comprehensive no-go matrix in `schoolwide/docs/SW-186-CONSOLIDATED-REVIEW-AND-NO-GO.md`.
