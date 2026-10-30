"""Cut Gemini's Wave 1 sprites out of their magenta backgrounds and size them for the Checkaverse.

Run: python3 tools/cut-sprites.py RAW_DIR OUT_DIR
Art is stored at 2x: 64 pixels per game tile.
"""
import sys, os
import numpy as np
from PIL import Image

RAW, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
T = 64  # pixels per tile at 2x
OUTLINE = np.array([43, 26, 18], dtype=np.float32)


def load(name):
    return np.asarray(Image.open(os.path.join(RAW, name + '.png')).convert('RGB')).astype(np.float32)


def key(rgb, enclosed_min=0):
    """Magenta background to transparent. Returns RGBA float array.
    enclosed_min > 0 keeps pink pockets that do not touch the image edge unless they are that big."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    spill = np.minimum(r, b) - g
    bg = (spill > 70) & (r > 140) & (b > 140)
    if enclosed_min:
        from scipy import ndimage
        lab, n = ndimage.label(bg)
        edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        keep = [i + 1 for i, sz in enumerate(sizes) if (i + 1) in edge or sz >= enclosed_min]
        bg = np.isin(lab, keep)
    a = np.where(bg, 0.0, 255.0)
    out = np.dstack([rgb, a])
    # Edge pixels still tinted magenta: pull them to the outline brown.
    solid = a > 0
    near = np.zeros_like(solid)
    for dy in (-2, -1, 0, 1, 2):
        for dx in (-2, -1, 0, 1, 2):
            near |= np.roll(np.roll(~solid, dy, 0), dx, 1)
    fringe = solid & near & (spill > 25)
    out[fringe, :3] = OUTLINE
    return out


def trim(rgba, pad=0):
    ys, xs = np.nonzero(rgba[..., 3] > 0)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return rgba[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad]


def remove_specks(rgba, min_px=400):
    """Drop tiny detached islands (stray magenta noise survivors)."""
    from scipy import ndimage
    lab, n = ndimage.label(rgba[..., 3] > 0)
    if n <= 1:
        return rgba
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= min_px])
    rgba = rgba.copy()
    rgba[~keep, 3] = 0
    return rgba


def resize(rgba, w, h):
    """Box filter on premultiplied color, then a hard alpha edge so it stays crisp pixel art."""
    pre = rgba.copy()
    pre[..., :3] *= pre[..., 3:4] / 255.0
    im = Image.fromarray(np.clip(pre, 0, 255).astype(np.uint8), 'RGBA')
    small = np.asarray(im.resize((w, h), Image.BOX)).astype(np.float32)
    a = small[..., 3:4]
    col = np.where(a > 0, small[..., :3] * 255.0 / np.maximum(a, 1), 0)
    alpha = np.where(a[..., 0] >= 110, 255, 0)
    return np.dstack([col, alpha]).clip(0, 255).astype(np.uint8)


def fit(rgba, width=None, height=None):
    h, w = rgba.shape[:2]
    s = (width / w) if width else (height / h)
    return resize(rgba, max(1, round(w * s)), max(1, round(h * s)))


def shrink(im):
    """256 color palette, no dithering: invisible on pixel art and about a third of the bytes."""
    return im.quantize(256, method=Image.FASTOCTREE if im.mode == 'RGBA' else Image.MEDIANCUT, dither=Image.NONE)


def save(arr, name):
    shrink(Image.fromarray(arr, 'RGBA' if arr.shape[2] == 4 else 'RGB')).save(os.path.join(OUT, name + '.png'), optimize=True)
    return arr.shape[1], arr.shape[0]


sizes = {}

# ---- simple props: name -> (width tiles or None, height tiles or None)
PROPS = {
    'prop-tree': (1.9, None), 'prop-bush': (1.0, None), 'prop-rock': (1.0, None),
    'prop-lantern': (None, 2.0), 'prop-bench': (2.0, None), 'prop-bus-stop': (None, 2.1),
    'prop-bus': (4.2, None), 'prop-notice-board': (2.4, None),
    'hood-plot': (5.0, None), 'house-cottage': (5.0, None), 'house-stump': (5.0, None), 'house-creek': (5.0, None),
    'hood-locked': (0.7, None), 'hood-mailbox': (None, 1.1),
    'market-stall': (3.4, None), 'merge-stone': (2.8, None), 'arena': (7.0, None),
    'kc-store': (5.0, None), 'kc-apothecary': (5.0, None), 'kc-clinic': (5.0, None), 'kc-daycare': (5.0, None),
    'kc-cemetery-gate': (3.0, None), 'kc-town-sign': (2.0, None), 'ui-bubble': (3.4, None),
}
for name, (wt, ht) in PROPS.items():
    rgb = load(name)
    if name == 'prop-bus':
        # Paint over the round badge on the bus nose so the bus carries no emblem at all.
        yy, xx = np.mgrid[0:rgb.shape[0], 0:rgb.shape[1]]
        badge = ((xx - 460) / 20.0) ** 2 + ((yy - 487) / 30.0) ** 2 <= 1
        rgb[badge] = rgb[470, 500]
    cut = trim(remove_specks(key(rgb, 3000 if name == 'kc-apothecary' else 0)))
    arr = fit(cut, width=round(wt * T) if wt else None, height=round(ht * T) if ht else None)
    sizes[name] = save(arr, name)

# ---- headstones: one sheet of four, split into four files
cut = remove_specks(key(load('kc-headstones')))
cols = np.nonzero(cut[..., 3].max(axis=0) > 0)[0]
runs, start = [], cols[0]
for a, b in zip(cols, cols[1:]):
    if b - a > 8:
        runs.append((start, a + 1)); start = b
runs.append((start, cols[-1] + 1))
for i, (x0, x1) in enumerate(runs[:4]):
    piece = trim(cut[:, x0:x1])
    sizes[f'kc-headstone-{i + 1}'] = save(fit(piece, height=round(1.1 * T)), f'kc-headstone-{i + 1}')

# ---- interior: full room, 10 x 8 tiles, no keying
room = Image.open(os.path.join(RAW, 'house-interior.png')).convert('RGB').resize((10 * T, 8 * T), Image.BOX)
shrink(room).save(os.path.join(OUT, 'house-interior.png'), optimize=True)
sizes['house-interior'] = room.size

# ---- trainers: 3 columns x 4 rows, packed into 64 x 96 frames
for t in 'abcd':
    rgb = load(f'trainer-{t}')
    rgba = key(rgb)
    H, W = rgba.shape[:2]
    cells = []
    for row in range(4):
        for col in range(3):
            cell = rgba[round(row * H / 4):round((row + 1) * H / 4), round(col * W / 3):round((col + 1) * W / 3)]
            cells.append(trim(remove_specks(cell, 200)))
    tallest = max(c.shape[0] for c in cells)
    s = 92 / tallest
    sheet = np.zeros((4 * 96, 3 * 64, 4), np.uint8)
    for i, c in enumerate(cells):
        w, h = max(1, round(c.shape[1] * s)), max(1, round(c.shape[0] * s))
        f = resize(c, w, h)
        w = min(w, 64)
        f = f[:, :w]
        r, k = divmod(i, 3)
        x = k * 64 + (64 - w) // 2
        y = r * 96 + 96 - h - 1
        sheet[y:y + h, x:x + w] = np.where(f[..., 3:4] > 0, f, sheet[y:y + h, x:x + w])
    sizes[f'trainer-{t}'] = save(sheet, f'trainer-{t}')

# ---- ground textures: seamless by mirroring
def mirror4(a):
    top = np.concatenate([a, a[:, ::-1]], axis=1)
    return np.concatenate([top, top[::-1]], axis=0)

for name, box, px in [('tile-grass', (0, 0, 1024, 1024), 256), ('tile-path', (0, 0, 1024, 1024), 192),
                      ('tile-water', (384, 384, 1024, 1024), 192)]:
    im = Image.open(os.path.join(RAW, name + '.png')).convert('RGB').crop(box).resize((px, px), Image.BOX)
    arr = mirror4(np.asarray(im))
    if name == 'tile-grass':
        # Shift the olive grass toward the brighter green of the camp scene it sits beside.
        f = arr.astype(np.float32)
        f = f * np.array([1.15, 1.35, 1.0]) + np.array([5, 7, 52])
        arr = f.clip(0, 255).astype(np.uint8)
    shrink(Image.fromarray(arr, 'RGB')).save(os.path.join(OUT, name + '.png'), optimize=True)
    sizes[name] = (arr.shape[1], arr.shape[0])

for k, v in sorted(sizes.items()):
    print(f'{k:22s} {v[0]:4d} x {v[1]:4d}')
