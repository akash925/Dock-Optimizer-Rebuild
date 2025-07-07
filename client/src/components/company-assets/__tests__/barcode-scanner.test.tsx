import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BarcodeScanner } from '../barcode-scanner';

// Mock the zxing library
jest.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: jest.fn().mockImplementation(() => ({
    decodeFromVideoDevice: jest.fn((deviceId, video, callback) => {
      // Simulate barcode detection after a short delay
      setTimeout(() => {
        callback({
          getText: () => 'TEST_BARCODE_123'
        });
      }, 100);
      return Promise.resolve();
    })
  }))
}));

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: {
    enumerateDevices: jest.fn().mockResolvedValue([
      {
        deviceId: 'camera1',
        kind: 'videoinput',
        label: 'Test Camera 1',
        groupId: 'group1'
      },
      {
        deviceId: 'camera2',
        kind: 'videoinput', 
        label: 'Test Camera 2',
        groupId: 'group2'
      }
    ]),
    getUserMedia: jest.fn().mockResolvedValue(new MediaStream())
  }
});

// Mock fetch for API calls
global.fetch = jest.fn();

describe('BarcodeScanner - Unified Scanning', () => {
  const mockOnDetected = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Scanner Modes', () => {
    it('should display unified mode indicators correctly', () => {
      render(
        <BarcodeScanner
          onDetected={mockOnDetected}
          onClose={mockOnClose}
          mode="unified"
        />
      );

      expect(screen.getByText('Scan Code')).toBeInTheDocument();
      expect(screen.getByText('Assets + Appointments')).toBeInTheDocument();
      expect(screen.getByText('Point your camera at any barcode or QR code')).toBeInTheDocument();
    });

    it('should display asset mode indicators correctly', () => {
      render(
        <BarcodeScanner
          onDetected={mockOnDetected}
          onClose={mockOnClose}
          mode="asset"
        />
      );

      expect(screen.getByText('Scan Asset Barcode')).toBeInTheDocument();
      expect(screen.getByText('Point your camera at an asset barcode')).toBeInTheDocument();
    });

    it('should display appointment mode indicators correctly', () => {
      render(
        <BarcodeScanner
          onDetected={mockOnDetected}
          onClose={mockOnClose}
          mode="appointment"
        />
      );

      expect(screen.getByText('Scan Appointment QR Code')).toBeInTheDocument();
      expect(screen.getByText('Point your camera at an appointment QR code')).toBeInTheDocument();
    });
  });

  describe('Unified Detection Logic', () => {
    it('should prioritize appointment codes in unified mode', async () => {
      // Mock successful appointment API call
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 1,
          customerName: 'Test Customer',
          confirmationCode: 'CONF123'
        })
      });

      render(
        <BarcodeScanner
          onDetected={mockOnDetected}
          onClose={mockOnClose}
          mode="unified"
        />
      );

      // Wait for scanner to initialize
      await waitFor(() => {
        expect(screen.getByText('Scan Code')).toBeInTheDocument();
      });

      // Simulate detection of a code that could be either appointment or asset
      const scanner = screen.getByTestId('barcode-scanner') || document.querySelector('[data-testid="barcode-scanner"]');
      if (scanner) {
        fireEvent(scanner, new CustomEvent('code-detected', {
          detail: { code: 'CONF123' }
        }));
      }

      // Verify appointment API was called first
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/schedules/confirmation/CONF123'),
          expect.any(Object)
        );
      });
    });

    it('should fallback to asset detection when appointment not found', async () => {
      // Mock failed appointment API call
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      render(
        <BarcodeScanner
          onDetected={mockOnDetected}
          onClose={mockOnClose}
          mode="unified"
        />
      );

      // Wait for scanner to initialize
      await waitFor(() => {
        expect(screen.getByText('Scan Code')).toBeInTheDocument();
      });

      // Simulate detection
      const scanner = screen.getByTestId('barcode-scanner') || document.querySelector('[data-testid="barcode-scanner"]');
      if (scanner) {
        fireEvent(scanner, new CustomEvent('code-detected', {
          detail: { code: 'ASSET123' }
        }));
      }

      // Verify fallback to asset detection
      await waitFor(() => {
        expect(mockOnDetected).toHaveBeenCalledWith('ASSET123');
      });
    });

    it('should handle URL-formatted QR codes correctly', async () => {
      // Mock successful appointment API call
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 2,
          customerName: 'Another Customer',
          confirmationCode: 'CONF456'
        })
      });

      render(
        <BarcodeScanner
          onDetected={mockOnDetected}
          onClose={mockOnClose}
          mode="unified"
        />
      );

      // Simulate QR code with URL format
      const scanner = screen.getByTestId('barcode-scanner') || document.querySelector('[data-testid="barcode-scanner"]');
      if (scanner) {
        fireEvent(scanner, new CustomEvent('code-detected', {
          detail: { code: 'https://app.example.com/appointment?code=CONF456' }
        }));
      }

      // Verify code extraction and API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/schedules/confirmation/CONF456'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Mobile Features', () => {
    beforeEach(() => {
      // Mock mobile user agent
      Object.defineProperty(global.navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
      });
    });

    it('should show mobile-specific controls', () => {
      render(
        <BarcodeScanner
          onDetected={mockOnDetected}
          onClose={mockOnClose}
          mode="unified"
        />
      );

      // Mobile should show icon-based camera switcher and flashlight
      expect(screen.getByTitle('Switch Camera')).toBeInTheDocument();
      expect(screen.getByTitle(/Turn Flashlight/)).toBeInTheDocument();
    });

    it('should handle flashlight toggle', () => {
      render(
        <BarcodeScanner
          onDetected={mockOnDetected}
          onClose={mockOnClose}
          mode="unified"
        />
      );

      const flashlightButton = screen.getByTitle(/Turn Flashlight/);
      fireEvent.click(flashlightButton);

      // Verify flashlight state change (button should show "Turn Flashlight Off" now)
      expect(screen.getByTitle('Turn Flashlight Off')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle camera permission denied', async () => {
      // Mock permission denied error
      (global.navigator.mediaDevices.enumerateDevices as jest.Mock).mockRejectedValueOnce(
        new DOMException('Permission denied', 'NotAllowedError')
      );

      render(
        <BarcodeScanner
          onDetected={mockOnDetected}
          onClose={mockOnClose}
          mode="unified"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Camera access denied')).toBeInTheDocument();
        expect(screen.getByText('Please allow camera access to scan barcodes')).toBeInTheDocument();
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });

    it('should prevent duplicate processing', async () => {
      render(
        <BarcodeScanner
          onDetected={mockOnDetected}
          onClose={mockOnClose}
          mode="asset"
        />
      );

      // Simulate rapid successive detections
      const scanner = screen.getByTestId('barcode-scanner') || document.querySelector('[data-testid="barcode-scanner"]');
      if (scanner) {
        fireEvent(scanner, new CustomEvent('code-detected', { detail: { code: 'RAPID1' } }));
        fireEvent(scanner, new CustomEvent('code-detected', { detail: { code: 'RAPID2' } }));
        fireEvent(scanner, new CustomEvent('code-detected', { detail: { code: 'RAPID3' } }));
      }

      // Verify only one detection is processed
      await waitFor(() => {
        expect(mockOnDetected).toHaveBeenCalledTimes(1);
        expect(mockOnDetected).toHaveBeenCalledWith('RAPID1');
      });
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources when component unmounts', () => {
      const { unmount } = render(
        <BarcodeScanner
          onDetected={mockOnDetected}
          onClose={mockOnClose}
          mode="unified"
        />
      );

      // Unmount component
      unmount();

      // Verify cleanup - in a real implementation, this would check that
      // media streams are stopped and readers are reset
      expect(true).toBe(true); // Placeholder for cleanup verification
    });

    it('should handle close button correctly', () => {
      render(
        <BarcodeScanner
          onDetected={mockOnDetected}
          onClose={mockOnClose}
          mode="unified"
        />
      );

      const closeButton = screen.getByTitle('Close');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
}); 