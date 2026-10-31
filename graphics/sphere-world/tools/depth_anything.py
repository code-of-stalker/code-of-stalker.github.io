"""Depth Anything V2 (Base) on an equirectangular panorama.

The panorama is padded with its own wrap on both sides so the seam has
context, then predicted at a few input heights. Raw disparity (big = near)
for the original columns, seam blended, is saved as .npy per height.
usage: python -I depth_anything.py <panorama.png> <out_dir> <height> [<height>...]
(made with heights 518 and 770)
"""
import sys, os, time
import numpy as np
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForDepthEstimation

src, out = sys.argv[1], sys.argv[2]
heights = [int(h) for h in sys.argv[3:]] or [518]
os.makedirs(out, exist_ok=True)
img = np.array(Image.open(src).convert("RGB"))
H, W, _ = img.shape
PAD = W // 4
padded = np.concatenate([img[:, W - PAD:], img, img[:, :PAD]], axis=1)
pim = Image.fromarray(padded)

name = "depth-anything/Depth-Anything-V2-Base-hf"
proc = AutoImageProcessor.from_pretrained(name)
model = AutoModelForDepthEstimation.from_pretrained(name).eval()
torch.set_num_threads(max(1, os.cpu_count() - 2))

for h in heights:
    t0 = time.time()
    side = int(round(h / 14)) * 14
    inputs = proc(images=pim, return_tensors="pt", size={"height": side, "width": side})
    with torch.no_grad():
        pred = model(**inputs).predicted_depth  # 1 x h x w
    d = torch.nn.functional.interpolate(pred[None], size=(H, W + 2 * PAD), mode="bicubic", align_corners=False)[0, 0].numpy()
    # Original column c sits at c + PAD; columns near the seam also sit at
    # c + W + PAD (right pad) or c - W + PAD (left pad). Blend so column 0
    # continues column W-1 exactly.
    main = d[:, PAD:PAD + W].copy()
    blend = PAD // 2
    c = np.arange(blend)
    w = (c / blend) ** 2 * (3 - 2 * c / blend)
    main[:, :blend] = (1 - w) * d[:, W + PAD:W + PAD + blend] + w * d[:, PAD:PAD + blend]
    np.save(os.path.join(out, f"raw-{side}.npy"), main.astype(np.float32))
    print(side, tuple(inputs["pixel_values"].shape), f"{time.time() - t0:.1f}s", float(main.min()), float(main.max()), flush=True)
