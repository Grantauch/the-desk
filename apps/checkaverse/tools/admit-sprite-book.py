"""Strict, deterministic Sprite Book intake. Never regenerates or repairs rejected art.

python tools/admit-sprite-book.py RAW_DIR [--apply]
Requires Pillow, NumPy, SciPy. Content supplies layouts and 32px tile dimensions.
Without --apply this only writes the admission report; rejected files never publish.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]


def inspect_image(path, exempt=False):
    with Image.open(path) as im:
        if im.format != 'PNG' or path.suffix.lower() != '.png':
            raise ValueError('Not a PNG (JPG is not accepted)')
        rgba = np.asarray(im.convert('RGBA')).copy()
    rgb = rgba[:, :, :3]
    exact = np.all(rgb == [255, 0, 255], axis=2)
    border = np.concatenate((exact[0], exact[-1], exact[1:-1, 0], exact[1:-1, -1]))
    near = (rgb[:, :, 0] > 200) & (rgb[:, :, 1] < 60) & (rgb[:, :, 2] > 200)
    # Background connected to the border is outside the sprite. Enclosed keyed
    # regions are conservatively counted as interior; this catches a magenta belly.
    seed = np.zeros_like(exact)
    seed[0] = exact[0]; seed[-1] = exact[-1]
    seed[:, 0] = exact[:, 0]; seed[:, -1] = exact[:, -1]
    outside = ndimage.binary_propagation(seed, mask=exact)
    inside = np.ones_like(exact) if exempt else ~outside
    fraction = float(near[inside].mean()) if inside.any() else 0
    metrics = dict(borderExact=float(border.mean()), interiorNear=fraction)
    errors = []
    if not exempt and metrics['borderExact'] < .98:
        errors.append(f"Only {metrics['borderExact']:.4%} of border is exactly FF00FF; requires 98%")
    if fraction > .01:
        errors.append(f'{fraction:.4%} of enclosed sprite interior is near magenta; maximum 1%')
    if not exempt:
        rgba[:, :, 3] = np.where(exact | (rgba[:, :, 3] < 128), 0, 255)
        rgba[exact] = 0  # Exact key, hard binary alpha. No feather, palette conversion or recoloring.
    return rgba, metrics, errors


def runs(mask):
    positions = np.flatnonzero(mask)
    if not len(positions):
        return []
    groups = np.split(positions, np.flatnonzero(np.diff(positions) > 1) + 1)
    return [(int(g[0]), int(g[-1]) + 1) for g in groups]


def bounds(mask):
    y, x = np.nonzero(mask)
    if not len(x):
        raise ValueError('Empty sprite')
    return int(x.min()), int(y.min()), int(x.max()) + 1, int(y.max()) + 1


def split(rgba, layout, exempt=False):
    cols, rows = layout
    if exempt:
        h, w = rgba.shape[:2]
        return [rgba[round(y*h/rows):round((y+1)*h/rows), round(x*w/cols):round((x+1)*w/cols)]
                for y in range(rows) for x in range(cols)]
    solid = rgba[:, :, 3] != 0
    # Find actual blank magenta gutters, rather than assuming equal source cells.
    yruns = runs(solid.any(axis=1))
    if len(yruns) != rows:
        raise ValueError(f'Expected {rows} separated rows, found {len(yruns)}')
    cells = []
    for y0, y1 in yruns:
        xruns = runs(solid[y0:y1].any(axis=0))
        if len(xruns) != cols:
            raise ValueError(f'Expected {cols} separated sprites in row, found {len(xruns)}')
        for x0, x1 in xruns:
            cell = rgba[y0:y1, x0:x1]
            a, b, c, d = bounds(cell[:, :, 3] != 0)
            cells.append(cell[b:d, a:c])
    return cells


def pack(cells, layout, size):
    cols, rows = layout
    w, h = size
    # A common scale keeps walking/idle frames at a common body size. Center the
    # trimmed frames and align their feet, so changing poses does not hop around.
    scale = min(w/max(c.shape[1] for c in cells), h/max(c.shape[0] for c in cells))
    sheet = Image.new('RGBA', (cols*w, rows*h))
    frames = []
    for i, c in enumerate(cells):
        frame = Image.new('RGBA', (w, h))
        piece = Image.fromarray(c).resize((max(1, round(c.shape[1]*scale)), max(1, round(c.shape[0]*scale))), Image.Resampling.NEAREST)
        frame.paste(piece, ((w-piece.width)//2, h-piece.height))
        frames.append(frame)
        sheet.paste(frame, ((i % cols)*w, (i//cols)*h))
    return sheet, frames


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('raw', type=Path)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    contract = json.loads((ROOT/'content/sprite-book.json').read_text())
    report = dict(tileSize=32, key='FF00FF', scaling='NEAREST',
                  interiorMethod='Non-background area after border flood fill; enclosed keyed pockets count conservatively as interior.', files=[])
    art = ROOT/'public/art'
    camp = REPO/'public/hubs/checkling/camp/assets'
    registry_path = ROOT/'content/sprites.json'
    registry = json.loads(registry_path.read_text())
    camp_registry = dict(version=contract['version'], species={})
    for e in contract['entries']:
        path = args.raw/e['source']
        result = dict(source=e['source'], entry=e['entry'])
        report['files'].append(result)
        if not path.exists():
            result.update(status='UNAVAILABLE', reasons=['Source not downloaded'])
            continue
        result['sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
        try:
            rgba, metrics, errors = inspect_image(path, e.get('exempt', False))
            result.update(metrics)
            if errors:
                result.update(status='REJECTED', reasons=errors)
                continue
            cells = split(rgba, e['layout'], e.get('exempt', False))
            sheet, frames = pack(cells, e['layout'], e['frameSize'])
        except (ValueError, OSError) as error:
            result.update(status='REJECTED', reasons=[str(error)])
            continue
        result.update(status='ACCEPTED', size=list(sheet.size), frames=len(frames))
        if not args.apply:
            continue
        sheet.save(art/e['source'], optimize=True)
        record = dict(file=e['source'], frameSize=e['frameSize'], layout=e['layout'])
        if e.get('replaces'):
            old = art/e['replaces']
            archived = art/'archive/wave1'/old.name
            if old.exists():
                archived.parent.mkdir(parents=True, exist_ok=True)
                if archived.exists() and archived.read_bytes() != old.read_bytes():
                    raise ValueError(f'Archive already differs: {old.name}')
                # Preserve the legacy URL for cached clients while retaining a
                # byte-identical archive. New clients use the registered v2 file.
                archived.write_bytes(old.read_bytes())
            record['displaySize'] = e['frameSize']
        registry['assets'][e['id']] = record
        if e.get('species'):
            poses = dict(zip(e['poses'], frames))
            mapping = {}
            for face in ('front', 'back'):
                prefix = e['id']+'-'+face
                still, idle = prefix+'.png', prefix+'-idle.png'
                poses[face].save(camp/still, optimize=True)
                poses[face].save(camp/idle, save_all=True, append_images=[poses[face+'-idle']],
                                 duration=[600, 600], loop=0, disposal=0, blend=0)
                mapping[face] = dict(still=still, moving=idle)
            camp_registry['species'][e['id']] = mapping
    if args.apply:
        registry_path.write_text(json.dumps(registry, indent=2)+'\n')
        (camp/'sprite-book.json').write_text(json.dumps(camp_registry, indent=2)+'\n')
        # Compile presentation data into a non-executable HTML template. The
        # existing server needs no new route or WebSocket message for artwork.
        page = ROOT/'public/index.html'
        start, end = '<!-- Sprite Book registry: generated from content/sprites.json -->', '<!-- /Sprite Book registry -->'
        data = json.dumps(registry, separators=(',', ':')).replace('<', '\\u003c')
        block = start+'\n<template id="sprite-content">'+data+'</template>\n'+end
        html = page.read_text()
        if start in html:
            html = re.sub(re.escape(start)+r'.*?'+re.escape(end), lambda _: block, html, flags=re.S)
        else:
            html = html.replace('  <script src="/plaza.js"></script>', block+'\n  <script src="/plaza.js"></script>')
        page.write_text(html)
    for e in contract.get('deferred', []):
        report['files'].append(dict(source=e['source'], entry=e['entry'], status='UNAVAILABLE', reasons=[e['reason']]))
    (ROOT/'content/sprite-admission.json').write_text(json.dumps(report, indent=2)+'\n')
    print('\n'.join(f"{x['status']:12} {x['source']} {'; '.join(x.get('reasons', []))}" for x in report['files']))


if __name__ == '__main__':
    main()
