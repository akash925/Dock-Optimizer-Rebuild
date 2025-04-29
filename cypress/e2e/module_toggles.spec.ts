/**
 * Dock Optimizer Module Toggles E2E Test
 * 
 * These tests verify that module functionality is properly toggled
 * based on feature flags and organization settings.
 */

describe('Module Toggle Tests', () => {
  beforeEach(() => {
    // Mock the authentication - in a real test we'd log in first
    cy.intercept('GET', '/api/user', { fixture: 'admin-user.json' }).as('getUser');
    
    // Mock the organizations request
    cy.intercept('GET', '/api/admin/organizations', { fixture: 'organizations-list.json' }).as('getOrgs');
    
    // Visit the admin page
    cy.visit('/admin/organizations');
    cy.wait('@getUser');
    cy.wait('@getOrgs');
  });

  it('should display organization module settings', () => {
    // Click on first org in the list to view details
    cy.get('table tbody tr').first().click();
    
    // Wait for organization detail to load
    cy.intercept('GET', '/api/admin/organizations/*', { fixture: 'organization-detail.json' }).as('getOrgDetail');
    cy.wait('@getOrgDetail');
    
    // Navigate to the modules tab
    cy.contains('button', 'Modules').click();
    
    // Verify that module toggles are displayed
    cy.get('[data-test="module-toggle"]').should('exist');
    cy.contains('Asset Manager').should('exist');
    cy.contains('Calendar').should('exist');
    cy.contains('Analytics').should('exist');
  });

  it('should toggle module state when switch is clicked', () => {
    // Click on first org in the list to view details
    cy.get('table tbody tr').first().click();
    
    // Wait for organization detail to load
    cy.intercept('GET', '/api/admin/organizations/*', { fixture: 'organization-detail.json' }).as('getOrgDetail');
    cy.wait('@getOrgDetail');
    
    // Navigate to the modules tab
    cy.contains('button', 'Modules').click();
    
    // Intercept the update request
    cy.intercept('PATCH', '/api/admin/organizations/*/modules', {
      statusCode: 200,
      body: { success: true }
    }).as('updateModule');
    
    // Toggle a module (e.g., Asset Manager)
    cy.contains('div', 'Asset Manager')
      .find('button[role="switch"]')
      .click();
    
    // Verify that the update request was made
    cy.wait('@updateModule');
    
    // Verify that the UI reflects the change
    cy.contains('div', 'Asset Manager')
      .find('button[role="switch"][data-state="checked"]')
      .should('exist');
  });

  it('should show access denied when navigating to disabled module', () => {
    // Mock a user with a disabled module
    cy.intercept('GET', '/api/user', { 
      fixture: 'limited-user.json' 
    }).as('getLimitedUser');
    
    // Mock feature flags check
    cy.intercept('GET', '/api/feature-flags', {
      assetManager: false,
      calendar: true,
      analytics: true
    }).as('getFeatureFlags');
    
    // Visit the asset manager page
    cy.visit('/assets');
    cy.wait('@getLimitedUser');
    cy.wait('@getFeatureFlags');
    
    // Should show access denied message
    cy.contains('Module Access Restricted').should('exist');
    cy.contains('You do not have access to the Asset Manager module.').should('exist');
  });
});