#!/usr/bin/env python3
"""
Main entry point for OCRDataGenerator package.
Run this file directly to generate synthetic OCR data.
"""

import argparse
import os
import sys
from dataset_generator import OCRDataGenerator
from preprocessing import OCRPreprocessor

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Generate synthetic OCR data for training"
    )

    parser.add_argument(
        "--output-dir",
        type=str,
        default="paddle_ocr_dataset",
        help="Directory to save generated images and labels (default: paddle_ocr_dataset)",
    )

    parser.add_argument(
        "--num-images",
        type=int,
        default=1000,
        help="Number of images to generate (default: 1000)",
    )

    parser.add_argument(
        "--fonts-dir",
        type=str,
        default="data/fonts",
        help="Directory containing font files (default: data/fonts)",
    )

    parser.add_argument(
        "--preprocess",
        action="store_true",
        help="Run preprocessing on generated images",
    )

    parser.add_argument(
        "--threads",
        type=int,
        default=10,
        help="Number of threads for preprocessing (default: 10)",
    )

    parser.add_argument(
        "--target-dpi",
        type=int,
        default=300,
        help="Target DPI for preprocessing (default: 300)",
    )

    return parser.parse_args()

def main():
    """Main function to run the generator."""
    args = parse_args()

    # Ensure fonts directory exists
    if not os.path.exists(args.fonts_dir):
        print(f"Error: Fonts directory '{args.fonts_dir}' not found.")
        print("Please create the directory and add TTF/OTF font files.")
        sys.exit(1)

    try:
        # Initialize OCR Data Generator
        generator = OCRDataGenerator(output_dir=args.output_dir)

        print(f"\nGenerating {args.num_images} synthetic OCR images...")
        print(f"Output directory: {args.output_dir}")

        generator.generate_dataset(num_images=args.num_images)

        print("\n✅ Generation completed successfully!")
        print(f"📂 Images saved in: {os.path.join(args.output_dir, 'images')}")
        print(f"📂 Labels saved in: {os.path.join(args.output_dir, 'labels')}")

        # Run additional preprocessing if requested (separate from the main pipeline)
        if args.preprocess:
            print("\n🔄 Starting preprocessing...")

            preprocessor = OCRPreprocessor(
                target_dpi=args.target_dpi, num_threads=args.threads
            )

            input_dir = os.path.join(args.output_dir, "images")
            output_dir = os.path.join(args.output_dir, "processed_images")

            preprocessor.process_directory(input_dir, output_dir)

            print(f"\n✅ Preprocessing completed!")
            print(f"📂 Processed images saved in: {output_dir}")

    except Exception as e:
        print(f"\n❌ Error during execution: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
