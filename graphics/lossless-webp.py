"""Publish copies of the authored scene PNGs as lossless WebP.

The PNG sources (with their provenance metadata) stay the authored originals.
The WebP copies decode to exactly the same pixels, including colour under fully
transparent texels (exact=True), and are about a third smaller to download.

    python graphics/lossless-webp.py            # rewrite every copy
    python graphics/lossless-webp.py --check    # fail when a copy is stale
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
SOURCES = {
    "cloud-drift": ["original", "background-clean", "hero", "poster"],
    "theatre-marionette": ["original", "background", "heroine"],
    "hear-state": ["figure", "labels"],
    "simple-practice": ["figure"],
    "tuning-questions": ["figure", "labels"],
    "persona-dream": ["figure", "labels"],
    "persona-program": ["figure", "labels"],
    "persona-belief": ["figure", "labels"],
}


def pixels(image):
    image.load()
    mode = "RGBA" if "A" in image.getbands() else "RGB"
    return mode, image.convert(mode).tobytes()


def main(check):
    stale = []
    for scene, names in SOURCES.items():
        for name in names:
            source = ROOT / scene / "assets" / f"{name}.png"
            target = source.with_suffix(".webp")
            with Image.open(source) as image:
                mode, expected = pixels(image)
                if check:
                    if not target.exists():
                        stale.append(target)
                        continue
                else:
                    image.convert(mode).save(target, "WEBP", lossless=True, quality=100, method=6, exact=True)
            with Image.open(target) as copy:
                copy.load()
                if copy.convert(mode).tobytes() != expected:
                    stale.append(target)
            print(f"{target.relative_to(ROOT)}: {source.stat().st_size} -> {target.stat().st_size}")
    if stale:
        sys.exit("Lossless WebP differs from its PNG source: " + ", ".join(str(p) for p in stale))


if __name__ == "__main__":
    main("--check" in sys.argv[1:])
