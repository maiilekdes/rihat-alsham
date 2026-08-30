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

    const { rows } = await pool.query(
      `INSERT INTO users (phone, phone_verified, auth_provider, provider_uid, email)
       VALUES (COALESCE($1, ''), $2, $3, $4, $5)
       ON CONFLICT (phone) DO UPDATE SET provider_uid = EXCLUDED.provider_uid
       RETURNING id, role, phone, phone_verified`,
      [phone, !!phone, provider, decoded.uid, decoded.email ?? null]
    );

    // Google/Facebook sign-ins may not carry a phone number yet — in that case
    // we still resolve the user by firebase uid so the "add phone" flow works.
    let user = rows[0];
    if (!phone) {
      const byUid = await pool.query(
        `SELECT id, role, phone, phone_verified FROM users WHERE provider_uid = $1`,
        [decoded.uid]
      );
      user = byUid.rows[0] ?? user;
    }

    req.user = {
      id: user.id,
      role: user.role,
      phone: user.phone,
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
