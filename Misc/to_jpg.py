import os
from PIL import Image

# Define the folder containing images
image_folder = "processed_img"

# Ensure the folder exists
if not os.path.exists(image_folder):
    print(f"Folder '{image_folder}' does not exist.")
    exit()

# Loop through all files in the folder
for filename in os.listdir(image_folder):
    if filename.lower().endswith(".png"):  # Check if the file is a PNG
        png_path = os.path.join(image_folder, filename)
        jpg_path = os.path.join(image_folder, os.path.splitext(filename)[0] + ".jpg")

        try:
            # Open the PNG image
            with Image.open(png_path) as img:
                # Convert to RGB (JPEG does not support transparency)
                img = img.convert("RGB")
                # Save as JPEG
                img.save(jpg_path, "JPEG", quality=95)

            # Delete the original PNG after successful conversion
            os.remove(png_path)
            print(f"Converted and deleted: {filename}")

        except Exception as e:
            print(f"Failed to convert {filename}: {e}")

print("Conversion complete.")
