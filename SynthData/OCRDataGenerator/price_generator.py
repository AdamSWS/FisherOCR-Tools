from PIL import ImageDraw, ImageFont
from typing import Tuple, Dict

def create_price_fonts(font_path: str, base_font_size: int) -> Dict[str, ImageFont.FreeTypeFont]:
    """Create fonts for different price components."""
    try:
        return {
            'dollar': ImageFont.truetype(font_path, int(base_font_size * 2)),   # Large for main price
            'cents': ImageFont.truetype(font_path, int(base_font_size * 0.85)), # Superscript cents
            'only': ImageFont.truetype(font_path, int(base_font_size * 0.9)),   # Suffix below
            'product': ImageFont.truetype(font_path, base_font_size)
        }
    except IOError:
        print(f"Error loading font {font_path}")
        return {k: ImageFont.load_default() for k in ['dollar', 'cents', 'only', 'product']}

def calculate_price_positions(draw: ImageDraw.ImageDraw,
                              fonts: Dict[str, ImageFont.FreeTypeFont],
                              text_components: Dict[str, str],
                              width: int,
                              height: int) -> Dict[str, Tuple[int, int]]:
    """Calculate positions for each price component, ensuring cents are above the suffix."""
    
    # Get text dimensions
    dollar_bbox = draw.textbbox((0, 0), text_components['dollar'], font=fonts['dollar'])
    cents_bbox = draw.textbbox((0, 0), text_components['cents'], font=fonts['cents'])
    only_bbox = draw.textbbox((0, 0), text_components['only'], font=fonts['only'])

    # Center the whole price group
    total_width = max(dollar_bbox[2] + cents_bbox[2], only_bbox[2])
    base_x = (width - total_width) // 2
    base_y = height // 3

    # Dollar positioning
    dollar_x = base_x
    dollar_y = base_y

    # Cents positioning
    cents_x = dollar_x + dollar_bbox[2] + 5
    cents_y = dollar_y - (cents_bbox[3] // 2)

    # Suffix positioning
    only_x = cents_x
    only_y = dollar_y + dollar_bbox[3] + 5

    return {
        'dollar': (dollar_x, dollar_y),
        'cents': (cents_x, cents_y),
        'only': (only_x, only_y)
    }

def draw_price_components(draw: ImageDraw.ImageDraw,
                          positions: Dict[str, Tuple[int, int]],
                          fonts: Dict[str, ImageFont.FreeTypeFont],
                          text_components: Dict[str, str],
                          text_color: Tuple[int, int, int]):
    """Draw each price component at calculated positions."""
    draw.text(
        positions['dollar'],
        text_components['dollar'],
        fill=text_color,
        font=fonts['dollar']
    )
    draw.text(
        positions['cents'],
        text_components['cents'],
        fill=text_color,
        font=fonts['cents']
    )
    draw.text(
        positions['only'],
        text_components['only'],
        fill=text_color,
        font=fonts['only']
    )
