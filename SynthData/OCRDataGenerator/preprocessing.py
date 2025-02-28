import cv2
import numpy as np
import os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
from tqdm import tqdm
from PIL import Image
import random

def transform_bboxes_2x3(regions, M):
    """
    Apply a 2x3 affine matrix M to each region's bounding box.
    regions: list of dicts with {"text": ..., "bbox": [x_min, y_min, x_max, y_max]}
    M: 2x3 matrix used in cv2.warpAffine.
    Returns a new list of region dicts with updated bounding boxes.
    """
    new_regions = []
    print("\n🔄 Transforming Bounding Boxes with Matrix:\n", M)

    for region in regions:
        x_min, y_min, x_max, y_max = region["bbox"]

        # Ensure input bbox has 4 values
        if len(region["bbox"]) != 4:
            print(f"❌ ERROR: Invalid bbox {region['bbox']}, skipping...")
            continue

        print(f"🔹 Before Transformation: {region['bbox']} for text '{region['text']}'")

        # Define four corners
        corners = np.array([
            [x_min, y_min],
            [x_max, y_min],
            [x_max, y_max],
            [x_min, y_max]
        ], dtype=np.float32).reshape(1, -1, 2)

        # Apply the affine transform
        transformed = cv2.transform(corners, M)  # shape (1,4,2)
        transformed = transformed[0]             # shape (4,2)

        # Compute new bounding box
        xs = transformed[:, 0]
        ys = transformed[:, 1]
        x_min_new, x_max_new = xs.min(), xs.max()
        y_min_new, y_max_new = ys.min(), ys.max()

        # Ensure bbox always has 4 values
        new_bbox = [int(x_min_new), int(y_min_new), int(x_max_new), int(y_max_new)]
        print(f"✅ After Transformation: {new_bbox}")

        new_regions.append({
            "text": region["text"],
            "bbox": new_bbox
        })
    
    return new_regions

def preprocess_image(image, regions=None):
    """
    Preprocess an image for OCR optimization while ensuring bounding boxes stay valid.
    Returns (result_pil, new_regions).
    """
    was_pil = isinstance(image, Image.Image)
    
    # Convert PIL to CV2 if needed
    if was_pil:
        image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

    height, width = image.shape[:2]
    print(f"\n🖼 Preprocessing Image (Size: {width}x{height})")

    # ----------------- STEP 1: SCALE IMAGE -----------------
    scale_factor = random.uniform(1.2, 1.8)
    print(f"🔄 Scaling Image by Factor: {scale_factor:.2f}")

    new_width = int(width * scale_factor)
    new_height = int(height * scale_factor)

    M_scale = np.array([
        [scale_factor, 0,           0],
        [0,            scale_factor, 0]
    ], dtype=np.float32)

    scaled = cv2.warpAffine(image, M_scale, (new_width, new_height), flags=cv2.INTER_LINEAR)

    if regions:
        regions = transform_bboxes_2x3(regions, M_scale)

    # ----------------- STEP 2: SHEAR (Fix for Bounding Boxes) -----------------
    if random.random() < 0.05:
        shear_x = random.uniform(-0.02, 0.02)
        shear_y = random.uniform(-0.02, 0.02)
        print(f"📐 Applying Shear: X={shear_x:.3f}, Y={shear_y:.3f}")

        M_shear = np.array([
            [1,       shear_x, 0],
            [shear_y,   1,     0]
        ], dtype=np.float32)

        border_size = 20
        warped = cv2.warpAffine(scaled, M_shear, (new_width + border_size, new_height + border_size),
                                flags=cv2.INTER_LINEAR, borderValue=(255, 255, 255))

        if regions:
            regions = transform_bboxes_2x3(regions, M_shear)

        scaled = warped

    # ----------------- STEP 3: Binarization -----------------
    gray = cv2.cvtColor(scaled, cv2.COLOR_BGR2GRAY)

    if random.random() < 0.5:
        print("⚪ Applying Adaptive Thresholding")
        binary = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                       cv2.THRESH_BINARY, 15, 5)
    else:
        print("⚫ Keeping Grayscale Image for OCR")
        binary = gray  # Keep original grayscale for better OCR detection

    result_pil = Image.fromarray(binary)
    print("✅ Image Preprocessing Complete")

    return result_pil, regions if regions else []

class OCRPreprocessor:
    def __init__(self, target_dpi=300, num_threads=10):
        self.target_dpi = target_dpi
        self.supported_formats = ('.png', '.jpg', '.jpeg', '.tiff', '.bmp')
        self.num_threads = num_threads
        self.print_lock = Lock()
        self.processed_count = 0
        self.error_count = 0
        self.count_lock = Lock()

    def process_image(self, image_path, output_dir):
        """Process image for OCR and save it."""
        try:
            image_path = Path(image_path)
            print(f"\n🔍 Processing Image: {image_path.name}")
            image = cv2.imread(str(image_path))

            if image is None:
                raise ValueError(f"Could not load image: {image_path}")

            # Process the image
            result_pil, _ = preprocess_image(image, regions=None)

            # Save the processed image
            output_path = Path(output_dir) / f"{image_path.stem}.png"
            output_path.parent.mkdir(parents=True, exist_ok=True)
            result_pil.save(str(output_path))

            with self.count_lock:
                self.processed_count += 1

            print(f"✅ Successfully Processed: {image_path.name}")

            return True

        except Exception as e:
            with self.count_lock:
                self.error_count += 1
            print(f"❌ Error processing {image_path.name}: {str(e)}")
            return False
    
    def process_directory(self, input_dir, output_dir):
        """Process all supported images in a directory using multiple threads."""
        input_path = Path(input_dir)
        output_path = Path(output_dir)
        
        output_path.mkdir(parents=True, exist_ok=True)
        
        image_paths = []
        for ext in self.supported_formats:
            image_paths.extend(list(input_path.glob(f"*{ext}")))

        total_images = len(image_paths)
        if total_images == 0:
            print("🚨 No images found to process!")
            return
        
        print(f"\n🚀 Processing {total_images} images using {self.num_threads} threads...\n")

        with ThreadPoolExecutor(max_workers=self.num_threads) as executor:
            futures = {
                executor.submit(self.process_image, img_path, output_dir): img_path
                for img_path in image_paths
            }
            
            with tqdm(total=total_images, desc="Processing Images") as pbar:
                for future in as_completed(futures):
                    pbar.update(1)

        print(f"\n✅ Processing complete!")
        print(f"✅ Successfully processed: {self.processed_count} images")
        if self.error_count > 0:
            print(f"❌ Errors encountered: {self.error_count} images")

if __name__ == "__main__":
    base_dir = Path(os.path.abspath(os.path.dirname(__file__))).parent.parent
    
    input_dir = base_dir / "sharp_images"
    output_dir = base_dir / "output" / "processed_img"
    
    preprocessor = OCRPreprocessor(num_threads=10)
    preprocessor.process_directory(input_dir, output_dir)
