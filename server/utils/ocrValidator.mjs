/**
 * OCR Validator Utility (ESM Version)
 * 
 * Provides specialized validation for OCR processing to ensure documents
 * are suitable for text extraction before they're passed to the OCR engine.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import logger from '../logger.js';

// Get the directory name in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Validates that an image has sufficient quality for OCR processing
 * 
 * @param {string} imagePath - Path to the image file
 * @returns {Object} - Validation result with success flag and error message if any
 */
export function validateImageForOcr(imagePath) {
  try {
    // Basic checks - file exists and has minimum size
    if (!fs.existsSync(imagePath)) {
      return { 
        isValid: false, 
        error: 'File not found', 
        details: `File ${imagePath} does not exist` 
      };
    }
    
    // Check file size
    const stats = fs.statSync(imagePath);
    if (stats.size === 0) {
      return { 
        isValid: false, 
        error: 'Empty file', 
        details: 'The image file is empty (0 bytes)' 
      };
    }
    
    // Simple size check - images that are too small often produce poor OCR results
    if (stats.size < 10000) { // Less than 10KB
      return {
        isValid: false,
        error: 'Image too small for reliable OCR',
        details: `The image file is only ${stats.size} bytes, which is likely too small for effective OCR processing`
      };
    }
    
    // If we got here, the image seems valid
    return { 
      isValid: true,
      fileSize: stats.size,
      format: path.extname(imagePath).substring(1).toUpperCase()
    };
  } catch (error) {
    logger.error('OCR-Validator', `Error validating image for OCR ${imagePath}: ${error.message}`);
    return {
      isValid: false,
      error: 'Image validation error',
      details: error.message
    };
  }
}

/**
 * Validates that a PDF has extractable text or is suitable for OCR processing
 * 
 * @param {string} pdfPath - Path to the PDF file
 * @returns {Object} - Validation result with success flag and error message if any
 */
export function validatePdfForOcr(pdfPath) {
  try {
    // Basic checks - file exists and has minimum size
    if (!fs.existsSync(pdfPath)) {
      return { 
        isValid: false, 
        error: 'File not found', 
        details: `File ${pdfPath} does not exist` 
      };
    }
    
    // Check file size
    const stats = fs.statSync(pdfPath);
    if (stats.size === 0) {
      return { 
        isValid: false, 
        error: 'Empty file', 
        details: 'The PDF file is empty (0 bytes)' 
      };
    }

    if (stats.size < 1000) { // Less than 1KB
      return { 
        isValid: false, 
        error: 'Suspiciously small PDF', 
        details: `The PDF file is only ${stats.size} bytes, which is unusually small` 
      };
    }
    
    // If we got here, the PDF seems valid
    return { 
      isValid: true,
      fileSize: stats.size
    };
  } catch (error) {
    logger.error('OCR-Validator', `Error validating PDF for OCR ${pdfPath}: ${error.message}`);
    return {
      isValid: false,
      error: 'PDF OCR validation error',
      details: error.message
    };
  }
}

/**
 * Validates any document for OCR processing
 * 
 * @param {string} filePath - Path to the document file
 * @returns {Object} - Validation result with success flag and error message if any
 */
export function validateDocumentForOcr(filePath) {
  if (!filePath) {
    return { 
      isValid: false, 
      error: 'No file path provided', 
      details: 'File path is required for OCR validation' 
    };
  }

  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.pdf') {
    return validatePdfForOcr(filePath);
  } else if (['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp', '.gif'].includes(ext)) {
    return validateImageForOcr(filePath);
  } else {
    return { 
      isValid: false, 
      error: 'Unsupported file format for OCR', 
      details: `File extension ${ext} is not supported for OCR processing` 
    };
  }
}

/**
 * Validates OCR result to ensure enough text was detected
 * 
 * @param {Object} ocrResult - Result from OCR processing
 * @returns {boolean} - Whether the result is valid
 */
export function validateOcrResult(ocrResult) {
  if (!ocrResult) return false;
  
  // Check if any text was detected
  if (!ocrResult.text || ocrResult.text.length < 10) {
    return false;
  }
  
  // Check confidence level if available
  if (ocrResult.confidence && ocrResult.confidence < 10) {
    return false;
  }
  
  return true;
}

/**
 * Extract structured fields from OCR results
 * 
 * @param {Object} ocrResult - Result from OCR processing
 * @returns {Object} - Extracted structured fields
 */
export function extractFieldsFromOcrResults(ocrResult) {
  const text = ocrResult.text || '';
  const metadata = {
    processingTimestamp: new Date().toISOString()
  };
  
  // Extract BOL number using regex patterns
  const bolNumberPatterns = [
    /BOL\s*(?:#|No|Number|NUM)?\s*[:=]?\s*([A-Z0-9-]{6,20})/i,
    /(?:Bill of Lading|B\/L)\s*(?:#|No|Number|NUM)?\s*[:=]?\s*([A-Z0-9-]{6,20})/i,
    /(?:BOL|BOLNUMBER|BOL NUMBER)[\s#:]*([A-Z0-9-]{6,20})/i
  ];
  
  for (const pattern of bolNumberPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      metadata.bolNumber = match[1].trim();
      break;
    }
  }
  
  // Extract customer name
  const customerPatterns = [
    /(?:Customer|CUST|Consignee)[\s:]*([A-Za-z0-9\s&.,\'-]{3,50})/i,
    /(?:Ship To|SHIPTO|Recipient)[\s:]*([A-Za-z0-9\s&.,\'-]{3,50})/i
  ];
  
  for (const pattern of customerPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      metadata.customerName = match[1].trim();
      break;
    }
  }
  
  // Extract carrier name
  const carrierPatterns = [
    /(?:Carrier|CARR|Transport)[\s:]*([A-Za-z0-9\s&.,\'-]{3,50})/i,
    /(?:SCAC|Carrier Code)[\s:]*([A-Z]{2,4})/i
  ];
  
  for (const pattern of carrierPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      metadata.carrierName = match[1].trim();
      break;
    }
  }
  
  // Add original processing data
  if (ocrResult.confidence) {
    metadata.confidenceScore = ocrResult.confidence;
  }
  
  if (ocrResult.processingTime) {
    metadata.processingTimeMs = ocrResult.processingTime;
  }
  
  return metadata;
}