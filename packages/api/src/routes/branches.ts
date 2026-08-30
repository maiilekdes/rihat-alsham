import { Router } from 'express';
import { pool } from '../db/pool';

export const branchesRouter = Router();

branchesRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query(`SELECT * FROM branches WHERE is_active = TRUE ORDER BY name_en`);
  res.json(rows);
});
