# Hall Pass — teacher kiosk candidate

**1.0.0-rc.2 · Owner-authorized download.** Classroom application 1.0.0-rc.1. The owner authorized this rollout on November 25, 2026. The ZIP contains no student roster. Installing it does not by itself change the production workbook or the live Apps Script deployment. That deploy stays a separate owner step.

1. Extract the whole ZIP into a clean folder. Open Start Here.html in Chrome.
2. Open package and staging checks; select that folder to verify files locally. Select the original ZIP to fingerprint the test record. Nothing is uploaded. Save evidence outside the kit folder.
3. Use only the coordinator-approved blank template checked by IT against SOURCE-MANIFEST.json. Paste its link in Start Here and copy it under your school account. A mutable/older template may not match this ZIP.
4. On the new staging copy’s opening page click the large Start setup / show my links button; no Sheets menu is needed. After approving Google access, click that same button again. The opening page stays available after setup. The window creates the workbook and collects classroom title, student-email domain, pass rules and bell times. Google still requires account consent and web-app deployment.

5. Follow Google's deploy steps: Execute as Me and within your school. Stop on policy blocks. Return to the setup window and click Find my app link. It verifies the deployment belongs to this copy and saves the dashboard/kiosk links on the opening page. Bookmark the dashboard; daily use is in the app. Start Here also has an optional spare-shortcut form.
6. Use Settings → school directory / enroll by number in the dashboard. Connect only the private staging directory for now; explicitly enroll synthetic identities. Imports create no memberships. Never share classroom history workbooks.
7. Run Smoke-Test.md with two school-account teachers and the managed kiosk Chromebook. Record observed results in Preflight and save the private review record.

Use a Chrome profile signed into only your school account, or an Incognito window with only that account. If setup reports “reading from storage / PERMISSION_DENIED”, reopen your existing copy there and run Start setup again. Keep its tabs. See Recovery.md if it persists; existing copies do not automatically receive template software fixes.

After authorized cutover, students use the exact existing five- or six-digit lunch number in each explicitly enrolled room. Preserve leading zeros; never pad or generate substitutes. Authoritative school mappings are required; no name-only guesses.

## Included

Browser setup, offline file checks and operator test record, all seven program files, package/application metadata, source fingerprints and payload checksums, optional standard-library Python verifier for IT, smoke tests, IT checklist and recovery instructions. No real roster, lunch number, PIN, Google token, production deployment URL or credential is included. Public website asset references in source are not a classroom service connection.

Checksums detect mismatch, not authorship: compare the ZIP hash with a separately trusted handoff. Operator observations do not authorize release. Google policy, template source and real Chromebook checks require IT or the actual environment.

## Still a person, not this ZIP

Extract this ZIP on a normal computer and open Start Here from the folder. A browser that blocks `file://` is not a failed package; do not weaken browser policy to imitate that check. The number-to-email mapping and the production workbook stay with the owner, outside git. `automaticSoftwareUpdates` stays false. An owner can rehearse copying the seven source files into a synthetic copy; that rehearsal refuses a production script id and a production spreadsheet id. The live Apps Script deploy is still the owner-only `DEPLOY HALL PASS` step on `main`.

See School-IT-Checklist.md, Smoke-Test.md and Recovery.md. A candidate is not a production release.
