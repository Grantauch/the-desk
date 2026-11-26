# School IT acceptance — candidate 1.0.0-rc.2

All items begin pending. Keep reviewer identities, authorizations and private evidence in approved school storage. A checked box is not itself authority.

- [ ] District authorizes exact lunch-number PIN reuse, staff directory access, audit/recovery ownership and retention. No generated substitute PIN.
- [ ] The exact ZIP passes fresh-extraction checks and has not changed since testing.
- [ ] All seven template files match SOURCE-MANIFEST.json; no private data/configuration inherited. Compare package and application versions separately.
- [ ] Two teachers consent in their own school accounts. Workspace permits Apps Script/domain web apps. Review actual requested spreadsheet, staff email and trigger permissions. Offline checks require no additional Google scope. Never bypass an admin block.
- [ ] Each deployment is school-only DOMAIN, executing as USER_DEPLOYING; public access is off. Offline Preflight cannot verify this.
- [ ] Directory is separate and private, shared only with individually authorized staff (participating teachers are Viewers). Each classroom workbook/dashboard/history remains isolated.
- [ ] Exact five/six-digit strings are text. Authoritative school mappings resolve email/identity exceptions privately. No automatic padding or name-only matching.
- [ ] Imports create no memberships; unassigned entries fail everywhere. Exact strings work in both explicitly enrolled rooms. DISABLED revokes directory access across rooms.
- [ ] Student, kiosk and other teacher accounts cannot open this teacher's controls/logs unless explicitly authorized. No teacher session on the shared kiosk.
- [ ] Managed Chromebook passes keyboard/touchscreen, immediate clearing, idle/reload privacy, fullscreen, sleep/wake, relaunch and Wi-Fi recovery. Page fullscreen/wake-lock controls are not device management.
- [ ] Server throttling survives cache/nonce changes; corrections/revocations invalidate old sessions/proofs. Directory outage fails closed. Exercise lockout only in synthetic staging.
- [ ] Both rooms pass synthetic request/return, role isolation, network reconciliation and history checks on the exact version. Inspect uncertain actions before retrying.
- [ ] Private workbook, directory, configuration/source backups and compatible-version rollback are rehearsed without deleting history or reviving revoked credentials.
- [ ] Extract this exact ZIP on a normal computer, open Start Here.html, then Preflight. If the computer blocks `file://`, check it there. Do not weaken browser policy to imitate that check. Node checks the handlers only.
- [ ] Software update rehearsal: the owner-mediated copy of the seven approved source files upgrades a synthetic copy and rolls it back without deleting history. It refuses a production script id and a production spreadsheet id. `automaticSoftwareUpdates` stays false.
- [ ] The owner authorized distribution of this RC2 download. Production Apps Script cutover is still the owner-only deploy on `main` after the #319 freeze comment.

Real cutover also needs verified mappings, private backups, an agreed window, both-room smoke tests and explicit owner authorization. Keep current production and student PINs unchanged until then.

Never include real student data, numbers, PINs, tokens, private links or deployment credentials in the ZIP, public GitHub, distribution screenshots or support logs.
