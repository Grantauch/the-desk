"""Art check and cutter for Checkling sprite sheets from the Sprite Book.

Run from apps/checkaverse:
  python3 tools/admit-checklings.py RAW_DIR            check only, writes content/checkling-art.json
  python3 tools/admit-checklings.py RAW_DIR --apply    also writes the battle frames into public/art

RAW_DIR holds <id>-sheet.png files downloaded from the Sprite Book wave folders (zee-sheet-v2.png counts as zee).
Each sheet is one row of four poses on FF00FF. The standard layout is front, front happy, back, back blink. A sheet the
review marks "layout": "action" is front, action, hurt, back instead; its front idle uses the action pose, its back
has no blink, and the hurt pose is saved as hurt-<id>.png for later.
The mechanical check is the one from the Wave 2 intake (PR #284): a real PNG, at least 98% of the border exactly
FF00FF, at most 1% near-magenta inside the creature, four separated poses. Only exact FF00FF becomes transparent, with
soft alpha only along the edge, where the magenta spill is taken back out of the color. Frames are trimmed, share one
scale and one foot line, and are packed into 192 by 192 with a smooth resample. Grant chose the smooth, full size
look on Nov 16, 2026, so new species are never crushed into 32 pixel art. The founders keep their original map art; their battle poses are recut the same way.

The visual review (house style, pose order, friendly faces) cannot be measured, so it is recorded by hand in
content/checkling-art-review.json. A sheet is published only when it passes both. Rejected art is never repaired.

Outputs per accepted species, the same files the founders use:
  front-<id>.png, back-<id>.png                still frames (map, partner card, fallback)
  front-<id>-v2.png, back-<id>-v2.png          battle stills for reduced motion
  front-<id>-v2-idle.png, back-<id>-v2-idle.png   two frame idles (front then front happy, back then back blink)
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
FRAME = 192
# The founders keep their original map and partner art; only their battle poses come from the sheet.
FOUNDERS = {'mochi', 'bolt', 'zee', 'ember'}
KEY = np.array([255, 0, 255], dtype=np.float32)


def inspect_image(path):
    with Image.open(path) as im:
        if im.format != 'PNG':
            raise ValueError('Not a PNG')
        rgba = np.asarray(im.convert('RGBA')).copy()
    rgb = rgba[:, :, :3]
    exact = np.all(rgb == [255, 0, 255], axis=2)
    border = np.concatenate((exact[0], exact[-1], exact[1:-1, 0], exact[1:-1, -1]))
    near = (rgb[:, :, 0] > 200) & (rgb[:, :, 1] < 60) & (rgb[:, :, 2] > 200)
    # Background connected to the border is outside the creature. Enclosed key colored pockets count as inside,
    # so a magenta belly can never quietly turn into a hole.
    seed = np.zeros_like(exact)
    seed[0] = exact[0]; seed[-1] = exact[-1]
    seed[:, 0] = exact[:, 0]; seed[:, -1] = exact[:, -1]
    outside = ndimage.binary_propagation(seed, mask=exact)
    inside = ~outside
    fraction = float(near[inside].mean()) if inside.any() else 0.0
    metrics = dict(borderExact=round(float(border.mean()), 6), interiorNear=round(fraction, 6))
    errors = []
    if metrics['borderExact'] < .98:
        errors.append(f"only {metrics['borderExact']:.2%} of the border is exactly FF00FF (needs 98%)")
    if fraction > .01:
        errors.append(f'{fraction:.2%} of the creature is near magenta (limit 1%)')
    return key(rgba, outside), metrics, errors


def key(rgba, outside):
    """Hard alpha inside, soft alpha on the 3 pixel rim next to the background, with the magenta unmixed."""
    rgb = rgba[:, :, :3].astype(np.float32)
    alpha = np.where(outside, 0.0, 1.0).astype(np.float32)
    rim = ~outside & ndimage.binary_dilation(outside, iterations=3)
    # How far each rim pixel sits from the key toward its own colour: green rises and red/blue fall as it leaves magenta.
    away = np.maximum.reduce([rgb[:, :, 1], 255 - rgb[:, :, 0], 255 - rgb[:, :, 2]]) / 255.0
    a = np.clip(away * 1.6, 0, 1)
    alpha[rim] = a[rim]
    safe = np.maximum(alpha, 1e-3)[:, :, None]
    fg = np.clip((rgb - (1 - alpha[:, :, None]) * KEY) / safe, 0, 255)
    out = np.dstack([np.where(rim[:, :, None], fg, rgb), alpha * 255]).round().astype(np.uint8)
    out[alpha < 0.08] = 0
    return out


def runs(mask):
    positions = np.flatnonzero(mask)
    if not len(positions):
        return []
    groups = np.split(positions, np.flatnonzero(np.diff(positions) > 1) + 1)
    return [(int(g[0]), int(g[-1]) + 1) for g in groups]


def split(rgba):
    solid = rgba[:, :, 3] != 0
    # Specks smaller than 40 pixels (stray sparkles, keying dust) never decide where a pose starts or ends.
    lab, n = ndimage.label(solid)
    if n:
        sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        solid = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= 40])
    xruns = [r for r in runs(solid.any(axis=0)) if r[1] - r[0] >= 24]
    if len(xruns) != 4:
        raise ValueError(f'expected 4 separated poses in one row, found {len(xruns)}')
    cells = []
    for x0, x1 in xruns:
        col = solid[:, x0:x1]
        ys = np.flatnonzero(col.any(axis=1))
        xs = np.flatnonzero(col.any(axis=0))
        y0, y1, a, b = ys[0], ys[-1] + 1, xs[0], xs[-1] + 1
        cell = rgba[y0:y1, x0 + a:x0 + b].copy()
        cell[~col[y0:y1, a:b]] = 0
        cells.append(cell)
    return cells


def pack(cells):
    # One scale for all four poses and one foot line, so the idle never hops.
    scale = min(FRAME / max(c.shape[1] for c in cells), FRAME / max(c.shape[0] for c in cells))
    frames = []
    for c in cells:
        frame = Image.new('RGBA', (FRAME, FRAME))
        size = (max(1, round(c.shape[1] * scale)), max(1, round(c.shape[0] * scale)))
        # Premultiplied resample, so edges never pick up a dark or magenta halo.
        piece = Image.fromarray(c).convert('RGBa').resize(size, Image.Resampling.LANCZOS).convert('RGBA')
        frame.paste(piece, ((FRAME - piece.width) // 2, FRAME - piece.height))
        frames.append(frame)
    return frames


def small(*frames):
    """One shared 256 colour palette from libimagequant (pip install imagequant), which keeps the smooth shading
    and makes each file about a third the size. Without it the frames stay full colour."""
    try:
        import imagequant
    except ImportError:
        return frames if len(frames) > 1 else frames[0]
    strip = Image.new('RGBA', (FRAME * len(frames), FRAME))
    for i, f in enumerate(frames):
        strip.paste(f, (FRAME * i, 0))
    q = imagequant.quantize_pil_image(strip, dithering_level=1.0, max_colors=256, min_quality=70, max_quality=100)
    out = [q.crop((FRAME * i, 0, FRAME * (i + 1), FRAME)) for i in range(len(frames))]
    return out if len(frames) > 1 else out[0]


def species_id(name):
    return name.removesuffix('.png').replace('-sheet-v2', '').replace('-sheet', '')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('raw', type=Path)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--preview', type=Path, help='write a contact sheet of every cut for the visual review')
    args = parser.parse_args()
    review = json.loads((ROOT / 'content/checkling-art-review.json').read_text())['sheets']
    report = dict(note='Written by tools/admit-checklings.py. Mechanical result plus the hand review in '
                       'checkling-art-review.json. Only status "accepted" is published.', sheets={})
    art = ROOT / 'public/art'
    previews = []
    for path in sorted(args.raw.glob('*-sheet*.png')):
        sid = species_id(path.name)
        entry = dict(source=path.name, sha256=hashlib.sha256(path.read_bytes()).hexdigest())
        report['sheets'][sid] = entry
        try:
            rgba, metrics, errors = inspect_image(path)
            entry.update(metrics)
            frames = None if errors else pack(split(rgba))
        except (ValueError, OSError) as error:
            errors, frames = [str(error)], None
        if frames:
            previews.append((sid, frames))
        verdict = review.get(sid)
        if errors:
            entry.update(status='rejected', check='failed', reasons=errors)
        elif not verdict:
            entry.update(status='waiting', check='passed', reasons=['no visual review yet'])
        elif verdict['pass']:
            entry.update(status='accepted', check='passed')
        else:
            entry.update(status='rejected', check='passed', reasons=verdict['reasons'])
        if verdict and verdict.get('sha256') and verdict['sha256'] != entry['sha256']:
            entry.update(status='waiting', reasons=['sheet changed since the visual review'])
        if args.apply and entry['status'] == 'accepted':
            if verdict.get('layout') == 'action':
                front, happy, hurt, back = frames
                blink = back
                small(hurt).save(art / f'hurt-{sid}.png', optimize=True)
            else:
                front, happy, back, blink = frames
            for face, still, other in (('front', front, happy), ('back', back, blink)):
                if sid not in FOUNDERS:
                    small(still).save(art / f'{face}-{sid}.png', optimize=True)
                small(still).save(art / f'{face}-{sid}-v2.png', optimize=True)
                # Shared palette, and blend 0 writes the second frame over the first, transparent pixels included.
                one, two = small(still, other)
                one.save(art / f'{face}-{sid}-v2-idle.png', save_all=True, append_images=[two],
                         duration=[600, 600], loop=0, disposal=0, blend=0)
    (ROOT / 'content/checkling-art.json').write_text(json.dumps(report, indent=2) + '\n')
    if args.preview and previews:
        zoom, pad = 1, 6
        cols = 4
        sheet = Image.new('RGBA', (cols * (FRAME * zoom * 4 + pad * 5) , ((len(previews) + cols - 1) // cols) * (FRAME * zoom + pad * 2)), (120, 150, 110, 255))
        for i, (sid, frames) in enumerate(previews):
            ox = (i % cols) * (FRAME * zoom * 4 + pad * 5) + pad
            oy = (i // cols) * (FRAME * zoom + pad * 2) + pad
            for j, f in enumerate(frames):
                big = f.resize((FRAME * zoom, FRAME * zoom), Image.Resampling.NEAREST)
                sheet.alpha_composite(big, (ox + j * (FRAME * zoom + pad), oy))
        sheet.save(args.preview)
        (args.preview.with_suffix('.txt')).write_text('\n'.join(s for s, _ in previews) + '\n')
    for sid, e in report['sheets'].items():
        print(f"{e['status']:9} {sid:12} {'; '.join(e.get('reasons', []))}")


if __name__ == '__main__':
    main()
