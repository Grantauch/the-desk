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
- [ ] Central software update/rollback meets the no-manual-patch requirement. **Currently blocked: independent Apps Script copies need per-copy deployments.**
- [ ] Authorized review accepts clean-environment evidence before distribution. Template publication and production cutover have separate authorization.

Real cutover also needs verified mappings, private backups, an agreed window, both-room smoke tests and explicit owner authorization. Keep current production and student PINs unchanged until then.

Never include real student data, numbers, PINs, tokens, private links or deployment credentials in the ZIP, public GitHub, distribution screenshots or support logs.
