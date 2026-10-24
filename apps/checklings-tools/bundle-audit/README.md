# Checklings ZIP handoff auditor

Independent, read-only delivery checker for AI-generated source/content bundles. It validates the **bytes actually inside a ZIP** against an explicit manifest of promised file paths and optional SHA-256 hashes. It does **not** execute supplied scripts, unpack arbitrary files, approve design decisions or claim that tests passed.

## Run

```sh
node apps/checklings-tools/bundle-audit/audit-bundle.cjs bundle.zip required-paths.json
node --test apps/checklings-tools/bundle-audit/audit-bundle.test.cjs
```

Manifest (a separate reviewer-prepared document, not text automatically trusted from the ZIP):

```json
{"schema":1,"requiredPaths":["docs/checklings/species/mosswisp.md",{"path":"apps/checklings-tools/asset-audit/audit-assets.cjs","sha256":"<64-character digest from a trusted source>"}]}
```

Without an expected hash, the script checks only presence and integrity of ZIP CRC32. A CRC32 is **not** a security hash and cannot authenticate an untrusted author; obtain expected SHA-256 from a separate trusted reference. Archive-only test claims are not execution evidence. A malicious author can simply include misleading source or tests; independent code review and actual tests remain necessary.

Safety: rejects path traversal, absolute/Windows paths, duplicate filenames, encrypted/symlink entries, unsupported compression, oversized/suspicious entries and corrupt CRCs. Never writes ZIP content to disk. Rejects sensitive reserved paths (`apps-script/hall-pass/`, `apps/checklings-service/`, `.env*`) so a public review ZIP cannot silently carry them. These checks complement, not replace, privacy inspection and secret scanning.

Exit status: `0` pass, `1` manifest/reserved-path failures, `2` malformed ZIP/arguments. Unclaimed extra files are explicitly listed as warnings and should be reviewed. A manifest cannot prove that a file was legitimately produced, just that it is present and matches a supplied digest.

## Evidence from October 23 Gemini v1.1 bundle

A separate local read-only audit against the Gemini v1.1 handoff ZIP and the `EXPECTED_FILES` paths in its own `scripts/test-batch2-deliverables.cjs` found **26 promised paths, 25 ZIP entries, 3 missing paths** (all `apps/checklings-behavior/experiments/{sim-individuality.cjs,test-sim-individuality.cjs,README.md}`), and 2 unclaimed files (the master test script and the behavior runtime module). That does **not** prove malicious intent or the absence of the separate, working PR #231 individuality experiment. The source archive remains unmodified and uncommitted here. Ask the author to fix the manifest/claims or provide a separate complete bundle, then rerun.

The archive checker is a proposed independent QA tool, not an installed production gate. No Hall Pass, Check-In, authentication, school data, deployment or shared game schema is changed.

## Independent hostile-archive review repair (October 23, 2026)

Reviewing the original 11-case suite exposed five false approvals. The checker now rejects inconsistent **local vs central ZIP flags/compression method** and, for records without data-descriptor bit 3, **local CRC/size disagreements**. It also treats reserved Hall Pass/service paths case-insensitively (for Windows consumers) and rejects control-character/newline ZIP entry paths to prevent log/path confusion. These measures do not mean the validator can safely extract untrusted archives: it deliberately never extracts or executes them.

The adversarial cases are committed in `review-regression.test.cjs` with in-memory fixtures. Native Node test command: `node --test apps/checklings-tools/bundle-audit/*.test.cjs`, **16/16 PASS** (11 original and five new) on the patched source. Source blob `15e7bfa9c903bb977017539f69032934ed4b1bb0`, reviewer-test blob `3085d1c6e7cf2ac636c5ac8a16a803877bb63631` match the independently exercised local files. Manifest authenticity remains a separate trust question, and no school/production system was tested or changed.

## Windows cross-platform filename hardening (October 23)

Reviewing follow-on ZIP handoffs on Windows exposed an additional false approval: two distinct archive paths can differ only in case and overwrite one another when handled on a case-insensitive filesystem. `entries()` now rejects case-fold-colliding paths. `safeName()` also rejects Windows device names (`CON`, `NUL`, `COM1`, etc.), alternate data-stream colons and forbidden filename characters, plus trailing spaces/dots on segments. Ordinary distinct mixed-case paths remain valid. These checks are conservative and purposely do not allow extraction as a side effect.

Three added cases in the original `audit-bundle.test.cjs` initially reproduced two failing accepts and one valid control; after repair the complete native Node suite is **19/19 PASS** (`node --test apps/checklings-tools/bundle-audit/*.test.cjs`). Tested/source blob `7f018f114c7751daedae5ca06d30bee73a5e9210`; updated existing-test blob `cd683aa76c0896695cd40a5ff1273d23ace07a88`. This is a defense-in-depth review improvement, not an approval to ingest untrusted content or any production deployment.

## Independent UNIX inode and ZIP flag review repair (October 23, 2026)

Review found four more falsely accepted ZIP types: Unix character/block devices, FIFOs/sockets, strong-encryption flag bit6 without the ordinary encryption bit, and ZIP directory entries carrying file content. The validator now only admits ordinary Unix regular-file/directory types (or mode 0 DOS origin), requires trailing-slash consistency and empty directory entries, and rejects unsupported general-purpose ZIP flags. Positive control for an ordinary regular Unix file remains supported. The reviewer proposed five reproducible tests (19/19 before as baseline; 20/24 with counterexamples, 24/24 after repair). All 24 tests pass on exact committed bytes in native Node 22.16.0. The tool still never extracts or executes archives and is not a substitute for manifest authenticity.
