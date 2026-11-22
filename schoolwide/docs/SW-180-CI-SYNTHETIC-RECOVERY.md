# SW-180 — Encrypted synthetic PostgreSQL recovery drill

**Status:** CI-only safety test; not deployed. No school, staff, student, PIN, password, or private production record is accessed. This test does not establish production off-host recovery readiness.

## Why it exists

Schoolwide's private VPS staging has already proved local backup integrity, scheduled archives, a byte-matching pull to TheAtlas, and restoring that copied fictional dump back onto the *original VPS*. Those checks do **not** demonstrate encrypted archive handling or recovery in an independent database environment.

SW-180 creates the next layer of **synthetic-only automated evidence**:

1. Fail closed unless the script runs inside GitHub Actions on Linux, with `NODE_ENV=test`, an explicit synthetic-recovery flag, forbidden legacy writes, and the exact isolated CI PostgreSQL service URL.
2. Create a **new disposable source database**, run all Schoolwide migrations, and insert only three explicitly fictional recovery-canary records.
3. Produce a PostgreSQL 18 custom-format dump, verify its format, and encrypt it with standard GPG/OpenPGP AES-256 using a 384-bit randomly generated **test-only passphrase** held in a temporary restricted file.
4. Prove both a different passphrase and a corrupted encrypted payload **fail decryption**; never promote an incorrectly decrypted file.
5. Initialize a **separate clean PostgreSQL 18 container** with no network connection or published ports. Require it to be empty before restoring the decrypted archive.
6. Restore with `pg_restore --exit-on-error`; compare the restored public table count, migration count, synthetic row count and a SHA-256 digest of the ordered fictional canary rows to the source.
7. Remove the disposable source database, independent container, GPG test passphrase, encrypted test archive and temporary files, even when a test fails.

The source-to-recovery process runs in a disposable GitHub-hosted runner, not a school server. GitHub CI runs the guard's explicit-denial test before the positive drill. The script does not touch the nightly VPS backup jobs.

## Limits and production gates

- A fresh isolated container inside one CI runner **is not** a wholly separate physical server or off-site restore.
- Generating and using a disposable GPG passphrase **does not** establish secure production key escrow, key rotation, recovery responsibilities, access control or disaster-recovery procedures.
- A fictional canary record is **not** representative of every real historical student/teacher schema, file, permissions model, or ancillary service.
- No evidence of actual Windows disk encryption, VPS archive encryption, encrypted offsite retention, separate-host independent restore or school network testing is claimed.
- None of the tests authorize live login, credential transfers or changing student lunch-number PINs.

**Production Hall Pass, Check-In, teacher dashboard, real student records, and source PINs stay untouched.** Real migration is gated on district authorization, Claude's identity/security review, supervised Chromebook acceptance, and actual separately protected disaster-recovery rehearsals.
