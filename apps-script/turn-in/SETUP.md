# Turn In setup

**Already running Turn In?** Use [DEPLOY.md](DEPLOY.md) to update the existing
project. This setup guide is for a new installation. The original downloadable
patch is an older implementation and must not replace the current code.

Turn In is a small Google Apps Script web app that receives student work from the hubs. It is a separate project from Hall Pass, so a rush of turn ins at the bell never slows down check ins or passes. Students prove who they are with the same six digit PIN they already use for the hall pass.

You do this once. It takes about fifteen minutes.

## What you need open

- The Hall Pass Apps Script project (the editor, not the student page)
- This repository's `apps-script/turn-in/Code.gs` and `apps-script/turn-in/appsscript.json`

## 1. Create the project

1. Go to script.google.com while signed in to your school account and press **New project**.
2. Name it **the desk · Turn In**.
3. Delete everything in `Code.gs` and paste in the whole `apps-script/turn-in/Code.gs` file.
4. Open **Project Settings** (the gear), tick **Show "appsscript.json" manifest file in editor**, then open `appsscript.json` and replace it with the file from this repository.
5. Save.

## 2. Copy two values out of Hall Pass

Open the Hall Pass project, then **Project Settings → Script Properties**. Copy these two values somewhere private for a minute. Do not paste them into chat, email, a Doc or this repository.

| Hall Pass property | What it is |
|---|---|
| `SPREADSHEET_ID` | The Hall Pass workbook that holds the Roster tab |
| `PIN_SALT` | The secret that turns a PIN into the hash stored on the roster |

## 3. Paste them into Turn In

In the Turn In project, open **Project Settings → Script Properties → Add script property** and add:

| Property | Value |
|---|---|
| `ROSTER_SPREADSHEET_ID` | the Hall Pass `SPREADSHEET_ID` |
| `PIN_SALT` | the Hall Pass `PIN_SALT`, exactly as it appears |

If Hall Pass has no `SPREADSHEET_ID` property, open the Hall Pass workbook and copy the long ID from its address bar, the part between `/d/` and `/edit`.

Turn In only reads the Roster tab. It never writes to the Hall Pass workbook.

## 4. Run setup

1. In the editor, choose `setup` in the function menu and press **Run**.
2. Google asks for permission. Approve it with your school account. It needs Sheets (to read the roster and write turn ins) and triggers (for the nightly draft cleanup).
3. The log ends with `Ready. N students with PINs. Turn ins go to …`. That link is your new private workbook, **the desk · Turn Ins**. Bookmark it.

If setup says no active students were found, the roster ID or the salt is wrong. Check step 3.

## 5. Deploy the web app

1. **Deploy → New deployment → Web app.**
2. Description: `Turn In v1`.
3. Execute as: **Me**.
4. Who has access: **Anyone**.
5. Press **Deploy** and copy the web app URL. It ends in `/exec`.

"Anyone" is required because a page on grant-desk.com cannot send your students' Google login to a script. The PIN is the lock instead. Anyone who finds the URL still needs a real student PIN, wrong guesses are throttled per Chromebook and across the whole app, and the web app only ever answers a student with that student's own work.

If **Anyone** is missing from the list, your district has turned it off for school accounts. Stop here and tell Claude. Nothing else needs to change yet, and the hubs keep working with tab saving and Copy.

## 6. Connect the hubs

Send the `/exec` URL to Claude, or paste it yourself into `public/hubs/desk-save.js`:

```js
var ENDPOINT = 'https://script.google.com/macros/s/…/exec';
```

`npm run turn-in:test` checks the URL shape. Merge the change and Netlify publishes it.

## 7. Load test before students touch it

1. In the Turn In editor, run `startLoadTest`. The log prints a load test key.
2. Run `npm run turn-in:load -- <web app URL> <key>` from the repository, or send both to Claude to run.
3. It sends 35 synthetic students at the same instant, twice: once pressing Turn In and once autosaving. Synthetic PINs start with 9, so no real PIN is used, and their rows land only in the **Load Test** tab.
4. You want `PASS` and 35 new rows in the Load Test tab.
5. Run `stopLoadTest`. Delete the Load Test rows if you like.

## 8. Try it as a student

Open any hub on a Chromebook, type an answer, enter a PIN from a test student or your own roster entry, and press **Turn In**. A row appears in **Turn Ins** within a second or two.

## Reading the sheet

| Column | Meaning |
|---|---|
| Turned In | When the student pressed Turn In |
| Class / Period | Their class from the hall pass roster. A student in two of your classes picks one |
| Student Name, Student Email | From the roster |
| Hub, Hub Title | Which page |
| Answered | How many boxes had something in them |
| Words | Total words across every answer |
| Answers | Every question followed by the student's answer, numbered |
| Page, Submission ID | For tracing a problem |
| Data | Hidden. Used to bring work back when a student signs in on another Chromebook |

A student can turn in more than once. Each press is its own row, so the newest row is their final version. Sort by Class / Period, then Student Name, to grade by hour.

**Drafts** holds autosaved work so students can pick up on a different Chromebook. Drafts older than 30 days are removed every night at 2 AM. Turn ins are never removed.

## Updating the code later

A push to GitHub does not change the live web app. Paste the new `Code.gs` into the editor, then **Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy**. Editing the existing deployment keeps the same `/exec` URL, so the hubs do not need to change.
