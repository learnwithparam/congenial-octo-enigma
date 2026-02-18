import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('GET /api/categories', () => {
  it('should return a list of categories', async () => {
    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBe(3);
  });

  it('should include category names', async () => {
    const res = await request(app).get('/api/categories');

    const names = res.body.data.map((c: any) => c.name);
    expect(names).toContain('AI/ML');
    expect(names).toContain('DevTools');
    expect(names).toContain('SaaS');
  });
});

describe('GET /api/categories/:id', () => {
  it('should return a single category', async () => {
    const res = await request(app).get('/api/categories/1');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(1);
    expect(res.body.data.name).toBe('AI/ML');
  });

  it('should return 404 for non-existent category', async () => {
    const res = await request(app).get('/api/categories/999');

    expect(res.status).toBe(404);
  });
});
