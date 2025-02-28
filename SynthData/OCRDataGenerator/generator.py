from concurrent.futures import ThreadPoolExecutor, as_completed
import os
import random
import json
from typing import Tuple, Dict, List
from PIL import Image, ImageDraw, ImageFont
import cv2
import numpy as np

from config import (
    PRODUCTS, PRICE_RANGES, PRODUCT_NUMBER_FORMATS,
    IMAGE_SETTINGS, TAG_COLORS, CENTS_OPTIONS, PRICE_SUFFIXES
)
from image_generator import FONTS
from utils import load_fonts, generate_product_number, get_text_layout
from preprocessing import preprocess_image

class OCRDataGenerator:
    def __init__(self, output_dir: str = "paddle_ocr_data"):
        """Initialize the OCR data generator with configuration."""
        self.output_dir = output_dir
        self.images_dir = os.path.join(output_dir, "images")
        self.labels_dir = os.path.join(output_dir, "labels")
        self.crops_dir = os.path.join(output_dir, "crops")
        
        # Create necessary directories
        os.makedirs(self.images_dir, exist_ok=True)
        os.makedirs(self.labels_dir, exist_ok=True)
        os.makedirs(self.crops_dir, exist_ok=True)
        
        # Load fonts from directory
        self.fonts_dir = "data/fonts"
        self.fonts = load_fonts(self.fonts_dir)
        
        # Initialize text regions dictionary
        self.text_regions = {}
        self.current_regions = []

    def draw_text_with_bbox(self, draw, text: str, font: ImageFont.FreeTypeFont, x: int, y: int, color) -> dict:
        try:
            bbox = draw.textbbox((0, 0), text, font=font)
        except AttributeError:
            # Fallback for older PIL versions
            bbox = (0, 0, *draw.textsize(text, font=font))

        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]

        draw.text((x, y), text, fill=color, font=font)

        region = {
            'text': text,
            'points': [
                [x, y],
                [x + text_width, y],
                [x + text_width, y + text_height],
                [x, y + text_height]
            ]
        }

        self.current_regions.append(region)
        return region

    def generate_image(index: int, images_dir: str):
        """Generate a synthetic OCR image matching the original style."""
        
        # Select product details
        product = random.choice(PRODUCTS)
        description = random.choice(product["descriptions"])
        product_number = generate_product_number(random.choice(PRODUCT_NUMBER_FORMATS))

        price = round(random.uniform(0, 2000), 2)
        dollars = int(price)
        use_decimal = random.choice([True, False])
        cents_text = random.choice(CENTS_OPTIONS)
        suffix = random.choice(PRICE_SUFFIXES)

        # Ensure the price text remains correctly formatted
        if use_decimal:
            price_text = f"{dollars}.{cents_text} {suffix}"
        else:
            price_text = f"{dollars}{cents_text} {suffix}"

        # Set image size
        width = random.randint(*IMAGE_SETTINGS["width_range"])
        height = random.randint(*IMAGE_SETTINGS["height_range"])

        # Create background image
        image = Image.new("RGB", (width, height), TAG_COLORS["background"])
        draw = ImageDraw.Draw(image)

        # Select a font
        font_path = random.choice(FONTS)
        base_font_size = random.randint(*IMAGE_SETTINGS["font_size_range"])

        try:
            size_ratio = IMAGE_SETTINGS["price_size_ratio"]
            price_font = ImageFont.truetype(font_path, int(base_font_size * size_ratio["dollar"]))
            cents_font = ImageFont.truetype(font_path, int(base_font_size * size_ratio["cents"]))
            suffix_font = ImageFont.truetype(font_path, int(base_font_size * size_ratio["only"]))
            product_font = ImageFont.truetype(font_path, int(base_font_size * size_ratio["product"]))
        except IOError:
            print(f"Error loading font {font_path}")
            price_font = cents_font = suffix_font = product_font = ImageFont.load_default()

        # Calculate text positioning
        dollar_width, dollar_height = draw.textsize(str(dollars), font=price_font)
        cents_width, cents_height = draw.textsize(cents_text, font=cents_font)
        suffix_width, suffix_height = draw.textsize(suffix, font=suffix_font)

        # Place dollar at center
        total_price_width = dollar_width + cents_width + suffix_width
        price_x = (width - total_price_width) // 2
        price_y = height // 3

        # Draw price parts separately to keep correct alignment
        draw.text((price_x, price_y), str(dollars), font=price_font, fill=TAG_COLORS["text"])
        draw.text((price_x + dollar_width, price_y + (dollar_height - cents_height) // 2), cents_text, font=cents_font, fill=TAG_COLORS["text"])
        draw.text((price_x + dollar_width + cents_width + 5, price_y), suffix, font=suffix_font, fill=TAG_COLORS["text"])

        price_region = {
            "text": price_text,
            "points": [
                [price_x, price_y],
                [price_x + total_price_width, price_y],
                [price_x + total_price_width, price_y + dollar_height],
                [price_x, price_y + dollar_height]
            ]
        }

        # Draw product info below price
        text_regions = [price_region]
        current_y = price_y + dollar_height + 30

        for text in [description, product["name"], product_number]:
            text_width, text_height = draw.textsize(text, font=product_font)
            text_x = (width - text_width) // 2

            draw.text((text_x, current_y), text, font=product_font, fill=TAG_COLORS["text"])
            
            region = {
                "text": text,
                "points": [
                    [text_x, current_y],
                    [text_x + text_width, current_y],
                    [text_x + text_width, current_y + text_height],
                    [text_x, current_y + text_height]
                ]
            }
            text_regions.append(region)
            current_y += text_height + 20

        # Apply preprocessing and save
        image = preprocess_image(image)
        image_filename = f"ocr_train_{index:06d}.jpg"
        image_path = os.path.join(images_dir, image_filename)
        image.save(image_path, quality=95)

        return image_filename, {
            "text": price_text,
            "product_name": product["name"],
            "description": description,
            "product_number": product_number,
            "image_size": [width, height]
        }


    def save_text_crop(self, image_path: str, region: dict, index: int):
        """Save precise crop of text region."""
        try:
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError(f"Could not load image: {image_path}")

            points = np.array(region['points'], dtype=np.int32)
            pad = 5  
            
            # Ensure bounding box remains within image dimensions
            x_min = max(0, min(points[:, 0].min() - pad, image.shape[1] - 1))
            y_min = max(0, min(points[:, 1].min() - pad, image.shape[0] - 1))
            x_max = max(0, min(points[:, 0].max() + pad, image.shape[1] - 1))
            y_max = max(0, min(points[:, 1].max() + pad, image.shape[0] - 1))

            if x_max <= x_min or y_max <= y_min:
                print(f"Warning: Invalid bounding box for '{region['text']}'")
                return  

            crop = image[y_min:y_max, x_min:x_max].copy()
            
            base_name = os.path.splitext(os.path.basename(image_path))[0]
            clean_text = "".join(c if c.isalnum() else "_" for c in region['text'])[:30]
            filename = f"{base_name}_{index}_{clean_text}.jpg"
            output_path = os.path.join(self.crops_dir, filename)
            cv2.imwrite(output_path, crop)

        except Exception as e:
            print(f"Error saving crop for '{region['text']}': {str(e)}")

    def save_label_files(self, labels: Dict):
        """Save labels and crops."""
        # Save fileState.txt
        filestate_path = os.path.join(self.output_dir, "fileState.txt")
        with open(filestate_path, 'w', encoding='utf-8') as f:
            for filename in labels.keys():
                f.write(f"{filename}\t1\n")
        
        # Save Label.txt and create crops
        label_path = os.path.join(self.output_dir, "Label.txt")
        with open(label_path, 'w', encoding='utf-8') as f:
            for filename, label_data in labels.items():
                # Get the image path
                image_path = os.path.join(self.images_dir, filename)
                regions = self.text_regions[filename]
                
                # Save each text region as a crop
                for i, region in enumerate(regions):
                    self.save_text_crop(image_path, region, i)
                
                # Write to label file
                f.write(f"{filename}\t{json.dumps(regions)}\n")

    def generate_dataset(self, num_images: int = 1000):
        print(f"Generating {num_images} synthetic OCR images...")

        labels = {}

        with ThreadPoolExecutor(max_workers=30) as executor:
            futures = {executor.submit(self.generate_image, i): i for i in range(num_images)}

            for future in as_completed(futures):
                try:
                    image_filename, label_data = future.result()
                    labels[image_filename] = label_data
                except Exception as e:
                    print(f"Error generating image: {str(e)}")

        self.save_label_files(labels)
