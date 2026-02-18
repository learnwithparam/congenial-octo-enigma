import { Router } from 'express';
import { db } from '../db/index.js';

const router = Router();

router.get('/', (_req, res) => {
  const categories = db.prepare('SELECT * FROM categories').all();
  res.json(categories);
});

router.get('/:id', (req, res) => {
  const category = db
    .prepare('SELECT * FROM categories WHERE id = ?')
    .get(req.params.id);

  if (!category) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }

  res.json(category);
});

export default router;
