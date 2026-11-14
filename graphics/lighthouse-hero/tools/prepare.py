"""Prepare Art's painting for «Маяк».

1. painting.png: the painting as it is (nothing is erased: the rings are
   new, Rust draws them in depth).
2. depth.png, at half the painting's size:
   R  nearness, 0..2 stored as 0..1: the man about 1 (his feet a little
      nearer), the far well and the lamp near 0, the window about 0.3, the
      rail and the stone column in front up to 2.
   G  the man, the glass body: his inner lines take the scan, and he hides
      the back of the rings.
   B  the light in the air: the shafts from the window, where the dust shows.
   Nearness is Depth Anything V2's disparity (tools/depth_anything.py),
   scaled so the man is 1 and softly capped at 2 near the camera.
usage: python tools/prepare.py <original.png> <raw1.npy> [<raw2.npy>...] <assets dir>
The geometry constants mirror src/lib.rs.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage
import cv2

src, *raws, out = sys.argv[1:]
out = Path(out)
img = np.asarray(Image.open(src).convert("RGB")).astype(np.float32) / 255.0
H, W, _ = img.shape
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
lum = img @ np.array([0.2126, 0.7152, 0.0722], np.float32)


def smooth(a, b, v):
    t = np.clip((v - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


# lib.rs: the soles' row, the window's opening, the shafts' direction.
FEET = 886.0
WINDOW = (326.0, 178.0, 404.0, 600.0)  # left, top, right, bottom
SHAFT = np.array([0.36, 0.93], np.float32)

# 1. The man. Depth Anything puts him on a plateau between the far wall and
# the near stair; brass (the rail under his hand) is warmer than his glass.
d = np.mean([np.load(p) for p in raws], axis=0)
box = (xx > 440) & (xx < 830) & (yy > 130) & (yy < FEET + 8)
# His feet stand as near as the tread under them.
plateau = (d > 2.4) & (d < np.where(yy > 800, 5.6, 4.6))
r, g, b = img[..., 0], img[..., 1], img[..., 2]
brass = (r > g * 1.02) & (r > 0.12)
cand = plateau & box & ~brass
cand = ndimage.binary_opening(cand, iterations=2)
# The stair beside him is as deep as he is: GrabCut tells his glass from its
# stone, seeded by strokes along his limbs (sure) and what is far from them.
STROKES = [((583, 175), (585, 215)), ((585, 225), (578, 300)), ((578, 300), (585, 500)),
           ((548, 300), (612, 300)), ((520, 300), (495, 420)), ((495, 420), (488, 540)),
           ((640, 310), (700, 400)), ((700, 400), (790, 488)),
           ((528, 540), (509, 695)), ((509, 695), (495, 786)), ((495, 786), (491, 862)),
           ((604, 540), (589, 695)), ((589, 695), (578, 786)), ((578, 786), (576, 862)),
           ((470, 878), (514, 880)), ((566, 878), (640, 886))]
core = np.zeros((H, W), np.uint8)
for a, b in STROKES:
    cv2.line(core, a, b, 1, 9)
far_core = ndimage.distance_transform_edt(core == 0)
gc = np.full((H, W), cv2.GC_PR_BGD, np.uint8)
# The legs are slimmer than the trunk: what may be him lies nearer their strokes.
reach = np.where(yy < 540, 60.0, np.where(yy < 600, 36.0, 22.0))
gc[(far_core < reach) & cand] = cv2.GC_PR_FGD
gc[(far_core > reach + 15) | ~ndimage.binary_dilation(cand, iterations=6)] = cv2.GC_BGD
gc[(core > 0) & cand] = cv2.GC_FGD
bgr = np.ascontiguousarray((img[..., ::-1] * 255).astype(np.uint8))
bg_model, fg_model = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
cv2.grabCut(bgr, gc, None, bg_model, fg_model, 6, cv2.GC_INIT_WITH_MASK)
body = (gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD)
labels, n = ndimage.label(body)
body = labels == labels[400, 580]
# Small holes are glass the cut missed; the gap between his legs stays open.
holes, count = ndimage.label(ndimage.binary_fill_holes(body) & ~body)
sizes = ndimage.sum(np.ones_like(holes), holes, range(1, count + 1))
body |= np.isin(holes, 1 + np.nonzero(sizes < 600)[0])
# The tread his feet stand on is as near as his feet: below the soles is stone.
body &= yy < FEET + 4
body_soft = ndimage.gaussian_filter(body.astype(np.float32), 1.2)

# 2. Nearness: disparity over the man's, the near end softly capped.
d_man = float(np.median(d[body]))
n = np.clip(d / d_man, 0.0, None)
cap = 1.25 + 0.75 * np.tanh((n - 1.25) / 0.75)
near = np.where(n > 1.25, cap, n)
# Foreground edges move whole: the near side wins over a few px, so the
# stretch at an edge lands on the far side, in the dark.
near = np.maximum(near, ndimage.grey_dilation(near, size=(5, 5)) * (near > 1.3))
near = ndimage.gaussian_filter(near, 2.5)

# 3. The light in the air: the painted haze between the window and the man,
# along the shafts. Its brightness over the local floor of the wall.
# Each point traced back along the shafts to the window's middle plane: the
# row it left the opening at, and how far it has come.
mid = (WINDOW[0] + WINDOW[2]) / 2
t = (xx - mid) / SHAFT[0]
y0 = yy - t * SHAFT[1]
beam = smooth(WINDOW[1], WINDOW[1] + 40, y0) * (1 - smooth(WINDOW[3] - 80, WINDOW[3], y0)) * smooth(10, 60, t) * (1 - smooth(420, 640, t))
glow = ndimage.gaussian_filter(lum, 4.0)
air = beam * smooth(0.05, 0.22, glow)
air = ndimage.gaussian_filter(air, 4.0) * (1 - body_soft)

half = lambda a: np.asarray(Image.fromarray(np.round(np.clip(a, 0, 1) * 255).astype(np.uint8)).resize((W // 2, H // 2), Image.LANCZOS))
rgb = np.stack([half(near / 2.0), half(body_soft), half(air)], -1)
Image.fromarray(rgb).save(out / "depth.png", optimize=True)
Image.fromarray(np.round(img * 255).astype(np.uint8)).save(out / "painting.png", optimize=True)

# The man's middle and half width at each 20 px of height (lib.rs AXIS),
# his arm on the rail left out.
rows = []
for y in range(150, int(FEET) + 1, 40):
    xs = np.nonzero(body[y, :720])[0]
    rows.append((y, float(xs.mean()) if len(xs) else -1, float((xs.max() - xs.min()) / 2) if len(xs) else -1))
print("d_man", round(d_man, 3), "near", float(near.min()), float(near.max()))
print("body px", int(body.sum()), "rows", [(y, round(c), round(w)) for y, c, w in rows])
for p in [(580, 300), (580, 600), (560, 860), (370, 300), (100, 500), (1272, 70), (1000, 400), (1090, 900), (800, 495), (700, 950), (950, 800)]:
    print(p, "near", round(float(near[p[1], p[0]]), 2))
