import cv2
import numpy as np
import os
from PIL import ImageEnhance, Image
from concurrent.futures import ThreadPoolExecutor

def preprocess_image(image_path, output_path):
    # Load image
    image = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    
    # Check if image was loaded successfully
    if image is None:
        print(f"Warning: Unable to read {image_path}. Skipping.")
        return
    
    # Resize to improve OCR accuracy (optional, adjust based on needs)
    scale_factor = 1  # Scale up for better OCR
    height, width = image.shape[:2]
    image = cv2.resize(image, (width * scale_factor, height * scale_factor), interpolation=cv2.INTER_CUBIC)
    
    # Apply contrast enhancement
    pil_image = Image.fromarray(image)
    enhancer = ImageEnhance.Contrast(pil_image)
    image = np.array(enhancer.enhance(2.0))  # Increase contrast
    
    # Apply histogram equalization for better contrast
    image = cv2.equalizeHist(image)
    
    # Apply a slight Gaussian blur to reduce noise
    image = cv2.GaussianBlur(image, (3, 3), 0)
    
    # Save processed image
    cv2.imwrite(output_path, image)
    print(f"Processed image saved to {output_path}")

def process_all_images(input_dir, output_dir):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    files = [f for f in os.listdir(input_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    
    with ThreadPoolExecutor() as executor:
        for filename in files:
            input_path = os.path.join(input_dir, filename)
            output_path = os.path.join(output_dir, filename)
            executor.submit(preprocess_image, input_path, output_path)

# Example usage
project_dir = "train_data"
output_dir = "train90"
process_all_images(project_dir, output_dir)
