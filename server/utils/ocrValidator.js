/**
 * OCR Result Validator
 * 
 * Utilities to validate OCR results from various processing engines
 * and determine if they're usable for business processes.
 */

/**
 * Validates OCR results to determine if they contain enough information to be usable
 * 
 * @param {Object} ocrResult - The result object from OCR processing
 * @returns {boolean} - Whether the OCR result is valid and usable
 */
export function validateOcrResult(ocrResult) {
  // If the result is null or undefined, it's invalid
  if (!ocrResult) {
    return false;
  }
  
  // If the OCR processing explicitly failed
  if (ocrResult.success === false) {
    return false;
  }
  
  // Check if we have text detection results
  if (!ocrResult.result || !Array.isArray(ocrResult.result)) {
    return false;
  }
  
  // Check if we detected any text at all (at least some lines)
  if (ocrResult.result.length === 0) {
    return false;
  }
  
  // PaddleOCR returns an array of detected text regions
  // Check if we have a minimum number of detected regions (arbitrary threshold)
  // For a typical BOL, we'd expect at least 10 text regions
  const minimumTextRegions = 5;
  if (ocrResult.result.length < minimumTextRegions) {
    return false;
  }
  
  // Count the total characters detected
  // A valid BOL should have at least some meaningful text (e.g., 100 characters)
  let totalCharacters = 0;
  for (const textRegion of ocrResult.result) {
    // PaddleOCR format: [[[x1,y1],[x2,y2],[x3,y3],[x4,y4]], text, confidence]
    if (Array.isArray(textRegion) && textRegion.length >= 2 && typeof textRegion[1] === 'string') {
      totalCharacters += textRegion[1].length;
    }
  }
  
  const minimumCharacters = 50;
  if (totalCharacters < minimumCharacters) {
    return false;
  }
  
  // If we've passed all checks, the OCR result is valid
  return true;
}

/**
 * Extract structured fields from OCR results
 * 
 * @param {Object} ocrResult - The result object from OCR processing 
 * @returns {Object} - Extracted structured fields like BOL number, carrier, etc.
 */
export function extractFieldsFromOcrResults(ocrResult) {
  if (!validateOcrResult(ocrResult)) {
    return { valid: false };
  }
  
  const extractedFields = {
    valid: true,
    bolNumber: null,
    poNumber: null,
    carrierName: null,
    mcNumber: null,
    shipDate: null,
    deliveryDate: null,
    trailerNumber: null,
    weight: null,
    shipperName: null,
    consigneeName: null
  };
  
  // Convert OCR results to a flat array of text lines
  const textLines = [];
  for (const textRegion of ocrResult.result) {
    if (Array.isArray(textRegion) && textRegion.length >= 2 && typeof textRegion[1] === 'string') {
      textLines.push(textRegion[1].trim());
    }
  }
  
  // Extract BOL number using various patterns
  for (const line of textLines) {
    // Common BOL number patterns
    const bolPatterns = [
      /B[O0]L\s*(?:No|Number|#)?[:.\s-]*\s*([A-Z0-9]{4,12})/i,
      /Bill of Lading\s*(?:No|Number|#)?[:.\s-]*\s*([A-Z0-9]{4,12})/i,
      /(?:BOL|SHIPPING)\s*(?:No|Number|#)?[:.\s-]*\s*([A-Z0-9]{4,12})/i,
      /(?:^|\s)BOL[:.\s-]*\s*([A-Z0-9]{4,12})/i
    ];
    
    for (const pattern of bolPatterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        extractedFields.bolNumber = match[1].trim();
        break;
      }
    }
    
    // Stop once we find a BOL number
    if (extractedFields.bolNumber) {
      break;
    }
  }
  
  // Extract PO number
  for (const line of textLines) {
    const poPatterns = [
      /P[O0][:.\s-]*\s*(?:No|Number|#)?[:.\s-]*\s*([A-Z0-9]{4,12})/i,
      /Purchase Order\s*(?:No|Number|#)?[:.\s-]*\s*([A-Z0-9]{4,12})/i,
      /(?:^|\s)PO[:.\s-]*\s*([A-Z0-9]{4,12})/i
    ];
    
    for (const pattern of poPatterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        extractedFields.poNumber = match[1].trim();
        break;
      }
    }
    
    if (extractedFields.poNumber) {
      break;
    }
  }
  
  // Extract MC number
  for (const line of textLines) {
    const mcPatterns = [
      /MC\s*(?:No|Number|#)?[:.\s-]*\s*([0-9]{5,8})/i,
      /Motor Carrier\s*(?:No|Number|#)?[:.\s-]*\s*([0-9]{5,8})/i,
      /(?:^|\s)MC[:.\s-]*\s*([0-9]{5,8})/i
    ];
    
    for (const pattern of mcPatterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        extractedFields.mcNumber = match[1].trim();
        break;
      }
    }
    
    if (extractedFields.mcNumber) {
      break;
    }
  }
  
  // Extract trailer number
  for (const line of textLines) {
    const trailerPatterns = [
      /Trailer\s*(?:No|Number|#)?[:.\s-]*\s*([A-Z0-9]{4,12})/i,
      /(?:^|\s)TRL[:.\s-]*\s*([A-Z0-9]{4,12})/i
    ];
    
    for (const pattern of trailerPatterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        extractedFields.trailerNumber = match[1].trim();
        break;
      }
    }
    
    if (extractedFields.trailerNumber) {
      break;
    }
  }
  
  // Extract weight
  for (const line of textLines) {
    const weightPatterns = [
      /Weight[:.\s-]*\s*([0-9,.]+)\s*(?:LBS|KG)/i,
      /([0-9,.]+)\s*(?:LBS|KG)/i,
      /Total Weight[:.\s-]*\s*([0-9,.]+)/i
    ];
    
    for (const pattern of weightPatterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        // Clean up weight value (remove commas)
        extractedFields.weight = match[1].replace(/,/g, '').trim();
        break;
      }
    }
    
    if (extractedFields.weight) {
      break;
    }
  }
  
  return extractedFields;
}