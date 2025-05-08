import { Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Handle document processing request
 * This function processes an uploaded document file (PDF or image)
 * and returns metadata and information about the document.
 */
export async function handleProcessDocument(req: Request, res: Response) {
  try {
    // Check if file exists in the request
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No document file uploaded',
      });
    }

    console.log(`[OCR] Processing document: ${req.file.originalname}`);
    console.log(`[OCR] File saved as: ${req.file.path}`);

    // Get the user information for logging
    const userId = req.user?.id || 'anonymous';
    const tenantId = req.user?.tenantId || 'unknown';
    console.log(`[OCR] Request from user ID: ${userId}, tenant ID: ${tenantId}`);

    // Spawn Python process to handle document processing
    const pythonProcess = spawn('python3', [
      path.join(process.cwd(), 'server', 'src', 'services', 'ocr_processor.py'),
      req.file.path,
    ]);

    let dataString = '';
    let errorString = '';

    // Collect data from the Python process
    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    // Collect errors from the Python process
    pythonProcess.stderr.on('data', (data) => {
      errorString += data.toString();
      console.error(`[OCR] Python error: ${data.toString()}`);
    });

    // Wait for the Python process to exit
    const exitCode = await new Promise((resolve) => {
      pythonProcess.on('close', resolve);
    });

    // If exit code is non-zero, return error
    if (exitCode !== 0) {
      console.error(`[OCR] Process exited with code ${exitCode}`);
      console.error(`[OCR] Error: ${errorString}`);
      
      return res.status(500).json({
        success: false,
        message: 'Document processing failed',
        error: errorString || `Process exited with code ${exitCode}`,
      });
    }

    try {
      // Parse the JSON output from the Python script
      const result = JSON.parse(dataString);
      
      // Log success
      console.log(`[OCR] Successfully processed document`);
      
      // Add document path for reference (temporary - this file will be deleted)
      result.filePath = req.file.path;
      result.originalName = req.file.originalname;
      
      // Clean up the uploaded file
      cleanupFile(req.file.path);
      
      // Send the response
      return res.status(200).json({
        success: true,
        message: 'Document processed successfully',
        result,
      });
    } catch (parseError) {
      console.error(`[OCR] Error parsing document processing output: ${parseError}`);
      console.error(`[OCR] Raw output: ${dataString}`);
      
      return res.status(500).json({
        success: false,
        message: 'Error parsing document processing output',
        error: String(parseError),
      });
    }
  } catch (error) {
    console.error(`[OCR] Unexpected error: ${error}`);
    
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Clean up an uploaded file
 */
function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[OCR] Cleaned up temporary file: ${filePath}`);
    }
  } catch (error) {
    console.error(`[OCR] Error cleaning up file ${filePath}: ${error}`);
  }
}

/**
 * Ensures the OCR uploads directory exists
 * This function is automatically called when the module is imported
 */
function ensureOcrUploadsDir(): void {
  try {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const ocrDir = path.join(uploadsDir, 'ocr-docs');
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log(`[OCR] Created uploads directory: ${uploadsDir}`);
    }
    
    // Create OCR docs directory if it doesn't exist
    if (!fs.existsSync(ocrDir)) {
      fs.mkdirSync(ocrDir, { recursive: true });
      console.log(`[OCR] Created OCR documents directory: ${ocrDir}`);
    }
  } catch (error) {
    console.error(`[OCR] Error ensuring OCR directories: ${error}`);
  }
}

// Ensure OCR uploads directory exists when this module is loaded
ensureOcrUploadsDir();