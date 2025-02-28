from concurrent.futures import ThreadPoolExecutor, as_completed
import os
import json
from typing import Dict
from image_generator import generate_image
from label_generator import save_label_files
from cropper import save_text_crop

class OCRDataGenerator:
    def __init__(self, output_dir: str = "paddle_ocr_data"):
        self.output_dir = output_dir
        self.images_dir = os.path.join(output_dir, "images")
        self.labels_dir = os.path.join(output_dir, "labels")
        self.crops_dir = os.path.join(output_dir, "crops")
        
        os.makedirs(self.images_dir, exist_ok=True)
        os.makedirs(self.labels_dir, exist_ok=True)
        os.makedirs(self.crops_dir, exist_ok=True)

    def generate_dataset(self, num_images: int = 1000):
        print(f"🚀 Generating {num_images} synthetic OCR images...")

        labels = {}
        with ThreadPoolExecutor(max_workers=30) as executor:
            futures = {executor.submit(generate_image, i, self.images_dir): i for i in range(num_images)}

            for future in as_completed(futures):
                try:
                    image_filename, label_data = future.result()
                    labels[image_filename] = label_data

                    # Our bounding boxes are already correct, so no scaling needed.
                    image_path = os.path.join(self.images_dir, image_filename)
                    save_text_crop(image_path, label_data, self.crops_dir, scale=1.0)

                except Exception as e:
                    print(f"❌ Error generating image: {str(e)}")

        save_label_files(labels, self.labels_dir)
