import { EventEmitter } from 'events';
import { 
  queueEmailNotification, 
  queueWebSocketNotification, 
  createAndQueueNotification 
} from './notification-queue.js.js';
import { broadcastToTenant } from '../websocket.js';
import { logger } from '../utils/logger.js';
import { EnhancedSchedule } from '../notifications.js';

// Define all possible event types for type safety
export interface DockOptimizerEvents {
  // Schedule events
  'schedule:created': { schedule: EnhancedSchedule; tenantId: number };
  'schedule:updated': { schedule: EnhancedSchedule; oldSchedule: EnhancedSchedule; tenantId: number };
  'schedule:deleted': { scheduleId: number; tenantId: number };
  'schedule:status_changed': { schedule: EnhancedSchedule; oldStatus: string; tenantId: number };
  
  // Appointment lifecycle events
  'appointment:created': { schedule: EnhancedSchedule; tenantId: number };
  'appointment:confirmed': { schedule: EnhancedSchedule; confirmationCode: string; tenantId: number };
  'appointment:checked_in': { schedule: EnhancedSchedule; tenantId: number };
  'appointment:checked_out': { schedule: EnhancedSchedule; tenantId: number };
  'appointment:cancelled': { schedule: EnhancedSchedule; reason?: string; tenantId: number };
  'appointment:rescheduled': { schedule: EnhancedSchedule; oldStartTime: Date; oldEndTime: Date; tenantId: number };
  'appointment:no_show': { schedule: EnhancedSchedule; tenantId: number };
  
  // Notification events
  'notification:created': { notification: any; tenantId: number; userId: number };
  'notification:read': { notificationId: number; tenantId: number; userId: number };
  'notification:deleted': { notificationId: number; tenantId: number; userId: number };
  
  // User events
  'user:created': { user: any; tenantId: number };
  'user:updated': { user: any; tenantId: number };
  'user:deleted': { userId: number; tenantId: number };
  
  // Facility events
  'facility:created': { facility: any; tenantId: number };
  'facility:updated': { facility: any; tenantId: number };
  'facility:deleted': { facilityId: number; tenantId: number };
  
  // System events
  'system:maintenance_mode': { enabled: boolean; message?: string };
  'system:tenant_created': { tenantId: number; organizationName: string };
  'system:performance_alert': { metric: string; value: number; threshold: number };
  
  // Asset events
  'asset:created': { asset: any; tenantId: number };
  'asset:updated': { asset: any; tenantId: number };
  'asset:deleted': { assetId: number; tenantId: number };
  'asset:imported': { count: number; tenantId: number; userId: number };
}

class EnhancedEventSystem extends EventEmitter {
  private static instance: EnhancedEventSystem;
  private eventHistory: Array<{ event: string; data: any; timestamp: Date; tenantId?: number }> = [];
  private maxHistorySize = 1000;

  private constructor() {
    super();
    this.setMaxListeners(50); // Increase max listeners for high-traffic apps
    this.setupGlobalErrorHandling();
  }

  static getInstance(): EnhancedEventSystem {
    if (!EnhancedEventSystem.instance) {
      EnhancedEventSystem.instance = new EnhancedEventSystem();
    }
    return EnhancedEventSystem.instance;
  }

  private setupGlobalErrorHandling() {
    this.addListener('error', (error: Error, context: any) => {
      logger.error('Unhandled event error', 'EventSystem', error, context);
    });
  }

  // Type-safe event emission
  emit<K extends keyof DockOptimizerEvents>(
    event: K,
    data: DockOptimizerEvents[K]
  ): boolean {
    try {
      // Log event for debugging
      logger.info('EventSystem', `Emitting event: ${event}`, { 
        tenantId: (data as any).tenantId, // Cast union type for property access
        eventData: data 
      });

      // Store in event history
      this.addToHistory(event, data);

      // Emit the event
          const result = super.emit(event, data);

    // Auto-handle common patterns (fire and forget)
    this.handleAutoPatterns(event, data).catch(error => {
      logger.error('Failed to handle auto patterns', 'EventSystem', error);
    });

    return result;
    } catch (error) {
      logger.error('EventSystem', `Failed to emit event: ${event}`, error, { data });
      (this as any).emit('error', error, { event, data }); // Cast for flexible emit call
      return false;
    }
  }

  // Type-safe event listening
  on<K extends keyof DockOptimizerEvents>(
    event: K,
    listener: (data: DockOptimizerEvents[K]) => void
  ): this {
    return super.on(event, listener);
  }

  // Type-safe one-time event listening
  once<K extends keyof DockOptimizerEvents>(
    event: K,
    listener: (data: DockOptimizerEvents[K]) => void
  ): this {
    return super.once(event, listener);
  }

  private addToHistory(event: string, data: any) {
    this.eventHistory.push({
      event,
      data,
      timestamp: new Date(),
      tenantId: data.tenantId,
    });

    // Keep history size manageable
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  private async handleAutoPatterns<K extends keyof DockOptimizerEvents>(
    event: K,
    data: DockOptimizerEvents[K]
  ) {
    const tenantId = (data as any).tenantId;

    // Auto-broadcast to WebSocket clients
    if (this.shouldBroadcastToWebSocket(event)) {
      try {
        await queueWebSocketNotification(
          tenantId,
          event,
          data,
          this.isUrgentEvent(event) ? 'urgent' : 'normal'
        );
      } catch (error) {
        logger.error('EventSystem', `Failed to queue WebSocket notification for ${event}`, error);
      }
    }

    // Auto-create notifications for important events
    if (this.shouldCreateNotification(event)) {
      try {
        await this.autoCreateNotification(event, data);
      } catch (error) {
        logger.error('EventSystem', `Failed to auto-create notification for ${event}`, error);
      }
    }

    // Auto-send emails for critical events
    if (this.shouldSendEmail(event)) {
      try {
        await this.autoSendEmail(event, data);
      } catch (error) {
        logger.error('EventSystem', `Failed to auto-send email for ${event}`, error);
      }
    }
  }

  private shouldBroadcastToWebSocket(event: string): boolean {
    // Broadcast most events except internal system events
    const noBroadcastEvents = [
      'system:performance_alert',
      'notification:read',
      'notification:deleted'
    ];
    return !noBroadcastEvents.includes(event);
  }

  private isUrgentEvent(event: string): boolean {
    const urgentEvents = [
      'appointment:cancelled',
      'appointment:no_show',
      'schedule:deleted',
      'system:maintenance_mode'
    ];
    return urgentEvents.includes(event);
  }

  private shouldCreateNotification(event: string): boolean {
    const notificationEvents = [
      'schedule:created',
      'appointment:created',
      'appointment:confirmed',
      'appointment:checked_in',
      'appointment:rescheduled',
      'appointment:cancelled',
      'appointment:no_show',
      'schedule:updated',
      'system:maintenance_mode'
    ];
    return notificationEvents.includes(event);
  }

  private shouldSendEmail(event: string): boolean {
    const emailEvents = [
      'appointment:confirmed',
      'appointment:rescheduled',
      'appointment:cancelled'
    ];
    return emailEvents.includes(event);
  }

  private async autoCreateNotification(event: string, data: any) {
    const { tenantId } = data;
    
    let title = '';
    let message = '';
    let urgency: 'critical' | 'urgent' | 'warning' | 'info' | 'normal' = 'normal';
    let userId = data.userId || data.schedule?.createdBy;

    switch (event) {
      case 'schedule:created':
        title = 'New Appointment Created';
        message = `A new appointment has been scheduled for ${new Date(data.schedule.startTime).toLocaleDateString()}`;
        urgency = 'info';
        break;
      
      case 'appointment:created':
        title = 'New Appointment Created';
        message = `A new appointment has been created for ${data.schedule.customerName || 'customer'}`;
        urgency = 'info';
        break;
      
      case 'appointment:confirmed':
        title = 'Appointment Confirmed';
        message = `Appointment #${data.confirmationCode} has been confirmed`;
        urgency = 'info';
        break;
      
      case 'appointment:checked_in':
        title = 'Vehicle Checked In';
        message = `${data.schedule.truckNumber || 'Vehicle'} has checked in for appointment`;
        urgency = 'info';
        break;
      
      case 'appointment:rescheduled':
        title = 'Appointment Rescheduled';
        message = `Appointment has been rescheduled to ${new Date(data.schedule.startTime).toLocaleString()}`;
        urgency = 'warning';
        break;
      
      case 'appointment:cancelled':
        title = 'Appointment Cancelled';
        message = `Appointment has been cancelled${data.reason ? `: ${data.reason}` : ''}`;
        urgency = 'urgent';
        break;
      
      case 'appointment:no_show':
        title = 'Appointment No-Show';
        message = `${data.schedule.truckNumber || 'Vehicle'} did not show up for scheduled appointment`;
        urgency = 'urgent';
        break;
      
      case 'schedule:updated':
        title = 'Schedule Updated';
        message = 'An appointment in your schedule has been updated';
        urgency = 'info';
        break;
      
      case 'system:maintenance_mode':
        title = 'System Maintenance';
        message = data.enabled ? 'System is entering maintenance mode' : 'System maintenance completed';
        urgency = 'critical';
        break;
      
      default:
        return; // Don't create notification for unknown events
    }

    if (userId) {
      await createAndQueueNotification(
        tenantId,
        userId,
        title,
        message,
        event.split(':')[0], // Use event category as type
        urgency,
        data.schedule?.id,
        data
      );
    }
  }

  private async autoSendEmail(event: string, data: any) {
    const { tenantId, schedule } = data;
    
    if (!schedule || !schedule.driverEmail) {
      return; // Can't send email without recipient
    }

    const emailData = {
      to: schedule.driverEmail,
      confirmationCode: data.confirmationCode || schedule.customFormData?.confirmationCode,
      schedule,
      oldStartTime: data.oldStartTime,
      oldEndTime: data.oldEndTime,
    };

    const priority = this.isUrgentEvent(event) ? 'urgent' : 'normal';

    try {
      await queueEmailNotification(tenantId, emailData, priority);
    } catch (error) {
      logger.error('EventSystem', `Failed to queue email for ${event}`, error);
    }
  }

  // Get event history for debugging/monitoring
  getEventHistory(tenantId?: number, limit?: number): Array<any> {
    let history = this.eventHistory;
    
    if (tenantId) {
      history = history.filter(entry => entry.tenantId === tenantId);
    }
    
    if (limit) {
      history = history.slice(-limit);
    }
    
    return history;
  }

  // Get event statistics
  getEventStats(tenantId?: number): Record<string, number> {
    let events = this.eventHistory;
    
    if (tenantId) {
      events = events.filter(entry => entry.tenantId === tenantId);
    }
    
    const stats: Record<string, number> = {};
    events.forEach(entry => {
      stats[entry.event] = (stats[entry.event] || 0) + 1;
    });
    
    return stats;
  }

  // Clear event history (for testing or privacy)
  clearHistory(tenantId?: number) {
    if (tenantId) {
      this.eventHistory = this.eventHistory.filter(entry => entry.tenantId !== tenantId);
    } else {
      this.eventHistory = [];
    }
  }
}

// Export singleton instance
export const eventSystem = EnhancedEventSystem.getInstance();

// Convenience functions for common event patterns
export const emitScheduleCreated = (schedule: EnhancedSchedule, tenantId: number) => {
  eventSystem.emit('schedule:created', { schedule, tenantId });
};

export const emitScheduleUpdated = (schedule: EnhancedSchedule, oldSchedule: EnhancedSchedule, tenantId: number) => {
  eventSystem.emit('schedule:updated', { schedule, oldSchedule, tenantId });
};

export const emitScheduleDeleted = (scheduleId: number, tenantId: number) => {
  eventSystem.emit('schedule:deleted', { scheduleId, tenantId });
};

export const emitAppointmentConfirmed = (schedule: EnhancedSchedule, confirmationCode: string, tenantId: number) => {
  eventSystem.emit('appointment:confirmed', { schedule, confirmationCode, tenantId });
};

export const emitAppointmentCheckedIn = (schedule: EnhancedSchedule, tenantId: number) => {
  eventSystem.emit('appointment:checked_in', { schedule, tenantId });
};

export const emitAppointmentCheckedOut = (schedule: EnhancedSchedule, tenantId: number) => {
  eventSystem.emit('appointment:checked_out', { schedule, tenantId });
};

export const emitAppointmentCancelled = (schedule: EnhancedSchedule, tenantId: number, reason?: string) => {
  eventSystem.emit('appointment:cancelled', { schedule, tenantId, reason });
};

export const emitAppointmentRescheduled = (schedule: EnhancedSchedule, oldStartTime: Date, oldEndTime: Date, tenantId: number) => {
  eventSystem.emit('appointment:rescheduled', { schedule, oldStartTime, oldEndTime, tenantId });
};

export const emitAppointmentNoShow = (schedule: EnhancedSchedule, tenantId: number) => {
  eventSystem.emit('appointment:no_show', { schedule, tenantId });
};

// Setup default event listeners
export const setupDefaultEventListeners = () => {
  // Log all events for debugging
  if (process.env.NODE_ENV === 'development') {
    eventSystem.on('schedule:created', (data) => {
      logger.info('Event', 'Schedule created', { scheduleId: data.schedule.id, tenantId: data.tenantId });
    });

    eventSystem.on('appointment:confirmed', (data) => {
      logger.info('Event', 'Appointment confirmed', { 
        scheduleId: data.schedule.id, 
        confirmationCode: data.confirmationCode,
        tenantId: data.tenantId 
      });
    });
  }

  // Performance monitoring
  eventSystem.on('system:performance_alert', (data) => {
    logger.warn('Performance', `Performance alert: ${data.metric} = ${data.value} (threshold: ${data.threshold})`);
  });
}; 