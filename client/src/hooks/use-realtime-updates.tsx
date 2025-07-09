import { useEffect, useState } from 'react';
import { useAuth } from './use-auth';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook for real-time updates via WebSocket
 * Connects to WebSocket server and listens for updates
 * Automatically invalidates relevant queries when updates are received
 */
export function useRealtimeUpdates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isFallbackPolling, setIsFallbackPolling] = useState(false);
  const maxReconnectAttempts = 5;

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
      console.error('[WebSocket] Invalid host detected:', host);
      setSocketError('Invalid WebSocket host configuration');
      return;
    }
    
    // Special handling for Replit environment
    let wsUrl: string;
    if (host.includes('replit.dev') || host.includes('repl.co')) {
      // For Replit, use the same host as the web interface
      wsUrl = `${protocol}//${host}/ws`;
      console.log('[WebSocket] Detected Replit environment');
    } else if (host.includes('localhost')) {
      // For local development, ensure we have a valid port
      const port = window.location.port || '3000';
      wsUrl = `${protocol}//${window.location.hostname}:${port}/ws`;
    } else {
      // For other environments, use the current host
      wsUrl = `${protocol}//${host}/ws`;
    }
    
    console.log(`[WebSocket] Connecting to: ${wsUrl} (Attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
    
    let socket: WebSocket;
    
    try {
      socket = new WebSocket(wsUrl);
    } catch (error) {
      console.error('[WebSocket] Failed to create WebSocket connection:', error);
      setSocketError(`Failed to create WebSocket: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return;
    }
    
    let pollingInterval: NodeJS.Timeout | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    // Connection opened
    socket.addEventListener('open', () => {
      console.log('[WebSocket] Connected');
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
        console.log('[WebSocket] Message received:', message);

        // Handle different message types
        switch (message.type) {
          case 'connected':
            console.log('[WebSocket] Connection confirmed by server');
            break;

          case 'schedule_update':
            // Invalidate schedules query when a schedule is updated
            console.log('[WebSocket] Schedule update received, invalidating queries');
            queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
            
            // Also invalidate availability data since schedule changes affect availability
            console.log('[WebSocket] Invalidating availability cache');
            queryClient.invalidateQueries({ queryKey: ['/api/availability'] });
            break;

          case 'schedule:created':
          case 'schedule_created':
            // Invalidate schedules query when a new schedule is created
            console.log('[WebSocket] New schedule created, invalidating queries');
            queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
            
            // Also invalidate availability data since new appointments affect availability
            console.log('[WebSocket] Invalidating availability cache');
            queryClient.invalidateQueries({ queryKey: ['/api/availability'] });
            break;

          case 'appointment:confirmed':
          case 'appointment_confirmed':
            // Invalidate schedules and notifications when appointment is confirmed
            console.log('[WebSocket] Appointment confirmed, invalidating queries');
            queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
            queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
            queryClient.invalidateQueries({ queryKey: ['/api/notifications/enhanced'] });
            break;

          case 'notification:created':
          case 'notification_created':
            // Invalidate notifications when new notification is created
            console.log('[WebSocket] New notification created, invalidating queries');
            queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
            queryClient.invalidateQueries({ queryKey: ['/api/notifications/enhanced'] });
            break;

          default:
            console.log('[WebSocket] Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    });

    // Connection closed
    socket.addEventListener('close', (event) => {
      console.log('[WebSocket] Connection closed:', event.code, event.reason);
      setConnected(false);
      
      // Only set error if it was an abnormal closure
      if (event.code !== 1000 && event.code !== 1001) {
        setSocketError(`Connection closed (${event.code}): ${event.reason || 'Unknown reason'}`);
        
        // Disable reconnections to prevent excessive WebSocket churning
        console.log('[WebSocket] Connection closed - disabling reconnections to prevent system overload');
      }
    });

    // Connection error
    socket.addEventListener('error', (error) => {
      console.error('[WebSocket] Connection error:', error);
      setSocketError('Connection error');
    });

    // Cleanup on unmount
    return () => {
      console.log('[WebSocket] Closing connection on cleanup');
      
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      
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