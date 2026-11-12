"""Builds assets/figure.png from Art's chosen heroine (assets/heroine.png).

    python graphics/voice-fork/tools/prepare.py

R: her light (the brightest channel of the yellow wireframe), with the
   specks around her cleared;
G: her silhouette, a soft matte that keeps the code rain behind her;
B: unused.
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent.parent
src = np.asarray(Image.open(HERE / "assets/heroine.png").convert("RGB")).astype(np.float32) / 255.0
light = np.clip((src.max(axis=2) - 0.02) / 0.98, 0.0, 1.0)

body = ndimage.gaussian_filter(light, 6.0) > 0.06
body = ndimage.binary_fill_holes(body)
labels, count = ndimage.label(body)
sizes = ndimage.sum(body, labels, range(1, count + 1))
body = labels == 1 + int(np.argmax(sizes))
matte = ndimage.gaussian_filter(body.astype(np.float32), 4.0)
light *= np.clip(matte * 2.0, 0.0, 1.0)

out = np.zeros(src.shape, dtype=np.uint8)
out[..., 0] = np.round(light * 255.0)
out[..., 1] = np.round(matte * 255.0)
Image.fromarray(out, "RGB").save(HERE / "assets/figure.png", optimize=True)
print("assets/figure.png written")
