/**
 * WebSocket Integration
 * 
 * Connects the enhanced secure WebSocket handler to the application
 * with proper tenant isolation.
 */

import { Server } from 'http';
import { IStorage } from '../storage';
import { SecureWebSocketHandler } from './secure-handler.js';

let wsHandler: SecureWebSocketHandler | null = null;

/**
 * Initialize the secure WebSocket handler
 * @param server HTTP server instance
 * @param storage Storage instance
 * @returns The WebSocket handler instance
 */
export function initializeWebSocket(server: Server, storage: IStorage): SecureWebSocketHandler {
  if (wsHandler) {
    console.log('[WebSocket] Handler already initialized, returning existing instance');
    return wsHandler;
  }
  
  // Create new secure WebSocket handler
  wsHandler = new SecureWebSocketHandler(server, '/ws', storage);
  console.log('[WebSocket] Secure handler initialized and connected to HTTP server');
  
  return wsHandler;
}

/**
 * Get the WebSocket handler instance
 * @returns The WebSocket handler if initialized, or null otherwise
 */
export function getWebSocketHandler(): SecureWebSocketHandler | null {
  return wsHandler;
}

/**
 * Broadcast a schedule update to all clients in the appropriate tenant
 * @param schedule The schedule data to broadcast
 * @returns The number of clients that received the message
 */
export function broadcastScheduleUpdate(schedule: any): number {
  if (!wsHandler) {
    console.warn('[WebSocket] Cannot broadcast: WebSocket handler not initialized');
    return 0;
  }
  
  return wsHandler.broadcastScheduleUpdate(schedule);
}

/**
 * Broadcast a message to all clients in a specific tenant
 * @param tenantId The tenant ID to target
 * @param type The message type
 * @param data The message data
 * @returns The number of clients that received the message
 */
export function broadcastToTenant(tenantId: number, type: string, data: any): number {
  if (!wsHandler) {
    console.warn('[WebSocket] Cannot broadcast: WebSocket handler not initialized');
    return 0;
  }
  
  return wsHandler.broadcastToTenant(tenantId, type, data);
}

/**
 * Shutdown the WebSocket handler and clean up resources
 */
export function shutdownWebSocket(): void {
  if (wsHandler) {
    wsHandler.shutdown();
    wsHandler = null;
    console.log('[WebSocket] Handler shut down');
  }
}