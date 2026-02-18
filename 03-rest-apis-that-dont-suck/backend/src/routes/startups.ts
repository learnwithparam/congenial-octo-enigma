import { Router } from 'express';
import { db } from '../db/index.js';
import { validate, validateQuery } from '../middleware/validate.js';
import {
  createStartupSchema,
  updateStartupSchema,
  listStartupsSchema,
} from '../schemas/startup.js';
import type { ListStartupsQuery } from '../schemas/startup.js';
import { NotFoundError } from '../errors.js';

const router = Router();

// GET /api/startups -- List startups with pagination, sorting, and filtering
router.get('/', validateQuery(listStartupsSchema), (req, res) => {
  const query = (req as any).validatedQuery as ListStartupsQuery;
  const { page, limit, sort, order, category, search } = query;

  // Build WHERE clauses dynamically
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (category) {
    conditions.push('s.category_id = ?');
    params.push(category);
  }

  if (search) {
    conditions.push('(s.name LIKE ? OR s.tagline LIKE ?)');
    const searchPattern = '%' + search + '%';
    params.push(searchPattern, searchPattern);
  }

  const whereClause =
    conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  // Count total matching rows (before pagination)
  const countQuery = 'SELECT COUNT(*) as total FROM startups s ' + whereClause;
  const countResult = db.prepare(countQuery).get(...params) as {
    total: number;
  };
  const total = countResult.total;

  // Build the data query with sorting and pagination
  const offset = (page - 1) * limit;
  const dataQuery =
    'SELECT s.*, c.name as category_name ' +
    'FROM startups s ' +
    'LEFT JOIN categories c ON s.category_id = c.id ' +
    whereClause + ' ' +
    'ORDER BY s.' + sort + ' ' + order.toUpperCase() + ' ' +
    'LIMIT ? OFFSET ?';

  const dataParams = [...params, limit, offset];
  const startups = db.prepare(dataQuery).all(...dataParams);

  const totalPages = Math.ceil(total / limit);

  res.json({
    data: startups,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
});

// GET /api/startups/:id -- Get a single startup
router.get('/:id', (req, res) => {
  const id = String(req.params.id);
  const startup = db
    .prepare(
      'SELECT s.*, c.name as category_name ' +
      'FROM startups s ' +
      'LEFT JOIN categories c ON s.category_id = c.id ' +
      'WHERE s.id = ?'
    )
    .get(id);

  if (!startup) {
    throw new NotFoundError('Startup', id);
  }

  res.json({ data: startup });
});

// POST /api/startups -- Create a new startup
router.post('/', validate(createStartupSchema), (req, res) => {
  const { name, tagline, description, url, category_id } = req.body;

  const result = db
    .prepare(
      'INSERT INTO startups (name, tagline, description, url, category_id) VALUES (?, ?, ?, ?, ?)'
    )
    .run(name, tagline, description, url, category_id);

  const startup = db
    .prepare('SELECT * FROM startups WHERE id = ?')
    .get(result.lastInsertRowid);

  res.status(201).json({ data: startup });
});

// PUT /api/startups/:id -- Update a startup
router.put('/:id', validate(updateStartupSchema), (req, res) => {
  const id = String(req.params.id);
  const existing = db
    .prepare('SELECT * FROM startups WHERE id = ?')
    .get(id);

  if (!existing) {
    throw new NotFoundError('Startup', id);
  }

  const fields = req.body;
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    updates.push(key + ' = ?');
    values.push(value);
  }

  if (updates.length > 0) {
    values.push(id);
    db.prepare(
      'UPDATE startups SET ' + updates.join(', ') + ', updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(...values);
  }

  const startup = db
    .prepare('SELECT * FROM startups WHERE id = ?')
    .get(id);

  res.json({ data: startup });
});

// DELETE /api/startups/:id -- Delete a startup
router.delete('/:id', (req, res) => {
  const id = String(req.params.id);
  const existing = db
    .prepare('SELECT * FROM startups WHERE id = ?')
    .get(id);

  if (!existing) {
    throw new NotFoundError('Startup', id);
  }

  db.prepare('DELETE FROM startups WHERE id = ?').run(id);
  res.status(204).send();
});

export default router;
