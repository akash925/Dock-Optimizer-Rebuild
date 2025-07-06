describe('Unified Scanner Integration', () => {
  beforeEach(() => {
    // Mock camera permissions and media devices
    cy.window().then((win) => {
      // Mock navigator.mediaDevices
      Object.defineProperty(win.navigator, 'mediaDevices', {
        value: {
          enumerateDevices: () => Promise.resolve([
            {
              deviceId: 'camera1',
              kind: 'videoinput',
              label: 'Front Camera',
              groupId: 'group1'
            },
            {
              deviceId: 'camera2', 
              kind: 'videoinput',
              label: 'Back Camera',
              groupId: 'group2'
            }
          ]),
          getUserMedia: () => Promise.resolve(new MediaStream())
        },
        writable: true
      });
    });
  });

  describe('Asset Barcode Scanning', () => {
    it('should scan and detect asset barcodes', () => {
      cy.visit('/company-assets');
      
      // Open scanner
      cy.get('[data-testid="barcode-scan-button"]').click();
      
      // Verify scanner opens with unified mode
      cy.get('[data-testid="barcode-scanner"]').should('be.visible');
      cy.contains('Scan Code').should('be.visible');
      cy.contains('Assets + Appointments').should('be.visible');
      
      // Mock barcode detection
      cy.window().then((win) => {
        // Simulate barcode detection
        const mockBarcode = 'H12345';
        cy.get('[data-testid="barcode-scanner"]').then(() => {
          // Trigger detection handler
          win.dispatchEvent(new CustomEvent('barcode-detected', { 
            detail: { code: mockBarcode, type: 'asset' }
          }));
        });
      });
      
      // Verify asset detection feedback
      cy.contains('Asset Barcode Detected').should('be.visible');
      cy.contains('H12345').should('be.visible');
    });

    it('should handle barcode scanner camera switching', () => {
      cy.visit('/company-assets');
      
      // Open scanner
      cy.get('[data-testid="barcode-scan-button"]').click();
      
      // Verify camera switcher is available
      cy.get('[data-testid="camera-switcher"]').should('be.visible');
      
      // Switch camera
      cy.get('[data-testid="camera-switcher"]').click();
      
      // Verify camera switch feedback
      cy.contains('Activating camera').should('be.visible');
    });

    it('should handle barcode scanner errors gracefully', () => {
      cy.visit('/company-assets');
      
      // Mock camera permission denied
      cy.window().then((win) => {
        Object.defineProperty(win.navigator, 'mediaDevices', {
          value: {
            enumerateDevices: () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')),
            getUserMedia: () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'))
          },
          writable: true
        });
      });
      
      // Open scanner
      cy.get('[data-testid="barcode-scan-button"]').click();
      
      // Verify error handling
      cy.contains('Camera access denied').should('be.visible');
      cy.contains('Please allow camera access').should('be.visible');
      cy.get('[data-testid="retry-button"]').should('be.visible');
    });
  });

  describe('Appointment QR Code Scanning', () => {
    it('should scan and detect appointment QR codes', () => {
      cy.visit('/schedules');
      
      // Mock appointment data
      cy.intercept('GET', '/api/schedules/confirmation/CONF123', {
        statusCode: 200,
        body: {
          id: 1,
          customerName: 'John Doe',
          confirmationCode: 'CONF123',
          date: '2024-01-15',
          time: '10:00'
        }
      }).as('getAppointment');
      
      // Open scanner
      cy.get('[data-testid="appointment-scan-button"]').click();
      
      // Verify scanner opens
      cy.get('[data-testid="appointment-scanner"]').should('be.visible');
      cy.contains('Scan Appointment QR Code').should('be.visible');
      
      // Mock QR code detection
      cy.window().then((win) => {
        // Simulate QR code detection with URL format
        const mockQRCode = 'https://app.example.com/appointment?code=CONF123';
        cy.get('[data-testid="appointment-scanner"]').then(() => {
          // Trigger detection handler
          win.dispatchEvent(new CustomEvent('qrcode-detected', { 
            detail: { code: mockQRCode, type: 'appointment' }
          }));
        });
      });
      
      // Verify appointment lookup
      cy.wait('@getAppointment');
      cy.contains('Appointment Found').should('be.visible');
      cy.contains('John Doe').should('be.visible');
    });

    it('should handle QR code with direct confirmation code', () => {
      cy.visit('/schedules');
      
      // Mock appointment data
      cy.intercept('GET', '/api/schedules/confirmation/CONF456', {
        statusCode: 200,
        body: {
          id: 2,
          customerName: 'Jane Smith',
          confirmationCode: 'CONF456'
        }
      }).as('getAppointment');
      
      // Open scanner
      cy.get('[data-testid="appointment-scan-button"]').click();
      
      // Mock direct confirmation code detection
      cy.window().then((win) => {
        const mockCode = 'CONF456';
        cy.get('[data-testid="appointment-scanner"]').then(() => {
          win.dispatchEvent(new CustomEvent('qrcode-detected', { 
            detail: { code: mockCode, type: 'appointment' }
          }));
        });
      });
      
      // Verify appointment lookup
      cy.wait('@getAppointment');
      cy.contains('Appointment Found').should('be.visible');
      cy.contains('Jane Smith').should('be.visible');
    });

    it('should handle appointment not found', () => {
      cy.visit('/schedules');
      
      // Mock appointment not found
      cy.intercept('GET', '/api/schedules/confirmation/INVALID', {
        statusCode: 404,
        body: { error: 'Appointment not found' }
      }).as('getAppointmentNotFound');
      
      // Open scanner
      cy.get('[data-testid="appointment-scan-button"]').click();
      
      // Mock invalid QR code detection
      cy.window().then((win) => {
        const mockCode = 'INVALID';
        cy.get('[data-testid="appointment-scanner"]').then(() => {
          win.dispatchEvent(new CustomEvent('qrcode-detected', { 
            detail: { code: mockCode, type: 'appointment' }
          }));
        });
      });
      
      // Verify error handling
      cy.wait('@getAppointmentNotFound');
      cy.contains('No Appointment Found').should('be.visible');
    });
  });

  describe('Unified Scanner Mode', () => {
    it('should handle both barcode and QR code detection in unified mode', () => {
      cy.visit('/company-assets');
      
      // Open unified scanner
      cy.get('[data-testid="unified-scan-button"]').click();
      
      // Verify unified mode indicator
      cy.contains('Assets + Appointments').should('be.visible');
      cy.contains('Point your camera at any barcode or QR code').should('be.visible');
      
      // Test asset barcode detection
      cy.window().then((win) => {
        const mockBarcode = 'H99999';
        cy.get('[data-testid="barcode-scanner"]').then(() => {
          win.dispatchEvent(new CustomEvent('code-detected', { 
            detail: { code: mockBarcode }
          }));
        });
      });
      
      // Verify asset detection
      cy.contains('Asset Barcode Detected').should('be.visible');
    });

    it('should prioritize appointment codes over asset codes in unified mode', () => {
      cy.visit('/company-assets');
      
      // Mock appointment lookup
      cy.intercept('GET', '/api/schedules/confirmation/CONF789', {
        statusCode: 200,
        body: {
          id: 3,
          customerName: 'Bob Johnson',
          confirmationCode: 'CONF789'
        }
      }).as('getAppointment');
      
      // Open unified scanner
      cy.get('[data-testid="unified-scan-button"]').click();
      
      // Mock detection that could be either type
      cy.window().then((win) => {
        const mockCode = 'CONF789';
        cy.get('[data-testid="barcode-scanner"]').then(() => {
          win.dispatchEvent(new CustomEvent('code-detected', { 
            detail: { code: mockCode }
          }));
        });
      });
      
      // Verify appointment is detected first
      cy.wait('@getAppointment');
      cy.contains('Appointment Found').should('be.visible');
      cy.contains('Bob Johnson').should('be.visible');
    });

    it('should fall back to asset search when appointment not found', () => {
      cy.visit('/company-assets');
      
      // Mock appointment not found
      cy.intercept('GET', '/api/schedules/confirmation/ASSET123', {
        statusCode: 404,
        body: { error: 'Appointment not found' }
      }).as('getAppointmentNotFound');
      
      // Open unified scanner
      cy.get('[data-testid="unified-scan-button"]').click();
      
      // Mock detection
      cy.window().then((win) => {
        const mockCode = 'ASSET123';
        cy.get('[data-testid="barcode-scanner"]').then(() => {
          win.dispatchEvent(new CustomEvent('code-detected', { 
            detail: { code: mockCode }
          }));
        });
      });
      
      // Verify fallback to asset detection
      cy.wait('@getAppointmentNotFound');
      cy.contains('Asset Barcode Detected').should('be.visible');
    });
  });

  describe('Mobile Scanner Features', () => {
    it('should show mobile-specific controls on mobile devices', () => {
      // Mock mobile user agent
      cy.window().then((win) => {
        Object.defineProperty(win.navigator, 'userAgent', {
          value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
          writable: true
        });
      });
      
      cy.visit('/company-assets');
      
      // Open scanner
      cy.get('[data-testid="barcode-scan-button"]').click();
      
      // Verify mobile controls
      cy.get('[data-testid="camera-switch-button"]').should('be.visible');
      cy.get('[data-testid="flashlight-toggle"]').should('be.visible');
      
      // Test flashlight toggle
      cy.get('[data-testid="flashlight-toggle"]').click();
      cy.get('[data-testid="flashlight-toggle"]').should('have.class', 'active');
    });

    it('should handle torch/flashlight functionality', () => {
      // Mock mobile user agent
      cy.window().then((win) => {
        Object.defineProperty(win.navigator, 'userAgent', {
          value: 'Mozilla/5.0 (Android 10; Mobile; rv:81.0) Gecko/81.0 Firefox/81.0',
          writable: true
        });
      });
      
      cy.visit('/company-assets');
      
      // Open scanner
      cy.get('[data-testid="barcode-scan-button"]').click();
      
      // Test flashlight toggle
      cy.get('[data-testid="flashlight-toggle"]').click();
      
      // Verify torch state change
      cy.get('[data-testid="flashlight-toggle"]').should('have.attr', 'aria-pressed', 'true');
    });
  });

  describe('Scanner Performance and Reliability', () => {
    it('should handle rapid successive scans without breaking', () => {
      cy.visit('/company-assets');
      
      // Open scanner
      cy.get('[data-testid="barcode-scan-button"]').click();
      
      // Simulate rapid successive detections
      cy.window().then((win) => {
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            win.dispatchEvent(new CustomEvent('code-detected', { 
              detail: { code: `RAPID${i}` }
            }));
          }, i * 100);
        }
      });
      
      // Verify only one detection is processed
      cy.get('[data-testid="detection-status"]').should('contain', 'Processing...');
    });

    it('should clean up resources when scanner is closed', () => {
      cy.visit('/company-assets');
      
      // Open scanner
      cy.get('[data-testid="barcode-scan-button"]').click();
      
      // Verify scanner is active
      cy.get('[data-testid="barcode-scanner"]').should('be.visible');
      
      // Close scanner
      cy.get('[data-testid="close-scanner"]').click();
      
      // Verify cleanup
      cy.get('[data-testid="barcode-scanner"]').should('not.exist');
      
      // Verify no memory leaks by checking for active streams
      cy.window().then((win) => {
        // Check that no active media streams remain
        expect(win.navigator.mediaDevices).to.exist;
      });
    });
  });
}); 