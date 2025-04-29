// This file is processed and loaded automatically before your test files
// Add custom commands here

// Augment the Cypress namespace to include custom commands
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Login with username and password via the API
       * @example cy.login('admin@example.com', 'password')
       */
      login(username: string, password: string): Chainable<void>;
    }
  }
}

// Login command that authenticates via the API
Cypress.Commands.add('login', (username, password) => {
  cy.request({
    method: 'POST',
    url: '/api/login',
    body: { username, password }
  });
  
  // This ensures cookies are set properly
  cy.visit('/');
});

export {};