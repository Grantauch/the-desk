# GrantDesk Schoolwide agent rules

These rules apply to `schoolwide/` and are intentionally stricter than ordinary website work.

1. **Production firewall:** the existing classroom Hall Pass/Daily Check-In system is production. Do not modify, deploy, migrate, or make Schoolwide depend on the legacy runtime unless a later handoff explicitly authorizes a cutover/migration batch.
2. **Current baseline:** SW-010 branched from `the-desk` main commit `36088546070ac0f1b29b53d4f34018024092f84f`. Version 18 classroom behavior remains external production truth during this phase.
3. **No private data in Git:** never commit student records, PINs, PIN hashes, salts, OAuth tokens, workbook exports, private deployment IDs, or private operational URLs.
4. **Portable core:** business/domain code must not depend directly on Cloud Run, Cloud SQL, Supabase, Firebase, Netlify, or Apps Script APIs. PostgreSQL and standard HTTP/container interfaces are the portability boundary.
5. **School scoping:** every school-owned persistent record must be server-side scoped by `school_id`; never rely on browser filtering for authorization.
6. **Identity:** internal student UUID is canonical. Email, Classroom user ID, and legacy keys are aliases, not person identity.
7. **Database changes:** append numbered SQL migrations. Do not rewrite a migration after it has been used outside a disposable environment.
8. **Verification:** run `npm run verify`; database migration behavior is additionally tested in CI against disposable PostgreSQL.
9. **Failure semantics:** authorization ambiguity, tenant mismatch, unknown schedule, incomplete roster snapshot, or corrupt imported state must fail safe rather than guess.
10. **Scope discipline:** SW-010 is foundation only. Do not add Hall Pass/Check-In/Classroom business behavior until its implementation batch is authorized.
