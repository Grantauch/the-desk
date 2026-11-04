# School IT acceptance

- [ ] Apps Script and its school-domain web apps are permitted by Workspace policy.
- [ ] Teachers approve Google permissions using their own school accounts.
- [ ] Each classroom deployment uses DOMAIN access and USER_DEPLOYING execution.
- [ ] The school directory is separate from every classroom's pass-history workbook. Only authorized staff have access; participating teachers receive Viewer access to the directory. No public/link sharing.
- [ ] Numbers are exact five- or six-digit strings, stored as text. Verified email mappings come from authoritative school records.
- [ ] Unassigned directory entries cannot start passes or check in. The same number works only in explicitly enrolled classrooms. Teacher dashboards remain isolated.
- [ ] Shared Chromebook uses a school kiosk account with no teacher dashboard privileges. Screen reset, touchscreen buttons, fullscreen, Wi-Fi recovery and school-managed sleep/relaunch policy have been checked.
- [ ] Synthetic pass/return and protected release checks pass on the exact installed version. An interrupted sign-out is checked in the dashboard before a retry.
- [ ] Existing private workbook and Apps Script version are retained before cutover.

The app uses existing lunch numbers as requested by the school coordinator. Keep these numbers private. Server-side attempt limits use a school-account or Google-derived identity, with a conservative shared fallback when Google supplies no stable identity. Browser nonces alone cannot reset that budget.

Never place student data or credentials in the ZIP, public template, website, GitHub, screenshots for distribution, or support logs.
