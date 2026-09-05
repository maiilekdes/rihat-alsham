import 'dotenv/config';
import express from 'express';
import { pool } from './db/pool';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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

    // The role must come from our own database, never from the handshake.
    // Anything the client sends is a claim, not a fact: trusting it would let
    // any signed-in customer join the `admin` room and receive every order,
    // with the customer's name, phone and address, in real time.
    const { rows } = await pool.query(
      `SELECT id, role FROM users WHERE provider_uid = $1`,
      [decoded.uid]
    );
    if (rows.length === 0) return next(new Error('Unknown user'));

    (socket.data as any).uid = decoded.uid;
    (socket.data as any).userId = rows[0].id;
    (socket.data as any).role = rows[0].role;
    next();
  } catch {
    next(new Error('Invalid auth token'));
  }
});

io.on('connection', (socket) => {
  const { role, userId } = socket.data as any;
  if (role === 'staff' || role === 'owner') socket.join('admin');
  if (userId) socket.join(`user:${userId}`);
});

app.use(helmet());

// The API is public on the internet. Without a ceiling, a single client can
// scrape the menu in a loop or hammer order creation, and Railway bills for it.
// Trust Railway's proxy so limits key off the real client IP, not the router's.
app.set('trust proxy', 1);

app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 240,               // generous for normal browsing (menu + images)
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests, please slow down.' },
  })
);

// Anything that creates records or moves money gets a much tighter ceiling.
const writeLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
  // Never throttle Moyasar's payment callback: dropping one loses a real
  // payment's confirmation, and it is already safe — it ignores the caller and
  // re-fetches the payment from Moyasar before changing anything.
  skip: (req) => req.path === '/callback',
});
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
app.use('/api/orders', writeLimiter, ordersRouter);
app.use('/api/payments', writeLimiter, paymentsRouter);
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
