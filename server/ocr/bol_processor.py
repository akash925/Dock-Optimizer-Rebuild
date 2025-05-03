#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
BOL Image Processor using PaddleOCR
-----------------------------------
This module provides functionality to extract text and table data from Bill of Lading (BOL) 
images using PaddleOCR and its PP-Structure capabilities.
"""

import os
import json
import base64
import tempfile
from typing import Dict, List, Any, Optional, Union, Tuple
import numpy as np
from PIL import Image
import cv2
from paddleocr import PaddleOCR, PPStructure
from pdf2image import convert_from_path, convert_from_bytes

class BOLProcessor:
    """
    Bill of Lading (BOL) processor using PaddleOCR for text extraction and layout analysis.
    """
    
    def __init__(
        self, 
        lang: str = 'en',
        use_gpu: bool = False,
        show_log: bool = False
    ):
        """
        Initialize the BOL processor with PaddleOCR.
        
        Args:
            lang (str): Language code for OCR (default: 'en' for English)
            use_gpu (bool): Whether to use GPU acceleration (default: False for CPU only)
            show_log (bool): Whether to show PaddleOCR logs (default: False)
        """
        # Initialize PP-Structure for layout analysis and table recognition
        self.pp_structure = PPStructure(
            table=True,  # Enable table recognition
            ocr=True,    # Enable OCR for text
            show_log=show_log,
            lang=lang,
            layout=True, # Enable layout analysis
            use_gpu=use_gpu
        )
        
        # Initialize regular PaddleOCR for general text detection
        self.ocr = PaddleOCR(
            use_angle_cls=True,  # Enable angle classification for rotated text
            lang=lang,
            use_gpu=use_gpu,
            show_log=show_log
        )

    def _preprocess_image(self, image: Union[str, bytes, np.ndarray]) -> np.ndarray:
        """
        Preprocess the input image to enhance OCR results.
        
        Args:
            image: Path to image file, bytes of image file, or numpy array
            
        Returns:
            np.ndarray: Preprocessed image
        """
        # If image is a file path
        if isinstance(image, str) and os.path.isfile(image):
            # Check if it's a PDF
            if image.lower().endswith('.pdf'):
                # Convert first page of PDF to image
                images = convert_from_path(image, first_page=1, last_page=1)
                if not images:
                    raise ValueError("Failed to convert PDF to image")
                img = np.array(images[0])
            else:
                # Load image directly
                img = cv2.imread(image)
                img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                
        # If image is in bytes format
        elif isinstance(image, bytes):
            # Check if it might be a PDF
            if image[:4] == b'%PDF':
                # Convert first page of PDF bytes to image
                images = convert_from_bytes(image, first_page=1, last_page=1)
                if not images:
                    raise ValueError("Failed to convert PDF bytes to image")
                img = np.array(images[0])
            else:
                # Try to load bytes as image
                nparr = np.frombuffer(image, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                
        # If image is already a numpy array
        elif isinstance(image, np.ndarray):
            img = image.copy()
            # Convert if it's in BGR format
            if len(img.shape) == 3 and img.shape[2] == 3:
                img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        else:
            raise ValueError("Unsupported image format")
            
        # Apply preprocessing to enhance OCR accuracy
        # 1. Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        
        # 2. Apply adaptive thresholding to improve contrast
        # This helps with recognizing text on varying backgrounds
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY, 11, 2
        )
        
        # 3. Noise removal (optional)
        # kernel = np.ones((1, 1), np.uint8)
        # opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
        
        # 4. Convert back to RGB for PaddleOCR (it expects 3 channels)
        processed = cv2.cvtColor(thresh, cv2.COLOR_GRAY2RGB)
        
        return processed

    def _convert_pp_structure_result(self, result: List[Dict]) -> Dict[str, Any]:
        """
        Convert PP-Structure result to a structured format.
        
        Args:
            result: Raw PP-Structure result
            
        Returns:
            Dict with structured layout information
        """
        structured_result = {
            "layout": [],
            "tables": [],
            "text_blocks": []
        }
        
        # Process each detected region in the layout
        for region in result:
            region_type = region.get("type", "")
            region_bbox = region.get("bbox", [])
            region_confidence = region.get("confidence", 0)
            
            # Round confidence to 3 decimal places
            if isinstance(region_confidence, float):
                region_confidence = round(region_confidence, 3)
            
            # Common data for any region type
            region_data = {
                "type": region_type,
                "bbox": region_bbox,
                "confidence": region_confidence
            }
            
            # Add to general layout for complete document structure
            structured_result["layout"].append(region_data)
            
            # Process based on region type
            if region_type == "table":
                # Process table data
                table_data = {
                    **region_data,
                    "html": region.get("html", ""),
                    "cells": [],
                }
                
                # Add structured cell data if available
                if "res" in region and isinstance(region["res"], dict):
                    table_res = region["res"]
                    cell_data = table_res.get("cell_bbox", [])
                    cell_contents = table_res.get("cell_contents", [])
                    
                    # Combine cell bounding boxes with their text content
                    for i, bbox in enumerate(cell_data):
                        content = cell_contents[i] if i < len(cell_contents) else ""
                        table_data["cells"].append({
                            "bbox": bbox,
                            "text": content
                        })
                    
                    # Get table structure as list of lists
                    if "html" in region:
                        try:
                            # Save as both HTML and structured data
                            table_data["html"] = region["html"]
                            
                            # Also attempt to parse the data as rows/columns
                            import re
                            from bs4 import BeautifulSoup
                            
                            soup = BeautifulSoup(region["html"], 'lxml')
                            rows = []
                            
                            for tr in soup.find_all('tr'):
                                row = []
                                for td in tr.find_all(['td', 'th']):
                                    row.append(td.text.strip())
                                if row:  # Only add non-empty rows
                                    rows.append(row)
                                    
                            table_data["data"] = rows
                        except Exception as e:
                            table_data["data"] = []
                            table_data["parse_error"] = str(e)
                
                structured_result["tables"].append(table_data)
                
            elif region_type == "text":
                # Process text block
                text_block = {
                    **region_data,
                    "text": region.get("text", ""),
                    "text_lines": []
                }
                
                # Add individual text lines with their positions if available
                if "res" in region and isinstance(region["res"], dict):
                    for line in region["res"].get("text", []):
                        text, line_confidence = line
                        text_block["text_lines"].append({
                            "text": text,
                            "confidence": round(line_confidence, 3) if isinstance(line_confidence, float) else line_confidence
                        })
                
                structured_result["text_blocks"].append(text_block)
                
        return structured_result

    def process_image(self, image_data: Union[str, bytes, np.ndarray]) -> Dict[str, Any]:
        """
        Process the BOL image and extract structured information.
        
        Args:
            image_data: Path to image file, bytes of image file, or numpy array
            
        Returns:
            Dict with structured extracted information including text and tables
        """
        try:
            # Preprocess the image
            preprocessed_img = self._preprocess_image(image_data)
            
            # Use PP-Structure for layout analysis and table recognition
            structure_result = self.pp_structure(preprocessed_img)
            
            # Convert PP-Structure result to structured format
            structured_data = self._convert_pp_structure_result(structure_result)
            
            # Also run regular OCR for full-page text detection as a fallback
            # This ensures we don't miss any text that PP-Structure might not catch
            ocr_result = self.ocr(preprocessed_img)
            
            # Extract text from OCR result
            full_text = []
            full_text_with_positions = []
            
            if ocr_result and len(ocr_result) > 0:
                for line in ocr_result[0]:
                    if len(line) >= 2:  # Standard format is [[bbox], text, confidence]
                        bbox = line[0]
                        text = line[1][0]  # Text is at index 1, position 0
                        confidence = line[1][1]  # Confidence is at index 1, position 1
                        
                        full_text.append(text)
                        full_text_with_positions.append({
                            "text": text,
                            "bbox": bbox,
                            "confidence": round(confidence, 3) if isinstance(confidence, float) else confidence
                        })
            
            # Add full text results to the structured data
            structured_data["full_text"] = {
                "text": "\n".join(full_text),
                "lines": full_text_with_positions
            }
            
            # Add success status
            structured_data["success"] = True
            
            return structured_data
            
        except Exception as e:
            # Return error information
            return {
                "success": False,
                "error": str(e),
                "error_type": type(e).__name__
            }

# Simple function to check if OCR is working
def test_ocr():
    """Test function to verify OCR installation and functionality"""
    try:
        # Create a simple test image with text
        from PIL import Image, ImageDraw, ImageFont
        import numpy as np
        
        # Create a white image
        width, height = 400, 200
        image = Image.new('RGB', (width, height), color='white')
        draw = ImageDraw.Draw(image)
        
        # Add text
        text = "TEST BOL DOCUMENT"
        draw.text((50, 50), text, fill='black')
        
        text = "Carrier: ABC Shipping"
        draw.text((50, 80), text, fill='black')
        
        text = "PO#: 12345678"
        draw.text((50, 110), text, fill='black')
        
        # Convert to numpy array
        img_array = np.array(image)
        
        # Process with BOL processor
        processor = BOLProcessor(show_log=True)
        result = processor.process_image(img_array)
        
        # Return result to verify OCR is working
        if result["success"]:
            return {
                "success": True,
                "message": "OCR is working correctly",
                "detected_text": result["full_text"]["text"]
            }
        else:
            return {
                "success": False,
                "message": "OCR failed",
                "error": result.get("error", "Unknown error")
            }
            
    except Exception as e:
        return {
            "success": False,
            "message": "OCR test failed",
            "error": str(e),
            "error_type": type(e).__name__
        }

if __name__ == "__main__":
    # Test the OCR functionality
    test_result = test_ocr()
    print(json.dumps(test_result, indent=2))