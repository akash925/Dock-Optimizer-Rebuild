/**
 * Document Validator Utility
 * 
 * Provides functions to validate PDF and image files before processing
 * to ensure they meet minimum quality requirements for OCR
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const logger = require('../logger');

/**
 * Validates a PDF file to ensure it's properly formatted and has content
 * 
 * @param {string} filePath - Path to the PDF file
 * @returns {Object} - Validation result with success flag and error message if any
 */
function validatePdf(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { 
        isValid: false, 
        error: 'File not found', 
        details: `File ${filePath} does not exist` 
      };
    }

    // Check file size
    const stats = fs.statSync(filePath);
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

    // Read first few bytes to check PDF signature
    const buffer = Buffer.alloc(5);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 5, 0);
    fs.closeSync(fd);

    const pdfSignature = buffer.toString();
    if (pdfSignature !== '%PDF-') {
      return { 
        isValid: false, 
        error: 'Invalid PDF signature', 
        details: `File does not start with %PDF- signature (found: ${pdfSignature})` 
      };
    }

    // Try to get page count using pdftk if available (optional)
    try {
      const pageCountResult = execSync(`pdfinfo "${filePath}" | grep Pages`, { encoding: 'utf8' });
      const pageCount = parseInt(pageCountResult.trim().split(':')[1].trim());
      
      if (isNaN(pageCount) || pageCount === 0) {
        return { 
          isValid: false, 
          error: 'No pages in PDF', 
          details: 'The PDF does not contain any pages' 
        };
      }
      
      // If we got here, the PDF looks valid
      return { 
        isValid: true, 
        pageCount: pageCount,
        fileSize: stats.size
      };
    } catch (pdfInfoError) {
      // pdfinfo not available, but file has PDF signature and size seems reasonable
      // Continue with processing but log a warning
      logger.warn(`Could not verify PDF page count for ${filePath}: ${pdfInfoError.message}`);
      return { 
        isValid: true, 
        warning: 'Could not verify page count',
        fileSize: stats.size
      };
    }

  } catch (error) {
    logger.error(`Error validating PDF ${filePath}: ${error.message}`);
    return { 
      isValid: false, 
      error: 'Validation error', 
      details: error.message 
    };
  }
}

/**
 * Validates an image file to ensure it's suitable for OCR
 * 
 * @param {string} filePath - Path to the image file
 * @returns {Object} - Validation result with success flag and error message if any
 */
function validateImage(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { 
        isValid: false, 
        error: 'File not found', 
        details: `File ${filePath} does not exist` 
      };
    }

    // Check file size
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      return { 
        isValid: false, 
        error: 'Empty file', 
        details: 'The image file is empty (0 bytes)' 
      };
    }

    if (stats.size < 500) { // Less than 500 bytes
      return { 
        isValid: false, 
        error: 'Suspiciously small image', 
        details: `The image file is only ${stats.size} bytes, which is unusually small` 
      };
    }

    // Check file extension
    const ext = path.extname(filePath).toLowerCase();
    const supportedExtensions = ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp', '.gif'];
    
    if (!supportedExtensions.includes(ext)) {
      return { 
        isValid: false, 
        error: 'Unsupported image format', 
        details: `File extension ${ext} is not supported. Supported formats: ${supportedExtensions.join(', ')}` 
      };
    }

    // If we got here, the image seems valid
    return { 
      isValid: true,
      fileSize: stats.size,
      format: ext.substring(1).toUpperCase() // Remove the dot
    };
  } catch (error) {
    logger.error(`Error validating image ${filePath}: ${error.message}`);
    return { 
      isValid: false, 
      error: 'Validation error', 
      details: error.message 
    };
  }
}

/**
 * Validates any document file (PDF or image) for OCR processing
 * 
 * @param {string} filePath - Path to the document file
 * @returns {Object} - Validation result with success flag and error message if any
 */
function validateDocument(filePath) {
  if (!filePath) {
    return { 
      isValid: false, 
      error: 'No file path provided', 
      details: 'File path is required for validation' 
    };
  }

  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.pdf') {
    return validatePdf(filePath);
  } else if (['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp', '.gif'].includes(ext)) {
    return validateImage(filePath);
  } else {
    return { 
      isValid: false, 
      error: 'Unsupported file format', 
      details: `File extension ${ext} is not supported for OCR processing` 
    };
  }
}

module.exports = {
  validatePdf,
  validateImage,
  validateDocument
};