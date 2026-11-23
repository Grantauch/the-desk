# SW-179 · Teacher Preview v0.2.0 Release Notes

**Scope:** Offline pre-launch rehearsal only; not a student kiosk installer, network diagnostic, identity-verification solution, or production rollout.

## Improvements

- Six-stage teacher walkthrough with a new offline device self-check.
- Explicit, actionable codes: SW-LOCAL-100/101/102/110/111 and SW-REAL-001/002/003. SW-REAL controls always read NOT TESTED; there is no remote verification and no network permission.
- Browser-only viewport and pointer-capability reports. These do not prove physical Chromebook touch support or classroom network availability.
- Keyboard arrow and Home/End navigation among numbered steps, plus existing Tab/focus behavior.
- Print the full six-stage guide; print CSS reveals all sections.
- Correct explanation of fictional demo's timeout: 15 seconds after starting (not 15 seconds of activity tracking).
- Previous synthetic 5/6-digit format demo and reset on blur, tab hide, pagehide, manual Finish remain.
- Deterministic v0.2.0-prelaunch ZIP with SHA-256 file manifest and strict allowlist. v0.1.0 ZIP is not overwritten.

## Acceptance

- Static Python tests: allowlisted source, all six pages, no network/storage, SHA-256/reproducibility and tamper rejection.
- Isolated Chrome: 320px, 390px and 1440px layout; offline diagnostics at mobile/desktop; keyboard arrows and focus; privacy blur, pagehide, manual and 15-second scheduled reset; checklist cannot complete early; print control and print CSS shows all sections.
- Linux Schoolwide CI remains release criterion. Passing these tests **does not** establish school Chromebook, authorized Google identity, actual student PIN, real server connectivity, or production readiness.

## Release boundary

Preserve existing lunch-number PINs and production Hall Pass/Check-In unchanged. No real PINs, students, student lists, salts, private URLs, API keys, or school login credentials are accepted or stored by the kit. The live school-specific installer and real device testing remain blocked on the approved authentication architecture and district authorization.
