#!/usr/bin/env python3
"""Generate EasySourcing PWA icons (light theme, emerald brand).

Draws a rounded-square emerald tile with a white scan-bracket + 'ES' monogram,
matching the Auditor Mobile app's identity. Outputs:
  public/icons/icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png
"""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = "/home/z/my-project/public/icons"
os.makedirs(OUT, exist_ok=True)

EMERALD = (5, 150, 105)      # emerald-600
TEAL = (13, 148, 136)        # teal-600
DEEP = (4, 108, 78)          # darker emerald for gradient bottom
WHITE = (255, 255, 255)

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def rounded_gradient(size: int, radius_ratio: float = 0.22) -> Image.Image:
    """Rounded square with a subtle vertical emerald->teal gradient."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    radius = int(size * radius_ratio)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    grad = Image.new("RGBA", (size, size))
    gd = ImageDraw.Draw(grad)
    for y in range(size):
        t = y / max(1, size - 1)
        r = int(EMERALD[0] + (TEAL[0] - EMERALD[0]) * t)
        g = int(EMERALD[1] + (TEAL[1] - EMERALD[1]) * t)
        b = int(EMERALD[2] + (TEAL[2] - EMERALD[2]) * t)
        gd.line([(0, y), (size, y)], fill=(r, g, b, 255))
    img.paste(grad, (0, 0), mask)
    return img


def draw_glyph(img: Image.Image, content_scale: float = 1.0) -> None:
    """White scan-bracket frame + bold 'ES' centered inside."""
    size = img.width
    d = ImageDraw.Draw(img)
    m = size * 0.16 * content_scale            # glyph margin
    bw = max(3, int(size * 0.055 * content_scale))  # bracket stroke width
    arm = size * 0.16 * content_scale          # bracket arm length

    # corner brackets (top-left & bottom-right) — evokes 'scan'
    d.line([(m, m + arm), (m, m), (m + arm, m)], fill=WHITE, width=bw)
    d.line([(size - m - arm, size - m), (size - m, size - m), (size - m, size - m - arm)],
           fill=WHITE, width=bw)

    # ES monogram
    fs = int(size * 0.34 * content_scale)
    font = ImageFont.truetype(FONT_BOLD, fs)
    text = "ES"
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    cx, cy = size / 2, size / 2
    d.text((cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1] + size * 0.02), text,
           font=font, fill=WHITE)


def gen(size: int, name: str, rounded: bool = True, content_scale: float = 1.0,
        bg: bool = False) -> None:
    if bg:
        # maskable: full-bleed square bg, art shrunk into the 80% safe zone
        img = Image.new("RGBA", (size, size), EMERALD + (255,))
        gd = ImageDraw.Draw(img)
        for y in range(size):
            t = y / max(1, size - 1)
            gd.line([(0, y), (size, y)],
                    fill=(int(EMERALD[0] + (TEAL[0] - EMERALD[0]) * t),
                          int(EMERALD[1] + (TEAL[1] - EMERALD[1]) * t),
                          int(EMERALD[2] + (TEAL[2] - EMERALD[2]) * t), 255))
        draw_glyph(img, content_scale=0.78)
    elif rounded:
        img = rounded_gradient(size)
        draw_glyph(img, content_scale)
    else:
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw_glyph(img, content_scale)
    path = os.path.join(OUT, name)
    img.save(path, "PNG")
    print(f"wrote {path} ({img.width}x{img.height})")


gen(512, "icon-512.png")
gen(192, "icon-192.png")
gen(180, "apple-touch-icon.png", rounded=False, content_scale=0.92)  # iOS tiles it itself
gen(512, "maskable-512.png", bg=True)
print("done")
