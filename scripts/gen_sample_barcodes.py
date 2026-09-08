#!/usr/bin/env python3
"""
EasySourcing — sample testing barcodes.

Generates under download/easysourcing-samples/barcodes/:
  - qr/<value>.png        QR code (phone-camera friendly)
  - code128/<value>.png   Code128 barcode (laser-scanner friendly)
  - printable-labels.pdf  A4 cut-out label sheet (QR + Code128 + text)
Values:
  - MRD-TAG-1001..1014 — the Tag values used in the sample register files
  - ES-MRD-00043, ES-MRD-00089 — existing seeded platform asset codes

Code128 is rendered in pure Python (standard pattern table) via PIL — no
external barcode package needed.
"""
import os

from PIL import Image, ImageDraw, ImageFont
import qrcode

OUT = "/home/z/my-project/download/easysourcing-samples/barcodes"
QR_DIR = os.path.join(OUT, "qr")
C128_DIR = os.path.join(OUT, "code128")
os.makedirs(QR_DIR, exist_ok=True)
os.makedirs(C128_DIR, exist_ok=True)

VALUES = [f"MRD-TAG-{i}" for i in range(1001, 1015)] + ["ES-MRD-00043", "ES-MRD-00089"]

# ── Code128 pattern table (values 0–106; index 106 = stop, 13 modules) ──────
CODE128 = [
    "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312",
    "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
    "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
    "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
    "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
    "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
    "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321",
    "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
    "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
    "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
    "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112",
    "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
    "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412",
    "211214", "211232", "2331112",
]


def code128b_bit_pattern(text: str):
    """Return list of (pattern_string) for a Code128-B encoding of text."""
    if not all(32 <= ord(c) <= 126 for c in text):
        raise ValueError("Code128-B supports ASCII 32–126 only")
    codes = [104] + [ord(c) - 32 for c in text]          # Start B + data
    checksum = codes[0] + sum(v * i for i, v in enumerate(codes[1:], 1))
    codes.append(checksum % 103)
    codes.append(106)                                     # stop
    return [CODE128[c] for c in codes]


def render_code128_png(value: str, path: str, module_px: int = 3, height_px: int = 110, quiet_modules: int = 10):
    patterns = code128b_bit_pattern(value)
    modules = quiet_modules + sum(int(p) for p in "".join(patterns)) // 1 * 0  # placeholder
    # total modules = sum of widths in all patterns
    total = quiet_modules * 2 + sum(sum(int(d) for d in p) for p in patterns)
    W = total * module_px
    img = Image.new("RGB", (W, height_px), "white")
    draw = ImageDraw.Draw(img)
    x = quiet_modules * module_px
    dark = True  # each pattern starts with a bar
    for p in patterns:
        for d in p:
            w = int(d) * module_px
            if dark:
                draw.rectangle([x, 0, x + w - 1, height_px - 1], fill="black")
            x += w
            dark = not dark
    img.save(path)


def render_qr_png(value: str, path: str, box: int = 12):
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=box, border=3)
    qr.add_data(value)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(path)


# ── render all PNGs ──────────────────────────────────────────────────────────
for v in VALUES:
    render_qr_png(v, os.path.join(QR_DIR, f"{v}.png"))
    render_code128_png(v, os.path.join(C128_DIR, f"{v}.png"))
print(f"ok  qr/*.png        {len(VALUES)} files")
print(f"ok  code128/*.png   {len(VALUES)} files")

# ── printable A4 label sheet (reportlab) ─────────────────────────────────────
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

PDF = os.path.join(OUT, "printable-labels.pdf")
PW, PH = A4
MARGIN = 12 * mm
LABEL_W, LABEL_H = 86 * mm, 42 * mm
GAP_X, GAP_Y = 6 * mm, 6 * mm
COLS = 2
ROWS_PER_PAGE = int((PH - 2 * MARGIN) // (LABEL_H + GAP_Y))

c = canvas.Canvas(PDF, pagesize=A4)
c.setTitle("EasySourcing — printable test barcode labels")
try:
    bold_font = "Helvetica-Bold"
    mono_font = "Courier-Bold"
except Exception:
    bold_font = mono_font = "Helvetica"

page, idx = 1, 0
while idx < len(VALUES):
    y = PH - MARGIN
    c.setFont(bold_font, 13)
    c.drawString(MARGIN, y, f"EasySourcing · sample barcode labels — sheet {page}")
    c.setFont("Helvetica", 8.5)
    c.drawString(MARGIN, y - 4 * mm, "Print at 100% scale (no fit-to-page). QR = phone camera · Code128 = laser scanner · value printed below.")
    y -= 12 * mm

    for row in range(ROWS_PER_PAGE):
        for col in range(COLS):
            if idx >= len(VALUES):
                break
            v = VALUES[idx]
            x = MARGIN + col * (LABEL_W + GAP_X)
            ly = y - row * (LABEL_H + GAP_Y) - LABEL_H
            # label card
            c.setStrokeColorRGB(0.82, 0.82, 0.82)
            c.setLineWidth(0.8)
            c.roundRect(x, ly, LABEL_W, LABEL_H, 2.5 * mm)
            # QR (30mm square, left)
            qr_path = os.path.join(QR_DIR, f"{v}.png")
            c.drawImage(qr_path, x + 5 * mm, ly + (LABEL_H - 30 * mm) / 2, 30 * mm, 30 * mm)
            # Code128 (right, ~46mm wide, keep aspect)
            c128_path = os.path.join(C128_DIR, f"{v}.png")
            img_w = sum(sum(int(d) for d in p) for p in code128b_bit_pattern(v)) + 20
            img_h = 110
            draw_w = 46 * mm
            draw_h = draw_w * img_h / img_w
            bx = x + 39 * mm
            by = ly + 26 * mm
            c.drawImage(c128_path, bx, by, draw_w, min(draw_h, 18 * mm))
            # human-readable value
            c.setFont(mono_font, 10.5)
            c.drawString(bx + (draw_w - c.stringWidth(v, mono_font, 10.5)) / 2, ly + 13 * mm, v)
            c.setFont("Helvetica", 7)
            c.drawString(bx, ly + 7 * mm, "Scan in Auditor Mobile → Search / Scan")
            idx += 1
    c.showPage()
    page += 1
c.save()
print("ok  printable-labels.pdf")
