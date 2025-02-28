"""Label generation and management utilities."""

from typing import Dict, List
import os
import json

def save_label_files(labels: Dict, labels_dir: str):
    """Save labels to a file."""
    label_path = os.path.join(labels_dir, "labels.json")
    with open(label_path, 'w', encoding='utf-8') as f:
        json.dump(labels, f, ensure_ascii=False, indent=2)


def create_label_data(product_name: str,
                     description: str,
                     product_number: str,
                     price_text: str,
                     category: str,
                     text_content: List[str],
                     image_size: List[int]) -> Dict:
    """Create label data for an image."""
    return {
        "product_name": product_name,
        "description": description,
        "product_number": product_number,
        "price": price_text,
        "category": category,
        "text": "\n".join([price_text] + text_content),
        "image_size": image_size
    }