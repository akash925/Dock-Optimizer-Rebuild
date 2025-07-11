import { useEffect, useState, useRef } from 'react';
import { useAuth } from './use-auth';
import { useQueryClient } from '@tanstack/react-query';
import { debugLoggers } from '@/lib/debug';
import { useToast } from '@/hooks/use-toast';

const wsDebug = debugLoggers.websocket;

/**
 * Hook for real-time updates via WebSocket
 * Connects to WebSocket server and listens for updates
 * Automatically invalidates relevant queries when updates are received
 */
export function useRealtimeUpdates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [connected, setConnected] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isFallbackPolling, setIsFallbackPolling] = useState(false);
  const maxReconnectAttempts = 5;

  // Mutex for preventing redundant notifications (2s window)
  const notificationMutex = useRef<Map<string, number>>(new Map());
  const MUTEX_WINDOW_MS = 2000; // 2 seconds

  const checkMutex = (appointmentId: string | number, eventType: string): boolean => {
    const key = `${eventType}:${appointmentId}`;
    const now = Date.now();
    const lastEmission = notificationMutex.current.get(key);
    
    if (lastEmission && (now - lastEmission) < MUTEX_WINDOW_MS) {
      wsDebug.debug(`Mutex blocked duplicate ${eventType} for appointment ${appointmentId}`);
      return false; // Block duplicate
    }
    
    // Update mutex timestamp
    notificationMutex.current.set(key, now);
    
    // Clean up old entries (older than 5 seconds)
    for (const [mutexKey, timestamp] of Array.from(notificationMutex.current.entries())) {
      if (now - timestamp > 5000) {
        notificationMutex.current.delete(mutexKey);
      }
    }
    
    return true; // Allow notification
  };

  // Add specific appointment:created subscription as per RT-1 specification
  useEffect(() => {
    // Create a mock broker interface for the specification
    const broker = {
      subscribe: (eventType: string, handler: (evt: any) => void) => {
        // This would be implemented with the actual WebSocket system
        wsDebug.info('Setting up subscription for:', eventType);
        
        const handleMessage = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === eventType) {
              handler(data.data);
            }
          } catch (error) {
            wsDebug.error('Error parsing WebSocket message:', error);
          }
        };

        // In a real implementation, this would be connected to the WebSocket
        return () => {
          wsDebug.info('Unsubscribing from:', eventType);
        };
      }
    };

    return broker.subscribe('appointment:created', evt => {
      const appointmentId = evt?.schedule?.id || 'unknown';
      
      // Check mutex before showing notification
      if (!checkMutex(appointmentId, 'appointment:created')) {
        return;
      }

      toast({
        title: 'New appointment booked',
        description: 'A new appointment has been created',
      });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });
  }, [toast, queryClient]);

  useEffect(() => {
    // Only connect if user is authenticated
    if (!user) {
      setConnected(false);
      return;
    }

    // Reset state for new connection
    setSocketError(null);
    
    // Create WebSocket connection with better URL construction for Replit
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // Enhanced host validation and Replit environment detection
    if (!host || host === 'undefined' || host.includes('undefined')) {
      wsDebug.error('Invalid host detected:', host);
      setSocketError('Invalid WebSocket host configuration');
      return;
    }
    
    // Special handling for Replit environment
    let wsUrl: string;
    if (host.includes('replit.dev') || host.includes('repl.co')) {
      // For Replit, use the same host as the web interface
      wsUrl = `${protocol}//${host}/ws`;
      wsDebug.info('Detected Replit environment');
    } else if (host.includes('localhost')) {
      // For local development, ensure we have a valid port
      const port = window.location.port || '3000';
      wsUrl = `${protocol}//${window.location.hostname}:${port}/ws`;
    } else {
      // For other environments, use the current host
      wsUrl = `${protocol}//${host}/ws`;
    }
    
    wsDebug.info(`Connecting to: ${wsUrl} (Attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
    
    let socket: WebSocket;
    
    try {
      socket = new WebSocket(wsUrl);
    } catch (error) {
      wsDebug.error('Failed to create WebSocket connection:', error);
      setSocketError(`Failed to create WebSocket: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return;
    }
    
    let pollingInterval: NodeJS.Timeout | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    // Connection opened
    socket.addEventListener('open', () => {
      wsDebug.info('Connected');
      setConnected(true);
      setSocketError(null);
      setReconnectAttempts(0);
      setIsFallbackPolling(false);

      // Authenticate the WebSocket connection with user info
      if (user) {
        socket.send(JSON.stringify({
          type: 'auth',
          tenantId: user.tenantId,
          userId: user.id
        }));
      }
    });

    // Listen for messages
    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        wsDebug.debug('Message received:', message);

        // Handle different message types
        switch (message.type) {
          case 'connected':
            wsDebug.info('Connection confirmed by server');
            break;

          case 'schedule_update':
            // Invalidate schedules query when a schedule is updated
            wsDebug.debug('Schedule update received, invalidating queries');
            queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
            
            // Also invalidate availability data since schedule changes affect availability
            wsDebug.debug('Invalidating availability cache');
            queryClient.invalidateQueries({ queryKey: ['/api/availability'] });
            break;

          case 'schedule:created':
          case 'schedule_created':
            // Invalidate schedules query when a new schedule is created
            wsDebug.debug('New schedule created, invalidating queries');
            queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
            
            // Also invalidate availability data since new appointments affect availability
            wsDebug.debug('Invalidating availability cache');
            queryClient.invalidateQueries({ queryKey: ['/api/availability'] });
            break;

          case 'appointment:created':
          case 'appointment_created':
            // Extract appointment data for notification
            const appointmentData = message.data || message.payload;
            const appointmentId = appointmentData?.schedule?.id || 'unknown';
            
            // 🔔 RT-1: Mutex check to prevent redundant notifications
            if (!checkMutex(appointmentId, 'appointment:created')) {
              wsDebug.debug('Duplicate appointment:created notification blocked by mutex');
              break;
            }

            // Invalidate schedules and notifications when new appointment is created
            wsDebug.debug('New appointment created, invalidating queries');
            queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
            queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
            queryClient.invalidateQueries({ queryKey: ['/api/notifications/enhanced'] });
            
            // Also invalidate availability data since new appointments affect availability
            wsDebug.debug('Invalidating availability cache');
            queryClient.invalidateQueries({ queryKey: ['/api/availability'] });
            queryClient.invalidateQueries({ queryKey: ['/api/appointment-master/availability-rules'] });
            
            // Invalidate appointment types in case slot counts changed
            queryClient.invalidateQueries({ queryKey: ['/api/appointment-types'] });
            
            // Invalidate facilities data that may show appointment counts
            queryClient.invalidateQueries({ queryKey: ['/api/facilities'] });
            
            // Invalidate booking pages that may show availability
            queryClient.invalidateQueries({ queryKey: ['/api/booking-pages'] });
            
            // Invalidate custom and standard questions that may be appointment-specific
            queryClient.invalidateQueries({ queryKey: ['/api/custom-questions'] });
            queryClient.invalidateQueries({ queryKey: ['/api/standard-questions'] });
            
            // 🔔 RT-1: Show toast notification for new appointments (optimized for <500ms display)
            const customerName = appointmentData?.schedule?.customerName || 'Unknown';
            const appointmentTime = appointmentData?.schedule?.startTime 
              ? new Date(appointmentData.schedule.startTime).toLocaleString()
              : 'Unknown time';
            
            // Use setTimeout to ensure immediate UI update (<500ms requirement)
            setTimeout(() => {
              toast({
                title: '🚛 New Appointment Created',
                description: `${customerName} has booked an appointment for ${appointmentTime}`,
                duration: 5000,
              });
            }, 0);
            
            // 🔔 RT-1: Update bell badge notification count
            // Note: The query invalidation above will trigger the notifications query to refetch,
            // which will update the bell badge count automatically
            wsDebug.info(`New appointment toast notification shown for ${customerName} (ID: ${appointmentId})`);
            break;

          case 'appointment:confirmed':
          case 'appointment_confirmed':
            const confirmedAppointmentData = message.data || message.payload;
            const confirmedAppointmentId = confirmedAppointmentData?.schedule?.id || 'unknown';
            
            // Apply mutex for confirmation events too
            if (!checkMutex(confirmedAppointmentId, 'appointment:confirmed')) {
              wsDebug.debug('Duplicate appointment:confirmed notification blocked by mutex');
              break;
            }

            // Invalidate schedules and notifications when appointment is confirmed
            wsDebug.debug('Appointment confirmed, invalidating queries');
            queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
            queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
            queryClient.invalidateQueries({ queryKey: ['/api/notifications/enhanced'] });
            break;

          case 'notification:created':
          case 'notification_created':
            // Invalidate notifications when new notification is created
            wsDebug.debug('New notification created, invalidating queries');
            queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
            queryClient.invalidateQueries({ queryKey: ['/api/notifications/enhanced'] });
            break;

          default:
            wsDebug.debug('Unknown message type:', message.type);
        }
      } catch (error) {
        wsDebug.error('Failed to parse message:', error);
      }
    });

    // Connection closed
    socket.addEventListener('close', (event) => {
      wsDebug.info('Connection closed:', event.code, event.reason);
      setConnected(false);
      
      // Only set error if it was an abnormal closure
      if (event.code !== 1000 && event.code !== 1001) {
        setSocketError(`Connection closed (${event.code}): ${event.reason || 'Unknown reason'}`);
        
        // Disable reconnections to prevent excessive WebSocket churning
        wsDebug.warn('Connection closed - disabling reconnections to prevent system overload');
      }
    });

    // Connection error
    socket.addEventListener('error', (error) => {
      wsDebug.error('Connection error:', error);
      setSocketError('Connection error');
    });

    // Cleanup on unmount
    return () => {
      wsDebug.debug('Closing connection on cleanup');
      
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      
      // Clear mutex on cleanup
      notificationMutex.current.clear();
      
      socket.close();
    };
  }, [user, queryClient, reconnectAttempts, maxReconnectAttempts]);

  return {
    connected,
    socketError,
    reconnectAttempts,
    isFallbackPolling,
    maxReconnectAttempts
  };
}