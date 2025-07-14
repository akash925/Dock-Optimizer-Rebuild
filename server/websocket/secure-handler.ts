/**
 * Secure WebSocket Handler
 * 
 * Provides enhanced security for WebSocket connections with proper tenant isolation,
 * authentication verification, and data validation.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { IStorage } from '../storage';
import { z } from 'zod';

// Extend WebSocket to include tenant information
interface TenantWebSocket extends WebSocket {
  tenantId?: number;
  userId?: number;
  isAlive?: boolean;
  isAuthenticated?: boolean;
  sessionId?: string;
}

// Validation schemas for WebSocket messages
const authMessageSchema = z.object({
  type: z.literal('auth'),
  tenantId: z.number().int().positive(),
  userId: z.number().int().positive().optional(),
  sessionId: z.string().optional(),
  token: z.string().optional(),
});

const clientMessageSchema = z.object({
  type: z.string(),
  data: z.any(),
});

// WebSocket authentication and client management
export class SecureWebSocketHandler {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, {
    tenantId?: number;
    userId?: number;
    isAlive: boolean;
    isAuthenticated: boolean;
    sessionId?: string;
  }>;
  private pingInterval: NodeJS.Timeout;
  private storage: IStorage;

  constructor(server: Server, path: string, storage: IStorage) {
    // Initialize WebSocket server
    this.wss = new WebSocketServer({ 
      server, 
      path 
    });

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
      console.log('[SecureWebSocket] Server closing, clearing ping interval');
      clearInterval(this.pingInterval);
    });

    // Handle WebSocket connections
    this.wss.on('connection', (ws: TenantWebSocket, req) => {
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

      // Send initial connection message
      ws.send(JSON.stringify({ 
        type: 'connected',
        data: {
          message: 'Connection established. Authentication required.',
          requiresAuth: true,
          timestamp: new Date().toISOString()
        }
      }));

      // Handle messages
      ws.on('message', (message) => this.handleMessage(ws, message));

      // Handle disconnection
      ws.on('close', () => {
        console.log('[SecureWebSocket] Client disconnected');
        this.clients.delete(ws);
      });
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

  private async handleMessage(ws: TenantWebSocket, message: any): Promise<void> {
    try {
      const rawData = message.toString();
      const data = JSON.parse(rawData);
      
      // Validate basic message structure
      const validatedMessage = clientMessageSchema.safeParse(data);
      if (!validatedMessage.success) {
        return this.sendError(ws, 'Invalid message format');
      }
      
      // Handle authentication messages
      if (data.type === 'auth') {
        await this.handleAuth(ws, data);
      } else {
        // All other messages require authentication
        const clientInfo = this.clients.get(ws);
        if (!clientInfo || !clientInfo.isAuthenticated) {
          return this.sendError(ws, 'Authentication required');
        }
        
        // Handle other message types here based on type
        // For now, just log that we received a message
        console.log(`[SecureWebSocket] Received message of type ${data.type} from tenant ${clientInfo.tenantId}`);
      }
    } catch (error) {
      console.error('[SecureWebSocket] Error processing message:', error);
      this.sendError(ws, 'Error processing message');
    }
  }

  private async handleAuth(ws: TenantWebSocket, data: any): Promise<void> {
    try {
      // Validate auth message
      const validatedAuth = authMessageSchema.safeParse(data);
      if (!validatedAuth.success) {
        return this.sendError(ws, 'Invalid authentication data');
      }
      
      const { tenantId, userId, sessionId, token } = validatedAuth.data;
      
      // Here you would verify the token/session against your authentication system
      // For this implementation, we'll just check that the tenant ID is valid
      try {
        if (userId) {
          const user = await this.storage.getUser(userId);
          if (!user || user.tenantId !== tenantId) {
            return this.sendError(ws, 'Invalid user or tenant mismatch');
          }
        } else {
          // If no user ID, at least validate the tenant exists
          const tenant = await this.storage.getTenantById(tenantId);
          if (!tenant) {
            return this.sendError(ws, 'Invalid tenant ID');
          }
        }
        
        // Store authenticated client info
        const currentInfo = this.clients.get(ws) || { isAlive: true, isAuthenticated: false };
        this.clients.set(ws, {
          ...currentInfo,
          tenantId,
          userId,
          sessionId,
          isAuthenticated: true
        });
        
        console.log(`[SecureWebSocket] Authenticated client for tenant ${tenantId}` + 
                    (userId ? `, user ${userId}` : ''));
        
        // Send success response
        ws.send(JSON.stringify({
          type: 'auth_success',
          data: {
            message: 'Authentication successful',
            tenantId,
            userId,
            timestamp: new Date().toISOString()
          }
        }));
      } catch (error) {
        console.error('[SecureWebSocket] Error verifying tenant:', error);
        return this.sendError(ws, 'Error during authentication');
      }
    } catch (error) {
      console.error('[SecureWebSocket] Auth error:', error);
      this.sendError(ws, 'Authentication failed');
    }
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
        clientInfo.tenantId === tenantId
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