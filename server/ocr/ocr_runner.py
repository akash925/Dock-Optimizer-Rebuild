#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
OCR Runner Script for Node.js Connector
---------------------------------------
This script loads an image file and processes it using the BOLProcessor
from the bol_processor module. It is designed to be called from Node.js.
"""

import sys
import json
import base64
import tempfile
import traceback
from pathlib import Path

# Import the OCR processor with dependency check
try:
    from bol_processor import BOLProcessor, DEPENDENCIES_AVAILABLE, ERROR_MESSAGE
except ImportError:
    # Try relative import in case the script is run from a different directory
    sys.path.append(str(Path(__file__).parent))
    try:
        from bol_processor import BOLProcessor, DEPENDENCIES_AVAILABLE, ERROR_MESSAGE
    except ImportError:
        # If we still can't import, return an error
        print(json.dumps({
            "success": False,
            "error": "Failed to import BOLProcessor module",
            "error_type": "ImportError",
            "required_installation": "Make sure BOL processor module is properly installed"
        }))
        sys.exit(1)

def process_image_file(file_path):
    """Process an image file with the BOL processor"""
    # Check if dependencies are available
    if not DEPENDENCIES_AVAILABLE:
        return {
            "success": False,
            "error": f"Missing required dependencies: {ERROR_MESSAGE}",
            "error_type": "DependencyError",
            "required_libraries": [
                "numpy", "opencv-python (cv2)", "paddleocr", "Pillow (PIL)", "pdf2image"
            ],
            "system_dependencies": [
                "libgl1" # Required by OpenCV
            ]
        }
    
    try:
        processor = BOLProcessor(show_log=False)
        result = processor.process_image(file_path)
        return result
    except Exception as e:
        return {
            "success": False, 
            "error": str(e),
            "error_type": type(e).__name__,
            "traceback": traceback.format_exc()
        }

def process_image_base64(base64_data):
    """Process a base64-encoded image with the BOL processor"""
    # Check if dependencies are available
    if not DEPENDENCIES_AVAILABLE:
        return {
            "success": False,
            "error": f"Missing required dependencies: {ERROR_MESSAGE}",
            "error_type": "DependencyError",
            "required_libraries": [
                "numpy", "opencv-python (cv2)", "paddleocr", "Pillow (PIL)", "pdf2image"
            ],
            "system_dependencies": [
                "libgl1" # Required by OpenCV
            ]
        }
    
    try:
        # Check if the data is prefixed with a data URL
        if base64_data.startswith('@'):
            # It's a file path containing the base64 data
            with open(base64_data[1:], 'r') as f:
                base64_data = f.read().strip()
        
        # Remove data URL prefix if present
        if ',' in base64_data:
            base64_data = base64_data.split(',', 1)[1]
            
        # Decode base64 data
        binary_data = base64.b64decode(base64_data)
        
        # Process the binary data directly
        processor = BOLProcessor(show_log=False)
        result = processor.process_image(binary_data)
        return result
    except Exception as e:
        return {
            "success": False, 
            "error": str(e),
            "error_type": type(e).__name__,
            "traceback": traceback.format_exc()
        }

def main():
    """Main function to process command line arguments"""
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "Invalid arguments. Expected: mode [file|base64] and path or data"
        }))
        sys.exit(1)
    
    mode = sys.argv[1]
    data = sys.argv[2]
    
    if mode == "file":
        # Process image file
        result = process_image_file(data)
    elif mode == "base64":
        # Process base64-encoded image
        result = process_image_base64(data)
    else:
        result = {
            "success": False,
            "error": f"Invalid mode: {mode}. Expected 'file' or 'base64'"
        }
    
    # Print JSON result to stdout for the Node.js process to capture
    print(json.dumps(result))

if __name__ == "__main__":
    main()