# Recovery, updates and cutover

Package 1.0.0-rc.2 contains classroom application 1.0.0-rc.1 and the corrected setup recovery screen. Staging review only; this package does not authorize a production change or real credential cutover.

## Before an authorized change

- Coordinator: record the approved version, directory ownership/sharing and coordinated window. Obtain district authorization for exact lunch-number PIN reuse. Keep public/link sharing off.
- Each teacher: privately back up the classroom workbook; retain its original deployment ID, permanent /exec link, Apps Script version/source and settings. Record directory references, credential policy, completed log counts, OUT passes and queue state in a protected recovery record. Never include it in this kit, GitHub or support logs.
- Coordinator: privately back up the directory with numbers as exact text and retain Sheets version history. A workbook copy alone is not a complete Apps Script configuration/secret backup. IT preserves ownership and private configuration through the approved school process, without exporting credentials into this ZIP.
- Rehearse restoration in synthetic staging. Never deploy historical Hall Pass Versions 14–16, which have a known protected-action failure. Use a tested compatible version; an arbitrary old version may not honor the directory or current schema.

## If setup fails

For “reading from storage / PERMISSION_DENIED”, use a Chrome profile signed into only the teacher's school account, or an Incognito window with only that account. Open the existing teacher-owned copy, choose Hall Pass → Start setup, approve Google's permissions if asked, then reopen setup. Google documents multi-account problems with Apps Script: https://developers.google.com/apps-script/guides/support/troubleshooting#issues_with_multiple_google_accounts . This is a possible cause, not proof of the account's permissions. Keep the existing copy and tabs. If it persists, school IT must inspect that account's Apps Script access; provide the error and copy link privately. A source update cannot change school account policy, and existing copies do not automatically receive template updates.

The corrected wizard stops at a recovery screen when its first settings read fails. The questions and Next button become available only after a successful settings load. Retry is explicit; failed saves keep the teacher's answers on their current screen.

Stop in staging and leave production unchanged. Have IT resolve policy blocks; do not use personal accounts, public access or a shared teacher login. Re-extract a trusted ZIP after an integrity mismatch. Recheck mutable template source against the package before retrying.

## If an authorized software deployment fails

1. Pause new kiosk use and use approved teacher backup controls. Inspect the classroom log before retrying uncertain network requests; capture current pass/queue state privately.
2. In Deploy → Manage deployments, edit the existing deployment back to the retained, tested compatible version. Preserve DOMAIN and USER_DEPLOYING. Do not create replacement student links, clear Script Properties, run broad setup, reset PINs or delete tabs.
3. Confirm the original workbook and directory references. Run the staging protected test, then the approved synthetic post-change smoke on the affected deployment. Privately compare history counts and memberships with the recovery record; preserve valid trips made after the backup.
4. Restore service after request/return, teacher isolation and exact credential consistency pass. Escalate if the retained version cannot honor current directory/session behavior.

## If the directory is wrong or unavailable

Fail closed. Never disconnect the directory to restore generated PINs. Pause student kiosk actions; the coordinator restores authorized staff access or repairs the authoritative exact-ID record. Use approved teacher backup controls.

Directory recovery and software rollback are separate. Blindly restoring an old directory can revive revoked numbers. Review each changed identity against authoritative school records and coordinate recovery across teachers. Preserve exact strings and leading zeros; never pad five digits or match by name alone. Keep disabled identities disabled unless reactivation is authorized. Verify old sessions/proofs stay invalid and only current active memberships authenticate.

## Updates

The dashboard directory panel reports application version; the ZIP reports package version separately. Directory corrections synchronize automatically. Independent Apps Script software copies still need per-copy deployment updates. The required central software update model remains unresolved; this candidate is not automatically updated or self-installing.

Any candidate change requires a new version/checksum and the full exact-ZIP staging gate. Download publication, template publication and production cutover are separate actions requiring their own authorization. Nothing in this kit deploys code, rotates current PINs or activates schoolwide memberships.
