import random
import os
from PIL import Image, ImageDraw, ImageFont
import cv2
import numpy as np
from config import (
    PRODUCTS, PRICE_RANGES, PRODUCT_NUMBER_FORMATS,
    IMAGE_SETTINGS, TAG_COLORS, CENTS_OPTIONS, PRICE_SUFFIXES
)
from text_renderer import draw_text_with_bbox
from preprocessing import preprocess_image
from utils import load_fonts, generate_product_number
from price_generator import create_price_fonts

# Load fonts globally to ensure consistency
FONTS = load_fonts("data/fonts")

def rotate_text(draw, text, font, x, y, angle, color, is_price=False):
    """Draw rotated text with optional price formatting and return corner coordinates."""
    print(f"🌀 Rotating text '{text}' by {angle:.2f}° at ({x}, {y})")

    # Convert color to RGB
    if isinstance(color, str):
        color = tuple(int(color.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))

    # Special handling for price text
    if is_price:
        # Split into components
        parts = text.split()
        main_part = parts[0]  # "123.45"
        suffix = parts[1] if len(parts) > 1 else ""  # "EA."
        
        dollars, cents = main_part.split('.')
        
        # Measure components
        dollars_bbox = draw.textbbox((0, 0), dollars, font=font)
        cents_bbox = draw.textbbox((0, 0), "." + cents, font=font)
        suffix_bbox = draw.textbbox((0, 0), suffix, font=font) if suffix else (0, 0, 0, 0)
        
        # Calculate dimensions for layout
        dollars_w = dollars_bbox[2] - dollars_bbox[0]
        dollars_h = dollars_bbox[3] - dollars_bbox[1]
        cents_w = cents_bbox[2] - cents_bbox[0]
        cents_h = cents_bbox[3] - cents_bbox[1]
        
        # Create temporary image slightly larger than needed
        padding = 4
        temp_w = dollars_w + cents_w + padding
        temp_h = dollars_h + padding
        text_layer = Image.new('RGB', (temp_w, temp_h), (255, 255, 255))
        text_draw = ImageDraw.Draw(text_layer)
        
        # Draw components
        text_draw.text((padding//2, padding//2), dollars, font=font, fill=color)
        text_draw.text((padding//2 + dollars_w, 0), "." + cents, font=font, fill=color)
        if suffix:
            text_draw.text((padding//2 + dollars_w, dollars_h//2), suffix, font=font, fill=color)
    else:
        # Regular text handling
        text_bbox = draw.textbbox((0, 0), text, font=font)
        text_w = text_bbox[2] - text_bbox[0]
        text_h = text_bbox[3] - text_bbox[1]
        
        padding = 4
        temp_w = text_w + padding
        temp_h = text_h + padding
        text_layer = Image.new('RGB', (temp_w, temp_h), (255, 255, 255))
        text_draw = ImageDraw.Draw(text_layer)
        text_draw.text((padding//2, padding//2), text, font=font, fill=color)

    # Rotate text layer
    rotated_txt = text_layer.rotate(-angle, expand=True, fillcolor=(255, 255, 255))
    rotated_w, rotated_h = rotated_txt.size

    # Calculate paste position
    paste_x = int(x - rotated_w / 2)
    paste_y = int(y - rotated_h / 2)

    # Create mask for transparency
    mask = rotated_txt.convert('L')
    threshold = 200
    mask = mask.point(lambda p: p < threshold and 255)

    # Paste rotated text
    draw._image.paste(rotated_txt, (paste_x, paste_y), mask)

    # Calculate bounding box
    angle_rad = np.radians(angle)
    cos_a, sin_a = np.cos(angle_rad), np.sin(angle_rad)

    # Use text dimensions for tight box
    text_w = rotated_txt.size[0] - padding
    text_h = rotated_txt.size[1] - padding
    half_w = text_w / 2
    half_h = text_h / 2

    # Calculate corners
    corners = np.array([
        [-half_w, -half_h],  # top-left
        [half_w, -half_h],   # top-right
        [half_w, half_h],    # bottom-right
        [-half_w, half_h]    # bottom-left
    ])

    # Apply rotation
    rotation_matrix = np.array([[cos_a, -sin_a], [sin_a, cos_a]])
    rotated_corners = np.dot(corners, rotation_matrix.T)

    # Translate to position
    rotated_corners[:, 0] += x
    rotated_corners[:, 1] += y

    # Convert to integer coordinates
    polygon_points = [(int(x), int(y)) for x, y in rotated_corners]
    
    # Calculate bbox
    bbox = [
        int(rotated_corners[:, 0].min()),
        int(rotated_corners[:, 1].min()),
        int(rotated_corners[:, 0].max()),
        int(rotated_corners[:, 1].max())
    ]

    return bbox, polygon_points

def generate_image(index: int, images_dir: str):
    """Generate a synthetic OCR image with rotated text & updated bounding boxes."""
    print(f"\n🖼 Generating image {index}...")

    product = random.choice(PRODUCTS)
    description = random.choice(product["descriptions"])
    product_number = generate_product_number(random.choice(PRODUCT_NUMBER_FORMATS))

    # Generate price components
    price = round(random.uniform(0, 2000), 2)
    dollars = str(int(price))
    cents = random.choice(CENTS_OPTIONS)
    suffix = random.choice(PRICE_SUFFIXES)

    # Image dimensions
    width = random.randint(*IMAGE_SETTINGS["width_range"])
    height = random.randint(*IMAGE_SETTINGS["height_range"])
    print(f"📏 Image Size: {width}x{height}")

    # Create background image
    image = Image.new("RGB", (width, height), TAG_COLORS["background"])
    draw = ImageDraw.Draw(image)

    # Font setup
    font_path = random.choice(FONTS)
    base_font_size = random.randint(*IMAGE_SETTINGS["font_size_range"])
    try:
        fonts = create_price_fonts(font_path, base_font_size)
    except IOError:
        print(f"❌ Error loading font {font_path}")
        fonts = {k: ImageFont.load_default() for k in ['dollar', 'cents', 'only', 'product']}

    # Rotation angle
    angle = random.uniform(-15, 15)
    print(f"🔄 Rotation Angle: {angle:.2f}°")

    text_regions = []

    # Draw price
    price_text = f"{dollars}.{cents} {suffix}"
    price_x, price_y = width // 2, height // 3
    price_bbox, price_polygon = rotate_text(draw, price_text, fonts["dollar"], 
                                          price_x, price_y, angle, TAG_COLORS["text"],
                                          is_price=True)

    if len(price_bbox) == 4:
        text_regions.append({
            "text": price_text,
            "bbox": list(price_bbox),
            "polygon": price_polygon
        })

    # Draw description
    desc_x, desc_y = width // 2, height // 2
    desc_bbox, desc_polygon = rotate_text(draw, description, fonts["product"],
                                        desc_x, desc_y, angle, TAG_COLORS["text"])

    if len(desc_bbox) == 4:
        text_regions.append({
            "text": description,
            "bbox": list(desc_bbox),
            "polygon": desc_polygon
        })

    # Draw product name
    name_x, name_y = width // 2, height // 1.3
    name_bbox, name_polygon = rotate_text(draw, product["name"], fonts["product"],
                                        name_x, name_y, angle, TAG_COLORS["text"])

    if len(name_bbox) == 4:
        text_regions.append({
            "text": product["name"],
            "bbox": list(name_bbox),
            "polygon": name_polygon
        })

    print(f"📋 Final Bounding Boxes: {text_regions}")

    # Save image
    image_filename = f"ocr_train_{index:06d}.jpg"
    image_path = os.path.join(images_dir, image_filename)
    image.save(image_path, quality=95)
    print(f"💾 Image saved: {image_filename}")

    # Build label data
    label_data = {
        "text": f"{dollars}.{cents} {suffix}",
        "product_name": product["name"],
        "description": description,
        "product_number": product_number,
        "image_size": [width, height],
        "regions": text_regions
    }

    return image_filename, label_data