import cv2
import numpy as np
import os

def save_text_crop(image_path: str, label_data: dict, output_dir: str, scale: float):
    """Draw rotated bounding boxes on the image."""
    image = cv2.imread(image_path)
    if image is None:
        print(f"❌ Could not load image: {image_path}")
        return

    os.makedirs(output_dir, exist_ok=True)
    h, w = image.shape[:2]

    for region in label_data["regions"]:
        try:
            # Get and scale the polygon points
            if "polygon" in region and region["polygon"]:
                points = np.array(region["polygon"])
                points = points * scale  # Scale the points
                points = points.astype(np.int32)

                # Reshape for drawContours
                points = points.reshape((-1, 1, 2))
                
                # Draw the polygon
                cv2.polylines(image, [points], isClosed=True, 
                            color=(0, 0, 255), thickness=2)
                
                # Add text label above the polygon
                min_x = np.min(points[:, 0, 0])
                min_y = np.min(points[:, 0, 1])
                
                cv2.putText(image, region["text"], 
                           (min_x, min_y - 5),
                           cv2.FONT_HERSHEY_SIMPLEX, 
                           0.5, (0, 0, 255), 2)
            else:
                print(f"⚠️ No polygon points for text: {region['text']}")

        except Exception as e:
            print(f"❌ Error processing region: {str(e)}")
            print(f"Region data: {region}")

    # Save annotated image
    output_filename = f"{os.path.splitext(os.path.basename(image_path))[0]}_annotated.jpg"
    output_path = os.path.join(output_dir, output_filename)
    cv2.imwrite(output_path, image)

    print(f"✅ Saved annotated image: {output_filename}")