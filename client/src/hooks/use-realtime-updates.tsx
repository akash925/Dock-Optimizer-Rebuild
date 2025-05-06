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
    
    // Create WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`[WebSocket] Connecting to: ${wsUrl} (Attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
    const socket = new WebSocket(wsUrl);
    
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
            queryClient.invalidateQueries({ queryKey: ['/api/availability/v2'] });
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
        
        // Try to reconnect if we haven't exceeded max attempts
        if (reconnectAttempts < maxReconnectAttempts) {
          console.log(`[WebSocket] Attempting to reconnect in 5 seconds (Attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeout = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
          }, 5000);
        } else {
          console.log('[WebSocket] Max reconnect attempts reached, falling back to polling');
          setIsFallbackPolling(true);
          
          // Setup polling as fallback
          pollingInterval = setInterval(() => {
            console.log('[Polling] Checking for updates via poll');
            queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
            
            // Also periodically refresh availability data
            queryClient.invalidateQueries({ queryKey: ['/api/availability'] });
            queryClient.invalidateQueries({ queryKey: ['/api/availability/v2'] });
          }, 30000); // Poll every 30 seconds
        }
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