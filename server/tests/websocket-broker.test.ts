import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { eventSystem } from '../services/enhanced-event-system.js';
import { EnhancedSchedule } from '../notifications.js';

// Mock the WebSocket broadcast functionality
vi.mock('../websocket', () => ({
  broadcastToTenant: vi.fn(),
  broadcastScheduleUpdate: vi.fn(),
}));

// Mock the notification queue
vi.mock('../services/notification-queue', () => ({
  queueWebSocketNotification: vi.fn(),
  queueEmailNotification: vi.fn(),
  createAndQueueNotification: vi.fn(),
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock storage
vi.mock('../storage', () => ({
  getStorage: vi.fn(() => ({
    createNotification: vi.fn(),
  })),
}));

describe('WebSocket Broker - Real-time Appointment Notifications', () => {
  let mockBroadcastToTenant: any;
  let mockQueueWebSocketNotification: any;
  let mockCreateAndQueueNotification: any;

  // Helper function to create base EnhancedSchedule object
  const createMockSchedule = (overrides: Partial<EnhancedSchedule> = {}): EnhancedSchedule => ({
    id: 123,
    customerName: 'Test Customer',
    truckNumber: 'TR-001',
    startTime: new Date('2024-01-15T10:00:00Z'),
    endTime: new Date('2024-01-15T11:00:00Z'),
    status: 'scheduled',
    type: 'inbound',
    facilityId: 1,
    appointmentTypeId: 1,
    createdBy: 1,
    createdAt: new Date(),
    facilityName: 'Test Facility',
    appointmentTypeName: 'Standard Appointment',
    timezone: 'America/New_York',
    confirmationCode: 'ABC123',
    // Required fields for EnhancedSchedule
    dockId: null,
    carrierId: null,
    trailerNumber: null,
    driverName: null,
    driverPhone: null,
    driverEmail: null,
    carrierName: null,
    mcNumber: null,
    bolNumber: null,
    poNumber: null,
    palletCount: null,
    weight: null,
    appointmentMode: null,
    actualStartTime: null,
    actualEndTime: null,
    notes: null,
    customFormData: null,
    lastModifiedAt: null,
    lastModifiedBy: null,
    ...overrides,
  });

  beforeEach(async () => {
    // Get the mocked functions
    mockBroadcastToTenant = vi.mocked(await import('../websocket')).broadcastToTenant;
    mockQueueWebSocketNotification = vi.mocked(await import('../services/notification-queue')).queueWebSocketNotification;
    mockCreateAndQueueNotification = vi.mocked(await import('../services/notification-queue')).createAndQueueNotification;
    
    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up event listeners
    eventSystem.removeAllListeners();
  });

  describe('appointment:created event broadcasting', () => {
    it('should emit appointment:created event with correct payload', async () => {
      const mockSchedule = createMockSchedule();

      const tenantId = 1;
      let eventData: any = null;

      // Set up event listener to capture the emitted event
      eventSystem.on('appointment:created', (data) => {
        eventData = data;
      });

      // Emit the event
      eventSystem.emit('appointment:created', { 
        schedule: mockSchedule, 
        tenantId 
      });

      // Verify the event was emitted with correct data
      expect(eventData).toEqual({
        schedule: mockSchedule,
        tenantId,
      });
    });

    it('should queue WebSocket notification for appointment:created event', async () => {
      const mockSchedule = createMockSchedule({
        id: 124,
        customerName: 'Another Customer',
        truckNumber: 'TR-002',
        startTime: new Date('2024-01-15T14:00:00Z'),
        endTime: new Date('2024-01-15T15:00:00Z'),
        confirmationCode: 'XYZ789',
      });

      const tenantId = 2;

      // Emit the event
      eventSystem.emit('appointment:created', { 
        schedule: mockSchedule, 
        tenantId 
      });

      // Wait for auto-patterns to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify WebSocket notification was queued
      expect(mockQueueWebSocketNotification).toHaveBeenCalledWith(
        tenantId,
        'appointment:created',
        expect.objectContaining({
          schedule: mockSchedule,
          tenantId,
        }),
        'normal'
      );
    });

    it('should create notification for appointment:created event', async () => {
      const mockSchedule: EnhancedSchedule = {
        id: 125,
        customerName: 'Third Customer',
        truckNumber: 'TR-003',
        startTime: new Date('2024-01-15T16:00:00Z'),
        endTime: new Date('2024-01-15T17:00:00Z'),
        status: 'scheduled',
        type: 'outbound',
        facilityId: 1,
        appointmentTypeId: 1,
        createdBy: 1,
        createdAt: new Date(),
        facilityName: 'Test Facility',
        appointmentTypeName: 'Standard Appointment',
        timezone: 'America/New_York',
        confirmationCode: 'DEF456',
        organizationId: 3,
      } as any;

      const tenantId = 3;

      // Emit the event
      eventSystem.emit('appointment:created', { 
        schedule: mockSchedule, 
        tenantId 
      });

      // Wait for auto-patterns to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify notification was created
      expect(mockCreateAndQueueNotification).toHaveBeenCalledWith(
        tenantId,
        expect.any(Number), // userId
        'New Appointment Created',
        expect.stringContaining('Third Customer'),
        'appointment_created',
        'info',
        125,
        expect.any(Object)
      );
    });
  });

  describe('appointment:confirmed event broadcasting', () => {
    it('should emit appointment:confirmed event with confirmation code', async () => {
      const mockSchedule: EnhancedSchedule = {
        id: 126,
        customerName: 'Confirmed Customer',
        truckNumber: 'TR-004',
        startTime: new Date('2024-01-15T18:00:00Z'),
        endTime: new Date('2024-01-15T19:00:00Z'),
        status: 'scheduled',
        type: 'inbound',
        facilityId: 1,
        appointmentTypeId: 1,
        createdBy: 1,
        createdAt: new Date(),
        facilityName: 'Test Facility',
        appointmentTypeName: 'Standard Appointment',
        timezone: 'America/New_York',
        confirmationCode: 'CONF123',
        organizationId: 4,
      } as any;

      const tenantId = 4;
      const confirmationCode = 'CONF123';
      let eventData: any = null;

      // Set up event listener to capture the emitted event
      eventSystem.on('appointment:confirmed', (data) => {
        eventData = data;
      });

      // Emit the event
      eventSystem.emit('appointment:confirmed', { 
        schedule: mockSchedule, 
        confirmationCode,
        tenantId 
      });

      // Verify the event was emitted with correct data
      expect(eventData).toEqual({
        schedule: mockSchedule,
        confirmationCode,
        tenantId,
      });
    });
  });

  describe('error handling', () => {
    it('should handle WebSocket notification queue errors gracefully', async () => {
      const mockSchedule: EnhancedSchedule = {
        id: 127,
        customerName: 'Error Test Customer',
        truckNumber: 'TR-005',
        startTime: new Date('2024-01-15T20:00:00Z'),
        endTime: new Date('2024-01-15T21:00:00Z'),
        status: 'scheduled',
        type: 'inbound',
        facilityId: 1,
        appointmentTypeId: 1,
        createdBy: 1,
        createdAt: new Date(),
        facilityName: 'Test Facility',
        appointmentTypeName: 'Standard Appointment',
        timezone: 'America/New_York',
        confirmationCode: 'ERR123',
        organizationId: 5,
      } as any;

      // Mock WebSocket notification to throw an error
      mockQueueWebSocketNotification.mockRejectedValueOnce(new Error('WebSocket queue error'));

      // Emit the event - should not throw
      expect(() => {
        eventSystem.emit('appointment:created', { 
          schedule: mockSchedule, 
          tenantId: 5 
        });
      }).not.toThrow();

      // Wait for auto-patterns to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify the error was handled gracefully
      expect(mockQueueWebSocketNotification).toHaveBeenCalled();
    });
  });

  describe('tenant isolation', () => {
    it('should emit events with correct tenant context', async () => {
      const tenant1Schedule: EnhancedSchedule = {
        id: 128,
        customerName: 'Tenant 1 Customer',
        truckNumber: 'T1-001',
        startTime: new Date('2024-01-15T22:00:00Z'),
        endTime: new Date('2024-01-15T23:00:00Z'),
        status: 'scheduled',
        type: 'inbound',
        facilityId: 1,
        appointmentTypeId: 1,
        createdBy: 1,
        createdAt: new Date(),
        facilityName: 'Tenant 1 Facility',
        appointmentTypeName: 'Standard Appointment',
        timezone: 'America/New_York',
        confirmationCode: 'T1-123',
        organizationId: 1,
      } as any;

      const tenant2Schedule: EnhancedSchedule = {
        id: 129,
        customerName: 'Tenant 2 Customer',
        truckNumber: 'T2-001',
        startTime: new Date('2024-01-15T23:00:00Z'),
        endTime: new Date('2024-01-16T00:00:00Z'),
        status: 'scheduled',
        type: 'inbound',
        facilityId: 2,
        appointmentTypeId: 2,
        createdBy: 2,
        createdAt: new Date(),
        facilityName: 'Tenant 2 Facility',
        appointmentTypeName: 'Standard Appointment',
        timezone: 'America/New_York',
        confirmationCode: 'T2-123',
        organizationId: 2,
      } as any;

      // Emit events for different tenants
      eventSystem.emit('appointment:created', { 
        schedule: tenant1Schedule, 
        tenantId: 1 
      });
      
      eventSystem.emit('appointment:created', { 
        schedule: tenant2Schedule, 
        tenantId: 2 
      });

      // Wait for auto-patterns to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify each tenant's events were queued correctly
      expect(mockQueueWebSocketNotification).toHaveBeenCalledWith(
        1,
        'appointment:created',
        expect.objectContaining({
          schedule: tenant1Schedule,
          tenantId: 1,
        }),
        'normal'
      );

      expect(mockQueueWebSocketNotification).toHaveBeenCalledWith(
        2,
        'appointment:created',
        expect.objectContaining({
          schedule: tenant2Schedule,
          tenantId: 2,
        }),
        'normal'
      );
    });
  });
}); 