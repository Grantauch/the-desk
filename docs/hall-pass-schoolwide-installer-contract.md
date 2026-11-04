# Hall Pass Schoolwide Kiosk — Distribution and Cutover Contract

Status: DEVELOPMENT SPECIFICATION ONLY. Not a production installer.

## Product commitment
A distributable **HallPass-Teacher-Installer-vX.Y.Z.zip**. A teacher extracts it, opens **Start Here**, signs into a school Google account, configures their classroom, accepts the required Google/IT permissions, and receives separate permanent **kiosk** and **teacher** links. No website hosting or software installation on the door Chromebook is necessary.

The package is **not** allowed to contain real student names, lunch codes, PINs, school account tokens, Google credential material, operational logs, or the current production workbook. Extracting a ZIP cannot bypass Google OAuth consent, school-domain restrictions, or admin-approved Chromebook kiosk controls.

## Non-negotiable identity rules
- User requirement: **the existing cafeteria/lunch number is the student's Hall Pass PIN**. Do not generate an alternate credential for an imported schoolwide student or silently change their lunch code.
- Treat identifiers as **strings**. Valid school-issued inputs in the supplied roster include five-digit codes and six-digit codes, some beginning with zero. Preserve the exact number of digits and leading zero.
- Import only from a separately protected authoritative school data source, not GitHub, the downloadable ZIP, public websites, source fixtures, or release artifacts.
- The user-provided school list currently pairs names with cafeteria numbers, not school emails. Verify each person's mapping to a durable school/student identity before writing any real credentials. Never use name-only fuzzy matching to assign a secret.
- Schoolwide directory membership by itself confers NO classroom rights. Only an explicit active section assignment allows a pass.
- The same verified student must have the identical cafeteria PIN in both teacher installations. Teacher roster updates must not locally regenerate or overwrite that canonical PIN.
- Teacher A and Teacher B have separate pass queues, limits, audit logs, and dashboard authorization. Neither teacher can browse another teacher's class data.
- Reuse of payment-related credentials is a deliberate district-policy decision; document written school approval. Use kiosk privacy protections, durable server-enforced rate limiting, audit trails and controlled credential recovery; never display a typed PIN on the shared station.

## Installer lifecycle
1. **Open** Start Here. Check platform/browser compatibility. Explain the required district permission and school Google sign-in.
2. **Connect** to a school-owned identity/directory service or create an approved isolated Google Apps Script + spreadsheet instance; request only the necessary permissions.
3. **Configure** teacher name, active classes, period/bell schedules, local policy and class list; all unassigned directory students remain disabled.
4. **Provision** the deployment and validate the returned URLs; keep student/teacher data in the new teacher's private environment with no production GrantDesk workbook references.
5. **Configure** dedicated door Chromebook (persistent web app view, full-screen, password field, idle reset, no student data remaining after use, controlled access to non-kiosk URLs).
6. **Verify** synthetic student sign-out/return, multi-class identity mapping, inactive-student denial, audit logging, stale/failed network handling, and teacher-only dashboard permissions.
7. **Handoff** kiosk URL, teacher dashboard URL, installation receipt, help/repair instructions, update version and roll-back support.

## ZIP layout (planned)

```text
HallPass-Teacher-Installer-vX.Y.Z.zip
  Start Here.html
  README.md
  manifest.json
  setup/
    setup-wizard.html
    validation-checks.json
  docs/
    School-IT-Checklist.md
    Teacher-Quick-Start.md
    Troubleshooting.md
    Rollback-and-Recovery.md
```

Whether additional local helper files are needed depends on the Google OAuth/service deployment architecture. The package should remain **cross-platform/browser-first**, because the student kiosk is a Chromebook.

## Test matrix
- New school account without a website; Google Apps Script consent; administrator-denied setup presents a clear error with no partial enrollment.
- 5-digit lunch PIN; 6-digit PIN; leading-zero 6-digit PIN; duplicate/blank codes; missing email identity; nonnumeric codes; two different students with conflicting PINs.
- Same student enrolled in one teacher and then a second teacher, exact same PIN each time; unassigned student's PIN rejected at every kiosk.
- Kiosk resets fully after a completed action, after timeout, and after failed action. The student PIN is never shown in cleartext or retained in shared kiosk state.
- One active pass at a time within a teacher's rules, correct queue transitions and returns, denied student or teacher action, auditable manual override.
- No inter-teacher data leakage, no cross-tenant dashboards, no accidental use of GrantDesk production links.
- Unplug/reconnect kiosk Wi-Fi mid-request; retry does not duplicate pass/action.
- ZIP clean-install test from extracted archive (not local developer sources); verify version/checksums and no embedded credentials/PII.

## Existing code findings from November 4 audit
- `apps-script/hall-pass/Code.gs`: `teacherSetLunchNumberPins` supports an email + exactly-six-digit-number paste, preview and confirmed update only for **active** students in this one workbook. It does not import the unassigned student directory.
- `verifyStudentPin_` and several PIN card recovery paths assume exactly 6 digits. 5-digit codes need end-to-end support without guessing/padding.
- `apps-script/hall-pass/Index.html`: PIN fields have maxlength 6 and pattern exactly 6, and associated help text assumes six digits.
- The PIN Cards cell format needs explicit plain text to avoid losing leading zeros in cafeteria numbers.
- `apps-script/hall-pass-template/Setup.gs` already provides distinct kiosk and teacher URLs, and `src/pages/pass-setup.astro` already has the copy/install walkthrough.
- Separate Apps Script copies currently have no shared canonical student-credential lookup or synchronized rotations.
- Existing schoolwide architecture issues #89 and #105 identify scalability/security blockers. Do not promote the existing isolated classroom app to a schoolwide shared backend without addressing those gates.
- Current production workbook, student PINs and kiosk links must remain unchanged until a verified school-approved cutover.

## Release acceptance
The **single versioned ZIP** and its setup flow are tested from a clean teacher environment; both teacher kiosk and dashboard work; exact lunch-number credentials are shared across teachers; schoolwide unassigned students remain inactive; no private data appears in the ZIP/repo; source is verified; a backup and rollback plan exists. A prototype or documentation-only ZIP must be explicitly labelled *not production-ready*.

Tracks #319.
