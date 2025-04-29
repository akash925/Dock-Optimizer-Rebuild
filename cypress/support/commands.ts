// Custom Cypress commands

// Login command
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/auth');
  cy.get('input[name="username"]').type(email);
  cy.get('input[name="password"]').type(password);
  cy.get('button[type="submit"]').click();
  
  // Wait for login to complete
  cy.url().should('not.include', '/auth');
});

// Toggle module command
Cypress.Commands.add('toggleModule', (moduleName: string) => {
  // Navigate to the Modules tab
  cy.contains('button', 'Modules').click();
  
  // Find the module by name and toggle it
  cy.contains(moduleName, { matchCase: false })
    .parent()
    .within(() => {
      cy.get('button[role="switch"]').click();
    });
  
  // Wait for the API call to complete
  cy.wait('@toggleModule');
});

// Visit organization detail page
Cypress.Commands.add('visitOrgDetail', (orgId: number) => {
  cy.visit(`/admin/orgs/${orgId}`);
  
  // Wait for the organization data to load
  cy.contains('h1', /organization details/i, { timeout: 10000 }).should('be.visible');
});