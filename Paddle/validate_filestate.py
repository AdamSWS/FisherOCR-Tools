import os

def validate_and_clean_images(file_path):
    desktop_path = os.path.join(os.path.expanduser("~"), "Desktop")  # Get Desktop path
    
    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    valid_lines = []
    missing_files = []

    for i, line in enumerate(lines, 1):
        line = line.strip()
        if not line:
            continue  # Skip empty lines

        parts = line.split("\t")
        if len(parts) != 2:
            print(f"Skipping malformed line {i}: {line}")
            continue

        img_path = parts[0].strip()
        full_img_path = os.path.join(desktop_path, img_path)

        if os.path.exists(full_img_path):
            valid_lines.append(line)
        else:
            missing_files.append(full_img_path)

    # Overwrite the file with only valid lines
    with open(file_path, "w", encoding="utf-8") as f:
        f.writelines(line + "\n" for line in valid_lines)

    if missing_files:
        print("Missing Files (Removed from fileState.txt):")
        for file in missing_files:
            print(file)
    else:
        print("All images exist!")

# Run the validation and cleaning
validate_and_clean_images("fileState.txt")
