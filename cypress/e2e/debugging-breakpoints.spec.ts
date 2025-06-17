/**
 * Debugging and Breakpoint Testing for Dock Optimizer
 * 
 * These tests are designed specifically for debugging issues and include
 * strategic breakpoints, detailed logging, and API monitoring.
 */

describe('Debugging and Breakpoint Tests', () => {
  // Enable detailed logging for debugging
  beforeEach(() => {
    // Set up comprehensive request/response logging
    cy.intercept('**', (req) => {
      console.log(`🌐 ${req.method} ${req.url}`);
      if (req.body) {
        console.log('📤 Request Body:', req.body);
      }
      
      req.on('response', (res) => {
        console.log(`📥 Response ${res.statusCode} for ${req.method} ${req.url}`);
        if (res.body) {
          console.log('📋 Response Body:', res.body);
        }
      });
    });

    // Login for tests that need authentication
    cy.login('testadmin', 'password123');
  });

  describe('API Debugging Tests', () => {
    it('should debug availability API with detailed logging', () => {
      // Set up specific intercepts for availability debugging
      cy.intercept('GET', '/api/facilities**').as('getFacilities');
      cy.intercept('GET', '/api/appointment-types**').as('getAppointmentTypes');
      cy.intercept('GET', '/api/availability**').as('getAvailability');
      
      // Navigate to booking page
      cy.visit('/book/test-facility');
      
      // Wait and debug each API call
      cy.wait('@getFacilities').then((interception) => {
        cy.log('🏢 Facilities API Response:', interception.response.body);
        
        // BREAKPOINT: Add debugger for facilities investigation
        cy.then(() => {
          debugger; // Browser will pause here if DevTools open
        });
        
        expect(interception.response.statusCode).to.equal(200);
        expect(interception.response.body).to.be.an('array');
      });
      
      // Select appointment type to trigger availability call
      cy.get('[data-testid="appointment-type-select"]').select('1 Hour Trailer Appointment');
      cy.get('[data-testid="date-picker"]').type('2024-01-15');
      
      cy.wait('@getAvailability').then((interception) => {
        cy.log('⏰ Availability API Response:', interception.response);
        
        // BREAKPOINT: Critical debugging point for availability issues
        cy.then(() => {
          debugger; // Browser will pause here for availability debugging
        });
        
        // Detailed assertions with logging
        if (interception.response.statusCode !== 200) {
          cy.log('❌ Availability API Error:', interception.response.body);
          cy.log('📝 Request params:', interception.request.query);
        } else {
          cy.log('✅ Availability API Success');
          expect(interception.response.body).to.have.property('timeSlots');
        }
      });
    });

    it('should debug database connection issues', () => {
      // Test database-related API endpoints
      const endpoints = [
        '/api/facilities',
        '/api/appointment-types', 
        '/api/organizations',
        '/api/user'
      ];
      
      endpoints.forEach((endpoint) => {
        cy.request({
          method: 'GET',
          url: endpoint,
          failOnStatusCode: false
        }).then((response) => {
          cy.log(`🔍 Testing ${endpoint}:`, response.status);
          
          if (response.status >= 400) {
            cy.log(`❌ Error in ${endpoint}:`, response.body);
            
            // BREAKPOINT: Pause for database error investigation
            cy.then(() => {
              debugger;
            });
          } else {
            cy.log(`✅ ${endpoint} working correctly`);
          }
        });
      });
    });
  });

  describe('Component State Debugging', () => {
    it('should debug booking form state transitions', () => {
      cy.visit('/book/test-facility');
      
      // Debug initial state
      cy.get('body').then(() => {
        cy.log('🚀 Initial page load complete');
        debugger; // BREAKPOINT: Check initial component state
      });
      
      // Monitor form state changes
      cy.get('[data-testid="appointment-type-select"]').then(($select) => {
        cy.log('📝 Appointment type select element:', $select);
        
        cy.wrap($select).select('1 Hour Trailer Appointment').then(() => {
          cy.log('✅ Appointment type selected');
          debugger; // BREAKPOINT: Check state after appointment type selection
        });
      });
      
      // Debug date picker state
      cy.get('[data-testid="date-picker"]').then(($datePicker) => {
        cy.log('📅 Date picker element:', $datePicker);
        
        cy.wrap($datePicker).type('2024-01-15').then(() => {
          cy.log('✅ Date selected');
          debugger; // BREAKPOINT: Check state after date selection
        });
      });
      
      // Debug time slot loading
      cy.get('[data-testid="appointment-time-select"]', { timeout: 15000 }).should('be.visible').then(($timeSelect) => {
        cy.log('⏰ Time select element:', $timeSelect);
        debugger; // BREAKPOINT: Check time slots loaded state
      });
    });
  });

  describe('Error Handling Debugging', () => {
    it('should debug error states with detailed information', () => {
      // Force various error conditions for debugging
      const errorScenarios = [
        {
          name: 'Database Connection Error',
          intercept: { url: '/api/facilities', status: 503, body: { error: 'Database unavailable' } }
        },
        {
          name: 'Availability Service Error', 
          intercept: { url: '/api/availability**', status: 500, body: { error: 'Internal server error' } }
        },
        {
          name: 'Authentication Error',
          intercept: { url: '/api/user', status: 401, body: { error: 'Not authenticated' } }
        }
      ];
      
      errorScenarios.forEach((scenario) => {
        cy.log(`🧪 Testing scenario: ${scenario.name}`);
        
        // Set up error condition
        cy.intercept('GET', scenario.intercept.url, {
          statusCode: scenario.intercept.status,
          body: scenario.intercept.body
        }).as(`error_${scenario.name.replace(/\s+/g, '_')}`);
        
        // Trigger the scenario
        cy.visit('/book/test-facility', { failOnStatusCode: false });
        
        // Debug the error handling
        cy.get('body').then(() => {
          cy.log(`🔍 Debugging ${scenario.name} error handling`);
          debugger; // BREAKPOINT: Debug error state
        });
        
        // Clear intercept for next scenario
        cy.intercept('GET', scenario.intercept.url).as('reset');
      });
    });
  });

  describe('Performance Debugging', () => {
    it('should debug slow API responses', () => {
      // Add artificial delays to test performance issues
      cy.intercept('GET', '/api/availability**', (req) => {
        req.on('response', (res) => {
          // Add 3 second delay to simulate slow database
          setTimeout(() => {
            res.send(res.body);
          }, 3000);
        });
      }).as('slowAvailability');
      
      const startTime = Date.now();
      
      cy.visit('/book/test-facility');
      cy.get('[data-testid="appointment-type-select"]').select('1 Hour Trailer Appointment');
      cy.get('[data-testid="date-picker"]').type('2024-01-15');
      
      // Debug loading states during slow response
      cy.get('[data-testid="loading-indicator"]').should('be.visible').then(() => {
        const loadingTime = Date.now() - startTime;
        cy.log(`⏱️ Loading indicator appeared after ${loadingTime}ms`);
        debugger; // BREAKPOINT: Debug loading state
      });
      
      cy.wait('@slowAvailability').then((interception) => {
        const totalTime = Date.now() - startTime;
        cy.log(`🐌 Total response time: ${totalTime}ms`);
        debugger; // BREAKPOINT: Debug performance impact
      });
    });
  });

  describe('Console Error Monitoring', () => {
    it('should capture and debug console errors', () => {
      // Monitor browser console for errors
      cy.window().then((win) => {
        cy.stub(win.console, 'error').as('consoleError');
      });
      
      cy.visit('/book/test-facility');
      
      // Complete a booking flow while monitoring for errors
      cy.get('[data-testid="appointment-type-select"]').select('1 Hour Trailer Appointment');
      cy.get('[data-testid="date-picker"]').type('2024-01-15');
      cy.get('[data-testid="appointment-time-select"]').select('09:00');
      
      // Check for console errors
      cy.get('@consoleError').then((stub) => {
        const consoleError = stub as any; // Cast to access Cypress stub properties
        if (consoleError.called) {
          cy.log('🚨 Console errors detected:', consoleError.args);
          debugger; // BREAKPOINT: Debug console errors
          
          // Fail test if console errors are found
          expect(consoleError).to.not.have.been.called;
        } else {
          cy.log('✅ No console errors detected');
        }
      });
    });
  });
}); 