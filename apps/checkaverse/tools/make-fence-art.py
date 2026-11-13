# Builds the fence kit and the practice stump from the approved Wave 1 fence art.
# Run from apps/checkaverse:  python3 tools/make-fence-art.py
# Every piece is cut from public/art/prop-fence.png or drawn in its exact palette,
# so posts, rails and the gate read as the same wood at 64 pixels a tile.
from PIL import Image, ImageDraw

ART = 'public/art/'
src = Image.open(ART + 'prop-fence.png').convert('RGBA')

OUT = (38, 6, 4, 255)        # outline
EDGE = (51, 18, 17, 255)     # soft outline
DARK = (150, 69, 40, 255)
MID = (170, 84, 40, 255)
WARM = (194, 106, 49, 255)
LIGHT = (227, 140, 67, 255)
SHINE = (252, 184, 105, 255)

# A post, cut clean from the left post of the source, rails included where they cross it.
post = src.crop((8, 0, 28, 63))
post.save(ART + 'fence-post.png')

# A rail span with no post in it. The renderer stretches it between post centers.
rails = src.crop((40, 10, 88, 56))
rails.save(ART + 'fence-rails.png')

# The same rails seen end on, for a fence that runs north and south: one board,
# shaded like the rail's top face so the light still falls from the upper left.
v = Image.new('RGBA', (12, 64), (0, 0, 0, 0))
d = ImageDraw.Draw(v)
d.rectangle((0, 0, 11, 63), fill=OUT)
d.rectangle((2, 0, 9, 63), fill=MID)
d.rectangle((2, 0, 4, 63), fill=LIGHT)
d.rectangle((3, 0, 3, 63), fill=SHINE)
d.rectangle((8, 0, 9, 63), fill=DARK)
for y in range(7, 64, 13):   # wood grain nicks
    d.point((6, y), fill=WARM); d.point((6, y + 1), fill=DARK)
v.save(ART + 'fence-rail-v.png')

# One gate leaf, 1.5 tiles wide: two rails, an upright at the latch end and a
# diagonal brace from the bottom of the hinge to the top of the latch side.
W, H = 96, 50
leaf = Image.new('RGBA', (W, H), (0, 0, 0, 0))
band = src.crop((40, 12, 88, 29))   # one rail, 48 x 17
def rail(y):
    for x in range(0, W, 48):
        leaf.alpha_composite(band.crop((0, 0, min(48, W - x), 17)), (x, y))
rail(4); rail(29)
d = ImageDraw.Draw(leaf)
# Brace, outlined, then the upright stile at the latch end.
d.line((6, 44, W - 14, 8), fill=OUT, width=11)
d.line((6, 44, W - 14, 8), fill=MID, width=7)
d.line((6, 41, W - 16, 6), fill=LIGHT, width=2)
d.rectangle((W - 14, 0, W - 1, H - 1), fill=OUT)
d.rectangle((W - 12, 2, W - 3, H - 3), fill=MID)
d.rectangle((W - 12, 2, W - 9, H - 3), fill=LIGHT)
d.rectangle((W - 4, 2, W - 3, H - 3), fill=DARK)
# Iron latch ring.
d.rectangle((W - 20, 20, W - 15, 27), fill=OUT)
d.rectangle((W - 19, 21, W - 16, 26), fill=(120, 116, 108, 255))
leaf.save(ART + 'gate-leaf.png')

# A post with no rail stubs, for fences that run north and south. It is shorter because
# the camera sees it from above, and its rails arrive end on rather than from the sides.
sp = Image.new('RGBA', (20, 36), (0, 0, 0, 0))
d = ImageDraw.Draw(sp)
d.rounded_rectangle((1, 0, 18, 35), radius=4, fill=OUT)
d.rectangle((3, 3, 16, 34), fill=MID)
d.rectangle((3, 3, 7, 34), fill=LIGHT)
d.rectangle((4, 3, 4, 30), fill=SHINE)
d.rectangle((14, 3, 16, 34), fill=DARK)
d.rectangle((3, 3, 16, 5), fill=(240, 149, 74, 255))   # sawn top catches the light
sp.save(ART + 'fence-post-short.png')

# Practice stump: a short cut log with growth rings and a painted target, for the
# practice yard sign that promises "training stumps".
S = Image.new('RGBA', (52, 56), (0, 0, 0, 0))
d = ImageDraw.Draw(S)
BARK, BARK2, BARK3 = (92, 52, 30, 255), (120, 70, 38, 255), (66, 36, 22, 255)
RING, RING2, CORE = (226, 176, 112, 255), (196, 140, 82, 255), (240, 200, 140, 255)
d.rectangle((3, 16, 48, 49), fill=OUT)                 # body outline
d.ellipse((3, 40, 48, 55), fill=OUT)                   # rounded base
d.rectangle((6, 16, 45, 48), fill=BARK2)
d.ellipse((6, 42, 45, 52), fill=BARK2)
for x in range(9, 44, 7):                              # bark ridges
    d.line((x, 22, x, 49), fill=BARK3, width=2)
    d.line((x + 2, 22, x + 2, 47), fill=BARK, width=1)
d.rectangle((6, 16, 10, 48), fill=BARK3)               # shaded right side lives on the left edge of the light
d.rectangle((40, 18, 45, 48), fill=BARK)
d.ellipse((3, 6, 48, 27), fill=OUT)                    # top face
d.ellipse((6, 8, 45, 25), fill=RING)
d.ellipse((12, 11, 39, 22), fill=RING2)
d.ellipse((16, 13, 35, 20), fill=RING)
d.ellipse((21, 15, 30, 18), fill=(198, 64, 52, 255))   # painted bullseye
d.ellipse((24, 15, 27, 17), fill=CORE)
d.line((20, 10, 30, 10), fill=SHINE, width=1)
# Roots.
for x0, x1 in ((2, 9), (42, 50)):
    d.polygon([(x0, 54), (x1, 46), (x1 - 1, 54)], fill=OUT)
    d.polygon([(x0 + 2, 53), (x1 - 1, 48), (x1 - 2, 53)], fill=BARK2)
S.save(ART + 'prop-stump.png')
print('fence kit and stump written')
