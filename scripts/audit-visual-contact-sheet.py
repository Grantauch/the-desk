#!/usr/bin/env python3
"""Build visual QA sheets for branch-only image variants, never auto-import them.

Reads reports/visual-assets/inventory.json produced by audit-visual-assets.mjs.
Uses immutable Git blobs to inspect visual content without checking out the branch.
"""
import io
import json
import math
import os
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

REPORTS = Path("reports/visual-assets")
DATA = json.loads((REPORTS / "inventory.json").read_text(encoding="utf-8"))
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".tif", ".tiff"}
W, H = 312, 245
COLS, ROWS = 4, 4
BG = "#0f1821"
CARD = "#1e3038"
TEXT = "#f2e8d8"
SUB = "#d4ba8c"
MAIN = "#0a4550"
font = ImageFont.load_default()

def from_sha(sha):
    return subprocess.check_output(["git", "cat-file", "blob", sha])

def to_thumb(binary):
    with Image.open(io.BytesIO(binary)) as im:
        im.seek(0)
        frame = im.convert("RGBA")
        original = im.size
        animated = getattr(im, "n_frames", 1)
        return ImageOps.contain(frame, (W-22, 164)), original, animated

items = []
records = []
for c in DATA["candidateRecords"]:
    if Path(c["path"]).suffix.lower() not in IMAGE_EXTS:
        continue
    try:
        blob = from_sha(c["gitBlobSha"])
        thumb, dimensions, nframes = to_thumb(blob)
        meta = {
            "path": c["path"], "sha": c["gitBlobSha"], "sha256": c["contentSha256"],
            "sizeBytes": len(blob), "pixels": dimensions, "frames": nframes,
            "branchCount": len(c["branches"]), "disposition": (
                "older_l018" if "/ush9/l018/" in c["path"] else
                "older_rabbit" if "/rabbit-hole/" in c["path"] else
                "checklings_draft" if "checkling" in c["path"] or "checkaverse" in c["path"] else
                "legacy_icon" if "/icon" in c["path"] or "apple-touch" in c["path"] else
                "review"
            )
        }
        records.append(meta)
        items.append((c["path"], thumb, meta, False))
        if c.get("mainPathSha") and "/ush9/l018/" in c["path"]:
            newer = from_sha(c["mainPathSha"])
            new_thumb, new_dim, _ = to_thumb(newer)
            items.append((c["path"] + " [CURRENT MAIN]", new_thumb, { "pixels": new_dim,"sizeBytes":len(newer)}, True))
    except Exception as e:
        records.append({"path":c["path"],"error":str(e)})

def label(draw, line, x, y, fill, max_chars=46):
    line = line if len(line) <= max_chars else "..." + line[-max_chars+3:]
    draw.text((x,y), line, fill=fill, font=font)

def sheet(cells, index):
    canvas = Image.new("RGB", (COLS*W, ROWS*H+68), BG)
    d = ImageDraw.Draw(canvas)
    d.text((16,16), f"Visual branch recovery | immutable asset comparison | sheet {index}", fill=SUB, font=font)
    d.text((16,38), "Legacy media shown for review only; no files are automatically restored.", fill=TEXT, font=font)
    for n,(name,thumb,meta,is_main) in enumerate(cells):
        col=n%COLS;row=n//COLS;x=col*W;y=row*H+68
        d.rectangle((x+4,y+4,x+W-4,y+H-4), fill=MAIN if is_main else CARD,outline="#51616d",width=1)
        px=x+(W-thumb.width)//2; py=y+11+(164-thumb.height)//2
        canvas.paste(thumb,(px,py),thumb)
        label(d,name,x+12,y+178,TEXT,48)
        d.text((x+12,y+197),f"{meta.get('pixels')} | {meta.get('sizeBytes',0):,} bytes",fill=SUB,font=font)
        tag = "CURRENT MAIN" if is_main else meta.get("disposition","branch source")
        label(d,tag,x+12,y+215,SUB,49)
    dst=REPORTS/f"visual-contact-{index:02d}.png"
    canvas.save(dst,optimize=True)
    return str(dst)

saved = [sheet(items[n:n+COLS*ROWS], i+1) for i,n in enumerate(range(0,len(items),COLS*ROWS))]
(REPORTS/"candidate-image-metadata.json").write_text(json.dumps(records,indent=2)+"\n",encoding="utf-8")
print("VISUAL_CONTACT_SHEETS images=",len(records),"comparisonTiles=",len(items),"sheets=",len(saved))
for p in saved: print("SHEET",p)
