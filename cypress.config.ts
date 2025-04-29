import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
      // or load plugins that require event listeners
    },
    baseUrl: 'http://localhost:5000',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.{js,jsx,ts,tsx}',
    video: false, // Disable video recording to save resources
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 5000,
    // Environment variables specific to tests
    env: {
      // API timeout increased for slower test environments
      apiUrl: '/api',
      requestTimeout: 10000,
    },
  },
  
  // Configure component tests if needed
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
    supportFile: 'cypress/support/component.ts',
    specPattern: 'cypress/component/**/*.{js,jsx,ts,tsx}',
  },
});