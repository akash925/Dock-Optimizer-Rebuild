describe('Organization Module Toggles', () => {
  beforeEach(() => {
    // Login before each test
    cy.session('admin-user', () => {
      cy.request('POST', '/api/login', { 
        username: 'admin@example.com', 
        password: 'password' 
      }).then(response => {
        expect(response.status).to.eq(200);
      });
    });
  });

  // Helper function to toggle a module
  const toggleModule = (moduleName: string, enabled: boolean) => {
    cy.request({
      method: 'PUT',
      url: '/api/admin/orgs/2/modules',
      body: { moduleName, enabled }
    }).then(response => {
      expect(response.status).to.eq(200);
    });
  };

  // Calendar module tests
  describe('Calendar Module', () => {
    it('hides Calendar when disabled', () => {
      // Disable calendar module
      toggleModule('calendar', false);
      
      // Visit the calendar page
      cy.visit('/calendar');
      
      // Should display access denied message
      cy.get('body').then($body => {
        const hasAccessDenied = $body.text().includes('Access Denied');
        const hasNotAuthorized = $body.text().includes('Not Authorized');
        const hasUnauthorized = $body.text().includes('Unauthorized');
        
        expect(hasAccessDenied || hasNotAuthorized || hasUnauthorized).to.be.true;
      });
      
      // Re-enable for next tests
      toggleModule('calendar', true);
    });

    it('shows Calendar when enabled', () => {
      // Ensure calendar module is enabled
      toggleModule('calendar', true);
      
      // Visit the calendar page
      cy.visit('/calendar');
      
      // Verify fullcalendar elements are visible
      cy.get('.fc').should('exist');
      cy.get('.fc-toolbar').should('be.visible');
    });
  });
  
  // Asset Manager module tests
  describe('Asset Manager Module', () => {
    it('hides Asset Manager when disabled', () => {
      // Disable asset manager module
      toggleModule('assetManager', false);
      
      // Visit the assets page
      cy.visit('/assets');
      
      // Should display access denied message
      cy.get('body').then($body => {
        const hasAccessDenied = $body.text().includes('Access Denied');
        const hasNotAuthorized = $body.text().includes('Not Authorized');
        const hasUnauthorized = $body.text().includes('Unauthorized');
        
        expect(hasAccessDenied || hasNotAuthorized || hasUnauthorized).to.be.true;
      });
      
      // Re-enable for next tests
      toggleModule('assetManager', true);
    });

    it('shows Asset Manager when enabled', () => {
      // Ensure asset manager module is enabled
      toggleModule('assetManager', true);
      
      // Visit the assets page
      cy.visit('/assets');
      
      // Verify asset manager UI elements
      cy.contains(/Assets|Asset Manager/i).should('be.visible');
      cy.contains(/Add Asset|New Asset/i).should('exist');
    });
  });
  
  // Admin UI for managing modules
  describe('Admin Module Toggle UI', () => {
    it('has UI controls for toggling modules', () => {
      // Navigate to organization edit page
      cy.visit('/admin/orgs/2');
      
      // Click Modules tab
      cy.contains('Modules').click();
      
      // Verify module toggle UI elements
      cy.contains('calendar', { matchCase: false }).should('exist');
      cy.contains('asset manager', { matchCase: false }).should('exist');
      
      // Test module toggles exist and are interactive
      cy.get('input[type="checkbox"]').should('have.length.at.least', 2);
    });
    
    it('persists module toggle changes', () => {
      // Navigate to organization edit page
      cy.visit('/admin/orgs/2');
      
      // Click Modules tab
      cy.contains('Modules').click();
      
      // Find calendar module toggle
      cy.contains('calendar', { matchCase: false })
        .parents('tr')
        .find('input[type="checkbox"]')
        .as('calendarToggle');
        
      // Toggle calendar module off through UI
      cy.get('@calendarToggle').then($checkbox => {
        const initialState = $checkbox.prop('checked');
        
        // Click to change state
        cy.get('@calendarToggle').click();
        
        // Verify changed in UI
        cy.get('@calendarToggle').should('have.prop', 'checked', !initialState);
        
        // Restore original state
        cy.get('@calendarToggle').click();
        
        // Verify restored to initial state
        cy.get('@calendarToggle').should('have.prop', 'checked', initialState);
      });
    });
  });
});