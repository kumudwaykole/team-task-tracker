import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import {
  countUnread,
  type NotificationDto,
} from '../modules/notifications/notifications.repository.js';
import { findAuthUserById } from '../modules/users/users.repository.js';
import type { AuthUser } from '../types/auth.js';
import { verifyToken } from '../utils/jwt.js';

export interface ServerToClientEvents {
  'notification:new': (payload: { notification: NotificationDto; unreadCount: number }) => void;
  'notification:count': (payload: { unreadCount: number }) => void;
  'notification:updated': (payload: { ids: string[] | 'all'; unreadCount: number }) => void;
}

interface SocketData {
  user: AuthUser;
  expiresAt: number;
}

// Clients send nothing over the socket: every mutation goes through REST, where RBAC is enforced.
type ClientToServerEvents = Record<string, never>;

// setTimeout overflows above ~24.8 days.
const MAX_TIMER_MS = 2_000_000_000;

let io: Server<
  ClientToServerEvents,
  ServerToClientEvents,
  ClientToServerEvents,
  SocketData
> | null = null;

const room = (userId: string) => `user:${userId}`;

/** Attaches Socket.IO to the HTTP server (same port as the API). */
export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    serveClient: false,
    maxHttpBufferSize: 1e4,
    cors: { origin: env.CLIENT_URL },
    // Let other upgrade handlers on this server (Vite HMR in development) answer their own requests.
    destroyUpgrade: false,
  });

  // Same token and same checks as REST. Unauthenticated sockets never reach "connection".
  io.use(async (socket, next) => {
    try {
      const token: unknown = socket.handshake.auth['token'];
      if (typeof token !== 'string') throw new Error('missing token');
      const { userId, expiresAt } = verifyToken(token);
      const user = await findAuthUserById(userId);
      if (!user) throw new Error('unknown user');
      socket.data.user = user;
      socket.data.expiresAt = expiresAt;
      next();
    } catch {
      next(new Error('UNAUTHENTICATED'));
    }
  });

  io.on('connection', (socket) => {
    const { user, expiresAt } = socket.data;
    void socket.join(room(user.id));

    // Close the socket when the token expires; the client then reconnects or logs out.
    const timer = setTimeout(
      () => socket.disconnect(true),
      Math.min(Math.max(expiresAt - Date.now(), 0), MAX_TIMER_MS),
    );
    socket.on('disconnect', () => clearTimeout(timer));

    countUnread(user.id)
      .then((unreadCount) => socket.emit('notification:count', { unreadCount }))
      .catch((err: unknown) => console.error('[socket] unread count failed', err));
  });
}

/** Delivers an event to one user's sockets only (every open tab). */
export function emitToUser<E extends keyof ServerToClientEvents>(
  userId: string,
  event: E,
  ...payload: Parameters<ServerToClientEvents[E]>
) {
  io?.to(room(userId)).emit(event, ...payload);
}

/** Disconnects every socket and closes the HTTP server it is attached to. */
export const closeSocket = () =>
  new Promise<void>((resolve) => {
    if (!io) return resolve();
    void io.close(() => resolve());
  });
