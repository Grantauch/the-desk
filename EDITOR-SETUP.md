# The Desk web editor

The private editor lives at **https://grant-desk.com/editor/**. It is not in the public navigation or sitemap.

Once the one-time setup below is finished, the everyday workflow is:

1. Open `/editor/` on any device.
2. Sign in.
3. Change site words or write an announcement.
4. Press **publish**. Netlify rebuilds the public site automatically.

No local copy, terminal, Git command, or code edit is required.

## One-time secure setup

### 1. Enable Netlify Identity

In the Netlify project for `grant-desk.com`:

1. Open **Project configuration → Identity** and enable Identity.
2. Set registration to **Invite only**.
3. Set the site URL to `https://grant-desk.com`.
4. Invite the one email address Grant will use for the editor.

The invite email may land on the homepage first. The site automatically sends Identity links to `/editor/`, where Grant chooses a password.

### 2. Create the narrow GitHub access key

In GitHub, create a **fine-grained personal access token** with:

- Repository access: only `Grantauch/the-desk`
- Repository permission: **Contents — Read and write**
- No additional write permissions

Choose a useful expiration and record a reminder to renew it. Never paste this token into the repository or editor page.

### 3. Add the two private Netlify variables

In **Project configuration → Environment variables**, add:

- `EDITOR_EMAIL` — the exact invited Identity email
- `GITHUB_EDITOR_TOKEN` — the fine-grained token from GitHub

Optional overrides exist for `EDITOR_REPOSITORY` and `EDITOR_BRANCH`; the defaults are `Grantauch/the-desk` and `main`.

Trigger one new production deploy after adding the variables. Then sign in at `/editor/` and publish a harmless wording change as the final check.

## Security notes

- The GitHub key stays server-side inside Netlify Functions. It is never sent to the browser.
- Every read and write requires a valid Netlify Identity session and the exact `EDITOR_EMAIL`.
- The API can change only `src/data/site-content.json` or create an announcement Markdown file.
- Requests are same-origin checked; the editor is uncached, unindexed, and cannot be framed.
- If the GitHub key expires, the public site keeps working. The editor reports that publishing access needs renewal.

The Windows shortcut and local editor remain available as an emergency fallback.
