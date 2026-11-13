# Hall Pass setup: current-flow review, November 5, 2026

Scope: installer entry, setup recovery, app publishing and transition to everyday use. Owner: Codex. This is a partial audit with source and synthetic tests; not school-account or managed-device acceptance.

Observed the live public /pass-setup/ page in the current browser run, saving and inspecting the entry and lower setup screenshots. The live instructions require the Hall Pass menu, repeat authorization/menu entry, six publishing steps, manual URL transfer, and a separate Windows integration block. The supplied teacher photo independently shows initial storage PERMISSION_DENIED; a source trace confirmed the old wizard continued to an empty form.

Highest-priority findings and implementation:

| Obstacle | Result in this change | Evidence still required |
| --- | --- | --- |
| Collapsed Sheets menus block setup | Large opening-page script button; retained home page | Click and consent from a fresh school-account copy |
| Long URL copied between screens | Discover own published link and validate deployment ID | Google bound-script discovery under school policy |
| Saved URL could belong to another room | Reject other-copy deployment; clear unverified home links | Actual school URL variant readback |
| Completion implies classroom readiness | Links-ready message plus enrollment and door-device tasks | Two-account sign-out/return on managed kiosk |
| Daily use feels like editing a spreadsheet | Direct dashboard/kiosk links; bookmark dashboard | Observed novice teacher completion |
| Windows installer appears required | Browser-first guide; Windows integration optional | School installation policy if Windows integration is used |

Technical checks use synthetic identities only. No user roster, PIN, private teacher copy or permission grant is included in this report. The current screenshots are intermediate audit evidence, not new-wrapper screenshots. Do not present them as proof of the new setup UI or deployed behavior.
