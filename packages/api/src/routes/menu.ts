import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { requireAuth, requireRole } from '../middleware/auth';

export const menuRouter = Router();

// Public: full menu, grouped by category. Cache-friendly for the mobile app's offline fallback.
menuRouter.get('/', async (_req, res) => {
  const categories = await pool.query(
    `SELECT id, name_ar, name_en, sort_order FROM categories WHERE is_active = TRUE ORDER BY sort_order`
  );
  const items = await pool.query(
    `SELECT i.*,
       COALESCE(json_agg(DISTINCT jsonb_build_object(
         'id', v.id, 'nameAr', v.name_ar, 'nameEn', v.name_en, 'price', v.price, 'isDefault', v.is_default, 'calories', v.calories
       )) FILTER (WHERE v.id IS NOT NULL), '[]') AS variants,
       COALESCE(json_agg(DISTINCT jsonb_build_object(
         'id', e.id, 'nameAr', e.name_ar, 'nameEn', e.name_en, 'price', e.price, 'isAvailable', e.is_available
       )) FILTER (WHERE e.id IS NOT NULL), '[]') AS extras
     FROM menu_items i
     LEFT JOIN item_variants v ON v.item_id = i.id
     LEFT JOIN item_extras e ON e.item_id = i.id
     GROUP BY i.id
     ORDER BY i.sort_order`
  );

  const byCategory = new Map<string, any[]>();
  for (const item of items.rows) {
    const list = byCategory.get(item.category_id) ?? [];
    list.push({
      id: item.id,
      nameAr: item.name_ar,
      nameEn: item.name_en,
      descriptionAr: item.description_ar,
      descriptionEn: item.description_en,
      basePrice: Number(item.base_price),
      imageUrl: item.image_url,
      spiceLevelMax: item.spice_level_max,
      isAvailable: item.is_available,
      calories: item.calories,
      variants: item.variants,
      extras: item.extras,
    });
    byCategory.set(item.category_id, list);
  }

  res.json(
    categories.rows.map((c) => ({
      id: c.id,
      nameAr: c.name_ar,
      nameEn: c.name_en,
      items: byCategory.get(c.id) ?? [],
    }))
  );
});

const upsertItemSchema = z.object({
  categoryId: z.string().uuid(),
  nameAr: z.string().min(1),
  nameEn: z.string().min(1),
  descriptionAr: z.string().optional(),
  descriptionEn: z.string().optional(),
  basePrice: z.number().positive(),
  imageUrl: z.string().url().optional(),
  spiceLevelMax: z.number().int().min(0).max(5).default(0),
  calories: z.number().int().positive().optional(),
  isAvailable: z.boolean().default(true),
});

// Staff/owner only: create a menu item.
menuRouter.post('/items', requireAuth, requireRole('staff', 'owner'), async (req, res) => {
  const parsed = upsertItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  const { rows } = await pool.query(
    `INSERT INTO menu_items (category_id, name_ar, name_en, description_ar, description_en, base_price, image_url, spice_level_max, calories, is_available)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [d.categoryId, d.nameAr, d.nameEn, d.descriptionAr, d.descriptionEn, d.basePrice, d.imageUrl, d.spiceLevelMax, d.calories ?? null, d.isAvailable]
  );
  res.status(201).json({ id: rows[0].id });
});

menuRouter.patch('/items/:id', requireAuth, requireRole('staff', 'owner'), async (req, res) => {
  const parsed = upsertItemSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  const fields = Object.entries({
    category_id: d.categoryId,
    name_ar: d.nameAr,
    name_en: d.nameEn,
    description_ar: d.descriptionAr,
    description_en: d.descriptionEn,
    base_price: d.basePrice,
    image_url: d.imageUrl,
    spice_level_max: d.spiceLevelMax,
    calories: d.calories,
    is_available: d.isAvailable,
  }).filter(([, v]) => v !== undefined);

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  const setClause = fields.map(([k], i) => `${k} = $${i + 2}`).join(', ');
  await pool.query(`UPDATE menu_items SET ${setClause} WHERE id = $1`, [req.params.id, ...fields.map(([, v]) => v)]);
  res.json({ ok: true });
});

// Quick in-stock/out-of-stock toggle — the most frequent admin action, kept as its own endpoint.
menuRouter.patch('/items/:id/availability', requireAuth, requireRole('staff', 'owner'), async (req, res) => {
  const schema = z.object({ isAvailable: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await pool.query(`UPDATE menu_items SET is_available = $2 WHERE id = $1`, [req.params.id, parsed.data.isAvailable]);
  res.json({ ok: true });
});

menuRouter.delete('/items/:id', requireAuth, requireRole('staff', 'owner'), async (req, res) => {
  await pool.query(`DELETE FROM menu_items WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

menuRouter.post('/categories', requireAuth, requireRole('owner'), async (req, res) => {
  const schema = z.object({ nameAr: z.string().min(1), nameEn: z.string().min(1), sortOrder: z.number().default(0) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { rows } = await pool.query(
    `INSERT INTO categories (name_ar, name_en, sort_order) VALUES ($1,$2,$3) RETURNING id`,
    [parsed.data.nameAr, parsed.data.nameEn, parsed.data.sortOrder]
  );
  res.status(201).json({ id: rows[0].id });
});
