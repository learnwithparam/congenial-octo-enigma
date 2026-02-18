import Database from 'better-sqlite3';
import { beforeAll, afterAll } from 'vitest';
import { setDb } from '../src/db/index.js';

// Create an in-memory database for testing
const testDb = new Database(':memory:');

beforeAll(() => {
  // Inject the test database into the app
  setDb(testDb);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS startups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      tagline TEXT NOT NULL,
      description TEXT NOT NULL,
      url TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id),
      upvotes INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed test data
  testDb.exec(`
    INSERT INTO categories (name, description) VALUES
      ('AI/ML', 'Artificial Intelligence and Machine Learning'),
      ('DevTools', 'Developer Tools and Infrastructure'),
      ('SaaS', 'Software as a Service');

    INSERT INTO startups (name, tagline, description, url, category_id, upvotes) VALUES
      ('TechFlow AI', 'AI-powered workflow automation for modern teams', 'TechFlow AI is a platform that uses artificial intelligence to automate repetitive workflows across your organization.', 'https://techflow.ai', 1, 42),
      ('CodeBuddy', 'Your AI pair programmer that actually understands context and intent', 'CodeBuddy is an AI coding assistant that integrates with your IDE and understands your entire codebase for better suggestions.', 'https://codebuddy.dev', 1, 28),
      ('ShipFast', 'Deploy to production in under sixty seconds with zero configuration', 'ShipFast handles building, testing, and deploying your application automatically. Just push to main and it handles the rest.', 'https://shipfast.io', 2, 15),
      ('DataPipe', 'Real-time data pipelines without writing any infrastructure code', 'DataPipe lets you build data pipelines visually. Connect sources, transform data, and route it to destinations without code.', 'https://datapipe.com', 2, 33),
      ('MetricHub', 'Product analytics that developers actually want to use every day', 'MetricHub provides simple and powerful product analytics with a developer-first approach and SQL-based querying interface.', 'https://metrichub.io', 3, 19);
  `);
});

afterAll(() => {
  testDb.close();
});

export { testDb };
