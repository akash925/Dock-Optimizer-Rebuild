/**
 * Document Validator Utility (ESM Version)
 * 
 * Provides validation for uploaded documents before they are processed
 * for OCR or other operations.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../logger.js';

// Get the directory name in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Maximum file sizes for different file types (in bytes)
const MAX_SIZES = {
  IMAGE: 10 * 1024 * 1024, // 10 MB
  PDF: 20 * 1024 * 1024,   // 20 MB
  GENERIC: 15 * 1024 * 1024 // 15 MB default
};

// Minimum file size to be considered valid (100 bytes)
const MIN_FILE_SIZE = 100;

/**
 * Validate a document file
 * 
 * @param {string} filePath - Path to the document file
 * @returns {Object} - Validation result with success flag and error message if any
 */
export function validateDocument(filePath) {
  try {
    // Basic file existence check
    if (!fs.existsSync(filePath)) {
      return {
        isValid: false,
        error: 'File not found',
        details: `The file at path ${filePath} does not exist`
      };
    }

    // Get file stats
    const stats = fs.statSync(filePath);
    
    // Check for empty file
    if (stats.size === 0) {
      return {
        isValid: false,
        error: 'Empty file',
        details: 'The file is empty (0 bytes)'
      };
    }
    
    // Check for minimum file size
    if (stats.size < MIN_FILE_SIZE) {
      return {
        isValid: false,
        error: 'File too small',
        details: `The file is too small (${stats.size} bytes) to be processed properly`
      };
    }
    
    // Get file extension
    const ext = path.extname(filePath).toLowerCase();
    
    // Determine max size based on file type
    let maxSize = MAX_SIZES.GENERIC;
    let fileType = 'document';
    
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'].includes(ext)) {
      maxSize = MAX_SIZES.IMAGE;
      fileType = 'image';
    } else if (ext === '.pdf') {
      maxSize = MAX_SIZES.PDF;
      fileType = 'PDF';
    }
    
    // Check file size
    if (stats.size > maxSize) {
      return {
        isValid: false,
        error: 'File too large',
        details: `The ${fileType} file exceeds the maximum allowed size of ${formatBytes(maxSize)}`
      };
    }
    
    // Additional format-specific validations could be added here
    
    // If all checks pass, return valid
    return {
      isValid: true,
      fileType,
      size: stats.size,
      formattedSize: formatBytes(stats.size)
    };
    
  } catch (error) {
    logger.error('DocumentValidator', `Error validating document: ${error.message}`, error);
    return {
      isValid: false,
      error: 'Validation error',
      details: `An error occurred while validating the document: ${error.message}`
    };
  }
}

/**
 * Format bytes to human-readable string
 * 
 * @param {number} bytes - Bytes to format
 * @param {number} decimals - Decimal places
 * @returns {string} - Formatted string
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}