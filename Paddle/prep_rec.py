import os
import json
import cv2
import numpy as np
from tqdm import tqdm
import re

def extract_filename(path):
    """Extract filename from path without extension"""
    return os.path.splitext(os.path.basename(path))[0]

def create_dir_if_not_exists(directory):
    """Create directory if it doesn't exist"""
    if not os.path.exists(directory):
        os.makedirs(directory)
        print(f"Created directory: {directory}")

def crop_polygon(img, points):
    """Crop image based on polygon points"""
    # Convert points to numpy array
    points = np.array(points, dtype=np.int32)
    
    # Get bounding rectangle
    rect = cv2.boundingRect(points)
    x, y, w, h = rect
    
    # Crop the image
    cropped = img[y:y+h, x:x+w].copy()
    
    # Create mask
    mask = np.zeros(cropped.shape[:2], dtype=np.uint8)
    
    # Adjust points for cropped image
    points_shifted = points - np.array([x, y])
    
    # Draw polygon on mask
    cv2.fillPoly(mask, [points_shifted], 255)
    
    # Apply mask
    result = cv2.bitwise_and(cropped, cropped, mask=mask)
    
    # Get background color (assuming white)
    bg_color = (255, 255, 255)
    
    # Create white background
    bg = np.ones_like(cropped, dtype=np.uint8) * 255
    
    # Combine foreground and background
    final_result = bg.copy()
    final_result[mask == 255] = result[mask == 255]
    
    return final_result

def parse_label_file(label_file_path):
    """Parse the label file and return a dictionary of annotations"""
    annotations = {}
    current_image = None
    
    with open(label_file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split the content by image paths
    # This regex finds all patterns where a filepath is followed by a JSON array
    image_blocks = re.findall(r'([^\[\]]+?)(\[\{.*?\}\])', content, re.DOTALL)
    
    for img_path, annotations_str in image_blocks:
        img_path = img_path.strip()
        try:
            # Parse the JSON array
            json_data = json.loads(annotations_str)
            annotations[img_path] = json_data
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON for {img_path}: {e}")
            continue
    
    return annotations

def main():
    # Paths
    input_dir = "processed_img"
    output_dir = "rec_train_data"
    label_file = os.path.join(input_dir, "label.txt")
    output_gt_file = os.path.join(output_dir, "rec_gt.txt")
    
    # Create output directory
    create_dir_if_not_exists(output_dir)
    
    # Parse label file
    print("Parsing label file...")
    annotations_dict = parse_label_file(label_file)
    
    if not annotations_dict:
        print("No annotations found in the label file.")
        return
    
    print(f"Found annotations for {len(annotations_dict)} images")
    
    # Process each image and its annotations
    with open(output_gt_file, 'w', encoding='utf-8') as gt_file:
        for img_count, (img_path, annotations) in enumerate(tqdm(annotations_dict.items())):
            # Get the full image path
            if os.path.exists(img_path):
                full_img_path = img_path
            elif os.path.exists(os.path.join(input_dir, img_path)):
                full_img_path = os.path.join(input_dir, img_path)
            else:
                print(f"Image not found: {img_path}")
                continue
            
            # Read the image
            try:
                img = cv2.imread(full_img_path)
                if img is None:
                    print(f"Failed to read image: {full_img_path}")
                    continue
            except Exception as e:
                print(f"Error reading image {full_img_path}: {e}")
                continue
            
            # Process each annotation
            for i, anno in enumerate(annotations):
                if 'transcription' not in anno or not anno['transcription'].strip():
                    continue
                
                if 'points' not in anno or len(anno['points']) < 3:
                    continue
                
                # Get text and points
                text = anno['transcription'].strip()
                points = anno['points']
                
                # Generate output filename
                base_filename = extract_filename(img_path)
                out_filename = f"{base_filename}_anno{i}.jpg"
                out_path = os.path.join(output_dir, out_filename)
                
                # Crop the annotation
                try:
                    cropped = crop_polygon(img, points)
                    cv2.imwrite(out_path, cropped)
                    
                    # Write to ground truth file
                    gt_file.write(f"{out_filename}\t{text}\n")
                except Exception as e:
                    print(f"Error processing annotation {i} in {img_path}: {e}")
                    continue
    
    print(f"Processed {len(annotations_dict)} images. Results saved to {output_dir}")
    print(f"Ground truth file saved as {output_gt_file}")

if __name__ == "__main__":
    main()