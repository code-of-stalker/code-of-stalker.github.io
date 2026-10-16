from pathlib import Path
import sys, json, math, base64
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / '.local-preview/svg-tools'))
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

OUT = Path(__file__).resolve().parent
ASSETS = ROOT / 'assets/product/fonts'
NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
fonts = {}
faces = {
    'TekturSemiBold': ASSETS / 'Tektur-SemiBold.ttf',
    'TekturMedium': ASSETS / 'Tektur-Medium.ttf',
    'Tektur': ASSETS / 'Tektur-Variable.ttf',
    'DisketMono': ASSETS / 'Disket-Mono-Regular.ttf',
    'DisketMonoBold': ASSETS / 'Disket-Mono-Bold.ttf',
    'Segoe UI Symbol': Path('C:/Windows/Fonts/seguisym.ttf'),
}
def load(family, value, weight):
    name = family.split(',')[0].strip('"\' ')
    if name not in faces:
        name = 'TekturSemiBold' if 'Tektur' in name else 'DisketMonoBold' if int(weight) >= 600 else 'DisketMono'
    if name not in fonts:
        fonts[name] = TTFont(faces[name])
    font = fonts[name]
    if ord(value) not in font.getBestCmap():
        name = 'Segoe UI Symbol'
        if name not in fonts:
            fonts[name] = TTFont(faces[name])
        font = fonts[name]
    glyph = font.getBestCmap().get(ord(value))
    if not glyph:
        raise ValueError(f'Missing glyph: {value!r}')
    return font, glyph

for geometry in sorted(OUT.glob('*.geometry.json')):
    data = json.loads(geometry.read_text(encoding='utf8'))
    root = ET.fromstring(data['svg'])
    by_id = {el.get('id'): el for el in root.iter() if el.get('id')}
    for item in data['text']:
        el = by_id[item['id']]
        font, glyph = load(item['family'], item['value'], item['weight'])
        glyph_set = font.getGlyphSet()
        pen = SVGPathPen(glyph_set)
        glyph_set[glyph].draw(pen)
        scale = item['size'] / font['head'].unitsPerEm
        el.tag = f'{{{NS}}}g'
        el.attrib.clear()
        el.set('aria-label', item['value'])
        el.text = None
        skew = scale * math.tan(math.radians(14)) if item['italic'] else 0
        path = ET.SubElement(el, f'{{{NS}}}path', {
            'd': pen.getCommands(), 'fill': item['color'],
            'transform': f'matrix({scale:.9g} 0 {skew:.9g} {-scale:.9g} {item["x"]} {item["y"]})',
        })
    target = OUT / (geometry.name.replace('.geometry.json', '.svg'))
    ET.ElementTree(root).write(target, encoding='utf-8', xml_declaration=True)
    assert not list(root.iter(f'{{{NS}}}text'))
    assert not list(root.iter(f'{{{NS}}}image'))
    assert not list(root.iter(f'{{{NS}}}foreignObject'))
    # Embed the application fonts in the editable companion for standalone previews.
    # The outlined primary files have no font dependencies.
    editable = OUT / 'editable' / target.name
    editable_root = ET.fromstring(data['svg'])
    defs = editable_root.find(f'{{{NS}}}defs')
    style = ET.SubElement(defs, f'{{{NS}}}style')
    style.text = '\n'.join(
        '@font-face{font-family:"' + face + '";src:url(data:font/ttf;base64,' + base64.b64encode(file.read_bytes()).decode() + ');font-weight:' + ('700' if face == 'DisketMonoBold' else '400') + ';}'
        for face, file in faces.items() if face != 'Segoe UI Symbol'
    )
    ET.ElementTree(editable_root).write(editable, encoding='utf-8', xml_declaration=True)
    print(target.name, f'{data["width"]}x{data["height"]}', target.stat().st_size)
