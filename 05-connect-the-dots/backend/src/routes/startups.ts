import { Router } from 'express';
import { db } from '../db/index.js';

const router = Router();

// GET /api/startups
router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(req.query.limit as string) || 10)
  );
  const category = req.query.category as string | undefined;
  const search = req.query.search as string | undefined;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (category) {
    conditions.push('c.slug = ?');
    params.push(category);
  }

  if (search) {
    conditions.push('(s.name LIKE ? OR s.tagline LIKE ?)');
    params.push('%' + search + '%', '%' + search + '%');
  }

  const where =
    conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const countResult = db
    .prepare(
      'SELECT COUNT(*) as total FROM startups s LEFT JOIN categories c ON s.category_id = c.id ' +
        where
    )
    .get(...params) as { total: number };

  const offset = (page - 1) * limit;
  const startups = db
    .prepare(
      'SELECT s.*, c.name as category_name FROM startups s LEFT JOIN categories c ON s.category_id = c.id ' +
        where +
        ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?'
    )
    .all(...params, limit, offset);

  res.json({
    data: startups,
    pagination: {
      page,
      limit,
      total: countResult.total,
      totalPages: Math.ceil(countResult.total / limit),
    },
  });
});

// GET /api/startups/:id
router.get('/:id', (req, res) => {
  const startup = db
    .prepare(
      'SELECT s.*, c.name as category_name FROM startups s LEFT JOIN categories c ON s.category_id = c.id WHERE s.id = ?'
    )
    .get(req.params.id);

  if (!startup) {
    res.status(404).json({ error: 'Startup not found' });
    return;
  }

  res.json({ data: startup });
});

// POST /api/startups
router.post('/', (req, res) => {
  const { name, tagline, description, url, category_id, logo_url } = req.body;

  if (!name || !tagline || !description || !url || !category_id) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const result = db
    .prepare(
      'INSERT INTO startups (name, tagline, description, url, category_id, logo_url) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(name, tagline, description, url, category_id, logo_url || null);

  const startup = db
    .prepare('SELECT * FROM startups WHERE id = ?')
    .get(result.lastInsertRowid);
  res.status(201).json({ data: startup });
});

// PUT /api/startups/:id
router.put('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM startups WHERE id = ?')
    .get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Startup not found' });
    return;
  }

  const fields = req.body;
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (
      ['name', 'tagline', 'description', 'url', 'category_id', 'logo_url'].includes(key)
    ) {
      updates.push(key + ' = ?');
      values.push(value);
    }
  }

  if (updates.length > 0) {
    values.push(req.params.id);
    db.prepare(
      'UPDATE startups SET ' +
        updates.join(', ') +
        ', updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(...values);
  }

  const startup = db
    .prepare('SELECT * FROM startups WHERE id = ?')
    .get(req.params.id);
  res.json({ data: startup });
});

// DELETE /api/startups/:id
router.delete('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM startups WHERE id = ?')
    .get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Startup not found' });
    return;
  }

  db.prepare('DELETE FROM startups WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// POST /api/startups/:id/upvote
router.post('/:id/upvote', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM startups WHERE id = ?')
    .get(req.params.id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Startup not found' });
    return;
  }

  db.prepare('UPDATE startups SET upvotes = upvotes + 1 WHERE id = ?').run(
    req.params.id
  );
  res.json({ upvotes: existing.upvotes + 1 });
});

export default router;
