# Cypress End-to-End Testing for Dock Optimizer

This directory contains comprehensive end-to-end tests for the Dock Optimizer application, with a focus on debugging and issue prevention.

## 🎯 Test Coverage

### Core Functionality Tests
- **`booking-flow.spec.ts`**: Complete booking workflow from external pages to internal management
- **`module_toggles.spec.ts`**: Admin module management and feature flag testing
- **`debugging-breakpoints.spec.ts`**: Debugging-focused tests with strategic breakpoints

### Key Areas Covered
✅ **Booking Page Functionality** - The exact issue we recently fixed with appointment availability  
✅ **API Integration** - Database queries, availability calculations, tenant isolation  
✅ **Error Handling** - Graceful degradation when services fail  
✅ **Admin Panel** - Organization and module management  
✅ **Authentication** - Login flows and session management  

## 🚀 Quick Start

### Running Tests

```bash
# Open Cypress UI for interactive testing
npm run cypress:open

# Run all e2e tests headlessly
npm run e2e

# Run specific test suites
npm run e2e:booking      # Booking flow tests
npm run e2e:modules      # Module toggle tests
npm run e2e:debug        # Open debugging tests in UI mode

# Debug mode with enhanced logging
npm run cypress:debug
```

### Before Running Tests

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Ensure test data exists**:
   - Login as `testadmin` / `password123`
   - Verify organizations and facilities exist
   - Check that booking pages are configured

## 🔍 Debugging Features

### Strategic Breakpoints
The `debugging-breakpoints.spec.ts` file includes:
- **API Response Debugging**: Pause at critical API calls
- **Component State Inspection**: Debug React component states
- **Error Condition Testing**: Simulate and debug error scenarios
- **Performance Monitoring**: Track slow API responses

### Using Breakpoints
1. Open Cypress in debug mode: `npm run e2e:debug`
2. Open browser DevTools (F12)
3. Tests will pause at `debugger;` statements
4. Inspect variables, network requests, and DOM state

### Enhanced Logging
Tests include comprehensive logging:
- 🌐 Network requests and responses
- 📝 Component state changes
- ⚠️ Error conditions and recovery
- ⏱️ Performance metrics

## 🧪 Test Structure

### Test Data Management
- **Fixtures**: Located in `cypress/fixtures/`
  - `admin-user.json`: Test admin user data
  - `organizations-list.json`: Organization test data
  - `organization-detail.json`: Detailed org with modules
  - `limited-user.json`: User with restricted access

### Custom Commands
Located in `cypress/support/commands.ts`:
- `cy.login(email, password)`: Authentication helper
- `cy.toggleModule(moduleName)`: Module management
- `cy.visitOrgDetail(orgId)`: Navigation helper

## 🐛 Debugging Common Issues

### Appointment Availability Issues
**Problem**: "Failed to load appointment times" or empty dropdowns
**Debug Steps**:
1. Run `npm run e2e:debug`
2. Navigate to booking flow test
3. Check API responses at breakpoints
4. Verify facility/appointment type relationships

### Module Access Issues
**Problem**: "Module not available" errors
**Debug Steps**:
1. Run module toggle tests
2. Check organization-module mappings
3. Verify user permissions

### Database Connection Issues
**Problem**: 500 errors on API calls
**Debug Steps**:
1. Run database debugging tests
2. Check console logs for connection errors
3. Verify environment variables

## 🔧 Configuration

### Test Environment Variables
```javascript
// cypress.config.ts env section
env: {
  testFacilityId: 4,
  testAppointmentTypeId: 7,
  testOrgId: 2,
  testBookingSlug: 'test-facility',
  DEBUG_MODE: false, // Set to true for verbose logging
  ENABLE_BREAKPOINTS: true
}
```

### Debugging Settings
- **Slower Timeouts**: Increased for debugging sessions
- **Video Recording**: Enabled for failed test analysis
- **Screenshot Capture**: Automatic on failures
- **Console Logging**: Comprehensive request/response logging

## 📊 Test Reports

### Generated Artifacts
- **Videos**: `cypress/videos/` - Recordings of test runs
- **Screenshots**: `cypress/screenshots/` - Failure screenshots
- **Console Logs**: Detailed logging output

### CI/CD Integration
- Debugging tests are excluded from CI runs
- Production tests focus on critical user flows
- Failure artifacts are automatically captured

## 🎛️ Advanced Debugging

### Network Monitoring
Tests include comprehensive network intercepts:
```javascript
cy.intercept('GET', '/api/availability**').as('getAvailability');
cy.wait('@getAvailability').then((interception) => {
  // Debug API response
  debugger;
});
```

### Component State Inspection
```javascript
cy.get('[data-testid="booking-form"]').then(($form) => {
  // Inspect form state
  debugger;
});
```

### Error Simulation
```javascript
cy.intercept('GET', '/api/facilities', {
  statusCode: 500,
  body: { error: 'Database error' }
});
```

## 🔄 Continuous Improvement

### Adding New Tests
1. Create test file in `cypress/e2e/`
2. Follow existing naming conventions
3. Include debugging breakpoints for complex scenarios
4. Add fixture data if needed
5. Update this README with new test descriptions

### Best Practices
- **Use data-testid attributes** for reliable element selection
- **Include comprehensive error testing** for all user flows
- **Add strategic breakpoints** in complex scenarios
- **Mock external dependencies** appropriately
- **Keep tests isolated** and deterministic

## 🆘 Troubleshooting

### Common Issues
1. **Tests failing randomly**: Check test isolation and cleanup
2. **Slow test execution**: Verify server performance and network
3. **Element not found**: Check for dynamic loading and timing
4. **API mocking issues**: Verify intercept patterns and responses

### Getting Help
1. Check console logs for detailed error information
2. Use debugging breakpoints to inspect state
3. Run tests individually to isolate issues
4. Review video recordings of failed tests

---

**Remember**: These tests are designed to catch issues like the recent booking availability problem. Run them regularly and add new tests for any bugs you encounter in production. 