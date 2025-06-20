import { BolRepository } from '../repositories/bolRepository';
import { processImageFile } from '../ocr/ocr_connector.mjs';
import { validateOcrResult, ValidatedOcrResult } from '../utils/ocrValidator';
import { InsertBolDocument } from '../../drizzle/schema/bol';
import { InsertOcrAnalytics } from '../../drizzle/schema/ocr_analytics';

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
    
    // Function to process the image
    const processWithRetry = async (retryCount = 0): Promise<ValidatedOcrResult> => {
      try {
        // First attempt
        const result = await Promise.race([
          processImageFile(filePath),
          timeoutPromise
        ]);
        
        // Validate the result
        const validatedResult = validateOcrResult(result);
        if (validatedResult.isValid && validatedResult.data) {
          return validatedResult.data;
        } else {
          throw new Error(`OCR validation failed: ${JSON.stringify(validatedResult.errors)}`);
        }
      } catch (error) {
        // Retry once if the first attempt failed
        if (retryCount < 1) {
          console.log(`OCR processing attempt failed, retrying: ${error.message}`);
          return processWithRetry(retryCount + 1);
        }
        
        // Both attempts failed, return a failure result
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
      processingStatus: ocrResult.success ? 'completed' : 'failed',
    };
    
    // Save document to database
    const savedDocument = await this.repository.createBolDocument(documentData);
    
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