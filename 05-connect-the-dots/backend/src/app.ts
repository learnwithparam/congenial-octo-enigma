import express from 'express';
import cors from 'cors';
import startupsRouter from './routes/startups.js';
import categoriesRouter from './routes/categories.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/startups', startupsRouter);
app.use('/api/categories', categoriesRouter);

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
);

export default app;
