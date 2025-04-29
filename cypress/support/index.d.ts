// Type definitions for Cypress

declare namespace Cypress {
  interface Chainable {
    /**
     * Custom command to log in a user
     * @example cy.login('user@example.com', 'password')
     */
    login(email: string, password: string): Chainable<void>;

    /**
     * Custom command to toggle a module's status in the admin panel
     * @example cy.toggleModule('calendar')
     */
    toggleModule(moduleName: string): Chainable<void>;
    
    /**
     * Custom command to navigate to an organization's detail page
     * @example cy.visitOrgDetail(2)
     */
    visitOrgDetail(orgId: number): Chainable<void>;
  }
}