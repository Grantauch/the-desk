# SW-185 — Prevent runtime imports of synthetic test modules

**Status:** review-only source-guard hardening. No production Hall Pass, Check-In, lunch PIN, Apps Script, student record, server configuration, or private Schoolwide runtime is modified or deployed.

## Confirmed gap

SW-178's source-level disconnection guard intentionally ignores `*.test.ts` files so isolated synthetic tests can import experimental credential-handoff and replay modules.

The guard previously checked runtime imports against **only two protected module paths**. It did not prohibit a production module from importing a synthetic test file which then imports or re-exports the protected module. This could cause the experimental code to become reachable through a test-module import despite the disabled-PIN safety boundary.

The regression was added **before** the fix and failed with:

`non-test runtime module should be denied: app.ts => import './credential-continuity/unsafe.test.js';`

This is a source guard bypass in an off-by-default **synthetic** codebase. There is no evidence of an actual production PIN-handoff endpoint or live exploitation.

## Repair

The SW-178 verifier now also rejects relative imports, re-exports, dynamic imports, and `require()` from **non-test TypeScript modules** that resolve to `*.test` or `*.spec` files or test/spec directory components. It recognizes NodeNext `.js`, `.ts`, and extensionless import forms after normalizing the resolved path.

Standalone isolated tests (including spec files) remain allowed to exercise the protected experimental modules, but the application source must not import those tests. The original direct protected-module check, buildApp server boundary, disabled identity-provider defaults, and nonliteral dynamic import denial remain intact. No new runtime module, credential API or provider override was added.

## Evidence

- Original six adversarial SW-178 checks still pass.
- New SW-185 test rejects regular imports, type-only imports, export-star re-exports, dynamic imports and require of test/spec modules, including nested and extensionless paths.
- The test confirms isolated test/spec files remain exempt; a normal runtime import to the shared **type-only contract** and a safe filename with `.test-data` remain allowed.
- Local `npm run handoff:guard`: 7/7 pass, after the new test initially failed against the old guard.
- Local TypeScript check, build, and production firewall pass.
- Initial GitHub CI exposed a pre-existing intermittent synthetic SW-175 tamper-test defect: replacing the first random MAC character with a hard-coded `A` is a no-op whenever the original MAC already starts with `A`. The test now chooses a **different** first character and asserts the MAC changes before verifying rejection. No production HMAC logic is changed.
- GitHub exact-head CI and independent security review are still required before integrating this into the synthetic staging candidate.

## Limits / rollout gates

This AST/source tripwire is not equivalent to a complete threat-model review or policy enforcement on the running server. It does not authorize live student logins. Claude must independently review the stacked security changes and establish district-approved student identity handling, recovery, key management and real ChromeOS/network acceptance before any live PIN handoff.

Parent synthetic Schoolwide PRs remain unmerged; the existing lunch-number PINs and production Apps Script deployments are unchanged.
