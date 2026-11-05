# Hall Pass — teacher kiosk candidate

**1.0.0-rc.2 · Review only.** Application source remains 1.0.0-rc.1. Keep production and real student PINs unchanged until a separately authorized cutover.

1. Extract the whole ZIP into a clean folder. Open Start Here.html in Chrome.
2. Open package and staging checks; select that folder to verify files locally. Select the original ZIP to fingerprint the test record. Nothing is uploaded. Save evidence outside the kit folder.
3. Use only the coordinator-approved blank template checked by IT against SOURCE-MANIFEST.json. Paste its link in Start Here and copy it under your school account. A mutable/older template may not match this ZIP.
4. In the new staging spreadsheet choose Hall Pass → Start setup. The window creates the workbook and collects classroom title, student-email domain, pass rules and bell times. Google still requires account consent and web-app deployment.
5. Follow Google's deploy steps: Execute as Me and within your school. Stop on policy blocks. Start Here creates separate kiosk, dashboard and protected-test links from the permanent /exec URL.
6. Use Settings → school directory / enroll by number in the dashboard. Connect only the private staging directory for now; explicitly enroll synthetic identities. Imports create no memberships. Never share classroom history workbooks.
7. Run Smoke-Test.md with two school-account teachers and the managed kiosk Chromebook. Record observed results in Preflight and save the private review record.

After authorized cutover, students use the exact existing five- or six-digit lunch number in each explicitly enrolled room. Preserve leading zeros; never pad or generate substitutes. Authoritative school mappings are required; no name-only guesses.

## Included

Browser setup, offline file checks and operator test record, all seven program files, package/application metadata, source fingerprints and payload checksums, optional standard-library Python verifier for IT, smoke tests, IT checklist and recovery instructions. No real roster, lunch number, PIN, Google token, production deployment URL or credential is included. Public website asset references in source are not a classroom service connection.

Checksums detect mismatch, not authorship: compare the ZIP hash with a separately trusted handoff. Operator observations do not authorize release. Google policy, template source and real Chromebook checks require IT or the actual environment.

## Still blocked

A source-matched blank template for this candidate; second-teacher/managed-Chromebook field acceptance; district authorization for payment-related credential reuse; and centrally managed software updates. Directory corrections synchronize, but independent applications still need per-copy software deployment updates. That final requirement is unmet.

See School-IT-Checklist.md, Smoke-Test.md and Recovery.md. A candidate is not a production release.
