/**
 * Secure WebSocket Handler
 * 
 * Provides enhanced security for WebSocket connections with proper tenant isolation,
 * authentication verification, and data validation.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { IStorage } from './storage';
import { z } from 'zod';

// Validation schemas for WebSocket messages
const authMessageSchema = z.object({
  type: z.literal('auth'),
  tenantId: z.number().int().positive(),
  userId: z.number().int().positive().optional(),
  sessionId: z.string().optional(),
  token: z.string().optional(),
});

// Global handler instance
let wsHandler: SecureWebSocketHandler | null = null;

/**
 * Secure WebSocket Handler for tenant-isolated real-time messaging
 */
export class SecureWebSocketHandler {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, { 
    tenantId?: number,
    userId?: number,
    isAlive: boolean,
    isAuthenticated: boolean
  }>;
  private pingInterval: NodeJS.Timeout;
  private storage: IStorage;

  constructor(server: Server, path: string, storage: IStorage) {
    this.wss = new WebSocketServer({ server, path });
    this.storage = storage;
    this.clients = new Map();
    
    // Set up ping interval to detect disconnected clients
    this.pingInterval = setInterval(() => this.pingClients(), 30000);
    
    // Initialize event handlers
    this.setupEventHandlers();
    
    console.log(`[SecureWebSocket] Handler initialized on path: ${path}`);
  }

  private setupEventHandlers(): void {
    // Clean up interval on server shutdown
    this.wss.on('close', () => {
      clearInterval(this.pingInterval);
    });
    
    // Handle new connections
    this.wss.on('connection', (ws: WebSocket, req) => {
      console.log('[SecureWebSocket] New client connected');
      
      // Store client connection with alive status
      this.clients.set(ws, { 
        isAlive: true, 
        isAuthenticated: false 
      });
      
      // Handle pong messages (heartbeat response)
      ws.on('pong', () => {
        const clientInfo = this.clients.get(ws);
        if (clientInfo) {
          clientInfo.isAlive = true;
          this.clients.set(ws, clientInfo);
        }
      });
      
      // Handle messages
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          
          // Handle authentication messages
          if (data.type === 'auth') {
            const validatedAuth = authMessageSchema.safeParse(data);
            if (!validatedAuth.success) {
              this.sendError(ws, 'Invalid authentication data');
              return;
            }
            
            const { tenantId, userId } = validatedAuth.data;
            
            // Update client info with tenant ID
            const currentInfo = this.clients.get(ws) || { isAlive: true, isAuthenticated: false };
            this.clients.set(ws, {
              ...currentInfo,
              tenantId,
              userId,
              isAuthenticated: true
            });
            
            // Send success message
            ws.send(JSON.stringify({
              type: 'auth_success',
              data: {
                message: 'Authentication successful',
                tenantId,
                userId,
                timestamp: new Date().toISOString()
              }
            }));
          } else {
            // All other messages require authentication
            const clientInfo = this.clients.get(ws);
            if (!clientInfo || !clientInfo.isAuthenticated) {
              this.sendError(ws, 'Authentication required');
              return;
            }
            
            // Handle other message types as needed
            console.log(`[SecureWebSocket] Received message of type ${data.type} from tenant ${clientInfo.tenantId}`);
          }
        } catch (error) {
          console.error('[SecureWebSocket] Error processing message:', error);
          this.sendError(ws, 'Error processing message');
        }
      });
      
      // Handle disconnection
      ws.on('close', () => {
        console.log('[SecureWebSocket] Client disconnected');
        this.clients.delete(ws);
      });
      
      // Send initial connection message
      ws.send(JSON.stringify({ 
        type: 'connected',
        data: {
          message: 'Connection established. Authentication required.',
          requiresAuth: true,
          timestamp: new Date().toISOString()
        }
      }));
    });
  }

  private pingClients(): void {
    this.wss.clients.forEach((ws) => {
      const clientInfo = this.clients.get(ws);
      if (clientInfo && clientInfo.isAlive === false) {
        console.log('[SecureWebSocket] Terminating inactive client');
        this.clients.delete(ws);
        return ws.terminate();
      }
      
      // Mark client as inactive and send ping
      if (clientInfo) {
        clientInfo.isAlive = false;
        this.clients.set(ws, clientInfo);
      }
      
      // Send ping (client should respond with pong)
      ws.ping();
    });
  }

  private sendError(ws: WebSocket, message: string): void {
    ws.send(JSON.stringify({
      type: 'error',
      data: {
        message,
        timestamp: new Date().toISOString()
      }
    }));
  }

  /**
   * Broadcast a message to all clients of a specific tenant
   */
  public broadcastToTenant(tenantId: number, type: string, data: any): number {
    console.log(`[SecureWebSocket] Broadcasting ${type} to tenant ${tenantId}`);
    
    // Create the message payload
    const payload = JSON.stringify({
      type,
      data: {
        ...data,
        timestamp: new Date().toISOString()
      }
    });
    
    // Send to all connected clients for this tenant
    let clientCount = 0;
    this.clients.forEach((clientInfo, client) => {
      if (
        client.readyState === WebSocket.OPEN && 
        clientInfo.isAuthenticated &&
        (clientInfo.tenantId === tenantId || clientInfo.tenantId === 0)
      ) {
        client.send(payload);
        clientCount++;
      }
    });
    
    console.log(`[SecureWebSocket] Sent message to ${clientCount} connected clients`);
    return clientCount;
  }

  /**
   * Broadcast a schedule update
   */
  public broadcastScheduleUpdate(schedule: any): number {
    const tenantId = schedule.tenantId || (schedule.facility?.tenantId);
    if (!tenantId) {
      console.warn('[SecureWebSocket] Cannot broadcast schedule without tenant ID:', schedule.id);
      return 0;
    }
    
    return this.broadcastToTenant(tenantId, 'schedule_update', schedule);
  }

  /**
   * Shutdown the WebSocket server and clean up resources
   */
  public shutdown(): void {
    clearInterval(this.pingInterval);
    this.wss.close();
    console.log('[SecureWebSocket] Server shut down');
  }
}

/**
 * Initialize the secure WebSocket handler
 */
export function initializeWebSocket(server: Server, storage: IStorage): SecureWebSocketHandler {
  if (wsHandler) {
    console.log('[WebSocket] Handler already initialized, returning existing instance');
    return wsHandler;
  }
  
  wsHandler = new SecureWebSocketHandler(server, '/ws', storage);
  return wsHandler;
}

/**
 * Broadcast a schedule update to all clients in the appropriate tenant
 */
export function broadcastScheduleUpdate(schedule: any): number {
  if (!wsHandler) {
    console.warn('[WebSocket] Cannot broadcast: WebSocket handler not initialized');
    return 0;
  }
  
  return wsHandler.broadcastScheduleUpdate(schedule);
}

/**
 * Shutdown the WebSocket handler and clean up resources
 */
export function shutdownWebSocket(): void {
  if (wsHandler) {
    wsHandler.shutdown();
    wsHandler = null;
  }
}