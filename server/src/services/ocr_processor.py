#!/usr/bin/env python3
"""
OCR Processor using PaddleOCR
-------------------------------
This script processes an image file using PaddleOCR and returns the extracted text as JSON.
Usage: python3 ocr_processor.py /path/to/image.jpg
"""

import os
import sys
import json
import time
import tempfile
from typing import Dict, Any, List, Optional, Tuple
import traceback

# Import required libraries for image processing and PDF handling
try:
    from PIL import Image
    import pdf2image
except ImportError as e:
    print(json.dumps({
        "success": False,
        "error": f"Failed to import image libraries: {str(e)}. Please install required dependencies."
    }))
    sys.exit(1)

# Check and handle libpaddle.so issue
paddle_so_path = "/home/runner/workspace/.pythonlibs/lib/python3.11/site-packages/paddle/base/libpaddle.so"
if os.path.exists(paddle_so_path):
    print(json.dumps({
        "success": False,
        "error": f"PaddlePaddle installation issue detected. The file {paddle_so_path} exists and is causing conflicts."
    }))
    print(f"Error: PaddlePaddle installation issue detected. The file {paddle_so_path} exists and is causing conflicts.", file=sys.stderr)
    # Rename the problematic file to allow imports to work
    try:
        os.rename(paddle_so_path, f"{paddle_so_path}.bak")
        print(f"Renamed {paddle_so_path} to {paddle_so_path}.bak to fix import issues", file=sys.stderr)
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": f"Failed to fix PaddlePaddle installation: {str(e)}"
        }))
        print(f"Failed to fix PaddlePaddle installation: {str(e)}", file=sys.stderr)
        sys.exit(1)

# Import PaddleOCR
try:
    from paddleocr import PaddleOCR
except ImportError as e:
    print(json.dumps({
        "success": False,
        "error": f"Failed to import PaddleOCR: {str(e)}. Please install paddleocr."
    }))
    print(f"Failed to import PaddleOCR: {str(e)}", file=sys.stderr)
    sys.exit(1)

def process_image(image_path: str) -> Dict[str, Any]:
    """
    Process an image file using PaddleOCR and return the extracted text.
    
    Args:
        image_path: Path to the image file
        
    Returns:
        Dictionary with OCR results including:
        - success: boolean indicating success or failure
        - error: error message if any
        - text: list of detected text lines
        - full_result: complete OCR output with coordinates
    """
    try:
        # Initialize PaddleOCR with English language model
        start_time = time.time()
        print(f"Initializing PaddleOCR...", file=sys.stderr)
        
        # Check if the file is a PDF
        is_pdf = image_path.lower().endswith('.pdf')
        
        # If PDF, convert to images
        if is_pdf:
            print(f"Converting PDF to images...", file=sys.stderr)
            pdf_images = pdf2image.convert_from_path(
                image_path, 
                dpi=300,
                fmt="jpeg",
                use_pdftocairo=True,
                transparent=False
            )
            
            # Create a temporary directory for the images
            with tempfile.TemporaryDirectory() as temp_dir:
                image_paths = []
                # Save each page as an image
                for i, img in enumerate(pdf_images):
                    img_path = os.path.join(temp_dir, f"page_{i+1}.jpg")
                    img.save(img_path, "JPEG")
                    image_paths.append(img_path)
                
                # Process each image
                all_results = []
                ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
                
                for img_path in image_paths:
                    result = ocr.ocr(img_path, cls=True)
                    if result:
                        all_results.extend(result)
        else:
            # Process single image
            ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
            all_results = ocr.ocr(image_path, cls=True)
        
        elapsed_time = time.time() - start_time
        print(f"OCR processing completed in {elapsed_time:.2f} seconds", file=sys.stderr)
        
        # Extract text from results
        extracted_text = []
        full_results = []
        
        if all_results:
            for page_results in all_results:
                if page_results:
                    for line in page_results:
                        if len(line) >= 2:  # Check if result has the expected format
                            coordinates = line[0]
                            text_info = line[1]
                            text = text_info[0]
                            confidence = text_info[1]
                            
                            # Add text to the list
                            extracted_text.append(text)
                            
                            # Add full result with coordinates
                            full_results.append({
                                "text": text,
                                "confidence": confidence,
                                "coordinates": coordinates
                            })
        
        return {
            "success": True,
            "text": extracted_text,
            "full_result": full_results,
            "processing_time": elapsed_time
        }
    
    except Exception as e:
        error_traceback = traceback.format_exc()
        print(f"Error processing image: {str(e)}\n{error_traceback}", file=sys.stderr)
        return {
            "success": False,
            "error": str(e),
            "traceback": error_traceback
        }

def main():
    """Main function to process command line arguments and run OCR."""
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "No image file specified. Usage: python3 ocr_processor.py /path/to/image.jpg"
        }))
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(json.dumps({
            "success": False,
            "error": f"File not found: {image_path}"
        }))
        sys.exit(1)
    
    result = process_image(image_path)
    print(json.dumps(result))

if __name__ == "__main__":
    main()