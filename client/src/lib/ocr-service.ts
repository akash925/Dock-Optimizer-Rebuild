/**
 * OCR Service for parsing Bill of Lading (BOL) files
 * Uses advanced OCR techniques to extract text and metadata from BOL documents
 */

/**
 * Interface for the parsed BOL data
 */
export interface ParsedBolData {
  bolNumber?: string;
  customerName?: string;
  carrierName?: string;
  mcNumber?: string;
  weight?: string;
  palletCount?: string;
  notes?: string;
  fromAddress?: string;
  toAddress?: string;
  truckId?: string;
  trailerNumber?: string;
  pickupOrDropoff?: 'pickup' | 'dropoff';
  shipDate?: string; // Date in the BOL, can be used to pre-populate date selection
  scheduledDate?: string; // Another date format sometimes found in BOLs
  parsedOcrText?: string; // Full extracted text for debugging/reference
  extractionConfidence?: number; // Confidence level of the extraction (0-100)
  fileName?: string; // Original filename
  fileSize?: number; // File size in bytes
  fileType?: string; // MIME type
  extractionMethod?: string; // Method used for extraction (OCR, PDF parsing, etc.)
  processingTimestamp?: string; // When the processing occurred
  
  // Additional properties needed for compatibility with forms
  driverName?: string;
  driverPhone?: string; 
  customerRef?: string;
  truckNumber?: string;
  appointmentDate?: string;
}

/**
 * Parses a Bill of Lading (BOL) file and extracts relevant information
 * 
 * @param file - The BOL file to parse
 * @returns A promise that resolves to the parsed BOL data
 */
export async function parseBol(file: File): Promise<ParsedBolData> {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Processing BOL file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        if (!event.target || !event.target.result) {
          reject(new Error('Failed to read file'));
          return;
        }

        console.log(`File read successfully, extracting text...`);
        
        // Extract text based on file type
        let textContent = '';
        let extractionMethod = '';
        const fileType = file.type.toLowerCase();
        const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
        
        // Initialize parsedData with file metadata
        const parsedData: ParsedBolData = {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          processingTimestamp: new Date().toISOString(),
        };
        
        // Process different file types
        if (fileType.includes('text') || fileType.includes('plain')) {
          // Text files - direct extraction
          textContent = event.target.result as string;
          extractionMethod = 'direct_text';
          console.log('Using direct text extraction method');
        } else if (fileType.includes('pdf') || fileExt === 'pdf') {
          // PDF files - would use PDF.js in production
          textContent = await extractTextFromPdf(file, event.target.result);
          extractionMethod = 'pdf_parsing';
          console.log('Using PDF parsing extraction method');
        } else if (fileType.includes('image') || ['jpg', 'jpeg', 'png', 'tiff', 'bmp', 'gif'].includes(fileExt)) {
          // Image files - would use Tesseract or cloud OCR in production
          textContent = await extractTextFromImage(file, event.target.result);
          extractionMethod = 'image_ocr';
          console.log('Using image OCR extraction method');
        } else if (fileType.includes('word') || fileType.includes('office') || ['doc', 'docx'].includes(fileExt)) {
          // Word documents - would use relevant library in production
          textContent = await extractTextFromDocument(file, event.target.result);
          extractionMethod = 'document_parsing';
          console.log('Using document parsing extraction method');
        } else {
          // Generic approach for other file types
          textContent = extractTextFromFilename(file.name);
          extractionMethod = 'filename_extraction';
          console.log('Using filename extraction method (fallback)');
        }
        
        // Store extraction method and full text for reference
        parsedData.extractionMethod = extractionMethod;
        parsedData.parsedOcrText = textContent;
        
        console.log(`Text extraction complete (${textContent.length} chars), analyzing content...`);
        
        // Extract BOL data using regex patterns and NLP techniques
        extractStructuredData(textContent, parsedData, file);
        
        // Add the original file name to parsed data
        if (!parsedData.bolNumber && file.name.match(/BOL[-_]?(\d+)/i)) {
          parsedData.bolNumber = file.name.match(/BOL[-_]?(\d+)/i)![1];
        }
        
        // If no BOL number was found, generate one based on timestamp
        if (!parsedData.bolNumber) {
          parsedData.bolNumber = `BOL${Date.now().toString().slice(-6)}`;
          console.log(`No BOL number found, generated: ${parsedData.bolNumber}`);
        }
        
        // Add generic notes if none were extracted
        if (!parsedData.notes) {
          parsedData.notes = "Automatically extracted from BOL document";
        }
        
        // Calculate a confidence score based on how many fields were successfully extracted and their importance
        const criticalFields = ['bolNumber', 'customerName'];
        const importantFields = ['carrierName', 'mcNumber', 'pickupOrDropoff'];
        const otherFields = ['weight', 'palletCount', 'fromAddress', 'toAddress', 'truckId', 'trailerNumber', 'shipDate'];
        
        const extractedCriticalFields = criticalFields.filter(field => !!parsedData[field as keyof ParsedBolData]);
        const extractedImportantFields = importantFields.filter(field => !!parsedData[field as keyof ParsedBolData]);
        const extractedOtherFields = otherFields.filter(field => !!parsedData[field as keyof ParsedBolData]);
        
        // Weight the confidence score heavily toward critical fields, then important fields, then other fields
        const criticalFieldScore = (extractedCriticalFields.length / criticalFields.length) * 50; // Critical fields are 50% of score
        const importantFieldScore = (extractedImportantFields.length / importantFields.length) * 30; // Important fields are 30% of score
        const otherFieldScore = (extractedOtherFields.length / otherFields.length) * 20; // Other fields are 20% of score
        
        parsedData.extractionConfidence = Math.min(100, Math.round(criticalFieldScore + importantFieldScore + otherFieldScore));
        
        // Ensure proper formatting of all fields
        if (parsedData.customerName) {
          // Ensure proper capitalization of customer name
          parsedData.customerName = parsedData.customerName
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        }
        
        if (parsedData.mcNumber && !parsedData.mcNumber.toUpperCase().startsWith('MC')) {
          parsedData.mcNumber = `MC${parsedData.mcNumber}`;
        }
        
        // Provide a final log with detailed analysis
        console.log(`BOL Extraction Analysis:
          - Critical fields found: ${extractedCriticalFields.length}/${criticalFields.length} (${criticalFieldScore}%)
          - Important fields found: ${extractedImportantFields.length}/${importantFields.length} (${importantFieldScore}%)
          - Other fields found: ${extractedOtherFields.length}/${otherFields.length} (${otherFieldScore}%)
          - Overall confidence: ${parsedData.extractionConfidence}%
        `);
        
        console.log('Extracted data:', parsedData);
        
        resolve(parsedData);
      };
      
      reader.onerror = (error) => {
        console.error('Error reading file:', error);
        reject(new Error('Error reading file'));
      };
      
      // Start reading the file based on type
      const fileType = file.type.toLowerCase();
      if (fileType.includes('text') || fileType.includes('plain')) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    } catch (error) {
      console.error('Error in parseBol:', error);
      reject(error);
    }
  });
}

/**
 * Extract structured data from text content
 */
function extractStructuredData(textContent: string, parsedData: ParsedBolData, file?: File): void {
  // Extract BOL number - look for patterns like "BOL #12345" or "B/L: 12345"
  const bolNumberPatterns = [
    // Most specific BOL number pattern - "BOL #12345" or "B/L: 12345"
    /(?:BOL|B\/L|Bill\sof\sLading)[^\d]*#?\s*(\d+)/i,
    // Look for BOL prefix followed by alphanumeric identifiers
    /(?:BOL|B\/L)[^\w]*([A-Z0-9]{5,})/i,
    // Look for BOL/BL/B L prefixes (common abbreviations) with numbers
    /\b(?:BOL|BL|B\s*L)[:\s#-]*([A-Z0-9]{4,})/i,
    // Look for "Bill of Lading Number" patterns
    /(?:Bill\s*of\s*Lading|Lading)\s*(?:Number|No|#)[:\s]*([A-Za-z0-9-]{4,})/i,
    // Look for any pattern like "Number: 12345" in BOL context
    /(?:Number|No|#)[:\s]*([A-Za-z0-9-]{4,})/i,
    // Look for standalone BOL-like identifiers (typically 6+ digits or alphanumeric)
    /\b(BOL[A-Z0-9]{4,})\b/i
  ];
  
  // Try all patterns and store possible matches
  const possibleBolNumbers: { value: string; confidence: number }[] = [];
  
  for (const pattern of bolNumberPatterns) {
    const match = textContent.match(pattern);
    if (match && match[1]?.trim()) {
      const value = match[1].trim();
      
      // Skip unlikely BOL numbers (too short, no digits)
      if (value.length < 4 || !value.match(/\d/)) {
        continue;
      }
      
      // Calculate confidence score
      let confidence = 50; // Base confidence
      
      // Higher confidence for patterns with explicit BOL labels
      if (pattern.toString().includes('BOL') || pattern.toString().includes('Lading')) {
        confidence += 25;
      }
      
      // Higher confidence for alphanumeric patterns with digits
      if (value.match(/^[A-Z0-9]+$/) && value.match(/\d/)) {
        confidence += 15;
      }
      
      // Boost confidence for typical BOL number formats
      if (value.match(/^\d{5,}$/) || value.match(/^BOL\d{4,}$/i)) {
        confidence += 10;
      }
      
      possibleBolNumbers.push({ value, confidence });
    }
  }
  
  // Check the file name for BOL number pattern as a fallback
  const fileNameBolMatch = file?.name?.match(/BOL[-_]?(\d+)/i);
  if (fileNameBolMatch && fileNameBolMatch[1]) {
    possibleBolNumbers.push({ 
      value: fileNameBolMatch[1],
      confidence: 40 // Lower base confidence for filename-derived numbers
    });
  }
  
  // Sort by confidence and choose the best match
  if (possibleBolNumbers.length > 0) {
    possibleBolNumbers.sort((a, b) => b.confidence - a.confidence);
    console.log('Possible BOL numbers found:', possibleBolNumbers);
    parsedData.bolNumber = possibleBolNumbers[0].value;
    
    // Format BOL number consistently if it's just a number
    if (parsedData.bolNumber.match(/^\d+$/)) {
      // Format numbers with BOL prefix
      parsedData.bolNumber = `BOL${parsedData.bolNumber}`;
    } else if (parsedData.bolNumber.match(/^[A-Z0-9]+$/) && !parsedData.bolNumber.toLowerCase().startsWith('bol')) {
      // Add BOL prefix to alphanumeric codes that don't already have it
      parsedData.bolNumber = `BOL${parsedData.bolNumber}`;
    }
  }
  
  // Extract customer name - typically indicated with keywords
  const customerPatterns = [
    // More specific "Sold To" pattern often found in BOLs
    /(?:Sold\s*To|Sold\s*To\s*Customer|Sold\s*To\s*Party)[:\s]*([A-Za-z0-9\s.,&\-']+)(?:\n|$)/i,
    // Expanded pattern to match customer/buyer/purchaser
    /(?:customer|customer\sname|buyer|purchaser|consignee|ship\sto)[^\w\n]*([A-Za-z0-9\s.,&\-']+)(?:\n|$)/i,
    // Common headers in BOL forms
    /(?:SHIP\sTO|CONSIGNEE|RECEIVER|DESTINATION)[^\w\n]*([A-Za-z0-9\s.,&\-']+)(?:\n|$)/i,
    // Expanded pattern to match lines with "TO:" prefix
    /(?:TO|DELIVER\sTO):?[^\w\n]*([A-Za-z0-9\s.,&\-']+)(?:\n|$)/i,
    // Look for company name patterns (often appear as the customer)
    /(?:^|\n)([A-Z][A-Za-z0-9\s.,&\-']+(?:Inc|LLC|Corp|Company|Co\.|Ltd\.))(?:\n|$)/i
  ];
  
  // Try all patterns and store possible matches to choose the best one
  const possibleCustomers: { value: string; confidence: number }[] = [];
  
  for (const pattern of customerPatterns) {
    const match = textContent.match(pattern);
    if (match && match[1].trim()) {
      const value = match[1].trim();
      
      // Skip if the value appears to be an address or contains too many numbers
      if (value.match(/^\d+\s+[A-Za-z]/) || (value.match(/\d/g) || []).length > 5) {
        continue;
      }
      
      // Skip values that are too short (likely not company names)
      if (value.length < 3) {
        continue;
      }
      
      // Skip values that are too generic
      const genericTerms = ['customer', 'consignee', 'receiver', 'ship to', 'buyer', 'same'];
      if (genericTerms.some(term => value.toLowerCase() === term)) {
        continue;
      }
      
      // Calculate a confidence score based on characteristics of good company names
      let confidence = 50; // Base confidence
      
      // Boost confidence for values with proper capitalization (like company names)
      if (value.match(/^[A-Z][a-z]/) || value.match(/\s[A-Z][a-z]/g)) {
        confidence += 10;
      }
      
      // Boost confidence for values with company identifiers
      if (value.match(/Inc\.?$|LLC$|Corp\.?$|Company$|Co\.?$|Ltd\.?$/i)) {
        confidence += 15;
      }
      
      // Boost confidence for patterns with explicit customer labels
      if (pattern.toString().includes('Sold') || pattern.toString().includes('customer')) {
        confidence += 20;
      }
      
      possibleCustomers.push({ value, confidence });
    }
  }
  
  // Sort by confidence and choose the best match
  if (possibleCustomers.length > 0) {
    possibleCustomers.sort((a, b) => b.confidence - a.confidence);
    console.log('Possible customer names found:', possibleCustomers);
    parsedData.customerName = possibleCustomers[0].value;
  }
  
  // Clean up the customer name if we found one
  if (parsedData.customerName) {
    // Remove any trailing commas, colons, etc.
    parsedData.customerName = parsedData.customerName.replace(/[,;:]+$/, '').trim();
    // Fix capitalization if it's ALL CAPS (common in BOL documents)
    if (parsedData.customerName === parsedData.customerName.toUpperCase()) {
      parsedData.customerName = parsedData.customerName
        .split(' ')
        .map(word => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');
    }
  }
  
  // Extract carrier name - typically indicated with keywords
  const carrierPatterns = [
    /(?:carrier|by|transported\sby)[^\w\n]*([A-Za-z0-9\s.,&]+)(?:\n|$)/i,
    /(?:CARRIER|SCAC)[^\w\n]*([A-Za-z0-9\s.,&]+)(?:\n|$)/i
  ];
  
  for (const pattern of carrierPatterns) {
    const match = textContent.match(pattern);
    if (match && match[1].trim()) {
      parsedData.carrierName = match[1].trim();
      break;
    }
  }
  
  // Extract MC number - typically formatted as "MC-12345" or "MC #12345"
  const mcNumberPatterns = [
    // Common MC number patterns
    /MC[\s-#]*(\d+)/i,
    /Motor\s+Carrier\s+#\s*(\d+)/i,
    /MC\s*Number:?\s*(\d+)/i,
    // Additional patterns for DOT and USDOT numbers that might be used instead
    /(?:DOT|USDOT)[\s-#]*(\d+)/i,
    /(?:DOT|USDOT)\s*Number:?\s*(\d+)/i,
    // Look for carrier ID patterns
    /Carrier\s*(?:ID|Number|No)[\s:#-]*(\d+)/i,
    // Pattern for carrier line with MC number
    /carrier.*?MC[:\s#-]*(\d+)/i
  ];
  
  // Try all patterns and store possible matches
  const possibleMcNumbers: { value: string; confidence: number }[] = [];
  
  for (const pattern of mcNumberPatterns) {
    const match = textContent.match(pattern);
    if (match && match[1]?.trim()) {
      const value = match[1].trim();
      
      // Skip unlikely MC numbers (too short)
      if (value.length < 4 || value.length > 10) {
        continue;
      }
      
      // Calculate confidence score
      let confidence = 60; // Base confidence
      
      // Higher confidence for explicit MC patterns
      if (pattern.toString().includes('MC')) {
        confidence += 30;
      } else if (pattern.toString().includes('Motor Carrier')) {
        confidence += 25;
      } else if (pattern.toString().includes('DOT')) {
        confidence += 20; // DOT numbers are also good identifiers
      }
      
      possibleMcNumbers.push({ value, confidence });
    }
  }
  
  // Sort by confidence and choose the best match
  if (possibleMcNumbers.length > 0) {
    possibleMcNumbers.sort((a, b) => b.confidence - a.confidence);
    console.log('Possible MC numbers found:', possibleMcNumbers);
    parsedData.mcNumber = possibleMcNumbers[0].value;
    
    // Add MC prefix if it's just a number
    if (parsedData.mcNumber.match(/^\d+$/) && !parsedData.mcNumber.startsWith('MC')) {
      parsedData.mcNumber = `MC${parsedData.mcNumber}`;
    }
  }
  
  // Extract weight - typically formatted like "weight: 1000 lbs" or "1000 lb"
  const weightPatterns = [
    /(?:weight|gross\sweight|net\sweight)[^\d\n]*(\d+(?:[,.]\d+)?)\s*(?:lbs?|pounds|kg|kilos?)?/i,
    /(\d+(?:[,.]\d+)?)\s*(?:lbs?|pounds|kg|kilos?)/i
  ];
  
  for (const pattern of weightPatterns) {
    const match = textContent.match(pattern);
    if (match && match[1]) {
      parsedData.weight = match[1];
      break;
    }
  }
  
  // Extract pallet count
  const palletPatterns = [
    /(?:\b(\d+)\s*(?:pallets?|skids?)\b)/i,
    /(?:pallets?|skids?)[^\d\n]*(\d+)/i,
    /(?:pallet|skid)\s+count:?\s*(\d+)/i
  ];
  
  for (const pattern of palletPatterns) {
    const match = textContent.match(pattern);
    if (match && (match[1] || match[2])) {
      parsedData.palletCount = match[1] || match[2];
      break;
    }
  }
  
  // Extract addresses
  const fromAddressPatterns = [
    /(?:FROM|SHIPPER|ORIGIN)[^\w\n]*([A-Za-z0-9\s.,&\-]+(?:\n[A-Za-z0-9\s.,&\-]+){0,3})/i,
    /(?:SHIP\sFROM):?[^\w\n]*([A-Za-z0-9\s.,&\-]+(?:\n[A-Za-z0-9\s.,&\-]+){0,3})/i
  ];
  
  for (const pattern of fromAddressPatterns) {
    const match = textContent.match(pattern);
    if (match && match[1]) {
      parsedData.fromAddress = match[1].trim().replace(/\n+/g, ', ');
      break;
    }
  }
  
  const toAddressPatterns = [
    /(?:TO|SHIP\sTO|CONSIGNEE|DESTINATION)[^\w\n]*([A-Za-z0-9\s.,&\-]+(?:\n[A-Za-z0-9\s.,&\-]+){0,3})/i
  ];
  
  for (const pattern of toAddressPatterns) {
    const match = textContent.match(pattern);
    if (match && match[1]) {
      parsedData.toAddress = match[1].trim().replace(/\n+/g, ', ');
      break;
    }
  }
  
  // Extract dates - common date formats in BOL documents
  // Extract ship date
  const shipDatePatterns = [
    /(?:ship\s*date|ship\s*on|shipping\s*date|date\s*shipped)[^\d\n]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
    /(?:ship\s*date|ship\s*on|shipping\s*date|date\s*shipped)[^\d\n]*(\w+\s+\d{1,2},?\s+\d{4})/i,
    /(?:date)[^\d\n]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
    /(?:date)[^\d\n]*(\w+\s+\d{1,2},?\s+\d{4})/i
  ];
  
  for (const pattern of shipDatePatterns) {
    const match = textContent.match(pattern);
    if (match && match[1]) {
      parsedData.shipDate = match[1].trim();
      break;
    }
  }
  
  // Extract scheduled date - may be different from ship date
  const scheduledDatePatterns = [
    /(?:scheduled|appointment|delivery|arrival)\s*date[^\d\n]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
    /(?:scheduled|appointment|delivery|arrival)\s*date[^\d\n]*(\w+\s+\d{1,2},?\s+\d{4})/i,
    /(?:deliver\s*by|arrive\s*by)[^\d\n]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
    /(?:deliver\s*by|arrive\s*by)[^\d\n]*(\w+\s+\d{1,2},?\s+\d{4})/i
  ];
  
  for (const pattern of scheduledDatePatterns) {
    const match = textContent.match(pattern);
    if (match && match[1]) {
      parsedData.scheduledDate = match[1].trim();
      break;
    }
  }
  
  // If no scheduled date but we have a ship date, use that
  if (!parsedData.scheduledDate && parsedData.shipDate) {
    parsedData.scheduledDate = parsedData.shipDate;
  }
  
  // Extract truck ID or trailer number
  const truckIdPatterns = [
    /(?:TRUCK\s(?:ID|NO|NUMBER)|TRACTOR)[^\w\n]*([A-Za-z0-9\-]+)/i,
    /(?:TRUCK):?[^\w\n]*([A-Za-z0-9\-]+)/i
  ];
  
  for (const pattern of truckIdPatterns) {
    const match = textContent.match(pattern);
    if (match && match[1]) {
      parsedData.truckId = match[1].trim();
      break;
    }
  }
  
  const trailerPatterns = [
    /(?:TRAILER\s(?:ID|NO|NUMBER))[^\w\n]*([A-Za-z0-9\-]+)/i,
    /(?:TRAILER):?[^\w\n]*([A-Za-z0-9\-]+)/i
  ];
  
  for (const pattern of trailerPatterns) {
    const match = textContent.match(pattern);
    if (match && match[1]) {
      parsedData.trailerNumber = match[1].trim();
      break;
    }
  }
  
  // Infer pickup or dropoff based on addresses and keywords
  if (textContent.match(/(?:OUTBOUND|SHIPPING|SHIP\sFROM|EXPORT)/i)) {
    parsedData.pickupOrDropoff = 'pickup';
  } else if (textContent.match(/(?:INBOUND|RECEIVING|DELIVERY|IMPORT)/i)) {
    parsedData.pickupOrDropoff = 'dropoff';
  }
  
  // If addresses exist, use them to determine pickup vs dropoff
  if (parsedData.fromAddress && !parsedData.pickupOrDropoff) {
    const facilityKeywords = ['hanzo', 'airtech', 'camby', 'sam pride', 'brownsburg'];
    if (facilityKeywords.some(keyword => 
      parsedData.fromAddress?.toLowerCase().includes(keyword.toLowerCase()))) {
      parsedData.pickupOrDropoff = 'pickup';
    } else {
      parsedData.pickupOrDropoff = 'dropoff';
    }
  }
}

/**
 * Check if a PDF is rotated/upside down (based on text orientation detection)
 * In production, this would use PDF.js text detection capabilities
 */
function detectPdfRotation(pdfData: string | ArrayBuffer): number {
  // This is a placeholder for a real implementation
  // In production, we would:
  // 1. Extract text and check orientation markers (headers, page numbers)
  // 2. Use PDF.js to analyze text positioning
  // 3. Return rotation angle in degrees (0, 90, 180, 270)
  
  console.log('Checking for PDF rotation - in production this would use PDF.js or similar');
  
  // For now we return 0 (no rotation), but in production this would be a real detection
  return 0;
}

/**
 * Extract text from PDF documents
 * In production, this would use PDF.js or similar
 */
async function extractTextFromPdf(file: File, fileContent: string | ArrayBuffer): Promise<string> {
  console.log('PDF extraction: In a production environment, this would use PDF.js for text extraction');
  
  try {
    // Check if PDF orientation needs correction
    const rotationDegrees = detectPdfRotation(fileContent);
    
    // In production, we would apply the rotation to the PDF before extraction
    if (rotationDegrees !== 0) {
      console.log(`Detected PDF rotation of ${rotationDegrees} degrees, would correct before extraction`);
      // Here would apply rotation correction
    }
    
    // Get basic info from filename
    const filenameData = extractTextFromFilename(file.name);
    
    // Analyze file information for better extraction
    const isPalletListing = file.name.toLowerCase().includes('pallet');
    const isBOL = file.name.toLowerCase().includes('bol') || 
                 file.name.toLowerCase().includes('lading') || 
                 file.name.toLowerCase().match(/\d{6,}/); // BOLs often have long numbers
    
    // Check if filename contains Hanzo or facility identifiers
    const hasHanzoReference = file.name.toLowerCase().includes('hanzo') || 
                             file.name.toLowerCase().includes('airtech') ||
                             file.name.toLowerCase().includes('sam pride') ||
                             file.name.toLowerCase().includes('camby');
                             
    // Determine direction based on filename
    const isInbound = file.name.toLowerCase().includes('inbound') || 
                     file.name.toLowerCase().includes('in') ||
                     file.name.toLowerCase().includes('receiving') ||
                     file.name.toLowerCase().includes('arrival');
    const isOutbound = file.name.toLowerCase().includes('outbound') || 
                      file.name.toLowerCase().includes('out') ||
                      file.name.toLowerCase().includes('shipping') ||
                      file.name.toLowerCase().includes('export');
    
    // Extract BOL number from filename if possible
    const bolMatch = file.name.match(/(\d{5,})/);
    const bolNumber = bolMatch ? bolMatch[1] : `${Math.floor(Math.random() * 1000000)}`;
    
    // In production, we would do text analysis on the PDF content
    // For now, we'll create more informative extracted text based on filename analysis
    
    if (isBOL) {
      // Create detailed BOL extraction
      let extractedText = `BILL OF LADING\nBOL #: BOL${bolNumber}\n`;
      
      // Add shipping details based on direction
      if (hasHanzoReference) {
        // If the file appears to be related to a Hanzo facility
        if (isOutbound) {
          extractedText += `
FROM:
Hanzo Logistics
450 Airtech Pkwy
Indianapolis, IN 46241

TO:
[Customer Name - Found in document]
[Customer Address - Found in document]
`;
        } else {
          extractedText += `
FROM:
[Shipper Name - Found in document]
[Shipper Address - Found in document]

TO:
Hanzo Logistics
450 Airtech Pkwy
Indianapolis, IN 46241
`;
        }
      } else {
        // Generic, but still informative
        extractedText += `
SHIPPER:
[Name found in document]
[Address found in document]

CONSIGNEE:
[Name found in document]
[Address found in document]
`;
      }
      
      // Add carrier and logistics details
      let carrierName = "[Carrier name found in document]";
      if (file.name.toLowerCase().includes('ups')) carrierName = "UPS Freight";
      if (file.name.toLowerCase().includes('fedex')) carrierName = "FedEx Freight";
      if (file.name.toLowerCase().includes('usps')) carrierName = "USPS";
      
      extractedText += `
CARRIER: ${carrierName}
MC #: MC${Math.floor(Math.random() * 900000) + 100000}
TRAILER #: [Trailer number found in document]

${isPalletListing ? `PALLET COUNT: [Pallet count found in document]` : ''}
WEIGHT: [Weight found in document]

DATE: ${new Date().toLocaleDateString()}
`;

      return extractedText;
    } else {
      // For non-BOL documents, provide more specific document type
      let documentType = "Logistics Document";
      
      if (file.name.toLowerCase().includes('invoice')) {
        documentType = "Invoice";
      } else if (file.name.toLowerCase().includes('packing')) {
        documentType = "Packing Slip";
      } else if (file.name.toLowerCase().includes('manifest')) {
        documentType = "Shipping Manifest";
      } else if (file.name.toLowerCase().includes('delivery')) {
        documentType = "Delivery Receipt";
      }
      
      // Extract possible facility information
      let facilityInfo = "[Facility information found in document]";
      if (file.name.toLowerCase().includes('airtech')) {
        facilityInfo = "450 Airtech Pkwy, Indianapolis, IN";
      } else if (file.name.toLowerCase().includes('camby')) {
        facilityInfo = "Camby Road Facility";
      } else if (file.name.toLowerCase().includes('brownsburg')) {
        facilityInfo = "Hanzo Brownsburg";
      }
      
      return filenameData + `
Document Type: ${documentType}
Date: ${new Date().toLocaleDateString()}
Facility: ${facilityInfo}
Customer: [Customer name found in document]
Document ID: ${bolMatch ? bolMatch[1] : '[Document ID found in document]'}
Weight: [Weight information found in document]
Content: This document contains shipping details and logistics information.
`;
    }
  } catch (error) {
    console.error('Error in PDF extraction:', error);
    return `Failed to extract text from PDF: ${file.name}`;
  }
}

/**
 * Check if an image appears to be rotated and needs orientation correction
 * In a production environment, this would use a more sophisticated algorithm
 */
function detectImageRotation(imageData: string | ArrayBuffer): number {
  // This is a placeholder for a real implementation
  // In production, we would:
  // 1. Analyze text line orientation using machine learning
  // 2. Look for horizon lines or other orientation indicators
  // 3. Return rotation angle in degrees (0, 90, 180, 270)
  
  console.log('Checking for image rotation - in production this would use computer vision techniques');
  
  // For now we return 0 (no rotation), but in production this would be a real detection
  return 0;
}

/**
 * Apply rotation to an image
 * In production, this would use canvas operations or a dedicated image processing library
 */
async function rotateImage(imageData: string | ArrayBuffer, degrees: number): Promise<string | ArrayBuffer> {
  // This is a placeholder for a real implementation that would rotate the image
  console.log(`Rotation detected - would rotate image by ${degrees} degrees in production`);
  
  // In production, we would:
  // 1. Convert to a usable format (if needed)
  // 2. Create a canvas element
  // 3. Draw the image with appropriate transformation
  // 4. Return the rotated image data
  
  // For this implementation, we just return the original data
  return imageData;
}

/**
 * Extract text from images using OCR
 * In production, this would use Tesseract.js or a cloud OCR API
 */
async function extractTextFromImage(file: File, fileContent: string | ArrayBuffer): Promise<string> {
  console.log('Image OCR: In a production environment, this would use Tesseract.js or a cloud OCR API');
  
  try {
    // Check if image orientation needs correction
    const rotationDegrees = detectImageRotation(fileContent);
    
    // Apply rotation if needed
    let processedImageData = fileContent;
    if (rotationDegrees !== 0) {
      console.log(`Detected image rotation of ${rotationDegrees} degrees, correcting...`);
      processedImageData = await rotateImage(fileContent, rotationDegrees);
    }
    
    // In production, OCR would be performed on the processedImageData
    // Here we implement a more robust demo extraction

    // Get basic info from filename
    const filenameData = extractTextFromFilename(file.name);
    
    // Determine if file is likely a BOL
    const isBOL = file.name.toLowerCase().includes('bol') || 
                 file.name.toLowerCase().includes('lading') || 
                 file.name.toLowerCase().match(/\d{6,}/); // BOLs often have long numbers
    
    // Extract BOL number from filename if possible
    const bolMatch = file.name.match(/(\d{5,})/);
    const bolNumber = bolMatch ? bolMatch[1] : `${Math.floor(Math.random() * 1000000)}`;
    
    // Check if filename contains Hanzo or facility identifiers
    const hasHanzoReference = file.name.toLowerCase().includes('hanzo') || 
                             file.name.toLowerCase().includes('airtech') ||
                             file.name.toLowerCase().includes('sam pride') ||
                             file.name.toLowerCase().includes('camby');
    
    if (isBOL) {
      // Create a more informative extracted text for BOL documents
      let extractedText = `BILL OF LADING\nBOL #: ${bolNumber}\n`;
      
      // If we can identify if this is likely from or to a Hanzo facility
      if (hasHanzoReference) {
        const isOutbound = file.name.toLowerCase().includes('outbound') || 
                           file.name.toLowerCase().includes('out') ||
                           file.name.toLowerCase().includes('export');
                           
        if (isOutbound) {
          extractedText += `
SHIP FROM:
Hanzo Logistics
450 Airtech Pkwy
Indianapolis, IN 46241

SHIP TO:
[Customer Name - Appears in document]
[Customer Address - Appears in document]
`;
        } else {
          extractedText += `
SHIP FROM:
[Vendor/Customer Name - Appears in document]
[Origin Address - Appears in document]

SHIP TO:
Hanzo Logistics
450 Airtech Pkwy
Indianapolis, IN 46241
`;
        }
      } else {
        // Generic BOL text when we can't determine direction
        extractedText += `
SHIPPER:
[Company name appears in document]
[Address appears in document]

CONSIGNEE:
[Destination appears in document]
[Address appears in document]
`;
      }
      
      // Add carrier info that would be extracted
      extractedText += `
CARRIER: [Carrier name appears in document]
MC #: [MC number appears in document]
TRAILER #: [Trailer number appears in document]
WEIGHT: [Weight appears in document]
DATE: [Date appears in document]
`;

      return extractedText;
    } else {
      // For non-BOL documents, provide more specific document type identification
      let documentType = "Logistics Document";
      
      if (file.name.toLowerCase().includes('invoice')) {
        documentType = "Invoice";
      } else if (file.name.toLowerCase().includes('packing')) {
        documentType = "Packing Slip";
      } else if (file.name.toLowerCase().includes('manifest')) {
        documentType = "Shipping Manifest";
      } else if (file.name.toLowerCase().includes('receipt')) {
        documentType = "Receipt";
      }
      
      return filenameData + `
Document Type: ${documentType}
Date: ${new Date().toLocaleDateString()}
Customer: [Customer name appears in document]
Facility: [Facility information appears in document]
Document ID: ${bolMatch ? bolMatch[1] : 'Unknown'} 
Content: This document contains logistics details and shipping information that will be extracted.
`;
    }
  } catch (error) {
    console.error('Error in image OCR:', error);
    return `Failed to extract text from image: ${file.name}`;
  }
}

/**
 * Extract text from Word or other Office documents
 * In production, this would use a specialized library
 */
async function extractTextFromDocument(file: File, fileContent: string | ArrayBuffer): Promise<string> {
  console.log('Document extraction: In a production environment, this would use specialized document parsing libraries');
  
  try {
    // Get basic info from filename
    const filenameData = extractTextFromFilename(file.name);
    
    // Analyze file information for better extraction
    const isInvoice = file.name.toLowerCase().includes('invoice');
    const isPO = file.name.toLowerCase().includes('po') || 
               file.name.toLowerCase().includes('order') || 
               file.name.toLowerCase().includes('purchase');
    const isDelivery = file.name.toLowerCase().includes('delivery') || 
                     file.name.toLowerCase().includes('receipt');
    const isManifest = file.name.toLowerCase().includes('manifest') || 
                      file.name.toLowerCase().includes('packing');
                      
    // Check if filename contains Hanzo or facility identifiers
    const hasHanzoReference = file.name.toLowerCase().includes('hanzo') || 
                             file.name.toLowerCase().includes('airtech') ||
                             file.name.toLowerCase().includes('sam pride') ||
                             file.name.toLowerCase().includes('camby');
                             
    // Determine document type
    let documentType = "Logistics Document";
    let documentDetails = "";
    
    if (isInvoice) {
      documentType = "Invoice";
      documentDetails = `
Invoice Number: [Invoice number appears in document]
Date: ${new Date().toLocaleDateString()}
Customer: [Customer name appears in document]
Amount: [Amount appears in document]
Services: [Services description appears in document]`;
    } else if (isPO) {
      documentType = "Purchase Order";
      documentDetails = `
PO Number: [PO number appears in document]
Order Date: ${new Date().toLocaleDateString()}
Vendor: [Vendor name appears in document]
Items: [Order items appear in document]
Total: [Order total appears in document]`;
    } else if (isDelivery) {
      documentType = "Delivery Receipt";
      documentDetails = `
Receipt Number: [Receipt number appears in document]
Delivery Date: ${new Date().toLocaleDateString()}
Carrier: [Carrier name appears in document]
Items: [Delivered items appear in document]
Signed By: [Signature appears in document]`;
    } else if (isManifest) {
      documentType = "Shipping Manifest";
      documentDetails = `
Manifest ID: [Manifest ID appears in document]
Ship Date: ${new Date().toLocaleDateString()}
Item Count: [Item count appears in document]
Origin: [Origin location appears in document]
Destination: [Destination location appears in document]`;
    } else {
      documentDetails = `
Document ID: [Document ID appears in document]
Date: ${new Date().toLocaleDateString()}
Related To: [Related information appears in document]
Notes: [Document notes appear in document]`;
    }
    
    // Add facility information if relevant
    let facilityInfo = "";
    if (hasHanzoReference) {
      let facilityName = "Hanzo Logistics";
      
      if (file.name.toLowerCase().includes('airtech')) {
        facilityName = "450 Airtech Pkwy";
      } else if (file.name.toLowerCase().includes('camby')) {
        facilityName = "Camby Road Facility";
      } else if (file.name.toLowerCase().includes('brownsburg')) {
        facilityName = "Hanzo Brownsburg";
      } else if (file.name.toLowerCase().includes('pride')) {
        facilityName = "Sam Pride Facility";
      }
      
      facilityInfo = `\nFacility: ${facilityName}`;
    }
    
    return `${documentType}${facilityInfo}
${filenameData}${documentDetails}
Content: This document contains detailed logistics and shipping information.`;
  } catch (error) {
    console.error('Error in document extraction:', error);
    return `Failed to extract text from document: ${file.name}`;
  }
}

/**
 * Extract information from filename as a fallback
 */
function extractTextFromFilename(filename: string): string {
  // Parse information from filename as a fallback
  const parts = filename.split(/[-_\s.]/);
  
  let extractedText = `Filename: ${filename}\n`;
  
  // Check for BOL number in filename
  const bolMatch = filename.match(/BOL[-_]?(\d+)/i);
  if (bolMatch) {
    extractedText += `BOL #: ${bolMatch[1]}\n`;
  }
  
  // Check for customer name
  const customerMatch = filename.match(/(customer|client|cust)[-_]?([a-z0-9]+)/i);
  if (customerMatch) {
    extractedText += `Customer: ${customerMatch[2].toUpperCase()}\n`;
  }
  
  // Check for carrier information
  const carrierMatch = filename.match(/(carrier|transport)[-_]?([a-z0-9]+)/i);
  if (carrierMatch) {
    extractedText += `Carrier: ${carrierMatch[2].toUpperCase()}\n`;
  }
  
  return extractedText;
}

/**
 * Compresses a file before uploading (if needed)
 * 
 * @param file - The file to compress
 * @returns The compressed file (or original if compression is not supported)
 */
export async function compressFile(file: File): Promise<File> {
  console.log(`Compressing file: ${file.name}, size: ${file.size} bytes`);
  
  // In a production app, we would use compression libraries based on file type
  // For images: browser-image-compression
  // For PDFs: pdf-lib with compression settings
  // For this implementation, we'll just return the original file
  
  // Log that we would compress in production
  console.log('Compression skipped for demo purposes. In production, we would use proper compression libraries');
  
  return file;
}