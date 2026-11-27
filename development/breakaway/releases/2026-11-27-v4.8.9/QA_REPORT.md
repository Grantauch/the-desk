# Breakaway V4.8.9 — QA report (in progress)

**Date:** 2026-11-27. **Candidate SHA-256:** `4ec136ffd0493c2efbfc0a28043b3e6fa1aa1876c5147369ddf425c888afa9df`.

## Completed
- GitHub source publication to a dedicated development branch, with frozen V4.8.8 included as a reproducible baseline.
- Static source comparison confirmed the exact football engine is byte-identical across V4.8.7 → V4.8.8 → V4.8.9. All new methods live in renderer/replay/UI code.
- Local simulation on the byte-identical V4.8.7 core: **25/25 games**, **96,839** physics frames and **3,849** state assertions passed. Same game engine bytes, but this is **not** a full V4.8.9 renderer acceptance run.

## Required, not yet passed
- The 500-game core test was attempted but exceeded the available execution time; **do not count it as passed**.
- The V4.8.9 combined executable's Node parse and exact reconstruction checks must be executed by a runtime with the new source checkout.
- Four Chromium layouts, 2,000 renderer draws, replay 0/middle/end skip and physical gamepad paths remain pending; the browser harness is included to run.
- Real-speed footage and hands-on iPhone/Android, Safari, Firefox and physical controller tests remain pending.
- Independent review, CI approval and public-site release approval remain pending.

**Status: WORKING DRAFT.** The canonical `LATEST.md` correctly stays at V4.8.8. Production files are untouched.
