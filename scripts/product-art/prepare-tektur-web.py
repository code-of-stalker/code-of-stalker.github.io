"""Pin the bundled Tektur's existing 500/600 outlines for web engines without VF support.

Build tool only: fontTools 4.63.0. The original variable font and OFL are retained.
Run from the project root; output faces have the same glyphs and metrics.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

root = Path(__file__).resolve().parents[2] / 'assets/product/fonts'
for weight, name in [(500, 'Medium'), (600, 'SemiBold')]:
    source = TTFont(root / 'Tektur-Variable.ttf', recalcTimestamp=False)
    face = instantiateVariableFont(source, {'wdth': 100, 'wght': weight}, updateFontNames=True)
    assert 'fvar' not in face and face['OS/2'].usWeightClass == weight
    assert face.getBestCmap() == source.getBestCmap()
    face.save(root / f'Tektur-{name}.ttf')
    print(name, len(face.getGlyphOrder()), 'glyphs')
