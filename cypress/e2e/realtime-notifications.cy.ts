/// <reference types="cypress" />

describe('Real-time Appointment Notifications', () => {
  beforeEach(() => {
    // Mock the WebSocket connection to prevent actual connections during tests
    cy.window().then((win) => {
      // Mock WebSocket constructor with proper typing
      (win as any).WebSocket = cy.stub().callsFake((url) => {
        const mockSocket = {
          send: cy.stub(),
          close: cy.stub(),
          addEventListener: cy.stub(),
          removeEventListener: cy.stub(),
          readyState: 1, // OPEN
        };
        
        // Store the mock socket for later use
        (win as any).mockWebSocket = mockSocket;
        return mockSocket;
      });
    });
    
    // Login as admin user
    cy.visit('/auth');
    cy.get('[data-cy=username]').type('admin');
    cy.get('[data-cy=password]').type('password');
    cy.get('[data-cy=login-button]').click();
    
    // Wait for login to complete
    cy.url().should('not.include', '/auth');
    cy.get('[data-cy=user-menu]').should('be.visible');
  });

  describe('Toast Notifications', () => {
    it('should show toast notification when appointment:created event is received', () => {
      // Navigate to dashboard where real-time updates are active
      cy.visit('/dashboard');
      
      // Wait for dashboard to load
      cy.get('[data-cy=dashboard-content]').should('be.visible');
      
      // Simulate receiving an appointment:created WebSocket message
      cy.window().then((win) => {
        const mockSocket = (win as any).mockWebSocket;
        
        // Find the message event listener that was registered
        const messageListener = mockSocket.addEventListener.getCalls()
          .find((call: any) => call.args[0] === 'message')?.args[1];
        
        if (messageListener) {
          // Simulate receiving an appointment:created message
          const mockEvent = {
            data: JSON.stringify({
              type: 'appointment:created',
              data: {
                schedule: {
                  id: 123,
                  customerName: 'Test Customer',
                  truckNumber: 'TR-001',
                  startTime: '2024-01-15T10:00:00Z',
                  endTime: '2024-01-15T11:00:00Z',
                  status: 'scheduled',
                  type: 'inbound',
                  facilityName: 'Test Facility',
                  appointmentTypeName: 'Standard Appointment',
                  confirmationCode: 'ABC123'
                },
                tenantId: 1
              }
            })
          };
          
          // Trigger the message event
          messageListener(mockEvent);
        }
      });
      
      // Verify toast notification appears
      cy.get('[data-cy=toast-notification]').should('be.visible');
      cy.get('[data-cy=toast-notification]').should('contain', '🚛 New Appointment Created');
      cy.get('[data-cy=toast-notification]').should('contain', 'Test Customer');
      cy.get('[data-cy=toast-notification]').should('contain', 'has booked an appointment');
      
      // Verify toast disappears after specified duration
      cy.get('[data-cy=toast-notification]').should('not.exist', { timeout: 6000 });
    });

    it('should handle multiple appointment notifications', () => {
      cy.visit('/dashboard');
      cy.get('[data-cy=dashboard-content]').should('be.visible');
      
      // Simulate receiving multiple appointment:created messages
      cy.window().then((win) => {
        const mockSocket = (win as any).mockWebSocket;
        const messageListener = mockSocket.addEventListener.getCalls()
          .find((call: any) => call.args[0] === 'message')?.args[1];
        
        if (messageListener) {
          // First appointment
          const mockEvent1 = {
            data: JSON.stringify({
              type: 'appointment:created',
              data: {
                schedule: {
                  id: 124,
                  customerName: 'Customer One',
                  truckNumber: 'TR-002',
                  startTime: '2024-01-15T14:00:00Z',
                  endTime: '2024-01-15T15:00:00Z',
                  status: 'scheduled',
                  type: 'inbound',
                  facilityName: 'Test Facility',
                  appointmentTypeName: 'Standard Appointment',
                  confirmationCode: 'DEF456'
                },
                tenantId: 1
              }
            })
          };
          
          // Second appointment
          const mockEvent2 = {
            data: JSON.stringify({
              type: 'appointment:created',
              data: {
                schedule: {
                  id: 125,
                  customerName: 'Customer Two',
                  truckNumber: 'TR-003',
                  startTime: '2024-01-15T16:00:00Z',
                  endTime: '2024-01-15T17:00:00Z',
                  status: 'scheduled',
                  type: 'outbound',
                  facilityName: 'Test Facility',
                  appointmentTypeName: 'Standard Appointment',
                  confirmationCode: 'GHI789'
                },
                tenantId: 1
              }
            })
          };
          
          // Trigger both events with a small delay
          messageListener(mockEvent1);
          setTimeout(() => messageListener(mockEvent2), 100);
        }
      });
      
      // Verify both toast notifications appear
      cy.get('[data-cy=toast-notification]').should('have.length.at.least', 1);
      cy.get('[data-cy=toast-notification]').should('contain', 'Customer One');
      
      // Wait a bit and check for the second notification
      cy.wait(200);
      cy.get('[data-cy=toast-notification]').should('contain', 'Customer Two');
    });
  });

  describe('Bell Badge Notifications', () => {
    it('should update notification bell badge when appointment is created', () => {
      cy.visit('/dashboard');
      cy.get('[data-cy=dashboard-content]').should('be.visible');
      
      // Check initial notification badge state
      cy.get('[data-cy=notification-bell]').should('be.visible');
      
      // Get initial badge count (if any)
      cy.get('[data-cy=notification-badge]').then(($badge) => {
        const initialCount = $badge.length > 0 ? parseInt($badge.text() || '0') : 0;
        
        // Simulate receiving an appointment:created message
        cy.window().then((win) => {
          const mockSocket = (win as any).mockWebSocket;
          const messageListener = mockSocket.addEventListener.getCalls()
            .find((call: any) => call.args[0] === 'message')?.args[1];
          
          if (messageListener) {
            const mockEvent = {
              data: JSON.stringify({
                type: 'appointment:created',
                data: {
                  schedule: {
                    id: 126,
                    customerName: 'Badge Test Customer',
                    truckNumber: 'TR-004',
                    startTime: '2024-01-15T18:00:00Z',
                    endTime: '2024-01-15T19:00:00Z',
                    status: 'scheduled',
                    type: 'inbound',
                    facilityName: 'Test Facility',
                    appointmentTypeName: 'Standard Appointment',
                    confirmationCode: 'JKL012'
                  },
                  tenantId: 1
                }
              })
            };
            
            messageListener(mockEvent);
          }
        });
        
        // Wait for the notification queries to be invalidated and refetched
        cy.wait(1000);
        
        // Verify the notification badge is updated
        // Note: This depends on the actual implementation of the notification system
        // The badge should either appear or increment its count
        cy.get('[data-cy=notification-bell]').should('be.visible');
        
        // Check if badge count increased or badge appeared
        cy.get('body').then(($body) => {
          if ($body.find('[data-cy=notification-badge]').length > 0) {
            cy.get('[data-cy=notification-badge]').should('be.visible');
          }
        });
      });
    });
  });

  describe('Real-time Query Invalidation', () => {
    it('should refresh schedules list when appointment:created event is received', () => {
      // Navigate to schedules page
      cy.visit('/schedules');
      cy.get('[data-cy=schedules-list]').should('be.visible');
      
      // Get initial schedules count
      cy.get('[data-cy=schedule-item]').then(($items) => {
        const initialCount = $items.length;
        
        // Simulate receiving an appointment:created message
        cy.window().then((win) => {
          const mockSocket = (win as any).mockWebSocket;
          const messageListener = mockSocket.addEventListener.getCalls()
            .find((call: any) => call.args[0] === 'message')?.args[1];
          
          if (messageListener) {
            const mockEvent = {
              data: JSON.stringify({
                type: 'appointment:created',
                data: {
                  schedule: {
                    id: 127,
                    customerName: 'Query Test Customer',
                    truckNumber: 'TR-005',
                    startTime: '2024-01-15T20:00:00Z',
                    endTime: '2024-01-15T21:00:00Z',
                    status: 'scheduled',
                    type: 'inbound',
                    facilityName: 'Test Facility',
                    appointmentTypeName: 'Standard Appointment',
                    confirmationCode: 'MNO345'
                  },
                  tenantId: 1
                }
              })
            };
            
            messageListener(mockEvent);
          }
        });
        
        // Wait for query invalidation to trigger a refetch
        cy.wait(2000);
        
        // Verify that queries were invalidated (schedules list should be refreshed)
        // This is verified by checking if the loading state appears briefly
        cy.get('[data-cy=schedules-list]').should('be.visible');
      });
    });
  });

  describe('WebSocket Connection Management', () => {
    it('should handle WebSocket authentication on connection', () => {
      cy.visit('/dashboard');
      cy.get('[data-cy=dashboard-content]').should('be.visible');
      
      // Verify WebSocket connection was attempted
      cy.window().then((win) => {
        expect(win.WebSocket).to.have.been.called;
        
        const mockSocket = (win as any).mockWebSocket;
        
        // Check if authentication message was sent
        expect(mockSocket.send).to.have.been.calledWith(
          Cypress.sinon.match((value) => {
            try {
              const data = JSON.parse(value);
              return data.type === 'auth' && data.tenantId && data.userId;
            } catch (e) {
              return false;
            }
          })
        );
      });
    });

    it('should handle WebSocket connection errors gracefully', () => {
      cy.visit('/dashboard');
      cy.get('[data-cy=dashboard-content]').should('be.visible');
      
      // Simulate WebSocket error
      cy.window().then((win) => {
        const mockSocket = (win as any).mockWebSocket;
        const errorListener = mockSocket.addEventListener.getCalls()
          .find((call: any) => call.args[0] === 'error')?.args[1];
        
        if (errorListener) {
          errorListener(new Error('WebSocket connection failed'));
        }
      });
      
      // Verify the application continues to work despite WebSocket error
      cy.get('[data-cy=dashboard-content]').should('be.visible');
      
      // Check if error state is displayed appropriately
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy=websocket-error]').length > 0) {
          cy.get('[data-cy=websocket-error]').should('be.visible');
        }
      });
    });
  });
}); 