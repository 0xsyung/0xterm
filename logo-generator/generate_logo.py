#!/usr/bin/env python3
"""
0xterm Logo Generator — Icon-only

Generates the 0xterm hexagon icon (green hexagon with a centered "0x_")
as PNG, SVG, and ICO favicon. No wordmark or tagline.

Outputs are written to the `output/` directory (relative to this script).
"""

import os
import math

from PIL import Image, ImageDraw, ImageFont
import svgwrite

# --- Configuration ---
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")

# Colors (Hex) — matrix green theme
COLOR_GREEN = "#00FF66"    # bright matrix green (text)
COLOR_DARK_GREEN = "#005522"  # dark green hexagon fill
COLOR_WHITE = "#FFFFFF"
COLOR_BLACK = "#000000"

# Canvas (square, icon-only)
CANVAS = 512
ICON_SIZE = 360  # hexagon diameter in px

# --- Font Handling ---

# Candidate bold font paths, tried in order per OS.
_FONT_CANDIDATES = {
    "Darwin": [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ],
    "Windows": [
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ],
    "Linux": [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ],
}


def _load_font(size):
    """Return a bold TrueType font, or ImageFont.load_default() if none found."""
    import platform

    system = platform.system()
    for path in _FONT_CANDIDATES.get(system, []):
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except IOError:
                continue
    print(f"Warning: no suitable bold font found for {system}; using default font.")
    return ImageFont.load_default()


def ensure_dir(directory):
    if not os.path.exists(directory):
        os.makedirs(directory)


def hexagon_vertices(center, size, angle_offset=30):
    """Return 6 vertices of a regular hexagon (pointed top by default)."""
    vertices = []
    for i in range(6):
        angle_deg = 60 * i + angle_offset
        angle_rad = angle_deg * math.pi / 180
        x = center[0] + size * 0.5 * math.cos(angle_rad)
        y = center[1] + size * 0.5 * math.sin(angle_rad)
        vertices.append((x, y))
    return vertices


def fit_font_to_width(draw, text, max_width, start_size, max_size):
    """Return the largest font (<= max_size) whose rendered width fits max_width."""
    size = min(start_size, max_size)
    while size > 8:
        font = _load_font(size)
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        if text_w <= max_width:
            return font
        size -= 4
    return _load_font(8)


def draw_icon_png(draw, center, size, hex_fill, text_fill, glow=None, max_font_size=150):
    """Draw hexagon + centered '0x_' text on a PIL ImageDraw surface."""
    if glow:
        draw.polygon(hexagon_vertices(center, size + 20), fill=glow)
    draw.polygon(hexagon_vertices(center, size), fill=hex_fill)

    text = "0x_"
    # Fit text inside the hexagon's inscribed circle (radius = size/2 * cos(30deg)),
    # which is the largest circle guaranteed fully inside the hexagon.
    inscribed_r = size * 0.5 * math.cos(math.radians(30))  # = size * 0.433
    # Text must fit within the square inscribed in that circle, with margin.
    target = inscribed_r * 2 * 0.72
    font = fit_font_to_width(draw, text, target, max_font_size, max_font_size)
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    # Ensure height also fits; if not, shrink font further.
    while text_h > target and bbox[2] > 0:
        max_font_size = max(8, max_font_size - 4)
        font = fit_font_to_width(draw, text, target, max_font_size, max_font_size)
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
    text_x = center[0] - text_w / 2
    text_y = center[1] - text_h / 2 - 5  # optical centering for underscore
    draw.text((text_x, text_y), text, font=font, fill=text_fill)


def generate_raster():
    ensure_dir(OUTPUT_DIR)
    center = (CANVAS // 2, CANVAS // 2)

    # Color icon: blue hex + cyan "0x_", transparent background, subtle glow
    img = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    draw_icon_png(d, center, ICON_SIZE, COLOR_DARK_GREEN, COLOR_GREEN, glow=(0, 255, 102, 60))
    img.save(os.path.join(OUTPUT_DIR, "icon.png"))
    print(f"Generated: {os.path.join(OUTPUT_DIR, 'icon.png')}")

    # Monochrome / light-background variant: black hex + white "0x_"
    img_mono = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    d_mono = ImageDraw.Draw(img_mono)
    draw_icon_png(d_mono, center, ICON_SIZE, COLOR_BLACK, COLOR_WHITE)
    img_mono.save(os.path.join(OUTPUT_DIR, "icon_monochrome.png"))
    print(f"Generated: {os.path.join(OUTPUT_DIR, 'icon_monochrome.png')}")


def generate_svg():
    ensure_dir(OUTPUT_DIR)
    center = (CANVAS // 2, CANVAS // 2)
    hex_points = hexagon_vertices(center, ICON_SIZE)

    # Color SVG
    dwg = svgwrite.Drawing(
        os.path.join(OUTPUT_DIR, "icon.svg"), profile="tiny", size=(CANVAS, CANVAS)
    )
    # Glow (soft outer hexagon)
    glow_points = hexagon_vertices(center, ICON_SIZE + 20)
    dwg.add(
        dwg.polygon(
            points=glow_points, fill=COLOR_GREEN, opacity=0.15
        )
    )
    dwg.add(dwg.polygon(points=hex_points, fill=COLOR_DARK_GREEN))
    dwg.add(
        dwg.text(
            "0x_",
            insert=(center[0], center[1] + 55),
            text_anchor="middle",
            font_size="150",
            font_family="Arial, sans-serif",
            font_weight="bold",
            fill=COLOR_GREEN,
        )
    )
    dwg.save()
    print(f"Generated: {os.path.join(OUTPUT_DIR, 'icon.svg')}")

    # Monochrome SVG
    dwg_mono = svgwrite.Drawing(
        os.path.join(OUTPUT_DIR, "icon_monochrome.svg"),
        profile="tiny",
        size=(CANVAS, CANVAS),
    )
    dwg_mono.add(dwg_mono.polygon(points=hex_points, fill=COLOR_BLACK))
    dwg_mono.add(
        dwg_mono.text(
            "0x_",
            insert=(center[0], center[1] + 55),
            text_anchor="middle",
            font_size="150",
            font_family="Arial, sans-serif",
            font_weight="bold",
            fill=COLOR_WHITE,
        )
    )
    dwg_mono.save()
    print(f"Generated: {os.path.join(OUTPUT_DIR, 'icon_monochrome.svg')}")


def generate_favicon():
    ensure_dir(OUTPUT_DIR)
    icon_size_px = 256
    img = Image.new("RGBA", (icon_size_px, icon_size_px), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    center = (icon_size_px // 2, icon_size_px // 2)
    size = icon_size_px * 0.9
    draw_icon_png(d, center, size, COLOR_DARK_GREEN, COLOR_GREEN, max_font_size=90)
    img.save(
        os.path.join(OUTPUT_DIR, "favicon.ico"),
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print(f"Generated: {os.path.join(OUTPUT_DIR, 'favicon.ico')}")


if __name__ == "__main__":
    print("Generating icon assets...")
    generate_raster()
    generate_svg()
    generate_favicon()
    print("\nAll done! Check the 'output' folder.")
