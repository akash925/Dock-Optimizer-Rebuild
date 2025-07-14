import { spawn } from 'child_process';
import path from 'path';

/** Ensure OCR backend is running.
 *  Falls back to tesseract.js worker if external binary missing. */
export async function startOcrService() {
  try {
    console.log('[OCR] Starting OCR service initialization...');
    
    // 1️⃣  Prefer external binary (fastlane)
    const test = spawn('tesseract', ['--version']);
    
    let hasNativeTesseract = false;
    
    const testResult = await new Promise<boolean>((resolve) => {
      test.on('error', () => resolve(false));
      test.on('close', code => resolve(code === 0));
    });
    
    if (testResult) {
      console.log('[OCR] ✅ Native tesseract found and working');
      hasNativeTesseract = true;
    } else {
      console.warn('[OCR] ⚠️  Native tesseract not available, starting JS worker fallback');
      await fallback();
    }
    
    // Test if Python OCR modules are available
    try {
      const pythonTest = spawn('python3', ['-c', 'import paddleocr; print("PaddleOCR available")']);
      
      const pythonResult = await new Promise<boolean>((resolve) => {
        pythonTest.on('error', () => resolve(false));
        pythonTest.on('close', code => resolve(code === 0));
      });
      
      if (pythonResult) {
        console.log('[OCR] ✅ PaddleOCR Python module found');
      } else {
        console.warn('[OCR] ⚠️  PaddleOCR not available, JavaScript fallback will be used');
      }
    } catch (error) {
      console.warn('[OCR] ⚠️  Could not test Python OCR modules:', error);
    }
    
    console.log('[OCR] 🚀 OCR service initialization complete');
    
  } catch (error) {
    console.error('[OCR] ❌ Error during OCR service initialization:', error);
    await fallback();
  }

  async function fallback() {
    console.warn('[OCR] Starting JavaScript OCR fallback');
    try {
      // Dynamically import so it's truly optional
      const tesseractjs = await import('tesseract.js');
      const { createWorker } = tesseractjs;
      
      console.log('[OCR] 📦 Tesseract.js loaded, creating worker...');
      const worker = await createWorker();
      
      console.log('[OCR] ✅ JavaScript OCR worker ready');
      
      // Store worker reference globally for use by other modules
      (global as any).__ocrWorker = worker;
      
    } catch (err) {
      console.error('[OCR] ❌ JavaScript OCR fallback failed:', err);
      console.error('[OCR] 💥 No OCR backend available - OCR functionality will be limited');
    }
  }
}

/**
 * Get OCR status for health checks
 */
export async function getOcrStatus(): Promise<{ ok: boolean; backend: string; ts: number }> {
  const status = {
    ok: false,
    backend: 'none',
    ts: Date.now()
  };
  
  try {
    // Check if JavaScript worker is available
    if ((global as any).__ocrWorker) {
      status.ok = true;
      status.backend = 'tesseract.js';
      return status;
    }
    
    // Check if native tesseract is available
    const testResult = await new Promise<boolean>((resolve) => {
      const test = spawn('tesseract', ['--version']);
      test.on('error', () => resolve(false));
      test.on('close', code => resolve(code === 0));
    });
    
    if (testResult) {
      status.ok = true;
      status.backend = 'native-tesseract';
      return status;
    }
    
    // Check if Python OCR is available
    const pythonResult = await new Promise<boolean>((resolve) => {
      const pythonTest = spawn('python3', ['-c', 'import paddleocr; print("OK")']);
      pythonTest.on('error', () => resolve(false));
      pythonTest.on('close', code => resolve(code === 0));
    });
    
    if (pythonResult) {
      status.ok = true;
      status.backend = 'paddleocr';
      return status;
    }
    
  } catch (error) {
    console.error('[OCR] Error checking OCR status:', error);
  }
  
  return status;
} 