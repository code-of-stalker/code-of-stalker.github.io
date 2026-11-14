"""Bakes the phone screen atlas for page 08 (the Diary insert).

    python graphics/night-city/tools/bake-phone.py <captures-dir>

<captures-dir> holds screenshots of the real app in Тишина at 390x844 CSS px,
DPR 1.5 (585x1266): home.png (home page), diary.png (Diary, empty), r0.png
(Diary right after the record tap, 00:00) and r1..r3.png (00:01..00:03).
The launcher (the phone's home screen with our icon) is drawn here.

The atlas is grey: the scene inks it in the theme's colour. Cells of
585x1266 at a pitch of 600: launcher | home | diary | record. Under them, the
seconds digit of the record timer for 0..3 s (DIGIT_* below), so the timer
can tick in the scene. Writes assets/phone.png; publish the WebP copy with
`python graphics/lossless-webp.py`.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
W, H, PITCH = 585, 1266, 600
# The seconds digit of «00:0N / 15:00» in the capture, and its row below.
DIGIT = (115, 1178, 129, 1197)
DIGIT_ROW = H + 6
ATLAS = (PITCH * 4, H + 32)
ICON_AT = (219, 735)  # our icon's centre on the launcher (device px)
FONTS = Path("C:/Windows/Fonts")
CLOCK = "23:47"


def font(name, size, variation=None):
    f = ImageFont.truetype(str(FONTS / name), size)
    if variation:
        f.set_variation_by_name(variation)
    return f


def grey(rgb):
    """The capture's brightest channel, its page level lifted to a faint glow."""
    a = np.asarray(rgb.convert("RGB")).astype(np.float32).max(axis=2) / 255.0
    a = np.clip((a - 0.10) / (0.92 - 0.10), 0.0, 1.0)
    return a


def status_bar(img, dim=1.0):
    """A plain status bar: the time on the left, signal and battery on the right."""
    d = ImageDraw.Draw(img)
    level = int(205 * dim)
    d.text((34, 8), CLOCK, font=font("segoeuib.ttf", 21), fill=level)
    x = W - 34
    # Battery: outline, cap and a three-quarter charge.
    d.rounded_rectangle((x - 40, 12, x - 6, 28), radius=4, outline=level, width=2)
    d.rectangle((x - 5, 17, x - 2, 23), fill=level)
    d.rounded_rectangle((x - 37, 15, x - 15, 25), radius=2, fill=level)
    # Signal: four rising bars.
    for k in range(4):
        h = 5 + k * 4
        d.rectangle((x - 92 + k * 9, 28 - h, x - 86 + k * 9, 28), fill=level if k < 3 else int(level * 0.35))


def app_cell(path):
    """A capture as grey, with the status bar drawn over its empty top rows."""
    a = grey(Image.open(path))
    top = np.clip((np.arange(H) - 30) / 12.0, 0.0, 1.0)[:, None]
    a = a * top + (1.0 - top) * 0.03
    img = Image.fromarray((a * 255).round().astype(np.uint8), "L")
    status_bar(img)
    return img


def glyph(d, kind, cx, cy, s, level):
    """A plain line glyph for a generic app icon."""
    w = 3
    if kind == 0:  # camera
        d.rounded_rectangle((cx - s, cy - s * 0.6, cx + s, cy + s * 0.7), radius=6, outline=level, width=w)
        d.ellipse((cx - s * 0.4, cy - s * 0.3, cx + s * 0.4, cy + s * 0.5), outline=level, width=w)
    elif kind == 1:  # clock
        d.ellipse((cx - s, cy - s, cx + s, cy + s), outline=level, width=w)
        d.line((cx, cy, cx, cy - s * 0.65), fill=level, width=w)
        d.line((cx, cy, cx + s * 0.45, cy + s * 0.2), fill=level, width=w)
    elif kind == 2:  # notes
        d.rounded_rectangle((cx - s * 0.8, cy - s, cx + s * 0.8, cy + s), radius=5, outline=level, width=w)
        for k in range(3):
            y = cy - s * 0.45 + k * s * 0.45
            d.line((cx - s * 0.45, y, cx + s * 0.45, y), fill=level, width=w)
    elif kind == 3:  # map pin
        d.ellipse((cx - s * 0.6, cy - s, cx + s * 0.6, cy + s * 0.2), outline=level, width=w)
        d.line((cx - s * 0.45, cy - s * 0.1, cx, cy + s), fill=level, width=w)
        d.line((cx + s * 0.45, cy - s * 0.1, cx, cy + s), fill=level, width=w)
    elif kind == 4:  # music
        d.line((cx - s * 0.3, cy + s * 0.6, cx - s * 0.3, cy - s * 0.8), fill=level, width=w)
        d.line((cx - s * 0.3, cy - s * 0.8, cx + s * 0.6, cy - s), fill=level, width=w)
        d.line((cx + s * 0.6, cy - s, cx + s * 0.6, cy + s * 0.4), fill=level, width=w)
        d.ellipse((cx - s * 0.75, cy + s * 0.35, cx - s * 0.2, cy + s * 0.85), fill=level)
        d.ellipse((cx + s * 0.15, cy + s * 0.15, cx + s * 0.7, cy + s * 0.65), fill=level)
    elif kind == 5:  # weather
        d.ellipse((cx - s * 0.2, cy - s * 0.9, cx + s * 0.8, cy + s * 0.1), outline=level, width=w)
        d.rounded_rectangle((cx - s, cy - s * 0.1, cx + s * 0.6, cy + s * 0.7), radius=12, fill=int(level * 0.55))
    elif kind == 6:  # message
        d.rounded_rectangle((cx - s, cy - s * 0.75, cx + s, cy + s * 0.45), radius=10, outline=level, width=w)
        d.polygon((cx - s * 0.5, cy + s * 0.4, cx - s * 0.6, cy + s, cx - s * 0.05, cy + s * 0.4), fill=level)
    elif kind == 7:  # settings
        d.ellipse((cx - s * 0.85, cy - s * 0.85, cx + s * 0.85, cy + s * 0.85), outline=level, width=w + 1)
        d.ellipse((cx - s * 0.3, cy - s * 0.3, cx + s * 0.3, cy + s * 0.3), outline=level, width=w)
    elif kind == 8:  # calendar
        d.rounded_rectangle((cx - s, cy - s * 0.8, cx + s, cy + s * 0.9), radius=5, outline=level, width=w)
        d.line((cx - s, cy - s * 0.35, cx + s, cy - s * 0.35), fill=level, width=w)
        d.text((cx, cy + s * 0.3), "13", font=font("segoeuib.ttf", int(s * 0.9)), fill=level, anchor="mm")
    elif kind == 9:  # photos
        for k in range(4):
            ox, oy = (k % 2) * 2 - 1, (k // 2) * 2 - 1
            d.ellipse((cx + ox * s * 0.45 - s * 0.45, cy + oy * s * 0.45 - s * 0.45,
                       cx + ox * s * 0.45 + s * 0.45, cy + oy * s * 0.45 + s * 0.45), outline=level, width=w)
    elif kind == 10:  # phone handset
        d.arc((cx - s * 0.9, cy - s * 0.9, cx + s * 0.9, cy + s * 0.9), 110, 250, fill=level, width=w + 4)
        d.rounded_rectangle((cx - s * 0.75, cy - s * 0.95, cx - s * 0.05, cy - s * 0.55), radius=4, fill=level)
        d.rounded_rectangle((cx - s * 0.75, cy + s * 0.55, cx - s * 0.05, cy + s * 0.95), radius=4, fill=level)
    elif kind == 12:  # mail
        d.rounded_rectangle((cx - s, cy - s * 0.65, cx + s, cy + s * 0.65), radius=5, outline=level, width=w)
        d.line((cx - s, cy - s * 0.6, cx, cy + s * 0.1, cx + s, cy - s * 0.6), fill=level, width=w)
    elif kind == 13:  # globe
        d.ellipse((cx - s, cy - s, cx + s, cy + s), outline=level, width=w)
        d.ellipse((cx - s * 0.45, cy - s, cx + s * 0.45, cy + s), outline=level, width=w)
        d.line((cx - s, cy, cx + s, cy), fill=level, width=w)
    elif kind == 14:  # contacts
        d.ellipse((cx - s * 0.4, cy - s * 0.9, cx + s * 0.4, cy - s * 0.1), outline=level, width=w)
        d.arc((cx - s * 0.85, cy + s * 0.05, cx + s * 0.85, cy + s * 1.6), 180, 360, fill=level, width=w)
    else:  # files
        d.polygon((cx - s, cy - s * 0.6, cx - s * 0.2, cy - s * 0.6, cx, cy - s * 0.35, cx + s, cy - s * 0.35,
                   cx + s, cy + s * 0.75, cx - s, cy + s * 0.75), outline=level, width=w)


def launcher():
    """The phone's home screen at night: a dim wallpaper, a clock, plain app
    icons, and ours lit."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    wall = 0.055 + 0.05 * np.exp(-(((xx - 420) / 260) ** 2 + ((yy - 380) / 330) ** 2))
    wall += 0.035 * np.exp(-(((xx - 120) / 300) ** 2 + ((yy - 1050) / 260) ** 2))
    img = Image.fromarray((np.clip(wall, 0, 1) * 255).round().astype(np.uint8), "L")
    d = ImageDraw.Draw(img)
    status_bar(img, 0.95)
    d.text((W / 2, 205), CLOCK, font=font("bahnschrift.ttf", 132, "Light"), fill=214, anchor="ms")
    d.text((W / 2, 250), "пятница, 13 ноября", font=font("segoeui.ttf", 25), fill=150, anchor="ms")
    labels = ["Камера", "Часы", "Заметки", "Карты", "Музыка", "Погода", "Почта", "Настройки",
              "Календарь", "Код Сталкера", "Фото", "Файлы"]
    kinds = [0, 1, 2, 3, 4, 5, 12, 7, 8, None, 9, 11]
    cols = [73, 219, 366, 512]
    rows = [435, 585, 735]
    size = 96
    label_font = font("segoeui.ttf", 19)
    for k, label in enumerate(labels):
        cx, cy = cols[k % 4], rows[k // 4]
        if label == "Код Сталкера":
            assert (cx, cy) == ICON_AT
            continue
        tone = 34 + (k * 7) % 18
        d.rounded_rectangle((cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2), radius=24, fill=tone)
        glyph(d, kinds[k], cx, cy, size * 0.27, 112)
        d.text((cx, cy + size / 2 + 26), label, font=label_font, fill=128, anchor="ms")
    # Dock: four apps on a faint pane.
    d.rounded_rectangle((22, 1085, W - 22, 1215), radius=40, fill=26)
    for k, kind in enumerate((10, 6, 13, 14)):
        cx = cols[k]
        d.rounded_rectangle((cx - size / 2, 1150 - size / 2, cx + size / 2, 1150 + size / 2), radius=24, fill=40)
        glyph(d, kind, cx, 1150, size * 0.27, 118)
    # Page dots.
    for k in range(3):
        d.ellipse((W / 2 - 22 + k * 18 - 4, 1060, W / 2 - 22 + k * 18 + 4, 1068), fill=170 if k == 0 else 60)
    # Ours: the exit-door icon, the brightest thing on the screen, with a halo.
    icon = Image.open(ROOT.parents[1] / "assets" / "icon.png").convert("RGB").resize((size, size), Image.LANCZOS)
    icon_grey = Image.fromarray((grey(icon) * 255).round().astype(np.uint8), "L")
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=24, fill=255)
    halo = Image.new("L", (W, H), 0)
    ImageDraw.Draw(halo).rounded_rectangle((ICON_AT[0] - size / 2, ICON_AT[1] - size / 2,
                                            ICON_AT[0] + size / 2, ICON_AT[1] + size / 2), radius=24, fill=70)
    halo = halo.filter(ImageFilter.GaussianBlur(18))
    img = Image.fromarray(np.maximum(np.asarray(img), np.asarray(halo)), "L")
    img.paste(icon_grey, (ICON_AT[0] - size // 2, ICON_AT[1] - size // 2), mask)
    d = ImageDraw.Draw(img)
    d.text((ICON_AT[0], ICON_AT[1] + size / 2 + 26), "Код Сталкера", font=label_font, fill=225, anchor="ms")
    return img


def main(captures):
    atlas = Image.new("L", ATLAS, 0)
    cells = [launcher(), app_cell(captures / "home.png"), app_cell(captures / "diary.png"),
             app_cell(captures / "r0.png")]
    for k, cell in enumerate(cells):
        atlas.paste(cell, (k * PITCH, 0))
    x0, y0, x1, y1 = DIGIT
    for n in range(4):
        cell = app_cell(captures / f"r{n}.png")
        atlas.paste(cell.crop(DIGIT), (10 + n * 20, DIGIT_ROW))
    target = ROOT / "assets" / "phone.png"
    target.parent.mkdir(exist_ok=True)
    atlas.save(target, optimize=True)
    print(target, atlas.size, target.stat().st_size)


if __name__ == "__main__":
    main(Path(sys.argv[1]))
