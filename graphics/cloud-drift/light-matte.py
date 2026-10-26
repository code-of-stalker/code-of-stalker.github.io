"""Writes assets-light/objects.webp, the matte of the four floating visions.

The light painting has sky painted around the heart, lotus, cup and star, so
the shader cannot find them by brightness the way it does in the dark
original's black air. The light painting follows the dark composition, so the
dark original's own coverage (scene.frag `dream`) is the matte.

    python3 light-matte.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).parent
# Centers and radii of `dream` in scene.frag.
OBJECTS = [((903, 109), (128, 113)), ((1211, 111), (128, 114)),
           ((1163, 347), (100, 125)), ((1409, 307), (126, 139))]


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


dark = np.asarray(Image.open(HERE / 'assets/original.png').convert('RGB'), dtype=np.float32) / 255
coverage = smoothstep(0.035, 0.16, np.maximum(dark[..., 0], dark[..., 1]))
y, x = np.mgrid[0:dark.shape[0], 0:dark.shape[1]]
inside = np.zeros(coverage.shape, dtype=bool)
for (cx, cy), (rx, ry) in OBJECTS:
    inside |= ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1.0
matte = np.where(inside, coverage, 0.0)
Image.fromarray(np.round(matte * 255).astype(np.uint8), 'L').save(
    HERE / 'assets-light/objects.webp', lossless=True, method=6)
