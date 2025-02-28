import os
import shutil
import collections

def collect_samples(rec_gt_file, train_dir, output_dir):
    """
    Collect the 100th image of each letter from the dataset and its corresponding label.
    
    Args:
        rec_gt_file (str): Path to the recognition ground truth file
        train_dir (str): Path to the directory containing training images
        output_dir (str): Path to the output directory to save results
    """
    # Create output directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Read image names and labels from the rec_gt file
    with open(rec_gt_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Group images by their first letter
    letter_images = collections.defaultdict(list)
    
    for line in lines:
        parts = line.strip().split(' ', 1)
        if len(parts) < 2:
            continue
            
        image_name, label = parts
        # Get the first letter of the image name (assuming format like a0.jpg, a1.jpg, b0.jpg, etc.)
        if image_name and len(image_name) > 0:
            first_letter = image_name[0].lower()
            letter_images[first_letter].append((image_name, label))
    
    # Prepare the output file for labels
    output_labels_file = os.path.join(output_dir, "labels.txt")
    collected_images = []
    
    # Collect the 100th image for each letter
    with open(output_labels_file, 'w', encoding='utf-8') as out_file:
        for letter, images in letter_images.items():
            # Check if there are at least 100 images for this letter
            if len(images) >= 100:
                # Get the 100th image (index 99)
                image_name, label = images[99]
                source_path = os.path.join(train_dir, image_name)
                
                # Check if the image exists in the train directory
                if os.path.exists(source_path):
                    # Copy the image to the output directory
                    dest_path = os.path.join(output_dir, image_name)
                    shutil.copy2(source_path, dest_path)
                    
                    # Write the label to the output file
                    out_file.write(f"{image_name} {label}\n")
                    
                    collected_images.append((letter, image_name, label))
                    print(f"Collected {letter}'s 100th image: {image_name} with label: {label}")
                else:
                    print(f"Warning: Image {image_name} not found in {train_dir}")
            else:
                print(f"Not enough images for letter {letter}: {len(images)} found, need 100")
    
    # Print summary
    print("\nSummary:")
    print(f"Total letters processed: {len(letter_images)}")
    print(f"Letters with 100+ images: {len(collected_images)}")
    print(f"Images collected: {len(collected_images)}")
    print(f"Results saved to: {output_dir}")
    print(f"Labels saved to: {output_labels_file}")
    
    # Print collected images
    if collected_images:
        print("\nCollected images:")
        for letter, image, label in collected_images:
            print(f"  Letter {letter}: {image} - {label}")

if __name__ == "__main__":
    # Paths
    rec_gt_file = "rec_gt.txt"
    train_dir = "train1"
    output_dir = "results"
    
    # Run the collection
    collect_samples(rec_gt_file, train_dir, output_dir)