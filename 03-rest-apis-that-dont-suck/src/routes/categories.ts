import { Router } from 'express';
import { db } from '../db/index.js';

const router = Router();

router.get('/', (_req, res) => {
  const categories = db.prepare('SELECT * FROM categories').all();
  res.json({ data: categories });
});

router.get('/:id', (req, res) => {
  const id = String(req.params.id);
  const category = db
    .prepare('SELECT * FROM categories WHERE id = ?')
    .get(id);

  if (!category) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }

  res.json({ data: category });
});

export default router;
