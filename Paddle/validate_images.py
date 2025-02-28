import os
import sys

def check_images(rec_gt_file, train_dir):
    """
    Check how many images mentioned in rec_gt_file are present in train_dir.
    
    Args:
        rec_gt_file (str): Path to the recognition ground truth file
        train_dir (str): Path to the directory containing training images
    
    Returns:
        tuple: (found_count, total_count, list of missing images)
    """
    # Get list of files in the train directory
    try:
        train_files = set(os.listdir(train_dir))
    except FileNotFoundError:
        print(f"Error: Directory '{train_dir}' not found.")
        sys.exit(1)
    
    # Read image names from the rec_gt file
    try:
        with open(rec_gt_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f"Error: File '{rec_gt_file}' not found.")
        sys.exit(1)
    
    # Extract image names from rec_gt file
    gt_images = []
    for line in lines:
        parts = line.strip().split(' ', 1)
        if len(parts) >= 1:
            gt_images.append(parts[0])
    
    # Check which images from gt are in the train directory
    found_images = []
    missing_images = []
    
    for img in gt_images:
        if img in train_files:
            found_images.append(img)
        else:
            missing_images.append(img)
    
    # Print results
    print(f"Total images in rec_gt.txt: {len(gt_images)}")
    print(f"Images found in train1 directory: {len(found_images)}")
    print(f"Images missing from train1 directory: {len(missing_images)}")
    
    # Print percentage
    if gt_images:
        percentage = (len(found_images) / len(gt_images)) * 100
        print(f"Percentage of found images: {percentage:.2f}%")
    
    # Show first few missing images if any
    if missing_images:
        print("\nFirst 10 missing images:")
        for img in missing_images[:10]:
            print(f"  {img}")
    
    return len(found_images), len(gt_images), missing_images

if __name__ == "__main__":
    # Paths
    rec_gt_file = "rec_gt.txt"
    train_dir = "train1"
    
    # Run the check
    found_count, total_count, missing_images = check_images(rec_gt_file, train_dir)
    
    # Provide a summary
    print("\nSummary:")
    print(f"{found_count} out of {total_count} images ({found_count/total_count*100:.2f}%) from rec_gt.txt exist in the train1 directory.")