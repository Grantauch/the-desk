# Publication readiness · November 6, 2026

Owner: Codex. Grant requested a complete unpublished/merged/live audit and publication of finished work. Draft, merged, published and classroom-accepted remain distinct.

## Current public baseline

Netlify production was independently read at commit 0987512a2715aa36bf5bcbb6edbdaeeaf3604771 (PR #330), deploy 6aed25f59cac79063a0b6f64. It exactly matched main; older credit-skipped builds have been superseded. A public crawl returned HTTP 200 for 250 distinct page URLs, including linked hub routes. One apparent URL was a JavaScript template literal, not a real rendered link. This establishes public HTTP availability, not every external Drive permission or school-network behavior. Checkaverse /health and its page returned HTTP 200, healthy version 0.15.0 with zero players at the check.

## This release

- Integrates the remaining five Blender trench props, editable sources and independent fallback journeys from #314 (which contains #313 and #312). Preserves all newer Hall Pass and StoryHub work while resolving release-ledger conflicts.
- Integrates Kettle Creek fence/gate/path/flower/roof/HUD graphics from #300. Companion following is excluded because the Design Bible explicitly excludes it; the bible itself is unchanged. Core loop step 4, Phase 3 presentation.
- Integrates the current AI Team Board navigation from #288.
- Fixes the delayed dark overlay when returning from the trench finale, and asserts actual visibility in both museum browser suites.
- Replaces a stale fixed wilds-resident headcount with an assertion against received authoritative server snapshots. Commuting residents make a fixed count invalid. Keeps the current real visitor/door/travel journeys.
- Adds museum model and independent-fallback browser journeys to the protected full CI gate.
- Repairs a Windows-only kiosk test screenshot path with fileURLToPath; all 320/768/1366 kiosk request/return/privacy journeys pass.

## Outstanding release boundaries

| Area | Concrete remaining gate |
| --- | --- |
| Website release | Canonical local verification, protected build, merge, Netlify production SHA and exact live content readback. |
| Checkaverse graphics | Source verification and merge do not update the independent PC server. TheAtlas is offline in Remote Desktop Commander; runtime publication requires the connected host, preflight/backups, exact file copy and targeted restart. |
| Hall Pass RC2 / lunch PIN schoolwide cutover | #319 and #323–#329 remain the governing batch gates. District permission, authoritative protected mappings, exact ZIP/second-account and managed-Chromebook acceptance, private backup and freeze-SHA authorization are outstanding. This release does not activate them. |
| BTS Unit 2 catalog | Eight announced resources still have no public href. Matching lesson decks exist as private teacher-preparation copies; a sampled copy retains teacher directions and unresolved VERIFY flags. Student artifact/source QA and sharing acceptance remain unestablished. No private Drive identifiers were added to git. |
| Field acceptance | Physical school Chromebook, school network and actual class cycles remain unperformed. Synthetic browser results do not replace them. |

## Open PR inventory at audit start

51 open PRs were returned. Finished production work is integrated through one current release branch; prototypes remain separate.

| PR | Title | Disposition |
| --- | --- | --- |
| [#331](https://github.com/Grantauch/the-desk/pull/331) | Guard Hall Pass ZIP publication and owner-only production cutover (#329) | Source-only approval guard intentionally blocks the inherited public RC1 ZIP. Keep draft; no production activation. |
| [#314](https://github.com/Grantauch/the-desk/pull/314) | Over the Top: Blender M1903 rifles and timber supply cases | Included in this reviewed integration; protected checks and publication are separate gates. |
| [#313](https://github.com/Grantauch/the-desk/pull/313) | Over the Top: Blender M1917 and Adrian helmets and wooden trench periscope | Included in this reviewed integration; protected checks and publication are separate gates. |
| [#312](https://github.com/Grantauch/the-desk/pull/312) | Record live release coverage and resume production after credit recovery | Included in this reviewed integration; protected checks and publication are separate gates. |
| [#304](https://github.com/Grantauch/the-desk/pull/304) | Checklings: streamed chunk interest and 35-player synthetic world tests | Artwork/creature/world prototypes awaiting integration and acceptance; not a finished playable release. |
| [#302](https://github.com/Grantauch/the-desk/pull/302) | Checklings: 300-line biome roster, balance baseline and isolated worldgen proof | Artwork/creature/world prototypes awaiting integration and acceptance; not a finished playable release. |
| [#300](https://github.com/Grantauch/the-desk/pull/300) | Kettle Creek: real fences, a working gate, autotiled paths, partners follow | Included in this reviewed integration; protected checks and publication are separate gates. |
| [#297](https://github.com/Grantauch/the-desk/pull/297) | Codex: the-desk, board row 16 | Map-only forage proposal. Server-side foraging/rewards and a complete student flow are not on main. |
| [#288](https://github.com/Grantauch/the-desk/pull/288) | AI team brief: point assistants at the reset AI Team Board | Included in this reviewed integration; protected checks and publication are separate gates. |
| [#286](https://github.com/Grantauch/the-desk/pull/286) | AI Workforce: Hermes read-only preflight and controlled pilot guide | Read-only operations proposal, not website content. |
| [#284](https://github.com/Grantauch/the-desk/pull/284) | Checklings: integrate validated Sprite Book artwork | Artwork/creature/world prototypes awaiting integration and acceptance; not a finished playable release. |
| [#250](https://github.com/Grantauch/the-desk/pull/250) | Publish Pixel Camp with goals, artwork recovery and practice fixes | Earlier isolated Checklings foundation/design stack; not the live Checkaverse release line. |
| [#242](https://github.com/Grantauch/the-desk/pull/242) | Checklings: match the game interface to the four founder sprites | Earlier isolated Checklings foundation/design stack; not the live Checkaverse release line. |
| [#241](https://github.com/Grantauch/the-desk/pull/241) | Checklings: add First Trail founder gameplay playtest | Earlier isolated Checklings foundation/design stack; not the live Checkaverse release line. |
| [#240](https://github.com/Grantauch/the-desk/pull/240) | Checklings: add school PIN bridge and bounded class access (Batch05) | Earlier isolated Checklings foundation/design stack; not the live Checkaverse release line. |
| [#239](https://github.com/Grantauch/the-desk/pull/239) | Checklings: integrate school bridge with shared-device privacy repair | Earlier isolated Checklings foundation/design stack; not the live Checkaverse release line. |
| [#238](https://github.com/Grantauch/the-desk/pull/238) | Checklings: block silent care-scale and legacy migration drift | Earlier isolated Checklings foundation/design stack; not the live Checkaverse release line. |
| [#237](https://github.com/Grantauch/the-desk/pull/237) | Checklings: verify AI handoff ZIPs against claimed files and hashes | Earlier isolated Checklings foundation/design stack; not the live Checkaverse release line. |
| [#236](https://github.com/Grantauch/the-desk/pull/236) | Checklings: detect affinity contract drift before species integration | Earlier isolated Checklings foundation/design stack; not the live Checkaverse release line. |
| [#235](https://github.com/Grantauch/the-desk/pull/235) | Checklings: isolated hosting and disaster recovery plan (CK-OPS-001) | Earlier isolated Checklings foundation/design stack; not the live Checkaverse release line. |
| [#234](https://github.com/Grantauch/the-desk/pull/234) | Checklings: Craggle mountain-species care, cave route and Brace combat design (CK-SPEC-003) | Earlier isolated Checklings foundation/design stack; not the live Checkaverse release line. |
| [#233](https://github.com/Grantauch/the-desk/pull/233) | Checklings: Mosswisp original forest species brief and 16 acceptance cases (CK-SPEC-001) | Earlier isolated Checklings foundation/design stack; not the live Checkaverse release line. |
| [#232](https://github.com/Grantauch/the-desk/pull/232) | Checklings: first four founder personalities, care/discovery profiles and acceptance cases (CK-FOUNDERS-001) | Earlier isolated Checklings foundation/design stack; not the live Checkaverse release line. |
| [#231](https://github.com/Grantauch/the-desk/pull/231) | Checklings: deterministic individuality lab, balanced intent scoring and 16 tests (CK-BEH-LAB-001) | Earlier isolated Checklings foundation/design stack; not the live Checkaverse release line. |
| [#230](https://github.com/Grantauch/the-desk/pull/230) | Checklings: 48-case classroom and Chromebook acceptance matrix (CK-QA-001) | Earlier isolated Checklings foundation/design stack; not the live Checkaverse release line. |
| [#229](https://github.com/Grantauch/the-desk/pull/229) | Checklings: browser login, secure cookies and shared-device cancellation | Earlier isolated Checklings foundation/design stack; not the live Checkaverse release line. |
| [#228](https://github.com/Grantauch/the-desk/pull/228) | Checklings: signed launch broker and revocable server sessions | Earlier isolated Checklings foundation/design stack; not the live Checkaverse release line. |
| [#227](https://github.com/Grantauch/the-desk/pull/227) | Checklings: transactional storage foundation and later weight/scar roadmap | Earlier isolated Checklings foundation/design stack; not the live Checkaverse release line. |
| [#226](https://github.com/Grantauch/the-desk/pull/226) | Checklings Batch 01: production reconciliation and migration foundation | Earlier isolated Checklings foundation/design stack; not the live Checkaverse release line. |
| [#223](https://github.com/Grantauch/the-desk/pull/223) | Checklings: isolated living world engine with school-day care and tests | Earlier isolated Checklings foundation/design stack; not the live Checkaverse release line. |
| [#119](https://github.com/Grantauch/the-desk/pull/119) | Repair teacher-action audit and queue recovery after partial commits | Separate schoolwide architecture and old hardening stack; not compatible as a bulk merge into current classroom production. |
| [#117](https://github.com/Grantauch/the-desk/pull/117) | Bind signed credentials to active PIN memberships | Separate schoolwide architecture and old hardening stack; not compatible as a bulk merge into current classroom production. |
| [#109](https://github.com/Grantauch/the-desk/pull/109) | SW-171: Commercial security and concurrency hardening | Separate schoolwide architecture and old hardening stack; not compatible as a bulk merge into current classroom production. |
| [#86](https://github.com/Grantauch/the-desk/pull/86) | GrantDesk Ready V1 shell and snapshot contract | Separate draft product shell; not the current production site. |
| [#81](https://github.com/Grantauch/the-desk/pull/81) | SW-170: Staging & Release Readiness | Separate schoolwide architecture and old hardening stack; not compatible as a bulk merge into current classroom production. |
| [#80](https://github.com/Grantauch/the-desk/pull/80) | SW-160: Credential Continuity + Recovery Bridge | Separate schoolwide architecture and old hardening stack; not compatible as a bulk merge into current classroom production. |
| [#79](https://github.com/Grantauch/the-desk/pull/79) | SW-150: Shadow Migration / Parity | Separate schoolwide architecture and old hardening stack; not compatible as a bulk merge into current classroom production. |
| [#62](https://github.com/Grantauch/the-desk/pull/62) | SW-140 Legacy Read-Only Importer | Separate schoolwide architecture and old hardening stack; not compatible as a bulk merge into current classroom production. |
| [#59](https://github.com/Grantauch/the-desk/pull/59) | SW-130 Realtime and Operations | Separate schoolwide architecture and old hardening stack; not compatible as a bulk merge into current classroom production. |
| [#58](https://github.com/Grantauch/the-desk/pull/58) | SW-120 Admin Console | Separate schoolwide architecture and old hardening stack; not compatible as a bulk merge into current classroom production. |
| [#53](https://github.com/Grantauch/the-desk/pull/53) | SW-110 Security Console | Separate schoolwide architecture and old hardening stack; not compatible as a bulk merge into current classroom production. |
| [#49](https://github.com/Grantauch/the-desk/pull/49) | SW-100 Classroom Integration | Separate schoolwide architecture and old hardening stack; not compatible as a bulk merge into current classroom production. |
| [#43](https://github.com/Grantauch/the-desk/pull/43) | SW-090 Teacher Application | Separate schoolwide architecture and old hardening stack; not compatible as a bulk merge into current classroom production. |
| [#42](https://github.com/Grantauch/the-desk/pull/42) | SW-080 Audit + Corrections | Separate schoolwide architecture and old hardening stack; not compatible as a bulk merge into current classroom production. |
| [#40](https://github.com/Grantauch/the-desk/pull/40) | SW-070 Hall Pass Core | Separate schoolwide architecture and old hardening stack; not compatible as a bulk merge into current classroom production. |
| [#34](https://github.com/Grantauch/the-desk/pull/34) | SW-060 Check-In | Separate schoolwide architecture and old hardening stack; not compatible as a bulk merge into current classroom production. |
| [#31](https://github.com/Grantauch/the-desk/pull/31) | SW-050 Student Credentials + Action Proofs | Separate schoolwide architecture and old hardening stack; not compatible as a bulk merge into current classroom production. |
| [#27](https://github.com/Grantauch/the-desk/pull/27) | SW-040 Schedule + Policy Services | Separate schoolwide architecture and old hardening stack; not compatible as a bulk merge into current classroom production. |
| [#24](https://github.com/Grantauch/the-desk/pull/24) | SW-030: staff authentication and RBAC boundary | Separate schoolwide architecture and old hardening stack; not compatible as a bulk merge into current classroom production. |
| [#19](https://github.com/Grantauch/the-desk/pull/19) | SW-020: durable Schoolwide database foundation | Separate schoolwide architecture and old hardening stack; not compatible as a bulk merge into current classroom production. |
| [#18](https://github.com/Grantauch/the-desk/pull/18) | SW-010: isolated GrantDesk Schoolwide foundation | Separate schoolwide architecture and old hardening stack; not compatible as a bulk merge into current classroom production. |
