/**
 * OCR Connector for Node.js Server
 * 
 * This module provides functions to call the Python PaddleOCR module from Node.js
 * using child process execution to perform OCR on BOL images.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the Python script
const PYTHON_EXECUTABLE = 'python3';
const OCR_SCRIPT_PATH = path.join(__dirname, 'ocr_runner.py');

/**
 * Create the Python script that will be used to invoke the OCR processor
 * This approach allows us to call Python code from Node.js while maintaining
 * proper error handling and serialization of results
 */
const createOcrRunnerScript = () => {
  const scriptContent = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
OCR Runner Script for Node.js Connector
---------------------------------------
This script loads an image file and processes it using the BOLProcessor
from the bol_processor module. It is designed to be called from Node.js.
"""

import sys
import json
import base64
import tempfile
import traceback
from pathlib import Path

# Import the OCR processor
try:
    from bol_processor import BOLProcessor
except ImportError:
    # Try relative import in case the script is run from a different directory
    sys.path.append(str(Path(__file__).parent))
    from bol_processor import BOLProcessor

def process_image_file(file_path):
    """Process an image file with the BOL processor"""
    try:
        processor = BOLProcessor(show_log=False)
        result = processor.process_image(file_path)
        return result
    except Exception as e:
        return {
            "success": False, 
            "error": str(e),
            "error_type": type(e).__name__,
            "traceback": traceback.format_exc()
        }

def process_image_base64(base64_data):
    """Process a base64-encoded image with the BOL processor"""
    try:
        # Decode base64 data
        binary_data = base64.b64decode(base64_data)
        
        # Process the binary data directly
        processor = BOLProcessor(show_log=False)
        result = processor.process_image(binary_data)
        return result
    except Exception as e:
        return {
            "success": False, 
            "error": str(e),
            "error_type": type(e).__name__,
            "traceback": traceback.format_exc()
        }

def main():
    """Main function to process command line arguments"""
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "Invalid arguments. Expected: mode [file|base64] and path or data"
        }))
        sys.exit(1)
    
    mode = sys.argv[1]
    data = sys.argv[2]
    
    if mode == "file":
        # Process image file
        result = process_image_file(data)
    elif mode == "base64":
        # Process base64-encoded image
        result = process_image_base64(data)
    else:
        result = {
            "success": False,
            "error": f"Invalid mode: {mode}. Expected 'file' or 'base64'"
        }
    
    # Print JSON result to stdout for the Node.js process to capture
    print(json.dumps(result))

if __name__ == "__main__":
    main()
`;

  // Create the OCR runner script
  fs.writeFileSync(OCR_SCRIPT_PATH, scriptContent);
};

// Create the OCR runner script if it doesn't exist
if (!fs.existsSync(OCR_SCRIPT_PATH)) {
  createOcrRunnerScript();
}

/**
 * Process a BOL image file using PaddleOCR
 * 
 * @param {string} filePath - Path to the image file
 * @returns {Promise<object>} - Structured OCR results
 */
const processImageFile = async (filePath) => {
  return new Promise((resolve, reject) => {
    // Spawn a Python process to run the OCR
    const pythonProcess = spawn(PYTHON_EXECUTABLE, [OCR_SCRIPT_PATH, 'file', filePath]);
    
    let stdoutData = '';
    let stderrData = '';
    
    // Collect stdout data
    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });
    
    // Collect stderr data
    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });
    
    // Handle process exit
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`OCR process exited with code ${code}: ${stderrData}`));
        return;
      }
      
      try {
        // Parse the JSON output from the Python script
        const result = JSON.parse(stdoutData);
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse OCR result: ${error.message}\nOutput: ${stdoutData}`));
      }
    });
    
    // Handle process errors
    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start OCR process: ${error.message}`));
    });
  });
};

/**
 * Process a base64-encoded BOL image using PaddleOCR
 * 
 * @param {string} base64Data - Base64-encoded image data
 * @returns {Promise<object>} - Structured OCR results
 */
const processBase64Image = async (base64Data) => {
  // For base64 data, we'll save it to a temporary file to avoid command line length limitations
  const tempFile = path.join(os.tmpdir(), `bol_image_${Date.now()}.txt`);
  fs.writeFileSync(tempFile, base64Data);

  return new Promise((resolve, reject) => {
    // Spawn a Python process to run the OCR
    const pythonProcess = spawn(PYTHON_EXECUTABLE, [OCR_SCRIPT_PATH, 'base64', '@' + tempFile]);
    
    let stdoutData = '';
    let stderrData = '';
    
    // Collect stdout data
    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });
    
    // Collect stderr data
    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });
    
    // Handle process exit
    pythonProcess.on('close', (code) => {
      // Clean up the temporary file
      try { fs.unlinkSync(tempFile); } catch (e) { /* ignore */ }
      
      if (code !== 0) {
        reject(new Error(`OCR process exited with code ${code}: ${stderrData}`));
        return;
      }
      
      try {
        // Parse the JSON output from the Python script
        const result = JSON.parse(stdoutData);
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse OCR result: ${error.message}\nOutput: ${stdoutData}`));
      }
    });
    
    // Handle process errors
    pythonProcess.on('error', (error) => {
      // Clean up the temporary file
      try { fs.unlinkSync(tempFile); } catch (e) { /* ignore */ }
      
      reject(new Error(`Failed to start OCR process: ${error.message}`));
    });
  });
};

/**
 * Test the OCR functionality
 * 
 * @returns {Promise<object>} - Test result
 */
const testOcr = async () => {
  return new Promise((resolve, reject) => {
    // Spawn a Python process to run the test
    const pythonProcess = spawn(PYTHON_EXECUTABLE, ['-c', `
import sys
sys.path.append('${path.dirname(__dirname)}')
try:
    # Check if dependencies are available first
    from ocr.bol_processor import test_ocr, DEPENDENCIES_AVAILABLE, ERROR_MESSAGE
    import json
    
    result = test_ocr()
    print(json.dumps(result))
except ImportError as e:
    import json
    print(json.dumps({
        "success": False,
        "error": f"Failed to import OCR module: {str(e)}",
        "error_type": "ImportError",
        "message": "OCR module is not properly installed"
    }))
except Exception as e:
    import json
    import traceback
    print(json.dumps({
        "success": False,
        "error": str(e),
        "error_type": type(e).__name__,
        "traceback": traceback.format_exc()
    }))
`]);
    
    let stdoutData = '';
    let stderrData = '';
    
    // Collect stdout data
    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });
    
    // Collect stderr data
    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });
    
    // Handle process exit
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        if (stderrData) {
          reject(new Error(`OCR test process exited with code ${code}: ${stderrData}`));
        } else {
          // We might still have useful output in stdout even with a non-zero exit code
          try {
            const result = JSON.parse(stdoutData);
            resolve(result);
          } catch (error) {
            reject(new Error(`OCR test process exited with code ${code} and couldn't parse output: ${stdoutData}`));
          }
        }
        return;
      }
      
      try {
        // Parse the JSON output from the Python script
        const result = JSON.parse(stdoutData);
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse OCR test result: ${error.message}\nOutput: ${stdoutData}`));
      }
    });
    
    // Handle process errors
    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start OCR test process: ${error.message}`));
    });
  });
};

// Export the functions
export {
  processImageFile,
  processBase64Image,
  testOcr
};