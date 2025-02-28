import os
import random
import json
import uuid
import cv2
import numpy as np
from PIL import Image, ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from datetime import datetime
import math
from concurrent.futures import ThreadPoolExecutor

def remove_background(text_img):
    # Convert PIL image to OpenCV format
    open_cv_image = np.array(text_img)
    if open_cv_image.shape[2] == 4:  # Convert RGBA to BGR
        open_cv_image = cv2.cvtColor(open_cv_image, cv2.COLOR_RGBA2BGR)
    gray = cv2.cvtColor(open_cv_image, cv2.COLOR_BGR2GRAY)
    
    # Apply adaptive thresholding to create a mask
    _, mask = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
    
    # Apply morphology to clean up noise
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    
    # Convert mask to 4-channel (alpha)
    alpha = mask.copy()
    result = cv2.merge((open_cv_image[..., 0], open_cv_image[..., 1], open_cv_image[..., 2], alpha))
    
    # Convert back to PIL format
    return Image.fromarray(result)

def add_background_items(background, items_dir, num_items=3, opacity_range=(0.6, 0.9)):
    """
    Add random background items from items_dir behind the main content.
    
    Args:
        background: PIL Image object (background image)
        items_dir: Directory containing item images
        num_items: Number of items to add
        opacity_range: Range of opacity values for items
    
    Returns:
        PIL Image with items added
    """
    # Get list of item images
    item_files = [f for f in os.listdir(items_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    if not item_files:
        return background  # No items found
    
    # Get background dimensions
    bg_width, bg_height = background.size
    
    # Create a new canvas to place items (will be underneath the text)
    canvas = background.copy()
    
    # Add random items
    num_items = min(num_items, len(item_files))
    selected_items = random.sample(item_files, num_items)
    
    for item_file in selected_items:
        item_path = os.path.join(items_dir, item_file)
        
        try:
            # Load item image
            item_img = Image.open(item_path).convert("RGBA")
            
            # Scale item (random size but not too big)
            max_scale = min(bg_width / item_img.width, bg_height / item_img.height) * 0.8
            scale = random.uniform(0.2, max_scale)
            new_width = int(item_img.width * scale)
            new_height = int(item_img.height * scale)
            item_img = item_img.resize((new_width, new_height), Image.LANCZOS)
            
            # Random rotation
            rotation = random.uniform(0, 360)
            item_img = item_img.rotate(rotation, expand=True, resample=Image.BICUBIC)
            
            # Apply random opacity
            opacity = random.uniform(*opacity_range)
            data = np.array(item_img)
            if data.shape[2] == 4:  # Has alpha channel
                data[..., 3] = data[..., 3] * opacity
                item_img = Image.fromarray(data)
            
            # Random position (ensure it's fully on the background)
            x = random.randint(0, bg_width - item_img.width)
            y = random.randint(0, bg_height - item_img.height)
            
            # Paste item onto canvas (at bottom layer)
            # Using alpha channel as mask ensures transparency
            canvas.paste(item_img, (x, y), item_img)
            
        except Exception as e:
            print(f"Error adding item {item_file}: {e}")
            continue
    
    return canvas

def check_overlap(boxes, new_box, min_distance=10):
    if not boxes:
        return False
    x1, y1, x2, y2 = new_box
    for box in boxes:
        bx1, by1, bx2, by2 = box
        if (x1 - min_distance <= bx2 and 
            x2 + min_distance >= bx1 and 
            y1 - min_distance <= by2 and 
            y2 + min_distance >= by1):
            return True
    return False

def shrink_box(box, shrink_factor=0):
    x1, y1, x2, y2 = box
    width = x2 - x1
    height = y2 - y1
    shrink_x = width * shrink_factor / 2
    shrink_y = height * shrink_factor / 2
    return [
        x1 + shrink_x, y1 + shrink_y,
        x2 - shrink_x, y2 - shrink_y
    ]

def get_corners_from_box(box):
    x1, y1, x2, y2 = box
    return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]

def create_sequential_text_section(
    text_images, 
    text_dir,
    bg_width,
    bg_height,
    scale_range,
    rotation_range,
    opacity_range,
    min_edge_distance,
    num_texts_in_section,
    existing_boxes
):
    """Create a section of sequentially stacked text in y direction"""
    # Determine section properties
    text_items = []
    placed_boxes = []
    annotations = []
    
    # Random starting position for the section
    section_width = 0
    section_height = 0
    max_attempts = 100
    
    # First, prepare all text images and calculate total height
    for j in range(num_texts_in_section):
        # Select a random text image
        text_file = random.choice(text_images)
        text_path = os.path.join(text_dir, text_file)
        
        # Load and process text image
        text_img = Image.open(text_path).convert("RGBA")
        text_img = remove_background(text_img)
        
        # Apply scale
        scale = random.uniform(*scale_range)
        new_width = int(text_img.width * scale)
        new_height = int(text_img.height * scale)
        
        if new_width < 20 or new_height < 20:
            continue
            
        text_img = text_img.resize((new_width, new_height), Image.LANCZOS)
        
        # Apply rotation (smaller range for sequential text)
        rotation = random.uniform(rotation_range[0]/2, rotation_range[1]/2)
        if rotation != 0:
            text_img = text_img.rotate(rotation, expand=True, resample=Image.BICUBIC)
        
        # Apply opacity
        opacity = random.uniform(*opacity_range)
        if opacity < 1.0:
            data = np.array(text_img)
            alpha = data[..., 3] * opacity
            data[..., 3] = alpha
            text_img = Image.fromarray(data)
        
        # Track the max width and accumulate height
        section_width = max(section_width, text_img.width)
        section_height += text_img.height + random.randint(5, 15)  # Add some spacing
        
        text_items.append(text_img)
    
    # Attempt to place the entire section
    placed = False
    section_x = 0
    section_y = 0
    
    for _ in range(max_attempts):
        # Calculate valid placement area
        valid_x_min = min_edge_distance
        valid_x_max = bg_width - section_width - min_edge_distance
        valid_y_min = min_edge_distance
        valid_y_max = bg_height - section_height - min_edge_distance
        
        # Check if section can fit
        if valid_x_max <= valid_x_min or valid_y_max <= valid_y_min:
            break
        
        # Random position for section
        section_x = random.randint(valid_x_min, valid_x_max)
        section_y = random.randint(valid_y_min, valid_y_max)
        
        # Check if section overlaps with existing boxes
        section_box = [section_x, section_y, section_x + section_width, section_y + section_height]
        if not check_overlap(existing_boxes, section_box):
            placed = True
            break
    
    if not placed:
        return [], [], []  # Failed to place section
    
    # Now place each text item in sequence
    current_y = section_y
    for text_img in text_items:
        x = section_x
        y = current_y
        current_y += text_img.height + random.randint(5, 15)  # Add spacing
        
        # Record the bounding box
        box = [x, y, x + text_img.width, y + text_img.height]
        placed_boxes.append(box)
        
        # Create annotation
        shrunk_box = shrink_box(box)
        points = get_corners_from_box(shrunk_box)
        annotation = {
            "transcription": "TEMPORARY",
            "points": points,
            "difficult": False,
            "key_cls": "None"
        }
        annotations.append((text_img, (x, y), annotation))
    
    return annotations, placed_boxes, section_box

def generate_synthetic_data(
    text_dir, 
    backgrounds_dir,
    items_dir,  # New parameter for items directory
    output_dir, 
    num_images=100, 
    max_texts_per_image=8, 
    min_texts_per_image=0,
    scale_range=(0.2, 1.0),
    rotation_range=(-10, 10),
    opacity_range=(0.8, 1.0),
    min_edge_distance=20,
    sequential_prob=0.5,  # Probability of generating sequential text section
    max_sequential_sections=3,  # Maximum number of sequential sections per image
    max_texts_per_section=6,  # Maximum texts in a sequential section
    items_prob=0.8,  # Probability of adding background items
    max_items=5  # Maximum number of background items
):
    os.makedirs(output_dir, exist_ok=True)
    text_images = [f for f in os.listdir(text_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    backgrounds = [f for f in os.listdir(backgrounds_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    
    # Check for items directory
    has_items = os.path.exists(items_dir) and os.listdir(items_dir)
    
    if not text_images or not backgrounds:
        print("Missing text or background images")
        return
        
    print(f"Found {len(text_images)} text images and {len(backgrounds)} backgrounds")
    if has_items:
        items = [f for f in os.listdir(items_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
        print(f"Found {len(items)} background item images")
    else:
        print("No items directory or no items found")
    
    annotations = {}

    def worker(i):
        if i % 10 == 0:
            print(f"Generating image {i+1}/{num_images}...")
        
        # Select background
        bg_file = random.choice(backgrounds)
        bg_path = os.path.join(backgrounds_dir, bg_file)
        background = Image.open(bg_path).convert("RGBA")
        bg_width, bg_height = background.size
        
        # Add background items first (if available and with probability)
        if has_items and random.random() < items_prob:
            num_items = random.randint(1, max_items)
            background = add_background_items(background, items_dir, num_items)
        
        # Create canvas
        composite = background.copy()
        placed_boxes = []
        image_annotations = []
        remaining_texts = random.randint(min_texts_per_image, max_texts_per_image)
        
        # Determine if we'll use sequential text sections
        use_sequential = random.random() < sequential_prob
        
        if use_sequential:
            # Determine number of sequential sections
            num_sections = random.randint(1, max_sequential_sections)
            
            # Create sequential sections
            for section_idx in range(num_sections):
                if remaining_texts <= 0:
                    break
                    
                # Decide how many texts in this section (at least 2, up to max_texts_per_section)
                texts_in_section = min(remaining_texts, random.randint(2, max_texts_per_section))
                
                # Create sequential text section
                section_annotations, section_boxes, section_box = create_sequential_text_section(
                    text_images, 
                    text_dir,
                    bg_width,
                    bg_height,
                    scale_range,
                    rotation_range,
                    opacity_range,
                    min_edge_distance,
                    texts_in_section,
                    placed_boxes
                )
                
                # If section was successfully placed
                if section_annotations:
                    # Add section box to avoid overlaps
                    placed_boxes.append(section_box)
                    
                    # Add individual boxes and paste text images
                    for text_img, position, annotation in section_annotations:
                        composite.paste(text_img, position, text_img)
                        image_annotations.append(annotation)
                        remaining_texts -= 1
        
        # Add remaining texts with random placement
        for j in range(remaining_texts):
            text_file = random.choice(text_images)
            text_path = os.path.join(text_dir, text_file)
            text_img = Image.open(text_path).convert("RGBA")
            text_img = remove_background(text_img)
            
            # Apply transformations
            scale = random.uniform(*scale_range)
            new_width = int(text_img.width * scale)
            new_height = int(text_img.height * scale)
            
            if new_width < 20 or new_height < 20:
                continue
                
            text_img = text_img.resize((new_width, new_height), Image.LANCZOS)
            
            rotation = random.uniform(*rotation_range)
            if rotation != 0:
                text_img = text_img.rotate(rotation, expand=True, resample=Image.BICUBIC)
            
            opacity = random.uniform(*opacity_range)
            if opacity < 1.0:
                data = np.array(text_img)
                alpha = data[..., 3] * opacity
                data[..., 3] = alpha
                text_img = Image.fromarray(data)
            
            # Find non-overlapping position
            max_attempts = 100
            placed = False
            
            for _ in range(max_attempts):
                valid_x_min = min_edge_distance
                valid_x_max = bg_width - text_img.width - min_edge_distance
                valid_y_min = min_edge_distance
                valid_y_max = bg_height - text_img.height - min_edge_distance
                
                if valid_x_max <= valid_x_min or valid_y_max <= valid_y_min:
                    break
                
                x = random.randint(valid_x_min, valid_x_max)
                y = random.randint(valid_y_min, valid_y_max)
                
                new_box = [x, y, x + text_img.width, y + text_img.height]
                
                if not check_overlap(placed_boxes, new_box):
                    placed_boxes.append(new_box)
                    placed = True
                    break
            
            if not placed:
                continue  # Skip if can't place without overlap
            
            # Paste the text onto the background
            composite.paste(text_img, (x, y), text_img)
            
            # Create annotation
            shrunk_box = shrink_box([x, y, x + text_img.width, y + text_img.height])
            points = get_corners_from_box(shrunk_box)
            
            annotation = {
                "transcription": "TEMPORARY",
                "points": points,
                "difficult": False,
                "key_cls": "None"
            }
            
            image_annotations.append(annotation)
        
        # Convert back to RGB for saving as JPG
        composite = composite.convert("RGB")
        
        # Save the image
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        image_filename = f"synthetic_{timestamp}_{unique_id}_{i+1}.jpg"
        save_path = os.path.join(output_dir, image_filename)
        composite.save(save_path, quality=95)
        
        return image_filename, image_annotations

    # Process images in parallel
    with ThreadPoolExecutor() as executor:
        futures = [executor.submit(worker, i) for i in range(num_images)]
        for future in futures:
            result = future.result()
            if result is not None:
                image_filename, image_annotations = result
                if image_annotations:
                    annotations[image_filename] = image_annotations

    # Write annotation files
    with open(os.path.join(output_dir, "Label.txt"), 'w', encoding='utf-8') as label_file, \
        open(os.path.join(output_dir, "Cache.cach"), 'w', encoding='utf-8') as cache_file:
        for image_filename, image_annotations in annotations.items():
            full_path = f"{output_dir}/{image_filename}"
            
            # Format the annotations to match the desired format
            formatted_annotations = []
            for annotation in image_annotations:
                formatted_annotation = {
                    "transcription": "TEMPORARY",  # Placeholder text
                    "points": annotation["points"],
                    "difficult": False,
                    "key_cls": "None"  # Keep key_cls as "None"
                }
                formatted_annotations.append(formatted_annotation)
            
            # Convert to JSON and write to files
            annotation_json = json.dumps(formatted_annotations)
            line = f"{full_path}\t{annotation_json}\n"
            label_file.write(line)
            cache_file.write(line)
    
    # Write fileState.txt
    with open(os.path.join(output_dir, "fileState.txt"), 'w', encoding='utf-8') as state_file:
        for image_filename in annotations.keys():
            full_path = f"{output_dir}/{image_filename}"
            state_file.write(f"{full_path}\t1\n")
    
    print(f"Generated {num_images} synthetic images")
    print(f"Annotations saved to {output_dir}/Label.txt and {output_dir}/Cache.cach")
    print(f"File state saved to {output_dir}/fileState.txt")

if __name__ == "__main__":
    text_dir = "text_crops"
    backgrounds_dir = "backgrounds"
    items_dir = "items"  # Directory containing item images
    output_dir = "synthetic_data"
    
    generate_synthetic_data(
        text_dir=text_dir,
        backgrounds_dir=backgrounds_dir,
        items_dir=items_dir,  # Pass items directory
        output_dir=output_dir,
        num_images=100000,
        max_texts_per_image=25,
        min_texts_per_image=20,
        scale_range=(0.3, 1.0),
        rotation_range=(-5, 5),
        opacity_range=(0.9, 1.0),
        min_edge_distance=20,
        sequential_prob=0.7,  # 70% chance of having sequential text
        max_sequential_sections=3,  # Up to 3 sequential sections per image
        max_texts_per_section=8,  # Up to 8 texts in a sequential section
        items_prob=0.8,  # 80% chance of adding background items
        max_items=10  # Maximum 5 items per background
    )