import os
import cv2
import pandas as pd
import argparse
import sys
from pathlib import Path
import xml.etree.ElementTree as ET
from xml.dom import minidom
from ultralytics import YOLO
import shutil

class YOLOtoCVAT:
    def __init__(self, model_path="best.pt", input_dir=None, output_dir="cvat_export", conf_threshold=0.25):
        """
        Initialize the YOLO to CVAT converter
        
        Args:
            model_path: Path to the YOLO model (.pt file)
            input_dir: Directory containing images to process
            output_dir: Directory to save the CVAT-compatible annotations
            conf_threshold: Confidence threshold for detections
        """
        # Ensure model path is valid
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"❌ Model file not found at {model_path}")
        
        self.model = YOLO(model_path)
        print(f"✅ Model loaded from: {model_path}")
        
        # Get class names from the model
        self.class_names = self.model.names
        print(f"✅ Class names: {self.class_names}")
        
        self.input_dir = os.path.abspath(input_dir) if input_dir else None
        self.output_dir = os.path.abspath(output_dir)
        self.conf_threshold = conf_threshold
        
        # Create output directory structure for standard YOLO format
        os.makedirs(os.path.join(self.output_dir, "obj_train_data"), exist_ok=True)
        os.makedirs(os.path.join(self.output_dir, "obj_train_data", "annotations"), exist_ok=True)
        os.makedirs(os.path.join(self.output_dir, "obj_train_data", "visualizations"), exist_ok=True)
        
        # If input directory is provided, get images
        if self.input_dir:
            self.images = [f for f in os.listdir(self.input_dir) 
                          if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
            print(f"✅ Found {len(self.images)} images to process")
        else:
            self.images = []
    
    def detect_objects(self, image_path):
        """Detect objects in an image using YOLO and return DataFrame."""
        results = self.model(image_path, conf=self.conf_threshold)
        detections = results[0].boxes.data.cpu().numpy()

        if len(detections) == 0:
            return pd.DataFrame(columns=["xmin", "ymin", "xmax", "ymax", "confidence", "class", "name"])

        columns = ["xmin", "ymin", "xmax", "ymax", "confidence", "class"]
        df = pd.DataFrame(detections, columns=columns)
        df["name"] = df["class"].apply(lambda x: self.class_names[int(x)] if int(x) in self.class_names else "unknown")
        return df
    
    def create_annotated_image(self, image_path, detections):
        """
        Generates an image with YOLO-detected bounding boxes.

        :param image_path: Path to the image file.
        :param detections: DataFrame of YOLO detections.
        :return: Annotated image with bounding boxes.
        """
        image = cv2.imread(image_path)
        if image is None:
            raise FileNotFoundError(f"❌ Could not load image: {image_path}")

        for _, row in detections.iterrows():
            x1, y1, x2, y2 = int(row["xmin"]), int(row["ymin"]), int(row["xmax"]), int(row["ymax"])
            label = f"{row['name']} ({row['confidence']:.2f})"
            
            # Draw rectangle
            cv2.rectangle(image, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(image, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

        return image
    
    def generate_yolo_txt(self, image_path, detections):
        """
        Generate standard YOLO format annotations (label_id cx cy width height)
        Where cx, cy, width, height are relative coordinates (0-1)
        
        Args:
            image_path: Path to the image
            detections: DataFrame of detections
            
        Returns:
            List of annotation strings in YOLO format with relative coordinates
        """
        if detections.empty:
            return []
        
        # Get image dimensions
        image = cv2.imread(image_path)
        if image is None:
            raise FileNotFoundError(f"❌ Could not load image: {image_path}")
            
        height, width, _ = image.shape
        
        # Create annotations
        annotations = []
        for _, row in detections.iterrows():
            # Get bounding box coordinates
            x1, y1, x2, y2 = float(row["xmin"]), float(row["ymin"]), float(row["xmax"]), float(row["ymax"])
            class_id = int(row["class"])
            
            # Convert to relative center coordinates and width/height
            cx = (x1 + x2) / (2 * width)
            cy = (y1 + y2) / (2 * height)
            w = (x2 - x1) / width
            h = (y2 - y1) / height
            
            # Format with high precision
            annotation = f"{class_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}"
            annotations.append(annotation)
            
        return annotations
    
    def process_single_image(self, image_path):
        """
        Process a single image and generate YOLO format annotations
        
        Args:
            image_path: Path to the image file
            
        Returns:
            Tuple of (detections DataFrame, annotations list)
        """
        print(f"🔍 Processing image: {os.path.basename(image_path)}")
        
        # Detect objects
        detections = self.detect_objects(image_path)
        print(f"✅ Found {len(detections)} objects")
        
        # Generate YOLO format annotations
        yolo_annotations = self.generate_yolo_txt(image_path, detections)
        
        # Prepare paths
        img_filename = os.path.basename(image_path)
        base_name = os.path.splitext(img_filename)[0]
        
        # Save image copy to YOLO directory
        img_dest_path = os.path.join(self.output_dir, "obj_train_data", img_filename)
        shutil.copy2(image_path, img_dest_path)
        print(f"✅ Copied image to {img_dest_path}")
        
        # Save YOLO annotations
        txt_path = os.path.join(self.output_dir, "obj_train_data", "annotations", f"{base_name}.txt")
        with open(txt_path, "w") as f:
            f.write("\n".join(yolo_annotations))
        print(f"✅ Saved YOLO annotation to {txt_path}")
        
        # Save visualization
        annotated_img = self.create_annotated_image(image_path, detections)
        vis_path = os.path.join(self.output_dir, "obj_train_data", "visualizations", img_filename)
        cv2.imwrite(vis_path, annotated_img)
        print(f"✅ Saved visualization to {vis_path}")
        
        return detections, yolo_annotations
    
    def generate_yolo_files(self):
        """
        Generate standard YOLO format supporting files (obj.names, obj.data, train.txt)
        """
        # Create obj.names (class names)
        obj_names_path = os.path.join(self.output_dir, "obj.names")
        with open(obj_names_path, "w") as f:
            for i in range(len(self.class_names)):
                f.write(f"{self.class_names[i]}\n")
        print(f"✅ Saved obj.names to {obj_names_path}")
        
        # Create train.txt (list of image paths)
        train_txt_path = os.path.join(self.output_dir, "train.txt")
        with open(train_txt_path, "w") as f:
            for img_file in self.images:
                f.write(f"obj_train_data/{img_file}\n")
        print(f"✅ Saved train.txt to {train_txt_path}")
        
        # Create obj.data
        obj_data_path = os.path.join(self.output_dir, "obj.data")
        with open(obj_data_path, "w") as f:
            f.write(f"classes = {len(self.class_names)}\n")
            f.write("names = obj.names\n")
            f.write("train = train.txt\n")
            f.write("backup = backup/\n")
        print(f"✅ Saved obj.data to {obj_data_path}")
        
        # Create backup directory
        os.makedirs(os.path.join(self.output_dir, "backup"), exist_ok=True)
    
    def process_directory(self):
        """
        Process all images in the input directory
        """
        if not self.input_dir:
            raise ValueError("❌ Input directory not specified")
            
        if not self.images:
            print("⚠️ No images found in the input directory")
            return
            
        # Process each image
        for img_file in self.images:
            img_path = os.path.join(self.input_dir, img_file)
            self.process_single_image(img_path)
            
        # Generate YOLO config files
        self.generate_yolo_files()


def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Convert YOLO model predictions to standard YOLO annotation format")
    parser.add_argument("--model", type=str, default="best.pt", help="Path to YOLO model (.pt file)")
    parser.add_argument("--input", type=str, required=True, help="Directory containing images to process or single image path")
    parser.add_argument("--output", type=str, default="yolo_export", help="Directory to save YOLO annotations")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold for detections")
    args = parser.parse_args()
    
    print("\n===== YOLO Model Predictions to YOLO Format Converter =====")
    print(f"Model: {args.model}")
    print(f"Input: {args.input}")
    print(f"Output directory: {args.output}")
    print(f"Confidence threshold: {args.conf}")
    print("==========================================================\n")
    
    try:
        # Determine if input is a directory or a single file
        if os.path.isdir(args.input):
            # Process a directory of images
            converter = YOLOtoCVAT(
                model_path=args.model,
                input_dir=args.input,
                output_dir=args.output,
                conf_threshold=args.conf
            )
            converter.process_directory()
        else:
            # Process a single image
            if not os.path.isfile(args.input):
                raise FileNotFoundError(f"❌ Input file not found: {args.input}")
                
            converter = YOLOtoCVAT(
                model_path=args.model,
                output_dir=args.output,
                conf_threshold=args.conf
            )
            converter.process_single_image(args.input)
        
        print("\n✅ Conversion complete!")
        print(f"✅ YOLO format annotations saved to: {args.output}")
        print(f"✅ The annotations are in standard YOLO format (class_id cx cy width height)")
        print("   where cx, cy, width, height are relative coordinates (0-1).")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()