import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Small pool by default; tune for production load.
  max: Number(process.env.PG_POOL_MAX ?? 10),
});

pool.on('error', (err) => {
  // Idle client errors should not crash the process.
  console.error('Unexpected PG pool error', err);
});
