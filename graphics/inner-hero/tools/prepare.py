"""Prepare Art's painting for «Внутренняя сфера».

1. painting.png: the painting with its chest ring erased (OpenCV Telea
   inpainting), because Rust draws the ring in depth: it turns, passes in
   front of the body and behind it.
2. depth.png, at half the painting's size:
   R  nearness, 0..2 stored as 0..1: the figure and the cube are 1, the far
      nebula about 0.4 (its brighter clouds a little nearer), the inside of the
      glass sphere 0.85, the floor from 0.4 at its far edge to 2 at the bottom.
   G  the body (no cube): the warm inner light fills it and it hides the
      back of the ring.
   B  the glass cube.
   The figure comes from Depth Anything V2 (tools/depth_anything.py): what
   stands out of the sphere's smooth dome is the body and the cube.
usage: python tools/prepare.py <original.webp> <raw1.npy> [<raw2.npy>...] <assets dir>
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
img = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
H, W, _ = img.shape
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

# The painted ring (lib.rs RING): centre, half width, half height.
RX, RY, RA, RB = 767.0, 482.5, 307.5, 21.0
# The glass sphere (lib.rs SPHERE) and the floor's far edge (lib.rs HORIZON).
SX, SY, SR = 767.0, 491.0, 466.0
HORIZON = 795.0
FEET = 885.0

# 1. Depth.
d = np.mean([np.load(p) for p in raws], axis=0)
X, Y = (xx - SX) / SR, (yy - SY) / SR
r = np.hypot(X, Y)
fig_zone = (np.abs(xx - SX) < 200) & (yy > 200) & (yy < 900)
sel = (r < 0.97) & ~fig_zone & (yy < 800)
A = np.stack([np.ones_like(X), X, Y, X * X, Y * Y, X * Y, X**4, Y**4, X * X * Y * Y], -1)
coef, *_ = np.linalg.lstsq(A[sel], d[sel], rcond=None)
rise = (d - A @ coef) * (r < 1.0)


def smooth(a, b, v):
    t = np.clip((v - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


above_feet = 1.0 - smooth(FEET - 12, FEET + 4, yy)
body = smooth(0.5, 0.9, rise) * above_feet
cube_box = (xx > 590) & (xx < 948) & (yy > 630) & (yy < 858)
cube = smooth(0.12, 0.3, rise) * cube_box * (1.0 - body)
cube = ndimage.gaussian_filter(cube, 1.5)

lum = img @ np.array([0.2126, 0.7152, 0.0722], np.float32) / 255.0
cloud = ndimage.gaussian_filter(lum, 18.0)
cloud = np.clip(cloud / max(np.percentile(cloud, 99.5), 1e-3), 0, 1)
far = 0.4 + 0.18 * cloud
# The floor: nearness grows with the row, 1 where the feet stand.
k = 0.6 / (FEET - HORIZON)
floor = 0.4 + (yy - HORIZON) * k
on_floor = smooth(HORIZON - 6, HORIZON + 10, yy)
world = far * (1 - on_floor) + floor * on_floor
# The glass and what is inside it, a little past the rim so the rim moves whole.
glass = 1.0 - smooth(1.0, 1.05, r)
inner = 0.85 * (1 - on_floor * smooth(FEET - 30, FEET + 10, yy)) + floor * on_floor * smooth(FEET - 30, FEET + 10, yy)
near = world * (1 - glass) + inner * glass
solid = np.maximum(ndimage.maximum_filter(body, 7), ndimage.maximum_filter(cube, 7))
near = near * (1 - solid) + 1.0 * solid
near = ndimage.gaussian_filter(near, 3.0)

# 2. Erase the ring. The back arc is hidden behind the body in the painting,
# so only the parts of it beside the body are erased; the front arc crosses
# the torso as a thin line, so the mask is narrow there to keep the skin.
on_body = ndimage.maximum_filter(body, 5) > 0.35
dx = (xx - RX) / RA
inside = np.abs(dx) < 1.0
arc = RB * np.sqrt(np.clip(1.0 - dx * dx, 0.0, 1.0))
front = inside & (np.abs(yy - (RY + arc)) < np.where(on_body, 2.6, 4.5))
back = inside & ~on_body & (np.abs(yy - (RY - arc)) < 4.5)
mask = front | back
for tip in (RX - RA, RX + RA):
    mask |= ((xx - tip) / 30.0) ** 2 + ((yy - RY) / 9.0) ** 2 < 1.0
bgr = np.ascontiguousarray(img[..., ::-1].astype(np.uint8))
painting = cv2.inpaint(bgr, mask.astype(np.uint8) * 255, 4, cv2.INPAINT_TELEA)[..., ::-1]
Image.fromarray(painting).save(out / "painting.png", optimize=True)

half = lambda a: np.asarray(Image.fromarray(np.round(np.clip(a, 0, 1) * 255).astype(np.uint8)).resize((W // 2, H // 2), Image.LANCZOS))
rgb = np.stack([half(near / 2.0), half(body), half(cube)], -1)
Image.fromarray(rgb).save(out / "depth.png", optimize=True)
print("painting.png", int(mask.sum()), "px refilled; depth.png", rgb.shape,
      "near", float(near.min()), float(near.max()))
