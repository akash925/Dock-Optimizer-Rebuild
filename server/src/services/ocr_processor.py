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
from typing import Dict, Any, List, Optional
import traceback

# For handling PDFs
try:
    from pdf2image import convert_from_path
    from PIL import Image
except ImportError:
    print("Error: Missing dependencies. Please install pdf2image and Pillow.")
    print("pip install pdf2image Pillow")
    sys.exit(1)

# Import PaddleOCR
try:
    from paddleocr import PaddleOCR
except ImportError:
    print("Error: PaddleOCR not installed. Please install with:")
    print("pip install paddleocr")
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
        # Check if file exists
        if not os.path.exists(image_path):
            return {
                "success": False,
                "error": f"File not found: {image_path}",
                "text": [],
                "full_result": []
            }
        
        # Handle PDF files - convert to images first
        if image_path.lower().endswith('.pdf'):
            start_time = time.time()
            print(f"Converting PDF to images: {image_path}")
            
            # Create a temporary directory for PDF page images
            temp_dir = os.path.join(os.path.dirname(image_path), 'temp_pdf_pages')
            os.makedirs(temp_dir, exist_ok=True)
            
            # Convert PDF to images
            try:
                images = convert_from_path(image_path)
                
                # If no images were extracted, return error
                if not images:
                    return {
                        "success": False,
                        "error": "Could not extract any images from PDF",
                        "text": [],
                        "full_result": []
                    }

                # Save each page as an image
                image_paths = []
                for i, img in enumerate(images):
                    page_path = os.path.join(temp_dir, f'page_{i + 1}.jpg')
                    img.save(page_path, 'JPEG')
                    image_paths.append(page_path)
                
                # Process each page and combine results
                all_text = []
                all_results = []
                
                # Initialize PaddleOCR outside loop for efficiency
                ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
                
                for page_path in image_paths:
                    result = ocr.ocr(page_path, cls=True)
                    
                    if result and result[0]:
                        # Extract text from result
                        for line in result[0]:
                            if len(line) >= 2 and isinstance(line[1], list) and len(line[1]) >= 1:
                                all_text.append(line[1][0])
                        
                        all_results.extend(result[0])
                
                # Clean up temp files
                for page_path in image_paths:
                    if os.path.exists(page_path):
                        os.remove(page_path)
                
                if os.path.exists(temp_dir):
                    try:
                        os.rmdir(temp_dir)
                    except OSError:
                        # Directory might not be empty
                        pass
                
                processing_time = time.time() - start_time
                print(f"PDF processing complete in {processing_time:.2f} seconds")
                
                return {
                    "success": True,
                    "error": None,
                    "text": all_text,
                    "full_result": all_results,
                    "source_type": "pdf",
                    "processing_time": processing_time
                }
                
            except Exception as e:
                print(f"Error processing PDF: {str(e)}")
                traceback.print_exc()
                return {
                    "success": False,
                    "error": f"Error processing PDF: {str(e)}",
                    "text": [],
                    "full_result": []
                }
        
        # Process image file directly
        start_time = time.time()
        print(f"Processing image with PaddleOCR: {image_path}")
        
        # Initialize PaddleOCR
        ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
        
        # Run OCR on the image
        result = ocr.ocr(image_path, cls=True)
        
        extracted_text = []
        
        # Process the OCR result
        if result and result[0]:
            for line in result[0]:
                if len(line) >= 2 and isinstance(line[1], list) and len(line[1]) >= 1:
                    extracted_text.append(line[1][0])
        
        processing_time = time.time() - start_time
        print(f"OCR processing complete in {processing_time:.2f} seconds")
        
        return {
            "success": True,
            "error": None,
            "text": extracted_text,
            "full_result": result[0] if result and result[0] else [],
            "source_type": "image",
            "processing_time": processing_time
        }
        
    except Exception as e:
        print(f"Error in OCR processing: {str(e)}")
        traceback.print_exc()
        return {
            "success": False,
            "error": f"OCR processing error: {str(e)}",
            "text": [],
            "full_result": []
        }

def main():
    """Main function to process command line arguments and run OCR."""
    # Check if file path is provided
    if len(sys.argv) < 2:
        print("Usage: python ocr_processor.py /path/to/image.jpg")
        sys.exit(1)
    
    # Get the image path from command line arguments
    image_path = sys.argv[1]
    
    # Process the image
    result = process_image(image_path)
    
    # Output the result as JSON
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()