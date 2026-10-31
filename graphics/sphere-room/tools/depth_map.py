"""Turn Depth Anything's raw disparity into the room's depth map.

The painting is a level one-point view: the eye EYE m over the floor, the
horizon on row HORIZON, the focal length FOCAL px (as in src/lib.rs). The raw
disparity is fitted (scale and shift) to the floor's exact disparity below
the eye; the window panes, which it reads as sky, go to FAR. Depth Anything
runs the panes' edges into the frame, so the panes grow a little first.
Written as RGB: R and G the disparity / DISPARITY_MAX in 16 bits (high, low),
B the region (0 the room, 128 outside the window, 255 the curtain), from
Art's approximate map for the curtain.
usage: python -E depth_map.py <raw1.npy> [<raw2.npy>...] <depth-approx.png> <out.png>
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

FOCAL, HORIZON, CENTRE, EYE = 963.0, 448.0, 768.0, 1.0
FAR, DISPARITY_MAX = 14.0, 0.625

*raws, approx_path, out = sys.argv[1:]
d = np.mean([np.load(p) for p in raws], axis=0)
approx = np.array(Image.open(approx_path).convert("L")).astype(np.float32)
H, W = d.shape
rows = (np.arange(H) + 0.5)[:, None] * np.ones((1, W))
# Floor: Art's map follows its plain floor gradient there (no chair, no table).
floor = (rows > 760) & (np.abs(approx - approx[:, :1]) < 2)
floor[:, 1040:1380] &= rows[:, 1040:1380] > 880
truth = (rows - HORIZON) / (FOCAL * EYE)
A = np.stack([d[floor], np.ones(floor.sum())], axis=1)
(s, t), *_ = np.linalg.lstsq(A, truth[floor], rcond=None)
disparity = s * d + t
fit = np.abs(disparity[floor] - truth[floor]).max()
# The panes: Depth Anything reads them as sky.
pane = Image.fromarray(((d < 2.3) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))
pane = np.array(pane) > 0
disparity[pane] = 1.0 / FAR
disparity = np.clip(disparity, 1.0 / FAR, DISPARITY_MAX)
q = np.round(disparity / DISPARITY_MAX * 65535).astype(np.uint32)
cols = (np.arange(W) + 0.5)[None, :] * np.ones((H, 1))
curtain = (np.abs(approx - 86) < 10) & (cols < 300) & (rows < 725)
region = np.where(pane, 128, np.where(curtain, 255, 0)).astype(np.uint8)
rgb = np.stack([(q >> 8).astype(np.uint8), (q & 255).astype(np.uint8), region], axis=2)
Image.fromarray(rgb).save(out, optimize=True)
z = 1.0 / disparity
print(out, rgb.shape, f"scale {s:.5f} shift {t:.5f} floor fit {fit:.4f}",
      f"wall {z[300, 750]:.2f} chair {z[640, 1150]:.2f} table {z[530, 900]:.2f} cup {z[500, 1020]:.2f}",
      f"curtain {z[400, 200]:.2f} near {z[-1, 768]:.2f} panes {pane.mean():.3f} curtain {curtain.mean():.3f}")
