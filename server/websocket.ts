import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'url';
import session from 'express-session';
import passport from 'passport';
import connectPgSimple from 'connect-pg-simple';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { users } from '../shared/schema';

const PgSession = connectPgSimple(session);

// Store for active WebSocket connections mapped by user ID
const activeConnections = new Map<string, Set<WebSocket>>();

// Session store configuration (must match auth.ts)
const sessionStore = new PgSession({
  conString: process.env.DATABASE_URL,
  tableName: 'sessions',  // Must match auth.ts
  createTableIfMissing: false,
  ttl: 7 * 24 * 60 * 60 * 1000, // 1 week - match auth.ts
});

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET!,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week - match auth.ts
  },
});

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    noServer: true,
    path: '/ws',
  });

  // Handle WebSocket upgrade
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url || '');
    
    if (pathname === '/ws') {
      // Parse cookies from the upgrade request
      const cookies = request.headers.cookie;
      
      if (!cookies) {
        console.log('WebSocket: No cookies found');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Create proper request/response objects for session middleware
      const req = request as any;
      
      // Create a minimal response object that session middleware needs
      const res: any = {
        getHeader: () => {},
        setHeader: () => {},
        end: () => {},
        writeHead: () => {},
      };
      
      // Process session
      sessionMiddleware(req, res, (err: any) => {
        if (err) {
          console.log('WebSocket: Session middleware error:', err);
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        // Initialize passport
        passport.initialize()(req, res, (err: any) => {
          if (err) {
            console.log('WebSocket: Passport init error:', err);
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }

          // Load user from session
          passport.session()(req, res, (err: any) => {
            if (err) {
              console.log('WebSocket: Passport session error:', err);
              socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
              socket.destroy();
              return;
            }

            if (!req.user || !req.user.id) {
              console.log('WebSocket: No authenticated user found');
              socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
              socket.destroy();
              return;
            }

            console.log(`WebSocket upgrade authenticated: user ${req.user.id}`);
            wss.handleUpgrade(request, socket, head, (ws) => {
              wss.emit('connection', ws, request);
            });
          });
        });
      });
    } else {
      socket.destroy();
    }
  });

  // Handle new WebSocket connections
  wss.on('connection', (ws: WebSocket, request: any) => {
    const userId = request.user?.id;
    
    if (!userId) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    console.log(`WebSocket connected: user ${userId}`);

    // Add connection to active connections
    if (!activeConnections.has(userId)) {
      activeConnections.set(userId, new Set());
    }
    activeConnections.get(userId)!.add(ws);

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      userId,
      timestamp: new Date().toISOString(),
    }));

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        handleWebSocketMessage(ws, userId, message);
      } catch (error) {
        console.error('WebSocket message parse error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        }));
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      console.log(`WebSocket disconnected: user ${userId}`);
      const userConnections = activeConnections.get(userId);
      if (userConnections) {
        userConnections.delete(ws);
        if (userConnections.size === 0) {
          activeConnections.delete(userId);
        }
      }
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
    });
  });

  return wss;
}

function handleWebSocketMessage(ws: WebSocket, userId: string, message: any) {
  console.log(`WebSocket message from ${userId}:`, message.type);

  switch (message.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
    
    case 'subscribe':
      // Client subscribing to specific channels
      // We'll handle this when we implement specific event types
      ws.send(JSON.stringify({ 
        type: 'subscribed',
        channel: message.channel,
      }));
      break;

    default:
      console.log('Unknown message type:', message.type);
  }
}

// Broadcast message to specific user(s)
export function broadcastToUser(userId: string, message: any) {
  const connections = activeConnections.get(userId);
  if (connections) {
    const payload = JSON.stringify(message);
    connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  }
}

// Broadcast to multiple users
export function broadcastToUsers(userIds: string[], message: any) {
  userIds.forEach(userId => broadcastToUser(userId, message));
}

// Get active connection count for a user
export function getUserConnectionCount(userId: string): number {
  return activeConnections.get(userId)?.size || 0;
}

// Check if user is online
export function isUserOnline(userId: string): boolean {
  return activeConnections.has(userId);
}
