describe('Organization Module Toggles', () => {
  before(() => {
    // programmatically log in as tenant-admin
    cy.request('POST', '/api/login', { username: 'admin@example.com', password: 'password' })
      .then((response) => {
        // Store the session cookie that's set after login
        // This works with our session-based auth rather than tokens
      });
  });

  it('hides Calendar when disabled', () => {
    // Disable calendar module via API
    cy.request({
      method: 'PUT',
      url: '/api/admin/orgs/2/modules',
      body: { moduleName: 'calendar', enabled: false }
    });
    
    cy.visit('/calendar');
    cy.contains('Not Authorized').should('be.visible');

    // Re-enable for cleanup
    cy.request({
      method: 'PUT',
      url: '/api/admin/orgs/2/modules',
      body: { moduleName: 'calendar', enabled: true }
    });
  });

  it('shows Calendar when enabled', () => {
    cy.visit('/calendar');
    cy.get('.fc-dayGridMonth-button').should('exist');
  });
  
  it('hides Asset Manager when disabled', () => {
    // Disable asset manager module via API
    cy.request({
      method: 'PUT',
      url: '/api/admin/orgs/2/modules',
      body: { moduleName: 'assetManager', enabled: false }
    });
    
    cy.visit('/assets');
    cy.contains('Not Authorized').should('be.visible');

    // Re-enable for cleanup
    cy.request({
      method: 'PUT',
      url: '/api/admin/orgs/2/modules',
      body: { moduleName: 'assetManager', enabled: true }
    });
  });

  it('shows Asset Manager when enabled', () => {
    cy.visit('/assets');
    cy.contains('Assets').should('be.visible');
    cy.contains('Add Asset').should('be.visible');
  });
  
  it('has module toggle UI in admin panel', () => {
    cy.visit('/admin/orgs/2');
    cy.contains('Modules').click();
    
    // Test module toggle UI
    cy.get('[data-module="calendar"]').within(() => {
      cy.get('input[type="checkbox"]').should('exist');
    });
    
    cy.get('[data-module="assetManager"]').within(() => {
      cy.get('input[type="checkbox"]').should('exist');
    });
  });
});