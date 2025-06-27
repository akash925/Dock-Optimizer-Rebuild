// Custom commands for calendar and notification testing

declare global {
  namespace Cypress {
    interface Chainable {
      loginAndSetupTenant(user: { username: string; password: string }, tenantId: number): Chainable<void>;
      loginAsTenant(tenantId: number): Chainable<void>;
      waitForCalendarLoad(): Chainable<void>;
      createTestAppointment(options: {
        tenantId?: number;
        status?: string;
        startTime?: Date;
        endTime?: Date;
        truckNumber?: string;
        customerName?: string;
        driverEmail?: string;
      }): Chainable<any>;
      createTestUnscheduledAppointment(options: {
        title: string;
        customer: string;
        priority: string;
      }): Chainable<any>;
      createTestAppointmentViaAPI(options: any): Chainable<any>;
      createTestNotifications(notifications: Array<{
        title: string;
        type?: string;
        urgency?: string;
        isRead?: boolean;
        createdAt?: Date;
      }>): Chainable<void>;
      createLargeTestDataset(count: number): Chainable<void>;
      updateAppointmentStatus(appointmentId: number, status: string): Chainable<void>;
      confirmAppointment(appointmentId: number): Chainable<void>;
      cleanupTestData(tenantId: number): Chainable<void>;
    }
  }
}

// Setup API request interceptors
Cypress.Commands.add('loginAndSetupTenant', (user, tenantId) => {
  // Setup common API interceptors
  cy.intercept('PUT', '/api/schedules/*', { statusCode: 200 }).as('updateAppointment');
  cy.intercept('POST', '/api/schedules/*/schedule', { statusCode: 200 }).as('scheduleAppointment');
  cy.intercept('PUT', '/api/notifications/mark-read', { statusCode: 200 }).as('markNotificationsAsRead');
  cy.intercept('GET', '/api/schedules*', { fixture: 'schedules.json' }).as('getSchedules');
  cy.intercept('GET', '/api/notifications*', { fixture: 'notifications.json' }).as('getNotifications');

  // Login
  cy.visit('/login');
  cy.get('[name="username"]').type(user.username);
  cy.get('[name="password"]').type(user.password);
  cy.get('[data-testid="login-button"]').click();
  
  // Wait for authentication
  cy.url().should('not.include', '/login');
  cy.window().its('localStorage').should('have.property', 'authToken');
});

Cypress.Commands.add('loginAsTenant', (tenantId) => {
  cy.window().then((win) => {
    win.localStorage.setItem('currentTenantId', tenantId.toString());
  });
  cy.reload();
});

Cypress.Commands.add('waitForCalendarLoad', () => {
  // Wait for calendar to be fully loaded
  cy.get('[data-testid="calendar-container"]', { timeout: 10000 }).should('be.visible');
  cy.get('.fc-view-harness', { timeout: 5000 }).should('be.visible');
  
  // Wait for WebSocket connection
  cy.get('[data-testid="websocket-status"]', { timeout: 5000 })
    .should('be.visible')
    .and('not.contain', 'Connecting');
});

Cypress.Commands.add('createTestAppointment', (options = {}) => {
  const appointment = {
    id: Math.floor(Math.random() * 10000),
    tenantId: options.tenantId || 1,
    status: options.status || 'scheduled',
    startTime: options.startTime || new Date(Date.now() + 3600000),
    endTime: options.endTime || new Date(Date.now() + 7200000),
    truckNumber: options.truckNumber || `TEST-${Math.floor(Math.random() * 1000)}`,
    customerName: options.customerName || 'Test Customer',
    driverEmail: options.driverEmail || 'driver@test.com',
    createdAt: new Date(),
    facilityId: 1,
    appointmentTypeId: 1,
    type: 'inbound',
    createdBy: 1
  };

  // Mock the appointment in the API response
  cy.intercept('GET', '/api/schedules*', (req) => {
    req.reply((res) => {
      if (res.body && Array.isArray(res.body)) {
        res.body.push(appointment);
      } else {
        res.body = [appointment];
      }
      return res;
    });
  }).as('getSchedulesWithAppointment');

  cy.wrap(appointment);
});

Cypress.Commands.add('createTestUnscheduledAppointment', (options) => {
  const appointment = {
    id: Math.floor(Math.random() * 10000),
    title: options.title,
    customer: options.customer,
    priority: options.priority,
    duration: 60,
    appointmentType: 'Standard',
    metadata: {}
  };

  // Mock the unscheduled appointment
  cy.intercept('GET', '/api/schedules/unscheduled', (req) => {
    req.reply([appointment]);
  }).as('getUnscheduledAppointments');

  cy.wrap(appointment);
});

Cypress.Commands.add('createTestAppointmentViaAPI', (options) => {
  return cy.request({
    method: 'POST',
    url: '/api/schedules',
    body: {
      tenantId: options.tenantId || 1,
      truckNumber: options.truckNumber || 'API-TEST',
      startTime: options.startTime || new Date(Date.now() + 3600000),
      endTime: options.endTime || new Date(Date.now() + 7200000),
      status: 'scheduled',
      facilityId: 1,
      appointmentTypeId: 1,
      type: 'inbound',
      createdBy: 1
    }
  });
});

Cypress.Commands.add('createTestNotifications', (notifications) => {
  const mockNotifications = notifications.map((notif, index) => ({
    id: index + 1,
    userId: 1,
    title: notif.title,
    message: `Test message for ${notif.title}`,
    type: notif.type || 'system',
    urgency: notif.urgency || 'normal',
    isRead: notif.isRead || false,
    createdAt: notif.createdAt || new Date(),
    relatedScheduleId: null,
    metadata: {}
  }));

  cy.intercept('GET', '/api/notifications*', mockNotifications).as('getTestNotifications');
});

Cypress.Commands.add('createLargeTestDataset', (count) => {
  const appointments = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    appointments.push({
      id: i + 1,
      tenantId: 1,
      truckNumber: `BULK-${i.toString().padStart(3, '0')}`,
      customerName: `Customer ${i}`,
      startTime: new Date(now.getTime() + (i * 3600000)), // Spread over hours
      endTime: new Date(now.getTime() + (i * 3600000) + 1800000), // 30 min duration
      status: ['scheduled', 'confirmed', 'checked-in'][i % 3],
      facilityId: 1,
      appointmentTypeId: 1,
      type: i % 2 === 0 ? 'inbound' : 'outbound',
      createdBy: 1,
      createdAt: new Date()
    });
  }

  cy.intercept('GET', '/api/schedules*', appointments).as('getLargeDataset');
});

Cypress.Commands.add('updateAppointmentStatus', (appointmentId, status) => {
  cy.request({
    method: 'PUT',
    url: `/api/schedules/${appointmentId}`,
    body: { status }
  });

  // Trigger WebSocket update simulation
  cy.window().then((win) => {
    if (win.notificationSocket) {
      const mockMessage = {
        type: 'schedule_update',
        data: {
          id: appointmentId,
          status,
          timestamp: new Date().toISOString()
        }
      };
      
      const event = new MessageEvent('message', {
        data: JSON.stringify(mockMessage)
      });
      
      win.notificationSocket.dispatchEvent(event);
    }
  });
});

Cypress.Commands.add('confirmAppointment', (appointmentId) => {
  cy.request({
    method: 'POST',
    url: `/api/schedules/${appointmentId}/confirm`,
    body: { confirmationCode: `CONF-${appointmentId}` }
  });
});

Cypress.Commands.add('cleanupTestData', (tenantId) => {
  // Clean up test data after each test
  cy.request({
    method: 'DELETE',
    url: `/api/test/cleanup/${tenantId}`,
    failOnStatusCode: false
  });
  
  // Clear any cached data
  cy.window().then((win) => {
    if (win.queryClient) {
      win.queryClient.clear();
    }
  });
});

// Global setup for calendar tests
beforeEach(() => {
  // Set up default fixtures
  cy.fixture('schedules.json').as('schedulesData');
  cy.fixture('notifications.json').as('notificationsData');
  cy.fixture('facilities.json').as('facilitiesData');
  
  // Mock WebSocket connection
  cy.window().then((win) => {
    // Create a mock WebSocket
    win.notificationSocket = {
      readyState: 1, // WebSocket.OPEN
      send: cy.stub(),
      close: cy.stub(),
      addEventListener: cy.stub(),
      removeEventListener: cy.stub(),
      dispatchEvent: function(event) {
        // Simulate event handling
        if (this.onmessage) {
          this.onmessage(event);
        }
      }
    };
  });
});

export {}; 