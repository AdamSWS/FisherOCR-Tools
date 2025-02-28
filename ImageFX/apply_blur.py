import os
import random
import cv2
import glob

# Directory containing processed images
PROCESSED_DIR = "./processed"

# Probability of applying blur (20%)
BLUR_PROBABILITY = 0.2

# Supported image formats
SUPPORTED_FORMATS = ["jpg", "jpeg", "png"]

def apply_random_blur(image_path: str):
    """Apply a random blur effect to an image and overwrite it."""
    try:
        img = cv2.imread(image_path)

        if img is None:
            print(f"Skipping {image_path}: Unable to read image.")
            return
        
        # Randomly choose blur intensity
        blur_intensity = random.choice([3, 5, 7, 9])  # Must be an odd number
        
        # Apply Gaussian blur
        blurred_img = cv2.GaussianBlur(img, (blur_intensity, blur_intensity), 0)
        
        # Overwrite the original image
        cv2.imwrite(image_path, blurred_img)
        print(f"Blurred {image_path} with intensity {blur_intensity}")

    except Exception as e:
        print(f"Error processing {image_path}: {str(e)}")

def process_images():
    """Apply blur to a subset of images in the processed directory."""
    image_files = []
    
    # Collect all images from the processed directory
    for ext in SUPPORTED_FORMATS:
        image_files.extend(glob.glob(os.path.join(PROCESSED_DIR, f"*.{ext}")))

    # Shuffle images randomly
    random.shuffle(image_files)

    # Select 20% of the images to apply blur
    num_to_blur = int(len(image_files) * BLUR_PROBABILITY)
    selected_images = random.sample(image_files, num_to_blur)

    print(f"Total images: {len(image_files)}, Applying blur to: {num_to_blur} images")

    # Apply blur to selected images
    for image_path in selected_images:
        apply_random_blur(image_path)

if __name__ == "__main__":
    process_images()
