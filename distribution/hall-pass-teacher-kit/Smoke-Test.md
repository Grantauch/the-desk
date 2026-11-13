# Clean-environment staging test — 1.0.0-rc.2

Review candidate only. Use invented identities in fresh, private staging copies. Do not connect, enroll, rotate PINs or run setup in current production.

## Prepare the environment

1. On a clean supported computer with current Chrome, extract the exact candidate ZIP into an empty folder. Open Start Here, then Preflight. Select the extracted folder and require passing integrity. Select the original ZIP and compare its SHA-256 with a trusted candidate handoff. Save evidence outside the kit folder.
2. School IT must compare all seven blank-template source files with SOURCE-MANIFEST.json before deployment. A template link or version label does not prove integrity. For editor comparison, use the normalizedFiles hashes: UTF-8, CRLF converted to LF, with trailing LF characters removed (Google can omit the final newline). Use exact files hashes for packaged bytes. No other source difference is acceptable. Any changed file requires a new candidate and full test.
3. Use two authorized school-account teachers with separate private staging workbooks/deployments, a separately owned staging directory, and a dedicated managed school Chromebook using a non-teacher kiosk account. IT supplies authorized synthetic school-domain aliases; no actual student is a fixture.
4. Each teacher completes guided setup and Google consent in their own school account. IT verifies Execute as Me / USER_DEPLOYING and within the school / DOMAIN. Stop on Workspace policy blocks; do not use personal accounts or public access. Offline Preflight cannot inspect Google policy, template source or deployed permissions.
5. Run each staging deployment's protected ?mode=releasecheck as its owner. Require successful synthetic request/return and unchanged workbook facts. Keep raw output and retained test workbooks private. This test uses an isolated local-roster fixture; it does not establish shared-directory acceptance.

## Test both classrooms

Record only observed results in the corresponding Preflight items. All 16 begin Not run; choose Failed or Blocked when appropriate.

1. Import at least three invented identities: exact five-digit text number, exact six-digit text number beginning with zero, and an identity left unassigned. Use verified synthetic school-domain aliases. Verify import creates no classroom memberships and every unassigned identity is refused in both kiosks.
2. Connect both fresh classrooms to the same private staging directory. Enroll the first two identities explicitly in test sections. The exact original strings must work in both kiosks. Do not pad five digits or lose a leading zero. No premature submission at five digits.
3. Enroll the third identity only in A. It must work in A and fail in B. Deactivate an eligible membership in A and verify B is unaffected. Keep completed test history.
4. Verify each teacher sees only their own dashboard/logs. Student, kiosk and the other teacher's accounts must be denied teacher controls unless the owner explicitly grants teacher access. School-domain membership alone is not teacher authority.
5. During the configured staging class window, request and return a synthetic pass on the actual managed Chromebook in each room. Respect minimum pass duration. Verify exactly one completed countable pass in the correct room's log. Never alter production schedules for testing.
6. Inspect after every action, idle abandonment, reload, and as the next test user. Digits and prior-student details must clear. Check keyboard, touchscreen, fullscreen, sleep/wake and relaunch policy. Never sign a teacher into the shared kiosk.
7. In an IT-coordinated isolated staging test, exercise invalid synthetic attempts. Verify server throttling survives reload/cache clearing and browser nonce changes. Shared fallback budgets can affect test users; never do this against production.
8. Obtain synthetic sessions/action proofs, then correct that identity's exact number through the coordinator's approved procedure. Verify old PINs, sessions and proofs fail in both rooms. New exact strings work only in active memberships. DISABLED revokes both rooms; directory outage fails closed without restoring local PINs.
9. Interrupt Wi-Fi during request and return. Reconnect and inspect the correct teacher log before retrying an uncertain toggle action. Reconcile OUT/RETURNED status; do not repeatedly enter the PIN. Verify no duplicate trip and correct return attribution.
10. Reject duplicate numbers/emails, wrong-domain mappings, malformed input and numeric cells that lost zeros. Duplicate names require authoritative review, never guessed email mappings or name-only PIN changes.
11. Rehearse Recovery.md against staging copies with completed synthetic history. Privately compare before/after history counts, memberships and directory references. Retain deployment links and verify revoked sessions remain invalid after credential recovery.

## Release review

Record district authorization for reused payment-related identifiers, staff directory access, recovery ownership and retention. The required central software update/rollback design is unresolved: this candidate still needs per-copy software deployments, so mark update_model Blocked until it is implemented and tested.

Save the Preflight JSON outside the kit. IT may run `python verify.py candidate.zip --evidence record.json` to bind observations to the exact ZIP and manifest. Exit 0 indicates valid integrity and all operator-recorded cases passed; it does not authenticate an approval. Exit 2 means incomplete field evidence; 1 means invalid package/evidence. No private input is printed.

Distribute the finished ZIP only after authorized review accepts the clean-environment gate. Production cutover separately requires private backups, a coordinated window, verified source mappings, both-room smoke tests and explicit owner authorization. A test record or code merge cannot perform that cutover.
