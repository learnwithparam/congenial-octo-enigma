import Database from 'better-sqlite3';

const db = new Database('launchpad.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
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
    logo_url TEXT,
    upvotes INTEGER DEFAULT 0,
    launch_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed if empty
const count = db
  .prepare('SELECT COUNT(*) as count FROM categories')
  .get() as { count: number };

if (count.count === 0) {
  const insertCategory = db.prepare(
    'INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)'
  );
  const categories = [
    ['AI/ML', 'ai-ml', 'Artificial Intelligence and Machine Learning'],
    ['DevTools', 'devtools', 'Developer Tools and Infrastructure'],
    ['SaaS', 'saas', 'Software as a Service'],
    ['FinTech', 'fintech', 'Financial Technology'],
    ['HealthTech', 'healthtech', 'Healthcare Technology'],
    ['CleanTech', 'cleantech', 'Clean and Sustainable Technology'],
    ['EdTech', 'edtech', 'Education Technology'],
    [
      'Cloud Infrastructure',
      'cloud-infrastructure',
      'Cloud Computing and Infrastructure',
    ],
  ];
  for (const [name, slug, description] of categories) {
    insertCategory.run(name, slug, description);
  }

  const insertStartup = db.prepare(
    'INSERT INTO startups (name, tagline, description, url, category_id, upvotes) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const startups = [
    [
      'TechFlow AI',
      'AI-powered workflow automation for modern teams',
      'TechFlow AI is a platform that uses artificial intelligence to automate repetitive workflows across your organization.',
      'https://techflow.ai',
      1,
      42,
    ],
    [
      'CodeBuddy',
      'Your AI pair programmer that actually understands context and intent',
      'CodeBuddy is an AI coding assistant that integrates with your IDE and understands your entire codebase for better suggestions.',
      'https://codebuddy.dev',
      1,
      28,
    ],
    [
      'ShipFast',
      'Deploy to production in under sixty seconds with zero configuration',
      'ShipFast handles building, testing, and deploying your application automatically. Just push to main and it handles the rest.',
      'https://shipfast.io',
      2,
      15,
    ],
    [
      'DataPipe',
      'Real-time data pipelines without writing any infrastructure code',
      'DataPipe lets you build data pipelines visually. Connect sources, transform data, and route it to destinations without code.',
      'https://datapipe.com',
      2,
      33,
    ],
    [
      'MetricHub',
      'Product analytics that developers actually want to use every day',
      'MetricHub provides simple and powerful product analytics with a developer-first approach and SQL-based querying interface.',
      'https://metrichub.io',
      3,
      19,
    ],
    [
      'PayBridge',
      'Cross-border payment infrastructure for emerging markets',
      'PayBridge simplifies international payments with local payment method support and regulatory compliance.',
      'https://paybridge.finance',
      4,
      25,
    ],
    [
      'MediSync',
      'Real-time patient data synchronization across hospital systems',
      'MediSync connects disparate hospital systems to provide a unified view of patient data, reducing errors and improving care.',
      'https://medisync.health',
      5,
      31,
    ],
    [
      'GreenRoute',
      'Sustainable logistics optimization for last-mile delivery',
      'GreenRoute uses AI to optimize delivery routes, reducing carbon emissions while improving delivery speed.',
      'https://greenroute.eco',
      6,
      22,
    ],
  ];
  for (const s of startups) {
    insertStartup.run(...s);
  }
}

export { db };
