"""Derive the Дюна layers of the Step 3 voice scene from Art's light painting.

Art painted light versions of the approved Step 3 and Step 4 artwork
(`voice-presence-sand.png`, `grounding-hero-sand.png`). They follow the dark
compositions, so the dark layers register to them. The voice scene also needs:

- `voice-presence-sand-person.png`: the user-edited portrait in the light
  palette. The colors are mapped through a lookup learned where the original
  figure overlaps in the dark and light paintings; the alpha is unchanged.
- `voice-presence-sand-environment.png`: the quiet frame without code, rings,
  voice or figure, in the artwork's own coordinates. What the dark artwork
  lights above its plate's floor is filled from the surrounding light air.

    python3 graphics/product-engine/prepare-sand-rasters.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import gaussian_filter
from scipy.spatial import cKDTree

ASSETS = Path(__file__).resolve().parent / 'engine' / 'assets'
BINS = 24


def load(name, mode='RGB'):
    return np.asarray(Image.open(ASSETS / name).convert(mode), dtype=np.float32) / 255


def gray(values):
    return Image.fromarray(np.round(np.clip(values, 0, 1) * 255).astype(np.uint8), 'L')


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def save(values, name, mode):
    Image.fromarray(np.round(np.clip(values, 0, 1) * 255).astype(np.uint8), mode).save(
        ASSETS / name, optimize=True)


dark = load('voice-presence.png')
light = load('voice-presence-sand.png')
portrait = load('voice-presence-person.png', 'RGBA')
alpha = portrait[..., 3]
height, width = alpha.shape

# Dark-to-light colors of the figure, sampled deep inside both silhouettes.
core = np.asarray(gray(alpha).filter(ImageFilter.MinFilter(9)), dtype=np.float32) / 255 > 0.9
core &= dark.max(axis=2) > 0.25


def bins(rgb):
    index = np.clip((rgb * (BINS - 1) + 0.5).astype(int), 0, BINS - 1)
    return (index[..., 0] * BINS + index[..., 1]) * BINS + index[..., 2]


sums = np.zeros((BINS ** 3, 3))
counts = np.zeros(BINS ** 3)
np.add.at(sums, bins(dark[core]), light[core])
np.add.at(counts, bins(dark[core]), 1)
filled = counts > 0
grid = np.stack(np.meshgrid(*[np.arange(BINS)] * 3, indexing='ij'), -1).reshape(-1, 3)
lookup = np.zeros((BINS ** 3, 3))
lookup[filled] = sums[filled] / counts[filled][:, None]
_, nearest = cKDTree(grid[filled]).query(grid[~filled])
lookup[~filled] = lookup[filled][nearest]
save(np.dstack([lookup[bins(portrait[..., :3])], alpha]), 'voice-presence-sand-person.png', 'RGBA')

# The dark plate keeps the floor, its rim and reflections; register it to the
# artwork exactly as voice-presence.wgsl samples it.
plate = load('voice-presence-environment.png')
rows = (0.66 + ((np.arange(height) + 0.5) / height - 0.70) * 1.067) * height - 0.5
plate = plate[np.clip(np.round(rows).astype(int), 0, height - 1)]
kept = np.asarray(gray(smoothstep(0.05, 0.15, plate.max(axis=2))).filter(ImageFilter.MaxFilter(5)),
                  dtype=np.float32) / 255
remove = smoothstep(0.06, 0.18, dark.max(axis=2)) * (1 - kept)
# The figure, its glow and its reflection leave the floor too.
y = (np.arange(height) / height)[:, None]
x = (np.arange(width) / width)[None, :]
figure = smoothstep(0.25, 0.5, dark.max(axis=2)) * (np.abs(x - 0.5) < 0.11) * (y > 0.6)
remove = np.maximum(remove, np.maximum(alpha, figure))
remove = np.asarray(gray(remove).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(3)),
                    dtype=np.float32) / 255
weight = 1 - np.clip(remove * 1.5, 0, 1)


def fill(sigma):
    support = gaussian_filter(weight, sigma)
    color = np.dstack([gaussian_filter(light[..., c] * weight, sigma) for c in range(3)])
    return color / np.maximum(support, 1e-4)[..., None], support


near, support = fill(24)
wide, _ = fill(80)
air = np.where(support[..., None] > 0.05, near, wide)
save(light * (1 - remove[..., None]) + air * remove[..., None], 'voice-presence-sand-environment.png', 'RGB')
