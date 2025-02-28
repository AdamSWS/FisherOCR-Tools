import os
import glob
import zipfile
import re
import argparse
from pathlib import Path

def validate_yolo_annotation(file_path, num_classes):
    """
    Validate a single YOLO annotation file.
    
    Args:
        file_path: Path to the annotation file
        num_classes: Number of classes in obj.names
        
    Returns:
        list of error messages, empty if valid
    """
    errors = []
    line_number = 0
    
    try:
        with open(file_path, 'r') as f:
            content = f.read().strip()
            
            # Skip empty files
            if not content:
                return []
                
            lines = content.split('\n')
            
            for line_number, line in enumerate(lines, 1):
                parts = line.strip().split()
                
                # Check format: class_id cx cy width height
                if len(parts) != 5:
                    errors.append(f"Line {line_number}: Wrong number of elements. Expected 5, got {len(parts)}")
                    continue
                
                # Validate class_id
                try:
                    class_id = int(float(parts[0]))
                    if class_id < 0:
                        errors.append(f"Line {line_number}: Negative class ID: {class_id}")
                    elif class_id >= num_classes:
                        errors.append(f"Line {line_number}: Class ID {class_id} exceeds maximum class index {num_classes-1}")
                except ValueError:
                    errors.append(f"Line {line_number}: Invalid class ID: {parts[0]}")
                
                # Validate coordinates (must be between 0 and 1)
                for i, coord_name in enumerate(['cx', 'cy', 'width', 'height'], 1):
                    try:
                        value = float(parts[i])
                        if not (0 <= value <= 1):
                            errors.append(f"Line {line_number}: {coord_name} = {value} is outside valid range [0,1]")
                    except ValueError:
                        errors.append(f"Line {line_number}: Invalid {coord_name}: {parts[i]}")
    
    except Exception as e:
        errors.append(f"Error reading file: {str(e)}")
    
    return errors

def validate_obj_names(file_path):
    """
    Validate obj.names file
    
    Args:
        file_path: Path to obj.names
        
    Returns:
        tuple: (valid, num_classes, error_message)
    """
    try:
        with open(file_path, 'r') as f:
            content = f.read().strip()
            classes = [line for line in content.split('\n') if line.strip()]
            
            if not classes:
                return False, 0, "obj.names is empty"
            
            return True, len(classes), None
    except Exception as e:
        return False, 0, f"Error reading obj.names: {str(e)}"

def validate_obj_data(file_path):
    """
    Validate obj.data file
    
    Args:
        file_path: Path to obj.data
        
    Returns:
        tuple: (valid, error_message)
    """
    required_fields = ['names']
    found_fields = set()
    
    try:
        with open(file_path, 'r') as f:
            content = f.read()
            
            # Check for required fields
            for field in required_fields:
                if re.search(rf"{field}\s*=", content):
                    found_fields.add(field)
            
            missing_fields = set(required_fields) - found_fields
            if missing_fields:
                return False, f"Missing required fields in obj.data: {', '.join(missing_fields)}"
            
            return True, None
    except Exception as e:
        return False, f"Error reading obj.data: {str(e)}"

def validate_train_txt(file_path, annotations_dir):
    """
    Validate train.txt file
    
    Args:
        file_path: Path to train.txt
        annotations_dir: Directory containing annotation files
        
    Returns:
        tuple: (valid, list of missing files)
    """
    missing_files = []
    
    try:
        with open(file_path, 'r') as f:
            lines = [line.strip() for line in f.readlines() if line.strip()]
            
            if not lines:
                return False, ["train.txt is empty"]
            
            for line in lines:
                # Extract image filename
                img_file = os.path.basename(line)
                # Get corresponding annotation filename
                anno_base = os.path.splitext(img_file)[0]
                anno_file = f"{anno_base}.txt"
                
                # Check if annotation file exists
                if annotations_dir:
                    full_path = os.path.join(annotations_dir, anno_file)
                    if not os.path.exists(full_path):
                        missing_files.append(anno_file)
            
            return len(missing_files) == 0, missing_files
    except Exception as e:
        return False, [f"Error reading train.txt: {str(e)}"]

def validate_archive_structure(archive_path):
    """
    Validate the structure of a zip archive for CVAT YOLO format
    
    Args:
        archive_path: Path to the zip archive
        
    Returns:
        dict: Validation results
    """
    results = {
        "valid": True,
        "errors": [],
        "files": {
            "obj_names": {"found": False, "path": None},
            "obj_data": {"found": False, "path": None},
            "train_txt": {"found": False, "path": None},
            "annotations": [],
            "images": []
        }
    }
    
    try:
        with zipfile.ZipFile(archive_path, 'r') as z:
            file_list = z.namelist()
            
            # Check for required files
            for file in file_list:
                basename = os.path.basename(file)
                if basename == 'obj.names':
                    results["files"]["obj_names"]["found"] = True
                    results["files"]["obj_names"]["path"] = file
                elif basename == 'obj.data':
                    results["files"]["obj_data"]["found"] = True
                    results["files"]["obj_data"]["path"] = file
                elif basename == 'train.txt':
                    results["files"]["train_txt"]["found"] = True
                    results["files"]["train_txt"]["path"] = file
                
                # Identify annotation and image files
                if file.endswith('.txt') and 'obj_train_data' in file:
                    results["files"]["annotations"].append(file)
                elif file.lower().endswith(('.jpg', '.jpeg', '.png')) and 'obj_train_data' in file:
                    results["files"]["images"].append(file)
            
            # Check if required files are missing
            for key in ["obj_names", "obj_data", "train_txt"]:
                if not results["files"][key]["found"]:
                    results["valid"] = False
                    results["errors"].append(f"Missing required file: {key.replace('_', '.')}")
            
            # Check if there are annotations
            if not results["files"]["annotations"]:
                results["valid"] = False
                results["errors"].append("No annotation files found in obj_train_data")
                
            # Check if there are images
            if not results["files"]["images"]:
                results["valid"] = False
                results["errors"].append("No image files found in obj_train_data")
                
            # Check if there's a matching annotation for each image
            image_bases = {os.path.splitext(os.path.basename(img))[0] for img in results["files"]["images"]}
            anno_bases = {os.path.splitext(os.path.basename(anno))[0] for anno in results["files"]["annotations"]}
            
            missing_annos = image_bases - anno_bases
            if missing_annos:
                results["valid"] = False
                results["errors"].append(f"Missing annotations for {len(missing_annos)} images")
                if len(missing_annos) <= 10:  # Show up to 10 missing files
                    for img in missing_annos:
                        results["errors"].append(f"  - Missing annotation for {img}")
                else:
                    results["errors"].append(f"  - (Showing 10 of {len(missing_annos)}): {', '.join(list(missing_annos)[:10])}")
            
            extra_annos = anno_bases - image_bases
            if extra_annos:
                results["valid"] = False
                results["errors"].append(f"Found {len(extra_annos)} annotations without matching images")
                if len(extra_annos) <= 10:  # Show up to 10 extra files
                    for anno in extra_annos:
                        results["errors"].append(f"  - Extra annotation for {anno}")
                else:
                    results["errors"].append(f"  - (Showing 10 of {len(extra_annos)}): {', '.join(list(extra_annos)[:10])}")
            
    except zipfile.BadZipFile:
        results["valid"] = False
        results["errors"].append("Invalid zip file")
    except Exception as e:
        results["valid"] = False
        results["errors"].append(f"Error examining archive: {str(e)}")
    
    return results

def validate_unzipped_directory(dir_path):
    """
    Validate an unzipped YOLO dataset directory
    
    Args:
        dir_path: Path to the directory
        
    Returns:
        dict: Validation results
    """
    results = {
        "valid": True,
        "errors": [],
        "warnings": [],
        "class_count": 0,
        "annotation_count": 0,
        "invalid_annotations": []
    }
    
    # Check for required files
    obj_names_path = os.path.join(dir_path, "obj.names")
    obj_data_path = os.path.join(dir_path, "obj.data")
    train_txt_path = os.path.join(dir_path, "train.txt")
    obj_train_data_path = os.path.join(dir_path, "obj_train_data")
    
    # Validate obj.names
    if not os.path.exists(obj_names_path):
        results["valid"] = False
        results["errors"].append("Missing obj.names file")
    else:
        valid, num_classes, error = validate_obj_names(obj_names_path)
        if valid:
            results["class_count"] = num_classes
            print(f"✅ Found {num_classes} classes in obj.names")
        else:
            results["valid"] = False
            results["errors"].append(error)
    
    # Validate obj.data
    if not os.path.exists(obj_data_path):
        results["valid"] = False
        results["errors"].append("Missing obj.data file")
    else:
        valid, error = validate_obj_data(obj_data_path)
        if not valid:
            results["valid"] = False
            results["errors"].append(error)
        else:
            print("✅ obj.data file is valid")
    
    # Validate train.txt
    if not os.path.exists(train_txt_path):
        results["valid"] = False
        results["errors"].append("Missing train.txt file")
    else:
        annotations_dir = obj_train_data_path if os.path.exists(obj_train_data_path) else None
        valid, missing_files = validate_train_txt(train_txt_path, annotations_dir)
        if valid:
            print("✅ train.txt file is valid")
        else:
            results["warnings"].append(f"Issues with train.txt: {len(missing_files)} missing annotation files")
            if len(missing_files) <= 10:  # Show up to 10 missing files
                for file in missing_files:
                    results["warnings"].append(f"  - Missing: {file}")
            else:
                results["warnings"].append(f"  - (Showing 10 of {len(missing_files)}): {', '.join(missing_files[:10])}")
    
    # Validate obj_train_data directory
    if not os.path.exists(obj_train_data_path):
        results["valid"] = False
        results["errors"].append("Missing obj_train_data directory")
    else:
        # Check for annotation files
        txt_files = glob.glob(os.path.join(obj_train_data_path, "*.txt"))
        if not txt_files:
            # Check in annotations subdirectory
            annotations_subdir = os.path.join(obj_train_data_path, "annotations")
            if os.path.exists(annotations_subdir):
                txt_files = glob.glob(os.path.join(annotations_subdir, "*.txt"))
                if txt_files:
                    results["warnings"].append("Annotation files found in obj_train_data/annotations/ instead of obj_train_data/")
        
        if not txt_files:
            results["valid"] = False
            results["errors"].append("No annotation files found")
        else:
            results["annotation_count"] = len(txt_files)
            print(f"✅ Found {len(txt_files)} annotation files")
            
            # Validate each annotation file
            if results["class_count"] > 0:
                for txt_file in txt_files:
                    errors = validate_yolo_annotation(txt_file, results["class_count"])
                    if errors:
                        results["valid"] = False
                        results["invalid_annotations"].append({
                            "file": os.path.basename(txt_file),
                            "errors": errors
                        })
            
            if results["invalid_annotations"]:
                results["errors"].append(f"Found {len(results['invalid_annotations'])} invalid annotation files")
                if len(results["invalid_annotations"]) <= 5:  # Show up to 5 invalid files
                    for invalid in results["invalid_annotations"]:
                        results["errors"].append(f"  - {invalid['file']}: {'; '.join(invalid['errors'][:3])}")
                else:
                    results["errors"].append(f"  - (Showing 5 of {len(results['invalid_annotations'])})")
                    for invalid in results["invalid_annotations"][:5]:
                        results["errors"].append(f"  - {invalid['file']}: {'; '.join(invalid['errors'][:3])}")
        
        # Check for image files
        img_files = glob.glob(os.path.join(obj_train_data_path, "*.jpg")) + \
                    glob.glob(os.path.join(obj_train_data_path, "*.jpeg")) + \
                    glob.glob(os.path.join(obj_train_data_path, "*.png"))
                    
        if not img_files:
            results["valid"] = False
            results["errors"].append("No image files found in obj_train_data directory")
        else:
            print(f"✅ Found {len(img_files)} image files")
            
            # Check for matching annotation files
            img_bases = {os.path.splitext(os.path.basename(img))[0] for img in img_files}
            anno_bases = {os.path.splitext(os.path.basename(txt))[0] for txt in txt_files}
            
            missing_annos = img_bases - anno_bases
            if missing_annos:
                results["warnings"].append(f"Missing annotations for {len(missing_annos)} images")
                if len(missing_annos) <= 10:  # Show up to 10 missing files
                    for img in missing_annos:
                        results["warnings"].append(f"  - Missing annotation for {img}")
                else:
                    results["warnings"].append(f"  - (Showing 10 of {len(missing_annos)}): {', '.join(list(missing_annos)[:10])}")
            
            extra_annos = anno_bases - img_bases
            if extra_annos:
                results["warnings"].append(f"Found {len(extra_annos)} annotations without matching images")
                if len(extra_annos) <= 10:  # Show up to 10 extra files
                    for anno in extra_annos:
                        results["warnings"].append(f"  - Extra annotation for {anno}")
                else:
                    results["warnings"].append(f"  - (Showing 10 of {len(extra_annos)}): {', '.join(list(extra_annos)[:10])}")
    
    return results

def main():
    parser = argparse.ArgumentParser(description="Validate CVAT YOLO format annotations")
    parser.add_argument("path", help="Path to zip archive or unzipped directory")
    args = parser.parse_args()
    
    path = args.path
    
    if not os.path.exists(path):
        print(f"❌ Error: Path does not exist: {path}")
        return
    
    print(f"Validating YOLO annotations: {path}")
    print("-" * 50)
    
    if os.path.isfile(path) and path.endswith('.zip'):
        # Validate zip archive
        print("📂 Validating zip archive format...")
        results = validate_archive_structure(path)
        
        if results["valid"]:
            print("✅ Archive structure is valid for CVAT YOLO format")
            print(f"✅ Found {len(results['files']['annotations'])} annotation files")
            print(f"✅ Found {len(results['files']['images'])} image files")
        else:
            print("❌ Archive structure is invalid for CVAT YOLO format")
            for error in results["errors"]:
                print(f"  ❌ {error}")
    
    elif os.path.isdir(path):
        # Validate unzipped directory
        print("📂 Validating unzipped directory...")
        results = validate_unzipped_directory(path)
        
        if results["valid"]:
            print("\n✅ YOLO annotations are valid for CVAT import")
            print(f"✅ Found {results['class_count']} classes")
            print(f"✅ Found {results['annotation_count']} annotation files")
        else:
            print("\n❌ YOLO annotations are invalid for CVAT import")
            for error in results["errors"]:
                print(f"  ❌ {error}")
        
        # Show warnings
        if results["warnings"]:
            print("\n⚠️ Warnings:")
            for warning in results["warnings"]:
                print(f"  ⚠️ {warning}")
    
    else:
        print(f"❌ Error: Path is not a zip file or directory: {path}")

if __name__ == "__main__":
    main()