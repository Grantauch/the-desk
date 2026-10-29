# Independent review: first-twelve art handoff

Reviewer: Codex, October 29, 2026. Author reviewed: Gemini's `checklings_gemini_v1_1_complete_bundle.zip`. Original archive preserved unchanged: 89,408 bytes, 25 entries, SHA-256 `5ec148ef173a2da5a48add936c1dac410b0076ffd9c814ce6ce84e009bf8c874`. ZIP integrity and bounded extraction passed. Review targets are `CK-ART-001`, `CK-ASSET-TOOLS-001` and the founder identity boundary. This review does not claim the twelve species are implemented or classroom-approved.

Decision: **CHANGES_REQUESTED** before new-species art admission or runtime integration. Preserve the useful principles of original-founder protection, separate candidate staging, reduced-motion stills and measured file budgets. The current artifact cannot serve as an admission gate unchanged.

## Reproduced findings

| Probe | Observed result | Required correction |
| --- | --- | --- |
| PNG signature/IHDR prefix, length 24 or 25 bytes | `parseImageHeader` throws `ERR_OUT_OF_RANGE`; its minimum-size check allows subsequent reads beyond the buffer. | Return a structured invalid/truncated result for every short header; the CLI should report the bad file without crashing. |
| PNG prefix, length 26 bytes | Reports `valid: true` despite an incomplete IHDR payload. | Bound and validate the complete header structure before reporting header validity. |
| 33-byte IHDR-only prefix | Reports a valid header although the file contains no image data or end marker. | Separate header inventory from usable-image admission, and validate/decode the full candidate asset before admission. The author's synthetic fixtures must not be described as fully valid images. |
| Complete, opaque 35-byte GIF87a | Reports `hasAlphaChannel: true`. Independent Pillow decoding reports no transparency and an RGBA alpha of 255. | Read the actual transparency control instead of declaring every GIF transparent. |
| CLI with a one-byte pose budget against preserved camp assets | Exits 0 while the JSON reports 17 budget violations and 16 missing poses. | Keep inventory success distinct from admission success. Add an explicit strict gate that fails required budget/pose criteria before wiring the tool into acceptance. |

The reproduction exercised the inspected module's exports and its read-only CLI. It did not execute the bundled test runner's cleanup or change source artwork. The PNG probes are intentionally incomplete inputs, not candidate art. The opaque GIF bytes were independently decoded to verify the transparency finding.

## Contract reconciliation

The proposal's strict targets and CLI defaults differ: 45,056 bytes per optimized pose / 184,320 bytes per five-pose bundle in the contract versus 65,536 / 262,144 in the CLI. Explicitly bind the selected policy to a versioned admission mode. Preserve existing founder artwork as a recorded legacy baseline rather than silently recompressing or replacing it to satisfy a new target.

The bundled founder profiles also use proposed canonical labels such as Cloud Mochi and Sprocket and care thresholds on a 0–1000 scale. The current live camp uses canonical Mochi/Bolt/Zee/Ember, separate student nicknames, and bounded 0–100 vitals. These proposals must remain separate until their interface/migration is accepted. Earlier review also requested reconciliation of candidate affinities and silhouettes; this review does not resolve or approve those conflicts.

Chromebook frame rate, visual quality, originality, five usable poses and classroom readability still require their relevant evidence. File presence, a checksum or an inventory success exit does not establish those facts.

## Bounded integration now

Pixel Camp's current-four field guide reads the existing engine and recorded progress, with no new species, care rules or save fields. Its development-only founder fingerprint manifest protects all eight original PNG/GIF files. It does not adopt the unapproved parser or claim that the broader art contract passed.
