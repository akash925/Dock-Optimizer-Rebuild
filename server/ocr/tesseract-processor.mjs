/**
 * Tesseract.js OCR Processor
 * Real OCR implementation using Tesseract.js as fallback when PaddleOCR is not available
 */

import { createWorker } from 'tesseract.js';
import path from 'path';
import fs from 'fs';

let globalWorker = null;

/**
 * Initialize Tesseract.js worker
 */
async function initializeWorker() {
  if (globalWorker) {
    return globalWorker;
  }
  
  console.log('[TesseractOCR] Initializing Tesseract.js worker...');
  
  try {
    const worker = await createWorker();
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    
    globalWorker = worker;
    console.log('[TesseractOCR] ✅ Tesseract.js worker initialized successfully');
    
    return worker;
  } catch (error) {
    console.error('[TesseractOCR] ❌ Failed to initialize Tesseract.js worker:', error);
    throw error;
  }
}

/**
 * Process image file using Tesseract.js
 * @param {string} filePath - Path to the image file
 * @returns {Promise<Object>} - OCR result
 */
export async function processImageWithTesseract(filePath) {
  console.log(`[TesseractOCR] Processing image: ${filePath}`);
  
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Initialize worker if not already done
    const worker = await initializeWorker();
    
    // Process the image
    const startTime = Date.now();
    const { data } = await worker.recognize(filePath);
    const processingTime = (Date.now() - startTime) / 1000;
    
    console.log(`[TesseractOCR] ✅ OCR completed in ${processingTime}s`);
    console.log(`[TesseractOCR] Confidence: ${data.confidence}%`);
    console.log(`[TesseractOCR] Detected text length: ${data.text.length} characters`);
    
    // Extract BOL-specific fields from the text
    const extractedFields = extractBOLFields(data.text);
    
    return {
      success: true,
      processingTime,
      confidence: data.confidence,
      fullText: data.text,
      detectedFields: extractedFields,
      ocrEngine: 'tesseract.js',
      words: data.words || [],
      lines: data.lines || [],
      paragraphs: data.paragraphs || []
    };
    
  } catch (error) {
    console.error('[TesseractOCR] ❌ OCR processing failed:', error);
    return {
      success: false,
      error: error.message,
      errorType: error.name,
      ocrEngine: 'tesseract.js'
    };
  }
}

/**
 * Extract BOL-specific fields from OCR text
 * @param {string} text - Raw OCR text
 * @returns {Object} - Extracted fields
 */
function extractBOLFields(text) {
  const fields = {};
  
  // Define regex patterns for common BOL fields
  const patterns = {
    bolNumber: /(?:BOL|B\/L|BILL OF LADING|BOL#|B\/L#)[\s:]*([A-Z0-9\-]+)/i,
    customerName: /(?:SHIP TO|CONSIGNEE|CUSTOMER|TO)[\s:]*([A-Z\s&.,]+)/i,
    carrierName: /(?:CARRIER|SCAC|TRUCKING|FREIGHT)[\s:]*([A-Z\s&.,]+)/i,
    driverName: /(?:DRIVER|DRIVER NAME)[\s:]*([A-Z\s.,]+)/i,
    weight: /(?:WEIGHT|WT|GROSS|NET)[\s:]*([0-9,]+)[\s]*(LBS|KG|POUNDS)/i,
    pieces: /(?:PIECES|UNITS|QTY|QUANTITY)[\s:]*([0-9,]+)/i,
    date: /(?:DATE|SHIPPED|PICKUP)[\s:]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i,
    trailerNumber: /(?:TRAILER|TRAILER#|TRL|TRL#)[\s:]*([A-Z0-9\-]+)/i,
    truckNumber: /(?:TRUCK|TRUCK#|TRACTOR|TRACTOR#)[\s:]*([A-Z0-9\-]+)/i,
    poNumber: /(?:PO|P\.O\.|PURCHASE ORDER|PO#)[\s:]*([A-Z0-9\-]+)/i
  };
  
  // Extract fields using regex patterns
  for (const [fieldName, pattern] of Object.entries(patterns)) {
    const match = text.match(pattern);
    if (match && match[1]) {
      fields[fieldName] = match[1].trim();
    }
  }
  
  // Clean up extracted fields
  Object.keys(fields).forEach(key => {
    if (fields[key]) {
      fields[key] = fields[key].replace(/[^\w\s\-.,&]/g, '').trim();
    }
  });
  
  return fields;
}

/**
 * Terminate the Tesseract.js worker
 */
export async function terminateWorker() {
  if (globalWorker) {
    console.log('[TesseractOCR] Terminating Tesseract.js worker...');
    await globalWorker.terminate();
    globalWorker = null;
    console.log('[TesseractOCR] ✅ Tesseract.js worker terminated');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await terminateWorker();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await terminateWorker();
  process.exit(0);
});