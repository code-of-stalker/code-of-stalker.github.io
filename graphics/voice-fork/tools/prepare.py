"""Builds assets/figure.png from Art's chosen heroine and her sung mouth.

    python graphics/voice-fork/tools/prepare.py [--show <png>]

Sources in assets/:
  heroine.png       Art's pick, mouth closed;
  heroine-half.png  the same image, lips just parted;
  heroine-open.png  the same image, singing the note.
The two mouths are Codex image edits of heroine.png (through the local
dispatcher, 2026-11-12); they come back aligned to the pixel. Only the
mouth and jaw are taken from them: everywhere else the figure is
heroine.png's own pixels.

R: her light, mouth closed, with the specks around her cleared;
G: her silhouette, a soft matte that keeps the code rain behind her (the
   union of the three mouths, so the dropped chin is covered);
B: inside MOUTH_BOX, her light with the mouth open; MOUTH_SHIFT px to the
   right (an empty part of the image), her light with the mouth half open.
   Where the mouths do not differ B equals R, so the shader can blend
   R -> half -> open with no seam at the box's edge.
MOUTH_BOX and MOUTH_SHIFT are lib.rs's constants of the same names.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

MOUTH_BOX = (220, 340, 700, 620)  # x0, y0, x1, y1
MOUTH_SHIFT = 800

HERE = Path(__file__).resolve().parent.parent


def light_of(name):
    src = np.asarray(Image.open(HERE / "assets" / name).convert("RGB")).astype(np.float32) / 255.0
    assert src.shape == (1024, 1536, 3), name
    return np.clip((src.max(axis=2) - 0.02) / 0.98, 0.0, 1.0)


def matte_of(light):
    body = ndimage.gaussian_filter(light, 6.0) > 0.06
    body = ndimage.binary_fill_holes(body)
    labels, count = ndimage.label(body)
    sizes = ndimage.sum(body, labels, range(1, count + 1))
    return labels == 1 + int(np.argmax(sizes))


closed, half, opened = (light_of(n) for n in ("heroine.png", "heroine-half.png", "heroine-open.png"))

# Where the mouth and jaw change: the edits redraw the whole mesh a little
# (about 0.2 after a 5 px blur), the lips, the chin and the jaw line far
# more. A smooth mask over those, zero at the box's edge.
x0, y0, x1, y1 = MOUTH_BOX
blur = lambda a: ndimage.gaussian_filter(a, 5.0)
change = np.maximum(np.abs(blur(opened) - blur(closed)), np.abs(blur(half) - blur(closed)))
core = change > 0.25
labels, count = ndimage.label(core)
sizes = ndimage.sum(core, labels, range(1, count + 1))
core = np.isin(labels, 1 + np.nonzero(sizes > 300)[0])
# One solid piece (lips, chin and jaw line move together), so no island of
# the closed mesh is left inside the open one.
core = ndimage.binary_closing(np.pad(core, 40), iterations=36)[40:-40, 40:-40]
core = ndimage.binary_fill_holes(core)
mask = ndimage.gaussian_filter(ndimage.binary_dilation(core, iterations=10).astype(np.float32), 5.0)
inside = np.zeros(closed.shape, bool)
inside[y0:y1, x0:x1] = True
assert mask[~inside].max() < 1e-3, "the mouth reaches past MOUTH_BOX"

half_m = closed + (half - closed) * mask
open_m = closed + (opened - closed) * mask

body = matte_of(closed) | matte_of(half_m) | matte_of(open_m)
matte = ndimage.gaussian_filter(body.astype(np.float32), 4.0)
keep = np.clip(matte * 2.0, 0.0, 1.0)
right = keep[y0 - 2 : y1 + 2, x0 + MOUTH_SHIFT - 2 : x1 + MOUTH_SHIFT + 2]
assert right.max() < 1e-3, "the half-open mouth's place is not empty"

out = np.zeros(closed.shape + (3,), dtype=np.uint8)
out[..., 0] = np.round(closed * keep * 255.0)
out[..., 1] = np.round(matte * 255.0)
# Two pixels past the box, so filtering at its edge reads no empty texel.
blue = np.zeros(closed.shape, np.float32)
a0, b0, a1, b1 = x0 - 2, y0 - 2, x1 + 2, y1 + 2
blue[b0:b1, a0:a1] = (open_m * keep)[b0:b1, a0:a1]
blue[b0:b1, a0 + MOUTH_SHIFT : a1 + MOUTH_SHIFT] = (half_m * keep)[b0:b1, a0:a1]
out[..., 2] = np.round(blue * 255.0)
Image.fromarray(out, "RGB").save(HERE / "assets/figure.png", optimize=True)
print("assets/figure.png written")

if len(sys.argv) > 2 and sys.argv[1] == "--show":
    view = np.stack([closed, mask, np.zeros_like(mask)], axis=2)[y0 - 40 : y1 + 40, x0 - 40 : x1 + 40]
    Image.fromarray(np.round(np.clip(view, 0, 1) * 255).astype(np.uint8)).resize((680, 680)).save(sys.argv[2])
