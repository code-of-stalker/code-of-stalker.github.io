"""Depth Anything V2 (Base) on Art's room painting.

Predicts relative disparity (big = near) at a few input sizes that keep the
painting's 3:2 aspect, resized back to the painting, saved as .npy per size.
depth_map.py fits it to the room's geometry.
usage: python -I depth_anything.py <room.png> <out_dir> <height> [<height>...]
(made with heights 518 and 756)
"""
import sys, os, time
import numpy as np
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForDepthEstimation

src, out = sys.argv[1], sys.argv[2]
heights = [int(h) for h in sys.argv[3:]] or [518]
os.makedirs(out, exist_ok=True)
img = Image.open(src).convert("RGB")
W, H = img.size

name = "depth-anything/Depth-Anything-V2-Base-hf"
proc = AutoImageProcessor.from_pretrained(name)
model = AutoModelForDepthEstimation.from_pretrained(name).eval()
torch.set_num_threads(max(1, os.cpu_count() - 2))

for h in heights:
    t0 = time.time()
    side = int(round(h / 14)) * 14
    across = int(round(side * W / H / 14)) * 14
    inputs = proc(images=img, return_tensors="pt", size={"height": side, "width": across})
    with torch.no_grad():
        pred = model(**inputs).predicted_depth  # 1 x h x w
    d = torch.nn.functional.interpolate(pred[None], size=(H, W), mode="bicubic", align_corners=False)[0, 0].numpy()
    np.save(os.path.join(out, f"raw-{side}.npy"), d.astype(np.float32))
    print(side, tuple(inputs["pixel_values"].shape), f"{time.time() - t0:.1f}s", float(d.min()), float(d.max()), flush=True)
