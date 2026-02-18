import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('GET /api/startups', () => {
  it('should return a list of startups', async () => {
    const res = await request(app).get('/api/startups');

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('should include pagination metadata', async () => {
    const res = await request(app).get('/api/startups');

    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(10);
    expect(res.body.pagination.total).toBeGreaterThan(0);
    expect(res.body.pagination.totalPages).toBeGreaterThan(0);
  });

  it('should respect the limit parameter', async () => {
    const res = await request(app).get('/api/startups?limit=2');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.pagination.limit).toBe(2);
  });

  it('should respect the page parameter', async () => {
    const page1 = await request(app).get('/api/startups?limit=2&page=1');
    const page2 = await request(app).get('/api/startups?limit=2&page=2');

    expect(page1.body.data[0].id).not.toBe(page2.body.data[0]?.id);
  });

  it('should return empty data for a page beyond results', async () => {
    const res = await request(app).get('/api/startups?page=999');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBeGreaterThan(0);
  });

  it('should sort by name ascending', async () => {
    const res = await request(app).get(
      '/api/startups?sort=name&order=asc'
    );

    const names = res.body.data.map((s: any) => s.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it('should sort by name descending', async () => {
    const res = await request(app).get(
      '/api/startups?sort=name&order=desc'
    );

    const names = res.body.data.map((s: any) => s.name);
    const sorted = [...names].sort().reverse();
    expect(names).toEqual(sorted);
  });

  it('should filter by category', async () => {
    const res = await request(app).get('/api/startups?category=1');

    expect(res.status).toBe(200);
    res.body.data.forEach((startup: any) => {
      expect(startup.category_id).toBe(1);
    });
  });

  it('should search by name', async () => {
    const res = await request(app).get('/api/startups?search=TechFlow');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name).toContain('TechFlow');
  });

  it('should search by tagline', async () => {
    const res = await request(app).get('/api/startups?search=workflow');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('should return 400 for invalid page', async () => {
    const res = await request(app).get('/api/startups?page=-1');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('should return 400 for invalid sort field', async () => {
    const res = await request(app).get('/api/startups?sort=password');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('should return 400 for limit exceeding maximum', async () => {
    const res = await request(app).get('/api/startups?limit=101');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });
});

describe('GET /api/startups/:id', () => {
  it('should return a single startup', async () => {
    const res = await request(app).get('/api/startups/1');

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.id).toBe(1);
    expect(res.body.data.name).toBe('TechFlow AI');
  });

  it('should include the category name', async () => {
    const res = await request(app).get('/api/startups/1');

    expect(res.body.data.category_name).toBeDefined();
  });

  it('should return 404 for non-existent startup', async () => {
    const res = await request(app).get('/api/startups/99999');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('not found');
  });
});

describe('POST /api/startups', () => {
  const validStartup = {
    name: 'NewStartup',
    tagline: 'A brand new startup with an exciting tagline',
    description:
      'This is a long enough description that passes the fifty character minimum requirement for the Zod validation schema we defined.',
    url: 'https://newstartup.com',
    category_id: 1,
  };

  it('should create a new startup', async () => {
    const res = await request(app)
      .post('/api/startups')
      .send(validStartup);

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('NewStartup');
    expect(res.body.data.id).toBeDefined();
  });

  it('should return 400 when body is empty', async () => {
    const res = await request(app)
      .post('/api/startups')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details).toBeInstanceOf(Array);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('should return field-level errors for invalid data', async () => {
    const res = await request(app)
      .post('/api/startups')
      .send({
        name: 'X',
        tagline: 'short',
        description: 'short',
        url: 'not-a-url',
        category_id: -1,
      });

    expect(res.status).toBe(400);

    const fields = res.body.details.map((d: any) => d.field);
    expect(fields).toContain('name');
    expect(fields).toContain('tagline');
    expect(fields).toContain('description');
    expect(fields).toContain('url');
    expect(fields).toContain('category_id');
  });

  it('should return error when name is missing', async () => {
    const { name, ...withoutName } = validStartup;
    const res = await request(app)
      .post('/api/startups')
      .send(withoutName);

    expect(res.status).toBe(400);
    const nameError = res.body.details.find((d: any) => d.field === 'name');
    expect(nameError).toBeDefined();
  });

  it('should trim whitespace from string fields', async () => {
    const res = await request(app)
      .post('/api/startups')
      .send({
        ...validStartup,
        name: '  SpacedName  ',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('SpacedName');
  });
});

describe('PUT /api/startups/:id', () => {
  it('should update an existing startup', async () => {
    const res = await request(app)
      .put('/api/startups/1')
      .send({
        tagline: 'An updated tagline that is long enough to pass validation',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.tagline).toBe(
      'An updated tagline that is long enough to pass validation'
    );
  });

  it('should allow partial updates', async () => {
    const before = await request(app).get('/api/startups/1');
    const originalName = before.body.data.name;

    await request(app)
      .put('/api/startups/1')
      .send({
        tagline: 'Only updating the tagline field and nothing else',
      });

    const after = await request(app).get('/api/startups/1');
    expect(after.body.data.name).toBe(originalName);
  });

  it('should return 404 for non-existent startup', async () => {
    const res = await request(app)
      .put('/api/startups/99999')
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
  });

  it('should return 400 for invalid update data', async () => {
    const res = await request(app)
      .put('/api/startups/1')
      .send({ name: 'X' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });
});

describe('DELETE /api/startups/:id', () => {
  it('should delete an existing startup', async () => {
    // First create a startup to delete
    const created = await request(app)
      .post('/api/startups')
      .send({
        name: 'ToDelete',
        tagline: 'This startup will be deleted in the next step',
        description:
          'A temporary startup created specifically for testing the delete endpoint in our integration tests.',
        url: 'https://todelete.com',
        category_id: 1,
      });

    const id = created.body.data.id;

    const res = await request(app).delete('/api/startups/' + id);
    expect(res.status).toBe(204);

    // Verify it is gone
    const verify = await request(app).get('/api/startups/' + id);
    expect(verify.status).toBe(404);
  });

  it('should return 404 for non-existent startup', async () => {
    const res = await request(app).delete('/api/startups/99999');

    expect(res.status).toBe(404);
  });
});

describe('GET /health', () => {
  it('should return ok status', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});
