import { Request, Response } from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Handle OCR document processing request
 * This function processes an uploaded image file using PaddleOCR
 * and returns the extracted text.
 */
export async function handleProcessDocument(req: Request, res: Response) {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No document file uploaded' 
      });
    }

    const filePath = req.file.path;
    console.log(`[OCR Controller] Processing document: ${filePath}`);

    // Spawn Python process to run OCR
    const pythonProcess = spawn('python3', [
      path.join(process.cwd(), 'server/src/services/ocr_processor.py'),
      filePath
    ]);

    let stdoutData = '';
    let stderrData = '';

    // Collect stdout data
    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    // Collect stderr data
    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.error(`[OCR Controller] Python stderr: ${data}`);
    });

    // Handle process completion
    pythonProcess.on('close', (code) => {
      console.log(`[OCR Controller] Python process exited with code: ${code}`);
      
      // Clean up the temporary file
      cleanupFile(filePath);

      if (code !== 0) {
        console.error(`[OCR Controller] OCR process failed with code ${code}`);
        console.error(`[OCR Controller] Error output: ${stderrData}`);
        return res.status(500).json({ 
          success: false, 
          error: 'OCR processing failed', 
          details: stderrData 
        });
      }

      // If we have stdout data, parse it as JSON
      if (stdoutData) {
        try {
          const ocrResult = JSON.parse(stdoutData);
          return res.json(ocrResult);
        } catch (parseError) {
          console.error('[OCR Controller] Failed to parse OCR result JSON:', parseError);
          return res.status(500).json({ 
            success: false, 
            error: 'Invalid OCR result format', 
            rawOutput: stdoutData 
          });
        }
      } else {
        return res.status(500).json({ 
          success: false, 
          error: 'No OCR result data received' 
        });
      }
    });

    // Handle process errors
    pythonProcess.on('error', (error) => {
      console.error('[OCR Controller] Failed to start OCR process:', error);
      cleanupFile(filePath);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to start OCR process', 
        details: error.message 
      });
    });

  } catch (error) {
    console.error('[OCR Controller] Unexpected error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Unexpected error during OCR processing',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Clean up an uploaded file
 */
function cleanupFile(filePath: string): void {
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error(`[OCR Controller] Failed to delete temporary file ${filePath}:`, err);
    } else {
      console.log(`[OCR Controller] Temporary file deleted: ${filePath}`);
    }
  });
}