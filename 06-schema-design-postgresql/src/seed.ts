import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './db/schema.js';

async function seed() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'launchpad',
  });

  const db = drizzle(pool, { schema });

  console.log('Seeding database...');

  // ----------------------------------------------------------
  // Clear existing data (in reverse order of dependencies)
  // ----------------------------------------------------------
  await db.delete(schema.upvotes);
  await db.delete(schema.comments);
  await db.delete(schema.startups);
  await db.delete(schema.categories);
  await db.delete(schema.users);

  // ----------------------------------------------------------
  // Users
  // ----------------------------------------------------------
  const insertedUsers = await db
    .insert(schema.users)
    .values([
      {
        name: 'Alice Johnson',
        email: 'alice@example.com',
        bio: 'Full-stack developer and startup enthusiast.',
      },
      {
        name: 'Bob Smith',
        email: 'bob@example.com',
        bio: 'Designer turned founder. Building tools for creators.',
      },
      {
        name: 'Carol Williams',
        email: 'carol@example.com',
        bio: 'Product manager with a passion for developer tools.',
      },
      {
        name: 'David Brown',
        email: 'david@example.com',
        bio: 'Serial entrepreneur. Third startup and counting.',
      },
      {
        name: 'Eva Martinez',
        email: 'eva@example.com',
        bio: 'AI researcher exploring practical applications.',
      },
    ])
    .returning();

  console.log('Inserted ' + insertedUsers.length + ' users.');

  // ----------------------------------------------------------
  // Categories
  // ----------------------------------------------------------
  const insertedCategories = await db
    .insert(schema.categories)
    .values([
      {
        name: 'Developer Tools',
        slug: 'developer-tools',
        description: 'Tools that make developers more productive.',
      },
      {
        name: 'AI & Machine Learning',
        slug: 'ai-machine-learning',
        description: 'Products powered by artificial intelligence.',
      },
      {
        name: 'SaaS',
        slug: 'saas',
        description: 'Software as a service products.',
      },
      {
        name: 'Design',
        slug: 'design',
        description: 'Design tools, resources, and platforms.',
      },
      {
        name: 'Productivity',
        slug: 'productivity',
        description: 'Tools that help you get more done.',
      },
    ])
    .returning();

  console.log('Inserted ' + insertedCategories.length + ' categories.');

  // ----------------------------------------------------------
  // Startups
  // ----------------------------------------------------------
  const insertedStartups = await db
    .insert(schema.startups)
    .values([
      {
        name: 'CodeFlow',
        slug: 'codeflow',
        tagline: 'Collaborative code review for modern teams',
        description:
          'CodeFlow brings real-time collaboration to code review. Leave comments, suggest changes, and merge with confidence. Built for teams that ship fast.',
        websiteUrl: 'https://codeflow.example.com',
        categoryId: insertedCategories[0].id,
        founderId: insertedUsers[0].id,
        status: 'active',
        featured: true,
      },
      {
        name: 'PromptLab',
        slug: 'promptlab',
        tagline: 'Test and iterate on LLM prompts',
        description:
          'PromptLab gives you a playground for testing prompts against multiple language models. Compare outputs, track versions, and share templates with your team.',
        websiteUrl: 'https://promptlab.example.com',
        categoryId: insertedCategories[1].id,
        founderId: insertedUsers[4].id,
        status: 'active',
        featured: true,
      },
      {
        name: 'InvoiceBot',
        slug: 'invoicebot',
        tagline: 'Automated invoicing for freelancers',
        description:
          'Stop chasing payments. InvoiceBot generates, sends, and tracks invoices automatically. Integrates with Stripe, PayPal, and bank transfers.',
        websiteUrl: 'https://invoicebot.example.com',
        categoryId: insertedCategories[2].id,
        founderId: insertedUsers[3].id,
        status: 'active',
        featured: false,
      },
      {
        name: 'PixelSnap',
        slug: 'pixelsnap',
        tagline: 'Design-to-code in one click',
        description:
          'Upload any design file and PixelSnap generates clean, responsive HTML and CSS. Supports Figma, Sketch, and Adobe XD imports.',
        websiteUrl: 'https://pixelsnap.example.com',
        categoryId: insertedCategories[3].id,
        founderId: insertedUsers[1].id,
        status: 'active',
        featured: false,
      },
      {
        name: 'FocusMode',
        slug: 'focusmode',
        tagline: 'Block distractions and track deep work',
        description:
          'FocusMode blocks distracting websites and apps during work sessions. Track your deep work hours, set daily goals, and build streaks.',
        websiteUrl: 'https://focusmode.example.com',
        categoryId: insertedCategories[4].id,
        founderId: insertedUsers[2].id,
        status: 'active',
        featured: false,
      },
      {
        name: 'SchemaViz',
        slug: 'schemaviz',
        tagline: 'Visualize your database schema instantly',
        description:
          'Connect SchemaViz to any PostgreSQL, MySQL, or SQLite database and get an interactive ER diagram in seconds. Export to PNG, SVG, or share a live link.',
        websiteUrl: 'https://schemaviz.example.com',
        categoryId: insertedCategories[0].id,
        founderId: insertedUsers[2].id,
        status: 'pending',
        featured: false,
      },
      {
        name: 'SentimentAI',
        slug: 'sentimentai',
        tagline: 'Real-time sentiment analysis for customer feedback',
        description:
          'SentimentAI processes customer reviews, support tickets, and social mentions in real time. Get alerts when sentiment drops and identify trends before they become problems.',
        categoryId: insertedCategories[1].id,
        founderId: insertedUsers[3].id,
        status: 'active',
        featured: false,
      },
      {
        name: 'TaskPilot',
        slug: 'taskpilot',
        tagline: 'AI-powered task prioritization',
        description:
          'TaskPilot uses machine learning to analyze your task list and suggest the optimal order. It learns from your habits and adapts to your work style over time.',
        categoryId: insertedCategories[4].id,
        founderId: insertedUsers[4].id,
        status: 'active',
        featured: true,
      },
    ])
    .returning();

  console.log('Inserted ' + insertedStartups.length + ' startups.');

  // ----------------------------------------------------------
  // Comments
  // ----------------------------------------------------------
  const insertedComments = await db
    .insert(schema.comments)
    .values([
      {
        content: 'This is exactly what our team needed. The real-time collaboration features are top notch.',
        startupId: insertedStartups[0].id,
        userId: insertedUsers[1].id,
      },
      {
        content: 'Been using the beta for two weeks. Huge improvement over our previous workflow.',
        startupId: insertedStartups[0].id,
        userId: insertedUsers[2].id,
      },
      {
        content: 'The multi-model comparison feature is incredibly useful for prompt engineering.',
        startupId: insertedStartups[1].id,
        userId: insertedUsers[0].id,
      },
      {
        content: 'Love the version tracking. Finally I can see how my prompts evolved.',
        startupId: insertedStartups[1].id,
        userId: insertedUsers[3].id,
      },
      {
        content: 'Saved me so much time on invoicing. The Stripe integration works flawlessly.',
        startupId: insertedStartups[2].id,
        userId: insertedUsers[0].id,
      },
      {
        content: 'The generated code is surprisingly clean. Impressed with the Figma support.',
        startupId: insertedStartups[3].id,
        userId: insertedUsers[4].id,
      },
      {
        content: 'My screen time dropped by 40 percent since I started using FocusMode.',
        startupId: insertedStartups[4].id,
        userId: insertedUsers[3].id,
      },
      {
        content: 'Great idea! Would love to see MySQL support added soon.',
        startupId: insertedStartups[5].id,
        userId: insertedUsers[0].id,
      },
      {
        content: 'The AI prioritization is scarily accurate. It knows my work patterns better than I do.',
        startupId: insertedStartups[7].id,
        userId: insertedUsers[1].id,
      },
      {
        content: 'Integrates perfectly with our existing project management setup.',
        startupId: insertedStartups[7].id,
        userId: insertedUsers[2].id,
      },
    ])
    .returning();

  console.log('Inserted ' + insertedComments.length + ' comments.');

  // ----------------------------------------------------------
  // Upvotes
  // ----------------------------------------------------------
  const insertedUpvotes = await db
    .insert(schema.upvotes)
    .values([
      { startupId: insertedStartups[0].id, userId: insertedUsers[1].id },
      { startupId: insertedStartups[0].id, userId: insertedUsers[2].id },
      { startupId: insertedStartups[0].id, userId: insertedUsers[3].id },
      { startupId: insertedStartups[0].id, userId: insertedUsers[4].id },
      { startupId: insertedStartups[1].id, userId: insertedUsers[0].id },
      { startupId: insertedStartups[1].id, userId: insertedUsers[2].id },
      { startupId: insertedStartups[1].id, userId: insertedUsers[3].id },
      { startupId: insertedStartups[2].id, userId: insertedUsers[0].id },
      { startupId: insertedStartups[2].id, userId: insertedUsers[4].id },
      { startupId: insertedStartups[3].id, userId: insertedUsers[0].id },
      { startupId: insertedStartups[3].id, userId: insertedUsers[2].id },
      { startupId: insertedStartups[3].id, userId: insertedUsers[4].id },
      { startupId: insertedStartups[4].id, userId: insertedUsers[0].id },
      { startupId: insertedStartups[4].id, userId: insertedUsers[1].id },
      { startupId: insertedStartups[5].id, userId: insertedUsers[3].id },
      { startupId: insertedStartups[6].id, userId: insertedUsers[0].id },
      { startupId: insertedStartups[6].id, userId: insertedUsers[1].id },
      { startupId: insertedStartups[7].id, userId: insertedUsers[0].id },
      { startupId: insertedStartups[7].id, userId: insertedUsers[1].id },
      { startupId: insertedStartups[7].id, userId: insertedUsers[2].id },
      { startupId: insertedStartups[7].id, userId: insertedUsers[3].id },
    ])
    .returning();

  console.log('Inserted ' + insertedUpvotes.length + ' upvotes.');

  console.log('Seeding complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
