# Version 17 live source fingerprint

Captured from the tracked deployable source in `apps-script/hall-pass/` at Git commit `5fe9670`,
which is the commit named in `apps-script/hall-pass/DEPLOY.md` as the source released to Apps Script
Version 17 on September 3, 2026. `Code.gs`, `Index.html` and `appsscript.json` are unchanged between
`5fe9670` and the current `main`, so the tracked source and this snapshot are the same bytes.

Measured after normalizing CRLF to LF and dropping the final newline, which is how Apps Script stores
and returns the file. This is the comparison the parent README describes.

| file | characters | SHA-256 |
| --- | ---: | --- |
| `Code.gs` | 145,587 | `b7af0b1c1a7afc00794394a2606b3083a8657bc0c0a4a9e6916f8e64ef3a9aa0` |
| `Index.html` | 104,685 | `fdd114cbf427c4bca97baa836104f4f30bb971bf2989118ae1b381b7458efaf7` |
| `appsscript.json` | 197 | `ee69229d802b71f25111ca1c9556dc6d3d9759f2b8973350fd91324d6ac6ef3c` |

The `Code.gs` SHA-256 begins `b7af0b1c1a7afc00`, which matches the read-back recorded in DEPLOY.md
when Version 17 was created on the existing deployment.

Version 17 carries the AUTO_PASS authorization fix. Versions 14, 15 and 16 do not, and none of them is
a safe rollback target for bathroom passes.
