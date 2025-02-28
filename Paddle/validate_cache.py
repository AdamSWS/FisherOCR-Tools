import os

def validate_and_clean_cache(cache_file):
    desktop_path = os.path.join(os.path.expanduser("~"), "Desktop")  # Get Desktop path
    
    with open(cache_file, "r", encoding="utf-8") as f:
        lines = f.readlines()

    valid_lines = []
    missing_files = []

    for i, line in enumerate(lines, 1):
        line = line.strip()
        if not line:
            continue  # Skip empty lines

        parts = line.split("\t")
        if len(parts) < 2:
            print(f"Skipping malformed line {i}: {line}")
            continue

        img_path = parts[0].strip()  # First column is the image path
        full_img_path = os.path.join(desktop_path, img_path)

        if os.path.exists(full_img_path):
            valid_lines.append(line)
        else:
            missing_files.append(full_img_path)

    # Overwrite the file with only valid lines
    with open(cache_file, "w", encoding="utf-8") as f:
        f.writelines(line + "\n" for line in valid_lines)

    if missing_files:
        print("Missing Files (Removed from Cache.cach):")
        for file in missing_files:
            print(file)
    else:
        print("All images exist!")

# Run the validation and cleaning for Cache.cach
validate_and_clean_cache("Cache.cach")
