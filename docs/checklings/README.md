# Checklings development

Owner: Codex, working for Grant. Branch: `checklings/batch-01-foundation`.

The October 23, 2026 project charter governs this work. The finished game requires 300 original base species across 12 ecosystems, meaningful care, permanent death with warnings and intervention, tactical battles, equally developed nurturing and competitive paths, breeding and ancestry, a living world, an Encyclopedia, Memorial Grove and verified classroom multiplayer. Recolors and evolved forms do not count toward 300. Version 1.0 requires actual gameplay and school Chromebook evidence.

Preserve Ember, Bolt, Mochi, Zee and all existing progress. Game state belongs on the server. Daily Check-In and Hall Pass must remain independent of game failures. Work proceeds on feature branches with documented checks and small releases. Finish 12 playable species before expanding the roster. Source, prototypes, preview deployments, production deployments and classroom use are separate evidence states.

- [Batch 01 report](BATCH-01.md): production reconciliation, reusable source and acceptance evidence.
- [Architecture](ARCHITECTURE.md): service boundaries, authentication, persistence and data contracts.
- [First 12 implementation plan](FIRST-12.md): delivery slices and gameplay acceptance.
- [Migration](MIGRATION.md): preservation rules, rehearsal and cutover gates.
- [Body condition and scars](BODY-CONDITION-AND-SCARS.md): accepted future requirements, scheduled after care and combat prerequisites.
- [Batch 02 persistence handoff](BATCH-02-PERSISTENCE.md): database implementation, evidence and remaining staging gates.
- `apps/checklings-foundation/`: offline import planner, death admission policy reference, TypeScript contracts, species design candidates and synthetic tests. These files are not wired to a student application or production datastore.

Run `npm run checkling:test` for the original companion and foundation tests. Run `npm run verify` before pushing. No game service, migration or new student feature is deployed by this batch.

Current continuation: `checklings/batch-02-persistence`, stacked on the reviewed Batch 01 source. Weight/body changes, exercise, long-term complications and anatomically placed battle scars are scheduled for later implementation; they do not displace the database/authentication priority.
