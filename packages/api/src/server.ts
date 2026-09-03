import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { firebaseAuth } from './utils/firebase';

import { menuRouter } from './routes/menu';
import { ordersRouter } from './routes/orders';
import { paymentsRouter } from './routes/payments';
import { addressesRouter } from './routes/addresses';
import { usersRouter } from './routes/users';
import { branchesRouter } from './routes/branches';
import { analyticsRouter } from './routes/analytics';
import { messagesRouter } from './routes/messages';
import { promotionsRouter } from './routes/promotions';
import { loyaltyRouter } from './routes/loyalty';

const app = express();
const server = http.createServer(app);

// Socket.IO powers the admin dashboard's live order queue (new orders,
// status changes) and per-customer order-tracking updates. Exported so route
// handlers can emit into it directly after a DB write.
export const io = new SocketIOServer(server, {
  cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? '*' },
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Missing auth token'));
    const decoded = await firebaseAuth.verifyIdToken(token);
    (socket.data as any).uid = decoded.uid;
    (socket.data as any).role = socket.handshake.auth?.role; // set by client after fetching /users/me
    next();
  } catch {
    next(new Error('Invalid auth token'));
  }
});

io.on('connection', (socket) => {
  const { role, uid } = socket.data as any;
  if (role === 'staff' || role === 'owner') socket.join('admin');
  if (uid) socket.join(`user:${uid}`);
});

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*' }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

// Without this the root path returns Express's bare "Cannot GET /", which
// reads as a broken deployment to anyone checking the URL in a browser.
app.get('/', (_req, res) =>
  res.json({
    service: 'Rihat Alsham API',
    nameAr: 'ريحة الشام',
    status: 'running',
    endpoints: ['/health', '/api/menu', '/api/branches', '/api/promotions'],
  })
);

// Dish photography, cropped from the restaurant's own printed menu. Served by
// the API so images can be added or replaced without shipping a new app build.
app.use(
  '/images',
  express.static(path.join(__dirname, '../public'), {
    maxAge: '7d',
    immutable: false,
  })
);

app.use('/api/menu', menuRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/addresses', addressesRouter);
app.use('/api/users', usersRouter);
app.use('/api/branches', branchesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/orders/:orderId/messages', messagesRouter);
app.use('/api/promotions', promotionsRouter);
app.use('/api/loyalty', loyaltyRouter);

// Centralized error handler — never leak stack traces to clients.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: 'Internal server error' });
});

const port = Number(process.env.PORT ?? 4000);
server.listen(port, () => console.log(`Rihat Alsham API listening on :${port}`));
