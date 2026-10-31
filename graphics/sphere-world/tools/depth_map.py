"""Turn Depth Anything's raw disparity into the panorama's depth map.

Values are eye heights over distance (1 straight down, 0 the sky), fitted to
the flat water and ground below the eye; the sky above 30° is forced to 0.
Near edges grow a little and soften, so near things keep their outline when
the eye moves. Written as an 8-bit grey PNG at half the panorama's size.
usage: python -E depth_map.py <raw1.npy> [<raw2.npy>...] <out.png>
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

*raws, out = sys.argv[1:]
d = np.mean([np.load(p) for p in raws], axis=0)
H, W = d.shape
# raw → eye heights over distance, from the water and ground below the eye
# (medians per raw bin) and the far mountains held near 0.
knots = np.array([
    (0.0, 0.0), (0.3, 0.03), (0.36, 0.06), (0.5, 0.2), (0.77, 0.30), (1.17, 0.346),
    (1.54, 0.421), (2.1, 0.513), (2.77, 0.582), (3.5, 0.651), (5.5, 0.80), (7.9, 0.906),
    (10.3, 0.939), (11.4, 0.976), (12.3, 0.991), (14.0, 1.0),
])
g = np.interp(d, knots[:, 0], knots[:, 1])
lat = np.degrees((0.5 - (np.arange(H) + 0.5) / H) * np.pi)[:, None]
t = np.clip((lat - 22.0) / 8.0, 0, 1)
g *= 1 - t * t * (3 - 2 * t)
im = Image.fromarray(np.round(np.clip(g, 0, 1) * 255).astype(np.uint8)).resize((W // 2, H // 2), Image.LANCZOS)
# Filter with the seam wrapped.
a = np.array(im)
pad = 32
wrapped = Image.fromarray(np.concatenate([a[:, -pad:], a, a[:, :pad]], axis=1))
wrapped = wrapped.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.5))
a = np.array(wrapped)[:, pad:-pad].astype(np.float32)
# The painting's own seam is not exact: both sides ease into their mean.
seam = (a[:, 0] + a[:, -1]) / 2
for k in range(24):
    w = (k + 0.5) / 24
    w = w * w * (3 - 2 * w)
    a[:, k] = seam * (1 - w) + a[:, k] * w
    a[:, -1 - k] = seam * (1 - w) + a[:, -1 - k] * w
a = np.round(a).astype(np.uint8)
Image.fromarray(a).save(out, optimize=True)
print(out, a.shape, "seam", int(np.abs(a[:, 0].astype(int) - a[:, -1]).max()), "mean", float(a.mean()))
