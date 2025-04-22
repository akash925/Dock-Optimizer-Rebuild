import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BolUpload from './bol-upload';
import { compressFile, parseBol } from '@/lib/ocr-service';

// Mock the OCR service
jest.mock('@/lib/ocr-service', () => ({
  parseBol: jest.fn(),
  compressFile: jest.fn(file => file),
  ParsedBolData: {}
}));

// Mock fetch for file uploads
global.fetch = jest.fn(() => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ fileUrl: '/uploads/test.pdf' })
  })
) as jest.Mock;

describe('BolUpload Component', () => {
  const mockOnBolProcessed = jest.fn();
  const mockOnProcessingStateChange = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    (parseBol as jest.Mock).mockResolvedValue({
      bolNumber: 'BOL-12345',
      customerName: 'TEST CUSTOMER',
      carrierName: 'TEST CARRIER',
      mcNumber: 'MC-54321',
      weight: '1000',
      palletCount: '10'
    });
  });
  
  test('renders upload button', () => {
    render(
      <BolUpload 
        onBolProcessed={mockOnBolProcessed} 
        onProcessingStateChange={mockOnProcessingStateChange} 
      />
    );
    
    expect(screen.getByText(/Upload BOL/i)).toBeInTheDocument();
  });
  
  test('accepts PDF file upload', async () => {
    render(
      <BolUpload 
        onBolProcessed={mockOnBolProcessed} 
        onProcessingStateChange={mockOnProcessingStateChange} 
      />
    );
    
    // Create a mock PDF file
    const pdfFile = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });
    
    // Get the file input (which is hidden but still in the DOM)
    const input = document.querySelector('input[type="file"]');
    if (!input) throw new Error('File input not found');
    
    // Simulate file selection
    fireEvent.change(input, { target: { files: [pdfFile] } });
    
    // Verify processing state was updated
    expect(mockOnProcessingStateChange).toHaveBeenCalledWith(true);
    
    // Wait for the processing to complete
    await waitFor(() => {
      expect(parseBol).toHaveBeenCalledWith(pdfFile);
      expect(mockOnBolProcessed).toHaveBeenCalled();
      expect(mockOnProcessingStateChange).toHaveBeenCalledWith(false);
    });
  });
  
  test('accepts image file upload', async () => {
    render(
      <BolUpload 
        onBolProcessed={mockOnBolProcessed} 
        onProcessingStateChange={mockOnProcessingStateChange} 
      />
    );
    
    // Create a mock image file
    const imageFile = new File(['dummy image content'], 'test.jpg', { type: 'image/jpeg' });
    
    // Get the file input
    const input = document.querySelector('input[type="file"]');
    if (!input) throw new Error('File input not found');
    
    // Simulate file selection
    fireEvent.change(input, { target: { files: [imageFile] } });
    
    // Wait for the processing to complete
    await waitFor(() => {
      expect(parseBol).toHaveBeenCalledWith(imageFile);
      expect(mockOnBolProcessed).toHaveBeenCalled();
    });
  });
  
  test('accepts Word document upload', async () => {
    render(
      <BolUpload 
        onBolProcessed={mockOnBolProcessed} 
        onProcessingStateChange={mockOnProcessingStateChange} 
      />
    );
    
    // Create a mock Word document file
    const docFile = new File(['dummy doc content'], 'test.docx', { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });
    
    // Get the file input
    const input = document.querySelector('input[type="file"]');
    if (!input) throw new Error('File input not found');
    
    // Simulate file selection
    fireEvent.change(input, { target: { files: [docFile] } });
    
    // Wait for the processing to complete
    await waitFor(() => {
      expect(parseBol).toHaveBeenCalledWith(docFile);
      expect(mockOnBolProcessed).toHaveBeenCalled();
    });
  });
  
  test('shows loading state during processing', async () => {
    // Delay the parseBol response to test loading state
    (parseBol as jest.Mock).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => 
        resolve({
          bolNumber: 'BOL-12345',
          customerName: 'TEST CUSTOMER'
        }), 100)
      )
    );
    
    render(
      <BolUpload 
        onBolProcessed={mockOnBolProcessed} 
        onProcessingStateChange={mockOnProcessingStateChange} 
      />
    );
    
    // Create a mock PDF file
    const pdfFile = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });
    
    // Get the file input
    const input = document.querySelector('input[type="file"]');
    if (!input) throw new Error('File input not found');
    
    // Simulate file selection
    fireEvent.change(input, { target: { files: [pdfFile] } });
    
    // Verify loading state is shown
    expect(await screen.findByText(/Processing BOL file/i)).toBeInTheDocument();
    
    // Wait for processing to complete
    await waitFor(() => {
      expect(mockOnBolProcessed).toHaveBeenCalled();
    });
  });
});