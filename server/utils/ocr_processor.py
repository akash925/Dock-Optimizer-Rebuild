#!/usr/bin/env python3
"""
OCR Processor for Bill of Lading (BOL) Documents

This script processes PDF and image files to extract key information
such as BOL numbers, customer names, and carrier details using PaddleOCR.
"""

import os
import sys
import json
import time
import re
from datetime import datetime
import traceback

# Import required libraries
try:
    from paddleocr import PaddleOCR
    from pdf2image import convert_from_path
    from PIL import Image
except ImportError as e:
    error_result = {
        "success": False,
        "error": f"Missing required library: {str(e)}",
        "bol_number": None,
        "customer_name": None,
        "carrier_name": None
    }
    print(json.dumps(error_result))
    sys.exit(1)

def extract_text_from_pdf(pdf_path):
    """Convert PDF to images and extract text using OCR"""
    try:
        # Convert PDF to list of PIL images
        images = convert_from_path(pdf_path, dpi=300, first_page=1, last_page=2)
        
        # Initialize PaddleOCR with English model
        ocr = PaddleOCR(use_angle_cls=True, lang='en')
        
        all_text = []
        confidence_sum = 0
        total_detections = 0
        
        # Process each image
        for img in images:
            result = ocr.ocr(numpy_array_from_pil(img), cls=True)
            
            # Extract text and confidence scores
            for idx in range(len(result)):
                res = result[idx]
                for line in res:
                    text = line[1][0]  # Text content
                    confidence = line[1][1]  # Confidence score
                    all_text.append(text)
                    confidence_sum += confidence
                    total_detections += 1
        
        # Calculate average confidence
        avg_confidence = 0
        if total_detections > 0:
            avg_confidence = confidence_sum / total_detections
            
        return {
            "text": " ".join(all_text),
            "confidence": avg_confidence,
            "page_count": len(images)
        }
    except Exception as e:
        return {
            "error": f"PDF processing error: {str(e)}",
            "traceback": traceback.format_exc()
        }

def extract_text_from_image(image_path):
    """Extract text from image file using OCR"""
    try:
        # Initialize PaddleOCR with English model
        ocr = PaddleOCR(use_angle_cls=True, lang='en')
        
        # Process the image
        result = ocr.ocr(image_path, cls=True)
        
        all_text = []
        confidence_sum = 0
        total_detections = 0
        
        # Extract text and confidence scores
        for idx in range(len(result)):
            res = result[idx]
            for line in res:
                text = line[1][0]  # Text content
                confidence = line[1][1]  # Confidence score
                all_text.append(text)
                confidence_sum += confidence
                total_detections += 1
        
        # Calculate average confidence
        avg_confidence = 0
        if total_detections > 0:
            avg_confidence = confidence_sum / total_detections
            
        return {
            "text": " ".join(all_text),
            "confidence": avg_confidence
        }
    except Exception as e:
        return {
            "error": f"Image processing error: {str(e)}",
            "traceback": traceback.format_exc()
        }

def numpy_array_from_pil(pil_image):
    """Convert PIL Image to numpy array for PaddleOCR"""
    return np.array(pil_image)

def extract_bol_number(text):
    """Extract BOL number from text using regex patterns"""
    # Common BOL number patterns
    patterns = [
        r'BOL\s*(?:#|No|Number|NUM)?\s*[:=]?\s*([A-Z0-9-]{6,20})',
        r'(?:Bill of Lading|B/L)\s*(?:#|No|Number|NUM)?\s*[:=]?\s*([A-Z0-9-]{6,20})',
        r'(?:BOL|BOLNUMBER|BOL NUMBER)[\s#:]*([A-Z0-9-]{6,20})',
        r'(?:SHIPMENT|TRACKING)[\s#:]*([A-Z0-9-]{6,20})'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    
    # Look for any standalone alphanumeric string that might be a BOL number
    standalone_patterns = [
        r'\b[A-Z]{3,4}[-]?[0-9]{6,10}\b',  # Format like HZL-123456
        r'\b[0-9]{10,12}\b'  # Long numeric string
    ]
    
    for pattern in standalone_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(0).strip()
    
    return None

def extract_customer_name(text):
    """Extract customer name from text"""
    patterns = [
        r'(?:Customer|CUST|Consignee)[\s:]*([A-Za-z0-9\s&.,\'-]{3,50})',
        r'(?:Ship To|SHIPTO|Recipient)[\s:]*([A-Za-z0-9\s&.,\'-]{3,50})'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            # Clean up the extracted name
            name = match.group(1).strip()
            # Remove any trailing commas, dots, etc.
            name = re.sub(r'[,.:;]*$', '', name)
            return name
    
    return None

def extract_carrier_name(text):
    """Extract carrier name from text"""
    patterns = [
        r'(?:Carrier|CARR|Transport)[\s:]*([A-Za-z0-9\s&.,\'-]{3,50})',
        r'(?:SCAC|Carrier Code)[\s:]*([A-Z]{2,4})'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            # Clean up the extracted name
            name = match.group(1).strip()
            # Remove any trailing commas, dots, etc.
            name = re.sub(r'[,.:;]*$', '', name)
            return name
    
    return None

def extract_dates(text):
    """Extract ship date and delivery date from text"""
    date_patterns = [
        r'(?:Ship Date|SHIPDATE|Date Shipped)[\s:]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
        r'(?:Delivery Date|DELDATE|Expected Delivery)[\s:]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})'
    ]
    
    ship_date = None
    delivery_date = None
    
    # Look for ship date
    match = re.search(date_patterns[0], text, re.IGNORECASE)
    if match:
        ship_date = match.group(1).strip()
    
    # Look for delivery date
    match = re.search(date_patterns[1], text, re.IGNORECASE)
    if match:
        delivery_date = match.group(1).strip()
    
    return ship_date, delivery_date

def process_document(file_path):
    """Main function to process document and extract BOL information"""
    start_time = time.time()
    
    # Validate file exists
    if not os.path.exists(file_path):
        return {
            "success": False,
            "error": f"File not found: {file_path}",
            "bol_number": None,
            "customer_name": None,
            "carrier_name": None
        }
    
    # Determine file type and extract text
    file_ext = os.path.splitext(file_path)[1].lower()
    
    ocr_result = {}
    
    if file_ext == '.pdf':
        ocr_result = extract_text_from_pdf(file_path)
    elif file_ext in ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp']:
        ocr_result = extract_text_from_image(file_path)
    else:
        return {
            "success": False,
            "error": f"Unsupported file type: {file_ext}",
            "bol_number": None,
            "customer_name": None,
            "carrier_name": None
        }
    
    # Check for OCR errors
    if "error" in ocr_result:
        return {
            "success": False,
            "error": ocr_result["error"],
            "traceback": ocr_result.get("traceback", ""),
            "bol_number": None,
            "customer_name": None,
            "carrier_name": None
        }
    
    # Extract information from OCR text
    text = ocr_result.get("text", "")
    confidence = ocr_result.get("confidence", 0)
    
    bol_number = extract_bol_number(text)
    customer_name = extract_customer_name(text)
    carrier_name = extract_carrier_name(text)
    ship_date, delivery_date = extract_dates(text)
    
    processing_time = time.time() - start_time
    
    return {
        "success": True,
        "bol_number": bol_number,
        "customer_name": customer_name,
        "carrier_name": carrier_name,
        "ship_date": ship_date,
        "delivery_date": delivery_date,
        "confidence": confidence,
        "text": text[:1000] if text else "",  # Limit text to 1000 chars
        "processing_time": processing_time
    }

if __name__ == "__main__":
    try:
        # Make sure numpy is imported before processing
        import numpy as np
        
        # Get file path from command line argument
        if len(sys.argv) < 2:
            print(json.dumps({
                "success": False,
                "error": "No file path provided",
                "bol_number": None,
                "customer_name": None,
                "carrier_name": None
            }))
            sys.exit(1)
        
        file_path = sys.argv[1]
        result = process_document(file_path)
        
        # Output JSON result
        print(json.dumps(result))
        
    except Exception as e:
        # Catch any unexpected errors
        print(json.dumps({
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "traceback": traceback.format_exc(),
            "bol_number": None,
            "customer_name": None,
            "carrier_name": None
        }))
        sys.exit(1)