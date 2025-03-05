#!/usr/bin/env python3
"""
OCR Data File Validator

This script validates and fixes the format of OCR data files:
- Ensures every line has the correct 'path\tJSON' format
- Removes any blank lines
- Checks that JSON content is properly formatted
- Generates a report of issues found and fixed

Usage:
    python validate_files.py
"""

import os
import sys
import re
import json
from pathlib import Path

def main():
    print("OCR Data File Validator")
    print("======================")
    
    # Files to validate
    files_to_check = ["Label.txt", "Cache.cach", "fileState.txt"]
    
    for filename in files_to_check:
        file_path = Path(filename)
        if file_path.exists():
            print(f"\nValidating {filename}...")
            validate_and_fix_file(file_path)
        else:
            print(f"\nSkipping {filename} (file not found)")

def validate_and_fix_file(file_path):
    # Read file content
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    original_lines = len(lines)
    print(f"Read {original_lines} lines from file")
    
    # Track issues
    blank_lines = 0
    malformed_lines = 0
    invalid_json = 0
    
    # Fixed content
    fixed_lines = []
    
    for line_num, line in enumerate(lines, 1):
        # Skip blank lines
        if not line.strip():
            blank_lines += 1
            continue
        
        # Check format: path + tab + content
        parts = line.strip().split('\t', 1)
        
        if len(parts) != 2:
            malformed_lines += 1
            print(f"  Line {line_num}: Malformed line (missing tab separator)")
            
            # Try to fix if it looks like a path
            if line.strip().startswith("ocr_data/"):
                # This might be just a path without content
                print(f"    - Skipping malformed line: {line.strip()[:40]}...")
            else:
                # Not a valid line format
                print(f"    - Skipping invalid line: {line.strip()[:40]}...")
            continue
        
        path, content = parts
        
        # Validate path format
        if not path.startswith("ocr_data/") or not any(path.endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.tif', '.tiff']):
            malformed_lines += 1
            print(f"  Line {line_num}: Invalid path format: {path}")
            continue
        
        # For Label.txt and Cache.cach, validate JSON content
        if file_path.name in ["Label.txt", "Cache.cach"]:
            try:
                json_data = json.loads(content)
                # If JSON is valid, keep the line
                fixed_lines.append(f"{path}\t{json.dumps(json_data)}\n")
            except json.JSONDecodeError as e:
                invalid_json += 1
                print(f"  Line {line_num}: Invalid JSON: {str(e)}")
                continue
        else:
            # For fileState.txt, just keep the valid lines
            fixed_lines.append(f"{path}\t{content}\n")
    
    # Write fixed content
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(fixed_lines)
    
    # Report
    print(f"Validation complete for {file_path.name}:")
    print(f"  - Original lines: {original_lines}")
    print(f"  - Valid lines kept: {len(fixed_lines)}")
    print(f"  - Blank lines removed: {blank_lines}")
    print(f"  - Malformed lines removed: {malformed_lines}")
    if file_path.name in ["Label.txt", "Cache.cach"]:
        print(f"  - Invalid JSON content removed: {invalid_json}")
    print(f"  - File has been fixed and saved")

if __name__ == "__main__":
    main()