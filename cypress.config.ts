import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      // Enable debugging-focused event listeners
      on('task', {
        log(message) {
          console.log('🧪 Cypress Task Log:', message);
          return null;
        },
        table(message) {
          console.table(message);
          return null;
        }
      });
      
      // Add screenshot capture on test failures
      on('after:screenshot', (details) => {
        console.log('📸 Screenshot captured:', details.path);
      });
      
      // Add debugging configuration
      if (config.env && config.env.DEBUG_MODE) {
        console.log('🧪 Cypress Debug Mode Enabled');
      }
      
      return config;
    },
    baseUrl: 'http://localhost:5000',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.{js,jsx,ts,tsx}',
    
    // Debugging-optimized settings
    video: true, // Enable video for debugging failed tests
    screenshotOnRunFailure: true,
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
    
    // Slower timeouts for debugging sessions
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000, // Increased for debugging
    requestTimeout: 15000, // Increased for slow APIs
    responseTimeout: 15000,
    pageLoadTimeout: 30000, // Increased for debugging
    
    // Retry configuration for debugging
    retries: {
      runMode: 2,
      openMode: 0 // No retries in open mode for debugging
    },
    
    // Environment variables for debugging
    env: {
      // API configuration
      apiUrl: '/api',
      requestTimeout: 15000,
      
      // Test data configuration
      testFacilityId: 4,
      testAppointmentTypeId: 7,
      testOrgId: 2,
      testBookingSlug: 'test-facility',
      
      // Debugging flags
      DEBUG_MODE: false, // Set to true for verbose logging
      ENABLE_BREAKPOINTS: true,
      SLOW_MODE: false, // Set to true to add delays between actions
      
      // Authentication
      testAdminUsername: 'testadmin',
      testAdminPassword: 'password123',
      
      // Feature flags for testing
      ENABLE_CONSOLE_LOGGING: true,
      ENABLE_API_LOGGING: true,
      ENABLE_SCREENSHOT_ON_FAILURE: true
    },
    
    // Exclude certain files from testing in CI
    excludeSpecPattern: [
      'cypress/e2e/debugging-breakpoints.spec.ts' // Exclude debugging tests from CI
    ],
    
    // Test isolation settings
    testIsolation: true,
    
    // Browser configuration for debugging
    chromeWebSecurity: false, // Disable for easier debugging
    
    // Experimental features for better debugging
    experimentalStudio: true // Enable Cypress Studio for test recording
  },
  
  // Component testing configuration (if needed)
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
    supportFile: 'cypress/support/component.ts',
    specPattern: 'cypress/component/**/*.{js,jsx,ts,tsx}',
    
    // Component-specific debugging settings
    viewportWidth: 1000,
    viewportHeight: 660,
    video: false, // Usually not needed for component tests
    
    env: {
      // Component-specific environment variables
      COMPONENT_DEBUG_MODE: false
    }
  },
});