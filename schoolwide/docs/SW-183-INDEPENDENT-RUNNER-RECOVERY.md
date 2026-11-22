# SW-183 — Fictional cross-runner encrypted recovery drill

**Release classification:** CI-only, synthetic-only, no student data, no access to school production systems. Stacked on SW-182 integration PR #498; remains review-only and unmerged.

## Evidence goal

SW-180 restored an encrypted fictional PostgreSQL dump into an isolated database container on **one CI runner**. It proved encryption, wrong-key and tamper rejection, completeness, and cleanup, but could not test transfer to an independent hosted runner.

SW-183 adds `.github/workflows/schoolwide-cross-runner-recovery.yml` with two distinct GitHub-hosted Linux jobs:

1. **package_synthetic:** starts a new PostgreSQL 18 service named `grantdesk_schoolwide_export_ci`, applies at least twenty Schoolwide SQL migrations, verifies zero student/organization/credential/check-in/pass-event records, inserts exactly three intentionally fictional canary rows in a test-only table, and produces a PostgreSQL custom-format backup. It encrypts that dump using GPG AES-256 under a **PUBLIC, fixed, non-secret TEST-ONLY passphrase**. The only published artifact holds the ciphertext and a SHA-256/row-count/schema-count metadata manifest, not plaintext, DB credentials, or real student records.
2. **restore_synthetic:** starts a second GitHub-hosted runner and separately initialized PostgreSQL 18 service named `grantdesk_schoolwide_restore_ci`. It downloads the encrypted artifact from the first job within the same workflow run, verifies its SHA-256, run ID and exact SHA, rejects wrong-key and tampered-ciphertext copies, requires the target database to have zero tables, then restores and compares public table count, migration count, three fictional records, and ordered canary SHA-256 digest. It rejects unexpected student/organization/credential/check-in/pass-event records after restore.

Both modes fail closed unless they are on a hosted GitHub Linux runner with `NODE_ENV=test`, forbidden legacy production writes, explicit synthetic opt-in, the exact short-lived workflow job name and the exact known disposable local PostgreSQL URL. Without opt-in, the workflow expects exit status 3. Neither workflow uses organization credentials, a live SQL service, a production URL, the old Apps Script, or the actual Hall Pass roster. GitHub-hosted worker disks and services are ephemeral.

## Security limitations (important)

- The encryption passphrase is intentionally **public** in the test source. Its purpose is to exercise interoperable encryption/decryption and ciphertext-integrity denial, **NOT to protect a confidential production backup**. Never copy this passphrase into a real script, production key store or offsite backup.
- The artifact transfer occurs within GitHub's own Actions infrastructure. It is a **different runner job** but does not prove private cloud-to-TheAtlas transport, air-gap restoration, or independent physical site availability.
- The SHA-256 manifest verifies incidental transfer integrity, not an independently authenticated backup origin against an attacker who can replace both files.
- This test does not prove secure key custody, encryption at rest for actual school backups, off-host retention, incident-response authorization, backup age and restore objectives, full real-data fidelity, or successful restoration of Apps Script/Checkaverse/Margin data.
- No signed PIN authentication, real Chromebook acceptance, teacher onboarding approval, or school-network behavior is tested.

Do not claim Schoolwide is student-ready until district identity/data authorization, independent security approval, actual ChromeOS acceptance, truly encrypted offsite backups with independent secret custody, and a supported live rollback/recovery drill are separately verified.
