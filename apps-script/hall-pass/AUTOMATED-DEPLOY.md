# Hall Pass automated Apps Script release bridge

This is the guarded production bridge between `Grantauch/the-desk` and the **existing** GrantDesk Hall Pass Apps Script web app.

It is intentionally not an automatic deploy-on-merge pipeline. Production changes require an explicit owner command, run the full repository release gate first, and update the existing deployment ID in place.

## What the bridge does

For every preflight or deployment, GitHub Actions checks out current `main`, installs locked dependencies, runs `npm run verify`, and runs the deploy bridge self-test.

A **preflight** then:

- authenticates to Google with the school account's OAuth grant;
- verifies the expected Apps Script project and existing deployment ID;
- verifies the target is still a web app;
- requires `DOMAIN` access and `USER_DEPLOYING` execution;
- requires the same five Apps Script source files used by the Version 18 release;
- compares Apps Script HEAD to the currently deployed numbered version and refuses to continue if somebody has an unpublished editor draft;
- makes no production changes.

A **deploy** performs all preflight checks, then:

1. replaces Apps Script HEAD with the exact five tested repository files;
2. reads all five files back and verifies normalized source equality;
3. creates a new numbered Apps Script version;
4. updates the **existing deployment ID** to that version;
5. verifies the stable web-app URL, `DOMAIN` access, and `USER_DEPLOYING` execution are unchanged;
6. records release evidence as a workflow summary and artifact.

The bridge has no code path that creates a new deployment. If a mutation fails before completion, it attempts to restore the prior deployment version and prior HEAD source before failing the workflow.

The browser-based synthetic `?mode=releasecheck` remains the required final protected-action smoke unless/until a separately reviewed safe automation for that check is added.

## One-time Google authorization

Do this only with the school Google account that owns/deploys the production Hall Pass project. Never send the generated OAuth secret through ChatGPT, email, Drive, an issue, or a repository file.

### 0. Allow Apps Script API management for the owner account

Google blocks applications from modifying Apps Script projects and deployments by default even after OAuth consent. While signed in to the school account that owns/deploys Hall Pass:

1. Open the **Apps Script dashboard**.
2. Open **Settings**.
3. Turn on the setting that allows the **Google Apps Script API** to access/manage your script projects.

This account-level switch allows authorized applications to manage Apps Script projects; it does not by itself authorize the GrantDesk bridge. The OAuth grant below is still required. You can revoke this Apps Script API access later from the same dashboard.

If the setting is unavailable or blocked by Workspace policy, stop and ask the district Google administrator to allow it. Do not work around a domain restriction.

### 1. Create a Google Cloud OAuth client

In Google Cloud Console:

1. Create or select a small Cloud project owned by the school account.
2. Enable **Google Apps Script API** for that Cloud project.
3. Configure Google Auth Platform / OAuth consent. For a school Workspace account, use an **Internal** audience when your administrator allows it.
4. Add only these data-access scopes for this release bridge:
   - `https://www.googleapis.com/auth/script.projects`
   - `https://www.googleapis.com/auth/script.deployments`
5. Create an OAuth client with application type **Desktop app**.
6. Download its JSON credential file to your computer.

If Workspace policy blocks the consent or Apps Script API, the district Google administrator must allow the client/scopes. Do not work around a domain policy.

### 2. Generate the one GitHub secret

From a local checkout of this repository, run:

```powershell
node scripts/get-hall-pass-google-oauth-token.mjs --credentials "C:\path\to\downloaded-client-secret.json"
```

The helper starts a temporary loopback listener on `127.0.0.1:53682`, prints a Google authorization URL, and waits. Open that URL while signed in to the Hall Pass owner/deployer school account and approve the two Apps Script management scopes.

When Google returns to the local helper, it prints one JSON value for the GitHub secret `GAS_OAUTH_JSON`.

Do not paste that value anywhere except the protected GitHub environment secret described below.

### 3. Configure the GitHub production environment

In repository **Settings → Environments**, create or open:

`hall-pass-production`

Add one environment **secret**:

- `GAS_OAUTH_JSON` — the complete one-line JSON value printed by the OAuth helper.

Add two environment **variables**:

- `GAS_SCRIPT_ID` — the Script ID shown in the production Apps Script project's **Project Settings**.
- `GAS_DEPLOYMENT_ID` — the existing production Hall Pass web-app deployment ID. This is the ID already embedded in the stable `/exec` URL. Do not create a replacement deployment.

If your GitHub plan exposes environment required reviewers, enabling owner review adds another useful protection. The workflow already requires an explicit owner command and uses a concurrency lock so two production releases cannot overlap.

After the secret is saved, delete the downloaded OAuth credential JSON if you do not otherwise need it.

## First connection test

Use one of these two equivalent paths.

### From GitHub UI

Go to **Actions → Deploy Hall Pass Apps Script → Run workflow** on `main` and choose `preflight`.

### From the permanent release-control issue

Repository owner `Grantauch` can comment exactly this on issue #28:

`/preflight-hall-pass`

The issue-command path exists so an authorized ChatGPT/GitHub session can request the preflight or deployment for the user without needing browser access to the Apps Script editor.

A successful preflight must report the existing deployment version, unchanged stable URL, `DOMAIN` access, `USER_DEPLOYING` execution, the exact five-file set, and no unpublished Apps Script editor draft.

## Production deployment

Only after an explicit release decision:

- GitHub UI: choose `deploy` and type the confirmation exactly `DEPLOY HALL PASS`.
- Release-control issue #28: repository owner comments exactly `/deploy-hall-pass`.

After a successful deploy, open the stable production `/exec` routes for student, kiosk, check-in, and teacher modes, then run the required synthetic release check once at `?mode=releasecheck` as the teacher.

## Files involved

The bridge deploys exactly these five files and refuses any other Apps Script source set:

- `apps-script/hall-pass/Code.gs`
- `apps-script/hall-pass/Index.html`
- `apps-script/hall-pass/ReleaseChecks.gs`
- `apps-script/hall-pass/ReleaseCheck.html`
- `apps-script/hall-pass/appsscript.json`

Bridge implementation:

- `.github/workflows/deploy-hall-pass-apps-script.yml`
- `scripts/deploy-hall-pass-apps-script.mjs`
- `scripts/get-hall-pass-google-oauth-token.mjs`
- GitHub issue #28, **Hall Pass Production Release Control**

## Security rules

- Never commit `GAS_OAUTH_JSON`, OAuth credential JSON, refresh tokens, client secrets, student PINs, or student data.
- Never place a production OAuth value in a GitHub issue or workflow input.
- Never change `GAS_DEPLOYMENT_ID` as a normal release step.
- Never use this bridge to bypass a Workspace administrator restriction.
- If preflight reports an unpublished Apps Script editor draft, stop and reconcile it rather than forcing an overwrite.
- A green source deployment does not replace the required post-deployment protected-action verification.
