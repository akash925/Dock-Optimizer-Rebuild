import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5000',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    supportFile: false,
    specPattern: 'cypress/e2e/**/*.{js,jsx,ts,tsx}'
  },
})