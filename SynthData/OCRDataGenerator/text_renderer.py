from PIL import ImageDraw, ImageFont
from typing import Dict

def draw_text_with_bbox(draw, text: str, font: ImageFont.FreeTypeFont, x: int, y: int, color) -> Dict:
    """Draw text with a bounding box and return the region info."""
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
    except AttributeError:
        # Fallback for older PIL versions
        bbox = (0, 0, *draw.textsize(text, font=font))

    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    draw.text((x, y), text, fill=color, font=font)

    return {
        "text": text,
        "points": [
            [x, y],
            [x + text_width, y],
            [x + text_width, y + text_height],
            [x, y + text_height]
        ]
    }
