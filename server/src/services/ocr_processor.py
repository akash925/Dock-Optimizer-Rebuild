#!/usr/bin/env python3
"""
Simple Document Processor
-------------------------------
This script processes PDF documents and images and extracts content information
without using external OCR libraries that might have compatibility issues.
Usage: python3 ocr_processor.py /path/to/document.pdf
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

def process_image(image_path: str) -> Dict[str, Any]:
    """
    Process an image file or PDF and return information about it.
    
    Args:
        image_path: Path to the image or PDF file
        
    Returns:
        Dictionary with document results including:
        - success: boolean indicating success or failure
        - error: error message if any
        - metadata: document metadata
        - pages: number of pages (for PDFs)
        - dimensions: image dimensions
    """
    try:
        # Start timing
        start_time = time.time()
        print(f"Processing document: {image_path}", file=sys.stderr)
        
        # Check if the file is a PDF
        is_pdf = image_path.lower().endswith('.pdf')
        metadata = {}
        image_info = []
        
        # Process PDF
        if is_pdf:
            print(f"Converting PDF to images for analysis...", file=sys.stderr)
            try:
                pdf_images = pdf2image.convert_from_path(
                    image_path, 
                    dpi=150,  # Lower DPI for faster processing
                    fmt="jpeg"
                )
                
                # Get PDF info
                metadata["type"] = "PDF document"
                metadata["pages"] = len(pdf_images)
                metadata["filename"] = os.path.basename(image_path)
                metadata["filesize"] = os.path.getsize(image_path)
                
                # Process each page
                for i, img in enumerate(pdf_images):
                    width, height = img.size
                    colors = len(img.getcolors(maxcolors=65536)) if img.getcolors(maxcolors=65536) else "many"
                    
                    # Store page info
                    image_info.append({
                        "page": i+1,
                        "width": width,
                        "height": height,
                        "resolution": f"{width}x{height}",
                        "mode": img.mode,
                        "format": "JPEG",
                        "colors": colors
                    })
            except Exception as pdf_error:
                print(f"Error processing PDF: {str(pdf_error)}", file=sys.stderr)
                metadata["type"] = "PDF document (processing error)"
                metadata["error"] = str(pdf_error)
                metadata["filename"] = os.path.basename(image_path)
                metadata["filesize"] = os.path.getsize(image_path)
        
        # Process image
        else:
            try:
                img = Image.open(image_path)
                width, height = img.size
                
                # Get image info
                metadata["type"] = f"Image ({img.format})"
                metadata["filename"] = os.path.basename(image_path)
                metadata["filesize"] = os.path.getsize(image_path)
                metadata["dimensions"] = f"{width}x{height}"
                metadata["mode"] = img.mode
                metadata["format"] = img.format
                
                image_info.append({
                    "width": width,
                    "height": height,
                    "resolution": f"{width}x{height}",
                    "mode": img.mode,
                    "format": img.format,
                    "colors": len(img.getcolors(maxcolors=65536)) if img.getcolors(maxcolors=65536) else "many"
                })
            except Exception as img_error:
                print(f"Error processing image: {str(img_error)}", file=sys.stderr)
                metadata["type"] = "Image (processing error)"
                metadata["error"] = str(img_error)
                metadata["filename"] = os.path.basename(image_path)
                metadata["filesize"] = os.path.getsize(image_path)
        
        # Calculate processing time
        elapsed_time = time.time() - start_time
        print(f"Document processing completed in {elapsed_time:.2f} seconds", file=sys.stderr)
        
        return {
            "success": True,
            "metadata": metadata,
            "images": image_info,
            "processing_time": elapsed_time,
            "message": f"Successfully analyzed {os.path.basename(image_path)}"
        }
    
    except Exception as e:
        error_traceback = traceback.format_exc()
        print(f"Error processing document: {str(e)}\n{error_traceback}", file=sys.stderr)
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