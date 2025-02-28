import cv2
import numpy as np
import os
import random
import json
from PIL import Image, ImageEnhance, ImageFilter, ImageOps, ImageDraw
from concurrent.futures import ThreadPoolExecutor
import argparse
from tqdm import tqdm
import copy
import math

def add_random_shapes(image, num_shapes=5, opacity_range=(0.1, 0.3)):
    """Add random geometric shapes to the background of an image."""
    # Convert to PIL Image if needed
    if isinstance(image, np.ndarray):
        image = Image.fromarray(image)
    
    # Create a copy to draw on
    canvas = image.copy()
    draw = ImageDraw.Draw(canvas, 'RGBA')
    
    width, height = canvas.size
    
    shape_types = ['rectangle', 'circle', 'polygon', 'line']
    
    for _ in range(num_shapes):
        # Pick a random shape type
        shape_type = random.choice(shape_types)
        
        # Choose a random color with transparency
        r, g, b = random.randint(0, 255), random.randint(0, 255), random.randint(0, 255)
        opacity = random.uniform(*opacity_range)
        color = (r, g, b, int(opacity * 255))
        
        # Generate shape parameters
        if shape_type == 'rectangle':
            # Random rectangle
            x1 = random.randint(0, width)
            y1 = random.randint(0, height)
            x2 = random.randint(x1, min(x1 + width//2, width))
            y2 = random.randint(y1, min(y1 + height//2, height))
            draw.rectangle([x1, y1, x2, y2], fill=color, outline=None)
        
        elif shape_type == 'circle':
            # Random circle
            center_x = random.randint(0, width)
            center_y = random.randint(0, height)
            radius = random.randint(10, min(width, height) // 6)
            draw.ellipse([center_x - radius, center_y - radius, 
                         center_x + radius, center_y + radius], 
                         fill=color, outline=None)
        
        elif shape_type == 'polygon':
            # Random polygon (3-6 sides)
            num_points = random.randint(3, 6)
            points = []
            center_x = random.randint(0, width)
            center_y = random.randint(0, height)
            max_radius = min(width, height) // 8
            
            for i in range(num_points):
                angle = i * (360 / num_points)
                radius = random.randint(max_radius // 2, max_radius)
                x = center_x + int(radius * math.cos(math.radians(angle)))
                y = center_y + int(radius * math.sin(math.radians(angle)))
                points.append((x, y))
            
            draw.polygon(points, fill=color, outline=None)
        
        elif shape_type == 'line':
            # Random line
            x1 = random.randint(0, width)
            y1 = random.randint(0, height)
            x2 = random.randint(0, width)
            y2 = random.randint(0, height)
            line_width = random.randint(1, 5)
            draw.line([x1, y1, x2, y2], fill=color, width=line_width)
    
    return canvas

def add_background_noise(image, intensity=0.03):
    """Add subtle background noise to the image."""
    # Convert to numpy array if needed
    if not isinstance(image, np.ndarray):
        img_array = np.array(image)
    else:
        img_array = image.copy()
    
    # Generate noise (reduced intensity from 0.05 to 0.03 by default)
    # This creates more subtle noise patterns
    noise = np.random.normal(0, intensity * 255, img_array.shape).astype(np.int16)
    
    # For text-heavy images, we want to preserve text clarity
    # Apply a mask to reduce noise in darker areas (likely text)
    if len(img_array.shape) == 3:  # Color image
        # Create grayscale version to identify text areas
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        # Areas with lower values (darker) get less noise
        mask = gray / 255.0
        mask = np.expand_dims(mask, axis=-1)
        mask = np.repeat(mask, 3, axis=2)  # Expand to 3 channels
        
        # Scale noise based on mask (less noise on text)
        noise = noise * (0.5 + 0.5 * mask)
    
    # Apply noise
    img_array = img_array.astype(np.int16) + noise
    img_array = np.clip(img_array, 0, 255).astype(np.uint8)
    
    if isinstance(image, Image.Image):
        return Image.fromarray(img_array)
    return img_array


def add_complex_shadows(image, num_shadows=3):
    """Add multiple complex shadows with gradient edges."""
    # Convert to numpy array if needed
    if not isinstance(image, np.ndarray):
        img_array = np.array(image)
    else:
        img_array = image.copy()
    
    height, width = img_array.shape[:2]
    
    for _ in range(num_shadows):
        # Create a shadow mask
        mask = np.zeros((height, width), dtype=np.float32)
        
        # Random shadow parameters
        shadow_type = random.choice(['radial', 'linear', 'polygon'])
        opacity = random.uniform(0.1, 0.4)  # Shadow strength
        
        if shadow_type == 'radial':
            # Radial gradient shadow
            center_x = random.randint(0, width)
            center_y = random.randint(0, height)
            max_radius = random.randint(width//6, width//2)
            
            y_indices, x_indices = np.ogrid[:height, :width]
            distance = np.sqrt((x_indices - center_x)**2 + (y_indices - center_y)**2)
            mask = np.clip(1 - (distance / max_radius), 0, 1) * opacity
        
        elif shadow_type == 'linear':
            # Linear gradient shadow
            direction = random.choice(['horizontal', 'vertical', 'diagonal'])
            
            if direction == 'horizontal':
                start = random.randint(0, width)
                width_factor = random.uniform(0.1, 0.5)
                shadow_width = int(width * width_factor)
                
                for y in range(height):
                    for x in range(width):
                        # Distance from start point
                        distance = abs(x - start)
                        if distance < shadow_width:
                            # Gradient factor
                            factor = 1 - (distance / shadow_width)
                            mask[y, x] = factor * opacity
            
            elif direction == 'vertical':
                start = random.randint(0, height)
                height_factor = random.uniform(0.1, 0.5)
                shadow_height = int(height * height_factor)
                
                for y in range(height):
                    # Distance from start point
                    distance = abs(y - start)
                    if distance < shadow_height:
                        # Gradient factor
                        factor = 1 - (distance / shadow_height)
                        mask[y, :] = factor * opacity
            
            else:  # diagonal
                start_x = random.randint(0, width)
                start_y = random.randint(0, height)
                angle = random.uniform(0, 2 * math.pi)
                shadow_length = random.randint(width//4, width//2)
                
                for y in range(height):
                    for x in range(width):
                        # Distance from line
                        dist = abs((x - start_x) * math.sin(angle) - (y - start_y) * math.cos(angle))
                        if dist < shadow_length:
                            # Gradient factor
                            factor = 1 - (dist / shadow_length)
                            mask[y, x] = factor * opacity
        
        else:  # polygon
            # Random polygon shadow
            num_points = random.randint(3, 8)
            points = []
            for _ in range(num_points):
                x = random.randint(0, width-1)
                y = random.randint(0, height-1)
                points.append((x, y))
            
            # Create polygon mask
            poly_mask = np.zeros((height, width), dtype=np.uint8)
            points_array = np.array([points], dtype=np.int32)
            cv2.fillPoly(poly_mask, points_array, 255)
            
            # Add gradient edges
            poly_mask = cv2.GaussianBlur(poly_mask, (51, 51), 0)
            mask += poly_mask / 255.0 * opacity
        
        # Apply shadow to image
        for c in range(3):  # Apply to each color channel
            img_array[:, :, c] = img_array[:, :, c] * (1 - mask)
    
    # Convert back to PIL if needed
    if isinstance(image, Image.Image):
        return Image.fromarray(img_array)
    return img_array

def transform_coordinates(points, transformation, img_shape):
    """
    Apply a transformation to bounding box coordinates.
    
    Args:
        points: List of [x, y] coordinates
        transformation: Dict containing transformation parameters
        img_shape: Original image shape (height, width)
        
    Returns:
        List of transformed points
    """
    height, width = img_shape[:2]
    transformed_points = copy.deepcopy(points)
    
    if 'perspective' in transformation:
        # Apply perspective transformation
        matrix = transformation['perspective']
        for i, point in enumerate(points):
            px, py = point
            # Apply perspective matrix
            new_x = (matrix[0][0] * px + matrix[0][1] * py + matrix[0][2]) / \
                   (matrix[2][0] * px + matrix[2][1] * py + matrix[2][2])
            new_y = (matrix[1][0] * px + matrix[1][1] * py + matrix[1][2]) / \
                   (matrix[2][0] * px + matrix[2][1] * py + matrix[2][2])
            transformed_points[i] = [new_x, new_y]
    
    if 'rotation' in transformation:
        # Apply rotation
        angle = transformation['rotation']
        center_x, center_y = width / 2, height / 2
        rad = math.radians(-angle)  # Negative because PIL and OpenCV use opposite rotation directions
        cos_val = math.cos(rad)
        sin_val = math.sin(rad)
        
        for i, point in enumerate(transformed_points):
            px, py = point
            # Translate to origin
            px -= center_x
            py -= center_y
            # Rotate
            new_x = px * cos_val - py * sin_val
            new_y = px * sin_val + py * cos_val
            # Translate back
            new_x += center_x
            new_y += center_y
            transformed_points[i] = [new_x, new_y]
    
    if 'scale' in transformation:
        # Apply scaling
        scale = transformation['scale']
        center_x, center_y = width / 2, height / 2
        
        for i, point in enumerate(transformed_points):
            px, py = point
            # Translate to origin
            px -= center_x
            py -= center_y
            # Scale
            px *= scale
            py *= scale
            # Translate back
            px += center_x
            py += center_y
            transformed_points[i] = [px, py]
    
    if 'skew' in transformation:
        # Apply skew transform
        skew_x = transformation['skew'].get('x', 0)
        skew_y = transformation['skew'].get('y', 0)
        
        for i, point in enumerate(transformed_points):
            px, py = point
            # Apply skew
            new_x = px + skew_x * py
            new_y = py + skew_y * px
            transformed_points[i] = [new_x, new_y]
    
    # Ensure coordinates are within image bounds
    for i, point in enumerate(transformed_points):
        px, py = point
        transformed_points[i] = [
            max(0, min(width - 1, px)),
            max(0, min(height - 1, py))
        ]
    
    return transformed_points

def apply_distortions_with_tracking(image, annotations, distortions=None, 
                                   add_shapes=True, add_noise=True, add_shadows=True):
    """
    Apply various distortions to an image and update coordinate annotations.
    
    Args:
        image: PIL Image object
        annotations: List of annotation dictionaries with "points", "transcription", etc.
        distortions: List of distortions to apply, or None for random selection
        add_shapes: Whether to add random shapes to the background
        add_noise: Whether to add background noise
        add_shadows: Whether to add complex shadows
    
    Returns:
        tuple: (PIL Image with distortions applied, updated annotations)
    """
    all_distortions = [
        'noise', 'blur', 'lighting', 'compression', 'shadow', 
        'color_shift', 'perspective', 'rotation', 'scale', 'skew',
        'sharpness', 'saturation'
    ]
    
    # Safe distortions that don't significantly affect coordinates
    safe_distortions = [
        'noise', 'blur', 'lighting', 'compression', 
        'shadow', 'color_shift', 'sharpness', 'saturation'
    ]
    
    # Geometric distortions that affect coordinates
    geometric_distortions = [
        'perspective', 'rotation', 'scale', 'skew'
    ]
    
    # If no distortions specified, select 1-2 random ones 
    if distortions is None:
        num_distortions = random.randint(1, 2)
        # Bias heavily toward safe distortions (90% chance for safe, 10% for geometric)
        if random.random() < 0.9:
            # Pick mostly safe distortions, maybe one geometric
            num_safe = min(num_distortions, random.randint(num_distortions - 1, num_distortions))
            num_geometric = num_distortions - num_safe
            
            distortions = random.sample(safe_distortions, num_safe)
            if num_geometric > 0:
                distortions += random.sample(geometric_distortions, num_geometric)
        else:
            # Pick any distortions
            distortions = random.sample(all_distortions, num_distortions)
    
    # Convert CV2 image to PIL if needed
    if isinstance(image, np.ndarray):
        image = Image.fromarray(image)
    
    # Get original image dimensions for coordinate transforms
    width, height = image.size
    img_shape = (height, width)
    
    # Track transformations for coordinate updates
    transformations = {}
    
    # Deep copy annotations to avoid modifying the original
    updated_annotations = copy.deepcopy(annotations)
    
    # Add background variations first (these don't affect coordinates)
    if add_shapes and random.random() < 0.7:  # 70% chance to add shapes
        # Add 2-6 random shapes with low opacity
        num_shapes = random.randint(2, 6)
        image = add_random_shapes(image, num_shapes, opacity_range=(0.05, 0.2))
    
    if add_noise and random.random() < 0.8:  # 80% chance to add noise
        # Add subtle background noise
        intensity = random.uniform(0.01, 0.05)
        img_array = np.array(image)
        img_array = add_background_noise(img_array, intensity)
        image = Image.fromarray(img_array)
    
    if add_shadows and random.random() < 0.6:  # 60% chance to add shadows
        # Add 1-3 complex shadows
        num_shadows = random.randint(1, 3)
        img_array = np.array(image)
        img_array = add_complex_shadows(img_array, num_shadows)
        image = Image.fromarray(img_array)
    
    # Apply selected distortions
    for distortion in distortions:
        if distortion == 'noise':
            # Add random noise (gentle)
            img_array = np.array(image)
            noise_type = random.choice(['gaussian', 'salt_pepper', 'speckle'])
            
            if noise_type == 'gaussian':
                # Gaussian noise (reduced sigma)
                mean = 0
                sigma = random.uniform(3, 12)
                noise = np.random.normal(mean, sigma, img_array.shape).astype(np.uint8)
                img_array = cv2.add(img_array, noise)
            
            elif noise_type == 'salt_pepper':
                # Salt and pepper noise (reduced probability)
                prob = random.uniform(0.005, 0.02)
                thres = 1 - prob
                for i in range(img_array.shape[0]):
                    for j in range(img_array.shape[1]):
                        rdn = random.random()
                        if rdn < prob:
                            img_array[i][j] = 0
                        elif rdn > thres:
                            img_array[i][j] = 255
            
            elif noise_type == 'speckle':
                # Speckle noise (reduced intensity)
                gauss = np.random.normal(0, random.uniform(0.02, 0.1), img_array.shape)
                img_array = img_array + img_array * gauss
                img_array = np.clip(img_array, 0, 255).astype(np.uint8)
            
            image = Image.fromarray(img_array)
        
        elif distortion == 'blur':
            # Apply blur (gentle)
            blur_type = random.choice(['gaussian', 'box'])
            
            if blur_type == 'gaussian':
                # Gaussian blur (reduced radius)
                radius = random.uniform(0.3, 1.5)
                image = image.filter(ImageFilter.GaussianBlur(radius))
            
            elif blur_type == 'box':
                # Box blur (smaller radius)
                radius = random.randint(1, 2)
                image = image.filter(ImageFilter.BoxBlur(radius))
        
        elif distortion == 'lighting':
            # Adjust brightness and contrast (conservative)
            brightness_factor = random.uniform(0.85, 1.15)
            contrast_factor = random.uniform(0.85, 1.15)
            
            # Apply brightness adjustment
            enhancer = ImageEnhance.Brightness(image)
            image = enhancer.enhance(brightness_factor)
            
            # Apply contrast adjustment
            enhancer = ImageEnhance.Contrast(image)
            image = enhancer.enhance(contrast_factor)
        
        elif distortion == 'compression':
            # Simulate JPEG compression artifacts (high quality)
            quality = random.randint(50, 85)
            img_array = np.array(image)
            
            # OpenCV compression
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
            result, encimg = cv2.imencode('.jpg', img_array, encode_param)
            img_array = cv2.imdecode(encimg, 1)
            
            image = Image.fromarray(img_array)
        
        elif distortion == 'shadow':
            # Add very light shadow to part of the image
            img_array = np.array(image)
            
            # Create a random polygon for the shadow
            height, width = img_array.shape[:2]
            num_points = random.randint(3, 5)
            
            # Generate random polygon points
            points = []
            for _ in range(num_points):
                x = random.randint(0, width-1)
                y = random.randint(0, height-1)
                points.append((x, y))
            
            # Create a mask from the polygon
            mask = np.zeros((height, width), dtype=np.uint8)
            points_array = np.array([points], dtype=np.int32)
            cv2.fillPoly(mask, points_array, 255)
            
            # Apply shadow by reducing brightness (very light shadow)
            shadow_intensity = random.uniform(0.75, 0.95)
            
            # Apply the shadow using the mask
            img_array = img_array.astype(np.float32)
            img_array[mask == 255] = img_array[mask == 255] * shadow_intensity
            
            img_array = np.clip(img_array, 0, 255).astype(np.uint8)
            image = Image.fromarray(img_array)
        
        elif distortion == 'color_shift':
            # Adjust color channels (small adjustments)
            img_array = np.array(image)
            
            # If grayscale, convert to RGB
            if len(img_array.shape) == 2:
                img_array = cv2.cvtColor(img_array, cv2.COLOR_GRAY2RGB)
            
            # Random color offset for each channel (reduced range)
            channels = cv2.split(img_array)
            adjusted_channels = []
            
            for channel in channels:
                offset = random.randint(-15, 15)
                adjusted = channel.astype(np.int16) + offset
                adjusted = np.clip(adjusted, 0, 255).astype(np.uint8)
                adjusted_channels.append(adjusted)
            
            img_array = cv2.merge(adjusted_channels)
            image = Image.fromarray(img_array)
        
        elif distortion == 'perspective':
            # Apply perspective transformation (gentle)
            img_array = np.array(image)
            
            # Define perspective transform parameters (reduced)
            skew_factor = random.uniform(0.02, 0.1)
            
            # Generate random offsets for corners (within skew_factor bounds)
            offsets = [
                (random.uniform(-skew_factor, 0), random.uniform(-skew_factor, 0)),  # top-left
                (random.uniform(0, skew_factor), random.uniform(-skew_factor, 0)),   # top-right
                (random.uniform(0, skew_factor), random.uniform(0, skew_factor)),    # bottom-right
                (random.uniform(-skew_factor, 0), random.uniform(0, skew_factor))    # bottom-left
            ]
            
            # Calculate source points (original corners)
            src_points = np.float32([
                [0, 0], 
                [width-1, 0], 
                [width-1, height-1], 
                [0, height-1]
            ])
            
            # Calculate destination points (moved corners)
            dst_points = np.float32([
                [int(width * offsets[0][0]), int(height * offsets[0][1])],
                [int(width * (1 + offsets[1][0])), int(height * offsets[1][1])],
                [int(width * (1 + offsets[2][0])), int(height * (1 + offsets[2][1]))],
                [int(width * offsets[3][0]), int(height * (1 + offsets[3][1]))]
            ])
            
            # Calculate perspective transform matrix
            transform_matrix = cv2.getPerspectiveTransform(src_points, dst_points)
            
            # Apply perspective transform
            img_array = cv2.warpPerspective(
                img_array, transform_matrix, (width, height),
                borderMode=cv2.BORDER_CONSTANT, borderValue=(255, 255, 255)
            )
            
            # Store transformation for coordinate updates
            transformations['perspective'] = transform_matrix
            
            image = Image.fromarray(img_array)
        
        elif distortion == 'rotation':
            # Apply very slight rotation
            angle = random.uniform(-2, 2)
            image = image.rotate(angle, resample=Image.BICUBIC, expand=False, fillcolor='white')
            
            # Store transformation for coordinate updates
            transformations['rotation'] = angle
        
        elif distortion == 'scale':
            # Very subtle scaling
            scale_factor = random.uniform(0.95, 1.05)
            width, height = image.size
            new_width = int(width * scale_factor)
            new_height = int(height * scale_factor)
            image = image.resize((new_width, new_height), Image.LANCZOS)
            
            # Resize back to original size if needed
            if scale_factor != 1.0:
                # Create a white background
                bg = Image.new('RGB', (width, height), (255, 255, 255))
                # Paste the scaled image centered
                offset_x = (width - new_width) // 2
                offset_y = (height - new_height) // 2
                bg.paste(image, (offset_x, offset_y))
                image = bg
            
            # Store transformation for coordinate updates
            transformations['scale'] = scale_factor
        
        elif distortion == 'skew':
            # Apply gentler skew transformation
            img_array = np.array(image)
            rows, cols = img_array.shape[:2]
            
            # Random skew parameters (reduced range)
            skew_type = random.choice(['horizontal', 'vertical', 'both'])
            skew_x = 0
            skew_y = 0
            
            if skew_type == 'horizontal' or skew_type == 'both':
                # Horizontal skew (reduced)
                skew_x = random.uniform(-0.1, 0.1)
                M = np.float32([[1, skew_x, 0], [0, 1, 0]])
                img_array = cv2.warpAffine(img_array, M, (cols, rows), 
                                         borderMode=cv2.BORDER_CONSTANT, 
                                         borderValue=(255, 255, 255))
            
            if skew_type == 'vertical' or skew_type == 'both':
                # Vertical skew (reduced)
                skew_y = random.uniform(-0.1, 0.1)
                M = np.float32([[1, 0, 0], [skew_y, 1, 0]])
                img_array = cv2.warpAffine(img_array, M, (cols, rows), 
                                         borderMode=cv2.BORDER_CONSTANT, 
                                         borderValue=(255, 255, 255))
            
            # Store transformation for coordinate updates
            transformations['skew'] = {'x': skew_x, 'y': skew_y}
            
            image = Image.fromarray(img_array)
        
        elif distortion == 'sharpness':
            # Adjust sharpness (conservative)
            factor = random.uniform(0.8, 1.2)
            enhancer = ImageEnhance.Sharpness(image)
            image = enhancer.enhance(factor)
        
        elif distortion == 'saturation':
            # Adjust color saturation (conservative)
            factor = random.uniform(0.9, 1.1)
            enhancer = ImageEnhance.Color(image)
            image = enhancer.enhance(factor)
    
    # Apply transformations to all annotation coordinates
    if transformations and updated_annotations:
        for i, anno in enumerate(updated_annotations):
            # Make sure we're accessing the correct structure based on your annotation format
            if isinstance(anno, dict) and 'points' in anno:
                points = anno['points']
                transformed_points = transform_coordinates(points, transformations, img_shape)
                updated_annotations[i]['points'] = transformed_points
    
    return image, updated_annotations

def preprocess_image_with_annotations(image_path, output_path, annotation_data, distortion_prob=0.5):
    """Process a single image and update its annotations."""
    try:
        # Load the image
        image = cv2.imread(image_path)
        if image is None:
            print(f"Warning: Unable to read {image_path}. Skipping.")
            return False, None
        
        # Convert to PIL image for processing
        image_pil = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
        
        # Get annotations for this image
        image_annotations = annotation_data
        
        updated_annotations = image_annotations
        
        # Apply distortions with probability
        if random.random() < distortion_prob:
            # Apply distortions and track coordinate changes
            image_pil, updated_annotations = apply_distortions_with_tracking(
                image_pil, image_annotations,
                add_shapes=True,
                add_noise=True,
                add_shadows=True
            )
        
        # Convert back to OpenCV format and save
        image_cv = cv2.cvtColor(np.array(image_pil), cv2.COLOR_RGB2BGR)
        cv2.imwrite(output_path, image_cv)
        
        return True, updated_annotations
    
    except Exception as e:
        print(f"Error processing {image_path}: {e}")
        import traceback
        traceback.print_exc()
        return False, None

def process_images_with_annotations(input_dir, output_dir, annotations_file='Label.txt', 
                                    cache_file='Cache.cach', distortion_prob=0.5, max_workers=None):
    """Process all images in a directory using thread pool."""
    # Create output directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Get list of image files
    files = [f for f in os.listdir(input_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp'))]
    
    if not files:
        print(f"No image files found in {input_dir}")
        return
    
    print(f"Found {len(files)} images to process")
    
    # Load the annotations
    annotations_path = os.path.join(input_dir, annotations_file)
    if not os.path.exists(annotations_path):
        print(f"Annotations file {annotations_path} not found")
        return
    
    # Dictionary to store image_path -> annotations mapping
    annotations_by_image = {}
    image_paths = {}
    
    try:
        with open(annotations_path, 'r') as f:
            for line in f:
                line = line.strip()
                if '\t' in line:
                    parts = line.split('\t', 1)
                    if len(parts) == 2:
                        image_path, annotations_json = parts
                        image_filename = os.path.basename(image_path)
                        image_paths[image_filename] = image_path  # Store original path
                        annotations_data = json.loads(annotations_json)
                        annotations_by_image[image_filename] = annotations_data
    except Exception as e:
        print(f"Error loading annotations: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # Set up progress tracking
    processed = 0
    success = 0
    
    # Store updated annotations
    updated_annotations = {}
    
    # Process files with thread pool
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_file = {}
        for filename in files:
            if filename in annotations_by_image:
                future = executor.submit(
                    preprocess_image_with_annotations, 
                    os.path.join(input_dir, filename),
                    os.path.join(output_dir, filename),
                    annotations_by_image[filename],
                    distortion_prob
                )
                future_to_file[future] = filename
        
        # Process as completed with progress bar
        for future in tqdm(future_to_file, total=len(future_to_file), desc="Processing images"):
            filename = future_to_file[future]
            try:
                result, new_annotations = future.result()
                processed += 1
                if result:
                    success += 1
                    if new_annotations:
                        # Preserve the original path format but update to output directory
                        if filename in image_paths:
                            original_path = image_paths[filename]
                            new_path = original_path.replace(input_dir, output_dir)
                            updated_annotations[new_path] = new_annotations
                        else:
                            # Fallback if original path not found
                            updated_annotations[os.path.join(output_dir, filename)] = new_annotations
            except Exception as e:
                print(f"Error processing {filename}: {e}")
    
    # Write updated annotations to new Label.txt file
    output_annotations_path = os.path.join(output_dir, annotations_file)
    with open(output_annotations_path, 'w') as f:
        for image_path, annotations in updated_annotations.items():
            annotations_json = json.dumps(annotations)
            f.write(f"{image_path}\t{annotations_json}\n")
    
    # Also write the same content to Cache.cach file
    output_cache_path = os.path.join(output_dir, cache_file)
    with open(output_cache_path, 'w') as f:
        for image_path, annotations in updated_annotations.items():
            annotations_json = json.dumps(annotations)
            f.write(f"{image_path}\t{annotations_json}\n")
    
    # Also generate a fileState.txt file
    output_filestate_path = os.path.join(output_dir, "fileState.txt")
    with open(output_filestate_path, 'w') as f:
        for image_path in updated_annotations.keys():
            f.write(f"{image_path}\t1\n")
            
    print(f"Processing complete: {success}/{processed} images successfully processed")
    print(f"Updated annotations saved to:")
    print(f"  - {output_annotations_path}")
    print(f"  - {output_cache_path}")
    print(f"File state saved to {output_filestate_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Process images and update annotations')
    parser.add_argument('--input', default='synthetic_data', help='Input directory containing images')
    parser.add_argument('--output', default='train_data', help='Output directory for processed images')
    parser.add_argument('--annotations', default='Label.txt', help='Annotations file name')
    parser.add_argument('--cache', default='Cache.cach', help='Cache file name')
    parser.add_argument('--distortion-prob', type=float, default=0.5, help='Probability of applying distortions')
    parser.add_argument('--workers', type=int, default=None, help='Number of worker threads')
    
    args = parser.parse_args()
    
    process_images_with_annotations(
        args.input, 
        args.output,
        annotations_file=args.annotations,
        cache_file=args.cache,
        distortion_prob=args.distortion_prob,
        max_workers=args.workers
    )