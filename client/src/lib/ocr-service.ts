/**
 * OCR Service for parsing Bill of Lading (BOL) files
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
  pickupOrDropoff?: 'pickup' | 'dropoff'; // Inferred from address data
  parsedOcrText?: string; // Full extracted text for debugging/reference
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
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        if (!event.target || !event.target.result) {
          reject(new Error('Failed to read file'));
          return;
        }

        // For image files, we would normally convert to base64 and send to a cloud OCR API
        // For PDF files, we would extract text using a PDF parsing library
        // For this implementation, we'll extract data with a combination of methods
        
        let textContent = '';
        const fileType = file.type.toLowerCase();
        
        // Extract text based on file type
        if (fileType.includes('text') || fileType.includes('plain')) {
          // If it's a text file, we can use the direct text content
          textContent = event.target.result as string;
        } else if (fileType.includes('pdf')) {
          // For PDFs, in a real implementation we would use a PDF parsing library
          // For now, simulate extracting text content
          textContent = simulatePdfTextExtraction(file.name);
        } else if (fileType.includes('image')) {
          // For images, in a real implementation we would use OCR APIs like Tesseract
          // For now, simulate OCR results
          textContent = simulateImageOcr(file.name);
        } else {
          // For other document types, use a generic extraction approach
          textContent = extractTextFromFilename(file.name);
        }
        
        // Store the full extracted text for reference
        const parsedData: ParsedBolData = {
          parsedOcrText: textContent
        };
        
        // Extract BOL number - look for patterns like "BOL #12345" or "B/L: 12345"
        const bolNumberMatch = textContent.match(/(?:BOL|B\/L|Bill\sof\sLading)[^\d]*(\d+)/i) || 
                               file.name.match(/BOL[-_]?(\d+)/i);
        if (bolNumberMatch) {
          parsedData.bolNumber = bolNumberMatch[1];
        }
        
        // Extract customer name - typically indicated with keywords like "customer", "consignee", "ship to"
        const customerPatterns = [
          /(?:customer|customer\sname|consignee|ship\sto)[^\w\n]*([A-Za-z0-9\s.,&]+)(?:\n|$)/i,
          /(?:SHIP\sTO|CONSIGNEE|RECEIVER)[^\w\n]*([A-Za-z0-9\s.,&]+)(?:\n|$)/i
        ];
        
        for (const pattern of customerPatterns) {
          const match = textContent.match(pattern);
          if (match && match[1].trim()) {
            parsedData.customerName = match[1].trim();
            break;
          }
        }
        
        // Extract carrier name - typically indicated with keywords like "carrier", "by", "transported by"
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
        const mcNumberMatch = textContent.match(/MC[\s-#]*(\d+)/i);
        if (mcNumberMatch) {
          parsedData.mcNumber = mcNumberMatch[1];
        }
        
        // Extract weight - typically formatted like "weight: 1000 lbs" or "1000 lb"
        const weightMatch = textContent.match(/(?:weight|gross\sweight|net\sweight)[^\d\n]*(\d+(?:[,.]\d+)?)\s*(?:lbs?|pounds|kg|kilos?)?/i);
        if (weightMatch) {
          parsedData.weight = weightMatch[1];
        }
        
        // Extract pallet count - typically formatted like "pallets: 5" or "5 pallets"
        const palletMatch = textContent.match(/(?:\b(\d+)\s*(?:pallets?|skids?)\b)|(?:pallets?|skids?)[^\d\n]*(\d+)/i);
        if (palletMatch) {
          parsedData.palletCount = palletMatch[1] || palletMatch[2];
        }
        
        // Extract addresses
        const fromAddressMatch = textContent.match(/(?:FROM|SHIPPER|ORIGIN)[^\w\n]*([A-Za-z0-9\s.,&-]+(?:\n[A-Za-z0-9\s.,&-]+){0,3})/i);
        if (fromAddressMatch) {
          parsedData.fromAddress = fromAddressMatch[1].trim();
        }
        
        const toAddressMatch = textContent.match(/(?:TO|SHIP\sTO|CONSIGNEE|DESTINATION)[^\w\n]*([A-Za-z0-9\s.,&-]+(?:\n[A-Za-z0-9\s.,&-]+){0,3})/i);
        if (toAddressMatch) {
          parsedData.toAddress = toAddressMatch[1].trim();
        }
        
        // Extract truck ID or trailer number
        const truckIdMatch = textContent.match(/(?:TRUCK\s(?:ID|NO|NUMBER)|TRACTOR)[^\w\n]*([A-Za-z0-9-]+)/i);
        if (truckIdMatch) {
          parsedData.truckId = truckIdMatch[1].trim();
        }
        
        const trailerMatch = textContent.match(/(?:TRAILER\s(?:ID|NO|NUMBER))[^\w\n]*([A-Za-z0-9-]+)/i);
        if (trailerMatch) {
          parsedData.trailerNumber = trailerMatch[1].trim();
        }
        
        // Infer pickup or dropoff based on addresses and keywords
        if (textContent.match(/(?:OUTBOUND|SHIPPING|SHIP\sFROM|EXPORT)/i)) {
          parsedData.pickupOrDropoff = 'pickup';
        } else if (textContent.match(/(?:INBOUND|RECEIVING|DELIVERY|IMPORT)/i)) {
          parsedData.pickupOrDropoff = 'dropoff';
        }
        
        // If addresses exist, use them to determine pickup vs dropoff
        // If the "from" address contains keywords matching our facility names
        // it's likely a pickup (outbound)
        if (parsedData.fromAddress && !parsedData.pickupOrDropoff) {
          const facilityKeywords = ['hanzo', 'airtech', 'camby', 'sam pride', 'brownsburg'];
          if (facilityKeywords.some(keyword => 
            parsedData.fromAddress?.toLowerCase().includes(keyword.toLowerCase()))) {
            parsedData.pickupOrDropoff = 'pickup';
          } else {
            parsedData.pickupOrDropoff = 'dropoff';
          }
        }
        
        // Add generic notes
        if (!parsedData.notes) {
          parsedData.notes = "Automatically extracted from BOL document";
        }
        
        resolve(parsedData);
      };
      
      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };
      
      // Start reading the file as text or as binary data depending on file type
      const fileType = file.type.toLowerCase();
      if (fileType.includes('text') || fileType.includes('plain')) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Simulates extracting text from a PDF document
 * In a real implementation, this would use a PDF.js or similar library
 */
function simulatePdfTextExtraction(filename: string): string {
  // This is a simplified simulation of PDF text extraction
  // In a real implementation, we would use a PDF parsing library
  const isPalletListing = filename.toLowerCase().includes('pallet');
  const isBOL = filename.toLowerCase().includes('bol') || filename.toLowerCase().includes('lading');
  const isInbound = filename.toLowerCase().includes('inbound') || filename.toLowerCase().includes('receiving');
  const isOutbound = filename.toLowerCase().includes('outbound') || filename.toLowerCase().includes('shipping');
  
  // Generate sample BOL text based on filename
  let sampleText = '';
  
  if (isBOL) {
    const bolNumber = filename.match(/\d+/) ? filename.match(/\d+/)![0] : '123456';
    sampleText = `
BILL OF LADING
BOL #: ${bolNumber}
Date: ${new Date().toLocaleDateString()}

SHIPPER:
Hanzo Logistics
450 Airtech Pkwy
Indianapolis, IN 46241

CONSIGNEE:
Acme Corporation
123 Main Street
Anytown, US 12345

CARRIER: ${isOutbound ? 'UPS Freight' : 'FedEx Freight'}
SCAC: ${isOutbound ? 'UPGF' : 'FDXF'}
MC #: ${isOutbound ? '123456' : '789012'}

TRAILER #: TR-${Math.floor(Math.random() * 10000)}
SEAL #: SL-${Math.floor(Math.random() * 10000)}

${isPalletListing ? `PALLET COUNT: ${Math.floor(Math.random() * 10) + 1}` : ''}
WEIGHT: ${Math.floor(Math.random() * 10000) + 500} LBS

SPECIAL INSTRUCTIONS:
${isInbound ? 'RECEIVING HOURS: 8AM-4PM' : 'SHIPPING HOURS: 6AM-6PM'}
Handle with care.
    `;
  } else {
    // Generic text extraction for non-BOL PDFs
    sampleText = `Document: ${filename}
Date: ${new Date().toLocaleDateString()}
Content: This is simulated text content from a PDF document.
`;
  }
  
  return sampleText;
}

/**
 * Simulates OCR on an image file
 * In a real implementation, this would use Tesseract.js or a cloud OCR API
 */
function simulateImageOcr(filename: string): string {
  // This is a simplified simulation of OCR
  // In a real implementation, we would use an OCR library or service
  const isBOL = filename.toLowerCase().includes('bol') || filename.toLowerCase().includes('lading');
  const isInvoice = filename.toLowerCase().includes('invoice');
  
  if (isBOL) {
    const bolNumber = filename.match(/\d+/) ? filename.match(/\d+/)![0] : '123456';
    return `
BILL OF LADING
BOL #: ${bolNumber}
SHIP FROM:
Acme Corporation
123 Commerce Park
Springfield, IL 62701

SHIP TO:
Hanzo Logistics
450 Airtech Pkwy
Indianapolis, IN 46241

CARRIER: Swift Transportation
MC #: 987654
TRAILER #: T-12345
    `;
  } else if (isInvoice) {
    return `
INVOICE
Invoice #: INV-${Math.floor(Math.random() * 10000)}
Date: ${new Date().toLocaleDateString()}
Customer: Acme Corporation
Amount: $${Math.floor(Math.random() * 10000) / 100}
    `;
  } else {
    return `
Document: ${filename}
OCR extracted text simulation
Date: ${new Date().toLocaleDateString()}
    `;
  }
}

/**
 * Extracts text information from filename when no content is available
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
  // In a real implementation, this would compress the file
  // For this prototype, we'll just return the original file
  return file;
}