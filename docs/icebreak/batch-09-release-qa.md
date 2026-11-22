# ICEBREAK — Batch 09: release-quality test gate

**Scope:** This draft is stacked on Batch 08 / PR #497. It changes test registration, browser acceptance and isolated CI, **not** gameplay physics. It is deliberately independent of the Vercel deployment status.

## Defect found and fixed

Before this batch, `npm run icebreak:test` did not include three existing regression files: `balance.cjs`, `contact-feel.cjs`, and `contact-combinations.cjs`. That meant a normal project verification or release runner could pass without checking the newest skating-edge balance, hit-feedback and interrupted give-and-go behavior. Similarly, there was no browser QA for the contact-feedback merge.

The standard `icebreak:test` script now lists all 10 existing source suites and `test-manifest.cjs`. The manifest contains two source tests that enumerate the actual `tests/icebreak` directory and fail if any source or browser test is omitted from its corresponding npm script. This prevents silent omission as more batches are added.

## Actual-browser acceptance

`tests/icebreak/contact-browser.cjs` runs Chromium against the fully instrumented game page served locally, with no external app or live website dependencies. It exercises:

- WebGL and Canvas fallbacks, desktop 1440×900 and touch-sized mobile 390×844, normal and `prefers-reduced-motion: reduce`. The test must run at least one real WebGL configuration and every Canvas configuration; GPU unavailability is not misreported as success.
- Glancing, solid, heavy and injury-tier checks generated from the existing collision solver. Tests assert impulse conservation, tier progression, inverse recoil direction, puck disruption thresholds, non-mutating render operations, viewport overflow and uncaught browser errors.
- Visible heavy knockdown and a skater staying down while the five-second injury timeout freezes the match clock; skipping resumes a legal faceoff.
- A clean received pass activating a give-and-go, followed by a solid check that strips the puck and cancels the stale cut. Screenshots capture the hit tiers and interrupted combination in each renderer and motion setting.
- Machine-readable scenario results are stored alongside image artifacts at `browser-results/icebreak/`.

## GitHub Actions

The scoped `.github/workflows/icebreak-qa.yml` runs for PRs touching ICEBREAK or test dependencies (and supports manual dispatch after the workflow reaches the default branch). It installs Node 22 and exact lockfile dependencies, installs Chromium, then executes **both standard project test commands**:

```
npm run icebreak:test
npm run icebreak:browser
```

It saves screenshots and evidence as a seven-day artifact even on failing browser checks, subject to GitHub Actions availability and permissions. The workflow is read-only and does not deploy, update production, or require Vercel.

## Current evidence and limitations

- Prior integrated candidate PR #497 passed **66/66 source test functions** in an isolated JavaScript DOM harness. This batch does not change game mechanics.
- Verified that every one of the now-11 source-suite paths and all five browser-script paths is registered in `package.json`, with no missing entries. Parsed the new browser test source successfully as JavaScript.
- **Not yet claimed:** native Node `--test` execution, actual Chromium results, screenshots reviewed, on-device gamepads/phones, 2-player fun tuning, full-site build or protected CI. This environment could fetch source through GitHub but could not clone the repo because direct shell networking to GitHub is unavailable. The new Actions workflow is intended to produce native evidence when it runs.
- The earlier hosted Vercel check reported a **build-rate-limit failure** on PR #497; that does not establish that the ICEBREAK code is defective.

**Review rule:** Keep this as a draft stacked on #497. Do not merge or publish on the strength of isolated tests alone. A reviewer should inspect the Actions run, download screenshots, and record physical player testing before release.
