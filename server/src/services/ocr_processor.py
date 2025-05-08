#!/usr/bin/env python3
"""
OCR Processor using PaddleOCR
-------------------------------
This script processes an image file using PaddleOCR and returns the extracted text as JSON.
Usage: python3 ocr_processor.py /path/to/image.jpg
"""

import sys
import os
import json
import logging
from typing import List, Dict, Any, Optional
import traceback

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('ocr_processor')

try:
    from paddleocr import PaddleOCR
except ImportError:
    logger.error("Error: PaddleOCR is not installed. Please install using 'pip install paddleocr paddlepaddle'")
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
    result = {
        "success": False,
        "error": None,
        "text": [],
        "full_result": []
    }
    
    # Check if file exists
    if not os.path.exists(image_path):
        result["error"] = f"Image file not found: {image_path}"
        return result
    
    try:
        # Initialize PaddleOCR with English language support
        ocr = PaddleOCR(use_angle_cls=True, lang='en')
        
        # Perform OCR on the image
        ocr_result = ocr.ocr(image_path, cls=True)
        
        if not ocr_result or len(ocr_result) == 0:
            result["error"] = "No text detected in the image"
            return result
        
        # Extract text from results
        text_list = []
        full_result = []
        
        for page in ocr_result:
            if not page:
                continue
                
            page_texts = []
            page_results = []
            
            for line in page:
                if len(line) >= 2:
                    coords, (text, confidence) = line
                    page_texts.append(text)
                    page_results.append({
                        "text": text,
                        "confidence": float(confidence),
                        "coordinates": coords
                    })
            
            text_list.extend(page_texts)
            full_result.extend(page_results)
        
        result["success"] = True
        result["text"] = text_list
        result["full_result"] = full_result
        
    except Exception as e:
        result["error"] = str(e)
        logger.error(f"OCR processing error: {e}")
        logger.error(traceback.format_exc())
    
    return result

def main():
    """Main function to process command line arguments and run OCR."""
    if len(sys.argv) != 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python3 ocr_processor.py /path/to/image.jpg"
        }))
        sys.exit(1)
    
    image_path = sys.argv[1]
    result = process_image(image_path)
    
    # Output result as JSON
    print(json.dumps(result, ensure_ascii=False))
    
    # Exit with appropriate code
    if not result["success"]:
        sys.exit(1)
    sys.exit(0)

if __name__ == "__main__":
    main()