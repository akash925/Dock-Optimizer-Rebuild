/**
 * Dock Optimizer Booking Flow E2E Tests
 * 
 * These tests verify the complete booking workflow from external booking page
 * to internal appointment management, focusing on availability calculation
 * which was the source of recent production issues.
 */

describe('Booking Flow End-to-End Tests', () => {
  const TEST_BOOKING_PAGE_SLUG = 'test-facility';
  const TEST_FACILITY_ID = 4;
  const TEST_APPOINTMENT_TYPE_ID = 7;
  const TEST_DATE = '2024-01-15';

  beforeEach(() => {
    // Real login flow to test actual authentication
    cy.visit('/auth');
    cy.get('input[name="username"]').type('testadmin');
    cy.get('input[name="password"]').type('password123');
    cy.get('button[type="submit"]').click();
    
    // Wait for successful login redirect
    cy.url().should('not.include', '/auth');
  });

  describe('External Booking Page Tests', () => {
    it('should load booking page and display appointment times', () => {
      // Navigate to external booking page
      cy.visit(`/book/${TEST_BOOKING_PAGE_SLUG}`);
      
      // Step 1: Select facility (should auto-select if only one)
      cy.get('[data-testid="facility-select"]', { timeout: 10000 }).should('be.visible');
      
      // Step 2: Select appointment type
      cy.get('[data-testid="appointment-type-select"]').should('be.visible');
      cy.get('[data-testid="appointment-type-select"]').click();
      cy.contains('1 Hour Trailer Appointment').click();
      
      // Step 3: Select date
      cy.get('[data-testid="date-picker"]').should('be.visible');
      cy.get('[data-testid="date-picker"]').click();
      cy.get(`[data-date="${TEST_DATE}"]`).click();
      
      // CRITICAL TEST: Verify appointment times load without error
      cy.get('[data-testid="appointment-time-select"]', { timeout: 15000 }).should('be.visible');
      
      // Check that times are actually populated (not empty dropdown)
      cy.get('[data-testid="appointment-time-select"]').click();
      cy.get('[data-testid="time-option"]').should('have.length.greaterThan', 0);
      
      // Verify no "Failed to load times" error message
      cy.contains('Failed to load appointment times').should('not.exist');
      cy.contains('No times available').should('not.exist');
    });

    it('should handle appointment availability API errors gracefully', () => {
      // Intercept availability API and return error
      cy.intercept('GET', '/api/availability/**', {
        statusCode: 500,
        body: { error: 'Internal server error' }
      }).as('availabilityError');
      
      cy.visit(`/book/${TEST_BOOKING_PAGE_SLUG}`);
      
      // Go through booking steps
      cy.get('[data-testid="appointment-type-select"]').click();
      cy.contains('1 Hour Trailer Appointment').click();
      cy.get('[data-testid="date-picker"]').click();
      cy.get(`[data-date="${TEST_DATE}"]`).click();
      
      // Wait for error response
      cy.wait('@availabilityError');
      
      // Should show user-friendly error message
      cy.contains('Unable to load appointment times').should('be.visible');
      cy.contains('Please try again').should('be.visible');
    });

    it('should complete full booking flow', () => {
      cy.visit(`/book/${TEST_BOOKING_PAGE_SLUG}`);
      
      // Complete all booking steps
      cy.get('[data-testid="appointment-type-select"]').click();
      cy.contains('1 Hour Trailer Appointment').click();
      
      cy.get('[data-testid="date-picker"]').click();
      cy.get(`[data-date="${TEST_DATE}"]`).click();
      
      cy.get('[data-testid="appointment-time-select"]').click();
      cy.get('[data-testid="time-option"]').first().click();
      
      // Fill in contact information
      cy.get('input[name="contactName"]').type('John Doe');
      cy.get('input[name="contactEmail"]').type('john@example.com');
      cy.get('input[name="contactPhone"]').type('555-123-4567');
      
      // Fill in carrier information
      cy.get('input[name="carrierName"]').type('Test Logistics');
      cy.get('input[name="mcNumber"]').type('MC-123456');
      
      // Submit booking
      cy.get('button[type="submit"]').contains('Book Appointment').click();
      
      // Verify success
      cy.contains('Booking Confirmed').should('be.visible');
      cy.get('[data-testid="confirmation-number"]').should('be.visible');
    });
  });

  describe('Internal Appointment Management Tests', () => {
    it('should create appointment from internal form', () => {
      // Navigate to appointments page
      cy.visit('/appointments');
      
      // Open new appointment dialog
      cy.get('[data-testid="new-appointment-btn"]').click();
      
      // Fill appointment form
      cy.get('[data-testid="facility-select"]').select('Test Facility');
      cy.get('[data-testid="appointment-type-select"]').select('1 Hour Trailer Appointment');
      cy.get('[data-testid="date-input"]').type(TEST_DATE);
      
      // CRITICAL: Verify appointment times load in internal form
      cy.get('[data-testid="time-select"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="time-select"]').select('09:00');
      
      // Fill remaining fields
      cy.get('input[name="contactName"]').type('Internal Booking');
      cy.get('input[name="contactEmail"]').type('internal@example.com');
      
      // Submit
      cy.get('button[type="submit"]').click();
      
      // Verify creation
      cy.contains('Appointment created successfully').should('be.visible');
    });

    it('should display existing appointments correctly', () => {
      cy.visit('/appointments');
      
      // Wait for appointments to load
      cy.get('[data-testid="appointments-table"]', { timeout: 10000 }).should('be.visible');
      
      // Verify appointment data displays
      cy.get('[data-testid="appointment-row"]').should('exist');
    });
  });

  describe('API Integration Tests', () => {
    it('should handle facility-appointment type mismatches', () => {
      // Test the exact error we fixed: appointment type belongs to different facility
      cy.request({
        method: 'GET',
        url: `/api/availability?facilityId=${TEST_FACILITY_ID}&appointmentTypeId=${TEST_APPOINTMENT_TYPE_ID}&date=${TEST_DATE}`,
        failOnStatusCode: false
      }).then((response) => {
        // Should not return 500 error anymore
        expect(response.status).to.not.equal(500);
        
        if (response.status === 200) {
          expect(response.body).to.have.property('timeSlots');
          expect(response.body.timeSlots).to.be.an('array');
        } else {
          // If error, should be proper 400 with meaningful message
          expect(response.status).to.equal(400);
          expect(response.body).to.have.property('error');
        }
      });
    });

    it('should validate tenant isolation', () => {
      // Test that appointment types can't be accessed across tenants improperly
      const DIFFERENT_TENANT_APPOINTMENT_TYPE = 999;
      
      cy.request({
        method: 'GET',
        url: `/api/availability?facilityId=${TEST_FACILITY_ID}&appointmentTypeId=${DIFFERENT_TENANT_APPOINTMENT_TYPE}&date=${TEST_DATE}`,
        failOnStatusCode: false
      }).then((response) => {
        // Should return proper error, not crash
        expect([400, 404]).to.include(response.status);
        expect(response.body).to.have.property('error');
      });
    });
  });

  describe('Error Recovery Tests', () => {
    it('should recover from database connection issues', () => {
      // Simulate temporary database issues
      cy.intercept('GET', '/api/facilities', { 
        statusCode: 503, 
        body: { error: 'Database temporarily unavailable' },
        delay: 1000 
      }).as('dbError');
      
      cy.intercept('GET', '/api/facilities', { 
        statusCode: 200, 
        body: [{ id: 4, name: 'Test Facility', timezone: 'America/New_York' }]
      }).as('dbRecovery');
      
      cy.visit(`/book/${TEST_BOOKING_PAGE_SLUG}`);
      
      // Should show loading state, then error, then recovery
      cy.contains('Loading facilities').should('be.visible');
      cy.wait('@dbError');
      cy.contains('Unable to load facilities').should('be.visible');
      
      // Click retry
      cy.get('[data-testid="retry-btn"]').click();
      cy.wait('@dbRecovery');
      
      // Should now show facilities
      cy.get('[data-testid="facility-select"]').should('be.visible');
    });
  });
}); 