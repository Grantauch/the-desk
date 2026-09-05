# START HERE

> **✓ Done — all of this happened on July 10, 2026.** The site is live at grant-desk.com,
> pushed to GitHub, and auto-deploying via Netlify. This file stays as a reference in case
> you ever need to set it up again from scratch. The only section you still need is
> **"Everyday updates"** at the bottom.

The site is fully built. Three stages get it live at **grant-desk.com**: run it locally, push to GitHub, deploy on Netlify. Copy-paste the commands in order.

## 1. Run it on your computer (5 min)

Open PowerShell and run:

```powershell
cd C:\Users\Grant\GrantDeskSite
npm install
npm run dev
```

Open http://localhost:4321 in your browser. That's the site. Leave `npm run dev` running while you edit — changes appear instantly. Press `Ctrl+C` to stop it.

## 2. Push to GitHub (10 min)

First, create the repo on GitHub: go to https://github.com/new, name it `the-desk`, leave everything else unchecked (no README, no .gitignore), click **Create repository**.

Then in PowerShell:

```powershell
cd C:\Users\Grant\GrantDeskSite
git init
git add .
git commit -m "the desk: initial site"
git branch -M main
git remote add origin https://github.com/Grantauch/the-desk.git
git push -u origin main
```

If Git asks who you are first:

```powershell
git config --global user.name "Grant"
git config --global user.email "gmauch22@gmail.com"
```

## 3. Deploy on Netlify (10 min)

1. Go to https://app.netlify.com and sign up/log in **with your GitHub account**.
2. Click **Add new project → Import an existing project → GitHub**, authorize, pick `the-desk`.
3. Netlify auto-detects Astro. Confirm: build command `npm run build`, publish directory `dist`. Click **Deploy**.
4. In a minute you'll have a live URL like `something-random.netlify.app`. The site is on the internet.

From now on, every `git push` automatically redeploys the site.

## 4. Connect grant-desk.com (10 min)

1. In Netlify: **Domain management → Add a domain → grant-desk.com**.
2. Netlify shows you DNS records to add. In Cloudflare (dash.cloudflare.com → grant-desk.com → DNS):
   - Add a **CNAME** record: name `www`, target `your-site-name.netlify.app`
   - Add a **CNAME** record: name `@` (grant-desk.com), target `apex-loadbalancer.netlify.com`
   - Set both records to **DNS only** (click the orange cloud so it turns grey). This matters — Netlify handles HTTPS itself and the Cloudflare proxy conflicts with it.
3. Back in Netlify, wait for the domain to verify, then enable HTTPS (it's automatic, may take up to an hour).

Done. grant-desk.com is live.

## Everyday updates (the workflow you'll actually use)

For site wording and announcements, open **https://grant-desk.com/editor/**. Sign in, make the change, and press publish. It works from a Chromebook or any other browser and does not require code. The one-time private connection is documented in `EDITOR-SETUP.md`.

The local workflow below remains the fallback for structural code and curriculum-file changes.

There are two supported routes and they do not overlap.

**Words and announcements** go through the browser editor above. Nothing is installed and no Git command is involved.

**Structural code and curriculum files** go through the local checkout. Collect several edits into one tested batch instead of publishing after every small change:

```powershell
cd C:\Users\Grant\GrantDeskSite
npm.cmd run dev      # look at your change on localhost:4321
.\publish.bat        # checks, builds, and publishes one tested batch from main
```

Common edits are listed in **EDITING.md**, which says exactly which file to touch. For AI assisted edits, see the section at the bottom of EDITING.md.
