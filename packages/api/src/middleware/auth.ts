import { Request, Response, NextFunction } from 'express';
import { firebaseAuth } from '../utils/firebase';
import { pool } from '../db/pool';

export interface AuthedRequest extends Request {
  user?: {
    id: string;
    role: 'customer' | 'staff' | 'owner';
    phone: string;
    phoneVerified: boolean;
  };
}

/**
 * Verifies the Firebase ID token on every request and resolves it to our own
 * `users` row (creating one on first sign-in). This is the only place identity
 * is trusted — nothing downstream should re-derive the user from client input.
 */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }
    const idToken = header.slice('Bearer '.length);
    const decoded = await firebaseAuth.verifyIdToken(idToken);

    const phone = decoded.phone_number ?? null;
    const provider = decoded.firebase.sign_in_provider.includes('google')
      ? 'google'
      : decoded.firebase.sign_in_provider.includes('facebook')
      ? 'facebook'
      : decoded.firebase.sign_in_provider.includes('apple')
      ? 'apple'
      : 'phone';

    // Firebase UID is the account identity. Never overwrite another account's
    // UID on a phone conflict; social accounts without a phone must stay distinct.
    const client = await pool.connect();
    let user;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [decoded.uid]);
      const existing = await client.query(
        'SELECT id FROM users WHERE provider_uid = $1 FOR UPDATE', [decoded.uid]
      );
      let id = existing.rows[0]?.id;
      if (!id && phone) {
        // Claim a pre-created staff/customer row only if it has no Firebase UID.
        const claimed = await client.query(
          `UPDATE users SET provider_uid = $1 WHERE phone = $2 AND provider_uid IS NULL RETURNING id`,
          [decoded.uid, phone]
        );
        id = claimed.rows[0]?.id;
      }
      const { rows } = id
        ? await client.query(
            `UPDATE users SET phone = $2, phone_verified = $3,
             email = COALESCE($4, email), updated_at = now()
             WHERE id = $1 RETURNING id, role, phone, phone_verified`,
            [id, phone, !!phone, decoded.email ?? null]
          )
        : await client.query(
            `INSERT INTO users (phone, phone_verified, auth_provider, provider_uid, email)
             VALUES ($1, $2, $3, $4, $5) RETURNING id, role, phone, phone_verified`,
            [phone, !!phone, provider, decoded.uid, decoded.email ?? null]
          );
      user = rows[0];
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    req.user = {
      id: user.id,
      role: user.role,
      phone: user.phone ?? '',
      phoneVerified: user.phone_verified,
    };
    next();
  } catch (err) {
    console.error('Auth verification failed', err);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Blocks the request unless the caller has a verified phone on file — required before placing an order. */
export function requireVerifiedPhone(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user?.phoneVerified) {
    return res.status(403).json({ error: 'Verified phone number required', code: 'PHONE_REQUIRED' });
  }
  next();
}

export function requireRole(...roles: Array<'staff' | 'owner'>) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role as 'staff' | 'owner')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
