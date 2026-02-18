import express from 'express';
import cors from 'cors';
import startupsRouter from './routes/startups.js';
import categoriesRouter from './routes/categories.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/startups', startupsRouter);
app.use('/api/categories', categoriesRouter);

// Global error handler -- must be last
app.use(errorHandler);

export default app;
