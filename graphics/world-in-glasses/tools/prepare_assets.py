"""Offline asset preparation for the "world in glasses" scene.

Input: Art's frames A–H, the original illustration and the figure matte
(project files: mir-v-ochkah/src/frames). Output: the immutable layers the Rust
renderer samples. No motion is computed here; the mouth atlas only stores
in-between drawings of the illustrator's frames, like hand-drawn tweens.

    python3 -I tools/prepare_assets.py <frames-dir> <assets-dir>
"""
import glob
import os
import sys

import cv2
import numpy as np
from PIL import Image

frames, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)


def frame(letter):
    return cv2.imread(glob.glob(os.path.join(frames, f'{letter}-*.png'))[0])


def rgb(image):
    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)


def save(image, name):
    # High-quality WebP keeps the site light; alpha stays lossless.
    image.save(os.path.join(out, f'{name}.webp'), 'WEBP', quality=92, method=6, alpha_quality=100)


A = frame('A')
save(Image.open(os.path.join(frames, 'original.png')).convert('RGB'), 'original')
save(Image.fromarray(rgb(frame('H'))), 'background')
save(Image.fromarray(rgb(frame('G'))), 'world')

# Figure: frame A over the clean plate H, separated with the GrabCut matte.
matte = cv2.imread(os.path.join(frames, 'figure-matte.png'), 0).astype(np.float32) / 255
matte = cv2.GaussianBlur(matte, (0, 0), 1.2)
save(Image.fromarray(np.dstack([rgb(A), (matte * 255).astype(np.uint8)]), 'RGBA'), 'figure')

# Mouth drawings: 210 × 160 patches placed at (680, 180) over the figure.
X0, Y0, X1, Y1 = 680, 180, 890, 340
W, H = X1 - X0, Y1 - Y0
patch = {k: (A if k == 'A' else frame(k))[Y0:Y1, X0:X1].astype(np.float32) for k in 'ABCDE'}
mask = np.zeros((H, W), np.float32)
cv2.ellipse(mask, (790 - X0, 262 - Y0), (92, 72), 0, 0, 360, 1, -1)
mask[:200 - Y0, :] = 0  # lenses and the nose bridge stay untouched
mask = np.clip(cv2.GaussianBlur(mask, (0, 0), 6) * 1.15, 0, 1)
gx, gy = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))


def flow(a, b):
    ga = cv2.cvtColor(a.astype(np.uint8), cv2.COLOR_BGR2GRAY)
    gb = cv2.cvtColor(b.astype(np.uint8), cv2.COLOR_BGR2GRAY)
    return cv2.calcOpticalFlowFarneback(ga, gb, None, 0.5, 4, 21, 5, 7, 1.5, cv2.OPTFLOW_FARNEBACK_GAUSSIAN)


def tween(a, b, s):
    fab, fba = flow(a, b), flow(b, a)
    wa = cv2.remap(a, gx - fab[..., 0] * s, gy - fab[..., 1] * s, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    wb = cv2.remap(b, gx - fba[..., 0] * (1 - s), gy - fba[..., 1] * (1 - s), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return wa * (1 - s) + wb * s


def ease(s):
    return s * s * (3 - 2 * s)


# Order is the Rust `MouthPatch` index: 18 chew drawings (A→B→C→A), purse 1–5
# (A→D), popped gum (E), retract 1–4 (E→B).
cells = []
for a, b in (('A', 'B'), ('B', 'C'), ('C', 'A')):
    for k in range(6):
        cells.append(patch[a] if k == 0 else tween(patch[a], patch[b], ease(k / 6)))
for k in range(1, 6):
    cells.append(patch['D'] if k == 5 else tween(patch['A'], patch['D'], ease(k / 5)))
cells.append(patch['E'])
for k in range(1, 5):
    cells.append(tween(patch['E'], patch['B'], ease(k / 4)))
assert len(cells) == 28
COLS = 7
atlas = np.zeros((H * 4, W * COLS, 4), np.uint8)
for i, c in enumerate(cells):
    x, y = (i % COLS) * W, (i // COLS) * H
    atlas[y:y + H, x:x + W, :3] = rgb(np.clip(c, 0, 255).astype(np.uint8))
    atlas[y:y + H, x:x + W, 3] = (mask * 255).astype(np.uint8)
save(Image.fromarray(atlas, 'RGBA'), 'mouths')
for name in sorted(os.listdir(out)):
    print(name, os.path.getsize(os.path.join(out, name)))
