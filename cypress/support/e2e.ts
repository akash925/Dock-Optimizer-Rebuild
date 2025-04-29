// ***********************************************************
// This support file loads automatically before your test files
// ***********************************************************

// Import custom commands
import './commands'

// Custom commands can be added here to be used across tests
// For example:
// Cypress.Commands.add('login', (email, password) => { ... })

// Make custom commands available in TypeScript
// If this file is treated as a module (has imports/exports), move this declaration to a separate d.ts file
// Example: cypress/support/index.d.ts
/*
declare namespace Cypress {
  interface Chainable {
    // login(email: string, password: string): Chainable<void>
    // Add other custom commands here
  }
}
*/

// Configure Cypress behavior
Cypress.on('uncaught:exception', (err) => {
  // Returning false here prevents Cypress from failing the test due to uncaught exceptions
  // Useful when testing apps that might have errors in third-party code
  return false;
});

// Set up global test state if needed
before(() => {
  // Code that runs once before all tests
});

// Clean up after tests
after(() => {
  // Code that runs once after all tests
});

// Make sure each test starts with a clean state
beforeEach(() => {
  // Clear cookies and local storage between tests
  cy.clearAllCookies();
  cy.clearAllLocalStorage();
  cy.clearAllSessionStorage();
});