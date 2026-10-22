# Checkling and Pond

Task owner: Codex. Isolated branch: `codex/checkling-pond-publish`.

## Checkling belongs to Daily Check-In

The companion appears inside the existing Apps Script Daily Check-In after identity verification. It is not a second check-in app. The four original friends, names, animated/still artwork, nuzzles and berry play come from the owner's supplied Grok export. School-day growth replaces the export's browser-local calendar-day tally.

The original PIN action, durable attendance inbox, timestamps, school calendar, late review and point settings remain authoritative. The companion reads the same official streak. Its five stages use best streak milestones of 0, 3, 7, 14 and 30 school days. A missed day does not shrink the pet; non-school days follow the existing calendar. A late sign-in welcomes the student but gains no automatic point or streak credit. Pet play changes neither attendance nor points.

Preferences contain only a schema version, one of four species IDs and an 18-character pet name. They live in the existing private Apps Script properties, under the verified class membership's key. Students cannot nominate another membership or import a fabricated attendance tally. The signed PIN session must still be valid. A new verified login reads the same preferences across devices. Student names, PINs and progress are not stored by the public site or browser-local pet profiles.

Reading a damaged preference permits a new selection. A pet-property read failure produces an optional unavailable state while leaving official confirmation visible. Failed preference writes never write attendance. Each preference is bounded to a small JSON value; there is no new sheet, trigger, roster column, workbook migration or per-minute pet polling. The original Apps Script property quota still applies; adoption can fail independently if the shared store is full.

Source: `apps-script/hall-pass/Code.gs` and `Index.html`. Public species artwork: `public/hubs/checkling/pets/`. Still images are selected when the browser requests reduced motion. The Apps Script client embeds the companion directly, retaining the established five-file deployment contract. The public site serves only pet artwork.

## Pond

Pond remains a free sandbox under `/hubs/pond/`, linked from Games and the sitemap. The supplied particle engine, materials, scenes and interface are the starting point. The production adapter is a static React app; it does not need the export's unused authentication, database or server scaffold.

Added: 20-step undo including individual brush strokes, pause after undo/import, automatic saves about every ten seconds and on page hide, JSON import/export, strict save validation, keyboard brush controls, browser navigation and reduced-motion shake handling. Sound starts muted, and unlocking audio respects a saved mute preference. Particle statistics update at a bounded rate. Hidden tabs stop simulation work. Invalid imports leave the existing world intact.

Source: `apps/pond/`. Published static output: `public/hubs/pond/`. This is independent of attendance and sends no student information. Saves belong to this browser unless exported.

To edit the app:

```sh
npm ci --prefix apps/pond
npm run pond:build
npm run pond:test
```

`pond:build` intentionally republishes the static bundle. Ordinary site verification is read-only and checks source/output fingerprints instead. The separate app lockfile keeps its React dependencies out of the rest of the site. Both its TypeScript check and Vite production build must pass before republishing.

## Verification and release

Focused server tests: `npm run checkling:test`. Original hall-pass contract and runtime: `npm run hall-pass:verify`. Sandbox physics/save tests and published fingerprints: `npm run pond:test`. Synthetic real-browser journeys: `npm run companion:browser`, after `npm run build`. The browser suite uses the actual Apps Script code in the existing fake runtime; every identity and PIN is synthetic, and all external services are intercepted offline. Both new suites are included in the repository's release commands.

The protected site release still requires `npm run verify`, protected GitHub review/build and normal Netlify deployment. Upload the pet artwork in the site release before deploying the Apps Script client that references it. Site publication does not deploy Daily Check-In.

Use `apps-script/hall-pass/AUTOMATED-DEPLOY.md` for the existing Apps Script release bridge. Preserve all five files, the domain-only manifest and the existing deployment URL; do not replace the service, run a broad setup or restore old snapshots. Preflight must establish that there is no unpublished editor draft. The authenticated synthetic release smoke and separate production readback remain required.

Original owner-supplied ZIPs are preserved. No original repository was overwritten. The integration is maintained in the website repository from here; the ZIPs remain the source baseline, not an update feed.

## Handoff

Original baseline: site main `07fe226e056d8d5b51557e55fd778dbf80450b48`. Publishing branch incorporates current main `3e71b3dc67e9d394d5c7ed634090814dd979c34c`, preserving its newer Dry County flight integration and tests.

Result: prepared source integration and static Pond build on the isolated branch. Local checks passed: 12 companion server scenarios, all 440 existing service behaviors, Turn In 39/39, six Pond physics/save tests, app TypeScript and production build, six responsive browser journeys, and all 18 release stages (resumed after updating the explicit test-stage contract). Astro reported zero errors and warnings; static validation checked 131 HTML files and 4576 references. An uninterrupted final full command was not repeated. The exact commit and publishing blocker are recorded with the delivery package. No merge, Netlify deployment, Apps Script deployment or classroom field use is implied by local tests.

Next owner: Grant or an authorized publishing session. Merge only after checks pass, release the site assets, then release the existing Apps Script deployment and run its protected synthetic smoke. GitHub write access is connected. Publication and protected CI are in progress; production releases remain pending their recorded gates.

## Protected CI timing repair

During publication, the prior main workflow `39712617542` had passed the full regression and general browser suites but reached its 30-minute deadline during Dry County browser acceptance. Dependency installation spent five minutes in its default audit, and the separate diagnostic report spent ten minutes waiting for the registry. The diagnostic now bounds each audit to 60 seconds with bounded fetch retries. A timeout, registry error or malformed response is explicitly UNAVAILABLE and never described as a clean audit. Valid advisories, including npm exit code 1, remain visible. Four focused regression cases run before the report. No release or browser checks were removed, and the workflow deadline is unchanged.

Preflight `39715268796` passed against production Version 39: all five production file hashes exactly match main `3e71b3d`; the stable URL, DOMAIN access and USER_DEPLOYING execution are preserved, with no unpublished editor draft. This updates the stale Version 35 documentation baseline without claiming the new companion is deployed.
