/**
 * BOL OCR Routes
 * 
 * API endpoints for processing Bill of Lading (BOL) images using OCR.
 * 
 * @module server/routes/bol-ocr
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { processImageFile, processBase64Image, testOcr } from '../ocr/ocr_connector.mjs';

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'bol');
    
    // Create the upload directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename with timestamp and original extension
    const extension = path.extname(file.originalname);
    const filename = `bol_${Date.now()}${extension}`;
    cb(null, filename);
  }
});

// File filter to only allow images and PDFs
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 
    'image/png', 
    'image/tiff', 
    'application/pdf'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Only JPEG, PNG, TIFF, and PDF are supported.`), false);
  }
};

// Set up multer upload with file size limits
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  }
});

/**
 * @api {post} /api/bol-ocr/upload Process BOL image upload
 * @apiDescription Upload a BOL image and process it with OCR
 * @apiName UploadBOL
 * @apiGroup BOL OCR
 * 
 * @apiParam {File} bolImage The BOL image file to process
 * 
 * @apiSuccess {Boolean} success Whether the OCR processing was successful
 * @apiSuccess {Object} data The OCR processing results
 */
router.post('/upload', upload.single('bolImage'), async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Please provide a BOL image file.'
      });
    }
    
    // Log file details
    console.log(`Processing BOL image: ${req.file.originalname}, size: ${req.file.size} bytes, path: ${req.file.path}`);
    
    // Process the uploaded file with OCR
    const result = await processImageFile(req.file.path);
    
    // Add the file information to the result
    result.file = {
      originalName: req.file.originalname,
      name: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype
    };
    
    // Return the OCR results
    res.json(result);
    
  } catch (error) {
    console.error('Error processing BOL image:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while processing the BOL image.'
    });
  }
});

/**
 * @api {post} /api/bol-ocr/process-base64 Process BOL base64 image
 * @apiDescription Process a base64-encoded BOL image with OCR
 * @apiName ProcessBase64BOL
 * @apiGroup BOL OCR
 * 
 * @apiParam {String} imageData Base64-encoded image data
 * 
 * @apiSuccess {Boolean} success Whether the OCR processing was successful
 * @apiSuccess {Object} data The OCR processing results
 */
router.post('/process-base64', async (req, res) => {
  try {
    const { imageData } = req.body;
    
    // Validate the request
    if (!imageData) {
      return res.status(400).json({
        success: false,
        error: 'No image data provided. Please provide base64-encoded image data.'
      });
    }
    
    // Process the base64 image data with OCR
    const result = await processBase64Image(imageData);
    
    // Return the OCR results
    res.json(result);
    
  } catch (error) {
    console.error('Error processing base64 BOL image:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while processing the base64 BOL image.'
    });
  }
});

/**
 * @api {get} /api/bol-ocr/test Test OCR functionality
 * @apiDescription Test the OCR functionality with a sample image
 * @apiName TestOCR
 * @apiGroup BOL OCR
 * 
 * @apiSuccess {Boolean} success Whether the OCR test was successful
 * @apiSuccess {String} message Test result message
 * @apiSuccess {String} [detectedText] The text detected in the test image (if successful)
 */
router.get('/test', async (req, res) => {
  try {
    // Run the OCR test
    const result = await testOcr();
    
    // Return the test results
    res.json(result);
    
  } catch (error) {
    console.error('Error testing OCR:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while testing the OCR functionality.'
    });
  }
});

/**
 * @api {post} /api/bol-ocr/extract-fields Extract fields from BOL OCR results
 * @apiDescription Extract specific fields from BOL OCR results 
 * @apiName ExtractFieldsBOL
 * @apiGroup BOL OCR
 * 
 * @apiParam {Object} ocrResults The OCR results from processing a BOL image
 * 
 * @apiSuccess {Boolean} success Whether the field extraction was successful
 * @apiSuccess {Object} extractedFields The extracted fields from the BOL
 */
router.post('/extract-fields', async (req, res) => {
  try {
    const { ocrResults } = req.body;
    
    // Validate the request
    if (!ocrResults) {
      return res.status(400).json({
        success: false,
        error: 'No OCR results provided. Please provide OCR results to extract fields from.'
      });
    }
    
    // Extract common fields from the OCR results
    const extractedFields = extractFieldsFromOcrResults(ocrResults);
    
    // Return the extracted fields
    res.json({
      success: true,
      extractedFields
    });
    
  } catch (error) {
    console.error('Error extracting fields from BOL OCR results:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while extracting fields from the BOL OCR results.'
    });
  }
});

/**
 * Helper function to extract common fields from BOL OCR results
 * 
 * @param {Object} ocrResults The OCR results from processing a BOL image
 * @returns {Object} The extracted fields
 */
function extractFieldsFromOcrResults(ocrResults) {
  // Initialize extracted fields
  const extractedFields = {
    bolNumber: null,
    poNumber: null,
    carrier: null,
    trailerNumber: null,
    shipDate: null,
    deliveryDate: null,
    origin: null,
    destination: null,
    weight: null,
    itemCount: null,
  };
  
  try {
    if (!ocrResults || !ocrResults.success) {
      return extractedFields;
    }
    
    // Get the full text from OCR results
    const fullText = ocrResults.full_text && ocrResults.full_text.text 
      ? ocrResults.full_text.text 
      : '';
    
    // Extract BOL Number
    const bolNumberPatterns = [
      /BOL\s*(?:Number|No|#|)\s*[:. #]*\s*([A-Z0-9-]{3,20})/i,
      /(?:Bill\s*of\s*Lading|B\/L)\s*(?:Number|No|#|)\s*[:. #]*\s*([A-Z0-9-]{3,20})/i,
      /(?:^|\s)BOL\s*[:. #]*\s*([A-Z0-9-]{3,20})/i
    ];
    extractedFields.bolNumber = extractFirstMatch(fullText, bolNumberPatterns);
    
    // Extract PO Number
    const poNumberPatterns = [
      /PO\s*(?:Number|No|#|)\s*[:. #]*\s*([A-Z0-9-]{3,20})/i,
      /(?:Purchase\s*Order|P\.O\.)\s*(?:Number|No|#|)\s*[:. #]*\s*([A-Z0-9-]{3,20})/i,
      /(?:^|\s)PO\s*[:. #]*\s*([A-Z0-9-]{3,20})/i
    ];
    extractedFields.poNumber = extractFirstMatch(fullText, poNumberPatterns);
    
    // Extract Carrier
    const carrierPatterns = [
      /Carrier\s*[:. ]*\s*([A-Za-z0-9\s.&'-]{3,30})/i,
      /Carrier\s*Name\s*[:. ]*\s*([A-Za-z0-9\s.&'-]{3,30})/i,
      /Transported\s*By\s*[:. ]*\s*([A-Za-z0-9\s.&'-]{3,30})/i
    ];
    extractedFields.carrier = extractFirstMatch(fullText, carrierPatterns);
    
    // Extract Trailer Number
    const trailerNumberPatterns = [
      /Trailer\s*(?:Number|No|#|)\s*[:. #]*\s*([A-Z0-9-]{3,20})/i,
      /(?:^|\s)Trailer\s*[:. #]*\s*([A-Z0-9-]{3,20})/i,
      /(?:^|\s)Trailer\s*ID\s*[:. #]*\s*([A-Z0-9-]{3,20})/i
    ];
    extractedFields.trailerNumber = extractFirstMatch(fullText, trailerNumberPatterns);
    
    // Extract dates (ship date, delivery date)
    const datePatterns = [
      /(?:Ship|Shipment)\s*(?:Date|Dt)\s*[:. ]*\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
      /(?:Ship|Shipment)\s*(?:Date|Dt)\s*[:. ]*\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})/i,
      /(?:Delivery|Delivery\s*Date|Del\s*Date|Deliver\s*By)\s*[:. ]*\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
      /(?:Delivery|Delivery\s*Date|Del\s*Date|Deliver\s*By)\s*[:. ]*\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})/i
    ];
    
    // Extract dates from the text
    const dates = [];
    datePatterns.forEach(pattern => {
      const match = fullText.match(pattern);
      if (match && match[1]) {
        dates.push({
          context: match[0].substring(0, 20), // Get context to determine if it's ship or delivery date
          date: match[1].trim()
        });
      }
    });
    
    // Assign ship date and delivery date based on context
    dates.forEach(dateObj => {
      if (dateObj.context.toLowerCase().includes('ship')) {
        extractedFields.shipDate = dateObj.date;
      } else if (dateObj.context.toLowerCase().includes('delivery') || 
                 dateObj.context.toLowerCase().includes('deliver')) {
        extractedFields.deliveryDate = dateObj.date;
      }
    });
    
    // Extract weight
    const weightPatterns = [
      /(?:Total|Gross)\s*Weight\s*[:. ]*\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:lbs|pounds|kg)/i,
      /Weight\s*[:. ]*\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:lbs|pounds|kg)/i,
      /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:lbs|pounds|kg)/i
    ];
    extractedFields.weight = extractFirstMatch(fullText, weightPatterns);
    
    // Extract item count
    const itemCountPatterns = [
      /(?:Total|Number\s*of)\s*(?:Items|Pieces|Packages|Pallets)\s*[:. ]*\s*(\d+)/i,
      /(?:Items|Pieces|Packages|Pallets)\s*[:. ]*\s*(\d+)/i,
      /(?:Item|Piece|Package|Pallet)\s*Count\s*[:. ]*\s*(\d+)/i
    ];
    extractedFields.itemCount = extractFirstMatch(fullText, itemCountPatterns);
    
    // Extract address information (for origin and destination)
    // This is a more complex pattern that looks for address-like patterns
    const addressPatterns = [
      /(?:Ship|Shipped)\s*(?:From|To)\s*[:. ]*\s*([A-Za-z0-9\s.,'-]{10,100})/i,
      /(?:Origin|Source|Pickup)\s*[:. ]*\s*([A-Za-z0-9\s.,'-]{10,100})/i,
      /(?:Destination|Deliver\s*To|Consignee)\s*[:. ]*\s*([A-Za-z0-9\s.,'-]{10,100})/i
    ];
    
    // Extract addresses from the text
    const addresses = [];
    addressPatterns.forEach(pattern => {
      const match = fullText.match(pattern);
      if (match && match[1]) {
        addresses.push({
          context: match[0].substring(0, 20), // Get context to determine if it's origin or destination
          address: match[1].trim()
        });
      }
    });
    
    // Assign origin and destination based on context
    addresses.forEach(addrObj => {
      const context = addrObj.context.toLowerCase();
      if (context.includes('from') || context.includes('origin') || context.includes('source') || 
          context.includes('pickup')) {
        extractedFields.origin = addrObj.address;
      } else if (context.includes('to') || context.includes('destination') || 
                context.includes('deliver') || context.includes('consignee')) {
        extractedFields.destination = addrObj.address;
      }
    });
    
    // Try to extract additional information from tables
    if (ocrResults.tables && ocrResults.tables.length > 0) {
      ocrResults.tables.forEach(table => {
        if (table.data && Array.isArray(table.data)) {
          table.data.forEach(row => {
            if (Array.isArray(row) && row.length >= 2) {
              const label = row[0].toLowerCase();
              const value = row[1];
              
              // Look for specific labels in the table rows
              if (label.includes('bol') || label.includes('bill of lading')) {
                extractedFields.bolNumber = extractedFields.bolNumber || value;
              } else if (label.includes('po') || label.includes('purchase order')) {
                extractedFields.poNumber = extractedFields.poNumber || value;
              } else if (label.includes('carrier')) {
                extractedFields.carrier = extractedFields.carrier || value;
              } else if (label.includes('trailer')) {
                extractedFields.trailerNumber = extractedFields.trailerNumber || value;
              } else if (label.includes('ship date')) {
                extractedFields.shipDate = extractedFields.shipDate || value;
              } else if (label.includes('delivery date')) {
                extractedFields.deliveryDate = extractedFields.deliveryDate || value;
              } else if (label.includes('weight')) {
                extractedFields.weight = extractedFields.weight || value;
              } else if (label.includes('items') || label.includes('pieces') || 
                         label.includes('packages') || label.includes('pallets')) {
                extractedFields.itemCount = extractedFields.itemCount || value;
              }
            }
          });
        }
      });
    }
    
    return extractedFields;
    
  } catch (error) {
    console.error('Error extracting fields from OCR results:', error);
    return extractedFields;
  }
}

/**
 * Helper function to extract the first match from text using multiple patterns
 * 
 * @param {string} text The text to search
 * @param {RegExp[]} patterns Array of regex patterns to try
 * @returns {string|null} The first match found or null
 */
function extractFirstMatch(text, patterns) {
  if (!text) return null;
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}

// Use ES module export
export default router;