import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import { io as connectClient, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { Role } from '../src/generated/prisma/enums.js';
import { closeSocket, initSocket } from '../src/sockets/index.js';
import { api } from './helpers/auth.js';
import { sleep } from './helpers/db.js';
import { createUser, makeNotification, makeProject, type TestUser } from './helpers/factories.js';

let server: Server;
let url: string;
const openSockets: Socket[] = [];

// A real HTTP server with Socket.IO attached, on a random free port.
beforeAll(async () => {
  server = createServer(createApp());
  initSocket(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(() => {
  for (const socket of openSockets.splice(0)) socket.disconnect();
});
// Closes every socket and the HTTP server.
afterAll(() => closeSocket());

function connect(token?: string) {
  const socket = connectClient(url, {
    auth: token ? { token } : {},
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
  });
  openSockets.push(socket);
  return socket;
}

const connected = (socket: Socket) =>
  new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });

function nextEvent<T>(socket: Socket, event: string, timeoutMs = 3000) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`No "${event}" within ${timeoutMs} ms`)),
      timeoutMs,
    );
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Records every event of this name, to prove that none arrived. */
function record(socket: Socket, event: string) {
  const received: unknown[] = [];
  socket.on(event, (payload: unknown) => received.push(payload));
  return received;
}

let manager: TestUser;
let alice: TestUser;
let bob: TestUser;
let project: Awaited<ReturnType<typeof makeProject>>;

beforeEach(async () => {
  [manager, alice, bob] = await Promise.all([
    createUser({ role: Role.MANAGER }),
    createUser({ name: 'Alice' }),
    createUser({ name: 'Bob' }),
  ]);
  project = await makeProject({ manager, members: [alice, bob] });
});

const assignTaskTo = (user: TestUser) =>
  api(manager.token)
    .post('/api/work-items')
    .send({
      type: 'TASK',
      title: `For ${user.name}`,
      description: 'x',
      projectId: project.id,
      assigneeId: user.id,
    })
    .expect(201);

describe('socket authentication', () => {
  it('rejects a connection without a token', async () => {
    await expect(connected(connect())).rejects.toThrow('UNAUTHENTICATED');
  });

  it('rejects a bad token', async () => {
    await expect(connected(connect('not-a-token'))).rejects.toThrow('UNAUTHENTICATED');
  });

  it('rejects an expired token', async () => {
    const expired = jwt.sign(
      { sub: alice.id, exp: Math.floor(Date.now() / 1000) - 10 },
      env.JWT_SECRET,
    );
    await expect(connected(connect(expired))).rejects.toThrow('UNAUTHENTICATED');
  });

  it('rejects the token of a deleted user', async () => {
    await prisma.user.delete({ where: { id: bob.id } });
    await expect(connected(connect(bob.token))).rejects.toThrow('UNAUTHENTICATED');
  });

  it('closes the socket when the token expires', async () => {
    const shortLived = jwt.sign(
      { sub: alice.id, exp: Math.floor(Date.now() / 1000) + 2 },
      env.JWT_SECRET,
    );
    const socket = connect(shortLived);
    await connected(socket);

    const reason = await nextEvent<string>(socket, 'disconnect', 5000);
    expect(reason).toBe('io server disconnect');
  });
});

describe('real-time delivery', () => {
  it('sends the unread count on connect', async () => {
    await makeNotification({ user: alice });
    await makeNotification({ user: alice });
    const socket = connect(alice.token);

    await expect(nextEvent(socket, 'notification:count')).resolves.toEqual({ unreadCount: 2 });
  });

  it('pushes notification:new with the unread count after an assignment', async () => {
    const socket = connect(alice.token);
    await connected(socket);
    const incoming = nextEvent<{ notification: Record<string, unknown>; unreadCount: number }>(
      socket,
      'notification:new',
    );

    const res = await assignTaskTo(alice);

    const payload = await incoming;
    expect(payload.unreadCount).toBe(1);
    expect(payload.notification).toMatchObject({
      type: 'ASSIGNED',
      workItemId: res.body.data.id,
      isRead: false,
      message: `${manager.name} assigned you "For Alice"`,
    });
  });

  it('delivers only to the recipient (per-user rooms)', async () => {
    const aliceSocket = connect(alice.token);
    const bobSocket = connect(bob.token);
    await Promise.all([connected(aliceSocket), connected(bobSocket)]);
    const bobReceived = record(bobSocket, 'notification:new');
    const aliceGot = nextEvent(aliceSocket, 'notification:new');

    await assignTaskTo(alice);
    await aliceGot;
    await sleep(300); // give a wrongly routed event time to arrive

    expect(bobReceived).toEqual([]);
  });

  it("reaches every one of the user's tabs", async () => {
    const tabs = [connect(alice.token), connect(alice.token)];
    await Promise.all(tabs.map(connected));
    const both = Promise.all(tabs.map((tab) => nextEvent(tab, 'notification:new')));

    await assignTaskTo(alice);
    await expect(both).resolves.toHaveLength(2);
  });

  it('syncs read state to the user’s other tabs', async () => {
    const notification = await makeNotification({ user: alice });
    const socket = connect(alice.token);
    await connected(socket);
    const update = nextEvent(socket, 'notification:updated');

    await api(alice.token).patch(`/api/notifications/${notification.id}/read`).expect(200);

    await expect(update).resolves.toEqual({ ids: [notification.id], unreadCount: 0 });
  });
});
