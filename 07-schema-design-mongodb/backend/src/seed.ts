import { ObjectId } from 'mongodb';
import { connectDb, closeDb } from './db.js';
import { initCollections, getUsersCol, getCategoriesCol, getStartupsCol } from './collections.js';
import { createIndexes } from './indexes.js';
import type { User, Category, Startup } from './types.js';

async function seed() {
  const db = await connectDb();
  initCollections(db);

  console.log('Seeding database...');

  // Clear existing data
  await getStartupsCol().deleteMany({});
  await getCategoriesCol().deleteMany({});
  await getUsersCol().deleteMany({});

  // ----------------------------------------------------------
  // Users
  // ----------------------------------------------------------
  const now = new Date();

  const usersData: User[] = [
    { name: 'Alice Johnson', email: 'alice@example.com', bio: 'Full-stack developer and startup enthusiast.', createdAt: now, updatedAt: now },
    { name: 'Bob Smith', email: 'bob@example.com', bio: 'Designer turned founder. Building tools for creators.', createdAt: now, updatedAt: now },
    { name: 'Carol Williams', email: 'carol@example.com', bio: 'Product manager with a passion for developer tools.', createdAt: now, updatedAt: now },
    { name: 'David Brown', email: 'david@example.com', bio: 'Serial entrepreneur. Third startup and counting.', createdAt: now, updatedAt: now },
    { name: 'Eva Martinez', email: 'eva@example.com', bio: 'AI researcher exploring practical applications.', createdAt: now, updatedAt: now },
  ];

  const { insertedIds: userIds } = await getUsersCol().insertMany(usersData);
  console.log(`Inserted ${Object.keys(userIds).length} users.`);

  // ----------------------------------------------------------
  // Categories
  // ----------------------------------------------------------
  const categoriesData: Category[] = [
    { name: 'Developer Tools', slug: 'developer-tools', description: 'Tools that make developers more productive.', createdAt: now },
    { name: 'AI & Machine Learning', slug: 'ai-machine-learning', description: 'Products powered by artificial intelligence.', createdAt: now },
    { name: 'SaaS', slug: 'saas', description: 'Software as a service products.', createdAt: now },
    { name: 'Design', slug: 'design', description: 'Design tools, resources, and platforms.', createdAt: now },
    { name: 'Productivity', slug: 'productivity', description: 'Tools that help you get more done.', createdAt: now },
  ];

  const { insertedIds: catIds } = await getCategoriesCol().insertMany(categoriesData);
  console.log(`Inserted ${Object.keys(catIds).length} categories.`);

  // Helpers
  const u = (i: number) => userIds[i] as ObjectId;
  const c = (i: number) => catIds[i] as ObjectId;

  // ----------------------------------------------------------
  // Startups (with embedded comments & upvotes)
  // ----------------------------------------------------------
  const startupsData: Startup[] = [
    {
      name: 'CodeFlow',
      slug: 'codeflow',
      tagline: 'Collaborative code review for modern teams',
      description: 'CodeFlow brings real-time collaboration to code review. Leave comments, suggest changes, and merge with confidence. Built for teams that ship fast.',
      websiteUrl: 'https://codeflow.example.com',
      categoryId: c(0),
      founderId: u(0),
      status: 'active',
      featured: true,
      comments: [
        { _id: new ObjectId(), content: 'This is exactly what our team needed. The real-time collaboration features are top notch.', userId: u(1), createdAt: now },
        { _id: new ObjectId(), content: 'Been using the beta for two weeks. Huge improvement over our previous workflow.', userId: u(2), createdAt: now },
      ],
      upvotes: [
        { userId: u(1), createdAt: now },
        { userId: u(2), createdAt: now },
        { userId: u(3), createdAt: now },
        { userId: u(4), createdAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      name: 'PromptLab',
      slug: 'promptlab',
      tagline: 'Test and iterate on LLM prompts',
      description: 'PromptLab gives you a playground for testing prompts against multiple language models. Compare outputs, track versions, and share templates with your team.',
      websiteUrl: 'https://promptlab.example.com',
      categoryId: c(1),
      founderId: u(4),
      status: 'active',
      featured: true,
      comments: [
        { _id: new ObjectId(), content: 'The multi-model comparison feature is incredibly useful for prompt engineering.', userId: u(0), createdAt: now },
        { _id: new ObjectId(), content: 'Love the version tracking. Finally I can see how my prompts evolved.', userId: u(3), createdAt: now },
      ],
      upvotes: [
        { userId: u(0), createdAt: now },
        { userId: u(2), createdAt: now },
        { userId: u(3), createdAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      name: 'InvoiceBot',
      slug: 'invoicebot',
      tagline: 'Automated invoicing for freelancers',
      description: 'Stop chasing payments. InvoiceBot generates, sends, and tracks invoices automatically. Integrates with Stripe, PayPal, and bank transfers.',
      websiteUrl: 'https://invoicebot.example.com',
      categoryId: c(2),
      founderId: u(3),
      status: 'active',
      featured: false,
      comments: [
        { _id: new ObjectId(), content: 'Saved me so much time on invoicing. The Stripe integration works flawlessly.', userId: u(0), createdAt: now },
      ],
      upvotes: [
        { userId: u(0), createdAt: now },
        { userId: u(4), createdAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      name: 'PixelSnap',
      slug: 'pixelsnap',
      tagline: 'Design-to-code in one click',
      description: 'Upload any design file and PixelSnap generates clean, responsive HTML and CSS. Supports Figma, Sketch, and Adobe XD imports.',
      websiteUrl: 'https://pixelsnap.example.com',
      categoryId: c(3),
      founderId: u(1),
      status: 'active',
      featured: false,
      comments: [
        { _id: new ObjectId(), content: 'The generated code is surprisingly clean. Impressed with the Figma support.', userId: u(4), createdAt: now },
      ],
      upvotes: [
        { userId: u(0), createdAt: now },
        { userId: u(2), createdAt: now },
        { userId: u(4), createdAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      name: 'FocusMode',
      slug: 'focusmode',
      tagline: 'Block distractions and track deep work',
      description: 'FocusMode blocks distracting websites and apps during work sessions. Track your deep work hours, set daily goals, and build streaks.',
      websiteUrl: 'https://focusmode.example.com',
      categoryId: c(4),
      founderId: u(2),
      status: 'active',
      featured: false,
      comments: [
        { _id: new ObjectId(), content: 'My screen time dropped by 40 percent since I started using FocusMode.', userId: u(3), createdAt: now },
      ],
      upvotes: [
        { userId: u(0), createdAt: now },
        { userId: u(1), createdAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      name: 'SchemaViz',
      slug: 'schemaviz',
      tagline: 'Visualize your database schema instantly',
      description: 'Connect SchemaViz to any PostgreSQL, MySQL, or SQLite database and get an interactive ER diagram in seconds. Export to PNG, SVG, or share a live link.',
      websiteUrl: 'https://schemaviz.example.com',
      categoryId: c(0),
      founderId: u(2),
      status: 'pending',
      featured: false,
      comments: [
        { _id: new ObjectId(), content: 'Great idea! Would love to see MySQL support added soon.', userId: u(0), createdAt: now },
      ],
      upvotes: [
        { userId: u(3), createdAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      name: 'SentimentAI',
      slug: 'sentimentai',
      tagline: 'Real-time sentiment analysis for customer feedback',
      description: 'SentimentAI processes customer reviews, support tickets, and social mentions in real time. Get alerts when sentiment drops and identify trends before they become problems.',
      categoryId: c(1),
      founderId: u(3),
      status: 'active',
      featured: false,
      comments: [],
      upvotes: [
        { userId: u(0), createdAt: now },
        { userId: u(1), createdAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      name: 'TaskPilot',
      slug: 'taskpilot',
      tagline: 'AI-powered task prioritization',
      description: 'TaskPilot uses machine learning to analyze your task list and suggest the optimal order. It learns from your habits and adapts to your work style over time.',
      categoryId: c(4),
      founderId: u(4),
      status: 'active',
      featured: true,
      comments: [
        { _id: new ObjectId(), content: 'The AI prioritization is scarily accurate. It knows my work patterns better than I do.', userId: u(1), createdAt: now },
        { _id: new ObjectId(), content: 'Integrates perfectly with our existing project management setup.', userId: u(2), createdAt: now },
      ],
      upvotes: [
        { userId: u(0), createdAt: now },
        { userId: u(1), createdAt: now },
        { userId: u(2), createdAt: now },
        { userId: u(3), createdAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];

  const { insertedIds: startupIds } = await getStartupsCol().insertMany(startupsData);
  console.log(`Inserted ${Object.keys(startupIds).length} startups.`);

  // Create indexes
  await createIndexes();

  console.log('Seeding complete.');
  await closeDb();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
