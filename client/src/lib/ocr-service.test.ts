import { parseBol, compressFile } from './ocr-service';

describe('OCR Service', () => {
  // Mock the FileReader API
  const originalFileReader = global.FileReader;
  
  beforeEach(() => {
    // Create a mock FileReader
    global.FileReader = jest.fn(() => ({
      readAsText: jest.fn(),
      onload: null,
      onerror: null,
    })) as any;
  });
  
  afterEach(() => {
    // Restore original FileReader
    global.FileReader = originalFileReader;
  });
  
  test('parseBol extracts BOL number from filename', async () => {
    // Create a mock file
    const file = new File(['dummy content'], 'BOL-12345.pdf', { type: 'application/pdf' });
    
    // Create a promise to track when the onload event is triggered
    const parsePromise = parseBol(file);
    
    // Simulate FileReader onload
    const reader = new FileReader();
    setTimeout(() => {
      // @ts-ignore - accessing private property for testing
      reader.onload({ target: { result: 'dummy content' } });
    }, 0);
    
    // Wait for the parseBol promise to resolve
    const result = await parsePromise;
    
    // Verify the BOL number was extracted
    expect(result.bolNumber).toBe('12345');
  });
  
  test('parseBol extracts customer name if present in filename', async () => {
    // Create a mock file with customer name in filename
    const file = new File(['dummy content'], 'BOL-12345-customer-acme.pdf', { type: 'application/pdf' });
    
    // Create a promise to track when the onload event is triggered
    const parsePromise = parseBol(file);
    
    // Simulate FileReader onload
    const reader = new FileReader();
    setTimeout(() => {
      // @ts-ignore - accessing private property for testing
      reader.onload({ target: { result: 'dummy content' } });
    }, 0);
    
    // Wait for the parseBol promise to resolve
    const result = await parsePromise;
    
    // Verify the customer name was extracted
    expect(result.customerName).toBe('ACME');
  });
  
  test('parseBol handles errors properly', async () => {
    // Create a mock file
    const file = new File(['dummy content'], 'BOL-12345.pdf', { type: 'application/pdf' });
    
    // Create a promise that should reject
    const parsePromise = parseBol(file);
    
    // Simulate FileReader error
    const reader = new FileReader();
    setTimeout(() => {
      // @ts-ignore - accessing private property for testing
      reader.onerror();
    }, 0);
    
    // Wait for the parseBol promise to reject
    await expect(parsePromise).rejects.toThrow('Error reading file');
  });
  
  test('compressFile returns the original file', async () => {
    // Create a mock file
    const file = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });
    
    // Compress the file
    const compressedFile = await compressFile(file);
    
    // Verify the compressed file is the same as the original
    expect(compressedFile).toBe(file);
  });
});