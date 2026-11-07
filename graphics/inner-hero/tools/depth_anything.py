"""Depth Anything V2 (Base) on Art's painting.

Predicts relative disparity (big = near) at a few input heights and saves
each as .npy at the painting's size. Runs offline from the Hugging Face
cache once the model has been fetched.
usage: python -I depth_anything.py <painting.png> <out_dir> <height> [<height>...]
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
img = Image.open(src).convert("RGB")
W, H = img.size

name = "depth-anything/Depth-Anything-V2-Base-hf"
proc = AutoImageProcessor.from_pretrained(name)
model = AutoModelForDepthEstimation.from_pretrained(name).eval()
torch.set_num_threads(max(1, os.cpu_count() - 2))

for h in heights:
    t0 = time.time()
    side = int(round(h / 14)) * 14
    width = int(round(side * W / H / 14)) * 14
    inputs = proc(images=img, return_tensors="pt", size={"height": side, "width": width}, do_resize=True, keep_aspect_ratio=False)
    with torch.no_grad():
        pred = model(**inputs).predicted_depth  # 1 x h x w
    d = torch.nn.functional.interpolate(pred[None], size=(H, W), mode="bicubic", align_corners=False)[0, 0].numpy()
    np.save(os.path.join(out, f"raw-{side}.npy"), d.astype(np.float32))
    print(side, tuple(inputs["pixel_values"].shape), f"{time.time() - t0:.1f}s", float(d.min()), float(d.max()), flush=True)
