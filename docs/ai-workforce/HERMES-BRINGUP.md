# Hermes bring-up: controlled pilot (2026-10-30)

This is a **non-executing, read-only pilot**, not a deployed Hermes integration. The canonical task authority is the [AI Team Board](https://docs.google.com/spreadsheets/d/1Zx4fjhe1Be3M27fcqUePyq46DdzlG_kIlAp1n0JgZrY/edit); Checklings uses its own 'Checklings — AI Team' tab. Do not reuse the old #226 foundation or take over active claims.

## On the Windows host, owned by the existing local-session operator

1. Preserve existing Hermes settings and credentials privately. Do not upload them, copy them into GitHub, or turn on autostart just for diagnosis.
2. Verify the installed CLI with `hermes --version` and `hermes doctor`. Use `hermes mcp test <configured-server-name>` for the **actual** existing AI-Team-MCP entry, not a guessed one. Standard Hermes MCP docs: https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp
3. Use a **read-only allowlist** of existing bridge tools (health, roster, playbook, task reads, logs). Confirm calls actually succeed. Stop on failed auth, permission mismatch or unknown command.
4. Export a **sanitized** local snapshot with `{"tasks":[{"taskId":"WF-SYNTH-001","workflowState":"READY"}]}`. Execute `node tools/ai-workforce/preflight.mjs <snapshot.json>` (exit 1 correctly flags non-dispatchable READY). This is inspection, not a live claim mechanism.
5. Implement a durable atomic claim with monotonically increasing fencing token, one executor per task+input version, idempotent result ledger and unknown-outcome reconciliation **outside** Google Sheets. Test duplicate delivery, crashed executor, late acknowledgement and conflicting claims.
6. Only after that, enable **one synthetic task** for intake -> claim -> bounded work -> test -> independent review -> canonical readback. Verify exactly one execution before adding other agents.

## Nonnegotiable boundaries

- Never treat Google Sheets append, cell read, stale lease, or a model's recommendation as an atomic lock. Never overwrite a guessed shared Message Board row; parallel edits already caused collision.
- Hermes is an optional coordinating peer, **not** an exclusive authority. Preserve direct Codex, Claude, Gemini, Grok and ChatGPT access.
- Current reported local pilot: blocked managed-worker ownership/exit, incomplete Hermes/Sheet sync and unverified OpenClaw inference. These are not fixed by this PR.
- No student records, PINs, production deployment, paid API activation, autonomous merges, or branch takeover. Claude/owner retains Checklings Design Bible authority.
- An "all green" static snapshot is **not proof** of live MCP connectivity, permissions, worker scheduling or accepted execution.

The full local diagnostic kit and 17-test prototype are available separately as the handoff ZIP; this GitHub slice is intentionally small, reviewable and dependency-free.
