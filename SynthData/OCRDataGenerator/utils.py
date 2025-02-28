"""Utility functions for OCR data generation."""

import os
import random
from datetime import datetime, timedelta
from typing import List, Tuple, Dict
from PIL import Image, ImageDraw

from config import (
    MONTHS, DATE_FORMATS, DATE_PREFIXES,
    PRODUCT_NUMBER_FORMATS
)

def load_fonts(fonts_dir: str) -> List[str]:
    """Load all supported font files from the fonts directory."""
    fonts = [
        os.path.join(root, file)
        for root, _, files in os.walk(fonts_dir)
        for file in files if file.lower().endswith(('.ttf', '.otf'))
    ]
    
    if not fonts:
        raise FileNotFoundError(f"No fonts found in {fonts_dir}. Please add TTF/OTF files.")

    return fonts

def generate_product_number(format_choice: str) -> str:
    """Generate a realistic product number in the specified format."""
    if format_choice == "PRD-{}-{}":
        return format_choice.format(
            str(random.randint(1000, 9999)),
            str(random.randint(1000, 9999))
        )
    elif format_choice == "SKU{}{}":
        return format_choice.format(
            str(random.randint(1000, 9999)),
            str(random.randint(1000, 9999))
        )
    else:
        return format_choice.format(
            str(random.randint(100, 999)),
            str(random.randint(100, 999)),
            str(random.randint(100, 999))
        )

def generate_sale_date() -> str:
    """Generate a random sale date string."""
    # Generate base date
    start_date = datetime.now() + timedelta(days=random.randint(-30, 30))
    end_date = start_date + timedelta(days=random.randint(3, 14))
    
    # Format components
    month = random.choice(MONTHS)
    month2 = random.choice(MONTHS) if random.random() < 0.3 else month
    
    date_format = random.choice(DATE_FORMATS)
    date_prefix = random.choice(DATE_PREFIXES) if random.random() < 0.7 else ""
    
    # Generate the date string
    date_str = date_format.format(
        month=month,
        month2=month2,
        day=start_date.day,
        day2=end_date.day,
        year=start_date.year,
        m=start_date.month,
        m2=end_date.month,
        d=start_date.day,
        d2=end_date.day,
        y=str(start_date.year)[-2:]
    )
    
    return f"{date_prefix} {date_str}".strip()

def get_text_layout(product: dict, description: str, product_number: str) -> List[str]:
    """Generate a layout for the text content."""
    # Generate sale date (50% chance)
    sale_date = generate_sale_date() if random.random() < 0.5 else None
    
    layouts = [
        # Template 1: Description first
        lambda: [
            description,
            product['name'],
            product_number,
            *([sale_date] if sale_date else [])
        ],
        # Template 2: Name first
        lambda: [
            product['name'],
            description,
            product_number,
            *([sale_date] if sale_date else [])
        ],
        # Template 3: Sale date first (when present)
        lambda: [
            *([sale_date.upper()] if sale_date else []),
            product['name'],
            description,
            product_number
        ]
    ]
    
    # Filter out None layouts and select a valid one
    valid_layouts = [layout for layout in layouts if layout() is not None]
    selected_layout = random.choice(valid_layouts)()
    
    # Ensure all elements are strings
    return [str(item) for item in selected_layout if item is not None]
