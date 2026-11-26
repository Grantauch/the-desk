# Breakaway V4.8.6 — Weighted Footfalls: QA

## Targeted defect
V4.8.5 computed gait phase as `motionClock * (6.3 + min(speed,19)*.78)`, which made animation exceed 3 cycles/sec during sprints **and jump in phase whenever speed changed**. Feet appeared to flicker or spin independently of actual travel.

## Correction
- Per-athlete gait tracks now accumulate **real world-space distance**, roughly one full footfall cycle per 10.8 yards of travel (two steps), without recomputing phase from current speed.
- The runner and each blocker/defender have independent stable tracks, reset between possessions and protected against reset/teleport jumps. Paused, non-moving and replay-redrawn actors do not step.
- Contact cleats have a slight stance hold and damped grounded-foot travel; a distinct juke counter-lean stays prominent despite the slower stride.
- This is a **visual renderer change**. The football engine segment between `const CONFIG...` and `class FieldRenderer` remains byte-for-byte identical to V4.8.5.

## Results
| Check | Result |
|---|---|
| JavaScript parse | PASS |
| 120Hz continuous phase, startup/stop and speed change | PASS at 4 viewport sizes |
| Maximum phase change per 120Hz frame at 18yd/s | 0.0873 radians (no snap) |
| Idle, repeated zero-dt render and speed-only jump | 0 radians phase change |
| Engine byte identity vs V4.8.5 | PASS |
| Endurance full games (fresh run) | 100/100, 379,677 sim frames and 22,694 assertions |
| Existing action poses | 12/12, including juke, planted cut, spin, stiff, grapple and phased fall |
| Existing independent pose-contract test | PASS, 4 viewport sizes |
| Existing browser layouts | PASS, 1440x900, 390x844, 320x568, 844x390 |
| Replay lifecycle / frozen game clock | PASS |
| Inline tackle escape prompt + controls | PASS |
| Keyboard/controller input / reduced effects | PASS |
| Renderer soak | 2,000/2,000 draws, no page errors |

**Limits:** Simulated gameplay and headless Chromium checks cannot replace real touch devices, Bluetooth controllers, Safari/Firefox and hands-on assessments. Preview GIF is a deterministic, same-speed comparison, not a video of real device playback. Game remains an unpublished development build.

## Rebuild and rollback
`python3 apply_gait_fix.py baseline-v4.8.5.html` regenerates the standalone HTML. The unmodified source of V4.8.5 is included as `baseline-v4.8.5.html`. Compare hashes with `CHECKSUMS.sha256`.
