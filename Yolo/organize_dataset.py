import os
import shutil
from pathlib import Path

class DatasetOrganizer:
    def __init__(self):
        self.project_root = os.path.abspath('/Users/adamshaar/Desktop/sale_item_detector')
        self.data_dir = os.path.join(self.project_root, 'data')
        self.raw_images_dir = os.path.join(self.data_dir, 'images')  # Your scraped images
        self.training_dir = os.path.join(self.data_dir, 'training_data', 'circulars_for_yolo')
        
        # Create YOLO structure
        self.train_images_dir = os.path.join(self.data_dir, 'images', 'train')
        os.makedirs(self.train_images_dir, exist_ok=True)
        
        print("Directories:")
        print(f"Raw images: {self.raw_images_dir}")
        print(f"Training dir: {self.training_dir}")
        print(f"Target train images: {self.train_images_dir}")
        
    def organize_dataset(self):
        """Organize the dataset by copying labeled images to training directory"""
        label_dir = os.path.join(self.training_dir, 'labels', 'train')
        stats = {'copied': 0, 'missing': 0, 'total_labels': 0}
        
        # Get list of files
        label_files = [f for f in os.listdir(label_dir) if f.endswith('.txt')]
        stats['total_labels'] = len(label_files)
        print(f"\nFound {stats['total_labels']} label files")
        
        # Process each label file
        for label_file in label_files:
            image_id = os.path.splitext(label_file)[0]
            src_path = os.path.join(self.raw_images_dir, f"{image_id}.jpg")
            dst_path = os.path.join(self.train_images_dir, f"{image_id}.jpg")
            
            if os.path.exists(src_path):
                # Copy image if not already in train directory
                if not os.path.exists(dst_path):
                    shutil.copy2(src_path, dst_path)
                stats['copied'] += 1
            else:
                print(f"Missing image: {image_id}.jpg")
                stats['missing'] += 1
                
        return stats
    
    def create_dataset_yaml(self):
        """Create YOLO dataset configuration"""
        dataset_config = {
            'path': self.data_dir,
            'train': os.path.join('images', 'train'),
            'val': os.path.join('images', 'train'),  # Using same data for validation
            'names': {
                0: 'sale_date',
                1: 'sale_item_info',
                2: 'promotions'
            },
            'nc': 3
        }
        
        yaml_path = os.path.join(self.training_dir, 'dataset.yaml')
        with open(yaml_path, 'w') as f:
            import yaml
            yaml.safe_dump(dataset_config, f, sort_keys=False)
        
        print(f"\nCreated dataset.yaml at: {yaml_path}")
        
    def verify_dataset(self):
        """Verify the final dataset structure"""
        train_dir = self.train_images_dir
        label_dir = os.path.join(self.training_dir, 'labels', 'train')
        
        images = set(f[:-4] for f in os.listdir(train_dir) if f.endswith('.jpg'))
        labels = set(f[:-4] for f in os.listdir(label_dir) if f.endswith('.txt'))
        
        print("\nDataset verification:")
        print(f"Images in train directory: {len(images)}")
        print(f"Label files: {len(labels)}")
        print(f"Matched pairs: {len(images & labels)}")
        
        if images != labels:
            unmatched_images = images - labels
            unmatched_labels = labels - images
            if unmatched_images:
                print(f"\nImages without labels ({len(unmatched_images)}):")
                for img in list(unmatched_images)[:5]:
                    print(f"  - {img}.jpg")
            if unmatched_labels:
                print(f"\nLabels without images ({len(unmatched_labels)}):")
                for lbl in list(unmatched_labels)[:5]:
                    print(f"  - {lbl}.txt")

def main():
    print("Starting dataset organization...")
    organizer = DatasetOrganizer()
    
    # Organize the dataset
    stats = organizer.organize_dataset()
    print(f"\nOrganization complete:")
    print(f"Total labels: {stats['total_labels']}")
    print(f"Images copied: {stats['copied']}")
    print(f"Missing images: {stats['missing']}")
    
    # Create YAML configuration
    organizer.create_dataset_yaml()
    
    # Verify final structure
    organizer.verify_dataset()
    
    print("\nDataset organization complete!")

if __name__ == "__main__":
    main()