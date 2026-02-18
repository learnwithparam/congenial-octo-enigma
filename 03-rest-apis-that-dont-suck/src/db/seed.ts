import Database from 'better-sqlite3';

const db = new Database('launchpad.db');

function seed(): void {
  console.log('Creating tables...');
  db.exec(`
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

  console.log('Clearing existing data...');
  db.exec('DELETE FROM startups');
  db.exec('DELETE FROM users');
  db.exec('DELETE FROM categories');

  console.log('Seeding categories...');
  const insertCategory = db.prepare(
    'INSERT INTO categories (name, description) VALUES (?, ?)'
  );

  const categories = [
    ['AI/ML', 'Artificial Intelligence and Machine Learning'],
    ['DevTools', 'Developer Tools and Infrastructure'],
    ['SaaS', 'Software as a Service'],
    ['FinTech', 'Financial Technology'],
    ['HealthTech', 'Healthcare Technology'],
    ['CleanTech', 'Clean and Sustainable Technology'],
    ['EdTech', 'Education Technology'],
    ['Cloud Infrastructure', 'Cloud Computing and Infrastructure'],
  ];

  for (const [name, description] of categories) {
    insertCategory.run(name, description);
  }

  console.log('Seeding users...');
  const insertUser = db.prepare(
    'INSERT INTO users (name, email) VALUES (?, ?)'
  );

  const users = [
    ['Alex Chen', 'alex@techflow.ai'],
    ['Maria Santos', 'maria@codebuddy.dev'],
    ['James Okafor', 'james@shipfast.io'],
    ['Sarah Kim', 'sarah@datapipe.com'],
    ['Raj Patel', 'raj@metrichub.io'],
  ];

  for (const [name, email] of users) {
    insertUser.run(name, email);
  }

  console.log('Seeding startups...');
  const insertStartup = db.prepare(`
    INSERT INTO startups (
      name, tagline, description, url, category_id, upvotes
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const startupsData = [
    {
      name: 'TechFlow AI',
      tagline: 'AI-powered workflow automation for modern teams',
      description:
        'TechFlow AI is a platform that uses artificial intelligence to automate repetitive workflows across your organization.',
      url: 'https://techflow.ai',
      categoryId: 1,
      upvotes: 42,
    },
    {
      name: 'CodeBuddy',
      tagline:
        'Your AI pair programmer that actually understands context and intent',
      description:
        'CodeBuddy is an AI coding assistant that integrates with your IDE and understands your entire codebase for better suggestions.',
      url: 'https://codebuddy.dev',
      categoryId: 1,
      upvotes: 28,
    },
    {
      name: 'ShipFast',
      tagline:
        'Deploy to production in under sixty seconds with zero configuration',
      description:
        'ShipFast handles building, testing, and deploying your application automatically. Just push to main and it handles the rest.',
      url: 'https://shipfast.io',
      categoryId: 2,
      upvotes: 15,
    },
    {
      name: 'DataPipe',
      tagline:
        'Real-time data pipelines without writing any infrastructure code',
      description:
        'DataPipe lets you build data pipelines visually. Connect sources, transform data, and route it to destinations without code.',
      url: 'https://datapipe.com',
      categoryId: 2,
      upvotes: 33,
    },
    {
      name: 'MetricHub',
      tagline:
        'Product analytics that developers actually want to use every day',
      description:
        'MetricHub provides simple and powerful product analytics with a developer-first approach and SQL-based querying interface.',
      url: 'https://metrichub.io',
      categoryId: 3,
      upvotes: 19,
    },
    {
      name: 'PayBridge',
      tagline: 'Cross-border payment infrastructure for emerging markets',
      description:
        'PayBridge simplifies international payments with local payment method support, automatic currency conversion, and regulatory compliance.',
      url: 'https://paybridge.finance',
      categoryId: 4,
      upvotes: 25,
    },
    {
      name: 'MediSync',
      tagline:
        'Real-time patient data synchronization across hospital systems',
      description:
        'MediSync connects disparate hospital systems to provide a unified view of patient data, reducing errors and improving care coordination.',
      url: 'https://medisync.health',
      categoryId: 5,
      upvotes: 31,
    },
    {
      name: 'GreenRoute',
      tagline: 'Sustainable logistics optimization for last-mile delivery',
      description:
        'GreenRoute uses AI to optimize delivery routes, reducing carbon emissions while improving delivery speed and reducing costs for logistics companies.',
      url: 'https://greenroute.eco',
      categoryId: 6,
      upvotes: 22,
    },
  ];

  for (const s of startupsData) {
    insertStartup.run(
      s.name,
      s.tagline,
      s.description,
      s.url,
      s.categoryId,
      s.upvotes
    );
  }

  // Print summary
  const categoryCount = db
    .prepare('SELECT COUNT(*) as count FROM categories')
    .get() as { count: number };
  const userCount = db
    .prepare('SELECT COUNT(*) as count FROM users')
    .get() as { count: number };
  const startupCount = db
    .prepare('SELECT COUNT(*) as count FROM startups')
    .get() as { count: number };

  console.log('');
  console.log('Seed complete:');
  console.log('  Categories: ' + categoryCount.count);
  console.log('  Users:      ' + userCount.count);
  console.log('  Startups:   ' + startupCount.count);

  db.close();
}

seed();
