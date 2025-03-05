#!/usr/bin/env python3
"""
OCR Data Cleaner

This script identifies and removes transcription entries with NaN coordinates
while preserving the rest of the entries for each image.

Usage:
    python cleaner.py                      # Run the NaN cleaning
"""

import os
import sys
import re
import json
from pathlib import Path

def main():
    clean_nan_entries()
    print("Processing complete. Entries with NaN coordinates have been removed.")

def clean_nan_entries():
    """Remove entries that contain NaN coordinates."""
    print("Cleaning entries with NaN coordinates...")
    
    # Process Label.txt and Cache.cach to remove entries with NaN coordinates
    # (fileState.txt doesn't contain coordinates, so we skip it)
    clean_nan_from_file(Path("Label.txt"))
    clean_nan_from_file(Path("Cache.cach"))

def clean_nan_from_file(file_path):
    """Remove entries with NaN coordinates from a file."""
    if not file_path.exists():
        print(f"Warning: {file_path.name} does not exist. Skipping.")
        return
    
    print(f"Processing {file_path.name} for NaN coordinates...")
    
    # Read file content
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Process each line
    new_lines = []
    modified_entries = 0
    total_nan_entries_removed = 0
    
    for line in lines:
        # Skip empty lines
        if not line.strip():
            new_lines.append(line)
            continue
        
        # Split the line into filename and JSON data
        parts = line.strip().split('\t', 1)
        if len(parts) != 2:
            # If the line doesn't have the expected format, keep it as is
            new_lines.append(line)
            continue
        
        filename, json_str = parts
        
        try:
            # Parse the JSON data
            data = json.loads(json_str)
            
            # Filter out entries with NaN coordinates
            filtered_data = []
            original_count = len(data)
            
            for entry in data:
                has_nan = False
                
                # Check for NaN in points
                if "points" in entry:
                    for point in entry["points"]:
                        # Check each coordinate value for NaN
                        for coord in point:
                            if str(coord).lower() == "nan" or str(coord) == "NaN":
                                has_nan = True
                                break
                        if has_nan:
                            break
                
                if not has_nan:
                    filtered_data.append(entry)
            
            # If we removed any entries
            removed_count = original_count - len(filtered_data)
            if removed_count > 0:
                total_nan_entries_removed += removed_count
                modified_entries += 1
                # Create a new line with the filtered data
                new_line = f"{filename}\t{json.dumps(filtered_data)}\n"
                new_lines.append(new_line)
            else:
                # Keep the original line if no NaN values were found
                new_lines.append(line)
                
        except json.JSONDecodeError:
            # If there's an issue with the JSON formatting, keep the line as is
            new_lines.append(line)
    
    # Write the updated content back to the file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    
    print(f"  Processed {len(lines)} lines in {file_path.name}")
    print(f"  Modified {modified_entries} images")
    print(f"  Removed {total_nan_entries_removed} entries with NaN coordinates")

if __name__ == "__main__":
    main()