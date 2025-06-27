import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { getStorage } from '../storage';
import { broadcastToTenant } from '../websocket';
import { 
  sendConfirmationEmail, 
  sendReminderEmail, 
  sendRescheduleEmail, 
  sendCancellationEmail,
  EnhancedSchedule 
} from '../notifications';
import { logger } from '../utils/logger';

// Redis connection for BullMQ
let redis: IORedis | null = null;

// Initialize Redis connection with proper logging
function initializeRedis(): IORedis | null {
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    console.warn('[BullMQ] Redis disabled – REDIS_URL not set');
    return null;
  }

  try {
    let redisInstance: IORedis;
    
    if (process.env.REDIS_URL) {
      redisInstance = new IORedis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
    } else {
      redisInstance = new IORedis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
    }

    redisInstance.on('connect', () => {
      const redisHost = process.env.REDIS_URL ? 'cloud' : `${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`;
      console.info(`[BullMQ] Notification queue initialised (host: ${redisHost})`);
    });

    redisInstance.on('error', (error) => {
      console.error('[BullMQ] Redis connection error:', error.message);
    });

    return redisInstance;
  } catch (error) {
    console.error('[BullMQ] Failed to initialize Redis:', error);
    return null;
  }
}

redis = initializeRedis();

// Notification job types
export interface NotificationJobData {
  type: 'email' | 'websocket' | 'push';
  tenantId: number;
  scheduleId?: number;
  userId?: number;
  emailData?: {
    to: string;
    confirmationCode: string;
    schedule: EnhancedSchedule;
    oldStartTime?: Date;
    oldEndTime?: Date;
    hoursUntilAppointment?: number;
  };
  websocketData?: {
    eventType: string;
    data: any;
  };
  pushData?: {
    title: string;
    message: string;
    data?: any;
  };
}

// Create notification queues with different priorities (only if Redis is available)
export let notificationQueue: Queue | null = null;
export let urgentNotificationQueue: Queue | null = null;

if (redis) {
  notificationQueue = new Queue('notifications', { 
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  });

  urgentNotificationQueue = new Queue('urgent-notifications', { 
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: 50,
      removeOnFail: 25,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
  });
}

// Create workers to process notification jobs
const notificationWorker = new Worker('notifications', async (job: Job<NotificationJobData>) => {
  const { data } = job;
  
  try {
    logger.info('NotificationWorker', `Processing ${data.type} notification for tenant ${data.tenantId}`, { jobId: job.id });

    switch (data.type) {
      case 'email':
        await processEmailNotification(data);
        break;
      case 'websocket':
        await processWebSocketNotification(data);
        break;
      case 'push':
        await processPushNotification(data);
        break;
      default:
        throw new Error(`Unknown notification type: ${data.type}`);
    }

    logger.info('NotificationWorker', `Successfully processed ${data.type} notification`, { jobId: job.id });
  } catch (error) {
    logger.error('NotificationWorker', `Failed to process ${data.type} notification`, error, { 
      jobId: job.id, 
      tenantId: data.tenantId 
    });
    throw error;
  }
}, { 
  connection: redis,
  concurrency: 5,
});

const urgentNotificationWorker = new Worker('urgent-notifications', async (job: Job<NotificationJobData>) => {
  const { data } = job;
  
  try {
    logger.info('UrgentNotificationWorker', `Processing urgent ${data.type} notification for tenant ${data.tenantId}`, { jobId: job.id });

    // Process urgent notifications with higher priority
    switch (data.type) {
      case 'email':
        await processEmailNotification(data);
        break;
      case 'websocket':
        await processWebSocketNotification(data);
        break;
      case 'push':
        await processPushNotification(data);
        break;
      default:
        throw new Error(`Unknown urgent notification type: ${data.type}`);
    }

    logger.info('UrgentNotificationWorker', `Successfully processed urgent ${data.type} notification`, { jobId: job.id });
  } catch (error) {
    logger.error('UrgentNotificationWorker', `Failed to process urgent ${data.type} notification`, error, { 
      jobId: job.id, 
      tenantId: data.tenantId 
    });
    throw error;
  }
}, { 
  connection: redis,
  concurrency: 10, // Higher concurrency for urgent notifications
});

// Process email notifications
async function processEmailNotification(data: NotificationJobData): Promise<void> {
  if (!data.emailData) {
    throw new Error('Email data is required for email notifications');
  }

  const { to, confirmationCode, schedule, oldStartTime, oldEndTime, hoursUntilAppointment } = data.emailData;

  try {
    if (hoursUntilAppointment !== undefined) {
      // Reminder email
      await sendReminderEmail(to, confirmationCode, schedule, hoursUntilAppointment);
    } else if (oldStartTime && oldEndTime) {
      // Reschedule email
      await sendRescheduleEmail(to, confirmationCode, schedule, oldStartTime, oldEndTime);
    } else if (schedule.status === 'cancelled') {
      // Cancellation email
      await sendCancellationEmail(to, confirmationCode, schedule);
    } else {
      // Confirmation email
      await sendConfirmationEmail(to, confirmationCode, schedule);
    }
  } catch (error) {
    logger.error('EmailNotification', 'Failed to send email', error, { 
      to, 
      confirmationCode, 
      scheduleId: schedule.id 
    });
    throw error;
  }
}

// Process WebSocket notifications
async function processWebSocketNotification(data: NotificationJobData): Promise<void> {
  if (!data.websocketData) {
    throw new Error('WebSocket data is required for WebSocket notifications');
  }

  try {
    const clientCount = broadcastToTenant(data.tenantId, data.websocketData.eventType, data.websocketData.data);
    logger.info('WebSocketNotification', `Broadcast to ${clientCount} clients`, { 
      tenantId: data.tenantId,
      eventType: data.websocketData.eventType 
    });
  } catch (error) {
    logger.error('WebSocketNotification', 'Failed to broadcast WebSocket message', error, { 
      tenantId: data.tenantId,
      eventType: data.websocketData.eventType 
    });
    throw error;
  }
}

// Process push notifications (placeholder for future implementation)
async function processPushNotification(data: NotificationJobData): Promise<void> {
  if (!data.pushData) {
    throw new Error('Push data is required for push notifications');
  }

  // TODO: Implement push notification logic with services like FCM, APNs, etc.
  logger.info('PushNotification', 'Push notification processed (placeholder)', { 
    tenantId: data.tenantId,
    title: data.pushData.title 
  });
}

// Utility functions to add jobs to queues
export async function queueEmailNotification(
  tenantId: number,
  emailData: NotificationJobData['emailData'],
  priority: 'normal' | 'urgent' = 'normal'
): Promise<void> {
  const jobData: NotificationJobData = {
    type: 'email',
    tenantId,
    emailData,
  };

  const queue = priority === 'urgent' ? urgentNotificationQueue : notificationQueue;
  await queue.add('email-notification', jobData, {
    priority: priority === 'urgent' ? 10 : 5,
  });
}

export async function queueWebSocketNotification(
  tenantId: number,
  eventType: string,
  data: any,
  priority: 'normal' | 'urgent' = 'normal'
): Promise<void> {
  const jobData: NotificationJobData = {
    type: 'websocket',
    tenantId,
    websocketData: { eventType, data },
  };

  const queue = priority === 'urgent' ? urgentNotificationQueue : notificationQueue;
  await queue.add('websocket-notification', jobData, {
    priority: priority === 'urgent' ? 10 : 5,
  });
}

export async function queuePushNotification(
  tenantId: number,
  userId: number,
  pushData: NotificationJobData['pushData'],
  priority: 'normal' | 'urgent' = 'normal'
): Promise<void> {
  const jobData: NotificationJobData = {
    type: 'push',
    tenantId,
    userId,
    pushData,
  };

  const queue = priority === 'urgent' ? urgentNotificationQueue : notificationQueue;
  await queue.add('push-notification', jobData, {
    priority: priority === 'urgent' ? 10 : 5,
  });
}

// Enhanced notification creation with automatic queueing
export async function createAndQueueNotification(
  tenantId: number,
  userId: number,
  title: string,
  message: string,
  type: string,
  urgency: 'critical' | 'urgent' | 'warning' | 'info' | 'normal' = 'normal',
  scheduleId?: number,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const storage = await getStorage();
    
    // Create notification in database
    const notification = await storage.createNotification({
      userId,
      title,
      message,
      type,
      relatedScheduleId: scheduleId,
    });

    // Queue WebSocket notification for real-time update
    const priority = ['critical', 'urgent'].includes(urgency) ? 'urgent' : 'normal';
    await queueWebSocketNotification(tenantId, 'notification_created', {
      notification: {
        ...notification,
        urgency,
        metadata,
      }
    }, priority);

    logger.info('NotificationQueue', `Queued notification for user ${userId}`, { 
      notificationId: notification.id,
      urgency,
      type 
    });
  } catch (error) {
    logger.error('NotificationQueue', 'Failed to create and queue notification', error, { 
      tenantId,
      userId,
      type 
    });
    throw error;
  }
}

// Graceful shutdown
export async function shutdown(): Promise<void> {
  logger.info('NotificationQueue', 'Shutting down notification workers and queues');
  
  await notificationWorker.close();
  await urgentNotificationWorker.close();
  await notificationQueue.close();
  await urgentNotificationQueue.close();
  await redis.quit();
} 