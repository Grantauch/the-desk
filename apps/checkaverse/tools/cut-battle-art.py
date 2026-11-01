"""Cut the battle art from Gemini's Wave 2 Sprite Book PNGs into public/art.

Run: python3 tools/cut-battle-art.py RAW_DIR PETS_DIR public/art
RAW_DIR holds mochi-sheet, bolt-sheet, ember-sheet, zee-sheet, bg-battle-meadow, fx-knockout and ui-types from the
Wave 2 Sprites folder. PETS_DIR is public/hubs/checkling/pets in the site, the approved founder art.
Fronts come from the founder art (Zee's Wave 2 front has a magenta belly and fails the art check). Backs come from
frame 3 of each Wave 2 sheet. Everything is cut on magenta with a hard edge, trimmed, and kept as crisp pixel art.
"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage

RAW, PETS, OUT = sys.argv[1:4]
os.makedirs(OUT, exist_ok=True)


def rgb(name):
    return np.asarray(Image.open(os.path.join(RAW, name + '.png')).convert('RGB')).astype(np.int16)


def magenta(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (np.minimum(r, b) - g > 70) & (r > 140) & (b > 140)


def cut(a, hole=0):
    """Only magenta that reaches the picture edge becomes transparent, so pink cheeks and mouths survive.
    hole > 0 also clears enclosed magenta at least that many pixels big, like the middle of a ring."""
    bg = magenta(a)
    lab, n = ndimage.label(bg)
    keep = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    if hole:
        sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        keep |= {i + 1 for i, sz in enumerate(sizes) if sz >= hole}
    bg = np.isin(lab, list(keep))
    out = np.dstack([a.clip(0, 255).astype(np.uint8), np.where(bg, 0, 255).astype(np.uint8)])
    # Pixels on the cut edge that still lean magenta take the outline brown.
    solid = ~bg
    edgepx = solid & ndimage.binary_dilation(bg, iterations=2)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    tint = edgepx & (np.minimum(r, b) - g > 25)
    out[tint, :3] = (43, 26, 18)
    return out


def pieces(rgba, min_px=1500):
    """Separate sprites on one sheet, left to right then top to bottom."""
    lab, n = ndimage.label(rgba[..., 3] > 0)
    boxes = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        if (lab[sl] == i + 1).sum() >= min_px:
            boxes.append(sl)
    rows = sorted(boxes, key=lambda s: s[1].start)  # every sheet used here is one row
    return [rgba[s] for s in rows]


def save(arr, name, scale=1.0):
    im = Image.fromarray(arr, 'RGBA')
    if scale != 1.0:
        im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.NEAREST)
    im.save(os.path.join(OUT, name + '.png'), optimize=True)
    print(name, im.size)


for sp in ['mochi', 'bolt', 'ember', 'zee']:
    frames = pieces(cut(rgb(sp + '-sheet')))
    assert len(frames) == 4, (sp, len(frames))
    save(frames[2], f'back-{sp}')
    front = Image.open(os.path.join(PETS, sp, 'idle-1.png')).convert('RGBA')
    bbox = front.getbbox()
    save(np.asarray(front.crop(bbox)), f'front-{sp}')

types = pieces(cut(rgb('ui-types')))
for t, arr in zip(['meadow', 'gear', 'cosmic', 'ember', 'tide', 'stone', 'storm', 'shade'], types[:8]):
    save(arr, f'type-{t}', 0.5)

ko = pieces(cut(rgb('fx-knockout'), hole=2000))
save(ko[0], 'fx-knockout', 0.5)

bg = Image.open(os.path.join(RAW, 'bg-battle-meadow.png')).convert('RGB')
bg.resize((bg.width // 2, bg.height // 2), Image.NEAREST).save(os.path.join(OUT, 'bg-battle-meadow.png'), optimize=True)
print('bg-battle-meadow', bg.width // 2, bg.height // 2)
