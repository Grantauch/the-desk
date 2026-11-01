"""Cut the wilds art from the Sprite Book (Wave 2 and Wave 3 folders) into public/art at 2x, 64 pixels a tile.

Run: python3 tools/cut-wilds-art.py RAW_DIR public/art
RAW_DIR holds tile-tall-grass and tile-flowers (Wave 2), prop-bridge and prop-fence (Wave 2) and prop-route-sign (Wave 3).
Rocky ground and scorched heath need no new art: the plaza tints the path and grass textures for them.
"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage

RAW, OUT = sys.argv[1:3]
T = 64


def rgb(name):
    return np.asarray(Image.open(os.path.join(RAW, name + '.png')).convert('RGB')).astype(np.int16)


def cut(a, hole=0):
    """Magenta touching the edge goes clear. hole > 0 also clears enclosed magenta that big, like gaps between rails."""
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (np.minimum(r, b) - g > 70) & (r > 140) & (b > 140)
    lab, n = ndimage.label(bg)
    keep = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    if hole:
        sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        keep |= {i + 1 for i, sz in enumerate(sizes) if sz >= hole}
    bg = np.isin(lab, list(keep))
    out = np.dstack([a.clip(0, 255).astype(np.uint8), np.where(bg, 0, 255).astype(np.uint8)])
    edgepx = ~bg & ndimage.binary_dilation(bg, iterations=2)
    out[edgepx & (np.minimum(r, b) - g > 25), :3] = (43, 26, 18)
    return out


def pieces(rgba, min_px=1500):
    lab, _ = ndimage.label(rgba[..., 3] > 0)
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        if (lab[sl] == i + 1).sum() >= min_px:
            piece = rgba[sl].copy()
            piece[lab[sl] != i + 1, 3] = 0
            out.append((sl[1].start, piece))
    return [p for _, p in sorted(out, key=lambda t: t[0])]


def fit(arr, width_tiles):
    im = Image.fromarray(arr, 'RGBA')
    w = round(width_tiles * T)
    h = round(im.height * w / im.width)
    # Box filter on premultiplied color, then a hard alpha edge, so it stays crisp pixel art.
    pre = np.asarray(im).astype(np.float32)
    pre[..., :3] *= pre[..., 3:4] / 255
    small = np.asarray(Image.fromarray(pre.clip(0, 255).astype(np.uint8), 'RGBA').resize((w, h), Image.BOX)).astype(np.float32)
    a = small[..., 3:4]
    col = np.where(a > 0, small[..., :3] * 255 / np.maximum(a, 1), 0)
    return np.dstack([col, np.where(a[..., 0] >= 110, 255, 0)]).clip(0, 255).astype(np.uint8)


def save(arr, name):
    im = Image.fromarray(arr, 'RGBA' if arr.shape[2] == 4 else 'RGB')
    im = im.quantize(256, method=Image.FASTOCTREE if im.mode == 'RGBA' else Image.MEDIANCUT, dither=Image.NONE)
    im.save(os.path.join(OUT, name + '.png'), optimize=True)
    print(name, arr.shape[1], 'x', arr.shape[0])


def mirror4(a):
    top = np.concatenate([a, a[:, ::-1]], axis=1)
    return np.concatenate([top, top[::-1]], axis=0)


# Tall grass repeats one tuft per tile, the Red and Blue way. A quarter of the picture holds about one tuft.
im = Image.open(os.path.join(RAW, 'tile-tall-grass.png')).convert('RGB').crop((256, 256, 512, 512)).resize((T, T), Image.BOX)
save(np.asarray(im), 'tile-tall-grass')
# Flower meadow: two tiles of texture, mirrored into a seamless four tile square.
im = Image.open(os.path.join(RAW, 'tile-flowers.png')).convert('RGB').resize((2 * T, 2 * T), Image.BOX)
save(mirror4(np.asarray(im)), 'tile-flowers')

save(fit(pieces(cut(rgb('prop-route-sign')))[0], 1.6), 'prop-route-sign')
save(fit(pieces(cut(rgb('prop-bridge')))[0], 3.0), 'prop-bridge')
save(fit(pieces(cut(rgb('prop-fence'), hole=300))[0], 2.0), 'prop-fence')
