import React from 'react';
import { useRealtimeUpdates } from '@/hooks/use-realtime-updates';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, RefreshCw, WifiOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function WebSocketStatus() {
  const { 
    connected, 
    socketError, 
    reconnectAttempts, 
    isFallbackPolling,
    maxReconnectAttempts 
  } = useRealtimeUpdates();

  // Different states for the WebSocket connection
  if (isFallbackPolling) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-900 border-amber-300">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Polling</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>WebSocket connection failed after {maxReconnectAttempts} attempts.</p>
            <p>Using fallback polling for updates.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (reconnectAttempts > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-900 border-amber-300">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Reconnecting {reconnectAttempts}/{maxReconnectAttempts}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Attempting to reconnect to real-time updates.</p>
            {socketError && <p>Error: {socketError}</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (connected) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1 bg-green-50 text-green-900 border-green-300">
              <CheckCircle2 className="w-3 h-3" />
              <span>Real-time</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Connected to real-time updates</p>
            <p>Calendar will update automatically</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Default state - disconnected
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1 bg-slate-50 text-slate-900 border-slate-300">
            <WifiOff className="w-3 h-3" />
            <span>Offline</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Not connected to real-time updates</p>
          {socketError && (
            <p className="text-red-500 text-xs flex items-center gap-1 mt-1">
              <AlertTriangle className="w-3 h-3" />
              {socketError}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}