import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { loadAuthorizedOrder } from './messages';

/**
 * Delivery-chat photo and video storage, served by this API rather than by
 * Firebase Storage.
 *
 * Firebase was the original plan, but Google now requires a billing account for
 * Storage, and its rules can't see our database — so they could only check that
 * *someone* was signed in, not that this customer owns the order they're
 * uploading into. Here that check is the first thing that happens, reusing the
 * same helper the chat itself uses.
 *
 * Files land on a mounted disk (MEDIA_DIR) rather than the container filesystem,
 * which Railway wipes on every deploy.
 *
 * Reads are deliberately NOT authenticated. The filename carries 256 bits of
 * randomness and is only ever handed to the order's participants (the messages
 * endpoint that returns it is authorised), so the URL is the capability — the
 * same model Firebase's own download URLs use. That keeps images renderable by
 * a plain <Image> tag, which cannot attach an Authorization header that stays
 * valid once the ID token behind it expires an hour later.
 */
export const mediaRouter = Router({ mergeParams: true });

export const MEDIA_ROOT = process.env.MEDIA_DIR ?? path.join(__dirname, '../../media');

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

function orderDir(orderId: string) {
  return path.join(MEDIA_ROOT, 'order-chat', orderId);
}

mediaRouter.post('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  const order = await loadAuthorizedOrder(req.params.orderId, req);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const contentType = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  const ext = ALLOWED[contentType];
  if (!ext) return res.status(415).json({ error: 'Unsupported media type' });

  const body = req.body as Buffer;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    return res.status(400).json({ error: 'Empty upload' });
  }
  if (body.length > MAX_BYTES) {
    return res.status(413).json({ error: 'File too large' });
  }

  const fileName = `${crypto.randomBytes(32).toString('hex')}.${ext}`;
  const dir = orderDir(order.id);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, fileName), body);

  res.status(201).json({ mediaUrl: `/api/orders/${order.id}/media/${fileName}` });
});

mediaRouter.get('/:fileName', async (req, res) => {
  // The random filename is the credential, so it must not be able to point
  // anywhere but inside this order's own directory.
  // orderId comes from the parent mount via mergeParams, which the handler's
  // own param type doesn't know about.
  const { orderId, fileName } = req.params as { orderId: string; fileName: string };
  if (!/^[0-9a-f]{64}\.[a-z0-9]{3,4}$/.test(fileName)) {
    return res.status(404).json({ error: 'Not found' });
  }
  if (!/^[0-9a-fA-F-]{36}$/.test(orderId)) {
    return res.status(404).json({ error: 'Not found' });
  }

  const filePath = path.join(orderDir(orderId), fileName);
  if (!filePath.startsWith(path.join(MEDIA_ROOT, 'order-chat') + path.sep)) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.sendFile(filePath, { maxAge: '30d', immutable: true }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'Not found' });
  });
});
