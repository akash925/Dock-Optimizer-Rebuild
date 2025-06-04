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
import sys
import time
import traceback
import re

# Handle dependencies with try/except for more resilience
DEPENDENCIES_AVAILABLE = True
ERROR_MESSAGE = ""

try:
    import numpy as np
except ImportError:
    np = None
    DEPENDENCIES_AVAILABLE = False
    ERROR_MESSAGE += "Missing numpy library. "

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    Image = ImageDraw = ImageFont = None
    DEPENDENCIES_AVAILABLE = False
    ERROR_MESSAGE += "Missing PIL/Pillow library. "

try:
    import cv2
except ImportError:
    cv2 = None
    DEPENDENCIES_AVAILABLE = False
    ERROR_MESSAGE += "Missing OpenCV (cv2) library. This may require system package 'libgl1'. "

try:
    from paddleocr import PaddleOCR, PPStructure
except ImportError:
    PaddleOCR = PPStructure = None
    DEPENDENCIES_AVAILABLE = False
    ERROR_MESSAGE += "Missing PaddleOCR library. "

try:
    from pdf2image import convert_from_path, convert_from_bytes
except ImportError:
    convert_from_path = convert_from_bytes = None
    DEPENDENCIES_AVAILABLE = False
    ERROR_MESSAGE += "Missing pdf2image library. "

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
        # Check if all dependencies are available
        if not DEPENDENCIES_AVAILABLE:
            self.pp_structure = None
            self.ocr = None
            return
            
        try:
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
        except Exception as e:
            self.pp_structure = None
            self.ocr = None
            print(f"Error initializing PaddleOCR: {str(e)}")

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
        start_time = time.time()
        
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
                ],
                "processing_time": time.time() - start_time
            }
            
        # Check if OCR engine was initialized properly
        if self.pp_structure is None or self.ocr is None:
            return {
                "success": False,
                "error": "OCR engine was not initialized properly",
                "error_type": "InitializationError",
                "processing_time": time.time() - start_time
            }
        
        try:
            print(f"[BOLProcessor] Starting image processing...")
            
            # Preprocess the image
            preprocessed_img = self._preprocess_image(image_data)
            print(f"[BOLProcessor] Image preprocessing completed")
            
            # Use PP-Structure for layout analysis and table recognition
            print(f"[BOLProcessor] Running PP-Structure analysis...")
            structure_result = self.pp_structure(preprocessed_img)
            
            # Convert PP-Structure result to structured format
            structured_data = self._convert_pp_structure_result(structure_result)
            
            # Also run regular OCR for full-page text detection as a fallback
            # This ensures we don't miss any text that PP-Structure might not catch
            print(f"[BOLProcessor] Running fallback OCR...")
            ocr_result = self.ocr(preprocessed_img)
            
            # Extract text from OCR result
            full_text = []
            full_text_with_positions = []
            total_confidence = 0
            confidence_count = 0
            
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
                        
                        # Track confidence for average calculation
                        if isinstance(confidence, (int, float)):
                            total_confidence += confidence
                            confidence_count += 1
            
            # Calculate average confidence
            average_confidence = round(total_confidence / confidence_count, 2) if confidence_count > 0 else 0
            
            # Add full text results to the structured data
            structured_data["full_text"] = {
                "text": "\n".join(full_text),
                "lines": full_text_with_positions
            }
            
            # Enhanced BOL field extraction
            full_text_content = structured_data["full_text"]["text"]
            extracted_fields = self._extract_bol_fields(full_text_content)
            structured_data["extracted_fields"] = extracted_fields
            
            # Calculate processing metrics
            processing_time = time.time() - start_time
            
            # Determine extraction quality score
            quality_score = self._calculate_quality_score(structured_data, average_confidence)
            
            # Add success status and metadata
            structured_data.update({
                "success": True,
                "processing_time": round(processing_time, 2),
                "average_confidence": average_confidence,
                "quality_score": quality_score,
                "engine_version": "PaddleOCR",
                "total_text_lines": len(full_text),
                "total_tables": len(structured_data.get("tables", [])),
                "total_layout_elements": len(structured_data.get("layout", []))
            })
            
            print(f"[BOLProcessor] Processing completed successfully in {processing_time:.2f}s")
            print(f"[BOLProcessor] Average confidence: {average_confidence}%, Quality score: {quality_score}%")
            
            return structured_data
            
        except Exception as e:
            processing_time = time.time() - start_time
            error_msg = str(e)
            
            print(f"[BOLProcessor] Error during processing: {error_msg}")
            
            return {
                "success": False,
                "error": error_msg,
                "error_type": type(e).__name__,
                "processing_time": round(processing_time, 2),
                "traceback": traceback.format_exc() if hasattr(traceback, 'format_exc') else str(e)
            }

    def _extract_bol_fields(self, text_content: str) -> Dict[str, Any]:
        """
        Extract specific BOL fields from the OCR text using advanced pattern matching.
        
        Args:
            text_content: Full extracted text from the document
            
        Returns:
            Dict with extracted BOL fields
        """
        extracted = {}
        
        # BOL Number patterns (enhanced)
        bol_patterns = [
            r'(?:BOL|B/L|Bill\s+of\s+Lading)[\s#:]*([A-Z0-9]{4,})',
            r'(?:BOL|BL)\s*#?\s*([A-Z0-9]{4,})',
            r'Bill\s+of\s+Lading\s+(?:Number|No|#)[\s:]*([A-Z0-9]{4,})',
            r'\bBOL([A-Z0-9]{6,})\b'
        ]
        
        for pattern in bol_patterns:
            match = re.search(pattern, text_content, re.IGNORECASE)
            if match:
                extracted['bol_number'] = match.group(1).strip()
                break
        
        # Carrier/Shipper patterns
        carrier_patterns = [
            r'(?:Carrier|Shipper)[\s:]*([A-Za-z\s&.,]+?)(?:\n|$|[A-Z]{2}\s+\d{5})',
            r'(?:Transport|Trucking|Express|Logistics)[\s:]*([A-Za-z\s&.,]+)',
            r'MC[\s#]*\d+[\s]*([A-Za-z\s&.,]+)'
        ]
        
        for pattern in carrier_patterns:
            match = re.search(pattern, text_content, re.IGNORECASE)
            if match:
                carrier_name = match.group(1).strip()
                if len(carrier_name) > 3 and len(carrier_name) < 100:  # Reasonable length
                    extracted['carrier_name'] = carrier_name
                    break
        
        # Weight patterns
        weight_patterns = [
            r'(?:Weight|Wt)[\s:]*(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kg|kgs?)',
            r'(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)',
            r'Total\s+Weight[\s:]*(\d+(?:\.\d+)?)'
        ]
        
        for pattern in weight_patterns:
            match = re.search(pattern, text_content, re.IGNORECASE)
            if match:
                extracted['weight'] = match.group(1) + ' lbs'
                break
        
        # Pallet/Piece count patterns
        pallet_patterns = [
            r'(?:Pallets?|Skids?)[\s:]*(\d+)',
            r'(\d+)\s*(?:Pallets?|Skids?)',
            r'(?:Pieces?|Pcs?)[\s:]*(\d+)',
            r'(?:Count|Qty)[\s:]*(\d+)'
        ]
        
        for pattern in pallet_patterns:
            match = re.search(pattern, text_content, re.IGNORECASE)
            if match:
                extracted['pallet_count'] = match.group(1)
                break
        
        # Date patterns (ship date, delivery date)
        date_patterns = [
            r'(?:Ship|Shipping)\s+Date[\s:]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
            r'(?:Delivery|Del)\s+Date[\s:]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
            r'Date[\s:]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})'
        ]
        
        for pattern in date_patterns:
            match = re.search(pattern, text_content, re.IGNORECASE)
            if match:
                extracted['ship_date'] = match.group(1)
                break
        
        # Address patterns (simplified)
        address_patterns = [
            r'(?:From|Origin)[\s:]*([A-Za-z\s,]+,\s*[A-Z]{2}\s+\d{5})',
            r'(?:To|Destination|Consignee)[\s:]*([A-Za-z\s,]+,\s*[A-Z]{2}\s+\d{5})'
        ]
        
        for i, pattern in enumerate(address_patterns):
            match = re.search(pattern, text_content, re.IGNORECASE)
            if match:
                field_name = 'from_address' if i == 0 else 'to_address'
                extracted[field_name] = match.group(1).strip()
        
        return extracted

    def _calculate_quality_score(self, structured_data: Dict, average_confidence: float) -> int:
        """
        Calculate a quality score for the extraction based on various factors.
        
        Args:
            structured_data: The structured extraction results
            average_confidence: Average OCR confidence score
            
        Returns:
            Quality score from 0-100
        """
        score = 0
        
        # Base score from OCR confidence (40% weight)
        score += (average_confidence * 0.4)
        
        # Text extraction score (30% weight)
        full_text = structured_data.get("full_text", {}).get("text", "")
        if len(full_text) > 100:  # Reasonable amount of text extracted
            score += 30
        elif len(full_text) > 50:
            score += 20
        elif len(full_text) > 10:
            score += 10
        
        # Field extraction score (30% weight)
        extracted_fields = structured_data.get("extracted_fields", {})
        field_weights = {
            'bol_number': 10,
            'carrier_name': 8,
            'weight': 5,
            'pallet_count': 4,
            'ship_date': 3
        }
        
        for field, weight in field_weights.items():
            if field in extracted_fields and extracted_fields[field]:
                score += weight
        
        # Ensure score is within 0-100 range
        return min(100, max(0, int(score)))

# Simple function to check if OCR is working
def test_ocr():
    """Test function to verify OCR installation and functionality"""
    
    # Check if dependencies are available
    if not DEPENDENCIES_AVAILABLE:
        return {
            "success": False,
            "message": "OCR test failed due to missing dependencies",
            "error": ERROR_MESSAGE,
            "error_type": "DependencyError",
            "required_libraries": [
                "numpy", "opencv-python (cv2)", "paddleocr", "Pillow (PIL)", "pdf2image"
            ],
            "system_dependencies": [
                "libgl1" # Required by OpenCV
            ]
        }
    
    try:
        # Create a simple test image with text
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