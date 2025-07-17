import { BolRepository } from '../repositories/bolRepository';
import { processImageFile } from '../ocr/ocr_connector.mjs';
import { processImageWithTesseract } from '../ocr/tesseract-processor.mjs';
import { validateOcrResult, ValidatedOcrResult } from '../utils/ocrValidator';
import { InsertBolDocument } from '../../drizzle/schema/bol';
import { InsertOcrAnalytics } from '../../drizzle/schema/ocr_analytics';
// Type for error logging

// Define configurable timeout for OCR processing in milliseconds
const OCR_PROCESSING_TIMEOUT = parseInt(process.env.OCR_TIMEOUT_MS || '30000'); // Default 30 seconds

/**
 * Service for BOL document processing and management
 * Handles OCR processing, data validation, and database operations
 */
export class BolService {
  private repository: BolRepository;
  
  constructor() {
    this.repository = new BolRepository();
  }
  
  /**
   * Process a BOL image file with timeout and retry
   * @param filePath Path to the image file
   * @returns Processed OCR results
   */
  async processImageWithTimeout(filePath: string): Promise<ValidatedOcrResult> {
    // Create a promise that rejects after the timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('OCR processing timed out')), OCR_PROCESSING_TIMEOUT);
    });
    
    // Function to process the image with fallback
    const processWithRetry = async (retryCount = 0): Promise<ValidatedOcrResult> => {
      try {
        let result;
        
        // Try PaddleOCR first, fall back to Tesseract.js if it fails
        try {
          console.log(`[BolService] Attempting PaddleOCR processing (attempt ${retryCount + 1})`);
          result = await Promise.race([
            processImageFile(filePath),
            timeoutPromise
          ]);
          console.log(`[BolService] PaddleOCR result:`, result);
        } catch (paddleError) {
          console.log(`[BolService] PaddleOCR failed, falling back to Tesseract.js: ${paddleError.message}`);
          
          // Fallback to Tesseract.js
          result = await Promise.race([
            processImageWithTesseract(filePath),
            timeoutPromise
          ]);
          console.log(`[BolService] Tesseract.js result:`, result);
        }
        
        // Validate the result
        const validatedResult = validateOcrResult(result);
        if (validatedResult.isValid && validatedResult.data) {
          console.log(`[BolService] ✅ OCR processing successful with ${validatedResult.data.ocrEngine || 'unknown engine'}`);
          return validatedResult.data;
        } else {
          throw new Error(`OCR validation failed: ${JSON.stringify(validatedResult.errors)}`);
        }
      } catch (error) {
        // Retry once if the first attempt failed
        if (retryCount < 1) {
          console.log(`[BolService] OCR processing attempt failed, retrying: ${error.message}`);
          return processWithRetry(retryCount + 1);
        }
        
        // Both attempts failed, return a failure result
        console.log(`[BolService] ❌ OCR processing failed after retry: ${error.message}`);
        return {
          success: false,
          error: error.message || 'OCR processing failed after retry',
          errorType: error.name || 'ProcessingError'
        };
      }
    };
    
    // Execute the processing with retry logic
    return processWithRetry();
  }
  
  /**
   * Save BOL document metadata and OCR results to the database
   * @param fileInfo File metadata
   * @param ocrResult OCR processing results
   * @param tenantId Optional tenant ID for multi-tenant isolation
   * @param uploadedBy Optional user ID who uploaded the document
   * @returns Created BOL document
   */
  async saveBolDocument(
    fileInfo: { originalName: string; name: string; path: string; size: number; mimetype: string },
    ocrResult: ValidatedOcrResult,
    tenantId?: number,
    uploadedBy?: number
  ) {
    // Prepare document data
    const documentData: InsertBolDocument = {
      fileName: fileInfo.name,
      originalFileName: fileInfo.originalName,
      filePath: fileInfo.path,
      fileSize: fileInfo.size,
      mimeType: fileInfo.mimetype,
      tenantId,
      uploadedBy,
      ocrData: ocrResult as any,
      parsedData: ocrResult.detectedFields as any,
      ocrStatus: ocrResult.success ? 'completed' : 'failed',
    };
    
    // Save document to database
    const savedDocument = await this.repository.createBolDocument(documentData);
    
    console.log('🔍 [BolService] Saved BOL document to database:', JSON.stringify(savedDocument, null, 2));
    console.log('🔍 [BolService] OCR data stored:', JSON.stringify(ocrResult, null, 2));
    
    // Save analytics data if available
    if (ocrResult.success && (ocrResult.processingTime || ocrResult.confidenceScore)) {
      const analyticsData: InsertOcrAnalytics = {
        bolDocumentId: savedDocument.id,
        tenantId,
        processingTime: ocrResult.processingTime || 0,
        confidenceScore: ocrResult.confidenceScore || 0,
        engineVersion: ocrResult.engineVersion || 'unknown',
        documentType: 'BOL',
        status: ocrResult.success ? 'success' : 'failed',
      };
      
      await this.repository.recordOcrAnalytics(analyticsData);
    }
    
    return savedDocument;
  }
  
  /**
   * Link a BOL document to an appointment/schedule
   * @param bolDocumentId BOL document ID
   * @param scheduleId Appointment/schedule ID
   * @returns Created link record
   */
  async linkBolToAppointment(bolDocumentId: number, scheduleId: number) {
    return this.repository.linkBolToAppointment(scheduleId, bolDocumentId);
  }
  
  /**
   * Get all BOL documents for an appointment
   * @param scheduleId Appointment/schedule ID
   * @returns Array of BOL documents
   */
  async getBolDocumentsForAppointment(scheduleId: number) {
    return this.repository.getBolDocumentsForAppointment(scheduleId);
  }
}