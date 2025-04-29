describe('Module Toggles', () => {
  beforeEach(() => {
    // Mock admin login
    cy.intercept('POST', '/api/login', { 
      statusCode: 200,
      body: { 
        id: 3, 
        username: 'akash.agarwal@conmitto.io',
        email: 'akash.agarwal@conmitto.io',
        role: 'super-admin'
      }
    }).as('loginRequest');

    // Mock getting organization details
    cy.intercept('GET', '/api/admin/orgs/*/detail', {
      statusCode: 200,
      body: {
        id: 2,
        name: 'Hanzo Logistics',
        modules: [
          { moduleName: 'calendar', enabled: true },
          { moduleName: 'assetManager', enabled: true },
          { moduleName: 'analytics', enabled: true }
        ],
        users: [
          { userId: 1, email: 'admin@example.com', role: 'admin' },
          { userId: 2, email: 'user@example.com', role: 'user' }
        ]
      }
    }).as('getOrgDetail');

    // Mock toggle module API
    cy.intercept('PUT', '/api/admin/orgs/*/modules/*', {
      statusCode: 200,
      body: { success: true }
    }).as('toggleModule');

    // Log in and visit the organization detail page using custom commands
    cy.login('akash.agarwal@conmitto.io', 'password');
    cy.wait('@loginRequest');
    
    cy.visitOrgDetail(2);
    cy.wait('@getOrgDetail');
    
    // Navigate to Modules tab
    cy.contains('button', 'Modules').click();
  });

  it('should display module toggles', () => {
    // Verify the modules section shows correct modules
    cy.contains('h3', 'Modules').should('be.visible');
    cy.contains('Calendar').should('be.visible');
    cy.contains('Asset Manager').should('be.visible');
    cy.contains('Analytics').should('be.visible');
  });

  it('should toggle module status', () => {
    // Toggle the Calendar module
    cy.contains('Calendar')
      .parent()
      .within(() => {
        cy.get('button[role="switch"]').click();
      });
    
    // Verify the API was called
    cy.wait('@toggleModule');
    
    // Mock the updated organization detail
    cy.intercept('GET', '/api/admin/orgs/*/detail', {
      statusCode: 200,
      body: {
        id: 2,
        name: 'Hanzo Logistics',
        modules: [
          { moduleName: 'calendar', enabled: false }, // Calendar now disabled
          { moduleName: 'assetManager', enabled: true },
          { moduleName: 'analytics', enabled: true }
        ],
        users: [
          { userId: 1, email: 'admin@example.com', role: 'admin' },
          { userId: 2, email: 'user@example.com', role: 'user' }
        ]
      }
    }).as('getUpdatedOrgDetail');
    
    // Refresh the page
    cy.visit('/admin/orgs/2');
    cy.wait('@getUpdatedOrgDetail');
    cy.contains('button', 'Modules').click();
    
    // Verify the toggle is now off
    cy.contains('Calendar')
      .parent()
      .within(() => {
        cy.get('button[role="switch"]').should('have.attr', 'data-state', 'unchecked');
      });
  });

  it('should show success notification when toggling module', () => {
    // Mock the toast notification system
    cy.window().then((win) => {
      cy.spy(win.console, 'log').as('consoleLog');
    });
    
    // Toggle a module
    cy.contains('Asset Manager')
      .parent()
      .within(() => {
        cy.get('button[role="switch"]').click();
      });
    
    cy.wait('@toggleModule');
    
    // Verify success notification appears
    cy.contains('Module status updated').should('be.visible');
  });
});