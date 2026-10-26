"""Writes assets-light/heroine.webp: the heroine cut from Art's light painting.

The pack's separate light heroine stands in another pose, so she is cut from
the light full scene. Its light background is the same plate without her, so
their difference is her outline; the dark matte only bounds where to look and
fills her interior where her colors happen to match the plate. An opening
drops the painted strings, which the scene draws itself.

    python3 light-heroine.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

HERE = Path(__file__).parent


def load(name, mode='RGB'):
    return np.asarray(Image.open(HERE / name).convert(mode), dtype=np.float32) / 255


def gray(values):
    return Image.fromarray(np.round(np.clip(values, 0, 1) * 255).astype(np.uint8), 'L')


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


full = load('assets-light/original.webp')
plate = load('assets-light/background.webp')
dark = Image.open(HERE / 'assets/heroine.png').getchannel('A')

difference = gray(np.abs(full - plate).max(axis=2)).filter(ImageFilter.GaussianBlur(0.8))
cut = smoothstep(0.07, 0.20, np.asarray(difference, dtype=np.float32) / 255)
opened = gray(cut).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
cut = np.minimum(cut, np.asarray(opened.filter(ImageFilter.GaussianBlur(1.0)), dtype=np.float32) / 255)
inner = np.asarray(dark.filter(ImageFilter.MinFilter(9)), dtype=np.float32) / 255
outer = np.asarray(dark.filter(ImageFilter.MaxFilter(15)), dtype=np.float32) / 255
alpha = np.maximum(smoothstep(0.5, 0.9, inner), cut) * smoothstep(0.1, 0.5, outer)

heroine = np.dstack([full, alpha])
Image.fromarray(np.round(heroine * 255).astype(np.uint8), 'RGBA').save(
    HERE / 'assets-light/heroine.webp', quality=90, alpha_quality=100, method=6)
