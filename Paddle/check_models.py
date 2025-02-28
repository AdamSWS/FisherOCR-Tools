import os

# Define model directories
model_dirs = {
    "Detection Model (det)": "C:\\Users\\Adam\\Desktop\\det",
    "Recognition Model (rec)": "C:\\Users\\Adam\\Desktop\\rec",
    "Classification Model (cls)": "C:\\Users\\Adam\\Desktop\\cls"
}

# Required files in each model directory
required_files = ["inference.pdiparams", "inference.pdmodel", "inference.yml"]

# Check if required files exist
for model_name, model_dir in model_dirs.items():
    print(f"Checking {model_name} in {model_dir}...")
    if not os.path.exists(model_dir):
        print(f"❌ Directory not found: {model_dir}")
        continue

    missing_files = [file for file in required_files if not os.path.exists(os.path.join(model_dir, file))]
    if missing_files:
        print(f"⚠️ Missing files in {model_name}: {', '.join(missing_files)}")
    else:
        print(f"✅ All required files found for {model_name}.")

print("\nIf any files are missing, download them manually from the PaddleOCR model zoo.")
