import os

# Define paths
reference_dir = './data/yolo_checkpoints/test_results/sale_detector_test'
image_dir = './data/sale_item_detector/imgs'

# Get the set of image filenames (without extensions) from the reference directory
reference_images = set(os.path.splitext(f)[0] for f in os.listdir(reference_dir) if f.endswith(('.jpg', '.png', '.jpeg')))

# Track deleted files
deleted_count = 0

# Iterate over images in the target directory and delete if not in the reference set
for image_file in os.listdir(image_dir):
    if image_file.endswith(('.jpg', '.png', '.jpeg')):
        image_name = os.path.splitext(image_file)[0]
        if image_name not in reference_images:
            image_path = os.path.join(image_dir, image_file)
            os.remove(image_path)
            deleted_count += 1

print(f"Total number of deleted images: {deleted_count}")
