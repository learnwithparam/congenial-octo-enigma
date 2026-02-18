// src/data/store.ts

export interface StartupRecord {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  url: string;
  upvotes: number;
  categoryId: string;
  founderId: string;
  createdAt: string;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
}

export interface CommentRecord {
  id: string;
  content: string;
  startupId: string;
  authorId: string;
  createdAt: string;
}

export const users: UserRecord[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    email: 'sarah@example.com',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah',
  },
  {
    id: '2',
    name: 'Alex Rivera',
    email: 'alex@example.com',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
  },
  {
    id: '3',
    name: 'Jordan Lee',
    email: 'jordan@example.com',
    avatarUrl: null,
  },
  {
    id: '4',
    name: 'Maya Patel',
    email: 'maya@example.com',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=maya',
  },
  {
    id: '5',
    name: 'Chris Nakamura',
    email: 'chris@example.com',
    avatarUrl: null,
  },
];

export const categories: CategoryRecord[] = [
  { id: '1', name: 'AI/ML', slug: 'ai-ml' },
  { id: '2', name: 'Developer Tools', slug: 'developer-tools' },
  { id: '3', name: 'Fintech', slug: 'fintech' },
  { id: '4', name: 'Health Tech', slug: 'health-tech' },
  { id: '5', name: 'Education', slug: 'education' },
];

export const startups: StartupRecord[] = [
  {
    id: '1',
    name: 'CodeBuddy AI',
    slug: 'codebuddy-ai',
    tagline: 'Your AI pair programming partner',
    description:
      'CodeBuddy AI uses large language models to help you write, review, and debug code faster. It integrates with VS Code, JetBrains, and Neovim.',
    url: 'https://codebuddy.ai',
    upvotes: 342,
    categoryId: '1',
    founderId: '1',
    createdAt: '2026-01-15T10:30:00Z',
  },
  {
    id: '2',
    name: 'DeployBot',
    slug: 'deploybot',
    tagline: 'One-click deployments for any stack',
    description:
      'DeployBot automates your deployment pipeline. Connect your repo, configure your stack, and deploy with a single click. Supports Docker, Kubernetes, and serverless.',
    url: 'https://deploybot.dev',
    upvotes: 218,
    categoryId: '2',
    founderId: '2',
    createdAt: '2026-01-20T14:00:00Z',
  },
  {
    id: '3',
    name: 'FinTrack',
    slug: 'fintrack',
    tagline: 'Personal finance tracking with AI insights',
    description:
      'FinTrack connects to your bank accounts and uses AI to categorize spending, predict bills, and suggest savings opportunities.',
    url: 'https://fintrack.io',
    upvotes: 175,
    categoryId: '3',
    founderId: '3',
    createdAt: '2026-01-25T09:15:00Z',
  },
  {
    id: '4',
    name: 'MedNote',
    slug: 'mednote',
    tagline: 'AI-powered medical note transcription',
    description:
      'MedNote listens to doctor-patient conversations and generates structured medical notes automatically, saving physicians hours of documentation time.',
    url: 'https://mednote.health',
    upvotes: 289,
    categoryId: '4',
    founderId: '4',
    createdAt: '2026-02-01T11:45:00Z',
  },
  {
    id: '5',
    name: 'LearnPath',
    slug: 'learnpath',
    tagline: 'Personalized learning roadmaps',
    description:
      'LearnPath creates custom learning paths based on your goals, current skills, and preferred learning style. Aggregates content from across the web.',
    url: 'https://learnpath.edu',
    upvotes: 156,
    categoryId: '5',
    founderId: '5',
    createdAt: '2026-02-05T16:20:00Z',
  },
  {
    id: '6',
    name: 'SynthVoice',
    slug: 'synthvoice',
    tagline: 'Generate natural-sounding voices for any content',
    description:
      'SynthVoice turns text into natural-sounding speech in over 40 languages. Perfect for podcasts, video narration, and accessibility.',
    url: 'https://synthvoice.ai',
    upvotes: 203,
    categoryId: '1',
    founderId: '2',
    createdAt: '2026-02-08T13:00:00Z',
  },
];

export const comments: CommentRecord[] = [
  {
    id: '1',
    content: 'Love this tool! Saved me hours on code review.',
    startupId: '1',
    authorId: '2',
    createdAt: '2026-02-08T09:15:00Z',
  },
  {
    id: '2',
    content: 'The VS Code integration is seamless. Great work.',
    startupId: '1',
    authorId: '3',
    createdAt: '2026-02-09T11:30:00Z',
  },
  {
    id: '3',
    content: 'How does this compare to GitHub Copilot?',
    startupId: '1',
    authorId: '4',
    createdAt: '2026-02-10T14:45:00Z',
  },
  {
    id: '4',
    content: 'Deployed our staging environment in under 2 minutes. Impressed.',
    startupId: '2',
    authorId: '1',
    createdAt: '2026-02-11T10:00:00Z',
  },
  {
    id: '5',
    content: 'Would love to see Terraform support added.',
    startupId: '2',
    authorId: '5',
    createdAt: '2026-02-12T15:30:00Z',
  },
  {
    id: '6',
    content: 'The AI categorization is surprisingly accurate.',
    startupId: '3',
    authorId: '1',
    createdAt: '2026-02-13T08:20:00Z',
  },
  {
    id: '7',
    content: 'This will transform clinical documentation. Amazing.',
    startupId: '4',
    authorId: '5',
    createdAt: '2026-02-14T12:10:00Z',
  },
  {
    id: '8',
    content: 'As a doctor, I can confirm this saves at least 2 hours per day.',
    startupId: '4',
    authorId: '3',
    createdAt: '2026-02-15T09:45:00Z',
  },
];

let nextStartupId = 7;
let nextCommentId = 9;

export function generateStartupId(): string {
  return String(nextStartupId++);
}

export function generateCommentId(): string {
  return String(nextCommentId++);
}

export function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
